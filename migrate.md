# Migrate a project to onesecret

This guide is written for a coding agent, and works for a person too. Follow it step by step. It moves a Node.js project from `.env` files, a config library, or platform-only secrets to [onesecret](https://github.com/Kikobeats/onesecret): secrets encrypted in `config/` with one age key, plain settings next to them, and every value loaded at boot by `config()` or `env()`.

## Rules

- Never print a secret value: not in the terminal, the logs, a commit message, a pull request, or your reply. Compare values with code that prints only names and a match or mismatch.
- Never write the age private key to a file in the repository. It belongs in the team's password manager and as the `SOPS_AGE_KEY` secret in CI.
- Do not delete secrets from the hosting platform, CI, or the old `.env` files until the new setup has been deployed and verified. List them as follow-ups instead.
- Ask the user before rotating any credential, deleting platform secrets, or rewriting git history.
- Requires Node.js 24 or later.

## 1. Inventory

Find every place configuration comes from, and write the list down before changing anything:

- `.env`, `.env.*`, and `.env.example` files, including in subdirectories and Docker contexts.
- Loaders: `dotenv`, `dotenv-flow`, `dotenv-expand`, `node --env-file`, `config`, `@nestjs/config`, `convict`, `miconfig`, `env-var`, framework conventions (`NEXT_PUBLIC_*`, `VITE_*`).
- Every read of `process.env.NAME`, `process.env['NAME']`, and destructuring of `process.env`.
- Secrets defined only outside the repository: CI variables, Kubernetes Secrets, Fly, Vercel, Netlify, Railway, Render, AWS, Google Cloud.
- Existing SOPS files and `.sops.yaml`. onesecret reads and writes age-encrypted SOPS files in YAML or JSON, so these can usually stay.

For each variable, record its name, every environment it has a value in (development, staging, production, test), where that value lives today, and which files read it.

## 2. Classify

Split the variables in two:

- **Secrets**: credentials, tokens, private keys, connection strings with passwords, signing keys, webhook secrets. They go in `config/<env>.enc.yml`.
- **Plain settings**: ports, log levels, feature flags, public URLs, timeouts. They go in `config/<env>.yml`.

When unsure, treat the value as a secret. Values shipped to the browser (`NEXT_PUBLIC_*`, `VITE_*`) are public by design, so they are plain settings.

Names of secrets must be valid environment variable names (letters, digits, and `_`, not starting with a digit). Values shared by every environment go in the `default` layer; values that differ go in that environment's layer, which overrides `default`.

## 3. Create or reuse the key

If the project has no onesecret key yet:

```bash
$ npm install onesecret
$ npx onesecret init
```

`init` prints the private key once and saves it nowhere. Hand it to the user to store in their password manager, then export it in your shell as `SOPS_AGE_KEY`. Do not echo it again.

If the team already has an age key (from an existing SOPS setup), export it as `SOPS_AGE_KEY` first: `init` then uses it and prints no new key.

## 4. Move the values

Plain settings go into YAML by hand:

```yaml
# config/default.yml
LOG_LEVEL: info
PORT: 3000
```

```yaml
# config/production.yml
LOG_LEVEL: warn
```

Values from `.env` files were strings, and YAML parses some text as other types: `0777` becomes 511, `true` a boolean, `2024-01-01` a date. Quote a plain value when it must stay exactly the same string.

Secrets are encrypted with `set`, one call per environment, never into a plaintext file:

```bash
$ npx onesecret set DATABASE_URL=postgres://localhost/app SESSION_SECRET=dev-only
$ npx onesecret set --env production DATABASE_URL=... STRIPE_KEY=...
```

`set` stores each value as the exact string given. Pass the values from the old `.env` files with a short script that reads them and calls `set` with an argument list (for example `execFileSync('npx', ['onesecret', 'set', '--env', env, ...pairs])`), so values never pass through shell quoting or get printed. `set` takes values only as arguments, so they are visible in the process list while it runs: do this on your own machine or a trusted CI runner, never on a shared host.

Secrets that exist only on a platform (step 1) need their values from the user or the platform's CLI. If you cannot read a value, leave the name out and list it as a follow-up.

## 5. Load the values in the app

Replace the old loader at the very start of the app:

```js
// before
require('dotenv').config()

// after: same behavior, values land in process.env
require('onesecret').env()
```

Or, where the code wants an object:

```js
const config = require('onesecret').config()

config.DATABASE_URL
config.get('database.pool', 5)
config.require('STRIPE_KEY')
```

`config()` never writes `process.env`; `env()` writes only the values that are missing from it, so values the platform injects always win. Both read the layer named by `NODE_ENV`, then `development`. Remove the old loader package once nothing imports it.

## 6. Tests and local scripts

- Unit tests that do not need real credentials: run them with `ONESECRET_SKIP=1`, which loads the plain settings and decrypts nothing.
- Commands that need the secrets but cannot change their code: `npx onesecret exec --env <env> -- <command>`.
- Replace `node --env-file=.env` and `dotenv -e` wrappers in `package.json` scripts with one of the two.

## 7. CI and deploys

- CI needs a single secret: `SOPS_AGE_KEY`. Remove nothing yet (rule 3).
- Production should not need the key: push the decrypted values to the platform at deploy time. Follow the recipe for the project's platform in the [Deploy section](https://github.com/Kikobeats/onesecret#deploy), which covers Kubernetes, Fly.io, Vercel, Netlify, Cloudflare Workers, Railway, Render, AWS, Google Cloud Run, Docker, and GitHub Actions.
- Ship the `config/` directory with the app (Docker image, serverless bundle): `config()` and `env()` read the plain settings and the secret names from it at boot.

## 8. Verify

Prove the migration with output that contains no values:

```bash
$ npx onesecret ls --env production
```

Compare the new values with the old ones, per environment, printing only names and `ok` or `MISMATCH`. For example, parse `npx onesecret dotenv --env production --json` (the secrets) and `require('onesecret').config({ env: 'production', processEnv: {} })` (every setting and secret merged, ignoring the current environment, with YAML types, so compare `String(value)`) in a small Node script, next to the old `.env` plus `.env.production` parsed with `node:util`'s `parseEnv`. With an explicit `--env`, `dotenv` refuses a layer that has no file, so an environment whose values all live in `default`, such as development, is checked with `--env default`. Every secret and setting from the inventory must be accounted for.

Then run the test suite and start the app with each environment's settings. Fix any mismatch before going on.

## 9. Clean up and report

- Add `.env*` files to `.gitignore` (keep `.env.example` only if the project uses it as documentation, without values). Delete local `.env` files only after step 8 passed, and tell the user.
- If secrets were ever committed in plaintext, say so: they remain in git history and should be rotated. Do not rewrite history unless the user asks.

Finish with a short report:

1. What moved where: secret names and plain setting names per layer, never values.
2. What changed in the code, scripts, CI, and deploy.
3. How to verify (step 8) and what you already verified.
4. Follow-ups for the user: store the key, add `SOPS_AGE_KEY` to CI, remove the old platform variables after the first verified deploy, rotate exposed credentials, and fill in any value you could not read.
