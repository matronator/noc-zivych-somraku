# Noc živých somráků — Hlavák

A Czech-language 2D arcade survival game set around Prague Main Railway Station (*Praha hlavní nádraží*). Sprint from Sherwood through the station concourse and underpass to Platform 3 before the last train leaves — while protecting the cash and cigarettes you need for your ticket.

> **They don't want your brains. They want your change.**

## Gameplay

You have **two minutes** to reach the train. The route takes you through several areas of the station, each with its own hazards and enemies. Getting cornered can cost you money or cigarettes, and dropping below the minimum means the run is over.

* **Starting supplies:** 250 Kč and 8 cigarettes.
* **Minimum to board:** 120 Kč and 3 cigarettes.
* **Shout “NEMÁM!”** to knock nearby pursuers away.
* **Throw a 10 Kč coin** as bait to distract enemies.
* **Collect pickups** such as cash, cigarettes, coffee and headphones to improve your chances.
* **Survive four enemy types:** the slow but numerous Bezďák, the charging Teplákář, the slowing Smraďoch and the final boss, Velkej Béďa.

The game interface and in-game text are currently in Czech.

## Controls

### Keyboard and mouse

| Action                                            | Control                       |
| ------------------------------------------------- | ----------------------------- |
| Move                                              | `W` `A` `S` `D` or arrow keys |
| Shout and push nearby enemies away                | `Space` or `J`                |
| Throw a 10 Kč coin as bait                        | `E`, `K` or `Shift`           |
| Throw bait at the cursor position                 | Left-click during a run       |
| Pause / resume                                    | `P` or `Esc`                  |
| Toggle sound                                      | `M`                           |
| Start, resume or restart from the relevant screen | `Enter`                       |
| Restart from the pause or results screen          | `R`                           |

### Touchscreens

Drag anywhere on the play area to move. Use the on-screen action buttons to throw bait or push enemies away.

## Run locally

### Requirements

* Node.js version compatible with Vite 7
* npm

### Install and start the development server

```bash
npm install
npm run dev
```

Open the local URL printed by Vite in your terminal.

### Production build

```bash
npm run build
```

The production output is written to `dist/`.

To preview the production build locally:

```bash
npm run preview
```

## Built with

* **React 19** and **TypeScript** for the application and game UI
* **HTML Canvas 2D** for the real-time game world and rendering
* **Vite** for development and production builds
* **Tailwind CSS 4** and custom CSS for styling
* **Web Audio API** for synthesized sound effects

## Project structure

```text
src/
├── App.tsx              # Title screen, HUD, pause/results screens and scoreboard
├── GameCanvas.tsx       # Canvas setup, frame loop and keyboard/mouse/touch input
├── index.css            # UI styles, layout and visual effects
├── main.tsx             # React entry point
├── game/
│   ├── audio.ts         # Synthesized sound effects
│   ├── constants.ts     # World dimensions, rules and gameplay constants
│   ├── engine.ts        # Simulation, player/enemy behaviour, collisions and scoring
│   ├── level.ts         # World layout, zones, enemy placement and pickups
│   └── render.ts        # Canvas rendering and visual effects
└── utils/
    └── cn.ts            # Class-name utility
```

## Scores and privacy

The game runs in the browser and does not require a game server. The top-eight scoreboard, player nickname and sound preference are saved in the browser's `localStorage`; scores are local to that browser and are **not** shared online.

## License

MIT License

Copyright (c) 2026 Matronator

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
