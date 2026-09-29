// Canvas 2D painter: soft glowing dots over fading trails.
// One pre-rendered sprite per kind, drawn additively, so a frame is a
// fillRect plus n drawImage calls.

export const PALETTE = ['#7fd88f', '#e0b35a', '#5ec8d8', '#c77dd8', '#e87a6a', '#d8d06a', '#6a8ee8']

export class Painter {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.palette = options.palette || PALETTE
    this.background = options.background || '#06080b'
    this.trail = options.trail ?? 0.22     // 1 = no trails
    this.size = options.size ?? 2.4        // dot radius in CSS pixels
    this.maxDpr = options.maxDpr ?? 1.5
    this.sprites = []
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
    this.sprites = this.palette.map(c => sprite(c, this.size * dpr))
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
    ctx.globalCompositeOperation = 'lighter'
    const sx = canvas.width / life.width, sy = canvas.height / life.height
    const { x, y, kind, n } = life
    for (let i = 0; i < n; i++) {
      const s = this.sprites[kind[i] % this.sprites.length]
      ctx.drawImage(s, x[i] * sx - s.half, y[i] * sy - s.half)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

function sprite(colour, radius) {
  const size = Math.ceil(radius * 4)
  const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size })
  const g = c.getContext('2d')
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
