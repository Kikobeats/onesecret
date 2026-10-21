# onesecret

![Last version](https://img.shields.io/github/tag/kikobeats/onesecret.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/kikobeats/onesecret.svg?style=flat-square)](https://coveralls.io/github/kikobeats/onesecret)
[![NPM Status](https://img.shields.io/npm/dm/onesecret.svg?style=flat-square)](https://www.npmjs.org/package/onesecret)

> Keep just one secret to decrypt the rest.

Commit your credentials encrypted next to your code, and keep a single age key to read them. The files are [SOPS](https://github.com/getsops/sops) files, so the `sops` CLI and every tool around it keep working, but nothing has to be installed: encryption and decryption run in Node.js with no native binaries.

- **One key.** One age key decrypts every environment. It lives in CI and in your team's password manager, never in the image and never in the running app.
- **Layers.** `secrets/default.enc.yml` holds what every environment shares, and `secrets/production.enc.yml` overrides it for production.
- **Production never needs the key.** Deploy pushes the decrypted values to the platform (a Kubernetes Secret, Fly secrets). At boot, `config()` sees every value already in the environment and decrypts nothing. In `production` and `staging` it never runs `keyCommand`, so a missing secret fails the boot instead of fetching a key.
- **Fails fast.** Secret names are stored in plaintext, so `config()` knows what must exist and names exactly what is missing.
- **Fast.** Decrypting two layers takes about 5ms on a cold start and under 0.5ms after that, against roughly 30ms for spawning `sops -d` twice. When the platform already injected every secret, `config()` takes under 0.1ms.

## Install

```bash
$ npm install onesecret
```

## Quick start

```bash
$ npx onesecret init
public key   age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
private key  appended to ~/.config/sops/age/keys.txt
sops config  .sops.yaml
secrets      secrets/default.enc.yml

$ npx onesecret set DATABASE_URL=postgres://localhost/app STRIPE_KEY=sk_test_123
$ npx onesecret set --env production DATABASE_URL=postgres://db.internal/app
$ git add .sops.yaml secrets
```

Load them as the first thing your app does:

```js
require('onesecret').config()

console.log(process.env.DATABASE_URL)
```

Or run anything with them, without touching its code:

```bash
$ npx onesecret exec -- node server.js
```

## How it works

```
secrets/default.enc.yml      ← shared by every environment
secrets/production.enc.yml   ← merged on top when NODE_ENV=production
```

`config()` reads the names in those files (they are plaintext) and checks `process.env`:

1. Every name is already set: nothing is decrypted, and the key is not needed. This is production. A variable set to an empty string counts as set.
2. Some names are missing: it finds the age key, decrypts, and fills **only** the missing ones. Values already in the environment always win.
3. Some names are missing and there is no key: it throws, naming each missing secret.

It also throws when it finds no encrypted file at all, so an image that forgot to copy `secrets/`, or a process started from the wrong directory, fails at boot instead of running without secrets.

The age key is read from these sources, and every key found is tried:

- `SOPS_AGE_KEY`, the key itself (the usual choice in CI).
- `SOPS_AGE_KEY_FILE`, a path to a keys file.
- The sops keys file: `$XDG_CONFIG_HOME/sops/age/keys.txt`, `~/Library/Application Support/sops/age/keys.txt` on macOS, and `~/.config/sops/age/keys.txt` on any system.

A source can hold several keys, one per line or separated by spaces. Post-quantum (`AGE-SECRET-KEY-PQ-`) and plugin identities are skipped, and SSH keys are not read. A source that cannot be read or parsed, such as a keys file holding an SSH key, is skipped when another source has a key; when no key opens the file, the error names the sources it skipped.

When none of them opens the file, `SOPS_AGE_KEY_CMD` or the `keyCommand` setting runs: a command that prints the key. It runs at most once per process, whether it succeeds or fails, and `config()` never runs it in `production` or `staging`.

`keyCommand` comes from the project's `package.json`, so it has the same trust model as an npm script: only run onesecret in repositories you trust.

With `keyCommand`, nobody keeps the key on disk. For example, to read it from a GitLab CI variable (`glab`) or from 1Password (`op`):

```json
{
  "onesecret": {
    "keyCommand": "glab variable get SOPS_AGE_KEY -R my-group/my-project"
  }
}
```

`exec`, `kubernetes`, and `fly` remove `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, and `SOPS_AGE_KEY_CMD` from the environment they pass on, so the command you run gets the secrets but not the key. The keys file stays readable on disk to anything running as you, and `edit` and `keyCommand` run with your full environment.

## Deploy

### Kubernetes

Write the secrets into a Secret before `helm upgrade`, then pass the printed checksum to the chart so pods roll when a value changes:

```bash
$ checksum=$(npx onesecret kubernetes --env production --name api-env --namespace api --context prod)
$ helm upgrade api ./chart --set-string envSecretChecksum=$checksum
```

```yaml
# chart/templates/deployment.yaml
spec:
  template:
    metadata:
      annotations:
        checksum/api-env: {{ .Values.envSecretChecksum | quote }}
    spec:
      containers:
        - name: api
          envFrom:
            - secretRef:
                name: api-env
```

Apply the Secret before every install, including one-off installs such as a canary, because a pod that reads a Secret that does not exist yet never becomes ready. The checksum annotation matters too: when only a secret value changes, nothing else in the pod template changes, so without it Kubernetes keeps the old pods running with the old values.

### Fly.io

```bash
$ npx onesecret fly --env production --app my-app
$ fly deploy --app my-app
```

`kubernetes` and `fly` require `--env`, and that layer file must exist, so a typo such as `--env prodution` or a wrong `--dir` fails instead of pushing the wrong secrets. To deploy the default layer alone, pass `--env default`.

Secrets are staged and applied by the next deploy. Pass `--no-stage` to restart the machines with them right away. Every value is encoded so that `fly secrets import` reads it back unchanged, including `#`, quotes, and multi-line values such as PEM keys. onesecret checks this against a port of flyctl's own parser before sending anything, and refuses the rare value that cannot round-trip (for example a line over 64 KiB, which flyctl drops). Keep secret names out of the `[env]` section of `fly.toml`, since those values would be stored as plain configuration.

### Anywhere else

```bash
$ npx onesecret dotenv --env production > .env.production
```

Values are quoted only when needed, and every line is checked against both Node.js's own `.env` parser and the `dotenv` package before it is printed, so `#`, spaces, quotes, backslashes, and newlines read back unchanged with `node --env-file` or `dotenv`. A value that no quoting can carry through both, such as one starting with `'` and ending with `\`, is refused instead of corrupted.

Keep the encrypted files in your image: `config()` reads the names from them to check that the platform injected every secret, and fails at boot if one is missing.

## Tests

Unit tests usually do not need real credentials. Set `ONESECRET_SKIP=1` and `config()` does nothing:

```bash
$ ONESECRET_SKIP=1 npm test
```

Integration tests that need credentials can run under `onesecret exec -- ava`, which decrypts once and hands the values, never the key, to every test worker.

## CLI

```
$ onesecret --help

Usage
  $ onesecret <command> [options]

Commands
  init                      Create an age key, .sops.yaml, and secrets/default.enc.yml
  set NAME=value...         Encrypt one or more secrets into a layer
  unset NAME...             Remove secrets from a layer
  edit                      Open a layer decrypted in $EDITOR, encrypt it on save
  rekey                     Encrypt a layer again with a new data key and the .sops.yaml recipients
  ls                        List secret names (no key needed)
  get NAME                  Print one decrypted secret
  dotenv                    Print every decrypted secret as NAME=value
  exec -- <command>         Run a command with the secrets in its environment
  kubernetes --name <name>  Apply the secrets as a Kubernetes Secret, print its checksum
  fly --app <app>           Import the secrets into a Fly app, print their checksum

Options
  --env, -e        Layer to read on top of "default" (defaults to NODE_ENV, then "development").
                   Write commands (set, unset, edit, rekey) write this layer, "default" when omitted.
                   kubernetes and fly require it, and the layer file must exist ("default" deploys the base alone).
  --dir            Directory holding the encrypted files (defaults to "secrets")
  --namespace, -n  Kubernetes namespace
  --context        kubectl context
  --no-stage       fly: apply the secrets now instead of on the next deploy
```

`set` and `edit` only accept names that are valid environment variables, refuse `sops` (reserved for the file metadata), and refuse to write a value that the file's rules would leave in plaintext. A name ending in `_unencrypted` is stored in plaintext on purpose, as sops does.

When an edit is not valid YAML, the editor opens again with your changes, and the error never prints the decrypted content.

### Adding or removing a teammate

Recipients live in `.sops.yaml`. Add or remove a public key there, then encrypt each layer again:

```bash
$ npx onesecret rekey
$ npx onesecret rekey --env production
```

Removing someone from `.sops.yaml` stops them from reading future versions, but they can still read every version they already had. Rotate the credentials themselves too.

## API

Every function takes the same options:

| Option       | Default                            | Description                                           |
| ------------ | ---------------------------------- | ----------------------------------------------------- |
| `cwd`        | `process.cwd()`                    | Project root, where `package.json` is read from.      |
| `dir`        | `"secrets"`                        | Directory with the encrypted files, relative to `cwd`. |
| `env`        | `NODE_ENV`, then `"development"`   | Layer merged on top of `default`.                     |
| `keyCommand` | none                               | Command that prints the age key.                      |

`dir` and `keyCommand` can also be set in `package.json` under `"onesecret"`.

### config([options])

Fills the missing secrets into `process.env` (or `options.processEnv`) and returns an object with every secret name and its value. Throws an `OnesecretError` with code `EMISSING` when a secret is missing and there is no key to decrypt it.

### load([options])

Returns every secret decrypted, with the `env` layer merged over `default`. Values keep their YAML type.

### names([options])

Returns the secret names, without needing the key.

### kubernetes({ name, namespace, context, args, kubectl, ...options })

Applies the secrets as an `Opaque` Secret with `kubectl apply`. Returns `{ checksum, output }`.

### fly({ app, stage = true, flyctl, ...options })

Imports the secrets with `fly secrets import`. Returns `{ checksum, output }`.

### toEnv(secrets), toDotenv(secrets), checksum(secrets), withoutAgeKey(env)

Helpers used by the commands above: turn secrets into environment strings, render them as dotenv, hash them in an order-independent way, and drop the age key variables from an environment.

### Errors

Every error is an `OnesecretError` with a `code`:

| Code        | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| `EMISSING`  | A secret is not in the environment and could not be decrypted.     |
| `ENOKEY`    | No age key was found.                                              |
| `EKEY`      | A key was found but does not open the file, or `keyCommand` failed. |
| `EMAC`      | The file was modified without the key.                             |
| `EFORMAT`   | The file is not a supported SOPS file.                             |
| `EVALUE`    | A value cannot be stored or turned into an environment variable.   |
| `EDEPLOY`   | `kubectl` or `fly` failed.                                         |

## Compatibility

onesecret reads and writes SOPS files encrypted for age X25519 recipients, in YAML or JSON, and reads every value type sops writes in those formats (`str`, `int`, `float`, `bool`, `time`). Plain YAML values resolve the way go-yaml v3 does in sops, so `0777` is 511 and `2024-01-01` is a timestamp. Integers beyond 2^53 come back as `BigInt`, and timestamps as RFC 3339 strings, which are written back as strings. Rules and `path_regex` accept Go regular expression syntax such as `(?i)`, `\A`, `\z`, and `[[:lower:]]`. The test suite checks all of this against `sops` 3.13 and `age` 1.3 in both directions, including `mac_only_encrypted` and the `*_suffix` and `*_regex` rules. Like sops, it rejects truncated authentication tags and low-order age recipients.

It does not support PGP, cloud KMS, key groups, Shamir secret sharing, comment-based rules, or YAML anchors and multiple documents in an encrypted file (`.sops.yaml` can use anchors). It refuses to write a file that also has KMS or PGP keys rather than drop them, and YAML comments are lost when it writes a file. Use the `sops` CLI for any of those.

## License

**onesecret** © [Jose Francisco 'Kiko' Verdú Gambín](https://kikobeats.com), released under the [MIT](https://github.com/kikobeats/onesecret/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Jose Francisco 'Kiko' Verdú Gambín](https://kikobeats.com) with help from [contributors](https://github.com/kikobeats/onesecret/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Jose Francisco 'Kiko' Verdú Gambín](https://github.com/kikobeats) · Twitter [@kikobeats](https://twitter.com/kikobeats)
