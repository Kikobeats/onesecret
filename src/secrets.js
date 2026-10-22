'use strict'

const fs = require('node:fs')
const path = require('node:path')
const sops = require('./sops')
const store = require('./store')
const { withIdentities } = require('./keys')
const { isEnvName, isEnvScalar, toEnvValue } = require('./format')
const { OnesecretError } = require('./error')

const DEFAULT_DIR = 'config'
const DEFAULT_ENV = 'development'
const SKIP_VARIABLE = 'ONESECRET_SKIP'
const DEPLOYED_ENVS = ['production', 'staging']
const EXPORTABLE_TYPES = ['str', 'int', 'float', 'bool', 'time', 'null']
const FILE_LIKE_ENV = /(^|\.)enc(\.|$)|\.(ya?ml|json)$/i
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

const ENV_NAME = /^[a-z0-9_-][a-z0-9_.-]*$/

const assertEnv = env => {
  if (!ENV_NAME.test(env) || env.includes('..') || FILE_LIKE_ENV.test(env)) {
    throw new OnesecretError(
      `"${env}" is not a valid env name, use lowercase letters, digits, ".", "_", or "-"`,
      'EVALUE'
    )
  }
  return env
}

const optionsOf = input =>
  typeof input === 'string' ? { env: input } : input || {}

const resolveOptions = input => {
  const options = optionsOf(input)
  const cwd = path.resolve(options.cwd || process.cwd())
  const settings = packageSettings(cwd)
  return {
    cwd,
    dir: path.resolve(cwd, options.dir || settings.dir || DEFAULT_DIR),
    env:
      options.env ||
      (options.processEnv || process.env).NODE_ENV ||
      DEFAULT_ENV,
    keyCommand: options.keyCommand || settings.keyCommand
  }
}

const readLayer = (dir, name) => {
  const plainFile = store.findPlainFile(dir, name)
  const encryptedFile = store.findLayerFile(dir, name)
  return {
    name,
    plainFile,
    encryptedFile,
    values: plainFile ? store.readPlain(plainFile) : {},
    document: encryptedFile ? readEncrypted(encryptedFile) : null
  }
}

const readEncrypted = file => {
  const document = store.readDocument(file)
  if (document === null) return null
  try {
    sops.names(document)
  } catch (error) {
    throw new OnesecretError(`${file}: ${error.reason}`, error.code)
  }
  return document
}

const readLayers = input => {
  const { dir, env, keyCommand } = resolveOptions(input)
  assertEnv(env)
  const layers = store.layersFor(env).map(name => readLayer(dir, name))
  return { dir, env, keyCommand, layers }
}

const documentsOf = layers =>
  layers.map(({ document }) => document).filter(Boolean)

const hasFiles = layers =>
  layers.some(({ plainFile, encryptedFile }) => plainFile || encryptedFile)

const isPlainObject = value =>
  Object.prototype.toString.call(value) === '[object Object]'

const secretsOf = layers => {
  const topmost = new Map()
  for (const layer of layers) {
    for (const [name, value] of Object.entries(layer.values)) {
      const merges =
        isPlainObject(value) && topmost.get(name)?.type === 'mapping'
      if (!merges) topmost.set(name, null)
    }
    if (!layer.document) continue
    for (const [name, type] of Object.entries(
      sops.valueTypes(layer.document)
    )) {
      topmost.set(name, { type, file: layer.encryptedFile })
    }
  }
  return new Map([...topmost].filter(([, secret]) => secret))
}

const secretNamesOf = layers => [...secretsOf(layers).keys()]

const decryptDocuments = (documents, keyCommand, keyOptions) => {
  if (documents.length === 0) return []
  return withIdentities(
    keyCommand,
    identities => documents.map(document => sops.decrypt(document, identities)),
    keyOptions
  )
}

const decryptDocument = (document, keyCommand) =>
  decryptDocuments([document], keyCommand)[0]

const UNSAFE_NAME = '__proto__'

const assign = (target, name, value) =>
  Object.defineProperty(target, name, {
    value,
    enumerable: true,
    writable: true,
    configurable: true
  })

const deepMerge = (base, override) => {
  const merged = { ...base }
  for (const [name, value] of Object.entries(override)) {
    if (name === UNSAFE_NAME) continue
    const current = Object.hasOwn(merged, name) ? merged[name] : undefined
    assign(
      merged,
      name,
      isPlainObject(value)
        ? deepMerge(isPlainObject(current) ? current : {}, value)
        : value
    )
  }
  return merged
}

const withoutMetadata = document => pick(document, sops.names(document))

const mergeLayers = (layers, decrypted) => {
  const trees = decrypted
    ? [...decrypted]
    : documentsOf(layers).map(withoutMetadata)
  const merged = layers.reduce((merged, layer) => {
    const withPlain = deepMerge(merged, layer.values)
    return layer.document ? deepMerge(withPlain, trees.shift()) : withPlain
  }, {})
  if (decrypted) return merged
  for (const name of secretNamesOf(layers)) delete merged[name]
  return merged
}

const pick = (values, names) => {
  const picked = {}
  for (const name of names) {
    if (Object.hasOwn(values, name)) assign(picked, name, values[name])
  }
  return picked
}

const names = input => secretNamesOf(readLayers(input).layers)

const namesOf = layered => secretNamesOf(layered.layers)

const requireEnvLayer = (layered, message) => {
  const envLayer = layered.layers.find(({ name }) => name === layered.env)
  if (!envLayer.plainFile && !envLayer.encryptedFile) {
    throw new OnesecretError(message, 'EVALUE')
  }
  return layered
}

const loadLayers = ({ layers, keyCommand }) =>
  mergeLayers(layers, decryptDocuments(documentsOf(layers), keyCommand))

const load = input => loadLayers(readLayers(input))

const get = (input, name) => {
  const layered = readLayers(input)
  return secretNamesOf(layered.layers).includes(name)
    ? loadLayers(layered)
    : mergeLayers(layered.layers, null)
}

const loadSecrets = layered =>
  pick(loadLayers(layered), secretNamesOf(layered.layers))

const isUnset = (target, name) =>
  !Object.hasOwn(target, name) || target[name] === undefined

const nameOrder = layers => [
  ...new Set(
    layers.flatMap(layer => [
      ...Object.keys(layer.values),
      ...(layer.document ? sops.names(layer.document) : [])
    ])
  )
]

const decryptForConfig = (
  { layers, env, keyCommand },
  missing,
  allowKeyCommand = !DEPLOYED_ENVS.includes(env)
) => {
  try {
    return decryptDocuments(documentsOf(layers), keyCommand, {
      allowKeyCommand
    })
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
}

const isExportable = (name, value) =>
  isEnvName(name) && (value === null || isEnvScalar(value))

const ENV_PARSERS = {
  int: text => {
    if (!/^-?\d+$/.test(text)) return undefined
    const number = Number(text)
    return Number.isSafeInteger(number) ? number : BigInt(text)
  },
  float: text => Number(text),
  null: text => (text === '' ? null : undefined),
  bool: text => ({ true: true, false: false }[text])
}

const envStringOf = value => (value === null ? '' : String(value))

const roundTrips = (value, text) =>
  value !== undefined && envStringOf(value) === text

const typedSecret = (text, secret) => {
  const parse = secret && ENV_PARSERS[secret.type]
  const value = parse ? parse(text) : undefined
  return roundTrips(value, text) ? value : text
}

const typedFromEnv = (name, text, merged, secret) => {
  if (secret || !Object.hasOwn(merged, name)) {
    return typedSecret(text, secret)
  }
  const value = merged[name]
  return isExportable(name, value) && roundTrips(value, text) ? value : text
}

const assertScalarSecrets = (secrets, missing) => {
  for (const name of missing) {
    const { type, file } = secrets.get(name)
    if (!isEnvName(name)) {
      throw new OnesecretError(
        `"${name}" in ${file} cannot be an environment variable name, so config() could never find it set`,
        'EFORMAT'
      )
    }
    if (!EXPORTABLE_TYPES.includes(type)) {
      throw new OnesecretError(
        `"${name}" in ${file} has type ${type}, config() needs each secret to be a string, number, or boolean`,
        'EFORMAT'
      )
    }
  }
}

const config = input => fill(input)

const fill = (input, { allowKeyCommand } = {}) => {
  const options = optionsOf(input)
  const target = options.processEnv || process.env
  const skip = target[SKIP_VARIABLE] === '1'
  const layered = readLayers(options)
  if (!hasFiles(layered.layers)) {
    if (skip) return {}
    throw new OnesecretError(
      `no config files for "default" or "${layered.env}" found in ${layered.dir}`,
      'EMISSING'
    )
  }
  const secrets = secretsOf(layered.layers)
  const missing = [...secrets.keys()].filter(name => isUnset(target, name))
  if (!skip) assertScalarSecrets(secrets, missing)
  const decrypted =
    missing.length > 0 && !skip
      ? decryptForConfig(layered, missing, allowKeyCommand)
      : null
  const merged = mergeLayers(layered.layers, decrypted)
  const result = {}
  for (const name of nameOrder(layered.layers)) {
    if (!isUnset(target, name)) {
      assign(
        result,
        name,
        typedFromEnv(name, target[name], merged, secrets.get(name))
      )
    } else if (Object.hasOwn(merged, name)) {
      const value = merged[name]
      assign(result, name, value)
      if (isExportable(name, value)) target[name] = toEnvValue(name, value)
    }
  }
  return result
}

module.exports = {
  assertEnv,
  config,
  decryptDocument,
  fill,
  get,
  load,
  loadSecrets,
  names,
  namesOf,
  requireEnvLayer,
  readLayers,
  resolveOptions
}
