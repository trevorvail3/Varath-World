# OSRS Parity — the plan to finish the clone

Varath World is already an OSRS-shaped game. This document records the gap
between where it is and real OSRS, the batch that closes most of that gap
(**Phase 1 — Combat parity**), and the four phases after it.

Companion documents: `docs/CANON_LEDGER.md` (what was ported from the idle
game — **stale in places, see Cleanup below**), and the VW 2.0 vision notes
kept outside this repo.

> **Scope rule for this document:** clone OSRS's *mechanics and interface
> conventions*, keep Varath's names and lore. Devotion, not Prayer. Bounty,
> not Slayer. Edge / Vigour / Ward, not Attack / Strength / Defence. No item,
> quest or skill is renamed, and no existing save is invalidated.

---

## Where the game actually is

The repo `README.md` still describes a one-zone demo. It is long out of date.
What actually exists:

| System | State |
|---|---|
| Skills | **20**, all genuinely wired — no stubs. Includes Bounty (=Slayer), Faith (=Prayer+Magic fused), Agility + run energy, Farming, Construction/housing, Herblore |
| Content | 704 items · 85 monsters (6 bosses) · 329 skill actions · 49 branching quests · 40 achievements · 9 diaries · 3-tier clue trails · 17 shops · 8 dungeons |
| World | One 160×364 tile grid — a 160×164 overworld plus hidden arena / home-interior / dungeon bands; ~1,159 spawned objects |
| Combat | Real triangle (stab/slash/crush/ranged/magic + monster weaknesses), 4 melee stances, special attacks, 10 boss mechanics incl. dodge-tiles, aggro/pursue/leash |
| Social | Supabase-backed: hiscores, Grand Exchange order book with real escrow, P2P trade, deterministic lockstep duels, friends, world chat, cosmetic ghosts |
| Client | 100% procedural canvas 2D (zero art assets), procedural Web Audio, right-click/long-press context menus, world map, 14 UI panels |

## The real gaps vs. OSRS

Verified by reading the code, not assumed:

1. The sim tick is **200ms, not OSRS's 600ms** — nothing lands on OSRS timings.
2. Accuracy is `a/(a + 1.35·def)` and damage is `randInt(0.4·max, max)`.
   **OSRS's actual rolls are absent, and a landed hit can never be 0.**
3. Items carry flat `acc`/`dmg`/`def`. There is **no per-style equipment bonus
   sheet** (attack & defence vs stab/slash/crush/magic/ranged) — so no armour
   triangle.
4. `wepType` exists on every weapon but is unused for stances — there are **no
   per-weapon attack options** that pick both attack type and XP split.
5. **No poison, venom, or stat drain.** No hitsplats, no overhead protection
   icons, no target HP bars.
6. Death is forgiving (gold loss capped at 250g). No gravestone.
7. No always-visible quick-action bar.

---

# Phase 1 — Combat parity

Seven workstreams, ordered so each is independently verifiable. WS1 first
(everything else is timed against it); **WS3 before WS2** — the new formulas
read from the bonus vector WS3 builds.

## The key finding

**Varath's combat timings are already on OSRS's grid — they just aren't
enforced on a tick.**

- `WALK_STEP_TICKS = 3` × `TICK_MS = 200` = **600ms per walked tile, exactly
  OSRS walk speed** (`src/core/worldCore.ts:74`).
- Default melee swing `playerMeleeSpeed: 2400` is OSRS's 4-tick weapon;
  monster default `3000` is 5-tick (`worldCore.ts:380-381`). Every weapon
  speed in `items.ts` falls in 1600–3800ms — within rounding of the
  3/4/5/6-tick ladder.
- `duelCore.ts` **already runs a 600ms tick** and already quantizes weapon
  speed onto it: `speedTicks: Math.max(3, Math.round(playerSpeed(...) / 600))`
  (`worldCore.ts:6704`).

So this is not a re-tune. It is making the overworld do what the duel engine
already does.

**The migration surface is tiny.** Core has exactly **four** tick-expressed
constants — `WALK_STEP_TICKS`, `RUN_STEP_TICKS`, `MOUNT_STEP_TICKS`
(`worldCore.ts:74-76`) and `NPC_STEP_TICKS` (`:78`). Everything else in core
is wall-clock ms off `ctx.now` (12 `_MS` constants, plus `nextAttackAt`,
respawns, craft intervals, farming epochs) and is therefore *unaffected* by a
change to `TICK_MS`. The tick change touches movement cadence and nothing else.

## WS1 — The 600ms game tick

Set `TICK_MS = 600` (`worldCore.ts:63`) and re-express movement.

- **Walking** becomes `stepDurTicks: 1` — identical 600ms/tile feel, now
  tick-aligned.
- **Running is the one real design change.** `stepDurTicks` cannot go below 1,
  so running cannot be expressed as "fewer ticks per tile". OSRS runs by
  **moving two tiles per tick** — build that: the path consumer at
  `worldCore.ts:4895` / `:5282` pops **two** path nodes on a running tick, and
  `prevPos` spans the 2-tile segment so the client's existing `interpTile`
  (`src/client/render.ts:1512`) glides across it unchanged. Run energy then
  drains per tile, as OSRS does. Mounts follow the same shape (3 tiles/tick).
- **Quantize the combat clocks onto the tick.** Replace the free-running
  `obj.nextAttackAt = ctx.now + speed` (`worldCore.ts:6812`, `:6860`) with a
  tick-counted clock, reusing duelCore's quantization (`round(speed / 600)`,
  floored at 3). This is what actually delivers the OSRS *feel*: swings,
  eating (`EAT_DELAY_MS`) and movement all land on the same beat.

**Risk — what gets coarser.** The 200ms clock is load-bearing in two places
worth checking by hand: boss slam/cleave dodge windows (`resolveSlams`,
`worldCore.ts:7774`) and the pier fishing tension minigame. Both need a real
browser check. `tensionUI.ts` runs its own rAF loop and is probably
unaffected, but boss telegraph windows are expressed in ms and will now be
sampled 3× less often — verify each telegraph still leaves ≥2 ticks of
reaction time, and lengthen any that doesn't.

## WS2 — OSRS accuracy and damage rolls

Replace the model in `playerSwing` (`worldCore.ts:6866`), `monsterSwing`
(`:7389`) and `hitChance` (`:6780`) with OSRS's real rolls, mapped onto
Varath's skills (`edge`=attack, `vigour`=strength, `ward`=defence,
`draw`=ranged, `faith`=magic):

```
effLvl   = floor(level × blessingMult) + stanceBonus + 8
attRoll  = effLvl × (equipment attack bonus for the chosen type + 64)
defRoll  = effLvl × (equipment defence bonus vs the incoming type + 64)
accuracy = attRoll > defRoll ? 1 − (defRoll+2)/(2·(attRoll+1))
                             : attRoll/(2·(defRoll+1))
maxHit   = floor(0.5 + effStr × (strengthBonus + 64)/640)
damage   = uniform integer in [0, maxHit]        ← zeros are real hits
```

**The big feel change is the zero.** Today a landed blow rolls
`[0.4·max, max]` and can never be 0 (`COMBAT.dmgMinFrac`, `worldCore.ts:415`).
OSRS's blue 0-splat is a large part of how combat reads, and it pairs with
WS6's hitsplats. Note this deliberately *undoes* an earlier tuning decision —
the comment at `worldCore.ts:414` explains why the floor was added. Flag it
for the feel-test.

**Monster stats are not in OSRS units** and must not be hand-authored across
85 monsters. Derive: fit a conversion from each monster's existing
`acc`/`def`/`maxHit` so post-change accuracy and TTK track current values,
then expose the fitted coefficients as named constants in the `COMBAT` block
(`worldCore.ts:378`). Layer every existing modifier on top of the new roll
rather than replacing it — the weakness triangle (`weaknessAcc 1.5`,
`weaknessDmg 1.4`), `bossOffStyleDmg 0.6`, `eliteOffStyleDmg 0.85`,
scaleguard, and the `wardDivisor` soak.

**This is the workstream most likely to blow up the balance.** Guard: write
the TTK/XP-rate sim *before* touching the formulas, record a baseline, and
treat >10% drift on any monster as a bug to fix — not as a new balance point.

## WS3 — The equipment bonus sheet *(do before WS2)*

Introduce OSRS's bonus vector: attack and defence each vs
stab/slash/crush/magic/ranged, plus strength, ranged strength, magic damage,
and a Grace (prayer) bonus.

**368 slotted items must not be hand-authored.** Build a **deriver** that
computes the vector from fields each item already carries —
`acc`/`dmg`/`def`/`rngAcc`/`rngDmg`/`magAcc`/`magDmg`/`attackStyle`/
`wepType`/`cat`/`tier`/`craftTier` — through an archetype table that finally
makes the **armour triangle** real:

| Archetype | Strong defence vs | Weak vs | Source signal |
|---|---|---|---|
| Plate / metal | stab, slash, crush | magic | `cat: Armour`, `tier` |
| Leather / ranged | ranged, part magic | stab | `cat: Leather Armour` / `Ranged Armour`, `equipSkill: draw` |
| Robes | magic | ranged | `cat: Magic Robes`, `equipSkill: faith` |

Compute it once at boot in `src/content/index.ts` — **not** a generated file,
so it stays in step with `items.ts` automatically and cannot drift — with a
small hand-authored override map for the ~14 legendary/marquee pieces that
should break the pattern. `equipStat` becomes a lookup into the derived table.

**UI:** an OSRS-style Equipment Stats panel on the existing Character tab
(`src/client/hud.ts:120`), plus stat-delta-on-hover when inspecting a
wearable — what makes gear upgrades legible. This is also what finally gives
`rngAcc`/`magAcc` (already on items, barely surfaced) somewhere to appear.

## WS4 — Attack options per weapon type

OSRS gives each weapon type four options that pick **both** the attack type
(stab/slash/crush) and the XP split. `wepType` already exists on every weapon
and is currently unused for this.

Add `WEAPON_STYLES: Record<WepType, AttackOption[]>` in content, replacing the
flat `STYLE_MODS` (`worldCore.ts:436`) as the source of the acc/dmg/def
weighting. A scimitar-equivalent offers Chop (slash/accurate), Slash
(slash/aggressive), Lunge (stab/controlled), Block (slash/defensive); a hammer
offers crush options; a spear offers stab.

**This is what makes the weakness triangle a live decision.** Today the
triangle is decided by which weapon you brought. With attack options you
switch stance mid-fight to hit a monster's weakness — the most OSRS-ish thing
in the batch, and nearly free, because the triangle machinery
(`activeWeakness`, `wardPhaseOf`) already exists.

`SET_STYLE` extends to carry the chosen option. **Save migration:** existing
`player.combatStyle` values map to the equivalent option on the worn weapon.
Bump `SAVE_VERSION` to 2 and add the first entry to the currently-empty
`SAVE_MIGRATIONS` table (`src/core/save.ts:216`).

## WS5 — Status effects

New `Player` fields for poison (fixed damage every 30s, decaying), venom
(ramping, non-decaying), and stat drain/boost on the five combat skills with
OSRS's restore-1-per-minute behaviour. All tick-driven in core, all
deterministic under a fixed seed. New `WorldEvent` members so the client can
render them. Reuse the existing `player.buffs` shape where it fits.

Monster flavour text already *describes* venom with no mechanic behind it.
This is also the prerequisite for Phase 2's Thieving stun and for poisoned
weapons/ammo in the bonus sheet.

## WS6 — Hitsplats and combat feedback

The visual half of the parity pass, all on existing seams:

- **Hitsplats** — red hit / **blue zero** / green poison / purple venom, drawn
  in the y-sorted sprite list (`render.ts:1757+`) so they occlude correctly.
  Extend the `DAMAGE{targetId, amount, weak?}` event with a splat type; render
  from `handleEvents` (`src/client/loop.ts:818`).
- **Overhead protection icons** on the player and on monsters using
  blessings — what makes protection prayers readable.
- **Target HP bars** over the current target.
- **Sound** — add splat/poison voices to `type Sfx` (`src/client/audio.ts:48`)
  and a case in `play()`.

## WS7 — Death penalty and the quick-action strip

**Harsher death.** `DEATH_ITEMS_KEPT = 3` and the 5-minute ground spill
already exist (`worldCore.ts:145`, `:7532`); what goes is
`DEATH_GOLD_CAP = 250` (`:142`). Add a real gravestone: a new `ObjKind` at the
death tile holding everything not kept, a reclaim timer, and defined behaviour
for dying again before reclaiming (OSRS collapses the old grave to Death's
Office; the simplest faithful version moves the older grave's contents to a
single reclaim NPC for a fee). Keep 4 items with a protect blessing active.
**Must not brick existing saves** — a save with no gravestone state loads as
"no grave".

**Quick-action strip.** An always-visible eat / stance / blessing / special
bar in `hud.ts`, above the dock. On a 520px phone it collapses to four icons;
on desktop it takes keyboard bindings. Note `loop.ts:483` is currently the
*only* global key handler, so hotkeys are near-greenfield here — introduce a
small keybinding table rather than another `if (e.key === …)` chain.

---

# The roadmap after Phase 1

Ordering is deliberate: parity first, so nothing built later has to be
retrofitted to a changed combat model; multiplayer last, because it is the one
phase headless sims cannot cover.

## Phase 2 — Missing skills & activities

- **Thieving** — the one OSRS skill with no Varath analogue at all (Bounty
  covers Slayer, Survivalist covers Firemaking, Woodcraft covers Fletching,
  Faith covers Prayer + Magic + Runecrafting). A 21st `SkillId`: pickpocketing
  the 59 existing `npc` spawns, market stalls (Ironvale's market already
  exists in `map.ts`), and locked chests. Needs one new `ObjKind` (`stall`), a
  `STEAL` intent, and a stun-on-fail state reusing WS5's machinery.
- **Random events** — a tick-driven roller spawning a temporary NPC near the
  player. Cheap on the existing spawn/dialogue seams.
- **Deepen the thin content.** `lore.ts` is only 16 fragments; `factions.ts`
  is metadata-only — four factions with no faction *content* behind the
  reputation numbers. The two clearest expansion targets in the repo.
- **Diaries → OSRS tiers.** Today 9 regions × 4 tasks, one flat tier,
  XP-lamp-only rewards. Should become Easy/Medium/Hard/Elite per region with
  real reward *perks* (shortcuts, better rates, teleports), reusing the
  existing `AchievementCond` evaluator.

## Phase 3 — Endgame & progression

- **Collection log.** Core already tracks `player.collection` and pays
  quarter-milestone lamps (`worldCore.ts:5855-5884`). What is missing is the
  *log*: per-source categories (each boss, each clue tier, each skill), a UI
  panel, completion tracking. Cheapest high-value item in the phase.
- **Combat achievements** — tiered per boss, reusing `AchievementCond` and the
  Phase 1 combat events.
- **Ironman / Hardcore modes** — a save flag gating the Grand Exchange, P2P
  trade and duel stakes, plus a death-is-final path. Small, and it pairs
  naturally with the Phase 1 death rework.
- **New gear tier + mastery beyond max.** `XP_CAP = 100M` already lets XP
  climb past level 100 (`src/content/xpCurve.ts:36-39`), so the prestige
  substrate exists; it needs a visible mastery layer on top.
- **Raids.** ⚠️ **Named blocker: there is no per-player instancing.**
  "Instances" today are fixed coordinate bands — `HOME_LOTS`
  (`src/content/map.ts:191`) is *three hardcoded lots*, and `instanceRectAt()`
  merely masks the renderer to a rect of the one global grid. Raids (and
  Phase 5) need real instance duplication. Budget it as its own workstream,
  not a detail of raid content.

## Phase 4 — The Greater World (VW 2.0 Phase 1)

Already specced outside this repo: a 400×400 overworld (~6× area), the six
region seats grown into real towns, 8 new ungated zones, a 14-camp roster, NPC
daily routines. It extends the existing single `remap()` transform
(`map.ts:80`) rather than re-authoring coordinates — a pattern this codebase
has already survived once (112×108 → 160×164).

**Deliberately sequenced after combat parity**, against the original
world-first ordering: populating 6× the map with monsters tuned to the *old*
combat model would mean re-tuning every one of them afterwards.

## Phase 5 — Real multiplayer (capstone)

Replace the `CoreBridge` literal at `src/main.ts:208-221`. Three known
obstacles, all already documented:

- `send`/`tick` are synchronous and return events immediately.
- `state` is handed out as a live mutable object that `render.ts`, `hud.ts`
  and `minimap.ts` read every frame.
- `WorldState` has one `state.player`, not a players map —
  `server/README.md:34` acknowledges this.

`server/serverStub.ts` sketches the `AuthoritativeWorld` shape with no socket
code on purpose.

**Wilderness PvP and skulls land here**, not earlier — they are only
meaningful once players share a world. Duels already work peer-to-peer via
deterministic lockstep, which is the proof the core is deterministic enough
for netcode.

---

# Verification

There is no test runner, and this plan does not add one. The established gates:

1. **`npx tsc --noEmit`** — strict, with `noUncheckedIndexedAccess` and
   `exactOptionalPropertyTypes`. One pre-existing `style.css` error is
   expected; filter it. Because `ItemId` is a hand-maintained union and every
   content reference is type-checked, this alone proves the data layer is
   internally consistent.
2. **Headless `npx tsx` sims** driving `createWorld` / `applyIntent` / `tick`.
3. **Manual feel-test on a dev server** for anything visual or timing-related.
   The tick change and the hitsplat work **cannot** be signed off headlessly.
4. **The `?test=1` seam** — `src/main.ts:357` exposes
   `window.__varath = { game, bridge, audio, content }`, so an external
   browser driver can push real intents through the bridge and assert results.

## The sims to write, per workstream

Write the **baseline sim first**, before any code change, and commit its
output. It is the only thing that will tell you whether WS2 broke the balance.

| # | Asserts |
|---|---|
| **Baseline** | For all 85 monsters: hit chance, mean damage, TTK, XP/hr, kills/hr. Recorded to a checked-in JSON fixture. |
| WS1 | Walking N tiles takes N ticks; running takes ⌈N/2⌉; a 2400ms weapon fires every 4 ticks; TTK within 5% of baseline. |
| WS2 | Re-run the baseline — **every monster within 10% of its recorded TTK**. Damage distribution includes 0. Accuracy matches the OSRS formula on hand-computed cases. |
| WS3 | All 704 items produce a complete, finite bonus vector; the armour triangle holds (plate beats leather vs crush, robes beat plate vs magic); the ~14 overrides win over the deriver. |
| WS4 | Every `wepType` has a full option set; each option maps to a valid attack type and XP split; a version-1 save migrates to a valid option. |
| WS5 | Poison decays to zero and stops; venom ramps and does not; drained stats restore at 1/min; all deterministic under a fixed seed. |
| WS7 | Death drops everything but 3 (4 with protection); the grave holds it; reclaim returns it; a second death has defined behaviour; a version-1 save loads with no grave. |

**Save compatibility is a hard gate on every step.** `src/core/save.ts` must
load a pre-change save and produce a playable character. Verify by checking in
a fixture save and asserting a round-trip in a sim.

---

# Cleanup to fold in along the way

Several doc comments are badly stale and will mislead the next reader. Fix
each one in whichever batch touches that file:

| Where | Says | Actually |
|---|---|---|
| `src/content/items.ts:5` | 467 items | 704 |
| `src/content/monsters.ts:6` | 30 monsters | 85 |
| `src/content/skills.ts:8-10`, `src/core/types.ts:76-80` | farming/construction/bounty/ward/draw are "later bundles" | all wired |
| `src/core/types.ts:1227` | combat is "simplified… maxHit/hp/xp only" | it is not |
| `src/content/actions.ts:10` | references `processing.ts` / `forging.ts` | both deleted |
| `README.md` | a one-zone demo | seven regions, 20 skills |
| `docs/CANON_LEDGER.md` | a 64×56 world | 160×364 |
