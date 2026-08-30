/**
 * sims/collection.ts
 * ------------------
 * Checks the collection log.
 *
 *   npx tsx sims/collection.ts
 *
 * The log is derived from drop tables rather than hand-authored, which is what
 * keeps it honest — but a deriver can still fail quietly: point at an item id
 * that no longer exists, emit an empty shelf, double-count a drop, or read the
 * same for an empty account as for a finished one. None of those would throw.
 * Exits non-zero on failure.
 */

import { content } from "./harness.ts";
import { buildCollectionLog, categoryProgress } from "../src/content/collectionLog.ts";
import type { ItemId } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

const log = content.collectionLog;

// --- The log exists, and is the same one the deriver produces ---------------
check(log.length > 0, "collection log is empty");
check(
  JSON.stringify(buildCollectionLog(content)) === JSON.stringify(log),
  "content.collectionLog does not match a fresh buildCollectionLog(content) — the bundle was built from something else",
);

// --- Every entry points at a real item -------------------------------------
const ids = new Set<string>();
let entries = 0;
for (const cat of log) {
  check(cat.entries.length > 0, `category ${cat.id} is empty — an empty shelf is worse than no shelf`);
  check(cat.name.trim().length > 0, `category ${cat.id} has no name`);
  const seen = new Set<string>();
  for (const e of cat.entries) {
    entries += 1;
    ids.add(e.item);
    check(!!content.items[e.item], `${cat.id} lists unknown item ${e.item}`);
    check(!seen.has(e.item), `${cat.id} lists ${e.item} twice`);
    seen.add(e.item);
  }
}

// --- Ids are unique, so the accordion keys never collide --------------------
const catIds = new Set(log.map((c) => c.id));
check(catIds.size === log.length, "duplicate category ids — two shelves would share one open/closed key");

// --- Every shelf the UI renders is populated -------------------------------
const SHELVES = ["Bosses", "Treasure Trails", "Bounty", "Skilling", "Monsters", "Quests", "Shops", "Other"] as const;
for (const g of SHELVES) {
  check(log.some((c) => c.group === g), `shelf "${g}" has no categories — the UI would render a header over nothing`);
}
for (const c of log) {
  check((SHELVES as readonly string[]).includes(c.group), `${c.id} sits on unknown shelf "${c.group}"`);
}

// --- Every boss with a spawn and a drop table is on the Bosses shelf --------
for (const [id, m] of Object.entries(content.monsters)) {
  if (!m.boss || !(m.drops ?? []).length) continue;
  if (!content.objects.some((o) => o.kind === "monster" && o.monster === id)) continue;
  check(log.some((c) => c.id === `mon_${id}`), `boss ${id} has drops and a spawn but no log category`);
}

// --- Progress reads 0% empty and 100% full ---------------------------------
const empty = new Set<string>();
const full = new Set<string>(ids);
let d0 = 0, d1 = 0, total = 0;
for (const cat of log) {
  const a = categoryProgress(cat, empty);
  const b = categoryProgress(cat, full);
  d0 += a.done; d1 += b.done; total += a.total;
  check(a.total === b.total, `${cat.id} total moved with the owned set`);
}
check(d0 === 0, `a fresh account reads ${d0} collected, expected 0`);
check(d1 === total, `a fully-stocked account reads ${d1}/${total}, expected all`);

// --- One partial account: exactly the items it holds ------------------------
const someCat = log.find((c) => c.entries.length >= 3);
if (!someCat) fails.push("no category with 3+ entries to test partial progress");
else {
  const held = new Set<string>([someCat.entries[0]!.item, someCat.entries[2]!.item]);
  const p = categoryProgress(someCat, held);
  check(p.done === 2, `partial progress read ${p.done}/2 for ${someCat.id}`);
}

// --- Completability: EVERY item the cape counts must have a source ---------
// worldCore's collectionProgress counts every catalogued non-Quest item, and
// Ironvale's Cape is granted only when that count is full. So an item with no
// source does not merely sit unused — it makes the grandmaster reward
// unreachable, silently and forever. This assertion is the only thing in the
// repo that would catch that, and it must stay at zero.
const unsourced = (Object.keys(content.items) as ItemId[]).filter((id) => {
  const d = content.items[id];
  return !!d.cat && d.cat !== "Quest" && !ids.has(id);
});
check(
  unsourced.length === 0,
  `${unsourced.length} catalogued items have no source, so Ironvale's Cape cannot be earned: ${unsourced.join(", ")}`,
);

// A source the deriver cannot see is the same bug wearing a disguise, so the
// two totals are held equal: the log covers exactly what the cape counts.
const counted = (Object.keys(content.items) as ItemId[]).filter((id) => {
  const d = content.items[id];
  return !!d.cat && d.cat !== "Quest";
}).length;
check(ids.size === counted, `log covers ${ids.size} items but the cape counts ${counted}`);
console.log(`completable: ${ids.size}/${counted} catalogued items have a source`);

// --- The log is worth opening: enough of the game reachable through it ------
check(entries >= 200, `only ${entries} entries logged — the deriver is missing sources`);
check(ids.size >= 150, `only ${ids.size} distinct items logged`);
const collectable = (Object.keys(content.items) as ItemId[]).filter((id) => content.items[id].cat);
console.log(
  `categories ${log.length} · entries ${entries} · distinct items ${ids.size} of ${collectable.length} catalogued`,
);
const byShelf: Record<string, number> = {};
for (const c of log) byShelf[c.group] = (byShelf[c.group] ?? 0) + 1;
console.log(byShelf);

if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("\nPASS");
