'use strict'

const { default: test } = require('ava')
const yaml = require('../src/yaml')

const withBigIntsAsText = value =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === 'bigint' ? `${item}n` : item
    )
  )

const TRICKY = {
  date: '2024-3-5',
  dateTime: '2024-3-5 1:2:3',
  timestamp: '2026-10-21T09:42:41Z',
  overflow: '1e400',
  goOctal: '0777',
  upperOctal: '0O17',
  upperBinary: '0B11',
  underscored: '1_000',
  signedHex: '+0x1F',
  colon: 'x: y',
  trailingColon: 'x:',
  trailingSpace: 'trail ',
  leadingSpace: ' lead',
  hash: 'a #b',
  startHash: '#x',
  dash: '-x',
  bool: 'true',
  tilde: '~',
  empty: '',
  at: '@at',
  quotes: '"q"',
  apostrophe: "it's",
  tab: 'tab\tin',
  unicode: 'é ünïcode',
  multiline: 'line1\nline2\n',
  keepTrailing: 'only\n\n',
  noTrailing: 'a\nb',
  indentedFirst: '  indented\nline',
  encrypted: 'ENC[AES256_GCM,data:abc=,iv:x==,tag:y==,type:str]',
  1: 'numeric key'
}

test('every string reads back as itself', t => {
  t.deepEqual({ ...yaml.parse(yaml.dump(TRICKY)) }, TRICKY)
})

test('numbers, big integers, nulls, and nested collections read back', t => {
  const value = {
    big: -9007199254740993n,
    uint: 18446744073709551615n,
    float: 1.5,
    up: Infinity,
    down: -Infinity,
    nothing: null,
    off: false,
    nested: { list: ['a', { k: 'v', inner: [1, 2] }, []], empty: {} }
  }
  const back = yaml.parse(yaml.dump(value))
  t.deepEqual(withBigIntsAsText(back), withBigIntsAsText(value))
  t.is(back.up, Infinity)
  t.true(Object.is(yaml.parse(yaml.dump({ zero: -0 })).zero, -0))
  t.true(Number.isNaN(yaml.parse(yaml.dump({ nan: NaN })).nan))
})

test('plain scalars resolve the way go-yaml v3 does', t => {
  const resolved = yaml.parse(
    [
      'octal: 0777',
      'prefixedOctal: 0o17',
      'upper: 0O17',
      'binary: 0b11',
      'hex: +0x1F',
      'underscore: 1_000',
      'notOctal: 09',
      'overflow: 1e400',
      'huge: 99999999999999999999999',
      'date: 2024-01-01',
      'offset: 2024-1-2T3:04:05.120+02:00',
      'utc: 2024-01-01T00:00:00+00:00',
      'badDate: 2024-02-30',
      'yes: yes',
      'True: True',
      'null:',
      'quoted: "9"',
      'tagged: !!str 12'
    ].join('\n')
  )
  t.like(resolved, {
    octal: 511,
    prefixedOctal: 15,
    upper: 15,
    binary: 3,
    hex: 31,
    underscore: 1000,
    notOctal: 9,
    overflow: '1e400',
    huge: 1e23,
    date: '2024-01-01T00:00:00Z',
    offset: '2024-01-02T03:04:05.12+02:00',
    utc: '2024-01-01T00:00:00Z',
    badDate: '2024-02-30',
    yes: 'yes',
    True: true,
    null: null,
    quoted: '9',
    tagged: '12'
  })
})

test('keys keep the order of the file', t => {
  t.deepEqual(yaml.keysOf(yaml.parse('B: x\n"1": y\nA: z\n')), ['B', '1', 'A'])
})

test('anchors and duplicate keys are rejected', t => {
  t.throws(() => yaml.parse('a: &x 1\nb: *x\n'), {
    message: /anchors and aliases/
  })
  t.throws(() => yaml.parse('a: 1\na: 2\n'), { message: /duplicate key/ })
})

test('JSON keeps big integers exact', t => {
  t.is(
    yaml.dumpJson({ big: 9007199254740993n }),
    '{\n  "big": 9007199254740993\n}\n'
  )
})

test('control and line-break characters are escaped and read back', t => {
  const char = String.fromCodePoint
  const values = {
    escape: `a${char(0x1b)}b`,
    lineSeparator: `x${char(0x2028)}y`,
    nextLine: `x${char(0x85)}y`,
    del: `d${char(0x7f)}`,
    bom: `${char(0xfeff)}x`,
    nul: char(0),
    emoji: `key ${char(0x1f511)}`
  }
  t.deepEqual({ ...yaml.parse(yaml.dump(values)) }, values)
  t.is(yaml.dump({ emoji: values.emoji }), `emoji: ${values.emoji}\n`)
  t.regex(yaml.dump({ value: values.lineSeparator }), /\\u2028/)
})

test('underscores and fraction digits resolve like go-yaml', t => {
  t.like(
    yaml.parse(
      'a: .99_\nb: ._1\nc: 1_0.5\nd: 2024-01-01T00:00:00.1234567891Z\n'
    ),
    {
      a: '.99_',
      b: '._1',
      c: 10.5,
      d: '2024-01-01T00:00:00.123456789Z'
    }
  )
})

test('signs after a binary or octal prefix resolve like go-yaml', t => {
  t.like(yaml.parse('a: 0o-7\nb: 0b-1\nc: 7_E7\nd: 0b2\ne: 0o-8\n'), {
    a: -7,
    b: -1,
    c: 70000000,
    d: '0b2',
    e: '0o-8'
  })
})

test('whole floats beyond 2^53 stay floats and -0 survives, in YAML and JSON', t => {
  const back = yaml.parse(yaml.dump({ huge: 1e19, big: 1.5e17, zero: -0 }))
  t.is(back.huge, 1e19)
  t.is(back.big, 1.5e17)
  t.true(Object.is(back.zero, -0))
  t.true(Object.is(yaml.parse(yaml.dumpJson({ zero: -0 })).zero, -0))
})

test('strings that look like document markers are quoted', t => {
  const values = { start: '--- x', end: '...', bare: '---' }
  t.deepEqual({ ...yaml.parse(yaml.dump(values)) }, values)
})
