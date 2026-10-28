'use strict'

const { execFileSync } = require('child_process')
const {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')
const { setFlagsFromString } = require('v8')
const { runInNewContext } = require('vm')

const RUNS = 7
const SECRETS = 400
const DECRYPTS = 20
const RELOADS = 100

const ROOT = join(__dirname, '..')
const BIN = join(ROOT, 'bin', 'index.js')
const KEY = readFileSync(
  join(ROOT, 'test', 'fixtures', 'key.txt'),
  'utf8'
).match(/AGE-SECRET-KEY-\w+/)[0]
const SCRATCH = mkdtempSync(join(tmpdir(), 'onesecret-benchmark-'))

process.on('exit', () => rmSync(SCRATCH, { recursive: true, force: true }))
process.env.HOME = SCRATCH
process.env.XDG_CONFIG_HOME = join(SCRATCH, '.config')
process.env.SOPS_AGE_KEY = KEY
delete process.env.SOPS_AGE_KEY_FILE
delete process.env.SOPS_AGE_KEY_CMD
delete process.env.ONESECRET_SKIP
delete process.env.NODE_ENV

const { config } = require('..')

const median = values => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

setFlagsFromString('--expose-gc')
const collectGarbage = runInNewContext('gc')

const now = () => process.hrtime.bigint()

const elapsed = started => Number(now() - started) / 1e6

const secretLine = index => {
  if (index % 3 === 0) return `PORT_${index}: ${3000 + index}`
  if (index % 3 === 1) return `FLAG_${index}: true`
  return `TOKEN_${index}: "${'t'.repeat(40)}${index}"`
}

const plaintextYaml = () =>
  Array.from({ length: SECRETS }, (_, index) => secretLine(index)).join('\n') +
  '\n'

const encryptedProject = () => {
  const project = join(SCRATCH, 'template')
  const plaintext = join(SCRATCH, 'plaintext.yml')
  mkdirSync(project)
  writeFileSync(plaintext, plaintextYaml())
  const run = (args, env = {}) =>
    execFileSync(process.execPath, [BIN, ...args], {
      cwd: project,
      env: { ...process.env, SOPS_AGE_KEY: KEY, ...env },
      stdio: 'ignore'
    })
  run(['init'])
  run(['edit'], { EDITOR: `cp '${plaintext}'`, VISUAL: '' })
  return project
}

const TEMPLATE = encryptedProject()

let copies = 0

const freshProject = () => {
  const project = join(SCRATCH, `copy-${copies++}`)
  cpSync(TEMPLATE, project, { recursive: true })
  return project
}

const loadConfig = cwd => config({ cwd, processEnv: {} })

const isComplete = values =>
  Object.keys(values).length === SECRETS &&
  values.PORT_0 === 3000 &&
  values.FLAG_1 === true &&
  values.TOKEN_2 === `${'t'.repeat(40)}2`

const countComplete = projects =>
  projects.reduce(
    (complete, cwd) => complete + (isComplete(loadConfig(cwd)) ? 1 : 0),
    0
  )

const decryptCase = {
  name: `config() decrypt ${SECRETS} secrets`,
  extra: `${DECRYPTS} uncached loads of a ${SECRETS} secret layer`,
  setup: state => {
    state.batches = Array.from({ length: RUNS + 1 }, () =>
      Array.from({ length: DECRYPTS }, freshProject)
    )
  },
  timed: state => countComplete(state.batches.pop()),
  verify: complete => complete === DECRYPTS
}

const reloadCase = {
  name: `config() cached reload ${SECRETS} secrets`,
  extra: `${RELOADS} loads of an already decrypted ${SECRETS} secret layer`,
  setup: state => {
    state.projects = Array(RELOADS).fill(freshProject())
  },
  timed: state => countComplete(state.projects),
  verify: complete => complete === RELOADS
}

const CASES = [decryptCase, reloadCase]

const fmt = value => value.toFixed(1)

const report = slot => {
  const med = slot.walls.length ? median(slot.walls) : Number.NaN
  const min = slot.walls.length ? Math.min(...slot.walls) : Number.NaN
  const max = slot.walls.length ? Math.max(...slot.walls) : Number.NaN
  const extra = `${slot.entry.extra}, errors ${slot.errors}, runs ${RUNS}`
  console.log(
    `${slot.entry.name}  median ${fmt(med)}ms  range ${fmt(min)}-${fmt(
      max
    )}  ${extra}`
  )
  return {
    name: slot.entry.name,
    unit: 'ms',
    value: Number(med.toFixed(1)),
    range: `${fmt(min)}-${fmt(max)}`,
    extra
  }
}

const takeSample = async (slot, run) => {
  try {
    collectGarbage()
    const started = now()
    const outcome = await slot.entry.timed(slot.state)
    const wall = elapsed(started)
    if (!slot.entry.verify(outcome)) {
      console.error(`${slot.entry.name} run ${run} produced unexpected output`)
      slot.errors++
      return
    }
    slot.walls.push(wall)
  } catch (error) {
    console.error(error)
    slot.errors++
  }
}

const main = async () => {
  const slots = []
  for (const entry of CASES) {
    const state = {}
    await entry.setup(state)
    await entry.timed(state)
    slots.push({ entry, state, walls: [], errors: 0 })
  }
  for (let run = 0; run < RUNS; run++) {
    for (const slot of slots) await takeSample(slot, run)
  }
  const results = slots.map(report)
  writeFileSync(
    join(__dirname, '..', 'benchmark-output.json'),
    JSON.stringify(results, null, 2) + '\n'
  )
  const errors = slots.reduce((total, slot) => total + slot.errors, 0)
  if (errors > 0 || results.some(result => !Number.isFinite(result.value))) {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
