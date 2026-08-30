/**
 * src/content/camps.ts
 * --------------------
 * The camps of the open country — DERIVED from one table.
 *
 * The Greater World expansion multiplied Varath's walkable area by ~6× without
 * adding a thing to walk to, which is a worse world, not a bigger one. The
 * distance between the city and a region is now a real journey; a journey needs
 * places along it.
 *
 * A camp is a small, complete place: cleared ground, a fire to cook at, a
 * signpost that names it, foes pitched at its own level band, and resources
 * worth stopping for. Fourteen of them sit in the country between Ironvale and
 * the six regions, and their level bands rise with distance from the gate — so
 * the open country reads as a difficulty gradient rather than undifferentiated
 * grass.
 *
 * Everything is generated from `CAMPS` rather than hand-placed: fourteen camps
 * of ~15 objects each is 200-odd spawns, and a hand-written list that long
 * rots — a monster id renamed in one place and nothing anywhere would say so.
 * `sims/world.ts` walks the result and `sims/camps.ts` checks the table itself.
 *
 * Anchors are in **v2 space** (the pre-expansion 160×164 canvas), so a camp
 * moves with the world through the same `spread()` every other landmark uses.
 * This file deliberately imports nothing from map.ts — the transform is passed
 * in — because map.ts carves the camp clearings and a cycle would be worse than
 * a parameter.
 *
 * RULE 3: pure data + a pure builder.
 */

import { bandAt, foesFor, nodeFor, type NodeKind, type WildTheme } from "./wildKit.ts";
import type { TileType, WorldObjectDef } from "../core/types.ts";

export interface CampDef {
  id: string;
  name: string;
  /** What the signpost says when you arrive. */
  blurb: string;
  /** Anchor on the v2 canvas (centre of the clearing). */
  vx: number;
  vy: number;
  /** The ground the camp is cleared to. */
  floor: TileType;
  /** Half-width / half-height of the cleared patch. */
  rx: number;
  ry: number;
  /** What kind of thing holds this place. The specific foes are chosen from
   *  the theme's pool to match the camp's DERIVED band — see campBand. */
  theme: WildTheme;
  /** Which KINDS of gatherable this place offers. Which tier of each is chosen
   *  to match the camp's band, the same way its foes are — a level-1 ashwood
   *  beside a level-60 foe is a node nobody would stop for. */
  nodes: NodeKind[];
  /** Scenery, purely to make the place read as somewhere people have been. */
  props?: { kind: "remains" | "ruin_prop" | "fence" | "cart" | "bone_cairn"; name: string; line?: string }[];
}

/**
 * A camp's band, from how far out it is. The curve is fitted to where the camps
 * actually are — the nearest ~22 v2 tiles out, the furthest ~70 — so the near
 * ring is level 12 and the far march ~62. Fitting it to 0..70 instead put a
 * level-26 camp an hour from the gate, which is not a camp a new player can use.
 */
export function campBand(vx: number, vy: number): number {
  return bandAt(vx, vy, 22, 70, 12, 62);
}

/**
 * The fourteen. Bands rise with distance from Ironvale: the ring closest to the
 * gate is levels 8–20 (somewhere a new player can reach and survive), the middle
 * ring 22–40, and the far country 45–60 — which is where the road to a region
 * stops being a walk and starts being a decision.
 */
export const CAMPS: CampDef[] = [
  // --- The near ring: within sight of the city's smoke ---------------------
  {
    id: "camp_kingspost", name: "The King's Post", vx: 95, vy: 60, floor: "dirt", rx: 4, ry: 3,
    blurb: "THE KING'S POST — a mustering ground from a war nobody living remembers. Ironvale's east gate is an hour behind you.",
    theme: "outlaw",
    nodes: ["tree", "tree", "forage_spot"],
    props: [{ kind: "remains", name: "Old Remains" }, { kind: "ruin_prop", name: "Toppled Post", line: "A squared oak post, deep in the turf, worn smooth where hands and rope have gripped it." }],
  },
  {
    id: "camp_greenditch", name: "Greenditch", vx: 15, vy: 55, floor: "dirt", rx: 4, ry: 3,
    blurb: "GREENDITCH — a drainage cut somebody once camped in. Whatever kept the ditch clear stopped a long time ago, and something else uses it now.",
    theme: "beast",
    nodes: ["tree", "forage_spot", "rock"],
    props: [{ kind: "fence", name: "Broken Hurdle" }, { kind: "cart", name: "Abandoned Handcart", line: "A two-wheeled cart, one shaft snapped. Somebody left in a hurry and never came back for it." }],
  },
  {
    id: "camp_woodmoor", name: "The Wood-Moor Verge", vx: 30, vy: 80, floor: "dirt", rx: 5, ry: 4,
    blurb: "THE WOOD-MOOR VERGE — where the forest gives up and the moor begins. Lodgehold lies west.",
    theme: "beast",
    nodes: ["tree", "tree", "forage_spot"],
    props: [{ kind: "remains", name: "Picked Bones" }],
  },
  {
    id: "camp_eastcommons", name: "The East Commons", vx: 110, vy: 96, floor: "grass", rx: 5, ry: 4,
    blurb: "THE EAST COMMONS — drovers' pasture. The Redrun road runs on east to Saltreach.",
    theme: "outlaw",
    nodes: ["forage_spot", "tree", "fishing_spot"],
    props: [{ kind: "fence", name: "Drover's Pen" }, { kind: "cart", name: "Drover's Wagon", line: "A long wagon with a canvas tilt, greyed by weather. It still smells faintly of sheep." }],
  },

  // --- The middle ring: past the last farm ---------------------------------
  {
    id: "camp_crossroads", name: "The Wayfarers' Crossroads", vx: 36, vy: 40, floor: "stone", rx: 5, ry: 4,
    blurb: "THE WAYFARERS' CROSSROADS — four roads and a fallen inn. The Spine is north-east, Greyoak south.",
    theme: "outlaw",
    nodes: ["rock", "tree", "forage_spot"],
    props: [{ kind: "ruin_prop", name: "Fallen Lintel", line: "A carved lintel face-down in the road, the inn's name worn past reading." }, { kind: "remains", name: "Old Remains" }],
  },
  {
    id: "camp_oldquarry", name: "The Old Quarry", vx: 112, vy: 46, floor: "stone", rx: 5, ry: 5,
    blurb: "THE OLD QUARRY — worked out and abandoned. The Marrow road climbs north-east from here.",
    theme: "wild",
    nodes: ["rock", "rock", "rock"],
    props: [{ kind: "ruin_prop", name: "Quarry Crane", line: "A timber crane, rotted through at the foot. It has been leaning for longer than it stood." }],
  },
  {
    id: "camp_northgate", name: "The Cold Gate", vx: 72, vy: 30, floor: "stone", rx: 4, ry: 3,
    blurb: "THE COLD GATE — the last shelter before the Spine road turns to ice.",
    theme: "beast",
    nodes: ["rock", "tree", "forage_spot"],
    props: [{ kind: "bone_cairn", name: "Wayside Cairn" }],
  },
  {
    id: "camp_orchard", name: "The Sour Orchard", vx: 100, vy: 28, floor: "grass", rx: 4, ry: 4,
    blurb: "THE SOUR ORCHARD — planted by somebody hopeful. Nothing here has been pruned in a lifetime.",
    theme: "wild",
    nodes: ["tree", "forage_spot", "tree"],
    props: [{ kind: "fence", name: "Orchard Wall" }, { kind: "remains", name: "Old Remains" }],
  },
  {
    id: "camp_riverwatch", name: "Riverwatch", vx: 125, vy: 70, floor: "dirt", rx: 4, ry: 4,
    blurb: "RIVERWATCH — a toll post on the Redrun's west bank, held now by whoever wants it.",
    theme: "outlaw",
    nodes: ["fishing_spot", "fishing_spot", "tree"],
    props: [{ kind: "ruin_prop", name: "Toll Chain Post", line: "An iron ring set in stone, the chain long gone. Somebody used to charge for this crossing." }],
  },
  {
    id: "camp_gallowsfield", name: "Gallowsfield", vx: 96, vy: 112, floor: "dirt", rx: 5, ry: 4,
    blurb: "GALLOWSFIELD — the old assize ground. The Ashfen road goes south-west from the crossbeam.",
    theme: "cult",
    nodes: ["forage_spot", "tree", "rock"],
    props: [{ kind: "ruin_prop", name: "The Crossbeam", line: "Two uprights and a beam, black with age. Nobody has cut it down, and nobody stands under it." }, { kind: "remains", name: "Picked Bones" }, { kind: "bone_cairn", name: "Unmarked Cairn" }],
  },

  // --- The far country: where the road becomes a decision ------------------
  {
    id: "camp_sunkenmile", name: "The Sunken Mile", vx: 36, vy: 104, floor: "bog", rx: 5, ry: 5,
    blurb: "THE SUNKEN MILE — a mile of road the moor swallowed. Mirehold is somewhere past it.",
    theme: "drowned",
    nodes: ["fishing_spot", "forage_spot", "tree"],
    props: [{ kind: "ruin_prop", name: "Milestone", line: "A milestone tilted to its shoulder in the peat. The number is still legible; the destination is not." }],
  },
  {
    id: "camp_ashroad", name: "The Ash Road Halt", vx: 88, vy: 125, floor: "dirt", rx: 4, ry: 4,
    blurb: "THE ASH ROAD HALT — the last hard ground before Emberhearth and the warm flats.",
    theme: "cult",
    nodes: ["rock", "forage_spot", "tree"],
    props: [{ kind: "remains", name: "Scorched Remains" }, { kind: "cart", name: "Burnt Wagon", line: "A wagon burnt to its iron. The axles are still true — whatever happened here was quick." }],
  },
  {
    id: "camp_hollowfen", name: "Hollowfen", vx: 55, vy: 120, floor: "bog", rx: 4, ry: 4,
    blurb: "HOLLOWFEN — standing water and standing stones. Both roads out of here go somewhere worse.",
    theme: "drowned",
    nodes: ["fishing_spot", "forage_spot", "tree"],
    props: [{ kind: "bone_cairn", name: "Fen Cairn" }, { kind: "ruin_prop", name: "Standing Stone", line: "A stone taller than a man, half-drowned. Something is cut into the underside, where nobody was meant to read it." }],
  },
  {
    id: "camp_westmarch", name: "The West March", vx: 18, vy: 95, floor: "moss", rx: 4, ry: 4,
    blurb: "THE WEST MARCH — the old border, kept by nobody for a hundred years.",
    theme: "deep",
    nodes: ["rock", "tree", "forage_spot"],
    props: [{ kind: "ruin_prop", name: "March Stone", line: "A boundary stone with two crests, both of houses that no longer exist." }, { kind: "remains", name: "Old Remains" }],
  },
];

/**
 * Build every camp's objects. `t` re-homes a v2 coordinate onto the live canvas
 * — passed in rather than imported so this file stays free of map.ts.
 *
 * The layout is deterministic: the fire sits at the anchor with the signpost
 * beside it, foes ring the camp at its edge, nodes sit just outside, and props
 * fill the corners. Deterministic matters — a camp that reshuffled between
 * boots would move a monster onto a tile the map carved as water.
 */
export function buildCampObjects(t: (x: number, y: number) => { x: number; y: number }): WorldObjectDef[] {
  const out: WorldObjectDef[] = [];
  for (const c of CAMPS) {
    const at = t(c.vx, c.vy);
    const push = (o: WorldObjectDef): void => { out.push(o); };
    push({ id: `${c.id}_fire`, kind: "fire", x: at.x, y: at.y, name: "Camp Fire" });
    push({
      id: `${c.id}_sign`, kind: "signpost", x: at.x + 1, y: at.y - 1,
      name: c.name, lines: [c.blurb],
    });
    // Foes on the ring, evenly spaced so they never stack. Which foes is the
    // theme's business; how dangerous they are is the geography's.
    const foes = foesFor(c.theme, campBand(c.vx, c.vy), 4);
    foes.forEach((m, i) => {
      const a = (i / foes.length) * Math.PI * 2;
      push({
        id: `${c.id}_m${i}`, kind: "monster", monster: m,
        x: at.x + Math.round(Math.cos(a) * c.rx), y: at.y + Math.round(Math.sin(a) * c.ry),
        name: c.name,
      });
    });
    // Gatherables just outside the ring, on the opposite arc from the foes.
    const band = campBand(c.vx, c.vy);
    c.nodes.forEach((kind, i) => {
      const a = (i / c.nodes.length) * Math.PI * 2 + Math.PI / c.nodes.length;
      const n = nodeFor(kind, band, i);
      const o: WorldObjectDef = {
        id: `${c.id}_n${i}`, kind,
        x: at.x + Math.round(Math.cos(a) * (c.rx + 2)), y: at.y + Math.round(Math.sin(a) * (c.ry + 2)),
        name: c.name, resource: n.resource,
      };
      if (n.species) o.species = n.species;
      push(o);
    });
    (c.props ?? []).forEach((p, i) => {
      const o: WorldObjectDef = {
        id: `${c.id}_p${i}`, kind: p.kind,
        x: at.x - c.rx + i * 2, y: at.y + c.ry,
        name: p.name,
      };
      if (p.line) o.lines = [p.line];
      if (p.kind === "remains") o.variant = "bones";
      if (p.kind === "fence") o.species = "h";
      push(o);
    });
  }
  return out;
}
