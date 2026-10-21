'use strict'

const path = require('node:path')
const { default: test } = require('ava')
const age = require('../src/age')
const sops = require('../src/sops')
const store = require('../src/store')
const {
  FIXTURES,
  FIXTURE_KEY,
  FIXTURE_RECIPIENT,
  OTHER_KEY
} = require('./helpers')

const identities = age.parseIdentities(FIXTURE_KEY)
const fixture = name => store.readDocument(path.join(FIXTURES, name))

const RICH_TREE = {
  API_TOKEN: 'Bearer fixture-token',
  PORT: 3000,
  RATIO: 1.5,
  FLAG: true,
  EMPTY: '',
  nested: { inner: 'value', list: ['a', { b: 'c' }] },
  PUBLIC_unencrypted: 'visible'
}

test('a sops-written YAML file decrypts to its original types', t => {
  t.deepEqual(
    sops.decrypt(fixture('sops/default.enc.yml'), identities),
    RICH_TREE
  )
})

test('a sops-written JSON file decrypts', t => {
  t.deepEqual(sops.decrypt(fixture('json/default.enc.json'), identities), {
    API_TOKEN: 'json-token',
    COUNT: 2
  })
})

test('any recipient of a sops file can decrypt it', t => {
  t.deepEqual(
    sops.decrypt(
      fixture('sops/default.enc.yml'),
      age.parseIdentities(OTHER_KEY)
    ),
    RICH_TREE
  )
})

test('names and recipients are readable without a key', t => {
  const document = fixture('sops/default.enc.yml')
  t.deepEqual(sops.names(document), Object.keys(RICH_TREE))
  t.true(sops.recipientsOf(document).includes(FIXTURE_RECIPIENT))
})

test('an identity that is not a recipient fails with EKEY', t => {
  const error = t.throws(() =>
    sops.decrypt(
      fixture('sops/default.enc.yml'),
      age.parseIdentities(age.generateIdentity())
    )
  )
  t.is(error.code, 'EKEY')
})

test('editing an unencrypted value without the key breaks the MAC', t => {
  const document = fixture('sops/default.enc.yml')
  document.PUBLIC_unencrypted = 'changed'
  t.is(t.throws(() => sops.decrypt(document, identities)).code, 'EMAC')
})

test('moving an encrypted value to another key fails to authenticate', t => {
  const document = fixture('app/default.enc.yml')
  document.S3_KEY = document.API_TOKEN
  const error = t.throws(() => sops.decrypt(document, identities))
  t.is(error.code, 'EMAC')
  t.regex(error.message, /S3_KEY/)
})

test('a plaintext value where ciphertext belongs is rejected', t => {
  const document = fixture('app/default.enc.yml')
  document.API_TOKEN = 'plaintext'
  t.is(t.throws(() => sops.decrypt(document, identities)).code, 'EFORMAT')
})

test('a file without sops metadata or with key groups is rejected', t => {
  t.is(t.throws(() => sops.names({ A: 1 })).code, 'EFORMAT')
  t.is(
    t.throws(() => sops.decrypt({ sops: { key_groups: [] } }, identities)).code,
    'EFORMAT'
  )
  t.is(
    t.throws(() => sops.decrypt({ sops: { age: [] } }, identities)).code,
    'EFORMAT'
  )
})

test('encrypt and decrypt round trip every supported type', t => {
  const tree = {
    ...RICH_TREE,
    NOTHING: null,
    BIG: 1e21,
    TINY: 1.5e-7,
    NEGATIVE: -2.25,
    OFF: false
  }
  const document = sops.encrypt(tree, { recipients: [FIXTURE_RECIPIENT] })
  t.is(document.PUBLIC_unencrypted, 'visible')
  t.is(document.EMPTY, '')
  t.is(document.NOTHING, null)
  t.regex(document.BIG, /type:float]$/)
  t.regex(document.PORT, /type:int]$/)
  t.deepEqual(sops.decrypt(document, identities), tree)
})

test('encryption rules from existing metadata decide what stays plaintext', t => {
  const tree = { password: 'secret', username: 'admin' }
  const byRegex = sops.encrypt(tree, {
    recipients: [FIXTURE_RECIPIENT],
    rules: { encrypted_regex: '^pass' }
  })
  t.is(byRegex.username, 'admin')
  t.regex(byRegex.password, /^ENC\[/)
  t.deepEqual(sops.decrypt(byRegex, identities), tree)

  const bySuffix = sops.encrypt(
    { db_secret: 'x', db: 'y' },
    { recipients: [FIXTURE_RECIPIENT], rules: { encrypted_suffix: '_secret' } }
  )
  t.is(bySuffix.db, 'y')

  const byUnencryptedRegex = sops.encrypt(tree, {
    recipients: [FIXTURE_RECIPIENT],
    rules: { unencrypted_regex: '^user', mac_only_encrypted: true }
  })
  t.is(byUnencryptedRegex.username, 'admin')
  byUnencryptedRegex.username = 'root'
  t.deepEqual(sops.decrypt(byUnencryptedRegex, identities), {
    ...tree,
    username: 'root'
  })
})

test('rulesOf keeps only encryption rules', t => {
  t.deepEqual(
    sops.rulesOf({ unencrypted_suffix: '_u', mac: 'x', version: '1' }),
    { unencrypted_suffix: '_u' }
  )
})

test('values that cannot be represented are rejected', t => {
  const encrypt = tree =>
    sops.encrypt(tree, { recipients: [FIXTURE_RECIPIENT] })
  t.is(t.throws(() => encrypt({ A: () => {} })).code, 'EVALUE')
  t.is(t.throws(() => sops.encrypt({}, { recipients: [] })).code, 'EKEY')
})

test('bytes values round trip', t => {
  const document = sops.encrypt(
    { BLOB: Buffer.from([0, 1, 2]) },
    { recipients: [FIXTURE_RECIPIENT] }
  )
  t.true(sops.decrypt(document, identities).BLOB.equals(Buffer.from([0, 1, 2])))
})

const reEncryptAll = (document, mutate) => {
  const copy = JSON.parse(JSON.stringify(document))
  for (const key of Object.keys(copy)) {
    if (typeof copy[key] === 'string' && copy[key].startsWith('ENC[')) { copy[key] = mutate(copy[key]) }
  }
  copy.sops.mac = mutate(copy.sops.mac)
  return copy
}

test('truncated GCM tags are rejected, as sops does', t => {
  const document = reEncryptAll(fixture('app/default.enc.yml'), value =>
    value.replace(
      /tag:([^,]+)/,
      (_, tag) =>
        `tag:${Buffer.from(tag, 'base64').subarray(0, 4).toString('base64')}`
    )
  )
  t.is(t.throws(() => sops.decrypt(document, identities)).code, 'EFORMAT')
})

test('a short IV is rejected', t => {
  const document = reEncryptAll(fixture('app/default.enc.yml'), value =>
    value.replace(
      /iv:([^,]+)/,
      (_, iv) =>
        `iv:${Buffer.from(iv, 'base64').subarray(0, 12).toString('base64')}`
    )
  )
  t.is(t.throws(() => sops.decrypt(document, identities)).code, 'EFORMAT')
})

test('a secret named sops cannot overwrite the metadata', t => {
  t.is(
    t.throws(() =>
      sops.encrypt({ sops: 'oops' }, { recipients: [FIXTURE_RECIPIENT] })
    ).code,
    'EVALUE'
  )
})

test('a low-order recipient fails fast instead of looping', t => {
  const lowOrder = require('../src/bech32').encode('age', Buffer.alloc(32))
  const error = t.throws(() =>
    sops.encrypt({ A: 'x' }, { recipients: [lowOrder] })
  )
  t.is(error.code, 'EKEY')
  t.regex(error.message, /low order point/)
})

test('integers beyond 2^53 keep their exact value and MAC', t => {
  const document = sops.encrypt(
    { BIG: 9007199254740993n },
    { recipients: [FIXTURE_RECIPIENT] }
  )
  t.is(sops.decrypt(document, identities).BIG, 9007199254740993n)
})

test('infinities and NaN round trip the way sops encodes them', t => {
  const document = sops.encrypt(
    { UP: Infinity, DOWN: -Infinity, NONE: NaN },
    { recipients: [FIXTURE_RECIPIENT] }
  )
  t.deepEqual(sops.decrypt(document, identities), {
    UP: Infinity,
    DOWN: -Infinity,
    NONE: NaN
  })
})

test('base64 with trailing junk is rejected', t => {
  const document = fixture('app/default.enc.yml')
  document.S3_KEY = document.S3_KEY.replace(/(tag:[^,]+)/, '$1!!@@')
  t.is(t.throws(() => sops.decrypt(document, identities)).code, 'EFORMAT')
})

test('comment-based rules are refused instead of misread', t => {
  const document = fixture('app/default.enc.yml')
  document.sops.encrypted_comment_regex = 'sops:enc'
  t.regex(
    t.throws(() => sops.decrypt(document, identities)).message,
    /encrypted_comment_regex depends on YAML comments/
  )
})

test('names follow the order of the file, even for integer-like keys', t => {
  const document = store.readDocument(
    path.join(FIXTURES, 'app/default.enc.yml')
  )
  t.deepEqual(sops.names(document), [
    'API_TOKEN',
    'S3_KEY',
    'PORT',
    'PUBLIC_unencrypted'
  ])
})

test('Go regular expression syntax in rules works like sops', t => {
  for (const [rules, tree] of [
    [
      { encrypted_regex: '(?i)^(password|apikey)$' },
      { APIKEY: 'k', user: 'u' }
    ],
    [{ encrypted_regex: '^[[:lower:]]+$' }, { user: 'u', USER: 'U' }],
    [{ unencrypted_regex: '\\Apublic\\z' }, { public: 'p', secret: 's' }],
    [{ encrypted_regex: '^(?P<name>pass)' }, { password: 'p', other: 'o' }]
  ]) {
    const document = sops.encrypt(tree, {
      recipients: [FIXTURE_RECIPIENT],
      rules
    })
    t.deepEqual(sops.decrypt(document, identities), tree)
  }
  t.is(
    sops.encrypt(
      { USER: 'U' },
      {
        recipients: [FIXTURE_RECIPIENT],
        rules: { encrypted_regex: '^[[:lower:]]+$' }
      }
    ).USER,
    'U'
  )
  const error = t.throws(() =>
    sops.encrypt(
      { A: '1' },
      { recipients: [FIXTURE_RECIPIENT], rules: { encrypted_regex: '(?<' } }
    )
  )
  t.is(error.code, 'EFORMAT')
})

test('a file with several YAML documents is rejected with a reason', t => {
  const file = path.join(
    require('./helpers').temporaryDir('multi-doc'),
    'default.enc.yml'
  )
  require('node:fs').writeFileSync(file, 'A: 1\n---\nB: 2\n')
  const error = t.throws(() => store.readDocument(file))
  t.is(error.code, 'EFORMAT')
  t.regex(error.message, /single YAML document/)
})

test('integers sops cannot read back are refused instead of written', t => {
  const error = t.throws(() =>
    sops.encrypt({ BIG: 2n ** 63n }, { recipients: [FIXTURE_RECIPIENT] })
  )
  t.is(error.code, 'EVALUE')
  t.regex(error.message, /64-bit integer range/)
  t.notThrows(() =>
    sops.encrypt({ BIG: 2n ** 63n - 1n }, { recipients: [FIXTURE_RECIPIENT] })
  )
})

test('Go escapes with no JavaScript meaning are refused, and escaped backslashes stay literal', t => {
  const { goRegExp } = require('../src/regexp')
  for (const pattern of ['\\Qa.b\\E', '\\pL', '\\x{41}', '[[:^lower:]]']) {
    t.is(t.throws(() => goRegExp(pattern)).code, 'EFORMAT', pattern)
  }
  t.true(goRegExp('\\\\A').test('\\A'))
  t.false(goRegExp('(?m)\\Ab').test('a\nb'))
})

test('plaintext integers sops cannot read back are refused too', t => {
  const error = t.throws(() =>
    sops.encrypt(
      { D_unencrypted: 2n ** 64n - 1n },
      { recipients: [FIXTURE_RECIPIENT] }
    )
  )
  t.is(error.code, 'EVALUE')
})

test('Go regular expressions that JavaScript would read differently are refused', t => {
  const { goRegExp } = require('../src/regexp')
  for (const pattern of ['^[]a]$', '[^]]', 'a\\Z']) { t.is(t.throws(() => goRegExp(pattern)).code, 'EFORMAT', pattern) }
})
