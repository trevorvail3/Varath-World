/**
 * src/content/collectionLog.ts
 * ----------------------------
 * The collection log, DERIVED from where things actually come from.
 *
 * The core has always recorded which items a player has ever held, but only as
 * one flat set behind a single "43% collected" number. That tells you nothing
 * you can act on. A collection log is useful precisely because it is organised
 * BY SOURCE: "Vorlag 3/7" sends you somewhere, "43%" does not.
 *
 * Every category here is read out of data that already exists — monster drop
 * tables, container loot, skill action outputs, crops, shop stock, quest rewards
 * and the Bounty exchange — so adding a boss, a drop or an item to a shop puts it
 * in the log automatically and the log can never drift from the game. That is
 * the same reasoning as the equipment bonus sheet: a hand-maintained list of
 * ~700 items against their sources would be wrong within a week.
 *
 * RULE 1 SAFE: pure functions over content data.
 */

import { CONTAINER_TABLES } from "../core/worldCore.ts";
import type { Content, ItemId, MonsterStats, SkillAction } from "../core/types.ts";

export interface LogEntry {
  item: ItemId;
  /** The rarity label the source itself gives this drop, when it has one. */
  tier?: string;
}

export interface LogCategory {
  id: string;
  name: string;
  /** Which shelf of the log this sits on. */
  group: "Bosses" | "Monsters" | "Treasure Trails" | "Skilling" | "Shops" | "Quests" | "Bounty" | "Other";
  entries: LogEntry[];
}

/** Items that are noise in a collection log: currency, junk, and quest keys. */
const EXCLUDED_CATS = new Set(["Quest"]);
const EXCLUDED_ITEMS = new Set<string>(["worn_coin", "burnt_food"]);

function keep(content: Content, id: ItemId): boolean {
  if (EXCLUDED_ITEMS.has(id)) return false;
  const d = content.items[id];
  return !!d?.cat && !EXCLUDED_CATS.has(d.cat);
}

/** Drops worth logging from one monster, most notable first. */
function dropsOf(content: Content, m: MonsterStats): LogEntry[] {
  const out: LogEntry[] = [];
  const seen = new Set<string>();
  // Rarest first: a collection log is read for what you are still missing, and
  // the thing you are missing is almost always the rare one.
  const sorted = [...(m.drops ?? [])].sort((a, b) => (a.chance ?? 1) - (b.chance ?? 1));
  for (const d of sorted) {
    if (!keep(content, d.item) || seen.has(d.item)) continue;
    seen.add(d.item);
    out.push(d.tier ? { item: d.item, tier: d.tier } : { item: d.item });
  }
  return out;
}

/**
 * Everything a skill can put in your hands, from its own action registry: what
 * its actions produce, plus the rare finds they can turn up. Reading `produces`
 * rather than listing outputs by hand is what keeps every new ore, log, bar and
 * cooked fish in the log the day it is added.
 */
function skillItems(content: Content, skill: string): LogEntry[] {
  const out: LogEntry[] = [];
  const seen = new Set<string>();
  const push = (item: ItemId | undefined, tier?: string): void => {
    if (!item || seen.has(item) || !keep(content, item)) return;
    seen.add(item);
    out.push(tier ? { item, tier } : { item });
  };
  type Extras = {
    rareDrop?: { item: ItemId };
    seedDrop?: { item: ItemId };
    woodShardDrop?: { item: ItemId };
  };
  // Rares first — they are what the log is read for.
  for (const a of content.actions as SkillAction[]) {
    if (a.skill !== skill) continue;
    const x = a as unknown as Extras;
    push(x.rareDrop?.item, "rare");
    push(x.seedDrop?.item, "rare");
    push(x.woodShardDrop?.item, "rare");
  }
  for (const a of content.actions as SkillAction[]) {
    if (a.skill !== skill) continue;
    push((a as { produces?: ItemId }).produces);
  }
  return out;
}

/**
 * Build the whole log. Categories with nothing in them are dropped — an empty
 * shelf is worse than no shelf.
 */
export function buildCollectionLog(content: Content): LogCategory[] {
  const cats: LogCategory[] = [];

  // --- Bosses and monsters, straight off their drop tables -----------------
  for (const [id, m] of Object.entries(content.monsters)) {
    const entries = dropsOf(content, m);
    if (entries.length === 0) continue;
    // Only monsters that actually stand somewhere: a stat block with no spawn
    // is not a source you could ever collect from.
    if (!content.objects.some((o) => o.kind === "monster" && o.monster === id)) continue;
    cats.push({
      id: `mon_${id}`,
      name: m.name ?? id,
      group: m.boss ? "Bosses" : "Monsters",
      entries,
    });
  }

  // --- Containers, from the reward tables the core already rolls -----------
  for (const [id, table] of Object.entries(CONTAINER_TABLES)) {
    const entries: LogEntry[] = [];
    const seen = new Set<string>();
    // The clue-exclusive rares first: they are the reason anyone opens the log
    // on a casket at all.
    for (const r of table.rare ?? []) {
      if (!keep(content, r.item) || seen.has(r.item)) continue;
      seen.add(r.item);
      entries.push({ item: r.item, tier: "rare" });
    }
    for (const line of table.lines) {
      if (!keep(content, line.item) || seen.has(line.item)) continue;
      seen.add(line.item);
      entries.push({ item: line.item });
    }
    if (!entries.length) continue;
    cats.push({
      id: `box_${id}`,
      name: content.items[id as ItemId]?.name ?? id,
      group: id.startsWith("casket") ? "Treasure Trails" : "Other",
      entries,
    });
  }

  // --- Skilling: what each skill produces, plus its rare finds -------------
  const skills = [...new Set((content.actions as SkillAction[]).map((a) => a.skill))];
  for (const skill of skills) {
    const entries = skillItems(content, skill);
    if (entries.length === 0) continue;
    cats.push({
      id: `skill_${skill}`,
      name: content.skills[skill]?.name ?? skill,
      group: "Skilling",
      entries,
    });
  }

  // Farming lives in its crop table rather than the action registry, so it needs
  // reading separately: the seed, what it grows into, and its bonus find.
  {
    const entries: LogEntry[] = [];
    const seen = new Set<string>();
    const push = (item: ItemId | undefined, tier?: string): void => {
      if (!item || seen.has(item) || !keep(content, item)) return;
      seen.add(item);
      entries.push(tier ? { item, tier } : { item });
    };
    for (const c of Object.values(content.crops)) {
      push(c.produce);
      push(c.seed);
      push((c as { bonusDrop?: ItemId }).bonusDrop, "bonus");
    }
    if (entries.length) {
      const existing = cats.find((c) => c.id === "skill_farming");
      if (existing) {
        const have = new Set(existing.entries.map((e) => e.item));
        for (const e of entries) if (!have.has(e.item)) existing.entries.push(e);
      } else {
        cats.push({ id: "skill_farming", name: "Farming", group: "Skilling", entries });
      }
    }
  }

  // --- Shops: stock is a real source, and a large slice of the catalogue ----
  for (const shop of content.shops) {
    const entries: LogEntry[] = [];
    const seen = new Set<string>();
    for (const line of shop.stock) {
      if (!keep(content, line.item) || seen.has(line.item)) continue;
      seen.add(line.item);
      entries.push({ item: line.item });
    }
    if (!entries.length) continue;
    cats.push({ id: `shop_${shop.id}`, name: shop.name, group: "Shops", entries });
  }

  // --- Quest rewards -------------------------------------------------------
  {
    const entries: LogEntry[] = [];
    const seen = new Set<string>();
    const push = (item: ItemId | undefined): void => {
      if (!item || seen.has(item) || !keep(content, item)) return;
      seen.add(item);
      entries.push({ item });
    };
    for (const q of content.quests) {
      for (const r of q.reward?.items ?? []) push(r.item);
      // Some rewards are handed out mid-quest by a dialogue choice rather than
      // by the reward block — the four ending capes among them.
      for (const step of q.steps) {
        for (const o of (step as { options?: { giveItem?: ItemId }[] }).options ?? []) push(o.giveItem);
      }
    }
    if (entries.length) cats.push({ id: "quest_rewards", name: "Quest Rewards", group: "Quests", entries });
  }

  // --- The Bounty reward shop ----------------------------------------------
  {
    const entries: LogEntry[] = [];
    const seen = new Set<string>();
    for (const line of content.bountyShop) {
      if (!keep(content, line.item) || seen.has(line.item)) continue;
      seen.add(line.item);
      entries.push({ item: line.item });
    }
    if (entries.length) cats.push({ id: "bounty_shop", name: "Hunt Mark Exchange", group: "Bounty", entries });
  }

  // Bosses first, then the rest alphabetically inside each shelf — the log is
  // read top-down and the bosses are what anyone opens it for.
  const order: Record<LogCategory["group"], number> = {
    Bosses: 0, "Treasure Trails": 1, Bounty: 2, Skilling: 3, Monsters: 4,
    Quests: 5, Shops: 6, Other: 7,
  };
  cats.sort((a, b) => order[a.group] - order[b.group] || a.name.localeCompare(b.name));
  return cats;
}

/** How much of one category a player has seen. */
export function categoryProgress(cat: LogCategory, owned: Set<string>): { done: number; total: number } {
  let done = 0;
  for (const e of cat.entries) if (owned.has(e.item)) done += 1;
  return { done, total: cat.entries.length };
}
