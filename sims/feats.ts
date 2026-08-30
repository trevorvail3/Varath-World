/**
 * sims/feats.ts
 * -------------
 * Checks combat achievements — the fight recorder and the par time it judges.
 *
 *   npx tsx sims/feats.ts
 *   npx tsx sims/feats.ts --fit    # print the par-time calibration table
 *
 * Two things can go wrong here and neither would throw. The recorder can fail to
 * record — a feat that is never awarded looks exactly like a feat nobody has
 * earned yet — or the "swift" par can be set somewhere useless: so loose that
 * every kill earns it, or so tight that no kill ever can. Both make the whole
 * ladder meaningless while the game keeps running. Exits non-zero on failure.
 */

import { content, makeWorld, SimClock, levelMatchedPlayer, round } from "./harness.ts";
import { applyIntent, tick, swiftParMs } from "../src/core/worldCore.ts";
import { buildCombatAchievements, tierOf } from "../src/content/combatAchievements.ts";
import type { ItemId, MonsterStats } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };
const FIGHT_LIMIT_MS = 5 * 60_000;
const SLICE_MS = 100;

/** One boss fight, run through the real core, reporting what the recorder banked. */
function fight(
  monsterId: string,
  objId: string,
  seed: number,
  opts: { invincible?: boolean; eatAt?: number; overLevel?: number } = {},
): { killedMs: number | null; feats: string[]; hurt: number; ate: number } {
  const clock = new SimClock(seed);
  const state = makeWorld(clock);
  const stats = content.monsters[monsterId];
  const def = content.objects.find((o) => o.id === objId);
  if (!stats || !def) return { killedMs: null, feats: [], hurt: 0, ate: 0 };

  levelMatchedPlayer(state, opts.overLevel ?? Math.min(100, stats.level ?? 1));
  const p = state.player;
  if (def.requiresFlag && !p.flags.includes(def.requiresFlag)) p.flags.push(def.requiresFlag);
  const FOOD: ItemId = "health_elixir";
  if (opts.eatAt !== undefined) for (let i = 0; i < 20; i++) p.inventory[i] = { item: FOOD, qty: 1 };
  p.pos = { x: def.x + 1, y: def.y };
  p.prevPos = { ...p.pos };
  p.path = [];

  const start = clock.now;
  applyIntent(state, content, { type: "INTERACT", objId, path: [] }, clock.ctx());

  let killedMs: number | null = null;
  let hurt = 0, ate = 0;
  while (clock.now - start < FIGHT_LIMIT_MS) {
    clock.now += SLICE_MS;
    if (opts.invincible) { p.maxHp = 1_000_000; p.hp = 1_000_000; }
    else if (opts.eatAt !== undefined && p.hp < p.maxHp * opts.eatAt) {
      const slot = p.inventory.findIndex((it) => it?.item === FOOD);
      if (slot >= 0) {
        for (const e of applyIntent(state, content, { type: "EAT", slot }, clock.ctx())) {
          if (e.type === "HEALED" && e.amount > 0) ate += 1;
        }
      }
    }
    let died = false;
    for (const e of tick(state, content, clock.ctx())) {
      if (e.type === "DAMAGE" && e.targetId === "player") hurt += e.amount;
      else if (e.type === "MONSTER_KILLED" && e.objId === objId) killedMs = clock.now - start;
      else if (e.type === "PLAYER_DIED") died = true;
    }
    if (killedMs !== null || died) break;
  }
  return { killedMs, feats: [...(p.combatFeats ?? [])], hurt, ate };
}

/** One reachable spawn per boss. */
const bossSpawn = new Map<string, string>();
for (const o of content.objects) {
  if (o.kind === "monster" && o.monster && content.monsters[o.monster]?.boss && !bossSpawn.has(o.monster)) {
    bossSpawn.set(o.monster, o.id);
  }
}
check(bossSpawn.size > 0, "no reachable bosses found");

// --- The recorder actually records -----------------------------------------
// There is no god-mode: even a hugely over-levelled player gets clipped
// sometimes, so the invariant under test is conditional — WHENEVER a kill lands
// with zero damage taken, "perfect" must be banked — plus the existence claim
// that such a kill happens at all. A recorder that never fires looks exactly
// like a feat nobody has earned yet, and nothing else in the repo would notice.
const probe = [...bossSpawn.entries()].find(([m]) => (content.monsters[m]?.level ?? 0) <= 45);
if (!probe) fails.push("no low-level boss to probe the recorder with");
else {
  const [mid, oid] = probe;
  let untouchedKills = 0, kills = 0;
  for (const seed of [3, 7, 11, 19, 23, 31, 43, 57, 61, 79]) {
    const r = fight(mid, oid, seed, { overLevel: 100 });
    if (r.killedMs === null) continue;
    kills += 1;
    check(r.feats.includes(`${mid}:unfed`), `a foodless kill of ${mid} (seed ${seed}) did not bank "unfed"`);
    if (r.hurt === 0) {
      untouchedKills += 1;
      check(r.feats.includes(`${mid}:perfect`), `an untouched kill of ${mid} (seed ${seed}) did not bank "perfect"`);
    } else {
      check(!r.feats.includes(`${mid}:perfect`), `${mid} banked "perfect" after taking ${r.hurt} damage`);
    }
  }
  check(kills > 0, `the probe boss ${mid} was never killed, so the recorder was never closed`);
  check(untouchedKills > 0, `${mid} was never killed cleanly in 10 tries — "perfect" may be unearnable`);

  // …and a player who eats must lose the unfed feat. Only a heal that actually
  // heals counts — drinking at full health is a no-op the core refuses — so the
  // assertion is conditional on the fight really having consumed food.
  let checkedFed = false;
  for (const seed of [3, 7, 11, 19, 23, 31, 43, 57]) {
    const fed = fight(mid, oid, seed, { eatAt: 0.9 });
    if (fed.killedMs === null || fed.ate === 0) continue;
    checkedFed = true;
    check(!fed.feats.includes(`${mid}:unfed`), `${mid} banked "unfed" after eating ${fed.ate} time(s)`);
    break;
  }
  check(checkedFed, `no probe fight against ${mid} ever ate, so "unfed" was never falsified`);
}

// --- The par time is a real bar --------------------------------------------
// A level-matched player is the reference: swift should be beyond most of them
// (or it is free) without being beyond all of them (or it is dead content).
//
// A flat milliseconds-per-HP par cannot do this, and the --fit table is what
// showed why: at level 23 a matched player needs ~190ms per point of the boss's
// health, and at 95 it needs ~10ms. One constant would hand every high-level
// boss the feat for free and put every low-level one out of reach — splitting
// the ladder by the boss's level instead of by how well you fought. So par is a
// power law in the boss's level as well as its HP; see swiftParMs.
const rows: { boss: string; level: number; hp: number; ttk: number | null; par: number }[] = [];
for (const [mid, oid] of bossSpawn) {
  const stats = content.monsters[mid] as MonsterStats;
  const r = fight(mid, oid, 19, { invincible: true });
  rows.push({ boss: mid, level: stats.level ?? 0, hp: stats.hp ?? 0, ttk: r.killedMs, par: swiftParMs(stats) });
}
const timed = rows.filter((r) => r.ttk !== null);
const beat = timed.filter((r) => r.ttk! <= r.par).length;
const share = timed.length ? beat / timed.length : 0;
check(timed.length >= bossSpawn.size * 0.8, `only ${timed.length}/${bossSpawn.size} bosses produced a time`);
check(share <= 0.45, `a level-matched player already beats par on ${beat}/${timed.length} bosses — swift is nearly free`);
check(share >= 0.05, `almost no level-matched player comes close to par (${beat}/${timed.length}) — swift may be unreachable`);

// `--fit` grid-searches the two constants against the measured times, targeting
// a third of level-matched fights beating par: enough that the feat is provably
// attainable at every tier, few enough that it still asks something of you.
if (process.argv.includes("--fit")) {
  let best: { a: number; b: number; err: number; hit: number } | null = null;
  const TARGET = 1 / 3;
  for (let a = 200; a <= 6000; a += 50) {
    for (let b = 0; b <= 2.0001; b += 0.02) {
      const hit = timed.filter((r) => r.ttk! <= r.hp * a * Math.pow(Math.max(1, r.level), -b)).length;
      // Prefer the split closest to target; break ties toward a spread of
      // levels beating it rather than one clump.
      const err = Math.abs(hit / timed.length - TARGET);
      if (!best || err < best.err - 1e-9) best = { a, b, err, hit };
    }
  }
  if (best) {
    console.log(`\nfit: SWIFT_PAR_A=${best.a} SWIFT_PAR_B=${round(best.b, 2)} -> ${best.hit}/${timed.length} beat par`);
  }
}

// --- The task list is complete and well-formed ------------------------------
const tasks = buildCombatAchievements(content);
const ids = new Set(tasks.map((t) => t.id));
check(ids.size === tasks.length, "duplicate combat achievement ids");
for (const [mid] of bossSpawn) {
  for (const suffix of ["kill", "perfect", "unfed", "swift"]) {
    check(ids.has(`ca_${mid}_${suffix}`), `boss ${mid} has no "${suffix}" task`);
  }
}
check(
  tasks.every((t) => t.name && t.desc && t.icon && t.category),
  "a combat achievement is missing a name, description, icon or category",
);
// Every derived task must be reachable through the shipped achievement list,
// or it exists only in this sim.
const shipped = new Set(content.achievements.map((a) => a.id));
for (const t of tasks) check(shipped.has(t.id), `${t.id} is derived but not in content.achievements`);

const byTier: Record<string, number> = {};
for (const [mid] of bossSpawn) {
  const t = tierOf(content.monsters[mid] as MonsterStats);
  byTier[t] = (byTier[t] ?? 0) + 1;
}
console.log(`bosses ${bossSpawn.size} · tasks ${tasks.length} · tiers`, byTier);
console.log(`level-matched players beat par on ${beat}/${timed.length} bosses (${round(share * 100, 1)}%)`);
if (process.argv.includes("--fit")) {
  console.log("\nboss                 lvl     hp     ttk     par   beat");
  for (const r of [...rows].sort((a, b) => a.level - b.level)) {
    const ttk = r.ttk === null ? "  none" : (r.ttk / 1000).toFixed(1) + "s";
    console.log(
      `${r.boss.padEnd(20)} ${String(r.level).padStart(3)} ${String(r.hp).padStart(6)} ${ttk.padStart(7)} ${(r.par / 1000).toFixed(1).padStart(6)}s  ${r.ttk !== null && r.ttk <= r.par ? "yes" : ""}`,
    );
  }
}

if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("\nPASS");
