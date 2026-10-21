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

test('init prints a new key without saving it, writes .sops.yaml and an empty default layer, then leaves them alone', t => {
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
  const sopsConfig = yaml.load(
    fs.readFileSync(path.join(cwd, '.sops.yaml'), 'utf8')
  )
  t.deepEqual(sopsConfig.creation_rules, [
    { path_regex: '^config/[^/]+\\.enc\\.(ya?ml|json)$', age: recipient }
  ])
  t.true(fs.existsSync(path.join(cwd, 'config', 'default.enc.yml')))
  t.is(cli(['set', 'A=1'], { cwd, env }).code, 1)
  t.is(cli(['set', 'A=1'], { cwd, env: { ...env, SOPS_AGE_KEY: key } }).code, 0)

  const again = cli(['init'], { cwd, env })
  t.regex(again.stdout, /already initialized/)
  t.notRegex(again.stdout, /AGE-SECRET-KEY/)
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
  t.regex(
    cli(['set', 'NOEQUALS'], { cwd, env }).stderr,
    /"NOEQUALS" is not NAME=value/
  )
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

test('init keeps the comments of an existing .sops.yaml', t => {
  const cwd = temporaryDir('init-comments')
  const env = freshHome()
  const original =
    '# team keys, ask ops before editing\ncreation_rules:\n    # infra files\n    - path_regex: infra/.*\n      age: age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq\n'
  fs.writeFileSync(path.join(cwd, '.sops.yaml'), original)
  t.is(init(cwd, env).code, 0)
  const text = fs.readFileSync(path.join(cwd, '.sops.yaml'), 'utf8')
  t.true(
    text.startsWith(
      '# team keys, ask ops before editing\ncreation_rules:\n    - path_regex: "^config/'
    )
  )
  t.true(text.includes('    # infra files\n    - path_regex: infra/.*'))
  t.is(yaml.load(text).creation_rules.length, 2)
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

test('init quotes and anchors unusual directory names, and writes nothing when it fails', t => {
  const cwd = temporaryDir('init-dir')
  const env = freshHome()
  const result = init(cwd, env, ['--dir', "@odd'dir"])
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

test('fly stages by default and prints the checksum of the secrets', t => {
  const cwd = project({ fixture: 'app' })
  const fly = recordingBinary('fly')
  const result = cli(['fly', '--env', 'production', '--app', 'api'], {
    cwd,
    env: { ...withKey, PATH: `${fly.dir}${path.delimiter}${process.env.PATH}` }
  })
  t.is(result.code, 0, result.stderr)
  t.deepEqual(fly.call().args, ['secrets', 'import', '--stage', '--app', 'api'])
  const { checksum } = require('../src')
  const secrets = require('../src/secrets')
  const expected = require('./helpers').withEnv(withKey, () =>
    checksum(
      secrets.loadSecrets(secrets.readLayers({ cwd, env: 'production' }))
    )
  )
  t.is(result.stdout, expected)
})

test('init prints where everything went', t => {
  const cwd = temporaryDir('init-output')
  const env = freshHome()
  const lines = init(cwd, env).stdout.split('\n')
  t.regex(lines[0], /^public key {3}age1\w+$/)
  t.regex(lines[1], /^private key {2}AGE-SECRET-KEY-1\w+$/)
  t.is(lines[2], 'sops config  .sops.yaml')
  t.is(lines[3], 'secrets      config/default.enc.yml')
  t.regex(lines[5], /shown only now and is not saved anywhere/)
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
