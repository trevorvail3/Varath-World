/**
 * src/client/render.ts
 * --------------------
 * Pure presentation: given the core's WorldState, paint it onto the canvas.
 * The renderer NEVER changes game state (RULE 2) — it only reads it.
 *
 * Palette: dark aged stone, ember and iron.
 */

// One full day in real milliseconds (dawn → noon → dusk → night → dawn).
// Imported from the core rather than kept here twice: the world now runs
// townsfolk routines on this same cycle, and a sky on a different clock from the
// people under it is worse than no clock at all.
import { DAY_CYCLE_MS } from "../core/worldCore.ts";
import type {
  Appearance,
  Content,
  FurnitureDef,
  SurfaceDef,
  ItemDef,
  ItemId,
  SkillAction,
  TileType,
  Vec2,
  WorldMap,
  WorldObjectDef,
  WorldObjectState,
  WorldState,
} from "../core/types.ts";
import { objectPos, objectHidden, NPC_STEP_TICKS } from "../core/worldCore.ts";
import { type RoofStyle, type EnterableBuilding, INTERIOR_TOP, DUNGEON_TOP, homeLayout, HOMES, cityDoor, cityRoof, cityPalette, ENTERABLE, instanceRectAt, tileAt, REGIONS, CITY } from "../content/map.ts";
import { type AvatarAnim, actionArmAngle, drawAvatar, drawTool, withDefaults } from "./avatar.ts";
import type { Ghost } from "./presence.ts";
import { type GearLook, resolveGear } from "./gearLook.ts";
import { itemIconSVG } from "./itemIcon.ts";
import { findPath } from "./pathfinding.ts";

// Ground loot renders as the actual item's icon: rasterise each item's SVG badge
// to an <img> once (async), cache by id, and draw it on the tile. Until an image
// has decoded, the caller falls back to a small sack so nothing pops in blank.
const groundImgCache = new Map<string, HTMLImageElement>();
function groundItemImage(def: ItemDef): HTMLImageElement | null {
  const cached = groundImgCache.get(def.id);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(itemIconSVG(def));
  groundImgCache.set(def.id, img);
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// When each ground-loot pile was first seen, driving its little drop-in bounce.
const GROUND_SEEN = new Map<number, number>();

// Which way the player last faced (kept across idle so the figure holds its
// heading when it stops). 4-way: left/right mirror the view, up shows the back
// of the head, down is the front view.
type Facing = "up" | "down" | "left" | "right";
let playerFacing: Facing = "down";
// A summoned companion trails the player with a little lag — its smoothed world
// position (in pixels) is eased toward a point just behind the player each frame.
let petWx: number | null = null;
let petWy = 0;

export const TILE = 40; // pixels per tile

/** Object kinds that lie flat on the ground: in the depth pass they sort under
 *  every standing sprite (and the player) so they never paint over a body that
 *  stands a tile in front of them. */
const FLAT_SORT_KINDS = new Set([
  "plant_patch", "tree_patch", "housing_plot", "build_hotspot", "room_seal",
  "dungeon_gate", "puzzle_lever", "fishing_spot",
]);

/** Draw distance in TILES from the player — anything past this isn't painted, so
 *  wide screens don't drag (OSRS-style circular view). Infinity = unlimited. Set
 *  by the loop each frame from the player's Settings slider. */
let drawDist = Infinity;
export function setDrawDistance(tiles: number): void {
  drawDist = tiles > 0 ? tiles : Infinity;
}

/** OSRS-style floor-loot labels: show each pile's item name above it. Toggleable. */
let lootLabels = true;
export function setLootLabels(on: boolean): void { lootLabels = on; }

/** Scene brightness, 1 = default. Above 1 thins the night veil, indoor gloom and
 *  vignette so names and levels stay readable in the dark; at 2 the night is all
 *  but gone. Set from the Settings slider (persisted in localStorage). */
let brightness = 1;
export function setBrightness(v: number): void { brightness = Math.max(0.6, Math.min(2, v)); }
export function getBrightness(): number { return brightness; }
/** How much of the darkening layers survives the brightness setting (0–1). */
function darkFactor(): number { return Math.max(0, Math.min(1, 2 - brightness)); }

// Performance mode: skip the purely-decorative ambient layers (birds,
// butterflies, surfacing water life) that cost draw calls every frame but add
// no gameplay. Paired with a lower render resolution in the loop.
// The frame-time meter: a readout of how long a painted frame actually costs.
// Off by default and purely a display preference, but it is the only honest way
// to hold an art pass to a performance budget — without a number on screen,
// "does it still feel smooth?" is a feeling. The flag lives here (with the other
// render settings) and the loop does the measuring.
const METER_KEY = "varath-frame-meter";
let frameMeter = (() => {
  try { return localStorage.getItem(METER_KEY) === "1"; } catch { return false; }
})();
/** Whether the frame-time readout is showing. */
export function getFrameMeter(): boolean { return frameMeter; }
/** Show or hide the frame-time readout (persisted). */
export function setFrameMeter(on: boolean): void {
  frameMeter = on;
  try { localStorage.setItem(METER_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

let perfMode = false;
export function setPerfMode(on: boolean): void {
  perfMode = on;
  // The terrain cache is supersampled for hi-DPI crispness; perf mode drops it
  // to 1:1 (quarter the pixels). Rebuild so the change takes effect.
  chunkScale = on ? 1 : 2;
  terrainChunks.clear();
}

/** How long the actual strike motion plays (ms). The rest of a weapon's interval
 *  is spent resting in a ready pose, so a swing reads as a quick chop + a pause
 *  rather than one slow continuous wind-up across the whole interval. */
const STRIKE_MS = 460;
/** Map "time until the blow lands" to the swing fraction (1 = rest → 0 = strike),
 *  holding at the ready pose until the final STRIKE_MS window. */
function snapStrike(untilSwing: number, interval: number): number {
  const win = Math.min(STRIKE_MS, interval);
  if (untilSwing > win) return 1; // resting between swings
  return Math.max(0, Math.min(1, untilSwing / win)); // quick strike
}

/** One entity's recent hit, driving a brief pop-and-recoil when it's struck. */
export interface HitFx { born: number; dx: number; dy: number; crit: boolean }
/** Per-entity hit effects (keyed by object id, or "player"), set by the loop
 *  each frame before drawWorld. A small "thwack" of squash + knockback. */
let combatHits: Map<string, HitFx> | null = null;
export function setCombatHits(m: Map<string, HitFx>): void { combatHits = m; }
const HIT_FX_DUR = 220; // ms a hit pop lasts

/** The scale + pixel offset to apply to an entity sprite for a recent hit. */
function hitPop(id: string, now: number): { s: number; ox: number; oy: number } | null {
  const fx = combatHits?.get(id);
  if (!fx) return null;
  const phase = (now - fx.born) / HIT_FX_DUR;
  if (phase < 0 || phase >= 1) return null;
  const pulse = Math.sin(phase * Math.PI);          // 0 → 1 → 0
  const s = 1 + (fx.crit ? 0.30 : 0.20) * pulse;     // squash bigger on a weakness hit
  const kick = (fx.crit ? 6 : 4) * pulse;            // a little knockback in the hit's direction
  return { s, ox: fx.dx * kick, oy: fx.dy * kick };
}

const TILE_COLORS: Record<TileType, [string, string]> = {
  // [base, accent] — accent is used for subtle per-tile speckle.
  grass: ["#3a4a35", "#45563f"],
  dirt: ["#52412e", "#5e4b36"],
  path: ["#6a5b45", "#77654c"],
  stone: ["#41424b", "#4b4d57"],
  water: ["#22496b", "#356a94"],
  // Greyoak Wood's floor — deeper, cooler green than hill grass.
  moss: ["#2c3a2a", "#354733"],
  // The Spine: dark rock peaks and pale high snow.
  mountain: ["#3a3a42", "#4a4a54"],
  snow: ["#aeb8c6", "#c2ccd8"],
  // Heartmoor: murky moor; Ashfen: warm ash; Marrow: dark cave; Eyeless Sea: deep.
  bog: ["#33402f", "#3d4a37"],
  ash: ["#4a3b34", "#574740"],
  cave: ["#1c1a22", "#26232e"],
  cave_wall: ["#0e0d12", "#15131a"],
  deep: ["#132e4d", "#1d4066"],
  // Ironvale's dressed-stone walls and buildings — warm masonry, lit.
  wall: ["#6b6157", "#7c7165"],
  // Player-home interiors — a warm timber plank floor.
  plank: ["#6a4e30", "#79593a"],
  // Strand sand — the estuary beach and pond shores, warm against the water.
  sand: ["#b3996a", "#c4ab79"],
};

/** A cheap, stable pseudo-noise so tiles get a fixed bit of texture. */
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// --- Terrain chunk cache -----------------------------------------------------
// The static terrain (blended base, ground detail, walls, roofs) is identical
// every frame, but repainting it tile-by-tile was the single biggest render
// cost — hundreds of paths, gradients and fills per frame. Instead, 8×8-tile
// chunks are painted ONCE into offscreen canvases and blitted with a single
// drawImage each frame. Everything that moves (water, vegetation sway, ember
// pulses, fireflies) is drawn live on top, so nothing visible goes still.
const CHUNK = 8;                 // tiles per chunk side
const CHUNK_PX = CHUNK * TILE;   // 320 world px
let chunkScale = 2;              // supersample so DPR-2 screens stay crisp (1 in perf mode)
const CHUNK_CAP = 48;            // ~view + headroom; LRU beyond that
const terrainChunks = new Map<string, HTMLCanvasElement>();
let chunkMapRef: unknown = null; // a new map object invalidates the whole cache

// Chunks are painted with a one-tile APRON on every side: tile art may spill a
// few pixels past its tile (snow drifts, boulders, roof edges), and without the
// apron that spill would clip at chunk borders. Since the painters are fully
// deterministic, the overlapping apron pixels are identical between neighbours,
// so blitting them over one another changes nothing visible.
const APRON = 1;
const APRON_PX = APRON * TILE;

function terrainChunk(map: WorldMap, cx: number, cy: number): HTMLCanvasElement {
  if (chunkMapRef !== map.tiles) { terrainChunks.clear(); chunkMapRef = map.tiles; }
  const key = `${cx},${cy}`;
  let c = terrainChunks.get(key);
  if (c) { // refresh LRU order
    terrainChunks.delete(key); terrainChunks.set(key, c);
    return c;
  }
  c = document.createElement("canvas");
  c.width = (CHUNK_PX + 2 * APRON_PX) * chunkScale;
  c.height = (CHUNK_PX + 2 * APRON_PX) * chunkScale;
  const cg = c.getContext("2d")!;
  cg.scale(chunkScale, chunkScale);
  for (let j = -APRON; j < CHUNK + APRON; j++) {
    const ty = cy * CHUNK + j;
    if (ty < 0 || ty >= map.height) continue;
    for (let i = -APRON; i < CHUNK + APRON; i++) {
      const tx = cx * CHUNK + i;
      if (tx < 0 || tx >= map.width) continue;
      paintTileStatic(cg, map.tiles[ty * map.width + tx]!, (i + APRON) * TILE, (j + APRON) * TILE, tx, ty, map);
    }
  }
  terrainChunks.set(key, c);
  if (terrainChunks.size > CHUNK_CAP) {
    const oldest = terrainChunks.keys().next().value;
    if (oldest !== undefined) terrainChunks.delete(oldest);
  }
  return c;
}

// --- Pre-rendered gradient discs ---------------------------------------------
// Soft radial glows (contact shadows, firelight pools, fireflies, mist) were
// built with createRadialGradient EVERY frame per instance — a steady raster
// cost. Each recipe is rendered once into a small sprite and blitted, with
// per-instance strength via globalAlpha and size via the draw rect.
const DISC_SPRITES = new Map<string, HTMLCanvasElement>();
function discSprite(key: string, r: number, stops: [number, string][]): HTMLCanvasElement {
  let c = DISC_SPRITES.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = Math.ceil(r * 2);
  const cg = c.getContext("2d")!;
  const grd = cg.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  cg.fillStyle = grd;
  cg.fillRect(0, 0, c.width, c.height);
  DISC_SPRITES.set(key, c);
  return c;
}

// --- Organic ground painting -------------------------------------------------
// The map assigns terrain PER TILE, so painting each tile a flat colour reads as
// a hard checkerboard. Instead, ground is painted Gouraud-style: each tile
// corner takes the average colour of the four tiles that share it (plus a dab
// of lattice noise), and the tile is filled as four sub-quads keyed to its
// corners. Corners are shared with neighbours, so terrain melts together with
// no seams and no per-tile flatness — at zero texture-memory cost.

/** Parsed [r,g,b] per tile type (base colour), computed once. */
const TILE_RGB: Partial<Record<TileType, [number, number, number]>> = {};
function tileRGB(t: TileType): [number, number, number] {
  let c = TILE_RGB[t];
  if (!c) {
    const hex = TILE_COLORS[t][0];
    c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    TILE_RGB[t] = c;
  }
  return c;
}

/** Ground types that blend into one another (organic terrain). Masonry, water
 *  and walls keep crisp edges — their borders are drawn deliberately. */
const BLEND_GROUND = new Set<TileType>(["grass", "dirt", "moss", "ash", "snow", "bog", "path", "cave", "stone", "sand"]);
/** Open water blends within itself (shallows → deep) for smooth depth. */
const BLEND_WATER = new Set<TileType>(["water", "deep"]);

/** Two-octave lattice noise at integer corner coords — shared by the four
 *  tiles that meet at the corner, so shading is seamless across the grid. */
function cornerNoise(X: number, Y: number): number {
  return hash(X, Y) * 0.55 + hash(Math.floor(X / 3) * 7 + 13, Math.floor(Y / 3) * 7 - 5) * 0.45;
}

/** The blended colour at a tile corner: average of the same-family neighbours
 *  meeting there (others count as self), lifted/dropped by corner noise. */
function cornerColor(
  map: WorldMap,
  x: number,
  y: number,
  cx: number,
  cy: number,
  self: TileType,
  family: Set<TileType>,
  noiseAmp: number,
): string {
  const selfC = tileRGB(self);
  let r = 0, gg = 0, b = 0;
  for (const dy of [cy - 1, cy]) {
    for (const dx of [cx - 1, cx]) {
      const tx = x + dx, ty = y + dy;
      let c = selfC;
      if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) {
        const t = map.tiles[ty * map.width + tx]!;
        if (family.has(t)) c = tileRGB(t);
      }
      r += c[0]; gg += c[1]; b += c[2];
    }
  }
  const n = (cornerNoise(x + cx, y + cy) - 0.5) * noiseAmp;
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v / 4 + n)));
  return `rgb(${cl(r)},${cl(gg)},${cl(b)})`;
}

/** Fill a tile as four corner-keyed sub-quads — the seamless organic base. */
function paintBlendedBase(
  g: CanvasRenderingContext2D,
  map: WorldMap,
  tile: TileType,
  px: number,
  py: number,
  x: number,
  y: number,
  family: Set<TileType>,
  noiseAmp: number,
): void {
  const half = TILE / 2;
  for (const cy of [0, 1] as const) {
    for (const cx of [0, 1] as const) {
      g.fillStyle = cornerColor(map, x, y, cx, cy, tile, family, noiseAmp);
      g.fillRect(px + cx * half, py + cy * half, half, half);
    }
  }
}

/** Small wild-flower colours — a little life against all the green. */
const FLOWERS = ["#d9637a", "#e8d24a", "#cf6fc0", "#eae6ee", "#6f9ad6", "#e08a3a"];

/**
 * Decorative, walk-through groundcover scattered deterministically across wild
 * ground, varied by terrain so each region reads like itself: flowers and tufts
 * on grass, mushrooms/ferns/fallen logs on the forest floor, reeds in the moor,
 * snowdrifts and bare twigs on snow, charred stumps and embers on the ash flats,
 * and scattered pebbles/boulders on dirt and stone. Purely cosmetic — none of
 * this is an object, can't be collided with or harvested (the real choppable
 * trees and rocks are world objects drawn elsewhere).
 */
function scatterVegetation(
  g: CanvasRenderingContext2D,
  tile: TileType,
  px: number,
  py: number,
  x: number,
  y: number,
  now: number,
): void {
  const green = tile === "grass" || tile === "moss" || tile === "bog";
  if (!green && tile !== "snow" && tile !== "ash" && tile !== "stone" && tile !== "dirt") return;

  const h = hash(x, y);
  // Per-terrain density: the forest floor is lush, the flats and screes sparse.
  const density = tile === "moss" ? 0.42 : tile === "grass" ? 0.34
    : tile === "bog" ? 0.40 : tile === "ash" ? 0.26
    : tile === "snow" ? 0.24 : 0.20; // dirt / stone
  if (h > density) return; // most tiles stay bare

  // Jittered position within the tile, from independent hashes.
  const jx = px + 6 + hash(x + 7, y) * (TILE - 12);
  const jy = py + 8 + hash(x, y + 13) * (TILE - 16);
  const h2 = hash(x * 2.7 + 19, y * 1.3 + 5); // picks the variant
  // A gentle breeze: tops sway, rooted bases stay put (phase varies per tile).
  const sway = Math.sin(now / 900 + x * 0.7 + y * 0.5) * 1.7;

  // --- Stone / scree: pebbles and the rare boulder. ---
  if (tile === "stone" || tile === "dirt") {
    if (h2 < 0.08) { // a boulder
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.beginPath(); g.ellipse(jx, jy + 5, 9, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6a6b73";
      g.beginPath(); g.ellipse(jx, jy + 1, 8, 6.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#838690";
      g.beginPath(); g.ellipse(jx - 2, jy - 1, 4, 3, 0, 0, Math.PI * 2); g.fill();
    } else { // a few pebbles
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i % 2 ? "rgba(150,152,162,0.5)" : "rgba(0,0,0,0.18)";
        g.beginPath();
        g.ellipse(jx - 5 + i * 5 + hash(x + i, y) * 3, jy + (i % 2 ? 2 : 5), 2.4, 1.6, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    return;
  }

  // --- Snow: drifts and bare dead twigs. ---
  if (tile === "snow") {
    if (h2 < 0.4) { // a soft drift mound
      g.fillStyle = "rgba(120,140,165,0.30)";
      g.beginPath(); g.ellipse(jx, jy + 4, 9, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.beginPath(); g.ellipse(jx, jy + 2, 7.5, 3.5, 0, 0, Math.PI * 2); g.fill();
    } else { // a bare frosted twig
      g.strokeStyle = "#7c7468"; g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(jx, jy + 5); g.lineTo(jx + sway * 0.4, jy - 4);
      g.moveTo(jx + sway * 0.3, jy); g.lineTo(jx + 4, jy - 5);
      g.moveTo(jx + sway * 0.3, jy); g.lineTo(jx - 4, jy - 4);
      g.stroke();
    }
    return;
  }

  // --- Ash flats: charred stumps, ash mounds and the odd live ember. ---
  if (tile === "ash") {
    if (h2 < 0.18) { // a charred stump
      g.fillStyle = "#241c19";
      g.beginPath(); g.ellipse(jx, jy + 4, 5, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(jx - 3.5, jy - 4, 7, 9);
      g.fillStyle = "rgba(224,138,58,0.5)"; // a faint ember still glowing in the heart
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now / 280 + x + y));
      g.globalAlpha = pulse;
      g.fillRect(jx - 1.5, jy - 1, 3, 3);
      g.globalAlpha = 1;
    } else { // a pale ash mound
      g.fillStyle = "rgba(120,108,100,0.45)";
      g.beginPath(); g.ellipse(jx, jy + 3, 7, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(60,50,46,0.4)";
      g.beginPath(); g.ellipse(jx + 2, jy + 4, 3, 1.4, 0, 0, Math.PI * 2); g.fill();
    }
    return;
  }

  // --- Bog / moor: reeds and cattails. ---
  if (tile === "bog") {
    g.strokeStyle = "#5a6a3c"; g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const bx = jx - 4 + i * 2.4;
      g.moveTo(bx, jy + 6);
      g.lineTo(bx + (i % 2 ? 2 : -2) + sway, jy - 7);
    }
    g.stroke();
    if (h2 < 0.4) { // a brown cattail head on one stalk
      g.fillStyle = "#6e4a2c";
      g.fillRect(jx - 0.5 + sway, jy - 9, 2, 5);
    }
    return;
  }

  // --- Forest floor (moss) & grassland: greenery, flowers, mushrooms, logs. ---
  const tint = tile === "moss" ? "#46622f" : "#4f6e33";
  const dark = tile === "moss" ? "#2f4422" : "#374e25";

  if (tile === "moss" && h2 < 0.07) {
    // A mossy fallen log lying across the forest floor.
    g.fillStyle = "rgba(0,0,0,0.20)";
    g.beginPath(); g.ellipse(jx, jy + 4, 12, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#5a3f24";
    g.beginPath(); g.ellipse(jx, jy, 12, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#6b4a2c"; // lit top
    g.beginPath(); g.ellipse(jx, jy - 1, 11, 2.4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3f5a2a"; // moss on the bark
    g.beginPath(); g.ellipse(jx - 4, jy - 1, 3, 1.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(jx + 5, jy, 2.5, 1.3, 0, 0, Math.PI * 2); g.fill();
    return;
  }
  if (tile === "moss" && h2 < 0.22) {
    // A little cluster of mushrooms.
    const red = h2 < 0.14;
    for (let i = 0; i < 2; i++) {
      const mx = jx - 3 + i * 6, my = jy + i * 2;
      g.fillStyle = "#d9cdb6"; g.fillRect(mx - 1, my - 1, 2.2, 5); // stem
      g.fillStyle = red ? "#b5462f" : "#8a6a45"; // cap
      g.beginPath(); g.ellipse(mx, my - 1, 3.2, 2.2, 0, Math.PI, 0); g.fill();
      if (red) { g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(mx - 1, my - 2, 1.2, 1.2); g.fillRect(mx + 1, my - 1.5, 1, 1); }
    }
    return;
  }

  if (h < 0.045) {
    // A small decorative tree, casting a soft dapple of shade on the ground.
    g.fillStyle = "rgba(0,0,0,0.16)";
    g.beginPath(); g.ellipse(jx + 3, jy + 4, 11, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#5a3f24";
    g.fillRect(jx - 1.5, jy, 3, 9);
    g.fillStyle = dark;
    g.beginPath(); g.arc(jx + sway, jy - 2, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = tint;
    g.beginPath(); g.arc(jx - 2 + sway, jy - 4, 6, 0, Math.PI * 2); g.fill();
  } else if (h < 0.13) {
    // A leafy bush: two overlapping blobs.
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(jx, jy, 7, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = tint;
    g.beginPath(); g.ellipse(jx - 2 + sway * 0.5, jy - 1.5, 4.5, 3.5, 0, 0, Math.PI * 2); g.fill();
  } else if (tile === "grass" && h2 < 0.34) {
    // A wild flower: a short stem and a little burst of petals.
    const col = FLOWERS[Math.floor(hash(x + 3, y + 8) * FLOWERS.length)] ?? FLOWERS[0]!;
    g.strokeStyle = "#3c5226"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(jx, jy + 4); g.lineTo(jx + sway * 0.5, jy - 2); g.stroke();
    g.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.ellipse(jx + sway * 0.5 + Math.cos(a) * 2.2, jy - 2 + Math.sin(a) * 2.2, 1.5, 1.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#e8d24a";
    g.beginPath(); g.ellipse(jx + sway * 0.5, jy - 2, 1.4, 1.4, 0, 0, Math.PI * 2); g.fill();
  } else {
    // Grass / fern tufts: a few upright blades that bend in the breeze.
    g.strokeStyle = tint; g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const bx = jx - 4 + i * 2.6;
      g.moveTo(bx, jy + 4);
      g.lineTo(bx + (i % 2 ? 1.5 : -1.5) + sway, jy - 3);
    }
    g.stroke();
  }
}

/** Paint one terrain tile's STATIC art: base fill plus type-specific detail.
 *  Everything here is time-independent so it can live in the chunk cache;
 *  the moving parts (water, ore-vein pulses) are paintTileLive's job. */
function paintTileStatic(
  g: CanvasRenderingContext2D,
  tile: TileType,
  px: number,
  py: number,
  x: number,
  y: number,
  map: WorldMap,
): void {
  const [base, accent] = TILE_COLORS[tile];
  // Organic ground and open water get the seamless corner-blended base (the
  // fix for the old per-tile checkerboard); built surfaces stay flat + crisp.
  if (BLEND_GROUND.has(tile)) paintBlendedBase(g, map, tile, px, py, x, y, BLEND_GROUND, 26);
  else if (BLEND_WATER.has(tile)) paintBlendedBase(g, map, tile, px, py, x, y, BLEND_WATER, 12);
  else {
    g.fillStyle = base;
    g.fillRect(px, py, TILE, TILE);
  }
  const hv = hash(x, y);

  switch (tile) {
    case "wall": {
      const roof = cityRoof(x, y);
      if (roof) drawRoof(g, px, py, x, y, roof);
      else drawWall(g, px, py, x, y, map);
      return; // walls/roofs draw their own edges
    }
    case "water":
    case "deep":
      return; // the blended base is the static part — all motion is live
    case "mountain": {
      // High rock, varied by noise so the range reads as one massif instead of
      // wallpaper: talus fields, cracked slabs, and only the occasional true
      // peak — each with an off-centre apex, a lit west face, a shadowed east
      // face, and a snow crown only where the noise says the air is thin.
      const n = cornerNoise(x, y);
      // Base rock mass: corner-shaded like ground, but on its own dark ramp.
      const rr = 46 + Math.round(n * 18), gg2 = rr + 2, bb = rr + 10;
      for (const cy2 of [0, 1] as const) {
        for (const cx2 of [0, 1] as const) {
          const cn = (cornerNoise(x + cx2, y + cy2) - 0.5) * 26;
          g.fillStyle = `rgb(${Math.round(rr + cn)},${Math.round(gg2 + cn)},${Math.round(bb + cn)})`;
          g.fillRect(px + cx2 * TILE / 2, py + cy2 * TILE / 2, TILE / 2, TILE / 2);
        }
      }
      if (n > 0.62) {
        // A true peak: irregular apex, split-lit faces, hard ridge line.
        const ax = px + TILE * (0.35 + 0.3 * hash(x * 3, y * 5)); // apex x
        const ay = py + 3 + 5 * hash(x * 7, y * 2);               // apex y
        const bl = px + 2, br = px + TILE - 2, byy = py + TILE - 2;
        g.fillStyle = "#232329"; // shadowed east face
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(br, byy); g.lineTo(ax, byy); g.closePath(); g.fill();
        g.fillStyle = "#585a68"; // lit west face
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax, byy); g.lineTo(bl, byy); g.closePath(); g.fill();
        g.strokeStyle = "rgba(200,206,220,0.5)"; g.lineWidth = 1.2; // sunlit ridge
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bl + 3, byy); g.stroke();
        if (n > 0.8) { // snow crown on the tallest
          g.fillStyle = "#dde3ec";
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 6, ay + 9); g.lineTo(ax + 1, ay + 7); g.lineTo(ax - 5, ay + 10); g.closePath(); g.fill();
        }
      } else if (n > 0.38) {
        // A cracked slab: one big facet edge + a couple of fissures.
        g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(px + TILE * hash(x, y * 9), py + 4);
        g.lineTo(px + TILE * (0.3 + 0.5 * hv), py + TILE - 6);
        g.stroke();
        g.strokeStyle = "rgba(255,255,255,0.10)";
        g.beginPath();
        g.moveTo(px + 4, py + TILE * (0.3 + 0.4 * hv));
        g.lineTo(px + TILE - 4, py + TILE * (0.35 + 0.4 * hash(x * 5, y)));
        g.stroke();
      } else {
        // Talus: scattered chunk-shadows and one pale scree glint.
        g.fillStyle = "rgba(0,0,0,0.28)";
        for (let i = 0; i < 3; i++) {
          const sx = px + hash(x * 4 + i, y * 6 - i) * (TILE - 8);
          const sy = py + hash(x * 2 - i, y * 8 + i) * (TILE - 8);
          g.beginPath(); g.ellipse(sx + 4, sy + 4, 4 + 2 * hash(x + i, y), 2.6, 0.4, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = "rgba(190,195,210,0.20)";
        g.fillRect(px + TILE * hv, py + TILE * hash(x * 9, y * 3), 4, 2);
      }
      return; // rock handles its own edges
    }
    case "grass":
    case "moss": {
      // Scattered blade-tufts; moss also gets a darker damp patch.
      if (tile === "moss" && hv > 0.5) {
        g.fillStyle = "#243020";
        g.beginPath();
        g.ellipse(px + TILE * (0.3 + 0.4 * hv), py + TILE * 0.5, 7, 5, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = accent;
      g.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const hx = hash(x * 3 + i, y * 5 - i);
        const hy = hash(x * 7 - i, y * 2 + i);
        const bx = px + 5 + hx * (TILE - 10);
        const by = py + 8 + hy * (TILE - 14);
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + (hx - 0.5) * 4, by - 5);
        g.stroke();
      }
      break;
    }
    case "dirt":
    case "sand":
    case "ash": {
      // Clods / cracked warm ground: a few light and dark flecks.
      for (let i = 0; i < 5; i++) {
        const hx = hash(x * 5 + i, y * 3 + i);
        const hy = hash(x * 2 - i, y * 9 + i);
        g.fillStyle = i % 2 ? accent : "rgba(0,0,0,0.18)";
        g.fillRect(px + hx * (TILE - 5), py + hy * (TILE - 5), 4, 3);
      }
      if (tile === "ash" && hv > 0.6) { // a warm ember crack
        g.strokeStyle = "rgba(210,116,44,0.25)"; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px + 6, py + TILE * hv); g.lineTo(px + TILE - 6, py + TILE * hv - 6); g.stroke();
      }
      break;
    }
    case "path": {
      // Worn cobbles: rounded stones with a lighter trodden centre.
      g.fillStyle = "rgba(255,240,210,0.06)";
      g.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
      g.fillStyle = accent;
      for (let i = 0; i < 5; i++) {
        const hx = hash(x * 4 + i, y * 6 + i);
        const hy = hash(x * 8 - i, y * 3 + i);
        const s = 4 + hx * 3;
        g.globalAlpha = 0.5;
        g.fillRect(px + 3 + hx * (TILE - 9), py + 3 + hy * (TILE - 9), s, s - 1);
      }
      g.globalAlpha = 1;
      break;
    }
    case "stone": {
      // Dressed flagstones: a couple of mortar cracks + a lit block.
      g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px, py + TILE * (0.35 + 0.3 * hv)); g.lineTo(px + TILE, py + TILE * (0.35 + 0.3 * hv));
      g.moveTo(px + TILE * (0.4 + 0.2 * hv), py); g.lineTo(px + TILE * (0.4 + 0.2 * hv), py + TILE * 0.4);
      g.stroke();
      g.fillStyle = accent; g.globalAlpha = 0.4;
      g.fillRect(px + 4, py + 4, TILE * 0.4, TILE * 0.25);
      g.globalAlpha = 1;
      // A couple of loose pebbles for grit.
      if (hv > 0.4) {
        g.fillStyle = "rgba(0,0,0,0.18)";
        g.beginPath(); g.ellipse(px + TILE * (0.6 + 0.25 * hv), py + TILE * 0.7, 2.5, 1.8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(150,150,160,0.22)";
        g.beginPath(); g.ellipse(px + TILE * 0.3, py + TILE * (0.6 + 0.2 * hv), 2, 1.5, 0, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "bog": {
      // Murky ground with a dark standing-water blotch.
      if (hv > 0.45) {
        g.fillStyle = "rgba(20,30,28,0.55)";
        g.beginPath();
        g.ellipse(px + TILE * (0.4 + 0.3 * hv), py + TILE * 0.55, 8, 5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(90,120,110,0.18)";
        g.fillRect(px + TILE * 0.35, py + TILE * 0.5, 8, 1.5);
      }
      break;
    }
    case "snow": {
      // Wind-shaped drifts: a soft blue shadow pooled on the lee side, a bright
      // crest, and cold sparkle. The corner-blended base does the big shapes.
      if (hv > 0.45) {
        const dx2 = px + TILE * (0.25 + 0.5 * hash(x * 3, y * 7));
        const dy2 = py + TILE * (0.3 + 0.45 * hash(x * 5, y * 2));
        const grd = g.createRadialGradient(dx2, dy2, 1, dx2, dy2, 12);
        grd.addColorStop(0, "rgba(120,140,180,0.22)");
        grd.addColorStop(1, "rgba(120,140,180,0)");
        g.fillStyle = grd;
        g.beginPath(); g.arc(dx2, dy2, 12, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1.4; // crest
        g.beginPath(); g.arc(dx2 - 2, dy2 - 3, 8, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
      }
      g.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < 3; i++) {
        const hx = hash(x * 6 + i, y * 4 + i);
        if (hx > 0.45) g.fillRect(px + hx * (TILE - 4), py + hash(x, y + i) * (TILE - 4), 2, 2);
      }
      break;
    }
    case "cave":
    case "cave_wall": {
      g.fillStyle = accent; g.globalAlpha = 0.6;
      for (let i = 0; i < 3; i++) {
        const hx = hash(x * 5 + i, y * 7 + i);
        g.fillRect(px + hx * (TILE - 4), py + hash(x + i, y) * (TILE - 4), 3, 3);
      }
      g.globalAlpha = 1;
      if (tile === "cave_wall") {
        g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(px, py, TILE, 2);
        // (The rare pulsing ore vein is animated — paintTileLive draws it.)
      } else if (hv > 0.9) {
        // A faint mineral glint on the cave floor — a little life in the dark.
        g.fillStyle = "rgba(110,170,180,0.4)";
        g.fillRect(px + TILE * (0.4 + 0.2 * hv), py + TILE * 0.55, 2, 2);
      }
      break;
    }
    case "plank": {
      // A swept timber floor: warm boards with seams and a soft top highlight.
      g.strokeStyle = "rgba(40,24,10,0.30)"; g.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const yy = py + Math.round(i * TILE / 3);
        g.beginPath(); g.moveTo(px, yy + 0.5); g.lineTo(px + TILE, yy + 0.5); g.stroke();
      }
      // a staggered cross-joint, so boards don't line up tile to tile
      const jx = px + Math.round(TILE * (0.3 + 0.4 * hv));
      const band = hv > 0.5 ? 0 : 1;
      g.beginPath(); g.moveTo(jx + 0.5, py + band * TILE / 3); g.lineTo(jx + 0.5, py + (band + 1) * TILE / 3); g.stroke();
      g.fillStyle = "rgba(255,224,170,0.07)";
      for (let i = 0; i < 3; i++) g.fillRect(px, py + Math.round(i * TILE / 3) + 1, TILE, 1.5);
      g.fillStyle = "rgba(60,38,18,0.18)"; // a few grain flecks
      for (let i = 0; i < 3; i++) g.fillRect(px + hash(x * 3 + i, y) * (TILE - 6), py + hash(x, y * 3 + i) * (TILE - 4), 3, 1);
      return; // boards are texture enough; skip the ground grid
    }
  }

  // Shoreline: a pale, damp band wherever walkable ground meets open water, so
  // coasts and riverbanks read as edges instead of a hard colour cut. Bog keeps
  // a darker, muddier rim (no bright sand in a mire).
  const wid = map.width;
  const wet = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= wid || ty >= map.height) return false;
    const t = map.tiles[ty * wid + tx];
    return t === "water" || t === "deep";
  };
  if (wet(x - 1, y) || wet(x + 1, y) || wet(x, y - 1) || wet(x, y + 1)) {
    g.fillStyle = tile === "bog" ? "rgba(28,40,34,0.55)" : "rgba(204,190,150,0.45)";
    if (wet(x - 1, y)) g.fillRect(px, py, 3, TILE);
    if (wet(x + 1, y)) g.fillRect(px + TILE - 3, py, 3, TILE);
    if (wet(x, y - 1)) g.fillRect(px, py, TILE, 3);
    if (wet(x, y + 1)) g.fillRect(px, py + TILE - 3, TILE, 3);
  }

  // Edge blending: where two different walkable ground types meet, dither a few
  // specks of the neighbour's colour across the seam so biomes feather into one
  // another instead of hard-cutting on the grid. (Skips water/walls — those have
  // their own edges above.)
  const groundFamily = (t: TileType | undefined): boolean =>
    t === "grass" || t === "dirt" || t === "moss" || t === "ash" || t === "snow" ||
    t === "bog" || t === "stone" || t === "cave" || t === "path";
  if (groundFamily(tile)) {
    const edges: [number, number, number, number][] = [
      [-1, 0, px + 1, py], [1, 0, px + TILE - 4, py],
      [0, -1, px, py + 1], [0, 1, px, py + TILE - 4],
    ];
    for (const [dx, dy, ex, ey] of edges) {
      const nt = map.tiles[(y + dy) * wid + (x + dx)] as TileType | undefined;
      if (!nt || nt === tile || !groundFamily(nt)) continue;
      g.fillStyle = TILE_COLORS[nt][0];
      for (let i = 0; i < 4; i++) {
        const a = hash(x * 7 + i + dx * 3, y * 5 + i + dy * 3);
        const along = a * (TILE - 4);
        const into = hash(x + i, y + i * 2) * 3;
        g.globalAlpha = 0.35 + 0.35 * a;
        if (dx === 0) g.fillRect(ex + along, ey + into, 3, 3);
        else g.fillRect(ex + into, ey + along, 3, 3);
      }
    }
    g.globalAlpha = 1;
  }

  // (No per-tile grid stroke: organic ground reads as continuous terrain now —
  // the old faint grid was a big part of the "checkerboard" look. Masonry
  // draws its own mortar lines above.)
}

/**
 * Batched water animation for the chunked overworld path: instead of three
 * stroke() calls PER TILE (750+ path operations on a coast view), all visible
 * water tiles are gathered into a handful of shared paths — one under-swell
 * stroke, and the shimmering crests bucketed into three brightness bands.
 * Same waves, same look, a fraction of the draw calls.
 */
function paintWaterBatch(
  g: CanvasRenderingContext2D,
  map: WorldMap,
  cam: Camera,
  minX: number, maxX: number, minY: number, maxY: number,
  now: number,
): void {
  const t = now / 900;
  const wd = map.width;
  // In-bounds walkable ground (out-of-bounds is NOT land, so no foam at the
  // map rim — matching the per-tile painter).
  const land = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= wd || ty >= map.height) return false;
    const tt = map.tiles[ty * wd + tx];
    return tt !== "water" && tt !== "deep";
  };
  const tiles: Array<[number, number, TileType]> = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const tile = map.tiles[y * wd + x]!;
      if (tile === "water" || tile === "deep") tiles.push([x, y, tile]);
    }
  }
  if (!tiles.length) return;

  // Under-swell: one dark path across every water tile.
  g.strokeStyle = "rgba(8,20,34,0.35)";
  g.lineWidth = 3;
  g.beginPath();
  for (const [x, y] of tiles) {
    const px = x * TILE - cam.x, py = y * TILE - cam.y;
    for (let i = 0; i <= 4; i++) {
      const wx = px + (i / 4) * TILE;
      const wy = py + TILE * 0.62 + Math.sin(t * 2 + (x + i / 4) * 1.7 + y * 0.9) * 3.5;
      if (i === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
    }
  }
  g.stroke();

  // Twin crests, shimmer quantised into three alpha bands so each band strokes
  // once. (The shimmer is animated noise — the stepping is invisible.)
  const bands: Path2D[] = [new Path2D(), new Path2D(), new Path2D()];
  for (const [x, y] of tiles) {
    const px = x * TILE - cam.x, py = y * TILE - cam.y;
    const hv = hash(x, y);
    for (let c = 0; c < 2; c++) {
      const sh = 0.5 + 0.5 * Math.sin(t * 2.4 + x * 1.3 + y * 0.7 + c * 2.6);
      const band = bands[Math.min(2, Math.floor(sh * 3))]!;
      for (let i = 0; i <= 4; i++) {
        const wx = px + (i / 4) * TILE;
        const wy = py + TILE * (0.25 + 0.38 * c + 0.1 * hv) + Math.sin(t * 2.2 + (x + i / 4) * 2.1 + y * 1.3 + c * 3) * 2.8;
        if (i === 0) band.moveTo(wx, wy); else band.lineTo(wx, wy);
      }
    }
  }
  g.lineWidth = 1.6;
  const CREST_ALPHA = [0.31, 0.43, 0.54]; // centres of the 0.25 + 0.35·sh range
  for (let b = 0; b < 3; b++) {
    // water/deep accents are close; the mid tone reads right over both
    g.strokeStyle = "#356a94";
    g.globalAlpha = CREST_ALPHA[b]!;
    g.stroke(bands[b]!);
  }
  g.globalAlpha = 1;

  // Glints + shoreline foam are sparse — per tile is fine.
  for (const [x, y] of tiles) {
    const px = x * TILE - cam.x, py = y * TILE - cam.y;
    const hv = hash(x, y);
    const wink = Math.sin(now / 700 + hv * 19 + x * 2 + y * 3);
    if (wink > 0.75) {
      g.globalAlpha = (wink - 0.75) * 3;
      g.fillStyle = "#bfe0f2";
      g.fillRect(px + TILE * (0.2 + 0.55 * hv), py + TILE * (0.3 + 0.35 * hash(x * 9, y * 4)), 3, 1.6);
      g.globalAlpha = 1;
    }
    if (land(x - 1, y) || land(x + 1, y) || land(x, y - 1) || land(x, y + 1)) {
      g.globalAlpha = 0.22 + 0.14 * Math.sin(now / 700 + x * 0.9 + y);
      g.fillStyle = "rgba(225,238,245,0.9)";
      if (land(x - 1, y)) g.fillRect(px, py + 2, 2, TILE - 4);
      if (land(x + 1, y)) g.fillRect(px + TILE - 2, py + 2, 2, TILE - 4);
      if (land(x, y - 1)) g.fillRect(px + 2, py, TILE - 4, 2);
      if (land(x, y + 1)) g.fillRect(px + 2, py + TILE - 2, TILE - 4, 2);
      g.globalAlpha = 1;
    }
  }
}

/** The ANIMATED overlay for tiles whose look moves — open water's swell,
 *  crests, glints and shoreline foam, and the pulsing ore veins in cave rock.
 *  Drawn live every frame over the cached static art. */
function paintTileLive(
  g: CanvasRenderingContext2D,
  tile: TileType,
  px: number,
  py: number,
  x: number,
  y: number,
  now: number,
  map: WorldMap,
): void {
  if (tile === "water" || tile === "deep") {
    const accent = TILE_COLORS[tile][1];
    const hv = hash(x, y);
    // Living water: a dark under-swell that drifts, two WAVY highlight crests
    // (sine-bent curves, phase-shifted per tile so they read as one surface
    // across the lake), and an occasional sun-sparkle.
    const t = now / 900;
    g.strokeStyle = "rgba(8,20,34,0.35)"; // under-swell shadow
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i <= 4; i++) {
      const wx = px + (i / 4) * TILE;
      const wy = py + TILE * 0.62 + Math.sin(t * 2 + (x + i / 4) * 1.7 + y * 0.9) * 3.5;
      if (i === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
    }
    g.stroke();
    g.strokeStyle = accent; // twin crests
    g.lineWidth = 1.6;
    for (let c = 0; c < 2; c++) {
      const sh = 0.5 + 0.5 * Math.sin(t * 2.4 + x * 1.3 + y * 0.7 + c * 2.6);
      g.globalAlpha = 0.25 + 0.35 * sh;
      g.beginPath();
      for (let i = 0; i <= 4; i++) {
        const wx = px + (i / 4) * TILE;
        const wy = py + TILE * (0.25 + 0.38 * c + 0.1 * hv) + Math.sin(t * 2.2 + (x + i / 4) * 2.1 + y * 1.3 + c * 3) * 2.8;
        if (i === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
      }
      g.stroke();
    }
    // A cold sun-glint that winks on a few tiles at a time.
    const wink = Math.sin(now / 700 + hv * 19 + x * 2 + y * 3);
    if (wink > 0.75) {
      g.globalAlpha = (wink - 0.75) * 3;
      g.fillStyle = "#bfe0f2";
      g.fillRect(px + TILE * (0.2 + 0.55 * hv), py + TILE * (0.3 + 0.35 * hash(x * 9, y * 4)), 3, 1.6);
    }
    g.globalAlpha = 1;
    // Foam where the water laps against land — a soft, breathing highlight on
    // any edge facing a walkable tile (completes the shoreline from both sides).
    const wd = map.width;
    const land = (tx: number, ty: number): boolean => {
      if (tx < 0 || ty < 0 || tx >= wd || ty >= map.height) return false;
      const tt = map.tiles[ty * wd + tx];
      return tt !== "water" && tt !== "deep";
    };
    if (land(x - 1, y) || land(x + 1, y) || land(x, y - 1) || land(x, y + 1)) {
      g.globalAlpha = 0.22 + 0.14 * Math.sin(now / 700 + x * 0.9 + y);
      g.fillStyle = "rgba(225,238,245,0.9)";
      if (land(x - 1, y)) g.fillRect(px, py + 2, 2, TILE - 4);
      if (land(x + 1, y)) g.fillRect(px + TILE - 2, py + 2, 2, TILE - 4);
      if (land(x, y - 1)) g.fillRect(px + 2, py, TILE - 4, 2);
      if (land(x, y + 1)) g.fillRect(px + 2, py + TILE - 2, TILE - 4, 2);
      g.globalAlpha = 1;
    }
    return;
  }
  if (tile === "cave_wall") {
    // A rare vein of glittering ore in the rock face — slowly pulsing, with a
    // soft glow halo so the lode catches the eye in the dark.
    const hv = hash(x, y);
    if (hv <= 0.84) return;
    const cyan = hv > 0.93;
    const oy = py + TILE * (0.3 + 0.4 * hash(x, y + 9));
    const ox = px + TILE * 0.3;
    const pulse = 0.55 + 0.45 * Math.sin(now / 520 + x * 1.3 + y);
    g.save();
    g.globalCompositeOperation = "lighter";
    const glow = cyan ? "120,205,215" : "210,170,90";
    const sprite = discSprite(`ore-${cyan}`, 9, [[0, `rgba(${glow},0.40)`], [1, `rgba(${glow},0)`]]);
    g.globalAlpha = pulse;
    g.drawImage(sprite, ox + 2 - 9, oy - 9, 18, 18);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = cyan ? `rgba(150,220,230,${(0.55 + 0.4 * pulse).toFixed(2)})` : `rgba(180,150,100,${(0.5 + 0.4 * pulse).toFixed(2)})`;
    g.fillRect(ox, oy, 3, 2);
    g.fillRect(ox + 3, oy - 2, 2, 2);
    g.restore();
  }
}

/**
 * Recolour one interior tile to a chosen home surface (floor or wall). A solid
 * fill in the surface colour, then a seam pattern keyed to the surface style:
 * wood-grain boards, tiled squares (checker/marble), or panelled walls, plus a
 * soft top highlight so the room still reads as a lit, textured space.
 */
function paintHomeSurface(
  g: CanvasRenderingContext2D,
  surf: SurfaceDef,
  px: number,
  py: number,
  x: number,
  y: number,
): void {
  g.fillStyle = surf.color;
  g.fillRect(px, py, TILE, TILE);
  const seam = surf.seam;
  const style = surf.style ?? (surf.kind === "floor" ? "board" : "panel");
  if (seam) {
    g.strokeStyle = seam;
    g.lineWidth = 1;
    if (style === "board") {
      for (let i = 1; i < 3; i++) {
        const yy = py + Math.round(i * TILE / 3);
        g.beginPath(); g.moveTo(px, yy + 0.5); g.lineTo(px + TILE, yy + 0.5); g.stroke();
      }
      const jx = px + Math.round(TILE * (0.3 + 0.4 * hash(x, y)));
      const band = hash(x, y) > 0.5 ? 0 : 1;
      g.beginPath(); g.moveTo(jx + 0.5, py + band * TILE / 3); g.lineTo(jx + 0.5, py + (band + 1) * TILE / 3); g.stroke();
    } else if (style === "tile") {
      // A grid of squares — stone, slate, marble, checker.
      const half = TILE / 2;
      g.strokeRect(px + 0.5, py + 0.5, half - 1, half - 1);
      g.strokeRect(px + half + 0.5, py + 0.5, half - 1, half - 1);
      g.strokeRect(px + 0.5, py + half + 0.5, half - 1, half - 1);
      g.strokeRect(px + half + 0.5, py + half + 0.5, half - 1, half - 1);
    } else if (style === "checker") {
      g.fillStyle = seam;
      g.fillRect(px, py, TILE / 2, TILE / 2);
      g.fillRect(px + TILE / 2, py + TILE / 2, TILE / 2, TILE / 2);
    } else {
      // Panelled wall: a framed rectangle inset from the tile edge.
      g.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
    }
  }
  // A faint top-lit sheen so the surface isn't flat.
  g.fillStyle = surf.kind === "floor" ? "rgba(255,240,210,0.06)" : "rgba(255,255,255,0.05)";
  g.fillRect(px, py, TILE, 2);
  g.fillStyle = "rgba(0,0,0,0.08)";
  g.fillRect(px, py + TILE - 2, TILE, 2);
}

/**
 * Regional architecture palettes. Each settlement recolours its whole masonry
 * shell and roofs so a town reads as one distinct PLACE — Frostgate's cold
 * blue granite, Emberhearth's ash walls under ember-red tile, Saltreach's
 * salt-bleached driftwood, and so on — rather than the same grey block
 * everywhere. `wall` is [body, brick, merlon]; `roof` is [base, ridge, line]
 * and OVERRIDES the RoofStyle colour while the style's SHAPE/texture (thatch
 * vs slate courses) still comes from the roof style itself. Keyed by the
 * `palette` string stamped on each Building in content/map.ts; a tile with no
 * palette falls back to Ironvale's default dressed stone.
 */
interface SettlementPalette { wall: [string, string, string]; roof: [string, string, string]; }
const WALL_DEFAULT: [string, string, string] = ["#5d544b", "#776c5e", "#857a6c"];
const SETTLEMENT_PALETTES: Record<string, SettlementPalette> = {
  // Frostgate — northern gate-town of cold blue granite under slate.
  frostgate: { wall: ["#4a5560", "#5e6b78", "#71808e"], roof: ["#3b4a5a", "#54677c", "#2b3743"] },
  // Deeplight — pit-town of dark stone banded with timber, black-slate roofs.
  deeplight: { wall: ["#463d34", "#5a4f43", "#6b5d4d"], roof: ["#3a3128", "#52463a", "#26201a"] },
  // Saltreach — coastal hamlet of salt-bleached grey driftwood and pale thatch.
  saltreach: { wall: ["#7d7a6e", "#928e80", "#a49f8f"], roof: ["#9a8f6a", "#b4a982", "#786e4e"] },
  // Emberhearth — ashfall town, dark cinder walls under ember-red tile.
  emberhearth: { wall: ["#3e3833", "#4e463f", "#5c524a"], roof: ["#7a2f22", "#a84a30", "#4e1a12"] },
  // Mirehold — peat-timber stilt village, roofs gone to moss and reed.
  mirehold: { wall: ["#443f34", "#544d3e", "#63593f"], roof: ["#5a5f38", "#75794a", "#3c4126"] },
  // Lodgehold — hunters' timber lodges in warm weathered grey-oak and hide.
  lodgehold: { wall: ["#5a4f42", "#6e6150", "#7e7060"], roof: ["#6a5238", "#856a48", "#472e1f"] },
  // Redmouth — river-mouth fishing hamlet of red silt daub and dark thatch.
  redmouth: { wall: ["#5e4238", "#714f42", "#82604c"], roof: ["#846540", "#9c8250", "#6a5232"] },
  // Drover's Rest — a dusty tan drove-road stop, sun-baked earth and straw.
  drover: { wall: ["#6a5c48", "#7e6f56", "#8e7d62"], roof: ["#8a7642", "#a08a52", "#6e5d33"] },
  // The Fold — high sheep-fold croft in pale wool-grey stone and hay thatch.
  fold: { wall: ["#5c5a4e", "#6e6c5c", "#7e7c6a"], roof: ["#7e7a4e", "#97925e", "#605d38"] },
};

/**
 * Dressed-stone city wall: warm masonry in a brick bond, with battlement teeth
 * (merlons) along any edge that faces open ground, and a cast shadow where it
 * drops to the ground below. Reads as a real rampart, not a grey block.
 * When the tile belongs to a regional settlement, its masonry is recoloured
 * from that town's SETTLEMENT_PALETTE.
 */
function drawWall(
  g: CanvasRenderingContext2D,
  px: number,
  py: number,
  x: number,
  y: number,
  map: WorldMap,
): void {
  const isWall = (dx: number, dy: number): boolean => tileAt(map, x + dx, y + dy) === "wall";
  const openN = !isWall(0, -1), openS = !isWall(0, 1);
  const openW = !isWall(-1, 0), openE = !isWall(1, 0);

  // Regional architecture: recolour this town's masonry, or fall back to
  // Ironvale's default dressed stone.
  const pal = cityPalette(x, y);
  const [body, brick, merlon] = (pal && SETTLEMENT_PALETTES[pal]?.wall) || WALL_DEFAULT;

  // Masonry body: brick bond with mortar lines.
  g.fillStyle = body;
  g.fillRect(px, py, TILE, TILE);
  const rows = 3;
  const rh = TILE / rows;
  for (let r = 0; r < rows; r++) {
    const ry = py + r * rh;
    const off = (r % 2) * (TILE / 4);
    for (let b = -1; b < 3; b++) {
      const bx = px + off + b * (TILE / 2);
      // lit top-left, shaded bottom-right per brick
      g.fillStyle = brick;
      g.fillRect(bx + 1.5, ry + 1.5, TILE / 2 - 3, rh - 3);
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(bx + 1.5, ry + rh - 3, TILE / 2 - 3, 1.5);
      g.fillStyle = "rgba(255,240,210,0.10)";
      g.fillRect(bx + 1.5, ry + 1.5, TILE / 2 - 3, 1.2);
    }
  }

  // Battlement merlons along edges that face open ground (the rampart top).
  g.fillStyle = merlon;
  const tooth = TILE / 4;
  if (openN) {
    for (let i = 0; i < 4; i += 2) g.fillRect(px + i * tooth, py, tooth, 5);
    g.fillStyle = "rgba(255,245,220,0.18)"; g.fillRect(px, py, TILE, 2); g.fillStyle = merlon;
  }
  if (openS) {
    for (let i = 1; i < 4; i += 2) g.fillRect(px + i * tooth, py + TILE - 5, tooth, 5);
  }
  if (openW) for (let i = 0; i < 4; i += 2) g.fillRect(px, py + i * tooth, 5, tooth);
  if (openE) for (let i = 1; i < 4; i += 2) g.fillRect(px + TILE - 5, py + i * tooth, 5, tooth);

  // Cast shadow where the wall drops to open ground on its south side.
  if (openS) {
    const grad = g.createLinearGradient(0, py + TILE - 6, 0, py + TILE + 4);
    grad.addColorStop(0, "rgba(0,0,0,0.0)");
    grad.addColorStop(1, "rgba(0,0,0,0.32)");
    g.fillStyle = grad;
    g.fillRect(px, py + TILE - 6, TILE, 10);
  }
}

/** Roof palettes: [base, light ridge, shingle line]. */
const ROOF_COLORS: Record<RoofStyle, [string, string, string]> = {
  slate: ["#454a57", "#5b6170", "#363a44"],
  tile: ["#8a4632", "#a85c44", "#6e3526"],
  thatch: ["#8a7642", "#a08a52", "#6e5d33"],
  tower: ["#3e3d47", "#54535f", "#2c2b33"],
};

/**
 * A building roof, drawn per-tile but neighbour-aware so a multi-tile building
 * reads as one pitched, shingled roof: a lit ridge along its top edge, eaves
 * shadow and a doorway at the bottom, and a stone-wall sliver on the sides.
 */
function drawRoof(
  g: CanvasRenderingContext2D,
  px: number,
  py: number,
  x: number,
  y: number,
  style: RoofStyle,
  // For an enterable building's roof canopy: neighbour-awareness + door notch
  // come from the footprint instead of the wall-tile roof map.
  override?: { belongs: (x: number, y: number) => boolean; door: (x: number, y: number) => boolean },
): void {
  // Regional architecture: a settlement's palette overrides the roof COLOUR
  // (the RoofStyle still drives the shingle/thatch SHAPE + texture below), and
  // recolours the masonry course that shows under its eaves.
  const pal = cityPalette(x, y);
  const palWall = pal ? SETTLEMENT_PALETTES[pal]?.wall : undefined;
  const [base, ridge, line] = (pal && SETTLEMENT_PALETTES[pal]?.roof) || ROOF_COLORS[style];
  const courseColor = palWall ? palWall[0] : "#5d544b";
  const belongs = override ? override.belongs : (xx: number, yy: number) => cityRoof(xx, yy) === style;
  const isDoor = override ? override.door : cityDoor;
  const sameRoof = (dx: number, dy: number) => belongs(x + dx, y + dy);
  const topEdge = !sameRoof(0, -1);
  const botEdge = !sameRoof(0, 1);
  const leftEdge = !sameRoof(-1, 0);
  const rightEdge = !sameRoof(1, 0);

  // A thin masonry course shows under the eaves at the very bottom of a building.
  if (botEdge) {
    g.fillStyle = courseColor;
    g.fillRect(px, py, TILE, TILE);
  }
  const roofBottom = botEdge ? py + TILE - 7 : py + TILE;

  // Roof field with a top-lit gradient.
  const grad = g.createLinearGradient(0, py, 0, roofBottom);
  grad.addColorStop(0, ridge);
  grad.addColorStop(0.25, base);
  grad.addColorStop(1, line);
  g.fillStyle = grad;
  g.fillRect(px, py, TILE, roofBottom - py);

  // Shingle / thatch texture: rows of course lines with STAGGERED tile ticks
  // (offset every other row, keyed to the map coords so neighbouring roof
  // tiles continue the bond) — reads as laid shingles, not ruled paper.
  g.strokeStyle = "rgba(0,0,0,0.22)";
  g.lineWidth = 1;
  const rows = style === "thatch" ? 5 : 3;
  for (let r = 1; r < rows; r++) {
    const ry = py + (r / rows) * (roofBottom - py);
    g.beginPath(); g.moveTo(px, ry); g.lineTo(px + TILE, ry); g.stroke();
  }
  if (style !== "thatch") {
    g.strokeStyle = "rgba(0,0,0,0.16)";
    for (let r = 0; r < rows; r++) {
      const ry0 = py + (r / rows) * (roofBottom - py);
      const ry1 = py + ((r + 1) / rows) * (roofBottom - py);
      const shift = ((x + y + r) % 2) * (TILE / 6);
      for (let i = 0; i < 3; i++) {
        const tx = px + shift + (i + 0.5) * (TILE / 3);
        g.beginPath(); g.moveTo(tx, ry0 + 1); g.lineTo(tx, ry1 - 1); g.stroke();
      }
    }
    // a sun-caught shingle or two
    g.fillStyle = "rgba(255,235,200,0.10)";
    g.fillRect(px + ((x * 7 + y * 3) % 3) * (TILE / 3) + 2, py + 2, TILE / 3 - 4, (roofBottom - py) / rows - 2);
  }
  if (style === "thatch") { // vertical straw hints
    g.strokeStyle = "rgba(255,240,200,0.10)";
    for (let i = 0; i < 5; i++) {
      const sx = px + 4 + i * 8 + (hash(x, y + i) * 3);
      g.beginPath(); g.moveTo(sx, py + 3); g.lineTo(sx, roofBottom - 2); g.stroke();
    }
  } else { // tile/slate shingle offset dashes
    g.fillStyle = line;
    for (let r = 0; r < rows; r++) {
      const ry = py + (r / rows) * (roofBottom - py) + 2;
      const off = (r % 2) * 6;
      for (let c = 0; c < 4; c++) g.fillRect(px + off + c * 11, ry, 5, 1.5);
    }
  }

  // Lit ridge cap along the top edge of the building.
  if (topEdge) {
    g.fillStyle = ridge;
    g.fillRect(px, py, TILE, 3);
    g.fillStyle = "rgba(255,245,225,0.25)";
    g.fillRect(px, py, TILE, 1.2);
  }
  // Eaves shadow + doorway along the bottom.
  if (botEdge) {
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(px, roofBottom, TILE, 2);
    if (isDoor(x, y)) {
      g.fillStyle = "#1c150f";
      g.fillRect(px + TILE / 2 - 4, roofBottom + 1, 8, 6);
      g.fillStyle = "rgba(210,160,90,0.4)"; // a warm sliver of lamplight
      g.fillRect(px + TILE / 2 - 4, roofBottom + 1, 2, 6);
    }
  }
  // Side wall slivers for depth.
  g.fillStyle = "rgba(0,0,0,0.18)";
  if (leftEdge) g.fillRect(px, py, 2, roofBottom - py);
  if (rightEdge) { g.fillStyle = "rgba(255,240,210,0.08)"; g.fillRect(px + TILE - 2, py, 2, roofBottom - py); }
  // Tower: a crenellated cap instead of a ridge.
  if (style === "tower" && topEdge) {
    g.fillStyle = "#2c2b33";
    for (let i = 0; i < 4; i += 2) g.fillRect(px + i * (TILE / 4), py, TILE / 4, 4);
  }
}

export interface Camera {
  x: number; // top-left of the view, in pixels
  y: number;
}

/** Obstacles of each agility course, grouped and ordered (cheap; few objects). */
function agilityCourses(content: Content): Map<string, WorldObjectDef[]> {
  const byCourse = new Map<string, WorldObjectDef[]>();
  for (const o of content.objects) {
    if (o.kind !== "agility_obstacle" || !o.course) continue;
    const arr = byCourse.get(o.course) ?? [];
    arr.push(o);
    byCourse.set(o.course, arr);
  }
  for (const arr of byCourse.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return byCourse;
}

/**
 * The worn track + fence that turn scattered obstacles into a readable course:
 * a looping dirt path through the obstacles in order, ringed by fence posts.
 * Purely cosmetic (drawn under the obstacles); no collision.
 */
function drawAgilityTracks(
  g: CanvasRenderingContext2D,
  content: Content,
  cam: Camera,
  w: number,
  h: number,
  inRegion: (x: number, y: number) => boolean,
): void {
  const sx = (tx: number): number => tx * TILE + TILE / 2 - cam.x;
  const sy = (ty: number): number => ty * TILE + TILE / 2 - cam.y;
  for (const [course, pts] of agilityCourses(content).entries()) {
    if (pts.length < 2) continue;
    // The Varathian Trail rings the entire map — a single bounding box round it
    // would fence in the whole world. It has no worn track/fence; its checkpoints
    // stand alone and the next-leg marker guides you between them.
    if (course === "course_varath_trail") continue;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of pts) {
      minx = Math.min(minx, p.x!); miny = Math.min(miny, p.y!);
      maxx = Math.max(maxx, p.x!); maxy = Math.max(maxy, p.y!);
    }
    if (!inRegion(Math.round((minx + maxx) / 2), Math.round((miny + maxy) / 2))) continue;
    if (sx(maxx) < -TILE || sx(minx) > w + TILE || sy(maxy) < -TILE || sy(miny) > h + TILE) continue;

    g.save();
    // Worn dirt track looping through the obstacles in order.
    g.strokeStyle = "rgba(116, 92, 56, 0.4)";
    g.lineWidth = 11;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(sx(pts[0]!.x!), sy(pts[0]!.y!));
    for (let i = 1; i < pts.length; i++) g.lineTo(sx(pts[i]!.x!), sy(pts[i]!.y!));
    g.lineTo(sx(pts[0]!.x!), sy(pts[0]!.y!)); // close the circuit
    g.stroke();
    // A light fence ringing the course.
    const fx0 = (minx - 1) * TILE - cam.x, fy0 = (miny - 1) * TILE - cam.y;
    const fx1 = (maxx + 2) * TILE - cam.x, fy1 = (maxy + 2) * TILE - cam.y;
    g.strokeStyle = "rgba(110, 84, 50, 0.55)";
    g.lineWidth = 2;
    g.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    g.fillStyle = "#6e542f";
    for (let px = fx0; px <= fx1 + 1; px += TILE) {
      g.fillRect(px - 1.5, fy0 - 3, 3, 7);
      g.fillRect(px - 1.5, fy1 - 3, 3, 7);
    }
    for (let py = fy0; py <= fy1 + 1; py += TILE) {
      g.fillRect(fx0 - 1.5, py - 3, 3, 7);
      g.fillRect(fx1 - 1.5, py - 3, 3, 7);
    }
    g.restore();
  }
}

/** Tile types a trodden path can cross (for routing the Varathian Trail — the
 *  ground types, not water/mountain/wall/cave-wall). Object blocking is ignored:
 *  the track is cosmetic ground, drawn under trees and rocks. */
const TRAIL_WALKABLE = new Set<TileType>([
  "grass", "dirt", "path", "moss", "snow", "bog", "ash", "cave", "plank", "stone",
]);

/** The routed Varathian Trail, tile by tile, cached after the first build (the
 *  checkpoints are static content). Null until computed. */
let trailRouteCache: Vec2[] | null = null;

/** A* the trail through walkable tiles: for each checkpoint pair (looping), find
 *  the efficient ground route rather than a straight line across country. */
function buildTrailRoute(content: Content, map: WorldMap): Vec2[] {
  const walkable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height &&
    TRAIL_WALKABLE.has(map.tiles[y * map.width + x]!);
  const snap = (p: Vec2): Vec2 => {
    if (walkable(p.x, p.y)) return { x: p.x, y: p.y };
    for (let r = 1; r <= 5; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++)
          if (walkable(p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
    return { x: p.x, y: p.y };
  };
  const cps = content.objects
    .filter((o) => o.course === "course_varath_trail")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((o) => snap({ x: o.x, y: o.y }));
  if (cps.length < 2) return cps;
  const route: Vec2[] = [cps[0]!];
  for (let i = 0; i < cps.length; i++) {
    const a = cps[i]!, b = cps[(i + 1) % cps.length]!; // close the loop
    const seg = findPath(walkable, a, b);
    if (seg.length) route.push(...seg);
    else route.push(b); // unroutable — fall back to a straight hop
  }
  return route;
}

/**
 * The Varathian Trail's ground path: a thin, dulled, walked-on track — the same
 * look as the small agility courses' worn dirt, just narrower — routed through
 * the tiles that make sense (A* between checkpoints) rather than a straight line
 * to each. Built once and cached; drawn per-segment with view culling since the
 * loop spans the whole map.
 */
function drawTrailPath(
  g: CanvasRenderingContext2D,
  content: Content,
  map: WorldMap,
  cam: Camera,
  w: number,
  h: number,
  inRegion: (x: number, y: number) => boolean,
  outside: (x: number, y: number) => boolean,
): void {
  if (!trailRouteCache) trailRouteCache = buildTrailRoute(content, map);
  const route = trailRouteCache;
  if (route.length < 2) return;
  const sx = (tx: number): number => (tx + 0.5) * TILE - cam.x;
  const sy = (ty: number): number => (ty + 0.5) * TILE - cam.y;
  g.save();
  g.strokeStyle = "rgba(116, 92, 56, 0.32)"; // worn dirt, matching the courses (thinner)
  g.lineWidth = 6;
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!, b = route[i + 1]!;
    const midx = Math.round((a.x + b.x) / 2), midy = Math.round((a.y + b.y) / 2);
    if (!inRegion(midx, midy) || outside(midx, midy)) continue;
    const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y);
    if (Math.max(ax, bx) < -TILE || Math.min(ax, bx) > w + TILE ||
        Math.max(ay, by) < -TILE || Math.min(ay, by) > h + TILE) continue;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  }
  g.restore();
}

/**
 * OSRS-style next-obstacle marker: a pulsing green ring + chevron over the
 * obstacle to take next — the course's first leg until you start a lap, then
 * advancing leg by leg as you clear them.
 */
function drawAgilityMarkers(
  g: CanvasRenderingContext2D,
  state: WorldState,
  content: Content,
  cam: Camera,
  w: number,
  h: number,
  now: number,
  inRegion: (x: number, y: number) => boolean,
): void {
  const lap = state.player.agilityLap;
  for (const [course, obs] of agilityCourses(content)) {
    const nextIdx = lap && lap.course === course ? lap.next : 0;
    const target = obs.find((o) => (o.order ?? 0) === nextIdx);
    if (!target || !inRegion(target.x!, target.y!)) continue;
    const px = target.x! * TILE + TILE / 2 - cam.x;
    const py = target.y! * TILE + TILE / 2 - cam.y;
    if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);
    g.save();
    g.strokeStyle = `rgba(150, 210, 74, ${0.45 + 0.4 * pulse})`;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(px, py, TILE * 0.42 + pulse * 3, 0, Math.PI * 2);
    g.stroke();
    const by = py - TILE * 0.72 - pulse * 3;
    g.fillStyle = "#b6d24a";
    g.beginPath();
    g.moveTo(px, by + 7);
    g.lineTo(px - 6, by - 3);
    g.lineTo(px + 6, by - 3);
    g.closePath();
    g.fill();
    g.restore();
  }
}

/** A dropped item on the floor — drawn as its own icon (a rod looks like a rod),
 *  over a soft glow so it reads as loot. Falls back to a sack until the icon
 *  image has decoded. */
function drawGroundItem(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  qty: number,
  def?: ItemDef,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(now / 380);
  g.save();
  // Soft warm glow so loot reads against the ground.
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 13);
  grad.addColorStop(0, `rgba(242,207,107,${0.22 + 0.16 * pulse})`);
  grad.addColorStop(1, "rgba(242,207,107,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, 13, 0, Math.PI * 2);
  g.fill();
  // A faint ground shadow the item sits on.
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(cx, cy + 7, 8, 3, 0, 0, Math.PI * 2);
  g.fill();
  const img = def ? groundItemImage(def) : null;
  if (img) {
    const S = 22; // draw the 32×32 badge at 22px on the tile
    g.drawImage(img, cx - S / 2, cy - S / 2 - 1, S, S);
  } else {
    // Fallback: a little drawstring sack until the icon decodes (or if unknown).
    g.fillStyle = "#6e4f2c";
    g.beginPath();
    g.ellipse(cx, cy + 2, 6, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#8a6a3a";
    g.fillRect(cx - 3.5, cy - 4, 7, 3);
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, cy + 2, 6, 5, 0, 0, Math.PI * 2);
    g.stroke();
  }
  if (qty > 1) {
    g.fillStyle = "#f2cf6b";
    g.font = "bold 10px 'Cinzel', serif";
    g.textAlign = "center";
    g.fillText(String(qty), cx, cy + 16);
    g.textAlign = "left";
  }
  g.restore();
}

/**
 * Interpolate a tile position between the tile occupied last game tick (`prev`)
 * and this tick (`cur`) by `alpha` in [0,1] — the fraction of the current tick
 * elapsed in real time. This is what turns the sim's discrete one-tile hops into
 * smooth on-screen motion. A large `prev`→`cur` gap is a TELEPORT (waystone,
 * portal, respawn, knockback), so snap to `cur` rather than streak the sprite
 * across the map. Standing still ⇒ prev == cur ⇒ returns `cur` (no drift).
 */
export function interpTile(prev: Vec2 | undefined, cur: Vec2, alpha: number): Vec2 {
  if (!prev) return cur;
  const dx = cur.x - prev.x, dy = cur.y - prev.y;
  if (dx * dx + dy * dy > 12.25) return cur; // > 3.5 tiles apart → teleport, snap
  return { x: prev.x + dx * alpha, y: prev.y + dy * alpha };
}

/**
 * How far through a tile STEP we are, in [0,1]. A step spans `durTicks` base ticks
 * starting at `startTick`; `tickCount`+`alpha` (the fraction of the current tick)
 * give the live position within it. Once the window elapses this clamps to 1, so a
 * creature that has stopped simply sits at its tile — no need to reset prevPos.
 */
export function stepProgress(startTick: number, durTicks: number, tickCount: number, alpha: number): number {
  const dur = Math.max(1, durTicks);
  return Math.min(1, Math.max(0, (tickCount - startTick + alpha) / dur));
}

export function drawWorld(
  g: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: WorldState,
  content: Content,
  cam: Camera,
  now: number,
  viewW = canvas.width,
  viewH = canvas.height,
  ghosts: Ghost[] = [],
  /** Fraction [0,1] of the current game tick elapsed — drives tile interpolation
   *  so movement glides between the sim's discrete tile hops. */
  alpha = 1,
): void {
  // Visible span in world pixels. Under a zoom transform this is the device size
  // over the zoom, so tile culling and the night veil cover exactly the view.
  const w = viewW;
  const h = viewH;

  // When the player is inside a sealed instance (a home or a boss arena), the
  // view is masked to that one region — everything outside it is void, so you
  // never see the neighbouring rooms or the arena band around it.
  const ppos = state.player.pos;
  const region = instanceRectAt(Math.round(ppos.x), Math.round(ppos.y));
  const inRegion = (x: number, y: number) =>
    !region || (x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1);
  // A backyard paddock is an instance in the interior band, but reads as an
  // OUTDOOR grass yard — the homes sit left of x55, the yards right of it.
  const backyard = !!(region && region.y0 === INTERIOR_TOP && region.x0 >= 55);
  // A dungeon site: an instance carved in the band below the interiors.
  const dungeon = !!(region && region.y0 >= DUNGEON_TOP - 1);

  g.fillStyle = backyard ? "#182415" : region ? "#07070a" : "#13100d";
  g.fillRect(0, 0, w, h);

  const { map } = state;
  const sv = sunCast(); // sun position → directional shadows + night factor
  const minX = Math.max(0, Math.floor(cam.x / TILE));
  const minY = Math.max(0, Math.floor(cam.y / TILE));
  const maxX = Math.min(map.width - 1, Math.ceil((cam.x + w) / TILE));
  const maxY = Math.min(map.height - 1, Math.ceil((cam.y + h) / TILE));

  // Draw distance: a circular cull around the player so a wide screen doesn't
  // paint (and texture) hundreds of off-radius tiles. `dd2` is the squared
  // radius; `outside()` is the per-tile/per-object test (always false when the
  // distance is unlimited).
  const pdx = ppos.x, pdy = ppos.y;
  const dd2 = drawDist === Infinity ? Infinity : (drawDist + 0.5) * (drawDist + 0.5);
  const outside = (x: number, y: number): boolean =>
    dd2 !== Infinity && ((x - pdx) * (x - pdx) + (y - pdy) * (y - pdy)) > dd2;

  // --- Tiles ---
  // Home surfaces: when the player stands in their home, a chosen floor/wall
  // surface recolours the plank floor / stone walls of the room they're in.
  const homeInterior = !!(region && region.y0 === INTERIOR_TOP && !backyard);
  const floorSurf = homeInterior ? content.surfaces[state.player.home.floor ?? ""] : undefined;
  const wallSurf = homeInterior ? content.surfaces[state.player.home.wall ?? ""] : undefined;
  // The open overworld blits cached terrain chunks (the static art) and then
  // draws only the moving layers per tile. Instances (homes, arenas, dungeons)
  // and a finite draw-distance circle keep the per-tile path — they mask or
  // cull individual tiles, which a whole-chunk blit can't honour.
  if (!region && dd2 === Infinity) {
    const c0x = Math.floor(minX / CHUNK), c1x = Math.floor(maxX / CHUNK);
    const c0y = Math.floor(minY / CHUNK), c1y = Math.floor(maxY / CHUNK);
    // Blit each chunk's CORE region only. The apron tiles were painted so
    // their art could spill INTO the core pixels (and this chunk's own spill
    // into the apron is discarded — the neighbour captured the same spill in
    // its core), so cores tile the view exactly with no overdraw.
    for (let cy2 = c0y; cy2 <= c1y; cy2++) {
      for (let cx2 = c0x; cx2 <= c1x; cx2++) {
        g.drawImage(
          terrainChunk(map, cx2, cy2),
          APRON_PX * chunkScale, APRON_PX * chunkScale,
          CHUNK_PX * chunkScale, CHUNK_PX * chunkScale,
          cx2 * CHUNK_PX - cam.x, cy2 * CHUNK_PX - cam.y,
          CHUNK_PX, CHUNK_PX,
        );
      }
    }
    paintWaterBatch(g, map, cam, minX, maxX, minY, maxY, now);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = map.tiles[y * map.width + x]!;
        scatterVegetation(g, tile, x * TILE - cam.x, y * TILE - cam.y, x, y, now);
      }
    }
  } else {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!inRegion(x, y)) continue; // mask everything outside the current instance
        if (outside(x, y)) continue;   // past the draw distance — leave it void
        const tile = map.tiles[y * map.width + x]!;
        const px = x * TILE - cam.x;
        const py = y * TILE - cam.y;
        paintTileStatic(g, tile, px, py, x, y, map);
        paintTileLive(g, tile, px, py, x, y, now, map);
        if (floorSurf && tile === "plank") paintHomeSurface(g, floorSurf, px, py, x, y);
        else if (wallSurf && tile === "wall") paintHomeSurface(g, wallSurf, px, py, x, y);
        scatterVegetation(g, tile, px, py, x, y, now);
      }
    }
  }

  // Night fireflies: after dusk, warm motes drift over wild grass and moss —
  // a third of the night mood for a hundredth of its cost. Deterministic per
  // tile, so they live in the same meadows every evening.
  const nightF = sv.night;
  if (!perfMode && nightF > 0.15) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!inRegion(x, y) || outside(x, y)) continue;
        const t = map.tiles[y * map.width + x];
        if (t !== "grass" && t !== "moss" && t !== "bog") continue;
        const hv2 = hash(x * 13, y * 17);
        if (hv2 < 0.94) continue;
        const px = x * TILE - cam.x, py = y * TILE - cam.y;
        for (let i = 0; i < 2; i++) {
          const ph = now / (2400 + i * 700) + hv2 * 40 + i * 2.2;
          const fx = px + TILE / 2 + Math.sin(ph) * 14 + Math.sin(ph * 2.3) * 5;
          const fy = py + TILE / 2 + Math.cos(ph * 1.3) * 10 - 4;
          const pulse = Math.max(0, Math.sin(ph * 3.1 + i));
          if (pulse < 0.2) continue;
          const al = 0.5 * pulse * nightF;
          const halo = discSprite("firefly", 5, [[0, "rgba(200,230,120,1)"], [1, "rgba(200,230,120,0)"]]);
          g.globalAlpha = al;
          g.drawImage(halo, fx - 5, fy - 5);
          g.fillStyle = "rgba(228,244,170,1)";
          g.fillRect(fx - 0.8, fy - 0.8, 1.6, 1.6);
          g.globalAlpha = 1;
        }
      }
    }
  }

  // Ambient water wildlife on the surface: fins in the deep, leaping fish in the
  // rivers and lakes, the odd whale sounding out at sea. Drawn over the water but
  // under everything else, so the day/night veil tints it with the water.
  if (!perfMode) drawWaterLife(g, map, cam, minX, maxX, minY, maxY, now, inRegion, outside);

  // Agility courses: worn track + fence, drawn under the obstacles themselves.
  drawAgilityTracks(g, content, cam, w, h, inRegion);
  drawTrailPath(g, content, state.map, cam, w, h, inRegion, outside);

  // --- Loot on the floor (kill drops awaiting pickup) ---
  // Drawn before objects so creatures and the player render ON TOP of loot —
  // it's lying on the ground, not floating over heads.
  for (const gi of state.ground) {
    if (!inRegion(gi.x, gi.y)) continue;
    if (outside(gi.x, gi.y)) continue; // past the draw distance
    const px = gi.x * TILE - cam.x;
    const py = gi.y * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
    // Fan separate piles on the same tile out a little (by stable id) so each
    // kill's loot reads as its own pile rather than one merged heap.
    const ox = ((gi.id % 3) - 1) * 7;
    const oy = ((Math.floor(gi.id / 3) % 3) - 1) * 6;
    const cx = px + TILE / 2 + ox, cy = py + TILE / 2 + oy;
    // New loot drops in: a short fall with a squash-and-settle, keyed to when
    // this pile first came into view (so freshly killed drops bounce, and far
    // piles bounce as you discover them).
    let born = GROUND_SEEN.get(gi.id);
    if (born === undefined) {
      if (GROUND_SEEN.size > 512) GROUND_SEEN.clear(); // cheap prune; a re-pop is harmless
      born = now;
      GROUND_SEEN.set(gi.id, now);
    }
    const k = Math.min(1, (now - born) / 320);
    if (k < 1) {
      const ease = 1 - (1 - k) * (1 - k) * (1 - k);
      const s = 0.55 + 0.45 * ease + 0.10 * Math.sin(k * Math.PI);
      g.save();
      g.translate(cx, cy - (1 - ease) * 9);
      g.scale(s, s);
      g.translate(-cx, -cy);
    }
    drawGroundItem(g, cx, cy, now, gi.qty, content.items[gi.item]);
    if (k < 1) g.restore();
  }

  // OSRS-style floor-loot name labels, drawn in a second pass so they sit ON TOP
  // of every pile. High-value drops glow gold so they catch the eye. Toggleable.
  if (lootLabels) {
    for (const gi of state.ground) {
      if (!inRegion(gi.x, gi.y) || outside(gi.x, gi.y)) continue;
      const px = gi.x * TILE - cam.x;
      const py = gi.y * TILE - cam.y;
      if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
      const ox = ((gi.id % 3) - 1) * 7;
      const oy = ((Math.floor(gi.id / 3) % 3) - 1) * 6;
      const def = content.items[gi.item];
      if (!def) continue;
      const name = gi.qty > 1 ? `${def.name} (${gi.qty})` : def.name;
      const valuable = (def.sell ?? 0) * gi.qty >= 1000;
      label(g, name, px + TILE / 2 + ox, py + oy - 2, valuable ? "#f4d98b" : "#e8e2d0");
    }
  }

  // --- Objects ---
  const lights: Array<[number, number]> = []; // warm light sources, for night
  const trophy = trophyGlyph(state, content); // the player's rarest item, for display cases
  // Label de-clutter: collect the boxes of labels already drawn (NPC/monster
  // names) so fishing-spot labels — which pile up where shoals cluster — can be
  // drawn last with collision avoidance instead of bleeding into each other.
  const labelBoxes: Array<[number, number, number, number]> = [];
  const fishLabels: Array<{ cx: number; yb: number; text: string; color: string; locked: boolean; dist: number }> = [];
  const labelBox = (text: string, cx: number, yb: number): [number, number, number, number] => {
    const half = (text.length * 5.2 + 4) / 2;
    return [cx - half, yb - 11, cx + half, yb + 1];
  };
  const labelHits = (b: [number, number, number, number]): boolean =>
    labelBoxes.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1]);
  // Floor pass: remains (bone piles, corpses, braziers, a boss's dais) lie
  // flat on the ground, so they draw before — and therefore under — anything
  // that stands on or walks over them.
  for (const def of content.objects) {
    if (def.kind !== "remains") continue;
    if (!state.objects[def.id]) continue;
    if (objectHidden(def, state.player)) continue;
    if (!inRegion(def.x, def.y)) continue;
    if (outside(def.x, def.y)) continue;
    const px = def.x * TILE - cam.x;
    const py = def.y * TILE - cam.y;
    if (px < -TILE * 2 || py < -TILE * 2 || px > w + TILE * 2 || py > h + TILE * 2) continue;
    drawRemains(g, px + TILE / 2, py + TILE / 2, def, now);
    if (def.variant === "brazier") lights.push([px + TILE / 2, py + TILE / 2 - 6]);
  }
  // Depth (y-sort) pass: every standing thing — objects, creatures, NPCs and the
  // player — is COLLECTED here rather than drawn inline, then drawn in baseline
  // order so a nearer thing paints over a farther one. Without this the player
  // (drawn last) floated on top of every tree and wall it stood behind. Name
  // labels are collected too and drawn last, on top of the sorted sprites.
  const sprites: { y: number; draw: () => void }[] = [];
  const nameLabels: { text: string; cx: number; yb: number; color: string }[] = [];
  for (const def of content.objects) {
    if (def.kind === "remains") continue; // drawn in the floor pass above
    const obj = state.objects[def.id];
    if (!obj) continue;
    if (objectHidden(def, state.player)) continue; // story-gated: not revealed yet
    // Creatures render at their live (wandering) position, interpolated across
    // their step (prevPos→pos over NPC_STEP_TICKS) so they glide; fixed objects
    // sit at their def tile.
    const p = obj.pos
      ? interpTile(obj.prevPos, obj.pos, stepProgress(obj.moveStartTick ?? 0, NPC_STEP_TICKS, state.tickCount, alpha))
      : objectPos(def, obj);
    if (!inRegion(Math.round(p.x), Math.round(p.y))) continue; // mask other instances
    if (outside(p.x, p.y)) continue; // past the draw distance
    const px = p.x * TILE - cam.x;
    const py = p.y * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
    // Collect this object's draw, keyed by its foot (baseline) for the y-sort.
    // Flat, ground-hugging things (crop patches, fishing ripples, plots, boarded
    // doorways) get a floor-level key so they always sort UNDER the standing
    // sprites and never paint over the player who stands a tile in front of them.
    const flat = FLAT_SORT_KINDS.has(def.kind);
    sprites.push({ y: flat ? -1e6 + py : py + TILE, draw: () => {
    if (def.kind === "plant_patch" || def.kind === "tree_patch") {
      drawPatch(g, obj.crop, obj.plantedAt, content, px, py);
    } else if (def.kind === "housing_plot") {
      drawHousingPlot(g, px + TILE / 2, py + TILE / 2, !!obj.owned);
    } else if (def.kind === "build_hotspot") {
      // Free-placement homes own furniture now (drawn from player.home.placed
      // below); the fixed footings render nothing.
    } else if (def.kind === "room_seal") {
      // Boarded-up doorway until the house tier that unseals it is reached.
      if (state.player.home.tier < (def.tier ?? 1)) drawRoomSeal(g, px + TILE / 2, py + TILE / 2);
    } else if (def.kind === "dungeon_gate") {
      drawDungeonGate(g, px, py);
    } else if (def.kind === "puzzle_lever") {
      drawPuzzleLever(g, px + TILE / 2, py + TILE / 2, !!obj.thrown || state.player.flags.includes(`pz_${def.puzzle ?? def.id}`), now);
    } else if (def.kind === "dungeon_chest") {
      drawDungeonChest(g, px + TILE / 2, py + TILE / 2, state.player.flags.includes(`looted_${def.id}`));
    } else if (def.kind === "ruin_prop") {
      drawRuinProp(g, px + TILE / 2, py + TILE / 2, def.id);
    } else {
      // A soft contact shadow under living things (and not under a slain, mid-
      // respawn monster) so they sit on the ground and read against the terrain.
      if ((def.kind === "npc" || def.kind === "critter" || (def.kind === "monster" && obj.available))) {
        castShadow(g, px + TILE / 2, py + TILE - 4, sv); // sun-cast shadow under the contact one
        shadow(g, px + TILE / 2, py + TILE - 4, 9, 3.5);
      }
      // A struck creature briefly squashes and recoils — the "thwack" of a hit.
      const hp = obj.available ? hitPop(def.id, now) : null;
      if (hp) {
        const cx = px + TILE / 2, cy = py + TILE * 0.6;
        g.save();
        g.translate(hp.ox, hp.oy);
        g.translate(cx, cy); g.scale(hp.s, hp.s); g.translate(-cx, -cy);
      }
      // Creatures face the way they walk (and keep facing it while they stand),
      // instead of one fixed direction forever. Monsters/creatures only mirror
      // left/right (their art is baked side-on); townsfolk NPCs turn all four
      // ways (front / back / left / right), tracking both axes of movement.
      let flip = false;
      let facing: Facing = "down";
      if ((def.kind === "monster" && obj.available) || def.kind === "npc") {
        const lx = obj.pos?.x ?? def.x;
        const ly = obj.pos?.y ?? def.y;
        const px0 = FACING_X.get(def.id);
        const py0 = FACING_Y.get(def.id);
        if (px0 !== undefined && py0 !== undefined) {
          const mdx = lx - px0, mdy = ly - py0;
          if (Math.abs(mdx) > 0.005 || Math.abs(mdy) > 0.005) {
            if (Math.abs(mdx) >= Math.abs(mdy)) {
              FACING.set(def.id, mdx < 0);
              FACING_DIR.set(def.id, mdx < 0 ? "left" : "right");
            } else {
              FACING_DIR.set(def.id, mdy < 0 ? "up" : "down");
            }
          }
        }
        FACING_X.set(def.id, lx);
        FACING_Y.set(def.id, ly);
        flip = FACING.get(def.id) ?? false;
        facing = FACING_DIR.get(def.id) ?? "down";
      }
      const superior = def.kind === "monster" && obj.available && obj.superior === true;
      // A faint breathing bob for every living thing (scaled about the feet),
      // so idle creatures and NPCs read as alive rather than statuary. Phase
      // keyed per creature so a crowd doesn't inhale in unison.
      const breathing = def.kind === "npc" || def.kind === "critter" || (def.kind === "monster" && obj.available);
      if (breathing) {
        const bcx = px + TILE / 2, bfy = py + TILE - 4;
        const b = 1 + 0.016 * Math.sin(now / 620 + ((def.x * 7 + def.y * 13) % 6.28));
        g.save(); g.translate(bcx, bfy); g.scale(1, b); g.translate(-bcx, -bfy);
      }
      drawObject(g, def, obj.available, px, py, now, !!obj.wanderTarget, monsterAttack(def, obj, state, content, now), flip, superior, facing);
      if (breathing) g.restore();
      if (hp) g.restore();
    }
    } }); // end sprite draw closure
    if (def.kind === "fire" || def.kind === "furnace" || def.kind === "cauldron") {
      lights.push([px + TILE / 2, py + TILE / 2]);
    } else if (def.kind === "lamppost") {
      lights.push([px + TILE / 2, py + TILE / 2 - 10]); // glow at the lantern
    } else if (def.kind === "monster" && obj.available && (def.monster === "court_wisp" || def.monster === "storm_wisp")) {
      lights.push([px + TILE / 2, py + TILE / 2 - 4]); // the halls lit by their keepers
    } else if (def.id === "north_door") {
      lights.push([px + TILE / 2, py + TILE / 2 - 4]); // a cold seam of light under the last door
    }
    // Name label — monsters show their combat level (OSRS-style). A slain
    // monster (respawning) drops its label until it's back. Deferred (drawn on
    // top of the sorted sprites) so a name is never hidden behind a nearer body.
    if (def.kind === "npc" || (def.kind === "monster" && obj.available)) {
      const lvl = def.kind === "monster" && def.monster ? content.monsters[def.monster]?.level : undefined;
      const text = lvl !== undefined ? `${def.name} (lvl ${lvl})` : def.name;
      const cx = px + TILE / 2, yb = py - 6;
      nameLabels.push({ text, cx, yb, color: def.kind === "monster" ? "#c98" : "#cdbf9a" });
      labelBoxes.push(labelBox(text, cx, yb)); // fishing labels steer clear of names
    }
    // Fishing spots name their catch above the water (OSRS-style). Collected and
    // drawn last (with collision avoidance) so a dense estuary reads cleanly
    // instead of a bleeding wall of text. Shares the loot-labels toggle.
    if (lootLabels && def.kind === "fishing_spot") {
      const fl = state.player.skills.fishing?.level ?? 1;
      const hl = fishingHeadline(content, def, fl);
      if (hl) {
        const dx = p.x - state.player.pos.x, dy = p.y - state.player.pos.y;
        fishLabels.push({ cx: px + TILE / 2, yb: py - 6, text: hl.text, color: hl.locked ? "#b9968f" : "#9fd0d8", locked: hl.locked, dist: dx * dx + dy * dy });
      }
    }
  }

  // Boss ground-slams: the armed tiles pulse an urgent red through the windup —
  // the player's cue to STEP OFF before the detonation lands. Urgency ramps as
  // the timer runs down (faster, hotter pulsing near zero).
  for (const bdef of content.objects) {
    if (bdef.kind !== "monster") continue;
    const bobj = state.objects[bdef.id];
    const slam = bobj?.slam;
    if (!slam) continue;
    // A cleave marks an explicit swath (slam.tiles); a slam marks an (x,y)-radius
    // box. Both pulse an urgent warning — cleave in a hotter orange to read as a
    // sweeping arc you dodge sideways, slam in red as ground to step off.
    const tiles = slam.tiles ?? (() => {
      const box: { x: number; y: number }[] = [];
      for (let dy = -slam.radius; dy <= slam.radius; dy++) {
        for (let dx = -slam.radius; dx <= slam.radius; dx++) box.push({ x: slam.x + dx, y: slam.y + dy });
      }
      return box;
    })();
    const cleave = !!slam.tiles;
    for (const t of tiles) {
      if (!inRegion(t.x, t.y) || outside(t.x, t.y)) continue;
      const px = t.x * TILE - cam.x;
      const py = t.y * TILE - cam.y;
      if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
      const pulse = 0.30 + 0.22 * Math.sin(now / 90);
      g.fillStyle = cleave ? `rgba(230, 110, 30, ${pulse.toFixed(3)})` : `rgba(220, 50, 30, ${pulse.toFixed(3)})`;
      g.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      g.strokeStyle = cleave ? `rgba(255, 170, 70, ${(pulse + 0.25).toFixed(3)})` : `rgba(255, 120, 60, ${(pulse + 0.25).toFixed(3)})`;
      g.lineWidth = 2;
      g.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
    }
  }

  // A player-lit campfire (Survivalist): a transient cooking source that isn't a
  // world object, so it's drawn here from live state, culled like everything else.
  const fire = state.campfire;
  if (fire && inRegion(fire.x, fire.y) && !outside(fire.x, fire.y)) {
    const fpx = fire.x * TILE - cam.x;
    const fpy = fire.y * TILE - cam.y;
    if (fpx >= -TILE && fpy >= -TILE && fpx <= w + TILE && fpy <= h + TILE) {
      drawFire(g, fpx + TILE / 2, fpy + TILE / 2, now);
      lights.push([fpx + TILE / 2, fpy + TILE / 2]);
    }
  }

  // Your grave, if one stands. Drawn from live state like the campfire above,
  // and given a slow pulse — it is on a timer, and the one thing you need to
  // read from across a field is "still there".
  const grave = state.grave;
  if (grave && inRegion(grave.x, grave.y) && !outside(grave.x, grave.y)) {
    const gx = grave.x * TILE - cam.x + TILE / 2;
    const gy = grave.y * TILE - cam.y + TILE / 2;
    if (gx >= -TILE && gy >= -TILE && gx <= w + TILE && gy <= h + TILE) {
      drawGrave(g, gx, gy, now);
      lights.push([gx, gy]);
    }
  }

  // Agility: pulsing marker over the next obstacle to take.
  drawAgilityMarkers(g, state, content, cam, w, h, now, inRegion);

  // Baked-in home décor: windows on the outer wall + lit wall sconces, drawn for
  // whichever home the player is standing in (so a bare house still feels lived-in).
  if (region && region.y0 === INTERIOR_TOP && !backyard) {
    // Rooms not yet unlocked at this house tier sit in shadow — a clear "not
    // yours yet" read behind the boarded doorways. Compute them once, use them to
    // skip lit sconces in locked wings and to lay the shadow scrim on top.
    const locked = lockedRoomRects(state, region.x0);
    drawHomeDressing(g, region.x0, cam, now, lights, locked);
    for (const r of locked) {
      const x = (r.x0 + 1) * TILE - cam.x, y = (r.y0 + 1) * TILE - cam.y;
      g.fillStyle = "rgba(6,5,9,0.72)";
      g.fillRect(x, y, (r.x1 - r.x0 - 1) * TILE, (r.y1 - r.y0 - 1) * TILE);
    }
    // Free-placement furniture (the Homestead): everything the player has set
    // down in their home, drawn at its own tile + rotation, under the player.
    drawPlacedFurniture(g, state, content, cam, now, lights, trophy);
  }
  // The backyard paddock: a fence over the bounding wall, troughs, and every
  // companion pet you own wandering the grass — the collection log come alive.
  if (backyard && region) {
    drawBackyard(g, state, content, region, cam, now);
  }
  // Dungeon halls: sparse wall-torches so the crawls read by their own firelight.
  if (dungeon && region) {
    drawDungeonSconces(g, state, region, cam, now, lights);
  }

  // --- Other players (ghosts): translucent snapshots from the shared world,
  //     drawn under the player and culled to the current view + instance. ---
  for (const gh of ghosts) {
    if (!inRegion(Math.round(gh.x), Math.round(gh.y))) continue;
    const px = gh.x * TILE - cam.x;
    const py = gh.y * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > w + TILE || py > h + TILE) continue;
    drawGhost(g, gh, cam, now);
  }

  // --- Player --- collected as a sprite so it sorts by depth with the world.
  let playerGlow: [number, number] | null = null; // a carried light, added after bloom
  if (state.player.alive) {
    const pl = state.player;
    // Render position: interpolate the tile step (prevPos→pos) across its
    // duration so the avatar glides. `pl.pos` (the true tile) still drives facing,
    // tile look-ups and effects; only the DRAWN position is interpolated.
    const rp = interpTile(pl.prevPos, pl.pos, stepProgress(pl.stepStartTick, pl.stepDurTicks, state.tickCount, alpha));
    // Baseline at the feet, matching the object sprites, so the player slots into
    // the depth order — occluded by anything whose feet are lower on the screen.
    sprites.push({ y: rp.y * TILE + TILE - cam.y, draw: () => {
    // "Moving" for the walk cycle must stay true through the LAST tile's glide,
    // not just while more path is queued — the final step empties `path` before
    // it has finished sliding, so gating on path alone froze the legs (and cut
    // the footsteps) a tile early. prevPos != pos holds for exactly the glide
    // window and clears the instant the step settles.
    const moving = pl.path.length > 0 || pl.prevPos.x !== pl.pos.x || pl.prevPos.y !== pl.pos.y;
    // Face the next step's dominant direction (4-way); keep the last facing when
    // idle. Horizontal wins ties so a diagonal reads as a side-step, not a turn.
    if (pl.path.length > 0) {
      const dx = pl.path[0]!.x - pl.pos.x;
      const dy = pl.path[0]!.y - pl.pos.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx < -0.05) playerFacing = "left";
        else if (dx > 0.05) playerFacing = "right";
      } else {
        if (dy < -0.05) playerFacing = "up";
        else if (dy > 0.05) playerFacing = "down";
      }
    }
    const playerFaceLeft = playerFacing === "left";
    // A summoned companion trails a half-step behind the player (boss pets show
    // as a mini version of their boss). Drawn before the player so it sits behind.
    if (pl.equipment.companion) {
      const pwx = rp.x * TILE + TILE / 2;
      const pwy = rp.y * TILE + TILE / 2;
      const tx = pwx + (playerFaceLeft ? 13 : -13); // hang back, opposite the facing
      const ty = pwy + 8;
      if (petWx === null) { petWx = tx; petWy = ty; }
      petWx += (tx - petWx) * 0.16;
      petWy += (ty - petWy) * 0.16;
      drawCompanion(g, content, pl.equipment.companion, petWx - cam.x, petWy - cam.y, now, moving);
    }
    const plCx = rp.x * TILE + TILE / 2 - cam.x;
    const plCy = rp.y * TILE + TILE / 2 - cam.y;
    castShadow(g, plCx, rp.y * TILE + TILE - 4 - cam.y, sv); // sun-cast shadow
    const php = hitPop("player", now);
    if (php) {
      const cx = plCx, cy = rp.y * TILE + TILE * 0.6 - cam.y;
      g.save();
      g.translate(php.ox, php.oy);
      g.translate(cx, cy); g.scale(php.s, php.s); g.translate(-cx, -cy);
    }
    const mountId = pl.equipment.mount;
    const ownsCosmetic = (iid: string): boolean =>
      ((pl.bank as Record<string, number>)[iid] ?? 0) > 0 || pl.inventory.some((s) => s?.item === (iid as ItemId));
    drawPlayer(
      g, rp, cam, now, pl.appearance,
      moving, playerAction(pl, content, now),
      resolveGear(pl.equipment, content), playerFacing,
      mountId ? {
        id: mountId,
        gold: ownsCosmetic("saddle_gold"),
        barding: ownsCosmetic("horse_armor"),
        silver: !ownsCosmetic("saddle_gold") && ownsCosmetic("saddle_silver"),
        blanket: ownsCosmetic("mount_blanket"),
        plume: ownsCosmetic("mount_plume"),
      } : undefined,
    );
    if (php) g.restore();
    // Strike particles: at the moment a swing lands (the activity clock just
    // rolled), chips and sparks burst off the TARGET — wood chips under a
    // hatchet, stone sparks under a pick, gold-white flecks on a combat hit.
    const act = pl.activity;
    const striking = act.kind === "woodcutting" || act.kind === "mining" || act.kind === "combat";
    if (striking && act.targetId && act.actionInterval > 0) {
      const strikeT = act.nextActionAt - act.actionInterval; // when the last strike landed
      const age = now - strikeT;
      if (age >= 0 && age < 320) {
        const tdef = content.objects.find((o) => o.id === act.targetId);
        const tobj = tdef ? state.objects[tdef.id] : undefined;
        if (tdef && tobj) {
          // Interpolated so a strike spark on a stepping foe tracks its body.
          const tp = tobj.pos
            ? interpTile(tobj.prevPos, tobj.pos, stepProgress(tobj.moveStartTick ?? 0, NPC_STEP_TICKS, state.tickCount, alpha))
            : objectPos(tdef, tobj);
          const tx = tp.x * TILE + TILE / 2 - cam.x;
          const ty = tp.y * TILE + TILE / 2 - cam.y;
          const fade = 1 - age / 320;
          const kindCol = act.kind === "combat"
            ? ["#f2e2a0", "#e8c45a", "#fff6d8"]
            : tdef.kind === "tree"
              ? ["#c9a56a", "#a5824c", "#8a6a3c"]
              : ["#d8d8e0", "#b9bcc4", "#f2f2f6"];
          for (let i = 0; i < 6; i++) {
            const hh = hash(i * 7.3, Math.floor(strikeT / 100));
            const ang = -Math.PI * 0.9 + hh * Math.PI * 0.8;
            const dist = (6 + hh * 16) * (age / 320);
            const gx = tx + Math.cos(ang) * dist * 1.4;
            const gy = ty - 6 + Math.sin(ang) * dist + (age / 320) * (age / 320) * 14; // gravity
            g.globalAlpha = fade * (0.5 + 0.5 * hh);
            g.fillStyle = kindCol[i % 3]!;
            g.fillRect(gx - 1.2, gy - 1.2, 2.4, 2.4);
          }
          g.globalAlpha = 1;
        }
      }
    }
    // A warm light the player carries — added after the bloom pass so it only
    // punches a night pool (no daytime halo), via drawDaylight's light list.
    // UNIQUE — the Delver's Lantern extends the carried light into the deep
    // places: inside a dungeon its bearer walks in their own pool of light.
    const lantern = state.player.equipment.offhand === "delvers_lantern";
    if (!region || (dungeon && lantern)) playerGlow = [plCx, plCy - 4];
    if (dungeon && lantern) lights.push([plCx, plCy - 4]);
    } }); // end player sprite closure
  }

  // Depth-sorted world pass: objects, creatures and the player, drawn back-to-
  // front by their feet so nearer things paint over farther ones (and the player
  // is occluded by whatever it stands behind). A stable sort keeps content order
  // as the tiebreak for things on the same row.
  sprites.sort((a, b) => a.y - b.y);
  for (const s of sprites) s.draw();

  // Name labels, then de-cluttered fishing-spot labels — all drawn last so text
  // always sits on top of the bodies it belongs to, never behind a nearer one.
  for (const nl of nameLabels) label(g, nl.text, nl.cx, nl.yb, nl.color);
  fishLabels.sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0) || a.dist - b.dist);
  for (const fl of fishLabels) {
    const box = labelBox(fl.text, fl.cx, fl.yb);
    if (labelHits(box)) continue;
    label(g, fl.text, fl.cx, fl.yb, fl.color);
    labelBoxes.push(box);
  }

  // --- Roof canopies (OSRS-style roof-lift): draw each enterable building's
  //     roof over its whole footprint — hiding the room within — and LIFT it
  //     (skip it) the moment the player stands inside, so a smithy/bank/workshop
  //     reads as a real room you walk into through an open doorway. Drawn after
  //     the player so a raised roof still occludes everything beneath it.
  if (!region) {
    const ptx = Math.round(state.player.pos.x), pty = Math.round(state.player.pos.y);
    for (const b of ENTERABLE) {
      if (ptx >= b.x0 && ptx <= b.x1 && pty >= b.y0 && pty <= b.y1) {
        drawInteriorDressing(g, b, cam, now, lights); // inside — roof up, dress the room
        continue;
      }
      const belongs = (xx: number, yy: number) => xx >= b.x0 && xx <= b.x1 && yy >= b.y0 && yy <= b.y1;
      const door = (xx: number, yy: number) => xx === b.door.x && yy === b.door.y;
      for (let yy = b.y0; yy <= b.y1; yy++) for (let xx = b.x0; xx <= b.x1; xx++) {
        if (!inRegion(xx, yy) || outside(xx, yy)) continue;
        drawRoof(g, xx * TILE - cam.x, yy * TILE - cam.y, xx, yy, b.roof, { belongs, door });
      }
      // A smithy announces itself: a chimney breathing smoke off the forge roof.
      if (b.trade === "forge") {
        const chx = (b.x1 - 0.5) * TILE - cam.x, chTop = b.y0 * TILE - cam.y;
        g.fillStyle = "#3a3540"; g.fillRect(chx - 4, chTop - 6, 8, 12); // stack
        g.fillStyle = "#2a262f"; g.fillRect(chx - 5, chTop - 8, 10, 3); // cap
        g.save(); g.globalAlpha = 0.35;
        for (let i = 0; i < 3; i++) {
          const t = ((now / 900) + i / 3) % 1;
          const sxp = chx + Math.sin((now / 500) + i) * 4;
          g.fillStyle = "rgba(210,210,215,1)";
          g.beginPath(); g.arc(sxp, chTop - 8 - t * 26, 3 + t * 5, 0, Math.PI * 2); g.fill();
        }
        g.restore();
      }
    }
    // Hanging shop signs over every doorway (readable from the lane, roof or not).
    for (const b of ENTERABLE) {
      if (!inRegion(b.door.x, b.door.y) || outside(b.door.x, b.door.y)) continue;
      drawShopSign(g, b, cam);
    }
    // The player's homestead: a real house on its lot that grows with the house
    // tier (Cottage → Estate). Drawn after the player so you walk behind it.
    for (const h of HOMES) {
      if (!state.objects[h.plot]?.owned) continue; // unclaimed lots keep the stake
      const d = h.lot.door;
      if (!inRegion(d.x, d.y) || outside(d.x, d.y)) continue;
      const nm = content.objects.find((o) => o.id === h.plot)?.name ?? "Home";
      drawHomeExterior(g, d.x * TILE - cam.x + TILE / 2, d.y * TILE - cam.y + TILE, state.player.home.tier, now, sv.night, nm);
    }
  }

  // --- Atmosphere. Outdoors each region gets a colour wash + its own weather;
  //     a vignette frames every view. Skipped inside sealed instances (homes /
  //     arenas), which keep their own controlled look.
  const outdoor = !region || backyard; // the backyard is open-air, weather + all
  const biome = outdoor ? biomeAt(Math.round(ppos.x), Math.round(ppos.y)) : "city";
  // A soft bloom over fires and lamps (before the player's carried light, so it
  // never gets a daytime halo) — flames glow gently even by day.
  drawLightBloom(g, lights, now);
  if (playerGlow) lights.push(playerGlow); // the player's torch joins the night pools
  if (outdoor) drawBiomeGrade(g, w, h, biome);

  // --- Time of day: a slow tint cycle (skipped indoors — a home has its own
  //     warm, even light, lit by its sconces and lamps rather than the sky).
  drawDaylight(g, w, h, lights, !!region);

  // Weather sits on top of the day/night veil so snow and embers read at night;
  // the vignette is the very last layer. Fireflies and embers glow brighter
  // after dark (driven by the sun's night factor).
  if (outdoor) drawWeather(g, w, h, now, biome, sv.night);
  if (outdoor && !perfMode) drawAmbientLife(g, w, h, now, biome, sv.night, cam);
  // Draw-distance falloff: fade the last ring of the circle to the void colour so
  // the culled edge reads as a soft horizon, not a hard pixel circle. Centred on
  // the player (who isn't always screen-centre once the camera clamps at edges).
  if (drawDist !== Infinity) {
    const cxp = ppos.x * TILE - cam.x;
    const cyp = ppos.y * TILE - cam.y;
    const outer = (drawDist + 0.5) * TILE;
    const inner = Math.max(0, outer - 2.2 * TILE);
    const void0 = region ? "7,7,10" : "19,16,13";
    const grd = g.createRadialGradient(cxp, cyp, inner, cxp, cyp, outer);
    grd.addColorStop(0, `rgba(${void0},0)`);
    grd.addColorStop(1, `rgba(${void0},1)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  drawVignette(g, w, h);
}

/** The player's "trophy" — their rarest/most-valuable item — for display cases. */
function trophyGlyph(state: WorldState, content: Content): ItemDef | undefined {
  const p = state.player;
  const owned = new Set<string>();
  for (const s of p.inventory) if (s) owned.add(s.item);
  for (const k of Object.keys(p.bank)) owned.add(k);
  for (const id of Object.values(p.equipment)) if (id) owned.add(id);
  let best: ItemDef | undefined; let score = -1;
  for (const id of owned) {
    const d = content.items[id as ItemId];
    if (!d) continue;
    // Companions and high-tier gear rank as the proudest trophies; else by value.
    const s = (d.slot === "companion" ? 1e9 : 0) + (d.tier ?? 0) * 200 + (d.sell ?? 0);
    if (s > score) { score = s; best = d; }
  }
  return best;
}

/** Windows + glowing wall sconces baked into a home's rooms (decorative). */
/** The interior rects of rooms this house tier hasn't unlocked (tier > current). */
function lockedRoomRects(state: WorldState, ox: number): { x0: number; y0: number; x1: number; y1: number }[] {
  const tier = state.player.home.tier;
  if (tier >= 3) return [];
  const plan = homeLayout(ox);
  const roomTier = new Map<string, number>();
  for (const s of plan.seals) roomTier.set(s.room, s.tier);
  return plan.rooms.filter((rm) => (roomTier.get(rm.name) ?? 0) > tier);
}

function drawHomeDressing(
  g: CanvasRenderingContext2D,
  ox: number,
  cam: Camera,
  now: number,
  lights: Array<[number, number]>,
  locked: { x0: number; y0: number; x1: number; y1: number }[] = [],
): void {
  const inLocked = (tx: number, ty: number): boolean =>
    locked.some((r) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1);
  const sx = (tx: number) => tx * TILE - cam.x;
  const sy = (ty: number) => ty * TILE - cam.y;
  const fl = 0.6 + 0.4 * Math.sin(now / 240);
  // Windows on the top outer wall of the bedroom and workshop.
  for (const wx of [ox + 3, ox + 11]) {
    const x = sx(wx), y = sy(INTERIOR_TOP);
    g.fillStyle = "#3a2c1c"; g.fillRect(x + 4, y + 4, TILE - 8, TILE - 9); // frame
    g.fillStyle = "rgba(150,180,210,0.5)"; g.fillRect(x + 6, y + 6, TILE - 12, TILE - 13); // pane
    g.strokeStyle = "#3a2c1c"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x + TILE / 2, y + 6); g.lineTo(x + TILE / 2, y + TILE - 7); g.moveTo(x + 6, y + TILE / 2 - 1); g.lineTo(x + TILE - 6, y + TILE / 2 - 1); g.stroke();
  }
  // Wall sconces: one on an inner wall of each room, casting a warm pool.
  const sconces = [
    { x: ox + 7, y: INTERIOR_TOP + 3 },  // bedroom/kitchen party wall
    { x: ox + 7, y: INTERIOR_TOP + 8 },  // kitchen/living party wall
    { x: ox + 14, y: INTERIOR_TOP + 8 }, // living outer wall
    { x: ox, y: INTERIOR_TOP + 3 },      // bedroom outer wall
  ];
  for (const s of sconces) {
    if (inLocked(s.x, s.y)) continue; // a locked wing stays dark — no lit sconce
    const x = sx(s.x) + TILE / 2, y = sy(s.y) + TILE / 2;
    g.fillStyle = "#3b3e45"; g.fillRect(x - 1.5, y - 1, 3, 6); // iron bracket
    g.fillStyle = `rgba(255,200,110,${0.55 + 0.4 * fl})`; g.beginPath(); g.arc(x, y - 3, 3, 0, Math.PI * 2); g.fill();
    lights.push([x, y - 2]);
  }
}

/** A stubby barrel with two iron hoops (forge slack-tub / general prop). */
function drawBarrel(g: CanvasRenderingContext2D, x: number, y: number, r = 7): void {
  g.fillStyle = "#6b4a2c"; g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a5836"; g.fillRect(x - r, y - r * 1.2, r * 2, r * 1.2);
  g.fillStyle = "#4f371f"; g.fillRect(x - r, y - r * 1.2, r * 2, 1.5); g.fillRect(x - r, y - 2, r * 2, 1.5);
  g.fillStyle = "#3a2817"; g.beginPath(); g.ellipse(x, y - r * 1.2, r, r * 0.5, 0, 0, Math.PI * 2); g.fill();
}

/** Interior dressing for an enterable civic building, drawn while the player is
 *  inside (roof lifted): a warm floor wash + wall sconces so it reads as indoors,
 *  and trade-specific props (forge tools/coal, bank ledgers/coin, workshop lumber)
 *  so the smithy/bank/workshop feels like a real, worked-in room. */
function drawInteriorDressing(
  g: CanvasRenderingContext2D,
  b: EnterableBuilding,
  cam: Camera,
  now: number,
  lights: Array<[number, number]>,
): void {
  const sx = (tx: number) => tx * TILE - cam.x;
  const sy = (ty: number) => ty * TILE - cam.y;
  const fl = 0.6 + 0.4 * Math.sin(now / 240);

  // Warm floor wash so the lit room reads as indoors even at midday.
  const cxp = ((b.x0 + b.x1 + 1) / 2) * TILE - cam.x;
  const cyp = ((b.y0 + b.y1 + 1) / 2) * TILE - cam.y;
  const rr = (Math.max(b.x1 - b.x0, b.y1 - b.y0) + 2) * TILE * 0.6;
  g.save();
  g.globalCompositeOperation = "lighter";
  const wash = g.createRadialGradient(cxp, cyp, 8, cxp, cyp, rr);
  wash.addColorStop(0, "rgba(255,196,120,0.11)");
  wash.addColorStop(1, "rgba(255,196,120,0)");
  g.fillStyle = wash; g.beginPath(); g.arc(cxp, cyp, rr, 0, Math.PI * 2); g.fill();
  g.restore();

  // Wall sconces on the two top inner corners → warm light pools.
  for (const s of [{ x: b.x0 + 1, y: b.y0 }, { x: b.x1 - 1, y: b.y0 }]) {
    const x = sx(s.x) + TILE / 2, y = sy(s.y) + TILE - 6;
    g.fillStyle = "#3b3e45"; g.fillRect(x - 1.5, y - 1, 3, 6);
    g.fillStyle = `rgba(255,200,110,${(0.55 + 0.4 * fl).toFixed(2)})`;
    g.beginPath(); g.arc(x, y - 3, 3, 0, Math.PI * 2); g.fill();
    lights.push([x, y - 2]);
  }

  if (b.trade === "forge") {
    // Tool rack on the top wall: a hanging hammer + tongs.
    const rx = sx(b.x0 + 2) + 6, ry = sy(b.y0) + TILE - 6;
    g.strokeStyle = "#2a2018"; g.lineWidth = 2; g.beginPath(); g.moveTo(rx - 6, ry); g.lineTo(rx + 14, ry); g.stroke();
    g.fillStyle = "#8a8f98"; g.fillRect(rx - 4, ry, 3, 8); g.fillStyle = "#5a3f26"; g.fillRect(rx - 4, ry + 8, 3, 5); // hammer
    g.strokeStyle = "#8a8f98"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(rx + 8, ry); g.lineTo(rx + 6, ry + 11); g.moveTo(rx + 11, ry); g.lineTo(rx + 13, ry + 11); g.stroke(); // tongs
    // Slack-tub barrel in the far corner.
    drawBarrel(g, sx(b.x1 - 1) + 12, sy(b.y1 - 1) + 16);
    // Coal heap in the near corner.
    g.fillStyle = "#181820";
    for (let i = 0; i < 6; i++) g.fillRect(sx(b.x0 + 1) + 4 + (i % 3) * 5, sy(b.y1 - 1) + 14 + Math.floor(i / 3) * 4, 4, 3);
  } else if (b.trade === "bank") {
    // Ledger shelves on the top wall (planks with stacked books).
    for (const shx of [b.x0 + 1, b.x1 - 2]) {
      const x = sx(shx) + 4, y = sy(b.y0) + TILE - 8;
      g.fillStyle = "#4a3520"; g.fillRect(x, y, 26, 3);
      const cols = ["#7a3b2c", "#3c5a44", "#4a4a6a", "#8a6a2c"];
      for (let i = 0; i < 5; i++) { g.fillStyle = cols[i % cols.length]!; g.fillRect(x + 1 + i * 4, y - 7, 3, 7); }
    }
    // A stack of coin sacks in the corner.
    const cxp2 = sx(b.x0 + 1) + 14, cyp2 = sy(b.y1 - 1) + 18;
    g.fillStyle = "#b8935a";
    g.beginPath(); g.ellipse(cxp2, cyp2, 6, 5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cxp2 + 8, cyp2 + 1, 6, 5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cxp2 + 4, cyp2 - 6, 6, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#8a6a3a"; g.fillRect(cxp2 - 2, cyp2 - 12, 4, 3); g.fillRect(cxp2 + 6, cyp2 - 11, 4, 3);
    g.fillStyle = "#f2d878"; g.fillRect(cxp2 + 2, cyp2 - 8, 2, 2); // a glint of coin
  } else { // workshop
    // Lumber stack along a side wall (log ends).
    const lx = sx(b.x0 + 1) + 6, ly = sy(b.y1 - 1) + 12;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      g.fillStyle = "#8a6a3c"; g.beginPath(); g.arc(lx + c * 9, ly - r * 8, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#a5824c"; g.beginPath(); g.arc(lx + c * 9, ly - r * 8, 2, 0, Math.PI * 2); g.fill();
    }
    // A saw mounted on the top wall.
    const swx = sx(b.x1 - 2) + 4, swy = sy(b.y0) + TILE - 6;
    g.strokeStyle = "#c9ccd2"; g.lineWidth = 2; g.beginPath(); g.moveTo(swx, swy); g.lineTo(swx + 22, swy - 4); g.stroke();
    g.fillStyle = "#5a3f26"; g.fillRect(swx - 3, swy - 2, 5, 4);
    // Sawdust flecks near the benches.
    g.fillStyle = "rgba(205,175,115,0.55)";
    for (let i = 0; i < 8; i++) g.fillRect(sx(b.x0 + 3) + (hash(i, b.x0) * 40), sy(b.y1 - 1) + 6 + (hash(i * 3, b.y1) * 16), 2, 2);
  }
}

/** A carved hanging shop sign over a building's doorway (visible from the lane),
 *  with a small trade glyph so the smithy/bank/workshop reads at a glance. */
function drawShopSign(
  g: CanvasRenderingContext2D,
  b: EnterableBuilding,
  cam: Camera,
): void {
  const x = b.door.x * TILE + TILE / 2 - cam.x;
  // The sign hangs just below the eave, over the doorway on the lane side.
  const topDoor = b.door.y === b.y0;
  const y = (topDoor ? b.door.y * TILE : (b.door.y + 1) * TILE) - cam.y + (topDoor ? -6 : 4);
  // Bracket + board.
  g.fillStyle = "#2a2018"; g.fillRect(x - 14, y - 2, 2, 4); // bracket arm
  g.fillStyle = "#3a2c1c"; g.fillRect(x - 13, y, 26, 13);
  g.strokeStyle = "#1c150f"; g.lineWidth = 1; g.strokeRect(x - 13, y, 26, 13);
  g.strokeStyle = "#5a4630"; g.lineWidth = 1; g.strokeRect(x - 11, y + 2, 22, 9);
  // Trade glyph.
  const gx = x, gy = y + 6.5;
  if (b.trade === "forge") { // an anvil silhouette
    g.fillStyle = "#c9ccd2"; g.fillRect(gx - 6, gy - 2, 12, 3); g.fillRect(gx - 2, gy + 1, 4, 3); g.fillRect(gx - 4, gy + 4, 8, 2);
  } else if (b.trade === "bank") { // a coin
    g.fillStyle = "#f2d060"; g.beginPath(); g.arc(gx, gy + 1, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c9a020"; g.font = "bold 8px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", gx, gy + 1.5);
  } else { // crossed hammer + saw for the workshop
    g.strokeStyle = "#c9ccd2"; g.lineWidth = 2; g.beginPath(); g.moveTo(gx - 5, gy + 4); g.lineTo(gx + 5, gy - 4); g.stroke();
    g.strokeStyle = "#a5824c"; g.beginPath(); g.moveTo(gx + 5, gy + 4); g.lineTo(gx - 5, gy - 4); g.stroke();
  }
}


/**
 * Tint the whole scene by the hour. `phase` 0 = midnight, 0.5 = noon. Night lays
 * a cool dark veil (with warm pools punched out around fires); dawn and dusk add
 * a golden wash; midday is clear. Uses wall-clock time so it advances for real.
 */
function drawDaylight(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  lights: Array<[number, number]>,
  indoor = false,
): void {
  // Indoors a home has its own steady, gentle gloom lit by sconces and lamps —
  // it doesn't follow the sky, so the room is cosy at any hour.
  if (indoor) {
    g.fillStyle = `rgba(20,16,28,${(0.34 * darkFactor()).toFixed(3)})`;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    const pool = discSprite("hearth-pool", 64,
      [[0, "rgba(235,165,85,1)"], [0.06, "rgba(235,165,85,1)"], [1, "rgba(235,165,85,0)"]]);
    g.globalAlpha = 0.34;
    for (const [lx, ly] of lights) g.drawImage(pool, lx - 64, ly - 64);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    return;
  }
  const phase = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  const sun = Math.sin(phase * Math.PI * 2 - Math.PI / 2); // -1 midnight … +1 noon
  const night = Math.max(0, -sun) * 0.46 * darkFactor(); // brightness thins the veil
  const twilight = Math.max(0, 1 - Math.abs(sun) * 3) * 0.17;

  if (night > 0.01) {
    g.fillStyle = `rgba(12,16,38,${night.toFixed(3)})`;
    g.fillRect(0, 0, w, h);
    // Firelight: warm radial pools that lift the dark around hearths.
    g.globalCompositeOperation = "lighter";
    const pool = discSprite("night-pool", 70,
      [[0, "rgba(230,150,70,1)"], [0.06, "rgba(230,150,70,1)"], [1, "rgba(230,150,70,0)"]]);
    g.globalAlpha = night * 0.7;
    for (const [lx, ly] of lights) g.drawImage(pool, lx - 70, ly - 70);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
  if (twilight > 0.01) {
    g.fillStyle = `rgba(214,120,50,${twilight.toFixed(3)})`;
    g.fillRect(0, 0, w, h);
  }
}

// ---------------------------------------------------------------------------
// Atmosphere: biome colour-grading, ambient weather/particles, and a vignette.
// All screen-space and asset-free — layered over the painted world to give each
// region its own mood.
// ---------------------------------------------------------------------------

type Biome = "spine" | "marrow" | "redrun" | "ashfen" | "heartmoor" | "greyoak" | "city" | "hills";

/** Which region the player is standing in (drives grading + which weather runs).
 *  Exported for the audio engine, which keys its ambient scene off the same map. */
export function biomeAt(x: number, y: number): Biome {
  for (const r of REGIONS) {
    if (x >= r.nx && x < r.nx + r.w && y >= r.ny && y < r.ny + r.h) return r.key as Biome;
  }
  if (x >= CITY.x0 && x <= CITY.x1 && y >= CITY.y0 && y <= CITY.y1) return "city";
  return "hills";
}

/** Cheap stable hash → [0,1), for stateless particle fields. */
function frac(n: number): number { const v = Math.sin(n) * 43758.5453; return v - Math.floor(v); }

/** A translucent wash that tints a whole region toward its character. */
function drawBiomeGrade(g: CanvasRenderingContext2D, w: number, h: number, b: Biome): void {
  const tint: Partial<Record<Biome, string>> = {
    spine: "rgba(150,180,225,0.10)",     // cold blue light off the snow
    marrow: "rgba(24,18,40,0.26)",        // deep cave gloom
    redrun: "rgba(60,110,135,0.07)",      // cool river air
    ashfen: "rgba(214,120,50,0.09)",      // warm geothermal haze
    heartmoor: "rgba(44,72,56,0.12)",     // murky moor green
    greyoak: "rgba(30,58,36,0.12)",       // deep forest shade
  };
  const t = tint[b];
  if (!t) return;
  g.fillStyle = t;
  g.fillRect(0, 0, w, h);
}

/** Per-biome ambient weather/particles, animated by wall-clock `now`. `night`
 *  (0 by day … 1 at midnight) makes glowing motes read brighter after dark. */
function drawWeather(g: CanvasRenderingContext2D, w: number, h: number, now: number, b: Biome, night = 0): void {
  // Passing showers over the green country: deterministic 5-minute weather
  // windows (hash of the wall-clock window index), so rain arrives, soaks the
  // hills for a few minutes, and moves on — with the rare white crack of
  // lightning at the height of a storm.
  if (b === "city" || b === "hills" || b === "greyoak" || b === "redrun") {
    const win = Math.floor(Date.now() / 300_000);
    const wet = frac(win * 17.31 + (b === "city" ? 0.13 : b === "hills" ? 0.41 : b === "greyoak" ? 0.67 : 0.89));
    if (wet > 0.62) {
      const heavy = wet > 0.85;
      const drops = heavy ? 110 : 60;
      g.strokeStyle = `rgba(180,205,230,${heavy ? 0.38 : 0.26})`;
      g.lineWidth = 1.1;
      g.beginPath();
      for (let i = 0; i < drops; i++) {
        const sp = 260 + frac(i * 3.7) * 160;
        const x = (frac(i * 12.9) * (w + 60) + now * 28 / 1000) % (w + 60) - 30;
        const y = ((frac(i * 7.7) * h + now * sp / 1000) % (h + 24)) - 12;
        g.moveTo(x, y);
        g.lineTo(x - 2.4, y + 7.5);
      }
      g.stroke();
      // splash ticks on the ground
      g.fillStyle = "rgba(190,215,235,0.22)";
      for (let i = 0; i < (heavy ? 26 : 12); i++) {
        const x = (frac(i * 5.3) * w + now * 11 / 1000) % w;
        const y = (frac(i * 9.1) * h + now * 17 / 1000) % h;
        const ph = (now / 260 + i) % 1;
        g.beginPath(); g.ellipse(x, y, 2 + ph * 3, 0.8 + ph, 0, 0, Math.PI * 2); g.fill();
      }
      // a storm's lightning: a rare frame-long white wash
      if (heavy && Math.sin(now / 90) > 0 && frac(Math.floor(now / 4200) * 3.3) > 0.86) {
        g.fillStyle = "rgba(235,240,255,0.16)";
        g.fillRect(0, 0, w, h);
      }
    }
  }
  switch (b) {
    case "spine": { // drifting snow
      g.fillStyle = "rgba(240,247,255,0.85)";
      for (let i = 0; i < 80; i++) {
        const sp = 16 + frac(i * 1.7) * 26;
        const drift = Math.sin(now / 1400 + i) * 14;
        const x = (frac(i * 12.9) * (w + 40) + drift) % (w + 40) - 20;
        const y = ((frac(i * 7.1) * h + now * sp / 1000) % (h + 20)) - 10;
        const s = 1 + frac(i * 3.3) * 1.8;
        g.globalAlpha = 0.35 + 0.5 * frac(i * 5.5);
        g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      break;
    }
    case "ashfen": { // embers rising on the heat
      for (let i = 0; i < 46; i++) {
        const sp = 20 + frac(i * 2.3) * 30;
        const sway = Math.sin(now / 700 + i * 2) * 10;
        const x = (frac(i * 9.7) * w + sway + w) % w;
        const y = h - ((now * sp / 1000 + frac(i * 4.2) * h) % (h + 16)) + 8;
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now / 200 + i));
        g.fillStyle = frac(i * 6.1) > 0.5 ? `rgba(255,150,60,${(0.5 * tw).toFixed(2)})` : `rgba(255,90,40,${(0.45 * tw).toFixed(2)})`;
        g.beginPath(); g.arc(x, y, 1 + frac(i * 8.8) * 1.6, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "heartmoor": { // low mist banks drifting across
      g.globalCompositeOperation = "lighter";
      const bank = discSprite("mist-bank", 64, [[0, "rgba(170,190,180,1)"], [1, "rgba(170,190,180,0)"]]);
      g.globalAlpha = 0.05;
      for (let i = 0; i < 9; i++) {
        const r = 60 + frac(i * 2.9) * 80;
        const x = ((frac(i * 5.3) * (w + 300) + now * (6 + frac(i) * 6) / 1000)) % (w + 300) - 150;
        const y = frac(i * 8.1) * h;
        g.drawImage(bank, x - r, y - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      break;
    }
    case "greyoak": { // floating motes by day, glowing fireflies after dark
      const glow = 0.4 + 0.6 * night; // brighter, warmer once the sun is down
      g.globalCompositeOperation = night > 0.3 ? "lighter" : "source-over";
      for (let i = 0; i < 34; i++) {
        const x = (frac(i * 11.3) * w + Math.sin(now / 1800 + i) * 18 + w) % w;
        const y = (frac(i * 6.7) * h + Math.cos(now / 2100 + i * 1.5) * 14 + h) % h;
        const tw = 0.5 + 0.5 * Math.sin(now / 500 + i * 3);
        const a = (0.10 + 0.32 * tw) * glow;
        // A warm firefly core with a soft halo at night.
        if (night > 0.3) {
          const halo = discSprite("wood-firefly", 5, [[0, "rgba(240,236,140,1)"], [1, "rgba(240,236,140,0)"]]);
          g.globalAlpha = a * 0.9;
          g.drawImage(halo, x - 5, y - 5);
          g.globalAlpha = 1;
        }
        g.fillStyle = `rgba(235,238,${night > 0.3 ? 170 : 150},${a.toFixed(2)})`;
        g.beginPath(); g.arc(x, y, 1.4, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = "source-over";
      break;
    }
    case "marrow": { // faint cyan glow motes drifting up in the dark
      for (let i = 0; i < 22; i++) {
        const sp = 6 + frac(i * 3.1) * 10;
        const x = (frac(i * 10.1) * w + Math.sin(now / 1600 + i) * 8 + w) % w;
        const y = h - ((now * sp / 1000 + frac(i * 5.9) * h) % (h + 12));
        const tw = 0.5 + 0.5 * Math.sin(now / 600 + i * 2);
        g.fillStyle = `rgba(120,200,210,${(0.12 + 0.30 * tw).toFixed(2)})`;
        g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "redrun": { // sparse spray sparkle off the river
      g.fillStyle = "rgba(210,235,245,0.5)";
      for (let i = 0; i < 16; i++) {
        const x = (frac(i * 13.7) * w + Math.sin(now / 1300 + i) * 10 + w) % w;
        const y = (frac(i * 9.3) * h + Math.cos(now / 1500 + i) * 8 + h) % h;
        g.globalAlpha = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(now / 350 + i * 4));
        g.beginPath(); g.arc(x, y, 1, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      break;
    }
    default: break; // city / hills: clear air
  }
}

/** Butterfly wing colours — a flutter of life over the meadows by day. */
const BUTTERFLY = ["#e8d24a", "#e07a3a", "#d9637a", "#cf6fc0", "#6f9ad6"];

/**
 * Ambient living motion layered over the world: flocks of birds gliding across
 * the open sky, and butterflies fluttering low over the meadows by day. Pure
 * screen-space dressing — deterministic from the clock, no objects involved.
 */
function drawAmbientLife(g: CanvasRenderingContext2D, w: number, h: number, now: number, b: Biome, night: number, cam: Camera): void {
  // --- Birds: a small flock that glides across every so often (not underground). ---
  if (b !== "marrow") {
    const period = 15000; // a flock crosses roughly every 15s
    const fp = (now % period) / period;
    if (fp < 0.62) {
      const cross = fp / 0.62;            // 0 → 1 across the view
      const dir = (Math.floor(now / period) % 2) ? 1 : -1; // alternate L→R / R→L
      const baseX = dir > 0 ? -50 + cross * (w + 100) : w + 50 - cross * (w + 100);
      const baseY = 40 + (frac(Math.floor(now / period) * 3.7)) * h * 0.28;
      const flap = Math.sin(now / 130);
      g.strokeStyle = `rgba(40,44,54,${(0.5 * (1 - night * 0.5)).toFixed(2)})`;
      g.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        const bx = baseX - dir * (i * 16 + (i % 2) * 8);
        const by = baseY + (i % 2 ? 10 : 0) + (i === 2 ? -6 : 0);
        const wing = 4 + 1.5 * flap;
        g.beginPath();
        g.moveTo(bx - 6, by + (i % 2 ? 1 : 0));
        g.lineTo(bx, by - wing);
        g.lineTo(bx + 6, by + (i % 2 ? 1 : 0));
        g.stroke();
      }
    }
  }

  // --- Butterflies: fluttering over grassy country by day. Anchored to the WORLD
  //     (per coarse cell), not the screen, so they stay put as you walk past
  //     instead of sliding with the camera. Each wanders within its own cell. ---
  const day = 1 - night;
  if (day > 0.2 && (b === "hills" || b === "greyoak" || b === "heartmoor" || b === "city")) {
    const t = now / 1000;
    // Sample cells on a FIXED world grid (snapped to multiples of 3, with a
    // margin), NOT relative to the view edge — otherwise the set of sampled
    // cells shifts as the camera moves and butterflies pop in and out each step.
    const c0x = Math.floor(cam.x / TILE) - 3, c1x = Math.ceil((cam.x + w) / TILE) + 3;
    const c0y = Math.floor(cam.y / TILE) - 3, c1y = Math.ceil((cam.y + h) / TILE) + 3;
    const sx = Math.floor(c0x / 3) * 3, sy = Math.floor(c0y / 3) * 3;
    g.save();
    g.globalAlpha = 0.7 * day;
    for (let cy = sy; cy <= c1y; cy += 3) {
      for (let cx = sx; cx <= c1x; cx += 3) {
        const seed = frac(cx * 1.73 + cy * 3.11);
        if (seed > 0.16) continue; // sparse — only a few cells host one
        // World position: cell origin + a fixed in-cell offset + a slow wander.
        const wx = cx * TILE + frac(cx * 5 + cy) * TILE * 2.5 + Math.sin(t * 0.7 + seed * 40) * 16;
        const wy = cy * TILE + frac(cy * 5 + cx) * TILE * 2.5 + Math.cos(t * 0.9 + seed * 30) * 13;
        const x = wx - cam.x, y = wy - cam.y;
        const open = 0.4 + 0.6 * Math.abs(Math.sin(t * 7 + seed * 25)); // wings beating
        g.fillStyle = BUTTERFLY[Math.floor(seed * 100) % BUTTERFLY.length]!;
        g.beginPath(); g.ellipse(x - 2, y, 2.4 * open, 2.0, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(x + 2, y, 2.4 * open, 2.0, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(30,24,20,0.8)";
        g.fillRect(x - 0.5, y - 2, 1, 4); // body
      }
    }
    g.restore();
  }
}

/**
 * Ambient water wildlife on the surface: shark fins cruising the ocean, whales
 * surfacing to blow far out at sea, and fish leaping in the lakes and rivers.
 * World-anchored per coarse cell (seeded like the butterflies) and deterministic
 * from the clock, so a fin stays put in the water as the camera slides past. Pure
 * dressing — no objects, no interaction. Fins/whales ride the "deep" (open
 * ocean); leaping fish ride the shallow "water" (rivers, lakes, coast).
 */
function drawWaterLife(
  g: CanvasRenderingContext2D,
  map: WorldMap,
  cam: Camera,
  minX: number, maxX: number, minY: number, maxY: number,
  now: number,
  inRegion: (x: number, y: number) => boolean,
  outside: (x: number, y: number) => boolean,
): void {
  const t = now / 1000;
  const tileAt = (x: number, y: number): TileType | null =>
    (x < 0 || y < 0 || x >= map.width || y >= map.height) ? null : map.tiles[y * map.width + x]!;
  const STEP = 4; // coarse cells — water features are big and sparse
  for (let cy = minY - (minY % STEP); cy <= maxY; cy += STEP) {
    for (let cx = minX - (minX % STEP); cx <= maxX; cx += STEP) {
      if (!inRegion(cx, cy) || outside(cx, cy)) continue;
      const tile = tileAt(cx, cy);
      if (tile !== "water" && tile !== "deep") continue;
      const seed = frac(cx * 1.93 + cy * 4.27);
      const ax = cx * TILE - cam.x, ay = cy * TILE - cam.y;

      if (tile === "deep") {
        // Whale: a big dark back rises out in the deep, DRIFTS as it swims (so it
        // never resurfaces in the exact same spot), throws a tall bright spout,
        // then sounds again. The set of active whale-cells slowly rotates over
        // time (`epoch`), so sightings move around the sea rather than repeating
        // in one place. Non-active deep cells fall through to the shark fins.
        const cellHash = frac(cx * 2.71 + cy * 6.13);
        const epoch = Math.floor(now / 42000);
        const active = frac(cx * 2.71 + cy * 6.13 + epoch * 3.71) < 0.16;
        if (active) {
          const period = 11000 + cellHash * 60000;
          const ph = ((now + cellHash * 300000) % period) / period;
          if (ph < 0.3) {
            const s = ph / 0.3;
            const rise = Math.sin(s * Math.PI); // surface → sound
            const dir = cellHash > 0.08 ? 1 : -1;
            // Swim across ~4 tiles over the surfacing, with a gentle bob.
            const wx = ax + TILE * 1.5 + dir * (s - 0.5) * TILE * 4;
            const wy = ay + TILE * 2 - rise * 6 + Math.sin(t * 0.3 + cellHash * 12) * 2;
            g.fillStyle = "#33414e";
            g.beginPath(); g.ellipse(wx, wy, 27, 8 + rise * 6, 0, Math.PI, 0); g.fill();
            g.fillStyle = "#465969"; // paler ridge along the back
            g.beginPath(); g.ellipse(wx, wy - 1, 18, 4 + rise * 4, 0, Math.PI, 0); g.fill();
            if (rise > 0.4) { // the blow — a tall bright spout
              const sx = wx - dir * 12, sy = wy - 6;
              g.strokeStyle = `rgba(224,238,248,${(0.75 * rise).toFixed(2)})`;
              g.lineWidth = 2; g.lineCap = "round";
              for (const dx of [-4.5, 0, 4.5]) {
                g.beginPath(); g.moveTo(sx, sy);
                g.quadraticCurveTo(sx + dx, sy - 15, sx + dx * 1.9, sy - 24); g.stroke();
              }
              g.lineCap = "butt";
            }
          }
          continue;
        }
        // Shark fin: a dorsal fin cutting a bright V-wake across the deep, fading
        // in and out at the ends of its run.
        if (seed < 0.3) {
          const period = 10000 + seed * 26000;
          const ph = ((now + seed * 50000) % period) / period;
          if (ph < 0.84) {
            const glide = ph / 0.84;
            const dir = seed > 0.1 ? 1 : -1;
            const fx = ax + TILE * 1.5 + dir * (glide - 0.5) * TILE * 3.2;
            const fy = ay + TILE * 2 + Math.sin(t * 0.6 + seed * 20) * 4;
            const fade = Math.min(1, Math.min(glide, 1 - glide) * 6);
            g.save();
            g.globalAlpha = fade;
            g.strokeStyle = "rgba(206,226,238,0.5)"; g.lineWidth = 1.4; // bright wake
            g.beginPath(); g.moveTo(fx - dir * 4, fy + 3); g.lineTo(fx - dir * 24, fy - 5); g.stroke();
            g.beginPath(); g.moveTo(fx - dir * 4, fy + 3); g.lineTo(fx - dir * 24, fy + 11); g.stroke();
            g.fillStyle = "#4a5a69"; // slate fin, light enough to read at night
            g.beginPath();
            g.moveTo(fx - dir * 8, fy + 4);
            g.quadraticCurveTo(fx + dir * 2, fy - 13, fx + dir * 7, fy + 4);
            g.closePath(); g.fill();
            g.strokeStyle = "rgba(214,228,238,0.6)"; g.lineWidth = 1; // lit leading edge
            g.beginPath(); g.moveTo(fx + dir * 7, fy + 4); g.quadraticCurveTo(fx + dir * 4.5, fy - 8, fx + dir * 1, fy - 8); g.stroke();
            g.restore();
          }
          continue;
        }
      } else {
        // Leaping fish (rivers + lakes): a bright silver arc that stays OVER the
        // water tile it belongs to — the splash never strays onto the bank. Only
        // a slowly-rotating slice of water cells are active at once, and each
        // leaps on a long, jittered cycle, so jumps are occasional and never
        // repeat in the same spot.
        const epoch = Math.floor(now / 30000);
        if (frac(cx * 3.1 + cy * 5.7 + epoch * 2.3) >= 0.16) continue; // inactive cell
        const period = 9000 + seed * 11000; // 9–20s between leaps
        const ph = ((now + seed * 12000) % period) / period;
        if (ph < 0.2) {
          const jp = ph / 0.2;
          const arc = Math.sin(jp * Math.PI);
          const dir = seed > 0.17 ? 1 : -1;
          // A fresh jitter each leap (by cycle index) keeps the splash within the
          // water tile (±~0.25 tile) yet in a different spot every time.
          const cycle = Math.floor((now + seed * 12000) / period);
          const jx = ax + TILE * 0.5 + (frac(cx * 7 + cy + cycle * 1.7) - 0.5) * TILE * 0.5;
          const jy = ay + TILE * 0.55 + (frac(cy * 7 + cx + cycle * 2.3) - 0.5) * TILE * 0.4;
          const fx = jx + (jp - 0.5) * 12 * dir;
          const fy = jy - arc * 22;
          if (jp < 0.28 || jp > 0.72) {
            const k = jp < 0.28 ? 1 - jp / 0.28 : (jp - 0.72) / 0.28;
            g.strokeStyle = `rgba(214,232,244,${(0.72 * k).toFixed(2)})`;
            g.lineWidth = 1.3;
            const rr = 3 + (1 - k) * 7;
            const rx = jp < 0.28 ? jx - 6 * dir : jx + 6 * dir;
            g.beginPath(); g.ellipse(rx, jy, rr, rr * 0.4, 0, 0, Math.PI * 2); g.stroke();
          }
          g.save();
          g.translate(fx, fy); g.rotate((jp - 0.5) * 1.3 * dir);
          g.fillStyle = "#c6d2dc"; // bright silver body
          g.beginPath(); g.ellipse(0, 0, 6, 2.4, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#eff5fa"; // a white glint along the flank
          g.beginPath(); g.ellipse(-1, -0.7, 2.6, 1, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#95a4b2"; // tail
          g.beginPath(); g.moveTo(-6 * dir, 0); g.lineTo(-11 * dir, -3); g.lineTo(-11 * dir, 3); g.closePath(); g.fill();
          g.restore();
        }
      }
    }
  }
}

/** A soft darkened frame so the eye settles to the centre of the action. */
function drawVignette(g: CanvasRenderingContext2D, w: number, h: number): void {
  const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, `rgba(8,6,12,${(0.34 * darkFactor()).toFixed(3)})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
}

/** A farming patch: bare tilled soil, a growing sprout, or a ripe crop. */
function drawPatch(
  g: CanvasRenderingContext2D,
  crop: string | undefined,
  plantedAt: number | undefined,
  content: Content,
  px: number,
  py: number,
): void {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  // Tilled soil bed.
  g.fillStyle = "#3f2e20";
  g.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
  g.strokeStyle = "rgba(0,0,0,0.3)";
  g.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(px + 5, py + 5 + i * (TILE - 10) / 4);
    g.lineTo(px + TILE - 5, py + 5 + i * (TILE - 10) / 4);
    g.stroke();
  }
  const def = crop ? content.crops[crop] : undefined;
  if (!def || plantedAt === undefined) return;
  const elapsed = Date.now() - plantedAt;
  const frac = Math.max(0, Math.min(1, elapsed / def.growthMs));
  const ripe = frac >= 1;
  if (ripe) {
    // A soft gold ring marks a patch ready to harvest.
    g.strokeStyle = "rgba(242,207,107,0.8)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, TILE * 0.42, 0, Math.PI * 2);
    g.stroke();
  }
  // A drawn plant that grows with maturity — a sprout that bushes out, or a
  // sapling that fills into a tree. Greens (no emoji), with ripe fruit/bloom
  // dots tinted per crop so patches read apart at a glance.
  const isTree = def.type === "tree";
  let hsh = 0;
  for (let i = 0; i < (crop ?? "").length; i++) hsh = (hsh * 31 + (crop as string).charCodeAt(i)) >>> 0;
  const grow = 0.4 + frac * 0.6;
  const baseY = cy + TILE * 0.2;
  const stalk = (isTree ? TILE * 0.52 : TILE * 0.34) * grow;
  const topY = baseY - stalk;
  const leafR = (isTree ? TILE * 0.27 : TILE * 0.17) * grow;
  g.globalAlpha = ripe ? 1 : 0.7 + frac * 0.3;
  // stem / trunk
  g.strokeStyle = isTree ? "#6b4a2c" : "#4f7a3a";
  g.lineWidth = isTree ? 3.2 * grow : 2;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx, baseY);
  g.lineTo(cx, topY + leafR * 0.4);
  g.stroke();
  // foliage — a few overlapping leaf blobs, hue nudged per crop
  const hue = (isTree ? 105 : 95) + (hsh % 40) - 20;
  g.fillStyle = `hsl(${hue} 38% ${isTree ? 30 : 38}%)`;
  for (const [dx, dy, rr] of [[0, -leafR * 0.35, leafR], [-leafR * 0.62, leafR * 0.2, leafR * 0.72], [leafR * 0.62, leafR * 0.2, leafR * 0.72]] as const) {
    g.beginPath();
    g.arc(cx + dx, topY + dy, rr, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = `hsl(${hue} 40% ${isTree ? 42 : 52}%)`;
  g.beginPath();
  g.arc(cx - leafR * 0.3, topY - leafR * 0.35, leafR * 0.5, 0, Math.PI * 2);
  g.fill();
  // ripe fruit / blossoms
  if (ripe) {
    g.fillStyle = `hsl(${(hsh % 360)} 62% 58%)`;
    const dots = isTree ? 4 : 3;
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2 + (hsh % 7);
      g.beginPath();
      g.arc(cx + Math.cos(a) * leafR * 0.6, topY + Math.sin(a) * leafR * 0.55, 2.1, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
}

/** Last seen world-x + current facing per creature, so a monster keeps facing
 *  the way it last walked instead of snapping back between wander legs. */
const FACING_X = new Map<string, number>();
const FACING = new Map<string, boolean>(); // true = mirrored (walking -x)
// Last seen world-y and 4-way heading, for townsfolk NPCs that turn up/down too.
const FACING_Y = new Map<string, number>();
const FACING_DIR = new Map<string, Facing>();

function drawObject(
  g: CanvasRenderingContext2D,
  def: WorldObjectDef,
  available: boolean,
  px: number,
  py: number,
  now: number,
  moving = false,
  attack?: MonsterAttack,
  flip = false,
  superior = false,
  facing: Facing = "down",
): void {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  switch (def.kind) {
    case "tree": {
      // Trees read taller now — scaled up about their base so canopies loom over
      // the player instead of matching them tile-for-tile.
      const s = def.species === "greyoak" ? 1.5 : def.species === "coldpine" ? 1.45 : 1.35;
      const foot = cy + 11;
      g.save();
      g.translate(cx, foot); g.scale(s, s); g.translate(-cx, -foot);
      drawTree(g, cx, cy, available, def.species);
      g.restore();
      break;
    }
    case "rock": {
      const foot = cy + 8;
      g.save();
      g.translate(cx, foot); g.scale(1.15, 1.15); g.translate(-cx, -foot);
      drawRock(g, cx, cy, available, def.resource);
      g.restore();
      break;
    }
    case "fishing_spot":
      drawFishingSpot(g, cx, cy, now);
      break;
    case "npc":
      drawNpc(g, cx, cy, now, moving, def.x, def.y, facing);
      break;
    case "monster": {
      // A SUPERIOR reads a screen away: a pulsing gold ground-ring, and the
      // whole creature drawn half again its size about the ground line.
      if (superior && available) {
        const pulse = 0.5 + Math.sin(now / 220) * 0.15;
        const grad = g.createRadialGradient(cx, cy + 12, 2, cx, cy + 12, 26);
        grad.addColorStop(0, `rgba(240, 200, 90, ${0.4 * pulse})`);
        grad.addColorStop(1, "rgba(240, 200, 90, 0)");
        g.fillStyle = grad;
        g.beginPath(); g.ellipse(cx, cy + 12, 26, 12, 0, 0, Math.PI * 2); g.fill();
      }
      g.save();
      if (flip) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); }
      if (superior && available) {
        const foot = cy + 14;
        g.translate(cx, foot); g.scale(1.45, 1.45); g.translate(-cx, -foot);
      }
      drawMonster(g, def.monster, available, cx, cy, now, moving, attack);
      g.restore();
      break;
    }

    case "shrine":
      drawShrine(g, cx, cy);
      break;
    case "bank":
      scaled(g, cx, cy, 1.35, () => drawBank(g, 0, 0));
      break;
    case "grand_exchange":
      drawGrandExchange(g, cx, cy);
      break;
    case "fire":
      drawFire(g, cx, cy, now);
      break;
    case "furnace":
      scaled(g, cx, cy, 1.4, () => drawFurnace(g, 0, 0, now));
      break;
    case "anvil":
      scaled(g, cx, cy, 1.35, () => drawAnvil(g, 0, 0));
      break;
    case "portal":
      if (def.dungeon === "ironvale_sewers") { drawSewerLid(g, cx, cy, now); break; }
      if (DUNGEON_MOUTHS[def.id]) { drawDungeonMouth(g, cx, cy, def.id); break; }
      drawPortal(g, cx, cy);
      break;
    case "trap":
      drawTrap(g, cx, cy, available);
      break;
    case "bounty_board":
      drawBountyBoard(g, cx, cy);
      break;
    case "forage_spot":
      drawForageSpot(g, cx, cy, available, def.resource);
      break;
    case "cauldron":
      scaled(g, cx, cy, 1.3, () => drawCauldron(g, 0, 0, now));
      break;
    case "workbench":
      scaled(g, cx, cy, 1.3, () => drawWorkbench(g, 0, 0));
      break;
    case "crafting_table":
      scaled(g, cx, cy, 1.3, () => drawCraftingTable(g, 0, 0));
      break;
    case "cart":
      drawCart(g, cx, cy);
      break;
    case "stall":
      drawStall(g, cx, cy, def.id);
      break;
    case "bone_cairn":
      drawBoneCairn(g, cx, cy, def.id);
      break;
    case "fountain":
      drawFountain(g, cx, cy, now);
      break;
    case "sawmill":
      scaled(g, cx, cy, 1.3, () => drawSawmill(g, 0, 0));
      break;
    case "critter":
      // A per-critter phase from its world tile (camera-independent) so the idle
      // bob animates in place instead of vibrating as the camera pans past.
      drawCritter(g, def.species, cx, cy, now, (def.x * 7 + def.y * 13) % 6.28);
      break;
    case "lamppost":
      drawLamppost(g, cx, cy);
      break;
    case "fence":
      drawFence(g, cx, cy, def.species === "v" ? "v" : "h");
      break;
    case "boat":
      drawBoat(g, cx, cy, now);
      break;
    case "reeds":
      drawReeds(g, cx, cy, now, def.id.length);
      break;
    case "deadfall":
      drawDeadfall(g, cx, cy, def.species === "snag" ? "snag" : "log");
      break;
    case "signpost":
      if (def.id === "duel_board") drawDuelRing(g, cx, cy, now);
      else if (def.id === "duel_wins_board") drawWinsBoard(g, cx, cy);
      else scaled(g, cx, cy, 1.4, () => drawSignpost(g, 0, 0));
      break;
    case "banner":
      drawBanner(g, cx, cy, def.tint ?? "#8a3b3b", now, (def.x * 5 + def.y * 11) % 6.28);
      break;
    case "waystone":
      drawWaystone(g, cx, cy, now);
      break;
    case "agility_obstacle":
      drawObstacle(g, def.obstacle, cx, cy);
      break;
    case "relic":
      drawRelic(g, cx, cy, now);
      break;
    case "house_door":
      drawHouseDoor(g, cx, cy);
      break;
    case "pier_spot":
      drawPierSpot(g, cx, cy, now);
      break;
    case "record_board":
      drawRecordBoard(g, cx, cy);
      break;
    case "trail_board":
      drawTrailBoard(g, cx, cy);
      break;
    case "pier_gate":
      drawPierGate(g, cx, cy);
      break;
  }
}

/** The Duel Ring: a chalked stone circle with two crossed-sword banner posts,
 *  reading unmistakably as a fighting pit rather than a road sign. */
function drawDuelRing(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  shadow(g, cx, cy + 10, 20, 6);
  // The chalked ring on the ground (a flattened ellipse for the ground plane).
  g.save();
  g.translate(cx, cy + 4);
  g.scale(1, 0.5);
  g.strokeStyle = "rgba(232,220,180,0.85)";
  g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "rgba(201,162,74,0.45)";
  g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.stroke();
  g.restore();
  // A banner post at the back with a crossed-swords pennant.
  g.fillStyle = "#3a2c1e";
  g.fillRect(cx - 1, cy - 20, 2.2, 24);
  const wave = Math.sin(now / 380) * 1.6;
  g.fillStyle = "#7a2230";
  g.beginPath();
  g.moveTo(cx + 1, cy - 20);
  g.lineTo(cx + 14 + wave, cy - 17);
  g.lineTo(cx + 1, cy - 10);
  g.closePath();
  g.fill();
  // Two little crossed swords on the pennant.
  g.strokeStyle = "#e8dcb4";
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(cx + 4, cy - 18); g.lineTo(cx + 9, cy - 13);
  g.moveTo(cx + 9, cy - 18); g.lineTo(cx + 4, cy - 13);
  g.stroke();
  // A finial cap on the post.
  g.fillStyle = "#c9a24a";
  g.beginPath(); g.arc(cx, cy - 20, 1.8, 0, Math.PI * 2); g.fill();
}

/** The Wins Board beside the ring: a planked standings board on two posts with a
 *  crossed-swords crest — the public duel ledger. */
function drawWinsBoard(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 13, 4);
  g.fillStyle = "#3a2c1e"; // two posts
  g.fillRect(cx - 11, cy - 6, 2.4, 18);
  g.fillRect(cx + 8.6, cy - 6, 2.4, 18);
  // The board face.
  g.fillStyle = "#4a3826";
  g.fillRect(cx - 13, cy - 20, 26, 17);
  g.strokeStyle = "#2a2016"; g.lineWidth = 1.5;
  g.strokeRect(cx - 13, cy - 20, 26, 17);
  // Chalked standings lines.
  g.strokeStyle = "rgba(232,220,180,0.7)"; g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = cy - 16 + i * 3.4;
    g.beginPath(); g.moveTo(cx - 10, y); g.lineTo(cx + 6, y); g.stroke();
  }
  // A crossed-swords crest on the header.
  g.strokeStyle = "#c9a24a"; g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - 4, cy - 25); g.lineTo(cx + 3, cy - 20);
  g.moveTo(cx + 3, cy - 25); g.lineTo(cx - 4, cy - 20);
  g.stroke();
}

/** The Varathian Trail's billboard: a tall standings board topped with a green
 *  runner's pennant, distinct from the pier's brass records board. */
function drawTrailBoard(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.fillStyle = "#3a2c1e"; // two stout posts
  g.fillRect(cx - 11, cy - 6, 2.4, 18);
  g.fillRect(cx + 8.6, cy - 6, 2.4, 18);
  g.fillStyle = "#7a5a36"; // the board face
  g.fillRect(cx - 12, cy - 15, 24, 16);
  g.strokeStyle = "#3a2c1e"; g.lineWidth = 1.2; g.strokeRect(cx - 12, cy - 15, 24, 16);
  // Chalked tally rows.
  g.strokeStyle = "rgba(230,226,208,0.7)"; g.lineWidth = 1;
  for (const yy of [-11, -8, -5, -2]) { g.beginPath(); g.moveTo(cx - 9, cy + yy); g.lineTo(cx + 9, cy + yy); g.stroke(); }
  // A green runner's pennant on the crown.
  g.fillStyle = "#2f7d5a";
  g.beginPath(); g.moveTo(cx - 2, cy - 15); g.lineTo(cx - 2, cy - 23); g.lineTo(cx + 8, cy - 19.5); g.closePath(); g.fill();
  g.fillStyle = "#6fce9c"; g.beginPath(); g.arc(cx - 2, cy - 23, 1.4, 0, Math.PI * 2); g.fill();
}

/** The deep-water cast point at the pier's end: a moored buoy bobbing over wide,
 *  dark ripples — visibly different from a shallow fishing spot. */
function drawPierSpot(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const t = now / 1000;
  g.strokeStyle = "rgba(120,170,200,0.5)";
  g.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const r = 5 + ((t * 7 + i * 5) % 13);
    g.globalAlpha = Math.max(0, 1 - r / 14) * 0.7;
    g.beginPath();
    g.ellipse(cx, cy + 2, r, r * 0.5, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  const bob = Math.sin(t * 2) * 1.5;
  // A red-and-white marker buoy.
  g.fillStyle = "#c64a3a";
  g.beginPath(); g.arc(cx, cy + bob, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e8e2d0";
  g.fillRect(cx - 4, cy - 0.5 + bob, 8, 1.6);
  g.strokeStyle = "#2a2622"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx, cy + bob - 4); g.lineTo(cx, cy + bob - 8); g.stroke();
}

/** The pier's records board: a planked board on posts with a chalked top line. */
function drawRecordBoard(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = "#4a3a2a";
  g.fillRect(cx - 9, cy - 4, 2, 14); // posts
  g.fillRect(cx + 7, cy - 4, 2, 14);
  g.fillStyle = "#7a5a36"; // the board
  g.fillRect(cx - 10, cy - 11, 20, 13);
  g.strokeStyle = "#3a2c1e"; g.lineWidth = 1; g.strokeRect(cx - 10, cy - 11, 20, 13);
  g.fillStyle = "#caa05a"; // a brass trophy mark + chalk lines
  g.beginPath(); g.arc(cx, cy - 8, 1.8, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(230,226,208,0.7)"; g.lineWidth = 1;
  for (const yy of [-4, -1.5, 1]) { g.beginPath(); g.moveTo(cx - 7, cy + yy); g.lineTo(cx + 7, cy + yy); g.stroke(); }
}

/** The roped barrier at the pier's neck (gone once the warden's quest is done). */
function drawPierGate(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = "#5a4632"; // two posts
  g.fillRect(cx - 10, cy - 8, 3, 18);
  g.fillRect(cx + 7, cy - 8, 3, 18);
  g.fillStyle = "#caa05a"; g.beginPath(); g.arc(cx - 8.5, cy - 8, 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 8.5, cy - 8, 2, 0, Math.PI * 2); g.fill();
  // A sagging rope between them.
  g.strokeStyle = "#b89a6a"; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 8, cy - 5);
  g.quadraticCurveTo(cx, cy + 4, cx + 8, cy - 5);
  g.stroke();
}

/** An unbuilt add-on doorway: a boarded-up wall opening, awaiting its extension. */
function drawRoomSeal(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = "#6b6157"; g.fillRect(cx - 12, cy - 12, 24, 24); // the wall masonry
  g.strokeStyle = "#4a4138"; g.lineWidth = 1;
  for (let i = -8; i <= 8; i += 8) { g.beginPath(); g.moveTo(cx - 12, cy + i); g.lineTo(cx + 12, cy + i); g.stroke(); }
  // crossed boards over the opening — "under construction"
  g.fillStyle = "#7a5532"; g.fillRect(cx - 11, cy - 3, 22, 4); g.fillRect(cx - 3, cy - 11, 4, 22);
  g.strokeStyle = "#caa05a"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 10, cy - 9); g.lineTo(cx + 10, cy + 9); g.stroke();
}

/** A timber house door — a planked doorway in a frame, with a ring handle. */
function drawHouseDoor(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 8, 3);
  g.fillStyle = "#3f3526"; g.fillRect(cx - 8, cy - 12, 16, 24); // the frame
  g.fillStyle = "#6e4a2c"; g.fillRect(cx - 6, cy - 10, 12, 22); // the door leaf
  g.strokeStyle = "#4f351f"; g.lineWidth = 1; // plank seams
  for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(cx - 6 + i * 4, cy - 10); g.lineTo(cx - 6 + i * 4, cy + 12); g.stroke(); }
  g.fillStyle = "#caa05a"; g.beginPath(); g.arc(cx + 3.5, cy + 1, 1.6, 0, Math.PI * 2); g.fill(); // ring handle
}

/**
 * The player's homestead, rendered on its overworld lot. The house visibly
 * grows with the house tier: a one-gable Cottage, a chimneyed Homestead, a
 * cross-gabled Manor, then a wide Estate with a wing and twin chimneys — plus a
 * nameplate, a stone path, a little garden, and warm window-glow after dark.
 * `fx` is the door-centre x, `fy` the ground line (bottom of the door tile).
 */
function drawHomeExterior(
  g: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  tier: number,
  now: number,
  night: number,
  name: string,
): void {
  const t = Math.max(0, Math.min(3, tier));
  const halfW = [26, 32, 38, 46][t]!;        // body half-width
  const bodyH = [30, 34, 40, 46][t]!;        // wall height
  const eave = 6;                             // roof overhang
  const top = fy - bodyH;                     // wall top / roof spring line
  const lit = night > 0.28;                   // windows glow after dusk
  const glow = 0.35 + 0.5 * night;
  // Roof palette warms/darkens by tier: thatch → clay tile → slate.
  const roof: [string, string] = [["#9c7a40", "#7a5c2c"], ["#8a6438", "#684627"], ["#7c3f30", "#5a2c22"], ["#5b5560", "#403b45"]][t] as [string, string];

  // Ground shadow across the whole footprint.
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath(); g.ellipse(fx, fy + 2, halfW + eave, 7, 0, 0, Math.PI * 2); g.fill();

  // A little front garden: a stone path down from the door, a shrub each side.
  g.fillStyle = "rgba(150,140,120,0.5)";
  for (let i = 0; i < 3; i++) g.fillRect(fx - 4, fy + 3 + i * 5, 8, 3);
  for (const sx of [-halfW - 2, halfW + 2]) {
    g.fillStyle = "#3f5a34"; g.beginPath(); g.arc(fx + sx, fy - 2, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#4d6b3f"; g.beginPath(); g.arc(fx + sx - 1, fy - 3, 3, 0, Math.PI * 2); g.fill();
    if (t >= 2) { g.fillStyle = "#e0b8d0"; for (let k = 0; k < 3; k++) g.fillRect(fx + sx - 3 + k * 3, fy - 4, 1.5, 1.5); } // flowers
  }

  // --- Body: plaster with a timber frame. ---
  const wallL = fx - halfW, wallR = fx + halfW;
  g.fillStyle = "#c3b088"; g.fillRect(wallL, top, halfW * 2, bodyH);
  g.fillStyle = "rgba(0,0,0,0.10)"; g.fillRect(wallL, fy - 6, halfW * 2, 6); // base shading
  g.strokeStyle = "#5a4630"; g.lineWidth = 2;
  g.strokeRect(wallL + 1, top + 1, halfW * 2 - 2, bodyH - 2);
  // corner posts + a mid stud or two
  g.fillStyle = "#5a4630";
  g.fillRect(wallL, top, 3, bodyH); g.fillRect(wallR - 3, top, 3, bodyH);
  g.fillRect(fx - 1.5, top, 3, bodyH);
  if (t >= 2) { g.fillRect(fx - halfW * 0.5, top, 2, bodyH); g.fillRect(fx + halfW * 0.5, top, 2, bodyH); }

  // Windows (glow at night). Count grows with tier.
  const winY = top + bodyH * 0.34;
  const wx = t === 0 ? [fx - halfW * 0.5] : t === 1 ? [fx - halfW * 0.5, fx + halfW * 0.5]
    : [fx - halfW * 0.62, fx + halfW * 0.62, fx - halfW * 0.28, fx + halfW * 0.28].slice(0, t === 2 ? 3 : 4);
  for (const cxw of wx) {
    if (Math.abs(cxw - fx) < 8) continue; // don't sit a window on the doorway
    g.fillStyle = "#3a2c1c"; g.fillRect(cxw - 6, winY - 6, 12, 12);
    g.fillStyle = lit ? `rgba(255,206,120,${glow})` : "rgba(150,180,210,0.5)";
    g.fillRect(cxw - 4.5, winY - 4.5, 9, 9);
    g.strokeStyle = "#3a2c1c"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(cxw, winY - 5); g.lineTo(cxw, winY + 5); g.moveTo(cxw - 5, winY); g.lineTo(cxw + 5, winY); g.stroke();
  }

  // Door (aligned to the door tile) + a hanging nameplate.
  const doorW = 12, doorH = Math.min(18, bodyH * 0.5);
  g.fillStyle = "#4a3320"; g.fillRect(fx - doorW / 2, fy - doorH, doorW, doorH);
  g.fillStyle = "#5c4126"; g.fillRect(fx - doorW / 2 + 1.5, fy - doorH + 1.5, doorW - 3, doorH - 2);
  g.strokeStyle = "#2e2013"; g.lineWidth = 1; g.beginPath(); g.moveTo(fx, fy - doorH + 2); g.lineTo(fx, fy - 1); g.stroke();
  g.fillStyle = "#d8b24a"; g.beginPath(); g.arc(fx + doorW / 2 - 3, fy - doorH * 0.5, 1.2, 0, Math.PI * 2); g.fill(); // handle

  // --- Roof: a gable over the body, overhanging the eaves. ---
  const ridge = top - [14, 16, 19, 20][t]!;
  const drawGable = (l: number, r: number, springY: number, peakX: number, peakY: number): void => {
    g.fillStyle = roof[0];
    g.beginPath(); g.moveTo(l - eave, springY); g.lineTo(peakX, peakY); g.lineTo(r + eave, springY); g.closePath(); g.fill();
    g.fillStyle = roof[1]; // shaded right slope
    g.beginPath(); g.moveTo(peakX, peakY); g.lineTo(r + eave, springY); g.lineTo(peakX, springY); g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(l - eave, springY); g.lineTo(peakX, peakY); g.lineTo(r + eave, springY); g.stroke();
  };
  drawGable(wallL, wallR, top, fx, ridge);
  // Manor+ gets a cross-gable dormer over the doorway; Estate a side wing roof.
  if (t >= 2) drawGable(fx - halfW * 0.4, fx + halfW * 0.4, top - bodyH * 0.1, fx, ridge - 6);
  if (t >= 3) {
    g.fillStyle = "#c3b088"; g.fillRect(wallR - 2, top + bodyH * 0.25, 16, bodyH * 0.75); // wing wall
    g.strokeStyle = "#5a4630"; g.lineWidth = 1.5; g.strokeRect(wallR - 2, top + bodyH * 0.25, 16, bodyH * 0.75);
    drawGable(wallR, wallR + 14, top + bodyH * 0.25, wallR + 7, top + bodyH * 0.25 - 12);
  }

  // Chimney(s) with drifting smoke — one from Homestead, two at Estate.
  const stacks = t >= 3 ? [wallL + halfW * 0.5, wallR - 6] : t >= 1 ? [wallL + halfW * 0.55] : [];
  for (const chx of stacks) {
    const chTop = ridge + 6;
    g.fillStyle = "#6a5140"; g.fillRect(chx - 4, chTop, 8, top - chTop + 4);
    g.fillStyle = "#4e3b2d"; g.fillRect(chx - 5, chTop - 2, 10, 3);
    g.save(); g.globalAlpha = 0.3;
    for (let i = 0; i < 3; i++) {
      const s = ((now / 1100) + i / 3) % 1;
      g.fillStyle = "rgba(210,210,215,1)";
      g.beginPath(); g.arc(chx + Math.sin((now / 600) + i) * 3, chTop - 4 - s * 22, 2.5 + s * 4, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  // Estate finial: a little pennant at the peak.
  if (t >= 3) {
    g.strokeStyle = "#4e3b2d"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(fx, ridge - 6); g.lineTo(fx, ridge - 16); g.stroke();
    g.fillStyle = "#b8452f"; g.beginPath(); g.moveTo(fx, ridge - 16); g.lineTo(fx + 10, ridge - 13); g.lineTo(fx, ridge - 10); g.closePath(); g.fill();
  }

  // Nameplate: a compact plaque above the door, sized to its text.
  const label = name.replace(/^the /i, "").replace(/ Homestead$/i, "").slice(0, 12);
  g.font = "7px 'EB Garamond', serif"; g.textAlign = "center"; g.textBaseline = "middle";
  const plW = Math.min(halfW * 2 - 6, g.measureText(label).width + 8);
  const plX = fx, plY = fy - doorH - 8;
  g.fillStyle = "#e6d6a8"; g.fillRect(plX - plW / 2, plY - 5, plW, 10);
  g.strokeStyle = "#7a5c34"; g.lineWidth = 1; g.strokeRect(plX - plW / 2, plY - 5, plW, 10);
  g.fillStyle = "#4a3a22"; g.fillText(label, plX, plY + 0.5);
  g.textAlign = "left"; g.textBaseline = "alphabetic";

  // A lantern glow by the door at night.
  if (lit) { g.fillStyle = `rgba(255,196,110,${0.5 * night})`; g.beginPath(); g.arc(fx - doorW / 2 - 4, fy - doorH * 0.7, 6, 0, Math.PI * 2); g.fill(); }
}

/**
 * The backyard pet paddock: a wooden fence over the bounding wall, a couple of
 * feeding troughs and a kennel, and every companion pet the player owns drifting
 * across the grass — the collection log brought to life in your own yard.
 */
function drawBackyard(
  g: CanvasRenderingContext2D,
  state: WorldState,
  content: Content,
  region: { x0: number; y0: number; x1: number; y1: number },
  cam: Camera,
  now: number,
): void {
  const { x0, y0, x1, y1 } = region;
  const grass = TILE_COLORS.grass[0];
  // Post-and-rail fence painted over the bounding wall.
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tx !== x0 && tx !== x1 && ty !== y0 && ty !== y1) continue;
    const px = tx * TILE - cam.x, py = ty * TILE - cam.y, cx = px + TILE / 2, cy = py + TILE / 2;
    g.fillStyle = grass; g.fillRect(px, py, TILE, TILE); // hide the masonry beneath
    const horiz = ty === y0 || ty === y1;
    g.fillStyle = "#7a5c38";
    if (horiz) { g.fillRect(px, cy - 4, TILE, 2.5); g.fillRect(px, cy + 2, TILE, 2.5); g.fillStyle = "#513a22"; g.fillRect(cx - 1.5, py + 4, 3, TILE - 8); }
    else { g.fillRect(cx - 4, py, 2.5, TILE); g.fillRect(cx + 2, py, 2.5, TILE); g.fillStyle = "#513a22"; g.fillRect(px + 4, cy - 1.5, TILE - 8, 3); }
  }

  // A water trough, a feed trough, and a little kennel — the yard furniture.
  const at = (tx: number, ty: number): [number, number] => [tx * TILE - cam.x + TILE / 2, ty * TILE - cam.y + TILE / 2];
  const [wtx, wty] = at(x0 + 3, y1 - 2);
  shadow(g, wtx, wty + 5, 11, 3);
  g.fillStyle = "#5c4126"; g.fillRect(wtx - 11, wty - 4, 22, 9);
  g.fillStyle = "#3f7c8a"; g.fillRect(wtx - 9, wty - 3, 18, 4); // water
  g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(wtx - 8, wty - 3, 6, 1.5);
  const [ftx, fty] = at(x0 + 6, y1 - 2);
  shadow(g, ftx, fty + 5, 10, 3);
  g.fillStyle = "#5c4126"; g.fillRect(ftx - 10, fty - 4, 20, 9);
  g.fillStyle = "#b78a3e"; g.fillRect(ftx - 8, fty - 3, 16, 4); // feed
  // Kennel (a mini gabled dog house) in a far corner.
  const [kx, ky] = at(x1 - 3, y0 + 3);
  shadow(g, kx, ky + 8, 12, 3);
  g.fillStyle = "#8a6a44"; g.fillRect(kx - 10, ky - 2, 20, 12);
  g.fillStyle = "#6d5033"; g.beginPath(); g.moveTo(kx - 12, ky - 2); g.lineTo(kx, ky - 14); g.lineTo(kx + 12, ky - 2); g.closePath(); g.fill();
  g.fillStyle = "#2e2013"; g.beginPath(); g.arc(kx, ky + 8, 5, Math.PI, 0); g.fill(); g.fillRect(kx - 5, ky + 3, 10, 6);

  // Every companion pet the player owns, drifting the yard on a slow wander.
  const owned: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | undefined): void => {
    if (id && content.items[id as ItemId]?.slot === "companion" && !seen.has(id)) { seen.add(id); owned.push(id); }
  };
  for (const s of state.player.inventory) if (s) add(s.item);
  for (const k of Object.keys(state.player.bank)) add(k);
  add(state.player.equipment.companion);

  owned.forEach((id, i) => {
    const ph = i * 1.7;
    const wx = x0 + 2.5 + (x1 - x0 - 5) * (0.5 + 0.42 * Math.sin(now / 2600 + ph));
    const wy = y0 + 3 + (y1 - y0 - 6) * (0.5 + 0.42 * Math.cos(now / 2200 + ph * 1.3));
    const sx = wx * TILE - cam.x, sy = wy * TILE - cam.y;
    shadow(g, sx, sy + 6, 7, 2.5);
    drawCompanion(g, content, id as ItemId, sx, sy, now, true);
  });

  // A gentle hint when the paddock is empty.
  if (owned.length === 0) {
    const [hx, hy] = at((x0 + x1) / 2, y0 + 2);
    g.fillStyle = "rgba(0,0,0,0.4)"; g.font = "italic 11px 'EB Garamond', serif"; g.textAlign = "center";
    g.fillText("A quiet paddock — find a pet, and it will roam here.", hx, hy);
    g.textAlign = "left";
  }
}

/**
 * Sparse wall-torches through a dungeon site: deterministic (hash-picked) cave
 * wall tiles that face open floor get a bracketed flame, so the halls read by
 * their own firelight — brighter in rooms, long shadows in the corridors.
 */
function drawDungeonSconces(
  g: CanvasRenderingContext2D,
  state: WorldState,
  region: { x0: number; y0: number; x1: number; y1: number },
  cam: Camera,
  now: number,
  lights: Array<[number, number]>,
): void {
  const { map } = state;
  const at = (x: number, y: number) => map.tiles[y * map.width + x];
  for (let ty = region.y0; ty <= region.y1; ty++) {
    for (let tx = region.x0; tx <= region.x1; tx++) {
      if (at(tx, ty) !== "cave_wall") continue;
      const below = at(tx, ty + 1);
      if (below !== "cave" && below !== "dirt") continue; // must face open floor
      if (hash(tx * 13, ty * 7) > 0.16) continue;         // sparse, deterministic
      const x = tx * TILE - cam.x + TILE / 2;
      const y = ty * TILE - cam.y + TILE - 6;
      if (x < -TILE || y < -TILE || x > g.canvas.width + TILE || y > g.canvas.height + TILE) continue;
      const fl = 0.6 + 0.4 * Math.sin(now / 190 + tx * 1.7 + ty);
      g.fillStyle = "#3b3e45"; g.fillRect(x - 1.5, y - 2, 3, 8); // iron bracket
      g.fillStyle = `rgba(255,170,80,${0.6 + 0.3 * fl})`;
      g.beginPath(); g.moveTo(x, y - 8 - 3 * fl); g.lineTo(x - 3, y - 1); g.lineTo(x + 3, y - 1); g.closePath(); g.fill();
      g.fillStyle = "#ffe9b8"; g.fillRect(x - 1, y - 4, 2, 3);
      lights.push([x, y - 4]);
    }
  }
}

/** A dungeon's sealed slab: fitted grave-stone filling its tile, faintly graven.
 *  (Only drawn while sealed — the object vanishes when its puzzle flag is set.) */
function drawDungeonGate(g: CanvasRenderingContext2D, px: number, py: number): void {
  g.fillStyle = "#4e4a52";
  g.fillRect(px + 1, py, TILE - 2, TILE);
  g.fillStyle = "#3c3944";
  g.fillRect(px + 3, py + 2, TILE - 6, TILE - 4);
  g.strokeStyle = "#635f6b"; g.lineWidth = 1.4;
  g.strokeRect(px + 3, py + 2, TILE - 6, TILE - 4);
  // graven rings, worn near to nothing
  g.strokeStyle = "rgba(160,150,175,0.35)"; g.lineWidth = 1;
  g.beginPath(); g.arc(px + TILE / 2, py + TILE / 2, 8, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(px + TILE / 2, py + TILE / 2, 4, 0, Math.PI * 2); g.stroke();
}

/** An iron puzzle lever on a stone mount; the arm swings over once thrown. */
function drawPuzzleLever(g: CanvasRenderingContext2D, cx: number, cy: number, thrown: boolean, now: number): void {
  shadow(g, cx, cy + 8, 8, 3);
  g.fillStyle = "#57525e"; g.fillRect(cx - 7, cy - 2, 14, 10); // stone mount
  g.strokeStyle = "#3c3944"; g.lineWidth = 1; g.strokeRect(cx - 7, cy - 2, 14, 10);
  g.strokeStyle = "#2c2a31"; g.lineWidth = 3;
  g.beginPath();
  if (thrown) { g.moveTo(cx, cy); g.lineTo(cx + 8, cy - 8); } // swung over
  else { g.moveTo(cx, cy); g.lineTo(cx - 8, cy - 9); }
  g.stroke();
  g.fillStyle = thrown ? "#8fd07f" : "#c8574a"; // handle knob glints by state
  const hx = thrown ? cx + 8 : cx - 8, hy = thrown ? cy - 8 : cy - 9;
  g.beginPath(); g.arc(hx, hy, 2.5, 0, Math.PI * 2); g.fill();
  if (thrown) { // a faint pulse while the sequence holds
    g.fillStyle = `rgba(143,208,127,${0.25 + 0.15 * Math.sin(now / 300)})`;
    g.beginPath(); g.arc(hx, hy, 5, 0, Math.PI * 2); g.fill();
  }
}

/** A dungeon reward chest: black oak banded in dark silver; open once looted. */
function drawDungeonChest(g: CanvasRenderingContext2D, cx: number, cy: number, looted: boolean): void {
  shadow(g, cx, cy + 9, 11, 3.5);
  g.fillStyle = "#2e2620"; g.fillRect(cx - 11, cy - 2, 22, 11); // body
  g.fillStyle = "#3a3028"; g.fillRect(cx - 10, cy - 1, 20, 4);
  g.strokeStyle = "#8b8fa0"; g.lineWidth = 1.4; // dark-silver bands
  g.beginPath(); g.moveTo(cx - 6, cy - 2); g.lineTo(cx - 6, cy + 9); g.moveTo(cx + 6, cy - 2); g.lineTo(cx + 6, cy + 9); g.stroke();
  if (looted) {
    // lid thrown back, dark inside
    g.fillStyle = "#241d18"; g.fillRect(cx - 10, cy - 1, 20, 4);
    g.fillStyle = "#2e2620"; g.fillRect(cx - 11, cy - 9, 22, 6);
    g.strokeStyle = "#8b8fa0"; g.beginPath(); g.moveTo(cx - 6, cy - 9); g.lineTo(cx - 6, cy - 3); g.moveTo(cx + 6, cy - 9); g.lineTo(cx + 6, cy - 3); g.stroke();
  } else {
    // closed lid + a pale clasp catching what light there is
    g.fillStyle = "#352b23"; g.fillRect(cx - 11, cy - 6, 22, 5);
    g.strokeStyle = "#8b8fa0"; g.beginPath(); g.moveTo(cx - 6, cy - 6); g.lineTo(cx - 6, cy - 1); g.moveTo(cx + 6, cy - 6); g.lineTo(cx + 6, cy - 1); g.stroke();
    g.fillStyle = "#c9cede"; g.fillRect(cx - 1.5, cy - 3, 3, 4);
  }
}

/** Dungeon floor dressing: the dead, their goods, and what light they left.
 *  Everything here is flat-ish and drawn in the floor pass (under entities).
 *  Variants are picked by def.variant; a stable per-id hash varies rotation
 *  and small offsets so repeated pieces don't stamp identically. */
function drawRemains(g: CanvasRenderingContext2D, cx: number, cy: number, def: WorldObjectDef, now: number): void {
  let h = 0;
  const id = def.id;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const r1 = (Math.abs(h) % 100) / 100, r2 = (Math.abs(h >> 4) % 100) / 100;
  const rot = (r1 - 0.5) * 0.9;
  const BONE = "#cfc8b4", BONE2 = "#b5ad97", RUST = "#6e4f3a", WOOD = "#4a3c2c", CLOTH = "#4a4438";
  switch (def.variant) {
    case "bones": { // a low pile of long bones + a skull
      g.save(); g.translate(cx, cy); g.rotate(rot);
      g.strokeStyle = BONE2; g.lineWidth = 2.4; g.lineCap = "round";
      g.beginPath(); g.moveTo(-8, 3); g.lineTo(6, -1); g.moveTo(-5, -3); g.lineTo(7, 4); g.moveTo(-2, 6); g.lineTo(4, -5); g.stroke();
      g.fillStyle = BONE;
      g.beginPath(); g.arc(-6, -4, 3.6, 0, Math.PI * 2); g.fill(); // skull
      g.fillStyle = "#1d1a16"; g.fillRect(-7.6, -5, 1.6, 1.6); g.fillRect(-5, -5, 1.6, 1.6);
      g.restore(); break;
    }
    case "skeleton": { // sprawled full skeleton, face-down where it fell
      g.save(); g.translate(cx, cy); g.rotate(rot * 2);
      g.strokeStyle = BONE; g.lineWidth = 2.2; g.lineCap = "round";
      g.beginPath(); g.moveTo(-9, 0); g.lineTo(7, 0); g.stroke(); // spine
      for (let i = -1; i <= 2; i++) { g.beginPath(); g.moveTo(i * 3 - 3, -3.5); g.lineTo(i * 3 - 3, 3.5); g.stroke(); } // ribs
      g.beginPath(); g.moveTo(-4, -1); g.lineTo(-12, -6); g.moveTo(-4, 1); g.lineTo(-11, 7); g.stroke(); // arms, reaching
      g.beginPath(); g.moveTo(7, -1); g.lineTo(13, -5); g.moveTo(7, 1); g.lineTo(14, 4); g.stroke(); // legs
      g.fillStyle = BONE; g.beginPath(); g.arc(-13, -1, 3.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1d1a16"; g.fillRect(-14.8, -2.2, 1.5, 1.5); g.fillRect(-12.2, -2.2, 1.5, 1.5);
      g.restore(); break;
    }
    case "sitting": { // slumped upright against whatever held it — died at its post
      g.fillStyle = CLOTH; // rotted cloak pooled around it
      g.beginPath(); g.ellipse(cx, cy + 6, 9, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = BONE; g.lineWidth = 2.2; g.lineCap = "round";
      g.beginPath(); g.moveTo(cx, cy + 5); g.lineTo(cx, cy - 4); g.stroke(); // slumped spine
      g.beginPath(); g.moveTo(cx, cy - 1); g.lineTo(cx - 6, cy + 4); g.moveTo(cx, cy - 1); g.lineTo(cx + 6, cy + 3); g.stroke();
      g.fillStyle = BONE; g.beginPath(); g.arc(cx + 1.5, cy - 7, 3.6, 0, Math.PI * 2); g.fill(); // head, tipped
      g.fillStyle = "#1d1a16"; g.fillRect(cx + 0.2, cy - 8, 1.5, 1.5); g.fillRect(cx + 2.6, cy - 8, 1.5, 1.5);
      break;
    }
    case "urn": { // a grave-goods urn; about half stand tipped and spilled
      const tipped = r2 > 0.5;
      g.save(); g.translate(cx, cy); if (tipped) g.rotate(1.2);
      g.fillStyle = "#7a6a52";
      g.beginPath(); g.moveTo(-5, 6); g.quadraticCurveTo(-7, -2, -3, -6); g.lineTo(3, -6); g.quadraticCurveTo(7, -2, 5, 6); g.closePath(); g.fill();
      g.fillStyle = "#5d5040"; g.fillRect(-4, -8, 8, 2.5);
      g.strokeStyle = "#4a4034"; g.lineWidth = 1; g.beginPath(); g.moveTo(-5.5, 0); g.lineTo(5.5, 0); g.stroke();
      g.restore();
      if (tipped) { g.fillStyle = BONE2; for (let i = 0; i < 4; i++) g.fillRect(cx + 6 + i * 3, cy + 3 + (i % 2) * 2, 2, 2); }
      break;
    }
    case "camp": { // a cold camp: bedroll, dead fire, a dropped pack
      g.fillStyle = "#54423a"; // bedroll
      g.save(); g.translate(cx - 8, cy + 2); g.rotate(-0.25); g.fillRect(-9, -4, 18, 8);
      g.fillStyle = "#3f322c"; g.fillRect(-9, -4, 4, 8); g.restore();
      g.fillStyle = "#2b2622"; // dead firepit
      g.beginPath(); g.arc(cx + 8, cy - 2, 4.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#191512"; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(cx + 4, cy - 4); g.lineTo(cx + 12, cy + 1); g.moveTo(cx + 12, cy - 5); g.lineTo(cx + 5, cy + 1); g.stroke();
      g.fillStyle = RUST; g.fillRect(cx + 2, cy + 6, 6, 5); // the pack no one came back for
      g.fillStyle = "#5a4030"; g.fillRect(cx + 2, cy + 6, 6, 2);
      break;
    }
    case "tools": { // dropped iron: a pick, a blade, a shield boss gone to rust
      g.save(); g.translate(cx, cy); g.rotate(rot);
      g.strokeStyle = RUST; g.lineWidth = 2.2; g.lineCap = "round";
      g.beginPath(); g.moveTo(-8, 4); g.lineTo(6, -4); g.stroke(); // haft
      g.beginPath(); g.moveTo(3, -7); g.quadraticCurveTo(8, -4, 5, 0); g.stroke(); // pick head
      g.strokeStyle = "#7d7466"; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(-4, -5); g.lineTo(8, 5); g.stroke(); // a blade
      g.fillStyle = RUST; g.beginPath(); g.arc(-7, -2, 3, 0, Math.PI * 2); g.fill(); // shield boss
      g.restore(); break;
    }
    case "crate": { // stores that never shipped
      g.fillStyle = WOOD; g.fillRect(cx - 8, cy - 6, 11, 11);
      g.strokeStyle = "#352b1f"; g.lineWidth = 1.2; g.strokeRect(cx - 8, cy - 6, 11, 11);
      g.beginPath(); g.moveTo(cx - 8, cy - 6); g.lineTo(cx + 3, cy + 5); g.stroke();
      g.fillStyle = "#3f3425"; g.fillRect(cx + 1, cy - 1, 8, 8); // a smaller one, tipped against it
      g.strokeStyle = "#2b2318"; g.strokeRect(cx + 1, cy - 1, 8, 8);
      break;
    }
    case "coins": { // a spilled count no one dared take
      g.fillStyle = "#c9a24a";
      for (let i = 0; i < 9; i++) {
        const a = (Math.abs(h >> i) % 100) / 100;
        const b = (Math.abs(h >> (i + 3)) % 100) / 100;
        g.beginPath(); g.ellipse(cx + (a - 0.5) * 18, cy + (b - 0.5) * 12, 1.8, 1.2, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = "#8a6f33"; g.beginPath(); g.ellipse(cx + 2, cy + 1, 2, 1.3, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case "nest": { // a shriker nest: twigs ringed around old bones
      g.strokeStyle = "#5c4a30"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx, cy, 10, 6.5, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#6e5a3c"; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(cx, cy, 7, 4.5, 0.3, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = BONE2; g.beginPath(); g.moveTo(cx - 3, cy + 1); g.lineTo(cx + 3, cy - 1); g.stroke();
      g.fillStyle = BONE; g.beginPath(); g.arc(cx + 2, cy + 1, 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#d8d2c2"; // a shed feather
      g.beginPath(); g.ellipse(cx - 8, cy - 5, 3.5, 1.2, -0.5, 0, Math.PI * 2); g.fill();
      break;
    }
    case "banner": { // a fallen standard, its colours long gone grey
      g.save(); g.translate(cx, cy); g.rotate(rot + 0.4);
      g.strokeStyle = "#4a3c2c"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-10, -6); g.lineTo(10, 6); g.stroke(); // the pole
      g.fillStyle = "#57544a";
      g.beginPath(); g.moveTo(-6, -4); g.lineTo(6, 3); g.lineTo(3, 8); g.lineTo(-2, 5); g.lineTo(-4, 8); g.lineTo(-8, 0); g.closePath(); g.fill(); // torn cloth
      g.restore(); break;
    }
    case "kelp": { // silt and weed the flood left behind
      g.strokeStyle = "#3e5244"; g.lineWidth = 2; g.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const a = (Math.abs(h >> i) % 100) / 100;
        const x = cx + (a - 0.5) * 16;
        g.beginPath(); g.moveTo(x, cy + 6); g.quadraticCurveTo(x + 3, cy, x - 1, cy - 6 - a * 3); g.stroke();
      }
      g.fillStyle = "rgba(70,90,76,0.35)";
      g.beginPath(); g.ellipse(cx, cy + 5, 11, 3.5, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case "sarco": { // a stone coffin, lid dragged aside long ago
      g.fillStyle = "#6b655c"; g.fillRect(cx - 12, cy - 7, 24, 14);
      g.strokeStyle = "#4a453e"; g.lineWidth = 1.4; g.strokeRect(cx - 12, cy - 7, 24, 14);
      g.fillStyle = "#14110e"; g.fillRect(cx - 9, cy - 4, 18, 8); // the dark inside
      g.strokeStyle = BONE2; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(cx - 4, cy); g.lineTo(cx + 4, cy); g.stroke(); // what's left of the resident
      g.save(); g.translate(cx + 14, cy + 4); g.rotate(0.5);
      g.fillStyle = "#5d5850"; g.fillRect(-4, -8, 8, 16); g.restore(); // the shoved-off lid
      break;
    }
    case "device": { // a broken instrument: tripod, tilted disc, spilled workings
      g.strokeStyle = "#5a4a36"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - 6, cy + 7); g.lineTo(cx, cy - 3); g.lineTo(cx + 6, cy + 7); g.moveTo(cx, cy - 3); g.lineTo(cx, cy + 7); g.stroke();
      g.save(); g.translate(cx + 1, cy - 6); g.rotate(0.7);
      g.strokeStyle = "#8b8478"; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(0, 0, 6.5, 6.5, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(-6.5, 0); g.lineTo(6.5, 0); g.moveTo(0, -6.5); g.lineTo(0, 6.5); g.stroke();
      g.restore();
      g.fillStyle = "#8b8478"; g.fillRect(cx + 7, cy + 4, 2.5, 2.5); g.fillRect(cx - 10, cy + 5, 2, 2);
      break;
    }
    case "brazier": { // still burning after a thousand years — ward-fire
      shadow(g, cx, cy + 7, 8, 3);
      g.fillStyle = "#3a3630"; g.fillRect(cx - 2, cy - 2, 4, 8); // stem
      g.fillStyle = "#4a453e";
      g.beginPath(); g.moveTo(cx - 7, cy - 6); g.quadraticCurveTo(cx, cy - 1, cx + 7, cy - 6); g.lineTo(cx + 5, cy - 2); g.lineTo(cx - 5, cy - 2); g.closePath(); g.fill();
      const gutter = 0.75 + 0.25 * Math.sin(now / 150 + h);
      g.fillStyle = "#e8a23c";
      g.beginPath(); g.moveTo(cx - 4, cy - 6); g.quadraticCurveTo(cx, cy - 13 * gutter, cx + 4, cy - 6); g.closePath(); g.fill();
      g.fillStyle = "#f6d87a";
      g.beginPath(); g.moveTo(cx - 2, cy - 6); g.quadraticCurveTo(cx, cy - 9.5 * gutter, cx + 2, cy - 6); g.closePath(); g.fill();
      break;
    }
    case "dais": { // a broad stone step the keeper stands on
      g.fillStyle = "#57534a";
      g.beginPath(); g.ellipse(cx, cy + 4, 26, 13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#635e54";
      g.beginPath(); g.ellipse(cx, cy + 1, 20, 9.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#8d897d"; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(cx, cy + 1, 14, 6.5, 0, 0, Math.PI * 2); g.stroke(); // the seal's inlay ring
      break;
    }
    case "throne": { // a high seat, older than the water that drowned it
      g.fillStyle = "#4e4a42";
      g.beginPath(); g.ellipse(cx, cy + 8, 16, 7, 0, 0, Math.PI * 2); g.fill(); // plinth
      g.fillStyle = "#5d5850"; g.fillRect(cx - 9, cy - 14, 18, 18); // the back
      g.fillStyle = "#6b655c"; g.fillRect(cx - 7, cy - 2, 14, 7); // the seat
      g.fillStyle = "#4a453e"; g.fillRect(cx - 11, cy - 6, 3, 12); g.fillRect(cx + 8, cy - 6, 3, 12); // arms
      g.strokeStyle = "#8d897d"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx - 5, cy - 11); g.lineTo(cx + 5, cy - 11); g.moveTo(cx, cy - 14); g.lineTo(cx, cy - 8); g.stroke(); // a worn crest
      break;
    }
    default: { // unknown variant: read as plain bones rather than vanish
      g.strokeStyle = BONE2; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - 6, cy + 2); g.lineTo(cx + 6, cy - 2); g.stroke();
      g.fillStyle = BONE; g.beginPath(); g.arc(cx - 5, cy - 3, 3, 0, Math.PI * 2); g.fill();
    }
  }
}

/** The five Act II dungeon mouths: grand carved gates, not critter caves.
 *  ~3 tiles of doorposts, lintel and descending steps, tinted to the site,
 *  each with its sigil cut into the lintel. Collision stays one tile — the
 *  art simply overhangs, the way trees do. */
const DUNGEON_MOUTHS: Record<string, { stone: string; lit: string; dark: string; glow: string; sigil: "wolf" | "tally" | "scales" | "star" | "until" }> = {
  portal_hollow: { stone: "#5d5a4e", lit: "#767261", dark: "#3d3a32", glow: "rgba(140,150,130,0.16)", sigil: "wolf" },
  portal_spine: { stone: "#5f6167", lit: "#7c7e85", dark: "#3e4045", glow: "rgba(150,165,185,0.16)", sigil: "tally" },
  portal_court: { stone: "#556058", lit: "#6f7d71", dark: "#37403a", glow: "rgba(110,160,140,0.18)", sigil: "scales" },
  portal_sky: { stone: "#565b68", lit: "#737a8c", dark: "#383c46", glow: "rgba(140,165,215,0.18)", sigil: "star" },
  portal_under: { stone: "#8d8a80", lit: "#b0aca0", dark: "#5c5952", glow: "rgba(228,224,214,0.20)", sigil: "until" },
};

function drawDungeonMouth(g: CanvasRenderingContext2D, cx: number, cy: number, portalId: string): void {
  const c = DUNGEON_MOUTHS[portalId]!;
  const W = TILE * 1.45; // half-width — the gate spans ~3 tiles of art
  shadow(g, cx, cy + 16, W, 6);
  // Broad steps rising to the door.
  g.fillStyle = c.dark; g.fillRect(cx - W * 0.8, cy + 8, W * 1.6, 6);
  g.fillStyle = c.stone; g.fillRect(cx - W * 0.66, cy + 3, W * 1.32, 6);
  // The doorposts.
  g.fillStyle = c.stone;
  g.fillRect(cx - W, cy - 34, 13, 42);
  g.fillRect(cx + W - 13, cy - 34, 13, 42);
  g.fillStyle = c.lit; // weathered top light
  g.fillRect(cx - W, cy - 34, 13, 5);
  g.fillRect(cx + W - 13, cy - 34, 13, 5);
  g.fillStyle = c.dark; // base courses
  g.fillRect(cx - W, cy + 2, 13, 6);
  g.fillRect(cx + W - 13, cy + 2, 13, 6);
  // The lintel.
  g.fillStyle = c.stone; g.fillRect(cx - W - 4, cy - 44, W * 2 + 8, 13);
  g.fillStyle = c.lit; g.fillRect(cx - W - 4, cy - 44, W * 2 + 8, 4);
  // The dark going down.
  g.fillStyle = "#0b0908";
  g.beginPath();
  g.moveTo(cx - W + 14, cy + 4);
  g.lineTo(cx - W + 14, cy - 26);
  g.quadraticCurveTo(cx, cy - 36, cx + W - 14, cy - 26);
  g.lineTo(cx + W - 14, cy + 4);
  g.closePath(); g.fill();
  // A cold breath of light from below.
  g.fillStyle = c.glow;
  g.beginPath();
  g.moveTo(cx - W + 14, cy + 4);
  g.lineTo(cx, cy - 14);
  g.lineTo(cx + W - 14, cy + 4);
  g.closePath(); g.fill();
  // The sigil, cut into the lintel.
  g.strokeStyle = c.dark; g.fillStyle = c.dark; g.lineWidth = 2; g.lineCap = "round";
  const sy = cy - 37.5;
  switch (c.sigil) {
    case "wolf": // the running wolf: a lean stroke with ears
      g.beginPath(); g.moveTo(cx - 9, sy + 3); g.quadraticCurveTo(cx, sy - 4, cx + 9, sy + 1); g.stroke();
      g.beginPath(); g.moveTo(cx + 5, sy - 2); g.lineTo(cx + 7, sy - 5); g.moveTo(cx + 8, sy - 2); g.lineTo(cx + 10, sy - 5); g.stroke();
      break;
    case "tally": // the ledger's tallies
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * 5, sy - 4); g.lineTo(cx + i * 5 + (i === 2 ? -10 : 0), sy + 4); g.stroke(); }
      break;
    case "scales": // the court's scales
      g.beginPath(); g.moveTo(cx, sy - 4); g.lineTo(cx, sy + 3); g.moveTo(cx - 8, sy - 2); g.lineTo(cx + 8, sy - 2); g.stroke();
      g.beginPath(); g.arc(cx - 8, sy + 1, 3, 0, Math.PI, false); g.stroke();
      g.beginPath(); g.arc(cx + 8, sy + 1, 3, 0, Math.PI, false); g.stroke();
      break;
    case "star": // the watch-star
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4;
        g.beginPath(); g.moveTo(cx - Math.cos(a) * 6, sy - Math.sin(a) * 6); g.lineTo(cx + Math.cos(a) * 6, sy + Math.sin(a) * 6); g.stroke();
      }
      break;
    case "until": // the one word over the Undergate
      g.font = "bold 9px serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("UNTIL", cx, sy);
      g.textAlign = "left"; g.textBaseline = "alphabetic";
      break;
  }
}

/** Surface ruin dressing at a dungeon mouth: broken pillars, fallen arches,
 *  rubble drifts. The variant is hashed off the object id so a cluster of
 *  props reads as varied masonry without per-piece art wiring. */
function drawRuinProp(g: CanvasRenderingContext2D, cx: number, cy: number, id: string): void {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const v = Math.abs(h) % 3;
  shadow(g, cx, cy + 8, 12, 4);
  const STONE = "#8d8a80", DARK = "#6f6c62", MOSS = "#5d6b4a";
  if (v === 0) {
    // A snapped pillar: drum + tilted upper section beside it.
    g.fillStyle = STONE; g.fillRect(cx - 5, cy - 10, 10, 18);
    g.fillStyle = DARK; g.fillRect(cx - 6, cy - 12, 12, 3); // capital ring
    g.fillRect(cx - 5, cy - 4, 10, 1.5);
    g.save(); g.translate(cx + 9, cy + 5); g.rotate(0.9);
    g.fillStyle = DARK; g.fillRect(-4, -7, 8, 14); g.restore();
    g.fillStyle = MOSS; g.fillRect(cx - 5, cy + 4, 4, 4); // moss at the base
  } else if (v === 1) {
    // Half an arch, still springing from its pier.
    g.fillStyle = STONE; g.fillRect(cx - 9, cy - 6, 6, 14);
    g.strokeStyle = STONE; g.lineWidth = 5;
    g.beginPath(); g.arc(cx + 2, cy - 4, 9, Math.PI, Math.PI * 1.6); g.stroke();
    g.fillStyle = DARK; g.fillRect(cx - 10, cy - 8, 8, 3);
    g.fillStyle = MOSS; g.fillRect(cx - 9, cy + 4, 3.5, 4);
    g.fillStyle = DARK; g.fillRect(cx + 5, cy + 4, 6, 4); // the fallen keystone
  } else {
    // A rubble drift of dressed blocks.
    g.fillStyle = STONE;
    g.fillRect(cx - 10, cy + 1, 8, 6); g.fillRect(cx - 2, cy - 2, 9, 8);
    g.fillStyle = DARK; g.fillRect(cx + 3, cy + 3, 8, 5); g.fillRect(cx - 7, cy - 4, 7, 5);
    g.fillStyle = MOSS; g.fillRect(cx - 2, cy - 2, 4, 3);
  }
}

/** A homestead plot marker: a corner stake with a board (gold once claimed). */
function drawHousingPlot(g: CanvasRenderingContext2D, cx: number, cy: number, owned: boolean): void {
  shadow(g, cx, cy + 9, 7, 2.5);
  g.fillStyle = "#6e5436"; g.fillRect(cx - 1.5, cy - 9, 3, 18); // the post
  g.fillStyle = owned ? "#caa05a" : "#9a8f7d"; // claimed board reads warm gold
  g.fillRect(cx - 8, cy - 9, 16, 8);
  g.strokeStyle = "#3f3526"; g.lineWidth = 1; g.strokeRect(cx - 8, cy - 9, 16, 8);
  if (owned) {
    // a little dark home glyph: a roof over a doorway
    g.fillStyle = "#3f3526";
    g.beginPath(); g.moveTo(cx, cy - 8); g.lineTo(cx - 5, cy - 4.5); g.lineTo(cx + 5, cy - 4.5); g.closePath(); g.fill();
    g.fillRect(cx - 3.5, cy - 4.5, 7, 3.5);
    g.fillStyle = "#caa05a"; g.fillRect(cx - 1, cy - 3, 2, 2); // the doorway
  } else {
    g.fillStyle = "#6b6256"; g.fillRect(cx - 5, cy - 6.5, 10, 1.5); // a plain "vacant" rule
    g.fillRect(cx - 5, cy - 4, 7, 1.5);
  }
}

// --- Furniture drawing helpers ---------------------------------------------
const GOLD = "#d8b24a", GOLDLT = "#f2db84", GEM = "#7fd0e0";
/** A piece's rank within its category ladder (0 = first tier; `last` = top). */
function furnitureRank(content: Content, f: FurnitureDef | undefined): { idx: number; last: number } {
  if (!f) return { idx: 0, last: 0 };
  const ladder = Object.values(content.furniture).filter((x) => x.category === f.category).sort((a, b) => a.levelReq - b.levelReq);
  return { idx: Math.max(0, ladder.findIndex((x) => x.id === f.id)), last: ladder.length - 1 };
}
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function vgrad(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: string, bot: string): void {
  const lg = g.createLinearGradient(x, y, x, y + h); lg.addColorStop(0, top); lg.addColorStop(1, bot);
  g.fillStyle = lg; g.fillRect(x, y, w, h);
}
function sparkle(g: CanvasRenderingContext2D, x: number, y: number, now: number): void {
  const t = 0.3 + 0.7 * Math.abs(Math.sin(now / 260 + x * 0.4));
  g.globalAlpha = t; g.fillStyle = "#fff7d8";
  g.fillRect(x - 0.6, y - 2.5, 1.2, 5); g.fillRect(x - 2.5, y - 0.6, 5, 1.2);
  g.globalAlpha = 1;
}
/** Draw a real item's icon (a trophy on a display) centred at cx,cy — the same
 *  rasterised SVG badge ground loot uses. Until it decodes, a gem-glint stands in. */
function drawTrophy(g: CanvasRenderingContext2D, cx: number, cy: number, def: ItemDef): void {
  const img = groundItemImage(def);
  if (img) { g.drawImage(img, cx - 5, cy - 5, 10, 10); return; }
  g.fillStyle = GEM; g.fillRect(cx - 3, cy - 3, 2, 2); g.fillRect(cx + 1, cy + 1, 2, 3);
}

/** A floor carpet (drawn flat at floor level — you walk over it, so no shadow). */
function drawRug(g: CanvasRenderingContext2D, cx: number, cy: number, idx: number): void {
  const pal = [
    { base: "#8a6a44", edge: "#5f4730", motif: "#a07b48" }, // hide
    { base: "#883b39", edge: GOLD, motif: "#3f6a8a" },       // woven (red, gold border, blue motif)
    { base: "#9a8466", edge: "#5f4730", motif: "#b6a182" }, // fur (mottled tan)
    { base: "#5a2f6a", edge: GOLD, motif: "#a85fc0" },       // plush (royal purple + gold)
  ][idx] ?? { base: "#8a6a44", edge: "#5f4730", motif: "#a07b48" };
  g.fillStyle = pal.base; rrect(g, cx - 10, cy - 7, 20, 14, 2.5); g.fill();
  g.strokeStyle = pal.edge; g.lineWidth = 1.6; g.stroke();
  if (idx === 1) { g.strokeStyle = pal.motif; g.lineWidth = 1; g.strokeRect(cx - 6, cy - 4, 12, 8); g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(cx, cy + 4); g.stroke(); }
  else if (idx === 2) { g.fillStyle = pal.motif; for (const [dx, dy] of [[-6, -3], [0, 2], [6, -2], [-3, 4], [4, 4]] as const) g.fillRect(cx + dx, cy + dy, 2, 2); }
  else if (idx === 3) { g.strokeStyle = pal.motif; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 7, cy); g.lineTo(cx, cy + 5); g.lineTo(cx - 7, cy); g.closePath(); g.stroke(); g.fillStyle = GOLD; g.fillRect(cx - 1.5, cy - 1.5, 3, 3); }
  else { g.fillStyle = pal.motif; g.fillRect(cx - 7, cy - 1, 14, 1); }
  if (idx >= 1) { g.strokeStyle = pal.edge; g.lineWidth = 1; for (let i = -9; i <= 9; i += 3) { g.beginPath(); g.moveTo(cx + i, cy - 7); g.lineTo(cx + i, cy - 8.5); g.moveTo(cx + i, cy + 7); g.lineTo(cx + i, cy + 8.5); g.stroke(); } }
}

/** A build footing: an empty marked square, or the polished furniture built on it. */
/** A placed piece's footprint at a rotation: [w, h], swapped on an odd turn. */
function placedFootprint(f: FurnitureDef, rot: number): [number, number] {
  const [w, h] = f.footprint ?? [1, 1];
  return (rot & 1) === 1 ? [h, w] : [w, h];
}

/** Draw every piece the player has placed in their home, at its own tile +
 *  rotation (rugs first so furniture sits on top), reusing the hotspot art. */
function drawPlacedFurniture(
  g: CanvasRenderingContext2D,
  state: WorldState,
  content: Content,
  cam: Camera,
  now: number,
  lights: Array<[number, number]>,
  trophy: ItemDef | undefined,
): void {
  const placed = state.player.home.placed;
  if (!placed || placed.length === 0) return;
  // Rugs (floor coverings) and wall-hung art (against the wall behind) draw
  // first, under the standing furniture; then the rest, back-to-front by y.
  const backLayer = (id: string): boolean => { const f = content.furniture[id]; return f?.category === "rug" || !!f?.wall; };
  const order = placed
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (backLayer(a.p.item) ? 0 : 1) - (backLayer(b.p.item) ? 0 : 1) || a.p.y - b.p.y);
  for (const { p } of order) {
    const f = content.furniture[p.item];
    if (!f) continue;
    const [w, h] = placedFootprint(f, p.rot);
    const cx = (p.x + w / 2) * TILE - cam.x;
    // Wall-hung pieces ride up toward the wall behind their tile so they read as
    // mounted rather than standing on the floor.
    const cy = (p.y + h / 2) * TILE - cam.y - (f.wall ? TILE * 0.4 : 0);
    if (cx < -TILE * 2 || cy < -TILE * 2 || cx > g.canvas.width + TILE * 2 || cy > g.canvas.height + TILE * 2) continue;
    const [w0, h0] = f.footprint ?? [1, 1];
    g.save();
    g.translate(cx, cy);
    if (p.rot) g.rotate((p.rot & 3) * Math.PI / 2);
    if (f.render) {
      drawFurniturePiece(g, w0 * TILE, h0 * TILE, f, now);
    } else {
      const { idx, last } = furnitureRank(content, f);
      drawHotspot(g, 0, 0, f, idx, last, now, trophy); // stations keep bespoke art
    }
    g.restore();
    // A cooking hearth or any lighting piece warms the room.
    if (f.category === "kitchen" || f.light) lights.push([cx, cy]);
  }
}

/**
 * The data-driven furniture renderer: draws piece `f` centred at the current
 * transform origin, filling a box `bw × bh` pixels (its footprint), from its
 * `render` descriptor's shape + palette. Recolours come free — the same shape
 * with a different `wood` / `cloth` reads as a whole new item.
 */
function drawFurniturePiece(g: CanvasRenderingContext2D, bw: number, bh: number, f: FurnitureDef, now: number): void {
  const r = f.render!;
  const wood = r.wood ?? "#7e6a4e";
  const dark = r.accent ?? shade(wood, 0.62);
  const lite = shade(wood, 1.28);
  const cloth = r.cloth ?? "#8f7048";
  const M = 4;
  const L = -bw / 2 + M, R = bw / 2 - M, T = -bh / 2 + M, B = bh / 2 - M;
  const iw = R - L, ih = B - T;
  const shadow = (): void => { g.fillStyle = "rgba(0,0,0,0.22)"; g.beginPath(); g.ellipse(0, B - 1, iw * 0.42, ih * 0.12, 0, 0, Math.PI * 2); g.fill(); };
  const rect = (x: number, y: number, w: number, h: number, c: string): void => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const topLight = (x: number, y: number, w: number, hh: number): void => { g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(x, y, w, Math.max(1, hh * 0.12)); };

  switch (r.shape) {
    // ---- seating ----
    case "stool": {
      shadow();
      rect(L + iw * 0.2, 0, iw * 0.12, ih * 0.5, dark); rect(R - iw * 0.32, 0, iw * 0.12, ih * 0.5, dark); // legs
      g.fillStyle = wood; g.beginPath(); g.ellipse(0, -ih * 0.05, iw * 0.34, ih * 0.14, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case "chair": {
      shadow();
      rect(L + iw * 0.22, -ih * 0.05, iw * 0.1, ih * 0.5, dark); rect(R - iw * 0.32, -ih * 0.05, iw * 0.1, ih * 0.5, dark);
      rect(L + iw * 0.24, T, iw * 0.52, ih * 0.42, wood); topLight(L + iw * 0.24, T, iw * 0.52, ih * 0.42); // back
      rect(L + iw * 0.18, -ih * 0.1, iw * 0.64, ih * 0.16, r.cloth ? cloth : lite); // seat
      break;
    }
    case "armchair": {
      shadow();
      rect(L + iw * 0.06, -ih * 0.24, iw * 0.88, ih * 0.5, dark); // body
      rect(L + iw * 0.14, T + ih * 0.06, iw * 0.72, ih * 0.34, cloth); // back cushion
      rect(L + iw * 0.06, -ih * 0.1, iw * 0.16, ih * 0.34, shade(cloth, 0.8)); rect(R - iw * 0.22, -ih * 0.1, iw * 0.16, ih * 0.34, shade(cloth, 0.8)); // arms
      rect(L + iw * 0.2, -ih * 0.06, iw * 0.6, ih * 0.16, shade(cloth, 1.12)); // seat
      break;
    }
    case "sofa": {
      shadow();
      rect(L, -ih * 0.24, iw, ih * 0.5, dark);
      rect(L + iw * 0.08, T + ih * 0.06, iw * 0.84, ih * 0.32, cloth);
      rect(L, -ih * 0.12, iw * 0.12, ih * 0.36, shade(cloth, 0.8)); rect(R - iw * 0.12, -ih * 0.12, iw * 0.12, ih * 0.36, shade(cloth, 0.8));
      rect(L + iw * 0.14, -ih * 0.06, iw * 0.34, ih * 0.16, shade(cloth, 1.12)); rect(L + iw * 0.52, -ih * 0.06, iw * 0.34, ih * 0.16, shade(cloth, 1.12));
      break;
    }
    case "bench": {
      shadow();
      rect(L + iw * 0.08, 0, iw * 0.08, ih * 0.4, dark); rect(R - iw * 0.16, 0, iw * 0.08, ih * 0.4, dark);
      rect(L, -ih * 0.08, iw, ih * 0.14, wood); topLight(L, -ih * 0.08, iw, ih * 0.14);
      break;
    }
    case "throne": {
      shadow();
      rect(L + iw * 0.14, -ih * 0.1, iw * 0.72, ih * 0.5, dark);
      rect(L + iw * 0.2, T, iw * 0.6, ih * 0.5, wood); // tall back
      g.fillStyle = GOLD; g.fillRect(L + iw * 0.2, T, iw * 0.6, 2);
      rect(L + iw * 0.22, -ih * 0.06, iw * 0.56, ih * 0.16, cloth);
      g.fillStyle = GEM; g.beginPath(); g.arc(0, T + ih * 0.1, 2.2, 0, Math.PI * 2); g.fill();
      break;
    }
    // ---- tables ----
    case "sidetable": case "table": case "longtable": case "coffee": {
      shadow();
      for (const lx of [L + iw * 0.08, R - iw * 0.14]) { rect(lx, -ih * 0.1, iw * 0.07, ih * 0.5, dark); }
      rect(L, T + ih * 0.28, iw, ih * 0.18, wood); topLight(L, T + ih * 0.28, iw, ih * 0.18); // top
      break;
    }
    case "roundtable": {
      shadow();
      rect(-iw * 0.05, -ih * 0.1, iw * 0.1, ih * 0.5, dark); // pedestal
      g.fillStyle = wood; g.beginPath(); g.ellipse(0, T + ih * 0.34, iw * 0.46, ih * 0.16, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.10)"; g.beginPath(); g.ellipse(0, T + ih * 0.3, iw * 0.4, ih * 0.1, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case "desk": {
      shadow();
      rect(L + iw * 0.05, -ih * 0.02, iw * 0.9, ih * 0.42, wood); // body w/ drawer
      rect(L + iw * 0.12, ih * 0.06, iw * 0.3, ih * 0.16, dark); g.fillStyle = GOLD; g.fillRect(L + iw * 0.24, ih * 0.13, 3, 2);
      rect(L, T + ih * 0.2, iw, ih * 0.14, lite); topLight(L, T + ih * 0.2, iw, ih * 0.14);
      break;
    }
    // ---- beds ----
    case "bed": case "bedlarge": {
      shadow();
      rect(L, -ih * 0.28, iw, ih * 0.62, dark); // frame
      rect(L + iw * 0.06, T + ih * 0.14, iw * 0.88, ih * 0.5, "#ece2c8"); // sheet
      rect(L + iw * 0.06, T + ih * 0.14, iw * 0.88, ih * 0.2, cloth); // blanket top
      rect(L + iw * 0.12, T + ih * 0.05, iw * 0.34, ih * 0.14, "#fbf4e2"); // pillow
      rect(L, T, iw * 0.06, ih * 0.7, shade(wood, 0.7)); // headboard post
      break;
    }
    case "canopy": {
      shadow();
      rect(L, T, iw * 0.06, ih, dark); rect(R - iw * 0.06, T, iw * 0.06, ih * 0.5, dark); // posts
      rect(L, T, iw, ih * 0.08, shade(wood, 0.7)); // canopy rail
      g.fillStyle = withAlpha(cloth, 0.5); g.fillRect(R - iw * 0.18, T + ih * 0.06, iw * 0.18, ih * 0.7); // drape
      rect(L + iw * 0.06, T + ih * 0.2, iw * 0.84, ih * 0.62, dark);
      rect(L + iw * 0.1, T + ih * 0.26, iw * 0.78, ih * 0.5, "#ece2c8");
      rect(L + iw * 0.1, T + ih * 0.26, iw * 0.78, ih * 0.2, cloth);
      rect(L + iw * 0.16, T + ih * 0.18, iw * 0.3, ih * 0.12, "#fbf4e2");
      break;
    }
    // ---- storage boxes ----
    case "crate": {
      shadow(); rect(L + iw * 0.1, 0, iw * 0.8, ih * 0.5, wood);
      g.strokeStyle = dark; g.lineWidth = 1.4; g.strokeRect(L + iw * 0.1, 0, iw * 0.8, ih * 0.5);
      g.beginPath(); g.moveTo(L + iw * 0.1, 0); g.lineTo(R - iw * 0.1, ih * 0.5); g.moveTo(R - iw * 0.1, 0); g.lineTo(L + iw * 0.1, ih * 0.5); g.stroke();
      break;
    }
    case "drawers": case "sideboard": {
      shadow(); rect(L + iw * 0.06, -ih * 0.1, iw * 0.88, ih * 0.55, wood); topLight(L + iw * 0.06, -ih * 0.1, iw * 0.88, ih * 0.55);
      const rows = r.shape === "sideboard" ? 2 : 3;
      for (let i = 0; i < rows; i++) { const y = -ih * 0.06 + i * (ih * 0.5 / rows); rect(L + iw * 0.1, y, iw * 0.8, ih * 0.5 / rows - 2, shade(wood, 0.86)); g.fillStyle = GOLD; g.fillRect(-2, y + (ih * 0.5 / rows) / 2 - 1, 4, 1.6); }
      break;
    }
    case "wardrobe": {
      shadow(); rect(L + iw * 0.1, T + ih * 0.05, iw * 0.8, ih * 0.9, wood); topLight(L + iw * 0.1, T + ih * 0.05, iw * 0.8, ih * 0.1);
      g.strokeStyle = dark; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, T + ih * 0.08); g.lineTo(0, B - ih * 0.04); g.stroke();
      g.fillStyle = GOLD; g.fillRect(-3, 0, 1.6, 4); g.fillRect(1.4, 0, 1.6, 4);
      break;
    }
    case "cabinet": {
      shadow(); rect(L + iw * 0.1, -ih * 0.1, iw * 0.8, ih * 0.55, wood);
      rect(L + iw * 0.16, -ih * 0.04, iw * 0.68, ih * 0.42, withAlpha("#bcdfe6", 0.4)); // glass
      g.strokeStyle = dark; g.lineWidth = 1; g.strokeRect(L + iw * 0.16, -ih * 0.04, iw * 0.68, ih * 0.42);
      break;
    }
    case "bookshelf": {
      shadow(); rect(L + iw * 0.1, T + ih * 0.05, iw * 0.8, ih * 0.9, wood);
      const cols = ["#7a3b2c", "#3c5a44", "#4a4a6a", "#8a6a2c", "#5a3b6a"];
      for (let row = 0; row < 3; row++) { const y = T + ih * 0.12 + row * ih * 0.28; rect(L + iw * 0.12, y + ih * 0.18, iw * 0.76, 2, dark); for (let i = 0; i < 6; i++) { g.fillStyle = cols[(row + i) % cols.length]!; g.fillRect(L + iw * 0.14 + i * iw * 0.12, y, iw * 0.09, ih * 0.18); } }
      break;
    }
    // ---- lighting ----
    case "candle": {
      rect(-1.5, -ih * 0.1, 3, ih * 0.5, dark); // stand
      g.fillStyle = "#e8dcc0"; g.fillRect(-4, T + ih * 0.2, 3, ih * 0.24); g.fillRect(1, T + ih * 0.22, 3, ih * 0.22);
      flameFx(g, -2.5, T + ih * 0.2, now); flameFx(g, 2.5, T + ih * 0.22, now);
      break;
    }
    case "tablelamp": {
      rect(-1.5, ih * 0.06, 3, ih * 0.28, dark);
      g.fillStyle = withAlpha(r.glow ?? "#ffd27a", 0.85); g.beginPath(); g.moveTo(-iw * 0.22, ih * 0.06); g.lineTo(iw * 0.22, ih * 0.06); g.lineTo(iw * 0.14, T + ih * 0.15); g.lineTo(-iw * 0.14, T + ih * 0.15); g.closePath(); g.fill();
      break;
    }
    case "floorlamp": {
      rect(-1.5, T + ih * 0.3, 3, ih * 0.6, dark); g.fillStyle = dark; g.fillRect(-iw * 0.14, B - 2, iw * 0.28, 2);
      g.fillStyle = withAlpha(r.glow ?? "#ffd27a", 0.85); g.beginPath(); g.moveTo(-iw * 0.2, T + ih * 0.3); g.lineTo(iw * 0.2, T + ih * 0.3); g.lineTo(iw * 0.12, T + ih * 0.05); g.lineTo(-iw * 0.12, T + ih * 0.05); g.closePath(); g.fill();
      break;
    }
    case "lantern": {
      rect(-1, T, 2, ih * 0.2, dark); g.fillStyle = dark; g.fillRect(-iw * 0.14, T + ih * 0.2, iw * 0.28, ih * 0.42);
      g.fillStyle = withAlpha(r.glow ?? "#ffbe55", 0.9); g.fillRect(-iw * 0.1, T + ih * 0.26, iw * 0.2, ih * 0.3);
      break;
    }
    case "brazier": {
      rect(-iw * 0.06, 0, iw * 0.12, ih * 0.4, dark); g.fillStyle = dark; g.beginPath(); g.ellipse(0, -ih * 0.02, iw * 0.26, ih * 0.1, 0, 0, Math.PI * 2); g.fill();
      const fl = 0.5 + 0.5 * Math.sin(now / 110); g.fillStyle = withAlpha(r.glow ?? "#ff8a3a", 0.85); g.beginPath(); g.moveTo(0, -ih * 0.02 - ih * 0.25 * fl); g.lineTo(-iw * 0.16, -ih * 0.02); g.lineTo(iw * 0.16, -ih * 0.02); g.closePath(); g.fill();
      break;
    }
    case "chandelier": {
      g.strokeStyle = dark; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, T); g.lineTo(0, T + ih * 0.2); g.stroke();
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, T + ih * 0.28, iw * 0.34, ih * 0.08, 0, 0, Math.PI * 2); g.stroke();
      for (const ax of [-iw * 0.3, 0, iw * 0.3]) flameFx(g, ax, T + ih * 0.28, now);
      g.fillStyle = withAlpha(r.glow ?? "#ffe0a0", 0.3); g.beginPath(); g.arc(0, T + ih * 0.3, iw * 0.4, 0, Math.PI * 2); g.fill();
      break;
    }
    // ---- plants ----
    case "plant": case "tallplant": case "fern": {
      pot(g, 0, B, iw, ih, wood, dark);
      const tall = r.shape === "tallplant" ? 0.9 : 0.6;
      g.fillStyle = r.shape === "fern" ? "#4f7a3a" : "#3c6a34";
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.4; const len = ih * tall; g.beginPath(); g.moveTo(0, B - ih * 0.18); g.lineTo(Math.cos(a) * iw * 0.34, B - ih * 0.18 - Math.sin(-a) * 0 - len * (0.6 + 0.3 * Math.abs(Math.cos(a)))); g.lineWidth = 2.4; g.strokeStyle = i % 2 ? "#4f7a3a" : "#3c6a34"; g.stroke(); }
      break;
    }
    case "cactus": {
      pot(g, 0, B, iw, ih, wood, dark);
      g.fillStyle = "#4f7a3a"; g.fillRect(-iw * 0.1, B - ih * 0.6, iw * 0.2, ih * 0.42); g.fillRect(-iw * 0.28, B - ih * 0.45, iw * 0.14, ih * 0.12); g.fillRect(iw * 0.14, B - ih * 0.5, iw * 0.14, ih * 0.1);
      break;
    }
    case "flowerpot": {
      pot(g, 0, B, iw, ih, wood, dark);
      for (const [dx, c] of [[-iw * 0.2, "#d85a72"], [0, "#e8c45a"], [iw * 0.2, "#7a86d8"]] as const) { g.fillStyle = "#3c6a34"; g.fillRect(dx - 0.6, B - ih * 0.5, 1.4, ih * 0.32); g.fillStyle = c; g.beginPath(); g.arc(dx, B - ih * 0.52, iw * 0.08, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case "tree": {
      g.fillStyle = dark; g.fillRect(-iw * 0.16, B - ih * 0.16, iw * 0.32, ih * 0.14); // pot
      g.fillStyle = "#5a3f26"; g.fillRect(-iw * 0.05, B - ih * 0.6, iw * 0.1, ih * 0.46); // trunk
      g.fillStyle = "#3c6a34"; g.beginPath(); g.ellipse(0, T + ih * 0.28, iw * 0.4, ih * 0.28, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4f7a3a"; g.beginPath(); g.ellipse(-iw * 0.12, T + ih * 0.24, iw * 0.2, ih * 0.16, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    // ---- pots / barrels ----
    case "vase": {
      shadow(); g.fillStyle = wood; g.beginPath(); g.moveTo(-iw * 0.14, 0); g.quadraticCurveTo(-iw * 0.3, T + ih * 0.4, -iw * 0.12, T + ih * 0.1); g.lineTo(iw * 0.12, T + ih * 0.1); g.quadraticCurveTo(iw * 0.3, T + ih * 0.4, iw * 0.14, 0); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(-iw * 0.1, T + ih * 0.15, 2, ih * 0.4);
      break;
    }
    case "urn": case "barrel": {
      shadow(); g.fillStyle = wood; g.beginPath(); g.ellipse(0, 0, iw * 0.26, ih * 0.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = dark; g.fillRect(-iw * 0.26, -ih * 0.14, iw * 0.52, 2); g.fillRect(-iw * 0.26, ih * 0.12, iw * 0.52, 2);
      break;
    }
    case "statue": {
      shadow(); g.fillStyle = dark; g.fillRect(-iw * 0.2, ih * 0.2, iw * 0.4, ih * 0.24); // plinth
      g.fillStyle = wood; g.fillRect(-iw * 0.08, T + ih * 0.2, iw * 0.16, ih * 0.5); g.beginPath(); g.arc(0, T + ih * 0.18, iw * 0.1, 0, Math.PI * 2); g.fill();
      break;
    }
    case "bust": {
      shadow(); g.fillStyle = dark; g.fillRect(-iw * 0.16, ih * 0.16, iw * 0.32, ih * 0.24);
      g.fillStyle = wood; g.fillRect(-iw * 0.16, 0, iw * 0.32, ih * 0.2); g.beginPath(); g.arc(0, -ih * 0.02, iw * 0.14, 0, Math.PI * 2); g.fill();
      break;
    }
    case "globe": {
      shadow(); g.fillStyle = dark; g.fillRect(-2, ih * 0.05, 4, ih * 0.35); g.fillStyle = "#3a5a7a"; g.beginPath(); g.arc(0, -ih * 0.06, iw * 0.24, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4f7a3a"; g.beginPath(); g.arc(-iw * 0.06, -ih * 0.1, iw * 0.08, 0, Math.PI * 2); g.fill();
      g.strokeStyle = GOLD; g.lineWidth = 1; g.beginPath(); g.arc(0, -ih * 0.06, iw * 0.27, 0, Math.PI * 2); g.stroke();
      break;
    }
    case "screen": {
      shadow(); for (let i = 0; i < 3; i++) { const x = L + iw * 0.06 + i * iw * 0.3; g.fillStyle = i % 2 ? shade(cloth, 0.9) : cloth; g.fillRect(x, T + ih * 0.1, iw * 0.28, ih * 0.8); g.strokeStyle = dark; g.lineWidth = 1; g.strokeRect(x, T + ih * 0.1, iw * 0.28, ih * 0.8); }
      break;
    }
    case "birdcage": {
      shadow(); rect(-1.5, ih * 0.06, 3, ih * 0.34, dark); g.strokeStyle = wood; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(0, -ih * 0.06, iw * 0.2, ih * 0.3, 0, 0, Math.PI * 2); g.stroke();
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * iw * 0.06, -ih * 0.34); g.lineTo(i * iw * 0.06, ih * 0.2); g.stroke(); }
      g.fillStyle = "#e8c45a"; g.beginPath(); g.arc(0, 0, 2, 0, Math.PI * 2); g.fill();
      break;
    }
    case "easel": {
      shadow(); g.strokeStyle = dark; g.lineWidth = 2; g.beginPath(); g.moveTo(0, T + ih * 0.1); g.lineTo(-iw * 0.24, B); g.moveTo(0, T + ih * 0.1); g.lineTo(iw * 0.24, B); g.stroke();
      g.fillStyle = wood; g.fillRect(-iw * 0.2, T + ih * 0.15, iw * 0.4, ih * 0.4); g.fillStyle = "#3a5a7a"; g.fillRect(-iw * 0.16, T + ih * 0.2, iw * 0.32, ih * 0.3);
      break;
    }
    case "harp": {
      shadow(); g.strokeStyle = wood; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-iw * 0.2, B); g.quadraticCurveTo(-iw * 0.34, T + ih * 0.2, iw * 0.14, T); g.lineTo(-iw * 0.2, B); g.stroke();
      g.strokeStyle = withAlpha("#e8dcc0", 0.7); g.lineWidth = 0.6; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-iw * 0.2 + i * iw * 0.05, B); g.lineTo(-iw * 0.1 + i * iw * 0.04, T + ih * 0.1); g.stroke(); }
      break;
    }
    case "fountain": {
      shadow(); g.fillStyle = wood; g.beginPath(); g.ellipse(0, ih * 0.2, iw * 0.4, ih * 0.18, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = withAlpha("#6fb0c8", 0.7); g.beginPath(); g.ellipse(0, ih * 0.18, iw * 0.34, ih * 0.13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = wood; g.fillRect(-iw * 0.05, T + ih * 0.2, iw * 0.1, ih * 0.4);
      g.fillStyle = withAlpha("#bfe6ef", 0.6); g.fillRect(-1.5, T + ih * 0.1, 3, ih * 0.3);
      break;
    }
    // ---- wall-hung (drawn high, no shadow) ----
    case "painting": case "map": {
      rect(L + iw * 0.12, T + ih * 0.08, iw * 0.76, ih * 0.62, dark);
      rect(L + iw * 0.18, T + ih * 0.14, iw * 0.64, ih * 0.5, r.shape === "map" ? "#cabf9e" : wood);
      if (r.shape === "map") { g.strokeStyle = "#5a4630"; g.lineWidth = 0.6; g.beginPath(); g.moveTo(L + iw * 0.2, 0); g.lineTo(R - iw * 0.2, -ih * 0.05); g.stroke(); }
      else { g.fillStyle = shade(wood, 1.3); g.beginPath(); g.moveTo(L + iw * 0.2, T + ih * 0.5); g.lineTo(0, T + ih * 0.28); g.lineTo(R - iw * 0.2, T + ih * 0.5); g.fill(); }
      break;
    }
    case "tapestry": case "banner": {
      g.fillStyle = cloth; g.beginPath(); g.moveTo(L + iw * 0.24, T); g.lineTo(R - iw * 0.24, T); g.lineTo(R - iw * 0.24, B - ih * 0.1); g.lineTo(0, B); g.lineTo(L + iw * 0.24, B - ih * 0.1); g.closePath(); g.fill();
      g.fillStyle = shade(cloth, 1.3); g.fillRect(-1.5, T + ih * 0.1, 3, ih * 0.6); g.fillStyle = GOLD; g.beginPath(); g.arc(0, T + ih * 0.3, iw * 0.08, 0, Math.PI * 2); g.fill();
      break;
    }
    case "mirror": {
      rect(L + iw * 0.2, T + ih * 0.05, iw * 0.6, ih * 0.8, wood);
      rect(L + iw * 0.26, T + ih * 0.11, iw * 0.48, ih * 0.68, "#bcdfe6"); g.fillStyle = "rgba(255,255,255,0.2)"; g.beginPath(); g.moveTo(L + iw * 0.28, T + ih * 0.6); g.lineTo(L + iw * 0.42, T + ih * 0.12); g.lineTo(L + iw * 0.5, T + ih * 0.12); g.lineTo(L + iw * 0.3, T + ih * 0.7); g.fill();
      break;
    }
    case "clock": {
      g.fillStyle = wood; g.beginPath(); g.arc(0, T + ih * 0.4, iw * 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e8dcc0"; g.beginPath(); g.arc(0, T + ih * 0.4, iw * 0.22, 0, Math.PI * 2); g.fill();
      g.strokeStyle = dark; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, T + ih * 0.4); g.lineTo(0, T + ih * 0.26); g.moveTo(0, T + ih * 0.4); g.lineTo(iw * 0.12, T + ih * 0.42); g.stroke();
      break;
    }
    case "shield": {
      g.fillStyle = wood; g.beginPath(); g.moveTo(0, T); g.lineTo(R - iw * 0.24, T + ih * 0.2); g.lineTo(0, B); g.lineTo(L + iw * 0.24, T + ih * 0.2); g.closePath(); g.fill();
      g.strokeStyle = GOLD; g.lineWidth = 1.4; g.stroke(); g.fillStyle = shade(wood, 1.3); g.beginPath(); g.arc(0, T + ih * 0.35, iw * 0.08, 0, Math.PI * 2); g.fill();
      break;
    }
    case "antlers": {
      g.fillStyle = dark; g.fillRect(-iw * 0.12, T + ih * 0.4, iw * 0.24, ih * 0.16); g.strokeStyle = "#d8cba8"; g.lineWidth = 2;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, T + ih * 0.4); g.quadraticCurveTo(s * iw * 0.3, T + ih * 0.1, s * iw * 0.24, T); g.moveTo(s * iw * 0.14, T + ih * 0.2); g.lineTo(s * iw * 0.32, T + ih * 0.15); g.stroke(); }
      break;
    }
    // ---- rugs ----
    case "rug": {
      g.fillStyle = cloth; g.fillRect(L - M, T - M, iw + M * 2, ih + M * 2);
      g.strokeStyle = shade(cloth, 1.18); g.lineWidth = 1.5; g.strokeRect(L, T, iw, ih);
      g.strokeStyle = shade(cloth, 0.72); g.lineWidth = 1; g.strokeRect(L + 4, T + 4, iw - 8, ih - 8);
      g.fillStyle = shade(cloth, 1.12); g.beginPath(); g.ellipse(0, 0, iw * 0.16, ih * 0.16, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case "hide": {
      g.fillStyle = wood; g.beginPath(); g.ellipse(0, 0, iw * 0.5, ih * 0.42, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(wood, 0.8); for (let i = 0; i < 5; i++) g.fillRect(-iw * 0.3 + i * iw * 0.14, -ih * 0.1, 3, ih * 0.2);
      break;
    }
    default: {
      shadow(); rect(L + iw * 0.1, 0, iw * 0.8, ih * 0.5, wood); topLight(L + iw * 0.1, 0, iw * 0.8, ih * 0.5);
    }
  }
}

/** A little pot base for plants. */
function pot(g: CanvasRenderingContext2D, cx: number, base: number, iw: number, ih: number, wood: string, dark: string): void {
  g.fillStyle = "rgba(0,0,0,0.2)"; g.beginPath(); g.ellipse(cx, base - 1, iw * 0.24, ih * 0.08, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = wood; g.beginPath(); g.moveTo(cx - iw * 0.2, base - ih * 0.2); g.lineTo(cx + iw * 0.2, base - ih * 0.2); g.lineTo(cx + iw * 0.14, base); g.lineTo(cx - iw * 0.14, base); g.closePath(); g.fill();
  g.fillStyle = dark; g.fillRect(cx - iw * 0.2, base - ih * 0.22, iw * 0.4, ih * 0.05);
}
/** A small flame for candles/braziers. */
function flameFx(g: CanvasRenderingContext2D, x: number, y: number, now: number): void {
  const fl = 0.6 + 0.4 * Math.sin(now / 90 + x);
  g.fillStyle = `rgba(255,180,70,${0.7 + 0.25 * fl})`; g.beginPath(); g.moveTo(x, y - 5 - 2 * fl); g.lineTo(x - 2, y); g.lineTo(x + 2, y); g.closePath(); g.fill();
  g.fillStyle = "#fff2c8"; g.fillRect(x - 0.8, y - 2, 1.6, 2);
}
/** Multiply a hex colour toward light (>1) or dark (<1). */
function shade(hex: string, k: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = Math.min(255, Math.round(parseInt(n.slice(0, 2), 16) * k));
  const gg = Math.min(255, Math.round(parseInt(n.slice(2, 4), 16) * k));
  const b = Math.min(255, Math.round(parseInt(n.slice(4, 6), 16) * k));
  return `rgb(${r},${gg},${b})`;
}
function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`;
}

function drawHotspot(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  f: FurnitureDef | undefined,
  idx: number,
  last: number,
  now: number,
  trophy?: ItemDef,
): void {
  if (!f) {
    g.strokeStyle = "rgba(150,128,92,0.7)"; g.lineWidth = 1.4;
    g.setLineDash([3, 3]); g.strokeRect(cx - 8, cy - 6, 16, 12); g.setLineDash([]);
    g.fillStyle = "#6e5436";
    for (const [dx, dy] of [[-8, -6], [8, -6], [-8, 6], [8, 6]] as const) g.fillRect(cx + dx - 1, cy + dy - 1, 2, 2);
    return;
  }
  if (f.category === "rug") { drawRug(g, cx, cy, idx); return; } // floor-level
  const top = idx === last; // the showpiece tier gets gold + a sparkle
  shadow(g, cx, cy + 8, 9, 3);
  switch (f.category) {
    case "kitchen": {
      vgrad(g, cx - 9, cy - 3, 18, 11, idx >= 2 ? "#5a5f68" : idx ? "#666b74" : "#857e72", "#3e424a"); // body
      g.fillStyle = "#4b4f56"; g.fillRect(cx - 9, cy - 4, 18, 2.5); // mantel/flue
      if (idx) { g.fillStyle = "#2b2e34"; g.fillRect(cx + 3, cy - 4, 5, 2.5); }
      if (idx >= 2) { g.fillStyle = "#2b2e34"; g.fillRect(cx - 8, cy - 4, 5, 2.5); g.fillStyle = GOLD; g.fillRect(cx - 9, cy - 4.6, 18, 1); }
      g.fillStyle = "#241d18"; g.fillRect(cx - 5, cy + 1, 10, 7); // firebox
      const fl = 0.5 + 0.5 * Math.sin(now / 110);
      g.fillStyle = `rgba(240,150,40,${0.65 + 0.3 * fl})`; g.beginPath(); g.moveTo(cx, cy - 2 - 2 * fl); g.lineTo(cx - 3.5, cy + 7); g.lineTo(cx + 3.5, cy + 7); g.closePath(); g.fill();
      g.fillStyle = "#ffd86a"; g.beginPath(); g.moveTo(cx, cy + 1 - 2 * fl); g.lineTo(cx - 1.6, cy + 7); g.lineTo(cx + 1.6, cy + 7); g.closePath(); g.fill();
      break;
    }
    case "forge": {
      g.fillStyle = idx >= 2 ? "#4a3026" : "#6e5436"; g.fillRect(cx - 7, cy + 1, 14, 7); // base/stump
      vgrad(g, cx - 8, cy - 4, 16, 5, idx ? "#6a6f79" : "#5b5f68", idx ? "#3a3e45" : "#33363c"); // anvil top
      g.fillStyle = idx ? "#4a4e57" : "#44474d"; g.fillRect(cx - 2, cy, 4, 2); // waist
      g.fillStyle = idx ? "#7c828c" : "#6a6f79"; g.fillRect(cx - 9, cy - 4, 3, 2); // horn
      const gl = 0.5 + 0.5 * Math.sin(now / 90);
      g.fillStyle = `rgba(255,140,40,${0.6 + 0.35 * gl})`; g.fillRect(cx + 1, cy - 4, 3, 2); // hot billet
      if (idx >= 1) { g.fillStyle = "#caa05a"; g.fillRect(cx + 4, cy - 7, 1.6, 3.5); }
      if (idx >= 2) { g.fillStyle = `rgba(255,90,30,${0.4 + 0.3 * gl})`; g.fillRect(cx - 6, cy + 8, 12, 1.5); sparkle(g, cx + 3, cy - 3, now); }
      break;
    }
    case "alchemy": {
      g.fillStyle = idx ? "#7a4a52" : "#4a3f3a"; g.fillRect(cx - 6, cy + 2, 12, 4); // trivet/coals
      g.fillStyle = idx >= 2 ? GOLD : idx ? "#6b7a82" : "#3a3a40"; g.beginPath(); g.arc(cx, cy + 1, 6, 0, Math.PI * 2); g.fill(); // belly
      g.fillStyle = "#7fb89a"; g.beginPath(); g.ellipse(cx, cy - 3, 5, 1.8, 0, 0, Math.PI * 2); g.fill(); // brew
      if (Math.sin(now / 160) > 0.6) { g.fillStyle = "#bfe6cf"; g.fillRect(cx - 1, cy - 6, 1.5, 1.5); }
      if (idx >= 1) { g.strokeStyle = GEM; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + 6, cy - 6); g.lineTo(cx + 8, cy + 2); g.stroke(); g.fillStyle = "rgba(150,220,235,0.5)"; g.fillRect(cx + 6, cy - 6, 2, 3); }
      if (idx >= 2) { g.fillStyle = GEM; g.fillRect(cx - 2, cy - 7, 1.6, 2); sparkle(g, cx - 6, cy - 5, now); }
      break;
    }
    case "storage": {
      const wood = idx >= 2 ? ["#3f3c38", "#2c2a27"] : idx ? ["#4f3826", "#3a281a"] : ["#8a5532", "#5e3f1d"];
      vgrad(g, cx - 9, cy - 2, 18, 10, wood[0]!, wood[1]!); // body
      g.fillStyle = wood[1]!; rrect(g, cx - 9, cy - 6, 18, 5, 2); g.fill(); // domed lid
      g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(cx - 9, cy - 6, 18, 1.4);
      g.fillStyle = idx >= 2 ? GOLD : idx ? "#8a3f33" : "#9a9088"; g.fillRect(cx - 7, cy - 6, 2, 14); g.fillRect(cx + 5, cy - 6, 2, 14); // straps
      g.fillStyle = idx >= 2 ? GEM : "#d9b36a"; g.fillRect(cx - 1.4, cy - 1, 2.8, 3); // lock
      if (top) sparkle(g, cx + 6, cy - 6, now);
      break;
    }
    case "workshop": {
      const wood = idx ? ["#5a4632", "#3c2e1f"] : ["#8a5532", "#5a4026"];
      g.fillStyle = "#4a3a28"; g.fillRect(cx - 8, cy + 2, 2.5, 7); g.fillRect(cx + 5.5, cy + 2, 2.5, 7); // legs
      vgrad(g, cx - 10, cy - 2, 20, 5, wood[0]!, wood[1]!); // bench top
      if (idx) { g.fillStyle = "#7c828c"; g.fillRect(cx - 10, cy - 2.5, 20, 1.6); } // stone-topped
      g.fillStyle = "#8a8f99"; g.fillRect(cx - 6, cy - 6, 3, 5); // a vice
      if (idx >= 2) { g.fillStyle = "#8a8f99"; g.fillRect(cx + 3, cy - 6, 3, 5); g.fillStyle = GOLD; g.fillRect(cx - 10, cy - 2.9, 20, 1); }
      g.strokeStyle = "#c9b070"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + 1, cy + 2); g.lineTo(cx + 7, cy + 6); g.stroke(); // saw
      break;
    }
    case "bed": {
      const wood = [["#9c7a48", "#6e5436"], ["#7e5a34", "#553d24"], ["#5c4730", "#3c2e1f"], ["#6a3340", "#43232c"]][idx]!;
      const blanket = ["#b3a06e", "#8f7048", "#6f6256", "#8a3f5a"][idx]!;
      if (idx === 3) { g.fillStyle = wood[1]!; g.fillRect(cx - 11, cy - 10, 3, 18); g.fillRect(cx + 8, cy - 10, 3, 6); g.fillRect(cx - 11, cy - 10, 22, 2.5); g.fillStyle = "rgba(150,40,70,0.45)"; g.fillRect(cx + 5, cy - 8, 6, 14); }
      vgrad(g, cx - 9, cy - 6, 19, 13, wood[0]!, wood[1]!); // base
      g.fillStyle = wood[1]!; g.fillRect(cx - 11, cy - 7, 3, 15); // headboard
      g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(cx - 11, cy - 7, 3, 2);
      g.fillStyle = "#ece2c8"; g.fillRect(cx - 8, cy - 5, 8, 12); // sheet
      g.fillStyle = blanket; g.fillRect(cx - 1, cy - 5, 10, 12); // blanket
      g.fillStyle = "#f6efdc"; rrect(g, cx - 8, cy - 5, 7, 4, 1.5); g.fill(); // pillow
      if (idx === 2) { g.fillStyle = "#9a8466"; g.fillRect(cx - 1, cy + 3, 10, 4); } // foot pelt
      if (idx === 3) { g.fillStyle = GOLD; g.fillRect(cx - 1, cy - 5, 10, 1.4); sparkle(g, cx + 9, cy - 9, now); }
      break;
    }
    case "table": {
      const wood = [["#a07b48", "#6e5436"], ["#85602f", "#5a4026"], ["#5f4a30", "#3c2e1f"], [GOLD, "#9a7a2f"]][idx]!;
      g.fillStyle = wood[1]!; g.fillRect(cx - 8, cy + 2, 2.5, 7); g.fillRect(cx + 5.5, cy + 2, 2.5, 7); // legs
      vgrad(g, cx - 10, cy - 3, 20, 6, wood[0]!, wood[1]!); // top
      g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(cx - 10, cy - 3, 20, 1.4); // highlight
      if (idx === 1) { g.strokeStyle = wood[1]!; g.lineWidth = 1; for (let i = -6; i <= 6; i += 4) { g.beginPath(); g.moveTo(cx + i, cy + 1); g.lineTo(cx + i, cy + 3); g.stroke(); } }
      if (idx === 2) { g.fillStyle = "#8a8f99"; g.fillRect(cx - 9, cy + 2.4, 18, 1.4); g.fillRect(cx - 7, cy - 3, 1.6, 6); g.fillRect(cx + 5.4, cy - 3, 1.6, 6); }
      if (idx === 3) { g.fillStyle = GOLDLT; g.fillRect(cx - 9, cy - 2.2, 18, 1); g.fillStyle = GEM; g.fillRect(cx - 1, cy - 1.4, 2, 2); sparkle(g, cx + 7, cy - 2, now); }
      break;
    }
    case "seating": {
      const wood = [["#a07b48", "#6e5436"], ["#85602f", "#5a4026"], ["#5f4a30", "#3c2e1f"], [GOLD, "#9a7a2f"]][idx]!;
      if (idx === 0) {
        for (const sx of [-5, 5]) { g.fillStyle = wood[0]!; g.fillRect(cx + sx - 3, cy - 1, 6, 3); g.fillStyle = wood[1]!; g.fillRect(cx + sx - 2.5, cy + 2, 1.4, 5); g.fillRect(cx + sx + 1, cy + 2, 1.4, 5); }
        break;
      }
      g.fillStyle = wood[1]!; g.fillRect(cx - 7, cy - 8, 14, 4); // back rail
      vgrad(g, cx - 7, cy - 4, 14, 11, wood[0]!, wood[1]!); // body
      g.fillStyle = idx === 3 ? "#7a2f3a" : idx === 2 ? "#7a5038" : "#8f7048"; g.fillRect(cx - 5, cy - 1, 10, 6); // cushion
      if (idx >= 2) { g.fillStyle = "#9a8466"; g.fillRect(cx - 6, cy + 4, 12, 3); } // draped pelt
      g.fillStyle = wood[1]!; g.fillRect(cx - 8, cy - 2, 2, 9); g.fillRect(cx + 6, cy - 2, 2, 9); // arms
      if (idx === 3) { g.fillStyle = GOLDLT; g.fillRect(cx - 7, cy - 8, 14, 1.2); g.fillRect(cx - 8, cy - 2, 2, 1.2); g.fillRect(cx + 6, cy - 2, 2, 1.2); sparkle(g, cx, cy - 9, now); }
      break;
    }
    case "hall": {
      if (idx === 0) { vgrad(g, cx - 10, cy - 9, 20, 16, "#cdbfa0", "#b3a585"); g.strokeStyle = "rgba(120,100,70,0.4)"; g.lineWidth = 1; g.strokeRect(cx - 10, cy - 9, 20, 16); g.beginPath(); g.moveTo(cx - 10, cy - 1); g.lineTo(cx + 10, cy - 1); g.stroke(); }
      else if (idx === 1) { g.fillStyle = "#9a7b4e"; g.fillRect(cx - 10, cy - 9, 20, 16); g.strokeStyle = "#5a4026"; g.lineWidth = 2; g.strokeRect(cx - 10, cy - 9, 20, 16); g.beginPath(); g.moveTo(cx - 10, cy - 9); g.lineTo(cx + 10, cy + 7); g.moveTo(cx + 10, cy - 9); g.lineTo(cx - 10, cy + 7); g.moveTo(cx, cy - 9); g.lineTo(cx, cy + 7); g.stroke(); }
      else if (idx === 2) { g.fillStyle = "#83796b"; g.fillRect(cx - 10, cy - 9, 20, 16); g.fillStyle = "#6e4a2c"; g.fillRect(cx - 10, cy - 4, 20, 4); g.fillStyle = "#6b6f78"; g.fillRect(cx - 7, cy, 14, 8); g.strokeStyle = "rgba(0,0,0,0.2)"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 8); g.stroke(); }
      else { g.fillStyle = "#8b8478"; g.fillRect(cx - 10, cy - 9, 20, 16); g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy + 1, 7, Math.PI, 0); g.stroke(); g.fillStyle = "#6f6a60"; g.fillRect(cx - 8, cy + 1, 16, 7); g.fillStyle = GOLDLT; g.fillRect(cx - 10, cy - 9, 20, 1.4); sparkle(g, cx + 7, cy - 7, now); }
      break;
    }
    case "lighting": {
      const fl = 0.55 + 0.45 * Math.sin(now / 130);
      if (idx === 0) { // candle stand
        g.fillStyle = "#6e5436"; g.fillRect(cx - 1.5, cy - 2, 3, 9); g.fillRect(cx - 4, cy + 6, 8, 2);
        g.fillStyle = "#efe7d2"; g.fillRect(cx - 3, cy - 5, 1.5, 3); g.fillRect(cx + 1.5, cy - 5, 1.5, 3);
        g.fillStyle = `rgba(255,210,90,${fl})`; g.beginPath(); g.arc(cx - 2.2, cy - 6, 1.5, 0, Math.PI * 2); g.arc(cx + 2.2, cy - 6, 1.5, 0, Math.PI * 2); g.fill();
      } else if (idx === 1) { // knucklestone lamp
        g.fillStyle = "#5a4632"; g.fillRect(cx - 1.5, cy + 1, 3, 7); g.fillStyle = "#7c8088"; g.fillRect(cx - 3, cy - 5, 6, 6);
        g.fillStyle = `rgba(255,210,120,${0.45 + 0.4 * fl})`; g.fillRect(cx - 2, cy - 4, 4, 4); g.strokeStyle = "#7c8088"; g.lineWidth = 1; g.strokeRect(cx - 3, cy - 5, 6, 6);
      } else if (idx === 2) { // iron chandelier
        g.strokeStyle = "#3b3e45"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, cy - 11); g.lineTo(cx, cy - 6); g.stroke();
        g.strokeStyle = "#4a4e57"; g.beginPath(); g.ellipse(cx, cy - 3, 9, 3, 0, 0, Math.PI * 2); g.stroke();
        for (const dx of [-8, -3, 3, 8]) { g.fillStyle = `rgba(255,205,90,${fl})`; g.beginPath(); g.arc(cx + dx, cy - 4, 1.8, 0, Math.PI * 2); g.fill(); }
      } else { // gold lamp / crystal standard
        g.strokeStyle = GOLD; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx, cy - 6); g.stroke();
        g.fillStyle = GOLD; g.beginPath(); g.ellipse(cx, cy - 3, 10, 3.2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = GOLDLT; g.beginPath(); g.ellipse(cx, cy - 3.6, 10, 1.4, 0, 0, Math.PI * 2); g.fill();
        for (const dx of [-9, -4.5, 0, 4.5, 9]) { g.fillStyle = `rgba(255,225,140,${fl})`; g.beginPath(); g.arc(cx + dx, cy - 2, 1.8, 0, Math.PI * 2); g.fill(); g.fillStyle = GEM; g.fillRect(cx + dx - 0.6, cy + 1, 1.2, 2); }
        sparkle(g, cx, cy - 10, now);
      }
      break;
    }
    case "display": {
      if (idx === 0) { // curio shelf
        g.fillStyle = "#7a5532"; rrect(g, cx - 9, cy - 7, 18, 14, 1.5); g.fill();
        g.fillStyle = "#4a3a28"; g.fillRect(cx - 8, cy - 3, 16, 1.5); g.fillRect(cx - 8, cy + 2, 16, 1.5);
        g.fillStyle = GEM; for (const dx of [-6, 0, 6]) g.fillRect(cx + dx - 1, cy - 6, 2, 2); g.fillStyle = "#caa24a"; for (const dx of [-3, 4]) g.fillRect(cx + dx, cy - 1, 2, 2);
      } else if (idx === 1) { // trophy mount
        g.fillStyle = "#5a4632"; rrect(g, cx - 9, cy - 8, 18, 16, 2); g.fill();
        g.fillStyle = "#9a8466"; g.fillRect(cx - 6, cy - 1, 12, 7); g.fillStyle = "#ece2c8"; g.beginPath(); g.arc(cx, cy - 4, 3.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#cfc4ad"; g.fillRect(cx - 6, cy - 7, 2, 4); g.fillRect(cx + 4, cy - 7, 2, 4);
      } else if (idx === 2) { // glass cabinet — shows your real trophy item
        g.fillStyle = "#5a4026"; g.fillRect(cx - 9, cy - 9, 18, 18); g.fillStyle = "rgba(150,210,225,0.30)"; g.fillRect(cx - 7, cy - 7, 14, 15);
        g.strokeStyle = "#3a2e1f"; g.lineWidth = 1; g.strokeRect(cx - 7, cy - 7, 14, 15); g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx, cy + 8); g.moveTo(cx - 7, cy); g.lineTo(cx + 7, cy); g.stroke();
        if (trophy) drawTrophy(g, cx, cy, trophy); else { g.fillStyle = GEM; g.fillRect(cx - 4, cy - 4, 2, 2); g.fillRect(cx + 2, cy + 2, 2, 3); }
      } else { // gold display case — your rarest possession, lit and on a pedestal
        g.fillStyle = GOLD; g.fillRect(cx - 8, cy - 9, 16, 18); g.fillStyle = GOLDLT; g.fillRect(cx - 8, cy - 9, 16, 1.5);
        g.fillStyle = "rgba(150,220,235,0.35)"; g.fillRect(cx - 6, cy - 7, 12, 14);
        g.fillStyle = `rgba(190,230,240,${0.5 + 0.3 * Math.sin(now / 200)})`; g.fillRect(cx - 5, cy - 6, 10, 2);
        if (trophy) drawTrophy(g, cx, cy - 0.5, trophy); else { g.fillStyle = GEM; g.fillRect(cx - 1.5, cy - 2, 3, 5); }
        sparkle(g, cx + 6, cy - 8, now);
      }
      break;
    }
  }
}

/** An Agility obstacle, drawn by its variant (log, net, rope, wall, stones, beam). */
function drawObstacle(
  g: CanvasRenderingContext2D,
  variant: string | undefined,
  cx: number,
  cy: number,
): void {
  shadow(g, cx, cy + 11, 9, 3);
  const wood = "#7a5a36", woodDk = "#5a4026", rope = "#b59a5e";
  switch (variant) {
    case "net": { // a climbing net on a frame
      g.strokeStyle = woodDk; g.lineWidth = 2.5;
      g.strokeRect(cx - 11, cy - 12, 22, 24);
      g.strokeStyle = rope; g.lineWidth = 1;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(cx - 11 + i * 4.4, cy - 12); g.lineTo(cx - 11 + i * 4.4, cy + 12); g.stroke(); }
      for (let j = 1; j < 5; j++) { g.beginPath(); g.moveTo(cx - 11, cy - 12 + j * 4.8); g.lineTo(cx + 11, cy - 12 + j * 4.8); g.stroke(); }
      break;
    }
    case "rope": { // a rope swing from a beam
      g.strokeStyle = woodDk; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 12, cy - 12); g.lineTo(cx + 12, cy - 12); g.stroke();
      g.strokeStyle = rope; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx - 4, cy + 9); g.stroke();
      g.fillStyle = wood; g.fillRect(cx - 7, cy + 9, 8, 2.5); // the swing seat
      break;
    }
    case "wall": { // a wall to scramble over
      g.fillStyle = "#8a8278"; g.fillRect(cx - 11, cy - 9, 22, 20);
      g.strokeStyle = "#5b554c"; g.lineWidth = 1;
      g.strokeRect(cx - 11, cy - 9, 22, 20);
      g.beginPath(); g.moveTo(cx - 11, cy - 2); g.lineTo(cx + 11, cy - 2); g.moveTo(cx - 11, cy + 5); g.lineTo(cx + 11, cy + 5);
      g.moveTo(cx, cy - 9); g.lineTo(cx, cy - 2); g.moveTo(cx - 5, cy - 2); g.lineTo(cx - 5, cy + 5); g.moveTo(cx + 5, cy + 5); g.lineTo(cx + 5, cy + 11); g.stroke();
      break;
    }
    case "logbridge": { // a whole fallen greyoak spanning the river
      g.fillStyle = "rgba(10,14,20,0.25)";
      g.beginPath(); g.ellipse(cx + TILE * 2.5, cy + 9, TILE * 2.8, 4, 0, 0, Math.PI * 2); g.fill();
      const L = TILE * 5; // spans the water to the far-bank anchor
      g.fillStyle = "#4e3d29";
      g.beginPath();
      g.moveTo(cx - 14, cy - 1); g.quadraticCurveTo(cx + L / 2, cy - 7, cx + L + 14, cy);
      g.lineTo(cx + L + 13, cy + 7); g.quadraticCurveTo(cx + L / 2, cy + 1, cx - 13, cy + 6);
      g.closePath(); g.fill();
      g.fillStyle = "#5d4a33";
      g.beginPath();
      g.moveTo(cx - 14, cy - 1); g.quadraticCurveTo(cx + L / 2, cy - 7, cx + L + 14, cy);
      g.lineTo(cx + L + 13, cy + 2.4); g.quadraticCurveTo(cx + L / 2, cy - 4.4, cx - 13, cy + 1.6);
      g.closePath(); g.fill();
      g.fillStyle = "#caa56a"; // root-torn end
      g.beginPath(); g.ellipse(cx - 13.5, cy + 2.5, 3, 4.2, 0.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(74,105,62,0.7)"; // moss along the top
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.ellipse(cx + 16 + i * (L / 4.4), cy - 2.4 + (i % 2), 5, 1.6, 0.1, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "stump": { // the far-bank landing of the log crossing
      shadow(g, cx, cy + 8, 7, 2.5);
      g.fillStyle = "#5d4a33";
      g.fillRect(cx - 5, cy - 1, 10, 8);
      g.fillStyle = "#caa56a";
      g.beginPath(); g.ellipse(cx, cy - 1, 5, 2.6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#8a6a40"; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(cx, cy - 1, 2.6, 1.3, 0, 0, Math.PI * 2); g.stroke();
      break;
    }
    case "stones": { // stepping stones across a gap
      g.fillStyle = "#6fa0c0"; g.globalAlpha = 0.35; g.fillRect(cx - 12, cy - 6, 24, 14); g.globalAlpha = 1;
      g.fillStyle = "#9a9080";
      for (const [dx, dy] of [[-8, 4], [-2, -2], [4, 3], [9, -1]] as const) {
        g.beginPath(); g.ellipse(cx + dx, cy + dy, 3.4, 2.6, 0, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "beam": { // a high tightrope/beam
      g.strokeStyle = woodDk; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 11, cy + 9); g.lineTo(cx - 8, cy - 6); g.moveTo(cx + 11, cy + 9); g.lineTo(cx + 8, cy - 6); g.stroke();
      g.strokeStyle = rope; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 9, cy - 6); g.lineTo(cx + 9, cy - 6); g.stroke();
      break;
    }
    case "iceledge": { // SPINE — an icy shelf traverse with a frozen handline
      g.fillStyle = "#b7cfe0"; g.beginPath(); // the ledge, pale blue ice
      g.moveTo(cx - 12, cy + 6); g.lineTo(cx - 9, cy - 2); g.lineTo(cx + 10, cy - 3); g.lineTo(cx + 12, cy + 5); g.closePath(); g.fill();
      g.fillStyle = "#e6f1fa"; g.fillRect(cx - 11, cy - 2, 21, 2); // lit top edge
      g.strokeStyle = "#7fa8c8"; g.lineWidth = 1; // fracture lines
      g.beginPath(); g.moveTo(cx - 4, cy - 2); g.lineTo(cx - 6, cy + 5); g.moveTo(cx + 4, cy - 2); g.lineTo(cx + 5, cy + 5); g.stroke();
      g.strokeStyle = "#8a97a2"; g.lineWidth = 1.4; // a rope handline pinned above
      g.beginPath(); g.moveTo(cx - 11, cy - 8); g.lineTo(cx + 11, cy - 9); g.stroke();
      g.fillStyle = "#d8ecfb"; for (const dx of [-8, -1, 6]) { g.beginPath(); g.moveTo(cx + dx, cy + 5); g.lineTo(cx + dx - 1.4, cy + 10); g.lineTo(cx + dx + 1.4, cy + 5); g.closePath(); g.fill(); } // icicles
      break;
    }
    case "chasmswing": { // MARROW — a rope swing over a black chasm
      g.fillStyle = "#0b0a10"; g.beginPath(); g.ellipse(cx, cy + 4, 13, 6, 0, 0, Math.PI * 2); g.fill(); // the void
      g.fillStyle = "rgba(120,90,160,0.18)"; g.beginPath(); g.ellipse(cx, cy + 4, 9, 4, 0, 0, Math.PI * 2); g.fill(); // faint gloom-glow
      g.fillStyle = "#4a4038"; g.fillRect(cx - 13, cy - 1, 4, 8); g.fillRect(cx + 9, cy - 1, 4, 8); // the two rock lips
      g.strokeStyle = "#3a2c1c"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 11, cy - 12); g.lineTo(cx + 11, cy - 12); g.stroke(); // anchor beam
      g.strokeStyle = rope; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + 1, cy - 12); g.lineTo(cx - 3, cy + 5); g.stroke(); // the swing rope
      g.fillStyle = wood; g.fillRect(cx - 6, cy + 4, 7, 2.4); // the seat, mid-swing
      break;
    }
    case "cinderleap": { // ASHFEN — a leap across a glowing crack in the ash
      const gl = 0.5 + 0.5 * Math.abs(Math.sin((cx + cy) * 0.7));
      g.fillStyle = "#2e2622"; g.beginPath(); // the dark ash mound either side
      g.moveTo(cx - 12, cy + 6); g.lineTo(cx - 10, cy - 3); g.lineTo(cx - 3, cy - 2); g.lineTo(cx - 4, cy + 6); g.closePath();
      g.moveTo(cx + 12, cy + 6); g.lineTo(cx + 10, cy - 3); g.lineTo(cx + 3, cy - 2); g.lineTo(cx + 4, cy + 6); g.closePath(); g.fill();
      g.fillStyle = `rgba(230,120,40,${(0.5 + 0.4 * gl).toFixed(2)})`; // the ember crack between
      g.beginPath(); g.moveTo(cx - 3, cy + 5); g.lineTo(cx - 1, cy - 3); g.lineTo(cx + 3, cy + 5); g.lineTo(cx + 1, cy - 3); g.closePath(); g.fill();
      g.fillStyle = `rgba(255,210,120,${(0.4 + 0.5 * gl).toFixed(2)})`; g.fillRect(cx - 0.8, cy - 3, 1.6, 8); // white-hot core
      break;
    }
    case "boghop": { // HEARTMOOR — tussock hops across dark bog pools
      g.fillStyle = "#1e2a20"; g.fillRect(cx - 12, cy - 5, 24, 14); // the peat water
      g.fillStyle = "rgba(90,120,80,0.15)"; g.fillRect(cx - 12, cy - 5, 24, 3); // scummed surface
      for (const [dx, dy] of [[-8, 4], [-2, -1], [5, 3], [9, -3]] as const) { // the tussocks
        g.fillStyle = "#3f4a2a"; g.beginPath(); g.ellipse(cx + dx, cy + dy + 1, 3.6, 2.4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#5f7a3a"; g.beginPath(); g.ellipse(cx + dx, cy + dy - 0.5, 3.2, 1.8, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#7a9448"; g.lineWidth = 0.7; // reed tufts
        for (const s of [-1.5, 0, 1.5]) { g.beginPath(); g.moveTo(cx + dx + s, cy + dy - 1); g.lineTo(cx + dx + s, cy + dy - 4); g.stroke(); }
      }
      break;
    }
    default: { // "log" — a balance log over a dip
      g.fillStyle = wood; g.strokeStyle = woodDk; g.lineWidth = 1;
      g.fillRect(cx - 12, cy - 2, 24, 5); g.strokeRect(cx - 12, cy - 2, 24, 5);
      g.fillStyle = woodDk; g.beginPath(); g.ellipse(cx + 12, cy + 0.5, 1.6, 2.6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = rope; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - 12, cy + 0.5); g.lineTo(cx + 12, cy + 0.5); g.stroke();
    }
  }
  // A small footworn marker so the circuit reads as a course.
  g.fillStyle = "rgba(182,210,74,0.5)"; g.beginPath(); g.arc(cx, cy + 10, 1.6, 0, Math.PI * 2); g.fill();
}

/** A street lamp: tall post with an iron lantern (its glow is in the night pass). */
function drawLamppost(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 12, 5, 2);
  g.strokeStyle = "#2c2a30"; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(cx, cy + 12); g.lineTo(cx, cy - 8); g.stroke();
  g.fillStyle = "#3a3740"; // base
  g.fillRect(cx - 3, cy + 9, 6, 4);
  // The lantern housing.
  g.fillStyle = "#26242b";
  g.fillRect(cx - 4, cy - 14, 8, 7);
  g.fillStyle = "#3a3740";
  g.beginPath(); g.moveTo(cx - 5, cy - 14); g.lineTo(cx, cy - 18); g.lineTo(cx + 5, cy - 14); g.closePath(); g.fill();
  // The flame (always lit; the night overlay makes it read as a glow).
  g.fillStyle = "#f7c66a";
  g.fillRect(cx - 2, cy - 13, 4, 5);
  g.fillStyle = "rgba(247,198,106,0.5)";
  g.beginPath(); g.arc(cx, cy - 10, 5, 0, Math.PI * 2); g.fill();
}

/** A directional fingerpost at a junction. */
function drawSignpost(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  // A taller, chunkier fingerpost — reads clearly as a landmark from a distance,
  // so clue-riddle hunting isn't a pixel search. Roughly 1.6× the old post.
  shadow(g, cx, cy + 15, 8, 3);
  g.fillStyle = "#4a341f"; // post (a shade darker for contrast against terrain)
  g.fillRect(cx - 2.5, cy - 13, 5, 30);
  // A little cap on top so the silhouette stands out.
  g.fillStyle = "#6b4f30";
  g.beginPath(); g.moveTo(cx - 4, cy - 13); g.lineTo(cx + 4, cy - 13); g.lineTo(cx, cy - 17); g.closePath(); g.fill();
  // Two big fingerboards pointing opposite ways, pale enough to catch the eye.
  const board = (y: number, dir: 1 | -1, fill: string): void => {
    const tipX = cx + dir * 20, baseX = cx - dir * 3;
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(baseX, y - 4); g.lineTo(cx + dir * 15, y - 4);
    g.lineTo(tipX, y); g.lineTo(cx + dir * 15, y + 4); g.lineTo(baseX, y + 4);
    g.closePath(); g.fill();
    // Two lines of "lettering" so it reads as a written sign.
    g.fillStyle = "rgba(30,20,10,0.4)";
    const lx = dir === 1 ? cx - 1 : cx - dir * 14;
    g.fillRect(lx, y - 2, 12, 1.4); g.fillRect(lx, y + 0.6, 9, 1.4);
  };
  board(cy - 6, -1, "#a07a44"); // upper board, pointing left
  board(cy + 4, 1, "#8f6c3c");  // lower board, pointing right
}

/**
 * A settlement's heraldic banner: a tall timber standard flying a long
 * gonfalon in the town's own colours (`tint`), rippling gently in the wind
 * with a stitched border, a pale heraldic charge, and a swallow-tailed hem —
 * so each town reads as its own hold, the way a Skyrim city flies its jarl's
 * colours. The wave uses a per-banner phase so neighbouring flags don't ripple
 * in lockstep.
 */
function drawBanner(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tint: string,
  now: number,
  phase: number,
): void {
  const field = tint;
  const dark = shade(tint, 0.62);
  const light = shade(tint, 1.28);
  shadow(g, cx, cy + 16, 7, 3);

  // The pole: a tall stripped-timber staff with an iron finial.
  g.strokeStyle = "#3a2c1c"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx - 9, cy + 16); g.lineTo(cx - 9, cy - 22); g.stroke();
  g.fillStyle = "#6b5636"; g.fillRect(cx - 11, cy + 14, 4, 4); // foot block
  g.fillStyle = "#d8c48a";
  g.beginPath(); g.arc(cx - 9, cy - 24, 2.6, 0, Math.PI * 2); g.fill(); // finial knob
  // The cross-arm the banner hangs from.
  g.strokeStyle = "#3a2c1c"; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(cx - 9, cy - 21); g.lineTo(cx + 11, cy - 21); g.stroke();

  // The hanging gonfalon: a column of horizontal slats, each nudged by a
  // travelling sine so the whole cloth reads as one rippling sheet.
  const top = cy - 20, left = cx - 8, w = 18, h = 30;
  const slats = 10;
  for (let i = 0; i < slats; i++) {
    const t = i / (slats - 1);
    const yy = top + t * h;
    const sway = Math.sin(now / 420 + phase + t * 2.4) * (2 + t * 3);
    const x0 = left + sway;
    // Swallow-tail notch at the very bottom two slats.
    const inset = t > 0.82 ? (t - 0.82) * (w * 2.6) : 0;
    // Body shaded left→right, lit edge where the cloth catches the light.
    const grad = g.createLinearGradient(x0, 0, x0 + w, 0);
    grad.addColorStop(0, dark);
    grad.addColorStop(0.4, field);
    grad.addColorStop(1, shade(tint, 0.9));
    g.fillStyle = grad;
    g.fillRect(x0 + inset / 2, yy, w - inset, h / slats + 0.8);
  }
  // Stitched border down both long edges + a charge in the centre.
  g.save();
  g.beginPath();
  for (let i = 0; i < slats; i++) {
    const t = i / (slats - 1);
    const yy = top + t * h;
    const sway = Math.sin(now / 420 + phase + t * 2.4) * (2 + t * 3);
    if (i === 0) g.moveTo(left + sway + 1, yy); else g.lineTo(left + sway + 1, yy);
  }
  g.strokeStyle = light; g.lineWidth = 1.4; g.stroke();
  g.restore();
  // A pale heraldic charge (a simple lozenge) mid-field.
  const midT = 0.42;
  const midSway = Math.sin(now / 420 + phase + midT * 2.4) * (2 + midT * 3);
  const chx = left + midSway + w / 2, chy = top + midT * h + 4;
  g.fillStyle = "rgba(240,236,220,0.9)";
  g.beginPath();
  g.moveTo(chx, chy - 5); g.lineTo(chx + 4, chy); g.lineTo(chx, chy + 5); g.lineTo(chx - 4, chy);
  g.closePath(); g.fill();
}

/** A Courier waystone: a tall carved standing stone crowned with a bright,
 *  pulsing ember beacon and a ground glow, so a fast-travel node reads from
 *  across the map. */
function drawWaystone(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const pulse = 0.55 + 0.45 * Math.sin(now / 500);
  // Ground glow — a warm pool that draws the eye.
  const glow = g.createRadialGradient(cx, cy + 14, 2, cx, cy + 14, 26);
  glow.addColorStop(0, `rgba(240,150,60,${(0.34 + 0.14 * pulse).toFixed(2)})`);
  glow.addColorStop(1, "rgba(240,150,60,0)");
  g.fillStyle = glow;
  g.beginPath(); g.ellipse(cx, cy + 14, 26, 11, 0, 0, Math.PI * 2); g.fill();

  shadow(g, cx, cy + 17, 13, 4);
  // The standing stone — ~1.7× the old size.
  g.fillStyle = "#5b5762";
  g.beginPath();
  g.moveTo(cx - 11, cy + 17); g.lineTo(cx - 10, cy - 15); g.lineTo(cx, cy - 21);
  g.lineTo(cx + 10, cy - 15); g.lineTo(cx + 11, cy + 17); g.closePath(); g.fill();
  g.fillStyle = "#6c6775"; // lit face
  g.beginPath(); g.moveTo(cx - 10, cy - 15); g.lineTo(cx, cy - 21); g.lineTo(cx + 1, cy + 17); g.lineTo(cx - 11, cy + 17); g.closePath(); g.fill();
  g.strokeStyle = "#403c46"; g.lineWidth = 1; // a couple of carved grooves
  g.beginPath(); g.moveTo(cx - 8, cy + 6); g.lineTo(cx + 9, cy + 6); g.moveTo(cx - 8, cy + 11); g.lineTo(cx + 9, cy + 11); g.stroke();

  // The ember rider-mark set in the stone, glowing.
  g.fillStyle = `rgba(210,116,44,${(0.6 + 0.4 * pulse).toFixed(2)})`;
  g.beginPath(); g.arc(cx - 1, cy - 4, 6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(247,198,106,0.9)"; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(cx - 6, cy - 4); g.lineTo(cx + 3, cy - 4); g.moveTo(cx - 1, cy - 9); g.lineTo(cx - 1, cy + 1); g.stroke();

  // A bright beacon flame on the crown + a soft light column rising off it.
  const beam = g.createLinearGradient(cx, cy - 21, cx, cy - 46);
  beam.addColorStop(0, `rgba(247,198,106,${(0.5 * pulse).toFixed(2)})`);
  beam.addColorStop(1, "rgba(247,198,106,0)");
  g.fillStyle = beam;
  g.beginPath(); g.moveTo(cx - 4, cy - 21); g.lineTo(cx + 4, cy - 21); g.lineTo(cx + 2, cy - 46); g.lineTo(cx - 2, cy - 46); g.closePath(); g.fill();
  g.fillStyle = "#f7c66a";
  g.beginPath(); g.ellipse(cx, cy - 22, 3.4 + pulse, 4.6 + pulse, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff0c0";
  g.beginPath(); g.ellipse(cx, cy - 22, 1.6, 2.4, 0, 0, Math.PI * 2); g.fill();
}

/** Ambient wildlife — small, simple silhouettes by species. `seed` is a
 *  camera-independent per-critter phase (derived from the world tile) so the
 *  idle bob/flap animates in place — using the screen-space x here made critters
 *  vibrate as the camera panned past them. */
function drawCritter(
  g: CanvasRenderingContext2D,
  species: string | undefined,
  cx: number,
  cy: number,
  now: number,
  seed: number,
): void {
  // Stable and paddock stock render as the full mount rig (idle) so the beasts
  // in a pen look like the beasts the stable sells.
  if (species === "horse" || species === "ox") {
    // Livestock at life size too — a paddock horse shouldn't read as a pony.
    shadow(g, cx, cy + 11, 16, 4.5);
    g.save();
    g.translate(cx, cy);
    g.scale(1.3, 1.3);
    drawMountRig(g, 0, 0, now, false, seed > 3.14, { id: species === "ox" ? "mount_ox" : "mount_horse", gold: false, barding: false });
    g.restore();
    return;
  }
  shadow(g, cx, cy + 7, 6, 2);
  const bob = Math.sin(now / 220 + seed) * 1.2; // a little life
  const y = cy + bob;
  switch (species) {
    case "deer": {
      g.fillStyle = "#9a6b3e";
      g.fillRect(cx - 6, y - 4, 11, 6); // body
      g.fillRect(cx + 4, y - 8, 3, 5);  // neck
      g.fillStyle = "#7a5230";
      g.fillRect(cx + 4, y - 11, 3, 4); // head
      g.strokeStyle = "#caa570"; g.lineWidth = 1; // antlers
      g.beginPath(); g.moveTo(cx + 5, y - 11); g.lineTo(cx + 4, y - 14);
      g.moveTo(cx + 6, y - 11); g.lineTo(cx + 8, y - 14); g.stroke();
      g.strokeStyle = "#6a4628"; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(cx - 4, y + 2); g.lineTo(cx - 4, y + 6); g.moveTo(cx + 3, y + 2); g.lineTo(cx + 3, y + 6); g.stroke();
      break;
    }
    case "sheep": {
      g.fillStyle = "#e6e2d6";
      g.beginPath(); g.ellipse(cx, y - 2, 7, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#33312c"; g.fillRect(cx + 5, y - 4, 3, 3); // head
      g.strokeStyle = "#33312c"; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx - 3, y + 3); g.lineTo(cx - 3, y + 6); g.moveTo(cx + 3, y + 3); g.lineTo(cx + 3, y + 6); g.stroke();
      break;
    }
    case "crow": {
      g.fillStyle = "#1c1b22";
      g.beginPath(); g.ellipse(cx, y, 5, 3.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#26252e"; g.beginPath(); g.arc(cx + 4, y - 2, 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c8902c"; g.fillRect(cx + 6, y - 2.5, 2.5, 1.4); // beak
      g.fillStyle = "#0f0e13"; g.beginPath(); g.moveTo(cx - 5, y); g.lineTo(cx - 9, y - 2); g.lineTo(cx - 5, y + 1); g.fill(); // tail
      break;
    }
    case "duck": {
      g.fillStyle = "#6e5a3a";
      g.beginPath(); g.ellipse(cx, y, 6, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3a4a2e"; g.beginPath(); g.arc(cx + 5, y - 3, 2.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c8902c"; g.fillRect(cx + 7, y - 3.5, 3, 1.6);
      break;
    }
    case "frog": {
      g.fillStyle = "#4a6a32";
      g.beginPath(); g.ellipse(cx, y + 1, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#5e8240";
      g.beginPath(); g.arc(cx - 2, y - 2, 1.6, 0, Math.PI * 2); g.arc(cx + 2, y - 2, 1.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1c2414"; g.fillRect(cx - 3, y - 3, 1, 1); g.fillRect(cx + 2, y - 3, 1, 1);
      break;
    }
    case "butterfly": {
      const flap = 0.4 + 0.5 * Math.abs(Math.sin(now / 90 + seed));
      g.fillStyle = "#d2742c";
      g.save(); g.translate(cx, y - 2); g.scale(flap, 1);
      g.beginPath(); g.ellipse(-3, 0, 3, 4, 0, 0, Math.PI * 2); g.ellipse(3, 0, 3, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f0c187"; g.beginPath(); g.arc(-3, -1, 1, 0, Math.PI * 2); g.arc(3, -1, 1, 0, Math.PI * 2); g.fill();
      g.restore();
      g.fillStyle = "#2a2630"; g.fillRect(cx - 0.5, y - 5, 1, 6);
      break;
    }
    case "cat": {
      g.fillStyle = "#6a5b48";
      g.beginPath(); g.ellipse(cx - 1, y, 6, 3.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6a5b48"; g.beginPath(); g.arc(cx + 5, y - 3, 2.4, 0, Math.PI * 2); g.fill();
      g.fillRect(cx + 3.5, y - 6, 1.5, 2); g.fillRect(cx + 6, y - 6, 1.5, 2); // ears
      g.strokeStyle = "#6a5b48"; g.lineWidth = 1.6; // tail
      g.beginPath(); g.moveTo(cx - 6, y); g.quadraticCurveTo(cx - 10, y - 1, cx - 9, y - 5); g.stroke();
      break;
    }
    default: { // rabbit / hare
      g.fillStyle = "#8a7a64";
      g.beginPath(); g.ellipse(cx, y, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#9a8a72"; g.beginPath(); g.arc(cx + 4, y - 2, 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#8a7a64"; g.fillRect(cx + 3, y - 7, 1.6, 5); g.fillRect(cx + 5, y - 7, 1.6, 5); // ears
      g.fillStyle = "#efe9dd"; g.beginPath(); g.arc(cx - 5, y + 1, 1.6, 0, Math.PI * 2); g.fill(); // tail
      break;
    }
  }
}

/** A summoned companion at screen (sx,sy): a boss pet shows as a mini version
 *  of its boss (the scaled-down boss sprite); any other pet shows as a small
 *  critter. Half-scale keeps it clearly a hanger-on, not a second fighter. */
function drawCompanion(
  g: CanvasRenderingContext2D, content: Content, id: ItemId,
  sx: number, sy: number, now: number, moving: boolean,
): void {
  const boss = content.items[id]?.meta?.["petBoss"];
  g.save();
  g.translate(sx, sy);
  g.scale(0.5, 0.5);
  if (typeof boss === "string") drawMonsterBody(g, boss, 0, 0, now, moving);
  else if (id.startsWith("pet_")) drawSkillPet(g, id, 0, 0, now, moving);
  else drawCritter(g, undefined, 0, 0, now, 0);
  g.restore();
}

/** The skilling pets: each a bespoke little familiar, earned by the grind it
 *  honours — a rock pup for Mining, an ember imp for Smithing, a fox kit for
 *  Hunter… all drawn at critter scale so they read as companions, not fighters.
 *  (Boss pets don't come here — they render as mini bosses above.) */
function drawSkillPet(
  g: CanvasRenderingContext2D, id: string, cx: number, cy: number, now: number, moving: boolean,
): void {
  const bob = Math.sin(now / (moving ? 140 : 300)) * (moving ? 1.6 : 0.8);
  const y = cy + bob;
  shadow(g, cx, cy + 9, 9, 3);
  const eye = (ex: number, ey: number, r = 1.2, col = "#15100b"): void => { g.fillStyle = col; circle(g, ex, ey, r); };
  switch (id) {
    case "pet_bloodhound": { // OLD BAY — the guides' grizzled bloodhound
      g.fillStyle = "#6e4f33"; // long low body
      g.beginPath(); g.ellipse(cx + 1, y + 1, 9.5, 5.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#7c5a3a"; // head, muzzle down like he's on a scent
      g.beginPath(); g.ellipse(cx - 7, y - 1, 4.5, 4, -0.35, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#5a4028"; // long hound ears
      g.beginPath(); g.ellipse(cx - 8.5, y + 1.5, 1.8, 3.6, -0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#8a6844"; // grey muzzle of age
      g.beginPath(); g.ellipse(cx - 10, y, 2.2, 1.7, -0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4a3521"; // legs + tail tip
      g.fillRect(cx - 4, cy + 6, 2.5, 4); g.fillRect(cx + 4, cy + 6, 2.5, 4);
      g.beginPath(); g.ellipse(cx + 10, y - 2, 2.5, 1.2, 0.6, 0, Math.PI * 2); g.fill();
      eye(cx - 7.5, y - 2, 1.1);
      break;
    }
    case "pet_trail_wren": { // TRAILWING WREN — a quick brown trail-bird
      const hop = moving ? Math.abs(Math.sin(now / 110)) * 2.5 : 0;
      const wy = y - hop;
      g.fillStyle = "#8a6a42"; // round body
      g.beginPath(); g.ellipse(cx, wy, 5.5, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#a5845a"; // breast
      g.beginPath(); g.ellipse(cx - 1.5, wy + 1, 3, 2.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6d5233"; // wing, barred
      g.beginPath(); g.ellipse(cx + 1.5, wy - 0.5, 3.2, 2.2, 0.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#57411f"; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(cx, wy - 1); g.lineTo(cx + 3.5, wy); g.stroke();
      g.fillStyle = "#57411f"; // cocked tail — the wren signature
      g.save(); g.translate(cx + 5, wy - 1); g.rotate(-0.9); g.fillRect(0, -0.9, 4.5, 1.8); g.restore();
      g.fillStyle = "#8a6a42"; circle(g, cx - 4.5, wy - 2.5, 2.6); // head
      g.fillStyle = "#c9a256"; // beak
      g.beginPath(); g.moveTo(cx - 7, wy - 2.5); g.lineTo(cx - 9, wy - 2); g.lineTo(cx - 7, wy - 1.6); g.closePath(); g.fill();
      g.fillStyle = "#c58a3f"; g.fillRect(cx - 2, cy + 7.5, 1.2, 2.5); g.fillRect(cx + 1, cy + 7.5, 1.2, 2.5);
      eye(cx - 5, wy - 3, 0.9);
      break;
    }
    case "pet_pier_crab": { // PIER CRAB — a stout red shore-crab, claws up
      const scu = moving ? Math.abs(Math.sin(now / 90)) * 1.4 : 0; // sideways scuttle bob
      g.fillStyle = "#b23a2a"; // carapace
      g.beginPath(); g.ellipse(cx, y + 1, 6.5, 4.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c85a44"; // lit top of the shell
      g.beginPath(); g.ellipse(cx - 1, y - 0.6, 4.6, 2.4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#7f2418"; g.lineWidth = 0.7; // shell seam
      g.beginPath(); g.moveTo(cx - 5, y + 1); g.lineTo(cx + 5, y + 1); g.stroke();
      // Legs (three a side), splayed and stepping.
      g.strokeStyle = "#8f2c1f"; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const ly = y + 1 + i * 1.8, kick = ((i % 2) ? scu : -scu);
        g.beginPath(); g.moveTo(cx - 5, ly); g.lineTo(cx - 9, ly + 2 + kick); g.stroke();
        g.beginPath(); g.moveTo(cx + 5, ly); g.lineTo(cx + 9, ly + 2 - kick); g.stroke();
      }
      // Claws, held up.
      g.fillStyle = "#b23a2a";
      g.beginPath(); g.ellipse(cx - 7, y - 3.5, 2.4, 1.7, -0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx + 7, y - 3.5, 2.4, 1.7, 0.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#7f2418"; g.lineWidth = 0.8; // pincer notch
      g.beginPath(); g.moveTo(cx - 8.4, y - 4); g.lineTo(cx - 6.4, y - 3.2); g.moveTo(cx + 8.4, y - 4); g.lineTo(cx + 6.4, y - 3.2); g.stroke();
      // Eyestalks.
      g.strokeStyle = "#8f2c1f"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx - 2, y - 3); g.lineTo(cx - 2.5, y - 6); g.moveTo(cx + 2, y - 3); g.lineTo(cx + 2.5, y - 6); g.stroke();
      eye(cx - 2.5, y - 6.2, 1); eye(cx + 2.5, y - 6.2, 1);
      break;
    }
    case "pet_mining": { // ROCK PUP — a living pebble with a crystal spine
      g.fillStyle = "#6a6660";
      g.beginPath(); g.ellipse(cx, y + 2, 9, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#7d786f";
      g.beginPath(); g.ellipse(cx - 2, y - 1, 6, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#8fd0e0"; // crystal spikes
      g.beginPath(); g.moveTo(cx + 1, y - 6); g.lineTo(cx + 4, y - 1); g.lineTo(cx - 2, y - 1); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx + 6, y - 3); g.lineTo(cx + 8, y + 1); g.lineTo(cx + 3, y + 1); g.closePath(); g.fill();
      g.fillStyle = "#4f4b46"; // stubby feet
      g.fillRect(cx - 6, cy + 7, 3, 3); g.fillRect(cx + 3, cy + 7, 3, 3);
      eye(cx - 5, y + 1, 1.4, "#dff2f8"); eye(cx - 5, y + 1, 0.8);
      break;
    }
    case "pet_smithing": { // EMBER IMP — coal-dark, seamed with fire
      const gl = 0.6 + 0.4 * Math.sin(now / 200);
      g.fillStyle = "#2a2320";
      g.beginPath(); g.ellipse(cx, y, 7, 8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(240,120,40,${gl})`; g.lineWidth = 1.2; // molten seams
      g.beginPath(); g.moveTo(cx - 4, y - 3); g.lineTo(cx + 1, y + 1); g.lineTo(cx - 2, y + 5); g.stroke();
      g.beginPath(); g.moveTo(cx + 4, y - 4); g.lineTo(cx + 3, y + 2); g.stroke();
      g.fillStyle = "#2a2320"; // horn nubs
      g.beginPath(); g.moveTo(cx - 4, y - 7); g.lineTo(cx - 2, y - 10); g.lineTo(cx - 1, y - 6); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx + 4, y - 7); g.lineTo(cx + 2, y - 10); g.lineTo(cx + 1, y - 6); g.closePath(); g.fill();
      eye(cx - 2.5, y - 3, 1.3, `rgba(255,170,60,${0.6 + 0.4 * gl})`); eye(cx + 2.5, y - 3, 1.3, `rgba(255,170,60,${0.6 + 0.4 * gl})`);
      break;
    }
    case "pet_forestry": { // SAPLING SPRITE — a walking seedling
      g.fillStyle = "#7a5c38"; // trunk body
      g.fillRect(cx - 2.5, y - 2, 5, 9);
      g.fillStyle = "#4e6a34"; // leaf crown
      circle(g, cx, y - 6, 6);
      g.fillStyle = "#63834a";
      circle(g, cx - 2, y - 8, 3.4);
      g.fillStyle = "#8fb060";
      circle(g, cx + 3, y - 5, 2.2);
      eye(cx - 1.5, y + 0.5); eye(cx + 1.5, y + 0.5);
      g.fillStyle = "#7a5c38"; g.fillRect(cx - 4, cy + 7, 2.5, 3); g.fillRect(cx + 1.5, cy + 7, 2.5, 3);
      break;
    }
    case "pet_woodcraft": { // SHAVIE — a carved wooden owl, ring-grained
      g.fillStyle = "#9a7848";
      g.beginPath(); g.ellipse(cx, y, 7, 8.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#7c5e36"; g.lineWidth = 1; // grain rings
      g.beginPath(); g.arc(cx, y + 1, 4.5, 0.3, Math.PI - 0.3); g.stroke();
      g.beginPath(); g.arc(cx, y + 1, 2.5, 0.4, Math.PI - 0.4); g.stroke();
      g.fillStyle = "#b99a64"; // face disc
      circle(g, cx - 2.6, y - 4, 2.8); circle(g, cx + 2.6, y - 4, 2.8);
      eye(cx - 2.6, y - 4, 1.3); eye(cx + 2.6, y - 4, 1.3);
      g.fillStyle = "#d2b880"; // beak chip
      g.beginPath(); g.moveTo(cx, y - 3); g.lineTo(cx - 1.2, y - 1); g.lineTo(cx + 1.2, y - 1); g.closePath(); g.fill();
      break;
    }
    case "pet_hunter": { // FOX KIT — rust coat, white tail tip
      g.fillStyle = "#b56a30";
      g.beginPath(); g.ellipse(cx, y + 1, 8, 5.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#b56a30"; g.lineWidth = 3.4; g.lineCap = "round"; // tail
      g.beginPath(); g.moveTo(cx + 7, y + 2); g.quadraticCurveTo(cx + 13, y, cx + 12, y - 5); g.stroke();
      g.strokeStyle = "#f0e8da"; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(cx + 12.4, y - 3); g.lineTo(cx + 12, y - 5.5); g.stroke(); g.lineCap = "butt";
      g.fillStyle = "#b56a30"; circle(g, cx - 7, y - 2, 4);          // head
      g.fillStyle = "#8a4c20"; // ears
      g.beginPath(); g.moveTo(cx - 10, y - 5); g.lineTo(cx - 9, y - 9); g.lineTo(cx - 6.5, y - 5.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx - 6, y - 5.5); g.lineTo(cx - 4.5, y - 9); g.lineTo(cx - 3, y - 5); g.closePath(); g.fill();
      g.fillStyle = "#f0e8da"; circle(g, cx - 9.5, y - 0.5, 1.8);    // white muzzle
      eye(cx - 7, y - 2.6, 1.1);
      break;
    }
    case "pet_fishing": { // OTTER — sleek, with a silver catch in its mouth
      g.fillStyle = "#6a4e30";
      g.beginPath(); g.ellipse(cx, y + 1, 8.5, 5, -0.15, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#6a4e30"; g.lineWidth = 2.6; g.lineCap = "round"; // tail
      g.beginPath(); g.moveTo(cx + 8, y + 3); g.quadraticCurveTo(cx + 13, y + 5, cx + 15, y + 2); g.stroke(); g.lineCap = "butt";
      g.fillStyle = "#6a4e30"; circle(g, cx - 8, y - 2, 3.6);
      g.fillStyle = "#caa87c"; circle(g, cx - 9, y - 0.6, 1.9); // pale chin
      eye(cx - 8, y - 3, 1.05);
      g.fillStyle = "#9fb6c4"; // the fish
      g.beginPath(); g.ellipse(cx - 12, y + 0.5, 3.4, 1.4, -0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(cx - 15, y - 0.6); g.lineTo(cx - 17, y - 1.8); g.lineTo(cx - 16.4, y + 1); g.closePath(); g.fill();
      break;
    }
    case "pet_cooking": { // SOUS HEN — plump, flour-dusted, chef-hatted
      g.fillStyle = "#c78a4a";
      g.beginPath(); g.ellipse(cx, y + 1, 7, 6.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e0a860"; circle(g, cx - 5, y - 4, 3.4); // head
      g.fillStyle = "#f4f2ec"; // tiny chef's toque
      g.fillRect(cx - 7.5, y - 10.5, 5, 3.4);
      circle(g, cx - 6.8, y - 11, 1.7); circle(g, cx - 4.2, y - 11.4, 1.9);
      g.fillStyle = "#e0b23c"; // beak
      g.beginPath(); g.moveTo(cx - 8.4, y - 4); g.lineTo(cx - 11, y - 3.2); g.lineTo(cx - 8.4, y - 2.4); g.closePath(); g.fill();
      g.fillStyle = "#b0752f"; // wing
      g.beginPath(); g.ellipse(cx + 1, y + 1, 3.6, 2.6, 0.3, 0, Math.PI * 2); g.fill();
      eye(cx - 5, y - 4.6, 1);
      break;
    }
    case "pet_farming": { // HARVEST MOUSE — wheat sprig in paw
      g.fillStyle = "#c2a06a";
      g.beginPath(); g.ellipse(cx, y + 2, 6.5, 5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#a8865a"; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(cx + 6, y + 3); g.quadraticCurveTo(cx + 11, y + 2, cx + 10, y - 3); g.stroke();
      g.fillStyle = "#c2a06a"; circle(g, cx - 5.5, y - 1, 3.6);
      g.fillStyle = "#d8bc88"; circle(g, cx - 7, y - 5, 2.1); circle(g, cx - 3.4, y - 5.4, 2.1); // big ears
      eye(cx - 6, y - 1.6, 1);
      g.strokeStyle = "#c9a83e"; g.lineWidth = 1.2; // the wheat sprig
      g.beginPath(); g.moveTo(cx - 8.5, y + 2); g.lineTo(cx - 11.5, y - 4); g.stroke();
      g.fillStyle = "#e2c455";
      for (let i = 0; i < 3; i++) circle(g, cx - 11 - i * 0.5, y - 4 - i * 1.6, 1.1);
      break;
    }
    case "pet_survivalist": { // MOSS HARE — green-dappled wild hare
      g.fillStyle = "#7a8458";
      g.beginPath(); g.ellipse(cx, y + 1, 7, 5.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#5c6a40"; // moss dapples
      circle(g, cx + 2, y - 1, 1.6); circle(g, cx - 2, y + 3, 1.3);
      g.fillStyle = "#7a8458"; circle(g, cx - 5.5, y - 2.5, 3.4);
      g.fillStyle = "#697452"; // long ears, one flopped
      g.beginPath(); g.ellipse(cx - 7, y - 8, 1.6, 4.2, -0.25, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx - 3.4, y - 7, 1.6, 3.6, 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e8e2d2"; circle(g, cx + 6.4, y + 2.4, 1.8); // bob tail
      eye(cx - 6, y - 3, 1.05);
      break;
    }
    case "pet_herblore": { // BREWTOAD — teal toad under a mushroom cap
      g.fillStyle = "#4e7a6a";
      g.beginPath(); g.ellipse(cx, y + 2, 7.5, 5.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6a9a86"; // throat
      g.beginPath(); g.ellipse(cx - 3, y + 3.5, 3, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#a24a3a"; // mushroom cap hat
      g.beginPath(); g.arc(cx + 1, y - 4, 5.5, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = "#e8ddca";
      circle(g, cx - 1, y - 6, 1); circle(g, cx + 3.4, y - 5.4, 0.8);
      eye(cx - 4.5, y - 1.5, 1.5, "#e8e2c2"); eye(cx - 4.5, y - 1.5, 0.8);
      eye(cx + 2.5, y - 1.5, 1.5, "#e8e2c2"); eye(cx + 2.5, y - 1.5, 0.8);
      break;
    }
    case "pet_construction": { // HOD BEETLE — square-backed, hauling a brick
      g.fillStyle = "#5a5248";
      g.fillRect(cx - 6, y - 3, 12, 8); // square carapace
      g.fillStyle = "#6e6558";
      g.fillRect(cx - 6, y - 3, 12, 2.4);
      g.fillStyle = "#8a4a34"; // the brick it carries
      g.fillRect(cx - 3.4, y - 7.5, 7, 3.6);
      g.fillStyle = "#a05e42";
      g.fillRect(cx - 3.4, y - 7.5, 7, 1.1);
      g.fillStyle = "#3c362e"; // legs
      for (let i = 0; i < 3; i++) { g.fillRect(cx - 5 + i * 4, cy + 5.4, 1.6, 3.4); }
      g.fillStyle = "#5a5248"; circle(g, cx - 7.5, y + 0.5, 2.6);
      eye(cx - 8.2, y, 0.9);
      break;
    }
    case "pet_crafting": { // GEMBACK TORTOISE — a cut gem for a shell
      g.fillStyle = "#7c6a4c"; // body
      g.beginPath(); g.ellipse(cx, y + 3, 7.5, 3.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3fa8a0"; // gem shell
      g.beginPath();
      g.moveTo(cx - 6, y + 1); g.lineTo(cx - 2, y - 5); g.lineTo(cx + 2, y - 5);
      g.lineTo(cx + 6, y + 1); g.closePath(); g.fill();
      g.fillStyle = "#7fd8d0"; // facets
      g.beginPath(); g.moveTo(cx - 2, y - 5); g.lineTo(cx, y + 1); g.lineTo(cx - 6, y + 1); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(cx - 1, y - 4, 2, 1.2);
      g.fillStyle = "#7c6a4c"; circle(g, cx - 8, y + 1.4, 2.4); // head
      eye(cx - 8.6, y + 1, 0.9);
      break;
    }
    case "pet_bounty": { // LEDGER HAWK — the Reckoner's little watcher
      g.fillStyle = "#5c4a38";
      g.beginPath(); g.ellipse(cx, y, 5, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#7a6248"; // folded wing
      g.beginPath(); g.ellipse(cx + 1.6, y + 0.5, 2.6, 5, 0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#d8cfc0"; // barred chest
      g.fillRect(cx - 3.4, y + 1, 3.4, 1.1); g.fillRect(cx - 3.2, y + 3, 3, 1.1);
      g.fillStyle = "#5c4a38"; circle(g, cx - 1, y - 7, 3.2);
      g.fillStyle = "#e0b23c"; // hooked beak
      g.beginPath(); g.moveTo(cx - 4, y - 7.5); g.lineTo(cx - 6.4, y - 6.4); g.lineTo(cx - 3.6, y - 5.8); g.closePath(); g.fill();
      eye(cx - 1.8, y - 7.8, 1.15, "#f2c84a"); eye(cx - 1.8, y - 7.8, 0.6);
      g.fillStyle = "#3c362e"; g.fillRect(cx - 2.4, cy + 6, 1.4, 3); g.fillRect(cx + 1, cy + 6, 1.4, 3); // talons
      break;
    }
    case "pet_superior": { // THE RECKONING WISP — black flame, gold mask
      const fl = Math.sin(now / 180);
      g.fillStyle = "rgba(20,14,26,0.9)";
      g.beginPath();
      g.moveTo(cx, y - 9 - fl);
      g.quadraticCurveTo(cx + 7, y - 2, cx + 5, y + 5);
      g.quadraticCurveTo(cx, y + 8, cx - 5, y + 5);
      g.quadraticCurveTo(cx - 7, y - 2, cx, y - 9 - fl);
      g.fill();
      g.strokeStyle = `rgba(232,196,90,${0.5 + 0.3 * fl})`; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx - 3, y + 6); g.quadraticCurveTo(cx, y, cx - 1, y - 6); g.stroke();
      g.fillStyle = "#e8c45a"; // the little gold mask
      g.beginPath(); g.ellipse(cx, y - 2, 3.4, 2.6, 0, 0, Math.PI * 2); g.fill();
      eye(cx - 1.3, y - 2.2, 0.75); eye(cx + 1.3, y - 2.2, 0.75);
      break;
    }
    case "pet_founder_wisp": { // THE FIRST EMBER — a warm lantern-mote that breathes light
      const fl = 0.5 + 0.5 * Math.sin(now / 220);
      // A soft outer glow.
      const glow = g.createRadialGradient(cx, y - 1, 1, cx, y - 1, 11 + fl * 3);
      glow.addColorStop(0, `rgba(255,190,90,${0.5 + 0.25 * fl})`);
      glow.addColorStop(1, "rgba(255,150,60,0)");
      g.fillStyle = glow;
      g.beginPath(); g.arc(cx, y - 1, 12 + fl * 3, 0, Math.PI * 2); g.fill();
      // The ember body: a small teardrop flame.
      g.fillStyle = "#ffcf6a";
      g.beginPath();
      g.moveTo(cx, y - 7 - fl * 2);
      g.quadraticCurveTo(cx + 5, y - 1, cx + 3.5, y + 4);
      g.quadraticCurveTo(cx, y + 6.5, cx - 3.5, y + 4);
      g.quadraticCurveTo(cx - 5, y - 1, cx, y - 7 - fl * 2);
      g.fill();
      // A hot white heart.
      g.fillStyle = `rgba(255,245,210,${0.8 + 0.2 * fl})`;
      g.beginPath(); g.ellipse(cx, y, 1.8, 2.6, 0, 0, Math.PI * 2); g.fill();
      // A couple of rising sparks.
      g.fillStyle = `rgba(255,200,120,${0.5 * fl})`;
      g.fillRect(cx - 4, y - 8 - fl * 4, 1, 1);
      g.fillRect(cx + 3, y - 6 - fl * 3, 1, 1);
      break;
    }
    default:
      drawCritter(g, undefined, cx, cy, now, 0);
  }
}

/** A town fountain: a round stone basin with a bright, jetting plume. */
function drawFountain(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  // The Ironvale Fountain — the city's centrepiece, ~3× the linear size of an
  // ordinary prop (a grand two-tier basin on a fluted column, cascading jets).
  const sh = 0.5 + 0.5 * Math.sin(now / 400);   // slow basin shimmer
  const sh2 = 0.5 + 0.5 * Math.sin(now / 260 + 1); // faster jet flutter

  // A broad ground shadow anchoring the whole structure.
  g.fillStyle = "rgba(8,8,12,0.28)";
  g.beginPath(); g.ellipse(cx, cy + 30, 54, 17, 0, 0, Math.PI * 2); g.fill();

  // --- Lower basin: a wide stone ring with a moulded rim. ---
  g.fillStyle = "#5b524a";
  g.beginPath(); g.ellipse(cx, cy + 20, 52, 30, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#6f655a"; // lit outer rim
  g.beginPath(); g.ellipse(cx, cy + 17, 52, 30, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#4c443c"; // inner well shadow
  g.beginPath(); g.ellipse(cx, cy + 19, 44, 24, 0, 0, Math.PI * 2); g.fill();
  // Lower water.
  g.fillStyle = "#2f5a78";
  g.beginPath(); g.ellipse(cx, cy + 19, 41, 22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(120,180,210,${0.3 + 0.22 * sh})`;
  g.beginPath(); g.ellipse(cx - 8, cy + 15, 24, 11, 0, 0, Math.PI * 2); g.fill();
  // Concentric ripples where the falling water lands.
  g.strokeStyle = `rgba(200,230,245,${0.16 + 0.12 * sh})`; g.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const rr = 8 + ((now / 700 + i * 0.6) % 1) * 22;
    g.beginPath(); g.ellipse(cx, cy + 19, rr, rr * 0.55, 0, 0, Math.PI * 2); g.stroke();
  }

  // --- Fluted central column rising from the lower basin. ---
  g.fillStyle = "#544b43";
  g.fillRect(cx - 9, cy - 20, 18, 40);
  g.fillStyle = "#665c52"; // lit left flute
  g.fillRect(cx - 9, cy - 20, 5, 40);
  g.fillStyle = "#453d36"; // shaded right flute
  g.fillRect(cx + 5, cy - 20, 4, 40);
  // A moulded collar where the column meets the upper basin.
  g.fillStyle = "#6f655a";
  g.fillRect(cx - 12, cy - 22, 24, 5);

  // --- Upper basin: a smaller raised bowl the top jet fills and overflows. ---
  g.fillStyle = "#5b524a";
  g.beginPath(); g.ellipse(cx, cy - 21, 26, 13, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#6f655a";
  g.beginPath(); g.ellipse(cx, cy - 23, 26, 13, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2f5a78";
  g.beginPath(); g.ellipse(cx, cy - 23, 20, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(140,195,222,${0.35 + 0.25 * sh})`;
  g.beginPath(); g.ellipse(cx - 4, cy - 25, 11, 4.5, 0, 0, Math.PI * 2); g.fill();

  // A short finial pedestal on the upper basin, and the central jet.
  g.fillStyle = "#544b43";
  g.fillRect(cx - 4, cy - 40, 8, 18);
  g.fillStyle = "#665c52";
  g.fillRect(cx - 4, cy - 40, 3, 18);
  const jet = 20 + 10 * sh2;
  const jg = g.createLinearGradient(cx, cy - 40 - jet, cx, cy - 40);
  jg.addColorStop(0, "rgba(210,235,250,0)");
  jg.addColorStop(1, `rgba(190,225,245,${0.55 + 0.2 * sh2})`);
  g.strokeStyle = jg; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(cx, cy - 40); g.lineTo(cx, cy - 40 - jet); g.stroke();

  // Arcing streams spilling off the upper basin down into the lower one.
  g.strokeStyle = `rgba(190,225,245,${0.42 + 0.18 * sh2})`; g.lineWidth = 2;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * 18, cy - 23);
    g.quadraticCurveTo(cx + s * 30, cy - 6, cx + s * 26, cy + 12);
    g.stroke();
  }
  // Falling droplets from the top jet + the arcs.
  g.fillStyle = `rgba(210,235,250,0.85)`;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + now / 480;
    const rad = 10 + (i % 3) * 5;
    g.beginPath();
    g.arc(cx + Math.cos(a) * rad, cy - 34 + Math.abs(Math.sin(a)) * 12, 1.6, 0, Math.PI * 2);
    g.fill();
  }
}

/** A Woodcraft sawmill: a frame-saw over a log on trestles, with a shaving-horse. */
function drawSawmill(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 14, 4);
  // Trestles + a log being sawn.
  g.strokeStyle = "#3a2c1d"; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 10, cy + 9); g.lineTo(cx - 6, cy + 1);
  g.moveTo(cx - 2, cy + 9); g.lineTo(cx - 6, cy + 1);
  g.moveTo(cx + 2, cy + 9); g.lineTo(cx + 6, cy + 1);
  g.moveTo(cx + 10, cy + 9); g.lineTo(cx + 6, cy + 1);
  g.stroke();
  // The log.
  g.fillStyle = "#8a6a40";
  g.fillRect(cx - 11, cy - 2, 22, 5);
  g.fillStyle = "#a07a44";
  g.fillRect(cx - 11, cy - 2, 22, 1.5);
  g.fillStyle = "#caa56a"; // cut end
  g.beginPath(); g.arc(cx - 11, cy + 0.5, 2.5, 0, Math.PI * 2); g.fill();
  // The frame-saw standing in the cut.
  g.strokeStyle = "#6f5436"; g.lineWidth = 2;
  g.strokeRect(cx - 1, cy - 13, 8, 11);
  g.strokeStyle = "#b9bcc4"; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(cx + 3, cy - 13); g.lineTo(cx + 3, cy - 1); g.stroke();
  // A few sawdust flecks + an offcut.
  g.fillStyle = "#b89357";
  g.fillRect(cx - 13, cy + 7, 4, 2);
  g.fillStyle = "rgba(200,170,110,0.5)";
  g.fillRect(cx + 8, cy + 6, 3, 1.5);
}

/** A market stall: a cart with a striped awning and a crate or two. */
/**
 * A market stall: a striped awning over a counter of goods.
 *
 * The awning colour is keyed off the stall's id so the four of them read as
 * four different trades from across the plaza rather than one prop repeated —
 * you should be able to pick out the gem stall without walking up to it.
 */
function drawStall(g: CanvasRenderingContext2D, x: number, y: number, id: string): void {
  const AWNING: Record<string, [string, string]> = {
    stall_produce: ["#5f8f4a", "#e8e2d0"],
    stall_baker: ["#b8813a", "#e8e2d0"],
    stall_silver: ["#8a97a8", "#e8e2d0"],
    stall_gem: ["#8a5aa8", "#e8e2d0"],
  };
  const [dark, light] = AWNING[id] ?? ["#9a7040", "#e8e2d0"];
  g.save();
  g.translate(x, y);
  // Counter shadow.
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.beginPath();
  g.ellipse(0, 11, 15, 5, 0, 0, Math.PI * 2);
  g.fill();
  // Posts.
  g.fillStyle = "#5a4632";
  g.fillRect(-14, -14, 2.5, 26);
  g.fillRect(11.5, -14, 2.5, 26);
  // Counter with goods heaped on it.
  g.fillStyle = "#6b5238";
  g.fillRect(-15, 2, 30, 8);
  g.fillStyle = dark;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(-10 + i * 6.5, 2, 2.6, Math.PI, 0);
    g.fill();
  }
  // Striped awning.
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 === 0 ? dark : light;
    g.fillRect(-15 + i * 5, -16, 5, 7);
  }
  // Scalloped hem, so it reads as cloth rather than a plank.
  g.fillStyle = dark;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(-12.5 + i * 5, -9, 2.5, 0, Math.PI);
    g.fill();
  }
  g.restore();
}

function drawCart(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 10, 13, 4);
  // Cart bed + wheel.
  g.fillStyle = "#5a4127";
  g.fillRect(cx - 11, cy + 2, 22, 6);
  g.fillStyle = "#3a2c1d";
  g.beginPath(); g.arc(cx - 7, cy + 9, 3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 7, cy + 9, 3, 0, Math.PI * 2); g.fill();
  // Awning posts.
  g.strokeStyle = "#6f5436"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 10, cy + 2); g.lineTo(cx - 10, cy - 9);
  g.moveTo(cx + 10, cy + 2); g.lineTo(cx + 10, cy - 9); g.stroke();
  // Striped awning.
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 === 0 ? "#b5553f" : "#d8cba6";
    g.fillRect(cx - 11 + i * 5.5, cy - 11, 5.5, 4);
  }
  // A crate of goods on the bed.
  g.fillStyle = "#8a6a40";
  g.fillRect(cx - 4, cy - 3, 8, 6);
  g.strokeStyle = "rgba(60,40,20,0.6)"; g.lineWidth = 0.8;
  g.strokeRect(cx - 4, cy - 3, 8, 6);
}

/** A post-and-rail fence segment. Spans the full tile along its run ("h" across
 *  the screen, "v" down it) so adjacent segments join into a continuous rail —
 *  paddocks, sheep pens and net-drying rails are built from these. */
function drawFence(g: CanvasRenderingContext2D, cx: number, cy: number, run: "h" | "v"): void {
  const post = "#4a3826", rail = "#6f5436", lit = "#7d6040";
  if (run === "h") {
    // Two rails clear across the tile; posts at each tile edge so runs share them.
    g.fillStyle = rail;
    g.fillRect(cx - TILE / 2, cy - 6, TILE, 2.6);
    g.fillRect(cx - TILE / 2, cy + 1, TILE, 2.6);
    g.fillStyle = lit;
    g.fillRect(cx - TILE / 2, cy - 6, TILE, 1);
    g.fillRect(cx - TILE / 2, cy + 1, TILE, 1);
    g.fillStyle = post;
    g.fillRect(cx - TILE / 2 - 1.5, cy - 10, 3, 18);
    g.fillRect(cx + TILE / 2 - 1.5, cy - 10, 3, 18);
  } else {
    // A run going down the screen: posts at the tile's top and bottom edges,
    // rails stepping between them (drawn as paired verticals in this projection).
    g.fillStyle = rail;
    g.fillRect(cx - 5, cy - TILE / 2, 2.6, TILE);
    g.fillRect(cx + 2.5, cy - TILE / 2, 2.6, TILE);
    g.fillStyle = lit;
    g.fillRect(cx - 5, cy - TILE / 2, 1, TILE);
    g.fillRect(cx + 2.5, cy - TILE / 2, 1, TILE);
    g.fillStyle = post;
    g.fillRect(cx - 6.5, cy - TILE / 2 - 3, 3, 9);
    g.fillRect(cx + 3.5, cy - TILE / 2 - 3, 3, 9);
    g.fillRect(cx - 6.5, cy + TILE / 2 - 6, 3, 9);
    g.fillRect(cx + 3.5, cy + TILE / 2 - 6, 3, 9);
  }
}

/** A small clinker rowboat — moored at a jetty (bobbing on the water) or hauled
 *  out on the strand. Read from the side: tarred hull, lapped strakes, a bench
 *  and shipped oars. */
function drawBoat(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 700 + cx * 0.3) * 1.4;
  const y = cy + bob;
  // Water shadow / resting hollow.
  g.fillStyle = "rgba(10,20,30,0.25)";
  g.beginPath(); g.ellipse(cx, cy + 9, 17, 4.5, 0, 0, Math.PI * 2); g.fill();
  // Hull: a shallow crescent, stem and stern swept up.
  g.fillStyle = "#2e241a";
  g.beginPath();
  g.moveTo(cx - 16, y - 3);
  g.quadraticCurveTo(cx, y + 12, cx + 16, y - 3);
  g.lineTo(cx + 13, y + 2);
  g.quadraticCurveTo(cx, y + 9, cx - 13, y + 2);
  g.closePath(); g.fill();
  // Lapped strakes.
  g.strokeStyle = "#4a3826"; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(cx - 14, y); g.quadraticCurveTo(cx, y + 8, cx + 14, y); g.stroke();
  g.beginPath(); g.moveTo(cx - 15, y - 2); g.quadraticCurveTo(cx, y + 5, cx + 15, y - 2); g.stroke();
  // Gunwale highlight.
  g.strokeStyle = "#6f5436"; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(cx - 16, y - 3); g.quadraticCurveTo(cx, y + 4, cx + 16, y - 3); g.stroke();
  // The bench + shipped oars.
  g.fillStyle = "#5a4127";
  g.fillRect(cx - 4, y - 1, 8, 2.6);
  g.strokeStyle = "#7d6040"; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(cx - 9, y + 1); g.lineTo(cx + 11, y - 4); g.stroke();
  // Mooring rope off the bow.
  g.strokeStyle = "rgba(180,160,120,0.7)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx - 16, y - 3); g.quadraticCurveTo(cx - 20, y + 1, cx - 19, y + 7); g.stroke();
}

/** A clump of cattail reeds at the pond edge — tall stalks, brown seed heads,
 *  swaying gently. `seed` staggers the sway between clumps. */
function drawReeds(g: CanvasRenderingContext2D, cx: number, cy: number, now: number, seed: number): void {
  g.fillStyle = "rgba(10,18,14,0.2)";
  g.beginPath(); g.ellipse(cx, cy + 9, 9, 3, 0, 0, Math.PI * 2); g.fill();
  const stalks: [number, number][] = [[-6, 18], [-2, 23], [2, 20], [6, 16], [0, 15]];
  for (let i = 0; i < stalks.length; i++) {
    const [dx, h] = stalks[i]!;
    const sway = Math.sin(now / 900 + seed + i * 1.7) * 1.6;
    g.strokeStyle = i % 2 ? "#5d7042" : "#4e6038";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(cx + dx, cy + 9);
    g.quadraticCurveTo(cx + dx + sway * 0.5, cy + 9 - h * 0.6, cx + dx + sway, cy + 9 - h);
    g.stroke();
    if (i !== 4) { // the brown cattail head on most stalks
      g.fillStyle = "#6b4a2a";
      g.beginPath(); g.ellipse(cx + dx + sway, cy + 9 - h - 3, 1.7, 4.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#7d5832";
      g.beginPath(); g.ellipse(cx + dx + sway - 0.5, cy + 9 - h - 4.4, 0.9, 2, 0, 0, Math.PI * 2); g.fill();
    }
  }
}

/** A dead tree: a fallen mossy log ("log") or a standing barkless snag ("snag")
 *  — the deadfall that makes a wood read as old. */
function drawDeadfall(g: CanvasRenderingContext2D, cx: number, cy: number, kind: "log" | "snag"): void {
  if (kind === "log") {
    shadow(g, cx, cy + 8, 15, 4);
    // The trunk lying across the tile, bark split, moss on top.
    g.fillStyle = "#4e3d29";
    g.beginPath();
    g.moveTo(cx - 16, cy + 2); g.quadraticCurveTo(cx, cy - 3, cx + 16, cy + 4);
    g.lineTo(cx + 15, cy + 9); g.quadraticCurveTo(cx, cy + 4, cx - 15, cy + 7);
    g.closePath(); g.fill();
    g.fillStyle = "#5d4a33"; // top light
    g.beginPath(); g.moveTo(cx - 16, cy + 2); g.quadraticCurveTo(cx, cy - 3, cx + 16, cy + 4);
    g.lineTo(cx + 15, cy + 6); g.quadraticCurveTo(cx, cy - 1, cx - 15, cy + 4); g.closePath(); g.fill();
    g.fillStyle = "#caa56a"; // cut/broken end rings
    g.beginPath(); g.ellipse(cx - 15.5, cy + 4.5, 2.6, 3.4, 0.15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#8a6a40"; g.lineWidth = 0.8;
    g.beginPath(); g.ellipse(cx - 15.5, cy + 4.5, 1.3, 1.8, 0.15, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(74,105,62,0.75)"; // moss patches
    g.beginPath(); g.ellipse(cx - 4, cy, 4.5, 1.8, 0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + 8, cy + 2.5, 3.2, 1.4, -0.15, 0, Math.PI * 2); g.fill();
    // A shelf fungus on the flank.
    g.fillStyle = "#b0854e";
    g.beginPath(); g.arc(cx + 3, cy + 6.5, 2.2, 0, Math.PI); g.fill();
  } else {
    shadow(g, cx, cy + 12, 8, 3);
    // A standing snag: pale barkless trunk, broken crown, one dead limb.
    g.fillStyle = "#8f8272";
    g.beginPath();
    g.moveTo(cx - 3.4, cy + 12); g.lineTo(cx - 2, cy - 14); g.lineTo(cx + 1, cy - 18);
    g.lineTo(cx + 2.6, cy - 8); g.lineTo(cx + 3.6, cy + 12);
    g.closePath(); g.fill();
    g.fillStyle = "#a5988a"; // lit side
    g.beginPath(); g.moveTo(cx - 3.4, cy + 12); g.lineTo(cx - 2, cy - 14); g.lineTo(cx - 0.4, cy - 16.5);
    g.lineTo(cx - 0.4, cy + 12); g.closePath(); g.fill();
    g.strokeStyle = "#8f8272"; g.lineWidth = 2.4; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx + 1, cy - 6); g.quadraticCurveTo(cx + 8, cy - 10, cx + 11, cy - 9); g.stroke();
    g.lineCap = "butt";
    g.strokeStyle = "#6e6355"; g.lineWidth = 0.9; // weather checks
    g.beginPath(); g.moveTo(cx - 1, cy + 8); g.lineTo(cx - 0.4, cy - 8); g.stroke();
  }
}

/** A Crafting table: a tanning frame with a stretched hide and a jeweller's lamp. */
function drawCraftingTable(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 10, 13, 4);
  // Table legs + top.
  g.fillStyle = "#3a2c1d";
  g.fillRect(cx - 11, cy + 1, 3, 10);
  g.fillRect(cx + 8, cy + 1, 3, 10);
  g.fillStyle = "#6f5436";
  g.fillRect(cx - 13, cy - 3, 26, 6);
  g.fillStyle = "#7d6040";
  g.fillRect(cx - 13, cy - 3, 26, 2);
  // A hide stretched on a frame at the back.
  g.fillStyle = "#3a2c1d";
  g.fillRect(cx - 10, cy - 12, 2, 9);
  g.fillRect(cx + 1, cy - 12, 2, 9);
  g.fillStyle = "#b89a6a";
  g.beginPath();
  g.moveTo(cx - 8, cy - 11);
  g.lineTo(cx + 1, cy - 11);
  g.lineTo(cx - 0.5, cy - 4);
  g.lineTo(cx - 6.5, cy - 4);
  g.closePath();
  g.fill();
  // A small jeweller's lamp glint on the right.
  g.fillStyle = "#caa05a";
  g.beginPath();
  g.arc(cx + 7, cy - 6, 2.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(245,210,130,0.8)";
  g.beginPath();
  g.arc(cx + 7, cy - 6, 1.1, 0, Math.PI * 2);
  g.fill();
}

/** A Herblore cauldron: a black pot over coals with a faint green simmer. */
function drawCauldron(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  shadow(g, cx, cy + 10, 12, 4);
  // Glowing coals beneath.
  const glow = 0.5 + 0.5 * Math.sin(now / 300);
  g.fillStyle = `rgba(214,110,40,${0.45 + 0.35 * glow})`;
  g.beginPath();
  g.ellipse(cx, cy + 8, 9, 3, 0, 0, Math.PI * 2);
  g.fill();
  // The iron pot.
  g.fillStyle = "#26242a";
  g.beginPath();
  g.moveTo(cx - 9, cy - 1);
  g.quadraticCurveTo(cx - 11, cy + 7, cx, cy + 8);
  g.quadraticCurveTo(cx + 11, cy + 7, cx + 9, cy - 1);
  g.closePath();
  g.fill();
  // The rim.
  g.fillStyle = "#3b3942";
  g.fillRect(cx - 10, cy - 3, 20, 3);
  // A bubbling green brew.
  g.fillStyle = `rgba(120,180,96,${0.7 + 0.3 * glow})`;
  g.beginPath();
  g.ellipse(cx, cy - 2, 8, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  // A rising bubble.
  g.fillStyle = "rgba(150,200,120,0.55)";
  g.beginPath();
  g.arc(cx + 2, cy - 5 - 2 * glow, 1.4, 0, Math.PI * 2);
  g.fill();
}

/** A Construction workbench: a timber bench with a board and tools. */
function drawWorkbench(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 10, 13, 4);
  // Legs.
  g.fillStyle = "#3a2c1d";
  g.fillRect(cx - 11, cy + 1, 3, 10);
  g.fillRect(cx + 8, cy + 1, 3, 10);
  // The benchtop.
  g.fillStyle = "#7a5a34";
  g.fillRect(cx - 13, cy - 4, 26, 6);
  g.fillStyle = "#8a6a40";
  g.fillRect(cx - 13, cy - 4, 26, 2);
  // A plank being worked, with plank lines.
  g.fillStyle = "#a07a44";
  g.fillRect(cx - 9, cy - 7, 16, 4);
  g.strokeStyle = "rgba(60,40,20,0.5)";
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(cx - 9, cy - 5);
  g.lineTo(cx + 7, cy - 5);
  g.stroke();
  // A saw leaning against the bench.
  g.strokeStyle = "#b9bcc4";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx + 9, cy - 6);
  g.lineTo(cx + 13, cy + 2);
  g.stroke();
}

/** A Hunter snare: a bent-sapling spring trap. Greyed/sprung when depleted. */
function drawTrap(g: CanvasRenderingContext2D, cx: number, cy: number, available: boolean): void {
  shadow(g, cx, cy + 10, 10, 3);
  const wood = available ? "#7a5a32" : "#4a4038";
  const cord = available ? "#c9b079" : "#6b6258";
  // Two stakes and a noose loop on the ground.
  g.strokeStyle = wood;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx - 7, cy + 6);
  g.lineTo(cx - 7, cy - 4);
  g.moveTo(cx + 7, cy + 6);
  g.lineTo(cx + 7, cy - 4);
  g.stroke();
  // The snare loop (open when set, slack when sprung).
  g.strokeStyle = cord;
  g.lineWidth = 1.6;
  g.beginPath();
  if (available) {
    g.ellipse(cx, cy + 3, 6, 3.4, 0, 0, Math.PI * 2);
  } else {
    g.moveTo(cx - 6, cy + 5);
    g.quadraticCurveTo(cx, cy + 9, cx + 6, cy + 5);
  }
  g.stroke();
  // A trigger line strung between the stakes.
  g.strokeStyle = cord;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - 7, cy - 3);
  g.lineTo(cx + 7, cy - 3);
  g.stroke();
}

/** A Bounty board: a notice board of nailed-up contracts. */
function drawBountyBoard(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 13, 4);
  // Two posts.
  g.fillStyle = "#3a2c1d";
  g.fillRect(cx - 11, cy - 8, 3, 20);
  g.fillRect(cx + 8, cy - 8, 3, 20);
  // The board face.
  g.fillStyle = "#6b4f30";
  g.fillRect(cx - 12, cy - 12, 24, 16);
  g.fillStyle = "#5a4128";
  g.fillRect(cx - 12, cy - 12, 24, 3); // top rail shadow
  // A scatter of pinned notices.
  const notes = [
    [cx - 9, cy - 9, 7, 6],
    [cx + 1, cy - 10, 8, 6],
    [cx - 7, cy - 2, 6, 5],
    [cx + 2, cy - 2, 7, 5],
  ] as const;
  for (const [nx, ny, w, h] of notes) {
    g.fillStyle = "#d8cba6";
    g.fillRect(nx, ny, w, h);
    g.fillStyle = "#8a2c22"; // a wax-seal dot
    g.fillRect(nx + w / 2 - 1, ny + h - 2, 2, 2);
  }
}

/** A boss-dungeon portal: a dark arch with a swirling ember glow. */
// A plain rock cave mouth — a dark opening in a stony mound. No magic; you
// just walk down into the barrow/vault it fronts.
function drawPortal(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 13, 17, 5);
  // The rocky mound around the mouth.
  g.fillStyle = "#544f48";
  g.beginPath();
  g.moveTo(cx - 16, cy + 13);
  g.quadraticCurveTo(cx - 18, cy - 11, cx, cy - 15);
  g.quadraticCurveTo(cx + 18, cy - 11, cx + 16, cy + 13);
  g.closePath();
  g.fill();
  // Lit upper rock + a couple of boulders for texture.
  g.fillStyle = "#6b655c";
  g.beginPath(); g.ellipse(cx - 9, cy - 6, 5, 4, -0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 9, cy - 5, 5, 4, 0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#473f38";
  g.beginPath(); g.ellipse(cx - 11, cy + 8, 4, 3, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 11, cy + 8, 4, 3, 0, 0, Math.PI * 2); g.fill();
  // The dark arched opening you descend into.
  g.fillStyle = "#0c0a09";
  g.beginPath();
  g.moveTo(cx - 7, cy + 12);
  g.lineTo(cx - 7, cy - 1);
  g.quadraticCurveTo(cx, cy - 11, cx + 7, cy - 1);
  g.lineTo(cx + 7, cy + 12);
  g.closePath();
  g.fill();
  // A hint of depth at the throat of the cave.
  g.fillStyle = "rgba(60,50,44,0.6)";
  g.beginPath();
  g.moveTo(cx - 4, cy + 12);
  g.lineTo(cx - 4, cy + 2);
  g.quadraticCurveTo(cx, cy - 5, cx + 4, cy + 2);
  g.lineTo(cx + 4, cy + 12);
  g.closePath();
  g.fill();
}

// --- The Ironvale Sewers' mouth: a round iron manhole cover set into the city
//     pavement, not a cave. A dark ring of seepage stains the flagstones around
//     it; the lid itself is a bolted iron disc with pry-slots and a lift-ring,
//     and a faint sour glimmer leaks up through the drain slots. ---
function drawSewerLid(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  // Seepage: a broad, soft dark stain bled into the flagstones (drawn flat, so
  // it reads as ground grime under the lid, not an object floating above it).
  g.save();
  g.fillStyle = "rgba(28,38,30,0.34)";
  g.beginPath(); g.ellipse(cx, cy + 2, 20, 12, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(20,28,22,0.30)";
  g.beginPath(); g.ellipse(cx - 6, cy + 6, 8, 4, 0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 7, cy + 5, 6, 3, -0.2, 0, Math.PI * 2); g.fill();
  g.restore();
  // The socket the lid sits in — a recessed stone kerb, darker at the lip.
  g.fillStyle = "#2b2926";
  g.beginPath(); g.ellipse(cx, cy, 15, 9.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#3d3a35";
  g.beginPath(); g.ellipse(cx, cy - 0.5, 14, 8.8, 0, 0, Math.PI * 2); g.fill();
  // The iron disc.
  g.fillStyle = "#3a3d42";
  g.beginPath(); g.ellipse(cx, cy, 12.5, 7.8, 0, 0, Math.PI * 2); g.fill();
  // A raised concentric ring and the cross-ribs of the casting.
  g.strokeStyle = "#4c5056"; g.lineWidth = 1.4;
  g.beginPath(); g.ellipse(cx, cy, 9, 5.6, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "#2c2f33"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx - 8.5, cy); g.lineTo(cx + 8.5, cy); g.stroke();
  g.beginPath(); g.moveTo(cx, cy - 5.2); g.lineTo(cx, cy + 5.2); g.stroke();
  // Bolt heads around the rim.
  g.fillStyle = "#55595f";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    circle(g, cx + Math.cos(a) * 10.6, cy + Math.sin(a) * 6.5, 1.1);
  }
  // Rust bleed and a top-left sheen so the iron reads as metal, not stone.
  g.fillStyle = "rgba(110,90,68,0.5)";
  g.beginPath(); g.ellipse(cx + 5, cy + 2.5, 3.5, 2, 0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(150,158,166,0.35)";
  g.beginPath(); g.ellipse(cx - 4, cy - 2.5, 4, 2, -0.3, 0, Math.PI * 2); g.fill();
  // Two pry-slots and the lift-ring in the middle.
  g.fillStyle = "#111214";
  g.fillRect(cx - 7.5, cy - 0.7, 3, 1.4);
  g.fillRect(cx + 4.5, cy - 0.7, 3, 1.4);
  g.strokeStyle = "#26282b"; g.lineWidth = 1.3;
  g.beginPath(); g.ellipse(cx, cy - 0.5, 2.6, 1.7, 0, 0, Math.PI * 2); g.stroke();
  // A faint sour glimmer breathing up through the slots — the dark below.
  const pulse = 0.35 + 0.25 * Math.sin(now / 700);
  g.fillStyle = `rgba(120,150,110,${pulse.toFixed(3)})`;
  g.fillRect(cx - 7.2, cy - 0.3, 2.4, 0.7);
  g.fillRect(cx + 4.8, cy - 0.3, 2.4, 0.7);
}

// --- Anvil: an iron horn on a dark stump ---
function drawAnvil(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.fillStyle = "#2f2a26"; // wooden stump base
  g.fillRect(cx - 8, cy + 4, 16, 8);
  g.fillStyle = "#3a342f";
  g.fillRect(cx - 8, cy + 4, 16, 2);
  g.fillStyle = "#54565e"; // iron body
  g.fillRect(cx - 6, cy - 1, 12, 5); // waist
  g.beginPath(); // the top face with its horn
  g.moveTo(cx - 11, cy - 6);
  g.lineTo(cx + 8, cy - 6);
  g.lineTo(cx + 13, cy - 3); // horn tip
  g.lineTo(cx + 8, cy - 1);
  g.lineTo(cx - 8, cy - 1);
  g.closePath();
  g.fill();
  g.fillStyle = "#6c6e77"; // lit top edge
  g.fillRect(cx - 11, cy - 6, 19, 1.5);
  g.fillStyle = "#8b8e99"; // cold steel sheen on the face
  g.fillRect(cx - 8, cy - 5.5, 7, 1);
  // a smith's hammer resting on the face
  g.save();
  g.translate(cx + 3, cy - 7);
  g.rotate(-0.5);
  g.fillStyle = "#6b4f30";
  g.fillRect(-1, 0, 2, 9); // haft
  g.fillStyle = "#5a5d66";
  g.fillRect(-4, -3, 8, 4); // head
  g.fillStyle = "#7c808c";
  g.fillRect(-4, -3, 8, 1.2);
  g.restore();
}

// --- Bank chest: iron-bound wooden chest ---
function drawBank(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.fillStyle = "#5a4327"; // body
  g.fillRect(cx - 12, cy - 4, 24, 16);
  g.fillStyle = "#6e5331"; // lid
  g.fillRect(cx - 12, cy - 10, 24, 7);
  g.fillStyle = "#3a3a40"; // iron bands
  g.fillRect(cx - 12, cy - 4, 24, 2);
  g.fillRect(cx - 2, cy - 10, 4, 22);
  g.fillStyle = "#c9a24a"; // lock
  g.fillRect(cx - 2, cy + 1, 4, 4);
  g.fillStyle = "#8a6a35"; // wood grain
  g.fillRect(cx - 10, cy - 1, 7, 1);
  g.fillRect(cx + 4, cy + 5, 6, 1);
  // a spill of coins at its foot — no mistaking the bank
  g.fillStyle = "#e0b84f";
  circle(g, cx - 8, cy + 13, 2);
  circle(g, cx - 3, cy + 14, 1.7);
  circle(g, cx + 6, cy + 13, 1.9);
  g.fillStyle = "#f4dd8a";
  circle(g, cx - 8, cy + 12.4, 0.8);
  circle(g, cx + 6, cy + 12.4, 0.8);
}

/** The Grand Exchange booth: a clerk's counter under a striped awning, a set
 *  of brass scales on top and a bid/ask chalkboard behind. */
function drawGrandExchange(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  // A grand classical trading hall — deliberately far larger and grander than
  // anything around it (~2 tiles across): marble colonnade, gilt pediment, a big
  // hanging ledger board and trade banners, so the Exchange reads as THE hub.
  const W = 44; // half-width of the hall
  shadow(g, cx, cy + 20, W + 4, 7);
  // Broad stone steps up to the platform.
  g.fillStyle = "#8b8172"; g.fillRect(cx - W - 4, cy + 14, (W + 4) * 2, 6);
  g.fillStyle = "#a49a89"; g.fillRect(cx - W - 1, cy + 11, (W + 1) * 2, 4);
  // Hall body (pale marble) sitting on the platform.
  g.fillStyle = "#cdc6b6"; g.fillRect(cx - W, cy - 12, W * 2, 24);
  g.fillStyle = "#bcb4a2"; g.fillRect(cx - W, cy + 6, W * 2, 6); // base shadow band
  // Colonnade: fluted columns with capitals across the front.
  const cols = 7;
  for (let i = 0; i < cols; i++) {
    const colx = cx - W + 6 + i * ((W * 2 - 12) / (cols - 1));
    g.fillStyle = "#e7e1d2"; g.fillRect(colx - 2.5, cy - 10, 5, 22); // shaft
    g.fillStyle = "#b7ad99"; g.fillRect(colx - 2.5, cy - 10, 1.4, 22); // shade side
    g.fillStyle = "#efe9db"; g.fillRect(colx - 3.5, cy - 11, 7, 2); // capital
    g.fillStyle = "#efe9db"; g.fillRect(colx - 3.5, cy + 10, 7, 2); // base
  }
  // Entablature + gilt pediment (triangular roof).
  g.fillStyle = "#7a6f5a"; g.fillRect(cx - W - 2, cy - 15, (W + 2) * 2, 4);
  g.fillStyle = "#d9cfb0"; g.fillRect(cx - W - 2, cy - 15, (W + 2) * 2, 1.5);
  g.fillStyle = "#c9b98a"; // pediment
  g.beginPath();
  g.moveTo(cx - W - 4, cy - 15); g.lineTo(cx, cy - 30); g.lineTo(cx + W + 4, cy - 15); g.closePath(); g.fill();
  g.strokeStyle = "#e2c061"; g.lineWidth = 1.6; g.stroke(); // gilt trim
  // A gilt scales-of-trade emblem in the tympanum.
  g.strokeStyle = "#e2c061"; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(cx, cy - 24); g.lineTo(cx, cy - 18); g.moveTo(cx - 4, cy - 22); g.lineTo(cx + 4, cy - 22); g.stroke();
  g.fillStyle = "#f0d477";
  g.beginPath(); g.arc(cx - 4, cy - 21, 1.6, 0, Math.PI); g.fill();
  g.beginPath(); g.arc(cx + 4, cy - 21, 1.6, 0, Math.PI); g.fill();
  // A big hanging ledger board (the live bid/ask listings) under the colonnade.
  g.fillStyle = "#241f18"; g.fillRect(cx - 15, cy - 8, 30, 16);
  g.strokeStyle = "#c9a24a"; g.lineWidth = 1.5; g.strokeRect(cx - 15, cy - 8, 30, 16);
  g.strokeStyle = "rgba(180,205,180,0.75)"; g.lineWidth = 1; // chalked rows
  for (let i = 0; i < 5; i++) { const yy = cy - 5.5 + i * 3; g.beginPath(); g.moveTo(cx - 12, yy); g.lineTo(cx + (i % 2 ? 5 : 11), yy); g.stroke(); }
  // Trade banners flanking the entrance.
  for (const bx of [cx - W + 4, cx + W - 4]) {
    g.fillStyle = "#9a2f2a"; g.beginPath();
    g.moveTo(bx - 3, cy - 10); g.lineTo(bx + 3, cy - 10); g.lineTo(bx + 3, cy + 6); g.lineTo(bx, cy + 3); g.lineTo(bx - 3, cy + 6); g.closePath(); g.fill();
    g.fillStyle = "#e2c061"; g.beginPath(); g.arc(bx, cy - 5, 1.6, 0, Math.PI * 2); g.fill();
  }
}

/**
 * A wild forage clump. Each survivalist find has its own silhouette and palette
 * so a glance tells a Mushroom Cluster from a Thornberry Bramble from a glowing
 * Dawnspore Ring — no more identical green blobs. Keyed off the spot's resource
 * action id (`surv_forage_<type>`). While picked clean it fades and drops its
 * ripe accents (respawning), matching the old dim behaviour.
 */
function drawForageSpot(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  available: boolean,
  resource?: string,
): void {
  shadow(g, cx, cy + 9, 11, 4);
  const kind = (resource ?? "").replace(/^surv_forage_/, "");
  if (!available) g.globalAlpha = 0.5; // picked clean — thin and greyed
  const disc = (dx: number, dy: number, r: number, fill: string): void => {
    g.fillStyle = fill;
    g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); g.fill();
  };
  switch (kind) {
    case "mushroom": {
      // A cluster of capped mushrooms: pale stems under warm brown-red caps.
      const caps = [[-5, 3, 5, 2.6], [4, 4, 4.2, 2.2], [0, -1, 6, 3]] as const;
      for (const [dx, dy, , ch] of caps) {
        g.fillStyle = "#d8cbb0"; // stem
        g.fillRect(cx + dx - 1.3, cy + dy, 2.6, ch + 3);
      }
      for (const [dx, dy, cw] of caps) {
        g.fillStyle = "#9c4a34"; // cap
        g.beginPath(); g.ellipse(cx + dx, cy + dy, cw, cw * 0.7, 0, Math.PI, 0); g.fill();
        g.fillStyle = "#e7d7c2"; // speckles
        disc(dx - cw * 0.35, dy - cw * 0.25, 0.9, "#e7d7c2");
        disc(dx + cw * 0.3, dy - cw * 0.15, 0.8, "#e7d7c2");
      }
      break;
    }
    case "thornberry": {
      // A dark thorny bramble hung with red berries.
      g.strokeStyle = "#3f5230"; g.lineWidth = 1.6; g.lineCap = "round";
      for (const [x0, y0, x1, y1] of [[-7, 6, 2, -6], [7, 6, -2, -5], [-5, 5, 6, 2]] as const) {
        g.beginPath(); g.moveTo(cx + x0, cy + y0);
        g.quadraticCurveTo(cx, cy - 2, cx + x1, cy + y1); g.stroke();
      }
      disc(-4, 3, 4.5, "#4a6338"); disc(4, 2, 4, "#4a6338"); disc(0, -2, 4.2, "#587544");
      if (available) for (const [dx, dy] of [[-5, 0], [3, -1], [5, 3], [-1, 4]] as const) disc(dx, dy, 1.7, "#c02f2a");
      break;
    }
    case "nightshade": {
      // Dark waxy leaves with glossy purple-black berries.
      disc(-5, 3, 5.5, "#2f4436"); disc(5, 3, 5, "#2f4436"); disc(0, 0, 6, "#3a5442");
      disc(-2, -3, 3.5, "#46654e");
      if (available) for (const [dx, dy] of [[-3, 1], [4, 0], [0, 4], [2, -2]] as const) {
        disc(dx, dy, 2, "#3a1f52"); disc(dx - 0.6, dy - 0.6, 0.7, "#b48fe0");
      }
      break;
    }
    case "hearthroot":
    case "ashroot": {
      // A snarl of interlocking roots — hearthroot glows ember-warm, ashroot is
      // cold grey.
      const warm = kind === "hearthroot";
      g.strokeStyle = warm ? "#7a4326" : "#6a6560"; g.lineWidth = 2.4; g.lineCap = "round";
      for (const [x0, y0, x1, y1] of [[-7, 7, 5, 0], [7, 7, -5, 1], [-4, 8, 3, -4], [4, 8, -3, -3]] as const) {
        g.beginPath(); g.moveTo(cx + x0, cy + y0);
        g.quadraticCurveTo(cx, cy + 2, cx + x1, cy + y1); g.stroke();
      }
      g.strokeStyle = warm ? "#c86a2e" : "#938d86"; g.lineWidth = 1.1;
      for (const [x0, y0, x1, y1] of [[-6, 6, 4, 0], [6, 6, -4, 1]] as const) {
        g.beginPath(); g.moveTo(cx + x0, cy + y0);
        g.quadraticCurveTo(cx, cy + 2, cx + x1, cy + y1); g.stroke();
      }
      if (available && warm) { disc(0, 1, 3, "rgba(240,150,60,0.35)"); disc(0, 1, 1.4, "#f0b85a"); }
      break;
    }
    case "fiber": {
      // Fibreweed: a tuft of tall grassy blades.
      g.strokeStyle = available ? "#6f9a44" : "#647052"; g.lineWidth = 1.5; g.lineCap = "round";
      for (const [dx, sway] of [[-6, -3], [-3, -1], [0, 0], [3, 1], [6, 3]] as const) {
        g.beginPath(); g.moveTo(cx + dx, cy + 8);
        g.quadraticCurveTo(cx + dx + sway, cy - 2, cx + dx + sway * 1.6, cy - 9); g.stroke();
      }
      g.strokeStyle = available ? "#89b85c" : "#74805e"; g.lineWidth = 1;
      for (const [dx, sway] of [[-4, -2], [1, 0], [5, 2]] as const) {
        g.beginPath(); g.moveTo(cx + dx, cy + 8);
        g.quadraticCurveTo(cx + dx + sway, cy - 3, cx + dx + sway * 1.7, cy - 10); g.stroke();
      }
      break;
    }
    case "deepmoss": {
      // A low, flat bed of blue-green moss — overlapping soft mounds.
      disc(-6, 5, 5, "#3a5f52"); disc(6, 5, 5, "#3a5f52"); disc(-2, 4, 5.5, "#456e5f");
      disc(3, 3, 5, "#456e5f"); disc(0, 2, 4, "#568373");
      if (available) for (const [dx, dy] of [[-3, 3], [3, 2], [0, 5]] as const) disc(dx, dy, 0.9, "#8fc0ad");
      break;
    }
    case "ashbloom":
    case "dawnspore": {
      // Pale flowering stalks — ashbloom is ashen white, dawnspore glows softly.
      const glow = kind === "dawnspore";
      g.strokeStyle = "#7d8a72"; g.lineWidth = 1.3; g.lineCap = "round";
      const stalks = [[-5, 8], [-2, 8], [2, 8], [5, 8]] as const;
      for (const [dx] of stalks) { g.beginPath(); g.moveTo(cx + dx, cy + 8); g.lineTo(cx + dx * 0.6, cy - 6); g.stroke(); }
      for (const [dx] of stalks) {
        const hx = cx + dx * 0.6, hy = cy - 6;
        if (glow) disc(dx * 0.6, -6, 3, "rgba(230,220,160,0.3)");
        g.fillStyle = glow ? "#f0e4a6" : "#e6e2d6";
        g.beginPath(); g.arc(hx, hy, 1.8, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    default: {
      // Generic leafy clump (the old look) for any unlabelled forage spot.
      for (const [dx, dy, r] of [[-6, 4, 6], [6, 4, 6], [0, 1, 7], [-3, -3, 5], [3, -3, 5]] as const) disc(dx, dy, r, "#5d7e3e");
      for (const [dx, dy, r] of [[-3, -4, 3], [3, -4, 3], [0, -1, 3]] as const) disc(dx, dy, r, "#79a04e");
      if (available) for (const [dx, dy] of [[-4, 0], [5, -1], [1, 4]] as const) disc(dx, dy, 1.6, "#d2604a");
    }
  }
  g.globalAlpha = 1;
}

// --- Cooking fire: logs with animated flame ---
/**
 * A gravestone: a leaning headstone with a soft mourning glow.
 *
 * Deliberately loud — a grave is a timer you are racing, so it has to be
 * findable from the edge of the screen rather than something you hunt for on
 * the tile you think you died on.
 */
function drawGrave(g: CanvasRenderingContext2D, x: number, y: number, now: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(now / 620);
  g.save();
  // Ground shadow.
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath();
  g.ellipse(x, y + 9, 12, 5, 0, 0, Math.PI * 2);
  g.fill();
  // Mourning glow.
  const glow = g.createRadialGradient(x, y, 2, x, y, 22);
  glow.addColorStop(0, `rgba(150, 190, 220, ${0.20 + 0.14 * pulse})`);
  glow.addColorStop(1, "rgba(150, 190, 220, 0)");
  g.fillStyle = glow;
  g.fillRect(x - 24, y - 24, 48, 48);
  // The stone, leaning slightly — nobody set it straight.
  g.translate(x, y);
  g.rotate(-0.06);
  g.fillStyle = "#6d6f78";
  g.beginPath();
  g.moveTo(-7, 8);
  g.lineTo(-7, -6);
  g.arc(0, -6, 7, Math.PI, 0);
  g.lineTo(7, 8);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 1;
  g.stroke();
  // A carved mark, so it reads as a grave and not a rock.
  g.strokeStyle = "#3f424a";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -8); g.lineTo(0, 1);
  g.moveTo(-3.5, -5); g.lineTo(3.5, -5);
  g.stroke();
  g.restore();
}

function drawFire(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.strokeStyle = "#4a3320"; // logs
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - 11, cy + 9);
  g.lineTo(cx + 9, cy + 5);
  g.moveTo(cx - 9, cy + 5);
  g.lineTo(cx + 11, cy + 9);
  g.stroke();
  const flick = 0.7 + 0.3 * Math.sin(now / 120);
  g.fillStyle = "#7d1f15"; // outer flame
  flame(g, cx, cy + 2, 9 * flick, 16 * flick);
  g.fillStyle = "#d2742c"; // mid
  flame(g, cx, cy + 3, 6 * flick, 12 * flick);
  g.fillStyle = "#f2cf6b"; // core
  flame(g, cx, cy + 4, 3 * flick, 7 * flick);
}

function flame(g: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number): void {
  g.beginPath();
  g.moveTo(cx - w, baseY);
  g.quadraticCurveTo(cx - w * 0.6, baseY - h, cx, baseY - h);
  g.quadraticCurveTo(cx + w * 0.6, baseY - h, cx + w, baseY);
  g.quadraticCurveTo(cx, baseY + 3, cx - w, baseY);
  g.fill();
}

// --- Furnace: a small stone furnace with a glowing mouth ---
function drawFurnace(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  shadow(g, cx, cy + 11, 12, 4);
  g.fillStyle = "#4a4b53"; // stone body
  g.beginPath();
  g.moveTo(cx - 12, cy + 12);
  g.lineTo(cx - 9, cy - 11);
  g.lineTo(cx + 9, cy - 11);
  g.lineTo(cx + 12, cy + 12);
  g.closePath();
  g.fill();
  g.fillStyle = "#5b5c64";
  g.fillRect(cx - 11, cy - 13, 22, 4); // chimney rim
  const glow = 0.6 + 0.4 * Math.sin(now / 180);
  g.fillStyle = `rgba(226, 120, 44, ${glow})`; // glowing mouth
  g.beginPath();
  g.arc(cx, cy + 4, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = `rgba(242, 207, 107, ${glow})`;
  g.beginPath();
  g.arc(cx, cy + 4, 2.5, 0, Math.PI * 2);
  g.fill();
  // heat halo bleeding from the mouth
  const halo = g.createRadialGradient(cx, cy + 4, 2, cx, cy + 4, 13);
  halo.addColorStop(0, `rgba(230,120,40,${(0.30 * glow).toFixed(2)})`);
  halo.addColorStop(1, "rgba(230,120,40,0)");
  g.fillStyle = halo;
  g.beginPath(); g.arc(cx, cy + 4, 13, 0, Math.PI * 2); g.fill();
  // chimney smoke: three drifting puffs
  for (let i = 0; i < 3; i++) {
    const ph = ((now / 900) + i * 0.33) % 1;
    g.fillStyle = `rgba(190,190,200,${(0.28 * (1 - ph)).toFixed(2)})`;
    g.beginPath();
    g.arc(cx + 2 + Math.sin(ph * 6 + i) * 3, cy - 14 - ph * 14, 2 + ph * 3.5, 0, Math.PI * 2);
    g.fill();
  }
}

/** Draw a prop scaled up around its own centre — stations gain presence
 *  without touching their art. The callback draws at (0,0). */
function scaled(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, draw: () => void): void {
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  draw();
  g.restore();
}

/** A soft contact shadow under a sprite. */
/** The sun's cast-shadow parameters for the current hour: which way and how far
 *  shadows stretch, and how strong they read. Long and faint near dawn/dusk,
 *  short and crisp at noon, gone at night. Shares the day cycle with the veil. */
interface SunCast { night: number; ox: number; oy: number; len: number; alpha: number }
function sunCast(): SunCast {
  const phase = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  const sun = Math.sin(phase * Math.PI * 2 - Math.PI / 2); // -1 midnight … +1 noon
  const day = Math.max(0, sun);   // 0 by night, 1 at noon
  const low = 1 - day;            // long shadows when the sun sits low
  const side = phase < 0.5 ? -1 : 1; // mornings cast west, afternoons east
  return { night: Math.max(0, -sun), ox: side * low * 11, oy: 3 + low * 4, len: 1 + low * 1.4, alpha: 0.10 + 0.26 * day };
}

/** A soft directional shadow cast from a thing's feet by the sun's position. */
function castShadow(g: CanvasRenderingContext2D, cx: number, feetY: number, sv: SunCast): void {
  if (sv.alpha < 0.02) return;
  const sprite = discSprite("cast-shadow", 16, [[0, "rgba(0,0,0,1)"], [1, "rgba(0,0,0,0)"]]);
  const rx = 9 * sv.len, ry = 9 * 0.42;
  g.globalAlpha = sv.alpha;
  g.drawImage(sprite, cx + sv.ox - rx, feetY + sv.oy - ry, rx * 2, ry * 2);
  g.globalAlpha = 1;
}

/** A gentle always-on bloom halo over fires and lamps, so flames glow softly by
 *  day too (the big warm pools in drawDaylight take over after dark). */
function drawLightBloom(g: CanvasRenderingContext2D, lights: Array<[number, number]>, now: number): void {
  if (lights.length === 0) return;
  g.save();
  g.globalCompositeOperation = "lighter";
  const fl = 0.7 + 0.3 * Math.sin(now / 180);
  const bloom = discSprite("light-bloom", 26, [[0, "rgba(255,196,110,1)"], [1, "rgba(255,196,110,0)"]]);
  g.globalAlpha = 0.20 * fl;
  for (const [lx, ly] of lights) g.drawImage(bloom, lx - 26, ly - 26);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.restore();
}

function shadow(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  // A soft, feathered contact shadow (radial falloff) so things sit in the
  // world instead of floating on a hard grey disc.
  const sprite = discSprite("contact-shadow", 24,
    [[0, "rgba(0,0,0,0.34)"], [0.7, "rgba(0,0,0,0.22)"], [1, "rgba(0,0,0,0)"]]);
  g.drawImage(sprite, cx - rx, cy - ry, rx * 2, ry * 2);
}

// --- Trees: a shared stump when felled; species-specific canopy when standing ---
function drawTree(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  available: boolean,
  species?: string,
): void {
  if (!available) {
    shadow(g, cx, cy + 10, 7, 3);
    g.fillStyle = "#7c6e54";
    g.fillRect(cx - 5, cy + 4, 10, 7); // stump
    g.fillStyle = "#9a8a6e";
    g.fillRect(cx - 5, cy + 4, 10, 2);
    g.fillStyle = "#5a4b34";
    circle(g, cx - 9, cy + 9, 1.6);
    circle(g, cx + 8, cy + 10, 1.4);
    return;
  }
  if (species === "coldpine") return drawColdpine(g, cx, cy);
  if (species === "greyoak") return drawGreyoak(g, cx, cy);
  drawBroadleaf(g, cx, cy, TREE_PAL[species ?? "ashwood"] ?? TREE_PAL["ashwood"]!);
}

// A canopy palette per wood, so each tier reads at a glance (low → high tier:
// pale grey-green → rust → silver → dark iron → deep teal → gold).
interface TreePal { trunk: string; lit: string; dark: string; mid: string; light: string; hi: string }
const TREE_PAL: Record<string, TreePal> = {
  ashwood:   { trunk: "#8d7e60", lit: "#a99a78", dark: "#3f4d2a", mid: "#4e5f34", light: "#5d6e3e", hi: "rgba(184,192,150,0.5)" },
  ruewood:   { trunk: "#6e4b3a", lit: "#8a6450", dark: "#5a2f2a", mid: "#7a3f30", light: "#9a5238", hi: "rgba(214,150,110,0.5)" },
  stonewood: { trunk: "#8a8a82", lit: "#a8a89e", dark: "#46584a", mid: "#5f7060", light: "#7d8e78", hi: "rgba(206,214,200,0.5)" },
  ironbark:  { trunk: "#4a4f57", lit: "#656c76", dark: "#26323a", mid: "#33434c", light: "#46585f", hi: "rgba(150,176,186,0.45)" },
  deeproot:  { trunk: "#3f3a44", lit: "#574f5e", dark: "#123a32", mid: "#1d5046", light: "#2f6b5c", hi: "rgba(120,200,178,0.4)" },
  heartoak:  { trunk: "#7a5a2e", lit: "#a07b3e", dark: "#5a4a14", mid: "#7d6a1e", light: "#a89030", hi: "rgba(242,216,120,0.55)" },
};

// A layered broadleaf canopy in the given palette: dark silhouette rim →
// shaded mass → lit crown → leaf-cluster texture → sun dapples. The rim is
// what separates the tree from the terrain; the clusters are what make it
// read as foliage instead of stacked circles.
function drawBroadleaf(g: CanvasRenderingContext2D, cx: number, cy: number, p: TreePal): void {
  shadow(g, cx, cy + 12, 12, 4);
  // trunk with a root flare and a bark seam
  g.fillStyle = p.trunk;
  g.beginPath();
  g.moveTo(cx - 3, cy - 2); g.lineTo(cx + 3, cy - 2);
  g.lineTo(cx + 5, cy + TILE / 2 - 2); g.lineTo(cx - 5, cy + TILE / 2 - 2);
  g.closePath(); g.fill();
  g.fillStyle = p.lit;
  g.fillRect(cx - 3, cy - 2, 2, TILE / 2 - 1);
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx + 1, cy + 2); g.lineTo(cx + 2, cy + TILE / 2 - 4); g.stroke();
  // silhouette rim: the canopy shape, slightly larger, in deep shade
  g.fillStyle = "rgba(12,18,10,0.45)";
  circle(g, cx - 7, cy - 2, 10.5);
  circle(g, cx + 7, cy - 2, 10.5);
  circle(g, cx, cy - 8, 13.5);
  // canopy mass
  g.fillStyle = p.dark;
  circle(g, cx - 7, cy - 2, 9);
  circle(g, cx + 7, cy - 2, 9);
  g.fillStyle = p.mid;
  circle(g, cx, cy - 8, 12);
  g.fillStyle = p.light;
  circle(g, cx - 3, cy - 11, 7);
  // leaf clusters: lit tufts on the sun side, deep tufts under the boughs
  g.fillStyle = p.light;
  circle(g, cx + 8, cy - 7, 3.4);
  circle(g, cx - 10, cy - 5, 3.0);
  circle(g, cx + 2, cy - 14, 3.2);
  g.fillStyle = p.dark;
  circle(g, cx + 4, cy + 2, 3.4);
  circle(g, cx - 5, cy + 3, 3.0);
  // sun dapples
  g.fillStyle = p.hi;
  circle(g, cx - 4, cy - 12, 3);
  circle(g, cx + 5, cy - 10, 1.8);
  circle(g, cx - 8, cy - 7, 1.5);
}

// Coldpine: a tall, cold blue-green conifer — each tier split into a shaded
// west half and a lit east half, with snow settled on the windward edges.
function drawColdpine(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 12, 8, 3);
  g.fillStyle = "#5a4a36"; // narrow trunk
  g.fillRect(cx - 2, cy + 2, 4, TILE / 2 - 4);
  g.fillStyle = "#6e5c46";
  g.fillRect(cx - 2, cy + 2, 1.5, TILE / 2 - 4);
  const tier = (baseY: number, w: number, h: number, dark: string, lit: string) => {
    // silhouette rim under each tier so the boughs stack with depth
    g.fillStyle = "rgba(8,14,12,0.4)";
    g.beginPath(); g.moveTo(cx, baseY - h); g.lineTo(cx - w - 1.4, baseY + 1.4); g.lineTo(cx + w + 1.4, baseY + 1.4); g.closePath(); g.fill();
    g.fillStyle = dark; // shaded half
    g.beginPath(); g.moveTo(cx, baseY - h); g.lineTo(cx - w, baseY); g.lineTo(cx, baseY); g.closePath(); g.fill();
    g.fillStyle = lit;  // lit half
    g.beginPath(); g.moveTo(cx, baseY - h); g.lineTo(cx + w, baseY); g.lineTo(cx, baseY); g.closePath(); g.fill();
  };
  tier(cy + 6, 11, 12, "#22392a", "#2d4a35");
  tier(cy + 1, 9, 11, "#294433", "#35553e");
  tier(cy - 4, 7, 10, "#31543b", "#3e6a49");
  // snow settled on the bough tips
  g.fillStyle = "rgba(216,228,236,0.75)";
  g.fillRect(cx - 10, cy + 4.5, 5, 1.6);
  g.fillRect(cx + 4, cy - 0.5, 4.5, 1.5);
  g.fillRect(cx - 6, cy - 5.5, 4, 1.4);
  circle(g, cx, cy - 14, 1.6); // snowy crown
}

// Greyoak: a thick grey trunk under a broad, heavy grey-green crown — rimmed,
// clustered and dappled like the broadleaf, but wider and older.
function drawGreyoak(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 13, 14, 4);
  // gnarled trunk with a root flare
  g.fillStyle = "#6e6a62";
  g.beginPath();
  g.moveTo(cx - 4, cy - 1); g.lineTo(cx + 4, cy - 1);
  g.lineTo(cx + 6, cy + TILE / 2); g.lineTo(cx - 6, cy + TILE / 2);
  g.closePath(); g.fill();
  g.fillStyle = "#827d73";
  g.fillRect(cx - 4, cy - 1, 3, TILE / 2);
  g.strokeStyle = "rgba(0,0,0,0.3)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx + 1, cy + 2); g.lineTo(cx + 3, cy + TILE / 2 - 2); g.stroke();
  // silhouette rim
  g.fillStyle = "rgba(10,14,8,0.45)";
  circle(g, cx - 10, cy - 3, 11.5);
  circle(g, cx + 10, cy - 3, 11.5);
  circle(g, cx, cy - 9, 13.5);
  // crown mass
  g.fillStyle = "#33402a";
  circle(g, cx - 10, cy - 3, 10);
  circle(g, cx + 10, cy - 3, 10);
  circle(g, cx - 4, cy - 6, 11);
  circle(g, cx + 5, cy - 7, 11);
  g.fillStyle = "#46552f";
  circle(g, cx, cy - 11, 12);
  g.fillStyle = "#54663a";
  circle(g, cx - 4, cy - 13, 6);
  // leaf clusters + dapples
  g.fillStyle = "#54663a";
  circle(g, cx + 11, cy - 8, 3.6);
  circle(g, cx - 12, cy - 6, 3.2);
  g.fillStyle = "#2a3522";
  circle(g, cx + 6, cy + 1, 3.6);
  circle(g, cx - 7, cy + 2, 3.2);
  g.fillStyle = "rgba(150,165,120,0.4)";
  circle(g, cx - 5, cy - 14, 3);
  circle(g, cx + 4, cy - 12, 1.8);
}

// Rock + ore-vein colours per mineable type, so a knucklestone rock reads
// differently from a voidstone one at a glance.
interface RockPal { base: string; lit: string; vein: string }
const ROCK_PAL: Record<string, RockPal> = {
  mine_knucklestone: { base: "#5c5650", lit: "#766e62", vein: "#8a8276" },
  mine_embercite:    { base: "#3a3632", lit: "#56504a", vein: "#d2742c" },
  mine_ashiron:      { base: "#585e66", lit: "#7c828c", vein: "#aeb4be" },
  mine_ribstone:     { base: "#6a4a40", lit: "#8a6356", vein: "#b05a44" },
  mine_silica:       { base: "#8a8470", lit: "#aaa488", vein: "#eef0e0" },
  mine_gold:         { base: "#5e584c", lit: "#7c7460", vein: "#e6b53e" },
  mine_bloodore:     { base: "#5a3a36", lit: "#7a4a44", vein: "#c63a2c" },
  mine_voidstone:    { base: "#3e3550", lit: "#564a6e", vein: "#8a64e0" },
};

// --- Mineable rock: faceted boulder, coloured + veined by its ore ---
function drawRock(
  g: CanvasRenderingContext2D, cx: number, cy: number, available: boolean, resource?: string,
): void {
  const p = ROCK_PAL[resource ?? "mine_knucklestone"] ?? ROCK_PAL["mine_knucklestone"]!;
  if (!available) {
    shadow(g, cx, cy + 8, 9, 3);
    g.fillStyle = "#4f4a44";
    circle(g, cx - 4, cy + 4, 4);
    circle(g, cx + 5, cy + 5, 3);
    circle(g, cx, cy + 6, 3);
    return;
  }
  shadow(g, cx, cy + 9, 13, 4);
  g.fillStyle = p.base;
  g.beginPath();
  g.moveTo(cx - 13, cy + 6);
  g.lineTo(cx - 9, cy - 7);
  g.lineTo(cx + 2, cy - 11);
  g.lineTo(cx + 12, cy - 4);
  g.lineTo(cx + 13, cy + 7);
  g.closePath();
  g.fill();
  g.fillStyle = p.lit; // lit facet
  g.beginPath();
  g.moveTo(cx - 9, cy - 7);
  g.lineTo(cx + 2, cy - 11);
  g.lineTo(cx + 1, cy + 1);
  g.lineTo(cx - 7, cy + 2);
  g.closePath();
  g.fill();
  g.strokeStyle = "#3c3833"; // crevice
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx + 2, cy - 11);
  g.lineTo(cx + 1, cy + 1);
  g.lineTo(cx + 9, cy + 5);
  g.stroke();
  // Grounding rim: a dark edge along the base so the boulder sits IN the
  // ground instead of floating on it.
  g.strokeStyle = "rgba(0,0,0,0.4)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx - 13, cy + 6);
  g.lineTo(cx - 2, cy + 8);
  g.lineTo(cx + 13, cy + 7);
  g.stroke();
  // Ore vein — a bold seam with satellite chips, bright enough to read the
  // metal at a glance, plus a cold specular chip on the lit facet.
  g.strokeStyle = p.vein;
  g.lineWidth = 2;
  g.globalAlpha = 0.9;
  g.beginPath();
  g.moveTo(cx - 7, cy + 4);
  g.lineTo(cx - 2, cy - 3);
  g.lineTo(cx + 5, cy - 7);
  g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = p.vein;
  circle(g, cx + 6, cy + 1, 2.0);
  circle(g, cx - 4, cy - 4, 1.5);
  circle(g, cx + 1, cy + 5, 1.3);
  circle(g, cx + 9, cy - 2, 1.1);
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.fillRect(cx - 5, cy - 8, 3, 1.4); // specular chip
}

// --- Fishing spot: animated ripples with a fish glint ---
function drawFishingSpot(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const r = 8 + 3 * Math.sin(now / 300);
  g.strokeStyle = "rgba(170,205,225,0.7)";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(205,222,235,0.6)";
  circle(g, cx + Math.cos(now / 500) * 4, cy + Math.sin(now / 380) * 2, 1.6);
}

// --- Aldric: a man in an earthy tunic ---
/** Each region dresses its folk differently, so a Frostgate northerner reads
 *  apart from a Redrun fisher or a Heartmoor moor-dweller — the land has a look.
 *  Themes are picked by the NPC's tile (final map coords); a per-NPC hash nudges
 *  skin/hair so folk in one place aren't clones. */
interface NpcTheme { tunic: string; collar: string; belt: string; legs: string; hats?: string }
const NPC_THEMES: Record<string, NpcTheme> = {
  spine:     { tunic: "#4a5a6e", collar: "#7d93a8", belt: "#2c3540", legs: "#33404d", hats: "#d7dde4" }, // northern furs/blue
  marrow:    { tunic: "#7a5a30", collar: "#a07a42", belt: "#4a3620", legs: "#43331f" }, // miner ochre/brown
  redrun:    { tunic: "#2f6a72", collar: "#59a0a6", belt: "#274042", legs: "#2b4a4d" }, // coastal teal
  ashfen:    { tunic: "#7a4038", collar: "#a86050", belt: "#3e2620", legs: "#4a2f28" }, // ashen red-brown
  heartmoor: { tunic: "#4f6a3a", collar: "#7a9a52", belt: "#2f3d24", legs: "#38472a" }, // moss green
  greyoak:   { tunic: "#3f6a4a", collar: "#5f9a6a", belt: "#294031", legs: "#2c4a37" }, // forest green
  city:      { tunic: "#6a4a6e", collar: "#9a6aa0", belt: "#3a2c3e", legs: "#3f3040" }, // Ironvale plum/civic
};
/** Which theme a tile falls under (named region boxes, else the city default). */
function npcTheme(x: number, y: number): NpcTheme {
  const inBox = (x0: number, y0: number, x1: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (inBox(40, 3, 72, 42)) return NPC_THEMES.spine!;
  if (inBox(115, 5, 145, 45)) return NPC_THEMES.marrow!;
  if (inBox(120, 55, 155, 135)) return NPC_THEMES.redrun!;
  if (inBox(60, 130, 100, 162)) return NPC_THEMES.ashfen!;
  if (inBox(0, 120, 40, 160)) return NPC_THEMES.heartmoor!;
  if (inBox(0, 60, 40, 100)) return NPC_THEMES.greyoak!;
  return NPC_THEMES.city!;
}
const NPC_SKINS = ["#caa472", "#b3895a", "#9a6b41", "#e0be93", "#8a5a36"];
const NPC_HAIRS = ["#5b4a33", "#2e2620", "#7a6a4a", "#8a8f98", "#3a2c1e", "#a06a3a"];

function drawNpc(g: CanvasRenderingContext2D, cx: number, cy: number, now: number, moving = false, wx = 0, wy = 0, facing: Facing = "down"): void {
  const a = walkAnim(now, moving);
  const th = npcTheme(wx, wy);
  const h = frac(wx * 12.9898 + wy * 78.233);
  const tunic = th.tunic;
  const skin = NPC_SKINS[Math.floor(h * NPC_SKINS.length) % NPC_SKINS.length]!;
  const hair = NPC_HAIRS[Math.floor(h * 997) % NPC_HAIRS.length]!;
  // 4-way facing: mirror the 3/4 view for "left", show the back of the head for
  // "up" (walking away), plain front otherwise. The shadow stays unmirrored.
  const back = facing === "up";
  const flip = facing === "left";
  shadow(g, cx, cy + 12, 8, 3);
  if (flip) { g.save(); g.translate(2 * cx, 0); g.scale(-1, 1); }
  // legs (feet lift while walking)
  g.fillStyle = th.legs;
  g.fillRect(cx - 5, cy + 6 - a.liftL, 4, 7);
  g.fillRect(cx + 1, cy + 6 - a.liftR, 4, 7);
  // far arm (behind the body)
  limbArm(g, cx + 5.5, cy - 4 + a.bob, 0.12 - a.swing, tunic, skin);
  // tunic + collar + belt (bob)
  g.fillStyle = tunic;
  g.fillRect(cx - 6, cy - 6 + a.bob, 12, 14);
  g.fillStyle = th.collar;
  g.fillRect(cx - 6, cy - 6 + a.bob, 12, 3);
  g.fillStyle = th.belt;
  g.fillRect(cx - 6, cy + 4 + a.bob, 12, 2);
  // near arm (in front)
  limbArm(g, cx - 5.5, cy - 4 + a.bob, -0.12 + a.swing, tunic, skin);
  // head + hair
  g.fillStyle = skin;
  circle(g, cx, cy - 11 + a.bob, 5);
  g.fillStyle = hair;
  if (back) {
    circle(g, cx, cy - 11.5 + a.bob, 5); // from behind, hair covers the whole head
  } else {
    g.beginPath();
    g.arc(cx, cy - 12 + a.bob, 5, Math.PI, 0);
    g.fill();
  }
  // Northern folk wear a pale fur hood against the cold — a clear regional tell.
  if (th.hats && h > 0.35) {
    g.fillStyle = th.hats;
    g.beginPath(); g.arc(cx, cy - 12.5 + a.bob, 5.4, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    g.fillRect(cx - 5.4, cy - 13 + a.bob, 10.8, 1.6);
  }
  if (flip) g.restore();
}

/** Walk-cycle values (in base px): body bounce, limb swing, per-foot lift. */
function walkAnim(now: number, moving: boolean): { bob: number; swing: number; liftL: number; liftR: number } {
  const step = now / 110;
  return {
    bob: moving ? -Math.abs(Math.sin(step)) * 1.4 : Math.sin(now / 520) * 0.7,
    swing: moving ? Math.sin(step) * 0.5 : 0,
    liftL: moving ? Math.max(0, Math.sin(step)) * 1.7 : 0,
    liftR: moving ? Math.max(0, -Math.sin(step)) * 1.7 : 0,
  };
}

/** One arm from a shoulder (px,py), rotated by `angle`: optional tool + sleeve + hand. */
function limbArm(
  g: CanvasRenderingContext2D,
  px: number, py: number, angle: number, sleeve: string, skin: string, tool = "",
): void {
  g.save();
  g.translate(px, py);
  g.rotate(angle);
  if (tool) drawTool(g, 1, tool); // behind the hand, swings with the arm
  g.fillStyle = sleeve;
  g.fillRect(-1.2, 0, 2.4, 4);
  g.fillStyle = skin;
  g.fillRect(-1, 3.6, 2, 3.2);
  g.beginPath();
  g.arc(0, 7, 1.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Route a monster to its sprite (reusing shapes across similar creatures). */
/** A monster's live attack, while the player is fighting it. */
interface MonsterAttack {
  /** Time to its next swing, 1 → 0 across its attack interval. */
  frac: number;
  /** Unit direction from the creature toward the player (for an animal's lunge). */
  dx: number;
  dy: number;
  /** Set for human-type foes: the weapon swing to play (animals lunge instead). */
  action?: AvatarAnim["action"];
}

function drawMonster(
  g: CanvasRenderingContext2D,
  monster: string | undefined,
  available: boolean,
  cx: number,
  cy: number,
  now: number,
  moving = false,
  attack?: MonsterAttack,
): void {
  if (!available) return drawRespawning(g, cx, cy);
  // Animals (no weapon action) lunge toward the player on the strike; humanoids
  // swing a weapon instead, so they don't lunge.
  const lunge = attack && !attack.action ? attack : null;
  if (lunge) {
    // A pounce on the strike: lunge toward the player and swell a little, easing
    // back out. Concentrated in the back half of the swing so it reads as a snap.
    const t = 1 - lunge.frac;
    const hit = t > 0.5 ? (t - 0.5) / 0.5 : 0;
    const push = hit * 7;
    const k = 1 + hit * 0.14;
    g.save();
    g.translate(lunge.dx * push, lunge.dy * push);
    g.translate(cx, cy); g.scale(k, k); g.translate(-cx, -cy);
    drawMonsterScaled(g, monster, cx, cy, now, moving, undefined);
    g.restore();
    return;
  }
  drawMonsterScaled(g, monster, cx, cy, now, moving, attack?.action);
}

/** How much bigger than the base sprite a monster reads — bosses and the largest
 *  brutes tower; the dragon most of all. 1 (default) means no scaling. */
const MONSTER_SCALE: Record<string, number> = {
  ashen_wyrm: 1.85,
  boneman: 1.4, hollow_warden: 1.35, spine_warlord: 1.4, bog_warden: 1.4, marrow_keeper: 1.4,
  green_baron: 1.3, hollow_prophet: 1.35,
  mountain_troll: 1.3, deep_golem: 1.35, forest_bear: 1.22, mountain_lion: 1.1,
  river_serpent: 1.25, mire_serpent: 1.15, marrow_wraith: 1.12,
  // Act II dungeon keepers: mini-bosses read big, the site bosses tower.
  barrow_sentinel: 1.15, barrow_king: 1.35,
  vault_sentinel: 1.15, vault_warden: 1.35,
  court_reliquarist: 1.2, drowned_magistrate: 1.4,
  sky_warder: 1.2, storm_herald: 1.4, aerie_harpy: 1.12,
  pale_wight: 1.1, pale_gatekeeper: 1.25, pale_herald: 1.25, pale_warden: 1.5,
  // The Hunt Warrens: each grade of quarry reads a size up from the last.
  dusk_stalker: 1.15, hollow_hound: 1.25, warren_shade: 1.2, iron_maw: 1.5,
  // The Hollow Below: the level-125 apex towers over everything.
  vorlag: 2.1,
  // The Ironvale Sewers: each grade of vermin reads a size up from the last.
  sewer_rat: 1.1, gutter_spider: 1.15, sewer_kobold: 1.05, sewer_sludge: 1.3,
  // The Ashen Hollow: the Widow towers over her hexlings.
  ashen_widow: 1.3,
};

/** A coloured ground-glow per boss — presence you can feel a screen away. */
const BOSS_AURA: Record<string, string> = {
  ashen_wyrm: "226,96,42",      // ember
  delve_horror: "122,58,240",   // void violet
  hollow_prophet: "138,107,192",
  boneman: "208,200,180",       // bone-pale
  marrow_keeper: "208,200,180",
  greyback: "150,160,175",      // cold grey
  spine_warlord: "180,60,50",
  green_baron: "92,138,58",
  hollow_warden: "140,148,160",
  bog_warden: "82,108,88",
  dread_ferryman: "70,90,120",
  // Act II site bosses
  barrow_king: "200,170,90",       // grave-gold
  vault_warden: "184,163,122",     // mason's lamplight
  drowned_magistrate: "80,130,150", // black-water phosphor
  storm_herald: "120,160,220",     // storm-glow
  pale_gatekeeper: "200,198,190",  // pale stone
  pale_herald: "210,205,195",
  pale_warden: "228,224,214",      // the last seal's cold light
  vorlag: "96,40,120",             // the dark under the mountain
  ashen_widow: "150,130,180",      // ash-violet hex-light
};

/** Draw a monster, scaled up (about its planted foot) by MONSTER_SCALE. */
function drawMonsterScaled(
  g: CanvasRenderingContext2D,
  monster: string | undefined,
  cx: number,
  cy: number,
  now: number,
  moving: boolean,
  action?: AvatarAnim["action"],
): void {
  const aura = monster ? BOSS_AURA[monster] : undefined;
  if (aura) {
    const breathe = 0.55 + 0.45 * Math.sin(now / 640);
    const r = 26 + breathe * 6;
    const grd = g.createRadialGradient(cx, cy + 12, 2, cx, cy + 12, r);
    grd.addColorStop(0, `rgba(${aura},${(0.22 * breathe + 0.10).toFixed(3)})`);
    grd.addColorStop(1, `rgba(${aura},0)`);
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(cx, cy + 12, r, r * 0.45, 0, 0, Math.PI * 2); g.fill();
  }
  const s = (monster && MONSTER_SCALE[monster]) || 1;
  if (s === 1) { drawMonsterBody(g, monster, cx, cy, now, moving, action); return; }
  const foot = cy + 14; // grow up and out from the ground line, not the centre
  g.save();
  g.translate(cx, foot); g.scale(s, s); g.translate(-cx, -foot);
  drawMonsterBody(g, monster, cx, cy, now, moving, action);
  g.restore();
}

function drawMonsterBody(
  g: CanvasRenderingContext2D,
  monster: string | undefined,
  cx: number,
  cy: number,
  now: number,
  moving = false,
  action?: AvatarAnim["action"],
): void {
  // Human-type foes share the animated humanoid figure (arms, walk, attack swing).
  const H = (body: string, trim: string) => drawHumanoid(g, cx, cy, now, body, trim, moving, action);
  switch (monster) {
    case "hill_wolf":
    case "ridge_wolf":
    case "heartmoor_hound":
      return drawWolf(g, cx, cy, now);
    case "wild_boar":
      return drawBoar(g, cx, cy, now, false);
    case "greymane_boar":
      return drawBoar(g, cx, cy, now, true);
    case "forest_bear":
      return drawBear(g, cx, cy, now);
    case "red_deer":
      return drawStag(g, cx, cy, now);
    case "mountain_lion":
      return drawBigCat(g, cx, cy, now);
    case "stone_crawler":
    case "cave_crawler":
    case "warren_creeper": // the Burrows' pale many-legged crawler
      return drawStoneCrawler(g, cx, cy, now);
    case "mountain_troll":
    case "deep_golem":
    case "iron_maw": // the armoured hulk at the Warrens' bottom
      return drawTroll(g, cx, cy, now);
    case "spine_wraith":
    case "marrow_wraith":
    case "warren_shade": // the Crypt's dead hunters
      return drawWraith(g, cx, cy, now);
    case "dusk_stalker": // the Dens' long black cat
      return drawBigCat(g, cx, cy, now);
    case "hollow_hound": // the Kennels' feral hound
      return drawWolf(g, cx, cy, now);
    case "mire_serpent":
    case "river_serpent":
    case "marsh_lurker":
      return drawSerpent(g, cx, cy, now);
    case "deep_bat":
      return drawBat(g, cx, cy, now);
    case "ashen_wyrm":
      return drawDragon(g, cx, cy, now);
    case "boneman":
      return drawBoneman(g, cx, cy, now);
    case "greyback":
      return drawGreyback(g, cx, cy, now);
    case "delve_horror":
      return drawDelveHorror(g, cx, cy, now);
    case "green_baron":
      return H("#2f5233", "#5c8a3a"); // outlaw forest greens
    case "hollow_prophet":
      return H("#342a45", "#8a6bc0"); // hex-woven robe, pale violet light
    case "hollow_warden":
      return H("#6c7077", "#8b9099"); // pale grey revenant
    case "spine_warlord":
      return H("#46434e", "#615c6e"); // dark spine-plate
    case "bog_warden":
      return H("#3f5346", "#526c58"); // bog green-grey
    case "marrow_keeper":
      return H("#cfc7b2", "#e7dfca"); // pale bone-robed keeper
    case "bog_knight":
      return H("#5b6470", "#7a8492"); // grey armour
    case "redrun_brigand":
      return H("#5a4636", "#6e5742"); // leathers
    case "ancient_orc":
      return H("#4d5a3e", "#5f6e4c"); // green-grey orc
    case "dread_ferryman":
      return H("#1f2630", "#2c3540"); // black-hooded
    // --- Road outlaws (humanoids), each with its own drab palette ---
    case "footpad":
      return H("#4a4238", "#5d5446"); // grey rags
    case "cutpurse":
      return H("#43432f", "#56563d"); // dun cloth
    case "bandit":
      return H("#52402e", "#67503a"); // brown leather
    case "poacher":
      return H("#3c4a30", "#4d5e3f"); // forest green
    case "highwayman":
      return H("#33323a", "#454552"); // dark masked
    case "outlaw_archer":
      return H("#454e34", "#586444"); // olive
    case "cutthroat":
      return H("#4a2e2a", "#5e3b35"); // blood-rust
    case "marauder":
      return H("#3a3a40", "#4c4c54"); // heavy iron
    case "outlaw_captain":
      return H("#5a2630", "#763440"); // maroon captain
    // --- The Ninth Bell: bought blades + the crooked quartermaster ---
    case "hired_blade":
      return H("#3a3630", "#4e483e"); // unmarked oiled leathers
    case "quartermaster_brann":
      return H("#4a4436", "#6e6448"); // guard plate gone tarnished-brass
    // --- Settlement guards (watchmen) + farmers ---
    case "town_guard":
      return H("#3f4a58", "#586a7e"); // steel-blue watch tabard
    case "ironvale_guard":
      return H("#41474f", "#616b78"); // mail-grey Ironvale soldier
    case "field_farmer":
      return H("#6b5636", "#8a7148"); // earthy tans
    case "master_farmer":
      return H("#4c5233", "#67703f"); // green farm apron
    // --- Heartmoor cult casters (dark hooded robes, hex-red trim) ---
    case "cult_acolyte":
      return H("#3a2634", "#5a3a4a");
    case "cult_zealot":
      return H("#3a2030", "#6a2a44");
    case "cult_magus":
      return H("#2a1830", "#7a3a58");
    // --- The Ashen Hollow's coven: ash-grey casters, the Widow tinged violet ---
    case "hollow_hexling":
      return H("#575049", "#7c7266"); // ash-daubed rags
    case "ashen_widow":
      return H("#463f4c", "#8a7ea6"); // ash-grey witch, hex-violet trim
    // --- Act II dungeon keepers ---
    case "barrow_sentinel":
      return H("#565a64", "#7d8290"); // pale grave-iron
    case "barrow_king":
      return H("#3c3a4a", "#c9a24a"); // grave-dark regalia, old gold
    case "vault_sentinel":
      return H("#4e5560", "#8b9099"); // vault-steel
    case "vault_warden":
      return H("#55524a", "#b8a37a"); // mason's robes, mortar-pale trim
    case "drowned_thrall":
      return H("#41504a", "#5d7266"); // waterlogged livery
    case "court_reliquarist":
      return H("#3a4440", "#6b8a72"); // verdigrised vestments
    case "drowned_magistrate":
      return H("#2f3a44", "#7fa3b8"); // black-water judge's robes
    case "sky_warder":
      return H("#4a4e5e", "#9aa6c0"); // storm-iron watch plate
    case "storm_herald":
      return H("#33405a", "#b8d0f0"); // high-wind blues
    case "pale_wight":
      return drawWraith(g, cx, cy, now); // the north-folk's patient dead
    case "pale_gatekeeper":
      return H("#8d8a80", "#d8d4c8"); // pale masonry over old bone
    case "pale_herald":
      return H("#9a968a", "#e2ddd0"); // bleached herald's colours
    case "pale_warden":
      return H("#b8b4a8", "#f0ece0"); // the Warden: pale as the script
    case "court_wisp":
      return drawWisp(g, cx, cy, now, "#e8c87a"); // a hostile candle
    case "storm_wisp":
      return drawWisp(g, cx, cy, now, "#9fc4e8"); // knotted weather
    case "aerie_harpy":
      return drawBat(g, cx, cy, now); // a stooping shape out of the dark
    case "vorlag":
      return drawHunger(g, cx, cy, now); // the level-125 apex
    // --- The Ironvale Sewers: the beginner grind-dungeon's four grades ---
    case "sewer_rat":
      return drawRat(g, cx, cy, now); // slick water-rat (default figure, up-scaled)
    case "gutter_spider":
      return drawSpider(g, cx, cy, now);
    case "sewer_kobold":
      return H("#5f6a3e", "#3a4426"); // hunched drain-scavenger in mildew greens
    case "sewer_ooze":
    case "sewer_sludge":
      return drawOoze(g, cx, cy, now);
    default:
      return drawRat(g, cx, cy, now);
  }
}

/** A wisp: a hovering mote of light with a guttering halo — the Sunken Court's
 *  lamps and Skyreach's knotted weather. It bobs slowly and casts its own
 *  faint glow so the big dark halls read by their inhabitants. */
function drawWisp(g: CanvasRenderingContext2D, cx: number, cy: number, now: number, tint: string): void {
  const bob = Math.sin(now / 460) * 2.5;
  const gutter = 0.7 + 0.3 * Math.sin(now / 130);
  const y = cy - 4 + bob;
  const halo = g.createRadialGradient(cx, y, 1, cx, y, 16);
  halo.addColorStop(0, tint + "55");
  halo.addColorStop(1, tint + "00");
  g.fillStyle = halo;
  g.beginPath(); g.arc(cx, y, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = tint;
  g.beginPath(); g.arc(cx, y, 3.2 * gutter + 1.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(cx - 0.8, y - 0.8, 1.3, 0, Math.PI * 2); g.fill();
  // a trailing mote or two
  g.fillStyle = tint + "aa";
  g.beginPath(); g.arc(cx - 5, y + 4 + bob * 0.4, 1.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 4, y + 6 - bob * 0.3, 0.9, 0, Math.PI * 2); g.fill();
}

/** Vorlag, the Hunger Below: a vast pale ring-maw risen through the floor —
 *  segmented hide the colour of sealed centuries, a crown of grasping feelers,
 *  and a mouth that is most of it. Drawn big and scaled bigger (2.1×). */
function drawHunger(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const heave = Math.sin(now / 520) * 2.2;     // slow breathing of the whole mass
  const gape = 0.75 + 0.25 * Math.sin(now / 340); // the maw never quite closes
  const y = cy + heave * 0.4;
  shadow(g, cx, cy + 15, 20, 6);
  // Broken earth around where it rose
  g.fillStyle = "#3a3230";
  g.beginPath(); g.ellipse(cx, cy + 14, 18, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#4c423d";
  for (const [dx, dy, r] of [[-14, 12, 2.5], [13, 13, 3], [-8, 15, 2], [9, 15, 2.2]] as const) {
    g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); g.fill();
  }
  // The risen body: stacked pale segments, widest at the maw
  const seg = (yy: number, rx: number, tone: string): void => {
    g.fillStyle = tone;
    g.beginPath(); g.ellipse(cx, yy, rx, rx * 0.42, 0, 0, Math.PI * 2); g.fill();
  };
  seg(y + 10, 15, "#8f867c");
  seg(y + 5, 16.5, "#9a9186");
  seg(y - 1, 17.5, "#a59b8e");
  seg(y - 7, 18, "#b0a598");
  // Feelers crowning the rim, each swaying on its own clock
  g.strokeStyle = "#8f867c"; g.lineWidth = 2.2; g.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.15 + 0.7 * (i / 6));
    const sway = Math.sin(now / 300 + i * 1.3) * 3;
    const bx = cx + Math.cos(a) * 16, by = y - 8 + Math.sin(a) * 7;
    g.beginPath(); g.moveTo(bx, by);
    g.quadraticCurveTo(bx + sway, by - 8, bx + sway * 1.6, by - 13 - (i % 2) * 3);
    g.stroke();
  }
  // The maw: a dark ring of a mouth, ringed with teeth, darker the deeper
  g.fillStyle = "#241d20";
  g.beginPath(); g.ellipse(cx, y - 7, 13 * gape, 6.5 * gape, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#0f0a10";
  g.beginPath(); g.ellipse(cx, y - 6.5, 9 * gape, 4.2 * gape, 0, 0, Math.PI * 2); g.fill();
  // Ring teeth, in around the rim
  g.fillStyle = "#d8cfc2";
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + now / 4000;
    const tx = cx + Math.cos(a) * 11 * gape, ty = y - 7 + Math.sin(a) * 5.2 * gape;
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + Math.cos(a) * -3.2, ty + Math.sin(a) * -2.2);
    g.lineTo(tx + Math.cos(a + 0.5) * -1.4, ty + Math.sin(a + 0.5) * -1.2);
    g.closePath(); g.fill();
  }
  // A violet gleam breathing out of the throat — the dark inside is awake
  const gl = 0.35 + 0.3 * Math.sin(now / 260);
  const glow = g.createRadialGradient(cx, y - 6.5, 1, cx, y - 6.5, 10);
  glow.addColorStop(0, `rgba(150,80,190,${gl})`);
  glow.addColorStop(1, "rgba(150,80,190,0)");
  g.fillStyle = glow;
  g.beginPath(); g.ellipse(cx, y - 6.5, 9 * gape, 4.2 * gape, 0, 0, Math.PI * 2); g.fill();
  // Old seal-scars on the hide: five pale rings, one broken
  g.strokeStyle = "#cfc6b8"; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const sx = cx - 10 + i * 5, sy = y + 4 + (i % 2) * 3;
    g.beginPath(); g.arc(sx, sy, 2, 0, i === 4 ? Math.PI * 1.3 : Math.PI * 2); g.stroke();
  }
}

/** Cindrath, the Ashen Wyrm: a large winged dragon with glowing ember scales,
 *  flapping wings and a smouldering maw. Drawn oversized to read as a boss. */
function drawDragon(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const flap = Math.sin(now / 240);          // wing beat
  const glow = 0.6 + 0.4 * Math.sin(now / 320); // ember pulse
  shadow(g, cx, cy + 16, 22, 7);

  // --- Wings (behind the body) ---
  const wing = (dir: number): void => {
    g.fillStyle = "#241016";
    g.beginPath();
    g.moveTo(cx, cy - 4);
    g.quadraticCurveTo(cx + dir * (24 + flap * 4), cy - 22 - flap * 6, cx + dir * 30, cy - 2 + flap * 3);
    g.quadraticCurveTo(cx + dir * 20, cy + 2, cx + dir * 8, cy + 2);
    g.closePath();
    g.fill();
    // membrane struts, ember-lit
    g.strokeStyle = `rgba(226,96,42,${0.45 * glow + 0.3})`;
    g.lineWidth = 1.4;
    for (const f of [0.45, 0.7, 0.95]) {
      g.beginPath();
      g.moveTo(cx + dir * 6, cy - 3);
      g.lineTo(cx + dir * (30 * f + 4), cy - 12 * (1 - f) + 1);
      g.stroke();
    }
  };
  wing(-1); wing(1);

  // --- Tail ---
  g.strokeStyle = "#2a1218"; g.lineWidth = 7; g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx, cy + 6);
  g.quadraticCurveTo(cx - 4, cy + 16, cx + 10, cy + 18);
  g.stroke();

  // --- Body (dark scale with ember sheen) ---
  g.fillStyle = "#3a1414";
  g.beginPath(); g.ellipse(cx, cy + 2, 12, 14, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(150,40,28,${0.5 + 0.3 * glow})`;
  g.beginPath(); g.ellipse(cx - 2, cy, 7, 10, 0, 0, Math.PI * 2); g.fill();
  // scale flecks
  g.fillStyle = `rgba(242,150,70,${0.6 * glow})`;
  for (const [dx, dy] of [[-4, -3], [3, -1], [-1, 4], [5, 5], [-5, 6]] as const) {
    circle(g, cx + dx, cy + dy, 1.2);
  }

  // --- Neck + horned head ---
  g.strokeStyle = "#3a1414"; g.lineWidth = 8; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx, cy - 2); g.lineTo(cx + 2, cy - 14); g.stroke();
  g.fillStyle = "#431818";
  g.beginPath(); g.ellipse(cx + 3, cy - 17, 6, 5, 0, 0, Math.PI * 2); g.fill();
  // horns
  g.strokeStyle = "#1f0e12"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx + 1, cy - 20); g.lineTo(cx - 3, cy - 25); g.stroke();
  g.beginPath(); g.moveTo(cx + 6, cy - 20); g.lineTo(cx + 10, cy - 25); g.stroke();
  // molten maw + eye
  g.fillStyle = `rgba(255,140,40,${0.7 + 0.3 * glow})`;
  g.beginPath(); g.ellipse(cx + 7, cy - 15, 2.4, 1.4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffd23a";
  circle(g, cx + 4, cy - 18, 1.1);
}

/** The Boneman: a tall, gaunt killer draped in his victims' bones — a stitched
 *  skull-mask, an exposed ribcage and a long, toothed saw he never sets down.
 *  Drawn a touch oversized and hunched so he reads as a boss, not a bandit. */
function drawBoneman(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const sway = Math.sin(now / 700) * 1.5;        // slow, predatory idle
  const saw = Math.sin(now / 520) * 1.2;         // the saw twitches in his grip
  shadow(g, cx, cy + 15, 13, 4.5);

  // --- Legs: pale, bound bone ---
  g.strokeStyle = "#cdc6b4"; g.lineWidth = 4.5; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx - 4, cy + 3); g.lineTo(cx - 5, cy + 14); g.stroke();
  g.beginPath(); g.moveTo(cx + 4, cy + 3); g.lineTo(cx + 5, cy + 14); g.stroke();

  // --- Torso: a dark sinew-and-rag robe ---
  g.fillStyle = "#36312b";
  g.beginPath();
  g.moveTo(cx - 7 + sway, cy - 7);
  g.quadraticCurveTo(cx - 9 + sway, cy + 4, cx - 6, cy + 5);
  g.lineTo(cx + 6, cy + 5);
  g.quadraticCurveTo(cx + 9 + sway, cy + 4, cx + 7 + sway, cy - 7);
  g.closePath(); g.fill();

  // --- Ribcage strapped over the chest (pale bone) ---
  g.strokeStyle = "#e7e1d0"; g.lineWidth = 1.4; g.lineCap = "round";
  for (const ry of [-4, -1, 2] as const) {
    g.beginPath();
    g.moveTo(cx - 5 + sway, cy + ry);
    g.quadraticCurveTo(cx + sway, cy + ry + 2.4, cx + 5 + sway, cy + ry);
    g.stroke();
  }
  g.lineWidth = 1.6; // spine
  g.beginPath(); g.moveTo(cx + sway, cy - 6); g.lineTo(cx + sway, cy + 4); g.stroke();

  // --- Left arm holding the saw across the body ---
  g.strokeStyle = "#cdc6b4"; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(cx + 6 + sway, cy - 5); g.lineTo(cx + 11, cy + 2 + saw); g.stroke();

  // --- The Bonesaw: a long pale blade with teeth, wrapped handle ---
  g.save();
  g.translate(cx + 11, cy + 2 + saw);
  g.rotate(-0.5);
  g.strokeStyle = "#4a3527"; g.lineWidth = 2.6; // hide-wrapped handle
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 5); g.stroke();
  g.fillStyle = "#ded7c4"; // blade
  g.fillRect(-1.6, -20, 3.2, 20);
  g.fillStyle = "#bdb6a2"; // teeth (a saw edge)
  for (let t = -19; t < 0; t += 2.4) { g.beginPath(); g.moveTo(1.6, t); g.lineTo(3.4, t + 1.1); g.lineTo(1.6, t + 2.2); g.closePath(); g.fill(); }
  g.restore();

  // --- Right arm, hanging ---
  g.strokeStyle = "#cdc6b4"; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(cx - 6 + sway, cy - 5); g.lineTo(cx - 9, cy + 4); g.stroke();

  // --- Head: a stitched skull-mask, hooded ---
  const hx = cx + sway * 1.3, hy = cy - 12;
  g.fillStyle = "#26221d"; // hood/shoulders behind the skull
  g.beginPath(); g.ellipse(hx, hy + 1, 7, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ece6d6"; // pale skull face
  g.beginPath(); g.ellipse(hx, hy, 5, 5.5, 0, 0, Math.PI * 2); g.fill();
  // hollow eye sockets
  g.fillStyle = "#15110d";
  circle(g, hx - 2, hy - 0.5, 1.5);
  circle(g, hx + 2, hy - 0.5, 1.5);
  // a faint red gleam, deep in the sockets
  g.fillStyle = "rgba(190,40,30,0.9)";
  circle(g, hx - 2, hy - 0.5, 0.6);
  circle(g, hx + 2, hy - 0.5, 0.6);
  // stitched mouth-line
  g.strokeStyle = "#15110d"; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(hx - 2.6, hy + 3); g.lineTo(hx + 2.6, hy + 3); g.stroke();
  for (let sx = -2; sx <= 2; sx += 1.3) { g.beginPath(); g.moveTo(hx + sx, hy + 2.2); g.lineTo(hx + sx, hy + 3.8); g.stroke(); }
}

/** A small pale skull (front-facing): dome, two sockets, a nasal hollow. */
function drawSkull(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = "#ece6d6";
  g.beginPath(); g.ellipse(x, y, r, r * 1.06, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#d8d0bd"; // jaw shading
  g.beginPath(); g.ellipse(x, y + r * 0.7, r * 0.62, r * 0.4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#15110d"; // sockets
  circle(g, x - r * 0.42, y - r * 0.1, r * 0.27);
  circle(g, x + r * 0.42, y - r * 0.1, r * 0.27);
  g.beginPath(); // nasal hollow
  g.moveTo(x, y + r * 0.15); g.lineTo(x - r * 0.16, y + r * 0.5); g.lineTo(x + r * 0.16, y + r * 0.5);
  g.closePath(); g.fill();
}

/** A cairn of bones and skulls — grim dressing for the Boneman's Bonefield.
 *  Three variants (a bone-pile with a skull, a stack of skulls, a skull on a
 *  stake), chosen deterministically from the object id so a row of them varies. */
function drawBoneCairn(g: CanvasRenderingContext2D, cx: number, cy: number, id: string): void {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const variant = h % 3;
  shadow(g, cx, cy + 10, 12, 4);
  const bone = "#e2dcca", boneX = "#b9b09a";

  if (variant === 0) {
    // A heap of long bones, crossed, with a skull resting on top.
    g.strokeStyle = bone; g.lineWidth = 2.6; g.lineCap = "round";
    const limbs: [number, number, number, number][] = [
      [-9, 9, 7, 4], [-6, 10, 9, 6], [-8, 6, 6, 9], [3, 10, 10, 5],
    ];
    for (const [x1, y1, x2, y2] of limbs) {
      g.beginPath(); g.moveTo(cx + x1, cy + y1); g.lineTo(cx + x2, cy + y2); g.stroke();
      g.fillStyle = bone; // knobbed ends
      circle(g, cx + x1, cy + y1, 1.5); circle(g, cx + x2, cy + y2, 1.5);
    }
    g.strokeStyle = boneX; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(cx - 8, cy + 8); g.lineTo(cx + 6, cy + 5); g.stroke();
    drawSkull(g, cx - 1, cy + 1, 4.5);
  } else if (variant === 1) {
    // A stacked cairn of skulls.
    drawSkull(g, cx - 4, cy + 7, 3.4);
    drawSkull(g, cx + 4, cy + 7, 3.4);
    drawSkull(g, cx, cy + 8, 3.4);
    drawSkull(g, cx - 0.5, cy + 1, 4.2);
  } else {
    // A skull mounted on a short stake, ringed by a few scattered bones.
    g.strokeStyle = "#6a4a2e"; g.lineWidth = 2.2; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx, cy + 11); g.lineTo(cx, cy - 1); g.stroke();
    g.strokeStyle = bone; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(cx - 9, cy + 10); g.lineTo(cx - 3, cy + 11); g.stroke();
    g.beginPath(); g.moveTo(cx + 3, cy + 11); g.lineTo(cx + 9, cy + 9); g.stroke();
    g.fillStyle = bone;
    circle(g, cx - 9, cy + 10, 1.4); circle(g, cx + 9, cy + 9, 1.4);
    drawSkull(g, cx, cy - 4, 4.6);
  }
}

// --- Serpent: a coiled, scaled body with a raised head ---
function drawSerpent(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const sway = Math.sin(now / 240) * 3;
  shadow(g, cx, cy + 8, 12, 4);
  g.strokeStyle = "#3f5a44";
  g.lineWidth = 6;
  g.lineCap = "round";
  g.beginPath(); // coiled body
  g.moveTo(cx + 11, cy + 7);
  g.quadraticCurveTo(cx - 12, cy + 9, cx - 6, cy + 1);
  g.quadraticCurveTo(cx + 8, cy - 4, cx - 2 + sway, cy - 9);
  g.stroke();
  g.strokeStyle = "#4f6e54";
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx + 11, cy + 7);
  g.quadraticCurveTo(cx - 12, cy + 9, cx - 6, cy + 1);
  g.quadraticCurveTo(cx + 8, cy - 4, cx - 2 + sway, cy - 9);
  g.stroke();
  g.fillStyle = "#4f6e54"; // head
  g.beginPath();
  g.ellipse(cx - 2 + sway, cy - 10, 4, 3.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#d2c24a"; // eye
  circle(g, cx - 3 + sway, cy - 11, 1);
  g.strokeStyle = "#c43a23"; // tongue
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - 5 + sway, cy - 11);
  g.lineTo(cx - 8 + sway, cy - 12);
  g.stroke();
  g.lineCap = "butt";
}

// --- Bat: a small dark flier with beating wings ---
function drawBat(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const flap = Math.sin(now / 90) * 5;
  shadow(g, cx, cy + 9, 6, 2);
  g.fillStyle = "#2b2630";
  g.beginPath(); // left wing
  g.moveTo(cx, cy);
  g.quadraticCurveTo(cx - 11, cy - 6 - flap, cx - 14, cy + 2 - flap);
  g.quadraticCurveTo(cx - 8, cy + 1, cx, cy + 3);
  g.closePath();
  g.fill();
  g.beginPath(); // right wing
  g.moveTo(cx, cy);
  g.quadraticCurveTo(cx + 11, cy - 6 - flap, cx + 14, cy + 2 - flap);
  g.quadraticCurveTo(cx + 8, cy + 1, cx, cy + 3);
  g.closePath();
  g.fill();
  g.fillStyle = "#39333f"; // body
  g.beginPath();
  g.ellipse(cx, cy + 1, 3, 4.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#39333f"; // ears
  circle(g, cx - 2, cy - 4, 1.4);
  circle(g, cx + 2, cy - 4, 1.4);
  g.fillStyle = "#c43a23"; // eyes
  circle(g, cx - 1.4, cy - 1, 0.8);
  circle(g, cx + 1.4, cy - 1, 0.8);
}

// --- Humanoid: a standing figure (knight / brigand / orc / hooded ferryman) ---
function drawHumanoid(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  body: string,
  trim: string,
  moving = false,
  action?: AvatarAnim["action"],
): void {
  const acting = !!action;
  const a = walkAnim(now, moving && !acting);
  // While attacking the figure is planted with a gentle bob; else it walks/idles.
  const bob = acting ? Math.sin(now / 280) * 0.5 : a.bob;
  const skin = "#caa472";
  const nearAngle = acting ? actionArmAngle(action!.frac, action!.kind) : -0.12 + a.swing;
  const farAngle = acting ? 0.22 : 0.12 - a.swing;
  const nearTool = acting ? action!.tool : "";
  shadow(g, cx, cy + 12, 8, 3);
  // legs (feet lift while walking)
  g.fillStyle = "#2b2620";
  g.fillRect(cx - 5, cy + 6 - a.liftL, 4, 8);
  g.fillRect(cx + 1, cy + 6 - a.liftR, 4, 8);
  g.fillStyle = "rgba(0,0,0,0.35)"; // boot shadow grounds the feet
  g.fillRect(cx - 5, cy + 12 - a.liftL, 4, 2);
  g.fillRect(cx + 1, cy + 12 - a.liftR, 4, 2);
  // far arm (behind the torso), sleeved in the body colour
  limbArm(g, cx + 6, cy - 4 + bob, farAngle, body, skin);
  // torso silhouette outline — the dark rim that pops the figure off terrain
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx - 7, cy + 8 + bob);
  g.lineTo(cx - 6, cy - 7 + bob);
  g.quadraticCurveTo(cx, cy - 11 + bob, cx + 6, cy - 7 + bob);
  g.lineTo(cx + 7, cy + 8 + bob);
  g.closePath();
  g.stroke();
  g.fillStyle = body; // torso / cloak
  g.fill();
  // cloth shading: lit left panel, shaded right panel, a belt at the waist
  g.fillStyle = "rgba(255,255,255,0.10)";
  g.fillRect(cx - 6, cy - 6 + bob, 4, 13);
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(cx + 2, cy - 6 + bob, 5, 13);
  g.fillStyle = "rgba(20,14,8,0.7)"; // belt
  g.fillRect(cx - 7, cy + 2 + bob, 14, 2);
  g.fillStyle = trim; // shoulder trim
  g.fillRect(cx - 7, cy - 6 + bob, 14, 3);
  // near arm (in front of the torso), holding any weapon while attacking
  limbArm(g, cx - 6, cy - 4 + bob, nearAngle, body, skin, nearTool);
  g.fillStyle = skin; // head / hood-shadow
  circle(g, cx, cy - 11 + bob, 4.5);
  g.strokeStyle = "rgba(0,0,0,0.4)"; // head rim
  g.lineWidth = 1.2;
  g.beginPath(); g.arc(cx, cy - 11 + bob, 4.5, 0, Math.PI * 2); g.stroke();
  g.fillStyle = body; // hood / helm over the head
  g.beginPath();
  g.arc(cx, cy - 12 + bob, 5, Math.PI, 0);
  g.fill();
  g.fillStyle = "#1a140f";
  g.fillRect(cx - 4, cy - 12 + bob, 8, 2); // brow shadow
  g.fillStyle = "rgba(255,240,220,0.9)"; // eye glints under the brow
  g.fillRect(cx - 2.6, cy - 11.4 + bob, 1.4, 1.2);
  g.fillRect(cx + 1.2, cy - 11.4 + bob, 1.4, 1.2);
}

// --- Moor Rat: small, long-tailed ---
function drawRat(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 200) * 0.6;
  shadow(g, cx, cy + 7, 8, 3);
  g.strokeStyle = "#7a6a55"; // tail
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx + 8, cy + bob);
  g.quadraticCurveTo(cx + 16, cy - 2 + bob, cx + 14, cy - 8 + bob);
  g.stroke();
  g.fillStyle = "#6b5d4a"; // body
  g.beginPath();
  g.ellipse(cx, cy + bob, 9, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#766857"; // head
  circle(g, cx - 8, cy - 1 + bob, 4.5);
  g.fillStyle = "#8a7a64"; // ear
  circle(g, cx - 9, cy - 5 + bob, 2.2);
  g.fillStyle = "#c89a9a"; // nose
  circle(g, cx - 12, cy + 1 + bob, 1.3);
  g.fillStyle = "#1a140f"; // eye
  circle(g, cx - 8, cy - 2 + bob, 1);
}

// --- Gutter Spider: a pale, long-legged sewer spider. Its eight legs flex as
//     it shifts, and a cluster of small eyes catches the light. ---
function drawSpider(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const flex = Math.sin(now / 220) * 1.4; // legs pump slowly
  shadow(g, cx, cy + 7, 10, 3.5);
  g.strokeStyle = "#3a3230"; // eight legs, four to a side
  g.lineWidth = 1.6;
  g.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const sp = (i - 1.5) * 3;               // fan the legs along the body
    const lift = (i % 2 === 0 ? flex : -flex);
    // left side
    g.beginPath();
    g.moveTo(cx - 3, cy + sp * 0.4);
    g.quadraticCurveTo(cx - 11, cy + sp - 3 + lift, cx - 15, cy + sp + 3 - lift);
    g.stroke();
    // right side
    g.beginPath();
    g.moveTo(cx + 3, cy + sp * 0.4);
    g.quadraticCurveTo(cx + 11, cy + sp - 3 - lift, cx + 15, cy + sp + 3 + lift);
    g.stroke();
  }
  g.lineCap = "butt";
  g.fillStyle = "#5a4f48"; // abdomen (rear)
  g.beginPath();
  g.ellipse(cx + 2, cy + 1, 7, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#6e625a"; // pale mottling
  g.beginPath();
  g.ellipse(cx + 3, cy - 1, 4, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#4a4038"; // cephalothorax (front)
  circle(g, cx - 5, cy, 4.5);
  g.fillStyle = "#d8d0c4"; // clustered eyes
  circle(g, cx - 8, cy - 1.5, 1);
  circle(g, cx - 8, cy + 1.5, 1);
  circle(g, cx - 6.5, cy - 2.5, 0.8);
  circle(g, cx - 6.5, cy + 2.5, 0.8);
}

// --- Sewer Sludge: a churning mound of runoff. It swells and slumps, glossy
//     green, with a few bubbles rising and popping across its surface. ---
function drawOoze(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(now / 380); // swell / slump
  const rx = 11 + pulse * 1.6;
  const ry = 8 + (1 - pulse) * 1.6;
  shadow(g, cx, cy + 8, rx, 4);
  g.fillStyle = "#3d5a34"; // base body
  g.beginPath();
  g.ellipse(cx, cy + 1, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#54763f"; // dome
  g.beginPath();
  g.ellipse(cx, cy - 2, rx * 0.7, ry * 0.7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#7fa758"; // glossy highlight
  g.beginPath();
  g.ellipse(cx - 3, cy - 4, 3.5, 2.2, 0, 0, Math.PI * 2);
  g.fill();
  // drips off the leading edge
  g.fillStyle = "#3d5a34";
  const drip = 2 + pulse * 2.5;
  g.beginPath();
  g.ellipse(cx - rx * 0.6, cy + ry - 1, 2, drip, 0, 0, Math.PI * 2);
  g.fill();
  // a couple of rising bubbles
  const b1 = ((now / 900) % 1);
  g.fillStyle = "rgba(200,224,170,0.55)";
  circle(g, cx + 2, cy + 2 - b1 * 8, 1.4);
  const b2 = ((now / 1100 + 0.5) % 1);
  circle(g, cx - 4, cy + 2 - b2 * 7, 1.1);
  // two dim eyes so it reads as a creature, not scenery
  g.fillStyle = "#1a2414";
  circle(g, cx - 3, cy - 2, 1.3);
  circle(g, cx + 3, cy - 2, 1.3);
}

// --- Hill Wolf: larger, lean and grey ---
function drawWolf(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 240) * 0.7;
  shadow(g, cx, cy + 9, 12, 4);
  g.strokeStyle = "#5f6168"; // tail
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx + 11, cy + 1 + bob);
  g.quadraticCurveTo(cx + 18, cy - 3 + bob, cx + 15, cy - 8 + bob);
  g.stroke();
  g.fillStyle = "#4c4e54"; // legs
  g.fillRect(cx - 6, cy + 4 + bob, 2.5, 6);
  g.fillRect(cx + 4, cy + 4 + bob, 2.5, 6);
  g.fillStyle = "#6f7178"; // body
  g.beginPath();
  g.ellipse(cx, cy + bob, 12, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#80828a"; // back highlight
  g.beginPath();
  g.ellipse(cx, cy - 2 + bob, 10, 3.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#6a6c73"; // head
  circle(g, cx - 11, cy - 2 + bob, 5.5);
  g.fillStyle = "#5c5e64"; // snout
  g.beginPath();
  g.ellipse(cx - 16, cy + bob, 3.5, 2.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5c5e64"; // ears
  g.beginPath();
  g.moveTo(cx - 13, cy - 7 + bob);
  g.lineTo(cx - 11, cy - 12 + bob);
  g.lineTo(cx - 9, cy - 7 + bob);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(cx - 9, cy - 7 + bob);
  g.lineTo(cx - 7, cy - 11 + bob);
  g.lineTo(cx - 6, cy - 6 + bob);
  g.closePath();
  g.fill();
  g.fillStyle = "#d8b24a"; // eye
  circle(g, cx - 12, cy - 2 + bob, 1.1);
}

// --- Wild Boar: stocky, bristled, tusked. Greymane variant is larger + grey. ---
function drawBoar(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  greymane: boolean,
): void {
  const bob = Math.sin(now / 220) * 0.6;
  const s = greymane ? 1.18 : 1; // the Greymane is the bigger, rarer beast
  const body = greymane ? "#6d6a63" : "#4a3f33";
  const back = greymane ? "#838079" : "#5b4f40";
  shadow(g, cx, cy + 9 * s, 13 * s, 4);
  g.fillStyle = "#3a3128"; // legs
  g.fillRect(cx - 7 * s, cy + 4 + bob, 2.5, 7 * s);
  g.fillRect(cx + 4 * s, cy + 4 + bob, 2.5, 7 * s);
  g.fillStyle = body; // barrel body
  g.beginPath();
  g.ellipse(cx, cy + bob, 12 * s, 7.5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = back; // raised bristled back
  g.beginPath();
  g.ellipse(cx - 1, cy - 3 + bob, 9 * s, 3 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#2a231b"; // bristle ridge
  g.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.moveTo(cx + i * 3, cy - 5 * s + bob);
    g.lineTo(cx + i * 3, cy - 8 * s + bob);
    g.stroke();
  }
  g.fillStyle = body; // head
  g.beginPath();
  g.ellipse(cx - 13 * s, cy + 1 + bob, 6 * s, 5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2c251d"; // snout
  g.beginPath();
  g.ellipse(cx - 18 * s, cy + 2 + bob, 3 * s, 2.4 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#e8e2d0"; // tusks
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - 17 * s, cy + 3 + bob);
  g.lineTo(cx - 19 * s, cy - 1 + bob);
  g.stroke();
  g.fillStyle = "#1a140f"; // eye
  circle(g, cx - 13 * s, cy - 1 + bob, 1);
}

// --- Red Deer: a slender russet stag with branching antlers ---
function drawStag(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 240) * 0.6;
  shadow(g, cx, cy + 9, 12, 4);
  g.strokeStyle = "#6a4a2e"; g.lineWidth = 2.2; g.lineCap = "round"; // legs
  g.beginPath(); g.moveTo(cx - 6, cy + 3 + bob); g.lineTo(cx - 6, cy + 9); g.stroke();
  g.beginPath(); g.moveTo(cx + 5, cy + 3 + bob); g.lineTo(cx + 5, cy + 9); g.stroke();
  g.fillStyle = "#9a6b3e"; // body
  g.beginPath(); g.ellipse(cx, cy + bob, 11, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a5230"; // neck
  g.fillRect(cx + 6, cy - 6 + bob, 3.5, 8);
  g.fillStyle = "#8a5e36"; // head
  g.beginPath(); g.ellipse(cx + 9, cy - 8 + bob, 3.5, 3, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#caa570"; g.lineWidth = 1.2; // antlers
  g.beginPath(); g.moveTo(cx + 8, cy - 10 + bob); g.lineTo(cx + 6, cy - 15 + bob); g.lineTo(cx + 4, cy - 14 + bob); g.stroke();
  g.beginPath(); g.moveTo(cx + 10, cy - 10 + bob); g.lineTo(cx + 12, cy - 15 + bob); g.lineTo(cx + 14, cy - 14 + bob); g.stroke();
  g.fillStyle = "#efe9dd"; g.beginPath(); g.arc(cx - 9, cy - 1 + bob, 1.6, 0, Math.PI * 2); g.fill(); // tail flash
  g.fillStyle = "#1a140f"; circle(g, cx + 10, cy - 8 + bob, 0.9); // eye
}

// --- Mountain Lion: a low, tawny cat, long-tailed and rangy ---
function drawBigCat(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 260) * 0.5;
  shadow(g, cx, cy + 9, 14, 4);
  g.strokeStyle = "#a8814a"; g.lineWidth = 2.6; g.lineCap = "round"; // tail, curling
  g.beginPath(); g.moveTo(cx + 11, cy + 1 + bob); g.quadraticCurveTo(cx + 18, cy - 2 + bob, cx + 16, cy - 7 + bob); g.stroke();
  g.fillStyle = "#7a5a32"; // legs
  g.fillRect(cx - 7, cy + 4 + bob, 2.6, 6); g.fillRect(cx + 4, cy + 4 + bob, 2.6, 6);
  g.fillStyle = "#c08f4e"; // long body
  g.beginPath(); g.ellipse(cx, cy + bob, 13, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#b07f3e"; // haunch
  g.beginPath(); g.ellipse(cx + 7, cy + bob, 6, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#cd9a56"; // head
  g.beginPath(); g.ellipse(cx - 12, cy - 1 + bob, 5, 4.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#b07f3e"; // ears
  g.beginPath(); g.moveTo(cx - 15, cy - 5 + bob); g.lineTo(cx - 13, cy - 7 + bob); g.lineTo(cx - 12, cy - 4 + bob); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx - 10, cy - 5 + bob); g.lineTo(cx - 9, cy - 7 + bob); g.lineTo(cx - 8, cy - 4 + bob); g.closePath(); g.fill();
  g.fillStyle = "#e8d8b0"; g.beginPath(); g.ellipse(cx - 15, cy + 1 + bob, 2, 1.6, 0, 0, Math.PI * 2); g.fill(); // muzzle
  g.fillStyle = "#1a140f"; circle(g, cx - 13, cy - 1 + bob, 1); // eye
}

// --- Forest Bear: large, heavy, dark-furred ---
function drawBear(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 260) * 0.6;
  shadow(g, cx, cy + 11, 15, 5);
  g.fillStyle = "#33271d"; // legs
  g.fillRect(cx - 9, cy + 5 + bob, 4, 8);
  g.fillRect(cx + 5, cy + 5 + bob, 4, 8);
  g.fillStyle = "#4a3a2b"; // bulky body
  g.beginPath();
  g.ellipse(cx, cy + bob, 14, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5a4734"; // shoulder hump
  g.beginPath();
  g.ellipse(cx + 3, cy - 4 + bob, 8, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#4a3a2b"; // head
  circle(g, cx - 12, cy - 3 + bob, 6.5);
  g.fillStyle = "#5a4734"; // muzzle
  g.beginPath();
  g.ellipse(cx - 17, cy - 1 + bob, 4, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#33271d"; // ears
  circle(g, cx - 15, cy - 8 + bob, 2.4);
  circle(g, cx - 9, cy - 8 + bob, 2.4);
  g.fillStyle = "#15100b"; // nose + eye
  circle(g, cx - 20, cy - 1 + bob, 1.4);
  circle(g, cx - 12, cy - 4 + bob, 1.1);
}

// --- The Greyback: the wandering world boss — a huge stone-grey bear with a
// pale silver mane, old scars, and eyes that have outlived hunters. Drawn at
// ~1.8× bear bulk so the sighting reads as an EVENT. ---
function drawGreyback(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 300) * 0.8;
  const s = 1.8;
  shadow(g, cx, cy + 15, 24, 8);
  g.save();
  g.translate(cx, cy + bob);
  g.scale(s, s);
  g.fillStyle = "#2e2f33"; // legs
  g.fillRect(-9, 5, 4.5, 9);
  g.fillRect(5, 5, 4.5, 9);
  g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 1.4; // silhouette rim
  g.beginPath(); g.ellipse(0, 0, 14.8, 9.8, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#4b4e55"; // stone-grey bulk
  g.beginPath(); g.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#6a6e78"; // the pale grey back — its name
  g.beginPath(); g.ellipse(2, -4.5, 9.5, 5, -0.1, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#82868f"; // mane crest
  g.beginPath(); g.ellipse(4, -6.5, 6, 2.6, -0.15, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#2a2225"; g.lineWidth = 1.1; // old scars
  g.beginPath(); g.moveTo(-3, -4); g.lineTo(1, 1); g.stroke();
  g.beginPath(); g.moveTo(6, -2); g.lineTo(9, 3); g.stroke();
  g.fillStyle = "#4b4e55"; // head
  circle(g, -12, -3, 7);
  g.fillStyle = "#5d616a"; // muzzle
  g.beginPath(); g.ellipse(-17.5, -1, 4.4, 3.2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2e2f33"; // ears
  circle(g, -15.5, -8.5, 2.6);
  circle(g, -8.5, -8.5, 2.6);
  g.fillStyle = "#15100b"; // nose
  circle(g, -20.5, -1, 1.6);
  g.fillStyle = "#e8d9b0"; // pale old eye — it has seen you before
  circle(g, -12, -4.4, 1.5);
  g.fillStyle = "#15100b";
  circle(g, -11.7, -4.4, 0.8);
  g.restore();
}

// --- The Delve Horror: the gauntlet's final wave — a hovering shroud of dark
// around one huge unblinking eye, trailing tatters, ringed by orbiting motes. ---
function drawDelveHorror(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const hover = Math.sin(now / 420) * 2.2;
  const y = cy - 6 + hover;
  shadow(g, cx, cy + 13, 14, 4);
  // trailing tatters
  g.fillStyle = "rgba(18,14,26,0.85)";
  for (let i = -2; i <= 2; i++) {
    const sway = Math.sin(now / 300 + i * 1.7) * 2;
    g.beginPath();
    g.moveTo(cx + i * 5 - 3, y + 8);
    g.quadraticCurveTo(cx + i * 5 + sway, y + 17, cx + i * 5 + sway * 1.5, y + 21);
    g.lineTo(cx + i * 5 + 3, y + 8);
    g.closePath(); g.fill();
  }
  // the shroud body
  g.strokeStyle = "rgba(120,90,200,0.35)"; g.lineWidth = 2.5;
  g.beginPath(); g.ellipse(cx, y, 13.5, 12, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#161020";
  g.beginPath(); g.ellipse(cx, y, 13, 11.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#221a34";
  g.beginPath(); g.ellipse(cx - 3, y - 3, 8, 7, 0, 0, Math.PI * 2); g.fill();
  // THE EYE — the whole boss, staring
  const blink = Math.sin(now / 1400) > 0.96 ? 0.2 : 1;
  g.fillStyle = "#e8e2d2";
  g.beginPath(); g.ellipse(cx, y - 1, 7, 5.6 * blink, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a3af0";
  circle(g, cx, y - 1, 3.4 * blink);
  g.fillStyle = "#12081e";
  circle(g, cx, y - 1, 1.7 * blink);
  g.fillStyle = "rgba(255,255,255,0.85)";
  circle(g, cx - 1.3, y - 2.4, 0.9);
  // orbiting motes
  for (let i = 0; i < 3; i++) {
    const a = now / 800 + (i * Math.PI * 2) / 3;
    g.fillStyle = `rgba(150,110,240,${0.5 + 0.3 * Math.sin(a * 2)})`;
    circle(g, cx + Math.cos(a) * 17, y + Math.sin(a) * 9, 1.6);
  }
}

// --- Stone Crawler: a low, armoured stone-shelled creature ---
function drawStoneCrawler(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const sk = Math.sin(now / 160);
  shadow(g, cx, cy + 7, 12, 4);
  g.strokeStyle = "#4c4a46"; // legs
  g.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(cx + i * 5, cy + 3);
    g.lineTo(cx + i * 5 + sk * 2, cy + 9);
    g.stroke();
  }
  g.fillStyle = "#5b5852"; // stone shell
  g.beginPath();
  g.ellipse(cx, cy, 12, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#6e6a62"; // plated ridges
  g.beginPath();
  g.ellipse(cx, cy - 1, 9, 4.5, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#3a3833";
  g.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(cx + i * 5, cy - 5);
    g.lineTo(cx + i * 5, cy + 5);
    g.stroke();
  }
  g.fillStyle = "#d2742c"; // ember eyes
  circle(g, cx - 9, cy - 1, 1.2);
  circle(g, cx - 11, cy + 1, 1);
}

// --- Mountain Troll: a big, hunched grey brute ---
function drawTroll(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const bob = Math.sin(now / 300) * 1;
  shadow(g, cx, cy + 13, 14, 5);
  g.fillStyle = "#5a5d52"; // legs
  g.fillRect(cx - 7, cy + 6 + bob, 5, 9);
  g.fillRect(cx + 2, cy + 6 + bob, 5, 9);
  g.fillStyle = "#6b6e61"; // hunched body
  g.beginPath();
  g.moveTo(cx - 11, cy + 8 + bob);
  g.quadraticCurveTo(cx - 13, cy - 8 + bob, cx, cy - 9 + bob);
  g.quadraticCurveTo(cx + 13, cy - 8 + bob, cx + 11, cy + 8 + bob);
  g.closePath();
  g.fill();
  g.fillStyle = "#7a7d6e"; // shoulder
  g.beginPath();
  g.ellipse(cx, cy - 6 + bob, 11, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#787b6b"; // long arms
  g.fillRect(cx - 13, cy - 3 + bob, 4, 12);
  g.fillRect(cx + 9, cy - 3 + bob, 4, 12);
  g.fillStyle = "#6b6e61"; // head
  circle(g, cx, cy - 11 + bob, 5.5);
  g.fillStyle = "#3a3d34"; // brow
  g.fillRect(cx - 5, cy - 13 + bob, 10, 2);
  g.fillStyle = "#c9b14a"; // eyes
  circle(g, cx - 2.5, cy - 10 + bob, 1.1);
  circle(g, cx + 2.5, cy - 10 + bob, 1.1);
  g.fillStyle = "#e8e2d0"; // tusks
  g.fillRect(cx - 3, cy - 6 + bob, 1.5, 3);
  g.fillRect(cx + 1.5, cy - 6 + bob, 1.5, 3);
}

// --- Spine Wraith: a translucent, drifting figure of cold wind ---
function drawWraith(g: CanvasRenderingContext2D, cx: number, cy: number, now: number): void {
  const drift = Math.sin(now / 280) * 2;
  const pulse = 0.45 + 0.2 * Math.sin(now / 220);
  g.globalAlpha = pulse;
  g.fillStyle = "#9fc0d8"; // cold body
  g.beginPath();
  g.moveTo(cx, cy - 13);
  g.quadraticCurveTo(cx - 9, cy - 4, cx - 8 + drift, cy + 10);
  g.quadraticCurveTo(cx, cy + 6, cx + 8 + drift, cy + 10);
  g.quadraticCurveTo(cx + 9, cy - 4, cx, cy - 13);
  g.closePath();
  g.fill();
  g.globalAlpha = pulse * 0.6;
  g.fillStyle = "#d6e6f2"; // inner light
  g.beginPath();
  g.ellipse(cx, cy - 6, 4, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = "#16323f"; // hollow eyes
  circle(g, cx - 2.5, cy - 8, 1.3);
  circle(g, cx + 2.5, cy - 8, 1.3);
}

// --- A standing landmark stone (the Wind-Shrine, the sealed Vault) ---
function drawShrine(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  shadow(g, cx, cy + 13, 11, 4);
  g.fillStyle = "#6a6b73"; // weathered monolith
  g.beginPath();
  g.moveTo(cx - 7, cy + 13);
  g.lineTo(cx - 8, cy - 10);
  g.lineTo(cx - 3, cy - 15);
  g.lineTo(cx + 4, cy - 14);
  g.lineTo(cx + 8, cy - 6);
  g.lineTo(cx + 7, cy + 13);
  g.closePath();
  g.fill();
  g.fillStyle = "#7e7f88"; // lit face
  g.beginPath();
  g.moveTo(cx - 3, cy - 15);
  g.lineTo(cx + 4, cy - 14);
  g.lineTo(cx + 3, cy + 13);
  g.lineTo(cx - 1, cy + 13);
  g.closePath();
  g.fill();
  g.strokeStyle = "#3f4047"; // worn grooves (the "vertebra")
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(cx - 6, cy - 4);
  g.lineTo(cx + 6, cy - 5);
  g.moveTo(cx - 6, cy + 3);
  g.lineTo(cx + 5, cy + 2);
  g.stroke();
}

/**
 * A discoverable relic: a little cairn with a pale page pinned to it, and a soft
 * gold shimmer above to catch a wandering eye (the "something's here" tell).
 */
function drawRelic(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
): void {
  shadow(g, cx, cy + 12, 9, 3.5);
  // A small stacked-stone cairn.
  g.fillStyle = "#6f6a5e";
  g.beginPath();
  g.ellipse(cx, cy + 8, 8, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#807a6b";
  g.beginPath();
  g.ellipse(cx - 1, cy + 3, 6, 3.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#8d8676";
  g.beginPath();
  g.ellipse(cx, cy - 1, 4, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  // A pale page pinned to the cairn, lightly curled.
  g.fillStyle = "#e8dcb8";
  g.beginPath();
  g.moveTo(cx - 4, cy - 11);
  g.lineTo(cx + 4, cy - 12);
  g.lineTo(cx + 5, cy - 2);
  g.lineTo(cx - 4, cy - 1);
  g.closePath();
  g.fill();
  g.strokeStyle = "#b3a878";
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(cx - 2, cy - 9); g.lineTo(cx + 3, cy - 9.5);
  g.moveTo(cx - 2, cy - 6.5); g.lineTo(cx + 3, cy - 7);
  g.moveTo(cx - 2, cy - 4); g.lineTo(cx + 1, cy - 4.2);
  g.stroke();
  // A breathing gold shimmer above, so it reads as "worth a look".
  const tw = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(now / 380));
  g.fillStyle = `rgba(242, 207, 107, ${tw.toFixed(3)})`;
  g.beginPath();
  g.arc(cx + 5, cy - 14, 1.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = `rgba(242, 207, 107, ${(tw * 0.6).toFixed(3)})`;
  g.beginPath();
  g.arc(cx + 5, cy - 14, 3.2, 0, Math.PI * 2);
  g.fill();
}

// --- A faint mark where a monster will respawn ---
function drawRespawning(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  g.fillStyle = "rgba(120,110,100,0.22)";
  g.beginPath();
  g.ellipse(cx, cy, 9, 5, 0, 0, Math.PI * 2);
  g.fill();
}

function drawPlayer(
  g: CanvasRenderingContext2D,
  pos: Vec2,
  cam: Camera,
  now: number,
  look?: Appearance,
  moving = false,
  action?: AvatarAnim["action"],
  gear: GearLook = {},
  facing: Facing = "right",
  mount?: MountDress,
): void {
  const cx = pos.x * TILE + TILE / 2 - cam.x;
  const cy = pos.y * TILE + TILE / 2 - cam.y;
  // The mount rig and saddle seat only know left/right; a rider facing up/down
  // sits astride the same 3/4 horse (facing right) so the pair still reads.
  const flip = facing === "left";
  if (mount) {
    // Mounted: the steed is drawn first, then the rider sits into the saddle
    // (legs tucked — the avatar knows it's riding). One shared shadow.
    // NOTE the rig's forward is -x while the avatar's is +x, so the rig takes
    // the INVERTED flip — otherwise the horse gallops facing backwards.
    // Life-size: a horse is a big animal — the rig draws at 1.7x, hooves
    // planted on the tile, and the rider sits up on the taller back.
    const K = 1.7;
    shadow(g, cx, cy + TILE / 2 - 2, 14 * K, 5.5);
    drawMountRig(g, cx, cy, now, moving, !flip, mount, K);
    // Seat the rider ON the saddle. The saddle sits at rig-local (−1, −10),
    // scaled ×K about the ground line (local y=11): screen y = cy + 11 +
    // (−10 − 11)·K ≈ cy − 24.7. The avatar's hip line is at its cy + 5, so
    // anchoring the avatar at cy − 29.5 puts the hips right on the leather.
    // The rig is drawn with INVERTED flip, so its local −1 lands on +K when
    // the player faces right — the rider matches that side.
    const seatX = cx + (flip ? -1.7 : 1.7);
    drawAvatar(g, seatX, cy - 29.5, 1, withDefaults(look), { now, moving, flip, riding: true, ...(action ? { action } : {}) }, gear);
    return;
  }
  shadow(g, cx, cy + TILE / 2 - 4, 9, 3.5); // grounds the player on the terrain
  drawAvatar(g, cx, cy, 1, withDefaults(look), { now, moving, facing, ...(action ? { action } : {}) }, gear);
}

// --- The mount rig: one parameterised quadruped for every steed the stables
// sell. Natural coats only (bays, chestnuts, duns, greys, blacks — no purple
// horses in Varath). Gallop cycle while moving; tail-swish and head-dip at
// rest. A leather saddle always; gilded when the rider owns the Gilded
// Saddle, plus steel barding (chest plate + chamfron) with the Steel Barding.
interface MountLook { coat: string; mane: string; ears: "point" | "long" | "round" | "horn"; tusks?: boolean; bulky?: boolean }
/** Everything a rider's cosmetics can hang on the rig. */
export interface MountDress { id: string; gold: boolean; barding: boolean; silver?: boolean; blanket?: boolean; plume?: boolean }
const MOUNT_LOOKS: Record<string, MountLook> = {
  mount_pony:         { coat: "#8a7a66", mane: "#5c5044", ears: "point" },
  mount_horse:        { coat: "#6b4a2e", mane: "#3a2818", ears: "point" },            // bay
  mount_destrier:     { coat: "#2e2a28", mane: "#171412", ears: "point" },            // black
  mount_courser:      { coat: "#8a5a30", mane: "#573418", ears: "point" },
  mount_dustrunner:   { coat: "#a3703c", mane: "#6b4522", ears: "point" },            // red dun
  mount_courier:      { coat: "#7a6a52", mane: "#4c4034", ears: "point" },
  mount_runemarked:   { coat: "#3a3634", mane: "#211e1c", ears: "point" },
  mount_ferryman:     { coat: "#3c4048", mane: "#23262c", ears: "point" },
  mount_mule:         { coat: "#7a6a58", mane: "#4c4234", ears: "long" },
  mount_ox:           { coat: "#5a4a3a", mane: "#3a2f24", ears: "round", bulky: true },
  mount_aurochs:      { coat: "#4a3a2e", mane: "#2c2118", ears: "horn", bulky: true },
  mount_packbear:     { coat: "#5c4630", mane: "#3a2c1c", ears: "round", bulky: true },
  mount_bristleback:  { coat: "#6a5240", mane: "#42322a", ears: "round", tusks: true, bulky: true },
  mount_ironboar:     { coat: "#57504a", mane: "#332e2a", ears: "round", tusks: true, bulky: true },
  mount_greymane:     { coat: "#8b8b86", mane: "#5b5b57", ears: "round", tusks: true, bulky: true },
  mount_hound:        { coat: "#4a4b52", mane: "#2c2d33", ears: "point" },
  mount_nighthound:   { coat: "#33343a", mane: "#1c1d22", ears: "point" },
  mount_stormhound:   { coat: "#5a616c", mane: "#3a3f48", ears: "point" },
  mount_ridgewolf:    { coat: "#6f7178", mane: "#4a4c52", ears: "point" },
  mount_silverwolf:   { coat: "#b4b8c0", mane: "#83878f", ears: "point" },
  mount_wraithsteed:  { coat: "#4e5258", mane: "#2e3136", ears: "point" },
  mount_deepwing:     { coat: "#4c4650", mane: "#2e2a32", ears: "point" },
  mount_deepstrider:  { coat: "#5c5852", mane: "#3a3733", ears: "round", bulky: true },
  mount_palecrawler:  { coat: "#8a8578", mane: "#5e5a4e", ears: "round", bulky: true },
};

function drawMountRig(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  moving: boolean,
  flip: boolean,
  mount: MountDress,
  scale = 1,
): void {
  const look = MOUNT_LOOKS[mount.id] ?? MOUNT_LOOKS["mount_horse"]!;
  const coat = look.coat, mane = look.mane;
  const dark = "#1e1812";
  g.save();
  g.translate(cx, cy);
  if (flip) g.scale(-1, 1);
  // Life-size steeds: grow about the ground line so the hooves stay planted.
  if (scale !== 1) { g.translate(0, 11); g.scale(scale, scale); g.translate(0, -11); }
  const bob = moving ? Math.abs(Math.sin(now / 130)) * 1.6 : Math.sin(now / 460) * 0.6;
  const bodyW = look.bulky ? 15 : 13.5;
  const bodyH = look.bulky ? 8.5 : 7;

  // legs: two pairs, phase-shifted gallop while moving
  const legPh = now / 110;
  const legs: Array<[number, number]> = [[-9, 0], [-4.5, Math.PI * 0.5], [4.5, Math.PI], [9, Math.PI * 1.5]];
  for (const [lx, ph] of legs) {
    const swing = moving ? Math.sin(legPh + ph) * 3.4 : 0;
    const lift = moving ? Math.max(0, Math.cos(legPh + ph)) * 2 : 0;
    g.fillStyle = coat;
    g.fillRect(lx - 1.4 + swing * 0.55, -1 - bob, 2.8, 12 - lift);
    g.fillStyle = dark; // hoof
    g.fillRect(lx - 1.4 + swing * 0.55, 10.4 - bob - lift, 2.8, 1.8);
  }
  // body
  g.fillStyle = coat;
  g.beginPath(); g.ellipse(0, -4 - bob, bodyW, bodyH, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.08)"; // top light
  g.beginPath(); g.ellipse(-1, -7 - bob, bodyW * 0.7, bodyH * 0.45, 0, 0, Math.PI * 2); g.fill();
  // tail
  g.strokeStyle = mane; g.lineWidth = 2.6; g.lineCap = "round";
  const ts = Math.sin(now / (moving ? 160 : 520)) * 3;
  g.beginPath(); g.moveTo(bodyW - 1, -6 - bob); g.quadraticCurveTo(bodyW + 5, -2 - bob + ts, bodyW + 3.4, 5 - bob + ts); g.stroke();
  g.lineCap = "butt";
  // neck + head (forward = -x)
  const dip = moving ? Math.sin(now / 130 + 1) * 1.2 : Math.sin(now / 700) * 1.6;
  g.fillStyle = coat;
  g.beginPath();
  g.moveTo(-bodyW + 4, -7 - bob);
  g.lineTo(-bodyW - 2, -14 - bob + dip);
  g.lineTo(-bodyW + 1.5, -15 - bob + dip);
  g.lineTo(-bodyW + 7.5, -5 - bob);
  g.closePath(); g.fill();
  g.beginPath(); g.ellipse(-bodyW - 3.4, -15.5 - bob + dip, 4.6, 3.2, -0.25, 0, Math.PI * 2); g.fill();
  g.fillStyle = shadeHex(coat, -18); // muzzle
  g.beginPath(); g.ellipse(-bodyW - 7, -14.6 - bob + dip, 2.4, 1.9, -0.2, 0, Math.PI * 2); g.fill();
  // ears / horns
  g.fillStyle = mane;
  if (look.ears === "long") {
    g.beginPath(); g.ellipse(-bodyW - 2.4, -20 - bob + dip, 1.3, 3.4, -0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(-bodyW + 0.6, -19.4 - bob + dip, 1.3, 3.2, 0.15, 0, Math.PI * 2); g.fill();
  } else if (look.ears === "horn") {
    g.strokeStyle = "#d8d2c2"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-bodyW - 4, -18 - bob + dip); g.quadraticCurveTo(-bodyW - 8, -20 - bob + dip, -bodyW - 7, -23 - bob + dip); g.stroke();
    g.beginPath(); g.moveTo(-bodyW - 1, -18.4 - bob + dip); g.quadraticCurveTo(-bodyW + 3, -20.4 - bob + dip, -bodyW + 2, -23 - bob + dip); g.stroke();
  } else if (look.ears === "round") {
    circle(g, -bodyW - 5, -18.6 - bob + dip, 1.7);
    circle(g, -bodyW - 0.6, -18.8 - bob + dip, 1.7);
  } else {
    g.beginPath(); g.moveTo(-bodyW - 5.4, -17.4 - bob + dip); g.lineTo(-bodyW - 4.4, -21 - bob + dip); g.lineTo(-bodyW - 2.8, -17.8 - bob + dip); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-bodyW - 1.6, -17.8 - bob + dip); g.lineTo(-bodyW - 0.2, -21 - bob + dip); g.lineTo(-bodyW + 1, -17.6 - bob + dip); g.closePath(); g.fill();
  }
  if (look.tusks) {
    g.strokeStyle = "#e8e2d0"; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-bodyW - 7.4, -13.4 - bob + dip); g.quadraticCurveTo(-bodyW - 9.4, -15 - bob + dip, -bodyW - 8.8, -17 - bob + dip); g.stroke();
  }
  // mane down the neck
  g.strokeStyle = mane; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(-bodyW + 1.4, -14.4 - bob + dip); g.quadraticCurveTo(-bodyW + 4.5, -10 - bob, -bodyW + 6, -5.6 - bob); g.stroke();
  // eye
  g.fillStyle = "#15100b"; circle(g, -bodyW - 3.4, -16.2 - bob + dip, 0.95);
  // --- Steel barding (cosmetic): chest plate + chamfron ---
  if (mount.barding) {
    g.fillStyle = "#9aa0ab";
    g.beginPath();
    g.moveTo(-bodyW + 2.5, -9.5 - bob); g.lineTo(-bodyW - 1, -2 - bob); g.lineTo(-bodyW + 5, 1 - bob); g.lineTo(-bodyW + 8, -6 - bob);
    g.closePath(); g.fill();
    g.fillStyle = "#cdd3dc";
    g.fillRect(-bodyW + 1, -8.4 - bob, 6.5, 1.4);
    g.fillStyle = "#9aa0ab"; // chamfron on the face
    g.beginPath(); g.ellipse(-bodyW - 4, -16 - bob + dip, 3.4, 2.2, -0.25, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#cdd3dc"; g.fillRect(-bodyW - 6.4, -16.6 - bob + dip, 4.6, 0.9);
  }
  // --- Striped blanket (cosmetic): a woven pad under the saddle ---
  if (mount.blanket) {
    g.fillStyle = "#7d3a34";
    g.beginPath(); g.ellipse(-1, -8.6 - bob, 8.6, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c8b78e";
    g.fillRect(-6.6, -10.2 - bob, 2.2, 4.4);
    g.fillRect(-1.4, -10.6 - bob, 2.2, 4.6);
    g.fillRect(3.8, -10.2 - bob, 2.2, 4.4);
  }
  // --- Scarlet plume (cosmetic): a tall crest off the headstall ---
  if (mount.plume) {
    g.strokeStyle = "#a52f28"; g.lineWidth = 2.4; g.lineCap = "round";
    g.beginPath();
    g.moveTo(-bodyW - 2.6, -19 - bob + dip);
    g.quadraticCurveTo(-bodyW - 1.6, -25 - bob + dip, -bodyW - 4.6, -27.5 - bob + dip);
    g.stroke();
    g.lineCap = "butt";
    g.fillStyle = "#c8463c";
    g.beginPath(); g.ellipse(-bodyW - 4.4, -26.5 - bob + dip, 2.2, 3.6, -0.5, 0, Math.PI * 2); g.fill();
  }
  // --- Saddle: leather, silvered, or gilded (cosmetic) ---
  const sBase = mount.gold ? "#c9992e" : mount.silver ? "#9aa3ad" : "#5a3c22";
  const sLit = mount.gold ? "#f2d060" : mount.silver ? "#d5dde6" : "#7a5432";
  g.fillStyle = sBase;
  g.beginPath(); g.ellipse(-1, -10 - bob, 6.2, 3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = sLit;
  g.beginPath(); g.ellipse(-1, -10.8 - bob, 5, 1.7, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = sBase; g.lineWidth = 2; // girth strap
  g.beginPath(); g.moveTo(-1, -5 - bob); g.lineTo(-1, 3 - bob); g.stroke();
  if (mount.gold || mount.silver) { // precious-metal glint
    g.fillStyle = mount.gold ? "rgba(255,240,190,0.9)" : "rgba(235,245,255,0.9)";
    g.fillRect(-3.4, -11.6 - bob, 2, 1);
  }
  g.restore();
}

/** Lighten (+) or darken (-) a hex colour by an absolute channel amount. */
function shadeHex(hex: string, amt: number): string {
  const n = (i: number) => Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) + amt));
  return `rgb(${n(1)},${n(3)},${n(5)})`;
}

// --- Another player, rendered as a faint, idle apparition with a name label. ---
function drawGhost(g: CanvasRenderingContext2D, gh: Ghost, cam: Camera, now: number): void {
  const cx = gh.x * TILE + TILE / 2 - cam.x;
  const cy = gh.y * TILE + TILE / 2 - cam.y;
  shadow(g, cx, cy + TILE / 2 - 4, 8, 3);
  g.save();
  g.globalAlpha = 0.4; // translucent so it clearly reads as "not really here"
  drawAvatar(g, cx, cy, 1, withDefaults(gh.look), { now, moving: gh.moving, flip: gh.faceLeft }, gh.gear);
  g.restore();
  label(g, gh.name, cx, cy - TILE / 2 - 2, "#a9d8e8"); // cool, spectral blue
}

/**
 * Map the player's current activity to an avatar action — the tool in hand and
 * how far through the swing we are — so the arm animates in time with the work.
 * `frac` counts down 1 → 0 to the next action beat (when ore breaks, a log
 * falls, a recipe completes). Returns undefined when idle/walking.
 */
function playerAction(
  player: WorldState["player"],
  content: Content,
  now: number,
): AvatarAnim["action"] | undefined {
  const act = player.activity;
  if (act.kind === "idle") return undefined;
  // A swing should look like a strike, not slow-motion: hold a ready pose for most
  // of the weapon's interval, then snap the full wind-up→strike→follow-through
  // through STRIKE_MS right before the blow lands. The cadence (rests between
  // swings) still tracks weapon speed — a fast dagger barely pauses, a slow hammer
  // pauses long. Continuous motions (a bow's aim, a fishing sway) stay linear.
  const linearFrac = (interval: number) => Math.max(0, Math.min(1, (act.nextActionAt - now) / interval));
  const strikeFrac = (interval: number) => snapStrike(act.nextActionAt - now, interval);
  if (act.kind === "combat") {
    const main = player.equipment.mainhand;
    const interval = (main && content.items[main]?.speed) || 2400; // COMBAT.playerMeleeSpeed
    // A staff casts: held upright with a glowing orb, thrust on the beat.
    if (main && content.items[main]?.magic) return { kind: "cast", tool: "staff", frac: linearFrac(interval) };
    // A bow now lives in the mainhand — draw it at range instead of swinging.
    if (main && content.items[main]?.ranged) return { kind: "ranged", tool: "bow", frac: linearFrac(interval) };
    // The Bonesaw swings as a sword but renders its own toothed-saw blade.
    const type = main === "bonesaw" ? "saw" : ((main && content.items[main]?.wepType) || "sword");
    return { kind: "combat", tool: type, frac: strikeFrac(interval) };
  }
  // Gathering / crafting: the action interval the engine is repeating on.
  const TOOL: Record<string, string> = {
    mining: "pickaxe", woodcutting: "axe", fishing: "rod", crafting: "", trapping: "",
  };
  if (!(act.kind in TOOL)) return undefined;
  // Pick/axe chops snap like a strike; fishing/crafting/trapping keep their sway.
  const overhead = act.kind === "mining" || act.kind === "woodcutting";
  const f = overhead ? strikeFrac : linearFrac;
  // The pier champion wields a golden rod — draw it gold when fishing with it.
  let tool = TOOL[act.kind]!;
  if (act.kind === "fishing" && player.equipment.mainhand === "rod_gold") tool = "rod_gold";
  return { kind: act.kind, tool, frac: f(act.actionInterval || 600) };
}

/** The human-type monsters that swing a weapon; the rest are animals that lunge. */
const HUMANOID_MONSTERS = new Set([
  "bog_knight", "redrun_brigand", "ancient_orc", "dread_ferryman",
  "footpad", "cutpurse", "bandit", "poacher", "highwayman",
  "outlaw_archer", "cutthroat", "marauder", "outlaw_captain",
  "town_guard", "ironvale_guard", "field_farmer", "master_farmer",
  "cult_acolyte", "cult_zealot", "cult_magus",
]);

/**
 * A monster's attack while the player is fighting it. It swings on its own clock
 * (obj.nextAttackAt every stats.speed) so the animation matches its real attack
 * speed. Human-type foes get a weapon swing (by attack style; archers a bow);
 * animals get a lunge toward the player instead. Undefined when not engaged.
 */
function monsterAttack(
  def: WorldObjectDef,
  obj: WorldObjectState,
  state: WorldState,
  content: Content,
  now: number,
): MonsterAttack | undefined {
  if (def.kind !== "monster" || !def.monster) return undefined;
  const act = state.player.activity;
  if (act.kind !== "combat" || act.targetId !== def.id || !obj.nextAttackAt) return undefined;
  const stats = content.monsters[def.monster];
  if (!stats) return undefined;
  const interval = stats.speed || 3000; // COMBAT.monsterSpeed
  // Snap the swing/lunge into a quick strike with a rest between (matches the
  // player), so enemies don't fight in slow motion either.
  const frac = snapStrike(obj.nextAttackAt - now, interval);
  // Direction from the creature toward the player, for an animal's lunge.
  const mp = objectPos(def, obj);
  const pp = state.player.pos;
  let dx = pp.x - mp.x, dy = pp.y - mp.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  if (HUMANOID_MONSTERS.has(def.monster)) {
    if (def.monster === "poacher" || def.monster === "outlaw_archer") {
      return { frac, dx, dy, action: { kind: "ranged", tool: "bow", frac } };
    }
    const style = stats.attackStyle;
    // Casters (cultists) hold up a staff and cast rather than swing.
    if (style === "magic") {
      return { frac, dx, dy, action: { kind: "cast", tool: "staff", frac } };
    }
    const tool = style === "crush" ? "hammer" : style === "stab" ? "spear" : "sword";
    return { frac, dx, dy, action: { kind: "combat", tool, frac } };
  }
  return { frac, dx, dy }; // animal: lunge only
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** What a fishing spot advertises above the water: the best fish here you can
 *  currently land (highest level you meet), or — if none yet — the easiest one
 *  and the Fishing level it needs (shown greyed). Null if the spot has no fish. */
function fishingHeadline(
  content: Content,
  def: WorldObjectDef,
  level: number,
): { text: string; locked: boolean } | null {
  const ids = def.catches?.length
    ? def.catches.map((c) => c.action)
    : [def.resource ?? "fish_ashfin"];
  const fish = ids
    .map((id) => content.actions.find((a) => a.id === id))
    .filter((a): a is SkillAction => !!a)
    .sort((a, b) => (a.levelReq ?? 1) - (b.levelReq ?? 1));
  if (fish.length === 0) return null;
  const catchable = fish.filter((a) => level >= (a.levelReq ?? 1));
  if (catchable.length) return { text: catchable[catchable.length - 1]!.name, locked: false };
  const next = fish[0]!;
  return { text: `${next.name} · Fishing ${next.levelReq ?? 1}`, locked: true };
}

function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  g.font = "11px 'EB Garamond', serif";
  g.textAlign = "center";
  g.textBaseline = "bottom";
  g.fillStyle = "rgba(0,0,0,0.6)";
  g.fillText(text, x + 1, y + 1);
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.textAlign = "left";
}
