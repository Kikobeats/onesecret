'use strict'

const { OnesecretError } = require('./error')

const POSIX_CLASSES = {
  alnum: '0-9A-Za-z',
  alpha: 'A-Za-z',
  ascii: '\\x00-\\x7F',
  blank: '\\t ',
  cntrl: '\\x00-\\x1F\\x7F',
  digit: '0-9',
  graph: '!-~',
  lower: 'a-z',
  print: ' -~',
  punct: '!-\\/:-@\\[-`{-~',
  space: '\\t\\n\\v\\f\\r ',
  upper: 'A-Z',
  word: '0-9A-Za-z_',
  xdigit: '0-9A-Fa-f'
}
const LEADING_FLAGS = /^\(\?([imsU]+)\)/
const POSIX_CLASS = /^\[:(\^?)([a-z]+):\]/
const SUPPORTED_FLAGS = new Set(['i', 'm', 's'])
const ESCAPES = { A: '(?<![\\s\\S])', z: '(?![\\s\\S])' }
const UNSUPPORTED_ESCAPES = new Set(['Q', 'E', 'p', 'P', 'C', 'Z'])
const LITERAL_BRACKET_CLASS = /^\[\^?\]/

const cache = new Map()

const translateBody = pattern => {
  let output = ''
  let inClass = false
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index]
    const rest = pattern.slice(index)
    if (char === '\\') {
      const next = pattern[index + 1]
      if (
        UNSUPPORTED_ESCAPES.has(next) ||
        (next === 'x' && pattern[index + 2] === '{')
      ) {
        throw new Error(`the Go escape \\${next} has no JavaScript equivalent`)
      }
      output += !inClass && ESCAPES[next] ? ESCAPES[next] : char + (next ?? '')
      index++
    } else if (inClass && POSIX_CLASS.test(rest)) {
      const [match, negated, name] = POSIX_CLASS.exec(rest)
      if (!POSIX_CLASSES[name]) { throw new Error(`unknown character class [:${name}:]`) }
      if (negated) { throw new Error(`negated class [:^${name}:] is not supported`) }
      output += POSIX_CLASSES[name]
      index += match.length - 1
    } else if (!inClass && LITERAL_BRACKET_CLASS.test(rest)) {
      throw new Error('a class that starts with ] is not supported')
    } else if (rest.startsWith('(?P<')) {
      output += '(?<'
      index += 3
    } else {
      if (char === '[' && !inClass) inClass = true
      else if (char === ']' && inClass) inClass = false
      output += char
    }
  }
  return output
}

const translate = pattern => {
  const leading = LEADING_FLAGS.exec(pattern)
  const flags = leading
    ? [...leading[1]].filter(flag => SUPPORTED_FLAGS.has(flag)).join('')
    : ''
  return new RegExp(
    translateBody(leading ? pattern.slice(leading[0].length) : pattern),
    flags
  )
}

const goRegExp = pattern => {
  if (!cache.has(pattern)) {
    try {
      cache.set(pattern, translate(pattern))
    } catch (error) {
      throw new OnesecretError(
        `regular expression "${pattern}" is not supported: ${error.message}`,
        'EFORMAT'
      )
    }
  }
  return cache.get(pattern)
}

module.exports = { goRegExp }
