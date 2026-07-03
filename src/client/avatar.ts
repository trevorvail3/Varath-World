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
/** The cloth palette — shared by tops, legs and shoes ("same colour options"). */
export const CLOTH = ["#6b6157", "#3a5a7a", "#4f7a3a", "#7a3a3a", "#6a4a7a", "#caa05a", "#2f6b66", "#9a5a2a"];

// --- Selectable styles (id + label). The renderer defaults unknown ids. ---
export const HAIR_STYLES = [
  { id: "short", label: "Short" },
  { id: "long", label: "Long" },
  { id: "topknot", label: "Top-knot" },
  { id: "mohawk", label: "Mohawk" },
  { id: "spiky", label: "Spiky" },
  { id: "sidepart", label: "Side part" },
  { id: "ponytail", label: "Ponytail" },
  { id: "curly", label: "Curly" },
  { id: "fringe", label: "Fringe" },
  { id: "bald", label: "Bald" },
];
export const FACIAL_STYLES = [
  { id: "none", label: "Clean-shaven" },
  { id: "stubble", label: "Stubble" },
  { id: "moustache", label: "Moustache" },
  { id: "goatee", label: "Goatee" },
  { id: "beard", label: "Full beard" },
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
  /** Mirror the figure horizontally — used to face the way it's walking. */
  flip?: boolean;
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
  try {
    drawAvatarInner(g, cx, cy, s, look, anim, gear);
  } finally {
    g.restore();
  }
}

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

  // Face the way we're walking by mirroring the whole figure around its centre.
  const flip = anim.flip === true;
  if (flip) { g.save(); g.translate(2 * cx, 0); g.scale(-1, 1); }

  // --- Shadow (planted) --- (a rider casts no shadow of their own; the mount's
  // ground shadow already anchors the pair — a second ellipse mid-horse reads
  // as someone standing behind the animal.)
  if (!riding) {
    g.fillStyle = "rgba(0,0,0,0.32)";
    g.beginPath();
    g.ellipse(cx, cy + 12.5 * s, 10 * s, 3.6 * s, 0, 0, Math.PI * 2);
    g.fill();
  }

  // --- Cape (behind the body, drapes from the shoulders with a faint sway) ---
  if (gear.cape) {
    const sway = (moving ? Math.sin(step) * 0.8 : Math.sin(t / 300) * 0.4) * s;
    g.fillStyle = gear.cape.color;
    g.beginPath();
    g.moveTo(cx - 5 * s, cy - 6 * s + bob);
    g.lineTo(cx + 5 * s, cy - 6 * s + bob);
    g.lineTo(cx + 7 * s + sway, cy + 11 * s);
    g.lineTo(cx - 7 * s + sway, cy + 11 * s);
    g.closePath();
    g.fill();
    g.fillStyle = shade(gear.cape.color, 0.28);
    g.fillRect(cx - 0.8 * s + sway * 0.5, cy - 6 * s + bob, 1.6 * s, 17 * s); // centre fold
  }

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
  const foot = (bx: number, lift: number): void => {
    const y = -lift;
    if (look.legs === "shorts") {
      g.fillStyle = look.legColor; R(bx, 5 + y, 5, 3);
      g.fillStyle = look.skin; R(bx + 0.5, 8 + y, 4, 2.5); // bare shin
    } else if (look.legs !== "kilt") {
      g.fillStyle = look.legColor; R(bx, 5 + y, 5, 6); // trousers
    }
    // Worn leg armour: a metal greave (plate), slim chaps (leather) — or nothing
    // here for robes, whose skirt is a single panel drawn after both feet.
    if (gear.legs && gear.legs.style !== "robe") {
      if (gear.legs.style === "leather") {
        g.fillStyle = gear.legs.base; R(bx + 0.2, 5 + y, 4.6, 5);       // slim leather chap
        g.fillStyle = shade(gear.legs.base, 0.3); R(bx + 0.2, 7.6 + y, 4.6, 0.5); // lace seam
      } else {
        g.fillStyle = gear.legs.base; R(bx - 0.2, 5 + y, 5.4, 5.2);
        g.fillStyle = gear.legs.edge; R(bx - 0.2, 5 + y, 1, 5.2);       // edge highlight
      }
    }
    if (gear.boots) {
      // Plated sabaton replaces the cloth shoe.
      g.fillStyle = gear.boots.base; R(bx - 0.4, 9.8 + y, 5.8, 3);
      g.fillStyle = gear.boots.edge; R(bx - 0.4, 9.8 + y, 5.8, 0.8);
      g.fillStyle = shade(gear.boots.base, 0.35); R(bx - 0.4, 12.2 + y, 5.8, 0.6); // sole
      return;
    }
    g.fillStyle = look.shoeColor;
    if (look.shoes === "sandals") {
      R(bx, 11.4 + y, 5, 1.1);
      g.fillStyle = shade(look.shoeColor, 0.3); R(bx + 1.6, 10.4 + y, 0.8, 1.1); // strap
    } else if (look.shoes === "clogs") {
      R(bx - 0.5, 10.4 + y, 5.8, 2.2);
      g.fillStyle = shade(look.shoeColor, 0.28); R(bx + 4.5, 10.4 + y, 0.8, 2.2); // toe
    } else {
      R(bx - 0.2, 10 + y, 5.4, 2.6); // boot
      g.fillStyle = shade(look.shoeColor, 0.3); R(bx - 0.2, 12 + y, 5.4, 0.6); // sole
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
    foot(-6, liftL);
    foot(1, liftR);
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
  drawArm(g, cx, cy, s, bob, look, 6.4, farAngle);

  // --- Torso / top (bobs) ---
  g.fillStyle = look.tunic;
  Rb(-7, -7, 14, 12);
  g.fillStyle = "rgba(0,0,0,0.16)";
  Rb(-7, 3, 14, 2); // belt line
  g.fillStyle = shade(look.tunic, 0.18);
  Rb(2.5, -7, 1.2, 10); // side shade for form
  if (look.top === "vneck") {
    g.fillStyle = look.skin;
    g.beginPath();
    g.moveTo(cx - 3 * s, cy - 7 * s + bob);
    g.lineTo(cx + 3 * s, cy - 7 * s + bob);
    g.lineTo(cx, cy - 2.5 * s + bob);
    g.closePath();
    g.fill();
  } else if (look.top === "sash") {
    g.strokeStyle = shade(look.tunic, 0.4);
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.moveTo(cx - 7 * s, cy - 6 * s + bob);
    g.lineTo(cx + 7 * s, cy + 2 * s + bob);
    g.stroke();
  } else {
    g.fillStyle = "rgba(0,0,0,0.16)";
    Rb(-0.6, -7, 1.2, 10); // plain front seam
  }

  // --- Worn body armour, over the top: plate / leather jerkin / robe ---
  if (gear.body && gear.body.style === "robe") {
    // A flowing robe draping from the shoulders out past the hips.
    g.fillStyle = gear.body.base;
    g.beginPath();
    g.moveTo(cx - 6.5 * s, cy - 7 * s + bob);
    g.lineTo(cx + 6.5 * s, cy - 7 * s + bob);
    g.lineTo(cx + 7.6 * s, cy + 6 * s + bob);
    g.lineTo(cx - 7.6 * s, cy + 6 * s + bob);
    g.closePath();
    g.fill();
    g.fillStyle = gear.body.edge;
    Rb(-0.6, -7, 1.2, 13);                 // centre trim, collar to hem
    g.fillStyle = shade(gear.body.base, 0.22);
    Rb(3.8, -7, 1.1, 12.5);                // a side fold for form
    g.fillStyle = look.skin;
    arc(0, -6.8, 1.9, 0, Math.PI, false);  // V collar
    g.fill();
  } else if (gear.body && gear.body.style === "leather") {
    // A fitted leather jerkin — lighter than plate, laced up the front.
    g.fillStyle = gear.body.base;
    Rb(-6, -6.4, 12, 9);
    g.fillStyle = gear.body.edge;
    Rb(-6, -6.4, 12, 1);                   // shoulder seam highlight
    g.fillStyle = look.skin;
    arc(0, -6.4, 1.8, 0, Math.PI, false);  // open V-neck
    g.fill();
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
    Rb(-6.6, -6.6, 13.2, 9.4);
    g.fillStyle = gear.body.edge;
    Rb(-6.6, -6.6, 13.2, 1.2);            // top rim highlight
    Rb(-6.6, -6.6, 1.2, 9.4);             // left edge highlight
    g.fillStyle = shade(gear.body.base, 0.3);
    Rb(-0.7, -6.6, 1.4, 9.4);             // central ridge
    g.fillStyle = look.skin;
    arc(0, -6.6, 2.2, 0, Math.PI, false); // neckline opening
    g.fill();
  }

  // --- The near arm (in front of the torso), holding the weapon/tool ---
  drawArm(g, cx, cy, s, bob, look, -6.4, nearAngle, nearTool, nearMetal);

  // --- Pauldrons over both shoulders (plate only — leather/robes have none) ---
  if (gear.body && gear.body.style === "plate") {
    for (const sx of [-6.6, 6.6]) {
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

  // --- Shield in the off hand (drawn to the far side) ---
  if (gear.shield) {
    const hx = cx + 7.2 * s, hy = cy + 1 * s + bob;
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
  g.fillStyle = look.skin;
  arc(0, -12, 6, 0, Math.PI * 2);
  g.fill();

  // --- Facial hair, then hair (both bob) ---
  drawFacial(g, cx, cy, s, bob, look);
  drawHair(g, cx, cy, s, bob, look);

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
): void {
  const px = cx + shoulderDX * s;
  const py = cy - 5 * s + bob;
  g.save();
  g.translate(px, py);
  g.rotate(angle);
  if (tool) drawTool(g, s, tool, metal); // behind the hand, swings with the arm
  g.fillStyle = look.tunic; // sleeve (upper arm)
  g.fillRect(-1.3 * s, 0, 2.6 * s, 4.2 * s);
  g.fillStyle = look.skin; // forearm
  g.fillRect(-1.1 * s, 3.8 * s, 2.2 * s, 3.6 * s);
  g.beginPath(); // hand
  g.arc(0, 7.7 * s, 1.6 * s, 0, Math.PI * 2);
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

function drawFacial(g: Ctx, cx: number, cy: number, s: number, bob: number, look: Appearance): void {
  if (look.facial === "none") return;
  const hc = look.hair;
  const Rb = (dx: number, dy: number, w: number, h: number) =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  if (look.facial === "stubble") {
    g.fillStyle = hc;
    g.globalAlpha = 0.35;
    g.beginPath();
    g.arc(cx, cy - 10 * s + bob, 6 * s, Math.PI * 0.15, Math.PI * 0.85);
    g.fill();
    g.globalAlpha = 1;
    return;
  }
  if (look.facial === "moustache") {
    g.fillStyle = hc;
    Rb(-2.6, -10.4, 5.2, 1.3);
    return;
  }
  if (look.facial === "goatee") {
    g.fillStyle = hc;
    Rb(-1.6, -8.6, 3.2, 2.6);
    Rb(-2.4, -10.4, 4.8, 1.1); // a small moustache with it
    return;
  }
  // full beard: fill the lower face
  g.fillStyle = hc;
  g.beginPath();
  g.arc(cx, cy - 11 * s + bob, 6 * s, Math.PI * 0.08, Math.PI * 0.92);
  g.closePath();
  g.fill();
  Rb(-2.4, -11, 4.8, 1.1); // moustache cap
}

function drawHair(g: Ctx, cx: number, cy: number, s: number, bob: number, look: Appearance): void {
  if (look.hairStyle === "bald") return;
  const hc = look.hair;
  g.fillStyle = hc;
  const R = (dx: number, dy: number, w: number, h: number) =>
    g.fillRect(cx + dx * s, cy + dy * s + bob, w * s, h * s);
  const cap = (r = 6) => {
    g.beginPath();
    g.arc(cx, cy - 12 * s + bob, r * s, Math.PI * 1.02, Math.PI * 1.98);
    g.lineTo(cx + (r - 1) * s, cy - 13 * s + bob);
    g.arc(cx, cy - 13 * s + bob, (r - 0.5) * s, Math.PI * 1.92, Math.PI * 1.08, true);
    g.closePath();
    g.fill();
  };
  switch (look.hairStyle) {
    case "long":
      cap();
      R(-6.2, -13, 1.8, 9); R(4.4, -13, 1.8, 9); // panels down both sides
      break;
    case "topknot":
      cap();
      g.beginPath(); g.arc(cx, cy - 19 * s + bob, 2.2 * s, 0, Math.PI * 2); g.fill();
      break;
    case "mohawk":
      R(-1.6, -19.5, 3.2, 8.5);
      break;
    case "spiky":
      cap(5.4);
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(cx + i * 2.2 * s, cy - 17 * s + bob);
        g.lineTo(cx + (i * 2.2 + 1.1) * s, cy - 20.5 * s + bob);
        g.lineTo(cx + (i * 2.2 + 2.2) * s, cy - 17 * s + bob);
        g.closePath(); g.fill();
      }
      break;
    case "sidepart":
      cap();
      R(-6.4, -15.5, 5.5, 3); // a swept fringe to one side
      break;
    case "ponytail":
      cap();
      g.beginPath(); // tail behind, to the right
      g.ellipse(cx + 6 * s, cy - 9 * s + bob, 1.8 * s, 4.5 * s, -0.3, 0, Math.PI * 2);
      g.fill();
      break;
    case "curly":
      g.beginPath(); g.arc(cx, cy - 13.5 * s + bob, 6.6 * s, Math.PI, Math.PI * 2); g.fill();
      for (let i = -2; i <= 2; i++) { // bumps along the top
        g.beginPath(); g.arc(cx + i * 2.6 * s, cy - 15 * s + bob, 2.1 * s, 0, Math.PI * 2); g.fill();
      }
      break;
    case "fringe":
      cap();
      R(-6, -13, 12, 2.6); // a fringe low over the brow
      break;
    case "short":
    default:
      cap();
      break;
  }
}
