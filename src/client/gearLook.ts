/**
 * src/client/gearLook.ts
 * ----------------------
 * Turns worn equipment into a render-ready "gear look": which slots show, their
 * colour, the cape colour, and the held weapon's shape + colour. Colour encodes
 * VISUAL REWARD PROGRESSION — every piece reflects its material so a glance at a
 * player tells you how far they've climbed.
 *
 * Material is resolved per item:
 *  - Metal gear sits on the canon 1–10 ladder, themed to the real material names
 *    (Knucklestone stone-grey → Ashiron iron → Ribstone rust → Bloodore crimson →
 *    Voidstone violet → Hearthite fiery gold). Tier comes from an explicit `tier`,
 *    the `_<n>` id suffix, or — for named/unique drops that have neither — is
 *    INFERRED from the piece's stats against the smithed ladder, so uniques flex
 *    at their true power instead of defaulting to the lowest tier.
 *  - Leather sets render as leather (4-step brown ladder), skilling outfits as
 *    themed cloth — never as fake plate.
 */

import type { Content, EquipSlot, ItemDef, ItemId } from "../core/types.ts";

export interface Metal { base: string; edge: string }
/** Which silhouette a worn piece draws as: heavy plate, light leather (Draw
 *  gear), or a flowing robe (Devotion/magic). Drives shape, not just colour. */
export type ArmorStyle = "plate" | "leather" | "robe";
export interface GearPiece extends Metal { style: ArmorStyle }
export interface GearLook {
  helmet?: GearPiece;
  body?: GearPiece;
  legs?: GearPiece;
  boots?: GearPiece;
  shield?: GearPiece;
  weapon?: Metal & { type: string; tier?: number };
  cape?: { color: string };
}

// The named metals, in the SAME hues the pack icons use (itemIcon.ts MATS) —
// what you wear must look like what you carry. Resolved by the material word
// in the item's name/id, so "Hearthite Leg Plate" is hearthite whatever its
// tier number happens to be (legs top out at _8, everything else at _10).
const METAL_BY_NAME: ReadonlyArray<readonly [string, Metal]> = [
  ["knucklestone", { base: "#8a8275", edge: "#b2a996" }], // stone grey-brown
  ["ashiron", { base: "#8b909a", edge: "#b8bdc6" }],      // ash iron grey
  ["ribstone", { base: "#c2b48f", edge: "#e0d5b4" }],     // pale bone-tan (it IS rib-stone)
  ["spinite", { base: "#9aa0ab", edge: "#cdd3dc" }],      // cold mountain steel
  ["bloodore", { base: "#a5463a", edge: "#cd6f60" }],     // crimson-rust
  ["voidstone", { base: "#4b4664", edge: "#7c63c0" }],    // violet-black
  ["hearthite", { base: "#2f2724", edge: "#c8742e" }],    // warm-black, ember-lit trim
];

/** The metal a piece is NAMED for (matches the icon's material lookup). */
function namedMetal(item: ItemDef): Metal | null {
  const s = (item.id + " " + (item.name ?? "")).toLowerCase();
  for (const [k, m] of METAL_BY_NAME) if (s.includes(k)) return m;
  return null;
}

// The tier ladder, used only for pieces with NO material in their name (some
// uniques); the named tiers carry the same tones as METAL_BY_NAME so an
// inferred unique lands on-theme. Tiers with no smithed gear (2/5/7/8) get
// sensible in-between tones so inference lands well.
const METAL: Metal[] = [
  { base: "#8a8275", edge: "#b2a996" }, // 1  Knucklestone — stone grey-brown
  { base: "#9a6a3c", edge: "#c08a52" }, // 2  (bronze step)
  { base: "#8b909a", edge: "#b8bdc6" }, // 3  Ashiron — ash iron grey
  { base: "#c2b48f", edge: "#e0d5b4" }, // 4  Ribstone — pale bone-tan
  { base: "#9aa0ab", edge: "#cdd3dc" }, // 5  Spinite — cold steel
  { base: "#a5463a", edge: "#cd6f60" }, // 6  Bloodore — crimson-rust
  { base: "#5f6e62", edge: "#8aa093" }, // 7  (slate-green step)
  { base: "#3f6b6b", edge: "#69a6a6" }, // 8  (teal-steel step)
  { base: "#4b4664", edge: "#7c63c0" }, // 9  Voidstone — violet-black
  { base: "#2f2724", edge: "#c8742e" }, // 10 Hearthite — warm-black, ember-lit
];

// Unique looks keyed by id prefix — drops that should stand out from the metal
// ladder. The Ashen Wyrm's set reads as black-red scale lit by molten seams.
const DRAGON: Metal = { base: "#2e0f12", edge: "#ff7a2a" };
// The Boneman's set: lacquered pale bone — white, not metal.
const BONE: Metal = { base: "#ddd5c2", edge: "#f6f1e2" };

/** A distinct look for a named unique set, or null to fall back to the ladder. */
function uniqueLook(id: string): Metal | null {
  if (id.startsWith("wyrm_")) return DRAGON;
  if (id.startsWith("bone_") || id === "bonesaw") return BONE;
  return null;
}

// Leather sets: tanned → cured → hardened → master (brass-trimmed).
const LEATHER: Metal[] = [
  { base: "#8a5a32", edge: "#ad7a4e" },
  { base: "#6e4626", edge: "#946038" },
  { base: "#543620", edge: "#7c5232" },
  { base: "#3e2814", edge: "#b9863f" },
];

// Skilling outfits render as themed cloth, not metal.
const CLOTH: Record<string, Metal> = {
  prosp: { base: "#a06a34", edge: "#caa05a" },  // miner tan
  lumber: { base: "#4f6a3a", edge: "#7a9a52" }, // woodsman green
  angler: { base: "#3a5a7a", edge: "#5f86b0" }, // fisher blue
  farmer: { base: "#b59a4a", edge: "#e0c878" }, // farmhand straw
  trail: { base: "#2f7d5a", edge: "#6fce9c" },  // runner's green (Trailblazer)
};

const CAPE_PALETTE = [
  "#7a3a3a", "#3a5a7a", "#4f7a3a", "#6a4a7a", "#2f6b66", "#9a5a2a", "#6b6157", "#8a3060",
];

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

// --- Reference ladders, built once from content, to infer untiered uniques. ---
type Ladder = Array<[tier: number, stat: number]>;
let ladders: Record<string, Ladder> | null = null;

function buildLadders(content: Content): Record<string, Ladder> {
  if (ladders) return ladders;
  const collect = (prefix: string, stat: "def" | "acc"): Ladder => {
    const out: Ladder = [];
    for (const it of Object.values(content.items)) {
      const m = new RegExp(`^${prefix}_(\\d+)$`).exec(it.id);
      const v = stat === "acc" ? it.acc : it.def;
      if (m && typeof v === "number") out.push([Number(m[1]), v]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  };
  ladders = {
    helmet: collect("helm", "def"),
    armor: collect("armor", "def"),
    legs: collect("legs", "def"),
    offhand: collect("shield", "def"),
    weapon: collect("claymore", "acc"), // a full weapon ladder for relative power
  };
  return ladders;
}

/** Nearest tier on a ladder for a given stat value. */
function inferTier(stat: number, ladder: Ladder): number {
  if (ladder.length === 0) return 5;
  let best = ladder[0]!;
  for (const row of ladder) if (Math.abs(row[1] - stat) < Math.abs(best[1] - stat)) best = row;
  return best[0];
}

/** Metal tier for an item: explicit, by id suffix, or inferred from its stats. */
function metalTier(item: ItemDef, ladderKey: string, content: Content): number {
  if (typeof item.tier === "number") return item.tier;
  const m = /_(\d+)$/.exec(item.id);
  if (m) return Number(m[1]);
  const stat = ladderKey === "weapon" ? item.acc : item.def;
  if (typeof stat === "number") return inferTier(stat, buildLadders(content)[ladderKey] ?? []);
  return 5;
}

const metalOf = (tier: number): Metal => METAL[clamp(tier - 1, 0, 9)]!;

/** Leather set step (1–4) by id, or null if it isn't a leather piece. */
function leatherStep(id: string): number | null {
  const m = /^(leath|cured|hard|master)_(helm|body|legs|boots)$/.exec(id);
  if (!m) return null;
  return { leath: 1, cured: 2, hard: 3, master: 4 }[m[1]!]!;
}

/** Themed cloth for a skilling outfit, or null. */
function clothOf(id: string): Metal | null {
  const m = /^(prosp|lumber|angler|farmer|trail)_/.exec(id);
  return m ? CLOTH[m[1]!]! : null;
}

/** The silhouette a worn piece draws as: robes for Devotion/magic gear, light
 *  leather for Draw/ranged (and the crafted leather sets), heavy plate for the
 *  rest. Read from the item's category/skill so it never guesses from stats. */
function gearStyle(item: ItemDef): ArmorStyle {
  if (item.cat === "Magic Robes" || item.equipSkill === "faith" || item.magic) return "robe";
  if (item.cat === "Ranged Armour" || item.equipSkill === "draw" || item.ranged) return "leather";
  if (leatherStep(item.id) !== null) return "leather";
  return "plate";
}

/** The render colour for a worn armour piece, by material. Named metals win
 *  (they match the pack icons exactly); the tier ladder is the fallback for
 *  uniques with no material in their name. */
function colorFor(item: ItemDef, ladderKey: string, content: Content): Metal {
  const uniq = uniqueLook(item.id);
  if (uniq) return uniq;
  const ls = leatherStep(item.id);
  if (ls) return LEATHER[ls - 1]!;
  const cloth = clothOf(item.id);
  if (cloth) return cloth;
  return namedMetal(item) ?? metalOf(metalTier(item, ladderKey, content));
}

function capeColor(item: ItemDef): string {
  if (item.id === "cape_founder") return "#c8531f"; // Founder's ember-orange
  if (/varath|master|legend/i.test(item.id)) return "#e8c45a"; // gold for the grandmaster cape
  let h = 0;
  for (let i = 0; i < item.id.length; i++) h = (h * 31 + item.id.charCodeAt(i)) >>> 0;
  return CAPE_PALETTE[h % CAPE_PALETTE.length]!;
}

/** Resolve worn equipment into the visuals the avatar should layer on. */
export function resolveGear(
  eq: Partial<Record<EquipSlot, ItemId>>,
  content: Content,
): GearLook {
  const out: GearLook = {};
  const piece = (slot: EquipSlot, key: "helmet" | "body" | "legs" | "boots" | "shield"): void => {
    const id = eq[slot];
    const it = id ? content.items[id] : undefined;
    if (it) out[key] = { ...colorFor(it, slot === "armor" ? "armor" : slot, content), style: gearStyle(it) };
  };
  piece("helmet", "helmet");
  piece("armor", "body");
  piece("legs", "legs");
  piece("boots", "boots");
  piece("offhand", "shield");
  const cape = eq.cape ? content.items[eq.cape] : undefined;
  if (cape) out.cape = { color: capeColor(cape) };
  const main = eq.mainhand ? content.items[eq.mainhand] : undefined;
  if (main && !main.tool) {
    const tier = metalTier(main, "weapon", content);
    const metal = uniqueLook(main.id) ?? namedMetal(main) ?? metalOf(tier);
    // The Bonesaw is a sword in every system, but draws as a unique toothed saw.
    const shape = main.id === "bonesaw" ? "saw" : (main.wepType ?? "sword");
    out.weapon = { ...metal, type: shape, tier };
  } else if (main && main.tool === "rod") {
    // A wielded fishing rod rides in the hand like a weapon, so an angler reads
    // as an angler even while walking about — the golden champion's rod glints.
    const type = main.id === "rod_gold" ? "rod_gold" : "rod";
    out.weapon = { base: "#7a5a36", edge: "#caa05a", type };
  }
  return out;
}
