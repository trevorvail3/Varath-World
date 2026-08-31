/**
 * src/client/portrait.ts
 * ----------------------
 * A character, drawn large enough to look at.
 *
 * There is exactly one of these. The creation screen, the barber's chair, the
 * Character tab and a nearby player's profile are all the same component with
 * a different box around it — if they were four copies they would drift apart
 * within a month, which is the same argument that made `drawAvatar` shared in
 * the first place.
 *
 * What it owns: the canvas and its device-pixel-ratio sizing, the little stage
 * behind the figure (dusk sky, hills, a grass apron, motes and a key light),
 * the turn/walk controls, and a throttled repaint that can be STOPPED. That
 * last part matters: this thing now lives inside the HUD, where the panel it
 * sits on is hidden most of the time, and a canvas repainting a stage behind a
 * `display: none` is pure waste.
 */

import type { Appearance } from "../core/types.ts";
import { drawAvatar, withDefaults } from "./avatar.ts";
import type { GearLook } from "./gearLook.ts";

export type PortraitFacing = "up" | "down" | "left" | "right";

/** The fallback size, used only before the element has been laid out — the
 *  real size always comes from the CSS box the container gives it. */
const FALLBACK_W = 170;
const FALLBACK_H = 240;

/** Redraw about 24 times a second. The bob is slow, and the stage behind the
 *  figure — gradient, hills, motes, key light, vignette — is not free. */
const FRAME_MS = 40;

const FACINGS: { id: PortraitFacing; label: string; glyph: string }[] = [
  { id: "left", label: "Face left", glyph: "◀" },
  { id: "down", label: "Face the camera", glyph: "▼" },
  { id: "up", label: "Face away", glyph: "▲" },
  { id: "right", label: "Face right", glyph: "▶" },
];

export interface PortraitOpts {
  /** Show the four turn buttons. Default true. */
  turn?: boolean;
  /** Show the Walk toggle beside them. Default true. */
  walk?: boolean;
  /** An extra class on the wrapper, so the container can size the canvas. */
  className?: string;
  /** Start facing something other than the camera. */
  facing?: PortraitFacing;
}

export class Portrait {
  /** Wrapper: the canvas, and the turn row under it. Append this. */
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private look: Appearance;
  private gear: GearLook;
  private facing: PortraitFacing;
  private walking = false;
  private t0 = performance.now();
  private raf = 0;
  private lastFrame = 0;
  private onResize = (): void => { this.draw(); };

  constructor(look: Appearance | undefined, gear: GearLook = {}, opts: PortraitOpts = {}) {
    this.look = withDefaults(look);
    this.gear = gear;
    this.facing = opts.facing ?? "down";
    this.el = document.createElement("div");
    this.el.className = "portrait" + (opts.className ? ` ${opts.className}` : "");
    this.canvas = document.createElement("canvas");
    this.canvas.className = "portrait-canvas";
    this.el.appendChild(this.canvas);
    if (opts.turn !== false) this.buildTurnControls(opts.walk !== false);
    window.addEventListener("resize", this.onResize);
  }

  // --- What is being drawn ---------------------------------------------------

  /** `withDefaults` guards a look missing a field the renderer expects — an old
   *  save, or a draft mid-edit in the creator. */
  setLook(look: Appearance | undefined): void {
    this.look = withDefaults(look);
    this.draw();
  }

  setGear(gear: GearLook): void {
    this.gear = gear;
    this.draw();
  }

  setFacing(f: PortraitFacing): void {
    this.facing = f;
    this.syncTurnButtons();
    this.draw();
  }

  setWalking(on: boolean): void {
    this.walking = on;
    this.draw();
  }

  // --- The loop --------------------------------------------------------------

  /** Idempotent: calling start() twice does not run two loops. */
  start(): void {
    if (this.raf) return;
    const loop = (now: number): void => {
      if (now - this.lastFrame >= FRAME_MS) { this.lastFrame = now; this.draw(); }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    this.el.remove();
  }

  // --- Turning ---------------------------------------------------------------

  /** The four facings are not decoration: they are the only place a player can
   *  see that the character has a back and a profile at all. */
  private buildTurnControls(walk: boolean): void {
    const wrap = document.createElement("div");
    wrap.className = "portrait-turn";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Turn your character");
    for (const f of FACINGS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "portrait-turn-btn" + (f.id === this.facing ? " on" : "");
      b.dataset["facing"] = f.id;
      b.textContent = f.glyph;
      b.title = f.label;
      b.setAttribute("aria-label", f.label);
      b.setAttribute("aria-pressed", f.id === this.facing ? "true" : "false");
      b.addEventListener("click", (e) => { e.stopPropagation(); this.setFacing(f.id); });
      wrap.appendChild(b);
    }
    if (walk) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "portrait-turn-btn portrait-walk";
      btn.textContent = "Walk";
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.setWalking(!this.walking);
        btn.classList.toggle("on", this.walking);
        btn.setAttribute("aria-pressed", this.walking ? "true" : "false");
      });
      wrap.appendChild(btn);
    }
    this.el.appendChild(wrap);
  }

  private syncTurnButtons(): void {
    for (const el of this.el.querySelectorAll(".portrait-turn-btn[data-facing]")) {
      const on = (el as HTMLElement).dataset["facing"] === this.facing;
      el.classList.toggle("on", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  // --- Painting --------------------------------------------------------------

  /**
   * Size the backing store to the element's real CSS box times the device pixel
   * ratio, and put the context in CSS pixels. Without this a canvas is drawn at
   * half resolution on any modern screen, and stretched by whatever flex or
   * grid it was dropped into.
   */
  private sizeCanvas(): { w: number; h: number } {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const box = this.canvas.getBoundingClientRect();
    const w = Math.max(80, Math.round(box.width || FALLBACK_W));
    const h = Math.max(110, Math.round(box.height || FALLBACK_H));
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    const g = this.canvas.getContext("2d");
    if (g) g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  /** One frame. Safe to call at any time — nothing here depends on the loop. */
  draw(): void {
    const g = this.canvas.getContext("2d");
    if (!g) return;
    const { w, h } = this.sizeCanvas();
    const t = performance.now() - this.t0;
    g.clearRect(0, 0, w, h);
    // A little stage — dusk sky, distant hills, a grass apron and a warm key
    // light — so what a player sees of their character is a portrait rather
    // than a paper doll on a void.
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#25314e");
    sky.addColorStop(0.55, "#3a4a64");
    sky.addColorStop(1, "#2c3830");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#222f28"; // far hills
    g.beginPath();
    g.moveTo(0, h * 0.62);
    g.quadraticCurveTo(w * 0.3, h * 0.52, w * 0.55, h * 0.60);
    g.quadraticCurveTo(w * 0.8, h * 0.67, w, h * 0.58);
    g.lineTo(w, h); g.lineTo(0, h);
    g.closePath(); g.fill();
    g.fillStyle = "#31402f"; // grass apron
    g.beginPath(); g.ellipse(w / 2, h - h * 0.09, w * 0.46, h * 0.083, 0, 0, Math.PI * 2); g.fill();
    // drifting motes for life
    for (let i = 0; i < 6; i++) {
      const mx = (i * 37 + t / 60 + i * i * 13) % w;
      const my = 20 + ((i * 53 + t / 90) % (h * 0.5));
      g.fillStyle = `rgba(235,238,180,${(0.10 + 0.10 * Math.sin(t / 500 + i)).toFixed(3)})`;
      g.beginPath(); g.arc(mx, my, 1.2, 0, Math.PI * 2); g.fill();
    }
    // warm key light behind the figure
    const key = g.createRadialGradient(w / 2, h / 2 + 8, 6, w / 2, h / 2 + 8, w * 0.55);
    key.addColorStop(0, "rgba(240,200,130,0.16)");
    key.addColorStop(1, "rgba(240,200,130,0)");
    g.fillStyle = key;
    g.fillRect(0, 0, w, h);
    // The figure is ~31 base units tall, so this fills about three-quarters of
    // whatever box the container gave us — a 170x240 creator stage or a 172px
    // strip in the dock alike.
    const fs = Math.min(h / 42, w / 26);
    drawAvatar(
      g, w / 2, h / 2 + fs * 6, fs, this.look,
      { now: t, moving: this.walking, facing: this.facing },
      this.gear,
    );
    // soft vignette frame
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.36, w / 2, h / 2, h * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(6,8,12,0.55)");
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
  }
}
