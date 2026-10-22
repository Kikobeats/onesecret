<!-- markdownlint-disable first-line-h1 -->

<div class="cover-hero" data-cover data-mode="loading" aria-labelledby="cover-title">
    <picture class="cover__still" aria-hidden="true">
      <source media="(max-width: 759px) and (prefers-color-scheme: light)" srcset="docs/cover/fallback-light-mobile.webp">
      <source media="(max-width: 759px)" srcset="docs/cover/fallback-dark-mobile.webp">
      <source media="(prefers-color-scheme: light)" srcset="docs/cover/fallback-light.webp">
      <img src="docs/cover/fallback-dark.webp" alt="" width="2880" height="1800" decoding="async" fetchpriority="high">
    </picture>
    <canvas class="cover__scene" aria-hidden="true"></canvas>
    <div class="cover__text" data-cover-text>
      <h1 class="cover__wordmark" id="cover-title">
        <img class="cover__logo" src="static/logo.svg" alt="" width="64" height="64">
        onesecret
      </h1>
      <p class="cover__tagline">Keep just one secret to decrypt the&nbsp;rest.</p>
      <div class="cover__install">
        <div class="cover__meta">
          <button type="button" class="cover__copy-prompt" data-copy-prompt data-prompt="Migrate this project to onesecret: run npx onesecret init (keep the printed key out of the repo), move plain settings to config/&lt;env&gt;.yml, encrypt each secret by piping its value into npx onesecret set --env &lt;env&gt; NAME, replace dotenv with require('onesecret').env(), and verify every value matches the old .env without printing it."><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg><span data-copy-prompt-label>Copy prompt</span></button>
        </div>
        <div class="cover__command">
          <code data-command>npm install onesecret</code>
          <button type="button" class="cover__copy" data-copy aria-label="Copy command">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg>
          </button>
        </div>
      </div>
      <nav class="cover__links" aria-label="Get started">
        <a class="cover__link cover__link--primary" href="#/?id=quick-start">Get started <span class="cover__arrow" aria-hidden="true">&rarr;</span></a>
        <a class="cover__link" href="https://github.com/Kikobeats/onesecret">
          <svg class="cover__mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
          GitHub
        </a>
      </nav>
    </div>
    <p class="cover__status" data-cover-status aria-hidden="true"><i class="cover__pulse"></i><span data-status-text>1 age key &rarr; 102 secrets</span></p>
  </div>
