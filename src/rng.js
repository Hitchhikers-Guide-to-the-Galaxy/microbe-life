// Seeded random numbers.
//
// A numeric seed drives Hunar Ahmad's mulberry32 exactly as particle_life.html
// does (the state is a plain Number, so seeds above 2^32 such as his default
// 91651088029 behave the same), which lets classic mode reproduce his worlds.
// A word seed is hashed to 32 bits first.

export function mulberry32(seed) {
  let s = seed
  return function next() {
    let t = s += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296.
  }
}

// FNV-1a over UTF-16 code units → uint32
export function hash32(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function seedNumber(seed) {
  if (typeof seed === 'number' && isFinite(seed)) return seed
  const text = String(seed ?? '').trim()
  if (/^\d+$/.test(text)) return Number(text)
  return hash32(text)
}

export function makeRng(seed) {
  return mulberry32(seedNumber(seed))
}
