'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { isDeepStrictEqual } = require('node:util')
const yaml = require('./yaml')
const jsYaml = require('js-yaml')
const age = require('./age')
const sops = require('./sops')
const store = require('./store')
const { assertEnv, decryptDocument, resolveOptions } = require('./secrets')
const { assertEnvName, isEnvScalar } = require('./format')
const { OnesecretError } = require('./error')

const ENCRYPTED_FILES_PATTERN = '[^/]+\\.enc\\.(ya?ml|json)$'
const RESERVED_NAME = 'sops'
const RULES_HEADER = /^creation_rules:[ \t]*\n/m
const FIRST_ITEM_INDENT = /^([ \t]*)-/m
const DEFAULT_INDENT = '  '

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
  const rule = store.creationRule(file)
  const recipients = rule
    ? rule.recipients
    : existing
      ? sops.recipientsOf(existing)
      : []
  if (recipients.length === 0) {
    throw new OnesecretError(
      `no age recipient for ${file}, run "onesecret init" first`,
      'ENOKEY'
    )
  }
  assertRecipients(recipients, rule ? store.SOPS_CONFIG : file)
  const rules = existing
    ? sops.rulesOf(existing.sops)
    : withDefaultSelector((rule && rule.rules) || {})
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

const withCreationRule = (text, rule) => {
  const entry = indent =>
    `${indent}- path_regex: ${JSON.stringify(
      rule.path_regex
    )}\n${indent}  age: ${JSON.stringify(rule.age)}\n`
  const header = RULES_HEADER.exec(text)
  if (!header) {
    if (/^creation_rules:/m.test(text)) return null
    return `${text}${
      text && !text.endsWith('\n') ? '\n' : ''
    }creation_rules:\n${entry(DEFAULT_INDENT)}`
  }
  const insertAt = header.index + header[0].length
  const [, indent] = FIRST_ITEM_INDENT.exec(text.slice(insertAt)) || [
    null,
    DEFAULT_INDENT
  ]
  return text.slice(0, insertAt) + entry(indent) + text.slice(insertAt)
}

const firstRuleOf = text => {
  try {
    const parsed = jsYaml.load(text, { schema: jsYaml.CORE_SCHEMA })
    return parsed && parsed.creation_rules && { ...parsed.creation_rules[0] }
  } catch {
    return null
  }
}

const sopsConfigWith = (file, rule) => {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const edited = withCreationRule(text, rule)
  if (edited && isDeepStrictEqual(firstRuleOf(edited), rule)) return edited
  const config = text ? store.readSopsConfig(file) : {}
  config.creation_rules = [rule, ...(config.creation_rules || [])]
  return jsYaml.dump(config, { lineWidth: -1 })
}

const initialize = options => {
  const { cwd, dir } = resolveOptions(options)
  const relativeDir = path.relative(cwd, dir).split(path.sep).join('/')
  const sopsConfigFile = path.join(cwd, store.SOPS_CONFIG)
  const defaultFile = store.layerFileOrNew(dir, store.DEFAULT_LAYER)
  const existingRule = store.creationRule(defaultFile)
  if (existingRule) {
    return {
      created: false,
      recipient: existingRule.recipients.join(','),
      sopsConfigFile
    }
  }

  const identity = age.generateIdentity()
  const recipient = age.recipientOf(identity)
  const prefix = relativeDir ? `^${escapeRegExp(relativeDir)}/` : '^'
  const sopsConfig = sopsConfigWith(sopsConfigFile, {
    path_regex: prefix + ENCRYPTED_FILES_PATTERN,
    age: recipient
  })

  fs.writeFileSync(sopsConfigFile, sopsConfig)
  if (!fs.existsSync(defaultFile)) {
    writeLayer({ file: defaultFile, existing: null }, {})
  }
  return { created: true, recipient, identity, sopsConfigFile, defaultFile }
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
