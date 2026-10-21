'use strict'

class OnesecretError extends Error {
  constructor (message, code) {
    super(`onesecret: ${message}`)
    this.name = 'OnesecretError'
    this.code = code
    this.reason = message
  }
}

module.exports = { OnesecretError }
