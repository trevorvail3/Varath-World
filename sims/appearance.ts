/**
 * sims/appearance.ts
 * ------------------
 * Checks the player's look the way the content layer is checked.
 *
 *   npx tsx sims/appearance.ts
 *
 * `build` was written into every save by serializePlayer and read back by
 * nobody, so choosing Lean or Broad in the creator lasted exactly until the next
 * reload and then silently became average again. It shipped that way because
 * nothing round-trips an appearance: sims/ironman.ts round-trips a whole save
 * but asserts only on mode, combat feats and hardcore death, and the player it
 * uses never sets a look.
 *
 * This closes that hole and the ones next to it. Exits non-zero on failure.
 */

import { readFileSync } from "node:fs";
import { content, makeWorld, SimClock } from "./harness.ts";
import { hydratePlayer, serializePlayer } from "../src/core/save.ts";
import {
  BUILD_STYLES, CLOTH, DEFAULT_APPEARANCE, FACIAL_STYLES, HAIR_STYLES,
  HAIRS, LEG_STYLES, SHOE_STYLES, SKINS, TOP_STYLES,
} from "../src/client/avatar.ts";
import type { Appearance } from "../src/core/types.ts";

const fails: string[] = [];
const check = (ok: boolean, msg: string): void => { if (!ok) fails.push(msg); };
const read = (p: string): string => readFileSync(p, "utf8");

// --- 1) Every field of a look survives a save round-trip --------------------
// The one assertion that would have caught the `build` bug on the day it landed.
const st = makeWorld(new SimClock(1));
const chosen: Appearance = {
  ...DEFAULT_APPEARANCE,
  name: "Roundtrip",
  skin: SKINS[4]!,
  hair: HAIRS[6]!,
  tunic: CLOTH[3]!,
  legColor: CLOTH[5]!,
  shoeColor: CLOTH[8]!,
  hairStyle: "ponytail",
  facial: "goatee",
  top: "sash",
  legs: "kilt",
  shoes: "clogs",
  build: "broad",
};
st.player.appearance = { ...chosen };

const blob = JSON.parse(JSON.stringify(serializePlayer(st))) as unknown;
const fresh = makeWorld(new SimClock(2));
check(hydratePlayer(fresh, content, blob), "hydratePlayer refused its own serialised save");
const back = fresh.player.appearance as unknown as Record<string, unknown>;
for (const [k, v] of Object.entries(chosen)) {
  check(back[k] === v, `appearance.${k} did not survive the save: wrote ${String(v)}, read ${String(back[k])}`);
}

// A look that sets nothing must come back as the default, not as junk.
const bare = makeWorld(new SimClock(3));
hydratePlayer(bare, content, { version: 1, appearance: {} });
check(
  typeof bare.player.appearance.skin === "string" && bare.player.appearance.skin.startsWith("#"),
  "an empty appearance block left the player without a skin colour",
);

// --- 2) Nothing collides with the presence wire ------------------------------
// Presence folds the gear blob into the same JSON object as the look, under
// `_gear` (presence.ts). A field by that name would destroy gear rendering for
// every remote viewer, and nothing else would ever say so.
const presence = read("src/client/presence.ts");
check(/look: \{ \.\.\.s\.look, _gear: s\.gear \}/.test(presence),
  "presence no longer folds gear under `_gear` — this check needs updating to match");
check(!Object.keys(DEFAULT_APPEARANCE).includes("_gear"),
  "an appearance field is named `_gear` and will collide with the presence wire");

// --- 3) Every offered style is one the renderer knows ------------------------
// The creator's tables and the renderer's switches drifted apart silently: an id
// the renderer has no case for falls through to a default that looks like a
// different choice entirely.
const avatar = read("src/client/avatar.ts");
const hairCases = new Set([...avatar
  .slice(avatar.indexOf("function drawHair("), avatar.indexOf("function drawHairBack("))
  .matchAll(/case "([a-z]+)"/g)].map((m) => m[1]!));
for (const h of HAIR_STYLES) {
  check(h.id === "bald" || hairCases.has(h.id), `hair style "${h.id}" is offered but drawHair has no case for it`);
}
const facialBody = avatar.slice(avatar.indexOf("function drawFacial("), avatar.indexOf("function drawHair("));
// drawFacial is a chain of early returns ending in a fall-through, so exactly
// one style — the full beard — is drawn without being named. Every other one
// must be named, or it silently renders as that fall-through.
const unnamedBeards = FACIAL_STYLES.filter((f) => !facialBody.includes(`"${f.id}"`));
check(unnamedBeards.length <= 1,
  `${unnamedBeards.length} beards have no case in drawFacial and all render as the fall-through: ` +
  unnamedBeards.map((f) => f.id).join(", "));
for (const [list, name] of [[TOP_STYLES, "top"], [LEG_STYLES, "legs"], [SHOE_STYLES, "shoes"]] as const) {
  for (const o of list) {
    check(avatar.includes(`"${o.id}"`), `${name} style "${o.id}" is offered but never mentioned by the renderer`);
  }
}
// Build ids must round-trip through the save's own membership check.
const save = read("src/core/save.ts");
for (const b of BUILD_STYLES) {
  check(b.id === "average" || save.includes(`b === "${b.id}"`),
    `build "${b.id}" is offered but hydratePlayer will not accept it — it will revert on reload`);
}

// --- 4) The default look is reachable in the creator -------------------------
// The starting shoe colour was not a member of the palette the creator offers
// for shoes, so the screen opened with no swatch selected and no way back to it.
const inPalette: [string, string, string[]][] = [
  ["skin", DEFAULT_APPEARANCE.skin, SKINS],
  ["hair", DEFAULT_APPEARANCE.hair, HAIRS],
  ["tunic", DEFAULT_APPEARANCE.tunic, CLOTH],
  ["legColor", DEFAULT_APPEARANCE.legColor, CLOTH],
  ["shoeColor", DEFAULT_APPEARANCE.shoeColor, CLOTH],
];
for (const [field, value, palette] of inPalette) {
  check(palette.includes(value), `the default ${field} (${value}) is not one of the swatches the creator offers`);
}
for (const [field, list] of [["hairStyle", HAIR_STYLES], ["facial", FACIAL_STYLES],
  ["top", TOP_STYLES], ["legs", LEG_STYLES], ["shoes", SHOE_STYLES]] as const) {
  const v = DEFAULT_APPEARANCE[field];
  check(list.some((o) => o.id === v), `the default ${field} ("${v}") is not one of the styles the creator offers`);
}

// --- 5) The three default-look literals agree --------------------------------
// The core cannot import the client (the core is pure), so the fresh world's
// appearance is hand-copied from DEFAULT_APPEARANCE. Nothing kept them in step.
const worldDefault = makeWorld(new SimClock(4)).player.appearance as unknown as Record<string, unknown>;
for (const [k, v] of Object.entries(DEFAULT_APPEARANCE)) {
  if (k === "name") continue; // the world's fresh player is named elsewhere
  check(worldDefault[k] === v,
    `the core's fresh-world appearance disagrees with DEFAULT_APPEARANCE on ${k}: ${String(worldDefault[k])} vs ${String(v)}`);
}

// --- 6) The creator can be operated without a pointer ------------------------
const creator = read("src/client/characterCreator.ts");
check(!creator.includes('addEventListener("pointerdown"'),
  "the creator is bound to pointerdown again — Enter and Space on a focused control will do nothing");
check(creator.includes('setAttribute("aria-label"'),
  "the creator's controls have lost their names");

console.log(
  `appearance fields ${Object.keys(DEFAULT_APPEARANCE).length}` +
  ` · styles ${HAIR_STYLES.length} hair / ${FACIAL_STYLES.length} beard / ${BUILD_STYLES.length} build` +
  ` · palettes ${SKINS.length} skin / ${HAIRS.length} hair / ${CLOTH.length} cloth`,
);
if (fails.length) {
  console.error(`\nFAIL (${fails.length}):`);
  for (const f of fails.slice(0, 12)) console.error("  - " + f);
  if (fails.length > 12) console.error(`  … and ${fails.length - 12} more`);
  process.exit(1);
}
console.log("\nPASS");
