/**
 * src/content/spells.ts
 * ---------------------
 * The Devotion spellbook — one page, mixing attack and utility casts. Every spell
 * spends Grace (refilled only at shrines/altars or via a Devotion Potion) and is
 * gated by a Devotion level. The basic staff bolt is free and handled in combat;
 * these are the Grace-fuelled specials you layer on top.
 *
 * Pure DATA. The core (src/core/worldCore.ts `castSpell`) reads `kind` and the
 * matching effect fields; the client renders the list in the Spells tab.
 */

import type { SpellDef } from "../core/types.ts";

export const spells: SpellDef[] = [
  {
    id: "spark", name: "Orun's Spark", icon: "✨",
    faithReq: 1, cost: 3, kind: "attack", dmgMult: 1.1, xp: 8,
    blurb: "A quick lance of light at your target. Cheap, and always at hand.",
  },
  {
    id: "mend", name: "Mend", icon: "❤️",
    faithReq: 5, cost: 5, kind: "heal", heal: 12, xp: 12,
    blurb: "Knit your wounds with a whispered rite. Heals a chunk of health.",
  },
  {
    id: "emberbolt", name: "Emberbolt", icon: "🔥",
    faithReq: 20, cost: 6, kind: "attack", dmgMult: 1.6, xp: 20,
    blurb: "A searing bolt of ember-light — a solid burst on your target.",
  },
  {
    id: "wayfare", name: "Wayfare", icon: "🗺️",
    faithReq: 25, cost: 10, kind: "teleport", xp: 30,
    blurb: "Step through Orun's light back to the city hub. Escape, or just save the walk.",
  },
  {
    id: "kindle", name: "Kindle", icon: "🔥",
    faithReq: 30, cost: 4, kind: "kindle", xp: 24,
    blurb: "Superheat an ore in your pack straight into a bar — no furnace needed.",
  },
  {
    id: "aegis", name: "Aegis", icon: "🛡️",
    faithReq: 35, cost: 10, kind: "ward", wardAmt: 12, wardMs: 30000, xp: 26,
    blurb: "A shimmering ward that turns aside blows for a short while.",
  },
  // --- Protection blessings: held, not cast. One at a time, no staff needed —
  // a prayer, OSRS-style. While held it HALVES incoming damage of its style and
  // drains Grace steadily, guttering out when the pool runs dry. This is the
  // counterplay layer every hard boss assumes: read the boss's attack style,
  // light the right blessing, and the unhealable bursts become survivable.
  {
    id: "deflect_magic", name: "Deflect Sorcery", icon: "🌀",
    faithReq: 37, cost: 0, kind: "blessing", deflectStyle: "magic", drainPerSec: 0.6, xp: 0,
    blurb: "Hold Orun's light against hostile magic — halves magic damage while it burns. Drains Grace steadily; douse it when the danger passes.",
  },
  {
    id: "deflect_ranged", name: "Deflect Arrows", icon: "🛡️",
    faithReq: 40, cost: 0, kind: "blessing", deflectStyle: "ranged", drainPerSec: 0.6, xp: 0,
    blurb: "A shimmer in the air that turns arrows from their line — halves ranged damage while it burns. Drains Grace steadily.",
  },
  {
    id: "deflect_melee", name: "Deflect Blows", icon: "✋",
    faithReq: 43, cost: 0, kind: "blessing", deflectStyle: "melee", drainPerSec: 0.6, xp: 0,
    blurb: "Orun's hand between you and the blow — halves melee damage while it burns. Drains Grace steadily.",
  },
  // --- Offensive blessings: the OTHER side of the prayer layer. Held (one at a
  // time, in place of a protection blessing — Grace can carry only one flame),
  // they turn Grace into raw combat power for ANY style. They drain FAST, so
  // they're a "spend Grace to kill faster" gamble against protecting yourself.
  {
    id: "keen_prayer", name: "Keen Devotion", icon: "🎯",
    faithReq: 45, cost: 0, kind: "blessing", boostAcc: 1.12, drainPerSec: 0.9, xp: 0,
    blurb: "Steady your hand with Orun's focus — +12% accuracy for every style while it burns. Drains Grace faster than a shield-prayer; you can hold only one flame.",
  },
  {
    id: "zealots_fury", name: "Zealot's Fury", icon: "⚔️",
    faithReq: 62, cost: 0, kind: "blessing", boostAcc: 1.1, boostDmg: 1.12, boostDef: 1.08, drainPerSec: 1.5, xp: 0,
    blurb: "The martyr's ardour: +10% accuracy, +12% damage and +8% defence at once, for any style. Burns Grace hard — a finisher's prayer, not an all-day one.",
  },
  {
    id: "marrow_grip", name: "Marrow Grip", icon: "🦴",
    faithReq: 45, cost: 8, kind: "curse", curseAmt: 25, curseMs: 20000, xp: 34,
    blurb: "Grip your foe's bones and drop their defence — soften a tough target for the kill.",
  },
  {
    id: "enchant", name: "Enchant", icon: "💎",
    faithReq: 50, cost: 8, kind: "enchant", xp: 40,
    blurb: "Cut and enchant a rough or uncut gem into a polished, valuable cut gem.",
  },
  {
    id: "oruns_wrath", name: "Orun's Wrath", icon: "🌟",
    faithReq: 70, cost: 22, kind: "attack", dmgMult: 2.2, xp: 60,
    blurb: "The finisher: call down Orun's full fury on a single foe.",
  },
];
