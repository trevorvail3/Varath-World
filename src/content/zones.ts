/**
 * src/content/zones.ts
 * --------------------
 * The eight wild zones — DERIVED from one table.
 *
 * A camp is a place to stop on the way somewhere. A zone is somewhere you go:
 * a stretch of country with its own name, its own ground, a population big
 * enough to train against, and something at the middle of it worth finding.
 * None of them is gated — no quest, no level, no key. You walk in.
 *
 * They fill the last of the room the Greater World opened. Their anchors are
 * the eight places left over once the six regions, Ironvale and its ring, the
 * fourteen camps, the six towns, the sea and the Redrun are all excluded — and
 * spaced at least 26 tiles from each other, which is exactly eight.
 *
 * Foes, resources and difficulty come from the shared wild kit, so a zone and a
 * camp at the same distance from the city are pitched the same way. What a zone
 * adds is SIZE: ~19x19 of its own terrain, three times a camp's population, and
 * a landmark.
 *
 * RULE 3: pure data + a pure builder.
 */

import { bandAt, foesFor, nodeFor, type NodeKind, type WildTheme } from "./wildKit.ts";
import type { TileType, WorldObjectDef } from "../core/types.ts";

export interface ZoneDef {
  id: string;
  name: string;
  /** What the marker at its heart says when you find it. */
  blurb: string;
  /** Anchor on the v2 canvas. */
  vx: number;
  vy: number;
  /** Radius of the zone's own ground. */
  r: number;
  floor: TileType;
  theme: WildTheme;
  /** Which gatherables it offers; the tier is chosen to match its band. */
  nodes: NodeKind[];
  /** The landmark at its centre. */
  landmark: { kind: "relic" | "ruin_prop" | "bone_cairn"; name: string; line: string };
}

/**
 * A zone's band. The zones span ~42 to ~96 v2 tiles from Ironvale — a wider
 * spread than the camps — so they get their own fit: the nearest is level 20,
 * the furthest 68. That puts the closest zone above the camp ring beside it,
 * which is the intent: a zone is a place you go to train, not a rest stop.
 */
export function zoneBand(vx: number, vy: number): number {
  return bandAt(vx, vy, 42, 96, 20, 68);
}

export const ZONES: ZoneDef[] = [
  {
    id: "zone_thornreach", name: "Thornreach", vx: 44, vy: 60, r: 9, floor: "moss", theme: "beast",
    blurb: "THORNREACH — a briar country nobody has cleared in living memory. The paths through it were made by animals, and they still belong to them.",
    nodes: ["tree", "forage_spot", "tree"],
    landmark: { kind: "bone_cairn", name: "Briar Cairn", line: "A cairn grown through with briar until the stones and the thorns are one thing. Somebody meant it to be found." },
  },
  {
    id: "zone_greyhollow", name: "The Grey Hollow", vx: 116, vy: 116, r: 9, floor: "dirt", theme: "outlaw",
    blurb: "THE GREY HOLLOW — a wide sunken bowl east of the roads. Whatever camps down here does not want to be seen from them.",
    nodes: ["rock", "forage_spot", "tree"],
    landmark: { kind: "ruin_prop", name: "The Hanging Post", line: "A single post at the bowl's lowest point, with old rope still knotted at the top. Nobody has cut it down." },
  },
  {
    id: "zone_stillwater", name: "Stillwater", vx: 144, vy: 78, r: 9, floor: "bog", theme: "drowned",
    blurb: "STILLWATER — flat water that never moves, however hard the wind blows across it. The fish here are worth having. So is your footing.",
    nodes: ["fishing_spot", "forage_spot", "fishing_spot"],
    landmark: { kind: "relic", name: "The Drowned Marker", line: "A boundary stone standing in two feet of water, its inscription just under the surface and quite legible." },
  },
  {
    id: "zone_emberwaste", name: "The Emberwaste", vx: 108, vy: 142, r: 9, floor: "ash", theme: "cult",
    blurb: "THE EMBERWASTE — ash to the horizon, warm underfoot. Things kneel out here, facing a fire that went out a long time ago.",
    nodes: ["rock", "forage_spot", "rock"],
    landmark: { kind: "ruin_prop", name: "The Cold Altar", line: "A slab of black stone, swept clean of ash by something that comes back to sweep it." },
  },
  {
    id: "zone_wolfmarch", name: "The Wolf March", vx: 144, vy: 52, r: 9, floor: "grass", theme: "beast",
    blurb: "THE WOLF MARCH — open running country in the north-east. You will hear them before you see them, and that is the only warning you get.",
    nodes: ["tree", "rock", "forage_spot"],
    landmark: { kind: "bone_cairn", name: "The Kill-Cairn", line: "A heap of bones the size of a cottage, stacked rather than scattered. Something here keeps a tally." },
  },
  {
    id: "zone_paleflats", name: "The Pale Flats", vx: 44, vy: 140, r: 9, floor: "sand", theme: "wild",
    blurb: "THE PALE FLATS — bleached ground in the deep south-west, and nothing growing on it. The things that live here did not come from here.",
    nodes: ["rock", "forage_spot", "rock"],
    landmark: { kind: "relic", name: "The White Stone", line: "A stone that is the wrong colour for this country, and the wrong shape for a stone." },
  },
  {
    id: "zone_sunkenwood", name: "The Sunken Wood", vx: 12, vy: 114, r: 9, floor: "bog", theme: "drowned",
    blurb: "THE SUNKEN WOOD — a forest the moor took, still standing in the water it drowned in. The trees are dead and have not fallen.",
    nodes: ["tree", "fishing_spot", "forage_spot"],
    landmark: { kind: "ruin_prop", name: "The Standing Trunk", line: "A dead trunk taller than the rest, cut with notches from the ground to well above head height. Somebody was counting something." },
  },
  {
    id: "zone_lastreach", name: "Lastreach", vx: 12, vy: 12, r: 9, floor: "stone", theme: "deep",
    blurb: "LASTREACH — the far north-west corner, where the maps stop bothering. Whatever holds this ground has held it a very long time.",
    nodes: ["rock", "rock", "forage_spot"],
    landmark: { kind: "relic", name: "The Last Marker", line: "A marker stone at the end of the world, facing outward. It was set to warn somebody, and not us." },
  },
];

/** A zone's cleared ground, in v2 coordinates (the map spreads it). */
export function zoneGround(z: ZoneDef): { vx: number; vy: number; r: number; floor: TileType } {
  return { vx: z.vx, vy: z.vy, r: z.r, floor: z.floor };
}

/**
 * Everything that stands in the zones. `transform` re-homes the zone's ANCHOR —
 * once, with the layout offsetting from it, for the same reason the towns and
 * the pier do it that way.
 */
export function buildZoneObjects(
  transform: (x: number, y: number) => { x: number; y: number },
  occupied: ReadonlySet<string> = new Set(),
): WorldObjectDef[] {
  const out: WorldObjectDef[] = [];
  const taken = new Set(occupied);
  const free = (x: number, y: number): { x: number; y: number } => {
    for (let rad = 0; rad <= 5; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          const k = `${x + dx},${y + dy}`;
          if (!taken.has(k)) { taken.add(k); return { x: x + dx, y: y + dy }; }
        }
      }
    }
    return { x, y };
  };

  for (const z of ZONES) {
    const c = transform(z.vx, z.vy);
    const band = zoneBand(z.vx, z.vy);

    // The landmark and its marker, at the heart.
    const lm = free(c.x, c.y);
    out.push({ id: `${z.id}_landmark`, kind: z.landmark.kind, x: lm.x, y: lm.y, name: z.landmark.name, lines: [z.landmark.line] });
    const sg = free(c.x + 2, c.y);
    out.push({ id: `${z.id}_sign`, kind: "signpost", x: sg.x, y: sg.y, name: z.name, lines: [z.blurb] });

    // A real population: twelve foes on two rings, so a zone is somewhere you
    // can train rather than a place with four things in it.
    const foes = foesFor(z.theme, band, 12);
    foes.forEach((m, i) => {
      const ring = i < 6 ? z.r - 4 : z.r - 1;
      const a = ((i % 6) / 6) * Math.PI * 2 + (i < 6 ? 0 : Math.PI / 6);
      const p = free(c.x + Math.round(Math.cos(a) * ring), c.y + Math.round(Math.sin(a) * ring));
      out.push({ id: `${z.id}_m${i}`, kind: "monster", monster: m, x: p.x, y: p.y, name: z.name });
    });

    // Six gatherables, two of each kind the zone offers.
    for (let i = 0; i < 6; i++) {
      const kind = z.nodes[i % z.nodes.length]!;
      const n = nodeFor(kind, band, i % 3);
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const p = free(c.x + Math.round(Math.cos(a) * (z.r - 2)), c.y + Math.round(Math.sin(a) * (z.r - 2)));
      const o: WorldObjectDef = { id: `${z.id}_n${i}`, kind, x: p.x, y: p.y, name: z.name, resource: n.resource };
      if (n.species) o.species = n.species;
      out.push(o);
    }
  }
  return out;
}
