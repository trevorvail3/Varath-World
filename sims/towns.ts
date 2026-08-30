/**
 * sims/towns.ts
 * -------------
 * Checks the six region seats.
 *
 *   npx tsx sims/towns.ts
 *
 * A town is the end of an hour's walk, so the thing worth asserting is that the
 * walk pays: you can bank, you can restock, you can use a station, and the
 * people are standing on ground you can reach. Generated objects laid over a
 * seat that is already populated is exactly where this went wrong repeatedly —
 * duplicate banks, and folk sealed inside cottages — so both are checked.
 * Exits non-zero on failure.
 */

import { content, makeWorld, SimClock } from "./harness.ts";
import { buildWalkability } from "../src/core/worldCore.ts";
import { TOWNS, TOWN_RX, TOWN_RY, buildTownObjects } from "../src/content/towns.ts";
import { fromV2 } from "../src/content/map.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

const STATIONS = ["bank", "furnace", "anvil", "cauldron", "workbench", "sawmill", "crafting_table"];
const st = makeWorld(new SimClock(1));
for (const o of content.objects) if (o.requiresFlag && !st.player.flags.includes(o.requiresFlag)) st.player.flags.push(o.requiresFlag);
const walk = buildWalkability(content, st);
// The SHIPPED objects, not a fresh derivation: the real ones are built with an
// occupancy set (see content/index.ts), and re-deriving without it tests a
// layout the game never uses — which is what made two already-fixed collisions
// keep reporting as broken.
const built = content.objects.filter((o) => o.id.startsWith("seat_"));
check(built.length === buildTownObjects(fromV2).length, "some generated town objects did not reach the world");

check(TOWNS.length === 6, `${TOWNS.length} towns, expected the six region seats`);
const ids = new Set(built.map((o) => o.id));
check(ids.size === built.length, "two generated town objects share an id");
check(new Set(content.objects.map((o) => o.id)).size === content.objects.length, "a town object id collides with a hand-authored spawn");

for (const t of TOWNS) {
  const c = fromV2(t.vx, t.vy);
  const near = content.objects.filter((o) => Math.abs(o.x - c.x) <= TOWN_RX && Math.abs(o.y - c.y) <= TOWN_RY);

  // --- The walk has to pay ---
  const kinds = near.map((o) => o.kind);
  check(kinds.includes("bank"), `${t.name} has no bank — an hour's walk that ends without one is a walk you make twice`);
  const stations = kinds.filter((k) => STATIONS.includes(k) && k !== "bank");
  check(stations.length >= 2, `${t.name} offers ${stations.length} working stations besides the bank`);
  check(near.filter((o) => o.kind === "npc").length >= 3, `${t.name} has fewer than three folk in it`);

  // Exactly one of each station: the generator cannot see the hand-authored
  // spawns, so a station a seat already keeps must be left out of the table.
  for (const k of STATIONS) {
    const n = kinds.filter((x) => x === k).length;
    check(n <= 1, `${t.name} has ${n} of "${k}" — the table duplicates one the seat already keeps`);
  }

  // A shop to restock at: its keeper must actually be here.
  const shop = content.shops.find((s) => s.id === `shop_${t.id}`);
  check(!!shop, `${t.name} has no shop`);
  if (shop?.npc) {
    const keeper = content.objects.find((o) => o.id === shop.npc);
    check(!!keeper && Math.abs(keeper.x - c.x) <= TOWN_RX + 4 && Math.abs(keeper.y - c.y) <= TOWN_RY + 4,
      `${t.name}'s keeper "${shop.npc}" does not stand in the town`);
  }
}

// --- Everything generated must be usable ------------------------------------
for (const o of built) {
  const beside = ([[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]] as [number, number][])
    .some(([dx, dy]) => walk(o.x + dx, o.y + dy));
  check(beside, `${o.id} at ${o.x},${o.y} has no walkable tile beside it — it is sealed in`);
}
// …and none of it may stand on top of a hand-authored object.
const handTiles = new Map<string, string>();
for (const o of content.objects) if (!o.id.startsWith("seat_")) handTiles.set(`${o.x},${o.y}`, o.id);
for (const o of built) {
  const clash = handTiles.get(`${o.x},${o.y}`);
  check(!clash, `${o.id} stands on the same tile as ${clash}`);
}

const totals = TOWNS.map((t) => {
  const c = fromV2(t.vx, t.vy);
  const near = content.objects.filter((o) => Math.abs(o.x - c.x) <= TOWN_RX && Math.abs(o.y - c.y) <= TOWN_RY);
  return `${t.name} ${near.length}`;
});
console.log(`towns ${TOWNS.length} · generated ${built.length} objects`);
console.log(`objects in town: ${totals.join(" · ")}`);
if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("\nPASS");
