'use strict'

const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const mri = require('mri')
const secrets = require('./secrets')
const write = require('./write')
const store = require('./store')
const { isEnvScalar, toDotenv, toEnv } = require('./format')
const yaml = require('./yaml')
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

const readLayersFor = (command, flags) => {
  const layered = secrets.readLayers(readOptions(flags))
  if (!flags.env) return layered
  return secrets.requireEnvLayer(
    layered,
    `${command} found no "${layered.env}" layer in ${layered.dir}, check the --env name`
  )
}

const writeLayerOf = flags => flags.env || 'default'

const relative = file => path.relative(process.cwd(), file) || file

const shellQuote = text => `'${text.replace(/'/g, "'\\''")}'`

const WAIT_FLAGS = {
  atom: '--wait',
  bbedit: '-w',
  clion: '--wait',
  code: '--wait',
  'code-insiders': '--wait',
  codium: '--wait',
  cursor: '--wait',
  gedit: '--wait',
  goland: '--wait',
  gvim: '-f',
  idea: '--wait',
  kate: '--block',
  mate: '-w',
  mvim: '-f',
  nova: '--wait',
  phpstorm: '--wait',
  pycharm: '--wait',
  rider: '--wait',
  rubymine: '--wait',
  subl: '--wait',
  webstorm: '--wait',
  windsurf: '--wait',
  zed: '--wait'
}

const waitingEditor = editor => {
  const [command, ...args] = editor.trim().split(/\s+/)
  const flag = WAIT_FLAGS[path.basename(command)]
  if (!flag || [flag, '-w', '--wait'].some(wait => args.includes(wait))) {
    return editor
  }
  return `${editor} ${flag}`
}

const openEditor = file => {
  const editor = waitingEditor(process.env.VISUAL || process.env.EDITOR || 'vi')
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
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

const EDIT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP']

const assertOnlyFileOfLayer = (file, kind) => {
  const dir = path.dirname(file)
  const layer = secrets.assertEnv(store.layerOfFile(file))
  const existing =
    kind === 'plain'
      ? store.findPlainFile(dir, layer)
      : store.findLayerFile(dir, layer)
  if (existing && existing !== file) {
    throw new OnesecretError(
      `${relative(existing)} already holds the ${layer} layer, edit it instead`,
      'EUSAGE'
    )
  }
}

const plainTarget = file => {
  const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  return {
    file,
    original,
    workspaceName: path.basename(file),
    save: copy => {
      try {
        store.readPlain(copy)
      } catch (error) {
        throw new OnesecretError(
          error.reason.split(copy).join(relative(file)),
          'EVALUE'
        )
      }
      store.writeText(file, fs.readFileSync(copy, 'utf8'))
      return `${relative(file)} saved`
    }
  }
}

const encryptedTarget = current => {
  write.encryptionFor(current.file, current.existing)
  return {
    file: current.file,
    original: write.toEditableYaml(current.tree),
    workspaceName: path
      .basename(current.file)
      .replace(/\.enc\.(ya?ml|json)$/, '.yml'),
    save: copy =>
      `${relative(
        write.writeLayer(
          current,
          write.fromEditableYaml(fs.readFileSync(copy, 'utf8'))
        )
      )} encrypted`
  }
}

const editTargetOf = (flags, args) => {
  if (args.length > 1) usage('edit takes at most one file')
  if (args.length === 0) {
    return encryptedTarget(
      write.readLayer(writeOptions(flags), writeLayerOf(flags))
    )
  }
  if (flags.env) usage('edit takes a file or --env, not both')
  const file = path.resolve(flags.cwd || process.cwd(), args[0])
  const kind = store.fileKindOf(file)
  if (!kind) usage(`edit needs a .yml, .yaml, or .json file, got "${args[0]}"`)
  assertOnlyFileOfLayer(file, kind)
  return kind === 'plain'
    ? plainTarget(file)
    : encryptedTarget(write.readFile(writeOptions(flags), file))
}

const saveErrorOf = error =>
  error instanceof OnesecretError
    ? error.message
    : `onesecret: cannot save, ${error.code || error.message}`

const editInWorkspace = (target, copy) => {
  fs.writeFileSync(copy, target.original, { mode: 0o600 })
  let failed = null
  for (;;) {
    const text = openEditor(copy)
    if (text === target.original) return `${relative(target.file)} unchanged`
    const retry = failed !== null && text === failed.text
    if (retry && failed.invalid) {
      throw new OnesecretError(
        `edit aborted, ${relative(target.file)} is unchanged`,
        'EVALUE'
      )
    }
    try {
      return target.save(copy)
    } catch (error) {
      console.error(
        `${saveErrorOf(error)}\nReopening the editor, save it unchanged to ${
          error instanceof OnesecretError ? 'abort' : 'try again'
        }.`
      )
      failed = { text, invalid: error instanceof OnesecretError }
    }
  }
}

const edit = (flags, args) => {
  const target = editTargetOf(flags, args)
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'onesecret-'))
  const removeWorkspace = () =>
    fs.rmSync(workspace, { recursive: true, force: true })
  const onSignal = signal => {
    removeWorkspace()
    process.exit(128 + os.constants.signals[signal])
  }
  for (const signal of EDIT_SIGNALS) process.on(signal, onSignal)
  try {
    return editInWorkspace(target, path.join(workspace, target.workspaceName))
  } finally {
    removeWorkspace()
    for (const signal of EDIT_SIGNALS) process.off(signal, onSignal)
  }
}

const exec = (flags, command) => {
  if (command.length === 0) usage('exec needs a command after --')
  const env = withoutAgeKey(process.env)
  if (flags.env) env.NODE_ENV = flags.env
  secrets.writeEnv(
    { ...readOptions(flags), processEnv: env },
    { allowKeyCommand: true }
  )
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', env })
  for (const signal of EDIT_SIGNALS) {
    process.on(signal, () => child.kill(signal))
  }
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
    if (result.status === 'existing') {
      return `already initialized for ${result.recipients.join(
        ','
      )} (${relative(result.defaultFile)})`
    }
    if (result.status === 'adopted') {
      return `created ${relative(
        result.defaultFile
      )} for ${result.recipients.join(',')} (from ${result.source})`
    }
    return [
      `public key   ${result.recipients[0]}`,
      `private key  ${result.identity}`,
      `secrets      ${relative(result.defaultFile)}`,
      '',
      'The private key is shown only now and is not saved anywhere. Keep it in your',
      'password manager and as SOPS_AGE_KEY in CI. To use it in this shell:',
      '',
      `  export SOPS_AGE_KEY=${result.identity}`
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
  ls: flags => secrets.namesOf(readLayersFor('ls', flags)).join('\n'),
  get: (flags, args) => {
    if (args.length !== 1) usage('get needs exactly one NAME')
    const values = secrets.get(readOptions(flags), args[0])
    if (!Object.hasOwn(values, args[0])) {
      throw new OnesecretError(`"${args[0]}" is not set in any layer`, 'EVALUE')
    }
    const value = values[args[0]]
    if (value === null) return { stdout: '', exact: true }
    return {
      stdout: isEnvScalar(value) ? String(value) : yaml.dump(value).trimEnd(),
      exact: true
    }
  },
  dotenv: flags => {
    const loaded = secrets.loadSecrets(readLayersFor('dotenv', flags))
    return flags.json
      ? JSON.stringify(toEnv(loaded))
      : toDotenv(loaded).trimEnd()
  },
  exec: (flags, args) => exec(flags, args)
}

const parse = argv => {
  const separator = argv.indexOf('--')
  const own = separator === -1 ? argv : argv.slice(0, separator)
  const rest = separator === -1 ? [] : argv.slice(separator + 1)
  const {
    _: [command, ...args],
    ...flags
  } = mri(own, {
    boolean: ['help', 'version', 'json'],
    string: ['dir', 'env', 'cwd'],
    alias: { h: 'help', v: 'version', e: 'env' }
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
  if (flags.json && command !== 'dotenv') usage('--json only works with dotenv')
  const result = await handler(flags, args)
  return typeof result === 'object' ? result : { stdout: result }
}

const render = ({ stdout, exact = false }, isTTY) => {
  if (exact && !isTTY) return stdout
  return stdout ? `${stdout}\n` : ''
}

module.exports = { render, run }
