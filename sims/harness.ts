/**
 * sims/harness.ts
 * ---------------
 * Shared plumbing for the headless balance sims. These exist because the repo
 * has no test runner: `tsc --noEmit` proves the data is consistent, and these
 * sims prove the *numbers* haven't moved. Run them before and after any change
 * to combat, movement or gathering cadence.
 *
 * Everything here drives the real core through its real seams — `createWorld`,
 * `applyIntent`, `tick` — so a sim can never disagree with the game about how
 * the game works.
 */

import { content, playerStart } from "../src/content/index.ts";
import { mulberry32 } from "../src/core/duelCore.ts";
import { createWorld, tick, TICK_MS, equipRequirement, HUNT_GATES } from "../src/core/worldCore.ts";
import { xpForLevel } from "../src/content/xpCurve.ts";
import type { Ctx, ItemId, Player, SkillId, WorldState } from "../src/core/types.ts";

/** The wall-clock epoch every sim starts from — fixed so farming is reproducible. */
export const SIM_EPOCH = 1_756_000_000_000;

/**
 * A sim clock. The core wants a monotonic `now`; we advance it explicitly so a
 * run is deterministic and doesn't depend on how fast the machine is.
 */
export class SimClock {
  now = 0;
  private readonly rng: () => number;

  constructor(seed = 1) {
    this.rng = mulberry32(seed);
  }

  ctx(): Ctx {
    return { now: this.now, rng: this.rng, epoch: SIM_EPOCH + this.now };
  }
}

/** A fresh world at the normal player spawn. */
export function makeWorld(clock: SimClock): WorldState {
  return createWorld(content, playerStart, clock.ctx());
}

/**
 * Advance the sim by `ms`, calling `tick()` in frame-sized slices so the
 * accumulator inside `tick` behaves the way it does under a real rAF loop.
 * Feeding it one giant jump instead would hit the catch-up clamp and silently
 * simulate less time than asked — which is exactly the bug class these sims
 * are meant to catch.
 */
export function advance(state: WorldState, clock: SimClock, ms: number, sliceMs = 16): number {
  const target = clock.now + ms;
  let ticksBefore = state.tickCount;
  while (clock.now < target) {
    clock.now = Math.min(target, clock.now + sliceMs);
    tick(state, content, clock.ctx());
  }
  return state.tickCount - ticksBefore;
}

/** Advance until `pred` holds or `limitMs` elapses. Returns ms actually spent. */
export function advanceUntil(
  state: WorldState,
  clock: SimClock,
  pred: () => boolean,
  limitMs: number,
  sliceMs = 16,
): number {
  const start = clock.now;
  while (clock.now - start < limitMs) {
    if (pred()) break;
    clock.now += sliceMs;
    tick(state, content, clock.ctx());
  }
  return clock.now - start;
}

/** Give a player a skill level outright (sims don't grind to get there). */
export function setLevel(player: Player, skill: SkillId, level: number): void {
  player.skills[skill] = { xp: xpForLevel[level] ?? 0, level };
}

/** The core's `skillLvl` is private; sims read the level off the state directly. */
export function levelOf(player: Player, skill: SkillId): number {
  return player.skills[skill]?.level ?? 1;
}

/**
 * A player at `level` in every combat skill, wearing the best gear in each slot
 * that `equipRequirement` will actually let them wear. Every balance sim shares
 * this definition so "a level-70 player" means one thing across all of them.
 */
export function levelMatchedPlayer(state: WorldState, level: number): Player {
  const { player } = state;
  for (const s of ["vitality", "edge", "vigour", "ward", "draw", "faith"] as SkillId[]) {
    setLevel(player, s, level);
  }
  // Bounty is a GATE, not a combat stat: several monsters refuse to be fought
  // below a Bounty requirement ("it takes Bounty 20 to hunt a Warren Creeper").
  // Max it so the gate never silently excludes a monster from a balance sim.
  setLevel(player, "bounty", 100);
  // Same for the Slayer-style tool gates: a couple of monsters cannot be harmed
  // at all without a consumable or its permanent mastery. Granting the masteries
  // (read from the real table, so this can't drift) removes the gate without
  // touching any combat stat.
  for (const gate of Object.values(HUNT_GATES)) {
    if (!player.bounty.unlocks.includes(gate.unlock)) player.bounty.unlocks.push(gate.unlock);
  }
  player.maxHp = 10 + levelOf(player, "vitality");
  player.hp = player.maxHp;

  // Best wearable per slot: walk every item, keep the highest-tier one whose
  // requirement this player passes.
  const best = new Map<string, { id: ItemId; tier: number }>();
  for (const [id, def] of Object.entries(content.items)) {
    if (!def.slot) continue;
    const req = equipRequirement(content, id as ItemId);
    if (req && levelOf(player, req.skill) < req.level) continue;
    const tier = def.tier ?? 0;
    const cur = best.get(def.slot);
    if (!cur || tier > cur.tier) best.set(def.slot, { id: id as ItemId, tier });
  }
  for (const [slot, pick] of best) {
    (player.equipment as Record<string, ItemId>)[slot] = pick.id;
  }
  return player;
}

/** Round to `dp` decimals — keeps committed fixtures diff-stable. */
export function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export { content, TICK_MS };
