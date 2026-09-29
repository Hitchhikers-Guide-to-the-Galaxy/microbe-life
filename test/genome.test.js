import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Life } from '../src/core.js'
import { encode, decode, lifeFromGenome, genomeOf, wordSeed, WORDS } from '../src/genome.js'
import { toCytoscape } from '../src/cyjs.js'
import { makeRng } from '../src/rng.js'

test('word seeds come from the built-in list', () => {
  const s = wordSeed(makeRng(1))
  const [a, b] = s.split('_')
  assert.ok(WORDS.includes(a) && WORDS.includes(b))
  assert.ok(WORDS.length >= 128 && WORDS.join(' ').length < 2048)
})

test('a seed-only genome round-trips and rebuilds the same world', () => {
  const g = { kinds: 5, seed: 'moss_ember', core: 3, beta: 0.3, force: 10, halfLife: 0.04, radius: 40 }
  const code = encode(g)
  assert.ok(code.startsWith('g1') && code.length < 40, code)
  const back = decode(code)
  const a = lifeFromGenome(g, { count: 50 }), b = lifeFromGenome(back, { count: 50 })
  for (let i = 0; i < 30; i++) { a.step(); b.step() }
  assert.deepEqual(a.x, b.x)
})

test('designed rules and per-pair radii survive, quantised', () => {
  const rules = [1, -0.5, 0.25, 0, 0.9, -1, 0.1, 0.2, -0.3]
  const radius = [40, 50, 60, 30, 40, 50, 20, 30, 40]
  const g = { kinds: 3, seed: 7, rules, radius, core: 2.5 }
  const back = decode(encode(g))
  back.rules.forEach((v, i) => assert.ok(Math.abs(v - rules[i]) <= 1 / 127))
  assert.deepEqual(back.radius, radius)
  assert.equal(back.core, 2.5)
  const life = lifeFromGenome(back, { count: 10 })
  assert.ok(Math.abs(life.rules[0] - 1) < 0.01 && life.radius[2] === 60)
})

test('genomeOf leaves out rules the seed already gives', () => {
  const life = new Life({ seed: 'spore_tide', count: 10 })
  assert.equal(genomeOf(life).rules, undefined)
  life.rules[0] = 0.5
  assert.equal(genomeOf(life).rules[0], 0.5)
})

test('classic genomes keep Hunar seeds exactly', () => {
  const g = decode(encode({ kinds: 4, seed: 91651088029, mode: 'classic', radius: 80 }))
  assert.equal(g.seed, 91651088029)
  assert.equal(g.mode, 'classic')
})

test('colonies and cytoscape export', () => {
  const life = new Life({ seed: 'moss_ember', count: 150, width: 775, height: 521 })
  for (let i = 0; i < 400; i++) life.step()
  const cols = life.colonies()
  assert.ok(cols.length >= 3, `colonies ${cols.length}`)
  assert.ok(cols.every(c => c.size >= 3 && c.elongation >= 1 && c.layering >= 0))
  assert.ok(cols[0].size >= cols[cols.length - 1].size)
  const cy = toCytoscape(life, { colonies: cols })
  const ids = new Set(cy.elements.nodes.map(n => n.data.id))
  assert.equal(cy.elements.nodes.filter(n => n.data.type === 'kind').length, 4)
  assert.equal(cy.elements.nodes.filter(n => n.data.type === 'colony').length, cols.length)
  assert.ok(cy.elements.edges.every(e => ids.has(e.data.source) && ids.has(e.data.target)))
  assert.doesNotThrow(() => JSON.stringify(cy))
})

test('mix sets relative counts and round-trips', () => {
  const g = { kinds: 3, seed: 'cell', mix: [1, 3, 2] }
  const life = lifeFromGenome(g, { count: 100 })
  assert.deepEqual(life.counts, [50, 150, 100])
  const back = decode(encode(g))
  assert.deepEqual(back.mix, [85, 255, 170])
  assert.deepEqual(lifeFromGenome(back, { count: 100 }).counts, [50, 150, 100])
  assert.deepEqual(genomeOf(life).mix, [85, 255, 170])
})
