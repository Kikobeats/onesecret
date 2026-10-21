'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { default: test } = require('ava')
const onesecret = require('../src')
const {
  FIXTURE_KEY,
  fakeBinary,
  project,
  temporaryDir,
  withEnv
} = require('./helpers')

const DEFAULT_SECRETS = {
  API_TOKEN: 'Bearer default #token',
  S3_KEY: 'AKIA-default',
  PORT: 3000,
  PUBLIC_unencrypted: 'visible'
}
const PRODUCTION_SECRETS = {
  ...DEFAULT_SECRETS,
  API_TOKEN: 'Bearer production-token',
  DATABASE_URL: 'postgres://fixture-production'
}

const keyCommandPrinting = key => {
  const counter = path.join(temporaryDir('counter'), 'calls')
  const { file } = fakeBinary(
    'print-key',
    `require('fs').appendFileSync(${JSON.stringify(
      counter
    )}, 'x'); console.log(${JSON.stringify(key)})`
  )
  return {
    command: file,
    calls: () =>
      fs.existsSync(counter) ? fs.readFileSync(counter, 'utf8').length : 0
  }
}

test('names come from the default layer plus the env layer, without a key', t => {
  const cwd = project({ fixture: 'app' })
  t.deepEqual(
    onesecret.names({ cwd, env: 'development' }),
    Object.keys(DEFAULT_SECRETS)
  )
  t.deepEqual(
    onesecret.names({ cwd, env: 'production' }),
    Object.keys(PRODUCTION_SECRETS)
  )
  t.deepEqual(onesecret.names({ cwd: temporaryDir('empty') }), [])
})

test.serial('load merges the env layer over the default layer', t => {
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    t.deepEqual(onesecret.load({ cwd, env: 'development' }), DEFAULT_SECRETS)
    t.deepEqual(onesecret.load({ cwd, env: 'production' }), PRODUCTION_SECRETS)
  })
})

test.serial('the env layer defaults to NODE_ENV', t => {
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY, NODE_ENV: 'production' }, () => {
    t.is(onesecret.load({ cwd }).DATABASE_URL, 'postgres://fixture-production')
  })
})

test.serial(
  'the key is read from SOPS_AGE_KEY_FILE and the sops keys file',
  t => {
    const cwd = project({ fixture: 'app' })
    const keyFile = path.join(temporaryDir('key'), 'keys.txt')
    fs.writeFileSync(keyFile, `# test\n${FIXTURE_KEY}\n`)
    withEnv({ SOPS_AGE_KEY_FILE: keyFile }, () => {
      t.is(onesecret.load({ cwd }).S3_KEY, 'AKIA-default')
    })
    const xdg = temporaryDir('xdg')
    fs.mkdirSync(path.join(xdg, 'sops', 'age'), { recursive: true })
    fs.writeFileSync(path.join(xdg, 'sops', 'age', 'keys.txt'), FIXTURE_KEY)
    withEnv({ XDG_CONFIG_HOME: xdg }, () => {
      t.is(onesecret.load({ cwd }).S3_KEY, 'AKIA-default')
    })
    withEnv({ SOPS_AGE_KEY_FILE: '/nonexistent/keys.txt' }, () => {
      t.is(t.throws(() => onesecret.load({ cwd })).code, 'EKEY')
    })
  }
)

test.serial('without any key, load fails with ENOKEY', t => {
  const cwd = project({ fixture: 'app' })
  t.is(t.throws(() => onesecret.load({ cwd })).code, 'ENOKEY')
})

test.serial(
  'keyCommand from package.json runs once and only when no local key matches',
  t => {
    const { command, calls } = keyCommandPrinting(FIXTURE_KEY)
    const cwd = project({
      fixture: 'app',
      packageJson: { onesecret: { keyCommand: command } }
    })
    t.deepEqual(onesecret.load({ cwd, env: 'production' }), PRODUCTION_SECRETS)
    t.deepEqual(onesecret.load({ cwd, env: 'production' }), PRODUCTION_SECRETS)
    t.is(calls(), 1)

    const unrelated = require('../src/age').generateIdentity()
    const other = keyCommandPrinting(FIXTURE_KEY)
    withEnv({ SOPS_AGE_KEY: unrelated }, () => {
      t.is(
        onesecret.load({ cwd, keyCommand: other.command }).S3_KEY,
        'AKIA-default'
      )
    })
    t.is(other.calls(), 1)

    const matching = keyCommandPrinting(FIXTURE_KEY)
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      onesecret.load({ cwd, keyCommand: matching.command })
    })
    t.is(matching.calls(), 0)
  }
)

test.serial('SOPS_AGE_KEY_CMD takes the place of keyCommand', t => {
  const { command } = keyCommandPrinting(FIXTURE_KEY)
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY_CMD: command }, () => {
    t.is(onesecret.load({ cwd }).S3_KEY, 'AKIA-default')
  })
})

test.serial('a failing or silent keyCommand explains itself', t => {
  const cwd = project({ fixture: 'app' })
  const failing = fakeBinary(
    'fail-key',
    "console.error('not logged in'); process.exit(1)"
  ).file
  const failure = t.throws(() => onesecret.load({ cwd, keyCommand: failing }))
  t.is(failure.code, 'EKEY')
  t.regex(failure.message, /not logged in/)
  const silent = fakeBinary('silent-key', '').file
  t.regex(
    t.throws(() => onesecret.load({ cwd, keyCommand: silent })).message,
    /printed no age identity/
  )
})

test.serial('package.json can move the secrets directory', t => {
  const cwd = temporaryDir('moved')
  fs.cpSync(project({ fixture: 'app' }), path.join(cwd), { recursive: true })
  fs.renameSync(path.join(cwd, 'secrets'), path.join(cwd, 'config'))
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ onesecret: { dir: 'config' } })
  )
  t.deepEqual(onesecret.names({ cwd }), Object.keys(DEFAULT_SECRETS))
})

test.serial(
  'config fills only the unset variables and leaves the key out of them',
  t => {
    const cwd = project({ fixture: 'app' })
    const processEnv = { API_TOKEN: 'from-env', S3_KEY: '' }
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      const values = onesecret.config({ cwd, env: 'production', processEnv })
      t.deepEqual(values, {
        ...PRODUCTION_SECRETS,
        API_TOKEN: 'from-env',
        S3_KEY: '',
        PORT: '3000'
      })
    })
    t.is(processEnv.S3_KEY, '')
    t.is(processEnv.SOPS_AGE_KEY, undefined)
  }
)

test.serial(
  'config needs no key when the environment already has every secret',
  t => {
    const cwd = project({ fixture: 'app' })
    const processEnv = Object.fromEntries(
      Object.keys(PRODUCTION_SECRETS).map(name => [name, 'injected'])
    )
    t.is(
      onesecret.config({ cwd, env: 'production', processEnv }).DATABASE_URL,
      'injected'
    )
  }
)

test.serial('config names the missing secrets when there is no key', t => {
  const cwd = project({ fixture: 'app' })
  const processEnv = {
    API_TOKEN: 'x',
    S3_KEY: 'x',
    PORT: '1',
    PUBLIC_unencrypted: 'x'
  }
  const error = t.throws(() =>
    onesecret.config({ cwd, env: 'production', processEnv })
  )
  t.is(error.code, 'EMISSING')
  t.regex(
    error.message,
    /DATABASE_URL is not set and cannot be decrypted, no age key found/
  )
})

test.serial(
  'an empty secret is a value, both in the file and in the environment',
  t => {
    const cwd = temporaryDir('empty-value')
    const sops = require('../src/sops')
    const store = require('../src/store')
    const recipient = require('../src/age').recipientOf(FIXTURE_KEY)
    store.writeDocument(
      path.join(cwd, 'secrets', 'default.enc.yml'),
      sops.encrypt({ BLANK: '' }, { recipients: [recipient] })
    )
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      t.deepEqual(onesecret.config({ cwd, processEnv: {} }), { BLANK: '' })
    })
    t.deepEqual(onesecret.config({ cwd, processEnv: { BLANK: '' } }), {
      BLANK: ''
    })
  }
)

test.serial('config writes to process.env by default', t => {
  const cwd = project({ fixture: 'app' })
  withEnv(
    {
      SOPS_AGE_KEY: FIXTURE_KEY,
      API_TOKEN: undefined,
      S3_KEY: undefined,
      PORT: undefined,
      PUBLIC_unencrypted: undefined
    },
    () => {
      onesecret.config({ cwd })
      t.is(process.env.S3_KEY, 'AKIA-default')
      t.is(process.env.PORT, '3000')
    }
  )
})

test.serial('ONESECRET_SKIP=1 turns config into a no-op', t => {
  const cwd = project({ fixture: 'app' })
  const processEnv = {}
  withEnv({ ONESECRET_SKIP: '1' }, () => {
    t.deepEqual(onesecret.config({ cwd, processEnv }), {})
  })
  t.deepEqual(processEnv, {})
})

test('toDotenv and toEnv turn scalars into strings and refuse what env cannot hold', t => {
  t.is(
    onesecret.toDotenv({ A: 'x y', B: 2, C: true, D: null }),
    'A=x y\nB=2\nC=true\nD=\n'
  )
  t.is(onesecret.toDotenv({ A: 'line\nbreak' }), "A='line\nbreak'\n")
  t.is(onesecret.toDotenv({ A: 'all \' ` " quotes' }), 'A=all \' ` " quotes\n')
  t.is(t.throws(() => onesecret.toEnv({ 'NOT-VALID': 'x' })).code, 'EVALUE')
  t.is(t.throws(() => onesecret.toEnv({ NESTED: { a: 1 } })).code, 'EVALUE')
})

test('checksum ignores order and changes with any value', t => {
  t.is(
    onesecret.checksum({ A: '1', B: '2' }),
    onesecret.checksum({ B: '2', A: '1' })
  )
  t.not(onesecret.checksum({ A: '1' }), onesecret.checksum({ A: '2' }))
  t.regex(onesecret.checksum({}), /^[a-f0-9]{64}$/)
})

test('withoutAgeKey drops every age key variable', t => {
  t.deepEqual(
    onesecret.withoutAgeKey({
      SOPS_AGE_KEY: 'a',
      SOPS_AGE_KEY_FILE: 'b',
      SOPS_AGE_KEY_CMD: 'c',
      PATH: '/bin'
    }),
    { PATH: '/bin' }
  )
})

test('without encrypted files, load returns nothing but config fails', t => {
  const cwd = temporaryDir('no-files')
  t.deepEqual(onesecret.load({ cwd }), {})
  const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.is(error.code, 'EMISSING')
  t.regex(error.message, /no encrypted files found in .*secrets/)
})

test('a corrupt encrypted file names itself', t => {
  const cwd = temporaryDir('corrupt')
  fs.mkdirSync(path.join(cwd, 'secrets'))
  fs.writeFileSync(
    path.join(cwd, 'secrets', 'default.enc.yml'),
    'A: [unclosed\n'
  )
  const error = t.throws(() => onesecret.names({ cwd }))
  t.is(error.code, 'EFORMAT')
  t.regex(error.message, /default\.enc\.yml/)
})

test.serial(
  'production never runs the keyCommand and still names what is missing',
  t => {
    const { command, calls } = keyCommandPrinting(FIXTURE_KEY)
    const cwd = project({
      fixture: 'app',
      packageJson: { onesecret: { keyCommand: command } }
    })
    for (const env of ['production', 'staging']) {
      const error = t.throws(() =>
        onesecret.config({ cwd, env, processEnv: {} })
      )
      t.is(error.code, 'EMISSING')
      t.regex(error.message, /API_TOKEN, S3_KEY, PORT, PUBLIC_unencrypted/)
    }
    t.is(calls(), 0)
    t.is(
      onesecret.config({ cwd, env: 'development', processEnv: {} }).S3_KEY,
      'AKIA-default'
    )
    t.is(calls(), 1)
  }
)

test.serial('a key that does not match still names the missing secrets', t => {
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY: require('../src/age').generateIdentity() }, () => {
    const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
    t.is(error.code, 'EMISSING')
    t.regex(error.message, /no age identity matches/)
  })
})

test.serial('a failing keyCommand runs once per process', t => {
  const cwd = project({ fixture: 'app' })
  const counter = path.join(temporaryDir('fail-counter'), 'calls')
  const failing = fakeBinary(
    'fail-once',
    `require('fs').appendFileSync(${JSON.stringify(
      counter
    )}, 'x'); process.exit(1)`
  ).file
  t.throws(() => onesecret.load({ cwd, keyCommand: failing }))
  t.throws(() => onesecret.load({ cwd, keyCommand: failing }))
  t.is(fs.readFileSync(counter, 'utf8').length, 1)
})

test.serial(
  'config converts only the missing secrets, so an unrelated value cannot break boot',
  t => {
    const cwd = temporaryDir('nested')
    const sops = require('../src/sops')
    const store = require('../src/store')
    const recipient = require('../src/age').recipientOf(FIXTURE_KEY)
    store.writeDocument(
      path.join(cwd, 'secrets', 'default.enc.yml'),
      sops.encrypt(
        { TOKEN: 'x', 'BAD-NAME': 'y', nested: { a: 1 } },
        { recipients: [recipient] }
      )
    )
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      const processEnv = { 'BAD-NAME': 'set', nested: 'set' }
      t.is(onesecret.config({ cwd, processEnv }).TOKEN, 'x')
    })
  }
)

test.serial(
  'unsupported identities are skipped and keys on one line are split, as sops does',
  t => {
    const cwd = project({ fixture: 'app' })
    const other = require('../src/age').generateIdentity()
    withEnv(
      { SOPS_AGE_KEY: `AGE-SECRET-KEY-PQ-1QQQQQQ\n${other} ${FIXTURE_KEY}` },
      () => {
        t.is(onesecret.load({ cwd }).S3_KEY, 'AKIA-default')
      }
    )
  }
)

test.serial('a broken key names its source and carries a code', t => {
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY: 'AGE-SECRET-KEY-1INVALID' }, () => {
    const error = t.throws(() => onesecret.load({ cwd }))
    t.is(error.code, 'EKEY')
    t.regex(error.message, /SOPS_AGE_KEY holds an invalid age key/)
  })
})

test.serial(
  'the production error does not suggest a keyCommand it will not run',
  t => {
    const cwd = project({ fixture: 'app' })
    const error = t.throws(() =>
      onesecret.config({ cwd, env: 'production', processEnv: {} })
    )
    t.regex(error.message, /keyCommand is not run here/)
  }
)

test.serial(
  'secret names that exist on Object.prototype are injected like any other',
  t => {
    const cwd = temporaryDir('prototype-names')
    const sops = require('../src/sops')
    const store = require('../src/store')
    store.writeDocument(
      path.join(cwd, 'secrets', 'default.enc.yml'),
      sops.encrypt(
        { constructor: 'c1', valueOf: 'v1' },
        { recipients: [require('../src/age').recipientOf(FIXTURE_KEY)] }
      )
    )
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      const processEnv = {}
      t.deepEqual(onesecret.config({ cwd, processEnv }), {
        constructor: 'c1',
        valueOf: 'v1'
      })
      t.true(Object.hasOwn(processEnv, 'constructor'))
    })
  }
)

test('dotenv quotes leading spaces and refuses carriage returns', t => {
  const { parseEnv } = require('node:util')
  t.deepEqual(
    { ...parseEnv(onesecret.toDotenv({ LEAD: ' lead', TRAIL: 'trail ' })) },
    { LEAD: ' lead', TRAIL: 'trail ' }
  )
  t.is(t.throws(() => onesecret.toDotenv({ A: 'a\rb' })).code, 'EVALUE')
  t.is(
    t.throws(() => onesecret.toEnv(Object.fromEntries([['__proto__', 'x']])))
      .code,
    'EVALUE'
  )
})

test('dotenv output reads back unchanged through node and the dotenv package', t => {
  const { parseEnv } = require('node:util')
  const dotenv = require('dotenv')
  const secrets = {
    DB_PASSWORD: 'Tr0ub4dor\\',
    API_URL: 'https://api.example.com',
    WEBHOOK_SECRET: '#whsec_abc123',
    QUOTES: 'mix \' " `',
    LITERAL_ESCAPE: '\\n is not a newline',
    MULTILINE: 'line1\nline2',
    LEAD: ' lead'
  }
  const body = onesecret.toDotenv(secrets)
  t.deepEqual({ ...parseEnv(body) }, secrets)
  t.deepEqual({ ...dotenv.parse(body) }, secrets)
})

test('dotenv refuses values that one of the parsers would change', t => {
  t.is(t.throws(() => onesecret.toDotenv({ A: "'\\" })).code, 'EVALUE')
  t.is(
    t.throws(() => onesecret.toDotenv({ A: 'mix \' " ` and\nnewline' })).code,
    'EVALUE'
  )
})

test('the dotenv package port agrees with the real package', t => {
  const { parseDotenvPackage } = require('../src/dotenv')
  const dotenv = require('dotenv')
  for (const body of [
    "A='x\\'\nB=y\nC='#z'\n",
    'A="a\\nb"\nB=`c`\n',
    'export A=1 # comment\nB: 2\n',
    'A=\nB="unterminated\nC=3\n'
  ]) {
    t.deepEqual(parseDotenvPackage(body), { ...dotenv.parse(body) }, body)
  }
})
