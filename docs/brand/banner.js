import { GRADIENT, KEY, keyGradient, keyPath } from './key.js'

export const BANNER = {
  width: 1200,
  height: 630,
  scale: 2,
  background: '#0f110f',
  text: '#f3f2ec',
  accent: '#3ddc97',
  chip: '#161a17',
  chipBorder: '#2e332f',
  wordmark: { text: 'onesecret', size: 132, tracking: -0.035 },
  tagline: { text: 'Keep just one secret to decrypt the rest.', size: 40 },
  command: { prompt: '$ ', text: 'npm install onesecret', size: 26 },
  keyToXHeight: 1.85,
  gapToKeyWidth: 0.21,
  lockupCenter: 196,
  taglineBaseline: 368,
  chipTop: 426,
  chipPadding: [18, 30]
}

const CORNER_GLOW = [
  [0, 0.32],
  [0.2, 0.22],
  [0.4, 0.12],
  [0.6, 0.05],
  [0.8, 0.012],
  [1, 0]
]

const translate = (x, y) => `translate(${+x.toFixed(2)} ${+y.toFixed(2)})`

const lockup = ({ fonts, textPath }) => {
  const { wordmark } = BANNER
  const word = textPath({ font: fonts.display, ...wordmark })
  const xHeight =
    (fonts.display.tables.os2.sxHeight / fonts.display.unitsPerEm) *
    wordmark.size
  const keyScale = (xHeight * BANNER.keyToXHeight) / KEY.height
  const keyWidth = KEY.width * keyScale
  const gap = keyWidth * BANNER.gapToKeyWidth
  const left = (BANNER.width - (keyWidth + gap + word.width)) / 2
  const baseline = BANNER.lockupCenter + xHeight / 2
  const keyTop = BANNER.lockupCenter - (KEY.height * keyScale) / 2
  const keyTransform = `${translate(left, keyTop)} scale(${+keyScale.toFixed(
    4
  )})`
  return (
    `<g filter="url(#glow)" opacity="0.55"><path fill="${
      GRADIENT.top
    }" transform="${keyTransform}" d="${keyPath()}"/></g>` +
    `<path fill="url(#k)" transform="${keyTransform}" d="${keyPath()}"/>` +
    `<path fill="${BANNER.text}" transform="${translate(
      left + keyWidth + gap,
      baseline
    )}" d="${word.d}"/>`
  )
}

const tagline = ({ fonts, textPath }) => {
  const line = textPath({ font: fonts.body, ...BANNER.tagline })
  return `<path fill="${BANNER.text}" transform="${translate(
    (BANNER.width - line.width) / 2,
    BANNER.taglineBaseline
  )}" d="${line.d}"/>`
}

const command = ({ fonts, textPath }) => {
  const { prompt, text, size } = BANNER.command
  const [padY, padX] = BANNER.chipPadding
  const promptPath = textPath({ font: fonts.mono, text: prompt, size })
  const textRun = textPath({ font: fonts.mono, text, size })
  const width = promptPath.width + textRun.width + padX * 2
  const height = size + padY * 2
  const left = (BANNER.width - width) / 2
  const baseline = BANNER.chipTop + padY + size * 0.78
  return (
    `<rect x="${left}" y="${BANNER.chipTop}" width="${width}" height="${height}" rx="14" fill="${BANNER.chip}" stroke="${BANNER.chipBorder}"/>` +
    `<path fill="${BANNER.accent}" transform="${translate(
      left + padX,
      baseline
    )}" d="${promptPath.d}"/>` +
    `<path fill="${BANNER.text}" transform="${translate(
      left + padX + promptPath.width,
      baseline
    )}" d="${textRun.d}"/>`
  )
}

export const bannerSvg = context =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BANNER.width} ${BANNER.height}" width="${BANNER.width}" height="${BANNER.height}">` +
  '<defs>' +
  keyGradient('k') +
  `<radialGradient id="corner" cx="0" cy="0" r="${
    BANNER.width * 0.62
  }" gradientUnits="userSpaceOnUse">${CORNER_GLOW.map(
    ([offset, opacity]) =>
      `<stop offset="${offset}" stop-color="${GRADIENT.bottom}" stop-opacity="${opacity}"/>`
  ).join('')}</radialGradient>` +
  '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>' +
  '</defs>' +
  `<rect width="${BANNER.width}" height="${BANNER.height}" fill="${BANNER.background}"/>` +
  `<rect width="${BANNER.width}" height="${BANNER.height}" fill="url(#corner)"/>` +
  lockup(context) +
  tagline(context) +
  command(context) +
  '</svg>\n'
