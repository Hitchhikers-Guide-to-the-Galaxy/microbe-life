// Microbe Life, the Aether node's panel: the creature, larger than the one
// the worklet listens to, grown from the same genome and steered by the same
// sliders. Each slider speaks Aether's panel dialect: it posts
// aether:param-change to the host, and follows aether:param-update (or
// PARAMETER_UPDATE) when the host or another panel moves it.

import { worldSize } from '../../src/core.js'
import { Painter } from '../../src/draw2d.js'
import { lifeFromGenome } from '../../src/genome.js'
import { GENOMES } from '../../src/genomes.js'
import { PARAMS, DEFAULTS, clampParam, genomeFor, applyParams, baseOf, mutate, hueFor, paletteFor } from '../../src/map.js'

const $ = s => document.querySelector(s)
const params = { ...DEFAULTS }
const canvas = $('canvas')
const painter = new Painter(canvas, { background: '#0a0a0a', trail: 0.25, size: 2.2 })
const COUNT = 420
let life, base, frameCount = 0

function build() {
  const g = genomeFor(params)
  const box = canvas.getBoundingClientRect()
  const aspect = box.width > 10 && box.height > 10 ? box.height / box.width : 0.45
  life = lifeFromGenome(g, { count: Math.round(COUNT / g.kinds), ...worldSize(COUNT, aspect) })
  base = baseOf(life)
  applyParams(life, params, base)
  for (let i = 0; i < 300; i++) life.step()
  paint()
  $('.genome-name').textContent = params.genome < GENOMES.length ? GENOMES[params.genome].name : `seed ${params.genome}`
}

function paint() {
  painter.palette = paletteFor(life.k, hueFor(params.root))
  painter.resize()
  painter.clear()
}

function set(id, value, from) {
  const v = clampParam(id, value)
  const old = params[id]
  params[id] = v
  const input = document.getElementById(`p-${id}`)
  if (input && +input.value !== v) input.value = v
  const out = document.getElementById(`v-${id}`)
  if (out) out.textContent = format(id, v)
  if (from === 'panel') window.parent.postMessage({ type: 'aether:param-change', paramId: id, value: v }, '*')
  if (v === old) return
  if (id === 'genome' || (id === 'voices' && params.genome >= GENOMES.length)) build()
  else if (id === 'root') paint()
  else if (id !== 'gain' && id !== 'voices' && id !== 'mutation') applyParams(life, params, base)
}

function format(id, v) {
  if (id === 'genome') return v < GENOMES.length ? GENOMES[v].name : String(v)
  if (id === 'root') return `${Math.round(v)} Hz`
  const p = PARAMS.find(q => q.id === id)
  return p.type === 'int' ? String(v) : v.toFixed(2)
}

// sliders
const grid = $('.sliders')
for (const p of PARAMS) {
  const step = p.step || (p.type === 'int' ? 1 : (p.max - p.min) / 200)
  grid.insertAdjacentHTML('beforeend', `<label><span>${p.name}</span><output id="v-${p.id}">${format(p.id, p.default)}</output>
    <input type="range" id="p-${p.id}" min="${p.min}" max="${p.max}" step="${step}" value="${p.default}"></label>`)
}
grid.addEventListener('input', e => {
  const id = e.target.id?.replace(/^p-/, '')
  if (id in params) set(id, +e.target.value, 'panel')
})

window.addEventListener('message', e => {
  const m = e.data
  if (!m || typeof m !== 'object') return
  if (m.type === 'aether:param-update') set(m.paramId, m.value, 'host')
  else if (m.type === 'PARAMETER_UPDATE') set(m.id ?? m.paramId, m.value, 'host')
})

let running = true
function frame() {
  if (!running) return
  requestAnimationFrame(frame)
  life.step()
  painter.draw(life)
  canvas.style.opacity = String(0.55 + 0.45 * params.gain)
  if (++frameCount % 6 === 0 && params.mutation > 0) { mutate(base, params.mutation); applyParams(life, params, base) }
}
document.addEventListener('visibilitychange', () => {
  running = !document.hidden
  if (running) requestAnimationFrame(frame)
})
new ResizeObserver(() => painter.resize()).observe(canvas)

requestAnimationFrame(() => { build(); requestAnimationFrame(frame) })
window.microbePanel = { params, get life() { return life }, set }
