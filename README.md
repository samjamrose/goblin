# Goblinsburg

A mobile-first pixel-art fantasy tycoon game. Start with a muddy camp and two goblins, and grow it into a gold-toothed goblin empire full of ridiculous characters.

Every pixel (goblins, buildings, terrain, enemies, icons) and every sound is generated in code. There are no image or audio files, and no frameworks or runtime dependencies.

## Play

- **Locally:** serve the folder with any static server, then open `index.html`.
  ```sh
  node tests/serve.mjs . 8123   # then visit http://localhost:8123
  ```
- **Single file:** `npm install && npm run build` creates `dist/index.html`, a fully self-contained build you can host anywhere (or open directly).
- **GitHub Pages:** Settings → Pages → Source: *Deploy from a branch*, pick the branch and the `/ (root)` folder. The site is then at `https://<user>.github.io/goblin/`. It works offline after the first visit (service worker) and can be installed to a phone's home screen.

Progress saves automatically to the browser (every 15 seconds and whenever you leave). You can also export or import a save code under **More → Settings**.

## Features

| System | What it does |
|---|---|
| **The Deep Mines** | All gold is dug underground. Cross the bridge and take the boat from the dock to reach them. 13 depths (Muddy Dig → Copper Vein → … → Core of the World), each upgraded with gold. Every depth gets longer and adds new machinery at Lv 1, 5, 10, 25, 50, 75, 100, 150, 200 and 300, and reaching Lv 10 lets you dig to the next depth. |
| **Capital building** | 13 businesses (Mushroom Patch → Ore Smelter → … → Goblin King's Palace) that each power the mine depth below them, plus 7 utility buildings. Each has 5 visual tiers that change as it levels. |
| **Economy** | Gold, mushrooms, ore and gems. Milestone levels (25, 50, 100, 200…) double a depth's gold. Coin bubbles float up in the mines for tap bonuses. |
| **Territory** | 5 districts to unlock: Muck Camp, Market Ward, Shady Alley, Hoard Hill and Dragonview Heights. |
| **Goblin recruitment** | Summoning Cauldron with mushroom and gem recruits, five rarities (Common → Mythical), pity timers, and 23 hand-designed named heroes with unique abilities. Duplicates add stars. |
| **Jobs** | 11 professions. Assign goblins to buildings (a matching job gives the full bonus), to defense, or to expeditions. Goblins walk to work and visibly do their jobs. |
| **Personalities** | 15 traits (Greedy, Lazy, Smelly, Dramatic…) with stat effects and their own dialogue. |
| **Upgrades** | Building levels, goblin training, 28 research projects, equipment forging, and prestige perks. |
| **Exploration** | 7 regions, from the Whispering Woods to the Ember Peaks (dragon territory). Each has 10 battle stages and a boss, and conquering one gives a permanent bonus. |
| **Expeditions** | Timed missions (1 minute to 4 hours) that return gold, gear, treasures and sometimes new goblins, with a funny story log. They continue while you're offline. |
| **Combat** | Real-time auto-battles. Tap enemies to poke them, throw a charged Goblin Bomb, and use 1×/2×/3× speed. |
| **Defense** | Invasions by knights, rival tribes, trolls and dragon cultists. Fight them yourself or let your Barracks defenders auto-battle. |
| **Disasters & events** | Fires (tap to extinguish), rat swarms (tap to squash), golden goblins (catch for frenzies), 18 choice-based funny incidents, and ambient goblin drama with arguments and chatter. |
| **Collections** | Goblin Codex, 28 treasures in 7 sets with set bonuses, and gear in weapon and trinket slots. |
| **Trading** | Gribble the Wandering Trader (rotating stock), the Bazaar exchange, and gem time-warps. |
| **Progression** | Capital levels and ranks, 43 story quests, 3 daily quests per day plus a bonus, a 7-day login streak, and 46 achievements (each one gives +1% income). |
| **Golden Teeth** | Earned automatically from all the gold you make, with no restarting. Each tooth gives +2% income forever, and the Tooth Shrine sells permanent perks. |
| **Goblin Venture Bank** | Invest real gold in silly goblin startup ideas. Each has hidden odds: it pays a multiple or the money is lost. |
| **Hoard Hill** | The Great Hoard landmark grows with your wealth, and treasure dig sites pop up for you to dig. |
| **Competition** | A weekly Tribal League against rival goblin chiefs with gem rewards, plus a shareable brag card image. |
| **Hiccups** | Goblins catch the hiccups, and every HIC! is a tiny explosion that scares nearby goblins into running. Tap a hiccuping goblin to say BOO and cure it. At the DJ Stand, throw a **Hiccup Concert**: the tribe hiccups a song on the beat with fireworks, then gold ×2 for 2 minutes. |
| **Feel** | Day/night cycle, particles, screen shake, a procedural chiptune soundtrack, haptics, offline earnings and a "welcome back" summary. |

## Development

```
src/
  data.js       content tables (buildings, goblins, regions, quests, events...)
  game.js       all game rules and state, DOM-free and testable in Node
  battlesim.js  battle simulation
  world.js      map rendering, camera, input, goblin agents, effects
  mines.js      the underground mine scene and the boat ride
  battle.js     battle screen
  ui.js         HUD, panels, modals
  sprites.js    procedural pixel art
  audio.js      WebAudio sound effects and music
  main.js       boot and wiring
tests/
  sim.mjs       headless balance bot: node tests/sim.mjs <hours>
  e2e.cjs       Playwright end-to-end test (needs tests/serve.mjs running)
  late.cjs, artsheet.cjs, make-icons.cjs   visual review and asset helpers
```

Run the tests:

```sh
node tests/sim.mjs 4                 # simulate 4 hours of play
node tests/serve.mjs . 8123 &        # start a static server
node tests/e2e.cjs                   # drive every feature in a phone-sized browser
```
