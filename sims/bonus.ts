/**
 * sims/bonus.ts
 * -------------
 * Checks the derived equipment bonus sheet.
 *
 *   npx tsx sims/bonus.ts
 *
 * The vector is derived, not authored, so nothing in `items.ts` will fail to
 * compile if the derivation goes wrong — these assertions are the only thing
 * that would notice. Exits non-zero on failure so it can gate a change.
 */

import { content } from "./harness.ts";
import { EQUIP_BONUS_OVERRIDE, deriveEquipBonus } from "../src/content/equipBonus.ts";
import type { EquipBonus, ItemId } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };

const KEYS: (keyof EquipBonus)[] = [
  "aStab", "aSlash", "aCrush", "aMagic", "aRange",
  "dStab", "dSlash", "dCrush", "dMagic", "dRange",
  "str", "rngStr", "magDmg", "prayer",
];

// --- 1. Every item has a complete, finite vector --------------------------
let slotted = 0;
for (const [id, def] of Object.entries(content.items)) {
  const b = content.equipBonus[id as ItemId];
  check(!!b, `${id}: no bonus vector`);
  if (!b) continue;
  if (def.slot) slotted++;
  for (const k of KEYS) {
    check(Number.isFinite(b[k]), `${id}.${k} is not finite (${b[k]})`);
    check(Math.abs(b[k]) <= 400, `${id}.${k} out of range (${b[k]})`);
  }
}
console.log(`vectors: ${Object.keys(content.equipBonus).length} (${slotted} slotted)`);

// --- 2. The armour triangle actually tilts --------------------------------
/** Best-in-slot body armour of each archetype, by total defence. */
function bestOf(cats: string[]): { id: string; b: EquipBonus } | null {
  let best: { id: string; b: EquipBonus } | null = null;
  for (const [id, def] of Object.entries(content.items)) {
    if (!def.cat || !cats.includes(def.cat) || def.slot !== "armor") continue;
    const b = content.equipBonus[id as ItemId]!;
    const tot = b.dStab + b.dSlash + b.dCrush + b.dMagic + b.dRange;
    const bt = best ? best.b.dStab + best.b.dSlash + best.b.dCrush + best.b.dMagic + best.b.dRange : -1;
    if (!best || tot > bt) best = { id, b };
  }
  return best;
}

const plate = bestOf(["Armour", "Legendary Armour"]);
const leather = bestOf(["Leather Armour", "Ranged Armour"]);
const robe = bestOf(["Magic Robes"]);

if (plate && leather && robe) {
  console.log(`plate   ${plate.id}: stab ${plate.b.dStab} magic ${plate.b.dMagic} range ${plate.b.dRange}`);
  console.log(`leather ${leather.id}: stab ${leather.b.dStab} magic ${leather.b.dMagic} range ${leather.b.dRange}`);
  console.log(`robe    ${robe.id}: stab ${robe.b.dStab} magic ${robe.b.dMagic} range ${robe.b.dRange}`);
  // Each archetype must be relatively strongest where its lore says it should be.
  // Compared as a SHARE of the piece's own total, so a simply-better item can't
  // win every row and hide the tilt.
  const share = (b: EquipBonus, k: keyof EquipBonus): number =>
    b[k] / Math.max(1, b.dStab + b.dSlash + b.dCrush + b.dMagic + b.dRange);
  check(share(plate.b, "dStab") > share(robe.b, "dStab"), "plate should out-resist robes vs stab (by share)");
  check(share(robe.b, "dMagic") > share(plate.b, "dMagic"), "robes should out-resist plate vs magic (by share)");
  check(share(leather.b, "dRange") > share(robe.b, "dRange"), "leather should out-resist robes vs ranged (by share)");
} else {
  fails.push("could not find a body piece for each archetype");
}

// --- 3. A melee weapon favours its own attack style -----------------------
let checkedWeapons = 0;
for (const [id, def] of Object.entries(content.items)) {
  if (def.slot !== "mainhand" || def.ranged || def.magic || def.tool || !def.acc) continue;
  const b = content.equipBonus[id as ItemId]!;
  const own = def.attackStyle === "stab" ? b.aStab : def.attackStyle === "slash" ? b.aSlash : b.aCrush;
  const others = [b.aStab, b.aSlash, b.aCrush].filter((v) => v !== own);
  check(others.every((v) => v <= own), `${id}: off-style attack bonus exceeds its own style`);
  checkedWeapons++;
}
console.log(`melee weapons checked: ${checkedWeapons}`);

// --- 4. Every override actually changes something -------------------------
for (const [id, over] of Object.entries(EQUIP_BONUS_OVERRIDE)) {
  const def = content.items[id as ItemId];
  check(!!def, `override for unknown item ${id}`);
  if (!def || !over) continue;
  const base = deriveEquipBonus(def);
  const changed = (Object.keys(over) as (keyof EquipBonus)[]).some((k) => over[k] !== base[k]);
  check(changed, `override for ${id} matches the derivation — it is dead weight`);
}
console.log(`overrides: ${Object.keys(EQUIP_BONUS_OVERRIDE).length}`);

if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("\nOK");
export {};
