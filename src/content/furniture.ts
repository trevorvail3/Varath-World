/**
 * src/content/furniture.ts
 * ------------------------
 * The Homestead's furniture catalogue (pure DATA) and the room surfaces —
 * the great Construction sink and the reward loop of player housing.
 *
 * Rather than hand-author every piece, we describe a set of ARCHETYPES (a shape
 * + a footprint + a material band) and stamp out RECOLOUR VARIANTS across a
 * palette of woods, painted solids and fabrics — Animal-Crossing breadth from a
 * compact source. The renderer draws each piece from its `render` descriptor,
 * scaled to its footprint, so a bed reads bigger than a desk reads bigger than a
 * stool. A handful of functional STATIONS (hearth / anvil / cauldron / bench /
 * bank chest) keep their bespoke art and their `station` behaviour.
 *
 * `station` makes a piece functional; `bed` sets your respawn; `light`/`glow`
 * lights the room at night; `wall: true` hangs on the wall (doesn't block the
 * floor); `footprint` is [w, h] in tiles.
 */

import type { FurnitureDef, FurnitureRender, SurfaceDef, ItemId } from "../core/types.ts";

// --- palettes ---------------------------------------------------------------
interface Wood { key: string; name: string; body: string; accent: string }
const WOODS: Wood[] = [
  { key: "ashwood", name: "Ashwood", body: "#9c7a48", accent: "#6e5436" },
  { key: "greyoak", name: "Greyoak", body: "#7e6a4e", accent: "#55432c" },
  { key: "ironbark", name: "Ironbark", body: "#5c4730", accent: "#3c2e1f" },
  { key: "heartoak", name: "Heartoak", body: "#7a4a2e", accent: "#532f1c" },
  { key: "birch", name: "Birch", body: "#cbb489", accent: "#a08a5f" },
  { key: "walnut", name: "Walnut", body: "#4a3323", accent: "#2f1f13" },
  { key: "driftwood", name: "Driftwood", body: "#8a8072", accent: "#5f574c" },
  { key: "ebony", name: "Ebony", body: "#2e2823", accent: "#161311" },
];
interface Solid { key: string; name: string; body: string; accent: string }
const SOLIDS: Solid[] = [
  { key: "red", name: "Crimson", body: "#8a3b34", accent: "#5e2823" },
  { key: "blue", name: "Cobalt", body: "#3a5a7a", accent: "#273e55" },
  { key: "green", name: "Fern", body: "#4f7a3a", accent: "#365227" },
  { key: "teal", name: "Teal", body: "#2f6b66", accent: "#204a46" },
  { key: "plum", name: "Plum", body: "#5a3a6a", accent: "#3d2748" },
  { key: "rose", name: "Rose", body: "#a85a72", accent: "#7a3e52" },
  { key: "gold", name: "Ochre", body: "#c7a13e", accent: "#8f7128" },
  { key: "slate", name: "Slate", body: "#566072", accent: "#3a4150" },
  { key: "black", name: "Ink", body: "#26242a", accent: "#141318" },
  { key: "white", name: "Bone", body: "#d9d2c4", accent: "#b3aa96" },
];
interface Cloth { key: string; name: string; color: string }
const CLOTHS: Cloth[] = [
  { key: "linen", name: "Linen", color: "#b3a06e" },
  { key: "wine", name: "Wine", color: "#6a2f38" },
  { key: "forest", name: "Forest", color: "#35503c" },
  { key: "indigo", name: "Indigo", color: "#2f3a5a" },
  { key: "cream", name: "Cream", color: "#d8cba0" },
  { key: "rose", name: "Rose", color: "#a05a6a" },
  { key: "charcoal", name: "Charcoal", color: "#3a3a40" },
  { key: "gold", name: "Gold", color: "#8a6a2c" },
];

// --- material bands (real item ids), scaled by piece area -------------------
type Mats = Partial<Record<ItemId, number>>;
const PLANK: Record<number, ItemId> = { 0: "plank_ashwood", 1: "plank_greyoak", 2: "plank_ironbark", 3: "plank_heartoak" };
const LEATHER: Record<number, ItemId> = { 0: "cured_leather", 1: "cured_leather", 2: "hardened_leather", 3: "master_leather" };
function matsFor(band: number, area: number, opts: { cloth?: boolean; glass?: boolean; metal?: boolean; gem?: boolean } = {}): Mats {
  const m: Mats = {};
  m[PLANK[band]!] = Math.max(1, Math.round(area * (band >= 2 ? 1.2 : 1)));
  if (opts.cloth) m[LEATHER[band]!] = Math.max(1, Math.round(area * 0.6));
  if (opts.metal) m[(band >= 2 ? "ashiron_bar" : "knucklestone_bar") as ItemId] = Math.max(1, Math.round(area * 0.5));
  if (opts.glass) m["glass_bead"] = Math.max(2, area);
  if (opts.gem || band >= 3) m["cut_gem"] = 1;
  return m;
}
/** Level requirement from a band (0..3) with a little spread by area. */
function lvlFor(band: number, area: number): number {
  return Math.min(99, [1, 20, 45, 70][band]! + Math.min(15, Math.floor(area * 1.5)));
}

export const furniture: Record<string, FurnitureDef> = {};
function add(def: FurnitureDef): void { furniture[def.id] = def; }

/** Stamp out one archetype across a palette of recolours. */
interface Base {
  id: string; name: string; category: string; shape: string;
  fp: [number, number]; band: number; comfort: number;
  variants: "wood" | "solid" | "cloth" | "none";
  cloth?: boolean; glass?: boolean; metal?: boolean; gem?: boolean;
  bed?: boolean; light?: boolean; glow?: string; wall?: boolean;
  blurb: string;
}
function stamp(b: Base): void {
  const area = b.fp[0] * b.fp[1];
  const level = lvlFor(b.band, area);
  const xp = Math.round((20 + area * 18) * (1 + b.band * 0.6));
  const opts: { cloth?: boolean; glass?: boolean; metal?: boolean; gem?: boolean } = {};
  if (b.cloth) opts.cloth = true;
  if (b.glass) opts.glass = true;
  if (b.metal) opts.metal = true;
  if (b.gem) opts.gem = true;
  const mats = matsFor(b.band, area, opts);
  const mkRender = (extra: { wood: string; accent: string; cloth?: string }): FurnitureRender => {
    const r: FurnitureRender = { shape: b.shape, wood: extra.wood, accent: extra.accent };
    if (extra.cloth !== undefined) r.cloth = extra.cloth;
    if (b.glow !== undefined) r.glow = b.glow;
    return r;
  };
  const mk = (key: string, name: string, render: FurnitureRender): void => add({
    id: `${b.id}_${key}`, name, category: b.category, levelReq: level, xp, comfort: b.comfort,
    materials: { ...mats }, footprint: b.fp, blurb: b.blurb, render,
    ...(b.bed ? { bed: true } : {}), ...(b.light ? { light: true } : {}), ...(b.wall ? { wall: true } : {}),
  });
  if (b.variants === "wood") {
    for (const w of WOODS) mk(w.key, `${w.name} ${b.name}`, mkRender({ wood: w.body, accent: w.accent }));
  } else if (b.variants === "solid") {
    for (const s of SOLIDS) mk(s.key, `${s.name} ${b.name}`, mkRender({ wood: s.body, accent: s.accent }));
  } else if (b.variants === "cloth") {
    for (const c of CLOTHS) mk(c.key, `${c.name} ${b.name}`, mkRender({ wood: "#6e5436", accent: "#4a3626", cloth: c.color }));
  } else {
    mk("std", b.name, mkRender({ wood: WOODS[1]!.body, accent: WOODS[1]!.accent }));
  }
}

// ===== SEATING ==============================================================
stamp({ id: "seat_stool", name: "Stool", category: "seating", shape: "stool", fp: [1, 1], band: 0, comfort: 3, variants: "wood", blurb: "A three-legged stool — honest and hard-wearing." });
stamp({ id: "seat_chair", name: "Chair", category: "seating", shape: "chair", fp: [1, 1], band: 1, comfort: 8, variants: "wood", cloth: true, blurb: "A high-backed chair you can sit out a long evening in." });
stamp({ id: "seat_dining", name: "Dining Chair", category: "seating", shape: "chair", fp: [1, 1], band: 1, comfort: 9, variants: "cloth", cloth: true, blurb: "A cushioned dining chair, dressed in your choice of cloth." });
stamp({ id: "seat_arm", name: "Armchair", category: "seating", shape: "armchair", fp: [1, 1], band: 2, comfort: 15, variants: "cloth", cloth: true, blurb: "A deep armchair you sink into and don't get up from." });
stamp({ id: "seat_sofa", name: "Sofa", category: "seating", shape: "sofa", fp: [2, 1], band: 2, comfort: 22, variants: "cloth", cloth: true, blurb: "A two-seat sofa — the heart of a warm room." });
stamp({ id: "seat_bench", name: "Bench", category: "seating", shape: "bench", fp: [2, 1], band: 0, comfort: 6, variants: "wood", blurb: "A plain plank bench; sits three at a push." });
stamp({ id: "seat_throne", name: "Throne", category: "seating", shape: "throne", fp: [1, 1], band: 3, comfort: 30, variants: "solid", cloth: true, gem: true, blurb: "A gilded throne. Sit in it and try not to give orders." });

// ===== TABLES + DESKS =======================================================
stamp({ id: "tbl_side", name: "Side Table", category: "table", shape: "sidetable", fp: [1, 1], band: 0, comfort: 4, variants: "wood", blurb: "A little side table for a lamp and a cup." });
stamp({ id: "tbl_coffee", name: "Coffee Table", category: "table", shape: "table", fp: [2, 1], band: 1, comfort: 8, variants: "wood", blurb: "A low table for the middle of the room." });
stamp({ id: "tbl_dining", name: "Dining Table", category: "table", shape: "table", fp: [2, 2], band: 2, comfort: 16, variants: "wood", metal: true, blurb: "A banquet board that seats the whole household." });
stamp({ id: "tbl_long", name: "Long Table", category: "table", shape: "longtable", fp: [3, 1], band: 2, comfort: 18, variants: "wood", metal: true, blurb: "A long hall table — set it and the hall expects company." });
stamp({ id: "tbl_desk", name: "Writing Desk", category: "table", shape: "desk", fp: [2, 1], band: 1, comfort: 10, variants: "wood", blurb: "A desk with a drawer for letters and ledgers." });
stamp({ id: "tbl_round", name: "Round Table", category: "table", shape: "roundtable", fp: [2, 2], band: 2, comfort: 15, variants: "wood", blurb: "A round table — no head, no foot, all equal." });
stamp({ id: "tbl_gold", name: "Gilded Table", category: "table", shape: "table", fp: [2, 2], band: 3, comfort: 30, variants: "solid", metal: true, gem: true, blurb: "Heartoak inlaid with gold and a single set gem." });

// ===== BEDS (bigger than everything) ========================================
stamp({ id: "bed_cot", name: "Cot", category: "bed", shape: "bed", fp: [1, 2], band: 0, comfort: 3, variants: "wood", cloth: true, bed: true, blurb: "Boards and a straw tick. The road carries you home." });
stamp({ id: "bed_single", name: "Single Bed", category: "bed", shape: "bed", fp: [1, 2], band: 1, comfort: 11, variants: "cloth", cloth: true, bed: true, blurb: "A proper leather-strung bed. A real night's rest." });
stamp({ id: "bed_double", name: "Double Bed", category: "bed", shape: "bedlarge", fp: [2, 2], band: 2, comfort: 22, variants: "cloth", cloth: true, bed: true, blurb: "A wide bed of a settled, prosperous house." });
stamp({ id: "bed_canopy", name: "Canopy Bed", category: "bed", shape: "canopy", fp: [2, 3], band: 3, comfort: 36, variants: "cloth", cloth: true, gem: true, bed: true, blurb: "Posts, drawn drapes and gem-headed nails. You have arrived." });

// ===== STORAGE ==============================================================
stamp({ id: "sto_crate", name: "Crate", category: "storage", shape: "crate", fp: [1, 1], band: 0, comfort: 2, variants: "wood", blurb: "A stout wooden crate. Holds odds and ends." });
stamp({ id: "sto_drawers", name: "Drawers", category: "storage", shape: "drawers", fp: [1, 1], band: 1, comfort: 8, variants: "wood", metal: true, blurb: "A chest of drawers, brass-pulled." });
stamp({ id: "sto_wardrobe", name: "Wardrobe", category: "storage", shape: "wardrobe", fp: [1, 2], band: 2, comfort: 14, variants: "wood", metal: true, blurb: "A tall wardrobe for a wardrobe's worth of cloaks." });
stamp({ id: "sto_cabinet", name: "Cabinet", category: "storage", shape: "cabinet", fp: [1, 1], band: 2, comfort: 12, variants: "solid", glass: true, blurb: "A glazed cabinet; whatever you shelve looks important." });
stamp({ id: "sto_shelf", name: "Bookshelf", category: "storage", shape: "bookshelf", fp: [1, 1], band: 1, comfort: 9, variants: "wood", blurb: "A shelf of well-thumbed books and small finds." });
stamp({ id: "sto_sideboard", name: "Sideboard", category: "storage", shape: "sideboard", fp: [2, 1], band: 2, comfort: 13, variants: "wood", metal: true, blurb: "A long sideboard to lay a feast out on." });

// ===== LIGHTING =============================================================
stamp({ id: "lgt_candle", name: "Candle Stand", category: "lighting", shape: "candle", fp: [1, 1], band: 0, comfort: 4, variants: "wood", light: true, glow: "#ffcf6a", blurb: "A floor stand of tallow candles and warm wax." });
stamp({ id: "lgt_lamp", name: "Table Lamp", category: "lighting", shape: "tablelamp", fp: [1, 1], band: 1, comfort: 7, variants: "solid", light: true, glass: true, glow: "#ffd27a", blurb: "A little lamp with a coloured glass shade." });
stamp({ id: "lgt_floor", name: "Floor Lamp", category: "lighting", shape: "floorlamp", fp: [1, 1], band: 2, comfort: 12, variants: "solid", light: true, glass: true, glow: "#ffd27a", blurb: "A tall standing lamp — a pool of light in a corner." });
stamp({ id: "lgt_lantern", name: "Lantern", category: "lighting", shape: "lantern", fp: [1, 1], band: 1, comfort: 8, variants: "wood", light: true, metal: true, glow: "#ffbe55", blurb: "A hung iron lantern with a steady flame." });
stamp({ id: "lgt_brazier", name: "Brazier", category: "lighting", shape: "brazier", fp: [1, 1], band: 2, comfort: 13, variants: "solid", light: true, metal: true, glow: "#ff8a3a", blurb: "A standing brazier of banked coals." });
stamp({ id: "lgt_chandelier", name: "Chandelier", category: "lighting", shape: "chandelier", fp: [1, 1], band: 3, comfort: 26, variants: "solid", light: true, glass: true, gem: true, glow: "#ffe0a0", blurb: "A ring of lamps that lights the whole room at a stroke." });

// ===== PLANTS ===============================================================
stamp({ id: "plt_pot", name: "Potted Plant", category: "plant", shape: "plant", fp: [1, 1], band: 0, comfort: 5, variants: "solid", blurb: "A leafy plant in a painted pot." });
stamp({ id: "plt_fern", name: "Fern", category: "plant", shape: "fern", fp: [1, 1], band: 0, comfort: 5, variants: "solid", blurb: "A fern that softens any corner." });
stamp({ id: "plt_cactus", name: "Cactus", category: "plant", shape: "cactus", fp: [1, 1], band: 0, comfort: 4, variants: "solid", blurb: "A little cactus. Asks nothing of you." });
stamp({ id: "plt_flowers", name: "Flower Box", category: "plant", shape: "flowerpot", fp: [1, 1], band: 0, comfort: 6, variants: "solid", blurb: "A box of colour on the windowsill." });
stamp({ id: "plt_tall", name: "Tall Plant", category: "plant", shape: "tallplant", fp: [1, 1], band: 1, comfort: 9, variants: "solid", blurb: "A tall broad-leaf in a heavy pot." });
stamp({ id: "plt_tree", name: "Potted Tree", category: "plant", shape: "tree", fp: [1, 2], band: 2, comfort: 15, variants: "solid", blurb: "A small indoor tree — a whole season under your roof." });

// ===== DÉCOR (freestanding) =================================================
stamp({ id: "dec_vase", name: "Vase", category: "display", shape: "vase", fp: [1, 1], band: 1, comfort: 7, variants: "solid", glass: true, blurb: "A tall glazed vase." });
stamp({ id: "dec_urn", name: "Urn", category: "display", shape: "urn", fp: [1, 1], band: 1, comfort: 7, variants: "solid", blurb: "A big-bellied urn for a doorway." });
stamp({ id: "dec_statue", name: "Statue", category: "display", shape: "statue", fp: [1, 1], band: 2, comfort: 16, variants: "solid", blurb: "A carved figure on a plinth." });
stamp({ id: "dec_bust", name: "Bust", category: "display", shape: "bust", fp: [1, 1], band: 2, comfort: 12, variants: "solid", blurb: "A stern marble bust of someone important." });
stamp({ id: "dec_globe", name: "Globe", category: "display", shape: "globe", fp: [1, 1], band: 2, comfort: 11, variants: "wood", metal: true, blurb: "A world on a brass axis; spin it and dream of roads." });
stamp({ id: "dec_barrel", name: "Barrel", category: "display", shape: "barrel", fp: [1, 1], band: 0, comfort: 3, variants: "wood", metal: true, blurb: "A hooped barrel. Ale, apples, or just atmosphere." });
stamp({ id: "dec_screen", name: "Folding Screen", category: "display", shape: "screen", fp: [2, 1], band: 2, comfort: 12, variants: "cloth", cloth: true, blurb: "A painted folding screen to divide a room." });
stamp({ id: "dec_birdcage", name: "Birdcage", category: "display", shape: "birdcage", fp: [1, 1], band: 1, comfort: 8, variants: "solid", metal: true, blurb: "A standing cage; the finch is included, they say." });
stamp({ id: "dec_easel", name: "Easel", category: "display", shape: "easel", fp: [1, 1], band: 1, comfort: 7, variants: "wood", blurb: "An easel with a half-finished view on it." });
stamp({ id: "dec_harp", name: "Harp", category: "display", shape: "harp", fp: [1, 1], band: 3, comfort: 20, variants: "wood", gem: true, blurb: "A standing harp; it hums when the wind gets in." });
stamp({ id: "dec_fountain", name: "Fountain", category: "display", shape: "fountain", fp: [2, 2], band: 3, comfort: 24, variants: "solid", blurb: "A little indoor fountain — extravagant, and lovely." });

// ===== WALL-HUNG ============================================================
stamp({ id: "wal_painting", name: "Painting", category: "hall", shape: "painting", fp: [1, 1], band: 1, comfort: 8, variants: "solid", wall: true, blurb: "A framed painting for a bare wall." });
stamp({ id: "wal_tapestry", name: "Tapestry", category: "hall", shape: "tapestry", fp: [1, 1], band: 2, comfort: 12, variants: "cloth", cloth: true, wall: true, blurb: "A woven tapestry; warms a stone wall and the eye." });
stamp({ id: "wal_banner", name: "Banner", category: "hall", shape: "banner", fp: [1, 1], band: 1, comfort: 9, variants: "cloth", cloth: true, wall: true, blurb: "A hanging banner in your own colours." });
stamp({ id: "wal_mirror", name: "Mirror", category: "hall", shape: "mirror", fp: [1, 1], band: 2, comfort: 11, variants: "solid", wall: true, glass: true, blurb: "A framed looking-glass. Doubles the light." });
stamp({ id: "wal_clock", name: "Wall Clock", category: "hall", shape: "clock", fp: [1, 1], band: 2, comfort: 12, variants: "wood", metal: true, wall: true, blurb: "A wall clock that keeps the house honest." });
stamp({ id: "wal_shield", name: "Wall Shield", category: "hall", shape: "shield", fp: [1, 1], band: 2, comfort: 13, variants: "solid", metal: true, wall: true, blurb: "A crossed-arms trophy for the hall." });
stamp({ id: "wal_antlers", name: "Antler Mount", category: "hall", shape: "antlers", fp: [1, 1], band: 2, comfort: 12, variants: "wood", wall: true, blurb: "A mounted rack; the hunters will want the story." });
stamp({ id: "wal_map", name: "Framed Map", category: "hall", shape: "map", fp: [1, 1], band: 1, comfort: 8, variants: "wood", wall: true, blurb: "A framed map of Varath, roads picked out in ink." });

// ===== RUGS (floor coverings — walk over, drawn under) ======================
stamp({ id: "rug_round", name: "Round Rug", category: "rug", shape: "rug", fp: [2, 2], band: 0, comfort: 6, variants: "cloth", cloth: true, blurb: "A round woven rug for the centre of a room." });
stamp({ id: "rug_runner", name: "Runner", category: "rug", shape: "rug", fp: [3, 1], band: 0, comfort: 5, variants: "cloth", cloth: true, blurb: "A long runner for a hall or a doorway." });
stamp({ id: "rug_large", name: "Great Rug", category: "rug", shape: "rug", fp: [3, 2], band: 1, comfort: 11, variants: "cloth", cloth: true, blurb: "A great patterned rug — the thing a guest first remarks on." });
stamp({ id: "rug_hide", name: "Hide Rug", category: "rug", shape: "hide", fp: [2, 2], band: 0, comfort: 6, variants: "solid", blurb: "A pegged-out hide, warm underfoot." });

// ===== STATIONS (bespoke art + function) ====================================
add({ id: "fur_kitchen_hearth", name: "Cooking Hearth", category: "kitchen", levelReq: 1, xp: 45, comfort: 5, station: "fire", footprint: [1, 1], materials: { stone_block: 3, mortar_basic: 2 }, blurb: "A mortared firebox with a pot-hook. Cook without trudging to town." });
add({ id: "fur_kitchen_range", name: "Iron Range", category: "kitchen", levelReq: 35, xp: 190, comfort: 15, station: "fire", footprint: [1, 1], materials: { cut_coldvein: 4, ashiron_bar: 2 }, blurb: "An iron range with a proper flue — the heart of a real kitchen." });
add({ id: "fur_kitchen_grand", name: "Grand Range", category: "kitchen", levelReq: 65, xp: 330, comfort: 26, station: "fire", footprint: [1, 1], materials: { cut_ribstone: 4, mortar_spinite: 3, hearthite_bar: 2 }, blurb: "A double-hearthed range banked with hearthite. Feeds a feast." });
add({ id: "fur_store_chest", name: "Oak Chest", category: "storage", levelReq: 10, xp: 70, comfort: 6, station: "bank", footprint: [1, 1], materials: { plank_greyoak: 4, ashiron_rivet: 2 }, blurb: "A banded chest. Opens onto the same stores as the Ironvale vault." });
add({ id: "fur_store_strongbox", name: "Ironbound Strongbox", category: "storage", levelReq: 45, xp: 240, comfort: 17, station: "bank", footprint: [1, 1], materials: { plank_heartoak: 3, bloodore_bar: 2 }, blurb: "Heartoak bound in bloodore straps. A strongbox that shrugs off a siege." });
add({ id: "fur_store_vault", name: "Gold Vault", category: "storage", levelReq: 80, xp: 420, comfort: 30, station: "bank", footprint: [1, 1], materials: { vault_stone: 2, gold_bar: 2, cut_gem: 1 }, blurb: "Vault stone and a gold-set door. Nothing leaves but by your hand." });
add({ id: "fur_shop_bench", name: "Joiner's Bench", category: "workshop", levelReq: 15, xp: 90, comfort: 7, station: "workbench", footprint: [1, 1], materials: { plank_stonewood: 4, timber_frame: 1 }, blurb: "A racked bench of saws and chisels. Build at home." });
add({ id: "fur_shop_stoneworks", name: "Stoneworks Bench", category: "workshop", levelReq: 50, xp: 260, comfort: 18, station: "workbench", footprint: [1, 1], materials: { stonewood_beam: 2, mortar_spinite: 2 }, blurb: "A mason's heavy bench, stone-topped and true." });
add({ id: "fur_forge_stone", name: "Stone Anvil", category: "forge", levelReq: 25, xp: 150, comfort: 10, station: "anvil", footprint: [1, 1], materials: { stone_block: 4, ashiron_bar: 3 }, blurb: "A bench anvil bedded in dressed stone. Beat out your own gear." });
add({ id: "fur_forge_iron", name: "Iron Anvil", category: "forge", levelReq: 45, xp: 230, comfort: 17, station: "anvil", footprint: [1, 1], materials: { ashiron_bar: 5, cut_coldvein: 2 }, blurb: "A full-size iron anvil that rings clean under the hammer." });
add({ id: "fur_alch_cauldron", name: "Herbalist's Cauldron", category: "alchemy", levelReq: 30, xp: 160, comfort: 11, station: "cauldron", footprint: [1, 1], materials: { knucklestone_bar: 3, glass_vial: 4 }, blurb: "A black pot on a trivet, racked with vials. Brew at your own coals." });
add({ id: "fur_alch_still", name: "Alchemist's Still", category: "alchemy", levelReq: 55, xp: 280, comfort: 20, station: "cauldron", footprint: [1, 1], materials: { ashiron_bar: 3, glass_flask: 4, cut_gem: 1 }, blurb: "Copper coil and glasswork; the brews come out cleaner." });
// The Construction capstone (lvl 90) — and the skill's one bridge to Faith: a
// home Altar of Orun that refills Grace, so a master builder never has to trek
// to a town shrine again. Ties the two skills the audit flagged as flat at the top.
add({ id: "fur_home_altar", name: "Home Altar of Orun", category: "devotion", levelReq: 90, xp: 520, comfort: 24, station: "shrine", light: true, footprint: [1, 1], materials: { vault_stone: 2, hearthite_bar: 2, cut_gem: 2 }, render: { shape: "brazier", wood: "#c9a84a", accent: "#6e5a24", glow: "#ffd66b" }, blurb: "A gold-seamed altar of dressed vault-stone, its bowl lit with Orun's own light. Kneel and your Grace refills — no more trudging to the town shrine." });

// ===== ESTATE PRESTIGE PIECES — the mid/late-game GOLD sink (audit T4·02) =====
// Pure cosmetics, but they cost COIN as well as materials (100k–400k), filling
// the dead band between the 90k mount and the seven-figure cape where a rich
// player had nothing left to buy. Commissioned work, not gathered — so the gold
// is a true sink, not a material conversion.
add({ id: "fur_estate_chandelier", name: "Orunlight Chandelier", category: "lighting", levelReq: 82, xp: 900, comfort: 40, light: true, footprint: [2, 2], gold: 120000, materials: { gold_bar: 4, cut_gem: 3 }, render: { shape: "chandelier", wood: "#c9a84a", accent: "#7a5f1e", glow: "#ffe39a" }, blurb: "A cascade of gold arms and cut gems, lit with captured Orunlight. It costs a fortune to hang — and looks it." });
add({ id: "fur_estate_fountain", name: "Gilded Atrium Fountain", category: "display", levelReq: 86, xp: 1200, comfort: 48, footprint: [2, 2], gold: 180000, materials: { vault_stone: 4, gold_bar: 3, cut_gem: 2 }, render: { shape: "fountain", wood: "#b9cdd6", accent: "#7d94a0", glow: "#dff2ff" }, blurb: "An indoor fountain of vault-stone and gold leaf, water threaded with light. The mark of a homestead with nothing left to prove." });
add({ id: "fur_estate_statue", name: "Wyrm-Carved Monument", category: "display", levelReq: 90, xp: 1600, comfort: 55, footprint: [2, 2], gold: 250000, materials: { vault_stone: 6, hearthite_bar: 3, cut_gem: 3 }, render: { shape: "statue", wood: "#8a7d6a", accent: "#57503f" }, blurb: "A full-height monument to Cindrath, cut from a single block of vault-stone by a commissioned master. Priced to match." });
add({ id: "fur_estate_throne", name: "Throne of Varath", category: "seating", levelReq: 95, xp: 2600, comfort: 70, footprint: [2, 2], gold: 400000, materials: { vault_stone: 4, gold_bar: 6, cut_gem: 5, hearthite_bar: 2 }, render: { shape: "throne", wood: "#7a4a2e", accent: "#3c2416", cloth: "#8a2f34" }, blurb: "Gold, vault-stone and crimson — a throne fit for the master of Varath. The single most expensive thing you can build, and worth every coin to the sort who wants it." });

// ===========================================================================
// ROOM SURFACES — walls + floors the player can swap wholesale.
// ===========================================================================
export const surfaces: Record<string, SurfaceDef> = {};
function surf(kind: "wall" | "floor", id: string, name: string, color: string, seam: string, levelReq = 0, style?: SurfaceDef["style"]): void {
  surfaces[`${kind}_${id}`] = { id: `${kind}_${id}`, kind, name, color, seam, levelReq, ...(style ? { style } : {}) };
}

// Floors: default plank, wood recolours, stone/tile, painted solids.
surf("floor", "plank", "Plank Floor", "#6b4a2c", "#523620", 0, "board");
for (const w of WOODS) surf("floor", w.key, `${w.name} Floor`, w.body, w.accent, w.key === "ashwood" ? 0 : 15, "board");
surf("floor", "stone", "Stone Flags", "#726c62", "#5a544b", 20, "tile");
surf("floor", "slate", "Slate Tile", "#4a4e57", "#33363c", 35, "tile");
surf("floor", "checker", "Chequer Tile", "#cabf9e", "#3a352c", 40, "checker");
surf("floor", "marble", "Marble Floor", "#d7d2c4", "#b0aa98", 60, "tile");
for (const s of SOLIDS) surf("floor", `paint_${s.key}`, `${s.name} Floor`, s.body, s.accent, 30, "board");

// Walls: default stone, plaster, wood panelling, painted solids, papers.
surf("wall", "stone", "Stone Wall", "#6d675d", "#544e45", 0, "tile");
surf("wall", "plaster", "Plaster Wall", "#c9bda0", "#a89c80", 10, "panel");
for (const w of WOODS) surf("wall", `panel_${w.key}`, `${w.name} Panelling`, w.body, w.accent, w.key === "ashwood" ? 0 : 20, "panel");
for (const s of SOLIDS) surf("wall", `paint_${s.key}`, `${s.name} Wall`, s.body, s.accent, 25, "panel");
surf("wall", "brick", "Brick Wall", "#8a4a3a", "#5e3228", 30, "tile");
surf("wall", "gold", "Gilded Wall", "#8a6a2c", "#5e4718", 70, "panel");

// --- helpers used by the client + core -------------------------------------
/** Furniture pieces that fit a given category, level-ordered. */
export function furnitureFor(category: string): FurnitureDef[] {
  return Object.values(furniture)
    .filter((f) => f.category === category)
    .sort((a, b) => a.levelReq - b.levelReq);
}

/** Every distinct furniture category, in a sensible display order. */
export const FURNITURE_CATEGORIES = [
  "seating", "table", "bed", "storage", "lighting", "plant", "display", "hall", "rug",
  "kitchen", "forge", "alchemy", "workshop", "devotion",
] as const;

/** A home-comfort "rating" title, the visible reward for furnishing a home. */
export function comfortTitle(comfort: number): string {
  if (comfort >= 400) return "a Palace";
  if (comfort >= 260) return "an Estate";
  if (comfort >= 160) return "a Manor";
  if (comfort >= 80) return "a Fine Home";
  if (comfort >= 30) return "a Cottage";
  if (comfort > 0) return "a Hovel";
  return "bare";
}
