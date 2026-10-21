# onesecret example

A tiny app that reads three credentials, `DATABASE_URL`, `STRIPE_KEY`, and `SESSION_SECRET`, from encrypted files committed next to it.

```
example/
├── .sops.yaml                  ← who can decrypt: one age public key
├── age.key                     ← the one secret (committed here only because this is a demo)
├── index.js                    ← require('onesecret').config()
├── package.json                ← "onesecret": { "keyCommand": "cat age.key" }
└── secrets/
    ├── default.enc.yml         ← every environment
    └── production.enc.yml      ← merged on top when NODE_ENV=production
```

Open `secrets/default.enc.yml`: the names are readable, the values are not.

> In a real project, never commit the private key. Keep it in CI as `SOPS_AGE_KEY` and in your team's password manager, and point `keyCommand` at that instead (for example `op read op://dev/app/age-key` or `glab variable get SOPS_AGE_KEY`).

## Run it

```bash
$ cd example
$ npm install
$ npm start

environment  development
database     localhost:5432
stripe       sk_test_…
session      18 characters
```

`config()` saw that the three variables were missing, found no local key, ran `keyCommand` to get one, and decrypted `default.enc.yml`.

## Production: the platform injects, nothing is decrypted

When every secret is already in the environment, as it is after `onesecret kubernetes` or `onesecret fly`, `config()` decrypts nothing and needs no key:

```bash
$ NODE_ENV=production DATABASE_URL=postgres://injected:5432/app STRIPE_KEY=sk_live_injected SESSION_SECRET=from-platform npm start

environment  production
database     injected:5432
stripe       sk_live_…
session      13 characters
```

## Production: a missing secret fails the boot

`keyCommand` never runs in `production` or `staging`, so a secret the platform forgot to inject stops the app at boot and is named:

```bash
$ NODE_ENV=production npm start

OnesecretError: onesecret: DATABASE_URL, STRIPE_KEY, SESSION_SECRET are not set and cannot be decrypted, no age key found: … (keyCommand is not run here)
```

With the key given explicitly, the production layer is merged over the default one. `SESSION_SECRET` comes from `default.enc.yml`, the other two from `production.enc.yml`:

```bash
$ NODE_ENV=production SOPS_AGE_KEY_FILE=age.key npm start

environment  production
database     db.internal:5432
stripe       sk_live_…
session      18 characters
```

## The CLI

```bash
$ npx onesecret ls                            # names, no key needed
$ npx onesecret get STRIPE_KEY --env production
$ npx onesecret set REDIS_URL=redis://localhost:6379
$ npx onesecret edit --env production         # opens the layer decrypted in $EDITOR
$ npx onesecret dotenv > .env                 # for tools that read .env files
$ npx onesecret exec -- node index.js         # the secrets reach the child, the key does not
```

To deploy, push the decrypted values to the platform before the app starts:

```bash
$ npx onesecret kubernetes --env production --name example-env --namespace example
$ npx onesecret fly --env production --app example
```

See the [main README](../README.md#deploy) for the Kubernetes checksum annotation and the Fly details.

## The files are plain sops

Nothing here is specific to onesecret. With the `sops` CLI installed:

```bash
$ SOPS_AGE_KEY_FILE=age.key sops -d secrets/production.enc.yml
DATABASE_URL: postgres://db.internal:5432/example
STRIPE_KEY: sk_live_51Example
```
