/**
 * sims/ttk.ts
 * -----------
 * Measures COMBAT through the real core: time-to-kill, hit rate, damage per
 * landed hit, and how often the player dies — for every monster in the game.
 *
 *   npx tsx sims/ttk.ts            # print a table
 *   npx tsx sims/ttk.ts --json     # emit the fixture
 *
 * Recorded BEFORE the OSRS formula swap, this is the only thing that will say
 * whether the swap broke the balance. Death rate is measured alongside TTK on
 * purpose: removing the flat defence soak can leave time-to-kill untouched while
 * making the game unsurvivable, and TTK alone would not show it.
 *
 * Each fight runs in a fresh world so one result can never bleed into the next.
 */

import { content, makeWorld, SimClock, levelMatchedPlayer, round } from "./harness.ts";
import { readFileSync } from "node:fs";
import { applyIntent, tick } from "../src/core/worldCore.ts";

/** Seeds for the offence pass (TTK / hit rate) and the survivability pass. */
const TTK_SEEDS = [7, 19, 43];
const DEATH_SEEDS = [2, 5, 11, 17, 23, 31, 41, 53, 61, 71];
const FIGHT_LIMIT_MS = 5 * 60_000;
const SLICE_MS = 100;

interface Fight { ttkMs: number | null; swings: number; hits: number; damage: number; died: boolean }

/**
 * One fight against `objId`, from a fresh world.
 *
 * `heal` decides which question the fight answers. With it the player is topped
 * up every slice, so the fight measures pure OFFENCE — time-to-kill and hit rate
 * — and a boss that would otherwise kill an unequipped sim player still yields a
 * TTK. Without it the fight measures SURVIVABILITY. Keeping them apart matters:
 * removing the flat defence soak can leave TTK untouched while making the game
 * unsurvivable, and a single blended number would hide that.
 */
function fight(monsterId: string, objId: string, seed: number, heal: boolean): Fight {
  const clock = new SimClock(seed);
  const state = makeWorld(clock);
  const stats = content.monsters[monsterId];
  const def = content.objects.find((o) => o.id === objId);
  if (!stats || !def) return { ttkMs: null, swings: 0, hits: 0, damage: 0, died: false };

  levelMatchedPlayer(state, Math.min(100, stats.level ?? 1));
  const p = state.player;
  // Several bosses only exist once a quest has revealed them. Grant the flag so
  // the sim can reach them; without it the INTERACT is a silent no-op.
  if (def.requiresFlag && !p.flags.includes(def.requiresFlag)) p.flags.push(def.requiresFlag);
  p.pos = { x: def.x + 1, y: def.y };
  p.prevPos = { ...p.pos };
  p.path = [];

  const start = clock.now;
  applyIntent(state, content, { type: "INTERACT", objId, path: [] }, clock.ctx());

  let swings = 0, hits = 0, damage = 0, died = false;
  let ttkMs: number | null = null;
  while (clock.now - start < FIGHT_LIMIT_MS) {
    clock.now += SLICE_MS;
    // Make the player unkillable outright rather than just topping HP up: a boss
    // can land more than a full health bar inside one tick, and a death would
    // end the fight before it produced the TTK this pass exists to measure.
    if (heal) { p.maxHp = 1_000_000; p.hp = 1_000_000; }
    for (const e of tick(state, content, clock.ctx())) {
      if (e.type === "DAMAGE" && e.targetId === objId) {
        swings++;
        if (e.amount > 0) { hits++; damage += e.amount; }
      } else if (e.type === "MONSTER_KILLED" && e.objId === objId) {
        ttkMs = clock.now - start;
      } else if (e.type === "PLAYER_DIED") {
        died = true;
      }
    }
    if (ttkMs !== null || died) break;
  }
  return { ttkMs, swings, hits, damage, died };
}

interface Row {
  monster: string; level: number; hp: number;
  ttkMs: number | null; hitRate: number | null; dmgPerHit: number | null;
  deathsPer100: number; timeouts: number;
}

function median(ns: number[]): number | null {
  if (!ns.length) return null;
  const s = [...ns].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] ?? null;
}

function run(): Row[] {
  // One representative spawn per monster type.
  const spawnFor = new Map<string, string>();
  for (const o of content.objects) {
    if (o.kind === "monster" && o.monster && !spawnFor.has(o.monster)) spawnFor.set(o.monster, o.id);
  }

  const rows: Row[] = [];
  for (const [monsterId, objId] of spawnFor) {
    const stats = content.monsters[monsterId];
    if (!stats) continue;
    const fights = TTK_SEEDS.map((s) => fight(monsterId, objId, s, true));
    const survival = DEATH_SEEDS.map((s) => fight(monsterId, objId, s, false));
    const kills = fights.filter((f) => f.ttkMs !== null);
    const deaths = survival.filter((f) => f.died).length;
    const swings = fights.reduce((a, f) => a + f.swings, 0);
    const hits = fights.reduce((a, f) => a + f.hits, 0);
    const damage = fights.reduce((a, f) => a + f.damage, 0);
    rows.push({
      monster: monsterId,
      level: stats.level ?? 0,
      hp: stats.hp ?? 0,
      ttkMs: median(kills.map((f) => f.ttkMs!)),
      hitRate: swings ? round(hits / swings, 3) : null,
      dmgPerHit: hits ? round(damage / hits, 2) : null,
      deathsPer100: round((deaths / survival.length) * 100, 1),
      // Offence-pass fights that neither killed the monster nor ended: either the
      // monster could not be engaged at all, or it outlasted FIGHT_LIMIT_MS.
      timeouts: fights.length - kills.length,
    });
  }
  return rows.sort((a, b) => a.level - b.level);
}

const rows = run();

/**
 * `--check` compares this run against the committed baseline and reports how far
 * combat has moved. It prints a verdict rather than throwing: a formula change is
 * EXPECTED to move individual monsters, and the question is whether the roster as
 * a whole still sits where it did.
 */
if (process.argv.includes("--check")) {
  const base: { rows: Row[] } = JSON.parse(readFileSync("sims/baseline.ttk.json", "utf8"));
  const byId = new Map(base.rows.map((r) => [r.monster, r]));
  const ratios: { monster: string; r: number }[] = [];
  for (const r of rows) {
    const o = byId.get(r.monster);
    if (o?.ttkMs && r.ttkMs) ratios.push({ monster: r.monster, r: r.ttkMs / o.ttkMs });
  }
  const sorted = [...ratios].sort((a, b) => a.r - b.r);
  const med = sorted[Math.floor(sorted.length / 2)]?.r ?? NaN;
  const within10 = ratios.filter((x) => Math.abs(x.r - 1) <= 0.10).length;
  const beyond2x = ratios.filter((x) => x.r > 2 || x.r < 0.5);
  const meanDeath = (rs: Row[]): number => rs.reduce((a, r) => a + r.deathsPer100, 0) / rs.length;

  // TTK on a short fight is heavily quantized — a 7s kill is about three swings,
  // so one swing either way reads as a 40% swing in "balance". Offensive OUTPUT
  // (hit rate x damage per landed hit) is the same quantity without the
  // granularity: weapon speed is unchanged, so it is proportional to DPS.
  const output: { monster: string; r: number }[] = [];
  for (const r of rows) {
    const o = byId.get(r.monster);
    if (o?.hitRate && o.dmgPerHit && r.hitRate && r.dmgPerHit) {
      output.push({ monster: r.monster, r: (r.hitRate * r.dmgPerHit) / (o.hitRate * o.dmgPerHit) });
    }
  }
  const oSorted = [...output].sort((a, b) => a.r - b.r);
  const oMed = oSorted[Math.floor(oSorted.length / 2)]?.r ?? NaN;
  const oWithin10 = output.filter((x) => Math.abs(x.r - 1) <= 0.10).length;
  const oWithin25 = output.filter((x) => Math.abs(x.r - 1) <= 0.25).length;
  console.log(`monsters compared     ${ratios.length}`);
  console.log(`median TTK ratio      ${med.toFixed(3)}   (1.000 = unchanged)`);
  console.log(`within 10% of before  ${within10}/${ratios.length}`);
  console.log(`beyond 2x either way  ${beyond2x.length}${beyond2x.length ? "  " + beyond2x.map((x) => `${x.monster} ${x.r.toFixed(2)}x`).join(", ") : ""}`);
  console.log(`mean death%           ${meanDeath(base.rows).toFixed(1)} -> ${meanDeath(rows).toFixed(1)}`);
  console.log(`--- damage output (unquantized) ---`);
  console.log(`median output ratio   ${oMed.toFixed(3)}`);
  console.log(`within 10% / 25%      ${oWithin10}/${output.length}  ${oWithin25}/${output.length}`);
  const worst = [...output].sort((a, b) => Math.abs(b.r - 1) - Math.abs(a.r - 1)).slice(0, 8);
  console.log(`most moved            ${worst.map((x) => `${x.monster} ${x.r.toFixed(2)}x`).join(", ")}`);
} else if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ttkSeeds: TTK_SEEDS, deathSeeds: DEATH_SEEDS, rows }, null, 2));
} else {
  console.log(`${"monster".padEnd(22)}${"lvl".padStart(4)}${"hp".padStart(6)}${"ttk".padStart(9)}${"hit%".padStart(7)}${"dmg".padStart(7)}${"death%".padStart(8)}${"t/o".padStart(5)}`);
  for (const r of rows) {
    console.log(
      r.monster.padEnd(22) +
      String(r.level).padStart(4) +
      String(r.hp).padStart(6) +
      (r.ttkMs === null ? "—" : `${(r.ttkMs / 1000).toFixed(1)}s`).padStart(9) +
      (r.hitRate === null ? "—" : (r.hitRate * 100).toFixed(0)).padStart(7) +
      (r.dmgPerHit === null ? "—" : r.dmgPerHit.toFixed(1)).padStart(7) +
      r.deathsPer100.toFixed(0).padStart(8) +
      String(r.timeouts).padStart(5),
    );
  }
}
export {};
