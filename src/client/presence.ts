/**
 * src/client/presence.ts
 * ----------------------
 * The ghost layer: see other signed-in players as translucent figures in the
 * shared world. Each player periodically publishes a tiny "presence" row
 * (position + look + zone); everyone reads back the recent ones for their zone.
 * Purely cosmetic — ghosts never interact with the core, like the hiscores board.
 *
 * Snapshots arrive every poll, so to avoid teleporting we keep each ghost's last
 * two positions and GLIDE between them: currentGhosts() returns an interpolated
 * position computed at the moment the renderer asks, so motion looks smooth even
 * though the data underneath is a slow series of snapshots.
 *
 * "Zone" keeps you from seeing players inside their own sealed home instances:
 * the overworld is one shared zone; each interior is its own.
 */

import type { Appearance } from "../core/types.ts";
import { instanceRectAt } from "../content/map.ts";
import { currentUser, rest } from "./supabase.ts";
import type { GearLook } from "./gearLook.ts";

export interface Ghost {
  id: string;
  name: string;
  x: number;
  y: number;
  look: Appearance;
  gear: GearLook;
  /** True while gliding between snapshots, so the figure shows a walk cycle. */
  moving: boolean;
  /** True when the ghost is facing/moving left (mirror the figure). */
  faceLeft: boolean;
  /** Which way the ghost is facing, four-way — the same thing the local player
   *  has always had. Ghosts only ever carried a left/right boolean, so another
   *  player walking north or south was drawn in profile like everyone else. */
  facing: Facing;
}

/** Four-way facing, matching the renderer's own. */
export type Facing = "up" | "down" | "left" | "right";

/** What the game feeds us each beat: where the player is and how they look. */
export interface PresenceSnapshot { x: number; y: number; name: string; look: Appearance; gear: GearLook }

const STALE_MS = 15_000; // a presence older than this is treated as gone
const PUSH_MS = 1_500;   // how often we publish our own position
const PULL_MS = 1_500;   // how often we refresh the ghosts around us
const GLIDE_MS = 1_600;  // how long a ghost takes to slide to its new snapshot
const TELEPORT_TILES = 10; // jumps larger than this snap instead of gliding

/** One tracked ghost: the segment it's currently gliding along. */
interface Rec {
  id: string;
  name: string;
  look: Appearance;
  gear: GearLook;
  face: boolean;                // last horizontal facing (true = left)
  facing: Facing;               // last four-way facing
  fromX: number; fromY: number; // where the glide starts
  toX: number; toY: number;     // the latest snapshot (glide target)
  since: number;                // ms when this segment began
}

const recs = new Map<string, Rec>();
let provider: (() => PresenceSnapshot | null) | null = null;
let started = false;

/** Which shared space a tile belongs to (overworld, or a specific interior). */
function zoneKey(x: number, y: number): string {
  const r = instanceRectAt(Math.round(x), Math.round(y));
  return r ? `i:${r.x0},${r.y0}` : "overworld";
}

const smooth = (t: number): number => t * t * (3 - 2 * t); // ease in/out

/** The ghosts near the player right now, positions interpolated for this frame. */
export function currentGhosts(): Ghost[] {
  const now = Date.now();
  const out: Ghost[] = [];
  for (const r of recs.values()) {
    const t = Math.min(1, (now - r.since) / GLIDE_MS);
    const k = smooth(t);
    out.push({
      id: r.id,
      name: r.name,
      look: r.look,
      gear: r.gear,
      x: r.fromX + (r.toX - r.fromX) * k,
      y: r.fromY + (r.toY - r.fromY) * k,
      moving: t < 1 && (Math.abs(r.toX - r.fromX) + Math.abs(r.toY - r.fromY)) > 0.15,
      faceLeft: r.face,
      facing: r.facing,
    });
  }
  return out;
}

async function push(): Promise<void> {
  const user = currentUser();
  if (!user || !provider) return;
  const s = provider();
  if (!s) return;
  try {
    await rest("world_presence?on_conflict=user_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        user_id: user.id, name: s.name,
        x: s.x, y: s.y, zone: zoneKey(s.x, s.y),
        // Gear is folded into the look blob so no extra DB column is needed.
        look: { ...s.look, _gear: s.gear }, updated_at: new Date().toISOString(),
      },
    });
  } catch { /* offline — try again next beat */ }
}

async function pull(): Promise<void> {
  const user = currentUser();
  if (!user || !provider) return;
  const s = provider();
  if (!s) return;
  const zone = zoneKey(s.x, s.y);
  const since = new Date(Date.now() - STALE_MS).toISOString();
  try {
    const q = `world_presence?select=user_id,name,x,y,look`
      + `&zone=eq.${encodeURIComponent(zone)}`
      + `&updated_at=gte.${encodeURIComponent(since)}`;
    const res = await rest(q);
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;

    const now = Date.now();
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row || !row.look || row.user_id === user.id) continue;
      const id = String(row.user_id);
      seen.add(id);
      const x = Number(row.x) || 0;
      const y = Number(row.y) || 0;
      const name = typeof row.name === "string" && row.name ? row.name : "Wanderer";
      const blob = (row.look ?? {}) as Appearance & { _gear?: GearLook };
      const look = blob as Appearance;
      const gear: GearLook = blob._gear ?? {};
      const prev = recs.get(id);
      if (!prev) {
        recs.set(id, { id, name, look, gear, face: false, facing: "down", fromX: x, fromY: y, toX: x, toY: y, since: now });
        continue;
      }
      // Continue gliding from where the ghost VISUALLY is right now, toward the
      // new snapshot — unless it's a big jump (zone change / respawn), then snap.
      const t = Math.min(1, (now - prev.since) / GLIDE_MS);
      const k = smooth(t);
      const curX = prev.fromX + (prev.toX - prev.fromX) * k;
      const curY = prev.fromY + (prev.toY - prev.fromY) * k;
      const jump = Math.abs(x - prev.toX) + Math.abs(y - prev.toY);
      const teleport = jump > TELEPORT_TILES;
      prev.name = name; prev.look = look; prev.gear = gear;
      // Face the new target. The dominant axis wins, exactly as the local
      // player's facing is chosen (render.ts), so a ghost walking north shows
      // its back rather than staying stuck in profile. The old left/right
      // boolean is kept in step for anything still reading it.
      const dx = x - curX, dy = y - curY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -0.05) prev.facing = "left";
        else if (dx > 0.05) prev.facing = "right";
      } else {
        if (dy < -0.05) prev.facing = "up";
        else if (dy > 0.05) prev.facing = "down";
      }
      prev.face = prev.facing === "left";
      prev.fromX = teleport ? x : curX;
      prev.fromY = teleport ? y : curY;
      prev.toX = x; prev.toY = y;
      prev.since = now;
    }
    // Drop ghosts that aged out of the latest result.
    for (const id of [...recs.keys()]) if (!seen.has(id)) recs.delete(id);
  } catch { /* offline — keep the last set until we can refresh */ }
}

/** Begin publishing + polling presence. `get` returns the live snapshot, or null
 *  (e.g. while the player is dead) to skip a beat. No-op when signed out. */
export function startPresence(get: () => PresenceSnapshot | null): void {
  if (started) return;
  started = true;
  provider = get;
  if (!currentUser()) return; // ghosts are an online-only feature
  void push();
  void pull();
  window.setInterval(() => void push(), PUSH_MS);
  window.setInterval(() => void pull(), PULL_MS);
}
