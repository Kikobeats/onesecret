'use strict'

const { execFileSync } = require('node:child_process')
const yaml = require('js-yaml')
const { loadSecrets, readLayers } = require('./secrets')
const { withoutAgeKey } = require('./keys')
const { checksum, toEnv } = require('./format')
const flyEncoding = require('./fly')
const { OnesecretError } = require('./error')

const MANAGED_BY_LABEL = 'app.kubernetes.io/managed-by'

const loadForDeploy = (target, options) => {
  if (!options.env) {
    throw new OnesecretError(
      `${target} needs an explicit env, such as "production"`,
      'EVALUE'
    )
  }
  const layered = readLayers(options)
  const envLayer = layered.layers.find(({ name }) => name === layered.env)
  if (!envLayer.plainFile && !envLayer.encryptedFile) {
    throw new OnesecretError(
      `${target} found no "${layered.env}" layer in ${layered.dir}, pass --env default to deploy the default layer alone`,
      'EVALUE'
    )
  }
  return loadSecrets(layered)
}

const run = (binary, args, input) => {
  try {
    return execFileSync(binary, args, {
      input,
      encoding: 'utf8',
      env: withoutAgeKey(process.env),
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n')
    const redacted = output.replace(/=.*/g, '=***').trim()
    const reason =
      error.code === 'ENOENT'
        ? `${binary} is not installed`
        : redacted || error.message
    throw new OnesecretError(
      `${binary} ${args.slice(0, 3).join(' ')} failed: ${reason}`,
      'EDEPLOY'
    )
  }
}

const kubernetesManifest = ({ name, namespace, secrets }) =>
  yaml.dump(
    {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name,
        ...(namespace && { namespace }),
        labels: { [MANAGED_BY_LABEL]: 'onesecret' }
      },
      type: 'Opaque',
      data: Object.fromEntries(
        Object.entries(toEnv(secrets)).map(([key, value]) => [
          key,
          Buffer.from(value).toString('base64')
        ])
      )
    },
    { lineWidth: -1 }
  )

const kubernetes = ({
  name,
  namespace,
  context,
  kubectl = 'kubectl',
  args = [],
  ...options
}) => {
  if (!name) {
    throw new OnesecretError('kubernetes needs the Secret name', 'EVALUE')
  }
  const secrets = loadForDeploy('kubernetes', options)
  const contextArgs = context ? ['--context', context] : []
  const output = run(
    kubectl,
    [...contextArgs, ...args, 'apply', '-f', '-'],
    kubernetesManifest({ name, namespace, secrets })
  )
  return { checksum: checksum(secrets), output: output.trim() }
}

const flyImport = secrets => flyEncoding.encode(toEnv(secrets))

const fly = ({ app, stage = true, flyctl = 'fly', ...options }) => {
  if (!app) throw new OnesecretError('fly needs the app name', 'EVALUE')
  const secrets = loadForDeploy('fly', options)
  const stageArgs = stage ? ['--stage'] : []
  const output = run(
    flyctl,
    ['secrets', 'import', ...stageArgs, '--app', app],
    flyImport(secrets)
  )
  const summary = output
    .split('\n')
    .filter(line => line.trim() && !line.includes('='))
    .join('\n')
  return { checksum: checksum(secrets), output: summary }
}

module.exports = { fly, flyImport, kubernetes, kubernetesManifest }
