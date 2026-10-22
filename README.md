# onesecret

![Last version](https://img.shields.io/github/tag/kikobeats/onesecret.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/kikobeats/onesecret.svg?style=flat-square)](https://coveralls.io/github/kikobeats/onesecret)
[![NPM Status](https://img.shields.io/npm/dm/onesecret.svg?style=flat-square)](https://www.npmjs.org/package/onesecret)

> Keep just one secret to decrypt the rest.

Put your app's passwords, tokens, and API keys in your repository, encrypted, right next to your code. One key unlocks all of them, and your servers don't even need that key: when you deploy, you hand the values to your hosting platform, and your app finds them already set.

## Why onesecret

- **Your secrets are never exposed.** In the repository they are always encrypted, so anyone who sees the code, a fork, or the git history sees nothing usable. In production your hosting platform holds the values as environment variables, the standard way to run secrets, and the key never reaches your servers. If a server leaks, it leaks only its own values.
- **One key unlocks everything.** Every secret, in every environment, opens with the same key. Onboarding a teammate or a CI job means sharing that one key, and nothing else.
- **Works on any platform.** Your app reads plain environment variables, which every host supports: Vercel, Fly.io, Kubernetes, AWS, Docker, or your own server. There is no secrets service to sign up for, pay for, or migrate away from.
- **Versioned with your code.** Secrets and plain settings live side by side in one `config/` folder, so a change ships in the same commit and pull request as the code that needs it, with history and review.

## Install

Requires Node.js 24 or newer.

```bash
$ npm install onesecret
```

## Quick start

**1. Create your key.**

```bash
$ npx onesecret init
public key   age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
private key  AGE-SECRET-KEY-1…
secrets      config/default.enc.yml

The private key is the only secret to keep: it decrypts all the others.
It is shown only now and saved nowhere. To use it in this shell:

export SOPS_AGE_KEY=AGE-SECRET-KEY-1…
```

The private key is the only secret you need to keep: it decrypts all the others. It is shown only once and saved nowhere, so store it somewhere safe and never commit it. You don't need to keep the public key, since it is already written into the encrypted file.

**2. Add your settings and secrets, then commit them.**

Everything lives in the `config/` folder. Plain settings go in `.yml` files, secrets go encrypted in `.enc.yml` files, and each file name is an environment. This step ends with:

```
config/default.yml          ← PORT, for every environment
config/default.enc.yml      ← DATABASE_URL, encrypted, for every environment
config/production.enc.yml   ← DATABASE_URL, encrypted, for production only
```

`default` is the base. An environment such as `production` adds its own values on top and wins where both have the same name.

Run the `export` line that `init` printed, then:

```bash
$ echo 'PORT: 3000' > config/default.yml
$ npx onesecret set DATABASE_URL
$ npx onesecret set --env production DATABASE_URL
$ git add config && git commit -m "Add config"
```

`set` opens your editor (`$VISUAL` or `$EDITOR`, otherwise `vi`) for the value, so it never ends up in your shell history. In a script, pipe it in instead: `printf %s "$VALUE" | npx onesecret set NAME`.

**3. Load them when your app starts.**

```js
const onesecret = require('onesecret')

const config = onesecret.config() // everything as one object
console.log(config.PORT, config.DATABASE_URL)

onesecret.env() // or put it all in process.env, like dotenv
console.log(process.env.DATABASE_URL)
```

The environment comes from `NODE_ENV`, or `development` when it is unset. To pick one yourself, pass its name: `config('production')`.

On your laptop, onesecret decrypts with the key you exported. Without a key, it stops and tells you which secret it could not read:

```
onesecret: DATABASE_URL is not set and cannot be decrypted, no age key found: …
```

[`example/`](https://github.com/Kikobeats/onesecret/tree/master/example) is a small app you can run to see it working.

## Everyday tasks

### Add or change a secret

```bash
$ npx onesecret set API_TOKEN
$ npx onesecret set --env production API_TOKEN
```

To change several at once, open the whole file. You edit it decrypted, and it is encrypted again when you save:

```bash
$ npx onesecret edit config/production.enc.yml
```

### See what's stored

List the secret names (no key needed), or print one value:

```bash
$ npx onesecret ls
$ npx onesecret get DATABASE_URL
```

### Run a command with your secrets

Any command, without changing its code:

```bash
$ npx onesecret exec -- node server.js
```

### Run your tests

Most tests don't need real credentials. With `ONESECRET_SKIP=1`, nothing is decrypted: your plain settings still load, and secrets stay unset.

```bash
$ ONESECRET_SKIP=1 npm test
```

Tests that do need credentials can run under `onesecret exec -- npm test`, which passes the values, but never the key, to the test runner.

### Join a project

Get the key from whoever set up the project and export it. The encrypted files already say which key opens them, so there is nothing else to set up.

```bash
$ export SOPS_AGE_KEY=AGE-SECRET-KEY-1…
$ npx onesecret set --env staging DATABASE_URL
```

### Move an existing project to onesecret

Give your coding agent this prompt:

```
Migrate this project to onesecret: run npx onesecret init (keep the printed key out of the repo), move plain settings to config/<env>.yml, encrypt each secret by piping its value into npx onesecret set --env <env> NAME, replace dotenv with require('onesecret').env(), and verify every value matches the old .env without printing it.
```

## Deploy

In production, your deploy script sends the secret values to your hosting platform (Vercel, Fly.io, Kubernetes, AWS, and so on), which sets them as environment variables. At startup, your app finds them already set and decrypts nothing.

Ship the `config/` folder with your app. It holds your plain settings and the list of secret names, so the app can still tell you if one is missing.

Pick your platform below. Most recipes use [jq](https://jqlang.org) to handle the values.

<details>
<summary><strong>How the recipes work</strong></summary>

Deploys push only the secrets, with their merged values. Plain settings ship inside the image with the `config/` directory.

Keep the `config/` directory in your image: `config()` reads the plain settings from it and the secret names to check that the platform injected every secret, and fails at boot if one is missing.

Every provider is fed with three primitives:

- `onesecret dotenv --json` prints every secret as one JSON object, for APIs and CLIs that take JSON.
- `onesecret ls` prints the secret names, and `onesecret get NAME` prints one value. When piped, `get` prints the exact bytes with no trailing newline.
- `onesecret exec -- <command>` runs a command with the secrets in its environment.

Always pass `--env` to them in a deploy script: without it they read `NODE_ENV`, then `development`. With `--env`, `dotenv` and `ls` refuse a layer that has no plain or encrypted file, so a typo such as `--env prodution` or a wrong `--dir` fails instead of pushing the default layer. To push the default layer alone, pass `--env default`.

Each recipe below decrypts once into a `secrets` variable and pushes only when that worked, so a missing key sends nothing instead of empty values. In a script, start with `set -euo pipefail`, so a failed decrypt also stops the deploy that follows.

</details>

<details>
<summary><strong>Kubernetes</strong></summary>

Apply the secrets as a Secret before `helm upgrade`, then pass their checksum to the chart so pods roll when a value changes:

```bash
$ secrets=$(npx onesecret dotenv --env production --json) &&
    printf %s "$secrets" | jq '{apiVersion: "v1", kind: "Secret", type: "Opaque",
        metadata: {name: "api-env", labels: {"app.kubernetes.io/managed-by": "onesecret"}},
        data: map_values(@base64)}' |
      kubectl apply --namespace api --context prod -f -
$ checksum=$(printf %s "$secrets" | jq -S -c . | shasum -a 256 | cut -d' ' -f1)
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

- `kubectl apply` replaces the whole `data`, so a secret that moved to a plain file disappears from the Secret.
- Do not use `kubectl create secret --from-env-file` with `onesecret dotenv`: kubectl keeps quotes as part of the value and cannot read multi-line values.

</details>

<details>
<summary><strong>Fly.io</strong></summary>

```bash
$ secrets=$(npx onesecret dotenv --env production --json) &&
    printf %s "$secrets" | jq -j 'to_entries[] | "\(.key)=\(.value)\u0000"' | xargs -0 fly secrets set --stage --app my-app
$ fly deploy --app my-app
```

`fly secrets set` splits each argument at the first `=` and keeps the rest as it is, so `#`, quotes, and multi-line values such as PEM keys arrive unchanged. `--stage` applies them with the next deploy; drop it to restart the machines with them right away.

- The values are arguments of `fly` while it runs, so they are visible in the process list of that machine.
- flyctl reads a value of exactly `-` from stdin instead.
- Keep secret names out of the `[env]` section of `fly.toml`, since those values would be stored as plain configuration.
- `fly secrets set` adds and updates but never removes, so when a secret moves to a plain file, run `fly secrets unset NAME`, or the old secret keeps overriding the file.

</details>

<details>
<summary><strong>Vercel</strong></summary>

```bash
$ secrets=$(npx onesecret dotenv --env production --json)
$ for name in $(printf %s "$secrets" | jq -r 'keys[]'); do
    printf %s "$secrets" | jq -j --arg name "$name" '.[$name]' |
      vercel env add "$name" --environment production --sensitive --force --yes
  done
$ vercel deploy --prod
```

- New values apply only to new deployments.
- `vercel env add` adds and overwrites but never removes: run `vercel env rm NAME --environment production --yes` when a secret moves to a plain file. It cannot read an empty value from stdin.
- File tracing cannot see the `config/` directory, so include it in the function bundle, or `config()` fails at boot. In `vercel.json`: `{ "functions": { "api/**/*.js": { "includeFiles": "config/**" } } }`. With Next.js, use `outputFileTracingIncludes: { '/*': ['./config/**/*'] }` in `next.config.js`.

</details>

<details>
<summary><strong>Netlify</strong></summary>

```bash
$ secrets=$(npx onesecret dotenv --env production --json)
$ for name in $(printf %s "$secrets" | jq -r 'keys[]'); do
    netlify env:set --context production --secret --force -- "$name" "$(printf %s "$secrets" | jq -r --arg name "$name" '.[$name]')"
  done
$ netlify deploy --prod
```

- `env:set` takes the value as an argument, so `$(...)` drops a trailing newline that belongs to the value. Keep the `--` and put the flags before it: a PEM key starts with `-`.
- Do not use `netlify env:import`: it writes every variable to all contexts without the secret flag, and prints the values.
- `env:set` adds and updates but never removes: run `netlify env:unset NAME --context production`. New values apply to the next deploy.
- Include the config files in the functions bundle, in `netlify.toml`: `[functions]` with `included_files = ["config/**"]`.

</details>

<details>
<summary><strong>Cloudflare Workers</strong></summary>

```bash
$ secrets=$(npx onesecret dotenv --env production --json) &&
    printf %s "$secrets" | npx wrangler secret bulk --name my-worker
```

- `wrangler secret bulk` creates and deploys a new version of the Worker right away. It adds and updates but never removes: run `wrangler secret delete NAME`. It takes at most 100 secrets per call, and a Worker holds 128 variables in total on the Paid plan, 64 on Free.
- A Worker has no project directory at runtime. Attach the config files as modules and point `config()` at them:

```toml
# wrangler.toml
compatibility_date = "2025-10-01"
compatibility_flags = ["nodejs_compat"]
base_dir = "."
find_additional_modules = true
rules = [{ type = "Text", globs = ["config/**/*.yml"], fallthrough = true }]
```

```js
const config = require('onesecret').config({ env: 'production', cwd: '/bundle' })
```

- `package.json` is not in the bundle, so pass `dir` and `keyCommand` in code. The Workers runtime reports Node.js 22: onesecret ran there in `wrangler dev`, but it is below the supported `engines` range.

</details>

<details>
<summary><strong>Railway</strong></summary>

```bash
$ secrets=$(npx onesecret dotenv --env production --json)
$ for name in $(printf %s "$secrets" | jq -r 'keys[]'); do
    printf %s "$secrets" | jq -j --arg name "$name" '.[$name]' |
      railway variable set "$name" --stdin --service api --environment production --skip-deploys
  done
$ railway redeploy --service api --environment production --yes
```

- `--stdin` strips trailing newlines from the value and refuses an empty one.
- Railway reads `${{ NAME }}` in a value as a reference to another variable.
- Do not paste `onesecret dotenv` into `railway variable edit`: it splits multi-line values, keeps backticks as part of the value, and deletes every variable missing from the file.
- `variable set` adds and updates but never removes: run `railway variable delete NAME`.

</details>

<details>
<summary><strong>Render</strong></summary>

The Render CLI cannot set variables on an existing service, so the loop calls the API, one key at a time:

```bash
$ secrets=$(npx onesecret dotenv --env production --json)
$ for name in $(printf %s "$secrets" | jq -r 'keys[]'); do
    printf %s "$secrets" | jq --arg name "$name" '{value: .[$name]}' |
      curl -fsS -o /dev/null -X PUT "https://api.render.com/v1/services/$RENDER_SERVICE_ID/env-vars/$name" \
        -H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json' --data-binary @-
  done
$ render deploys create "$RENDER_SERVICE_ID" --wait --confirm
```

- Each call adds or updates one variable set on the service, not in a linked environment group.
- Do not use the bulk `PUT /env-vars` endpoint: it replaces every variable, removing the plain ones set in the dashboard.

</details>

<details>
<summary><strong>AWS</strong></summary>

On ECS, keep every secret of an environment in one Secrets Manager secret as JSON, and reference each key from the task definition:

```bash
$ secrets=$(npx onesecret dotenv --env production --json) &&
    printf %s "$secrets" | aws secretsmanager put-secret-value --secret-id my-app/production --secret-string file:///dev/stdin
$ arn=$(aws secretsmanager describe-secret --secret-id my-app/production --query ARN --output text)
$ npx onesecret ls --env production | jq -Rn --arg arn "$arn" '[inputs | {name: ., valueFrom: "\($arn):\(.)::"}]'
```

Put the printed list in `containerDefinitions[].secrets`, register the task definition, then roll the service, since tasks read secrets only when they start:

```bash
$ aws ecs update-service --cluster prod --service my-app --force-new-deployment
```

- The first time, run `create-secret --name my-app/production` in place of `put-secret-value --secret-id my-app/production`.
- `put-secret-value` replaces the whole JSON, so a removed secret disappears. Generate the task definition list again whenever the names change. The task execution role needs `secretsmanager:GetSecretValue`, and the JSON is limited to 64 KB.
- Do not use the task definition's `environmentFiles`: ECS keeps quotes as part of the value and cannot read multi-line values.
- On Lambda, `secrets=$(npx onesecret dotenv --env production --json) && printf %s "$secrets" | jq '{Variables: .}' | aws lambda update-function-configuration --function-name my-fn --environment file:///dev/stdin` sets them, but it replaces every variable of the function, and all of them together are limited to 4 KB. Ship `config/` inside the deployment package.

</details>

<details>
<summary><strong>Google Cloud Run</strong></summary>

Keep each secret in Secret Manager and mount them all as variables. Secret names are shared by the whole Google Cloud project, so prefix them with the app and the environment:

```bash
$ secrets=$(npx onesecret dotenv --env production --json)
$ for name in $(printf %s "$secrets" | jq -r 'keys[]'); do
    id="my-app-production-$name"
    gcloud secrets describe "$id" >/dev/null 2>&1 || gcloud secrets create "$id" --replication-policy=automatic
    printf %s "$secrets" | jq -j --arg name "$name" '.[$name]' | gcloud secrets versions add "$id" --data-file=-
  done
$ gcloud run deploy my-app --source . --set-secrets="$(npx onesecret ls --env production | sed 's/.*/&=my-app-production-&:latest/' | paste -sd, -)"
```

- `--set-secrets` replaces the secrets of the previous revision. Values are read when an instance starts, so deploy after every push. The service account needs `roles/secretmanager.secretAccessor`.
- `--env-vars-file` stores values as plain configuration instead. If you use it, pass `onesecret dotenv --json > env.json`, never a `.env` file: gcloud reads those with python-dotenv, which expands `${NAME}` and breaks backtick quoting.
- With `--source`, keep `config/` out of `.gcloudignore`.

</details>

<details>
<summary><strong>Docker</strong></summary>

```bash
$ npx onesecret exec --env production -- docker run $(npx onesecret ls --env production | sed 's/^/-e /') my-image
```

`-e NAME` without a value copies `NAME` from the environment `onesecret exec` builds. The unquoted `$(...)` splits into one `-e NAME` pair per secret, which is safe because secret names are valid variable names. With Compose, list the names without values under `environment:`, such as `- DATABASE_URL`, then run `npx onesecret exec --env production -- docker compose up -d`.

- Do not pass `onesecret dotenv` output to `docker run --env-file` or Compose `env_file`. Docker keeps quotes as part of the value and fails on multi-line values, and Compose expands `$NAME` and rejects backticks.
- Copy the config files into the image, with `COPY config ./config` on a `node:24` base image.

</details>

<details>
<summary><strong>GitHub Actions</strong></summary>

A job that deploys needs a single secret: the age key. onesecret decrypts the rest in the job.

```bash
$ printf %s "$SOPS_AGE_KEY" | gh secret set SOPS_AGE_KEY --env production
```

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh
        env:
          SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
```

The job must declare `environment: production`: GitHub gives an environment's secrets only to jobs that reference it.

Do not import `onesecret dotenv` with `gh secret set --env-file`: gh parses it with godotenv, which expands `$NAME` and rejects backticks.

</details>

<details>
<summary><strong>Anywhere else</strong></summary>

```bash
$ npx onesecret dotenv --env production > .env.production
```

Values are quoted only when needed, and every line is checked against both Node.js's own `.env` parser and the `dotenv` package before it is printed, so `#`, spaces, quotes, backslashes, and newlines read back unchanged with `node --env-file` or `dotenv`. A value that no quoting can carry through both, such as one starting with `'` and ending with `\`, is refused instead of corrupted.

Other `.env` parsers differ, as the providers above show. When a tool takes JSON, prefer `onesecret dotenv --json`, which carries every value unchanged, as a string.

</details>

## How it works

Your configuration lives in the `config/` folder, with up to two files per environment:

```
config/default.yml           ← settings shared by every environment
config/default.enc.yml       ← secrets shared by every environment
config/production.yml        ← settings for production
config/production.enc.yml    ← secrets for production
```

`default` is the base, and an environment such as `production` adds to it and wins where they overlap. Files ending in `.yml` hold plain settings; files ending in `.enc.yml` hold secrets, encrypted.

The encrypted files are standard [SOPS](https://github.com/getsops/sops) files locked with an [age](https://age-encryption.org) key, so the `sops` CLI and other SOPS tools can read them too. You don't need to install either: onesecret does the encryption itself.

When your app starts, onesecret checks which secrets are already set:

- **All of them**, as in production: it decrypts nothing and needs no key.
- **Some are missing**, as on your laptop: it decrypts them with your key.
- **Some are missing and there is no key:** it stops and names each missing secret.

<details>
<summary><strong>Layers in detail</strong></summary>

```
config/default.yml           ← plain settings shared by every environment
config/default.enc.yml       ← secrets shared by every environment
config/production.yml        ← plain settings for NODE_ENV=production
config/production.enc.yml    ← secrets for NODE_ENV=production
```

Every file is optional. They are merged in that order, so a later file wins, and nested objects are merged key by key.

Each encrypted file records the public key it is locked for, so a new layer such as `config/staging.enc.yml` is locked for the same key as `config/default.enc.yml` in its folder, with the same encryption rules. A file whose folder has no `default.enc.yml` is locked for the public key of the `SOPS_AGE_KEY` you exported.

</details>

<details>
<summary><strong>What config() and env() do at boot</strong></summary>

Both read the secret names (they are plaintext in the encrypted files) and check `process.env`:

1. Every secret is already set: nothing is decrypted, and the key is not needed. This is production. A variable set to an empty string counts as set.
2. Some secrets are missing: they find the age key, decrypt every encrypted layer, and supply **only** the missing values. `config()` returns them; `env()` writes them into `process.env`. The key must open every encrypted layer of that env, even when only one of them holds a missing secret.
3. Some secrets are missing and there is no key: they throw, naming each missing secret.

Values already in the environment always win, for plain settings too. In `production` and `staging`, neither runs `keyCommand`, so a missing secret fails the boot instead of fetching a key.

`config()` never changes `process.env`, and `env()` changes nothing but `process.env`, or `options.processEnv` when given.

</details>

<details>
<summary><strong>Where the key comes from</strong></summary>

The age key is read from these sources, and every key found is tried:

- `SOPS_AGE_KEY`, the key itself (the usual choice in CI).
- `SOPS_AGE_KEY_FILE`, a path to a keys file.
- The sops keys file: `$XDG_CONFIG_HOME/sops/age/keys.txt`, `~/Library/Application Support/sops/age/keys.txt` on macOS, and `~/.config/sops/age/keys.txt` on any system.

When none of them opens the file, `SOPS_AGE_KEY_CMD` or the `keyCommand` setting runs. See **Fetch the key with a command** below.

</details>

<details>
<summary><strong>Fetch the key with a command</strong></summary>

With `keyCommand`, nobody keeps the key on disk. It is a command that prints the key. For example, to read it from a GitLab CI variable (`glab`) or from 1Password (`op`):

```json
{
  "onesecret": {
    "keyCommand": "glab variable get SOPS_AGE_KEY -R my-group/my-project"
  }
}
```

It runs at most once per process, whether it succeeds or fails, and `config()` and `env()` never run it in `production` or `staging`. The CLI (`exec`, `get`, `dotenv`) does run it in any env, since you call it on purpose.

`keyCommand` comes from the project's `package.json`, so it has the same trust model as an npm script: only run onesecret in repositories you trust.

</details>

<details>
<summary><strong>The key never reaches your app</strong></summary>

`exec` removes `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, and `SOPS_AGE_KEY_CMD` from the environment it passes on, so the command you run gets the secrets but not the key. The keys file stays readable on disk to anything running as you, and `edit` and `keyCommand` run with your full environment.

</details>

<details>
<summary><strong>Separate keys per person</strong></summary>

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

</details>

## Reference

<details>
<summary><strong>CLI</strong></summary>

```
$ onesecret --help

Usage
  $ onesecret <command> [options]

Commands
  init                      Write config/default.enc.yml for a new age key it prints once,
                            or for SOPS_AGE_KEY when exported
  set NAME                  Encrypt a secret into a layer, typed in $EDITOR
                            (or read from stdin when piped)
  unset NAME...             Remove secrets from a layer
  edit [file]               Open an encrypted file decrypted in $EDITOR, encrypt it on save
                            (a plain .yml or .json file opens as it is)
  rekey                     Encrypt a layer again with a new data key, for its recipients or a .sops.yaml rule
  ls                        List secret names (no key needed)
  get NAME                  Print one value, from a plain or an encrypted layer
                            (with no trailing newline when piped)
  dotenv                    Print every decrypted secret as NAME=value
                            (--json prints them as one JSON object)
  exec -- <command>         Run a command with the config and secrets in its environment
                            (--env also sets its NODE_ENV)

Options
  --env, -e        Layer to read on top of "default" (defaults to NODE_ENV, then "development").
                   Write commands (set, unset, edit, rekey) write this layer, "default" when omitted.
                   Passed to dotenv or ls, the layer file must exist.
  --dir            Directory holding the config files (defaults to "config")
  --cwd            Project root, where package.json and the config directory are (defaults to the current directory)
  --json           dotenv: print a JSON object instead of NAME=value lines

Examples
  $ onesecret init
  $ onesecret set DATABASE_URL
  $ printf %s "$TOKEN" | onesecret set --env production API_TOKEN
  $ onesecret edit config/production.enc.yml
  $ onesecret exec -- node server.js
  $ onesecret dotenv --env production --json
```

**set**

In a terminal, `set NAME` opens `$EDITOR` on the current value: the newline the editor adds at the end is dropped, and saving an empty file cancels. When stdin is piped, `set` waits until it closes and stores the bytes as they are, so pipe with `printf %s` rather than `echo`, which adds a newline. It refuses an empty value, text that is not UTF-8, and NUL bytes; to store an empty value, use `onesecret edit`. Values never go on the command line, so they stay out of shell history and the process list.

`set`, and `edit` of an encrypted file, only accept names that are valid environment variables, refuse `sops` (reserved for the file metadata), and refuse to write a value that the file's rules would leave in plaintext. A name ending in `_unencrypted` is stored in plaintext on purpose, as sops does.

**edit**

`edit` takes the path of the file to open, such as `config/production.enc.yml`, or edits the `--env` layer when no path is given.

- **Editor.** It opens `$VISUAL` or `$EDITOR` (then `vi`). GUI editors that return at once, such as VS Code, Cursor, Zed, or Sublime Text, get their wait flag added, so `EDITOR=code` works without `--wait`. Any other editor command must wait until the file is closed, as git requires too.
- **Invalid YAML.** When an edit is not valid YAML, the editor opens again with your changes, and the error never prints the decrypted content.
- **New files.** A path that does not exist yet is locked for the recipients of `default.enc.yml` in its folder, or else for your exported `SOPS_AGE_KEY`, and is refused before the editor opens when there is neither.
- **Plain files.** A plain `.yml` or `.json` path opens as it is; when it is saved invalid, the editor opens again.

**get**

`get` reads a plain value without the key, and prints a nested value as YAML. On a terminal it ends the value with a newline; piped, it prints the value alone, so `onesecret get NAME | some-cli --stdin` stores exactly the value. A `while read` loop over it needs `|| [ -n "$line" ]` to keep the last line.

</details>

<details>
<summary><strong>API: options</strong></summary>

`config` and `env` take the env name as a string, or these options:

| Option       | Default                            | Description                                           |
| ------------ | ---------------------------------- | ----------------------------------------------------- |
| `cwd`        | `process.cwd()`                    | Project root, where `package.json` is read from.      |
| `dir`        | `"config"`                         | Directory with the config files, relative to `cwd`.   |
| `env`        | `NODE_ENV`, then `"development"`   | Layer merged on top of `default`.                     |
| `keyCommand` | none                               | Command that prints the age key.                      |
| `processEnv` | `process.env`                      | `config()` and `env()`: the environment to read, including `NODE_ENV` and `ONESECRET_SKIP`, and the one `env()` writes. |

`dir` and `keyCommand` can also be set in `package.json` under `"onesecret"`.

</details>

<details>
<summary><strong>API: config()</strong></summary>

Merges the layers and returns the merged object, with the values the environment already had taking their place. It never changes `process.env`. Throws an `OnesecretError` with code `EMISSING` when a secret is missing and there is no key to decrypt it.

```js
const config = require('onesecret').config() // NODE_ENV, then "development"
const staging = require('onesecret').config('staging')
```

The object also reads values through four accessors:

```js
config.DATABASE_URL // plain access
config.get('database.pool', 5) // a dot path, with a fallback when it is unset
config.has('FEATURE_FLAG') // true when set, even to 0, false, or ''
config.require('STRIPE_KEY') // the value, or throws EMISSING when it is unset
const { STRIPE_KEY, DATABASE_URL } = config.required // throws for an unset name
```

- A path is a dot string or an array of keys, such as `['database', 'pool']`. A string matches an exact name first, so `get('log.level')` reads a key named `log.level` before it looks into `log`. Only config values count: `has('constructor')`, `has('get')`, and `has('hosts.length')` are `false`.
- The accessors are not enumerable, so they stay out of `Object.keys`, spread, and `JSON.stringify`. A config value named `get`, `has`, `require`, or `required` is refused.
- `config.required` is only for destructuring: every name read from it is required, so `JSON.stringify(config.required)` or `await config.required` throws.
- They work like [miconfig](https://github.com/Kikobeats/miconfig)'s with two differences. `0`, `false`, `''`, and `null` count as set. Values are not parsed again: they keep their YAML type, and a value from the environment is a string unless it matches the file's value, so `PORT=8080` over `PORT: 3000` reads `'8080'`.

</details>

<details>
<summary><strong>API: env()</strong></summary>

Writes every value missing from `process.env` (or `options.processEnv`) into it, as a string: the same values `config()` would add on top of the environment. It follows the same rules and throws the same errors as `config()`, writes nothing when it throws, and returns nothing.

```js
require('onesecret').env()
```

</details>

<details>
<summary><strong>API: helpers</strong></summary>

Helpers: turn secrets into environment strings, render them as dotenv, hash them in an order-independent way, and drop the age key variables from an environment.

</details>

<details>
<summary><strong>Errors</strong></summary>

Every error is an `OnesecretError` with a `code`:

| Code        | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| `EMISSING`  | A secret is not in the environment and could not be decrypted, or `config().require` found no value. |
| `ENOKEY`    | No age key was found.                                              |
| `EKEY`      | A key was found but does not open the file, or `keyCommand` failed. |
| `EMAC`      | The file was modified without the key.                             |
| `EFORMAT`   | A file cannot be read: not valid YAML or JSON, not a supported SOPS file, two files for one layer, a secret `config()` could never find in the environment, or a config name reserved for an accessor. |
| `EVALUE`    | A value cannot be stored or turned into an environment variable.   |
| `EUSAGE`    | A CLI command was called the wrong way, or the editor failed.      |

</details>

<details>
<summary><strong>Secrets and plain settings</strong></summary>

A name is a secret while an encrypted file contributes to its merged value. A plain file that replaces a secret from a lower layer makes the name plain config for that env; a plain mapping merged into an encrypted one keeps it a secret.

A secret must be a string, number, or boolean, since the platform injects it as a variable: a mapping or list secret missing from the environment fails with `EFORMAT`.

</details>

<details>
<summary><strong>Types and process.env</strong></summary>

- `env()` writes every top-level value that is a string, number, boolean, or `null` into `process.env`, as a string.
- `config()` returns the merged object with the YAML types kept, so `TIMEOUT: 60000` comes back as the number `60000`, while `env()` sets `process.env.TIMEOUT` to `"60000"`.
- Nested objects and lists, and names that are not valid variable names (such as `log-level`), are returned by `config()` but never written into `process.env`.
- A value the environment provides comes back with its file's type when the string matches it, so `PORT=3000` is the number `3000` again, even for a secret, whose type is plaintext in the encrypted file.

</details>

<details>
<summary><strong>File rules</strong></summary>

- **Formats.** Plain files are YAML (`.yml`, `.yaml`) or JSON (`.json`), read with [js-yaml](https://github.com/nodeca/js-yaml); an empty file is an empty layer.
- **One file of each kind per layer.** Each layer has at most one plain and one encrypted file, so `default.yml` next to `default.json` is an error, and so is a sops-encrypted file named like a plain one.
- **YAML tags.** Encrypted files accept only the standard tags `!!str`, `!!int`, `!!float`, `!!bool`, `!!null`, and `!!timestamp`, on values, so a value such as `!Passw0rd` must be quoted.
- **Errors never print secrets.** A YAML error names the line and column but never the text, so a broken line cannot print a secret.
- **Env names.** Env names are lowercase letters, digits, `.`, `_`, and `-`, without `..`, an `enc` part, or a file extension, so `NODE_ENV=Production` fails at boot instead of reading another file.
- **Exact file names.** Layer files must match that exact name: `Production.yml` next to a `production` layer is refused, so a layer reads the same on every filesystem.
- **No files at all.** `config()` throws when it finds no file at all, so an image that forgot to copy `config/`, or a process started from the wrong directory, fails at boot instead of running without its configuration.

</details>

<details>
<summary><strong>Key sources</strong></summary>

A source can hold several keys, one per line or separated by spaces. Post-quantum (`AGE-SECRET-KEY-PQ-`) and plugin identities are skipped, and SSH keys are not read. A source that cannot be read or parsed, such as a keys file holding an SSH key, is skipped when another source has a key; when no key opens the file, the error names the sources it skipped.

</details>

<details>
<summary><strong>Performance</strong></summary>

After about 9ms to load the module, the first `config()` call takes about 6ms when it decrypts two layers, against roughly 30ms for spawning `sops -d` twice, and about 3.5ms when the platform already injected every secret and nothing is decrypted. Each file is decrypted once per process, so later calls, including `env()` after `config()`, take about 1ms.

</details>

<details>
<summary><strong>Compatibility</strong></summary>

onesecret reads and writes SOPS files encrypted for age X25519 recipients, in YAML or JSON, and reads every value type sops writes in those formats (`str`, `int`, `float`, `bool`, `time`).

Values in encrypted files resolve the way go-yaml v3 does in sops, so `0777` is 511 and `2024-01-01` is a timestamp. Plain files are read with js-yaml instead, where `0777` is 777, YAML merge keys (`<<`) are not applied, and integers beyond 2^53 lose precision, so moving a value between a plain and an encrypted file can change it. Integers beyond 2^53 come back as `BigInt`, and timestamps as RFC 3339 strings, which are written back as strings.

Rules and `path_regex` accept Go regular expression syntax such as `(?i)`, `\A`, `\z`, and `[[:lower:]]`. The test suite checks all of this against `sops` 3.13 and `age` 1.3 in both directions, including `mac_only_encrypted` and the `*_suffix` and `*_regex` rules. Like sops, it rejects truncated authentication tags and low-order age recipients.

It does not support PGP, cloud KMS, key groups, Shamir secret sharing, comment-based rules, or YAML anchors and multiple documents in an encrypted file (`.sops.yaml` can use anchors). It refuses to write a file that also has KMS or PGP keys rather than drop them, and YAML comments are lost when it writes a file. Use the `sops` CLI for any of those.

</details>

## License

**onesecret** © [Jose Francisco 'Kiko' Verdú Gambín](https://kikobeats.com), released under the [MIT](https://github.com/kikobeats/onesecret/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Jose Francisco 'Kiko' Verdú Gambín](https://kikobeats.com) with help from [contributors](https://github.com/kikobeats/onesecret/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Jose Francisco 'Kiko' Verdú Gambín](https://github.com/kikobeats) · Twitter [@kikobeats](https://twitter.com/kikobeats)
