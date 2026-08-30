/**
 * src/content/actions.ts
 * ----------------------
 * The full skill-action registry, ported faithfully from every
 * `SKILLS[*].actions` entry in the Varath idle game. 253 actions across the
 * gathering + processing skills: levelReq, xp, requires/produces and drop
 * tables are copied verbatim. `baseTime` is the idle game's action time (ms);
 * the spatial game re-tunes pacing when it wires each skill (see CANON_LEDGER).
 *
 * GENERATED from varath_21.html. This is canonical DATA; gameplay still runs on
 * the wired recipes in processing.ts / forging.ts until a later bundle migrates
 * each skill to read from here.
 */

import type { SkillAction } from "../core/types.ts";

export const actions: SkillAction[] = [
  {
    "id": "mine_knucklestone",
    "skill": "mining",
    "name": "Knucklestone",
    "levelReq": 1,
    "xp": 10,
    "produces": "knucklestone_ore"
  },
  {
    "id": "mine_silica",
    "skill": "mining",
    "name": "Silica Sand",
    "levelReq": 8,
    "xp": 14,
    "produces": "silica_sand",
    "note": "Fine quartz-rich sand found in pale veins. Used in glassblowing."
  },
  {
    "id": "mine_embercite",
    "skill": "mining",
    "name": "Embercite",
    "levelReq": 15,
    "xp": 32,
    "produces": "embercite_ore"
  },
  {
    "id": "mine_ashiron",
    "skill": "mining",
    "name": "Ashiron",
    "levelReq": 20,
    "xp": 35,
    "produces": "ashiron_ore"
  },
  {
    "id": "mine_ribstone",
    "skill": "mining",
    "name": "Ribstone",
    "levelReq": 30,
    "xp": 55,
    "produces": "ribstone_ore"
  },
  {
    "id": "mine_spinite",
    "skill": "mining",
    "name": "Spinite",
    "levelReq": 36,
    "xp": 60,
    "produces": "spinite_ore",
    "note": "Cold blue-grey ore cut from the Spine. The mid-game metal between ribstone and bloodore."
  },
  {
    "id": "mine_rough_gem",
    "skill": "mining",
    "name": "Rough Gem",
    "levelReq": 40,
    "xp": 70,
    "produces": "rough_gem",
    "note": "Uncut gemstones from deep rock. A Crafting skill of 30 can cut these."
  },
  {
    "id": "mine_embercite_deep",
    "skill": "mining",
    "name": "Deep Embercite",
    "levelReq": 50,
    "xp": 95,
    "produces": "embercite_ore",
    "note": "A seam that runs deeper and richer than the surface workings."
  },
  {
    "id": "mine_bloodore_rich",
    "skill": "mining",
    "name": "Rich Bloodore",
    "levelReq": 75,
    "xp": 170,
    "produces": "bloodore_ore",
    "note": "A vein so red it looks wet. Miners call these bleeders."
  },
  {
    "id": "mine_gold",
    "skill": "mining",
    "name": "Gold",
    "levelReq": 42,
    "xp": 65,
    "produces": "gold_ore",
    "note": "Soft, dense ore. Smelted into gold bars used in jewellery-making."
  },
  {
    "id": "mine_bloodore",
    "skill": "mining",
    "name": "Bloodore",
    "levelReq": 60,
    "xp": 115,
    "produces": "bloodore_ore",
    "rareDrop": {
      "item": "rough_gem",
      "chance": 0.04
    }
  },
  {
    "id": "mine_voidstone",
    "skill": "mining",
    "name": "Voidstone",
    "levelReq": 88,
    "xp": 220,
    "produces": "voidstone_ore",
    "note": "The deepest mineable ore. Hearthite lies beyond it.",
    "rareDrop": {
      "item": "rough_gem",
      "chance": 0.08
    }
  },
  {
    "id": "mine_hearthite",
    "skill": "mining",
    "name": "Hearthite Seam",
    "levelReq": 93,
    "xp": 340,
    "produces": "hearthite_ore",
    "note": "The forge-ore itself, past the voidstone. Mine it and the game's best gear no longer depends on a boss's whim — Mining 100 finally smiths its own.",
    "rareDrop": {
      "item": "rough_gem",
      "chance": 0.1
    }
  },
  {
    "id": "mine_gemvein",
    "skill": "mining",
    "name": "Prismatic Vein",
    "levelReq": 96,
    "xp": 180,
    "produces": "rough_gem",
    "note": "A gem-shot seam deep past the hearthite. Rough gems by the fistful — and now and then an uncut stone worth cutting.",
    "rareDrop": {
      "item": "uncut_emerald",
      "chance": 0.12
    }
  },
  {
    "id": "smelt_knucklestone",
    "skill": "smithing",
    "name": "Knucklestone Bar",
    "levelReq": 1,
    "xp": 15,
    "requires": {
      "knucklestone_ore": 1
    },
    "produces": "knucklestone_bar"
  },
  {
    "id": "smelt_ashiron",
    "skill": "smithing",
    "name": "Ashiron Bar",
    "levelReq": 20,
    "xp": 50,
    "requires": {
      "ashiron_ore": 1,
      "embercite_ore": 2
    },
    "produces": "ashiron_bar"
  },
  {
    "id": "smelt_ribstone",
    "skill": "smithing",
    "name": "Ribstone Bar",
    "levelReq": 30,
    "xp": 75,
    "requires": {
      "ribstone_ore": 1,
      "embercite_ore": 2
    },
    "produces": "ribstone_bar"
  },
  {
    "id": "smelt_spinite",
    "skill": "smithing",
    "name": "Spinite Bar",
    "levelReq": 40,
    "xp": 105,
    "requires": {
      "spinite_ore": 1,
      "embercite_ore": 2
    },
    "produces": "spinite_bar"
  },
  {
    "id": "smelt_gold",
    "skill": "smithing",
    "name": "Gold Bar",
    "levelReq": 35,
    "xp": 60,
    "requires": {
      "gold_ore": 2
    },
    "produces": "gold_bar"
  },
  {
    "id": "smelt_bloodore",
    "skill": "smithing",
    "name": "Bloodore Bar",
    "levelReq": 60,
    "xp": 165,
    "requires": {
      "bloodore_ore": 1,
      "embercite_ore": 3
    },
    "produces": "bloodore_bar"
  },
  {
    "id": "smelt_voidstone",
    "skill": "smithing",
    "name": "Voidstone Bar",
    "levelReq": 88,
    "xp": 310,
    "requires": {
      "voidstone_ore": 1,
      "embercite_ore": 5
    },
    "produces": "voidstone_bar"
  },
  {
    "id": "smelt_hearthite",
    "skill": "smithing",
    "name": "Hearthite Bar",
    "levelReq": 95,
    "xp": 330,
    "requires": {
      "hearthite_ore": 1,
      "embercite_ore": 5
    },
    "produces": "hearthite_bar"
  },
  {
    "id": "forge_pick_3",
    "skill": "smithing",
    "name": "Ashiron Pickaxe",
    "levelReq": 22,
    "xp": 46,
    "baseTime": 4000,
    "requires": {
      "ashiron_bar": 1
    },
    "produces": "pickaxe_3"
  },
  {
    "id": "forge_pick_4",
    "skill": "smithing",
    "name": "Ribstone Pickaxe",
    "levelReq": 32,
    "xp": 52,
    "baseTime": 4000,
    "requires": {
      "ribstone_bar": 1
    },
    "produces": "pickaxe_4"
  },
  {
    "id": "forge_pick_6",
    "skill": "smithing",
    "name": "Bloodore Pickaxe",
    "levelReq": 62,
    "xp": 128,
    "baseTime": 4000,
    "requires": {
      "bloodore_bar": 2
    },
    "produces": "pickaxe_6"
  },
  {
    "id": "forge_pick_5",
    "skill": "smithing",
    "name": "Goldbound Pickaxe",
    "levelReq": 45,
    "xp": 78,
    "baseTime": 3500,
    "requires": {
      "ribstone_bar": 2,
      "gold_bar": 1
    },
    "produces": "pickaxe_5"
  },
  {
    "id": "forge_pick_7",
    "skill": "smithing",
    "name": "Palesteel Pickaxe",
    "levelReq": 75,
    "xp": 170,
    "baseTime": 4500,
    "requires": {
      "bloodore_bar": 3
    },
    "produces": "pickaxe_7"
  },
  {
    "id": "forge_pick_9",
    "skill": "smithing",
    "name": "Voidstone Pickaxe",
    "levelReq": 90,
    "xp": 236,
    "baseTime": 4000,
    "requires": {
      "voidstone_bar": 3
    },
    "produces": "pickaxe_9"
  },
  {
    "id": "forge_pick_10",
    "skill": "smithing",
    "name": "Hearthite Pickaxe",
    "levelReq": 92,
    "xp": 256,
    "baseTime": 4000,
    "requires": {
      "hearthite_bar": 3
    },
    "produces": "pickaxe_10"
  },
  {
    "id": "forge_hatch_3",
    "skill": "smithing",
    "name": "Ashiron Hatchet",
    "levelReq": 21,
    "xp": 44,
    "baseTime": 4000,
    "requires": {
      "ashiron_bar": 1
    },
    "produces": "hatchet_3"
  },
  {
    "id": "forge_hatch_4",
    "skill": "smithing",
    "name": "Ribstone Hatchet",
    "levelReq": 31,
    "xp": 49,
    "baseTime": 4000,
    "requires": {
      "ribstone_bar": 1
    },
    "produces": "hatchet_4"
  },
  {
    "id": "forge_hatch_6",
    "skill": "smithing",
    "name": "Bloodore Hatchet",
    "levelReq": 61,
    "xp": 122,
    "baseTime": 4000,
    "requires": {
      "bloodore_bar": 2
    },
    "produces": "hatchet_6"
  },
  {
    "id": "forge_axe_5",
    "skill": "smithing",
    "name": "Goldbound Hatchet",
    "levelReq": 46,
    "xp": 76,
    "baseTime": 3500,
    "requires": {
      "ribstone_bar": 2,
      "gold_bar": 1
    },
    "produces": "hatchet_5"
  },
  {
    "id": "forge_axe_7",
    "skill": "smithing",
    "name": "Palesteel Hatchet",
    "levelReq": 76,
    "xp": 168,
    "baseTime": 4500,
    "requires": {
      "bloodore_bar": 3
    },
    "produces": "hatchet_7"
  },
  {
    "id": "forge_hatch_9",
    "skill": "smithing",
    "name": "Voidstone Hatchet",
    "levelReq": 89,
    "xp": 225,
    "baseTime": 4000,
    "requires": {
      "voidstone_bar": 3
    },
    "produces": "hatchet_9"
  },
  {
    "id": "forge_hatch_10",
    "skill": "smithing",
    "name": "Hearthite Hatchet",
    "levelReq": 91,
    "xp": 244,
    "baseTime": 4000,
    "requires": {
      "hearthite_bar": 3
    },
    "produces": "hatchet_10"
  },
  {
    "id": "arms_tips_1",
    "skill": "smithing",
    "name": "Knucklestone Tips ×10",
    "levelReq": 1,
    "xp": 10,
    "baseTime": 2000,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "tip_knucklestone",
    "produceQty": 10
  },
  {
    "id": "arms_tips_3",
    "skill": "smithing",
    "name": "Ashiron Tips ×10",
    "levelReq": 20,
    "xp": 30,
    "baseTime": 2000,
    "requires": {
      "ashiron_bar": 1
    },
    "produces": "tip_ashiron",
    "produceQty": 10
  },
  {
    "id": "arms_tips_4",
    "skill": "smithing",
    "name": "Ribstone Tips ×10",
    "levelReq": 30,
    "xp": 50,
    "baseTime": 2000,
    "requires": {
      "ribstone_bar": 1
    },
    "produces": "tip_ribstone",
    "produceQty": 10
  },
  {
    "id": "arms_tips_6",
    "skill": "smithing",
    "name": "Bloodore Tips ×10",
    "levelReq": 60,
    "xp": 90,
    "baseTime": 2000,
    "requires": {
      "bloodore_bar": 1
    },
    "produces": "tip_bloodore",
    "produceQty": 10
  },
  {
    "id": "arms_tips_9",
    "skill": "smithing",
    "name": "Voidstone Tips ×10",
    "levelReq": 88,
    "xp": 160,
    "baseTime": 2000,
    "requires": {
      "voidstone_bar": 1
    },
    "produces": "tip_voidstone",
    "produceQty": 10
  },
  {
    "id": "arms_tips_10",
    "skill": "smithing",
    "name": "Hearthite Tips ×10",
    "levelReq": 90,
    "xp": 190,
    "baseTime": 2000,
    "requires": {
      "hearthite_bar": 1
    },
    "produces": "tip_hearthite",
    "produceQty": 10
  },
  {
    "id": "forge_boot_1",
    "skill": "smithing",
    "name": "Knucklestone Boots",
    "levelReq": 1,
    "xp": 17,
    "baseTime": 3500,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "boot_1"
  },
  {
    "id": "forge_boot_3",
    "skill": "smithing",
    "name": "Ashiron Boots",
    "levelReq": 20,
    "xp": 23,
    "baseTime": 3500,
    "requires": {
      "ashiron_bar": 1
    },
    "produces": "boot_3"
  },
  {
    "id": "forge_boot_4",
    "skill": "smithing",
    "name": "Ribstone Boots",
    "levelReq": 30,
    "xp": 26,
    "baseTime": 3500,
    "requires": {
      "ribstone_bar": 1
    },
    "produces": "boot_4"
  },
  {
    "id": "forge_boot_5",
    "skill": "smithing",
    "name": "Spinite Boots",
    "levelReq": 43,
    "xp": 52,
    "baseTime": 3500,
    "requires": {
      "spinite_bar": 1
    },
    "produces": "boot_5"
  },
  {
    "id": "forge_boot_6",
    "skill": "smithing",
    "name": "Bloodore Boots",
    "levelReq": 60,
    "xp": 64,
    "baseTime": 3500,
    "requires": {
      "bloodore_bar": 2
    },
    "produces": "boot_6"
  },
  {
    "id": "forge_boot_10",
    "skill": "smithing",
    "name": "Hearthite Boots",
    "levelReq": 90,
    "xp": 100,
    "baseTime": 3500,
    "requires": {
      "hearthite_bar": 2
    },
    "produces": "boot_10"
  },
  {
    "id": "forge_helm_1",
    "skill": "smithing",
    "name": "Knucklestone Helm",
    "levelReq": 2,
    "xp": 24,
    "baseTime": 4000,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "helm_1"
  },
  {
    "id": "forge_helm_3",
    "skill": "smithing",
    "name": "Ashiron Helm",
    "levelReq": 21,
    "xp": 32,
    "baseTime": 4000,
    "requires": {
      "ashiron_bar": 1
    },
    "produces": "helm_3"
  },
  {
    "id": "forge_helm_4",
    "skill": "smithing",
    "name": "Ribstone Helm",
    "levelReq": 31,
    "xp": 36,
    "baseTime": 4000,
    "requires": {
      "ribstone_bar": 1
    },
    "produces": "helm_4"
  },
  {
    "id": "forge_helm_5",
    "skill": "smithing",
    "name": "Spinite Helm",
    "levelReq": 42,
    "xp": 60,
    "baseTime": 4000,
    "requires": {
      "spinite_bar": 1
    },
    "produces": "helm_5"
  },
  {
    "id": "forge_helm_6",
    "skill": "smithing",
    "name": "Bloodore Helm",
    "levelReq": 61,
    "xp": 90,
    "baseTime": 4000,
    "requires": {
      "bloodore_bar": 2
    },
    "produces": "helm_6"
  },
  {
    "id": "forge_helm_10",
    "skill": "smithing",
    "name": "Hearthite Helm",
    "levelReq": 91,
    "xp": 160,
    "baseTime": 4000,
    "requires": {
      "hearthite_bar": 3
    },
    "produces": "helm_10"
  },
  {
    "id": "arms_sword_1",
    "skill": "smithing",
    "name": "Knucklestone Sword",
    "levelReq": 4,
    "xp": 26,
    "baseTime": 4000,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "sword_1"
  },
  {
    "id": "arms_sword_3",
    "skill": "smithing",
    "name": "Ashiron Sword",
    "levelReq": 23,
    "xp": 34,
    "baseTime": 4000,
    "requires": {
      "ashiron_bar": 1
    },
    "produces": "sword_3"
  },
  {
    "id": "arms_sword_4",
    "skill": "smithing",
    "name": "Ribstone Sword",
    "levelReq": 33,
    "xp": 78,
    "baseTime": 4000,
    "requires": {
      "ribstone_bar": 2
    },
    "produces": "sword_4"
  },
  {
    "id": "arms_sword_5",
    "skill": "smithing",
    "name": "Spinite Sword",
    "levelReq": 46,
    "xp": 100,
    "baseTime": 4000,
    "requires": {
      "spinite_bar": 2
    },
    "produces": "sword_5"
  },
  {
    "id": "arms_sword_6",
    "skill": "smithing",
    "name": "Bloodore Sword",
    "levelReq": 63,
    "xp": 144,
    "baseTime": 4000,
    "requires": {
      "bloodore_bar": 3
    },
    "produces": "sword_6"
  },
  {
    "id": "arms_sword_10",
    "skill": "smithing",
    "name": "Hearthite Sword",
    "levelReq": 93,
    "xp": 270,
    "baseTime": 4000,
    "requires": {
      "hearthite_bar": 4
    },
    "produces": "sword_10"
  },
  {
    "id": "arms_dagger_1",
    "skill": "smithing",
    "name": "Knucklestone Dagger",
    "levelReq": 3,
    "xp": 20,
    "baseTime": 3500,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "dagger_1"
  },
  {
    "id": "arms_dagger_3",
    "skill": "smithing",
    "name": "Ashiron Dagger",
    "levelReq": 22,
    "xp": 28,
    "baseTime": 3500,
    "requires": {
      "ashiron_bar": 1
    },
    "produces": "dagger_3"
  },
  {
    "id": "arms_dagger_4",
    "skill": "smithing",
    "name": "Ribstone Dagger",
    "levelReq": 32,
    "xp": 64,
    "baseTime": 3500,
    "requires": {
      "ribstone_bar": 2
    },
    "produces": "dagger_4"
  },
  {
    "id": "arms_dagger_5",
    "skill": "smithing",
    "name": "Spinite Dagger",
    "levelReq": 44,
    "xp": 78,
    "baseTime": 3500,
    "requires": {
      "spinite_bar": 1
    },
    "produces": "dagger_5"
  },
  {
    "id": "arms_dagger_6",
    "skill": "smithing",
    "name": "Bloodore Dagger",
    "levelReq": 62,
    "xp": 118,
    "baseTime": 3500,
    "requires": {
      "bloodore_bar": 3
    },
    "produces": "dagger_6"
  },
  {
    "id": "arms_dagger_10",
    "skill": "smithing",
    "name": "Hearthite Dagger",
    "levelReq": 92,
    "xp": 225,
    "baseTime": 3500,
    "requires": {
      "hearthite_bar": 4
    },
    "produces": "dagger_10"
  },
  {
    "id": "arms_hammer_1",
    "skill": "smithing",
    "name": "Knucklestone Mace",
    "levelReq": 5,
    "xp": 30,
    "baseTime": 4500,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "hammer_1"
  },
  {
    "id": "arms_hammer_3",
    "skill": "smithing",
    "name": "Ashiron Mace",
    "levelReq": 24,
    "xp": 82,
    "baseTime": 4500,
    "requires": {
      "ashiron_bar": 2
    },
    "produces": "hammer_3"
  },
  {
    "id": "arms_hammer_4",
    "skill": "smithing",
    "name": "Ribstone Mace",
    "levelReq": 34,
    "xp": 92,
    "baseTime": 4500,
    "requires": {
      "ribstone_bar": 2
    },
    "produces": "hammer_4"
  },
  {
    "id": "arms_hammer_6",
    "skill": "smithing",
    "name": "Bloodore Mace",
    "levelReq": 64,
    "xp": 176,
    "baseTime": 4500,
    "requires": {
      "bloodore_bar": 3
    },
    "produces": "hammer_6"
  },
  {
    "id": "arms_hammer_10",
    "skill": "smithing",
    "name": "Hearthite Mace",
    "levelReq": 94,
    "xp": 420,
    "baseTime": 4500,
    "requires": {
      "hearthite_bar": 5
    },
    "produces": "hammer_10"
  },
  {
    "id": "arms_claymore_1",
    "skill": "smithing",
    "name": "Knucklestone Greatsword",
    "levelReq": 6,
    "xp": 36,
    "baseTime": 5500,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "claymore_1"
  },
  {
    "id": "arms_claymore_3",
    "skill": "smithing",
    "name": "Ashiron Greatsword",
    "levelReq": 25,
    "xp": 96,
    "baseTime": 5500,
    "requires": {
      "ashiron_bar": 2
    },
    "produces": "claymore_3"
  },
  {
    "id": "arms_claymore_4",
    "skill": "smithing",
    "name": "Ribstone Greatsword",
    "levelReq": 35,
    "xp": 110,
    "baseTime": 5500,
    "requires": {
      "ribstone_bar": 3
    },
    "produces": "claymore_4"
  },
  {
    "id": "arms_claymore_6",
    "skill": "smithing",
    "name": "Bloodore Greatsword",
    "levelReq": 65,
    "xp": 204,
    "baseTime": 5500,
    "requires": {
      "bloodore_bar": 4
    },
    "produces": "claymore_6"
  },
  {
    "id": "arms_claymore_10",
    "skill": "smithing",
    "name": "Hearthite Greatsword",
    "levelReq": 95,
    "xp": 480,
    "baseTime": 5500,
    "requires": {
      "hearthite_bar": 5
    },
    "produces": "claymore_10"
  },
  {
    "id": "forge_spear_1",
    "skill": "smithing",
    "name": "Knucklestone Spear",
    "levelReq": 5,
    "xp": 24,
    "baseTime": 4500,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "spear_1"
  },
  {
    "id": "forge_spear_3",
    "skill": "smithing",
    "name": "Ashiron Spear",
    "levelReq": 24,
    "xp": 64,
    "baseTime": 4500,
    "requires": {
      "ashiron_bar": 2
    },
    "produces": "spear_3"
  },
  {
    "id": "forge_spear_4",
    "skill": "smithing",
    "name": "Ribstone Spear",
    "levelReq": 34,
    "xp": 73,
    "baseTime": 4500,
    "requires": {
      "ribstone_bar": 2
    },
    "produces": "spear_4"
  },
  {
    "id": "forge_spear_6",
    "skill": "smithing",
    "name": "Bloodore Spear",
    "levelReq": 64,
    "xp": 134,
    "baseTime": 4500,
    "requires": {
      "bloodore_bar": 3
    },
    "produces": "spear_6"
  },
  {
    "id": "forge_spear_10",
    "skill": "smithing",
    "name": "Hearthite Spear",
    "levelReq": 94,
    "xp": 252,
    "baseTime": 4500,
    "requires": {
      "hearthite_bar": 4
    },
    "produces": "spear_10"
  },
  {
    "id": "forge_shld_1",
    "skill": "smithing",
    "name": "Knucklestone Shield",
    "levelReq": 5,
    "xp": 22,
    "baseTime": 4000,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "shield_1"
  },
  {
    "id": "forge_shld_3",
    "skill": "smithing",
    "name": "Ashiron Shield",
    "levelReq": 24,
    "xp": 30,
    "baseTime": 4000,
    "requires": {
      "ashiron_bar": 1
    },
    "produces": "shield_3"
  },
  {
    "id": "forge_shld_4",
    "skill": "smithing",
    "name": "Ribstone Shield",
    "levelReq": 34,
    "xp": 68,
    "baseTime": 4000,
    "requires": {
      "ribstone_bar": 2
    },
    "produces": "shield_4"
  },
  {
    "id": "forge_shld_5",
    "skill": "smithing",
    "name": "Spinite Shield",
    "levelReq": 48,
    "xp": 108,
    "baseTime": 4000,
    "requires": {
      "spinite_bar": 2
    },
    "produces": "shield_5"
  },
  {
    "id": "forge_shld_6",
    "skill": "smithing",
    "name": "Bloodore Shield",
    "levelReq": 64,
    "xp": 125,
    "baseTime": 4000,
    "requires": {
      "bloodore_bar": 3
    },
    "produces": "shield_6"
  },
  {
    "id": "forge_shld_10",
    "skill": "smithing",
    "name": "Hearthite Shield",
    "levelReq": 94,
    "xp": 236,
    "baseTime": 4000,
    "requires": {
      "hearthite_bar": 4
    },
    "produces": "shield_10"
  },
  {
    "id": "forge_legs_1",
    "skill": "smithing",
    "name": "Knucklestone Leg Plate",
    "levelReq": 7,
    "xp": 30,
    "baseTime": 4500,
    "requires": {
      "knucklestone_bar": 1
    },
    "produces": "legs_1"
  },
  {
    "id": "forge_legs_3",
    "skill": "smithing",
    "name": "Ashiron Leg Plate",
    "levelReq": 26,
    "xp": 80,
    "baseTime": 4500,
    "requires": {
      "ashiron_bar": 2
    },
    "produces": "legs_3"
  },
  {
    "id": "forge_legs_4",
    "skill": "smithing",
    "name": "Ribstone Leg Plate",
    "levelReq": 36,
    "xp": 136,
    "baseTime": 4500,
    "requires": {
      "ribstone_bar": 3
    },
    "produces": "legs_4"
  },
  {
    "id": "forge_legs_5",
    "skill": "smithing",
    "name": "Spinite Leg Plate",
    "levelReq": 50,
    "xp": 130,
    "baseTime": 4500,
    "requires": {
      "spinite_bar": 3
    },
    "produces": "legs_5"
  },
  {
    "id": "forge_legs_6",
    "skill": "smithing",
    "name": "Bloodore Leg Plate",
    "levelReq": 66,
    "xp": 224,
    "baseTime": 4500,
    "requires": {
      "bloodore_bar": 4
    },
    "produces": "legs_6"
  },
  {
    "id": "forge_legs_8",
    "skill": "smithing",
    "name": "Hearthite Leg Plate",
    "levelReq": 96,
    "xp": 332,
    "baseTime": 4500,
    "requires": {
      "hearthite_bar": 5
    },
    "produces": "legs_8"
  },
  {
    "id": "arms_armor_1",
    "skill": "smithing",
    "name": "Knucklestone Mail",
    "levelReq": 8,
    "xp": 85,
    "baseTime": 5000,
    "requires": {
      "knucklestone_bar": 2
    },
    "produces": "armor_1"
  },
  {
    "id": "arms_armor_3",
    "skill": "smithing",
    "name": "Ashiron Mail",
    "levelReq": 27,
    "xp": 172,
    "baseTime": 5000,
    "requires": {
      "ashiron_bar": 3
    },
    "produces": "armor_3"
  },
  {
    "id": "arms_armor_4",
    "skill": "smithing",
    "name": "Ribstone Plate",
    "levelReq": 37,
    "xp": 195,
    "baseTime": 5000,
    "requires": {
      "ribstone_bar": 3
    },
    "produces": "armor_4"
  },
  {
    "id": "arms_armor_5",
    "skill": "smithing",
    "name": "Spinite Plate",
    "levelReq": 52,
    "xp": 145,
    "baseTime": 5000,
    "requires": {
      "spinite_bar": 3
    },
    "produces": "armor_5"
  },
  {
    "id": "arms_armor_6",
    "skill": "smithing",
    "name": "Bloodore Plate",
    "levelReq": 67,
    "xp": 320,
    "baseTime": 5000,
    "requires": {
      "bloodore_bar": 4
    },
    "produces": "armor_6"
  },
  {
    "id": "arms_armor_10",
    "skill": "smithing",
    "name": "Hearthite Plate",
    "levelReq": 97,
    "xp": 570,
    "baseTime": 5000,
    "requires": {
      "hearthite_bar": 6
    },
    "produces": "armor_10"
  },
  {
    "id": "reforge_melt_all",
    "skill": "smithing",
    "name": "Melt All (cheapest first)",
    "levelReq": 1,
    "xp": 0,
    "baseTime": 2000,
    "group": "reforge",
    "meltAll": true
  },
  {
    "id": "fell_ashwood",
    "skill": "forestry",
    "name": "Ashwood",
    "levelReq": 1,
    "xp": 25,
    "produces": "ashwood_log",
    "rareDrop": {
      "item": "bird_nest",
      "chance": 0.08
    },
    "seedDrop": {
      "item": "seed_ashwood",
      "chance": 0.05
    },
    "woodShardDrop": {
      "chance": 0.04
    }
  },
  {
    "id": "fell_alder",
    "skill": "forestry",
    "name": "Alderwood",
    "levelReq": 8,
    "xp": 40,
    "produces": "alder_log",
    "note": "A new tree to fell by level 8 — so the opening stretch isn't nineteen straight levels of ashwood.",
    "rareDrop": {
      "item": "bird_nest",
      "chance": 0.08
    },
    "woodShardDrop": {
      "chance": 0.05
    }
  },
  {
    "id": "fell_birch",
    "skill": "forestry",
    "name": "Silverbirch",
    "levelReq": 14,
    "xp": 55,
    "produces": "birch_log",
    "rareDrop": {
      "item": "bird_nest",
      "chance": 0.09
    },
    "woodShardDrop": {
      "chance": 0.05
    }
  },
  {
    "id": "fell_coldpine",
    "skill": "forestry",
    "name": "Coldpine",
    "levelReq": 20,
    "xp": 68,
    "produces": "coldpine_log",
    "rareDrop": {
      "item": "pine_resin",
      "chance": 0.12
    },
    "seedDrop": {
      "item": "seed_coldpine",
      "chance": 0.05
    },
    "woodShardDrop": {
      "chance": 0.06
    }
  },
  {
    "id": "fell_stonewood",
    "skill": "forestry",
    "name": "Stonewood",
    "levelReq": 30,
    "xp": 95,
    "produces": "stonewood_log",
    "rareDrop": {
      "item": "ironwood_sap",
      "chance": 0.1
    },
    "seedDrop": {
      "item": "seed_stonewood",
      "chance": 0.05
    },
    "woodShardDrop": {
      "chance": 0.07
    }
  },
  {
    "id": "fell_greyoak",
    "skill": "forestry",
    "name": "Greyoak",
    "levelReq": 45,
    "xp": 135,
    "produces": "greyoak_log",
    "rareDrop": {
      "item": "greyoak_gall",
      "chance": 0.08
    },
    "seedDrop": {
      "item": "seed_greyoak",
      "chance": 0.05
    },
    "woodShardDrop": {
      "chance": 0.08
    }
  },
  {
    "id": "fell_ironbark",
    "skill": "forestry",
    "name": "Ironbark",
    "levelReq": 55,
    "xp": 160,
    "produces": "ironbark_log",
    "rareDrop": {
      "item": "ironbark_shard",
      "chance": 0.08
    },
    "woodShardDrop": {
      "chance": 0.08
    }
  },
  {
    "id": "fell_ironbark_old",
    "skill": "forestry",
    "name": "Old-Growth Ironbark",
    "levelReq": 70,
    "xp": 225,
    "produces": "ironbark_log",
    "note": "Centuries-old ironbark, black to the heart. Slow work that pays."
  },
  {
    "id": "fell_ruewood",
    "skill": "forestry",
    "name": "Ruewood",
    "levelReq": 60,
    "xp": 185,
    "produces": "ruewood_log",
    "rareDrop": {
      "item": "ruewood_splinter",
      "chance": 0.1
    },
    "seedDrop": {
      "item": "seed_ruewood",
      "chance": 0.05
    },
    "woodShardDrop": {
      "chance": 0.09
    }
  },
  {
    "id": "fell_heartoak",
    "skill": "forestry",
    "name": "Heartoak",
    "levelReq": 80,
    "xp": 260,
    "produces": "heartoak_log",
    "rareDrop": {
      "item": "heartoak_amber",
      "chance": 0.06
    },
    "woodShardDrop": {
      "chance": 0.11
    }
  },
  {
    "id": "fell_deeproot",
    "skill": "forestry",
    "name": "Deeproot",
    "levelReq": 90,
    "xp": 320,
    "produces": "deeproot_log",
    "rareDrop": {
      "item": "deeproot_chip",
      "chance": 0.08
    },
    "seedDrop": {
      "item": "seed_deeproot",
      "chance": 0.05
    },
    "woodShardDrop": {
      "chance": 0.12
    }
  },
  {
    "id": "arr_knucklestone",
    "skill": "woodcraft",
    "name": "Knucklestone Arrow",
    "levelReq": 1,
    "xp": 6,
    "baseTime": 1500,
    "requires": {
      "ashwood_shaft": 1,
      "tip_knucklestone": 1
    },
    "produces": "arrow_knucklestone",
    "group": "arrows"
  },
  {
    "id": "arr_ashiron",
    "skill": "woodcraft",
    "name": "Ashiron Arrow",
    "levelReq": 20,
    "xp": 18,
    "baseTime": 1500,
    "requires": {
      "coldpine_shaft": 1,
      "tip_ashiron": 1
    },
    "produces": "arrow_ashiron",
    "group": "arrows"
  },
  {
    "id": "arr_resin_ashiron",
    "skill": "woodcraft",
    "name": "Resin Ashiron Arrow",
    "levelReq": 28,
    "xp": 24,
    "baseTime": 1500,
    "requires": {
      "resin_shaft": 1,
      "tip_ashiron": 1
    },
    "produces": "arrow_ashiron_resin",
    "group": "arrows",
    "note": "Slightly more accurate than a standard Ashiron arrow."
  },
  {
    "id": "arr_ribstone",
    "skill": "woodcraft",
    "name": "Ribstone Arrow",
    "levelReq": 30,
    "xp": 25,
    "baseTime": 1500,
    "requires": {
      "greyoak_shaft": 1,
      "tip_ribstone": 1
    },
    "produces": "ribstone_arrow",
    "group": "arrows"
  },
  {
    "id": "arr_bloodore",
    "skill": "woodcraft",
    "name": "Bloodore Arrow",
    "levelReq": 60,
    "xp": 45,
    "baseTime": 1500,
    "requires": {
      "ruewood_shaft": 1,
      "tip_bloodore": 1
    },
    "produces": "bloodore_arrow",
    "group": "arrows"
  },
  {
    "id": "arr_voidstone",
    "skill": "woodcraft",
    "name": "Voidstone Arrow",
    "levelReq": 88,
    "xp": 70,
    "baseTime": 1500,
    "requires": {
      "deeproot_shaft": 1,
      "tip_voidstone": 1
    },
    "produces": "voidstone_arrow",
    "group": "arrows"
  },
  {
    "id": "arr_hearthite",
    "skill": "woodcraft",
    "name": "Hearthite Arrow",
    "levelReq": 90,
    "xp": 75,
    "baseTime": 2000,
    "requires": {
      "deeproot_shaft": 1,
      "tip_hearthite": 1
    },
    "produces": "arrow_hearthite",
    "group": "arrows"
  },
  {
    "id": "wcu_crude",
    "skill": "woodcraft",
    "name": "Crude Shortbow (U)",
    "levelReq": 1,
    "xp": 10,
    "requires": {
      "ashwood_log": 1
    },
    "produces": "unstrung_crude",
    "group": "unstrung"
  },
  // --- Faith casting staffs: shaped from matching logs at the workbench ---
  { "id": "wc_staff_ashwood", "skill": "woodcraft", "name": "Ashwood Staff", "levelReq": 1, "xp": 15, "requires": { "ashwood_log": 2 }, "produces": "staff_ashwood", "group": "staves" },
  { "id": "wc_staff_coldpine", "skill": "woodcraft", "name": "Coldpine Staff", "levelReq": 15, "xp": 30, "requires": { "coldpine_log": 2 }, "produces": "staff_coldpine", "group": "staves" },
  { "id": "wc_staff_stonewood", "skill": "woodcraft", "name": "Stonewood Staff", "levelReq": 30, "xp": 55, "requires": { "stonewood_log": 2 }, "produces": "staff_stonewood", "group": "staves" },
  { "id": "wc_staff_greyoak", "skill": "woodcraft", "name": "Greyoak Staff", "levelReq": 45, "xp": 85, "requires": { "greyoak_log": 2 }, "produces": "staff_greyoak", "group": "staves" },
  { "id": "wc_staff_ruewood", "skill": "woodcraft", "name": "Ruewood Staff", "levelReq": 60, "xp": 120, "requires": { "ruewood_log": 2 }, "produces": "staff_ruewood", "group": "staves" },
  { "id": "wc_staff_deeproot", "skill": "woodcraft", "name": "Deeproot Staff", "levelReq": 75, "xp": 170, "requires": { "deeproot_log": 2 }, "produces": "staff_deeproot", "group": "staves" },

  // --- Ranged armour (Crafting): leather + sinew, four tiers ---
  { "id": "cr_rng_hood_1", "skill": "crafting", "name": "Tanned Ranger Hood", "levelReq": 5, "xp": 30, "requires": { "tanned_leather": 2, "sinew": 1 }, "produces": "rng_hood_1", "group": "ranged_armour" },
  { "id": "cr_rng_body_1", "skill": "crafting", "name": "Tanned Ranger Body", "levelReq": 5, "xp": 50, "requires": { "tanned_leather": 3, "sinew": 1 }, "produces": "rng_body_1", "group": "ranged_armour" },
  { "id": "cr_rng_legs_1", "skill": "crafting", "name": "Tanned Ranger Chaps", "levelReq": 5, "xp": 40, "requires": { "tanned_leather": 2, "sinew": 1 }, "produces": "rng_legs_1", "group": "ranged_armour" },
  { "id": "cr_rng_hood_2", "skill": "crafting", "name": "Studded Ranger Hood", "levelReq": 25, "xp": 70, "requires": { "cured_leather": 2, "sinew": 1 }, "produces": "rng_hood_2", "group": "ranged_armour" },
  { "id": "cr_rng_body_2", "skill": "crafting", "name": "Studded Ranger Body", "levelReq": 25, "xp": 110, "requires": { "cured_leather": 3, "sinew": 2 }, "produces": "rng_body_2", "group": "ranged_armour" },
  { "id": "cr_rng_legs_2", "skill": "crafting", "name": "Studded Ranger Chaps", "levelReq": 25, "xp": 90, "requires": { "cured_leather": 2, "sinew": 1 }, "produces": "rng_legs_2", "group": "ranged_armour" },
  { "id": "cr_rng_hood_3", "skill": "crafting", "name": "Hardened Ranger Hood", "levelReq": 45, "xp": 130, "requires": { "cured_leather": 3, "sinew": 2, "ribstone_bar": 1 }, "produces": "rng_hood_3", "group": "ranged_armour" },
  { "id": "cr_rng_body_3", "skill": "crafting", "name": "Hardened Ranger Body", "levelReq": 45, "xp": 200, "requires": { "cured_leather": 4, "sinew": 3, "ribstone_bar": 1 }, "produces": "rng_body_3", "group": "ranged_armour" },
  { "id": "cr_rng_legs_3", "skill": "crafting", "name": "Hardened Ranger Chaps", "levelReq": 45, "xp": 160, "requires": { "cured_leather": 3, "sinew": 2, "ribstone_bar": 1 }, "produces": "rng_legs_3", "group": "ranged_armour" },
  { "id": "cr_rng_hood_4", "skill": "crafting", "name": "Master Ranger Hood", "levelReq": 65, "xp": 220, "requires": { "cured_leather": 3, "sinew": 3, "hearthite_bar": 1 }, "produces": "rng_hood_4", "group": "ranged_armour" },
  { "id": "cr_rng_body_4", "skill": "crafting", "name": "Master Ranger Body", "levelReq": 65, "xp": 340, "requires": { "cured_leather": 5, "sinew": 4, "hearthite_bar": 1 }, "produces": "rng_body_4", "group": "ranged_armour" },
  { "id": "cr_rng_legs_4", "skill": "crafting", "name": "Master Ranger Chaps", "levelReq": 65, "xp": 270, "requires": { "cured_leather": 3, "sinew": 3, "hearthite_bar": 1 }, "produces": "rng_legs_4", "group": "ranged_armour" },

  // --- Magic robes (Crafting): spider silk + hex cloth + gems, four tiers ---
  { "id": "cr_mag_hood_1", "skill": "crafting", "name": "Acolyte Hood", "levelReq": 5, "xp": 30, "requires": { "spider_silk": 2, "hex_cloth": 1 }, "produces": "mag_hood_1", "group": "magic_robes" },
  { "id": "cr_mag_robe_1", "skill": "crafting", "name": "Acolyte Robe", "levelReq": 5, "xp": 50, "requires": { "spider_silk": 3, "hex_cloth": 1 }, "produces": "mag_robe_1", "group": "magic_robes" },
  { "id": "cr_mag_skirt_1", "skill": "crafting", "name": "Acolyte Skirt", "levelReq": 5, "xp": 40, "requires": { "spider_silk": 2, "hex_cloth": 1 }, "produces": "mag_skirt_1", "group": "magic_robes" },
  { "id": "cr_mag_hood_2", "skill": "crafting", "name": "Adept Hood", "levelReq": 25, "xp": 70, "requires": { "spider_silk": 3, "hex_cloth": 2 }, "produces": "mag_hood_2", "group": "magic_robes" },
  { "id": "cr_mag_robe_2", "skill": "crafting", "name": "Adept Robe", "levelReq": 25, "xp": 110, "requires": { "spider_silk": 4, "hex_cloth": 2, "uncut_sapphire": 1 }, "produces": "mag_robe_2", "group": "magic_robes" },
  { "id": "cr_mag_skirt_2", "skill": "crafting", "name": "Adept Skirt", "levelReq": 25, "xp": 90, "requires": { "spider_silk": 3, "hex_cloth": 2 }, "produces": "mag_skirt_2", "group": "magic_robes" },
  { "id": "cr_mag_hood_3", "skill": "crafting", "name": "Warden Hood", "levelReq": 45, "xp": 130, "requires": { "spider_silk": 4, "hex_cloth": 3 }, "produces": "mag_hood_3", "group": "magic_robes" },
  { "id": "cr_mag_robe_3", "skill": "crafting", "name": "Warden Robe", "levelReq": 45, "xp": 200, "requires": { "spider_silk": 5, "hex_cloth": 3, "uncut_emerald": 1 }, "produces": "mag_robe_3", "group": "magic_robes" },
  { "id": "cr_mag_skirt_3", "skill": "crafting", "name": "Warden Skirt", "levelReq": 45, "xp": 160, "requires": { "spider_silk": 4, "hex_cloth": 3 }, "produces": "mag_skirt_3", "group": "magic_robes" },
  { "id": "cr_mag_hood_4", "skill": "crafting", "name": "Archon Hood", "levelReq": 65, "xp": 220, "requires": { "spider_silk": 5, "hex_cloth": 4 }, "produces": "mag_hood_4", "group": "magic_robes" },
  { "id": "cr_mag_robe_4", "skill": "crafting", "name": "Archon Robe", "levelReq": 65, "xp": 340, "requires": { "spider_silk": 6, "hex_cloth": 4, "uncut_ruby": 1 }, "produces": "mag_robe_4", "group": "magic_robes" },
  { "id": "cr_mag_skirt_4", "skill": "crafting", "name": "Archon Skirt", "levelReq": 65, "xp": 270, "requires": { "spider_silk": 5, "hex_cloth": 4 }, "produces": "mag_skirt_4", "group": "magic_robes" },

  {
    "id": "wcu_short",
    "skill": "woodcraft",
    "name": "Shortbow (U)",
    "levelReq": 10,
    "xp": 20,
    "requires": {
      "coldpine_log": 1
    },
    "produces": "unstrung_short",
    "group": "unstrung"
  },
  {
    "id": "wcu_long",
    "skill": "woodcraft",
    "name": "Longbow (U)",
    "levelReq": 20,
    "xp": 35,
    "requires": {
      "coldpine_log": 1
    },
    "produces": "unstrung_long",
    "group": "unstrung"
  },
  {
    "id": "wcu_greyoak",
    "skill": "woodcraft",
    "name": "Greyoak Longbow (U)",
    "levelReq": 45,
    "xp": 65,
    "requires": {
      "greyoak_log": 1
    },
    "produces": "unstrung_greyoak",
    "group": "unstrung"
  },
  {
    "id": "wcu_ruewood",
    "skill": "woodcraft",
    "name": "Ruewood Shortbow (U)",
    "levelReq": 60,
    "xp": 90,
    "requires": {
      "ruewood_log": 1
    },
    "produces": "unstrung_ruewood",
    "group": "unstrung"
  },
  {
    "id": "wcu_dusk",
    "skill": "woodcraft",
    "name": "Duskwood Warbow (U)",
    "levelReq": 75,
    "xp": 120,
    "requires": {
      "deeproot_log": 1
    },
    "produces": "unstrung_dusk",
    "group": "unstrung"
  },
  {
    "id": "wcu_deep",
    "skill": "woodcraft",
    "name": "Deeproot Warbow (U)",
    "levelReq": 90,
    "xp": 165,
    "requires": {
      "deeproot_log": 1
    },
    "produces": "unstrung_deep",
    "group": "unstrung"
  },
  {
    "id": "wc_crude_shortbow",
    "skill": "woodcraft",
    "name": "Crude Shortbow",
    "levelReq": 1,
    "xp": 20,
    "requires": {
      "unstrung_crude": 1,
      "plant_fiber": 2
    },
    "produces": "crude_shortbow",
    "group": "strung",
    "woodShardDrop": {
      "chance": 0.06
    }
  },
  {
    "id": "wc_shortbow",
    "skill": "woodcraft",
    "name": "Shortbow",
    "levelReq": 10,
    "xp": 40,
    "requires": {
      "unstrung_short": 1,
      "plant_fiber": 2
    },
    "produces": "shortbow",
    "group": "strung",
    "woodShardDrop": {
      "chance": 0.07
    }
  },
  {
    "id": "wc_longbow",
    "skill": "woodcraft",
    "name": "Longbow",
    "levelReq": 20,
    "xp": 65,
    "requires": {
      "unstrung_long": 1,
      "plant_fiber": 2
    },
    "produces": "longbow",
    "group": "strung",
    "woodShardDrop": {
      "chance": 0.08
    }
  },
  {
    "id": "wc_greyoak_longbow",
    "skill": "woodcraft",
    "name": "Greyoak Longbow",
    "levelReq": 45,
    "xp": 120,
    "requires": {
      "unstrung_greyoak": 1,
      "plant_fiber": 2
    },
    "produces": "greyoak_longbow",
    "group": "strung",
    "woodShardDrop": {
      "chance": 0.1
    }
  },
  {
    "id": "wc_ruewood_shortbow",
    "skill": "woodcraft",
    "name": "Ruewood Shortbow",
    "levelReq": 60,
    "xp": 160,
    "requires": {
      "unstrung_ruewood": 1,
      "plant_fiber": 2
    },
    "produces": "ruewood_shortbow",
    "group": "strung",
    "woodShardDrop": {
      "chance": 0.12
    }
  },
  {
    "id": "wc_duskwood_warbow",
    "skill": "woodcraft",
    "name": "Duskwood Warbow",
    "levelReq": 75,
    "xp": 215,
    "requires": {
      "unstrung_dusk": 1,
      "plant_fiber": 2
    },
    "produces": "duskwood_warbow",
    "group": "strung",
    "woodShardDrop": {
      "chance": 0.14
    }
  },
  {
    "id": "wc_deeproot_warbow",
    "skill": "woodcraft",
    "name": "Deeproot Warbow",
    "levelReq": 90,
    "xp": 285,
    "requires": {
      "unstrung_deep": 1,
      "plant_fiber": 2
    },
    "produces": "deeproot_warbow",
    "group": "strung",
    "woodShardDrop": {
      "chance": 0.16
    }
  },
  {
    "id": "wc_ashwood_shaft",
    "skill": "woodcraft",
    "name": "Ashwood Shaft",
    "levelReq": 1,
    "xp": 5,
    "requires": {
      "ashwood_log": 1
    },
    "produces": "ashwood_shaft",
    "group": "mats"
  },
  {
    "id": "wc_coldpine_shaft",
    "skill": "woodcraft",
    "name": "Coldpine Shaft",
    "levelReq": 20,
    "xp": 15,
    "requires": {
      "coldpine_log": 1
    },
    "produces": "coldpine_shaft",
    "group": "mats"
  },
  {
    "id": "wc_resin_bow",
    "skill": "woodcraft",
    "name": "Resin-Treated Shaft",
    "levelReq": 25,
    "xp": 18,
    "baseTime": 4000,
    "requires": {
      "coldpine_shaft": 1
    },
    "requiresAny": ["pine_resin", "ironwood_sap"],
    "produces": "resin_shaft",
    "group": "mats",
    "note": "A shaft treated with pine resin — or stonewood's ironwood sap — for better fletching hold and truer flight."
  },
  {
    "id": "wc_greyoak_shaft",
    "skill": "woodcraft",
    "name": "Greyoak Shaft",
    "levelReq": 30,
    "xp": 28,
    "requires": {
      "greyoak_log": 1
    },
    "produces": "greyoak_shaft",
    "group": "mats"
  },
  {
    "id": "wc_ruewood_shaft",
    "skill": "woodcraft",
    "name": "Ruewood Shaft",
    "levelReq": 60,
    "xp": 38,
    "requires": {
      "ruewood_log": 1
    },
    "produces": "ruewood_shaft",
    "group": "mats"
  },
  {
    "id": "wc_deeproot_shaft",
    "skill": "woodcraft",
    "name": "Deeproot Shaft",
    "levelReq": 90,
    "xp": 65,
    "requires": {
      "deeproot_log": 1
    },
    "produces": "deeproot_shaft",
    "group": "mats"
  },
  {
    "id": "wc_rod_1",
    "skill": "woodcraft",
    "name": "Ashwood Rod",
    "levelReq": 5,
    "xp": 20,
    "baseTime": 5000,
    "requires": {
      "ashwood_log": 1
    },
    "produces": "rod_1",
    "group": "rods"
  },
  {
    "id": "wc_rod_2",
    "skill": "woodcraft",
    "name": "Coldpine Rod",
    "levelReq": 20,
    "xp": 55,
    "baseTime": 5500,
    "requires": {
      "coldpine_log": 1
    },
    "produces": "rod_2",
    "group": "rods"
  },
  {
    "id": "wc_rod_3",
    "skill": "woodcraft",
    "name": "Ruewood Rod",
    "levelReq": 40,
    "xp": 130,
    "baseTime": 6000,
    "requires": {
      "ruewood_log": 1
    },
    "produces": "rod_3",
    "group": "rods"
  },
  {
    "id": "wc_rod_4",
    "skill": "woodcraft",
    "name": "Reinforced Ashwood Rod",
    "levelReq": 55,
    "xp": 175,
    "baseTime": 6500,
    "requires": {
      "ashwood_log": 1,
      "ashiron_bar": 1
    },
    "produces": "rod_4",
    "group": "rods"
  },
  {
    "id": "wc_rod_5",
    "skill": "woodcraft",
    "name": "Reinforced Coldpine Rod",
    "levelReq": 70,
    "xp": 230,
    "baseTime": 7000,
    "requires": {
      "coldpine_log": 1,
      "bloodore_bar": 1
    },
    "produces": "rod_5",
    "group": "rods"
  },
  {
    "id": "wc_rod_6",
    "skill": "woodcraft",
    "name": "Reinforced Ruewood Rod",
    "levelReq": 90,
    "xp": 300,
    "baseTime": 7500,
    "requires": {
      "ruewood_log": 1,
      "voidstone_bar": 1
    },
    "produces": "rod_6",
    "group": "rods"
  },
  {
    "id": "hunt_hare",
    "skill": "hunter",
    "name": "Moor Hare",
    "levelReq": 1,
    "group": "quarry",
    "xp": 25,
    "produces": "raw_hide",
    "rareDrop": {
      "item": "raw_hide",
      "chance": 0.1
    }
  },
  {
    "id": "hunt_boar",
    "skill": "hunter",
    "name": "Moor Boar",
    "levelReq": 20,
    "group": "quarry",
    "xp": 68,
    "produces": "raw_boar_meat",
    "rareDrop": {
      "item": "boar_hide",
      "chance": 0.25
    }
  },
  {
    "id": "hunt_wolf",
    "skill": "hunter",
    "name": "Grey Wolf",
    "levelReq": 30,
    "group": "quarry",
    "xp": 95,
    "produces": "raw_wolf_meat",
    "rareDrop": {
      "item": "wolf_pelt",
      "chance": 0.25
    }
  },
  {
    "id": "hunt_bear",
    "skill": "hunter",
    "name": "Crag Bear",
    "levelReq": 45,
    "group": "quarry",
    "xp": 135,
    "produces": "raw_bear_meat",
    "rareDrop": {
      "item": "bear_pelt",
      "chance": 0.25
    }
  },
  {
    "id": "hunt_stag",
    "skill": "hunter",
    "name": "Pale Stag",
    "levelReq": 60,
    "group": "quarry",
    "xp": 185,
    "produces": "venison",
    "rareDrop": {
      "item": "sinew",
      "chance": 0.15
    }
  },
  {
    "id": "hunt_moorhart",
    "skill": "hunter",
    "name": "Moorhart",
    "levelReq": 75,
    "group": "quarry",
    "xp": 245,
    "produces": "moorhart_raw",
    "rareDrop": {
      "item": "sinew",
      "chance": 0.18
    }
  },
  {
    "id": "hunt_aurochs",
    "skill": "hunter",
    "name": "Ashen Aurochs",
    "levelReq": 90,
    "group": "quarry",
    "xp": 320,
    "produces": "aurochs_cut",
    "rareDrop": {
      "item": "thick_hide",
      "chance": 0.2
    }
  },
  {
    "id": "hunt_marten",
    "skill": "hunter",
    "name": "Reed Marten",
    "levelReq": 10,
    "group": "quarry",
    "xp": 44,
    "produces": "raw_hide",
    "note": "An intermediate catch — so the first twenty levels of Hunter aren't one long wait for the boar.",
    "rareDrop": {
      "item": "wolf_pelt",
      "chance": 0.06
    }
  },
  {
    "id": "hunt_lynx",
    "skill": "hunter",
    "name": "Fen Lynx",
    "levelReq": 37,
    "group": "quarry",
    "xp": 112,
    "produces": "raw_wolf_meat",
    "rareDrop": {
      "item": "bear_pelt",
      "chance": 0.1
    }
  },
  {
    "id": "hunt_ram",
    "skill": "hunter",
    "name": "Crag Ram",
    "levelReq": 52,
    "group": "quarry",
    "xp": 158,
    "produces": "raw_bear_meat",
    "rareDrop": {
      "item": "sinew",
      "chance": 0.12
    }
  },
  {
    "id": "hunt_elk",
    "skill": "hunter",
    "name": "Bog Elk",
    "levelReq": 67,
    "group": "quarry",
    "xp": 212,
    "produces": "venison",
    "rareDrop": {
      "item": "sinew",
      "chance": 0.16
    }
  },
  {
    "id": "fish_ashfin",
    "skill": "fishing",
    "name": "Ashfin",
    "levelReq": 1,
    "xp": 15,
    "produces": "ashfin_raw",
    "location": "river",
    "rareDrop": {
      "item": "river_stone",
      "chance": 0.06
    }
  },
  {
    "id": "fish_greyfin",
    "skill": "fishing",
    "name": "Greyfin",
    "levelReq": 20,
    "xp": 50,
    "produces": "greyfin_raw",
    "location": "river",
    "rareDrop": {
      "item": "river_stone",
      "chance": 0.05
    }
  },
  {
    "id": "fish_ribperch",
    "skill": "fishing",
    "name": "Ribperch",
    "levelReq": 30,
    "xp": 75,
    "produces": "ribperch_raw",
    "location": "coast",
    "rareDrop": {
      "item": "waterlogged_coin",
      "chance": 0.04
    }
  },
  {
    "id": "fish_marsh_eel",
    "skill": "fishing",
    "name": "Marsh Eel",
    "levelReq": 45,
    "xp": 110,
    "produces": "marsh_eel_raw",
    "location": "moor"
  },
  {
    "id": "fish_redgill",
    "skill": "fishing",
    "name": "Redgill",
    "levelReq": 60,
    "xp": 150,
    "produces": "redgill_raw",
    "location": "coast",
    "rareDrop": {
      "item": "waterlogged_coin",
      "chance": 0.06
    }
  },
  {
    "id": "fish_deepscale",
    "skill": "fishing",
    "name": "Deepscale",
    "levelReq": 75,
    "xp": 200,
    "produces": "deepscale_raw",
    "location": "deep",
    "rareDrop": {
      "item": "redrun_pearl",
      "chance": 0.03
    }
  },
  {
    "id": "fish_eyeless_pike",
    "skill": "fishing",
    "name": "Eyeless Pike",
    "levelReq": 90,
    "xp": 265,
    "produces": "eyeless_pike_raw",
    "location": "deep",
    "rareDrop": {
      "item": "eyeless_scale",
      "chance": 0.2
    }
  },
  {
    "id": "fish_silverdart",
    "skill": "fishing",
    "name": "Silverdart",
    "levelReq": 8,
    "xp": 30,
    "produces": "silverdart_raw",
    "location": "river",
    "rareDrop": {
      "item": "river_stone",
      "chance": 0.06
    }
  },
  {
    "id": "fish_bramblecarp",
    "skill": "fishing",
    "name": "Bramblecarp",
    "levelReq": 15,
    "xp": 42,
    "produces": "bramblecarp_raw",
    "location": "moor"
  },
  {
    "id": "fish_copperling",
    "skill": "fishing",
    "name": "Copperling",
    "levelReq": 25,
    "xp": 62,
    "produces": "copperling_raw",
    "location": "coast",
    "rareDrop": {
      "item": "waterlogged_coin",
      "chance": 0.04
    }
  },
  {
    "id": "fish_bristlepike",
    "skill": "fishing",
    "name": "Bristlepike",
    "levelReq": 38,
    "xp": 95,
    "produces": "bristlepike_raw",
    "location": "river",
    "rareDrop": {
      "item": "old_hook",
      "chance": 0.05
    }
  },
  {
    "id": "fish_gloomshad",
    "skill": "fishing",
    "name": "Gloomshad",
    "levelReq": 52,
    "xp": 130,
    "produces": "gloomshad_raw",
    "location": "moor"
  },
  {
    "id": "fish_runestout",
    "skill": "fishing",
    "name": "Runestout",
    "levelReq": 68,
    "xp": 175,
    "produces": "runestout_raw",
    "location": "coast",
    "rareDrop": {
      "item": "waterlogged_coin",
      "chance": 0.06
    }
  },
  {
    "id": "fish_frostgill",
    "skill": "fishing",
    "name": "Frostgill",
    "levelReq": 82,
    "xp": 232,
    "produces": "frostgill_raw",
    "location": "deep",
    "rareDrop": {
      "item": "redrun_pearl",
      "chance": 0.03
    }
  },
  {
    "id": "cook_ashfin",
    "skill": "cooking",
    "name": "Ashfin (+3 HP)",
    "levelReq": 1,
    "xp": 30,
    "requires": {
      "ashfin_raw": 1
    },
    "produces": "ashfin_cooked",
    "group": "fish"
  },
  {
    "id": "cook_speckletrout",
    "skill": "cooking",
    "name": "Speckletrout (+5 HP)",
    "levelReq": 10,
    "xp": 55,
    "requires": {
      "greyfin_raw": 1
    },
    "produces": "speckletrout_cooked",
    "group": "fish"
  },
  {
    "id": "cook_greyfin",
    "skill": "cooking",
    "name": "Greyfin (+7 HP)",
    "levelReq": 20,
    "xp": 90,
    "requires": {
      "greyfin_raw": 1
    },
    "produces": "greyfin_cooked",
    "group": "fish"
  },
  {
    "id": "cook_ribperch",
    "skill": "cooking",
    "name": "Ribperch (+9 HP)",
    "levelReq": 30,
    "xp": 130,
    "requires": {
      "ribperch_raw": 1
    },
    "produces": "ribperch_cooked",
    "group": "fish"
  },
  {
    "id": "cook_marsh_eel",
    "skill": "cooking",
    "name": "Marsh Eel (+10 HP)",
    "levelReq": 45,
    "xp": 155,
    "requires": {
      "marsh_eel_raw": 1
    },
    "produces": "marsh_eel_cooked",
    "group": "fish"
  },
  {
    "id": "cook_moorhart",
    "skill": "cooking",
    "name": "Moorhart Steak (+13 HP)",
    "levelReq": 75,
    "xp": 245,
    "requires": {
      "moorhart_raw": 1
    },
    "produces": "moorhart_cooked",
    "group": "meat"
  },
  {
    "id": "cook_coldwater_eel",
    "skill": "cooking",
    "name": "Coldwater Eel (+11 HP)",
    "levelReq": 45,
    "xp": 185,
    "requires": {
      "redgill_raw": 1
    },
    "produces": "coldwater_eel_cooked",
    "group": "fish"
  },
  {
    "id": "cook_redgill",
    "skill": "cooking",
    "name": "Redgill (+14 HP)",
    "levelReq": 60,
    "xp": 250,
    "requires": {
      "redgill_raw": 1
    },
    "produces": "redgill_cooked",
    "group": "fish"
  },
  {
    "id": "cook_deepscale",
    "skill": "cooking",
    "name": "Deepscale (+17 HP)",
    "levelReq": 75,
    "xp": 330,
    "requires": {
      "deepscale_raw": 1
    },
    "produces": "deepscale_cooked",
    "group": "fish"
  },
  {
    "id": "cook_eyeless_pike",
    "skill": "cooking",
    "name": "Eyeless Pike (+20 HP)",
    "levelReq": 90,
    "xp": 440,
    "requires": {
      "eyeless_pike_raw": 1
    },
    "produces": "eyeless_pike_cooked",
    "group": "fish"
  },
  {
    "id": "cook_silverdart",
    "skill": "cooking",
    "name": "Silverdart (+4 HP)",
    "levelReq": 8,
    "xp": 42,
    "requires": {
      "silverdart_raw": 1
    },
    "produces": "silverdart_cooked",
    "group": "fish"
  },
  {
    "id": "cook_bramblecarp",
    "skill": "cooking",
    "name": "Bramblecarp (+6 HP)",
    "levelReq": 15,
    "xp": 68,
    "requires": {
      "bramblecarp_raw": 1
    },
    "produces": "bramblecarp_cooked",
    "group": "fish"
  },
  {
    "id": "cook_copperling",
    "skill": "cooking",
    "name": "Copperling (+8 HP)",
    "levelReq": 25,
    "xp": 105,
    "requires": {
      "copperling_raw": 1
    },
    "produces": "copperling_cooked",
    "group": "fish"
  },
  {
    "id": "cook_bristlepike",
    "skill": "cooking",
    "name": "Bristlepike (+10 HP)",
    "levelReq": 38,
    "xp": 150,
    "requires": {
      "bristlepike_raw": 1
    },
    "produces": "bristlepike_cooked",
    "group": "fish"
  },
  {
    "id": "cook_gloomshad",
    "skill": "cooking",
    "name": "Gloomshad (+12 HP)",
    "levelReq": 52,
    "xp": 205,
    "requires": {
      "gloomshad_raw": 1
    },
    "produces": "gloomshad_cooked",
    "group": "fish"
  },
  {
    "id": "cook_runestout",
    "skill": "cooking",
    "name": "Runestout (+16 HP)",
    "levelReq": 68,
    "xp": 300,
    "requires": {
      "runestout_raw": 1
    },
    "produces": "runestout_cooked",
    "group": "fish"
  },
  {
    "id": "cook_frostgill",
    "skill": "cooking",
    "name": "Frostgill (+19 HP)",
    "levelReq": 82,
    "xp": 380,
    "requires": {
      "frostgill_raw": 1
    },
    "produces": "frostgill_cooked",
    "group": "fish"
  },
  {
    "id": "cook_rat_meat",
    "skill": "cooking",
    "name": "Rat Meat (+4 HP)",
    "levelReq": 1,
    "xp": 25,
    "requires": {
      "raw_rat_meat": 1
    },
    "produces": "rat_meat_cooked",
    "group": "meat"
  },
  {
    "id": "cook_wolf_meat",
    "skill": "cooking",
    "name": "Wolf Meat (+6 HP)",
    "levelReq": 12,
    "xp": 55,
    "requires": {
      "raw_wolf_meat": 1
    },
    "produces": "wolf_meat_cooked",
    "group": "meat"
  },
  {
    "id": "cook_meat",
    "skill": "cooking",
    "name": "Meat (+7 HP)",
    "levelReq": 1,
    "xp": 70,
    "requires": {
      "raw_meat": 1
    },
    "produces": "cooked_meat",
    "group": "meat"
  },
  {
    "id": "cook_boar_meat",
    "skill": "cooking",
    "name": "Boar Meat (+8 HP)",
    "levelReq": 25,
    "xp": 95,
    "requires": {
      "raw_boar_meat": 1
    },
    "produces": "boar_meat_cooked",
    "group": "meat"
  },
  {
    "id": "cook_bear_meat",
    "skill": "cooking",
    "name": "Bear Meat (+11 HP)",
    "levelReq": 40,
    "xp": 145,
    "requires": {
      "raw_bear_meat": 1
    },
    "produces": "bear_meat_cooked",
    "group": "meat"
  },
  {
    "id": "cook_venison",
    "skill": "cooking",
    "name": "Venison (+14 HP)",
    "levelReq": 55,
    "xp": 210,
    "baseTime": 4500,
    "requires": {
      "venison": 1
    },
    "produces": "venison_cooked",
    "group": "meat"
  },
  {
    "id": "cook_aurochs",
    "skill": "cooking",
    "name": "Aurochs Steak (+19 HP)",
    "levelReq": 80,
    "xp": 330,
    "baseTime": 5500,
    "requires": {
      "aurochs_cut": 1
    },
    "produces": "aurochs_cooked",
    "group": "meat"
  },
  {
    "id": "cook_mushroom_broth",
    "skill": "cooking",
    "name": "Mushroom Broth (+4 HP)",
    "levelReq": 5,
    "xp": 40,
    "baseTime": 4000,
    "requires": {
      "forage_mushroom": 3
    },
    "produces": "mushroom_broth",
    "group": "forage"
  },
  {
    "id": "cook_thornberry_tonic",
    "skill": "cooking",
    "name": "Thornberry Tonic (+6 HP)",
    "levelReq": 15,
    "xp": 65,
    "baseTime": 4000,
    "requires": {
      "forage_thornberry": 4
    },
    "produces": "thornberry_tonic",
    "group": "forage"
  },
  {
    "id": "cook_hearthroot_tea",
    "skill": "cooking",
    "name": "Hearthroot Tea (+9 HP)",
    "levelReq": 28,
    "xp": 100,
    "baseTime": 5000,
    "requires": {
      "forage_hearthroot": 2
    },
    "produces": "hearthroot_tea",
    "group": "forage"
  },
  {
    "id": "cook_nightshade_brew",
    "skill": "cooking",
    "name": "Nightshade Brew (+11 HP)",
    "levelReq": 44,
    "xp": 145,
    "baseTime": 6000,
    "requires": {
      "forage_nightshade": 1
    },
    "produces": "nightshade_brew",
    "group": "forage"
  },
  {
    "id": "cook_ashroot_elixir",
    "skill": "cooking",
    "name": "Ashroot Elixir (+15 HP)",
    "levelReq": 62,
    "xp": 200,
    "baseTime": 6000,
    "requires": {
      "forage_ashroot": 2
    },
    "produces": "ashroot_elixir",
    "group": "forage"
  },
  {
    "id": "cook_dawnspore_draught",
    "skill": "cooking",
    "name": "Dawnspore Draught (+19 HP)",
    "levelReq": 82,
    "xp": 275,
    "baseTime": 7000,
    "requires": {
      "forage_dawnspore": 1
    },
    "produces": "dawnspore_draught",
    "group": "forage"
  },
  {
    "id": "cook_deepmoss_broth",
    "skill": "cooking",
    "name": "Deepmoss Broth (+16 HP)",
    "levelReq": 58,
    "xp": 170,
    "baseTime": 7000,
    "requires": {
      "forage_deepmoss": 2
    },
    "produces": "deepmoss_broth",
    "group": "forage"
  },
  {
    "id": "cook_ashbloom_tea",
    "skill": "cooking",
    "name": "Ashbloom Tea (+24 HP)",
    "levelReq": 74,
    "xp": 220,
    "baseTime": 7000,
    "requires": {
      "forage_ashbloom": 2
    },
    "produces": "ashbloom_tea",
    "group": "forage"
  },
  {
    "id": "cook_smoke_speckletrout",
    "skill": "cooking",
    "name": "Smoke Speckletrout (+45 HP · +5% XP 3min)",
    "levelReq": 18,
    "xp": 70,
    "baseTime": 6000,
    "requires": {
      "greyfin_raw": 1,
      "charcoal": 2
    },
    "produces": "smoked_speckletrout",
    "group": "smoked",
    "note": "Smoked fish heals significantly more than cooked fish and grants a temporary XP boost. Requires Charcoal from Survivalist (burn any log)."
  },
  {
    "id": "cook_smoke_greyfin",
    "skill": "cooking",
    "name": "Smoke Greyfin (+70 HP · +5% XP 4min)",
    "levelReq": 28,
    "xp": 110,
    "baseTime": 7000,
    "requires": {
      "greyfin_raw": 1,
      "charcoal": 2
    },
    "produces": "smoked_greyfin",
    "group": "smoked"
  },
  {
    "id": "cook_smoke_ribperch",
    "skill": "cooking",
    "name": "Smoke Ribperch (+100 HP · +8% XP 5min)",
    "levelReq": 38,
    "xp": 160,
    "baseTime": 7000,
    "requires": {
      "ribperch_raw": 1,
      "charcoal": 3
    },
    "produces": "smoked_ribperch",
    "group": "smoked"
  },
  {
    "id": "cook_smoke_redgill",
    "skill": "cooking",
    "name": "Smoke Redgill (+145 HP · +10% XP 6min)",
    "levelReq": 65,
    "xp": 250,
    "baseTime": 8000,
    "requires": {
      "redgill_raw": 1,
      "charcoal": 3
    },
    "produces": "smoked_redgill",
    "group": "smoked"
  },
  {
    "id": "cook_hill_stew",
    "skill": "cooking",
    "name": "Hill Stew (+65 HP · +3 Melee Dmg 4min)",
    "levelReq": 20,
    "xp": 120,
    "baseTime": 8000,
    "requires": {
      "raw_wolf_meat": 1,
      "forage_mushroom": 2
    },
    "produces": "hill_stew",
    "group": "meals",
    "note": "Meals combine meat and foraged ingredients for superior healing and a temporary combat buff. Worth the extra ingredients for tough fights."
  },
  {
    "id": "cook_forest_roast",
    "skill": "cooking",
    "name": "Forest Roast (+95 HP · +5 Melee Dmg 5min)",
    "levelReq": 35,
    "xp": 185,
    "baseTime": 9000,
    "requires": {
      "raw_boar_meat": 1,
      "forage_thornberry": 3
    },
    "produces": "forest_roast",
    "group": "meals"
  },
  {
    "id": "cook_bone_broth",
    "skill": "cooking",
    "name": "Bone Broth (+120 HP · +8 Defence 6min)",
    "levelReq": 50,
    "xp": 260,
    "baseTime": 10000,
    "requires": {
      "raw_bear_meat": 1,
      "forage_hearthroot": 2
    },
    "produces": "bone_broth",
    "group": "meals"
  },
  {
    "id": "cook_redrun_chowder",
    "skill": "cooking",
    "name": "Redrun Chowder (+160 HP · +10 Accuracy 6min)",
    "levelReq": 68,
    "xp": 360,
    "baseTime": 10000,
    "requires": {
      "redgill_raw": 1,
      "forage_ashroot": 1
    },
    "produces": "redrun_chowder",
    "group": "meals"
  },
  {
    "id": "cook_deepmeat_stew",
    "skill": "cooking",
    "name": "Deepmeat Stew (+200 HP · +12 Melee Dmg 8min)",
    "levelReq": 85,
    "xp": 480,
    "baseTime": 12000,
    "requires": {
      "deepscale_raw": 1,
      "forage_ashroot": 2
    },
    "produces": "deepmeat_stew",
    "group": "meals"
  },
  {
    "id": "surv_forage_fiber",
    "skill": "survivalist",
    "name": "Forage Plant Fiber",
    "levelReq": 1,
    "xp": 12,
    "baseTime": 5000,
    "produces": "plant_fiber",
    "group": "forage"
  },
  {
    "id": "surv_forage_mushroom",
    "skill": "survivalist",
    "name": "Forage Mushrooms",
    "levelReq": 1,
    "xp": 20,
    "baseTime": 6000,
    "produces": "forage_mushroom",
    "group": "forage"
  },
  {
    "id": "surv_forage_thornberry",
    "skill": "survivalist",
    "name": "Forage Thornberries",
    "levelReq": 10,
    "xp": 35,
    "baseTime": 6000,
    "produces": "forage_thornberry",
    "group": "forage"
  },
  {
    "id": "surv_forage_hearthroot",
    "skill": "survivalist",
    "name": "Forage Hearthroot",
    "levelReq": 25,
    "xp": 60,
    "baseTime": 7000,
    "produces": "forage_hearthroot",
    "group": "forage"
  },
  {
    "id": "surv_forage_nightshade",
    "skill": "survivalist",
    "name": "Forage Nightshade",
    "levelReq": 40,
    "xp": 90,
    "baseTime": 8000,
    "produces": "forage_nightshade",
    "group": "forage"
  },
  {
    "id": "surv_forage_ashroot",
    "skill": "survivalist",
    "name": "Forage Ashroot",
    "levelReq": 60,
    "xp": 130,
    "baseTime": 8000,
    "produces": "forage_ashroot",
    "group": "forage"
  },
  {
    "id": "surv_forage_dawnspore",
    "skill": "survivalist",
    "name": "Forage Dawnspore",
    "levelReq": 80,
    "xp": 180,
    "baseTime": 10000,
    "produces": "forage_dawnspore",
    "group": "forage"
  },
  {
    "id": "surv_forage_orunbloom",
    "skill": "survivalist",
    "name": "Forage Orunbloom",
    "levelReq": 90,
    "xp": 240,
    "baseTime": 11000,
    "produces": "forage_orunbloom",
    "note": "The capstone forage — so the last twenty levels aren't nineteen levels of dawnspore. Opens only where Orun's seam surfaces.",
    "group": "forage"
  },
  {
    "id": "surv_forage_deepmoss",
    "skill": "survivalist",
    "name": "Forage Deepmoss",
    "levelReq": 55,
    "xp": 100,
    "baseTime": 8000,
    "produces": "forage_deepmoss",
    "group": "forage"
  },
  {
    "id": "surv_forage_ashbloom",
    "skill": "survivalist",
    "name": "Forage Ashbloom",
    "levelReq": 70,
    "xp": 145,
    "baseTime": 9000,
    "produces": "forage_ashbloom",
    "group": "forage"
  },
  {
    "id": "surv_fire_any",
    "skill": "survivalist",
    "name": "Burn Logs",
    "levelReq": 1,
    "xp": 30,
    "baseTime": 3000,
    "requiresAny": [
      "ashwood_log",
      "alder_log",
      "birch_log",
      "coldpine_log",
      "stonewood_log",
      "greyoak_log",
      "ruewood_log",
      "deeproot_log"
    ],
    "produces": "charcoal",
    "group": "fire"
  },
  {
    "id": "surv_craft_bark_tinder",
    "skill": "survivalist",
    "name": "Bark Tinder Bundle",
    "levelReq": 8,
    "xp": 12,
    "baseTime": 3000,
    "requires": {
      "bark_strip": 3
    },
    "produces": "charcoal",
    "produceQty": 2,
    "group": "fire",
    "note": "Dried bark burns clean and fast — doubles charcoal yield."
  },
  {
    "id": "surv_craft_fert_basic",
    "skill": "survivalist",
    "name": "Basic Fertilizer",
    "levelReq": 5,
    "xp": 15,
    "baseTime": 5000,
    "requires": {
      "forage_mushroom": 3,
      "forage_thornberry": 2
    },
    "produces": "fertilizer_basic",
    "group": "seeds"
  },
  {
    "id": "surv_craft_fert_rich",
    "skill": "survivalist",
    "name": "Rich Fertilizer",
    "levelReq": 30,
    "xp": 40,
    "baseTime": 7000,
    "requires": {
      "forage_hearthroot": 2,
      "forage_nightshade": 1
    },
    "produces": "fertilizer_rich",
    "group": "seeds"
  },
  {
    "id": "con_quarry_1",
    "skill": "construction",
    "name": "Cut Stone Block",
    "levelReq": 1,
    "xp": 20,
    "baseTime": 5000,
    "requires": {
      "knucklestone_ore": 3
    },
    "produces": "stone_block",
    "group": "quarry",
    "note": "Knucklestone ore dressed into the basic building block — used in mortar and low-tier construction."
  },
  {
    "id": "con_quarry_2",
    "skill": "construction",
    "name": "Cut Coldvein Block",
    "levelReq": 20,
    "xp": 45,
    "baseTime": 6000,
    "requires": {
      "ashiron_ore": 2
    },
    "produces": "cut_coldvein",
    "group": "quarry",
    "note": "Produces Cut Coldvein used in mid-tier construction and refined mortar."
  },
  {
    "id": "con_quarry_3",
    "skill": "construction",
    "name": "Face Ribstone Block ×2",
    "levelReq": 40,
    "xp": 80,
    "baseTime": 7000,
    "requires": {
      "ribstone_ore": 2
    },
    "produces": "cut_ribstone",
    "produceQty": 2,
    "group": "quarry",
    "note": "Dense ribstone yields two cut blocks per session — required for high-tier construction."
  },
  {
    "id": "con_timber_1",
    "skill": "construction",
    "name": "Frame Timber Truss",
    "levelReq": 5,
    "xp": 25,
    "baseTime": 5000,
    "requires": {
      "plank_ashwood": 4,
      "knucklestone_bar": 1
    },
    "produces": "timber_frame",
    "group": "timber",
    "note": "Milled ashwood boards and stone pins — the standard load-bearing frame for all early buildings."
  },
  {
    "id": "con_timber_2",
    "skill": "construction",
    "name": "Hew Stonewood Beam",
    "levelReq": 30,
    "xp": 60,
    "baseTime": 6000,
    "requires": {
      "plank_stonewood": 4,
      "ashiron_bar": 1
    },
    "produces": "stonewood_beam",
    "group": "timber",
    "note": "A dense structural beam reinforced with ashiron — needed for fortified upper stories."
  },
  {
    "id": "con_timber_3",
    "skill": "construction",
    "name": "Strike Ashiron Rivets ×8",
    "levelReq": 15,
    "xp": 18,
    "baseTime": 3000,
    "requires": {
      "ashiron_bar": 1
    },
    "produces": "ashiron_rivet",
    "produceQty": 8,
    "group": "timber",
    "note": "Eight rivets per bar. Ashiron rivets bind timber frames and iron fixtures throughout mid-tier construction."
  },
  {
    "id": "con_timber_4",
    "skill": "construction",
    "name": "Forge Heartoak Beam",
    "levelReq": 80,
    "xp": 220,
    "baseTime": 10000,
    "requires": {
      "plank_heartoak": 6,
      "ashiron_bar": 2
    },
    "produces": "heartoak_beam",
    "group": "timber",
    "note": "Massive structural beam. Only heartoak boards hold the load of the largest upper stories."
  },
  {
    "id": "con_mortar_1",
    "skill": "construction",
    "name": "Mix Basic Mortar ×3",
    "levelReq": 1,
    "xp": 15,
    "baseTime": 4000,
    "requires": {
      "stone_block": 2,
      "charcoal": 3
    },
    "produces": "mortar_basic",
    "produceQty": 3,
    "group": "masonry",
    "note": "Ground stone and charcoal ash — sets slowly but holds for the early tier structures."
  },
  {
    "id": "con_mortar_2",
    "skill": "construction",
    "name": "Grind Refined Mortar ×3",
    "levelReq": 25,
    "xp": 35,
    "baseTime": 5000,
    "requires": {
      "cut_coldvein": 2,
      "charcoal": 4
    },
    "produces": "mortar_refined",
    "produceQty": 3,
    "group": "masonry",
    "note": "Cold-set mortar ground from cut coldvein — stronger bond, required for mid-tier and above."
  },
  {
    "id": "con_mortar_3",
    "skill": "construction",
    "name": "Set Spinite Mortar ×3",
    "levelReq": 50,
    "xp": 70,
    "baseTime": 6000,
    "requires": {
      "cut_coldvein": 3,
      "bloodore_bar": 1
    },
    "produces": "mortar_spinite",
    "produceQty": 3,
    "group": "masonry",
    "note": "Spinite-reinforced mortar. Sets near-permanently — required for fortress-tier work."
  },
  {
    "id": "con_infra_6",
    "skill": "construction",
    "name": "Dress Vault Stone ×2",
    "levelReq": 75,
    "xp": 450,
    "baseTime": 12000,
    "requires": {
      "bloodore_bar": 3,
      "cut_coldvein": 15,
      "mortar_spinite": 10
    },
    "produces": "vault_stone",
    "produceQty": 2,
    "group": "masonry",
    "note": "Precision-dressed vault stone — the final material tier, used only in the Fortress Keep."
  },
  {
    "id": "con_plank_ash",
    "skill": "construction",
    "name": "Mill Ashwood Planks ×4",
    "levelReq": 1,
    "xp": 20,
    "baseTime": 4000,
    "requires": {
      "ashwood_log": 1
    },
    "produces": "plank_ashwood",
    "produceQty": 4,
    "group": "sawmill",
    "note": "Run ashwood through the sawmill — yields rough boards for basic framing."
  },
  {
    "id": "con_plank_col",
    "skill": "construction",
    "name": "Mill Coldpine Planks ×4",
    "levelReq": 20,
    "xp": 55,
    "baseTime": 4500,
    "requires": {
      "coldpine_log": 1
    },
    "produces": "plank_coldpine",
    "produceQty": 4,
    "group": "sawmill",
    "note": "Straight-grained softwood. Good for interior work."
  },
  {
    "id": "con_plank_sto",
    "skill": "construction",
    "name": "Mill Stonewood Planks ×4",
    "levelReq": 30,
    "xp": 75,
    "baseTime": 5000,
    "requires": {
      "stonewood_log": 1
    },
    "produces": "plank_stonewood",
    "produceQty": 4,
    "group": "sawmill",
    "note": "Near-petrified boards. Used for load-bearing walls."
  },
  {
    "id": "con_plank_grey",
    "skill": "construction",
    "name": "Mill Greyoak Planks ×4",
    "levelReq": 45,
    "xp": 110,
    "baseTime": 5500,
    "requires": {
      "greyoak_log": 1
    },
    "produces": "plank_greyoak",
    "produceQty": 4,
    "group": "sawmill",
    "note": "Hard-wearing and dense. The preferred wood of serious builders."
  },
  {
    "id": "con_plank_rue",
    "skill": "construction",
    "name": "Mill Ruewood Planks ×4",
    "levelReq": 60,
    "xp": 150,
    "baseTime": 6000,
    "requires": {
      "ruewood_log": 1
    },
    "produces": "plank_ruewood",
    "produceQty": 4,
    "group": "sawmill",
    "note": "Ruddy-tinted boards. Unusually resilient to damp."
  },
  {
    "id": "con_plank_iron",
    "skill": "construction",
    "name": "Mill Ironbark Planks ×4",
    "levelReq": 55,
    "xp": 130,
    "baseTime": 6000,
    "requires": {
      "ironbark_log": 1
    },
    "produces": "plank_ironbark",
    "produceQty": 4,
    "group": "sawmill",
    "note": "Unyielding and dense. Even a saw protests."
  },
  {
    "id": "con_plank_heart",
    "skill": "construction",
    "name": "Mill Heartoak Planks ×4",
    "levelReq": 80,
    "xp": 210,
    "baseTime": 7000,
    "requires": {
      "heartoak_log": 1
    },
    "produces": "plank_heartoak",
    "produceQty": 4,
    "group": "sawmill",
    "note": "Rich amber boards, almost too beautiful to bury in a wall."
  },
  {
    "id": "craft_tan_hide",
    "skill": "crafting",
    "name": "Tan Raw Hide",
    "levelReq": 1,
    "xp": 12,
    "baseTime": 3000,
    "requires": {
      "raw_hide": 1
    },
    "produces": "tanned_leather",
    "group": "leather"
  },
  {
    "id": "craft_tan_wolf",
    "skill": "crafting",
    "name": "Tan Wolf Pelt",
    "levelReq": 10,
    "xp": 22,
    "baseTime": 4000,
    "requires": {
      "wolf_pelt": 1
    },
    "produces": "tanned_leather",
    "produceQty": 2,
    "group": "leather"
  },
  {
    "id": "craft_cure_boar",
    "skill": "crafting",
    "name": "Cure Boar Hide",
    "levelReq": 20,
    "xp": 38,
    "baseTime": 5000,
    "requires": {
      "boar_hide": 1
    },
    "produces": "cured_leather",
    "group": "leather"
  },
  {
    "id": "craft_harden_bear",
    "skill": "crafting",
    "name": "Harden Bear Pelt",
    "levelReq": 40,
    "xp": 70,
    "baseTime": 6000,
    "requires": {
      "bear_pelt": 1
    },
    "produces": "hardened_leather",
    "group": "leather"
  },
  {
    "id": "craft_master_leath",
    "skill": "crafting",
    "name": "Master Leather",
    "levelReq": 65,
    "xp": 120,
    "baseTime": 8000,
    "requires": {
      "hardened_leather": 2,
      "ashiron_rivet": 2
    },
    "produces": "master_leather",
    "group": "leather"
  },
  {
    "id": "craft_thick_leather",
    "skill": "crafting",
    "name": "Cure Thick Hide",
    "levelReq": 68,
    "xp": 140,
    "baseTime": 8000,
    "requires": {
      "thick_hide": 1,
      "sinew": 2
    },
    "produces": "master_leather",
    "group": "leather"
  },
  {
    "id": "craft_cure_eel",
    "skill": "crafting",
    "name": "Cure Wolf Pelt",
    "levelReq": 35,
    "xp": 55,
    "baseTime": 5000,
    "requires": {
      "wolf_pelt": 1
    },
    "produces": "cured_leather",
    "group": "leather"
  },
  {
    "id": "craft_leath_helm",
    "skill": "crafting",
    "name": "Tanned Leather Helm",
    "levelReq": 5,
    "xp": 20,
    "baseTime": 4000,
    "requires": {
      "tanned_leather": 2
    },
    "produces": "leath_helm",
    "group": "leather"
  },
  {
    "id": "craft_leath_body",
    "skill": "crafting",
    "name": "Tanned Leather Coat",
    "levelReq": 5,
    "xp": 35,
    "baseTime": 6000,
    "requires": {
      "tanned_leather": 4
    },
    "produces": "leath_body",
    "group": "leather"
  },
  {
    "id": "craft_leath_legs",
    "skill": "crafting",
    "name": "Tanned Leather Legs",
    "levelReq": 5,
    "xp": 28,
    "baseTime": 5000,
    "requires": {
      "tanned_leather": 3
    },
    "produces": "leath_legs",
    "group": "leather"
  },
  {
    "id": "craft_leath_boots",
    "skill": "crafting",
    "name": "Tanned Leather Boots",
    "levelReq": 5,
    "xp": 16,
    "baseTime": 4000,
    "requires": {
      "tanned_leather": 2
    },
    "produces": "leath_boots",
    "group": "leather"
  },
  {
    "id": "craft_cured_helm",
    "skill": "crafting",
    "name": "Cured Leather Helm",
    "levelReq": 22,
    "xp": 45,
    "baseTime": 5000,
    "requires": {
      "cured_leather": 2
    },
    "produces": "cured_helm",
    "group": "leather"
  },
  {
    "id": "craft_cured_body",
    "skill": "crafting",
    "name": "Cured Leather Coat",
    "levelReq": 22,
    "xp": 80,
    "baseTime": 7000,
    "requires": {
      "cured_leather": 4
    },
    "produces": "cured_body",
    "group": "leather"
  },
  {
    "id": "craft_cured_legs",
    "skill": "crafting",
    "name": "Cured Leather Legs",
    "levelReq": 22,
    "xp": 62,
    "baseTime": 6000,
    "requires": {
      "cured_leather": 3
    },
    "produces": "cured_legs",
    "group": "leather"
  },
  {
    "id": "craft_cured_boots",
    "skill": "crafting",
    "name": "Cured Leather Boots",
    "levelReq": 22,
    "xp": 36,
    "baseTime": 5000,
    "requires": {
      "cured_leather": 2
    },
    "produces": "cured_boots",
    "group": "leather"
  },
  {
    "id": "craft_hard_helm",
    "skill": "crafting",
    "name": "Hardened Leather Helm",
    "levelReq": 42,
    "xp": 85,
    "baseTime": 6000,
    "requires": {
      "hardened_leather": 2,
      "knucklestone_bar": 1
    },
    "produces": "hard_helm",
    "group": "leather"
  },
  {
    "id": "craft_hard_body",
    "skill": "crafting",
    "name": "Hardened Leather Coat",
    "levelReq": 42,
    "xp": 150,
    "baseTime": 8000,
    "requires": {
      "hardened_leather": 4,
      "knucklestone_bar": 2
    },
    "produces": "hard_body",
    "group": "leather"
  },
  {
    "id": "craft_hard_legs",
    "skill": "crafting",
    "name": "Hardened Leather Legs",
    "levelReq": 42,
    "xp": 120,
    "baseTime": 7000,
    "requires": {
      "hardened_leather": 3,
      "knucklestone_bar": 1
    },
    "produces": "hard_legs",
    "group": "leather"
  },
  {
    "id": "craft_hard_boots",
    "skill": "crafting",
    "name": "Hardened Leather Boots",
    "levelReq": 42,
    "xp": 70,
    "baseTime": 6000,
    "requires": {
      "hardened_leather": 2
    },
    "produces": "hard_boots",
    "group": "leather"
  },
  {
    "id": "craft_master_helm",
    "skill": "crafting",
    "name": "Master Leather Helm",
    "levelReq": 68,
    "xp": 160,
    "baseTime": 8000,
    "requires": {
      "master_leather": 2,
      "ashiron_bar": 1
    },
    "produces": "master_helm",
    "group": "leather"
  },
  {
    "id": "craft_master_body",
    "skill": "crafting",
    "name": "Master Leather Coat",
    "levelReq": 68,
    "xp": 280,
    "baseTime": 10000,
    "requires": {
      "master_leather": 4,
      "ashiron_bar": 2
    },
    "produces": "master_body",
    "group": "leather"
  },
  {
    "id": "craft_master_legs",
    "skill": "crafting",
    "name": "Master Leather Legs",
    "levelReq": 68,
    "xp": 220,
    "baseTime": 9000,
    "requires": {
      "master_leather": 3,
      "ashiron_bar": 1
    },
    "produces": "master_legs",
    "group": "leather"
  },
  {
    "id": "craft_master_boots",
    "skill": "crafting",
    "name": "Master Leather Boots",
    "levelReq": 68,
    "xp": 130,
    "baseTime": 8000,
    "requires": {
      "master_leather": 2
    },
    "produces": "master_boots",
    "group": "leather"
  },
  {
    "id": "craft_glass_vial",
    "skill": "crafting",
    "name": "Blow Glass Vial",
    "levelReq": 1,
    "xp": 14,
    "baseTime": 5000,
    "requires": {
      "silica_sand": 2,
      "charcoal": 1
    },
    "produces": "glass_vial",
    "group": "glass"
  },
  {
    "id": "craft_glass_bead",
    "skill": "crafting",
    "name": "Form Glass Bead",
    "levelReq": 15,
    "xp": 28,
    "baseTime": 4000,
    "requires": {
      "silica_sand": 1
    },
    "produces": "glass_bead",
    "group": "glass"
  },
  {
    "id": "craft_glass_flask",
    "skill": "crafting",
    "name": "Blow Glass Flask",
    "levelReq": 15,
    "xp": 55,
    "baseTime": 6000,
    "requires": {
      "silica_sand": 3,
      "charcoal": 2
    },
    "produces": "glass_flask",
    "group": "glass"
  },
  {
    "id": "craft_ring_1_make",
    "skill": "crafting",
    "name": "Knucklestone Ring",
    "levelReq": 8,
    "xp": 25,
    "baseTime": 5000,
    "requires": {
      "gold_bar": 1
    },
    "produces": "craft_ring_1",
    "group": "jewelry"
  },
  {
    "id": "craft_ring_2_make",
    "skill": "crafting",
    "name": "Glass-Set Ring",
    "levelReq": 18,
    "xp": 45,
    "baseTime": 6000,
    "requires": {
      "gold_bar": 1,
      "glass_bead": 1
    },
    "produces": "craft_ring_2",
    "group": "jewelry"
  },
  {
    "id": "craft_ring_3_make",
    "skill": "crafting",
    "name": "Ashiron Band",
    "levelReq": 32,
    "xp": 75,
    "baseTime": 7000,
    "requires": {
      "gold_bar": 1,
      "glass_bead": 2
    },
    "produces": "craft_ring_3",
    "group": "jewelry"
  },
  {
    "id": "craft_gem_cut",
    "skill": "crafting",
    "name": "Cut Rough Gem",
    "levelReq": 30,
    "xp": 60,
    "baseTime": 7000,
    "requires": {
      "rough_gem": 1
    },
    "produces": "cut_gem",
    "group": "jewelry"
  },
  {
    "id": "craft_ring_gem_make",
    "skill": "crafting",
    "name": "Gem-Set Ring",
    "levelReq": 55,
    "xp": 200,
    "baseTime": 10000,
    "requires": {
      "gold_bar": 1,
      "cut_gem": 1
    },
    "produces": "craft_ring_gem",
    "group": "jewelry"
  },
  {
    "id": "craft_neck_power_make",
    "skill": "crafting",
    "name": "Ironweave Chain",
    "levelReq": 12,
    "xp": 40,
    "baseTime": 6000,
    "requires": {
      "gold_bar": 2
    },
    "produces": "craft_neck_power",
    "group": "jewelry"
  },
  {
    "id": "craft_neck_shield_make",
    "skill": "crafting",
    "name": "Wardstone Pendant",
    "levelReq": 28,
    "xp": 70,
    "baseTime": 7000,
    "requires": {
      "gold_bar": 2,
      "glass_bead": 1
    },
    "produces": "craft_neck_shield",
    "group": "jewelry"
  },
  {
    "id": "craft_neck_hunter_make",
    "skill": "crafting",
    "name": "Glass-Eye Pendant",
    "levelReq": 45,
    "xp": 110,
    "baseTime": 8000,
    "requires": {
      "gold_bar": 2,
      "glass_bead": 2
    },
    "produces": "craft_neck_hunter",
    "group": "jewelry"
  },
  {
    "id": "craft_neck_gem_make",
    "skill": "crafting",
    "name": "Gemstone Necklace",
    "levelReq": 65,
    "xp": 175,
    "baseTime": 9000,
    "requires": {
      "gold_bar": 2,
      "cut_gem": 2
    },
    "produces": "craft_neck_gem",
    "group": "jewelry"
  },
  {
    "id": "craft_neck_warden_make",
    "skill": "crafting",
    "name": "Warden's Amulet",
    "levelReq": 78,
    "xp": 360,
    "baseTime": 11000,
    "requires": {
      "gold_bar": 2,
      "cut_gem": 1,
      "master_leather": 1
    },
    "produces": "neck_warden",
    "group": "jewelry"
  },
  {
    "id": "craft_neck_amber_make",
    "skill": "crafting",
    "name": "Heartoak Amber Amulet",
    "levelReq": 72,
    "xp": 320,
    "baseTime": 10000,
    "requires": {
      "gold_bar": 1,
      "heartoak_amber": 1
    },
    "produces": "neck_amber",
    "group": "jewelry",
    "note": "A bead of heartoak amber set in gold — the forester's rare find made into the crafter's late-ladder piece."
  },
  {
    "id": "craft_neck_orun_make",
    "skill": "crafting",
    "name": "Orunwrought Amulet",
    "levelReq": 92,
    "xp": 560,
    "baseTime": 13000,
    "requires": {
      "gold_bar": 3,
      "cut_gem": 2
    },
    "produces": "neck_orun",
    "group": "jewelry"
  },
  {
    "id": "craft_pearl_ring",
    "skill": "crafting",
    "name": "River Pearl Ring",
    "levelReq": 40,
    "xp": 90,
    "baseTime": 7000,
    "requires": {
      "gold_bar": 1,
      "redrun_pearl": 1
    },
    "produces": "pearl_ring",
    "group": "jewelry"
  },
  {
    "id": "craft_stone_ring",
    "skill": "crafting",
    "name": "River Stone Ring",
    "levelReq": 6,
    "xp": 18,
    "baseTime": 4000,
    "requires": {
      "river_stone": 2
    },
    "produces": "stone_ring",
    "group": "jewelry"
  },
  // === HERBLORE — one clean pattern, OSRS-style: a Vial of Water + the herb
  // + one secondary makes a TWO-DOSE potion. Every farm herb has exactly one
  // potion, at the herb's own level; secondaries come from foraging, bones and
  // enemy drops. Fill your own vials from a glass vial at the cauldron.
  { "id": "fill_vials", "skill": "herblore", "name": "Fill Vial of Water", "levelReq": 1, "xp": 2, "baseTime": 1200, "requires": { "glass_vial": 1 }, "produces": "vial_water", "group": "potions" },
  { "id": "brew_potion_grace", "skill": "herblore", "name": "Grace Potion", "levelReq": 27, "xp": 100, "baseTime": 4000, "requires": { "vial_water": 1, "herb_ashweed": 1, "bonemeal": 1 }, "produces": "potion_grace", "group": "potions" },
  { "id": "brew_pot_gatherer", "skill": "herblore", "name": "Gathering Potion", "levelReq": 5, "xp": 35, "baseTime": 3200, "requires": { "vial_water": 1, "herb_thornroot": 1, "forage_mushroom": 1 }, "produces": "pot_gatherer", "group": "potions" },
  { "id": "brew_pot_warrior", "skill": "herblore", "name": "Vigour Potion", "levelReq": 10, "xp": 48, "baseTime": 3400, "requires": { "vial_water": 1, "herb_bloodberry": 1, "forage_ashroot": 1 }, "produces": "pot_warrior", "group": "potions" },
  { "id": "brew_brace_tonic", "skill": "herblore", "name": "Bracing Draught", "levelReq": 8, "xp": 40, "baseTime": 3300, "requires": { "vial_water": 1, "herb_ashweed": 1, "greyoak_gall": 1 }, "produces": "brace_tonic", "group": "potions" },
  { "id": "brew_pot_runner", "skill": "herblore", "name": "Energy Potion", "levelReq": 38, "xp": 138, "baseTime": 4600, "requires": { "vial_water": 1, "herb_coldmoss": 1, "forage_thornberry": 1 }, "produces": "pot_runner", "group": "potions" },
  { "id": "brew_pot_ironhide", "skill": "herblore", "name": "Ward Potion", "levelReq": 20, "xp": 78, "baseTime": 3800, "requires": { "vial_water": 1, "herb_ironleaf": 1, "forage_hearthroot": 1 }, "produces": "pot_ironhide", "group": "potions" },
  { "id": "brew_pot_deepgrace", "skill": "herblore", "name": "Super Grace Potion", "levelReq": 45, "xp": 165, "baseTime": 4900, "requires": { "vial_water": 1, "herb_greybloom": 1, "bonemeal": 2 }, "produces": "pot_deepgrace", "group": "potions" },
  { "id": "brew_pot_archer", "skill": "herblore", "name": "Draw Potion", "levelReq": 32, "xp": 118, "baseTime": 4300, "requires": { "vial_water": 1, "herb_spinethistle": 1, "greyoak_gall": 1 }, "produces": "pot_archer", "group": "potions" },
  { "id": "brew_pot_battlemind", "skill": "herblore", "name": "Edge Potion", "levelReq": 42, "xp": 150, "baseTime": 4700, "requires": { "vial_water": 1, "herb_ruevine": 1, "forage_ashroot": 2 }, "produces": "pot_battlemind", "group": "potions" },
  { "id": "brew_pot_sage", "skill": "herblore", "name": "Experience Potion", "levelReq": 52, "xp": 190, "baseTime": 5200, "requires": { "vial_water": 1, "herb_duskshade": 1, "forage_dawnspore": 1 }, "produces": "pot_sage", "group": "potions" },
  { "id": "brew_pot_mastergather", "skill": "herblore", "name": "Super Gathering Potion", "levelReq": 62, "xp": 240, "baseTime": 5700, "requires": { "vial_water": 1, "herb_marrowflower": 1, "forage_deepmoss": 1 }, "produces": "pot_mastergather", "group": "potions" },
  { "id": "brew_pot_hearthfire", "skill": "herblore", "name": "Super Experience Potion", "levelReq": 76, "xp": 320, "baseTime": 6400, "requires": { "vial_water": 1, "herb_hearthbloom": 1, "forage_ashbloom": 1 }, "produces": "pot_hearthfire", "group": "potions" },
  { "id": "brew_antidote", "skill": "herblore", "name": "Antidote", "levelReq": 24, "xp": 92, "baseTime": 4200, "requires": { "vial_water": 1, "herb_spinethistle": 1, "forage_nightshade": 1 }, "produces": "pot_antidote", "group": "potions", "note": "The counterplay to poison. Deliberately cheap to reach (Herblore 24) - a status you cannot answer is not a mechanic, it is a tax." },
  { "id": "brew_pot_orunstears", "skill": "herblore", "name": "Restore Potion", "levelReq": 90, "xp": 430, "baseTime": 7200, "requires": { "vial_water": 1, "herb_orunroot": 1, "forage_nightshade": 1 }, "produces": "pot_orunstears", "group": "potions" },

  // --- Trophy sinks (audit T4·03): dead-end monster trophies given a real loop
  //     instead of flattening every kill into vendor coin. ---
  { "id": "craft_fang_arrows", "skill": "woodcraft", "name": "Knap Fang Arrowheads", "levelReq": 20, "xp": 30, "baseTime": 1800, "requires": { "wolf_fang": 1 }, "produces": "arrow_ashiron", "produceQty": 6, "group": "arrows", "note": "A wolf's fang knaps into six wicked arrowheads — a use at last for the fangs that used to only sell." },
  { "id": "craft_tusk_meal", "skill": "crafting", "name": "Grind Boar Tusk", "levelReq": 12, "xp": 26, "baseTime": 2600, "requires": { "boar_tusk": 1 }, "produces": "bonemeal", "produceQty": 3, "group": "leather", "note": "Boar tusk is dense bone — ground down it feeds the altars like any bone would. A sink for a trophy that used to be pure vendor trash." },
  { "id": "brew_ratear_tincture", "skill": "herblore", "name": "Rat-Ear Tincture", "levelReq": 18, "xp": 80, "baseTime": 3900, "requires": { "vial_water": 1, "herb_bloodberry": 1, "rat_king_ear": 1 }, "produces": "pot_warrior", "group": "potions", "note": "The alchemists really did pay for the Rat King's ear — steeped over bloodberry it makes a Vigour draught. The rare trophy finally has a use beyond the vendor." },

  // --- Stranded content, given sources -------------------------------------
  // Every item below existed in the catalogue with nothing in the game that
  // produced it. Ironvale's Cape is gated on filling the collection log, so an
  // item nobody can obtain does not just sit unused — it makes the grandmaster
  // reward unreachable. Levels and ingredients follow each item's own
  // description and the ladder its siblings already sit on.
  { "id": "con_plank_briar", "skill": "construction", "name": "Mill Briarwood Planks \u00d74", "levelReq": 10, "xp": 34, "baseTime": 4200, "requires": { "alder_log": 1 }, "produces": "plank_briarwood", "produceQty": 4, "group": "sawmill", "note": "Briar-grown alder, milled dense. Takes nails cleanly \u2014 and it is the only thing alder was ever good for." },
  { "id": "wc_stonewood_haft", "skill": "woodcraft", "name": "Stonewood Haft", "levelReq": 35, "xp": 45, "baseTime": 3200, "requires": { "stonewood_log": 1 }, "produces": "stonewood_haft", "group": "mats", "note": "A dense handle blank for hafted weapons \u2014 heavy in the hand, and it does not split." },
  { "id": "surv_burn_soft", "skill": "survivalist", "name": "Bank a Softwood Fire", "levelReq": 1, "xp": 22, "baseTime": 3000, "requiresAny": ["ashwood_log", "alder_log", "birch_log", "coldpine_log"], "produces": "wood_ash", "produceQty": 2, "group": "fire", "note": "Softwood burns to fine grey ash rather than charcoal. Fertiliser takes it, and so does dye." },
  { "id": "surv_burn_fine", "skill": "survivalist", "name": "Burn a Slow Hardwood Kiln", "levelReq": 70, "xp": 140, "baseTime": 9000, "requiresAny": ["deeproot_log", "heartoak_log", "ironbark_log"], "produces": "fine_charcoal", "group": "fire", "note": "The oldest woods, burned slow and starved of air. High-grade charcoal \u2014 nothing else takes a forge as evenly." },
  { "id": "surv_strip_dusk", "skill": "survivalist", "name": "Strip Dusk Bark", "levelReq": 45, "xp": 70, "baseTime": 5200, "requires": { "deeproot_log": 1 }, "produces": "dusk_bark", "produceQty": 2, "group": "forage", "note": "Peeled at twilight, when the sap is down. Darker than ordinary bark, and it holds a dye no other wood will." },
  { "id": "cook_ashroot_compound", "skill": "cooking", "name": "Ashroot Compound (+24 HP)", "levelReq": 72, "xp": 240, "baseTime": 6500, "requires": { "forage_ashroot": 3, "bonemeal": 1 }, "produces": "ashroot_compound", "group": "forage", "note": "Ashroot reduced hard and bound with bonemeal. Dense and restorative \u2014 and easy to ruin." },
  { "id": "cook_dawnspore_elixir", "skill": "cooking", "name": "Dawnspore Elixir (+33 HP)", "levelReq": 92, "xp": 340, "baseTime": 7500, "requires": { "forage_dawnspore": 2, "forage_orunbloom": 1 }, "produces": "dawnspore_elixir", "group": "forage", "note": "Dawnspore drawn out over orunbloom. Extraordinarily rare, and it tastes of morning air." },
  { "id": "brew_shield_oil", "skill": "herblore", "name": "Ward Oil", "levelReq": 35, "xp": 110, "baseTime": 4200, "requires": { "vial_water": 1, "herb_ironleaf": 1, "charcoal": 2 }, "produces": "shield_oil", "group": "potions", "note": "Ironleaf steeped black and cut with charcoal. Rubbed into armour before a fight \u2014 the blow still lands, but softer." },
  { "id": "con_infra_watchtower", "skill": "construction", "name": "Raise a Watchtower Frame", "levelReq": 85, "xp": 900, "baseTime": 14000, "requires": { "heartoak_beam": 4, "vault_stone": 6, "ashiron_rivet": 20 }, "produces": "watchtower_frame", "group": "masonry", "note": "Deep-cut stone on an ironwood skeleton. The last serious construction project most men attempt." },

  // --- Heraldry: a designed line that was never given a bench --------------
  // Each recipe uses the exact materials the item's own description names.
  { "id": "craft_sigil_knuckle", "skill": "crafting", "name": "Press Knuckle Sigil", "levelReq": 20, "xp": 70, "baseTime": 3000, "requires": { "knucklestone_bar": 2, "gold_bar": 1 }, "produces": "sigil_knuckle", "group": "heraldry", "note": "A pressed knucklestone seal on a gold band \u2014 the mark of a Hill man who knows his roots." },
  { "id": "craft_sigil_spine", "skill": "crafting", "name": "Etch Spine Sigil", "levelReq": 50, "xp": 190, "baseTime": 4000, "requires": { "spinite_bar": 2, "gold_bar": 1 }, "produces": "sigil_spine", "group": "heraldry", "note": "Spinite etched into an insignia. Mountain-born, or mountain-tested." },
  { "id": "craft_crest_shield", "skill": "crafting", "name": "Paint Crested Shield", "levelReq": 45, "xp": 210, "baseTime": 5000, "requires": { "cut_coldvein": 2, "bloodore_bar": 1, "tanned_leather": 2 }, "produces": "crest_shield", "group": "heraldry", "note": "A coldvein shield faced in leather and painted with bloodore heraldry. Defence and declaration." },
  { "id": "craft_crest_master", "skill": "crafting", "name": "Face Master Crest Shield", "levelReq": 70, "xp": 430, "baseTime": 6500, "requires": { "ribstone_bar": 3, "voidstone_bar": 1, "master_leather": 2 }, "produces": "crest_shield_master", "group": "heraldry", "note": "Ribstone under void-pigment insignia. The heraldist's final word on defence." },
  { "id": "craft_herald_cape_ash", "skill": "crafting", "name": "Dye Ashmark Cape", "levelReq": 30, "xp": 120, "baseTime": 4000, "requires": { "tanned_leather": 3, "wood_ash": 4 }, "produces": "herald_cape_ash", "group": "heraldry", "note": "A travelling cape grey-dyed in wood ash and marked with the ash sigil. +4% gathering speed." },
  { "id": "craft_herald_cape_deep", "skill": "crafting", "name": "Dye Deepmark Cape", "levelReq": 60, "xp": 330, "baseTime": 5500, "requires": { "master_leather": 2, "dusk_bark": 4 }, "produces": "herald_cape_deep", "group": "heraldry", "note": "Deeproot bark boiled to a dye no other wood gives. Those who know, nod. +8% gathering speed." },

  // --- The Ascendant tier ---------------------------------------------------
  // The only recipes in Varath that cost Ascendant Embers, and the embers are
  // minted by the post-max XP grind itself — so this bench opens only to a
  // player who has gone past 100 and kept going. Level 100 is stated on each
  // recipe for readability; the embers already make it unreachable below that.
  { "id": "asc_helm", "skill": "smithing", "name": "Ascendant Helm", "levelReq": 100, "xp": 2000, "baseTime": 12000, "requires": { "hearthite_bar": 3, "ascendant_ember": 2 }, "produces": "ascendant_helm", "group": "ascendant", "note": "Hearthite worked around a living ember. Two embers — two master stars — and the heat never reaches you." },
  { "id": "asc_body", "skill": "smithing", "name": "Ascendant Cuirass", "levelReq": 100, "xp": 3200, "baseTime": 16000, "requires": { "hearthite_bar": 5, "ascendant_ember": 2 }, "produces": "ascendant_body", "group": "ascendant", "note": "Plate that glows along every seam and stays cool to the touch." },
  { "id": "asc_legs", "skill": "smithing", "name": "Ascendant Greaves", "levelReq": 100, "xp": 2800, "baseTime": 15000, "requires": { "hearthite_bar": 4, "ascendant_ember": 2 }, "produces": "ascendant_legs", "group": "ascendant", "note": "The finest leg armour ever drawn from Varath — and the last, since there is nothing above it to make." },
  { "id": "asc_boots", "skill": "smithing", "name": "Ascendant Sabatons", "levelReq": 100, "xp": 1400, "baseTime": 10000, "requires": { "hearthite_bar": 2, "ascendant_ember": 2 }, "produces": "ascendant_boots", "group": "ascendant", "note": "They leave no mark on stone, and no heat behind them." },
  { "id": "asc_shield", "skill": "smithing", "name": "Ascendant Bulwark", "levelReq": 100, "xp": 2600, "baseTime": 14000, "requires": { "hearthite_bar": 4, "ascendant_ember": 2 }, "produces": "ascendant_shield", "group": "ascendant", "note": "An ember set in hearthite, faced outward. Whatever strikes it arrives late." },
  { "id": "asc_claymore", "skill": "smithing", "name": "Ascendant Greatsword", "levelReq": 100, "xp": 4000, "baseTime": 18000, "requires": { "hearthite_bar": 5, "ascendant_ember": 3 }, "produces": "ascendant_claymore", "group": "ascendant", "note": "An ember folded into the spine of the blade. It has never needed sharpening." },
  { "id": "asc_spear", "skill": "smithing", "name": "Ascendant Spear", "levelReq": 100, "xp": 4000, "baseTime": 18000, "requires": { "hearthite_bar": 5, "ascendant_ember": 3 }, "produces": "ascendant_spear", "group": "ascendant", "note": "Perfectly balanced and warm along its whole length. It goes exactly where it is sent." },
  { "id": "asc_maul", "skill": "smithing", "name": "Ascendant Maul", "levelReq": 100, "xp": 4000, "baseTime": 18000, "requires": { "hearthite_bar": 5, "ascendant_ember": 3 }, "produces": "ascendant_maul", "group": "ascendant", "note": "A head holding an ember the size of a fist. What it lands on does not get up." },
  { "id": "asc_bow", "skill": "woodcraft", "name": "Ascendant Longbow", "levelReq": 100, "xp": 3600, "baseTime": 16000, "requires": { "deeproot_log": 4, "ascendant_ember": 3 }, "produces": "ascendant_bow", "group": "ascendant", "note": "Deeproot drawn around an ember core. The string hums after the arrow has already arrived." },
  { "id": "asc_staff", "skill": "woodcraft", "name": "Ascendant Staff", "levelReq": 100, "xp": 3600, "baseTime": 16000, "requires": { "deeproot_log": 4, "ascendant_ember": 3 }, "produces": "ascendant_staff", "group": "ascendant", "note": "An ember caged at the head, burning on nothing. Grace pours through it without being asked." },
];
