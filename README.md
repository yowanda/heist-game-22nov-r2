# heist-game-22nov-r2

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/yowanda/heist-game-22nov-r2/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/yowanda/heist-game-22nov-r2/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**Meridian Midnight** — a top-down heist game. Cross the Meridian Gallery past patrolling guards' vision cones and sweeping wall cameras, crack the vault safe in a dial minigame, pocket the gold, the diamond and the portrait, and slip out to the getaway van before the alarm hits 100% or dawn breaks at 05:00. Three routes in: the fast main hall, the quiet west corridor, or a slow crawl through the air duct where no cone can see you. Smoke pellets blind the watchers; the jammer kills the cameras for 8 seconds at a price.

## Controls

- **WASD / arrow keys** — move (or click / tap where the thief should go)
- **Shift** — sneak: slower, much harder to spot
- **E** — work the vault safe (when standing at it)
- **Space** — stop the safe dial inside the green zone (3 clean turns crack it; a miss is loud: +12 alarm)
- **1** — smoke pellet (×3, blocks all vision for 5s)
- **2** — camera jammer (×2, cameras dark for 8s, −$100)
- **R** — restart · **P** — pause · **M** — mute

## Run it

```sh
cd game && python3 -m http.server 8080
```

Then open http://localhost:8080 in a desktop browser. No build step, no network: every file the game loads lives under `game/`.

## Files

- `game/index.html` — page, HUD, overlays
- `game/main.js` — game loop, state machine, input, photo/self-test modes
- `game/level.js` — the gallery floor plan (walls, duct, loot, patrols)
- `game/guards.js` — patrols, vision cones, line of sight, alarm pressure
- `game/player.js` — movement, collision, tools, loot
- `game/vault.js` — the safe-cracking dial minigame
- `game/render.js` — all canvas drawing
- `game/audio.js` — synthesized WebAudio sounds
- `main.ts` — the make.fun entrypoint: copies `game/` + `screenshots/` to the output and writes `dossier.json`

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
