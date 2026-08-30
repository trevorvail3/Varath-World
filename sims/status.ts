/**
 * sims/status.ts
 * --------------
 * Checks poison and venom.
 *
 *   npx tsx sims/status.ts
 *
 * Status effects tick on their own clock and can kill you between swings, which
 * makes them easy to get subtly wrong and hard to notice in play: a poison that
 * never expires, or one that stops biting a tick early, looks fine on screen.
 * Exits non-zero on failure.
 */

import { content, makeWorld, SimClock, levelMatchedPlayer } from "./harness.ts";
import { applyIntent, tick, TICK_MS } from "../src/core/worldCore.ts";
import type { ItemId } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

/**
 * Advance `ms`, collecting every status bite that lands on the player.
 *
 * The subject is kept alive on purpose: `syncMaxHp` re-derives max HP from
 * Vitality every tick, so a big HP number set up front is clamped away and
 * venom simply kills the test before it can show its shape. Death is checked
 * separately, further down.
 */
function bites(state: ReturnType<typeof makeWorld>, clock: SimClock, ms: number): number[] {
  const out: number[] = [];
  const end = clock.now + ms;
  while (clock.now < end) {
    clock.now += TICK_MS;
    state.player.hp = state.player.maxHp;
    for (const e of tick(state, content, clock.ctx())) {
      if (e.type === "DAMAGE" && e.targetId === "player" && (e.kind === "poison" || e.kind === "venom")) {
        out.push(e.amount);
      }
    }
  }
  return out;
}

// --- 1. Poison bites, weakens, and stops on its own -------------------------
{
  const clock = new SimClock(5);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 60);
  st.player.poison = { dmg: 8, nextAt: clock.now + TICK_MS, hitsLeft: 8 };
  const seq = bites(st, clock, 10 * 60_000);
  console.log(`poison bites: ${seq.join(", ")}`);
  check(seq.length === 8, `poison should bite exactly 8 times, bit ${seq.length}`);
  check(seq.every((v, i) => i === 0 || v <= seq[i - 1]!), "poison should weaken, never strengthen");
  check(seq[seq.length - 1]! < seq[0]!, "poison should end weaker than it began");
  check(!st.player.poison, "poison should clear itself once spent");
}

// --- 2. Venom ramps and never clears itself ---------------------------------
{
  const clock = new SimClock(5);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 60);
  st.player.venom = { stack: 0, nextAt: clock.now + TICK_MS };
  const seq = bites(st, clock, 10 * 60_000);
  console.log(`venom bites:  ${seq.join(", ")}`);
  check(seq.length >= 20, `venom should keep biting for as long as it is left alone, bit only ${seq.length}`);
  check(seq.every((v, i) => i === 0 || v >= seq[i - 1]!), "venom should ramp, never weaken");
  check(seq[seq.length - 1]! > seq[0]!, "venom should end stronger than it began");
  check(!!st.player.venom, "venom must NOT clear itself — an antidote is the only answer");
  const cap = Math.max(...seq);
  check(seq.filter((v) => v === cap).length >= 1 && cap <= 20, `venom should cap (peaked at ${cap})`);
}

// --- 3. An antidote ends both ----------------------------------------------
for (const which of ["poison", "venom"] as const) {
  const clock = new SimClock(5);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 60);
  const p = st.player;
  if (which === "poison") p.poison = { dmg: 8, nextAt: clock.now + TICK_MS, hitsLeft: 8 };
  else p.venom = { stack: 0, nextAt: clock.now + TICK_MS };
  p.inventory = p.inventory.map(() => null);
  p.inventory[0] = { item: "pot_antidote" as ItemId, qty: 1 };
  applyIntent(st, content, { type: "EAT", slot: 0 }, clock.ctx());
  check(!p.poison && !p.venom, `antidote failed to clear ${which}`);
  check(p.inventory[0]?.item === "pot_antidote_1", `antidote should leave its second dose (${which})`);
  check(bites(st, clock, 5 * 60_000).length === 0, `${which} kept biting after the antidote`);
}

// --- 4. Poison can actually kill, through the one shared death path ---------
{
  const clock = new SimClock(5);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 60);
  const p = st.player;
  p.hp = 3;
  p.poison = { dmg: 8, nextAt: clock.now + TICK_MS, hitsLeft: 8 };
  let died = false;
  const end = clock.now + 60_000;
  while (clock.now < end && !died) {
    clock.now += TICK_MS;
    for (const e of tick(st, content, clock.ctx())) if (e.type === "PLAYER_DIED") died = true;
  }
  check(died, "poison should be able to finish a player off");
  check(p.hp >= 0, "HP must never go negative");
  check(!p.poison && !p.venom, "death should clear what was burning through you");
}

// --- 5. The content wiring is real -----------------------------------------
{
  const venomous = Object.entries(content.monsters).filter(([, m]) => m.venom);
  const poisonous = Object.entries(content.monsters).filter(([, m]) => m.poison);
  const coated = Object.entries(content.items).filter(([, d]) => d.poison);
  const cures = Object.entries(content.items).filter(([, d]) => d.curePoison);
  console.log(`content: ${poisonous.length} poisonous monsters (${venomous.length} venomous), ${coated.length} coated items, ${cures.length} cures`);
  check(poisonous.length > 0, "no monster inflicts poison");
  check(venomous.length > 0, "no monster inflicts venom");
  check(coated.length > 0, "the player has no way to poison anything");
  check(cures.length > 0, "there is no cure — a status you cannot answer is a tax, not a mechanic");
}

if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("\nOK");
export {};
