'use strict'

const { isDeepStrictEqual } = require('node:util')
const { OnesecretError } = require('./error')

const TRIPLE_QUOTE = '"""'
const SCANNER_MAX_LINE_BYTES = 64 * 1024 - 1

const scanLines = text => {
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.map(line => line.replace(/\r$/, ''))
}

const countQuotes = text => text.split('"').length - 1

const parseSinglelineValue = line => {
  const separator = line.indexOf('=')
  let value = line.slice(separator + 1).replace(/^ +/, '')
  const hash = value.indexOf('#')
  if (hash !== -1 && countQuotes(value.slice(0, hash)) % 2 === 0) { value = value.slice(0, hash).replace(/ +$/, '') }
  return { key: line.slice(0, separator).trim(), value }
}

const parse = text => {
  const secrets = {}
  let multiline = null
  for (const line of scanLines(text)) {
    if (multiline) {
      if (line.endsWith(TRIPLE_QUOTE)) {
        secrets[multiline.key] =
          multiline.value + line.slice(0, -TRIPLE_QUOTE.length)
        multiline = null
      } else {
        multiline.value += `${line}\n`
      }
      continue
    }
    if (line.startsWith('#') || line.trim() === '') continue
    if (!line.includes('=')) throw new Error(`"${line}" is not NAME=VALUE`)
    const { key, value } = parseSinglelineValue(line)
    if (
      value.startsWith(TRIPLE_QUOTE) &&
      value.endsWith(TRIPLE_QUOTE) &&
      value.length >= 6
    ) {
      secrets[key] = value.slice(3, -3)
    } else if (value.startsWith(TRIPLE_QUOTE)) {
      multiline = { key, value: `${value.slice(3)}\n` }
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      if (value.length < 2) throw new Error('flyctl panics on a lone quote')
      secrets[key] = value.slice(1, -1)
    } else {
      secrets[key] = value
    }
  }
  return secrets
}

const candidates = value => [
  value,
  `${TRIPLE_QUOTE}${value}${TRIPLE_QUOTE}`,
  `"${value}"`,
  `'${value}'`
]

const readsBackAs = (text, expected) => {
  try {
    return isDeepStrictEqual(parse(text), expected)
  } catch {
    return false
  }
}

const isWithinScanner = text =>
  scanLines(text).every(
    line => Buffer.byteLength(line) <= SCANNER_MAX_LINE_BYTES
  )

const encodeLine = (name, value) => {
  const line = candidates(value)
    .map(encoded => `${name}=${encoded}\n`)
    .find(line => isWithinScanner(line) && readsBackAs(line, { [name]: value }))
  if (!line) {
    throw new OnesecretError(
      `"${name}" cannot be imported into fly without changing its value`,
      'EVALUE'
    )
  }
  return line
}

const encode = secrets => {
  const body = Object.entries(secrets)
    .map(([name, value]) => encodeLine(name, value))
    .join('')
  if (!readsBackAs(body, secrets)) {
    throw new OnesecretError(
      'the fly import does not read back to the same secrets',
      'EVALUE'
    )
  }
  return body
}

module.exports = { encode, parse }
