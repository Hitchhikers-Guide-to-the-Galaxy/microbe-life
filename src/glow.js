// The 'glow' drawing style: additive soft dots, the look of the Phase 0
// demo. Importing this module makes Painter's blend: 'glow' available.

import { SPRITES, surface } from './draw2d.js'

SPRITES.glow = function glowSprite(colour, radius) {
  const size = Math.ceil(radius * 4), c = surface(size), g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, colour)
  grad.addColorStop(0.25, colour)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.globalAlpha = 0.9
  g.fillRect(0, 0, size, size)
  c.half = size / 2
  return c
}
