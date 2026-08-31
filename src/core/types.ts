/**
 * src/core/types.ts
 * ------------------
 * The shared "contract" of Varath World.
 *
 * RULE 1: the core is PURE. There is no DOM, no Date.now(), no Math.random()
 * anywhere in src/core. Anything that needs the current time or a random
 * number receives a `Ctx` argument instead (see below). This file only
 * declares *shapes* (types), so it is automatically pure.
 *
 * Keeping all the types in one place means the client and the (future)
 * multiplayer server can both speak exactly the same language.
 */

// ---------------------------------------------------------------------------
// Time + randomness are injected, never read from globals.
// ---------------------------------------------------------------------------

/**
 * Everything the core needs from "the outside world":
 *  - now: the current time in milliseconds (a plain number).
 *  - rng: a function that returns a random number in [0, 1), like Math.random.
 *
 * The client supplies these. A multiplayer server would supply its own
 * (e.g. a seeded RNG so every player sees the same outcome). The core never
 * calls Date.now() or Math.random() itself.
 */
export interface Ctx {
  now: number;
  rng: () => number;
  /**
   * Wall-clock time (Date.now epoch ms). Used only for things that must grow in
   * REAL time across sessions — farming patches — since `now` (performance.now)
   * resets every reload. Supplied by the client like `now` (the core stays pure).
   */
  epoch: number;
}

// ---------------------------------------------------------------------------
// Skills + items (the *names* are data; see src/content).
// ---------------------------------------------------------------------------

/**
 * Skills, named per the Varath canon. The three gathering skills plus the
 * combat trio (Vitality = health, Edge = accuracy, Vigour = damage). Ward
 * (defence) and Draw (ranged) exist in the wider game and will join once
 * armour and bows do.
 */
export type SkillId =
  // Gathering + processing skills (the 13 trainable skills of Varath).
  | "mining"
  | "smithing"
  | "forestry"
  | "woodcraft"
  | "hunter"
  | "fishing"
  | "cooking"
  | "farming"
  | "survivalist"
  | "herblore"
  | "construction"
  | "crafting"
  | "bounty"
  // Thieving: pickpockets, market stalls and locked chests. The one OSRS skill
  // Varath had no analogue for at all.
  | "thieving"
  // Agility: trained by running; raises run-energy duration + recharge.
  | "agility"
  // Combat skills.
  | "vitality"
  | "edge"
  | "vigour"
  | "ward"
  | "draw"
  // Faith: the fused magic/prayer skill. Trained by staff combat + burying bones.
  | "faith";

/**
 * The combat skills that train on every melee kill. Ward (defence) and Draw
 * (ranged) are registered skills but don't auto-train yet — they need the
 * combat-style / bow hooks, which arrive in a later bundle.
 */
export const COMBAT_SKILLS: SkillId[] = ["vitality", "edge", "vigour"];

/**
 * The melee combat style the player is using. It decides which combat skill
 * trains on a kill and grants a small bonus (Edge → accuracy, Vigour → damage,
 * Ward → defence/none), mirroring the idle game's style toggle.
 */
export type CombatStyle = "edge" | "vigour" | "ward" | "controlled";

/** One unlocked skill on the player: how much XP, and the level it implies. */
export interface SkillState {
  xp: number;
  level: number;
}

export type ItemId =
  | "knucklestone_ore"
  | "embercite_ore"
  | "ashiron_ore"
  | "ribstone_ore"
  | "spinite_ore"
  | "gold_ore"
  | "bloodore_ore"
  | "hearthite_ore"
  | "voidstone_ore"
  | "knucklestone_bar"
  | "ashiron_bar"
  | "ribstone_bar"
  | "spinite_bar"
  | "gold_bar"
  | "bloodore_bar"
  | "hearthite_bar"
  | "voidstone_bar"
  | "pickaxe_1"
  | "pickaxe_3"
  | "pickaxe_4"
  | "pickaxe_5"
  | "pickaxe_6"
  | "pickaxe_7"
  | "pickaxe_9"
  | "pickaxe_10"
  | "hatchet_1"
  | "hatchet_3"
  | "hatchet_4"
  | "hatchet_5"
  | "hatchet_6"
  | "hatchet_7"
  | "hatchet_9"
  | "hatchet_10"
  | "rod_1"
  | "rod_2"
  | "rod_3"
  | "rod_4"
  | "rod_5"
  | "rod_6"
  | "rod_gold"
  | "plank_ashwood"
  | "plank_briarwood"
  | "plank_coldpine"
  | "plank_stonewood"
  | "plank_greyoak"
  | "plank_ruewood"
  | "plank_ironbark"
  | "plank_heartoak"
  | "stone_block"
  | "cut_coldvein"
  | "cut_ribstone"
  | "ashiron_rivet"
  | "mortar_basic"
  | "mortar_refined"
  | "mortar_spinite"
  | "timber_frame"
  | "stonewood_beam"
  | "watchtower_frame"
  | "vault_stone"
  | "heartoak_beam"
  | "ashwood_log"
  | "alder_log"
  | "birch_log"
  | "coldpine_log"
  | "stonewood_log"
  | "greyoak_log"
  | "ruewood_log"
  | "deeproot_log"
  | "ironbark_log"
  | "heartoak_log"
  | "flint"
  | "ashwood_shaft"
  | "coldpine_shaft"
  | "greyoak_shaft"
  | "ruewood_shaft"
  | "deeproot_shaft"
  | "stonewood_haft"
  | "crude_shortbow"
  | "shortbow"
  | "longbow"
  | "greyoak_longbow"
  | "ruewood_shortbow"
  | "duskwood_warbow"
  | "deeproot_warbow"
  | "ashfin_raw"
  | "greyfin_raw"
  | "ribperch_raw"
  | "redgill_raw"
  | "deepscale_raw"
  | "eyeless_pike_raw"
  | "river_stone"
  | "old_hook"
  | "waterlogged_coin"
  | "redrun_pearl"
  | "eyeless_scale"
  | "burnt_food"
  | "ashfin_cooked"
  | "speckletrout_cooked"
  | "greyfin_cooked"
  | "ribperch_cooked"
  | "coldwater_eel_cooked"
  | "redgill_cooked"
  | "deepscale_cooked"
  | "eyeless_pike_cooked"
  | "silverdart_raw"
  | "silverdart_cooked"
  | "bramblecarp_raw"
  | "bramblecarp_cooked"
  | "copperling_raw"
  | "copperling_cooked"
  | "bristlepike_raw"
  | "bristlepike_cooked"
  | "gloomshad_raw"
  | "gloomshad_cooked"
  | "runestout_raw"
  | "runestout_cooked"
  | "frostgill_raw"
  | "frostgill_cooked"
  | "sword_1"
  | "sword_3"
  | "sword_4"
  | "sword_5"
  | "sword_6"
  | "sword_9"
  | "sword_10"
  | "armor_1"
  | "armor_3"
  | "armor_4"
  | "armor_5"
  | "armor_6"
  | "armor_9"
  | "armor_10"
  | "raw_rat_meat"
  | "raw_wolf_meat"
  | "raw_boar_meat"
  | "raw_bear_meat"
  | "raw_meat"
  | "cooked_meat"
  | "rat_meat_cooked"
  | "wolf_meat_cooked"
  | "boar_meat_cooked"
  | "bear_meat_cooked"
  | "venison_cooked"
  | "aurochs_cooked"
  | "wolf_pelt"
  | "boar_hide"
  | "bear_pelt"
  | "venison"
  | "aurochs_cut"
  | "thick_hide"
  | "sinew"
  | "trophy"
  | "rat_tail"
  | "worn_coin"
  | "wolf_fang"
  | "boar_tusk"
  | "bear_claw"
  | "rat_king_ear"
  | "silver_wolf_pelt"
  | "bristle_crown"
  | "forest_bear_skull"
  | "pet_mining"
  | "pet_smithing"
  | "pet_forestry"
  | "pet_woodcraft"
  | "pet_fishing"
  | "pet_cooking"
  | "pet_farming"
  | "pet_survivalist"
  | "pet_herblore"
  | "pet_bounty"
  | "pet_construction"
  | "pet_crafting"
  | "pet_hunter"
  | "pet_hollow_warden"
  | "pet_bog_warden"
  | "pet_spine_warlord"
  | "pet_marrow_keeper"
  | "pet_ashen_wyrm"
  | "pet_boneman"
  | "pet_green_baron"
  | "pet_hollow_prophet"
  | "pet_superior"
  | "pet_founder_wisp"
  | "horror_lantern"
  | "mount_blanket"
  | "mount_plume"
  | "saddle_silver"
  | "saddle_gold"
  | "horse_armor"
  | "cloak_greyback"
  | "cape_ending_flame"
  | "cape_ending_vault"
  | "cape_ending_dawn"
  | "cape_ending_road"
  | "reckoners_charm"
  | "ribstone_arrow"
  | "bloodore_arrow"
  | "voidstone_arrow"
  | "wood_ash"
  | "fine_charcoal"
  | "ashroot_compound"
  | "dawnspore_elixir"
  | "smoked_speckletrout"
  | "smoked_greyfin"
  | "smoked_ribperch"
  | "smoked_redgill"
  | "hill_stew"
  | "forest_roast"
  | "bone_broth"
  | "redrun_chowder"
  | "deepmeat_stew"
  | "battle_ration"
  | "warriors_draught"
  | "shield_oil"
  | "hunters_kit"
  | "helm_1"
  | "helm_3"
  | "helm_4"
  | "helm_5"
  | "helm_6"
  | "helm_9"
  | "helm_10"
  | "legs_1"
  | "legs_3"
  | "legs_4"
  | "legs_5"
  | "legs_6"
  | "legs_8"
  | "boot_1"
  | "boot_3"
  | "boot_4"
  | "boot_5"
  | "boot_6"
  | "boot_9"
  | "boot_10"
  | "shield_1"
  | "shield_3"
  | "shield_4"
  | "shield_5"
  | "shield_6"
  | "shield_9"
  | "shield_10"
  | "spear_1"
  | "spear_3"
  | "spear_4"
  | "spear_6"
  | "spear_9"
  | "spear_10"
  | "dagger_1"
  | "dagger_3"
  | "dagger_4"
  | "dagger_5"
  | "dagger_6"
  | "dagger_9"
  | "dagger_10"
  | "hammer_1"
  | "hammer_3"
  | "hammer_4"
  | "hammer_6"
  | "hammer_9"
  | "hammer_10"
  | "claymore_1"
  | "claymore_3"
  | "claymore_4"
  | "claymore_6"
  | "claymore_9"
  | "claymore_10"
  | "ring_1"
  // Act II dungeon uniques, tablets and keys
  | "barrow_king_signet"
  | "delvers_lantern"
  | "tablet_barrow"
  | "tablet_vault"
  | "barrow_key"
  | "vault_key"
  | "drowned_seal"
  | "storm_mantle"
  | "tablet_court"
  | "tablet_sky"
  | "court_key"
  | "sky_key"
  | "pale_greaves"
  | "undergate_key_1"
  | "undergate_key_2"
  | "ring_3"
  | "ring_5"
  | "ring_8"
  | "mount_pony"
  | "mount_horse"
  | "mount_destrier"
  | "mount_hound"
  | "mount_runemarked"
  | "mount_mule"
  | "mount_palecrawler"
  | "mount_deepstrider"
  | "mount_ox"
  | "mount_bristleback"
  | "mount_aurochs"
  | "mount_packbear"
  | "mount_greymane"
  | "mount_ridgewolf"
  | "mount_ironboar"
  | "mount_silverwolf"
  | "mount_courier"
  | "mount_stormhound"
  | "mount_dustrunner"
  | "mount_ferryman"
  | "mount_nighthound"
  | "mount_deepwing"
  | "mount_wraithsteed"
  | "mount_lodgeoutrider"
  | "mount_hollowsteed"
  | "prosp_helmet"
  | "prosp_jacket"
  | "prosp_trousers"
  | "prosp_boots"
  | "lumber_hat"
  | "lumber_top"
  | "lumber_legs"
  | "lumber_boots"
  | "angler_hat"
  | "angler_top"
  | "angler_waders"
  | "angler_boots"
  | "farmer_hat"
  | "farmer_jacket"
  | "farmer_legs"
  | "farmer_boots"
  | "agility_mark"
  | "pier_chit"
  | "lamp_agility"
  | "pet_pier_crab"
  | "trail_hood"
  | "trail_vest"
  | "trail_legs"
  | "trail_boots"
  | "cape_mining"
  | "cape_smithing"
  | "cape_forestry"
  | "cape_woodcraft"
  | "cape_fishing"
  | "cape_cooking"
  | "cape_farming"
  | "cape_survivalist"
  | "cape_bounty"
  | "cape_vitality"
  | "cape_edge"
  | "cape_vigour"
  | "cape_ward"
  | "cape_draw"
  | "cape_faith"
  | "cape_construction"
  | "cape_herblore"
  | "cape_crafting"
  | "cape_hunter"
  | "cape_agility"
  | "cape_max"
  | "cape_ironvale"
  | "cape_ashforge"
  | "cape_lodge"
  | "cape_pale_record"
  | "cape_heartmoor"
  | "cape_founder"
  | "charcoal"
  | "raw_hide"
  | "tanned_leather"
  | "cured_leather"
  | "hardened_leather"
  | "master_leather"
  | "silica_sand"
  | "glass_vial"
  | "glass_bead"
  | "glass_flask"
  | "rough_gem"
  | "cut_gem"
  | "leath_helm"
  | "leath_body"
  | "leath_legs"
  | "leath_boots"
  | "cured_helm"
  | "cured_body"
  | "cured_legs"
  | "cured_boots"
  | "hard_helm"
  | "hard_body"
  | "hard_legs"
  | "hard_boots"
  | "master_helm"
  | "master_body"
  | "master_legs"
  | "master_boots"
  | "craft_ring_1"
  | "craft_ring_2"
  | "craft_ring_3"
  | "craft_ring_gem"
  | "pearl_ring"
  | "stone_ring"
  | "craft_neck_power"
  | "craft_neck_shield"
  | "craft_neck_hunter"
  | "craft_neck_gem"
  | "sigil_knuckle"
  | "sigil_spine"
  | "crest_shield"
  | "crest_shield_master"
  | "herald_cape_ash"
  | "herald_cape_deep"
  | "tip_knucklestone"
  | "tip_ashiron"
  | "tip_ribstone"
  | "tip_bloodore"
  | "tip_hearthite"
  | "tip_voidstone"
  | "arrow_knucklestone"
  | "arrow_ashiron"
  | "arrow_ashiron_resin"
  | "arrow_hearthite"
  | "plant_fiber"
  | "unstrung_crude"
  | "unstrung_short"
  | "unstrung_long"
  | "unstrung_greyoak"
  | "unstrung_ruewood"
  | "unstrung_dusk"
  | "unstrung_deep"
  | "clue_easy"
  | "clue_medium"
  | "clue_hard"
  | "casket_easy"
  | "casket_medium"
  | "casket_hard"
  | "wayfarers_hat"
  | "pale_mask"
  // The Pale Regalia — a clue-exclusive cosmetic set found only in hard caskets
  // (the Underloft dead-kings' raiment; pale_mask is its head), plus the
  // Underking's Mantle, the ultra-rare apex of the whole trail chase.
  | "pale_cuirass"
  | "pale_legwraps"
  | "pale_treads"
  | "mantle_underking"
  | "bounty_crate"
  | "pet_bloodhound"
  | "pet_trail_wren"
  | "bird_nest"
  | "bark_strip"
  | "pine_resin"
  | "ironwood_sap"
  | "greyoak_gall"
  | "ruewood_splinter"
  | "dusk_bark"
  | "deeproot_chip"
  | "resin_shaft"
  | "mushroom_broth"
  | "thornberry_tonic"
  | "hearthroot_tea"
  | "nightshade_brew"
  | "ashroot_elixir"
  | "dawnspore_draught"
  | "deepmoss_broth"
  | "ashbloom_tea"
  | "health_elixir"
  | "ascendant_ember"
  | "ascendant_helm"
  | "ascendant_body"
  | "ascendant_legs"
  | "ascendant_boots"
  | "ascendant_shield"
  | "ascendant_claymore"
  | "ascendant_spear"
  | "ascendant_maul"
  | "ascendant_bow"
  | "ascendant_staff"
  | "shard_of_orun"
  | "blade_of_graves"
  | "marrow_flail"
  | "ashward_shield"
  | "greymail_plate"
  | "barrow_helm"
  | "orun_reaver"
  | "coldbone_bow"
  | "stoneguard_plate"
  | "ironveil_legs"
  | "warden_ring"
  | "bog_ward_helm"
  | "marrow_keep_plate"
  | "wyrm_helm"
  | "wyrm_body"
  | "wyrm_legs"
  | "wyrm_shield"
  | "wyrm_blade"
  | "bounty_helm"
  | "bounty_helm_g"
  | "hunters_cloak"
  | "creeper_eye"
  | "flensing_hook"
  | "maw_spike"
  | "hunters_horn"
  | "vane_badge"
  | "vane_letter"
  | "guards_signet"
  | "witch_ward_sprig"
  | "widow_staff"
  | "ashen_witch_hat"
  | "watchmans_buckler"
  | "watchmans_sallet"
  | "pet_brann"
  | "stalker_fangs"
  | "houndhide_cloak"
  | "wraithbone_staff"
  | "mawplate"
  | "bone_helm"
  | "bone_body"
  | "bone_legs"
  | "bone_shield"
  | "bonesaw"
  | "greenhood_hood"
  | "greenhood_cloak"
  | "greenhood_chaps"
  | "greenhood_boots"
  | "baron_longbow"
  | "prophet_hood"
  | "prophet_robe"
  | "prophet_skirt"
  | "prophet_sandals"
  | "prophet_staff"
  | "serpent_scale"
  | "spider_silk"
  | "bat_wing"
  | "golem_dust"
  | "wraith_fragment"
  | "orc_tooth"
  | "tarnished_ring"
  | "marrow_shard"
  // --- Batch 7: expanded OSRS-style drop-table loot (bones, gems, jewellery, junk) ---
  | "bones"
  | "big_bones"
  | "chipped_tooth"
  | "beast_horn"
  | "cracked_shell"
  | "uncut_sapphire"
  | "uncut_emerald"
  | "uncut_ruby"
  | "uncut_diamond"
  | "tarnished_amulet"
  | "gold_ring"
  | "broken_arrow"
  | "bent_nail"
  | "rusty_key"
  | "scrap_cloth"
  // --- Faith skill: wooden staff ladder, bonemeal + the Grace (Faith) potion ---
  | "staff_ashwood"
  | "staff_coldpine"
  | "staff_stonewood"
  | "staff_greyoak"
  | "staff_ruewood"
  | "staff_deeproot"
  | "bonemeal"
  | "pestle"
  | "potion_grace"
  | "potion_grace_1"
  | "vial_water"
  | "pot_gatherer"
  | "pot_gatherer_1"
  | "pot_warrior"
  | "pot_warrior_1"
  | "pot_runner"
  | "pot_runner_1"
  | "pot_ironhide"
  | "pot_ironhide_1"
  | "brace_tonic"
  | "brace_tonic_1"
  | "pot_deepgrace"
  | "pot_deepgrace_1"
  | "pot_archer"
  | "pot_archer_1"
  | "pot_battlemind"
  | "pot_battlemind_1"
  | "pot_sage"
  | "pot_sage_1"
  | "pot_mastergather"
  | "pot_mastergather_1"
  | "pot_hearthfire"
  | "pot_hearthfire_1"
  | "pot_orunstears"
  | "pot_orunstears_1"
  | "pot_antidote"
  | "pot_antidote_1"
  // Ranged + magic gear sets (4 tiers × 3 slots each) and the magic resource.
  // (Sinew already exists as a beast drop.)
  | "hex_cloth"
  | "rng_hood_1" | "rng_body_1" | "rng_legs_1" | "rng_boots_1"
  | "rng_hood_2" | "rng_body_2" | "rng_legs_2" | "rng_boots_2"
  | "rng_hood_3" | "rng_body_3" | "rng_legs_3" | "rng_boots_3"
  | "rng_hood_4" | "rng_body_4" | "rng_legs_4" | "rng_boots_4"
  | "rng_hood_5" | "rng_body_5" | "rng_legs_5" | "rng_boots_5"
  | "rng_hood_6" | "rng_body_6" | "rng_legs_6" | "rng_boots_6"
  | "mag_hood_1" | "mag_robe_1" | "mag_skirt_1" | "mag_boots_1"
  | "mag_hood_2" | "mag_robe_2" | "mag_skirt_2" | "mag_boots_2"
  | "mag_hood_3" | "mag_robe_3" | "mag_skirt_3" | "mag_boots_3"
  | "mag_hood_4" | "mag_robe_4" | "mag_skirt_4" | "mag_boots_4"
  | "mag_hood_5" | "mag_robe_5" | "mag_skirt_5" | "mag_boots_5"
  | "mag_hood_6" | "mag_robe_6" | "mag_skirt_6" | "mag_boots_6"
  | "seed_ashweed"
  | "seed_thornroot"
  | "seed_bloodberry"
  | "seed_coldmoss"
  | "seed_ironleaf"
  | "seed_greybloom"
  | "seed_spinethistle"
  | "seed_ruevine"
  | "seed_duskshade"
  | "seed_marrowflower"
  | "seed_hearthbloom"
  | "seed_orunroot"
  | "seed_ashwood"
  | "seed_coldpine"
  | "seed_stonewood"
  | "seed_greyoak"
  | "seed_ruewood"
  | "seed_deeproot"
  | "herb_ashweed"
  | "herb_thornroot"
  | "herb_bloodberry"
  | "herb_coldmoss"
  | "herb_ironleaf"
  | "herb_greybloom"
  | "herb_spinethistle"
  | "herb_ruevine"
  | "herb_duskshade"
  | "herb_marrowflower"
  | "herb_hearthbloom"
  | "herb_orunroot"
  | "fertilizer_basic"
  | "fertilizer_rich"
  | "forage_mushroom"
  | "forage_thornberry"
  | "forage_hearthroot"
  | "forage_nightshade"
  | "forage_ashroot"
  | "forage_dawnspore"
  | "forage_deepmoss"
  | "forage_ashbloom"
  | "forage_orunbloom"
  | "forge_token"
  | "pale_record_pass"
  | "seam_marker"
  | "greyoak_bough"
  | "orun_shard_large"
  | "cult_offering"
  | "berric_notes"
  | "maret_key"
  | "sera_lens"
  | "lenne_token"
  | "lodge_badge"
  | "greymane_pelt"
  | "greymane_tusk"
  | "ashforge_hammer"
  | "intact_burial_shard"
  | "sera_cipher_pendant"
  | "lodge_token"
  | "order_cipher_key"
  | "apprentice_mark_blade"
  | "berric_ledger"
  | "warden_longbow"
  | "chronicler_seal"
  | "ironbark_shard"
  | "heartoak_amber"
  // --- Progression dead-zone fills (mid/high-tier content) ---
  | "hunger_fang"
  | "sealbreaker_bulwark"
  | "mantle_of_the_below"
  | "pet_vorlag"
  // The Gaunt Below — the repeatable ~110 boss that fills the 100→125 ladder
  // gap (T5·04), and its signature crusher + pet.
  | "gaunt_maul"
  | "pet_gaunt"
  | "pet_greyback"
  | "neck_warden"
  | "neck_amber"
  | "neck_orun"
  | "marsh_eel_raw"
  | "marsh_eel_cooked"
  | "moorhart_raw"
  | "moorhart_cooked";

/**
 * The wearable equipment slots, named per the idle game's canon `equip` values.
 * A piece of gear declares which one it fills via ItemDef.slot; the player wears
 * one item per slot. (Tool/meta slots like pickaxe/mount aren't worn here yet.)
 */
export type EquipSlot =
  | "mainhand"
  | "offhand"
  | "helmet"
  | "armor"
  | "legs"
  | "boots"
  | "ring"
  | "necklace"
  | "cape"
  | "companion"
  // A bow in `ranged` makes the player fight at range (training Draw), drawing
  // from arrows worn in `ammo`. A `mount` grants faster overworld movement.
  | "ranged"
  | "ammo"
  | "mount";

/**
 * A static description of an item. Lives in src/content/items.ts.
 *
 * Most fields are copied verbatim from the Varath idle game's `ITEMS` table so
 * the two games describe the same objects identically. Many are pure data that
 * the spatial game doesn't use yet (canon `slot`, weapon `acc`, food `buff`s,
 * mount/pet/cape `meta`); they're carried losslessly so nothing is invented or
 * dropped when the systems that consume them arrive. See docs/CANON_LEDGER.md.
 */
/**
 * An item's full combat contribution, in OSRS's vocabulary: an attack bonus and
 * a defence bonus against each of the five damage types, plus the three damage
 * bonuses and a Grace (prayer) bonus.
 *
 * These are DERIVED from the fields items already carry — see
 * `src/content/equipBonus.ts`. No item authors them by hand; a handful of
 * marquee pieces override the derivation.
 */
export interface EquipBonus {
  /** Attack bonus vs each damage type — which one is used depends on the
   *  attack the player is making. */
  aStab: number;
  aSlash: number;
  aCrush: number;
  aMagic: number;
  aRange: number;
  /** Defence bonus vs each damage type — which one is used depends on the
   *  attack coming in. This is where the armour triangle lives. */
  dStab: number;
  dSlash: number;
  dCrush: number;
  dMagic: number;
  dRange: number;
  /** Melee strength — feeds max hit. */
  str: number;
  /** Ranged strength — feeds ranged max hit. */
  rngStr: number;
  /** Magic damage — a flat add, matching Varath's existing magic maths rather
   *  than OSRS's percentage model. */
  magDmg: number;
  /** Grace (prayer) bonus. */
  prayer: number;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Short flavour text shown in tooltips / the log. */
  description: string;
  /** Canon icon glyph. */
  icon?: string;
  /** Canon category label, e.g. "Ores", "Weapons", "Food". */
  cat?: string;
  /** Sell value in gold (from the idle game's GOLD_VALUES). */
  sell?: number;
  /** Food only: hit points restored when eaten. */
  heals?: number;
  /**
   * OSRS-style stacking: most items are individual (one per inventory slot);
   * only a few — ammo, currency-like tokens — stack. Undefined ⇒ not stackable.
   * (Ammo, `slot: "ammo"`, is treated as stackable automatically.)
   */
  stackable?: boolean;

  // --- Gear ---
  /**
   * Canon equip/tool slot string: "mainhand", "armor", "helmet", "legs",
   * "boots", "offhand", "ring", "necklace", "cape" (wearable) or "pickaxe"/
   * "hatchet"/"rod"/"ranged"/"ammo"/"mount"/"companion" (not worn here yet).
   * An item is equippable when this matches one of the EquipSlot values.
   */
  slot?: string;
  /** Tier on the canon material ladder (1–10). */
  tier?: number;
  /** Explicit equip level, overriding the tier→level table (for uniques like
   *  the level-75 dragon set). Gated on the slot's combat skill. */
  equipLevel?: number;
  /** Master stars needed to wear this, across all skills. The Ascendant tier
   *  gates on mastery rather than level, because level stops at 100 and this
   *  gear sits above everything a level can reach. See masteryRequirement. */
  equipMastery?: number;
  /**
   * Gathering-tool kind. Tools are wielded in the mainhand (slot "mainhand")
   * but tagged here so the core knows a mainhand item is a hatchet/pickaxe/rod
   * and which gathering skill gates and uses it.
   */
  tool?: "hatchet" | "pickaxe" | "rod";
  /** Weapon accuracy bonus. */
  acc?: number;
  /** Weapon damage bonus / added to max hit. */
  dmg?: number;
  /** Armour defence bonus. */
  def?: number;
  /** Weapon attack interval (ms). */
  speed?: number;
  /** Weapon attack style: "slash" | "stab" | "crush". */
  attackStyle?: string;
  /** Weapon family, e.g. "sword", "dagger", "claymore". */
  wepType?: string;
  /** A weapon or ammo coated to poison what it hits: the poison damage it
   *  inflicts on a landed blow. */
  poison?: number;
  /** Drinking this clears poison and venom outright. */
  curePoison?: boolean;
  /** Whether the weapon occupies both hands (no shield). */
  twoHand?: boolean;
  /** A bow: worn in the mainhand but fired at range (uses Draw + the quiver). */
  ranged?: boolean;
  /** A staff: worn in the mainhand but casts at range (uses Faith + Grace). The
   *  basic bolt is free; `acc`/`dmg` are the flat casting boost of the tier. */
  magic?: boolean;
  /** Run energy restored when drunk (Runner's Blend — the agility potion). */
  energyRestore?: number;
  /** Multi-dose potions: the item this becomes after a drink (OSRS doses). */
  doseNext?: ItemId;
  /** Faith only: Grace restored when this is drunk (the Faith / Grace potion). */
  graceRestore?: number;
  /** Bones: Faith XP granted when this item is buried. */
  buryXp?: number;
  /** Openable container (supply crates, trail caskets): a tap prises it open
   *  and the core rolls its loot table (resolved by item id). */
  container?: boolean;
  /** Ranged gear bonuses (summed across worn armour, added to bow ratings). */
  rngAcc?: number;
  rngDmg?: number;
  /** Magic gear bonuses (summed across worn armour, added to staff ratings). */
  magAcc?: number;
  magDmg?: number;
  /** Override the skill that gates equipping this (else derived from slot/flags).
   *  Ranged armour gates on Draw, magic robes on Faith. */
  equipSkill?: SkillId;
  /** Crafting tier for leather armour (1–4). */
  craftTier?: number;
  /** Rarity label, e.g. "legendary". */
  rarity?: string;
  /** Lore/dungeon tag for legendary drops. */
  lore?: string;

  // --- Food / potion buffs (data only until the buff hook lands) ---
  buff?: string;
  buffAmt?: number;
  buffMs?: number;

  /** Lossless passthrough for meta-system fields (mount/pet/cape perks). */
  meta?: Record<string, string | number | boolean>;
}

/** One occupied inventory slot. The inventory is an array of 28 of these. */
export interface InventorySlot {
  item: ItemId;
  qty: number;
  /**
   * A "note" (bank slip): a stackable paper form of the item. Notes let you
   * carry huge quantities in a single slot and trade/sell them, but they can't
   * be used — not eaten, worn, buried, or crafted with. Withdraw as a note at a
   * bank; deposit a note (or bank it) to turn it back into the item. Undefined
   * ⇒ an ordinary item.
   */
  noted?: boolean;
}

// ---------------------------------------------------------------------------
// The map (tiles).
// ---------------------------------------------------------------------------

export type TileType =
  | "grass"
  | "dirt"
  | "path"
  | "stone"
  | "water"
  | "moss"
  // The Spine: impassable rock peaks and walkable high snow.
  | "mountain"
  | "snow"
  // Heartmoor: soft, murky moor ground.
  | "bog"
  // The Ashfen Flats: warm, cracked geothermal ground.
  | "ash"
  // The Marrow Deeps: dark cave floor and impassable cave rock.
  | "cave"
  | "cave_wall"
  // The Eyeless Sea: deep open water (impassable, like water).
  | "deep"
  // Ironvale: dressed-stone city walls and buildings (impassable).
  | "wall"
  // Player housing interiors: a warm timber plank floor (walkable).
  | "plank"
  /** Warm strand sand — beaches at the estuary and pond shores. */
  | "sand";

/** The hand-made zone, decoded from the text map in src/content/map.ts. */
export interface WorldMap {
  name: string;
  width: number;
  height: number;
  /** Row-major grid of tile types: tiles[y * width + x]. */
  tiles: TileType[];
}

// ---------------------------------------------------------------------------
// World objects (trees, rocks, fishing spots, the NPC, the monster).
// ---------------------------------------------------------------------------

export type ObjKind =
  | "tree"
  | "rock"
  | "fishing_spot"
  | "npc"
  | "monster"
  | "bank"
  | "fire"
  | "furnace"
  | "anvil"
  /** An examine-only landmark (the Wind-Shrine, the sealed Spine Vault). */
  | "shrine"
  /** A farming plot: plant a seed, wait real time, harvest. */
  | "plant_patch"
  | "tree_patch"
  /** A boss-dungeon entrance / exit that teleports the player. */
  | "portal"
  /** A Hunter snare/trap node: set it, catch game, collect hide + meat. */
  | "trap"
  /** A Bounty board: take a slay-task, claim it for Hunt Marks + Bounty XP. */
  | "bounty_board"
  /** The Grand Exchange clerk's booth: trade on the world market here. */
  | "grand_exchange"
  /** A wild plant clump: forage it for Survivalist herbs, mushrooms and roots. */
  | "forage_spot"
  /** A claimable homestead yard at a hamlet — the anchor of player housing. */
  | "housing_plot"
  /** A furniture footing inside a claimed plot: build/replace a piece here. */
  | "build_hotspot"
  /** A market stall to steal from (Thieving). */
  | "stall"
  /** A door between a homestead lot and its private interior instance. */
  | "house_door"
  /** A sealed doorway to an add-on room (a wing) — build the extension to open it. */
  | "room_seal"
  /** A dungeon's sealed slab/portcullis: blocks until its puzzle flag is set
   *  (spawned with hiddenByFlag = the flag; it vanishes — and stops blocking —
   *  the moment the puzzle completes). */
  | "dungeon_gate"
  /** One lever/plinth of an ordered dungeon puzzle: throw the group in the
   *  right order (hinted by nearby plaques) or the mechanism resets. */
  | "puzzle_lever"
  /** A dungeon reward chest: one-time loot, remembered by a player flag. */
  | "dungeon_chest"
  /** Surface ruin dressing at a dungeon mouth — a broken pillar, a fallen
   *  arch, a rubble mound. Blocks movement; examine-only. */
  | "ruin_prop"
  /** Dungeon floor dressing — bone piles, corpses, urns, cold camps, nests,
   *  braziers, a boss's dais. Walk-over (never blocks, so the verified choke
   *  math is untouched); examine-only; drawn under everything that stands. */
  | "remains"
  /** A Herblore cauldron: brew tinctures, elixirs and draughts. */
  | "cauldron"
  /** A Construction workbench: cut, frame and fit building components. */
  | "workbench"
  /** A Crafting table: tan leather, blow glass, cut gems and make jewellery. */
  | "crafting_table"
  /** A market stall / street cart — decorative city dressing (examine-only). */
  | "cart"
  /** A town fountain — the central square's centrepiece (examine-only). */
  | "fountain"
  /** A Woodcraft sawmill / bowyer's bench: planks, shafts, rods, bows, arrows. */
  | "sawmill"
  /** Ambient wildlife — wanders, flees the player, doesn't block (decorative). */
  | "critter"
  /** A street lamp — city dressing that casts warm light at night. */
  | "lamppost"
  /** A post-and-rail fence segment — pens, paddocks and garden bounds
   *  (decorative; `species` picks the run: "h" horizontal, "v" vertical). */
  | "fence"
  /** A small clinker rowboat — moored on water or hauled out on the strand. */
  | "boat"
  /** A clump of cattail reeds at a pond edge (decorative; examine-only). */
  | "reeds"
  /** A dead tree — fallen mossy log or standing snag (`species`: "log"/"snag"). */
  | "deadfall"
  /** A directional signpost at a junction (examine for the way). */
  | "signpost"
  /** A cairn of bones and skulls — grim dressing for the Boneman's lair. */
  | "bone_cairn"
  /** A waystone: pay the Courier's toll to fast-travel between them. */
  | "waystone"
  /** An Agility obstacle: one leg of a training circuit (traverse for XP). */
  | "agility_obstacle"
  /**
   * A discoverable relic: a torn page, a grave-rubbing, an old marker. Reading
   * it the first time reveals a lore fragment (recorded in the Archive) and
   * gives a small finder's reward. Its text lives in Content.lore (by loreId).
   */
  | "relic"
  /** The deep-water cast point at the end of the quest-gated pier: interacting
   *  hooks a fish and opens the tension minigame. */
  | "pier_spot"
  /** The pier's records board: examine to see the top five catches by weight. */
  | "record_board"
  /** A roped-off barrier at the pier's landward end, present only until the
   *  pier-warden's quest grants access (an inverse `hiddenByFlag` gate). */
  | "pier_gate"
  /** The Varathian Trail's billboard at the trail head: examine to read your
   *  lap tally and progress toward the Trailblazer set. */
  | "trail_board"
  /** A settlement's heraldic banner — a tall standard flying the town's own
   *  colours (WorldObjectDef.tint) over its square. Decorative; examine-only. */
  | "banner";

/**
 * One entry of reactive NPC chatter. When an NPC is talked to and has no quest
 * business to conduct, the core speaks the FIRST reactive entry whose conditions
 * the player currently meets (checked top to bottom), letting townsfolk and
 * leaders acknowledge story beats, faction rank and reputation as the world
 * changes. Falls through to the static `lines` when none match. Pure data.
 */
export interface ReactiveLine {
  /** Every one of these story flags must be set. */
  requiresFlags?: string[];
  /** None of these flags may be set (lets a later beat supersede an earlier one). */
  blockedByFlags?: string[];
  /** Optional reputation gate: standing with `faction` must be at least `amount`. */
  minRep?: { faction: FactionId; amount: number };
  /** What the NPC says when this entry is the first one that matches. */
  lines: string[];
}

/**
 * The *definition* of an object placed in the world: its kind and where it
 * sits. This is content (src/content/spawns.ts). The live, changing parts
 * (depleted? current HP? respawn timer?) live in WorldObjectState below so
 * that content stays separate from player/runtime state (RULE 3).
 */
export interface WorldObjectDef {
  id: string;
  kind: ObjKind;
  /** Tile coordinates of the object. */
  x: number;
  y: number;
  /** Display name, e.g. "Aldric" or "Hill Wolf". */
  name: string;
  /** Monsters only: which MonsterStats (in Content.monsters) this uses. */
  monster?: string;
  /** Story-gated object: only present (visible, clickable, interactable) once
   *  the player has this flag set. Used to keep a quest boss hidden until the
   *  quest that unlocks it has revealed its lair. */
  requiresFlag?: string;
  /** Inverse story gate: the object is present UNTIL the player owns this flag,
   *  then vanishes. Used for a barrier that a quest removes (e.g. the pier gate
   *  that disappears once access is granted). */
  hiddenByFlag?: string;
  /** `remains` only: which floor-dressing shape to draw (bones, skeleton,
   *  sitting, urn, camp, tools, crate, coins, nest, banner, kelp, sarco,
   *  device, brazier, dais, throne). */
  variant?: string;
  /**
   * Resource nodes (tree/rock/fishing_spot) only: the SkillAction id this node
   * yields (e.g. "fell_coldpine"). Determines the item, XP and level required.
   * Defaults to the tier-1 action for the node's kind if omitted.
   */
  resource?: string;
  /** Fishing spots only: the pool of catches (each a `fish_*` action id + a
   *  relative weight). On each catch the core rolls one you meet the level for.
   *  `resource` stays the lowest-level catch (gates starting + the cast anim). */
  catches?: { action: string; weight: number }[];
  /** Wandering world boss only: the tiles it patrols between. The core moves it
   *  from one to another on a slow clock and announces the sighting — a live
   *  world event players chase down. */
  /** A daily routine: where this NPC stands at each phase of the day, as
   *  `at` = fraction of the day cycle (0 = midnight, 0.5 = noon). The creature
   *  ambles around its CURRENT post rather than its spawn, and walks to the next
   *  post when the hour turns. Absent = stands near its spawn all day, as before. */
  routine?: { at: number; x: number; y: number }[];
  patrol?: Vec2[];
  /** NPC only: the lines spoken when talked to. */
  lines?: string[];
  /** NPC only: reactive chatter that supersedes `lines` when its conditions are
   *  met — the world acknowledging what the player has done. The core speaks the
   *  FIRST matching entry (checked top to bottom), else falls through to `lines`.
   *  See ReactiveLine. */
  reactiveLines?: ReactiveLine[];
  /** A tree/rock species tag for rendering variety (e.g. "greyoak", "coldpine"). */
  species?: string;
  /** Portal only: the tile the player is teleported to. */
  target?: Vec2;
  /** Boss-dungeon entrance only: the dungeon id it leads to (for display). */
  dungeon?: string;
  // --- Agility obstacles ---
  /** Which course this obstacle belongs to. */
  course?: string;
  /** For an NPC who is a bounty guide: the bountyGuides id they hand out tasks
   *  for. Talking gives dialogue; the default action opens their bounty panel. */
  bountyGuide?: string;
  /** Position in the circuit (0 = the start; must be cleared in order). */
  order?: number;
  /** Where the player lands after traversing (the far side of the obstacle). */
  exit?: Vec2;
  /** Agility XP for clearing this obstacle. */
  xp?: number;
  /** Minimum Agility level to attempt the obstacle (gates the whole course). */
  levelReq?: number;
  /** Visual variant: "log" | "net" | "rope" | "wall" | "stones" | "beam". */
  obstacle?: string;
  /** Relic only: which LoreDef (in Content.lore) this relic reveals when read. */
  loreId?: string;
  /** build_hotspot only: the furniture category this footing accepts. */
  category?: string;
  /** build_hotspot / room_seal only: the id of the housing_plot it belongs to. */
  plot?: string;
  /** room_seal only: the house tier that unseals this doorway (1=Homestead,
   *  2=Manor, 3=Estate). The seal is open once player.home.tier >= this. */
  tier?: number;
  /** puzzle_lever only: the puzzle group this lever belongs to. Throwing every
   *  lever of a group in `order` sets the flag `pz_<puzzle>`; a wrong throw
   *  resets the group. (`order` doubles as this lever's place in the sequence.) */
  puzzle?: string;
  /** puzzle_lever only: how the group is solved, so different dungeons play
   *  differently instead of all being the same order-of-levers (T6·01):
   *   - "order" (default): throw in ascending `order`; a wrong pull resets.
   *   - "balance": throw ANY subset whose `weight`s sum to `puzzleTarget`;
   *      order is irrelevant, but overshooting the target springs it back.
   *   - "timed": throw in ascending `order` AND each within `puzzleWindowMs`
   *      of the last — a run that resets if you dawdle between levers.
   *   - "beacon": a line-of-sight lights-out — striking a beacon FLARES (toggles)
   *      the beacons in its `links` sightline, not itself; light them all at
   *      once. No reset: you toggle your way to the answer. */
  puzzleMode?: "order" | "balance" | "timed" | "beacon";
  /** beacon mode: the ids of the other beacons THIS one's sightline flares
   *  (toggles) when struck. */
  links?: string[];
  /** balance mode: this lever's weight toward the group's `puzzleTarget`. */
  weight?: number;
  /** balance mode: the exact sum of thrown `weight`s that opens the group. */
  puzzleTarget?: number;
  /** timed mode: ms allowed between one correct pull and the next. */
  puzzleWindowMs?: number;
  /** dungeon_chest only: what the chest holds. Granted once per player. */
  loot?: { item: ItemId; qty: number }[];
  /** dungeon_gate only: a key that opens THIS gate instead of a puzzle. Using
   *  the gate with the key in your pack consumes it and sets `key_<id>` (the
   *  gate's hiddenByFlag), swinging it open for good. */
  keyItem?: ItemId;
  /** banner only: the settlement's heraldic field colour (a hex string). The
   *  renderer hangs a tinted pennant/standard in this colour so each town flies
   *  its own colours over the square. Purely cosmetic. */
  tint?: string;
  /** shrine only: turns this landmark into a repeatable "witness the heat"
   *  devotion event — offering `item` (consumed) grants `faithXp` Devotion XP
   *  and refills Grace, tying a region's lore to something you DO (T6·02). */
  witnessOffering?: { item: ItemId; faithXp: number };
  /** shrine only: a one-off exploration find. Searching the site the first time
   *  grants this reward and sets `flag`, so a discovery hook pays in an action +
   *  drop instead of only prose (reuses the relic finder-reward loop) (T6·03). */
  find?: {
    flag: string;
    /** The discovery message shown when the search first pays off. */
    found: string;
    item?: ItemId;
    qty?: number;
    gold?: number;
    xp?: { skill: SkillId; amount: number };
  };
}

/** One possible drop from a monster: an item with an independent roll chance. */
export interface Drop {
  item: ItemId;
  /** Probability in [0, 1] that this item drops on a kill. */
  chance: number;
  /** Optional quantity range (defaults to 1). */
  min?: number;
  max?: number;
  /** Canon rarity label: "always" | "common" | "uncommon" | "rare" | "legendary". */
  tier?: string;
}

/**
 * The combat stats + loot table for a kind of monster, ported verbatim from the
 * idle game's `MONSTERS` table. `acc`/`def`/`speed`/`attackStyle`/`weakness` are
 * carried so the combat-math upgrade can use them; today's simplified combat
 * uses `maxHit`/`hp`/`xp` only. See docs/CANON_LEDGER.md.
 */
export interface MonsterStats {
  id: string;
  name: string;
  /** Canon icon glyph. */
  icon?: string;
  level: number;
  hp: number;
  /** Attack accuracy rating. */
  acc?: number;
  /** Defence rating (reduces the player's hit chance). */
  def?: number;
  /** Highest damage the monster can deal in one hit. */
  maxHit: number;
  /** Attack interval in ms. */
  speed?: number;
  /** Tiles this monster can strike from. 1 (default) = melee; higher = an archer
   *  / caster that looses from afar and holds its distance instead of closing. */
  attackRange?: number;
  /** Combat XP granted (to each combat skill) on a kill. */
  xp: number;
  /** Attack style: "slash" | "stab" | "crush". */
  attackStyle?: string;
  /** Poison damage this creature inflicts on a landed blow, if any. With
   *  `venom` it is the ramping kind an antidote is the only answer to. */
  poison?: number;
  venom?: boolean;
  /** Styles this monster is weak to (extra damage). */
  weakness?: string[];
  drops: Drop[];
  desc: string;
  /** Boss only: special moves that fire during combat. */
  mechanics?: BossMechanic[];
  /** True for a named boss — listed in the Boss Log records page. */
  boss?: boolean;
  /** Boss Log hint: where to find this boss / how to take it on. */
  bossHint?: string;
  /** Bounty level needed to FIGHT this creature at all (OSRS-Slayer style).
   *  Warren-bred monsters carry this; ordinary overworld creatures don't. */
  bountyReq?: number;
}

/** A boss's special move. Fires inside the monster's attack resolution. */
export type BossMechanic =
  /** Every `every`-th hit lands as a telegraphed heavy blow (×`mult` damage). */
  | { type: "heavy"; every: number; mult: number; tell: string }
  /** Below `below` HP fraction, the boss enrages once: all damage ×`mult`. */
  | { type: "enrage"; below: number; mult: number; tell: string }
  /** Each landed hit heals the boss for `frac` of the damage it dealt. */
  | { type: "lifedrain"; frac: number; tell: string }
  /** Below `below` HP fraction, the boss heals `amount` once. */
  | { type: "selfheal"; below: number; amount: number; tell: string }
  /** Every `every`-th attack is a ground SLAM: the tiles around the player's
   *  position are marked for `windupMs`, then anyone still standing there
   *  takes ×`mult` damage. The one boss move you dodge by MOVING — step off
   *  the marked ground before it lands. */
  | { type: "slam"; every: number; mult: number; radius: number; windupMs: number; tell: string }
  /** Thick hide: melee damage to the boss is cut by `reduce` (0–1) unless the
   *  hit exploits its weakness. Rewards bringing the right attack style. */
  | { type: "scaleguard"; reduce: number; tell?: string }
  /** Searing hide: each landed MELEE hit burns the attacker for `frac` of the
   *  damage dealt back at them. Ranged attackers avoid it. */
  | { type: "recoil"; frac: number; tell: string }
  /** A ward that TURNS: as the boss's HP falls through even thresholds, its
   *  live weakness cycles through `styles` in order (top slice → styles[0],
   *  bottom slice → last). One loadout no longer solves the whole fight — you
   *  rotate attack style to keep exploiting it. Overrides the static `weakness`
   *  while present. Each turn is announced with the new style named. */
  | { type: "wardshift"; styles: string[]; tell: string }
  /** Adds: below `below` HP fraction, the boss calls its kin ONCE — the spawns
   *  gated behind `flag` (pre-placed near the boss) stand up and join the fight,
   *  turning a single-target fight into a multi-target one. Cleared when the
   *  boss dies or respawns. Reuses the delve wave-spawn plumbing. */
  | { type: "summon"; below: number; flag: string; tell: string }
  /** Directional CLEAVE: every `every`-th attack, a `length`-deep, 3-wide swath
   *  in front of the boss (toward where you stand) is marked for `windupMs`,
   *  then everything still in it takes ×`mult` damage. Unlike the slam (dodge by
   *  stepping off your own tile), you dodge a cleave by stepping to the boss's
   *  FLANK — out of the arc. Reuses the slam marked-tile primitive. */
  | { type: "cleave"; every: number; mult: number; length: number; windupMs: number; tell: string };

/** The mutable runtime state for a single world object. */
export interface WorldObjectState {
  id: string;
  /** Resources: false while depleted and waiting to respawn. */
  available: boolean;
  /** Time (ms) at which a depleted/dead object comes back. */
  respawnAt: number;
  /** Monsters only: current hit points (undefined for non-combat objects). */
  hp?: number;
  /** Monsters only: time (ms) of the monster's next attack while in combat. */
  nextAttackAt?: number;
  /** Monsters only: risen as a SUPERIOR (Bounty encounter) — bigger, far
   *  tougher, and worth a burst of Marks. Transient; not saved. */
  superior?: boolean;
  /**
   * Wandering creatures (npc/monster) only: their live position, which drifts
   * within a small region around the spawn tile (def.x/def.y). Undefined for
   * fixed objects, which always render at their def coordinates.
   */
  pos?: Vec2;
  /** The tile this creature stepped FROM — the client interpolates `prevPos`→`pos`
   *  over NPC_STEP_TICKS so a stepping creature glides smoothly instead of
   *  jumping. Undefined for fixed objects. */
  prevPos?: Vec2;
  /** Game-tick count when this creature's current tile step began (paired with
   *  the fixed NPC step duration for the client's glide). */
  moveStartTick?: number;
  /** The tile this creature is currently stepping toward (null = standing). */
  wanderTarget?: Vec2 | null;
  /** Aggressive monster only: while `now < pursueUntil` it gives chase after a
   *  fleeing player (OSRS aggro), off its spawn leash, until it times out or the
   *  player breaks away — then it walks home. Transient, never persisted. */
  pursueUntil?: number;
  /** puzzle_lever only: thrown as part of the current (correct) sequence.
   *  Transient — a reload resets an unfinished puzzle; the finished flag
   *  (`pz_<group>`) is what persists. */
  thrown?: boolean;
  /** When standing still, the time (ms) at which it picks its next step. */
  nextWanderAt?: number;
  /** Shrine/altar: no Grace refill from THIS stone until this time (ms). A
   *  per-stone breather so one stone can't be camped as an infinite battery —
   *  transient, never persisted. */
  graceCooldownUntil?: number;
  /** Farming patch: the CROPS key currently planted (undefined = empty). */
  crop?: string;
  /** Farming patch: wall-clock epoch (ms) the seed was planted. */
  plantedAt?: number;
  /** Farming patch: fertilizer worked in (1 = basic +20%, 2 = rich +35% survival).
   *  Spent by the next harvest. */
  fert?: 1 | 2;
  /** Boss combat: how many times it has swung (drives the "heavy" cadence). */
  swings?: number;
  /** Poison burning through a monster — the mirror of the player's own. */
  poison?: { dmg: number; nextAt: number; hitsLeft: number } | null;
  /** Boss combat: whether the one-shot enrage / self-heal have fired. */
  enraged?: boolean;
  healed?: boolean;
  /** Boss combat (wardshift): the weakness-phase index last announced, so a
   *  turning ward tells the player only when it actually changes. Transient. */
  wardPhase?: number;
  /** Boss combat (summon): whether this boss has already called its adds, so
   *  the one-shot summon fires exactly once per fight. Transient. */
  summoned?: boolean;
  /** Faith curse (Marrow Grip): the target's defence is dropped until this time.
   *  Transient combat state — never persisted. */
  defCurse?: { amount: number; until: number };
  /** An armed ground slam: marked tiles centred on (x,y) that detonate at
   *  `at` for ×`mult` of the boss's max hit. A directional CLEAVE fills `tiles`
   *  with an explicit swath instead of the (x,y)-radius box; when present, both
   *  the detonation and the render use `tiles`. Transient — never persisted. */
  slam?: { x: number; y: number; radius: number; at: number; mult: number; tiles?: Vec2[] } | null;
  /** housing_plot only: set once the player has claimed this homestead. */
  owned?: boolean;
  /** build_hotspot only: the FurnitureDef id currently built here (else empty). */
  furniture?: string;
}

// ---------------------------------------------------------------------------
// The player.
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * The player's cosmetic look. Colours are hex strings; styles are ids chosen
 * from the lists in src/client/avatar.ts (the renderer falls back to a default
 * style for any unknown id, so old saves stay safe). `tunic` is the top colour
 * (kept under its original name so pre-styles saves still load).
 */
export interface Appearance {
  name: string;
  /** Skin colour. */
  skin: string;
  /** Hair colour — also tints facial hair. */
  hair: string;
  /** Top (torso) colour. */
  tunic: string;
  /** Trouser/skirt colour. */
  legColor: string;
  /** Footwear colour. */
  shoeColor: string;
  /** Hairstyle id (e.g. "short", "long", "mohawk"). */
  hairStyle: string;
  /** Facial-hair id (e.g. "none", "stubble", "beard"). */
  facial: string;
  /** Top design id (e.g. "plain", "vneck", "sash"). */
  top: string;
  /** Leg design id (e.g. "trousers", "kilt", "shorts"). */
  legs: string;
  /** Footwear design id (e.g. "boots", "sandals", "clogs"). */
  shoes: string;
  /** Body silhouette. Optional — an absent build reads as "average", which is
   *  why the union does not name it. Widening this list is safe in both
   *  directions: an old save only ever wrote "lean" or "broad", and an unknown
   *  id read by an older client falls through to the average frame. */
  build?: "lean" | "broad" | "heavy";
  /** How tall the character stands. Absent reads as average. */
  height?: "short" | "tall";

  // --- The face -------------------------------------------------------------
  // Every field below is OPTIONAL and holds a string, which is what makes this
  // safe to add: hydratePlayer reads an explicit allow-list and ignores anything
  // that is not on it, so an old save simply arrives without these and falls
  // back to the default look. Nothing here needs a save-version bump — and a
  // bump without a migrator would discard every existing character.
  /** Eye shape id (e.g. "open", "narrow", "wide"). */
  eyes?: string;
  /** Iris colour. */
  eyeColor?: string;
  /** Brow shape id (e.g. "even", "heavy", "arched"). */
  brows?: string;
  /** Face shape id — how wide the jaw reads (e.g. "oval", "square", "narrow"). */
  jaw?: string;
  /** Facial-hair colour. Absent means "the same as the hair", which is what the
   *  figure did unconditionally before — so a beard can now go grey on its own. */
  beardColor?: string;
}

/** What the player is currently busy doing, if anything. */
export type ActivityKind =
  | "idle"
  | "woodcutting"
  | "mining"
  | "fishing"
  /** Setting and checking a Hunter trap (a depleting gather, like a snare). */
  | "trapping"
  /** Foraging a wild plant clump for Survivalist (a depleting gather). */
  | "foraging"
  | "combat"
  /** Any station recipe (cooking, smelting, smithing…). */
  | "crafting";

export interface Activity {
  kind: ActivityKind;
  /** The world object this activity targets (e.g. the tree being chopped). */
  targetId: string | null;
  /** Crafting only: the SkillAction id being repeated at a station. */
  actionId: string | null;
  /** Time (ms) of the next "swing"/roll for this activity. */
  nextActionAt: number;
  /** How long one swing/roll takes (ms) — lets the client show progress. */
  actionInterval: number;
  /**
   * Gathering only: the tool-tier / tincture / cape speed multiplier that was
   * applied when the activity began. Fishing re-rolls its interval per catch, so
   * it needs the multiplier again on every reschedule — without it, the rod tier
   * and the gathering tincture only ever applied to the FIRST cast.
   */
  speedMult?: number;
}

/**
 * A Bounty guide (task-giver). Each covers a pair of zones and scales the flat
 * rewards of the tasks it hands out. Ported from the idle game's BOUNTY_GUIDES.
 */
export interface BountyGuide {
  id: string;
  name: string;
  title: string;
  icon: string;
  desc: string;
  /** Bounty level needed to take tasks from this guide. */
  levelReq: number;
  /** The task-pool zone keys this guide draws from (keys of Content.bountyTasks). */
  zones: string[];
  /** Multipliers applied to a task's flat xp / marks rewards. */
  xpMult: number;
  marksMult: number;
}

/** A bounty-task template: slay N of a monster for Bounty XP + Hunt Marks. */
export interface BountyTaskDef {
  monster: string;
  required: number;
  xp: number;
  marks: number;
  /** Bounty level needed before this template can be rolled. */
  minLevel: number;
  /** Story flag that must be set before this task can be rolled — used to gate
   *  boss bounties behind their unlock quest, so a flag-gated boss is never
   *  assigned to a hunter who can't reach it. */
  requiresFlag?: string;
}

/**
 * A bounty monster's home ground — the one named place where it reliably
 * lives (OSRS-Slayer style). Individuals still wander their patch, and a few
 * strays may roam the wider world, but the ground is where a hunter is TOLD
 * to look: the guide and the contract name it in words, and that's all the
 * help you get — no arrows, no map rings. Finding it is the adventure.
 */
export interface HuntingGround {
  /** The place's name, e.g. "Bearwallow" — quoted by the guide and contract. */
  name: string;
  /** A guide's one-line direction to it, e.g. "southern Greyoak, below the snares". */
  hint: string;
  /** Centre tile of the ground (world coordinates) — the spawn cluster's anchor. */
  x: number;
  y: number;
  /** Rough radius of the ground in tiles — how far its residents range. */
  r: number;
}

/** A live, assigned bounty task — a template plus running progress. */
export interface BountyTask {
  monster: string;
  required: number;
  progress: number;
  /** Rewards already scaled by the assigning guide's multipliers. */
  xp: number;
  marks: number;
  /** Which guide assigned it (for display). */
  guideId: string;
}

/** The player's Bounty progression: marks, the chosen guide, the active task. */
export interface BountyState {
  /** Hunt Marks — the Bounty currency, spent at the Bounty board's shop. */
  marks: number;
  /** The currently selected guide id (whose board hands out tasks). */
  guideId: string;
  /** The active task, or null when none is taken. */
  task: BountyTask | null;
  /** Consecutive tasks claimed without abandoning. Each claim past the first
   *  pays escalating bonus Hunt Marks (+5% per streak, capped +50% — +100%
   *  with the Reckoner's Favour unlock); abandoning a task resets it to 0. */
  streak: number;
  /** Lifetime tasks claimed. Drives milestone claims (every 10th pays ×3
   *  Marks, every 50th ×6, every 100th ×10 — OSRS-Slayer style). Persisted. */
  tasksDone: number;
  /** The wall-clock day (floor(epoch / 86,400,000)) of the last claim — the
   *  first claim of each real day pays double base Marks. Persisted. */
  /** Epoch ms of the last daily-double claim (rolling 20h window; the old
   *  save key name is kept — stale day-index values read as 'long ago'). */
  lastClaimDay: number;
  /** Monster ids the hunter has blocked — never rolled into a task. Capped at a
   *  base allotment, widened by the "wider_net" unlock. */
  blocked: string[];
  /** The last few DISTINCT monsters assigned (newest first, capped) — the
   *  "recent assignments" list you can block from without holding the task. */
  history: string[];
  /** Permanent Hunt-Marks unlocks the hunter owns (BountyUnlock ids), e.g.
   *  "superior" (enables Superior encounters) or "wider_net" (more block slots). */
  unlocks: string[];
}

/** One listing in the Bounty board's Hunt-Marks shop. */
export interface BountyShopListing {
  item: ItemId;
  cost: number;
  qty: number;
  label: string;
  desc: string;
}

/** A one-time, permanent Hunt-Marks purchase (OSRS Slayer-reward style): pay
 *  once, own it forever. Effects are resolved by id in the core. */
export interface BountyUnlock {
  id: string;
  name: string;
  cost: number;
  desc: string;
}

export interface Player {
  /**
   * Position in *tile units*. Under the fixed game tick this is a WHOLE tile —
   * the sim hops one tile per tick (two while running), OSRS-style. The client
   * interpolates between `prevPos` and `pos` for smooth on-screen motion, so the
   * simulation stays tile-quantized while the render stays fluid.
   */
  pos: Vec2;
  /** The tile the current move-step started FROM — the interpolation origin the
   *  client eases toward `pos` over the step's duration. After a teleport it is
   *  set equal to `pos` so the avatar never streaks across the map. */
  prevPos: Vec2;
  /** Game-tick count when the current tile step began, and how many base ticks it
   *  spans (walk/run/mount cadence). The client interpolates prevPos→pos across
   *  `[stepStartTick, stepStartTick+stepDurTicks]`; the next step is taken once
   *  that window elapses. */
  stepStartTick: number;
  stepDurTicks: number;
  /** Tiles still to be walked, in order. Empty when standing still. */
  path: Vec2[];
  hp: number;
  maxHp: number;
  /** Where the player respawns after dying. */
  spawn: Vec2;
  skills: Record<SkillId, SkillState>;
  /** Fixed-length array of length 28; empty slots are null. */
  inventory: (InventorySlot | null)[];
  /** The bank chest: unlimited, stacked storage (item id -> quantity). */
  bank: Partial<Record<ItemId, number>>;
  /** Free-placement home: owned-but-unplaced furniture + everything placed. */
  home: HomeState;
  /** Live progress through each dungeon lever puzzle: group id → how many of
   *  its sequence are correctly thrown. Transient (an unfinished puzzle resets
   *  on reload); a COMPLETED puzzle persists as the flag `pz_<group>`. */
  puzzles: Record<string, number>;
  /** Worn gear: one item id per equipment slot (absent slots are empty). */
  equipment: Partial<Record<EquipSlot, ItemId>>;
  /**
   * Arrows currently nocked — the count behind the worn `ammo` slot (equipment
   * stores only the arrow id, so the quantity lives here). Each ranged swing
   * spends one; when it hits 0 the `ammo` slot empties.
   */
  quiver: number;
  /** Special-attack charge (0-100): builds as your blows land; a full bar can
   *  be armed (SPECIAL) to turn the next swing into the weapon's finisher. */
  spec: number;
  /** Whether the special is armed — the next swing spends the full bar. */
  specArmed: boolean;
  /** Active trail clues: tier -> the world object id its riddle points at. */
  clues: Partial<Record<"easy" | "medium" | "hard", string>>;
  /** The remaining legs of an active multi-step HARD trail, current step first
   *  (each carries its own riddle so the client never has to guess which chain a
   *  shared landmark belongs to). `clues.hard` always mirrors `clueSteps[0].target`.
   *  Empty/absent means the hard clue (if any) is a legacy single-step one that
   *  pays its casket on the first solve. Easy/medium trails never use this. */
  clueSteps?: { target: string; riddle: string }[];
  /** The melee combat stance (Accurate/Aggressive/Defensive/Controlled) — its
   *  live acc/dmg/def tradeoff, and which combat skill the next kill trains. */
  /**
   * The stance weighting and XP destination. Still the source of truth for both,
   * but it is now DERIVED from the chosen attack option rather than set
   * directly — see `attackOption`.
   */
  combatStyle: CombatStyle;
  /**
   * Poison: a fixed bite every interval that WEAKENS as it runs its course.
   * Transient like `buffs` — deliberately not saved, so logging out is not a
   * cure but a crash is not a punishment either.
   */
  poison?: { dmg: number; nextAt: number; hitsLeft: number } | null;
  /**
   * Held in place after a botched theft — you cannot move or act until it
   * passes. Transient, like the rest of the status block.
   */
  stunnedUntil?: number;
  /**
   * Venom: like poison but it RAMPS and never decays. Only an antidote or death
   * ends it, which is what makes a venomous foe a fight you prepare for.
   */
  venom?: { stack: number; nextAt: number } | null;
  /**
   * Which of the wielded weapon's attack options is selected (an index into its
   * family's list in content/weaponStyles.ts). The option decides the DAMAGE
   * TYPE of every swing, which is what the weakness triangle reads — so this is
   * how you meet a crush-weak foe with a spear and switch to Pound mid-fight.
   */
  attackOption?: number;
  /**
   * The last option chosen per weapon family, so swapping weapons restores your
   * preference for that family instead of resetting you to the default.
   */
  attackOptionByType?: Record<string, number>;
  /** Run toggle: when on (and energy remains), the player moves at sprint speed. */
  running: boolean;
  /** Run energy, 0–100. Drains while sprinting, regenerates otherwise. */
  energy: number;
  /**
   * Grace — the Faith resource that powers spellbook casts. Clamped to
   * [0, Faith level]. Refills ONLY by praying at a shrine/altar or drinking a
   * Faith Potion; it never regenerates in the field. The basic staff bolt is free.
   */
  grace: number;
  /**
   * The attack spell set to autocast while wielding a staff: each swing fires it
   * (spending Grace) instead of the free basic bolt, falling back to the free
   * bolt when Grace runs out. Null = just the free bolt. Persisted preference.
   */
  autocastSpell?: string | null;
  /**
   * The protection blessing currently held (a spell id with kind "blessing"),
   * or null. One at a time, OSRS-prayer-style: while held it halves incoming
   * damage of its style and drains Grace steadily; it gutters out when Grace
   * runs dry. Transient (not persisted) — you re-light it each session.
   */
  blessing?: string | null;
  /**
   * The playMs stamp of the last FULL Delve Cache claimed. The cache pays in
   * full once per ~90 minutes of play, reduced between — a lockout that can't
   * be gamed by the system clock because it runs on played time. Persisted.
   */
  delveLastFullPlayMs?: number;
  /** Deepest Marrow Delve DEPTH floor ever reached (0/undefined = never past the
   *  fixed waves). The endless-mode long-tail record — surfaced on Records. */
  delveDepthRecord?: number;
  /**
   * Progress on the current Agility circuit: the course id and the next
   * obstacle order expected. Null when not mid-lap. Transient (not persisted).
   */
  agilityLap: { course: string; next: number } | null;
  /**
   * Set while mid-traversal of an Agility obstacle: which obstacle, and when the
   * climb finishes (a short delay so a hop "takes a second"). Transient.
   */
  agilityHop?: { objId: string; at: number } | null;
  /** Aggressive monsters won't re-engage until this time (ms) — a brief grace set
   *  when you move, so you can walk away from a fight instead of being re-locked
   *  every tick. Transient. */
  aggroImmuneUntil?: number;
  /** How many full laps of the Varathian Trail have been completed (persisted;
   *  drives the trail billboard and each lap's single Agility Mark). */
  trailLaps?: number;
  /** Pending XP rewards awaiting a skill choice (an "XP lamp" queue). Each quest
   *  that pays XP drops its amount here; the player picks the skill to pour it
   *  into. Persisted so an unspent lamp survives a reload. */
  xpLamps?: number[];
  /** Collection log: every item id the player has ever obtained (deduped), for
   *  the OSRS-style collection log under the Records tab. Persisted. */
  collection?: ItemId[];
  /** Wall-clock (Date.now) time the free Recall becomes available again.
   *  Epoch-based so the cooldown survives reloads. Persisted. */
  recallReadyEpoch?: number;
  /** The last Courier waystone the player rode TO (an objId). The Wayfare
   *  recall returns them here from anywhere, so re-visiting a far region isn't
   *  a fresh cross-map commute every time. Persisted. */
  lastWaystone?: string;
  /** Wall-clock time the paid Wayfare recall is available again. Persisted. */
  wayfareReadyEpoch?: number;
  /** How many pack stacks spilled on the player's LAST knockout (0 = kept
   *  everything). Read by the death overlay to reassure a newcomer whether they
   *  lost anything — it's never permadeath. Transient (recomputed each death). */
  deathSpillStacks?: number;
  /**
   * Set when energy hits 0; forces walking until energy recovers a little, so
   * the player doesn't micro-stutter between sprint and walk on an empty bar.
   * Transient — derived from energy, not persisted.
   */
  winded: boolean;
  /** Active quests, keyed by quest id. */
  quests: Record<string, QuestState>;
  /** Ids of quests already completed. */
  questsDone: string[];
  /** Ids of lore fragments discovered (the Archive / found-lore collection). */
  lore: string[];
  /** Story flags set by quests (faction joins, plot beats, choices). */
  flags: string[];
  /** Coins. Spent at shops; earned by selling and (later) quest rewards. */
  gold: number;
  /** Standing with each of the four factions (can be negative). */
  reputation: Record<FactionId, number>;
  /** Cumulative tallies for achievements. `duelRating` is an Elo-style ladder
   *  number (starts at DUEL_RATING_BASE); `duelStreak` is the current win streak,
   *  `duelBestStreak` the record — the PvP long-tail goals. */
  stats: { goldEarned: number; monstersSlain: number; duelWins?: number; duelLosses?: number; duelRating?: number; duelStreak?: number; duelBestStreak?: number };
  /** The wager locked into a live duel: removed from the pack when both sides
   *  accept, returned or forfeited by DUEL_RESOLVE. Persisted so closing the
   *  game mid-duel can't dupe the stake — an unresolved stake found on boot is
   *  treated as an abandoned duel and forfeited. */
  duelStake?: { duelId: string; gold: number; items: { item: ItemId; qty: number }[] };
  /** Per-boss kill tally (keyed by monster id), shown in the Boss Log. */
  bossKills: Record<string, number>;
  /** Claimed boss kill-milestone keys ("<bossId>:<kills>"). */
  bossMilestonesClaimed: string[];
  /** Combat-achievement feats earned, keyed "<bossId>:<feat>" — see FIGHT_FEATS
   *  in worldCore. Optional so old saves load; the core seeds it on first use. */
  combatFeats?: string[];
  /**
   * Account mode, OSRS's account types. Absent reads as "standard", so every
   * existing save is a standard account without a migration.
   *  - `ironman`  — no Grand Exchange, no player trade, no duel stakes. What you
   *                 use, you made.
   *  - `hardcore` — Ironman with one life: a death spends it and the account
   *                 falls back to `ironman`, keeping the record of how it ended.
   *  - `ultimate` — Ironman with no bank at all.
   * Chosen at character creation. It can be relaxed (toward `standard`) but
   * never tightened, so nobody can bank a hoard and then claim the restriction.
   */
  mode?: "standard" | "ironman" | "hardcore" | "ultimate";
  /** How a Hardcore life ended, once it has — kept as the account's record. */
  hardcoreDeath?: { cause: string; combatLevel: number; playMs: number };
  /** Total active play time in milliseconds (accumulated each tick). */
  playMs: number;
  /**
   * Kills since the last Shard of Orun. The shard is a rare drop, but a pity
   * timer guarantees one once this reaches SHARD_PITY — so the main story is
   * never hard-walled by RNG. Resets to 0 whenever a shard is obtained.
   */
  killsSinceShard: number;
  /** Ids of achievements already unlocked (so they stay unlocked). */
  achievements: string[];
  /** Ids of Area Diaries whose XP-lamp reward has been claimed. */
  diariesClaimed: string[];
  /** Ids of settled player trades already applied to the pack (dupe guard). */
  tradesApplied: number[];
  /** The player's name, cosmetic colours and body styles (character creator). */
  appearance: Appearance;
  /** Bounty progression: Hunt Marks, chosen guide, active slay-task. */
  bounty: BountyState;
  /**
   * Active temporary buffs from food and potions, keyed by buff kind (one per
   * kind; re-using refreshes it). `until` is a monotonic `ctx.now` deadline —
   * not persisted, so buffs clear on reload.
   */
  buffs: Record<string, { amount: number; until: number }>;
  activity: Activity;
  /**
   * A pending interaction queued while the player walks toward something:
   * once the path finishes, the core starts this interaction. Null when the
   * player is just walking to a spot.
   */
  pendingInteractId: string | null;
  /** Talk/shop mode queued alongside pendingInteractId (shopkeepers). Transient. */
  pendingInteractMode: "talk" | "shop" | "steal" | null;
  /**
   * A loot pile the player is walking toward: once the path finishes, the core
   * grabs it (mirroring pendingInteractId). Null when not walking to loot.
   * Transient — never persisted.
   */
  pendingPickup: { x: number; y: number; id?: number; qty?: number } | null;
  /**
   * A campfire the player is walking toward to cook at: on arrival the core
   * emits OPEN_CRAFT and the client opens the cook menu. Transient.
   */
  pendingCook: { x: number; y: number } | null;
  /**
   * The shop/bank/board the player currently stands at (set on interaction,
   * cleared when they walk away). Trade/bank/bounty intents are only honoured
   * while it matches — so the core, not just the UI, enforces "be at the
   * counter". Transient; never persisted.
   */
  station: { kind: "shop" | "bank" | "bounty" | "exchange" | "records"; id?: string } | null;
  /** The fish currently on the line at the pier, while the tension minigame is
   *  in progress. Rolled when the cast hooks; committed on a land, discarded on
   *  a snap or when the player does anything else. Transient — never persisted. */
  hooked: HookedFish | null;
  /** The pier's hall of fame: the player's (and seeded rivals') best catches,
   *  kept sorted by weight, longest first, capped at five. Persisted. */
  fishingRecords: FishRecord[];
  alive: boolean;
  /** Time (ms) at which a dead player respawns. */
  respawnAt: number;
}

// ---------------------------------------------------------------------------
// The whole world state (everything the core owns and the client renders).
// ---------------------------------------------------------------------------

/** A pile of loot lying on the ground, dropped by a kill until picked up. */
export interface GroundItem {
  id: number;
  item: ItemId;
  qty: number;
  x: number;
  y: number;
  /** Monotonic ctx.now deadline after which it vanishes. */
  despawnAt: number;
}

export interface WorldState {
  map: WorldMap;
  player: Player;
  /** Live state for every world object, keyed by object id. */
  objects: Record<string, WorldObjectState>;
  /** Loot on the floor (kill drops), awaiting pickup. Transient; not saved. */
  ground: GroundItem[];
  /** The live boss-fight record behind combat achievements: opens on the first
   *  blow struck at a boss, closes on the kill. Transient and deliberately so —
   *  a half-finished no-hit run must not survive a reload. Only the feats it
   *  earns persist, on `Player.combatFeats`. */
  fight?: { boss: string; startedAt: number; hurt: number; ate: number };
  /** Incrementing id for ground piles. */
  groundSeq: number;
  /** Per-shop remaining stock (shopId → item → units left). Time-gated so a shop
   *  can't be bought out instantly. Runtime/session only — not persisted. */
  shopStock?: Record<string, Record<string, number>>;
  /** When the shops next top up their stock (ms, wall-clock via Ctx). */
  shopRestockAt?: number;
  /** When healing items (food/potions) next top up — a longer, separate cooldown
   *  so buying meals can't replace fishing/hunting/cooking for heals. */
  shopFoodRestockAt?: number;
  /** Per-line restock clocks for rationed listings (key "shopId:item" → next
   *  top-up ms). Runtime/session only. Used by the Devotion Potion (one/15min). */
  shopLineRestockAt?: Record<string, number>;
  /** A player-lit campfire (Survivalist): burns for a while as a cooking source,
   *  then goes out. One at a time; runtime/session only — not persisted. */
  campfire?: { x: number; y: number; expiresAt: number } | null;
  /**
   * The player's gravestone: everything they were carrying that death took,
   * waiting where they fell.
   *
   * Runtime-only, exactly like `campfire` — a save written before graves existed
   * simply has none, and nothing needs migrating. There is only ever ONE: dying
   * again while a grave stands collapses the old one, which is what makes a
   * corpse run a decision rather than a stack of free retries.
   */
  grave?: {
    x: number;
    y: number;
    items: { item: ItemId; qty: number }[];
    gold: number;
    expiresAt: number;
    /** How many times you have died since this grave was raised. */
    deaths: number;
  } | null;
  /** timed-puzzle deadlines: group id → the ms by which the next correct lever
   *  must be thrown before the run resets. Runtime/session only — a timed puzzle
   *  simply restarts on reload, so it never needs persisting. */
  puzzleTimers?: Record<string, number>;
  /** An active Marrow Delve run: the current wave and kills left in it. Waves
   *  reveal flag-gated arena spawns; clearing the last pays the Delve Cache.
   *  Past the fixed waves the run continues into endless DEPTH (`depth` ≥ 1),
   *  each floor pressing harder — leave with your record or die to it.
   *  Session-only — dying or finishing ends the run. */
  delve?: { wave: number; remaining: number; depth?: number } | null;
  /** When the wandering world boss next relocates along its patrol (runtime). */
  worldBossMoveAt?: number;
  /**
   * Tiles ("x,y") currently occupied by a wandering creature (its standing tile
   * and the tile it's stepping into). Rebuilt each tick so walkability — and the
   * player's pathfinding — routes around creatures wherever they've drifted to.
   */
  creatureTiles: Set<string>;
  /** The last real (wall/perf) time tick() ran, so we can measure elapsed time
   *  and feed the fixed-tick accumulator below. */
  lastTick: number;
  /** --- Fixed game tick (OSRS-style ~0.6s cadence) ---
   *  The sim advances in discrete TICK_MS steps. `tickNow` is the DISCRETE sim
   *  clock (advances by exactly TICK_MS per step) that every `now >= nextAt`
   *  schedule is compared against, so combat/gathering/respawns all land on the
   *  shared beat. `tickAcc` is the leftover real time not yet consumed into a
   *  step; `tickCount` counts steps; `lastTickAt` is the real time of the last
   *  step, which the client uses to interpolate render position within a tick. */
  tickNow: number;
  tickAcc: number;
  tickCount: number;
  lastTickAt: number;
}

// ---------------------------------------------------------------------------
// Intents: the ONLY way the client asks the world to change (RULE 2).
// ---------------------------------------------------------------------------

/** "Walk to this tile." The client has already pathfound; it sends the path. */
export interface MoveIntent {
  type: "MOVE";
  path: Vec2[];
}

/**
 * "Walk next to this object, then interact with it." The client provides a
 * path to a tile adjacent to the object; the core performs the interaction
 * once the player arrives.
 */
export interface InteractIntent {
  type: "INTERACT";
  objId: string;
  path: Vec2[];
  /**
   * Shopkeepers only: "talk" forces dialogue (and quests), "shop" forces the
   * trade window. Omitted = the default (a shopkeeper opens their shop unless a
   * quest step needs them right now).
   */
  mode?: "talk" | "shop" | "steal";
}

/** "Stop whatever I'm doing" (cancels movement and current activity). */
export interface CancelIntent {
  type: "CANCEL";
}

/** "Eat the food in this inventory slot" (restores HP). */
export interface EatIntent {
  type: "EAT";
  slot: number;
}

/** "Deposit every one of this item from my pack into the bank." */
export interface DepositIntent {
  type: "DEPOSIT";
  item: ItemId;
  /** How many to deposit; omitted = the whole stack. */
  qty?: number;
}

/** "Withdraw some of this item from the bank into my pack." */
export interface WithdrawIntent {
  type: "WITHDRAW";
  item: ItemId;
  /** How many to withdraw; omitted = 1. (A big number = withdraw all.) */
  qty?: number;
  /** Withdraw as a note (bank slip): the whole amount as one stackable slot,
   *  instead of one pack slot per unit. */
  noted?: boolean;
}

/**
 * Move gold or an item between the pack and the Grand Exchange escrow. This is
 * only the LOCAL side of an Exchange deposit/withdraw — the actual escrow lives
 * server-side (Supabase); the client pairs this with a server call. "take"
 * removes from the pack (a no-op if you don't have it), "give" adds it back.
 */
export interface GeMoveIntent {
  type: "GE_MOVE";
  dir: "take" | "give";
  kind: "gold" | "item";
  item?: ItemId;
  amount: number;
  /** Deliver a "give" of items as a note (bank slip) — big Exchange collections
   *  arrive in one slot rather than overflowing the pack. */
  noted?: boolean;
}

/** Apply the agreed swap of a settled player trade. Idempotent: the core
 *  ignores a tradeId it has already applied, so polling can't double-pay. */
export interface TradeApplyIntent {
  type: "TRADE_APPLY";
  tradeId: number;
  give: { gold: number; items: { item: ItemId; qty: number }[] };
  get: { gold: number; items: { item: ItemId; qty: number }[] };
}

/** Lock my wager into a duel: gold + items leave the pack into escrow. */
export interface DuelStakeIntent {
  type: "DUEL_STAKE";
  duelId: string;
  gold: number;
  items: { item: ItemId; qty: number }[];
}

/** Settle a finished duel against MY save (each client applies its own half,
 *  like TRADE_APPLY). Idempotent: only applies while the matching stake is
 *  held in escrow. `won` restores my stake and adds the winnings; `lost`
 *  forfeits the stake; `draw`/`void` return it. Food eaten during the fight
 *  is deducted from the real pack here. */
export interface DuelResolveIntent {
  type: "DUEL_RESOLVE";
  duelId: string;
  outcome: "won" | "lost" | "draw" | "void";
  winnings?: { gold: number; items: { item: ItemId; qty: number }[] };
  foodEaten?: { item: ItemId; qty: number }[];
}

/** Replace the pier's records board with a merged shared top-five (the client
 *  folds in other players' catches from the online board). Applying it re-runs
 *  the Golden-Rod check, so a champion beaten by a real rival elsewhere is
 *  correctly dethroned. */
export interface SetPierRecordsIntent {
  type: "SET_PIER_RECORDS";
  records: FishRecord[];
}

/** "Wear the gear in this inventory slot" (swapping out anything already worn). */
export interface EquipIntent {
  type: "EQUIP";
  slot: number;
}

/** "Take off whatever I'm wearing in this slot" (back into the pack). */
export interface UnequipIntent {
  type: "UNEQUIP";
  equipSlot: EquipSlot;
}

/**
 * "Make this recipe at the station I'm standing at." The actionId is a
 * SkillAction id (see src/content/actions.ts); objId is the station, so the
 * client can show progress on it. The core repeats it until materials run out.
 */
export interface CraftIntent {
  type: "CRAFT";
  actionId: string;
  objId: string;
}

/** "Switch my melee combat stance" (its acc/dmg/def tradeoff + which skill the
 *  next kill trains). */
/** "Swing this weapon a different way" — an index into the wielded weapon
 *  family's attack options. Supersedes SET_STYLE, which only chose a stance. */
/** Relax the account mode. Only ever toward less restriction (see canSetMode) —
 *  an Ironman may give up the claim, but nobody can acquire it after the fact. */
export interface SetAccountModeIntent {
  type: "SET_MODE";
  mode: "standard" | "ironman" | "hardcore" | "ultimate";
}

export interface SetAttackOptionIntent {
  type: "SET_ATTACK_OPTION";
  option: number;
}

export interface SetStyleIntent {
  type: "SET_STYLE";
  style: CombatStyle;
}

/** Rearrange the pack: swap two inventory slots (OSRS drag-to-move). */
export interface SwapSlotsIntent {
  type: "SWAP_SLOTS";
  a: number;
  b: number;
}

/** "Cast this Faith spell" (spends Grace; must be wielding a staff). */
export interface CastSpellIntent {
  type: "CAST_SPELL";
  spell: string;
}

/** "Begin a Marrow Delve run" (spoken to the Delve Warden in the vault). */
export interface StartDelveIntent {
  type: "START_DELVE";
}

/** "Light (or douse) this protection blessing" — no staff needed; a prayer,
 *  not a cast. One at a time; it drains Grace steadily while held. */
export interface ToggleBlessingIntent {
  type: "TOGGLE_BLESSING";
  spell: string;
}

/** "Set (or clear) the attack spell I autocast with a staff." */
export interface SetAutocastIntent {
  type: "SET_AUTOCAST";
  spell: string | null;
}

/** "Bury the bones in this inventory slot" (grants Faith XP). */
export interface BuryIntent {
  type: "BURY";
  slot: number;
}

/** "Crush the bones in this slot into bonemeal" (needs a pestle in the pack). */
export interface GrindIntent {
  type: "GRIND";
  slot: number;
}

/** "Strike this log with flint and light a campfire" (needs flint in the pack).
 *  Spawns a transient `state.campfire` you can cook at, OSRS-style. */
export interface LightFireIntent {
  type: "LIGHT_FIRE";
  slot: number;
}

/** Flip the run/walk toggle. */
export interface ToggleRunIntent {
  type: "TOGGLE_RUN";
}

/** "Pick option N at a quest's choice step." */
export interface ChooseIntent {
  type: "CHOOSE";
  quest: string;
  option: number;
}

/** "Pour the next pending XP reward (an XP lamp) into this skill." */
export interface SpendXpLampIntent {
  type: "SPEND_XP_LAMP";
  skill: SkillId;
}

/** "Pay the toll and fast-travel to this waystone." */
export interface TravelIntent {
  type: "TRAVEL";
  to: string;
}

/** "Buy one listing (its bundle of `qty`) of this item from this shop." */
export interface BuyIntent {
  type: "BUY";
  shop: string;
  item: ItemId;
  /** How many bundles to buy (default 1). The core stops early at whichever
   *  wall comes first — stock, funds, or pack room. Capped at 50 per intent. */
  qty?: number;
}

/** "Sell this many of an item from my pack for its gold value." */
export interface SellIntent {
  type: "SELL";
  item: ItemId;
  qty: number;
}

/** "Plant this crop's seed in this patch." */
export interface PlantIntent {
  type: "PLANT";
  patchId: string;
  crop: string;
}

/** "Take a new bounty task from this guide" (replaces no current task). */
export interface BountyTaskIntent {
  type: "BOUNTY_TASK";
  guideId: string;
}

/** "Claim my finished bounty task" (pays out Hunt Marks + Bounty XP). */
export interface BountyClaimIntent {
  type: "BOUNTY_CLAIM";
}

/** "Abandon my current bounty task" (no reward; frees up a new one). */
export interface BountyAbandonIntent {
  type: "BOUNTY_ABANDON";
}

/** "Buy one listing from the Bounty board's Hunt-Marks shop." */
export interface BountyBuyIntent {
  type: "BOUNTY_BUY";
  item: ItemId;
}

/** "Skip my current task" — reroll for a Hunt-Marks fee, keeping my streak. */
export interface BountySkipIntent {
  type: "BOUNTY_SKIP";
}

/** "Block my current task's monster" — never assign it again (uses a block slot). */
export interface BountyBlockIntent {
  type: "BOUNTY_BLOCK";
  /** Block this recently-assigned monster instead of the current task's (must
   *  be in bounty.history). Omitted = block (and cancel) the current task. */
  monster?: string;
}

/** "Un-block a monster" — free up its block slot so it can be assigned again. */
export interface BountyUnblockIntent {
  type: "BOUNTY_UNBLOCK";
  monster: string;
}

/** "Buy a permanent Hunt-Marks unlock." */
export interface BountyUnlockIntent {
  type: "BOUNTY_UNLOCK";
  id: string;
}

/** "Claim this empty homestead plot as mine." */
export interface ClaimPlotIntent {
  type: "CLAIM_PLOT";
  plotId: string;
}

/** "Build (or replace) a furniture piece at this hotspot." */
export interface BuildFurnitureIntent {
  type: "BUILD_FURNITURE";
  hotspotId: string;
  furnitureId: string;
}

/** "Clear the furniture from this hotspot." */
export interface RemoveFurnitureIntent {
  type: "REMOVE_FURNITURE";
  hotspotId: string;
}

/** "Use the functional furniture at this hotspot" (a home station: bank/cook/etc). */
export interface UseFurnitureIntent {
  type: "USE_FURNITURE";
  hotspotId: string;
}

/** "Build the add-on room sealed behind this doorway" (opens a wing). */
export interface BuildRoomIntent {
  type: "BUILD_ROOM";
  sealId: string;
}

// --- Free-placement housing (the Homestead) -------------------------------
/** "Craft this furniture piece from materials" — the Construction sink. Made
 *  inside your home; the finished piece lands in your home storage to place. */
export interface CraftFurnitureIntent {
  type: "CRAFT_FURNITURE";
  furnitureId: string;
}

/** "Place a piece from home storage at this tile, turned this way." */
export interface PlaceFurnitureIntent {
  type: "PLACE_FURNITURE";
  furnitureId: string;
  x: number;
  y: number;
  rot: number;
}

/** "Move the placed piece at this index to a new tile / rotation." */
export interface MoveFurnitureIntent {
  type: "MOVE_FURNITURE";
  index: number;
  x: number;
  y: number;
  rot: number;
}

/** "Pick up the placed piece at this index, back into home storage." */
export interface StoreFurnitureIntent {
  type: "STORE_FURNITURE";
  index: number;
}

/** "Upgrade the placed piece at this index to the next tier of its kind." */
export interface UpgradeFurnitureIntent {
  type: "UPGRADE_FURNITURE";
  index: number;
}

/** "Set my home's wallpaper / flooring to this surface style." */
export interface SetSurfaceIntent {
  type: "SET_SURFACE";
  surfaceId: string;
}

/** "Recall me to Ironvale" — the free escape teleport (Settings). No reagents,
 *  no requirements, 30-minute cooldown: if you're ever walled in (a furnished
 *  doorway, a wander pinch), this gets you home. OSRS home-teleport energy. */
export interface RecallIntent {
  type: "RECALL";
}

/** "Wayfare me back to my last waystone" — the paid traveller's recall. Unlike
 *  the free Ironvale escape, this returns you to the last Courier stone you rode
 *  to (so a far region isn't a fresh commute each visit), charges a tithe you
 *  must actually afford (a recurring coin sink), and runs its own cooldown. */
export interface WaystoneRecallIntent {
  type: "WAYSTONE_RECALL";
}

/** Sound a Hunter's Horn (a Hunt-Marks consumable in the given pack slot): be
 *  carried straight to your active bounty task's hunting ground. Consumed on
 *  use; refused (and kept) when no task is live. */
export interface SoundHornIntent {
  type: "SOUND_HORN";
  slot: number;
}

/** "Pick up the loot lying on this tile" (honoured when the player is on/next to it). */
export interface PickupIntent {
  type: "PICKUP";
  x: number;
  y: number;
  /** A specific ground pile to take (by its id). Omitted = everything here. */
  id?: number;
  /** How many of that pile to take (stackables). Omitted = the whole pile. */
  qty?: number;
  /** Walk this path first, then grab it on arrival. Omitted = act immediately. */
  path?: Vec2[];
}

/** "Walk to this campfire and open its cook menu on arrival" — the core owns the
 *  walk-then-act so the client no longer polls arrival each frame. */
export interface CookIntent {
  type: "COOK";
  x: number;
  y: number;
  /** Walk this path first, then open the cook menu. Omitted = act immediately. */
  path?: Vec2[];
}

/** "Open this bird nest in my pack" — rolls a random farming seed. */
export interface OpenNestIntent {
  type: "OPEN_NEST";
  slot: number;
}

/** "Arm (or disarm) the special attack": with a full bar, the next swing
 *  becomes the wielded weapon family's finisher — melee SUNDER, bow TWIN SHOT,
 *  staff GRACE SURGE. */
export interface SpecialIntent {
  type: "SPECIAL";
}

/** "Open the container in this pack slot" — supply crates and trail caskets.
 *  The core rolls the container's loot table and replaces it with the haul. */
export interface OpenContainerIntent {
  type: "OPEN_CONTAINER";
  slot: number;
}

/** "Work the fertilizer in this pack slot into a farm patch." Basic (+20%) or
 *  Rich (+35%) fertilizer raises the crop's survival roll at harvest — the
 *  Survivalist's mix feeding the Farmer's field. One treatment per planting;
 *  it works on an empty patch (ahead of the seed) or a growing one. */
export interface FertilizeIntent {
  type: "FERTILIZE";
  patchId: string;
  slot: number;
}

/** "Claim my Founder's Cache" — grants the one-time cosmetic Founder items to a
 *  player carrying the "founder" entitlement flag (cosmetic-only; see FOUNDER.md). */
export interface FounderClaimIntent {
  type: "FOUNDER_CLAIM";
}

/** "Resolve the pier tension minigame": land the hooked fish (success) or let
 *  the line go slack / snap (failure). Success commits the rolled catch; failure
 *  discards it. The core trusts the client's skill outcome — single-player, the
 *  fish itself was already rolled server-side at the hook, so weight can't be
 *  faked, only whether you kept it. */
export interface LandFishIntent {
  type: "LAND_FISH";
  success: boolean;
}

/** "Drop this inventory slot onto the floor at my feet" (the whole stack). */
export interface DropIntent {
  type: "DROP";
  slot: number;
}

/** "Claim a completed Area Diary's XP lamp, applying it to this skill." */
export interface ClaimDiaryIntent {
  type: "CLAIM_DIARY";
  diary: string;
  skill: SkillId;
}

/** "Claim a reached boss kill-count milestone — an XP lamp poured into `skill`." */
export interface ClaimBossMilestoneIntent {
  type: "CLAIM_BOSS_MILESTONE";
  boss: string;
  kills: number;
  skill: SkillId;
}

export type Intent =
  | MoveIntent
  | InteractIntent
  | CancelIntent
  | EatIntent
  | DepositIntent
  | WithdrawIntent
  | BuyIntent
  | SellIntent
  | TravelIntent
  | PlantIntent
  | BountyTaskIntent
  | BountyClaimIntent
  | BountyAbandonIntent
  | BountyBuyIntent
  | BountySkipIntent
  | BountyBlockIntent
  | BountyUnblockIntent
  | BountyUnlockIntent
  | EquipIntent
  | UnequipIntent
  | CraftIntent
  | SetStyleIntent
  | SetAttackOptionIntent
  | SetAccountModeIntent
  | CastSpellIntent
  | SetAutocastIntent
  | ToggleBlessingIntent
  | StartDelveIntent
  | BuryIntent
  | GrindIntent
  | LightFireIntent
  | ToggleRunIntent
  | ChooseIntent
  | SpendXpLampIntent
  | ClaimPlotIntent
  | BuildFurnitureIntent
  | RemoveFurnitureIntent
  | CraftFurnitureIntent
  | PlaceFurnitureIntent
  | MoveFurnitureIntent
  | StoreFurnitureIntent
  | UpgradeFurnitureIntent
  | SetSurfaceIntent
  | RecallIntent
  | WaystoneRecallIntent
  | SoundHornIntent
  | FertilizeIntent
  | OpenContainerIntent
  | SpecialIntent
  | UseFurnitureIntent
  | BuildRoomIntent
  | PickupIntent
  | CookIntent
  | DropIntent
  | ClaimDiaryIntent
  | ClaimBossMilestoneIntent
  | GeMoveIntent
  | TradeApplyIntent
  | DuelStakeIntent
  | DuelResolveIntent
  | SetPierRecordsIntent
  | OpenNestIntent
  | FounderClaimIntent
  | LandFishIntent
  | SwapSlotsIntent;

// ---------------------------------------------------------------------------
// Events: what the core reports back after handling an intent or a tick.
// The client reads these to update the log, open dialogue, play effects, etc.
// The client must NOT change state from events — state already lives in the
// WorldState the core returns; events are just notifications.
// ---------------------------------------------------------------------------

export type WorldEvent =
  /** A log line. `tone: "err"` marks a DENIAL (level too low, can't afford,
   *  wrong place, missing materials) — the client surfaces those as an
   *  unmissable toast + error sound, not just a quiet log line. */
  | { type: "LOG"; message: string; tone?: "err" }
  | { type: "XP_GAINED"; skill: SkillId; amount: number }
  | { type: "LEVEL_UP"; skill: SkillId; level: number }
  | { type: "ITEM_GAINED"; item: ItemId; qty: number }
  | { type: "INVENTORY_FULL" }
  | { type: "DIALOGUE"; npc: string; lines: string[] }
  /**
   * A blow resolved. `kind` distinguishes outcomes that `amount` alone cannot:
   * since damage rolls from zero, a LANDED hit for 0 and a MISS are both
   * `amount: 0`, and OSRS draws them very differently — a blue nothing-splat
   * versus a whiff. Required, so adding a new outcome makes every site that
   * reports damage a compile error rather than a silent grey number.
   */
  | {
      type: "DAMAGE";
      targetId: string;
      amount: number;
      kind: "hit" | "miss" | "poison" | "venom";
      weak?: boolean;
    }
  | { type: "HEALED"; amount: number }
  | { type: "OBJECT_DEPLETED"; objId: string }
  | { type: "OBJECT_RESPAWNED"; objId: string }
  | { type: "MONSTER_KILLED"; objId: string }
  | { type: "PLAYER_DIED" }
  | { type: "PLAYER_RESPAWNED" }
  | { type: "OPEN_BANK" }
  /** Open the Grand Exchange (the world market) at its booth. */
  | { type: "OPEN_EXCHANGE" }
  /** Open a shopkeeper's trade window. */
  | { type: "OPEN_SHOP"; shop: string }
  /** Open the seed-choice menu for an empty farming patch. */
  | { type: "OPEN_PLANT"; patchId: string; patchType: "plant" | "tree" }
  /** Open the Bounty board (guides, current task, Hunt-Marks shop).
   *  `guideId` names the guide being spoken to, so the board locks to them —
   *  you only deal with the guide in front of you. Absent for the notices
   *  board, which lists every guide. */
  | { type: "OPEN_BOUNTY"; objId: string; guideId?: string }
  /** Open the fast-travel menu at a waystone. */
  | { type: "OPEN_TRAVEL"; objId: string }
  /** Open the pier's records board (top five catches by weight). */
  | { type: "OPEN_RECORDS"; objId: string }
  /** Open the Varathian Trail standings — players ranked by laps run. */
  | { type: "OPEN_TRAIL_BOARD" }
  /** A fish is on the line at the pier — the client opens the tension minigame.
   *  `strength` (0..1) drives how hard it fights. */
  | { type: "HOOKED_FISH"; species: string; weight: number; length: number; strength: number }
  /** A pier fish was landed: its stats, the board rank it took (1..5, or 0 if it
   *  didn't make the board), and whether this catch made the player a NEW pier
   *  champion (took #1 from someone else — worth a world broadcast). */
  | { type: "FISH_LANDED"; species: string; weight: number; length: number; rank: number; newChampion: boolean }
  /** Loot was pocketed off a tile — the client glints where the pile was. */
  | { type: "PICKED_UP"; x: number; y: number }
  /** A rare/legendary monster drop hit the ground — worth a celebration card. */
  | { type: "RARE_DROP"; item: ItemId; legendary: boolean }
  /** A "rich find" — a rare bumper gather that came up double; the client
   *  sparkles the worked node and floats a little fanfare. */
  | { type: "RICH_FIND"; skill: SkillId; item: ItemId }
  /** Open the recipe menu for a station (fire/furnace/anvil). */
  | { type: "OPEN_CRAFT"; station: ObjKind; objId: string }
  /** Open the furniture build/replace menu for a housing hotspot. */
  | { type: "OPEN_BUILD"; hotspotId: string; category: string; current: string | null }
  /** Offer to upgrade the house a tier: the new structure name, the room it
   *  adds, the Construction req, and the gold + material cost. */
  | { type: "OPEN_EXTENSION"; sealId: string; name: string; room: string; levelReq: number; gold: number; materials: Record<string, number> }
  | { type: "QUEST_STARTED"; quest: string }
  | { type: "QUEST_ADVANCED"; quest: string }
  | { type: "QUEST_COMPLETED"; quest: string }
  /** A quest is asking the player to choose; the client shows the options. */
  | { type: "QUEST_CHOICE"; quest: string; prompt: string; options: string[] }
  | { type: "XP_LAMP"; amount: number; pending: number }
  /** A container (clue casket, supply crate) was opened; the client shows a
   *  reward-summary popup. */
  | { type: "CONTAINER_OPENED"; container: ItemId; coins: number; items: { item: ItemId; qty: number }[] }
  | { type: "WORLD_BOSS_MOVED"; name: string; hint: string }
  /** A companion has joined you (a rare pet drop). */
  | { type: "COMPANION_FOUND"; item: ItemId }
  /** An achievement just unlocked. */
  | { type: "ACHIEVEMENT"; id: string; name: string };

// ---------------------------------------------------------------------------
// Content bundle: all the game DATA handed to the core when a world is made.
// ---------------------------------------------------------------------------

/**
 * One skill action, ported verbatim from the idle game's `SKILLS[*].actions`.
 * This is the canonical recipe/gathering data for every gathering and
 * processing skill. Station crafting (cooking/smelting/smithing)
 * runs directly off these. See src/content/actions.ts.
 */
export interface SkillAction {
  id: string;
  /** Which skill trains this action. */
  skill: SkillId;
  name: string;
  /** Level in `skill` required to perform it. */
  levelReq: number;
  /** XP granted on a successful action. */
  xp: number;
  /** Canon action time in ms (the spatial game may re-tune pacing). */
  baseTime?: number;
  /** Inputs consumed, item id -> quantity. */
  requires?: Partial<Record<ItemId, number>>;
  /** Inputs where any one of these items satisfies the recipe. */
  requiresAny?: ItemId[];
  /** The item produced (absent for a few pure-effect actions). */
  produces?: ItemId;
  /** How many of `produces` are made per action (default 1). */
  produceQty?: number;
  /** UI grouping key, e.g. "arrows", "smoked", "quarry". */
  group?: string;
  /** Designer note / flavour shown in tooltips. */
  note?: string;
  /** Gather location key (fishing). */
  location?: string;
  /** Whether this is a timed bonus-window catch (fishing). */
  window?: boolean;
  /** Reforge-only: melts all gear instead of producing an item. */
  meltAll?: boolean;
  /** An extra rare drop on success. */
  rareDrop?: { item: ItemId; chance: number };
  /** A chance to also get a seed (forestry). */
  seedDrop?: { item: ItemId; chance: number };
  /** A chance to also get wood shards (forestry). */
  woodShardDrop?: { chance: number };
}

// ---------------------------------------------------------------------------
// Quests (data; see src/content/quests.ts).
// ---------------------------------------------------------------------------

/** The four powers of Varath. Reputation with each rises and falls by deed. */
export type FactionId = "ashforge" | "lodge" | "pale_record" | "heartmoor_cult";

/** A reputation change with one faction. */
export interface RepChange {
  faction: FactionId;
  amount: number;
}

/** The condition that unlocks an achievement, evaluated against player state. */
export type AchievementCond =
  | { type: "skillLevel"; skill: SkillId; level: number }
  | { type: "anySkillLevel"; level: number }
  | { type: "totalLevel"; total: number }
  | { type: "combatLevel"; level: number }
  | { type: "questDone"; quest: string }
  | { type: "flag"; flag: string }
  | { type: "goldEarned"; amount: number }
  | { type: "monstersSlain"; count: number }
  | { type: "companions"; count: number }
  | { type: "anyRepAtLeast"; amount: number }
  /** Kills of one boss (player.bossKills), for boss achievements/diaries. */
  | { type: "bossKills"; boss: string; count: number }
  /** Bounty contracts claimed (player.bounty.tasksDone). */
  | { type: "bountyTasks"; count: number }
  /** One combat-achievement feat against one boss (player.combatFeats). */
  | { type: "combatFeat"; boss: string; feat: string }
  /** How many combat-achievement feats have been earned in total. */
  | { type: "combatFeats"; count: number };

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Display grouping, e.g. "Skills", "Combat", "Wealth", "Story". */
  category: string;
  cond: AchievementCond;
}

/** One task on a regional Achievement Diary (reuses the achievement evaluator). */
export interface DiaryTask {
  label: string;
  cond: AchievementCond;
}

/** A region's Achievement Diary: a themed checklist of goals for that area. */
export interface DiaryDef {
  id: string;
  name: string;
  icon: string;
  tasks: DiaryTask[];
  /** XP reward (an "XP lamp") granted on completion, applied to a chosen skill. */
  reward: number;
}

/** One choice a player can make at a "choose" step. */
export interface QuestChoice {
  /** The button label shown to the player. */
  label: string;
  /** Story flags this choice sets when taken. */
  flags: string[];
  /** A WRONG answer (riddle steps): picking it speaks this hint and the quest
   *  does NOT advance — the question can be tried again. Real puzzles. */
  wrong?: string;
  /** A line acknowledging the choice. */
  reply?: string;
  /** Coins granted for picking this option (e.g. selling the shard). */
  gold?: number;
  /** One of this item is consumed when the option is taken (e.g. the shard sold). */
  takeItem?: ItemId;
  /** One of this item is GRANTED when the option is taken (e.g. an ending's
   *  cape) — banked if the pack is full, so it can never be lost. */
  giveItem?: ItemId;
  /** Reputation changes with factions for picking this option. */
  rep?: RepChange[];
  /** This option is only OFFERED when the player holds all of these flags —
   *  used to gate a finale's endings by the path the player actually walked. */
  requiresFlags?: string[];
  /** This option is HIDDEN when the player holds any of these flags. */
  blockedByFlags?: string[];
}

/** One thing a quest step asks of the player. */
export type QuestObjective =
  | { type: "talk"; npc: string; text: string }
  | { type: "kill"; monster: string; count: number; text: string }
  | { type: "gather"; item: ItemId; count: number; text: string; from?: string }
  | { type: "deliver"; npc: string; item: ItemId; count: number; text: string }
  | { type: "reach"; skill: SkillId; level: number; text: string }
  /** Travel to a place: completes once the player comes within `radius` tiles
   *  (default 3) of (x, y). An exploration objective — "scout the pass", "reach
   *  the old ruin" — distinct from talking to an NPC standing there. */
  | { type: "visit"; x: number; y: number; radius?: number; text: string }
  | { type: "choice"; npc: string; text: string; prompt: string; options: QuestChoice[] }
  /** Claim any homestead plot (introduces player housing). */
  | { type: "claim"; text: string }
  /** Build a furniture piece (optionally of a given category) at a home. */
  | { type: "build"; category?: string; text: string }
  /** Teaching objective: introduce a core system by having the player engage it
   *  once — open the Bank or the Grand Exchange, cook over a fire, or train Faith
   *  (a prayer, a buried bone, a staff cast). Auto-completes the instant the
   *  player has already done it, so a veteran is never made to repeat a tutorial
   *  and the step only ever blocks someone who genuinely hasn't met the system. */
  | { type: "learn"; system: "bank" | "exchange" | "cook" | "faith"; text: string };

/** What a quest grants on completion. */
export interface QuestReward {
  xp?: { skill: SkillId; amount: number }[];
  items?: { item: ItemId; qty: number }[];
  /** Story flags set on completion (faction joins, plot beats). */
  flags?: string[];
  /** Coins granted on completion. */
  gold?: number;
  /** Reputation changes with factions on completion. */
  rep?: RepChange[];
}

/** A quest: a chain of objectives offered by a giver NPC. */
export interface QuestDef {
  id: string;
  name: string;
  /** Act label for the quest log (1/2/3), optional. */
  act?: number;
  /** Quest-log grouping: the shard/warmth spine ("main"), a guild or Heartmoor
   *  rank line ("faction"), or a self-contained side-quest ("side", default). */
  type?: "main" | "faction" | "side";
  /** The NPC id who offers and ends the quest. */
  giver: string;
  /** A quest id that must be completed before this one is offered. */
  requires?: string;
  /** A level the player must reach before the quest is offered — a specific
   *  skill, or (skill omitted) the total level across all skills. Lets a quest
   *  wait until the player has found their feet. */
  requiresLevel?: { skill?: SkillId; level: number };
  /** Story flags ALL of which must be set before this quest is offered. */
  requiresFlags?: string[];
  /** Story flags NONE of which may be set (mutually-exclusive branches). */
  blockedByFlags?: string[];
  /** Lines spoken when the quest is accepted. */
  intro: string[];
  /** The ordered objectives. */
  steps: QuestObjective[];
  /** Lines spoken on turn-in (completion). */
  outro: string[];
  reward: QuestReward;
}

/** Live progress for one active quest on the player. */
export interface QuestState {
  /** The current step index into QuestDef.steps. */
  step: number;
  /** Progress toward the current "kill" objective. */
  killCount: number;
}

/** One buyable line in a shop: a bundle of `qty` of `item` for `price` gold. */
export interface ShopStock {
  item: ItemId;
  /** Only offered once this story flag is set (e.g. an ending's wares). */
  requiresFlag?: string;
  /** Total gold for the whole bundle (not per-unit). */
  price: number;
  /** How many units one purchase grants. */
  qty: number;
  /** Alternate currency: when set, this listing is bought with `costQty` of
   *  `costItem` from the pack instead of gold (e.g. Agility Marks). */
  costItem?: ItemId;
  costQty?: number;
  /** A rationed listing: cap on the shelf, refilled to that cap on its own
   *  `restockMs` cadence (independent of the general/food restock). Used for the
   *  Devotion Potion — one on the table, one back every 15 minutes. */
  max?: number;
  restockMs?: number;
  /** A reputation gate: only sold once standing with `faction` reaches `amount`
   *  (25 = Friendly, 50 = Allied). Gives faction rep a mechanical payoff. */
  requiresRep?: { faction: FactionId; amount: number };
}

/** One crop (a plant or a tree) the player can farm. growthMs is REAL ms. */
export interface CropDef {
  id: string;
  name: string;
  type: "plant" | "tree";
  icon: string;
  /** The seed item planted. */
  seed: ItemId;
  /** The item harvested. */
  produce: ItemId;
  /** Farming level required to plant it. */
  levelReq: number;
  /** Real-world milliseconds to mature. */
  growthMs: number;
  /** Chance the crop survives to harvest (else it fails). */
  baseChance: number;
  xpPlant: number;
  xpHarvest: number;
  produceMin: number;
  produceMax: number;
  /** An occasional bonus item on harvest. */
  bonusDrop?: ItemId;
  bonusChance?: number;
}

/** A shopkeeper's wares. Selling back happens at the item's own `sell` value. */
export interface ShopDef {
  id: string;
  /** The NPC id whose tap opens this shop. */
  npc: string;
  name: string;
  /** A line shown atop the trade window. */
  greeting: string;
  stock: ShopStock[];
}

/**
 * One discoverable lore fragment — a torn page, a grave-rubbing, an old marker
 * found out in the world. Reading it the first time records it in the Archive
 * and grants a small finder's reward. Pure data; see src/content/lore.ts.
 */
export interface LoreDef {
  id: string;
  /** The fragment's name, e.g. "A Torn Page" or "The Gravewright's Mark". */
  title: string;
  /** Which thread of the world's mystery this belongs to (Archive grouping). */
  category: string;
  /** The passage, one entry per paragraph (shown a line at a time when read). */
  text: string[];
  /** A one-time finder's reward, granted the first time it is read. */
  reward?: { gold?: number; xp?: { skill: SkillId; amount: number } };
}

/**
 * One buildable furniture piece for player housing. Built at a `build_hotspot`
 * whose `category` matches; consumes `materials` (existing Construction outputs)
 * and grants Construction XP. `comfort` is a cosmetic "home value" score; `bed`
 * pieces additionally move the player's respawn to that homestead.
 */
export interface FurnitureDef {
  id: string;
  name: string;
  /** Which hotspot category accepts this piece (hearth/bed/table/hall). */
  category: string;
  /** Construction level required to build it. */
  levelReq: number;
  /** Construction XP granted on building. */
  xp: number;
  /** Materials consumed to build it (item id -> quantity). */
  materials: Partial<Record<ItemId, number>>;
  /** Optional coin cost to build it, on top of materials — the mid/late-game
   *  gold sink for prestige/estate pieces (most furniture is materials-only). */
  gold?: number;
  /** A "home value" score, summed across a homestead's built pieces. */
  comfort: number;
  /** A short examine/flavour line shown in the build menu. */
  blurb: string;
  /** A bed piece sets the player's respawn to its homestead when built. */
  bed?: boolean;
  /** A lighting piece glows warmly at night (lights the home interior). */
  light?: boolean;
  /**
   * A functional piece doubles as a station: "bank" opens your storage, or a
   * crafting-station ObjKind ("fire" to cook, "workbench" to build, "anvil",
   * "furnace", "crafting_table") opens that station's recipes — at home.
   */
  station?: string;
  /** Tile footprint [w, h] at rotation 0 (default [1, 1]). Free-placement homes
   *  fit the piece to the floor and block those tiles (rugs excepted). */
  footprint?: readonly [number, number];
  /** How to draw the piece (data-driven, scaled to the footprint). When absent,
   *  the renderer falls back to the legacy per-category art (the stations). */
  render?: FurnitureRender;
  /** A wall-hung piece (paintings, mirrors, banners): drawn on the wall behind,
   *  and it doesn't block the floor you stand on. */
  wall?: boolean;
  /** Bought for gold from the furnishings vendor rather than crafted (cosmetic). */
  cosmetic?: boolean;
}

/** A parameterised furniture look: a shape archetype plus its palette, drawn at
 *  the piece's footprint size so a bed reads bigger than a stool. */
export interface FurnitureRender {
  shape: string;
  /** Primary body / wood colour. */
  wood?: string;
  /** Trim / metal / accent colour. */
  accent?: string;
  /** Fabric colour (beds, sofas, rugs, cushions). */
  cloth?: string;
  /** If it lights the room, the glow colour. */
  glow?: string;
}

/** A room surface the player can swap — a wallpaper or a flooring. */
export interface SurfaceDef {
  id: string;
  kind: "wall" | "floor";
  name: string;
  /** Base colour. */
  color: string;
  /** A second colour for a plank/tile/pattern seam. */
  seam?: string;
  /** How the seam pattern draws: wood boards, tiled squares, checkerboard, or
   *  panelled wall. Defaults to boards for floors, panels for walls. */
  style?: "board" | "tile" | "checker" | "panel";
  /** Construction level to unlock (0 = always available). */
  levelReq?: number;
  /** Bought for gold from the vendor instead of unlocked by level. */
  cosmetic?: boolean;
}

/** One furniture piece placed in a free-placement home: its id, the top-left
 *  tile of its footprint (absolute interior coords), and a 0–3 quarter-turn. */
export interface PlacedFurniture {
  item: string;
  x: number;
  y: number;
  /** Rotation in quarter-turns clockwise (0, 1, 2, 3). Swaps the footprint w/h
   *  when odd. */
  rot: number;
}

/** A player's home: furniture crafted/bought but not yet placed (id → count),
 *  and everything currently placed in the house (ESO/Animal-Crossing style). */
export interface HomeState {
  storage: Record<string, number>;
  placed: PlacedFurniture[];
  /** Chosen wall surface id (a SurfaceDef of kind "wall"), or undefined = default. */
  wall?: string;
  /** Chosen floor surface id (a SurfaceDef of kind "floor"). */
  floor?: string;
  /** House structure tier: 0 Cottage (living only), 1 Homestead (+kitchen),
   *  2 Manor (+bedroom), 3 Estate (+workshop, +backyard). Each step unseals a
   *  room for a Construction level + gold + materials. */
  tier: number;
}

/** A species catchable from the deep-water pier minigame. Each landed fish rolls
 *  a weight (kg) and length (cm) within these ranges — biased toward the top of
 *  the range by the player's Fishing level and rod tier, so progress earns
 *  bigger fish. Rarer (lower `rarity`) species need a higher Fishing level. */
export interface PierFishDef {
  id: string;
  name: string;
  /** Relative chance of being the one on the line (higher = more common). */
  rarity: number;
  /** Minimum Fishing level before this species can be hooked at all. */
  minLevel: number;
  /** Weight range in kilograms, [min, max]. */
  weight: [number, number];
  /** Length range in centimetres, [min, max]. */
  length: [number, number];
  /** Fishing XP awarded per kilogram landed. */
  xpPerKg: number;
  /** Coins the warden pays per kilogram. */
  goldPerKg: number;
}

/** A catch worth recording on the pier's board — the top five by weight. */
export interface FishRecord {
  /** The species' display name. */
  species: string;
  /** Weight in kilograms (one decimal). */
  weight: number;
  /** Length in centimetres (whole). */
  length: number;
  /** Who landed it — the player's name, or a seeded rival angler. */
  angler: string;
}

/** The fish on the line during the tension minigame. Rolled at the hook,
 *  committed on a land, discarded on a snap. Transient — never persisted. */
export interface HookedFish {
  species: string;
  weight: number;
  length: number;
  /** 0..1 — how hard it fights, driving the minigame's tension dynamics. */
  strength: number;
  /** Fishing XP this catch is worth if landed. */
  xp: number;
  /** Coins this catch is worth if landed. */
  gold: number;
}

/**
 * One Faith spell. The single spellbook mixes attack and utility casts; each is
 * gated by a Faith level and spends `cost` Grace. Effect fields are read by kind:
 * attack → `dmgMult` (× magic max hit against the current target); heal → `heal`;
 * ward → `wardAmt`/`wardMs` (a temporary defence buff); teleport → home shrine.
 */
export interface SpellDef {
  id: string;
  name: string;
  icon: string;
  /** Minimum Faith level to cast. */
  faithReq: number;
  /** Grace spent per cast. */
  cost: number;
  kind: "attack" | "heal" | "ward" | "teleport" | "curse" | "kindle" | "enchant" | "blessing";
  /** attack: fraction of magic max hit dealt as a burst (e.g. 1.5). */
  dmgMult?: number;
  /** heal: HP restored. */
  heal?: number;
  /** ward: defence bonus granted, and its duration (ms). */
  wardAmt?: number;
  wardMs?: number;
  /** curse: how far the target's defence is dropped, and for how long (ms). */
  curseAmt?: number;
  curseMs?: number;
  /** blessing: which attack style it deflects (halves that style's damage). */
  deflectStyle?: "melee" | "ranged" | "magic";
  /** blessing: OFFENSIVE/stat boosts (Piety-style) — multipliers on the player's
   *  accuracy / max hit / defence while the blessing is held (1 = no change). All
   *  styles benefit (melee/ranged/magic). Held blessings burn Grace, so these are
   *  a live "spend Grace for power" layer, not a free buff. */
  boostAcc?: number;
  boostDmg?: number;
  boostDef?: number;
  /** blessing: Grace drained per second while the blessing is held. */
  drainPerSec?: number;
  /** Faith XP granted on a successful cast. */
  xp: number;
  /** Short explainer for the spellbook. */
  blurb: string;
}

export interface Content {
  map: WorldMap;
  /** Default respawn tile after death — the safe city hub (a home bed overrides
   *  it per-player). Decoupled from the opening spawn so death sends you to town. */
  respawnPoint: Vec2;
  objects: WorldObjectDef[];
  items: Record<ItemId, ItemDef>;
  /** Monster combat stats + loot, keyed by MonsterStats id. */
  monsters: Record<string, MonsterStats>;
  /** Every item's derived OSRS-style combat vector — see content/equipBonus.ts. */
  equipBonus: Record<ItemId, EquipBonus>;
  /** Who and what can be stolen from — see content/thieving.ts. */
  thieveTargets: import("../content/thieving.ts").ThieveTarget[];
  /** The collection log, derived from every drop and reward table in the game.
   *  See content/collectionLog.ts. */
  collectionLog: import("../content/collectionLog.ts").LogCategory[];
  /** The full canon skill-action registry — drives gathering + station crafting. */
  actions: SkillAction[];
  /** The quest chains (data). */
  quests: QuestDef[];
  /** The Faith spellbook (data) — Grace-fuelled attack + utility casts. */
  spells: SpellDef[];
  /** Discoverable lore fragments, revealed by reading relics in the world. */
  lore: LoreDef[];
  /** Trail-clue riddle spots per tier (see src/content/clues.ts). */
  clueSpots: Record<"easy" | "medium" | "hard", { target: string; riddle: string; then?: { target: string; riddle: string }[] }[]>;
  /** Shopkeeper wares (data). */
  shops: ShopDef[];
  /** The factions and their display metadata (data). */
  factions: { id: FactionId; name: string; icon: string; blurb: string }[];
  /** The achievements (data). */
  achievements: AchievementDef[];
  /** Per-region Achievement Diaries (data). */
  diaries: DiaryDef[];
  /** Farmable crops, keyed by crop id. */
  crops: Record<string, CropDef>;
  /** Buildable housing furniture, keyed by furniture id. */
  furniture: Record<string, FurnitureDef>;
  /** Home wall + floor surface styles, keyed by surface id. */
  surfaces: Record<string, SurfaceDef>;
  /** Bounty task-givers (data). */
  bountyGuides: BountyGuide[];
  /** Bounty task templates, keyed by zone (data). */
  bountyTasks: Record<string, BountyTaskDef[]>;
  /** What the Bounty board sells for Hunt Marks (data). */
  bountyShop: BountyShopListing[];
  /** Permanent Hunt-Marks unlocks the board offers (data). */
  bountyUnlocks: BountyUnlock[];
  /** Where each bounty monster reliably lives, keyed by monster id (data).
   *  Drives the "found at…" line on the contract and the hunt marker on maps. */
  huntingGrounds: Record<string, HuntingGround>;
  /** The species catchable from the deep-water pier minigame (data). */
  pierFish: PierFishDef[];
  /** Seed entries for the pier's records board — rival anglers to beat. */
  pierRecords: FishRecord[];
  /** XP needed to *reach* each level. xpForLevel[1] = 0, etc. */
  xpForLevel: number[];
  /** Player-facing skill metadata (display name, icon glyph, explainer blurb). */
  skills: Record<SkillId, { name: string; icon: string; blurb: string }>;
}
