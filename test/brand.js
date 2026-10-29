'use strict'

const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const { default: test } = require('ava')

const brand = import('../docs/brand/key.js')
const banner = import('../docs/brand/banner.js')
const deploy = import('../docs/brand/deploy.js')

const ROOT = join(__dirname, '..')
const read = (file, encoding) => readFileSync(join(ROOT, file), encoding)

const JPEG_START_OF_FRAME = [0xc0, 0xc1, 0xc2]

const jpegSize = buffer => {
  let offset = 2
  while (offset < buffer.length) {
    const marker = buffer[offset + 1]
    if (JPEG_START_OF_FRAME.includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      }
    }
    offset += 2 + buffer.readUInt16BE(offset + 2)
  }
  throw new Error('no JPEG frame header')
}

const metaContent = (html, attribute, name) =>
  html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]+)"`))[1]

test('the committed mark and icon are what the brand build generates', async t => {
  const { markSvg, iconSvg } = await brand
  t.is(read('static/mark.svg', 'utf8'), markSvg())
  t.is(read('static/logo.svg', 'utf8'), iconSvg())
})

test('the committed deploy diagram is what the brand build generates', async t => {
  const { deploySvg } = await deploy
  t.is(read('static/deploy.svg', 'utf8'), deploySvg())
})

test('the README shows the deploy diagram in the Deploy section', t => {
  const readme = read('README.md', 'utf8')
  const deploySection = readme.slice(
    readme.indexOf('## Deploy'),
    readme.indexOf('## How it works')
  )
  t.true(deploySection.includes('](static/deploy.svg)'))
})

test('the blade starts inside the bow ring, clear of the hole', async t => {
  const { KEY } = await brand
  const { bow, shaft } = KEY
  for (const y of [shaft.top, shaft.bottom]) {
    const dy = y - bow.cy
    const holeEdge = bow.cx + Math.sqrt(bow.inner ** 2 - dy ** 2)
    const ringEdge = bow.cx + Math.sqrt(bow.outer ** 2 - dy ** 2)
    t.true(shaft.left > holeEdge, `blade covers the hole at y=${y}`)
    t.true(shaft.left < ringEdge, `blade detaches from the ring at y=${y}`)
  }
})

test('both teeth hang below the shaft and stay inside the key box', async t => {
  const { KEY } = await brand
  const [inner, tip] = KEY.teeth
  t.true(inner.right < tip.left)
  t.is(tip.right, KEY.shaft.right)
  t.is(KEY.shaft.right, KEY.width)
  for (const tooth of KEY.teeth) {
    t.true(tooth.bottom > KEY.shaft.bottom + KEY.corner)
    t.true(tooth.bottom <= KEY.height)
  }
})

test('the social image URLs carry the hash of the committed banner', t => {
  const html = read('index.html', 'utf8')
  const version = createHash('sha256')
    .update(read('static/banner.jpg'))
    .digest('hex')
    .slice(0, 8)
  const expected = `https://onesecret.js.org/static/banner.jpg?v=${version}`
  t.is(metaContent(html, 'property', 'og:image'), expected)
  t.is(metaContent(html, 'name', 'twitter:image'), expected)
})

test('the declared banner size is the rendered banner size', async t => {
  const { BANNER } = await banner
  const html = read('index.html', 'utf8')
  const size = jpegSize(read('static/banner.jpg'))
  t.deepEqual(size, {
    width: BANNER.width * BANNER.scale,
    height: BANNER.height * BANNER.scale
  })
  t.is(Number(metaContent(html, 'property', 'og:image:width')), size.width)
  t.is(Number(metaContent(html, 'property', 'og:image:height')), size.height)
})
