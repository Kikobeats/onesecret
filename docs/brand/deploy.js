export const DEPLOY = { width: 960, height: 400 }

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const SANS = "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"
const LABEL_CHAR_WIDTH = 6.3
const LABEL_PADDING = 12
const TAG_CHAR_WIDTH = 5.7
const ZONE_CHAR_WIDTH = 5.9

const PALETTE = {
  light: {
    paper: '#fbfaf6',
    ink: '#16150f',
    muted: '#5e5c53',
    line: '#e3e0d6',
    zone: 'rgba(22,21,15,0.025)',
    store: 'rgba(22,21,15,0.04)',
    hot: '#b4540a',
    hotFill: 'rgba(180,84,10,0.08)',
    app: '#ffffff'
  },
  dark: {
    paper: '#0f110f',
    ink: '#ebe9e2',
    muted: '#a8a59b',
    line: '#2e332f',
    zone: 'rgba(235,233,226,0.025)',
    store: 'rgba(235,233,226,0.05)',
    hot: '#f5a95c',
    hotFill: 'rgba(245,169,92,0.10)',
    app: '#1a1e1b'
  }
}

const variables = colors =>
  Object.entries(colors)
    .map(([name, value]) => `--${name}:${value}`)
    .join(';')

const STYLE = `svg{${variables(
  PALETTE.light
)}}@media (prefers-color-scheme:dark){svg{${variables(PALETTE.dark)}}}`

const KINDS = {
  store: { fill: 'var(--store)', stroke: 'var(--muted)', tag: 'var(--muted)' },
  key: {
    fill: 'var(--hotFill)',
    stroke: 'var(--hot)',
    tag: 'var(--hot)',
    dash: '4,4'
  },
  plaintext: {
    fill: 'var(--hotFill)',
    stroke: 'var(--hot)',
    tag: 'var(--hot)'
  },
  platform: {
    fill: 'var(--store)',
    stroke: 'var(--line)',
    tag: 'var(--muted)'
  },
  app: { fill: 'var(--app)', stroke: 'var(--ink)', tag: 'var(--ink)' }
}

const escape = text =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const snap = width => Math.ceil(width / 4) * 4

const zone = ({ x, y, width, height, title }) => {
  const titleWidth = snap(title.length * ZONE_CHAR_WIDTH + 16)
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="var(--zone)" stroke="var(--line)"/>`,
    `<rect x="${x + 16}" y="${
      y - 6
    }" width="${titleWidth}" height="12" fill="var(--paper)"/>`,
    `<text x="${x + 16 + titleWidth / 2}" y="${
      y + 3
    }" fill="var(--muted)" font-size="8.5" font-family="${MONO}" text-anchor="middle" letter-spacing="0.14em">${escape(
      title
    )}</text>`
  ]
}

const arrow = (d, { dashed = false } = {}) =>
  `<path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.2"${
    dashed ? ' stroke-dasharray="4,3"' : ''
  } marker-end="url(#arrow)"/>`

const label = ({ cx, y, text }) => {
  const width = snap(text.length * LABEL_CHAR_WIDTH + LABEL_PADDING)
  return [
    `<rect x="${
      cx - width / 2
    }" y="${y}" width="${width}" height="13" rx="2" fill="var(--paper)"/>`,
    `<text x="${cx}" y="${
      y + 9.5
    }" fill="var(--muted)" font-size="9" font-family="${MONO}" text-anchor="middle" letter-spacing="0.08em">${escape(
      text
    )}</text>`
  ]
}

const node = ({ x, y, width, height, kind, tag, name, lines }) => {
  const { fill, stroke, tag: tagColor, dash } = KINDS[kind]
  const tagWidth = snap(tag.length * TAG_CHAR_WIDTH + 12)
  const cx = x + width / 2
  const nameY = y + height / 2
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="var(--paper)"/>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="${fill}" stroke="${stroke}"${
      dash ? ` stroke-dasharray="${dash}"` : ''
    }/>`,
    `<rect x="${x + 8}" y="${
      y + 8
    }" width="${tagWidth}" height="13" rx="2" fill="none" stroke="${tagColor}" stroke-width="0.8"/>`,
    `<text x="${x + 8 + tagWidth / 2}" y="${
      y + 17.5
    }" fill="${tagColor}" font-size="8" font-family="${MONO}" text-anchor="middle" letter-spacing="0.08em">${escape(
      tag
    )}</text>`,
    `<text x="${cx}" y="${nameY}" fill="var(--ink)" font-size="14" font-weight="600" font-family="${SANS}" text-anchor="middle">${escape(
      name
    )}</text>`,
    ...lines.map(
      (line, index) =>
        `<text x="${cx}" y="${
          nameY + 17 + index * 13
        }" fill="var(--muted)" font-size="10" font-family="${MONO}" text-anchor="middle">${escape(
          line
        )}</text>`
    )
  ]
}

const note = ({ x, y, lines }) =>
  lines.map(
    (line, index) =>
      `<text x="${x}" y="${
        y + index * 18
      }" fill="var(--ink)" font-size="14" font-style="italic" font-family="${SERIF}">${escape(
        line
      )}</text>`
  )

const SCENE = [
  ...zone({
    x: 24,
    y: 56,
    width: 440,
    height: 320,
    title: 'YOUR REPOSITORY AND CI'
  }),
  ...zone({
    x: 500,
    y: 56,
    width: 436,
    height: 320,
    title: 'YOUR HOSTING PLATFORM'
  }),
  arrow('M 228,124 H 344 Q 352,124 352,132 V 164'),
  arrow('M 228,288 H 344 Q 352,288 352,280 V 260'),
  arrow('M 444,212 H 524'),
  arrow('M 684,212 H 760', { dashed: true }),
  arrow('M 420,164 V 32 Q 420,24 428,24 H 832 Q 840,24 840,32 V 164'),
  ...label({ cx: 290, y: 104, text: 'CIPHERTEXT' }),
  ...label({ cx: 290, y: 268, text: 'AGE KEY' }),
  ...label({ cx: 484, y: 192, text: 'VALUES' }),
  ...label({ cx: 722, y: 192, text: 'AT BOOT' }),
  ...label({ cx: 630, y: 18, text: 'DEPLOY SHIPS config/, NEVER THE KEY' }),
  ...node({
    x: 48,
    y: 88,
    width: 180,
    height: 72,
    kind: 'store',
    tag: 'REPO',
    name: 'config/',
    lines: ['*.enc.yml, committed', 'encrypted at rest']
  }),
  ...node({
    x: 48,
    y: 252,
    width: 180,
    height: 72,
    kind: 'key',
    tag: 'KEY',
    name: 'SOPS_AGE_KEY',
    lines: ['a CI variable', 'the one secret kept']
  }),
  ...node({
    x: 276,
    y: 164,
    width: 168,
    height: 96,
    kind: 'plaintext',
    tag: 'DEPLOY JOB',
    name: 'deploy script',
    lines: ['onesecret dotenv', 'plaintext in memory only']
  }),
  ...node({
    x: 524,
    y: 164,
    width: 160,
    height: 96,
    kind: 'platform',
    tag: 'SECRETS',
    name: 'Platform',
    lines: ['Vercel, Fly.io, AWS,', 'Kubernetes, Docker…']
  }),
  ...node({
    x: 760,
    y: 164,
    width: 152,
    height: 96,
    kind: 'app',
    tag: 'APP',
    name: 'config()',
    lines: ['finds every value set', 'decrypts nothing']
  }),
  ...note({
    x: 524,
    y: 304,
    lines: [
      'The key never reaches your servers. The app',
      'reads secrets from the environment, and stops',
      'at boot, naming any secret that is missing.'
    ]
  })
]

const DESCRIPTION =
  'The deploy job reads the encrypted config/ files and the one age key, decrypts the values in memory, and hands them to the hosting platform. The app starts with every secret already in its environment, so it never holds the key.'

export const deploySvg = () =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DEPLOY.width} ${DEPLOY.height}" width="${DEPLOY.width}" height="${DEPLOY.height}" role="img" aria-labelledby="deploy-title deploy-description">`,
    '<title id="deploy-title">How onesecret deploys</title>',
    `<desc id="deploy-description">${escape(DESCRIPTION)}</desc>`,
    `<style>${STYLE}</style>`,
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>',
    `<rect width="${DEPLOY.width}" height="${DEPLOY.height}" rx="12" fill="var(--paper)"/>`,
    ...SCENE,
    '</svg>',
    ''
  ].join('\n')
