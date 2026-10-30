# onesecret launch video

A 36-second, 1080×1080 video that explains onesecret in three steps, built with [Remotion](https://www.remotion.dev) in the docs site's colors, fonts, and logo.

Fades last 0.5s and overlap the scenes on either side, so the ranges below overlap. The film is 36s.

| Scene    | Seconds   | Shows                                                                       |
| -------- | --------- | --------------------------------------------------------------------------- |
| Hook     | 0–5       | Values in `config/production.enc.yml` encrypt in place; names stay readable |
| ① Commit | 4.5–13.5  | `onesecret set`, then `git commit`                                          |
| ② Deploy | 13–22     | CI decrypts in memory and hands the values to the platform                  |
| ③ Run    | 21.5–31.5 | The app reads env vars; without `STRIPE_KEY` it refuses to start            |
| Outro    | 31–36     | Logo, tagline, `npm install onesecret`                                      |

CLI output on screen is real `onesecret` output. `listening on :3000` stands in for your app's own log, encrypted values are truncated with `…`, and the `EMISSING` line stops before the key-location hint.

## Commands

```bash
pnpm install
pnpm dev                                                    # preview in Remotion Studio
npx remotion render Launch out/onesecret-launch.mp4 --crf=18   # MP4 into out/ (gitignored)
pnpm lint                                                   # eslint, prettier, and tsc
pnpm test                                                   # scene clock and terminal lines
```

Use pnpm: `npm i` loops while resolving this project's dependencies.

## Layout

- `src/theme.ts`: colors and fonts, taken from `docs/css/style.css` (dark theme)
- `src/ui.tsx`: background, step title, caption, terminal with typing
- `src/scenes/`: one component per scene
- `src/timeline.ts`: scene lengths and the 36s total, including the half-second fades
- `src/Launch.tsx`: scene order and fades
- `public/mark.svg`: copy of `static/mark.svg`
- `public/onesecret-launch.mp4`: the rendered video, so it can be shared without rendering; render again after changing a scene
