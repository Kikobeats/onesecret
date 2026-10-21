'use strict'

require('onesecret').config()

const { DATABASE_URL, STRIPE_KEY, SESSION_SECRET } = process.env

console.log(`environment  ${process.env.NODE_ENV || 'development'}`)
console.log(`database     ${new URL(DATABASE_URL).host}`)
console.log(`stripe       ${STRIPE_KEY.slice(0, 8)}…`)
console.log(`session      ${SESSION_SECRET.length} characters`)
