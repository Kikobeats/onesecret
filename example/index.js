'use strict'

const config = require('onesecret').config()

console.log(`environment  ${process.env.NODE_ENV || 'development'}`)
console.log(`port         ${config.PORT}`)
console.log(`log level    ${config.LOG_LEVEL}`)
console.log(`timeout      ${config.REQ_TIMEOUT / 1000}s`)
console.log(`database     ${new URL(config.DATABASE_URL).host}`)
console.log(`stripe       ${config.STRIPE_KEY.slice(0, 8)}…`)
console.log(`session      ${config.SESSION_SECRET.length} characters`)
