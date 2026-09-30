// The built Aether node, run in a fake AudioWorklet scope: it registers,
// sounds, stays finite, and every slider changes the sound.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const SR = 48000
let Processor, name

before(async () => {
  execFileSync('node', ['build.js'], { stdio: 'ignore' })
  const js = await readFile('dist/node/microbe-life/dsp.js', 'utf8')
  class AudioWorkletProcessor { constructor() { this.port = { postMessage: m => { this.port.last = m }, onmessage: null } } }
  const scope = { sampleRate: SR, AudioWorkletProcessor, registerProcessor: (n, c) => { name = n; Processor = c } }
  new Function(...Object.keys(scope), js)(...Object.values(scope))
})

function render(p, seconds) {
  const L = new Float32Array(128), R = new Float32Array(128)
  const out = { l: new Float32Array(Math.ceil(seconds * SR / 128) * 128), r: null }
  out.r = new Float32Array(out.l.length)
  for (let at = 0; at < out.l.length; at += 128) {
    p.process([], [[L, R]])
    out.l.set(L, at); out.r.set(R, at)
  }
  return out
}
const rms = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length)
const report = p => { p.port.onmessage({ data: { type: 'microbe:report' } }); return p.port.last }
const send = (p, id, value, dialect = 0) => p.port.onmessage({ data: dialect ? { type: 'aether:param-change', paramId: id, value } : { type: 'PARAMETER_CHANGE', id, value } })
// energy at one frequency (Goertzel), over the last half second
function energyAt(a, f) {
  const x = a.subarray(a.length - SR / 2), w = 2 * Math.cos(2 * Math.PI * f / SR)
  let s1 = 0, s2 = 0
  for (const v of x) { const s0 = v + w * s1 - s2; s2 = s1; s1 = s0 }
  return (s1 * s1 + s2 * s2 - w * s1 * s2) / x.length
}

test('registers under its Aether id', () => {
  assert.equal(name, 'com.aether.node.microbelife')
})

test('sounds, finite and within ±1', () => {
  const p = new Processor()
  const a = render(p, 3)
  assert.ok(a.l.every(Number.isFinite) && a.r.every(Number.isFinite))
  let peak = 0; for (const x of a.l) peak = Math.max(peak, Math.abs(x))
  assert.ok(peak <= 1, `peak ${peak}`)
  assert.ok(rms(a.l) > 0.01, `rms ${rms(a.l)}`)
  assert.ok(rms(a.l) > 0.005 && rms(a.r) > 0.005, 'both channels carry sound')
})

test('meetings ring grains', () => {
  const p = new Processor()
  send(p, 'genome', 7)            // swimmers: fast, many meetings
  render(p, 6)
  assert.ok(report(p).rung > 0, `rung ${report(p).rung}`)
})

test('every slider changes the sound or the creature', () => {
  const base = new Processor(); render(base, 1)
  const r0 = report(base)
  const cases = {
    genome: [7, r => r.kinds !== r0.kinds || r.n !== r0.n],
    voices: [2, r => r.freqs.length === 2],
    harmony: [0, r => r.freqs.some((f, i) => Math.abs(f - r0.freqs[i]) > 1)],
    reach: [2, r => Math.abs(r.freqs[0] - r0.freqs[0] / 2) < 1],
    root: [220, r => Math.abs(r.freqs[0] - 220) < 1],
  }
  for (const [id, [value, ok]] of Object.entries(cases)) {
    const p = new Processor(); render(p, 0.2)
    send(p, id, value, id === 'root' ? 1 : 0)
    render(p, 0.2)
    assert.ok(ok(report(p)), `${id} → ${value}: ${JSON.stringify(report(p).freqs)}`)
  }
  // tempo, sustain, mutation change the creature's motion; gain the level
  const quiet = new Processor(); send(quiet, 'gain', 0); assert.equal(rms(render(quiet, 0.5).l), 0)
  for (const [id, value] of [['tempo', 3], ['sustain', 1], ['mutation', 1]]) {
    const a = new Processor(), b = new Processor()
    send(b, id, value)
    render(a, 1); render(b, 1)
    const xa = Array.from(a.life.x.slice(0, 20)), xb = Array.from(b.life.x.slice(0, 20))
    assert.notDeepEqual(xa, xb, `${id} moved nothing`)
  }
})

test('root sets the pitch the ear hears', () => {
  const p = new Processor(); send(p, 'voices', 2); send(p, 'harmony', 1)
  send(p, 'root', 110)
  const a = render(p, 1).l.slice()
  send(p, 'root', 220)
  const b = render(p, 1).l
  // the 110 Hz fundamental dominates the first, and moves to 220 Hz
  assert.ok(energyAt(a, 110) > 10 * energyAt(b, 110), `110 Hz: ${energyAt(a, 110).toExponential(2)} then ${energyAt(b, 110).toExponential(2)}`)
  assert.ok(energyAt(b, 220) > 3 * energyAt(a, 220 * 1.06), '220 Hz sounds after the change')
})

test('light enough for the audio thread', () => {
  const p = new Processor(); send(p, 'genome', 11)   // colonies: six kinds, the busiest
  render(p, 1)
  const t = performance.now()
  const blocks = 375                                   // one second at 48 kHz
  const L = new Float32Array(128), R = new Float32Array(128)
  for (let i = 0; i < blocks; i++) p.process([], [[L, R]])
  const perBlock = (performance.now() - t) / blocks
  assert.ok(perBlock < 0.5, `${perBlock.toFixed(3)} ms a block (budget 2.67 ms)`)
  console.log(`# ${perBlock.toFixed(3)} ms per 128-sample block, ${(perBlock / 2.667 * 100).toFixed(1)}% of real time`)
})
