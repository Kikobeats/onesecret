'use strict'

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
const CHECKSUM_LENGTH = 6
const SEPARATOR = '1'

const polymod = values => {
  let checksum = 1
  for (const value of values) {
    const top = checksum >>> 25
    checksum = ((checksum & 0x1ffffff) << 5) ^ value
    for (let bit = 0; bit < 5; bit++) {
      if ((top >>> bit) & 1) checksum ^= GENERATOR[bit]
    }
  }
  return checksum
}

const expandPrefix = prefix => {
  const codes = [...prefix].map(char => char.charCodeAt(0))
  return [...codes.map(code => code >>> 5), 0, ...codes.map(code => code & 31)]
}

const regroupBits = (values, fromBits, toBits, pad) => {
  let accumulator = 0
  let bits = 0
  const output = []
  const mask = (1 << toBits) - 1
  for (const value of values) {
    accumulator = (accumulator << fromBits) | value
    bits += fromBits
    while (bits >= toBits) {
      bits -= toBits
      output.push((accumulator >>> bits) & mask)
    }
  }
  if (pad) {
    if (bits > 0) output.push((accumulator << (toBits - bits)) & mask)
  } else if (
    bits >= fromBits ||
    ((accumulator << (toBits - bits)) & mask) !== 0
  ) {
    throw new Error('bech32 data has invalid padding')
  }
  return output
}

const encode = (prefix, bytes) => {
  const words = regroupBits(bytes, 8, 5, true)
  const residue =
    polymod([...expandPrefix(prefix), ...words, 0, 0, 0, 0, 0, 0]) ^ 1
  const checksum = Array.from(
    { length: CHECKSUM_LENGTH },
    (_, index) => (residue >>> (5 * (CHECKSUM_LENGTH - 1 - index))) & 31
  )
  return (
    prefix +
    SEPARATOR +
    [...words, ...checksum].map(word => CHARSET[word]).join('')
  )
}

const decode = text => {
  if (text !== text.toLowerCase() && text !== text.toUpperCase()) {
    throw new Error('bech32 string mixes upper and lower case')
  }
  const lower = text.toLowerCase()
  const separatorIndex = lower.lastIndexOf(SEPARATOR)
  if (
    separatorIndex < 1 ||
    lower.length - separatorIndex - 1 < CHECKSUM_LENGTH
  ) {
    throw new Error('bech32 string is malformed')
  }
  const prefix = lower.slice(0, separatorIndex)
  const words = [...lower.slice(separatorIndex + 1)].map(char => {
    const word = CHARSET.indexOf(char)
    if (word === -1) { throw new Error(`bech32 string has invalid character "${char}"`) }
    return word
  })
  if (polymod([...expandPrefix(prefix), ...words]) !== 1) {
    throw new Error('bech32 checksum is invalid')
  }
  const bytes = regroupBits(words.slice(0, -CHECKSUM_LENGTH), 5, 8, false)
  return { prefix, bytes: Buffer.from(bytes) }
}

module.exports = { encode, decode }
