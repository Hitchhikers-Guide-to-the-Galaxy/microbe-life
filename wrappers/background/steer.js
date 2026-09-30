// Steering for the page background, loaded only when a Sound Site scene
// holds a Microbe Life voice. The loudest such voice's live, morphing
// parameters choose the creature's genome and shape it, and its root turns
// the colours. When the scene has none, the page's own creature comes back.

import { DEFAULTS, genomeFor, applyParams, paletteFor, hueFor } from '../../src/map.js'

export function steerer(site, bg) {
  let active = null, hue = null
  return {
    get active() { return active },
    steer() {
      const voices = (site.player?.tracks || []).flatMap(t => t.voices || [])
      const v = voices.filter(x => x.key === 'microbe-life' && x.out?.gain?.value > 0.3)
        .sort((a, b) => b.out.gain.value - a.out.gain.value)[0]
      if (!v) {
        if (active) { active = null; hue = null; bg.painter.palette = null; bg.painter.resize(); bg.follow() }
        return
      }
      const params = { ...DEFAULTS, ...v.params }
      const g = genomeFor(params)
      if (bg.life.genomeName !== g.name) bg.show(g, bg.fade)
      applyParams(bg.life, params, bg.life.base)
      const h = Math.round(hueFor(params.root))
      if (h !== hue) { hue = h; bg.painter.palette = paletteFor(bg.life.k, h); bg.painter.resize() }
      active = g.name
    },
  }
}
