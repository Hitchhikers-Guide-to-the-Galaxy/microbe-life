// Canvas 2D painter: soft cells over fading trails.
//
// blend 'cell' (default): each particle is a faint halo plus an opaque
//   disc, painted over one another, so a dense colony stays its own colours
//   instead of burning to white, and layered kinds read as membranes.
// blend 'glow': additive dots, the brighter look of the Phase 0 demo
//   (import './glow.js' to have it; the page background leaves it out).
//
// Sprites are pre-rendered per kind, so a frame is one fillRect plus one
// or two drawImage calls per particle.

// Extra sprite styles install themselves here (see glow.js).
export const SPRITES = {}

export const PALETTE = ['#7fd88f', '#e0b35a', '#5ec8d8', '#c77dd8', '#e87a6a', '#d8d06a', '#6a8ee8']

export class Painter {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this._palette = options.palette || null
    // null = a transparent canvas whose trails fade by erasing (for a page
    // background, over whatever the page already paints)
    this.background = options.background === undefined ? '#06080b' : options.background
    this.trail = options.trail ?? 0.22     // 1 = no trails
    this.size = options.size ?? 2.4        // dot radius in CSS pixels
    this.blend = options.blend || 'cell'
    this.maxDpr = options.maxDpr ?? 1.5
    this.resize()
  }

  get palette() { return this._palette || PALETTE }
  set palette(p) { this._palette = p || null }

  resize() {
    const dpr = Math.min(this.maxDpr, globalThis.devicePixelRatio || 1)
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
      this.clear()
    }
    this.dpr = dpr
    const r = this.size * dpr
    const glow = this.blend === 'glow' && SPRITES.glow
    this.dots = this.palette.map(c => glow ? glow(c, r) : discSprite(c, r))
    this.halos = glow ? null : this.palette.map(c => haloSprite(c, r * 3.2))
  }

  clear() {
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.globalAlpha = 1
    if (this.background === null) { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); return }
    this.ctx.fillStyle = this.background
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  draw(life, alpha = 1) {
    const { ctx, canvas } = this
    if (alpha >= 1 || this._fadedAt !== life) {
      // fade the last frame once per frame, not once per world drawn
      ctx.globalCompositeOperation = this.background === null ? 'destination-out' : 'source-over'
      ctx.globalAlpha = this.trail
      ctx.fillStyle = this.background || '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = alpha
    const sx = canvas.width / life.width, sy = canvas.height / life.height
    const { x, y, kind, n } = life
    const np = this.dots.length
    if (this.halos) {
      for (let i = 0; i < n; i++) {
        const s = this.halos[kind[i] % np]
        ctx.drawImage(s, x[i] * sx - s.half, y[i] * sy - s.half)
      }
    } else ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < n; i++) {
      const s = this.dots[kind[i] % np]
      ctx.drawImage(s, x[i] * sx - s.half, y[i] * sy - s.half)
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  // Two worlds in one frame, for a crossfade: fade once, draw both.
  drawPair(from, to, t) {
    this.draw(to, t)
    this._fadedAt = from
    this.draw(from, 1 - t)
    this._fadedAt = null
  }
}

export function surface(size) {
  return typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size })
}

function discSprite(colour, radius) {
  const size = Math.ceil(radius * 2 + 4), c = surface(size), g = c.getContext('2d')
  g.fillStyle = colour
  g.globalAlpha = 0.92
  g.beginPath()
  g.arc(size / 2, size / 2, radius, 0, Math.PI * 2)
  g.fill()
  c.half = size / 2
  return c
}

function haloSprite(colour, radius) {
  const size = Math.ceil(radius * 2), c = surface(size), g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, colour)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.globalAlpha = 0.07
  g.fillRect(0, 0, size, size)
  c.half = size / 2
  return c
}
