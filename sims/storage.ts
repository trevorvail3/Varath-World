/**
 * sims/storage.ts
 * ---------------
 * Checks that the game can boot when the browser blocks site storage.
 *
 *   npx tsx sims/storage.ts
 *
 * With "Block all cookies" (and in some in-app webviews) merely touching
 * `localStorage` throws a SecurityError. The display preferences read while the
 * Game and the Hud are built must fall back to their defaults instead, or the
 * player gets a blank page. This sim:
 *   1. makes `localStorage` throw on access and calls every boot-path reader;
 *   2. gives them a working store and checks saved values still come back
 *      (no behaviour change when storage works);
 *   3. scans loop.ts, hud.ts and prefs.ts for a `localStorage.getItem` that is
 *      not on a guarded line, so the bug cannot quietly come back.
 * Exits non-zero on failure.
 */

import { readFileSync } from "node:fs";
import { readPref } from "../src/client/storage.ts";
import {
  BRIGHT_KEY, DRAW_KEY, LOG_MIN_KEY, LOOT_KEY, PERF_KEY, UI_SCALE_KEY, ZOOM_KEY,
  readBrightness, readDrawDist, readLogMinimized, readLootLabels, readPerfMode, readUiScale, readZoom,
} from "../src/client/prefs.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

function setStorage(get: () => unknown): void {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get });
}

/** Run a reader; record a failure if it throws, otherwise return its value. */
function safe<T>(name: string, fn: () => T): T | undefined {
  try { return fn(); } catch (e) { fails.push(`${name} threw with storage blocked: ${String(e)}`); return undefined; }
}

// --- 1. Storage blocked: touching localStorage throws. --------------------------
{
  setStorage(() => { throw new Error("SecurityError: The operation is insecure."); });
  check(safe("readPref", () => readPref(ZOOM_KEY)) === null, "readPref should give null when storage is blocked");
  check(safe("readZoom", readZoom) === 1, "zoom should default to 1");
  check(safe("readDrawDist", readDrawDist) === Infinity, "draw distance should default to unlimited");
  check(safe("readLootLabels", readLootLabels) === true, "loot labels should default to on");
  check(safe("readPerfMode", readPerfMode) === false, "performance mode should default to off");
  check(safe("readUiScale", readUiScale) === 1, "interface size should default to 1");
  check(safe("readBrightness", readBrightness) === 1, "brightness should default to 1");
  check(safe("readLogMinimized", readLogMinimized) === false, "the log should default to open");

  // A getItem that throws (a storage object present but denied) is covered too.
  setStorage(() => ({ getItem: () => { throw new Error("SecurityError"); } }));
  check(safe("readZoom (getItem throws)", readZoom) === 1, "zoom should default to 1 when getItem throws");
}

// --- 2. Storage works: saved values still come back. ----------------------------
{
  const store = new Map<string, string>([
    [ZOOM_KEY, "1.5"], [DRAW_KEY, "20"], [LOOT_KEY, "0"], [PERF_KEY, "1"],
    [UI_SCALE_KEY, "1.2"], [BRIGHT_KEY, "1.4"], [LOG_MIN_KEY, "1"],
  ]);
  setStorage(() => ({ getItem: (k: string) => store.get(k) ?? null }));
  check(readZoom() === 1.5, `saved zoom lost: ${readZoom()}`);
  check(readDrawDist() === 20, `saved draw distance lost: ${readDrawDist()}`);
  check(readLootLabels() === false, "saved loot-labels-off lost");
  check(readPerfMode() === true, "saved performance mode lost");
  check(readUiScale() === 1.2, `saved interface size lost: ${readUiScale()}`);
  check(readBrightness() === 1.4, `saved brightness lost: ${readBrightness()}`);
  check(readLogMinimized() === true, "saved minimized log lost");

  // Out-of-range values still fall back to the defaults, as before.
  store.set(ZOOM_KEY, "99"); store.set(DRAW_KEY, "40"); store.set(UI_SCALE_KEY, "5"); store.set(BRIGHT_KEY, "0.1");
  check(readZoom() === 2.4, `zoom should clamp to 2.4, got ${readZoom()}`);
  check(readDrawDist() === Infinity, "draw distance at the max should mean unlimited");
  check(readUiScale() === 1, "an out-of-range interface size should fall back to 1");
  check(readBrightness() === 1, "an out-of-range brightness should fall back to 1");

  // Nothing saved yet: the defaults.
  store.clear();
  check(readZoom() === 1 && readDrawDist() === Infinity && readLootLabels() && !readPerfMode()
    && readUiScale() === 1 && readBrightness() === 1 && !readLogMinimized(), "fresh-device defaults changed");
}

// --- 3. No unguarded read left on the boot path. --------------------------------
for (const file of ["src/client/loop.ts", "src/client/hud.ts", "src/client/prefs.ts"]) {
  const lines = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes("localStorage.getItem") && !/\btry\b/.test(line)) {
      fails.push(`${file}:${i + 1} reads localStorage without a guard — use readPref`);
    }
  });
}

if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("storage blocked: every boot-path preference falls back to its default\nOK");
export {};
