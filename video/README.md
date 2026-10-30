# onesecret launch video

A 36-second, 1080×1080 video that explains onesecret in three steps, built with [Remotion](https://www.remotion.dev) in the docs site's colors, fonts, and logo.

| Scene | Seconds | Shows |
| --- | --- | --- |
| Hook | 0–5 | Values in `config/production.enc.yml` encrypt in place; names stay readable |
| ① Commit | 5–14 | `onesecret set`, then `git commit` |
| ② Deploy | 14–23 | CI decrypts in memory and hands the values to the platform |
| ③ Run | 23–33 | The app reads env vars; without `STRIPE_KEY` it refuses to start |
| Outro | 33–36 | Logo, tagline, `npm install onesecret` |

CLI output on screen is real `onesecret` output. `listening on :3000` stands in for your app's own log, and encrypted values are truncated with `…`.

## Commands

```bash
pnpm install
pnpm dev                                                    # preview in Remotion Studio
npx remotion render Launch out/onesecret-launch.mp4 --crf=18   # MP4 into out/ (gitignored)
pnpm lint                                                   # eslint + tsc
```

Use pnpm: `npm i` loops while resolving this project's dependencies.

## Layout

- `src/theme.ts`: colors and fonts, taken from `docs/css/style.css` (dark theme)
- `src/ui.tsx`: background, step title, caption, terminal with typing
- `src/scenes/`: one component per scene
- `src/Launch.tsx`: scene order and fades
- `public/mark.svg`: copy of `static/mark.svg`
