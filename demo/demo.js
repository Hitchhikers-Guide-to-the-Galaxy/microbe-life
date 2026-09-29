// Microbe Life demo: one world, classic or cell mode, curated genomes, word
// seeds, share codes and an in-browser benchmark. Settings travel in the
// query string (?genome=…, ?g=<code>, or ?mode=&seed=&kinds=&n=) because a
// wiki frame puts its own data in the hash; no storage is used, since a
// sandboxed frame has none.
import { Life, worldSize } from '../src/core.js'
import '../src/colonies.js'
import '../src/classic.js'
import { Painter } from '../src/draw2d.js'
import { encode, decode, lifeFromGenome, genomeOf, wordSeed } from '../src/genome.js'
import { GENOMES } from '../src/genomes.js'

const $ = id => document.getElementById(id)
const canvas = $('world')
const q = new URLSearchParams(location.search)
const painter = new Painter(canvas, { blend: q.get('blend') === 'glow' ? 'glow' : 'cell' })
const state = {
  genome: null,
  mode: q.get('mode') === 'classic' ? 'classic' : 'cell',
  seed: q.get('seed') || 'moss_ember',
  kinds: clamp(+q.get('kinds') || 4, 2, 7),
  n: [400, 1000, 2000].includes(+q.get('n')) ? +q.get('n') : 1000,
}
if (q.get('g')) {
  try { state.genome = { name: 'shared', ...decode(q.get('g')) } } catch { /* ignore a bad code */ }
} else if (q.get('genome')) {
  state.genome = GENOMES.find(g => g.name === q.get('genome')) || null
}
let life, stepMs = 0, frameMs = 16, last = performance.now(), running = true

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

function world() {
  const box = canvas.getBoundingClientRect()
  const aspect = box.width > 10 && box.height > 10 ? clamp(box.height / box.width, 0.3, 3) : 0.68
  const g = state.genome || { kinds: state.kinds, seed: state.seed, mode: state.mode }
  state.kinds = g.kinds; state.seed = g.seed; state.mode = g.mode || 'cell'
  life = lifeFromGenome(g, { count: Math.round(state.n / g.kinds), ...worldSize(state.n, aspect) })
  painter.resize(); painter.clear()
  sync()
}

function sync() {
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', b.dataset.mode === state.mode)
  $('seed').value = String(state.seed)
  $('kinds').value = state.kinds
  $('n').value = state.n
  $('genome').value = state.genome && GENOMES.includes(state.genome) ? state.genome.name : ''
  $('blend').textContent = painter.blend === 'glow' ? 'glow' : 'cells'
  const code = encode(genomeOf(life))
  const params = { g: code, n: state.n }
  if (painter.blend === 'glow') params.blend = 'glow'
  const share = new URL(location.href)
  share.search = new URLSearchParams(params)
  share.hash = ''
  $('share').href = share.href
  $('share').textContent = code
  try { history.replaceState(null, '', share) } catch { /* sandboxed frames may refuse */ }
}

function frame(now) {
  if (!running) return
  frameMs = frameMs * 0.9 + (now - last) * 0.1
  last = now
  const t = performance.now()
  life.step()
  stepMs = stepMs * 0.9 + (performance.now() - t) * 0.1
  painter.draw(life)
  if (life.steps % 20 === 0) {
    const cols = life.colonies()
    const name = state.genome ? state.genome.name : String(state.seed)
    $('readout').textContent = `${name} · ${life.n} particles · step ${stepMs.toFixed(2)} ms · ${Math.round(1000 / frameMs)} fps · ${cols.length} colonies`
  }
  requestAnimationFrame(frame)
}

document.addEventListener('visibilitychange', () => {
  running = !document.hidden
  if (running) { last = performance.now(); requestAnimationFrame(frame) }
})

const custom = () => { state.genome = null }
for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { custom(); state.mode = b.dataset.mode; world() }
$('seed').onchange = e => { custom(); state.seed = e.target.value.trim() || 'moss_ember'; world() }
$('dice').onclick = () => { custom(); state.seed = wordSeed(); world() }
$('kinds').onchange = e => { custom(); state.kinds = +e.target.value; world() }
$('n').onchange = e => { state.n = +e.target.value; world() }
$('genome').onchange = e => { state.genome = GENOMES.find(g => g.name === e.target.value) || null; world() }
$('blend').onclick = () => { painter.blend = painter.blend === 'glow' ? 'cell' : 'glow'; painter.resize(); painter.clear(); sync() }
$('genome').insertAdjacentHTML('beforeend', GENOMES.map(g => `<option value="${g.name}">${g.name}</option>`).join(''))
new ResizeObserver(() => { painter.resize() }).observe(canvas)

// ── benchmark ────────────────────────────────────────────────────────────
const CASES = [['classic', 1000], ['cell', 400], ['cell', 1000], ['cell', 2000], ['classic', 2000]]
$('bench').onclick = async () => {
  running = false
  const out = $('results'), btn = $('bench')
  btn.disabled = true
  out.innerHTML = '<tr><th>mode</th><th>particles</th><th>step ms</th><th>colonies</th></tr>'
  for (const [mode, n] of CASES) {
    await new Promise(r => setTimeout(r, 30))
    const l = new Life({ mode, count: n / 4, width: 1000, height: 1000, seed: 'moss_ember' })
    for (let i = 0; i < 300; i++) l.step()
    const t = performance.now()
    for (let i = 0; i < 300; i++) l.step()
    const ms = (performance.now() - t) / 300
    out.insertAdjacentHTML('beforeend', `<tr><td>${mode}</td><td>${n}</td><td>${ms.toFixed(2)}</td><td>${l.clusters()}</td></tr>`)
  }
  btn.disabled = false
  running = true; last = performance.now(); requestAnimationFrame(frame)
}

// build the world once the canvas has been laid out, so its aspect is real
requestAnimationFrame(() => { world(); last = performance.now(); requestAnimationFrame(frame) })
window.microbeLife = { get life() { return life }, state, painter, GENOMES }
