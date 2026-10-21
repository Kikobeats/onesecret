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
const SOPS_CONFIG = '.sops.yaml'

const isJson = file => file.endsWith('.json')

const stringify = (file, document) =>
  isJson(file) ? yaml.dumpJson(document) : yaml.dump(document)

const layersFor = env =>
  env && env !== DEFAULT_LAYER ? [DEFAULT_LAYER, env] : [DEFAULT_LAYER]

const findLayerFile = (dir, layer) =>
  EXTENSIONS.map(extension => path.join(dir, layer + extension)).find(file =>
    fs.existsSync(file)
  )

const layerFileOrNew = (dir, layer) =>
  findLayerFile(dir, layer) || path.join(dir, layer + EXTENSIONS[0])

const readDocument = file => {
  try {
    return yaml.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new OnesecretError(`cannot read ${file}: ${error.message}`, 'EFORMAT')
  }
}

const writeDocument = (file, document) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temporary, stringify(file, document))
  fs.renameSync(temporary, file)
}

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
  findLayerFile,
  layerFileOrNew,
  layersFor,
  readDocument,
  stringify,
  writeDocument
}
