'use strict'

const fs = require('node:fs')
const path = require('node:path')
const yaml = require('./yaml')
const jsYaml = require('js-yaml')
const { rulesOf } = require('./sops')
const { goRegExp } = require('./regexp')
const { OnesecretError } = require('./error')

const DEFAULT_LAYER = 'default'
const EXTENSIONS = ['.enc.yml', '.enc.yaml', '.enc.json']
const PLAIN_EXTENSIONS = ['.yml', '.yaml', '.json']
const ENCRYPTED_FILE = /^(.+)\.enc\.(ya?ml|json)$/
const PLAIN_FILE = /^(.+)\.(ya?ml|json)$/
const SOPS_CONFIG = '.sops.yaml'

const isJson = file => file.endsWith('.json')

const stringify = (file, document) =>
  isJson(file) ? yaml.dumpJson(document) : yaml.dump(document)

const layersFor = env =>
  env && env !== DEFAULT_LAYER ? [DEFAULT_LAYER, env] : [DEFAULT_LAYER]

const namesIn = dir => {
  try {
    return new Set(fs.readdirSync(dir))
  } catch {
    return new Set()
  }
}

const findFile = (dir, layer, extensions) => {
  const names = namesIn(dir)
  const found = extensions
    .map(extension => layer + extension)
    .filter(name => names.has(name))
    .map(name => path.join(dir, name))
  if (found.length > 1) {
    throw new OnesecretError(
      `${found
        .map(file => path.basename(file))
        .join(' and ')} both hold the ${layer} layer in ${dir}, keep one`,
      'EFORMAT'
    )
  }
  return found[0]
}

const findLayerFile = (dir, layer) => findFile(dir, layer, EXTENSIONS)

const findPlainFile = (dir, layer) => findFile(dir, layer, PLAIN_EXTENSIONS)

const layerOfFile = file => {
  const name = path.basename(file)
  return (ENCRYPTED_FILE.exec(name) || PLAIN_FILE.exec(name))[1]
}

const fileKindOf = file => {
  const name = path.basename(file)
  if (ENCRYPTED_FILE.test(name)) return 'encrypted'
  if (PLAIN_FILE.test(name)) return 'plain'
  return null
}

const layerFileOrNew = (dir, layer) =>
  findLayerFile(dir, layer) || path.join(dir, layer + EXTENSIONS[0])

const parseErrorOf = error => {
  if (error.mark) {
    return `invalid YAML at line ${error.mark.line + 1}, column ${
      error.mark.column + 1
    }`
  }
  if (error instanceof SyntaxError) return 'not valid JSON'
  return error.code || error.message
}

const readDocument = file => {
  try {
    return yaml.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new OnesecretError(
      `cannot read ${file}: ${parseErrorOf(error)}`,
      'EFORMAT'
    )
  }
}

const isMapping = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const onlyDocument = (file, text) => {
  const documents = jsYaml.loadAll(text)
  if (documents.length > 1) {
    throw new OnesecretError(
      `${file} must hold a single YAML document`,
      'EFORMAT'
    )
  }
  return documents[0]
}

const parsePlain = (file, text) => {
  if (!isJson(file)) return onlyDocument(file, text)
  return text.trim() === '' ? null : JSON.parse(text)
}

const readPlain = file => {
  let values
  try {
    values = parsePlain(file, fs.readFileSync(file, 'utf8'))
  } catch (error) {
    if (error instanceof OnesecretError) throw error
    throw new OnesecretError(
      `cannot read ${file}: ${parseErrorOf(error)}`,
      'EFORMAT'
    )
  }
  if (values === undefined || values === null) return {}
  if (!isMapping(values)) {
    throw new OnesecretError(
      `${file} must be a mapping of NAME: value`,
      'EFORMAT'
    )
  }
  if (isMapping(values.sops) && values.sops.mac) {
    throw new OnesecretError(
      `${file} is encrypted with sops, rename it to ${path
        .basename(file)
        .replace(PLAIN_FILE, '$1.enc.$2')}`,
      'EFORMAT'
    )
  }
  return values
}

const modeOf = file => {
  try {
    return fs.statSync(file).mode & 0o777
  } catch {
    return null
  }
}

const realPathOf = file => {
  try {
    return fs.realpathSync(file)
  } catch {
    return file
  }
}

const writeText = (link, text) => {
  const file = realPathOf(link)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const mode = modeOf(file)
  const temporary = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temporary, text)
  if (mode !== null) fs.chmodSync(temporary, mode)
  fs.renameSync(temporary, file)
}

const writeDocument = (file, document) =>
  writeText(file, stringify(file, document))

const readSopsConfig = file => {
  try {
    return (
      jsYaml.load(fs.readFileSync(file, 'utf8'), {
        schema: jsYaml.CORE_SCHEMA
      }) || {}
    )
  } catch (error) {
    throw new OnesecretError(
      `cannot read ${file}: ${error.reason || error.message}`,
      'EFORMAT'
    )
  }
}

const findSopsConfig = from => {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, SOPS_CONFIG)
    if (fs.existsSync(candidate)) return candidate
    if (dir === path.dirname(dir)) return null
  }
}

const splitRecipients = value =>
  (Array.isArray(value) ? value : String(value).split(','))
    .map(recipient => recipient.trim())
    .filter(Boolean)

const creationRule = file => {
  const configFile = findSopsConfig(path.dirname(file))
  if (!configFile) return null
  const config = readSopsConfig(configFile)
  const relative = path
    .relative(path.dirname(configFile), file)
    .split(path.sep)
    .join('/')
  const rule = (config.creation_rules || []).find(
    ({ path_regex: pattern }) => !pattern || goRegExp(pattern).test(relative)
  )
  if (!rule || !rule.age) return null
  const rules = rulesOf(rule)
  return {
    recipients: splitRecipients(rule.age),
    rules: Object.keys(rules).length > 0 ? rules : undefined
  }
}

module.exports = {
  DEFAULT_LAYER,
  SOPS_CONFIG,
  creationRule,
  readSopsConfig,
  fileKindOf,
  findLayerFile,
  findPlainFile,
  isMapping,
  layerOfFile,
  parseErrorOf,
  layerFileOrNew,
  layersFor,
  readDocument,
  readPlain,
  stringify,
  writeDocument,
  writeText
}
