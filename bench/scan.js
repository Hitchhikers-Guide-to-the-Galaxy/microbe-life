// Search seeds for creatures worth keeping.
// node bench/scan.js [count=400] [--kinds=3..6] > scan.json
//
// Each seed runs 1,200 steps at 600 particles in a world sized for them.
// Colonies are sampled at steps 600, 900 and 1,200. Scores:
//   membrane  highest layering in a colony of 8+ with two or more kinds
//   chain     highest elongation in a colony of 6+
//   division  colonies of 8+ whose members end up split across two
//             colonies, each holding 30% or more of them
//   alive     mean squared speed at the end (0 = frozen)
//   colonies  count at the end, and share of particles inside one
import { Life, worldSize } from '../src/core.js'
import '../src/colonies.js'
import { wordSeed } from '../src/genome.js'
import { makeRng } from '../src/rng.js'

export function score(seed, kinds, { n = 600, steps = 1200 } = {}) {
  const life = new Life({ kinds, count: Math.round(n / kinds), ...worldSize(n), seed })
  let prev = null, division = 0, membrane = 0, chain = 0
  for (let s = 1; s <= steps; s++) {
    life.step()
    if (s % 300 !== 0 || s < 600) continue
    const cols = life.colonies()
    const labels = Int32Array.from(life.labels)
    for (const c of cols) {
      if (c.size >= 8 && c.kinds.filter(m => m >= 2).length >= 2) membrane = Math.max(membrane, c.layering)
      if (c.size >= 6) chain = Math.max(chain, c.elongation)
    }
    if (prev) {
      for (const c of prev.cols) {
        if (c.size < 8) continue
        const hist = new Map()
        for (let i = 0; i < life.n; i++) if (prev.labels[i] === c.id) hist.set(labels[i], (hist.get(labels[i]) || 0) + 1)
        const big = [...hist.values()].filter(v => v >= 0.3 * c.size && v >= 3)
        if (big.length >= 2) division++
      }
    }
    prev = { cols, labels }
  }
  const st = life.stats()
  const inside = st.colonies.reduce((a, c) => a + c.size, 0) / life.n
  const alive = st.kinds.reduce((a, k) => a + k.energy, 0) / kinds
  return { seed, kinds, alive: Math.round(alive), colonies: st.clusters, inside: +inside.toFixed(2), membrane: +membrane.toFixed(2), chain: +chain.toFixed(2), division }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = +process.argv[2] || 400
  const rnd = makeRng('scan')
  const rows = []
  for (let i = 0; i < count; i++) {
    const kinds = 3 + Math.floor(rnd() * 4)
    rows.push(score(wordSeed(rnd), kinds))
    if (i % 25 === 24) process.stderr.write(`${i + 1}/${count}\n`)
  }
  console.log(JSON.stringify(rows))
}
