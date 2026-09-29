// Classic mode: Hunar Ahmad's rule (github.com/hunar4321/particle-life, MIT).
// A constant force g inside the radius, velocity kept by (1 - viscosity),
// soft wall repel, mirror bounce. Importing this module adds it to Life;
// the page background, whose creatures all use cell mode, leaves it out.

import { Life, pairIndex } from './core.js'

const methods = {
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
}

for (const [name, fn] of Object.entries(methods)) {
  Object.defineProperty(Life.prototype, name, { value: fn, writable: true, configurable: true })
}
