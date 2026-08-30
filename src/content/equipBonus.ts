/**
 * src/content/equipBonus.ts
 * -------------------------
 * Derives every item's `EquipBonus` — OSRS's ten-way attack/defence vector plus
 * the damage bonuses — from the fields items already carry.
 *
 * WHY DERIVED, NOT AUTHORED: 368 items have an equipment slot. Hand-writing
 * fourteen numbers for each would be 5,000 numbers nobody could keep consistent,
 * and every new item would need them. Instead each item's single `def` (or
 * `acc`/`dmg`) is spread across the five damage types by an archetype read off
 * its existing `cat`, so the whole sheet stays in step with `items.ts` for free.
 *
 * WHY AT BOOT, NOT GENERATED: a checked-in generated table would need
 * regenerating on every item edit and would rot silently — and with no test
 * runner in this repo, nothing would catch the drift. This is pure arithmetic
 * over data already in memory and costs well under a millisecond for 704 items.
 *
 * RULE 1 SAFE: no clock, no RNG, no DOM. Pure functions over content data.
 */

import type { EquipBonus, ItemDef, ItemId } from "../core/types.ts";

const ZERO: EquipBonus = {
  aStab: 0, aSlash: 0, aCrush: 0, aMagic: 0, aRange: 0,
  dStab: 0, dSlash: 0, dCrush: 0, dMagic: 0, dRange: 0,
  str: 0, rngStr: 0, magDmg: 0, prayer: 0,
};

/**
 * How much of a melee weapon's accuracy carries to the two damage types it is
 * NOT built for. A sword can stab — just badly. This is what will make
 * per-weapon attack options a real choice rather than a cosmetic one.
 */
const OFF_STYLE = 0.35;

/** The armour archetypes, and how each spreads its `def` across the five types.
 *
 *  This is the armour triangle, and it is deliberately MODERATE: the spread runs
 *  0.45–1.15, so wearing the wrong type against a caster costs you noticeably
 *  without making a set you ground for useless. Tune here, in one place, if it
 *  reads too soft in play. */
type Archetype = "plate" | "chain" | "leather" | "robe" | "jewellery" | "cape" | "none";

const DEFENCE_SPREAD: Record<Archetype, [number, number, number, number, number]> = {
  //          stab  slash  crush  magic  range
  plate:     [1.00, 1.05,  0.95,  0.55,  1.00],
  chain:     [0.90, 1.00,  1.00,  0.70,  0.95],
  leather:   [0.65, 0.70,  0.75,  0.80,  1.00],
  robe:      [0.45, 0.45,  0.50,  1.15,  0.55],
  jewellery: [0.40, 0.40,  0.40,  0.40,  0.40],
  cape:      [0.55, 0.55,  0.55,  0.55,  0.55],
  none:      [1.00, 1.00,  1.00,  1.00,  1.00],
};

/** Categories that read as heavy metal armour. */
const PLATE_CATS = new Set(["Armour", "Legendary Armour", "Bone Armour"]);
/** Categories that read as light/ranged armour. */
const LEATHER_CATS = new Set(["Leather Armour", "Ranged Armour", "Greenhood Armour", "Trails"]);
/** Categories that read as caster robes. */
const ROBE_CATS = new Set(["Magic Robes", "Prophet's Regalia", "Ashen Regalia"]);
/** Categories that are worn trinkets rather than body armour. */
const JEWEL_CATS = new Set(["Jewellery", "Legendary Jewellery", "Heraldry"]);

function archetypeOf(def: ItemDef): Archetype {
  const cat = def.cat ?? "";
  if (PLATE_CATS.has(cat)) return "plate";
  if (LEATHER_CATS.has(cat)) return "leather";
  if (ROBE_CATS.has(cat)) return "robe";
  if (JEWEL_CATS.has(cat)) return "jewellery";
  if (cat === "Capes") return "cape";
  // A shield is chain-ish; so is anything else worn in the off-hand.
  if (def.slot === "offhand") return "chain";
  // Fall back on what the piece is gated by: ranged kit defends like leather,
  // caster kit like a robe. This catches items whose `cat` is unusual.
  if (def.equipSkill === "draw") return "leather";
  if (def.equipSkill === "faith") return "robe";
  return "none";
}

/** The Grace (prayer) bonus a piece carries — caster kit and skill capes. */
function prayerOf(def: ItemDef, arch: Archetype): number {
  if (arch === "robe") return Math.max(1, Math.round((def.def ?? 0) / 8));
  if (arch === "cape") return 1;
  return 0;
}

/**
 * The whole derivation for one item. Weapons put their accuracy on the damage
 * type they are built for; armour spreads its defence by archetype; both then
 * add whatever explicit ranged/magic fields the item already carries.
 */
export function deriveEquipBonus(def: ItemDef): EquipBonus {
  const b: EquipBonus = { ...ZERO };
  if (!def.slot) return b;

  const acc = def.acc ?? 0;
  const dmg = def.dmg ?? 0;
  const dfn = def.def ?? 0;

  if (def.tool) {
    // Gathering tools are not fighting gear. A token crush bonus keeps a
    // hatchet from reading as literally nothing in hand.
    b.aCrush = def.tier ?? 1;
  } else if (def.ranged) {
    b.aRange += acc;
    b.rngStr += dmg;
  } else if (def.magic) {
    b.aMagic += acc;
    // A flat add, matching Varath's existing magic max-hit maths rather than
    // OSRS's percentage model — inventing a % ladder for nine staves would be
    // churn without a payoff.
    b.magDmg += dmg;
  } else if (acc > 0 || dmg > 0) {
    // A melee weapon: full accuracy on its own attack style, a fraction on the
    // other two.
    const style = def.attackStyle;
    const off = Math.round(acc * OFF_STYLE);
    b.aStab = style === "stab" ? acc : off;
    b.aSlash = style === "slash" ? acc : off;
    b.aCrush = style === "crush" ? acc : off;
    b.str += dmg;
  }

  // Defence, spread by archetype.
  const arch = archetypeOf(def);
  if (dfn !== 0) {
    const [ds, dl, dc, dm, dr] = DEFENCE_SPREAD[arch];
    b.dStab += Math.round(dfn * ds);
    b.dSlash += Math.round(dfn * dl);
    b.dCrush += Math.round(dfn * dc);
    b.dMagic += Math.round(dfn * dm);
    b.dRange += Math.round(dfn * dr);
  }

  // Skill capes are best-in-slot defensive gear — their worn benefit. This used
  // to be hardcoded inside the core's stat sum; it belongs here with the rest of
  // the derivation.
  if (def.cat === "Capes") {
    const flat = def.meta?.skill === "max" || def.meta?.skill === "ironvale" ? 18 : 10;
    const [ds, dl, dc, dm, dr] = DEFENCE_SPREAD.cape;
    b.dStab += Math.round(flat * ds);
    b.dSlash += Math.round(flat * dl);
    b.dCrush += Math.round(flat * dc);
    b.dMagic += Math.round(flat * dm);
    b.dRange += Math.round(flat * dr);
  }

  // Explicit ranged/magic ratings an item carries on top of its main role
  // (a ring that helps your bow, a hood that helps your casting).
  b.aRange += def.rngAcc ?? 0;
  b.rngStr += def.rngDmg ?? 0;
  b.aMagic += def.magAcc ?? 0;
  b.magDmg += def.magDmg ?? 0;
  b.prayer += prayerOf(def, arch);

  return b;
}

/**
 * Pieces whose derived vector is deliberately overridden. Reserved for the
 * marquee/legendary items whose whole point is to break the pattern — a partial
 * object, merged over the derived one.
 */
export const EQUIP_BONUS_OVERRIDE: Partial<Record<ItemId, Partial<EquipBonus>>> = {
  // The Wyrm plates are the game's best defensive pieces; they keep plate's
  // shape but are not as blind to magic as ordinary metal.
  wyrm_body: { dMagic: 45 },
  wyrm_legs: { dMagic: 50 },
  // The Storm-Mantle is a traveller's cape, not armour — its value is its perk.
  storm_mantle: { prayer: 4 },
  // The Herald's plate is consecrated: it defends a caster as well as a knight.
  pale_greaves: { dMagic: 40, prayer: 2 },
};

/** Build the whole table once, at boot. */
export function buildEquipBonuses(items: Record<ItemId, ItemDef>): Record<ItemId, EquipBonus> {
  const out: Record<string, EquipBonus> = {};
  for (const [id, def] of Object.entries(items)) {
    const base = deriveEquipBonus(def);
    const over = EQUIP_BONUS_OVERRIDE[id as ItemId];
    out[id] = over ? { ...base, ...over } : base;
  }
  // Every key came straight from `items`, so the record is total over ItemId.
  return out as Record<ItemId, EquipBonus>;
}
