// Microbe Life, the Aether node's sound: an AudioWorklet that runs its own
// small copy of the creature and listens to it. The sound never needs the
// panel, so it keeps playing with the panel shut.
//
//   voices    each kind is a drone of three partials: loudness from the
//             kind's energy, pan from its centre, brightness from how tightly
//             it holds together, pitch from root × harmony × reach
//   grains    new contacts between two kinds ring a short bell between their
//             pitches; sustain sets how long it rings
//   division  a colony that splits in two rings a longer bell at its main
//             kind's pitch, at most once every 1.5 seconds
//
// Parameters arrive by port as PARAMETER_CHANGE { id, value } or
// aether:param-change { paramId, value }, as Aether sends both.

import { worldSize } from '../../src/core.js'
import '../../src/colonies.js'
import { lifeFromGenome } from '../../src/genome.js'
import { DEFAULTS, clampParam, genomeFor, applyParams, baseOf, mutate, voiceRatios, octaveFor } from '../../src/map.js'

const PER_KIND = 24, STEPS_PER_SECOND = 60, LISTEN_EVERY = 6, MAX_GRAINS = 12
const TAU = Math.PI * 2

class MicrobeLifeProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.sr = sampleRate
    this.params = { ...DEFAULTS }
    this.samplesPerStep = this.sr / STEPS_PER_SECOND
    this.untilStep = 0
    this.grains = []
    this.phase = new Float64Array(6 * 3)
    this.voice = Array.from({ length: 6 }, () => ({ amp: 0, target: 0, pan: 0, panTarget: 0, bright: 0.5, brightTarget: 0.5, peak: 1e-9 }))
    this.rung = 0; this.bells = 0; this.sinceBell = 9
    this.build()
    this.port.onmessage = e => this.message(e.data || {})
  }

  message(m) {
    if (m.type === 'PARAMETER_CHANGE') this.set(m.id, m.value)
    else if (m.type === 'aether:param-change') this.set(m.paramId, m.value)
    else if (m.type === 'microbe:report') this.port.postMessage({ type: 'microbe:report', ...this.report() })
  }

  set(id, value) {
    if (!(id in this.params)) return
    const v = clampParam(id, value)
    const old = this.params[id]
    this.params[id] = v
    if (v === old) return
    if (id === 'genome' || (id === 'voices' && this.params.genome >= 12)) this.build()
    else if (id !== 'root' && id !== 'gain' && id !== 'voices' && id !== 'mutation') applyParams(this.life, this.params, this.base)
  }

  build() {
    const g = genomeFor(this.params)
    const n = PER_KIND * g.kinds
    this.life = lifeFromGenome(g, { count: PER_KIND, ...worldSize(n, 0.6) })
    this.base = baseOf(this.life)
    applyParams(this.life, this.params, this.base)
    for (let i = 0; i < 200; i++) this.life.step()   // arrive grown, as the panel does
    this.lastMeet = new Uint32Array(this.life.meet.length)
    this.life.meet.fill(0)
    this.labels = null
    this.steps = 0
    for (const v of this.voice) v.peak = 1e-9
  }

  // ── listening ──────────────────────────────────────────────────────────
  step() {
    const life = this.life
    life.step()
    this.steps++
    // new contacts since the last step, per pair of kinds → grains
    const k = life.k, meet = life.meet, voiced = Math.min(k, this.params.voices)
    let rung = 0
    for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) {
      const i = a * k + b
      const fresh = meet[i] > this.lastMeet[i] ? meet[i] - this.lastMeet[i] : 0
      if (fresh && rung < 2 && Math.random() < 1 - Math.exp(-fresh * 0.12)) {
        this.grain(this.freqOf(a % voiced) * this.freqOf(b % voiced), (this.voice[a % 6].pan + this.voice[b % 6].pan) / 2)
        rung++
      }
    }
    this.lastMeet.set(meet)
    meet.fill(0)
    if (this.steps % LISTEN_EVERY === 0) this.listen()
  }

  listen() {
    this.sinceBell += LISTEN_EVERY / STEPS_PER_SECOND
    const life = this.life, st = life.stats({ reset: false })
    const voiced = Math.min(life.k, this.params.voices)
    st.kinds.forEach((s, i) => {
      if (i >= 6) return
      const v = this.voice[i]
      v.peak = Math.max(s.energy, v.peak * 0.995)
      v.target = i < voiced ? 0.25 + 0.75 * Math.sqrt(s.energy / v.peak) : 0
      v.panTarget = 0.8 * Math.sin(TAU * s.cx / life.width)
      v.brightTarget = Math.max(0, Math.min(1, 1 - s.spread / (0.35 * life.width)))
    })
    // a colony of six or more that split since the last listen rings a bell
    const labels = life.labels
    if (this.labels && this.cols) {
      for (const c of this.cols) {
        if (c.size < 6) continue
        const hist = new Map()
        for (let i = 0; i < life.n; i++) if (this.labels[i] === c.id) hist.set(labels[i], (hist.get(labels[i]) || 0) + 1)
        let parts = 0
        for (const m of hist.values()) if (m >= 0.3 * c.size && m >= 3) parts++
        if (parts >= 2) {
          const top = c.kinds.indexOf(Math.max(...c.kinds))
          if (this.sinceBell >= 1.5) {
            this.bell(this.freqOf(top % voiced), 0.8 * Math.sin(TAU * c.cx / life.width))
            this.sinceBell = 0
          }
          break
        }
      }
    }
    this.labels = Int32Array.from(labels)
    this.cols = st.colonies
    this.colonyCount = st.clusters
    if (this.params.mutation > 0) {
      mutate(this.base, this.params.mutation)
      applyParams(life, this.params, this.base)
    }
  }

  freqOf(i) {
    const ratios = voiceRatios(Math.min(this.life.k, this.params.voices), this.params.harmony)
    return this.params.root * ratios[i] * Math.pow(2, octaveFor(this.params.reach))
  }

  grain(pairProduct, pan) {
    const f = 2 * Math.sqrt(pairProduct)                 // an octave above the pair
    const decay = 0.04 + 0.9 * this.params.sustain * this.params.sustain
    this.addGrain({ f, f2: f * 2.76, amp: 0.22, decay, pan })
  }

  bell(f, pan) {
    this.addGrain({ f, f2: f * 2.76, amp: 0.32, decay: 0.8 + 1.2 * this.params.sustain, pan, bell: true })
  }

  addGrain(g) {
    g.t = 0; g.ph = 0; g.ph2 = 0
    if (g.bell) this.bells++; else this.rung++
    if (this.grains.length >= MAX_GRAINS) this.grains.shift()
    this.grains.push(g)
  }

  report() {
    const life = this.life
    return {
      kinds: life.k, n: life.n, steps: this.steps, colonies: this.colonyCount || 0,
      voices: this.voice.slice(0, life.k).map(v => ({ amp: +v.amp.toFixed(3), pan: +v.pan.toFixed(2), bright: +v.bright.toFixed(2) })),
      grains: this.grains.length, rung: this.rung, bells: this.bells, freqs: Array.from({ length: Math.min(life.k, this.params.voices) }, (_, i) => +this.freqOf(i).toFixed(1)),
      params: this.params,
    }
  }

  // ── sound ──────────────────────────────────────────────────────────────
  process(inputs, outputs) {
    const out = outputs[0]
    const L = out[0], R = out[1] || out[0]
    const len = L.length, sr = this.sr
    const voiced = Math.min(this.life.k, this.params.voices)
    const freqs = new Float64Array(voiced)
    for (let i = 0; i < voiced; i++) freqs[i] = this.freqOf(i)
    const smooth = 1 - Math.exp(-1 / (0.05 * sr))       // 50 ms glide
    const level = this.params.gain / Math.sqrt(Math.max(1, voiced))
    for (let s = 0; s < len; s++) {
      if (--this.untilStep <= 0) { this.step(); this.untilStep += this.samplesPerStep }
      let l = 0, r = 0
      for (let i = 0; i < voiced; i++) {
        const v = this.voice[i]
        v.amp += (v.target - v.amp) * smooth
        v.pan += (v.panTarget - v.pan) * smooth
        v.bright += (v.brightTarget - v.bright) * smooth
        const f = freqs[i], p = i * 3
        this.phase[p] = (this.phase[p] + f / sr) % 1
        this.phase[p + 1] = (this.phase[p + 1] + 2 * f / sr) % 1
        this.phase[p + 2] = (this.phase[p + 2] + 3 * f / sr) % 1
        const x = v.amp * (Math.sin(TAU * this.phase[p]) + 0.5 * v.bright * Math.sin(TAU * this.phase[p + 1]) + 0.3 * v.bright * v.bright * Math.sin(TAU * this.phase[p + 2])) * 0.35
        const a = (v.pan + 1) * Math.PI / 4
        l += x * Math.cos(a); r += x * Math.sin(a)
      }
      for (let g = 0; g < this.grains.length; g++) {
        const gr = this.grains[g]
        const env = Math.exp(-gr.t / gr.decay) * Math.min(1, gr.t * 400)   // 2.5 ms attack
        gr.ph = (gr.ph + gr.f / sr) % 1
        gr.ph2 = (gr.ph2 + gr.f2 / sr) % 1
        const x = gr.amp * env * (Math.sin(TAU * gr.ph) + 0.35 * Math.sin(TAU * gr.ph2))
        const a = (gr.pan + 1) * Math.PI / 4
        l += x * Math.cos(a); r += x * Math.sin(a)
        gr.t += 1 / sr
      }
      L[s] = Math.tanh(l * level)
      R[s] = Math.tanh(r * level)
    }
    this.grains = this.grains.filter(g => g.t < g.decay * 7)
    return true
  }
}

registerProcessor('com.aether.node.microbelife', MicrobeLifeProcessor)
