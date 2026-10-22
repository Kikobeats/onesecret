import { encodeLines } from './content.js'
import { ATLAS } from './atlas-layout.js'

const MOBILE_BREAKPOINT = 760
const DESKTOP_RIGHT_MARGIN = 56
const DESKTOP_TEXT_GAP = 30
const DESKTOP_WORDMARK_GAP = 24
const DESKTOP_WANDER_X = 12
const DESKTOP_TOP_MARGIN = 52
const DESKTOP_BOW_HEIGHT_RATIO = 0.53
const DESKTOP_FAN_END_MARGIN = 80
const DESKTOP_SCALE_MAX = 16
const DESKTOP_ANGLE = -0.54
const MOBILE_ANGLE = -0.34
const MOBILE_FAN_END_GAP = 12
const ANGLE_SWAY = 0.035
const MOBILE_GUTTER = 16
const MOBILE_SCALE_MAX = 8
const MOBILE_STATUS_RESERVE = 56
const DRIFT_PX_PER_SECOND = 7

const KEY_CENTER = [34.3, 33.0]
const BOW = { center: [14.0, 32.0], radius: 9.4 }
const KEY_CORNERS = [
  [19.6, 28.2],
  [64.0, 28.2],
  [64.0, 35.8],
  [19.6, 35.8],
  [47.5, 43.4],
  [52.3, 43.4],
  [56.3, 41.4],
  [61.0, 41.4]
]
const BOW_SAMPLES = 48

export const INTRO = Object.freeze({
  appear: 0.6,
  glide: 2.6,
  decodeStart: 0.45,
  decode: 1.9,
  beamStart: 0.25,
  beam: 1.6
})
export const TABLE = Object.freeze({
  firstSwap: 8,
  period: 6.5,
  decode: 1.3,
  encode: 0.6
})
export const TABLE_ROWS = Object.freeze({ desktop: 3, mobile: 2 })
export const BEST_FRAME_SECONDS = 4.2

const clamp01 = value => Math.min(1, Math.max(0, value))
const easeOutCubic = t => 1 - Math.pow(1 - t, 3)
const easeInOutCubic = t =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

function keyOutline () {
  const bow = Array.from({ length: BOW_SAMPLES }, (_, i) => {
    const a = (i / BOW_SAMPLES) * Math.PI * 2
    return [
      BOW.center[0] + BOW.radius * Math.cos(a),
      BOW.center[1] + BOW.radius * Math.sin(a)
    ]
  })
  return [...bow, ...KEY_CORNERS].map(([x, y]) => [
    x - KEY_CENTER[0],
    y - KEY_CENTER[1]
  ])
}

const KEY_OUTLINE = keyOutline()

export function keyBounds (angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const box = {
    left: Infinity,
    right: -Infinity,
    top: Infinity,
    bottom: -Infinity
  }
  for (const [x, y] of KEY_OUTLINE) {
    const rx = c * x - s * y
    const ry = s * x + c * y
    box.left = Math.min(box.left, rx)
    box.right = Math.max(box.right, rx)
    box.top = Math.min(box.top, ry)
    box.bottom = Math.max(box.bottom, ry)
  }
  return box
}

function swayBounds (angle) {
  const boxes = [angle - ANGLE_SWAY, angle, angle + ANGLE_SWAY].map(keyBounds)
  return {
    left: Math.min(...boxes.map(b => b.left)),
    right: Math.max(...boxes.map(b => b.right)),
    top: Math.min(...boxes.map(b => b.top)),
    bottom: Math.max(...boxes.map(b => b.bottom))
  }
}

function mobileLayout (width, height, textBox) {
  const top = textBox ? textBox.bottom : height * 0.45
  const units = swayBounds(MOBILE_ANGLE)
  const scale = Math.min(
    (width - 2 * MOBILE_GUTTER) / (units.right - units.left),
    MOBILE_SCALE_MAX
  )
  const keyWidth = (units.right - units.left) * scale
  const keyHeight = (units.bottom - units.top) * scale
  const floor = height - MOBILE_STATUS_RESERVE
  const boxTop = Math.min(
    top + Math.max(24, (floor - top - keyHeight) * 0.5),
    floor - keyHeight - 12
  )
  const centerY = boxTop - units.top * scale
  const centerX = (width - keyWidth) / 2 - units.left * scale
  const wanderX = Math.max(0, (width - keyWidth) / 2 - MOBILE_GUTTER) * 0.6
  return {
    mobile: true,
    angle: MOBILE_ANGLE,
    rows: TABLE_ROWS.mobile,
    fontSize: 11,
    scrim: [0, top],
    copy: [width, top],
    home: [centerX, centerY],
    wander: [wanderX, 6],
    entry: [width * 0.18, 18],
    bounds: [centerX - wanderX, centerY - 6, centerX + wanderX, centerY + 6],
    scale,
    keySize: [keyWidth, keyHeight],
    fanEnd: floor - MOBILE_FAN_END_GAP
  }
}

function bowOffset (angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const x = BOW.center[0] - KEY_CENTER[0]
  const y = BOW.center[1] - KEY_CENTER[1]
  return [c * x - s * y, s * x + c * y]
}

function outlineClearsWordmark (angle, scale, homeX, homeY, wordmark) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return KEY_OUTLINE.every(([x, y]) => {
    const px = homeX + (c * x - s * y) * scale
    const py = homeY + (s * x + c * y) * scale
    return (
      py > wordmark.bottom + DESKTOP_WORDMARK_GAP ||
      px > wordmark.right + DESKTOP_WORDMARK_GAP
    )
  })
}

function desktopLayout (width, height, textBox) {
  const textRight = textBox ? textBox.right : width * 0.42
  const bodyRight = textBox?.bodyRight ?? textRight
  const textBottom = textBox ? textBox.bottom : height * 0.72
  const wordmark = {
    right: textRight,
    bottom: textBox?.wordmarkBottom ?? height * 0.38
  }
  const units = swayBounds(DESKTOP_ANGLE)
  const bow = bowOffset(DESKTOP_ANGLE)
  const sceneLeft = bodyRight + DESKTOP_TEXT_GAP + DESKTOP_WANDER_X
  const sceneRight = width - DESKTOP_RIGHT_MARGIN - DESKTOP_WANDER_X
  const bowY = height * DESKTOP_BOW_HEIGHT_RATIO
  const widthScale = (sceneRight - sceneLeft) / (units.right - units.left)
  const heightScale = (bowY - DESKTOP_TOP_MARGIN) / (bow[1] - units.top)
  const scale = Math.max(
    6,
    Math.min(DESKTOP_SCALE_MAX, widthScale, heightScale)
  )
  let homeX = sceneRight - units.right * scale
  const homeY = bowY - bow[1] * scale
  const leftmost = sceneLeft - units.left * scale
  homeX = Math.max(
    leftmost,
    Math.min(
      homeX,
      leftmost +
        Math.max(
          0,
          sceneRight - sceneLeft - (units.right - units.left) * scale
        ) *
          0.5
    )
  )
  while (
    !outlineClearsWordmark(DESKTOP_ANGLE, scale, homeX, homeY, wordmark) &&
    homeX < sceneRight
  ) { homeX += 4 }
  const wander = [DESKTOP_WANDER_X, Math.min(14, height * 0.016)]
  return {
    mobile: false,
    angle: DESKTOP_ANGLE,
    rows: TABLE_ROWS.desktop,
    fontSize: width > 1800 ? 14 : 13,
    scrim: [bodyRight, 0],
    copy: [bodyRight, textBottom],
    home: [homeX, homeY],
    wander,
    entry: [Math.min(260, width - homeX), 34],
    bounds: [
      homeX - wander[0],
      homeY - wander[1],
      homeX + wander[0],
      homeY + wander[1]
    ],
    scale,
    keySize: [
      (units.right - units.left) * scale,
      (units.bottom - units.top) * scale
    ],
    fanEnd: height - DESKTOP_FAN_END_MARGIN
  }
}

export function layoutFor (width, height, textBox) {
  return width < MOBILE_BREAKPOINT
    ? mobileLayout(width, height, textBox)
    : desktopLayout(width, height, textBox)
}

export function introState (seconds) {
  return {
    appear: easeOutCubic(clamp01(seconds / INTRO.appear)),
    glide: easeInOutCubic(clamp01(seconds / INTRO.glide)),
    decode: easeInOutCubic(
      clamp01((seconds - INTRO.decodeStart) / INTRO.decode)
    ),
    beam: easeOutCubic(clamp01((seconds - INTRO.beamStart) / INTRO.beam))
  }
}

function encodeOut (phase, length) {
  return (
    1 -
    easeInOutCubic(
      clamp01(phase / TABLE.encode - (length - TABLE.encode) / TABLE.encode)
    )
  )
}

export function tableState (seconds) {
  if (seconds < TABLE.firstSwap) {
    return {
      cycle: 0,
      front: Math.min(
        introState(seconds).decode,
        encodeOut(seconds, TABLE.firstSwap)
      )
    }
  }
  const since = seconds - TABLE.firstSwap
  const cycle = 1 + Math.floor(since / TABLE.period)
  const phase = since - (cycle - 1) * TABLE.period
  const front = Math.min(
    easeInOutCubic(clamp01(phase / TABLE.decode)),
    encodeOut(phase, TABLE.period)
  )
  return { cycle, front }
}

export function autopilot (seconds, layout) {
  const [hx, hy] = layout.home
  const [wx, wy] = layout.wander
  const [ex, ey] = layout.entry
  const away = 1 - introState(seconds).glide
  return {
    x:
      hx +
      wx *
        (0.72 * Math.sin(seconds * 0.16 - 0.5) +
          0.28 * Math.sin(seconds * 0.37 + 1.3)) +
      ex * away,
    y: hy + wy * Math.sin(seconds * 0.21 + 0.7) + ey * away,
    angle:
      layout.angle + ANGLE_SWAY * Math.sin(seconds * 0.13 + 0.4) - 0.05 * away
  }
}

export function driftAt (seconds) {
  return seconds * DRIFT_PX_PER_SECOND
}

export function sceneParams ({
  width,
  height,
  dpr,
  seconds,
  theme,
  layout,
  lens
}) {
  const intro = introState(seconds)
  const table = tableState(seconds)
  return {
    resolution: [Math.round(width * dpr), Math.round(height * dpr)],
    dpr,
    time: seconds,
    lens: [lens.x, lens.y, layout.scale, lens.angle],
    theme,
    fontSize: layout.fontSize,
    scrim: layout.scrim,
    reveal: intro.appear,
    drift: driftAt(seconds),
    beam: intro.beam,
    rows: layout.rows,
    table: [table.cycle, table.front],
    copy: layout.copy,
    fanEnd: layout.fanEnd
  }
}

function uploadR8 (gpu, texture, format, data, width, height) {
  const handle = texture(gpu, {
    kind: '2d',
    size: [width, height],
    format,
    usage: ['texture_binding', 'copy_dst'],
    label: `lens-${format}`
  })
  gpu.device.gpu.queue.writeTexture(
    { texture: handle.gpu },
    data,
    { bytesPerRow: width },
    [width, height]
  )
  return handle
}

export function createLensEffect (
  api,
  gpu,
  shader,
  atlasPixels,
  initialParams
) {
  const atlasWidth = ATLAS.columns * ATLAS.cellWidth
  const atlasHeight = ATLAS.rows * ATLAS.cellHeight
  const atlas = uploadR8(
    gpu,
    api.texture,
    'r8unorm',
    atlasPixels,
    atlasWidth,
    atlasHeight
  )
  const encoded = encodeLines()
  const lines = uploadR8(
    gpu,
    api.texture,
    'r8uint',
    encoded.data,
    encoded.width,
    encoded.height
  )
  const atlasSampler = api.sampler(gpu, {
    minFilter: 'linear',
    magFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge'
  })
  return api.effect(gpu, shader, {
    label: 'decrypt-lens',
    set: { params: initialParams, atlas, atlasSampler, lines }
  })
}
