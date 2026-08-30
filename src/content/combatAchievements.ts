/**
 * src/content/combatAchievements.ts
 * ---------------------------------
 * Combat achievements, DERIVED from the boss roster.
 *
 * A kill count measures patience. A combat achievement measures play: "kill it"
 * and "kill it without being hit once" are different games, and only the second
 * says anything about how well you fought.
 *
 * Every boss gets the same four tasks — a first kill, then the three feats the
 * core records (perfect / unfed / swift) — so adding a boss adds its tasks, and
 * the list can never drift from the roster. The TIER each task lands in comes
 * from the boss's own combat level, which is the only honest measure of how hard
 * the task actually is: "kill Vorlag without eating" is not the same ask as
 * "kill the Quartermaster without eating", and a flat difficulty label would
 * pretend otherwise.
 *
 * RULE 1 SAFE: pure functions over content data.
 */

import { swiftParMs } from "../core/worldCore.ts";
import type { AchievementDef, Content, MonsterStats } from "../core/types.ts";

/** The tiers, easiest first, with the boss level at which each takes over. */
export const CA_TIERS = [
  { id: "Easy", upTo: 40, icon: "🥉" },
  { id: "Medium", upTo: 65, icon: "🥈" },
  { id: "Hard", upTo: 90, icon: "🥇" },
  { id: "Elite", upTo: 110, icon: "💠" },
  { id: "Master", upTo: Infinity, icon: "👑" },
] as const;

export type CaTier = (typeof CA_TIERS)[number]["id"];

/** Which tier a boss's tasks belong to. */
export function tierOf(stats: MonsterStats): CaTier {
  for (const t of CA_TIERS) if (stats.level <= t.upTo) return t.id;
  return "Master";
}

/** A boss a player can actually reach: a stat block with no spawn is not a task. */
function reachable(content: Content, stats: MonsterStats): boolean {
  return content.objects.some((o) => o.kind === "monster" && o.monster === stats.id);
}

/**
 * Build every combat achievement. These are appended to `content.achievements`,
 * so they flow through the existing evaluator, the existing unlock check and the
 * existing Records UI with no special-casing anywhere.
 */
export function buildCombatAchievements(content: Content): AchievementDef[] {
  const out: AchievementDef[] = [];
  const bosses = (Object.values(content.monsters) as MonsterStats[])
    .filter((m) => m.boss && reachable(content, m))
    .sort((a, b) => a.level - b.level);

  for (const m of bosses) {
    const tier = tierOf(m);
    const cat = `Combat: ${tier}`;
    const secs = Math.round(swiftParMs(m) / 1000);
    out.push(
      {
        id: `ca_${m.id}_kill`,
        name: `${m.name}: Felled`,
        desc: `Defeat ${m.name}.`,
        icon: m.icon ?? "⚔️",
        category: cat,
        cond: { type: "bossKills", boss: m.id, count: 1 },
      },
      {
        id: `ca_${m.id}_perfect`,
        name: `${m.name}: Untouched`,
        desc: `Defeat ${m.name} without taking a single point of damage.`,
        icon: "🛡️",
        category: cat,
        cond: { type: "combatFeat", boss: m.id, feat: "perfect" },
      },
      {
        id: `ca_${m.id}_unfed`,
        name: `${m.name}: No Provisions`,
        desc: `Defeat ${m.name} without eating or drinking a heal.`,
        icon: "🍖",
        category: cat,
        cond: { type: "combatFeat", boss: m.id, feat: "unfed" },
      },
      {
        id: `ca_${m.id}_swift`,
        name: `${m.name}: Swift`,
        desc: `Defeat ${m.name} in under ${secs} seconds.`,
        icon: "⏱️",
        category: cat,
        cond: { type: "combatFeat", boss: m.id, feat: "swift" },
      },
    );
  }

  // The ladder's own capstones, so the set is worth completing rather than just
  // grinding piecemeal. Thresholds are shares of what the roster actually
  // offers, not round numbers picked in the dark.
  const feats = bosses.length * 3;
  for (const [share, name, desc, icon] of [
    [0.25, "Contender", "a quarter", "🎖️"],
    [0.5, "Duellist", "half", "🏅"],
    [1, "Grandmaster of Arms", "every", "👑"],
  ] as [number, string, string, string][]) {
    const count = Math.round(feats * share);
    out.push({
      id: `ca_total_${Math.round(share * 100)}`,
      name,
      desc: `Earn ${desc} combat achievement feat in Varath (${count} of ${feats}).`,
      icon,
      category: "Combat: Ladder",
      cond: { type: "combatFeats", count },
    });
  }
  return out;
}
