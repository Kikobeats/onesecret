'use strict'

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { default: test } = require('ava')
const { temporaryDir } = require('./helpers')

const ROOT = path.join(__dirname, '..')
const EXAMPLE = path.join(ROOT, 'example')
const EXAMPLE_README = fs.readFileSync(path.join(EXAMPLE, 'README.md'), 'utf8')

const exampleCopy = () => {
  const cwd = temporaryDir('example')
  fs.cpSync(EXAMPLE, cwd, {
    recursive: true,
    filter: source => path.basename(source) !== 'node_modules'
  })
  fs.mkdirSync(path.join(cwd, 'node_modules'))
  fs.symlinkSync(ROOT, path.join(cwd, 'node_modules', 'onesecret'), 'dir')
  return cwd
}

const start = env => {
  const { status, stdout, stderr } = spawnSync(process.execPath, ['index.js'], {
    cwd: exampleCopy(),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  })
  return { status, stdout, stderr }
}

const assertDocumented = (t, stdout) =>
  t.true(EXAMPLE_README.includes(stdout), `README is missing:\n${stdout}`)

test('development decrypts the default layer through keyCommand', t => {
  const { status, stdout, stderr } = start({})
  t.is(status, 0, stderr)
  t.is(
    stdout,
    'environment  development\ndatabase     localhost:5432\nstripe       sk_test_…\nsession      18 characters\n'
  )
  assertDocumented(t, stdout)
})

test('production with every secret injected needs no key', t => {
  const { status, stdout, stderr } = start({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://injected:5432/app',
    STRIPE_KEY: 'sk_live_injected',
    SESSION_SECRET: 'from-platform'
  })
  t.is(status, 0, stderr)
  t.is(
    stdout,
    'environment  production\ndatabase     injected:5432\nstripe       sk_live_…\nsession      13 characters\n'
  )
  assertDocumented(t, stdout)
})

test('production never runs keyCommand and names the missing secrets', t => {
  const { status, stderr } = start({ NODE_ENV: 'production' })
  t.is(status, 1)
  t.regex(
    stderr,
    /DATABASE_URL, STRIPE_KEY, SESSION_SECRET are not set and cannot be decrypted, no age key found: .*\(keyCommand is not run here\)/
  )
})

test('production with the key merges its layer over the default one', t => {
  const { status, stdout, stderr } = start({
    NODE_ENV: 'production',
    SOPS_AGE_KEY_FILE: 'age.key'
  })
  t.is(status, 0, stderr)
  t.is(
    stdout,
    'environment  production\ndatabase     db.internal:5432\nstripe       sk_live_…\nsession      18 characters\n'
  )
  assertDocumented(t, stdout)
})
