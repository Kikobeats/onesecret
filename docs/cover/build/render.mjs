import { mkdirSync, readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import sharp from 'sharp'
import * as vgpu from 'vgpu/node'
import { lensShader } from '../shaders.js'
import { BEST_FRAME_SECONDS, autopilot, createLensEffect, layoutFor, sceneParams } from '../scene.js'

const ROOT = new URL('../', import.meta.url).pathname
const atlasPng = PNG.sync.read(readFileSync(new URL('../atlas.png', import.meta.url)))
const atlasPixels = new Uint8Array(atlasPng.width * atlasPng.height)
for (let i = 0; i < atlasPixels.length; i++) atlasPixels[i] = atlasPng.data[i * 4]

const TEXT_BOXES = JSON.parse(readFileSync(new URL('./text-boxes.json', import.meta.url), 'utf8'))
const STILL_SECONDS = BEST_FRAME_SECONDS
const SEQUENCE_SECONDS = [0.2, 0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0]

export const FRAMES = [
  { name: 'fallback-dark', width: 1440, height: 900, dpr: 2, theme: 0, text: TEXT_BOXES.desktop },
  { name: 'fallback-light', width: 1440, height: 900, dpr: 2, theme: 1, text: TEXT_BOXES.desktop },
  { name: 'fallback-dark-mobile', width: 390, height: 844, dpr: 2, theme: 0, text: TEXT_BOXES.mobile },
  { name: 'fallback-light-mobile', width: 390, height: 844, dpr: 2, theme: 1, text: TEXT_BOXES.mobile }
]

export async function renderFrame (gpu, frameSpec, seconds = STILL_SECONDS) {
  const { width, height, dpr, theme, text } = frameSpec
  const layout = layoutFor(width, height, text)
  const lens = autopilot(seconds, layout)
  const params = sceneParams({ width, height, dpr, seconds, theme, layout, lens })
  const fx = createLensEffect(vgpu, gpu, lensShader, atlasPixels, params)
  const [w, h] = params.resolution
  const colorTarget = vgpu.target(gpu, { size: [w, h] })
  fx.draw(colorTarget)
  const pixels = await colorTarget.color.read({ mipLevel: 0, region: 'all' })
  return { pixels, width: w, height: h }
}

const toImage = ({ pixels, width, height }) => sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } }).removeAlpha()

async function renderStills (gpu, only, out) {
  for (const spec of FRAMES.filter((f) => !only || only === 'all' || f.name === only)) {
    const frame = await renderFrame(gpu, spec)
    await toImage(frame).webp({ quality: 82, effort: 6 }).toFile(`${out}/${spec.name}.webp`)
    mkdirSync(`${out}/scratch`, { recursive: true })
    await toImage(frame).png().toFile(`${out}/scratch/${spec.name}.png`)
    console.log(`${spec.name} ${frame.width}x${frame.height}`)
  }
}

async function renderSequence (gpu, out) {
  mkdirSync(out, { recursive: true })
  const spec = { ...FRAMES[0], dpr: 1 }
  const strip = []
  for (const seconds of SEQUENCE_SECONDS) {
    const frame = await renderFrame(gpu, spec, seconds)
    const file = `${out}/reveal-${seconds.toFixed(1)}s.png`
    await toImage(frame).png().toFile(file)
    strip.push(await toImage(frame).resize(720, 450).png().toBuffer())
    console.log(file)
  }
  const columns = 2
  const rows = Math.ceil(strip.length / columns)
  await sharp({ create: { width: 720 * columns, height: 450 * rows, channels: 3, background: '#000' } })
    .composite(strip.map((input, i) => ({ input, left: (i % columns) * 720, top: Math.floor(i / columns) * 450 })))
    .png()
    .toFile(`${out}/reveal-sequence.png`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] ?? 'all'
  const out = process.argv[3] ?? ROOT
  const gpu = await vgpu.init()
  if (mode === 'sequence') await renderSequence(gpu, out)
  else await renderStills(gpu, mode, out)
  gpu.dispose()
}
