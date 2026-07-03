/**
 * src/content/skills.ts
 * ---------------------
 * Player-facing skill metadata, named and ordered per the Varath idle game's
 * `SKILLS` + `COMBAT_SKILLS` (the full 18-skill registry). Display names and
 * icon glyphs are copied from canon.
 *
 * Some skills (farming, construction, bounty) are registered here so they show
 * in the panel, but their interactions land in later bundles — see the
 * CANON_LEDGER. The order matches the idle game's SKILL_ORDER + COMBAT_ORDER.
 */

import type { SkillId } from "../core/types.ts";

// Each skill carries a short blurb — how you train it, and what levelling it
// gives you — shown at the top of its detail popup so a newcomer can tell at a
// glance what the skill is for.
export const skills: Record<SkillId, { name: string; icon: string; blurb: string }> = {
  // --- The 13 trainable (gathering + processing) skills ---
  mining: { name: "Mining", icon: "⛏️", blurb: "Swing a pickaxe at rock seams to win ore. Higher Mining lets you work richer, tougher veins — and mine them faster." },
  smithing: { name: "Smithing", icon: "🔨", blurb: "Smelt ore into bars at a furnace, then hammer bars into tools, weapons and armour at an anvil. Higher Smithing unlocks stronger metals and gear." },
  forestry: { name: "Forestry", icon: "🌲", blurb: "Chop trees for logs. Higher Forestry opens denser woods and fells them quicker." },
  woodcraft: { name: "Woodcraft", icon: "🪚", blurb: "Saw logs into planks, bows and tackle at a workbench. Higher Woodcraft unlocks finer wooden goods." },
  hunter: { name: "Hunter", icon: "🪤", blurb: "Lay traps and snares for beasts to take hides, sinew and meat. Higher Hunter catches rarer, wilier quarry." },
  fishing: { name: "Fishing", icon: "🎣", blurb: "Fish at marked spots for a raw catch. Higher Fishing lands bigger fish from harder waters." },
  cooking: { name: "Cooking", icon: "🍳", blurb: "Cook raw food at a fire or range into meals that heal you. Higher Cooking unlocks heartier dishes — and burns fewer of them." },
  farming: { name: "Farming", icon: "🌾", blurb: "Sow seeds in tilled patches and return when they ripen. Higher Farming unlocks better crops and trees with richer yields. Work a Survivalist's fertilizer into a patch (Use it on the soil) and the planting comes through stronger — +20% survival from the basic mix, +35% from the rich." },
  survivalist: { name: "Survivalist", icon: "🏕️", blurb: "Forage the wilds for herbs and field goods, and strike flint against logs to light campfires wherever you stand. Higher Survivalist turns up scarcer finds and burns tougher logs for more experience. Your foraged mixes also feed the farm: fertilizer worked into a patch carries its crop through." },
  herblore: { name: "Herblore", icon: "⚗️", blurb: "One pattern, thirteen brews: a Vial of Water + a farmed herb + one secondary makes a TWO-DOSE potion at any cauldron. Every farm herb has exactly one potion at its own level — combat brews, gathering brews, Grace and the Runner's Blend. Vials come from the apothecary, or fill your own from glass vials; secondaries from foraging, bones and enemy drops." },
  construction: { name: "Construction", icon: "🏗️", blurb: "Build and upgrade the furniture and rooms of your house from materials. Higher Construction unlocks grander, finer fittings." },
  crafting: { name: "Crafting", icon: "✂️", blurb: "Cut gems, tan leather and make jewellery and kit. Higher Crafting unlocks more intricate, valuable pieces." },
  bounty: { name: "Bounty", icon: "🎯", blurb: "Take slay-contracts from the four Hunt Guides — each keeps their own grounds, and each expects the rank and arm for the work. Every on-task kill trains Bounty; the claim pays the rest. Milestone tasks (your 10th, 50th, 100th…) multiply their Marks, the first claim each day pays double, and at Bounty 50/75/90 every contract's Marks rise by 10/20/30%. Spend Marks on hunter's gear and permanent unlocks with any guide." },
  agility: { name: "Agility", icon: "👟", blurb: "Trained by running — and far faster on the obstacle courses and the Varathian Trail, where every lap pays out. The more ground you cover, the longer your wind lasts and the faster your energy recovers." },
  // --- The 5 combat skills ---
  vitality: { name: "Vitality", icon: "❤️", blurb: "Your life force. Trained by taking hits in combat; each level raises your maximum Hitpoints." },
  edge: { name: "Edge", icon: "⚔️", blurb: "Melee accuracy. Trained on the Edge attack style — raises your chance to land blows." },
  vigour: { name: "Vigour", icon: "💪", blurb: "Melee power. Trained on the Vigour attack style — raises the damage your hits deal." },
  ward: { name: "Ward", icon: "🛡️", blurb: "Melee defence. Trained on the Ward attack style — lowers your chance of being hit." },
  draw: { name: "Draw", icon: "🏹", blurb: "Archery. Trained by attacking with a bow — raises your ranged accuracy and damage." },
  faith: { name: "Devotion", icon: "🔮", blurb: "Magic and prayer, fused. Trained by fighting with a staff and by burying bones. Raises your casting power and your Grace pool — the fuel for spells, refilled at shrines and altars. Each level adds one to your Grace." },
};
