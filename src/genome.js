// Genomes: everything that makes a creature, small enough for a URL.
//
// A genome is { kinds, seed, mode?, rules?, radius?, mix?, beta?, core?,
// force?, halfLife? }. `mix` gives relative particle counts per kind. The seed sets the rules and the starting layout; `rules`, when
// present, overrides the seed's rules (a designed or edited creature) while
// the layout still comes from the seed. Particle counts and world size are
// left to the host, which sizes the world for its own budget.
//
// Share code: "g1" + base64url of
//   u8 version, u8 kinds, u8 flags (1 classic, 2 rules, 4 radius),
//   u8 core×10, u8 beta×100, u8 force, u8 halfLife×1000, f64 seed,
//   [k*k i8 rules×127], k*k u8 radius or one u8, [k u8 mix] (flag 8)
// Rules are quantised to 1/127, so a decoded genome is close, not exact.

import { Life } from './core.js'
import { makeRng, seedNumber } from './rng.js'

export const WORDS = /* @__PURE__ */ (
  'moss ember soil lantern spore tide amber fern silt root drift lichen hypha dew loam pollen ' +
  'humus nectar peat reed kelp mycel algae bloom bud burrow chalk clay cress dune dusk ' +
  'echo eddy elder flint frond gall garnet glade gleam grain grove gust hazel heath hive ' +
  'husk ivy jade kiln larch leaf lumen marl marsh meadow mire mist molt nacre nettle nimbus ' +
  'nymph oak ochre orchid otter pearl pebble petal pine pip plume pod pond quill rain ' +
  'rill rime rune rush sage sap seed sedge shale shell shoal sienna silk sloe slate sorrel ' +
  'sprig spring star stem stone sward tansy tarn thistle thorn tinder toad tuft tuber umber ' +
  'vale vetch vine violet wasp wax weald weed whorl willow wisp wort wren yarrow yeast yew ' +
  'zephyr night dream garden fish glow hum murmur ripple spark swarm tendril wander'
).split(' ')

export function wordSeed(rnd = Math.random) {
  const w = () => WORDS[Math.floor(rnd() * WORDS.length)]
  return `${w()}_${w()}`
}

const PARAMS = ['beta', 'core', 'force', 'halfLife']

// Build a world for a genome. options: count per kind (or array), width,
// height, plus any Life option to override.
export function lifeFromGenome(genome, options = {}) {
  const g = { ...genome }
  if (g.mix && typeof options.count === 'number') {
    const total = options.count * g.kinds, sum = g.mix.reduce((a, b) => a + b, 0)
    options = { ...options, count: g.mix.map(w => Math.max(1, Math.round(total * w / sum))) }
  }
  const life = new Life({
    mode: g.mode || 'cell', kinds: g.kinds, seed: g.seed,
    ...Object.fromEntries(PARAMS.filter(p => g[p] != null).map(p => [p, g[p]])),
    ...(g.radius ? { radius: g.radius } : {}),
    ...options,
  })
  if (g.rules) life.rules.set(g.rules)
  return life
}

// The genome of a running world (rules included only when they differ from
// what the seed alone would give).
export function genomeOf(life) {
  const g = { kinds: life.k, seed: life.seed, mode: life.mode }
  for (const p of PARAMS) g[p] = life[p]
  const fromSeed = makeRng(life.seed)
  const seeded = Array.from({ length: life.k * life.k }, () => -(fromSeed() * 2 - 1))
  if (seeded.some((v, i) => Math.abs(v - life.rules[i]) > 1e-9)) g.rules = Array.from(life.rules)
  if (life.counts.some(c => c !== life.counts[0])) {
    const top = Math.max(...life.counts)
    g.mix = life.counts.map(c => Math.max(1, Math.round(c / top * 255)))
  }
  const r0 = life.radius[0]
  if (Array.from(life.radius).some(r => r !== r0)) g.radius = Array.from(life.radius)
  else g.radius = r0
  return g
}

export function encode(genome) {
  const k = genome.kinds
  const hasRules = !!genome.rules
  const perPair = Array.isArray(genome.radius) || ArrayBuffer.isView(genome.radius)
  const hasMix = !!genome.mix
  const bytes = new Uint8Array(7 + 8 + (hasRules ? k * k : 0) + (perPair ? k * k : 1) + (hasMix ? k : 0))
  const view = new DataView(bytes.buffer)
  bytes[0] = 1
  bytes[1] = k
  bytes[2] = (genome.mode === 'classic' ? 1 : 0) | (hasRules ? 2 : 0) | (perPair ? 4 : 0) | (hasMix ? 8 : 0)
  bytes[3] = clampByte(Math.round((genome.core ?? 3) * 10))
  bytes[4] = clampByte(Math.round((genome.beta ?? 0.3) * 100))
  bytes[5] = clampByte(Math.round(genome.force ?? 10))
  bytes[6] = clampByte(Math.round((genome.halfLife ?? 0.04) * 1000))
  view.setFloat64(7, seedNumber(genome.seed))
  let at = 15
  if (hasRules) for (let i = 0; i < k * k; i++) view.setInt8(at++, Math.max(-127, Math.min(127, Math.round(genome.rules[i] * 127))))
  if (perPair) for (let i = 0; i < k * k; i++) bytes[at++] = clampByte(Math.round(genome.radius[i]))
  else bytes[at++] = clampByte(Math.round(genome.radius ?? (genome.mode === 'classic' ? 80 : 40)))
  if (hasMix) {
    const top = Math.max(...genome.mix)
    for (let i = 0; i < k; i++) bytes[at++] = clampByte(Math.max(1, Math.round(genome.mix[i] / top * 255)))
  }
  return 'g1' + base64url(bytes)
}

export function decode(code) {
  if (!/^g1[A-Za-z0-9_-]+$/.test(code)) throw new Error('not a genome code')
  const bytes = unbase64url(code.slice(2))
  const view = new DataView(bytes.buffer)
  if (bytes[0] !== 1) throw new Error('unknown genome version ' + bytes[0])
  const k = bytes[1], flags = bytes[2]
  const g = {
    kinds: k, mode: flags & 1 ? 'classic' : 'cell',
    core: bytes[3] / 10, beta: bytes[4] / 100, force: bytes[5], halfLife: bytes[6] / 1000,
    seed: view.getFloat64(7),
  }
  let at = 15
  if (flags & 2) { g.rules = []; for (let i = 0; i < k * k; i++) g.rules.push(view.getInt8(at++) / 127) }
  if (flags & 4) { g.radius = []; for (let i = 0; i < k * k; i++) g.radius.push(bytes[at++]) }
  else g.radius = bytes[at++]
  if (flags & 8) { g.mix = []; for (let i = 0; i < k; i++) g.mix.push(bytes[at++]) }
  return g
}

function clampByte(v) { return Math.max(0, Math.min(255, v)) }

function base64url(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unbase64url(text) {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, c => c.charCodeAt(0))
}
