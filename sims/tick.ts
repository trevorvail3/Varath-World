/**
 * sims/tick.ts
 * ------------
 * Measures MOVEMENT and TICK cadence through the real core.
 *
 *   npx tsx sims/tick.ts           # print a table
 *   npx tsx sims/tick.ts --json    # emit the fixture
 *
 * These are the assertions that guard the 600ms tick migration. The important
 * one is `pursuit`: a monster that can no longer catch a walking player is a
 * completely silent failure — aggro still fires, the chase still counts down,
 * and nothing in the game surfaces it.
 */

import { content, makeWorld, SimClock, round, TICK_MS } from "./harness.ts";
import { applyIntent, tick, buildWalkability } from "../src/core/worldCore.ts";
import type { Vec2, WorldState } from "../src/core/types.ts";

/**
 * Stand beside a spawn on whichever side has open ground to flee across, and
 * return that side plus its runway. Several spawns sit in clusters that would
 * box the player in on the first step, so a site needs real room to be usable.
 */
function fleeSite(
  walk: (x: number, y: number) => boolean,
  x: number,
  y: number,
  minRunway = 10,
): { start: Vec2; dir: readonly [number, number]; runway: number } | null {
  let best: { start: Vec2; dir: readonly [number, number]; runway: number } | null = null;
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const start = { x: x + d[0], y: y + d[1] };
    if (!walk(start.x, start.y)) continue;
    let runway = 0;
    while (runway < 30 && walk(start.x + d[0] * (runway + 1), start.y + d[1] * (runway + 1))) runway++;
    if (!best || runway > best.runway) best = { start, dir: d, runway };
  }
  return best && best.runway >= minRunway ? best : null;
}

/** A straight walkable run of `len` tiles starting at the player, or null. */
function straightPath(state: WorldState, len: number): Vec2[] | null {
  const walk = buildWalkability(content, state);
  const start = state.player.pos;
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
    const path: Vec2[] = [];
    let ok = true;
    for (let i = 1; i <= len; i++) {
      const t = { x: start.x + dx * i, y: start.y + dy * i };
      if (!walk(t.x, t.y)) { ok = false; break; }
      path.push(t);
    }
    if (ok && path.length === len) return path;
  }
  return null;
}

/** Time and ticks taken to walk/run `len` tiles. */
function moveRun(running: boolean, len = 12): { ms: number; ticks: number; tilesPerSec: number } {
  const clock = new SimClock(3);
  const state = makeWorld(clock);
  const p = state.player;
  p.running = running;
  p.energy = 100;
  p.winded = false;
  delete p.equipment.mount;

  const path = straightPath(state, len);
  if (!path) throw new Error("no straight walkable run near spawn");

  const startTick = state.tickCount;
  const startMs = clock.now;
  applyIntent(state, content, { type: "MOVE", path }, clock.ctx());
  const dest = path[path.length - 1]!;
  const limit = clock.now + 60_000;
  while (clock.now < limit) {
    if (p.pos.x === dest.x && p.pos.y === dest.y && p.path.length === 0) break;
    clock.now += 16;
    tick(state, content, clock.ctx());
  }
  const ms = clock.now - startMs;
  return { ms, ticks: state.tickCount - startTick, tilesPerSec: round(len / (ms / 1000), 3) };
}

/** How many ticks elapse across 60s of simulated time at a steady 60fps. */
function ticksPerMinute(): number {
  const clock = new SimClock(5);
  const state = makeWorld(clock);
  const start = state.tickCount;
  const end = clock.now + 60_000;
  while (clock.now < end) {
    clock.now += 16;
    tick(state, content, clock.ctx());
  }
  return state.tickCount - start;
}

/**
 * After a long stall (a GC pause or a backgrounded tab), how much sim time can a
 * SINGLE tick() call absorb? The elapsed clamp inside tick() bounds this; if the
 * clamp is smaller than TICK_MS the sim can never catch up at all.
 */
function catchUpTicks(stallMs: number): number {
  const clock = new SimClock(5);
  const state = makeWorld(clock);
  clock.now += 16; tick(state, content, clock.ctx());
  const before = state.tickCount;
  clock.now += stallMs;
  tick(state, content, clock.ctx());
  return state.tickCount - before;
}

/**
 * Can an aggressive monster KEEP UP with a fleeing player? Returns the percentage
 * of ticks it spent within its own attack reach.
 *
 * Distance-closed is the obvious metric and it is the wrong one: a chaser closes
 * to reach and then holds there to swing, so closure saturates at 0 whether it is
 * comfortably faster than the player or exactly matched. Time-in-reach does not
 * saturate — a monster that cannot keep pace falls steadily toward 0%.
 */
function pursuitContact(running: boolean, monsterId: string, windowMs = 8000): number | null {
  const clock = new SimClock(11);
  const state = makeWorld(clock);
  const p = state.player;
  const def = content.objects.find((o) => o.id === monsterId);
  const obj = state.objects[monsterId];
  if (!def || !obj || !obj.pos) return null;

  p.running = running;
  p.energy = 100;
  p.winded = false;
  delete p.equipment.mount;

  const walk = buildWalkability(content, state);
  const best = fleeSite(walk, def.x, def.y);
  if (!best) return null; // nowhere to run — not a usable site

  p.pos = { ...best.start };
  p.prevPos = { ...best.start };
  obj.pursueUntil = clock.now + 60_000;

  const dist = (): number =>
    Math.max(Math.abs(Math.round(obj.pos!.x) - p.pos.x), Math.abs(Math.round(obj.pos!.y) - p.pos.y));

  const reach = 1;
  let ticksSeen = 0;
  let ticksInReach = 0;
  let lastTick = state.tickCount;
  const end = clock.now + windowMs;
  while (clock.now < end) {
    // Keep fleeing: top the path back up whenever it runs dry.
    if (p.path.length === 0) {
      const step: Vec2[] = [];
      for (let i = 1; i <= 4; i++) {
        const t = { x: p.pos.x + best.dir[0] * i, y: p.pos.y + best.dir[1] * i };
        if (!walk(t.x, t.y)) break;
        step.push(t);
      }
      if (step.length) applyIntent(state, content, { type: "MOVE", path: step }, clock.ctx());
    }
    clock.now += 16;
    tick(state, content, clock.ctx());
    // Hold the chase open and keep the player alive: we are measuring closure
    // speed, not survivability.
    obj.pursueUntil = clock.now + 60_000;
    p.hp = p.maxHp;
    if (state.tickCount !== lastTick) {
      lastTick = state.tickCount;
      ticksSeen++;
      if (dist() <= reach) ticksInReach++;
    }
  }
  return ticksSeen === 0 ? null : round((ticksInReach / ticksSeen) * 100, 1);
}

/** The first monster spawn with enough open ground beside it to flee across. */
function pickPursuitSite(): string | null {
  const clock = new SimClock(11);
  const state = makeWorld(clock);
  const walk = buildWalkability(content, state);
  for (const def of content.objects) {
    if (def.kind !== "monster") continue;
    const obj = state.objects[def.id];
    if (!obj?.pos || !obj.available) continue;
    if (fleeSite(walk, def.x, def.y)) return def.id;
  }
  return null;
}

// ---------------------------------------------------------------------------

const MONSTER = pickPursuitSite();
if (!MONSTER) throw new Error("no usable pursuit site found");
const out = {
  tickMs: TICK_MS,
  ticksPerMinute: ticksPerMinute(),
  catchUpTicksAfter700msStall: catchUpTicks(700),
  walk: moveRun(false),
  run: moveRun(true),
  pursuit: {
    monster: MONSTER,
    pctInReachVsWalking: pursuitContact(false, MONSTER),
    pctInReachVsRunning: pursuitContact(true, MONSTER),
  },
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`TICK_MS=${out.tickMs}`);
  console.log(`ticks per 60s        ${out.ticksPerMinute}   (expect 60000/TICK_MS = ${60_000 / TICK_MS})`);
  console.log(`catch-up after 700ms stall: ${out.catchUpTicksAfter700msStall} tick(s) in one call`);
  console.log(`walk  ${out.walk.ms}ms for 12 tiles = ${out.walk.tilesPerSec} tiles/s (${out.walk.ticks} ticks)`);
  console.log(`run   ${out.run.ms}ms for 12 tiles = ${out.run.tilesPerSec} tiles/s (${out.run.ticks} ticks)`);
  console.log(`pursuit (${out.pursuit.monster}) vs walking player: ${out.pursuit.pctInReachVsWalking}% of ticks in reach`);
  console.log(`pursuit (${out.pursuit.monster}) vs running player: ${out.pursuit.pctInReachVsRunning}% of ticks in reach`);
}
export {};
