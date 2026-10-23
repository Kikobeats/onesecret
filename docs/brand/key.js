export const KEY = {
  width: 85,
  height: 48,
  bow: { cx: 24, cy: 24, outer: 24, inner: 11.5 },
  shaft: { left: 37, right: 85, top: 17, bottom: 28.25 },
  teeth: [
    { left: 59.5, right: 69, bottom: 39 },
    { left: 75.5, right: 85, bottom: 35.75 }
  ],
  corner: 1.25
}

export const GRADIENT = { top: '#49f8c3', bottom: '#25da9e' }

export const ICON = {
  size: 64,
  radius: 14,
  keyWidth: 43,
  top: '#17251f',
  bottom: '#060a08',
  edge: '#ffffff'
}

const circle = (cx, cy, r, sweep) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 ${sweep} ${r * 2} 0a${r} ${r} 0 1 ${sweep} ${
    -r * 2
  } 0Z`

const corner = (r, dx, dy) => `a${r} ${r} 0 0 1 ${dx} ${dy}`

const bladePath = ({ shaft, teeth: [inner, tip], corner: r }) =>
  [
    `M${shaft.left} ${shaft.top}`,
    `H${shaft.right - r}`,
    corner(r, r, r),
    `V${tip.bottom - r}`,
    corner(r, -r, r),
    `H${tip.left + r}`,
    corner(r, -r, -r),
    `V${shaft.bottom}`,
    `H${inner.right}`,
    `V${inner.bottom - r}`,
    corner(r, -r, r),
    `H${inner.left + r}`,
    corner(r, -r, -r),
    `V${shaft.bottom}`,
    `H${shaft.left}Z`
  ].join('')

export const keyPath = (key = KEY) => {
  const { cx, cy, outer, inner } = key.bow
  return circle(cx, cy, outer, 1) + circle(cx, cy, inner, 0) + bladePath(key)
}

const gradient = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(
      ([offset, color, opacity = 1]) =>
        `<stop offset="${offset}" stop-color="${color}"${
          opacity < 1 ? ` stop-opacity="${opacity}"` : ''
        }/>`
    )
    .join('')}</linearGradient>`

export const keyGradient = id =>
  gradient(id, 0, 0, KEY.width * 0.35, KEY.height, [
    [0, GRADIENT.top],
    [1, GRADIENT.bottom]
  ])

export const markSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${KEY.width} ${KEY.height}">` +
  `<defs>${keyGradient('k')}</defs>` +
  `<path fill="url(#k)" d="${keyPath()}"/>` +
  '</svg>\n'

export const iconKeyTransform = (icon = ICON) => {
  const scale = icon.keyWidth / KEY.width
  const x = (icon.size - icon.keyWidth) / 2
  const y = (icon.size - KEY.height * scale) / 2
  return `translate(${x} ${+y.toFixed(3)}) scale(${+scale.toFixed(5)})`
}

export const iconSvg = (icon = ICON) => {
  const { size, radius } = icon
  const transform = iconKeyTransform(icon)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
    '<defs>' +
    gradient('t', 0, 0, 0, size, [
      [0, icon.top],
      [1, icon.bottom]
    ]) +
    gradient('e', 0, 0, 0, size * 0.3, [
      [0, icon.edge, 0.14],
      [1, icon.edge, 0]
    ]) +
    keyGradient('k') +
    '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>' +
    '</defs>' +
    `<rect width="${size}" height="${size}" rx="${radius}" fill="url(#t)"/>` +
    `<rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${
      radius - 0.5
    }" fill="none" stroke="url(#e)"/>` +
    `<path fill="${
      GRADIENT.top
    }" opacity="0.35" filter="url(#glow)" transform="${transform}" d="${keyPath()}"/>` +
    `<path fill="url(#k)" transform="${transform}" d="${keyPath()}"/>` +
    '</svg>\n'
  )
}
