// Phase 0 demo: one world, a classic / cell toggle, live timings and an
// in-browser benchmark. Settings travel in the query string (?mode=cell&seed=…)
// because a wiki frame puts its own data in the hash; no storage is used,
// since a sandboxed frame has none.
import { Life, worldSize } from '../src/core.js'
import { Painter } from '../src/draw2d.js'

const WORDS = ['moss', 'ember', 'soil', 'lantern', 'spore', 'tide', 'amber', 'fern', 'silt', 'root', 'drift', 'lichen', 'hypha', 'dew', 'loam', 'pollen']
const $ = id => document.getElementById(id)
const canvas = $('world')
const painter = new Painter(canvas)
const q = new URLSearchParams(location.search)
const state = {
  mode: q.get('mode') === 'classic' ? 'classic' : 'cell',
  seed: q.get('seed') || 'moss_ember',
  kinds: clamp(+q.get('kinds') || 4, 2, 7),
  n: [400, 1000, 2000].includes(+q.get('n')) ? +q.get('n') : 1000,
}
let life, stepMs = 0, frameMs = 16, last = performance.now(), running = true

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

function world() {
  const box = canvas.getBoundingClientRect()
  const aspect = box.width > 10 && box.height > 10 ? clamp(box.height / box.width, 0.3, 3) : 0.68
  const { width, height } = worldSize(state.n, aspect)
  life = new Life({ mode: state.mode, kinds: state.kinds, count: Math.round(state.n / state.kinds), width, height, seed: state.seed })
  painter.resize(); painter.clear()
  sync()
}

function sync() {
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', b.dataset.mode === state.mode)
  $('seed').value = state.seed
  $('kinds').value = state.kinds
  $('n').value = state.n
  const url = new URL(location.href)
  url.search = new URLSearchParams({ mode: state.mode, seed: state.seed, kinds: state.kinds, n: state.n })
  try { history.replaceState(null, '', url) } catch { /* sandboxed frames may refuse */ }
}

function frame(now) {
  if (!running) return
  frameMs = frameMs * 0.9 + (now - last) * 0.1
  last = now
  const t = performance.now()
  life.step()
  stepMs = stepMs * 0.9 + (performance.now() - t) * 0.1
  painter.draw(life)
  if (life.steps % 15 === 0) {
    const st = life.stats()
    $('readout').textContent = `${life.n} particles · step ${stepMs.toFixed(2)} ms · ${Math.round(1000 / frameMs)} fps · ${st.clusters} clusters`
  }
  requestAnimationFrame(frame)
}

document.addEventListener('visibilitychange', () => {
  running = !document.hidden
  if (running) { last = performance.now(); requestAnimationFrame(frame) }
})

for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { state.mode = b.dataset.mode; world() }
$('seed').onchange = e => { state.seed = e.target.value.trim() || 'moss_ember'; world() }
$('dice').onclick = () => {
  const w = () => WORDS[Math.floor(Math.random() * WORDS.length)]
  state.seed = `${w()}_${w()}`; world()
}
$('kinds').onchange = e => { state.kinds = +e.target.value; world() }
$('n').onchange = e => { state.n = +e.target.value; world() }
new ResizeObserver(() => { painter.resize() }).observe(canvas)

// ── benchmark ────────────────────────────────────────────────────────────
const CASES = [['classic', 1000], ['cell', 400], ['cell', 1000], ['cell', 2000], ['classic', 2000]]
$('bench').onclick = async () => {
  running = false
  const out = $('results'), btn = $('bench')
  btn.disabled = true
  out.innerHTML = '<tr><th>mode</th><th>particles</th><th>step ms</th><th>clusters</th></tr>'
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
window.microbeLife = { get life() { return life }, state, painter }
