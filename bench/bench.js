// Step cost per mode and particle count, after the world has settled.
// ms is wall time; cpuMs is this process's CPU time, steadier on a busy machine.
// node bench/bench.js [--json]
import { Life } from '../src/core.js'

const cases = [
  { mode: 'classic', n: 1000 }, { mode: 'cell', n: 400 }, { mode: 'cell', n: 1000 },
  { mode: 'cell', n: 2000 }, { mode: 'classic', n: 2000 },
]

export function bench({ mode, n, kinds = 4, width = 1000, height = 1000, radius, settle = 300, frames = 300, seed = 'moss_ember' }) {
  const life = new Life({ mode, kinds, count: Math.round(n / kinds), width, height, radius, seed })
  radius = life.radius[0]
  for (let i = 0; i < settle; i++) life.step()
  let pairs = 0
  const t = performance.now(), cpu0 = process.cpuUsage()
  for (let i = 0; i < frames; i++) life.step()
  const ms = (performance.now() - t) / frames
  const cpu = process.cpuUsage(cpu0).user / 1000 / frames
  // neighbours within the radius, a measure of how clumped the world is
  const r2 = radius * radius
  for (let i = 0; i < life.n; i++) for (let j = 0; j < life.n; j++) {
    let dx = life.x[i] - life.x[j], dy = life.y[i] - life.y[j]
    if (life.wrap) {
      if (dx > width / 2) dx -= width; else if (dx < -width / 2) dx += width
      if (dy > height / 2) dy -= height; else if (dy < -height / 2) dy += height
    }
    if (i !== j && dx * dx + dy * dy < r2) pairs++
  }
  return { mode, n: life.n, ms: +ms.toFixed(3), cpuMs: +cpu.toFixed(3), neighbours: +(pairs / life.n).toFixed(1), clusters: life.clusters() }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = cases.map(c => bench(c))
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
  else console.table(rows)
}
