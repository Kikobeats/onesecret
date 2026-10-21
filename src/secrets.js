'use strict'

const fs = require('node:fs')
const path = require('node:path')
const sops = require('./sops')
const store = require('./store')
const { withIdentities } = require('./keys')
const { toEnvValue } = require('./format')
const { OnesecretError } = require('./error')

const DEFAULT_DIR = 'secrets'
const DEFAULT_ENV = 'development'
const SKIP_VARIABLE = 'ONESECRET_SKIP'
const DEPLOYED_ENVS = ['production', 'staging']
const KEY_ERRORS = ['ENOKEY', 'EKEY']

const packageSettings = cwd => {
  try {
    return (
      JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))
        .onesecret || {}
    )
  } catch {
    return {}
  }
}

const resolveOptions = (options = {}) => {
  const cwd = path.resolve(options.cwd || process.cwd())
  const settings = packageSettings(cwd)
  return {
    cwd,
    dir: path.resolve(cwd, options.dir || settings.dir || DEFAULT_DIR),
    env: options.env || process.env.NODE_ENV || DEFAULT_ENV,
    keyCommand: options.keyCommand || settings.keyCommand
  }
}

const readLayers = options => {
  const { dir, env, keyCommand } = resolveOptions(options)
  const files = Object.fromEntries(
    store
      .layersFor(env)
      .map(layer => [layer, store.findLayerFile(dir, layer)])
      .filter(([, file]) => file)
  )
  const documents = Object.values(files).map(store.readDocument)
  return { dir, documents, env, files, keyCommand }
}

const namesOf = documents => [...new Set(documents.flatMap(sops.names))]

const decryptLayers = (documents, keyCommand, keyOptions) => {
  if (documents.length === 0) return {}
  return withIdentities(
    keyCommand,
    identities =>
      documents.reduce(
        (merged, document) => ({
          ...merged,
          ...sops.decrypt(document, identities)
        }),
        {}
      ),
    keyOptions
  )
}

const decryptDocument = (document, keyCommand) =>
  decryptLayers([document], keyCommand)

const names = options => namesOf(readLayers(options).documents)

const load = options => {
  const { documents, keyCommand } = readLayers(options)
  return decryptLayers(documents, keyCommand)
}

const isUnset = (target, name) =>
  !Object.hasOwn(target, name) || target[name] === undefined

const missingIn = (target, secretNames) =>
  secretNames.filter(name => isUnset(target, name))

const config = (options = {}) => {
  const target = options.processEnv || process.env
  if (process.env[SKIP_VARIABLE] === '1') return {}
  const { dir, documents, env, keyCommand } = readLayers(options)
  if (documents.length === 0) { throw new OnesecretError(`no encrypted files found in ${dir}`, 'EMISSING') }
  const secretNames = namesOf(documents)
  const missing = missingIn(target, secretNames)
  if (missing.length > 0) {
    let decrypted
    try {
      const allowKeyCommand =
        options.allowKeyCommand ?? !DEPLOYED_ENVS.includes(env)
      decrypted = decryptLayers(documents, keyCommand, { allowKeyCommand })
    } catch (error) {
      if (!KEY_ERRORS.includes(error.code)) throw error
      const verb = missing.length === 1 ? 'is' : 'are'
      throw new OnesecretError(
        `${missing.join(', ')} ${verb} not set and cannot be decrypted, ${
          error.reason
        }`,
        'EMISSING'
      )
    }
    for (const name of missing) target[name] = toEnvValue(name, decrypted[name])
  }
  return Object.fromEntries(secretNames.map(name => [name, target[name]]))
}

module.exports = {
  config,
  decryptDocument,
  decryptLayers,
  load,
  names,
  readLayers,
  resolveOptions
}
