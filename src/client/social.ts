/**
 * src/client/social.ts
 * --------------------
 * The social layer: hiscores. Written against a small SocialBackend interface so
 * the data source is swappable.
 *
 *  - SupabaseSocialBackend (default): a real shared, identity-backed board. It
 *    reads the global rankings (public) and, when you're signed in, upserts your
 *    own row keyed by your Supabase user — the SAME account as the idle game.
 *  - LocalSocialBackend (fallback): ranks every character saved on this device,
 *    used when Supabase can't be reached so the board is never empty/broken.
 */

import type { Content, SkillId } from "../core/types.ts";
import { levelForXp } from "../content/xpCurve.ts";
import { listAccounts, readSave, readSaveFor } from "./storage.ts";
import { currentUser, rest } from "./supabase.ts";

/** One ranked character on the hiscores board. */
export interface HiscoreEntry {
  name: string;
  totalLevel: number;
  combat: number;
  playMs: number;
  diaries: number;
  monstersSlain: number;
  goldEarned: number;
  /** Supabase user id (shared board only), used to flag your own row. */
  userId?: string;
  /** True for the entry that is the player's own. */
  you?: boolean;
  /** Varathian Trail laps run — the trail billboard ranks by this. */
  trailLaps?: number;
  /** Duel Ring record — the public Wins Board ranks by victories. */
  duelWins?: number;
  duelLosses?: number;
  /** Duel ladder rating — the PvP prestige number (see DUEL_RATING_BASE). */
  duelRating?: number;
  /** Sum of raw XP across all skills — the prestige long-tail past level 100. */
  totalXp?: number;
  /** This angler's single heaviest pier catch — for the shared records board.
   *  `pierSpecies` is an index into content.pierFish. */
  pierWeight?: number;
  pierLength?: number;
  pierSpecies?: number;
  /** Per-skill level, keyed by skill id — shown on a player's profile. */
  skills?: Record<string, number>;
  /** A cosmetic supporter — gold name + Founder tag on the board. */
  founder?: boolean;
}

export interface SocialBackend {
  /** Push the current character's stats (no-op when signed out / local). */
  submit(entry: HiscoreEntry): Promise<void>;
  /** Fetch the ranked board. */
  hiscores(): Promise<HiscoreEntry[]>;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Build a hiscore entry from a raw save blob (the shape save.ts writes). */
export function entryFromSave(raw: unknown, content: Content): HiscoreEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const skills = (r["skills"] ?? {}) as Partial<Record<SkillId, number>>;
  const lvl = (id: SkillId): number => levelForXp(skills[id] ?? 0);
  const ids = Object.keys(skills) as SkillId[];
  if (ids.length === 0) return null;
  const totalLevel = ids.reduce((n, id) => n + lvl(id), 0);
  const totalXp = ids.reduce((n, id) => n + num(skills[id]), 0);
  // Mirrors combatLevel() in worldCore: base (ward+vitality) plus the strongest
  // offensive style — melee (edge+vigour), ranged (draw) or magic/Devotion (faith).
  const combat = Math.floor(
    (lvl("ward") + lvl("vitality")) / 4 +
      Math.max((lvl("edge") + lvl("vigour")) / 4, lvl("draw") / 2, lvl("faith") / 2),
  );
  const app = (r["appearance"] ?? {}) as Record<string, unknown>;
  const stats = (r["stats"] ?? {}) as Record<string, unknown>;
  const skillLevels: Record<string, number> = {};
  for (const id of ids) skillLevels[id] = lvl(id);
  const myName = typeof app["name"] === "string" && app["name"] ? (app["name"] as string) : "Wanderer";
  // This angler's own heaviest pier catch (rivals seeded on the board are skipped).
  let pierWeight = 0, pierLength = 0, pierSpecies = 0;
  const recs = r["fishingRecords"];
  if (Array.isArray(recs)) {
    for (const rec of recs as { species?: string; weight?: number; length?: number; angler?: string }[]) {
      if (!rec || rec.angler !== myName || !Number.isFinite(rec.weight)) continue;
      if ((rec.weight ?? 0) > pierWeight) {
        pierWeight = rec.weight ?? 0;
        pierLength = rec.length ?? 0;
        pierSpecies = Math.max(0, content.pierFish.findIndex((f) => f.name === rec.species));
      }
    }
  }
  return {
    name: myName,
    totalLevel,
    combat,
    playMs: num(r["playMs"]),
    diaries: Array.isArray(r["diariesClaimed"]) ? (r["diariesClaimed"] as unknown[]).length : 0,
    monstersSlain: num(stats["monstersSlain"]),
    goldEarned: num(stats["goldEarned"]),
    trailLaps: num(r["trailLaps"]),
    duelWins: num(stats["duelWins"]),
    duelLosses: num(stats["duelLosses"]),
    duelRating: num(stats["duelRating"]),
    totalXp,
    pierWeight,
    pierLength,
    pierSpecies,
    skills: skillLevels,
    founder: Array.isArray(r["flags"]) && (r["flags"] as unknown[]).includes("founder"),
  };
}

/** Ranks every character saved on this device. Server-free fallback. */
class LocalSocialBackend implements SocialBackend {
  constructor(private content: Content) {}
  async submit(): Promise<void> { /* local reads live saves directly */ }
  async hiscores(): Promise<HiscoreEntry[]> {
    const out: HiscoreEntry[] = [];
    for (const name of listAccounts()) {
      const e = entryFromSave(readSaveFor(name), this.content);
      if (e) out.push(e);
    }
    return out;
  }
}

/** Maps a Supabase row (snake_case) to a HiscoreEntry. */
function rowToEntry(row: Record<string, unknown>): HiscoreEntry {
  const e: HiscoreEntry = {
    name: typeof row["name"] === "string" ? (row["name"] as string) : "Wanderer",
    totalLevel: num(row["total_level"]),
    combat: num(row["combat"]),
    playMs: num(row["play_ms"]),
    diaries: num(row["diaries"]),
    monstersSlain: num(row["monsters_slain"]),
    goldEarned: num(row["gold_earned"]),
  };
  if (typeof row["user_id"] === "string") e.userId = row["user_id"] as string;
  if (row["founder"] === true) e.founder = true;
  if (row["skills"] && typeof row["skills"] === "object") {
    const sk = { ...(row["skills"] as Record<string, number>) };
    e.trailLaps = num(sk["__trail_laps"]);
    e.duelWins = num(sk["__duel_w"]);
    e.duelLosses = num(sk["__duel_l"]);
    e.duelRating = num(sk["__duel_r"]);
    e.totalXp = num(sk["__total_xp"]);
    e.pierWeight = num(sk["__pier_w"]) / 10;
    e.pierLength = num(sk["__pier_len"]);
    e.pierSpecies = num(sk["__pier_sp"]);
    if (num(sk["__founder"]) > 0) e.founder = true;
    delete sk["__trail_laps"];
    delete sk["__duel_w"];
    delete sk["__duel_l"];
    delete sk["__duel_r"];
    delete sk["__total_xp"];
    delete sk["__pier_w"];
    delete sk["__pier_len"];
    delete sk["__pier_sp"];
    delete sk["__founder"];
    e.skills = sk;
  }
  return e;
}

/** Fetch one player's public profile (skills + playtime) by their user id. */
export async function profileFor(userId: string): Promise<HiscoreEntry | null> {
  try {
    const res = await rest(`world_hiscores?user_id=eq.${userId}&select=*`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length ? rowToEntry(data[0]) : null;
  } catch { return null; }
}

/** The real shared board, backed by Supabase + your account. */
class SupabaseSocialBackend implements SocialBackend {
  async submit(entry: HiscoreEntry): Promise<void> {
    const user = currentUser();
    if (!user) return; // reading is public; writing needs you signed in
    try {
      await rest("world_hiscores?on_conflict=user_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          user_id: user.id,
          name: entry.name,
          total_level: entry.totalLevel,
          combat: entry.combat,
          play_ms: entry.playMs,
          diaries: entry.diaries,
          monsters_slain: entry.monstersSlain,
          gold_earned: entry.goldEarned,
          // Trail laps + duel record ride in the skills JSON under reserved
          // keys — no schema change needed on the shared board.
          skills: {
            ...(entry.skills ?? {}),
            __trail_laps: entry.trailLaps ?? 0,
            __duel_w: entry.duelWins ?? 0,
            __duel_l: entry.duelLosses ?? 0,
            __duel_r: entry.duelRating ?? 0,
            __total_xp: entry.totalXp ?? 0,
            // Best pier catch: weight ×10 (keeps one decimal as an int), length, species index.
            __pier_w: Math.round((entry.pierWeight ?? 0) * 10),
            __pier_len: entry.pierLength ?? 0,
            __pier_sp: entry.pierSpecies ?? 0,
            __founder: entry.founder ? 1 : 0,
          },
        },
      });
    } catch { /* offline — try again next time the board opens */ }
  }
  async hiscores(): Promise<HiscoreEntry[]> {
    const res = await rest("world_hiscores?select=*");
    if (!res.ok) throw new Error(`hiscores ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data.map(rowToEntry) : [];
  }
}

const supabase = new SupabaseSocialBackend();

/** The shared board (Supabase). Reads are public; submit needs a signed-in user. */
export function getSocial(_content: Content): SocialBackend {
  return supabase;
}

/** Device-local ranking, used as a fallback when the shared board is offline. */
export function getLocal(content: Content): SocialBackend {
  return new LocalSocialBackend(content);
}

/** Push the active character's current stats to the shared board (needs sign-in).
 *  Called when the board opens so friends always see your latest. */
export async function submitCurrent(content: Content): Promise<void> {
  if (!currentUser()) return;
  const entry = entryFromSave(readSave(), content);
  if (entry) await supabase.submit(entry);
}
