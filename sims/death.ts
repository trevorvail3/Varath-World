/**
 * sims/death.ts
 * -------------
 * Checks the gravestone.
 *
 *   npx tsx sims/death.ts
 *
 * Death is the one system a player cannot safely test for themselves, and every
 * failure mode here is silent: a grave that keeps the wrong items, a second
 * death that leaves two graves, a reclaim that drops what will not fit. Exits
 * non-zero on failure.
 */

import { content, makeWorld, SimClock, levelMatchedPlayer } from "./harness.ts";
import { tick, TICK_MS } from "../src/core/worldCore.ts";
import type { ItemId, WorldState } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

/** Fill a pack with distinct valuable stacks so the keep/bury split is visible. */
function stockPack(state: WorldState, n: number): ItemId[] {
  const p = state.player;
  p.inventory = p.inventory.map(() => null);
  const valuable = Object.entries(content.items)
    .filter(([, d]) => (d.sell ?? 0) > 300 && !d.stackable)
    .sort((a, b) => (b[1].sell ?? 0) - (a[1].sell ?? 0))
    .slice(0, n)
    .map(([id]) => id as ItemId);
  valuable.forEach((id, i) => { p.inventory[i] = { item: id, qty: 1 }; });
  return valuable;
}

/** Kill the player outright by running ticks with zero HP. */
function killNow(state: WorldState, clock: SimClock): void {
  state.player.hp = 0;
  state.player.poison = { dmg: 99, nextAt: clock.now, hitsLeft: 1 };
  for (let i = 0; i < 4 && state.player.alive; i++) {
    clock.now += TICK_MS;
    tick(state, content, clock.ctx());
  }
}

// --- 1. Death buries everything but the kept stacks, and the gold ------------
{
  const clock = new SimClock(4);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 50);
  const ids = stockPack(st, 10);
  st.player.gold = 10_000;
  killNow(st, clock);

  check(!st.player.alive, "the player should be dead");
  check(!!st.grave, "a grave should stand where they fell");
  const kept = st.player.inventory.filter((s) => s !== null).length;
  check(kept === 3, `should keep exactly 3 stacks, kept ${kept}`);
  check(st.grave?.items.length === ids.length - 3, `grave should hold ${ids.length - 3}, holds ${st.grave?.items.length}`);
  check(st.player.gold === 9_000, `should lose a tenth of carried coin, has ${st.player.gold}`);
  check(st.grave?.gold === 1_000, `the coin should be IN the grave, grave has ${st.grave?.gold}`);
  console.log(`death: kept ${kept} stacks, buried ${st.grave?.items.length} + ${st.grave?.gold}g`);
}

// --- 2. A lit blessing buys back one stack ----------------------------------
{
  const clock = new SimClock(4);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 50);
  stockPack(st, 10);
  st.player.blessing = content.spells.find((sp) => sp.deflectStyle)?.id ?? null;
  check(!!st.player.blessing, "no protection blessing exists to test with");
  killNow(st, clock);
  const kept = st.player.inventory.filter((s) => s !== null).length;
  check(kept === 4, `a lit blessing should keep 4 stacks, kept ${kept}`);
  check(!st.player.blessing, "the blessing should be spent by the death it softened");
}

// --- 3. Walking onto the grave takes it all back ----------------------------
{
  const clock = new SimClock(4);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 50);
  stockPack(st, 10);
  st.player.gold = 10_000;
  killNow(st, clock);
  const grave = st.grave!;
  const owed = grave.items.length;

  // Respawn, then stand on the grave.
  st.player.alive = true;
  st.player.hp = st.player.maxHp;
  st.player.inventory = st.player.inventory.map(() => null);
  st.player.pos = { x: grave.x, y: grave.y };
  st.player.prevPos = { ...st.player.pos };
  clock.now += TICK_MS;
  tick(st, content, clock.ctx());

  const back = st.player.inventory.filter((s) => s !== null).length;
  check(back === owed, `should reclaim all ${owed} stacks, got ${back}`);
  check(st.player.gold === 10_000, `coin should come back too, has ${st.player.gold}`);
  check(!st.grave, "the grave should settle once emptied");
}

// --- 4. A full pack reclaims what fits and the grave keeps the rest ---------
{
  const clock = new SimClock(4);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 50);
  stockPack(st, 12);
  killNow(st, clock);
  const grave = st.grave!;
  const owed = grave.items.length;
  check(owed >= 2, "need at least two buried stacks for this check");

  st.player.alive = true;
  st.player.hp = st.player.maxHp;
  // Every slot full of something the grave is not holding.
  const filler = Object.keys(content.items)[0] as ItemId;
  st.player.inventory = st.player.inventory.map(() => ({ item: filler, qty: 1 }));
  st.player.pos = { x: grave.x, y: grave.y };
  st.player.prevPos = { ...st.player.pos };
  clock.now += TICK_MS;
  tick(st, content, clock.ctx());

  check(!!st.grave, "a grave with items left must NOT vanish on a partial reclaim");
  check((st.grave?.items.length ?? 0) > 0, "the unclaimed stacks must still be in the grave");
}

// --- 5. A second death collapses the first grave — never two ----------------
{
  const clock = new SimClock(4);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 50);
  stockPack(st, 10);
  killNow(st, clock);
  const first = { x: st.grave!.x, y: st.grave!.y };

  st.player.alive = true;
  st.player.hp = st.player.maxHp;
  stockPack(st, 10);
  st.player.pos = { x: first.x + 6, y: first.y };
  killNow(st, clock);

  check(!!st.grave, "the second death should raise its own grave");
  check(st.grave!.x === first.x + 6, "the grave should stand where you fell THIS time");
  check(st.grave!.deaths === 2, `deaths should count up, is ${st.grave!.deaths}`);
}

// --- 6. A grave crumbles when its time runs out ------------------------------
{
  const clock = new SimClock(4);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 50);
  stockPack(st, 10);
  killNow(st, clock);
  const ttl = st.grave!.expiresAt - clock.now;
  // Devotion buys time — an earned extension, never a purchased one.
  check(ttl > 15 * 60_000, `a level-50 Devotion should extend the grave, ttl ${Math.round(ttl / 1000)}s`);
  st.player.alive = true;
  st.player.hp = st.player.maxHp;
  const end = clock.now + ttl + 5 * TICK_MS;
  while (clock.now < end && st.grave) {
    clock.now += TICK_MS * 20;
    tick(st, content, clock.ctx());
  }
  check(!st.grave, "the grave should crumble once its time is up");
  console.log(`grave ttl at Devotion 50: ${Math.round(ttl / 60000)} minutes`);
}

// --- 7. An old save with no grave boots and dies without throwing -----------
{
  const clock = new SimClock(4);
  const st = makeWorld(clock);
  levelMatchedPlayer(st, 20);
  delete (st as { grave?: unknown }).grave;
  stockPack(st, 6);
  killNow(st, clock);
  check(!st.player.alive, "a save with no grave field should still be able to die");
}

if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("\nOK");
export {};
