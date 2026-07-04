/**
 * src/client/hiscoresUI.ts
 * ------------------------
 * The Hiscores board — a sortable ranking from the shared Supabase board (the
 * same accounts as the idle game). Reading the board is public; a small sign-in
 * panel lets you join it so your character ranks under your account. If the
 * shared board can't be reached it falls back to ranking this device's saves, so
 * the board is never broken.
 */

import type { Content } from "../core/types.ts";
import {
  getSocial, getLocal, submitCurrent, type HiscoreEntry,
} from "./social.ts";
import { currentUser } from "./supabase.ts";

type Metric = { key: keyof HiscoreEntry; label: string; fmt: (e: HiscoreEntry) => string };

const METRICS: Metric[] = [
  { key: "totalLevel", label: "Total", fmt: (e) => e.totalLevel.toLocaleString() },
  { key: "totalXp", label: "Total XP", fmt: (e) => (e.totalXp ?? 0).toLocaleString() },
  { key: "combat", label: "Combat", fmt: (e) => String(e.combat) },
  { key: "duelRating", label: "Duel", fmt: (e) => String(e.duelRating ?? 0) },
  { key: "playMs", label: "Played", fmt: (e) => fmtPlay(e.playMs) },
  { key: "diaries", label: "Diaries", fmt: (e) => String(e.diaries) },
  { key: "monstersSlain", label: "Slain", fmt: (e) => e.monstersSlain.toLocaleString() },
  { key: "goldEarned", label: "Gold", fmt: (e) => e.goldEarned.toLocaleString() },
];

function fmtPlay(ms: number): string {
  const min = Math.floor((ms || 0) / 60000);
  const h = Math.floor(min / 60);
  return h === 0 ? `${min}m` : `${h}h ${min % 60}m`;
}

export class HiscoresUI {
  private backdrop: HTMLElement;
  private tabs: HTMLElement;
  private body: HTMLElement;
  private note!: HTMLElement;
  private open = false;
  private metric: Metric = METRICS[0]!;
  private entries: HiscoreEntry[] = [];

  constructor(root: HTMLElement, private content: Content) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "hiscores-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="hiscores-modal">
        <div class="hiscores-head">
          <span class="hiscores-title">Hiscores</span>
          <button class="hiscores-close" type="button">✕</button>
        </div>
        <div class="hiscores-tabs"></div>
        <div class="hiscores-body"></div>
        <div class="hiscores-note"></div>
      </div>`;
    this.tabs = this.backdrop.querySelector(".hiscores-tabs") as HTMLElement;
    this.body = this.backdrop.querySelector(".hiscores-body") as HTMLElement;
    this.note = this.backdrop.querySelector(".hiscores-note") as HTMLElement;
    root.appendChild(this.backdrop);

    for (const m of METRICS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `hiscores-tab${m === this.metric ? " on" : ""}`;
      b.textContent = m.label;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.metric = m;
        this.tabs.querySelectorAll(".hiscores-tab").forEach((t) => t.classList.remove("on"));
        b.classList.add("on");
        this.render();
      });
      this.tabs.appendChild(b);
    }

    (this.backdrop.querySelector(".hiscores-close") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  isOpen(): boolean { return this.open; }
  close(): void { this.open = false; this.backdrop.classList.add("hidden"); }

  async show(youName: string): Promise<void> {
    this.open = true;
    this.backdrop.classList.remove("hidden");
    this.body.innerHTML = `<div class="hiscores-empty">Loading…</div>`;
    await submitCurrent(this.content);

    let list: HiscoreEntry[];
    let shared = true;
    try {
      list = await getSocial(this.content).hiscores();
    } catch {
      shared = false; // shared board offline — fall back to this device
      list = await getLocal(this.content).hiscores();
    }
    const myId = currentUser()?.id;
    for (const e of list) e.you = e.userId ? e.userId === myId : e.name === youName;
    this.entries = list;
    this.note.textContent = shared
      ? "The shared world board — every hero across Varath."
      : "Couldn't reach the world board; showing heroes on this device.";
    if (this.open) this.render();
  }

  private render(): void {
    const m = this.metric;
    const sorted = [...this.entries].sort((a, b) => (b[m.key] as number) - (a[m.key] as number));
    if (sorted.length === 0) {
      this.body.innerHTML = `<div class="hiscores-empty">No heroes yet.</div>`;
      return;
    }
    this.body.innerHTML = sorted.map((e, i) => `
      <div class="hiscores-row${e.you ? " you" : ""}${e.founder ? " founder" : ""}">
        <span class="hiscores-rank">${i + 1}</span>
        <span class="hiscores-name">${escapeHtml(e.name)}${e.founder ? `<span class="hiscores-founder">Founder</span>` : ""}</span>
        <span class="hiscores-val">${m.fmt(e)}</span>
      </div>`).join("");
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}
