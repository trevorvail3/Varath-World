/**
 * src/client/characterCreator.ts
 * ------------------------------
 * Character creator: a name, body-part styles (hair, facial hair, top, legs,
 * shoes) and colours, with a live preview of the figure. Returns the chosen
 * look to main.ts, which stamps it onto the new player and saves it.
 *
 * The figure is drawn by the shared drawAvatar (src/client/avatar.ts), so the
 * preview and the in-world player always match.
 */

import type { Appearance } from "../core/types.ts";
import {
  BUILD_STYLES, CLOTH, DEFAULT_APPEARANCE, drawAvatar,
  FACIAL_STYLES, HAIR_STYLES, HAIRS, LEG_STYLES, SHOE_STYLES, SKINS, TOP_STYLES,
} from "./avatar.ts";

export type CreatedCharacter = Appearance;

/** Colour-field keys (string hex) and style-field keys (string id). */
type ColorKey = "skin" | "hair" | "tunic" | "legColor" | "shoeColor";
type StyleKey = "hairStyle" | "facial" | "top" | "legs" | "shoes";

export class CharacterCreator {
  private backdrop: HTMLElement;
  private draft: Appearance = { ...DEFAULT_APPEARANCE, name: "" };
  private preview!: HTMLCanvasElement;
  private rowsEl!: HTMLElement;
  private taken: Set<string>;
  private t0 = performance.now();
  private raf = 0;

  private checkSeq = 0;
  private checkTimer: ReturnType<typeof setTimeout> | 0 = 0;

  constructor(
    root: HTMLElement,
    private opts: {
      onCreate: (c: CreatedCharacter) => void;
      onBack?: () => void;
      takenNames: string[];
      /** Live availability check as the player types (cloud). Resolves true if
       *  the name is free. Best-effort — failures resolve true. */
      checkName?: (name: string) => Promise<boolean>;
      /** Atomically claim the name on submit. "taken" blocks creation; "ok" and
       *  "error" (offline / no backend) both let it proceed. */
      reserveName?: (name: string) => Promise<"ok" | "taken" | "error">;
    },
  ) {
    this.taken = new Set(opts.takenNames.map((n) => n.toLowerCase()));
    this.backdrop = document.createElement("div");
    this.backdrop.className = "creator-backdrop";
    this.backdrop.innerHTML = `
      <div class="creator-box">
        <div class="creator-title">VARATH</div>
        <div class="creator-sub">Who will you become?</div>
        <div class="creator-main">
          <canvas class="creator-preview" width="130" height="180"></canvas>
          <div class="creator-controls">
            <label class="creator-label">Name</label>
            <input class="creator-name" type="text" maxlength="16" placeholder="Your name" />
            <div class="creator-name-hint"></div>
            <div class="creator-rows"></div>
          </div>
        </div>
        <div class="creator-nav">
          <button class="creator-back" type="button">◀ Back</button>
          <button class="creator-go" type="button" disabled>Enter Varath</button>
        </div>
      </div>`;
    root.appendChild(this.backdrop);
    this.preview = this.backdrop.querySelector(".creator-preview") as HTMLCanvasElement;

    const nameEl = this.backdrop.querySelector(".creator-name") as HTMLInputElement;
    const hintEl = this.backdrop.querySelector(".creator-name-hint") as HTMLElement;
    const goEl = this.backdrop.querySelector(".creator-go") as HTMLButtonElement;
    const setHint = (text: string, state: "" | "warn" | "ok" | "busy"): void => {
      hintEl.textContent = text;
      hintEl.classList.toggle("warn", state === "warn");
      hintEl.classList.toggle("ok", state === "ok");
    };
    nameEl.addEventListener("input", () => {
      this.draft.name = nameEl.value.trim();
      const key = this.draft.name.toLowerCase();
      const seq = ++this.checkSeq; // invalidate any in-flight remote check
      if (this.checkTimer) { clearTimeout(this.checkTimer); this.checkTimer = 0; }
      // Instant local rules first.
      if (this.draft.name.length < 1) { setHint("1–16 characters.", ""); goEl.disabled = true; return; }
      if (this.taken.has(key)) { setHint("That name is already taken.", "warn"); goEl.disabled = true; return; }
      // No cloud check available — local rules are all we have.
      if (!this.opts.checkName) { setHint("1–16 characters.", ""); goEl.disabled = false; return; }
      // Debounced live availability check against the backend.
      setHint("Checking availability…", "busy");
      goEl.disabled = true;
      this.checkTimer = setTimeout(() => {
        void this.opts.checkName!(this.draft.name).then((free) => {
          if (seq !== this.checkSeq) return; // a newer keystroke superseded this
          if (free) { setHint("That name is available.", "ok"); goEl.disabled = false; }
          else { setHint("That name is already taken.", "warn"); goEl.disabled = true; }
        });
      }, 350);
    });

    const rows = this.backdrop.querySelector(".creator-rows") as HTMLElement;
    this.rowsEl = rows;
    this.buildRows();

    // "Surprise me" — a random pick per row + build, for players who'd rather
    // roll a look than dial one in (T7·07). Rebuilds every control + the preview.
    const randBtn = document.createElement("button");
    randBtn.type = "button";
    randBtn.className = "creator-random";
    randBtn.textContent = "Surprise me";
    randBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.randomize(); });
    rows.parentElement?.insertBefore(randBtn, rows);

    const backBtn = this.backdrop.querySelector(".creator-back") as HTMLElement;
    if (this.opts.onBack) {
      backBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation(); this.close(); this.opts.onBack!();
      });
    } else {
      backBtn.remove(); // nothing to go back to — this is the entry screen
    }
    goEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (goEl.disabled) return;
      if (this.draft.name.length < 1 || this.taken.has(this.draft.name.toLowerCase())) return;
      // No backend reservation — proceed as before (offline / local play).
      if (!this.opts.reserveName) { this.close(); this.opts.onCreate({ ...this.draft }); return; }
      // Atomically claim the name; only "taken" blocks — offline/no-table falls
      // through so a network hiccup never traps the player at creation.
      const label = goEl.textContent;
      goEl.disabled = true; goEl.textContent = "Claiming name…";
      void this.opts.reserveName(this.draft.name).then((result) => {
        if (result === "taken") {
          setHint("That name was just taken. Try another.", "warn");
          goEl.textContent = label; goEl.disabled = true;
          return;
        }
        this.close();
        this.opts.onCreate({ ...this.draft });
      });
    });

    // A gentle idle loop so the figure breathes (and its arms read) live.
    const loop = (): void => { this.renderPreview(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    setTimeout(() => nameEl.focus(), 50);
  }

  /** (Re)build every appearance row from the current draft. Called on open and
   *  after "Surprise me" so the controls reflect a freshly-rolled look. */
  private buildRows(): void {
    const rows = this.rowsEl;
    rows.innerHTML = "";
    this.partRow(rows, "Build", "build", BUILD_STYLES, null, null);
    this.partRow(rows, "Skin", null, null, "skin", SKINS);
    this.partRow(rows, "Hair", "hairStyle", HAIR_STYLES, "hair", HAIRS);
    this.partRow(rows, "Beard", "facial", FACIAL_STYLES, null, null);
    this.partRow(rows, "Top", "top", TOP_STYLES, "tunic", CLOTH);
    this.partRow(rows, "Legs", "legs", LEG_STYLES, "legColor", CLOTH);
    this.partRow(rows, "Shoes", "shoes", SHOE_STYLES, "shoeColor", CLOTH);
  }

  /** "Surprise me" — roll a random value for every style + colour + build, then
   *  rebuild the controls and preview so the figure updates in one go (T7·07). */
  private randomize(): void {
    const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]!;
    this.draft.hairStyle = pick(HAIR_STYLES).id;
    this.draft.facial = pick(FACIAL_STYLES).id;
    this.draft.top = pick(TOP_STYLES).id;
    this.draft.legs = pick(LEG_STYLES).id;
    this.draft.shoes = pick(SHOE_STYLES).id;
    this.draft.skin = pick(SKINS);
    this.draft.hair = pick(HAIRS);
    this.draft.tunic = pick(CLOTH);
    this.draft.legColor = pick(CLOTH);
    this.draft.shoeColor = pick(CLOTH);
    const build = pick(BUILD_STYLES).id;
    if (build === "average") delete this.draft.build;
    else this.draft.build = build as "lean" | "broad";
    this.buildRows();
    this.renderPreview();
  }

  /** A labelled row: optional style cycler + optional colour swatches. */
  private partRow(
    parent: HTMLElement,
    label: string,
    styleKey: StyleKey | "build" | null,
    styles: { id: string; label: string }[] | null,
    colorKey: ColorKey | null,
    colors: string[] | null,
  ): void {
    const row = document.createElement("div");
    row.className = "creator-part";
    const head = document.createElement("div");
    head.className = "creator-part-head";
    head.innerHTML = `<span class="creator-label">${label}</span>`;
    if (styleKey && styles) head.appendChild(this.cycler(styleKey, styles));
    row.appendChild(head);
    if (colorKey && colors) row.appendChild(this.swatches(colorKey, colors));
    parent.appendChild(row);
  }

  /** A ◀ name ▶ control cycling a style list. `build` is special-cased: its
   *  "average" id maps to an absent Appearance.build (exactOptionalPropertyTypes). */
  private cycler(key: StyleKey | "build", list: { id: string; label: string }[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "creator-cycler";
    const prev = document.createElement("button");
    prev.type = "button"; prev.className = "creator-cyc-btn"; prev.textContent = "◀";
    const name = document.createElement("span");
    name.className = "creator-cyc-name";
    const next = document.createElement("button");
    next.type = "button"; next.className = "creator-cyc-btn"; next.textContent = "▶";
    const current = (): string =>
      key === "build" ? (this.draft.build ?? "average") : this.draft[key];
    const apply = (id: string): void => {
      if (key === "build") {
        if (id === "average") delete this.draft.build;
        else this.draft.build = id as "lean" | "broad";
      } else {
        this.draft[key] = id;
      }
    };
    const sync = () => {
      const i = Math.max(0, list.findIndex((o) => o.id === current()));
      name.textContent = list[i]?.label ?? list[0]!.label;
    };
    const step = (d: number) => {
      let i = Math.max(0, list.findIndex((o) => o.id === current()));
      i = (i + d + list.length) % list.length;
      apply(list[i]!.id);
      sync(); this.renderPreview();
    };
    prev.addEventListener("pointerdown", (e) => { e.stopPropagation(); step(-1); });
    next.addEventListener("pointerdown", (e) => { e.stopPropagation(); step(1); });
    wrap.append(prev, name, next);
    sync();
    return wrap;
  }

  /** A row of colour swatches bound to a colour field. */
  private swatches(key: ColorKey, colors: string[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "creator-swatches";
    for (const c of colors) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "creator-swatch" + (this.draft[key] === c ? " on" : "");
      b.style.background = c;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.draft[key] = c;
        for (const sib of Array.from(wrap.children)) sib.classList.remove("on");
        b.classList.add("on");
        this.renderPreview();
      });
      wrap.appendChild(b);
    }
    return wrap;
  }

  private renderPreview(): void {
    const g = this.preview.getContext("2d");
    if (!g) return;
    const w = this.preview.width, h = this.preview.height;
    const t = performance.now() - this.t0;
    g.clearRect(0, 0, w, h);
    // A little stage: dusk-sky gradient, distant hills, a grass apron under
    // the figure and a warm key light — so the first thing a new player sees
    // of their character is a portrait, not a paper doll on a void.
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
    g.beginPath(); g.ellipse(w / 2, h - 22, w * 0.46, 20, 0, 0, Math.PI * 2); g.fill();
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
    // The figure idles (breathing bob comes from the shared avatar's own clock).
    drawAvatar(g, w / 2, h / 2 + 22, 3.7, this.draft, { now: t });
    // soft vignette frame
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.36, w / 2, h / 2, h * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(6,8,12,0.55)");
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
  }

  private close(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.checkTimer) { clearTimeout(this.checkTimer); this.checkTimer = 0; }
    this.checkSeq++; // drop any pending availability check
    this.backdrop.remove();
  }
}
