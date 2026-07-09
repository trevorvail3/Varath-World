/**
 * src/client/bountyUI.ts
 * ----------------------
 * The Bounty board window. Three parts:
 *   1. Guides — pick which task-giver you're dealing with (locked until you
 *      reach their Bounty level).
 *   2. The contract — your current task with live progress, or a "Take a task"
 *      button when the board is free; plus Claim / Abandon.
 *   3. The Hunt-Marks shop — spend the marks tasks pay out.
 *
 * It only sends BOUNTY_* intents; the core moves marks, XP and goods (RULE 2),
 * and the modal re-reads live state after each one.
 */

import type { Content, Intent, ItemId, WorldState } from "../core/types.ts";
import { itemIconSVG } from "./itemIcon.ts";
import { iconize } from "./glyph.ts";
import { equipRequirement, bountyMilestoneMult, DAILY_WINDOW_MS } from "../core/worldCore.ts";

export class BountyUI {
  private backdrop: HTMLElement;
  private body: HTMLElement;
  private open = false;
  private state: WorldState | null = null;
  // When the board is opened by talking to a guide, it locks to that guide —
  // you only deal with the one in front of you. `null` = the notices board,
  // which lists every guide.
  private lockedGuideId: string | null = null;

  constructor(
    root: HTMLElement,
    private content: Content,
    private dispatch: (intent: Intent) => void,
  ) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "shop-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="shop-modal bounty-modal">
        <div class="shop-head">
          <span class="shop-title"><span class="title-ic">${iconize("🎯")}</span> The Hunt Ledger</span>
          <span class="bounty-marks">0 <span class="mark-ic">${iconize("🎯")}</span></span>
          <button class="shop-close" type="button">✕</button>
        </div>
        <div class="bounty-body"></div>
      </div>
      <div class="shop-info hidden"></div>`;
    this.body = this.backdrop.querySelector(".bounty-body") as HTMLElement;
    this.infoEl = this.backdrop.querySelector(".shop-info") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".shop-close") as HTMLElement).addEventListener(
      "pointerdown",
      (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.infoEl.addEventListener("pointerdown", (e) => {
      if (e.target === this.infoEl) this.hideInfo();
    });
  }

  private infoEl!: HTMLElement;
  private pressTimer = 0;

  private hideInfo(): void { this.infoEl.classList.add("hidden"); }

  /** Fire `onHold` after a long press on `el` (cancelled by release or a drag). */
  private onLongPress(el: HTMLElement, onHold: () => void): void {
    let sx = 0, sy = 0;
    const cancel = (): void => { if (this.pressTimer) { clearTimeout(this.pressTimer); this.pressTimer = 0; } };
    el.addEventListener("pointerdown", (e) => {
      sx = e.clientX; sy = e.clientY;
      if (e.button === 2) { onHold(); return; }
      cancel();
      this.pressTimer = window.setTimeout(() => { this.pressTimer = 0; onHold(); }, 380);
    });
    el.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 12) cancel();
    });
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** A one-line combat/utility stat summary for the inspect box. */
  private itemStats(def: Content["items"][ItemId]): string {
    const bits: string[] = [];
    if (def.acc) bits.push(`+${def.acc} accuracy`);
    if (def.dmg) bits.push(`+${def.dmg} damage`);
    if (def.rngAcc) bits.push(`+${def.rngAcc} ranged acc`);
    if (def.rngDmg) bits.push(`+${def.rngDmg} ranged dmg`);
    if (def.magAcc) bits.push(`+${def.magAcc} magic acc`);
    if (def.magDmg) bits.push(`+${def.magDmg} magic dmg`);
    if (def.def) bits.push(`+${def.def} defence`);
    if (def.heals) bits.push(`heals ${def.heals}`);
    return bits.join(" · ");
  }

  /** Long-press inspect for a Hunt-Marks ware: what it is, its stats + cost. */
  private showItemInfo(item: ItemId, cost: number, qty: number): void {
    const def = this.content.items[item];
    if (!def) return;
    const stats = this.itemStats(def);
    const req = equipRequirement(this.content, item);
    const reqLine = req ? `<div class="shop-info-req">Requires ${this.content.skills[req.skill]?.name ?? req.skill} ${req.level}</div>` : "";
    const bundle = qty > 1 ? ` (×${qty})` : "";
    this.infoEl.innerHTML = `
      <div class="shop-info-box">
        <button class="shop-info-x" type="button">✕</button>
        <div class="shop-info-icon">${itemIconSVG(def)}</div>
        <div class="shop-info-name">${def.name}</div>
        <div class="shop-info-desc">${def.description}</div>
        ${stats ? `<div class="shop-info-gear">${stats}</div>` : ""}
        ${reqLine}
        <div class="shop-info-stats">Costs ${cost.toLocaleString()} Hunt Marks${bundle}</div>
      </div>`;
    (this.infoEl.querySelector(".shop-info-x") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.hideInfo(); },
    );
    this.infoEl.classList.remove("hidden");
  }

  isOpen(): boolean {
    return this.open;
  }

  show(state: WorldState, guideId?: string): void {
    this.state = state;
    this.open = true;
    this.lockedGuideId = guideId ?? null;
    this.backdrop.classList.remove("hidden");
    this.render();
  }

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
  }

  private monsterName(id: string): string {
    return this.content.monsters[id]?.name ?? id;
  }

  private render(): void {
    if (!this.state) return;
    const { player } = this.state;
    const b = player.bounty;
    const level = player.skills.bounty?.level ?? 1;
    const blockCap = b.unlocks.includes("wider_net") ? 6 : 3;
    // Header: Hunt Marks, plus the live hunt streak once it's building — each
    // consecutive claim past the first pays escalating bonus marks (up to +50%).
    const streakPct = Math.min(Math.max(b.streak, 0), 10) * 5;
    const streakBadge = b.streak > 1
      ? ` <span class="bounty-streak" title="Consecutive tasks claimed without abandoning — your next claim pays +${streakPct}% bonus Hunt Marks.">${iconize("🔥")} Streak ×${b.streak} (+${streakPct}%)</span>`
      : "";
    (this.backdrop.querySelector(".bounty-marks") as HTMLElement).innerHTML =
      `${b.marks.toLocaleString()} <span class="mark-ic">${iconize("🎯")}</span>${streakBadge}`;

    // The guide you're dealing with: the one you walked up to (locked), else the
    // last board you opened. The guide who ISSUED an active task can differ (you
    // can carry another guide's contract) — that's tracked separately so the
    // contract line stays honestly attributed.
    const focusId = this.lockedGuideId ?? b.guideId;
    const focusGuide = this.content.bountyGuides.find((g) => g.id === focusId)
      ?? this.content.bountyGuides[0];
    const issuerGuide = b.task
      ? this.content.bountyGuides.find((g) => g.id === b.task!.guideId) ?? focusGuide
      : focusGuide;

    // --- 1) Guide picker ---
    // Talking to a guide locks the board to them — every guide is shown for
    // context, but only the one in front of you can be chosen. The notices
    // board (no lock) lets you pick any guide you've earned.
    let html = `<div class="bounty-section-label">Guides</div><div class="bounty-guides">`;
    for (const g of this.content.bountyGuides) {
      const levelLocked = level < g.levelReq;
      const selectable = this.lockedGuideId != null
        ? g.id === this.lockedGuideId
        : !levelLocked;
      const active = focusGuide && g.id === focusGuide.id;
      const sub = levelLocked
        ? `<span class="bounty-lock">${iconize("🔒")}</span> Lv ${g.levelReq}`
        : g.title;
      html += `
        <button class="bounty-guide${active ? " active" : ""}${selectable ? "" : " locked"}"
                data-guide="${g.id}" type="button"
                title="${g.title} — ${g.desc}${levelLocked ? ` (needs Bounty ${g.levelReq})` : selectable ? "" : ` — speak to ${g.name} in person to take their work`}">
          <span class="bounty-guide-icon">${iconize(g.icon)}</span>
          <span class="bounty-guide-name">${g.name}</span>
          <span class="bounty-guide-sub">${sub}</span>
        </button>`;
    }
    html += `</div>`;

    // --- 2) The contract ---
    html += `<div class="bounty-section-label">Contract</div>`;
    // The hunter's record: lifetime tally, and what the NEXT claim is worth.
    // Milestone claims (10th/50th/100th) multiply Marks; the first claim in any rolling
    // 20 hours doubles them — both stack with the streak.
    const nextN = b.tasksDone + 1;
    const nextMult = bountyMilestoneMult(nextN);
    const daily = Date.now() - (b.lastClaimDay ?? 0) >= DAILY_WINDOW_MS;
    const perks: string[] = [];
    if (nextMult > 1) perks.push(`<span class="bounty-perk hot">${iconize("🏅")} Task #${nextN} — a milestone: ×${nextMult} Marks on claim!</span>`);
    if (daily) perks.push(`<span class="bounty-perk">${iconize("🌅")} First claim of the day: double Marks.</span>`);
    html += `<div class="bounty-tally">Tasks completed: <b>${b.tasksDone}</b>${
      nextMult > 1 ? "" : ` · next milestone at ${Math.ceil(nextN / 10) * 10}`
    }${perks.length ? `<div class="bounty-perks">${perks.join(" ")}</div>` : ""}</div>`;
    if (b.task) {
      const t = b.task;
      const done = t.progress >= t.required;
      const pct = Math.min(100, Math.round((t.progress / t.required) * 100));
      // The guide tells you WHERE the quarry lives — its named hunting ground.
      // That's all the help you get, OSRS-style: no arrows, no map rings.
      const ground = this.content.huntingGrounds[t.monster];
      const whereLine = ground
        ? `<div class="bounty-task-where">${iconize("🐾")} Found at <b>${ground.name}</b> — ${ground.hint}.</div>`
        : "";
      html += `
        <div class="bounty-contract">
          <div class="bounty-task-name">Slay ${t.required} ${this.monsterName(t.monster)}</div>
          <div class="bounty-task-from">Issued by ${issuerGuide?.name ?? "your guide"} · claim with any guide</div>
          ${whereLine}
          <div class="bounty-progress"><div class="bounty-progress-fill" style="width:${pct}%"></div></div>
          <div class="bounty-task-count">${t.progress} / ${t.required}${done ? " — ready to claim" : ""}</div>
          <div class="bounty-task-rewards">Reward: +${t.marks} Hunt Marks · +${t.xp.toLocaleString()} Bounty XP</div>
          <div class="bounty-actions">
            <button class="bounty-btn bounty-claim${done ? "" : " disabled"}" type="button">Claim</button>
            <button class="bounty-btn bounty-skip${b.marks >= 30 ? "" : " disabled"}" type="button" title="Reroll this task for 30 Hunt Marks — your streak survives.">Skip · 30 ${iconize("🎯")}</button>
            <button class="bounty-btn bounty-block${b.blocked.length < blockCap ? "" : " disabled"}" type="button" title="Never be assigned ${this.monsterName(t.monster)} again (uses a block slot).">Block</button>
            <button class="bounty-btn bounty-abandon" type="button" title="Drop the task for free — but your hunt streak resets.">Abandon</button>
          </div>
        </div>`;
    } else {
      const canTake = focusGuide && level >= focusGuide.levelReq;
      html += `
        <div class="bounty-contract">
          <div class="bounty-empty">No active task. ${
            canTake
              ? `${focusGuide!.name} has work for you.`
              : `Reach Bounty ${focusGuide?.levelReq ?? 1} to take work from ${focusGuide?.name ?? "this guide"}.`
          }</div>
          <div class="bounty-actions">
            <button class="bounty-btn bounty-take${canTake ? "" : " disabled"}" type="button">Take a task</button>
          </div>
        </div>`;
    }

    // --- 3) Block list ---
    html += `<div class="bounty-section-label">Block list (${b.blocked.length}/${blockCap})</div>`;
    if (b.blocked.length) {
      html += `<div class="bounty-blocked">`;
      for (const m of b.blocked) {
        html += `<span class="bounty-block-chip" title="Un-block ${this.monsterName(m)}">${this.monsterName(m)} <button class="bounty-unblock" data-monster="${m}" type="button" aria-label="Un-block">✕</button></span>`;
      }
      html += `</div>`;
    } else {
      html += `<div class="bounty-empty-mini">Nothing blocked. Use <b>Block</b> on a task you never want again.</div>`;
    }
    // Recently assigned: block a past assignment WITHOUT having to hold it
    // again (the OSRS "I never want another of those" moment).
    const recent = b.history.filter((m) => !b.blocked.includes(m) && m !== b.task?.monster);
    if (recent.length && b.blocked.length < blockCap) {
      html += `<div class="bounty-empty-mini">Recently assigned — block without re-rolling:</div><div class="bounty-blocked">`;
      for (const m of recent.slice(0, 6)) {
        html += `<span class="bounty-block-chip">${this.monsterName(m)} <button class="bounty-histblock" data-monster="${m}" type="button" title="Block ${this.monsterName(m)} forever">${iconize("🚫")}</button></span>`;
      }
      html += `</div>`;
    }

    // --- 4) Permanent unlocks ---
    html += `<div class="bounty-section-label">Unlocks</div><div class="bounty-shop">`;
    for (const u of this.content.bountyUnlocks) {
      const owned = b.unlocks.includes(u.id);
      const needsSuperior = u.id === "keen_eye" && !b.unlocks.includes("superior");
      const afford = b.marks >= u.cost;
      const disabled = owned || needsSuperior || !afford;
      html += `
        <div class="bounty-shop-row">
          <span class="bounty-shop-swatch bounty-unlock-ic">${iconize(u.id === "wider_net" ? "🚫" : "💠")}</span>
          <span class="bounty-shop-info">
            <span class="bounty-shop-name">${u.name}</span>
            <span class="bounty-shop-desc">${u.desc}</span>
          </span>
          <button class="bounty-unlock-buy${disabled ? " disabled" : ""}" data-unlock="${u.id}" type="button">${owned ? "Owned" : `${u.cost} <span class="mark-ic">${iconize("🎯")}</span>`}</button>
        </div>`;
    }
    html += `</div>`;

    // --- 5) Hunt-Marks shop ---
    html += `<div class="bounty-section-label">Hunt-Marks Shop</div>`;
    html += `<div class="bounty-empty-mini">Hold an item to inspect it before you buy.</div>`;
    html += `<div class="bounty-shop">`;
    for (const line of this.content.bountyShop) {
      const def = this.content.items[line.item];
      if (!def) continue;
      const afford = b.marks >= line.cost;
      // Bundle tag — skipped when the label already spells its own count
      // ("Flensing Hooks ×10" must not render as "×10 ×10").
      const bundle = line.qty > 1 && !line.label.includes("×") ? ` ×${line.qty}` : "";
      html += `
        <div class="bounty-shop-row">
          <span class="bounty-shop-swatch" data-inspect="${line.item}" data-cost="${line.cost}" data-qty="${line.qty}">${itemIconSVG(def)}</span>
          <span class="bounty-shop-info" data-inspect="${line.item}" data-cost="${line.cost}" data-qty="${line.qty}">
            <span class="bounty-shop-name">${line.label}${bundle}</span>
            <span class="bounty-shop-desc">${line.desc}</span>
          </span>
          <button class="bounty-buy${afford ? "" : " disabled"}" data-item="${line.item}" type="button">${line.cost} <span class="mark-ic">${iconize("🎯")}</span></button>
        </div>`;
    }
    html += `</div>`;

    this.body.innerHTML = html;
    this.wire();
  }

  /** Attach handlers after each (re)render. */
  private wire(): void {
    for (const el of Array.from(this.body.querySelectorAll<HTMLElement>(".bounty-guide:not(.locked)"))) {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const id = el.dataset["guide"];
        // Selecting a guide with no task takes a task from them; otherwise it
        // just switches the highlighted guide (the core guards the rest).
        if (id) this.act({ type: "BOUNTY_TASK", guideId: id });
      });
    }
    const take = this.body.querySelector(".bounty-take:not(.disabled)") as HTMLElement | null;
    if (take) take.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      // Take from the guide in front of you (locked), else the board's focus.
      const gid = this.lockedGuideId
        ?? this.state?.player.bounty.guideId
        ?? this.content.bountyGuides[0]?.id ?? "rook";
      this.act({ type: "BOUNTY_TASK", guideId: gid });
    });
    const claim = this.body.querySelector(".bounty-claim:not(.disabled)") as HTMLElement | null;
    if (claim) claim.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.act({ type: "BOUNTY_CLAIM" });
    });
    const abandon = this.body.querySelector(".bounty-abandon") as HTMLElement | null;
    if (abandon) abandon.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.act({ type: "BOUNTY_ABANDON" });
    });
    const skip = this.body.querySelector(".bounty-skip:not(.disabled)") as HTMLElement | null;
    if (skip) skip.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.act({ type: "BOUNTY_SKIP" });
    });
    const block = this.body.querySelector(".bounty-block:not(.disabled)") as HTMLElement | null;
    if (block) block.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.act({ type: "BOUNTY_BLOCK" });
    });
    for (const el of Array.from(this.body.querySelectorAll<HTMLElement>(".bounty-unblock"))) {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const m = el.dataset["monster"];
        if (m) this.act({ type: "BOUNTY_UNBLOCK", monster: m });
      });
    }
    for (const el of Array.from(this.body.querySelectorAll<HTMLElement>(".bounty-histblock"))) {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const m = el.dataset["monster"];
        if (m) this.act({ type: "BOUNTY_BLOCK", monster: m });
      });
    }
    for (const el of Array.from(this.body.querySelectorAll<HTMLElement>(".bounty-unlock-buy:not(.disabled)"))) {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const id = el.dataset["unlock"];
        if (id) this.act({ type: "BOUNTY_UNLOCK", id });
      });
    }
    for (const el of Array.from(this.body.querySelectorAll<HTMLElement>(".bounty-buy:not(.disabled)"))) {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const item = el.dataset["item"];
        if (item) this.act({ type: "BOUNTY_BUY", item: item as ItemId });
      });
    }
    // Long-hold a Hunt-Marks ware to inspect it (stats + mark cost) before buying.
    for (const el of Array.from(this.body.querySelectorAll<HTMLElement>("[data-inspect]"))) {
      const item = el.dataset["inspect"] as ItemId;
      const cost = Number(el.dataset["cost"]) || 0;
      const qty = Number(el.dataset["qty"]) || 1;
      this.onLongPress(el, () => this.showItemInfo(item, cost, qty));
    }
  }

  private act(intent: Intent): void {
    this.dispatch(intent);
    this.render();
  }
}
