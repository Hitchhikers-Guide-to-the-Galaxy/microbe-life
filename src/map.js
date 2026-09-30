// The musical ↔ visual mapping, shared by the node's panel, its worklet and
// the page background, so a slider means the same thing everywhere.
//
//   genome    0–12 a curated creature (12 is the Banerjee soil network), 13–99 seeded   → rules, the creature
//   voices    2–6   kinds in a seeded creature; voiced kinds  → number of voices
//   harmony   0–1   symmetry of the rules (1 settles, 0 chases) → consonant … dissonant
//   tempo     0.1–3 time scale                                → rate of meetings, grains
//   sustain   0–1   fluid … viscous (friction half-life)       → release
//   reach     0.5–2 interaction radius × 40                    → register (small = high)
//   mutation  0–1   rules drift                                 → slow harmonic drift
//   root      40–400 Hz hue                                    → fundamental
//   gain      0–1   glow                                        → level

import { GENOMES } from './genomes.js'

export const PARAMS = [
  { id: 'genome', name: 'Genome', type: 'int', min: 0, max: 99, default: 0, step: 1 },
  { id: 'voices', name: 'Voices', type: 'int', min: 2, max: 6, default: 4, step: 1 },
  { id: 'harmony', name: 'Harmony', type: 'float', min: 0, max: 1, default: 0.5, unit: 'norm' },
  { id: 'tempo', name: 'Tempo', type: 'float', min: 0.1, max: 3, default: 1 },
  { id: 'sustain', name: 'Sustain', type: 'float', min: 0, max: 1, default: 0.5, unit: 'norm' },
  { id: 'reach', name: 'Reach', type: 'float', min: 0.5, max: 2, default: 1 },
  { id: 'mutation', name: 'Mutation', type: 'float', min: 0, max: 1, default: 0, unit: 'norm' },
  { id: 'root', name: 'Root', type: 'float', min: 40, max: 400, default: 110, unit: 'Hz' },
  { id: 'gain', name: 'Gain', type: 'float', min: 0, max: 1, default: 0.6, unit: 'norm' },
]

export const DEFAULTS = Object.fromEntries(PARAMS.map(p => [p.id, p.default]))

export function clampParam(id, value) {
  const p = PARAMS.find(q => q.id === id)
  if (!p) return value
  let v = Math.max(p.min, Math.min(p.max, +value))
  if (p.type === 'int') v = Math.round(v)
  return v
}

// The genome a set of params asks for.
export function genomeFor(params) {
  const g = Math.round(params.genome)
  if (g < GENOMES.length) return GENOMES[g]
  return { name: `genome-${g}`, kinds: Math.round(params.voices), seed: `genome-${g}` }
}

// Rules shaped by harmony: split into symmetric S and antisymmetric A parts;
// 0.5 keeps the genome's own rules, 1 keeps only S (settled clusters), 0
// doubles A (endless chasing).
export function shapeRules(base, k, harmony) {
  const out = new Float64Array(k * k)
  const a = 2 * (1 - harmony)
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const s = (base[i * k + j] + base[j * k + i]) / 2
    const d = (base[i * k + j] - base[j * k + i]) / 2
    out[i * k + j] = Math.max(-1, Math.min(1, s + a * d))
  }
  return out
}

// Friction half-life in seconds: sustain 0 is viscous (quick stops), 1 fluid.
export const halfLifeFor = sustain => 0.015 * Math.pow(8, sustain)

// Apply the non-genome params to a running world. `base` holds the genome's
// own rules and radii, so repeated calls do not compound.
export function applyParams(life, params, base) {
  life.timeScale = params.tempo
  life.halfLife = halfLifeFor(params.sustain)
  const r = shapeRules(base.rules, life.k, params.harmony)
  life.rules.set(r)
  const radius = Float64Array.from(base.radius, v => v * params.reach)
  life.setRadius(radius)
}

// Snapshot of a world's own rules and radii, before any params touch them.
export function baseOf(life) {
  return { rules: Float64Array.from(life.rules), radius: Float64Array.from(life.radius) }
}

// Drift the base rules a little; rate 0–1, called about ten times a second.
export function mutate(base, rate, rnd = Math.random) {
  if (rate <= 0) return
  const step = 0.02 * rate
  for (let i = 0; i < base.rules.length; i++) {
    base.rules[i] = Math.max(-1, Math.min(1, base.rules[i] + (rnd() - 0.5) * 2 * step))
  }
}

// Frequency ratios for k voices: harmony 1 is just intonation over a major
// chord and its octaves, 0 a cluster of close, beating intervals; between
// them the ratios glide in log frequency.
const CONSONANT = [1, 3 / 2, 5 / 4, 2, 3, 5 / 2]
const DISSONANT = [1, 16 / 15, 45 / 32, 17 / 12, 15 / 8, 32 / 15]
export function voiceRatios(k, harmony) {
  const out = []
  for (let i = 0; i < k; i++) {
    const c = Math.log2(CONSONANT[i % 6]) + Math.floor(i / 6)
    const d = Math.log2(DISSONANT[i % 6]) + Math.floor(i / 6)
    out.push(Math.pow(2, d + (c - d) * harmony))
  }
  return out
}

// Register: a small reach sounds higher (−1 octave at 2, +1 at 0.5).
export const octaveFor = reach => -Math.log2(reach)

// Colour follows the root: 40 Hz is deep blue-green, 400 Hz warm amber.
export function hueFor(root) {
  const t = Math.log(root / 40) / Math.log(10)
  return (180 - 150 * t + 360) % 360
}

// A palette for k kinds, turned by hue.
export function paletteFor(k, hue) {
  const out = []
  for (let i = 0; i < Math.max(k, 1); i++) {
    const h = (hue + i * (300 / Math.max(k, 1))) % 360
    out.push(hsl(h, 0.62, 0.66))
  }
  return out
}

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  const x = v => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${x(f(0))}${x(f(8))}${x(f(4))}`
}
