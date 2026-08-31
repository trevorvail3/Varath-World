/**
 * src/client/avatar.ts
 * --------------------
 * One place that knows how to draw a character — body, arms, top, legs, shoes,
 * hair and facial hair — from an Appearance. The in-world player (render.ts) and
 * the character creator both call drawAvatar, so styles live here once.
 *
 * Geometry is in "base units" (1 = one screen pixel at scale 1, which is how the
 * in-world figure is drawn); pass a larger `s` for the creator's big preview.
 * (cx, cy) is the figure's centre — the same reference the tile renderer uses.
 *
 * Animation is driven by the `anim` argument: a monotonic clock (`now`) and
 * whether the figure is `moving`. Standing gives a gentle idle bob; moving runs
 * a walk cycle — body bounce, swinging arms and alternating feet. The part
 * helpers are written so a future "action" pose (e.g. a pickaxe swing) can drive
 * the arms from the same place.
 */

import type { Appearance } from "../core/types.ts";
import type { GearLook, Metal } from "./gearLook.ts";

// --- Shared colour palettes (the only colours the creator offers) ---
export const SKINS = ["#f0d2a8", "#e3bd92", "#caa176", "#a9794f", "#855b38", "#5f3f26"];
export const HAIRS = ["#2a2320", "#4a3320", "#7a5226", "#b8893c", "#caa24a", "#9a3320", "#3a5a7a", "#d8d8d8"];
/** The cloth palette — shared by tops, legs and shoes ("same colour options").
 *  `#3a2c20` is the dark leather the default boots are cut from; it was the
 *  starting shoe colour but was not a member of this list, so the creator opened
 *  with no shoe swatch selected and no way to get back to the default. */
export const CLOTH = [
  "#6b6157", "#3a5a7a", "#4f7a3a", "#7a3a3a",
  "#6a4a7a", "#caa05a", "#2f6b66", "#9a5a2a", "#3a2c20",
];

// --- Selectable styles (id + label). The renderer defaults unknown ids. ---
export const HAIR_STYLES = [
  { id: "short", label: "Short" },
  { id: "fringe", label: "Fringe" },
  { id: "sidepart", label: "Side part" },
  { id: "bob", label: "Bob" },
  { id: "long", label: "Long" },
  { id: "ponytail", label: "Ponytail" },
  { id: "braid", label: "Braid" },
  { id: "topknot", label: "Top-knot" },
  { id: "curly", label: "Curly" },
  { id: "wild", label: "Wild" },
  { id: "spiky", label: "Spiky" },
  { id: "mohawk", label: "Mohawk" },
  { id: "undercut", label: "Undercut" },
  { id: "shaved", label: "Shaved" },
  { id: "bald", label: "Bald" },
];
/** Eye colours — a short, believable range rather than a rainbow. */
export const EYES = ["#4a3626", "#6b4a2c", "#3f5a46", "#4a6d84", "#5c6470", "#7a5a86"];

export const EYE_STYLES = [
  { id: "open", label: "Open" },
  { id: "narrow", label: "Narrow" },
  { id: "wide", label: "Wide" },
  { id: "tired", label: "Hooded" },
  { id: "sharp", label: "Sharp" },
];
export const BROW_STYLES = [
  { id: "even", label: "Even" },
  { id: "heavy", label: "Heavy" },
  { id: "arched", label: "Arched" },
  { id: "angled", label: "Angled" },
  { id: "thin", label: "Thin" },
];
export const JAW_STYLES = [
  { id: "oval", label: "Oval" },
  { id: "square", label: "Square" },
  { id: "narrow", label: "Narrow" },
  { id: "round", label: "Round" },
];

export const FACIAL_STYLES = [
  { id: "none", label: "Clean-shaven" },
  { id: "stubble", label: "Stubble" },
  { id: "moustache", label: "Moustache" },
  { id: "goatee", label: "Goatee" },
  { id: "chops", label: "Side-whiskers" },
  { id: "beard", label: "Full beard" },
  { id: "long", label: "Long beard" },
];

/**
 * Scars, war paint and ink — each one belonging somewhere in the world rather
 * than being decoration for its own sake.
 */
export const MARKING_STYLES = [
  { id: "none", label: "None" },
  { id: "scar_eye", label: "Old cut" },
  { id: "scar_cheek", label: "Claw scars" },
  { id: "warpaint_bar", label: "Ashfen band" },
  { id: "warpaint_hand", label: "Cult daub" },
  { id: "tattoo_chin", label: "Northern marks" },
  { id: "tattoo_brow", label: "Lodge marks" },
  { id: "ash", label: "Forge soot" },
];

/** What a marking is made of: old scar tissue, ochre, woad, chalk, soot, blood. */
export const MARKING_COLORS = [
  "#8a5a4e", "#c4542e", "#2f4a72", "#d8cfbc", "#20201f", "#7a1f22",
];
export const TOP_STYLES = [
  { id: "plain", label: "Plain" },
  { id: "vneck", label: "V-neck" },
  { id: "sash", label: "Sash" },
];
export const LEG_STYLES = [
  { id: "trousers", label: "Trousers" },
  { id: "kilt", label: "Kilt" },
  { id: "shorts", label: "Shorts" },
];
export const SHOE_STYLES = [
  { id: "boots", label: "Boots" },
  { id: "sandals", label: "Sandals" },
  { id: "clogs", label: "Clogs" },
];

/** The look every fresh character starts from. */
export const DEFAULT_APPEARANCE: Appearance = {
  name: "Wanderer",
  skin: SKINS[1]!,
  hair: HAIRS[1]!,
  tunic: CLOTH[0]!,
  legColor: CLOTH[7]!,
  shoeColor: "#3a2c20",
  hairStyle: "short",
  facial: "none",
  top: "plain",
  legs: "trousers",
  shoes: "boots",
  eyes: "open",
  eyeColor: EYES[0]!,
  brows: "even",
  jaw: "oval",
};

/** Fill the missing fields of a partial look with the defaults (old saves). */
export function withDefaults(a?: Partial<Appearance>): Appearance {
  return { ...DEFAULT_APPEARANCE, ...(a ?? {}) };
}

/** How the figure is animated: a clock, whether it's walking, and any action. */
export interface AvatarAnim {
  now?: number;
  moving?: boolean;
  /**
   * An in-progress tool/combat action that swings the near arm and puts a tool
   * in the hand. `kind` selects the motion (gather chop vs. fishing cast vs.
   * combat), `tool` the shape to draw, and `frac` is how much of the current
   * swing remains (1 just after a strike → 0 at the next strike).
   */
  action?: { kind: string; tool: string; frac: number };
  /** Mirror the figure horizontally — used to face the way it's walking.
   *  Superseded by `facing`; kept for callers that only track left/right. */
  flip?: boolean;
  /**
   * Which way the figure faces (4-way). "left"/"right" mirror the 3/4 view as
   * before; "up" shows the back of the head (walking away from the camera);
   * "down" is the plain front view. When omitted we fall back to `flip`.
   */
  facing?: "up" | "down" | "left" | "right";
  /** Mounted: legs tuck out of sight into the saddle; no walk-cycle lift. */
  riding?: boolean;
}

type Ctx = CanvasRenderingContext2D;

/** Darken a hex colour by `amt` (0..1) for shading. */
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return `rgb(${r},${g},${b})`;
}

/**
 * Draw a full character at (cx, cy) — the figure's centre — scaled by `s`.
 * `anim` gives the idle bob or walk cycle.
 */
export function drawAvatar(
  g: Ctx,
  cx: number,
  cy: number,
  s: number,
  look: Appearance,
  anim: AvatarAnim = {},
  gear: GearLook = {},
): void {
  // A soft dark contour around every stroke of the figure — the cheap trick
  // that pops the avatar off any terrain (only the player + ghosts draw with
  // this function, so the shadow cost is negligible).
  g.save();
  g.shadowColor = "rgba(8,8,12,0.55)";
  g.shadowBlur = Math.max(1.5, s * 0.9);
  // How tall this character stands. A uniform scale about the ground line, so
  // the feet stay planted on the tile and nothing is distorted — unlike the
  // build, which used to be a horizontal-only stretch of the entire figure and
  // squashed the head, the helmet and the weapon along with the shoulders.
  const hs = HEIGHTS[look.height ?? "average"] ?? 1;
  if (hs !== 1) {
    const ground = cy + 14 * s;
    g.translate(cx, ground); g.scale(hs, hs); g.translate(-cx, -ground);
  }
  try {
    drawAvatarInner(g, cx, cy, s, look, anim, gear);
  } finally {
    g.restore();
  }
}

/** Body-silhouette options for the character creator (id maps to Appearance.build;
 *  "average" is the default undefined). */
export const BUILD_STYLES: { id: string; label: string }[] = [
  { id: "lean", label: "Lean" },
  { id: "average", label: "Average" },
  { id: "broad", label: "Broad" },
  { id: "heavy", label: "Heavy" },
];

/** Height options (id maps to Appearance.height; "average" is undefined). */
export const HEIGHT_STYLES: { id: string; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "average", label: "Average" },
  { id: "tall", label: "Tall" },
];

/** A uniform scale about the feet. Kept modest: a character three pixels taller
 *  than another is a noticeable difference on a 31-pixel figure. */
const HEIGHTS: Record<string, number> = { short: 0.93, average: 1, tall: 1.07 };

/**
 * What a build actually changes.
 *
 * `build` used to be a horizontal scale of the whole figure — 0.9 for lean, 1.13
 * for broad — which widened the head, the helmet and the sword along with the
 * shoulders. Lean and Broad were the same person at two aspect ratios. These are
 * the proportions that actually differ between frames: how wide the shoulders
 * are, how much the torso tapers to the waist, how thick the limbs are, and how
 * far apart the feet plant. The head, and everything worn on it, stays true.
 */
interface BuildGeom {
  /** Shoulder half-width, as a multiple of the view's own torso half-width. */
  shoulder: number;
  /** A small nudge to the head. The head is deliberately NOT scaled with the
   *  build — that was the old bug, and it dragged the helmet and the weapon
   *  with it — but a narrow frame under an unchanged head reads as a
   *  bobblehead, so it moves by a few percent rather than not at all. */
  head: number;
  /** Waist half-width, as a fraction of the shoulder. Under 1 is a taper. */
  waist: number;
  /** Limb thickness. */
  limb: number;
  /** How far apart the feet plant. */
  stance: number;
}

const BUILDS: Record<string, BuildGeom> = {
  lean: { shoulder: 0.90, waist: 0.82, limb: 0.85, stance: 0.90, head: 0.95 },
  average: { shoulder: 1, waist: 0.90, limb: 1, stance: 1, head: 1 },
  broad: { shoulder: 1.14, waist: 0.88, limb: 1.14, stance: 1.10, head: 1.03 },
  // Heavy is not "broad, more so": the shoulders are ordinary and the waist is
  // wider than them, which is a different silhouette rather than a bigger one.
  heavy: { shoulder: 1.04, waist: 1.10, limb: 1.16, stance: 1.12, head: 1.04 },
};

/**
 * The three views of the figure, in the numbers that differ between them.
 *
 * Everything else — the walk cycle, the clothing styles, every layer of worn
 * gear — is shared, so a change to the torso or to a piece of armour lands on
 * all three rather than needing to be made three times. A front and a back view
 * share a silhouette and differ in what faces the camera; a profile is a
 * genuinely narrower body with its legs and arms stacked in depth.
 */
type View = "front" | "back" | "side";

interface ViewGeom {
  /** Half the shoulder width. A torso seen edge-on is about two-thirds as wide. */
  torsoHalf: number;
  /** Left edge of each leg. In profile they overlap, one behind the other. */
  legX: readonly [number, number];
  /** Shoulder x for the near arm and the far arm. */
  armX: readonly [number, number];
  /** Where the off-hand shield sits. Negative puts it behind the body. */
  shieldX: number;
  /** How much the far side of the figure is darkened, for depth. */
  farShade: number;
  /** Whether a face is drawn at all. */
  face: boolean;
}

const VIEWS: Record<View, ViewGeom> = {
  front: { torsoHalf: 7, legX: [-6, 1], armX: [-6.4, 6.4], shieldX: 7.2, farShade: 0.12, face: true },
  // The back is the same build seen from behind: the off hand — and so the
  // shield — is now on the other side of the screen, and there is no face.
  back: { torsoHalf: 7, legX: [-6, 1], armX: [6.4, -6.4], shieldX: -7.2, farShade: 0.12, face: false },
  // A profile: a narrower body, both legs on nearly the same line (the walk
  // cycle separates them), both arms close to the centre with the far one
  // behind, and the shield carried on the hidden side.
  side: { torsoHalf: 5.0, legX: [-3.4, -1.4], armX: [1.0, -2.2], shieldX: -3.8, farShade: 0.3, face: true },
};

function drawAvatarInner(
  g: Ctx,
  cx: number,
  cy: number,
  s: number,
  look: Appearance,
  anim: AvatarAnim = {},
  gear: GearLook = {},
): void {
  const t = anim.now ?? 0;
  const action = anim.action;
  const acting = !!action;
  // While acting the figure is planted; otherwise it walks or idles.
  const moving = (anim.moving ?? false) && !acting;
  const step = t / 110;
  const riding = anim.riding ?? false;
  // In the saddle the rider doesn't walk: no walk-bounce (the mount's gallop
  // carries them) and no arm swing — hands stay on the reins.
  // The rider's bob mirrors the mount rig's gallop bob — which draws at 1.7x
  // scale, so the rider matches the SCALED amplitude or they bounce apart.
  const bob = riding ? -(moving ? Math.abs(Math.sin(t / 130)) * 2.7 : Math.sin(t / 460) * 1.0)
    : acting ? Math.sin(t / 280) * 0.5
    : moving ? -Math.abs(Math.sin(step)) * 1.4 : Math.sin(t / 200) * 0.9;
  const swing = moving && !riding ? Math.sin(step) * 0.5 : (!acting ? Math.sin(t / 340) * 0.05 : 0);
  const liftL = moving && !riding ? Math.max(0, Math.sin(step)) * 1.8 : 0;
  const liftR = moving && !riding ? Math.max(0, -Math.sin(step)) * 1.8 : 0;
  // The near arm swings the action, or holds the equipped weapon while idle.
  const heldWeapon = !acting && gear.weapon ? gear.weapon.type : "";
  const nearAngle = acting ? actionArmAngle(action!.frac, action!.kind) : -0.12 + swing;
  const farAngle = acting ? 0.22 : 0.12 - swing;
  const nearTool = acting ? action!.tool : heldWeapon;
  // Tint the blade by the weapon's material — for the combat swing and the idle
  // hold alike; gathering swings (pickaxe/axe/rod) keep their plain tool look.
  const nearMetal: Metal | undefined =
    acting ? (action!.kind === "combat" ? gear.weapon : undefined) : gear.weapon;

  const R = (dx: number, dy: number, w: number, h: number) =>
    g.fillRect(cx + dx * s, cy + dy * s, w * s, h * s);
  const Rb = (dx: number, dy: number, w: number, h: number) =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  const arc = (dx: number, dy: number, r: number, a0: number, a1: number, b = false) => {
    g.beginPath();
    g.arc(cx + dx * s, cy + dy * s + bob, r * s, a0, a1, b);
  };

  // Which way the figure is facing, and what that means for its geometry.
  // There used to be one body here: `down` and `right` drew the same pixels,
  // `left` was that image mirrored, and `up` was the same body with the back of
  // the head swapped in — so walking north, south and east all looked the same.
  // The three views below differ in the numbers that actually change when a
  // person turns: how wide the shoulders read, where the legs sit, whether both
  // arms are visible, and which side the shield and the weapon are on.
  const facing = anim.facing ?? (anim.flip === true ? "left" : "right");
  const flip = facing === "left";
  const view: View = facing === "up" ? "back" : (facing === "left" || facing === "right") ? "side" : "front";
  const back = view === "back";
  const side = view === "side";
  const V = VIEWS[view];
  const B = BUILDS[look.build ?? "average"] ?? BUILDS["average"]!;
  /** Shoulder and waist half-widths for this build in this view. */
  const SH = V.torsoHalf * B.shoulder;
  const WA = SH * B.waist;
  if (flip) { g.save(); g.translate(2 * cx, 0); g.scale(-1, 1); }
  // Light comes from the same side of the SCREEN whichever way the figure
  // faces. The mirror above flips geometry and shading alike, so every shading
  // offset is multiplied by this to put it back where the sun is.
  const lx = flip ? -1 : 1;

  // --- Shadow (planted) --- (a rider casts no shadow of their own; the mount's
  // ground shadow already anchors the pair — a second ellipse mid-horse reads
  // as someone standing behind the animal.)
  if (!riding) {
    g.fillStyle = "rgba(0,0,0,0.32)";
    g.beginPath();
    g.ellipse(cx, cy + 12.5 * s, 10 * s, 3.6 * s, 0, 0, Math.PI * 2);
    g.fill();
  }

  // --- Cape ---
  // From behind, a cloak is the thing you see: it hangs over the whole back
  // rather than peeking out at the ankles, so it is drawn after the body. From
  // the front and in profile it stays behind the figure, as before.
  const drawCape = (): void => {
    if (!gear.cape) return;
    const sway = (moving ? Math.sin(step) * 0.8 : Math.sin(t / 300) * 0.4) * s;
    const w = side ? 2.6 : 5;      // edge-on a cloak is a trailing sheet
    const hemOut = side ? 1.6 : 2;
    const drift = side ? -2.4 * s : 0; // and it streams out behind the walker
    g.fillStyle = side ? shade(gear.cape.color, 0.16) : gear.cape.color;
    g.beginPath();
    g.moveTo(cx - w * s + drift, cy - 6 * s + bob);
    g.lineTo(cx + w * s + drift, cy - 6 * s + bob);
    g.lineTo(cx + (w + hemOut) * s + sway + drift, cy + 11 * s);
    g.lineTo(cx - (w + hemOut) * s + sway + drift, cy + 11 * s);
    g.closePath();
    g.fill();
    g.fillStyle = shade(gear.cape.color, 0.28);
    g.fillRect(cx - 0.8 * s + sway * 0.5, cy - 6 * s + bob, 1.6 * s, 17 * s); // centre fold
  };
  if (!back) drawCape();

  // --- Kilt is a single panel drawn before the (lifting) feet ---
  if (look.legs === "kilt") {
    g.fillStyle = look.legColor;
    g.beginPath();
    g.moveTo(cx - 6 * s, cy + 5 * s);
    g.lineTo(cx + 6 * s, cy + 5 * s);
    g.lineTo(cx + 7 * s, cy + 10.5 * s);
    g.lineTo(cx - 7 * s, cy + 10.5 * s);
    g.closePath();
    g.fill();
    g.fillStyle = shade(look.legColor, 0.25);
    R(-0.6, 5, 1.2, 5.5); // centre pleat
  }

  // --- Each leg + its shoe, lifting with the walk cycle ---
  // `far` darkens the whole leg so that in profile, where the two overlap, the
  // trailing one reads as being on the other side of the body.
  const foot = (bx: number, lift: number, far = false): void => {
    const y = -lift;
    const D = (hex: string): string => (far ? shade(hex, V.farShade) : hex);
    // Legs are as thick as the rest of the frame. They used to be a fixed 5
    // units wide whatever the build, so a lean character had a slim torso and
    // slim arms on a pair of average legs.
    const L = (w: number): number => w * B.limb;
    if (look.legs === "shorts") {
      g.fillStyle = D(look.legColor); R(bx, 5 + y, L(5), 3);
      g.fillStyle = D(look.skin); R(bx + 0.5, 8 + y, L(4), 2.5); // bare shin
    } else if (look.legs !== "kilt") {
      g.fillStyle = D(look.legColor); R(bx, 5 + y, L(5), 6); // trousers
    }
    // Worn leg armour: a metal greave (plate), slim chaps (leather) — or nothing
    // here for robes, whose skirt is a single panel drawn after both feet.
    if (gear.legs && gear.legs.style !== "robe") {
      if (gear.legs.style === "leather") {
        g.fillStyle = D(gear.legs.base); R(bx + 0.2, 5 + y, L(4.6), 5);       // slim leather chap
        g.fillStyle = shade(gear.legs.base, 0.3); R(bx + 0.2, 7.6 + y, L(4.6), 0.5); // lace seam
      } else {
        g.fillStyle = D(gear.legs.base); R(bx - 0.2, 5 + y, L(5.4), 5.2);
        g.fillStyle = D(gear.legs.edge); R(bx - 0.2, 5 + y, 1, 5.2);       // edge highlight
      }
    }
    if (gear.boots) {
      // Plated sabaton replaces the cloth shoe.
      g.fillStyle = D(gear.boots.base); R(bx - 0.4, 9.8 + y, L(5.8), 3);
      g.fillStyle = D(gear.boots.edge); R(bx - 0.4, 9.8 + y, L(5.8), 0.8);
      g.fillStyle = shade(gear.boots.base, 0.35); R(bx - 0.4, 12.2 + y, L(5.8), 0.6); // sole
      return;
    }
    g.fillStyle = D(look.shoeColor);
    if (look.shoes === "sandals") {
      R(bx, 11.4 + y, L(5), 1.1);
      g.fillStyle = shade(look.shoeColor, 0.3); R(bx + L(1.6), 10.4 + y, 0.8, 1.1); // strap
    } else if (look.shoes === "clogs") {
      R(bx - 0.5, 10.4 + y, L(5.8), 2.2);
      g.fillStyle = shade(look.shoeColor, 0.28); R(bx + L(4.5), 10.4 + y, 0.8, 2.2); // toe
    } else {
      R(bx - 0.2, 10 + y, L(5.4), 2.6); // boot
      g.fillStyle = shade(look.shoeColor, 0.3); R(bx - 0.2, 12 + y, L(5.4), 0.6); // sole
    }
  };
  // In the saddle the legs tuck against the horse's flanks — just a short
  // trouser cuff and boot-top peeking below the torso, no walking feet.
  if (riding) {
    const cuff = (bx: number): void => {
      if (look.legs !== "kilt") { g.fillStyle = look.legColor; R(bx, 5, 5, 3); }
      g.fillStyle = gear.boots ? gear.boots.base : look.shoeColor;
      R(bx + 0.2, 7.6, 4.6, 2.2);
    };
    cuff(-6);
    cuff(1);
  } else {
    // The far leg first so the near one overlaps it — which is what makes a
    // profile read as a body with depth rather than two legs side by side.
    foot(V.legX[1] * B.stance, liftR, side);
    foot(V.legX[0] * B.stance, liftL);
  }

  // --- Robe skirt: a single flaring panel over both legs (magic leg gear) ---
  if (gear.legs && gear.legs.style === "robe") {
    g.fillStyle = gear.legs.base;
    g.beginPath();
    g.moveTo(cx - 5.5 * s, cy + 3.5 * s);
    g.lineTo(cx + 5.5 * s, cy + 3.5 * s);
    g.lineTo(cx + 7 * s, cy + 12 * s);
    g.lineTo(cx - 7 * s, cy + 12 * s);
    g.closePath();
    g.fill();
    g.fillStyle = shade(gear.legs.base, 0.26);
    g.fillRect(cx - 0.6 * s, cy + 3.5 * s, 1.2 * s, 8.5 * s); // centre fold
    g.fillStyle = gear.legs.edge;
    g.fillRect(cx - 7 * s, cy + 11.3 * s, 14 * s, 0.8 * s);   // hem trim
  }

  // --- The far arm (drawn before the torso so it reads as "behind") ---
  // In profile it is darkened and set back, so the two arms read as one in
  // front of the body and one behind it rather than as a pair side by side.
  drawArm(g, cx, cy, s, bob, look, V.armX[1] * B.shoulder, farAngle, "", undefined, side ? V.farShade : 0, B.limb);

  // --- A neck, which the figure has never had. Drawn before the torso so the
  //     collar covers its base — it is what stops the head reading as a ball
  //     balanced on a box.
  g.fillStyle = shade(look.skin, 0.22);
  Rb(side ? -1.8 : -2.2, -9.5, side ? 3.4 : 4.4, 4);

  // --- Torso / top (bobs) ---
  // A body, not a box: the torso runs from the shoulders to a narrower (or, for
  // a heavy frame, a wider) waist. It was one flat rectangle of a fixed width,
  // which is why every build read as the same person.
  const torsoPath = (top: number, bot: number, inset: number): void => {
    const a = (SH - inset) * s, b2 = (WA - inset) * s;
    g.beginPath();
    g.moveTo(cx - a, cy + top * s + bob);
    g.lineTo(cx + a, cy + top * s + bob);
    g.lineTo(cx + b2, cy + bot * s + bob);
    g.lineTo(cx - b2, cy + bot * s + bob);
    g.closePath();
  };
  g.fillStyle = look.tunic;
  torsoPath(-7, 5, 0); g.fill();
  g.fillStyle = "rgba(0,0,0,0.16)";
  Rb(-WA, 3, WA * 2, 2); // belt line, at the waist
  g.fillStyle = shade(look.tunic, 0.18);
  Rb((WA - 3.4) * lx, -7, 1.2, 10); // side shade for form, on the shaded side
  if (side) {
    // A body seen edge-on has a chest and a back, not a flat front: a lit strip
    // down the leading edge and a deeper shadow down the trailing one.
    g.fillStyle = shade(look.tunic, 0.3);
    Rb(-SH * lx, -7, 1.1, 12);
    g.fillStyle = "rgba(255,240,210,0.10)";
    Rb((SH - 1.1) * lx, -7, 1.1, 12);
  }
  if (back) {
    // From behind, a top has a seam and a yoke, not a neckline.
    g.fillStyle = shade(look.tunic, 0.24);
    Rb(-SH, -7, SH * 2, 1.6);
  } else if (look.top === "vneck") {
    g.fillStyle = look.skin;
    g.beginPath();
    g.moveTo(cx - 3 * s, cy - 7 * s + bob);
    g.lineTo(cx + 3 * s, cy - 7 * s + bob);
    g.lineTo(cx, cy - 2.5 * s + bob);
    g.closePath();
    g.fill();
  } else if (!back && look.top === "sash") {
    g.strokeStyle = shade(look.tunic, 0.4);
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.moveTo(cx - 7 * s, cy - 6 * s + bob);
    g.lineTo(cx + 7 * s, cy + 2 * s + bob);
    g.stroke();
  } else if (!back) {
    g.fillStyle = "rgba(0,0,0,0.16)";
    Rb(-0.6, -7, 1.2, 10); // plain front seam
  }

  // --- Worn body armour, over the top: plate / leather jerkin / robe ---
  if (gear.body && gear.body.style === "robe") {
    // A flowing robe draping from the shoulders out past the hips.
    g.fillStyle = gear.body.base;
    g.beginPath();
    g.moveTo(cx - (SH - 0.5) * s, cy - 7 * s + bob);
    g.lineTo(cx + (SH - 0.5) * s, cy - 7 * s + bob);
    g.lineTo(cx + 7.6 * s, cy + 6 * s + bob);
    g.lineTo(cx - 7.6 * s, cy + 6 * s + bob);
    g.closePath();
    g.fill();
    g.fillStyle = gear.body.edge;
    Rb(-0.6, -7, 1.2, 13);                 // centre trim, collar to hem — a robe has one front and back
    g.fillStyle = shade(gear.body.base, 0.22);
    Rb(3.8 * lx, -7, 1.1, 12.5);           // a side fold, on the shaded side
    if (!back) { g.fillStyle = look.skin; arc(0, -6.8, 1.9, 0, Math.PI, false); g.fill(); } // V collar
  } else if (gear.body && gear.body.style === "leather") {
    // A fitted leather jerkin — lighter than plate, laced up the front.
    g.fillStyle = gear.body.base;
    torsoPath(-6.4, 3.4, 1); g.fill();
    g.fillStyle = gear.body.edge;
    Rb(-(SH - 1), -6.4, (SH - 1) * 2, 1);   // shoulder seam highlight
    if (!back) { g.fillStyle = look.skin; arc(0, -6.4, 1.8, 0, Math.PI, false); g.fill(); } // open V-neck
    g.strokeStyle = shade(gear.body.base, 0.42);
    g.lineWidth = 0.5 * s;
    for (const ly of [-3, -1, 1] as const) { // cross-lacing down the centre
      g.beginPath();
      g.moveTo(cx - 1.1 * s, cy + ly * s + bob); g.lineTo(cx + 1.1 * s, cy + (ly + 1.4) * s + bob);
      g.moveTo(cx + 1.1 * s, cy + ly * s + bob); g.lineTo(cx - 1.1 * s, cy + (ly + 1.4) * s + bob);
      g.stroke();
    }
  } else if (gear.body) {
    // Heavy plate chestplate (melee).
    g.fillStyle = gear.body.base;
    torsoPath(-6.6, 3.6, 0.4); g.fill();
    g.fillStyle = gear.body.edge;
    Rb(-(SH - 0.4), -6.6, (SH - 0.4) * 2, 1.2);  // top rim highlight
    Rb(-(SH - 0.4) * lx, -6.6, 1.2, 9.4);        // lit edge, screen-left
    g.fillStyle = shade(gear.body.base, 0.3);
    if (!back) Rb(-0.7, -6.6, 1.4, 9.4);         // central ridge (front only)
    if (!back) { g.fillStyle = look.skin; arc(0, -6.6, 2.2, 0, Math.PI, false); g.fill(); } // neckline
  }

  // --- The near arm (in front of the torso), holding the weapon/tool ---
  drawArm(g, cx, cy, s, bob, look, V.armX[0] * B.shoulder, nearAngle, nearTool, nearMetal, 0, B.limb);

  // --- Pauldrons over both shoulders (plate only — leather/robes have none) ---
  if (gear.body && gear.body.style === "plate") {
    for (const sx of (side ? [-1.2, 1.2] : [-(SH - 0.4), SH - 0.4])) {
      g.fillStyle = gear.body.base;
      g.beginPath();
      g.ellipse(cx + sx * s, cy - 5 * s + bob, 2.6 * s, 2 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = gear.body.edge;
      g.beginPath();
      g.ellipse(cx + sx * s, cy - 5.6 * s + bob, 2.6 * s, 1 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Seen from behind, the cloak covers everything the body was wearing.
  if (back) drawCape();

  // --- Shield in the off hand (drawn to the far side) ---
  if (gear.shield) {
    const hx = cx + V.shieldX * s, hy = cy + 1 * s + bob;
    g.fillStyle = gear.shield.base;
    g.beginPath();
    g.moveTo(hx, hy - 4 * s);
    g.lineTo(hx + 3 * s, hy - 2.5 * s);
    g.lineTo(hx + 3 * s, hy + 2 * s);
    g.lineTo(hx, hy + 4.5 * s);
    g.lineTo(hx - 3 * s, hy + 2 * s);
    g.lineTo(hx - 3 * s, hy - 2.5 * s);
    g.closePath();
    g.fill();
    g.fillStyle = gear.shield.edge;
    g.fillRect(hx - 0.6 * s, hy - 4 * s, 1.2 * s, 8.5 * s); // boss ridge
  }

  // --- Head (bobs) ---
  // The jaw shapes the head itself, not just the marks on it: a square jaw is
  // genuinely broader through the cheeks and a narrow one tapers. The head was
  // one fixed disc for every character in the game. Hair is fitted to the same
  // numbers, so it sits ON this head rather than near it.
  const headW = (look.jaw === "square" ? 6.4 : look.jaw === "narrow" ? 5.3 : 6) * B.head;
  const headH = (look.jaw === "round" ? 6.1 : look.jaw === "narrow" ? 6.2 : 6) * B.head;
  g.fillStyle = look.skin;
  if (side) {
    // Seen edge-on, a head is not a disc: it has a brow, a nose and a chin on
    // the leading edge and a rounder skull behind. This is the single silhouette
    // that tells a walking figure's direction at a glance.
    // Skull and face in ONE path. Every fill in this figure is drawn with a
    // global shadow rim (see drawAvatar), which is what pops it off the terrain
    // — but it also outlines any shape drawn over another, so a face laid on top
    // of a skull came out with a seam ruled down it. One path, one contour.
    g.beginPath();
    g.arc(cx - 1.1 * s, cy - 12 * s + bob, 5.2 * B.head * s, 0, Math.PI * 2);
    // The leading edge: a brow, a small nose and a jaw. Deliberately shallow —
    // a bigger nose becomes a beak at 31 pixels.
    g.moveTo(cx - 1.0 * s, cy - 16.8 * s + bob);
    g.quadraticCurveTo(cx + 3.6 * s, cy - 16.4 * s + bob, cx + 3.9 * s, cy - 13.0 * s + bob);
    g.lineTo(cx + 5.4 * s, cy - 11.0 * s + bob);   // the nose
    g.lineTo(cx + 3.7 * s, cy - 10.2 * s + bob);
    g.quadraticCurveTo(cx + 4.0 * s, cy - 7.6 * s + bob, cx + 0.6 * s, cy - 7.2 * s + bob);
    g.lineTo(cx - 1.0 * s, cy - 8.4 * s + bob);
    g.closePath();
    g.fill();
  } else {
    // The jaw: how wide the face reads. An ellipse rather than a circle, so a
    // square jaw is genuinely broader through the cheeks and a narrow one
    // tapers — the head was one fixed disc for every character.
    g.beginPath();
    g.ellipse(cx, cy - 12 * s + bob, headW * s, headH * s, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = look.skin;

  if (back) {
    // Facing away: the back of the head. Hair (or a bare nape) fills the crown
    // over where the face would be — no eyes, no beard — so the walk reads as
    // heading north, not toward the camera.
    drawHairBack(g, cx, cy, s, bob, look, headW, headH);
  } else {
    // --- A face, then facial hair, then hair (all bob) ---
    if (V.face) drawFace(g, cx, cy, s, bob, look, side, lx);
    if (V.face) drawMarking(g, cx, cy, s, bob, look, side, lx, headW);
    drawFacial(g, cx, cy, s, bob, look, headW, headH);
    drawHair(g, cx, cy, s, bob, look, headW, headH, side, lx);
  }

  // --- Head gear (over the hair): metal helm / leather hood / wizard hat ---
  if (gear.helmet && gear.helmet.style === "robe") {
    // A wizard's hat: a wide brim under a tall, slightly leaning cone.
    g.fillStyle = gear.helmet.base;
    g.beginPath(); g.ellipse(cx, cy - 13 * s + bob, 8 * s, 2.3 * s, 0, 0, Math.PI * 2); g.fill(); // brim
    g.beginPath();                                    // cone
    g.moveTo(cx - 5 * s, cy - 13.4 * s + bob);
    g.lineTo(cx + 5 * s, cy - 13.4 * s + bob);
    g.lineTo(cx + 1.2 * s, cy - 24 * s + bob);        // tip leans forward a touch
    g.closePath(); g.fill();
    g.fillStyle = shade(gear.helmet.base, 0.3);
    Rb(-5, -14.6, 10, 1.3);                            // hat band
    g.fillStyle = gear.helmet.edge;
    g.beginPath(); g.ellipse(cx, cy - 13.4 * s + bob, 8 * s, 0.9 * s, 0, 0, Math.PI * 2); g.fill(); // brim rim
  } else if (gear.helmet && gear.helmet.style === "leather") {
    // A soft hood/cowl pulled over the crown, draping at the neck.
    g.fillStyle = gear.helmet.base;
    arc(0, -11.6, 6.8, Math.PI * 0.9, Math.PI * 2.1); // fabric dome, a hair larger than the head
    g.fill();
    g.beginPath();                                    // left neck drape
    g.moveTo(cx - 5.8 * s, cy - 11 * s + bob);
    g.lineTo(cx - 6.8 * s, cy - 5.5 * s + bob);
    g.lineTo(cx - 3.4 * s, cy - 8 * s + bob);
    g.closePath(); g.fill();
    g.beginPath();                                    // right neck drape
    g.moveTo(cx + 5.8 * s, cy - 11 * s + bob);
    g.lineTo(cx + 6.8 * s, cy - 5.5 * s + bob);
    g.lineTo(cx + 3.4 * s, cy - 8 * s + bob);
    g.closePath(); g.fill();
    g.fillStyle = shade(gear.helmet.base, 0.34);
    arc(0, -11.2, 5, Math.PI * 1.06, Math.PI * 1.94); // shadow inside the hood opening
    g.fill();
  } else if (gear.helmet) {
    // Metal helm (melee).
    g.fillStyle = gear.helmet.base;
    arc(0, -12, 6.4, Math.PI * 1.0, Math.PI * 2.0); // dome over the crown
    g.fill();
    g.fillStyle = gear.helmet.base;
    Rb(-6.4, -12.4, 12.8, 2.2);          // brow band
    g.fillStyle = gear.helmet.edge;
    Rb(-6.4, -12.4, 12.8, 0.8);          // band highlight
    g.fillStyle = shade(gear.helmet.base, 0.32);
    Rb(-0.6, -17.6, 1.2, 5.2);           // a small crest/nasal ridge
  }

  if (flip) g.restore();
}

/**
 * Draw one arm hanging from a shoulder, rotated by `angle` (radians; 0 = straight
 * down). Sleeve takes the top colour, forearm + hand the skin colour. Pulling the
 * pivot + rotation out here is what a future pickaxe-swing pose will reuse.
 */
function drawArm(
  g: Ctx, cx: number, cy: number, s: number, bob: number, look: Appearance,
  shoulderDX: number, angle: number, tool = "", metal?: Metal,
  /** Darken the whole limb — the far arm in a profile, which is on the other
   *  side of the body and should sit behind it rather than beside it. */
  depth = 0,
  /** Limb thickness, from the build. A lean frame's arms are slimmer. */
  thick = 1,
): void {
  const px = cx + shoulderDX * s;
  const py = cy - 5 * s + bob;
  const D = (hex: string): string => (depth > 0 ? shade(hex, depth) : hex);
  const T = (w: number): number => w * thick;
  g.save();
  g.translate(px, py);
  g.rotate(angle);
  if (tool) drawTool(g, s, tool, metal); // behind the hand, swings with the arm
  g.fillStyle = D(look.tunic); // sleeve (upper arm)
  g.fillRect(-T(1.3) * s, 0, T(2.6) * s, 4.2 * s);
  g.fillStyle = D(look.skin); // forearm
  g.fillRect(-T(1.1) * s, 3.8 * s, T(2.2) * s, 3.6 * s);
  g.beginPath(); // hand
  g.arc(0, 7.7 * s, T(1.6) * s, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * The near arm's angle (radians; 0 = straight down) over a swing. `frac` runs
 * 1 → 0 across the action interval; the strike lands as it nears 0. Negative
 * raises the hand up-and-forward (over the head); positive brings it down.
 */
export function actionArmAngle(frac: number, kind: string): number {
  const t = 1 - Math.max(0, Math.min(1, frac)); // 0 just after a strike → 1 at the next
  // Held, swaying motions (a cast, a stir, setting a snare) rather than a chop.
  if (kind === "fishing" || kind === "crafting" || kind === "trapping") {
    return -0.55 + Math.sin(t * Math.PI * 2) * 0.24;
  }
  // Casting: the staff is held upright-forward with a thrust pulse on the beat.
  if (kind === "cast") {
    return -0.35 - (t < 0.6 ? t / 0.6 : (1 - t) / 0.4) * 0.5;
  }
  // Ranged: bow held out front, with a quick draw-and-loose pulse on the beat.
  if (kind === "ranged") {
    return 0.95 - (t < 0.7 ? t / 0.7 : (1 - t) / 0.3) * 0.35;
  }
  // Overhead strike: wind up, slam down, brief follow-through (mining, chopping,
  // melee combat). Resets cleanly to the wind-up as the next swing begins.
  if (t < 0.5) return -0.12 - (t / 0.5) * 2.1;        // rest → overhead
  if (t < 0.8) return -2.22 + ((t - 0.5) / 0.3) * 2.9; // strike down fast
  return 0.68;                                          // follow-through
}

/** A tool/weapon in the hand, drawn in the arm's local frame (points "down").
 *  `metal` tints weapon blades/heads by material tier; gathering tools ignore it. */
export function drawTool(g: Ctx, s: number, tool: string, metal?: Metal & { tier?: number }): void {
  const handle = "#6a4a2e";
  const steel = metal?.edge ?? "#bcc2cc"; // bright face / blade
  const iron = metal?.base ?? "#8c93a0";  // darker fittings / guard
  const haft = (len: number) => { g.fillStyle = handle; g.fillRect(-0.7 * s, 5 * s, 1.4 * s, len * s); };
  switch (tool) {
    case "pickaxe":
      haft(9);
      g.strokeStyle = steel; g.lineWidth = 1.7 * s; g.lineCap = "round";
      g.beginPath(); g.moveTo(-4.5 * s, 12.5 * s); g.quadraticCurveTo(0, 10.5 * s, 4.5 * s, 12.5 * s); g.stroke();
      g.lineCap = "butt";
      break;
    case "axe":
      haft(9);
      g.fillStyle = steel; g.beginPath();
      g.moveTo(0.4 * s, 10.5 * s); g.lineTo(4.6 * s, 11.2 * s); g.lineTo(4 * s, 14.6 * s); g.lineTo(0.4 * s, 13.8 * s);
      g.closePath(); g.fill();
      break;
    case "hammer":
      haft(8);
      g.fillStyle = iron; g.fillRect(-3.2 * s, 12 * s, 6.4 * s, 3 * s);
      break;
    case "rod":
      g.strokeStyle = "#7a5a36"; g.lineWidth = 1 * s;
      g.beginPath(); g.moveTo(0, 6 * s); g.lineTo(0, 19 * s); g.stroke();
      g.strokeStyle = "rgba(220,224,235,0.55)"; g.lineWidth = 0.5 * s;
      g.beginPath(); g.moveTo(0, 19 * s); g.lineTo(2.5 * s, 23 * s); g.stroke();
      break;
    case "rod_gold":
      g.strokeStyle = "#8a6a1e"; g.lineWidth = 1.4 * s;
      g.beginPath(); g.moveTo(0, 6 * s); g.lineTo(0, 19 * s); g.stroke();
      g.strokeStyle = "#f3cf52"; g.lineWidth = 0.8 * s;
      g.beginPath(); g.moveTo(0, 6 * s); g.lineTo(0, 19 * s); g.stroke();
      g.strokeStyle = "rgba(255,241,176,0.7)"; g.lineWidth = 0.5 * s;
      g.beginPath(); g.moveTo(0, 19 * s); g.lineTo(2.5 * s, 23 * s); g.stroke();
      break;
    case "sword":
      g.fillStyle = "#3a2c1e"; g.fillRect(-0.8 * s, 5 * s, 1.6 * s, 2 * s); // grip
      g.fillStyle = iron; g.fillRect(-2.5 * s, 6.6 * s, 5 * s, 1.2 * s); // crossguard
      g.fillStyle = steel; g.fillRect(-0.9 * s, 7.6 * s, 1.8 * s, 8 * s); // blade
      break;
    case "dagger":
      g.fillStyle = iron; g.fillRect(-1.8 * s, 6.4 * s, 3.6 * s, 1 * s);
      g.fillStyle = steel; g.fillRect(-0.8 * s, 7.2 * s, 1.6 * s, 4.5 * s);
      break;
    case "saw":
      // The Bonesaw: a hide-wrapped grip and a long bone-white toothed blade.
      g.fillStyle = "#4a3527"; g.fillRect(-0.9 * s, 5 * s, 1.8 * s, 2.4 * s); // grip
      g.fillStyle = "#cfc7b2"; g.fillRect(-2.2 * s, 7 * s, 4.4 * s, 1 * s);   // bone guard
      g.fillStyle = "#e9e3d3"; g.fillRect(-1 * s, 8 * s, 2 * s, 8.5 * s);     // blade
      g.fillStyle = "#cbc3ad"; // teeth down the leading edge
      for (let i = 0; i < 6; i++) {
        const ty = (8.4 + i * 1.35) * s;
        g.beginPath(); g.moveTo(1 * s, ty); g.lineTo(2.5 * s, ty + 0.7 * s); g.lineTo(1 * s, ty + 1.35 * s); g.closePath(); g.fill();
      }
      break;
    case "spear":
      g.fillStyle = handle; g.fillRect(-0.5 * s, 5 * s, 1 * s, 12 * s);
      g.fillStyle = steel; g.beginPath();
      g.moveTo(0, 19.5 * s); g.lineTo(-1.5 * s, 16 * s); g.lineTo(1.5 * s, 16 * s); g.closePath(); g.fill();
      break;
    case "claymore":
      g.fillStyle = "#3a2c1e"; g.fillRect(-0.8 * s, 5 * s, 1.6 * s, 2.5 * s);
      g.fillStyle = iron; g.fillRect(-3 * s, 7 * s, 6 * s, 1.2 * s);
      g.fillStyle = steel; g.fillRect(-1.1 * s, 8 * s, 2.2 * s, 11 * s);
      break;
    case "bow":
      g.strokeStyle = "#7a5a36"; g.lineWidth = 1.3 * s; g.lineCap = "round";
      g.beginPath(); g.arc(0, 9 * s, 5 * s, -Math.PI * 0.55, Math.PI * 0.55); g.stroke();
      g.lineCap = "butt";
      g.strokeStyle = "rgba(230,230,236,0.6)"; g.lineWidth = 0.5 * s;
      g.beginPath(); g.moveTo(0, 4.4 * s); g.lineTo(0, 13.6 * s); g.stroke(); // string
      break;
    case "staff": {
      // A tall wooden casting staff with a glowing orb at the head.
      g.strokeStyle = "#6a5236"; g.lineWidth = 1.5 * s; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, 2 * s); g.lineTo(0, 20 * s); g.stroke();
      g.lineCap = "butt";
      g.strokeStyle = "rgba(210,190,150,0.5)"; g.lineWidth = 0.5 * s;
      g.beginPath(); g.moveTo(0, 4 * s); g.lineTo(0, 18 * s); g.stroke();
      // orb: a soft blue-white glow at the tip
      const gr = g.createRadialGradient(0, 1.5 * s, 0, 0, 1.5 * s, 3.2 * s);
      gr.addColorStop(0, "rgba(190,225,255,0.95)");
      gr.addColorStop(1, "rgba(90,150,230,0)");
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 1.5 * s, 3.2 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#cfe6ff";
      g.beginPath(); g.arc(0, 1.5 * s, 1.3 * s, 0, Math.PI * 2); g.fill();
      break;
    }
    default:
      break;
  }
  // Higher-tier melee weapons carry a glowing pommel jewel, so a top-tier blade
  // reads as ornate in the hand — not just a recoloured stock sword.
  const tier = metal?.tier ?? 0;
  const melee = tool === "sword" || tool === "dagger" || tool === "claymore" || tool === "spear" || tool === "hammer";
  if (melee && tier >= 4) {
    const gem = tier >= 10 ? "#ffd06a" : tier >= 8 ? "#b98cff" : tier >= 6 ? "#ff7a6a" : "#7fe0e0";
    const r = (tier >= 8 ? 1.3 : 1.0) * s;
    g.fillStyle = gem;
    g.beginPath(); g.arc(0, 5.6 * s, r, 0, Math.PI * 2); g.fill();
  }
}

/**
 * A face.
 *
 * The head was a bare skin disc: no eyes, no brow, no mouth, nothing. Every
 * monster in the game had eye glints and the character you look at for the
 * whole game did not.
 *
 * At this size a face is four or five marks, and it reads through contrast and
 * placement rather than detail — one pixel of the wrong value in the wrong spot
 * turns a person into a skull. So: a brow shadow that sits the eyes into the
 * skull, two irises with a dark lid over them, a hint of a nose, and a mouth
 * line. In profile only the near half of any of it is visible.
 *
 * `lx` carries the mirror's sign so the lit side of the face stays on the same
 * side of the screen when the figure turns.
 */
function drawFace(
  g: Ctx, cx: number, cy: number, s: number, bob: number,
  look: Appearance, side: boolean, lx: number,
): void {
  const P = (dx: number, dy: number, w: number, h: number): void =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  const iris = look.eyeColor ?? EYES[0]!;
  const brow = shade(look.hair, 0.15);
  const skinDark = shade(look.skin, 0.34);

  // The face is drawn without the figure's global contour: these are marks ON a
  // surface, and an outline round each of them at this scale reads as soot.
  const blur = g.shadowBlur;
  g.shadowBlur = 0;

  if (side) {
    // In profile one eye is visible, close to the leading edge, under the brow.
    const ex = 2.6 * lx, ey = -12.6;
    g.fillStyle = brow;
    P(ex - 1.5 * lx, ey - 1.5, 2.6, browThick(look));
    g.fillStyle = "#ffffff";
    P(ex - 0.9 * lx, ey, 1.8, eyeOpen(look));
    g.fillStyle = iris;
    P(ex - 0.3 * lx, ey, 1.1, eyeOpen(look));
    g.fillStyle = skinDark;
    P(ex - 0.6 * lx, -9.4, 1.9, 0.55); // mouth line, tucked under the nose
  } else {
    const open = eyeOpen(look);
    const thick = browThick(look);
    const spread = look.jaw === "narrow" ? 1.7 : look.jaw === "square" ? 2.3 : 2.0;
    for (const sgn of [-1, 1] as const) {
      const ex = sgn * spread;
      // Brow: the single most expressive mark on the face at this size.
      g.fillStyle = brow;
      const tilt = look.brows === "arched" ? -0.35 : look.brows === "angled" ? 0.35 * sgn : 0;
      P(ex - 1.3, -13.9 + tilt * sgn, 2.6, thick);
      // The eye: white, an iris, and a lid shadow above it.
      g.fillStyle = "#f4efe4";
      P(ex - 1.1, -12.7, 2.2, open);
      g.fillStyle = iris;
      P(ex - 0.5, -12.7, 1.1, open);
      g.fillStyle = "rgba(0,0,0,0.75)";
      P(ex - 0.35, -12.7 + open * 0.35, 0.7, Math.max(0.5, open * 0.5)); // pupil
      g.fillStyle = shade(look.skin, 0.22);
      P(ex - 1.1, -13.0, 2.2, 0.4); // the lid's own shadow
    }
    // A nose: two short shadows rather than a shape, which is all that fits.
    g.fillStyle = shade(look.skin, 0.18);
    P(-0.5 * lx, -12.0, 1.0, 1.6);
    g.fillStyle = skinDark;
    P(-0.6 * lx, -10.6, 1.2, 0.4);
    // A mouth.
    g.fillStyle = skinDark;
    const mw = look.jaw === "square" ? 3.2 : look.jaw === "narrow" ? 2.2 : 2.6;
    P(-mw / 2, -9.6, mw, 0.55);
  }
  g.shadowBlur = blur;
}

/** How far the eyes are open, in base units — the difference between a stare
 *  and a squint is about a pixel, and it is enough. */
function eyeOpen(look: Appearance): number {
  switch (look.eyes) {
    case "narrow": return 0.9;
    case "wide": return 2.0;
    case "tired": return 1.1;
    case "sharp": return 1.2;
    default: return 1.5;
  }
}

/** How heavy the brow reads. */
function browThick(look: Appearance): number {
  switch (look.brows) {
    case "heavy": return 1.5;
    case "thin": return 0.6;
    case "arched": return 0.9;
    case "angled": return 1.0;
    default: return 1.0;
  }
}

function drawFacial(
  g: Ctx, cx: number, cy: number, s: number, bob: number, look: Appearance,
  hw: number, hh: number,
): void {
  if (look.facial === "none") return;
  // A beard's own colour, falling back to the hair's — which is what the figure
  // did unconditionally before, so a character could never go grey at the chin.
  const hc = look.beardColor ?? look.hair;
  const R = (dx: number, dy: number, w: number, h: number): void =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  /**
   * The lower half of the face, cut to the jaw the character actually has.
   * With y pointing down, the BOTTOM of an ellipse is the sweep from 0 to PI
   * going clockwise; sweeping the other way covers the forehead instead, which
   * is a diagonal slash across the face rather than a beard.
   * `top` is where the beard's upper edge sits, as a fraction of the head's
   * half-height ABOVE its centre — so it is normally negative, because a beard
   * belongs on the jaw and anything reaching past the centre covers the eyes.
   */
  const jawFill = (top: number): void => {
    const cyH = cy - 12 * s + bob;
    g.beginPath();
    g.ellipse(cx, cyH, hw * s, hh * s, 0, 0, Math.PI, false);
    g.lineTo(cx - hw * s, cyH - hh * top * s);
    g.lineTo(cx + hw * s, cyH - hh * top * s);
    g.closePath();
    g.fill();
  };
  g.fillStyle = hc;

  switch (look.facial) {
    case "stubble":
      // Stubble used to be the full beard at 35% alpha — the same shape in a
      // paler tone, which reads as a smudge rather than as growth. It is now
      // its own shape: a shadow that follows the jawline and stops at the lip.
      g.save();
      g.globalAlpha = 0.42;
      jawFill(-0.06);
      g.globalAlpha = 0.3;
      R(-2.4, -10.9, 4.8, 1.0);
      g.restore();
      return;
    case "moustache":
      R(-2.7, -10.5, 5.4, 1.4);
      g.fillStyle = shade(hc, 0.25);
      R(-2.7, -10.5, 5.4, 0.5);
      return;
    case "goatee":
      R(-1.5, -9.4, 3.0, 2.8);          // the chin tuft
      R(-2.5, -10.5, 5.0, 1.2);          // with a moustache
      return;
    case "chops":
      // Side-whiskers down to the jaw, chin bare.
      R(-(hw - 0.2), -13.4, 1.9, 4.6);
      R(hw - 1.7, -13.4, 1.9, 4.6);
      R(-(hw - 0.2), -9.4, 3.0, 1.3);
      R(hw - 2.8, -9.4, 3.0, 1.3);
      return;
    case "long":
      // A long beard falls past the chin onto the chest.
      jawFill(-0.12);
      g.beginPath();
      g.moveTo(cx - 3.2 * s, cy - 9 * s + bob);
      g.lineTo(cx + 3.2 * s, cy - 9 * s + bob);
      g.lineTo(cx + 2.0 * s, cy - 1.5 * s + bob);
      g.lineTo(cx - 2.0 * s, cy - 1.5 * s + bob);
      g.closePath();
      g.fill();
      g.fillStyle = shade(hc, 0.22);
      R(-0.5, -9, 1.0, 7.5);             // a parting down its length
      g.fillStyle = hc;
      R(-2.5, -10.6, 5.0, 1.2);
      return;
    case "beard":
    default:
      // A full beard, cut to the jaw rather than to a circle of fixed size —
      // so a square jaw grows a square beard.
      jawFill(-0.15);
      R(-2.5, -10.7, 5.0, 1.2);          // moustache cap
      g.fillStyle = shade(hc, 0.2);
      R(-hw * 0.5, -8.2, hw, 0.9);       // a shadow under the chin
      return;
  }
}

/**
 * Markings: scars, war paint and ink.
 *
 * The world has factions and regions with their own look — the Heartmoor cult,
 * the Ashfen's fire-priests, the Lodge's hunters, the pale folk of the north —
 * and a character had no way to say they belonged to any of them. These are
 * drawn over the face after it, and only where a face is drawn.
 */
function drawMarking(
  g: Ctx, cx: number, cy: number, s: number, bob: number,
  look: Appearance, side: boolean, lx: number, hw: number,
): void {
  const id = look.marking;
  if (!id || id === "none") return;
  const col = look.markingColor ?? MARKING_COLORS[0]!;
  const R = (dx: number, dy: number, w: number, h: number): void =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  const blur = g.shadowBlur;
  g.shadowBlur = 0;
  g.fillStyle = col;
  switch (id) {
    case "scar_eye":       // a single old cut through one brow
      g.save(); g.globalAlpha = 0.75;
      R(1.6 * lx, -15.2, 0.7, 4.6);
      g.restore();
      break;
    case "scar_cheek":     // three claw lines across the cheek
      g.save(); g.globalAlpha = 0.7;
      for (let i = 0; i < 3; i++) R((1.2 + i * 1.1) * lx, -12.6 + i * 0.3, 0.55, 3.0);
      g.restore();
      break;
    case "warpaint_bar":   // one broad band across the eyes — the Ashfen's
      g.save(); g.globalAlpha = 0.62;
      R(-hw + 0.6, -13.4, (hw - 0.6) * 2, 2.2);
      g.restore();
      break;
    case "warpaint_hand":  // a print daubed over the mouth — the Heartmoor cult
      g.save(); g.globalAlpha = 0.55;
      R(-1.9, -11.4, 3.8, 3.2);
      for (let i = -1; i <= 1; i++) R(i * 1.4 - 0.3, -13.4, 0.7, 2.2);
      g.restore();
      break;
    case "tattoo_chin":    // a line of marks down the chin — the northern folk
      g.save(); g.globalAlpha = 0.7;
      for (let i = 0; i < 3; i++) R(-0.35, -9.6 + i * 1.1, 0.7, 0.7);
      g.restore();
      break;
    case "tattoo_brow":    // a band of small marks along the brow — the Lodge
      g.save(); g.globalAlpha = 0.7;
      for (let i = -2; i <= 2; i++) R(i * 1.3 - 0.3, -15.4, 0.7, 0.9);
      g.restore();
      break;
    case "ash":            // soot over the eyes, from working a forge or a pyre
      g.save(); g.globalAlpha = 0.4;
      if (!side) { R(-3.6, -13.6, 7.2, 2.6); } else { R(1.0 * lx, -13.6, 3.4, 2.6); }
      g.restore();
      break;
    default:
      break;
  }
  g.shadowBlur = blur;
}

/**
 * Hair.
 *
 * Six of the ten styles used to be a cap plus one rectangle, and the cap itself
 * was a crescent between radius 6 and radius 5.5 — half a unit of hair — so
 * "short" was indistinguishable from "bald" and "short", "side part" and
 * "fringe" read as the same thing. The crown below is a solid cap fitted to the
 * head it sits on (which now varies with the jaw and the build), and every style
 * changes the silhouette rather than adding a mark to it.
 */
function drawHair(
  g: Ctx, cx: number, cy: number, s: number, bob: number, look: Appearance,
  hw: number, hh: number, side: boolean, lx: number,
): void {
  if (look.hairStyle === "bald" || look.hairStyle === "shaved") {
    if (look.hairStyle === "shaved") {
      // A shaved head is not a bald one: the stubble of it still shows.
      g.save();
      g.globalAlpha = 0.34;
      g.fillStyle = look.hair;
      crown(g, cx, cy, s, bob, hw * 0.99, hh * 0.99, -0.15);
      g.restore();
    }
    return;
  }
  g.fillStyle = look.hair;
  const R = (dx: number, dy: number, w: number, h: number): void =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  const blob = (dx: number, dy: number, rx: number, ry: number, rot = 0): void => {
    g.beginPath();
    g.ellipse(cx + dx * s, cy + dy * s + bob, rx * s, ry * s, rot, 0, Math.PI * 2);
    g.fill();
  };

  // TOP is the crown of the head and BROW is where the face begins; every style
  // is placed against those two rather than against the figure's centre, so
  // nothing lands on the eyes when the jaw or the build changes the head's size.
  const TOP = -12 - hh;
  const BROW = -15.0;
  switch (look.hairStyle) {
    case "long":
      crown(g, cx, cy, s, bob, hw + 0.5, hh + 0.4, 0.15);
      R(-(hw + 0.4), -14.5, 1.9, 11);        // panels down both sides of the face
      R(hw - 1.5, -14.5, 1.9, 11);
      break;
    case "bob":
      crown(g, cx, cy, s, bob, hw + 0.6, hh + 0.5, 0.1);
      R(-(hw + 0.5), -15.4, 2.4, 8.4);       // a straight cut level with the jaw
      R(hw - 1.9, -15.4, 2.4, 8.4);
      break;
    case "topknot":
      crown(g, cx, cy, s, bob, hw + 0.3, hh + 0.2, -0.05);
      blob(0, TOP - 1.4, 2.5, 2.3);
      g.fillStyle = shade(look.hair, 0.25);
      R(-1.1, TOP + 0.3, 2.2, 1.5);          // the tie
      g.fillStyle = look.hair;
      break;
    case "mohawk": {
      // Shaved sides are the whole point of the silhouette, so there is no
      // crown — but a bare head under a floating stripe reads as a mistake, so
      // the shave itself shows as stubble.
      g.save(); g.globalAlpha = 0.3;
      crown(g, cx, cy, s, bob, hw + 0.2, hh + 0.15, -0.1);
      g.restore();
      g.beginPath();                       // a crest, tapered front to back
      g.moveTo(cx - 2.2 * s, cy + (TOP + 1.6) * s + bob);
      g.lineTo(cx - 1.6 * s, cy + (TOP - 5.2) * s + bob);
      g.lineTo(cx + 1.9 * s, cy + (TOP - 4.4) * s + bob);
      g.lineTo(cx + 2.4 * s, cy + (TOP + 1.6) * s + bob);
      g.closePath(); g.fill();
      g.fillStyle = shade(look.hair, 0.28);
      R(-2.2, TOP - 4.6, 1.3, 6.2);
      break;
    }
    case "undercut":
      // Full on top, shaved to the temples: a hard horizontal edge.
      crown(g, cx, cy, s, bob, hw + 0.4, hh + 0.3, -0.5);
      R(-(hw + 0.3), BROW - 1.9, hw * 2 + 0.6, 1.5);
      break;
    case "spiky":
      crown(g, cx, cy, s, bob, hw - 0.2, hh - 0.2, -0.35);
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(cx + (i * 2.2 - 1.1) * s, cy + (TOP + 1.2) * s + bob);
        g.lineTo(cx + (i * 2.2 + 0.2) * s, cy + (TOP - 3.4) * s + bob);
        g.lineTo(cx + (i * 2.2 + 1.4) * s, cy + (TOP + 1.2) * s + bob);
        g.closePath(); g.fill();
      }
      break;
    case "wild":
      crown(g, cx, cy, s, bob, hw + 0.7, hh + 0.6, 0.0);
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.06 + 0.147 * i);
        blob(Math.cos(a) * (hw + 0.4), -12 + Math.sin(a) * (hh + 0.4), 2.1, 1.8, a);
      }
      break;
    case "sidepart":
      // A real sweep across the crown, parted hard on one side.
      crown(g, cx, cy, s, bob, hw + 0.3, hh + 0.2, -0.2);
      g.beginPath();
      g.moveTo(cx - (hw + 0.3) * lx * s, cy + (BROW - 0.4) * s + bob);
      g.quadraticCurveTo(cx + 0.5 * lx * s, cy + (BROW - 3.0) * s + bob,
        cx + (hw + 0.6) * lx * s, cy + (BROW + 0.9) * s + bob);
      g.lineTo(cx + (hw + 0.6) * lx * s, cy + (BROW - 1.2) * s + bob);
      g.lineTo(cx - (hw + 0.3) * lx * s, cy + (BROW - 2.0) * s + bob);
      g.closePath(); g.fill();
      break;
    case "ponytail":
      crown(g, cx, cy, s, bob, hw + 0.3, hh + 0.2, -0.05);
      blob(-(hw + 1.4) * lx, -10.5, 1.9, 4.6, -0.3 * lx);
      break;
    case "braid":
      crown(g, cx, cy, s, bob, hw + 0.4, hh + 0.3, 0.05);
      for (let i = 0; i < 4; i++) blob(-(hw + 1.2) * lx, -13.5 + i * 2.6, 1.5 - i * 0.12, 1.5);
      break;
    case "curly":
      crown(g, cx, cy, s, bob, hw + 0.4, hh + 0.3, 0.0);
      for (let i = -2; i <= 2; i++) blob(i * 2.5, TOP + 0.4, 2.2, 2.0);
      blob(-(hw + 0.2), BROW + 0.6, 2.0, 2.0);
      blob(hw + 0.2, BROW + 0.6, 2.0, 2.0);
      break;
    case "fringe":
      crown(g, cx, cy, s, bob, hw + 0.4, hh + 0.3, -0.1);
      R(-(hw + 0.3), BROW - 1.6, hw * 2 + 0.6, 2.0);  // cut straight across the brow
      break;
    case "short":
    default:
      crown(g, cx, cy, s, bob, hw + 0.25, hh + 0.2, -0.08);
      break;
  }
  // A little light on the crown, so hair is not a flat silhouette. Skipped in
  // profile, where the lit side may be the one facing away.
  if (!side && look.hairStyle !== "mohawk") {
    g.fillStyle = "rgba(255,246,224,0.13)";
    g.beginPath();
    g.ellipse(cx - hw * 0.35 * lx * s, cy + (-12 - hh + 1.6) * s + bob, hw * 0.4 * s, 1.2 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * The cap of hair over the top of the skull — a filled dome fitted to the head,
 * not the half-unit crescent it used to be. `drop` moves the hairline: negative
 * sits it high (a short cut), positive brings it down over the ears.
 */
function crown(
  g: Ctx, cx: number, cy: number, s: number, bob: number,
  hw: number, hh: number, drop: number,
): void {
  const cyH = cy - 12 * s + bob;
  // Where the hairline sits. It has to clear the brow — which is at about 1.9
  // units above the head's centre — or the hair covers the face, which is what
  // half these styles did the first time round.
  const hairline = cyH - (3.0 - drop * 3.4) * s;
  g.beginPath();
  g.ellipse(cx, cyH, hw * s, hh * s, 0, Math.PI, Math.PI * 2);
  g.lineTo(cx + hw * s, hairline);
  g.lineTo(cx - hw * s, hairline);
  g.closePath();
  g.fill();
}

/**
 * The back of the head, for a figure walking away from the camera.
 *
 * Only five of the ten styles used to get any treatment here at all; the rest
 * fell to a plain circle, so from behind a mohawk, a side part and a crew cut
 * were the same brown disc. Every style now reads from behind too — which is
 * half of what makes the figure's four views worth having.
 */
function drawHairBack(
  g: Ctx, cx: number, cy: number, s: number, bob: number, look: Appearance,
  hw: number, hh: number,
): void {
  if (look.hairStyle === "bald") return; // bare scalp from behind = the skin head
  g.fillStyle = look.hair;
  const R = (dx: number, dy: number, w: number, h: number): void =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  const blob = (dx: number, dy: number, rx: number, ry: number, rot = 0): void => {
    g.beginPath();
    g.ellipse(cx + dx * s, cy + dy * s + bob, rx * s, ry * s, rot, 0, Math.PI * 2);
    g.fill();
  };
  if (look.hairStyle === "shaved") {
    g.save(); g.globalAlpha = 0.34;
    blob(0, -12, hw * 0.99, hh * 0.99);
    g.restore();
    return;
  }
  // A full crown of hair covering where the face would be.
  if (look.hairStyle !== "mohawk") blob(0, -11.9, hw + 0.3, hh + 0.2);

  switch (look.hairStyle) {
    case "long":
    case "wild":
      R(-(hw + 0.3), -12, hw * 2 + 0.6, 8.5); // a mane spilling down the back
      break;
    case "bob":
      R(-(hw + 0.5), -12.5, hw * 2 + 1, 5.5);
      break;
    case "curly":
      for (let i = -2; i <= 2; i++) blob(i * 2.4, -15.6, 2.1, 1.9);
      for (let i = 0; i < 3; i++) blob((i - 1) * 3.4, -7.6, 2.3, 2.1);
      break;
    case "ponytail":
      blob(0, -6.5, 2.1, 5);
      R(-1.2, -12.6, 2.4, 1.6); // the tie
      break;
    case "braid":
      for (let i = 0; i < 4; i++) blob(0, -11 + i * 2.6, 1.6 - i * 0.12, 1.6);
      break;
    case "topknot":
      blob(0, -12 - hh - 1.4, 2.5, 2.3);
      g.fillStyle = shade(look.hair, 0.25);
      R(-1.1, -12 - hh + 0.3, 2.2, 1.5);
      break;
    case "mohawk": {
      // From behind the crest is the whole head: a narrow ridge over a shaved
      // scalp. The shave is stubble ON the skull, not two blocks beside it.
      g.save(); g.globalAlpha = 0.3;
      blob(0, -11.9, hw + 0.2, hh + 0.15);
      g.restore();
      g.beginPath();
      g.moveTo(cx - 2.2 * s, cy + (-12 - hh + 1.6) * s + bob);
      g.lineTo(cx - 1.8 * s, cy + (-12 - hh - 5.2) * s + bob);
      g.lineTo(cx + 1.8 * s, cy + (-12 - hh - 5.2) * s + bob);
      g.lineTo(cx + 2.2 * s, cy + (-12 - hh + 1.6) * s + bob);
      g.closePath(); g.fill();
      R(-1.9, -12 - hh + 1.4, 3.8, 5.6);   // the ridge running down the nape
      break;
    }
    case "undercut":
      // The shaved band shows from behind as bare skin under the hair.
      g.fillStyle = shade(look.skin, 0.08);
      g.beginPath();
      g.ellipse(cx, cy - 9.6 * s + bob, (hw - 0.3) * s, 3.2 * s, 0, 0, Math.PI);
      g.fill();
      break;
    case "spiky":
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(cx + (i * 2.2 - 1.1) * s, cy + (-12 - hh + 1.2) * s + bob);
        g.lineTo(cx + (i * 2.2 + 0.2) * s, cy + (-12 - hh - 3.4) * s + bob);
        g.lineTo(cx + (i * 2.2 + 1.4) * s, cy + (-12 - hh + 1.2) * s + bob);
        g.closePath(); g.fill();
      }
      break;
    case "sidepart":
    case "fringe":
    case "short":
    default:
      // A neat nape: the hairline stops short of the collar rather than the
      // hair simply ending where the head does.
      g.fillStyle = shade(look.hair, 0.22);
      R(-(hw - 1.2), -7.4, (hw - 1.2) * 2, 1.4);
      break;
  }
}
