/**
 * src/client/prompt.ts
 * --------------------
 * Themed in-game replacements for window.prompt(): a small dialog in the
 * game's own type and buttons, promise-based so callers just await the answer.
 * Native OS prompts are jarring, unstylable, and unreliable in some mobile
 * webviews — nothing in the client should call window.prompt again.
 */

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let openEl: HTMLElement | null = null;

function closePrompt(): void {
  openEl?.remove();
  openEl = null;
}

/** Build the dialog shell (one at a time — a new prompt replaces any open one). */
function build(titleHtml: string, subHtml: string, innerHtml: string): HTMLElement {
  closePrompt();
  const el = document.createElement("div");
  el.className = "prompt-screen";
  el.innerHTML = `
    <div class="prompt-card">
      <div class="prompt-title">${titleHtml}</div>
      ${subHtml ? `<div class="prompt-sub">${subHtml}</div>` : ""}
      ${innerHtml}
      <div class="prompt-btns">
        <button class="prompt-cancel" type="button">Cancel</button>
        <button class="prompt-ok" type="button">OK</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  openEl = el;
  requestAnimationFrame(() => el.classList.add("show"));
  return el;
}

/** Shared wiring: OK / Cancel / backdrop / Enter / Escape, then resolve once. */
function wire<T>(
  el: HTMLElement,
  input: HTMLInputElement,
  submit: () => T | null,
  resolve: (v: T | null) => void,
): void {
  let settled = false;
  const done = (v: T | null): void => {
    if (settled) return;
    settled = true;
    closePrompt();
    resolve(v);
  };
  (el.querySelector(".prompt-ok") as HTMLElement).addEventListener("click", () => done(submit()));
  (el.querySelector(".prompt-cancel") as HTMLElement).addEventListener("click", () => done(null));
  el.addEventListener("pointerdown", (e) => { if (e.target === el) done(null); });
  input.addEventListener("keydown", (e) => {
    e.stopPropagation(); // keystrokes stay in the dialog, not the game
    if (e.key === "Enter") done(submit());
    if (e.key === "Escape") done(null);
  });
  input.focus();
  input.select();
}

/** Ask for an amount (1–max). Resolves the clamped number, or null on cancel /
 *  nonsense. The Max chip fills the whole stack in one tap. */
export function askAmount(title: string, max: number, initial = max): Promise<number | null> {
  return new Promise((resolve) => {
    const el = build(esc(title), `1–${max.toLocaleString()}`, `
      <div class="prompt-amount">
        <input class="prompt-input" type="text" inputmode="numeric" autocomplete="off"
               value="${Math.max(1, Math.min(max, Math.floor(initial)))}" />
        <button class="prompt-max" type="button">Max</button>
      </div>`);
    const input = el.querySelector(".prompt-input") as HTMLInputElement;
    (el.querySelector(".prompt-max") as HTMLElement).addEventListener("click", () => {
      input.value = String(max);
      input.focus();
    });
    wire(el, input, () => {
      const n = Math.floor(Number(input.value) || 0);
      return n > 0 ? Math.min(max, n) : null;
    }, resolve);
  });
}

/** Ask for a short line of text. Resolves the trimmed string (may be empty),
 *  or null on cancel. */
export function askText(title: string, sub: string, initial = "", maxLen = 24): Promise<string | null> {
  return new Promise((resolve) => {
    const el = build(esc(title), esc(sub), `
      <input class="prompt-input prompt-input-text" type="text" autocomplete="off"
             maxlength="${maxLen}" value="${esc(initial)}" />`);
    const input = el.querySelector(".prompt-input") as HTMLInputElement;
    wire(el, input, () => input.value.trim().slice(0, maxLen), resolve);
  });
}
