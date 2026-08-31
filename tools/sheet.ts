/**
 * tools/sheet.ts
 * --------------
 * The contact sheet: the player figure drawn large, in every hair style, every
 * facing, every build and a handful of gear loadouts, on one page.
 *
 * The world shots show the character 31 pixels tall from above, which is the
 * one view in which you cannot tell whether two hair styles are the same cap or
 * whether walking north and walking east draw the same body. This is the view
 * that answers that.
 *
 *   npx tsx tools/sheet.ts                → shots/current/sheet-*.png
 *   npx tsx tools/sheet.ts --out baseline → shots/baseline/sheet-*.png
 *
 * The layout lives here rather than in the game: the page only has to hand over
 * the art module, which `?test=1` does via `window.__varathArt`.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const CHROME = process.env["PW_CHROME"] ?? "/opt/pw-browsers/chromium";
const PORT = 4175;
const URL_BASE = `http://127.0.0.1:${PORT}`;

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = join("shots", outIdx >= 0 ? args[outIdx + 1] ?? "current" : "current");
/** `--zoom 3` draws every cell three times the size — for looking closely at a
 *  silhouette rather than comparing a whole row of them. */
const zoomIdx = args.indexOf("--zoom");
const ZOOM = zoomIdx >= 0 ? Math.max(1, Number(args[zoomIdx + 1] ?? 1)) : 1;
/** `--only facings` writes just that sheet. */
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] ?? "" : "";

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

/**
 * Draw one sheet inside the page and return it as a PNG data URL.
 *
 * `spec` names which axis is being varied. Everything runs in the browser, so
 * the figure is drawn by exactly the code the game uses — not a copy.
 */
const SHEET = `(spec) => {
  const A = window.__varathArt;
  const Z = spec.zoom ?? 1;
  const CELL = 132 * Z, PAD = 26, LABEL = 18;
  const cells = spec.cells;
  const cols = Math.min(spec.cols ?? 8, cells.length);
  const rows = Math.ceil(cells.length / cols);
  const c = document.createElement("canvas");
  c.width = cols * CELL;
  c.height = rows * (CELL + LABEL) + PAD;
  const g = c.getContext("2d");

  // A flat ground the figure reads against — deliberately mid-value, so both a
  // pale and a dark character are legible on the same page.
  g.fillStyle = "#2b2f2a";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#e6dfcc";
  g.font = "600 15px system-ui, sans-serif";
  g.fillText(spec.title, 10, 18);

  cells.forEach((cell, i) => {
    const cx = (i % cols) * CELL + CELL / 2;
    const cy = Math.floor(i / cols) * (CELL + LABEL) + PAD + CELL / 2;
    g.strokeStyle = "rgba(255,255,255,0.07)";
    g.strokeRect((i % cols) * CELL + 0.5, Math.floor(i / cols) * (CELL + LABEL) + PAD + 0.5, CELL - 1, CELL - 1);
    A.drawAvatar(
      g, cx, cy + 6 * Z, 3.2 * Z,
      A.withDefaults(cell.look),
      { now: spec.now ?? 0, moving: !!spec.moving, ...(cell.facing ? { facing: cell.facing } : {}) },
      cell.gear ?? {},
    );
    g.fillStyle = "#b9b09a";
    g.font = "12px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText(cell.label, cx, Math.floor(i / cols) * (CELL + LABEL) + PAD + CELL + 13);
    g.textAlign = "left";
  });
  return c.toDataURL("image/png");
}`;

async function sheet(page: Page, name: string, spec: Record<string, unknown>): Promise<void> {
  if (ONLY && !name.includes(ONLY)) return;
  const url = await page.evaluate(`(${SHEET})(${JSON.stringify({ ...spec, zoom: ZOOM })})`) as string;
  const buf = Buffer.from(url.split(",")[1] ?? "", "base64");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(OUT, `sheet-${name}.png`), buf);
  console.log("  ✓", name);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const srv = await startServer();
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("  page error:", e.message));
  await page.goto(`${URL_BASE}/?test=1`, { waitUntil: "load" });
  await page.waitForFunction("!!window.__varathArt", null, { timeout: 30_000 });

  // Build the cell lists in the page, where the style tables live.
  const specs = await page.evaluate(`(() => {
    const A = window.__varathArt;
    const D = A.DEFAULT_APPEARANCE;
    const FACINGS = ["down", "left", "up", "right"];
    const mk = (over, label, extra) => ({ look: { ...D, ...over }, label, ...(extra ?? {}) });

    // Every hair style, front on — the sheet that shows styles collapsing.
    const hair = A.HAIR_STYLES.map((h) => mk({ hairStyle: h.id }, h.label, { facing: "down" }));
    // Every hair style from behind — where four of them used to be one circle.
    const hairBack = A.HAIR_STYLES.map((h) => mk({ hairStyle: h.id }, h.label, { facing: "up" }));
    // Every beard.
    const beards = A.FACIAL_STYLES.map((f) => mk({ facial: f.id }, f.label, { facing: "down" }));
    // One character, all four facings — the sheet that shows the figure turning.
    const facings = FACINGS.map((f) => mk({}, f, { facing: f }));
    // Every build in every facing, and every height beside them.
    const builds = [];
    for (const b of A.BUILD_STYLES) {
      for (const f of ["down", "right"]) {
        builds.push(mk(b.id === "average" ? {} : { build: b.id }, b.label + " · " + f, { facing: f }));
      }
    }
    for (const ht of A.HEIGHT_STYLES) {
      for (const f of ["down", "right"]) {
        builds.push(mk(ht.id === "average" ? {} : { height: ht.id }, ht.label + " · " + f, { facing: f }));
      }
    }
    // Clothes: every top, leg and shoe style.
    const clothes = [
      ...A.TOP_STYLES.map((t) => mk({ top: t.id }, "top " + t.label, { facing: "down" })),
      ...A.LEG_STYLES.map((t) => mk({ legs: t.id }, "legs " + t.label, { facing: "down" })),
      ...A.SHOE_STYLES.map((t) => mk({ shoes: t.id }, "shoes " + t.label, { facing: "down" })),
    ];
    // Markings, each over a face so the placement can be judged.
    const markings = [
      ...A.MARKING_STYLES.map((m) => mk({ marking: m.id }, m.label, { facing: "down" })),
      ...A.MARKING_COLORS.map((c, i) => mk({ marking: "warpaint_bar", markingColor: c }, "paint " + i, { facing: "down" })),
    ];
    // The face, which the figure did not have: every eye, brow and jaw.
    const faces = [
      ...A.EYE_STYLES.map((e) => mk({ eyes: e.id }, "eyes " + e.label, { facing: "down" })),
      ...A.BROW_STYLES.map((b) => mk({ brows: b.id }, "brow " + b.label, { facing: "down" })),
      ...A.JAW_STYLES.map((j) => mk({ jaw: j.id }, "jaw " + j.label, { facing: "down" })),
      ...A.EYES.map((c, i) => mk({ eyeColor: c }, "iris " + i, { facing: "down" })),
    ];
    // The skin and hair palettes, so a new ramp can be judged as a ramp.
    const palette = [
      ...A.SKINS.map((c, i) => mk({ skin: c }, "skin " + i, { facing: "down" })),
      ...A.HAIRS.map((c, i) => mk({ hair: c }, "hair " + i, { facing: "down" })),
    ];
    return { hair, hairBack, beards, facings, builds, clothes, palette, faces, markings };
  })()`) as Record<string, unknown[]>;

  // Gear needs real items, so it is built from the content tables.
  const gear = await page.evaluate(`(() => {
    const A = window.__varathArt;
    const D = A.DEFAULT_APPEARANCE;
    const items = A.content.items;
    const wanted = [
      ["nothing", {}],
      ["plate", { helmet: "helm_6", armor: "body_6", legs: "legs_6", boots: "boots_6", offhand: "shield_6" }],
      ["leather", { armor: "leather_body_3", legs: "leather_legs_3", boots: "leather_boots_3" }],
      ["robe", { helmet: "wizard_hat", armor: "robe_top_3", legs: "robe_legs_3" }],
      ["sword", { mainhand: "sword_6" }],
      ["bow", { mainhand: "longbow" }],
      ["staff", { mainhand: "staff_greyoak" }],
      ["cape", { cape: "cape_founder" }],
    ];
    // The three offhands and the three boots, which used to be one shape each.
    const kitRows = [
      ["boot plate", { boots: "boot_5" }],
      ["boot leather", { boots: "cured_boots" }],
      ["boot robe", { boots: "mag_boots_2" }],
      ["kite shield", { offhand: "shield_6" }],
      ["buckler", { offhand: "watchmans_buckler" }],
      ["lantern", { offhand: "delvers_lantern" }],
    ];
    // A weapon ladder: a caster's and an archer's progression were invisible.
    const tierRows = [
      ["bow t1", { mainhand: "crude_shortbow" }],
      ["bow t5", { mainhand: "greyoak_longbow" }],
      ["bow t10", { mainhand: "ascendant_bow" }],
      ["staff t1", { mainhand: "staff_ashwood" }],
      ["staff t5", { mainhand: "staff_greyoak" }],
      ["staff t10", { mainhand: "ascendant_staff" }],
    ];
    const clean = (eq) => {
      const out = {};
      for (const k of Object.keys(eq)) if (items[eq[k]]) out[k] = eq[k];
      return out;
    };
    const cells = [];
    for (const [label, eq] of wanted) {
      for (const f of ["down", "left", "up", "right"]) {
        cells.push({ look: { ...D }, label: label + " · " + f, facing: f, gear: A.resolveGear(clean(eq), A.content) });
      }
    }
    const kit = [];
    for (const [label, eq] of [...kitRows, ...tierRows]) {
      const resolved = A.resolveGear(clean(eq), A.content);
      const missing = Object.keys(eq).length > 0 && Object.keys(clean(eq)).length === 0;
      kit.push({ look: { ...D }, label: missing ? label + " (no item)" : label, facing: "down", gear: resolved });
    }
    return { cells, kit };
  })()`) as { cells: unknown[]; kit: unknown[] };

  console.log(`contact sheets → ${OUT}/`);
  const now = 4200; // a fixed clock: mid-stride, so the walk pose is comparable
  await sheet(page, "facings", { title: "One character, four facings", cells: specs["facings"], cols: 4, now });
  await sheet(page, "hair-front", { title: "Hair styles — front", cells: specs["hair"], cols: 5, now });
  await sheet(page, "hair-back", { title: "Hair styles — back", cells: specs["hairBack"], cols: 5, now });
  await sheet(page, "beards", { title: "Facial hair", cells: specs["beards"], cols: 5, now });
  await sheet(page, "builds", { title: "Builds and heights", cells: specs["builds"], cols: 4, now });
  await sheet(page, "clothes", { title: "Tops, legs, shoes", cells: specs["clothes"], cols: 5, now });
  await sheet(page, "markings", { title: "Scars, paint and ink", cells: specs["markings"], cols: 5, now });
  await sheet(page, "faces", { title: "Eyes, brows, jaws and irises", cells: specs["faces"], cols: 5, now });
  await sheet(page, "palette", { title: "Skin and hair palettes", cells: specs["palette"], cols: 7, now });
  await sheet(page, "gear", { title: "Worn gear × facings", cells: gear.cells, cols: 4, now });
  await sheet(page, "kit", { title: "Boots, offhands and weapon tiers", cells: gear.kit, cols: 6, now });
  await sheet(page, "walk", { title: "Walk cycle", cells: specs["facings"], cols: 4, now, moving: true });

  await browser.close();
  srv.kill("SIGTERM");
  console.log(`\nsheets written to ${OUT}/`);
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
