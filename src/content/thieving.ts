/**
 * src/content/thieving.ts
 * -----------------------
 * Thieving targets: who you can pickpocket, which stalls you can clear, and
 * what each is worth.
 *
 * The shape is deliberately the same for every target so one core loop handles
 * all of them: a level to attempt it, a success chance that improves as you
 * outgrow it, a reward table, and what it costs you when a hand closes on your
 * wrist. Pickpockets punish you (a stun and a slap); stalls mostly just fail.
 *
 * RULE 1 SAFE: pure data.
 */

import type { ItemId } from "../core/types.ts";

export interface ThieveTarget {
  /** The world-object id (an npc or a stall) this describes. */
  id: string;
  /** Display name for the log lines. */
  name: string;
  levelReq: number;
  xp: number;
  /** Base success chance AT `levelReq`. It climbs toward `successCap` as you
   *  outlevel the mark. */
  success: number;
  successCap: number;
  /** Coin range on a success. */
  gold?: [number, number];
  /** Item rolls on a success — each an independent chance. */
  loot?: { item: ItemId; chance: number; min?: number; max?: number }[];
  /** Caught: damage taken and how long you are held. Stalls have no owner
   *  willing to hit you, so they leave these off. */
  stunMs?: number;
  damage?: number;
  /** How long this target is unavailable after a successful theft. A stall has
   *  to be restocked; a pocket has to be refilled. */
  respawnMs: number;
  kind: "pocket" | "stall";
}

/**
 * The roster. Pickpocket marks are drawn from NPCs already standing in the
 * world — no new spawns, so every one of these is somebody you have walked past
 * a hundred times and can now look at differently.
 */
export const thieveTargets: ThieveTarget[] = [
  // --- Pockets -------------------------------------------------------------
  {
    id: "town_child", name: "a street child", kind: "pocket",
    levelReq: 1, xp: 8, success: 0.55, successCap: 0.95,
    gold: [1, 12],
    stunMs: 2400, damage: 1, respawnMs: 12_000,
  },
  {
    id: "town_crier", name: "the town crier", kind: "pocket",
    levelReq: 10, xp: 22, success: 0.5, successCap: 0.92,
    gold: [8, 40],
    stunMs: 3000, damage: 3, respawnMs: 15_000,
  },
  {
    id: "builder_merchant", name: "the builder", kind: "pocket",
    levelReq: 25, xp: 48, success: 0.45, successCap: 0.9,
    gold: [25, 95],
    loot: [{ item: "plank_ashwood", chance: 0.3, min: 2, max: 6 }],
    stunMs: 3600, damage: 6, respawnMs: 18_000,
  },
  {
    id: "maerwen", name: "Maerwen the Antiquarian", kind: "pocket",
    levelReq: 45, xp: 96, success: 0.4, successCap: 0.88,
    gold: [70, 220],
    loot: [{ item: "rough_gem", chance: 0.12 }],
    stunMs: 4200, damage: 10, respawnMs: 22_000,
  },
  {
    // A guard is the hardest mark in town and hits back hardest — the OSRS
    // lesson that the person most worth robbing is the one wearing armour.
    id: "town_guard", name: "a town guard", kind: "pocket",
    levelReq: 60, xp: 160, success: 0.35, successCap: 0.85,
    gold: [150, 420],
    loot: [{ item: "rough_gem", chance: 0.2 }],
    stunMs: 5400, damage: 18, respawnMs: 26_000,
  },

  // --- Stalls --------------------------------------------------------------
  // No owner is going to punch you over an apple, so a failed stall costs time
  // rather than blood. They are the safe, boring, reliable half of the skill.
  {
    id: "stall_produce", name: "the produce stall", kind: "stall",
    levelReq: 1, xp: 12, success: 0.6, successCap: 0.95,
    loot: [{ item: "ashfin_cooked", chance: 0.5 }],
    gold: [2, 10],
    respawnMs: 9_000,
  },
  {
    id: "stall_baker", name: "the baker's stall", kind: "stall",
    levelReq: 15, xp: 34, success: 0.55, successCap: 0.93,
    gold: [10, 45],
    respawnMs: 11_000,
  },
  {
    id: "stall_silver", name: "the silversmith's stall", kind: "stall",
    levelReq: 35, xp: 78, success: 0.45, successCap: 0.9,
    gold: [60, 180],
    loot: [{ item: "rough_gem", chance: 0.15 }],
    respawnMs: 15_000,
  },
  {
    id: "stall_gem", name: "the gem stall", kind: "stall",
    levelReq: 55, xp: 145, success: 0.4, successCap: 0.87,
    gold: [140, 380],
    loot: [{ item: "rough_gem", chance: 0.35 }, { item: "cut_gem", chance: 0.08 }],
    respawnMs: 20_000,
  },
];

/** Look a target up by the world-object id it belongs to. */
export const thieveTargetFor = (id: string): ThieveTarget | undefined =>
  thieveTargets.find((t) => t.id === id);
