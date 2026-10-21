'use strict'

const { default: test } = require('ava')
const bech32 = require('../src/bech32')

test('valid BIP173 strings decode and encode back to the same text', t => {
  for (const text of [
    'a12uel5l',
    'abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw',
    'split1checkupstagehandshakeupstreamerranterredcaperred2y9e3w'
  ]) {
    const { prefix, bytes } = bech32.decode(text)
    t.is(bech32.encode(prefix, bytes), text)
  }
})

test('uppercase strings decode like their lowercase form', t => {
  t.deepEqual(bech32.decode('A12UEL5L'), bech32.decode('a12uel5l'))
})

test('malformed strings are rejected with a reason', t => {
  t.throws(() => bech32.decode('a12UEL5L'), {
    message: /mixes upper and lower case/
  })
  t.throws(() => bech32.decode('a12uel5m'), { message: /checksum is invalid/ })
  t.throws(() => bech32.decode('a1b2uel5l'), {
    message: /invalid character "b"/
  })
  t.throws(() => bech32.decode('qpzry9x8gf2'), { message: /malformed/ })
  t.throws(() => bech32.decode('1qpzry9x8gf2tvdw0s3jn54khce6mua7l'), {
    message: /malformed/
  })
})

test('32 random bytes survive a round trip', t => {
  const bytes = require('node:crypto').randomBytes(32)
  const decoded = bech32.decode(bech32.encode('age', bytes))
  t.is(decoded.prefix, 'age')
  t.true(decoded.bytes.equals(bytes))
})
