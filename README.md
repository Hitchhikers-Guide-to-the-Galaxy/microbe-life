# Microbe Life

Particle life as small microbial creatures, for the night.earth background and
an Aether node whose sliders are musical parameters. Plan:
https://night.earth/view/microbe-life-plan

One core, no DOM, no dependencies (`src/core.js`): typed arrays and a uniform
grid, so it runs in a page, a worker or an AudioWorklet.

- `classic` mode is Hunar Ahmad's rule. With `precision: 64` and
  `neighbours: 'brute'` it reproduces his particle_life.html bit for bit from
  the same seed (tested against a reference copy of his code).
- `cell` mode is a short-range push plus a smooth pull on a torus, which forms
  colonies, chains and swimmers. Its `core` stiffness (default 3) caps how
  densely cells pack.
- Rules are attraction: positive pulls together.
- One seed (a number, or a word such as `moss_ember`) sets the rules and the
  starting layout.

```js
import { Life, worldSize } from './src/core.js'
const life = new Life({ mode: 'cell', kinds: 4, count: 250, ...worldSize(1000), seed: 'moss_ember' })
life.step()
life.stats()   // per kind: energy, centre, spread; meetings; clusters
```

Cost follows density, not count. Keep the world growing with the particle
count (`worldSize`) and 1,000 particles step in well under 2 ms.

```
npm test          # conformance, grid = brute force, seeds, stats
npm run bench     # step cost per mode and size
npm run build     # dist/microbe-life-demo.html, one file
```

MIT. See LICENSE for credits to Hunar Ahmad and Chevy Ray Johnston.
