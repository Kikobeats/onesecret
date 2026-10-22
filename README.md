# onesecret

![Last version](https://img.shields.io/github/tag/kikobeats/onesecret.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/kikobeats/onesecret.svg?style=flat-square)](https://coveralls.io/github/kikobeats/onesecret)
[![NPM Status](https://img.shields.io/npm/dm/onesecret.svg?style=flat-square)](https://www.npmjs.org/package/onesecret)

> Keep just one secret to decrypt the rest.

Commit your credentials encrypted next to your code, and keep a single age key to read them. The files are [SOPS](https://github.com/getsops/sops) files, so the `sops` CLI and every tool around it keep working, but nothing has to be installed: encryption and decryption run in Node.js with no native binaries.

- **One key.** One age key decrypts every environment. It lives in CI and in your team's password manager, never in the image and never in the running app.
- **Layers.** `config/default.yml` and `config/default.enc.yml` hold what every environment shares, and `config/production.yml` and `config/production.enc.yml` override them for production. Plain settings and secrets live side by side, and `config()` returns them as one object.
- **Production never needs the key.** Deploy pushes the decrypted values to the platform (a Kubernetes Secret, Fly secrets). At boot, `config()` sees every value already in the environment and decrypts nothing.
- **Fails fast.** Secret names are stored in plaintext, so `config()` knows what must exist and names exactly what is missing.
- **Fast.** About 5ms for the first `config()` call when it decrypts two layers, against roughly 30ms for spawning `sops -d` twice. See [Performance](#performance).

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Everyday use](#everyday-use)
- [Deploy](#deploy)
- [How it works](#how-it-works)
- [Separate keys per person](#separate-keys-per-person)
- [CLI](#cli)
- [API](#api)
- [Reference](#reference)

## Install

```bash
$ npm install onesecret
```

## Quick start

**1. Create the key.**

```bash
$ npx onesecret init
public key   age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
private key  AGE-SECRET-KEY-1…
secrets      config/default.enc.yml

The private key is shown only now and is not saved anywhere. Keep it in your
password manager and as SOPS_AGE_KEY in CI. To use it in this shell:

  export SOPS_AGE_KEY=AGE-SECRET-KEY-1…
```

`init` prints the private key once and writes it nowhere, so it never sits in a file on your disk. Save it in your password manager before closing the terminal: without it, nobody can decrypt the files.

**2. Add your secrets and commit them.**

```bash
$ export SOPS_AGE_KEY=AGE-SECRET-KEY-1…
$ npx onesecret set DATABASE_URL=postgres://localhost/app STRIPE_KEY=sk_test_123
$ npx onesecret set --env production DATABASE_URL=postgres://db.internal/app
$ git add config
```

**3. Load them as the first thing your app does.**

```js
const config = require('onesecret').config()

console.log(config.DATABASE_URL)
console.log(process.env.DATABASE_URL)
```

`config()` reads the layer named by `NODE_ENV`. To pick another one, pass its name: `config('staging')`.

That is the whole setup: there is no other configuration file. [`example/`](example) is a runnable app that shows each of these cases.

## Everyday use

### Change a secret

Open its file. You edit it decrypted, and it is encrypted again when you save:

```bash
$ npx onesecret edit config/production.enc.yml
```

### Read secrets

List the secret names, which needs no key, or print one value:

```bash
$ npx onesecret ls
$ npx onesecret get DATABASE_URL
```

### Run any command with them

Without touching its code:

```bash
$ npx onesecret exec -- node server.js
```

### Run your tests

Unit tests usually do not need real credentials. Set `ONESECRET_SKIP=1` and `config()` never decrypts: it still loads the plain settings, and leaves unset any secret the environment does not provide.

```bash
$ ONESECRET_SKIP=1 npm test
```

Integration tests that need credentials can run under `onesecret exec -- ava`, which decrypts once and hands the values, never the key, to every test worker.

### Join an existing project

Export the project's key from your password manager. That is all: every encrypted file already records the key it is locked for. With the key exported, `init` uses it and prints no new key.

```bash
$ export SOPS_AGE_KEY=AGE-SECRET-KEY-1…
$ npx onesecret set --env staging DATABASE_URL=postgres://db.staging/app
```

## Deploy

Deploys push only the secrets, with their merged values. Plain settings ship inside the image with the `config/` directory.

Keep the `config/` directory in your image: `config()` reads the plain settings from it and the secret names to check that the platform injected every secret, and fails at boot if one is missing.

`kubernetes` and `fly` require `--env`, and that layer must have a plain or an encrypted file, so a typo such as `--env prodution` or a wrong `--dir` fails instead of pushing the wrong secrets. To deploy the default layer alone, pass `--env default`.

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

Apply the Secret before every install, including one-off installs such as a canary, because a pod that reads a Secret that does not exist yet never becomes ready.

The checksum annotation matters too: when only a secret value changes, nothing else in the pod template changes, so without it Kubernetes keeps the old pods running with the old values.

### Fly.io

```bash
$ npx onesecret fly --env production --app my-app
$ fly deploy --app my-app
```

Secrets are staged and applied by the next deploy. Pass `--no-stage` to restart the machines with them right away.

- Keep secret names out of the `[env]` section of `fly.toml`, since those values would be stored as plain configuration.
- `fly secrets import` adds and updates but never removes, so when a secret moves to a plain file, run `fly secrets unset NAME`, or the old secret keeps overriding the file.
- Every value is encoded so that `fly secrets import` reads it back unchanged, including `#`, quotes, and multi-line values such as PEM keys. onesecret checks this against a port of flyctl's own parser before sending anything, and refuses the rare value that cannot round-trip (for example a line over 64 KiB, which flyctl drops).

### Anywhere else

```bash
$ npx onesecret dotenv --env production > .env.production
```

Values are quoted only when needed, and every line is checked against both Node.js's own `.env` parser and the `dotenv` package before it is printed, so `#`, spaces, quotes, backslashes, and newlines read back unchanged with `node --env-file` or `dotenv`. A value that no quoting can carry through both, such as one starting with `'` and ending with `\`, is refused instead of corrupted.

## How it works

### Layers

```
config/default.yml           ← plain settings shared by every environment
config/default.enc.yml       ← secrets shared by every environment
config/production.yml        ← plain settings for NODE_ENV=production
config/production.enc.yml    ← secrets for NODE_ENV=production
```

Every file is optional. They are merged in that order, so a later file wins, and nested objects are merged key by key.

Each encrypted file records the public key it is locked for, so a new layer such as `config/staging.enc.yml` is locked for the same key as `config/default.enc.yml` in its folder, with the same encryption rules. A file whose folder has no `default.enc.yml` is locked for the public key of the `SOPS_AGE_KEY` you exported.

### What `config()` does at boot

`config()` reads the secret names (they are plaintext in the encrypted files) and checks `process.env`:

1. Every secret is already set: nothing is decrypted, and the key is not needed. This is production. A variable set to an empty string counts as set.
2. Some secrets are missing: it finds the age key, decrypts, and fills **only** the missing ones.
3. Some secrets are missing and there is no key: it throws, naming each missing secret.

Values already in the environment always win, for plain settings too. In `production` and `staging`, `config()` never runs `keyCommand`, so a missing secret fails the boot instead of fetching a key.

### Where the key comes from

The age key is read from these sources, and every key found is tried:

- `SOPS_AGE_KEY`, the key itself (the usual choice in CI).
- `SOPS_AGE_KEY_FILE`, a path to a keys file.
- The sops keys file: `$XDG_CONFIG_HOME/sops/age/keys.txt`, `~/Library/Application Support/sops/age/keys.txt` on macOS, and `~/.config/sops/age/keys.txt` on any system.

When none of them opens the file, `SOPS_AGE_KEY_CMD` or the `keyCommand` setting runs. See [Fetch the key with a command](#fetch-the-key-with-a-command).

### Fetch the key with a command

With `keyCommand`, nobody keeps the key on disk. It is a command that prints the key. For example, to read it from a GitLab CI variable (`glab`) or from 1Password (`op`):

```json
{
  "onesecret": {
    "keyCommand": "glab variable get SOPS_AGE_KEY -R my-group/my-project"
  }
}
```

It runs at most once per process, whether it succeeds or fails, and `config()` never runs it in `production` or `staging`. `load()` and the CLI (`exec`, `get`, `dotenv`, deploys) do run it in any env, since you call them on purpose.

`keyCommand` comes from the project's `package.json`, so it has the same trust model as an npm script: only run onesecret in repositories you trust.

### The key never reaches your app

`exec`, `kubernetes`, and `fly` remove `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, and `SOPS_AGE_KEY_CMD` from the environment they pass on, so the command you run gets the secrets but not the key. The keys file stays readable on disk to anything running as you, and `edit` and `keyCommand` run with your full environment.

## Separate keys per person

One shared key needs no configuration. To give each person or CI its own key instead, list their public keys in a `.sops.yaml` rule, the format the `sops` CLI uses, then encrypt each layer again:

```yaml
# .sops.yaml
creation_rules:
  - path_regex: ^config/
    age: age1…alice,age1…bob,age1…ci
```

```bash
$ npx onesecret rekey
$ npx onesecret rekey --env production
```

When a `.sops.yaml` rule matches a file, its recipients win over the ones the file already lists. Removing someone stops them from reading future versions, but they can still read every version they already had. Rotate the credentials themselves too.

## CLI

```
$ onesecret --help

Usage
  $ onesecret <command> [options]

Commands
  init                      Write config/default.enc.yml for a new age key it prints once,
                            or for SOPS_AGE_KEY when exported
  set NAME=value...         Encrypt one or more secrets into a layer
  unset NAME...             Remove secrets from a layer
  edit [file]               Open an encrypted file decrypted in $EDITOR, encrypt it on save
                            (a plain .yml or .json file opens as it is)
  rekey                     Encrypt a layer again with a new data key, for its recipients or a .sops.yaml rule
  ls                        List secret names (no key needed)
  get NAME                  Print one value, from a plain or an encrypted layer
  dotenv                    Print every decrypted secret as NAME=value
  exec -- <command>         Run a command with the config and secrets in its environment
                            (--env also sets its NODE_ENV)
  kubernetes --name <name>  Apply the secrets as a Kubernetes Secret, print its checksum
  fly --app <app>           Import the secrets into a Fly app, print their checksum

Options
  --env, -e        Layer to read on top of "default" (defaults to NODE_ENV, then "development").
                   Write commands (set, unset, edit, rekey) write this layer, "default" when omitted.
                   kubernetes and fly require it, and the layer file must exist ("default" deploys the base alone).
  --dir            Directory holding the config files (defaults to "config")
  --cwd            Project root, where package.json and the config directory are (defaults to the current directory)
  --namespace, -n  Kubernetes namespace
  --context        kubectl context
  --no-stage       fly: apply the secrets now instead of on the next deploy

Examples
  $ onesecret init
  $ onesecret set DATABASE_URL=postgres://localhost/app
  $ onesecret set --env production DATABASE_URL=postgres://db.internal/app
  $ onesecret edit config/production.enc.yml
  $ onesecret exec -- node server.js
  $ onesecret kubernetes --env production --name api-env --namespace api
  $ onesecret fly --env production --app my-app
```

### set

`set`, and `edit` of an encrypted file, only accept names that are valid environment variables, refuse `sops` (reserved for the file metadata), and refuse to write a value that the file's rules would leave in plaintext. A name ending in `_unencrypted` is stored in plaintext on purpose, as sops does.

### edit

`edit` takes the path of the file to open, such as `config/production.enc.yml`, or edits the `--env` layer when no path is given.

- **Editor.** It opens `$VISUAL` or `$EDITOR` (then `vi`). GUI editors that return at once, such as VS Code, Cursor, Zed, or Sublime Text, get their wait flag added, so `EDITOR=code` works without `--wait`. Any other editor command must wait until the file is closed, as git requires too.
- **Invalid YAML.** When an edit is not valid YAML, the editor opens again with your changes, and the error never prints the decrypted content.
- **New files.** A path that does not exist yet is locked for the recipients of `default.enc.yml` in its folder, or else for your exported `SOPS_AGE_KEY`, and is refused before the editor opens when there is neither.
- **Plain files.** A plain `.yml` or `.json` path opens as it is; when it is saved invalid, the editor opens again.

### get

`get` reads a plain value without the key, and prints a nested value as YAML.

## API

`config`, `load`, and `names` take the env name as a string, or these options, which `kubernetes` and `fly` take too:

| Option       | Default                            | Description                                           |
| ------------ | ---------------------------------- | ----------------------------------------------------- |
| `cwd`        | `process.cwd()`                    | Project root, where `package.json` is read from.      |
| `dir`        | `"config"`                         | Directory with the config files, relative to `cwd`.   |
| `env`        | `NODE_ENV`, then `"development"`   | Layer merged on top of `default`.                     |
| `keyCommand` | none                               | Command that prints the age key.                      |
| `processEnv` | `process.env`                      | `config()` only: the environment to read and fill, including `NODE_ENV` and `ONESECRET_SKIP`. |

`dir` and `keyCommand` can also be set in `package.json` under `"onesecret"`.

### config([env | options])

Merges the layers, fills the missing values into `process.env` (or `options.processEnv`), and returns the merged object, with the values the environment already had taking their place. Throws an `OnesecretError` with code `EMISSING` when a secret is missing and there is no key to decrypt it.

```js
const config = require('onesecret').config() // NODE_ENV, then "development"
const staging = require('onesecret').config('staging')
```

### load([env | options])

Returns every layer merged and decrypted, ignoring `process.env`. Values keep their YAML type.

### names([env | options])

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
| `EFORMAT`   | A file cannot be read: not valid YAML or JSON, not a supported SOPS file, two files for one layer, or a secret `config()` could never find in the environment. |
| `EVALUE`    | A value cannot be stored or turned into an environment variable.   |
| `EDEPLOY`   | `kubectl` or `fly` failed.                                         |
| `EUSAGE`    | A CLI command was called the wrong way, or the editor failed.      |

## Reference

### Secrets and plain settings

A name is a secret while an encrypted file contributes to its merged value. A plain file that replaces a secret from a lower layer makes the name plain config for that env; a plain mapping merged into an encrypted one keeps it a secret.

A secret must be a string, number, or boolean, since the platform injects it as a variable: a mapping or list secret missing from the environment fails with `EFORMAT`.

### Types and `process.env`

- Every top-level value that is a string, number, boolean, or `null` is written into `process.env` as a string.
- `config()` returns the merged object with the YAML types kept, so `TIMEOUT: 60000` comes back as the number `60000`, while `process.env.TIMEOUT` is `"60000"`.
- Nested objects and lists, and names that are not valid variable names (such as `log-level`), are returned but not written into `process.env`.
- A value the environment provides comes back with its file's type when the string matches it, so `PORT=3000` is the number `3000` again, even for a secret, whose type is plaintext in the encrypted file.

### File rules

- **Formats.** Plain files are YAML (`.yml`, `.yaml`) or JSON (`.json`), read with [js-yaml](https://github.com/nodeca/js-yaml); an empty file is an empty layer.
- **One file of each kind per layer.** Each layer has at most one plain and one encrypted file, so `default.yml` next to `default.json` is an error, and so is a sops-encrypted file named like a plain one.
- **YAML tags.** Encrypted files accept only the standard tags `!!str`, `!!int`, `!!float`, `!!bool`, `!!null`, and `!!timestamp`, on values, so a value such as `!Passw0rd` must be quoted.
- **Errors never print secrets.** A YAML error names the line and column but never the text, so a broken line cannot print a secret.
- **Env names.** Env names are lowercase letters, digits, `.`, `_`, and `-`, without `..`, an `enc` part, or a file extension, so `NODE_ENV=Production` fails at boot instead of reading another file.
- **Exact file names.** Layer files must match that exact name: `Production.yml` next to a `production` layer is refused, so a layer reads the same on every filesystem.
- **No files at all.** `config()` throws when it finds no file at all, so an image that forgot to copy `config/`, or a process started from the wrong directory, fails at boot instead of running without its configuration.

### Key sources

A source can hold several keys, one per line or separated by spaces. Post-quantum (`AGE-SECRET-KEY-PQ-`) and plugin identities are skipped, and SSH keys are not read. A source that cannot be read or parsed, such as a keys file holding an SSH key, is skipped when another source has a key; when no key opens the file, the error names the sources it skipped.

### Performance

After about 9ms to load the module, the first `config()` call takes about 5ms when it decrypts two layers, against roughly 30ms for spawning `sops -d` twice, and about 4ms when the platform already injected every secret and nothing is decrypted. Later calls take about 0.3ms.

### Compatibility

onesecret reads and writes SOPS files encrypted for age X25519 recipients, in YAML or JSON, and reads every value type sops writes in those formats (`str`, `int`, `float`, `bool`, `time`).

Values in encrypted files resolve the way go-yaml v3 does in sops, so `0777` is 511 and `2024-01-01` is a timestamp. Plain files are read with js-yaml instead, where `0777` is 777, YAML merge keys (`<<`) are not applied, and integers beyond 2^53 lose precision, so moving a value between a plain and an encrypted file can change it. Integers beyond 2^53 come back as `BigInt`, and timestamps as RFC 3339 strings, which are written back as strings.

Rules and `path_regex` accept Go regular expression syntax such as `(?i)`, `\A`, `\z`, and `[[:lower:]]`. The test suite checks all of this against `sops` 3.13 and `age` 1.3 in both directions, including `mac_only_encrypted` and the `*_suffix` and `*_regex` rules. Like sops, it rejects truncated authentication tags and low-order age recipients.

It does not support PGP, cloud KMS, key groups, Shamir secret sharing, comment-based rules, or YAML anchors and multiple documents in an encrypted file (`.sops.yaml` can use anchors). It refuses to write a file that also has KMS or PGP keys rather than drop them, and YAML comments are lost when it writes a file. Use the `sops` CLI for any of those.

## License

**onesecret** © [Jose Francisco 'Kiko' Verdú Gambín](https://kikobeats.com), released under the [MIT](https://github.com/kikobeats/onesecret/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Jose Francisco 'Kiko' Verdú Gambín](https://kikobeats.com) with help from [contributors](https://github.com/kikobeats/onesecret/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Jose Francisco 'Kiko' Verdú Gambín](https://github.com/kikobeats) · Twitter [@kikobeats](https://twitter.com/kikobeats)
