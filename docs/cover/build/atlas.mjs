import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { PNG } from 'pngjs'
import opentype from 'opentype.js'
import { ATLAS } from '../atlas-layout.js'

const require = createRequire(import.meta.url)
const FONT_FILE = require.resolve('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff')
const CURVE_STEPS = 8

const font = opentype.parse(readFileSync(FONT_FILE).buffer.slice(0))
const unitsPerEm = font.unitsPerEm

function flatten (path) {
  const segments = []
  let start = null
  let pen = null
  const line = (a, b) => segments.push([a[0], a[1], b[0], b[1]])
  for (const command of path.commands) {
    if (command.type === 'M') {
      start = pen = [command.x, command.y]
    } else if (command.type === 'L') {
      const next = [command.x, command.y]
      line(pen, next)
      pen = next
    } else if (command.type === 'Q') {
      for (let i = 1; i <= CURVE_STEPS; i++) {
        const t = i / CURVE_STEPS
        const u = 1 - t
        const next = [
          u * u * pen[0] + 2 * u * t * command.x1 + t * t * command.x,
          u * u * pen[1] + 2 * u * t * command.y1 + t * t * command.y
        ]
        line(i === 1 ? pen : segments.at(-1).slice(2), next)
      }
      pen = [command.x, command.y]
    } else if (command.type === 'C') {
      for (let i = 1; i <= CURVE_STEPS; i++) {
        const t = i / CURVE_STEPS
        const u = 1 - t
        const next = [
          u * u * u * pen[0] + 3 * u * u * t * command.x1 + 3 * u * t * t * command.x2 + t * t * t * command.x,
          u * u * u * pen[1] + 3 * u * u * t * command.y1 + 3 * u * t * t * command.y2 + t * t * t * command.y
        ]
        line(i === 1 ? pen : segments.at(-1).slice(2), next)
      }
      pen = [command.x, command.y]
    } else if (command.type === 'Z') {
      if (pen && start && (pen[0] !== start[0] || pen[1] !== start[1])) line(pen, start)
      pen = start
    }
  }
  return segments
}

function signedDistance (segments, x, y) {
  let best = Infinity
  let winding = 0
  for (const [ax, ay, bx, by] of segments) {
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy || 1e-9
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq))
    const px = ax + t * dx - x
    const py = ay + t * dy - y
    best = Math.min(best, px * px + py * py)
    if (ay <= y) {
      if (by > y && dx * (y - ay) - dy * (x - ax) > 0) winding++
    } else if (by <= y && dx * (y - ay) - dy * (x - ax) < 0) winding--
  }
  const distance = Math.sqrt(best)
  return winding !== 0 ? distance : -distance
}

const width = ATLAS.columns * ATLAS.cellWidth
const height = ATLAS.rows * ATLAS.cellHeight
const pixels = new Uint8Array(width * height)
const fontUnitsPerTexel = unitsPerEm / ATLAS.texelsPerEm

for (let index = 0; index < ATLAS.glyphCount; index++) {
  const char = String.fromCharCode(ATLAS.firstCode + index)
  const glyph = font.charToGlyph(char)
  const segments = flatten(glyph.getPath(0, 0, unitsPerEm))
  const originX = (index % ATLAS.columns) * ATLAS.cellWidth
  const originY = Math.floor(index / ATLAS.columns) * ATLAS.cellHeight
  for (let ty = 0; ty < ATLAS.cellHeight; ty++) {
    for (let tx = 0; tx < ATLAS.cellWidth; tx++) {
      const emX = (tx + 0.5 - ATLAS.pad) / ATLAS.texelsPerEm
      const emUp = ATLAS.ascentEm - (ty + 0.5 - ATLAS.pad) / ATLAS.texelsPerEm
      const distanceTexels = segments.length
        ? signedDistance(segments, emX * unitsPerEm, -emUp * unitsPerEm) / fontUnitsPerTexel
        : -ATLAS.spread
      const value = 0.5 + 0.5 * Math.max(-1, Math.min(1, distanceTexels / ATLAS.spread))
      pixels[(originY + ty) * width + originX + tx] = Math.round(value * 255)
    }
  }
}

const png = new PNG({ width, height, colorType: 0, inputColorType: 0, bitDepth: 8 })
png.data = Buffer.from(pixels)
writeFileSync(new URL('../atlas.png', import.meta.url), PNG.sync.write(png, { colorType: 0, inputColorType: 0 }))
console.log(`atlas ${width}x${height}, ${ATLAS.glyphCount} glyphs from ${FONT_FILE.split('/').pop()}`)
