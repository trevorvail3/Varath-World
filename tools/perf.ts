/**
 * tools/perf.ts
 * -------------
 * What a painted frame costs, per scene, in headless Chromium.
 *
 * The visual pass adds drawing to nearly the whole map, and "does it still feel
 * smooth?" is not a number. This turns the in-game frame-time readout into one:
 * it visits a handful of scenes, lets the rolling mean settle, and prints the
 * milliseconds. Run it before and after a change and compare.
 *
 *   npx tsx tools/perf.ts          → normal mode
 *   npx tsx tools/perf.ts --perf   → performance mode
 */

import { spawn, type ChildProcess } from "node:child_process";
import { chromium } from "playwright";

const CHROME = process.env["PW_CHROME"] ?? "/opt/pw-browsers/chromium";
const PORT = 4174;
const URL_BASE = `http://127.0.0.1:${PORT}`;
const PERF = process.argv.includes("--perf");

const STOPS: [string, number, number][] = [
  ["city", 193, 199],
  ["farmland", 160, 163],
  ["hills", 95, 245],
  ["wild", 330, 330],
  ["coast", 282, 250],
  ["region-marrow", 287, 49],
];

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

async function main(): Promise<void> {
  const srv = await startServer();
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  // Turn the readout on, and performance mode with it when asked, before boot.
  await ctx.addInitScript(`(() => {
    try {
      localStorage.setItem("varath-frame-meter", "1");
      localStorage.setItem("varath-perf", ${PERF ? '"1"' : '"0"'});
    } catch { /* ignore */ }
  })();`);
  const page = await ctx.newPage();
  await page.goto(`${URL_BASE}/?test=1`, { waitUntil: "load" });
  await page.waitForFunction("!!window.__varath", null, { timeout: 30_000 });
  await page.waitForTimeout(1500);

  console.log(`frame cost — ${PERF ? "performance mode" : "normal"} (1280x800)`);
  for (const [label, x, y] of STOPS) {
    await page.evaluate(([tx, ty]) => (window as never as {
      __varath: { teleport(a: number, b: number): void };
    }).__varath.teleport(tx as number, ty as number), [x, y]);
    await page.waitForTimeout(2600); // let the chunk cache fill and the mean settle
    const text = await page.textContent(".frame-meter");
    console.log(`  ${label.padEnd(14)} ${text ?? "(no readout)"}`);
  }
  await browser.close();
  srv.kill("SIGTERM");
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
