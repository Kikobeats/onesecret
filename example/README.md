# onesecret example

A tiny app that reads its settings (`PORT`, `LOG_LEVEL`, `REQ_TIMEOUT`) from plain files and its credentials (`DATABASE_URL`, `STRIPE_KEY`, `SESSION_SECRET`) from encrypted files, all committed next to it, and gets them back as one object.

```
example/
├── index.js                    ← const config = require('onesecret').config()
├── package.json
└── config/
    ├── default.yml             ← settings for every environment
    ├── default.enc.yml         ← secrets for every environment
    ├── production.yml          ← settings merged on top when NODE_ENV=production
    └── production.enc.yml      ← secrets merged on top when NODE_ENV=production
```

Open `config/default.enc.yml`: the names are readable, the values are not. Its `sops:` block also lists the public key it is locked for, which is all onesecret needs to encrypt new files, so there is no `.sops.yaml`.

## The one secret

Everything above is committed. What is not is the age private key that decrypts it. Export it:

```bash
$ export SOPS_AGE_KEY=AGE-SECRET-KEY-13QR3K228RC02SC75MGDSQX7ALFSCPMXGXNQ4RDQ5XMSZKGAAK4AS43X0HC
```

This key is printed here only because the example's secrets are fake. In a real project, never write it down in the repo: keep it as a CI variable named `SOPS_AGE_KEY` and in your team's password manager, or let `keyCommand` fetch it (see the [main README](../README.md#how-it-works)).

## Run it

This example uses onesecret from this repository, so install its dependencies at the root first, then the example's:

```bash
$ npm install
$ cd example
$ npm install
$ node index.js

environment  development
port         3000
log level    debug
timeout      60s
database     localhost:5432
stripe       sk_test_…
session      18 characters
```

`config()` read the plain settings from `default.yml`, saw that the three secrets were missing from the environment, found the key in `SOPS_AGE_KEY`, and decrypted `default.enc.yml`. `REQ_TIMEOUT` comes back as a number, so `config.REQ_TIMEOUT / 1000` just works.

With `NODE_ENV=production`, the production files are merged over the default ones. `SESSION_SECRET` comes from `default.enc.yml`, the other two secrets from `production.enc.yml`, `PORT` from `default.yml`, and `LOG_LEVEL` and `REQ_TIMEOUT` from `production.yml`:

```bash
$ NODE_ENV=production node index.js

environment  production
port         3000
log level    info
timeout      30s
database     db.internal:5432
stripe       sk_live_…
session      18 characters
```

## Production: the platform injects, nothing is decrypted

A production server does not have the key. Drop it from your shell to act like one:

```bash
$ unset SOPS_AGE_KEY
```

When every secret is already in the environment, as it is after `onesecret kubernetes` or `onesecret fly`, `config()` decrypts nothing and needs no key. The plain settings still come from `default.yml` and `production.yml`:

```bash
$ NODE_ENV=production DATABASE_URL=postgres://injected:5432/app STRIPE_KEY=sk_live_injected SESSION_SECRET=from-platform node index.js

environment  production
port         3000
log level    info
timeout      30s
database     injected:5432
stripe       sk_live_…
session      13 characters
```

## Production: a missing secret fails the boot

Without the key, a secret the platform forgot to inject stops the app at boot and is named:

```bash
$ NODE_ENV=production node index.js

OnesecretError: onesecret: DATABASE_URL, STRIPE_KEY, SESSION_SECRET are not set and cannot be decrypted, no age key found: … (keyCommand is not run here)
```

## The CLI

With `SOPS_AGE_KEY` exported again:

```bash
$ npx onesecret edit config/production.enc.yml   # opens it decrypted in $EDITOR, encrypts on save
$ npx onesecret edit config/production.yml       # a plain file opens as it is
$ npx onesecret ls                               # secret names, no key needed
$ npx onesecret get LOG_LEVEL --env production   # any value, plain or secret
$ npx onesecret set REDIS_URL=redis://localhost:6379
$ npx onesecret dotenv > .env                    # the secrets, for tools that read .env files
$ npx onesecret exec -- node index.js            # settings and secrets reach the child, the key does not
```

To deploy, push the secrets to the platform before the app starts. The plain settings ship in the image with `config/`:

```bash
$ npx onesecret kubernetes --env production --name example-env --namespace example
$ npx onesecret fly --env production --app example
```

See the [main README](../README.md#deploy) for the Kubernetes checksum annotation and the Fly details.

## The files are plain sops

The encrypted files are not specific to onesecret. With the `sops` CLI installed, it reads the same `SOPS_AGE_KEY`:

```bash
$ sops -d config/production.enc.yml
DATABASE_URL: postgres://db.internal:5432/example
STRIPE_KEY: sk_live_51Example
```
