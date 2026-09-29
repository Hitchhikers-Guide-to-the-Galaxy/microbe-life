// Reference: Hunar Ahmad's particle_life.html, reduced to its seeding and its
// step so classic mode can be tested against the original. The bodies of
// mulberry32, randomRules, flattenRules, randomX/Y, create and applyRules are
// copied as they stand; drawing, the click pulse and total_v are left out.
//
// Source: https://github.com/hunar4321/particle-life/blob/main/particle_life.html
//
// MIT License — Copyright (c) 2022 Hunar Ahmad
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright
// notice and this permission notice shall be included in all copies or
// substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS",
// WITHOUT WARRANTY OF ANY KIND.

const predefinedColors = ['green', 'red', 'orange', 'cyan', 'magenta', 'lavender', 'teal']

export function hunarWorld({ seed = 91651088029, numColors = 4, count = 500, width = 1000, height = 700 } = {}) {
  const settings = {
    seed, numColors, time_scale: 1.0, viscosity: 0.7, gravity: 0.0, wallRepel: 40,
    colors: [], rules: {}, radii: {}, rulesArray: [], radii2Array: [],
  }
  const canvas = { width, height }
  for (let i = 0; i < settings.numColors; ++i) settings.colors.push(predefinedColors[i])

  var local_seed = settings.seed
  function mulberry32() {
    let t = local_seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296.;
  }
  function flattenRules() {
    settings.rulesArray = []
    settings.radii2Array = []
    for (const c1 of settings.colors) {
      for (const c2 of settings.colors) {
        settings.rulesArray.push(settings.rules[c1][c2])
      }
      settings.radii2Array.push(settings.radii[c1] * settings.radii[c1])
    }
  }
  function randomRules() {
    local_seed = settings.seed;
    for (const i of settings.colors) {
      settings.rules[i] = {};
      for (const j of settings.colors) {
        settings.rules[i][j] = mulberry32() * 2 - 1;
      }
      settings.radii[i] = 80;
    }
    flattenRules()
  }
  function randomX() { return mulberry32() * (canvas.width - 100) + 50; }
  function randomY() { return mulberry32() * (canvas.height - 100) + 50; }
  const atoms = []
  const create = (number, color) => {
    for (let i = 0; i < number; i++) {
      atoms.push([randomX(), randomY(), 0, 0, color])
    }
  };
  randomRules()
  for (let c = 0; c < settings.colors.length; c++) create(count, c)

  const applyRules = () => {
    for (const a of atoms) {
      let fx = 0;
      let fy = 0;
      const idx = a[4] * settings.numColors;
      const r2 = settings.radii2Array[a[4]]
      for (const b of atoms) {
        const g = settings.rulesArray[idx + b[4]];
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        if (dx !== 0 || dy !== 0) {
          const d = dx * dx + dy * dy;
          if (d < r2) {
            const F = g / Math.sqrt(d);
            fx += F * dx;
            fy += F * dy;
          }
        }
      }
      if (settings.wallRepel > 0) {
        const d = settings.wallRepel
        const strength = 0.1
        if (a[0] < d) fx += (d - a[0]) * strength
        if (a[0] > canvas.width - d) fx += (canvas.width - d - a[0]) * strength
        if (a[1] < d) fy += (d - a[1]) * strength
        if (a[1] > canvas.height - d) fy += (canvas.height - d - a[1]) * strength
      }
      fy += settings.gravity;
      const vmix = (1. - settings.viscosity);
      a[2] = a[2] * vmix + fx * settings.time_scale;
      a[3] = a[3] * vmix + fy * settings.time_scale;
    }
    for (const a of atoms) {
      a[0] += a[2]
      a[1] += a[3]
      if (a[0] < 0) { a[0] = -a[0]; a[2] *= -1; }
      if (a[0] >= canvas.width) { a[0] = 2 * canvas.width - a[0]; a[2] *= -1; }
      if (a[1] < 0) { a[1] = -a[1]; a[3] *= -1; }
      if (a[1] >= canvas.height) { a[1] = 2 * canvas.height - a[1]; a[3] *= -1; }
    }
  };
  return { settings, atoms, step: applyRules }
}
