/**
 * src/client/palette.ts
 * ---------------------
 * The one place a colour is decided.
 *
 * The client held roughly 1,600 hardcoded colours against eight CSS custom
 * properties, and several of those colours were the *same* colour written down
 * in two places that had drifted apart — a material's hue in the pack icon and
 * on the worn figure, a tile's colour in the world and on the minimap. This
 * module owns the families that more than one file has to agree about. It is
 * deliberately not a sweep of every hex in the renderer: local shading maths
 * belongs where it is drawn. What belongs here is anything two files could
 * disagree about.
 *
 * Everything is plain data with no DOM and no state, so a sim can import it and
 * assert on it.
 */

import type { TileType } from "../core/types.ts";

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

/** #rrggbb → [r, g, b]. */
export function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const clamp255 = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const hex2 = (n: number): string => clamp255(n).toString(16).padStart(2, "0");

/** Mix two hexes; `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return `#${hex2(ar + (br - ar) * t)}${hex2(ag + (bg - ag) * t)}${hex2(ab + (bb - ab) * t)}`;
}

/** Lift a colour toward white — the standard highlight of a base tone. */
export function lighten(hex: string, t: number): string { return mix(hex, "#ffffff", t); }
/** Sink a colour toward black. */
export function darken(hex: string, t: number): string { return mix(hex, "#000000", t); }

/** A hex with an alpha, as an `rgba()` string. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------------------
// Materials — what a thing is made of
// ---------------------------------------------------------------------------

/** A material's two tones: the body colour and the lit edge/trim. */
export interface Material { base: string; edge: string }

/**
 * Every material the game names, in one table.
 *
 * The pack icons knew twenty-eight of these and the worn figure knew seven, so
 * fifty-two percent of all worn armour fell back to a generic ten-step tier
 * ladder — a Coldpine anything and a Greyoak anything came out the same colour
 * on the character even though their icons did not. One table, read by both.
 *
 * `edge` is only written down where it is not simply a lighter base: hearthite
 * is warm-black with an ember trim, not a paler black. Everything else derives
 * its highlight, so adding a material means choosing one colour.
 */
const MATERIAL_SRC: ReadonlyArray<readonly [string, string, string?]> = [
  // --- ores and metals ---
  ["knucklestone", "#8a8275", "#b2a996"], // stone grey-brown
  ["embercite", "#3c3640", "#c86a2e"],    // black ore lit from inside
  ["ashiron", "#8b909a", "#b8bdc6"],      // ash iron grey
  ["ribstone", "#c2b48f", "#e0d5b4"],     // pale bone-tan (it IS rib-stone)
  ["spinite", "#9aa0ab", "#cdd3dc"],      // cold mountain steel
  ["bloodore", "#a5463a", "#cd6f60"],     // crimson-rust
  ["hearthite", "#2f2724", "#c8742e"],    // warm-black, ember-lit trim
  ["voidstone", "#4b4664", "#7c63c0"],    // violet-black
  ["gold", "#d8b24a"],
  ["silver", "#cfd2d8"],
  // --- woods ---
  ["ashwood", "#cdb98c"],
  ["briarwood", "#8a5a44"],
  ["coldpine", "#90a584"],
  ["stonewood", "#9a8d76"],
  ["greyoak", "#a7a39a"],
  ["ruewood", "#7a6a82"],
  ["ruevine", "#7a6a82"],
  ["deeproot", "#4a3d34"],
  ["ironbark", "#5e5a52"],
  ["heartoak", "#c98a3a"],
  ["duskwood", "#6a5f72"],
  // --- leathers (specific before generic: "master" must beat "leather") ---
  ["master", "#4a3526"],
  ["hardened", "#6a4428"],
  ["cured", "#8a5a36"],
  ["tanned", "#b07c4e"],
  ["raw_hide", "#caa07a"],
  ["leather", "#9a6a3e"],
];

/** The material table, keyword → both tones. Order is significant. */
export const MATERIALS: ReadonlyArray<readonly [string, Material]> = MATERIAL_SRC.map(
  ([key, base, edge]) => [key, { base, edge: edge ?? lighten(base, 0.28) }] as const,
);

/** The material named in a piece of text (an item's id + name), or null. */
export function materialOf(text: string): Material | null {
  const s = text.toLowerCase();
  for (const [key, m] of MATERIALS) if (s.includes(key)) return m;
  return null;
}

/**
 * The ten-step ladder, for the few pieces that name no material at all.
 * The rungs that have real smithed gear carry that metal's own tones, so an
 * inferred unique lands on-theme rather than beside it.
 */
export const TIER_LADDER: readonly Material[] = [
  materialOf("knucklestone")!,           // 1
  { base: "#9a6a3c", edge: "#c08a52" },  // 2  (bronze step — no smithed tier)
  materialOf("ashiron")!,                // 3
  materialOf("ribstone")!,               // 4
  materialOf("spinite")!,                // 5
  materialOf("bloodore")!,               // 6
  { base: "#5f6e62", edge: "#8aa093" },  // 7  (slate-green step)
  { base: "#3f6b6b", edge: "#69a6a6" },  // 8  (teal-steel step)
  materialOf("voidstone")!,              // 9
  materialOf("hearthite")!,              // 10
];

// ---------------------------------------------------------------------------
// Terrain — the ground, in the world and on the map
// ---------------------------------------------------------------------------

/** A tile's three tones: its body, its speckle accent, and how it reads on the
 *  minimap (deliberately darker and flatter — a map is not a window). */
export interface TerrainTone { base: string; accent: string; map: string }

/**
 * One table for the ground. The world renderer and the minimap each kept their
 * own copy of this, so a tile could be recoloured in one and not the other.
 */
export const TERRAIN: Record<TileType, TerrainTone> = {
  grass: { base: "#3a4a35", accent: "#45563f", map: "#34402d" },
  dirt: { base: "#52412e", accent: "#5e4b36", map: "#473720" },
  path: { base: "#6a5b45", accent: "#77654c", map: "#5a4d39" },
  stone: { base: "#41424b", accent: "#4b4d57", map: "#3a3b43" },
  water: { base: "#22496b", accent: "#356a94", map: "#1e3142" },
  // Greyoak Wood's floor — deeper, cooler green than hill grass.
  moss: { base: "#2c3a2a", accent: "#354733", map: "#26331f" },
  // The Spine: dark rock peaks and pale high snow.
  mountain: { base: "#3a3a42", accent: "#4a4a54", map: "#33343c" },
  snow: { base: "#aeb8c6", accent: "#c2ccd8", map: "#9aa6b6" },
  // Heartmoor: murky moor; Ashfen: warm ash; Marrow: dark cave; Eyeless Sea: deep.
  bog: { base: "#33402f", accent: "#3d4a37", map: "#2c3729" },
  ash: { base: "#4a3b34", accent: "#574740", map: "#40332d" },
  cave: { base: "#1c1a22", accent: "#26232e", map: "#16151c" },
  cave_wall: { base: "#0e0d12", accent: "#15131a", map: "#0b0a0f" },
  deep: { base: "#132e4d", accent: "#1d4066", map: "#101d30" },
  // Ironvale's dressed-stone walls and buildings — warm masonry, lit.
  wall: { base: "#6b6157", accent: "#7c7165", map: "#736857" },
  // Player-home interiors — a warm timber plank floor.
  plank: { base: "#6a4e30", accent: "#79593a", map: "#5e4326" },
  // Strand sand — the estuary beach and pond shores, warm against the water.
  sand: { base: "#b3996a", accent: "#c4ab79", map: "#a08a5c" },
};
