'use strict'

const { parseEnv } = require('node:util')
const { isDeepStrictEqual } = require('node:util')
const { OnesecretError } = require('./error')

const DOTENV_LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm
const QUOTES = ["'", '`', '"']
const NEIGHBOR = 'ONESECRET_NEIGHBOR'

const parseDotenvPackage = source => {
  const secrets = {}
  const lines = source.replace(/\r\n?/gm, '\n')
  for (const match of lines.matchAll(DOTENV_LINE)) {
    const quote = (match[2] || '').trim()[0]
    let value = (match[2] || '').trim().replace(/^(['"`])([\s\S]*)\1$/gm, '$2')
    if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
    secrets[match[1]] = value
  }
  return secrets
}

const PARSERS = [source => ({ ...parseEnv(source) }), parseDotenvPackage]

const readsBackAs = (source, expected) =>
  PARSERS.every(parse => isDeepStrictEqual(parse(source), expected))

const survivesNeighbors = (line, name, value) =>
  QUOTES.every(quote =>
    readsBackAs(`${line}${NEIGHBOR}=${quote}#${quote}\n`, {
      [name]: value,
      [NEIGHBOR]: '#'
    })
  )

const encodeLine = (name, value) => {
  const line = [value, ...QUOTES.map(quote => quote + value + quote)]
    .map(encoded => `${name}=${encoded}\n`)
    .find(
      line =>
        readsBackAs(line, { [name]: value }) &&
        survivesNeighbors(line, name, value)
    )
  if (!line) {
    throw new OnesecretError(
      `"${name}" cannot be written as dotenv without changing its value`,
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
      'the dotenv output does not read back to the same secrets',
      'EVALUE'
    )
  }
  return body
}

module.exports = { encode, parseDotenvPackage }
