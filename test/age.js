'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { default: test } = require('ava')
const age = require('../src/age')
const {
  FIXTURES,
  FIXTURE_KEY,
  FIXTURE_RECIPIENT,
  OTHER_KEY
} = require('./helpers')

const identities = age.parseIdentities(FIXTURE_KEY)

const reArmor = (armored, mutate) => {
  const lines = armored.trim().split('\n')
  const binary = Buffer.from(lines.slice(1, -1).join(''), 'base64')
  const changed = mutate(binary)
  return [
    lines[0],
    ...changed.toString('base64').match(/.{1,64}/g),
    lines[lines.length - 1],
    ''
  ].join('\n')
}

test('a file written by the age CLI decrypts', t => {
  const armored = fs.readFileSync(path.join(FIXTURES, 'hello.age'), 'utf8')
  t.is(age.decrypt(armored, identities).toString(), 'hello from the age CLI\n')
})

test('the recipient of a secret key matches the one age-keygen printed', t => {
  t.is(age.recipientOf(FIXTURE_KEY), FIXTURE_RECIPIENT)
})

test('payloads of every chunk boundary survive a round trip', t => {
  for (const size of [0, 1, 32, 65535, 65536, 65537, 3 * 65536]) {
    const plaintext = crypto.randomBytes(size)
    t.true(
      age
        .decrypt(age.encrypt(plaintext, [FIXTURE_RECIPIENT]), identities)
        .equals(plaintext),
      `size ${size}`
    )
  }
})

test('every recipient of a multi-recipient file can decrypt it', t => {
  const otherRecipient = age.recipientOf(OTHER_KEY)
  const armored = age.encrypt(Buffer.from('shared'), [
    FIXTURE_RECIPIENT,
    otherRecipient
  ])
  t.is(age.decrypt(armored, identities).toString(), 'shared')
  t.is(
    age.decrypt(armored, age.parseIdentities(OTHER_KEY)).toString(),
    'shared'
  )
})

test('an identity that is not a recipient returns null', t => {
  const armored = age.encrypt(Buffer.from('x'), [FIXTURE_RECIPIENT])
  t.is(age.decrypt(armored, age.parseIdentities(age.generateIdentity())), null)
})

test('a modified header MAC is rejected', t => {
  const armored = age.encrypt(Buffer.from('x'), [FIXTURE_RECIPIENT])
  const tampered = reArmor(armored, binary => {
    const macStart = binary.indexOf('\n--- ') + 5
    const copy = Buffer.from(binary)
    copy[macStart] = copy[macStart] === 0x41 ? 0x42 : 0x41
    return copy
  })
  t.throws(() => age.decrypt(tampered, identities), {
    message: /header (MAC is invalid|has non-canonical base64)/
  })
})

test('a modified payload byte fails to authenticate', t => {
  const armored = age.encrypt(Buffer.from('payload'), [FIXTURE_RECIPIENT])
  const tampered = reArmor(armored, binary => {
    const copy = Buffer.from(binary)
    copy[copy.length - 1] ^= 1
    return copy
  })
  t.throws(() => age.decrypt(tampered, identities), {
    message: /failed to authenticate/
  })
})

test('a payload truncated at a chunk boundary is rejected', t => {
  const armored = age.encrypt(crypto.randomBytes(2 * 65536), [
    FIXTURE_RECIPIENT
  ])
  const truncated = reArmor(armored, binary =>
    binary.subarray(0, binary.length - (65536 + 16))
  )
  t.throws(() => age.decrypt(truncated, identities), {
    message: /failed to authenticate/
  })
})

test('malformed armor and headers are rejected', t => {
  t.throws(() => age.decrypt('not age', identities), {
    message: /armor is malformed/
  })
  const wrongVersion = reArmor(
    age.encrypt(Buffer.from('x'), [FIXTURE_RECIPIENT]),
    binary =>
      Buffer.from(
        binary
          .toString('latin1')
          .replace('age-encryption.org/v1', 'age-encryption.org/v2'),
        'latin1'
      )
  )
  t.throws(() => age.decrypt(wrongVersion, identities), {
    message: /unsupported age format version/
  })
})

test('identity text skips comments, blank lines, and plugin identities', t => {
  const text = `# created: today\n\n${FIXTURE_KEY}\nAGE-PLUGIN-YUBIKEY-1QQQQ\n  ${OTHER_KEY}  \n`
  t.is(age.parseIdentities(text).length, 2)
})

test('a recipient or identity of the wrong kind is rejected', t => {
  t.throws(() => age.parseIdentities(FIXTURE_RECIPIENT), {
    message: /not an X25519 secret key/
  })
  t.throws(() => age.encrypt(Buffer.from('x'), [FIXTURE_KEY.toLowerCase()]), {
    message: /not an age X25519 recipient/
  })
  t.throws(() => age.encrypt(Buffer.from('x'), []), {
    message: /at least one recipient/
  })
})

test('generated identities are valid and distinct', t => {
  const first = age.generateIdentity()
  const second = age.generateIdentity()
  t.regex(first, /^AGE-SECRET-KEY-1[0-9A-Z]{58}$/)
  t.not(first, second)
  t.regex(age.recipientOf(first), /^age1[0-9a-z]{58}$/)
})

test('a stanza built on a low-order point matches no identity', t => {
  const armored = age.encrypt(Buffer.from('x'), [FIXTURE_RECIPIENT])
  const lowOrder = reArmor(armored, binary => {
    const text = binary.toString('latin1')
    const share = text.match(/-> X25519 (\S+)/)[1]
    return Buffer.from(text.replace(share, 'A'.repeat(42) + 'A'), 'latin1')
  })
  t.is(age.decrypt(lowOrder, identities), null)
})

test('non-canonical base64 in the header is rejected', t => {
  const armored = age.encrypt(Buffer.from('x'), [FIXTURE_RECIPIENT])
  const padded = reArmor(armored, binary => {
    const text = binary.toString('latin1')
    const share = text.match(/-> X25519 (\S+)/)[1]
    return Buffer.from(text.replace(share, `${share}=`), 'latin1')
  })
  t.throws(() => age.decrypt(padded, identities), {
    message: /non-canonical base64/
  })
})
