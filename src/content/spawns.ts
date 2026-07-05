/**
 * src/content/spawns.ts
 * ---------------------
 * Where every interactive object sits in the world. Pure DATA.
 *
 * Ironvale stands at the CENTRE of the map: a walled city with a civic yard to
 * the west (bank, forge, stations) and a market street to the east (shop stalls
 * with their keepers beside them). The home Knuckle Hills wrap the city — a
 * grove, a rock outcrop, a lake and Aldric's farmstead. The six wilderness
 * regions ring the city and keep the exact internal layout they always had;
 * their coordinates here were translated as whole blocks to their new homes
 * (see REGION_OFFSET in map.ts), so every node sits on the same terrain as before.
 */

import type { WorldObjectDef } from "../core/types.ts";
import { HOMES, BACKYARDS, DUNGEONS, homeLayout, remap, map, CITY, PIER } from "./map.ts";

const SCATTER_BLOCKED = new Set(["water", "mountain", "cave_wall", "deep", "wall", "plank"]);
function tileWalkable(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height &&
    !SCATTER_BLOCKED.has(map.tiles[y * map.width + x] as string);
}
/** Break the grid look of the open-country fill nodes: jitter each `fz*` spawn
 *  by a deterministic per-id offset, snapped to the nearest walkable tile so it
 *  never lands on water/rock/structure. Leaves deliberately-placed spawns alone. */
function scatterFill(o: WorldObjectDef): WorldObjectDef {
  if (!o.id.startsWith("fz")) return o;
  let h = 0;
  for (let i = 0; i < o.id.length; i++) h = (h * 31 + o.id.charCodeAt(i)) >>> 0;
  const jx = (h % 11) - 5;            // -5..5
  const jy = (Math.floor(h / 11) % 11) - 5;
  let nx = o.x + jx, ny = o.y + jy;
  if (!tileWalkable(nx, ny)) {
    let found = false;
    for (let r = 1; r <= 5 && !found; r++) {
      for (let ax = -r; ax <= r && !found; ax++) for (let ay = -r; ay <= r && !found; ay++) {
        if (tileWalkable(nx + ax, ny + ay)) { nx += ax; ny += ay; found = true; }
      }
    }
    if (!found) { nx = o.x; ny = o.y; }
  }
  return { ...o, x: nx, y: ny };
}

function isWater(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const t = map.tiles[y * map.width + x] as string;
  return t === "water" || t === "deep";
}
function isPath(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return map.tiles[y * map.width + x] === "path";
}
/** Natural resources and props that look wrong embedded in a paved road, so they
 *  get nudged off it — ore rocks, trees, campfires, forage/herb patches, bone
 *  cairns and traps. (Carts, lampposts, signposts, NPCs and wandering monsters
 *  legitimately sit on or travel the roads, so they're left alone.) */
const OFF_ROAD_KINDS = new Set([
  "rock", "tree", "fire", "forage_spot", "plant_patch", "tree_patch", "bone_cairn", "trap",
]);
/** Nearest tile matching `pred` within `max` rings, or null. */
function nearestMatch(x: number, y: number, max: number, pred: (x: number, y: number) => boolean): { x: number; y: number } | null {
  if (pred(x, y)) return { x, y };
  for (let r = 1; r <= max; r++) {
    for (let ax = -r; ax <= r; ax++) for (let ay = -r; ay <= r; ay++) {
      if (Math.max(Math.abs(ax), Math.abs(ay)) !== r) continue;
      if (pred(x + ax, y + ay)) return { x: x + ax, y: y + ay };
    }
  }
  return null;
}
/** Catch-all keeping every spawn on the terrain it needs after the coastline and
 *  cross-map Redrun were carved: fishing spots snap to the nearest WATER, all
 *  other spawns snap off water/rock/wall to the nearest walkable LAND. The hidden
 *  bands (arenas / home interiors) are left untouched. */
function snapSpawn(o: WorldObjectDef): WorldObjectDef {
  if (o.y >= map.height - 30) return o; // arena/interior band
  // Housing pieces are constructed onto exact carved tiles: doors on doorway
  // gaps, seals in wall openings, footings on room floors. Plank floors count
  // as "blocked" to the scatter logic, so snapping would rip the Door Out off
  // its doorway — and once the Act II dungeon band carved walkable cave below
  // the home interiors, it teleported exit doors into the Barrows, sealing
  // players inside their own homes. Never move a housing object.
  if (o.kind === "house_door" || o.kind === "room_seal" || o.kind === "build_hotspot" || o.kind === "housing_plot") return o;
  // The Drowned Pier is hand-placed on exact tiles (the cast point deliberately
  // sits on open deep water, the gate on a plank neck) — leave it where it is.
  if (o.kind === "pier_spot" || o.kind === "record_board" || o.kind === "pier_gate") return o;
  // Boats are hand-moored: on the water at a jetty, or hauled out on the strand.
  if (o.kind === "boat") return o;
  if (o.kind === "fishing_spot") {
    // A spot is only usable if the player can stand beside it — water in the dead
    // centre of a pond is unreachable, so it reads as a "broken" fishing spot.
    // Snap to the nearest SHORE tile (water with a walkable land neighbour);
    // only fall back to open water if no shore is anywhere close.
    const shore = (x: number, y: number) =>
      isWater(x, y) &&
      (tileWalkable(x, y - 1) || tileWalkable(x, y + 1) ||
        tileWalkable(x - 1, y) || tileWalkable(x + 1, y));
    if (shore(o.x, o.y)) return o;
    const p = nearestMatch(o.x, o.y, 28, shore) ?? nearestMatch(o.x, o.y, 28, isWater);
    return p ? { ...o, x: p.x, y: p.y } : o;
  }
  // Banks need elbow room: a chest wedged into a one-tile gap can be sealed off
  // by a wandering NPC, soft-locking the player. Require at least 3 of 4
  // orthogonal neighbours walkable, nudging to the nearest such tile.
  if (o.kind === "bank") {
    const openSides = (x: number, y: number) =>
      (tileWalkable(x, y - 1) ? 1 : 0) + (tileWalkable(x, y + 1) ? 1 : 0) +
      (tileWalkable(x - 1, y) ? 1 : 0) + (tileWalkable(x + 1, y) ? 1 : 0);
    const clear = (x: number, y: number) => tileWalkable(x, y) && openSides(x, y) >= 3;
    if (clear(o.x, o.y)) return o;
    const p = nearestMatch(o.x, o.y, 8, clear)
      ?? (tileWalkable(o.x, o.y) ? { x: o.x, y: o.y } : nearestMatch(o.x, o.y, 20, tileWalkable));
    return p ? { ...o, x: p.x, y: p.y } : o;
  }
  // Resources/props must sit on walkable, NON-road ground that ISN'T inside the
  // Ironvale walls — no ore in the middle of a road, no campfire on the highway,
  // no mining seam in the middle of the paved city. The city's own designed
  // stations are exempt: the market cooking fire belongs where it stands.
  if (o.id === "fire_1") return o;
  if (OFF_ROAD_KINDS.has(o.kind)) {
    const inCity = (x: number, y: number) =>
      x >= CITY.x0 && x <= CITY.x1 && y >= CITY.y0 && y <= CITY.y1;
    const ok = (x: number, y: number) => tileWalkable(x, y) && !isPath(x, y) && !inCity(x, y);
    if (ok(o.x, o.y)) return o;
    const p = nearestMatch(o.x, o.y, 24, ok);
    return p ? { ...o, x: p.x, y: p.y } : o;
  }
  if (tileWalkable(o.x, o.y)) return o;
  const p = nearestMatch(o.x, o.y, 20, tileWalkable);
  return p ? { ...o, x: p.x, y: p.y } : o;
}

/** A few spawns sit where the legacy region bounding-boxes overlap the central
 *  Knuckle Hills, so remap() lands them on region rock/cave terrain that the
 *  doubled map paints there. These overrides nudge that handful onto the nearest
 *  walkable tile (computed against the new map). Keyed by object id. */
const SPAWN_FIXUP: Record<string, { x: number; y: number }> = {
  rock_7: { x: 52, y: 27 },
  rock_8: { x: 120, y: 31 },
  rock_10: { x: 53, y: 34 },
  spine_vault: { x: 62, y: 34 },
  md_golem_1: { x: 132, y: 37 },
  md_rock_2: { x: 131, y: 31 },
  trail_bone_1: { x: 52, y: 35 },
  trail_bone_5: { x: 61, y: 109 },
  cr_sheep1: { x: 58, y: 36 },
  out_cutthroat_hollow_2: { x: 53, y: 103 },
  // Push the Redrun estuary's heavy hitters out of the Drowned Pier's fishing
  // loop (ashfin shoals ~135–137,117–122; warden 146,118). With wander radius 2
  // and aggro 1.5, ~9 tiles of clearance means neither can ever reach a fisher —
  // the pier stays a calm spot, the wild country around it stays wild. (The lvl
  // 22 Forest Bear nearby is harmless at that range, and is a scatter-POI the
  // fixup table doesn't reach, so it's left where it is.)
  // Hamlet farming plots — final tiles (grass, off-road, near the settlements).
  patch_redmouth_1: { x: 87, y: 55 }, treepatch_redmouth: { x: 92, y: 55 },
  patch_drover_1: { x: 62, y: 69 }, treepatch_drover: { x: 62, y: 71 },
  rd_orc_1: { x: 128, y: 126 },      // Ancient Orc (lvl 94) → SW wilds
  // The Redrun waystone lands you at 135,112, right on the Saltreach village.
  // These foes used to sit on top of that tile and jump you the instant you
  // teleport in — move them well clear, north and east of the village, so you
  // arrive safe and have to walk out to the wild country to find a fight.
  rd_brigand_1: { x: 149, y: 97 },   // Redrun Brigand → NE of the village
  rd_serpent_1: { x: 147, y: 96 },   // River Serpent (lvl 86) → NE
  out_smugglers_landing_0: { x: 151, y: 96 }, // outlaw archers + marauder → NE
  out_smugglers_landing_1: { x: 153, y: 97 },
  out_smugglers_landing_2: { x: 150, y: 99 },
  // Enterable civic buildings (map.ts ENTERABLE): the stations live on the
  // interior floor of their room, entered through an open doorway. Pinned to
  // final canvas tiles inside each footprint.
  //   The Ashforge (x69-73,y69-72): furnace + anvil + Vorn.
  furnace_1: { x: 70, y: 70 }, anvil_1: { x: 72, y: 70 }, vorn: { x: 71, y: 71 },
  //   The Varath Vault (x74-78,y69-72): the bank chest.
  bank_1: { x: 76, y: 71 },
  //   The Craftworks (x69-77,y73-76): the maker's benches.
  workbench_1: { x: 71, y: 74 }, crafting_1: { x: 73, y: 74 }, sawmill_1: { x: 75, y: 74 },
  // The Knuckle field farmer (lvl 18) remapped onto (47,44) — ~5 tiles from the
  // tutorial spawn AND stacked on a Gallows Oak footpad. Push it east onto open
  // ground so the opening clearing stays calm and no two foes share a tile.
  farmer_knuckle: { x: 51, y: 47 },
  // The Redmouth waterfront (jetty, boat, Warin, Mourne) sits where the legacy
  // redrun bounding-box overlaps the hamlet's riverbank — pinned to final tiles.
  redmouth_warin: { x: 110, y: 87 },
  boat_redmouth: { x: 115, y: 86 },
  fish_redmouth_2: { x: 115, y: 88 },
  mourne: { x: 112, y: 88 },
  // Settlement clearance: aggressive monsters that spawned right at a town's
  // doorstep (waystone / shop / bank) would lock a player into a fight while
  // they shopped or fast-travelled — you shouldn't meet a wolf or a wraith two
  // tiles outside a settlement. Each is pushed ~10–13 tiles out onto walkable
  // ground, into the wild where a fight is a choice. (Guards stay — they're the
  // settlement's own defenders — and the far outlaw camps stay: the roads are
  // meant to have danger, just not at the gates.)
  cultist_ash_3: { x: 80, y: 154 },
  cultist_ash_4: { x: 86, y: 151 },
  cultist_heart_2: { x: 23, y: 148 },
  gw_boar_1: { x: 5, y: 72 },
  gw_boar_2: { x: 25, y: 73 },
  gw_boar_3: { x: 5, y: 90 },
  gw_greymane: { x: 18, y: 95 },
  sp_wolf_1: { x: 64, y: 16 },
  sp_wolf_2: { x: 62, y: 16 },
  sp_crawler_1: { x: 57, y: 28 },
  hm_serpent_1: { x: 25, y: 133 },
  md_crawler_1: { x: 118, y: 12 },
  md_crawler_2: { x: 140, y: 17 },
  md_wraith_1: { x: 123, y: 37 },
  out_burnt_waystation_2: { x: 104, y: 74 },
  // De-stack: farmer_drover shared a tile with a Cutpurse Steps footpad.
  farmer_drover: { x: 82, y: 98 },
};

/** Re-home a legacy-coordinate object (and its teleport target) onto the new,
 *  doubled canvas. Applied to every hand-authored spawn so they land on the
 *  same terrain the map's remap() shifted that terrain to. */
function remapObject(o: WorldObjectDef): WorldObjectDef {
  // The Varathian Trail rings the whole outskirts, crossing every region — its
  // checkpoints (and the Trailkeeper) are authored directly in final map
  // coordinates, so they skip the per-region remap entirely.
  if (o.id.startsWith("trail_")) return { ...o };
  const p = SPAWN_FIXUP[o.id] ?? remap(o.x, o.y);
  const out: WorldObjectDef = { ...o, x: p.x, y: p.y };
  if (o.target) out.target = remap(o.target.x, o.target.y);   // portal/door teleport tile
  if (o.exit) out.exit = remap(o.exit.x, o.exit.y);           // agility obstacle far side
  if (o.patrol) out.patrol = o.patrol.map((p) => remap(p.x, p.y)); // world-boss patrol stops
  return out;
}

// OSRS-style mixed fishing spots: each catch rolls one fish (weighted) from the
// pool that you meet the level for. River = the early waters around Ironvale.
const POOL_RIVER = [
  { action: "fish_ashfin", weight: 10 },     // lvl 1
  { action: "fish_silverdart", weight: 7 },  // lvl 8
  { action: "fish_greyfin", weight: 4 },     // lvl 20
  { action: "fish_bristlepike", weight: 2 }, // lvl 38
];

// The moor ponds: a still-water pool of carp, eels and dark shad.
const POOL_MOOR = [
  { action: "fish_bramblecarp", weight: 8 }, // lvl 15
  { action: "fish_marsh_eel", weight: 5 },   // lvl 45
  { action: "fish_gloomshad", weight: 3 },   // lvl 52
];

// The open coast: schools of copperling up through the runed deep-body stout.
const POOL_COAST = [
  { action: "fish_copperling", weight: 8 }, // lvl 25
  { action: "fish_ribperch", weight: 6 },   // lvl 30
  { action: "fish_redgill", weight: 4 },    // lvl 60
  { action: "fish_runestout", weight: 2 },  // lvl 68
];

// The Eyeless deep: armoured deepscale, cold frostgill, and the ancient pike.
const POOL_DEEP = [
  { action: "fish_deepscale", weight: 6 },     // lvl 75
  { action: "fish_frostgill", weight: 3 },     // lvl 82
  { action: "fish_eyeless_pike", weight: 1 },  // lvl 90
];

/**
 * Every player home's objects, generated from the shared floorplan in map.ts:
 * the lot's claim marker + entry door, the interior exit door, the sealed
 * workshop-wing doorway, and one build footing per room slot. Keeping this in
 * code (not hand-listed) guarantees the objects sit exactly on the carved tiles.
 */
const HOME_NAMES: Record<string, string> = {
  home_redmouth: "the Redmouth", home_drover: "the Drover's Rest", home_fold: "the Fold",
};
function cap(s: string): string { return s[0]!.toUpperCase() + s.slice(1); }
function buildHousing(): WorldObjectDef[] {
  const out: WorldObjectDef[] = [];
  for (const h of HOMES) {
    const plan = homeLayout(h.ox);
    const suffix = h.plot.replace("home_", "");
    const name = HOME_NAMES[h.plot] ?? "your";
    out.push(
      { id: h.plot, kind: "housing_plot", x: h.lot.marker.x, y: h.lot.marker.y, name: `${name} Homestead`, target: plan.entry },
      { id: `door_${suffix}`, kind: "house_door", x: h.lot.door.x, y: h.lot.door.y, name: `${name} Home`, plot: h.plot, target: plan.entry, lines: ["You step inside your home."] },
      { id: `exit_${suffix}`, kind: "house_door", x: plan.exitDoor.x, y: plan.exitDoor.y, name: "the Door Out", target: h.lot.exit, lines: ["You step back out onto the lot."] },
    );
    // Tiered room seals: each doorway that opens as the house is upgraded.
    for (const s of plan.seals) {
      out.push({
        id: `seal_${suffix}_${s.room}`, kind: "room_seal", x: s.x, y: s.y,
        name: `Unfinished Wall (${cap(s.room)})`, plot: h.plot, tier: s.tier,
      });
    }
    // The backyard pet paddock: a Garden Door in the living room (Manor+), and
    // the return gate out in the yard.
    const yard = BACKYARDS.find((b) => b.plot === h.plot);
    if (yard) {
      out.push(
        { id: `bdoor_${suffix}`, kind: "house_door", x: yard.homeDoor.x, y: yard.homeDoor.y, name: "the Garden Door", plot: h.plot, tier: 2, target: yard.entry, lines: ["You step out into your garden."] },
        { id: `bgate_${suffix}`, kind: "house_door", x: yard.gate.x, y: yard.gate.y, name: "the Back Door", target: yard.homeDoor, lines: ["You step back inside."] },
      );
    }
    for (const f of plan.footings) {
      out.push({
        id: `hs_${suffix}_${f.category}_${f.room}`, kind: "build_hotspot",
        x: f.x, y: f.y, name: `${cap(f.category)} Space`, category: f.category, plot: h.plot,
      });
    }
  }
  return out;
}

/** A rectangular post-and-rail pen: fence segments around (x0,y0)–(x1,y1)
 *  inclusive, skipping the listed gate tiles. `species` carries the rail run
 *  ("h" along the top/bottom, "v" down the sides) for the renderer. */
function makePen(prefix: string, x0: number, y0: number, x1: number, y1: number, gates: [number, number][], examine: string): WorldObjectDef[] {
  const out: WorldObjectDef[] = [];
  const gate = new Set(gates.map(([gx, gy]) => `${gx},${gy}`));
  let n = 0;
  const add = (x: number, y: number, run: "h" | "v") => {
    if (gate.has(`${x},${y}`)) return;
    out.push({ id: `${prefix}_${n++}`, kind: "fence", x, y, name: "Fence", species: run, lines: [examine] });
  };
  for (let x = x0; x <= x1; x++) { add(x, y0, "h"); add(x, y1, "h"); }
  for (let y = y0 + 1; y <= y1 - 1; y++) { add(x0, y, "v"); add(x1, y, "v"); }
  return out;
}

const rawObjects: WorldObjectDef[] = [
  // === IRONVALE — the central city =========================================

  // --- Civic yard (north-west): every station stands at the door of the house
  //     that runs it — the forge pair flanks the Ashforge's threshold, the bank
  //     chest faces the Vault's door across the north lane — so the quarter
  //     reads as workplaces, not loose furniture in a plaza. ---
  { id: "furnace_1", kind: "furnace", x: 46, y: 43, name: "Furnace" },
  { id: "anvil_1", kind: "anvil", x: 47, y: 43, name: "Anvil" },
  { id: "bank_1", kind: "bank", x: 53, y: 43, name: "Bank Chest" },
  // The cooking fire burns beside Brenna's cook-stall in the market (65,48);
  // the cauldron beside Wenna's herb stall (70,48); the maker's benches stand
  // on the artisans' row before the Craftworks (see the trade-row block below).
  { id: "fire_1", kind: "fire", x: 65, y: 48, name: "Cooking Fire" },
  { id: "cauldron_1", kind: "cauldron", x: 70, y: 48, name: "Herbalist's Cauldron" },
  { id: "workbench_1", kind: "workbench", x: 49, y: 62, name: "Builder's Workbench" },
  { id: "crafting_1", kind: "crafting_table", x: 51, y: 62, name: "Artisan's Table" },

  // --- Civic NPCs (the forge & archive folk) ---
  {
    id: "vorn", kind: "npc", x: 45, y: 43, name: "Vorn",
    lines: [
      "Hot work, smith. Mind the slag and we'll get along.",
      "The Ashforge Brotherhood doesn't recruit. We warn a man what the hammer costs, and then we wait to see if he picks it up anyway.",
      "Teach yourself on cold ash and guesswork long enough and the metal starts telling you things. Stay, and I'll tell you the rest.",
    ],
    reactiveLines: [
      // The Four Positions — Vorn speaks his stance while that quest is live.
      { requiresFlags: ["act3_staged"], blockedByFlags: ["act3_finale_ready"], lines: [
        "So it comes to this, and they've sent you round to hear us all out. Fine. Here's mine, no dressing.",
        "That thing is a question with no clean end, and a question like that eats a kingdom alive. Destroy it. Put it in the deepest fire and let the fire decide, the way we settle everything worth settling. Seal it and someone digs it up. Study it and someone believes it. Burn it and it's DONE. That's not cruelty — that's mercy, the only kind that lasts.",
      ] },
      { requiresFlags: ["endgame_shard_destroyed"], lines: [
        "You burned it in the deepest fire. The only clean answer to a question that was never going to have one.",
        "Good. Some things you don't seal, and you don't study, and you don't pray to. You put them in the forge and you let the forge decide. Brotherhood's proud of you — I'm proud of you.",
      ] },
      { requiresFlags: ["act2_berric_dealt_with"], lines: [
        "Berric's answered for and the seam's ours again. You did that. The house knows it — even the ones too proud to say it to your face.",
        "Whatever rank you carry now, you carry it honest. That's the only kind the fire respects.",
      ] },
      { requiresFlags: ["guild_ashforge_rank_2"], lines: [
        "Rank Two, and still turning up to sweat. Good. The fire doesn't care what rank you are — only whether you keep feeding it.",
      ] },
      { requiresFlags: ["guild_ashforge_joined"], lines: [
        "You picked the hammer up knowing the cost. That's all the Brotherhood ever asks. The rest is just work — and there's always work.",
      ] },
    ],
  },
  {
    id: "sera", kind: "npc", x: 49, y: 46, name: "Sera",
    lines: [
      "Careful with the dust — half of it is older than the kingdom.",
      "The Pale Record keeps what the world would rather forget. The Underloft. The warm stone they buried their dead with. The coins that keep surfacing.",
      "Bring me a thing with a question on it and I'll give it a home instead of a shelf over a hearth.",
    ],
    reactiveLines: [
      // The Four Positions — Sera speaks her stance while that quest is live.
      { requiresFlags: ["act3_staged"], blockedByFlags: ["act3_finale_ready"], lines: [
        "You've come to hear the Record's position before you decide. I'll give it to you plainly, though it's the least satisfying of the four.",
        "Don't destroy it — you'd be burning a page no one has read. Don't complete the rite — you'd be answering a question we don't understand well enough to ask. Seal it. Ward it. Let it stay unread, and unresolved, in a vault where the next hundred generations can be trusted with it more than we can. A thing kept a question stays holy. A thing forced to an answer just becomes another lie people kill over. Keep it open. That is the whole of my faith.",
      ] },
      { requiresFlags: ["act2_pass_open"], lines: [
        "The north road is open, and the Record has a new first shelf. Maerwen wants to call the volume 'The Silence Beyond the Spine'. I told her the silence is over — she said that's the point of the title.",
      ] },
      { requiresFlags: ["act2_tablets_all"], lines: [
        "Maerwen hasn't slept since you brought the fourth verse. Four tablets, one psalm, and a door under the pass that no map will admit to. The Record was built for exactly this — and I'm still afraid of it.",
      ] },
      { requiresFlags: ["endgame_shard_secured"], lines: [
        "It's in the inner vault, unread, and it will stay unread. You kept the question open. Holy, by staying unknown.",
        "People wanted you to answer it. You did the harder thing — you let it keep being a question. The Record will remember that longer than any answer.",
      ] },
      { requiresFlags: ["belief_finalized"], lines: [
        "You settled your belief, once, out loud, and it held. That's rarer than any Shard I've catalogued. Most people die still deciding.",
        "I won't ask which way you went. The settling is the thing. The rest is just the shelf you put it on.",
      ] },
      { requiresFlags: ["guild_pale_record_rank_1"], lines: [
        "Chronicler. The Record keeps what it's given — and you've given it more than most who wear the seal. Come and read further, when the quiet suits you.",
      ] },
      { requiresFlags: ["guild_pale_record_contacted"], lines: [
        "You gave the coin a home instead of a hearth-shelf. I knew then we'd work well. The Underloft's patient — it's waited this long for eyes like yours.",
      ] },
    ],
  },
  {
    id: "maerwen", kind: "npc", x: 52, y: 47, name: "Maerwen the Antiquarian",
    lines: [
      "Sera keeps the Record's shelves. I fill them — barrows, vaults, anywhere the dust is old enough to argue with.",
      "The old north-folk wrote in the Pale script, and everything they wrote points the same way: north, past the Spine, down a road no map has carried in a thousand years.",
      "Grow strong enough to walk into places that were sealed on purpose, and come find me. I'll have work for you.",
    ],
    reactiveLines: [
      { requiresFlags: ["endgame_shard_secured"], lines: [
        "Sealed unread, in the Order's own vault. As an antiquarian I should be FURIOUS — the find of five lifetimes, shelved where no scholar will ever touch it.",
        "And yet. Every tablet I've ever pulled from the dark was somebody's attempt to keep a thing safe from the future. You did the same, only better. Perhaps that's what the Record is FOR.",
      ] },
      { requiresFlags: ["endgame_shard_walked_away"], lines: [
        "You simply... set it down. Do you know, of every outcome I catalogued, that was the one no precedent covered? A thousand years of Pale script and not one verse about someone declining.",
        "I've started a new page for it. The heading gives me trouble. 'The Quiet Ending' is the best I have — Sera says the trouble I'm having with the title IS the title. Insufferable woman. She's right.",
      ] },
      { requiresFlags: ["act2_pass_open"], lines: [
        "The pass is open. I keep saying it out loud to see if it stops being extraordinary. It doesn't.",
        "The Record is mapping the road north as fast as the watchmen dare walk it. A thousand years of silence, delver — and you're the one who ended it. The city past the Spine comes next.",
      ] },
      { requiresFlags: ["act2_tablets_all"], lines: [
        "Four verses on my desk and I still hear them at night. 'Until the wolf runs home.' They're waiting for us, delver — whoever they are.",
        "The Undergate, under the mountain's heart. When you're provisioned, we open the north.",
      ] },
      { requiresFlags: ["act2_tide"], lines: [
        "Three verses. Grave, vault, court — and the court named FIVE seals. I've had the aerie charts out all week. Go where the wind goes.",
      ] },
      { requiresFlags: ["act2_mountain"], lines: [
        "A toll-house balanced and shut from the inside. People don't do that to a road they mean to use again... unless they were afraid of what might come DOWN it.",
      ] },
      { requiresFlags: ["act2_wolf"], lines: [
        "The Wolf sits on my desk and I've read it forty times. Verse one of five. The vault in the pass will have the second — I'd stake the Record on it.",
      ] },
    ],
  },
  {
    id: "berric", kind: "npc", x: 49, y: 48, name: "Berric",
    lines: [
      "New blood. Vorn's project, are you. He does like to collect strays.",
      "Stone's stone, friend. A seam doesn't care who surveys it or who buys the map after. Only a fool leaves money in the ground out of sentiment.",
      "We should talk properly some time. Quietly.",
    ],
  },

  // --- Aldric, out in the Knuckle Hills where you begin (opening quest-giver) ---
  {
    id: "aldric", kind: "npc", x: 23, y: 16, name: "Aldric",
    lines: [
      "You've an honest look about you. Good — there's a thing that's been gnawing at me.",
      "Found this old coin in the dirt by my wall. Old Varath mintage, struck before my grandfather's grandfather drew breath. Worn smooth — and no coin I've ever known.",
      "Here's the strange of it: the moor rats keep turning the things up in their nests. A dead king's money, in a rat's hole. Why?",
      "Humour an old man. Put one of those rats down and see what it carries. Hold a thing to study it first — then strike.",
      "Ash and knuckle, that's all these hills are. But every road in Varath starts on one like it. The wood lies west; the Spine, north.",
    ],
    // The epilogue: the man whose coin began it gets the last word on each ending.
    reactiveLines: [
      { requiresFlags: ["endgame_shard_destroyed"], lines: [
        "So you burned it. Good. A question that big was never going to leave folk alone — someone had to be cruel enough to end it.",
        "They'll curse you in a hundred years for what they might have known. And they'll live to do the cursing, which is rather the point. I'd have done the same, if I'd had the nerve.",
        "Strange to think it started with a rat's coin by my wall. Sit a while, eh? The hills are just hills again, and I find I like them better this way.",
      ] },
      { requiresFlags: ["endgame_shard_secured"], lines: [
        "Locked away unread. You know, that's the old Underloft way — some things go to the watcher nameless, so she can't single them out.",
        "Folk sleep easier knowing the question's KEPT, even if it's never answered. A kept question is a kind of promise.",
        "It started with a coin in the dirt by my wall. Now it sits in a vault with the weight of the whole country on it. And you carried it every step between. Sit, lad. You've earned the fire.",
      ] },
      { requiresFlags: ["endgame_shard_used"], lines: [
        "You spoke the rite. I heard it, you know — everyone did, though nobody agrees on WHAT they heard. A door. A breath. My Edda's voice, thirty years gone.",
        "Something answered you down there. The pilgrims are already on the roads, and the moor rats have stopped digging. Stopped entirely. Make of that what you will.",
        "I don't ask what it said. I only ask this: was it worth the asking? ...Ah. Your face says it was. That'll keep an old man warm, that will.",
      ] },
      { requiresFlags: ["endgame_shard_walked_away"], lines: [
        "You put it DOWN. Ha! Kings, cults, scholars, the whole pale weight of history holding its breath — and you chose a smaller life, on purpose.",
        "That's the bravest ending nobody will ever sing about. The songs need a fire or a vault. They've no tune for a person who simply went home.",
        "Well, the hills are still here. The wood's still west, the Spine's still north — and my door's still open. That's the whole of it, and it's enough. It was always enough.",
      ] },
    ],
  },

  // --- Market square (north-east): the shopkeepers stand at their stalls in
  //     front of the Store and the Armoury, the rest of the square full of carts. ---
  {
    id: "shop_quartermaster", kind: "npc", x: 64, y: 43, name: "Hespa, Quartermaster",
    lines: [
      "Ironvale's market, friend. Cramped, loud, and the only honest counter for three days' walk.",
      "Tools, packs, rations, seeds — it's all on the stall. Sell me your odds and ends, too.",
    ],
  },
  { id: "cart_hespa", kind: "cart", x: 64, y: 44, name: "Quartermaster's Stall", lines: ["Hespa's stall — tools and sundries stacked to the awning."] },
  {
    id: "food_vendor", kind: "npc", x: 63, y: 48, name: "Brenna, Cook",
    lines: [
      "Smell that? Fresh off the coals. A hot meal mends you faster than a cold one.",
      "No time to fish or cook? Buy a meal here and eat it when the blows land.",
    ],
  },
  { id: "cart_brenna", kind: "cart", x: 63, y: 47, name: "Cookhouse Stall", lines: ["A cook-stall hung with smoked fish and warm rations."] },
  {
    id: "shop_armourer", kind: "npc", x: 70, y: 43, name: "Doran, Armourer",
    lines: [
      "You stand like someone who's been hit before. Good — means you'll buy mail and mean it.",
      "Shields, helms, plate — Ashforge seconds, tiers I through III. The heavy stuff you forge yourself.",
    ],
  },
  { id: "cart_doran", kind: "cart", x: 70, y: 44, name: "Armourer's Stall", lines: ["A rack of field steel and dented Ashforge seconds."] },
  {
    id: "cape_master", kind: "npc", x: 74, y: 43, name: "Master of Capes",
    lines: [
      "Every skill has a summit. Reach it — level one hundred — and I'll cut you the cape that says so. A million gold; you'll have it by then.",
      "Master all of them, and there is one cape left: the Cape of Varath. No coin truly buys it. You earn it, and I merely hand it over.",
    ],
  },
  // --- The Builders' Merchant: a sawmill yard by the Craftworks. Sells the raw
  //     stuff of Construction for gold, so a full purse can be poured straight
  //     into building (an OSRS-style skill sink). ---
  {
    id: "builder_merchant", kind: "npc", x: 46, y: 61, name: "Marrick, Builders' Merchant",
    lines: [
      "Building something? Then you'll want timber, stone and mortar — and I've a yard full.",
      "Planks cut, blocks dressed, beams squared. Bring coin and I'll save you the felling and the sawing. Your Construction will thank you.",
    ],
  },
  { id: "cart_builder", kind: "cart", x: 47, y: 61, name: "Sawmill Stacks", lines: ["Stacked planks and dressed stone under a timber awning, smelling of sawdust and pitch."] },
  { id: "cart_produce", kind: "cart", x: 67, y: 44, name: "Produce Cart", lines: ["Moor greens and river fish, laid out on straw."] },
  { id: "cart_cloth", kind: "cart", x: 73, y: 44, name: "Cloth Stall", lines: ["Bolts of undyed wool and a few faded bright ones."] },
  { id: "cart_spice", kind: "cart", x: 69, y: 47, name: "Spice Cart", lines: ["Dried herbs and ground roots in little horn scoops."] },
  // --- The Apothecary: herbs and field-gathered secondaries by the spice cart.
  //     Buy the makings of a brew for coin and pour gold into Herblore (a sink
  //     to match the Builders' Yard for Construction). ---
  {
    id: "apothecary", kind: "npc", x: 69, y: 48, name: "Wenna, Apothecary",
    lines: [
      "Herbs dried and roots ground — every leaf a tincture wants, and the field-stuff to bind them.",
      "Brewing? Buy the makings here and save the long forage. Coin in, Herblore out — that's the trade.",
    ],
  },
  // --- Skritt keeps his exchange on the south-east trade row ---
  {
    id: "shop_trader", kind: "npc", x: 64, y: 63, name: "Skritt",
    lines: [
      "Pssst. Goblin prices, friend — better than honest, worse than fair.",
      "Skritt buys what others won't, sells what others can't. The warm stone especially. Skritt is always interested in the warm stone.",
    ],
  },
  { id: "cart_skritt", kind: "cart", x: 63, y: 63, name: "Skritt's Cart", lines: ["A goblin's cart, piled with things best not examined too closely."] },

  // Bounties are no longer posted on a board — the three guides hand them out
  // in their own zones: Rook in the Knuckle Hills, Serath at the Spine, Mourne
  // at Redmouth (see their NPC entries below, tagged with `bountyGuide`).

  // --- The town square: a fountain at the crossroads, flanked by the capital's
  //     own royal-indigo standards. Ironvale flies the kingdom's colours; every
  //     lesser hold's banner answers to these. ---
  { id: "fountain_1", kind: "fountain", x: 60, y: 52, name: "The Ironvale Fountain", lines: ["Bright water over green-stained stone. Children dare each other to drink from it; nobody knows where the spring beneath it rises."] },
  { id: "banner_ironvale_w", kind: "banner", x: 56, y: 52, tint: "#3f4a94", name: "Ironvale Colours", lines: ["Royal indigo shot with a silver charge — the colours of Ironvale and, by old right, of all Varath. The dye alone costs more than a hamlet's whole banner. The capital does not let you forget it."] },
  { id: "banner_ironvale_e", kind: "banner", x: 64, y: 52, tint: "#3f4a94", name: "Ironvale Colours", lines: ["Royal indigo shot with a silver charge — the colours of Ironvale and, by old right, of all Varath. The dye alone costs more than a hamlet's whole banner. The capital does not let you forget it."] },

  // --- The Grand Exchange: a clerk's booth in the heart of the market. Trade
  //     on the world order book here (no longer a menu in the World tab). ---
  { id: "grand_exchange_1", kind: "grand_exchange", x: 66, y: 47, name: "Grand Exchange", lines: ["A clerk's booth ringed with chalkboards of bids and asks — the honest heart of Varath's market."] },

  // --- The Carpenter's sawmill, in the artisans' yard (Woodcraft) ---
  { id: "sawmill_1", kind: "sawmill", x: 53, y: 62, name: "Carpenter's Sawmill" },

  // --- Townsfolk going about the day (they wander the streets and squares) ---
  // The Town Crier stands by the fountain, calling out the news of Varath. He
  // shouts short bulletins on a timer (see src/client/crier.ts); talking to him
  // gives the fuller "what's new + tips" rundown below. Placed at final (78,78).
  {
    id: "town_crier", kind: "npc", x: 58, y: 52, name: "The Town Crier",
    lines: [
      "Hear ye, hear ye! You've the look of someone who's been away — let me catch you up on the doings of Varath.",
      "The roads: the wilds have been driven back from every town's gates. No more wolves nor cutthroats at your heels while you shop — a fight in the wilds is a thing you choose now, not a thing that chooses you.",
      "The Faithful walk among us: Devotion is prayer and magic as one skill now. Bury bones for its favour, wield a staff to cast, and fill your Grace at any shrine or altar — you'll see the bar under your health.",
      "For the green and the wandering: talk to the folk you meet — reeves, wardens, delvers and fishwives all keep a task for a willing hand, though they'll not always wear it on their sleeve. And your own words carry now — speak, and the world sees you say it, over your very head.",
      "And a roof of your own! Reeve Tamsin at the Drover's Rest will sign an empty lot over to any willing hand — a cottage with the ground. Step inside, tap Decorate, and furnish it how you please: hundreds of pieces in every wood and cloth, and floors and walls to recolour to taste. Raise it room by room as your Construction grows — cottage, homestead, manor, estate — and it'll grow on its lot for all the road to see.",
      "Once it's raised, set a hearth, a strongbox and a bench inside, and you'll cook, bank and build under your own roof, never troubling the town. Keep a bed, and the road always carries you home — and a manor earns a backyard where your collected pets may roam. Ask Tamsin to begin, once you've a few adventures behind you.",
      "That's the news! Toss a coin in the fountain for luck and mind the moon — she's watching, as she always is.",
    ],
  },
  {
    id: "town_fishwife", kind: "npc", x: 69, y: 57, name: "A Fishwife",
    lines: [
      "Greyfin, fresh off the Redrun! Well — fresh enough. You'll not get better this side of the estuary.",
      "My man rows the river. Says the water's been running redder than it ought. I tell him it's the season. He doesn't argue, but he doesn't smile either.",
    ],
    reactiveLines: [
      { requiresFlags: ["sq_redriver_done"], lines: [
        "You went and looked at the Redrun for me, when the watch wouldn't. Whatever you told me of it — I sleep now, and my man smiles again.",
        "That's worth more than the whole morning's catch. Here — take a greyfin, and don't you dare offer me a coin for it.",
      ] },
    ],
  },
  {
    id: "town_guard", kind: "npc", x: 62, y: 47, name: "An Off-Duty Guard",
    lines: [
      "Long as the gates hold and the lamps are lit, Ironvale sleeps easy. Mostly.",
      "They've got me on the new watchtower come spring. Watching for what, nobody'll say. That's the part that keeps me up.",
    ],
    reactiveLines: [
      { requiresFlags: ["q_boneman_complete"], lines: [
        "The Boneman. Years I carried that one — the job the watch pretends isn't happening. You put it down and never asked to see it on the ledger.",
        "I'll not forget that, whatever the record says. First full night's sleep I've had since I pinned on the badge. That's yours.",
      ] },
      { requiresFlags: ["varath_main_story_complete"], lines: [
        "Whatever you did down in the deep dark, the roads have been quiet since. Quiet's the only thing a guard ever really prays for.",
        "They'll not put your name in any watch-book. So I'll say it here, off the ledger: well done. Ironvale owes you a peace it'll never name.",
      ] },
      { requiresFlags: ["sq_roost_done"], lines: [
        "The Roost's quiet for the first time in years, and I sleep the better for it. That was you. The watch won't say so — so I will, quietly. Thanks.",
      ] },
    ],
  },
  {
    id: "town_child", kind: "npc", x: 58, y: 53, name: "A Child",
    lines: [
      "Bet you can't toss a coin in the fountain and have it land flat. Nobody can. I've seen a hundred try.",
      "My gran says the old coins the rats dig up are unlucky. I keep one anyway. It's warm. Feel.",
    ],
    reactiveLines: [
      { requiresFlags: ["the_warmth_answered"], lines: [
        "My gran says the ground's been warm all week, even up here where it's never warm. She says you did that. Did you? DID you?",
        "The old coin in my pocket's warmer than ever. I'm keeping it. Nobody can make me put it in the fountain now.",
      ] },
      { requiresFlags: ["endgame_shard_destroyed"], lines: [
        "The warm coins went cold. All of them, all at once, the same night. Mine too.",
        "Gran said good riddance. I think I liked it better warm. Don't tell her.",
      ] },
      { requiresFlags: ["varath_main_story_complete"], lines: [
        "You're the one everybody's on about! You went ALL the way down to the dark, past the crawlers and everything!",
        "What's down there? Is it a monster? Is it a KING? Grown-ups won't say and that means it's good.",
      ] },
      { requiresFlags: ["q_boneman_complete"], lines: [
        "The big folk stopped whispering about the Boneman. They say you got him. You don't look like much — no offence!",
        "I'm allowed on the west road again now. Almost allowed. Nearly.",
      ] },
      { requiresFlags: ["sq_roost_done"], lines: [
        "The guards say the Brigand's Roost got took. By YOU? Can I see your sword? I won't touch it. I'll only touch it a little.",
      ] },
    ],
  },
  {
    id: "town_pilgrim", kind: "npc", x: 55, y: 63, name: "A Pilgrim",
    lines: [
      "I walked from the Heartmoor to stand a day in a city that still has walls. It's a comfort, walls.",
      "They say the Spine is Orun's own back. I came to see it. I'll go home and say I saw a mountain. Both are true, I think.",
    ],
    reactiveLines: [
      { requiresFlags: ["the_warmth_answered"], lines: [
        "The warmth answered. I felt it in the fountain-stones this morning — I knelt and I wept, and I am not ashamed.",
        "I walked all this way to see a mountain. I'll go home having felt a god move under the world. Or something. Something.",
      ] },
      { requiresFlags: ["endgame_shard_destroyed"], lines: [
        "The stones went cold, and I felt the faith go out of me like a held breath let go. I don't know yet if it's grief or relief.",
        "Maybe that's the mercy of it — no more waiting to know. Only the cold, and the walls, and the long road home.",
      ] },
      { requiresFlags: ["belief_finalized"], lines: [
        "They say you stood at the bottom of it and settled your own belief, plainly, out loud. I've walked a hundred miles and I still can't. What did you decide?",
        "No — don't tell me. A person's belief is theirs. I only wanted to know it could be done.",
      ] },
      { requiresFlags: ["hm_faithful"], lines: [
        "You've the warm-stone about you — you've knelt at the moor's fire, same as me. Then we're the same road, you and I, however far apart we started it.",
      ] },
      { requiresFlags: ["act2_complete"], lines: [
        "The whole country's talking about a contested seam, and the one who settled who got it. They mean you, don't they. I can tell by how you didn't answer.",
      ] },
    ],
  },
  {
    id: "town_drunk", kind: "npc", x: 73, y: 56, name: "A Cheerful Drunk",
    lines: [
      "Friend! Friend. You've an honest face and a full purse, I can tell these things.",
      "I'll tell you a secret for a coin. No? Then I'll tell you for free: the moon watches, and she does not blink. Sleep on that.",
    ],
  },
  {
    id: "town_courier", kind: "npc", x: 65, y: 45, name: "An Ironvale Courier",
    lines: [
      "Riders out at dawn, riders in at dusk. The Courier never stops; the roads don't let us.",
      "Greyoak, the Spine, the Heartmoor — I've carried word to all of them. Everything in Varath runs through this market eventually.",
    ],
    reactiveLines: [
      { requiresFlags: ["varath_main_story_complete"], lines: [
        "Half my dispatches this month have your name in them, one way or another. The other half are about what you did down in the dark.",
        "Whatever it was — the roads are calmer for it, and calm roads mean my riders come home. I'll carry your name gladly, wherever it needs going.",
      ] },
      { requiresFlags: ["act2_complete"], lines: [
        "Word travels faster than my fastest rider these days, and near enough all of it's about you. The seam. The choice. Four houses, and you the one who settled it.",
      ] },
      { requiresFlags: ["guild_ashforge_joined"], lines: [
        "You've the Brotherhood's soot about you now. Say what you like about the Ashforge — they send more letters than any three houses in Varath. Keeps me in work.",
      ] },
      { requiresFlags: ["sq_courier_done"], lines: [
        "You went out on the Greyoak run when one of ours didn't come home. However that ended — you rode out, and most wouldn't. The Couriers remember that.",
      ] },
    ],
  },

  // === THE KNUCKLE HILLS — the home hills wrapping the city =================

  // --- Ashwood trees on the dirt grove, north of the city (Forestry) ---
  { id: "tree_1", kind: "tree", x: 54, y: 28, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_2", kind: "tree", x: 60, y: 26, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_3", kind: "tree", x: 66, y: 29, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  // Alderwood (8) and Silverbirch (14) break up Forestry's flat opening stretch
  // — a new tree to fell before Coldpine at 20, so it isn't 19 levels of ashwood.
  { id: "tree_alder_1", kind: "tree", x: 52, y: 30, name: "Alderwood Tree", resource: "fell_alder", species: "coldpine" },
  { id: "tree_alder_2", kind: "tree", x: 69, y: 31, name: "Alderwood Tree", resource: "fell_alder", species: "coldpine" },
  { id: "tree_birch_1", kind: "tree", x: 57, y: 33, name: "Silverbirch Tree", resource: "fell_birch", species: "ashwood" },
  { id: "tree_birch_2", kind: "tree", x: 101, y: 30, name: "Silverbirch Tree", resource: "fell_birch", species: "ashwood" },

  // --- Knucklestone rocks on the outcrop, north-east (Mining) ---
  { id: "rock_1", kind: "rock", x: 84, y: 32, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_2", kind: "rock", x: 87, y: 30, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_3", kind: "rock", x: 90, y: 34, name: "Knucklestone Rock", resource: "mine_knucklestone" },

  // --- More Ashwood trees scattered through the early lands (Forestry) ---
  { id: "tree_4", kind: "tree", x: 58, y: 14, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_5", kind: "tree", x: 67, y: 14, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_6", kind: "tree", x: 75, y: 14, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_7", kind: "tree", x: 98, y: 14, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_8", kind: "tree", x: 103, y: 14, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_9", kind: "tree", x: 48, y: 24, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_10", kind: "tree", x: 62, y: 23, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_11", kind: "tree", x: 67, y: 23, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_12", kind: "tree", x: 98, y: 23, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_13", kind: "tree", x: 103, y: 23, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_14", kind: "tree", x: 34, y: 32, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_15", kind: "tree", x: 67, y: 33, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_16", kind: "tree", x: 98, y: 32, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_17", kind: "tree", x: 103, y: 32, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_18", kind: "tree", x: 30, y: 41, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_19", kind: "tree", x: 97, y: 41, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },

  // --- More Knucklestone rocks scattered through the early lands (Mining) ---
  { id: "rock_4", kind: "rock", x: 38, y: 14, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_5", kind: "rock", x: 43, y: 14, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_6", kind: "rock", x: 38, y: 23, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_7", kind: "rock", x: 44, y: 23, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_8", kind: "rock", x: 82, y: 28, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_9", kind: "rock", x: 90, y: 28, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_10", kind: "rock", x: 44, y: 32, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_11", kind: "rock", x: 50, y: 39, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_12", kind: "rock", x: 57, y: 39, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_13", kind: "rock", x: 82, y: 35, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_14", kind: "rock", x: 85, y: 37, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_15", kind: "rock", x: 45, y: 42, name: "Knucklestone Rock", resource: "mine_knucklestone" },

  // --- Fishing on the lake, south-west of the city ---
  { id: "fish_1", kind: "fishing_spot", x: 37, y: 72, name: "River Shallows", resource: "fish_ashfin", catches: POOL_RIVER },
  { id: "fish_2", kind: "fishing_spot", x: 37, y: 76, name: "River Shallows", resource: "fish_ashfin", catches: POOL_RIVER },
  { id: "fish_3", kind: "fishing_spot", x: 41, y: 71, name: "River Shallows", resource: "fish_ashfin", catches: POOL_RIVER },
  { id: "fish_4", kind: "fishing_spot", x: 39, y: 79, name: "River Bend", resource: "fish_ashfin", catches: POOL_RIVER },
  { id: "fish_5", kind: "fishing_spot", x: 31, y: 80, name: "Reedy Pool", resource: "fish_ashfin", catches: POOL_RIVER },
  { id: "fish_6", kind: "fishing_spot", x: 35, y: 81, name: "Reedy Pool", resource: "fish_ashfin", catches: POOL_RIVER },

  // --- Aldric's farmstead (plant + tree patches) on the east apron ---
  // OSRS-style farming RUN: one plant + one tree patch pair at Aldric's farm
  // and at every settlement across the world (the rest are in newPois, final
  // coords) — spread out so farming is a journey, not one super-garden.
  { id: "patch_1", kind: "plant_patch", x: 81, y: 42, name: "Plant Patch" },
  { id: "patch_2", kind: "plant_patch", x: 83, y: 42, name: "Plant Patch" },
  { id: "treepatch_1", kind: "tree_patch", x: 82, y: 47, name: "Tree Patch" },
  { id: "patch_redmouth_1", kind: "plant_patch", x: 87, y: 55, name: "Plant Patch" },
  { id: "treepatch_redmouth", kind: "tree_patch", x: 92, y: 55, name: "Tree Patch" },
  { id: "patch_drover_1", kind: "plant_patch", x: 62, y: 69, name: "Plant Patch" },
  { id: "treepatch_drover", kind: "tree_patch", x: 62, y: 71, name: "Tree Patch" },

  // --- Starter game on the hill grass, and hare snares (Hunter 1) ---
  { id: "rat_1", kind: "monster", monster: "moor_rat", x: 44, y: 30, name: "Moor Rat" },
  { id: "rat_2", kind: "monster", monster: "moor_rat", x: 47, y: 32, name: "Moor Rat" },
  { id: "wolf_1", kind: "monster", monster: "hill_wolf", x: 50, y: 13, name: "Hill Wolf" },
  { id: "trap_hare_1", kind: "trap", x: 52, y: 31, name: "Snare", resource: "hunt_hare" },
  { id: "trap_hare_2", kind: "trap", x: 74, y: 32, name: "Snare", resource: "hunt_hare" },

  // Altar of Orun — kneel here (or at any shrine) to refill Grace for Faith.
  { id: "altar_ironvale", kind: "shrine", x: 56, y: 41, name: "Altar of Orun", lines: ["A worn stone altar to Orun. Kneel here to refill your Grace."] },
  // The Shrinekeeper — a starter Devotion vendor beside the altar: a first staff,
  // Acolyte robes, and a rationed Devotion Potion (one every 15 minutes).
  {
    id: "devotion_keeper", kind: "npc", x: 57, y: 41, name: "Yorwin, the Shrinekeeper",
    lines: [
      "Peace of Orun on you. New to the light, or just cold and looking for a fire? Either's welcome at the altar.",
      "I keep the Shrinekeeper's Table for those starting on Devotion — a plain staff, an acolyte's robes, and a draught of Grace when the shrine spares one. It only ever spares one at a time; the seam gives slowly.",
      "Bury bones for Orun's favour, kneel at the altar to fill your Grace, and when you've the coin, the deeper staves are cut far from here. Start small. Everyone does.",
    ],
  },

  // The Stablemaster — sells every open-market mount (the quest steeds stay
  // quest-rewards). Prices are the mounts' authored costs: a long gold ladder
  // from a plough ox to the Redrun Courser — the game's biggest coin sinks
  // after the skillcapes.
  {
    id: "stablemaster", kind: "npc", x: 52, y: 54, name: "Berta, the Stablemaster",
    lines: [
      "Mind the straw. Every animal in this yard is broke to saddle and better behaved than most patrons.",
      "The ox hauls, the wolves keep pace with a killer, and the Courser — the Courser outruns the wind off the Redrun. Priced accordingly.",
      "No refunds. They remember being sold back, and they sulk.",
    ],
  },
  // The stable itself: the barn on the west wall opens onto a fenced dirt
  // paddock — live horses ambling in the straw, hay by the rail, Berta at the
  // gate — so the mount shop is a PLACE, not a lone woman in a plaza.
  ...makePen("fence_stable", 49, 55, 55, 61, [[52, 55]], "The stable paddock's post-and-rail. The top bar is chewed."),
  { id: "cr_stable_horse1", kind: "critter", species: "horse", x: 51, y: 57, name: "A Stable Horse" },
  { id: "cr_stable_horse2", kind: "critter", species: "horse", x: 53, y: 59, name: "A Stable Horse" },
  { id: "cr_stable_ox", kind: "critter", species: "ox", x: 51, y: 60, name: "A Plough Ox" },
  { id: "cart_hay", kind: "cart", x: 54, y: 56, name: "Hay Bales", lines: ["Sweet meadow hay, stacked to the rail. Something has been eating it faster than Berta forks it in."] },

  // === SETTLEMENT GUARDS (Batch 7) =========================================
  // Attackable but never aggressive (see AGGRESSIVE in worldCore) — they hold
  // the watch at every named settlement. Ironvale, the capital, fields the
  // tougher city guard; the hamlets get the common Settlement Guard.
  { id: "guard_iv_1", kind: "monster", monster: "ironvale_guard", x: 49, y: 40, name: "Ironvale Guard" },
  { id: "guard_iv_2", kind: "monster", monster: "ironvale_guard", x: 59, y: 46, name: "Ironvale Guard" },
  { id: "guard_iv_3", kind: "monster", monster: "ironvale_guard", x: 57, y: 60, name: "Ironvale Guard" },
  { id: "guard_fold", kind: "monster", monster: "town_guard", x: 63, y: 14, name: "Settlement Guard" },
  { id: "guard_redmouth", kind: "monster", monster: "town_guard", x: 84, y: 61, name: "Settlement Guard" },
  { id: "guard_drover", kind: "monster", monster: "town_guard", x: 71, y: 75, name: "Settlement Guard" },
  { id: "guard_heartmoor", kind: "monster", monster: "town_guard", x: 19, y: 83, name: "Settlement Guard" },
  { id: "guard_knuckle", kind: "monster", monster: "town_guard", x: 13, y: 10, name: "Settlement Guard" },
  { id: "guard_greyoak", kind: "monster", monster: "town_guard", x: 17, y: 34, name: "Forester's Guard" },
  { id: "guard_deeps", kind: "monster", monster: "town_guard", x: 91, y: 18, name: "Outpost Guard" },
  { id: "guard_spine", kind: "monster", monster: "town_guard", x: 46, y: 7, name: "Settlement Guard" },

  // === FARMERS — kill for seeds (Batch 7) ==================================
  // Passive field hands worked for their seed satchels; the master farmer runs
  // the larger plots and carries the rare herb/tree seeds.
  { id: "farmer_iv", kind: "monster", monster: "field_farmer", x: 80, y: 45, name: "Field Farmer" },
  { id: "farmer_iv_master", kind: "monster", monster: "master_farmer", x: 86, y: 46, name: "Master Farmer" },
  { id: "farmer_redmouth", kind: "monster", monster: "field_farmer", x: 89, y: 53, name: "Field Farmer" },
  { id: "farmer_drover", kind: "monster", monster: "field_farmer", x: 61, y: 71, name: "Field Farmer" },
  { id: "farmer_knuckle", kind: "monster", monster: "field_farmer", x: 27, y: 18, name: "Field Farmer" },

  // === HEARTMOOR CULT CASTERS (magic enemies) ===============================
  // Around the cult's haunts in the Ashfen Flats (Cult Tender ~60,86) and the
  // Heartmoor moor-edge. They fling Grace-bolts and drop Hex Cloth for robes.
  { id: "cultist_ash_1", kind: "monster", monster: "cult_acolyte", x: 58, y: 88, name: "Cult Acolyte" },
  { id: "cultist_ash_2", kind: "monster", monster: "cult_acolyte", x: 63, y: 89, name: "Cult Acolyte" },
  { id: "cultist_ash_3", kind: "monster", monster: "cult_zealot", x: 60, y: 91, name: "Cult Zealot" },
  { id: "cultist_ash_4", kind: "monster", monster: "cult_magus", x: 65, y: 92, name: "Cult Magus" },
  { id: "cultist_heart_1", kind: "monster", monster: "cult_acolyte", x: 20, y: 86, name: "Cult Acolyte" },
  { id: "cultist_heart_2", kind: "monster", monster: "cult_zealot", x: 23, y: 88, name: "Cult Zealot" },

  // --- The Hollow Warden, moved OUT of its single-room arena to an open lair
  //     in the eastern woods by the barrow mouth — a grindable overworld boss
  //     now (Act II turned its old arena's portal into a real dungeon; see
  //     buildDungeonSites below for the new Hollow Barrows crawl).
  { id: "boss_hollow", kind: "monster", monster: "hollow_warden", x: 104, y: 27, name: "The Hollow Warden" },
  { id: "hollow_add1", kind: "monster", monster: "wild_boar", x: 102, y: 25, name: "Barrow Boar" },
  { id: "hollow_add2", kind: "monster", monster: "forest_bear", x: 106, y: 29, name: "Barrow Bear" },

  // === GREYOAK WOOD (west) ==================================================
  { id: "gw_pine_1", kind: "tree", x: 11, y: 47, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_2", kind: "tree", x: 14, y: 49, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_3", kind: "tree", x: 26, y: 47, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_4", kind: "tree", x: 28, y: 49, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_pine_5", kind: "tree", x: 12, y: 50, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "gw_oak_1", kind: "tree", x: 10, y: 57, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_2", kind: "tree", x: 14, y: 59, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_3", kind: "tree", x: 27, y: 58, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_4", kind: "tree", x: 29, y: 56, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "gw_oak_5", kind: "tree", x: 24, y: 60, name: "Greyoak (Old Growth)", resource: "fell_greyoak", species: "greyoak" },
  { id: "maret", kind: "npc", x: 22, y: 53, name: "Maret", lines: ["Stranger on the Lodge road. You'll forgive the look — the wood teaches you to measure people.","This is Greyoak. Old before Ironvale was a name. The boar keep to the understory; give the deep wood its distance and it gives you yours.","Every season the old growth pulls back a little further. We mark the new treeline against the last. We do not ask what walks in the cleared ground.","Bring an axe worth the name and the greyoak will pay you in timber. Bring less and it will only blunt you."],
    reactiveLines: [
      { requiresFlags: ["act3_staged"], blockedByFlags: ["act3_finale_ready"], lines: ["So they've sent you round the four of us. Good. Sit. Here's the Lodge's answer, and it's the one none of them will say to your face.","Walk away. Don't burn it, don't shelve it, don't kneel to it. Leave it in the ground it chose and go live a life that isn't about it. Every one of them — Vorn, Sera, Calder — wants to be the hand that DECIDES. That's the trap. The stone doesn't need deciding. It needs leaving be. The strongest thing you'll ever do is set it down and let it stay a mystery you didn't have to solve. The wood does that every season. So can you."] },
      { requiresFlags: ["endgame_shard_walked_away"], lines: ["You set it down and walked out of the story. Do you know how few could? Everyone else wanted to be the one who decided.","You chose the smaller, truer life. The wood understands that better than any of them. Come sit by the fire — you've earned a quiet one."] },
      { requiresFlags: ["guild_lodge_rank_2"], lines: ["Warden. Full standing, full trust. The wood took its time deciding about you — it always does — but it decided, and it doesn't go back on that.","Caelwyn's longbow suits your hand. Carry it into the deep growth and it'll remember the way, even when you don't."] },
      { requiresFlags: ["knows_forest_retreat"], lines: ["You've seen what pulls the treeline back. Carry it quiet a while yet. The wood will tell us what it means when it's ready — not before."] },
      { requiresFlags: ["guild_lodge_contacted"], lines: ["You came back to this fire, and you came back clean. Not everyone manages both. The Lodge remembers a steady hand."] },
      { blockedByFlags: ["guild_lodge_contacted"], requiresFlags: ["npc_maret_wolf_killed_by_player"], lines: ["I know what you did to the white wolf at the treeline. I'll trade with you, if I must. But don't mistake trade for trust. The wood hasn't forgotten, and neither have I."] },
    ] },
  { id: "lenne", kind: "npc", x: 20, y: 52, name: "Lenne", lines: ["Quiet, now. You'll learn more standing still in this wood than talking in it.","I track for the Lodge. Maret keeps the fire; I keep the treeline. We both watch the same thing pulling back.","If the old growth ever decides you're worth its notice, you'll feel it before you see it. Don't run."] },
  { id: "gw_boar_1", kind: "monster", monster: "wild_boar", x: 15, y: 49, name: "Wild Boar" },
  { id: "gw_boar_2", kind: "monster", monster: "wild_boar", x: 24, y: 50, name: "Wild Boar" },
  { id: "gw_boar_3", kind: "monster", monster: "wild_boar", x: 17, y: 56, name: "Wild Boar" },
  { id: "gw_bear_1", kind: "monster", monster: "forest_bear", x: 11, y: 58, name: "Forest Bear" },
  { id: "gw_bear_2", kind: "monster", monster: "forest_bear", x: 28, y: 60, name: "Forest Bear" },
  { id: "gw_greymane", kind: "monster", monster: "greymane_boar", x: 21, y: 60, name: "Greymane Boar" },
  { id: "trap_boar_1", kind: "trap", x: 17, y: 48, name: "Boar Snare", resource: "hunt_boar" },
  { id: "trap_boar_2", kind: "trap", x: 26, y: 51, name: "Boar Snare", resource: "hunt_boar" },
  { id: "trap_wolf_1", kind: "trap", x: 19, y: 57, name: "Wolf Snare", resource: "hunt_wolf" },
  { id: "trap_bear_1", kind: "trap", x: 13, y: 59, name: "Bear Snare", resource: "hunt_bear" },
  { id: "trap_bear_2", kind: "trap", x: 26, y: 58, name: "Bear Snare", resource: "hunt_bear" },
  // Intermediate quarry that break Hunter's 15-level gaps (marten 10, lynx 37).
  { id: "trap_marten_1", kind: "trap", x: 22, y: 54, name: "Marten Box-Trap", resource: "hunt_marten" },
  { id: "trap_lynx_1", kind: "trap", x: 14, y: 54, name: "Lynx Snare", resource: "hunt_lynx" },

  // === THE SPINE (north) ====================================================
  { id: "serath", kind: "npc", bountyGuide: "serath", x: 42, y: 8, name: "Serath, the Spine Warden", lines: ["Far enough, for now. This is the Spine — Orun's backbone, the faithful say. Whatever it is, it does not forgive carelessness.","Ridge wolves on the low passes. Higher, the stone crawlers and the trolls. And the wraiths, where the wind never stops. Go up only as far as you can come down.","The Cut yields good metal — ashiron, and ribstone deeper. Bring a pick that can take the cold.","Two things you'll find and not understand: the Wind-Shrine, worn to the shape of a vertebra, and the Vault, shut from the inside. Measure them if you must. Don't pretend to read them.","The Vault sits high — climb the pass to the top of the Spine, past the Wind-Shrine, where the snow never leaves. Few go that far. Fewer come down."] },
  { id: "sp_rock_1", kind: "rock", x: 42, y: 13, name: "Ashiron Seam", resource: "mine_ashiron" },
  { id: "sp_rock_2", kind: "rock", x: 45, y: 17, name: "Ashiron Seam", resource: "mine_ashiron" },
  { id: "sp_rock_3", kind: "rock", x: 52, y: 24, name: "Ribstone Seam", resource: "mine_ribstone" },
  { id: "sp_rock_4", kind: "rock", x: 56, y: 31, name: "Ribstone Seam", resource: "mine_ribstone" },
  { id: "sp_wolf_1", kind: "monster", monster: "ridge_wolf", x: 46, y: 9, name: "Ridge Wolf" },
  { id: "sp_wolf_2", kind: "monster", monster: "ridge_wolf", x: 47, y: 14, name: "Ridge Wolf" },
  { id: "sp_crawler_1", kind: "monster", monster: "stone_crawler", x: 45, y: 20, name: "Stone Crawler" },
  { id: "sp_crawler_2", kind: "monster", monster: "stone_crawler", x: 54, y: 18, name: "Stone Crawler" },
  { id: "sp_troll_1", kind: "monster", monster: "mountain_troll", x: 55, y: 27, name: "Mountain Troll" },
  { id: "sp_wraith_1", kind: "monster", monster: "spine_wraith", x: 56, y: 22, name: "Spine Wraith" },
  { id: "sp_wraith_2", kind: "monster", monster: "spine_wraith", x: 52, y: 35, name: "Spine Wraith" },
  { id: "spine_wind_shrine", kind: "shrine", x: 54, y: 7, name: "The Wind-Shrine", lines: ["A standing stone the wind has worn to the shape of a vertebra. Orun's, the believers say. A rock worn by weather, say the rest. The shrine settles nothing."] },
  { id: "spine_vault", kind: "shrine", x: 54, y: 32, name: "The Spine Vault", lines: ["A door of dressed stone set into the mountain — shut, and shut from the inside. The ward-stones around it have not been moved in a very long time."] },

  // === HEARTMOOR (south-west) ===============================================
  { id: "calder", kind: "npc", x: 17, y: 82, name: "Calder", lines: ["Cold road, isn't it. Sit a moment — there's always a fire going at the moor's edge, and food for whoever the road gives out on.","We're the Heartmoor faithful. No, don't make the face. We feed people. What you do with the rest of it is your business.","The peat keeps things. Bog-bodies, old swords, older questions. And the warm seams — Hearthite, black and almost living. Rock, the miners say. We say otherwise. Both are true of the same stone.","Go careful past the pools. The bog knights don't sleep, and the serpents are patient."],
    reactiveLines: [
      { requiresFlags: ["act3_staged"], blockedByFlags: ["act3_finale_ready"], lines: ["You've come to the fire to hear the Heartmoor's answer before you choose. I'll give it to you warm and honest, the way we give everything.","Complete the rite. Not for us — for the answer itself. Vorn wants to burn the question so no one has to feel it. Sera wants to bury it so no one has to face it. Maret wants you to turn your back and call the turning strength. And I'm telling you: the bravest thing, the FAITHFUL thing, is to ask. Do the rite. Let the warmth answer, whatever it answers. A god or a stone or something with no word yet — but ANSWERED, out loud, once, instead of hidden or feared forever. That's not recklessness. That's the only real courage any of the four of us is offering you."] },
      { requiresFlags: ["the_warmth_answered"], lines: ["The warmth answered. Whatever you meant by the doing of it, the Heartmoor felt it move under the world — every one of us, at the same breath.","We always said it would answer, if someone only had the nerve to ask. You had the nerve. Sit at the fire, faithful. It's as much yours as mine now."] },
      { requiresFlags: ["hm_faithful"], lines: ["You tended the seam, you broke the old watch at the Barrow, and you're still here at the fire. You're faithful now, in the only way that ever mattered — the staying.","The warmth keeps who it keeps. It kept you."] },
      { requiresFlags: ["hm_joined"], lines: ["You came to the moor's edge to understand the warm stone instead of just selling it. That's the whole beginning of faith, right there. The rest is only time at the fire."] },
      { requiresFlags: ["met_calder"], lines: ["The road keeps sending you back to my fire. It notices things like that, the road. So do I. There's always a meal here, whatever you believe."] },
    ] },
  { id: "hm_lurker_1", kind: "monster", monster: "marsh_lurker", x: 16, y: 87, name: "Marsh Lurker" },
  { id: "hm_lurker_2", kind: "monster", monster: "marsh_lurker", x: 28, y: 90, name: "Marsh Lurker" },
  { id: "hm_hound_1", kind: "monster", monster: "heartmoor_hound", x: 14, y: 94, name: "Heartmoor Hound" },
  { id: "hm_hound_2", kind: "monster", monster: "heartmoor_hound", x: 30, y: 96, name: "Heartmoor Hound" },
  { id: "hm_serpent_1", kind: "monster", monster: "mire_serpent", x: 25, y: 85, name: "Mire Serpent" },
  { id: "hm_knight_1", kind: "monster", monster: "bog_knight", x: 20, y: 99, name: "Bog Knight" },
  { id: "heartmoor_barrow", kind: "shrine", x: 13, y: 99, name: "Drowned Waymark", lines: ["A leaning stone worn smooth by the moor. Under the lichen: a seated figure, scales in hand, and a road going north. The old court's boundary-mark — its seat lies close by, half under the water."] },
  { id: "trap_stag_1", kind: "trap", x: 18, y: 91, name: "Stag Snare", resource: "hunt_stag" },
  { id: "trap_stag_2", kind: "trap", x: 27, y: 93, name: "Stag Snare", resource: "hunt_stag" },
  { id: "trap_aurochs_1", kind: "trap", x: 22, y: 96, name: "Aurochs Snare", resource: "hunt_aurochs" },
  // Mid/high-tier gap fills: a marsh-eel pool (Fishing 45) and a moorhart snare (Hunter 75).
  { id: "hm_fish_eel", kind: "fishing_spot", x: 24, y: 94, name: "Eel Pool", resource: "fish_bramblecarp", catches: POOL_MOOR },
  { id: "hm_fish_shad", kind: "fishing_spot", x: 22, y: 96, name: "Peat Pool", resource: "fish_bramblecarp", catches: POOL_MOOR },
  { id: "trap_moorhart", kind: "trap", x: 16, y: 84, name: "Hart Snare", resource: "hunt_moorhart" },
  // Intermediate quarry filling the mid-Hunter gaps (ram 52, elk 67).
  { id: "trap_ram_1", kind: "trap", x: 25, y: 88, name: "Ram Snare", resource: "hunt_ram" },
  { id: "trap_elk_1", kind: "trap", x: 19, y: 87, name: "Elk Snare", resource: "hunt_elk" },
  // (The old Bog Barrow arena is retired: its mouth now opens into the Sunken
  // Court crawl — see buildDungeonSites — and the Bog Warden stalks the open
  // moor below, a remote grind boss like the other retired arena keepers.)
  { id: "boss_bog", kind: "monster", monster: "bog_warden", x: 24, y: 104, name: "The Bog Warden" },

  // === THE ASHFEN FLATS (south) =============================================
  { id: "ashfen_tender", kind: "npc", x: 60, y: 86, name: "Cult Tender", lines: ["You feel it through your boots — the ground's warm here, warmer the deeper you cut. The miners work short shifts. We don't mind the heat.","Embercite comes out of this rock. The smiths swear by it for flux. We keep the seam clean and leave what we owe.","I won't ask you to help. Only to witness. The discomfort is the point."] },
  { id: "af_rock_1", kind: "rock", x: 54, y: 88, name: "Embercite Working", resource: "mine_embercite" },
  { id: "af_rock_2", kind: "rock", x: 62, y: 94, name: "Embercite Working", resource: "mine_embercite" },
  { id: "af_rock_3", kind: "rock", x: 58, y: 100, name: "Embercite Working", resource: "mine_embercite" },

  // === THE MARROW DEEPS (north-east) ========================================
  { id: "md_crawler_1", kind: "monster", monster: "cave_crawler", x: 85, y: 12, name: "Cave Crawler" },
  { id: "md_crawler_2", kind: "monster", monster: "cave_crawler", x: 92, y: 17, name: "Cave Crawler" },
  { id: "md_bat_1", kind: "monster", monster: "deep_bat", x: 89, y: 10, name: "Deep Bat" },
  { id: "md_bat_2", kind: "monster", monster: "deep_bat", x: 93, y: 23, name: "Deep Bat" },
  { id: "md_wraith_1", kind: "monster", monster: "marrow_wraith", x: 84, y: 27, name: "Marrow Wraith" },
  { id: "md_golem_1", kind: "monster", monster: "deep_golem", x: 92, y: 29, name: "Deepstone Golem" },
  { id: "md_rock_1", kind: "rock", x: 88, y: 21, name: "Voidstone Shaft", resource: "mine_voidstone" },
  { id: "md_rock_2", kind: "rock", x: 92, y: 28, name: "Voidstone Shaft", resource: "mine_voidstone" },
  // The forge-ore itself, deepest in the Marrow — "Hearthite lies beyond the
  // voidstone" made real, so Mining 100 finally smiths best-in-slot gear, and a
  // prismatic vein past it for gems (fills the empty 89-100 mining band).
  { id: "md_rock_hearthite_1", kind: "rock", x: 90, y: 25, name: "Hearthite Seam", resource: "mine_hearthite" },
  { id: "md_rock_hearthite_2", kind: "rock", x: 86, y: 24, name: "Hearthite Seam", resource: "mine_hearthite" },
  { id: "md_rock_gem_1", kind: "rock", x: 91, y: 19, name: "Prismatic Vein", resource: "mine_gemvein" },
  { id: "marrow_vault", kind: "shrine", x: 95, y: 14, name: "The Marrow Vault", lines: ["Walls too smooth to be the dark's work, and a door that was opened from the inside. Whatever stayed down here, stayed because it chose to."] },
  { id: "marrow_keeper", kind: "npc", x: 94, y: 15, name: "The Marrow Keeper", lines: ["You came down the long dark and the door let you. Few things it lets through.","I kept the watch when there was an order to keep it for. Now there is only the watch, and the stone, and the warmth that will not cool.","Ask what you came to ask. But know that I have stood here longer than your kingdom, and even I cannot tell you whether the warmth is a god."] },
  { id: "portal_marrow", kind: "portal", x: 92, y: 14, name: "The Marrow Vault", dungeon: "marrow_vault", target: { x: 56, y: 118 }, lines: ["The vault door lets you pass."] },

  // === THE REDRUN & THE EYELESS SEA (east) =================================
  // Rich veins: mid-band mining unlocks (Deep Embercite 50, Rich Bloodore 75)
  // fill the 42→60→88 dead zones — richer XP from familiar ore.
  { id: "rd_rock_deep_1", kind: "rock", x: 97, y: 65, name: "Deep Embercite Seam", resource: "mine_embercite_deep" },
  { id: "rd_rock_rich_1", kind: "rock", x: 94, y: 70, name: "Rich Bloodore Vein", resource: "mine_bloodore_rich" },
  { id: "rd_rock_1", kind: "rock", x: 98, y: 63, name: "Bloodore Vein", resource: "mine_bloodore" },
  { id: "rd_rock_2", kind: "rock", x: 92, y: 72, name: "Bloodore Vein", resource: "mine_bloodore" },
  { id: "rd_fish_greyfin", kind: "fishing_spot", x: 96, y: 66, name: "Greyfin Pool", resource: "fish_greyfin" },
  { id: "rd_fish_1", kind: "fishing_spot", x: 96, y: 65, name: "Ribvault Shallows", resource: "fish_ribperch" },
  { id: "rd_fish_2", kind: "fishing_spot", x: 100, y: 73, name: "The Estuary", resource: "fish_copperling", catches: POOL_COAST },
  { id: "rd_fish_5", kind: "fishing_spot", x: 99, y: 70, name: "Coppertide Shallows", resource: "fish_copperling", catches: POOL_COAST },
  { id: "rd_fish_3", kind: "fishing_spot", x: 101, y: 80, name: "The Eyeless Sea", resource: "fish_deepscale", catches: POOL_DEEP },
  { id: "rd_fish_4", kind: "fishing_spot", x: 103, y: 83, name: "The Eyeless Deep", resource: "fish_deepscale", catches: POOL_DEEP },
  { id: "rd_brigand_1", kind: "monster", monster: "redrun_brigand", x: 92, y: 68, name: "Redrun Brigand" },
  { id: "rd_serpent_1", kind: "monster", monster: "river_serpent", x: 93, y: 76, name: "River Serpent" },
  { id: "rd_orc_1", kind: "monster", monster: "ancient_orc", x: 93, y: 80, name: "Ancient Orc" },
  // The Greyback — the wandering world boss. It relocates along its patrol on
  // a slow clock (core), and the town crier calls each sighting in the chat
  // feed. Patrol stops sit beside known wild camps across four regions.
  {
    id: "world_greyback", kind: "monster", monster: "greyback", x: 92, y: 70, name: "The Greyback",
    patrol: [
      { x: 92, y: 70 },  // the Redrun banks
      { x: 22, y: 61 },  // Greyoak wood
      { x: 56, y: 27 },  // the Spine passes
      { x: 17, y: 87 },  // the Heartmoor edge
      { x: 94, y: 79 },  // the old orc grounds
    ],
  },
  { id: "portal_ferryman", kind: "portal", x: 109, y: 59, name: "The Ferryman's Cave", dungeon: "ferryman_cave", target: { x: 72, y: 114 }, lines: ["A black slot in the rock, in the lonely hills north of the Redrun crossings. Cold river-air breathes up out of it, and far below something shifts its weight. You climb down."] },

  // === NAMED LANDMARKS — the gazetteer (discovery layer) ====================
  // Drawn from the World Bible §X. Examine-only places that give each area
  // depth and reward exploring; a few carry small extra nodes.

  // --- The open Knuckle Hills (north-west country) ---
  {
    id: "rook", kind: "npc", bountyGuide: "rook", x: 11, y: 9, name: "Rook, the Fieldwarden",
    lines: [
      "Cold firepit, warm welcome. Rook — I keep the watch over these hills, such as it is.",
      "I post the early bounties down at the Ironvale board. Small game, common prey. Everyone starts on a hill like this.",
      "There's a wolf out here that doesn't move like a wolf. Old, lame, clever. The truth of it is plainer and harder than the rumour. Most things up here are.",
    ],
  },
  { id: "lm_knuckle", kind: "shrine", x: 22, y: 12, name: "The Knuckle", lines: ["The bald stone fist the hills are named for. Old scratch-marks are worked into the rock — a mason's tally, or something older. Sera would copy them and still not pretend to know."] },
  // Two rocks make the outcrop: mining depletes a rock for a few seconds, and
  // the opening quest needs three ores — a lone rock strands a newcomer at a
  // bare stone with no idea why. A pair lets the natural response (tap the
  // other one) always work.
  { id: "rock_knuckle", kind: "rock", x: 20, y: 14, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "rock_knuckle_2", kind: "rock", x: 19, y: 13, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  // A hill kiln by the starting clearing, so the opening quest (mine -> smelt ->
  // bring Aldric a bar) can be done right where you begin.
  { id: "furnace_hill", kind: "furnace", x: 21, y: 17, name: "Hill Kiln" },
  { id: "lm_coldvein", kind: "shrine", x: 8, y: 33, name: "The Coldvein Scar", lines: ["A surface cutting worked dry two generations back. A retired miner still walks up for one last look before his knees give out — not after ore, he says. Just the look."] },
  { id: "lm_redrun_head", kind: "shrine", x: 27, y: 32, name: "The Redrun Head", lines: ["Where a dozen hill-streams braid into the head of the Redrun. The whole long river starts as this — thin water over pale stone."] },
  { id: "fish_tarn", kind: "fishing_spot", x: 33, y: 30, name: "The Head-Stream Pool", resource: "fish_ashfin", catches: POOL_RIVER },
  { id: "fish_tarn_2", kind: "fishing_spot", x: 30, y: 34, name: "The Head-Stream Pool", resource: "fish_ashfin", catches: POOL_RIVER },
  { id: "tree_hill_1", kind: "tree", x: 16, y: 20, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "tree_hill_2", kind: "tree", x: 20, y: 22, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },

  // --- Ironvale's districts (the city's named institutions) ---
  { id: "lm_watchtower", kind: "shrine", x: 74, y: 43, name: "The Watchtower", lines: ["A timber frame going up against the inside of the wall. Nobody finishes the sentence about what it's for. Ironvale is beginning to think defensively — against what, no one writes down."] },
  { id: "lm_mending", kind: "shrine", x: 54, y: 63, name: "The Mending House", lines: ["Where Ironvale brings what the world breaks. The cots are seldom all empty, and seldom all full."] },
  { id: "lm_wayfarers", kind: "shrine", x: 70, y: 63, name: "The Wayfarers' Lodge", lines: ["Where civilians are kitted and sent out into the world, and usually return. A board by the door lists expeditions overdue. Usually it is short."] },

  // --- Greyoak Wood ---
  { id: "lm_oldgrowth", kind: "shrine", x: 12, y: 63, name: "The Old Growth Edge", lines: ["Last year's boundary stakes stand a full pace inside this year's living wood. You can mark the retreat. You do not learn what walks in the cleared ground."] },
  { id: "lm_mill", kind: "shrine", x: 28, y: 55, name: "The Grey Oak Mill", lines: ["The saws that feed Ironvale's beams, running dawn to dusk. The best blade keeps dulling too fast; the foreman has a suspect, and he's half wrong."] },
  { id: "sawmill_mill", kind: "sawmill", x: 26, y: 55, name: "The Grey Oak Mill Bench" },
  {
    id: "charburner", kind: "npc", x: 5, y: 67, name: "The Charburner",
    lines: [
      "Mind the mound — turf-capped, slow-burning, and it'll take a boot off if you're careless.",
      "I trade fuel for news and news for company. Sit a while. The wood's quieter than it was, and I like to know who's still walking the Lodge road.",
    ],
  },
  { id: "fire_charburner", kind: "fire", x: 7, y: 68, name: "Charburner's Fire" },

  // --- The Spine ---
  { id: "lm_serath_post", kind: "shrine", x: 44, y: 6, name: "Serath's Post", lines: ["A stone bothy on the high pass, banked against the wind. Serath's relief is always days overdue; the road closes when the weather decides it should."] },
  { id: "lm_cold_streams", kind: "shrine", x: 49, y: 12, name: "The Cold Streams", lines: ["Meltwater off the high snow, running fast and clear and cold enough to ache. Something long and pale moves in the deeper channels. The old hands call it an eel and leave it at that."] },
  { id: "lm_spinite_cut", kind: "shrine", x: 51, y: 23, name: "The Spinite Cut", lines: ["Where the Spine's own metal comes out of the rock. A cutter's been pulling stone that fractures wrong — the flaw is in the seam, and he knew it before you did."] },

  // --- Heartmoor ---
  { id: "lm_false_seam", kind: "shrine", x: 12, y: 84, name: "The False Seam", lines: ["A cut that gives off the warmth but yields no stone. Dying, or never real — settle it if you can. Best leave the theology where it lies."] },
  { id: "lm_nightshade", kind: "shrine", x: 26, y: 86, name: "Nightshade Hollow", lines: ["A low, still dell where the dangerous green things grow best. There is one hour the plants are worth taking, and the herbalists guard it jealously."] },
  { id: "lm_peat", kind: "shrine", x: 20, y: 93, name: "The Peat Cuttings", find: { flag: "searched_peat_cuttings", found: "You work the loose peat where the cutter's spade struck. The bog gives it up whole: a warrior's helm, tanned dark and sound as the day it went under, its owner long since gone to the moor. The peat keeps what it takes.", item: "bog_ward_helm", qty: 1, xp: { skill: "survivalist", amount: 200 } }, lines: ["Black trenches squared off across the moor. You have already lifted what the bog kept here — a dead man's helm, whole after all these years."] },
  { id: "lm_mire_crossing", kind: "shrine", x: 31, y: 88, name: "The Mire Crossing", lines: ["Where solid ground is a rumour. The water moved last season; the safe line of stakes goes under if you lose your way reading it."] },

  // --- The Marrow Deeps ---
  { id: "lm_smooth_walls", kind: "shrine", x: 90, y: 19, name: "The Smooth Walls", find: { flag: "matched_masons_marks", found: "You press a knuckle into the tool-marks and trace the spine-shape motif along the dressed stone — and there, worked into a low course, three worn coins mortared flat as offerings by whoever cut this. Their spine-mark matches the wall exactly. The same hand made both. It still proves nothing. It's enough.", item: "worn_coin", qty: 3, xp: { skill: "mining", amount: 180 } }, lines: ["Tool-dressed stone, older than any living hand. You have already matched the masons' marks to the coins set in the wall — the same hand made both."] },
  { id: "lm_golem_gallery", kind: "shrine", x: 95, y: 30, name: "The Golem Gallery", find: { flag: "found_golem_flaw", found: "You watch the stopped golem a long while, keeping still. At last you see it: a hairline crack across the command-mark cut into its chest, splitting the old order in two. It didn't disobey — the instruction simply broke. A worn coin has fallen from its half-open hand.", item: "worn_coin", qty: 3, xp: { skill: "faith", amount: 160 } }, lines: ["Stone figures still carrying out a forgotten order. One has stopped where the others move. You have already read why — the command-mark on its chest is cracked clean through."] },
  { id: "lm_black_water", kind: "shrine", x: 86, y: 24, name: "The Black Water", lines: ["A still pool that swallows torchlight whole. Something pale lives in it — a blind cave-fish, by any plain account. One miner won't go near the water anymore."] },
  { id: "lm_fringe", kind: "shrine", x: 84, y: 10, name: "The Fringe Diggings", lines: ["The last lit edge before the dark goes total. Skritt's deep miner works it, and never asks what he's selling — nor who's buying."] },

  // --- The Redrun & the sea ---
  { id: "lm_ferry_stones", kind: "shrine", x: 95, y: 70, name: "The Ferry Stones", find: { flag: "recorded_ferry_stones", found: "You wade the low channel and copy each carved stone before the river takes them back — the ferryman's tally of the dead he rowed across, cut in Underloft script. Sera's map gains a line. Silt gives up two worn coins where a passenger's fare slipped the boat.", item: "worn_coin", qty: 2, xp: { skill: "faith", amount: 150 } }, lines: ["Dressed Underloft stones that surface mid-channel at low water. You have already recorded them for Sera's slow map of the dead."] },
  { id: "lm_brigand_camp", kind: "shrine", x: 90, y: 66, name: "The Brigand Camp", lines: ["A mean fire kept by people the road failed. One of them wants out, and offers what he knows for safe passage. Trust him or don't, and live with it."] },
  { id: "lm_river_mouth", kind: "shrine", x: 102, y: 82, name: "The River Mouth", lines: ["The last fresh water before the open grey. An old deep-water fisher is the only soul who's seen the Eyeless Pike and rowed home. Earn the telling; it gates nothing."] },
  { id: "lm_orcs_ground", kind: "shrine", x: 93, y: 78, name: "The Orc's Ground", find: { flag: "honoured_orcs_ground", found: "You lay the offering out in full — nothing rushed, nothing kept back — and step away from it. The old Orc regards the ground, then you. 'Done right,' he says, the once, and presses into your palm a coin worn smooth with a lifetime's handling. Then he turns back to his kept ground and will not speak again.", item: "worn_coin", qty: 1, xp: { skill: "faith", amount: 130 } }, lines: ["Kept ground, tended by an old Orc. You made your offering right, and he spoke his once. He will not speak again."] },

  // --- The Ashfen Flats ---
  { id: "lm_short_shift", kind: "shrine", x: 56, y: 90, name: "The Short-Shift Diggings", find: { flag: "worked_short_shift", found: "You take up an abandoned pick and work one short, scalding shift the way the Ashfen miners do — a few furious minutes before the heat drives you out. The warm rock gives freely to anyone willing to suffer it. Embercite, still hot in your hand.", item: "embercite_ore", qty: 4, xp: { skill: "mining", amount: 160 } }, lines: ["Cuttings worked in bursts, because no one can stand the heat for long. You have already stood one short shift here — a few scalding minutes was all you had in you."] },
  { id: "lm_tended_seam", kind: "shrine", x: 66, y: 96, name: "The Tended Seam", witnessOffering: { item: "embercite_ore", faithXp: 140 }, lines: ["A warm patch kept clean of debris by hands that leave offerings, not tools. The Cult witnesses here, laying embercite on the stone and standing the heat. Bring embercite of your own and stand your witness — the discomfort is the point."] },

  // === STREET DRESSING & THE COURIER WAYSTONES ==============================
  // Lamps (lit at night), fingerpost signs at the gates, and the Courier's
  // waystone network — pay a toll to ride between them (a gold sink + fast travel).

  // --- Ironvale street lamps (around the square, streets and gates) ---
  { id: "lamp_1", kind: "lamppost", x: 57, y: 49, name: "Street Lamp" },
  { id: "lamp_2", kind: "lamppost", x: 63, y: 49, name: "Street Lamp" },
  { id: "lamp_3", kind: "lamppost", x: 57, y: 55, name: "Street Lamp" },
  { id: "lamp_4", kind: "lamppost", x: 63, y: 55, name: "Street Lamp" },
  { id: "lamp_5", kind: "lamppost", x: 49, y: 52, name: "Street Lamp" },
  { id: "lamp_6", kind: "lamppost", x: 71, y: 52, name: "Street Lamp" },
  { id: "lamp_7", kind: "lamppost", x: 60, y: 41, name: "Gate Lamp" },
  { id: "lamp_8", kind: "lamppost", x: 60, y: 64, name: "Gate Lamp" },

  // --- Fingerpost signs at the city's approaches ---
  { id: "sign_west", kind: "signpost", x: 42, y: 54, name: "Fingerpost", lines: ["◀ GREYOAK WOOD — the Lodge road.   IRONVALE ▶, the gate behind you."] },
  { id: "sign_north", kind: "signpost", x: 57, y: 35, name: "Fingerpost", lines: ["▲ THE SPINE — the high pass, and the Marrow caves beyond.   IRONVALE ▼."] },
  { id: "sign_south", kind: "signpost", x: 62, y: 70, name: "Fingerpost", lines: ["▼ THE ASHFEN FLATS, and the HEARTMOOR away south-west.   IRONVALE ▲."] },
  { id: "sign_east", kind: "signpost", x: 84, y: 52, name: "Fingerpost", lines: ["▶ THE REDRUN and the river road to the sea.   IRONVALE ◀."] },

  // --- The Duel Ring: opt-in staked PvP, on the open stone shoulder by the
  //     north gate (a natural arena outside the walls, in Captain Morn's sight). ---
  { id: "duel_board", kind: "signpost", x: 63, y: 33, name: "The Duel Ring", lines: ["THE DUEL RING — chalk a circle, name your stakes, and let the ground decide. Gold and gear both welcome; the winner walks away with everything wagered. Opt-in only — no one is dragged into a fight here."] },
  { id: "duel_wins_board", kind: "signpost", x: 61, y: 33, name: "The Wins Board", lines: ["THE WINS BOARD — the ring keeps score. Every duellist's victories and losses, chalked up for all of Varath to see."] },

  // --- The Courier waystones (one in the city, one per region) ---
  { id: "ws_ironvale", kind: "waystone", x: 58, y: 50, name: "Ironvale", target: { x: 57, y: 50 } },
  { id: "ws_greyoak", kind: "waystone", x: 20, y: 53, name: "Greyoak Wood", target: { x: 21, y: 53 } },
  { id: "ws_spine", kind: "waystone", x: 44, y: 8, name: "The Spine", target: { x: 43, y: 7 } },
  { id: "ws_heartmoor", kind: "waystone", x: 19, y: 82, name: "Heartmoor", target: { x: 18, y: 81 } },
  { id: "ws_ashfen", kind: "waystone", x: 62, y: 86, name: "Ashfen Flats", target: { x: 61, y: 87 } },
  { id: "ws_marrow", kind: "waystone", x: 90, y: 15, name: "The Marrow Deeps", target: { x: 89, y: 14 } },
  { id: "ws_redrun", kind: "waystone", x: 90, y: 70, name: "The Redrun", target: { x: 91, y: 71 } },

  // === OUTPOST BANK CHESTS — regional banking at the populated outposts ======
  // The only other bank is in Ironvale (bank_1). A strongbox at each far-flung
  // settlement spares the long haul back to the city, without over-banking the
  // map: north (the Fold), east (Redmouth), south (the Drover's Rest) and the
  // south-west moor (Calder's camp). Greyoak Wood is left out — it sits right
  // beside the city's west gate — and the deep wilds stay bankless on purpose.
  { id: "bank_fold", kind: "bank", x: 63, y: 13, name: "Strongbox" },
  { id: "bank_redmouth", kind: "bank", x: 86, y: 60, name: "Strongbox" },
  { id: "bank_drover", kind: "bank", x: 69, y: 76, name: "Strongbox" },
  { id: "bank_heartmoor", kind: "bank", x: 16, y: 83, name: "Strongbox" },

  // === Skilling destinations: dense, full-ladder training grounds, each with
  //     its own strongbox so you can train a skill 1→99 in one place. ===
  // --- The Knuckle Deeps: a mining cavern with every ore tier (NE cave). ---
  { id: "kd_bank", kind: "bank", x: 89, y: 18, name: "Deeps Strongbox" },
  { id: "kd_sign", kind: "signpost", x: 90, y: 21, name: "The Knuckle Deeps", lines: ["THE KNUCKLE DEEPS — every seam in Varath, worked under one roof of stone."] },
  { id: "kd_rock_1", kind: "rock", x: 82, y: 10, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "kd_rock_2", kind: "rock", x: 82, y: 23, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "kd_rock_3", kind: "rock", x: 83, y: 22, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "kd_rock_4", kind: "rock", x: 84, y: 14, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "kd_rock_5", kind: "rock", x: 85, y: 7, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "kd_rock_6", kind: "rock", x: 85, y: 17, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "kd_rock_7", kind: "rock", x: 86, y: 13, name: "Silica Seam", resource: "mine_silica" },
  { id: "kd_rock_8", kind: "rock", x: 86, y: 25, name: "Silica Seam", resource: "mine_silica" },
  { id: "kd_rock_9", kind: "rock", x: 87, y: 14, name: "Silica Seam", resource: "mine_silica" },
  { id: "kd_rock_10", kind: "rock", x: 87, y: 25, name: "Embercite Rock", resource: "mine_embercite" },
  { id: "kd_rock_11", kind: "rock", x: 88, y: 14, name: "Embercite Rock", resource: "mine_embercite" },
  { id: "kd_rock_12", kind: "rock", x: 89, y: 11, name: "Embercite Rock", resource: "mine_embercite" },
  { id: "kd_rock_13", kind: "rock", x: 89, y: 26, name: "Ashiron Rock", resource: "mine_ashiron" },
  { id: "kd_rock_14", kind: "rock", x: 90, y: 14, name: "Ashiron Rock", resource: "mine_ashiron" },
  { id: "kd_rock_15", kind: "rock", x: 91, y: 8, name: "Ashiron Rock", resource: "mine_ashiron" },
  { id: "kd_rock_16", kind: "rock", x: 91, y: 21, name: "Ribstone Rock", resource: "mine_ribstone" },
  { id: "kd_rock_17", kind: "rock", x: 92, y: 20, name: "Ribstone Rock", resource: "mine_ribstone" },
  { id: "kd_rock_18", kind: "rock", x: 93, y: 7, name: "Ribstone Rock", resource: "mine_ribstone" },
  { id: "kd_rock_19", kind: "rock", x: 93, y: 25, name: "Gem Rock", resource: "mine_rough_gem" },
  { id: "kd_rock_20", kind: "rock", x: 94, y: 17, name: "Gem Rock", resource: "mine_rough_gem" },
  { id: "kd_rock_21", kind: "rock", x: 94, y: 26, name: "Gold Vein", resource: "mine_gold" },
  { id: "kd_rock_22", kind: "rock", x: 95, y: 16, name: "Gold Vein", resource: "mine_gold" },
  { id: "kd_rock_deep_1", kind: "rock", x: 86, y: 27, name: "Deep Embercite Seam", resource: "mine_embercite_deep" },
  { id: "kd_rock_rich_1", kind: "rock", x: 97, y: 16, name: "Rich Bloodore Vein", resource: "mine_bloodore_rich" },
  { id: "kd_rock_23", kind: "rock", x: 95, y: 25, name: "Bloodore Rock", resource: "mine_bloodore" },
  { id: "kd_rock_24", kind: "rock", x: 96, y: 14, name: "Bloodore Rock", resource: "mine_bloodore" },
  { id: "kd_rock_25", kind: "rock", x: 96, y: 25, name: "Voidstone Rock", resource: "mine_voidstone" },
  { id: "kd_rock_26", kind: "rock", x: 97, y: 16, name: "Voidstone Rock", resource: "mine_voidstone" },

  // --- The Old Wood: a forest with every tree species (NW, above Greyoak). ---
  { id: "ow_bank", kind: "bank", x: 15, y: 34, name: "Forester's Strongbox" },
  { id: "ow_sign", kind: "signpost", x: 17, y: 33, name: "The Old Wood", lines: ["THE OLD WOOD — ashwood to deeproot, every tree of the realm grows here."] },
  { id: "ow_tree_1", kind: "tree", x: 9, y: 28, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "ow_tree_2", kind: "tree", x: 10, y: 28, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "ow_tree_3", kind: "tree", x: 11, y: 28, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "ow_tree_4", kind: "tree", x: 12, y: 29, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "ow_tree_5", kind: "tree", x: 12, y: 37, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "ow_tree_6", kind: "tree", x: 13, y: 30, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "ow_tree_7", kind: "tree", x: 13, y: 39, name: "Coldpine Tree", resource: "fell_coldpine", species: "coldpine" },
  { id: "ow_tree_8", kind: "tree", x: 14, y: 32, name: "Coldpine Tree", resource: "fell_coldpine", species: "coldpine" },
  { id: "ow_tree_9", kind: "tree", x: 14, y: 40, name: "Coldpine Tree", resource: "fell_coldpine", species: "coldpine" },
  { id: "ow_tree_10", kind: "tree", x: 15, y: 35, name: "Stonewood Tree", resource: "fell_stonewood", species: "stonewood" },
  { id: "ow_tree_11", kind: "tree", x: 16, y: 28, name: "Stonewood Tree", resource: "fell_stonewood", species: "stonewood" },
  { id: "ow_tree_12", kind: "tree", x: 16, y: 36, name: "Stonewood Tree", resource: "fell_stonewood", species: "stonewood" },
  { id: "ow_tree_13", kind: "tree", x: 17, y: 30, name: "Greyoak Tree", resource: "fell_greyoak", species: "greyoak" },
  { id: "ow_tree_14", kind: "tree", x: 17, y: 39, name: "Greyoak Tree", resource: "fell_greyoak", species: "greyoak" },
  { id: "ow_tree_15", kind: "tree", x: 18, y: 32, name: "Greyoak Tree", resource: "fell_greyoak", species: "greyoak" },
  // Old-growth ironbark (Forestry 70) fills the 60→80 dead zone.
  { id: "ow_tree_old_1", kind: "tree", x: 17, y: 38, name: "Old-Growth Ironbark", resource: "fell_ironbark_old", species: "ironbark" },
  { id: "ow_tree_old_2", kind: "tree", x: 21, y: 36, name: "Old-Growth Ironbark", resource: "fell_ironbark_old", species: "ironbark" },
  { id: "ow_tree_16", kind: "tree", x: 18, y: 41, name: "Ironbark Tree", resource: "fell_ironbark", species: "ironbark" },
  { id: "ow_tree_17", kind: "tree", x: 19, y: 34, name: "Ironbark Tree", resource: "fell_ironbark", species: "ironbark" },
  { id: "ow_tree_18", kind: "tree", x: 19, y: 42, name: "Ironbark Tree", resource: "fell_ironbark", species: "ironbark" },
  { id: "ow_tree_19", kind: "tree", x: 20, y: 36, name: "Ruewood Tree", resource: "fell_ruewood", species: "ruewood" },
  { id: "ow_tree_20", kind: "tree", x: 21, y: 29, name: "Ruewood Tree", resource: "fell_ruewood", species: "ruewood" },
  { id: "ow_tree_21", kind: "tree", x: 21, y: 37, name: "Ruewood Tree", resource: "fell_ruewood", species: "ruewood" },
  { id: "ow_tree_22", kind: "tree", x: 22, y: 31, name: "Heartoak Tree", resource: "fell_heartoak", species: "heartoak" },
  { id: "ow_tree_23", kind: "tree", x: 22, y: 39, name: "Heartoak Tree", resource: "fell_heartoak", species: "heartoak" },
  { id: "ow_tree_24", kind: "tree", x: 23, y: 32, name: "Heartoak Tree", resource: "fell_heartoak", species: "heartoak" },
  { id: "ow_tree_25", kind: "tree", x: 23, y: 41, name: "Deeproot Tree", resource: "fell_deeproot", species: "deeproot" },
  { id: "ow_tree_26", kind: "tree", x: 24, y: 34, name: "Deeproot Tree", resource: "fell_deeproot", species: "deeproot" },

  // --- Anglers' Reach: the east lake stocked with every fish tier. ---
  { id: "ar_sign", kind: "signpost", x: 94, y: 68, name: "Anglers' Reach", lines: ["ANGLERS' REACH — the deepest water in Varath, and the strangest things in it."] },
  { id: "ar_fish_1", kind: "fishing_spot", x: 93, y: 81, name: "Ashfin Shoal", resource: "fish_ashfin" },
  { id: "ar_fish_2", kind: "fishing_spot", x: 94, y: 74, name: "Ashfin Shoal", resource: "fish_ashfin" },
  { id: "ar_fish_3", kind: "fishing_spot", x: 94, y: 77, name: "Ashfin Shoal", resource: "fish_ashfin" },
  { id: "ar_fish_4", kind: "fishing_spot", x: 94, y: 80, name: "Greyfin Shoal", resource: "fish_greyfin" },
  { id: "ar_fish_5", kind: "fishing_spot", x: 95, y: 69, name: "Greyfin Shoal", resource: "fish_greyfin" },
  { id: "ar_fish_6", kind: "fishing_spot", x: 95, y: 73, name: "Ribperch Shoal", resource: "fish_ribperch" },
  { id: "ar_fish_7", kind: "fishing_spot", x: 97, y: 60, name: "Ribperch Shoal", resource: "fish_ribperch" },
  { id: "ar_fish_8", kind: "fishing_spot", x: 98, y: 60, name: "Marsh Eel Shoal", resource: "fish_marsh_eel" },
  { id: "ar_fish_9", kind: "fishing_spot", x: 99, y: 62, name: "Marsh Eel Shoal", resource: "fish_marsh_eel" },
  { id: "ar_fish_10", kind: "fishing_spot", x: 99, y: 65, name: "Redgill Shoal", resource: "fish_redgill" },
  { id: "ar_fish_11", kind: "fishing_spot", x: 100, y: 68, name: "Redgill Shoal", resource: "fish_redgill" },
  { id: "ar_fish_12", kind: "fishing_spot", x: 100, y: 71, name: "Deepscale Shoal", resource: "fish_deepscale" },
  { id: "ar_fish_13", kind: "fishing_spot", x: 101, y: 75, name: "Deepscale Shoal", resource: "fish_deepscale" },
  { id: "ar_fish_14", kind: "fishing_spot", x: 101, y: 78, name: "Eyeless Pike Shoal", resource: "fish_eyeless_pike" },

  // === The Ashen Wyrm: Varath's flagship boss, lairing deep in the Marrow Deeps. =
  { id: "wyrm_sign", kind: "signpost", x: 95, y: 13, name: "Cindrath's Roost", lines: ["CINDRATH'S ROOST — the deep gallery ahead is where the wyrm sleeps. Turn back unless you've come to kill a dragon. Bring a stabbing weapon."] },
  { id: "ashen_wyrm_1", kind: "monster", x: 97, y: 13, name: "Cindrath, the Ashen Wyrm", monster: "ashen_wyrm" },

  // === The Boneman: a mid-tier quest boss in a hidden hollow of the old wood.
  // Hidden until the Bone Collector quest tracks the killer to his lair (the
  // boneman_revealed flag). A crushing weapon shatters his bone armour best. ===
  { id: "bonefield_sign", kind: "signpost", x: 14, y: 62, name: "The Bonefield", requiresFlag: "boneman_revealed", lines: ["THE BONEFIELD — a clearing the wood grew around. Small cairns of stacked bone stand in rows, each one a person. Crushing weapons fare best against what made them."] },
  { id: "boneman_1", kind: "monster", x: 17, y: 62, name: "The Boneman", monster: "boneman", requiresFlag: "boneman_revealed" },
  // Bone-cairns ringing the clearing — his trophies, one per victim.
  { id: "bone_cairn_1", kind: "bone_cairn", x: 15, y: 60, name: "Bone Cairn", requiresFlag: "boneman_revealed" },
  { id: "bone_cairn_2", kind: "bone_cairn", x: 19, y: 60, name: "Bone Cairn", requiresFlag: "boneman_revealed" },
  { id: "bone_cairn_3", kind: "bone_cairn", x: 13, y: 64, name: "Bone Cairn", requiresFlag: "boneman_revealed" },
  { id: "bone_cairn_4", kind: "bone_cairn", x: 20, y: 62, name: "Bone Cairn", requiresFlag: "boneman_revealed" },
  { id: "bone_cairn_5", kind: "bone_cairn", x: 15, y: 64, name: "Bone Cairn", requiresFlag: "boneman_revealed" },
  { id: "bone_cairn_6", kind: "bone_cairn", x: 19, y: 64, name: "Bone Cairn", requiresFlag: "boneman_revealed" },
  { id: "bone_cairn_7", kind: "bone_cairn", x: 16, y: 59, name: "Bone Cairn", requiresFlag: "boneman_revealed" },

  // === The Boneman's trail: skulls and bone-piles scattered the length of
  // Varath. Always present (no flag) — breadcrumbs that foreshadow the killer
  // and, examined, hint toward the deep western wood and the Ironvale watch. ===
  { id: "trail_bone_1", kind: "bone_cairn", x: 44, y: 33, name: "Stacked Bones", lines: ["A traveller's bones, picked clean and stacked too neatly to be any animal's doing. Someone arranged these."] },
  { id: "trail_bone_2", kind: "bone_cairn", x: 70, y: 22, name: "A Skull", lines: ["A skull wedged in the fork of a tree, facing the road. A marker, or a warning. Someone wants it found."] },
  { id: "trail_bone_3", kind: "bone_cairn", x: 40, y: 44, name: "A Row of Bones", lines: ["Long bones laid out in a careful row at the wood's edge. No grave, no name — just the tidiness of a patient hand."] },
  { id: "trail_bone_4", kind: "bone_cairn", x: 34, y: 68, name: "Bones by the Water", lines: ["Bones in the river shallows, the skull taken, the rest left. Whoever did this only wanted the head of it."] },
  { id: "trail_bone_5", kind: "bone_cairn", x: 42, y: 82, name: "Disturbed Remains", lines: ["The bog gave back a body, and someone took its bones before it could be buried. Fresh tracks lead off to the west."] },
  { id: "trail_bone_6", kind: "bone_cairn", x: 50, y: 72, name: "A Lone Cairn", lines: ["A cairn of stacked bone on the open ground, miles from any barrow. The quiet roads haven't been safe for years."] },
  { id: "trail_bone_7", kind: "bone_cairn", x: 24, y: 72, name: "An Offering", lines: ["A skull set atop a cairn like an offering. The moor folk won't say who leaves them, only that they do."] },
  { id: "trail_bone_8", kind: "bone_cairn", x: 33, y: 90, name: "More Bones", lines: ["More bones, more skulls. They turn up the length of Varath now — always the bones taken, never the rest."] },
  { id: "trail_bone_9", kind: "bone_cairn", x: 12, y: 74, name: "Clean White Bone", lines: ["A heap of clean white bone. The hill-folk call the one who does this the Boneman, and say it like a prayer against him."] },
  { id: "trail_bone_10", kind: "bone_cairn", x: 80, y: 72, name: "A Grinning Skull", lines: ["A skull grins up from the grass, far from any road. Whoever carried it here wasn't lost — they were hunting."] },
  { id: "trail_bone_11", kind: "bone_cairn", x: 26, y: 40, name: "Bones Pointing West", lines: ["Bones stacked at the treeline, the long ones laid pointing into the deep wood to the west. As if to say: this way."] },
  { id: "trail_bone_12", kind: "bone_cairn", x: 18, y: 70, name: "Cracked Marrow", lines: ["A traveller's remains, the marrow cracked from every bone. Someone fed here, and was in no hurry about it."] },
  { id: "trail_bone_13", kind: "bone_cairn", x: 68, y: 88, name: "Skull in the Cinders", lines: ["Even the ash flats have them — a skull half-sunk in the cinders. The killer's range is the whole of Varath."] },
  { id: "trail_bone_14", kind: "bone_cairn", x: 38, y: 58, name: "Arranged Bones", lines: ["Bones arranged in the grass near the wood. The Ironvale watch knows of it, off the record — ask the off-duty guard."] },
  { id: "trail_bone_15", kind: "bone_cairn", x: 74, y: 30, name: "A Stack of Skulls", lines: ["A neat stack of skulls by the field path. Honest folk leave flowers for their dead. This is something else entirely."] },

  // === The Green Baron: a mid-tier RANGED quest boss in a hidden Greyoak glade.
  // Hidden until The False Hood quest has Lenne lead you in (green_baron_revealed).
  // Close fast — he is lethal at range and brittle to a crushing blow. ===
  { id: "baron_glade_sign", kind: "signpost", x: 39, y: 32, name: "The Hollow Oak", requiresFlag: "green_baron_revealed", lines: ["THE HOLLOW OAK — a glade the Greyoak grew a wall around. Camp-ash, coin-scales, and a chair of antler and rope. The outlaw who calls himself a baron holds court here. Close the distance fast and bring something that crushes."] },
  { id: "green_baron_1", kind: "monster", x: 38, y: 32, name: "The Green Baron", monster: "green_baron", requiresFlag: "green_baron_revealed" },

  // The Baron's legend — road-rumours the length of the Greyoak. Always present:
  // breadcrumbs that foreshadow the outlaw and point toward Maret at the Lodge. ===
  { id: "baron_rumor_1", kind: "signpost", x: 43, y: 25, name: "A Nailed Notice", lines: ["A hand-copied ballad nailed to a post — 'The Green Baron, who robs the fat and feeds the lean.' Someone has scratched underneath: LIES. He robbed my whole cart and left my boy in the ditch."] },
  { id: "baron_rumor_2", kind: "signpost", x: 29, y: 31, name: "A Robbed Cart", lines: ["A drover's cart, wheels gone, strongbox split open. A black-fletched arrow is driven into the seat like a signature. The Greyoak Lodge keeps a tally of these — ask Maret."] },
  { id: "baron_rumor_3", kind: "signpost", x: 24, y: 33, name: "A Warning Post", lines: ["THE ROAD PAST HERE IS THE BARON'S. Pay the toll at the treeline or keep your coin and lose the rest. He was a hero once, the old songs say. The songs are out of date."] },

  // === The Hollow Prophet: a mid-tier DEVOTION quest boss in a hidden Heartmoor
  // hollow. Hidden until The Hollow Prophet quest sends you to his rite
  // (hollow_prophet_revealed). Bring a bow — melee only lets him mend. ===
  { id: "prophet_rite_sign", kind: "signpost", x: 72, y: 95, name: "The Weeping Circle", requiresFlag: "hollow_prophet_revealed", lines: ["THE WEEPING CIRCLE — moor-grass worn to bare peat in a ring ten thousand prayers wide. At its centre a man kneels to a seam of Orun's light, and the light kneels back. Ranged shots hound him; melee only lets him mend."] },
  { id: "hollow_prophet_1", kind: "monster", x: 72, y: 96, name: "The Hollow Prophet", monster: "hollow_prophet", requiresFlag: "hollow_prophet_revealed" },

  // The Prophet's word — sermons and warnings on the moor roads. Always present:
  // breadcrumbs that foreshadow the cult's mad founder and point toward Calder. ===
  { id: "prophet_rumor_1", kind: "signpost", x: 60, y: 88, name: "A Sermon Stone", lines: ["A flat stone painted with a spiral eye and a scrawl: 'THE SEAM IS A MOUTH AND I HAVE TAUGHT IT MY NAME.' The Heartmoor faithful step around these. Calder can tell you whose hand made them."] },
  { id: "prophet_rumor_2", kind: "signpost", x: 45, y: 96, name: "A Bound Effigy", lines: ["A figure of reed and hex-cloth lashed to a stake, its face a smear of pale wax. An offering, or a threat. The cult that feeds the poor did not make this — but something inside the cult did."] },
  { id: "prophet_rumor_3", kind: "signpost", x: 42, y: 97, name: "A Prayer Circle", lines: ["Stones set in a ring, the grass inside dead and grey. Whatever was called here answered. Calder at the moor-fire names the one who does this the Hollow Prophet, and won't meet your eye when he says it."] },

  // === Survivalist: forage clumps you search for herbs, mushrooms & roots ===
  // --- Forager's Hollow: the full ladder in one wild pocket (west moor). ---
  { id: "fh_sign", kind: "signpost", x: 30, y: 58, name: "Forager's Hollow", lines: ["FORAGER'S HOLLOW — fibre and mushrooms to dawnspore, all of it grows wild here."] },
  { id: "fg_fiber_1", kind: "forage_spot", x: 30, y: 59, name: "Fibreweed", resource: "surv_forage_fiber" },
  { id: "fg_fiber_2", kind: "forage_spot", x: 31, y: 58, name: "Fibreweed", resource: "surv_forage_fiber" },
  { id: "fg_mushroom_3", kind: "forage_spot", x: 32, y: 58, name: "Mushroom Cluster", resource: "surv_forage_mushroom" },
  { id: "fg_mushroom_4", kind: "forage_spot", x: 32, y: 69, name: "Mushroom Cluster", resource: "surv_forage_mushroom" },
  { id: "fg_thornberry_5", kind: "forage_spot", x: 33, y: 69, name: "Thornberry Bramble", resource: "surv_forage_thornberry" },
  { id: "fg_thornberry_6", kind: "forage_spot", x: 34, y: 69, name: "Thornberry Bramble", resource: "surv_forage_thornberry" },
  { id: "fg_hearthroot_7", kind: "forage_spot", x: 35, y: 68, name: "Hearthroot Tangle", resource: "surv_forage_hearthroot" },
  { id: "fg_hearthroot_8", kind: "forage_spot", x: 37, y: 58, name: "Hearthroot Tangle", resource: "surv_forage_hearthroot" },
  { id: "fg_nightshade_9", kind: "forage_spot", x: 38, y: 59, name: "Nightshade Patch", resource: "surv_forage_nightshade" },
  { id: "fg_deepmoss_10", kind: "forage_spot", x: 39, y: 61, name: "Deepmoss Bed", resource: "surv_forage_deepmoss" },
  { id: "fg_ashroot_11", kind: "forage_spot", x: 40, y: 63, name: "Ashroot Snarl", resource: "surv_forage_ashroot" },
  { id: "fg_ashbloom_12", kind: "forage_spot", x: 41, y: 64, name: "Ashbloom Stand", resource: "surv_forage_ashbloom" },
  { id: "fg_dawnspore_13", kind: "forage_spot", x: 42, y: 66, name: "Dawnspore Ring", resource: "surv_forage_dawnspore" },
  // Orunbloom (90) — the capstone forage, where Orun's seam surfaces. Fills
  // Survivalist's empty 81-100 band with a real gather node, not flat grind.
  { id: "fg_orunbloom_1", kind: "forage_spot", x: 40, y: 67, name: "Orunbloom Glade", resource: "surv_forage_orunbloom" },
  { id: "fg_orunbloom_2", kind: "forage_spot", x: 38, y: 63, name: "Orunbloom Glade", resource: "surv_forage_orunbloom" },
  // --- A couple of early clumps closer to the roads, for new foragers. ---
  { id: "fg_mushroom_near", kind: "forage_spot", x: 46, y: 37, name: "Mushroom Cluster", resource: "surv_forage_mushroom" },
  { id: "fg_fiber_near", kind: "forage_spot", x: 51, y: 33, name: "Fibreweed", resource: "surv_forage_fiber" },

  // === WILDLIFE — ambient critters (wander, flee, don't block) ==============
  // City strays + birds:
  { id: "cr_cat", kind: "critter", species: "cat", x: 58, y: 60, name: "A Cat" },
  { id: "cr_pigeon1", kind: "critter", species: "crow", x: 61, y: 54, name: "Pigeons" },
  { id: "cr_bfly_city", kind: "critter", species: "butterfly", x: 69, y: 59, name: "A Butterfly" },
  // Knuckle Hills (around the city):
  { id: "cr_hare1", kind: "critter", species: "rabbit", x: 48, y: 30, name: "A Moor Hare" },
  { id: "cr_hare2", kind: "critter", species: "rabbit", x: 72, y: 31, name: "A Moor Hare" },
  { id: "cr_crow1", kind: "critter", species: "crow", x: 63, y: 25, name: "A Crow" },
  { id: "cr_sheep1", kind: "critter", species: "sheep", x: 50, y: 34, name: "A Hill Sheep" },
  { id: "cr_bfly_hill", kind: "critter", species: "butterfly", x: 58, y: 27, name: "Butterflies" },
  // Greyoak Wood:
  { id: "cr_deer1", kind: "critter", species: "deer", x: 16, y: 52, name: "A Roe Deer" },
  { id: "cr_deer2", kind: "critter", species: "deer", x: 24, y: 58, name: "A Roe Deer" },
  { id: "cr_hare3", kind: "critter", species: "rabbit", x: 10, y: 50, name: "A Wood Hare" },
  { id: "cr_crow2", kind: "critter", species: "crow", x: 27, y: 48, name: "A Crow" },
  // The Spine (the walkable pass):
  { id: "cr_crow3", kind: "critter", species: "crow", x: 43, y: 9, name: "A Crag Crow" },
  { id: "cr_sheep2", kind: "critter", species: "sheep", x: 45, y: 13, name: "A Mountain Goat" },
  // Heartmoor:
  { id: "cr_frog1", kind: "critter", species: "frog", x: 18, y: 86, name: "A Marsh Frog" },
  { id: "cr_frog2", kind: "critter", species: "frog", x: 26, y: 91, name: "A Marsh Frog" },
  { id: "cr_duck1", kind: "critter", species: "duck", x: 14, y: 89, name: "A Moor Duck" },
  { id: "cr_heron", kind: "critter", species: "crow", x: 22, y: 88, name: "A Bog Heron" },
  // Ashfen Flats:
  { id: "cr_bfly_ash", kind: "critter", species: "butterfly", x: 56, y: 88, name: "Ash-Moths" },
  { id: "cr_crow4", kind: "critter", species: "crow", x: 61, y: 95, name: "A Crow" },
  // The Redrun banks:
  { id: "cr_duck2", kind: "critter", species: "duck", x: 91, y: 66, name: "A River Duck" },
  { id: "cr_duck3", kind: "critter", species: "duck", x: 92, y: 74, name: "A River Duck" },
  { id: "cr_frog3", kind: "critter", species: "frog", x: 95, y: 78, name: "A River Frog" },
  { id: "cr_crow5", kind: "critter", species: "crow", x: 96, y: 68, name: "A River Crow" },

  // === BOSS ARENAS (sealed band below the overworld) ========================
  // (The Bog Warden's arena is retired — the Warden and its pack now hold an
  // open lair on the moor; see the Heartmoor section above.)
  { id: "bog_add1", kind: "monster", monster: "heartmoor_hound", x: 21, y: 105, name: "Warden's Hound" },
  { id: "bog_add2", kind: "monster", monster: "bog_knight", x: 27, y: 105, name: "Sunken Knight" },
  // The Spine Warlord, moved OUT of its single-room arena to an open lair on a
  // shelf of the pass — a grindable overworld boss now (its old portal leads to
  // the rebuilt Spine Vault crawl; see buildDungeonSites).
  { id: "boss_spine", kind: "monster", monster: "spine_warlord", x: 44, y: 16, name: "The Spine Warlord" },
  { id: "spine_add1", kind: "monster", monster: "stone_crawler", x: 37, y: 117, name: "Vault Crawler" },
  { id: "spine_add2", kind: "monster", monster: "mountain_troll", x: 43, y: 117, name: "Guard Troll" },
  { id: "ret_marrow", kind: "portal", x: 56, y: 119, name: "Vault Exit", target: { x: 91, y: 14 }, lines: ["The door closes behind you."] },
  { id: "boss_marrow", kind: "monster", monster: "marrow_keeper", x: 56, y: 115, name: "The Marrow Keeper" },
  // --- The Marrow Delve: a wave gauntlet run inside the vault. The Warden
  // starts a run (START_DELVE); each wave's spawns are flag-gated (the core
  // sets/clears delve_wave_N as waves fall); wave 4 is the Horror, and the
  // Delve Cache pays out on its death. ---
  {
    id: "delve_warden", kind: "npc", x: 55, y: 118, name: "The Delve Warden",
    lines: [
      "Below this floor there are older floors. The vault was built on something's ceiling.",
      "I open the way down for those who ask, and I write their names in this book. Some of the names have a second date. Not all.",
      "Four waves. The dark, the dead, the stone, and the thing they answer to. Clear all four and the Delve pays — the cache is richest once a rest, so don't waste your best hour.",
    ],
  },
  { id: "delve_w1_a", kind: "monster", monster: "deep_bat", x: 54, y: 116, name: "Delve Shrieker", requiresFlag: "delve_wave_1" },
  { id: "delve_w1_b", kind: "monster", monster: "deep_bat", x: 58, y: 116, name: "Delve Shrieker", requiresFlag: "delve_wave_1" },
  { id: "delve_w2_a", kind: "monster", monster: "marrow_wraith", x: 54, y: 116, name: "Delve Revenant", requiresFlag: "delve_wave_2" },
  { id: "delve_w2_b", kind: "monster", monster: "marrow_wraith", x: 58, y: 116, name: "Delve Revenant", requiresFlag: "delve_wave_2" },
  { id: "delve_w3_a", kind: "monster", monster: "deep_golem", x: 56, y: 116, name: "Delve Sentinel", requiresFlag: "delve_wave_3" },
  { id: "delve_w4_boss", kind: "monster", monster: "delve_horror", x: 56, y: 115, name: "The Delve Horror", requiresFlag: "delve_wave_4" },
  { id: "marrow_add1", kind: "monster", monster: "cave_crawler", x: 53, y: 117, name: "Deep Crawler" },
  { id: "marrow_add2", kind: "monster", monster: "marrow_wraith", x: 59, y: 117, name: "Vault Wraith" },
  // The Dread Ferryman's flooded cave (arena slot x=66). You climb down to him.
  { id: "ret_ferryman", kind: "portal", x: 72, y: 117, name: "Cave Mouth", target: { x: 109, y: 60 }, lines: ["You climb back up to the daylight and the cold hills."] },
  { id: "boss_ferryman", kind: "monster", monster: "dread_ferryman", x: 72, y: 113, name: "The Dread Ferryman" },
  { id: "ferryman_add1", kind: "monster", monster: "river_serpent", x: 69, y: 115, name: "Drowned Serpent" },
  { id: "ferryman_add2", kind: "monster", monster: "redrun_brigand", x: 75, y: 115, name: "Stranded Brigand" },

  // --- Audit fix: gathering nodes the action graph assumed but never spawned ---
  // (gold + silica ore, and the high-tier Forestry trees above Greyoak). Tiles
  // chosen by the placement finder: each sits on land with a reachable adjacent
  // walkable tile, validated against buildWalkability + a spawn-reachability BFS.
  { id: "silica_1", kind: "rock", x: 91, y: 61, name: "Silica Sands", resource: "mine_silica" },
  { id: "silica_2", kind: "rock", x: 95, y: 60, name: "Silica Sands", resource: "mine_silica" },
  { id: "silica_3", kind: "rock", x: 94, y: 66, name: "Silica Sands", resource: "mine_silica" },
  { id: "gold_1", kind: "rock", x: 44, y: 16, name: "Gold Vein", resource: "mine_gold" },
  { id: "gold_2", kind: "rock", x: 48, y: 18, name: "Gold Vein", resource: "mine_gold" },
  { id: "gold_3", kind: "rock", x: 46, y: 16, name: "Gold Vein", resource: "mine_gold" },
  { id: "tree_stonewood_1", kind: "tree", x: 10, y: 46, name: "Stonewood", resource: "fell_stonewood", species: "stonewood" },
  { id: "tree_stonewood_2", kind: "tree", x: 11, y: 46, name: "Stonewood", resource: "fell_stonewood", species: "stonewood" },
  { id: "tree_stonewood_3", kind: "tree", x: 12, y: 46, name: "Stonewood", resource: "fell_stonewood", species: "stonewood" },
  { id: "tree_ironbark_1", kind: "tree", x: 28, y: 48, name: "Ironbark", resource: "fell_ironbark", species: "ironbark" },
  { id: "tree_ironbark_2", kind: "tree", x: 29, y: 48, name: "Ironbark", resource: "fell_ironbark", species: "ironbark" },
  { id: "tree_ironbark_3", kind: "tree", x: 27, y: 49, name: "Ironbark", resource: "fell_ironbark", species: "ironbark" },
  { id: "tree_ruewood_1", kind: "tree", x: 9, y: 56, name: "Ruewood", resource: "fell_ruewood", species: "ruewood" },
  { id: "tree_ruewood_2", kind: "tree", x: 10, y: 56, name: "Ruewood", resource: "fell_ruewood", species: "ruewood" },
  { id: "tree_ruewood_3", kind: "tree", x: 11, y: 56, name: "Ruewood", resource: "fell_ruewood", species: "ruewood" },
  { id: "tree_heartoak_1", kind: "tree", x: 29, y: 55, name: "Heartoak", resource: "fell_heartoak", species: "heartoak" },
  { id: "tree_heartoak_2", kind: "tree", x: 30, y: 55, name: "Heartoak", resource: "fell_heartoak", species: "heartoak" },
  { id: "tree_deeproot_1", kind: "tree", x: 23, y: 59, name: "Deeproot", resource: "fell_deeproot", species: "deeproot" },
  { id: "tree_deeproot_2", kind: "tree", x: 24, y: 59, name: "Deeproot", resource: "fell_deeproot", species: "deeproot" },

  // --- Agility courses: two circuits trained by clearing each leg in order ---
  // A beginner yard just outside Ironvale (NE), and a tougher Knuckle Hills
  // scramble (NW, Agility 20+). Tiles + exits validated reachable.
  { id: "course_yard_0", kind: "agility_obstacle", x: 73, y: 31, name: "Ironvale Training Yard: Balance Log", course: "course_yard", order: 0, exit: { x: 74, y: 31 }, xp: 40, levelReq: 1, obstacle: "log" },
  { id: "course_yard_1", kind: "agility_obstacle", x: 75, y: 32, name: "Ironvale Training Yard: Climbing Net", course: "course_yard", order: 1, exit: { x: 75, y: 33 }, xp: 40, levelReq: 1, obstacle: "net" },
  { id: "course_yard_2", kind: "agility_obstacle", x: 75, y: 37, name: "Ironvale Training Yard: Rope Swing", course: "course_yard", order: 2, exit: { x: 74, y: 37 }, xp: 40, levelReq: 1, obstacle: "rope" },
  { id: "course_yard_3", kind: "agility_obstacle", x: 71, y: 37, name: "Ironvale Training Yard: Wall Scramble", course: "course_yard", order: 3, exit: { x: 71, y: 36 }, xp: 40, levelReq: 1, obstacle: "wall" },
  { id: "course_yard_4", kind: "agility_obstacle", x: 70, y: 33, name: "Ironvale Training Yard: Stepping Stones", course: "course_yard", order: 4, exit: { x: 71, y: 33 }, xp: 40, levelReq: 1, obstacle: "stones" },
  { id: "course_scramble_0", kind: "agility_obstacle", x: 18, y: 21, name: "Knuckle Hills Scramble: Balance Log", course: "course_scramble", order: 0, exit: { x: 19, y: 21 }, xp: 100, levelReq: 20, obstacle: "log" },
  { id: "course_scramble_1", kind: "agility_obstacle", x: 21, y: 23, name: "Knuckle Hills Scramble: Climbing Net", course: "course_scramble", order: 1, exit: { x: 21, y: 24 }, xp: 100, levelReq: 20, obstacle: "net" },
  { id: "course_scramble_2", kind: "agility_obstacle", x: 20, y: 27, name: "Knuckle Hills Scramble: Rope Swing", course: "course_scramble", order: 2, exit: { x: 19, y: 27 }, xp: 100, levelReq: 20, obstacle: "rope" },
  { id: "course_scramble_3", kind: "agility_obstacle", x: 16, y: 27, name: "Knuckle Hills Scramble: Wall Scramble", course: "course_scramble", order: 3, exit: { x: 16, y: 26 }, xp: 100, levelReq: 20, obstacle: "wall" },
  { id: "course_scramble_4", kind: "agility_obstacle", x: 15, y: 23, name: "Knuckle Hills Scramble: Stepping Stones", course: "course_scramble", order: 4, exit: { x: 16, y: 23 }, xp: 100, levelReq: 20, obstacle: "stones" },
  // A third, mid-tier course in Greyoak Wood (Agility 40+) — fills the long gap
  // above the Knuckle scramble. Tiles validated reachable with reachable exits.
  // Shifted to the south-east of the wood — clear of both the Lodgehold steading
  // (to the west) and the coldpine/ironbark stands (to the north) it overlapped.
  { id: "course_greyoak_0", kind: "agility_obstacle", x: 28, y: 53, name: "Greyoak Run: Balance Log", course: "course_greyoak", order: 0, exit: { x: 29, y: 53 }, xp: 200, levelReq: 40, obstacle: "log" },
  { id: "course_greyoak_1", kind: "agility_obstacle", x: 31, y: 53, name: "Greyoak Run: Climbing Net", course: "course_greyoak", order: 1, exit: { x: 31, y: 54 }, xp: 200, levelReq: 40, obstacle: "net" },
  { id: "course_greyoak_2", kind: "agility_obstacle", x: 33, y: 55, name: "Greyoak Run: Rope Swing", course: "course_greyoak", order: 2, exit: { x: 33, y: 56 }, xp: 200, levelReq: 40, obstacle: "rope" },
  { id: "course_greyoak_3", kind: "agility_obstacle", x: 30, y: 57, name: "Greyoak Run: Wall Scramble", course: "course_greyoak", order: 3, exit: { x: 29, y: 57 }, xp: 200, levelReq: 40, obstacle: "wall" },
  { id: "course_greyoak_4", kind: "agility_obstacle", x: 28, y: 58, name: "Greyoak Run: Stepping Stones", course: "course_greyoak", order: 4, exit: { x: 28, y: 57 }, xp: 200, levelReq: 40, obstacle: "stones" },
  // A fourth, expert course out on the Ashfen Flats (Agility 70+) — the hardest
  // fixed circuit, a big per-lap payout for those near the cap.
  { id: "course_ashfen_0", kind: "agility_obstacle", x: 64, y: 83, name: "Ashfen Gauntlet: Balance Log", course: "course_ashfen", order: 0, exit: { x: 65, y: 83 }, xp: 360, levelReq: 70, obstacle: "log" },
  { id: "course_ashfen_1", kind: "agility_obstacle", x: 67, y: 83, name: "Ashfen Gauntlet: Climbing Net", course: "course_ashfen", order: 1, exit: { x: 67, y: 84 }, xp: 360, levelReq: 70, obstacle: "net" },
  { id: "course_ashfen_2", kind: "agility_obstacle", x: 69, y: 85, name: "Ashfen Gauntlet: Rope Swing", course: "course_ashfen", order: 2, exit: { x: 69, y: 86 }, xp: 360, levelReq: 70, obstacle: "rope" },
  { id: "course_ashfen_3", kind: "agility_obstacle", x: 66, y: 87, name: "Ashfen Gauntlet: Wall Scramble", course: "course_ashfen", order: 3, exit: { x: 65, y: 87 }, xp: 360, levelReq: 70, obstacle: "wall" },
  { id: "course_ashfen_4", kind: "agility_obstacle", x: 64, y: 85, name: "Ashfen Gauntlet: Stepping Stones", course: "course_ashfen", order: 4, exit: { x: 64, y: 84 }, xp: 360, levelReq: 70, obstacle: "stones" },
  // A fifth, grandmaster circuit — the Ashfen High Line (Agility 85+) — the last
  // fixed course, filling the empty 70→cap band. Set just east of the Gauntlet on
  // the same flats (validated-walkable terrain), the biggest per-lap payout of all.
  { id: "course_highline_0", kind: "agility_obstacle", x: 72, y: 84, name: "Ashfen High Line: Balance Log", course: "course_highline", order: 0, exit: { x: 73, y: 84 }, xp: 470, levelReq: 85, obstacle: "log" },
  { id: "course_highline_1", kind: "agility_obstacle", x: 75, y: 84, name: "Ashfen High Line: Climbing Net", course: "course_highline", order: 1, exit: { x: 75, y: 85 }, xp: 470, levelReq: 85, obstacle: "net" },
  { id: "course_highline_2", kind: "agility_obstacle", x: 77, y: 86, name: "Ashfen High Line: Rope Swing", course: "course_highline", order: 2, exit: { x: 77, y: 87 }, xp: 470, levelReq: 85, obstacle: "rope" },
  { id: "course_highline_3", kind: "agility_obstacle", x: 74, y: 87, name: "Ashfen High Line: Wall Scramble", course: "course_highline", order: 3, exit: { x: 73, y: 87 }, xp: 470, levelReq: 85, obstacle: "wall" },
  { id: "course_highline_4", kind: "agility_obstacle", x: 72, y: 86, name: "Ashfen High Line: Stepping Stones", course: "course_highline", order: 4, exit: { x: 72, y: 85 }, xp: 470, levelReq: 85, obstacle: "stones" },

  // === THE VARATHIAN TRAIL — a whole-map agility circuit (Agility 50+) =========
  // Eight checkpoints ringing the outskirts, one in each region. They must be
  // cleared in order (0 → 7); the last completes a LAP, paying a huge XP dump and
  // a purse of Agility Marks redeemable with the Trailkeeper for the Trailblazer
  // outfit. Authored in final map coordinates (the "trail_" prefix skips remap).
  { id: "trail_cp0", kind: "agility_obstacle", x: 57, y: 10, name: "Varathian Trail: Spine Ice-Ledge", course: "course_varath_trail", order: 0, exit: { x: 58, y: 10 }, xp: 250, levelReq: 50, obstacle: "iceledge" },
  { id: "trail_cp1", kind: "agility_obstacle", x: 127, y: 15, name: "Varathian Trail: Marrow Chasm-Swing", course: "course_varath_trail", order: 1, exit: { x: 126, y: 15 }, xp: 250, levelReq: 50, obstacle: "chasmswing" },
  { id: "trail_cp2", kind: "agility_obstacle", x: 144, y: 86, name: "Varathian Trail: Redrun Beam", course: "course_varath_trail", order: 2, exit: { x: 145, y: 86 }, xp: 250, levelReq: 50, obstacle: "beam" },
  { id: "trail_cp3", kind: "agility_obstacle", x: 140, y: 118, name: "Varathian Trail: Estuary Rope", course: "course_varath_trail", order: 3, exit: { x: 141, y: 118 }, xp: 250, levelReq: 50, obstacle: "rope" },
  { id: "trail_cp4", kind: "agility_obstacle", x: 78, y: 150, name: "Varathian Trail: Ashfen Cinder-Leap", course: "course_varath_trail", order: 4, exit: { x: 77, y: 150 }, xp: 250, levelReq: 50, obstacle: "cinderleap" },
  { id: "trail_cp5", kind: "agility_obstacle", x: 14, y: 146, name: "Varathian Trail: Moor Bog-Hop", course: "course_varath_trail", order: 5, exit: { x: 15, y: 146 }, xp: 250, levelReq: 50, obstacle: "boghop" },
  { id: "trail_cp6", kind: "agility_obstacle", x: 12, y: 80, name: "Varathian Trail: Greyoak Log", course: "course_varath_trail", order: 6, exit: { x: 13, y: 80 }, xp: 250, levelReq: 50, obstacle: "log" },
  { id: "trail_cp7", kind: "agility_obstacle", x: 24, y: 40, name: "Varathian Trail: Northreach Net", course: "course_varath_trail", order: 7, exit: { x: 25, y: 40 }, xp: 250, levelReq: 50, obstacle: "net" },
  { id: "trail_board", kind: "trail_board", x: 54, y: 11, name: "Trail Standings", lines: ["A weathered board at the head of the Varathian Trail, tallying every runner's laps."] },
  { id: "trail_keeper", kind: "npc", x: 55, y: 11, name: "Cael the Trailkeeper", lines: [
    "Fair running out there. Come back with the Marks and the Trailblazer gear is yours — tap me to see what they'll buy.",
    "The next leg's marked with a green ring; follow it round and you'll not lose the way.",
  ] },

  // === FOUND LORE — discoverable relics (the Archive / exploration layer) ===
  // Each sits beside a landmark whose mystery it deepens; tiles chosen by the
  // placement finder (free, on land, with a reachable adjacent walkable tile).
  // Reading one the first time records the fragment and pays a finder's reward.
  { id: "relic_knuckle", kind: "relic", x: 21, y: 11, name: "Scratched Stone", loreId: "lore_two_quarrel" },
  { id: "relic_windshrine", kind: "relic", x: 53, y: 6, name: "Worn Verse", loreId: "lore_two_moonwatch" },
  { id: "relic_blackwater", kind: "relic", x: 85, y: 23, name: "Pressed Page", loreId: "lore_two_dreaming" },
  { id: "relic_coldvein", kind: "relic", x: 7, y: 32, name: "Torn Page", loreId: "lore_underloft_rite" },
  { id: "relic_ferry", kind: "relic", x: 94, y: 69, name: "Carved Stone", loreId: "lore_underloft_ferry" },
  { id: "relic_peat", kind: "relic", x: 19, y: 92, name: "Folded Note", loreId: "lore_underloft_bog" },
  { id: "relic_tendedseam", kind: "relic", x: 65, y: 95, name: "Weighted Page", loreId: "lore_orun_catechism" },
  { id: "relic_falseseam", kind: "relic", x: 11, y: 83, name: "Half-Burned Page", loreId: "lore_orun_heresy" },
  { id: "relic_watchtower", kind: "relic", x: 73, y: 42, name: "Nailed Tally", loreId: "lore_varath_muster" },
  { id: "relic_smoothwalls", kind: "relic", x: 91, y: 19, name: "Wall Rubbing", loreId: "lore_varath_masons" },
  // The newer chapters: the Hunt, the Seals, the roads and waters.
  { id: "relic_hunt_rule", kind: "relic", x: 121, y: 53, name: "Burned Board", loreId: "lore_hunt_first_guide" },
  { id: "relic_hunt_dig", kind: "relic", x: 118, y: 57, name: "Folded Confession", loreId: "lore_hunt_warrens_dig" },
  { id: "relic_trail_lap", kind: "relic", x: 55, y: 12, name: "Runner's Stone", loreId: "lore_trail_runner" },
  { id: "relic_eyeless", kind: "relic", x: 97, y: 64, name: "Salt-Stiff Chart", loreId: "lore_eyeless_chart" },

  // === ROAD OUTLAWS — lawless camps along the roads (named locations) ========
  // New humanoid threat: bandit camps and waylays in the gaps between regions,
  // each a landmark with a cluster of escalating outlaws (footpad -> captain).
  // Tiles chosen by the placement finder (landmarks reachable-adjacent; every
  // outlaw on a reachable walkable tile, no overlaps).
  { id: "lm_gallows_oak", kind: "shrine", x: 28, y: 19, name: "The Gallows Oak", lines: ["A lightning-split oak the Ironvale watch uses for its rough justice. The rope is always there; usually, so is something on it."] },
  { id: "lm_cutpurse_steps", kind: "shrine", x: 60, y: 72, name: "The Cutpurse Steps", lines: ["Worn steps where the south road bottlenecks — and where light fingers work the crowd. Keep a hand on your purse, and an eye on the man who tells you to."] },
  { id: "lm_waylayers_bend", kind: "shrine", x: 38, y: 55, name: "Waylayer's Bend", lines: ["Where the Lodge road kinks blind around a stand of pine. Good cover for an honest forester. Better cover for the men who wait for one."] },
  { id: "lm_poachers_blind", kind: "shrine", x: 32, y: 51, name: "The Poacher's Blind", lines: ["A hunter's hide, well used and not by the Lodge. Snares set for game, and for the warden who comes to cut them."] },
  { id: "lm_toll_stones", kind: "shrine", x: 52, y: 37, name: "The Toll Stones", lines: ["Two standing stones with a chain hung between, and a board that reads TOLL in fresh paint. Nobody collecting it has any right to. Everybody pays."] },
  { id: "lm_burnt_waystation", kind: "shrine", x: 82, y: 55, name: "The Burnt Waystation", lines: ["A Courier post burned to its sills. The riders don't stop here now. Something else does."] },
  { id: "lm_cutthroat_hollow", kind: "shrine", x: 33, y: 79, name: "Cutthroat Hollow", lines: ["A dell the road can't avoid and the watch won't enter. The men who hole up here are past robbery. Go around, if you can find the way."] },
  { id: "lm_drovers_loss", kind: "shrine", x: 58, y: 80, name: "The Drover's Loss", lines: ["Where a whole cattle-drive went missing in a night — beasts, drovers and all. The grass grew back greener over whatever was left."] },
  { id: "lm_smugglers_landing", kind: "shrine", x: 94, y: 72, name: "Smuggler's Landing", lines: ["A shingle beach where boats come in without papers and leave without witnesses. The Redrun keeps their secrets; the men keep their knives."] },
  { id: "lm_brigands_roost", kind: "shrine", x: 34, y: 42, name: "The Brigand's Roost", lines: ["The camp the road-gangs answer to — a ring of stolen canvas and a captain who's never been taken. Bring friends, or bring nothing they can use."] },

  // --- Outlaw spawns (each cluster guards its landmark) ---
  { id: "out_gallows_oak_0", kind: "monster", monster: "footpad", x: 27, y: 18, name: "Footpad" },
  { id: "out_gallows_oak_1", kind: "monster", monster: "footpad", x: 28, y: 18, name: "Footpad" },
  { id: "out_gallows_oak_2", kind: "monster", monster: "cutpurse", x: 29, y: 18, name: "Cutpurse" },
  { id: "out_cutpurse_steps_0", kind: "monster", monster: "cutpurse", x: 59, y: 71, name: "Cutpurse" },
  { id: "out_cutpurse_steps_1", kind: "monster", monster: "cutpurse", x: 60, y: 71, name: "Cutpurse" },
  { id: "out_cutpurse_steps_2", kind: "monster", monster: "footpad", x: 61, y: 71, name: "Footpad" },
  { id: "out_waylayers_bend_0", kind: "monster", monster: "bandit", x: 37, y: 54, name: "Bandit" },
  { id: "out_waylayers_bend_1", kind: "monster", monster: "bandit", x: 38, y: 54, name: "Bandit" },
  { id: "out_waylayers_bend_2", kind: "monster", monster: "footpad", x: 39, y: 54, name: "Footpad" },
  { id: "out_poachers_blind_0", kind: "monster", monster: "poacher", x: 31, y: 50, name: "Poacher" },
  { id: "out_poachers_blind_1", kind: "monster", monster: "poacher", x: 32, y: 50, name: "Poacher" },
  { id: "out_poachers_blind_2", kind: "monster", monster: "bandit", x: 33, y: 50, name: "Bandit" },
  { id: "out_toll_stones_0", kind: "monster", monster: "bandit", x: 51, y: 36, name: "Bandit" },
  { id: "out_toll_stones_1", kind: "monster", monster: "highwayman", x: 52, y: 36, name: "Highwayman" },
  { id: "out_burnt_waystation_0", kind: "monster", monster: "highwayman", x: 81, y: 54, name: "Highwayman" },
  { id: "out_burnt_waystation_1", kind: "monster", monster: "highwayman", x: 82, y: 54, name: "Highwayman" },
  { id: "out_burnt_waystation_2", kind: "monster", monster: "outlaw_archer", x: 83, y: 54, name: "Outlaw Archer" },
  { id: "out_cutthroat_hollow_0", kind: "monster", monster: "cutthroat", x: 32, y: 78, name: "Cutthroat" },
  { id: "out_cutthroat_hollow_1", kind: "monster", monster: "cutthroat", x: 33, y: 78, name: "Cutthroat" },
  { id: "out_cutthroat_hollow_2", kind: "monster", monster: "outlaw_archer", x: 34, y: 78, name: "Outlaw Archer" },
  { id: "out_drovers_loss_0", kind: "monster", monster: "cutthroat", x: 57, y: 79, name: "Cutthroat" },
  { id: "out_drovers_loss_1", kind: "monster", monster: "marauder", x: 58, y: 79, name: "Marauder" },
  { id: "out_smugglers_landing_0", kind: "monster", monster: "outlaw_archer", x: 93, y: 71, name: "Outlaw Archer" },
  { id: "out_smugglers_landing_1", kind: "monster", monster: "outlaw_archer", x: 92, y: 71, name: "Outlaw Archer" },
  { id: "out_smugglers_landing_2", kind: "monster", monster: "marauder", x: 94, y: 70, name: "Marauder" },
  { id: "out_brigands_roost_0", kind: "monster", monster: "outlaw_captain", x: 33, y: 41, name: "Outlaw Captain" },
  { id: "out_brigands_roost_1", kind: "monster", monster: "cutthroat", x: 34, y: 41, name: "Cutthroat" },
  { id: "out_brigands_roost_2", kind: "monster", monster: "cutthroat", x: 35, y: 41, name: "Cutthroat" },
  { id: "out_brigands_roost_3", kind: "monster", monster: "marauder", x: 33, y: 42, name: "Marauder" },
  { id: "out_brigands_roost_4", kind: "monster", monster: "bandit", x: 35, y: 42, name: "Bandit" },

  // === OUTLYING SETTLEMENTS — small hamlets in the open country ==============
  // Three clusters of roofed cottages (see BUILDINGS / step 4d in map.ts), each
  // with its own folk, hearth and dressing. Ground laid for player housing
  // later. Tiles validated walkable + reachable by the placement finder.

  // --- REDMOUTH: a fisherfolk hamlet on the Redrun's east bank. Mourne the
  //     Deep Watcher keeps his bounty board here, at the river's grim last mile. ---
  {
    id: "mourne", kind: "npc", bountyGuide: "mourne", x: 90, y: 60, name: "Mourne, the Deep Watcher",
    lines: [
      "You're loud. The river hears you coming. So does what's in it.",
      "Mourne. I watch the deep places — the Marrow's dark, and the Redrun's last mile down to the grey. When a thing climbs out that shouldn't, I write its name on the board, and I pay the one who unwrites it.",
      "I don't send children to the deep. Come back when the Hills and the Spine have nothing left to teach you, and I'll have work for you.",
    ],
  },
  {
    // Kaeda keeps her ledger at the Old Quarry now, over the mouth of the Hunt
    // Warrens — the guild's slayer grounds are her natural post, and it spreads
    // the guides across the map instead of stacking two at Redmouth.
    // (legacy 98,29 → final ~118,55, two tiles west of the Warrens shaft.)
    id: "kaeda", kind: "npc", bountyGuide: "kaeda", x: 98, y: 29, name: "Kaeda, the Reckoner",
    lines: [
      "Stand still. I'm reckoning whether you're worth an entry in my ledger, or a line in someone else's.",
      "Every named thing in Varath is written in this book — the Boneman, the wardens, the wyrm on its hoard, the two the songs got wrong. Beside each, the hunters who put it down. Most pages are empty.",
      "I keep the ledger here, over the Warrens' mouth, because this is where hunters are made or eaten. Down that shaft is every grade of quarry the guild recognises. Know your level before you take the ladder.",
      "I don't hand out rat-work. I post one name at a time, and I pay in marks the fat-guild would faint at. Reach Bounty sixty, come back, and I'll set you against something that has a name worth taking.",
    ],
  },
  {
    id: "redmouth_warin", kind: "npc", x: 90, y: 61, name: "Warin, an Old Fisher",
    lines: [
      "Redmouth, this. Three roofs and a smokehouse, and we've buried better men for less.",
      "I've rowed the Redrun forty years. The water's wrong this season — runs red past the time of year for it, and the greyfin come up thin and few. My girl's wed downstream, near the estuary. Even she's stopped telling me it's nothing.",
    ],
  },
  {
    id: "redmouth_neila", kind: "npc", x: 86, y: 62, name: "Neila, a Net-Mender",
    lines: [
      "Mind the nets drying on the rail — a season's work, that, and a careless boot undoes a week of mending.",
      "My sister hawks our catch up in the Ironvale market — the fishwife by the square, you'll have heard her. She tells the city the red water's just the season. Out here we don't trouble to lie to ourselves about it.",
      "If you've a death-wish and a strong arm: there's a barrow mouth swallowed up in the deep woods east of here, past the river. Cold air pours out of it. Folk who go in to map it don't come back to finish the map.",
    ],
  },
  { id: "fire_redmouth", kind: "fire", x: 86, y: 59, name: "Smokehouse Fire" },
  { id: "cart_redmouth", kind: "cart", x: 87, y: 61, name: "Fish Cart", lines: ["A handcart of greyfin and river-perch, salted down for the smoke."] },
  { id: "lamp_redmouth_1", kind: "lamppost", x: 82, y: 57, name: "Bank Lamp" },
  { id: "lamp_redmouth_2", kind: "lamppost", x: 90, y: 58, name: "Bank Lamp" },
  { id: "sign_redmouth", kind: "signpost", x: 84, y: 57, name: "Fingerpost", lines: ["REDMOUTH — the fisherfolk of the Redrun. Smoked fish, and a board for those who'd hunt the deep."] },
  { id: "banner_redmouth", kind: "banner", x: 83, y: 56, tint: "#8a3550", name: "Redmouth Colours", lines: ["A dusky river-maroon, the colour the Redrun's silt stains everything here in the end — nets, hands, and the daub of the walls alike."] },
  // The waterfront: the fishers' track runs east from the yard to a plank jetty
  // over the Redrun (carved in map.ts) — drying rails along it, Warin's coble
  // moored at the end, and the hamlet's own fishing water off the planks.
  { id: "fence_redmouth_net1", kind: "fence", x: 88, y: 59, name: "Net-Drying Rail", species: "h", lines: ["A season of nets drying on the rail. Mind your boots — Neila is watching."] },
  { id: "fence_redmouth_net2", kind: "fence", x: 89, y: 59, name: "Net-Drying Rail", species: "h", lines: ["A season of nets drying on the rail. Mind your boots — Neila is watching."] },
  { id: "boat_redmouth", kind: "boat", x: 95, y: 60, name: "Warin's Coble", lines: ["A clinker-built river coble, tarred black, tied to the jetty's last post. Forty years of the Redrun in its boards."] },
  { id: "fish_redmouth_1", kind: "fishing_spot", x: 95, y: 58, name: "Jetty Water", resource: "fish_ashfin", catches: POOL_RIVER },
  { id: "fish_redmouth_2", kind: "fishing_spot", x: 95, y: 62, name: "Jetty Water", resource: "fish_ashfin", catches: POOL_RIVER },

  // --- THE DROVER'S REST: a waystation on the south road, victualling the
  //     herds up from the Ashfen — and shaken since the Drover's Loss. ---
  {
    id: "drover_tamsin", kind: "npc", x: 69, y: 75, name: "Tamsin, the Reeve",
    lines: [
      "Sit, traveller. The Rest's still standing — which is more than the last drove through here can say.",
      "We victual the herds coming up from the Ashfen and the moor. Did, anyway. A whole drive went down in the hollow south of here, one night — beasts, drovers and all. Now we keep the lamps lit late and the gate barred, and we charge for a bed and don't apologise for the price.",
    ],
  },
  {
    id: "drover_hodd", kind: "npc", x: 70, y: 75, name: "Hodd, a Drover",
    lines: [
      "Twelve mile a day, rain or the moor's mood — that's a drove. You learn to sleep walking.",
      "I'll not take the herd through the Drover's Loss after dark. The reeve says I've gone soft. The reeve didn't hear what I heard, the night the moor took the others.",
    ],
  },
  { id: "fire_drover", kind: "fire", x: 67, y: 75, name: "The Rest's Hearth" },
  { id: "cart_drover", kind: "cart", x: 70, y: 78, name: "Drover's Wagon", lines: ["A high-sided wagon, axle-deep in dried mud from the moor road."] },
  { id: "lamp_drover_1", kind: "lamppost", x: 64, y: 74, name: "Gate Lamp" },
  { id: "lamp_drover_2", kind: "lamppost", x: 74, y: 77, name: "Yard Lamp" },
  { id: "sign_drover", kind: "signpost", x: 63, y: 73, name: "Fingerpost", lines: ["THE DROVER'S REST — bed, board and a barred gate. ▲ IRONVALE. ▼ THE ASHFEN FLATS."] },
  { id: "banner_drover", kind: "banner", x: 62, y: 74, tint: "#9c7038", name: "Drover's Rest Colours", lines: ["Road-ochre, the tan of dust and dried mud that never fully leaves a drove-road waystation. Faded, patched, and re-hung after every herd that knocks it."] },
  // The stock paddock: where the droves overnight — rails, the mired wagon and
  // the beasts themselves, gated toward the inn.
  ...makePen("fence_drover", 69, 76, 73, 79, [[71, 76]], "The Rest's stock paddock. The rail is rubbed smooth by a hundred herds."),
  { id: "cr_drover_ox1", kind: "critter", species: "ox", x: 71, y: 77, name: "A Drove Ox" },
  { id: "cr_drover_ox2", kind: "critter", species: "ox", x: 72, y: 78, name: "A Drove Ox" },

  // --- THE FOLD: an upland shepherds' croft in the northern Knuckle Hills,
  //     plagued by Rook's wolf-that-is-no-wolf. ---
  {
    id: "fold_brannog", kind: "npc", x: 62, y: 17, name: "Brannog, the Shepherd",
    lines: [
      "Up here it's sheep, stone and weather, and little else. Suits me. Suits the flock well enough.",
      "Old Rook, down the hills, keeps on about a wolf that's no wolf — clever, lame, takes a lamb clean and leaves no track. I've lost three this spring. I've stopped calling it a wolf. I just count the flock twice over now, and sleep the less for it.",
    ],
  },
  {
    id: "fold_wyn", kind: "npc", x: 64, y: 17, name: "Wyn, a Shepherd's Daughter",
    lines: [
      "You came up the Fold lane? Then it's the croft you'll be wanting, not me. I only mind the lambs.",
      "Da says I'm not to go past the lambing shed after dark. I don't argue it. Something's been at the flock, and it's not shy of the lamplight.",
    ],
  },
  { id: "fire_fold", kind: "fire", x: 61, y: 16, name: "Croft Hearth" },
  { id: "cart_fold", kind: "cart", x: 67, y: 14, name: "Wool Cart", lines: ["Sacks of greasy fleece, bound for the Ironvale cloth stalls."] },
  { id: "lamp_fold_1", kind: "lamppost", x: 59, y: 14, name: "Croft Lamp" },
  { id: "lamp_fold_2", kind: "lamppost", x: 66, y: 18, name: "Fold Lamp" },
  { id: "sign_fold", kind: "signpost", x: 58, y: 19, name: "Fingerpost", lines: ["THE FOLD — an upland croft. Mind the flock, and mind what minds the flock."] },
  { id: "banner_fold", kind: "banner", x: 59, y: 19, tint: "#8f97a4", name: "The Fold's Colours", lines: ["Undyed wool-grey, the plain colour of the flock it flies for. The shepherds see no sense dyeing good fleece to say what everyone up here already knows."] },
  // The pen: post-and-rail off the wool-shed, its gate under the shed door, the
  // flock inside with Wyn — a working croft, not scattered set-dressing.
  ...makePen("fence_fold", 63, 16, 67, 19, [[65, 16]], "The Fold's sheep pen. Three lambs short, if you believe Brannog's count."),
  { id: "cr_fold_sheep1", kind: "critter", species: "sheep", x: 65, y: 17, name: "A Hill Sheep" },
  { id: "cr_fold_sheep2", kind: "critter", species: "sheep", x: 64, y: 18, name: "A Hill Sheep" },
  { id: "cr_fold_sheep3", kind: "critter", species: "sheep", x: 66, y: 18, name: "A Hill Sheep" },

  // === PLAYER HOUSING — claim a lot, then furnish its lived-in interior =======
  // Each home is a four-room house in the hidden band (see homeLayout in map.ts):
  // you enter the LIVING room; the KITCHEN and BEDROOM open off it; the WORKSHOP
  // is a wing you add on (build the extension to open its sealed doorway). The
  // build footings + doors are generated from the shared floorplan below.
];

/** New points of interest filling the wide open country the doubled map opened
 *  up — authored directly in NEW canvas coordinates (so they are NOT re-mapped),
 *  each on the matching terrain patch carved in map.ts. */
const newPois: WorldObjectDef[] = [
  // Wayfarers' Crossroads (NW) — a ruined waystation where the north & west roads meet.
  { id: "poi_cross_sign", kind: "signpost", x: 40, y: 43, name: "Wayfarers' Crossroads", lines: ["A ruined waystation where the north and west roads cross. Travellers rest here — and so do those who prey on them."] },
  { id: "poi_cross_rock1", kind: "rock", x: 38, y: 45, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "poi_cross_rock2", kind: "rock", x: 42, y: 45, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  // Kept off the tutorial clearing: a brand-new player spawns at (42,42) beside
  // Aldric and the first knucklestone rock (40,40). A lvl-12 bandit one tile away
  // was a misclick death-trap and a hostile-looking welcome, so the crossroads
  // outlaws now work the road south, toward Waylayer's Bend — a fight you walk
  // out to find, not one that greets you. (The low-level Gallows Oak footpads to
  // the east remain the natural first foes.)
  { id: "poi_cross_bandit", kind: "monster", monster: "bandit", x: 40, y: 52, name: "Roadside Bandit" },
  { id: "poi_cross_footpad", kind: "monster", monster: "footpad", x: 39, y: 51, name: "Footpad" },
  // The Old Quarry (NE) — abandoned stone-cutting on the city→marrow road.
  { id: "poi_quarry_sign", kind: "signpost", x: 117, y: 51, name: "The Old Quarry", lines: ["A played-out stone quarry gone to weeds. The deep cuts still give good stone — and shelter for worse things."] },
  { id: "poi_quarry_rock1", kind: "rock", x: 114, y: 49, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "poi_quarry_rock2", kind: "rock", x: 120, y: 53, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "poi_quarry_crawler", kind: "monster", monster: "stone_crawler", x: 117, y: 53, name: "Stone Crawler" },
  // The East Commons (E) — drovers' grazing meadow on the city→redrun road.
  { id: "poi_commons_sign", kind: "signpost", x: 116, y: 101, name: "The East Commons", lines: ["Open grazing where the drovers rest their herds before the river crossing. Peaceful — mostly."] },
  { id: "poi_commons_sheep1", kind: "critter", species: "sheep", x: 113, y: 99, name: "A Grazing Sheep" },
  { id: "poi_commons_sheep2", kind: "critter", species: "sheep", x: 119, y: 103, name: "A Grazing Sheep" },
  { id: "poi_commons_boar", kind: "monster", monster: "greymane_boar", x: 118, y: 100, name: "Greymane Boar" },
  // The Gallowsfield (SE) — an outlaw camp on the city→ashfen road.
  { id: "poi_gallows_sign", kind: "signpost", x: 102, y: 118, name: "The Gallowsfield", lines: ["An old hanging-ground turned outlaw camp. The watch won't ride this far out. Bring steel."] },
  { id: "poi_gallows_cut1", kind: "monster", monster: "cutthroat", x: 100, y: 116, name: "Cutthroat" },
  { id: "poi_gallows_cut2", kind: "monster", monster: "cutthroat", x: 105, y: 120, name: "Cutthroat" },
  { id: "poi_gallows_fire", kind: "fire", x: 102, y: 120, name: "Camp Fire" },
  // The Sunken Mile (SW) — a treacherous bog on the city→heartmoor road.
  { id: "poi_sunken_sign", kind: "signpost", x: 42, y: 110, name: "The Sunken Mile", lines: ["A mile of false ground where the road gives way to moor. Keep to the tussocks; the lurkers keep to the pools."] },
  { id: "poi_sunken_lurker", kind: "monster", monster: "marsh_lurker", x: 40, y: 112, name: "Marsh Lurker" },
  { id: "poi_sunken_forage", kind: "forage_spot", x: 44, y: 108, name: "Bog Fibreweed", resource: "surv_forage_fiber" },
  // The Wood-Moor Verge (W) — a wild edge on the city→greyoak road.
  { id: "poi_verge_sign", kind: "signpost", x: 36, y: 85, name: "The Wood-Moor Verge", lines: ["Where the hill country gives out to wood and moor both. The bears come down to the verge to feed."] },
  { id: "poi_verge_bear", kind: "monster", monster: "forest_bear", x: 38, y: 87, name: "Forest Bear" },
  { id: "poi_verge_tree", kind: "tree", x: 34, y: 83, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },

  // === REGION SETTLEMENTS — a village at each far region: a themed shop and a
  // couple of folk, so arriving somewhere feels like arriving somewhere. =======
  // --- Frostgate (Spine): the pass camp of mountaineers & ore-haulers ---
  { id: "sign_frostgate", kind: "signpost", x: 50, y: 22, name: "Frostgate", lines: ["FROSTGATE — last shelter before the high pass. Buy rope and a warm coat, or buy nothing and freeze."] },
  { id: "npc_frostgate_trader", kind: "npc", x: 50, y: 19, name: "Hesk, a Pass-Warden", lines: ["Cold enough for you? It gets worse up the pass. Take rope, take a lamp, take more food than your pride wants to.", "Ore comes down through here from the high cuttings. I'll sell you the tools to win your own."] },
  { id: "npc_frostgate_folk", kind: "npc", x: 48, y: 20, name: "A Shivering Porter", lines: ["Twelve trips up the pass today. My back's a map of every one."] },
  { id: "fire_frostgate", kind: "fire", x: 52, y: 20, name: "Pass Fire" },
  { id: "cart_frostgate", kind: "cart", x: 47, y: 18, name: "Rope & Tackle Sledge", lines: ["Coiled rope, iron pitons and a torn coat nobody has claimed. Pass gear, stacked for the next fool going up."] },
  // Frostgate flies cold Spine-blue over the pass; pass-lanterns and a frozen
  // snag mark the last shelter before the white.
  { id: "banner_frostgate", kind: "banner", x: 51, y: 22, tint: "#3f78b4", name: "Frostgate Colours", lines: ["The pass-wardens' cold blue, stitched thick against a wind that would tear thinner cloth. It has flown here longer than the road below it has been walked."] },
  { id: "lamp_frostgate", kind: "lamppost", x: 49, y: 21, name: "Pass Lantern" },
  { id: "snag_frostgate", kind: "deadfall", x: 53, y: 22, species: "snag", name: "Frozen Snag", lines: ["A dead coldpine, its sap frozen to glass in the cracks. Nothing rots this high — it only stands and greys."] },
  // --- Deeplight (Marrow): a delvers' outpost in the cavern mouth ---
  { id: "sign_deeplight", kind: "signpost", x: 125, y: 28, name: "Deeplight", lines: ["DEEPLIGHT — keep a light burning and keep it close. The deep doesn't forgive the dark."] },
  { id: "npc_deeplight_trader", kind: "npc", x: 125, y: 26, name: "Mott, a Deep-Delver", lines: ["Down here we trade in light and in nerve. I've a stock of the one, at least.", "Gems come out of these walls if you've the pick and the patience. I'll buy what you bring up."] },
  { id: "npc_deeplight_folk", kind: "npc", x: 127, y: 27, name: "A Wary Lampwright", lines: ["Never let it gutter. A lamp's the only friend that doesn't run when the crawlers come."] },
  { id: "fire_deeplight", kind: "fire", x: 123, y: 27, name: "Delvers' Brazier" },
  { id: "lamp_deeplight", kind: "lamppost", x: 125, y: 24, name: "Deeplight Lantern" },
  { id: "cart_deeplight", kind: "cart", x: 122, y: 25, name: "Ore Crates", lines: ["Crates of ashiron and raw gemstone, chalk-marked for the Ironvale road. The deep pays, when it doesn't collect."] },
  // Deeplight hangs a lantern-gold standard so the outpost can be found in the
  // dark; a second lamp and a rough gem-seam mark the cavern mouth.
  { id: "banner_deeplight", kind: "banner", x: 126, y: 28, tint: "#c8912e", name: "Deeplight Colours", lines: ["Lantern-gold on black — a colour picked so a lost delver can find home by it in the one lamp's throw of light the deep allows."] },
  { id: "lamp_deeplight2", kind: "lamppost", x: 127, y: 24, name: "Deeplight Lantern" },
  { id: "gem_deeplight", kind: "rock", x: 129, y: 27, name: "Gem Seam", resource: "mine_gemvein" },
  // --- Saltreach (Redrun): a fishing village on the river's east bank ---
  { id: "sign_saltreach", kind: "signpost", x: 146, y: 109, name: "Saltreach", lines: ["SALTREACH — where the Redrun meets the Eyeless Sea. Fresh catch daily, weather and serpents allowing."] },
  { id: "npc_saltreach_trader", kind: "npc", x: 145, y: 106, name: "Brine, a Fishwife", lines: ["Off the boats this morning — couldn't be fresher unless you caught it yourself. Which I'll sell you the gear to do.", "The deep water's good fishing and bad luck both. Mind the serpents past the bar."] },
  { id: "npc_saltreach_folk", kind: "npc", x: 144, y: 107, name: "A Net-Mender", lines: ["A torn net catches nothing but blame. Patience and good twine, that's the whole trade."] },
  { id: "fire_saltreach", kind: "fire", x: 148, y: 107, name: "Smoking Fire" },
  { id: "boat_saltreach", kind: "boat", x: 149, y: 108, name: "A Beached Coble", lines: ["Hauled out on rollers for the season's tarring. The Eyeless Sea is patient; the hull can't afford to be."] },
  { id: "fence_saltreach_net1", kind: "fence", x: 143, y: 104, name: "Net-Drying Rail", species: "h", lines: ["Nets on the rail, drying between tides. The mesh is torn where something big went through."] },
  { id: "fence_saltreach_net2", kind: "fence", x: 144, y: 104, name: "Net-Drying Rail", species: "h", lines: ["Nets on the rail, drying between tides. The mesh is torn where something big went through."] },
  // Saltreach flies sea-teal, salt-faded to the colour of the shallows; cattails
  // at the bank and a second beached boat mark the river-mouth landing.
  { id: "banner_saltreach", kind: "banner", x: 147, y: 109, tint: "#2f8f8a", name: "Saltreach Colours", lines: ["Sea-teal gone pale as the water over the bar, the salt in every fibre. They re-dye it each spring and the sea bleaches it back by autumn."] },
  { id: "reeds_saltreach", kind: "reeds", x: 148, y: 105, name: "Bank Cattails" },
  { id: "boat_saltreach2", kind: "boat", x: 143, y: 106, name: "A Moored Skiff", lines: ["A one-man skiff, bailer still aboard, tied short against the morning tide. Somebody means to be out on the water before the fishwife's even lit her fire."] },
  // --- Emberhearth (Ashfen): a warm-flats camp of cult miners ---
  { id: "sign_emberhearth", kind: "signpost", x: 77, y: 145, name: "Emberhearth", lines: ["EMBERHEARTH — the warm ground keeps the fires lit and the faithful close. Witness the heat, or move along."] },
  { id: "npc_emberhearth_trader", kind: "npc", x: 77, y: 142, name: "Sefa, a Flux-Trader", lines: ["Embercite for your flux, charcoal for your forge, a flask for whatever you brew. The warm ground gives plenty.", "We don't sell the faith. Only the goods. The faith you feel through your boots, free of charge."] },
  { id: "npc_emberhearth_folk", kind: "npc", x: 79, y: 143, name: "A Sweating Digger", lines: ["Short shifts down the warm cuts. Any longer and a man starts hearing the ground breathe."],
    reactiveLines: [
      { requiresFlags: ["the_warmth_answered"], lines: ["Don't tell the Tender I said it — but the ground doesn't just breathe now. It answers. Since you did whatever you did down deep, the seam pulses like a heart, and we all feel it through our boots.","Shortest shifts we've ever worked. Nobody can stand it long. Nobody wants to leave it either."] },
      { requiresFlags: ["endgame_shard_destroyed"], lines: ["Warm cuts went cold, first time in living memory. Cold rock, plain and quiet. The Tender's not spoken a word in days.","Easier digging, cold. Truth be told, I miss the breathing. A man gets used to a strange thing, and then it's gone, and the quiet's worse."] },
    ] },
  { id: "fire_emberhearth", kind: "fire", x: 75, y: 143, name: "Ember Pit" },
  { id: "cart_emberhearth", kind: "cart", x: 74, y: 141, name: "Charcoal Heap", lines: ["Charcoal sacked and stacked, still warm from the burn. The ground under it is warmer."] },
  // Emberhearth flies ember-red over the warm ground; a second ember pit and a
  // charred snag mark the cult's flats.
  { id: "banner_emberhearth", kind: "banner", x: 78, y: 145, tint: "#c33f28", name: "Emberhearth Colours", lines: ["The colour of the coal's heart, flown for the warmth in the ground rather than any lord. The faithful say it never needs re-dyeing — the flats keep it bright."] },
  { id: "fire_emberhearth2", kind: "fire", x: 79, y: 145, name: "Ember Pit" },
  { id: "snag_emberhearth", kind: "deadfall", x: 76, y: 146, species: "snag", name: "Charred Snag", lines: ["A dead tree cooked black where it stood, from the ground up. Nothing struck it. The warmth simply rose one bad summer and took it."] },
  // --- Mirehold (Heartmoor): a moor hamlet of cutters & trappers ---
  { id: "sign_mirehold", kind: "signpost", x: 15, y: 143, name: "Mirehold", lines: ["MIREHOLD — a few roofs on firm ground in a sea of bog. Keep to the boards and the moor keeps its temper."] },
  { id: "npc_mirehold_trader", kind: "npc", x: 15, y: 140, name: "Tam, a Peat-Cutter", lines: ["Eel, peat, snare-line and good moor boots — all a body needs out here. I'll trade you fair.", "The bog keeps things. Best not ask too closely what, or it keeps you too."] },
  { id: "npc_mirehold_folk", kind: "npc", x: 13, y: 141, name: "A Moor-Wife", lines: ["My man went to check the snares at the pools this morning. The boards don't lie about where folk walk — but he strayed off them."],
    reactiveLines: [
      { requiresFlags: ["endgame_shard_destroyed"], lines: ["The warm pools went cold the same night the whole moor did. Quiet, now. Too quiet.","I keep half-thinking he'll come walking up out of them, now the warmth's gone. He won't. But I think it, every morning. That's the bog for you — it keeps what it takes, and it lets you keep the hoping."] },
      { requiresFlags: ["the_warmth_answered"], lines: ["The pools ran warmer than ever the night the warmth answered. Warm enough I went down and stood in them, foolish as a girl, calling his name into the steam.","Nothing called back. But it was warm. After all these cold years — it was warm. I'll take that. I'll have to."] },
    ] },
  { id: "fire_mirehold", kind: "fire", x: 17, y: 141, name: "Peat Fire" },
  { id: "cart_mirehold", kind: "cart", x: 14, y: 138, name: "Peat Barrow", lines: ["A barrow of cut peat bricks, drying under sacking. Moor fuel — slow, smoky and dependable, like the folk who cut it."] },
  // Mirehold flies moor-heather purple; cattails and a mossy fallen log mark the
  // firm ground in the sea of bog.
  { id: "banner_mirehold", kind: "banner", x: 16, y: 143, tint: "#6a4f7a", name: "Mirehold Colours", lines: ["Heather-purple, the one bright thing the moor grows of its own accord. They dye the cloth with the bloom itself, so the banner smells faintly of the bog on a wet day."] },
  { id: "reeds_mirehold", kind: "reeds", x: 18, y: 142, name: "Moor Cattails" },
  { id: "log_mirehold", kind: "deadfall", x: 13, y: 143, species: "log", name: "Mossy Log", lines: ["A fallen bog-oak, black and heavy with the water it's drunk. Moss has it now, and something small lives under the far end."] },
  // --- Lodgehold (Greyoak): a foresters' steading at the wood's heart ---
  { id: "sign_lodgehold", kind: "signpost", x: 13, y: 85, name: "Lodgehold", lines: ["LODGEHOLD — the Warden's steading in the old wood. Bring an axe worth the name, and leave the deep growth its peace."] },
  { id: "npc_lodgehold_trader", kind: "npc", x: 13, y: 82, name: "Bryn, a Bowyer", lines: ["Hatchets, bowstaves, good arrows fletched true — the wood gives, if you've the tools to ask. I'll sell you those.", "Greyoak's the finest timber in Varath. Cut honest and it'll never blunt you for spite."] },
  { id: "npc_lodgehold_folk", kind: "npc", x: 15, y: 83, name: "A Lodge Fletcher", lines: ["Straight shaft, true feather, a head that flies where you look. Anything less is a stick with ambitions."] },
  { id: "fire_lodgehold", kind: "fire", x: 11, y: 83, name: "Steading Hearth" },
  { id: "cart_lodgehold", kind: "cart", x: 12, y: 80, name: "Log Pile", lines: ["Greyoak trunks bucked to length and stacked to season. Every ring in them is older than you."] },
  // Lodgehold flies hunter-green over the steading; a hide-drying rail and a
  // seasoning greyoak mark the foresters' hold at the wood's heart.
  { id: "banner_lodgehold", kind: "banner", x: 14, y: 85, tint: "#4e7a3a", name: "Lodgehold Colours", lines: ["The green of deep greyoak in summer leaf. The Warden's own colours — sewn, they say, from the first cloak of the first forester to hold the wood."] },
  { id: "fence_lodgehold_hide", kind: "fence", x: 15, y: 84, name: "Hide-Drying Rail", species: "h", lines: ["Deer and boar hides pegged out on the rail, fleshed and salted, curing to leather. The bowyer takes the best for quivers."] },
  { id: "tree_lodgehold", kind: "tree", x: 16, y: 85, name: "Greyoak Tree", resource: "fell_greyoak", species: "greyoak" },

  // === WILD ANIMALS. Deer roam the open country between places — huntable for
  // the generic Raw Meat + Raw Hide. The bounty species live in their named
  // HUNTING GROUNDS (see content/bounty.ts huntingGrounds — OSRS-Slayer style:
  // a guide can point at the map and say "the bears are HERE"), with only a
  // stray or two left wandering the wider wilds for flavour. ==================
  { id: "wild_deer_1", kind: "monster", monster: "red_deer", x: 24, y: 28, name: "Red Deer" },
  { id: "wild_deer_2", kind: "monster", monster: "red_deer", x: 90, y: 40, name: "Red Deer" },
  { id: "wild_deer_3", kind: "monster", monster: "red_deer", x: 110, y: 70, name: "Red Deer" },
  { id: "wild_deer_4", kind: "monster", monster: "red_deer", x: 120, y: 115, name: "Red Deer" },
  { id: "wild_deer_5", kind: "monster", monster: "red_deer", x: 60, y: 122, name: "Red Deer" },
  { id: "wild_deer_6", kind: "monster", monster: "red_deer", x: 30, y: 108, name: "Red Deer" },
  { id: "wild_deer_7", kind: "monster", monster: "red_deer", x: 20, y: 58, name: "Red Deer" },
  { id: "wild_deer_8", kind: "monster", monster: "red_deer", x: 102, y: 50, name: "Red Deer" },
  // Bearwallow — the bear ground in the Greyoak hollows south of Lodgehold.
  { id: "wild_bear_1", kind: "monster", monster: "forest_bear", x: 7, y: 90, name: "Forest Bear" },
  { id: "wild_bear_4", kind: "monster", monster: "forest_bear", x: 12, y: 93, name: "Forest Bear" },
  { id: "wild_bear_5", kind: "monster", monster: "forest_bear", x: 14, y: 91, name: "Forest Bear" },
  // …and two strays still ranging the far country.
  { id: "wild_bear_2", kind: "monster", monster: "forest_bear", x: 126, y: 76, name: "Forest Bear" },
  { id: "wild_bear_3", kind: "monster", monster: "forest_bear", x: 70, y: 126, name: "Forest Bear" },
  // The Sunning Crags — the lion ground on the Spine's southern skirt.
  { id: "wild_lion_1", kind: "monster", monster: "mountain_lion", x: 56, y: 46, name: "Mountain Lion" },
  { id: "wild_lion_2", kind: "monster", monster: "mountain_lion", x: 59, y: 48, name: "Mountain Lion" },
  // …and two strays on the far hills.
  { id: "wild_lion_3", kind: "monster", monster: "mountain_lion", x: 50, y: 120, name: "Mountain Lion" },
  { id: "wild_lion_4", kind: "monster", monster: "mountain_lion", x: 130, y: 92, name: "Mountain Lion" },
  // Howler's Rise — the wolf ground on the bare hill west of the Knuckle road.
  { id: "wild_wolf_1", kind: "monster", monster: "hill_wolf", x: 28, y: 36, name: "Hill Wolf" },
  { id: "wild_wolf_2", kind: "monster", monster: "hill_wolf", x: 25, y: 38, name: "Hill Wolf" },
  { id: "wild_wolf_3", kind: "monster", monster: "hill_wolf", x: 30, y: 38, name: "Hill Wolf" },
  { id: "wild_wolf_4", kind: "monster", monster: "hill_wolf", x: 31, y: 34, name: "Hill Wolf" },
  // The Boar Run — the boar ground in western Greyoak, north of Lodgehold.
  { id: "wild_boar_w1", kind: "monster", monster: "wild_boar", x: 8, y: 74, name: "Wild Boar" },
  { id: "wild_boar_w2", kind: "monster", monster: "wild_boar", x: 14, y: 75, name: "Wild Boar" },
  { id: "wild_boar_w3", kind: "monster", monster: "wild_boar", x: 10, y: 78, name: "Wild Boar" },
  // Small packs at the thinner grounds, so every contract has a sure address.
  { id: "hab_rat_1", kind: "monster", monster: "moor_rat", x: 51, y: 32, name: "Moor Rat" },
  { id: "hab_rat_2", kind: "monster", monster: "moor_rat", x: 55, y: 37, name: "Moor Rat" },
  { id: "hab_greymane_1", kind: "monster", monster: "greymane_boar", x: 21, y: 93, name: "Greymane Boar" },
  { id: "hab_greymane_2", kind: "monster", monster: "greymane_boar", x: 15, y: 97, name: "Greymane Boar" },
  { id: "hab_ridge_wolf", kind: "monster", monster: "ridge_wolf", x: 61, y: 17, name: "Ridge Wolf" },
  { id: "hab_troll", kind: "monster", monster: "mountain_troll", x: 66, y: 32, name: "Mountain Troll" },
  { id: "hab_serpent", kind: "monster", monster: "mire_serpent", x: 27, y: 136, name: "Mire Serpent" },
  { id: "hab_wraith", kind: "monster", monster: "marrow_wraith", x: 120, y: 34, name: "Marrow Wraith" },
  { id: "hab_golem", kind: "monster", monster: "deep_golem", x: 135, y: 34, name: "Deep Golem" },
  { id: "hab_river_serpent", kind: "monster", monster: "river_serpent", x: 144, y: 100, name: "River Serpent" },
  { id: "hab_brigand", kind: "monster", monster: "redrun_brigand", x: 147, y: 102, name: "Redrun Brigand" },
  { id: "hab_orc", kind: "monster", monster: "ancient_orc", x: 125, y: 123, name: "Ancient Orc" },

  // === FILLING THE OPEN COUNTRY — resource spreads + landmarks so there's no
  // dead land between places. Gatherable nodes (trees/rock/forage) and examine
  // landmarks (shrines), spread across the empty cells the map audit found. ====
  // -- NW hills (city↔greyoak/spine) --
  { id: "fz_tree_nw1", kind: "tree", x: 12, y: 12, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz_tree_nw2", kind: "tree", x: 15, y: 14, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz_tree_nw3", kind: "tree", x: 31, y: 11, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fz_tree_nw4", kind: "tree", x: 33, y: 14, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fz_rock_nw1", kind: "rock", x: 13, y: 30, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "fz_rock_nw2", kind: "rock", x: 16, y: 32, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "fz_shrine_nw", kind: "shrine", x: 8, y: 54, name: "The Lonely Stone", lines: ["A standing stone on a bare knoll, older than the roads. Someone keeps a posy of moor-flowers at its foot. Nobody admits to it."] },
  { id: "fz_forage_nw", kind: "forage_spot", x: 14, y: 54, name: "Hillside Fibreweed", resource: "surv_forage_fiber" },
  // -- N gap (city↔spine) --
  { id: "fz_rock_n1", kind: "rock", x: 90, y: 12, name: "Silica Deposit", resource: "mine_silica" },
  { id: "fz_rock_n2", kind: "rock", x: 103, y: 18, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "fz_tree_n1", kind: "tree", x: 79, y: 7, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fz_shrine_n", kind: "shrine", x: 114, y: 18, name: "The Cairn of Hands", lines: ["A cairn of stones, each no bigger than a fist. Travellers add one for safe passage over the pass. The pile never stops growing."] },
  // -- NE frontier (city↔marrow) --
  { id: "fz_rock_ne1", kind: "rock", x: 115, y: 30, name: "Ashiron Vein", resource: "mine_ashiron" },
  { id: "fz_rock_ne2", kind: "rock", x: 138, y: 42, name: "Rough Gem Rock", resource: "mine_rough_gem" },
  { id: "fz_rock_ne3", kind: "rock", x: 150, y: 30, name: "Ashiron Vein", resource: "mine_ashiron" },
  { id: "fz_shrine_ne", kind: "shrine", x: 150, y: 54, name: "The Watcher's Post", lines: ["A toppled watchtower, only its footings left. From the high stones you can see the whole eastern country — and whatever moves on it."] },
  { id: "fz_lion_ne", kind: "monster", monster: "mountain_lion", x: 138, y: 66, name: "Mountain Lion" },
  // -- E frontier (city↔redrun) --
  { id: "fz_tree_e1", kind: "tree", x: 126, y: 66, name: "Stonewood", resource: "fell_stonewood", species: "stonewood" },
  { id: "fz_tree_e2", kind: "tree", x: 138, y: 78, name: "Stonewood", resource: "fell_stonewood", species: "stonewood" },
  { id: "fz_forage_e", kind: "forage_spot", x: 114, y: 78, name: "Roadside Fibreweed", resource: "surv_forage_fiber" },
  { id: "fz_shrine_e", kind: "shrine", x: 150, y: 78, name: "The Drowned Bell", lines: ["A ship's bell, green with age, hung from a lone oak far from any water. On a still day, they say, you can hear the sea answer it."] },
  { id: "fz_deer_e", kind: "monster", monster: "red_deer", x: 150, y: 90, name: "Red Deer" },
  // -- SE (city↔ashfen/redrun south) --
  { id: "fz_rock_se1", kind: "rock", x: 126, y: 102, name: "Embercite Seam", resource: "mine_embercite" },
  { id: "fz_tree_se1", kind: "tree", x: 114, y: 114, name: "Stonewood", resource: "fell_stonewood", species: "stonewood" },
  { id: "fz_shrine_se", kind: "shrine", x: 114, y: 126, name: "The Gallows Oak", lines: ["A vast dead oak, its branches worn smooth where ropes once hung. The outlaws give it a wide berth. So should you, after dark."] },
  { id: "fz_forage_se", kind: "forage_spot", x: 126, y: 126, name: "Scrubland Roots", resource: "surv_forage_fiber" },
  { id: "fz_lion_se", kind: "monster", monster: "mountain_lion", x: 126, y: 138, name: "Mountain Lion" },
  // -- S gap (city↔ashfen) --
  { id: "fz_tree_s1", kind: "tree", x: 78, y: 126, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz_rock_s1", kind: "rock", x: 90, y: 126, name: "Embercite Seam", resource: "mine_embercite" },
  { id: "fz_shrine_s", kind: "shrine", x: 102, y: 138, name: "The Warm Marker", lines: ["A boundary stone, warm to the touch though no fire's near it. The cult cut a spiral into its face. The hill-folk cut it back out."] },
  { id: "fz_bear_s", kind: "monster", monster: "forest_bear", x: 66, y: 138, name: "Forest Bear" },
  // -- SW (city↔heartmoor) --
  { id: "fz_tree_sw1", kind: "tree", x: 6, y: 102, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz_tree_sw2", kind: "tree", x: 18, y: 104, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz_shrine_sw", kind: "shrine", x: 18, y: 114, name: "The Sinking Chapel", lines: ["A little shrine the moor is slowly swallowing — its roof now a low green mound. The door still opens, onto a foot of black water."] },
  { id: "fz_forage_sw", kind: "forage_spot", x: 30, y: 126, name: "Moor-Edge Roots", resource: "surv_forage_fiber" },
  { id: "fz_wolf_sw", kind: "monster", monster: "hill_wolf", x: 6, y: 126, name: "Hill Wolf" },
  // -- Far frontiers (the map's wild edges) --
  { id: "fz_shrine_w", kind: "shrine", x: 6, y: 66, name: "The Last Fencepost", find: { flag: "searched_last_fence", found: "Wired to the fencepost's base against the weather, a wayfarer's tin: a few coins and a scrawled note. 'Turned back here. Good ground behind, only wood ahead. No shame in it.' Somebody made the edge and chose home.", gold: 400 }, lines: ["The last fencepost of the settled country, the wire long gone. This is a boundary, not a doorway — folk farm right up to here and no further, and sleep sound for it. Past it is only wood."] },
  { id: "fz_shrine_far_s", kind: "shrine", x: 54, y: 150, name: "The Ashen Reach", find: { flag: "searched_ashen_reach", found: "At the marker where the warm ground gives out, the cult keeps a cairn — and tucked in it, an offering-bowl of embercite left for whoever comes this far. You take it and turn back, as the cult means you to.", item: "embercite_ore", qty: 3, gold: 200 }, lines: ["Where the warm ground gives out to cold ash. The cult keeps a marker here — the edge of their reach, and anyone's. South is only ash and wind; this is the turning-place, not the way on."] },
  { id: "fz_bear_far", kind: "monster", monster: "forest_bear", x: 150, y: 138, name: "Forest Bear" },
  { id: "fz_deer_far1", kind: "monster", monster: "red_deer", x: 42, y: 150, name: "Red Deer" },
  { id: "fz_deer_far2", kind: "monster", monster: "red_deer", x: 66, y: 150, name: "Red Deer" },

  // -- Second pass: a node or landmark in each remaining traveled gap, so the
  //    whole interior reads as lived-in country (frontier borders left wild). --
  { id: "fz2_tree_1", kind: "tree", x: 18, y: 6, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fz2_rock_1", kind: "rock", x: 42, y: 6, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "fz2_tree_2", kind: "tree", x: 90, y: 6, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fz2_rock_2", kind: "rock", x: 102, y: 6, name: "Silica Deposit", resource: "mine_silica" },
  { id: "fz2_shrine_1", kind: "shrine", x: 114, y: 6, name: "The Frostward Stone", lines: ["A boundary stone facing the high pass, its face scoured smooth by wind. Somebody recut a single word into it: REMEMBER. Nothing says what."] },
  { id: "fz2_tree_3", kind: "tree", x: 78, y: 18, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz2_rock_3", kind: "rock", x: 90, y: 30, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "fz2_tree_4", kind: "tree", x: 102, y: 30, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz2_rock_4", kind: "rock", x: 18, y: 42, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "fz2_deer_1", kind: "monster", monster: "red_deer", x: 66, y: 54, name: "Red Deer" },
  { id: "fz2_tree_5", kind: "tree", x: 18, y: 66, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz2_forage_1", kind: "forage_spot", x: 42, y: 78, name: "Hillside Fibreweed", resource: "surv_forage_fiber" },
  { id: "fz2_deer_2", kind: "monster", monster: "red_deer", x: 138, y: 90, name: "Red Deer" },
  { id: "fz2_tree_6", kind: "tree", x: 54, y: 114, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz2_rock_5", kind: "rock", x: 78, y: 114, name: "Embercite Seam", resource: "mine_embercite" },
  { id: "fz2_tree_7", kind: "tree", x: 18, y: 126, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz2_rock_6", kind: "rock", x: 42, y: 126, name: "Knucklestone Rock", resource: "mine_knucklestone" },
  { id: "fz2_forage_2", kind: "forage_spot", x: 42, y: 138, name: "Moor-Edge Roots", resource: "surv_forage_fiber" },
  { id: "fz2_wolf_1", kind: "monster", monster: "hill_wolf", x: 54, y: 138, name: "Hill Wolf" },
  { id: "fz2_rock_7", kind: "rock", x: 114, y: 138, name: "Embercite Seam", resource: "mine_embercite" },
  { id: "fz2_deer_3", kind: "monster", monster: "red_deer", x: 138, y: 138, name: "Red Deer" },
  { id: "fz2_tree_8", kind: "tree", x: 30, y: 150, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz2_forage_3", kind: "forage_spot", x: 102, y: 150, name: "Ashen Roots", resource: "surv_forage_fiber" },
  { id: "fz2_tree_9", kind: "tree", x: 114, y: 150, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fz2_rock_8", kind: "rock", x: 126, y: 150, name: "Embercite Seam", resource: "mine_embercite" },
  { id: "fz2_bear_1", kind: "monster", monster: "forest_bear", x: 138, y: 150, name: "Forest Bear" },

  // -- Named minor sites (T6·06): a couple of the empty lattice gaps get a small
  //    DESTINATION — a searchable ruin among the scattered nodes — so open country
  //    rewards discovery, not just presence. Each pays a one-off finder's cache
  //    (reuses the relic/find reward loop). `fz`-prefixed so they snap to land. --
  { id: "fz_site_steading", kind: "shrine", x: 16, y: 46, name: "The Ruined Steading", find: { flag: "searched_steading", found: "You clear bramble from a collapsed croft — a family's whole holding, roof fallen in, hearth cold a generation. Under the flags where the hearth-stone sat, their strongbox: what they couldn't carry the year the frontier drove them back.", gold: 900, item: "worn_coin", qty: 2 }, lines: ["A steading gone back to the moor — walls to the knee, an orchard run wild. You've already turned the hearth-stone; what they left is yours."] },
  { id: "fz_site_poacher", kind: "shrine", x: 60, y: 54, name: "The Poacher's Cache", find: { flag: "found_poacher_cache", found: "A rotted snare-line strung between two ashwoods leads you to it: a poacher's cache dug in under a deadfall — cured hides, spare sinew, and the coin they'd not yet spent. Long abandoned. The forest kept it for you.", gold: 650, item: "sinew", qty: 4 }, lines: ["A poacher's old cache under a deadfall, its snare-lines rotted to threads. You've already taken what it held."] },

  // -- The western wood: dense trees down the whole west, so the forest reads as
  //    forest (gatherable Forestry; ids are fz* so they jitter + snap to land). --
  { id: "fzf_tree_1", kind: "tree", x: 8, y: 46, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_2", kind: "tree", x: 16, y: 50, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fzf_tree_3", kind: "tree", x: 6, y: 56, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fzf_tree_4", kind: "tree", x: 22, y: 58, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_5", kind: "tree", x: 12, y: 64, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fzf_tree_6", kind: "tree", x: 30, y: 66, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_7", kind: "tree", x: 8, y: 72, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fzf_tree_8", kind: "tree", x: 24, y: 74, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_9", kind: "tree", x: 34, y: 78, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fzf_tree_10", kind: "tree", x: 6, y: 90, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_11", kind: "tree", x: 18, y: 92, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fzf_tree_12", kind: "tree", x: 30, y: 96, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_13", kind: "tree", x: 10, y: 104, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fzf_tree_14", kind: "tree", x: 24, y: 108, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_15", kind: "tree", x: 36, y: 110, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fzf_tree_16", kind: "tree", x: 8, y: 118, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_17", kind: "tree", x: 22, y: 122, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fzf_tree_18", kind: "tree", x: 34, y: 126, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_19", kind: "tree", x: 12, y: 134, name: "Coldpine", resource: "fell_coldpine", species: "coldpine" },
  { id: "fzf_tree_20", kind: "tree", x: 28, y: 138, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_21", kind: "tree", x: 38, y: 56, name: "Greyoak", resource: "fell_greyoak", species: "greyoak" },
  { id: "fzf_tree_22", kind: "tree", x: 40, y: 96, name: "Ashwood Tree", resource: "fell_ashwood", species: "ashwood" },
  { id: "fzf_bear_w1", kind: "monster", monster: "forest_bear", x: 9, y: 87, name: "Forest Bear" }, // Bearwallow
  { id: "fzf_boar_w1", kind: "monster", monster: "wild_boar", x: 13, y: 73, name: "Wild Boar" }, // the Boar Run
  { id: "fzf_deer_w1", kind: "monster", monster: "red_deer", x: 20, y: 128, name: "Red Deer" },
  // -- The NE mining hills: ore veins between the river and the Marrow caves. --
  { id: "fzm_ore_1", kind: "rock", x: 106, y: 36, name: "Ashiron Vein", resource: "mine_ashiron" },
  { id: "fzm_ore_2", kind: "rock", x: 112, y: 40, name: "Gold Vein", resource: "mine_gold" },
  { id: "fzm_ore_3", kind: "rock", x: 116, y: 46, name: "Ribstone Seam", resource: "mine_ribstone" },
  { id: "fzm_ore_4", kind: "rock", x: 108, y: 50, name: "Rough Gem Rock", resource: "mine_rough_gem" },
  { id: "fzm_ore_5", kind: "rock", x: 118, y: 34, name: "Ashiron Vein", resource: "mine_ashiron" },
  { id: "fzm_lion_1", kind: "monster", monster: "mountain_lion", x: 60, y: 43, name: "Mountain Lion" }, // the Sunning Crags
  // -- The northern range: high crag-mining and a hardy beast or two. --
  { id: "fzn_ore_1", kind: "rock", x: 30, y: 18, name: "Silica Deposit", resource: "mine_silica" },
  { id: "fzn_ore_2", kind: "rock", x: 100, y: 18, name: "Ashiron Vein", resource: "mine_ashiron" },
  { id: "fzn_ore_3", kind: "rock", x: 130, y: 16, name: "Silica Deposit", resource: "mine_silica" },
  { id: "fzn_lion_1", kind: "monster", monster: "mountain_lion", x: 54, y: 47, name: "Mountain Lion" }, // the Sunning Crags

  // === FARMING RUN — a plant + tree patch pair at every settlement, so the
  // skill is a circuit of the whole map (waystones make the run). ============
  { id: "patch_fold", kind: "plant_patch", x: 79, y: 44, name: "Plant Patch" },
  { id: "treepatch_fold", kind: "tree_patch", x: 77, y: 44, name: "Tree Patch" },
  { id: "patch_frostgate", kind: "plant_patch", x: 47, y: 21, name: "Plant Patch" },
  { id: "treepatch_frostgate", kind: "tree_patch", x: 53, y: 21, name: "Tree Patch" },
  { id: "patch_deeplight", kind: "plant_patch", x: 122, y: 28, name: "Plant Patch" },
  { id: "treepatch_deeplight", kind: "tree_patch", x: 128, y: 28, name: "Tree Patch" },
  { id: "patch_saltreach", kind: "plant_patch", x: 143, y: 107, name: "Plant Patch" },
  { id: "treepatch_saltreach", kind: "tree_patch", x: 149, y: 101, name: "Tree Patch" },
  { id: "patch_emberhearth", kind: "plant_patch", x: 74, y: 144, name: "Plant Patch" },
  { id: "treepatch_emberhearth", kind: "tree_patch", x: 80, y: 144, name: "Tree Patch" },
  { id: "patch_mirehold", kind: "plant_patch", x: 12, y: 142, name: "Plant Patch" },
  { id: "treepatch_mirehold", kind: "tree_patch", x: 18, y: 142, name: "Tree Patch" },
  { id: "patch_lodgehold", kind: "plant_patch", x: 10, y: 84, name: "Plant Patch" },
  { id: "treepatch_lodgehold", kind: "tree_patch", x: 16, y: 84, name: "Tree Patch" },

  // === WATERSIDE + WOODLAND DRESSING — cattails at pond edges, dead trees in
  // the old woods, so wild ground reads lived-in by nature itself. ============
  { id: "reed_lake_1", kind: "reeds", x: 64, y: 104, name: "Cattails" },
  { id: "reed_lake_2", kind: "reeds", x: 62, y: 108, name: "Cattails" },
  { id: "reed_lake_3", kind: "reeds", x: 58, y: 109, name: "Cattails" },
  { id: "reed_tarn_1", kind: "reeds", x: 49, y: 61, name: "Cattails" },
  { id: "reed_tarn_2", kind: "reeds", x: 53, y: 60, name: "Cattails" },
  { id: "reed_moor_1", kind: "reeds", x: 8, y: 140, name: "Cattails" },
  { id: "reed_moor_2", kind: "reeds", x: 24, y: 145, name: "Cattails" },
  { id: "reed_estuary_1", kind: "reeds", x: 132, y: 108, name: "Cattails" },
  { id: "reed_estuary_2", kind: "reeds", x: 139, y: 112, name: "Cattails" },
  { id: "dead_gw_1", kind: "deadfall", species: "log", x: 8, y: 80, name: "Fallen Greyoak" },
  { id: "dead_gw_2", kind: "deadfall", species: "snag", x: 22, y: 76, name: "Dead Snag" },
  { id: "dead_gw_3", kind: "deadfall", species: "log", x: 16, y: 86, name: "Fallen Greyoak" },
  { id: "dead_ww_1", kind: "deadfall", species: "snag", x: 12, y: 58, name: "Dead Snag" },
  { id: "dead_ww_2", kind: "deadfall", species: "log", x: 28, y: 68, name: "Mossy Deadfall" },
  { id: "dead_ww_3", kind: "deadfall", species: "log", x: 18, y: 112, name: "Mossy Deadfall" },
  { id: "dead_ww_4", kind: "deadfall", species: "snag", x: 32, y: 122, name: "Dead Snag" },
  { id: "dead_ww_5", kind: "deadfall", species: "log", x: 10, y: 128, name: "Fallen Greyoak" },
  { id: "dead_e_1", kind: "deadfall", species: "snag", x: 120, y: 92, name: "Dead Snag" },
  { id: "dead_e_2", kind: "deadfall", species: "log", x: 128, y: 74, name: "Mossy Deadfall" },

  // === THE ESTUARY LOG CROSSING — a whole fallen greyoak spans the Redrun's
  // last quiet stretch before the sea. A free-standing Agility obstacle: cross
  // from either bank (lvl 15), no course, a shortcut the trail runners love.
  { id: "log_cross_w", kind: "agility_obstacle", obstacle: "logbridge", x: 133, y: 120, exit: { x: 138, y: 120 }, xp: 120, levelReq: 15, name: "Fallen Greyoak Crossing", lines: ["A whole greyoak lies over the Redrun, worn smooth down its spine by crossing boots."] },
  { id: "log_cross_e", kind: "agility_obstacle", obstacle: "stump", x: 138, y: 120, exit: { x: 133, y: 120 }, xp: 120, levelReq: 15, name: "Fallen Greyoak Crossing", lines: ["The old log's landing — the far bank is a few sure steps away."] },
];

/** The world's objects: every hand-authored spawn re-homed onto the doubled
 *  canvas via remap(), the new open-country POIs (new coords, not re-mapped),
 *  plus the player-home interiors (authored in the new band by buildHousing()). */
// --- The Drowned Pier off the Redrun estuary (canvas coords, NOT remapped).
//     The warden gives the unlock quest; once done, the gate vanishes and the
//     cast point + records board appear. Coords are shared with the map carve via
//     PIER so the planks, the gate-neck and the cast tile always line up. ---
const pierObjects: WorldObjectDef[] = [
  {
    id: "pier_warden", kind: "npc", x: PIER.warden.x, y: PIER.warden.y, name: "Jacob, the Pier-Warden",
    lines: [
      "Storms took the old pier years back. I've been re-laying the boards plank by plank — slow work, for old hands.",
      "There's deep water off the end where the real fish run. Not estuary tiddlers — Eyeless Bass, Greatpike, things with weight to them.",
      "Help me prove the deck'll hold and I'll let you fish it. And mind the board at the head — every great catch goes up on it, with the angler's name.",
    ],
  },
  {
    id: "pier_sign", kind: "signpost", x: PIER.sign.x, y: PIER.sign.y, name: "The Drowned Pier",
    lines: ["THE DROWNED PIER — re-laid over the deep where the Redrun meets the Eyeless Sea. Hold the line: ease off when it runs, haul when it tires."],
  },
  {
    id: "pier_gate", kind: "pier_gate", x: PIER.gate.x, y: PIER.gate.y, name: "Roped Barrier",
    hiddenByFlag: "pier_access",
    lines: ["A rope strung across the planks. The warden hasn't given you leave to pass."],
  },
  {
    id: "pier_spot", kind: "pier_spot", x: PIER.cast.x, y: PIER.cast.y, name: "Deep-Water Cast",
    requiresFlag: "pier_access",
  },
  {
    id: "pier_board", kind: "record_board", x: PIER.board.x, y: PIER.board.y, name: "Pier Records Board",
    requiresFlag: "pier_access",
  },
];

/**
 * The Act II dungeon sites' furniture, in FINAL map coordinates (the sites are
 * carved below the remapped world, so nothing here passes through remap()).
 * Geometry lives in content/dungeons.ts; the mouth of each site stands where
 * its old single-room arena portal stood, so discovery geography is unchanged.
 */
function buildDungeonSites(): WorldObjectDef[] {
  const out: WorldObjectDef[] = [];

  // --- SITE 1: The Hollow Barrows — the old grove cave-mouth, now a true
  //     barrow-crawl. Three carved levers (wolf → moon → crown, recited by the
  //     funeral plaques) unseal the slab before the resting hall.
  const barrow = DUNGEONS.find((d) => d.id === "hollow_barrows")!;
  const mouth = remap(108, 24); // the grove cave-mouth (same spot as the old portal)
  out.push(
    {
      id: "portal_hollow", kind: "portal", x: mouth.x, y: mouth.y, name: "The Hollow Barrows",
      dungeon: "hollow_barrows", target: { x: barrow.x0 + barrow.entry.x, y: barrow.y0 + barrow.entry.y },
      lines: ["Cold, still air breathes up from the dark. You climb down into the Hollow Barrows."],
    },
    { id: "ret_hollow", kind: "portal", x: barrow.x0 + barrow.exit.x, y: barrow.y0 + barrow.exit.y, name: "Barrow Exit", target: { x: mouth.x, y: mouth.y + 1 }, lines: ["You climb back into the daylight."] },
    // The sealed slab: the only way east, until the levers are thrown in order.
    {
      id: "gate_barrow", kind: "dungeon_gate", x: 45, y: 207, name: "Sealed Slab",
      hiddenByFlag: "pz_barrow_levers",
      lines: ["A slab of grave-stone, fitted so close a knife wouldn't pass. Three carved lever-mounts run back along the halls — the burial plaques will know their order."],
    },
    // The levers, scattered so the halls must be explored.
    { id: "lev_barrow_wolf", kind: "puzzle_lever", x: 40, y: 205, name: "Wolf-Carved Lever", puzzle: "barrow_levers", order: 0, lines: ["An iron lever set in a wolf's gaping jaw."] },
    { id: "lev_barrow_moon", kind: "puzzle_lever", x: 37, y: 201, name: "Moon-Carved Lever", puzzle: "barrow_levers", order: 1, lines: ["An iron lever under a waning moon, up a dead-end stair."] },
    { id: "lev_barrow_crown", kind: "puzzle_lever", x: 33, y: 213, name: "Crown-Carved Lever", puzzle: "barrow_levers", order: 2, lines: ["An iron lever beneath a graven crown, down in the flooded nook."] },
    // The funeral plaques that recite the order.
    { id: "plq_barrow_1", kind: "signpost", x: 31, y: 204, name: "Funeral Plaque", lines: ["'FIRST ran the WOLF, ahead of all the host, and the dark parted before her.'"] },
    { id: "plq_barrow_2", kind: "signpost", x: 35, y: 204, name: "Funeral Plaque", lines: ["'SECOND rose the MOON, that followed the wolf across the ice, and kept her.'"] },
    { id: "plq_barrow_3", kind: "signpost", x: 39, y: 204, name: "Funeral Plaque", lines: ["'And LAST of all came the CROWN, borne behind wolf and moon, to the gate that waits under the mountains.'"] },
    // The Barrow-King's chest, in the resting hall past the slab. (D2 dresses
    // the hall with its dead and seats the mini-boss; the chest's true prizes —
    // the unique and the first tablet — arrive with the quest chain.)
    // The dead of the barrow, posted through the halls.
    { id: "bw_bat_1", kind: "monster", monster: "deep_bat", x: 19, y: 204, name: "Barrow Shrieker" },
    { id: "bw_bat_2", kind: "monster", monster: "deep_bat", x: 24, y: 206, name: "Barrow Shrieker" },
    { id: "bw_wraith_1", kind: "monster", monster: "marrow_wraith", x: 33, y: 208, name: "Barrow Wight" },
    { id: "bw_wraith_2", kind: "monster", monster: "marrow_wraith", x: 45, y: 199, name: "Barrow Wight" },
    // The Grave-Sentinel keeps the switchback galleries — and the King's key.
    { id: "bw_sentinel", kind: "monster", monster: "barrow_sentinel", x: 56, y: 203, name: "Grave-Sentinel" },
    // The King's door: locked, not puzzled — the key walks the halls.
    {
      id: "gate_barrow2", kind: "dungeon_gate", x: 61, y: 204, name: "The King's Door",
      hiddenByFlag: "key_gate_barrow2", keyItem: "barrow_key",
      lines: ["A door of grave-iron, triple-locked. The sentinels of these halls would carry its key."],
    },
    // The resting hall: the Barrow-King and his honour guard.
    { id: "bw_king", kind: "monster", monster: "barrow_king", x: 65, y: 212, name: "The Barrow-King" },
    { id: "bw_guard", kind: "monster", monster: "marrow_wraith", x: 69, y: 210, name: "Honour-Guard" },
    { id: "chest_barrow", kind: "dungeon_chest", x: 70, y: 212, name: "Barrow-King's Chest", loot: [{ item: "barrow_king_signet", qty: 1 }, { item: "tablet_barrow", qty: 1 }, { item: "cut_gem", qty: 2 }], lines: ["A long chest of black oak, banded in silver gone dark."] },
  );
  // --- SITE 2: The Spine Vault — the mountain vault in the northern pass,
  //     sealed from the inside. Four weigh-locks in the counting-cells (the
  //     tally-stones recite the order), the warded stair, a sentinel bearing
  //     the Wardens' Key, and the Vaultwright's treasury.
  const vault = DUNGEONS.find((d) => d.id === "spine_vault")!;
  // The vault door, set into the mountain face on the high pass. (A later terrain
  // pass flooded the original remap(50,12) spot into a tarn, stranding anyone who
  // stepped out — so the door sits on solid rock beside the peak now.)
  const vmouth = { x: 61, y: 15 };
  const vx = vault.x0, vy = vault.y0;
  out.push(
    {
      id: "portal_spine", kind: "portal", x: vmouth.x, y: vmouth.y, name: "The Spine Vault",
      dungeon: "spine_vault", target: { x: vx + vault.entry.x, y: vy + vault.entry.y },
      lines: ["The dressed-stone door gives at last. Stale mountain air, and dark going down. You enter the Spine Vault."],
    },
    { id: "ret_spine", kind: "portal", x: vx + vault.exit.x, y: vy + vault.exit.y, name: "Vault Exit", target: { x: vmouth.x, y: vmouth.y + 1 }, lines: ["You leave the vault to its silence."] },
    // The weigh-locks, one to a counting-cell off the gallery.
    { id: "lev_vault_1", kind: "puzzle_lever", x: vx + 17, y: vy + 3, name: "Weigh-Lock I", puzzle: "vault_locks", order: 0, lines: ["A counter-weighted lock-arm, stamped with a single tally."] },
    { id: "lev_vault_2", kind: "puzzle_lever", x: vx + 29, y: vy + 18, name: "Weigh-Lock II", puzzle: "vault_locks", order: 1, lines: ["A counter-weighted lock-arm, stamped with two tallies."] },
    { id: "lev_vault_3", kind: "puzzle_lever", x: vx + 29, y: vy + 3, name: "Weigh-Lock III", puzzle: "vault_locks", order: 2, lines: ["A counter-weighted lock-arm, stamped with three tallies."] },
    { id: "lev_vault_4", kind: "puzzle_lever", x: vx + 17, y: vy + 18, name: "Weigh-Lock IIII", puzzle: "vault_locks", order: 3, lines: ["A counter-weighted lock-arm, stamped with four tallies."] },
    // The tally-stones that recite the count and its compass.
    { id: "plq_vault_1", kind: "signpost", x: vx + 18, y: vy + 8, name: "Tally-Stone", lines: ["'ONE weight to the NORTH-WEST cell, where the count begins.'"] },
    { id: "plq_vault_2", kind: "signpost", x: vx + 24, y: vy + 8, name: "Tally-Stone", lines: ["'TWO to the SOUTH-EAST, across the gallery — the count crosses, always.'"] },
    { id: "plq_vault_3", kind: "signpost", x: vx + 30, y: vy + 8, name: "Tally-Stone", lines: ["'THREE to the NORTH-EAST, FOUR to the SOUTH-WEST — and the stair unbars for honest hands.'"] },
    // The warded stair-gate, opened by the count.
    {
      id: "gate_vault", kind: "dungeon_gate", x: vx + 36, y: vy + 11, name: "Warded Stair-Gate",
      hiddenByFlag: "pz_vault_locks",
      lines: ["A gate of ward-stone across the stair. Four weigh-locks hold it; the tally-stones keep their count."],
    },
    // The vault's keepers.
    { id: "sv_bat_1", kind: "monster", monster: "deep_bat", x: vx + 21, y: vy + 6, name: "Vault Shrieker" },
    { id: "sv_wraith_1", kind: "monster", monster: "spine_wraith", x: vx + 27, y: vy + 14, name: "Vault Wraith" },
    { id: "sv_sentinel", kind: "monster", monster: "vault_sentinel", x: vx + 46, y: vy + 4, name: "Vault-Sentinel" },
    { id: "sv_golem", kind: "monster", monster: "deep_golem", x: vx + 51, y: vy + 8, name: "Ward-Golem" },
    { id: "sv_wraith_2", kind: "monster", monster: "spine_wraith", x: vx + 49, y: vy + 15, name: "Vault Wraith" },
    // The strongdoor: keyed, not puzzled — the sentinel of the stair bears it.
    {
      id: "gate_vault_door", kind: "dungeon_gate", x: vx + 56, y: vy + 15, name: "Wardens' Strongdoor",
      hiddenByFlag: "key_gate_vault_door", keyItem: "vault_key",
      lines: ["Vault-steel, without a seam. The Wardens' Key answers it — the stair's keeper would carry that."],
    },
    // The treasury: the Vaultwright, and what it tends.
    { id: "sv_warden", kind: "monster", monster: "vault_warden", x: vx + 61, y: vy + 15, name: "The Vaultwright" },
    {
      id: "chest_vault", kind: "dungeon_chest", x: vx + 63, y: vy + 18, name: "Wardens' Coffer",
      loot: [{ item: "delvers_lantern", qty: 1 }, { item: "tablet_vault", qty: 1 }, { item: "ashiron_bar", qty: 2 }],
      lines: ["A coffer of vault-steel and heart-oak, its wax seals unbroken since the door shut."],
    },
  );

  // --- SITE 3: The Sunken Court — the drowned seat of the old north-folk in
  //     the Heartmoor (the retired Bog Barrow mouth). Twice the crawl: the
  //     tide-sluices open the Tide Gate; the nave's four bells, rung in the
  //     psalm's order, open the Bell Door; the Reliquarist bears the key to
  //     the reliquary; the lower approach ends at the Magistrate's throne room.
  const court = DUNGEONS.find((d) => d.id === "sunken_court")!;
  const cmouth = remap(15, 98); // where the bog mouth always stood
  const cx = court.x0, cy = court.y0;
  out.push(
    {
      id: "portal_court", kind: "portal", x: cmouth.x, y: cmouth.y, name: "The Sunken Court",
      dungeon: "sunken_court", target: { x: cx + court.entry.x, y: cy + court.entry.y },
      lines: ["Steps of drowned marble go down under the moor. The water stands aside, just barely, in the old causeway. You descend into the Sunken Court."],
    },
    { id: "ret_court", kind: "portal", x: cx + court.exit.x, y: cy + court.exit.y, name: "Causeway Out", target: { x: cmouth.x, y: cmouth.y + 1 }, lines: ["You climb the causeway back to the moor's grey daylight."] },
    // Surface ruin: the court's drowned masonry breaking the moor around the mouth.
    { id: "ruin_court_1", kind: "ruin_prop", x: cmouth.x - 2, y: cmouth.y - 1, name: "Broken Pillar", lines: ["A marble pillar snapped at knee height, carved with the court's scales. The moor is slowly swallowing it."] },
    { id: "ruin_court_2", kind: "ruin_prop", x: cmouth.x + 2, y: cmouth.y - 1, name: "Fallen Arch", lines: ["Half an arch, face-down in the peat. The half still standing frames the way down."] },
    { id: "ruin_court_3", kind: "ruin_prop", x: cmouth.x - 1, y: cmouth.y + 2, name: "Drowned Masonry", lines: ["Dressed stone in the black water — a wall's worth, going down further than the light does."] },
    { id: "ruin_court_4", kind: "ruin_prop", x: cmouth.x + 3, y: cmouth.y + 1, name: "Sunken Balustrade", lines: ["A run of carved railing, tilted into the bog. Whoever built this expected the water to keep its place."] },
    // Stage one: the tide-sluices, recited by the mosaic floor.
    { id: "lev_court_1", kind: "puzzle_lever", x: cx + 15, y: cy + 5, name: "Tide-Sluice: the EBB", puzzle: "court_sluices", order: 0, lines: ["A bronze sluice-wheel green with age, cast with a falling waterline."] },
    { id: "lev_court_2", kind: "puzzle_lever", x: cx + 43, y: cy + 5, name: "Tide-Sluice: the SLACK", puzzle: "court_sluices", order: 1, lines: ["A bronze sluice-wheel cast with a level waterline, dead still."] },
    { id: "lev_court_3", kind: "puzzle_lever", x: cx + 29, y: cy + 12, name: "Tide-Sluice: the FLOOD", puzzle: "court_sluices", order: 2, lines: ["A bronze sluice-wheel cast with a rising waterline, down among the silt."] },
    { id: "plq_court_1", kind: "signpost", x: cx + 26, y: cy + 8, name: "Mosaic Inscription", lines: ["'The court kept the tide's own order: FIRST the EBB, that empties the halls.'"] },
    { id: "plq_court_2", kind: "signpost", x: cx + 29, y: cy + 8, name: "Mosaic Inscription", lines: ["'SECOND the SLACK, when the water stands to hear the verdict.'"] },
    { id: "plq_court_3", kind: "signpost", x: cx + 32, y: cy + 8, name: "Mosaic Inscription", lines: ["'And LAST the FLOOD, that carries the sentence out. So the Tide Gate is served.'"] },
    {
      id: "gate_court_tide", kind: "dungeon_gate", x: cx + 50, y: cy + 8, name: "The Tide Gate",
      hiddenByFlag: "pz_court_sluices",
      lines: ["A gate of verdigrised bronze, holding back a hall's worth of black water. Three sluices command it — the mosaic floor recites their order."],
    },
    // Stage two: the drowned nave and its four bells.
    { id: "lev_court_b1", kind: "puzzle_lever", x: cx + 63, y: cy + 1, name: "The Matins Bell", puzzle: "court_bells", order: 0, lines: ["A great bell gone green, its rope long rotted — the striker still swings."] },
    { id: "lev_court_b2", kind: "puzzle_lever", x: cx + 85, y: cy + 18, name: "The Vespers Bell", puzzle: "court_bells", order: 1, lines: ["A great bell in the south-east cell, silt to its rim."] },
    { id: "lev_court_b3", kind: "puzzle_lever", x: cx + 85, y: cy + 1, name: "The Sext Bell", puzzle: "court_bells", order: 2, lines: ["A great bell in the north-east cell, its crown carved with a noon sun."] },
    { id: "lev_court_b4", kind: "puzzle_lever", x: cx + 63, y: cy + 18, name: "The Compline Bell", puzzle: "court_bells", order: 3, lines: ["A great bell in the south-west cell, carved with the last stars of the day."] },
    { id: "plq_court_b1", kind: "signpost", x: cx + 70, y: cy + 9, name: "Psalter Stand", lines: ["'Ring MATINS at waking, though the court wakes no more —'"] },
    { id: "plq_court_b2", kind: "signpost", x: cx + 74, y: cy + 9, name: "Psalter Stand", lines: ["'— then VESPERS, out of season, for the drowned keep evening first —'"] },
    { id: "plq_court_b3", kind: "signpost", x: cx + 78, y: cy + 9, name: "Psalter Stand", lines: ["'— then SEXT, the noon the water never sees —'"] },
    { id: "plq_court_b4", kind: "signpost", x: cx + 82, y: cy + 9, name: "Psalter Stand", lines: ["'— and COMPLINE last, to put the court to bed. So the Bell Door hears its office and opens.'"] },
    {
      id: "gate_court_bell", kind: "dungeon_gate", x: cx + 92, y: cy + 17, name: "The Bell Door",
      hiddenByFlag: "pz_court_bells",
      lines: ["A door faced in bell-bronze, without handle or hinge. Four bells hang in the nave's cells; the psalter stands keep their office."],
    },
    // The court's dead, posted through the halls.
    { id: "ct_thrall_1", kind: "monster", monster: "drowned_thrall", x: cx + 20, y: cy + 16, name: "Drowned Thrall" },
    { id: "ct_wisp_1", kind: "monster", monster: "court_wisp", x: cx + 38, y: cy + 6, name: "Court-Light" },
    { id: "ct_thrall_2", kind: "monster", monster: "drowned_thrall", x: cx + 70, y: cy + 5, name: "Drowned Thrall" },
    { id: "ct_wisp_2", kind: "monster", monster: "court_wisp", x: cx + 86, y: cy + 13, name: "Court-Light" },
    { id: "ct_thrall_3", kind: "monster", monster: "drowned_thrall", x: cx + 55, y: cy + 21, name: "Drowned Thrall" },
    // The Reliquarist keeps the processional's west end — and the reliquary key.
    { id: "ct_reliquarist", kind: "monster", monster: "court_reliquarist", x: cx + 38, y: cy + 20, name: "The Reliquarist" },
    {
      id: "gate_court_rel", kind: "dungeon_gate", x: cx + 35, y: cy + 23, name: "Reliquary Door",
      hiddenByFlag: "key_gate_court_rel", keyItem: "court_key",
      lines: ["A low door of green bronze, triple-sealed. The court's Reliquarist would never have let its key out of reach."],
    },
    { id: "ct_wisp_3", kind: "monster", monster: "court_wisp", x: cx + 70, y: cy + 28, name: "Court-Light" },
    // The throne room: the Magistrate, his bailiffs, and the court's coffer.
    { id: "ct_bailiff_1", kind: "monster", monster: "drowned_thrall", x: cx + 108, y: cy + 30, name: "Drowned Bailiff" },
    { id: "ct_bailiff_2", kind: "monster", monster: "drowned_thrall", x: cx + 118, y: cy + 28, name: "Drowned Bailiff" },
    { id: "ct_magistrate", kind: "monster", monster: "drowned_magistrate", x: cx + 114, y: cy + 32, name: "The Drowned Magistrate" },
    {
      id: "chest_court", kind: "dungeon_chest", x: cx + 121, y: cy + 36, name: "The Court Coffer",
      loot: [{ item: "drowned_seal", qty: 1 }, { item: "tablet_court", qty: 1 }, { item: "cut_gem", qty: 3 }],
      lines: ["The court's strong-coffer, banded in river-silver, dry inside against all sense."],
    },
    // A drowned stair back to the moor, so the victory lap isn't a hike.
    { id: "ret_court_b", kind: "portal", x: cx + 124, y: cy + 38, name: "Drowned Stair", target: { x: cmouth.x, y: cmouth.y + 1 }, lines: ["A service stair, rising through the peat. You come up blinking on the moor."] },
  );

  // --- SITE 4: Skyreach Ruin — the north-folk's watch-aerie on the east
  //     Spine. Four switchback terraces climb to the star-chart gallery
  //     (beacons in the charts' order open the Wind Door), the counterweight
  //     cells open the Gale Stair, the Warder of the Traverse bears the Eyrie
  //     Key, and the final ascent ends in the Storm-Herald's eyrie.
  const sky = DUNGEONS.find((d) => d.id === "skyreach")!;
  const smouth = remap(78, 8); // a shoulder of the east Spine, past the wind-shrine
  const sx = sky.x0, sy = sky.y0;
  out.push(
    {
      id: "portal_sky", kind: "portal", x: smouth.x, y: smouth.y, name: "Skyreach Ruin",
      dungeon: "skyreach", target: { x: sx + sky.entry.x, y: sy + sky.entry.y },
      lines: ["A doorway in the mountainside, its lintel carved with stars. The wind goes in ahead of you. You enter Skyreach."],
    },
    { id: "ret_sky", kind: "portal", x: sx + sky.exit.x, y: sy + sky.exit.y, name: "Mountain Door", target: { x: smouth.x, y: smouth.y + 1 }, lines: ["You step back out onto the pass, and the wind takes its toll."] },
    // Surface ruin: the aerie's fallen watchworks on the shoulder of the pass.
    { id: "ruin_sky_1", kind: "ruin_prop", x: smouth.x - 2, y: smouth.y - 1, name: "Toppled Watchtower", lines: ["The stump of a watchtower, sheared off by a thousand winters. Its upper courses lie down the slope in order, like a felled tree."] },
    { id: "ruin_sky_2", kind: "ruin_prop", x: smouth.x + 2, y: smouth.y - 1, name: "Broken Beacon-Cradle", lines: ["An iron basket big enough to bathe in, rusted to lace. When this held fire, they say, you could read by it in Ironvale."] },
    { id: "ruin_sky_3", kind: "ruin_prop", x: smouth.x - 1, y: smouth.y + 2, name: "Carved Rubble", lines: ["A drift of dressed stone: star-charts, wind-roses, and one carved word no one reads anymore."] },
    { id: "ruin_sky_4", kind: "ruin_prop", x: smouth.x + 3, y: smouth.y + 1, name: "Fallen Stair", lines: ["A grand stair to nowhere — its top forty steps are somewhere down the mountain."] },
    // Stage one: the beacons, in the order the star-charts climb.
    { id: "lev_sky_1", kind: "puzzle_lever", x: sx + 5, y: sy + 14, name: "The Dusk Beacon", puzzle: "sky_beacons", order: 0, lines: ["A beacon-lamp of storm-glass in the gallery's west wall, cold a thousand years."] },
    { id: "lev_sky_2", kind: "puzzle_lever", x: sx + 29, y: sy + 14, name: "The Midnight Beacon", puzzle: "sky_beacons", order: 1, lines: ["A beacon-lamp of storm-glass in the gallery's east wall."] },
    { id: "lev_sky_3", kind: "puzzle_lever", x: sx + 17, y: sy + 19, name: "The Dawn Beacon", puzzle: "sky_beacons", order: 2, lines: ["A beacon-lamp of storm-glass at the gallery's south rail, facing the long fall."] },
    { id: "plq_sky_1", kind: "signpost", x: sx + 12, y: sy + 16, name: "Star-Chart", lines: ["'The watch is lit as the night is walked: DUSK carries the first hour.'"] },
    { id: "plq_sky_2", kind: "signpost", x: sx + 16, y: sy + 16, name: "Star-Chart", lines: ["'MIDNIGHT carries the second, when the pass is blind.'"] },
    { id: "plq_sky_3", kind: "signpost", x: sx + 20, y: sy + 16, name: "Star-Chart", lines: ["'DAWN carries the last, and hands the road back to the sun. So the Wind Door knows the watch is kept.'"] },
    {
      id: "gate_sky_wind", kind: "dungeon_gate", x: sx + 36, y: sy + 16, name: "The Wind Door",
      hiddenByFlag: "pz_sky_beacons",
      lines: ["A door that is mostly a howl — wind pouring through carved baffles, hard enough to stand on. Three beacons flank the gallery; the star-charts keep their watch-order."],
    },
    // Stage two: the counterweight cells off the wind hall.
    { id: "lev_sky_w1", kind: "puzzle_lever", x: sx + 49, y: sy + 7, name: "Counterweight: the ANVIL", puzzle: "sky_weights", order: 0, lines: ["A counterweight the size of an anvil, hung on chain that still runs true."] },
    { id: "lev_sky_w2", kind: "puzzle_lever", x: sx + 73, y: sy + 22, name: "Counterweight: the PLOUGH", puzzle: "sky_weights", order: 1, lines: ["A counterweight cast as a plough-blade, in the south-east cell."] },
    { id: "lev_sky_w3", kind: "puzzle_lever", x: sx + 73, y: sy + 7, name: "Counterweight: the CROWN", puzzle: "sky_weights", order: 2, lines: ["A counterweight cast as a crown, in the north-east cell."] },
    { id: "lev_sky_w4", kind: "puzzle_lever", x: sx + 49, y: sy + 22, name: "Counterweight: the GATE", puzzle: "sky_weights", order: 3, lines: ["A counterweight cast as a gate, in the south-west cell — the last thing the mountain weighs."] },
    { id: "plq_sky_w1", kind: "signpost", x: sx + 54, y: sy + 15, name: "Carved Relief", lines: ["'What the mountain weighs, it weighs in order: the ANVIL first, for the work —'"] },
    { id: "plq_sky_w2", kind: "signpost", x: sx + 60, y: sy + 15, name: "Carved Relief", lines: ["'— the PLOUGH second, for the bread —'"] },
    { id: "plq_sky_w3", kind: "signpost", x: sx + 64, y: sy + 15, name: "Carved Relief", lines: ["'— the CROWN third, for the law —'"] },
    { id: "plq_sky_w4", kind: "signpost", x: sx + 70, y: sy + 15, name: "Carved Relief", lines: ["'— and the GATE last, for the road north. So the Gale Stair unbars.'"] },
    {
      id: "gate_sky_gale", kind: "dungeon_gate", x: sx + 86, y: sy + 15, name: "The Gale Stair",
      hiddenByFlag: "pz_sky_weights",
      lines: ["A stair sealed behind a shutter of storm-iron. Four counterweights hang in the hall's cells; the reliefs recite what the mountain weighs, and in what order."],
    },
    // The aerie's garrison.
    { id: "sk_harpy_1", kind: "monster", monster: "aerie_harpy", x: sx + 20, y: sy + 37, name: "Aerie Shriker" },
    { id: "sk_wisp_1", kind: "monster", monster: "storm_wisp", x: sx + 25, y: sy + 26, name: "Storm-Wisp" },
    { id: "sk_harpy_2", kind: "monster", monster: "aerie_harpy", x: sx + 55, y: sy + 12, name: "Aerie Shriker" },
    { id: "sk_wisp_2", kind: "monster", monster: "storm_wisp", x: sx + 78, y: sy + 18, name: "Storm-Wisp" },
    // The Warder walks the traverse with the Eyrie Key.
    { id: "sk_warder", kind: "monster", monster: "sky_warder", x: sx + 64, y: sy + 26, name: "Warder of the Traverse" },
    {
      id: "gate_sky_eyrie", kind: "dungeon_gate", x: sx + 52, y: sy + 29, name: "The Eyrie Door",
      hiddenByFlag: "key_gate_sky_eyrie", keyItem: "sky_key",
      lines: ["A door of storm-iron, bolted from this side against something above. The traverse's Warder kept its key."],
    },
    { id: "sk_harpy_3", kind: "monster", monster: "aerie_harpy", x: sx + 75, y: sy + 31, name: "Aerie Shriker" },
    { id: "sk_wisp_3", kind: "monster", monster: "storm_wisp", x: sx + 100, y: sy + 31, name: "Storm-Wisp" },
    // The eyrie: the Storm-Herald and the watch's strongbox.
    { id: "sk_harpy_4", kind: "monster", monster: "aerie_harpy", x: sx + 110, y: sy + 24, name: "Herald's Hawk" },
    { id: "sk_herald", kind: "monster", monster: "storm_herald", x: sx + 115, y: sy + 21, name: "The Storm-Herald" },
    {
      id: "chest_sky", kind: "dungeon_chest", x: sx + 123, y: sy + 19, name: "The Watch Strongbox",
      loot: [{ item: "storm_mantle", qty: 1 }, { item: "tablet_sky", qty: 1 }, { item: "ashiron_bar", qty: 3 }],
      lines: ["The watch's strongbox, lashed down against wind that could lift a man. The lashings hold a thousand years of knots."],
    },
    // The signal-shaft back down to the pass.
    { id: "ret_sky_b", kind: "portal", x: sx + 105, y: sy + 25, name: "Signal-Shaft", target: { x: smouth.x, y: smouth.y + 1 }, lines: ["A shaft the watch used to drop messages down the mountain. It fits a person, barely."] },
  );

  // --- SITE 5: THE UNDERGATE — the Act II finale, under the heart of the
  //     pass. Hidden from the world (requiresFlag act2_tablets_all) until
  //     Maerwen reads all four tablets; the longest crawl in the game — five
  //     sealed chokes: the Seal Hall's five levers in the psalm's order, the
  //     Gatewright's keyed door, the Echo Gallery's four watches, the
  //     Herald's keyed door on the deep stair, and the wolf-road waymarks
  //     before the Warden's Hall and the North Door itself.
  const under = DUNGEONS.find((d) => d.id === "undergate")!;
  const umouth = remap(57, 5); // under the heart of the high pass
  const ux = under.x0, uy = under.y0;
  const REVEAL = "act2_tablets_all";
  out.push(
    {
      id: "portal_under", kind: "portal", x: umouth.x, y: umouth.y, name: "The Undergate",
      requiresFlag: REVEAL,
      dungeon: "undergate", target: { x: ux + under.entry.x, y: uy + under.entry.y },
      lines: ["Exactly where Maerwen marked it: a door under the mountain's heart, on no map, off every road. The Pale script above the lintel reads simply: UNTIL. You go down."],
    },
    { id: "ret_under", kind: "portal", x: ux + under.exit.x, y: uy + under.exit.y, name: "The Long Climb", target: { x: umouth.x, y: umouth.y + 1 }, lines: ["You climb back toward the thin mountain daylight."] },
    // The revealed mouth: pale masonry breaking the scree of the pass.
    { id: "ruin_under_1", kind: "ruin_prop", x: umouth.x - 2, y: umouth.y - 1, name: "Pale Doorpost", requiresFlag: REVEAL, lines: ["A doorpost of pale stone, uncovered by no weather you can name. It was hidden yesterday. It is not hidden now."] },
    { id: "relic_seal_toll", kind: "relic", x: umouth.x + 3, y: umouth.y - 2, name: "Ruined Toll-Ledger", loreId: "lore_seal_toll", requiresFlag: REVEAL },
    { id: "relic_seal_warden", kind: "relic", x: umouth.x - 3, y: umouth.y + 2, name: "Seal-Ring Rubbing", loreId: "lore_seal_warden_watch", requiresFlag: "act2_pass_open" },
    { id: "ruin_under_2", kind: "ruin_prop", x: umouth.x + 2, y: umouth.y - 1, name: "Pale Doorpost", requiresFlag: REVEAL, lines: ["The twin post. Together they frame a dark that goes down a very long way."] },
    { id: "ruin_under_3", kind: "ruin_prop", x: umouth.x + 3, y: umouth.y + 1, name: "Fallen Cornice", requiresFlag: REVEAL, lines: ["Carved with the running wolf — the same hand as the Barrows, a hundred leagues south. One builder. One order."] },
    {
      id: "under_verse", kind: "shrine", x: umouth.x - 3, y: umouth.y + 1, name: "The Fifth Verse", requiresFlag: REVEAL,
      lines: ["Cut into the living rock beside the door: 'AND LAST AND LOWEST, THE UNDERGATE, UNDER THE MOUNTAIN'S HEART, AND THE PALE WARDEN UPON IT, UNTIL THE WOLF RUNS HOME.'"],
    },
    // Once the Warden falls and the pass is open: the road north, teased.
    {
      id: "north_road_sign", kind: "signpost", x: umouth.x, y: umouth.y - 3, name: "The North Road", requiresFlag: "act2_pass_open",
      lines: ["NORTH — the letters new-cut over letters a thousand years old. The road runs up through the pass and out of Varath's maps. On a clear night, watchmen swear, there are lights on the far side."],
    },

    // === STAGE A — the Long Descent + the Seal Hall =========================
    { id: "ug_wight_1", kind: "monster", monster: "pale_wight", x: ux + 30, y: uy + 4, name: "Pale Wight" },
    { id: "ug_wight_2", kind: "monster", monster: "pale_wight", x: ux + 30, y: uy + 10, name: "Pale Wight" },
    { id: "ug_wisp_1", kind: "monster", monster: "storm_wisp", x: ux + 50, y: uy + 16, name: "Seal-Light" },
    // The five seals, thrown in the psalm's own order.
    { id: "lev_under_s1", kind: "puzzle_lever", x: ux + 76, y: uy + 11, name: "Seal of the WOLF", puzzle: "under_seals", order: 0, lines: ["A seal-lever under the running wolf. 'First ran the WOLF...'"] },
    { id: "lev_under_s2", kind: "puzzle_lever", x: ux + 100, y: uy + 11, name: "Seal of the MOUNTAIN", puzzle: "under_seals", order: 1, lines: ["A seal-lever under the split mountain. 'Second stands the MOUNTAIN...'"] },
    { id: "lev_under_s3", kind: "puzzle_lever", x: ux + 76, y: uy + 19, name: "Seal of the TIDE", puzzle: "under_seals", order: 2, lines: ["A seal-lever under the rising waterline. 'Third sits the TIDE...'"] },
    { id: "lev_under_s4", kind: "puzzle_lever", x: ux + 100, y: uy + 19, name: "Seal of the STORM", puzzle: "under_seals", order: 3, lines: ["A seal-lever under the beacon and the cloud. 'Fourth flies the STORM...'"] },
    { id: "lev_under_s5", kind: "puzzle_lever", x: ux + 88, y: uy + 20, name: "Seal of the GATE", puzzle: "under_seals", order: 4, lines: ["A seal-lever under the door-glyph itself. 'And last and lowest, the UNDERGATE.'"] },
    // The psalm entire, verse by verse — the order is the one Maerwen read you.
    { id: "plq_under_1", kind: "signpost", x: ux + 84, y: uy + 15, name: "The First Verse", lines: ["'FIRST ran the WOLF, ahead of all the host, and the road closed behind her.'"] },
    { id: "plq_under_2", kind: "signpost", x: ux + 86, y: uy + 15, name: "The Second Verse", lines: ["'SECOND stands the MOUNTAIN, and the mountain keeps the ledger shut.'"] },
    { id: "plq_under_3", kind: "signpost", x: ux + 88, y: uy + 15, name: "The Third Verse", lines: ["'THIRD sits the TIDE, and the tide holds what the court condemned.'"] },
    { id: "plq_under_4", kind: "signpost", x: ux + 90, y: uy + 15, name: "The Fourth Verse", lines: ["'FOURTH flies the STORM, and the storm watches the road.'"] },
    { id: "plq_under_5", kind: "signpost", x: ux + 92, y: uy + 15, name: "The Fifth Verse", lines: ["'And LAST and LOWEST, the UNDERGATE — thrown in the psalm's own order, the five seals open.'"] },
    {
      id: "gate_under_1", kind: "dungeon_gate", x: ux + 106, y: uy + 15, name: "The First Seal",
      hiddenByFlag: "pz_under_seals",
      lines: ["A door of pale stone bearing all five sigils at once. The psalm is the key, and the hall recites it verse by verse."],
    },

    // === STAGE B — the Underway =============================================
    { id: "ug_golem_1", kind: "monster", monster: "deep_golem", x: ux + 114, y: uy + 8, name: "Underway Golem" },
    { id: "ug_wight_3", kind: "monster", monster: "pale_wight", x: ux + 124, y: uy + 22, name: "Pale Wight" },
    { id: "ug_wisp_2", kind: "monster", monster: "storm_wisp", x: ux + 140, y: uy + 5, name: "Seal-Light" },
    { id: "ug_gatekeeper", kind: "monster", monster: "pale_gatekeeper", x: ux + 146, y: uy + 12, name: "Gatewright of the Underway" },
    {
      id: "gate_under_2", kind: "dungeon_gate", x: ux + 112, y: uy + 26, name: "Gatewright's Door",
      hiddenByFlag: "key_gate_under_2", keyItem: "undergate_key_1",
      lines: ["A mason's door, plumb and true after a thousand years. Its maker walks the Underway still — and keeps his key."],
    },

    // === STAGE C — the Echo Gallery =========================================
    { id: "ug_wight_4", kind: "monster", monster: "pale_wight", x: ux + 60, y: uy + 29, name: "Pale Wight" },
    { id: "ug_wisp_3", kind: "monster", monster: "storm_wisp", x: ux + 100, y: uy + 35, name: "Seal-Light" },
    { id: "ug_golem_2", kind: "monster", monster: "deep_golem", x: ux + 30, y: uy + 33, name: "Underway Golem" },
    { id: "lev_under_e1", kind: "puzzle_lever", x: ux + 41, y: uy + 26, name: "Echo of DUSK", puzzle: "under_echo", order: 0, lines: ["A sounding-stone in the north-west cell. Struck, it answers from somewhere far below."] },
    { id: "lev_under_e2", kind: "puzzle_lever", x: ux + 121, y: uy + 38, name: "Echo of MIDNIGHT", puzzle: "under_echo", order: 1, lines: ["A sounding-stone in the south-east cell, black as the hour it is named for."] },
    { id: "lev_under_e3", kind: "puzzle_lever", x: ux + 121, y: uy + 26, name: "Echo of the LAST HOUR", puzzle: "under_echo", order: 2, lines: ["A sounding-stone in the north-east cell, carved with the sinking stars."] },
    { id: "lev_under_e4", kind: "puzzle_lever", x: ux + 41, y: uy + 38, name: "Echo of DAWN", puzzle: "under_echo", order: 3, lines: ["A sounding-stone in the south-west cell, carved with the sun the deep never sees."] },
    { id: "plq_under_e1", kind: "signpost", x: ux + 76, y: uy + 32, name: "Gallery Inscription", lines: ["'The gallery keeps the watches as the aerie kept them: DUSK sounds first —'"] },
    { id: "plq_under_e2", kind: "signpost", x: ux + 80, y: uy + 32, name: "Gallery Inscription", lines: ["'— MIDNIGHT answers across the dark —'"] },
    { id: "plq_under_e3", kind: "signpost", x: ux + 84, y: uy + 32, name: "Gallery Inscription", lines: ["'— the LAST HOUR calls back over the water —'"] },
    { id: "plq_under_e4", kind: "signpost", x: ux + 88, y: uy + 32, name: "Gallery Inscription", lines: ["'— and DAWN closes the round, and the way west opens for honest ears.'"] },
    {
      id: "gate_under_3", kind: "dungeon_gate", x: ux + 16, y: uy + 32, name: "The Second Seal",
      hiddenByFlag: "pz_under_echo",
      lines: ["A seal of sounding-stone. Four echoes hang in the gallery's cells; the inscriptions keep the watches' order."],
    },

    // === STAGE D — the Deep Stair + the wolf-road ===========================
    { id: "ug_herald", kind: "monster", monster: "pale_herald", x: ux + 70, y: uy + 40, name: "Herald of the Deep Stair" },
    { id: "ug_wight_5", kind: "monster", monster: "pale_wight", x: ux + 120, y: uy + 41, name: "Pale Wight" },
    {
      id: "gate_under_4", kind: "dungeon_gate", x: ux + 99, y: uy + 41, name: "The Deepway Door",
      hiddenByFlag: "key_gate_under_4", keyItem: "undergate_key_2",
      lines: ["Pale iron, seamless, humming very faintly. The Herald of this stair holds its key — and its breath."],
    },
    { id: "lev_under_w1", kind: "puzzle_lever", x: ux + 131, y: uy + 44, name: "The FAR Waymark", puzzle: "under_road", order: 0, lines: ["A waymark stone: a wolf at the road's far end, looking back."] },
    { id: "lev_under_w2", kind: "puzzle_lever", x: ux + 121, y: uy + 44, name: "The MIDDLE Waymark", puzzle: "under_road", order: 1, lines: ["A waymark stone: a wolf mid-stride on the long road."] },
    { id: "lev_under_w3", kind: "puzzle_lever", x: ux + 111, y: uy + 44, name: "The HOME Waymark", puzzle: "under_road", order: 2, lines: ["A waymark stone: a wolf at a gate, home at last."] },
    { id: "plq_under_w1", kind: "signpost", x: ux + 133, y: uy + 40, name: "Road-Verse", lines: ["'The wolf walks home from the FAR stone —'"] },
    { id: "plq_under_w2", kind: "signpost", x: ux + 123, y: uy + 40, name: "Road-Verse", lines: ["'— by the MIDDLE stone —'"] },
    { id: "plq_under_w3", kind: "signpost", x: ux + 113, y: uy + 40, name: "Road-Verse", lines: ["'— to the HOME stone, and the last door knows her step.'"] },
    {
      id: "gate_under_5", kind: "dungeon_gate", x: ux + 143, y: uy + 41, name: "The Last Seal",
      hiddenByFlag: "pz_under_road",
      lines: ["The fifth seal — the one the psalm was written to keep. Beyond it, a hall, and a keeper, and a door that faces north."],
    },

    // === THE WARDEN'S HALL ==================================================
    { id: "ug_guard_1", kind: "monster", monster: "pale_wight", x: ux + 147, y: uy + 41, name: "Warden's Honour-Guard" },
    { id: "ug_guard_2", kind: "monster", monster: "pale_wight", x: ux + 147, y: uy + 47, name: "Warden's Honour-Guard" },
    { id: "ug_warden", kind: "monster", monster: "pale_warden", x: ux + 150, y: uy + 44, name: "The Pale Warden" },
    {
      id: "north_door", kind: "shrine", x: ux + 152, y: uy + 39, name: "The North Door",
      lines: ["The Undergate itself: a door as wide as a street, barred from THIS side. Beyond it the road runs north, under the Spine and out the far slope — toward whoever has kept their own watch, all this time."],
    },
    {
      id: "chest_under", kind: "dungeon_chest", x: ux + 152, y: uy + 47, name: "The Warden's Reliquary",
      loot: [{ item: "pale_greaves", qty: 1 }, { item: "marrow_shard", qty: 2 }, { item: "cut_gem", qty: 4 }],
      lines: ["The Warden's own reliquary, at the foot of the North Door. Whatever it kept, it kept for the day the wolf came home."],
    },
    { id: "ret_under_b", kind: "portal", x: ux + 146, y: uy + 45, name: "The Warden's Stair", target: { x: umouth.x, y: umouth.y + 1 }, lines: ["The Warden's own stair, straight and true, up to the pass."] },
  );

  // --- SITE 6: THE HUNT WARRENS — the Bounty guild's slayer grounds. Old
  //     hunting tunnels under the quarry country: no puzzles, no keys, just
  //     five chambers of warren-bred quarry, each demanding more huntcraft
  //     (Bounty level) than the last. The mouth opens at the Old Quarry.
  const warrens = DUNGEONS.find((d) => d.id === "hunt_warrens")!;
  const wx = warrens.x0, wy = warrens.y0;
  const wmouth = { x: 120, y: 55 }; // the Old Quarry's deep cut (final coords)
  out.push(
    {
      id: "portal_warrens", kind: "portal", x: wmouth.x, y: wmouth.y, name: "The Hunt Warrens",
      dungeon: "hunt_warrens", target: { x: wx + warrens.entry.x, y: wy + warrens.entry.y },
      lines: ["A timbered shaft in the quarry's deepest cut, its posts notched with hunters' tallies. Everything the guides ever turned away bred down there — and the board pays for all of it."],
    },
    { id: "ret_warrens", kind: "portal", x: wx + warrens.exit.x, y: wy + warrens.exit.y, name: "The Way Up", target: { x: wmouth.x, y: wmouth.y + 1 }, lines: ["You climb the tally-notched ladder back to the quarry."] },
    // The guild's plain-spoken warnings — INSIDE each chamber's first bay, off
    // the one-tile corridors (a signpost blocks its tile; posted in a neck it
    // would seal the chamber shut).
    { id: "plq_war_entry", kind: "signpost", x: wx + 7, y: wy + 1, name: "Guild Notice", lines: ["'THE HUNT WARRENS — guild ground. Five chambers, five grades of quarry. Know your level; the Warrens don't forgive a hunter who doesn't.'"] },
    { id: "plq_war_burrows", kind: "signpost", x: wx + 17, y: wy + 4, name: "Chamber Mark: THE BURROWS", lines: ["'Creepers. Bounty 20. They hear your pulse — walk soft.'"] },
    { id: "plq_war_dens", kind: "signpost", x: wx + 10, y: wy + 14, name: "Chamber Mark: THE DENS", lines: ["'Stalkers. Bounty 40. If you can hear the whistle, it has already leapt.'"] },
    { id: "plq_war_kennels", kind: "signpost", x: wx + 11, y: wy + 23, name: "Chamber Mark: THE KENNELS", lines: ["'Hounds. Bounty 60. Aim for where the middle should be.'"] },
    { id: "plq_war_crypt", kind: "signpost", x: wx + 11, y: wy + 32, name: "Chamber Mark: THE CRYPT", lines: ["'Shades. Bounty 75. They were hunters once. Don't listen to anything they say.'"] },
    { id: "plq_war_pit", kind: "signpost", x: wx + 12, y: wy + 41, name: "Chamber Mark: THE MAW PIT", lines: ["'The Maw. Bounty 90. The guild does not fetch bodies from the Pit.'"] },
    // THE BURROWS (Bounty 20) — creepers in the bare-earth warren.
    { id: "war_creeper_1", kind: "monster", monster: "warren_creeper", x: wx + 18, y: wy + 5, name: "Warren Creeper" },
    { id: "war_creeper_2", kind: "monster", monster: "warren_creeper", x: wx + 21, y: wy + 6, name: "Warren Creeper" },
    { id: "war_creeper_3", kind: "monster", monster: "warren_creeper", x: wx + 19, y: wy + 8, name: "Warren Creeper" },
    { id: "war_creeper_4", kind: "monster", monster: "warren_creeper", x: wx + 24, y: wy + 5, name: "Warren Creeper" },
    // THE DENS (Bounty 40) — stalkers in the long gallery.
    { id: "war_stalker_1", kind: "monster", monster: "dusk_stalker", x: wx + 12, y: wy + 12, name: "Dusk Stalker" },
    { id: "war_stalker_2", kind: "monster", monster: "dusk_stalker", x: wx + 17, y: wy + 13, name: "Dusk Stalker" },
    { id: "war_stalker_3", kind: "monster", monster: "dusk_stalker", x: wx + 22, y: wy + 12, name: "Dusk Stalker" },
    { id: "war_stalker_4", kind: "monster", monster: "dusk_stalker", x: wx + 25, y: wy + 14, name: "Dusk Stalker" },
    // THE KENNELS (Bounty 60) — hounds in the broad kennel-hall.
    { id: "war_hound_1", kind: "monster", monster: "hollow_hound", x: wx + 13, y: wy + 20, name: "Hollow Hound" },
    { id: "war_hound_2", kind: "monster", monster: "hollow_hound", x: wx + 18, y: wy + 22, name: "Hollow Hound" },
    { id: "war_hound_3", kind: "monster", monster: "hollow_hound", x: wx + 22, y: wy + 20, name: "Hollow Hound" },
    { id: "war_hound_4", kind: "monster", monster: "hollow_hound", x: wx + 15, y: wy + 23, name: "Hollow Hound" },
    // THE CRYPT (Bounty 75) — shades casting from the black pools.
    { id: "war_shade_1", kind: "monster", monster: "warren_shade", x: wx + 12, y: wy + 29, name: "Warren Shade" },
    { id: "war_shade_2", kind: "monster", monster: "warren_shade", x: wx + 19, y: wy + 30, name: "Warren Shade" },
    { id: "war_shade_3", kind: "monster", monster: "warren_shade", x: wx + 22, y: wy + 31, name: "Warren Shade" },
    // THE MAW PIT (Bounty 90) — the Maws at the bottom of everything.
    { id: "war_maw_1", kind: "monster", monster: "iron_maw", x: wx + 14, y: wy + 38, name: "Iron Maw" },
    { id: "war_maw_2", kind: "monster", monster: "iron_maw", x: wx + 20, y: wy + 40, name: "Iron Maw" },
    { id: "war_maw_3", kind: "monster", monster: "iron_maw", x: wx + 24, y: wy + 38, name: "Iron Maw" },
    // Grim dressing: the hunters who misjudged their grade — and the guild's
    // braziers, one at each chamber mouth, so every grade is greeted by fire.
    { id: "rem_war_1", kind: "remains", variant: "bones", x: wx + 15, y: wy + 5, name: "Old Remains" },
    { id: "rem_war_2", kind: "remains", variant: "skeleton", x: wx + 10, y: wy + 13, name: "Old Remains" },
    { id: "rem_war_3", kind: "remains", variant: "sitting", x: wx + 11, y: wy + 21, name: "A Hunter's End" },
    { id: "rem_war_4", kind: "remains", variant: "sarco", x: wx + 12, y: wy + 31, name: "Old Remains" },
    { id: "rem_war_5", kind: "remains", variant: "camp", x: wx + 12, y: wy + 39, name: "A Hunter's Last Camp" },
    { id: "rem_war_6", kind: "remains", variant: "brazier", x: wx + 6, y: wy + 2, name: "Guild Brazier" },
    // Chamber-mouth braziers (each pushes light into its grade's dark).
    { id: "rem_war_b1", kind: "remains", variant: "brazier", x: wx + 15, y: wy + 4, name: "Burrows Brazier" },
    { id: "rem_war_b2", kind: "remains", variant: "brazier", x: wx + 9, y: wy + 11, name: "Dens Brazier" },
    { id: "rem_war_b3", kind: "remains", variant: "brazier", x: wx + 10, y: wy + 19, name: "Kennels Brazier" },
    { id: "rem_war_b4", kind: "remains", variant: "brazier", x: wx + 10, y: wy + 28, name: "Crypt Brazier" },
    { id: "rem_war_b5", kind: "remains", variant: "brazier", x: wx + 10, y: wy + 37, name: "Pit Brazier" },
    // The Burrows: picked-clean kills and a grave-digger's spoil.
    { id: "rem_war_7", kind: "remains", variant: "skeleton", x: wx + 22, y: wy + 4, name: "Old Remains" },
    { id: "rem_war_8", kind: "remains", variant: "urn", x: wx + 17, y: wy + 6, name: "A Looted Urn" },
    { id: "rem_war_9", kind: "remains", variant: "bones", x: wx + 23, y: wy + 7, name: "Old Remains" },
    // The Dens: a courier who never delivered.
    { id: "rem_war_10", kind: "remains", variant: "coins", x: wx + 14, y: wy + 11, name: "Spilled Purse" },
    { id: "rem_war_11", kind: "remains", variant: "crate", x: wx + 9, y: wy + 14, name: "Guild Supplies" },
    { id: "rem_war_12", kind: "remains", variant: "bones", x: wx + 24, y: wy + 13, name: "Old Remains" },
    // The Kennels: tools downed mid-job.
    { id: "rem_war_13", kind: "remains", variant: "tools", x: wx + 23, y: wy + 21, name: "A Flenser's Kit" },
    { id: "rem_war_14", kind: "remains", variant: "skeleton", x: wx + 24, y: wy + 22, name: "Old Remains" },
    { id: "rem_war_15", kind: "remains", variant: "bones", x: wx + 12, y: wy + 19, name: "Old Remains" },
    // The Crypt: older dead than the hunters'.
    { id: "rem_war_16", kind: "remains", variant: "urn", x: wx + 13, y: wy + 28, name: "A Sealed Urn" },
    { id: "rem_war_17", kind: "remains", variant: "banner", x: wx + 22, y: wy + 30, name: "A Rotted Guild Banner" },
    { id: "rem_war_18", kind: "remains", variant: "bones", x: wx + 20, y: wy + 32, name: "Old Remains" },
    // The Maw Pit: what the larder keeps.
    { id: "rem_war_19", kind: "remains", variant: "skeleton", x: wx + 16, y: wy + 41, name: "Old Remains" },
    { id: "rem_war_20", kind: "remains", variant: "coins", x: wx + 22, y: wy + 41, name: "A Dead Man's Marks" },
    { id: "rem_war_21", kind: "remains", variant: "crate", x: wx + 24, y: wy + 40, name: "Crushed Supplies" },
  );

  // --- SITE 7: THE HOLLOW BELOW — the level-125 lair. A crack that opened at
  //     the Undergate's mouth the day the fifth seal broke; the portal (and
  //     everything down it) stays hidden until the pass is open. One entry
  //     gallery, one throat, one pit — and the thing the seals were for.
  const hollow = DUNGEONS.find((d) => d.id === "hollow_below")!;
  const hbx = hollow.x0, hby = hollow.y0;
  const hbMouth = { x: umouth.x + 4, y: umouth.y + 2 }; // beside the Undergate's mouth
  out.push(
    {
      id: "portal_hollow_below", kind: "portal", x: hbMouth.x, y: hbMouth.y, name: "The Hollow Below",
      dungeon: "hollow_below", target: { x: hbx + hollow.entry.x, y: hby + hollow.entry.y },
      requiresFlag: "act2_pass_open",
      lines: ["A crack in the mountain's footing that was not here before the seal broke. Warm air rises out of it in slow, even breaths — as if the dark below is being patient about something."],
    },
    { id: "ret_hollow_below", kind: "portal", x: hbx + hollow.exit.x, y: hby + hollow.exit.y, name: "The Climb Out", target: { x: hbMouth.x, y: hbMouth.y + 1 }, lines: ["You climb out of the warm dark, and the mountain lets you."] },
    { id: "plq_hollow_below", kind: "signpost", x: hbx + 7, y: hby + 2, name: "A Watchman's Warning", lines: ["'TURN BACK. Whatever the five seals held, it is AWAKE, and it is HUNGRY, and the watch has lost four good climbers learning those two facts. The Record pays for word of it — it pays more for you alive.'"] },
    // The Hunger itself, risen through the pit's floor.
    { id: "boss_vorlag", kind: "monster", monster: "vorlag", x: hbx + 13, y: hby + 10, name: "Vorlag, the Hunger Below" },
    // Dressing: the four climbers, and older leavings around the rim.
    { id: "rem_hb_1", kind: "remains", variant: "skeleton", x: hbx + 5, y: hby + 8, name: "A Climber's End" },
    { id: "rem_hb_2", kind: "remains", variant: "sitting", x: hbx + 22, y: hby + 9, name: "A Climber's End" },
    { id: "rem_hb_3", kind: "remains", variant: "bones", x: hbx + 8, y: hby + 13, name: "Old Remains" },
    { id: "rem_hb_4", kind: "remains", variant: "tools", x: hbx + 19, y: hby + 13, name: "Dropped Climbing-Kit" },
    { id: "rem_hb_5", kind: "remains", variant: "coins", x: hbx + 16, y: hby + 8, name: "A Spilled Purse" },
    { id: "rem_hb_b1", kind: "remains", variant: "brazier", x: hbx + 3, y: hby + 3, name: "A Watchman's Brazier" },
    { id: "rem_hb_b2", kind: "remains", variant: "brazier", x: hbx + 8, y: hby + 3, name: "A Watchman's Brazier" },
  );

  // --- SITE 8: THE IRONVALE SEWERS — the beginner grind-dungeon. A bolted iron
  //     manhole set into a quiet corner of the city's flagstones lifts onto the
  //     old drains: a spine tunnel with four flooded bays, each a grade harder
  //     than the last. No bounty gate — everything down here is fair game for a
  //     brand-new hunter, and it all pays a small bounty.
  const sewers = DUNGEONS.find((d) => d.id === "ironvale_sewers")!;
  const swx = sewers.x0, swy = sewers.y0;
  const smth = { x: 82, y: 85 }; // an iron manhole in the city's south plaza
  out.push(
    {
      id: "portal_sewers", kind: "portal", x: smth.x, y: smth.y, name: "Sewer Manhole",
      dungeon: "ironvale_sewers", target: { x: swx + sewers.entry.x, y: swy + sewers.entry.y },
      lines: ["A bolted iron cover set into the flagstones, ringed with old seepage the flushers never quite scrub out. Cold, sour air breathes up through its slots — and far below, a great many small things are moving. Lift it, and drop down. The board pays a copper or two for every one you thin out."],
    },
    { id: "ret_sewers", kind: "portal", x: swx + sewers.exit.x, y: swy + sewers.exit.y, name: "The Ladder Up", target: { x: smth.x, y: smth.y + 1 }, lines: ["You climb the slick rungs and heave the manhole aside, back into the city's daylight."] },
    // A civic notice by the cover, so the mouth reads as tended city works.
    { id: "plq_sew_notice", kind: "signpost", x: 82, y: 84, name: "A Flushers' Notice", lines: ["'IRONVALE DRAINS — access cover. By order of the works: mind the vermin. The Flushers' Guild long ago gave the deep bays up for lost, and the Bounty board now pays for every rat, spider, kobold, and worse that comes up out of them. Descend at your own risk.'"] },
    // Chamber marks — plain level warnings, posted inside each bay off the neck.
    { id: "plq_sew_entry", kind: "signpost", x: swx + 5, y: swy + 2, name: "A Drain-Warden's Board", lines: ["'THE IRONVALE SEWERS. Four bays, four grades of vermin — rats, then spiders, then the kobolds, then whatever's grown in the sump. Work your way down as you're able. Good hunting-ground for a new hand; the board pays for all of it.'"] },
    { id: "plq_sew_rats", kind: "signpost", x: swx + 10, y: swy + 4, name: "Bay Mark: THE RAT WARREN", lines: ["'Sewer rats. Level 4 or so. Where every hunter cuts their teeth.'"] },
    { id: "plq_sew_spiders", kind: "signpost", x: swx + 10, y: swy + 10, name: "Bay Mark: THE WEB GALLERY", lines: ["'Gutter spiders. Level 9. Mind the webs — and the numbing bite.'"] },
    { id: "plq_sew_kobolds", kind: "signpost", x: swx + 11, y: swy + 15, name: "Bay Mark: THE KOBOLD DEN", lines: ["'Sewer kobolds. Level 15. They fight with pipe and spite. Bring a shield.'"] },
    { id: "plq_sew_sump", kind: "signpost", x: swx + 11, y: swy + 21, name: "Bay Mark: THE SUMP", lines: ["'The sludge. Level 22. It came out of the runoff and it does not stop coming. The deepest the drains go.'"] },
    // THE RAT WARREN (~lvl 4) — sewer rats in the fouled earth.
    { id: "sew_rat_1", kind: "monster", monster: "sewer_rat", x: swx + 9, y: swy + 4, name: "Sewer Rat" },
    { id: "sew_rat_2", kind: "monster", monster: "sewer_rat", x: swx + 11, y: swy + 4, name: "Sewer Rat" },
    { id: "sew_rat_3", kind: "monster", monster: "sewer_rat", x: swx + 14, y: swy + 5, name: "Sewer Rat" },
    { id: "sew_rat_4", kind: "monster", monster: "sewer_rat", x: swx + 16, y: swy + 6, name: "Sewer Rat" },
    // THE WEB GALLERY (~lvl 9) — gutter spiders in the old brick gallery.
    { id: "sew_spider_1", kind: "monster", monster: "gutter_spider", x: swx + 11, y: swy + 9, name: "Gutter Spider" },
    { id: "sew_spider_2", kind: "monster", monster: "gutter_spider", x: swx + 14, y: swy + 10, name: "Gutter Spider" },
    { id: "sew_spider_3", kind: "monster", monster: "gutter_spider", x: swx + 16, y: swy + 9, name: "Gutter Spider" },
    { id: "sew_spider_4", kind: "monster", monster: "gutter_spider", x: swx + 12, y: swy + 11, name: "Gutter Spider" },
    // THE KOBOLD DEN (~lvl 15) — sewer kobolds in the deep den.
    { id: "sew_kob_1", kind: "monster", monster: "sewer_kobold", x: swx + 12, y: swy + 14, name: "Sewer Kobold" },
    { id: "sew_kob_2", kind: "monster", monster: "sewer_kobold", x: swx + 15, y: swy + 15, name: "Sewer Kobold" },
    { id: "sew_kob_3", kind: "monster", monster: "sewer_kobold", x: swx + 17, y: swy + 14, name: "Sewer Kobold" },
    { id: "sew_kob_4", kind: "monster", monster: "sewer_kobold", x: swx + 13, y: swy + 16, name: "Sewer Kobold" },
    // THE SUMP (~lvl 22) — the sludge in the flooded bottom.
    { id: "sew_sludge_1", kind: "monster", monster: "sewer_sludge", x: swx + 11, y: swy + 19, name: "Sewer Sludge" },
    { id: "sew_sludge_2", kind: "monster", monster: "sewer_sludge", x: swx + 17, y: swy + 20, name: "Sewer Sludge" },
    { id: "sew_sludge_3", kind: "monster", monster: "sewer_sludge", x: swx + 16, y: swy + 21, name: "Sewer Sludge" },
    { id: "sew_sludge_4", kind: "monster", monster: "sewer_sludge", x: swx + 11, y: swy + 22, name: "Sewer Sludge" },
    // Dressing: a lantern at the grate-foot, old leavings, a drowned scavenger.
    { id: "rem_sew_b1", kind: "remains", variant: "brazier", x: swx + 4, y: swy + 2, name: "A Drain-Lantern" },
    { id: "rem_sew_1", kind: "remains", variant: "bones", x: swx + 13, y: swy + 4, name: "Gnawed Bones" },
    { id: "rem_sew_2", kind: "remains", variant: "bones", x: swx + 15, y: swy + 10, name: "A Wrapped Husk" },
    { id: "rem_sew_3", kind: "remains", variant: "skeleton", x: swx + 16, y: swy + 15, name: "A Scavenger's End" },
    { id: "rem_sew_4", kind: "remains", variant: "coins", x: swx + 14, y: swy + 15, name: "A Spilled Purse" },
    { id: "rem_sew_5", kind: "remains", variant: "bones", x: swx + 12, y: swy + 21, name: "Old Bones in the Muck" },
  );

  // --- SITE 9: THE ASHEN HOLLOW — a level 30-40 witch-coven questline. The
  //     hedge-witch "the Ashen Widow" bound the wood-verge hollow with hex-wards
  //     and took the folk who wandered in. The quest (q_ashen_widow) sends you
  //     from a grieving Drover's Rest villager to Calla the hedge-woman at the
  //     verge, through a name-riddle that reveals the coven's mouth, into an
  //     instanced hollow (the retired bog_barrow arena) with a ward-candle
  //     combination puzzle and the Widow herself. Left open-ended: she is "the
  //     least of three sisters," and a Mother in the deep bog is never met. ===
  //
  // -- Overworld: the giver, the guide, the verge ward-stones, the freed girl --
  out.push(
    // Wren, the giver — a young drover at Drover's Rest whose betrothed vanished.
    {
      id: "wren_drover", kind: "npc", x: 66, y: 77, name: "Wren",
      lines: ["He keeps looking south at the wood-line, the way you look at a door you're afraid will open."],
      reactiveLines: [
        { requiresFlags: ["q_ashen_widow_complete"], lines: ["You brought her back. I don't have the words — so take the drove's thanks, and Ada's, for as long as I've got breath to give them."] },
        { requiresFlags: ["aw_widow_revealed"], lines: ["You found the hollow. Then it's real, all of it. Please — bring Ada home."] },
      ],
    },
    // Ada, the freed girl — only present once the Widow is broken.
    {
      id: "ada_freed", kind: "npc", x: 72, y: 77, name: "Ada", requiresFlag: "q_ashen_widow_complete",
      lines: ["She's pale and thinner than she should be, but her eyes are her own again.", "'She was kind, at the first. That's how it works, I think — the kindness is the hook. She kept saying she was the LEAST of them. That her Mother, down in the deep bog, would be... disappointed.' She shivers. 'You didn't end it. You ended HER.'"],
    },
    // Calla, the guide — a retired hedge-witch at the verge, the Widow's sister
    // in the old coven, who wants no part of it but will point the way.
    {
      id: "calla_hedge", kind: "npc", x: 46, y: 96, name: "Calla",
      lines: ["An old woman at a lean-to of bent willow, sorting dried roots by touch. She does not look up. 'You smell of the town and of trouble. The two travel together.'"],
      reactiveLines: [
        { requiresFlags: ["q_ashen_widow_complete"], lines: ["'The ring's gone quiet. I feel it — like a tooth that stopped aching.' She finally looks at you. 'She was my sister once, before the wards. You did what I couldn't. Go home, town-blood. And if you ever hear the word MOTHER on the wind off the deep bog... don't go looking. Not for a long while yet.'"] },
        { requiresFlags: ["aw_hollow_open"], blockedByFlags: ["q_ashen_widow_complete"], lines: ["'You have the name and the sprig. The hollow's mouth is open to you now — south and east, past the reeds. Quench the wards in the order the coven-marks recite, and face her. Mind the ring she draws at your feet — step OUT of it.'"] },
      ],
    },
    // The three verge ward-stones — read all three to learn the Widow's name.
    { id: "aw_stone_1", kind: "signpost", x: 42, y: 94, name: "A Leaning Ward-Stone", lines: ["Worn letters, half in the old tongue: 'THREE SISTERS bound this hollow — the ASHEN, the REED, and the MOTHER in the deep. The youngest holds the ring.'"] },
    { id: "aw_stone_2", kind: "signpost", x: 49, y: 95, name: "A Cracked Ward-Stone", lines: ["'The binding stands while the youngest keeps her true NAME. It is name-magic, and name-magic cuts both ways: speak the name, and the ring lets you pass.'"] },
    { id: "aw_stone_3", kind: "signpost", x: 45, y: 99, name: "A Sunken Ward-Stone", lines: ["Carved low, where rowan roots drink: 'The Ashen sister's name-in-the-old-tongue, that she buried so none could unbind her: N Y S S A.'"] },
    // The coven's mouth — a reed-choked sink in the verge, hidden until Calla's
    // riddle is answered (aw_hollow_open). Drops into the bog_barrow arena.
    {
      id: "portal_hollow_coven", kind: "portal", x: 52, y: 98, name: "The Ashen Hollow",
      dungeon: "bog_barrow", target: { x: 24, y: 169 }, requiresFlag: "aw_hollow_open",
      lines: ["A sink in the reeds where the ground gives way into wet dark. Cold air comes up smelling of ash and duskshade. The warding sprig in your pack goes cold as you step down."],
    },

    // -- Interior: the Ashen Hollow, carved in the retired bog_barrow arena --
    { id: "ret_hollow_coven", kind: "portal", x: 19, y: 167, name: "The Reed Sink", target: { x: 52, y: 99 }, lines: ["You climb the reed-roots back up to the verge and the honest cold."] },
    { id: "aw_sign_entry", kind: "signpost", x: 22, y: 167, name: "The Coven's Ring", lines: ["Three ward-candles burn at the hollow's edge, and the air between them will not let you near the fire at the heart. The coven-marks on the stones will recite the order they must be quenched."] },
    // The ward-candle combination puzzle: quench ROWAN → IRON → SALT.
    { id: "aw_candle_rowan", kind: "puzzle_lever", x: 20, y: 170, name: "The Rowan Ward-Candle", puzzle: "aw_wards", order: 0, lines: ["A black candle in a fist of rowan-wood. Snuffing it is the work of a moment — but only in its turn."] },
    { id: "aw_candle_iron", kind: "puzzle_lever", x: 28, y: 170, name: "The Iron Ward-Candle", puzzle: "aw_wards", order: 1, lines: ["A candle guttering in an iron cage, cold to the hand."] },
    { id: "aw_candle_salt", kind: "puzzle_lever", x: 24, y: 168, name: "The Salt Ward-Candle", puzzle: "aw_wards", order: 2, lines: ["A candle ringed in grey salt, the last and greediest of the three."] },
    { id: "aw_mark_1", kind: "signpost", x: 20, y: 172, name: "Coven-Mark", lines: ["'FIRST we lit the ROWAN, that the dead might keep their road home.'"] },
    { id: "aw_mark_2", kind: "signpost", x: 28, y: 172, name: "Coven-Mark", lines: ["'THEN the IRON, that the living keep their names against the dark.'"] },
    { id: "aw_mark_3", kind: "signpost", x: 22, y: 168, name: "Coven-Mark", lines: ["'And LAST the SALT, that nothing cross the ring uncounted. Break us in any other order, and we only stand again.'"] },
    // The coven's acolytes, guarding the ring from the start.
    { id: "aw_hexling_1", kind: "monster", monster: "hollow_hexling", x: 23, y: 171, name: "Hollow Hexling" },
    { id: "aw_hexling_2", kind: "monster", monster: "hollow_hexling", x: 26, y: 171, name: "Hollow Hexling" },
    { id: "aw_hexling_3", kind: "monster", monster: "hollow_hexling", x: 24, y: 173, name: "Hollow Hexling" },
    // The Widow: an NPC to confront (revealed only once the wards are quenched),
    // then the boss she becomes when you refuse her (aw_widow_revealed).
    {
      id: "ashen_widow_npc", kind: "npc", x: 24, y: 174, name: "The Ashen Widow",
      requiresFlag: "pz_aw_wards", hiddenByFlag: "aw_widow_revealed",
      lines: ["The wards go dark, and she is simply there, as if she always was — tall, ash-grey, and kind about the eyes. 'You came a long way for one drover's girl. She's happy here. They're all happy here.' She tilts her head. 'You could be, too.'"],
    },
    { id: "ashen_widow_boss", kind: "monster", monster: "ashen_widow", x: 24, y: 174, name: "The Ashen Widow", requiresFlag: "aw_widow_revealed" },
    // Her reward hoard and the hollow's dressing.
    { id: "aw_chest", kind: "dungeon_chest", x: 26, y: 175, name: "The Widow's Kist", requiresFlag: "aw_widow_revealed", loot: [{ item: "hex_cloth", qty: 3 }, { item: "cut_gem", qty: 2 }, { item: "seed_duskshade", qty: 3 }], lines: ["A low kist of bog-black wood, its lid soft with damp. What the hollow kept."] },
    { id: "aw_cauldron", kind: "cauldron", x: 20, y: 175, name: "The Coven Cauldron", lines: ["A great iron pot on a cold fire, its contents long gone to tar. Still usable, if you've the stomach — a real Herblore cauldron."] },
    { id: "aw_rem_1", kind: "remains", variant: "brazier", x: 21, y: 168, name: "Ward-Brazier" },
    { id: "aw_rem_2", kind: "remains", variant: "brazier", x: 27, y: 168, name: "Ward-Brazier" },
    { id: "aw_rem_3", kind: "remains", variant: "urn", x: 28, y: 175, name: "A Sealed Coven-Urn" },
    { id: "aw_rem_4", kind: "remains", variant: "bones", x: 22, y: 175, name: "The Ones Who Stayed" },
    { id: "aw_rem_5", kind: "remains", variant: "sitting", x: 25, y: 176, name: "A Hollowed Villager", lines: ["A villager seated against the wall, eyes open, breathing slow, humming a tune with no bottom to it. Whatever the Widow took, it isn't given back by her ending — only stopped."] },
  );
  return out;
}

/**
 * The dead and their leavings: walk-over floor dressing through all five Act
 * II sites (kind "remains" never blocks, so the verified gate/choke geometry
 * is untouched), plus the surface ruins the first two mouths never got.
 * Braziers are remains too — lit ones; the renderer gives them real light.
 */
function buildDungeonDressing(): WorldObjectDef[] {
  const R = (id: string, variant: string, x: number, y: number, name: string, line: string): WorldObjectDef =>
    ({ id, kind: "remains", variant, x, y, name, lines: [line] });
  const bmouth = remap(108, 24); // the Barrows' grove mouth
  const vmouth = remap(50, 12);  // the Vault's pass mouth
  return [
    // === Surface ruins for the first two mouths (parity with the later sites) ===
    { id: "ruin_barrow_1", kind: "ruin_prop", x: bmouth.x - 2, y: bmouth.y - 1, name: "Barrow-Stones", lines: ["Standing stones sunk to their shoulders in the turf, ringing the mouth the way teeth ring a throat."] },
    { id: "ruin_barrow_2", kind: "ruin_prop", x: bmouth.x + 2, y: bmouth.y, name: "Toppled Waymark", lines: ["A waymark on its face in the grass. The carving underneath is a running wolf — nobody has turned it over in a thousand years."] },
    { id: "ruin_barrow_3", kind: "ruin_prop", x: bmouth.x - 1, y: bmouth.y + 2, name: "Grave Rubble", lines: ["Kerb-stones of old graves, ploughed up by roots and time."] },
    { id: "ruin_vault_1", kind: "ruin_prop", x: vmouth.x - 2, y: vmouth.y - 1, name: "Fallen Ward-Stone", lines: ["A ward-stone face-down in the scree. Whatever it was warding against, it gave up before the door did."] },
    { id: "ruin_vault_2", kind: "ruin_prop", x: vmouth.x + 2, y: vmouth.y, name: "Dressed Rubble", lines: ["Masonry finer than anything in Ironvale, lying where the mountain shrugged it."] },
    { id: "ruin_vault_3", kind: "ruin_prop", x: vmouth.x - 1, y: vmouth.y + 2, name: "Broken Cornice", lines: ["A cornice carved with tallies — the vault's count began outside its own door."] },

    // === THE HOLLOW BARROWS — the dead in their niches, and one who came late ===
    R("rm_bw_1", "sitting", 12, 198, "Niche-Dead", "One of the north-folk, seated in a wall-niche with folded hands. Not fallen. Placed."),
    R("rm_bw_2", "sitting", 11, 201, "Niche-Dead", "Another of the seated dead. The niches run the length of the hall — this was a whole people's grave."),
    R("rm_bw_3", "bones", 20, 205, "Bone Pile", "Bones swept into a corner. Someone tidied this corridor, once, and it wasn't recently."),
    R("rm_bw_4", "bones", 26, 207, "Bone Pile", "Long bones and a skull, gnawed. The barrow's bats don't do this. Something else does."),
    R("rm_bw_5", "urn", 30, 206, "Grave-Goods Urn", "A funeral urn, sealed with wax. Whatever went with them, it stayed."),
    R("rm_bw_6", "urn", 40, 208, "Grave-Goods Urn", "A tipped urn — old beads and knucklebones spilled across the plaque hall floor."),
    R("rm_bw_7", "sarco", 36, 210, "A Robbed Bier", "A stone bier, its lid dragged half off. Grave-robbers got exactly this far, once. Only this far."),
    R("rm_bw_8", "skeleton", 47, 199, "A Grave-Robber", "Sprawled reaching toward the entrance, a rusted pry-bar just past the fingers. The barrow keeps its own."),
    R("rm_bw_9", "bones", 34, 212, "Bone Pile", "Bones at the flooded nook's edge, wet-black and old."),
    R("rm_bw_10", "camp", 49, 200, "A Delver's Last Camp", "A bedroll, a cold firepit, a pack no one came back for. They camped in sight of the Grave-Sentinel's gallery. They shouldn't have slept."),
    R("rm_bw_11", "skeleton", 63, 214, "Honour-Dead", "A skeleton in the rags of ceremonial mail, fallen at its post before the King."),
    R("rm_bw_12", "bones", 68, 215, "Bone Pile", "The resting hall's floor is more bone than stone this close to the throne."),
    R("rm_bw_13", "brazier", 60, 210, "Ward-Brazier", "A brazier that has burned without fuel since the door first shut. Grave-fire."),
    R("rm_bw_14", "brazier", 66, 215, "Ward-Brazier", "Its twin. The flames lean toward the King's seat, always."),

    // === THE SPINE VAULT — the workers who stayed with the work ===
    R("rm_sv_1", "tools", 104, 200, "The Mason's Kit", "Chisels and a maul laid out in perfect order, waiting for a hand that is now mostly dust."),
    R("rm_sv_2", "sitting", 117, 208, "The Mason", "Slumped at the gallery wall, one finger-bone still pointing along a seam only a craftsman would worry about."),
    R("rm_sv_3", "crate", 106, 207, "Vault Stores", "Provision crates, stamped with tallies. Enough for a season. They planned to stay longer than that."),
    R("rm_sv_4", "crate", 112, 201, "Vault Stores", "More stores. Sealed from the inside means provisioned from the inside."),
    R("rm_sv_5", "device", 104, 205, "Tally-Board", "A slate board of running counts. The last column was never summed."),
    R("rm_sv_6", "bones", 129, 199, "Bone Pile", "Bones at the stair's turn — a porter who set his load down and never picked it up."),
    R("rm_sv_7", "tools", 137, 211, "Rusted Arms Rack", "Spears racked by the strongdoor, rusted into one solid piece. The wardens armed for something that never came up the stair."),
    R("rm_sv_8", "skeleton", 143, 203, "The Archivist", "Fallen across the alcove threshold, arms around nothing — whatever it died holding was taken long ago. Or delivered."),
    R("rm_sv_9", "coins", 143, 207, "The Spilled Count", "Coins fanned across the treasury floor. Untouched. Every delver who made it this far had better sense than to touch the count."),
    R("rm_sv_10", "coins", 146, 214, "The Spilled Count", "More of the count. The Vaultwright re-stacks it, they say, when the room is dark."),
    R("rm_sv_11", "brazier", 142, 206, "Ward-Brazier", "Mason-fire in an iron cage, burning on nothing at all."),
    R("rm_sv_12", "brazier", 148, 211, "Ward-Brazier", "The treasury's second flame. Between them, the count is always lit."),

    // === THE SUNKEN COURT — the session that never adjourned ===
    R("rm_ct_1", "urn", 20, 237, "Offering Urn", "A courtyard urn for petitions, silted to the rim. Some of the petitions are still in it."),
    R("rm_ct_2", "bones", 23, 230, "Bone Pile", "Bones in the passage, drifted together like leaves in a doorway."),
    R("rm_ct_3", "urn", 20, 232, "Offering Urn", "The mosaic hall's urn, cracked, weeping black silt."),
    R("rm_ct_4", "skeleton", 43, 231, "A Drowned Clerk", "Sprawled by the sluices, an arm through the spokes of the wheel. They tried to hold the tide out. The tide had jurisdiction."),
    R("rm_ct_5", "kelp", 26, 243, "Flood-Weed", "Moor-weed rooted in the courtyard seams, combed flat by water that isn't here anymore. Mostly."),
    R("rm_ct_6", "sitting", 62, 226, "The Drowned Gallery", "A skeleton in court dress, seated, facing the bench. Still waiting for the verdict."),
    R("rm_ct_7", "sitting", 78, 233, "The Drowned Gallery", "Another of the gallery. The water rose slowly enough to leave. Nobody left."),
    R("rm_ct_8", "sitting", 94, 227, "The Drowned Gallery", "A juror, by the chain of office. The chain kept its shape better than the juror."),
    R("rm_ct_9", "kelp", 66, 236, "Flood-Weed", "Weed and silt lapping the nave pillars in green-black drifts."),
    R("rm_ct_10", "tools", 56, 241, "Crossed Halberds", "Two bailiffs' halberds crossed on the processional floor, rusted together where they fell. Their owners are still on duty."),
    R("rm_ct_11", "skeleton", 36, 250, "Chained at the Wrist", "A skeleton in the reliquary, wrist-chained to a ring in the floor. Prisoner or volunteer — the court's records are underwater."),
    R("rm_ct_12", "device", 42, 250, "The Court's Scales", "The great scales of the Sunken Court, seized mid-weigh. Both pans hold silt now, in exactly equal measure."),
    R("rm_ct_13", "bones", 66, 250, "Bone Pile", "Bones along the lower approach, all pointed the same way: away."),
    R("rm_ct_14", "throne", 116, 252, "The Drowned Throne", "The Magistrate's high seat, black stone under black water-stain. He does not use it. He stands. He has always stood."),
    R("rm_ct_15", "brazier", 112, 250, "Court-Light Sconce", "A standing flame the water refuses to touch. The court's session never lapses for darkness."),
    R("rm_ct_16", "brazier", 120, 255, "Court-Light Sconce", "Its pair across the floor. Between them, the throne room keeps its awful order."),
    R("rm_ct_17", "kelp", 106, 254, "Flood-Weed", "Weed in the throne room's standing pools, swaying to a current nobody can feel."),
    R("rm_ct_18", "bones", 124, 252, "Bone Pile", "Bones below the bench. Contempt of court, perhaps."),

    // === SKYREACH RUIN — the watch that froze at its post ===
    R("rm_sk_1", "sitting", 24, 302, "Frozen at His Post", "A watchman seated against the terrace wall, spear across his knees, facing the pass. Snow fills him like a bowl."),
    R("rm_sk_2", "sitting", 33, 292, "Frozen at His Post", "Another sentry, upright at the switchback turn. The wind has polished him white."),
    R("rm_sk_3", "banner", 16, 296, "Fallen Standard", "A watch-standard face-down on the terrace, its colours scoured to grey. The pole snapped in a wind nobody recorded."),
    R("rm_sk_4", "device", 26, 283, "Shattered Astrolabe", "A star-reader's instrument, tripod bent, disc cracked through the constellation it was measuring."),
    R("rm_sk_5", "nest", 48, 284, "Shriker Nest", "Twigs, wool, and small bones. Some of the bones wear rings."),
    R("rm_sk_6", "nest", 80, 276, "Shriker Nest", "A nest wedged behind a pillar, lined with what used to be a banner."),
    R("rm_sk_7", "banner", 64, 284, "Fallen Standard", "The wind hall's standard, half-buried in scree blown through the baffles."),
    R("rm_sk_8", "bones", 60, 292, "Bone Pile", "Bones on the traverse, picked clean and bleached by altitude."),
    R("rm_sk_9", "bones", 86, 291, "Bone Pile", "More bones near the Warder's walk. It tidies them to the edges, like a groundskeeper."),
    R("rm_sk_10", "skeleton", 94, 297, "A Fallen Climber", "Face-down on the ascent, still roped to a piton. The rope outlived the climber by centuries."),
    R("rm_sk_11", "nest", 117, 286, "The Herald's Eyrie-Nest", "The great nest itself — wide as a cart, built of beams, spears and bones. The Storm-Herald stands its watch from here."),
    R("rm_sk_12", "brazier", 112, 284, "Beacon-Flame", "A fragment of the great beacon, still lit — the fire that must never be shown burns low, in private."),
    R("rm_sk_13", "brazier", 122, 288, "Beacon-Flame", "Another shard of the old signal-fire, caged and hoarded."),
    R("rm_sk_14", "bones", 120, 290, "Bone Pile", "Bones beneath the eyrie's rim. The hawks eat well."),
    R("rm_sk_15", "bones", 110, 287, "Bone Pile", "Small bones, large bones. The eyrie doesn't discriminate."),

    // === THE UNDERGATE — pilgrims at every seal, wolves on the road home ===
    R("rm_ug_1", "bones", 46, 314, "Bone Pile", "Bones just inside the mouth. The Undergate's threshold has been argued at before."),
    R("rm_ug_2", "camp", 24, 320, "The Last Pilgrim Camp", "Bedrolls for four, a firepit, a cooking pot — all facing downhill, toward the seals. Pilgrims of the psalm. None of the bedrolls were slept in twice."),
    R("rm_ug_3", "skeleton", 40, 327, "A Pilgrim", "Fallen on the third terrace, arms toward the descent. Even dying, headed down."),
    R("rm_ug_4", "sitting", 82, 329, "A Pilgrim of the Psalm", "Seated before the seals with palms up — someone who came to recite, and recited until they stopped."),
    R("rm_ug_5", "urn", 80, 324, "Votive Urn", "An urn of offerings at the Seal Hall's edge: knucklebones, teeth, and five smooth stones."),
    R("rm_ug_6", "urn", 98, 324, "Votive Urn", "Another urn. The offerings continue centuries deeper than the offerers."),
    R("rm_ug_7", "bones", 96, 329, "Bone Pile", "Bones beneath the Seal of the Storm. Reaching up."),
    R("rm_ug_8", "skeleton", 120, 324, "One of the Wardens' Own", "A north-folk skeleton in the Underway, fallen mid-stride on the patrol line it walked in life."),
    R("rm_ug_9", "bones", 132, 324, "Bone Pile", "Bones between the pillars, arranged too neatly to have fallen."),
    R("rm_ug_10", "crate", 114, 330, "The Underway Stores", "Sealed crates of grave-goods and grain — supplies for the keepers of a thousand-year watch."),
    R("rm_ug_11", "banner", 140, 327, "The Wardens' Standard", "The Undergate's own standard, laid flat and weighted with stones. Retired, not fallen."),
    R("rm_ug_12", "sitting", 113, 335, "He Knocked Until the End", "A skeleton seated against the Gatewright's door, knuckles resting on the stone. The door is older than his patience was."),
    R("rm_ug_13", "skeleton", 50, 341, "A Pilgrim", "Face-down in the Echo Gallery, hands over where its ears were."),
    R("rm_ug_14", "bones", 88, 341, "Bone Pile", "Bones by the sounding-stones' water. The echoes don't disturb them. Nothing does."),
    R("rm_ug_15", "urn", 116, 340, "Votive Urn", "A pilgrim urn set square in the gallery's heart, full to the lid with small white stones — one per verse, times many."),
    R("rm_ug_16", "banner", 36, 341, "The Wardens' Standard", "Another retired standard by the western seal. They folded their colours before the end. It WAS the end, and they knew."),
    R("rm_ug_17", "bones", 52, 352, "Wolf Bones", "A wolf's skeleton on the deep road, mid-stride, headed north. It got further than most."),
    R("rm_ug_18", "bones", 94, 351, "Wolf Bones", "Another wolf, curled at the corridor's edge as if it lay down to wait."),
    R("rm_ug_19", "skeleton", 108, 352, "A Pilgrim", "Past the Deepway Door — one who got through, and knelt at the waymarks, and never stood."),
    R("rm_ug_20", "bones", 137, 351, "The Bone-Field", "Here the floor gives up pretending to be stone. Bones in drifts, all the way to the Last Seal."),
    R("rm_ug_21", "skeleton", 140, 351, "The Last Pilgrim", "An arm's length from the Last Seal. An arm's length."),
    R("rm_ug_22", "sitting", 148, 350, "Honour-Dead of the Fifth Seal", "Seated in a wall-niche flanking the North Door, armed and armoured. Death did not end the posting."),
    R("rm_ug_23", "sitting", 148, 354, "Honour-Dead of the Fifth Seal", "The niche's twin. Between them, everything that approaches the door is watched twice."),
    R("rm_ug_24", "dais", 152, 355, "The Fifth Seal", "A ring of pale stone inlaid in the floor — the seal itself. The Pale Warden stands upon it, because that is the whole instruction."),
    R("rm_ug_25", "brazier", 152, 351, "Seal-Fire", "White flame in a pale iron cage, burning since the psalm was cut. It gutters when the door is spoken to."),
    R("rm_ug_26", "brazier", 155, 353, "Seal-Fire", "The second seal-fire. Their light does not warm."),
    R("rm_ug_27", "bones", 150, 357, "Bone Pile", "Bones at the foot of the Warden's hall. Every one of them faced the door when it fell."),
  ];
}

/**
 * The Ninth Bell questline (FINAL map coordinates, not remapped): Captain Morn
 * at Ironvale's north gate, Wick the charcoal-burner on the high dirt, the
 * fence-tree cache, and the Coldstep Shack in the far north-west — Serjeant
 * Vane in hiding, the blades that follow you to him, and Quartermaster Brann.
 */
const ninthBellObjects: WorldObjectDef[] = [
  {
    id: "captain_morn", kind: "npc", x: 60, y: 36, name: "Captain Hesta Morn",
    lines: [
      "Mind the road, traveller. We're a guard short on this gate — and the watch-book says worse about him than I'll repeat.",
      "Garrick Vane. Twelve years on this wall, and the night the pay-chest was emptied he was gone by morning. The book calls it settled. Books don't blush.",
    ],
    reactiveLines: [
      { requiresFlags: ["vane_cleared"], lines: [
        "Vane stands the north wall again, and the watch-book has a page torn out and rewritten in my hand. That doesn't happen twice in a career.",
        "Brann kept every ledger in this city, and it took an outsider to audit HIM. If you ever want honest work, the watch pays badly and thanks worse — but it remembers.",
      ] },
      { requiresFlags: ["vane_free"], lines: [
        "The book still says Vane turned. You and I know what a book's word is worth now.",
        "Somewhere north-west there's a shack that catches its own fish and answers to no bell. I don't go looking. Some debts are paid by not collecting them.",
      ] },
    ],
  },
  {
    id: "wick_burner", kind: "npc", x: 29, y: 37, name: "Wick, a Charcoal-Burner",
    lines: [
      "Smoke and quiet, that's my trade. You learn to see a long way through both.",
      "Folk pass. Most don't look up. The ones being hunted always do.",
    ],
  },
  // The fence-tree: an old boundary oak that swallowed its fence-rail whole,
  // with the serjeant's cache buried at its foot (revealed by Wick's riddle).
  { id: "fence_tree", kind: "tree", x: 22, y: 20, name: "The Fence-Tree", levelReq: 99,
    lines: ["An old boundary oak grown clean through a fence-rail — the wood swallowed the iron and kept growing. The earth at its foot has been turned, and not by roots."] },
  {
    id: "vane_cache", kind: "dungeon_chest", x: 21, y: 20, name: "Disturbed Earth",
    requiresFlag: "vane_trail",
    loot: [{ item: "vane_badge", qty: 1 }, { item: "vane_letter", qty: 1 }],
    lines: ["Soft-dug soil under the fence-tree. Something square is buried a hand's width down."],
  },
  // The Coldstep Shack (carved in map.ts at 6..10 × 7..10).
  {
    id: "shack_sign", kind: "signpost", x: 11, y: 11, name: "The Coldstep Shack",
    lines: ["No name, no bell, no watch-book. The last shack before the maps give up. Someone has re-hung the door — recently, and from the inside."],
  },
  {
    id: "serjeant_vane", kind: "npc", x: 8, y: 9, name: "Serjeant Garrick Vane",
    lines: [
      "Twelve years I rang the hours on Ironvale's wall. Now I count them by which way the snow leans.",
      "If you came for the reward, there isn't one. If you came for the truth, it's colder up here than the weather.",
    ],
    reactiveLines: [
      { requiresFlags: ["vane_cleared"], lines: [
        "Hesta tore the page out herself, they tell me. I'll stand the north wall again and no one will ever know what it cost — which is how a wall likes it.",
        "You heard a bell nobody logged and went looking anyway. Whatever they pin on you someday — I'll be the one who doesn't believe it.",
      ] },
      { requiresFlags: ["vane_free"], lines: [
        "Serjeant Vane is dead, and the fishing up here is better than the pay ever was. Some verdicts are kinder than the truth.",
        "You kept a secret that would have bought you a citation and a parade. I don't know what to call that, so I'll call it a friend.",
      ] },
    ],
  },
  { id: "blade_1", kind: "monster", x: 11, y: 12, name: "Hired Blade", monster: "hired_blade", requiresFlag: "vane_door_open" },
  { id: "blade_2", kind: "monster", x: 6, y: 12, name: "Hired Blade", monster: "hired_blade", requiresFlag: "vane_door_open" },
  { id: "qm_brann", kind: "monster", x: 8, y: 13, name: "Quartermaster Brann", monster: "quartermaster_brann", requiresFlag: "brann_comes" },
];

export const objects: WorldObjectDef[] = [
  ...rawObjects.map(remapObject),
  ...newPois.map(scatterFill),
  ...buildHousing(),
  ...buildDungeonSites(),
  ...buildDungeonDressing(),
  ...pierObjects,
  ...ninthBellObjects,
].map(snapSpawn);

/** Where the player first appears — a clearing in the Knuckle Hills, by Aldric
 *  and the knucklestone outcrop, so the opening quest is right at hand. */
export const playerSpawn = remap(22, 16);
