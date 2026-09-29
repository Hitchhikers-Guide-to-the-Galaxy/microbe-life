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
await writeFile('dist/bg-test.html', await readFile('wrappers/background/test.html'))
const { gzipSync } = await import('node:zlib')
const bgText = await readFile('dist/microbe-bg.min.js')
console.log(`dist/microbe-bg.min.js ${(bgText.length / 1024).toFixed(1)} KB (${(gzipSync(bgText).length / 1024).toFixed(1)} KB gzipped)`)
console.log(`dist/microbe-life-demo.html ${(html.length / 1024).toFixed(1)} KB (script ${(js.length / 1024).toFixed(1)} KB)`)
