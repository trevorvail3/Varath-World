/**
 * sims/fitCombat.ts
 * -----------------
 * Fits the combat scale constants so OSRS's formulas land on Varath's numbers.
 *
 *   npx tsx sims/fitCombat.ts
 *
 * OSRS's rolls and Varath's content are on different scales: raw, the max-hit
 * formula gives ~26 where Varath hits for ~164, against HP pools reaching 2600.
 * Rather than rescale 85 monsters (which would invalidate every drop rate and
 * bounty count on record), a handful of constants map one scale onto the other.
 * This searches for them against the recorded baseline.
 *
 * Coordinate descent over a REPRESENTATIVE SUBSET, not the full roster: a full
 * measurement is ~1,000 fights, so searching on it directly would be hours. The
 * subset spans the level range; the full run is the validation afterwards.
 */

import { readFileSync } from "node:fs";
import { content, makeWorld, SimClock, levelMatchedPlayer } from "./harness.ts";
import { applyIntent, tick, COMBAT } from "../src/core/worldCore.ts";

interface BaseRow { monster: string; level: number; hp: number; ttkMs: number | null; hitRate: number | null; dmgPerHit: number | null; deathsPer100: number }
const baseline: BaseRow[] = JSON.parse(readFileSync("sims/baseline.ttk.json", "utf8")).rows;

const SEEDS = [7, 19];
const LIMIT_MS = 3 * 60_000;
const SLICE_MS = 100;

/** One representative spawn per monster type. */
const spawnFor = new Map<string, string>();
for (const o of content.objects) {
  if (o.kind === "monster" && o.monster && !spawnFor.has(o.monster)) spawnFor.set(o.monster, o.id);
}

/** A subset spanning the level range — every 5th monster by level. */
const SUBSET = baseline
  .filter((r) => r.ttkMs !== null && r.hitRate !== null && spawnFor.has(r.monster))
  .filter((_, i) => i % 5 === 0);

interface Measured { ttkMs: number | null; hitRate: number | null; dmgPerHit: number | null; died: boolean }

function measure(monsterId: string, seed: number, heal: boolean): Measured {
  const objId = spawnFor.get(monsterId)!;
  const clock = new SimClock(seed);
  const state = makeWorld(clock);
  const stats = content.monsters[monsterId]!;
  const def = content.objects.find((o) => o.id === objId)!;
  levelMatchedPlayer(state, Math.min(100, stats.level ?? 1));
  const p = state.player;
  if (def.requiresFlag && !p.flags.includes(def.requiresFlag)) p.flags.push(def.requiresFlag);
  p.pos = { x: def.x + 1, y: def.y };
  p.prevPos = { ...p.pos };
  p.path = [];

  const start = clock.now;
  applyIntent(state, content, { type: "INTERACT", objId, path: [] }, clock.ctx());
  let swings = 0, hits = 0, damage = 0, died = false, ttkMs: number | null = null;
  while (clock.now - start < LIMIT_MS) {
    clock.now += SLICE_MS;
    if (heal) { p.maxHp = 1_000_000; p.hp = 1_000_000; }
    for (const e of tick(state, content, clock.ctx())) {
      if (e.type === "DAMAGE" && e.targetId === objId) {
        swings++;
        if (e.amount > 0) { hits++; damage += e.amount; }
      } else if (e.type === "MONSTER_KILLED" && e.objId === objId) ttkMs = clock.now - start;
      else if (e.type === "PLAYER_DIED") died = true;
    }
    if (ttkMs !== null || died) break;
  }
  return {
    ttkMs,
    hitRate: swings ? hits / swings : null,
    dmgPerHit: hits ? damage / hits : null,
    died,
  };
}

/** Geometric-mean error of a ratio set against 1.0 — scale-symmetric. */
function logError(ratios: number[]): number {
  if (!ratios.length) return Infinity;
  const m = ratios.reduce((a, r) => a + Math.log(r), 0) / ratios.length;
  return Math.abs(m);
}

interface Score { ttkErr: number; hitErr: number; ttkMed: number; hitMed: number; deathRate: number }

function score(): Score {
  const ttk: number[] = [], hit: number[] = [];
  let deaths = 0, fights = 0;
  for (const row of SUBSET) {
    for (const seed of SEEDS) {
      const m = measure(row.monster, seed, true);
      if (m.ttkMs && row.ttkMs) ttk.push(m.ttkMs / row.ttkMs);
      if (m.hitRate && row.hitRate) hit.push(m.hitRate / row.hitRate);
      const s = measure(row.monster, seed, false);
      fights++;
      if (s.died) deaths++;
    }
  }
  const med = (v: number[]): number => v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]! : NaN;
  return { ttkErr: logError(ttk), hitErr: logError(hit), ttkMed: med(ttk), hitMed: med(hit), deathRate: deaths / Math.max(1, fights) };
}

console.log(`subset: ${SUBSET.length} monsters (levels ${SUBSET[0]?.level}–${SUBSET[SUBSET.length - 1]?.level})`);
console.log(`start: ${JSON.stringify({ maxHitScale: COMBAT.maxHitScale, mAtk: COMBAT.monsterAttackScale, mDef: COMBAT.monsterDefenceScale, mBase: COMBAT.monsterDefenceBase, mDmg: COMBAT.monsterDmgMult })}`);

// --- Stage 1: monster defence rolls, to match the baseline HIT RATE ---------
let best = { def: COMBAT.monsterDefenceScale, base: COMBAT.monsterDefenceBase, err: Infinity };
for (const dScale of [15, 30, 50, 80]) {
  for (const dBase of [100, 300, 500, 800]) {
    COMBAT.monsterDefenceScale = dScale;
    COMBAT.monsterDefenceBase = dBase;
    const s = score();
    console.log(`  defScale=${dScale} defBase=${dBase} -> hitMed=${s.hitMed.toFixed(3)} err=${s.hitErr.toFixed(4)}`);
    if (s.hitErr < best.err) best = { def: dScale, base: dBase, err: s.hitErr };
  }
}
COMBAT.monsterDefenceScale = best.def;
COMBAT.monsterDefenceBase = best.base;
console.log(`stage 1 -> monsterDefenceScale=${best.def} monsterDefenceBase=${best.base}`);

// --- Stage 2: maxHitScale, to match the baseline TTK -----------------------
let bestMax = { v: COMBAT.maxHitScale, err: Infinity, med: NaN };
for (const v of [6, 7, 8, 9, 10, 12]) {
  COMBAT.maxHitScale = v;
  const s = score();
  console.log(`  maxHitScale=${v} -> ttkMed=${s.ttkMed.toFixed(3)} err=${s.ttkErr.toFixed(4)}`);
  if (s.ttkErr < bestMax.err) bestMax = { v, err: s.ttkErr, med: s.ttkMed };
}
COMBAT.maxHitScale = bestMax.v;
console.log(`stage 2 -> maxHitScale=${bestMax.v} (median TTK ratio ${bestMax.med.toFixed(3)})`);

// --- Stage 3: monsterDmgMult, to bring the death rate back ------------------
const baseDeath = SUBSET.reduce((a, r) => a + r.deathsPer100, 0) / SUBSET.length / 100;
let bestDmg = { v: COMBAT.monsterDmgMult, err: Infinity, rate: NaN };
for (const v of [0.8, 1.0, 1.2, 1.4]) {
  COMBAT.monsterDmgMult = v;
  const s = score();
  console.log(`  monsterDmgMult=${v} -> deathRate=${(s.deathRate * 100).toFixed(0)}% (baseline ${(baseDeath * 100).toFixed(0)}%)`);
  const err = Math.abs(s.deathRate - baseDeath);
  if (err < bestDmg.err) bestDmg = { v, err, rate: s.deathRate };
}
console.log(`stage 3 -> monsterDmgMult=${bestDmg.v} (death rate ${(bestDmg.rate * 100).toFixed(0)}%, baseline ${(baseDeath * 100).toFixed(0)}%)`);

console.log("\nPaste into COMBAT:");
console.log(`  maxHitScale: ${bestMax.v},`);
console.log(`  monsterAttackScale: ${COMBAT.monsterAttackScale},`);
console.log(`  monsterDefenceScale: ${best.def},`);
console.log(`  monsterDefenceBase: ${best.base},`);
console.log(`  monsterDmgMult: ${bestDmg.v},`);
export {};
