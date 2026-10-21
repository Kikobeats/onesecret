'use strict'

const crypto = require('node:crypto')
const dotenv = require('./dotenv')
const { OnesecretError } = require('./error')

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

const isEnvName = name => ENV_NAME.test(name) && name !== '__proto__'

const assertEnvName = name => {
  if (!isEnvName(name)) {
    throw new OnesecretError(
      `"${name}" is not a valid environment variable name`,
      'EVALUE'
    )
  }
}

const isEnvScalar = value =>
  ['string', 'number', 'boolean', 'bigint'].includes(typeof value)

const toEnvValue = (name, value) => {
  assertEnvName(name)
  if (value === null || value === undefined) return ''
  if (isEnvScalar(value)) return String(value)
  throw new OnesecretError(
    `"${name}" must be a string, number, or boolean to become an environment variable`,
    'EVALUE'
  )
}

const toEnv = secrets =>
  Object.fromEntries(
    Object.entries(secrets).map(([name, value]) => [
      name,
      toEnvValue(name, value)
    ])
  )

const toDotenv = secrets => dotenv.encode(toEnv(secrets))

const checksum = secrets => {
  const entries = Object.entries(toEnv(secrets)).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(entries))
    .digest('hex')
}

module.exports = {
  assertEnvName,
  checksum,
  isEnvName,
  isEnvScalar,
  toDotenv,
  toEnv,
  toEnvValue
}
