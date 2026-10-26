## [0.2.0](https://github.com/kikobeats/onesecret/compare/v0.1.2...v0.2.0) (2026-10-26)

### ⚠ BREAKING CHANGES

* withoutAgeKey is removed, since process.env no
  longer holds the key. Code that reads SOPS_AGE_KEY itself finds it
  unset once onesecret is loaded; set it to an empty string to drop
  the held key.

### Features

* keep the age key out of process.env ([#23](https://github.com/kikobeats/onesecret/issues/23)) ([6979ef2](https://github.com/kikobeats/onesecret/commit/6979ef2d14b189219ca0408d0ef04a3030fd6ef9))

## [0.1.2](https://github.com/kikobeats/onesecret/compare/v0.1.1...v0.1.2) (2026-10-26)

### Features

* env values take the type of the setting in the file ([#22](https://github.com/kikobeats/onesecret/issues/22)) ([8c9bbe5](https://github.com/kikobeats/onesecret/commit/8c9bbe5bf2bc41ae6d3474855ec75ce39e2e5d4f))

## [0.1.1](https://github.com/kikobeats/onesecret/compare/v0.1.0...v0.1.1) (2026-10-26)

### Features

* secrets() and secretNames() for deploy scripts ([#21](https://github.com/kikobeats/onesecret/issues/21)) ([0f4f614](https://github.com/kikobeats/onesecret/commit/0f4f6148feff202049b30e9107755cf35fa62aaa))

## 0.1.0 (2026-10-25)

### ⚠ BREAKING CHANGES

* `config()` no longer writes process.env; call `env()`
  for that. `load()` and `names()` are removed.
* `onesecret get` output no longer ends with a newline
  when piped or redirected. `dotenv` and `ls` with an explicit `--env`
  now fail when that layer has no file instead of reading the default
  layer.
* `onesecret set NAME=value` and setting several names
  in one call are removed. Use `onesecret set NAME` (editor) or
  `printf %s "$VALUE" | onesecret set NAME` (scripts). Empty values are
  set with `onesecret edit`.
* the `onesecret kubernetes` and `onesecret fly`
  commands, their flags (--name, --namespace, --context, --app,
  --no-stage), the `kubernetes()` and `fly()` API functions, and the
  EDEPLOY error code are removed. Use the recipes in the README Deploy
  section.

### Features

* **docs:** provider logos on the deploy recipes ([#16](https://github.com/kikobeats/onesecret/issues/16)) ([97c5390](https://github.com/kikobeats/onesecret/commit/97c5390c267f3ff37539795c611f1dff7c5b9c8a))
* **docs:** solid mint key brand mark, app icon, and generated OG banner ([#15](https://github.com/kikobeats/onesecret/issues/15)) ([b5b00b0](https://github.com/kikobeats/onesecret/commit/b5b00b0fe99ea091878fe5ac1a4037abaecc6872))
* keep one age key and decrypt every secret with it ([87fc0fb](https://github.com/kikobeats/onesecret/commit/87fc0fb52ebe6dc3782d2bcb15d52a1054faa375))
* load plain config layers next to the secrets, and replace miconfig ([034679c](https://github.com/kikobeats/onesecret/commit/034679c6e69dc206c62d3039b3c4bafdf8419d4d))
* no .sops.yaml needed ([#5](https://github.com/kikobeats/onesecret/issues/5)) ([ea6da84](https://github.com/kikobeats/onesecret/commit/ea6da84287c4ca2ce4a2f4cbea25351507d53f4d))
* set takes a NAME and reads the value from $EDITOR or stdin ([#13](https://github.com/kikobeats/onesecret/issues/13)) ([419ae4d](https://github.com/kikobeats/onesecret/commit/419ae4d2072a934997f55159c203324ca87e5b20))

### Bug Fixes

* keep edits through repeated save errors, match layer files exactly ([d336ba5](https://github.com/kikobeats/onesecret/commit/d336ba56591796f23df54b13868a877610adf36d)), references [#2](https://github.com/kikobeats/onesecret/issues/2)
* keep init recoverable and refuse case-variant layer files ([8ea7eae](https://github.com/kikobeats/onesecret/commit/8ea7eaeb5316219ed7b52695ca11c2942a7e9674)), references [#2](https://github.com/kikobeats/onesecret/issues/2)
* **keys:** name skipped key sources without repeating the prefix ([4b92086](https://github.com/kikobeats/onesecret/commit/4b920862810c67ff2014a54550cbfdd16c7f1acc)), references [#1](https://github.com/kikobeats/onesecret/issues/1)
* **keys:** skip an unreadable key source instead of failing every source ([e18b975](https://github.com/kikobeats/onesecret/commit/e18b975ceef00fbeaadc0b0e2227f26bfb32c80e)), references [#1](https://github.com/kikobeats/onesecret/issues/1)
* refuse a case-variant layer file even next to the exact one ([bb9f8c4](https://github.com/kikobeats/onesecret/commit/bb9f8c41d9cfd3c945f2976c38edd2ad8595c898)), references [#3](https://github.com/kikobeats/onesecret/issues/3)
* type an injected secret without checking its name ([d5041f2](https://github.com/kikobeats/onesecret/commit/d5041f221d2f24796ad56d5dbc4c7b8ade42b20c)), references [#2](https://github.com/kikobeats/onesecret/issues/2)

### Documentation

* reorder README, add docsify website, and extend deploy providers ([#11](https://github.com/kikobeats/onesecret/issues/11)) ([9f2aaf7](https://github.com/kikobeats/onesecret/commit/9f2aaf7dac5b3919ffcf28e2112edeca40a63afc))
