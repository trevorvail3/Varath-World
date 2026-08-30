/**
 * src/content/monsters.ts
 * -----------------------
 * Combat stats and loot tables for every monster, ported verbatim from the
 * Varath idle game's `MONSTERS` table. 30 monsters: the open-world
 * creatures of all six zones, the quest-only foes, and the four dungeon bosses.
 *
 * GENERATED from varath_21.html — see docs/CANON_LEDGER.md (Phase 1e). `acc`,
 * `def`, `speed`, `attackStyle` and `weakness` are carried for the combat-math
 * upgrade; today's simplified combat reads hp/maxHit/xp. Drop `tier` is the
 * canon rarity label. TypeScript validates every drop item id against ItemId.
 */

import type { MonsterStats } from "../core/types.ts";

export const monsters: Record<string, MonsterStats> = {
  "moor_rat": {
    "id": "moor_rat",
    "name": "Moor Rat",
    "icon": "🐀",
    "level": 1,
    "hp": 10,
    "acc": 4,
    "def": 1,
    "maxHit": 3,
    "speed": 3000,
    "xp": 8,
    "attackStyle": "stab",
    "weakness": [
      "slash"
    ],
    "desc": "A bristling, overgrown rat of the hill moors. More nuisance than threat.",
    "drops": [
      { item: "raw_rat_meat", chance: 1, tier: "always" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "raw_hide", chance: 0.35, tier: "common" },
      { item: "rat_tail", chance: 0.25, tier: "common" },
      { item: "chipped_tooth", chance: 0.12, tier: "common" },
      { item: "scrap_cloth", chance: 0.1, tier: "common" },
      { item: "worn_coin", chance: 0.15, min: 1, max: 4, tier: "uncommon" },
      { item: "seed_ashweed", chance: 0.05, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.008, tier: "rare" },
      { item: "rat_king_ear", chance: 0.005, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" }
    ]
  },
  "sewer_rat": {
    "id": "sewer_rat",
    "name": "Sewer Rat",
    "icon": "🐀",
    "level": 4,
    "hp": 14,
    "acc": 6,
    "def": 2,
    "maxHit": 3,
    "speed": 3000,
    "xp": 12,
    "attackStyle": "stab",
    "weakness": [
      "slash"
    ],
    "desc": "A slick, water-fattened rat that has never seen daylight. They nest in the fouled earth of the Ironvale drains.",
    "drops": [
      { item: "raw_rat_meat", chance: 1, tier: "always" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "raw_hide", chance: 0.4, tier: "common" },
      { item: "rat_tail", chance: 0.3, tier: "common" },
      { item: "chipped_tooth", chance: 0.14, tier: "common" },
      { item: "scrap_cloth", chance: 0.12, tier: "common" },
      { item: "worn_coin", chance: 0.18, min: 1, max: 5, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.009, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" }
    ]
  },
  "gutter_spider": {
    "poison": 3,
    "id": "gutter_spider",
    "name": "Gutter Spider",
    "icon": "🕷️",
    "level": 9,
    "hp": 30,
    "acc": 12,
    "def": 6,
    "maxHit": 5,
    "speed": 3200,
    "xp": 26,
    "attackStyle": "stab",
    "weakness": [
      "crush"
    ],
    "desc": "A pale, long-legged spider that strings its webs across the old brick galleries. Its bite carries a numbing venom.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },
      { item: "spider_silk", chance: 0.5, tier: "common" },
      { item: "chipped_tooth", chance: 0.15, tier: "common" },
      { item: "sinew", chance: 0.2, tier: "common" },
      { item: "worn_coin", chance: 0.22, min: 2, max: 7, tier: "common" },
      { item: "rough_gem", chance: 0.05, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.011, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" }
    ]
  },
  "sewer_kobold": {
    "id": "sewer_kobold",
    "name": "Sewer Kobold",
    "icon": "👺",
    "level": 15,
    "hp": 55,
    "acc": 22,
    "def": 12,
    "maxHit": 8,
    "speed": 3400,
    "xp": 44,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "A hunched, scavenging kobold that has claimed the deep brick den as its own. It fights with a length of rusted pipe.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },
      { item: "scrap_cloth", chance: 0.35, tier: "common" },
      { item: "sinew", chance: 0.25, tier: "common" },
      { item: "worn_coin", chance: 0.28, min: 3, max: 10, tier: "common" },
      { item: "rough_gem", chance: 0.08, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.006, tier: "rare" },
      { item: "marrow_shard", chance: 0.004, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" }
    ]
  },
  "sewer_sludge": {
    "id": "sewer_sludge",
    "name": "Sewer Sludge",
    "icon": "🟢",
    "level": 22,
    "hp": 95,
    "acc": 40,
    "def": 8,
    "maxHit": 12,
    "speed": 4200,
    "xp": 70,
    "attackStyle": "crush",
    "weakness": [
      "slash"
    ],
    "desc": "A churning mass of the sump's runoff, congealed into something that hunts. It smothers what it catches.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },
      { item: "scrap_cloth", chance: 0.3, tier: "common" },
      { item: "worn_coin", chance: 0.32, min: 4, max: 14, tier: "common" },
      { item: "rough_gem", chance: 0.12, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.01, tier: "rare" },
      { item: "marrow_shard", chance: 0.008, tier: "rare" },
      { item: "shard_of_orun", chance: 0.0015, tier: "legendary" }
    ]
  },
  "hill_wolf": {
    "id": "hill_wolf",
    "name": "Hill Wolf",
    "icon": "🐺",
    "level": 5,
    "hp": 30,
    "acc": 8,
    "def": 4,
    "maxHit": 3,
    "speed": 3200,
    "xp": 18,
    "attackStyle": "slash",
    "weakness": [
      "stab"
    ],
    "desc": "A lean grey wolf that hunts the Knuckle Hills in the cold months. Quick and wary.",
    "drops": [
      { item: "raw_meat", chance: 1, tier: "always" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "raw_hide", chance: 0.5, tier: "common" },
      { item: "wolf_fang", chance: 0.15, tier: "uncommon" },
      { item: "chipped_tooth", chance: 0.12, tier: "common" },
      { item: "worn_coin", chance: 0.2, min: 1, max: 6, tier: "common" },
      { item: "seed_thornroot", chance: 0.04, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.01, tier: "rare" },
      { item: "silver_wolf_pelt", chance: 0.005, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" }
    ]
  },
  "wild_boar": {
    "id": "wild_boar",
    "name": "Wild Boar",
    "icon": "🐗",
    "level": 12,
    "hp": 60,
    "acc": 15,
    "def": 9,
    "maxHit": 5,
    "speed": 3600,
    "xp": 36,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "A heavy, ill-tempered boar of the Greyoak understory. It charges before it thinks.",
    "drops": [
      { item: "raw_meat", chance: 1, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "raw_hide", chance: 0.55, tier: "common" },
      { item: "sinew", chance: 0.3, tier: "common" },
      { item: "boar_tusk", chance: 0.18, tier: "uncommon" },
      { item: "beast_horn", chance: 0.05, tier: "uncommon" },
      { item: "worn_coin", chance: 0.25, min: 2, max: 8, tier: "common" },
      { item: "seed_bloodberry", chance: 0.05, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.012, tier: "rare" },
      { item: "uncut_emerald", chance: 0.004, tier: "rare" },
      { item: "bristle_crown", chance: 0.004, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" }
    ]
  },
  "forest_bear": {
    "id": "forest_bear",
    "name": "Forest Bear",
    "icon": "🐻",
    "level": 22,
    "hp": 110,
    "acc": 47,
    "def": 16,
    "maxHit": 15,
    "speed": 4000,
    "xp": 68,
    "attackStyle": "crush",
    "weakness": [
      "slash"
    ],
    "desc": "A great bear of the deep Greyoak. Slow to rouse, devastating once roused.",
    "drops": [
      { item: "raw_meat", chance: 1, min: 1, max: 2, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "raw_hide", chance: 0.65, tier: "common" },
      { item: "sinew", chance: 0.35, tier: "common" },
      { item: "thick_hide", chance: 0.12, tier: "uncommon" },
      { item: "bear_claw", chance: 0.2, tier: "uncommon" },
      { item: "worn_coin", chance: 0.3, min: 5, max: 16, tier: "common" },
      { item: "uncut_sapphire", chance: 0.02, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.008, tier: "rare" },
      { item: "forest_bear_skull", chance: 0.003, tier: "rare" },
      { item: "shard_of_orun", chance: 0.002, tier: "legendary" }
    ]
  },
  "red_deer": {
    "id": "red_deer",
    "name": "Red Deer",
    "icon": "🦌",
    "level": 8,
    "hp": 45,
    "acc": 10,
    "def": 6,
    "maxHit": 3,
    "speed": 3000,
    "xp": 24,
    "attackStyle": "stab",
    "weakness": ["stab"],
    "desc": "A wary stag of the open country. It will bolt — or, cornered, drive its antlers home.",
    "drops": [
      { item: "raw_meat", chance: 1, tier: "always" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "raw_hide", chance: 0.6, tier: "common" },
      { item: "beast_horn", chance: 0.15, tier: "uncommon" },
      { item: "worn_coin", chance: 0.4, min: 2, max: 12, tier: "common" },
      { item: "seed_greybloom", chance: 0.04, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.01, tier: "rare" }
    ]
  },
  "mountain_lion": {
    "id": "mountain_lion",
    "name": "Mountain Lion",
    "icon": "🦁",
    "level": 26,
    "hp": 120,
    "acc": 30,
    "def": 18,
    "maxHit": 9,
    "speed": 2600,
    "xp": 70,
    "attackStyle": "slash",
    "weakness": ["stab"],
    "desc": "A tawny cat of the high rocks and the wood's edge. It stalks, then it sprints — and it does not miss twice.",
    "drops": [
      { item: "raw_meat", chance: 1, min: 1, max: 2, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "raw_hide", chance: 0.6, tier: "common" },
      { item: "bear_claw", chance: 0.15, tier: "uncommon" },
      { item: "chipped_tooth", chance: 0.15, tier: "common" },
      { item: "worn_coin", chance: 0.45, min: 5, max: 26, tier: "common" },
      { item: "uncut_sapphire", chance: 0.025, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.01, tier: "rare" },
      { item: "cut_gem", chance: 0.02, tier: "rare" },
      { item: "shard_of_orun", chance: 0.0015, tier: "legendary" }
    ]
  },
  "ridge_wolf": {
    "id": "ridge_wolf",
    "name": "Ridge Wolf",
    "icon": "🐺",
    "level": 28,
    "hp": 85,
    "acc": 53,
    "def": 18,
    "maxHit": 17,
    "speed": 2600,
    "xp": 55,
    "attackStyle": "slash",
    "weakness": [
      "stab",
      "ranged"
    ],
    "desc": "A mountain wolf, larger and meaner than its forest cousins.",
    "drops": [
      { item: "raw_meat", chance: 0.8, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "wolf_fang", chance: 0.4, tier: "common" },
      { item: "raw_hide", chance: 0.25, tier: "uncommon" },
      { item: "chipped_tooth", chance: 0.15, tier: "common" },
      { item: "worn_coin", chance: 0.4, min: 5, max: 18, tier: "common" },
      { item: "uncut_sapphire", chance: 0.03, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.012, tier: "rare" },
      { item: "silver_wolf_pelt", chance: 0.02, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" }
    ]
  },
  "stone_crawler": {
    "id": "stone_crawler",
    "name": "Stone Crawler",
    "icon": "🦎",
    "level": 35,
    "hp": 120,
    "acc": 78,
    "def": 30,
    "maxHit": 23,
    "speed": 3200,
    "xp": 85,
    "attackStyle": "stab",
    "weakness": [
      "crush"
    ],
    "desc": "An armoured reptile that moves across cliff faces. Its shell absorbs blows.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },
      { item: "knucklestone_ore", chance: 0.55, min: 1, max: 2, tier: "common" },
      { item: "ribstone_ore", chance: 0.25, min: 1, max: 2, tier: "common" },
      { item: "cracked_shell", chance: 0.35, tier: "common" },
      { item: "golem_dust", chance: 0.22, tier: "common" },
      { item: "worn_coin", chance: 0.4, min: 4, max: 12, tier: "common" },
      { item: "uncut_sapphire", chance: 0.06, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.03, tier: "uncommon" },
      { item: "rough_gem", chance: 0.1, tier: "uncommon" },
      { item: "ribstone_bar", chance: 0.06, tier: "uncommon" },
      { item: "seed_coldmoss", chance: 0.05, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.01, tier: "rare" },
      { item: "helm_3", chance: 0.03, tier: "rare" },
      { item: "cut_gem", chance: 0.02, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" }
    ]
  },
  "mountain_troll": {
    "id": "mountain_troll",
    "name": "Mountain Troll",
    "icon": "👹",
    "level": 42,
    "hp": 200,
    "acc": 85,
    "def": 22,
    "maxHit": 22,
    "speed": 3500,
    "xp": 130,
    "attackStyle": "crush",
    "weakness": [
      "stab",
      "ranged",
      "magic"
    ],
    "desc": "Slow. Extremely strong. Does not like being poked.",
    "drops": [
      { item: "worn_coin", chance: 0.7, min: 8, max: 22, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "ribstone_ore", chance: 0.45, min: 1, max: 3, tier: "common" },
      { item: "golem_dust", chance: 0.25, tier: "common" },
      { item: "beast_horn", chance: 0.1, tier: "uncommon" },
      { item: "ribstone_bar", chance: 0.12, tier: "uncommon" },
      { item: "bloodore_ore", chance: 0.07, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.08, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.04, tier: "uncommon" },
      { item: "rough_gem", chance: 0.12, min: 1, max: 2, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.015, tier: "rare" },
      { item: "hammer_4", chance: 0.04, tier: "rare" },
      { item: "seed_greybloom", chance: 0.05, tier: "uncommon" },
      { item: "cut_gem", chance: 0.03, tier: "rare" },
      { item: "shard_of_orun", chance: 0.002, tier: "legendary" }
    ]
  },
  "spine_wraith": {
    "id": "spine_wraith",
    "name": "Spine Wraith",
    "icon": "👻",
    "level": 45,
    "hp": 110,
    "acc": 88,
    "def": 10,
    "maxHit": 24,
    "speed": 1800,
    "attackRange": 4,
    "xp": 155,
    "attackStyle": "ranged",
    "weakness": [
      "slash",
      "ranged"
    ],
    "desc": "A fast, barely-visible thing that moves between rocks. It flings shards of cold from afar — close the gap or answer it with a bow.",
    "drops": [
      { item: "worn_coin", chance: 0.6, min: 6, max: 18, tier: "common" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "wraith_fragment", chance: 0.3, tier: "uncommon" },
      { item: "tarnished_amulet", chance: 0.1, tier: "uncommon" },
      { item: "ribstone_bar", chance: 0.12, tier: "uncommon" },
      { item: "rough_gem", chance: 0.12, min: 1, max: 2, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.05, tier: "uncommon" },
      { item: "seed_spinethistle", chance: 0.06, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.02, tier: "rare" },
      { item: "ring_3", chance: 0.04, tier: "rare" },
      { item: "cut_gem", chance: 0.04, tier: "rare" },
      { item: "shard_of_orun", chance: 0.008, tier: "legendary" }
    ]
  },
  "marsh_lurker": {
    "id": "marsh_lurker",
    "name": "Marsh Lurker",
    "icon": "🐊",
    "level": 48,
    "hp": 155,
    "acc": 91,
    "def": 28,
    "maxHit": 26,
    "speed": 2800,
    "xp": 165,
    "attackStyle": "stab",
    "weakness": [
      "crush",
      "ranged"
    ],
    "desc": "A bog reptile that waits beneath the surface. The first sign is often the last.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },
      { item: "raw_boar_meat", chance: 0.55, tier: "common" },
      { item: "serpent_scale", chance: 0.3, tier: "common" },
      { item: "cracked_shell", chance: 0.2, tier: "uncommon" },
      { item: "worn_coin", chance: 0.5, min: 5, max: 16, tier: "common" },
      { item: "tanned_leather", chance: 0.2, tier: "common" },
      { item: "ribstone_bar", chance: 0.08, tier: "uncommon" },
      { item: "cured_leather", chance: 0.08, tier: "uncommon" },
      { item: "rough_gem", chance: 0.1, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.05, tier: "uncommon" },
      { item: "seed_ruevine", chance: 0.05, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.02, tier: "rare" },
      { item: "spear_6", chance: 0.025, tier: "rare" },
      { item: "shard_of_orun", chance: 0.003, tier: "legendary" }
    ]
  },
  "heartmoor_hound": {
    "id": "heartmoor_hound",
    "name": "Heartmoor Hound",
    "icon": "🐕",
    "level": 55,
    "hp": 145,
    "acc": 154,
    "def": 20,
    "maxHit": 36,
    "speed": 2200,
    "xp": 200,
    "attackStyle": "stab",
    "weakness": [
      "stab"
    ],
    "desc": "Pack hunters of the Heartmoor. Faster than they look. Work in groups.",
    "drops": [
      { item: "raw_wolf_meat", chance: 0.7, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "wolf_fang", chance: 0.4, tier: "common" },
      { item: "wolf_pelt", chance: 0.22, tier: "uncommon" },
      { item: "chipped_tooth", chance: 0.15, tier: "common" },
      { item: "worn_coin", chance: 0.45, min: 5, max: 14, tier: "common" },
      { item: "thick_hide", chance: 0.1, tier: "uncommon" },
      { item: "rough_gem", chance: 0.08, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.06, tier: "uncommon" },
      { item: "seed_greybloom", chance: 0.06, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.02, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" }
    ]
  },
  "bog_knight": {
    "id": "bog_knight",
    "name": "Bog Knight",
    "icon": "🧟",
    "level": 61,
    "hp": 220,
    "acc": 189,
    "def": 35,
    "maxHit": 41,
    "speed": 3000,
    "xp": 255,
    "attackStyle": "slash",
    "weakness": [
      "crush"
    ],
    "desc": "Something armoured that was buried in the mire and did not stay buried.",
    "drops": [
      { item: "worn_coin", chance: 0.8, min: 8, max: 22, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "ashiron_bar", chance: 0.18, tier: "uncommon" },
      { item: "ribstone_bar", chance: 0.1, tier: "uncommon" },
      { item: "tarnished_amulet", chance: 0.12, tier: "uncommon" },
      { item: "gold_ring", chance: 0.05, tier: "rare" },
      { item: "rough_gem", chance: 0.12, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.06, tier: "uncommon" },
      { item: "armor_6", chance: 0.04, tier: "rare" },
      { item: "legs_6", chance: 0.04, tier: "rare" },
      { item: "uncut_ruby", chance: 0.03, tier: "rare" },
      { item: "cut_gem", chance: 0.05, tier: "rare" },
      { item: "uncut_diamond", chance: 0.005, tier: "rare" },
      { item: "seed_ruevine", chance: 0.05, tier: "uncommon" },
      { item: "shard_of_orun", chance: 0.003, tier: "legendary" }
    ]
  },
  "mire_serpent": {
    "poison": 6, "venom": true,
    "id": "mire_serpent",
    "name": "Mire Serpent",
    "icon": "🐍",
    "level": 64,
    "hp": 185,
    "acc": 192,
    "def": 25,
    "maxHit": 43,
    "speed": 2400,
    "xp": 310,
    "attackStyle": "stab",
    "weakness": [
      "slash",
      "ranged"
    ],
    "desc": "An enormous reptile that makes its home in the Heartmoor fens. Venomous.",
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "serpent_scale", chance: 0.4, min: 1, max: 2, tier: "common" },
      { item: "raw_boar_meat", chance: 0.4, tier: "common" },
      { item: "cracked_shell", chance: 0.2, tier: "uncommon" },
      { item: "worn_coin", chance: 0.55, min: 8, max: 22, tier: "common" },
      { item: "ribstone_bar", chance: 0.12, tier: "uncommon" },
      { item: "cured_leather", chance: 0.12, tier: "uncommon" },
      { item: "rough_gem", chance: 0.12, min: 1, max: 2, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.06, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.025, tier: "rare" },
      { item: "cut_gem", chance: 0.05, tier: "rare" },
      { item: "seed_duskshade", chance: 0.05, tier: "uncommon" },
      { item: "claymore_6", chance: 0.025, tier: "rare" },
      { item: "shard_of_orun", chance: 0.004, tier: "legendary" }
    ]
  },
  "cave_crawler": {
    "id": "cave_crawler",
    "name": "Cave Crawler",
    "icon": "🕷️",
    "level": 55,
    "hp": 155,
    "acc": 228,
    "def": 26,
    "maxHit": 26,
    "speed": 2600,
    "xp": 335,
    "attackStyle": "stab",
    "weakness": [
      "crush"
    ],
    "desc": "A large, pale spider that has never seen light. Moves quickly in darkness.",
    "drops": [
      { item: "spider_silk", chance: 0.45, min: 1, max: 2, tier: "common" },
      { item: "ashiron_ore", chance: 0.3, min: 1, max: 2, tier: "common" },
      { item: "cracked_shell", chance: 0.25, tier: "uncommon" },
      { item: "chipped_tooth", chance: 0.12, tier: "common" },
      { item: "worn_coin", chance: 0.5, min: 10, max: 26, tier: "common" },
      { item: "ribstone_bar", chance: 0.12, tier: "uncommon" },
      { item: "rough_gem", chance: 0.14, min: 1, max: 2, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.07, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.03, tier: "rare" },
      { item: "cut_gem", chance: 0.05, tier: "rare" },
      { item: "seed_marrowflower", chance: 0.05, tier: "uncommon" },
      { item: "dagger_9", chance: 0.02, tier: "rare" },
      { item: "shard_of_orun", chance: 0.002, tier: "legendary" }
    ]
  },
  "deep_bat": {
    "id": "deep_bat",
    "name": "Deep Bat",
    "icon": "🦇",
    "level": 58,
    "hp": 105,
    "acc": 236,
    "def": 13,
    "maxHit": 28,
    "speed": 1600,
    "xp": 290,
    "attackStyle": "slash",
    "weakness": [
      "slash",
      "ranged"
    ],
    "desc": "Enormous bats that hunt in the Marrow Deeps. Incredibly fast, somewhat fragile.",
    "drops": [
      { item: "bat_wing", chance: 0.5, min: 1, max: 2, tier: "common" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.5, min: 10, max: 28, tier: "common" },
      { item: "chipped_tooth", chance: 0.18, tier: "common" },
      { item: "raw_rat_meat", chance: 0.3, tier: "common" },
      { item: "bloodore_ore", chance: 0.1, tier: "uncommon" },
      { item: "rough_gem", chance: 0.12, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.06, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.025, tier: "rare" },
      { item: "cut_gem", chance: 0.05, tier: "rare" },
      { item: "arrow_hearthite", chance: 0.25, min: 10, max: 25, tier: "common" },
      { item: "shard_of_orun", chance: 0.002, tier: "legendary" }
    ]
  },
  "marrow_wraith": {
    "id": "marrow_wraith",
    "name": "Marrow Wraith",
    "icon": "💀",
    "level": 64,
    "hp": 140,
    "acc": 250,
    "def": 18,
    "maxHit": 36,
    "speed": 2200,
    "attackRange": 4,
    "xp": 425,
    "attackStyle": "ranged",
    "weakness": [
      "crush",
      "ranged"
    ],
    "desc": "A remnant that has absorbed the minerals of the deep. Bone without flesh — it hurls splinters of itself from a distance.",
    "drops": [
      { item: "worn_coin", chance: 0.6, min: 14, max: 36, tier: "common" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "wraith_fragment", chance: 0.32, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.08, tier: "rare" },
      { item: "tarnished_amulet", chance: 0.12, tier: "uncommon" },
      { item: "gold_ring", chance: 0.06, tier: "rare" },
      { item: "bloodore_bar", chance: 0.1, tier: "uncommon" },
      { item: "rough_gem", chance: 0.14, min: 1, max: 2, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.05, tier: "rare" },
      { item: "uncut_diamond", chance: 0.01, tier: "rare" },
      { item: "cut_gem", chance: 0.06, tier: "rare" },
      { item: "ring_5", chance: 0.03, tier: "rare" },
      { item: "seed_hearthbloom", chance: 0.04, tier: "rare" },
      { item: "shard_of_orun", chance: 0.005, tier: "legendary" }
    ]
  },
  "marrow_keeper": {
    "id": "marrow_keeper",
    "boss": true,
    "bossHint": "The last of the Underloft, sealed in the Marrow Vault deep in the northeast caves. An endgame trial — reached at the bottom of the long dark.",
    "name": "The Marrow Keeper",
    "icon": "💀",
    "level": 72,
    "hp": 770,
    "acc": 292,
    "def": 55,
    "maxHit": 52,
    "speed": 3500,
    "xp": 1400,
    "attackStyle": "crush",
    "weakness": [
      "slash"
    ],
    "desc": "The thing that was left to watch the vault. It is still watching.",
    "mechanics": [
      { "type": "lifedrain", "frac": 0.4, "tell": "The Keeper draws the marrow from your bones." },
      { "type": "slam", "every": 5, "mult": 2.5, "radius": 1, "windupMs": 2200, "tell": "The Keeper heaves its fists high — the ground beneath you cracks. MOVE!" },
      // The full turning ward, for the endgame trial: its watch shifts through
      // the whole triangle as it falls (blade, then Grace, then arrows), so one
      // loadout can't solve the fight — rotate style to keep exploiting it (T1·07).
      { "type": "wardshift", "styles": ["slash", "magic", "ranged"], "tell": "The Keeper's watch turns to you anew." }
    ],
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      {
        "item": "pet_marrow_keeper",
        "chance": 0.002,
        "tier": "legendary"
      },
      {
        "item": "marrow_keep_plate",
        "chance": 0.05,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.02,
        "tier": "legendary"
      },
      { "item": "armor_9", "chance": 0.04, "tier": "rare" },
      { "item": "boot_9", "chance": 0.04, "tier": "rare" },
      { "item": "worn_coin", "chance": 1, "min": 200, "max": 450, "tier": "always" },
      { "item": "voidstone_bar", "chance": 0.4, "min": 1, "max": 2, "tier": "uncommon" }
    ]
  },
  "deep_golem": {
    "id": "deep_golem",
    "name": "Deepstone Golem",
    "icon": "🗿",
    "level": 60,
    "hp": 310,
    "acc": 238,
    "def": 46,
    "maxHit": 33,
    "speed": 4000,
    "xp": 580,
    "attackStyle": "crush",
    "weakness": [
      "crush",
      "ranged",
      "magic"
    ],
    "desc": "An animated construct of compressed deeprock. Slow, almost unkillable, hits like a falling wall.",
    "drops": [
      { item: "golem_dust", chance: 0.6, min: 1, max: 3, tier: "common" },
      { item: "worn_coin", chance: 0.7, min: 30, max: 80, tier: "always" },
      { item: "cracked_shell", chance: 0.2, tier: "uncommon" },
      { item: "hearthite_ore", chance: 0.25, min: 1, max: 2, tier: "uncommon" },
      { item: "hearthite_bar", chance: 0.12, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.12, tier: "rare" },
      { item: "uncut_ruby", chance: 0.08, tier: "uncommon" },
      { item: "uncut_diamond", chance: 0.02, tier: "rare" },
      { item: "cut_gem", chance: 0.2, min: 1, max: 2, tier: "uncommon" },
      { item: "hammer_9", chance: 0.05, tier: "rare" },
      { item: "shield_9", chance: 0.05, tier: "rare" },
      { item: "shard_of_orun", chance: 0.012, tier: "legendary" }
    ]
  },
  "river_serpent": {
    "id": "river_serpent",
    "name": "River Serpent",
    "icon": "🐲",
    "level": 61,
    "hp": 225,
    "acc": 242,
    "def": 33,
    "maxHit": 35,
    "speed": 2800,
    "xp": 640,
    "attackStyle": "stab",
    "weakness": [
      "slash",
      "ranged"
    ],
    "desc": "An ancient serpent from the Redrun tributaries. The river looks different than it used to.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },
      { item: "serpent_scale", chance: 0.5, min: 1, max: 3, tier: "common" },
      { item: "raw_bear_meat", chance: 0.45, tier: "common" },
      { item: "cracked_shell", chance: 0.2, tier: "uncommon" },
      { item: "eyeless_scale", chance: 0.25, tier: "uncommon" },
      { item: "worn_coin", chance: 0.6, min: 20, max: 55, tier: "common" },
      { item: "hearthite_bar", chance: 0.1, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.08, tier: "uncommon" },
      { item: "uncut_diamond", chance: 0.02, tier: "rare" },
      { item: "cut_gem", chance: 0.15, min: 1, max: 2, tier: "uncommon" },
      { item: "claymore_9", chance: 0.04, tier: "rare" },
      { item: "seed_orunroot", chance: 0.03, tier: "rare" },
      { item: "shard_of_orun", chance: 0.007, tier: "legendary" }
    ]
  },
  "redrun_brigand": {
    "id": "redrun_brigand",
    "name": "Redrun Brigand",
    "icon": "🗡️",
    "level": 63,
    "hp": 215,
    "acc": 246,
    "def": 39,
    "maxHit": 37,
    "speed": 2400,
    "xp": 700,
    "attackStyle": "stab",
    "weakness": [
      "slash"
    ],
    "desc": "An outlaw of the Redrun crossings. Armed, armoured, and motivated.",
    "drops": [
      { item: "worn_coin", chance: 0.95, min: 20, max: 60, tier: "always" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "tarnished_ring", chance: 0.3, tier: "common" },
      { item: "tarnished_amulet", chance: 0.15, tier: "uncommon" },
      { item: "rusty_key", chance: 0.15, tier: "common" },
      { item: "gold_ring", chance: 0.06, tier: "rare" },
      { item: "bloodore_ore", chance: 0.4, min: 1, max: 2, tier: "common" },
      { item: "bloodore_bar", chance: 0.15, tier: "uncommon" },
      { item: "hearthite_ore", chance: 0.08, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.08, tier: "uncommon" },
      { item: "uncut_diamond", chance: 0.015, tier: "rare" },
      { item: "cut_gem", chance: 0.12, tier: "uncommon" },
      { item: "sword_9", chance: 0.04, tier: "rare" },
      { item: "ring_5", chance: 0.04, tier: "rare" },
      { item: "arrow_hearthite", chance: 0.3, min: 12, max: 28, tier: "common" },
      { item: "shard_of_orun", chance: 0.005, tier: "legendary" }
    ]
  },
  "ancient_orc": {
    "id": "ancient_orc",
    "name": "Ancient Orc",
    "icon": "👹",
    "level": 65,
    "hp": 280,
    "acc": 252,
    "def": 42,
    "maxHit": 40,
    "speed": 2600,
    "xp": 870,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "A very old orc warrior. Carries centuries of fighting experience. Approach respectfully.",
    "drops": [
      { item: "orc_tooth", chance: 0.5, min: 1, max: 2, tier: "common" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.7, min: 30, max: 75, tier: "always" },
      { item: "beast_horn", chance: 0.1, tier: "uncommon" },
      { item: "hearthite_ore", chance: 0.3, min: 1, max: 2, tier: "uncommon" },
      { item: "hearthite_bar", chance: 0.12, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.06, tier: "rare" },
      { item: "uncut_ruby", chance: 0.09, tier: "uncommon" },
      { item: "uncut_diamond", chance: 0.02, tier: "rare" },
      { item: "cut_gem", chance: 0.18, min: 1, max: 2, tier: "uncommon" },
      { item: "spear_9", chance: 0.05, tier: "rare" },
      { item: "helm_9", chance: 0.04, tier: "rare" },
      { item: "shard_of_orun", chance: 0.008, tier: "legendary" }
    ]
  },
  "dread_ferryman": {
    "id": "dread_ferryman",
    "name": "The Dread Ferryman",
    "icon": "⛵",
    "level": 98,
    "hp": 1055,
    "acc": 318,
    "def": 60,
    "maxHit": 63,
    "speed": 2400,
    "xp": 1200,
    "attackStyle": "slash",
    "weakness": [
      "stab",
      "crush"
    ],
    "desc": "The ferryman of the Redrun. He has been here longer than the river. He wants payment.",
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      {
        "item": "worn_coin",
        "chance": 1,
        "min": 250,
        "max": 550,
        "tier": "always"
      },
      {
        "item": "waterlogged_coin",
        "chance": 0.55,
        "tier": "common"
      },
      {
        "item": "hearthite_bar",
        "chance": 0.4,
        "min": 1,
        "max": 2,
        "tier": "uncommon"
      },
      {
        "item": "redrun_pearl",
        "chance": 0.12,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.02,
        "tier": "legendary"
      },
      { "item": "ring_8", "chance": 0.04, "tier": "rare" }
    ],
    "boss": true,
    "bossHint": "Climb down into the Ferryman's Cave — a black slot in the lonely hills NORTH of the Redrun crossings, well off the road. He fights you alone in the flooded dark; come well-fed, and bring stab or crush. He takes his toll in your years, and the river answers his oar — step off the black water when it rises.",
    "mechanics": [
      // Signature: THE TOLL. He is owed a fare and he collects it in life — a
      // steady lifedrain that turns a slow fight into a losing one. The unique
      // pressure that makes him distinct: you can't out-attrition him, you have
      // to out-pace him.
      { type: "lifedrain", frac: 0.18, tell: "The Ferryman breathes in as you bleed — the toll is paid in your years." },
      // Oar-Wave — a telegraphed surge of black water every 4th stroke.
      { type: "slam", every: 4, mult: 2.2, radius: 1, windupMs: 2200, tell: "The Ferryman drags his oar through the flood and the black water HEAVES toward you. MOVE!" },
      // Past a third he stops ferrying and starts drowning.
      { type: "enrage", below: 0.3, mult: 1.4, tell: "The Ferryman lets the pole fall — no more crossings tonight, only the drowning." }
    ]
  },
  "aelveth_white_wolf": {
    "id": "aelveth_white_wolf",
    "name": "Aelveth White Wolf",
    "icon": "🐺",
    "level": 15,
    "hp": 75,
    "acc": 18,
    "def": 10,
    "maxHit": 6,
    "speed": 2800,
    "xp": 45,
    "attackStyle": "slash",
    "weakness": [
      "stab"
    ],
    "desc": "Something older and stranger than a hill wolf. It moves without sound and looks at you like it already knows the outcome.",
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },]
  },
  "berric_fighter": {
    "id": "berric_fighter",
    "name": "Berric",
    "icon": "🔨",
    "level": 20,
    "hp": 100,
    "acc": 45,
    "def": 14,
    "maxHit": 13,
    "speed": 3200,
    "xp": 60,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "A smith who spent thirty years shaping iron. His grip remembers every hammer swing.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },]
  },
  "greymane_boar": {
    "id": "greymane_boar",
    "name": "The Greymane Boar",
    "icon": "🐗",
    "level": 25,
    "hp": 145,
    "acc": 50,
    "def": 18,
    "maxHit": 13,
    "speed": 3400,
    "xp": 90,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "The same boar that walked away from three Lodge hunting parties. Scarred, iron-grey, and considerably more patient than you.",
    "drops": [
      { item: "greymane_pelt", chance: 0.6, tier: "common" },
      { item: "greymane_tusk", chance: 0.25, tier: "uncommon" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "raw_boar_meat", chance: 0.5, min: 1, max: 2, tier: "common" },
      { item: "beast_horn", chance: 0.08, tier: "uncommon" },
      { item: "worn_coin", chance: 0.4, min: 3, max: 10, tier: "common" },
      { item: "tanned_leather", chance: 0.18, tier: "common" },
      { item: "seed_coldmoss", chance: 0.08, tier: "uncommon" },
      { item: "rough_gem", chance: 0.06, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.03, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.01, tier: "rare" },
      { item: "spear_4", chance: 0.03, tier: "rare" },
      { item: "shard_of_orun", chance: 0.002, tier: "legendary" }
    ]
  },
  "cult_devotee": {
    "id": "cult_devotee",
    "name": "Cult Devotee",
    "icon": "🧙",
    "level": 32,
    "hp": 120,
    "acc": 75,
    "def": 20,
    "maxHit": 22,
    "speed": 2800,
    "xp": 80,
    "attackStyle": "crush",
    "weakness": [
      "slash"
    ],
    "desc": "A true believer of the Heartmoor Cult. Fights like the seam is worth their life — because to them, it is.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },]
  },
  "ashforge_enforcer": {
    "id": "ashforge_enforcer",
    "name": "Ashforge Enforcer",
    "icon": "⚔️",
    "level": 38,
    "hp": 155,
    "acc": 81,
    "def": 26,
    "maxHit": 22,
    "speed": 2600,
    "xp": 100,
    "attackStyle": "slash",
    "weakness": [
      "crush"
    ],
    "desc": "A trained Brotherhood fighter. Vorn did not come himself, but he sent someone who knows how to finish things.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },]
  },
  "lodge_warden_npc": {
    "id": "lodge_warden_npc",
    "name": "Lodge Warden",
    "icon": "🏹",
    "level": 35,
    "hp": 145,
    "acc": 78,
    "def": 24,
    "maxHit": 22,
    "speed": 2800,
    "xp": 88,
    "attackStyle": "stab",
    "weakness": [
      "slash"
    ],
    "desc": "A Lodge warden sent to seal the seam. Principled. Persistent. Standing exactly between you and what you came for.",
    "drops": [
      { item: "bones", chance: 1, tier: "always" },]
  },
  "hollow_warden": {
    "id": "hollow_warden",
    "boss": true,
    "bossHint": "Guards the Hollow Barrows — a cave mouth lost in the far eastern woods beyond the Redrun, found only by those who wander off the road. A first true boss; bring steady gear and a stock of food.",
    "name": "The Hollow Warden",
    "icon": "💀",
    "level": 38,
    "hp": 265,
    "acc": 81,
    "def": 28,
    "maxHit": 18,
    "speed": 3000,
    "xp": 450,
    "attackStyle": "slash",
    "weakness": [
      "crush"
    ],
    "desc": "An armoured revenant. It carries a weapon from before smithing had names.",
    "mechanics": [
      { "type": "slam", "every": 4, "mult": 2, "radius": 1, "windupMs": 2400, "tell": "The Hollow Warden raises its ancient blade over the ground you stand on — Grave Slam. MOVE!" },
      { "type": "enrage", "below": 0.3, "mult": 1.5, "tell": "The Warden's hollow eyes blaze with old fury." },
      // A first taste of a turning ward: its dead armour re-sets as it falls, so
      // the crush that opened the fight glances by the end — bring a stab weapon
      // to swap to. Teaches the mechanic within a melee-only kit (T1·07).
      { "type": "wardshift", "styles": ["crush", "stab"], "tell": "The Warden's plates grind and re-seat — its guard has turned." }
    ],
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      {
        "item": "pet_hollow_warden",
        "chance": 0.002,
        "tier": "legendary"
      },
      {
        "item": "blade_of_graves",
        "chance": 0.05,
        "tier": "legendary"
      },
      {
        "item": "marrow_flail",
        "chance": 0.05,
        "tier": "legendary"
      },
      {
        "item": "ashward_shield",
        "chance": 0.05,
        "tier": "legendary"
      },
      {
        "item": "greymail_plate",
        "chance": 0.04,
        "tier": "legendary"
      },
      {
        "item": "barrow_helm",
        "chance": 0.05,
        "tier": "legendary"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.05,
        "tier": "legendary"
      },
      {
        "item": "worn_coin",
        "chance": 1,
        "min": 80,
        "max": 200,
        "tier": "always"
      },
      {
        "item": "ribstone_bar",
        "chance": 0.4,
        "tier": "common"
      },
      {
        "item": "bloodore_bar",
        "chance": 0.15,
        "tier": "uncommon"
      }
    ]
  },
  "spine_warlord": {
    "id": "spine_warlord",
    "boss": true,
    "bossHint": "Waits at the bottom of the Spine Vault, broken open in the high northern pass. A hard fight — come well-fed and well-armed.",
    "name": "The Spine Warlord",
    "icon": "👹",
    "level": 60,
    "hp": 440,
    "acc": 190,
    "def": 45,
    "maxHit": 31,
    "speed": 2800,
    "xp": 900,
    "attackStyle": "crush",
    "weakness": [
      "stab"
    ],
    "desc": "An orc warlord who refused to die. The Spine took him in instead.",
    "mechanics": [
      { "type": "slam", "every": 4, "mult": 2.2, "radius": 1, "windupMs": 2000, "tell": "The Warlord bellows and leaps — the ground you stand on darkens. MOVE!" },
      { "type": "enrage", "below": 0.25, "mult": 1.6, "tell": "The Spine Warlord refuses to fall." },
      // Half-blooded, the warlord calls his pack — two ridge wolves join the
      // fight, turning a duel into a scrap you have to survive on more than one
      // front (T1·07). They are sent home when he falls.
      { "type": "summon", "below": 0.5, "flag": "warlord_pack", "tell": "The Warlord throws back his head and HOWLS — the ridge answers. Wolves close from the dark." }
    ],
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      {
        "item": "pet_spine_warlord",
        "chance": 0.002,
        "tier": "legendary"
      },
      {
        "item": "orun_reaver",
        "chance": 0.04,
        "tier": "legendary"
      },
      {
        "item": "coldbone_bow",
        "chance": 0.04,
        "tier": "legendary"
      },
      {
        "item": "stoneguard_plate",
        "chance": 0.04,
        "tier": "legendary"
      },
      {
        "item": "ironveil_legs",
        "chance": 0.04,
        "tier": "legendary"
      },
      {
        "item": "warden_ring",
        "chance": 0.05,
        "tier": "legendary"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.04,
        "tier": "legendary"
      },
      {
        "item": "worn_coin",
        "chance": 1,
        "min": 100,
        "max": 250,
        "tier": "always"
      },
      {
        "item": "bloodore_bar",
        "chance": 0.4,
        "tier": "common"
      }
    ]
  },
  "bog_warden": {
    "id": "bog_warden",
    "boss": true,
    "bossHint": "Holds the deep of the Bog Barrow, down in the western moor past the Heartmoor pools. Watch your footing and your health in the dark.",
    "name": "The Bog Warden",
    "icon": "🧟",
    "level": 42,
    "hp": 485,
    "acc": 87,
    "def": 38,
    "maxHit": 16,
    "speed": 3200,
    "xp": 800,
    "attackStyle": "slash",
    "weakness": [
      "crush"
    ],
    "desc": "Something that was buried in the mire with purpose. It has been here longer than the settlement that forgot it.",
    "mechanics": [
      { "type": "lifedrain", "frac": 0.5, "tell": "The Bog Warden drinks deep of your strength." },
      { "type": "selfheal", "below": 0.4, "amount": 50, "tell": "The mire surges up and knits the Bog Warden whole." },
      // A wide reaping arc it sweeps toward you — its one positional threat, so
      // an attrition fight also asks you to read the ground (T1·07). Dodge by
      // stepping to its flank, not straight back.
      { "type": "cleave", "every": 4, "mult": 2.4, "length": 3, "windupMs": 2300, "tell": "The Bog Warden winds up a wide, dripping sweep — get to its FLANK!" }
    ],
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      {
        "item": "pet_bog_warden",
        "chance": 0.002,
        "tier": "legendary"
      },
      {
        "item": "worn_coin",
        "chance": 1,
        "min": 80,
        "max": 200,
        "tier": "always"
      },
      {
        "item": "ribstone_bar",
        "chance": 0.5,
        "tier": "common"
      },
      {
        "item": "ashiron_bar",
        "chance": 0.8,
        "tier": "common"
      },
      {
        "item": "bog_ward_helm",
        "chance": 0.05,
        "tier": "rare"
      },
      {
        "item": "shard_of_orun",
        "chance": 0.015,
        "tier": "legendary"
      }
    ]
  },

  // === ROAD OUTLAWS — the lawless humanoids of the roads ====================
  // New low-to-mid humanoid foes that infest the roads between Ironvale and the
  // regions. OSRS-style loot, drawn entirely from existing items: coins (worn
  // coins), stolen low-tier weapons, arrows, food, herbs, leather and gems.
  "footpad": {
    id: "footpad", name: "Footpad", icon: "🗡️", level: 4, hp: 25,
    acc: 7, def: 3, maxHit: 2, speed: 2800, xp: 16, attackStyle: "stab",
    weakness: ["slash", "ranged"],
    desc: "A nervy cutpurse working the hill roads — quick with a knife, quicker to run.",
    drops: [
      { item: "worn_coin", chance: 0.85, min: 1, max: 3, tier: "always" },
      { item: "bent_nail", chance: 0.25, tier: "common" },
      { item: "scrap_cloth", chance: 0.2, tier: "common" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "dagger_1", chance: 0.06, tier: "uncommon" },
      { item: "ashfin_cooked", chance: 0.15, tier: "common" },
      { item: "plant_fiber", chance: 0.2, min: 1, max: 2, tier: "common" },
      { item: "tarnished_ring", chance: 0.05, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.006, tier: "rare" },
    ],
  },
  "cutpurse": {
    id: "cutpurse", name: "Cutpurse", icon: "🗡️", level: 7, hp: 40,
    acc: 10, def: 5, maxHit: 4, speed: 2700, xp: 26, attackStyle: "stab",
    weakness: ["slash"],
    desc: "A pickpocket turned to the blade when purses got scarce. Light fingers, lighter conscience.",
    drops: [
      { item: "bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.9, min: 1, max: 5, tier: "always" },
      { item: "scrap_cloth", chance: 0.2, tier: "common" },
      { item: "rusty_key", chance: 0.12, tier: "common" },
      { item: "glass_vial", chance: 0.1, tier: "common" },
      { item: "herb_ashweed", chance: 0.1, tier: "common" },
      { item: "seed_ashweed", chance: 0.08, tier: "common" },
      { item: "rat_meat_cooked", chance: 0.12, tier: "common" },
      { item: "tarnished_ring", chance: 0.06, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.008, tier: "rare" },
    ],
  },
  "bandit": {
    id: "bandit", name: "Bandit", icon: "🗡️", level: 12, hp: 65,
    acc: 15, def: 9, maxHit: 5, speed: 2600, xp: 48, attackStyle: "slash",
    weakness: ["stab"],
    desc: "A road bandit, armed with whatever the last traveller was carrying. They work in numbers.",
    drops: [
      { item: "worn_coin", chance: 0.95, min: 2, max: 7, tier: "always" },
      { item: "bent_nail", chance: 0.2, tier: "common" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "sword_1", chance: 0.08, tier: "uncommon" },
      { item: "dagger_1", chance: 0.06, tier: "uncommon" },
      { item: "arrow_knucklestone", chance: 0.3, min: 5, max: 12, tier: "common" },
      { item: "hill_stew", chance: 0.12, tier: "common" },
      { item: "tanned_leather", chance: 0.1, tier: "common" },
      { item: "tarnished_ring", chance: 0.08, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.01, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.003, tier: "rare" },
    ],
  },
  "poacher": {
    id: "poacher", name: "Poacher", icon: "🏹", level: 16, hp: 85,
    acc: 19, def: 11, maxHit: 6, speed: 2500, xp: 74, attackStyle: "stab",
    weakness: ["crush"],
    desc: "A wood-thief who hunts the Lodge's game and the Lodge's purse alike. Deadly with a bow.",
    drops: [
      { item: "bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.7, min: 1, max: 5, tier: "always" },
      { item: "broken_arrow", chance: 0.35, tier: "common" },
      { item: "crude_shortbow", chance: 0.08, tier: "uncommon" },
      { item: "arrow_knucklestone", chance: 0.4, min: 8, max: 18, tier: "common" },
      { item: "boar_hide", chance: 0.2, tier: "common" },
      { item: "wolf_pelt", chance: 0.15, tier: "common" },
      { item: "venison", chance: 0.12, tier: "common" },
      { item: "hatchet_1", chance: 0.05, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.012, tier: "uncommon" },
    ],
  },
  "highwayman": {
    id: "highwayman", name: "Highwayman", icon: "🗡️", level: 22, hp: 115,
    acc: 47, def: 16, maxHit: 11, speed: 2500, xp: 120, attackStyle: "slash",
    weakness: ["stab", "ranged"],
    desc: "A mounted robber fallen on hard times and harder methods. Stands his ground for a fat purse.",
    drops: [
      { item: "bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.95, min: 3, max: 9, tier: "always" },
      { item: "scrap_cloth", chance: 0.18, tier: "common" },
      { item: "rusty_key", chance: 0.12, tier: "common" },
      { item: "sword_3", chance: 0.06, tier: "uncommon" },
      { item: "spear_1", chance: 0.06, tier: "uncommon" },
      { item: "arrow_ashiron", chance: 0.25, min: 5, max: 14, tier: "common" },
      { item: "forest_roast", chance: 0.12, tier: "common" },
      { item: "ring_1", chance: 0.03, tier: "rare" },
      { item: "tarnished_amulet", chance: 0.08, tier: "uncommon" },
      { item: "rough_gem", chance: 0.05, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.02, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.006, tier: "rare" },
    ],
  },
  "outlaw_archer": {
    id: "outlaw_archer", name: "Outlaw Archer", icon: "🏹", level: 26, hp: 125,
    acc: 51, def: 18, maxHit: 11, speed: 2300, attackRange: 4, xp: 150, attackStyle: "ranged",
    weakness: ["crush"],
    desc: "A marksman gone over to the road gangs. Picks off the careless from cover.",
    drops: [
      { item: "bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.9, min: 2, max: 8, tier: "always" },
      { item: "broken_arrow", chance: 0.4, tier: "common" },
      { item: "shortbow", chance: 0.06, tier: "uncommon" },
      { item: "arrow_ashiron", chance: 0.5, min: 10, max: 22, tier: "common" },
      { item: "arrow_knucklestone", chance: 0.3, min: 10, max: 25, tier: "common" },
      { item: "tanned_leather", chance: 0.15, tier: "common" },
      { item: "cured_leather", chance: 0.05, tier: "uncommon" },
      { item: "sinew", chance: 0.25, tier: "common" },
      { item: "rng_hood_1", chance: 0.02, tier: "rare" },
      { item: "rng_legs_1", chance: 0.02, tier: "rare" },
      { item: "tarnished_ring", chance: 0.08, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.02, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.006, tier: "rare" },
    ],
  },
  "cutthroat": {
    id: "cutthroat", name: "Cutthroat", icon: "🗡️", level: 32, hp: 160,
    acc: 75, def: 24, maxHit: 18, speed: 2400, xp: 210, attackStyle: "slash",
    weakness: ["stab"],
    desc: "A killer the other outlaws step around. Past robbery now — does it for the doing.",
    drops: [
      { item: "worn_coin", chance: 0.95, min: 4, max: 12, tier: "always" },
      { item: "scrap_cloth", chance: 0.18, tier: "common" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "sword_4", chance: 0.05, tier: "rare" },
      { item: "dagger_3", chance: 0.06, tier: "uncommon" },
      { item: "hammer_3", chance: 0.05, tier: "uncommon" },
      { item: "ashiron_ore", chance: 0.2, min: 1, max: 2, tier: "common" },
      { item: "arrow_ashiron", chance: 0.3, min: 8, max: 18, tier: "common" },
      { item: "bone_broth", chance: 0.1, tier: "common" },
      { item: "tarnished_amulet", chance: 0.1, tier: "uncommon" },
      { item: "rough_gem", chance: 0.06, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.02, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.006, tier: "rare" },
    ],
  },
  "marauder": {
    id: "marauder", name: "Marauder", icon: "🪓", level: 40, hp: 210,
    acc: 83, def: 30, maxHit: 15, speed: 2500, xp: 320, attackStyle: "crush",
    weakness: ["stab", "ranged"],
    desc: "A raider who rides the lawless edges of the map, taking whole carts and the drovers with them.",
    drops: [
      { item: "worn_coin", chance: 0.95, min: 5, max: 16, tier: "always" },
      { item: "bent_nail", chance: 0.15, tier: "common" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "claymore_3", chance: 0.04, tier: "rare" },
      { item: "hammer_4", chance: 0.04, tier: "rare" },
      { item: "ashiron_bar", chance: 0.1, tier: "uncommon" },
      { item: "ribstone_ore", chance: 0.12, min: 1, max: 2, tier: "common" },
      { item: "cured_leather", chance: 0.1, tier: "common" },
      { item: "tarnished_amulet", chance: 0.1, tier: "uncommon" },
      { item: "gold_ring", chance: 0.03, tier: "rare" },
      { item: "rough_gem", chance: 0.08, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.03, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.01, tier: "rare" },
      { item: "cut_gem", chance: 0.02, tier: "rare" },
    ],
  },
  "outlaw_captain": {
    id: "outlaw_captain", name: "Outlaw Captain", icon: "🗡️", level: 48, hp: 310,
    acc: 91, def: 38, maxHit: 18, speed: 2300, xp: 520, attackStyle: "slash",
    weakness: ["stab", "ranged"],
    desc: "The one the camp answers to. Better armed, better fed, and worth the trouble — if you can take him.",
    drops: [
      { item: "worn_coin", chance: 1, min: 10, max: 28, tier: "always" },
      { item: "rusty_key", chance: 0.2, tier: "common" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "sword_6", chance: 0.03, tier: "rare" },
      { item: "claymore_4", chance: 0.03, tier: "rare" },
      { item: "ring_3", chance: 0.04, tier: "rare" },
      { item: "gold_ring", chance: 0.05, tier: "rare" },
      { item: "tarnished_amulet", chance: 0.12, tier: "uncommon" },
      { item: "arrow_ashiron", chance: 0.5, min: 15, max: 30, tier: "common" },
      { item: "ribstone_bar", chance: 0.06, tier: "uncommon" },
      { item: "rough_gem", chance: 0.12, min: 1, max: 2, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.03, tier: "rare" },
      { item: "uncut_diamond", chance: 0.006, tier: "rare" },
      { item: "cut_gem", chance: 0.04, tier: "rare" },
    ],
  },
  // === The flagship boss: the toughest thing in Varath. ===================
  "ashen_wyrm": {
    id: "ashen_wyrm", name: "Cindrath, the Ashen Wyrm", level: 90, hp: 1365,
    acc: 360, def: 80, maxHit: 58, speed: 3000, xp: 3200, attackStyle: "crush",
    weakness: ["stab"],
    boss: true,
    bossHint: "Varath's deadliest. Cindrath lairs in the deepest gallery of the Marrow Deeps, the cave country far in the northeast — Cindrath's Roost. Bring a stabbing weapon for its hide, and more food than you think you'll need.",
    desc: "The last great wyrm of Varath, coiled in the black heat of the Marrow Deeps where it long ago burrowed away from the sky. Its scales run forge-hot and its patience is long gone. Bring a stabbing weapon and more food than you think you'll need.",
    mechanics: [
      // 1. Inferno Breath — a telegraphed, devastating breath every 4th swing.
      { type: "slam", every: 4, mult: 2.4, radius: 1, windupMs: 2000, tell: "Cindrath rears back, throat glowing — INFERNO BREATH sweeps where you stand. MOVE!" },
      // 2. Wrath — past 35% HP it enrages, every blow harder.
      { type: "enrage", below: 0.35, mult: 1.4, tell: "Cindrath shrieks, wounds blazing white — its fury redoubles!" },
      // 3. Molten Scales — your melee blows sear you back (ranged is spared).
      { type: "recoil", frac: 0.25, tell: "Your blow rings off Cindrath's molten scales and the heat sears you." },
      // 4. Wyrmhide — thick scales shrug off most melee UNLESS you hit its stab weakness.
      { type: "scaleguard", reduce: 0.4 },
    ],
    drops: [
      { item: "big_bones", chance: 1, tier: "always" },
      // A hatchling that imprints on its parent's killer — the rarest drop.
      { item: "pet_ashen_wyrm", chance: 0.001, tier: "legendary" },
      // The Wyrmscale set + Wyrmfang: equal, high rates (Barrows-style).
      { item: "wyrm_helm", chance: 0.03, tier: "legendary" },
      { item: "wyrm_body", chance: 0.03, tier: "legendary" },
      { item: "wyrm_legs", chance: 0.03, tier: "legendary" },
      { item: "wyrm_shield", chance: 0.03, tier: "legendary" },
      { item: "wyrm_blade", chance: 0.03, tier: "legendary" },
      // A dry streak still pays: coin, bars, gems, and the story shard.
      { item: "worn_coin", chance: 1, min: 600, max: 1500, tier: "always" },
      { item: "hearthite_bar", chance: 0.5, min: 1, max: 3, tier: "uncommon" },
      { item: "cut_gem", chance: 0.4, min: 1, max: 2, tier: "uncommon" },
      { item: "shard_of_orun", chance: 0.05, tier: "legendary" },
    ],
  },
  // === The Boneman: a mid-tier quest boss — a serial killer's lair. ==========
  // === The Ninth Bell questline: the quartermaster's hired muscle, and the
  // quartermaster himself — Varath's ENTRY boss (combat 23), built to teach
  // bossing: one clean telegraphed slam to step off, one enrage to respect.
  "hired_blade": {
    id: "hired_blade", name: "Hired Blade", level: 15, hp: 48,
    acc: 42, def: 12, maxHit: 5, speed: 2800, xp: 85, attackStyle: "slash",
    weakness: ["stab"],
    desc: "Coin-bought muscle in unmarked leathers. Whoever pays them buys their silence too — but not their loyalty.",
    drops: [
      { item: "worn_coin", chance: 1, min: 15, max: 40, tier: "always" },
      { item: "health_elixir", chance: 0.25, tier: "uncommon" },
    ],
  },
  "quartermaster_brann": {
    id: "quartermaster_brann", name: "Quartermaster Brann", level: 23, hp: 190,
    acc: 78, def: 26, maxHit: 8, speed: 3200, xp: 420, attackStyle: "crush",
    weakness: ["crush"],
    boss: true,
    bossHint: "The Ironvale quartermaster who robbed his own pay-chest and framed a better man for it. He guards his secret at the Coldstep Shack, in the far north-west where the maps run out. A crushing weapon dents his stolen plate best — and when he marks the ground, MOVE.",
    desc: "Ironvale's quartermaster, in guard plate he signed out and never signed back. He kept the ledgers, so he knows exactly what a person's silence costs — and what a shield swung in anger can do. Step off the ground he marks.",
    mechanics: [
      // 1. Pay-Chest Slam — the teaching mechanic: a long, generous windup on
      //    a marked tile. New bossers learn the golden rule: feet move first.
      { type: "slam", every: 4, mult: 2.2, radius: 1, windupMs: 2800, tell: "Brann heaves his tower shield overhead — the ground you stand on darkens. STEP OFF IT!" },
      // 2. Cornered — below a third he stops holding back.
      { type: "enrage", below: 0.34, mult: 1.35, tell: "Brann stops pretending this is discipline — cornered now, and swinging like it." },
    ],
    drops: [
      { item: "worn_coin", chance: 1, min: 60, max: 140, tier: "always" },
      { item: "health_elixir", chance: 0.5, tier: "common" },
      { item: "battle_ration", chance: 0.4, tier: "common" },
      { item: "bloodore_arrow", chance: 0.35, min: 6, max: 14, tier: "common" },
      { item: "cut_gem", chance: 0.2, tier: "uncommon" },
      // The chase pieces for an entry boss: half a watchman's kit. Rare enough
      // that the set is a real hunt (~1/33 a piece, a session or two of trips),
      // still the friendliest unique rate any boss offers.
      { item: "watchmans_buckler", chance: 0.03, tier: "rare" },
      { item: "watchmans_sallet", chance: 0.03, tier: "rare" },
      // And the first pet most players will ever hunt — 1/333 keeps it a real
      // brag, while staying the most generous boss-pet rate in the game
      // (the Boneman's is 1/500), because this is where the itch gets taught.
      { item: "pet_brann", chance: 0.003, tier: "legendary" },
    ],
  },
  "boneman": {
    id: "boneman", name: "The Boneman", level: 69, hp: 750,
    acc: 210, def: 58, maxHit: 30, speed: 3600, xp: 1400, attackStyle: "slash",
    weakness: ["crush"],
    boss: true,
    bossHint: "A serial killer who hunts Varath's quiet roads. Bone-cairns mark his trail, pointing into the deep western wood. The Ironvale watch will set you after him — bring a crushing weapon to shatter his bone armour.",
    desc: "A gaunt thing in a mask of stitched faces, dragging a long saw it never sets down. It has hunted the roads of Varath for years, taking the bones of those it kills and wearing them. Crushing weapons shatter its grisly armour best.",
    mechanics: [
      // 1. Bone Cleave — a wide, telegraphed saw stroke every 5th swing.
      { type: "slam", every: 5, mult: 2.0, radius: 1, windupMs: 2200, tell: "The Boneman hauls the saw back over his shoulder — BONE CLEAVE arcs at your feet. MOVE!" },
      // 2. Marrow Feast — once, below 45% HP, he feeds on his trophies and mends.
      { type: "selfheal", below: 0.45, amount: 80, tell: "The Boneman cracks a bone and sucks the marrow — his wounds knit shut!" },
    ],
    drops: [
      { item: "big_bones", chance: 1, tier: "always" },
      // A grim little echo of him that follows the victor — the rarest drop.
      { item: "pet_boneman", chance: 0.002, tier: "legendary" },
      // The Bonewrought set + the Bonesaw, equal Barrows-style rates.
      { item: "bone_helm", chance: 0.04, tier: "rare" },
      { item: "bone_body", chance: 0.04, tier: "rare" },
      { item: "bone_legs", chance: 0.04, tier: "rare" },
      { item: "bone_shield", chance: 0.04, tier: "rare" },
      { item: "bonesaw", chance: 0.04, tier: "rare" },
      // A dry run still pays: coin, a bone trophy, gems, and seeds to sell.
      { item: "worn_coin", chance: 1, min: 200, max: 500, tier: "always" },
      { item: "marrow_shard", chance: 0.6, min: 1, max: 3, tier: "uncommon" },
      { item: "cut_gem", chance: 0.3, min: 1, max: 2, tier: "uncommon" },
      { item: "hearthite_bar", chance: 0.25, min: 1, max: 2, tier: "uncommon" },
      { item: "seed_bloodberry", chance: 0.4, min: 1, max: 3, tier: "uncommon" },
    ],
  },
  // === The Green Baron: a mid-tier RANGED quest boss — the outlaws' fallen
  // hero. Once the greenwood's protector, now a robber-king who bleeds the poor
  // he claims to shield. Fights from range; weak to a crushing rush up close. ==
  "green_baron": {
    id: "green_baron", name: "The Green Baron", icon: "🏹", level: 58, hp: 530,
    acc: 185, def: 48, maxHit: 27, speed: 2500, attackRange: 5, xp: 850, attackStyle: "ranged",
    weakness: ["crush"],
    boss: true,
    bossHint: "The outlaw legend of the Greyoak wood — a marksman who styled himself a hero and became worse than the men he hunted. Maret of the Lodge will set you on him. Close the distance fast: he is deadly at range and brittle in a crushing grip.",
    desc: "A tall figure in weathered greens, a black-fletched longbow never far from full draw. They sing songs about who he used to be. He collects the coins off the songs, and the throats of those who won't pay.",
    mechanics: [
      // 1. Aimed Shot — a telegraphed, doubled arrow every 4th attack.
      { type: "heavy", every: 4, mult: 2.0, tell: "The Green Baron nocks a black arrow and draws to the ear — AIMED SHOT!" },
      // 2. Waxed Greens — a poacher's oiled leathers turn a glancing blade; only
      //    the crushing weakness he's brittle to gets full purchase. Rewards
      //    closing with a mace/hammer instead of hacking at range.
      { type: "scaleguard", reduce: 0.3 },
      // 3. Cornered — below 30% HP he turns vicious, hitting harder.
      { type: "enrage", below: 0.3, mult: 1.5, tell: "The Baron laughs and stops playing the hero — every shot for the kill now!" },
    ],
    drops: [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "pet_green_baron", chance: 0.002, tier: "legendary" },
      // The Greenhood set + the Baron's Yew, Barrows-style equal rates.
      { item: "greenhood_hood", chance: 0.04, tier: "rare" },
      { item: "greenhood_cloak", chance: 0.04, tier: "rare" },
      { item: "greenhood_chaps", chance: 0.04, tier: "rare" },
      { item: "greenhood_boots", chance: 0.04, tier: "rare" },
      { item: "baron_longbow", chance: 0.04, tier: "rare" },
      { item: "worn_coin", chance: 1, min: 150, max: 400, tier: "always" },
      { item: "arrow_hearthite", chance: 0.5, min: 15, max: 40, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.5, min: 1, max: 3, tier: "uncommon" },
      { item: "cut_gem", chance: 0.3, min: 1, max: 2, tier: "uncommon" },
      { item: "seed_bloodberry", chance: 0.4, min: 1, max: 3, tier: "uncommon" },
    ],
  },
  // === The Hollow Prophet: a mid-tier DEVOTION quest boss — the Heartmoor
  // cult's founder, hollowed out by the power he stole from Orun's seam. He
  // smites from range; weak to a fast bow that never lets him settle. ==========
  "hollow_prophet": {
    id: "hollow_prophet", name: "The Hollow Prophet", icon: "🔮", level: 62, hp: 615,
    acc: 200, def: 52, maxHit: 32, speed: 2600, attackRange: 5, xp: 950, attackStyle: "magic",
    weakness: ["ranged"],
    boss: true,
    bossHint: "The mad archmage who founded the Heartmoor cult and hollowed himself pouring Orun's stolen light through his own bones. Calder will point you to his rite. Bring a bow — he mends what melee opens, but ranged shots hound him down.",
    desc: "A gaunt man in hex-woven robes, eyes gone to pale fire. He speaks to a god that stopped answering long ago, and the seam speaks back through the hole he burned in himself. What comes out is not mercy.",
    mechanics: [
      // 1. Hollow Smite — a telegraphed, doubled bolt of stolen light every 4th cast.
      { type: "heavy", every: 4, mult: 2.0, tell: "The Hollow Prophet raises both hands and the air goes white — HOLLOW SMITE!" },
      // 2. Borrowed Light — once, below 40% HP, he drinks from the seam and mends.
      { type: "selfheal", below: 0.4, amount: 75, tell: "The Prophet opens the hole in himself wider — Orun's stolen light knits his wounds shut!" },
    ],
    drops: [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "pet_hollow_prophet", chance: 0.002, tier: "legendary" },
      // The Prophet's Regalia + the Hollow Staff, Barrows-style equal rates.
      { item: "prophet_hood", chance: 0.04, tier: "rare" },
      { item: "prophet_robe", chance: 0.04, tier: "rare" },
      { item: "prophet_skirt", chance: 0.04, tier: "rare" },
      { item: "prophet_sandals", chance: 0.04, tier: "rare" },
      { item: "prophet_staff", chance: 0.04, tier: "rare" },
      { item: "worn_coin", chance: 1, min: 200, max: 500, tier: "always" },
      { item: "hex_cloth", chance: 0.6, min: 1, max: 3, tier: "uncommon" },
      { item: "shard_of_orun", chance: 0.04, tier: "legendary" },
      { item: "marrow_shard", chance: 0.5, min: 1, max: 3, tier: "uncommon" },
      { item: "cut_gem", chance: 0.3, min: 1, max: 2, tier: "uncommon" },
      { item: "seed_duskshade", chance: 0.4, min: 1, max: 3, tier: "uncommon" },
    ],
  },

  // === THE ASHEN HOLLOW — a level 30-40 witch-coven quest boss and her acolytes.
  // A hedge-coven bound the wood-verge hollow with hex-wards and took the folk
  // who wandered in. Both are casters (weak to ranged), so a bow or bolt is the
  // clean answer — the Widow especially mends what melee opens. =================
  "hollow_hexling": {
    id: "hollow_hexling", name: "Hollow Hexling", icon: "🧿", level: 26, hp: 90,
    acc: 62, def: 22, maxHit: 8, speed: 3200, attackRange: 4, xp: 60, attackStyle: "magic",
    weakness: ["ranged"],
    desc: "A coven-acolyte in ash-daubed rags, half-hollowed already by the wards she tends. She flings guttering hex-fire and mutters names that aren't hers anymore.",
    drops: [
      { item: "bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.8, min: 6, max: 18, tier: "always" },
      { item: "scrap_cloth", chance: 0.3, tier: "common" },
      { item: "hex_cloth", chance: 0.14, tier: "uncommon" },
      { item: "forage_nightshade", chance: 0.12, tier: "common" },
      { item: "seed_duskshade", chance: 0.1, min: 1, max: 2, tier: "uncommon" },
      { item: "rough_gem", chance: 0.06, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.03, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" },
    ],
  },
  "ashen_widow": {
    "poison": 5,
    id: "ashen_widow", name: "The Ashen Widow", icon: "🧙", level: 35, hp: 420,
    acc: 155, def: 42, maxHit: 20, speed: 2700, attackRange: 5, xp: 680, attackStyle: "magic",
    weakness: ["ranged"],
    boss: true,
    bossHint: "The hedge-witch who bound the wood-verge hollow and took the folk who wandered in. Calla the hedge-woman — her own coven-sister once — will set you on the path. Bring a bow: she marks the ground with a hex-circle before it burns (step off it), and she mends what melee opens, but ranged shots run her down.",
    desc: "A tall woman in ash-grey, her face kind until it isn't. She calls herself the least of three sisters, and speaks of a Mother in the deep bog as though the words themselves keep her warm. The hollow bends to her the way a room bends toward a fire.",
    mechanics: [
      // Hex-Circle — a telegraphed ring of hexfire at your feet every 4th cast; step off it.
      { type: "slam", every: 4, mult: 2.0, radius: 1, windupMs: 2200, tell: "The Widow sweeps her besom low and rings the ground at your feet in cold fire — the HEX-CIRCLE is closing. MOVE!" },
      // Coven-Fire — once, below 40% HP, she draws on the wards and mends.
      { type: "selfheal", below: 0.4, amount: 55, tell: "The Widow throws her arms wide and the ward-candles gutter — the coven-fire pours into her wounds!" },
    ],
    drops: [
      { item: "big_bones", chance: 1, tier: "always" },
      // Her regalia — the besom and the hat, at a Barrows-ish rate.
      { item: "widow_staff", chance: 0.05, tier: "rare" },
      { item: "ashen_witch_hat", chance: 0.05, tier: "rare" },
      { item: "worn_coin", chance: 1, min: 120, max: 300, tier: "always" },
      { item: "hex_cloth", chance: 0.5, min: 1, max: 3, tier: "uncommon" },
      { item: "forage_nightshade", chance: 0.4, min: 1, max: 3, tier: "uncommon" },
      { item: "seed_duskshade", chance: 0.35, min: 1, max: 2, tier: "uncommon" },
      { item: "rough_gem", chance: 0.3, min: 1, max: 2, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.12, tier: "rare" },
      { item: "marrow_shard", chance: 0.2, tier: "uncommon" },
      { item: "shard_of_orun", chance: 0.02, tier: "legendary" },
    ],
  },

  // === SETTLEMENT GUARDS — attackable, but NOT aggressive ===================
  // OSRS-style town guards: they stand watch and never strike first (they're
  // left out of the AGGRESSIVE set in worldCore), so you can walk the streets in
  // peace — but pick a fight and they answer with steel. Solid defence makes
  // them a deliberate target, and they pay out in coin, gems and the odd ring.
  "town_guard": {
    id: "town_guard", name: "Settlement Guard", icon: "🛡️", level: 21, hp: 120,
    acc: 48, def: 26, maxHit: 9, speed: 2800, xp: 90, attackStyle: "stab",
    weakness: ["crush", "magic"],
    desc: "A local watchman keeping the peace at the settlement's edge. Leave them be and they'll leave you be — raise a hand, and they raise one back.",
    drops: [
      { item: "worn_coin", chance: 1, min: 8, max: 20, tier: "always" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "rusty_key", chance: 0.2, tier: "common" },
      { item: "scrap_cloth", chance: 0.15, tier: "common" },
      { item: "sword_3", chance: 0.05, tier: "uncommon" },
      { item: "helm_3", chance: 0.04, tier: "uncommon" },
      { item: "tarnished_ring", chance: 0.12, tier: "common" },
      { item: "tarnished_amulet", chance: 0.08, tier: "uncommon" },
      { item: "rough_gem", chance: 0.06, tier: "uncommon" },
      { item: "uncut_sapphire", chance: 0.05, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.02, tier: "rare" },
      { item: "gold_ring", chance: 0.02, tier: "rare" },
      { item: "shard_of_orun", chance: 0.001, tier: "legendary" },
    ],
  },
  "ironvale_guard": {
    id: "ironvale_guard", name: "Ironvale Guard", icon: "⚔️", level: 38, hp: 200,
    acc: 84, def: 40, maxHit: 16, speed: 2600, xp: 240, attackStyle: "slash",
    weakness: ["stab", "magic"],
    desc: "A drilled soldier of the Ironvale watch, mail-clad and unbothered. The city's law made flesh — not to be picked at lightly, but worth the trouble if you can take one.",
    drops: [
      { item: "worn_coin", chance: 1, min: 20, max: 55, tier: "always" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "rusty_key", chance: 0.22, tier: "common" },
      { item: "sword_4", chance: 0.05, tier: "uncommon" },
      { item: "helm_3", chance: 0.05, tier: "uncommon" },
      { item: "armor_6", chance: 0.02, tier: "rare" },
      { item: "ring_3", chance: 0.05, tier: "uncommon" },
      { item: "tarnished_amulet", chance: 0.12, tier: "common" },
      { item: "gold_ring", chance: 0.05, tier: "rare" },
      { item: "uncut_sapphire", chance: 0.08, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.04, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.015, tier: "rare" },
      { item: "cut_gem", chance: 0.04, tier: "rare" },
      { item: "uncut_diamond", chance: 0.004, tier: "rare" },
      { item: "shard_of_orun", chance: 0.002, tier: "legendary" },
    ],
  },

  // === FARMERS — killed for seeds (OSRS Master-Farmer style) ================
  // Passive (not in AGGRESSIVE), so they work the fields until you rob them. The
  // whole point is the seed satchel: field hands drop the common sowing seeds,
  // the master farmer the rare herb and tree seeds you can't easily buy.
  "field_farmer": {
    id: "field_farmer", name: "Field Farmer", icon: "🧑‍🌾", level: 18, hp: 90,
    acc: 22, def: 12, maxHit: 6, speed: 2900, xp: 85, attackStyle: "crush",
    weakness: ["stab"],
    desc: "A weathered farmhand working the settlement plots, pockets stuffed with seed for the next sowing. Rob them if you dare — the seeds are the prize.",
    drops: [
      { item: "worn_coin", chance: 0.6, min: 2, max: 8, tier: "common" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "scrap_cloth", chance: 0.2, tier: "common" },
      { item: "seed_ashweed", chance: 0.35, min: 1, max: 3, tier: "common" },
      { item: "seed_thornroot", chance: 0.25, min: 1, max: 2, tier: "common" },
      { item: "seed_bloodberry", chance: 0.18, min: 1, max: 2, tier: "uncommon" },
      { item: "seed_coldmoss", chance: 0.14, tier: "uncommon" },
      { item: "seed_ironleaf", chance: 0.1, tier: "uncommon" },
      { item: "seed_greybloom", chance: 0.08, tier: "uncommon" },
      { item: "seed_ashwood", chance: 0.05, tier: "uncommon" },
      { item: "seed_coldpine", chance: 0.04, tier: "rare" },
      { item: "hill_stew", chance: 0.12, tier: "common" },
      { item: "uncut_sapphire", chance: 0.02, tier: "rare" },
    ],
  },
  "master_farmer": {
    id: "master_farmer", name: "Master Farmer", icon: "🧑‍🌾", level: 38, hp: 155,
    acc: 60, def: 22, maxHit: 12, speed: 2800, xp: 200, attackStyle: "crush",
    weakness: ["stab"],
    desc: "The one who runs the fields — decades of sowing in their hands and the rarest seeds in their satchel. A hard mark, but the seed is worth the sweat.",
    drops: [
      { item: "worn_coin", chance: 0.7, min: 6, max: 18, tier: "common" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "seed_bloodberry", chance: 0.3, min: 1, max: 3, tier: "common" },
      { item: "seed_coldmoss", chance: 0.25, min: 1, max: 2, tier: "common" },
      { item: "seed_ironleaf", chance: 0.2, tier: "uncommon" },
      { item: "seed_greybloom", chance: 0.18, tier: "uncommon" },
      { item: "seed_spinethistle", chance: 0.12, tier: "uncommon" },
      { item: "seed_ruevine", chance: 0.1, tier: "uncommon" },
      { item: "seed_duskshade", chance: 0.07, tier: "rare" },
      { item: "seed_marrowflower", chance: 0.05, tier: "rare" },
      { item: "seed_hearthbloom", chance: 0.03, tier: "rare" },
      { item: "seed_orunroot", chance: 0.015, tier: "rare" },
      { item: "seed_greyoak", chance: 0.06, tier: "uncommon" },
      { item: "seed_stonewood", chance: 0.06, tier: "uncommon" },
      { item: "seed_ruewood", chance: 0.04, tier: "rare" },
      { item: "seed_deeproot", chance: 0.02, tier: "rare" },
      { item: "uncut_emerald", chance: 0.03, tier: "rare" },
      { item: "uncut_ruby", chance: 0.01, tier: "rare" },
    ],
  },

  // === HEARTMOOR CULT CASTERS — magic enemies (follow the lore) ==============
  // The cult that reveres Orun's seam turns its faith into fire. They fling
  // Grace-bolts from range (attackStyle "magic"), drop Hex Cloth for robe-making
  // and, rarely, the robes themselves. Weak to a fast bow or a stabbing rush.
  "cult_acolyte": {
    id: "cult_acolyte", name: "Cult Acolyte", icon: "🧙", level: 22, hp: 100,
    acc: 46, def: 16, maxHit: 14, speed: 3000, attackRange: 5, xp: 90, attackStyle: "magic",
    weakness: ["stab", "ranged"],
    desc: "A hooded initiate of the Heartmoor Cult, hurling sparks of borrowed Grace from the dark.",
    drops: [
      { item: "worn_coin", chance: 0.7, min: 3, max: 10, tier: "always" },
      { item: "hex_cloth", chance: 0.4, tier: "common" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "herb_ashweed", chance: 0.15, tier: "common" },
      { item: "uncut_sapphire", chance: 0.05, tier: "uncommon" },
      { item: "mag_hood_1", chance: 0.02, tier: "rare" },
      { item: "mag_skirt_1", chance: 0.02, tier: "rare" },
      { item: "seed_duskshade", chance: 0.04, tier: "uncommon" },
      { item: "shard_of_orun", chance: 0.002, tier: "legendary" },
    ],
  },
  "cult_zealot": {
    id: "cult_zealot", name: "Cult Zealot", icon: "🧙", level: 42, hp: 185,
    acc: 86, def: 30, maxHit: 22, speed: 2800, attackRange: 5, xp: 200, attackStyle: "magic",
    weakness: ["ranged"],
    desc: "A fevered believer whose devotion has curdled into power. The seam answers when they call.",
    drops: [
      { item: "worn_coin", chance: 0.85, min: 6, max: 18, tier: "always" },
      { item: "hex_cloth", chance: 0.5, tier: "common" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "rough_gem", chance: 0.12, tier: "uncommon" },
      { item: "uncut_emerald", chance: 0.06, tier: "uncommon" },
      { item: "mag_hood_2", chance: 0.025, tier: "rare" },
      { item: "mag_robe_2", chance: 0.02, tier: "rare" },
      { item: "mag_skirt_2", chance: 0.025, tier: "rare" },
      { item: "cut_gem", chance: 0.05, tier: "rare" },
      { item: "shard_of_orun", chance: 0.004, tier: "legendary" },
    ],
  },
  "cult_magus": {
    id: "cult_magus", name: "Cult Magus", icon: "🧙", level: 59, hp: 260,
    acc: 204, def: 41, maxHit: 33, speed: 2600, attackRange: 5, xp: 400, attackStyle: "magic",
    weakness: ["ranged"],
    desc: "A master of the cult, robed in hex-woven cloth and wreathed in Orun's stolen light.",
    drops: [
      { item: "bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.95, min: 14, max: 40, tier: "always" },
      { item: "hex_cloth", chance: 0.6, min: 1, max: 2, tier: "common" },
      { item: "marrow_shard", chance: 0.12, tier: "uncommon" },
      { item: "uncut_ruby", chance: 0.08, tier: "uncommon" },
      { item: "cut_gem", chance: 0.15, tier: "uncommon" },
      { item: "mag_hood_3", chance: 0.03, tier: "rare" },
      { item: "mag_robe_3", chance: 0.025, tier: "rare" },
      { item: "mag_skirt_3", chance: 0.03, tier: "rare" },
      { item: "uncut_diamond", chance: 0.01, tier: "rare" },
      { item: "shard_of_orun", chance: 0.008, tier: "legendary" },
    ],
  },

  // === THE DELVE HORROR — the Marrow Delve's final wave. No drop table: the
  // Delve Cache pays the run. Magic at range, slams underfoot; bring a bow,
  // a blessing, and working feet. ===========================================
  "delve_horror": {
    id: "delve_horror", name: "The Delve Horror", icon: "👁️", level: 95, hp: 1250,
    acc: 330, def: 62, maxHit: 52, speed: 2600, attackRange: 5, xp: 1800, attackStyle: "magic",
    weakness: ["ranged", "stab"],
    boss: true,
    bossHint: "The last thing the Delve keeps. It has no name the Record will print. Waves of the deep answer to it — clear them, and it comes itself.",
    desc: "It was here before the vault had a door. The dark doesn't frighten it; the dark reports to it.",
    mechanics: [
      { type: "slam", every: 4, mult: 2.2, radius: 1, windupMs: 2000, tell: "The Horror's eye fixes on the ground beneath you — the stone begins to scream. MOVE!" },
      { type: "enrage", below: 0.3, mult: 1.4, tell: "The Horror's eye splits open wider — the dark itself leans in!" },
    ],
    drops: [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 1, min: 450, max: 950, tier: "always" },
      // The Horror's Lantern — its signature unique (the deep's own cold light).
      { item: "horror_lantern", chance: 0.04, tier: "legendary" },
      { item: "hearthite_bar", chance: 0.4, min: 1, max: 2, tier: "uncommon" },
      { item: "cut_gem", chance: 0.5, min: 1, max: 3, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.3, min: 1, max: 2, tier: "rare" },
      { item: "shard_of_orun", chance: 0.04, tier: "legendary" },
    ],
  },

  // === THE GREYBACK — the wandering world boss. It patrols the wild edges of
  // Varath on a slow clock (see `patrol` on its spawn); the chat feed calls
  // the sighting and hunters converge. =======================================
  "greyback": {
    id: "greyback", name: "The Greyback", icon: "🐻", level: 88, hp: 1500,
    acc: 320, def: 70, maxHit: 46, speed: 3200, xp: 1600, attackStyle: "slash",
    weakness: ["stab"],
    boss: true,
    bossHint: "A beast older than the roads, seen once a season and lied about all year. It wanders — the crier calls where. Bring friends' courage and a spear of your own.",
    desc: "Grey as weathered stone and half as slow. Every settlement has a wall it broke and a hunter it outlived.",
    mechanics: [
      { type: "slam", every: 5, mult: 2.4, radius: 1, windupMs: 2200, tell: "The Greyback rears to its full height — its shadow swallows the ground you stand on. MOVE!" },
      // Weathered-stone hide: a slash or crush skids off it — only a spear finds
      // the seams, making its stab weakness (and its bossHint's promise) real.
      { type: "scaleguard", reduce: 0.35 },
      { type: "enrage", below: 0.25, mult: 1.5, tell: "The Greyback bleeds, and remembers how to be furious." },
    ],
    drops: [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 1, min: 400, max: 900, tier: "always" },
      { item: "cloak_greyback", chance: 0.025, tier: "legendary" },
      // The world boss now has a pet of its own (also the 100-kill milestone pet).
      { item: "pet_greyback", chance: 0.004, tier: "legendary" },
      { item: "hearthite_bar", chance: 0.35, min: 1, max: 2, tier: "uncommon" },
      { item: "cut_gem", chance: 0.4, min: 1, max: 2, tier: "uncommon" },
      { item: "shard_of_orun", chance: 0.03, tier: "legendary" },
    ],
  }
  ,
  "barrow_sentinel": {
    "id": "barrow_sentinel",
    "name": "Grave-Sentinel",
    "icon": "💀",
    "level": 52,
    "hp": 130,
    "acc": 220,
    "def": 22,
    "maxHit": 24,
    "speed": 2400,
    "attackRange": 1,
    "xp": 360,
    "attackStyle": "melee",
    "weakness": ["crush"],
    "desc": "A barrow-guard that never lay down. It keeps the switchback galleries, and it keeps a key.",
    "drops": [
      { item: "barrow_key", chance: 1, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.7, min: 20, max: 45, tier: "common" },
    ],
  },
  "barrow_king": {
    "id": "barrow_king",
    "name": "The Barrow-King",
    "icon": "👑",
    "level": 60,
    "hp": 280,
    "acc": 260,
    "def": 26,
    "maxHit": 30,
    "speed": 2400,
    "attackRange": 1,
    "xp": 900,
    "attackStyle": "melee",
    "weakness": ["crush", "magic"],
    "desc": "The old north-folk buried their king with wolf, moon and crown — and he kept all three. He rises from the long chair when the slab is broken.",
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 1, min: 120, max: 260, tier: "always" },
      { item: "cut_gem", chance: 0.35, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.1, tier: "rare" },
    ],
  },
  "vault_sentinel": {
    "id": "vault_sentinel",
    "name": "Vault-Sentinel",
    "icon": "🗿",
    "level": 62,
    "hp": 160,
    "acc": 250,
    "def": 24,
    "maxHit": 28,
    "speed": 2300,
    "attackRange": 4,
    "xp": 420,
    "attackStyle": "ranged",
    "weakness": ["crush", "ranged"],
    "desc": "A stone-clad warder of the vault stair, flinging shards of ward-stone. Its belt carries the Wardens' Key.",
    "drops": [
      { item: "vault_key", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.7, min: 30, max: 60, tier: "common" },
      { item: "stone_block", chance: 0.4, min: 1, max: 2, tier: "common" },
    ],
  },
  "vault_warden": {
    "id": "vault_warden",
    "name": "The Vaultwright",
    "icon": "🛡️",
    "level": 70,
    "hp": 340,
    "acc": 280,
    "def": 30,
    "maxHit": 34,
    "speed": 2200,
    "attackRange": 5,
    "xp": 1200,
    "attackStyle": "magic",
    "weakness": ["ranged", "slash"],
    "desc": "The mason-warden who sealed the Spine Vault from the inside and stayed with the work. What walks the treasury now still holds the trowel — and the wards.",
    "drops": [
      { item: "worn_coin", chance: 1, min: 200, max: 400, tier: "always" },
      { item: "cut_gem", chance: 0.5, min: 1, max: 2, tier: "uncommon" },
      { item: "ashiron_bar", chance: 0.4, min: 1, max: 2, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.12, tier: "rare" },
    ],
  },
  "drowned_thrall": {
    "id": "drowned_thrall",
    "name": "Drowned Thrall",
    "icon": "🧟",
    "level": 58,
    "hp": 95,
    "acc": 210,
    "def": 18,
    "maxHit": 22,
    "speed": 2600,
    "attackRange": 1,
    "xp": 260,
    "attackStyle": "melee",
    "weakness": ["slash"],
    "desc": "A servant of the old court the moor never let go of. It still bows — low, and fast, and at your throat.",
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.7, min: 15, max: 40, tier: "common" },
    ],
  },
  "court_wisp": {
    "id": "court_wisp",
    "name": "Court-Light",
    "icon": "🕯️",
    "level": 62,
    "hp": 85,
    "acc": 240,
    "def": 20,
    "maxHit": 25,
    "speed": 2400,
    "attackRange": 4,
    "xp": 300,
    "attackStyle": "magic",
    "weakness": ["ranged"],
    "desc": "A lamp of the court that outlived its lamplighter. It still keeps the halls lit — hostile, now, to anything that casts a shadow.",
    "drops": [
      { item: "worn_coin", chance: 0.8, min: 20, max: 50, tier: "common" },
      { item: "hex_cloth", chance: 0.35, min: 1, max: 2, tier: "uncommon" },
      { item: "cut_gem", chance: 0.1, tier: "rare" },
    ],
  },
  "court_reliquarist": {
    "id": "court_reliquarist",
    "name": "The Reliquarist",
    "icon": "💀",
    "level": 68,
    "hp": 180,
    "acc": 250,
    "def": 26,
    "maxHit": 28,
    "speed": 2400,
    "attackRange": 1,
    "xp": 520,
    "attackStyle": "melee",
    "weakness": ["crush"],
    "desc": "Keeper of the court's relics, drowned at his post and unwilling to leave it. The reliquary key is still on his belt.",
    "drops": [
      { item: "court_key", chance: 1, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.8, min: 40, max: 80, tier: "common" },
    ],
  },
  "drowned_magistrate": {
    "id": "drowned_magistrate",
    "name": "The Drowned Magistrate",
    "icon": "⚖️",
    "level": 76,
    "hp": 400,
    "acc": 300,
    "def": 32,
    "maxHit": 36,
    "speed": 2200,
    "attackRange": 5,
    "xp": 1500,
    "attackStyle": "magic",
    "weakness": ["slash", "ranged"],
    "desc": "The last judge of the Sunken Court, holding session under six feet of black moor-water. The verdict has not changed in a thousand years: no one leaves the north road open.",
    "drops": [
      { item: "worn_coin", chance: 1, min: 250, max: 500, tier: "always" },
      { item: "cut_gem", chance: 0.5, min: 1, max: 3, tier: "uncommon" },
      { item: "hex_cloth", chance: 0.4, min: 1, max: 2, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.12, tier: "rare" },
    ],
  },
  "aerie_harpy": {
    "id": "aerie_harpy",
    "name": "Aerie Shriker",
    "icon": "🦅",
    "level": 64,
    "hp": 90,
    "acc": 240,
    "def": 20,
    "maxHit": 24,
    "speed": 2400,
    "attackRange": 4,
    "xp": 310,
    "attackStyle": "ranged",
    "weakness": ["ranged"],
    "desc": "A hunting bird of the high Spine grown huge and territorial on the ruin's updrafts. It stoops from above the torchlight.",
    "drops": [
      { item: "arrow_ashiron", chance: 0.6, min: 4, max: 10, tier: "common" },
      { item: "worn_coin", chance: 0.7, min: 20, max: 45, tier: "common" },
    ],
  },
  "storm_wisp": {
    "id": "storm_wisp",
    "name": "Storm-Wisp",
    "icon": "⚡",
    "level": 68,
    "hp": 88,
    "acc": 260,
    "def": 22,
    "maxHit": 27,
    "speed": 2400,
    "attackRange": 4,
    "xp": 340,
    "attackStyle": "magic",
    "weakness": ["ranged"],
    "desc": "A knot of the pass's endless weather, wound tight enough to want something. What it wants is you off the mountain.",
    "drops": [
      { item: "worn_coin", chance: 0.8, min: 25, max: 55, tier: "common" },
      { item: "cut_gem", chance: 0.1, tier: "rare" },
    ],
  },
  "sky_warder": {
    "id": "sky_warder",
    "name": "Warder of the Traverse",
    "icon": "🛡️",
    "level": 72,
    "hp": 200,
    "acc": 270,
    "def": 28,
    "maxHit": 30,
    "speed": 2400,
    "attackRange": 4,
    "xp": 620,
    "attackStyle": "ranged",
    "weakness": ["crush"],
    "desc": "The aerie's last sentry, still walking the traverse between the stairs. The Eyrie Key hangs at its belt, polished by a thousand years of wind.",
    "drops": [
      { item: "sky_key", chance: 1, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.8, min: 50, max: 90, tier: "common" },
    ],
  },
  "storm_herald": {
    "id": "storm_herald",
    "name": "The Storm-Herald",
    "icon": "🌩️",
    "level": 80,
    "hp": 440,
    "acc": 320,
    "def": 34,
    "maxHit": 38,
    "speed": 2200,
    "attackRange": 6,
    "xp": 1800,
    "attackStyle": "ranged",
    "weakness": ["crush", "magic"],
    "desc": "The signal-keeper of Skyreach, sworn to light the beacons if the north road ever opened — and to see that it never did. The storm above the pass answers to it.",
    "drops": [
      { item: "worn_coin", chance: 1, min: 300, max: 550, tier: "always" },
      { item: "arrow_ashiron", chance: 1, min: 10, max: 20, tier: "always" },
      { item: "cut_gem", chance: 0.5, min: 1, max: 3, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.15, tier: "rare" },
    ],
  },
  "pale_wight": {
    "id": "pale_wight",
    "name": "Pale Wight",
    "icon": "👻",
    "level": 75,
    "hp": 120,
    "acc": 270,
    "def": 26,
    "maxHit": 28,
    "speed": 2400,
    "attackRange": 1,
    "xp": 420,
    "attackStyle": "melee",
    "weakness": ["crush"],
    "desc": "One of the north-folk who stayed to keep the Undergate, kept in turn by it. It walks its post the way water walks a wheel.",
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.7, min: 30, max: 70, tier: "common" },
    ],
  },
  "pale_gatekeeper": {
    "id": "pale_gatekeeper",
    "name": "Gatewright of the Underway",
    "icon": "🛡️",
    "level": 82,
    "hp": 280,
    "acc": 300,
    "def": 32,
    "maxHit": 33,
    "speed": 2400,
    "attackRange": 1,
    "xp": 900,
    "attackStyle": "melee",
    "weakness": ["slash"],
    "desc": "The mason who raised the Underway's pillars and locked its doors behind him. His key never left his belt, and his belt never left his bones.",
    "drops": [
      { item: "undergate_key_1", chance: 1, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.9, min: 80, max: 140, tier: "common" },
    ],
  },
  "pale_herald": {
    "id": "pale_herald",
    "name": "Herald of the Deep Stair",
    "icon": "📯",
    "level": 86,
    "hp": 320,
    "acc": 320,
    "def": 34,
    "maxHit": 35,
    "speed": 2300,
    "attackRange": 5,
    "xp": 1100,
    "attackStyle": "ranged",
    "weakness": ["crush", "magic"],
    "desc": "The voice that was to carry the psalm's last verse up the stair if the seals ever failed. It has held its breath a thousand years, and it is not glad to see you.",
    "drops": [
      { item: "undergate_key_2", chance: 1, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 0.9, min: 100, max: 160, tier: "common" },
    ],
  },
  "pale_warden": {
    "id": "pale_warden",
    "name": "The Pale Warden",
    "icon": "🐺",
    "level": 92,
    "hp": 650,
    "acc": 350,
    "def": 38,
    "maxHit": 40,
    "speed": 2200,
    "attackRange": 6,
    "xp": 3000,
    "attackStyle": "magic",
    "weakness": ["slash", "ranged"],
    "boss": true,
    "desc": "The keeper of the fifth seal, sworn upon the Undergate until the wolf runs home. It is not angry. It is not cruel. It simply has one instruction left, and you are standing on it.",
    "drops": [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 1, min: 500, max: 900, tier: "always" },
      // The Warden's own regalia — its mask and greaves now drop from it.
      { item: "pale_mask", chance: 0.04, tier: "rare" },
      { item: "pale_greaves", chance: 0.04, tier: "rare" },
      { item: "cut_gem", chance: 0.6, min: 2, max: 4, tier: "uncommon" },
      { item: "ashiron_bar", chance: 0.5, min: 2, max: 3, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.25, tier: "rare" },
      { item: "shard_of_orun", chance: 0.03, tier: "legendary" },
    ],
    bossHint: "It keeps the fifth seal at the Undergate's mouth and will not step aside. It strikes with sealfire at range — and its ward burns any hand that closes to melee, so a bow pays where a blade bleeds.",
    mechanics: [
      // Sealfire — a telegraphed, doubled bolt every 4th cast (it fights at range).
      { type: "heavy", every: 4, mult: 2.0, tell: "The Pale Warden lifts its mask and the fifth seal blazes white — SEALFIRE!" },
      // Signature: WARD-BURN. Its oath-ward scorches anyone who melees it — so the
      // slash weakness is a trap of sorts: you hit harder in close, but you burn
      // for it. Ranged (its other weakness) is the clean, safe answer. A real
      // triangle choice instead of a single dominant style.
      { type: "recoil", frac: 0.22, tell: "Your blade bites the Warden and its ward flares — the sealfire licks back up your arm." },
      // Under a third, the last instruction takes over completely.
      { type: "enrage", below: 0.3, mult: 1.4, tell: "The Warden forgets mercy and remembers only the instruction — every strike for the kill." },
    ],
  },

  // === VORLAG, THE HUNGER BELOW — the level-125 apex, past the fifth seal ===
  // When the pass opened, a crack opened with it at the Undergate's mouth: the
  // thing the five seals were FOR, waking hungry. Varath's hardest fight —
  // weak only to magic, so Devotion finally headlines an endgame encounter.
  "vorlag": {
    id: "vorlag", name: "Vorlag, the Hunger Below", icon: "🕳️", level: 125, hp: 2600,
    acc: 480, def: 96, maxHit: 68, speed: 2600, xp: 6000, attackStyle: "crush",
    weakness: ["magic"],
    boss: true,
    bossHint: "The thing the five seals held. Its lair — the Hollow Below — opened at the Undergate's mouth the day the pass did. It shrugs off steel and arrows alike; bring your Devotion, a staff that means it, and everything your bank will carry.",
    desc: "The Hunger Below. Old Varath did not seal the north road to keep travellers out — it starved the road so THIS would sleep. The pass is open now. It is not sleeping now. Steel rings off its hide; only Grace burns it.",
    mechanics: [
      // 1. The floor buckles — a telegraphed ground-surge every 3rd swing.
      { type: "slam", every: 3, mult: 2.6, radius: 1, windupMs: 2200, tell: "The floor BUCKLES — the Hunger surges beneath where you stand. MOVE!" },
      // 2. Waking fury — under a third of its blood, it stops being patient.
      { type: "enrage", below: 0.33, mult: 1.5, tell: "Vorlag opens — all the way open — and the dark inside it HOWLS." },
      // 3. A hide of sealed centuries: melee and arrows glance unless you bring
      //    its one weakness (magic), OSRS-style.
      { type: "scaleguard", reduce: 0.45 },
    ],
    drops: [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 1, min: 900, max: 2200, tier: "always" },
      // The whelp: a fist of the dark that imprinted on its parent's killer.
      { item: "pet_vorlag", chance: 0.001, tier: "legendary" },
      // The uniques: the best stab blade, wall and cape in Varath, equal rates.
      { item: "hunger_fang", chance: 0.03, tier: "legendary" },
      { item: "sealbreaker_bulwark", chance: 0.03, tier: "legendary" },
      { item: "mantle_of_the_below", chance: 0.025, tier: "legendary" },
      // A dry kill still pays like the endgame it is.
      { item: "hearthite_bar", chance: 0.5, min: 2, max: 4, tier: "uncommon" },
      { item: "cut_gem", chance: 0.5, min: 2, max: 4, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.3, tier: "rare" },
      { item: "shard_of_orun", chance: 0.05, tier: "legendary" },
    ],
  },

  // === THE GAUNT BELOW — the repeatable ~110 boss that fills the 100→125 cliff
  // (T5·04). A lesser hunger that clawed up the Hollow's throat AHEAD of Vorlag,
  // the vanguard of the thing the seals held. Weak to RANGED (variety against
  // Vorlag's magic-only), it's the on-ramp to the apex: farm it for the Gaunt
  // Maul and a step's worth of endgame mats before you bring Devotion to Vorlag.
  "gaunt_below": {
    id: "gaunt_below", name: "The Gaunt Below", icon: "💀", level: 110, hp: 2000,
    acc: 400, def: 84, maxHit: 58, speed: 2800, xp: 5000, attackStyle: "crush",
    weakness: ["ranged"],
    boss: true,
    bossHint: "The lesser hunger that reached the Hollow Below's gallery ahead of Vorlag. Repeatable, and the last real step before the apex — it flinches from arrows where its parent shrugs them off, so bring a bow and keep moving when the floor cracks.",
    desc: "Not the Hunger itself — the thing that went up the throat FIRST, thinner and faster and almost as old. It gnaws where Vorlag swallows. Kill it on the way down, and again, and again; its maul is the on-ramp to the deep.",
    mechanics: [
      { type: "slam", every: 4, mult: 2.4, radius: 1, windupMs: 2000, tell: "The Gaunt rears and the gallery floor SPLITS beneath you. MOVE!" },
      { type: "enrage", below: 0.3, mult: 1.4, tell: "The Gaunt Below remembers it was hungry first." },
      { type: "selfheal", below: 0.4, amount: 90, tell: "The Gaunt folds in on itself and GNAWS — its own wounds close over." },
    ],
    drops: [
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "worn_coin", chance: 1, min: 700, max: 1500, tier: "always" },
      { item: "pet_gaunt", chance: 0.002, tier: "legendary" },
      { item: "gaunt_maul", chance: 0.04, tier: "legendary" },
      { item: "hearthite_bar", chance: 0.5, min: 2, max: 4, tier: "uncommon" },
      { item: "cut_gem", chance: 0.5, min: 2, max: 4, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.3, tier: "rare" },
      { item: "shard_of_orun", chance: 0.04, tier: "legendary" },
    ],
  },

  // === THE HUNT WARRENS — warren-bred quarry, each gated by Bounty level ====
  // OSRS-Slayer style: without the huntcraft you can't fight them at all
  // (bountyReq), and each tier pays better than the last, topped by a unique
  // that drops nowhere else. Their tasks roll from the "warrens" zone pool.
  "warren_creeper": {
    id: "warren_creeper", name: "Warren Creeper", icon: "🕷️", level: 30, hp: 150,
    acc: 60, def: 22, maxHit: 13, speed: 3000, xp: 110, attackStyle: "stab",
    weakness: ["slash"], bountyReq: 20,
    desc: "A pale, many-legged thing that never leaves the Burrows. It hears your pulse through the floor. Takes Bounty 20 to hunt.",
    drops: [
      { item: "worn_coin", chance: 1, min: 8, max: 20, tier: "always" },
      { item: "bones", chance: 1, tier: "always" },
      { item: "sinew", chance: 0.4, tier: "common" },
      { item: "rough_gem", chance: 0.15, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.03, tier: "uncommon" },
      { item: "creeper_eye", chance: 0.008, tier: "rare" },
    ],
  },
  "dusk_stalker": {
    id: "dusk_stalker", name: "Dusk Stalker", icon: "🐆", level: 50, hp: 260,
    acc: 95, def: 38, maxHit: 18, speed: 2300, xp: 240, attackStyle: "slash",
    weakness: ["crush"], bountyReq: 40,
    desc: "A long cat of the Dens, black as a shut door and twice as quiet. Hunters swear its fangs whistle. Takes Bounty 40 to hunt.",
    drops: [
      { item: "worn_coin", chance: 1, min: 14, max: 34, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "raw_meat", chance: 0.6, min: 1, max: 2, tier: "common" },
      { item: "thick_hide", chance: 0.35, tier: "common" },
      { item: "sinew", chance: 0.3, tier: "common" },
      { item: "cut_gem", chance: 0.08, tier: "uncommon" },
      { item: "stalker_fangs", chance: 0.007, tier: "rare" },
    ],
  },
  "hollow_hound": {
    id: "hollow_hound", name: "Hollow Hound", icon: "🐕", level: 68, hp: 400,
    acc: 125, def: 55, maxHit: 25, speed: 2600, xp: 400, attackStyle: "crush",
    weakness: ["stab"], bountyReq: 60,
    desc: "A kennel-bred horror gone feral generations back — a hound's shape around a hollow middle. Its hide turns blades its body shouldn't. Takes Bounty 60 to hunt.",
    drops: [
      { item: "worn_coin", chance: 1, min: 22, max: 50, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "thick_hide", chance: 0.6, min: 1, max: 2, tier: "common" },
      { item: "health_elixir", chance: 0.07, tier: "uncommon" },
      { item: "marrow_shard", chance: 0.06, tier: "uncommon" },
      { item: "houndhide_cloak", chance: 0.006, tier: "rare" },
    ],
  },
  "warren_shade": {
    id: "warren_shade", name: "Warren Shade", icon: "👻", level: 84, hp: 540,
    acc: 240, def: 68, maxHit: 31, speed: 2700, attackRange: 5, xp: 580, attackStyle: "magic",
    weakness: ["ranged"], bountyReq: 75,
    desc: "What is left of the hunters who went below their level. It casts from the black pools of the Crypt, and it remembers being warm. Takes Bounty 75 to hunt.",
    drops: [
      { item: "worn_coin", chance: 1, min: 35, max: 75, tier: "always" },
      { item: "bonemeal", chance: 0.7, min: 2, max: 4, tier: "common" },
      { item: "hex_cloth", chance: 0.4, min: 1, max: 2, tier: "common" },
      { item: "marrow_shard", chance: 0.12, tier: "uncommon" },
      { item: "cut_gem", chance: 0.1, tier: "uncommon" },
      { item: "wraithbone_staff", chance: 0.005, tier: "rare" },
    ],
  },
  "iron_maw": {
    id: "iron_maw", name: "Iron Maw", icon: "🦂", level: 100, hp: 740,
    acc: 170, def: 88, maxHit: 38, speed: 3000, xp: 820, attackStyle: "crush",
    weakness: ["stab"], bountyReq: 90,
    desc: "The thing at the bottom of the Warrens: an armoured mouth on legs, plated in scrap it has eaten and grown over. The Maw Pit is a larder, and it is the keeper. Takes Bounty 90 to hunt.",
    drops: [
      { item: "worn_coin", chance: 1, min: 60, max: 130, tier: "always" },
      { item: "big_bones", chance: 1, tier: "always" },
      { item: "ashiron_bar", chance: 0.4, min: 1, max: 2, tier: "common" },
      { item: "cut_gem", chance: 0.15, min: 1, max: 2, tier: "uncommon" },
      { item: "bloodore_bar", chance: 0.3, min: 1, max: 2, tier: "uncommon" },
      { item: "gold_bar", chance: 0.07, tier: "uncommon" },
      { item: "mawplate", chance: 0.004, tier: "rare" },
    ],
  }
};
