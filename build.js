// Build single-file outputs into dist/.
//   dist/microbe-life-demo.html  the Phase 0 demo, script inlined
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

await mkdir('dist', { recursive: true })
const out = await build({
  entryPoints: ['demo/demo.js'], bundle: true, minify: true, format: 'esm',
  write: false, legalComments: 'none', target: 'es2020',
})
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const html = (await readFile('demo/index.html', 'utf8')).replace('/*DEMO*/', () => js)
await writeFile('dist/microbe-life-demo.html', html)
const bg = await build({
  entryPoints: ['wrappers/background/bg.js'], bundle: true, minify: true, format: 'iife',
  outfile: 'dist/microbe-bg.min.js', legalComments: 'none', target: 'es2020',
  banner: { js: '/* microbe-life background · MIT · David Bovill; particle life after Hunar Ahmad (MIT) */' },
})
await build({ entryPoints: ['wrappers/background/steer.js'], bundle: true, minify: true, format: 'esm', outfile: 'dist/microbe-steer.js', legalComments: 'none', target: 'es2020' })
await writeFile('dist/bg-test.html', await readFile('wrappers/background/test.html'))
const { gzipSync } = await import('node:zlib')
const bgText = await readFile('dist/microbe-bg.min.js')
console.log(`dist/microbe-bg.min.js ${(bgText.length / 1024).toFixed(1)} KB (${(gzipSync(bgText).length / 1024).toFixed(1)} KB gzipped) + microbe-steer.js ${((await readFile('dist/microbe-steer.js')).length / 1024).toFixed(1)} KB on demand`)
console.log(`dist/microbe-life-demo.html ${(html.length / 1024).toFixed(1)} KB (script ${(js.length / 1024).toFixed(1)} KB)`)

// The Aether node: dsp.js (worklet), ui.html (panel, script inlined) and
// manifest.json (parameters from src/map.js), unpacked in dist/node/
// microbe-life/ and zipped as dist/microbe-life.aethernode.
const { PARAMS } = await import('./src/map.js')
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const nodeDir = 'dist/node/microbe-life'
await mkdir(nodeDir, { recursive: true })
const dsp = await build({ entryPoints: ['wrappers/node/dsp.js'], bundle: true, minify: true, format: 'iife', write: false, legalComments: 'none', target: 'es2020',
  banner: { js: '/* Microbe Life · Aether node · MIT · David Bovill; particle life after Hunar Ahmad (MIT) */' } })
await writeFile(`${nodeDir}/dsp.js`, dsp.outputFiles[0].text)
const ui = await build({ entryPoints: ['wrappers/node/ui.js'], bundle: true, minify: true, format: 'iife', write: false, legalComments: 'none', target: 'es2020' })
const uiHtml = (await readFile('wrappers/node/ui.html', 'utf8')).replace('/*UI*/', () => ui.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'))
await writeFile(`${nodeDir}/ui.html`, uiHtml)
const manifest = {
  id: 'com.aether.node.microbelife', name: 'Microbe Life', version: pkg.version,
  author: 'David Bovill (particle life after Hunar Ahmad)',
  description: 'A small creature of particle life, and the sound it makes: each kind a voice, meetings between kinds ring grains, a colony that divides rings a bell. The sliders are musical and change the creature too.',
  category: 'Generator / Generative', inputs: 0, outputs: 2,
  entry: { dsp: 'dsp.js', ui: 'ui.html' },
  canvas_animation: { type: 'particle-life', settings: { genome: 'amoeba' } },
  parameters: PARAMS.map(({ id, name, type, min, max, default: d, unit, step }) => ({ id, name, type, min, max, default: d, ...(unit ? { unit } : {}), ...(step ? { step } : {}) })),
}
await writeFile(`${nodeDir}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n')
const { execFileSync } = await import('node:child_process')
const { rm } = await import('node:fs/promises')
await rm('dist/microbe-life.aethernode', { force: true })
execFileSync('zip', ['-X', '-j', '-q', 'dist/microbe-life.aethernode', `${nodeDir}/manifest.json`, `${nodeDir}/dsp.js`, `${nodeDir}/ui.html`])
const zipSize = (await readFile('dist/microbe-life.aethernode')).length
console.log(`dist/microbe-life.aethernode ${(zipSize / 1024).toFixed(1)} KB (dsp ${(dsp.outputFiles[0].text.length / 1024).toFixed(1)} KB, ui ${(uiHtml.length / 1024).toFixed(1)} KB)`)
