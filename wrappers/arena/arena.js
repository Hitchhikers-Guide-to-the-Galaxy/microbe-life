// Microbe Life for Aether Desktop's arena: a small creature drawn around a
// track's node, for `canvas_animation: { type: 'particle-life' }`. One file,
// a global `MicrobeArena`, nothing else touched.
//
//   const c = MicrobeArena.create({ genome: 'amoeba' })   // name, index or genome
//   c.update(track.customNodeDSP?.params)                  // follow the node's sliders
//   c.draw(ctx, x, y, radius, { level, alpha })            // step once and draw
//
// The creature lives in a small square world drawn inside a circle of the
// given radius. `level` (0–1, e.g. the track's peak) swells the dots.

import { worldSize } from '../../src/core.js'
import { lifeFromGenome } from '../../src/genome.js'
import { GENOMES } from '../../src/genomes.js'
import { DEFAULTS, genomeFor, applyParams, baseOf, paletteFor, hueFor } from '../../src/map.js'

function resolve(g) {
  if (g && typeof g === 'object') return g
  if (typeof g === 'number') return genomeFor({ ...DEFAULTS, genome: g })
  return GENOMES.find(x => x.name === g) || GENOMES[0]
}

function create({ genome = 'amoeba', count = 150 } = {}) {
  let params = { ...DEFAULTS }
  let life, base, palette, key
  const grow = g => {
    const G = resolve(g)
    life = lifeFromGenome(G, { count: Math.max(1, Math.round(count / G.kinds)), ...worldSize(count, 1) })
    base = baseOf(life)
    applyParams(life, params, base)
    for (let i = 0; i < 200; i++) life.step()
    key = G.name
    palette = paletteFor(life.k, hueFor(params.root))
  }
  grow(genome)
  return {
    get life() { return life },
    update(p) {
      if (!p) return
      params = { ...DEFAULTS, ...params, ...p }
      const G = genomeFor(params)
      if (p.genome !== undefined && G.name !== key) grow(G)
      applyParams(life, params, base)
      palette = paletteFor(life.k, hueFor(params.root))
    },
    draw(ctx, x, y, radius, { level = 0, alpha = 1 } = {}) {
      life.step()
      const s = (2 * radius) / life.width, r = Math.max(1.2, radius * 0.02) * (1 + 0.6 * Math.min(1, level))
      ctx.save()
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip()
      for (let k = 0; k < life.k; k++) {
        ctx.beginPath()
        for (let i = 0; i < life.n; i++) {
          if (life.kind[i] !== k) continue
          const px = x - radius + life.x[i] * s, py = y - radius + life.y[i] * s
          ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, Math.PI * 2)
        }
        ctx.fillStyle = palette[k % palette.length]
        ctx.globalAlpha = alpha * (0.75 + 0.25 * Math.min(1, level))
        ctx.fill()
      }
      ctx.restore()
    },
  }
}

globalThis.MicrobeArena = { create, genomes: GENOMES.map(g => g.name) }
