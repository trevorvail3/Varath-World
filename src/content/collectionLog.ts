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

import { ASCENDANT_EMBER, CLUE_TIERS, CONTAINER_TABLES, FOUNDER_ITEMS, POTION_POOL, SUPERIOR_UNIQUES } from "../core/worldCore.ts";
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

/**
 * What the log covers. This must match `collectionProgress` in worldCore, which
 * counts every catalogued item except quest keys — because that count is the
 * gate on Ironvale's Cape. A log that quietly excluded items the cape still
 * required would tell a completionist they were finished when they were not.
 */
const EXCLUDED_CATS = new Set(["Quest"]);

function keep(content: Content, id: ItemId): boolean {
  const d = content.items[id];
  return !!d?.cat && !EXCLUDED_CATS.has(d.cat);
}

/** A skill's display name, or its id when the skill registry has no entry. */
function skillName(content: Content, skill: string): string {
  const reg = content.skills as Record<string, { name?: string } | undefined>;
  return reg[skill]?.name ?? skill;
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
      name: skillName(content, skill),
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

  // --- Global kill tables: trail scrolls and combat draughts --------------
  // Every foe in Varath sheds these, so they belong to no single monster.
  {
    const clue: LogEntry[] = [];
    for (const t of CLUE_TIERS) {
      if (keep(content, t.item)) clue.push({ item: t.item, tier: t.tier });
      if (keep(content, t.casket)) clue.push({ item: t.casket, tier: t.tier });
    }
    if (clue.length) cats.push({ id: "clue_scrolls", name: "Trail Scrolls", group: "Treasure Trails", entries: clue });

    const pots: LogEntry[] = [];
    const seen = new Set<string>();
    for (const line of POTION_POOL) {
      if (seen.has(line.item) || !keep(content, line.item)) continue;
      seen.add(line.item);
      pots.push({ item: line.item });
    }
    if (pots.length) cats.push({ id: "kill_draughts", name: "Combat Draughts (any kill)", group: "Monsters", entries: pots });
  }

  // --- Dungeon chests: one-off coffers, each with a named unique ------------
  {
    const entries: LogEntry[] = [];
    const seen = new Set<string>();
    for (const o of content.objects) {
      if (o.kind !== "dungeon_chest") continue;
      for (const l of (o as { loot?: { item: ItemId }[] }).loot ?? []) {
        if (seen.has(l.item) || !keep(content, l.item)) continue;
        seen.add(l.item);
        entries.push({ item: l.item, tier: "unique" });
      }
    }
    if (entries.length) cats.push({ id: "dungeon_chests", name: "Dungeon Coffers", group: "Other", entries });
  }

  // --- Gathering outfits: `meta.skillBonus` is the registry (tryOutfitDrop) -
  for (const [id, d] of Object.entries(content.items)) {
    const skill = d.meta?.["skillBonus"];
    if (typeof skill !== "string" || d.slot === "companion" || !keep(content, id as ItemId)) continue;
    const cat = cats.find((c) => c.id === `skill_${skill}`);
    const entry: LogEntry = { item: id as ItemId, tier: "outfit" };
    if (cat) { if (!cat.entries.some((e) => e.item === id)) cat.entries.unshift(entry); }
    else cats.push({ id: `skill_${skill}`, name: skillName(content, skill), group: "Skilling", entries: [entry] });
  }

  // --- Skilling pets: `meta.petSkill` is the source of truth (tryPetDrop) ---
  // They hang off the skill they roll on rather than in a pet shelf of their
  // own, because "which skill do I train for this" is the question being asked.
  for (const [id, d] of Object.entries(content.items)) {
    const skill = d.meta?.["petSkill"];
    if (typeof skill !== "string" || !keep(content, id as ItemId)) continue;
    const cat = cats.find((c) => c.id === `skill_${skill}`);
    const entry: LogEntry = { item: id as ItemId, tier: "pet" };
    if (cat) { if (!cat.entries.some((e) => e.item === id)) cat.entries.unshift(entry); }
    else cats.push({ id: `skill_${skill}`, name: skillName(content, skill), group: "Skilling", entries: [entry] });
  }

  // --- Superior encounters (a Bounty unlock) -------------------------------
  {
    const entries = SUPERIOR_UNIQUES.filter((i) => keep(content, i)).map((item) => ({ item, tier: "ultra-rare" }));
    if (entries.length) cats.push({ id: "superior", name: "Superior Encounters", group: "Bounty", entries });
  }

  // --- Potion doses: a part-drunk vial is its own catalogued item -----------
  {
    const entries: LogEntry[] = [];
    const seen = new Set<string>();
    for (const d of Object.values(content.items)) {
      const next = (d as { doseNext?: ItemId }).doseNext;
      if (!next || seen.has(next) || !keep(content, next)) continue;
      seen.add(next);
      entries.push({ item: next, tier: "dose" });
    }
    if (entries.length) cats.push({ id: "potion_doses", name: "Part-Drunk Vials", group: "Skilling", entries });
  }

  // --- One-off grants the core makes in code, not data ---------------------
  {
    const grants: { item: ItemId; tier: string }[] = [
      { item: "cape_ironvale", tier: "fill this log + every achievement" },
      { item: "rod_gold", tier: "hold the Drowned Pier record" },
      { item: "burnt_food", tier: "fail a cook" },
      { item: "agility_mark", tier: "run a Trail lap" },
      { item: "pier_chit", tier: "land a graded fish" },
      { item: ASCENDANT_EMBER, tier: "pass a master star" },
    ];
    const entries = grants.filter((g) => keep(content, g.item));
    if (entries.length) cats.push({ id: "earned", name: "Earned Outright", group: "Other", entries });
  }
  {
    const entries = FOUNDER_ITEMS.filter((i) => keep(content, i)).map((item) => ({ item, tier: "founder" }));
    if (entries.length) cats.push({ id: "founder", name: "Founder's Rewards", group: "Other", entries });
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
