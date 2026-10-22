const DEFAULTS = Object.freeze({
  speed: 1,
  seed: 1,
  step: 1,
  tick: 1,
  scramble: 1,
  chance: 1,
  overflow: true,
  range: [65, 125],
  overdrive: true,
  ignore: [' ']
})

const UNDERSCORE = 95
const FRAMES_PER_SECOND = 60

export function createScramble (node, options = {}) {
  const random = options.random ?? Math.random
  const requestFrame =
    options.requestFrame ?? (callback => window.requestAnimationFrame(callback))
  const cancelFrame =
    options.cancelFrame ?? (id => window.cancelAnimationFrame(id))
  const reducedMotion =
    options.reducedMotion ??
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let settings = { ...DEFAULTS, ...options }
  let text = ''
  let control = []
  let scrambleIndex = 0
  let stepCount = 0
  let overdriveIndex = 0
  let elapsed = 0
  let frame = 0

  const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min

  const randomChar = () => {
    const { range } = settings
    return String.fromCharCode(
      range.length === 2
        ? randomInt(range[0], range[1])
        : range[randomInt(0, range.length - 1)]
    )
  }

  const unlessIgnored = (value, replacement) =>
    settings.ignore.includes(`${value}`) ? value : replacement

  const scrambles = () => randomInt(0, 10) >= (1 - settings.chance) * 10

  const seedForward = () => {
    if (scrambleIndex === text.length) return
    for (let i = 0; i < settings.seed; i++) {
      const index = randomInt(scrambleIndex, control.length)
      if (
        typeof control[index] !== 'number' &&
        typeof control[index] !== 'undefined'
      ) {
        control[index] = unlessIgnored(
          control[index],
          scrambles() ? settings.scramble || settings.seed : 0
        )
      }
    }
  }

  const stepForward = () => {
    for (let i = 0; i < settings.step; i++) {
      if (scrambleIndex < text.length) {
        control[scrambleIndex] = unlessIgnored(
          text[scrambleIndex],
          scrambles()
            ? settings.scramble + randomInt(0, Math.ceil(settings.scramble / 2))
            : 0
        )
        scrambleIndex++
      }
    }
  }

  const resizeControl = () => {
    if (text.length < control.length) {
      control.pop()
      control.splice(text.length, settings.step)
    }
    for (let i = 0; i < settings.step; i++) {
      if (control.length < text.length) {
        control.push(unlessIgnored(text[control.length], null))
      }
    }
  }

  const advanceOverdrive = () => {
    if (!settings.overdrive) return
    const fill = String.fromCharCode(
      typeof settings.overdrive === 'boolean' ? UNDERSCORE : settings.overdrive
    )
    for (let i = 0; i < settings.step; i++) {
      if (overdriveIndex < Math.max(control.length, text.length)) {
        control[overdriveIndex] = unlessIgnored(text[overdriveIndex], fill)
        overdriveIndex++
      }
    }
  }

  const draw = () => {
    let result = ''
    for (let i = 0; i < control.length; i++) {
      const value = control[i]
      if (typeof value === 'number' && value > 0) {
        result += randomChar()
        if (i <= scrambleIndex) control[i] = value - 1
      } else if (
        typeof value === 'string' &&
        (i >= text.length || i >= scrambleIndex)
      ) {
        result += value
      } else if (value === text[i] && i < scrambleIndex) {
        result += text[i]
      } else if (value === 0 && i < text.length) {
        result += text[i]
        control[i] = text[i]
      }
    }
    node.textContent = result
    settings.onAnimationFrame?.(result)
    if (result === text) {
      control.splice(text.length, control.length)
      cancelFrame(frame)
      frame = 0
      settings.onAnimationEnd?.()
    }
    stepCount++
  }

  const animate = time => {
    if (!settings.speed) return
    frame = requestFrame(animate)
    advanceOverdrive()
    if (time - elapsed > 1000 / (FRAMES_PER_SECOND * settings.speed)) {
      elapsed = time
      if (stepCount % settings.tick === 0) {
        stepForward()
        resizeControl()
        seedForward()
      }
      draw()
    }
  }

  const reset = () => {
    stepCount = 0
    scrambleIndex = 0
    overdriveIndex = 0
    if (!settings.overflow) control = new Array(text.length)
  }

  const applyReducedMotion = () => {
    if (!reducedMotion) return
    settings = { ...settings, step: text.length, chance: 0, overdrive: false }
  }

  const play = () => {
    cancelFrame(frame)
    reset()
    settings.onAnimationStart?.()
    frame = requestFrame(animate)
  }

  return {
    play (nextText = text) {
      text = nextText
      applyReducedMotion()
      play()
    },
    show (nextText) {
      cancelFrame(frame)
      frame = 0
      text = nextText
      control = text.split('')
      stepCount = scrambleIndex = overdriveIndex = text.length
      node.textContent = text
    },
    cancel () {
      cancelFrame(frame)
      frame = 0
    }
  }
}
