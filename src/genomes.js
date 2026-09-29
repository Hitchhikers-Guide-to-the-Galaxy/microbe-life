// Curated genomes, Phase 1 (29 September 2026). Nine were found by
// bench/scan.js among 1,500 random word seeds and chosen by eye from a
// contact sheet; five were designed by hand for forms the seeds rarely give
// (a nucleus in a membrane, budding, filaments, even colonies). Scan finds
// use the cell-mode defaults: radius 40, core 3, beta 0.3, force 10.

const CELL_RADIUS = [40, 40, 40, 60, 40, 40, 40, 50, 40]

export const GENOMES = [
  { name: 'amoeba', kinds: 3, seed: 'cell', mix: [1, 3, 1], radius: CELL_RADIUS,
    rules: [0.6, -0.2, -0.4, 0.3, -0.6, 0.1, -0.4, 0.6, -0.2],
    about: 'Large cells: a cyan nucleus held in an orange membrane, cilia outside.', found: 'designed' },
  { name: 'budding', kinds: 3, seed: 'cell', mix: [1, 3, 1], radius: CELL_RADIUS,
    rules: [0.3, -0.2, -0.4, 0.3, -0.2, 0.1, -0.4, 0.6, -0.2],
    about: 'Smaller membrane cells that bud and divide.', found: 'designed' },
  { name: 'hyphae', kinds: 2, seed: 'thread', rules: [-0.3, 1, 0.8, -0.3],
    about: 'Long beaded filaments that barely drift, like fungal threads in soil.', found: 'designed' },
  { name: 'mycelium', kinds: 3, seed: 'swarm_moss',
    about: 'A web of branching chains that keeps rewiring itself.', found: 'scan' },
  { name: 'diatoms', kinds: 3, seed: 'chain', rules: [0.6, 0.8, -0.3, -0.3, 0.6, 0.8, 0.8, -0.3, 0.6],
    about: 'Evenly spaced round colonies, each turning slowly.', found: 'designed' },
  { name: 'ciliates', kinds: 5, seed: 'night_stone',
    about: 'Striped cells that swim through a lattice of chains.', found: 'scan' },
  { name: 'segmented', kinds: 5, seed: 'violet_burrow',
    about: 'Segmented worms of banded colour.', found: 'scan' },
  { name: 'swimmers', kinds: 4, seed: 'seed_wasp',
    about: 'Fast bright comets among still colonies.', found: 'scan' },
  { name: 'flagellates', kinds: 5, seed: 'pine_wander',
    about: 'Swimmers trailing long tails.', found: 'scan' },
  { name: 'volvox', kinds: 5, seed: 'sienna_nacre',
    about: 'Layered spheres, each kind in its own shell.', found: 'scan' },
  { name: 'crescents', kinds: 3, seed: 'gall_heath',
    about: 'Crescents and loose webs that form, split and re-form.', found: 'scan' },
  { name: 'colonies', kinds: 6, seed: 'plume_spring',
    about: 'Many small layered colonies of six kinds.', found: 'scan' },
]
