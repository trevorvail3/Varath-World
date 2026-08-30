/**
 * sims/zones.ts
 * -------------
 * Checks the eight wild zones.
 *
 *   npx tsx sims/zones.ts
 *
 * A zone is a place you go to train, so the thing worth asserting is that it is
 * worth the walk and pitched where it stands: a real population, gatherables you
 * would stop for, and foes near its own band. A theme whose pool has nothing at
 * a zone's level silently produces a place of the wrong difficulty — which is
 * exactly what one of these did. Exits non-zero on failure.
 */

import { content, makeWorld, SimClock } from "./harness.ts";
import { buildWalkability } from "../src/core/worldCore.ts";
import { ZONES, zoneBand } from "../src/content/zones.ts";
import { CAMPS } from "../src/content/camps.ts";
import { TOWNS } from "../src/content/towns.ts";
import { CITY, OVERWORLD_HEIGHT, REGIONS, spread, fromV2 } from "../src/content/map.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

check(ZONES.length === 8, `${ZONES.length} zones, expected eight`);
const st = makeWorld(new SimClock(1));
const walk = buildWalkability(content, st);
const { map } = content;
const BAD = new Set(["water", "deep", "mountain", "cave_wall", "wall"]);

const ids = new Set<string>();
for (const z of ZONES) {
  check(!ids.has(z.id), `duplicate zone id ${z.id}`);
  ids.add(z.id);
  const c = spread(z.vx, z.vy);
  const band = zoneBand(z.vx, z.vy);
  const mine = content.objects.filter((o) => o.id.startsWith(`${z.id}_`));

  // --- Worth the walk ---
  const foes = mine.filter((o) => o.kind === "monster");
  const nodes = mine.filter((o) => !!o.resource);
  check(foes.length >= 10, `${z.name} holds ${foes.length} foes — not a place you can train`);
  check(nodes.length >= 5, `${z.name} offers ${nodes.length} gatherables`);
  check(mine.some((o) => o.kind === "signpost"), `${z.name} has no marker naming it`);

  // --- Pitched where it stands ---
  for (const o of foes) {
    const lvl = content.monsters[o.monster!]?.level ?? 0;
    check(
      Math.abs(lvl - band) <= 20,
      `${z.name} (band ${band}) holds ${o.monster} at level ${lvl} — its theme has nothing near that band`,
    );
  }
  for (const o of nodes) {
    const act = (content.actions as { id: string; levelReq?: number }[]).find((a) => a.id === o.resource);
    check(!!act, `${z.name} has a node for unknown action "${o.resource}"`);
    const req = act?.levelReq ?? 1;
    check(Math.abs(req - band) <= 30, `${z.name} (band ${band}) offers ${o.resource} at level ${req}`);
  }

  // --- Standing on ground, and reachable ---
  for (const o of mine) {
    const tile = map.tiles[o.y * map.width + o.x];
    check(!BAD.has(tile ?? ""), `${o.id} stands on ${tile} at ${o.x},${o.y}`);
    const beside = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).some(([dx, dy]) => walk(o.x + dx, o.y + dy));
    check(beside, `${o.id} at ${o.x},${o.y} has no walkable tile beside it`);
  }

  // --- Ungated: nothing here may need a flag to appear ---
  check(mine.every((o) => !o.requiresFlag), `${z.name} has gated content — a zone is meant to be walk-in`);

  // --- Clear of everything else ---
  check(
    c.x - z.r > 0 && c.y - z.r > 0 && c.x + z.r < map.width && c.y + z.r < OVERWORLD_HEIGHT,
    `${z.name} runs off the canvas`,
  );
  const overCity = c.x + z.r >= CITY.x0 - 8 && c.x - z.r <= CITY.x1 + 8 && c.y + z.r >= CITY.y0 - 8 && c.y - z.r <= CITY.y1 + 8;
  check(!overCity, `${z.name} sits on Ironvale's doorstep`);
  for (const r of REGIONS) {
    const over = c.x + z.r >= r.nx && c.x - z.r <= r.nx + r.w && c.y + z.r >= r.ny && c.y - z.r <= r.ny + r.h;
    check(!over, `${z.name} overlaps region "${r.key}" — its ground would overwrite that terrain`);
  }
  for (const t of TOWNS) {
    const tc = fromV2(t.vx, t.vy);
    check(Math.hypot(c.x - tc.x, c.y - tc.y) > z.r + 14, `${z.name} overlaps the town of ${t.name}`);
  }
  for (const cp of CAMPS) {
    const cc = spread(cp.vx, cp.vy);
    check(Math.hypot(c.x - cc.x, c.y - cc.y) > z.r + cp.rx + 4, `${z.name} overlaps ${cp.name}`);
  }
}
for (let i = 0; i < ZONES.length; i++) {
  for (let j = i + 1; j < ZONES.length; j++) {
    const a = spread(ZONES[i]!.vx, ZONES[i]!.vy), b = spread(ZONES[j]!.vx, ZONES[j]!.vy);
    check(Math.hypot(a.x - b.x, a.y - b.y) > ZONES[i]!.r + ZONES[j]!.r + 6, `${ZONES[i]!.name} overlaps ${ZONES[j]!.name}`);
  }
}

// --- Difficulty rises with distance ----------------------------------------
const rows = ZONES.map((z) => ({ d: Math.hypot(z.vx - 81.5, z.vy - 78.5), band: zoneBand(z.vx, z.vy) }));
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const md = mean(rows.map((r) => r.d)), mb = mean(rows.map((r) => r.band));
const corr = mean(rows.map((r) => (r.d - md) * (r.band - mb)))
  / (Math.sqrt(mean(rows.map((r) => (r.d - md) ** 2))) * Math.sqrt(mean(rows.map((r) => (r.band - mb) ** 2))));
check(corr > 0.9, `zone bands do not track distance (r=${corr.toFixed(2)})`);

const bands = ZONES.map((z) => zoneBand(z.vx, z.vy));
console.log(`zones ${ZONES.length} · objects ${content.objects.filter((o) => o.id.startsWith("zone_")).length} · bands ${Math.min(...bands)}–${Math.max(...bands)}`);
if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails.slice(0, 12)) console.error("  - " + f);
  if (fails.length > 12) console.error(`  … and ${fails.length - 12} more`);
  process.exit(1);
}
console.log("\nPASS");
