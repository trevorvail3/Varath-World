/**
 * src/content/bounty.ts
 * ---------------------
 * The Bounty skill's data, ported from the idle game's BOUNTY_GUIDES +
 * BOUNTY_TASKS + the Bounty (Hunt-Marks) shop.
 *
 * Bounty is a meta-loop layered over combat: a guide hands you a "slay N of
 * monster X" task; killing those monsters anywhere in the world tracks toward
 * it; you return to the board to claim Bounty XP + Hunt Marks, then spend the
 * marks at the board's shop. Three guides cover six zone-pools and scale the
 * flat task rewards (rougher territory pays more).
 */

import type { BountyGuide, BountyShopListing, BountyTaskDef, BountyUnlock, HuntingGround } from "../core/types.ts";

export const bountyGuides: BountyGuide[] = [
  {
    id: "rook",
    name: "Rook",
    title: "The Fieldwarden",
    icon: "🪶",
    desc: "An old tracker who patrols the Knuckle Hills. Sends new hunters after small game and common prey.",
    levelReq: 1,
    zones: ["knuckle_hills", "greyoak_wood", "petty_outlaws"],
    xpMult: 1.0,
    marksMult: 1.0,
  },
  {
    id: "serath",
    name: "Serath",
    title: "The Spine Warden",
    icon: "🗡️",
    desc: "A scarred warrior stationed at the Spine passes. Assigns tasks in rougher territory for seasoned hunters.",
    levelReq: 30,
    // Overlaps Rook only on Greyoak's beasts, and Mourne only on the Warrens —
    // OSRS-style: each guide keeps a pool of their own with a small shared rim.
    zones: ["spine", "heartmoor", "outlaws", "greyoak_wood", "warrens"],
    xpMult: 1.6,
    marksMult: 1.6,
  },
  {
    id: "mourne",
    name: "Mourne",
    title: "The Deep Watcher",
    icon: "💀",
    desc: "Speaks little. Posts bounties in the Marrow Deeps and Redrun for hunters who have earned the right.",
    levelReq: 65,
    zones: ["marrow_deeps", "redrun", "warrens", "old_places"],
    xpMult: 2.5,
    marksMult: 2.5,
  },
  {
    id: "kaeda",
    name: "Kaeda",
    title: "The Reckoner",
    icon: "☠️",
    desc: "Keeps a ledger of Varath's named monsters and who among the living has put one down. Assigns single-target boss hunts — the richest marks in the land, for those who can collect.",
    levelReq: 60,
    zones: ["boss_hunts"],
    xpMult: 3.0,
    marksMult: 3.0,
  },
];

/**
 * Task templates keyed by zone. `monster` matches a MonsterStats id (and the
 * `monster` tag on placed world objects, so kills track). `required`, `xp` and
 * `marks` are the flat values; the assigning guide scales xp/marks.
 */
export const bountyTasks: Record<string, BountyTaskDef[]> = {
  knuckle_hills: [
    { monster: "moor_rat", required: 25, xp: 300, marks: 10, minLevel: 1 },
    { monster: "moor_rat", required: 60, xp: 650, marks: 22, minLevel: 10 },
    { monster: "hill_wolf", required: 15, xp: 500, marks: 20, minLevel: 5 },
    { monster: "hill_wolf", required: 35, xp: 1100, marks: 45, minLevel: 15 },
    // Red deer thin the hunt's early menu of "just rats and wolves" — harmless
    // fauna that thread through the Knuckle Hills and the Greyoak verge.
    { monster: "red_deer", required: 20, xp: 550, marks: 20, minLevel: 5 },
    { monster: "red_deer", required: 40, xp: 1150, marks: 46, minLevel: 14 },
    // Rook's bridge into the Warrens: the Burrows open (bountyReq) at 20, and
    // Rook — whose hills border the quarry — writes the first contracts, so
    // levels 20-29 aren't a drought waiting on Serath's door at 30.
    { monster: "warren_creeper", required: 10, xp: 1300, marks: 52, minLevel: 20 },
  ],
  greyoak_wood: [
    { monster: "wild_boar", required: 15, xp: 800, marks: 32, minLevel: 10 },
    { monster: "wild_boar", required: 30, xp: 1500, marks: 60, minLevel: 20 },
    { monster: "greymane_boar", required: 12, xp: 1400, marks: 56, minLevel: 18 },
    { monster: "mountain_lion", required: 10, xp: 1600, marks: 64, minLevel: 20 },
    { monster: "forest_bear", required: 10, xp: 1200, marks: 50, minLevel: 15 },
    { monster: "forest_bear", required: 20, xp: 2400, marks: 100, minLevel: 30 },
  ],
  spine: [
    { monster: "ridge_wolf", required: 10, xp: 1200, marks: 50, minLevel: 25 },
    { monster: "ridge_wolf", required: 25, xp: 2800, marks: 115, minLevel: 35 },
    { monster: "stone_crawler", required: 8, xp: 1800, marks: 75, minLevel: 30 },
    { monster: "stone_crawler", required: 20, xp: 4000, marks: 165, minLevel: 45 },
    { monster: "mountain_troll", required: 5, xp: 2200, marks: 90, minLevel: 38 },
    { monster: "mountain_troll", required: 12, xp: 5000, marks: 200, minLevel: 50 },
    { monster: "spine_wraith", required: 5, xp: 2800, marks: 115, minLevel: 43 },
  ],
  heartmoor: [
    { monster: "marsh_lurker", required: 8, xp: 2500, marks: 100, minLevel: 45 },
    { monster: "marsh_lurker", required: 20, xp: 5500, marks: 225, minLevel: 55 },
    { monster: "heartmoor_hound", required: 10, xp: 3000, marks: 125, minLevel: 50 },
    { monster: "heartmoor_hound", required: 25, xp: 7000, marks: 285, minLevel: 62 },
    { monster: "cult_acolyte", required: 15, xp: 1600, marks: 65, minLevel: 30 },
    { monster: "cult_zealot", required: 10, xp: 3200, marks: 130, minLevel: 42 },
    { monster: "bog_knight", required: 5, xp: 4000, marks: 165, minLevel: 58 },
    { monster: "mire_serpent", required: 4, xp: 4500, marks: 185, minLevel: 62 },
  ],
  // Rook's petty-crime docket: the small outlaws of the near roads, so a new
  // hunter sees more than rats and wolves before level 20.
  petty_outlaws: [
    { monster: "footpad", required: 15, xp: 400, marks: 14, minLevel: 3 },
    { monster: "cutpurse", required: 12, xp: 500, marks: 18, minLevel: 6 },
    { monster: "poacher", required: 10, xp: 600, marks: 22, minLevel: 9 },
    { monster: "bandit", required: 12, xp: 800, marks: 30, minLevel: 12 },
    { monster: "highwayman", required: 10, xp: 1000, marks: 38, minLevel: 16 },
    { monster: "cutthroat", required: 8, xp: 1200, marks: 46, minLevel: 24 },
  ],
  // The lawless roads — outlaw gangs from footpad to captain, ranging the whole
  // map. Serath posts these alongside the Spine and moor work.
  outlaws: [
    { monster: "outlaw_archer", required: 12, xp: 1500, marks: 60, minLevel: 25 },
    { monster: "outlaw_archer", required: 25, xp: 3000, marks: 125, minLevel: 35 },
    { monster: "cutthroat", required: 10, xp: 1800, marks: 75, minLevel: 30 },
    { monster: "marauder", required: 8, xp: 2400, marks: 100, minLevel: 38 },
    { monster: "outlaw_captain", required: 5, xp: 3500, marks: 145, minLevel: 45 },
  ],
  marrow_deeps: [
    { monster: "cave_crawler", required: 8, xp: 4000, marks: 165, minLevel: 65 },
    { monster: "cave_crawler", required: 20, xp: 9000, marks: 370, minLevel: 72 },
    { monster: "deep_bat", required: 10, xp: 3500, marks: 145, minLevel: 68 },
    { monster: "cult_magus", required: 6, xp: 5000, marks: 210, minLevel: 66 },
    { monster: "marrow_wraith", required: 5, xp: 5500, marks: 225, minLevel: 75 },
    { monster: "marrow_wraith", required: 12, xp: 12000, marks: 490, minLevel: 80 },
    { monster: "deep_golem", required: 3, xp: 8000, marks: 330, minLevel: 80 },
  ],
  redrun: [
    { monster: "river_serpent", required: 5, xp: 8000, marks: 330, minLevel: 83 },
    { monster: "river_serpent", required: 12, xp: 18000, marks: 740, minLevel: 88 },
    { monster: "redrun_brigand", required: 8, xp: 7000, marks: 285, minLevel: 87 },
    { monster: "redrun_brigand", required: 20, xp: 16000, marks: 660, minLevel: 92 },
    { monster: "ancient_orc", required: 3, xp: 12000, marks: 490, minLevel: 91 },
    { monster: "ancient_orc", required: 8, xp: 28000, marks: 1150, minLevel: 95 },
  ],
  // The Hunt Warrens — the guild's own slayer grounds under the Old Quarry.
  // Each quarry also carries a KILL gate (MonsterStats.bountyReq), so these
  // tasks are the ladder the skill climbs: new grade every ~20 levels, each
  // with a unique that drops nowhere else. Posted by Serath and Mourne.
  warrens: [
    { monster: "warren_creeper", required: 12, xp: 1500, marks: 60, minLevel: 20 },
    { monster: "warren_creeper", required: 25, xp: 3200, marks: 130, minLevel: 30 },
    { monster: "dusk_stalker", required: 10, xp: 2600, marks: 105, minLevel: 40 },
    { monster: "dusk_stalker", required: 20, xp: 5400, marks: 220, minLevel: 50 },
    { monster: "hollow_hound", required: 8, xp: 4200, marks: 170, minLevel: 60 },
    { monster: "hollow_hound", required: 16, xp: 8500, marks: 350, minLevel: 70 },
    { monster: "warren_shade", required: 6, xp: 6000, marks: 245, minLevel: 75 },
    { monster: "warren_shade", required: 12, xp: 12500, marks: 510, minLevel: 82 },
    { monster: "iron_maw", required: 5, xp: 8500, marks: 350, minLevel: 90 },
    { monster: "iron_maw", required: 10, xp: 18000, marks: 740, minLevel: 95 },
  ],
  // Mourne's sweep of the old places — the Act II ruins' own dead, for hunters
  // who have earned the deep dark. The Undergate's wights wait on its reveal.
  old_places: [
    { monster: "drowned_thrall", required: 10, xp: 4500, marks: 185, minLevel: 65 },
    { monster: "court_wisp", required: 8, xp: 5000, marks: 205, minLevel: 67 },
    { monster: "aerie_harpy", required: 10, xp: 5500, marks: 225, minLevel: 70 },
    { monster: "storm_wisp", required: 8, xp: 6000, marks: 245, minLevel: 72 },
    { monster: "pale_wight", required: 8, xp: 9500, marks: 390, minLevel: 76, requiresFlag: "act2_tablets_all" },
  ],
  // Kaeda's ledger — single-target hunts for Varath's named bosses. Base values
  // are large and the guide triples them, so one clean boss kill pays like a
  // long grind. Quest bosses carry a requiresFlag so they're only ever assigned
  // to a hunter who has unlocked their lair.
  boss_hunts: [
    { monster: "bog_warden", required: 2, xp: 4000, marks: 200, minLevel: 60 },
    { monster: "hollow_warden", required: 2, xp: 4000, marks: 200, minLevel: 60 },
    { monster: "green_baron", required: 1, xp: 5000, marks: 240, minLevel: 62, requiresFlag: "q_green_baron_complete" },
    { monster: "hollow_prophet", required: 1, xp: 5500, marks: 260, minLevel: 64, requiresFlag: "q_hollow_prophet_complete" },
    { monster: "spine_warlord", required: 1, xp: 6000, marks: 280, minLevel: 66 },
    { monster: "boneman", required: 1, xp: 6500, marks: 300, minLevel: 68, requiresFlag: "q_boneman_complete" },
    { monster: "marrow_keeper", required: 1, xp: 7000, marks: 320, minLevel: 70 },
    { monster: "ashen_wyrm", required: 1, xp: 9000, marks: 420, minLevel: 75 },
    { monster: "dread_ferryman", required: 1, xp: 10000, marks: 460, minLevel: 78 },
    { monster: "greyback", required: 1, xp: 7000, marks: 320, minLevel: 66 },
    { monster: "storm_herald", required: 1, xp: 8000, marks: 360, minLevel: 72 },
  ],
};

/**
 * Where each bounty monster reliably lives — its named hunting ground
 * (OSRS-Slayer style: hill giants have their places, so do our bears). The
 * spawn tables cluster each species here, and the guide/contract quote the
 * place IN WORDS — that's the only help given; nothing is drawn on the maps.
 * A few strays of the common species still wander the wider wilds for
 * flavour; the ground is simply where a hunter is *guaranteed* to find them.
 *
 * Coordinates are final world tiles (post-remap). Keep them honest: if a
 * species' spawns move, move its ground.
 */
export const huntingGrounds: Record<string, HuntingGround> = {
  // --- Rook's beat: the Knuckle Hills + Greyoak Wood -----------------------
  moor_rat: { name: "the Mill Fields", hint: "east of Rook's watch in the Knuckle Hills", x: 54, y: 34, r: 6 },
  hill_wolf: { name: "Howler's Rise", hint: "the bare hill west of the Knuckle road", x: 28, y: 36, r: 6 },
  red_deer: { name: "the Knuckle Meadows", hint: "the deer runs north of Ironvale", x: 24, y: 30, r: 8 },
  wild_boar: { name: "the Boar Run", hint: "western Greyoak, north of Lodgehold", x: 11, y: 76, r: 8 },
  greymane_boar: { name: "the Greymane Thicket", hint: "the deep bracken of southern Greyoak", x: 18, y: 95, r: 6 },
  forest_bear: { name: "Bearwallow", hint: "the Greyoak hollows south of Lodgehold", x: 10, y: 90, r: 7 },
  mountain_lion: { name: "the Sunning Crags", hint: "the warm ledges on the Spine's southern skirt", x: 57, y: 45, r: 7 },
  // --- Serath's beat: the Spine, the Heartmoor, the outlaw roads -----------
  ridge_wolf: { name: "the Low Passes", hint: "the first climbs above Serath's post", x: 63, y: 16, r: 6 },
  stone_crawler: { name: "the Spine Cut", hint: "the quarry scars mid-Spine", x: 60, y: 25, r: 7 },
  mountain_troll: { name: "the High Shelf", hint: "up past the Wind-Shrine, near the snowline", x: 64, y: 30, r: 6 },
  spine_wraith: { name: "the Windscour", hint: "where the Spine wind never stops", x: 63, y: 31, r: 8 },
  marsh_lurker: { name: "the Drowning Pools", hint: "the west Heartmoor standing water", x: 15, y: 141, r: 7 },
  heartmoor_hound: { name: "the Hound Fens", hint: "the moor south of the drowned kirk", x: 15, y: 148, r: 8 },
  cult_acolyte: { name: "the Ashfen Ring", hint: "the cult's stones on the Ashfen Flats", x: 79, y: 146, r: 8 },
  cult_zealot: { name: "the Ashfen Ring", hint: "the cult's stones on the Ashfen Flats", x: 80, y: 151, r: 8 },
  bog_knight: { name: "the Bogmoor", hint: "the drowned ground by the Bog Warden's lair", x: 45, y: 131, r: 6 },
  mire_serpent: { name: "the Serpent Mire", hint: "the black water of the north Heartmoor", x: 26, y: 134, r: 6 },
  outlaw_archer: { name: "Smuggler's Landing", hint: "the far east coast, past the Redrun mouth", x: 151, y: 97, r: 6 },
  cutthroat: { name: "Cutthroat Hollow", hint: "the sunken road south of Ironvale", x: 53, y: 104, r: 6 },
  marauder: { name: "the Brigand's Roost", hint: "the outlaw camp west of Ironvale", x: 54, y: 67, r: 6 },
  outlaw_captain: { name: "the Brigand's Roost", hint: "the outlaw camp west of Ironvale", x: 54, y: 67, r: 6 },
  // --- Mourne's beat: the Marrow Deeps + the Redrun -------------------------
  cave_crawler: { name: "the Marrow Shelves", hint: "the broken ground at the Deeps' mouth", x: 129, y: 15, r: 10 },
  deep_bat: { name: "the Bat Galleries", hint: "the dark overhangs of the Marrow Deeps", x: 130, y: 20, r: 9 },
  cult_magus: { name: "the Ashfen Ring", hint: "the inner stones on the Ashfen Flats", x: 84, y: 149, r: 7 },
  marrow_wraith: { name: "the Wraithways", hint: "the cold hollows south of the Deeps", x: 122, y: 36, r: 6 },
  deep_golem: { name: "the Golem Quarry", hint: "the worked stone deep in the Marrow", x: 133, y: 36, r: 6 },
  river_serpent: { name: "the Redrun Mouth", hint: "where the river meets the eastern sea", x: 146, y: 98, r: 6 },
  redrun_brigand: { name: "the Redrun Bank", hint: "the east bank of the river's last mile", x: 148, y: 100, r: 6 },
  ancient_orc: { name: "the Old Warcamp", hint: "the ruined camp on the lower Redrun", x: 127, y: 125, r: 6 },
  // --- Rook's petty-crime docket: the outlaw camps of the near roads --------
  footpad: { name: "the Gallows Oak", hint: "the outlaw camp on the north-west road", x: 48, y: 44, r: 5 },
  cutpurse: { name: "the Cutpurse Steps", hint: "the broken stair south-east of Ironvale", x: 80, y: 97, r: 5 },
  poacher: { name: "the Poachers' Blind", hint: "the hides on the Greyoak verge", x: 27, y: 77, r: 5 },
  bandit: { name: "Waylayers' Bend", hint: "the bad turn on the west road", x: 58, y: 80, r: 5 },
  highwayman: { name: "the Burnt Waystation", hint: "the gutted post-house on the east road", x: 101, y: 80, r: 5 },
  // --- The Hunt Warrens: the guild's slayer grounds under the Old Quarry ----
  warren_creeper: { name: "the Warren Burrows", hint: "first chamber of the Hunt Warrens, below the Old Quarry", x: 150, y: 230, r: 6 },
  dusk_stalker: { name: "the Warren Dens", hint: "second chamber of the Hunt Warrens — listen for the whistle", x: 147, y: 237, r: 6 },
  hollow_hound: { name: "the Warren Kennels", hint: "third chamber of the Hunt Warrens", x: 147, y: 245, r: 6 },
  warren_shade: { name: "the Warren Crypt", hint: "fourth chamber of the Hunt Warrens — by the black pools", x: 148, y: 254, r: 6 },
  iron_maw: { name: "the Maw Pit", hint: "the bottom of the Hunt Warrens", x: 148, y: 262, r: 7 },
  // --- Mourne's sweep of the old places --------------------------------------
  drowned_thrall: { name: "the Sunken Court", hint: "the drowned halls beneath the Heartmoor", x: 57, y: 242, r: 8 },
  court_wisp: { name: "the Sunken Court", hint: "the drowned halls beneath the Heartmoor", x: 40, y: 227, r: 8 },
  aerie_harpy: { name: "Skyreach Ruin", hint: "the aerie above the Spine pass", x: 57, y: 277, r: 8 },
  storm_wisp: { name: "Skyreach Ruin", hint: "the aerie above the Spine pass", x: 80, y: 283, r: 8 },
  pale_wight: { name: "the Undergate", hint: "beyond the fifth seal, under the Spine", x: 62, y: 340, r: 8 },
  // --- Kaeda's ledger: named bosses keep single lairs -----------------------
  bog_warden: { name: "the Bogmoor", hint: "its lair in the drowned moor", x: 44, y: 130, r: 4 },
  hollow_warden: { name: "the Barrows' Mouth", hint: "before the Hollow Barrows' gate", x: 124, y: 53, r: 4 },
  green_baron: { name: "the Baron's Court", hint: "his court in the north wood", x: 47, y: 35, r: 4 },
  hollow_prophet: { name: "the Prophet's Circle", hint: "the cult ground east of Drover's Rest", x: 92, y: 122, r: 4 },
  spine_warlord: { name: "the Spine's Height", hint: "the war-tent on the high pass", x: 53, y: 19, r: 4 },
  boneman: { name: "the Bone Field", hint: "his cairn-ground in the west verge", x: 37, y: 88, r: 4 },
  marrow_keeper: { name: "the Marrow Delve", hint: "the arena beneath the Deeps", x: 56, y: 171, r: 4 },
  greyback: { name: "the East Downs", hint: "a roamer — the guides post its last sighting past the Redrun road", x: 136, y: 111, r: 10 },
  storm_herald: { name: "the Skyreach Eyrie", hint: "the storm-watch at the top of the ruin", x: 117, y: 286, r: 5 },
  ashen_wyrm: { name: "the Cinder Roost", hint: "the scorched shelf in the far northeast", x: 136, y: 17, r: 4 },
  dread_ferryman: { name: "the Grey Landing", hint: "the dark water at the world's south edge", x: 72, y: 169, r: 4 },
};

/** The Bounty board's Hunt-Marks shop (ported subset that exists in our items). */
export const bountyShop: BountyShopListing[] = [
  // The signature reward first — a hunter's helm that rewards staying on-task.
  { item: "bounty_helm", cost: 450, qty: 1, label: "Bounty Helm", desc: "+10% damage against the creature your active bounty names. A serious edge on long tasks." },
  // The chase items: Marks-only prestige gear that no coin can buy.
  { item: "hunters_cloak", cost: 1500, qty: 1, label: "Hunter's Cloak", desc: "A cape of a hundred contracts — solid all-style stats, and proof you did the work. Marks only; no gold price exists." },
  { item: "bounty_helm_g", cost: 2500, qty: 1, label: "Greater Bounty Helm", desc: "The Bounty Helm remade — +18% damage against your active task's creature, and heavier plate besides. The board's richest ware." },
  { item: "hunters_kit", cost: 150, qty: 1, label: "Hunter's Kit", desc: "Hold one when you claim a task: +50% Bounty XP, consumed on claim." },
  // Hunt-tool consumables — spent on every gated kill (see the masteries below
  // to be done with them forever).
  { item: "flensing_hook", cost: 15, qty: 1, label: "Flensing Hook", desc: "Required to harm a Hollow Hound; one is spent per kill." },
  { item: "flensing_hook", cost: 130, qty: 10, label: "Flensing Hooks ×10", desc: "A task's worth of hooks at a bulk rate." },
  { item: "maw_spike", cost: 25, qty: 1, label: "Maw-Spike", desc: "Required to harm an Iron Maw; one is spent per kill." },
  { item: "maw_spike", cost: 220, qty: 10, label: "Maw-Spikes ×10", desc: "A task's worth of spikes at a bulk rate." },
  { item: "hunters_horn", cost: 40, qty: 1, label: "Hunter's Horn", desc: "Sound it to be carried straight to your active task's hunting ground. One use — the walk back is what you're paying to skip." },
  { item: "battle_ration", cost: 60, qty: 1, label: "Battle Ration", desc: "Field food — heals on the spot, no cooking needed." },
  { item: "health_elixir", cost: 40, qty: 1, label: "Health Potion", desc: "Restores 50 health instantly." },
  { item: "arrow_ashiron", cost: 25, qty: 15, label: "Ashiron Arrows ×15", desc: "A bundle of fifteen ashiron-tipped arrows." },
  { item: "bloodore_arrow", cost: 60, qty: 15, label: "Bloodore Arrows ×15", desc: "A bundle of fifteen bloodore arrows." },
  { item: "arrow_hearthite", cost: 130, qty: 20, label: "Hearthite Arrows ×20", desc: "A bundle of twenty hearthite-tipped arrows — for the hardest hunts." },
  { item: "hunters_kit", cost: 400, qty: 3, label: "Hunter's Kit ×3", desc: "Three field kits at a bulk rate. Bank them for your biggest claims." },
  // Standing exits for a full purse: a repeatable crate, and the guides' old
  // hound — a Marks-only prestige companion at the top of the ladder.
  { item: "bounty_crate", cost: 100, qty: 1, label: "Bounty Supply Crate", desc: "A stamped crate of field supplies — rations, elixirs, arrows, and now and then something better." },
  { item: "pet_bloodhound", cost: 4000, qty: 1, label: "Old Bay, the guides' hound", desc: "The guides' retired bloodhound, sold for Marks alone. The Hunt's highest honour that walks." },
];

/**
 * Permanent Hunt-Marks unlocks (bought once, owned forever), in the OSRS
 * Slayer-reward vein. Effects are resolved by id in the core:
 *  - "superior"  → task monsters can rise as a Superior (rare, tougher kill →
 *                  a burst of bonus Marks + XP and a shot at an ultra-rare).
 *  - "keen_eye"  → Superior encounters come half again as often.
 *  - "wider_net" → block list grows from 3 slots to 6.
 */
export const bountyUnlocks: BountyUnlock[] = [
  { id: "superior", name: "Bigger & Badder", cost: 750, desc: "Unlocks Superior encounters — while on a task, the creature you hunt can rarely rise as a Superior: a tougher kill that showers bonus Hunt Marks and Bounty XP, with a slim chance at an ultra-rare Hunter's trophy." },
  { id: "keen_eye", name: "The Hunter's Eye", cost: 600, desc: "You learn the signs. Superior encounters appear roughly half again as often. (Requires Bigger & Badder.)" },
  { id: "twin_marks", name: "Twin Marks", cost: 650, desc: "You learn to read a den, not a trail. While on a task, some kills (about one in eight) count TWICE toward your tally." },
  { id: "reckoners_favour", name: "The Reckoner's Favour", cost: 900, desc: "Kaeda vouches for you at every board. Your hunt-streak bonus keeps climbing to +100% Marks (instead of stopping at +50%)." },
  { id: "wider_net", name: "Warden's Ledger", cost: 400, desc: "Kaeda lets you keep a longer list of refusals — your block list grows from 3 monsters to 6." },
  { id: "flensing_mastery", name: "Flensing Mastery", cost: 2000, desc: "You learn the seam in a Hollow Hound's hide by feel. Flensing Hooks are never needed — or spent — again." },
  { id: "spike_mastery", name: "Spike Mastery", cost: 3000, desc: "You learn where an Iron Maw's plates breathe. Maw-Spikes are never needed — or spent — again." },
];
