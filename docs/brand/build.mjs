import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'
import { BANNER, bannerSvg } from './banner.js'
import { deploySvg } from './deploy.js'
import { iconSvg, markSvg } from './key.js'

const require = createRequire(import.meta.url)
const STATIC = new URL('../../static/', import.meta.url)
const INDEX = new URL('../../index.html', import.meta.url)
const BANNER_URL = /static\/banner\.jpg(\?v=[0-9a-f]+)?"/g
const ICON_SIZES = { 'logo.png': 512, 'favicon-32x32.png': 32 }

const font = (pkg, file) => {
  const { buffer, byteOffset, byteLength } = readFileSync(require.resolve(`@fontsource/${pkg}/files/${file}`))
  return opentype.parse(buffer.slice(byteOffset, byteOffset + byteLength))
}

const FONTS = {
  display: font('space-grotesk', 'space-grotesk-latin-700-normal.woff'),
  body: font('ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff'),
  mono: font('jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff')
}

const POINTS = { M: ['x', 'y'], L: ['x', 'y'], Q: ['x1', 'y1', 'x', 'y'], C: ['x1', 'y1', 'x2', 'y2', 'x', 'y'], Z: [] }

const pathData = commands =>
  commands.map(command => command.type + POINTS[command.type].map(axis => +command[axis].toFixed(2)).join(' ')).join('')

const textPath = ({ font, text, size, tracking = 0 }) => {
  const scale = size / font.unitsPerEm
  const glyphs = font.stringToGlyphs(text)
  let x = 0
  const parts = glyphs.map((glyph, index) => {
    const d = pathData(glyph.getPath(x, 0, size).commands)
    const next = glyphs[index + 1]
    const kerning = next ? font.getKerningValue(glyph, next) : 0
    x += (glyph.advanceWidth + kerning) * scale + (next ? tracking * size : 0)
    return d
  })
  return { d: parts.join(''), width: x }
}

const write = (name, contents) => {
  writeFileSync(new URL(name, STATIC), contents)
  console.log(`static/${name}`)
}

const icon = iconSvg()
write('mark.svg', markSvg())
write('deploy.svg', deploySvg())
write('logo.svg', icon)

for (const [name, size] of Object.entries(ICON_SIZES)) {
  await sharp(Buffer.from(icon), { density: (72 * size) / 64 }).resize(size, size).png().toFile(fileURLToPath(new URL(name, STATIC)))
  console.log(`static/${name}`)
}

const DITHER_SEED = 0x6f6e65

const seededRandom = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const dither = pixels => {
  const random = seededRandom(DITHER_SEED)
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = Math.min(255, Math.max(0, pixels[i] + Math.round(random() + random() - 1)))
  }
  return pixels
}

const banner = bannerSvg({ fonts: FONTS, textPath })
const { data, info } = await sharp(Buffer.from(banner), { density: 72 * BANNER.scale })
  .resize(BANNER.width * BANNER.scale, BANNER.height * BANNER.scale)
  .flatten({ background: BANNER.background })
  .raw()
  .toBuffer({ resolveWithObject: true })
await sharp(dither(data), { raw: info })
  .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
  .toFile(fileURLToPath(new URL('banner.jpg', STATIC)))
console.log('static/banner.jpg')

const version = createHash('sha256').update(readFileSync(new URL('banner.jpg', STATIC))).digest('hex').slice(0, 8)
writeFileSync(INDEX, readFileSync(INDEX, 'utf8').replace(BANNER_URL, `static/banner.jpg?v=${version}"`))
console.log(`index.html og:image ?v=${version}`)
