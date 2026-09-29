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
console.log(`dist/microbe-life-demo.html ${(html.length / 1024).toFixed(1)} KB (script ${(js.length / 1024).toFixed(1)} KB)`)
