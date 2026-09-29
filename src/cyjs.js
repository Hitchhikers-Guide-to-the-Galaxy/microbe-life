// A creature as cytoscape graph data (the cyjs "elements" JSON that
// Cytoscape.js and Cytoscape Desktop both read). The engines stay separate;
// this is the shared format.
//
//   kind nodes     one per particle kind, with its colour and count
//   rule edges     kind → kind, weight = attraction (−1…1), radius
//   colony nodes   one per colony, with size, centre, elongation, layering
//   member edges   colony → kind, weight = share of the colony's members

import { PALETTE } from './draw2d.js'

export function toCytoscape(life, { colonies = life.colonies(), minRule = 0.05, name } = {}) {
  const k = life.k
  const counts = new Array(k).fill(0)
  for (let i = 0; i < life.n; i++) counts[life.kind[i]]++
  const nodes = [], edges = []
  for (let a = 0; a < k; a++) {
    nodes.push({ data: { id: `k${a}`, type: 'kind', label: `kind ${a}`, colour: PALETTE[a % PALETTE.length], count: counts[a] } })
  }
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
    const w = life.rules[a * k + b]
    if (Math.abs(w) < minRule) continue
    edges.push({ data: { id: `r${a}-${b}`, type: 'rule', source: `k${a}`, target: `k${b}`, weight: round(w), radius: life.radius[a * k + b] } })
  }
  colonies.forEach((c, i) => {
    nodes.push({ data: { id: `c${i}`, type: 'colony', label: `colony ${i}`, size: c.size, elongation: round(c.elongation), layering: round(c.layering) }, position: { x: round(c.cx), y: round(c.cy) } })
    c.kinds.forEach((m, a) => {
      if (m) edges.push({ data: { id: `m${i}-${a}`, type: 'member', source: `c${i}`, target: `k${a}`, weight: round(m / c.size) } })
    })
  })
  return {
    format_version: '1.0', generated_by: 'microbe-life',
    data: { name: name || `microbe-life ${life.seed}`, seed: String(life.seed), mode: life.mode, steps: life.steps },
    elements: { nodes, edges },
  }
}

const round = v => Math.round(v * 1000) / 1000
