const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const SANS = "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"

const TYPE = {
  zone: { size: 10, tracking: '0.14em' },
  label: { size: 11, charWidth: 7.5, tracking: '0.08em' },
  tag: { size: 10, charWidth: 6.8, tracking: '0.08em' },
  name: { size: 16 },
  line: { size: 12, leading: 15 },
  note: { size: 15, leading: 20 }
}
const CHIP_HEIGHT = 16
const CHIP_PADDING = 14
const TAG_INSET = 8
const NODE_BOTTOM_PADDING = 10
const ZONE_TITLE_INSET = 12

const PALETTE = {
  light: {
    ink: '#16150f',
    muted: '#5e5c53',
    line: '#e3e0d6',
    zone: 'rgba(22,21,15,0.025)',
    store: 'rgba(22,21,15,0.04)',
    accent: '#0a7448',
    accentFill: 'rgba(10,116,72,0.08)',
    app: '#ffffff'
  },
  dark: {
    ink: '#ebe9e2',
    muted: '#a8a59b',
    line: '#2e332f',
    zone: 'rgba(235,233,226,0.025)',
    store: 'rgba(235,233,226,0.05)',
    accent: '#3ddc97',
    accentFill: 'rgba(61,220,151,0.10)',
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
    fill: 'var(--accentFill)',
    stroke: 'var(--accent)',
    tag: 'var(--accent)',
    dash: '4,4'
  },
  plaintext: {
    fill: 'var(--accentFill)',
    stroke: 'var(--accent)',
    tag: 'var(--accent)'
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

export const zone = ({ x, y, width, height, title }) => [
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="var(--zone)" stroke="var(--line)"/>`,
  `<text x="${x + ZONE_TITLE_INSET}" y="${
    y + ZONE_TITLE_INSET + TYPE.zone.size / 2
  }" fill="var(--muted)" font-size="${
    TYPE.zone.size
  }" font-family="${MONO}" letter-spacing="${TYPE.zone.tracking}">${escape(
    title
  )}</text>`
]

export const arrow = (d, { dashed = false } = {}) =>
  `<path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.3"${
    dashed ? ' stroke-dasharray="5,4"' : ''
  } marker-end="url(#arrow)"/>`

export const label = ({ cx, y, text }) =>
  `<text x="${cx}" y="${y + 12}" fill="var(--muted)" font-size="${
    TYPE.label.size
  }" font-family="${MONO}" text-anchor="middle" letter-spacing="${
    TYPE.label.tracking
  }">${escape(text)}</text>`

const contentTop = y => y + TAG_INSET + CHIP_HEIGHT

const nameBaseline = ({ y, height, lines }) => {
  const block = TYPE.name.size + lines.length * TYPE.line.leading
  const room = height - (contentTop(y) - y) - NODE_BOTTOM_PADDING
  return contentTop(y) + (room - block) / 2 + TYPE.name.size - 2
}

export const node = ({ x, y, width, height, kind, tag, name, lines }) => {
  const { fill, stroke, tag: tagColor, dash } = KINDS[kind]
  const tagWidth = snap(tag.length * TYPE.tag.charWidth + CHIP_PADDING)
  const cx = x + width / 2
  const nameY = nameBaseline({ y, height, lines })
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="${fill}" stroke="${stroke}"${
      dash ? ` stroke-dasharray="${dash}"` : ''
    }/>`,
    `<rect x="${x + TAG_INSET}" y="${
      y + TAG_INSET
    }" width="${tagWidth}" height="${CHIP_HEIGHT}" rx="2" fill="none" stroke="${tagColor}" stroke-width="0.8"/>`,
    `<text x="${x + TAG_INSET + tagWidth / 2}" y="${
      y + TAG_INSET + 11.5
    }" fill="${tagColor}" font-size="${
      TYPE.tag.size
    }" font-family="${MONO}" text-anchor="middle" letter-spacing="${
      TYPE.tag.tracking
    }">${escape(tag)}</text>`,
    `<text x="${cx}" y="${nameY}" fill="var(--ink)" font-size="${
      TYPE.name.size
    }" font-weight="600" font-family="${SANS}" text-anchor="middle">${escape(
      name
    )}</text>`,
    ...lines.map(
      (line, index) =>
        `<text x="${cx}" y="${
          nameY + (index + 1) * TYPE.line.leading + 2
        }" fill="var(--muted)" font-size="${
          TYPE.line.size
        }" font-family="${MONO}" text-anchor="middle">${escape(line)}</text>`
    )
  ]
}

export const note = ({ x, y, lines }) =>
  lines.map(
    (line, index) =>
      `<text x="${x}" y="${
        y + index * TYPE.note.leading
      }" fill="var(--ink)" font-size="${
        TYPE.note.size
      }" font-style="italic" font-family="${SERIF}">${escape(line)}</text>`
  )

export const diagramSvg = ({
  width,
  height,
  slug,
  title,
  description,
  scene
}) =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${slug}-title ${slug}-description">`,
    `<title id="${slug}-title">${escape(title)}</title>`,
    `<desc id="${slug}-description">${escape(description)}</desc>`,
    `<style>${STYLE}</style>`,
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>',
    ...scene,
    '</svg>',
    ''
  ].join('\n')
