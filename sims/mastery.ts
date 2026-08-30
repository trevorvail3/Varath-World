/**
 * sims/mastery.ts
 * ---------------
 * Checks mastery: the layer above level 100, and the gear it unlocks.
 *
 *   npx tsx sims/mastery.ts
 *
 * Three things here fail silently. A once-only grant can double-pay (two embers
 * for one star) or never pay at all; a save loaded already past a star can skip
 * the crossing it never saw; and an equip gate that does nothing looks exactly
 * like a player who has the stars. All three are exercised through the real
 * core. Exits non-zero on failure.
 */

import { content, makeWorld, SimClock, setLevel } from "./harness.ts";
import {
  applyIntent, ASCENDANT_EMBER, masteryRequirement, masteryStars,
  MASTERY_TIERS, tick, totalMasteryStars,
} from "../src/core/worldCore.ts";
import { serializePlayer, hydratePlayer } from "../src/core/save.ts";
import type { ItemId, Player, SkillId, WorldState } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

/** Every ember the player holds, wherever it sits. */
function embers(p: Player): number {
  const pack = p.inventory.reduce((n, s) => n + (s?.item === ASCENDANT_EMBER ? s.qty : 0), 0);
  return pack + (p.bank[ASCENDANT_EMBER] ?? 0);
}

/** Put a skill at `xp` and let the world run, so the crossing is settled by the
 *  real core rather than by anything this file does. */
function trainTo(st: WorldState, clock: SimClock, skill: SkillId, xp: number): void {
  setLevel(st.player, skill, 100);
  st.player.skills[skill].xp = xp;
  clock.now += 600;
  tick(st, content, clock.ctx());
}

const SKILL: SkillId = "mining";

// --- One ember per star, once ----------------------------------------------
{
  const clock = new SimClock(7);
  const st = makeWorld(clock);
  const p = st.player;
  check(totalMasteryStars(p) === 0, "a fresh character already had master stars");
  check(embers(p) === 0, "a fresh character already held an Ascendant Ember");

  // Cross each tier in turn and check the ember arrives exactly once.
  for (let i = 0; i < MASTERY_TIERS.length; i++) {
    const tier = MASTERY_TIERS[i]!;
    trainTo(st, clock, SKILL, tier);
    check(masteryStars(p, SKILL) === i + 1, `at ${tier} XP the skill showed ${masteryStars(p, SKILL)} stars, expected ${i + 1}`);
    check(embers(p) === i + 1, `after crossing star ${i + 1} the player held ${embers(p)} embers, expected ${i + 1}`);
    // Training on past the tier must not mint a second.
    trainTo(st, clock, SKILL, tier + 500_000);
    check(embers(p) === i + 1, `training past star ${i + 1} minted a duplicate ember (${embers(p)})`);
  }
}

// --- A save already past a star still pays -----------------------------------
// The flags are what make the grant once-only, and they persist with the save.
// A character loaded at 60M XP has crossed two stars the running game never saw,
// so the first XP tick after the load must settle up — and only once.
{
  const clock = new SimClock(11);
  const st = makeWorld(clock);
  setLevel(st.player, SKILL, 100);
  st.player.skills[SKILL].xp = 60_000_000;
  const blob = JSON.parse(JSON.stringify(serializePlayer(st))) as unknown;

  const fresh = makeWorld(new SimClock(11));
  const c2 = new SimClock(11);
  check(hydratePlayer(fresh, content, blob), "hydratePlayer refused its own save");
  check(fresh.player.skills[SKILL].xp >= 50_000_000, "the loaded save lost its post-max XP");
  check(embers(fresh.player) === 0, "the ember arrived before any XP was granted");
  trainTo(fresh, c2, SKILL, 60_000_000);
  check(embers(fresh.player) === 2, `a save loaded at 60M XP settled ${embers(fresh.player)} embers, expected 2`);
  trainTo(fresh, c2, SKILL, 60_500_000);
  check(embers(fresh.player) === 2, `settling up ran twice (${embers(fresh.player)} embers)`);
}

// --- A full pack postpones an ember; it never eats one -----------------------
// The flag is what makes the grant once-only, so setting it before the ember is
// actually delivered would destroy the reward for tens of hours of play. The
// Ultimate Ironman is the sharp case: the overflow bank is one they can never
// open, so for them a full pack has to mean "later".
for (const mode of ["ironman", "ultimate"] as const) {
  const clock = new SimClock(5);
  const st = makeWorld(clock);
  const p = st.player;
  p.mode = mode;
  for (let i = 0; i < p.inventory.length; i++) p.inventory[i] = { item: "big_bones" as ItemId, qty: 1 };
  trainTo(st, clock, SKILL, MASTERY_TIERS[0]!);
  if (mode === "ultimate") {
    check(embers(p) === 0, `ultimate with a full pack received ${embers(p)} embers it could not hold`);
    check((p.bank[ASCENDANT_EMBER] ?? 0) === 0, "an ultimate's ember was banked into a bank it cannot open");
    // Free a slot: the very next tick must pay up.
    p.inventory[0] = null;
    clock.now += 600;
    tick(st, content, clock.ctx());
    check(embers(p) === 1, `ultimate was not paid after freeing a slot (${embers(p)} embers)`);
  } else {
    check(embers(p) === 1, `ironman with a full pack lost its ember (${embers(p)})`);
  }
}

// --- The Ascendant tier is gated on stars, and reachable ---------------------
const ASC = (Object.keys(content.items) as ItemId[]).filter((id) => masteryRequirement(content, id) > 0);
check(ASC.length > 0, "no item gates on mastery, so the tier does not exist");
{
  // Every piece must be forgeable, and only from embers — otherwise the gate is
  // decorative and the gear is just another drop.
  for (const id of ASC) {
    const act = (content.actions as { produces?: string; requires?: Record<string, number> }[])
      .find((a) => a.produces === id);
    check(!!act, `${id} gates on mastery but nothing forges it`);
    check(!!act?.requires?.[ASCENDANT_EMBER], `${id} is forgeable without an Ascendant Ember`);
  }
  // The whole tier must cost less than a full account's mastery, or it is
  // unfinishable by construction.
  const cost = ASC.reduce((n, id) => {
    const act = (content.actions as { produces?: string; requires?: Record<string, number> }[])
      .find((a) => a.produces === id);
    return n + (act?.requires?.[ASCENDANT_EMBER] ?? 0);
  }, 0);
  const maxStars = Object.keys(content.items) && MASTERY_TIERS.length * Object.keys((makeWorld(new SimClock(1))).player.skills).length;
  check(cost <= maxStars, `the full Ascendant tier costs ${cost} embers but an account can only ever mint ${maxStars}`);
  const worst = Math.max(...ASC.map((id) => masteryRequirement(content, id)));
  check(worst <= maxStars, `a piece needs ${worst} stars but only ${maxStars} exist`);
  console.log(`ascendant pieces ${ASC.length} · ${cost} embers for the set · ${maxStars} stars in an account`);
}

// --- The gate actually refuses ----------------------------------------------
{
  const gated = ASC.map((id) => ({ id, stars: masteryRequirement(content, id) })).sort((a, b) => b.stars - a.stars)[0]!;
  const clock = new SimClock(3);
  const st = makeWorld(clock);
  const p = st.player;
  // Max every combat skill, so ONLY mastery can be what stops them.
  for (const sk of Object.keys(p.skills) as SkillId[]) setLevel(p, sk, 100);
  p.inventory[0] = { item: gated.id, qty: 1 };
  applyIntent(st, content, { type: "EQUIP", slot: 0 }, clock.ctx());
  const worn = Object.values(p.equipment).includes(gated.id);
  check(!worn, `${gated.id} was worn at 0 stars despite needing ${gated.stars}`);

  // …and allows it once the stars are there.
  for (const sk of Object.keys(p.skills) as SkillId[]) p.skills[sk].xp = MASTERY_TIERS[0]!;
  check(totalMasteryStars(p) >= gated.stars, "the fixture could not reach the required stars");
  applyIntent(st, content, { type: "EQUIP", slot: 0 }, clock.ctx());
  check(
    Object.values(st.player.equipment).includes(gated.id),
    `${gated.id} was still refused at ${totalMasteryStars(p)} stars, needing ${gated.stars}`,
  );
}

// --- It is the best gear in the game ----------------------------------------
// A tier above everything that is not actually above anything is just items.
{
  for (const id of ASC) {
    const def = content.items[id]!;
    if (!def.slot) continue;
    const score = (d: { def?: number; acc?: number; dmg?: number }): number => (d.def ?? 0) + (d.acc ?? 0) + (d.dmg ?? 0);
    // Like for like. Comparing acc+dmg across weapon families says a maul is
    // worse than a greatsword, which is a statement about crush vs slash, not
    // about the tier — so a weapon is measured against its own family only.
    const rivals = (Object.values(content.items) as typeof def[])
      .filter((d) => d.slot === def.slot && d.id !== id && !masteryRequirement(content, d.id) && !d.tool)
      .filter((d) => !!d.ranged === !!def.ranged && !!d.magic === !!def.magic)
      .filter((d) => (def.wepType ? d.wepType === def.wepType : true));
    const family = def.wepType ?? (def.ranged ? "bows" : def.magic ? "staves" : def.slot);
    const best = Math.max(0, ...rivals.map(score));
    check(score(def) > best, `${id} (${score(def)}) is not the best ${family} in the game (${best})`);
  }
}

console.log(`mastery tiers ${MASTERY_TIERS.map((t) => t / 1_000_000 + "M").join(", ")}`);
if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("\nPASS");
