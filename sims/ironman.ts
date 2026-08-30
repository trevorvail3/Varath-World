/**
 * sims/ironman.ts
 * ---------------
 * Checks the account modes.
 *
 *   npx tsx sims/ironman.ts
 *
 * An Ironman's whole claim is "everything I have, I got myself". A gate that
 * silently does nothing looks exactly like a player who chose not to trade, so
 * every restriction is exercised here through the real intent path — the same
 * path a modified client would use. Also checks the one-way rule: a mode can be
 * given up but never acquired, or the claim means nothing.
 * Exits non-zero on failure.
 */

import { content, makeWorld, SimClock, levelMatchedPlayer } from "./harness.ts";
import { applyIntent, tick, canSetMode, isIronman, modeOf } from "../src/core/worldCore.ts";
import type { AccountMode } from "../src/core/worldCore.ts";
import { serializePlayer, hydratePlayer } from "../src/core/save.ts";
import type { ItemId, WorldState } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

const MODES: AccountMode[] = ["standard", "ironman", "hardcore", "ultimate"];
const GOODS: ItemId = "ashiron_bar";

function world(mode: AccountMode): { st: WorldState; clock: SimClock } {
  const clock = new SimClock(7);
  const st = makeWorld(clock);
  if (mode !== "standard") st.player.mode = mode;
  return { st, clock };
}

// --- The Grand Exchange -----------------------------------------------------
for (const mode of MODES) {
  const { st, clock } = world(mode);
  const before = st.player.gold;
  applyIntent(st, content, { type: "GE_MOVE", kind: "gold", dir: "give", amount: 5000 }, clock.ctx());
  const moved = st.player.gold - before;
  if (mode === "standard") check(moved === 5000, `standard could not use the Grand Exchange (moved ${moved})`);
  else check(moved === 0, `${mode} pulled ${moved} gold out of the Grand Exchange`);
}

// --- Player trade -----------------------------------------------------------
for (const mode of MODES) {
  const { st, clock } = world(mode);
  const before = st.player.gold;
  applyIntent(st, content, {
    type: "TRADE_APPLY",
    tradeId: 1,
    give: { gold: 0, items: [] },
    get: { gold: 9000, items: [{ item: GOODS, qty: 5 }] },
  }, clock.ctx());
  const gained = st.player.gold - before;
  const got = st.player.inventory.filter((s) => s?.item === GOODS).length;
  if (mode === "standard") check(gained === 9000 && got > 0, `standard could not complete a trade (gold ${gained}, items ${got})`);
  else check(gained === 0 && got === 0, `${mode} received ${gained} gold and ${got} item stacks from a trade`);

  // A refused trade must also be un-replayable: sending it again must not pay.
  if (mode !== "standard") {
    applyIntent(st, content, {
      type: "TRADE_APPLY",
      tradeId: 1,
      give: { gold: 0, items: [] },
      get: { gold: 9000, items: [] },
    }, clock.ctx());
    check(st.player.gold - before === 0, `${mode} was paid by replaying a refused trade`);
  }
}

// --- Duel stakes ------------------------------------------------------------
for (const mode of MODES) {
  const { st, clock } = world(mode);
  st.player.gold = 10_000;
  applyIntent(st, content, { type: "DUEL_STAKE", duelId: "d1", gold: 500, items: [] }, clock.ctx());
  const staked = !!st.player.duelStake;
  if (mode === "standard") check(staked, "standard could not stake a duel");
  else check(!staked, `${mode} locked a duel stake`);
}

// --- The bank ---------------------------------------------------------------
// Only Ultimate loses it; the others must keep it, or the gate is too broad.
for (const mode of MODES) {
  const { st, clock } = world(mode);
  const p = st.player;
  p.inventory[0] = { item: GOODS, qty: 3 };
  p.station = { kind: "bank" };
  applyIntent(st, content, { type: "DEPOSIT", item: GOODS, qty: 3 }, clock.ctx());
  const banked = p.bank[GOODS] ?? 0;
  if (mode === "ultimate") check(banked === 0, `ultimate banked ${banked} items`);
  else check(banked === 3, `${mode} could not use the bank (banked ${banked})`);
}
// …and the bank must not even open for an Ultimate.
{
  const { st, clock } = world("ultimate");
  const bank = content.objects.find((o) => o.kind === "bank");
  if (!bank) fails.push("no bank object in the world to test against");
  else {
    st.player.pos = { x: bank.x + 1, y: bank.y };
    st.player.prevPos = { ...st.player.pos };
    st.player.path = [];
    const ev = applyIntent(st, content, { type: "INTERACT", objId: bank.id, path: [] }, clock.ctx());
    check(!ev.some((e) => e.type === "OPEN_BANK"), "the bank opened for an Ultimate Ironman");
    check(st.player.station?.kind !== "bank", "an Ultimate Ironman was docked at the bank");
  }
}

// --- Hardcore: one life -----------------------------------------------------
{
  const { st, clock } = world("hardcore");
  levelMatchedPlayer(st, 40);
  const p = st.player;
  check(modeOf(p) === "hardcore", "the hardcore fixture did not start hardcore");
  // Kill the player through the real tick path: poison with no cure and no HP.
  p.hp = 1;
  p.poison = { dmg: 50, nextAt: clock.now, hitsLeft: 40 };
  let died = false;
  for (let i = 0; i < 200 && !died; i++) {
    clock.now += 600;
    for (const e of tick(st, content, clock.ctx())) if (e.type === "PLAYER_DIED") died = true;
  }
  check(died, "the hardcore fixture never died, so the life was never spent");
  if (died) {
    check(modeOf(p) === "ironman", `a spent hardcore life left the account as "${modeOf(p)}", expected ironman`);
    check(!!p.hardcoreDeath, "a spent hardcore life recorded no death");
    check(!!p.hardcoreDeath?.cause, "the hardcore death record has no cause");
    check(isIronman(p), "a spent hardcore life dropped the Ironman restrictions entirely");
    // A second death must not overwrite the record of the first.
    const first = { ...p.hardcoreDeath! };
    p.alive = true; p.hp = 1;
    p.poison = { dmg: 50, nextAt: clock.now, hitsLeft: 40 };
    for (let i = 0; i < 200; i++) {
      clock.now += 600;
      let again = false;
      for (const e of tick(st, content, clock.ctx())) if (e.type === "PLAYER_DIED") again = true;
      if (again) break;
    }
    check(
      p.hardcoreDeath?.cause === first.cause && p.hardcoreDeath?.playMs === first.playMs,
      "a later death overwrote the hardcore record",
    );
  }
}

// --- The one-way rule -------------------------------------------------------
for (const from of MODES) {
  for (const to of MODES) {
    const { st, clock } = world(from);
    const allowed = canSetMode(st.player, to);
    // The stated rule: strictly toward less restriction, and never sideways
    // between hardcore and ultimate (both are Ironman plus one extra stake).
    const rank: Record<AccountMode, number> = { standard: 0, ironman: 1, hardcore: 2, ultimate: 2 };
    const expected = rank[to] < rank[from];
    check(allowed === expected, `canSetMode(${from} -> ${to}) said ${allowed}, expected ${expected}`);
    applyIntent(st, content, { type: "SET_MODE", mode: to }, clock.ctx());
    check(
      modeOf(st.player) === (expected ? to : from),
      `SET_MODE ${from} -> ${to} left the account as ${modeOf(st.player)}`,
    );
  }
}

// --- The save round-trip ----------------------------------------------------
// The mode and the Hardcore record are only worth anything if they survive a
// reload, and a field added to Player but forgotten in save.ts fails silently:
// the account simply comes back Standard. (That exact bug shipped once here,
// with combatFeats — so both are checked, through the real serialiser.)
for (const mode of MODES) {
  const { st } = world(mode);
  st.player.combatFeats = ["vorlag:perfect", "greyback:swift"];
  if (mode === "hardcore") st.player.hardcoreDeath = { cause: "Something took you.", combatLevel: 77, playMs: 5_400_000 };
  const blob = JSON.parse(JSON.stringify(serializePlayer(st))) as unknown;

  const fresh = world("standard");
  const ok = hydratePlayer(fresh.st, content, blob);
  check(ok, `${mode}: hydratePlayer refused its own serialised save`);
  check(modeOf(fresh.st.player) === mode, `${mode} came back from a save as ${modeOf(fresh.st.player)}`);
  check(
    (fresh.st.player.combatFeats ?? []).join() === "vorlag:perfect,greyback:swift",
    `${mode}: combat feats did not survive the save round-trip`,
  );
  if (mode === "hardcore") {
    const d = fresh.st.player.hardcoreDeath;
    check(d?.combatLevel === 77 && d?.playMs === 5_400_000, `${mode}: the hardcore death record did not survive the save`);
  }
}

// --- Standard accounts are untouched ---------------------------------------
// Every existing save is a standard account with no `mode` field at all, so the
// absent case has to read as unrestricted rather than as anything else.
{
  const { st } = world("standard");
  check(st.player.mode === undefined, "the standard fixture wrote a mode field");
  check(modeOf(st.player) === "standard", "an absent mode did not read as standard");
  check(!isIronman(st.player), "an absent mode read as an Ironman");
}

console.log(`modes ${MODES.join(", ")} · gates: exchange, trade, duel stake, bank`);
if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("\nPASS");
