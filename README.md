# onesecret

![Last version](https://img.shields.io/github/tag/kikobeats/onesecret.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/kikobeats/onesecret.svg?style=flat-square)](https://coveralls.io/github/kikobeats/onesecret)
[![NPM Status](https://img.shields.io/npm/dm/onesecret.svg?style=flat-square)](https://www.npmjs.org/package/onesecret)

> Keep just one secret to decrypt the rest.

Your app runs on secrets: a database password, a payment API key, a token for every service it talks to. Each one has to live somewhere, and that place decides how easily it leaks, how a new teammate gets it, and what breaks the day it changes.

onesecret keeps them in your repository, encrypted, right next to the code that uses them. One key opens all of them, and that key is the only secret you ever have to look after.

## Where secrets usually live

Most projects keep them in one of three places, and each one fails in its own way.

- **A `.env` file nobody commits.** It works on your laptop. Then a teammate joins and the file gets pasted into a chat. A value changes, and everyone else finds out when their app stops working. Nothing records what changed, when, or why.
- **A secrets manager.** The values sit in a dashboard, away from the code. A pull request that needs a new secret cannot include it, so someone has to remember to add it by hand before the deploy, or the deploy breaks. Changes happen outside code review, and it is one more service to run.
- **The repository, in plain text.** Everyone has what they need, and so does anyone who ever sees the code. Every clone, fork, and old commit carries your production passwords for good.

The third option has the right idea. Every teammate, CI job, and deploy already has the repository, and git already records every change with its author and its reason. What it lacks is encryption.

## Commit them, encrypted

This is the file onesecret commits for two production secrets:

```yaml
# config/production.enc.yml
DATABASE_URL: ENC[AES256_GCM,data:utwdF1b1NkenaKT8QNokprQx…,iv:…,tag:…,type:str]
STRIPE_KEY: ENC[AES256_GCM,data:jat/60moV+lMPNo8vRzZ,iv:…,tag:…,type:str]
sops:
    …  # which key opens the file, and a checksum that catches tampering
```

The names stay readable, the values do not. Anyone who sees the repository, a fork, or an old commit learns which secrets exist and nothing more. With the key, onesecret turns it back into the values you wrote.

Everything else follows from that:

- **Secrets ship with the code.** A new secret lands in the same commit and pull request as the code that needs it, gets reviewed with it, and keeps the same history.
- **One key opens everything.** Every secret, in every environment, opens with the same key. A new teammate or CI job needs that key and nothing else.
- **Your servers never hold the key.** When you deploy, you hand the values to your hosting platform as environment variables, the way hosting platforms already run secrets. A leaked server leaks only its own values.
- **No service to depend on.** It works on any host: Vercel, Fly.io, Kubernetes, AWS, Docker, or your own server. Encryption runs inside Node.js, with nothing else to install, and the files use the open [SOPS](https://github.com/getsops/sops) format, so the `sops` CLI reads them too. Some deploy recipes below still push values into a platform's own secret store, such as AWS Secrets Manager; git stays the source of truth.

The trade-off is the key itself. Whoever holds it can read every secret, in every environment and every old commit, so guard it like a root password. When a team needs more than one shared key, each person or CI job can have its own, as [How it works](#separate-keys-per-person) explains.

## Install

Requires Node.js 24 or newer.

```bash
$ npm install onesecret
```

## Quick start

Three steps: create the key, encrypt a secret, and read it from your app.

**1. Create your key.**

```bash
$ npx onesecret init

public key   age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
private key  AGE-SECRET-KEY-1…
secrets      config/default.enc.yml

The private key is the only secret to keep: it decrypts all the others.
It is shown only now and saved nowhere, so store it safely (and as
SOPS_AGE_KEY in CI). To use it in this shell:

  export SOPS_AGE_KEY=AGE-SECRET-KEY-1…
```

onesecret encrypts with [age](https://age-encryption.org), a small modern encryption tool, and writes files in the SOPS format, which is where the name `SOPS_AGE_KEY` comes from. The private key decrypts: copy it into your password manager now, and never commit it. The public key only encrypts, and it is already written into the file, so you don't need to keep it. Then run the `export` line, so the next commands can use the key.

**2. Encrypt a secret, and commit it.**

```bash
$ npx onesecret set DATABASE_URL
$ git add config && git commit -m "Add DATABASE_URL"
```

`set` opens your editor (`$VISUAL` or `$EDITOR`, otherwise `vi`) for the value, so it never ends up in your shell history, and encrypts it into `config/default.enc.yml` when you save.

Settings that are not secret, such as a port, go in a plain file next to it:

```bash
$ echo 'PORT: 3000' > config/default.yml
```

**3. Read them when your app starts.**

`config()` returns your settings and secrets as one object:

```js
const config = require('onesecret').config()

config.PORT // 3000
config.DATABASE_URL // 'postgres://…'
```

If your code already reads `process.env`, as with dotenv, call `env()` instead. It puts every value into `process.env`:

```js
require('onesecret').env()

process.env.DATABASE_URL // 'postgres://…'
```

onesecret decrypts with the key you exported. Without a key, the app stops at startup and names each secret it could not read, instead of running with a value missing:

```
onesecret: DATABASE_URL is not set and cannot be decrypted, no age key found: …
```

That is the whole loop. To see it in a real project, run the [example app](https://github.com/Kikobeats/onesecret/tree/master/example).

## Environments

So far everything went into `default`, the base every environment shares. Each environment adds a layer on top of it: a plain file and an encrypted file named after the environment. To give production its own database:

```bash
$ npx onesecret set --env production DATABASE_URL
```

Each environment can have a plain file for settings and an encrypted file for secrets, and every file is optional:

```
config/default.yml           ← settings for every environment
config/default.enc.yml       ← secrets for every environment
config/production.yml        ← settings for production only
config/production.enc.yml    ← secrets for production only
```

Your app reads `default` and then the environment named by `NODE_ENV` (`development` when unset), and the environment wins where both have the same name. Inside one layer, the encrypted file is read after the plain one and wins. Nested settings merge key by key, so `production.yml` can change `database.pool` and keep the rest of `database` from `default.yml`.

A new environment opens with the same key, so there is nothing to set up: `staging` is one `set --env staging` away.

## Reading values

Besides plain property access, the object `config()` returns has helpers for optional and required values:

```js
const config = require('onesecret').config()

// Optional values: fall back to a default when unset
config.get('LOG_LEVEL', 'info') // 'info'
config.get('database.pool', 10) // a dot path reaches nested settings

// Check before using something optional
if (config.has('SENTRY_DSN')) {
  // set up error tracking
}

// Values your app cannot run without: fail at startup, naming what is missing
config.require('DATABASE_URL') // 'postgres://…'
const { DATABASE_URL, PORT } = config.required // the same, for several names at once

// OnesecretError: onesecret: "DATABASE_URL" is required but not set in the "production" config
```

## Everyday tasks

### Add or change a secret

```bash
$ npx onesecret set API_TOKEN
$ npx onesecret set --env production API_TOKEN
```

`set` opens your editor for the value. In a script, pipe it in instead, with `printf %s` so no newline is added: `printf %s "$VALUE" | npx onesecret set NAME`.

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

The key decrypts secrets on your laptop and in CI. Your servers never get it. Instead, each deploy decrypts the values and hands them to your hosting platform, which stores them and sets them as environment variables, the way it runs any secret:

```
your laptop or CI         hosting platform            your app
key + config/  ─────────▶ stores the values  ───────▶ starts with them already set,
               deploy     as environment variables    decrypts nothing, holds no key
```

That keeps the damage of a breach small. The key opens every environment, so it stays with the people and jobs that deploy. A server holds only its own values, so a compromised server leaks those and nothing else.

Ship the `config/` folder with your app. It holds your plain settings and the list of secret names, so the app can still tell you if the platform is missing one.

Pick your platform below. Most recipes use [jq](https://jqlang.org) to handle the values.

<details>
<summary data-logo="recipes"><strong>How the recipes work</strong></summary>

Deploys push only the secrets, with their merged values. Plain settings ship inside the image with the `config/` directory.

Every provider is fed with three primitives:

- `onesecret dotenv --json` prints every secret as one JSON object, for APIs and CLIs that take JSON.
- `onesecret ls` prints the secret names, and `onesecret get NAME` prints one value. When piped, `get` prints the exact bytes with no trailing newline.
- `onesecret exec -- <command>` runs a command with the secrets in its environment.

Always pass `--env` to them in a deploy script: without it they read `NODE_ENV`, then `development`. With `--env`, `dotenv` and `ls` refuse a layer that has no plain or encrypted file, so a typo such as `--env prodution` or a wrong `--dir` fails instead of pushing the default layer. To push the default layer alone, pass `--env default`.

Each recipe below decrypts once into a `secrets` variable and pushes only when that worked, so a missing key sends nothing instead of empty values. In a script, start with `set -euo pipefail`, so a failed decrypt also stops the deploy that follows.

</details>

<details>
<summary data-logo="kubernetes"><strong>Kubernetes</strong></summary>

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
<summary data-logo="flyio"><strong>Fly.io</strong></summary>

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
<summary data-logo="vercel"><strong>Vercel</strong></summary>

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
<summary data-logo="netlify"><strong>Netlify</strong></summary>

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
<summary data-logo="cloudflare-workers"><strong>Cloudflare Workers</strong></summary>

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

- `package.json` is not in the bundle, so pass `dir` and `keyCommand` ([a command that prints the key](#fetch-the-key-with-a-command)) in code. The Workers runtime reports Node.js 22: onesecret ran there in `wrangler dev`, but it is below the supported `engines` range.

</details>

<details>
<summary data-logo="railway"><strong>Railway</strong></summary>

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
<summary data-logo="render"><strong>Render</strong></summary>

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
<summary data-logo="aws"><strong>AWS</strong></summary>

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
<summary data-logo="google-cloud-run"><strong>Google Cloud Run</strong></summary>

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
<summary data-logo="docker"><strong>Docker</strong></summary>

```bash
$ npx onesecret exec --env production -- docker run $(npx onesecret ls --env production | sed 's/^/-e /') my-image
```

`-e NAME` without a value copies `NAME` from the environment `onesecret exec` builds. The unquoted `$(...)` splits into one `-e NAME` pair per secret, which is safe because secret names are valid variable names. With Compose, list the names without values under `environment:`, such as `- DATABASE_URL`, then run `npx onesecret exec --env production -- docker compose up -d`.

- Do not pass `onesecret dotenv` output to `docker run --env-file` or Compose `env_file`. Docker keeps quotes as part of the value and fails on multi-line values, and Compose expands `$NAME` and rejects backticks.
- Copy the config files into the image, with `COPY config ./config` on a `node:24` base image.

</details>

<details>
<summary data-logo="github-actions"><strong>GitHub Actions</strong></summary>

A job that deploys needs a single secret: the private key from `init`. onesecret decrypts the rest in the job.

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
<summary data-logo="anywhere"><strong>Anywhere else</strong></summary>

```bash
$ npx onesecret dotenv --env production > .env.production
```

Values are quoted only when needed, and every line is checked against both Node.js's own `.env` parser and the `dotenv` package before it is printed, so `#`, spaces, quotes, backslashes, and newlines read back unchanged with `node --env-file` or `dotenv`. A value that no quoting can carry through both, such as one starting with `'` and ending with `\`, is refused instead of corrupted.

Other `.env` parsers differ, as the providers above show. When a tool takes JSON, prefer `onesecret dotenv --json`, which carries every value unchanged, as a string.

</details>

## How it works

### The files are SOPS files

The encrypted files are standard [SOPS](https://github.com/getsops/sops) files locked with an [age](https://age-encryption.org) key, which is why the key starts with `AGE-SECRET-KEY-` and lives in `SOPS_AGE_KEY`. The `sops` CLI and other SOPS tools read and write them too, but you don't need to install either: onesecret does the encryption itself.

Only the values are encrypted. The names stay readable, which is how onesecret knows what should exist without the key, and how `npx onesecret ls` lists them.

### What happens when your app starts

`config()` and `env()` look at the secret names, then at what is already in the environment:

```
Is every secret already set in the environment?
├─ yes  →  use those values, decrypt nothing           ← production
└─ no   →  is there a key?
           ├─ yes  →  decrypt only the missing ones    ← development, CI
           └─ no   →  stop, naming each missing secret
```

- A value already in the environment always wins, for plain settings too. An empty string counts as set.
- To fill in missing secrets, onesecret decrypts every encrypted file of that environment, so the key must open all of them, even when only one holds a missing secret.
- `config()` never changes `process.env`. `env()` changes nothing but `process.env`, or `options.processEnv` when given.

### Where the key comes from

onesecret looks for the key in these places and tries every key it finds:

1. `SOPS_AGE_KEY`, the key itself. This is the usual choice in CI.
2. `SOPS_AGE_KEY_FILE`, a path to a keys file.
3. The keys file the `sops` CLI uses: `$XDG_CONFIG_HOME/sops/age/keys.txt`, `~/Library/Application Support/sops/age/keys.txt` on macOS, or `~/.config/sops/age/keys.txt`.

If none of them opens the file, it runs `SOPS_AGE_KEY_CMD` or the `keyCommand` setting.

### Fetch the key with a command

With `keyCommand`, nobody keeps the key on disk. It is a command that prints the key, for example from a GitLab CI variable (`glab`) or from 1Password (`op`). Set it in `package.json`:

```json
{
  "onesecret": {
    "keyCommand": "glab variable get SOPS_AGE_KEY -R my-group/my-project"
  }
}
```

It runs at most once per process, whether it works or not. `config()` and `env()` never run it in `production` or `staging`, so a missing secret there fails the boot instead of fetching a key. The CLI (`exec`, `get`, `dotenv`) runs it in any environment, since you call it on purpose.

Because it comes from `package.json`, `keyCommand` is as trusted as an npm script: only run onesecret in repositories you trust.

### Keeping the key away from your app

When onesecret loads, it takes `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, and `SOPS_AGE_KEY_CMD` out of `process.env` and keeps them in memory. Your app gets the secrets, and no process it starts afterwards (a `kubectl` or `fly` call, a browser, the command you pass to `exec`) sees the key.

- Every copy of onesecret in the process shares the key it holds, so two versions in `node_modules` or a module registry reset keep working. A worker thread copies `process.env` after the key is gone, so it cannot decrypt.
- A key variable you set later is taken the next time onesecret reads the key and replaces the one it holds. A process started before that read still sees it.
- Deleting a key variable changes nothing, since onesecret already holds it. Set it to an empty string to drop the key, for example in a test of what happens without one.
- Code that reads `SOPS_AGE_KEY` itself finds it unset once onesecret is loaded.
- The keys file stays on disk, readable to anything running as you.

### New environments use the same key

A new encrypted file, such as `config/staging.enc.yml`, is locked for the same key as `config/default.enc.yml` in its folder, with the same encryption rules. If the folder has no `default.enc.yml` yet, it is locked for the key you exported in `SOPS_AGE_KEY`.

### Separate keys per person

One shared key needs no setup. To give each person or CI job its own key, list their public keys in a `.sops.yaml` rule, the format the `sops` CLI uses, then encrypt each environment again:

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

When a `.sops.yaml` rule matches a file, its keys replace the ones the file already lists. Removing someone stops them from reading future versions, but not the versions they already had, so change the credentials themselves too.

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
- `0`, `false`, `''`, and `null` count as set. Values keep their YAML type, and a value from the environment takes the file's type, so `PORT=8080` over `PORT: 3000` reads `8080`.

</details>

<details>
<summary><strong>API: env()</strong></summary>

Writes every value missing from `process.env` (or `options.processEnv`) into it, as a string: the same values `config()` would add on top of the environment. It follows the same rules and throws the same errors as `config()`, writes nothing when it throws, and returns nothing.

```js
require('onesecret').env()
```

</details>

<details>
<summary><strong>API: secrets() and secretNames()</strong></summary>

For deploy scripts written in Node.js, the same values as `onesecret dotenv --json` and the same names as `onesecret ls`, without spawning the CLI:

```js
const onesecret = require('onesecret')

const secrets = onesecret.secrets({ env: 'production' }) // { DATABASE_URL: 'postgres://…', … }
const names = onesecret.secretNames({ env: 'production' }) // ['DATABASE_URL', …]

onesecret.checksum(secrets) // roll pods when a value changes
```

- `secrets()` decrypts every secret of the env, merged over `default`, and returns each value as a string, ready to push to your platform. It ignores what is already in the environment.
- It runs `keyCommand` in any env, like the CLI, since a deploy script calls it on purpose.
- `secretNames()` needs no key.
- Both take the options above. With `env`, the layer file must exist, so a typo such as `prodution` throws `EVALUE` instead of reading the default layer alone; pass `env: 'default'` for the default layer.

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
- A value the environment provides comes back with its file's type, so `PORT=8080` over `PORT: 3000` is the number `8080`, `DEBUG=true` over `DEBUG: false` is `true`, and a secret takes the type sops recorded for it. Text that does not read back exactly as that type, such as `0x10`, `1e3`, or `yes`, stays a string, and a string in the file always stays a string, so `PLAN_ID=0123` keeps its leading zero.

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
