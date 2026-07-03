/**
 * src/client/skillDetail.ts
 * -------------------------
 * A popup for one skill: its level + XP, and its "ladder" — every unlock at the
 * level it needs, derived from the skill's actions (levelReq → what it makes),
 * so a player can see the whole path. Pure presentation; it only reads state.
 */

import type { Content, ItemId, SkillId, WorldState } from "../core/types.ts";
import { glyph, iconize } from "./glyph.ts";
import { equipRequirement, HUNT_GATES } from "../core/worldCore.ts";
import { LEVEL_CAP, XP_CAP } from "../content/xpCurve.ts";

/** Which gear each combat skill gates: weapons need Edge, armour needs Ward,
 *  bows & arrows need Draw. Membership is decided by the skill that actually
 *  gates each piece (see `gateSkill`), not by slot — a bow and a sword share
 *  the mainhand slot but gate on different skills. */
const COMBAT_GEAR: Partial<Record<SkillId, { label: string }>> = {
  edge: { label: "Weapons" },
  ward: { label: "Armour" },
  draw: { label: "Bows & Arrows" },
};

/** The combat skill that gates a wearable, mirroring worldCore's equip rule —
 *  but resolved even for base-tier (Lv1) pieces, whose equipRequirement()
 *  returns null and so would otherwise lose their skill. Weapons gate on Edge,
 *  bows/ranged on Draw, staves/robes on Faith, armour on Ward. */
const SLOT_SKILL: Record<string, SkillId> = {
  mainhand: "edge", ranged: "draw", ammo: "draw",
  helmet: "ward", armor: "ward", legs: "ward", boots: "ward", offhand: "ward",
};
function gateSkill(def: { slot?: string; magic?: boolean; ranged?: boolean; equipSkill?: SkillId }): SkillId | undefined {
  return def.equipSkill ?? (def.magic ? "faith" : def.ranged ? "draw" : SLOT_SKILL[def.slot ?? ""]);
}

/** Which gathering skill each tool type gates on, and the ladder heading to show
 *  it under (Fishing lists Rods, Mining Pickaxes, Forestry Hatchets). */
const TOOL_SKILL: Record<string, SkillId> = { rod: "fishing", pickaxe: "mining", hatchet: "forestry" };
const TOOL_LABEL: Record<string, string> = { rod: "Rods", pickaxe: "Pickaxes", hatchet: "Hatchets" };

/** Pretty-print a SkillAction group key ("arrows" -> "Arrows"). */
function groupLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export class SkillDetailModal {
  private backdrop: HTMLElement;
  private body: HTMLElement;
  private open = false;

  constructor(root: HTMLElement, private content: Content) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "skilldetail-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="skilldetail-modal">
        <div class="skilldetail-head">
          <span class="skilldetail-title">Skill</span>
          <button class="skilldetail-close" type="button">✕</button>
        </div>
        <div class="skilldetail-body"></div>
      </div>`;
    this.body = this.backdrop.querySelector(".skilldetail-body") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".skilldetail-close") as HTMLElement).addEventListener(
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

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
  }

  show(state: WorldState, skill: SkillId): void {
    const meta = this.content.skills[skill];
    const s = state.player.skills[skill];
    const table = this.content.xpForLevel;
    (this.backdrop.querySelector(".skilldetail-title") as HTMLElement).innerHTML =
      `<span class="skilldetail-ic">${iconize(meta.icon)}</span> ${meta.name}`;

    // At the level cap the orb freezes at 100 but XP climbs to 100M — show that
    // prestige progress rather than a phantom next level.
    const atCap = s.level >= LEVEL_CAP;
    const cur = atCap ? (table[LEVEL_CAP] ?? 0) : (table[s.level] ?? 0);
    const next = atCap ? XP_CAP : table[s.level + 1];
    const pct = next && next > cur ? (s.xp - cur) / (next - cur) : 1;
    const xpLine = next
      ? `${Math.floor(s.xp).toLocaleString()} / ${next.toLocaleString()} xp${atCap ? " (max level)" : ""}`
      : "max level";

    // A plain-language explainer at the top: what the skill is and how it trains.
    let html = `
      <div class="sd-blurb">${meta.blurb}</div>
      <div class="sd-level">Level <b>${s.level}</b> · ${xpLine}</div>
      <div class="sd-xpbar"><div class="sd-xpfill" style="width:${Math.max(0, Math.min(1, pct)) * 100}%"></div></div>`;

    // The ladder: group this skill's actions BY ACTIVITY (the action's `group`),
    // then by the level each unlock needs — a separate level ladder per activity.
    const activities = new Map<string, Map<number, string[]>>();
    for (const a of this.content.actions) {
      if (a.skill !== skill) continue;
      // Activity = the action's own group if it has one, else the category of
      // what it produces (Bars, Weapons, Armour…), so a skill's ladder splits
      // into sensible sections instead of one long list.
      const cat = a.produces ? this.content.items[a.produces]?.cat : undefined;
      const act = a.group ? groupLabel(a.group) : cat || "Recipes";
      const byLevel = activities.get(act) ?? new Map<number, string[]>();
      const list = byLevel.get(a.levelReq) ?? [];
      if (!list.includes(a.name)) list.push(a.name);
      byLevel.set(a.levelReq, list);
      activities.set(act, byLevel);
    }

    // Farming has no actions — its ladder lives in the crops table. Build the
    // same activity→level→names structure from crops so the panel matches the
    // others: what you can plant, and the level each needs (OSRS-style).
    if (skill === "farming") {
      for (const c of Object.values(this.content.crops)) {
        const act = c.type === "tree" ? "Trees" : "Crops";
        const byLevel = activities.get(act) ?? new Map<number, string[]>();
        const list = byLevel.get(c.levelReq) ?? [];
        if (!list.includes(c.name)) list.push(c.name);
        byLevel.set(c.levelReq, list);
        activities.set(act, byLevel);
      }
    }

    // Combat skills have no actions either: their "ladder" is the gear you can
    // equip and the COMBAT level each tier needs (weapons for Edge/Vigour,
    // armour for Ward, bows for Draw). Tools are excluded — they gate on the
    // gathering skills, not combat.
    const gear = COMBAT_GEAR[skill];
    if (gear) {
      for (const id of Object.keys(this.content.items) as ItemId[]) {
        const def = this.content.items[id];
        if (!def.slot || def.tool || gateSkill(def) !== skill) continue;
        // A tiered piece carries a material tier (explicit `tier` or the `_<n>`
        // id suffix) or an explicit equipLevel; plain uniques with no gate are
        // left off the ladder.
        if (def.tier === undefined && def.equipLevel === undefined && !/_\d+$/.test(def.id)) continue;
        const req = equipRequirement(this.content, id);
        const lvl = req ? req.level : 1; // base tier resolves to null → Lv1
        // Draw gates both bows and ranged armour — split them into two
        // sub-ladders for clarity, the way Devotion separates Staves and Robes.
        const label = skill === "draw" && !def.ranged && def.slot !== "ranged" && def.slot !== "ammo"
          ? "Ranged Armour"
          : gear.label;
        // Collapse a material's pieces into ONE line per level — "Ribstone
        // armour", "Hearthite weapons" — instead of spelling out every helm,
        // plate, leg and boot. The material is the name's leading word; a
        // multi-word unique (no shared material tier) keeps its full name.
        const material = def.name.split(" ")[0]!;
        const collapsed = skill === "ward" || label === "Ranged Armour"
          ? `${material} armour`
          : skill === "edge" ? `${material} weapons`
          : def.name;
        const byLevel = activities.get(label) ?? new Map<number, string[]>();
        const list = byLevel.get(lvl) ?? [];
        if (!list.includes(collapsed)) list.push(collapsed);
        byLevel.set(lvl, list);
        activities.set(label, byLevel);
      }
    }

    // Gathering tools gate on THIS skill — list each rod/pickaxe/hatchet at the
    // level it can be wielded, so the tool-upgrade path shows beside the catches.
    {
      const toolType = (Object.keys(TOOL_SKILL) as string[]).find((t) => TOOL_SKILL[t] === skill);
      if (toolType) {
        const label = TOOL_LABEL[toolType]!;
        const byLevel = activities.get(label) ?? new Map<number, string[]>();
        for (const id of Object.keys(this.content.items) as ItemId[]) {
          const def = this.content.items[id];
          if (def.tool !== toolType) continue;
          const req = equipRequirement(this.content, id);
          const lvl = req ? req.level : 1;
          const list = byLevel.get(lvl) ?? [];
          if (!list.includes(def.name)) list.push(def.name);
          byLevel.set(lvl, list);
        }
        if (byLevel.size) activities.set(label, byLevel);
      }
    }

    // Bounty: the guides, the full quarry list (every creature at the Bounty
    // level its first contract can roll), the Warrens' kill-gates, and the
    // level perks — the whole skill outlined, OSRS-style.
    if (skill === "bounty") {
      const addTo = (label: string, lvl: number, name: string): void => {
        const m = activities.get(label) ?? new Map<number, string[]>();
        const list = m.get(lvl) ?? [];
        if (!list.includes(name)) list.push(name);
        m.set(lvl, list);
        activities.set(label, m);
      };
      for (const g of this.content.bountyGuides) {
        addTo("Guides", g.levelReq, `${g.name}, ${g.title}`);
      }
      // Quarry: each monster at the LOWEST Bounty level any of its task
      // templates rolls at (through the guide that offers it earliest).
      const earliest = new Map<string, number>();
      for (const g of this.content.bountyGuides) {
        for (const zone of g.zones) {
          for (const t of this.content.bountyTasks[zone] ?? []) {
            const lvl = Math.max(g.levelReq, t.minLevel);
            const prev = earliest.get(t.monster);
            if (prev === undefined || lvl < prev) earliest.set(t.monster, lvl);
          }
        }
      }
      for (const [mon, lvl] of earliest) {
        const def = this.content.monsters[mon];
        addTo("Quarry (first contract)", lvl, def?.name ?? mon);
      }
      // The Hunt Warrens: creatures you cannot FIGHT at all below their gate —
      // and the guild wares two of them also demand (OSRS tool-gate style).
      for (const id of Object.keys(this.content.monsters)) {
        const def = this.content.monsters[id];
        if (!def?.bountyReq) continue;
        const tool = HUNT_GATES[id];
        addTo("The Hunt Warrens (to fight at all)", def.bountyReq, `${def.name} — unique drop${tool ? `, needs a ${tool.toolName}` : ""}`);
      }
      // The level perks the claims maths pays out.
      addTo("Perks", 50, "The veteran's cut: contracts pay +10% Marks");
      addTo("Perks", 75, "The veteran's cut: contracts pay +20% Marks");
      addTo("Perks", 90, "The veteran's cut: contracts pay +30% Marks");
    }

    // Devotion (faith): its ladder is the staff tiers you can wield, the magic
    // robes you can wear, and the spells you can cast — each at its level.
    if (skill === "faith") {
      const addTo = (label: string, lvl: number, name: string): void => {
        const m = activities.get(label) ?? new Map<number, string[]>();
        const list = m.get(lvl) ?? [];
        if (!list.includes(name)) list.push(name);
        m.set(lvl, list);
        activities.set(label, m);
      };
      for (const id of Object.keys(this.content.items) as ItemId[]) {
        const def = this.content.items[id];
        const req = equipRequirement(this.content, id);
        if (def.magic) addTo("Staves", req ? req.level : 1, def.name);
        else if (gateSkill(def) === "faith") addTo("Robes", req ? req.level : 1, def.name);
      }
      for (const sp of this.content.spells) addTo("Spells", sp.faithReq, sp.name);
    }

    // Agility: its ladder is the courses, each at the Agility level it opens (the
    // Varathian Trail included — it's also unlocked by talking to Cael).
    if (skill === "agility") {
      const courses = new Map<string, { lvl: number; name: string }>();
      for (const o of this.content.objects) {
        if (o.kind !== "agility_obstacle" || !o.course) continue;
        const nm = (o.name ?? o.course).split(":")[0]!.trim();
        const lvl = o.levelReq ?? 1;
        const prev = courses.get(o.course);
        if (!prev || lvl < prev.lvl) courses.set(o.course, { lvl, name: nm });
      }
      const byLevel = new Map<number, string[]>();
      for (const { lvl, name } of courses.values()) {
        const list = byLevel.get(lvl) ?? [];
        if (!list.includes(name)) list.push(name);
        byLevel.set(lvl, list);
      }
      if (byLevel.size) activities.set("Courses", byLevel);
    }

    if (activities.size === 0) {
      // Action-less skills (combat, agility…) have no recipe ladder — the blurb
      // above already explains how they train, so nothing more is needed here.
    } else {
      // Order activities by the lowest level they start at.
      const minLvl = (m: Map<number, string[]>) => Math.min(...m.keys());
      const groups = [...activities.entries()].sort((a, b) => minLvl(a[1]) - minLvl(b[1]));
      const single = groups.length === 1;
      html += `<div class="sd-laddertitle">${gear ? "Equip" : "Unlocks"}</div>`;
      for (const [name, byLevel] of groups) {
        if (!single) html += `<div class="sd-actgroup">${name}</div>`;
        html += `<div class="sd-ladder">`;
        let nextMarked = false;
        for (const [lvl, names] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
          const unlocked = s.level >= lvl;
          let cls = unlocked ? "done" : "locked";
          if (!unlocked && !nextMarked) { cls = "next"; nextMarked = true; }
          const mark = unlocked ? glyph("check") : cls === "next" ? glyph("next") : glyph("lock");
          const shown = names.length > 6 ? `${names.slice(0, 6).join(", ")}, +${names.length - 6} more` : names.join(", ");
          html += `
            <div class="sd-rung ${cls}">
              <span class="sd-rung-lvl">Lv ${lvl}</span>
              <span class="sd-rung-mark">${mark}</span>
              <span class="sd-rung-names">${shown}</span>
            </div>`;
        }
        html += `</div>`;
      }
    }

    this.body.innerHTML = html;
    this.open = true;
    this.backdrop.classList.remove("hidden");
  }
}
