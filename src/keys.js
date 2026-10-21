'use strict'

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const age = require('./age')
const { OnesecretError } = require('./error')

const KEYS_FILE = path.join('sops', 'age', 'keys.txt')
const AGE_KEY_VARIABLES = [
  'SOPS_AGE_KEY',
  'SOPS_AGE_KEY_FILE',
  'SOPS_AGE_KEY_CMD'
]

const sopsKeysFile = () => {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, KEYS_FILE)
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', KEYS_FILE)
  }
  return path.join(os.homedir(), '.config', KEYS_FILE)
}

const defaultKeyFiles = () => [
  ...new Set([sopsKeysFile(), path.join(os.homedir(), '.config', KEYS_FILE)])
]

const readKeyFile = file => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (error) {
    throw new OnesecretError(
      `cannot read age key file ${file}: ${error.code || error.message}`,
      'EKEY'
    )
  }
}

const parseSource = (label, text) => {
  try {
    return age.parseIdentities(text)
  } catch (error) {
    throw new OnesecretError(
      `${label} holds an invalid age key: ${error.message}`,
      'EKEY'
    )
  }
}

const localSources = () => [
  ...(process.env.SOPS_AGE_KEY
    ? [['SOPS_AGE_KEY', () => process.env.SOPS_AGE_KEY]]
    : []),
  ...(process.env.SOPS_AGE_KEY_FILE
    ? [
        [
          process.env.SOPS_AGE_KEY_FILE,
          () => readKeyFile(process.env.SOPS_AGE_KEY_FILE)
        ]
      ]
    : []),
  ...defaultKeyFiles()
    .filter(file => fs.existsSync(file))
    .map(file => [file, () => readKeyFile(file)])
]

const localIdentities = () => {
  const identities = []
  const invalid = []
  for (const [label, read] of localSources()) {
    try {
      identities.push(...parseSource(label, read()))
    } catch (error) {
      invalid.push(error)
    }
  }
  return { identities, invalid }
}

const withSkippedSources = (error, invalid) => {
  if (error.code !== 'EKEY' || invalid.length === 0) return error
  const skipped = invalid.map(({ reason }) => reason).join('; ')
  return new OnesecretError(`${error.reason} (skipped: ${skipped})`, 'EKEY')
}

const commandCache = new Map()

const runKeyCommand = command => {
  if (!commandCache.has(command)) {
    try {
      commandCache.set(command, { identities: readKeyCommand(command) })
    } catch (error) {
      commandCache.set(command, { error })
    }
  }
  const { identities, error } = commandCache.get(command)
  if (error) throw error
  return identities
}

const readKeyCommand = command => {
  let output
  try {
    output = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (error) {
    const detail = error.stderr
      ? String(error.stderr).trim().split('\n')[0]
      : ''
    throw new OnesecretError(
      `key command "${command}" failed${detail ? `: ${detail}` : ''}`,
      'EKEY'
    )
  }
  const identities = parseSource(`key command "${command}"`, output)
  if (identities.length === 0) {
    throw new OnesecretError(
      `key command "${command}" printed no age identity`,
      'EKEY'
    )
  }
  return identities
}

const keyCommandOf = keyCommand => process.env.SOPS_AGE_KEY_CMD || keyCommand

const withIdentities = (keyCommand, use, { allowKeyCommand = true } = {}) => {
  const { identities, invalid } = localIdentities()
  const command = allowKeyCommand ? keyCommandOf(keyCommand) : undefined
  if (identities.length === 0 && !command) {
    if (invalid.length > 0) throw invalid[0]
    const sources = `set SOPS_AGE_KEY or SOPS_AGE_KEY_FILE, or add it to ${sopsKeysFile()}`
    const hint = allowKeyCommand
      ? `${sources}, or configure a keyCommand`
      : `${sources} (keyCommand is not run here)`
    throw new OnesecretError(`no age key found: ${hint}`, 'ENOKEY')
  }
  if (identities.length > 0) {
    try {
      return use(identities)
    } catch (error) {
      if (error.code !== 'EKEY' || !command) {
        throw withSkippedSources(error, invalid)
      }
    }
  }
  return use(runKeyCommand(command))
}

const withoutAgeKey = env =>
  Object.fromEntries(
    Object.entries(env).filter(([name]) => !AGE_KEY_VARIABLES.includes(name))
  )

module.exports = {
  sopsKeysFile,
  withIdentities,
  withoutAgeKey
}
