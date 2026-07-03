/**
 * src/content/diaries.ts
 * ----------------------
 * Achievement Diaries — a themed checklist of goals for each wilderness region,
 * shown in the World tab. Pure DATA (RULE 3): each task is an AchievementCond,
 * evaluated by the same `evalAchievement` the achievements use, so diaries need
 * no new core tracking. They reference each region's signature skills and its
 * real quests, so working a region naturally ticks its diary off.
 *
 * (Display-only for now — a tracker of regional goals; rewards can be wired in
 * later by gating an item/flag on a diary's completion.)
 */

import type { DiaryDef } from "../core/types.ts";

export const diaries: DiaryDef[] = [
  {
    id: "diary_greyoak", reward: 10000, name: "Greyoak Wood", icon: "🌲",
    tasks: [
      { label: "Fell greyoak at Forestry 20", cond: { type: "skillLevel", skill: "forestry", level: 20 } },
      { label: "Work the traplines at Hunter 20", cond: { type: "skillLevel", skill: "hunter", level: 20 } },
      { label: "Settle what walks in the trees", cond: { type: "questDone", quest: "q_white_in_the_trees" } },
      { label: "Saw the old growth at Woodcraft 35", cond: { type: "skillLevel", skill: "woodcraft", level: 35 } },
    ],
  },
  {
    id: "diary_spine", reward: 20000, name: "The Spine", icon: "⛰️",
    tasks: [
      { label: "Cut the cold ore at Mining 30", cond: { type: "skillLevel", skill: "mining", level: 30 } },
      { label: "Reach Combat level 30 for the heights", cond: { type: "combatLevel", level: 30 } },
      { label: "Hone your Edge to 35", cond: { type: "skillLevel", skill: "edge", level: 35 } },
      { label: "Carry a skill to level 50", cond: { type: "anySkillLevel", level: 50 } },
    ],
  },
  {
    id: "diary_marrow", reward: 50000, name: "The Marrow Deeps", icon: "🕳️",
    tasks: [
      { label: "Take a slay-task in the Deeps", cond: { type: "questDone", quest: "q_marrow_marks" } },
      { label: "Sink the deep shafts at Mining 60", cond: { type: "skillLevel", skill: "mining", level: 60 } },
      { label: "Reach Combat level 50 for the dark", cond: { type: "combatLevel", level: 50 } },
      { label: "Slay 100 creatures across Varath", cond: { type: "monstersSlain", count: 100 } },
    ],
  },
  {
    id: "diary_heartmoor", reward: 25000, name: "The Heartmoor", icon: "🌫️",
    tasks: [
      { label: "Take Calder's peat-cutting", cond: { type: "questDone", quest: "q_calder_peat" } },
      { label: "Brew the moor's herbs at Herblore 25", cond: { type: "skillLevel", skill: "herblore", level: 25 } },
      { label: "Prove your devotion to the Heartmoor", cond: { type: "questDone", quest: "q_hm_devotion" } },
      { label: "Reach Combat level 40 for the bog", cond: { type: "combatLevel", level: 40 } },
    ],
  },
  {
    id: "diary_ashfen", reward: 35000, name: "The Ashfen Flats", icon: "🔥",
    tasks: [
      { label: "Witness the warm ground", cond: { type: "questDone", quest: "q_ashfen_witness" } },
      { label: "Cut embercite at Mining 40", cond: { type: "skillLevel", skill: "mining", level: 40 } },
      { label: "Cook over the warm seams at Cooking 30", cond: { type: "skillLevel", skill: "cooking", level: 30 } },
      { label: "Distil the flats' brews at Herblore 40", cond: { type: "skillLevel", skill: "herblore", level: 40 } },
    ],
  },
  {
    id: "diary_redrun", reward: 30000, name: "The Redrun & Sea", icon: "🌊",
    tasks: [
      { label: "Run a courier down the red river", cond: { type: "questDone", quest: "q_sq_redriver" } },
      { label: "Land the river's catch at Fishing 30", cond: { type: "skillLevel", skill: "fishing", level: 30 } },
      { label: "Fish the Eyeless Sea at Fishing 60", cond: { type: "skillLevel", skill: "fishing", level: 60 } },
      { label: "Cook a feast at Cooking 50", cond: { type: "skillLevel", skill: "cooking", level: 50 } },
    ],
  },
  {
    id: "diary_knuckle", reward: 8000, name: "The Knuckle Hills", icon: "🌄",
    tasks: [
      { label: "Settle Aldric's strange old coin", cond: { type: "questDone", quest: "q_ash_and_knuckle" } },
      { label: "Work the first seams at Mining 15", cond: { type: "skillLevel", skill: "mining", level: 15 } },
      { label: "Claim five of Rook's contracts", cond: { type: "bountyTasks", count: 5 } },
      { label: "Reach Combat level 20 among the wolves", cond: { type: "combatLevel", level: 20 } },
    ],
  },
  {
    id: "diary_ironvale", reward: 40000, name: "Ironvale", icon: "🏙️",
    tasks: [
      { label: "Claim a homestead of your own", cond: { type: "flag", flag: "homesteader" } },
      { label: "Stand a forge apprenticeship", cond: { type: "questDone", quest: "q_forge_apprentice" } },
      { label: "Work the city forge at Smithing 45", cond: { type: "skillLevel", skill: "smithing", level: 45 } },
      { label: "Earn a trader's fortune — 250,000 gold", cond: { type: "goldEarned", amount: 250000 } },
    ],
  },
  {
    id: "diary_deeps", reward: 75000, name: "The Deep Roads", icon: "🕯️",
    tasks: [
      { label: "Break the fifth seal beneath the pass", cond: { type: "questDone", quest: "q_undergate" } },
      { label: "Slay Cindrath in the Marrow Deeps", cond: { type: "bossKills", boss: "ashen_wyrm", count: 1 } },
      { label: "Slay the Delve Horror", cond: { type: "bossKills", boss: "delve_horror", count: 1 } },
      { label: "Claim twenty-five Bounty contracts", cond: { type: "bountyTasks", count: 25 } },
    ],
  },
];
