import { arrow, diagramSvg, label, node, note, zone } from './diagram.js'

export const DEPLOY = { width: 960, height: 400 }

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
  diagramSvg({
    ...DEPLOY,
    slug: 'deploy',
    title: 'How onesecret deploys',
    description: DESCRIPTION,
    scene: SCENE
  })
