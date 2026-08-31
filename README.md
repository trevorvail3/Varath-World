# Varath World

A 2D, top-down, tile-based world game with an old-school RuneScape feel:
tap the ground to walk, tap things to interact. Mobile-first, single-player
for now — but built so a play-with-friends server can be added later
**without a rewrite**.

This repository (**World**) holds Varath World only. It is intentionally kept
separate from any other project.

---

## What is in it

Varath World is **generated from the idle game's canon** — see
`docs/CANON_LEDGER.md` — so the items, skills and creatures are the same world,
walked rather than watched.

| | |
|---|---|
| Skills | **21**, on the idle game's own XP curve |
| Items | **467**, ported verbatim from canon |
| World | **8 zones**, 6 towns, 8 dungeons |
| Creatures | 33 |
| Quests | 49, with a dialogue system behind them |
| Also | banking, a grand exchange, shops, duels, trade, friends and chat, hiscores, achievements, a collection log, diaries, farming, construction, spellcasting |

Tap the ground to walk. Tap a person, rock, tree or beast to act on it. Hold to
inspect. It is mobile-first and plays in a browser with no install.

**Sign-in is the same account as the idle game and Hearthkeep** — one Supabase
project, one `auth.users`. There is a **"Play offline"** door too: a purely
local character kept in this browser, which never touches the cloud.

---

## Where it lives

`ivstudios.vercel.app/world/` — proxied in under the studio's one origin, which
is deliberate: `localStorage` is per-origin, so a shared sign-in only carries
between the games if they are served from the same one. See `DEPLOY.md` in the
`ivstudios` repo.

> [!warning] The trailing slash is load-bearing
> Link to `/world/`, never `/world`. A rewrite is a proxy, so the address bar
> keeps the path you asked for — and this builds with Vite's `base: "./"`, so
> the HTML asks for `./assets/…`, which a browser resolves against the
> **directory** of the current URL. At `/world` that directory is `/`, and the
> bundle 404s into a blank page. `ivstudios/vercel.json` redirects the unslashed
> form for exactly this reason.

---

## The three rules (please don’t break these)

These three rules are what make a multiplayer server possible later. Everything
is organised around them.

1. **The core is pure.** No DOM, no `Date.now()`, no `Math.random()` anywhere in
   `src/core`. Time and randomness are passed in via a `ctx = { now, rng }`
   argument. This makes the game logic deterministic — the same inputs always
   produce the same result, which is exactly what a server needs.

2. **The client never changes game state directly.** It sends **intents**
   (e.g. `{ type: 'INTERACT', objId }`) to the core, then renders the core’s
   state plus the **events** the core returns. All change flows through
   `applyIntent` and `tick`.

3. **Content is data, and lives only in `src/content`.** The map, items, the XP
   curve, skills and spawns are plain data. Player state is kept separate from
   content.

---

## Project layout

```
src/
  content/   game DATA — xp curve, items, skills, the map, spawns
  core/      pure game logic — types.ts, worldCore.ts  (RULE 1)
  client/    presentation only — pathfinding, render, hud, dialogue, the loop
  main.ts    wires a LOCAL core to the client (the swap-point for multiplayer)
server/      a documented STUB for the future friends-server
```

The client talks to the core through one small seam, the **`CoreBridge`** in
`src/client/loop.ts`. Today `src/main.ts` fills it with a local core. A future
multiplayer build would fill the same seam with a network connection to the
`server/` — without touching the core or the client. See `server/README.md`.

---

## How to run it

You’ll need **Node.js** (v18 or newer). Then, from this folder:

```bash
npm install      # download the tools (one time)
npm run dev      # start the game; open the printed http://localhost:5173 link
```

Open that link in a browser (or on your phone, using the network URL it prints)
and tap around The Knuckle Hills.

### Other commands

```bash
npm run typecheck   # check the TypeScript types — should report zero errors
npm run build       # type-check then produce an optimised /dist folder
npm run preview     # serve the built /dist locally to test it
```

---

## A note for non-coders

If you only ever want to *see it run*: install Node, then run `npm install`
once, and `npm run dev` whenever you want to play. The terminal prints a link —
click it. To stop the game, press `Ctrl + C` in the terminal.
