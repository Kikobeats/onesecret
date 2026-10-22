'use strict'

const { OnesecretError } = require('./error')

const ACCESSORS = ['get', 'has', 'require', 'required']

const isWalkable = value => value !== null && typeof value === 'object'

const isValue = (object, key) =>
  isWalkable(object) && Object.prototype.propertyIsEnumerable.call(object, key)

const segmentsOf = path => {
  if (Array.isArray(path)) return path.map(String)
  if (typeof path === 'number') return [String(path)]
  if (typeof path === 'string') return path.split('.')
  throw new OnesecretError(
    'a config path is a string such as "database.url", or an array of keys',
    'EUSAGE'
  )
}

const lookup = (values, path) => {
  if (typeof path === 'string' && isValue(values, path)) return values[path]
  let current = values
  for (const key of segmentsOf(path)) {
    if (!isValue(current, key)) return undefined
    current = current[key]
  }
  return current
}

const assertNoReservedNames = values => {
  const reserved = ACCESSORS.filter(name => Object.hasOwn(values, name))
  if (reserved.length > 0) {
    throw new OnesecretError(
      `${reserved
        .map(name => `"${name}"`)
        .join(', ')} cannot be a config name, config() uses it to read values`,
      'EFORMAT'
    )
  }
}

const withAccessors = (values, env) => {
  assertNoReservedNames(values)
  const get = (path, fallback) => {
    const value = lookup(values, path)
    return value === undefined ? fallback : value
  }
  const has = path => lookup(values, path) !== undefined
  const require = path => {
    if (!has(path)) {
      throw new OnesecretError(
        `"${path}" is required but not set in the "${env}" config`,
        'EMISSING'
      )
    }
    return get(path)
  }
  const required = new Proxy(values, {
    get: (target, path) =>
      typeof path === 'string' ? require(path) : undefined
  })
  for (const [name, value] of Object.entries({ get, has, require, required })) {
    Object.defineProperty(values, name, { value, enumerable: false })
  }
  return values
}

module.exports = { ACCESSORS, withAccessors }
