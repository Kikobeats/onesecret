'use strict'

const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const { default: test } = require('ava')

const ROOT = join(__dirname, '..')
const README = readFileSync(join(ROOT, 'README.md'), 'utf8')
const STYLE = readFileSync(join(ROOT, 'docs/css/style.css'), 'utf8')
const BUILT = readFileSync(join(ROOT, 'static/style.min.css'), 'utf8')

const compact = text => text.replace(/\s+/g, '')

const DEPLOY_SECTION = README.slice(
  README.indexOf('## Deploy'),
  README.indexOf('## How it works')
)
const SUMMARY =
  /<summary( data-logo="([^"]+)")?><strong>([^<]+)<\/strong><\/summary>/g

const summaries = [...DEPLOY_SECTION.matchAll(SUMMARY)].map(
  ([, , logo, title]) => ({ logo, title })
)

test('every deploy recipe has a logo', t => {
  t.true(summaries.length > 0)
  t.deepEqual(
    summaries.filter(({ logo }) => !logo).map(({ title }) => title),
    []
  )
})

test('every logo has its icon file and its style rule', t => {
  t.true(compact(STYLE).includes('mask:var(--logo)'))
  t.true(compact(BUILT).includes('mask:var(--logo)'))
  for (const { logo } of summaries.filter(({ logo }) => logo)) {
    t.true(
      existsSync(join(ROOT, `static/providers/${logo}.svg`)),
      `static/providers/${logo}.svg is missing`
    )
    t.true(
      STYLE.includes(
        `summary[data-logo='${logo}'] {\n  --logo: url('providers/${logo}.svg');`
      ),
      `no style rule for ${logo}`
    )
    t.true(
      compact(BUILT).includes(`providers/${logo}.svg`),
      `built stylesheet has no icon for ${logo}`
    )
  }
})

test('an open recipe icon follows hover and keyboard focus', t => {
  t.true(
    STYLE.includes(
      '.markdown-section details[open] > summary[data-logo]:hover strong::before'
    )
  )
  t.true(
    compact(BUILT).includes(
      'details[open]>summary[data-logo]:focus-visiblestrong:before'
    )
  )
})
