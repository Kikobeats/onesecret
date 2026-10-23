# Brand

The onesecret mark is a solid key in a mint gradient: a ring bow, a shaft, and two teeth. `key.js` holds its geometry and colors, and every brand asset is drawn from it.

| File | What it is | Used by |
| --- | --- | --- |
| `static/mark.svg` | The bare key | Cover wordmark, sidebar, mobile header |
| `static/logo.svg` | The key on a dark rounded tile (app icon) | Favicon |
| `static/logo.png` | `logo.svg` at 512px | Apple touch icon, JSON-LD `image` |
| `static/favicon-32x32.png` | `logo.svg` at 32px | PNG favicon |
| `static/banner.jpg` | 2400x1260 social card: glowing key, wordmark, tagline, install command | `og:image`, `twitter:image` |

## Rebuild

The assets are generated and committed, since GitHub Pages runs no build. After changing `key.js` or `banner.js`:

```bash
$ cd docs/brand
$ npm install
$ npm run build
```

`build.mjs` converts the banner text to paths with opentype.js (Space Grotesk, IBM Plex Sans, and JetBrains Mono from Fontsource), so the render does not depend on installed fonts. It rasterizes with sharp. It then writes the banner's content hash into the `og:image` and `twitter:image` URLs in `index.html` (`banner.jpg?v=<hash>`), so social caches fetch the new card.

`test/brand.js` fails when the committed SVGs differ from what `key.js` generates, when the `?v=` hash does not match `banner.jpg`, or when the declared `og:image` size differs from the real one.
