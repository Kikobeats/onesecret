import { arrow, diagramSvg, label, node, note, zone } from './diagram.js'

export const DEPLOY = { width: 760, height: 320 }

const SCENE = [
  ...zone({
    x: 16,
    y: 44,
    width: 352,
    height: 260,
    title: 'YOUR REPOSITORY AND CI'
  }),
  ...zone({
    x: 392,
    y: 44,
    width: 352,
    height: 260,
    title: 'YOUR HOSTING PLATFORM'
  }),
  arrow('M 188,112 H 276 Q 284,112 284,120 V 140'),
  arrow('M 188,256 H 276 Q 284,256 284,248 V 232'),
  arrow('M 352,186 H 408'),
  arrow('M 544,186 H 592', { dashed: true }),
  arrow('M 320,140 V 38 Q 320,30 328,30 H 652 Q 660,30 660,38 V 140'),
  label({ cx: 236, y: 90, text: 'CIPHERTEXT' }),
  label({ cx: 236, y: 234, text: 'AGE KEY' }),
  label({ cx: 380, y: 164, text: 'VALUES' }),
  label({ cx: 490, y: 8, text: 'SHIPS config/, NEVER THE KEY' }),
  ...node({
    x: 32,
    y: 76,
    width: 156,
    height: 72,
    kind: 'store',
    tag: 'REPO',
    name: 'config/',
    lines: ['*.enc.yml, encrypted']
  }),
  ...node({
    x: 32,
    y: 220,
    width: 156,
    height: 72,
    kind: 'key',
    tag: 'KEY',
    name: 'SOPS_AGE_KEY',
    lines: ['a CI variable']
  }),
  ...node({
    x: 216,
    y: 140,
    width: 136,
    height: 92,
    kind: 'plaintext',
    tag: 'DEPLOY JOB',
    name: 'deploy script',
    lines: ['onesecret dotenv', 'values in memory']
  }),
  ...node({
    x: 408,
    y: 140,
    width: 136,
    height: 92,
    kind: 'platform',
    tag: 'SECRETS',
    name: 'Platform',
    lines: ['Vercel, Fly.io,', 'AWS, and more']
  }),
  ...node({
    x: 592,
    y: 140,
    width: 136,
    height: 92,
    kind: 'app',
    tag: 'APP',
    name: 'your app',
    lines: ['config() at boot', 'decrypts nothing']
  }),
  ...note({
    x: 408,
    y: 264,
    lines: [
      'The key never reaches your servers: the app',
      'finds every secret already set at boot.'
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
