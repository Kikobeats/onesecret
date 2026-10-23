'use strict'

const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const { default: test } = require('ava')

const ROOT = join(__dirname, '..')
const README = readFileSync(join(ROOT, 'README.md'), 'utf8')
const STYLE = readFileSync(join(ROOT, 'docs/css/style.css'), 'utf8')

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
  }
})
