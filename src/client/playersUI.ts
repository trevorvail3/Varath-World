/**
 * src/client/playersUI.ts
 * -----------------------
 * The Players panel: who's online right now, and your friends list (send a
 * request by name, accept incoming ones, see which friends are online). Pure
 * presentation over friends.ts.
 */

import {
  acceptFriend, addFriend, listFriends, onlineNow, removeFriend, resolveByName,
  type Friend, type OnlinePlayer,
} from "./friends.ts";
import { profileFor, getSocial, getLocal, submitCurrent, type HiscoreEntry } from "./social.ts";
import type { Content, SkillId } from "../core/types.ts";
import { iconize } from "./glyph.ts";
import { currentUser } from "./supabase.ts";
import { currentGhosts } from "./presence.ts";
import { Portrait } from "./portrait.ts";

type Tab = "online" | "friends" | "hiscores";

function ago(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

function fmtPlay(ms: number): string {
  const min = Math.floor((ms || 0) / 60000);
  const h = Math.floor(min / 60);
  return h === 0 ? `${min}m` : `${h}h ${min % 60}m`;
}

export class PlayersUI {
  private backdrop: HTMLElement;
  private body: HTMLElement;
  private note: HTMLElement;
  private tabsEl: HTMLElement;
  private open = false;
  private tab: Tab = "online";
  /** When set, the body shows this player's profile instead of a list. */
  private viewing: { id: string; name: string } | null = null;
  /** A portrait of the player being viewed — only when they are actually near
   *  enough to be a ghost, because that is the only place the client has their
   *  look. The hiscores row carries a name and levels, never an appearance. */
  private profilePortrait: Portrait | null = null;

  constructor(
    root: HTMLElement,
    private content: Content,
    private onTrade: (id: string, name: string) => void = () => {},
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "players-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="players-modal">
        <div class="players-head">
          <span class="players-title">Players</span>
          <button class="players-close" type="button">✕</button>
        </div>
        <div class="players-tabs"></div>
        <div class="players-note"></div>
        <div class="players-body"></div>
      </div>`;
    this.tabsEl = this.backdrop.querySelector(".players-tabs") as HTMLElement;
    this.body = this.backdrop.querySelector(".players-body") as HTMLElement;
    this.note = this.backdrop.querySelector(".players-note") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".players-close") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => { if (e.target === this.backdrop) this.close(); });

    for (const [id, label] of [["online", "Online Now"], ["friends", "Friends"], ["hiscores", "High Scores"]] as [Tab, string][]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `players-tab${id === this.tab ? " on" : ""}`;
      b.textContent = label;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.tab = id;
        this.viewing = null;
        this.tabsEl.querySelectorAll(".players-tab").forEach((t) => t.classList.remove("on"));
        b.classList.add("on");
        void this.refresh();
      });
      this.tabsEl.appendChild(b);
    }
  }

  isOpen(): boolean { return this.open; }
  close(): void {
    this.open = false;
    this.clearPortrait();
    this.backdrop.classList.add("hidden");
  }

  /** The body is rebuilt by innerHTML, which orphans any canvas in it — so the
   *  portrait's loop has to be stopped by hand before that happens. */
  private clearPortrait(): void {
    this.profilePortrait?.destroy();
    this.profilePortrait = null;
  }

  async show(): Promise<void> {
    this.open = true;
    this.backdrop.classList.remove("hidden");
    await this.refresh();
  }

  private msg(text: string, ok = false): void {
    this.note.textContent = text;
    this.note.classList.toggle("ok", ok);
  }

  private async refresh(): Promise<void> {
    if (this.viewing) { await this.renderProfile(this.viewing.id, this.viewing.name); return; }
    this.clearPortrait();
    this.body.innerHTML = `<div class="players-empty">Loading…</div>`;
    try {
      if (this.tab === "online") this.renderOnline(await onlineNow());
      else if (this.tab === "hiscores") this.renderHiscores(await this.loadHiscores());
      else this.renderFriends(await listFriends());
    } catch {
      this.body.innerHTML = `<div class="players-empty">Couldn't reach the server.</div>`;
    }
  }

  /** Open a player's public profile (skills + time played). */
  private openProfile(id: string, name: string): void {
    if (!id) return;
    this.viewing = { id, name };
    void this.renderProfile(id, name);
  }

  /** Render the profile view for one player into the body. */
  private async renderProfile(id: string, name: string): Promise<void> {
    this.clearPortrait();
    this.body.innerHTML = `<div class="players-empty">Loading ${escapeHtml(name)}…</div>`;
    let entry: HiscoreEntry | null = null;
    try { entry = await profileFor(id); } catch { entry = null; }
    if (this.viewing?.id !== id) return; // navigated away while loading
    const skills = entry?.skills ?? {};
    const cells = (Object.keys(this.content.skills) as SkillId[]).map((sid) => {
      const meta = this.content.skills[sid];
      const lvl = skills[sid] ?? 1;
      return `
        <div class="players-skill">
          <span class="players-skill-icon">${iconize(meta.icon)}</span>
          <span class="players-skill-name">${escapeHtml(meta.name)}</span>
          <span class="players-skill-lvl">${lvl}</span>
        </div>`;
    }).join("");
    this.body.innerHTML = `
      <div class="players-profile">
        <button class="players-btn dim players-back" type="button">← Back</button>
        <div class="players-profile-head">
          <span class="players-name">${escapeHtml(entry?.name ?? name)}</span>
        </div>
        <div class="players-portrait-slot"></div>
        <div class="players-profile-stats">
          <span>Total <b>${entry?.totalLevel ?? "—"}</b></span>
          <span>Combat <b>${entry?.combat ?? "—"}</b></span>
          <span>Played <b>${entry ? fmtPlay(entry.playMs) : "—"}</b></span>
        </div>
        ${entry ? `<div class="players-skill-grid">${cells}</div>`
          : `<div class="players-empty">This player hasn't appeared on the hiscores yet.</div>`}
      </div>`;
    // If they are standing near you, show them. Presence already carries a
    // resolved look and gear for everyone in your zone (currentGhosts), so this
    // needs no server change — and when they are NOT nearby we show nothing
    // rather than a guess, because a made-up face is worse than no face.
    const ghost = currentGhosts().find((g) => g.id === id);
    if (ghost) {
      this.profilePortrait = new Portrait(ghost.look, ghost.gear, { className: "players-portrait", walk: false });
      (this.body.querySelector(".players-portrait-slot") as HTMLElement).appendChild(this.profilePortrait.el);
      this.profilePortrait.start();
    }
    const back = this.body.querySelector(".players-back") as HTMLElement | null;
    back?.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.viewing = null;
      void this.refresh();
    });
  }

  /** Wire up every clickable player name currently in the body. */
  private bindProfile(): void {
    this.body.querySelectorAll(".players-name[data-id]").forEach((el) => {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const id = (el as HTMLElement).dataset.id ?? "";
        const name = (el as HTMLElement).dataset.name ?? "";
        this.openProfile(id, name);
      });
    });
  }

  private renderOnline(list: OnlinePlayer[]): void {
    if (list.length === 0) {
      this.body.innerHTML = `<div class="players-empty">No one else is online right now.</div>`;
      return;
    }
    this.body.innerHTML = list.map((p) => `
      <div class="players-row">
        <span class="players-dot on"></span>
        <span class="players-name" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
        <span class="players-ago">${ago(p.agoMs)}</span>
        <button class="players-btn trade" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}" type="button">Trade</button>
        <button class="players-btn dim add-friend" data-name="${escapeHtml(p.name)}" type="button">+</button>
      </div>`).join("");
    this.body.querySelectorAll(".add-friend").forEach((el) => {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        void this.doAdd((el as HTMLElement).dataset.name ?? "");
      });
    });
    this.bindTrade();
    this.bindProfile();
  }

  /** Wire up every Trade button currently in the body. */
  private bindTrade(): void {
    this.body.querySelectorAll(".trade").forEach((el) => {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const id = (el as HTMLElement).dataset.id ?? "";
        const name = (el as HTMLElement).dataset.name ?? "";
        if (id) { this.close(); this.onTrade(id, name); }
      });
    });
  }

  private renderFriends(list: Friend[]): void {
    const incoming = list.filter((f) => f.status === "pending_in");
    const accepted = list.filter((f) => f.status === "accepted");
    const outgoing = list.filter((f) => f.status === "pending_out");
    const row = (f: Friend, actions: string): string => `
      <div class="players-row">
        <span class="players-dot${f.online ? " on" : ""}"></span>
        <span class="players-name" data-id="${escapeHtml(f.id)}" data-name="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        ${f.online && f.status === "accepted" ? `<button class="players-btn trade" data-id="${escapeHtml(f.id)}" data-name="${escapeHtml(f.name)}" type="button">Trade</button>` : ""}
        ${actions}
      </div>`;
    this.body.innerHTML = `
      <div class="players-add">
        <input class="players-input" type="text" placeholder="add a friend by name" />
        <button class="players-btn players-add-go" type="button">Add</button>
      </div>
      ${incoming.length ? `<div class="players-sub">Requests</div>` + incoming.map((f) => row(f,
        `<button class="players-btn accept" data-id="${f.rowId}" type="button">Accept</button>
         <button class="players-btn dim decline" data-id="${f.rowId}" type="button">✕</button>`)).join("") : ""}
      <div class="players-sub">Friends${accepted.length ? ` (${accepted.filter((f) => f.online).length} online)` : ""}</div>
      ${accepted.length ? accepted.map((f) => row(f,
        `<span class="players-ago">${f.online ? "online" : "offline"}</span>
         <button class="players-btn dim remove" data-id="${f.rowId}" type="button">✕</button>`)).join("")
        : `<div class="players-empty">No friends yet — add someone from Online Now, or by name.</div>`}
      ${outgoing.length ? `<div class="players-sub">Sent</div>` + outgoing.map((f) => row(f,
        `<span class="players-ago">pending</span>
         <button class="players-btn dim remove" data-id="${f.rowId}" type="button">✕</button>`)).join("") : ""}`;

    const input = this.body.querySelector(".players-input") as HTMLInputElement;
    (this.body.querySelector(".players-add-go") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); void this.doAdd(input.value); },
    );
    this.body.querySelectorAll(".accept").forEach((el) => el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      void acceptFriend(Number((el as HTMLElement).dataset.id)).then(() => this.refresh());
    }));
    this.body.querySelectorAll(".decline, .remove").forEach((el) => el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      void removeFriend(Number((el as HTMLElement).dataset.id)).then(() => this.refresh());
    }));
    this.bindTrade();
    this.bindProfile();
  }

  /** Push our own row, then fetch the shared board (falling back to this
   *  device's local board if the server is unreachable), and flag our row. */
  private async loadHiscores(): Promise<HiscoreEntry[]> {
    await submitCurrent(this.content);
    let list: HiscoreEntry[];
    try { list = await getSocial(this.content).hiscores(); }
    catch { list = await getLocal(this.content).hiscores(); }
    const myId = currentUser()?.id;
    for (const e of list) e.you = e.userId ? e.userId === myId : false;
    return list;
  }

  /** All-time leaderboard: every ranked player (online or not, friend or not),
   *  ordered by total level. Names open the same public profile as elsewhere. */
  private renderHiscores(list: HiscoreEntry[]): void {
    if (list.length === 0) {
      this.body.innerHTML = `<div class="players-empty">No ranked players yet.</div>`;
      return;
    }
    const ranked = [...list].sort((a, b) =>
      b.totalLevel - a.totalLevel || b.combat - a.combat || a.name.localeCompare(b.name),
    );
    this.body.innerHTML = `<div class="players-sub">All players, ranked by total level</div>` +
      ranked.map((e, i) => `
        <div class="players-row${e.you ? " you" : ""}">
          <span class="players-rank">${i + 1}</span>
          <span class="players-name" ${e.userId ? `data-id="${escapeHtml(e.userId)}" data-name="${escapeHtml(e.name)}"` : ""}>${escapeHtml(e.name)}</span>
          <span class="players-hs-lvl" title="Total level">${iconize("⭐")} ${e.totalLevel.toLocaleString()}</span>
          <span class="players-ago" title="Combat level">${iconize("⚔️")} ${e.combat}</span>
        </div>`).join("");
    this.bindProfile();
  }

  private async doAdd(name: string): Promise<void> {
    if (!name.trim()) { this.msg("Enter a name."); return; }
    try {
      // Guard against an obvious typo before hitting the server.
      const id = await resolveByName(name);
      if (!id) { this.msg("No player by that name has played yet."); return; }
      this.msg(await addFriend(name), true);
    } catch (e) { this.msg(e instanceof Error ? e.message : "Couldn't add friend."); }
    await this.refresh();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}
