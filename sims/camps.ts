/**
 * sims/camps.ts
 * -------------
 * Checks the camps of the open country.
 *
 *   npx tsx sims/camps.ts
 *
 * The camp table is compact and the objects are generated from it, which is what
 * keeps 200-odd spawns maintainable — and also what makes a typo invisible. A
 * monster id that does not exist spawns nothing and logs nothing; a camp placed
 * inside a region quietly overwrites that region's terrain; two camps on the
 * same ground interleave into one confusing mess. None of that throws.
 * Exits non-zero on failure.
 */

import { content, makeWorld, SimClock } from "./harness.ts";
import { buildWalkability } from "../src/core/worldCore.ts";
import { CAMPS, buildCampObjects, campBand } from "../src/content/camps.ts";
import { CITY, OVERWORLD_HEIGHT, REGIONS, spread } from "../src/content/map.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

check(CAMPS.length >= 14, `only ${CAMPS.length} camps — the open country needs filling`);
const built = buildCampObjects(spread);

// --- The table refers to things that exist ---------------------------------
const ids = new Set<string>();
for (const c of CAMPS) {
  check(!ids.has(c.id), `duplicate camp id ${c.id}`);
  ids.add(c.id);
  check(c.name.trim().length > 0 && c.blurb.trim().length > 0, `${c.id} has no name or blurb`);
  check(!!c.theme, `${c.id} has no theme`);
  check(c.nodes.length > 0, `${c.id} offers nothing to gather`);
  // Whatever the theme pool offers must actually land near the derived band,
  // or a theme with no members at that level silently produces a camp of the
  // wrong difficulty.
  const band = campBand(c.vx, c.vy);
  const spawned = built.filter((o) => o.kind === "monster" && o.id.startsWith(`${c.id}_m`));
  check(spawned.length === 4, `${c.id} spawned ${spawned.length} foes, expected 4`);
  for (const o of spawned) {
    const lvl = content.monsters[o.monster!]?.level ?? 0;
    check(
      Math.abs(lvl - band) <= 22,
      `${c.id} (band ${band}) holds ${o.monster} at level ${lvl} — its theme has nothing near that band`,
    );
  }
  // The gatherables must be worth stopping for at the level the camp is pitched
  // at, for the same reason: a level-1 birch beside a level-63 harpy is scenery.
  const nodes = built.filter((o) => o.id.startsWith(`${c.id}_n`));
  check(nodes.length === c.nodes.length, `${c.id} placed ${nodes.length} nodes, expected ${c.nodes.length}`);
  for (const o of nodes) {
    const act = (content.actions as { id: string; levelReq?: number }[]).find((a) => a.id === o.resource);
    check(!!act, `${c.id} has a node for unknown action "${o.resource}"`);
    const req = act?.levelReq ?? 1;
    check(
      Math.abs(req - band) <= 30,
      `${c.id} (band ${band}) offers ${o.resource} at level ${req} — too far off to be worth stopping for`,
    );
  }
}

// --- Camps sit in the OPEN COUNTRY, not on top of something else -----------
for (const c of CAMPS) {
  const at = spread(c.vx, c.vy);
  const r = Math.max(c.rx, c.ry) + 3;
  check(
    at.x - r > 0 && at.y - r > 0 && at.x + r < content.map.width && at.y + r < OVERWORLD_HEIGHT,
    `${c.id} is off the canvas at ${at.x},${at.y}`,
  );
  const overCity = at.x + r >= CITY.x0 - 8 && at.x - r <= CITY.x1 + 8 && at.y + r >= CITY.y0 - 8 && at.y - r <= CITY.y1 + 8;
  check(!overCity, `${c.id} is pitched on Ironvale's doorstep`);
  for (const reg of REGIONS) {
    const over = at.x + r >= reg.nx && at.x - r <= reg.nx + reg.w && at.y + r >= reg.ny && at.y - r <= reg.ny + reg.h;
    check(!over, `${c.id} overlaps region "${reg.key}" — its clearing would overwrite that terrain`);
  }
}
for (let i = 0; i < CAMPS.length; i++) {
  for (let j = i + 1; j < CAMPS.length; j++) {
    const a = spread(CAMPS[i]!.vx, CAMPS[i]!.vy), b = spread(CAMPS[j]!.vx, CAMPS[j]!.vy);
    const need = CAMPS[i]!.rx + CAMPS[j]!.rx + 10;
    const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    check(d >= need, `${CAMPS[i]!.id} and ${CAMPS[j]!.id} are ${d} tiles apart, closer than ${need}`);
  }
}

// --- Every generated object stands on ground it can stand on ---------------
check(built.length >= CAMPS.length * 8, `only ${built.length} camp objects for ${CAMPS.length} camps`);
const st = makeWorld(new SimClock(1));
const walk = buildWalkability(content, st);
const { map } = content;
const BAD = new Set(["water", "deep", "mountain", "cave_wall", "wall"]);
for (const o of built) {
  const tile = map.tiles[o.y * map.width + o.x];
  check(!BAD.has(tile ?? ""), `${o.id} stands on ${tile} at ${o.x},${o.y}`);
  // Its own tile is usually blocking (that is what a tree is), so the test is
  // whether a player can reach it — the same question sims/world.ts asks.
  const beside = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][])
    .some(([dx, dy]) => walk(o.x + dx, o.y + dy));
  check(beside, `${o.id} at ${o.x},${o.y} has no walkable tile beside it`);
}
const builtIds = new Set(built.map((o) => o.id));
check(builtIds.size === built.length, "two camp objects share an id");
// …and none of those ids collides with a hand-authored spawn.
const hand = new Set(content.objects.map((o) => o.id));
check(hand.size === content.objects.length, "a camp object id collides with a hand-authored spawn");

// --- The gradient is real ---------------------------------------------------
// The point of the bands is that the country gets harder the further out you
// go. Measured as a correlation between distance from the city gate and band.
const centre = { x: (CITY.x0 + CITY.x1) / 2, y: (CITY.y0 + CITY.y1) / 2 };
const rows = CAMPS.map((c) => {
  const at = spread(c.vx, c.vy);
  return { d: Math.hypot(at.x - centre.x, at.y - centre.y), band: campBand(c.vx, c.vy) };
});
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const md = mean(rows.map((r) => r.d)), mb = mean(rows.map((r) => r.band));
const cov = mean(rows.map((r) => (r.d - md) * (r.band - mb)));
const sd = Math.sqrt(mean(rows.map((r) => (r.d - md) ** 2)));
const sb = Math.sqrt(mean(rows.map((r) => (r.band - mb) ** 2)));
const corr = cov / (sd * sb);
check(corr > 0.5, `bands barely track distance from the city (r=${corr.toFixed(2)}) — the open country has no gradient`);

const bands = CAMPS.map((c) => campBand(c.vx, c.vy));
console.log(`camps ${CAMPS.length} · objects ${built.length} · bands ${Math.min(...bands)}–${Math.max(...bands)}`);
console.log(`difficulty rises with distance: r=${corr.toFixed(2)}`);
if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("\nPASS");
