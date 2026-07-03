/**
 * src/client/recordsUI.ts
 * -----------------------
 * The Drowned Pier's records board: the five heaviest catches ever landed off
 * the pier, each with its species, weight, length and the angler's name. Seeded
 * with rival anglers; the player's own catches push them off the bottom. Pure
 * presentation — it just reads `state.player.fishingRecords` (kept sorted by the
 * core) and renders it.
 */

import type { WorldState } from "../core/types.ts";
import { fishBadgeSVG } from "./itemIcon.ts";
import { iconize } from "./glyph.ts";

export class RecordsUI {
  private backdrop: HTMLElement;
  private body: HTMLElement;
  private open = false;

  constructor(root: HTMLElement, private playerName: () => string) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "shop-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="shop-modal records-modal">
        <div class="shop-head">
          <span class="shop-title"><span class="title-ic">${iconize("🏆")}</span> Pier Records</span>
          <button class="shop-close" type="button">✕</button>
        </div>
        <div class="records-sub">The five heaviest off the Drowned Pier.</div>
        <div class="records-body"></div>
      </div>`;
    this.body = this.backdrop.querySelector(".records-body") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".shop-close") as HTMLElement).addEventListener(
      "pointerdown",
      (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(state: WorldState): void {
    this.open = true;
    this.backdrop.classList.remove("hidden");
    this.render(state);
  }

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
  }

  private render(state: WorldState): void {
    const records = state.player.fishingRecords;
    const me = this.playerName();
    this.body.innerHTML = "";
    if (records.length === 0) {
      const empty = document.createElement("div");
      empty.className = "records-empty";
      empty.textContent = "No catches yet. The deep is waiting.";
      this.body.appendChild(empty);
      return;
    }
    records.forEach((r, i) => {
      const row = document.createElement("div");
      const mine = r.angler === me;
      row.className = `records-row${mine ? " records-mine" : ""}`;
      row.innerHTML = `
        <span class="records-rank">${i + 1}</span>
        <span class="records-fish">${fishBadgeSVG(r.species)}</span>
        <span class="records-main">
          <span class="records-species">${esc(r.species)}</span>
          <span class="records-angler">${esc(r.angler)}</span>
        </span>
        <span class="records-stats">
          <span class="records-weight">${r.weight.toFixed(1)} kg</span>
          <span class="records-length">${Math.round(r.length)} cm</span>
        </span>`;
      this.body.appendChild(row);
    });
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
