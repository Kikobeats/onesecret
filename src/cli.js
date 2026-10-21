'use strict'

const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const mri = require('mri')
const secrets = require('./secrets')
const write = require('./write')
const deploy = require('./deploy')
const { toDotenv, toEnvValue } = require('./format')
const { withoutAgeKey } = require('./keys')
const { OnesecretError } = require('./error')

const HELP = fs.readFileSync(
  path.join(__dirname, '..', 'bin', 'help.txt'),
  'utf8'
)

const usage = message => {
  throw new OnesecretError(`${message}\n\n${HELP}`, 'EUSAGE')
}

const readOptions = flags => ({
  dir: flags.dir,
  env: flags.env,
  cwd: flags.cwd
})

const writeOptions = flags => ({ dir: flags.dir, cwd: flags.cwd })

const writeLayerOf = flags => flags.env || 'default'

const relative = file => path.relative(process.cwd(), file) || file

const shellQuote = text => `'${text.replace(/'/g, "'\\''")}'`

const openEditor = file => {
  const editor = process.env.VISUAL || process.env.EDITOR || 'vi'
  const { status, error } = spawnSync(`${editor} ${shellQuote(file)}`, {
    stdio: 'inherit',
    shell: true
  })
  if (error || status !== 0) {
    throw new OnesecretError(
      `editor "${editor}" exited without saving`,
      'EUSAGE'
    )
  }
  return fs.readFileSync(file, 'utf8')
}

const EDIT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP']

const edit = flags => {
  const layer = writeLayerOf(flags)
  const current = write.readLayer(writeOptions(flags), layer)
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'onesecret-'))
  const file = path.join(workspace, `${layer}.yml`)
  const removeWorkspace = () =>
    fs.rmSync(workspace, { recursive: true, force: true })
  const onSignal = signal => {
    removeWorkspace()
    process.exit(128 + os.constants.signals[signal])
  }
  for (const signal of EDIT_SIGNALS) process.on(signal, onSignal)
  try {
    const original = write.toEditableYaml(current.tree)
    fs.writeFileSync(file, original, { mode: 0o600 })
    let rejected = null
    for (;;) {
      const text = openEditor(file)
      if (text === original) return `${relative(current.file)} unchanged`
      if (text === rejected) {
        throw new OnesecretError(
          'edit aborted, the file still has the same error',
          'EVALUE'
        )
      }
      try {
        return `${relative(
          write.writeLayer(current, write.fromEditableYaml(text))
        )} encrypted`
      } catch (error) {
        if (error.code !== 'EVALUE') throw error
        console.error(
          `${error.message}\nReopening the editor, save it unchanged to abort.`
        )
        rejected = text
      }
    }
  } finally {
    removeWorkspace()
    for (const signal of EDIT_SIGNALS) process.off(signal, onSignal)
  }
}

const exec = (flags, command) => {
  if (command.length === 0) usage('exec needs a command after --')
  const env = withoutAgeKey(process.env)
  secrets.config({
    ...readOptions(flags),
    processEnv: env,
    allowKeyCommand: true
  })
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', env })
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) { process.on(signal, () => child.kill(signal)) }
  return new Promise((resolve, reject) => {
    child.on('error', error =>
      reject(
        new OnesecretError(
          `cannot run ${command[0]}: ${error.message}`,
          'EUSAGE'
        )
      )
    )
    child.on('exit', (code, signal) =>
      resolve({ exitCode: signal ? 128 + os.constants.signals[signal] : code })
    )
  })
}

const COMMANDS = {
  init: flags => {
    const result = write.initialize(writeOptions(flags))
    if (!result.created) {
      return `already initialized for ${result.recipient} (${relative(
        result.sopsConfigFile
      )})`
    }
    return [
      `public key   ${result.recipient}`,
      `private key  appended to ${result.keysFile}`,
      `sops config  ${relative(result.sopsConfigFile)}`,
      `secrets      ${relative(result.defaultFile)}`,
      '',
      'Store the private key as SOPS_AGE_KEY in your CI, and share it with your team through a password manager.'
    ].join('\n')
  },
  set: (flags, args) => {
    if (args.length === 0) usage('set needs at least one NAME=value')
    return `${relative(
      write.set(writeOptions(flags), writeLayerOf(flags), args)
    )} encrypted`
  },
  unset: (flags, args) => {
    if (args.length === 0) usage('unset needs at least one NAME')
    return `${relative(
      write.unset(writeOptions(flags), writeLayerOf(flags), args)
    )} encrypted`
  },
  edit,
  rekey: flags =>
    `${relative(
      write.rekey(writeOptions(flags), writeLayerOf(flags))
    )} encrypted with a new data key`,
  ls: flags => secrets.names(readOptions(flags)).join('\n'),
  get: (flags, args) => {
    if (args.length !== 1) usage('get needs exactly one NAME')
    const values = secrets.load(readOptions(flags))
    if (!Object.hasOwn(values, args[0])) { throw new OnesecretError(`"${args[0]}" is not a secret`, 'EVALUE') }
    return toEnvValue(args[0], values[args[0]])
  },
  dotenv: flags => toDotenv(secrets.load(readOptions(flags))).trimEnd(),
  exec: (flags, args) => exec(flags, args),
  kubernetes: flags => {
    const { checksum, output } = deploy.kubernetes({
      ...readOptions(flags),
      name: flags.name,
      namespace: flags.namespace,
      context: flags.context
    })
    if (output) console.error(output)
    return checksum
  },
  fly: flags => {
    const { checksum, output } = deploy.fly({
      ...readOptions(flags),
      app: flags.app,
      stage: flags.stage
    })
    if (output) console.error(output)
    return checksum
  }
}

const parse = argv => {
  const separator = argv.indexOf('--')
  const own = separator === -1 ? argv : argv.slice(0, separator)
  const rest = separator === -1 ? [] : argv.slice(separator + 1)
  const {
    _: [command, ...args],
    ...flags
  } = mri(own, {
    boolean: ['help', 'version', 'stage'],
    string: ['dir', 'env', 'cwd', 'name', 'namespace', 'context', 'app'],
    alias: { h: 'help', v: 'version', e: 'env', n: 'namespace' },
    default: { stage: true }
  })
  return {
    command,
    args: command === 'exec' ? rest : [...args, ...rest],
    flags
  }
}

const run = async argv => {
  const { command, args, flags } = parse(argv)
  if (flags.version) return { stdout: require('../package.json').version }
  if (flags.help || !command) return { stdout: HELP.trimEnd() }
  const handler = COMMANDS[command]
  if (!handler) usage(`unknown command "${command}"`)
  const result = await handler(flags, args)
  return typeof result === 'object' ? result : { stdout: result }
}

module.exports = { run }
