// Colonies and stats: what the sound and the tools read from a world.
// Importing this module adds life.stats(), life.colonies() and
// life.clusters() to Life; a page background that only draws leaves it out.

import { Life } from './core.js'

const methods = {
  // ── what the sound listens to ────────────────────────────────────────────
  // Per kind: count, mean squared speed, centre (circular mean on a torus)
  // and spread (rms distance from the centre). Meetings per unordered pair of
  // kinds since the last reset. Colonies: see colonies().

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
    const colonies = this.colonies()
    return { steps: this.steps, kinds, meet, clusters: colonies.length, colonies }
  },

  // Colonies: particles closer than link × their pair radius belong together
  // (union-find over the grid). Returns the colonies of at least minSize
  // particles, largest first, each with its centre, rms radius, members per
  // kind, elongation (1 = round, high = a chain) and layering (how far apart
  // the kinds sit from the centre, relative to the radius: a membrane).
  // this.labels keeps each particle's colony root for tracking splits.

  colonies({ link = 0.45, minSize = 3 } = {}) {
    this._buildGrid()
    const { n, k, x, y, kind, radius, width, height, wrap } = this
    const { start, items, cell, nbr, nbrN } = this._grid
    const hw = width / 2, hh = height / 2
    const parent = this.labels && this.labels.length === n ? this.labels : (this.labels = new Int32Array(n))
    for (let i = 0; i < n; i++) parent[i] = i
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
    for (let i = 0; i < n; i++) {
      const ki = kind[i] * k, c9 = cell[i] * 9, cn = nbrN[cell[i]]
      for (let m = 0; m < cn; m++) {
        const c = nbr[c9 + m]
        for (let s = start[c], e = start[c + 1]; s < e; s++) {
          const j = items[s]
          if (j <= i) continue
          let dx = x[j] - x[i], dy = y[j] - y[i]
          if (wrap) {
            if (dx > hw) dx -= width; else if (dx < -hw) dx += width
            if (dy > hh) dy -= height; else if (dy < -hh) dy += height
          }
          const l = link * radius[ki + kind[j]]
          if (dx * dx + dy * dy < l * l) {
            const a = find(i), b = find(j)
            if (a !== b) parent[a < b ? b : a] = a < b ? a : b
          }
        }
      }
    }
    // gather members relative to each root (unwrapped on the torus)
    const groups = new Map()
    for (let i = 0; i < n; i++) {
      const r = find(i)
      parent[i] = r
      let g = groups.get(r)
      if (!g) groups.set(r, g = { members: [], ox: x[r], oy: y[r] })
      g.members.push(i)
    }
    const out = []
    for (const [root, g] of groups) {
      const size = g.members.length
      if (size < minSize) continue
      const dxs = new Float64Array(size), dys = new Float64Array(size)
      let mx = 0, my = 0
      g.members.forEach((i, m) => {
        let dx = x[i] - g.ox, dy = y[i] - g.oy
        if (wrap) {
          if (dx > hw) dx -= width; else if (dx < -hw) dx += width
          if (dy > hh) dy -= height; else if (dy < -hh) dy += height
        }
        dxs[m] = dx; dys[m] = dy; mx += dx; my += dy
      })
      mx /= size; my /= size
      let sxx = 0, syy = 0, sxy = 0
      const kinds = new Array(k).fill(0), dist = new Array(k).fill(0)
      g.members.forEach((i, m) => {
        const ex = dxs[m] - mx, ey = dys[m] - my
        sxx += ex * ex; syy += ey * ey; sxy += ex * ey
        kinds[kind[i]]++
        dist[kind[i]] += Math.sqrt(ex * ex + ey * ey)
      })
      sxx /= size; syy /= size; sxy /= size
      const tr = sxx + syy, det = sxx * syy - sxy * sxy
      const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det))
      const l1 = tr / 2 + disc, l2 = Math.max(tr / 2 - disc, 1e-6)
      const rms = Math.sqrt(tr)
      let lo = Infinity, hi = -Infinity
      for (let c = 0; c < k; c++) if (kinds[c] >= 2) {
        const d = dist[c] / kinds[c]
        if (d < lo) lo = d
        if (d > hi) hi = d
      }
      let cx = g.ox + mx, cy = g.oy + my
      if (wrap) { cx = ((cx % width) + width) % width; cy = ((cy % height) + height) % height }
      out.push({
        id: root, size, cx, cy, radius: rms, kinds,
        elongation: Math.sqrt(l1 / l2),
        layering: hi > lo && rms > 0 ? (hi - lo) / rms : 0,
      })
    }
    return out.sort((a, b) => b.size - a.size)
  },

  clusters(options) {
    return this.colonies(options).length
  }
}

// class-style methods, installed once
for (const [name, fn] of Object.entries(methods)) {
  Object.defineProperty(Life.prototype, name, { value: fn, writable: true, configurable: true })
}
