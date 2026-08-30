/**
 * sims/world.ts
 * -------------
 * Checks the WORLD ITSELF: that every place in Varath can actually be reached,
 * and that everything standing in it is standing somewhere sane.
 *
 *   npx tsx sims/world.ts            # print the survey
 *   npx tsx sims/world.ts --json     # emit the fixture
 *   npx tsx sims/world.ts --check    # compare against the fixture
 *
 * Written BEFORE the Phase 4 expansion, deliberately. Growing the canvas moves
 * every coordinate in the game through one transform, and the failure mode is
 * silent: a region lands two tiles off its road and becomes an island nobody can
 * walk to, with no error anywhere — the game still boots, the map still renders,
 * and a whole biome is simply gone. A flood fill from the city spawn is the only
 * thing that would notice.
 */

import { readFileSync } from "node:fs";
import { content, makeWorld, SimClock } from "./harness.ts";
import { buildWalkability } from "../src/core/worldCore.ts";
import { findPath } from "../src/client/pathfinding.ts";
import { CITY_SPAWN, OVERWORLD_HEIGHT, REGIONS, SETTLEMENT_CLEARINGS, instanceRectAt } from "../src/content/map.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

const st = makeWorld(new SimClock(1));
// Walk the world as a player who has finished everything: story barriers that a
// quest removes are not "unreachable", they are "not yet". Reachability here
// means "the map connects", not "connects on turn one".
for (const o of content.objects) if (o.requiresFlag && !st.player.flags.includes(o.requiresFlag)) st.player.flags.push(o.requiresFlag);
st.player.home.tier = 99;
const solid = buildWalkability(content, st);
const { map } = content;

// Creatures occupy their tile, but they do not STAY there — monsters, folk and
// critters all amble, and monsters come to you. Counting their spawn tiles as
// walls answers the wrong question: the first run of this file reported a
// cutthroat "unreachable" because two of its own packmates and a shrine boxed
// it in at spawn, which resolves itself the moment anything moves. Terrain and
// scenery are the walls; creatures are not.
const MOBILE = new Set(["monster", "npc", "critter"]);
const mobileTiles = new Set<string>();
for (const o of content.objects) if (MOBILE.has(o.kind)) mobileTiles.add(`${o.x},${o.y}`);
const walk = (x: number, y: number): boolean => solid(x, y) || mobileTiles.has(`${x},${y}`);

/** Flood-fill the overworld from the city spawn, 4-connected as movement is. */
function reachableFrom(sx: number, sy: number): Set<number> {
  const seen = new Set<number>();
  const stack: [number, number][] = [[sx, sy]];
  seen.add(sy * map.width + sx);
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= OVERWORLD_HEIGHT) continue;
      const k = ny * map.width + nx;
      if (seen.has(k) || !walk(nx, ny)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

check(walk(CITY_SPAWN.x, CITY_SPAWN.y), "the city spawn tile itself is not walkable");
const reach = reachableFrom(CITY_SPAWN.x, CITY_SPAWN.y);

// --- Every region must connect to the city ---------------------------------
// This is the assertion the expansion exists to keep true. A region is
// connected if ANY of its tiles is in the fill — its interior may well be
// walled cave, but the road has to arrive somewhere.
const regionReach: Record<string, number> = {};
for (const r of REGIONS) {
  let hit = 0, walkable = 0;
  for (let y = r.ny; y < r.ny + r.h; y++) {
    for (let x = r.nx; x < r.nx + r.w; x++) {
      if (x >= map.width || y >= OVERWORLD_HEIGHT || !walk(x, y)) continue;
      walkable += 1;
      if (reach.has(y * map.width + x)) hit += 1;
    }
  }
  regionReach[r.key] = hit;
  check(hit > 0, `region "${r.key}" is an island — no walkable tile in it connects to Ironvale`);
  // A road that arrives at one tile and stops is not a road. Ask for a real
  // foothold, proportional to what the region actually offers.
  check(
    walkable === 0 || hit >= Math.min(20, walkable * 0.25),
    `region "${r.key}" is barely connected: ${hit} of ${walkable} walkable tiles reachable`,
  );
}

// --- Everything that stands in the overworld must be reachable -------------
// An object on an unreachable tile is content nobody can ever interact with.
// Objects inside an instance (arena, home, dungeon) are excluded: those are
// reached by teleport, so the flood fill is the wrong question for them.
const stranded: string[] = [];
let overworldObjects = 0;
for (const o of content.objects) {
  if (o.y >= OVERWORLD_HEIGHT || instanceRectAt(o.x, o.y)) continue;
  overworldObjects += 1;
  // The object's own tile is usually blocking (that is what a tree IS), so the
  // question is whether a player can stand next to it.
  const beside = ([[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]] as [number, number][])
    .some(([dx, dy]) => reach.has((o.y + dy) * map.width + (o.x + dx)));
  if (!beside) stranded.push(`${o.id}@${o.x},${o.y}`);
}
check(
  stranded.length === 0,
  `${stranded.length} overworld objects cannot be reached from Ironvale: ${stranded.slice(0, 12).join(", ")}${stranded.length > 12 ? " …" : ""}`,
);

// --- Nothing may stand outside the canvas ----------------------------------
const outside = content.objects.filter((o) => o.x < 0 || o.y < 0 || o.x >= map.width || o.y >= map.height);
check(outside.length === 0, `${outside.length} objects sit outside the map: ${outside.slice(0, 8).map((o) => `${o.id}@${o.x},${o.y}`).join(", ")}`);

// --- Regions must not overlap each other or the city ------------------------
// Two regions sharing tiles means one generator overwrote the other's terrain,
// which is exactly the kind of thing a bigger canvas invites.
for (let i = 0; i < REGIONS.length; i++) {
  for (let j = i + 1; j < REGIONS.length; j++) {
    const a = REGIONS[i]!, b = REGIONS[j]!;
    const over = a.nx < b.nx + b.w && b.nx < a.nx + a.w && a.ny < b.ny + b.h && b.ny < a.ny + a.h;
    check(!over, `regions "${a.key}" and "${b.key}" overlap on the canvas`);
  }
}

// --- Things must stand where they BELONG, not merely somewhere reachable ----
// Reachability is not the same question as placement, and the Greater World
// expansion proved it: `SPAWN_FIXUP` pins ~44 objects to final coordinates and
// `newPois` authors ~200 more in final coordinates, both bypassing `remap()`.
// The expansion moved the map out from under all of them. Every one stayed
// perfectly reachable — and the starting Knucklestone Quarry ended up 226 tiles
// from the opening spawn, while all six region traders stood up to 235 tiles
// from the shops they keep. Nothing here noticed, because nothing here asked.
{
  // A shopkeeper has to be findable from the shop's own settlement.
  const towns = SETTLEMENT_CLEARINGS.map((c) => ({ cx: (c.x0 + c.x1) / 2, cy: (c.y0 + c.y1) / 2 }));
  for (const shop of content.shops) {
    if (!shop.npc) continue;
    const keeper = content.objects.find((o) => o.id === shop.npc);
    check(!!keeper, `shop "${shop.id}" names keeper "${shop.npc}", who has no spawn`);
    if (!keeper) continue;
    // Region shops belong to a settlement; Ironvale's belong to the city.
    const nearest = Math.min(...towns.map((t) => Math.hypot(keeper.x - t.cx, keeper.y - t.cy)));
    const toCity = Math.hypot(keeper.x - CITY_SPAWN.x, keeper.y - CITY_SPAWN.y);
    check(
      Math.min(nearest, toCity) <= 40,
      `${shop.npc} stands ${Math.round(Math.min(nearest, toCity))} tiles from any settlement — nobody will find that shop`,
    );
  }
  // The opening quarry is the first mining a new player does; it belongs beside
  // the spawn, not across the world.
  const quarry = content.objects.filter((o) => o.kind === "rock" && /^rock_\d+$/.test(o.id));
  check(quarry.length > 0, "the starting quarry has no rocks");
  for (const r of quarry) {
    const d = Math.hypot(r.x - CITY_SPAWN.x, r.y - CITY_SPAWN.y);
    check(d <= 90, `${r.id} is ${Math.round(d)} tiles from the opening spawn`);
  }
}

// --- Travel must stay responsive -------------------------------------------
// Every click is a pathfind on the main thread, and the cost of FAILING to find
// a path is the cost of expanding every reachable tile. On the old canvas that
// was ~22k tiles and a mistap cost ~150ms; the Greater World has 6× that, and
// the same click measured 937ms before the pathfinder was given a heap and a
// node budget. Nothing else in the repo would notice that.
const pathMs: Record<string, number> = {};
{
  for (const r of REGIONS) {
    let goal: { x: number; y: number } | null = null;
    for (let y = r.ny; y < r.ny + r.h && !goal; y++) {
      for (let x = r.nx; x < r.nx + r.w; x++) if (walk(x, y)) { goal = { x, y }; break; }
    }
    if (!goal) continue;
    const t0 = Date.now();
    const path = findPath(walk, CITY_SPAWN, goal);
    pathMs[r.key] = Date.now() - t0;
    check(path.length > 0, `no path from Ironvale to region "${r.key}"`);
  }
  // The failure case: a walkable tile in the sealed band, which no road reaches.
  let sealed: { x: number; y: number } | null = null;
  for (let y = OVERWORLD_HEIGHT; y < map.height && !sealed; y++) {
    for (let x = 0; x < map.width; x++) if (walk(x, y)) { sealed = { x, y }; break; }
  }
  if (sealed) {
    const t0 = Date.now();
    const path = findPath(walk, CITY_SPAWN, sealed);
    const ms = Date.now() - t0;
    pathMs["unreachable"] = ms;
    check(path.length === 0, "a path was found into the sealed band");
    check(ms < 400, `a hopeless pathfind took ${ms}ms — the search has no effective budget`);
  }
  const worst = Math.max(...Object.values(pathMs));
  check(worst < 400, `the slowest pathfind took ${worst}ms`);
}

const survey = {
  width: map.width,
  height: map.height,
  overworldHeight: OVERWORLD_HEIGHT,
  reachableTiles: reach.size,
  overworldObjects,
  regionReach,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(survey, null, 2));
  process.exit(fails.length ? 1 : 0);
}

console.log(`canvas ${map.width}×${map.height} (overworld ${OVERWORLD_HEIGHT} rows)`);
console.log(`reachable from Ironvale: ${reach.size.toLocaleString()} tiles`);
console.log(`overworld objects: ${overworldObjects}`);
console.log("region footholds:", regionReach);
console.log("pathfind ms:", pathMs);

if (process.argv.includes("--check")) {
  // The fixture is a floor, not a freeze: the world may GROW, but a change that
  // shrinks reachability or drops objects is the failure this file exists for.
  const base = JSON.parse(readFileSync("sims/baseline.world.json", "utf8")) as typeof survey;
  // A small tolerance, because ADDING content necessarily costs tiles: every
  // camp prop and every standing foe blocks the square it stands on. The
  // failure this guards against is a region going missing, which is thousands
  // of tiles, not a hundred.
  check(
    reach.size >= base.reachableTiles * 0.98,
    `reachable tiles fell from ${base.reachableTiles} to ${reach.size}`,
  );
  check(
    overworldObjects >= base.overworldObjects,
    `overworld objects fell from ${base.overworldObjects} to ${overworldObjects}`,
  );
  for (const [key, was] of Object.entries(base.regionReach)) {
    const now = regionReach[key];
    check(now !== undefined, `region "${key}" vanished from the map`);
    if (now !== undefined) check(now >= was * 0.5, `region "${key}" foothold fell from ${was} to ${now} tiles`);
  }
  console.log(`\nvs baseline: tiles ${base.reachableTiles} -> ${reach.size}, objects ${base.overworldObjects} -> ${overworldObjects}`);
}

if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("\nPASS");
