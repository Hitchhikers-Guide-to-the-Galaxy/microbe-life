// Microbe Life core: particle life on typed arrays with a uniform grid.
//
// No DOM, no dependencies, so the same file runs in a page, a Web Worker and
// an AudioWorklet. Two force modes share one data layout:
//
//   classic  Hunar Ahmad's rule (github.com/hunar4321/particle-life, MIT):
//            a constant force g inside the radius, velocity kept by
//            (1 - viscosity), soft wall repel, mirror bounce.
//   cell     near-field repulsion plus a smooth attraction bump (the rule
//            popularised by Tom Mohr's particle-life), which forms the
//            membranes and blobs that read as microbes. Torus world.
//
// Rules are ATTRACTION: positive pulls together (as in smarticles and Mohr).
// Hunar's convention is the opposite sign, so seeding stores his numbers
// negated and classic mode negates them back — bit for bit in 64-bit mode.

import { makeRng } from './rng.js'

const DEFAULTS = {
  mode: 'cell',
  kinds: 4,
  count: 250,          // per kind, or an array of per-kind counts
  width: 1000,
  height: 1000,
  radius: null,        // one number, or k*k per-pair radii; classic 80 (Hunar), cell 40
  precision: 32,       // 64 for conformance tests
  neighbours: 'grid',  // 'brute' visits every pair in index order
  seed: 91651088029,   // Hunar's default seed
  // classic
  viscosity: 0.7,
  wallRepel: 40,
  gravity: 0,
  // cell
  beta: 0.3,           // repulsion core as a fraction of the radius
  core: 3,             // stiffness of that core (Mohr's rule is 1); 3 caps how densely cells pack
  force: 10,
  halfLife: 0.04,      // seconds for friction to halve velocity
  dt: 1 / 60,
  // both
  timeScale: 1,
  contact: 0.3,        // a meeting is closer than contact * radius
}

export class Life {
  constructor(options = {}) {
    const o = { ...DEFAULTS, ...options }
    if (!('wrap' in options)) o.wrap = o.mode === 'cell'
    if (!('margin' in options)) o.margin = o.mode === 'classic' ? 50 : 0
    if (o.radius == null) o.radius = o.mode === 'classic' ? 80 : 40
    Object.assign(this, o)
    const k = this.k = o.kinds
    this.counts = Array.isArray(o.count) ? o.count.slice(0, k) : new Array(k).fill(o.count)
    const n = this.n = this.counts.reduce((a, b) => a + b, 0)
    const F = o.precision === 64 ? Float64Array : Float32Array
    this.x = new F(n); this.y = new F(n)
    this.vx = new F(n); this.vy = new F(n)
    this.kind = new Uint8Array(n)
    this.rules = new Float64Array(k * k)
    this.radius = new Float64Array(k * k)
    this.setRadius(o.radius)
    this.meet = new Uint32Array(k * k)
    this.steps = 0
    this._grid = null
    this.reseed(o.seed)
  }

  setRadius(r) {
    if (typeof r === 'number') this.radius.fill(r)
    else this.radius.set(r)
    this._grid = null
  }

  // One seed sets the rules AND the starting layout, in Hunar's order:
  // rules row by row, then x,y for each particle kind by kind.
  reseed(seed = this.seed) {
    this.seed = seed
    const rnd = makeRng(seed)
    const { k, n } = this
    for (let i = 0; i < k * k; i++) this.rules[i] = -(rnd() * 2 - 1)
    const m = this.margin, w = this.width - 2 * m, h = this.height - 2 * m
    let p = 0
    for (let c = 0; c < k; c++) {
      for (let i = 0; i < this.counts[c]; i++, p++) {
        this.x[p] = rnd() * w + m
        this.y[p] = rnd() * h + m
        this.kind[p] = c
      }
    }
    this.vx.fill(0); this.vy.fill(0)
    this.meet.fill(0)
    this.steps = 0
    this._rnd = rnd
    return this
  }

  step() {
    this._buildGrid()
    if (this.mode === 'classic') this._classic()
    else this._cell()
    this.steps++
  }

  // ── grid ─────────────────────────────────────────────────────────────────
  // Counting sort of particles into cells no smaller than the largest radius,
  // so every neighbour sits in the 3×3 block around a particle. Brute mode is
  // a single cell, which keeps index order and so Hunar's summation order.

  _buildGrid() {
    const { n, width, height } = this
    let rmax = 0
    for (let i = 0; i < this.radius.length; i++) if (this.radius[i] > rmax) rmax = this.radius[i]
    const brute = this.neighbours === 'brute'
    const cols = brute ? 1 : Math.max(1, Math.floor(width / rmax))
    const rows = brute ? 1 : Math.max(1, Math.floor(height / rmax))
    let g = this._grid
    if (!g || g.cols !== cols || g.rows !== rows || g.items.length !== n || g.wrap !== this.wrap) {
      g = this._grid = {
        cols, rows, wrap: this.wrap, cw: width / cols, ch: height / rows,
        start: new Int32Array(cols * rows + 1),
        items: new Int32Array(n),
        cell: new Int32Array(n),
        ...neighbourTable(cols, rows, this.wrap),
      }
    }
    const { start, items, cell, cw, ch } = g
    start.fill(0)
    for (let i = 0; i < n; i++) {
      let cx = Math.floor(this.x[i] / cw), cy = Math.floor(this.y[i] / ch)
      cx = cx < 0 ? 0 : cx >= cols ? cols - 1 : cx
      cy = cy < 0 ? 0 : cy >= rows ? rows - 1 : cy
      const c = cx + cy * cols
      cell[i] = c
      start[c + 1]++
    }
    for (let c = 0; c < cols * rows; c++) start[c + 1] += start[c]
    const fill = start.slice(0, cols * rows)
    for (let i = 0; i < n; i++) items[fill[cell[i]]++] = i
  }

  // ── classic (Hunar) ──────────────────────────────────────────────────────

  _classic() {
    const { n, k, x, y, vx, vy, kind, rules, radius, meet, width, height, wrap } = this
    const { start, items, cell, nbr, nbrN } = this._grid
    const hw = width / 2, hh = height / 2
    const contact2 = this.contact * this.contact
    const wallRepel = this.wallRepel, gravity = this.gravity, timeScale = this.timeScale
    const vmix = (1. - this.viscosity)
    for (let i = 0; i < n; i++) {
      let fx = 0
      let fy = 0
      const ki = kind[i] * k
      const xi = x[i], yi = y[i]
      const c9 = cell[i] * 9, cn = nbrN[cell[i]]
      for (let m = 0; m < cn; m++) {
        const c = nbr[c9 + m]
        {
          for (let s = start[c], e = start[c + 1]; s < e; s++) {
            const j = items[s]
            let dx = xi - x[j]
            let dy = yi - y[j]
            if (wrap) {
              if (dx > hw) dx -= width; else if (dx < -hw) dx += width
              if (dy > hh) dy -= height; else if (dy < -hh) dy += height
            }
            if (dx !== 0 || dy !== 0) {
              const d = dx * dx + dy * dy
              const pair = ki + kind[j]
              const r = radius[pair]
              if (d < r * r) {
                const F = -rules[pair] / Math.sqrt(d)
                fx += F * dx
                fy += F * dy
                if (i < j && d < r * r * contact2) meet[pairIndex(kind[i], kind[j], k)]++
              }
            }
          }
        }
      }
      if (!wrap && wallRepel > 0) {
        const d = wallRepel
        const strength = 0.1
        if (xi < d) fx += (d - xi) * strength
        if (xi > width - d) fx += (width - d - xi) * strength
        if (yi < d) fy += (d - yi) * strength
        if (yi > height - d) fy += (height - d - yi) * strength
      }
      fy += gravity
      vx[i] = vx[i] * vmix + fx * timeScale
      vy[i] = vy[i] * vmix + fy * timeScale
    }
    for (let i = 0; i < n; i++) {
      x[i] += vx[i]
      y[i] += vy[i]
      this._edge(i)
    }
  }

  // ── cell (membranes) ─────────────────────────────────────────────────────

  _cell() {
    const { n, k, x, y, vx, vy, kind, rules, radius, meet, width, height, wrap } = this
    const { start, items, cell, nbr, nbrN } = this._grid
    const hw = width / 2, hh = height / 2
    const beta = this.beta, core = this.core, force = this.force, contact = this.contact
    const dt = this.dt * this.timeScale
    const friction = Math.pow(0.5, dt / this.halfLife)
    for (let i = 0; i < n; i++) {
      let fx = 0
      let fy = 0
      const ki = kind[i] * k
      const xi = x[i], yi = y[i]
      const c9 = cell[i] * 9, cn = nbrN[cell[i]]
      for (let m = 0; m < cn; m++) {
        const c = nbr[c9 + m]
        {
          for (let s = start[c], e = start[c + 1]; s < e; s++) {
            const j = items[s]
            let dx = x[j] - xi
            let dy = y[j] - yi
            if (wrap) {
              if (dx > hw) dx -= width; else if (dx < -hw) dx += width
              if (dy > hh) dy -= height; else if (dy < -hh) dy += height
            }
            const d2 = dx * dx + dy * dy
            if (d2 === 0) continue
            const pair = ki + kind[j]
            const r = radius[pair]
            if (d2 >= r * r) continue
            const dist = Math.sqrt(d2)
            const q = dist / r
            const f = q < beta
              ? core * (q / beta - 1)
              : rules[pair] * (1 - Math.abs(2 * q - 1 - beta) / (1 - beta))
            const scale = f * r * force / dist
            fx += dx * scale
            fy += dy * scale
            if (i < j && q < contact) meet[pairIndex(kind[i], kind[j], k)]++
          }
        }
      }
      vx[i] = vx[i] * friction + fx * dt
      vy[i] = vy[i] * friction + fy * dt
    }
    for (let i = 0; i < n; i++) {
      x[i] += vx[i] * dt
      y[i] += vy[i] * dt
      this._edge(i)
    }
  }

  _edge(i) {
    const { x, y, vx, vy, width, height } = this
    if (this.wrap) {
      if (x[i] < 0 || x[i] >= width) { x[i] = ((x[i] % width) + width) % width; if (x[i] >= width) x[i] = 0 }
      if (y[i] < 0 || y[i] >= height) { y[i] = ((y[i] % height) + height) % height; if (y[i] >= height) y[i] = 0 }
      return
    }
    if (x[i] < 0) { x[i] = -x[i]; vx[i] *= -1 }
    if (x[i] >= width) { x[i] = 2 * width - x[i]; vx[i] *= -1 }
    if (y[i] < 0) { y[i] = -y[i]; vy[i] *= -1 }
    if (y[i] >= height) { y[i] = 2 * height - y[i]; vy[i] *= -1 }
  }

  // ── what the sound listens to ────────────────────────────────────────────
  // Per kind: count, mean squared speed, centre (circular mean on a torus)
  // and spread (rms distance from the centre). Meetings per unordered pair of
  // kinds since the last reset. Clusters: connected runs of crowded cells.

  stats({ reset = true } = {}) {
    const { n, k, x, y, vx, vy, kind, width, height, wrap } = this
    const tau = Math.PI * 2
    const acc = Array.from({ length: k }, () => ({ count: 0, energy: 0, sx: 0, sy: 0, cx: 0, cy: 0, spread: 0 }))
    for (let i = 0; i < n; i++) {
      const s = acc[kind[i]]
      s.count++
      s.energy += vx[i] * vx[i] + vy[i] * vy[i]
      if (wrap) {
        s.sx += Math.cos(x[i] / width * tau); s.cx += Math.sin(x[i] / width * tau)
        s.sy += Math.cos(y[i] / height * tau); s.cy += Math.sin(y[i] / height * tau)
      } else { s.sx += x[i]; s.sy += y[i] }
    }
    for (const s of acc) {
      if (!s.count) continue
      s.energy /= s.count
      if (wrap) {
        s.cx = ((Math.atan2(s.cx, s.sx) / tau + 1) % 1) * width
        s.cy = ((Math.atan2(s.cy, s.sy) / tau + 1) % 1) * height
      } else { s.cx = s.sx / s.count; s.cy = s.sy / s.count }
    }
    for (let i = 0; i < n; i++) {
      const s = acc[kind[i]]
      let dx = x[i] - s.cx, dy = y[i] - s.cy
      if (wrap) {
        if (dx > width / 2) dx -= width; else if (dx < -width / 2) dx += width
        if (dy > height / 2) dy -= height; else if (dy < -height / 2) dy += height
      }
      s.spread += dx * dx + dy * dy
    }
    const kinds = acc.map(s => ({
      count: s.count, energy: s.energy, cx: s.cx, cy: s.cy,
      spread: s.count ? Math.sqrt(s.spread / s.count) : 0,
    }))
    const meet = Array.from(this.meet)
    if (reset) this.meet.fill(0)
    return { steps: this.steps, kinds, meet, clusters: this.clusters() }
  }

  clusters() {
    if (!this._grid) this._buildGrid()
    const { cols, rows, start } = this._grid
    const cells = cols * rows
    const crowded = Math.max(2, 2 * this.n / cells)
    const seen = new Uint8Array(cells)
    const stack = []
    let count = 0
    for (let c = 0; c < cells; c++) {
      if (seen[c] || start[c + 1] - start[c] < crowded) continue
      count++
      seen[c] = 1
      stack.push(c)
      while (stack.length) {
        const d = stack.pop()
        const dx = d % cols, dy = (d / cols) | 0
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          let nx = dx + ox, ny = dy + oy
          if (this.wrap) { nx = (nx + cols) % cols; ny = (ny + rows) % rows }
          else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          const e = nx + ny * cols
          if (!seen[e] && start[e + 1] - start[e] >= crowded) { seen[e] = 1; stack.push(e) }
        }
      }
    }
    return count
  }
}

export function pairIndex(a, b, k) {
  return a <= b ? a * k + b : b * k + a
}

// For every cell, the distinct cells of its 3×3 block, worked out once per
// grid shape so the hot loops carry no edge tests. On a torus narrower than
// three cells the -1 and +1 cells coincide, and each is listed once.
function neighbourTable(cols, rows, wrap) {
  const nbr = new Int32Array(cols * rows * 9)
  const nbrN = new Uint8Array(cols * rows)
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const c = cx + cy * cols, seen = new Set()
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      let rx = cx + ox, ry = cy + oy
      if (rx < 0 || rx >= cols || ry < 0 || ry >= rows) {
        if (!wrap) continue
        rx = (rx + cols) % cols; ry = (ry + rows) % rows
      }
      const e = rx + ry * cols
      if (seen.has(e)) continue
      seen.add(e)
      nbr[c * 9 + nbrN[c]++] = e
    }
  }
  return { nbr, nbrN }
}

// World size for n particles at a steady density. Cost follows density, not
// count: packing the same world twice as full quadruples the neighbour work,
// while a world that grows with n keeps the cost per particle flat.
// The default, 673 square units per particle, is 1,000 particles in 1000×673.
export function worldSize(n, aspect = 0.673, area = 673) {
  const width = Math.sqrt(n * area / aspect)
  return { width: Math.round(width), height: Math.round(width * aspect) }
}

export function createLife(options) {
  return new Life(options)
}
