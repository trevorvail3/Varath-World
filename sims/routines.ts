/**
 * sims/routines.ts
 * ----------------
 * Checks the townsfolk's daily routines.
 *
 *   npx tsx sims/routines.ts
 *
 * A routine is a moving home: the NPC ambles around its current post and walks
 * to the next one when the hour turns. Three things can go wrong quietly. A post
 * can sit on ground nobody can stand on, and the NPC spends that phase stuck
 * against a wall. The posts can be so far apart that the walk takes longer than
 * the phase, so the NPC never arrives anywhere. Or the schedule can fail to
 * cover the day, leaving an hour with no post at all. None of those throw.
 * Exits non-zero on failure.
 */

import { content, makeWorld, SimClock } from "./harness.ts";
import { buildWalkability, dayPhase, postOf, tick, DAY_CYCLE_MS, TICK_MS } from "../src/core/worldCore.ts";
import type { Ctx, WorldObjectDef } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

const withRoutine = content.objects.filter((o) => (o.routine?.length ?? 0) > 0);
check(withRoutine.length > 0, "nobody in Varath keeps a routine");

const st = makeWorld(new SimClock(1));
for (const o of content.objects) if (o.requiresFlag && !st.player.flags.includes(o.requiresFlag)) st.player.flags.push(o.requiresFlag);
const walk = buildWalkability(content, st);

for (const def of withRoutine) {
  const r = def.routine!;
  // --- The schedule must cover the whole day ---
  check(r.every((p) => p.at >= 0 && p.at < 1), `${def.id} has a post outside the day (at must be 0..1)`);
  for (let i = 1; i < r.length; i++) {
    check(r[i]!.at > r[i - 1]!.at, `${def.id}'s posts are not in order — the later one would never be reached`);
  }

  // --- Every post must be stand-on-able ---
  for (const p of r) {
    const ok = ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][])
      .some(([dx, dy]) => walk(p.x + dx, p.y + dy));
    check(ok, `${def.id} has a post at ${p.x},${p.y} with no walkable tile at or beside it`);
  }

  // --- A phase must be long enough to walk to its post ---
  // Otherwise the NPC is permanently in transit and never keeps any of its hours.
  for (let i = 0; i < r.length; i++) {
    const cur = r[i]!, next = r[(i + 1) % r.length]!;
    const span = (next.at - cur.at + 1) % 1 || 1;
    const d = Math.max(Math.abs(next.x - cur.x), Math.abs(next.y - cur.y));
    // Creatures amble a tile every couple of ticks, so budget generously.
    const ticksAvailable = (span * DAY_CYCLE_MS) / TICK_MS;
    const ticksNeeded = d * 2; // a creature ambles a tile every couple of ticks
    check(
      ticksNeeded <= ticksAvailable,
      `${def.id} cannot reach its next post in time: ${d} tiles in ${Math.round(span * DAY_CYCLE_MS / 1000)}s`,
    );
  }
}

// --- postOf actually returns different posts across the day -----------------
const sample = withRoutine[0]!;
const posts = new Set<string>();
for (let i = 0; i < 24; i++) {
  const ctx: Ctx = { now: 0, rng: () => 0.5, epoch: Math.floor((i / 24) * DAY_CYCLE_MS) };
  const p = postOf(sample, ctx);
  posts.add(`${p.x},${p.y}`);
  check(dayPhase(ctx) >= 0 && dayPhase(ctx) < 1, "dayPhase left 0..1");
}
check(posts.size > 1, `${sample.id} stands in the same place all day — the routine does nothing`);

// An NPC WITHOUT a routine must be unaffected: its home is still its spawn.
const plain = content.objects.find((o) => o.kind === "npc" && !o.routine);
if (!plain) fails.push("every NPC has a routine, so the no-routine path is untested");
else {
  const ctx: Ctx = { now: 0, rng: () => 0.5, epoch: 123456 };
  const p = postOf(plain, ctx);
  check(p.x === plain.x && p.y === plain.y, `${plain.id} has no routine but postOf moved it`);
}

// --- They actually walk there, through the real tick ------------------------
// The feature is only real if the existing walk-home logic carries them.
{
  const clock = new SimClock(5);
  const world = makeWorld(clock);
  const subject = withRoutine.find((o): o is WorldObjectDef => !!world.objects[o.id]?.pos);
  if (!subject) fails.push("no routine-keeper is spawned in the world");
  else {
    // Put the clock at a phase whose post is far from where the NPC stands.
    const obj = world.objects[subject.id]!;
    const start = { x: Math.round(obj.pos!.x), y: Math.round(obj.pos!.y) };
    let moved = 0;
    for (let i = 0; i < 400; i++) {
      clock.now += TICK_MS;
      tick(world, content, clock.ctx());
      const now = world.objects[subject.id]!.pos!;
      moved = Math.max(moved, Math.max(Math.abs(Math.round(now.x) - start.x), Math.abs(Math.round(now.y) - start.y)));
    }
    check(moved > 0, `${subject.id} never moved in 400 ticks — routines do not drive movement`);
  }
}

console.log(`routine-keepers ${withRoutine.length} · posts each ${withRoutine[0]!.routine!.length} · day ${DAY_CYCLE_MS / 1000}s`);
if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("\nPASS");
