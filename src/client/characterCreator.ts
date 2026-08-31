/**
 * src/client/characterCreator.ts
 * ------------------------------
 * Where a character is made — and, at the barber, remade.
 *
 * The figure is drawn by the shared drawAvatar (src/client/avatar.ts), so the
 * portrait here and the player in the world are the same code. What the screen
 * adds is a way to steer it: the look is split into Body, Face, Hair and
 * Clothes so the row count can grow without the box becoming a scroll, presets
 * and a randomiser for players who would rather not dial one in, and a portrait
 * that turns and walks — which is also the quickest way to see that the figure
 * has four views at all.
 *
 * The same screen serves the barber (see `opts.initial` / `lockName` /
 * `hideMode`), so there is one of it rather than two that drift apart.
 */

import type { Appearance } from "../core/types.ts";
import type { AccountMode } from "../core/worldCore.ts";
import {
  BROW_STYLES, BUILD_STYLES, CLOTH, DEFAULT_APPEARANCE, drawAvatar, EYE_STYLES, EYES,
  FACIAL_STYLES, HAIR_STYLES, HAIRS, HEIGHT_STYLES, JAW_STYLES, LEG_STYLES,
  MARKING_COLORS, MARKING_STYLES, SHOE_STYLES, SKINS, TOP_STYLES, withDefaults,
} from "./avatar.ts";
import type { GearLook } from "./gearLook.ts";

/** What the creator hands back: the look, plus the account mode chosen for the
 *  life of the character. The mode is offered here and only here — an Ironman's
 *  claim is that they started that way. */
export type CreatedCharacter = Appearance & { mode?: AccountMode };

/** Colour-field keys (string hex) and style-field keys (string id). */
type ColorKey = "skin" | "hair" | "tunic" | "legColor" | "shoeColor"
  | "eyeColor" | "beardColor" | "markingColor";
type StyleKey = "hairStyle" | "facial" | "top" | "legs" | "shoes"
  | "eyes" | "brows" | "jaw" | "marking";
/** The two closed unions, which are handled apart from the free-form ids. */
type PseudoKey = "build" | "height";

/** The preview's fallback size, used only before the element has been laid out
 *  (its real size comes from the CSS box — see sizePreview). */
const PREVIEW_W = 170;
const PREVIEW_H = 240;

type SectionId = "body" | "face" | "hair" | "clothes";
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "body", label: "Body" },
  { id: "face", label: "Face" },
  { id: "hair", label: "Hair" },
  { id: "clothes", label: "Clothes" },
];

const FACINGS: { id: "left" | "down" | "up" | "right"; label: string; glyph: string }[] = [
  { id: "left", label: "Face left", glyph: "◀" },
  { id: "down", label: "Face the camera", glyph: "▼" },
  { id: "up", label: "Face away", glyph: "▲" },
  { id: "right", label: "Face right", glyph: "▶" },
];

/**
 * Hand-made starting characters. Six people rather than six random rolls: a
 * player who does not want to fiddle should be able to pick someone and be in
 * the world in five seconds, and what they pick should look like it was chosen.
 */
const PRESETS: { label: string; look: Partial<Appearance> }[] = [
  {
    label: "The Hillwalker",
    look: {
      skin: SKINS[1]!, hair: HAIRS[1]!, hairStyle: "short", facial: "stubble",
      tunic: CLOTH[0]!, legColor: CLOTH[7]!, shoeColor: CLOTH[8]!,
      eyes: "open", brows: "even", jaw: "oval", eyeColor: EYES[1]!,
    },
  },
  {
    label: "The Wayfarer",
    look: {
      skin: SKINS[3]!, hair: HAIRS[0]!, hairStyle: "ponytail", facial: "none",
      tunic: CLOTH[2]!, legColor: CLOTH[0]!, shoeColor: CLOTH[8]!,
      eyes: "sharp", brows: "arched", jaw: "narrow", eyeColor: EYES[2]!,
      build: "lean", height: "tall",
    },
  },
  {
    label: "The Smith",
    look: {
      skin: SKINS[2]!, hair: HAIRS[0]!, hairStyle: "undercut", facial: "beard",
      tunic: CLOTH[3]!, legColor: CLOTH[0]!, shoeColor: CLOTH[8]!,
      eyes: "narrow", brows: "heavy", jaw: "square", eyeColor: EYES[0]!,
      build: "broad", marking: "ash", markingColor: MARKING_COLORS[4]!,
    },
  },
  {
    label: "The Hedge-Witch",
    look: {
      skin: SKINS[0]!, hair: HAIRS[7]!, hairStyle: "long", facial: "none",
      tunic: CLOTH[4]!, legColor: CLOTH[4]!, shoeColor: CLOTH[8]!,
      eyes: "wide", brows: "thin", jaw: "narrow", eyeColor: EYES[5]!,
      build: "lean", height: "short",
    },
  },
  {
    label: "The Outrider",
    look: {
      skin: SKINS[4]!, hair: HAIRS[0]!, hairStyle: "braid", facial: "chops",
      tunic: CLOTH[6]!, legColor: CLOTH[0]!, shoeColor: CLOTH[8]!,
      eyes: "open", brows: "angled", jaw: "square", eyeColor: EYES[3]!,
      marking: "scar_cheek", markingColor: MARKING_COLORS[0]!,
    },
  },
  {
    label: "The Ashfen Pilgrim",
    look: {
      skin: SKINS[5]!, hair: HAIRS[0]!, hairStyle: "shaved", facial: "goatee",
      tunic: CLOTH[8]!, legColor: CLOTH[8]!, shoeColor: CLOTH[8]!,
      eyes: "tired", brows: "even", jaw: "round", eyeColor: EYES[4]!,
      build: "heavy", marking: "warpaint_bar", markingColor: MARKING_COLORS[1]!,
    },
  },
];

export class CharacterCreator {
  private backdrop: HTMLElement;
  private draft: Appearance;
  private mode: AccountMode = "standard";
  private preview!: HTMLCanvasElement;
  private rowsEl!: HTMLElement;
  private taken: Set<string>;
  private t0 = performance.now();
  private raf = 0;
  private lastFrame = 0;
  private onResize = (): void => { this.renderPreview(); };
  private section: SectionId = "body";
  private facing: "up" | "down" | "left" | "right" = "down";
  private walking = false;

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
      /** An existing look to open with — the barber, editing a character who
       *  already exists rather than making one. */
      initial?: Appearance;
      /** Lock the name field. The name is a join key (pier records attribute by
       *  it, and the name registry's claim is one-way), so the barber may change
       *  everything about a character except what they are called. */
      lockName?: boolean;
      /** Hide the account-mode picker. Mode is chosen once, at creation. */
      hideMode?: boolean;
      /** What the figure is wearing in the portrait — the barber shows you as
       *  you actually are, kit and all. */
      gear?: GearLook;
      /** Wording for the screen and its confirm button. */
      title?: string;
      subtitle?: string;
      confirmLabel?: string;
    },
  ) {
    this.taken = new Set(opts.takenNames.map((n) => n.toLowerCase()));
    this.draft = opts.initial
      ? withDefaults(opts.initial)
      : { ...DEFAULT_APPEARANCE, name: "" };
    this.backdrop = document.createElement("div");
    this.backdrop.className = "creator-backdrop";
    this.backdrop.setAttribute("role", "dialog");
    this.backdrop.setAttribute("aria-modal", "true");
    this.backdrop.setAttribute("aria-label", opts.title ?? "Create your character");
    this.backdrop.innerHTML = `
      <div class="creator-box">
        <div class="creator-title">${opts.title ?? "VARATH"}</div>
        <div class="creator-sub">${opts.subtitle ?? "Who will you become?"}</div>
        <div class="creator-main">
          <div class="creator-stage">
            <canvas class="creator-preview"></canvas>
            <div class="creator-turn"></div>
          </div>
          <div class="creator-controls">
            <label class="creator-label" for="creator-name-input">Name</label>
            <input class="creator-name" id="creator-name-input" type="text" maxlength="16" placeholder="Your name" />
            <div class="creator-name-hint" aria-live="polite"></div>
            <div class="creator-presets"></div>
            <div class="creator-tabs" role="tablist"></div>
            <div class="creator-rows"></div>
            <div class="creator-account">
              <label class="creator-label">Account</label>
              <div class="creator-modes"></div>
              <div class="creator-mode-note"></div>
            </div>
          </div>
        </div>
        <div class="creator-nav">
          <button class="creator-back" type="button">◀ Back</button>
          <button class="creator-go" type="button" disabled>${opts.confirmLabel ?? "Enter Varath"}</button>
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

    if (opts.lockName) {
      // The barber can change everything about you except what you are called.
      nameEl.value = this.draft.name;
      nameEl.disabled = true;
      setHint("A name, once claimed, is yours for good.", "");
      goEl.disabled = false;
    } else {
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
    }

    this.rowsEl = this.backdrop.querySelector(".creator-rows") as HTMLElement;
    this.buildTurnControls();
    this.buildPresets();
    this.buildTabs();
    this.buildRows();
    if (opts.hideMode) {
      (this.backdrop.querySelector(".creator-account") as HTMLElement).remove();
    } else {
      this.buildModes();
    }

    const backBtn = this.backdrop.querySelector(".creator-back") as HTMLElement;
    if (this.opts.onBack) {
      backBtn.addEventListener("click", (e) => {
        e.stopPropagation(); this.close(); this.opts.onBack!();
      });
    } else {
      backBtn.remove(); // nothing to go back to — this is the entry screen
    }
    goEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (goEl.disabled) return;
      // The barber has nothing to claim: the name is already this player's.
      if (this.opts.lockName) { this.close(); this.opts.onCreate(this.made()); return; }
      if (this.draft.name.length < 1 || this.taken.has(this.draft.name.toLowerCase())) return;
      // No backend reservation — proceed as before (offline / local play).
      if (!this.opts.reserveName) { this.close(); this.opts.onCreate(this.made()); return; }
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
        this.opts.onCreate(this.made());
      });
    });

    // Enter anywhere in the name field submits, Escape leaves. Neither worked:
    // every control was bound to `pointerdown`, so the whole screen could only
    // be operated with a pointer.
    nameEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !goEl.disabled) { e.preventDefault(); goEl.click(); }
    });
    this.backdrop.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.opts.onBack) {
        e.preventDefault(); this.close(); this.opts.onBack();
      }
    });

    // A gentle idle loop so the figure breathes (and its arms read) live. The
    // bob is slow, so this runs at about 24fps rather than repainting the whole
    // stage — sky gradient, hills, motes, key light and vignette — 60 times a
    // second for an image that changes by a pixel.
    const loop = (now: number): void => {
      if (now - this.lastFrame >= 40) { this.lastFrame = now; this.renderPreview(); }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    window.addEventListener("resize", this.onResize);
    if (!opts.lockName) setTimeout(() => nameEl.focus(), 50);
  }

  /** The finished character: look plus mode (standard is left off entirely, so
   *  a standard account persists exactly as it always did). */
  private made(): CreatedCharacter {
    return this.mode === "standard" ? { ...this.draft } : { ...this.draft, mode: this.mode };
  }

  // --- The portrait's controls ----------------------------------------------

  /** Turn the figure, and set it walking. The four facings are not decoration:
   *  they are the only place a player can see that the character has a back and
   *  a profile at all. */
  private buildTurnControls(): void {
    const wrap = this.backdrop.querySelector(".creator-turn") as HTMLElement;
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Turn your character");
    for (const f of FACINGS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "creator-turn-btn" + (f.id === this.facing ? " on" : "");
      b.textContent = f.glyph;
      b.title = f.label;
      b.setAttribute("aria-label", f.label);
      b.setAttribute("aria-pressed", f.id === this.facing ? "true" : "false");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.facing = f.id;
        for (const el of wrap.querySelectorAll(".creator-turn-btn")) {
          const on = el === b;
          el.classList.toggle("on", on);
          el.setAttribute("aria-pressed", on ? "true" : "false");
        }
        this.renderPreview();
      });
      wrap.appendChild(b);
    }
    const walk = document.createElement("button");
    walk.type = "button";
    walk.className = "creator-turn-btn creator-walk";
    walk.textContent = "Walk";
    walk.setAttribute("aria-pressed", "false");
    walk.addEventListener("click", (e) => {
      e.stopPropagation();
      this.walking = !this.walking;
      walk.classList.toggle("on", this.walking);
      walk.setAttribute("aria-pressed", this.walking ? "true" : "false");
    });
    wrap.appendChild(walk);
  }

  // --- Presets and the randomiser -------------------------------------------

  private buildPresets(): void {
    const wrap = this.backdrop.querySelector(".creator-presets") as HTMLElement;
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Starting characters");
    for (const p of PRESETS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "creator-preset";
      b.textContent = p.label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        // The name and the account mode are the player's, not the preset's.
        const name = this.draft.name;
        this.draft = withDefaults({ ...DEFAULT_APPEARANCE, ...p.look, name });
        this.normalise();
        this.buildRows();
        this.renderPreview();
      });
      wrap.appendChild(b);
    }
    const rand = document.createElement("button");
    rand.type = "button";
    rand.className = "creator-preset creator-random";
    rand.textContent = "Surprise me";
    rand.addEventListener("click", (e) => { e.stopPropagation(); this.randomize(); });
    wrap.appendChild(rand);
  }

  /** Roll every field the current section owns — so a player who likes their
   *  face can reroll a body without losing it. */
  private randomize(): void {
    const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
    const set = (k: PseudoKey, id: string): void => {
      if (id === "average") delete this.draft[k];
      else if (k === "build") this.draft.build = id as "lean" | "broad" | "heavy";
      else this.draft.height = id as "short" | "tall";
    };
    for (const row of this.rowsFor(this.section)) {
      if (row.pseudo && row.styles) set(row.pseudo, pick(row.styles).id);
      else if (row.styleKey && row.styles) this.draft[row.styleKey] = pick(row.styles).id;
      if (row.colorKey && row.colors) this.draft[row.colorKey] = pick(row.colors);
    }
    this.normalise();
    this.buildRows();
    this.renderPreview();
  }

  /** Keep the draft in a shape the renderer and the save both accept: unset
   *  optionals are DELETED, never set to undefined (exactOptionalPropertyTypes). */
  private normalise(): void {
    if (this.draft.build === undefined) delete this.draft.build;
    if (this.draft.height === undefined) delete this.draft.height;
  }

  // --- Sections --------------------------------------------------------------

  private buildTabs(): void {
    const wrap = this.backdrop.querySelector(".creator-tabs") as HTMLElement;
    for (const sec of SECTIONS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "creator-tab" + (sec.id === this.section ? " on" : "");
      b.textContent = sec.label;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", sec.id === this.section ? "true" : "false");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.section = sec.id;
        for (const el of wrap.querySelectorAll(".creator-tab")) {
          const on = el === b;
          el.classList.toggle("on", on);
          el.setAttribute("aria-selected", on ? "true" : "false");
        }
        this.buildRows();
      });
      wrap.appendChild(b);
    }
  }

  /** Every control in a section, as data — so the randomiser and the row
   *  builder read the same list and can never disagree about what a section
   *  contains. */
  private rowsFor(section: SectionId): {
    label: string;
    styleKey?: StyleKey;
    pseudo?: PseudoKey;
    styles?: { id: string; label: string }[];
    colorKey?: ColorKey;
    colors?: string[];
  }[] {
    switch (section) {
      case "body":
        return [
          { label: "Build", pseudo: "build", styles: BUILD_STYLES },
          { label: "Height", pseudo: "height", styles: HEIGHT_STYLES },
          { label: "Skin", colorKey: "skin", colors: SKINS },
        ];
      case "face":
        return [
          { label: "Eyes", styleKey: "eyes", styles: EYE_STYLES, colorKey: "eyeColor", colors: EYES },
          { label: "Brows", styleKey: "brows", styles: BROW_STYLES },
          { label: "Jaw", styleKey: "jaw", styles: JAW_STYLES },
          { label: "Beard", styleKey: "facial", styles: FACIAL_STYLES, colorKey: "beardColor", colors: HAIRS },
          { label: "Markings", styleKey: "marking", styles: MARKING_STYLES, colorKey: "markingColor", colors: MARKING_COLORS },
        ];
      case "hair":
        return [{ label: "Hair", styleKey: "hairStyle", styles: HAIR_STYLES, colorKey: "hair", colors: HAIRS }];
      case "clothes":
        return [
          { label: "Top", styleKey: "top", styles: TOP_STYLES, colorKey: "tunic", colors: CLOTH },
          { label: "Legs", styleKey: "legs", styles: LEG_STYLES, colorKey: "legColor", colors: CLOTH },
          { label: "Shoes", styleKey: "shoes", styles: SHOE_STYLES, colorKey: "shoeColor", colors: CLOTH },
        ];
    }
  }

  /** (Re)build every row of the active section from the current draft. */
  private buildRows(): void {
    const rows = this.rowsEl;
    rows.innerHTML = "";
    for (const r of this.rowsFor(this.section)) {
      const row = document.createElement("div");
      row.className = "creator-part";
      const head = document.createElement("div");
      head.className = "creator-part-head";
      head.innerHTML = `<span class="creator-label">${r.label}</span>`;
      if (r.styles && (r.styleKey || r.pseudo)) {
        head.appendChild(this.cycler(r.pseudo ?? r.styleKey!, r.styles, r.label));
      }
      row.appendChild(head);
      if (r.colorKey && r.colors) row.appendChild(this.swatches(r.colorKey, r.colors, r.label));
      rows.appendChild(row);
    }
  }

  /** A ◀ name ▶ control cycling a style list. The two closed unions (`build`,
   *  `height`) are special-cased: their "average" id maps to an ABSENT field,
   *  because exactOptionalPropertyTypes forbids assigning undefined. */
  private cycler(
    key: StyleKey | PseudoKey, list: { id: string; label: string }[], label: string,
  ): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "creator-cycler";
    const prev = document.createElement("button");
    prev.type = "button"; prev.className = "creator-cyc-btn"; prev.textContent = "◀";
    prev.setAttribute("aria-label", `Previous ${label.toLowerCase()}`);
    const name = document.createElement("span");
    name.className = "creator-cyc-name";
    // The value announces itself when it changes; without this the arrows read
    // as two nameless buttons either side of nothing.
    name.setAttribute("aria-live", "polite");
    const next = document.createElement("button");
    next.type = "button"; next.className = "creator-cyc-btn"; next.textContent = "▶";
    next.setAttribute("aria-label", `Next ${label.toLowerCase()}`);
    const pseudo = key === "build" || key === "height";
    const current = (): string =>
      pseudo ? (this.draft[key as PseudoKey] ?? "average") : (this.draft[key as StyleKey] ?? "");
    const apply = (id: string): void => {
      if (key === "build") {
        if (id === "average") delete this.draft.build;
        else this.draft.build = id as "lean" | "broad" | "heavy";
      } else if (key === "height") {
        if (id === "average") delete this.draft.height;
        else this.draft.height = id as "short" | "tall";
      } else {
        this.draft[key as StyleKey] = id;
      }
    };
    const sync = (): void => {
      const i = Math.max(0, list.findIndex((o) => o.id === current()));
      name.textContent = list[i]?.label ?? list[0]!.label;
    };
    const step = (d: number): void => {
      let i = Math.max(0, list.findIndex((o) => o.id === current()));
      i = (i + d + list.length) % list.length;
      apply(list[i]!.id);
      sync(); this.renderPreview();
    };
    prev.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
    next.addEventListener("click", (e) => { e.stopPropagation(); step(1); });
    wrap.append(prev, name, next);
    sync();
    return wrap;
  }

  /** A row of colour swatches bound to a colour field, plus a picker for
   *  anything the curated ramp does not cover.
   *
   *  These were unlabelled colour-only buttons, so anything that reads the page
   *  aloud found eight identical empty controls in a row. They are a radio group
   *  now, each one named by its position in the ramp and reporting whether it is
   *  the chosen one. */
  private swatches(key: ColorKey, colors: string[], label: string): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "creator-swatches";
    wrap.setAttribute("role", "radiogroup");
    wrap.setAttribute("aria-label", `${label} colour`);
    const mark = (chosen: HTMLElement | null): void => {
      for (const sib of Array.from(wrap.querySelectorAll(".creator-swatch"))) {
        const on = sib === chosen;
        sib.classList.toggle("on", on);
        sib.setAttribute("aria-checked", on ? "true" : "false");
      }
    };
    colors.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      const on = this.draft[key] === c;
      b.className = "creator-swatch" + (on ? " on" : "");
      b.style.background = c;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.setAttribute("aria-label", `${label} ${i + 1} of ${colors.length}`);
      b.title = c;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.draft[key] = c;
        mark(b);
        this.renderPreview();
      });
      wrap.appendChild(b);
    });
    // Any colour at all. The curated ramp stays the default path — it is what
    // stops a world of neon characters — but six skin tones and eight hair
    // colours is not a range, and the picker writes plain #rrggbb, which is
    // exactly what the save's validator demands.
    const custom = document.createElement("label");
    custom.className = "creator-swatch creator-swatch-any";
    custom.title = "Any colour";
    const input = document.createElement("input");
    input.type = "color";
    input.value = this.draft[key] ?? colors[0]!;
    input.setAttribute("aria-label", `${label} — any colour`);
    input.addEventListener("input", () => {
      this.draft[key] = input.value;
      custom.style.background = input.value;
      mark(null);
      this.renderPreview();
    });
    custom.appendChild(input);
    if (!colors.includes(this.draft[key] ?? "")) custom.style.background = this.draft[key] ?? "";
    wrap.appendChild(custom);
    return wrap;
  }

  /** The account-mode picker. Each mode is a permanent choice made here, so the
   *  cost of each is spelled out rather than hidden behind a name. */
  private buildModes(): void {
    const wrap = this.backdrop.querySelector(".creator-modes") as HTMLElement;
    const note = this.backdrop.querySelector(".creator-mode-note") as HTMLElement;
    wrap.setAttribute("role", "radiogroup");
    wrap.setAttribute("aria-label", "Account type");
    const MODES: { id: AccountMode; label: string; blurb: string }[] = [
      { id: "standard", label: "Standard", blurb: "Varath as it comes. Trade, the Grand Exchange and staked duels are all open to you." },
      { id: "ironman", label: "Ironman", blurb: "Everything you have, you get yourself. No Grand Exchange, no trading, no staked duels." },
      { id: "hardcore", label: "Hardcore", blurb: "Ironman, and one life. A death spends it — you carry on as an Ironman, and the record of how it ended stands." },
      { id: "ultimate", label: "Ultimate", blurb: "Ironman, and no bank at all. What you carry is everything you own." },
    ];
    for (const m of MODES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `creator-mode${m.id === this.mode ? " on" : ""}`;
      b.dataset["mode"] = m.id;
      b.textContent = m.label;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", m.id === this.mode ? "true" : "false");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.mode = m.id;
        for (const el of wrap.querySelectorAll(".creator-mode")) {
          const on = (el as HTMLElement).dataset["mode"] === this.mode;
          el.classList.toggle("on", on);
          el.setAttribute("aria-checked", on ? "true" : "false");
        }
        note.textContent = m.blurb;
      });
      wrap.appendChild(b);
    }
    note.textContent = MODES[0]!.blurb;
  }

  /**
   * Size the backing store to the element's real CSS box times the device pixel
   * ratio. The canvas carried a fixed 130x180 backing store and no CSS size, so
   * the flex row stretched it: on a phone the portrait came out as a smeared
   * column, and on any modern screen it was upscaled from half resolution.
   */
  private sizePreview(): { w: number; h: number } {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const box = this.preview.getBoundingClientRect();
    const w = Math.max(80, Math.round(box.width || PREVIEW_W));
    const h = Math.max(110, Math.round(box.height || PREVIEW_H));
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (this.preview.width !== bw || this.preview.height !== bh) {
      this.preview.width = bw;
      this.preview.height = bh;
    }
    const g = this.preview.getContext("2d");
    if (g) g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  private renderPreview(): void {
    const g = this.preview.getContext("2d");
    if (!g) return;
    const { w, h } = this.sizePreview();
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
    // The figure, at whatever facing the player has turned it to. Scaled to the
    // box it is actually in — the figure is ~31 base units tall, so this fills
    // about three-quarters of the height whatever the layout does.
    // `withDefaults` guards a draft missing a field the renderer expects.
    const fs = Math.min(h / 42, w / 26);
    drawAvatar(
      g, w / 2, h / 2 + fs * 6, fs, withDefaults(this.draft),
      { now: t, moving: this.walking, facing: this.facing },
      this.opts.gear ?? {},
    );
    // soft vignette frame
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.36, w / 2, h / 2, h * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(6,8,12,0.55)");
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
  }

  private close(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    if (this.checkTimer) { clearTimeout(this.checkTimer); this.checkTimer = 0; }
    this.checkSeq++; // drop any pending availability check
    this.backdrop.remove();
  }
}
