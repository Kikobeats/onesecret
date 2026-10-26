'use strict'

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { default: test } = require('ava')
const onesecret = require('../src')
const secrets = require('../src/secrets')

const load = input => secrets.loadLayers(secrets.readLayers(input))
const names = input => secrets.namesOf(secrets.readLayers(input))
const age = require('../src/age')
const {
  FIXTURE_KEY,
  OTHER_KEY,
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
  t.deepEqual(names({ cwd, env: 'development' }), Object.keys(DEFAULT_SECRETS))
  t.deepEqual(
    names({ cwd, env: 'production' }),
    Object.keys(PRODUCTION_SECRETS)
  )
  t.deepEqual(names({ cwd: temporaryDir('empty') }), [])
})

test.serial('load merges the env layer over the default layer', t => {
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    t.deepEqual(load({ cwd, env: 'development' }), DEFAULT_SECRETS)
    t.deepEqual(load({ cwd, env: 'production' }), PRODUCTION_SECRETS)
  })
})

test('secretNames lists the secrets of an env without a key and refuses an unknown env', t => {
  const cwd = project({ fixture: 'app' })
  t.deepEqual(
    onesecret.secretNames({ cwd, env: 'production' }),
    Object.keys(PRODUCTION_SECRETS)
  )
  t.deepEqual(
    onesecret.secretNames({ cwd, env: 'default' }),
    Object.keys(DEFAULT_SECRETS)
  )
  const typo = t.throws(() => onesecret.secretNames({ cwd, env: 'prodution' }))
  t.is(typo.code, 'EVALUE')
  t.regex(typo.message, /secretNames\(\) found no "prodution" layer/)
})

test.serial('secrets decrypts the merged secrets of an env as strings', t => {
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    t.deepEqual(
      onesecret.secrets({ cwd, env: 'production' }),
      onesecret.toEnv(PRODUCTION_SECRETS)
    )
    t.deepEqual(
      onesecret.secrets({ cwd, env: 'default' }),
      onesecret.toEnv(DEFAULT_SECRETS)
    )
    t.is(onesecret.secrets({ cwd, env: 'production' }).PORT, '3000')
    const typo = t.throws(() => onesecret.secrets({ cwd, env: 'prodution' }))
    t.is(typo.code, 'EVALUE')
    t.regex(typo.message, /secrets\(\) found no "prodution" layer/)
  })
})

test.serial('secrets ignores values already in the environment', t => {
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY, S3_KEY: 'from-env' }, () => {
    t.is(onesecret.secrets({ cwd, env: 'production' }).S3_KEY, 'AKIA-default')
  })
})

test.serial(
  'secrets runs keyCommand even for a deployed env, and fails without a key',
  t => {
    const { command, calls } = keyCommandPrinting(FIXTURE_KEY)
    const cwd = project({
      fixture: 'app',
      packageJson: { onesecret: { keyCommand: command } }
    })
    t.is(
      onesecret.secrets({ cwd, env: 'production' }).DATABASE_URL,
      'postgres://fixture-production'
    )
    t.is(calls(), 1)
    const keyless = project({ fixture: 'app' })
    t.is(
      t.throws(() => onesecret.secrets({ cwd: keyless, env: 'production' }))
        .code,
      'ENOKEY'
    )
  }
)

test.serial('the env layer defaults to NODE_ENV', t => {
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY, NODE_ENV: 'production' }, () => {
    t.is(load({ cwd }).DATABASE_URL, 'postgres://fixture-production')
  })
})

test.serial(
  'the key is read from SOPS_AGE_KEY_FILE and the sops keys file',
  t => {
    const cwd = project({ fixture: 'app' })
    const keyFile = path.join(temporaryDir('key'), 'keys.txt')
    fs.writeFileSync(keyFile, `# test\n${FIXTURE_KEY}\n`)
    withEnv({ SOPS_AGE_KEY_FILE: keyFile }, () => {
      t.is(load({ cwd }).S3_KEY, 'AKIA-default')
    })
    const xdg = temporaryDir('xdg')
    fs.mkdirSync(path.join(xdg, 'sops', 'age'), { recursive: true })
    fs.writeFileSync(path.join(xdg, 'sops', 'age', 'keys.txt'), FIXTURE_KEY)
    withEnv({ XDG_CONFIG_HOME: xdg }, () => {
      t.is(load({ cwd }).S3_KEY, 'AKIA-default')
    })
    withEnv({ SOPS_AGE_KEY_FILE: '/nonexistent/keys.txt' }, () => {
      t.is(t.throws(() => load({ cwd })).code, 'EKEY')
    })
  }
)

test.serial('without any key, load fails with ENOKEY', t => {
  const cwd = project({ fixture: 'app' })
  t.is(t.throws(() => load({ cwd })).code, 'ENOKEY')
})

test.serial(
  'keyCommand from package.json runs once and only when no local key matches',
  t => {
    const { command, calls } = keyCommandPrinting(FIXTURE_KEY)
    const cwd = project({
      fixture: 'app',
      packageJson: { onesecret: { keyCommand: command } }
    })
    t.deepEqual(load({ cwd, env: 'production' }), PRODUCTION_SECRETS)
    t.deepEqual(load({ cwd, env: 'production' }), PRODUCTION_SECRETS)
    t.is(calls(), 1)

    const unrelated = require('../src/age').generateIdentity()
    const other = keyCommandPrinting(FIXTURE_KEY)
    withEnv({ SOPS_AGE_KEY: unrelated }, () => {
      t.is(load({ cwd, keyCommand: other.command }).S3_KEY, 'AKIA-default')
    })
    t.is(other.calls(), 1)

    const matching = keyCommandPrinting(FIXTURE_KEY)
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      load({ cwd, keyCommand: matching.command })
    })
    t.is(matching.calls(), 0)
  }
)

test.serial('SOPS_AGE_KEY_CMD takes the place of keyCommand', t => {
  const { command } = keyCommandPrinting(FIXTURE_KEY)
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY_CMD: command }, () => {
    t.is(load({ cwd }).S3_KEY, 'AKIA-default')
  })
})

test.serial('a failing or silent keyCommand explains itself', t => {
  const cwd = project({ fixture: 'app' })
  const failing = fakeBinary(
    'fail-key',
    "console.error('not logged in'); process.exit(1)"
  ).file
  const failure = t.throws(() => load({ cwd, keyCommand: failing }))
  t.is(failure.code, 'EKEY')
  t.regex(failure.message, /not logged in/)
  const silent = fakeBinary('silent-key', '').file
  t.regex(
    t.throws(() => load({ cwd, keyCommand: silent })).message,
    /printed no age identity/
  )
})

test.serial('package.json can move the config directory', t => {
  const cwd = temporaryDir('moved')
  fs.cpSync(project({ fixture: 'app' }), path.join(cwd), { recursive: true })
  fs.renameSync(path.join(cwd, 'config'), path.join(cwd, 'settings'))
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ onesecret: { dir: 'settings' } })
  )
  t.deepEqual(names({ cwd }), Object.keys(DEFAULT_SECRETS))
})

test.serial(
  'config prefers the environment, and env fills only the unset variables without the key',
  t => {
    const cwd = project({ fixture: 'app' })
    const processEnv = { API_TOKEN: 'from-env', S3_KEY: '' }
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      const values = onesecret.config({ cwd, env: 'production', processEnv })
      t.deepEqual(values, {
        ...PRODUCTION_SECRETS,
        API_TOKEN: 'from-env',
        S3_KEY: '',
        PORT: 3000
      })
      t.deepEqual(processEnv, { API_TOKEN: 'from-env', S3_KEY: '' })
      onesecret.env({ cwd, env: 'production', processEnv })
    })
    t.is(processEnv.PORT, '3000')
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
      path.join(cwd, 'config', 'default.enc.yml'),
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

test.serial('env writes to process.env by default, config never does', t => {
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
      t.is(process.env.S3_KEY, undefined)
      t.is(process.env.PORT, undefined)
      onesecret.env({ cwd })
      t.is(process.env.S3_KEY, 'AKIA-default')
      t.is(process.env.PORT, '3000')
    }
  )
})

test.serial('ONESECRET_SKIP=1 turns config into a no-op', t => {
  const cwd = project({ fixture: 'app' })
  const processEnv = { ONESECRET_SKIP: '1' }
  t.deepEqual(onesecret.config({ cwd, processEnv }), {})
  t.deepEqual(processEnv, { ONESECRET_SKIP: '1' })
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

test('without config files, load returns nothing but config fails', t => {
  const cwd = temporaryDir('no-files')
  t.deepEqual(load({ cwd }), {})
  const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.is(error.code, 'EMISSING')
  t.regex(
    error.message,
    /no config files for "default" or "development" found in .*config/
  )
})

test('a corrupt encrypted file names itself', t => {
  const cwd = temporaryDir('corrupt')
  fs.mkdirSync(path.join(cwd, 'config'))
  fs.writeFileSync(
    path.join(cwd, 'config', 'default.enc.yml'),
    'A: [unclosed\n'
  )
  const error = t.throws(() => names({ cwd }))
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
      for (const run of [onesecret.config, onesecret.env]) {
        const processEnv = {}
        const error = t.throws(() =>
          run({ cwd, env, processEnv }, { allowKeyCommand: true })
        )
        t.is(error.code, 'EMISSING')
        t.regex(error.message, /API_TOKEN, S3_KEY, PORT, PUBLIC_unencrypted/)
        t.deepEqual(processEnv, {})
      }
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
  t.throws(() => load({ cwd, keyCommand: failing }))
  t.throws(() => load({ cwd, keyCommand: failing }))
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
      path.join(cwd, 'config', 'default.enc.yml'),
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
        t.is(load({ cwd }).S3_KEY, 'AKIA-default')
      }
    )
  }
)

test.serial('a broken key names its source and carries a code', t => {
  const cwd = project({ fixture: 'app' })
  withEnv({ SOPS_AGE_KEY: 'AGE-SECRET-KEY-1INVALID' }, () => {
    const error = t.throws(() => load({ cwd }))
    t.is(error.code, 'EKEY')
    t.regex(error.message, /SOPS_AGE_KEY holds an invalid age key/)
  })
})

test.serial(
  'a broken keys file does not block a valid key from another source',
  t => {
    const cwd = project({ fixture: 'app' })
    const xdg = temporaryDir('xdg')
    fs.mkdirSync(path.join(xdg, 'sops', 'age'), { recursive: true })
    fs.writeFileSync(
      path.join(xdg, 'sops', 'age', 'keys.txt'),
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample user@host\n'
    )
    withEnv({ XDG_CONFIG_HOME: xdg, SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      t.is(load({ cwd }).S3_KEY, 'AKIA-default')
    })
    withEnv({ XDG_CONFIG_HOME: xdg }, () => {
      const error = t.throws(() => load({ cwd }))
      t.is(error.code, 'EKEY')
      t.regex(error.message, /keys\.txt holds an invalid age key/)
    })
    withEnv(
      { XDG_CONFIG_HOME: xdg, SOPS_AGE_KEY: age.generateIdentity() },
      () => {
        const error = t.throws(() => load({ cwd }))
        t.is(error.code, 'EKEY')
        t.regex(error.message, /skipped: .*keys\.txt holds an invalid age key/)
        t.is(error.message.match(/onesecret:/g).length, 1)
      }
    )
  }
)

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
      path.join(cwd, 'config', 'default.enc.yml'),
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
      onesecret.env({ cwd, processEnv })
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

const writePlain = (cwd, name, text) =>
  fs.writeFileSync(path.join(cwd, 'config', name), text)

const layeredProject = () => {
  const cwd = project({ fixture: 'app' })
  writePlain(
    cwd,
    'default.yml',
    'LOG_LEVEL: debug\nTIMEOUT: 60000\nAPI_TOKEN: plain-default\nPORT: 1\nhosts: [a, b]\ndatabase:\n  pool: 5\n  ssl: false\n'
  )
  writePlain(
    cwd,
    'production.yml',
    'LOG_LEVEL: info\nS3_KEY: plain-production\nDATABASE_URL: postgres://plain\nhosts: [c]\ndatabase:\n  ssl: true\n'
  )
  return cwd
}

const configIn = (cwd, call, env = {}) => {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [
      '-e',
      `console.log(JSON.stringify(require(${JSON.stringify(
        path.join(__dirname, '..', 'src')
      )}).${call}))`
    ],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, SOPS_AGE_KEY: FIXTURE_KEY, ...env }
    }
  )
  if (status !== 0) throw new Error(stderr)
  return JSON.parse(stdout)
}

test('config takes the env as its only argument, NODE_ENV by default', t => {
  const cwd = layeredProject()
  const production = configIn(cwd, "config('production')")
  t.is(production.DATABASE_URL, 'postgres://fixture-production')
  t.is(production.LOG_LEVEL, 'info')
  t.deepEqual(configIn(cwd, 'config()', { NODE_ENV: 'production' }), production)
  t.deepEqual(configIn(cwd, "config({ env: 'production' })"), production)
  t.is(configIn(cwd, 'config()').LOG_LEVEL, 'debug')
})

test.serial(
  'plain and encrypted layers merge as default.yml, default.enc.yml, env.yml, env.enc.yml',
  t => {
    const cwd = layeredProject()
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      const processEnv = { LOG_LEVEL: 'from-env' }
      const values = onesecret.config({ cwd, env: 'production', processEnv })
      t.deepEqual(values, {
        LOG_LEVEL: 'from-env',
        TIMEOUT: 60000,
        API_TOKEN: 'Bearer production-token',
        PORT: 3000,
        hosts: ['c'],
        database: { pool: 5, ssl: true },
        S3_KEY: 'plain-production',
        PUBLIC_unencrypted: 'visible',
        DATABASE_URL: 'postgres://fixture-production'
      })
      onesecret.env({ cwd, env: 'production', processEnv })
      t.is(processEnv.TIMEOUT, '60000')
      t.is(processEnv.LOG_LEVEL, 'from-env')
      t.false(Object.hasOwn(processEnv, 'database'))
      t.deepEqual(load({ cwd, env: 'production' }), {
        ...values,
        LOG_LEVEL: 'info'
      })
      t.deepEqual(names({ cwd, env: 'production' }), [
        'API_TOKEN',
        'PORT',
        'PUBLIC_unencrypted',
        'DATABASE_URL'
      ])
    })
  }
)

test.serial('plain values never need the key', t => {
  const cwd = layeredProject()
  const processEnv = {
    API_TOKEN: 'x',
    PORT: '3000',
    PUBLIC_unencrypted: 'visible',
    DATABASE_URL: 'postgres://injected'
  }
  const values = onesecret.config({ cwd, env: 'production', processEnv })
  t.is(values.LOG_LEVEL, 'info')
  onesecret.env({ cwd, env: 'production', processEnv })
  t.is(processEnv.LOG_LEVEL, 'info')
  t.is(values.S3_KEY, 'plain-production')
  t.is(values.PORT, 3000)
  t.is(values.DATABASE_URL, 'postgres://injected')
  t.deepEqual(values.database, { pool: 5, ssl: true })
})

test.serial('ONESECRET_SKIP still loads the plain layers', t => {
  const cwd = layeredProject()
  withEnv({}, () => {
    const processEnv = { ONESECRET_SKIP: '1' }
    const values = onesecret.config({ cwd, env: 'production', processEnv })
    t.is(values.LOG_LEVEL, 'info')
    onesecret.env({ cwd, env: 'production', processEnv })
    t.is(processEnv.TIMEOUT, '60000')
    for (const name of ['DATABASE_URL', 'API_TOKEN', 'PORT']) {
      t.false(Object.hasOwn(values, name), name)
      t.false(Object.hasOwn(processEnv, name), name)
    }
    t.is(values.S3_KEY, 'plain-production')
  })
  withEnv({ ONESECRET_SKIP: '1' }, () => {
    t.deepEqual(onesecret.config({ cwd: temporaryDir('empty') }), {})
  })
  t.deepEqual(
    onesecret.config({
      cwd: temporaryDir('empty'),
      processEnv: { ONESECRET_SKIP: '1' }
    }),
    {}
  )
})

test('a plain layer alone is enough, in YAML or JSON', t => {
  const cwd = temporaryDir('plain-only')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.json', '{"PORT": 3000, "FLAG": true}')
  writePlain(cwd, 'test.yaml', 'FLAG: false\n')
  const processEnv = {}
  t.deepEqual(onesecret.config({ cwd, env: 'test', processEnv }), {
    PORT: 3000,
    FLAG: false
  })
  t.deepEqual(processEnv, {})
  onesecret.env({ cwd, env: 'test', processEnv })
  t.deepEqual(processEnv, { PORT: '3000', FLAG: 'false' })
  t.deepEqual(names({ cwd, env: 'test' }), [])
})

test('a plain layer cannot pollute prototypes and must be a mapping', t => {
  const cwd = temporaryDir('plain-proto')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(
    cwd,
    'default.json',
    '{"__proto__": {"polluted": true}, "nested": {"__proto__": {"polluted": true}}}'
  )
  const processEnv = {}
  const values = onesecret.config({ cwd, processEnv })
  t.is({}.polluted, undefined)
  t.is(values.polluted, undefined)
  t.false(Object.hasOwn(values, '__proto__'))
  t.false(Object.hasOwn(values.nested, '__proto__'))
  t.false(Object.hasOwn(processEnv, '__proto__'))
  writePlain(cwd, 'default.json', '[1, 2]')
  const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.is(error.code, 'EFORMAT')
  t.regex(error.message, /default\.json must be a mapping/)
  writePlain(cwd, 'default.json', '{')
  t.is(t.throws(() => load({ cwd })).code, 'EFORMAT')
})

test('config returns the same types on every call', t => {
  const cwd = temporaryDir('stable-types')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.yml', 'FLAG: false\nTIMEOUT: 60000\nEMPTY: null\n')
  const processEnv = {}
  const first = onesecret.config({ cwd, processEnv })
  t.deepEqual(onesecret.config({ cwd, processEnv }), first)
  t.deepEqual(first, { FLAG: false, TIMEOUT: 60000, EMPTY: null })
  processEnv.TIMEOUT = '1000'
  t.is(onesecret.config({ cwd, processEnv }).TIMEOUT, '1000')
})

test('empty and comment-only plain files are empty layers', t => {
  const cwd = temporaryDir('empty-plain')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.yml', 'A: 1\n')
  for (const text of ['', '# nothing yet\n', '~\n']) {
    writePlain(cwd, 'production.yml', text)
    t.deepEqual(onesecret.config({ cwd, env: 'production', processEnv: {} }), {
      A: 1
    })
  }
  writePlain(cwd, 'production.yml', 'A: 1\n---\nB: 2\n')
  t.regex(
    t.throws(() => load({ cwd, env: 'production' })).message,
    /single YAML document/
  )
})

const encryptedProject = (layers, plain = {}) => {
  const sops = require('../src/sops')
  const store = require('../src/store')
  const recipient = age.recipientOf(FIXTURE_KEY)
  const cwd = temporaryDir('encrypted')
  for (const [layer, tree] of Object.entries(layers)) {
    store.writeDocument(
      path.join(cwd, 'config', `${layer}.enc.yml`),
      sops.encrypt(tree, { recipients: [recipient] })
    )
  }
  for (const [name, text] of Object.entries(plain)) writePlain(cwd, name, text)
  return cwd
}

test('a plain mapping on top turns a secret into plain config', t => {
  const cwd = encryptedProject(
    { default: { API: 's' } },
    { 'production.yml': 'API:\n  a: 1\n' }
  )
  t.deepEqual(names({ cwd, env: 'production' }), [])
  t.deepEqual(onesecret.config({ cwd, env: 'production', processEnv: {} }), {
    API: { a: 1 }
  })
})

test('a nested secret that is missing is refused, and skip leaves it unset', t => {
  const cwd = encryptedProject(
    { default: { db: { pass: 'p' } } },
    { 'default.yml': 'db:\n  host: h\nPORT: 1\n' }
  )
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
    t.is(error.code, 'EFORMAT')
    t.regex(error.message, /"db" in .*default\.enc\.yml has type mapping/)
    t.notRegex(error.message, /pass|"p"/)
    t.deepEqual(load({ cwd }).db, { host: 'h', pass: 'p' })
  })
  const skipping = { ONESECRET_SKIP: '1' }
  t.deepEqual(onesecret.config({ cwd, processEnv: skipping }), { PORT: 1 })
  onesecret.env({ cwd, processEnv: skipping })
  t.deepEqual(skipping, { ONESECRET_SKIP: '1', PORT: '1' })
})

test('a secret from the environment comes back with the type in its file', t => {
  const cwd = encryptedProject({
    default: {
      PORT_S: 123,
      RATIO: 1.5,
      ON: true,
      BIG: 9007199254740993n,
      NAME: '123'
    }
  })
  const processEnv = {
    PORT_S: '123',
    RATIO: '1.5',
    ON: 'true',
    BIG: '9007199254740993',
    NAME: '123'
  }
  t.deepEqual(onesecret.config({ cwd, processEnv }), {
    PORT_S: 123,
    RATIO: 1.5,
    ON: true,
    BIG: 9007199254740993n,
    NAME: '123'
  })
  const odd = { PORT_S: '0x10', RATIO: '1e3', ON: 'yes', BIG: '1', NAME: 'x' }
  t.deepEqual(onesecret.config({ cwd, processEnv: odd }), {
    PORT_S: '0x10',
    RATIO: '1e3',
    ON: 'yes',
    BIG: 1,
    NAME: 'x'
  })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    const decrypting = {}
    const first = onesecret.config({ cwd, processEnv: decrypting })
    t.deepEqual(onesecret.config({ cwd, processEnv: decrypting }), first)
  })
})

test('a sops file named like a plain file is refused, and so are two files for one layer', t => {
  const cwd = encryptedProject({ default: { API: 's' } })
  fs.renameSync(
    path.join(cwd, 'config', 'default.enc.yml'),
    path.join(cwd, 'config', 'default.yml')
  )
  const encrypted = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.is(encrypted.code, 'EFORMAT')
  t.regex(
    encrypted.message,
    /default\.yml is encrypted with sops, rename it to default\.enc\.yml/
  )
  const both = temporaryDir('both')
  fs.mkdirSync(path.join(both, 'config'))
  writePlain(both, 'default.yml', 'A: 1\n')
  writePlain(both, 'default.json', '{"A": 2}')
  const twice = t.throws(() => onesecret.config({ cwd: both, processEnv: {} }))
  t.is(twice.code, 'EFORMAT')
  t.regex(
    twice.message,
    /default\.yml and default\.json both hold the default layer/
  )
})

test('the env defaults to development, and an explicit env beats NODE_ENV', t => {
  const cwd = temporaryDir('envs')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.yml', 'WHO: default\n')
  writePlain(cwd, 'development.yml', 'WHO: development\n')
  writePlain(cwd, 'production.yml', 'WHO: production\n')
  withEnv({ NODE_ENV: undefined }, () => {
    t.is(onesecret.config({ cwd, processEnv: {} }).WHO, 'development')
  })
  withEnv({ NODE_ENV: 'development' }, () => {
    t.is(
      onesecret.config({ cwd, env: 'production', processEnv: {} }).WHO,
      'production'
    )
    t.is(
      onesecret.config({ cwd, processEnv: { NODE_ENV: 'production' } }).WHO,
      'production'
    )
  })
})

test('null becomes an empty variable and only ONESECRET_SKIP=1 skips', t => {
  const cwd = encryptedProject(
    { default: { TOKEN: 'secret' } },
    { 'default.yml': 'EMPTY: null\n' }
  )
  const processEnv = { ONESECRET_SKIP: 'true' }
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    t.is(onesecret.config({ cwd, processEnv }).TOKEN, 'secret')
    onesecret.env({ cwd, processEnv })
  })
  t.is(processEnv.EMPTY, '')
  t.is(
    t.throws(() =>
      onesecret.config({ cwd, processEnv: { ONESECRET_SKIP: '0' } })
    ).code,
    'EMISSING'
  )
})

test('a damaged file is reported as such, not as a missing key', t => {
  const cwd = encryptedProject({ default: { TOKEN: 'secret' } })
  const file = path.join(cwd, 'config', 'default.enc.yml')
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, 'utf8')
      .replace(
        /mac: ENC\[AES256_GCM,data:(.)/,
        (_, first) => `mac: ENC[AES256_GCM,data:${first === 'A' ? 'B' : 'A'}`
      )
  )
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
    t.not(error.code, 'EMISSING')
  })
})

test.serial(
  'the public config never runs keyCommand in production, whatever the options say',
  t => {
    const { command, calls } = keyCommandPrinting(FIXTURE_KEY)
    const cwd = encryptedProject({ default: { TOKEN: 'secret' } })
    const error = t.throws(() =>
      onesecret.config({
        cwd,
        env: 'production',
        keyCommand: command,
        allowKeyCommand: true,
        processEnv: {}
      })
    )
    t.is(error.code, 'EMISSING')
    t.is(calls(), 0)
  }
)

test('a plain mapping merged into an encrypted one keeps the name a secret, whatever else env has', t => {
  const cwd = encryptedProject(
    { default: { DB: { pass: 's3cret' }, TOKEN: 't' } },
    { 'production.yml': 'DB:\n  host: h\n' }
  )
  t.deepEqual(names({ cwd, env: 'production' }), ['DB', 'TOKEN'])
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    for (const processEnv of [{}, { TOKEN: 't' }]) {
      const error = t.throws(() =>
        onesecret.config({ cwd, env: 'production', processEnv })
      )
      t.is(error.code, 'EFORMAT')
    }
    t.deepEqual(load({ cwd, env: 'production' }).DB, {
      pass: 's3cret',
      host: 'h'
    })
  })
  t.false(
    Object.hasOwn(
      onesecret.config({
        cwd,
        env: 'production',
        processEnv: { ONESECRET_SKIP: '1' }
      }),
      'DB'
    )
  )
})

test('a secret from env keeps its sops type whether or not another secret is decrypted', t => {
  const cwd = encryptedProject({ default: { PORT: 3000, ON: false, T: 't' } })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    for (const extra of [{}, { T: 't' }]) {
      const values = onesecret.config({
        cwd,
        processEnv: { PORT: '4000', ON: 'false', ...extra }
      })
      t.is(values.PORT, 4000)
      t.is(values.ON, false)
    }
  })
})

test('the returned object is writable', t => {
  const cwd = temporaryDir('writable')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.yml', 'A: 1\n')
  const values = onesecret.config({ cwd, processEnv: {} })
  values.A = 2
  t.is(values.A, 2)
})

test('plain parse errors name the place without echoing the content', t => {
  const cwd = temporaryDir('parse-errors')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.yml', 'A: 1\nPASSWORD: [hunter2\n')
  const yamlError = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.is(yamlError.code, 'EFORMAT')
  t.regex(yamlError.message, /default\.yml: .* at line \d+, column \d+$/)
  t.notRegex(yamlError.message, /hunter2/)
  fs.rmSync(path.join(cwd, 'config', 'default.yml'))
  writePlain(cwd, 'default.json', '{"PASSWORD": hunter2}')
  const jsonError = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.regex(jsonError.message, /default\.json: not valid JSON$/)
  for (const blank of ['', '  \n']) {
    writePlain(cwd, 'default.json', blank)
    t.deepEqual(onesecret.config({ cwd, processEnv: {} }), {})
  }
})

test('an env name cannot leave the config directory', t => {
  const cwd = temporaryDir('env-names')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.yml', 'A: 1\n')
  for (const env of [
    '../etc/evil',
    'a/b',
    'a\\b',
    '..',
    '.hidden',
    'Staging'
  ]) {
    const error = t.throws(() => onesecret.config({ cwd, env, processEnv: {} }))
    t.is(error.code, 'EVALUE', env)
  }
  t.deepEqual(onesecret.config({ cwd, env: 'staging.eu-1', processEnv: {} }), {
    A: 1
  })
})

test('a plain value is the same whether or not anything is decrypted', t => {
  const cwd = encryptedProject(
    { default: { X: 'secret', S: 'other' } },
    { 'default.yml': 'X:\n  a: 1\n', 'production.yml': 'X:\n  b: 2\n' }
  )
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    for (const processEnv of [{}, { S: 'x' }]) {
      t.deepEqual(onesecret.config({ cwd, env: 'production', processEnv }).X, {
        b: 2
      })
    }
    t.deepEqual(load({ cwd, env: 'production' }).X, { b: 2 })
  })
  t.deepEqual(
    onesecret.config({
      cwd,
      env: 'production',
      processEnv: { ONESECRET_SKIP: '1' }
    }).X,
    { b: 2 }
  )
})

test('a plain mapping replaces an encrypted list, so the name is plain', t => {
  const cwd = encryptedProject(
    { default: { L: ['x', 'y'], S: 's' } },
    { 'production.yml': 'L:\n  b: 2\n' }
  )
  t.deepEqual(names({ cwd, env: 'production' }), ['S'])
  t.deepEqual(
    onesecret.config({ cwd, env: 'production', processEnv: { S: 's' } }).L,
    { b: 2 }
  )
})

test('an encrypted file that is not a sops file is named', t => {
  const cwd = temporaryDir('not-sops')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.enc.yml', 'PASSWORD: hunter2-secret\n')
  const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.is(error.code, 'EFORMAT')
  t.regex(error.message, /default\.enc\.yml: file is not encrypted with sops/)
  t.notRegex(error.message, /hunter2/)
  writePlain(cwd, 'default.enc.yml', 'PASSWORD: hunter2-secret\n  bad: x\n')
  const parse = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.regex(parse.message, /default\.enc\.yml: .* at line 2, column \d+$/)
  t.notRegex(parse.message, /hunter2/)
})

test('plain parse errors do not echo aliases or tags', t => {
  const cwd = temporaryDir('alias')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.yml', 'PASSWORD: *hunter2secret\n')
  const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.is(error.code, 'EFORMAT')
  t.notRegex(error.message, /hunter2/)
})

test('env names that look like files or are not lowercase are refused', t => {
  const cwd = encryptedProject({ default: { T: 's' } })
  for (const env of ['default.enc', 'prod.yml', 'x.json', 'a.enc.b']) {
    t.is(
      t.throws(() => onesecret.config({ cwd, env, processEnv: {} })).code,
      'EVALUE',
      env
    )
  }
  const { command, calls } = keyCommandPrinting(FIXTURE_KEY)
  for (const env of ['Production', 'DEFAULT']) {
    const error = t.throws(() =>
      onesecret.config({ cwd, env, keyCommand: command, processEnv: {} })
    )
    t.is(error.code, 'EVALUE')
    t.regex(error.message, /lowercase/)
  }
  t.is(calls(), 0)
})

test('a blank secret keeps its null type and a bytes secret is refused when missing', t => {
  const cwd = encryptedProject({ default: { EMPTY: null, T: 's' } })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    const processEnv = {}
    const first = onesecret.config({ cwd, processEnv })
    t.is(first.EMPTY, null)
    t.is(onesecret.config({ cwd, processEnv }).EMPTY, null)
  })
  const bytes = encryptedProject({ default: { B: Buffer.from('x') } })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    const error = t.throws(() =>
      onesecret.config({ cwd: bytes, processEnv: {} })
    )
    t.is(error.code, 'EFORMAT')
    t.regex(error.message, /"B" in .* has type bytes/)
  })
})

test('a YAML tag in a plain file is reported without its text', t => {
  const cwd = temporaryDir('plain-tag')
  fs.mkdirSync(path.join(cwd, 'config'))
  for (const text of ['DB_PASS: !Qw3rty2024\n', 'DB_PASS: !Qw3rty!2024\n']) {
    writePlain(cwd, 'production.yml', text)
    const error = t.throws(() =>
      onesecret.config({ cwd, env: 'production', processEnv: {} })
    )
    t.is(error.code, 'EFORMAT')
    t.notRegex(error.message, /Qw3rty/)
    t.regex(error.message, /at line 1, column \d+$/)
  }
})

test('no YAML error ever prints the text it failed on', t => {
  const leaks = [
    'DB_PASS: !Pa%ss-hunter2\n',
    'DB_PASS: !<hunter2 secret>\n',
    'DB_PASS: *hunter2\n',
    'DB_PASS: [hunter2\n'
  ]
  for (const text of leaks) {
    const plain = temporaryDir('leak-plain')
    fs.mkdirSync(path.join(plain, 'config'))
    writePlain(plain, 'default.yml', text)
    const encrypted = temporaryDir('leak-enc')
    fs.mkdirSync(path.join(encrypted, 'config'))
    writePlain(encrypted, 'default.enc.yml', text)
    for (const cwd of [plain, encrypted]) {
      const error = t.throws(
        () => onesecret.config({ cwd, processEnv: {} }),
        undefined,
        text
      )
      t.is(error.code, 'EFORMAT', text)
      t.notRegex(error.message, /hunter2|Pa%ss/, text)
    }
  }
})

test('tags are refused on keys, on collections, and when not a standard scalar tag', t => {
  const write = require('../src/write')
  for (const text of [
    '!foo B: x\n',
    '--- !foo\nA: 1\n',
    'A: !!foo bar\n',
    'A: !!binary aGVsbG8=\n',
    'A: !!map {}\n'
  ]) {
    const error = t.throws(() => write.fromEditableYaml(text), undefined, text)
    t.is(error.code, 'EVALUE', text)
  }
  t.deepEqual(write.fromEditableYaml('A: !!str 1\nB: !!int "2"\n'), {
    A: '1',
    B: 2
  })
})

test('a missing secret whose name can never be a variable is refused up front', t => {
  const cwd = encryptedProject({ default: { 'api-key': 's', T: 't' } })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    const error = t.throws(() =>
      onesecret.config({ cwd, processEnv: { T: 't' } })
    )
    t.is(error.code, 'EFORMAT')
    t.regex(
      error.message,
      /"api-key" .* cannot be an environment variable name/
    )
  })
})

test('a layer file whose name differs only in letter case is refused', t => {
  const cwd = temporaryDir('exact-case')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.yml', 'LOG_LEVEL: debug\n')
  for (const name of [
    'Production.yml',
    'production.YAML',
    'PRODUCTION.enc.yml'
  ]) {
    writePlain(cwd, name, 'LOG_LEVEL: info\n')
    const error = t.throws(() =>
      onesecret.config({ cwd, processEnv: { NODE_ENV: 'production' } })
    )
    t.is(error.code, 'EFORMAT', name)
    t.regex(
      error.message,
      new RegExp(`${name.replace('.', '\\.')} .* only in letter case`),
      name
    )
    fs.rmSync(path.join(cwd, 'config', name))
  }
})

test('an empty or comment-only encrypted file is an empty layer for config', t => {
  const cwd = encryptedProject({ default: { T: 's' } })
  for (const text of ['', '# soon\n']) {
    writePlain(cwd, 'staging.enc.yml', text)
    t.deepEqual(names({ cwd, env: 'staging' }), ['T'])
    t.deepEqual(
      onesecret.config({ cwd, env: 'staging', processEnv: { T: 's' } }),
      { T: 's' }
    )
  }
})

test('a standard tag whose value does not match it is refused', t => {
  const write = require('../src/write')
  for (const text of [
    'A: !!int abc\n',
    'A: !!bool yes\n',
    'A: !!null x\n',
    'A: !!float abc\n',
    'A: !!timestamp hello\n',
    'A: !!timestamp 2024-13-45\n'
  ]) {
    t.is(
      t.throws(() => write.fromEditableYaml(text), undefined, text).code,
      'EVALUE',
      text
    )
  }
  t.deepEqual(
    write.fromEditableYaml(
      'A: !!int 5\nB: !!bool true\nC: !!float 1.5\nD: !!null ~\n'
    ),
    { A: 5, B: true, C: 1.5, D: null }
  )
})

test('a set secret whose name is not a variable name comes back typed without throwing', t => {
  const cwd = encryptedProject({
    default: { 'api-port': 3000, 'api-ratio': 1.5 }
  })
  t.deepEqual(
    onesecret.config({
      cwd,
      processEnv: { 'api-port': '3000', 'api-ratio': '1.5' }
    }),
    { 'api-port': 3000, 'api-ratio': 1.5 }
  )
})

test('a case-variant file next to the exact one is refused where both can exist', t => {
  const cwd = temporaryDir('case-sibling')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'production.yml', 'A: 1\n')
  writePlain(cwd, 'Production.yml', 'A: 2\n')
  const names = fs.readdirSync(path.join(cwd, 'config'))
  if (names.length === 1) {
    return t.pass('case-insensitive filesystem holds one file')
  }
  const error = t.throws(() =>
    onesecret.config({ cwd, env: 'production', processEnv: {} })
  )
  t.is(error.code, 'EFORMAT')
  t.regex(error.message, /Production\.yml .* only in letter case/)
})

const countingDecrypts = run => {
  const sops = require('../src/sops')
  const decrypt = sops.decrypt
  let calls = 0
  sops.decrypt = (...args) => {
    calls++
    return decrypt(...args)
  }
  try {
    run()
  } finally {
    sops.decrypt = decrypt
  }
  return calls
}

test.serial('config returns the values and never writes the environment', t => {
  const cwd = encryptedProject(
    { default: { TOKEN: 'secret' } },
    { 'default.yml': 'PORT: 3000\n' }
  )
  const processEnv = { UNRELATED: 'kept' }
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    t.deepEqual(onesecret.config({ cwd, processEnv }), {
      PORT: 3000,
      TOKEN: 'secret'
    })
  })
  t.deepEqual(processEnv, { UNRELATED: 'kept' })
})

test.serial('config and env decrypt each file once per process', t => {
  const cwd = encryptedProject({
    default: { TOKEN: 'secret' },
    production: { OTHER: 'value' }
  })
  const processEnv = {}
  const calls = countingDecrypts(() =>
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      onesecret.config({ cwd, env: 'production', processEnv })
      onesecret.config({ cwd, env: 'production', processEnv })
      onesecret.env({ cwd, env: 'production', processEnv: {} })
      load({ cwd, env: 'production' })
    })
  )
  t.is(calls, 2)
})

test.serial('a cached decrypt never hides a missing or wrong key', t => {
  const cwd = encryptedProject({ default: { TOKEN: 'secret' } })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    t.is(onesecret.config({ cwd, processEnv: {} }).TOKEN, 'secret')
  })
  withEnv({ SOPS_AGE_KEY: undefined }, () => {
    t.is(
      t.throws(() => onesecret.config({ cwd, processEnv: {} })).code,
      'EMISSING'
    )
    t.is(t.throws(() => load({ cwd })).code, 'ENOKEY')
  })
  withEnv({ SOPS_AGE_KEY: OTHER_KEY }, () => {
    t.is(
      t.throws(() => onesecret.config({ cwd, processEnv: {} })).code,
      'EMISSING'
    )
  })
})

test.serial(
  'a value returned from the cache cannot change the next call',
  t => {
    const cwd = encryptedProject({
      default: { HOSTS: 'a', nested: { list: ['x'] } }
    })
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      load({ cwd }).nested.list.push('mutated')
      t.deepEqual(load({ cwd }).nested.list, ['x'])
    })
  }
)

test.serial(
  'env fails like config and writes nothing when a secret cannot be found',
  t => {
    const cwd = encryptedProject(
      { default: { TOKEN: 'secret' } },
      { 'default.yml': 'PORT: 3000\n' }
    )
    const processEnv = {}
    withEnv({ SOPS_AGE_KEY: undefined }, () => {
      const error = t.throws(() => onesecret.env({ cwd, processEnv }))
      t.is(error.code, 'EMISSING')
      t.regex(error.message, /TOKEN/)
    })
    t.deepEqual(processEnv, {})
  }
)

test.serial(
  'an unencrypted integer beyond 2^53 does not break config or the cache',
  t => {
    const cwd = temporaryDir('bigint-unencrypted')
    const sops = require('../src/sops')
    const store = require('../src/store')
    store.writeDocument(
      path.join(cwd, 'config', 'default.enc.yml'),
      sops.encrypt(
        { TOKEN: 'secret', ID_unencrypted: 9007199254740993n },
        {
          recipients: [age.recipientOf(FIXTURE_KEY)],
          unencryptedSuffix: '_unencrypted'
        }
      )
    )
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      const values = onesecret.config({ cwd, processEnv: {} })
      t.is(values.TOKEN, 'secret')
      t.is(values.ID_unencrypted, 9007199254740993n)
      t.is(
        onesecret.config({ cwd, processEnv: {} }).ID_unencrypted,
        9007199254740993n
      )
    })
  }
)

test.serial('a rewritten file is decrypted again in the same process', t => {
  const cwd = encryptedProject({ default: { TOKEN: 'first' } })
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
    t.is(onesecret.config({ cwd, processEnv: {} }).TOKEN, 'first')
    const sops = require('../src/sops')
    const store = require('../src/store')
    store.writeDocument(
      path.join(cwd, 'config', 'default.enc.yml'),
      sops.encrypt(
        { TOKEN: 'second' },
        { recipients: [age.recipientOf(FIXTURE_KEY)] }
      )
    )
    t.is(onesecret.config({ cwd, processEnv: {} }).TOKEN, 'second')
  })
})

const accessorProject = () => {
  const cwd = encryptedProject(
    { default: { TOKEN: 'secret' } },
    {
      'default.yml': [
        'ZERO: 0',
        'OFF: false',
        'EMPTY: ""',
        'NOTHING: null',
        'database:',
        '  pool: 5',
        '  ssl: false',
        'hosts: [a, b]',
        '"dotted.key": exact',
        ''
      ].join('\n')
    }
  )
  return withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () =>
    onesecret.config({ cwd, processEnv: {} })
  )
}

test.serial(
  'config().get reads dot paths, array indexes, and exact keys, with a fallback',
  t => {
    const config = accessorProject()
    t.is(config.get('TOKEN'), 'secret')
    t.is(config.get('database.pool'), 5)
    t.is(config.get('hosts.1'), 'b')
    t.is(config.get('dotted.key'), 'exact')
    t.is(config.get('database.missing', 10), 10)
    t.is(config.get('database.pool.deeper'), undefined)
    t.is(config.get('ZERO', 99), 0)
    t.is(config.get('NOTHING', 'fallback'), null)
  }
)

test.serial(
  'config().has counts 0, false, empty, and null as set, and ignores the prototype',
  t => {
    const config = accessorProject()
    for (const path of [
      'ZERO',
      'OFF',
      'EMPTY',
      'NOTHING',
      'database.ssl',
      'hosts.0'
    ]) {
      t.true(config.has(path), path)
    }
    for (const path of [
      'MISSING',
      'database.missing',
      'constructor',
      'toString',
      '__proto__',
      'database.constructor',
      'hosts.length',
      'get',
      'has',
      'require',
      'required'
    ]) {
      t.false(config.has(path), path)
    }
  }
)

test.serial(
  'config().require returns falsy values and throws naming the path and env',
  t => {
    const config = accessorProject()
    t.is(config.require('OFF'), false)
    t.is(config.require('database.pool'), 5)
    const error = t.throws(() => config.require('database.url'))
    t.is(error.code, 'EMISSING')
    t.regex(
      error.message,
      /"database\.url" is required but not set in the "development" config/
    )
  }
)

test.serial('config().required throws on destructuring a missing name', t => {
  const config = accessorProject()
  const { TOKEN, ZERO } = config.required
  t.deepEqual([TOKEN, ZERO], ['secret', 0])
  t.is(
    t.throws(() => {
      const { MISSING } = config.required
      return MISSING
    }).code,
    'EMISSING'
  )
  t.notThrows(() => require('node:util').inspect(config.required))
})

test.serial('the accessors stay out of keys, spread, and JSON', t => {
  const config = accessorProject()
  for (const name of ['get', 'has', 'require', 'required']) {
    t.false(Object.keys(config).includes(name), name)
    t.false(Object.hasOwn({ ...config }, name), name)
  }
  t.false(JSON.stringify(config).includes('"get"'))
})

test.serial('a config name that collides with an accessor is refused', t => {
  const cwd = temporaryDir('reserved-name')
  fs.mkdirSync(path.join(cwd, 'config'))
  writePlain(cwd, 'default.yml', 'get: 1\nrequired: 2\nPORT: 3\n')
  const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
  t.is(error.code, 'EFORMAT')
  t.regex(error.message, /"get", "required" cannot be a config name/)
  const processEnv = {}
  t.notThrows(() => onesecret.env({ cwd, processEnv }))
  t.is(processEnv.PORT, '3')
})

test.serial(
  'config().get takes array paths and refuses other path types',
  t => {
    const config = accessorProject()
    t.is(config.get(['database', 'pool']), 5)
    t.is(config.get(['dotted.key']), 'exact')
    t.is(config.get(['hosts', 0]), 'a')
    for (const path of [undefined, null, {}, () => {}]) {
      t.is(t.throws(() => config.get(path)).code, 'EUSAGE')
      t.is(t.throws(() => config.require(path)).code, 'EUSAGE')
    }
    t.is(
      t.throws(() => {
        const { get } = config.required
        return get
      }).code,
      'EMISSING'
    )
  }
)

test.serial('an unreadable encrypted file fails with EFORMAT naming it', t => {
  if (process.getuid?.() === 0) return t.pass()
  const cwd = encryptedProject({ default: { TOKEN: 'secret' } })
  const file = path.join(cwd, 'config', 'default.enc.yml')
  fs.chmodSync(file, 0o000)
  try {
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      const error = t.throws(() => onesecret.config({ cwd, processEnv: {} }))
      t.is(error.code, 'EFORMAT')
      t.regex(error.message, /cannot read .*default\.enc\.yml: EACCES/)
    })
  } finally {
    fs.chmodSync(file, 0o600)
  }
})
