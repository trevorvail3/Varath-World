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
import { skills } from "./skills.ts";
import { xpForLevel } from "./xpCurve.ts";
import { PIER_FISH, PIER_RECORDS } from "./pier.ts";

export const content: Content = {
  map,
  respawnPoint: CITY_SPAWN,
  objects,
  items,
  monsters,
  // Derived once at boot from `items` — the OSRS-style attack/defence vector
  // every combat calculation reads. See equipBonus.ts for why it is derived
  // rather than authored or generated.
  equipBonus: buildEquipBonuses(items),
  thieveTargets,
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

/** The player's starting tile, re-exported for main.ts to place them. */
export const playerStart = playerSpawn;
