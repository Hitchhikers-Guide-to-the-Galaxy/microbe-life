// Curated genomes, Phase 1 (29 September 2026). Nine were found by
// bench/scan.js among 1,500 random word seeds and chosen by eye from a
// contact sheet; five were designed by hand for forms the seeds rarely give
// (a nucleus in a membrane, budding, filaments, even colonies). Scan finds
// use the cell-mode defaults: radius 40, core 3, beta 0.3, force 10.
// What each looks like, and how it was found, is in genome-notes.js.

const CELL_RADIUS = [40, 40, 40, 60, 40, 40, 40, 50, 40]

export const GALLERY = [
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

// Genomes drawn from data rather than chosen by eye. They follow the
// gallery in GENOMES, so genome 12 is Banerjee 2018 everywhere.
export const FROM_DATA = [
  // From data, not from the eye: the soil co-occurrence network of Banerjee,
  // Thrall, Bissett, van der Heijden & Richardson (2018), Ecology and
  // Evolution 8(16):8217-8230, doi:10.1002/ece3.4346, CC BY 4.0. Five kinds
  // are the paper's clusters (total P 164 OTUs, C:N 76, pH 42, potential
  // nitrification 49) and its ten keystone taxa; counts follow their sizes.
  // The forces are ours, as the paper gives no signs between clusters: each
  // cluster holds together, clusters are neutral to one another, and all are
  // drawn to the keystones. Co-occurrence is association, not interaction.
  // Contributed by the night.earth Night Sound session, 2026-09-30.
  { name: 'banerjee-2018', kinds: 5, seed: 'ecotone', data: true,
    mix: [164, 76, 42, 49, 10],
    rules: [0.5, 0, 0, 0, 0.8,
            0, 0.5, 0, 0, 0.8,
            0, 0, 0.5, 0, 0.8,
            0, 0, 0, 0.6, 0.8,
            0.4, 0.4, 0.4, 0.4, 0.4],
    kindsNamed: ['total phosphorus', 'C:N ratio', 'pH', 'potential nitrification', 'keystone taxa'] },
]

export const GENOMES = /* @__PURE__ */ GALLERY.concat(FROM_DATA)
