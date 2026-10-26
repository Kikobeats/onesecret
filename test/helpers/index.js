'use strict'

const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { AGE_KEY_VARIABLES, forgetAgeKey } = require('../../src/keys')

const FIXTURES = path.join(__dirname, '..', 'fixtures')
const BIN = path.join(__dirname, '..', '..', 'bin', 'index.js')
const fixtureKeyText = name =>
  fs.readFileSync(path.join(FIXTURES, name), 'utf8')
const FIXTURE_KEY = fixtureKeyText('key.txt').match(/AGE-SECRET-KEY-\w+/)[0]
const FIXTURE_RECIPIENT = fixtureKeyText('key.txt').match(/age1\w+/)[0]
const OTHER_KEY = fixtureKeyText('other-key.txt').match(/AGE-SECRET-KEY-\w+/)[0]

const createdDirs = []
process.on('exit', () => {
  for (const dir of createdDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'onesecret-home-'))
createdDirs.push(isolatedHome)
process.env.HOME = isolatedHome
process.env.XDG_CONFIG_HOME = path.join(isolatedHome, '.config')
process.env.EDITOR = 'false'
delete process.env.VISUAL
for (const name of [
  'SOPS_AGE_KEY',
  'SOPS_AGE_KEY_FILE',
  'SOPS_AGE_KEY_CMD',
  'ONESECRET_SKIP',
  'NODE_ENV'
]) {
  delete process.env[name]
}

const temporaryDir = prefix => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `onesecret-${prefix}-`))
  createdDirs.push(dir)
  return dir
}

const project = ({ fixture = 'sops', packageJson } = {}) => {
  const cwd = temporaryDir('project')
  fs.cpSync(path.join(FIXTURES, fixture), path.join(cwd, 'config'), {
    recursive: true
  })
  if (packageJson) {
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify(packageJson)
    )
  }
  return cwd
}

const withEnv = (overrides, fn) => {
  const saved = Object.fromEntries(
    Object.keys(overrides).map(name => [name, process.env[name]])
  )
  const touchesAgeKey = Object.keys(overrides).some(name =>
    AGE_KEY_VARIABLES.includes(name)
  )
  if (touchesAgeKey) forgetAgeKey()
  const restore = () => {
    if (touchesAgeKey) forgetAgeKey()
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      return result.finally(restore)
    }
    restore()
    return result
  } catch (error) {
    restore()
    throw error
  }
}

const fakeBinary = (name, script) => {
  const dir = temporaryDir('bin')
  const file = path.join(dir, name)
  fs.writeFileSync(file, `#!/usr/bin/env node\n${script}\n`, { mode: 0o755 })
  return { dir, file }
}

const cli = (args, { cwd, env = {}, input } = {}) => {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  })
  return {
    code: result.status,
    rawStdout: result.stdout,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  }
}

const hasBinary = name => {
  try {
    execFileSync(name, ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

module.exports = {
  FIXTURES,
  FIXTURE_KEY,
  FIXTURE_RECIPIENT,
  OTHER_KEY,
  cli,
  fakeBinary,
  hasBinary,
  project,
  temporaryDir,
  withEnv
}
