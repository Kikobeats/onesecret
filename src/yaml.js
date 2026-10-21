'use strict'

const yaml = require('js-yaml')

const KEY_ORDER = Symbol('onesecret.keyOrder')
const NULL = /^(?:~|null|Null|NULL|)$/
const TRUE = /^(?:true|True|TRUE)$/
const FALSE = /^(?:false|False|FALSE)$/
const GO_INTEGER =
  /^([-+]?)(0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|0[0-7]*|[1-9][0-9]*)$/
const FLOAT = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/
const INFINITY = /^([-+]?)\.(?:inf|Inf|INF)$/
const NOT_A_NUMBER = /^\.(?:nan|NaN|NAN)$/
const DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
const DATE_TIME =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt](\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?(Z|[-+]\d{2}:\d{2})| (\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?)$/
const GO_FRACTION_DIGITS = 9
const NON_PRINTABLE =
  /[^\t\n\x20-\x7e\xa0-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]|[\u2028\u2029\ufeff]/u
const NUMERIC_START = /^[-+.0-9]/
const DIGIT_OR_SIGN_START = /^[-+0-9]/
const SIGNED_AFTER_PREFIX = /^0([bo])([-+]?[0-9]+)$/
const RADIX = { b: 2, o: 8 }
const DOCUMENT_MARKER = /^(?:---|\.\.\.)(?:\s|$)/
const PLAIN_START = /^[^\s\-?:,[\]{}#&*!|>'"%@`]/
const PLAIN_BREAKERS = /: |\s#|:$|[\s]$|[\t\n\r]/
const INT64_MIN = -(2n ** 63n)
const UINT64_MAX = 2n ** 64n - 1n
const INDENT = '    '
const TAG_PREFIX = 'tag:yaml.org,2002:'

const keysOf = node => node[KEY_ORDER] || Object.keys(node)

const orderedObject = () => Object.defineProperty({}, KEY_ORDER, { value: [] })

const setKey = (node, key, value) => {
  if (Object.hasOwn(node, key)) throw new Error(`duplicate key "${key}"`)
  Object.defineProperty(node, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true
  })
  node[KEY_ORDER].push(key)
}

const toSafeNumber = value =>
  value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER
    ? Number(value)
    : value

const parseGoInteger = text => {
  const match = GO_INTEGER.exec(text)
  if (!match) return null
  const [, sign, digits] = match
  const prefixed = /^0[0-7]+$/.test(digits) ? `0o${digits.slice(1)}` : digits
  const magnitude = BigInt(prefixed)
  const value = sign === '-' ? -magnitude : magnitude
  return value >= INT64_MIN && value <= UINT64_MAX ? toSafeNumber(value) : null
}

const pad = (number, width = 2) => String(number).padStart(width, '0')

const timestampParts = text => {
  const date = DATE.exec(text)
  if (date) {
    return { ymd: date.slice(1, 4), hms: [0, 0, 0], fraction: '', zone: 'Z' }
  }
  const match = DATE_TIME.exec(text)
  if (!match) return null
  const hasZone = match[4] !== undefined
  const [hour, minute, second, fraction = ''] = hasZone
    ? match.slice(4, 8)
    : match.slice(9, 13)
  return {
    ymd: match.slice(1, 4),
    hms: [hour, minute, second],
    fraction,
    zone: hasZone ? match[8] : 'Z'
  }
}

const toTimestamp = text => {
  const parts = timestampParts(text)
  if (!parts) return null
  const [year, month, day] = parts.ymd.map(Number)
  const [hour, minute, second] = parts.hms.map(Number)
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const isValid =
    instant.getUTCMonth() === month - 1 &&
    instant.getUTCDate() === day &&
    instant.getUTCHours() === hour &&
    instant.getUTCMinutes() === minute &&
    instant.getUTCSeconds() === second
  if (!isValid) return null
  const fraction = parts.fraction
    .slice(0, GO_FRACTION_DIGITS)
    .replace(/0+$/, '')
  const zone = ['+00:00', '-00:00'].includes(parts.zone) ? 'Z' : parts.zone
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(
    minute
  )}:${pad(second)}${fraction ? `.${fraction}` : ''}${zone}`
}

const parseSignedAfterPrefix = text => {
  const match = SIGNED_AFTER_PREFIX.exec(text)
  if (!match) return null
  const [, prefix, digits] = match
  const magnitude = digits.replace(/^[-+]/, '')
  if ([...magnitude].some(digit => Number(digit) >= RADIX[prefix])) return null
  const value =
    BigInt(`0${prefix}${magnitude}`) * (digits.startsWith('-') ? -1n : 1n)
  return value >= INT64_MIN && value <= UINT64_MAX ? toSafeNumber(value) : null
}

const resolveNumber = text => {
  const plain = DIGIT_OR_SIGN_START.test(text) ? text.replaceAll('_', '') : text
  const integer =
    parseGoInteger(text.replaceAll('_', '')) ?? parseSignedAfterPrefix(plain)
  if (integer !== null) return integer
  if (FLOAT.test(plain) && Number.isFinite(Number(plain))) return Number(plain)
  return undefined
}

const resolvePlain = text => {
  if (NULL.test(text)) return null
  if (TRUE.test(text)) return true
  if (FALSE.test(text)) return false
  const infinity = INFINITY.exec(text)
  if (infinity) return infinity[1] === '-' ? -Infinity : Infinity
  if (NOT_A_NUMBER.test(text)) return NaN
  if (!NUMERIC_START.test(text)) return text
  const timestamp = toTimestamp(text)
  if (timestamp !== null) return timestamp
  return resolveNumber(text) ?? text
}

const CORE_TAGS = ['str', 'int', 'float', 'bool', 'null', 'timestamp']

const tagOf = (source, event) =>
  event.tagStart >= 0 ? source.slice(event.tagStart, event.tagEnd) : null

const isCoreTag = tag =>
  CORE_TAGS.some(
    name => tag === `!!${name}` || tag === `!<${TAG_PREFIX}${name}>`
  )

const assertTag = (tag, isValue) => {
  if (tag && !(isValue && isCoreTag(tag))) {
    throw new Error(
      `only the tags ${CORE_TAGS.map(name => `!!${name}`).join(
        ', '
      )} are supported, on values`
    )
  }
}

const TAG_CHECKS = {
  int: value => Number.isSafeInteger(value) || typeof value === 'bigint',
  float: value => typeof value === 'number',
  bool: value => typeof value === 'boolean',
  null: value => value === null,
  timestamp: value => value !== null
}

const tagNameOf = tag =>
  tag.startsWith('!!') ? tag.slice(2) : tag.slice(TAG_PREFIX.length + 2, -1)

const resolveTagged = (text, tag) => {
  const value =
    tagNameOf(tag) === 'timestamp' ? toTimestamp(text) : resolvePlain(text)
  if (!TAG_CHECKS[tagNameOf(tag)](value)) {
    throw new Error(`a value does not match its !!${tagNameOf(tag)} tag`)
  }
  return value
}

const resolveScalar = (source, event) => {
  const text = yaml.getScalarValue(source, event)
  const tag = tagOf(source, event)
  if (tag === '!!str' || tag === `!<${TAG_PREFIX}str>`) return text
  if (tag) return resolveTagged(text, tag)
  if (tag || event.style === yaml.SCALAR_STYLE_PLAIN) return resolvePlain(text)
  return text
}

const parse = source => {
  const stack = []
  let root
  let documents = 0
  const attach = value => {
    const parent = stack[stack.length - 1]
    if (!parent) {
      root = value
    } else if (Array.isArray(parent.node)) {
      parent.node.push(value)
    } else if (parent.pendingKey === undefined) {
      parent.pendingKey = value
    } else {
      setKey(parent.node, parent.pendingKey, value)
      parent.pendingKey = undefined
    }
  }
  for (const event of yaml.parseEvents(source)) {
    if (event.anchorStart >= 0 || event.type === yaml.EVENT_ALIAS) {
      throw new Error('anchors and aliases are not supported')
    }
    if (event.type === yaml.EVENT_DOCUMENT) {
      if (++documents > 1) {
        throw new Error('a file must hold a single YAML document')
      }
    } else if (
      event.type === yaml.EVENT_MAPPING ||
      event.type === yaml.EVENT_SEQUENCE
    ) {
      const parent = stack[stack.length - 1]
      if (
        parent &&
        !Array.isArray(parent.node) &&
        parent.pendingKey === undefined
      ) {
        throw new Error('mapping keys must be scalars')
      }
      assertTag(tagOf(source, event), false)
      const node = event.type === yaml.EVENT_MAPPING ? orderedObject() : []
      attach(node)
      stack.push({ node })
    } else if (event.type === yaml.EVENT_POP) {
      stack.pop()
    } else if (event.type === yaml.EVENT_SCALAR) {
      const parent = stack[stack.length - 1]
      const isKey =
        parent && !Array.isArray(parent.node) && parent.pendingKey === undefined
      assertTag(tagOf(source, event), !isKey)
      attach(
        isKey
          ? yaml.getScalarValue(source, event)
          : resolveScalar(source, event)
      )
    }
  }
  return root === undefined ? null : root
}

const isMapping = value =>
  value !== null &&
  typeof value === 'object' &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))

const escapeDoubleQuoted = text =>
  `"${[...text]
    .map(char => {
      if (char === '"' || char === '\\') return `\\${char}`
      if (char === '\n') return '\\n'
      if (char === '\t') return '\\t'
      if (!NON_PRINTABLE.test(char)) return char
      const code = char.codePointAt(0)
      return code > 0xffff
        ? `\\U${code.toString(16).padStart(8, '0')}`
        : `\\u${code.toString(16).padStart(4, '0')}`
    })
    .join('')}"`

const formatString = text => {
  const isPlain =
    PLAIN_START.test(text) &&
    !PLAIN_BREAKERS.test(text) &&
    !DOCUMENT_MARKER.test(text) &&
    resolvePlain(text) === text &&
    toTimestamp(text) === null
  return isPlain && !NON_PRINTABLE.test(text) ? text : escapeDoubleQuoted(text)
}

const formatBlock = (text, indent) => {
  const trailing = /\n*$/.exec(text)[0].length
  const chomping = trailing === 0 ? '-' : trailing === 1 ? '' : '+'
  const body = text.slice(0, text.length - trailing)
  const lines = [
    ...body.split('\n'),
    ...Array(Math.max(trailing - 1, 0)).fill('')
  ]
  return `|${chomping}\n${lines
    .map(line => (line ? indent + line : ''))
    .join('\n')}`
}

const isBlockSafe = text =>
  text.includes('\n') &&
  !/^[ \t\n]/.test(text) &&
  !/[ \t]\n/.test(text) &&
  !/[^\x20-\x7e\n]/.test(text)

const formatNumber = value => {
  if (Number.isNaN(value)) return '.nan'
  if (!Number.isFinite(value)) return value > 0 ? '.inf' : '-.inf'
  if (Object.is(value, -0)) return '-0.0'
  return Number.isInteger(value) && !Number.isSafeInteger(value)
    ? value.toExponential()
    : String(value)
}

const formatScalar = (value, indent) => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (typeof value === 'number') return formatNumber(value)
  if (typeof value === 'string') {
    return isBlockSafe(value) ? formatBlock(value, indent) : formatString(value)
  }
  throw new Error(`cannot write a value of type ${typeof value}`)
}

const isEmptyCollection = value =>
  (Array.isArray(value) && value.length === 0) ||
  (isMapping(value) && Object.keys(value).length === 0)

const emit = (value, indent) => {
  if (Array.isArray(value)) {
    return value
      .map(item => `${indent}-${emitChild(item, `${indent}  `, true)}`)
      .join('')
  }
  return Object.keys(value)
    .map(
      key =>
        `${indent}${formatString(key)}:${emitChild(
          value[key],
          indent + INDENT,
          false
        )}`
    )
    .join('')
}

const emitChild = (value, indent, inSequence) => {
  if (isEmptyCollection(value)) return Array.isArray(value) ? ' []\n' : ' {}\n'
  if (Array.isArray(value) || isMapping(value)) {
    const nested = emit(value, indent)
    return inSequence && isMapping(value)
      ? ` ${nested.slice(indent.length)}`
      : `\n${nested}`
  }
  return ` ${formatScalar(value, indent)}\n`
}

const dump = value => (isEmptyCollection(value) ? '{}\n' : emit(value, ''))

const toJsonNumber = item => {
  if (typeof item === 'bigint') return JSON.rawJSON(String(item))
  if (typeof item !== 'number' || !Number.isFinite(item)) return item
  if (Object.is(item, -0)) return JSON.rawJSON('-0.0')
  return Number.isInteger(item) && !Number.isSafeInteger(item)
    ? JSON.rawJSON(item.toExponential())
    : item
}

const dumpJson = value =>
  `${JSON.stringify(value, (_key, item) => toJsonNumber(item), 2)}\n`

module.exports = { dump, dumpJson, keysOf, parse }
