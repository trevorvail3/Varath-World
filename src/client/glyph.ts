/**
 * src/client/glyph.ts
 * -------------------
 * Procedural UI glyphs — the line-art that replaces every emoji in the chrome
 * (tab rail, skill icons, buffs, factions, achievements, the gold line …). One
 * `iconize()` call maps an emoji to a small inline SVG drawn in the same warm
 * line style as the rest of the game, inheriting its colour from the
 * surrounding text via `currentColor`. Content data keeps its emoji; only the
 * rendering swaps them out, so nothing in the core or content has to change.
 */

const VB = `viewBox="0 0 24 24" class="g-ico" xmlns="http://www.w3.org/2000/svg"`;
// Stroke-based glyph (most icons): inherits colour, no fill.
const line = (inner: string): string =>
  `<svg ${VB} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
// Solid glyph (heart, sparkle, coin …): filled with the text colour.
const solid = (inner: string): string =>
  `<svg ${VB} fill="currentColor" stroke="none">${inner}</svg>`;

// name → SVG. Kept small and recognisable at ~20px.
const GLYPHS: Record<string, string> = {
  pickaxe: line(`<path d="M4 9 Q12 4 20 9"/><line x1="12" y1="7" x2="12" y2="20"/>`),
  hammer: line(`<rect x="5" y="5" width="11" height="5" rx="1"/><path d="M10.5 10 L13 20"/>`),
  pine: line(`<path d="M12 3 L7 11 L17 11 Z"/><path d="M12 8 L6 16 L18 16 Z"/><line x1="12" y1="16" x2="12" y2="21"/>`),
  saw: line(`<path d="M4 17 L14 7 L17 10 L7 20 Z"/><path d="M16 9 L20 5"/>`),
  snare: line(`<path d="M5 12 Q12 6 19 12"/><path d="M5 12 Q12 18 19 12"/><line x1="12" y1="12" x2="12" y2="21"/>`),
  fish: line(`<path d="M3 12 Q9 6 16 12 Q9 18 3 12 Z"/><path d="M16 12 L21 8 M16 12 L21 16"/><circle cx="13" cy="11" r="0.9" fill="currentColor"/>`),
  pot: line(`<path d="M5 12 H19 L18 19 Q18 20 16 20 H8 Q6 20 6 19 Z"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M10 8 Q11 6 10 4 M14 8 Q15 6 14 4"/>`),
  wheat: line(`<line x1="12" y1="21" x2="12" y2="8"/><path d="M12 9 Q9 7 8 10 M12 9 Q15 7 16 10 M12 13 Q9 11 8 14 M12 13 Q15 11 16 14 M12 17 Q9 15 8 18 M12 17 Q15 15 16 18"/>`),
  tent: line(`<path d="M4 19 L12 5 L20 19 Z"/><path d="M12 5 L12 19 M9 19 L12 14 L15 19"/>`),
  flask: line(`<path d="M10 4 H14 M11 4 V10 L6 18 Q6 20 8 20 H16 Q18 20 18 18 L13 10 V4"/><line x1="8.5" y1="15" x2="15.5" y2="15"/>`),
  wall: line(`<rect x="4" y="6" width="16" height="12" rx="1"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="8" y1="12" x2="8" y2="18"/><line x1="16" y1="12" x2="16" y2="18"/>`),
  scissors: line(`<circle cx="7" cy="17" r="2.4"/><circle cx="7" cy="7" r="2.4"/><path d="M9 15.5 L20 5 M9 8.5 L20 19"/>`),
  target: line(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`),
  heart: solid(`<path d="M12 20 Q4 14 4 9 Q4 5 8 5 Q11 5 12 8 Q13 5 16 5 Q20 5 20 9 Q20 14 12 20 Z"/>`),
  swords: line(`<path d="M5 18 L15 8 M15 5 H19 V9 M16 6 L13 9 M11 11 L7 15"/><path d="M19 18 L9 8 M9 5 H5 V9 M8 6 L11 9 M13 11 L17 15"/>`),
  dumbbell: line(`<line x1="7" y1="12" x2="17" y2="12"/><rect x="3" y="8.5" width="3" height="7" rx="1"/><rect x="18" y="8.5" width="3" height="7" rx="1"/>`),
  shield: line(`<path d="M12 3 L19 6 V12 Q19 18 12 21 Q5 18 5 12 V6 Z"/>`),
  bow: line(`<path d="M7 4 Q17 12 7 20"/><line x1="7" y1="4" x2="7" y2="20"/><path d="M7 12 L18 12 M18 12 L15.5 10 M18 12 L15.5 14"/>`),
  backpack: line(`<path d="M5 9 H19 V19 Q19 20 18 20 H6 Q5 20 5 19 Z"/><path d="M8 9 V7 Q8 4 12 4 Q16 4 16 7 V9"/><rect x="9" y="13" width="6" height="5" rx="1"/>`),
  scroll: line(`<path d="M7 4 H17 Q19 4 19 6 V18 Q19 20 17 20 H7 Q5 20 5 18 V6 Q5 4 7 4 Z"/><line x1="8.5" y1="9" x2="15.5" y2="9"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="15" x2="13" y2="15"/>`),
  person: line(`<circle cx="12" cy="8" r="3.5"/><path d="M5 20 Q5 13 12 13 Q19 13 19 20"/>`),
  people: line(`<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19 Q3.5 13 9 13 Q14.5 13 14.5 19"/><path d="M15.5 6 Q19.5 6 19.5 9.5 Q19.5 12 17 13 Q20.5 13.5 20.5 19"/>`),
  clipboard: line(`<rect x="6" y="5" width="12" height="15" rx="1.5"/><rect x="9" y="3.5" width="6" height="3" rx="1"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="14" x2="15" y2="14"/>`),
  banner: line(`<path d="M7 4 H18 L15 9 L18 14 H7 Z"/><line x1="7" y1="4" x2="7" y2="21"/>`),
  paw: solid(`<ellipse cx="12" cy="16" rx="4.2" ry="3.4"/><circle cx="6.5" cy="11" r="1.7"/><circle cx="10" cy="8" r="1.7"/><circle cx="14" cy="8" r="1.7"/><circle cx="17.5" cy="11" r="1.7"/>`),
  trophy: line(`<path d="M8 4 H16 V8 Q16 12 12 12 Q8 12 8 8 Z"/><path d="M8 6 H5 Q5 9 8 9 M16 6 H19 Q19 9 16 9"/><line x1="12" y1="12" x2="12" y2="16"/><path d="M9 19 H15 L14 16 H10 Z"/>`),
  gear: line(`<circle cx="12" cy="12" r="3"/><path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.2 5.2 L7.3 7.3 M16.7 16.7 L18.8 18.8 M18.8 5.2 L16.7 7.3 M7.3 16.7 L5.2 18.8"/>`),
  map: line(`<path d="M4 6 L9 4 L15 6 L20 4 V18 L15 20 L9 18 L4 20 Z"/><line x1="9" y1="4" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="20"/>`),
  coin: line(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>`),
  lock: line(`<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11 V8 Q8.5 4 12 4 Q15.5 4 15.5 8 V11"/>`),
  candle: line(`<rect x="10" y="9" width="4" height="11" rx="1"/><path d="M12 9 Q12 5 12 3.5 Q14.5 6 13 8.2 Q12 9 12 9"/><line x1="8.5" y1="20" x2="15.5" y2="20"/>`),
  feather: line(`<path d="M6 18 Q14 18 18 6 Q9 8 6 18 Z"/><line x1="6" y1="18" x2="11" y2="12"/>`),
  skull: line(`<path d="M6 11 Q6 5 12 5 Q18 5 18 11 Q18 14 16 15 V18 H8 V15 Q6 14 6 11 Z"/><circle cx="9.5" cy="11" r="1.5" fill="currentColor"/><circle cx="14.5" cy="11" r="1.5" fill="currentColor"/>`),
  sparkle: solid(`<path d="M12 3 L13.6 10.4 L21 12 L13.6 13.6 L12 21 L10.4 13.6 L3 12 L10.4 10.4 Z"/>`),
  peak: line(`<path d="M3 19 L9 8 L13 14 L16 9 L21 19 Z"/><path d="M7.5 11 L9 9.5 L10.5 11"/>`),
  question: line(`<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5 Q9.5 6.5 12 6.5 Q14.5 6.5 14.5 9 Q14.5 11 12 12 V14"/><circle cx="12" cy="17" r="0.9" fill="currentColor"/>`),
  boot: line(`<path d="M9 4 L13 4 L13 13 L19 15 Q21 16 21 18 L21 20 L9 20 Z"/><path d="M9 17 H21"/><path d="M3 9 H6 M2 13 H5"/>`),
  globe: line(`<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5"/><line x1="3.5" y1="12" x2="20.5" y2="12"/>`),
  cave: line(`<path d="M3 20 Q3 7 12 7 Q21 7 21 20"/><path d="M8.5 20 Q8.5 13 12 13 Q15.5 13 15.5 20"/>`),
  mist: line(`<path d="M4 8 Q8 6 12 8 T20 8"/><path d="M4 12.5 Q8 10.5 12 12.5 T20 12.5"/><path d="M4 17 Q8 15 12 17 T20 17"/>`),
  flame: line(`<path d="M12 3 Q15 8 13.5 12 Q17 11 15.5 16 Q14.5 20.5 12 20.5 Q9.5 20.5 8.5 16 Q7 11 10.5 12 Q9 8 12 3 Z"/>`),
  wave: line(`<path d="M3 9 Q6 6 9 9 T15 9 T21 9"/><path d="M3 14 Q6 11 9 14 T15 14 T21 14"/><path d="M3 19 Q6 16 9 19 T15 19 T21 19"/>`),
  house: line(`<path d="M4 11 L12 4 L20 11"/><path d="M6.5 10 V20 H17.5 V10"/><rect x="10.5" y="14.5" width="3" height="5.5"/>`),
  castle: line(`<path d="M5 9 V20 H19 V9"/><path d="M5 9 V6 H7 V8 H9 V6 H11 V8 H13 V6 H15 V8 H17 V6 H19 V9"/><path d="M10 20 V15 H14 V20"/>`),
  cape: line(`<path d="M8 4 Q12 7 16 4 L19 20 Q12 16 5 20 Z"/><path d="M8.5 4.5 Q12 9 15.5 4.5"/>`),
  scales: line(`<line x1="12" y1="4" x2="12" y2="20"/><line x1="6" y1="20" x2="18" y2="20"/><line x1="5" y1="7" x2="19" y2="7"/><path d="M5 7 L2.5 13 Q5 15 7.5 13 Z"/><path d="M19 7 L16.5 13 Q19 15 21.5 13 Z"/>`),
  speech: line(`<path d="M4 6 H20 V16 H11 L6 20 V16 H4 Z"/><line x1="7" y1="10" x2="17" y2="10"/><line x1="7" y1="13" x2="14" y2="13"/>`),
  check: line(`<path d="M5 13 L10 18 L19 6"/>`),
  next: line(`<path d="M9 6 L15 12 L9 18"/>`),
  leaf: line(`<path d="M5 19 Q5 7 19 5 Q19 17 7 19 Q6 19 5 19 Z"/><path d="M6 18 Q12 12 17 8"/>`),
  orb: line(`<circle cx="12" cy="11" r="7"/><path d="M8 9 Q10 6 13 6.5" stroke-width="1.2"/><path d="M7 19 H17"/><circle cx="9.5" cy="9" r="1" fill="currentColor" stroke="none"/>`),
  gem: line(`<path d="M6 9 L9 5 H15 L18 9 L12 20 Z"/><path d="M6 9 H18"/><path d="M9 5 L11 9 M15 5 L13 9 M11 9 L12 20 M13 9 L12 20"/>`),
  bone: line(`<path d="M7 17 Q4 17 4 19.5 Q4 22 6.5 22 Q6 19 9 19"/><line x1="8" y1="18.5" x2="16" y2="10.5"/><path d="M17 7 Q20 7 20 4.5 Q20 2 17.5 2 Q18 5 15 5"/>`),
  bolt: solid(`<path d="M13.5 2 L5 13.5 H10.5 L9 22 L19 9.5 H12.5 Z"/>`),
  star: solid(`<path d="M12 2.5 L14.6 8.9 L21.5 9.4 L16.2 13.9 L17.9 20.7 L12 17 L6.1 20.7 L7.8 13.9 L2.5 9.4 L9.4 8.9 Z"/>`),
  eye: line(`<path d="M3 12 Q12 4.5 21 12 Q12 19.5 3 12 Z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`),
  key: line(`<circle cx="7.5" cy="7.5" r="3.5"/><path d="M10 10 L20 20 M16.5 16.5 L19 14 M13.5 13.5 L16 11"/>`),
  door: line(`<path d="M6 20 V5.5 Q6 4 7.5 4 H16.5 Q18 4 18 5.5 V20"/><line x1="4" y1="20" x2="20" y2="20"/><circle cx="15" cy="12.5" r="0.9" fill="currentColor"/>`),
  ghost: line(`<path d="M5 20 V11 Q5 4.5 12 4.5 Q19 4.5 19 11 V20 L16.6 17.9 L14.3 20 L12 17.9 L9.7 20 L7.4 17.9 Z"/><circle cx="9.5" cy="11" r="1.2" fill="currentColor"/><circle cx="14.5" cy="11" r="1.2" fill="currentColor"/>`),
  spider: line(`<circle cx="12" cy="14" r="3.5"/><circle cx="12" cy="8.5" r="2"/><path d="M9 12.5 L4 8.5 M9 14.5 L3.5 14.5 M9.8 16.8 L5.5 21 M15 12.5 L20 8.5 M15 14.5 L20.5 14.5 M14.2 16.8 L18.5 21"/>`),
  scorpion: line(`<path d="M5 14 Q5 17.5 9 17.5 H13.5 Q16.5 17.5 16.5 14.5"/><path d="M16.5 14.5 Q20 13.5 19.5 9.5 Q19.2 7 17.5 6"/><circle cx="17" cy="5.4" r="1" fill="currentColor"/><path d="M5 14 Q2.8 12.5 3.5 9.5 M5 14 Q7.2 12.5 8.5 10"/>`),
  axe: line(`<line x1="6" y1="20" x2="13.5" y2="7.5"/><path d="M11 5.5 Q17 3 19 9 Q14 9.5 12.5 13.5 Q10.6 9.8 11 5.5 Z"/>`),
  medal: line(`<path d="M8 3 L11 10 M16 3 L13 10"/><circle cx="12" cy="15" r="4.5"/><circle cx="12" cy="15" r="1.8"/>`),
  sunrise: line(`<path d="M5.5 16 A6.5 6.5 0 0 1 18.5 16"/><line x1="3" y1="16" x2="21" y2="16"/><path d="M12 4 V6.5 M5.2 7.2 L6.9 8.9 M18.8 7.2 L17.1 8.9"/><line x1="6.5" y1="19.5" x2="17.5" y2="19.5"/>`),
  ban: line(`<circle cx="12" cy="12" r="8"/><line x1="6.4" y1="6.4" x2="17.6" y2="17.6"/>`),
  palm: line(`<path d="M7 12 V6.5 Q7 5 8.2 5 Q9.4 5 9.4 6.5 V10.5 M9.4 10.5 V4.5 Q9.4 3 10.7 3 Q12 3 12 4.5 V10 M12 10 V5 Q12 3.5 13.3 3.5 Q14.6 3.5 14.6 5 V10.5 M14.6 10.5 V6.5 Q14.6 5 15.8 5 Q17 5 17 6.5 V13.5 Q17 20 12 20 Q7 20 7 13.5 Z"/>`),
  vortex: line(`<path d="M12 12 Q13.8 10.4 12.6 8.8 Q11 7 8.8 8.8 Q6.8 11 8.6 13.8 Q11 17 15 15.2 Q18.6 13 17 8.6 Q15.2 4.6 10.5 4.4"/>`),
  blossom: line(`<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="6.2" rx="2.2" ry="3.1"/><ellipse cx="12" cy="6.2" rx="2.2" ry="3.1" transform="rotate(72 12 12)"/><ellipse cx="12" cy="6.2" rx="2.2" ry="3.1" transform="rotate(144 12 12)"/><ellipse cx="12" cy="6.2" rx="2.2" ry="3.1" transform="rotate(216 12 12)"/><ellipse cx="12" cy="6.2" rx="2.2" ry="3.1" transform="rotate(288 12 12)"/>`),
  cherry: line(`<circle cx="8.5" cy="16" r="3.2"/><circle cx="15.5" cy="15" r="3.2"/><path d="M8.5 12.8 Q9.5 8 13.5 5 M15.5 11.8 Q14.5 8 13.5 5 M13.5 5 Q16 3.8 18 5.5"/>`),
  wyrm: line(`<path d="M4 15 Q4 6.5 11.5 6.5 L20 9 L15.5 10.5 Q17.5 12 15.8 13.8 Q13 16.5 9.5 15.2 L7.5 19.5 L5.8 15.6 Q4 15.5 4 15 Z"/><circle cx="12.5" cy="9.5" r="0.9" fill="currentColor"/>`),
  mage: line(`<path d="M12 3 L16 11 H8 Z"/><line x1="6" y1="11" x2="18" y2="11"/><circle cx="12" cy="14" r="2.2"/><path d="M7 20 Q7 16.8 12 16.8 Q17 16.8 17 20"/>`),
  gift: line(`<rect x="5" y="10" width="14" height="10" rx="1"/><line x1="12" y1="10" x2="12" y2="20"/><line x1="4" y1="13" x2="20" y2="13"/><path d="M12 10 Q9 5 6.5 7 Q5 9 12 10 Q15 5 17.5 7 Q19 9 12 10 Z"/>`),
  compass: line(`<circle cx="12" cy="12" r="8.5"/><polygon points="12 7 14 12 12 17 10 12"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>`),
  sign: line(`<rect x="5" y="5" width="14" height="8" rx="1"/><line x1="8" y1="8.5" x2="16" y2="8.5"/><line x1="8" y1="10.8" x2="13" y2="10.8"/><line x1="12" y1="13" x2="12" y2="21"/>`),
  torii: line(`<path d="M3 7 H21 M4 9.5 H20"/><line x1="7" y1="7" x2="7" y2="21"/><line x1="17" y1="7" x2="17" y2="21"/>`),
  die: line(`<rect x="5" y="5" width="14" height="14" rx="2.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/>`),
  marker: line(`<path d="M12 21 Q5 13 5 9 A7 7 0 0 1 19 9 Q19 13 12 21 Z"/><circle cx="12" cy="9" r="2.4"/>`),
};

/** Typographic marks the game uses AS TEXT (ticks, stars, arrows) — they must
 *  pass straight through iconize, never be mistaken for a coloured emoji. */
const TEXT_SYMBOLS = new Set(["★", "☆", "✦", "✧", "✓", "✔", "✗", "✘", "✕", "▶", "◀", "◆", "◈", "●", "○", "♦", "❖"]);

/** True if `s` is a single pictographic emoji (the coloured system kind we never
 *  want rendered raw — as opposed to line symbols like ✓ ✕ ★ ▶ that we keep). */
function isEmoji(s: string): boolean {
  if (TEXT_SYMBOLS.has(s)) return false;
  return /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(s);
}

// Every emoji that ever renders → a glyph name above.
const EMOJI: Record<string, string> = {
  "⛏️": "pickaxe", "🔨": "hammer", "🌲": "pine", "🪚": "saw", "🪤": "snare",
  "🎣": "fish", "🍳": "pot", "🌾": "wheat", "🏕️": "tent", "⚗️": "flask",
  "🏗️": "wall", "✂️": "scissors", "🎯": "target", "❤️": "heart", "⚔️": "swords",
  "💪": "dumbbell", "🛡️": "shield", "🏹": "bow", "🎒": "backpack", "📜": "scroll",
  "👤": "person", "👥": "people", "📋": "clipboard", "🤝": "banner", "🐾": "paw", "🏆": "trophy",
  "⚙️": "gear", "🪙": "coin", "💰": "coin", "✨": "sparkle", "❓": "question",
  "🌱": "wheat", "🛠️": "hammer", "📘": "scroll", "🎓": "trophy", "🏛️": "wall",
  "🗡️": "swords", "💀": "skull", "🧰": "backpack", "👑": "trophy", "🜚": "flask",
  "🏔️": "peak", "⛰️": "peak", "✦": "sparkle", "🦜": "feather", "⚒️": "hammer",
  "🕯️": "candle", "🪶": "feather", "🗺": "map", "🗺️": "map", "🔒": "lock",
  "👟": "boot", "🥾": "boot", "📖": "scroll", "🌿": "leaf", "🍃": "leaf",
  // Region / world icons (diaries, the World tab) + home achievements.
  "🌍": "globe", "🌎": "globe", "🌏": "globe",
  "🕳️": "cave", "🌫️": "mist", "🔥": "flame", "🌊": "wave",
  "🏠": "house", "🏡": "house", "🏰": "castle", "🧥": "cape",
  "⚖️": "scales", "⚖": "scales",
  "💬": "speech", "🗨️": "speech", "💭": "speech",
  // Faith / magic + gems + bones.
  "🔮": "orb", "🌟": "sparkle", "💎": "gem", "🦴": "bone",
  // Chips, perks and shops (spec bar, bounty ledger, unlocks).
  "⚡": "bolt", "🏅": "medal", "🥇": "medal", "🌅": "sunrise",
  "🚫": "ban", "💠": "gem", "⭐": "star", "💯": "star",
  // Creatures + spooks (boss log, achievements, bounty pools).
  "☠️": "skull", "☠": "skull", "👁️": "eye", "👁": "eye", "👻": "ghost",
  "🕷️": "spider", "🕷": "spider", "🕸️": "spider", "🦂": "scorpion",
  "🐺": "paw", "🐕": "paw", "🐆": "paw", "🐻": "paw",
  "🐉": "wyrm", "🐲": "wyrm", "🧙": "mage", "🧑‍🌾": "person",
  // Spells, trails and places.
  "✋": "palm", "🌀": "vortex", "🗝️": "key", "🔑": "key", "🚪": "door",
  "🪓": "axe", "🜛": "flask", "🌄": "peak", "🏙️": "castle",
  // Crops + odds and ends.
  "🌳": "pine", "🌸": "blossom", "🌺": "blossom", "🍒": "cherry", "🖤": "heart",
  // Map + minor UI pictographs (kept out of the raw-emoji net below).
  "🎁": "gift", "🧭": "compass", "🪧": "sign", "⛩️": "torii", "🎲": "die",
  "🧟": "ghost", "👹": "skull", "👺": "skull", "🦁": "paw", "🐍": "wyrm",
  "🐊": "wyrm", "🦎": "wyrm", "🐗": "paw", "🐴": "paw", "🐎": "paw",
  "🦌": "paw", "🐀": "paw", "🐇": "paw", "🦅": "feather", "🦇": "feather",
  "🦀": "scorpion", "🐟": "fish", "🐡": "fish", "🦈": "fish",
};

/** A named glyph's SVG (falls back to a neutral dot if unknown). */
export function glyph(name: string): string {
  return GLYPHS[name] ?? GLYPHS.question!;
}

/**
 * Swap an emoji for its line-art glyph. If `s` isn't a known emoji it's
 * returned unchanged (so plain text and symbols like ✓ ▶ pass straight
 * through). Strips the VS16 selector so "⛏️" and "⛏" both match.
 */
export function iconize(s: string): string {
  const key = s.trim();
  const name = EMOJI[key] ?? EMOJI[key.replace(/️/g, "")];
  if (name) return glyph(name);
  // No raw coloured emoji ever reaches the UI: an unmapped pictograph falls back
  // to a neutral line marker instead of a system emoji. Plain text and line
  // symbols (✓ ✕ ★ ▶) pass straight through unchanged.
  return isEmoji(key) ? glyph("marker") : s;
}
