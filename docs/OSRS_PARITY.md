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

## WS0 — The sim harness *(do first — it does not exist)*

`tsx` is **not a dependency**, there is no `sims/` directory, and `node_modules`
is not installed. Before any code changes:

- Add `tsx` to `devDependencies` and `sim:*` scripts; add `"sims"` to
  `tsconfig.json`'s `include` so the sims are typechecked too — they are the
  only regression net this repo has.
- `sims/harness.ts`: **reuse `mulberry32` from `duelCore.ts`** (already the
  project's seeded PRNG) — do not write a second one. Export `makeCtx(nowMs)`
  matching `src/main.ts:71`, an `advance()` that ticks in sub-`TICK_MS` slices
  so the accumulator at `worldCore.ts:4782` behaves like a real rAF loop, and
  one shared `levelMatchedPlayer(content, level)` built via **`equipRequirement`
  (`worldCore.ts:2842`)** so every balance sim agrees on what "level-matched"
  means.
- **Commit `sims/baseline.ttk.json` and `sims/baseline.rates.json` generated
  against unchanged code.** Nothing below is trustworthy without them.

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

### Two regressions that are NOT "unaffected ms"

The claim that ms-expressed timings are unaffected holds only for schedulers
that *accumulate*. Verified in the tree, they split two ways:

- **Combat accumulates and is safe** — `worldCore.ts:6857` does
  `nextActionAt += playerSpeed(...)`, so quantization changes jitter but not
  average rate.
- **Gathering and crafting do not** — `:5470`, `:5515`, `:5525` and
  `beginGather` all do `nextActionAt = ctx.now + interval`, and `ctx.now` is
  already tick-quantized. The effective interval becomes
  `ceil(interval / TICK_MS) × TICK_MS`, which **only ever gets slower**.

**This wrecks the top of the tool ladder.** `TOOL_TIER_SPEED`
(`worldCore.ts:2830`) runs 1.0 → 0.45. A tier-10 pickaxe at 1500 × 0.45 =
675ms quantizes to 1200ms — **a 44% rate loss**. Base mining 1500 → 1800
(+20%); fishing 1300 → 1800 (+38%). This is silent: no crash, no bug report,
just "levelling feels slow now", while invalidating every xp/hr figure on
record.

**Fix:** stop expressing gather cadence in ms. Fix the swing at **4 ticks
(2.4s)** — OSRS's gathering beat — and move the tool ladder out of *interval*
and into *success chance* (`WOODCUTTING.success` / `MINING.success` /
`FISHING.success`, `worldCore.ts:197-199`). That is what OSRS actually does,
it deletes the quantization problem outright, and the rates can be refit
exactly against `baseline.rates.json`.

**Pursuit silently stops working.** `wanderCreatures` reserves a tile on one
tick (`obj.wanderTarget`, `:5131`) and only commits the hop on the next
(`:5091-5095`) — **two ticks per tile**. At 200ms that's 400ms/tile, faster
than the player's 600ms walk. At 600ms it becomes **1200ms/tile, half the
player's walk speed, so no aggressive monster can ever reach a walking
player.** Aggro still fires and `PURSUE_MS` still counts down; the whole
system just becomes decorative, and nothing surfaces it. **Fix:** in the
`(engaged || pursuing)` branch, commit the step in the same tick instead of
reserving; keep reserve-then-hop for idle ambling, where it is a pacing
feature. `NPC_STEP_TICKS` 3 → 1.

**Risk — what gets coarser.** Boss slam/cleave dodge windows (`resolveSlams`,
`worldCore.ts:7774`) are `windupMs` 2000–2800, which all collapse to 4–5
ticks; combined with running at 2 tiles/tick a radius-1 slam becomes dodgeable
in *one* tick — too generous. Add `windupTicks` to the `slam`/`cleave`
mechanics and author 3 ticks as the norm. The pier tension minigame runs its
own rAF loop in `tensionUI.ts` outside the tick and is genuinely unaffected.
Both still need a real browser check.

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

**The max-hit compression is the real problem.** At vigour 99 with a +86
strength bonus, today's model gives `round(99 × 0.6) + 86 = 145`, ×1.12
stance ≈ **162**. OSRS's formula gives
`floor(0.5 + 118 × 150 / 640) = **28**` — a **~5× drop**, against monster HP
pools reaching 2600. Left alone, the apex bosses become 10-minute fights and
every drop-rate, bounty count and Delve figure on record is invalid.
**Do not scale monster HP** — that invalidates every implied kill rate and
bounty task count. Expose one `COMBAT.maxHitScale` multiplier and fit it by
sim against baseline median TTK. Expect ≈ 4–6.

**Combat XP is immune, and that is why this is tractable.** XP is granted per
point of damage, and total damage per kill equals monster HP regardless of how
the distribution is shaped — so WS2 needs **no XP retuning at all**.

**Zeros have consequences beyond the splat.** Specials must stay guaranteed
`1..maxHit` (that is their identity); `recoil` and `lifedrain` need a
`dmg > 0` guard or a 0-hit burns you for 1; spec charging fires on any landed
hit, so charging on zeros needs `SPEC_GAIN_PER_HIT` dropped to compensate;
monster damage moves from `randInt(1, maxHit)` to `randInt(0, maxHit)`,
halving mean damage per landed hit, so `COMBAT.monsterDmgMult` must be refit.

**Monster stats are not in OSRS units** and must not be hand-authored across
85 monsters. Derive: fit a conversion from each monster's existing
`acc`/`def`/`maxHit` so post-change accuracy and TTK track current values,
then expose the fitted coefficients as named constants in the `COMBAT` block
(`worldCore.ts:378`). Layer every existing modifier on top of the new roll
rather than replacing it — the weakness triangle (`weaknessAcc 1.5`,
`weaknessDmg 1.4`), `bossOffStyleDmg 0.6`, `eliteOffStyleDmg 0.85`,
scaleguard, and the `wardDivisor` soak.

**Removing the flat `wardDivisor` soak is a second, separate risk.** Defence
should lower hit *frequency*, not subtract a flat N — but until a low-level
player's defence *roll* advantage is large enough to replace that flat soak,
they take full damage from trash they used to shrug off. It is silent until
someone dies to a rat. Assert deaths-per-100-fights per monster, not just TTK:
**TTK can be preserved while the game becomes unsurvivable.**

**This is the workstream most likely to blow up the balance**, because three
changes land at once — the ~5× max-hit compression, the zero-floor roll, and
the soak removal — each individually tunable, together moving TTK, incoming
DPS, food consumption *and* variance simultaneously. Guard: put both formulas
behind a `COMBAT.formula: "legacy" | "osrs"` switch so a regression is
bisectable and both can be printed side by side; write the TTK/death-rate sim
*before* touching the formulas; treat >10% TTK drift as a bug, not a new
balance point.

**`duelCore.ts` mirrors the PvE curve verbatim** (its own `DEF_WEIGHT` /
`HIT_FLOOR` / `HIT_CAP`) and folds `acc`/`dmg`/`def` into `fighterFingerprint`,
the desync hash. Two clients on different builds would **desync mid-duel over
real staked gold**. Add a `formulaVersion` to `DuelFighter`, refuse to start on
mismatch, and fold it into the fingerprint.

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
(stab/slash/crush) and the XP split.

⚠️ **`wepType` does not exist on every weapon.** Measured: only **30 items**
carry it (dagger 9, hammer 7, spear 6, claymore 6, sword 2) out of ~58
weapons — and **none of the 9 bows or 9 staves have one**, nor do 7 of the 9
swords or the legendaries. A bare `Record<WepType, …>` therefore covers under
half the arsenal. **Ship a `wepTypeOf(def)` deriver first**: explicit
`wepType` → `ranged ⇒ bow` → `magic ⇒ staff` → id prefix
(`sword_`/`dagger_`/`spear_`/`hammer_`/`claymore_`) → `attackStyle`
(slash⇒sword, stab⇒dagger, crush⇒hammer) → `tool` → `unarmed`. Then tighten
`ItemDef.wepType` from `string` to the real union and let tsc find every
literal. It belongs next to the WS3 deriver, same file, same philosophy.

Note also that weapon `speed` is **absent** on all bows, all `sword_*` and 5
legendaries — they silently fall through to `COMBAT.playerMeleeSpeed` 2400.
Worth fixing while in here.

Add `WEAPON_STYLES: Record<WepType, AttackOption[]>` in content, replacing the
flat `STYLE_MODS` (`worldCore.ts:434`) as the source of the acc/dmg/def
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

**Prerequisite: the death path is duplicated.** `PLAYER_DIED` is pushed from
two places — `worldCore.ts:7556` (full: gold + pack spill + `deathSpillStacks`)
and `:7822` in `resolveSlams` (degraded: coin only, pack left intact). WS5's
poison death would add a third. Extract one `killPlayer()` first; it is
independently verifiable and the gravestone work depends on it. Decide the
slam-path discrepancy deliberately — a death should be a death.

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

---

# What actually landed, and what it cost

*(Recorded after building WS0–WS3. Gates: `npx tsc --noEmit` clean, `sims/tick.ts`,
`sims/rates.ts`, `sims/bonus.ts`, `sims/ttk.ts --check`.)*

## Two planned steps turned out to be unnecessary

The gather tool ladder and craft cadence were both going to be redesigned for the
600ms tick. Neither needed it. The real defect was that gathering and crafting
rescheduled with `= ctx.now + interval` against the discrete tick clock, so every
step rounded **up** and the error compounded. Combat already accumulated with
`+=`. Making the others match keeps the *average* interval exact even though each
swing lands on a tick boundary — all 16 distinct gather intervals survive.

Worth noting the approach that was approved and then abandoned: moving the tool
ladder into *success chance* could not have worked. Success is capped at 0.95 by
level 100 regardless of tool, so success chance can carry a ~5% ladder at most —
not the 2.22× the intervals give.

## Three deliberate deviations from OSRS, all preserving earlier decisions

This codebase had already tried and rejected several OSRS behaviours. Where that
was recorded in a comment, the earlier decision won:

| OSRS | Varath keeps | Why |
|---|---|---|
| Flat +3 stance bonus | Multiplicative stance on the effective level | The `STYLE_MODS` comment records that a flat +3 was considered and rejected for a tradeoff you feel mid-fight |
| Magic damage as a percentage | A flat add | A percentage ladder for nine staves is churn without a payoff |
| Run at 2× walk | *(overridden — now 2× walk)* | Trevor's explicit call, against the earlier "felt too fast" note. **The most likely thing in this work to be reverted on feel.** |

## The measured cost of WS2

`npx tsx sims/ttk.ts --check`, against the recorded baseline:

| | |
|---|---|
| Median TTK ratio | **1.000** |
| Within 10% of before | 24/80 monsters |
| Beyond 2× either way | 1 (`ashen_wyrm`, 0.48×) |
| Mean death rate | 15.1% → 16.4% |
| Median damage output | **+7%** |

**The aggregate is preserved; individual monsters are re-rated.** Two separate
effects are mixed in that "24/80":

- **Measurement granularity.** Time-to-kill on a short fight is heavily
  quantized — a 7-second kill is about three swings, so one swing either way
  reads as a 40% move. Several monsters cluster at exactly 1.49× and 0.50× for
  this reason alone. The unquantized measure (hit rate × damage per landed hit,
  reported alongside) is the one to trust.
- **Genuine re-rating.** A single linear conversion of 85 hand-tuned monster
  `acc`/`def` values onto OSRS's roll scale cannot reproduce the old ratio
  curve's shape everywhere, and the armour triangle re-rates every matchup by
  design. Monsters move by up to ~1.8× in damage output.

Tightening this further would mean per-monster correction factors — which is
hand-authoring 85 monsters by another name, and would defeat the point of a
derived conversion. **The open call is whether the aggregate is good enough or
the roster wants a re-tune pass.** Three monsters became notably deadlier and are
the first place to look: `hollow_warden` (10% → 50% deaths), `hollow_prophet`
(0% → 70%), `green_baron` (0% → 30%).

## Phase 1 is complete

All seven workstreams shipped. `npm run sim:tick | sim:rates | sim:ttk | sim:bonus | sim:styles | sim:status | sim:death` are the gates; `tsc --noEmit` and `npm run build` are clean.

| WS | What landed |
|---|---|
| 0 | Sim harness + committed baselines — the only regression net this repo has |
| 1 | 600ms OSRS tick; walk 1 tile/tick, run 2 |
| 2 | OSRS accuracy and damage rolls, damage from zero |
| 3 | Ten-way equipment bonus vector, armour triangle, Equipment Stats sheet |
| 4 | Per-weapon attack options — the triangle as a live mid-fight decision |
| 5 | Poison, venom, antidote |
| 6 | Hitsplats, blue zero, target health bars |
| 7 | Gravestones, uncapped coin risk, the quick bar |

**Five live bugs were found and fixed along the way**, none of them the thing being built at the time: a fishing rod's tier applied only to the first cast; a better gathering tool in the pack was ignored whenever a usable one was equipped; the player-death path existed twice, and the boss-slam copy quietly skipped the pack loss; `playerSwing` read the weapon's fixed style rather than the chosen attack option, leaving WS4 inert; and the survivability sim was measuring a player who never ate.

**The measurement lesson worth carrying into Phase 2.** Three times an alarming number turned out to be the instrument rather than the game — an unfed player reading as "70% lethal", a venom test whose subject was being killed by `syncMaxHp` clamping, a TTK spread that was mostly swing-count granularity on short fights. Check what the sim is actually doing before changing tuned content on its word.

**Still open, and only feel can settle it:** run at 3.33 tiles/s. It reverses a decision this codebase had previously made on feel, it is the cheapest thing here to revert, and no sim can judge it.

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

- ~~**Collection log.**~~ **Done.** `src/content/collectionLog.ts` derives
  **115 categories / 1,340 entries / 579 distinct items** at boot from the
  sources themselves — monster drop tables, `CONTAINER_TABLES`, skill action
  `produces`/`rareDrop`/`seedDrop`/`woodShardDrop`, the crop table, shop stock,
  quest `reward.items` *and* mid-quest `giveItem` choices, and the Bounty
  exchange. Eight shelves: Bosses (16) · Treasure Trails (3) · Bounty (1) ·
  Skilling (12) · Monsters (64) · Quests (1) · Shops (17) · Other (1).
  Rendered into the Records tab as nested accordions on the existing delegated
  `[data-toggle]` handler, each source naming what is still missing in plain
  text (hover tooltips do not exist on a phone). `sims/collection.ts` guards it.

  The old panel grouped items by `ItemDef.cat` — "Armour 40/120" — which is the
  same non-answer as the flat percentage it replaced. Grouping by source is the
  whole point: *"Vorlag 3/7"* sends you somewhere.

  **Deriving it turned up a real bug — and the first count of it was wrong.**
  The initial pass reported 57 unsourced equippables. That number was an
  artifact of an incomplete deriver, not of the game: skilling pets roll off
  `tryPetDrop` on `meta.petSkill`, four uniques sit in `dungeon_chest` loot,
  `reckoners_charm`/`pet_superior` come off Superior encounters, and
  `cape_ironvale`, `rod_gold`, the founder items, clue scrolls, kill draughts
  and part-drunk vials are all granted in code the deriver was not reading.
  Teaching it those sources — `CLUE_TIERS`, `POTION_POOL`, `SUPERIOR_UNIQUES`
  and `FOUNDER_ITEMS` are now exported for it, the rest read from item and
  object data — cut the figure to **32 genuinely stranded items**.

  **Why that mattered more than a tidy log.** `collectionProgress`
  (`worldCore.ts:6309`) counts *every* catalogued non-Quest item, and
  `maybeGrantCompletionCape` grants **Ironvale's Cape** only when that count is
  full. An item with no source therefore did not merely sit unused — it made
  the grandmaster reward unreachable. Someone had already written the cape's
  grant path ("Tier-0 fix: the cape had no code path to be earned"); the gate
  behind it was still impossible.

  **All 32 now have sources, each taken from the item's own description:**

  | Stranded | Fix |
  |---|---|
  | 16 gathering-outfit pieces (Prospector / Lumberjack / Angler / Farmer) | New `tryOutfitDrop` in the core, 1/8,000 per action on `meta.skillBonus` — the same shape as `tryPetDrop`, missing pieces only. Item data is the registry, so a fifth set needs no code. |
  | 6 Heraldry pieces | Six new Crafting recipes under a `heraldry` group, each using the exact materials its description names (knucklestone + gold, spinite + gold, coldvein + bloodore, ribstone + voidstone, wood ash, dusk bark). |
  | 9 mounts | Five drop from the creature their description names (Greymane Boar, Dread Ferryman, Deep Bat, Marrow Wraith, Hollow Warden), three from where it names (Cave Crawler, Marrow Keeper, Vorlag), and the Lodge Outrider is released at the stables on Lodge standing — matching the stable's own comment that "the rarest steeds … are earned". |
  | 6 materials + 2 foods + Ward Oil + the watchtower frame | Ten new actions filling holes in ladders that already existed: the one unmilled plank, the one uncut haft, wood ash and fine charcoal beside `charcoal`, dusk bark, the two top-tier forage foods above `ashroot_elixir`/`dawnspore_draught`, a Herblore Ward Oil, and an 85-Construction watchtower above `vault_stone`. |
  | Hunter's Trophy | Rare drop from the Greymane Boar — "a rare keepsake from a great hunt". |
  | `neck_war` / `neck_ward` / `neck_hunt` | **Deleted.** Strictly worse duplicates of the craftable `craft_neck_power` / `craft_neck_shield` / `craft_neck_hunter` ladder. |
  | `token_spine` / `token_heartmoor` / `token_marrow` / `token_redrun` | **Deleted.** Passage tokens for region gates Varath does not have — nothing in the codebase reads them, and its dungeon gates use quest keys. |

  Catalogue: 706 → **699 items, every one of them obtainable**. `sims/collection.ts`
  now asserts that the log covers *exactly* what `collectionProgress` counts
  (667/667), so an item added without a source fails the sim instead of quietly
  locking the cape.

- ~~**Combat achievements**~~ **Done.** `src/content/combatAchievements.ts`
  derives **67 tasks** from the boss roster: four per reachable boss (felled /
  untouched / no provisions / swift) plus three ladder capstones, tiered
  Easy→Master by the boss's own combat level. They are appended to
  `content.achievements`, so they flow through the existing evaluator, unlock
  check and Records UI with no special-casing.

  **What had to be built.** A kill count measures patience; these measure play,
  and that needs something the game never recorded — what happened *during* one
  fight. `WorldState.fight` opens on the first blow struck at a boss and closes
  on the kill, tracking damage taken and heals eaten. It lives on WorldState,
  not Player, so **no save format change** and a half-finished no-hit run cannot
  survive a reload. Only the earned feats persist (`Player.combatFeats`,
  optional so old saves load). Dying abandons the run, and so does the boss's
  35% relocation heal — otherwise you could whittle a boss across several trips,
  healing between them, and still claim you were never hit.

  **The par time needed two constants, not one.** `sims/feats.ts --fit` measured
  a level-matched player needing **~190ms per point** of a level-23 boss's HP
  and **~10ms** per point of a level-95 one — the player fighting the later boss
  is enormously stronger. A flat ms-per-HP par would hand every high-level boss
  the feat for free and put every low-level one out of reach, splitting the
  ladder by boss level instead of by how well you fought. So par is
  `hp × A × level^−B`, fitted to `A=200, B=0.38`: **5 of 16** level-matched
  fights beat it, which is the intended bar — provably attainable at every tier,
  still asking something of you.

  **Ironvale's Cape was deliberately left alone.** Its promise is "every
  achievement", written when that meant the 41 hand-authored ones. Folding in 67
  derived tasks including a no-hit Vorlag kill would silently redefine what it
  asks, so `maybeGrantCompletionCape` now filters them out; combat achievements
  are their own ladder with their own capstone (Grandmaster of Arms).

  `sims/feats.ts` guards it: the recorder is tested through the real core
  (whenever a kill lands with zero damage taken, "perfect" must be banked, and
  such a kill must actually happen), eating must falsify "unfed", and par must
  sit between 5% and 45% of level-matched fights.
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
2. **Headless `tsx` sims** driving `createWorld` / `applyIntent` / `tick`.
   ⚠️ `tsx` is **not currently a dependency** and there is no `sims/`
   directory — see WS0.
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
| **Baseline** | For all 85 monsters: hit chance, mean damage, TTK, **deaths per 100 fights**, XP/hr, kills/hr — plus gather actions/min for each of the 10 tool tiers. Two checked-in fixtures. |
| WS1 | Walking N tiles takes N ticks; running takes ⌈N/2⌉; a 2400ms weapon fires every 4 ticks; TTK within 5% of baseline; **a pursuing wolf closes on a walking player** (catches the reserve-then-hop bug); gather actions/min within 5% of baseline for all 10 tool tiers. |
| WS2 | Re-run the baseline — **every monster within 10% of its recorded TTK**, and **deaths per 100 fights not more than doubled** for any monster below level 30. Damage distribution includes 0. Accuracy matches the OSRS formula on hand-computed cases. |
| WS3 | All 704 items produce a complete, finite bonus vector; the armour triangle holds (plate beats leather vs crush, robes beat plate vs magic); the ~14 overrides win over the deriver. |
| WS4 | **Every weapon in `items.ts` resolves to a `WepType` present in `WEAPON_STYLES`** (catches the 28 weapons with no `wepType`); every `wepType` has a full option set; each option maps to a valid attack type and XP split; a version-1 save migrates to a valid option. |
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
