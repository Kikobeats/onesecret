#!/usr/bin/env node
'use strict'

const { run } = require('../src/cli')

run(process.argv.slice(2))
  .then(({ stdout, exitCode = 0 }) => {
    if (stdout) console.log(stdout)
    process.exitCode = exitCode
  })
  .catch(error => {
    console.error(error.code ? error.message : error)
    process.exitCode = 1
  })
