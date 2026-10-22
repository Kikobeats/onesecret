import { lensShader } from './shaders.js'
import {
  BEST_FRAME_SECONDS,
  INTRO,
  autopilot,
  createLensEffect,
  layoutFor,
  sceneParams
} from './scene.js'

const VGPU_URL = 'https://cdn.jsdelivr.net/npm/vgpu@0.6.0/+esm'
const DPR_RANGE = [1, 2]
const POINTER_IDLE_SECONDS = 2.8
const FOLLOW_STIFFNESS = 3.2
const THEME_SECONDS = 0.45
const MAX_STEP_SECONDS = 0.05

const cover = document.querySelector('[data-cover]')
const canvas = cover.querySelector('canvas')
const textBlock = cover.querySelector('[data-cover-text]')
const MAX_TILT = 0.05

setupTabs()
start().catch(error =>
  showFallback(`init-failed: ${error?.code ?? error?.message ?? error}`)
)

function showFallback (reason) {
  cover.dataset.mode = 'fallback'
  cover.dataset.reason = reason
}

function wantsFallback () {
  if (new URLSearchParams(window.location.search).has('fallback')) {
    return 'forced'
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'reduced-motion'
  }
  if (!('gpu' in navigator)) return 'no-webgpu'
  return null
}

function readTheme () {
  const forced = document.documentElement.dataset.theme
  if (forced === 'light') return 1
  if (forced === 'dark') return 0
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 1 : 0
}

function contentRight (element) {
  const range = document.createRange()
  range.selectNodeContents(element)
  return range.getBoundingClientRect().right
}

function textBoxFor (rect) {
  const boxes = [textBlock, ...textBlock.children].map(element =>
    element.getBoundingClientRect()
  )
  const right = Math.max(...boxes.map(box => box.right))
  const top = Math.min(...boxes.map(box => box.top))
  const bottom = Math.max(...boxes.map(box => box.bottom))
  const [wordmark, ...body] = [...textBlock.children]
  const bodyRight = body.length ? Math.max(...body.map(contentRight)) : right
  return {
    right: right - rect.left,
    top: top - rect.top,
    bottom: bottom - rect.top,
    bodyRight: bodyRight - rect.left,
    wordmarkBottom:
      (wordmark?.getBoundingClientRect().bottom ?? bottom) - rect.top
  }
}

async function loadAtlas () {
  const response = await fetch(new URL('./atlas.png', import.meta.url))
  const bitmap = await window.createImageBitmap(await response.blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none'
  })
  const scratch = new window.OffscreenCanvas(bitmap.width, bitmap.height)
  const context = scratch.getContext('2d', { willReadFrequently: true })
  context.drawImage(bitmap, 0, 0)
  const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data
  const red = new Uint8Array(bitmap.width * bitmap.height)
  for (let i = 0; i < red.length; i++) red[i] = rgba[i * 4]
  return red
}

async function start () {
  const reason = wantsFallback()
  if (reason) return showFallback(reason)

  const [vgpu, atlasPixels] = await Promise.all([import(VGPU_URL), loadAtlas()])
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return showFallback('no-adapter')
  const timing =
    new URLSearchParams(window.location.search).has('timing') &&
    adapter.features.has('timestamp-query')
  const gpu = await vgpu.init(
    timing ? { requiredFeatures: ['timestamp-query'] } : undefined
  )
  gpu.onError?.(error => showFallback(`gpu-error: ${error?.code ?? error}`))

  const canvasSurface = vgpu.surface(gpu, canvas, { dpr: DPR_RANGE })
  const state = createState()
  const fx = createLensEffect(
    vgpu,
    gpu,
    lensShader,
    atlasPixels,
    paramsFor(state, canvasSurface)
  )
  const gpuTimer = timing ? vgpu.timer(gpu) : undefined
  if (gpuTimer) exposeTimings(gpuTimer)

  canvasSurface.onResize(() => {
    state.layout = null
  })
  document.fonts?.ready.then(() => {
    state.layout = null
  })
  bindInput(state)

  let loop = null
  let last = 0
  let firstFrame = true
  const tick = frame => {
    const now = performance.now() / 1000
    const step = last ? Math.min(MAX_STEP_SECONDS, now - last) : 0
    last = now
    advance(state, step)
    fx.set({ params: paramsFor(state, canvasSurface) })
    frame.pass(
      gpuTimer
        ? { target: canvasSurface, timer: gpuTimer.span('lens') }
        : canvasSurface,
      fx
    )
    if (firstFrame) {
      firstFrame = false
      window.requestAnimationFrame(() => (cover.dataset.mode = 'live'))
    }
  }

  let onScreen = true
  const sync = () => {
    const run = onScreen && document.visibilityState === 'visible'
    if (run && !loop) {
      last = 0
      loop = vgpu.frameLoop(gpu, tick)
    } else if (!run && loop) {
      loop.stop()
      loop = null
    }
    cover.dataset.running = String(Boolean(loop))
  }
  new window.IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting
    sync()
  }).observe(cover)
  document.addEventListener('visibilitychange', sync)
  sync()
}

function createState () {
  return {
    seconds: BEST_FRAME_SECONDS,
    theme: readTheme(),
    themeTarget: readTheme(),
    layout: null,
    lens: null,
    velocity: { x: 0, y: 0 },
    pointer: null,
    pointerAge: Infinity
  }
}

function bindInput (state) {
  cover.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return
    const rect = cover.getBoundingClientRect()
    state.pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
    state.pointerAge = 0
  })
  cover.addEventListener('pointerleave', () => {
    state.pointerAge = POINTER_IDLE_SECONDS
  })
  const updateTheme = () => (state.themeTarget = readTheme())
  window
    .matchMedia('(prefers-color-scheme: light)')
    .addEventListener('change', updateTheme)
  new window.MutationObserver(updateTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
}

function clampToBounds (point, bounds) {
  return {
    x: Math.min(bounds[2], Math.max(bounds[0], point.x)),
    y: Math.min(bounds[3], Math.max(bounds[1], point.y))
  }
}

function advance (state, step) {
  state.seconds += step
  state.pointerAge += step
  const rect = cover.getBoundingClientRect()
  if (!state.layout) {
    state.layout = layoutFor(rect.width, rect.height, textBoxFor(rect))
  }

  const auto = autopilot(state.seconds, state.layout)
  const following =
    state.pointer &&
    state.pointerAge < POINTER_IDLE_SECONDS &&
    state.seconds > INTRO.glide
  const goal = following
    ? clampToBounds(state.pointer, state.layout.bounds)
    : auto
  if (!state.lens) state.lens = { ...auto }

  const blend = 1 - Math.exp(-FOLLOW_STIFFNESS * step)
  const previous = { x: state.lens.x, y: state.lens.y }
  state.lens.x += (goal.x - state.lens.x) * blend
  state.lens.y += (goal.y - state.lens.y) * blend
  if (step > 0) {
    state.velocity.x +=
      ((state.lens.x - previous.x) / step - state.velocity.x) *
      Math.min(1, step * 6)
  }
  const tilt = Math.max(
    -MAX_TILT,
    Math.min(MAX_TILT, state.velocity.x * 0.0004)
  )
  state.lens.angle = auto.angle + tilt

  const themeStep = step / THEME_SECONDS
  state.theme += Math.max(
    -themeStep,
    Math.min(themeStep, state.themeTarget - state.theme)
  )
}

function paramsFor (state, canvasSurface) {
  const rect = cover.getBoundingClientRect()
  const layout =
    state.layout ?? layoutFor(rect.width, rect.height, textBoxFor(rect))
  const lens = state.lens ?? autopilot(state.seconds, layout)
  const dpr = canvasSurface.dpr
  const width = canvasSurface.size[0] / dpr
  const height = canvasSurface.size[1] / dpr
  return sceneParams({
    width,
    height,
    dpr,
    seconds: state.seconds,
    theme: state.theme,
    layout,
    lens
  })
}

function exposeTimings (gpuTimer) {
  const samples = (window.__lensGpuMs = [])
  gpuTimer.onResults(spans => {
    if (typeof spans.lens === 'number') samples.push(spans.lens)
  })
}

function setupTabs () {
  const tabs = [...cover.querySelectorAll('[role=tab]')]
  const command = cover.querySelector('[data-command]')
  const copy = cover.querySelector('[data-copy]')
  const select = tab => {
    tabs.forEach(other => {
      const active = other === tab
      other.setAttribute('aria-selected', String(active))
      other.tabIndex = active ? 0 : -1
    })
    command.textContent = tab.dataset.value
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', event => {
      const delta =
        event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!delta) return
      const next = tabs[(index + delta + tabs.length) % tabs.length]
      select(next)
      next.focus()
    })
  })
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(command.textContent)
      copy.dataset.copied = 'true'
      setTimeout(() => delete copy.dataset.copied, 1400)
    } catch {
      copy.dataset.copied = 'false'
    }
  })
}
