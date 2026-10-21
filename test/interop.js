'use strict'

const { execFileSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { default: test } = require('ava')
const age = require('../src/age')
const sops = require('../src/sops')
const store = require('../src/store')
const {
  FIXTURES,
  FIXTURE_KEY,
  FIXTURE_RECIPIENT,
  hasBinary,
  temporaryDir
} = require('./helpers')

const sopsTest = hasBinary('sops') || process.env.CI ? test : test.skip
const ageTest = hasBinary('age') || process.env.CI ? test : test.skip
const keyFile = path.join(FIXTURES, 'key.txt')
const sopsEnv = { ...process.env, SOPS_AGE_KEY_FILE: keyFile }

const TREE = {
  TOKEN: 'Bearer abc#1 with spaces',
  UNICODE: 'contraseña 🔑',
  PORT: 8080,
  RATIO: 0.25,
  BIG: 1e21,
  TINY: 1.5e-7,
  ENABLED: false,
  EMPTY: '',
  NOTHING: null,
  nested: { list: ['x', { deep: 'y' }], value: 'z' },
  NOTE_unencrypted: 'plain'
}

sopsTest('sops decrypts what onesecret encrypts, in YAML and JSON', t => {
  const dir = temporaryDir('interop')
  for (const file of ['default.enc.yml', 'default.enc.json']) {
    const target = path.join(dir, file)
    store.writeDocument(
      target,
      sops.encrypt(TREE, { recipients: [FIXTURE_RECIPIENT] })
    )
    const output = execFileSync(
      'sops',
      ['-d', '--output-type', 'json', target],
      { env: sopsEnv, encoding: 'utf8' }
    )
    t.deepEqual(JSON.parse(output), TREE, file)
  }
})

sopsTest(
  'onesecret decrypts what sops encrypts, and agrees with sops -d',
  t => {
    const dir = temporaryDir('interop')
    const plain = path.join(dir, 'plain.json')
    fs.writeFileSync(plain, JSON.stringify(TREE))
    for (const outputType of ['yaml', 'json']) {
      const target = path.join(dir, `out.enc.${outputType}`)
      const encrypted = execFileSync(
        'sops',
        ['-e', '--age', FIXTURE_RECIPIENT, '--output-type', outputType, plain],
        {
          env: sopsEnv,
          encoding: 'utf8'
        }
      )
      fs.writeFileSync(target, encrypted)
      const expected = JSON.parse(
        execFileSync('sops', ['-d', '--output-type', 'json', target], {
          env: sopsEnv,
          encoding: 'utf8'
        })
      )
      t.deepEqual(
        sops.decrypt(
          store.readDocument(target),
          age.parseIdentities(FIXTURE_KEY)
        ),
        expected,
        outputType
      )
    }
  }
)

ageTest('age and onesecret decrypt each other at every chunk boundary', t => {
  const identities = age.parseIdentities(FIXTURE_KEY)
  for (const size of [0, 1, 65536, 65537, 140000]) {
    const plaintext = crypto.randomBytes(size)
    const byCli = execFileSync('age', ['-d', '-i', keyFile], {
      input: age.encrypt(plaintext, [FIXTURE_RECIPIENT])
    })
    t.true(byCli.equals(plaintext), `age decrypts onesecret, size ${size}`)
    const fromCli = execFileSync('age', ['-e', '-a', '-r', FIXTURE_RECIPIENT], {
      input: plaintext,
      encoding: 'utf8'
    })
    t.true(
      age.decrypt(fromCli, identities).equals(plaintext),
      `onesecret decrypts age, size ${size}`
    )
  }
})

ageTest('age-keygen agrees on the recipient of a generated identity', t => {
  const identity = age.generateIdentity()
  const file = path.join(temporaryDir('keygen'), 'key.txt')
  fs.writeFileSync(file, `${identity}\n`)
  t.is(
    execFileSync('age-keygen', ['-y', file], { encoding: 'utf8' }).trim(),
    age.recipientOf(identity)
  )
})

const sopsEncrypt = (tree, args, outputType = 'yaml') => {
  const dir = temporaryDir('interop')
  const plain = path.join(dir, 'plain.yaml')
  fs.writeFileSync(plain, tree)
  const target = path.join(
    dir,
    `out.enc.${outputType === 'json' ? 'json' : 'yml'}`
  )
  fs.writeFileSync(
    target,
    execFileSync(
      'sops',
      [
        '-e',
        '--age',
        FIXTURE_RECIPIENT,
        ...args,
        '--output-type',
        outputType,
        plain
      ],
      { env: sopsEnv, encoding: 'utf8' }
    )
  )
  return target
}

const sopsDecrypt = file =>
  execFileSync('sops', ['-d', '--output-type', 'json', file], {
    env: sopsEnv,
    encoding: 'utf8'
  })

sopsTest('mac_only_encrypted files work in both directions', t => {
  const fromSops = sopsEncrypt('PASSWORD: x\nUSER: admin\n', [
    '--encrypted-regex',
    '^PASS',
    '--mac-only-encrypted'
  ])
  t.deepEqual(
    sops.decrypt(
      store.readDocument(fromSops),
      age.parseIdentities(FIXTURE_KEY)
    ),
    { PASSWORD: 'x', USER: 'admin' }
  )
  const ours = path.join(temporaryDir('interop'), 'mac.enc.yml')
  store.writeDocument(
    ours,
    sops.encrypt(
      { PASSWORD: 'x', USER: 'admin' },
      {
        recipients: [FIXTURE_RECIPIENT],
        rules: { encrypted_regex: '^PASS', mac_only_encrypted: true }
      }
    )
  )
  t.deepEqual(JSON.parse(sopsDecrypt(ours)), { PASSWORD: 'x', USER: 'admin' })
})

sopsTest(
  'integer-like keys, plaintext big integers, and timestamps keep the MAC valid',
  t => {
    const identities = age.parseIdentities(FIXTURE_KEY)
    const yamlOnly =
      'T_unencrypted: 2024-01-01\nW: 2024-1-2T3:04:05.120+02:00\nINF_unencrypted: .inf\n'
    const shared = 'B: x\n"1": y\nD_unencrypted: 9007199254740993\n'
    const fromYaml = sops.decrypt(
      store.readDocument(sopsEncrypt(shared + yamlOnly, [])),
      identities
    )
    t.is(fromYaml.D_unencrypted, 9007199254740993n)
    t.is(fromYaml.W, '2024-01-02T03:04:05.12+02:00')
    t.is(fromYaml.INF_unencrypted, Infinity)
    const fromJson = sops.decrypt(
      store.readDocument(sopsEncrypt(shared, [], 'json')),
      identities
    )
    t.is(fromJson.D_unencrypted, 9007199254740993n)
    t.deepEqual(
      sops.names(store.readDocument(sopsEncrypt(shared, [], 'json'))),
      ['B', '1', 'D_unencrypted']
    )
  }
)

sopsTest(
  'onesecret keeps a file readable by sops after rewriting big integers and odd keys',
  t => {
    const file = sopsEncrypt('B: x\n"1": y\nBIG: 9007199254740993\n', [])
    const tree = sops.decrypt(
      store.readDocument(file),
      age.parseIdentities(FIXTURE_KEY)
    )
    store.writeDocument(
      file,
      sops.encrypt({ ...tree, C: 'z' }, { recipients: [FIXTURE_RECIPIENT] })
    )
    t.is(
      sopsDecrypt(file).replace(/\s/g, ''),
      '{"1":"y","B":"x","BIG":9007199254740993,"C":"z"}'
    )
  }
)

sopsTest(
  'values that look like other types survive a write and stay readable by sops',
  t => {
    const file = path.join(temporaryDir('interop'), 'tricky.enc.yml')
    const tree = {
      RELEASE_unencrypted: '2024-3-5',
      WHEN_unencrypted: '2024-3-5 1:2:3',
      OCTAL_unencrypted: '0777',
      UPPER_unencrypted: '0O17',
      BINARY_unencrypted: '0B11',
      OVERFLOW_unencrypted: '1e400',
      ENCRYPTED_DATE: '2001-2-3',
      ENCRYPTED_NUMBER_STRING: '0777'
    }
    store.writeDocument(
      file,
      sops.encrypt(tree, { recipients: [FIXTURE_RECIPIENT] })
    )
    t.deepEqual(JSON.parse(sopsDecrypt(file)), tree)
    t.deepEqual(
      sops.decrypt(store.readDocument(file), age.parseIdentities(FIXTURE_KEY)),
      tree
    )
  }
)

sopsTest('plaintext numbers in go-yaml forms keep the MAC valid', t => {
  const file = sopsEncrypt(
    'A_unencrypted: 0777\nB_unencrypted: 1_000\nC_unencrypted: +0x1F\nD_unencrypted: 0O17\nE_unencrypted: 09\nSECRET: s\n',
    []
  )
  const expected = JSON.parse(sopsDecrypt(file))
  t.deepEqual(
    sops.decrypt(store.readDocument(file), age.parseIdentities(FIXTURE_KEY)),
    expected
  )
})

sopsTest('Go-only regular expressions written by sops decrypt', t => {
  for (const regex of [
    '(?i)^(password|apikey)$',
    '^[[:lower:]]+$',
    '\\Auser\\z'
  ]) {
    const file = sopsEncrypt('password: p\nAPIKEY: k\nuser: u\nOTHER: o\n', [
      '--encrypted-regex',
      regex
    ])
    t.deepEqual(
      sops.decrypt(store.readDocument(file), age.parseIdentities(FIXTURE_KEY)),
      JSON.parse(sopsDecrypt(file)),
      regex
    )
  }
})

sopsTest(
  'comments that sops encrypted inside lists are dropped and the MAC holds',
  t => {
    const file = sopsEncrypt(
      'HOSTS:\n  # primary\n  - a\n  - b\nTOKEN: t # inline\n',
      []
    )
    t.true(fs.readFileSync(file, 'utf8').includes('type:comment'))
    t.deepEqual(
      sops.decrypt(store.readDocument(file), age.parseIdentities(FIXTURE_KEY)),
      { HOSTS: ['a', 'b'], TOKEN: 't' }
    )
  }
)

sopsTest(
  'plaintext values with control and line-break characters stay readable by sops',
  t => {
    const char = String.fromCodePoint
    const file = path.join(temporaryDir('interop'), 'control.enc.yml')
    const tree = {
      LS_unencrypted: `x${char(0x2028)}y`,
      NEL_unencrypted: `x${char(0x85)}y`,
      ESC_unencrypted: `a${char(0x1b)}b`,
      SECRET: `x${char(0x2028)}y`
    }
    store.writeDocument(
      file,
      sops.encrypt(tree, { recipients: [FIXTURE_RECIPIENT] })
    )
    t.deepEqual(JSON.parse(sopsDecrypt(file)), tree)
  }
)

sopsTest(
  'underscored floats and signed prefixes match sops in both directions',
  t => {
    const identities = age.parseIdentities(FIXTURE_KEY)
    const fromSops = sopsEncrypt(
      'A_unencrypted: 1_0.5\nB_unencrypted: 0o-7\nC_unencrypted: 0b-1\nD_unencrypted: 7_E7\nE: s\n',
      []
    )
    t.deepEqual(
      sops.decrypt(store.readDocument(fromSops), identities),
      JSON.parse(sopsDecrypt(fromSops))
    )
    for (const ext of ['yml', 'json']) {
      const file = path.join(temporaryDir('interop'), `strings.enc.${ext}`)
      const tree = {
        NOTE_unencrypted: '1_0.5',
        OTHER_unencrypted: '0.1_1',
        FLOAT_unencrypted: 1e19,
        ZERO_unencrypted: -0,
        X: '1'
      }
      store.writeDocument(
        file,
        sops.encrypt(tree, { recipients: [FIXTURE_RECIPIENT] })
      )
      const { ZERO_unencrypted: zero, ...rest } = JSON.parse(sopsDecrypt(file))
      t.true(zero === 0, ext)
      t.deepEqual(
        rest,
        Object.fromEntries(
          Object.entries(tree).filter(([key]) => key !== 'ZERO_unencrypted')
        ),
        ext
      )
      t.deepEqual(sops.decrypt(store.readDocument(file), identities), tree, ext)
    }
  }
)
