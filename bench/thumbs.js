// Looping thumbnails for the curated genomes: a small software rasteriser
// in the same "cell" style as draw2d.js (faint halo + opaque disc over fading
// trails), frames piped to ffmpeg → <name>.mp4 (H.264, loops) + <name>.jpg.
// node bench/thumbs.js <outdir> [name…]
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { worldSize } from '../src/core.js'
import { lifeFromGenome } from '../src/genome.js'
import { GENOMES } from '../src/genomes.js'
import { PALETTE } from '../src/draw2d.js'

const W = 360, H = 240, FPS = 30, SECONDS = 6, SETTLE = 900, STEPS_PER_FRAME = 2
const BG = [6, 8, 11], TRAIL = 0.3, DOT = 1.7, HALO = 5.5, HALO_ALPHA = 0.08

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const COLOURS = PALETTE.map(rgb)

function blendDisc(buf, cx, cy, r, [cr, cg, cb], alpha, soft) {
  const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(W - 1, Math.ceil(cx + r + 1))
  const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(H - 1, Math.ceil(cy + r + 1))
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
    const cover = soft ? Math.max(0, 1 - d / r) : Math.max(0, Math.min(1, r - d + 0.5))
    const a = cover * alpha
    if (a <= 0) continue
    const p = (y * W + x) * 4
    buf[p] += (cr - buf[p]) * a
    buf[p + 1] += (cg - buf[p + 1]) * a
    buf[p + 2] += (cb - buf[p + 2]) * a
  }
}

function paint(buf, life) {
  for (let p = 0; p < buf.length; p += 4) {
    buf[p] += (BG[0] - buf[p]) * TRAIL; buf[p + 1] += (BG[1] - buf[p + 1]) * TRAIL; buf[p + 2] += (BG[2] - buf[p + 2]) * TRAIL
  }
  const sx = W / life.width, sy = H / life.height
  for (let i = 0; i < life.n; i++) blendDisc(buf, life.x[i] * sx, life.y[i] * sy, HALO, COLOURS[life.kind[i] % COLOURS.length], HALO_ALPHA, true)
  for (let i = 0; i < life.n; i++) blendDisc(buf, life.x[i] * sx, life.y[i] * sy, DOT, COLOURS[life.kind[i] % COLOURS.length], 0.92, false)
}

function ffmpeg(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] })
    p.on('close', c => c ? reject(new Error('ffmpeg ' + c)) : resolve())
    if (input) { for (const f of input) p.stdin.write(f); p.stdin.end() }
  })
}

export async function thumb(genome, outdir, { n = 500 } = {}) {
  const life = lifeFromGenome(genome, { count: Math.round(n / genome.kinds), ...worldSize(n, H / W) })
  for (let i = 0; i < SETTLE; i++) life.step()
  const buf = new Float32Array(W * H * 4)
  for (let p = 0; p < buf.length; p += 4) { buf[p] = BG[0]; buf[p + 1] = BG[1]; buf[p + 2] = BG[2]; buf[p + 3] = 255 }
  const frames = []
  for (let f = 0; f < FPS * SECONDS; f++) {
    for (let s = 0; s < STEPS_PER_FRAME; s++) life.step()
    paint(buf, life)
    frames.push(Buffer.from(Uint8ClampedArray.from(buf).buffer))
  }
  const raw = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-']
  await ffmpeg([...raw, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${outdir}/${genome.name}.mp4`], frames)
  await ffmpeg([...raw, '-frames:v', '1', '-q:v', '3', `${outdir}/${genome.name}.jpg`], [frames[frames.length - 1]])
  return life.colonies()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outdir = process.argv[2] || 'dist/thumbs'
  const only = process.argv.slice(3)
  await mkdir(outdir, { recursive: true })
  for (const g of GENOMES.filter(g => !only.length || only.includes(g.name))) {
    const t = Date.now()
    const cols = await thumb(g, outdir)
    console.log(`${g.name}: ${cols.length} colonies, ${((Date.now() - t) / 1000).toFixed(1)} s`)
  }
}
