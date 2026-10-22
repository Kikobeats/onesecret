'use strict'

const { default: test } = require('ava')

const FRAME_MS = 20
const MAX_FRAMES = 2000
const RANGE = [65, 90]

const seededRandom = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

const harness = ({ reducedMotion = false, ...options } = {}) => {
  const queue = new Map()
  let nextId = 1
  let time = 0
  const node = { textContent: '' }
  const frames = []
  let ended = 0
  const scramble = import('../docs/cover/scramble.js').then(
    ({ createScramble }) =>
      createScramble(node, {
        random: seededRandom(42),
        requestFrame: callback => {
          queue.set(nextId, callback)
          return nextId++
        },
        cancelFrame: id => queue.delete(id),
        reducedMotion,
        onAnimationFrame: result => frames.push(result),
        onAnimationEnd: () => ended++,
        ...options
      })
  )
  const run = () => {
    for (let i = 0; i < MAX_FRAMES && queue.size > 0; i++) {
      time += FRAME_MS
      const pending = [...queue.values()]
      queue.clear()
      pending.forEach(callback => callback(time))
    }
  }
  return {
    node,
    frames,
    scramble,
    run,
    ended: () => ended,
    pending: () => queue.size
  }
}

test('scrambles through characters from the range and settles on the text', async t => {
  const text = 'Keep just one secret to decrypt the rest.'
  const h = harness({ range: RANGE, scramble: 4, seed: 2 })
  const scramble = await h.scramble
  scramble.play(text)
  h.run()
  t.is(h.node.textContent, text)
  t.is(h.ended(), 1)
  t.is(h.pending(), 0)
  const noise = h.frames.flatMap(frame =>
    [...frame].filter((char, i) => char !== text[i])
  )
  t.true(noise.length > 0)
  t.true(
    noise.every(
      char =>
        char === '_' ||
        (char.charCodeAt(0) >= RANGE[0] && char.charCodeAt(0) <= RANGE[1])
    )
  )
})

test('never scrambles ignored characters', async t => {
  const text = 'one key many secrets'
  const h = harness({ range: RANGE, overdrive: false, scramble: 5 })
  const scramble = await h.scramble
  scramble.play(text)
  h.run()
  for (const frame of h.frames) {
    ;[...frame].forEach((char, i) => {
      if (text[i] === ' ') t.is(char, ' ')
    })
  }
  t.is(h.node.textContent, text)
})

test('reduced motion shows the text on the first drawn frame', async t => {
  const text = 'npm install onesecret'
  const h = harness({ reducedMotion: true, scramble: 6 })
  const scramble = await h.scramble
  scramble.play(text)
  h.run()
  t.deepEqual(h.frames, [text])
  t.is(h.ended(), 1)
})

test('playing a new text morphs from the previous one', async t => {
  const h = harness({ range: RANGE, overdrive: false, step: 2, scramble: 3 })
  const scramble = await h.scramble
  scramble.show('npm install onesecret')
  scramble.play("require('onesecret').env()")
  h.run()
  t.is(h.node.textContent, "require('onesecret').env()")
  t.is(h.frames[0].length > 0, true)
  scramble.play('npx onesecret init')
  h.run()
  t.is(h.node.textContent, 'npx onesecret init')
})

test('writes text, never markup', async t => {
  const text = '<img src=x onerror=alert(1)>'
  const h = harness({ range: RANGE })
  const scramble = await h.scramble
  scramble.play(text)
  h.run()
  t.is(h.node.textContent, text)
})

test('show sets the text at once and cancel stops the animation', async t => {
  const h = harness({ range: RANGE, scramble: 8 })
  const scramble = await h.scramble
  scramble.show('ready')
  t.is(h.node.textContent, 'ready')
  t.is(h.pending(), 0)
  scramble.play('decrypting secrets')
  t.is(h.pending(), 1)
  scramble.cancel()
  t.is(h.pending(), 0)
  t.is(h.ended(), 0)
})
