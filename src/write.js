'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { isDeepStrictEqual } = require('node:util')
const yaml = require('./yaml')
const age = require('./age')
const sops = require('./sops')
const store = require('./store')
const { assertEnv, decryptDocument, resolveOptions } = require('./secrets')
const { assertEnvName, isEnvScalar } = require('./format')
const { exportedRecipients } = require('./keys')
const { OnesecretError } = require('./error')

const RESERVED_NAME = 'sops'

const SELECTOR_RULES = [
  'unencrypted_suffix',
  'encrypted_suffix',
  'unencrypted_regex',
  'encrypted_regex'
]

const withDefaultSelector = rules =>
  SELECTOR_RULES.some(key => rules[key])
    ? rules
    : { ...sops.DEFAULT_RULES, ...rules }

const assertRecipients = (recipients, source) => {
  for (const recipient of recipients) {
    try {
      age.parseRecipient(recipient)
    } catch (error) {
      throw new OnesecretError(
        `${source} has an invalid age recipient "${recipient}": ${error.message}`,
        'EFORMAT'
      )
    }
  }
}

const recipientsOfFile = (file, document) => {
  try {
    return {
      recipients: sops.recipientsOf(document),
      rules: sops.rulesOf(document.sops)
    }
  } catch (error) {
    throw new OnesecretError(
      `${file}: ${error.reason || error.message}`,
      'EFORMAT'
    )
  }
}

const defaultLayerOf = file => {
  const defaultFile = store.findLayerFile(
    path.dirname(file),
    store.DEFAULT_LAYER
  )
  if (!defaultFile || defaultFile === file) return null
  const document = store.readDocument(defaultFile)
  if (!document) return null
  const { recipients, rules } = recipientsOfFile(defaultFile, document)
  return recipients.length > 0
    ? { recipients, rules, source: defaultFile }
    : null
}

const exportedSource = () => ({
  recipients: exportedRecipients(),
  source: 'SOPS_AGE_KEY'
})

const recipientsFor = (file, existing) => {
  const rule = store.creationRule(file)
  if (rule) {
    return {
      recipients: rule.recipients,
      rules: rule.rules,
      source: store.SOPS_CONFIG
    }
  }
  if (existing) return { recipients: sops.recipientsOf(existing), source: file }
  return defaultLayerOf(file) || exportedSource()
}

const encryptionFor = (file, existing) => {
  const others = existing ? sops.otherKeySources(existing.sops) : []
  if (others.length > 0) {
    throw new OnesecretError(
      `${file} is also encrypted with ${others.join(
        ', '
      )}, which onesecret cannot keep, use sops`,
      'EFORMAT'
    )
  }
  const { recipients, source, rules: inherited } = recipientsFor(file, existing)
  if (recipients.length === 0) {
    throw new OnesecretError(
      `no age recipient for ${file}: export SOPS_AGE_KEY with the key that should open it, or run "onesecret init"`,
      'ENOKEY'
    )
  }
  assertRecipients(recipients, source)
  const rules = existing
    ? sops.rulesOf(existing.sops)
    : withDefaultSelector(inherited || {})
  return { recipients, rules }
}

const plaintextReason = (name, rules) => {
  if (rules.unencrypted_suffix && name.endsWith(rules.unencrypted_suffix)) {
    return null
  }
  if (sops.isEncryptedPath([name], rules)) return null
  const [rule] = Object.keys(rules)
  return `"${name}" would be stored in plaintext because of the file's ${rule} rule`
}

const assertWritable = (tree, changedNames, rules) => {
  for (const name of changedNames) {
    if (name === RESERVED_NAME) {
      throw new OnesecretError(
        `"${RESERVED_NAME}" is reserved for the file metadata`,
        'EVALUE'
      )
    }
    assertEnvName(name)
    const value = tree[name]
    if (value !== null && !isEnvScalar(value)) {
      throw new OnesecretError(
        `"${name}" must be a string, number, or boolean`,
        'EVALUE'
      )
    }
    const reason = plaintextReason(name, rules)
    if (reason) throw new OnesecretError(reason, 'EVALUE')
  }
}

const changedNamesOf = (before, after) =>
  Object.keys(after).filter(
    name =>
      !Object.hasOwn(before, name) ||
      !isDeepStrictEqual(before[name], after[name])
  )

const readFile = (options, file) => {
  const existing = fs.existsSync(file) ? store.readDocument(file) : null
  const tree = existing
    ? decryptDocument(existing, resolveOptions(options).keyCommand)
    : {}
  return { file, existing, tree }
}

const readLayer = (options, layer = store.DEFAULT_LAYER) =>
  readFile(
    options,
    store.layerFileOrNew(resolveOptions(options).dir, assertEnv(layer))
  )

const writeLayer = ({ file, existing, tree: before }, tree) => {
  const { recipients, rules } = encryptionFor(file, existing)
  assertWritable(tree, changedNamesOf(before || {}, tree), rules)
  store.writeDocument(file, sops.encrypt(tree, { recipients, rules }))
  return file
}

const updateLayer = (options, layer, update) => {
  const current = readLayer(options, layer)
  return writeLayer(current, update({ ...current.tree }))
}

const parseAssignment = assignment => {
  const separator = assignment.indexOf('=')
  if (separator < 1) {
    throw new OnesecretError(`"${assignment}" is not NAME=value`, 'EVALUE')
  }
  return [assignment.slice(0, separator), assignment.slice(separator + 1)]
}

const set = (options, layer, assignments) =>
  updateLayer(options, layer, tree => ({
    ...tree,
    ...Object.fromEntries(assignments.map(parseAssignment))
  }))

const unset = (options, layer, secretNames) =>
  updateLayer(options, layer, tree => {
    for (const name of secretNames) {
      if (!Object.hasOwn(tree, name)) {
        throw new OnesecretError(
          `"${name}" is not in the ${layer} layer`,
          'EVALUE'
        )
      }
      delete tree[name]
    }
    return tree
  })

const rekey = (options, layer) => {
  const current = readLayer(options, layer)
  if (!current.existing) {
    throw new OnesecretError(`${current.file} does not exist`, 'EVALUE')
  }
  return writeLayer(current, current.tree)
}

const toEditableYaml = tree =>
  Object.keys(tree).length === 0 ? '' : yaml.dump(tree)

const fromEditableYaml = text => {
  let tree
  try {
    tree = yaml.parse(text) ?? {}
  } catch (error) {
    throw new OnesecretError(
      `the edited file is not valid YAML: ${store.parseErrorOf(error)}`,
      'EVALUE'
    )
  }
  if (typeof tree !== 'object' || Array.isArray(tree)) {
    throw new OnesecretError(
      'the edited file must be a mapping of NAME: value',
      'EVALUE'
    )
  }
  return tree
}

const initialRecipients = defaultFile => {
  const rule = store.creationRule(defaultFile)
  if (rule) return { recipients: rule.recipients, source: store.SOPS_CONFIG }
  const exported = exportedRecipients()
  if (exported.length > 0) { return { recipients: exported, source: 'SOPS_AGE_KEY' } }
  return null
}

const initialize = options => {
  const { dir } = resolveOptions(options)
  const defaultFile = store.layerFileOrNew(dir, store.DEFAULT_LAYER)
  const existing = fs.existsSync(defaultFile)
    ? store.readDocument(defaultFile)
    : null
  if (existing) {
    const { recipients } = recipientsOfFile(defaultFile, existing)
    return { status: 'existing', recipients, defaultFile }
  }
  const known = initialRecipients(defaultFile)
  if (known) {
    writeLayer({ file: defaultFile, existing: null }, {})
    return { status: 'adopted', ...known, defaultFile }
  }
  const layers = store.encryptedFilesIn(dir)
  if (layers.length > 0) {
    throw new OnesecretError(
      `${dir} already has encrypted layers (${layers
        .map(file => path.basename(file))
        .join(', ')}): export SOPS_AGE_KEY with their key and run init again`,
      'ENOKEY'
    )
  }
  const identity = age.generateIdentity()
  const recipient = age.recipientOf(identity)
  store.writeDocument(
    defaultFile,
    sops.encrypt(
      {},
      { recipients: [recipient], rules: withDefaultSelector({}) }
    )
  )
  return { status: 'created', recipients: [recipient], identity, defaultFile }
}

module.exports = {
  encryptionFor,
  fromEditableYaml,
  initialize,
  readFile,
  readLayer,
  rekey,
  set,
  toEditableYaml,
  unset,
  writeLayer
}
