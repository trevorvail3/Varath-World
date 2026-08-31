/**
 * src/core/save.ts
 * ----------------
 * The save *format* and its validation. This is part of the pure core (RULE 1):
 * no DOM, no localStorage — just turning a Player into a plain, versioned data
 * object and safely loading one back. The client (src/client/storage.ts) is
 * what actually reads and writes the browser's localStorage.
 *
 * What we persist: only the player's *progress* — skill XP, inventory, HP and
 * position. We deliberately do NOT persist world object timers (respawns) or
 * the clock, because those live in runtime milliseconds that reset on reload;
 * the world is recreated fresh and the saved player is laid back on top.
 */

import type {
  Appearance,
  Content,
  EquipSlot,
  FishRecord,
  ItemId,
  Player,
  SkillId,
  WorldState,
} from "./types.ts";
import { LEVEL_CAP } from "../content/xpCurve.ts";
import { OVERWORLD_HEIGHT } from "../content/map.ts";

/** Bump this whenever the save shape changes; older saves are then ignored. */
export const SAVE_VERSION = 1;

export interface SavedProgress {
  version: number;
  /** XP per skill. */
  skills: Partial<Record<SkillId, number>>;
  /** Fixed-length inventory; null = empty slot. `noted` marks a bank-slip stack. */
  inventory: ({ item: string; qty: number; noted?: boolean } | null)[];
  /** Banked items: item id -> quantity. */
  bank: Record<string, number>;
  /** Worn gear: equip slot -> item id. */
  equipment: Record<string, string>;
  /** Arrows nocked behind the worn `ammo` slot. */
  quiver: number;
  /** Special-attack charge (0-100); the armed flag is transient and not saved. */
  spec?: number;
  /** Active trail clues: tier -> the landmark object id the riddle points at. */
  clues?: Record<string, string>;
  /** Remaining legs of an active multi-step hard trail (current leg first). */
  clueSteps?: { target: string; riddle: string }[];
  /** Run/walk toggle + current run energy. */
  running: boolean;
  energy: number;
  /** Faith Grace pool (refilled at altars). Optional for pre-Faith saves. */
  grace?: number;
  /** The attack spell selected for autocast (or null/absent). */
  autocastSpell?: string | null;
  /** Selected melee combat style (the stance the attack option implies). */
  combatStyle: string;
  /** Last-chosen attack option per weapon family. The live `attackOption` index
   *  is deliberately NOT saved: it is per-weapon and is re-derived on load from
   *  this map plus whatever is in hand, so a save can never restore an index
   *  that means a different swing than it did when it was written. */
  attackOptionByType?: Record<string, number>;
  /** Active quests: id -> { step, killCount }. */
  quests: Record<string, { step: number; killCount: number }>;
  /** Completed quest ids. */
  questsDone: string[];
  /** Discovered lore fragment ids (the Archive). */
  lore: string[];
  /** Story flags. */
  flags: string[];
  /** Coins. */
  gold: number;
  /** Faction standings. */
  reputation: Record<string, number>;
  /** Cumulative achievement tallies (incl. the duel ladder: rating/streak/record). */
  stats: { goldEarned: number; monstersSlain: number; duelWins?: number; duelLosses?: number; duelRating?: number; duelStreak?: number; duelBestStreak?: number };
  /** Deepest Marrow Delve endless-depth floor reached. */
  delveDepthRecord?: number;
  /** Per-boss kill tallies, keyed by monster id. */
  bossKills?: Record<string, number>;
  /** Claimed boss kill-milestone keys ("<bossId>:<kills>"). */
  bossMilestonesClaimed?: string[];
  /** Total active play time in milliseconds. */
  playMs: number;
  /** playMs stamp of the last FULL Delve Cache (playtime-based lockout). */
  delveLastFullPlayMs?: number;
  /** Kills since the last Shard of Orun (drives the pity guarantee). */
  killsSinceShard: number;
  /** Completed laps of the Varathian Trail. */
  trailLaps?: number;
  /** Pending quest XP rewards awaiting a skill choice. */
  xpLamps?: number[];
  /** Collection log: item ids ever obtained. */
  collection?: string[];
  /** Combat-achievement feats earned, keyed "<bossId>:<feat>". */
  combatFeats?: string[];
  /** Account mode: standard / ironman / hardcore / ultimate. */
  mode?: string;
  /** Where and to what a Hardcore life ended, once it has. */
  hardcoreDeath?: { cause: string; combatLevel: number; playMs: number };
  /** Wall-clock time (Date.now ms) the free Recall is available again. */
  recallReadyEpoch?: number;
  /** Unlocked achievement ids. */
  achievements: string[];
  /** Claimed Area Diary ids. */
  diariesClaimed: string[];
  /** Settled player-trade ids already applied (dupe guard). */
  tradesApplied: number[];
  /** Name, cosmetic colours and body styles from the character creator. */
  appearance: Appearance;
  /** Bounty progression: Hunt Marks, chosen guide, the active task (if any). */
  bounty: {
    marks: number;
    guideId: string;
    task: { monster: string; required: number; progress: number; xp: number; marks: number; guideId: string } | null;
    streak: number;
    tasksDone: number;
    lastClaimDay: number;
    blocked: string[];
    history: string[];
    unlocks: string[];
  };
  /** Farming patches: patch id -> what's planted and when (epoch ms), plus any
   *  fertilizer worked in (an empty patch can be fed ahead of the seed). */
  farms: Record<string, { crop?: string; plantedAt?: number; fert?: 1 | 2 }>;
  /** Player housing: claimed plot ids + built furniture (hotspot id -> piece id). */
  housing: { plots: string[]; furniture: Record<string, string> };
  /** Free-placement home: unplaced storage + placed pieces (positions/rotations). */
  home?: { storage: Record<string, number>; placed: { item: string; x: number; y: number; rot: number }[]; wall?: string; floor?: string; tier?: number };
  hp: number;
  /** The pier's top-five catches by weight (the records board). */
  fishingRecords?: FishRecord[];
  /** Where the player respawns (moved to a homestead once a bed is built). */
  spawn: { x: number; y: number };
  pos: { x: number; y: number };
}

/** Snapshot the player's progress into a plain, serialisable object. */
export function serializePlayer(state: WorldState): SavedProgress {
  const { player } = state;
  const skills: Partial<Record<SkillId, number>> = {};
  (Object.keys(player.skills) as SkillId[]).forEach((id) => {
    skills[id] = player.skills[id].xp;
  });
  const farms: SavedProgress["farms"] = {};
  const housing: SavedProgress["housing"] = { plots: [], furniture: {} };
  for (const id of Object.keys(state.objects)) {
    const o = state.objects[id]!;
    if ((o.crop && typeof o.plantedAt === "number") || o.fert) {
      const f: SavedProgress["farms"][string] = {};
      if (o.crop && typeof o.plantedAt === "number") { f.crop = o.crop; f.plantedAt = o.plantedAt; }
      if (o.fert) f.fert = o.fert;
      farms[id] = f;
    }
    if (o.owned) housing.plots.push(id);
    if (o.furniture) housing.furniture[id] = o.furniture;
  }
  return {
    farms,
    housing,
    home: {
      storage: { ...player.home.storage },
      placed: player.home.placed.map((p) => ({ item: p.item, x: p.x, y: p.y, rot: p.rot })),
      tier: player.home.tier,
      ...(player.home.wall ? { wall: player.home.wall } : {}),
      ...(player.home.floor ? { floor: player.home.floor } : {}),
    },
    spawn: { x: Math.round(player.spawn.x), y: Math.round(player.spawn.y) },
    version: SAVE_VERSION,
    skills,
    inventory: player.inventory.map((s) => (s ? (s.noted ? { item: s.item, qty: s.qty, noted: true } : { item: s.item, qty: s.qty }) : null)),
    bank: { ...player.bank } as Record<string, number>,
    equipment: { ...player.equipment } as Record<string, string>,
    quiver: player.quiver,
    spec: player.spec,
    clues: { ...player.clues } as Record<string, string>,
    ...(player.clueSteps ? { clueSteps: player.clueSteps.map((s) => ({ target: s.target, riddle: s.riddle })) } : {}),
    running: player.running,
    energy: player.energy,
    grace: player.grace,
    autocastSpell: player.autocastSpell ?? null,
    combatStyle: player.combatStyle,
    ...(player.attackOptionByType ? { attackOptionByType: player.attackOptionByType } : {}),
    quests: JSON.parse(JSON.stringify(player.quests)) as SavedProgress["quests"],
    questsDone: [...player.questsDone],
    lore: [...player.lore],
    flags: [...player.flags],
    gold: player.gold,
    reputation: { ...player.reputation },
    stats: { ...player.stats },
    bossKills: { ...player.bossKills },
    bossMilestonesClaimed: [...player.bossMilestonesClaimed],
    playMs: player.playMs,
    delveLastFullPlayMs: player.delveLastFullPlayMs ?? 0,
    delveDepthRecord: player.delveDepthRecord ?? 0,
    achievements: [...player.achievements],
    diariesClaimed: [...player.diariesClaimed],
    tradesApplied: [...player.tradesApplied],
    killsSinceShard: player.killsSinceShard,
    trailLaps: player.trailLaps ?? 0,
    xpLamps: [...(player.xpLamps ?? [])],
    collection: [...(player.collection ?? [])],
    combatFeats: [...(player.combatFeats ?? [])],
    ...(player.mode && player.mode !== "standard" ? { mode: player.mode } : {}),
    ...(player.hardcoreDeath ? { hardcoreDeath: { ...player.hardcoreDeath } } : {}),
    recallReadyEpoch: player.recallReadyEpoch ?? 0,
    appearance: { ...player.appearance },
    bounty: {
      marks: player.bounty.marks,
      guideId: player.bounty.guideId,
      task: player.bounty.task ? { ...player.bounty.task } : null,
      streak: player.bounty.streak,
      tasksDone: player.bounty.tasksDone,
      lastClaimDay: player.bounty.lastClaimDay,
      blocked: [...player.bounty.blocked],
      history: [...player.bounty.history],
      unlocks: [...player.bounty.unlocks],
    },
    hp: player.hp,
    fishingRecords: player.fishingRecords.map((r) => ({ ...r })),
    pos: { x: Math.round(player.pos.x), y: Math.round(player.pos.y) },
  };
}

/**
 * Version-to-version save migrations. Each entry upgrades a blob FROM that
 * version to the next one. Add a migrator here whenever SAVE_VERSION is bumped,
 * so existing characters survive the change instead of being silently wiped.
 * (Empty today — version 1 is the current format.)
 */
const SAVE_MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // Example for the next bump:
  // 1: (raw) => ({ ...raw, version: 2, /* transform any changed fields here */ }),
};

/**
 * Bring a saved blob up to the current SAVE_VERSION. Returns the migrated record,
 * or null if it can't be safely loaded — either it's from a NEWER build (we
 * won't guess how to down-migrate) or there's no migration path from its
 * version. The rest of the loader already ignores unknown/renamed fields, so an
 * up-to-date blob loads field-by-field without losing skills, gold or items.
 */
function migrateSave(raw: Record<string, unknown>): Record<string, unknown> | null {
  let v = typeof raw["version"] === "number" ? (raw["version"] as number) : 0;
  if (v > SAVE_VERSION) return null; // a newer client wrote this — don't trust our guess
  let cur = raw;
  while (v < SAVE_VERSION) {
    const migrate = SAVE_MIGRATIONS[v];
    if (!migrate) return null; // no path from this version; fail safe rather than corrupt
    cur = migrate(cur);
    v = typeof cur["version"] === "number" ? (cur["version"] as number) : v + 1;
  }
  return cur;
}

/**
 * Validate and apply a saved blob onto a freshly-created world. Returns true if
 * anything was loaded. Older saves are migrated up to the current format first;
 * anything malformed, from a newer build, or with no migration path is ignored
 * rather than trusted — a corrupt save can never crash or wipe the game.
 */
export function hydratePlayer(
  state: WorldState,
  content: Content,
  rawUnknown: unknown,
): boolean {
  if (!isRecord(rawUnknown)) return false;
  const raw = migrateSave(rawUnknown);
  if (!raw) return false;
  const { player } = state;

  // --- Skills (only ids this build knows; XP must be a sane number) ---
  const savedSkills = raw["skills"];
  if (isRecord(savedSkills)) {
    (Object.keys(player.skills) as SkillId[]).forEach((id) => {
      const xp = savedSkills[id];
      if (typeof xp === "number" && Number.isFinite(xp) && xp >= 0) {
        player.skills[id].xp = xp;
        player.skills[id].level = levelFromTable(content.xpForLevel, xp);
      }
    });
  }

  // --- Inventory (drop unknown/renamed items gracefully) ---
  const savedInv = raw["inventory"];
  if (Array.isArray(savedInv)) {
    const inv: Player["inventory"] = new Array(player.inventory.length).fill(null);
    for (let i = 0; i < inv.length; i++) {
      const slot = savedInv[i];
      if (
        isRecord(slot) &&
        typeof slot["item"] === "string" &&
        slot["item"] in content.items
      ) {
        const rawQty = slot["qty"];
        const qty = finiteNum(rawQty) && rawQty > 0 ? Math.floor(rawQty) : 1;
        inv[i] = slot["noted"] === true
          ? { item: slot["item"] as ItemId, qty, noted: true }
          : { item: slot["item"] as ItemId, qty };
      }
    }
    player.inventory = inv;
  }

  // --- Bank (drop unknown/renamed items gracefully) ---
  const savedBank = raw["bank"];
  if (isRecord(savedBank)) {
    const bank: Player["bank"] = {};
    for (const key of Object.keys(savedBank)) {
      const qty = savedBank[key];
      if (key in content.items && finiteNum(qty) && qty > 0) {
        bank[key as ItemId] = Math.floor(qty);
      }
    }
    player.bank = bank;
  }

  // --- Equipment (only items that exist and sit in the slot they claim) ---
  const savedEquip = raw["equipment"];
  if (isRecord(savedEquip)) {
    const equipment: Player["equipment"] = {};
    let legacyBow: ItemId | null = null;
    for (const slot of Object.keys(savedEquip)) {
      const id = savedEquip[slot];
      if (typeof id !== "string" || !(id in content.items)) continue;
      const def = content.items[id as ItemId];
      if (def.slot === slot) equipment[slot as EquipSlot] = id as ItemId;
      // Bows used to live in their own "ranged" slot; they're mainhand weapons
      // now. Re-home a saved bow so it isn't silently dropped on load.
      else if (slot === "ranged" && def.ranged) legacyBow = id as ItemId;
    }
    if (legacyBow) {
      if (!equipment.mainhand) equipment.mainhand = legacyBow;
      else player.bank[legacyBow] = (player.bank[legacyBow] ?? 0) + 1;
    }
    player.equipment = equipment;
  }
  // Arrows nocked behind the `ammo` slot. Keep the count and the slot in sync:
  // no quiver without arrows worn, and an empty quiver clears the slot.
  const savedQuiver = raw["quiver"];
  player.quiver = finiteNum(savedQuiver) && savedQuiver > 0 ? Math.floor(savedQuiver) : 0;
  if (!player.equipment.ammo) player.quiver = 0;
  else if (player.quiver <= 0) delete player.equipment.ammo;

  // Special-attack charge (the armed flag never persists — a fresh session
  // starts stood-down, like autocast).
  const savedSpec = raw["spec"];
  if (finiteNum(savedSpec)) player.spec = Math.max(0, Math.min(100, savedSpec));

  // Trail clues: only tiers this build knows, only targets that still exist.
  const savedClues = raw["clues"];
  if (isRecord(savedClues)) {
    for (const tier of ["easy", "medium", "hard"] as const) {
      const target = savedClues[tier];
      if (typeof target === "string" && content.objects.some((o) => o.id === target)) {
        player.clues[tier] = target;
      }
    }
  }
  // Multi-step hard-trail progress: keep only legs whose landmark still exists.
  // A malformed or empty result simply degrades to a single-step trail (the
  // next solve pays the casket), so an old save is never soft-locked.
  const savedSteps = raw["clueSteps"];
  if (Array.isArray(savedSteps)) {
    const steps = savedSteps
      .filter((s): s is { target: string; riddle: string } =>
        isRecord(s) && typeof s["target"] === "string" && typeof s["riddle"] === "string" &&
        content.objects.some((o) => o.id === s["target"]))
      .map((s) => ({ target: s.target, riddle: s.riddle }));
    if (steps.length > 0) player.clueSteps = steps;
  }

  // Run/walk preference + energy (winded is derived, never persisted).
  if (typeof raw["running"] === "boolean") player.running = raw["running"];
  const savedEnergy = raw["energy"];
  if (finiteNum(savedEnergy)) player.energy = Math.max(0, Math.min(100, savedEnergy));
  player.winded = player.energy <= 0;
  // Faith Grace: clamp to the current pool; pre-Faith saves (no grace) start full.
  // Mirror graceMax() in worldCore: a 30-Grace base, +2 per Devotion level.
  const savedGrace = raw["grace"];
  const gmax = 28 + 2 * Math.max(1, player.skills.faith.level);
  player.grace = finiteNum(savedGrace) ? Math.max(0, Math.min(gmax, savedGrace)) : gmax;
  const ac = raw["autocastSpell"];
  player.autocastSpell = typeof ac === "string" ? ac : null;
  player.agilityLap = null; // lap progress is transient — start fresh on load
  // Tools are wielded in the mainhand now. Make sure the player still owns each
  // basic tool so saves from before this change can gather: if they hold no
  // tool of a kind anywhere (hand, pack or bank), drop a tier-1 one in the pack.
  const STARTER_TOOLS: ItemId[] = ["hatchet_1", "pickaxe_1", "rod_1"] as ItemId[];
  const ownsTool = (kind: string): boolean => {
    const has = (id: ItemId | undefined) => !!id && content.items[id]?.tool === kind;
    if (has(player.equipment.mainhand)) return true;
    if (player.inventory.some((s) => s && has(s.item))) return true;
    return Object.keys(player.bank).some((id) => has(id as ItemId));
  };
  for (const id of STARTER_TOOLS) {
    if (!(id in content.items)) continue;
    const kind = content.items[id].tool;
    if (!kind || ownsTool(kind)) continue;
    const empty = player.inventory.findIndex((s) => s === null);
    if (empty !== -1) player.inventory[empty] = { item: id, qty: 1 };
  }

  // --- Combat style + attack options (preferences) ---
  const style = raw["combatStyle"];
  if (style === "edge" || style === "vigour" || style === "ward" || style === "controlled") {
    player.combatStyle = style;
  }
  // Per-family attack-option preferences. A save written before attack options
  // existed simply has none, and `activeAttackOption` derives a sensible one
  // from the saved stance — so an old character loads swinging the way it did.
  const byType = raw["attackOptionByType"];
  if (byType && typeof byType === "object") {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(byType as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
    }
    if (Object.keys(out).length) player.attackOptionByType = out;
  }

  // --- Quests (only ids this build knows; clamp step into range) ---
  const savedDone = raw["questsDone"];
  if (Array.isArray(savedDone)) {
    player.questsDone = savedDone.filter(
      (id): id is string => typeof id === "string" && content.quests.some((q) => q.id === id),
    );
  }
  const savedFlags = raw["flags"];
  if (Array.isArray(savedFlags)) {
    player.flags = savedFlags.filter((f): f is string => typeof f === "string");
  }
  // Discovered lore (only ids this build still defines; drop the rest gracefully).
  const savedLore = raw["lore"];
  if (Array.isArray(savedLore)) {
    player.lore = savedLore.filter(
      (id): id is string => typeof id === "string" && content.lore.some((l) => l.id === id),
    );
  }
  const savedGold = raw["gold"];
  if (typeof savedGold === "number" && Number.isFinite(savedGold) && savedGold >= 0) {
    player.gold = Math.floor(savedGold);
  }
  const savedRep = raw["reputation"];
  if (isRecord(savedRep)) {
    for (const fid of Object.keys(player.reputation) as (keyof typeof player.reputation)[]) {
      const v = savedRep[fid];
      if (typeof v === "number" && Number.isFinite(v)) player.reputation[fid] = Math.round(v);
    }
  }
  const savedStats = raw["stats"];
  if (isRecord(savedStats)) {
    const g = savedStats["goldEarned"], k = savedStats["monstersSlain"];
    if (finiteNum(g) && g >= 0) player.stats.goldEarned = Math.floor(g);
    if (finiteNum(k) && k >= 0) player.stats.monstersSlain = Math.floor(k);
    // The duel ladder — these were serialized but never read back (a latent bug);
    // the PvP rating/streak/record only persist because of this block now.
    const dw = savedStats["duelWins"], dl = savedStats["duelLosses"];
    const dr = savedStats["duelRating"], ds = savedStats["duelStreak"], db = savedStats["duelBestStreak"];
    if (finiteNum(dw) && dw >= 0) player.stats.duelWins = Math.floor(dw);
    if (finiteNum(dl) && dl >= 0) player.stats.duelLosses = Math.floor(dl);
    if (finiteNum(dr) && dr >= 0) player.stats.duelRating = Math.floor(dr);
    if (finiteNum(ds) && ds >= 0) player.stats.duelStreak = Math.floor(ds);
    if (finiteNum(db) && db >= 0) player.stats.duelBestStreak = Math.floor(db);
  }
  const savedBossKills = raw["bossKills"];
  if (isRecord(savedBossKills)) {
    for (const id of Object.keys(savedBossKills)) {
      const n = savedBossKills[id];
      if (finiteNum(n) && n > 0) player.bossKills[id] = Math.floor(n);
    }
  }
  const savedMilestones = raw["bossMilestonesClaimed"];
  if (Array.isArray(savedMilestones)) {
    player.bossMilestonesClaimed = savedMilestones.filter((k): k is string => typeof k === "string");
  }
  const savedPlay = raw["playMs"];
  if (finiteNum(savedPlay) && savedPlay >= 0) player.playMs = Math.floor(savedPlay);
  const savedDelve = raw["delveLastFullPlayMs"];
  if (finiteNum(savedDelve) && savedDelve > 0) player.delveLastFullPlayMs = Math.floor(savedDelve);
  const savedDepth = raw["delveDepthRecord"];
  if (finiteNum(savedDepth) && savedDepth > 0) player.delveDepthRecord = Math.floor(savedDepth);
  const savedPity = raw["killsSinceShard"];
  if (finiteNum(savedPity) && savedPity >= 0) player.killsSinceShard = Math.floor(savedPity);
  const savedLaps = raw["trailLaps"];
  if (finiteNum(savedLaps) && savedLaps >= 0) player.trailLaps = Math.floor(savedLaps);
  const savedLamps = raw["xpLamps"];
  if (Array.isArray(savedLamps)) {
    player.xpLamps = savedLamps.filter((n) => finiteNum(n) && n > 0).map((n) => Math.floor(n));
  }
  // Recall cooldown (epoch-based, so it survives reloads honestly).
  const savedRecall = raw["recallReadyEpoch"];
  if (finiteNum(savedRecall) && savedRecall > 0) player.recallReadyEpoch = savedRecall;
  // Collection log: load saved ids, then fold in whatever the player currently
  // holds (pack + bank + worn) so an existing character's log isn't empty.
  {
    const set = new Set<ItemId>(player.collection ?? []);
    const savedColl = raw["collection"];
    if (Array.isArray(savedColl)) {
      for (const id of savedColl) if (typeof id === "string" && content.items[id as ItemId]) set.add(id as ItemId);
    }
    for (const s of player.inventory) if (s) set.add(s.item);
    for (const id of Object.keys(player.bank) as ItemId[]) if ((player.bank[id] ?? 0) > 0) set.add(id);
    for (const id of Object.values(player.equipment)) if (id) set.add(id);
    player.collection = [...set];
  }
  // Combat-achievement feats. Unlike the collection log there is nothing to
  // fold in from current state: a feat is a thing you did, not a thing you hold.
  {
    const saved = raw["combatFeats"];
    if (Array.isArray(saved)) {
      player.combatFeats = saved.filter((k): k is string => typeof k === "string");
    }
  }
  // Account mode. An unknown or absent value reads as a standard account, so a
  // corrupt field can never accidentally hand someone Hardcore's stakes.
  {
    const saved = raw["mode"];
    if (saved === "ironman" || saved === "hardcore" || saved === "ultimate") player.mode = saved;
    const death = raw["hardcoreDeath"] as { cause?: unknown; combatLevel?: unknown; playMs?: unknown } | undefined;
    if (death && typeof death.cause === "string" && finiteNum(death.combatLevel) && finiteNum(death.playMs)) {
      player.hardcoreDeath = { cause: death.cause, combatLevel: death.combatLevel, playMs: death.playMs };
    }
  }
  const savedAch = raw["achievements"];
  if (Array.isArray(savedAch)) {
    player.achievements = savedAch.filter(
      (id): id is string => typeof id === "string" && content.achievements.some((a) => a.id === id),
    );
  }
  const savedDiaries = raw["diariesClaimed"];
  if (Array.isArray(savedDiaries)) {
    player.diariesClaimed = savedDiaries.filter(
      (id): id is string => typeof id === "string" && content.diaries.some((d) => d.id === id),
    );
  }
  const savedTrades = raw["tradesApplied"];
  if (Array.isArray(savedTrades)) {
    player.tradesApplied = savedTrades
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
      .slice(-200);
  }
  // Appearance (name + colours); only accept well-formed string fields.
  const savedApp = raw["appearance"];
  if (isRecord(savedApp)) {
    const a = player.appearance;
    if (typeof savedApp["name"] === "string" && savedApp["name"].trim()) a.name = savedApp["name"].slice(0, 16);
    // Colours: only accept valid hex; otherwise keep the default already set.
    for (const k of ["skin", "hair", "tunic", "legColor", "shoeColor",
      "eyeColor", "beardColor", "markingColor"] as const) {
      const v = savedApp[k];
      if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) a[k] = v;
    }
    // Styles: any non-empty string; the renderer falls back for unknown ids, so
    // a save from a future build with an unrecognised style still draws safely.
    for (const k of ["hairStyle", "facial", "top", "legs", "shoes",
      "eyes", "brows", "jaw", "marking"] as const) {
      const v = savedApp[k];
      if (typeof v === "string" && v.length > 0 && v.length < 24) a[k] = v;
    }
    // Build is a closed union rather than a free id, so it is checked against
    // its own members. It was written out by serializePlayer and read back by
    // nobody, which meant choosing Lean or Broad in the creator lasted exactly
    // until the next reload and then silently became average again.
    const b = savedApp["build"];
    if (b === "lean" || b === "broad" || b === "heavy") a.build = b;
    const ht = savedApp["height"];
    if (ht === "short" || ht === "tall") a.height = ht;
  }
  // Bounty: restore marks, the chosen guide, and any active task — all guarded so
  // a save from before Bounty existed (no `bounty` key) just keeps the fresh state.
  const savedBounty = raw["bounty"];
  if (isRecord(savedBounty)) {
    const marks = savedBounty["marks"];
    if (finiteNum(marks) && marks >= 0) player.bounty.marks = Math.floor(marks);
    const gid = savedBounty["guideId"];
    if (typeof gid === "string" && content.bountyGuides.some((g) => g.id === gid)) {
      player.bounty.guideId = gid;
    }
    const streak = savedBounty["streak"];
    if (finiteNum(streak) && streak >= 0) player.bounty.streak = Math.floor(streak);
    const tasksDone = savedBounty["tasksDone"];
    if (finiteNum(tasksDone) && tasksDone >= 0) player.bounty.tasksDone = Math.floor(tasksDone);
    const lastDay = savedBounty["lastClaimDay"];
    if (finiteNum(lastDay) && lastDay >= 0) player.bounty.lastClaimDay = Math.floor(lastDay);
    const blocked = savedBounty["blocked"];
    if (Array.isArray(blocked)) {
      player.bounty.blocked = blocked.filter((m): m is string => typeof m === "string" && m in content.monsters);
    }
    const history = savedBounty["history"];
    if (Array.isArray(history)) {
      player.bounty.history = history.filter((m): m is string => typeof m === "string" && m in content.monsters).slice(0, 10);
    }
    const unlocks = savedBounty["unlocks"];
    if (Array.isArray(unlocks)) {
      player.bounty.unlocks = unlocks.filter((u): u is string => typeof u === "string" && content.bountyUnlocks.some((d) => d.id === u));
    }
    const t = savedBounty["task"];
    if (
      isRecord(t) &&
      typeof t["monster"] === "string" &&
      t["monster"] in content.monsters &&
      finiteNum(t["required"]) &&
      finiteNum(t["progress"]) &&
      finiteNum(t["xp"]) &&
      finiteNum(t["marks"])
    ) {
      const guideId = typeof t["guideId"] === "string" ? t["guideId"] : player.bounty.guideId;
      player.bounty.task = {
        monster: t["monster"],
        required: Math.max(1, Math.floor(t["required"])),
        progress: Math.max(0, Math.floor(t["progress"])),
        xp: Math.max(0, Math.floor(t["xp"])),
        marks: Math.max(0, Math.floor(t["marks"])),
        guideId,
      };
    }
  }
  // Farming patches keep growing in real time: restore what was planted + when.
  const savedFarms = raw["farms"];
  if (isRecord(savedFarms)) {
    for (const id of Object.keys(savedFarms)) {
      const f = savedFarms[id];
      const obj = state.objects[id];
      if (!obj || !isRecord(f)) continue;
      if (typeof f["crop"] === "string" && f["crop"] in content.crops && typeof f["plantedAt"] === "number") {
        obj.crop = f["crop"];
        obj.plantedAt = f["plantedAt"];
      }
      if (f["fert"] === 1 || f["fert"] === 2) obj.fert = f["fert"];
    }
  }
  // Player housing: re-claim owned plots and re-place built furniture, dropping
  // any id this build no longer defines (gracefully, like everything else here).
  const savedHousing = raw["housing"];
  if (isRecord(savedHousing)) {
    const plots = savedHousing["plots"];
    if (Array.isArray(plots)) {
      for (const id of plots) {
        const obj = typeof id === "string" ? state.objects[id] : undefined;
        const def = content.objects.find((o) => o.id === id);
        // Claimed plots, and built add-on wings (room seals) — both stored as `owned`.
        if (obj && def && (def.kind === "housing_plot" || def.kind === "room_seal")) obj.owned = true;
      }
    }
    const furn = savedHousing["furniture"];
    if (isRecord(furn)) {
      for (const id of Object.keys(furn)) {
        const obj = state.objects[id];
        const def = content.objects.find((o) => o.id === id);
        const fid = furn[id];
        if (obj && def && def.kind === "build_hotspot" && typeof fid === "string" && fid in content.furniture) {
          obj.furniture = fid;
        }
      }
    }
  }

  // Free-placement home. A save from the new system restores directly; an older
  // save (fixed-slot furniture only) is migrated once — each built hotspot piece
  // becomes a placed piece at that hotspot's own tile, so a furnished house
  // carries over intact.
  const savedHome = raw["home"];
  if (isRecord(savedHome)) {
    const st = savedHome["storage"];
    if (isRecord(st)) {
      for (const id of Object.keys(st)) {
        const n = st[id];
        if (id in content.furniture && typeof n === "number" && n > 0) player.home.storage[id] = Math.floor(n);
      }
    }
    const placed = savedHome["placed"];
    if (Array.isArray(placed)) {
      for (const p of placed) {
        if (!isRecord(p)) continue;
        const item = p["item"];
        if (typeof item !== "string" || !(item in content.furniture)) continue;
        const x = p["x"], y = p["y"], rot = p["rot"];
        if (typeof x === "number" && typeof y === "number") {
          player.home.placed.push({ item, x, y, rot: typeof rot === "number" ? ((rot % 4) + 4) % 4 : 0 });
        }
      }
    }
    const wall = savedHome["wall"], floor = savedHome["floor"];
    if (typeof wall === "string" && wall in content.surfaces) player.home.wall = wall;
    if (typeof floor === "string" && floor in content.surfaces) player.home.floor = floor;
    // House tier. A save from before tiers existed (no `tier` field) predates
    // room-gating and had every room open, so grant the full Estate rather than
    // walling an existing player out of rooms they built in.
    const tier = savedHome["tier"];
    player.home.tier = typeof tier === "number" ? Math.max(0, Math.min(3, Math.floor(tier))) : 3;
  } else if (isRecord(savedHousing) && isRecord(savedHousing["furniture"])) {
    // One-time migration from the fixed-slot era — also a pre-tier home, so open
    // it fully.
    const furn = savedHousing["furniture"] as Record<string, unknown>;
    for (const hotspotId of Object.keys(furn)) {
      const fid = furn[hotspotId];
      const def = content.objects.find((o) => o.id === hotspotId);
      if (def && def.kind === "build_hotspot" && typeof fid === "string" && fid in content.furniture) {
        player.home.placed.push({ item: fid, x: def.x, y: def.y, rot: 0 });
      }
    }
    player.home.tier = 3;
  }

  const savedQuests = raw["quests"];
  if (isRecord(savedQuests)) {
    const quests: Player["quests"] = {};
    for (const id of Object.keys(savedQuests)) {
      const def = content.quests.find((q) => q.id === id);
      const s = savedQuests[id];
      if (!def || !isRecord(s)) continue;
      if (player.questsDone.includes(id)) continue; // done wins over active
      const step = finiteNum(s["step"]) ? s["step"] : 0;
      const killCount = finiteNum(s["killCount"]) ? s["killCount"] : 0;
      if (step >= 0 && step < def.steps.length) {
        quests[id] = { step: Math.floor(step), killCount: Math.max(0, Math.floor(killCount)) };
      }
    }
    player.quests = quests;
  }

  // --- Pier records board: keep the saved top-five (heaviest first). A save
  //     from before the pier existed has none, so the createWorld seed stands. ---
  const savedRecords = raw["fishingRecords"];
  if (Array.isArray(savedRecords)) {
    // Keep only the player's OWN catches from the save; the rival seeds are
    // re-injected fresh from content, so tuning the seed board (e.g. lowering
    // the amounts) takes effect for existing saves, not just new characters.
    const mine: FishRecord[] = [];
    for (const r of savedRecords) {
      if (
        isRecord(r) &&
        typeof r["species"] === "string" &&
        finiteNum(r["weight"]) && r["weight"] > 0 &&
        finiteNum(r["length"]) && r["length"] > 0 &&
        typeof r["angler"] === "string" &&
        r["angler"] === player.appearance.name
      ) {
        mine.push({
          species: r["species"].slice(0, 40),
          weight: Math.round(r["weight"] * 10) / 10,
          length: Math.round(r["length"]),
          angler: r["angler"].slice(0, 24),
        });
      }
    }
    const merged = [...mine, ...content.pierRecords.map((r) => ({ ...r }))];
    merged.sort((a, b) => b.weight - a.weight);
    if (merged.length > 5) merged.length = 5;
    player.fishingRecords = merged;
  }

  // --- Max HP follows the loaded Vitality level, then HP clamps to it ---
  player.maxHp = 10 + player.skills.vitality.level;

  // --- HP (clamped to the player's range) ---
  const hp = raw["hp"];
  if (typeof hp === "number" && Number.isFinite(hp)) {
    player.hp = Math.max(1, Math.min(player.maxHp, Math.floor(hp)));
  }

  // --- Position (only onto a real, non-water tile) ---
  const pos = raw["pos"];
  if (isRecord(pos) && typeof pos["x"] === "number" && typeof pos["y"] === "number") {
    const x = Math.round(pos["x"]);
    const y = Math.round(pos["y"]);
    const m = state.map;
    const inBounds = x >= 0 && y >= 0 && x < m.width && y < m.height;
    if (inBounds && m.tiles[y * m.width + x] !== "water") {
      player.pos = { x, y };
      player.prevPos = { x, y }; // load in place — never glide from the spawn seed
    }
  }

  // Respawn point (set to a homestead once a bed is built). Validate like pos.
  // Migration: respawns are the city hub now, not the old tutorial corner. A
  // saved OVERWORLD spawn is that legacy default, so snap it to the current
  // respawn point; a home spawn (down in the hidden interior band) is kept.
  const sp = raw["spawn"];
  // The hidden bands (arenas, home interiors, dungeons) all sit below the
  // overworld — anchored to the constant, NOT height arithmetic, so adding new
  // bands (e.g. the dungeon band) can't silently shift this boundary.
  const bandTop = OVERWORLD_HEIGHT;
  if (isRecord(sp) && typeof sp["x"] === "number" && typeof sp["y"] === "number") {
    const x = Math.round(sp["x"]);
    const y = Math.round(sp["y"]);
    const m = state.map;
    const valid = x >= 0 && y >= 0 && x < m.width && y < m.height && m.tiles[y * m.width + x] !== "water";
    if (valid && y >= bandTop) {
      player.spawn = { x, y }; // a homestead respawn — keep it
    } else {
      player.spawn = { x: content.respawnPoint.x, y: content.respawnPoint.y };
    }
  }

  // Always resume in a clean, alive, idle state — runtime timers don't persist.
  player.alive = true;
  if (player.hp <= 0) player.hp = player.maxHp;
  player.path = [];
  player.pendingInteractId = null;
  player.pendingInteractMode = null;
  player.pendingPickup = null;
  player.pendingCook = null;
  player.station = null;
  player.activity = { kind: "idle", targetId: null, actionId: null, nextActionAt: 0, actionInterval: 0 };
  player.respawnAt = 0;
  return true;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** A real, finite number — rejects NaN and ±Infinity from a corrupt save. */
function finiteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function levelFromTable(table: number[], xp: number): number {
  // Never read above the level cap — the table is built past it, but the orb
  // freezes at LEVEL_CAP (XP keeps climbing beyond, to the 100M ceiling).
  for (let L = Math.min(table.length - 1, LEVEL_CAP); L >= 1; L--) {
    if (xp >= (table[L] ?? Infinity)) return L;
  }
  return 1;
}
