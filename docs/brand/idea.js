import { arrow, diagramSvg, label, node, zone } from './diagram.js'

export const IDEA = { width: 960, height: 372 }

const ENVIRONMENTS = ['default', 'staging', 'production']
const FILE = { x: 284, width: 340, height: 76, top: 72, gap: 12 }
const KEY = { x: 24, width: 200, height: 80 }
const fileY = index => FILE.top + index * (FILE.height + FILE.gap)
const fileCenter = index => fileY(index) + FILE.height / 2
const keyCenter = fileCenter(1)
const fork = FILE.x - 30

const keyToFile = index => {
  const target = fileCenter(index)
  if (target === keyCenter) { return arrow(`M ${KEY.x + KEY.width},${keyCenter} H ${FILE.x}`) }
  const turn = target < keyCenter ? -8 : 8
  return arrow(
    `M ${KEY.x + KEY.width},${keyCenter} H ${
      fork - 8
    } Q ${fork},${keyCenter} ${fork},${keyCenter + turn} V ${
      target - turn
    } Q ${fork},${target} ${fork + 8},${target} H ${FILE.x}`
  )
}

const SCENE = [
  ...zone({
    x: 264,
    y: 40,
    width: 380,
    height: 304,
    title: 'YOUR REPOSITORY · config/'
  }),
  ...ENVIRONMENTS.map((_, index) => keyToFile(index)),
  arrow('M 644,124 H 704'),
  arrow('M 644,272 H 704', { dashed: true }),
  ...label({ cx: 674, y: 104, text: 'KEY' }),
  ...label({ cx: 674, y: 252, text: 'NO KEY' }),
  ...node({
    x: KEY.x,
    y: keyCenter - KEY.height / 2,
    width: KEY.width,
    height: KEY.height,
    kind: 'key',
    tag: 'THE ONE SECRET',
    name: 'your key',
    lines: ['kept in a password manager', 'opens every file']
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
      lines: [
        'DATABASE_URL: ENC[AES256_GCM,…]',
        'STRIPE_KEY: ENC[AES256_GCM,…]'
      ]
    })
  ),
  ...node({
    x: 704,
    y: 72,
    width: 232,
    height: 104,
    kind: 'app',
    tag: 'YOU, TEAMMATES, CI',
    name: 'every value',
    lines: ['DATABASE_URL=postgres://…', 'STRIPE_KEY=sk_live_…']
  }),
  ...node({
    x: 704,
    y: 220,
    width: 232,
    height: 104,
    kind: 'platform',
    tag: 'A FORK, A LEAK, AN OLD COMMIT',
    name: 'names only',
    lines: ['DATABASE_URL: ENC[…]', 'STRIPE_KEY: ENC[…]']
  })
]

const DESCRIPTION =
  'One key, kept in a password manager, opens every encrypted file in the repository, one per environment. With the key, you, your teammates, and CI read every value; without it, a fork, a leak, or an old commit shows only the secret names.'

export const ideaSvg = () =>
  diagramSvg({
    ...IDEA,
    slug: 'idea',
    title: 'One key opens every secret',
    description: DESCRIPTION,
    scene: SCENE
  })
