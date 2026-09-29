// Write each curated genome, grown for 900 steps, as cytoscape graph data.
// node bench/cyjs.js <outdir>
import { mkdir, writeFile } from 'node:fs/promises'
import { worldSize } from '../src/core.js'
import { lifeFromGenome } from '../src/genome.js'
import { GENOMES } from '../src/genomes.js'
import { toCytoscape } from '../src/cyjs.js'

const out = process.argv[2] || 'dist/cyjs'
await mkdir(out, { recursive: true })
for (const g of GENOMES) {
  const life = lifeFromGenome(g, { count: Math.round(500 / g.kinds), ...worldSize(500, 240 / 360) })
  for (let i = 0; i < 900; i++) life.step()
  const cy = toCytoscape(life, { name: g.name })
  await writeFile(`${out}/${g.name}.cyjs`, JSON.stringify(cy, null, 1))
  console.log(g.name, cy.elements.nodes.length, 'nodes', cy.elements.edges.length, 'edges')
}
