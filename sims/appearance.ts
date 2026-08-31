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

import { readdirSync, readFileSync } from "node:fs";
import { content, makeWorld, SimClock } from "./harness.ts";
import { hydratePlayer, serializePlayer } from "../src/core/save.ts";
import { applyIntent, BARBER_FEE } from "../src/core/worldCore.ts";
import { CITY } from "../src/content/map.ts";
import {
  BROW_STYLES, BUILD_STYLES, CLOTH, DEFAULT_APPEARANCE, EYE_STYLES, EYES,
  FACIAL_STYLES, HAIR_STYLES, HAIRS, JAW_STYLES, LEG_STYLES, SHOE_STYLES,
  HEIGHT_STYLES, MARKING_COLORS, MARKING_STYLES, SKINS, TOP_STYLES,
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
// "bald" and "shaved" are handled by drawHair's early return rather than by a
// switch case — they are the two styles defined by the absence of hair.
const HAIR_EARLY = new Set(["bald", "shaved"]);
for (const h of HAIR_STYLES) {
  check(HAIR_EARLY.has(h.id) || hairCases.has(h.id),
    `hair style "${h.id}" is offered but drawHair has no case for it`);
  check(HAIR_EARLY.has(h.id) || avatar.includes(`"${h.id}"`),
    `hair style "${h.id}" is never mentioned by the renderer`);
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

// --- 6) The figure has four views, not one ----------------------------------
// `down` and `right` used to be byte-identical and `up` was that same body with
// the head recoloured. The view table is what makes them differ; assert it is
// still there and that the three views are genuinely distinct geometry.
const views = avatar.slice(avatar.indexOf("const VIEWS:"), avatar.indexOf("function drawAvatarInner("));
for (const v of ["front", "back", "side"]) {
  check(new RegExp(`\\b${v}: \\{`).test(views), `the "${v}" view is gone from the view table`);
}
const halves = [...views.matchAll(/torsoHalf: ([0-9.]+)/g)].map((m) => Number(m[1]));
check(halves.length === 3, `expected three views, found ${halves.length}`);
check(new Set(halves).size > 1, "every view has the same shoulder width — the figure does not turn");
check(/const lx = flip \? -1 : 1;/.test(avatar),
  "the light no longer follows the screen — it will swap sides when the player turns around");
check(!/\banim\.flip\b/.test(read("src/client/render.ts")) &&
      !/flip: /.test(read("src/client/duelUI.ts")),
  "a caller is back on the legacy `flip` boolean and cannot show the back view");

// --- 7) The figure has a face ------------------------------------------------
// The head was a bare skin disc — no eyes, no brow, no mouth — while every
// monster in the game had eye glints.
check(/function drawFace\(/.test(avatar), "the figure has lost its face");
for (const [list, field] of [[EYE_STYLES, "eyes"], [BROW_STYLES, "brows"], [JAW_STYLES, "jaw"]] as const) {
  check(list.length >= 4, `only ${list.length} ${field} options`);
  const v = DEFAULT_APPEARANCE[field];
  check(list.some((o) => o.id === v), `the default ${field} ("${String(v)}") is not one of the options offered`);
}
check(EYES.includes(DEFAULT_APPEARANCE.eyeColor ?? ""), "the default iris colour is not one of the swatches");
// Every face field must be one hydratePlayer will accept, or it reverts on load.
const hydrateBlock = save.slice(save.indexOf("const savedApp = raw"), save.indexOf("// Bounty:"));
for (const k of ["eyes", "brows", "jaw"]) {
  check(hydrateBlock.includes(`"${k}"`), `appearance.${k} is not in the save's allow-list and will not survive a reload`);
}
for (const k of ["eyeColor", "beardColor"]) {
  check(hydrateBlock.includes(`"${k}"`), `appearance.${k} is not in the save's colour allow-list`);
}
check(/look\.beardColor \?\? look\.hair/.test(avatar),
  "facial hair is hard-wired to the hair colour again — a beard cannot go grey");

// --- 8) A build is a build, not a stretch ------------------------------------
// `build` used to be a horizontal scale of the ENTIRE figure — head, helmet and
// weapon included — so Lean and Broad were the same person at two aspect ratios.
check(!/g\.scale\(bx, 1\)/.test(avatar), "the build is a horizontal stretch of the whole figure again");
const buildTable = avatar.slice(avatar.indexOf("const BUILDS:"), avatar.indexOf("function drawAvatarInner("));
for (const b of BUILD_STYLES) {
  check(new RegExp(`\\b${b.id}: \\{`).test(buildTable), `build "${b.id}" is offered but has no geometry`);
}
// Each build must differ from average in more than one dimension, or it is a
// label rather than a frame.
for (const dim of ["shoulder", "waist", "limb", "stance"]) {
  const vals = [...buildTable.matchAll(new RegExp(`${dim}: ([0-9.]+)`, "g"))].map((m) => Number(m[1]));
  check(new Set(vals).size >= 3, `every build has almost the same ${dim} (${new Set(vals).size} distinct values)`);
}
for (const h of HEIGHT_STYLES) {
  check(h.id === "average" || avatar.includes(`${h.id}: `), `height "${h.id}" is offered but has no scale`);
  check(h.id === "average" || save.includes(`ht === "${h.id}"`),
    `height "${h.id}" is offered but hydratePlayer will not accept it — it will revert on reload`);
}

// --- 9) Hair, beards and markings all read ----------------------------------
// Six of the ten hair styles used to be a cap plus one rectangle, and the cap
// was a half-unit crescent — so "short" was indistinguishable from "bald" and
// short, side part and fringe were the same picture. Only five styles had any
// back view at all.
check(HAIR_STYLES.length >= 14, `only ${HAIR_STYLES.length} hair styles`);
check(/function crown\(/.test(avatar), "the hair cap is no longer a fitted crown");
const backBody = avatar.slice(avatar.indexOf("function drawHairBack("));
const backCases = new Set([...backBody.matchAll(/case "([a-z]+)"/g)].map((m) => m[1]!));
// Short, fringe and side part legitimately share a nape from behind; everything
// with a shape of its own must keep it when the figure turns away.
const NEEDS_BACK = ["long", "bob", "ponytail", "braid", "topknot", "curly", "wild", "mohawk", "undercut", "spiky"];
for (const id of NEEDS_BACK) {
  check(backCases.has(id), `"${id}" has no back view — it renders as a plain head from behind`);
  check(HAIR_STYLES.some((h) => h.id === id), `the sim expects a "${id}" hair style that no longer exists`);
}
check(FACIAL_STYLES.length >= 6, `only ${FACIAL_STYLES.length} facial-hair options`);
check(!/globalAlpha = 0\.35;[\s\S]{0,80}arc\(cx, cy - 10/.test(avatar),
  "stubble is the full beard at reduced alpha again — it needs its own shape");
check(MARKING_STYLES.length >= 6 && MARKING_COLORS.length >= 4,
  "the markings list has shrunk");
for (const m of MARKING_STYLES) {
  check(m.id === "none" || avatar.includes(`case "${m.id}"`), `marking "${m.id}" is offered but never drawn`);
}
check(hydrateBlock.includes('"marking"') && hydrateBlock.includes('"markingColor"'),
  "markings are not in the save's allow-list and will not survive a reload");

// --- 10) Worn gear reads on the figure ---------------------------------------
// Boots and shields ignored ArmorStyle entirely: a mage's slipper, a ranger's
// boot and a plate sabaton were the same three rectangles, and a buckler, a
// kite shield and a lantern were the same hexagon at a fixed offset.
for (const st of ["robe", "leather"]) {
  check(new RegExp(`bs === "${st}"`).test(avatar), `boots no longer have a "${st}" shape`);
}
for (const sh of ["orb", "buckler"]) {
  check(new RegExp(`st === "${sh}"`).test(avatar), `offhands no longer have a "${sh}" shape`);
}
// Every offhand in the game is plate-styled, so the shape must come from the
// item rather than from the armour school, or two of the three are dead code.
const gearSrc = read("src/client/gearLook.ts");
check(/export function shieldShape/.test(gearSrc), "the offhand's silhouette is back to being styled by armour school");
const offhands = Object.values(content.items).filter((i) => i && i.slot === "offhand");
check(offhands.length > 0, "no offhand items found — is the probe reading the right slot?");
const shapes = new Set(offhands.map((i) => {
  const t = (i!.id + " " + (i!.name ?? "")).toLowerCase();
  return /buckler|targe/.test(t) ? "buckler" : /lantern|orb|focus|tome|ward\b/.test(t) ? "orb" : "kite";
}));
check(shapes.size >= 2, `all ${offhands.length} offhands resolve to one silhouette (${[...shapes].join(", ")})`);

// Bows, staves and rods ignored the metal argument, so a ranger's and a
// caster's whole progression was invisible on the figure.
const toolBody = avatar.slice(avatar.indexOf("export function drawTool"));
const bowCase = toolBody.slice(toolBody.indexOf('case "bow"'), toolBody.indexOf('case "staff"'));
check(/\biron\b|\bsteel\b/.test(bowCase), "the bow ignores its weapon's material again");
const staffCase = toolBody.slice(toolBody.indexOf('case "staff"'), toolBody.indexOf('default:'));
check(/\biron\b|\bsteel\b/.test(staffCase), "the staff ignores its weapon's material again");
check(/function tierGlow\(/.test(avatar), "every staff glows the same colour again");
check(/tool === "bow" && tier >= 4/.test(avatar), "a bow's tier no longer shows on the weapon");

// --- 11) The creator offers everything the figure can be --------------------
const creator = read("src/client/characterCreator.ts");
// Seven rows of cyclers in one column could not hold a face, a build, a height
// and markings, so the screen is sectioned. The rows are declared as data and
// read by both the row builder and the randomiser; this asserts that between
// them the sections reach every field the renderer draws.
const OFFERED = [
  ...[...creator.matchAll(/styleKey: "([a-zA-Z]+)"/g)].map((m) => m[1]!),
  ...[...creator.matchAll(/pseudo: "([a-zA-Z]+)"/g)].map((m) => m[1]!),
  ...[...creator.matchAll(/colorKey: "([a-zA-Z]+)"/g)].map((m) => m[1]!),
];
for (const field of Object.keys(DEFAULT_APPEARANCE)) {
  if (field === "name") continue; // its own control, not a style row
  check(OFFERED.includes(field), `appearance.${field} is drawn by the figure but the creator cannot set it`);
}
for (const field of ["build", "height", "marking", "markingColor", "beardColor"]) {
  check(OFFERED.includes(field), `the creator cannot set ${field}`);
}
check(/const PRESETS/.test(creator) && (creator.match(/label: "The /g) ?? []).length >= 5,
  "the creator's starting characters are gone");
// The turn controls moved into the shared Portrait with the rest of the
// preview; what the creator must still do is mount one.
check(/new Portrait\(/.test(creator), "the creator no longer shows a portrait at all");
check(/type = "color"/.test(creator), "the any-colour picker is gone — the ramps are the only choice again");
// The barber reuses this screen rather than duplicating it.
for (const opt of ["initial", "lockName", "hideMode"]) {
  check(creator.includes(`${opt}?:`), `the creator has lost its "${opt}" option and cannot serve the barber`);
}

// --- 12) The barber charges, and cannot rename you ---------------------------
// The look is the client's business; the price is the core's, because gold is
// game state. Without an intent the client could redraw the player and deduct
// nothing.
{
  const bw = makeWorld(new SimClock(9));
  bw.player.gold = 1000;
  const before = bw.player.appearance.name;
  const newLook: Appearance = { ...bw.player.appearance, name: "Impostor", hairStyle: "mohawk", build: "broad" };

  // Not in the chair: refused, and nothing is taken.
  bw.player.station = null;
  applyIntent(bw, content, { type: "RESTYLE", look: newLook }, { now: 0, rng: () => 0.5, epoch: 0 });
  check(bw.player.gold === 1000, "a restyle away from the chair still charged the player");
  check(bw.player.appearance.hairStyle !== "mohawk", "a restyle away from the chair still changed the look");

  // In the chair: it works, it costs, and the name is untouched.
  bw.player.station = { kind: "barber" };
  applyIntent(bw, content, { type: "RESTYLE", look: newLook }, { now: 0, rng: () => 0.5, epoch: 0 });
  check(bw.player.appearance.hairStyle === "mohawk", "the barber did not restyle the player");
  check(bw.player.appearance.build === "broad", "the barber dropped the new build");
  check(bw.player.gold === 1000 - BARBER_FEE, `the barber charged ${1000 - bw.player.gold}g, not ${BARBER_FEE}g`);
  check(bw.player.appearance.name === before,
    `the barber renamed the player to "${bw.player.appearance.name}" — the name is a join key for pier records and the name registry`);

  // Too poor: refused, and nothing is taken.
  bw.player.gold = BARBER_FEE - 1;
  bw.player.appearance.hairStyle = "short";
  applyIntent(bw, content, { type: "RESTYLE", look: newLook }, { now: 0, rng: () => 0.5, epoch: 0 });
  check(bw.player.gold === BARBER_FEE - 1, "a restyle the player could not afford still took their gold");
  check(bw.player.appearance.hairStyle === "short", "a restyle the player could not afford still happened");
}
// The chair itself must exist, be reachable and be in the city.
const chair = content.objects.find((o) => o.kind === "barber");
check(!!chair, "there is no barber's chair in the world");
if (chair) {
  check(chair.x >= CITY.x0 && chair.x <= CITY.x1 && chair.y >= CITY.y0 && chair.y <= CITY.y1,
    `the barber's chair is outside Ironvale at ${chair.x},${chair.y}`);
  const keeper = content.objects.find((o) => o.id === "mirren");
  check(!!keeper, "the barber's chair has nobody working it");
  if (keeper) {
    check(Math.hypot(keeper.x - chair.x, keeper.y - chair.y) < 4,
      `Mirren stands ${Math.round(Math.hypot(keeper.x - chair.x, keeper.y - chair.y))} tiles from the chair`);
  }
}

// --- 13) The creator can be operated without a pointer -----------------------
check(!creator.includes('addEventListener("pointerdown"'),
  "the creator is bound to pointerdown again — Enter and Space on a focused control will do nothing");
check(creator.includes('setAttribute("aria-label"'),
  "the creator's controls have lost their names");

// --- 14) There is one portrait, and it does not run behind a hidden tab ------
// The creator's preview and the HUD's paper-doll are the same component. If a
// second copy of the stage appears, the two drift within a month — which is the
// whole reason drawAvatar is shared in the first place.

const portrait = read("src/client/portrait.ts");
const CLIENT = "src/client";
const drawsAvatar = readdirSync(CLIENT)
  .filter((f) => f.endsWith(".ts"))
  .filter((f) => /\bdrawAvatar\(/.test(read(`${CLIENT}/${f}`)));
// avatar.ts declares it; portrait.ts is the shared stage; the duel screen and
// the world renderer draw figures of their own, at their own scale.
const MAY_DRAW = new Set(["avatar.ts", "portrait.ts", "duelUI.ts", "render.ts"]);
for (const f of drawsAvatar) {
  check(MAY_DRAW.has(f), `${f} calls drawAvatar directly — put it through Portrait instead`);
}
check(drawsAvatar.includes("portrait.ts"), "portrait.ts does not draw the figure");
check(!creator.includes("drawAvatar("),
  "the creator draws its own figure again rather than using the shared Portrait");

for (const m of ["start(", "stop(", "destroy(", "setLook(", "setGear(", "setFacing("]) {
  check(portrait.includes(m), `Portrait has lost ${m})`);
}
check(/cancelAnimationFrame/.test(portrait), "Portrait never cancels its loop — a hidden canvas would repaint forever");

const hud = read("src/client/hud.ts");
check(hud.includes("new Portrait("), "the Character tab has no figure on it");
check(/activeTab === "character"[\s\S]{0,200}portrait\.start\(\)/.test(hud),
  "the HUD portrait is not gated on its tab being on screen");
check(hud.includes("this.portrait.stop()"), "the HUD portrait is never stopped");
// resolveGear walks every worn slot and is not memoised, and hud.update runs
// every frame — so it must be reached only through the changed-slot guard.
check((hud.match(/resolveGear\(/g) ?? []).length === 1,
  "hud.ts calls resolveGear from more than one place — one of them will be per-frame");

console.log(
  `barber ${BARBER_FEE}g at ${chair ? `${chair.x},${chair.y}` : "nowhere"}` +
  ` · appearance fields ${Object.keys(DEFAULT_APPEARANCE).length}` +
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
