# Cover

The website's cover is a live WebGPU scene rendered with [vgpu](https://vgpu.sh): a glass key, shaped like the onesecret logo, floats over SOPS `ENC[AES256_GCM,...]` ciphertext and shows the decrypted values through its shaft.

## How it loads

- `_coverpage.md` holds the markup. docsify renders it, and `docs/js/main.js` imports `main.js` once the markup is in the page.
- `main.js` imports `vgpu@0.6.0` from jsdelivr, so nothing is bundled. It renders one fullscreen effect (`shaders/lens.wgsl`, prepared into `shaders.js`) with the glyph atlas (`atlas.png`, laid out by `atlas-layout.js`).
- Rendering pauses when the cover is off screen or the tab is hidden, and the DPR is capped at 2.
- Without WebGPU, when the adapter fails, or with `prefers-reduced-motion`, the page keeps the static frame from `fallback-*.webp`. `?fallback=1` forces it.
- The theme follows `prefers-color-scheme` and `data-theme`, and switches live.

## Rebuild

`shaders.js`, `atlas.png`, and `fallback-*.webp` are generated and committed, since GitHub Pages runs no build. After changing the shader or the scene:

```bash
$ cd docs/cover
$ npm install
$ npm run build
```

`build/atlas.mjs` draws the JetBrains Mono glyph atlas, `build/prepare.mjs` prepares the shader, and `build/render.mjs` renders the fallback frames headlessly with `vgpu/node`. The build is reproducible: the same sources give byte-identical files on any machine.
