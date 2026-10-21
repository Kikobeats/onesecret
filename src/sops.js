'use strict'

const crypto = require('node:crypto')
const age = require('./age')
const { keysOf } = require('./yaml')
const { goRegExp } = require('./regexp')
const { OnesecretError } = require('./error')

const SOPS_VERSION = '3.13.3'
const METADATA_KEY = 'sops'
const DEFAULT_RULES = { unencrypted_suffix: '_unencrypted' }
const RULE_KEYS = [
  'unencrypted_suffix',
  'encrypted_suffix',
  'unencrypted_regex',
  'encrypted_regex',
  'mac_only_encrypted'
]
const DATA_KEY_SIZE = 32
const IV_SIZE = 32
const TAG_SIZE = 16
const ENCRYPTED_VALUE =
  /^ENC\[AES256_GCM,data:(.+),iv:(.+),tag:(.+),type:(.+)\]$/
const CANONICAL_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const MAC_ONLY_ENCRYPTED_PREFIX = crypto
  .createHash('sha256')
  .update('sops')
  .digest()
const COMMENT_RULE_KEYS = [
  'unencrypted_comment_regex',
  'encrypted_comment_regex'
]
const OTHER_KEY_SOURCES = ['kms', 'gcp_kms', 'azure_kv', 'hc_vault', 'pgp']

const isMapping = value =>
  value !== null &&
  typeof value === 'object' &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))

const mapLeaves = (node, path, transform, orderOf) => {
  if (Array.isArray(node)) { return node.map(item => mapLeaves(item, path, transform, orderOf)) }
  if (isMapping(node)) {
    return Object.fromEntries(
      orderOf(node).map(key => [
        key,
        mapLeaves(node[key], [...path, key], transform, orderOf)
      ])
    )
  }
  return transform(node, path)
}

const rulesOf = metadata =>
  Object.fromEntries(
    RULE_KEYS.filter(key => metadata[key] !== undefined).map(key => [
      key,
      metadata[key]
    ])
  )

const isEncryptedPath = (path, rules) => {
  let encrypted = true
  if (
    rules.unencrypted_suffix &&
    path.some(key => key.endsWith(rules.unencrypted_suffix))
  ) { encrypted = false }
  if (rules.encrypted_suffix) { encrypted = path.some(key => key.endsWith(rules.encrypted_suffix)) }
  if (
    rules.unencrypted_regex &&
    path.some(key => goRegExp(rules.unencrypted_regex).test(key))
  ) { encrypted = false }
  if (rules.encrypted_regex) { encrypted = path.some(key => goRegExp(rules.encrypted_regex).test(key)) }
  return encrypted
}

const assertSupportedRules = metadata => {
  const commentRule = COMMENT_RULE_KEYS.find(key => metadata[key])
  if (commentRule) {
    throw new OnesecretError(
      `${commentRule} depends on YAML comments and is not supported, use sops`,
      'EFORMAT'
    )
  }
}

const otherKeySources = metadata =>
  OTHER_KEY_SOURCES.filter(
    key => Array.isArray(metadata[key]) && metadata[key].length > 0
  )

const macHash = rules => {
  const hash = crypto.createHash('sha512')
  if (rules.mac_only_encrypted) hash.update(MAC_ONLY_ENCRYPTED_PREFIX)
  return hash
}

const isBlank = value => value === null || value === ''

const formatFloat = number => {
  if (Number.isNaN(number)) return 'NaN'
  if (!Number.isFinite(number)) return number > 0 ? '+Inf' : '-Inf'
  if (Object.is(number, -0)) return '-0'
  const [mantissa, exponentText] = String(number).split('e')
  if (exponentText === undefined) return mantissa
  const sign = mantissa.startsWith('-') ? '-' : ''
  const [whole, fraction = ''] = mantissa.replace('-', '').split('.')
  const digits = whole + fraction
  const point = whole.length + Number(exponentText)
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`
  if (point >= digits.length) { return sign + digits + '0'.repeat(point - digits.length) }
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`
}

const typeOf = value => {
  if (typeof value === 'string') return 'str'
  if (typeof value === 'boolean') return 'bool'
  if (typeof value === 'bigint') return 'int'
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && !Object.is(value, -0)
      ? 'int'
      : 'float'
  }
  if (Buffer.isBuffer(value)) return 'bytes'
  throw new OnesecretError(
    `cannot encrypt a value of type ${typeof value}`,
    'EVALUE'
  )
}

const SERIALIZERS = {
  str: value => Buffer.from(value),
  bool: value => Buffer.from(value ? 'True' : 'False'),
  int: value => Buffer.from(String(value)),
  float: value => Buffer.from(formatFloat(value)),
  bytes: value => value
}

const parseInteger = text => {
  const value = BigInt(text)
  return value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER
    ? Number(value)
    : value
}

const COMMENT = Symbol('onesecret.comment')
const INT64_MIN = -(2n ** 63n)
const INT64_MAX = 2n ** 63n - 1n

const PARSERS = {
  comment: () => COMMENT,
  str: bytes => bytes.toString(),
  time: bytes => bytes.toString(),
  bool: bytes => ['true', '1', 't'].includes(bytes.toString().toLowerCase()),
  int: bytes => parseInteger(bytes.toString()),
  float: bytes => {
    const text = bytes.toString()
    if (/^[-+]?inf(inity)?$/i.test(text)) { return text.startsWith('-') ? -Infinity : Infinity }
    return /^nan$/i.test(text) ? NaN : Number.parseFloat(text)
  },
  bytes: bytes => bytes
}

const serialize = value =>
  isBlank(value) ? Buffer.alloc(0) : SERIALIZERS[typeOf(value)](value)

const additionalData = path => `${path.join(':')}:`

const isOutOfInt64 = value =>
  typeof value === 'bigint' && (value < INT64_MIN || value > INT64_MAX)

const encryptValue = (value, dataKey, aad) => {
  const type = typeOf(value)
  const iv = crypto.randomBytes(IV_SIZE)
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv)
  cipher.setAAD(Buffer.from(aad))
  const data = Buffer.concat([
    cipher.update(SERIALIZERS[type](value)),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()
  return `ENC[AES256_GCM,data:${data.toString('base64')},iv:${iv.toString(
    'base64'
  )},tag:${tag.toString('base64')},type:${type}]`
}

const openValue = (value, dataKey, aad) => {
  if (isBlank(value)) return { value, plaintext: Buffer.alloc(0) }
  const match = typeof value === 'string' && ENCRYPTED_VALUE.exec(value)
  if (!match) { throw new OnesecretError(`value at "${aad}" is not encrypted`, 'EFORMAT') }
  const [, data, ivText, tagText, type] = match
  if (!PARSERS[type]) {
    throw new OnesecretError(
      `value at "${aad}" has unknown type "${type}"`,
      'EFORMAT'
    )
  }
  if (![data, ivText, tagText].every(text => CANONICAL_BASE64.test(text))) {
    throw new OnesecretError(
      `value at "${aad}" has malformed base64`,
      'EFORMAT'
    )
  }
  const iv = Buffer.from(ivText, 'base64')
  const tag = Buffer.from(tagText, 'base64')
  if (iv.length !== IV_SIZE || tag.length !== TAG_SIZE) {
    throw new OnesecretError(
      `value at "${aad}" has a malformed iv or tag`,
      'EFORMAT'
    )
  }
  let plaintext
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv, {
      authTagLength: TAG_SIZE
    })
    decipher.setAAD(Buffer.from(aad))
    decipher.setAuthTag(tag)
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final()
    ])
  } catch {
    throw new OnesecretError(`value at "${aad}" failed to authenticate`, 'EMAC')
  }
  return { value: PARSERS[type](plaintext), plaintext }
}

const openDataKey = (enc, identities) => {
  try {
    return age.decrypt(enc, identities)
  } catch (error) {
    throw new OnesecretError(
      `age data key is malformed: ${error.message}`,
      'EFORMAT'
    )
  }
}

const sealDataKey = (dataKey, recipient) => {
  try {
    return age.encrypt(dataKey, [recipient])
  } catch (error) {
    throw new OnesecretError(error.message, 'EKEY')
  }
}

const unwrapDataKey = (metadata, identities) => {
  if (metadata.key_groups || metadata.shamir_threshold) {
    throw new OnesecretError(
      'key_groups are not supported, use a flat list of age recipients',
      'EFORMAT'
    )
  }
  const entries = metadata.age || []
  if (entries.length === 0) { throw new OnesecretError('file has no age recipients', 'EFORMAT') }
  for (const { enc } of entries) {
    const dataKey = openDataKey(enc, identities)
    if (dataKey) {
      if (dataKey.length !== DATA_KEY_SIZE) { throw new OnesecretError('data key has the wrong size', 'EFORMAT') }
      return dataKey
    }
  }
  const recipients = entries.map(({ recipient }) => recipient).join(', ')
  throw new OnesecretError(
    `no age identity matches the file recipients (${recipients})`,
    'EKEY'
  )
}

const metadataOf = document => {
  const metadata = isMapping(document) ? document[METADATA_KEY] : undefined
  if (!isMapping(metadata)) { throw new OnesecretError('file is not encrypted with sops', 'EFORMAT') }
  return metadata
}

const names = document => {
  metadataOf(document)
  return keysOf(document).filter(key => key !== METADATA_KEY)
}

const recipientsOf = document =>
  (metadataOf(document).age || []).map(({ recipient }) => recipient)

const withoutComments = node => {
  if (Array.isArray(node)) { return node.filter(item => item !== COMMENT).map(withoutComments) }
  if (isMapping(node)) {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, withoutComments(value)])
    )
  }
  return node
}

const decrypt = (document, identities) => {
  const metadata = metadataOf(document)
  assertSupportedRules(metadata)
  const dataKey = unwrapDataKey(metadata, identities)
  const rules = rulesOf(metadata)
  const hash = macHash(rules)
  const tree = mapLeaves(
    document,
    [],
    (value, path) => {
      if (!isEncryptedPath(path, rules)) {
        if (!rules.mac_only_encrypted) hash.update(serialize(value))
        return value
      }
      const opened = openValue(value, dataKey, additionalData(path))
      if (opened.value === COMMENT) return COMMENT
      hash.update(opened.plaintext)
      return opened.value
    },
    node =>
      keysOf(node).filter(key => node !== document || key !== METADATA_KEY)
  )
  const { value: expectedMac } = openValue(
    metadata.mac,
    dataKey,
    String(metadata.lastmodified)
  )
  const actualMac = hash.digest('hex').toUpperCase()
  if (typeof expectedMac !== 'string' || expectedMac !== actualMac) {
    throw new OnesecretError(
      'file MAC does not match its content, it was modified without the key',
      'EMAC'
    )
  }
  return withoutComments(tree)
}

const encrypt = (tree, { recipients, rules = DEFAULT_RULES }) => {
  if (METADATA_KEY in tree) {
    throw new OnesecretError(
      `"${METADATA_KEY}" is reserved for the file metadata`,
      'EVALUE'
    )
  }
  if (recipients.length === 0) { throw new OnesecretError('at least one age recipient is required', 'EKEY') }
  const dataKey = crypto.randomBytes(DATA_KEY_SIZE)
  const hash = macHash(rules)
  const encrypted = mapLeaves(
    tree,
    [],
    (value, path) => {
      const shouldEncrypt = isEncryptedPath(path, rules)
      if (isOutOfInt64(value)) {
        throw new OnesecretError(
          `value at "${additionalData(
            path
          )}" is outside the 64-bit integer range sops can read, quote it`,
          'EVALUE'
        )
      }
      if (shouldEncrypt || !rules.mac_only_encrypted) { hash.update(serialize(value)) }
      if (!shouldEncrypt || isBlank(value)) return value
      return encryptValue(value, dataKey, additionalData(path))
    },
    Object.keys
  )
  const lastmodified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  return {
    ...encrypted,
    [METADATA_KEY]: {
      age: recipients.map(recipient => ({
        enc: sealDataKey(dataKey, recipient),
        recipient
      })),
      lastmodified,
      mac: encryptValue(
        hash.digest('hex').toUpperCase(),
        dataKey,
        lastmodified
      ),
      ...rules,
      version: SOPS_VERSION
    }
  }
}

module.exports = {
  DEFAULT_RULES,
  decrypt,
  encrypt,
  isEncryptedPath,
  names,
  otherKeySources,
  recipientsOf,
  rulesOf
}
