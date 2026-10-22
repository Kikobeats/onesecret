export const SECRET_LINES = Object.freeze([
  ['DATABASE_URL', 'postgres://db/prod'],
  ['STRIPE_SECRET', 'stripe_demo_7Qf2Lm9X'],
  ['OPENAI_API_KEY', 'openai_demo_Vx4mT9'],
  ['GITHUB_TOKEN', 'gh_demo_7Hq2LmX9vR'],
  ['REDIS_URL', 'redis://cache:6379'],
  ['SESSION_SECRET', '3c9f0e8a2b7d1f4e'],
  ['SMTP_PASSWORD', 'horse-battery-staple'],
  ['AWS_SECRET_KEY', 'wJalrXUtnFEMI/K7MD'],
  ['SENTRY_DSN', 'https://k@sentry.io'],
  ['COOKIE_SECRET', 's3cr3t-c00kie-d3m0'],
  ['ENCRYPTION_KEY', 'base64:Qm9vdHN0cmFw'],
  ['POSTMARK_TOKEN', 'pm_demo_0c6a4e2f9b'],
  ['SLACK_WEBHOOK', 'hooks.slack.com/T0'],
  ['ALGOLIA_KEY', 'algolia_demo_e1c7'],
  ['AWS_ACCESS_KEY', 'AKIA_DEMO_QZ7N2XB6'],
  ['SIGNING_KEY', '8f3a1c9e7b2d4f60']
])

export const CIPHER_PREFIX = 'ENC[AES256_GCM,data:'
export const TABLE_KEY_COLUMNS = 14
export const TABLE_VALUE_COLUMNS = 20

const TEXT_CELLS = 64
const TEXEL_WIDTH = 66
const SEPARATOR = ': '

function assertFitsTable (key, value) {
  if (key.length > TABLE_KEY_COLUMNS || value.length > TABLE_VALUE_COLUMNS) {
    throw new RangeError(
      `"${key}: ${value}" does not fit the ${TABLE_KEY_COLUMNS}+${TABLE_VALUE_COLUMNS} column table`
    )
  }
}

export function encodeLines (lines = SECRET_LINES) {
  const rows = lines.length + 1
  const data = new Uint8Array(TEXEL_WIDTH * rows).fill(32)
  lines.forEach(([key, value], row) => {
    assertFitsTable(key, value)
    const text = `${key}${SEPARATOR}${value}`.slice(0, TEXT_CELLS)
    for (let i = 0; i < text.length; i++) {
      data[row * TEXEL_WIDTH + i] = text.charCodeAt(i)
    }
    data[row * TEXEL_WIDTH + TEXT_CELLS] = key.length + SEPARATOR.length
    data[row * TEXEL_WIDTH + TEXT_CELLS + 1] = text.length
  })
  const prefixRow = lines.length * TEXEL_WIDTH
  for (let i = 0; i < CIPHER_PREFIX.length; i++) {
    data[prefixRow + i] = CIPHER_PREFIX.charCodeAt(i)
  }
  return { data, width: TEXEL_WIDTH, height: rows }
}
