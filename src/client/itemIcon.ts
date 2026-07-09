/**
 * src/client/itemIcon.ts
 * ----------------------
 * Procedural item icons. Every one of the 467 items gets a recognisable little
 * SVG sprite instead of a flat colour swatch, so they can actually be told
 * apart at a glance: a *silhouette* picked from the item's kind (ore, ingot,
 * sword, potion, ring …) tinted by a *material palette* parsed from its name
 * (Knucklestone grey, Hearthite warm-black, Bloodore red, each wood, leather
 * tier, herb, potion …). Two pickaxes of different metals now look different;
 * so do two potions, two capes, two mounts.
 *
 * Pure + deterministic (no Date/random) — the same item always draws the same
 * icon. Results are cached by id. Returned as an inline <svg> string meant to
 * be dropped into a slot's innerHTML.
 */

import type { ItemDef } from "../core/types.ts";

// ── tiny colour maths ──────────────────────────────────────────────────────
function hexRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgbHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}
function mix(hex: string, target: string, amt: number): string {
  const a = hexRgb(hex), b = hexRgb(target);
  return rgbHex(a[0] + (b[0] - a[0]) * amt, a[1] + (b[1] - a[1]) * amt, a[2] + (b[2] - a[2]) * amt);
}
function hslHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rgbHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexRgb(hex).map((v) => v / 255) as [number, number, number];
  const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0), d = mx - mn;
  const l = (mx + mn) / 2;
  let h = 0, sat = 0;
  if (d) {
    sat = d / (1 - Math.abs(2 * l - 1));
    if (mx === r0) h = ((g0 - b0) / d) % 6;
    else if (mx === g0) h = (b0 - r0) / d + 2;
    else h = (r0 - g0) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, sat * 100, l * 100];
}
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
// Nudge a fixed material colour by a small, id-stable amount so two items of the
// same material (a plank vs a beam) still differ a touch without losing the tier.
function tweak(hex: string, id: string, hA: number, sA: number, lA: number): string {
  const [h, s, l] = rgbHsl(hex);
  const r = hash(id);
  const dh = ((r % 1000) / 999 * 2 - 1) * hA;
  const ds = (((r >>> 10) % 1000) / 999 * 2 - 1) * sA;
  const dl = (((r >>> 20) % 1000) / 999 * 2 - 1) * lA;
  return hslHex(h + dh, clamp(s + ds, 0, 100), clamp(l + dl, 0, 100));
}
// A distinct colour per id within a themed band — three independent hash slices
// (hue, saturation, lightness) make accidental collisions vanishingly rare.
function hashColor(
  id: string, hueLo: number, hueSpan: number,
  satLo: number, satSpan: number, ltLo: number, ltSpan: number,
): string {
  const r = hash(id);
  return hslHex(hueLo + (r % hueSpan), satLo + ((r >>> 9) % satSpan), ltLo + ((r >>> 18) % ltSpan));
}

// ── material palettes (metals, woods, leathers — shared across an item line) ─
// First keyword found in the id+name wins, so a "Hearthite Sword" and a
// "Hearthite Bar" share the same warm-black metal.
const MATS: ReadonlyArray<readonly [string, string]> = [
  // ore / metal tiers
  ["knucklestone", "#8a8275"], ["embercite", "#3c3640"], ["ashiron", "#8b909a"],
  ["ribstone", "#c2b48f"], ["spinite", "#9aa0ab"], ["bloodore", "#a5463a"], ["hearthite", "#2f2724"],
  ["voidstone", "#4b4664"], ["gold", "#d8b24a"], ["silver", "#cfd2d8"],
  // woods
  ["ashwood", "#cdb98c"], ["briarwood", "#8a5a44"], ["coldpine", "#90a584"],
  ["stonewood", "#9a8d76"], ["greyoak", "#a7a39a"], ["ruewood", "#7a6a82"],
  ["ruevine", "#7a6a82"], ["deeproot", "#4a3d34"], ["ironbark", "#5e5a52"],
  ["heartoak", "#c98a3a"], ["duskwood", "#6a5f72"],
  // leather tiers (specific before generic)
  ["master", "#4a3526"], ["hardened", "#6a4428"], ["cured", "#8a5a36"],
  ["tanned", "#b07c4e"], ["raw_hide", "#caa07a"], ["leather", "#9a6a3e"],
];

// ── shape classification ────────────────────────────────────────────────────
type Shape =
  | "ore" | "ingot" | "log" | "board" | "shaft" | "pickaxe" | "hatchet" | "rod"
  | "sword" | "dagger" | "claymore" | "spear" | "hammer" | "saw" | "staff" | "bow" | "bowU"
  | "arrow" | "arrowhead" | "shield" | "helm" | "body" | "legs" | "boot" | "cape"
  | "ring" | "amulet" | "gem" | "bead" | "vial" | "herb" | "seed" | "mushroom"
  | "fish" | "meat" | "cooked" | "bowl" | "bread" | "hide" | "pet" | "mount" | "coin"
  | "scroll" | "key" | "trophy" | "powder" | "rivet" | "sack" | "rune"
  | "hook" | "spike" | "horn" | "satchel"
  | "bone" | "tooth" | "tail" | "sinew";

function classify(def: ItemDef): Shape {
  const id = def.id.toLowerCase();
  const name = (def.name ?? "").toLowerCase();
  const cat = def.cat ?? "";
  const slot = def.slot;
  const s = id + " " + name;
  const has = (k: string): boolean => s.includes(k);

  // tools (mainhand, but iconic)
  if (def.tool === "pickaxe" || has("pickaxe")) return "pickaxe";
  if (def.tool === "hatchet" || has("hatchet") || (has("axe") && !has("greataxe"))) return "hatchet";
  if (def.tool === "rod" || has("fishing rod") || id.startsWith("rod_")) return "rod";

  // The Bonesaw is a sword in every system, but gets its own toothed-blade icon.
  if (has("bonesaw")) return "saw";

  // Casting staves are mainhand weapons but read as an orb-topped pole, not a
  // sword — catches every staff (magic flag) so devotion gear icons look right.
  if (def.magic || (has("staff") && slot === "mainhand")) return "staff";

  // worn gear by slot (most reliable), with keyword refinements first
  if (slot === "ranged" || has("bow") || has("warbow")) return has("unstrung") ? "bowU" : "bow";
  // NB: match "arrow" as a whole word — otherwise "marrow", "barrow", "narrow"
  // (e.g. Marrowbone Greaves, Marrow Shard) get mis-iconed as arrows.
  if (slot === "ammo" || cat === "Arrows" || (/\barrow\b/.test(s) && !has("arrowhead"))) return "arrow";
  if (slot === "helmet" || has("helm") || id.endsWith("_hat") || has(" hat")) return "helm";
  if (slot === "offhand" || has("shield") || has("ward shield")) return "shield";
  if (slot === "cape" || cat === "Capes" || has("cape")) return "cape";
  if (slot === "ring" || id.startsWith("ring_") || id.includes("_ring") || has("ring")) return "ring";
  if (slot === "necklace" || has("neck") || has("amulet") || has("pendant")) return "amulet";
  if (slot === "mount" || cat === "Mounts") return "mount";
  if (slot === "companion" || cat.includes("Pets")) return "pet";
  if (slot === "boots" || has("boot") || has("waders")) return "boot";
  if (slot === "legs" || has("legs") || has("trousers") || has("greaves")) return "legs";
  if (
    slot === "armor" || cat.includes("Armour") || cat === "Armor" ||
    has("plate") || has("mail") || has("jacket") || has(" top") || has("cuirass") ||
    has("body")
  ) return "body";

  // The bounty board's field tools are cat "Combat" but aren't weapons — each
  // gets its own icon instead of falling through to the generic sword.
  if (id === "flensing_hook") return "hook";
  if (id === "maw_spike") return "spike";
  if (id === "hunters_horn") return "horn";
  if (id === "hunters_kit") return "satchel";

  // weapons (mainhand, non-tool)
  if (slot === "mainhand" || cat.includes("Weapon") || cat === "Combat") {
    if (has("dagger")) return "dagger";
    if (has("claymore") || has("greatsword") || has("greataxe") || has("reaver") || has("flail")) return "claymore";
    if (has("spear")) return "spear";
    if (has("hammer") || has("mace")) return "hammer";
    return "sword";
  }

  // materials & consumables by category
  if (cat === "Ores") return "ore";
  if (cat === "Bars") return "ingot";
  if (cat === "Logs") return "log";
  if (cat === "Gems") return "gem";
  if (cat === "Glass") return has("bead") ? "bead" : "vial";
  if (cat === "Potions") return "vial";
  if (cat === "Herbs") return "herb";
  if (cat === "Seeds") return "seed";
  if (cat === "Foraged" || cat === "Forage") return has("mushroom") ? "mushroom" : "herb";
  if (cat === "Fish") return "fish";
  if (cat === "Meat") return "meat";
  if (cat === "Food") {
    // Prepared meals read as COOKED — plated, browned and steaming — so a Cooked
    // Ashfin never looks like a Raw Ashfin. Liquid dishes stay as bowls.
    if (has("stew") || has("broth") || has("chowder")) return "bowl";
    if (has("ration")) return "bread";
    return "cooked";
  }
  if (cat === "Hides" || cat === "Leathers") return "hide";
  if (cat.includes("Jewellery")) return (has("neck") || has("amulet")) ? "amulet" : "ring";
  if (cat === "Heraldry") return has("cape") ? "cape" : (has("crest") || has("shield")) ? "shield" : "amulet";

  // keyword routing for Materials / Quest / Drops / Finds / misc
  if (has("hammer") || has("mace")) return "hammer";
  if (has("elixir") || has("draught") || has("tonic") || has("brew") || has("potion") || has(" tea") || has("oil")) return "vial";
  if (has("shard") || has("amber") || has("crystal") || has("scale") || has("lens")) return "gem";
  if (has("bough") || has("branch") || has("b'log")) return "log";
  if (has("arrowhead") || id.startsWith("tip_")) return "arrowhead";
  if (has("unstrung")) return "bowU";
  if (has("plank") || has("beam") || has("frame") || has("timber") || id.startsWith("cut_") || has("block") || has("vault")) return "board";
  if (has("shaft") || has("haft")) return "shaft";
  if (has("rivet")) return "rivet";
  if (has("charcoal") || has("ash ") || id.endsWith("_ash") || has("wood_ash") || has("mortar") || has("sand") || has("silica")) return "powder";
  if (has("fertilizer")) return "sack";
  if (has("leather") || has("hide") || has("pelt") || has("cloth") || has("rag")) return "hide";
  if (has("seed")) return "seed";
  if (has("pearl") || has("gem")) return "gem";
  if (has("key") || has("lens") || has("cipher pendant")) return "key";
  if (has("scroll") || has("notes") || has("ledger") || has("record") || has("seal") || has("cipher") || has("pass") || has("lens")) return "scroll";
  // Bones, teeth and tails each get their OWN silhouette so a stack of drops
  // isn't a wall of near-identical trophies. (Bonemeal is crushed bone — powder.)
  if (has("bonemeal")) return "powder";
  if (has("bone")) return "bone";
  if (has("tooth") || has("teeth") || has("fang") || has("tusk")) return "tooth";
  if (has("tail")) return "tail";
  if (has("claw") || has("skull") || has("ear") || has("crown") || has("trophy") || has("horn") || has("antler") || has("hoof") || has("shell")) return "trophy";
  if (has("stone") && !has("stonewood")) return "ore";
  if (has("hook") || has("nail")) return "rivet";
  if (has("token") || has("coin") || has("badge") || has("mark") || has("sigil") || has("forge_token")) return "coin";
  // Sinew (and other cordage) is the bowstring material — a coiled hank of cord,
  // NOT a plant. Must come before the "fiber"/"root"/"moss" herb catch-all.
  if (has("sinew") || has("bowstring") || has("bow string") || has("catgut") || has("gut string") || has("cordage")) return "sinew";
  if (has("fiber") || has("bark") || has("resin") || has("sap") || has("gall") || has("splinter") || has("chip") || has("nest") || has("bloom") || has("root") || has("moss")) return "herb";

  return "rune";
}

// ── palette resolution ──────────────────────────────────────────────────────
interface Pal { base: string; dark: string; light: string; edge: string; accent: string; }

function shadeFrom(base: string, accent?: string): Pal {
  return {
    base,
    dark: mix(base, "#000000", 0.34),
    light: mix(base, "#ffffff", 0.42),
    edge: mix(base, "#000000", 0.58),
    accent: accent ?? mix(base, "#ffffff", 0.55),
  };
}

function paletteFor(def: ItemDef, shape: Shape): Pal {
  const id = def.id.toLowerCase();
  const name = (def.name ?? "").toLowerCase();
  const s = id + " " + name;

  // 0) Boss-drop sets take a signature palette across the whole set: the
  //    Boneman's bone-white, the Green Baron's forest green, the Hollow
  //    Prophet's hex violet.
  if (def.lore === "boneman" || id.startsWith("bone_") || id === "bonesaw") return shadeFrom("#efe9d8", "#cfc7b2");
  if (def.lore === "green_baron") return shadeFrom("#2f5233", "#5c8a3a");
  if (def.lore === "hollow_prophet") return shadeFrom("#3a2f4a", "#8a6bc0");

  // 1) shared material lines (metals, woods, leathers) — keeps a tier consistent,
  //    but nudged per-item so a plank and a beam of the same wood still differ.
  for (const [k, hex] of MATS) {
    if (s.includes(k)) {
      if (shape === "ring" || shape === "amulet") {
        return shadeFrom(tweak(hex, id, 5, 5, 5), hslHex(hash(id) % 360, 62, 56));
      }
      return shadeFrom(tweak(hex, id, 8, 8, 8));
    }
  }

  // 2) gathering gear keeps its green guild look
  if (/^(prosp|lumber|angler|farmer)/.test(id)) return shadeFrom(hashColor(id, 80, 70, 24, 22, 38, 16));

  // 3) per-shape colour bands — three hash dims (hue/sat/light) per item, so two
  //    mounts, two capes, two stews are reliably distinct from one another.
  switch (shape) {
    case "herb": return shadeFrom(hashColor(id, 80, 72, 34, 22, 32, 18));
    case "seed": return shadeFrom(hashColor(id, 24, 50, 34, 22, 42, 18));
    case "mushroom": return shadeFrom(hashColor(id, 0, 42, 34, 24, 38, 18));
    case "vial":
      return def.cat === "Glass"
        ? shadeFrom(tweak("#bcd6de", id, 30, 14, 10))
        : shadeFrom(hashColor(id, 0, 360, 48, 22, 44, 16));
    case "bead": return shadeFrom(hashColor(id, 0, 360, 38, 24, 50, 20));
    case "gem":
      return s.includes("pearl")
        ? shadeFrom("#e6e0d2", "#cfe6ec")
        : shadeFrom(hashColor(id, 175, 130, 44, 24, 44, 18));
    case "fish": return shadeFrom(hashColor(id, 182, 56, 16, 26, 44, 18));
    case "meat": return shadeFrom(hashColor(id, 0, 24, 36, 20, 40, 16));
    // Cooked meals: a warm, appetising golden-brown, only gently varied per item
    // so they all read as "cooked" (vs the cool silver of raw fish).
    case "cooked": return s.includes("burnt")
      ? shadeFrom("#332a22", "#171210") // charred black-brown
      : shadeFrom(tweak("#bd8746", id, 12, 10, 10));
    case "bowl": return shadeFrom(hashColor(id, 10, 40, 30, 22, 34, 16));
    case "bread": return shadeFrom(hashColor(id, 22, 26, 38, 20, 50, 16));
    case "hide": return shadeFrom(hashColor(id, 14, 34, 30, 22, 32, 18));
    case "cape": return shadeFrom(hashColor(id, 0, 360, 44, 22, 38, 16));
    case "mount": {
      // Icon coat = the SAME coat the rig wears in the world (natural tones).
      const coat = MOUNT_COATS[id];
      return coat ? shadeFrom(coat) : shadeFrom(hashColor(id, 16, 26, 14, 26, 24, 28));
    }
    case "pet": return shadeFrom(hashColor(id, 0, 360, 32, 26, 42, 20));
    case "ring":
    case "amulet": return shadeFrom(tweak("#d2b24a", id, 6, 8, 8), hslHex(hash(id) % 360, 62, 56));
    case "coin": return shadeFrom(hashColor(id, 36, 18, 48, 18, 44, 16));
    case "scroll": return shadeFrom(tweak("#d8c690", id, 12, 12, 8), hslHex(hash(id) % 360, 45, 45));
    case "key": return shadeFrom(tweak("#b89352", id, 18, 16, 12));
    case "trophy": return shadeFrom(hashColor(id, 28, 26, 12, 22, 62, 18));
    case "bone": return shadeFrom(tweak("#e9e1cd", id, 7, 6, 5), "#cfc6ac");   // aged ivory
    case "tooth": return shadeFrom(tweak("#efe9d6", id, 5, 5, 4), "#dcd4ba");  // whiter enamel
    case "tail": return shadeFrom(hashColor(id, 12, 30, 32, 20, 30, 16));      // fleshy/scaled
    case "sinew": return shadeFrom(tweak("#d8c9a6", id, 6, 8, 6), "#b8a274");  // pale dried cord
    case "powder": return shadeFrom(hashColor(id, 18, 44, 6, 16, 36, 16));
    case "sack": return shadeFrom(hashColor(id, 22, 28, 28, 20, 42, 16));
    case "board":
    case "shaft": return shadeFrom(tweak("#9a7d56", id, 14, 14, 12));
    case "arrow":
    case "arrowhead": return shadeFrom(hashColor(id, 190, 50, 12, 18, 48, 18));
    default: return shadeFrom(hashColor(id, 18, 50, 12, 22, 40, 18));
  }
}

// ── shape drawing (32×32 viewBox) ───────────────────────────────────────────
const WOOD = "#7a5a3a", WOODX = "#3a2a1a";

/**
 * Fish get a species-shaped silhouette (plus the hashed colour) so a Redrun
 * Greatpike doesn't read the same as a Saltgill: eels are long and wavy, pike
 * are long-jawed predators, flounder lie flat, carp/bass/stout are deep-bodied,
 * and darts/gills/fins are small and streamlined. Falls back to a hashed pick.
 */
function fishShape(p: Pal, id: string): string {
  const s = id.toLowerCase();
  const has = (...k: string[]) => k.some((w) => s.includes(w));
  const eye = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#1a1a1a"/>`;
  let kind: "eel" | "pike" | "flat" | "deep" | "slim" | "std";
  if (has("eel")) kind = "eel";
  else if (has("pike", "leviathan")) kind = "pike";
  else if (has("flounder", "flat")) kind = "flat";
  else if (has("carp", "bass", "perch", "bream", "stout", "shad", "trout")) kind = "deep";
  else if (has("dart", "gill", "fin", "silver", "copper", "frost")) kind = "slim";
  else kind = (["std", "deep", "slim"] as const)[hash(id) % 3]!;

  switch (kind) {
    case "eel": // a long wavy body, small head
      return `<path d="M3,16 Q9,8 15,16 Q21,24 28,15" fill="none" stroke="${p.base}" stroke-width="4.6" stroke-linecap="round"/>`
        + `<path d="M3,16 Q9,8 15,16 Q21,24 28,15" fill="none" stroke="${p.dark}" stroke-width="1.2" stroke-linecap="round" opacity="0.4"/>`
        + eye(26, 14.5);
    case "pike": // long torpedo with a pointed, jawed snout
      return `<path d="M2,16 Q12,10 25,13 L29,15 L29,17 L25,19 Q12,22 2,16 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<polygon points="2,16 -1,11 0,16 -1,21" fill="${p.dark}"/>`
        + `<line x1="24" y1="15.5" x2="29" y2="16" stroke="${p.dark}" stroke-width="0.7" opacity="0.7"/>`
        + eye(23, 14.5);
    case "flat": // a flounder lying flat, tail off to the side, two topside eyes
      return `<ellipse cx="15" cy="17" rx="11" ry="6.2" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/>`
        + `<polygon points="26,17 30,13 30,21" fill="${p.dark}"/>`
        + `<path d="M6,14 Q15,11 24,14" fill="none" stroke="${p.dark}" stroke-width="0.7" opacity="0.5"/>`
        + eye(12, 14) + eye(16, 13.5);
    case "deep": // a deep, round-bodied carp/bass
      return `<path d="M6,16 Q13,6 21,10 Q27,13 27,16 Q27,19 21,22 Q13,26 6,16 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<polygon points="6,16 1,10 2,16 1,22" fill="${p.dark}"/>`
        + `<path d="M15,9 Q17,16 15,23" fill="none" stroke="${p.dark}" stroke-width="0.7" opacity="0.6"/>`
        + eye(22, 14.5);
    case "slim": // a small, streamlined dart
      return `<path d="M6,16 Q13,11 22,13 Q26,14.5 26,16 Q26,17.5 22,19 Q13,21 6,16 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<polygon points="6,16 2,12 3,16 2,20" fill="${p.dark}"/>`
        + eye(21, 15.2);
    default: // the standard streamlined fish
      return `<path d="M5,16 Q12,8 22,12 Q26,14 26,16 Q26,18 22,20 Q12,24 5,16 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<polygon points="5,16 1,11 2,16 1,21" fill="${p.dark}"/>`
        + `<path d="M14,11 Q16,16 14,21" fill="none" stroke="${p.dark}" stroke-width="0.7" opacity="0.6"/>`
        + eye(21, 15);
  }
}

/**
 * Every pet gets a real portrait — a small SVG take on the same bespoke art
 * its world sprite uses (drawSkillPet / the mini-boss followers in render.ts),
 * so Old Bay looks like Old Bay in the bounty shop, the pack, and the
 * collection log alike. Falls back to a generic critter for anything new.
 */
function petShape(p: Pal, id: string): string {
  const eye = (x: number, y: number, r = 1.1, c = "#15100b"): string => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const el = (cx: number, cy: number, rx: number, ry: number, f: string, rot = 0): string =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ""}/>`;
  switch (id) {
    case "pet_bloodhound": // OLD BAY — long low hound, droopy ears, grey muzzle
      return el(17, 19, 10, 6, "#6e4f33")
        + el(8.5, 14, 4.8, 4.2, "#7c5a3a", -20)
        + el(6.6, 17.5, 2, 4, "#5a4028", -12)   // long ear
        + el(5.2, 13.5, 2.4, 1.9, "#8a6844", -20) // aged muzzle
        + `<rect x="11" y="23" width="2.6" height="4.5" rx="1" fill="#4a3521"/><rect x="20" y="23" width="2.6" height="4.5" rx="1" fill="#4a3521"/>`
        + el(27, 15.5, 2.6, 1.3, "#4a3521", 35)   // tail
        + eye(8.6, 12.6);
    case "pet_trail_wren": // TRAILWING WREN — round body, cocked tail
      return el(16, 18, 6.5, 5.5, "#8a6a42")
        + el(14, 19.5, 3.6, 3, "#a5845a")          // breast
        + el(18, 17, 3.8, 2.6, "#6d5233", 20)      // wing
        + `<rect x="21" y="10" width="6" height="2.2" rx="1" transform="rotate(-42 21 11)" fill="#57411f"/>` // cocked tail
        + `<circle cx="10.5" cy="13.5" r="3.2" fill="#8a6a42"/>`
        + `<polygon points="7.5,13.5 4.8,14.2 7.6,15" fill="#c9a256"/>` // beak
        + `<rect x="13.5" y="23" width="1.4" height="3.4" fill="#c58a3f"/><rect x="17" y="23" width="1.4" height="3.4" fill="#c58a3f"/>`
        + eye(10, 12.6, 0.9);
    case "pet_mining": // ROCKLING — a living pebble with a crystal spine
      return el(16, 19, 9.5, 7.5, "#6a6660")
        + el(14, 15.5, 6, 4.5, "#7d786f")
        + `<polygon points="17,8 20,14 13,14" fill="#8fd0e0"/><polygon points="22,11.5 24,16 19,16" fill="#8fd0e0"/>`
        + `<rect x="10" y="24.5" width="3" height="2.8" rx="1" fill="#4f4b46"/><rect x="19" y="24.5" width="3" height="2.8" rx="1" fill="#4f4b46"/>`
        + eye(11.5, 16.5) + eye(16.5, 16.5);
    case "pet_smithing": // CINDER — coal-dark imp seamed with fire
      return `<ellipse cx="16" cy="18" rx="8" ry="7.5" fill="#38302a" stroke="#5a4c40" stroke-width="1"/>`
        + `<path d="M9,18 Q13,15 16,18 Q19,21 23,18" fill="none" stroke="#e8823a" stroke-width="1.3" opacity="0.9"/>`
        + `<path d="M11,22 Q15,20 21,22.5" fill="none" stroke="#c85a28" stroke-width="1" opacity="0.8"/>`
        + `<polygon points="11,10 13.5,13.5 9.5,13.5" fill="#38302a" stroke="#5a4c40" stroke-width="0.7"/><polygon points="21,10 22.5,13.5 18.5,13.5" fill="#38302a" stroke="#5a4c40" stroke-width="0.7"/>`
        + eye(12.5, 15.5, 1.2, "#f2a848") + eye(19.5, 15.5, 1.2, "#f2a848");
    case "pet_forestry": // BARKBACK — a walking seedling
      return el(16, 20, 7, 6, "#6a4e30")
        + el(16, 14.5, 4.6, 3.6, "#7c5c3a")
        + `<path d="M16,11 Q16,7 16,5.5" stroke="#4d6a2e" stroke-width="1.6" fill="none"/>`
        + `<path d="M16,7 Q11.5,4.5 9.5,6.5 Q13,9 16,7 Z" fill="#5e8240"/><path d="M16,6.5 Q20.5,3.5 22.5,5.8 Q19,8.5 16,6.5 Z" fill="#6f9a4c"/>`
        + `<rect x="11.5" y="24.5" width="2.6" height="3" rx="1" fill="#4a3521"/><rect x="18" y="24.5" width="2.6" height="3" rx="1" fill="#4a3521"/>`
        + eye(13.8, 14) + eye(18.2, 14);
    case "pet_woodcraft": // SPLINTER — a carved wooden owl, ring-grained
      return el(16, 17, 8, 9, "#8a6a44")
        + `<circle cx="12.5" cy="13.5" r="3.4" fill="#a5845a"/><circle cx="19.5" cy="13.5" r="3.4" fill="#a5845a"/>`
        + `<circle cx="12.5" cy="13.5" r="1.9" fill="none" stroke="#6d5233" stroke-width="0.8"/><circle cx="19.5" cy="13.5" r="1.9" fill="none" stroke="#6d5233" stroke-width="0.8"/>`
        + `<path d="M11,22 Q16,25 21,22" fill="none" stroke="#6d5233" stroke-width="0.9"/><path d="M12,24.4 Q16,26.6 20,24.4" fill="none" stroke="#6d5233" stroke-width="0.9"/>`
        + `<polygon points="16,15.5 14.4,18 17.6,18" fill="#57411f"/>`
        + eye(12.5, 13.5, 1.2) + eye(19.5, 13.5, 1.2);
    case "pet_hunter": // QUICKSNARE — fox kit, white tail tip
      return el(16.5, 19, 8.5, 5.5, "#b0562c")
        + `<circle cx="9.5" cy="14" r="4" fill="#bd6234"/>`
        + `<polygon points="6.5,11 5.6,6 9.4,9.2" fill="#8a3f1e"/><polygon points="12,10.4 12.8,5.6 15,9.6" fill="#8a3f1e"/>`
        + el(6.8, 15.8, 2, 1.5, "#e8dcc8", -18)   // white muzzle
        + `<path d="M24,17 Q29,15 28.5,11" fill="none" stroke="#b0562c" stroke-width="3.4" stroke-linecap="round"/>`
        + `<circle cx="28.4" cy="11.4" r="1.9" fill="#e8dcc8"/>` // tail tip
        + eye(8.6, 13);
    case "pet_fishing": // BOBBER — sleek otter with a silver catch
      return el(17, 18.5, 9.5, 5.5, "#5e4630", -8)
        + `<circle cx="9" cy="13.5" r="3.6" fill="#6d5233"/>`
        + el(16, 20.5, 5.5, 3, "#8a7354")           // pale belly
        + `<path d="M25.5,20 Q29.5,21.5 29,25" fill="none" stroke="#5e4630" stroke-width="2.8" stroke-linecap="round"/>`
        + el(6, 15.8, 2.6, 1.1, "#b8c8d0", -25)     // the silver fish
        + `<polygon points="3.8,16.6 2.6,15.4 2.8,17.8" fill="#93a5b0"/>`
        + eye(8.2, 12.4);
    case "pet_cooking": // ASHLING — plump flour-dusted hen, chef-hatted
      return el(16, 19, 8, 6.5, "#e6ddcc")
        + `<circle cx="10" cy="13" r="3.4" fill="#efe8da"/>`
        + `<path d="M7.5,10.5 Q6.5,6.5 10,6.8 Q9.5,5 12.5,5.6 Q13.8,4.8 13.5,7 Q14.5,10 11,10.8 Z" fill="#f7f3ea" stroke="#c9c0ae" stroke-width="0.6"/>` // chef hat
        + `<polygon points="7,13.6 4.6,14.4 7.2,15.2" fill="#d8963c"/>`
        + el(19, 16.5, 4, 2.8, "#d9cfba", 15)        // wing
        + `<rect x="13" y="24.5" width="1.4" height="3" fill="#c58a3f"/><rect x="17" y="24.5" width="1.4" height="3" fill="#c58a3f"/>`
        + eye(9.4, 12.4, 0.9);
    case "pet_farming": // SEEDLING — harvest mouse with a wheat sprig
      return el(16, 19.5, 7, 5.5, "#9a7a52")
        + `<circle cx="10" cy="15" r="3.6" fill="#a5845a"/>`
        + `<circle cx="8.4" cy="11.4" r="1.9" fill="#8a6a42"/><circle cx="12.6" cy="11" r="1.9" fill="#8a6a42"/>` // round ears
        + `<path d="M23,19 Q28,17.5 28.5,13.5" fill="none" stroke="#8a6a42" stroke-width="1.4" stroke-linecap="round"/>` // tail
        + `<path d="M13,14 L18,8" stroke="#c9a24e" stroke-width="1.1"/>`
        + `<path d="M18,8 L16.6,6.4 M18,8 L19.8,6.6 M17.4,9.4 L15.8,8 M17.4,9.4 L19.4,8.4" stroke="#d9b45e" stroke-width="1"/>` // wheat head
        + eye(9.2, 14.4, 0.9);
    case "pet_survivalist": // DUSKWING — green-dappled wild hare
      return el(16, 19.5, 7.5, 5.5, "#7a7a52")
        + `<circle cx="10.5" cy="14" r="3.4" fill="#8a8a5e"/>`
        + `<rect x="8.4" y="5.5" width="2.2" height="7" rx="1" fill="#7a7a52" transform="rotate(-8 9.5 9)"/><rect x="12" y="5.2" width="2.2" height="7.4" rx="1" fill="#8a8a5e" transform="rotate(9 13 9)"/>`
        + `<circle cx="14" cy="18" r="1.2" fill="#5e6a3c" opacity="0.8"/><circle cx="19" cy="21" r="1" fill="#5e6a3c" opacity="0.8"/><circle cx="17.5" cy="17" r="0.8" fill="#5e6a3c" opacity="0.7"/>` // dapples
        + `<circle cx="23.5" cy="21" r="1.8" fill="#d8d2c0"/>`
        + eye(9.6, 13.2, 0.9);
    case "pet_herblore": // SPRIG — teal toad under a mushroom cap
      return el(16, 20, 8, 5.5, "#4e8a80")
        + `<circle cx="12" cy="15.5" r="1.7" fill="#5ea094"/><circle cx="20" cy="15.5" r="1.7" fill="#5ea094"/>`
        + `<path d="M7,12 Q7,6 16,6 Q25,6 25,12 Q16,15 7,12 Z" fill="#a5563a" stroke="#7a3c28" stroke-width="0.8"/>` // mushroom cap
        + `<circle cx="12" cy="9.5" r="1.1" fill="#e8dcc8" opacity="0.85"/><circle cx="19" cy="8.6" r="0.9" fill="#e8dcc8" opacity="0.8"/>`
        + `<path d="M10,24.5 Q12,26.5 14,24.8 M18,24.8 Q20,26.6 22,24.5" fill="none" stroke="#3c6e66" stroke-width="1.6"/>`
        + eye(12, 15.2, 0.9) + eye(20, 15.2, 0.9);
    case "pet_construction": // MORTAR — square-backed beetle hauling a brick
      return el(16, 20, 8.5, 5.5, "#4a4038")
        + `<rect x="10" y="9.5" width="12" height="7" rx="1.4" fill="#9a5a42" stroke="#6e3c2c" stroke-width="0.8"/>` // the brick
        + `<line x1="16" y1="10" x2="16" y2="16" stroke="#6e3c2c" stroke-width="0.7"/><line x1="10.5" y1="13" x2="21.5" y2="13" stroke="#6e3c2c" stroke-width="0.7"/>`
        + `<path d="M9,23.5 L6.5,26 M13,24.5 L11.5,27 M19,24.5 L20.5,27 M23,23.5 L25.5,26" stroke="#332c26" stroke-width="1.4"/>`
        + `<circle cx="7.8" cy="18" r="2.4" fill="#554a40"/>`
        + eye(7, 17.4, 0.8);
    case "pet_crafting": // THIMBLE — tortoise with a cut gem for a shell
      return el(16, 21, 9, 4.5, "#8a8462")
        + `<polygon points="16,7 23.5,13 21,19 11,19 8.5,13" fill="#7aa0c8" stroke="#4e6c8e" stroke-width="1"/>`
        + `<polygon points="16,7 23.5,13 16,13.5 8.5,13" fill="#a8c6e4"/>`
        + `<circle cx="26" cy="20.5" r="2.6" fill="#9a9470"/>`
        + `<rect x="10" y="24" width="2.6" height="2.6" rx="1" fill="#6e6a4e"/><rect x="19.5" y="24" width="2.6" height="2.6" rx="1" fill="#6e6a4e"/>`
        + eye(27, 19.8, 0.8);
    case "pet_bounty": // TRACKER — the Reckoner's ledger hawk
      return el(16, 17.5, 6.5, 7, "#5e564a")
        + el(18.5, 16, 4, 6, "#4a4238", 15)          // folded wing
        + `<circle cx="12" cy="10.5" r="3.4" fill="#6a6254"/>`
        + `<polygon points="9,10.5 6.4,11.6 9.2,12.6" fill="#c9a24e"/>` // hooked beak
        + `<path d="M12,24.5 L12,27 M16,24.5 L16,27" stroke="#c9a24e" stroke-width="1.4"/>`
        + `<polygon points="20,23 25,27 19,26" fill="#3c362e"/>`        // tail
        + eye(11.4, 9.8, 1, "#e8b84a");
    case "pet_superior": // THE RECKONING WISP — black flame, gold mask
      return `<path d="M16,4 Q21,10 19.5,15 Q23,14 21.5,20 Q20,26 16,26 Q12,26 10.5,20 Q9,14 12.5,15 Q11,10 16,4 Z" fill="#1c1822" stroke="#332c3e" stroke-width="0.8"/>`
        + `<path d="M16,7 Q19,11.5 17.8,15.5 Q19.5,15 18.6,19" fill="none" stroke="#3e3450" stroke-width="1" opacity="0.8"/>`
        + `<path d="M12,17 Q16,15 20,17 L19.4,20.4 Q16,19 12.6,20.4 Z" fill="#caa24a"/>`   // the gold mask
        + eye(14, 18.2, 0.8, "#0d0a12") + eye(18, 18.2, 0.8, "#0d0a12");
    case "pet_founder_wisp": // THE FIRST EMBER — a warm lantern-mote
      return `<circle cx="16" cy="16" r="9.5" fill="#e8823a" opacity="0.18"/>`
        + `<circle cx="16" cy="16" r="6" fill="#e8823a" opacity="0.4"/>`
        + `<path d="M16,8 Q20,13 18.5,17.5 Q21,17 19.5,21.5 Q18.4,24.6 16,24.6 Q13.6,24.6 12.5,21.5 Q11,17 13.5,17.5 Q12,13 16,8 Z" fill="#f2a848"/>`
        + `<path d="M16,12 Q18,15 17,18.5 Q16.4,21 16,21.4 Q14,19 14.6,16 Q15,13.5 16,12 Z" fill="#f8d890"/>`;
    case "pet_brann": // THE LITTLE QUARTERMASTER — tarnished plate, tiny ledger
      return el(16, 19, 6.5, 7, "#4a4436")
        + `<circle cx="12.5" cy="10.5" r="3.6" fill="#c9b28a"/>`
        + `<path d="M8.5,9.5 Q8.5,6 12.5,6 Q16.5,6 16.5,9.5 Z" fill="#6e6448"/>` // the sallet
        + `<rect x="17.5" y="14" width="6.5" height="8" rx="1" fill="#d9cba8" stroke="#8a7a58" stroke-width="0.8"/>` // the ledger
        + `<line x1="19" y1="16.5" x2="22.5" y2="16.5" stroke="#8a7a58" stroke-width="0.7"/><line x1="19" y1="18.5" x2="22.5" y2="18.5" stroke="#8a7a58" stroke-width="0.7"/>`
        + `<path d="M9,17 Q12.5,15.5 16,17 L15.4,21 Q12.5,19.8 9.6,21 Z" fill="#6e6448"/>` // the breastplate
        + `<rect x="10" y="24.5" width="2.4" height="3" rx="1" fill="#3a3630"/><rect x="14" y="24.5" width="2.4" height="3" rx="1" fill="#3a3630"/>`
        + eye(11.5, 10, 0.9);
    case "pet_boneman": // LITTLE MARROW — a skull pup
      return el(16, 20, 7.5, 5.5, "#d9d2c0")
        + `<path d="M9.5,12.5 Q9.5,7 15,7 Q20.5,7 20.5,12.5 Q20.5,15 18.8,16 L18.8,18 L11.2,18 L11.2,16 Q9.5,15 9.5,12.5 Z" fill="#efe8da" stroke="#b8b0a0" stroke-width="0.7"/>`
        + `<circle cx="12.8" cy="12.5" r="1.6" fill="#2b2724"/><circle cx="17.2" cy="12.5" r="1.6" fill="#2b2724"/>`
        + `<rect x="12.6" y="16" width="1.2" height="1.8" fill="#b8b0a0"/><rect x="15" y="16" width="1.2" height="1.8" fill="#b8b0a0"/><rect x="17.4" y="16" width="1.2" height="1.8" fill="#b8b0a0"/>`
        + `<rect x="11" y="24" width="2.6" height="3" rx="1" fill="#c4bcaa"/><rect x="18.5" y="24" width="2.6" height="3" rx="1" fill="#c4bcaa"/>`;
    case "pet_green_baron": // THE LITTLE HOOD — a hooded green mite
      return el(16, 21, 7, 5.5, "#3e5c34")
        + `<path d="M9,16 Q9,7.5 16,6 Q23,7.5 23,16 Q19.5,18.5 16,18.5 Q12.5,18.5 9,16 Z" fill="#4d6a3e" stroke="#2e4426" stroke-width="0.8"/>` // the hood
        + `<path d="M16,6 Q17.5,4 19.5,4.5 Q18,6.5 16.8,6.6 Z" fill="#2e4426"/>`
        + `<ellipse cx="16" cy="14.5" rx="4.2" ry="3.4" fill="#1e2a1a"/>`
        + eye(14.2, 14, 1, "#b8e07a") + eye(17.8, 14, 1, "#b8e07a");
    case "pet_hollow_prophet": // LITTLE HOLLOW — a dark cowl, one pale eye
      return `<path d="M16,5 Q23,8 22.5,17 Q22,24 16,26.5 Q10,24 9.5,17 Q9,8 16,5 Z" fill="#241f2e" stroke="#3a3348" stroke-width="0.8"/>`
        + `<ellipse cx="16" cy="15" rx="4.6" ry="5.4" fill="#141020"/>`
        + `<circle cx="16" cy="14.5" r="2.2" fill="#cdbfd8" opacity="0.95"/><circle cx="16" cy="14.5" r="1" fill="#141020"/>`
        + `<path d="M12,23.5 Q16,25.5 20,23.5" fill="none" stroke="#3a3348" stroke-width="0.9" opacity="0.8"/>`;
    case "pet_vorlag": // THE LITTLE HUNGER — a round dark maw
      return `<circle cx="16" cy="16" r="10" fill="#231c28" stroke="#3c2f42" stroke-width="1"/>`
        + `<circle cx="16" cy="16.5" r="5.8" fill="#0d0a12"/>`
        + `<polygon points="11.5,13.5 13,16.5 10.6,16" fill="#cdbfd8"/><polygon points="16,12 17.4,15.4 14.6,15.4 Z" fill="#cdbfd8"/><polygon points="20.5,13.5 21.4,16 19,16.5" fill="#cdbfd8"/>`
        + `<polygon points="12.5,20.5 14,18 15,20.8" fill="#b0a2be"/><polygon points="18.5,20.8 19.5,18 21,20.3" fill="#b0a2be"/>`
        + `<circle cx="10" cy="10" r="1.1" fill="#8a5fc0"/><circle cx="22" cy="10.5" r="1" fill="#8a5fc0"/>`;
    case "pet_hollow_warden": // BARROWKIN — a pale barrow-wight mite
      return el(16, 18, 7.5, 8, "#8e93a5")
        + el(16, 12.5, 5, 4.2, "#a0a5b5")
        + `<path d="M10,25 Q12,22.5 13.5,25.5 M15,25.8 Q16.5,23 18,25.8 M19.5,25.5 Q21,22.5 22.5,25" fill="none" stroke="#8e93a5" stroke-width="1.6"/>` // tattered hem
        + eye(13.8, 12, 1.1, "#3e6ac8") + eye(18.2, 12, 1.1, "#3e6ac8");
    case "pet_bog_warden": // MIREWISP — a green bog-light
      return `<circle cx="16" cy="16" r="9" fill="#5e8a58" opacity="0.2"/>`
        + `<path d="M16,6.5 Q20,12 18.5,16.5 Q21,16 19.8,20.5 Q18.6,24.5 16,24.5 Q13.4,24.5 12.2,20.5 Q11,16 13.5,16.5 Q12,12 16,6.5 Z" fill="#6fae72"/>`
        + `<path d="M16,10.5 Q18,14 17,17.5 Q16.4,20.5 16,21 Q14.6,18 15.2,15 Q15.6,12.5 16,10.5 Z" fill="#b8e0a8"/>`
        + eye(14.4, 16, 0.8, "#1e2a1a") + eye(17.6, 16, 0.8, "#1e2a1a");
    case "pet_spine_warlord": // CAIRN — a stacked-stone beastling
      return el(16, 22.5, 8.5, 4.5, "#5e5a64")
        + el(16, 16, 6.5, 4, "#6a6672")
        + el(16, 10.5, 4.5, 3.2, "#787384")
        + `<polygon points="16,5.5 17.6,8.4 14.4,8.4" fill="#aeb8c6"/>` // snow-capped top
        + `<line x1="10" y1="16.5" x2="13" y2="16" stroke="#4a4650" stroke-width="0.8"/><line x1="19" y1="22.5" x2="22.5" y2="22" stroke="#4a4650" stroke-width="0.8"/>`
        + eye(14.2, 10.2, 0.9, "#cfe0ea") + eye(17.8, 10.2, 0.9, "#cfe0ea");
    case "pet_marrow_keeper": // KEEPSAKE — a bone lantern, candle lit
      return `<rect x="11" y="10" width="10" height="13" rx="2" fill="#d9d2c0" stroke="#b8b0a0" stroke-width="1"/>`
        + `<rect x="13" y="12" width="6" height="9" rx="1" fill="#2b2520"/>`
        + `<rect x="15.2" y="16.5" width="1.6" height="4" fill="#efe8da"/>`
        + `<path d="M16,13.5 Q17.4,15.2 16,16.6 Q14.6,15.2 16,13.5 Z" fill="#f2a848"/>`
        + `<path d="M13,10 Q13,7 16,7 Q19,7 19,10" fill="none" stroke="#b8b0a0" stroke-width="1.4"/>`
        + `<rect x="12" y="23" width="8" height="2" rx="1" fill="#c4bcaa"/>`;
    case "pet_ashen_wyrm": // EMBERLING — a small ember serpent
      return `<path d="M5,21 Q9,24 13,21 Q17,18 15,14 Q13.5,11 16.5,9" fill="none" stroke="#5a3a30" stroke-width="4.6" stroke-linecap="round"/>`
        + `<path d="M5,21 Q9,24 13,21 Q17,18 15,14" fill="none" stroke="#c85a28" stroke-width="1.2" opacity="0.85"/>`
        + `<circle cx="18.5" cy="8" r="3.6" fill="#6a453a"/>`
        + `<polygon points="20,5.2 22.5,3.4 22,6.6" fill="#c85a28"/>`
        + `<polygon points="21.8,8.6 25,9.4 22,10.6" fill="#8a5040"/>`
        + eye(18, 7.2, 0.9, "#f2a848");
    default: // any new pet: the generic critter, until it earns its portrait
      return `<ellipse cx="16" cy="20" rx="8" ry="7" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><circle cx="16" cy="12" r="5.5" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><polygon points="11,8 12.5,13 14,10" fill="${p.dark}"/><polygon points="21,8 19.5,13 18,10" fill="${p.dark}"/><circle cx="14" cy="12" r="1" fill="#1a1a1a"/><circle cx="18" cy="12" r="1" fill="#1a1a1a"/><circle cx="16" cy="14" r="0.9" fill="${p.dark}"/>`;
  }
}

function draw(shape: Shape, p: Pal, id: string): string {
  const r = (hash(id) % 9) - 4; // gentle per-item rotation for lumpy shapes
  switch (shape) {
    case "ore": return `<g transform="rotate(${r} 16 16)"><polygon points="6,19 9,10 17,7 25,11 26,21 17,26 9,24" fill="${p.base}" stroke="${p.edge}" stroke-width="1.2" stroke-linejoin="round"/><polygon points="9,10 17,7 18,15 11,17" fill="${p.light}"/><polygon points="18,15 25,11 26,21 19,22" fill="${p.dark}"/><circle cx="13" cy="20" r="1" fill="${p.accent}"/></g>`;
    case "ingot": return `<polygon points="6,21 26,21 28,26 4,26" fill="${p.dark}" stroke="${p.edge}" stroke-width="1"/><polygon points="9,16 23,16 26,21 6,21" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><polygon points="10,17 22,17 23,19 9,19" fill="${p.light}" opacity="0.8"/>`;
    case "log": return `<rect x="5" y="11" width="20" height="11" rx="3" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><ellipse cx="24.5" cy="16.5" rx="3" ry="5.4" fill="${p.light}" stroke="${p.edge}" stroke-width="1"/><ellipse cx="24.5" cy="16.5" rx="1.5" ry="2.8" fill="${p.dark}"/><line x1="9" y1="12.5" x2="9" y2="20.5" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "board": return `<polygon points="7,9 25,12 25,23 7,20" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="8" y1="13" x2="24" y2="16" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/><line x1="8" y1="16.5" x2="24" y2="19.5" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "shaft": return `<rect x="14" y="5" width="4" height="22" rx="2" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><line x1="16" y1="6" x2="16" y2="26" stroke="${p.light}" stroke-width="0.8" opacity="0.6"/>`;
    case "pickaxe": return `<rect x="14.5" y="8" width="3" height="19" rx="1.5" fill="${WOOD}" stroke="${WOODX}" stroke-width="0.6"/><path d="M5,11 Q16,6 27,11 L25,14 Q16,10 7,14 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`;
    case "hatchet": return `<rect x="14.5" y="7" width="3" height="20" rx="1.5" fill="${WOOD}" stroke="${WOODX}" stroke-width="0.6"/><path d="M17,8 Q26,9 26,16 Q26,21 17,20 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><path d="M17.5,10 Q23,11 23,16" fill="none" stroke="${p.light}" stroke-width="0.8" opacity="0.6"/>`;
    case "rod":
      // Pole tinted to the rod's material, a wound reel at the butt, guides up the
      // shaft and a bright line to the hook — so each tier of rod reads apart (a
      // tier gem is added on the reel by the accent pass for the finest rods).
      return `<line x1="7" y1="27" x2="25" y2="5" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>`
        + `<line x1="7" y1="27" x2="25" y2="5" stroke="${p.base}" stroke-width="1.6" stroke-linecap="round"/>`
        + `<line x1="10" y1="23" x2="24" y2="7" stroke="${p.light}" stroke-width="0.5" opacity="0.7"/>`
        + `<circle cx="11" cy="23" r="2.6" fill="${p.dark}" stroke="${p.edge}" stroke-width="0.7"/>`
        + `<circle cx="11" cy="23" r="0.9" fill="${p.light}"/>`
        + `<line x1="25" y1="5" x2="21" y2="19" stroke="#d8e4ec" stroke-width="0.7"/>`
        + `<circle cx="21" cy="20.4" r="1.5" fill="none" stroke="#cfe0ea" stroke-width="1"/>`;
    case "sword": return `<polygon points="16,4 18,8 18,20 14,20 14,8" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="16" y1="6" x2="16" y2="19" stroke="${p.light}" stroke-width="0.8" opacity="0.7"/><rect x="10" y="20" width="12" height="2.6" rx="1" fill="#caa24a"/><rect x="15" y="22" width="2" height="5" fill="${WOOD}"/><circle cx="16" cy="27.4" r="1.6" fill="#caa24a"/>`;
    case "dagger": return `<polygon points="16,7 18,10 18,19 14,19 14,10" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="16" y1="9" x2="16" y2="18" stroke="${p.light}" stroke-width="0.7" opacity="0.7"/><rect x="11" y="19" width="10" height="2.2" rx="1" fill="#caa24a"/><rect x="15" y="21" width="2" height="5" fill="${WOOD}"/>`;
    case "claymore": return `<polygon points="16,3 19,8 19,21 13,21 13,8" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="16" y1="5" x2="16" y2="20" stroke="${p.light}" stroke-width="1" opacity="0.6"/><rect x="8" y="21" width="16" height="2.8" rx="1" fill="#caa24a"/><rect x="15" y="23" width="2" height="6" fill="${WOOD}"/><circle cx="16" cy="29" r="1.7" fill="#caa24a"/>`;
    case "spear": return `<rect x="15" y="6" width="2" height="22" fill="${WOOD}"/><path d="M16,2 L20,9 Q16,12 12,9 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`;
    case "staff": return `<rect x="15" y="9" width="2" height="19" rx="1" fill="${WOOD}"/><rect x="13.4" y="9.5" width="5.2" height="2.2" rx="1" fill="#caa24a"/><circle cx="16" cy="6.5" r="5.4" fill="none" stroke="${p.light}" stroke-width="0.7" opacity="0.4"/><circle cx="16" cy="6.5" r="4" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><circle cx="14.6" cy="5.2" r="1.4" fill="${p.light}" opacity="0.85"/>`;
    case "hammer": return `<rect x="14.8" y="10" width="2.6" height="17" rx="1" fill="${WOOD}"/><rect x="9" y="6" width="14" height="8" rx="1.5" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><rect x="10" y="7" width="12" height="2" fill="${p.light}" opacity="0.6"/>`;
    case "saw": {
      // a long pale blade with saw-teeth down one edge and a wrapped grip
      const teeth = Array.from({ length: 8 }, (_, i) => {
        const ty = 7 + i * 1.75;
        return `<polygon points="18,${ty} 21.5,${ty + 0.8} 18,${ty + 1.75}" fill="${p.dark}"/>`;
      }).join("");
      return `<rect x="12.5" y="21" width="7" height="6.5" rx="1.6" fill="${WOOD}" stroke="${WOODX}" stroke-width="0.8"/>`
        + `<rect x="13.4" y="22.4" width="5.2" height="0.8" fill="${WOODX}" opacity="0.7"/>`
        + `<rect x="13.4" y="24.4" width="5.2" height="0.8" fill="${WOODX}" opacity="0.7"/>`
        + `<polygon points="12.8,6 18,6 18,21 12.8,21" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<line x1="14.2" y1="7" x2="14.2" y2="20" stroke="${p.light}" stroke-width="0.9" opacity="0.7"/>`
        + teeth;
    }
    case "bow": return `<path d="M11,5 Q24,16 11,27" fill="none" stroke="${p.base}" stroke-width="2.4" stroke-linecap="round"/><line x1="11" y1="5" x2="11" y2="27" stroke="#d8cdb0" stroke-width="0.8"/>`;
    case "bowU": return `<path d="M12,5 Q23,16 12,27" fill="none" stroke="${p.base}" stroke-width="2.6" stroke-linecap="round"/>`;
    case "arrow": return `<line x1="7" y1="25" x2="24" y2="8" stroke="${WOOD}" stroke-width="1.6"/><polygon points="25,7 20,8 23,12" fill="${p.base}" stroke="${p.edge}" stroke-width="0.6"/><polygon points="7,25 11,22 11,27 7,28" fill="#b5564a"/>`;
    case "arrowhead": return `<polygon points="16,5 22,20 16,16 10,20" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><line x1="16" y1="16" x2="16" y2="27" stroke="${WOOD}" stroke-width="1.4"/>`;
    case "shield": return `<path d="M16,5 L26,8 Q26,20 16,28 Q6,20 6,8 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1.2" stroke-linejoin="round"/><line x1="16" y1="6" x2="16" y2="27" stroke="${p.dark}" stroke-width="1"/><line x1="7" y1="11" x2="25" y2="11" stroke="${p.dark}" stroke-width="1" opacity="0.6"/><circle cx="16" cy="13" r="2" fill="${p.accent}"/>`;
    case "helm": return `<path d="M8,14 Q8,7 16,7 Q24,7 24,14 L24,22 Q24,25 16,25 Q8,25 8,22 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1.2" stroke-linejoin="round"/><rect x="15" y="12" width="2" height="10" fill="${p.dark}"/><rect x="11" y="15" width="10" height="2" fill="${p.dark}"/><path d="M9,12 Q16,9 23,12" fill="none" stroke="${p.light}" stroke-width="0.8" opacity="0.6"/>`;
    case "body": return `<path d="M9,8 L13,7 Q16,9 19,7 L23,8 L24,13 L21,15 L21,24 Q16,26 11,24 L11,15 L8,13 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1.1" stroke-linejoin="round"/><line x1="16" y1="9" x2="16" y2="24" stroke="${p.dark}" stroke-width="0.8" opacity="0.6"/><path d="M11,16 Q16,18 21,16" fill="none" stroke="${p.light}" stroke-width="0.8" opacity="0.5"/>`;
    case "legs": return `<path d="M9,7 L15,7 L14,26 L10,26 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><path d="M17,7 L23,7 L22,26 L18,26 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><rect x="9" y="7" width="14" height="3" rx="1" fill="${p.dark}"/>`;
    case "boot": return `<path d="M11,6 L16,6 L16,20 L24,20 L24,26 L11,26 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><rect x="11" y="24" width="13" height="2.6" fill="${p.dark}"/>`;
    case "cape": return `<path d="M11,7 Q16,5 21,7 L24,26 Q16,23 8,26 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1.1" stroke-linejoin="round"/><path d="M13,8 Q16,7 19,8 L20,11 Q16,10 12,11 Z" fill="${p.dark}"/><line x1="16" y1="8" x2="16" y2="24" stroke="${p.light}" stroke-width="0.7" opacity="0.5"/>`;
    case "ring": return `<circle cx="16" cy="19" r="7" fill="none" stroke="${p.base}" stroke-width="3"/><circle cx="16" cy="19" r="7" fill="none" stroke="${p.light}" stroke-width="0.8"/><polygon points="16,5 20,10 16,14 12,10" fill="${p.accent}" stroke="${p.edge}" stroke-width="0.6"/>`;
    case "amulet": return `<path d="M9,7 Q16,18 23,7" fill="none" stroke="#caa24a" stroke-width="1.4"/><polygon points="16,13 21,18 16,26 11,18" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><circle cx="16" cy="18.5" r="2" fill="${p.accent}"/>`;
    // Sinew: a coiled hank of cord (bowstring stock), bound at the middle.
    case "sinew": return `<g stroke-linecap="round"><path d="M13,5 Q6,16 13,27" fill="none" stroke="${p.base}" stroke-width="3"/><path d="M19,5 Q26,16 19,27" fill="none" stroke="${p.base}" stroke-width="3"/><path d="M12.5,5 Q16,3 19.5,5" fill="none" stroke="${p.base}" stroke-width="3"/><path d="M12.5,27 Q16,29 19.5,27" fill="none" stroke="${p.base}" stroke-width="3"/><path d="M13,7 Q8,16 13,25" fill="none" stroke="${p.light}" stroke-width="0.7" opacity="0.6"/><path d="M19,7 Q24,16 19,25" fill="none" stroke="${p.light}" stroke-width="0.7" opacity="0.6"/></g><rect x="10.5" y="13" width="11" height="6" rx="2.5" fill="${p.dark}" stroke="${p.edge}" stroke-width="0.9"/><path d="M12,14.7 H20 M12,16 H20 M12,17.3 H20" stroke="${p.light}" stroke-width="0.5" opacity="0.5"/>`;
    case "gem": return `<polygon points="16,5 25,13 16,28 7,13" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><polygon points="16,5 25,13 16,16 7,13" fill="${p.light}"/><polygon points="7,13 16,16 16,28" fill="${p.dark}"/><line x1="11" y1="13" x2="16" y2="28" stroke="${p.edge}" stroke-width="0.5" opacity="0.5"/>`;
    case "bead": return `<circle cx="16" cy="17" r="8" fill="${p.base}" opacity="0.7" stroke="${p.edge}" stroke-width="1"/><ellipse cx="13" cy="14" rx="2.4" ry="3.4" fill="#ffffff" opacity="0.4"/>`;
    case "vial": return `<path d="M13,9 L19,9 L23,20 Q23,28 16,28 Q9,28 9,20 Z" fill="#cfe0e6" opacity="0.32" stroke="#9fb4bc" stroke-width="1"/><path d="M11,18 Q16,16 21,18 L22,21 Q16,29 10,21 Z" fill="${p.base}"/><ellipse cx="13" cy="22" rx="1.4" ry="2" fill="${p.light}" opacity="0.6"/><rect x="13" y="4" width="6" height="6" rx="1" fill="#cfe0e6" opacity="0.45" stroke="${p.edge}" stroke-width="0.5"/><rect x="12.5" y="3" width="7" height="2.6" rx="1" fill="${WOOD}"/>`;
    case "herb": return `<path d="M16,28 Q15,18 16,8" fill="none" stroke="#5a6a2a" stroke-width="1.6"/><path d="M16,20 Q9,18 8,12 Q15,13 16,18 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="0.6"/><path d="M16,16 Q23,14 24,8 Q17,9 16,14 Z" fill="${p.light}" stroke="${p.edge}" stroke-width="0.6"/><path d="M16,11 Q12,8 13,4 Q17,6 16,10 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="0.6"/>`;
    case "seed": return `<ellipse cx="13" cy="18" rx="3" ry="5" transform="rotate(-20 13 18)" fill="${p.base}" stroke="${p.edge}" stroke-width="0.8"/><ellipse cx="19" cy="15" rx="2.6" ry="4.4" transform="rotate(25 19 15)" fill="${p.light}" stroke="${p.edge}" stroke-width="0.8"/><ellipse cx="17" cy="22" rx="2.4" ry="4" transform="rotate(10 17 22)" fill="${p.dark}" stroke="${p.edge}" stroke-width="0.8"/>`;
    case "mushroom": return `<rect x="14" y="16" width="4" height="10" rx="1.5" fill="#e6dcc4" stroke="${p.edge}" stroke-width="0.8"/><path d="M7,16 Q7,8 16,8 Q25,8 25,16 Q16,19 7,16 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="13" r="1.3" fill="#ffffff" opacity="0.7"/><circle cx="19" cy="12" r="1" fill="#ffffff" opacity="0.6"/>`;
    case "fish": return fishShape(p, id);
    case "meat": return `<line x1="9" y1="22" x2="14" y2="17" stroke="#efe6d4" stroke-width="3.2" stroke-linecap="round"/><circle cx="8.5" cy="22.5" r="2.2" fill="#efe6d4"/><circle cx="11" cy="20" r="2.2" fill="#efe6d4"/><ellipse cx="18" cy="13" rx="8" ry="7.5" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><ellipse cx="15" cy="10" rx="2.5" ry="2" fill="${p.light}" opacity="0.55"/>`;
    case "cooked": // a plated, grill-marked, steaming portion — unmistakably cooked
      return `<ellipse cx="16" cy="22.5" rx="11" ry="3.8" fill="#c9c3b4" stroke="#8f897a" stroke-width="0.8"/>`
        + `<ellipse cx="16" cy="22" rx="8.5" ry="2.6" fill="#9c937f"/>`
        + `<path d="M8,19 Q10,12.5 16,12.5 Q22,12.5 24,19 Q20,22 16,22 Q12,22 8,19 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<path d="M11,17 Q16,15 21,17" stroke="${p.dark}" stroke-width="0.9" fill="none" opacity="0.7"/>`
        + `<path d="M12.5,19.2 Q16,17.4 19.5,19.2" stroke="${p.dark}" stroke-width="0.9" fill="none" opacity="0.6"/>`
        + `<ellipse cx="13.5" cy="15" rx="1.8" ry="1" fill="${p.light}" opacity="0.6"/>`
        + `<path d="M13,11.5 Q11,8.5 13,5.5 Q14.6,3.5 13,1.5" stroke="#e8e8e8" stroke-width="1" fill="none" opacity="0.5" stroke-linecap="round"/>`
        + `<path d="M19,11.5 Q21,8.5 19,5.5 Q17.4,3.5 19,1.5" stroke="#e8e8e8" stroke-width="1" fill="none" opacity="0.42" stroke-linecap="round"/>`;
    case "bowl": return `<path d="M5,15 Q16,13 27,15 Q25,25 16,25 Q7,25 5,15 Z" fill="#7a5236" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><ellipse cx="16" cy="15" rx="11" ry="3" fill="${p.base}"/><circle cx="12" cy="15" r="1.2" fill="${p.light}"/><circle cx="19" cy="14.5" r="1" fill="${p.dark}"/>`;
    case "bread": return `<path d="M6,18 Q6,11 16,11 Q26,11 26,18 Q26,23 16,23 Q6,23 6,18 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><line x1="11" y1="13" x2="9" y2="21" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/><line x1="16" y1="12.5" x2="16" y2="22" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/><line x1="21" y1="13" x2="23" y2="21" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "hide": return `<path d="M16,5 Q21,7 20,12 Q26,14 24,19 Q26,24 20,24 Q18,28 16,24 Q14,28 12,24 Q6,24 8,19 Q6,14 12,12 Q11,7 16,5 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><ellipse cx="16" cy="16" rx="4" ry="6" fill="${p.light}" opacity="0.4"/>`;
    case "pet": return petShape(p, id);
    case "mount": {
      // Tack & cosmetics: their own glyphs, not a steed's head.
      if (id === "mount_blanket") {
        return `<rect x="7" y="10" width="18" height="14" rx="2" fill="#7d3a34" stroke="${p.edge}" stroke-width="1"/>`
          + `<rect x="10" y="10" width="3" height="14" fill="#c8b78e"/><rect x="16" y="10" width="3" height="14" fill="#c8b78e"/><rect x="22" y="10" width="2" height="14" fill="#c8b78e"/>`
          + `<path d="M7,24 L9,27 M13,24 L15,27 M19,24 L21,27 M23,24 L25,27" stroke="#8a5a4a" stroke-width="1.2"/>`;
      }
      if (id === "mount_plume") {
        return `<path d="M16,27 Q13,18 15,8" fill="none" stroke="#6e5436" stroke-width="1.6"/>`
          + `<path d="M15,8 Q10,12 13,20 Q16,14 15,8 Q20,11 17,20 Q14,15 15,8" fill="#c8463c" stroke="#a52f28" stroke-width="1"/>`
          + `<ellipse cx="15" cy="9" rx="3.4" ry="5" fill="#c8463c" opacity="0.85"/>`;
      }
      if (id === "saddle_gold" || id === "saddle_silver") {
        const m = id === "saddle_gold" ? ["#c9992e", "#f2d060"] : ["#9aa3ad", "#d5dde6"];
        return `<path d="M8,14 Q16,8 24,14 L23,20 Q16,16 9,20 Z" fill="${m[0]}" stroke="${p.edge}" stroke-width="1"/>`
          + `<path d="M8,14 Q16,8 24,14 L23.6,16 Q16,10.5 8.4,16 Z" fill="${m[1]}"/>`
          + `<rect x="14.6" y="17" width="2.8" height="9" rx="1" fill="#5a3c22"/><rect x="14" y="25" width="4" height="2.4" rx="1" fill="${m[0]}"/>`;
      }
      const fam = mountFamily(id);
      // Shared neck + head-profile base (facing left).
      const head = `<path d="M22,28 L22,17 Q22,11 17,9 L11,11 Q8,12 8,15 L10,16 Q12,17 13,19 L14,28 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<circle cx="13.5" cy="13.6" r="1.1" fill="#171310"/>`;
      if (fam === "wolf") {
        return `<path d="M22,28 L22,16 Q22,10 16,9 L9,13 L12,14.5 Q14,15.5 14.5,18 L15,28 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
          + `<polygon points="17,9.5 15.5,4 19.5,7.5" fill="${p.dark}"/><polygon points="21,9.5 21.5,4.5 23.5,8.5" fill="${p.dark}"/>`
          + `<circle cx="14.5" cy="13.2" r="1.1" fill="#171310"/><polygon points="9,13 7,13.6 9.6,14.6" fill="${p.dark}"/>`;
      }
      if (fam === "boar") {
        return `<path d="M23,28 L23,16 Q23,10 16,10 L9,14 Q8,16 10,17.5 L13,18.5 Q14.5,19.5 15,22 L15,28 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
          + `<circle cx="19" cy="9.4" r="2" fill="${p.dark}"/>`
          + `<path d="M10,16.5 Q7.5,15.5 8,12.5" fill="none" stroke="#e8e2d0" stroke-width="1.6" stroke-linecap="round"/>`
          + `<circle cx="14.5" cy="14" r="1.1" fill="#171310"/><rect x="8.4" y="14.2" width="2.6" height="2" rx="0.8" fill="${p.dark}"/>`;
      }
      if (fam === "heavy") {
        return head
          + `<path d="M18,9.6 Q15,6 11.5,7.2" fill="none" stroke="#d8d2c2" stroke-width="1.8" stroke-linecap="round"/>`
          + `<path d="M21.5,9.6 Q23.5,6.4 26,7.6" fill="none" stroke="#d8d2c2" stroke-width="1.8" stroke-linecap="round"/>`
          + `<ellipse cx="9.6" cy="14.8" rx="1.8" ry="1.3" fill="${p.dark}"/>`;
      }
      // horse: pricked ears + flowing mane down the neck
      return head
        + `<polygon points="17.5,9.5 16.5,4.5 19.5,8.5" fill="${p.dark}"/><polygon points="20.5,9 21.5,4.5 23,8.8" fill="${p.dark}"/>`
        + `<path d="M21,9.5 Q23.5,14 22.5,20 L22,26" fill="none" stroke="${p.dark}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    case "coin": return `<circle cx="16" cy="16" r="10" fill="${p.base}" stroke="${p.edge}" stroke-width="1.2"/><circle cx="16" cy="16" r="7.5" fill="none" stroke="${p.dark}" stroke-width="0.8"/><polygon points="16,10 18,15 23,15 19,18 21,23 16,20 11,23 13,18 9,15 14,15" fill="${p.light}" opacity="0.85"/>`;
    case "scroll": return `<rect x="9" y="7" width="14" height="18" rx="1" fill="#e3d4a8" stroke="#9a7a4a" stroke-width="1"/><rect x="7" y="6" width="18" height="3" rx="1.5" fill="${p.accent}"/><rect x="7" y="23" width="18" height="3" rx="1.5" fill="${p.accent}"/><line x1="12" y1="12" x2="20" y2="12" stroke="#9a7a4a" stroke-width="0.8"/><line x1="12" y1="15" x2="20" y2="15" stroke="#9a7a4a" stroke-width="0.8"/><line x1="12" y1="18" x2="18" y2="18" stroke="#9a7a4a" stroke-width="0.8"/>`;
    case "key": return `<circle cx="11" cy="12" r="5" fill="none" stroke="${p.base}" stroke-width="2.4"/><circle cx="11" cy="12" r="1.6" fill="${p.dark}"/><line x1="14" y1="15" x2="23" y2="24" stroke="${p.base}" stroke-width="2.4"/><line x1="20" y1="21" x2="23" y2="18" stroke="${p.base}" stroke-width="2.4"/>`;
    case "trophy": return `<path d="M12,6 Q20,7 21,14 Q21,24 16,27 Q11,24 11,14 Q11,9 12,6 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><path d="M14,9 Q15,16 16,24" fill="none" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "bone": {
      // A proper femur: a shaft with a double-lobed knob at each end, drawn on
      // the diagonal. Big/dragon/marrow bones read chunkier so they're distinct
      // from plain bones at a glance.
      const big = id.includes("big") || id.includes("dragon") || id.includes("marrow");
      const w = big ? 5 : 3.6, r = big ? 3.4 : 2.7;
      return `<line x1="10" y1="22" x2="22" y2="10" stroke="${p.edge}" stroke-width="${w + 2}" stroke-linecap="round"/>`
        + `<circle cx="8.6" cy="20.6" r="${r}" fill="${p.base}" stroke="${p.edge}"/><circle cx="11.4" cy="23.4" r="${r}" fill="${p.base}" stroke="${p.edge}"/>`
        + `<circle cx="20.6" cy="8.6" r="${r}" fill="${p.base}" stroke="${p.edge}"/><circle cx="23.4" cy="11.4" r="${r}" fill="${p.base}" stroke="${p.edge}"/>`
        + `<line x1="10" y1="22" x2="22" y2="10" stroke="${p.base}" stroke-width="${w}" stroke-linecap="round"/>`
        + `<line x1="11.6" y1="20" x2="20" y2="11.6" stroke="${p.light}" stroke-width="1" opacity="0.55" stroke-linecap="round"/>`;
    }
    case "tooth": // a fang: wide rounded crown tapering to a sharp root
      return `<path d="M11,8 Q16,5 21,8 Q20.5,18 16.5,27 Q16,28 15.5,27 Q11.5,18 11,8 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<path d="M13.6,9 Q13.1,14 14.6,19" fill="none" stroke="${p.light}" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>`
        + `<path d="M18,9 Q19,15 17,22" fill="none" stroke="${p.dark}" stroke-width="0.8" opacity="0.4"/>`;
    case "tail": // a tapering, curving tail — thick at the base, whip-thin at the tip
      return `<path d="M7,26 Q9,20 13.5,17.5 Q19,14.5 22.5,8 Q24,8.8 22.5,10.8 Q19,16 14.5,19 Q10.5,21.5 9.5,26.5 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<path d="M11.5,20.5 Q12.2,21.4 12.9,20.7 M15,17.7 Q15.6,18.7 16.3,18 M18.6,13.6 Q19.2,14.6 19.9,13.8" fill="none" stroke="${p.dark}" stroke-width="0.7" opacity="0.45"/>`;
    case "powder": return `<path d="M6,24 Q16,13 26,24 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="22" r="1" fill="${p.dark}"/><circle cx="16" cy="20" r="1" fill="${p.light}"/><circle cx="20" cy="22.5" r="1" fill="${p.dark}"/>`;
    case "rivet": return `<circle cx="16" cy="10" r="5" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><polygon points="13,13 19,13 17,26 15,26" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><ellipse cx="14" cy="9" rx="1.6" ry="1" fill="${p.light}" opacity="0.6"/>`;
    case "sack": return `<path d="M9,12 Q9,9 16,9 Q23,9 23,12 L24,24 Q24,27 16,27 Q8,27 8,24 Z" fill="${p.base}" stroke="${p.edge}" stroke-width="1"/><path d="M11,11 Q16,7 21,11" fill="none" stroke="${p.dark}" stroke-width="1.4"/><line x1="16" y1="16" x2="16" y2="23" stroke="${p.dark}" stroke-width="0.8" opacity="0.5"/>`;
    case "rune": return `<polygon points="16,4 19,13 28,16 19,19 16,28 13,19 4,16 13,13" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/><circle cx="16" cy="16" r="2.5" fill="${p.light}"/>`;
    case "hook": // the flensing hook: an eye-ringed shank curling into a barbed J
      return `<circle cx="16" cy="6.5" r="2.6" fill="none" stroke="#caa24a" stroke-width="1.6"/>`
        + `<path d="M16,9 L16,18 Q16,25 10.5,24 Q7,23.3 7.5,19.5" fill="none" stroke="${p.base}" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M16,9 L16,18 Q16,25 10.5,24" fill="none" stroke="${p.light}" stroke-width="0.9" opacity="0.7" stroke-linecap="round"/>`
        + `<polygon points="7.5,19.5 5,17.5 9.5,17.8" fill="${p.base}" stroke="${p.edge}" stroke-width="0.7"/>`
        + `<polygon points="14.5,14 11.5,13 14.5,11.5" fill="${p.dark}"/>`;
    case "spike": // the maw-spike: a squat forged wedge with a hammer-flat head
      return `<polygon points="12,7 20,7 17.5,25 16,28 14.5,25" fill="${p.base}" stroke="${p.edge}" stroke-width="1" stroke-linejoin="round"/>`
        + `<rect x="10.5" y="4.5" width="11" height="3.4" rx="1" fill="${p.dark}" stroke="${p.edge}" stroke-width="0.8"/>`
        + `<line x1="15.4" y1="8" x2="15" y2="24" stroke="${p.light}" stroke-width="0.9" opacity="0.7"/>`
        + `<rect x="12.6" y="12" width="6.8" height="1.8" fill="#caa24a"/>`;
    case "horn": // the hunter's horn: a curved signal horn, banded, mouthpiece up
      return `<path d="M10,6 Q9,18 16,23 Q22,27 27,24" fill="none" stroke="#7a5a3a" stroke-width="6.5" stroke-linecap="round"/>`
        + `<path d="M10,6 Q9,18 16,23 Q22,27 27,24" fill="none" stroke="#94714b" stroke-width="4" stroke-linecap="round"/>`
        + `<path d="M10.5,8 Q10,17 15.5,21.5" fill="none" stroke="#b08c5e" stroke-width="1.1" opacity="0.8"/>`
        + `<circle cx="10" cy="5.8" r="2.2" fill="#caa24a" stroke="#8a6a2a" stroke-width="0.8"/>`
        + `<path d="M25,25.8 Q27.5,26.6 29,24.4" fill="none" stroke="#caa24a" stroke-width="2.4" stroke-linecap="round"/>`
        + `<rect x="12.4" y="12.6" width="5" height="2.4" rx="1" transform="rotate(24 15 14)" fill="#caa24a" opacity="0.9"/>`;
    case "satchel": // the hunter's kit: a buckled field satchel with a strap
      return `<path d="M6,14 Q6,11 9,11 L23,11 Q26,11 26,14 L26,23 Q26,26 23,26 L9,26 Q6,26 6,23 Z" fill="#7a5a3a" stroke="#3a2a1a" stroke-width="1"/>`
        + `<path d="M6,14 Q6,9 11,9 L21,9 Q26,9 26,14 L26,17 L6,17 Z" fill="#94714b" stroke="#3a2a1a" stroke-width="1"/>`
        + `<path d="M9,9.5 Q10,4 16,4 Q22,4 23,9.5" fill="none" stroke="#5a4028" stroke-width="2.2"/>`
        + `<rect x="14" y="15" width="4" height="5" rx="1" fill="#caa24a" stroke="#8a6a2a" stroke-width="0.8"/>`
        + `<line x1="16" y1="16.2" x2="16" y2="19" stroke="#8a6a2a" stroke-width="1"/>`
        + `<line x1="8" y1="21.5" x2="24" y2="21.5" stroke="#5a4028" stroke-width="0.9" opacity="0.7"/>`;
  }
}

// ── tier accents ─────────────────────────────────────────────────────────────
// Colour by name already separates the metals; on TOP of that, higher tiers get
// a visible flourish — a hilt/centre jewel that appears mid-ladder and a bright
// edge sheen near the top — so a tier-1 piece reads as plain and a tier-10 one
// as ornate at a glance, not just a different shade of the same silhouette.
const TIER_SHAPES = new Set<Shape>([
  "sword", "dagger", "claymore", "spear", "hammer", "saw",
  "helm", "body", "legs", "boot", "shield", "rod",
]);
function itemTier(def: ItemDef): number {
  if (typeof def.tier === "number") return def.tier;
  const m = /_(\d+)$/.exec(def.id);
  return m ? Number(m[1]) : 0;
}
/** A jewel colour for a tier band (none below 4). */
function tierGem(tier: number): string | null {
  if (tier >= 10) return "#ffd06a";       // fiery gold — best in slot
  if (tier >= 8) return "#b98cff";         // violet
  if (tier >= 6) return "#ff7a6a";         // crimson
  if (tier >= 4) return "#7fe0e0";         // cyan
  return null;
}
/** Overlay flourishes for higher-tier weapons/armour (gem + edge sheen). */
function tierAccent(shape: Shape, tier: number): string {
  const gem = tierGem(tier);
  if (!gem) return "";
  // Where the jewel sits, by shape family.
  const weapon = shape === "sword" || shape === "dagger" || shape === "claymore" || shape === "spear" || shape === "hammer" || shape === "saw";
  const cxcy: [number, number] = shape === "helm" ? [16, 11]
    : shape === "shield" ? [16, 17]
    : shape === "body" ? [16, 14]
    : shape === "legs" ? [16, 11]
    : shape === "boot" ? [18, 22]
    : shape === "rod" ? [11, 23]   // set into the reel
    : weapon ? [16, 21]   // on the hilt / guard
    : [16, 16];
  const gx = cxcy[0], gy = cxcy[1];
  const rad = tier >= 9 ? 2.5 : tier >= 7 ? 2.1 : 1.7;
  let out = `<circle cx="${gx}" cy="${gy}" r="${rad}" fill="${gem}" stroke="#1a140f" stroke-width="0.5"/>`;
  out += `<circle cx="${gx - rad * 0.35}" cy="${gy - rad * 0.35}" r="${rad * 0.35}" fill="#ffffff" opacity="0.7"/>`;
  // A faint outer glow for the very top tiers.
  if (tier >= 8) out += `<circle cx="${gx}" cy="${gy}" r="${rad + 1.6}" fill="${gem}" opacity="0.18"/>`;
  return out;
}

// ── public API ──────────────────────────────────────────────────────────────
const cache = new Map<string, string>();

/** Inline SVG markup for an item's icon (cached, deterministic). */
/** A standalone fish badge for a species NAME (the pier records board has no
 *  item id, only the species text) — same species silhouettes as the pack icon. */
export function fishBadgeSVG(species: string): string {
  const pal = shadeFrom(hashColor(species, 182, 56, 16, 26, 44, 18));
  return `<svg viewBox="0 0 32 32" class="item-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${fishShape(pal, species)}</svg>`;
}

export function itemIconSVG(def: ItemDef): string {
  const hit = cache.get(def.id);
  if (hit) return hit;
  // The Golden Rod of Varath: a unique solid-gold rod with a faint sheen + glint,
  // so the pier champion's trophy reads at a glance.
  if (def.id === "rod_gold") {
    const svg =
      `<svg viewBox="0 0 32 32" class="item-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
      `<line x1="8" y1="26" x2="24" y2="6" stroke="#8a6a1e" stroke-width="3" stroke-linecap="round"/>` +
      `<line x1="8" y1="26" x2="24" y2="6" stroke="#f3cf52" stroke-width="1.8" stroke-linecap="round"/>` +
      `<line x1="11" y1="22" x2="22" y2="8.5" stroke="#fff1b0" stroke-width="0.7" opacity="0.85"/>` +
      `<line x1="24" y1="6" x2="19" y2="21" stroke="#e6c34a" stroke-width="0.8"/>` +
      `<circle cx="19" cy="22.4" r="1.7" fill="none" stroke="#f3cf52" stroke-width="1.1"/>` +
      `<path d="M24,4.5 l0.7,1.6 1.6,0.7 -1.6,0.7 -0.7,1.6 -0.7,-1.6 -1.6,-0.7 1.6,-0.7 Z" fill="#fff4c2"/>` +
      `</svg>`;
    cache.set(def.id, svg);
    return svg;
  }
  const shape = classify(def);
  const pal = paletteFor(def, shape);
  const accent = TIER_SHAPES.has(shape) ? tierAccent(shape, itemTier(def)) : "";
  const svg =
    `<svg viewBox="0 0 32 32" class="item-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    draw(shape, pal, def.id) + accent +
    `</svg>`;
  cache.set(def.id, svg);
  return svg;
}

/** Icon coats per mount id — the same natural tones the world rig wears. */
const MOUNT_COATS: Record<string, string> = {
  mount_pony: "#8a7a66", mount_horse: "#6b4a2e", mount_destrier: "#2e2a28",
  mount_courser: "#8a5a30", mount_dustrunner: "#a3703c", mount_courier: "#7a6a52",
  mount_runemarked: "#3a3634", mount_ferryman: "#3c4048",
  mount_mule: "#7a6a58", mount_ox: "#5a4a3a", mount_aurochs: "#4a3a2e",
  mount_packbear: "#5c4630", mount_deepstrider: "#5c5852", mount_palecrawler: "#8a8578",
  mount_bristleback: "#6a5240", mount_ironboar: "#57504a", mount_greymane: "#8b8b86",
  mount_hound: "#4a4b52", mount_nighthound: "#33343a", mount_stormhound: "#5a616c",
  mount_ridgewolf: "#6f7178", mount_silverwolf: "#b4b8c0", mount_wraithsteed: "#4e5258",
  mount_deepwing: "#4c4650", mount_lodgeoutrider: "#5c4632", mount_hollowsteed: "#6f655a",
};

/** Which head profile a mount icon draws. */
function mountFamily(id: string): "horse" | "wolf" | "heavy" | "boar" {
  if (/hound|wolf|wraith/.test(id)) return "wolf";
  if (/boar|bristle|greymane/.test(id)) return "boar";
  if (/\box|aurochs|packbear|strider|crawler/.test(id)) return "heavy";
  return "horse";
}
