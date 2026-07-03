/**
 * src/content/shops.ts
 * --------------------
 * The Ironvale market. Pure DATA (RULE 3). Each shop lists what its keeper
 * SELLS to you (a bundle of `qty` units for `price` gold). You can SELL anything
 * back at the market for its own `sell` value (items.ts) at any counter.
 *
 * Prices are faithful to the idle game:
 *   - The General Store stock and prices are the canon `generalStoreHTML` list,
 *     verbatim.
 *   - Other counters price each item at round(sell × 1.3) — the buy/sell markup
 *     the canon store prices imply (≈1.25–1.33). Every buy price is kept above
 *     the item's sell value, so there is no buy-low/sell-high arbitrage.
 */

import type { ShopDef } from "../core/types.ts";

export const shops: ShopDef[] = [
  {
    id: "shop_general",
    npc: "shop_quartermaster",
    name: "Ironvale General Store",
    greeting: "Hespa's counter — tools, seeds and sundries. Sell me your odds and ends, too.",
    stock: [
      // Canon generalStoreHTML stock + prices, exactly.
      { item: "plant_fiber", price: 15, qty: 1 },
      { item: "ashwood_shaft", price: 80, qty: 10 },
      { item: "embercite_ore", price: 90, qty: 5 },
      { item: "seed_ashweed", price: 20, qty: 3 },
      { item: "seed_thornroot", price: 38, qty: 3 },
      { item: "seed_bloodberry", price: 69, qty: 3 },
      { item: "seed_coldmoss", price: 108, qty: 3 },
      { item: "seed_ashwood", price: 60, qty: 3 },
      { item: "seed_stonewood", price: 260, qty: 1 },
      // Higher Farming/Herblore seeds — these had no source before, so the herb
      // line above Coldmoss (and the brews that need those herbs) was unreachable.
      { item: "seed_ironleaf", price: 150, qty: 2 },
      { item: "seed_greybloom", price: 220, qty: 2 },
      { item: "seed_spinethistle", price: 320, qty: 2 },
      { item: "seed_ruevine", price: 480, qty: 2 },
      { item: "seed_duskshade", price: 700, qty: 2 },
      { item: "seed_marrowflower", price: 1000, qty: 2 },
      { item: "seed_hearthbloom", price: 1500, qty: 2 },
      { item: "seed_orunroot", price: 2200, qty: 2 },
      { item: "fertilizer_basic", price: 55, qty: 1 },
      { item: "forage_mushroom", price: 52, qty: 5 },
      // Glass for Herblore — tinctures take a small vial, full brews a flask
      // (blow your own once Crafting's glassblowing is open; buy them meanwhile).
      { item: "glass_vial", price: 25, qty: 2 },
      { item: "glass_flask", price: 45, qty: 1 },
      // Pestle & Mortar — crush bones into bonemeal for Devotion Potions.
      { item: "pestle", price: 12, qty: 1 },
      // Flint & Steel — strike logs to light a campfire for Survivalist & cooking.
      { item: "flint", price: 20, qty: 1 },
      // With the Shard broken (the Unlit Flame ending) the roads calm and
      // provisions flow again — field rations by the bundle.
      { item: "battle_ration", price: 45, qty: 3, requiresFlag: "endgame_shard_destroyed" },
      // Sinew for stitching ranger leathers (also drops from beasts).
      { item: "sinew", price: 22, qty: 3 },
      // Starter gathering tools (round(sell × 1.3)).
      { item: "pickaxe_1", price: 20, qty: 1 },
      { item: "hatchet_1", price: 20, qty: 1 },
      { item: "rod_1", price: 65, qty: 1 },
      { item: "pickaxe_3", price: 104, qty: 1 },
      { item: "hatchet_3", price: 104, qty: 1 },
      // Better rods (Woodcraft makes its own once that bench is open).
      { item: "rod_2", price: 130, qty: 1 },
      { item: "rod_3", price: 240, qty: 1 },
      // Faith casting staffs — the low tiers, so a new caster can get started.
      { item: "staff_ashwood", price: 80, qty: 1 },
      { item: "staff_coldpine", price: 235, qty: 1 },
      { item: "staff_stonewood", price: 545, qty: 1 },
    ],
  },
  {
    id: "shop_armoury",
    npc: "shop_armourer",
    name: "Doran's Armoury",
    greeting: "Ashforge seconds and field steel, tiers I through III. The heavy stuff you forge yourself. Sell me your scrap, too.",
    // A tiered ladder of weapons and armour, priced at round(sell × 1.3). Higher
    // tiers (VI/IX/X) are left to the forge and to drops.
    stock: [
      // --- Tier I — Knucklestone (combat 1) ---
      { item: "dagger_1", price: 26, qty: 1 },
      { item: "sword_1", price: 33, qty: 1 },
      { item: "hammer_1", price: 36, qty: 1 },
      { item: "spear_1", price: 36, qty: 1 },
      { item: "claymore_1", price: 42, qty: 1 },
      { item: "shield_1", price: 33, qty: 1 },
      { item: "helm_1", price: 26, qty: 1 },
      { item: "armor_1", price: 46, qty: 1 },
      { item: "legs_1", price: 33, qty: 1 },
      { item: "boot_1", price: 16, qty: 1 },
      // --- Tier III — Ashiron (combat 20) ---
      { item: "sword_3", price: 169, qty: 1 },
      { item: "hammer_3", price: 189, qty: 1 },
      { item: "claymore_3", price: 215, qty: 1 },
      { item: "shield_3", price: 150, qty: 1 },
      { item: "helm_3", price: 124, qty: 1 },
      { item: "armor_3", price: 234, qty: 1 },
      { item: "legs_3", price: 150, qty: 1 },
      { item: "boot_3", price: 72, qty: 1 },
      // --- Tier IV — Ribstone (combat 30) ---
      { item: "sword_4", price: 325, qty: 1 },
      { item: "claymore_4", price: 416, qty: 1 },
      { item: "shield_4", price: 254, qty: 1 },
      { item: "helm_4", price: 208, qty: 1 },
      { item: "armor_4", price: 449, qty: 1 },
      { item: "legs_4", price: 254, qty: 1 },
      { item: "boot_4", price: 117, qty: 1 },
    ],
  },
  {
    id: "shop_goblin",
    npc: "shop_trader",
    name: "Skritt's Sundries",
    greeting: "Heh. Goblin prices — better than honest, worse than fair. Skritt buys the warm stone, mind.",
    // A goblin's odd lot. He'll buy anything off you, especially Shards of Orun.
    stock: [
      { item: "crude_shortbow", price: 26, qty: 1 },
      { item: "arrow_knucklestone", price: 390, qty: 25 },
      { item: "ring_1", price: 46, qty: 1 },
      { item: "plant_fiber", price: 16, qty: 1 },
      { item: "battle_ration", price: 65, qty: 1 },
      // Skritt respects the one who put the warm stone DOWN (Long Road ending).
      { item: "cut_gem", price: 380, qty: 1, max: 2, restockMs: 1800000, requiresFlag: "endgame_shard_walked_away" },
    ],
  },
  {
    id: "shop_builder",
    npc: "builder_merchant",
    name: "Marrick's Builders' Yard",
    greeting: "Timber, stone and mortar by the stack. Buy the makings and pour your coin straight into the build — that's how a purse becomes a Construction level.",
    // The Construction gold sink: the raw inputs of building, sold for coin so a
    // rich player can buy their way up the skill (OSRS-style). Priced well above
    // sell value (≈1.7×) — pure drain, no arbitrage — and bundled to cut clicks.
    stock: [
      // --- Planks (the bulk of every build) ---
      { item: "plank_ashwood", price: 70, qty: 5 },     // sell 8
      { item: "plank_stonewood", price: 550, qty: 5 },  // sell 65
      { item: "plank_greyoak", price: 935, qty: 5 },    // sell 110
      { item: "plank_ironbark", price: 1235, qty: 5 },  // sell 145
      { item: "plank_heartoak", price: 1325, qty: 3 },  // sell 260
      // --- Stone, mortar and frames ---
      { item: "stone_block", price: 130, qty: 5 },      // sell 15
      // The Record pays to build over what it sealed (Sealed Vault ending).
      { item: "stone_block", price: 90, qty: 10, requiresFlag: "endgame_shard_secured" },
      { item: "timber_frame", price: 215, qty: 5 },     // sell 25
      { item: "mortar_basic", price: 170, qty: 5 },     // sell 20
      { item: "mortar_spinite", price: 460, qty: 3 },   // sell 90
      { item: "stonewood_beam", price: 306, qty: 3 },   // sell 60
      { item: "heartoak_beam", price: 1530, qty: 1 },   // sell 900
      // --- Fittings: cheaper bars and gems the higher tiers need ---
      { item: "knucklestone_bar", price: 100, qty: 5 }, // sell 12
      { item: "ashiron_bar", price: 306, qty: 3 },      // sell 60
      { item: "gold_bar", price: 408, qty: 2 },         // sell 120
      { item: "cut_gem", price: 510, qty: 1 },          // sell 300
    ],
  },
  {
    id: "shop_apothecary",
    npc: "apothecary",
    name: "Wenna's Apothecary",
    greeting: "Herbs by the bunch, secondaries by the scoop, vials and flasks to hold them. Buy the makings and brew your way up Herblore.",
    // The Herblore gold sink: the herbs, field secondaries and glassware that
    // tinctures and elixirs need, sold for coin at ≈1.7× sell (pure drain, no
    // arbitrage) and bundled. Pair with a cauldron and pour gold into Herblore.
    stock: [
      { item: "vial_water", price: 8, qty: 1 },
      // --- Herbs (the heart of every brew) ---
      { item: "herb_ashweed", price: 77, qty: 3 },        // sell 15
      { item: "herb_thornroot", price: 143, qty: 3 },     // sell 28
      { item: "herb_bloodberry", price: 230, qty: 3 },    // sell 45
      { item: "herb_coldmoss", price: 357, qty: 3 },      // sell 70
      { item: "herb_ironleaf", price: 536, qty: 3 },      // sell 105
      { item: "herb_greybloom", price: 765, qty: 3 },     // sell 150
      { item: "herb_spinethistle", price: 1071, qty: 3 }, // sell 210
      { item: "herb_ruevine", price: 1479, qty: 3 },      // sell 290
      { item: "herb_duskshade", price: 1360, qty: 2 },    // sell 400
      { item: "herb_marrowflower", price: 1904, qty: 2 }, // sell 560
      { item: "herb_hearthbloom", price: 2652, qty: 2 },  // sell 780
      { item: "herb_orunroot", price: 8500, qty: 1 },     // sell 5000
      // --- Field secondaries ---
      { item: "forage_mushroom", price: 68, qty: 5 },     // sell 8
      { item: "forage_thornberry", price: 128, qty: 5 },  // sell 15
      { item: "greyoak_gall", price: 153, qty: 5 },       // sell 18
      { item: "forage_deepmoss", price: 298, qty: 5 },    // sell 35
      { item: "forage_hearthroot", price: 340, qty: 5 },  // sell 40
      { item: "forage_ashbloom", price: 468, qty: 5 },    // sell 55
      { item: "forage_ashroot", price: 850, qty: 5 },     // sell 100
      { item: "forage_dawnspore", price: 816, qty: 3 },   // sell 160
      // --- Glassware in bulk, so brewing for gold runs smoothly ---
      { item: "glass_vial", price: 238, qty: 5 },         // sell 28
      { item: "glass_flask", price: 765, qty: 5 },        // sell 90
    ],
  },
  {
    id: "shop_capes",
    npc: "cape_master",
    name: "The Hall of Capes",
    greeting: "Bring a skill to one hundred and its cape is yours — a million gold, and well earned. Master every one, and the Cape of Varath is your right.",
    // Mastery rewards: one cape per skill at level 100, and the all-100 max cape.
    // The core gates each purchase on the level requirement (and all-100 for Varath).
    stock: [
      { item: "cape_mining", price: 1000000, qty: 1 },
      { item: "cape_smithing", price: 1000000, qty: 1 },
      { item: "cape_forestry", price: 1000000, qty: 1 },
      { item: "cape_woodcraft", price: 1000000, qty: 1 },
      { item: "cape_hunter", price: 1000000, qty: 1 },
      { item: "cape_fishing", price: 1000000, qty: 1 },
      { item: "cape_cooking", price: 1000000, qty: 1 },
      { item: "cape_farming", price: 1000000, qty: 1 },
      { item: "cape_survivalist", price: 1000000, qty: 1 },
      { item: "cape_herblore", price: 1000000, qty: 1 },
      { item: "cape_construction", price: 1000000, qty: 1 },
      { item: "cape_crafting", price: 1000000, qty: 1 },
      { item: "cape_bounty", price: 1000000, qty: 1 },
      { item: "cape_agility", price: 1000000, qty: 1 },
      { item: "cape_vitality", price: 1000000, qty: 1 },
      { item: "cape_edge", price: 1000000, qty: 1 },
      { item: "cape_vigour", price: 1000000, qty: 1 },
      { item: "cape_ward", price: 1000000, qty: 1 },
      { item: "cape_draw", price: 1000000, qty: 1 },
      { item: "cape_faith", price: 1000000, qty: 1 },
      { item: "cape_max", price: 1000000, qty: 1 },
    ],
  },
  {
    id: "shop_food",
    npc: "food_vendor",
    name: "Brenna's Cookhouse",
    greeting: "Hot off the fire — buy a meal for the road, no rod or pan required. Heals you when the fighting's done.",
    stock: [
      { item: "ashfin_cooked", price: 10, qty: 1 },
      { item: "speckletrout_cooked", price: 23, qty: 1 },
      { item: "greyfin_cooked", price: 46, qty: 1 },
      { item: "ribperch_cooked", price: 78, qty: 1 },
    ],
  },

  // === REGION SETTLEMENT SHOPS — each themed to its region's trade ===========
  {
    id: "shop_frostgate",
    npc: "npc_frostgate_trader",
    name: "Frostgate Outfitters",
    greeting: "Hesk's stall — picks for the high cuttings, a flask, and a hot meal before the cold takes it.",
    stock: [
      { item: "pickaxe_3", price: 320, qty: 1 },
      { item: "pickaxe_4", price: 950, qty: 1 },
      { item: "embercite_ore", price: 90, qty: 5 },
      { item: "glass_flask", price: 30, qty: 3 },
      { item: "cooked_meat", price: 40, qty: 2 },
    ],
  },
  {
    id: "shop_deeplight",
    npc: "npc_deeplight_trader",
    name: "Deeplight Supply",
    greeting: "Mott's cave-stall — heavier picks for the deep stone, a flask, and food that keeps in the dark.",
    stock: [
      { item: "pickaxe_4", price: 950, qty: 1 },
      { item: "pickaxe_6", price: 4200, qty: 1 },
      { item: "glass_flask", price: 30, qty: 3 },
      { item: "cooked_meat", price: 40, qty: 2 },
    ],
  },
  {
    id: "shop_saltreach",
    npc: "npc_saltreach_trader",
    name: "Saltreach Fishmonger",
    greeting: "Brine's counter — rods for the river and the deep water, and the day's catch, smoked and ready.",
    stock: [
      { item: "rod_2", price: 180, qty: 1 },
      { item: "rod_3", price: 620, qty: 1 },
      { item: "redrun_chowder", price: 60, qty: 2 },
      { item: "cooked_meat", price: 40, qty: 2 },
    ],
  },
  {
    id: "shop_emberhearth",
    npc: "npc_emberhearth_trader",
    name: "Emberhearth Flux",
    greeting: "Sefa's trade — embercite for flux, charcoal for the forge, flasks for the brew. The warm ground gives plenty.",
    stock: [
      { item: "embercite_ore", price: 90, qty: 5 },
      { item: "charcoal", price: 24, qty: 5 },
      { item: "glass_flask", price: 30, qty: 3 },
      { item: "cooked_meat", price: 40, qty: 2 },
    ],
  },
  {
    id: "shop_mirehold",
    npc: "npc_mirehold_trader",
    name: "Mirehold Trade",
    greeting: "Tam's board — an eel-rod, a flask, and rations for the long boards across the moor.",
    stock: [
      { item: "rod_2", price: 180, qty: 1 },
      { item: "glass_flask", price: 30, qty: 3 },
      { item: "battle_ration", price: 70, qty: 2 },
      { item: "cooked_meat", price: 40, qty: 2 },
    ],
  },
  {
    id: "shop_lodgehold",
    npc: "npc_lodgehold_trader",
    name: "Lodgehold Bowyer",
    greeting: "Bryn's bench — hatchets for honest timber, bows and true-fletched arrows for the deep wood.",
    stock: [
      { item: "hatchet_3", price: 320, qty: 1 },
      { item: "hatchet_4", price: 950, qty: 1 },
      { item: "shortbow", price: 220, qty: 1 },
      { item: "longbow", price: 780, qty: 1 },
      { item: "arrow_knucklestone", price: 2, qty: 50 },
      { item: "arrow_ashiron", price: 6, qty: 50 },
    ],
  },
  {
    id: "shop_trailkeeper",
    npc: "trail_keeper",
    name: "The Trailkeeper's Kit",
    greeting: "Run the whole country and the Marks are yours to spend. Four pieces of running-gear — wear them all and you'll scarcely tire.",
    // Bought with Agility Marks — one per Varathian Trail lap, so the full set is
    // the work of many laps (60 Marks all told). A long-haul prestige reward.
    stock: [
      { item: "trail_hood", price: 0, qty: 1, costItem: "agility_mark", costQty: 12 },
      { item: "trail_vest", price: 0, qty: 1, costItem: "agility_mark", costQty: 20 },
      { item: "trail_legs", price: 0, qty: 1, costItem: "agility_mark", costQty: 16 },
      { item: "trail_boots", price: 0, qty: 1, costItem: "agility_mark", costQty: 12 },
      // Standing exits once the set is bought: run-fuel by the lap, and the
      // wren — a marks-only prestige companion at the top of the ladder.
      { item: "pot_runner", price: 0, qty: 1, costItem: "agility_mark", costQty: 2 },
      { item: "pet_trail_wren", price: 0, qty: 1, costItem: "agility_mark", costQty: 120 },
    ],
  },
  {
    id: "shop_stable",
    npc: "stablemaster",
    name: "The Ironvale Stables",
    greeting: "Every beast in the yard is broke to saddle. Pick by your purse — they all beat walking.",
    // A tight roster: four steeds per family (horse / wolf / draft / boar),
    // priced as a gold ladder, plus the cosmetics counter. Quest mounts (the
    // pony, the Silver Wolf, the Courier, the Destrier) are not for sale; the
    // rarest steeds (Runemarked, Ferryman's, Wraith-Steed…) are earned.
    stock: [
      // HORSES — the classic ladder.
      { item: "mount_horse", price: 2000, qty: 1 },
      { item: "mount_dustrunner", price: 90000, qty: 1 },
      // WOLVES & HOUNDS — the hunter's pick.
      { item: "mount_ridgewolf", price: 5000, qty: 1 },
      { item: "mount_nighthound", price: 6500, qty: 1 },
      { item: "mount_stormhound", price: 30000, qty: 1 },
      { item: "mount_hound", price: 80000, qty: 1 },
      // DRAFT & HEAVY — slow money, honest work.
      { item: "mount_ox", price: 700, qty: 1 },
      { item: "mount_mule", price: 1200, qty: 1 },
      { item: "mount_aurochs", price: 22000, qty: 1 },
      { item: "mount_packbear", price: 75000, qty: 1 },
      // BOARS — all shoulder.
      { item: "mount_bristleback", price: 6000, qty: 1 },
      { item: "mount_ironboar", price: 14000, qty: 1 },
      // Cosmetics: worn by WHATEVER you ride, forever. Berta's real profit.
      { item: "mount_blanket", price: 3500, qty: 1 },
      { item: "mount_plume", price: 6000, qty: 1 },
      { item: "saddle_silver", price: 12000, qty: 1 },
      { item: "saddle_gold", price: 25000, qty: 1 },
      { item: "horse_armor", price: 40000, qty: 1 },
    ],
  },
  {
    id: "shop_devotion",
    npc: "devotion_keeper",
    name: "The Shrinekeeper's Table",
    greeting: "Orun's light for the newly faithful — a first staff, plain robes, and a draught of Grace for the road. The potion I can only spare one at a time; the shrine gives it back slowly.",
    // A starter kit for the Devotion skill: the lowest staff + Acolyte robes, so a
    // new caster can leave Ironvale equipped. The Devotion Potion is rationed —
    // one on the table, one back every 15 minutes — so it never replaces bonemeal
    // brewing at a cauldron, just tides you over.
    stock: [
      { item: "staff_ashwood", price: 120, qty: 1 },      // sell 60
      { item: "staff_coldpine", price: 420, qty: 1 },     // sell 180 (Faith 10)
      { item: "mag_hood_1", price: 90, qty: 1 },          // sell 40
      { item: "mag_robe_1", price: 180, qty: 1 },         // sell 80
      { item: "mag_skirt_1", price: 120, qty: 1 },        // sell 55
      { item: "bonemeal", price: 15, qty: 5 },            // sell 6 — the potion's base
      // Rationed: one Devotion Potion on the table, one back every 15 minutes.
      { item: "potion_grace", price: 260, qty: 1, max: 1, restockMs: 900000 },
      // Once the warmth answered (the Dawn ending), the shrine spares a second.
      { item: "potion_grace", price: 220, qty: 1, max: 1, restockMs: 600000, requiresFlag: "endgame_shard_used" },
    ],
  },
  {
    id: "shop_pier",
    npc: "pier_warden",
    name: "Jacob's Fish Racks",
    greeting: "Chits for catch, catch for chits — that's the pier's whole economy. What'll you take off the racks?",
    // The Drowned Pier's reward loop: minigame catches pay Angler's Chits by
    // weight; the racks trade them straight back into raw cooking fish.
    stock: [
      { item: "copperling_raw", price: 0, qty: 1, costItem: "pier_chit", costQty: 1 },
      { item: "ribperch_raw", price: 0, qty: 1, costItem: "pier_chit", costQty: 2 },
      { item: "bristlepike_raw", price: 0, qty: 1, costItem: "pier_chit", costQty: 3 },
      { item: "redgill_raw", price: 0, qty: 1, costItem: "pier_chit", costQty: 4 },
      { item: "runestout_raw", price: 0, qty: 1, costItem: "pier_chit", costQty: 6 },
      { item: "deepscale_raw", price: 0, qty: 1, costItem: "pier_chit", costQty: 8 },
    ],
  },
];
