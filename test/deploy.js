'use strict'

const { default: test } = require('ava')
const yaml = require('js-yaml')
const onesecret = require('../src')
const { flyImport } = require('../src/deploy')
const { FIXTURE_KEY, project, recordingBinary, withEnv } = require('./helpers')

const PRODUCTION_ENV = {
  API_TOKEN: 'Bearer production-token',
  S3_KEY: 'AKIA-default',
  PORT: '3000',
  PUBLIC_unencrypted: 'visible',
  DATABASE_URL: 'postgres://fixture-production'
}

test.serial(
  'kubernetes applies a Secret manifest through kubectl without the age key',
  t => {
    const cwd = project({ fixture: 'app' })
    const kubectl = recordingBinary('kubectl', {
      stdout: 'secret/api-env configured\n'
    })
    const result = withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () =>
      onesecret.kubernetes({
        cwd,
        env: 'production',
        name: 'api-env',
        namespace: 'api',
        context: 'prod',
        kubectl: kubectl.file
      })
    )
    const call = kubectl.call()
    t.deepEqual(call.args, ['--context', 'prod', 'apply', '-f', '-'])
    t.is(call.env.SOPS_AGE_KEY, undefined)
    const manifest = yaml.load(call.input)
    t.is(manifest.kind, 'Secret')
    t.is(manifest.metadata.name, 'api-env')
    t.is(manifest.metadata.namespace, 'api')
    t.is(manifest.metadata.labels['app.kubernetes.io/managed-by'], 'onesecret')
    const decoded = Object.fromEntries(
      Object.entries(manifest.data).map(([key, value]) => [
        key,
        Buffer.from(value, 'base64').toString()
      ])
    )
    t.deepEqual(decoded, PRODUCTION_ENV)
    t.is(result.checksum, onesecret.checksum(PRODUCTION_ENV))
    t.is(result.output, 'secret/api-env configured')
  }
)

test.serial(
  'kubernetes passes extra kubectl args and omits an absent namespace',
  t => {
    const cwd = project({ fixture: 'app' })
    const kubectl = recordingBinary('kubectl')
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () =>
      onesecret.kubernetes({
        cwd,
        env: 'default',
        name: 'api-env',
        kubectl: kubectl.file,
        args: ['--kubeconfig', '/tmp/k']
      })
    )
    const call = kubectl.call()
    t.deepEqual(call.args, ['--kubeconfig', '/tmp/k', 'apply', '-f', '-'])
    t.false('namespace' in yaml.load(call.input).metadata)
  }
)

test.serial('a kubectl failure is reported with values redacted', t => {
  const cwd = project({ fixture: 'app' })
  const kubectl = recordingBinary('kubectl', {
    exitCode: 1,
    stderr: 'error: API_TOKEN=Bearer leaked is invalid\n'
  })
  const error = withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () =>
    t.throws(() =>
      onesecret.kubernetes({
        cwd,
        env: 'production',
        name: 'api-env',
        kubectl: kubectl.file
      })
    )
  )
  t.is(error.code, 'EDEPLOY')
  t.regex(error.message, /API_TOKEN=\*\*\*/)
  t.notRegex(error.message, /leaked/)
})

test.serial('a missing binary is named', t => {
  const cwd = project({ fixture: 'app' })
  const error = withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () =>
    t.throws(() =>
      onesecret.kubernetes({
        cwd,
        env: 'production',
        name: 'api-env',
        kubectl: '/nonexistent/kubectl'
      })
    )
  )
  t.regex(error.message, /\/nonexistent\/kubectl is not installed/)
})

test('kubernetes and fly need a target name', t => {
  t.is(t.throws(() => onesecret.kubernetes({})).code, 'EVALUE')
  t.is(t.throws(() => onesecret.fly({})).code, 'EVALUE')
})

test.serial(
  'fly stages the secrets for the next deploy and hides values from its output',
  t => {
    const cwd = project({ fixture: 'app' })
    const fly = recordingBinary('fly', {
      stdout:
        'API_TOKEN=Bearer production-token\nSecrets are staged for the first deployment\n'
    })
    const result = withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () =>
      onesecret.fly({
        cwd,
        env: 'production',
        app: 'api-staging',
        flyctl: fly.file
      })
    )
    const call = fly.call()
    t.deepEqual(call.args, [
      'secrets',
      'import',
      '--stage',
      '--app',
      'api-staging'
    ])
    t.is(call.env.SOPS_AGE_KEY, undefined)
    t.true(call.input.includes('API_TOKEN=Bearer production-token\n'))
    t.is(result.output, 'Secrets are staged for the first deployment')
    t.is(result.checksum, onesecret.checksum(PRODUCTION_ENV))
  }
)

test.serial('fly can apply the secrets right away', t => {
  const cwd = project({ fixture: 'app' })
  const fly = recordingBinary('fly')
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () =>
    onesecret.fly({
      cwd,
      env: 'production',
      app: 'api',
      stage: false,
      flyctl: fly.file
    })
  )
  t.deepEqual(fly.call().args, ['secrets', 'import', '--app', 'api'])
})

test.serial('deploys refuse to guess the env, even when NODE_ENV is set', t => {
  const cwd = project({ fixture: 'app' })
  const kubectl = recordingBinary('kubectl')
  withEnv({ SOPS_AGE_KEY: FIXTURE_KEY, NODE_ENV: 'development' }, () => {
    t.regex(
      t.throws(() =>
        onesecret.kubernetes({ cwd, name: 'api-env', kubectl: kubectl.file })
      ).message,
      /needs an explicit env/
    )
    t.regex(
      t.throws(() => onesecret.fly({ cwd, app: 'api', flyctl: kubectl.file }))
        .message,
      /needs an explicit env/
    )
  })
})

test('fly import reads back to the exact values through the flyctl parser', t => {
  const { parse } = require('../src/fly')
  const values = {
    HASH: 'abc#def',
    SINGLE_QUOTED: "'quoted-pass'",
    EMPTY_QUOTES: "''",
    LONE_QUOTE: "'",
    LONE_DOUBLE_QUOTE: '"',
    LEAD: ' lead',
    TRAIL: 'trail ',
    PEM: '-----BEGIN KEY-----\nabc\n-----END KEY-----\n',
    TRIPLE: '"""',
    MIXED: 'mixed \'q\' and "dq" #hash',
    EMPTY: '',
    AFTER: 'still here'
  }
  t.deepEqual(parse(flyImport(values)), values)
  t.is(flyImport({ PLAIN: 'value' }), 'PLAIN=value\n')
  t.is(t.throws(() => flyImport({ HUGE: 'x'.repeat(70000) })).code, 'EVALUE')
})

test('the flyctl parser port fails where flyctl does', t => {
  const { parse } = require('../src/fly')
  t.throws(() => parse("A='\n"), { message: /lone quote/ })
  t.throws(() => parse('no separator\n'), { message: /not NAME=VALUE/ })
  t.deepEqual(parse('# comment\n\nA=1 # trailing\nB="""x\ny"""\n'), {
    A: '1',
    B: 'x\ny'
  })
})

test.serial(
  'a typo in the env or a wrong directory never reaches the cluster',
  t => {
    const cwd = project({ fixture: 'app' })
    const kubectl = recordingBinary('kubectl')
    withEnv({ SOPS_AGE_KEY: FIXTURE_KEY }, () => {
      const typo = t.throws(() =>
        onesecret.kubernetes({
          cwd,
          env: 'prodution',
          name: 'api-env',
          kubectl: kubectl.file
        })
      )
      t.regex(typo.message, /no "prodution" layer/)
      const wrongDir = t.throws(() =>
        onesecret.kubernetes({
          cwd,
          dir: 'secret',
          env: 'production',
          name: 'api-env',
          kubectl: kubectl.file
        })
      )
      t.regex(wrongDir.message, /no "production" layer/)
    })
    t.throws(() => kubectl.call())
  }
)
