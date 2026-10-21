'use strict'

const crypto = require('node:crypto')
const bech32 = require('./bech32')

const VERSION_LINE = 'age-encryption.org/v1'
const X25519_LABEL = 'age-encryption.org/v1/X25519'
const STANZA_PREFIX = '-> '
const MAC_PREFIX = '---'
const RECIPIENT_PREFIX = 'age'
const IDENTITY_PREFIX = 'age-secret-key-'
const ARMOR_BEGIN = '-----BEGIN AGE ENCRYPTED FILE-----'
const ARMOR_END = '-----END AGE ENCRYPTED FILE-----'
const ARMOR_COLUMNS = 64
const STANZA_COLUMNS = 64
const KEY_SIZE = 32
const FILE_KEY_SIZE = 16
const PAYLOAD_NONCE_SIZE = 16
const TAG_SIZE = 16
const CHUNK_SIZE = 64 * 1024
const PKCS8_X25519_PREFIX = Buffer.from(
  '302e020100300506032b656e04220420',
  'hex'
)
const SPKI_X25519_PREFIX = Buffer.from('302a300506032b656e032100', 'hex')
const ZERO_NONCE = Buffer.alloc(12)
const UNPADDED_BASE64 = /^[A-Za-z0-9+/]*$/

const toPrivateKey = scalar =>
  crypto.createPrivateKey({
    key: Buffer.concat([PKCS8_X25519_PREFIX, scalar]),
    format: 'der',
    type: 'pkcs8'
  })

const toPublicKey = point =>
  crypto.createPublicKey({
    key: Buffer.concat([SPKI_X25519_PREFIX, point]),
    format: 'der',
    type: 'spki'
  })

const publicPointOf = scalar =>
  crypto
    .createPublicKey(toPrivateKey(scalar))
    .export({ format: 'der', type: 'spki' })
    .subarray(SPKI_X25519_PREFIX.length)

const sharedSecret = (scalar, point) => {
  try {
    const secret = crypto.diffieHellman({
      privateKey: toPrivateKey(scalar),
      publicKey: toPublicKey(point)
    })
    return secret.every(byte => byte === 0) ? null : secret
  } catch {
    return null
  }
}

const hkdf = (ikm, salt, info) =>
  Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, KEY_SIZE))

const seal = (key, nonce, plaintext) => {
  const cipher = crypto.createCipheriv('chacha20-poly1305', key, nonce, {
    authTagLength: TAG_SIZE
  })
  return Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag()
  ])
}

const open = (key, nonce, sealed) => {
  if (sealed.length < TAG_SIZE) throw new Error('age ciphertext is truncated')
  const decipher = crypto.createDecipheriv('chacha20-poly1305', key, nonce, {
    authTagLength: TAG_SIZE
  })
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_SIZE))
  return Buffer.concat([
    decipher.update(sealed.subarray(0, sealed.length - TAG_SIZE)),
    decipher.final()
  ])
}

const tryOpen = (key, nonce, sealed) => {
  try {
    return open(key, nonce, sealed)
  } catch {
    return null
  }
}

const toBase64 = bytes =>
  Buffer.from(bytes).toString('base64').replace(/=+$/, '')

const fromBase64 = text => {
  const bytes = Buffer.from(text, 'base64')
  if (!UNPADDED_BASE64.test(text) || toBase64(bytes) !== text) {
    throw new Error('age header has non-canonical base64')
  }
  return bytes
}

const wrapColumns = (text, columns) => {
  const lines = []
  for (let offset = 0; offset < text.length; offset += columns) {
    lines.push(text.slice(offset, offset + columns))
  }
  return lines
}

const parseRecipient = recipient => {
  const { prefix, bytes } = bech32.decode(recipient)
  if (prefix !== RECIPIENT_PREFIX || bytes.length !== KEY_SIZE) {
    throw new Error(`"${recipient}" is not an age X25519 recipient`)
  }
  return bytes
}

const parseIdentity = identity => {
  const { prefix, bytes } = bech32.decode(identity)
  if (prefix !== IDENTITY_PREFIX || bytes.length !== KEY_SIZE) {
    throw new Error('age identity is not an X25519 secret key')
  }
  return bytes
}

const UNSUPPORTED_IDENTITY_PREFIXES = ['AGE-PLUGIN-', 'AGE-SECRET-KEY-PQ-']

const parseIdentities = text =>
  text
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))
    .flatMap(line => line.split(/\s+/))
    .filter(
      token =>
        token &&
        !UNSUPPORTED_IDENTITY_PREFIXES.some(prefix => token.startsWith(prefix))
    )
    .map(parseIdentity)

const formatIdentity = scalar =>
  bech32.encode(IDENTITY_PREFIX, scalar).toUpperCase()

const formatRecipient = point => bech32.encode(RECIPIENT_PREFIX, point)

const generateIdentity = () => {
  const { privateKey } = crypto.generateKeyPairSync('x25519')
  const scalar = privateKey
    .export({ format: 'der', type: 'pkcs8' })
    .subarray(PKCS8_X25519_PREFIX.length)
  return formatIdentity(scalar)
}

const recipientOf = identity =>
  formatRecipient(publicPointOf(parseIdentity(identity)))

const wrapFileKey = (fileKey, recipientPoint) => {
  const ephemeralScalar = crypto.randomBytes(KEY_SIZE)
  const secret = sharedSecret(ephemeralScalar, recipientPoint)
  if (!secret) {
    throw new Error(
      `${formatRecipient(
        recipientPoint
      )} is a low order point, not a usable recipient`
    )
  }
  const ephemeralShare = publicPointOf(ephemeralScalar)
  const wrapKey = hkdf(
    secret,
    Buffer.concat([ephemeralShare, recipientPoint]),
    X25519_LABEL
  )
  return {
    args: ['X25519', toBase64(ephemeralShare)],
    body: seal(wrapKey, ZERO_NONCE, fileKey)
  }
}

const unwrapFileKey = (stanza, identityScalars) => {
  if (stanza.args[0] !== 'X25519' || stanza.args.length !== 2) return null
  const ephemeralShare = fromBase64(stanza.args[1])
  if (
    ephemeralShare.length !== KEY_SIZE ||
    stanza.body.length !== FILE_KEY_SIZE + TAG_SIZE
  ) {
    throw new Error('age X25519 stanza is malformed')
  }
  for (const scalar of identityScalars) {
    const secret = sharedSecret(scalar, ephemeralShare)
    if (!secret) continue
    const recipientPoint = publicPointOf(scalar)
    const wrapKey = hkdf(
      secret,
      Buffer.concat([ephemeralShare, recipientPoint]),
      X25519_LABEL
    )
    const fileKey = tryOpen(wrapKey, ZERO_NONCE, stanza.body)
    if (fileKey) return fileKey
  }
  return null
}

const headerMac = (fileKey, headerText) =>
  crypto
    .createHmac('sha256', hkdf(fileKey, Buffer.alloc(0), 'header'))
    .update(headerText)
    .digest()

const streamNonce = (counter, isLast) => {
  const nonce = Buffer.alloc(12)
  nonce.writeBigUInt64BE(BigInt(counter), 3)
  nonce[11] = isLast ? 1 : 0
  return nonce
}

const encryptPayload = (fileKey, plaintext) => {
  const nonce = crypto.randomBytes(PAYLOAD_NONCE_SIZE)
  const payloadKey = hkdf(fileKey, nonce, 'payload')
  const chunkCount = Math.max(1, Math.ceil(plaintext.length / CHUNK_SIZE))
  const chunks = Array.from({ length: chunkCount }, (_, index) =>
    seal(
      payloadKey,
      streamNonce(index, index === chunkCount - 1),
      plaintext.subarray(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
    )
  )
  return Buffer.concat([nonce, ...chunks])
}

const decryptPayload = (fileKey, payload) => {
  if (payload.length < PAYLOAD_NONCE_SIZE + TAG_SIZE) { throw new Error('age payload is truncated') }
  const payloadKey = hkdf(
    fileKey,
    payload.subarray(0, PAYLOAD_NONCE_SIZE),
    'payload'
  )
  const chunks = []
  let offset = PAYLOAD_NONCE_SIZE
  for (let counter = 0; offset < payload.length; counter++) {
    const sealed = payload.subarray(offset, offset + CHUNK_SIZE + TAG_SIZE)
    offset += sealed.length
    const isLast = offset >= payload.length
    const chunk = tryOpen(payloadKey, streamNonce(counter, isLast), sealed)
    if (!chunk) throw new Error('age payload failed to authenticate')
    if (isLast && chunk.length === 0 && counter > 0) { throw new Error('age payload ends with an empty chunk') }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const armor = binary =>
  [
    ARMOR_BEGIN,
    ...wrapColumns(binary.toString('base64'), ARMOR_COLUMNS),
    ARMOR_END,
    ''
  ].join('\n')

const dearmor = text => {
  const lines = text.trim().split(/\r?\n/)
  if (lines[0] !== ARMOR_BEGIN || lines[lines.length - 1] !== ARMOR_END) {
    throw new Error('age armor is malformed')
  }
  const bodyLines = lines.slice(1, -1)
  const isWrapped = bodyLines.every((line, index) =>
    index === bodyLines.length - 1
      ? line.length > 0 && line.length <= ARMOR_COLUMNS
      : line.length === ARMOR_COLUMNS
  )
  if (!isWrapped) throw new Error('age armor is not wrapped at 64 columns')
  const body = bodyLines.join('')
  const binary = Buffer.from(body, 'base64')
  if (binary.toString('base64') !== body) { throw new Error('age armor has invalid base64') }
  return binary
}

const readLine = (binary, offset) => {
  const end = binary.indexOf(0x0a, offset)
  if (end === -1) throw new Error('age header is truncated')
  return { line: binary.toString('latin1', offset, end), next: end + 1 }
}

const parseHeader = binary => {
  let { line, next } = readLine(binary, 0)
  if (line !== VERSION_LINE) throw new Error('unsupported age format version')
  const stanzas = []
  for (;;) {
    const lineStart = next
    ;({ line, next } = readLine(binary, next))
    if (line.startsWith(MAC_PREFIX + ' ')) {
      return {
        stanzas,
        authenticated: binary.subarray(0, lineStart + MAC_PREFIX.length),
        mac: fromBase64(line.slice(MAC_PREFIX.length + 1)),
        payload: binary.subarray(next)
      }
    }
    if (!line.startsWith(STANZA_PREFIX)) { throw new Error('age header is malformed') }
    const args = line.slice(STANZA_PREFIX.length).split(' ')
    const bodyLines = []
    for (;;) {
      ;({ line, next } = readLine(binary, next))
      bodyLines.push(line)
      if (line.length > STANZA_COLUMNS) { throw new Error('age stanza line is too long') }
      if (line.length < STANZA_COLUMNS) break
    }
    stanzas.push({ args, body: fromBase64(bodyLines.join('')) })
  }
}

const encrypt = (plaintext, recipients) => {
  if (recipients.length === 0) { throw new Error('age needs at least one recipient') }
  const fileKey = crypto.randomBytes(FILE_KEY_SIZE)
  const stanzaLines = recipients
    .map(parseRecipient)
    .map(point => wrapFileKey(fileKey, point))
    .flatMap(({ args, body }) => {
      const encodedBody = toBase64(body)
      const bodyLines = wrapColumns(encodedBody, STANZA_COLUMNS)
      if (encodedBody.length % STANZA_COLUMNS === 0) bodyLines.push('')
      return [STANZA_PREFIX + args.join(' '), ...bodyLines]
    })
  const authenticated = [VERSION_LINE, ...stanzaLines, MAC_PREFIX].join('\n')
  const header = `${authenticated} ${toBase64(
    headerMac(fileKey, authenticated)
  )}\n`
  return armor(
    Buffer.concat([
      Buffer.from(header, 'latin1'),
      encryptPayload(fileKey, Buffer.from(plaintext))
    ])
  )
}

const decrypt = (armored, identityScalars) => {
  const { stanzas, authenticated, mac, payload } = parseHeader(dearmor(armored))
  let fileKey = null
  for (const stanza of stanzas) {
    fileKey = unwrapFileKey(stanza, identityScalars)
    if (fileKey) break
  }
  if (!fileKey) return null
  const expected = headerMac(fileKey, authenticated)
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(mac, expected)
  ) {
    throw new Error('age header MAC is invalid')
  }
  return decryptPayload(fileKey, payload)
}

module.exports = {
  decrypt,
  encrypt,
  generateIdentity,
  parseIdentities,
  parseRecipient,
  recipientOf
}
