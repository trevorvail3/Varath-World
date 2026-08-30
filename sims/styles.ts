/**
 * sims/styles.ts
 * --------------
 * Checks the attack-option system.
 *
 *   npx tsx sims/styles.ts
 *
 * The point of attack options is that switching one mid-fight exploits a foe's
 * weakness without changing weapon. That claim is measurable, so it is measured:
 * the last check fights a crush-weak monster with a spear on Lunge (stab) and on
 * Pound (crush) and compares the hit rates. Exits non-zero on failure.
 */

import { content, makeWorld, SimClock, levelMatchedPlayer, round } from "./harness.ts";
import { applyIntent, tick, activeAttackOption, playerWepType } from "../src/core/worldCore.ts";
import { WEAPON_STYLES, wepTypeOf } from "../src/content/weaponStyles.ts";
import type { ItemId } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

// --- 1. Every weapon in the game resolves to a family that has options -------
// This is the assertion that catches the 28 weapons carrying no `wepType`.
let weapons = 0;
const seen = new Set<string>();
for (const [id, def] of Object.entries(content.items)) {
  if (def.slot !== "mainhand") continue;
  weapons++;
  const wt = wepTypeOf(def);
  seen.add(wt);
  const opts = WEAPON_STYLES[wt];
  check(!!opts && opts.length > 0, `${id}: family "${wt}" has no attack options`);
}
console.log(`mainhand items: ${weapons}, families in use: ${[...seen].sort().join(", ")}`);

// --- 2. Every option is well-formed -----------------------------------------
for (const [wt, opts] of Object.entries(WEAPON_STYLES)) {
  const ids = new Set(opts.map((o) => o.id));
  check(ids.size === opts.length, `${wt}: duplicate option ids`);
  for (const o of opts) {
    check(["stab", "slash", "crush", "ranged", "magic"].includes(o.type), `${wt}.${o.id}: bad type`);
    check(["edge", "vigour", "ward", "controlled"].includes(o.stance), `${wt}.${o.id}: bad stance`);
  }
  // A real melee WEAPON family must reach at least two of the three melee types,
  // or bringing it to the wrong fight would be a dead end. Bows and staves have
  // one type by nature, and a fist or a pickaxe only ever crushes.
  if (!["bow", "staff", "tool", "unarmed"].includes(wt)) {
    const types = new Set(opts.map((o) => o.type));
    check(types.size >= 2, `${wt}: only reaches one damage type`);
  }
}

// --- 3. Switching an option changes the damage type dealt --------------------
const clock = new SimClock(3);
const st = makeWorld(clock);
levelMatchedPlayer(st, 60);
const spear = Object.keys(content.items).find(
  (id) => wepTypeOf(content.items[id as ItemId]) === "spear",
) as ItemId | undefined;
check(!!spear, "no spear-family weapon exists to test with");
if (spear) {
  st.player.equipment.mainhand = spear;
  const wt = playerWepType(st.player, content);
  const pound = WEAPON_STYLES[wt].findIndex((o) => o.type === "crush");
  const lunge = WEAPON_STYLES[wt].findIndex((o) => o.type === "stab");
  applyIntent(st, content, { type: "SET_ATTACK_OPTION", option: pound }, clock.ctx());
  check(activeAttackOption(st.player, content).type === "crush", "switching to Pound did not deal crush");
  applyIntent(st, content, { type: "SET_ATTACK_OPTION", option: lunge }, clock.ctx());
  check(activeAttackOption(st.player, content).type === "stab", "switching to Lunge did not deal stab");
}

// --- 4. The payoff: matching a weakness measurably lands more ---------------
/** Hit rate over a fixed window against `mid`, using attack option `opt`. */
function hitRate(mid: string, weapon: ItemId, opt: number): number {
  const objId = content.objects.find((o) => o.kind === "monster" && o.monster === mid)!.id;
  const def = content.objects.find((o) => o.id === objId)!;
  const stats = content.monsters[mid]!;
  let swings = 0, hits = 0;
  // Twelve seeds, not three. Three was enough to show the effect until the
  // Greater World expansion shifted the RNG stream (a bigger world ticks more
  // objects before the fight starts), at which point the measurement inverted
  // on noise alone — 81.6% vs 84.8% — while the mechanic was untouched. A
  // comparison that a stream shift can flip was never evidence of anything.
  for (const seed of [7, 19, 43, 61, 83, 101, 131, 157, 181, 199, 223, 251]) {
    const c = new SimClock(seed);
    const s = makeWorld(c);
    levelMatchedPlayer(s, Math.min(100, stats.level ?? 1));
    const p = s.player;
    p.equipment.mainhand = weapon;
    applyIntent(s, content, { type: "SET_ATTACK_OPTION", option: opt }, c.ctx());
    if (def.requiresFlag) p.flags.push(def.requiresFlag);
    p.pos = { x: def.x + 1, y: def.y }; p.prevPos = { ...p.pos }; p.path = [];
    applyIntent(s, content, { type: "INTERACT", objId, path: [] }, c.ctx());
    const start = c.now;
    while (c.now - start < 60_000) {
      c.now += 100;
      p.maxHp = 1_000_000; p.hp = 1_000_000;
      for (const e of tick(s, content, c.ctx())) {
        if (e.type === "DAMAGE" && e.targetId === objId) { swings++; if (e.amount > 0) hits++; }
      }
    }
  }
  return swings ? hits / swings : 0;
}

// Pick a crush-weak monster with enough HP to produce a real sample — a
// level-9 spider dies in three swings, and three swings cannot distinguish a
// hit-rate difference from noise.
const crushWeak = Object.entries(content.monsters)
  .filter(([id, m]) => m.weakness?.includes("crush")
    // NOT also stab-weak: several monsters are weak to both, and against one of
    // those the spear's Pound and Lunge are equally right, so the comparison
    // would prove nothing.
    && !m.weakness?.includes("stab")
    && (m.hp ?? 0) >= 300
    && content.objects.some((o) => o.kind === "monster" && o.monster === id))
  .sort((a, b) => (b[1].hp ?? 0) - (a[1].hp ?? 0))[0];
if (spear && crushWeak) {
  const [mid] = crushWeak;
  const wt = wepTypeOf(content.items[spear]);
  const pound = WEAPON_STYLES[wt].findIndex((o) => o.type === "crush");
  const lunge = WEAPON_STYLES[wt].findIndex((o) => o.type === "stab");
  const onWeak = hitRate(mid, spear, pound);
  const offWeak = hitRate(mid, spear, lunge);
  console.log(`${mid} (crush-weak), spear: Pound ${round(onWeak * 100, 1)}% vs Lunge ${round(offWeak * 100, 1)}% hit rate`);
  check(onWeak > offWeak, `matching the weakness (${round(onWeak, 3)}) did not beat missing it (${round(offWeak, 3)})`);
} else {
  fails.push("no crush-but-not-stab-weak monster with a spawn to test the payoff against");
}

if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("\nOK");
export {};
