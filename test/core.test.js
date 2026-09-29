import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Life, pairIndex, worldSize } from '../src/core.js'
import '../src/colonies.js'
import '../src/classic.js'
import { makeRng, hash32, seedNumber } from '../src/rng.js'
import { hunarWorld } from './reference/hunar.js'

const W = 1000, H = 700

function classic(opts = {}) {
  return new Life({ mode: 'classic', kinds: 4, count: 120, width: W, height: H, precision: 64, ...opts })
}

function maxDiff(a, b) {
  let m = 0
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]))
  return m
}

test('seed: rules and layout match Hunar exactly', () => {
  const ref = hunarWorld({ count: 120, width: W, height: H })
  const life = classic({ neighbours: 'brute' })
  assert.deepEqual(Array.from(life.rules, v => -v), ref.settings.rulesArray)
  ref.atoms.forEach((a, i) => {
    assert.equal(life.x[i], a[0]); assert.equal(life.y[i], a[1]); assert.equal(life.kind[i], a[4])
  })
})

test('classic brute mode reproduces Hunar step for step, bit for bit', () => {
  const ref = hunarWorld({ count: 120, width: W, height: H })
  const life = classic({ neighbours: 'brute' })
  for (let s = 0; s < 50; s++) { ref.step(); life.step() }
  ref.atoms.forEach((a, i) => {
    assert.equal(life.x[i], a[0], `x of ${i}`); assert.equal(life.y[i], a[1], `y of ${i}`)
    assert.equal(life.vx[i], a[2]); assert.equal(life.vy[i], a[3])
  })
})

test('classic grid agrees with brute force (summation order only)', () => {
  const a = classic({ neighbours: 'brute' }), b = classic()
  a.step(); b.step()
  assert.ok(maxDiff(a.x, b.x) < 1e-9 && maxDiff(a.vy, b.vy) < 1e-9)
})

for (const wrap of [true, false]) {
  test(`cell grid agrees with brute force (wrap ${wrap})`, () => {
    const opts = { mode: 'cell', kinds: 5, count: 150, width: 800, height: 600, radius: 70, precision: 64, wrap }
    const a = new Life({ ...opts, neighbours: 'brute' }), b = new Life(opts)
    for (let s = 0; s < 3; s++) { a.step(); b.step() }
    assert.ok(maxDiff(a.x, b.x) < 1e-7, `x diff ${maxDiff(a.x, b.x)}`)
    assert.ok(maxDiff(a.vx, b.vx) < 1e-7)
  })
}

test('a torus narrower than three cells visits each neighbour once', () => {
  const opts = { mode: 'cell', kinds: 3, count: 40, width: 150, height: 150, radius: 70, precision: 64 }
  const a = new Life({ ...opts, neighbours: 'brute' }), b = new Life(opts)
  a.step(); b.step()
  assert.ok(maxDiff(a.vx, b.vx) < 1e-9)
})

test('per-pair radii are honoured', () => {
  const r = new Array(9).fill(60); r[1] = 120; r[3] = 20
  const opts = { mode: 'cell', kinds: 3, count: 80, width: 600, height: 600, radius: r, precision: 64 }
  const a = new Life({ ...opts, neighbours: 'brute' }), b = new Life(opts)
  a.step(); b.step()
  assert.ok(maxDiff(a.vx, b.vx) < 1e-9)
})

test('seeds are deterministic; word seeds hash; different seeds differ', () => {
  const a = new Life({ seed: 'moss_ember' }), b = new Life({ seed: 'moss_ember' }), c = new Life({ seed: 'soil_lantern' })
  for (let s = 0; s < 20; s++) { a.step(); b.step(); c.step() }
  assert.deepEqual(a.x, b.x)
  assert.notDeepEqual(a.rules, c.rules)
  assert.equal(seedNumber('42'), 42)
  assert.equal(seedNumber('moss_ember'), hash32('moss_ember'))
  const r = makeRng(7); const v = r(); assert.ok(v >= 0 && v < 1)
})

test('cell mode stays finite and inside the torus', () => {
  const life = new Life({ seed: 'moss_ember', count: 200 })
  for (let s = 0; s < 300; s++) life.step()
  for (let i = 0; i < life.n; i++) {
    assert.ok(Number.isFinite(life.vx[i]))
    assert.ok(life.x[i] >= 0 && life.x[i] < life.width && life.y[i] >= 0 && life.y[i] < life.height)
  }
})

test('stats: counts, meetings, clusters', () => {
  const life = new Life({ seed: 'moss_ember', count: 200 })
  for (let s = 0; s < 200; s++) life.step()
  const st = life.stats()
  assert.equal(st.kinds.length, 4)
  assert.deepEqual(st.kinds.map(k => k.count), [200, 200, 200, 200])
  assert.ok(st.kinds.every(k => k.energy >= 0 && k.spread > 0))
  assert.ok(st.meet.reduce((a, b) => a + b) > 0, 'particles met')
  assert.ok(st.clusters >= 1)
  assert.equal(life.stats().meet.reduce((a, b) => a + b), 0, 'reset after reading')
  assert.equal(pairIndex(2, 1, 4), pairIndex(1, 2, 4))
})

test('worldSize keeps density steady', () => {
  assert.deepEqual(worldSize(1000), { width: 1000, height: 673 })
  const a = worldSize(400, 2), b = worldSize(4000, 2)
  assert.ok(Math.abs(a.width * a.height / 400 - b.width * b.height / 4000) < 10)
  assert.ok(Math.abs(b.height / b.width - 2) < 0.01)
})
