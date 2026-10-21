'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { default: test } = require('ava')
const yaml = require('js-yaml')
const {
  FIXTURE_KEY,
  cli,
  fakeBinary,
  project,
  recordingBinary,
  temporaryDir
} = require('./helpers')

const withKey = { SOPS_AGE_KEY: FIXTURE_KEY }

const freshHome = () => {
  const home = temporaryDir('cli-home')
  return { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config') }
}

test('init creates a key, .sops.yaml, and an empty default layer, then leaves them alone', t => {
  const cwd = temporaryDir('init')
  const env = freshHome()
  const first = cli(['init'], { cwd, env })
  t.is(first.code, 0, first.stderr)
  const keysFile = path.join(env.XDG_CONFIG_HOME, 'sops', 'age', 'keys.txt')
  const recipient = first.stdout.match(/age1\w+/)[0]
  t.regex(fs.readFileSync(keysFile, 'utf8'), /^AGE-SECRET-KEY-1/m)
  t.is(fs.statSync(keysFile).mode & 0o777, 0o600)
  const sopsConfig = yaml.load(
    fs.readFileSync(path.join(cwd, '.sops.yaml'), 'utf8')
  )
  t.deepEqual(sopsConfig.creation_rules, [
    { path_regex: '^secrets/[^/]+\\.enc\\.(ya?ml|json)$', age: recipient }
  ])
  t.true(fs.existsSync(path.join(cwd, 'secrets', 'default.enc.yml')))

  const again = cli(['init'], { cwd, env })
  t.regex(again.stdout, /already initialized/)
  t.is(fs.readFileSync(keysFile, 'utf8').match(/AGE-SECRET-KEY/g).length, 1)
})

test('set, get, ls, unset, and dotenv work across layers', t => {
  const cwd = temporaryDir('layers')
  const env = freshHome()
  cli(['init'], { cwd, env })
  t.is(
    cli(['set', 'TOKEN=a=b', 'URL=http://dev'], { cwd, env }).stdout,
    'secrets/default.enc.yml encrypted'
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
  t.regex(cli(['get', 'NOPE'], { cwd, env }).stderr, /"NOPE" is not a secret/)
  t.regex(
    cli(['set', 'NOEQUALS'], { cwd, env }).stderr,
    /"NOEQUALS" is not NAME=value/
  )
  t.is(cli(['set', 'NOTE_unencrypted=public'], { cwd, env }).code, 0)
  t.true(
    fs
      .readFileSync(path.join(cwd, 'secrets', 'default.enc.yml'), 'utf8')
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

test('writing without .sops.yaml reuses the recipients of the existing file', t => {
  const cwd = project({ fixture: 'app' })
  t.is(cli(['set', 'NEW=1'], { cwd, env: withKey }).code, 0)
  t.is(cli(['get', 'NEW'], { cwd, env: withKey }).stdout, '1')
  t.regex(
    cli(['set', '-e', 'staging', 'A=1'], { cwd, env: withKey }).stderr,
    /run "onesecret init" first/
  )
})

test('rekey re-encrypts with the .sops.yaml recipients', t => {
  const cwd = project({ fixture: 'app' })
  const newKey = require('../src/age').generateIdentity()
  const newRecipient = require('../src/age').recipientOf(newKey)
  fs.writeFileSync(
    path.join(cwd, '.sops.yaml'),
    `creation_rules:\n  - path_regex: secrets/.*\n    age: ${newRecipient}\n`
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
    'secrets/default.enc.yml encrypted'
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

test('kubernetes prints the checksum on stdout and kubectl output on stderr', t => {
  const cwd = project({ fixture: 'app' })
  const kubectl = recordingBinary('kubectl', {
    stdout: 'secret/api-env created\n'
  })
  const result = cli(
    ['kubernetes', '--env', 'production', '--name', 'api-env', '-n', 'api'],
    {
      cwd,
      env: {
        ...withKey,
        PATH: `${kubectl.dir}${path.delimiter}${process.env.PATH}`
      }
    }
  )
  t.is(result.code, 0, result.stderr)
  t.regex(result.stdout, /^[a-f0-9]{64}$/)
  t.is(result.stderr, 'secret/api-env created')
  t.is(yaml.load(kubectl.call().input).metadata.namespace, 'api')
})

test('fly honors --no-stage', t => {
  const cwd = project({ fixture: 'app' })
  const fly = recordingBinary('fly')
  const result = cli(
    ['fly', '--env', 'production', '--app', 'api', '--no-stage'],
    {
      cwd,
      env: {
        ...withKey,
        PATH: `${fly.dir}${path.delimiter}${process.env.PATH}`
      }
    }
  )
  t.is(result.code, 0, result.stderr)
  t.deepEqual(fly.call().args, ['secrets', 'import', '--app', 'api'])
})

test('help, version, and usage errors', t => {
  t.regex(cli(['--help']).stdout, /^Usage/)
  t.regex(cli([]).stdout, /^Usage/)
  t.is(cli(['--version']).stdout, require('../package.json').version)
  const unknown = cli(['nope'])
  t.is(unknown.code, 1)
  t.regex(unknown.stderr, /unknown command "nope"/)
  t.regex(cli(['set']).stderr, /set needs at least one NAME=value/)
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
  t.regex(result.stderr, /not valid YAML at line \d+/)
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
  cli(['init'], { cwd, env })
  const sops = require('../src/sops')
  const store = require('../src/store')
  const keyText = fs.readFileSync(
    path.join(env.XDG_CONFIG_HOME, 'sops', 'age', 'keys.txt'),
    'utf8'
  )
  const recipient = require('../src/age').recipientOf(
    keyText.match(/AGE-SECRET-KEY-\w+/)[0]
  )
  store.writeDocument(
    path.join(cwd, 'secrets', 'default.enc.yml'),
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
      .readFileSync(path.join(cwd, 'secrets', 'default.enc.yml'), 'utf8')
      .includes('sk_live_abc')
  )
  t.is(cli(['set', 'PASSWORD=y'], { cwd, env }).code, 0)
  t.is(cli(['set', 'NOTE_unencrypted=public'], { cwd, env }).code, 1)
})

test('rekey keeps the encryption rules of the file', t => {
  const cwd = project({ fixture: 'app' })
  const sops = require('../src/sops')
  const store = require('../src/store')
  const file = path.join(cwd, 'secrets', 'default.enc.yml')
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
  t.regex(result.stderr, /"constructor" is not a secret/)
})

test('dotenv output reads back to the same values', t => {
  const cwd = temporaryDir('dotenv')
  const env = freshHome()
  cli(['init'], { cwd, env })
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

test('init keeps the comments of an existing .sops.yaml', t => {
  const cwd = temporaryDir('init-comments')
  const env = freshHome()
  const original =
    '# team keys, ask ops before editing\ncreation_rules:\n    # infra files\n    - path_regex: infra/.*\n      age: age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq\n'
  fs.writeFileSync(path.join(cwd, '.sops.yaml'), original)
  t.is(cli(['init'], { cwd, env }).code, 0)
  const text = fs.readFileSync(path.join(cwd, '.sops.yaml'), 'utf8')
  t.true(
    text.startsWith(
      '# team keys, ask ops before editing\ncreation_rules:\n    - path_regex: "^secrets/'
    )
  )
  t.true(text.includes('    # infra files\n    - path_regex: infra/.*'))
  t.is(yaml.load(text).creation_rules.length, 2)
})

test('writes refuse to drop KMS or PGP keys from a file', t => {
  const cwd = project({ fixture: 'app' })
  const file = path.join(cwd, 'secrets', 'default.enc.yml')
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
    path.join(cwd, 'secrets', 'default.enc.yml'),
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
  const file = path.join(cwd, 'secrets', 'default.enc.yml')
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

test('init quotes and anchors unusual directory names, and writes nothing when it fails', t => {
  const cwd = temporaryDir('init-dir')
  const env = freshHome()
  const result = cli(['init', '--dir', "@odd'dir"], { cwd, env })
  t.is(result.code, 0, result.stderr)
  const rule = yaml.load(fs.readFileSync(path.join(cwd, '.sops.yaml'), 'utf8'))
    .creation_rules[0]
  t.true(rule.path_regex.startsWith("^@odd'dir/"))
  t.is(cli(['set', '--dir', "@odd'dir", 'A=1'], { cwd, env }).code, 0)
  t.is(cli(['get', '--dir', "@odd'dir", 'A'], { cwd, env }).stdout, '1')
})

test('.sops.yaml can use anchors and Go regular expressions', t => {
  const cwd = temporaryDir('anchors')
  fs.writeFileSync(
    path.join(cwd, '.sops.yaml'),
    `keys:\n  - &team ${
      require('./helpers').FIXTURE_RECIPIENT
    }\ncreation_rules:\n  - path_regex: (?i)SECRETS/.*\n    age: *team\n`
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
    `creation_rules:\n  - path_regex: secrets/.*\n    age: ${
      require('./helpers').FIXTURE_RECIPIENT
    }\n    mac_only_encrypted: true\n`
  )
  t.is(cli(['set', 'A=1', 'B_unencrypted=2'], { cwd, env: withKey }).code, 0)
  const text = fs.readFileSync(
    path.join(cwd, 'secrets', 'default.enc.yml'),
    'utf8'
  )
  t.true(text.includes('B_unencrypted: "2"'))
  t.regex(text, /unencrypted_suffix: _unencrypted/)
  t.regex(text, /mac_only_encrypted: true/)
})
