import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolveShader } from '@vgpu/wgsl/runtime'
import { prepareShader } from '@vgpu/wgsl/prepare'

const root = fileURLToPath(new URL('../', import.meta.url))
const entry = fileURLToPath(new URL('../shaders/lens.wgsl', import.meta.url))
const resolved = await resolveShader({ entry })
const MODULE_PREFIX = /_vgsl_[0-9a-f]{8}__/g

const portableText = text => {
  const stable = new Map()
  return text
    .replaceAll(root, '')
    .replace(MODULE_PREFIX, prefix => {
      if (!stable.has(prefix)) stable.set(prefix, `_vgsl_m${stable.size}__`)
      return stable.get(prefix)
    })
}

const portable = JSON.parse(portableText(JSON.stringify(resolved)))
const prepared = prepareShader(portable, 'shaders/lens.wgsl')

const module = `const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export const lensShader = deepFreeze(${JSON.stringify(prepared)});
`
await writeFile(new URL('../shaders.js', import.meta.url), module)
console.log(`shaders.js written, wgsl ${prepared.wgsl.length} chars, checksum ${prepared.sourceChecksum}`)
