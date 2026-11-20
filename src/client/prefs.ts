/**
 * src/client/prefs.ts
 * -------------------
 * The device display preferences read while the Game and the Hud are being
 * built (zoom, draw distance, loot labels, performance mode, interface size,
 * brightness, a minimized log). They run at boot, so each one goes through
 * `readPref`, which never throws: with storage blocked they fall back to their
 * defaults instead of crashing the game before it draws. Kept free of the DOM
 * so `sims/storage.ts` can check them headlessly.
 */

import { readPref } from "./storage.ts";

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.4;
export const ZOOM_KEY = "varath-zoom";
export const clampZoom = (z: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
export function readZoom(): number {
  const raw = Number(readPref(ZOOM_KEY));
  return Number.isFinite(raw) && raw > 0 ? clampZoom(raw) : 1;
}

// Draw distance: how many tiles out from the player the world is painted. The
// slider runs DRAW_MIN..DRAW_MAX tiles; DRAW_MAX means "unlimited" (Infinity).
export const DRAW_MIN = 8;
export const DRAW_MAX = 40;
export const DRAW_KEY = "varath-drawdist";
export function readDrawDist(): number {
  const raw = Number(readPref(DRAW_KEY));
  return Number.isFinite(raw) && raw >= DRAW_MIN && raw < DRAW_MAX ? raw : Infinity;
}

// Floor-loot name labels (OSRS-style). On by default.
export const LOOT_KEY = "varath-loot-labels";
export function readLootLabels(): boolean {
  return readPref(LOOT_KEY) !== "0";
}

/** Performance mode (lower resolution cap, fewer effects). Off by default. */
export const PERF_KEY = "varath-perf";
export function readPerfMode(): boolean {
  return readPref(PERF_KEY) === "1";
}

/** Interface-size (accessibility) scale, persisted per device. */
export const UI_SCALE_KEY = "varath_ui_scale";
export function readUiScale(): number {
  const v = Number(readPref(UI_SCALE_KEY));
  return Number.isFinite(v) && v >= 0.85 && v <= 1.4 ? v : 1;
}

export const BRIGHT_KEY = "varath-brightness";
export function readBrightness(): number {
  const v = Number(readPref(BRIGHT_KEY));
  return Number.isFinite(v) && v >= 0.6 && v <= 2 ? v : 1;
}

/** Whether the game log is collapsed. Open by default. */
export const LOG_MIN_KEY = "varath-log-min";
export function readLogMinimized(): boolean {
  return readPref(LOG_MIN_KEY) === "1";
}
