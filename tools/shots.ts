/**
 * tools/shots.ts
 * --------------
 * The eye. Boots the built game in headless Chromium, drives a fixed tour of
 * the world at four times of day plus the interface panels, and writes a PNG
 * per stop.
 *
 * This exists because a visual pass cannot be verified by a type-checker or a
 * sim. The shots are the record: capture a set before a change, capture another
 * after, and the difference is the thing being reviewed.
 *
 *   npx tsx tools/shots.ts               → shots/current/
 *   npx tsx tools/shots.ts --out baseline → shots/baseline/
 *   npx tsx tools/shots.ts --only city    → just the stops matching "city"
 *
 * The game's `?test=1` seam does the rest: it skips the sign-in gate and the
 * opening cinematics, and hands us `window.__varath` to teleport with.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

// The pre-installed browser in this environment is not the build Playwright
// would download for itself, so point at it rather than fetching another.
const CHROME = process.env["PW_CHROME"] ?? "/opt/pw-browsers/chromium";
const PORT = 4173;
const URL_BASE = `http://127.0.0.1:${PORT}`;

/** One turn of the world clock is 7 minutes (core's DAY_CYCLE_MS), and the
 *  phase is `epoch % cycle`, so a fixed epoch pins a fixed hour. */
const DAY_CYCLE_MS = 420_000;
const HOURS: { label: string; phase: number }[] = [
  { label: "dawn", phase: 0.25 },
  { label: "noon", phase: 0.5 },
  { label: "dusk", phase: 0.78 },
  { label: "night", phase: 0.02 },
];

/** The tour. Coordinates are world tiles, derived from the content tables
 *  (`fromV2` of each town/camp/zone anchor) rather than eyeballed, so they stay
 *  pointed at the right thing if the map moves again. */
const STOPS: { label: string; x: number; y: number; hours?: string[] }[] = [
  { label: "spawn", x: 160, y: 163 },
  { label: "city", x: 193, y: 199 },
  { label: "town-frostgate", x: 127, y: 51 },
  { label: "town-emberhearth", x: 179, y: 333 },
  { label: "camp-crossroads", x: 154, y: 161 },
  { label: "zone-greyhollow", x: 276, y: 283 },
  { label: "region-marrow", x: 287, y: 49 },
  { label: "region-heartmoor", x: 23, y: 320 },
  { label: "hills-open", x: 95, y: 245 },
  { label: "hills-far", x: 330, y: 330 },
  { label: "shore", x: 282, y: 250 },
  { label: "mountain", x: 56, y: 25, hours: ["noon", "dusk"] }, // a cliff edge
  { label: "cave", x: 50, y: 521, hours: ["noon"] }, // underground: one hour is enough
];

const args = process.argv.slice(2);
const outName = argAfter("--out") ?? "current";
const only = argAfter("--only");
const OUT = join("shots", outName);

function argAfter(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function wanted(label: string): boolean {
  return !only || label.includes(only);
}

/** Boot `vite preview` and wait until it actually serves, rather than sleeping
 *  a hopeful number of seconds. */
async function startServer(): Promise<ChildProcess> {
  const srv = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("vite preview never came up");
    try {
      const res = await fetch(URL_BASE, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return srv;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** A page with the world clock pinned to one hour, booted through the test seam
 *  and waiting until the game has actually painted a frame. */
async function openWorld(browser: Browser, phase: number, w: number, h: number): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    reducedMotion: "reduce", // stills the UI's fades so a shot is not a coin-flip
  });
  // Pin the clock: keep real elapsed time (so timers still advance) but start
  // the epoch at the hour we want.
  await ctx.addInitScript(`(() => {
    const base = ${Math.round(phase * DAY_CYCLE_MS)};
    const t0 = Date.now();
    const real = Date.now;
    Date.now = () => base + (real() - t0);
  })();`);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("  page error:", e.message));
  await page.goto(`${URL_BASE}/?test=1`, { waitUntil: "load" });
  await page.waitForFunction("!!window.__varath", null, { timeout: 30_000 });
  await page.waitForTimeout(900); // let the chunk cache fill and the HUD settle
  return page;
}

/** Teleport, let the world catch up, and shoot. */
async function shoot(page: Page, label: string, x?: number, y?: number): Promise<void> {
  if (x !== undefined && y !== undefined) {
    await page.evaluate(([tx, ty]) => (window as never as {
      __varath: { teleport(a: number, b: number): void };
    }).__varath.teleport(tx as number, ty as number), [x, y]);
    await page.waitForTimeout(700); // chunks repaint, creatures settle
  }
  await page.screenshot({ path: join(OUT, `${label}.png`) });
  console.log("  ✓", label);
}

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const srv = await startServer();
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    // --- The world, four times over. ---
    for (const hour of HOURS) {
      const stops = STOPS.filter(
        (s) => (!s.hours || s.hours.includes(hour.label)) && wanted(`${s.label}-${hour.label}`),
      );
      if (stops.length === 0) continue;
      console.log(`clock: ${hour.label}`);
      const page = await openWorld(browser, hour.phase, 1280, 800);
      for (const s of stops) await shoot(page, `${s.label}-${hour.label}`, s.x, s.y);
      await page.context().close();
    }

    // --- The character creator, which the automated boot normally walks past. ---
    for (const [device, w, h] of [["desktop", 1280, 800], ["phone", 390, 844]] as const) {
      if (!wanted(`creator-${device}`)) continue;
      console.log(`creator: ${device}`);
      const ctx = await browser.newContext({
        viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      await page.goto(`${URL_BASE}/?test=creator`, { waitUntil: "load" });
      await page.waitForSelector(".creator-box", { timeout: 30_000 });
      await page.waitForTimeout(700);
      await shoot(page, `creator-${device}`);
      await ctx.close();
    }

    // --- The interface: every dock tab, on desktop and on a phone. ---
    for (const [device, w, h] of [["desktop", 1280, 800], ["phone", 390, 844]] as const) {
      if (!wanted(`ui-${device}`)) continue;
      console.log(`interface: ${device}`);
      const page = await openWorld(browser, 0.5, w, h);
      const tabs = await page.$$(".dock-tab");
      for (let i = 0; i < tabs.length; i++) {
        const name = (await tabs[i]!.getAttribute("title")) ?? String(i);
        await tabs[i]!.click();
        await page.waitForTimeout(350);
        await shoot(page, `ui-${device}-${name.toLowerCase().replace(/\W+/g, "-")}`);
      }
      await page.context().close();
    }
  } finally {
    await browser.close();
    srv.kill("SIGTERM");
  }
  console.log(`\nshots written to ${OUT}/`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
