// Curated genomes, Phase 1 (29 September 2026). Nine were found by
// bench/scan.js among 1,500 random word seeds and chosen by eye from a
// contact sheet; five were designed by hand for forms the seeds rarely give
// (a nucleus in a membrane, budding, filaments, even colonies). Scan finds
// use the cell-mode defaults: radius 40, core 3, beta 0.3, force 10.
// What each looks like, and how it was found, is in genome-notes.js.

const CELL_RADIUS = [40, 40, 40, 60, 40, 40, 40, 50, 40]

export const GENOMES = [
  { name: 'amoeba', kinds: 3, seed: 'cell', mix: [1, 3, 1], radius: CELL_RADIUS,
    rules: [0.6, -0.2, -0.4, 0.3, -0.6, 0.1, -0.4, 0.6, -0.2] },
  { name: 'budding', kinds: 3, seed: 'cell', mix: [1, 3, 1], radius: CELL_RADIUS,
    rules: [0.3, -0.2, -0.4, 0.3, -0.2, 0.1, -0.4, 0.6, -0.2] },
  { name: 'hyphae', kinds: 2, seed: 'thread', rules: [-0.3, 1, 0.8, -0.3] },
  { name: 'mycelium', kinds: 3, seed: 'swarm_moss' },
  { name: 'diatoms', kinds: 3, seed: 'chain', rules: [0.6, 0.8, -0.3, -0.3, 0.6, 0.8, 0.8, -0.3, 0.6] },
  { name: 'ciliates', kinds: 5, seed: 'night_stone' },
  { name: 'segmented', kinds: 5, seed: 'violet_burrow' },
  { name: 'swimmers', kinds: 4, seed: 'seed_wasp' },
  { name: 'flagellates', kinds: 5, seed: 'pine_wander' },
  { name: 'volvox', kinds: 5, seed: 'sienna_nacre' },
  { name: 'crescents', kinds: 3, seed: 'gall_heath' },
  { name: 'colonies', kinds: 6, seed: 'plume_spring' },
]
