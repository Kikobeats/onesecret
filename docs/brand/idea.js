import { arrow, diagramSvg, label, node, zone } from './diagram.js'

export const IDEA = { width: 760, height: 324 }

const ENVIRONMENTS = ['default', 'staging', 'production']
const FILE = { x: 216, width: 248, height: 72, top: 58, gap: 10 }
const KEY = { x: 16, width: 152, height: 84 }
const OUTCOME = { x: 536, width: 208, height: 96 }
const REPO_RIGHT = 480
const fileY = index => FILE.top + index * (FILE.height + FILE.gap)
const fileCenter = index => fileY(index) + FILE.height / 2
const keyCenter = fileCenter(1)
const fork = FILE.x - 24

const keyToFile = index => {
  const target = fileCenter(index)
  if (target === keyCenter) {
    return arrow(`M ${KEY.x + KEY.width},${keyCenter} H ${FILE.x}`)
  }
  const turn = target < keyCenter ? -8 : 8
  return arrow(
    `M ${KEY.x + KEY.width},${keyCenter} H ${
      fork - 8
    } Q ${fork},${keyCenter} ${fork},${keyCenter + turn} V ${
      target - turn
    } Q ${fork},${target} ${fork + 8},${target} H ${FILE.x}`
  )
}

const outcome = ({ y, label: text, dashed, ...rest }) => {
  const center = y + OUTCOME.height / 2
  return [
    arrow(`M ${REPO_RIGHT},${center} H ${OUTCOME.x}`, { dashed }),
    label({ cx: (REPO_RIGHT + OUTCOME.x) / 2, y: center - 22, text }),
    ...node({
      x: OUTCOME.x,
      y,
      width: OUTCOME.width,
      height: OUTCOME.height,
      ...rest
    })
  ]
}

const SCENE = [
  ...zone({
    x: 200,
    y: 28,
    width: REPO_RIGHT - 200,
    height: 276,
    title: 'YOUR REPOSITORY'
  }),
  ...ENVIRONMENTS.map((_, index) => keyToFile(index)),
  ...node({
    x: KEY.x,
    y: keyCenter - KEY.height / 2,
    width: KEY.width,
    height: KEY.height,
    kind: 'key',
    tag: 'KEY',
    name: 'your key',
    lines: ['the one secret', 'you keep']
  }),
  ...ENVIRONMENTS.flatMap((environment, index) =>
    node({
      x: FILE.x,
      y: fileY(index),
      width: FILE.width,
      height: FILE.height,
      kind: 'store',
      tag: environment.toUpperCase(),
      name: `${environment}.enc.yml`,
      lines: ['DATABASE_URL: ENC[…]']
    })
  ),
  ...outcome({
    y: 52,
    label: 'KEY',
    kind: 'app',
    tag: 'YOU, TEAMMATES, CI',
    name: 'every value',
    lines: ['DATABASE_URL=postgres://…', 'STRIPE_KEY=sk_live_…']
  }),
  ...outcome({
    y: 192,
    label: 'NO KEY',
    dashed: true,
    kind: 'platform',
    tag: 'FORK, LEAK, OLD COMMIT',
    name: 'names only',
    lines: ['DATABASE_URL: ENC[…]', 'STRIPE_KEY: ENC[…]']
  })
]

const DESCRIPTION =
  'One key opens every encrypted file in the repository, one per environment. With the key, you, your teammates, and CI read every value; without it, a fork, a leak, or an old commit shows only the secret names.'

export const ideaSvg = () =>
  diagramSvg({
    ...IDEA,
    slug: 'idea',
    title: 'One key opens every secret',
    description: DESCRIPTION,
    scene: SCENE
  })
