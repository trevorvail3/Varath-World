/**
 * src/content/index.ts
 * --------------------
 * Bundles all the game DATA into a single `Content` object that gets handed
 * to the core when a world is created. The core reads from this; it never
 * reaches into the individual content files itself.
 */

import type { Content } from "../core/types.ts";
import { actions } from "./actions.ts";
import { items } from "./items.ts";
import { map, CITY_SPAWN } from "./map.ts";
import { monsters } from "./monsters.ts";
import { buildEquipBonuses } from "./equipBonus.ts";
import { thieveTargets } from "./thieving.ts";
import { buildCollectionLog } from "./collectionLog.ts";
import { buildCombatAchievements } from "./combatAchievements.ts";
import { quests } from "./quests.ts";
import { spells } from "./spells.ts";
import { lore } from "./lore.ts";
import { clueSpots } from "./clues.ts";
import { shops } from "./shops.ts";
import { factions } from "./factions.ts";
import { achievements } from "./achievements.ts";
import { diaries } from "./diaries.ts";
import { crops } from "./crops.ts";
import { furniture, surfaces } from "./furniture.ts";
import { bountyGuides, bountyShop, bountyTasks, bountyUnlocks, huntingGrounds } from "./bounty.ts";
import { objects, playerSpawn } from "./spawns.ts";
import { buildCampObjects } from "./camps.ts";
import { buildTownObjects } from "./towns.ts";
import { fromV2, spread } from "./map.ts";
import { skills } from "./skills.ts";
import { xpForLevel } from "./xpCurve.ts";
import { PIER_FISH, PIER_RECORDS } from "./pier.ts";

export const content: Content = {
  map,
  respawnPoint: CITY_SPAWN,
  objects: (() => {
    const withCamps = [...objects, ...buildCampObjects(spread)];
    // The towns are laid into seats that are already busy, so the builder is
    // told which tiles are taken rather than guessing.
    const taken = new Set(withCamps.map((o) => `${o.x},${o.y}`));
    return [...withCamps, ...buildTownObjects(fromV2, taken)];
  })(),
  items,
  monsters,
  // Derived once at boot from `items` — the OSRS-style attack/defence vector
  // every combat calculation reads. See equipBonus.ts for why it is derived
  // rather than authored or generated.
  equipBonus: buildEquipBonuses(items),
  thieveTargets,
  // Filled in just below: it needs the finished bundle to read from.
  collectionLog: [],
  actions,
  quests,
  spells,
  lore,
  clueSpots,
  shops,
  factions,
  achievements,
  diaries,
  crops,
  furniture,
  surfaces,
  bountyGuides,
  bountyTasks,
  bountyShop,
  bountyUnlocks,
  huntingGrounds,
  pierFish: PIER_FISH,
  pierRecords: PIER_RECORDS,
  xpForLevel,
  skills,
};

// The collection log is derived FROM the finished bundle (it reads drop tables,
// container tables and the action registry), so it is filled in after the object
// literal rather than inside it.
content.collectionLog = buildCollectionLog(content);
// Combat achievements are derived from the boss roster and appended to the
// hand-authored list, so they flow through the same evaluator and the same UI.
content.achievements = [...content.achievements, ...buildCombatAchievements(content)];

/** The player's starting tile, re-exported for main.ts to place them. */
export const playerStart = playerSpawn;
