// Microbe Life page background: one <script> tag, a quiet creature behind
// the page.
//
//   <script defer src="microbe-bg.min.js" data-genome="amoeba"></script>
//
// data-genome   a curated name; data-seed seeds a random
//               creature instead (a page slug, say)
// data-count    particles, default 400 (halved while frames run over 8 ms)
// data-opacity  default 0.35
// data-fps      frames a second, default 30
// data-scale    canvas pixels per CSS pixel, default 1 (0.5 = softer, cheaper)
//
// Guards: 30 frames a second at most, the device pixel ratio capped at 1,
// nothing runs while the tab is hidden, and a reader who asks for reduced
// motion gets one still frame of a grown creature.
//
// API on window.microbeBackground:
//   show(genomeOrSeed, seconds)  crossfade to another creature
//   level(x)                     0…1, lets sound breathe the glow
//   life, paused

import { worldSize } from '../../src/core.js'
import { Painter } from '../../src/draw2d.js'
import { lifeFromGenome } from '../../src/genome.js'
import { GALLERY } from '../../src/genomes.js'
import { hash32 } from '../../src/rng.js'

const script = document.currentScript || document.querySelector('script[src*="microbe-bg"]')
const opt = (k, d) => script?.dataset?.[k] ?? d
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

const canvas = document.createElement('canvas')
canvas.className = 'microbe-bg'
canvas.setAttribute('aria-hidden', 'true')
const opacity = +opt('opacity', 0.35)
Object.assign(canvas.style, {
  position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '-1',
  pointerEvents: 'none', opacity: String(opacity), transition: 'opacity 0.6s',
})
document.body.prepend(canvas)
hoistBackground()

const painter = new Painter(canvas, { background: null, trail: 0.2, size: 2.2, maxDpr: +opt('scale', 1) })
const frameGap = 1000 / +opt('fps', 30) - 1
let count = +opt('count', 400)
let life = grow(opt('genome') || opt('seed') || 'amoeba')
let from = null, fadeStart = 0, fadeLength = 0
let last = 0, slow = 0, breath = 0, paused = false, held = false, frameMs = 0, frames = 0

// A curated name, or anything else as a word seed (4 kinds).
function genomeFor(key) {
  if (typeof key === 'object') return key
  const named = GALLERY.find(g => g.name === key)
  if (named) return named
  return { kinds: 4, seed: String(key) }
}

// A background arrives already grown: 400 steps cost about 20 ms at 400
// particles. A crossfade grows the next creature a little less, so it is
// still gathering itself as it fades in.
function grow(key, settle = reduced ? 600 : 400) {
  const g = genomeFor(key)
  const aspect = Math.min(3, Math.max(0.3, innerHeight / Math.max(1, innerWidth)))
  const l = lifeFromGenome(g, { count: Math.max(1, Math.round(count / g.kinds)), ...worldSize(count, aspect) })
  for (let i = 0; i < settle; i++) l.step()
  l.genomeName = g.name || String(g.seed)
  l.base = { rules: Float64Array.from(l.rules), radius: Float64Array.from(l.radius) }
  return l
}

function frame(now) {
  if (paused) return
  requestAnimationFrame(frame)
  if (now - last < frameGap) return       // 30 fps is plenty for a background
  last = now
  const t0 = performance.now()
  life.step()
  if (from) {
    from.step()
    const t = Math.min(1, (now - fadeStart) / fadeLength)
    painter.drawPair(from, life, t)
    if (t >= 1) from = null
  } else painter.draw(life)
  canvas.style.opacity = String(opacity * (0.75 + 0.6 * breath))
  // Over budget for a second: halve the particles and keep going.
  const spent = performance.now() - t0
  frameMs = frameMs * 0.95 + spent * 0.05
  frames++
  slow = spent > 8 ? slow + 1 : Math.max(0, slow - 1)
  if (slow > 30 && count > 100) {
    const key = life.genomeKey
    count = Math.round(count / 2)
    life = grow(key); life.genomeKey = key; slow = 0
  }
}

function stillFrame() {
  painter.resize(); painter.clear()
  painter.trail = 1
  painter.draw(life)
}

function show(key, seconds = 3) {
  const next = grow(key, 120)
  next.genomeKey = typeof key === 'object' ? key.name : key
  if (reduced) { life = grow(key, 600); life.genomeKey = key; stillFrame(); return }
  from = life
  life = next
  fadeStart = performance.now()
  fadeLength = seconds * 1000
}

// Page backgrounds painted on <body> would cover a canvas at z-index -1, so
// move them to <html>, where the canvas can sit on top of them.
function hoistBackground() {
  const b = getComputedStyle(document.body), h = document.documentElement.style
  if (b.backgroundImage === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(b.backgroundColor)) return
  h.backgroundImage = b.backgroundImage
  h.backgroundColor = b.backgroundColor
  h.backgroundAttachment = b.backgroundAttachment
  h.backgroundPosition = b.backgroundPosition
  h.backgroundSize = b.backgroundSize
  h.backgroundRepeat = b.backgroundRepeat
  document.body.style.background = 'transparent'
}

life.genomeKey = opt('genome') || opt('seed') || 'amoeba'
addEventListener('resize', () => { painter.resize(); if (reduced) stillFrame() })
document.addEventListener('visibilitychange', () => {
  const was = paused
  paused = document.hidden || reduced || held
  if (was && !paused) requestAnimationFrame(frame)
})
if (reduced) { paused = true; life = grow(life.genomeKey, 600); stillFrame() }
else requestAnimationFrame(frame)

// ── Sound Site adapter ───────────────────────────────────────────────────
// On the night.earth Sound Site each page has its own creature (the page's
// `creature` in scenes.json, else one of the curated genomes chosen by the
// page slug), crossfaded over the scene's FADE, and the master level breathes
// the glow while sound plays.
function creatureFor(page) {
  return page.creature || GALLERY[hash32(page.slug) % GALLERY.length].name
}
function soundSite() {
  const site = window.soundSite
  if (!site?.data?.pages?.length) return false
  const route = () => {
    const slug = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
    return site.data.pages.find(p => p.slug === slug) || site.data.pages[0]
  }
  let shown = null
  const follow = () => {
    const key = creatureFor(route())
    if (key === shown) return
    if (shown === null && !opt('genome')) { life = grow(key); life.genomeKey = key; if (reduced) stillFrame() }
    else show(key, site.data.fade || 3)
    shown = key
  }
  follow()

  // A Microbe Life voice in the scene steers the creature. The code for it
  // (and the musical mapping) is a separate file, microbe-steer.js, fetched
  // the first time a scene holds such a voice, so pages without one never
  // load it.
  let steering = null, steerLoading = false
  const hasVoice = () => (site.player?.tracks || []).some(t => (t.voices || []).some(v => v.key === 'microbe-life'))
  const steer = () => {
    if (steering) return steering.steer()
    if (steerLoading || !hasVoice() || !script?.src) return
    steerLoading = true
    import(new URL('microbe-steer.js', script.src).href).then(m => {
      steering = m.steerer(site, {
        get life() { return life }, show, painter, follow: () => { shown = null; follow() },
        get fade() { return site.data.fade || 3 },
      })
    }).catch(e => console.warn('[microbe-bg] steering unavailable:', e.message))
  }
  addEventListener('hashchange', () => { if (!steering?.active) follow() })

  // Breath follows the music against its own recent average (about five
  // seconds), so a steady scene glows at mid level and swells and ebbs with
  // its phrases, loud or quiet.
  let average = 0
  setInterval(() => {
    const p = site.player
    const on = p?.ctx?.state === 'running' && !p.muted && !document.hidden
    steer()
    if (!on) return window.microbeBackground.level(0)
    const rms = p.state().master
    average = average ? average * 0.98 + rms * 0.02 : rms
    window.microbeBackground.level(0.5 * rms / Math.max(0.01, average))
  }, 100)
  return true
}
if (!soundSite()) {
  let tries = 0
  const wait = setInterval(() => { if (soundSite() || ++tries > 50) clearInterval(wait) }, 100)
}

window.microbeBackground = {
  show,
  // hold still (a reader's choice, or a measurement), and let go again
  pause() { held = true; paused = true },
  resume() { held = false; if (paused && !document.hidden && !reduced) { paused = false; requestAnimationFrame(frame) } },
  level(x) { breath = breath * 0.8 + Math.max(0, Math.min(1, x)) * 0.2 },
  get life() { return life },
  get count() { return count },
  get paused() { return paused },
  get breath() { return breath },
  get frameMs() { return frameMs },   // step + draw, smoothed
  get frames() { return frames },
}
