'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { default: test } = require('ava')
const yaml = require('js-yaml')
const { render } = require('../src/cli')
const {
  FIXTURE_KEY,
  cli: rawCli,
  fakeBinary,
  project,
  temporaryDir
} = require('./helpers')

const withKey = { SOPS_AGE_KEY: FIXTURE_KEY }

const FLAGS_WITH_VALUE = ['--env', '-e', '--dir', '--cwd']

const setThroughStdin = (args, options) => {
  const flags = []
  const pairs = []
  for (let i = 1; i < args.length; i++) {
    if (FLAGS_WITH_VALUE.includes(args[i])) {
      flags.push(args[i], args[++i])
      continue
    }
    const separator = args[i].indexOf('=')
    if (separator === -1) {
      throw new Error(`setThroughStdin needs NAME=value, got ${args[i]}`)
    }
    pairs.push([args[i].slice(0, separator), args[i].slice(separator + 1)])
  }
  let result
  for (const [name, value] of pairs) {
    result = rawCli(['set', ...flags, name], { ...options, input: value })
    if (result.code !== 0) return result
  }
  return result
}

const cli = (args, options) =>
  args[0] === 'set' && args.slice(1).some(arg => arg.includes('='))
    ? setThroughStdin(args, options)
    : rawCli(args, options)

const recipientsIn = file =>
  yaml
    .load(fs.readFileSync(file, 'utf8'))
    .sops.age.map(({ recipient }) => recipient)

const init = (cwd, env, args = []) => {
  const result = cli(['init', ...args], { cwd, env })
  const [key] = result.stdout.match(/AGE-SECRET-KEY-1\w+/) || []
  if (key) env.SOPS_AGE_KEY = key
  return result
}

const freshHome = () => {
  const home = temporaryDir('cli-home')
  return { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config') }
}

test('init prints a new key without saving it, writes only an empty default layer, then leaves it alone', t => {
  const cwd = temporaryDir('init')
  const env = freshHome()
  const first = cli(['init'], { cwd, env })
  t.is(first.code, 0, first.stderr)
  const recipient = first.stdout.match(/age1\w+/)[0]
  const [key] = first.stdout.match(/AGE-SECRET-KEY-1\w+/)
  t.is(require('../src/age').recipientOf(key), recipient)
  t.regex(first.stdout, new RegExp(`^  export SOPS_AGE_KEY=${key}$`, 'm'))
  t.false(fs.existsSync(path.join(env.XDG_CONFIG_HOME, 'sops')))
  t.false(fs.existsSync(path.join(env.HOME, 'Library')))
  t.false(fs.existsSync(path.join(cwd, '.sops.yaml')))
  t.deepEqual(fs.readdirSync(cwd), ['config'])
  t.deepEqual(recipientsIn(path.join(cwd, 'config', 'default.enc.yml')), [
    recipient
  ])
  t.is(cli(['set', 'A=1'], { cwd, env }).code, 1)
  t.is(cli(['set', 'A=1'], { cwd, env: { ...env, SOPS_AGE_KEY: key } }).code, 0)

  const again = cli(['init'], { cwd, env })
  t.is(
    again.stdout,
    `already initialized for ${recipient} (config/default.enc.yml)`
  )
})

test('set, get, ls, unset, and dotenv work across layers', t => {
  const cwd = temporaryDir('layers')
  const env = freshHome()
  init(cwd, env)
  t.is(
    cli(['set', 'TOKEN=a=b', 'URL=http://dev'], { cwd, env }).stdout,
    'config/default.enc.yml encrypted'
  )
  t.is(
    cli(['set', '--env', 'production', 'URL=http://prod'], { cwd, env }).code,
    0
  )
  t.is(cli(['get', 'TOKEN'], { cwd, env }).stdout, 'a=b')
  t.is(cli(['get', 'URL'], { cwd, env }).stdout, 'http://dev')
  t.is(
    cli(['get', 'URL', '-e', 'production'], { cwd, env }).stdout,
    'http://prod'
  )
  t.is(
    cli(['get', 'URL'], { cwd, env: { ...env, NODE_ENV: 'production' } })
      .stdout,
    'http://prod'
  )
  t.is(
    cli(['dotenv', '-e', 'production'], { cwd, env }).stdout,
    'TOKEN=a=b\nURL=http://prod'
  )
  t.is(cli(['unset', 'TOKEN'], { cwd, env }).code, 0)
  t.is(cli(['ls'], { cwd, env }).stdout, 'URL')
  t.regex(
    cli(['unset', 'TOKEN'], { cwd, env }).stderr,
    /"TOKEN" is not in the default layer/
  )
  t.regex(
    cli(['get', 'NOPE'], { cwd, env }).stderr,
    /"NOPE" is not set in any layer/
  )
  t.regex(cli(['set', 'NOEQUALS'], { cwd, env }).stderr, /no value on stdin/)
  t.is(cli(['set', 'NOTE_unencrypted=public'], { cwd, env }).code, 0)
  t.true(
    fs
      .readFileSync(path.join(cwd, 'config', 'default.enc.yml'), 'utf8')
      .includes('NOTE_unencrypted: public')
  )
})

test('ls works without the key and get explains how to provide one', t => {
  const cwd = project({ fixture: 'app' })
  t.is(
    cli(['ls', '-e', 'production'], { cwd }).stdout,
    'API_TOKEN\nS3_KEY\nPORT\nPUBLIC_unencrypted\nDATABASE_URL'
  )
  const result = cli(['get', 'API_TOKEN'], { cwd })
  t.is(result.code, 1)
  t.regex(result.stderr, /no age key found/)
})

test('without .sops.yaml, a new layer takes the recipients of the default layer', t => {
  const cwd = project({ fixture: 'app' })
  t.is(cli(['set', 'NEW=1'], { cwd, env: withKey }).code, 0)
  t.is(cli(['get', 'NEW'], { cwd, env: withKey }).stdout, '1')
  const other = require('../src/age').generateIdentity()
  const result = cli(['set', '-e', 'staging', 'A=1'], {
    cwd,
    env: { SOPS_AGE_KEY: other }
  })
  t.is(result.code, 0, result.stderr)
  t.deepEqual(
    recipientsIn(path.join(cwd, 'config', 'staging.enc.yml')),
    recipientsIn(path.join(cwd, 'config', 'default.enc.yml'))
  )
  t.is(cli(['get', '-e', 'staging', 'A'], { cwd, env: withKey }).stdout, '1')
})

test('rekey re-encrypts with the .sops.yaml recipients', t => {
  const cwd = project({ fixture: 'app' })
  const newKey = require('../src/age').generateIdentity()
  const newRecipient = require('../src/age').recipientOf(newKey)
  fs.writeFileSync(
    path.join(cwd, '.sops.yaml'),
    `creation_rules:\n  - path_regex: config/.*\n    age: ${newRecipient}\n`
  )
  t.is(cli(['rekey'], { cwd, env: withKey }).code, 0)
  t.is(
    cli(['get', 'S3_KEY'], { cwd, env: { SOPS_AGE_KEY: newKey } }).stdout,
    'AKIA-default'
  )
  t.is(cli(['get', 'S3_KEY'], { cwd, env: withKey }).code, 1)
  t.regex(
    cli(['rekey', '-e', 'staging'], { cwd, env: withKey }).stderr,
    /does not exist/
  )
})

test('edit opens the decrypted layer and encrypts what the editor saved', t => {
  const cwd = project({ fixture: 'app' })
  const editor = fakeBinary(
    'editor',
    "const fs = require('fs'); const file = process.argv[2]; fs.appendFileSync(file, 'ADDED: from-editor\\n')"
  ).file
  t.is(
    cli(['edit'], { cwd, env: { ...withKey, EDITOR: editor } }).stdout,
    'config/default.enc.yml encrypted'
  )
  t.is(cli(['get', 'ADDED'], { cwd, env: withKey }).stdout, 'from-editor')
  t.is(cli(['get', 'S3_KEY'], { cwd, env: withKey }).stdout, 'AKIA-default')

  const noop = fakeBinary('noop-editor', '').file
  t.regex(
    cli(['edit'], { cwd, env: { ...withKey, EDITOR: noop } }).stdout,
    /unchanged/
  )
  const failing = fakeBinary('failing-editor', 'process.exit(1)').file
  t.regex(
    cli(['edit'], { cwd, env: { ...withKey, EDITOR: failing } }).stderr,
    /exited without saving/
  )
  const broken = fakeBinary(
    'list-editor',
    "require('fs').writeFileSync(process.argv[2], '- a\\n')"
  ).file
  const aborted = cli(['edit'], { cwd, env: { ...withKey, EDITOR: broken } })
  t.regex(aborted.stderr, /must be a mapping/)
  t.regex(aborted.stderr, /edit aborted/)
})

test('exec runs the command with the secrets and without the key', t => {
  const cwd = project({ fixture: 'app' })
  const script =
    'console.log(JSON.stringify({ db: process.env.DATABASE_URL, key: process.env.SOPS_AGE_KEY ?? null }))'
  const result = cli(
    ['exec', '-e', 'production', '--', process.execPath, '-e', script],
    { cwd, env: withKey }
  )
  t.deepEqual(JSON.parse(result.stdout), {
    db: 'postgres://fixture-production',
    key: null
  })
})

test('exec forwards the exit code and reports a missing command', t => {
  const cwd = project({ fixture: 'app' })
  t.is(
    cli(['exec', '--', process.execPath, '-e', 'process.exit(7)'], {
      cwd,
      env: withKey
    }).code,
    7
  )
  t.regex(
    cli(['exec', '--', '/nonexistent/cmd'], { cwd, env: withKey }).stderr,
    /cannot run \/nonexistent\/cmd/
  )
  t.regex(
    cli(['exec'], { cwd, env: withKey }).stderr,
    /exec needs a command after --/
  )
})

test('help, version, and usage errors', t => {
  t.regex(cli(['--help']).stdout, /^Usage/)
  t.regex(cli([]).stdout, /^Usage/)
  t.is(cli(['--version']).stdout, require('../package.json').version)
  const unknown = cli(['nope'])
  t.is(unknown.code, 1)
  t.regex(unknown.stderr, /unknown command "nope"/)
  t.regex(cli(['set']).stderr, /set takes one NAME/)
  t.regex(cli(['unset']).stderr, /unset needs at least one NAME/)
  t.regex(cli(['get']).stderr, /get needs exactly one NAME/)
})

test('an invalid save never prints the decrypted file and reopens the editor with the edits kept', t => {
  const cwd = project({ fixture: 'app' })
  const attempts = path.join(temporaryDir('attempts'), 'count')
  const editor = fakeBinary(
    'fixing-editor',
    `const fs = require('fs')
const file = process.argv[2]
const attempt = fs.existsSync(${JSON.stringify(attempts)}) ? 2 : 1
fs.writeFileSync(${JSON.stringify(attempts)}, String(attempt))
if (attempt === 1) fs.appendFileSync(file, 'BROKEN: [unclosed\\n')
else fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('BROKEN: [unclosed', 'FIXED: yes'))`
  ).file
  const result = cli(['edit'], { cwd, env: { ...withKey, EDITOR: editor } })
  t.is(result.code, 0, result.stderr)
  t.regex(result.stderr, /not valid YAML: .* at line \d+/)
  t.notRegex(result.stderr, /AKIA-default|Bearer/)
  t.is(cli(['get', 'FIXED'], { cwd, env: withKey }).stdout, 'yes')
})

test('set refuses names that would break the file or the environment', t => {
  const cwd = project({ fixture: 'app' })
  t.regex(
    cli(['set', 'sops=oops'], { cwd, env: withKey }).stderr,
    /"sops" is reserved/
  )
  t.regex(
    cli(['set', 'BAD-NAME=x'], { cwd, env: withKey }).stderr,
    /not a valid environment variable name/
  )
  t.is(
    cli(['get', 'API_TOKEN'], { cwd, env: withKey }).stdout,
    'Bearer default #token'
  )
})

test('set refuses to store a value in plaintext because of the file rules', t => {
  const cwd = temporaryDir('regex-rules')
  const env = freshHome()
  init(cwd, env)
  const sops = require('../src/sops')
  const store = require('../src/store')
  const recipient = require('../src/age').recipientOf(env.SOPS_AGE_KEY)
  store.writeDocument(
    path.join(cwd, 'config', 'default.enc.yml'),
    sops.encrypt(
      { PASSWORD: 'x' },
      { recipients: [recipient], rules: { encrypted_regex: '^PASS' } }
    )
  )
  const result = cli(['set', 'STRIPE_KEY=sk_live_abc'], { cwd, env })
  t.is(result.code, 1)
  t.regex(
    result.stderr,
    /"STRIPE_KEY" would be stored in plaintext because of the file's encrypted_regex rule/
  )
  t.false(
    fs
      .readFileSync(path.join(cwd, 'config', 'default.enc.yml'), 'utf8')
      .includes('sk_live_abc')
  )
  t.is(cli(['set', 'PASSWORD=y'], { cwd, env }).code, 0)
  t.is(cli(['set', 'NOTE_unencrypted=public'], { cwd, env }).code, 1)
})

test('rekey keeps the encryption rules of the file', t => {
  const cwd = project({ fixture: 'app' })
  const sops = require('../src/sops')
  const store = require('../src/store')
  const file = path.join(cwd, 'config', 'default.enc.yml')
  store.writeDocument(
    file,
    sops.encrypt(
      { PASSWORD: 'x', USER: 'admin' },
      {
        recipients: [require('./helpers').FIXTURE_RECIPIENT],
        rules: { encrypted_regex: '^PASS' }
      }
    )
  )
  t.is(cli(['rekey'], { cwd, env: withKey }).code, 0)
  const document = store.readDocument(file)
  t.is(document.USER, 'admin')
  t.is(document.sops.encrypted_regex, '^PASS')
})

test('get only knows secrets, not object properties', t => {
  const cwd = project({ fixture: 'app' })
  const result = cli(['get', 'constructor'], { cwd, env: withKey })
  t.is(result.code, 1)
  t.regex(result.stderr, /"constructor" is not set in any layer/)
})

test('dotenv output reads back to the same values', t => {
  const cwd = temporaryDir('dotenv')
  const env = freshHome()
  init(cwd, env)
  const values = {
    HASH: 'abc#123',
    PADDED: ' padded ',
    QUOTED: '"quoted"',
    APOSTROPHE: "it's",
    PLAIN: 'two words'
  }
  cli(
    [
      'set',
      ...Object.entries(values).map(([name, value]) => `${name}=${value}`)
    ],
    { cwd, env }
  )
  const { stdout } = cli(['dotenv'], { cwd, env })
  t.deepEqual({ ...require('node:util').parseEnv(stdout) }, values)
})

test('dotenv --json prints the secrets as one JSON object, even values dotenv refuses', t => {
  const cwd = temporaryDir('dotenv-json')
  const env = freshHome()
  init(cwd, env)
  const values = {
    HASH: 'abc#123',
    PEM: '-----BEGIN KEY-----\nMIIB\n-----END KEY-----',
    UNQUOTABLE: "'ends with backslash\\"
  }
  cli(
    [
      'set',
      ...Object.entries(values).map(([name, value]) => `${name}=${value}`)
    ],
    { cwd, env }
  )
  t.regex(cli(['dotenv'], { cwd, env }).stderr, /UNQUOTABLE/)
  const result = cli(['dotenv', '--json'], { cwd, env })
  t.is(result.code, 0)
  t.deepEqual(JSON.parse(result.stdout), values)
})

test('get prints the exact value when piped, so stdin readers store no newline', t => {
  const cwd = temporaryDir('get-exact')
  const env = freshHome()
  init(cwd, env)
  cli(['set', 'PEM=line1\nline2'], { cwd, env })
  cli(['set', 'OTHER=x'], { cwd, env })
  t.is(cli(['get', 'PEM'], { cwd, env }).rawStdout, 'line1\nline2')
  t.is(cli(['ls'], { cwd, env }).rawStdout, 'PEM\nOTHER\n')
})

test('dotenv --json writes numbers as strings and refuses what dotenv refuses', t => {
  const cwd = temporaryDir('dotenv-json-types')
  const env = freshHome()
  init(cwd, env)
  fs.writeFileSync(path.join(cwd, 'config', 'default.yml'), 'PLAIN: 1\n')
  cli(['set', 'PORT=3000', 'ON=true'], { cwd, env })
  t.deepEqual(JSON.parse(cli(['dotenv', '--json'], { cwd, env }).stdout), {
    PORT: '3000',
    ON: 'true'
  })
})

test('dotenv and ls refuse an explicit --env with no layer, so a typo never pushes the default layer', t => {
  const cwd = temporaryDir('env-typo')
  const env = freshHome()
  init(cwd, env)
  cli(['set', 'A=1'], { cwd, env })
  cli(['set', '-e', 'production', 'B=2'], { cwd, env })
  for (const args of [['dotenv', '--json'], ['dotenv'], ['ls']]) {
    const typo = cli([...args, '--env', 'prodution'], { cwd, env })
    t.is(typo.code, 1)
    t.regex(typo.stderr, /found no "prodution" layer/)
    t.is(typo.stdout, '')
    t.is(cli([...args, '--env', 'production'], { cwd, env }).code, 0)
  }
  t.is(cli(['ls'], { cwd, env: { ...env, NODE_ENV: 'staging' } }).stdout, 'A')
})

test('dotenv prints only secrets and accepts an env that only has a plain file', t => {
  const cwd = project({ fixture: 'app' })
  fs.writeFileSync(
    path.join(cwd, 'config', 'staging.yml'),
    'LOG_LEVEL: info\nS3_KEY: staging-s3\n'
  )
  const result = cli(['dotenv', '--json', '--env', 'staging'], {
    cwd,
    env: withKey
  })
  t.is(result.code, 0)
  const secrets = JSON.parse(result.stdout)
  t.false(Object.hasOwn(secrets, 'LOG_LEVEL'))
  t.false(Object.hasOwn(secrets, 'S3_KEY'))
  t.is(secrets.API_TOKEN, 'Bearer default #token')
})

test('--json is refused outside dotenv', t => {
  const cwd = temporaryDir('json-elsewhere')
  const env = freshHome()
  init(cwd, env)
  cli(['set', 'A=1'], { cwd, env })
  for (const args of [
    ['ls', '--json'],
    ['get', 'A', '--json']
  ]) {
    const result = cli(args, { cwd, env })
    t.is(result.code, 1)
    t.regex(result.stderr, /--json only works with dotenv/)
  }
})

test('get prints numbers, null, and nested values without a newline when piped', t => {
  const cwd = temporaryDir('get-exact-types')
  const env = freshHome()
  init(cwd, env)
  fs.writeFileSync(
    path.join(cwd, 'config', 'default.yml'),
    'PORT: 3000\nNOTHING: null\nNESTED:\n  a: 1\n'
  )
  t.is(cli(['get', 'PORT'], { cwd, env }).rawStdout, '3000')
  t.is(cli(['get', 'NOTHING'], { cwd, env }).rawStdout, '')
  t.is(cli(['get', 'NESTED'], { cwd, env }).rawStdout, 'a: 1')
})

test('render ends exact output with a newline only on a terminal', t => {
  t.is(render({ stdout: 'value', exact: true }, false), 'value')
  t.is(render({ stdout: 'value', exact: true }, true), 'value\n')
  t.is(render({ stdout: 'a\nb' }, false), 'a\nb\n')
  t.is(render({ stdout: '' }, true), '')
  t.is(render({ exitCode: 3 }, false), '')
})

test('init never touches an existing .sops.yaml', t => {
  const cwd = temporaryDir('init-existing')
  const env = freshHome()
  const original =
    '# team keys, ask ops before editing\ncreation_rules:\n    # infra files\n    - path_regex: infra/.*\n      age: age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq\n'
  fs.writeFileSync(path.join(cwd, '.sops.yaml'), original)
  t.is(init(cwd, env).code, 0)
  t.is(fs.readFileSync(path.join(cwd, '.sops.yaml'), 'utf8'), original)
  t.is(cli(['set', '-e', 'production', 'A=1'], { cwd, env }).code, 0)
  t.is(cli(['get', '-e', 'production', 'A'], { cwd, env }).stdout, '1')
})

test('writes refuse to drop KMS or PGP keys from a file', t => {
  const cwd = project({ fixture: 'app' })
  const file = path.join(cwd, 'config', 'default.enc.yml')
  const text = fs
    .readFileSync(file, 'utf8')
    .replace(
      'sops:\n',
      'sops:\n    kms:\n        - arn: arn:aws:kms:us-east-1:1:key/x\n          enc: abc\n'
    )
  fs.writeFileSync(file, text)
  const result = cli(['set', 'NEW=1'], { cwd, env: withKey })
  t.is(result.code, 1)
  t.regex(result.stderr, /also encrypted with kms, which onesecret cannot keep/)
  t.is(fs.readFileSync(file, 'utf8'), text)
})

test('set refuses __proto__ and get ignores unrelated values that env cannot hold', t => {
  const cwd = temporaryDir('nested-get')
  const sops = require('../src/sops')
  const store = require('../src/store')
  store.writeDocument(
    path.join(cwd, 'config', 'default.enc.yml'),
    sops.encrypt(
      { UNI: 'ok', nested: { a: 1 } },
      { recipients: [require('./helpers').FIXTURE_RECIPIENT] }
    )
  )
  t.is(cli(['get', 'UNI'], { cwd, env: withKey }).stdout, 'ok')
  t.regex(
    cli(['set', '__proto__=x'], { cwd, env: withKey }).stderr,
    /not a valid environment variable name/
  )
})

test('edit keeps integers beyond 2^53 exact', t => {
  const cwd = temporaryDir('edit-bigint')
  const sops = require('../src/sops')
  const store = require('../src/store')
  const file = path.join(cwd, 'config', 'default.enc.yml')
  store.writeDocument(
    file,
    sops.encrypt(
      { NEG: -9007199254740993n },
      { recipients: [require('./helpers').FIXTURE_RECIPIENT] }
    )
  )
  const editor = fakeBinary(
    'append-editor',
    "require('fs').appendFileSync(process.argv[2], 'OTHER: x\\n')"
  ).file
  const result = cli(['edit'], { cwd, env: { ...withKey, EDITOR: editor } })
  t.is(result.code, 0, result.stderr)
  t.is(cli(['get', 'NEG'], { cwd, env: withKey }).stdout, '-9007199254740993')
})

test('an interrupted edit leaves no plaintext behind', async t => {
  const cwd = project({ fixture: 'app' })
  const workspaceRoot = temporaryDir('edit-tmp')
  const editor = fakeBinary(
    'slow-editor',
    "process.kill(process.ppid, 'SIGHUP'); setTimeout(() => process.exit(1), 300)"
  ).file
  const result = cli(['edit'], {
    cwd,
    env: { ...withKey, EDITOR: editor, TMPDIR: workspaceRoot }
  })
  t.not(result.code, 0)
  t.deepEqual(fs.readdirSync(workspaceRoot), [])
})

test('init works with an unusual directory name and writes nothing when it fails', t => {
  const cwd = temporaryDir('init-dir')
  const env = freshHome()
  const result = init(cwd, env, ['--dir', "@odd'dir"])
  t.is(result.code, 0, result.stderr)
  t.false(fs.existsSync(path.join(cwd, '.sops.yaml')))
  t.is(cli(['set', '--dir', "@odd'dir", 'A=1'], { cwd, env }).code, 0)
  t.is(cli(['get', '--dir', "@odd'dir", 'A'], { cwd, env }).stdout, '1')

  const blocked = temporaryDir('init-blocked')
  fs.writeFileSync(path.join(blocked, 'config'), 'not a directory')
  const failed = cli(['init'], { cwd: blocked, env: freshHome() })
  t.is(failed.code, 1)
  t.notRegex(failed.stdout, /AGE-SECRET-KEY/)
  t.deepEqual(fs.readdirSync(blocked), ['config'])
})

test('.sops.yaml can use anchors and Go regular expressions', t => {
  const cwd = temporaryDir('anchors')
  fs.writeFileSync(
    path.join(cwd, '.sops.yaml'),
    `keys:\n  - &team ${
      require('./helpers').FIXTURE_RECIPIENT
    }\ncreation_rules:\n  - path_regex: (?i)CONFIG/.*\n    age: *team\n`
  )
  t.is(cli(['set', 'A=1'], { cwd, env: withKey }).code, 0)
  t.is(cli(['get', 'A'], { cwd, env: withKey }).stdout, '1')
})

test('exec can fetch the key with keyCommand even for production', t => {
  const cwd = project({ fixture: 'app' })
  const keyCommand = fakeBinary(
    'print-key',
    `console.log(${JSON.stringify(FIXTURE_KEY)})`
  ).file
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ onesecret: { keyCommand } })
  )
  const result = cli(
    [
      'exec',
      '-e',
      'production',
      '--',
      process.execPath,
      '-e',
      'console.log(process.env.DATABASE_URL)'
    ],
    { cwd }
  )
  t.is(result.stdout, 'postgres://fixture-production', result.stderr)
})

test('a creation rule with only mac_only_encrypted keeps the default _unencrypted suffix, like sops', t => {
  const cwd = temporaryDir('mac-only-rule')
  fs.writeFileSync(
    path.join(cwd, '.sops.yaml'),
    `creation_rules:\n  - path_regex: config/.*\n    age: ${
      require('./helpers').FIXTURE_RECIPIENT
    }\n    mac_only_encrypted: true\n`
  )
  t.is(cli(['set', 'A=1', 'B_unencrypted=2'], { cwd, env: withKey }).code, 0)
  const text = fs.readFileSync(
    path.join(cwd, 'config', 'default.enc.yml'),
    'utf8'
  )
  t.true(text.includes('B_unencrypted: "2"'))
  t.regex(text, /unencrypted_suffix: _unencrypted/)
  t.regex(text, /mac_only_encrypted: true/)
})

test('edit takes the path of an encrypted file and shows it decrypted', t => {
  const cwd = project({ fixture: 'app' })
  const seen = path.join(temporaryDir('seen'), 'file.yml')
  const editor = fakeBinary(
    'path-editor',
    `const fs = require('fs'); const file = process.argv[2]; fs.copyFileSync(file, ${JSON.stringify(
      seen
    )}); fs.appendFileSync(file, 'ADDED: by-path\\n')`
  ).file
  const result = cli(['edit', 'config/production.enc.yml'], {
    cwd,
    env: { ...withKey, EDITOR: editor }
  })
  t.is(result.stdout, 'config/production.enc.yml encrypted', result.stderr)
  const shown = fs.readFileSync(seen, 'utf8')
  t.regex(shown, /^DATABASE_URL: postgres:\/\/fixture-production$/m)
  t.notRegex(shown, /ENC\[|sops:/)
  t.is(
    cli(['get', '--env', 'production', 'ADDED'], { cwd, env: withKey }).stdout,
    'by-path'
  )
  t.is(cli(['get', 'ADDED'], { cwd, env: withKey }).code, 1)
  t.notRegex(
    fs.readFileSync(path.join(cwd, 'config', 'production.enc.yml'), 'utf8'),
    /by-path/
  )
})

test('edit creates a new encrypted file from its path with the .sops.yaml rule', t => {
  const cwd = temporaryDir('edit-new')
  const env = freshHome()
  t.is(init(cwd, env).code, 0)
  const editor = fakeBinary(
    'new-editor',
    "require('fs').writeFileSync(process.argv[2], 'TOKEN: staging-token\\n')"
  ).file
  t.is(
    cli(['edit', 'config/staging.enc.yml'], {
      cwd,
      env: { ...env, EDITOR: editor }
    }).stdout,
    'config/staging.enc.yml encrypted'
  )
  t.is(
    cli(['get', '--env', 'staging', 'TOKEN'], { cwd, env }).stdout,
    'staging-token'
  )
})

test('edit opens a plain file as it is and keeps it intact when the edit is invalid', t => {
  const cwd = project({ fixture: 'app' })
  const file = path.join(cwd, 'config', 'default.yml')
  const writing = text =>
    fakeBinary(
      'plain-editor',
      `require('fs').writeFileSync(process.argv[2], ${JSON.stringify(text)})`
    ).file
  t.is(
    cli(['edit', 'config/default.yml'], {
      cwd,
      env: { EDITOR: writing('LOG_LEVEL: debug\n') }
    }).stdout,
    'config/default.yml saved'
  )
  t.is(fs.readFileSync(file, 'utf8'), 'LOG_LEVEL: debug\n')
  t.is(cli(['get', 'LOG_LEVEL'], { cwd, env: withKey }).stdout, 'debug')

  for (const text of ['- not a mapping\n', 'A: [\n']) {
    const broken = cli(['edit', 'config/default.yml'], {
      cwd,
      env: { EDITOR: writing(text) }
    })
    t.is(broken.code, 1)
    t.regex(broken.stderr, /config\/default\.yml/)
    t.notRegex(broken.stderr, /onesecret-[A-Za-z0-9]+\//)
    t.regex(broken.stderr, /Reopening the editor/)
    t.regex(broken.stderr, /edit aborted, config\/default\.yml is unchanged/)
    t.is(fs.readFileSync(file, 'utf8'), 'LOG_LEVEL: debug\n')
  }
  t.is(
    cli(['edit', 'config/other.yml'], {
      cwd,
      env: { EDITOR: fakeBinary('quiet', '').file }
    }).stdout,
    'config/other.yml unchanged'
  )
  t.false(fs.existsSync(path.join(cwd, 'config', 'other.yml')))
})

test('edit refuses a second file for a layer that already has one', t => {
  const cwd = project({ fixture: 'app' })
  fs.writeFileSync(path.join(cwd, 'config', 'default.yml'), 'A: 1\n')
  t.regex(
    cli(['edit', 'config/default.json'], { cwd }).stderr,
    /config\/default\.yml already holds the default layer/
  )
  t.regex(
    cli(['edit', 'config/default.enc.yaml'], { cwd, env: withKey }).stderr,
    /config\/default\.enc\.yml already holds the default layer/
  )
})

test('the edit copy is private', t => {
  const cwd = project({ fixture: 'app' })
  const seen = path.join(temporaryDir('mode'), 'mode')
  const editor = fakeBinary(
    'mode-editor',
    `require('fs').writeFileSync(${JSON.stringify(
      seen
    )}, String(require('fs').statSync(process.argv[2]).mode & 0o777))`
  ).file
  cli(['edit'], { cwd, env: { ...withKey, EDITOR: editor } })
  t.is(fs.readFileSync(seen, 'utf8'), String(0o600))
  cli(['edit', 'config/default.yml'], { cwd, env: { EDITOR: editor } })
  t.is(fs.readFileSync(seen, 'utf8'), String(0o600))
})

test('edit refuses ambiguous targets', t => {
  const cwd = project({ fixture: 'app' })
  t.regex(
    cli(['edit', 'notes.txt'], { cwd }).stderr,
    /needs a \.yml, \.yaml, or \.json file/
  )
  t.regex(
    cli(['edit', '--env', 'production', 'config/default.enc.yml'], { cwd })
      .stderr,
    /a file or --env, not both/
  )
  t.regex(cli(['edit', 'a.yml', 'b.yml'], { cwd }).stderr, /at most one file/)
})

test('dotenv, ls, and deploys carry only the secrets, get reads plain values too', t => {
  const cwd = project({ fixture: 'app' })
  fs.writeFileSync(
    path.join(cwd, 'config', 'production.yml'),
    'LOG_LEVEL: info\n'
  )
  const dotenv = cli(['dotenv', '--env', 'production'], { cwd, env: withKey })
  t.is(dotenv.code, 0, dotenv.stderr)
  t.notRegex(dotenv.stdout, /LOG_LEVEL/)
  t.regex(dotenv.stdout, /^DATABASE_URL=/m)
  t.notRegex(cli(['ls', '--env', 'production'], { cwd }).stdout, /LOG_LEVEL/)
  t.is(
    cli(['get', '--env', 'production', 'LOG_LEVEL'], { cwd, env: withKey })
      .stdout,
    'info'
  )
})

test('edit refuses a file it cannot encrypt before opening the editor', t => {
  const cwd = temporaryDir('edit-no-rule')
  const marker = path.join(temporaryDir('marker'), 'opened')
  const editor = fakeBinary(
    'marking-editor',
    `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x')`
  ).file
  const result = cli(['edit', 'config/new.enc.yml'], {
    cwd,
    env: { ...freshHome(), EDITOR: editor }
  })
  t.is(result.code, 1)
  t.regex(result.stderr, /no age recipient/)
  t.false(fs.existsSync(marker))
})

test('get reads a plain value without the key', t => {
  const cwd = project({ fixture: 'app' })
  fs.writeFileSync(
    path.join(cwd, 'config', 'default.yml'),
    'FLAG: true\nS3_KEY: plain\n'
  )
  const env = freshHome()
  t.is(cli(['get', 'FLAG'], { cwd, env }).stdout, 'true')
  t.is(cli(['get', 'S3_KEY'], { cwd, env }).code, 1)
  t.regex(cli(['get', 'S3_KEY'], { cwd, env }).stderr, /no age key/)
})

test('get prints a nested value as YAML', t => {
  const cwd = project({ fixture: 'app' })
  fs.writeFileSync(
    path.join(cwd, 'config', 'default.yml'),
    'DB:\n  host: h\n  port: 5432\n'
  )
  const result = cli(['get', 'DB'], { cwd, env: freshHome() })
  t.is(result.stdout, 'host: h\nport: 5432', result.stderr)
})

test('editing a plain file keeps its permissions', t => {
  const cwd = project({ fixture: 'app' })
  const file = path.join(cwd, 'config', 'default.yml')
  fs.writeFileSync(file, 'A: 1\n', { mode: 0o600 })
  fs.chmodSync(file, 0o600)
  const editor = fakeBinary(
    'append-editor',
    "require('fs').appendFileSync(process.argv[2], 'B: 2\\n')"
  ).file
  t.is(
    cli(['edit', 'config/default.yml'], { cwd, env: { EDITOR: editor } })
      .stdout,
    'config/default.yml saved'
  )
  t.is(fs.statSync(file).mode & 0o777, 0o600)
  t.is(fs.readFileSync(file, 'utf8'), 'A: 1\nB: 2\n')
})

test('get prints a value whose name is not a variable name', t => {
  const cwd = project({ fixture: 'app' })
  fs.writeFileSync(
    path.join(cwd, 'config', 'default.yml'),
    'log-level: debug\nempty: null\n'
  )
  const env = freshHome()
  t.is(cli(['get', 'log-level'], { cwd, env }).stdout, 'debug')
  t.is(cli(['get', 'empty'], { cwd, env }).code, 0)
})

test('init prints where everything went', t => {
  const cwd = temporaryDir('init-output')
  const env = freshHome()
  const lines = init(cwd, env).stdout.split('\n')
  t.regex(lines[0], /^public key {3}age1\w+$/)
  t.regex(lines[1], /^private key {2}AGE-SECRET-KEY-1\w+$/)
  t.is(lines[2], 'secrets      config/default.enc.yml')
  t.regex(lines[4], /only secret to keep/)
  t.regex(lines[5], /shown only now and saved nowhere, so store it safely/)
  t.regex(lines[6], /SOPS_AGE_KEY in CI/)
  t.is(lines.at(-1), `  export SOPS_AGE_KEY=${lines[1].split(/\s+/).at(-1)}`)
})

test('.sops.yaml recipients may be separated by commas and spaces', t => {
  const cwd = temporaryDir('recipients')
  const { FIXTURE_RECIPIENT } = require('./helpers')
  const other = require('../src/age').recipientOf(
    require('./helpers').OTHER_KEY
  )
  fs.writeFileSync(
    path.join(cwd, '.sops.yaml'),
    `creation_rules:\n  - age: " ${FIXTURE_RECIPIENT} , ${other} "\n`
  )
  t.is(cli(['set', 'A=1'], { cwd, env: withKey }).code, 0)
  const document = yaml.load(
    fs.readFileSync(path.join(cwd, 'config', 'default.enc.yml'), 'utf8')
  )
  t.deepEqual(
    document.sops.age.map(({ recipient }) => recipient),
    [FIXTURE_RECIPIENT, other]
  )
})

test('write commands refuse env names that escape the dir or look like files', t => {
  const cwd = temporaryDir('write-env')
  const env = freshHome()
  t.is(init(cwd, env).code, 0)
  fs.writeFileSync(
    path.join(cwd, '.sops.yaml'),
    `creation_rules:\n  - age: ${require('./helpers').FIXTURE_RECIPIENT}\n`
  )
  for (const args of [
    ['set', '--env', '../escaped', 'FOO=1'],
    ['set', '--env', 'production.enc', 'FOO=1'],
    ['set', '--env', 'default.json', 'FOO=1'],
    ['rekey', '--env', '../escaped'],
    ['edit', 'config/x.json.enc.yml']
  ]) {
    const result = cli(args, { cwd, env: { ...env, ...withKey } })
    t.is(result.code, 1, args.join(' '))
    t.regex(result.stderr, /is not a valid env name/, args.join(' '))
  }
  t.false(fs.existsSync(path.join(cwd, 'escaped.enc.yml')))
  t.deepEqual(fs.readdirSync(path.join(cwd, 'config')), ['default.enc.yml'])
})

test('a bad NODE_ENV does not break commands that write a named layer', t => {
  const cwd = temporaryDir('bad-node-env')
  const env = { ...freshHome(), NODE_ENV: 'x.json' }
  t.is(init(cwd, env).code, 0)
  t.is(cli(['set', 'FOO=2'], { cwd, env }).code, 0)
  t.regex(cli(['ls'], { cwd, env }).stderr, /"x\.json" is not a valid env name/)
})

test('a refusal prints its reason without the whole help', t => {
  const cwd = project({ fixture: 'app' })
  fs.writeFileSync(path.join(cwd, 'config', 'default.yml'), 'A: 1\n')
  const result = cli(['edit', 'config/default.json'], { cwd })
  t.is(result.code, 1)
  t.notRegex(result.stderr, /Usage/)
})

test('a YAML tag in an edit is refused without printing the value', t => {
  const cwd = project({ fixture: 'app' })
  const writing = text =>
    fakeBinary(
      'tag-editor',
      `require('fs').writeFileSync(process.argv[2], ${JSON.stringify(text)})`
    ).file
  for (const text of ['DB_PASS: !Qw3rty!2024\n', 'DB_PASS: !Qw3rty2024\n']) {
    const result = cli(['edit'], {
      cwd,
      env: { ...withKey, EDITOR: writing(text) }
    })
    t.is(result.code, 1, text)
    t.notRegex(result.stderr, /Qw3rty/)
    t.regex(result.stderr, /edit aborted/)
  }
  t.is(cli(['get', 'DB_PASS'], { cwd, env: withKey }).code, 1)
})

test('edit refuses a bad .sops.yaml recipient before the editor opens', t => {
  const cwd = project({ fixture: 'app' })
  const marker = path.join(temporaryDir('marker'), 'opened')
  const editor = fakeBinary(
    'marking-editor',
    `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x')`
  ).file
  fs.writeFileSync(
    path.join(cwd, '.sops.yaml'),
    'creation_rules:\n  - age: "not-a-key"\n'
  )
  const result = cli(['edit'], { cwd, env: { ...withKey, EDITOR: editor } })
  t.is(result.code, 1)
  t.regex(
    result.stderr,
    /\.sops\.yaml has an invalid age recipient "not-a-key"/
  )
  t.false(fs.existsSync(marker))
})

test('exec --env passes the env on as NODE_ENV', t => {
  const cwd = project({ fixture: 'app' })
  const result = cli(
    [
      'exec',
      '--env',
      'production',
      '--',
      process.execPath,
      '-e',
      'console.log(process.env.NODE_ENV)'
    ],
    { cwd, env: { ...withKey, NODE_ENV: 'development' } }
  )
  t.is(result.stdout, 'production', result.stderr)
})

test('GUI editors that return at once are told to wait', t => {
  const cwd = project({ fixture: 'app' })
  const recorder = name => {
    const record = path.join(temporaryDir('argv'), 'argv.json')
    const { dir } = fakeBinary(
      name,
      `require('fs').writeFileSync(${JSON.stringify(
        record
      )}, JSON.stringify(process.argv.slice(2)))`
    )
    return { dir, args: () => JSON.parse(fs.readFileSync(record, 'utf8')) }
  }
  for (const [editor, expected] of [
    ['code', ['--wait']],
    ['code --wait', ['--wait']],
    ['cursor -w', ['-w']],
    ['mate', ['-w']],
    ['gvim', ['-f']],
    ['kate', ['--block']],
    ['idea', ['--wait']],
    ['vim', []]
  ]) {
    const name = editor.split(' ')[0]
    const binary = recorder(name)
    cli(['edit'], {
      cwd,
      env: {
        ...withKey,
        EDITOR: editor,
        PATH: `${binary.dir}${path.delimiter}${process.env.PATH}`
      }
    })
    const args = binary.args()
    t.deepEqual(args.slice(0, -1), expected, editor)
    t.regex(args.at(-1), /default\.yml$/, editor)
  }
})

test('a save that fails on the filesystem reopens the editor instead of losing the edit', t => {
  const cwd = project({ fixture: 'app' })
  const dir = path.join(cwd, 'config')
  const attempts = path.join(temporaryDir('attempts'), 'count')
  const editor = fakeBinary(
    'retry-editor',
    `const fs = require('fs')
const count = fs.existsSync(${JSON.stringify(
      attempts
    )}) ? Number(fs.readFileSync(${JSON.stringify(attempts)}, 'utf8')) + 1 : 1
fs.writeFileSync(${JSON.stringify(attempts)}, String(count))
if (count === 1) fs.appendFileSync(process.argv[2], 'ADDED: kept\\n')
if (count === 2) fs.chmodSync(${JSON.stringify(dir)}, 0o755)`
  ).file
  fs.chmodSync(dir, 0o555)
  const result = cli(['edit', 'config/default.yml'], {
    cwd,
    env: { EDITOR: editor }
  })
  fs.chmodSync(dir, 0o755)
  t.regex(result.stderr, /cannot save, EACCES/)
  t.regex(result.stderr, /Reopening the editor/)
  t.is(result.stdout, 'config/default.yml saved', result.stderr)
  t.regex(fs.readFileSync(path.join(dir, 'default.yml'), 'utf8'), /ADDED: kept/)
})

test('saving a symlinked plain file writes through the link', t => {
  const cwd = project({ fixture: 'app' })
  const target = path.join(temporaryDir('real'), 'shared.yml')
  fs.writeFileSync(target, 'A: 1\n')
  const link = path.join(cwd, 'config', 'default.yml')
  fs.symlinkSync(target, link)
  const editor = fakeBinary(
    'link-editor',
    "require('fs').appendFileSync(process.argv[2], 'B: 2\\n')"
  ).file
  t.is(
    cli(['edit', 'config/default.yml'], { cwd, env: { EDITOR: editor } })
      .stdout,
    'config/default.yml saved'
  )
  t.true(fs.lstatSync(link).isSymbolicLink())
  t.is(fs.readFileSync(target, 'utf8'), 'A: 1\nB: 2\n')
})

test('a save that keeps failing on the filesystem keeps the edit until it works', t => {
  const cwd = project({ fixture: 'app' })
  const dir = path.join(cwd, 'config')
  const attempts = path.join(temporaryDir('attempts'), 'count')
  const editor = fakeBinary(
    'stubborn-editor',
    `const fs = require('fs')
const count = fs.existsSync(${JSON.stringify(
      attempts
    )}) ? Number(fs.readFileSync(${JSON.stringify(attempts)}, 'utf8')) + 1 : 1
fs.writeFileSync(${JSON.stringify(attempts)}, String(count))
if (count === 1) fs.appendFileSync(process.argv[2], 'NEW: important\\n')
if (count === 3) fs.chmodSync(${JSON.stringify(dir)}, 0o755)`
  ).file
  fs.chmodSync(dir, 0o555)
  const result = cli(['edit', 'config/default.enc.yml'], {
    cwd,
    env: { ...withKey, EDITOR: editor }
  })
  fs.chmodSync(dir, 0o755)
  t.is(result.stderr.match(/cannot save, EACCES/g).length, 2)
  t.is(result.stdout, 'config/default.enc.yml encrypted', result.stderr)
  t.is(cli(['get', 'NEW'], { cwd, env: withKey }).stdout, 'important')
})

test('an empty encrypted file is an empty layer', t => {
  const cwd = project({ fixture: 'app' })
  fs.writeFileSync(path.join(cwd, 'config', 'staging.enc.yml'), '')
  t.is(cli(['ls', '--env', 'staging'], { cwd }).code, 0)
  t.is(
    cli(['get', '--env', 'staging', 'S3_KEY'], { cwd, env: withKey }).stdout,
    'AKIA-default'
  )
})

test('writes refuse a layer file whose name differs only in letter case', t => {
  const cwd = project({ fixture: 'app' })
  fs.renameSync(
    path.join(cwd, 'config', 'production.enc.yml'),
    path.join(cwd, 'config', 'Production.enc.yml')
  )
  for (const args of [
    ['set', '--env', 'production', 'NEW=1'],
    ['edit', 'config/production.enc.yml']
  ]) {
    const result = cli(args, { cwd, env: withKey })
    t.is(result.code, 1, args.join(' '))
    t.regex(
      result.stderr,
      /Production\.enc\.yml .* only in letter case/,
      args.join(' ')
    )
  }
})

test('with a .sops.yaml rule, init creates a missing default layer for its recipients and no new key', t => {
  const cwd = temporaryDir('init-rule')
  const { FIXTURE_RECIPIENT } = require('./helpers')
  fs.writeFileSync(
    path.join(cwd, '.sops.yaml'),
    `creation_rules:\n  - path_regex: ^config/\n    age: ${FIXTURE_RECIPIENT}\n`
  )
  const result = cli(['init'], { cwd, env: freshHome() })
  t.is(
    result.stdout,
    `created config/default.enc.yml for ${FIXTURE_RECIPIENT} (from .sops.yaml)`
  )
  t.deepEqual(recipientsIn(path.join(cwd, 'config', 'default.enc.yml')), [
    FIXTURE_RECIPIENT
  ])
})

test('a new file with no neighbour is locked for the exported key, and needs one', t => {
  const cwd = temporaryDir('lonely')
  const key = require('../src/age').generateIdentity()
  const editor = fakeBinary(
    'lonely-editor',
    "require('fs').writeFileSync(process.argv[2], 'A: 1\\n')"
  ).file
  const missing = cli(['edit', 'other/production.enc.yml'], {
    cwd,
    env: { ...freshHome(), EDITOR: editor }
  })
  t.is(missing.code, 1)
  t.regex(missing.stderr, /no age recipient for .*export SOPS_AGE_KEY/)
  const env = { ...freshHome(), EDITOR: editor, SOPS_AGE_KEY: key }
  t.is(cli(['edit', 'other/production.enc.yml'], { cwd, env }).code, 0)
  t.deepEqual(recipientsIn(path.join(cwd, 'other', 'production.enc.yml')), [
    require('../src/age').recipientOf(key)
  ])
})

test('the exported key file adds every key except commented ones', t => {
  const age = require('../src/age')
  const [kept, revoked, second] = [
    age.generateIdentity(),
    age.generateIdentity(),
    age.generateIdentity()
  ]
  const keyFile = path.join(temporaryDir('keys'), 'keys.txt')
  fs.writeFileSync(keyFile, `# old key, revoked: ${revoked}\n${kept}\n`)
  const cwd = temporaryDir('commented')
  const env = {
    ...freshHome(),
    SOPS_AGE_KEY_FILE: keyFile,
    SOPS_AGE_KEY: second
  }
  t.is(cli(['set', 'X=1'], { cwd, env }).code, 0)
  t.deepEqual(
    recipientsIn(path.join(cwd, 'config', 'default.enc.yml')).sort(),
    [age.recipientOf(kept), age.recipientOf(second)].sort()
  )
})

test('a new file ignores unrelated encrypted neighbours and uses the exported key', t => {
  const age = require('../src/age')
  const sops = require('../src/sops')
  const store = require('../src/store')
  const cwd = temporaryDir('neighbour')
  const vendor = age.generateIdentity()
  store.writeDocument(
    path.join(cwd, 'config', 'vendor.enc.yml'),
    sops.encrypt({ A: 'x' }, { recipients: [age.recipientOf(vendor)] })
  )
  fs.writeFileSync(path.join(cwd, 'config', 'zzz.enc.yml'), 'foo: [unclosed\n')
  const mine = age.generateIdentity()
  const env = { ...freshHome(), SOPS_AGE_KEY: mine }
  t.is(cli(['set', '-e', 'staging', 'X=1'], { cwd, env }).code, 0)
  t.deepEqual(recipientsIn(path.join(cwd, 'config', 'staging.enc.yml')), [
    age.recipientOf(mine)
  ])
  t.is(cli(['get', '-e', 'staging', 'X'], { cwd, env }).stdout, '1')
})

test('a damaged default layer is named when a new layer needs its recipients', t => {
  const cwd = temporaryDir('bad-default')
  fs.mkdirSync(path.join(cwd, 'config'))
  fs.writeFileSync(path.join(cwd, 'config', 'default.enc.yml'), 'FOO: bar\n')
  const result = cli(['set', '-e', 'staging', 'X=1'], { cwd, env: withKey })
  t.is(result.code, 1)
  t.regex(result.stderr, /default\.enc\.yml: file is not encrypted with sops/)
})

test('a new layer inherits the encryption rules of the default layer', t => {
  const sops = require('../src/sops')
  const store = require('../src/store')
  const { FIXTURE_RECIPIENT } = require('./helpers')
  const cwd = temporaryDir('inherit-rules')
  store.writeDocument(
    path.join(cwd, 'config', 'default.enc.yml'),
    sops.encrypt(
      { PASSWORD: 'x' },
      { recipients: [FIXTURE_RECIPIENT], rules: { encrypted_regex: '^PASS' } }
    )
  )
  t.is(
    cli(['set', '-e', 'staging', 'PASSWORD=y'], { cwd, env: withKey }).code,
    0
  )
  const staging = yaml.load(
    fs.readFileSync(path.join(cwd, 'config', 'staging.enc.yml'), 'utf8')
  )
  t.is(staging.sops.encrypted_regex, '^PASS')
})

test('init adopts an exported key, and refuses to start a second key next to existing layers', t => {
  const age = require('../src/age')
  const key = age.generateIdentity()
  const cwd = temporaryDir('init-adopt')
  const adopted = cli(['init'], {
    cwd,
    env: { ...freshHome(), SOPS_AGE_KEY: key }
  })
  t.is(
    adopted.stdout,
    `created config/default.enc.yml for ${age.recipientOf(
      key
    )} (from SOPS_AGE_KEY)`
  )
  t.notRegex(adopted.stdout, /AGE-SECRET-KEY/)

  const existing = project({ fixture: 'app' })
  fs.rmSync(path.join(existing, 'config', 'default.enc.yml'))
  const refused = cli(['init'], { cwd: existing, env: freshHome() })
  t.is(refused.code, 1)
  t.regex(
    refused.stderr,
    /already has encrypted layers \(production\.enc\.yml\): export SOPS_AGE_KEY/
  )
  t.notRegex(refused.stdout, /AGE-SECRET-KEY/)
  t.false(fs.existsSync(path.join(existing, 'config', 'default.enc.yml')))
})

test('set takes one NAME and refuses NAME=value, so values stay out of argv', t => {
  const cwd = temporaryDir('set-contract')
  const env = freshHome()
  init(cwd, env)
  for (const args of [['set', 'TOKEN=secret'], ['set', 'A', 'B'], ['set']]) {
    const result = rawCli(args, { cwd, env, input: 'value' })
    t.is(result.code, 1, args.join(' '))
    t.regex(
      result.stderr,
      /set takes one NAME: the value comes from \$EDITOR, or from stdin when piped/
    )
  }
  t.is(rawCli(['ls'], { cwd, env }).stdout, '')
})

test('set reads the exact value from stdin, and get gives it back', t => {
  const cwd = temporaryDir('set-stdin')
  const env = freshHome()
  init(cwd, env)
  const pem = '-----BEGIN KEY-----\nMIIB\n-----END KEY-----\n'
  const result = rawCli(['set', '--env', 'production', 'PEM'], {
    cwd,
    env,
    input: pem
  })
  t.is(result.code, 0)
  t.is(result.stdout, 'config/production.enc.yml encrypted')
  t.is(
    rawCli(['get', '--env', 'production', 'PEM'], { cwd, env }).rawStdout,
    pem
  )
})

test('set refuses empty stdin and writes nothing', t => {
  const cwd = temporaryDir('set-empty')
  const env = freshHome()
  init(cwd, env)
  const file = path.join(cwd, 'config', 'default.enc.yml')
  const before = fs.readFileSync(file, 'utf8')
  const result = rawCli(['set', 'TOKEN'], { cwd, env, input: '' })
  t.is(result.code, 1)
  t.regex(result.stderr, /no value on stdin/)
  t.is(fs.readFileSync(file, 'utf8'), before)
})

test('set checks the name before reading the value', t => {
  const cwd = temporaryDir('set-name-first')
  const env = freshHome()
  init(cwd, env)
  t.regex(
    rawCli(['set', 'BAD-NAME'], { cwd, env }).stderr,
    /not a valid environment variable name/
  )
  t.regex(
    rawCli(['set', 'sops'], { cwd, env }).stderr,
    /reserved for the file metadata/
  )
})

test('set leaves the file untouched when the value is unchanged', t => {
  const cwd = temporaryDir('set-unchanged')
  const env = freshHome()
  init(cwd, env)
  rawCli(['set', 'TOKEN'], { cwd, env, input: 'same' })
  const file = path.join(cwd, 'config', 'default.enc.yml')
  const before = fs.readFileSync(file, 'utf8')
  const result = rawCli(['set', 'TOKEN'], { cwd, env, input: 'same' })
  t.is(result.code, 0)
  t.is(result.stdout, 'TOKEN unchanged in config/default.enc.yml')
  t.is(fs.readFileSync(file, 'utf8'), before)
})

test.serial(
  'set in a terminal opens $EDITOR on the current value, privately',
  t => {
    const { readSetValue } = require('../src/cli')
    const editorEnv = process.env.EDITOR
    const visualEnv = process.env.VISUAL
    delete process.env.VISUAL
    const useEditor = script => {
      process.env.EDITOR = fakeBinary('set-editor', script).file
    }
    try {
      useEditor(
        "const fs = require('fs'); const file = process.argv[2]; const mode = (fs.statSync(file).mode & 0o777).toString(8); fs.writeFileSync(file, fs.readFileSync(file, 'utf8') + '-edited ' + mode + '\\n')"
      )
      t.is(
        readSetValue('TOKEN', 'old', { interactive: true }),
        'old-edited 600'
      )
      useEditor(
        "require('fs').writeFileSync(process.argv[2], 'line1\\nline2\\n\\n')"
      )
      t.is(
        readSetValue('TOKEN', undefined, { interactive: true }),
        'line1\nline2\n'
      )
      useEditor("require('fs').writeFileSync(process.argv[2], '\\n')")
      t.is(readSetValue('TOKEN', 'old', { interactive: true }), null)
      useEditor('process.exit(1)')
      t.is(
        t.throws(() => readSetValue('TOKEN', 'old', { interactive: true }))
          .code,
        'EUSAGE'
      )
    } finally {
      if (editorEnv === undefined) delete process.env.EDITOR
      else process.env.EDITOR = editorEnv
      if (visualEnv !== undefined) process.env.VISUAL = visualEnv
    }
  }
)

const BIN = path.join(__dirname, '..', 'bin', 'index.js')

test('set waits for a slow pipe instead of failing on an empty read', t => {
  const cwd = temporaryDir('set-slow-pipe')
  const env = freshHome()
  init(cwd, env)
  const shell = command =>
    require('node:child_process').spawnSync('sh', ['-c', command], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env }
    })
  const node = `"${process.execPath}" "${BIN}"`
  const late = shell(`(sleep 0.3; printf late) | ${node} set LATE`)
  t.is(late.status, 0, late.stderr)
  t.is(rawCli(['get', 'LATE'], { cwd, env }).rawStdout, 'late')
  const copied = shell(`${node} get LATE | ${node} set --env production LATE`)
  t.is(copied.status, 0, copied.stderr)
  t.is(
    rawCli(['get', '--env', 'production', 'LATE'], { cwd, env }).rawStdout,
    'late'
  )
})

test('set refuses bytes that are not UTF-8 and NUL bytes', t => {
  const cwd = temporaryDir('set-bytes')
  const env = freshHome()
  init(cwd, env)
  const binary = rawCli(['set', 'BIN'], {
    cwd,
    env,
    input: Buffer.from([0xff, 0xfe, 0x7a])
  })
  t.is(binary.code, 1)
  t.regex(binary.stderr, /not valid UTF-8/)
  const nul = rawCli(['set', 'NUL'], { cwd, env, input: 'a\u0000b' })
  t.is(nul.code, 1)
  t.regex(nul.stderr, /NUL byte/)
  t.is(rawCli(['ls'], { cwd, env }).stdout, '')
})

test('set keeps a leading UTF-8 BOM in a piped value', t => {
  const cwd = temporaryDir('set-bom')
  const env = freshHome()
  init(cwd, env)
  const value = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from('secret')
  ])
  const result = rawCli(['set', 'BOM'], { cwd, env, input: value })
  t.is(result.code, 0, result.stderr)
  t.is(rawCli(['get', 'BOM'], { cwd, env }).rawStdout, '\uFEFFsecret')
})

test.serial(
  'the editor keeps a value that ends in a newline when nothing changes',
  t => {
    const { readSetValue } = require('../src/cli')
    const editorEnv = process.env.EDITOR
    const visualEnv = process.env.VISUAL
    delete process.env.VISUAL
    try {
      process.env.EDITOR = fakeBinary('noop-set-editor', '').file
      t.is(readSetValue('TOKEN', 'tok\n', { interactive: true }), 'tok\n')
      process.env.EDITOR = fakeBinary(
        'newline-editor',
        "require('fs').appendFileSync(process.argv[2], '\\n')"
      ).file
      t.is(readSetValue('TOKEN', 'tok', { interactive: true }), 'tok')
      t.is(readSetValue('TOKEN', 'tok\n', { interactive: true }), 'tok\n')
    } finally {
      if (editorEnv === undefined) delete process.env.EDITOR
      else process.env.EDITOR = editorEnv
      if (visualEnv !== undefined) process.env.VISUAL = visualEnv
    }
  }
)

test('set shows a null value as empty, not as the text null', t => {
  const cwd = temporaryDir('set-null')
  const sops = require('../src/sops')
  const store = require('../src/store')
  const write = require('../src/write')
  store.writeDocument(
    path.join(cwd, 'config', 'default.enc.yml'),
    sops.encrypt(
      { NOTHING: null },
      { recipients: [require('../src/age').recipientOf(FIXTURE_KEY)] }
    )
  )
  const previousKey = process.env.SOPS_AGE_KEY
  process.env.SOPS_AGE_KEY = FIXTURE_KEY
  try {
    let shown
    const result = write.set({ cwd }, 'default', 'NOTHING', current => {
      shown = current
      return 'value'
    })
    t.is(shown, '')
    t.is(result.status, 'encrypted')
  } finally {
    if (previousKey === undefined) delete process.env.SOPS_AGE_KEY
    else process.env.SOPS_AGE_KEY = previousKey
  }
})

const terminalCli = (args, { cwd, env, editor }) => {
  const childEnv = { ...process.env, ...env, EDITOR: editor }
  delete childEnv.VISUAL
  const result = require('node:child_process').spawnSync(
    'python3',
    [
      '-c',
      [
        'import os, sys, pty',
        'cmd = sys.argv[1:]',
        'pid, fd = pty.fork()',
        'if pid == 0:',
        '    try:',
        '        os.execv(cmd[0], cmd)',
        '    finally:',
        '        os._exit(127)',
        'while True:',
        '    try:',
        '        chunk = os.read(fd, 4096)',
        '    except OSError:',
        '        break',
        '    if not chunk:',
        '        break',
        '    sys.stdout.buffer.write(chunk)',
        '_, status = os.waitpid(pid, 0)',
        'sys.exit(os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1)'
      ].join('\n'),
      process.execPath,
      BIN,
      ...args
    ],
    { cwd, env: childEnv, encoding: 'utf8' }
  )
  return {
    code: result.status,
    stdout: (result.stdout || '').replaceAll('\r', '').trim(),
    stderr: `${result.stderr || ''}${result.error || ''}`.trim()
  }
}

test('an empty editor save cancels a missing or null secret and leaves a blank value unchanged', t => {
  const age = require('../src/age')
  const sops = require('../src/sops')
  const store = require('../src/store')
  const cwd = temporaryDir('set-blank')
  const env = freshHome()
  const file = path.join(cwd, 'config', 'default.enc.yml')
  const blankEditor = script => fakeBinary('blank-set-editor', script).file
  const setInTerminal = (name, editor) =>
    terminalCli(['set', name], { cwd, env, editor })
  init(cwd, env)
  t.is(
    setInTerminal(
      'TOKEN',
      blankEditor("require('fs').writeFileSync(process.argv[2], 'kept\\n')")
    ).stdout,
    'config/default.enc.yml encrypted'
  )
  t.is(rawCli(['get', 'TOKEN'], { cwd, env }).rawStdout, 'kept')

  const kept = fs.readFileSync(file, 'utf8')
  for (const script of [
    "require('fs').writeFileSync(process.argv[2], '\\n')",
    "require('fs').writeFileSync(process.argv[2], '\\r\\n')",
    "require('fs').writeFileSync(process.argv[2], '')"
  ]) {
    const cancelled = setInTerminal('GHOST', blankEditor(script))
    t.is(cancelled.code, 0, cancelled.stderr)
    t.is(cancelled.stdout, 'GHOST not set, the value was empty')
    t.is(fs.readFileSync(file, 'utf8'), kept)
  }
  const cleared = setInTerminal(
    'TOKEN',
    blankEditor("require('fs').writeFileSync(process.argv[2], '\\n')")
  )
  t.is(cleared.stdout, 'TOKEN not set, the value was empty')
  t.is(rawCli(['get', 'TOKEN'], { cwd, env }).rawStdout, 'kept')

  store.writeDocument(
    file,
    sops.encrypt(
      { NOTHING: null, EMPTY: '' },
      { recipients: [age.recipientOf(env.SOPS_AGE_KEY)] }
    )
  )
  const blanks = fs.readFileSync(file, 'utf8')
  const editor = blankEditor(
    "require('fs').writeFileSync(process.argv[2], '\\n')"
  )
  t.is(
    setInTerminal('NOTHING', editor).stdout,
    'NOTHING not set, the value was empty'
  )
  t.is(
    setInTerminal('EMPTY', editor).stdout,
    'EMPTY unchanged in config/default.enc.yml'
  )
  t.is(fs.readFileSync(file, 'utf8'), blanks)
})
