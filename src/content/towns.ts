/**
 * src/content/towns.ts
 * --------------------
 * The six region seats, as towns — DERIVED from one table.
 *
 * Each was a 9×9 clearing with two cottages, a trader and a fire: a hamlet you
 * pass through, not a place you arrive at. On the Greater World a region is an
 * hour's walk from Ironvale, and a walk that long has to end somewhere worth
 * reaching — somewhere you can bank, restock, use a station and turn around.
 *
 * So each seat grows to a 17×13 clearing with a street: three buildings along
 * the north side and three along the south, doors facing a central lane, with
 * the bank, the trade counter and the town's own working station set along it.
 * The existing fire, waystone, trader and banner stay exactly where they are —
 * the lane is deliberately left clear through the middle so nothing already
 * standing there is built over.
 *
 * Layout is generated rather than hand-placed for the same reason the camps are:
 * six towns of ~20 objects and 6 buildings each is 150-odd placements, and a
 * hand-written list that long drifts silently. What each town IS — its trade,
 * its station, its folk — is the table's business; where the walls go is the
 * generator's.
 *
 * Anchors are in **v2 space** so a town moves with the world through the same
 * transform every other landmark uses. Like camps.ts this file imports nothing
 * from map.ts (the transform is passed in), because map.ts carves the clearings
 * and the walls.
 *
 * RULE 3: pure data + pure builders.
 */

import type { TileType, WorldObjectDef } from "../core/types.ts";

/** A working station a town can offer, by object kind. */
export type TownStation =
  | "bank" | "furnace" | "anvil" | "cauldron" | "workbench" | "sawmill" | "crafting_table";

const STATION_NAME: Record<TownStation, string> = {
  bank: "Bank Chest",
  furnace: "Furnace",
  anvil: "Anvil",
  cauldron: "Herbalist's Cauldron",
  workbench: "Builder's Workbench",
  sawmill: "Carpenter's Sawmill",
  crafting_table: "Artisan's Table",
};

export interface TownDef {
  id: string;
  name: string;
  /** Architecture palette key — the renderer colours the whole town by it. */
  palette: string;
  /** Centre of the town, on the v2 canvas. */
  vx: number;
  vy: number;
  /** Ground the town is cleared to. */
  floor: TileType;
  /** What this town offers, beyond what already stands there. A bank is listed
   *  like any other station — and deliberately omitted where the seat already
   *  keeps one, since the generator cannot see the hand-authored spawns and
   *  would otherwise set a second chest three tiles from the first. */
  stations: TownStation[];
  /** Townsfolk, beyond the trader and questfolk already spawned here. */
  folk: { name: string; lines: string[] }[];
  /** What the town's own signpost says. */
  blurb: string;
}

/** Half-width and half-height of a town's cleared ground. */
export const TOWN_RX = 9;
/** Deliberately generous. Each seat already had a populated 9x9 core — trader,
 *  waystone, fire, banner, guard, questfolk — and a street laid across it walls
 *  those in: an earlier, tighter layout sealed Frostgate's signpost, Mirehold's
 *  Calder and the Deeps guard inside cottages. The buildings sit in the ring
 *  OUTSIDE that core, so the generator cannot reach anything that was there. */
export const TOWN_RY = 9;

export const TOWNS: TownDef[] = [
  {
    id: "frostgate", name: "Frostgate", palette: "frostgate", vx: 50, vy: 18,
    floor: "stone",
    stations: ["bank", "furnace", "anvil"],
    blurb: "FROSTGATE — the last roof before the pass. Ore comes down; not everyone who goes up comes back.",
    folk: [
      { name: "Ganna, a Pass-Wife", lines: ["Bank's inside, forge is out back. Do your business and get in out of the wind.", "Three parties went up this month. Two came down. That's a good month."] },
      { name: "Odd, a Gate-Watch", lines: ["I count them up and I count them down. That's the whole job, and it's harder than it sounds."] },
    ],
  },
  {
    id: "deeplight", name: "Deeplight", palette: "deeplight", vx: 125, vy: 25,
    floor: "cave",
    // No bank listed: Deeplight already keeps one (kd_bank).
    stations: ["furnace", "anvil", "workbench"],
    blurb: "DEEPLIGHT — a delvers' outpost in the cave mouth. Everything here is lit, and everything here is temporary.",
    folk: [
      { name: "Brill, a Shift-Captain", lines: ["Lamps stay lit, ropes stay checked, and nobody goes below alone. Those are the rules and they're written in people.", "Smelt what you cut here — carrying raw ore back up is a fool's tax on your own legs."] },
      { name: "Tace, a Lamp-Keeper", lines: ["Oil, wick, glass. Simple work. The deep doesn't forgive simple work done badly."] },
    ],
  },
  {
    id: "saltreach", name: "Saltreach", palette: "saltreach", vx: 146, vy: 105,
    floor: "sand",
    stations: ["bank", "cauldron", "crafting_table"],
    blurb: "SALTREACH — driftwood and salt on the tide-line. The boats go out at dark and come back at dark.",
    folk: [
      { name: "Wenna, a Net-Mender", lines: ["Everything in this town is made of something the sea gave back. Including most of the people.", "Bank's up the strand. Put your catch-money somewhere the tide can't reach it."] },
      { name: "Orrick, a Boat-Hand", lines: ["Tide's the only clock that matters here. Miss it and you've missed the day."] },
    ],
  },
  {
    id: "emberhearth", name: "Emberhearth", palette: "emberhearth", vx: 77, vy: 141,
    floor: "ash",
    stations: ["bank", "furnace", "anvil", "cauldron"],
    blurb: "EMBERHEARTH — built on ground that has never gone cold. They say the fire under it is older than the town.",
    folk: [
      { name: "Sela, an Ash-Warden", lines: ["Ground's warm all year. Good for the forge, bad for the dead — we cairn them on the cold side.", "Whatever you're smelting, it'll go faster here. That's the one gift this place gives."] },
      { name: "Haldric, a Flats-Runner", lines: ["Don't sleep on bare ash. Learned that the hard way, and so will you."] },
    ],
  },
  {
    id: "mirehold", name: "Mirehold", palette: "mirehold", vx: 15, vy: 139,
    floor: "dirt",
    // No bank listed: Mirehold already keeps one (bank_heartmoor).
    stations: ["cauldron", "crafting_table"],
    blurb: "MIREHOLD — a hamlet on the only dry ground for a mile. Stay on the boards.",
    folk: [
      { name: "Bryn, a Boardwalk-Keeper", lines: ["Stay on the boards. I'll say it once more before you go and once more when they carry you back.", "Everything the moor takes, it keeps. Everything it gives back, you should probably leave alone."] },
      { name: "Nessa, a Herb-Wife", lines: ["The moor grows things that cure and things that kill, and mostly they look the same. Come to the cauldron before you guess."] },
    ],
  },
  {
    id: "lodgehold", name: "Lodgehold", palette: "lodgehold", vx: 13, vy: 81,
    floor: "dirt",
    // No sawmill listed: the yard already has one.
    stations: ["bank", "workbench", "crafting_table"],
    blurb: "LODGEHOLD — the foresters' steading. Greyoak's whole trade passes through this yard.",
    folk: [
      { name: "Corvin, a Yard-Master", lines: ["Timber in, planks out, and everyone paid before dark. That's a good day at Lodgehold.", "Mill's yours to use. Mind the blade and don't leave your offcuts in my yard."] },
      { name: "Ilsa, a Tally-Clerk", lines: ["Every stick that leaves this yard is written down. Every one. It's not distrust, it's bookkeeping."] },
    ],
  },
];

/**
 * A town's cleared rectangle, on the live canvas.
 *
 * The town's ANCHOR is transformed once and everything is laid out by offset
 * from it. Transforming each corner separately is how the Deeplight signpost
 * ended up 21 tiles outside its own town: a town straddles the edge of its
 * region's box, so its west approach fell outside and took a different branch
 * of `fromV2` than its centre did. Same lesson as the pier deck.
 */
export function townClearing(
  t: TownDef,
  transform: (x: number, y: number) => { x: number; y: number },
): { x0: number; y0: number; x1: number; y1: number; floor: TileType } {
  const o = transform(t.vx, t.vy);
  return { x0: o.x - TOWN_RX, y0: o.y - TOWN_RY, x1: o.x + TOWN_RX, y1: o.y + TOWN_RY, floor: t.floor };
}

/**
 * A town's own objects: its stations and its folk, set along the lane.
 * `t` re-homes a v2 coordinate onto the live canvas.
 */
/**
 * Ids are prefixed `seat_`, not `town_`: seven hand-authored NPCs already use
 * `town_` (town_crier, town_guard, town_child…), and a prefix that means two
 * things is a filter waiting to be written wrong — as it immediately was.
 */
export function buildTownObjects(
  transform: (x: number, y: number) => { x: number; y: number },
  /** Tiles already taken by hand-authored spawns, as "x,y". A seat is a busy
   *  place and the table cannot see it: without this, Emberhearth's herb-wife
   *  was placed on top of a dead snag and Lodgehold's workbench inside a pine. */
  occupied: ReadonlySet<string> = new Set(),
): WorldObjectDef[] {
  const out: WorldObjectDef[] = [];
  const taken = new Set(occupied);
  /** The nearest free tile to (x,y), searched outward. Deterministic. */
  const free = (x: number, y: number): { x: number; y: number } => {
    for (let r = 0; r <= 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const k = `${x + dx},${y + dy}`;
          if (!taken.has(k)) { taken.add(k); return { x: x + dx, y: y + dy }; }
        }
      }
    }
    return { x, y };
  };
  for (const town of TOWNS) {
    const c = transform(town.vx, town.vy);
    // Stations run along the north edge of the lane, left to right.
    town.stations.forEach((kind, i) => {
      const p = free(c.x - TOWN_RX + 2 + i * 3, c.y - 5);
      out.push({ id: `seat_${town.id}_${kind}`, kind, x: p.x, y: p.y, name: STATION_NAME[kind] });
    });
    // Folk stand on the south edge, facing them across the lane.
    town.folk.forEach((f, i) => {
      const p = free(c.x - TOWN_RX + 3 + i * 5, c.y + 5);
      out.push({ id: `seat_${town.id}_folk${i}`, kind: "npc", x: p.x, y: p.y, name: f.name, lines: f.lines });
    });
    // A signpost at the town's west approach, on the lane itself.
    const sp = free(c.x - TOWN_RX, c.y);
    out.push({ id: `seat_${town.id}_sign`, kind: "signpost", x: sp.x, y: sp.y, name: town.name, lines: [town.blurb] });
  }
  return out;
}
