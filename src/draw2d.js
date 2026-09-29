// Canvas 2D painter: soft cells over fading trails.
//
// blend 'cell' (default): each particle is a faint halo plus an opaque
//   disc, painted over one another, so a dense colony stays its own colours
//   instead of burning to white, and layered kinds read as membranes.
// blend 'glow': additive dots, the brighter look of the Phase 0 demo.
//
// Sprites are pre-rendered per kind, so a frame is one fillRect plus one
// or two drawImage calls per particle.

export const PALETTE = ['#7fd88f', '#e0b35a', '#5ec8d8', '#c77dd8', '#e87a6a', '#d8d06a', '#6a8ee8']

export class Painter {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.palette = options.palette || PALETTE
    this.background = options.background || '#06080b'
    this.trail = options.trail ?? 0.22     // 1 = no trails
    this.size = options.size ?? 2.4        // dot radius in CSS pixels
    this.blend = options.blend || 'cell'
    this.maxDpr = options.maxDpr ?? 1.5
    this.resize()
  }

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
    this.dots = this.palette.map(c => this.blend === 'glow' ? glowSprite(c, r) : discSprite(c, r))
    this.halos = this.blend === 'glow' ? null : this.palette.map(c => haloSprite(c, r * 3.2))
  }

  clear() {
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.globalAlpha = 1
    this.ctx.fillStyle = this.background
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  draw(life) {
    const { ctx, canvas } = this
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = this.trail
    ctx.fillStyle = this.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1
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
  }
}

function surface(size) {
  return typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size })
}

function glowSprite(colour, radius) {
  const size = Math.ceil(radius * 4), c = surface(size), g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, colour)
  grad.addColorStop(0.25, colour)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.globalAlpha = 0.9
  g.fillRect(0, 0, size, size)
  c.half = size / 2
  return c
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
