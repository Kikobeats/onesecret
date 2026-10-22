#!/usr/bin/env node
'use strict'

const { render, run } = require('../src/cli')

run(process.argv.slice(2))
  .then(result => {
    process.stdout.write(render(result, process.stdout.isTTY))
    process.exitCode = result.exitCode ?? 0
  })
  .catch(error => {
    console.error(error.code ? error.message : error)
    process.exitCode = 1
  })
