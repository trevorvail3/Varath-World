/**
 * src/client/audio.ts
 * -------------------
 * Procedural audio for Varath, synthesized with the Web Audio API. Nothing is
 * loaded or licensed — every sound is generated from oscillators and noise,
 * matching the game's procedural art. Four layers, on three buses:
 *
 *   1. SFX — a distinct short sound for every activity and event: the axe has
 *      a bite, the pick a ring, the anvil a clang, the line a splash, the
 *      cauldron a glug. All run through a long reverb so they share one space.
 *   2. AMBIENCE — each region plays its own generated soundscape (city fountain
 *      and crowd murmur, forest birdsong and owls, the Spine's howling wind,
 *      cave drips in the Marrow, geothermal bubbling on the Ashfen, moor frogs,
 *      river rush and gulls on the Redrun), crossfaded as you cross a border,
 *      muffled when you step indoors, and shifting with the day/night cycle.
 *   3. MUSIC — a composed theme (the "Varath motif": slow aeolian pads with a
 *      bell melody) that plays over the login / character screens and hands
 *      off to the world's ambience when you enter the game.
 *
 * Resilience (the autoplay policy is what usually breaks browser audio):
 *   - The AudioContext is created + resumed ONLY on the first real user gesture
 *     (browsers suspend audio until then). Until unlocked, every call no-ops.
 *   - Every Web Audio call is wrapped so a failure can never throw into the
 *     game loop or the render frame.
 *   - Volume / mute persist in localStorage and apply to one master gain.
 */

const VOL_KEY = "varath-audio-vol";
const MUTE_KEY = "varath-audio-mute";
const readVol = (): number => {
  // Number(null) is 0 — a missing key must fall to the default, not silence.
  const raw = localStorage.getItem(VOL_KEY);
  if (raw === null || raw === "") return 0.45;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.45;
};
const readMute = (): boolean => localStorage.getItem(MUTE_KEY) === "1";
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Mirrors render.ts's day cycle so the soundscape agrees with the sky. */
const DAY_CYCLE_MS = 420000;
/** 0 by day … 1 at midnight (same curve the renderer's veil uses). */
const nightNow = (): number => {
  const phase = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  return Math.max(0, -Math.sin(phase * Math.PI * 2 - Math.PI / 2));
};

export type Sfx =
  // combat
  | "hit" | "miss" | "bow" | "magic" | "kill" | "hurt" | "death"
  // skilling — one voice per trade
  | "chop" | "mine" | "splash" | "sizzle" | "smith" | "craft" | "brew"
  | "dig" | "vault" | "pray" | "rustle" | "gather"
  // moments
  | "levelup" | "quest" | "achieve" | "teleport"
  // items + shops
  | "pickup" | "heal" | "drink" | "coin" | "bank"
  // interface
  | "ui" | "open";

/** Where the player is standing, for the ambient scene (render.ts's Biome +
 *  "menu" for the title screens). */
export type SceneKey =
  | "hills" | "city" | "greyoak" | "spine" | "marrow"
  | "ashfen" | "heartmoor" | "redrun" | "menu";

/** A monster's vocal cords. The client maps each monster to one of these
 *  families; the engine gives the family an aggro snarl, an attack voice,
 *  and a death cry — so a wolf sounds nothing like a wraith. */
export type CreatureVoice =
  | "wolf" | "boar" | "bear" | "cat" | "small" | "insect" | "serpent"
  | "undead" | "brute" | "human" | "orc" | "dragon";

interface ToneOpts {
  f0: number; f1?: number; type?: OscillatorType; dur: number; peak: number;
  lp?: number; wet?: boolean; delay?: number; bus?: GainNode | null;
}
interface NoiseOpts {
  dur: number; peak: number; lp?: number; hp?: number; wet?: boolean;
  delay?: number; bus?: GainNode | null;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambBus: GainNode | null = null;   // scene layers (pre-muffle)
  private ambFilter: BiquadFilterNode | null = null; // indoor muffle
  private musBus: GainNode | null = null;
  private reverbIn: ConvolverNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private scene: { key: SceneKey; stop(): void } | null = null;
  private sceneTimers: number[] = [];
  private themeTimer: number | null = null;
  private themePlaying = false;
  private bossTimer: number | null = null;
  private bossActive = false;

  private mode: "menu" | "world" = "menu";
  private worldScene: SceneKey = "hills";
  private indoor = false;

  private volume = 0.45;
  private muted = false;
  private unlocked = false;
  private gestures: (() => void) | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    try { this.volume = readVol(); this.muted = readMute(); } catch { /* ignore */ }
    // Arm the autoplay unlock: the first gesture anywhere creates the context.
    const onGesture = (): void => this.unlock();
    this.gestures = onGesture;
    for (const e of ["pointerdown", "keydown", "touchstart"] as const) {
      window.addEventListener(e, onGesture);
    }
  }

  // --- lifecycle ------------------------------------------------------------
  /** Create + resume the context on a user gesture, then start the soundscape. */
  unlock(): void {
    try {
      if (!this.ctx) this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.unlocked = true;
      if (!this.muted) this.startSoundscape();
      if (this.gestures) {
        for (const e of ["pointerdown", "keydown", "touchstart"] as const) {
          window.removeEventListener(e, this.gestures);
        }
        this.gestures = null;
      }
    } catch { /* audio unavailable — stay silent */ }
  }

  private init(): void {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    // A gentle safety compressor between the mix and the speakers: the hotter
    // music/ambience levels stay clean even when a fanfare lands on a drum hit.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.24;
    this.master.connect(comp).connect(ctx.destination);
    // Long, dark reverb send: a decaying noise impulse so everything echoes as
    // if in one big space.
    this.reverbIn = ctx.createConvolver();
    this.reverbIn.buffer = this.makeImpulse(2.6, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.85;
    this.reverbIn.connect(wet).connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    // Buses: effects at full, ambience through the indoor-muffle filter, music
    // a touch under the effects so a fanfare still cuts through the theme.
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 1.0; this.sfxBus.connect(this.master);
    this.ambFilter = ctx.createBiquadFilter();
    this.ambFilter.type = "lowpass"; this.ambFilter.frequency.value = 20000;
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.8;
    this.ambBus.connect(this.ambFilter).connect(this.master);
    this.musBus = ctx.createGain(); this.musBus.gain.value = 1.7; this.musBus.connect(this.master);
  }

  private makeNoise(sec: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 1234567;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
    return buf;
  }
  private makeImpulse(sec: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    let s = 99;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        d[i] = ((s / 0x3fffffff) - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // --- synthesis primitives -------------------------------------------------
  private tone(o: ToneOpts): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    let node: AudioNode = osc;
    if (o.lp != null) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; osc.connect(f); node = f; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    node.connect(g); g.connect(o.bus === undefined ? this.sfxBus ?? this.master : o.bus ?? this.master);
    if (o.wet && this.reverbIn) g.connect(this.reverbIn);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  /** A musical note: soft attack, longer body — for pads and the bell melody. */
  private note(o: { f: number; type?: OscillatorType; dur: number; peak: number; delay: number; attack?: number; wet?: boolean }): void {
    if (!this.ctx || !this.musBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + o.delay;
    const atk = o.attack ?? 0.02;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.f, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(this.musBus);
    if (o.wet !== false && this.reverbIn) g.connect(this.reverbIn);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  private noise(o: NoiseOpts): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    let node: AudioNode = src;
    if (o.hp != null) { const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = o.hp; src.connect(f); node = f; }
    if (o.lp != null) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; node.connect(f); node = f; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    node.connect(g); g.connect(o.bus === undefined ? this.sfxBus ?? this.master : o.bus ?? this.master);
    if (o.wet && this.reverbIn) g.connect(this.reverbIn);
    src.start(t); src.stop(t + o.dur + 0.02);
  }

  // --- the SFX --------------------------------------------------------------
  play(id: Sfx): void {
    if (!this.unlocked || this.muted || !this.ctx) return;
    try {
      switch (id) {
        // ---- combat ----
        case "hit": // a dull, heavy blade/club thud
          this.noise({ dur: 0.14, peak: 0.45, hp: 220, lp: 1100, wet: true });
          this.tone({ f0: 120, f1: 58, type: "sine", dur: 0.18, peak: 0.5, wet: true });
          break;
        case "miss": // an airy swish past
          this.noise({ dur: 0.2, peak: 0.18, hp: 900, lp: 3000, wet: true });
          this.tone({ f0: 500, f1: 320, type: "sine", dur: 0.14, peak: 0.05, wet: true });
          break;
        case "bow": // a low loosing twang
          this.tone({ f0: 640, f1: 170, type: "triangle", dur: 0.18, peak: 0.28, wet: true });
          this.noise({ dur: 0.05, peak: 0.08, hp: 1600 });
          break;
        case "magic": // an arcane bolt: a falling zap under a rising shimmer
          this.tone({ f0: 880, f1: 160, type: "sawtooth", dur: 0.2, peak: 0.26, lp: 2400, wet: true });
          this.tone({ f0: 1320, f1: 2200, type: "sine", dur: 0.14, peak: 0.1, wet: true });
          break;
        case "kill": // a descending groan + thud
          this.tone({ f0: 150, f1: 46, type: "sawtooth", dur: 0.5, peak: 0.4, lp: 800, wet: true });
          this.noise({ dur: 0.22, peak: 0.32, lp: 650, wet: true });
          break;
        case "hurt": // a low dissonant jolt
          this.tone({ f0: 138, f1: 92, type: "sawtooth", dur: 0.22, peak: 0.38, lp: 700, wet: true });
          break;
        case "death": // a long, sinking drone sting
          this.tone({ f0: 180, f1: 38, type: "sawtooth", dur: 1.8, peak: 0.4, lp: 600, wet: true });
          this.tone({ f0: 184, f1: 41, type: "sine", dur: 1.8, peak: 0.2, wet: true });
          break;

        // ---- skilling: one voice per trade ----
        case "chop": // an axe biting wood: a sharp tick into a thock + woody knock
          this.noise({ dur: 0.02, peak: 0.22, hp: 2000 });
          this.noise({ dur: 0.09, peak: 0.42, hp: 150, lp: 900 });
          this.tone({ f0: 240, f1: 90, type: "sine", dur: 0.1, peak: 0.32 });
          this.tone({ f0: 480, f1: 300, type: "triangle", dur: 0.07, peak: 0.16, delay: 0.01 });
          break;
        case "mine": // a pick on stone: a bright tink over a low thud
          this.tone({ f0: 2400, f1: 1900, type: "square", dur: 0.06, peak: 0.13, wet: true });
          this.tone({ f0: 3170, f1: 2600, type: "sine", dur: 0.08, peak: 0.05, wet: true });
          this.noise({ dur: 0.05, peak: 0.16, hp: 2400 });
          this.tone({ f0: 160, f1: 80, type: "sine", dur: 0.1, peak: 0.28 });
          break;
        case "splash": // water taking something: a plip + spray + late droplet
          this.tone({ f0: 620, f1: 160, type: "sine", dur: 0.12, peak: 0.24, wet: true });
          this.noise({ dur: 0.24, peak: 0.18, hp: 500, lp: 2200, wet: true });
          this.tone({ f0: 900, f1: 320, type: "sine", dur: 0.07, peak: 0.09, wet: true, delay: 0.16 });
          break;
        case "sizzle": // fat on a hot pan: a wash with crackles riding it
          this.noise({ dur: 0.45, peak: 0.14, hp: 3400 });
          this.noise({ dur: 0.03, peak: 0.1, hp: 4500, delay: 0.09 });
          this.noise({ dur: 0.03, peak: 0.09, hp: 5000, delay: 0.21 });
          this.noise({ dur: 0.16, peak: 0.09, hp: 2400, delay: 0.3 });
          break;
        case "smith": // the anvil: a hard strike into a long metallic ring
          this.noise({ dur: 0.018, peak: 0.3, hp: 1500 });
          this.tone({ f0: 1250, type: "triangle", dur: 0.4, peak: 0.24, wet: true });
          this.tone({ f0: 1875, type: "sine", dur: 0.3, peak: 0.1, wet: true });
          this.noise({ dur: 0.04, peak: 0.18, hp: 2000 });
          this.tone({ f0: 240, f1: 170, type: "sine", dur: 0.12, peak: 0.26 });
          break;
        case "craft": // two solid wooden knocks at the bench
          this.tone({ f0: 330, f1: 250, type: "triangle", dur: 0.07, peak: 0.3 });
          this.noise({ dur: 0.05, peak: 0.18, lp: 900 });
          this.tone({ f0: 290, f1: 220, type: "triangle", dur: 0.07, peak: 0.24, delay: 0.1 });
          this.noise({ dur: 0.04, peak: 0.12, lp: 800, delay: 0.1 });
          break;
        case "brew": // rising glugs out of the cauldron
          this.tone({ f0: 130, f1: 240, type: "sine", dur: 0.1, peak: 0.28 });
          this.tone({ f0: 160, f1: 300, type: "sine", dur: 0.1, peak: 0.24, delay: 0.12 });
          this.tone({ f0: 200, f1: 380, type: "sine", dur: 0.09, peak: 0.2, delay: 0.24 });
          this.noise({ dur: 0.06, peak: 0.05, hp: 900, lp: 2600, delay: 0.3 });
          break;
        case "dig": // a spade of soil: the cut, then the scatter
          this.noise({ dur: 0.14, peak: 0.34, lp: 500 });
          this.tone({ f0: 130, f1: 70, type: "sine", dur: 0.1, peak: 0.26 });
          this.noise({ dur: 0.1, peak: 0.1, lp: 900, delay: 0.12 });
          break;
        case "vault": // an airy pass over an obstacle: rising, then landing
          this.noise({ dur: 0.3, peak: 0.2, hp: 700, lp: 2600, wet: true });
          this.tone({ f0: 280, f1: 560, type: "sine", dur: 0.22, peak: 0.07, wet: true });
          this.noise({ dur: 0.06, peak: 0.14, lp: 700, delay: 0.28 });
          break;
        case "pray": // a soft devotional chime
          this.tone({ f0: 660, type: "sine", dur: 0.5, peak: 0.1, wet: true });
          this.tone({ f0: 990, type: "sine", dur: 0.4, peak: 0.05, wet: true, delay: 0.06 });
          break;
        case "rustle": // leaves / undergrowth giving something up
          this.noise({ dur: 0.1, peak: 0.2, hp: 1000, lp: 4200 });
          this.noise({ dur: 0.16, peak: 0.16, hp: 1200, lp: 3800, delay: 0.09 });
          this.noise({ dur: 0.08, peak: 0.1, hp: 1400, lp: 3600, delay: 0.22 });
          break;
        case "gather": // the neutral soft tick (fallback for unmapped skills)
          this.noise({ dur: 0.05, peak: 0.16, hp: 300, lp: 1000 });
          this.tone({ f0: 170, f1: 110, type: "sine", dur: 0.08, peak: 0.16, lp: 500 });
          break;

        // ---- moments ----
        case "levelup": { // a dark but rewarding swell (low fifth → octave)
          this.tone({ f0: 110, type: "triangle", dur: 0.6, peak: 0.22, wet: true });
          this.tone({ f0: 164.81, type: "triangle", dur: 0.6, peak: 0.2, wet: true, delay: 0.1 });
          this.tone({ f0: 220, type: "triangle", dur: 0.8, peak: 0.22, wet: true, delay: 0.22 });
          break;
        }
        case "quest": { // a real jingle: a rising minor arpeggio landing home
          const notes: [number, number][] = [[440, 0], [523.25, 0.14], [659.25, 0.28], [880, 0.44]];
          for (const [f, d] of notes) this.tone({ f0: f, type: "triangle", dur: 0.5, peak: 0.17, wet: true, delay: d });
          this.tone({ f0: 220, type: "sine", dur: 1.1, peak: 0.15, wet: true, delay: 0.44 });
          this.tone({ f0: 329.63, type: "sine", dur: 1.0, peak: 0.08, wet: true, delay: 0.5 });
          break;
        }
        case "achieve": // a bright two-note chime
          this.tone({ f0: 784, type: "sine", dur: 0.3, peak: 0.14, wet: true });
          this.tone({ f0: 1046.5, type: "sine", dur: 0.5, peak: 0.12, wet: true, delay: 0.12 });
          break;
        case "teleport": // the waystone: a rising sweep into shimmer
          this.tone({ f0: 220, f1: 880, type: "sine", dur: 0.5, peak: 0.16, wet: true });
          this.noise({ dur: 0.5, peak: 0.06, hp: 1200, lp: 5000, wet: true });
          this.tone({ f0: 1320, type: "sine", dur: 0.35, peak: 0.06, wet: true, delay: 0.3 });
          break;

        // ---- items + shops ----
        case "pickup": // a soft two-note blip
          this.tone({ f0: 430, type: "sine", dur: 0.07, peak: 0.2 });
          this.tone({ f0: 660, type: "sine", dur: 0.09, peak: 0.2, delay: 0.06 });
          break;
        case "heal": // a soft rising glow
          this.tone({ f0: 320, f1: 520, type: "sine", dur: 0.3, peak: 0.14, wet: true });
          break;
        case "drink": // two descending glugs
          this.tone({ f0: 260, f1: 140, type: "sine", dur: 0.11, peak: 0.2 });
          this.tone({ f0: 200, f1: 120, type: "sine", dur: 0.12, peak: 0.18, delay: 0.13 });
          break;
        case "coin": // a coin dropped on the counter: metal partials, two bounces
          this.tone({ f0: 2093, type: "triangle", dur: 0.09, peak: 0.14 });
          this.tone({ f0: 3311, type: "sine", dur: 0.07, peak: 0.07 });
          this.tone({ f0: 2637, type: "triangle", dur: 0.08, peak: 0.11, delay: 0.08 });
          this.tone({ f0: 4200, type: "sine", dur: 0.05, peak: 0.045, delay: 0.08 });
          break;
        case "bank": // a heavy chest: thud, then the latch
          this.noise({ dur: 0.18, peak: 0.28, lp: 420, wet: true });
          this.tone({ f0: 95, f1: 60, type: "sine", dur: 0.22, peak: 0.3 });
          this.noise({ dur: 0.03, peak: 0.1, hp: 1800, delay: 0.16 });
          break;

        // ---- interface ----
        case "ui": // a tiny soft click
          this.tone({ f0: 420, type: "sine", dur: 0.045, peak: 0.11 });
          this.tone({ f0: 630, type: "sine", dur: 0.03, peak: 0.04 });
          break;
        case "open": // a soft whoosh as a panel slides open
          this.noise({ dur: 0.16, peak: 0.11, hp: 500, lp: 2400 });
          this.tone({ f0: 300, f1: 440, type: "sine", dur: 0.12, peak: 0.08 });
          break;
      }
    } catch { /* never let audio break the frame */ }
  }

  // --- ambience: per-region generated soundscapes -----------------------------
  /** Track a scene timer so scene teardown can cancel it. */
  private after(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      const i = this.sceneTimers.indexOf(id);
      if (i >= 0) this.sceneTimers.splice(i, 1);
      fn();
    }, ms);
    this.sceneTimers.push(id);
  }
  /** A repeating randomized scene event: fires, then re-arms itself. */
  private every(minMs: number, maxMs: number, fire: () => void): void {
    const arm = (): void => this.after(minMs + Math.random() * (maxMs - minMs), () => {
      if (!this.muted) { try { fire(); } catch { /* */ } }
      arm();
    });
    arm();
  }
  /** A continuous filtered-noise bed (wind, water, hiss) with a slow LFO wobble. */
  private noiseBed(bus: GainNode, o: { hp?: number; lp: number; gain: number; lfoHz?: number; lfoDepth?: number; lfoTarget?: "gain" | "filter" }): { stop(t: number): void }[] {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    let node: AudioNode = src;
    if (o.hp != null) { const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = o.hp; src.connect(f); node = f; }
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = o.lp;
    node.connect(lp);
    const g = ctx.createGain(); g.gain.value = o.gain;
    lp.connect(g).connect(bus);
    const nodes: { stop(t: number): void }[] = [src];
    if (o.lfoHz) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = o.lfoHz;
      const lg = ctx.createGain();
      if (o.lfoTarget === "filter") { lg.gain.value = o.lfoDepth ?? o.lp * 0.4; lfo.connect(lg).connect(lp.frequency); }
      else { lg.gain.value = (o.lfoDepth ?? 0.4) * o.gain; lfo.connect(lg).connect(g.gain); }
      lfo.start(); nodes.push(lfo);
    }
    src.start();
    return nodes;
  }
  /** A sustained tonal voice for scene drones. */
  private droneVoice(bus: GainNode, f: number, type: OscillatorType, gain: number): { stop(t: number): void }[] {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = gain;
    o.connect(g).connect(bus);
    o.start();
    return [o];
  }

  /** Small melodic/animal one-shots the scenes schedule (all through ambBus). */
  private birdChirp(): void {
    const base = 2200 + Math.random() * 1400;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      this.tone({ f0: base + Math.random() * 300, f1: base * 0.72, type: "sine", dur: 0.08, peak: 0.045, delay: i * 0.12, wet: true, bus: this.ambBus });
    }
  }
  private owlHoot(): void {
    this.tone({ f0: 340, f1: 300, type: "sine", dur: 0.35, peak: 0.06, lp: 700, wet: true, bus: this.ambBus });
    this.tone({ f0: 320, f1: 285, type: "sine", dur: 0.5, peak: 0.055, lp: 700, wet: true, delay: 0.45, bus: this.ambBus });
  }
  private cricket(): void {
    for (let i = 0; i < 4; i++) {
      this.tone({ f0: 4200, type: "sine", dur: 0.03, peak: 0.02, delay: i * 0.07, bus: this.ambBus });
    }
  }
  private caveDrip(): void {
    this.tone({ f0: 1900, f1: 800, type: "sine", dur: 0.09, peak: 0.06, wet: true, bus: this.ambBus });
  }
  private bubble(): void {
    this.tone({ f0: 90 + Math.random() * 60, f1: 220 + Math.random() * 120, type: "sine", dur: 0.1, peak: 0.07, bus: this.ambBus });
  }
  private frogCroak(): void {
    this.tone({ f0: 110, f1: 90, type: "sawtooth", dur: 0.09, peak: 0.05, lp: 500, bus: this.ambBus });
    this.tone({ f0: 115, f1: 95, type: "sawtooth", dur: 0.11, peak: 0.045, lp: 500, delay: 0.14, bus: this.ambBus });
  }
  private gullMewl(): void {
    this.tone({ f0: 1250, f1: 720, type: "sawtooth", dur: 0.35, peak: 0.028, lp: 2200, wet: true, bus: this.ambBus });
  }
  private woodpecker(): void { // a dry knocking burst off a far trunk
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.noise({ dur: 0.02, peak: 0.05, hp: 900, lp: 2400, delay: i * 0.07, wet: true, bus: this.ambBus });
  }
  private squirrelChitter(): void { // quick falling chirps in the canopy
    for (let i = 0; i < 4; i++) {
      this.tone({ f0: 3200 - i * 350, f1: 2300 - i * 300, type: "sine", dur: 0.05, peak: 0.03, delay: i * 0.09, bus: this.ambBus });
    }
  }
  private distantHowl(): void { // a far wolf, rising then falling on the wind
    this.tone({ f0: 320, f1: 520, type: "sine", dur: 0.9, peak: 0.035, lp: 900, wet: true, bus: this.ambBus });
    this.tone({ f0: 520, f1: 300, type: "sine", dur: 1.1, peak: 0.03, lp: 900, wet: true, delay: 0.85, bus: this.ambBus });
  }
  private cicadaShimmer(): void { // a hot-afternoon pulse train
    for (let i = 0; i < 14; i++) this.tone({ f0: 4600, type: "sine", dur: 0.03, peak: 0.014, delay: i * 0.06, bus: this.ambBus });
  }
  private ravenCaw(): void { // two harsh caws off the flats
    this.tone({ f0: 950, f1: 620, type: "sawtooth", dur: 0.16, peak: 0.03, lp: 1800, wet: true, bus: this.ambBus });
    this.tone({ f0: 900, f1: 580, type: "sawtooth", dur: 0.18, peak: 0.026, lp: 1800, wet: true, delay: 0.3, bus: this.ambBus });
  }
  private batFlutter(): void { // leathery wingbeats crossing the dark
    for (let i = 0; i < 6; i++) this.noise({ dur: 0.03, peak: 0.035, hp: 600, lp: 2000, delay: i * 0.08, bus: this.ambBus });
  }
  private fishJump(): void { // something breaks the surface, then the plip
    this.tone({ f0: 700, f1: 250, type: "sine", dur: 0.08, peak: 0.04, wet: true, bus: this.ambBus });
    this.noise({ dur: 0.14, peak: 0.035, hp: 600, lp: 2400, delay: 0.03, wet: true, bus: this.ambBus });
  }
  private cityHammer(): void { // a smith at work somewhere across the roofs
    for (let i = 0; i < 3; i++) this.tone({ f0: 1250, type: "triangle", dur: 0.12, peak: 0.022, wet: true, delay: i * 0.5, bus: this.ambBus });
  }
  private distantToll(): void {
    this.tone({ f0: 49, f1: 41, type: "sine", dur: 3.2, peak: 0.16, lp: 320, wet: true, bus: this.ambBus });
    this.tone({ f0: 73.5, type: "sine", dur: 2.6, peak: 0.06, lp: 400, wet: true, bus: this.ambBus });
  }

  /** Build and start the ambient scene for a region. Returns its teardown. */
  private buildScene(key: SceneKey): { key: SceneKey; stop(): void } {
    const ctx = this.ctx!;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.ambBus!);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5); // crossfade in
    const nodes: { stop(t: number): void }[] = [];
    const bed = (o: Parameters<AudioManager["noiseBed"]>[1]): void => { nodes.push(...this.noiseBed(bus, o)); };
    const drone = (f: number, t: OscillatorType, g: number): void => { nodes.push(...this.droneVoice(bus, f, t, g)); };
    const day = (): boolean => nightNow() < 0.25;

    switch (key) {
      case "city": // the fountain's steady water, a low crowd murmur, a far bell
        bed({ hp: 700, lp: 2000, gain: 0.028, lfoHz: 0.3, lfoDepth: 0.25 });   // fountain spray
        bed({ lp: 320, gain: 0.05, lfoHz: 0.11, lfoDepth: 0.5 });               // crowd murmur
        this.every(24000, 50000, () => this.distantToll());
        this.every(14000, 34000, () => { if (day()) this.cityHammer(); });      // a far smithy
        break;
      case "greyoak": // deep forest: leaf wind, dense day birdsong, night owls
        bed({ hp: 250, lp: 1500, gain: 0.05, lfoHz: 0.16, lfoDepth: 0.55 });    // canopy wind
        this.every(2500, 7000, () => { if (day()) this.birdChirp(); });
        this.every(8000, 20000, () => { if (day()) this.woodpecker(); });
        this.every(10000, 26000, () => { if (day()) this.squirrelChitter(); });
        this.every(9000, 22000, () => { if (!day()) this.owlHoot(); });
        this.every(3000, 8000, () => { if (!day()) this.cricket(); });
        this.every(30000, 80000, () => { if (!day()) this.distantHowl(); });    // the wood has teeth
        break;
      case "spine": // the high pass: a howling, sweeping wind and little else
        bed({ hp: 150, lp: 900, gain: 0.085, lfoHz: 0.07, lfoDepth: 500, lfoTarget: "filter" });
        bed({ hp: 400, lp: 2400, gain: 0.02, lfoHz: 0.13, lfoDepth: 0.7 });     // gusting top layer
        break;
      case "marrow": { // the deeps: the old dark drone + echoing drips + bats
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 380; lp.Q.value = 1.2;
        lp.connect(bus);
        for (const [f, t, g] of [[55, "sine", 0.05], [55.3, "sine", 0.05], [82.41, "sine", 0.025]] as [number, OscillatorType, number][]) {
          const o = ctx.createOscillator(); o.type = t; o.frequency.value = f;
          const og = ctx.createGain(); og.gain.value = g;
          o.connect(og).connect(lp); o.start(); nodes.push(o);
        }
        this.every(2200, 7000, () => this.caveDrip());
        this.every(12000, 30000, () => this.batFlutter());
        break;
      }
      case "ashfen": // geothermal flats: steam hiss + mud bubbling + carrion birds
        bed({ hp: 3000, lp: 8000, gain: 0.016, lfoHz: 0.2, lfoDepth: 0.5 });    // steam vents
        bed({ lp: 260, gain: 0.035, lfoHz: 0.09, lfoDepth: 0.4 });               // deep heat rumble
        this.every(700, 2600, () => this.bubble());
        this.every(14000, 36000, () => { if (day()) this.ravenCaw(); });
        break;
      case "heartmoor": // the moor: soggy wind, frogs, cicadas by day, ravens
        bed({ hp: 180, lp: 1100, gain: 0.04, lfoHz: 0.12, lfoDepth: 0.5 });
        this.every(3000, 9000, () => this.frogCroak());
        this.every(9000, 24000, () => { if (day()) this.cicadaShimmer(); });
        this.every(16000, 40000, () => { if (day()) this.ravenCaw(); });
        this.every(2500, 6000, () => { if (!day()) this.cricket(); });
        break;
      case "redrun": // the river country: steady rush, gulls, the odd jumping fish
        bed({ hp: 350, lp: 1600, gain: 0.05, lfoHz: 0.18, lfoDepth: 0.3 });     // river rush
        this.every(9000, 26000, () => { if (day()) this.gullMewl(); });
        this.every(11000, 30000, () => this.fishJump());
        this.every(4000, 10000, () => { if (!day()) this.cricket(); });
        break;
      case "menu": { // under the theme: a thin, mysterious air
        drone(55, "sine", 0.035); drone(55.4, "sine", 0.035);
        bed({ hp: 200, lp: 800, gain: 0.02, lfoHz: 0.06, lfoDepth: 0.5 });
        break;
      }
      case "hills": // the open Knuckle Hills: soft wind, sparse birds, crickets
      default:
        bed({ hp: 200, lp: 1200, gain: 0.038, lfoHz: 0.1, lfoDepth: 0.5 });
        drone(55, "sine", 0.022); drone(55.3, "sine", 0.022);                    // a faint floor
        this.every(5000, 14000, () => { if (day()) this.birdChirp(); });
        this.every(2500, 6000, () => { if (!day()) this.cricket(); });
        this.every(35000, 90000, () => { if (!day()) this.distantHowl(); });
        this.every(30000, 70000, () => this.distantToll());
        break;
    }

    return {
      key,
      stop: () => {
        try {
          bus.gain.cancelScheduledValues(ctx.currentTime);
          bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
          bus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.8);
          for (const n of nodes) { try { n.stop(ctx.currentTime + 2); } catch { /* */ } }
        } catch { /* */ }
      },
    };
  }

  private clearSceneTimers(): void {
    for (const id of this.sceneTimers) { try { window.clearTimeout(id); } catch { /* */ } }
    this.sceneTimers = [];
  }

  /** Swap to a region's soundscape (no-op if it's already playing). Called by
   *  the game loop as the player moves; `indoor` muffles the outside world. */
  setScene(key: SceneKey, indoor = false): void {
    this.worldScene = key;
    if (indoor !== this.indoor) {
      this.indoor = indoor;
      if (this.ctx && this.ambFilter && this.ambBus) {
        const t = this.ctx.currentTime;
        this.ambFilter.frequency.cancelScheduledValues(t);
        this.ambFilter.frequency.setValueAtTime(this.ambFilter.frequency.value, t);
        this.ambFilter.frequency.linearRampToValueAtTime(indoor ? 550 : 20000, t + 0.6);
        this.ambBus.gain.cancelScheduledValues(t);
        this.ambBus.gain.setValueAtTime(this.ambBus.gain.value, t);
        this.ambBus.gain.linearRampToValueAtTime(indoor ? 0.4 : 0.8, t + 0.6);
      }
    }
    if (!this.unlocked || this.muted || this.mode !== "world") return;
    if (this.scene?.key === key) return;
    try {
      this.clearSceneTimers();
      this.scene?.stop();
      this.scene = this.buildScene(key);
    } catch { /* */ }
  }


  // --- creature voices ---------------------------------------------------------
  /** A monster speaks: `aggro` when it turns on you, `attack` as its blow lands,
   *  `die` as it falls. Each family has its own throat. */
  creature(v: CreatureVoice, kind: "aggro" | "attack" | "die"): void {
    if (!this.unlocked || this.muted || !this.ctx) return;
    try {
      const K = kind;
      switch (v) {
        case "wolf":
          if (K === "die") { // a falling whine
            this.tone({ f0: 520, f1: 170, type: "sine", dur: 0.7, peak: 0.14, lp: 1200, wet: true });
            this.tone({ f0: 530, f1: 180, type: "sawtooth", dur: 0.6, peak: 0.05, lp: 900, wet: true });
          } else { // a chesty snarl (aggro longer than the bite)
            const d = K === "aggro" ? 0.5 : 0.22;
            this.tone({ f0: 210, f1: 150, type: "sawtooth", dur: d, peak: 0.16, lp: 650, wet: true });
            this.tone({ f0: 216, f1: 154, type: "sawtooth", dur: d, peak: 0.1, lp: 650 });
            this.noise({ dur: d * 0.7, peak: 0.09, hp: 200, lp: 900 });
          }
          break;
        case "boar":
          if (K === "die") { // the squeal
            this.tone({ f0: 760, f1: 210, type: "sawtooth", dur: 0.55, peak: 0.13, lp: 1600, wet: true });
          } else { // snorting grunts
            this.tone({ f0: 115, f1: 75, type: "sawtooth", dur: 0.12, peak: 0.2, lp: 420 });
            this.noise({ dur: 0.08, peak: 0.12, lp: 500 });
            if (K === "aggro") this.tone({ f0: 120, f1: 78, type: "sawtooth", dur: 0.12, peak: 0.18, lp: 420, delay: 0.16 });
          }
          break;
        case "bear":
        case "cat": {
          const base = v === "cat" ? 200 : 135; // the lion sits higher than the bear
          if (K === "die") {
            this.tone({ f0: base * 1.1, f1: base * 0.45, type: "sawtooth", dur: 0.9, peak: 0.16, lp: 600, wet: true });
            this.noise({ dur: 0.7, peak: 0.08, hp: 100, lp: 600, wet: true });
          } else {
            const d = K === "aggro" ? 0.6 : 0.3;
            this.tone({ f0: base, f1: base * 0.65, type: "sawtooth", dur: d, peak: 0.18, lp: 550, wet: true });
            this.noise({ dur: d, peak: 0.1, hp: 120, lp: 700 });
          }
          break;
        }
        case "small": // rats and bats: squeaks
          if (K === "die") {
            this.tone({ f0: 3000, f1: 700, type: "sine", dur: 0.3, peak: 0.09, wet: true });
          } else {
            this.tone({ f0: 2800, f1: 2000, type: "sine", dur: 0.06, peak: 0.08 });
            this.tone({ f0: 3100, f1: 2200, type: "sine", dur: 0.06, peak: 0.07, delay: 0.08 });
          }
          break;
        case "insect": // crawlers and horrors: dry chittering clicks
          if (K === "die") {
            this.noise({ dur: 0.3, peak: 0.16, lp: 1200, wet: true });
            for (let i = 0; i < 4; i++) this.tone({ f0: 2600 - i * 400, type: "square", dur: 0.02, peak: 0.05, delay: 0.05 + i * 0.07 });
          } else {
            const n = K === "aggro" ? 5 : 3;
            for (let i = 0; i < n; i++) this.noise({ dur: 0.025, peak: 0.09, hp: 3000, delay: i * 0.055 });
            this.tone({ f0: 1900, type: "square", dur: 0.03, peak: 0.04, delay: 0.03 });
          }
          break;
        case "serpent": // hisses (and the river's rattle)
          if (K === "die") {
            this.noise({ dur: 0.6, peak: 0.1, hp: 2200, wet: true });
            this.tone({ f0: 300, f1: 90, type: "sine", dur: 0.5, peak: 0.09, lp: 700, wet: true });
          } else {
            this.noise({ dur: K === "aggro" ? 0.5 : 0.25, peak: 0.11, hp: 2500 });
            if (K === "aggro") for (let i = 0; i < 5; i++) this.noise({ dur: 0.02, peak: 0.06, hp: 4000, delay: 0.1 + i * 0.05 });
          }
          break;
        case "undead": { // wraiths and hollow things: a beating, airless moan
          if (K === "die") {
            this.tone({ f0: 200, f1: 60, type: "sine", dur: 1.4, peak: 0.13, wet: true });
            this.tone({ f0: 204, f1: 62, type: "sine", dur: 1.4, peak: 0.1, wet: true });
            this.noise({ dur: 1.0, peak: 0.05, hp: 400, lp: 1600, wet: true });
          } else {
            const d = K === "aggro" ? 0.9 : 0.45;
            this.tone({ f0: 175, f1: 120, type: "sine", dur: d, peak: 0.12, wet: true });
            this.tone({ f0: 179, f1: 123, type: "sine", dur: d, peak: 0.09, wet: true });
            this.noise({ dur: d * 0.8, peak: 0.04, hp: 500, lp: 1400, wet: true });
          }
          break;
        }
        case "brute": // golems, trolls, keepers: grinding stone
          if (K === "die") { // the collapse — three falling rubble thuds
            for (let i = 0; i < 3; i++) {
              this.noise({ dur: 0.16, peak: 0.24 - i * 0.05, lp: 300, delay: i * 0.16, wet: true });
              this.tone({ f0: 90 - i * 15, f1: 50, type: "sine", dur: 0.18, peak: 0.2, delay: i * 0.16 });
            }
          } else {
            const d = K === "aggro" ? 0.7 : 0.35;
            this.tone({ f0: 68, f1: 46, type: "sawtooth", dur: d, peak: 0.2, lp: 280, wet: true });
            this.noise({ dur: d, peak: 0.12, lp: 260 });
          }
          break;
        case "human": // outlaws, cultists, guards: a fighting shout
          if (K === "die") {
            this.tone({ f0: 340, f1: 140, type: "sawtooth", dur: 0.5, peak: 0.1, lp: 1000, wet: true });
          } else {
            this.tone({ f0: 195, f1: 145, type: "sawtooth", dur: K === "aggro" ? 0.3 : 0.16, peak: 0.11, lp: 800 });
            this.noise({ dur: 0.08, peak: 0.06, lp: 900 });
          }
          break;
        case "orc": // warlords and ancient orcs: a guttural bellow
          if (K === "die") {
            this.tone({ f0: 150, f1: 55, type: "sawtooth", dur: 0.9, peak: 0.18, lp: 500, wet: true });
            this.noise({ dur: 0.5, peak: 0.12, lp: 500 });
          } else {
            const d = K === "aggro" ? 0.55 : 0.28;
            this.tone({ f0: 98, f1: 66, type: "sawtooth", dur: d, peak: 0.2, lp: 480, wet: true });
            this.tone({ f0: 196, f1: 132, type: "sawtooth", dur: d, peak: 0.07, lp: 700 });
          }
          break;
        case "dragon": // the wyrm: a furnace roar
          if (K === "die") {
            this.tone({ f0: 130, f1: 45, type: "sawtooth", dur: 1.6, peak: 0.22, lp: 650, wet: true });
            this.tone({ f0: 62, f1: 38, type: "sine", dur: 1.6, peak: 0.2, wet: true });
            this.noise({ dur: 1.2, peak: 0.14, hp: 120, lp: 900, wet: true });
            this.noise({ dur: 0.25, peak: 0.3, lp: 300, delay: 1.5, wet: true }); // the fall
          } else {
            const d = K === "aggro" ? 1.0 : 0.5;
            this.tone({ f0: 120, f1: 72, type: "sawtooth", dur: d, peak: 0.22, lp: 650, wet: true });
            this.tone({ f0: 58, f1: 42, type: "sine", dur: d, peak: 0.16, wet: true });
            this.noise({ dur: d * 0.9, peak: 0.12, hp: 150, lp: 900 });
          }
          break;
      }
    } catch { /* never let audio break the frame */ }
  }

  // --- boss encounters -----------------------------------------------------------
  /**
   * The boss battle loop: a driving low ostinato over a tritone drone, war-drum
   * hits and a high alarm bell — it starts the moment you engage a named boss
   * and cuts out when the fight ends. ~9.6s pass, re-armed while the fight runs.
   */
  private scheduleBossLoop(): void {
    if (!this.ctx || !this.musBus) return;
    const BEAT = 0.6; // 100bpm
    // Drone: the root and its tritone, breathing underneath the whole pass.
    this.note({ f: 55, type: "sawtooth", dur: 16 * BEAT + 1, peak: 0.05, delay: 0, attack: 0.8 });
    this.note({ f: 77.78, type: "sine", dur: 16 * BEAT + 1, peak: 0.04, delay: 0, attack: 0.8 });
    for (let b = 0; b < 16; b++) {
      const at = b * BEAT;
      // War drums: a deep hit on every other beat, a harder accent to open each half.
      if (b % 2 === 0) {
        this.noise({ dur: 0.12, peak: b % 8 === 0 ? 0.3 : 0.18, lp: 150, delay: at, bus: this.musBus });
        this.tone({ f0: 70, f1: 45, type: "sine", dur: 0.15, peak: b % 8 === 0 ? 0.24 : 0.14, delay: at, bus: this.musBus });
      }
      // The ostinato: eighth-note bass stabs walking the root, with tritone accents.
      if ([0, 3, 6, 8, 11, 14].includes(b)) {
        const f = b === 6 || b === 14 ? 77.78 : 55;
        this.tone({ f0: f * 2, f1: f * 2 * 0.97, type: "sawtooth", dur: 0.22, peak: 0.09, lp: 700, delay: at, bus: this.musBus });
      }
      // A dry metallic tick keeps the pulse between drum hits.
      this.noise({ dur: 0.02, peak: 0.03, hp: 5000, delay: at + BEAT / 2, bus: this.musBus });
    }
    // The alarm: a tritone bell pair late in the pass.
    this.tone({ f0: 880, type: "triangle", dur: 0.5, peak: 0.05, wet: true, delay: 12 * BEAT, bus: this.musBus });
    this.tone({ f0: 622.25, type: "triangle", dur: 0.7, peak: 0.05, wet: true, delay: 13 * BEAT, bus: this.musBus });
    const loopMs = 16 * BEAT * 1000;
    this.bossTimer = window.setTimeout(() => {
      if (this.bossActive && !this.muted) this.scheduleBossLoop();
    }, loopMs - 200);
  }
  /** A named boss turns on you: an engage sting, then the battle loop. */
  bossStart(): void {
    if (this.bossActive) return;
    this.bossActive = true;
    if (!this.unlocked || this.muted || !this.ctx) return;
    try {
      // The sting: a swelling minor-second cluster over a drum hit.
      this.tone({ f0: 220, type: "sawtooth", dur: 1.2, peak: 0.09, lp: 1200, wet: true, bus: this.musBus });
      this.tone({ f0: 233.08, type: "sawtooth", dur: 1.2, peak: 0.09, lp: 1200, wet: true, bus: this.musBus });
      this.tone({ f0: 311.13, type: "sawtooth", dur: 1.1, peak: 0.06, lp: 1400, wet: true, delay: 0.15, bus: this.musBus });
      this.noise({ dur: 0.2, peak: 0.3, lp: 160, bus: this.musBus });
      this.bossTimer = window.setTimeout(() => { if (this.bossActive && !this.muted) this.scheduleBossLoop(); }, 1200);
    } catch { /* */ }
  }
  /** The fight is over. `won` plays the defeat sting; fleeing just cuts the loop. */
  bossEnd(won: boolean): void {
    if (!this.bossActive) return;
    this.bossActive = false;
    if (this.bossTimer !== null) { try { window.clearTimeout(this.bossTimer); } catch { /* */ } this.bossTimer = null; }
    if (!this.unlocked || this.muted || !this.ctx) return;
    try {
      if (won) { // the defeat sting: a great low hit resolving upward into light
        this.noise({ dur: 0.3, peak: 0.34, lp: 200, wet: true, bus: this.musBus });
        this.tone({ f0: 55, f1: 42, type: "sine", dur: 1.2, peak: 0.24, wet: true, bus: this.musBus });
        this.tone({ f0: 110, type: "triangle", dur: 1.4, peak: 0.12, wet: true, delay: 0.5, bus: this.musBus });
        this.tone({ f0: 220, type: "triangle", dur: 1.6, peak: 0.12, wet: true, delay: 0.8, bus: this.musBus });
        this.tone({ f0: 1320, type: "sine", dur: 1.2, peak: 0.05, wet: true, delay: 1.0, bus: this.musBus });
      }
    } catch { /* */ }
  }

  // --- the theme -------------------------------------------------------------
  /**
   * "Varath" — the opening theme. Aeolian pads (Am F C G | Am F Dm Em)
   * under a bell-voiced melody that enters halfway; a distant toll opens each
   * pass. ~40s, loops until the world starts. All synthesized on the spot.
   */
  private scheduleTheme(): void {
    if (!this.ctx || !this.musBus) return;
    const BEAT = 0.62; // ~97bpm — a walking pace; it used to drag at 0.78
    const bar = (n: number): number => n * 4 * BEAT;
    // Chord tones (root/third/fifth around octave 3–4) + bass root.
    const CH: Record<string, { tri: number[]; bass: number }> = {
      Am: { tri: [220, 261.63, 329.63], bass: 110 },
      F:  { tri: [174.61, 220, 261.63], bass: 87.31 },
      C:  { tri: [261.63, 329.63, 392], bass: 130.81 },
      G:  { tri: [246.94, 293.66, 392], bass: 98 },
      Dm: { tri: [146.83, 174.61, 220], bass: 73.42 },
      Em: { tri: [164.81, 196, 246.94], bass: 82.41 },
    };
    const PROG = ["Am", "F", "C", "G", "Am", "F", "Dm", "Em"]; // 2 bars each
    // The identity toll, once, at the top.
    this.tone({ f0: 49, f1: 41, type: "sine", dur: 3.4, peak: 0.2, lp: 320, wet: true, bus: this.musBus });
    // Pads + bass.
    for (let i = 0; i < PROG.length; i++) {
      const c = CH[PROG[i]!]!;
      const at = bar(i * 2);
      for (const f of c.tri) {
        this.note({ f, type: "triangle", dur: bar(2) + 1.2, peak: 0.075, delay: at, attack: 1.4 });
        this.note({ f: f * 0.5, type: "sine", dur: bar(2) + 1.2, peak: 0.05, delay: at, attack: 1.4 });
      }
      for (const b of [0, 2]) { // bass on beats 1 + 3 of each chord's bars
        this.note({ f: c.bass, type: "sine", dur: 1.6, peak: 0.15, delay: at + b * BEAT, attack: 0.03 });
        this.note({ f: c.bass, type: "sine", dur: 1.6, peak: 0.12, delay: at + bar(1) + b * BEAT, attack: 0.03 });
      }
    }
    // The melody (bars 9–16): the Varath motif, bell-voiced (sine + 3rd partial).
    const bell = (f: number, atBeat: number, beats: number, vel = 1): void => {
      const at = bar(8) + atBeat * BEAT;
      this.note({ f, type: "sine", dur: beats * BEAT + 0.9, peak: 0.17 * vel, delay: at, attack: 0.015 });
      this.note({ f: f * 2.0, type: "sine", dur: beats * BEAT * 0.6, peak: 0.024 * vel, delay: at, attack: 0.015 });
      this.note({ f: f * 3.01, type: "sine", dur: beats * BEAT * 0.5, peak: 0.024 * vel, delay: at, attack: 0.015 });
    };
    // over Am
    bell(440, 0, 2); bell(523.25, 2, 1); bell(493.88, 3, 1); bell(659.25, 4, 3, 1.15);
    // over F
    bell(698.46, 8, 2, 1.1); bell(659.25, 10, 1); bell(523.25, 11, 1); bell(587.33, 12, 3);
    // over Dm
    bell(587.33, 16, 2); bell(698.46, 18, 1); bell(659.25, 19, 1); bell(587.33, 20, 1.5); bell(523.25, 21.5, 1.5);
    // over Em — resolve home, with a soft octave halo on the final note
    bell(493.88, 24, 2); bell(523.25, 26, 1); bell(493.88, 27, 1); bell(440, 28, 4, 1.2);
    this.note({ f: 880, type: "sine", dur: 4 * BEAT + 1.5, peak: 0.03, delay: bar(8) + 28 * BEAT, attack: 1.2 });

    // Loop: re-arm just before the pass ends.
    const loopMs = bar(16) * 1000;
    this.themeTimer = window.setTimeout(() => {
      if (this.themePlaying && !this.muted) this.scheduleTheme();
    }, loopMs - 400);
  }
  private startTheme(): void {
    if (this.themePlaying) return;
    this.themePlaying = true;
    try { this.scheduleTheme(); } catch { /* */ }
  }
  private stopTheme(): void {
    this.themePlaying = false;
    if (this.themeTimer !== null) { try { window.clearTimeout(this.themeTimer); } catch { /* */ } this.themeTimer = null; }
    // Let sounding notes ring out under a music-bus fade, then restore the bus.
    if (this.ctx && this.musBus) {
      const t = this.ctx.currentTime;
      this.musBus.gain.cancelScheduledValues(t);
      this.musBus.gain.setValueAtTime(this.musBus.gain.value, t);
      this.musBus.gain.linearRampToValueAtTime(0.0001, t + 2.5);
      const bus = this.musBus;
      window.setTimeout(() => { try { bus.gain.setValueAtTime(1.7, this.ctx!.currentTime); } catch { /* */ } }, 3000);
    }
  }

  // --- modes ------------------------------------------------------------------
  /** "menu" (login/creator: the theme plays) or "world" (region ambience). */
  setMode(mode: "menu" | "world"): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (!this.unlocked || this.muted) return;
    this.startSoundscape();
  }
  private startSoundscape(): void {
    try {
      if (this.mode === "menu") {
        if (this.scene?.key !== "menu") {
          this.clearSceneTimers();
          this.scene?.stop();
          this.scene = this.buildScene("menu");
        }
        this.startTheme();
      } else {
        this.stopTheme();
        if (this.scene?.key !== this.worldScene) {
          this.clearSceneTimers();
          this.scene?.stop();
          this.scene = this.buildScene(this.worldScene);
        }
      }
    } catch { /* */ }
  }
  private stopSoundscape(): void {
    this.stopTheme();
    this.bossEnd(false);
    this.clearSceneTimers();
    if (this.scene) { this.scene.stop(); this.scene = null; }
  }

  // --- settings -------------------------------------------------------------
  /** Whether the browser has allowed audio yet (first user gesture). */
  isUnlocked(): boolean { return this.unlocked; }

  getVolume(): number { return this.volume; }
  setVolume(v: number): void {
    this.volume = clamp01(v);
    try { localStorage.setItem(VOL_KEY, String(this.volume)); } catch { /* */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }
  getMuted(): boolean { return this.muted; }
  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* */ }
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
    if (m) this.stopSoundscape();
    else if (this.unlocked) this.startSoundscape();
  }
}

/** The single shared audio engine for the whole client. */
export const audio = new AudioManager();
