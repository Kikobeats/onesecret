'use strict'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const { default: test } = require('ava')

const scene = import('../docs/cover/scene.js')
const content = import('../docs/cover/content.js')

const DESKTOP_TEXT = {
  right: 651,
  top: 241,
  bottom: 659,
  bodyRight: 558,
  wordmarkBottom: 345
}

test('a narrow cover is the mobile layout and a wide cover is the desktop one', async t => {
  const { layoutFor, TABLE_ROWS } = await scene
  const mobile = layoutFor(759, 844, DESKTOP_TEXT)
  const desktop = layoutFor(760, 900, DESKTOP_TEXT)
  t.true(mobile.mobile)
  t.false(desktop.mobile)
  t.is(mobile.rows, TABLE_ROWS.mobile)
  t.is(desktop.rows, TABLE_ROWS.desktop)
})

test('the desktop scrim and beam start at the measured ink', async t => {
  const { layoutFor } = await scene
  const layout = layoutFor(1440, 900, DESKTOP_TEXT)
  t.is(layout.scrim[0], DESKTOP_TEXT.bodyRight)
  t.is(layout.copy[0], DESKTOP_TEXT.bodyRight)
  t.is(layout.copy[1], DESKTOP_TEXT.bottom)
})

test('the first secret stays up until the first swap', async t => {
  const { tableState, TABLE } = await scene
  t.is(tableState(TABLE.firstSwap - 0.001).cycle, 0)
  t.is(tableState(TABLE.firstSwap).cycle, 1)
})

test('encoded lines store the key end, the length, and the cipher prefix', async t => {
  const {
    encodeLines,
    SECRET_LINES,
    CIPHER_PREFIX,
    TABLE_KEY_COLUMNS,
    TABLE_VALUE_COLUMNS
  } = await content
  const encoded = encodeLines()
  t.is(SECRET_LINES.length, 16)
  t.is(encoded.width, 66)
  t.is(encoded.height, SECRET_LINES.length + 1)
  t.is(CIPHER_PREFIX.length, 20)
  SECRET_LINES.forEach(([key, value], row) => {
    t.true(key.length <= TABLE_KEY_COLUMNS)
    t.true(value.length <= TABLE_VALUE_COLUMNS)
    const text = `${key}: ${value}`
    t.is(encoded.data[row * encoded.width + 64], key.length + 2)
    t.is(encoded.data[row * encoded.width + 65], text.length)
  })
  const prefixAt = SECRET_LINES.length * encoded.width
  const prefix = String.fromCharCode(
    ...encoded.data.subarray(prefixAt, prefixAt + CIPHER_PREFIX.length)
  )
  t.is(prefix, CIPHER_PREFIX)
})

test('a secret that does not fit the glass table is refused', async t => {
  const { encodeLines, TABLE_KEY_COLUMNS, TABLE_VALUE_COLUMNS } = await content
  const key = 'K'.repeat(TABLE_KEY_COLUMNS + 1)
  const value = 'V'.repeat(TABLE_VALUE_COLUMNS + 1)
  t.true(t.throws(() => encodeLines([[key, 'v']])) instanceof RangeError)
  t.true(t.throws(() => encodeLines([['KEY', value]])) instanceof RangeError)
})

test('the cover copies the migration prompt from the README', t => {
  const readme = readFileSync(join(__dirname, '../README.md'), 'utf8')
  const cover = readFileSync(join(__dirname, '../_coverpage.md'), 'utf8')
  const prompt = readme.match(
    /Migrate this project to onesecret:.*printing it\./
  )[0]
  const copied = cover
    .match(/data-prompt="([^"]*)"/)[1]
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
  t.is(copied, prompt)
  t.true(prompt.includes('piping its value into npx onesecret set'))
  t.false(prompt.includes('NAME=value'))
})
