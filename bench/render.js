// Render the Aether node offline to a WAV, driving params over time.
// node bench/render.js out.wav seconds 'genome=0 root=110' ['t=5 harmony=0' …]
import { readFile, writeFile } from 'node:fs/promises'
const [out, seconds = '10', ...moves] = process.argv.slice(2)
const SR = 48000
const js = await readFile('dist/node/microbe-life/dsp.js', 'utf8')
let P
class AudioWorkletProcessor { constructor() { this.port = { postMessage() {}, onmessage: null } } }
new Function('sampleRate', 'AudioWorkletProcessor', 'registerProcessor', js)(SR, AudioWorkletProcessor, (n, c) => { P = c })
const parse = s => Object.fromEntries(s.split(/\s+/).filter(Boolean).map(kv => kv.split('=')).map(([k, v]) => [k, +v]))
const plan = moves.map(parse).map(m => ({ t: m.t ?? 0, set: Object.fromEntries(Object.entries(m).filter(([k]) => k !== 't')) }))
const p = new P()
const n = Math.ceil(+seconds * SR / 128) * 128
const pcm = new Int16Array(n * 2)
const L = new Float32Array(128), R = new Float32Array(128)
for (let at = 0; at < n; at += 128) {
  for (const m of plan) if (!m.done && at / SR >= m.t) { m.done = true; for (const [k, v] of Object.entries(m.set)) p.port.onmessage({ data: { type: 'PARAMETER_CHANGE', id: k, value: v } }) }
  p.process([], [[L, R]])
  for (let i = 0; i < 128; i++) { pcm[(at + i) * 2] = L[i] * 32767; pcm[(at + i) * 2 + 1] = R[i] * 32767 }
}
const head = Buffer.alloc(44)
head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.byteLength, 4); head.write('WAVEfmt ', 8)
head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24)
head.writeUInt32LE(SR * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.byteLength, 40)
await writeFile(out, Buffer.concat([head, Buffer.from(pcm.buffer)]))
console.log(out, seconds + ' s')
