/**
 * src/client/minimap.ts
 * ---------------------
 * Top-right minimap + a full world-map overlay. The minimap shows only the
 * local area currently on screen (centred on the player); a 🗺 button opens the
 * whole continent. Pure presentation — reads the core's state, never changes it.
 */

import type { Content, ObjKind, TileType, Vec2, WorldState } from "../core/types.ts";
import { objectPos, objectHidden } from "../core/worldCore.ts";
import { OVERWORLD_HEIGHT, instanceRectAt, REGIONS, CITY } from "../content/map.ts";
import { Camera, TILE } from "./render.ts";
import { iconize } from "./glyph.ts";
import { currentGhosts } from "./presence.ts";

/** Filterable world-map marker categories: which object kinds each covers, the
 *  legend icon/label, and whether it starts visible (resources/agility off, so
 *  the map isn't a wall of dots until you ask for them). */
const MAP_CATS: { id: string; label: string; icon: string; kinds: ObjKind[]; on: boolean }[] = [
  { id: "bank", label: "Bank", icon: "🪙", kinds: ["bank"], on: true },
  { id: "forge", label: "Forge", icon: "🔨", kinds: ["anvil", "furnace"], on: true },
  { id: "cook", label: "Cooking", icon: "🍳", kinds: ["fire"], on: true },
  { id: "brew", label: "Brewing", icon: "⚗️", kinds: ["cauldron"], on: true },
  { id: "craft", label: "Crafting", icon: "🪚", kinds: ["workbench", "crafting_table", "sawmill"], on: true },
  { id: "travel", label: "Waystone", icon: "🗺", kinds: ["waystone"], on: true },
  // Shrines, relics and sealed vaults are deliberately left off — they're
  // discoveries you find by exploring, not pins on the map.
  { id: "people", label: "People", icon: "👤", kinds: ["npc"], on: true },
  { id: "bounty", label: "Bounty", icon: "🎯", kinds: ["bounty_board"], on: true },
  { id: "home", label: "Homestead", icon: "🏠", kinds: ["housing_plot"], on: true },
  // Farming plots (crops + orchard) get their own always-on pin, so you can
  // always find a patch to plant in — they're easy to miss otherwise.
  { id: "farming", label: "Farming", icon: "🌾", kinds: ["plant_patch", "tree_patch"], on: true },
  // Resources split by kind so each reads with its own icon (and its own toggle).
  { id: "trees", label: "Trees", icon: "🌲", kinds: ["tree"], on: false },
  { id: "mining", label: "Mining", icon: "⛏️", kinds: ["rock"], on: false },
  { id: "fishing", label: "Fishing", icon: "🎣", kinds: ["fishing_spot"], on: false },
  { id: "foraging", label: "Foraging", icon: "🌿", kinds: ["forage_spot", "trap"], on: false },
  { id: "agility", label: "Agility", icon: "👟", kinds: ["agility_obstacle"], on: false },
];

/** Region key → the name shown on the map. */
const REGION_NAMES: Record<string, string> = {
  spine: "The Spine", marrow: "Marrow Deeps", redrun: "The Redrun",
  ashfen: "Ashfen Flats", heartmoor: "The Heartmoor", greyoak: "Greyoak Wood",
};

/** Extra hand-placed landmark labels (hamlets the regions don't cover). */
const EXTRA_LABELS: { name: string; x: number; y: number }[] = [
  { name: "Redmouth", x: 86, y: 60 },
  { name: "Drover's Rest", x: 68, y: 75 },
  { name: "The Fold", x: 62, y: 16 },
  // The head of the Varathian Trail (at its first checkpoint / Cael).
  { name: "Varathian Trail", x: 57, y: 10 },
];

/** Tiles across the (square) minimap — a fixed local radius, OSRS-style, so the
 *  area around the character is always the same regardless of the view's zoom. */
const MINIMAP_SPAN = 26;

const MM_TILE: Record<TileType, string> = {
  grass: "#34402d",
  dirt: "#473720",
  path: "#5a4d39",
  stone: "#3a3b43",
  water: "#1e3142",
  moss: "#26331f",
  mountain: "#33343c",
  snow: "#9aa6b6",
  bog: "#2c3729",
  ash: "#40332d",
  cave: "#16151c",
  cave_wall: "#0b0a0f",
  deep: "#101d30",
  wall: "#736857",
  plank: "#5e4326",
  sand: "#a08a5c",
};

const MM_OBJ: Record<ObjKind, string> = {
  dungeon_gate: "#6a6474",   // sealed stone
  puzzle_lever: "#b9552f",   // iron fitting in the dark
  dungeon_chest: "#c9cede",  // pale clasp — the prize
  ruin_prop: "#8d8a80",      // weathered masonry
  remains: "",               // floor litter: never dots the map
  tree: "#5d6e3e",
  rock: "#9a9080",
  fishing_spot: "#6fa0c0",
  npc: "#c9a24a",
  monster: "#cc4a3a",
  bank: "#caa05a",
  grand_exchange: "#e2c061", // a bright brass marker for the market booth
  forage_spot: "#7fae5a", // herb-green for a wild forage clump
  fire: "#e08a3a",
  furnace: "#b06a48",
  anvil: "#7a7d86",
  shrine: "#b9b0c8",
  plant_patch: "#6a8a4a",
  tree_patch: "#4e7a3e",
  portal: "#b0593a",
  trap: "#9c7b46",
  bounty_board: "#c8a24a",
  housing_plot: "#d8b066", // a warm hearth-gold marker for a homestead
  build_hotspot: "", // build footings aren't marked on the minimap
  house_door: "#b07a3a", // a home's door
  room_seal: "", // interior wing seals aren't marked on the minimap
  cauldron: "#6f8a6a",
  workbench: "#9a7b4e",
  crafting_table: "#a98a6a",
  cart: "#b89357",
  fountain: "#6fa0c0",
  sawmill: "#9a7b4e",
  critter: "", // ambient wildlife isn't marked on the minimap
  lamppost: "", // street dressing — not marked
  fence: "", // pen rails — not marked
  boat: "", // moored dressing — not marked
  reeds: "", // pond dressing — not marked
  deadfall: "", // wood dressing — not marked
  signpost: "#caa05a",
  bone_cairn: "", // grim dressing — not marked on the minimap
  waystone: "#d2742c",
  agility_obstacle: "#b6d24a",
  relic: "#e8d49a", // pale parchment — a found-lore marker, to draw the curious
  pier_spot: "#6fa0c0", // a deep-water cast point, like a fishing spot
  record_board: "#c8a24a", // a board, like the bounty board
  trail_board: "#5fae7a", // runner's green for the trail standings board
  pier_gate: "", // the barrier itself isn't marked
  banner: "", // a town's heraldry — dressing, not a minimap marker
};

/** Draw a resource marker with a shape that reads at a glance: a little tree
 *  for woodcutting, a faceted diamond for ore, a ripple for fishing — anything
 *  else falls back to a plain dot. `r` is the dot radius the dot would use. */
/** Destination POIs the minimap draws as EMOJI glyphs (matching the world map's
 *  vocabulary) rather than near-identical coloured dots — so a bank, a bounty
 *  board and a signpost are told apart at a glance (T7·04). Resource nodes keep
 *  their distinct shapes below; only these look-alike dots get a glyph. */
const MM_GLYPH: Partial<Record<ObjKind, string>> = {
  bank: "🪙",
  grand_exchange: "💰",
  bounty_board: "🎯",
  signpost: "🪧",
  waystone: "🧭",
  portal: "🌀",
  housing_plot: "🏠",
  shrine: "⛩️",
  plant_patch: "🌾",
};

function drawObjShape(
  g: CanvasRenderingContext2D, kind: ObjKind, cx: number, cy: number, r: number, color: string,
): void {
  const em = MM_GLYPH[kind];
  if (em) {
    const size = Math.max(8, r * 3.8);
    g.font = `${size}px "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.globalAlpha = color.startsWith("rgba(120") ? 0.45 : 1; // dim when depleted
    g.fillText(em, cx, cy);
    g.globalAlpha = 1;
    return;
  }
  g.fillStyle = color;
  g.strokeStyle = color;
  if (kind === "tree" || kind === "tree_patch") {
    // A tiny conifer: triangle crown over a stub trunk.
    const h = r * 2.2, w = r * 1.7;
    g.beginPath();
    g.moveTo(cx, cy - h * 0.6);
    g.lineTo(cx - w, cy + h * 0.4);
    g.lineTo(cx + w, cy + h * 0.4);
    g.closePath();
    g.fill();
  } else if (kind === "rock") {
    // A faceted diamond for an ore seam.
    const d = r * 1.7;
    g.beginPath();
    g.moveTo(cx, cy - d);
    g.lineTo(cx + d, cy);
    g.lineTo(cx, cy + d);
    g.lineTo(cx - d, cy);
    g.closePath();
    g.fill();
  } else if (kind === "fishing_spot") {
    // A ripple: two small stacked arcs.
    g.lineWidth = Math.max(0.8, r * 0.5);
    g.beginPath(); g.arc(cx, cy + r * 0.3, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.beginPath(); g.arc(cx, cy - r * 0.5, r * 0.7, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  } else if (kind === "forage_spot") {
    // A little three-leaf cluster.
    const d = r * 0.9;
    for (const a of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) {
      g.beginPath();
      g.arc(cx + Math.cos(a) * d * 0.7, cy + Math.sin(a) * d * 0.7, d, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }
}

/** Draw the player as a dark-ringed gold dot at screen px,py. */
function drawPlayerDot(g: CanvasRenderingContext2D, px: number, py: number): void {
  g.fillStyle = "#13100d";
  g.beginPath();
  g.arc(px, py, 3.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f2cf6b";
  g.beginPath();
  g.arc(px, py, 2.1, 0, Math.PI * 2);
  g.fill();
}

export class Minimap {
  private g: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  /** Backing-store size + DPR last applied, so we only resize on change. */
  private cw = 0;
  private ch = 0;
  private mdpr = 0;
  /** Last-draw transform (CSS px), so a click can be inverted to a world tile. */
  private view = { originX: 0, originY: 0, cell: 1, offX: 0, offY: 0 };

  constructor(
    root: HTMLElement,
    onWorldMap: () => void,
    onWalk: (tile: Vec2) => void,
  ) {
    const panel = document.createElement("div");
    panel.className = "hud-panel hud-minimap";
    const canvas = document.createElement("canvas");
    this.canvas = canvas;
    canvas.className = "minimap-canvas";
    panel.appendChild(canvas);

    // Tap the minimap to walk toward that spot. The view is stored in CSS px
    // with letterbox offsets, so invert through those.
    canvas.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const v = this.view;
      onWalk({
        x: Math.round(v.originX + (sx - v.offX) / v.cell - 0.5),
        y: Math.round(v.originY + (sy - v.offY) / v.cell - 0.5),
      });
    });

    // The world-map button, tucked in the minimap's corner.
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "minimap-worldbtn";
    btn.title = "World map";
    btn.innerHTML = iconize("🗺");
    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      onWorldMap();
    });
    panel.appendChild(btn);

    root.appendChild(panel);
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D context for the minimap.");
    this.g = g;
  }

  /**
   * OSRS-style: a fixed radius around the character, always — independent of the
   * main view's zoom or what fits on screen, and always centred on the player.
   * Square, north-up, no view-frame box.
   */
  draw(
    state: WorldState,
    content: Content,
  ): void {
    const g = this.g;
    const m = state.map;

    // Square element; one fixed tile-span so the local area is always the same.
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    const S = window.innerHeight < 440 ? 92 : 116; // px, square
    if (S !== this.cw || S !== this.ch || dpr !== this.mdpr) {
      this.cw = S; this.ch = S; this.mdpr = dpr;
      this.canvas.width = Math.round(S * dpr);
      this.canvas.height = Math.round(S * dpr);
      this.canvas.style.width = `${S}px`;
      this.canvas.style.height = `${S}px`;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); // work in CSS px below

    // A constant window of tiles, centred on the player (not the camera), so the
    // character sits dead-centre and you always see the same distance around them.
    const cell = S / MINIMAP_SPAN;
    const p = state.player.pos;
    const originX = p.x + 0.5 - MINIMAP_SPAN / 2; // tile at the minimap's left edge
    const originY = p.y + 0.5 - MINIMAP_SPAN / 2;
    this.view = { originX, originY, cell, offX: 0, offY: 0 };

    g.fillStyle = "#0c0907";
    g.fillRect(0, 0, S, S);

    // Inside a sealed instance (a home / arena) the minimap shows only that room.
    const region = instanceRectAt(Math.round(p.x), Math.round(p.y));
    const inRegion = (x: number, y: number): boolean =>
      !region || (x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1);
    const sx = (tx: number): number => (tx - originX) * cell;
    const sy = (ty: number): number => (ty - originY) * cell;

    // Tiles within the fixed window.
    const x0 = Math.floor(originX), x1 = Math.ceil(originX + MINIMAP_SPAN);
    const y0 = Math.floor(originY), y1 = Math.ceil(originY + MINIMAP_SPAN);
    for (let y = y0; y < y1; y++) {
      if (y < 0 || y >= m.height) continue;
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= m.width || !inRegion(x, y)) continue;
        g.fillStyle = MM_TILE[m.tiles[y * m.width + x]!];
        g.fillRect(sx(x), sy(y), cell + 0.8, cell + 0.8);
      }
    }

    // Objects in the window (dimmed while depleted / respawning).
    for (const def of content.objects) {
      const color = MM_OBJ[def.kind];
      if (!color) continue;
      if (objectHidden(def, state.player)) continue; // story-gated: not revealed yet
      const obj = state.objects[def.id];
      const p = objectPos(def, obj);
      if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1) continue;
      if (!inRegion(Math.round(p.x), Math.round(p.y))) continue;
      // A bounty guide reads as a hunt mark — a ringed gold dot — not a plain
      // villager dot, so a hunter can spot the task-giver at a glance.
      if (def.kind === "npc" && def.bountyGuide) {
        const bx = sx(p.x + 0.5), by = sy(p.y + 0.5);
        g.strokeStyle = "#e8b54a";
        g.lineWidth = 1.2;
        g.beginPath(); g.arc(bx, by, 3.4, 0, Math.PI * 2); g.stroke();
        g.fillStyle = "#e8b54a";
        g.beginPath(); g.arc(bx, by, 1.5, 0, Math.PI * 2); g.fill();
        continue;
      }
      const tint = obj && !obj.available ? "rgba(120,110,100,0.5)" : color;
      drawObjShape(g, def.kind, sx(p.x + 0.5), sy(p.y + 0.5), Math.max(1.6, cell * 0.32), tint);
    }

    // Deliberately NO live-hunt overlay (no ring, no bearing arrow): the guide
    // TELLS you where the quarry lives, OSRS-style, and finding it is on you.

    // Other players (ghosts), live, with their name above the dot.
    for (const gh of currentGhosts()) {
      if (gh.x < x0 - 1 || gh.x > x1 + 1 || gh.y < y0 - 1 || gh.y > y1 + 1) continue;
      if (!inRegion(Math.round(gh.x), Math.round(gh.y))) continue;
      const gx = sx(gh.x + 0.5), gy = sy(gh.y + 0.5);
      g.fillStyle = "#0c0907";
      g.beginPath(); g.arc(gx, gy, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#a9d8e8"; // spectral blue, matching the in-world ghost
      g.beginPath(); g.arc(gx, gy, 2, 0, Math.PI * 2); g.fill();
      const name = gh.name.length > 9 ? `${gh.name.slice(0, 8)}…` : gh.name;
      g.font = "6px 'EB Garamond', serif";
      g.textAlign = "center";
      g.fillStyle = "rgba(0,0,0,0.7)";
      g.fillText(name, gx + 0.4, gy - 4 + 0.4);
      g.fillStyle = "#cdeaf4";
      g.fillText(name, gx, gy - 4);
      g.textAlign = "start";
    }

    drawPlayerDot(g, sx(p.x + 0.5), sy(p.y + 0.5));
  }
}

/** A full-screen overlay showing the whole continent: terrain + player on a
 *  canvas, with a DOM overlay of named places and a filterable legend of POI
 *  markers (banks, stations, waystones, people, …). */
export class WorldMapModal {
  private backdrop: HTMLElement;
  private g: CanvasRenderingContext2D;
  private markerLayer: HTMLElement;
  private legend: HTMLElement;
  private open = false;
  /** Category id → currently shown? (drives marker visibility + legend chips). */
  private active = new Map<string, boolean>();
  /** Markers grouped by category, so a legend toggle can show/hide them fast. */
  private markersByCat = new Map<string, HTMLElement[]>();
  private labelsOn = true;
  private labelEls: HTMLElement[] = [];
  /** Story-gated landmark labels (e.g. "The Bonefield"): shown only once the
   *  player owns the reveal flag. Toggled each draw so they surface the moment a
   *  quest step reveals them, and vanish again for a fresh character. */
  private gatedLabels: { el: HTMLElement; flag: string }[] = [];

  private stage!: HTMLElement;
  private viewport!: HTMLElement;
  private mapZoom = 1;
  private baseW = 0;
  private baseH = 0;

  constructor(root: HTMLElement, content: Content, onWalk: (tile: Vec2) => void) {
    const m = content.map;
    const cell = Math.max(4, Math.floor(620 / m.width));
    const mapH = OVERWORLD_HEIGHT; // only the overworld; the arena band stays hidden
    this.backdrop = document.createElement("div");
    this.backdrop.className = "worldmap-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="worldmap-modal">
        <div class="worldmap-head">
          <span class="worldmap-title">Varath — World Map</span>
          <div class="worldmap-zoom">
            <button class="wm-zoom-btn" data-zoom="out" type="button" title="Zoom out">−</button>
            <button class="wm-zoom-btn" data-zoom="in" type="button" title="Zoom in">+</button>
          </div>
          <button class="worldmap-close" type="button">✕</button>
        </div>
        <div class="worldmap-viewport">
          <div class="worldmap-stage">
            <canvas class="worldmap-canvas" width="${m.width * cell}" height="${mapH * cell}"></canvas>
            <div class="worldmap-overlay"></div>
          </div>
        </div>
        <div class="worldmap-legend"></div>
        <div class="worldmap-hint">Tap the map to walk there · scroll or ± to zoom · drag to pan · tap a chip to filter.</div>
      </div>`;
    const canvas = this.backdrop.querySelector(".worldmap-canvas") as HTMLCanvasElement;
    this.markerLayer = this.backdrop.querySelector(".worldmap-overlay") as HTMLElement;
    this.legend = this.backdrop.querySelector(".worldmap-legend") as HTMLElement;
    this.stage = this.backdrop.querySelector(".worldmap-stage") as HTMLElement;
    this.viewport = this.backdrop.querySelector(".worldmap-viewport") as HTMLElement;
    root.appendChild(this.backdrop);
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D context for the world map.");
    this.g = g;

    // Tap the map to walk there (then close so you can watch the journey). Only a
    // genuine tap walks — a drag pans the (overflow) viewport instead, so zooming
    // and panning don't accidentally fling the player across the world.
    let downX = 0, downY = 0, dragged = false;
    canvas.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      downX = e.clientX; downY = e.clientY; dragged = false;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) dragged = true;
    });
    canvas.addEventListener("pointerup", (e) => {
      e.stopPropagation();
      if (dragged) return; // it was a pan, not a tap
      const r = canvas.getBoundingClientRect();
      onWalk({
        x: Math.floor(((e.clientX - r.left) / r.width) * m.width),
        y: Math.floor(((e.clientY - r.top) / r.height) * OVERWORLD_HEIGHT),
      });
      this.close();
    });
    // Wheel zoom, centred roughly on the cursor.
    this.viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.setMapZoom(this.mapZoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
    }, { passive: false });
    for (const b of this.backdrop.querySelectorAll(".wm-zoom-btn")) {
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const dir = (b as HTMLElement).dataset.zoom === "in" ? 1.25 : 1 / 1.25;
        this.setMapZoom(this.mapZoom * dir);
      });
    }

    (this.backdrop.querySelector(".worldmap-close") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.buildOverlay(content, m.width, mapH);
    this.buildLegend(content);
  }

  /** Fit the map to the viewport at zoom 1, then apply the current zoom. Called
   *  when the map opens (window size may have changed) and on every zoom step. */
  private layout(): void {
    const cv = this.backdrop.querySelector(".worldmap-canvas") as HTMLCanvasElement;
    const iw = cv.width, ih = cv.height; // intrinsic pixel size
    const boxW = Math.min(window.innerWidth * 0.86, 820);
    const boxH = Math.min(window.innerHeight * 0.66, 660);
    const fit = Math.min(boxW / iw, boxH / ih, 1);
    this.baseW = iw * fit;
    this.baseH = ih * fit;
    const w = Math.round(this.baseW * this.mapZoom);
    const h = Math.round(this.baseH * this.mapZoom);
    this.stage.style.width = `${w}px`;
    this.stage.style.height = `${h}px`;
  }

  private setMapZoom(z: number): void {
    const next = Math.max(1, Math.min(4, z));
    if (next === this.mapZoom) return;
    // Keep the view roughly centred as you zoom.
    const vp = this.viewport;
    const cx = (vp.scrollLeft + vp.clientWidth / 2) / Math.max(1, this.stage.offsetWidth);
    const cy = (vp.scrollTop + vp.clientHeight / 2) / Math.max(1, this.stage.offsetHeight);
    this.mapZoom = next;
    this.layout();
    vp.scrollLeft = cx * this.stage.offsetWidth - vp.clientWidth / 2;
    vp.scrollTop = cy * this.stage.offsetHeight - vp.clientHeight / 2;
  }

  /** Place the named-place labels + a POI marker for every catalogued object. */
  private buildOverlay(content: Content, w: number, rows: number): void {
    const pct = (x: number, total: number): string => `${(x / total) * 100}%`;
    // Region + city + hamlet labels.
    const labels: { name: string; x: number; y: number }[] = [
      { name: "Ironvale", x: (CITY.x0 + CITY.x1) / 2, y: (CITY.y0 + CITY.y1) / 2 },
      ...REGIONS.filter((r) => REGION_NAMES[r.key]).map((r) => ({
        name: REGION_NAMES[r.key]!, x: r.nx + r.w / 2, y: r.ny + r.h / 2,
      })),
      ...EXTRA_LABELS,
    ];
    for (const l of labels) {
      const el = document.createElement("span");
      el.className = "wm-label";
      el.textContent = l.name;
      el.style.left = pct(l.x + 0.5, w);
      el.style.top = pct(l.y + 0.5, rows);
      this.markerLayer.appendChild(el);
      this.labelEls.push(el);
    }
    // Named-landmark labels — only the places worth navigating to: dungeon
    // entrances (portals), settlements & major hubs (named signposts) and the
    // quest/boss camps. The many minor lore shrines are left off so the map
    // doesn't drown in text. Story-gated spots (requiresFlag) stay hidden until
    // their quest reveals them; directional "Fingerpost" signs are skipped.
    const KEEP_SHRINE = new Set(["The Brigand's Roost", "The Brigand Camp"]);
    const seen = new Set(this.labelEls.map((e) => e.textContent));
    for (const def of content.objects) {
      const important =
        def.kind === "portal" ||
        (def.kind === "signpost" && !!def.name && def.name !== "Fingerpost") ||
        (def.kind === "shrine" && !!def.name && KEEP_SHRINE.has(def.name));
      if (!important) continue;
      const name = def.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const p = objectPos(def, undefined);
      if (p.y >= rows) continue;
      const el = document.createElement("span");
      el.className = "wm-poi-label";
      el.textContent = name;
      el.style.left = pct(p.x + 0.5, w);
      el.style.top = pct(p.y + 0.5, rows);
      this.markerLayer.appendChild(el);
      if (def.requiresFlag) {
        // Story-gated (e.g. "The Bonefield"): kept out of the always-on label
        // set and hidden until draw() confirms the player owns the reveal flag —
        // so a revealed camp finally shows up on the map to steer toward.
        el.style.display = "none";
        this.gatedLabels.push({ el, flag: def.requiresFlag });
      } else {
        this.labelEls.push(el);
      }
    }
    // POI markers, grouped by category.
    const kindCat = new Map<ObjKind, { id: string; icon: string; label: string }>();
    for (const c of MAP_CATS) for (const k of c.kinds) kindCat.set(k, c);
    for (const def of content.objects) {
      // Bounty guides file under the Bounty chip (🎯) with the boards, not
      // under People — "where do I get a task" is one question, one filter.
      const cat = def.kind === "npc" && def.bountyGuide
        ? kindCat.get("bounty_board")
        : kindCat.get(def.kind);
      if (!cat) continue;
      // One agility icon per course: only the starting obstacle (order 0) gets a
      // marker, so a course reads as a single pin, not a cluster of dots.
      if (def.kind === "agility_obstacle" && (def.order ?? 0) !== 0) continue;
      const p = objectPos(def, undefined);
      if (p.y >= rows) continue;
      const el = document.createElement("span");
      el.className = "wm-marker";
      el.dataset.cat = cat.id;
      el.title = def.name;
      el.innerHTML = iconize(cat.icon);
      el.style.left = pct(p.x + 0.5, w);
      el.style.top = pct(p.y + 0.5, rows);
      this.markerLayer.appendChild(el);
      const arr = this.markersByCat.get(cat.id) ?? [];
      arr.push(el);
      this.markersByCat.set(cat.id, arr);
    }
  }

  /** Build the legend chips and wire each to toggle its category's markers. */
  private buildLegend(content: Content): void {
    const counts = new Map<string, number>();
    for (const [id, arr] of this.markersByCat) counts.set(id, arr.length);
    for (const c of MAP_CATS) {
      if (!counts.get(c.id)) continue; // skip categories with nothing on the map
      this.active.set(c.id, c.on);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `wm-chip${c.on ? " on" : ""}`;
      chip.innerHTML = `<span class="wm-chip-ic">${iconize(c.icon)}</span>${c.label} <span class="wm-chip-n">${counts.get(c.id)}</span>`;
      if (!c.on) for (const el of this.markersByCat.get(c.id) ?? []) el.style.display = "none";
      chip.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const on = !this.active.get(c.id);
        this.active.set(c.id, on);
        chip.classList.toggle("on", on);
        for (const el of this.markersByCat.get(c.id) ?? []) el.style.display = on ? "" : "none";
      });
      this.legend.appendChild(chip);
    }
    // A Labels toggle for the place names.
    const lbl = document.createElement("button");
    lbl.type = "button";
    lbl.className = "wm-chip on";
    lbl.innerHTML = `<span class="wm-chip-ic">${iconize("📜")}</span>Labels`;
    lbl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.labelsOn = !this.labelsOn;
      lbl.classList.toggle("on", this.labelsOn);
      for (const el of this.labelEls) el.style.display = this.labelsOn ? "" : "none";
    });
    this.legend.appendChild(lbl);
    void content;
  }

  isOpen(): boolean { return this.open; }
  show(): void { this.open = true; this.backdrop.classList.remove("hidden"); this.layout(); }
  close(): void { this.open = false; this.backdrop.classList.add("hidden"); }

  /** Repaint terrain + player + view-rect each frame; markers are static DOM. */
  /** The atlas layer — terrain, coastlines, relief, grain, frame, compass —
   *  is static per map, so it's painted ONCE offscreen and blitted per frame. */
  private atlas: HTMLCanvasElement | null = null;
  private atlasFor: unknown = null;

  private atlasTerrain(m: WorldState["map"]): HTMLCanvasElement {
    if (this.atlas && this.atlasFor === m.tiles) return this.atlas;
    const rows = OVERWORLD_HEIGHT;
    const cell = this.g.canvas.width / m.width;
    const W = this.g.canvas.width, H = this.g.canvas.height;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    const hash = (x: number, y: number): number => {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const t = (x: number, y: number): TileType | undefined =>
      x < 0 || y < 0 || x >= m.width || y >= rows ? undefined : m.tiles[y * m.width + x];
    const water = (x: number, y: number): boolean => { const v = t(x, y); return v === "water" || v === "deep"; };

    // 1) The tile base (the honest map underneath everything).
    g.fillStyle = "#0c0907";
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < m.width; x++) {
        g.fillStyle = MM_TILE[m.tiles[y * m.width + x]!];
        g.fillRect(x * cell, y * cell, cell + 0.6, cell + 0.6);
      }
    }
    // 2) Atlas coastlines: an inked edge on the land side, a pale shallows halo
    //    on the water side — the single biggest "drawn map" tell.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < m.width; x++) {
        if (water(x, y)) {
          const coast = !water(x - 1, y) || !water(x + 1, y) || !water(x, y - 1) || !water(x, y + 1);
          if (coast) {
            g.fillStyle = "rgba(140,180,200,0.22)"; // shallows
            g.fillRect(x * cell, y * cell, cell + 0.6, cell + 0.6);
          }
        } else {
          const edge = water(x - 1, y) || water(x + 1, y) || water(x, y - 1) || water(x, y + 1);
          if (edge) {
            g.fillStyle = "rgba(10,14,18,0.55)"; // the inked line
            if (water(x - 1, y)) g.fillRect(x * cell, y * cell, 1, cell + 0.6);
            if (water(x + 1, y)) g.fillRect((x + 1) * cell - 1, y * cell, 1, cell + 0.6);
            if (water(x, y - 1)) g.fillRect(x * cell, y * cell, cell + 0.6, 1);
            if (water(x, y + 1)) g.fillRect(x * cell, (y + 1) * cell - 1, cell + 0.6, 1);
          }
        }
      }
    }
    // 3) Relief hatching, atlas-style: chevrons on the ranges, stipple in the
    //    woods, glints on the snowfield, reed ticks in the moor.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < m.width; x++) {
        const tt = t(x, y);
        const hv = hash(x, y);
        const px = x * cell, py = y * cell;
        if (tt === "mountain" && hv > 0.55) {
          g.strokeStyle = "rgba(220,225,235,0.5)";
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(px + cell * 0.15, py + cell * 0.8);
          g.lineTo(px + cell * 0.5, py + cell * 0.15);
          g.lineTo(px + cell * 0.85, py + cell * 0.8);
          g.stroke();
          g.strokeStyle = "rgba(0,0,0,0.35)";
          g.beginPath();
          g.moveTo(px + cell * 0.5, py + cell * 0.15);
          g.lineTo(px + cell * 0.72, py + cell * 0.75);
          g.stroke();
        } else if ((tt === "moss" || (tt === "grass" && hv > 0.9)) && hv > 0.62) {
          g.fillStyle = "rgba(12,22,10,0.5)"; // a wood's stipple crown
          g.beginPath(); g.arc(px + cell * (0.3 + hv * 0.4), py + cell * 0.42, cell * 0.28, 0, Math.PI * 2); g.fill();
          g.fillStyle = "rgba(90,120,70,0.35)";
          g.beginPath(); g.arc(px + cell * (0.3 + hv * 0.4) - 0.5, py + cell * 0.36, cell * 0.18, 0, Math.PI * 2); g.fill();
        } else if (tt === "snow" && hv > 0.9) {
          g.fillStyle = "rgba(255,255,255,0.5)";
          g.fillRect(px + cell * 0.4, py + cell * 0.4, 1.2, 1.2);
        } else if (tt === "bog" && hv > 0.82) {
          g.strokeStyle = "rgba(120,140,100,0.4)";
          g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(px + cell * 0.3, py + cell * 0.75); g.lineTo(px + cell * 0.3, py + cell * 0.3);
          g.moveTo(px + cell * 0.6, py + cell * 0.8); g.lineTo(px + cell * 0.6, py + cell * 0.4); g.stroke();
        }
      }
    }
    // 4) Paper grain + an aged wash, so it reads as a chart, not a screenshot.
    for (let i = 0; i < 1400; i++) {
      const rx = hash(i, 7) * W, ry = hash(3, i) * H;
      g.fillStyle = i % 2 ? "rgba(240,220,180,0.025)" : "rgba(0,0,0,0.04)";
      g.fillRect(rx, ry, 1.4, 1.4);
    }
    const wash = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
    wash.addColorStop(0, "rgba(214,180,120,0.05)");
    wash.addColorStop(1, "rgba(10,6,2,0.42)");
    g.fillStyle = wash;
    g.fillRect(0, 0, W, H);
    // 5) The etched frame: a double border in the chart-maker's gold.
    g.strokeStyle = "rgba(201,162,74,0.65)";
    g.lineWidth = 2;
    g.strokeRect(3, 3, W - 6, H - 6);
    g.strokeStyle = "rgba(201,162,74,0.3)";
    g.lineWidth = 1;
    g.strokeRect(7.5, 7.5, W - 15, H - 15);
    // 6) A compass rose, bottom-right.
    const cx = W - 46, cy = H - 46, R = 26;
    g.save();
    g.translate(cx, cy);
    g.globalAlpha = 0.9;
    g.strokeStyle = "rgba(201,162,74,0.8)";
    g.lineWidth = 1;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, R * 0.55, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(232,217,174,0.95)";
    for (let i = 0; i < 4; i++) { // the four points
      g.save(); g.rotate((i * Math.PI) / 2);
      g.beginPath(); g.moveTo(0, -R + 3); g.lineTo(4, -6); g.lineTo(0, -9); g.lineTo(-4, -6); g.closePath(); g.fill();
      g.restore();
    }
    g.font = "bold 11px 'Cinzel', serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#e8d9ae";
    g.fillText("N", 0, -R - 9);
    g.restore();
    this.atlas = c;
    this.atlasFor = m.tiles;
    return c;
  }

  draw(
    state: WorldState,
    content: Content,
    cam: Camera,
    viewW: number,
    viewH: number,
  ): void {
    const g = this.g;
    const m = state.map;
    const cell = g.canvas.width / m.width;
    const rows = OVERWORLD_HEIGHT;

    g.drawImage(this.atlasTerrain(m), 0, 0);
    // Deliberately NO live-hunt ring here either: the contract and the guide's
    // words name the ground; the map stays an honest map.
    void content;
    // The Varathian Trail is deliberately NOT drawn across the world map — only
    // its start (the "Varathian Trail" head marker in the POI list) is shown, so
    // the map stays uncluttered. You follow the walked track on the ground itself.
    // The view-rect of what the main camera currently shows.
    if (cam.y / TILE < rows) {
      g.strokeStyle = "rgba(232,217,174,0.45)";
      g.lineWidth = 1.5;
      g.strokeRect((cam.x / TILE) * cell, (cam.y / TILE) * cell, (viewW / TILE) * cell, (viewH / TILE) * cell);
    }
    // Reveal any story-gated landmark labels the player has now unlocked (and
    // re-hide them if the labels layer is toggled off). Cheap per-draw sync so a
    // just-revealed camp appears the instant its quest flag is set.
    for (const gl of this.gatedLabels) {
      const show = this.labelsOn && state.player.flags.includes(gl.flag);
      gl.el.style.display = show ? "" : "none";
    }
    // You-are-here: the familiar dot, ringed by a slow gold pulse so the eye
    // finds itself on a busy chart at once.
    const p = state.player.pos;
    if (p.y < rows) {
      const px = (p.x + 0.5) * cell, py = (p.y + 0.5) * cell;
      const ph = (performance.now() % 1600) / 1600;
      g.strokeStyle = `rgba(242,207,107,${(0.75 * (1 - ph)).toFixed(3)})`;
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(px, py, 4 + ph * 9, 0, Math.PI * 2); g.stroke();
      drawPlayerDot(g, px, py);
    }
  }
}
