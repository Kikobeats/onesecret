const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

export const lensShader = deepFreeze({
  version: 2,
  wgsl: '// vgsl-module: shaders/lens.wgsl\nstruct _vgsl_m0__Params {\n  resolution: vec2f,\n  dpr: f32,\n  time: f32,\n  lens: vec4f,\n  theme: f32,\n  fontSize: f32,\n  scrim: vec2f,\n  reveal: f32,\n  drift: f32,\n  beam: f32,\n  rows: f32,\n  table: vec2f,\n  copy: vec2f,\n  fanEnd: f32,\n}\n\n@group(0) @binding(0) var<uniform> params: _vgsl_m0__Params;\n@group(0) @binding(1) var atlas: texture_2d<f32>;\n@group(0) @binding(2) var atlasSampler: sampler;\n@group(0) @binding(3) var lines: texture_2d<u32>;\n\nconst _vgsl_m0__ATLAS_SIZE = vec2f(368.0, 240.0);\nconst _vgsl_m0__ATLAS_CELL = vec2f(23.0, 40.0);\nconst _vgsl_m0__ATLAS_COLUMNS = 16u;\nconst _vgsl_m0__ATLAS_TEXELS_PER_EM = 25.0;\nconst _vgsl_m0__ATLAS_PAD = 4.0;\nconst _vgsl_m0__ATLAS_ASCENT_EM = 0.95;\nconst _vgsl_m0__ATLAS_SPREAD = 4.0;\n\nconst _vgsl_m0__CELL_EM = vec2f(0.6, 1.62);\nconst _vgsl_m0__BASELINE_EM = 1.08;\nconst _vgsl_m0__BLOCK_CELLS = 70;\nconst _vgsl_m0__TEXT_CELLS = 64;\nconst _vgsl_m0__LINE_COUNT = 16u;\nconst _vgsl_m0__PREFIX_ROW = 16u;\nconst _vgsl_m0__PREFIX_LENGTH = 20;\nconst _vgsl_m0__KEY_END_TEXEL = 64;\nconst _vgsl_m0__LINE_LENGTH_TEXEL = 65;\n\nconst _vgsl_m0__TABLE_KEY_COLUMNS = 14;\nconst _vgsl_m0__TABLE_CHARS = 36;\nconst _vgsl_m0__TABLE_PITCH_EM = 1.36;\nconst _vgsl_m0__TABLE_BASELINE_EM = 1.02;\n\nconst _vgsl_m0__KIND_NONE = 0u;\nconst _vgsl_m0__KIND_KEY = 1u;\nconst _vgsl_m0__KIND_CIPHER = 2u;\nconst _vgsl_m0__KIND_FRAME = 3u;\n\nconst _vgsl_m0__BOW_CENTER = vec2f(14.0, 32.0);\nconst _vgsl_m0__BOW_OUTER = 9.4;\nconst _vgsl_m0__BOW_INNER = 5.2;\nconst _vgsl_m0__SHAFT_LO = vec2f(19.6, 28.2);\nconst _vgsl_m0__SHAFT_HI = vec2f(64.0, 35.8);\nconst _vgsl_m0__TOOTH_A_LO = vec2f(47.5, 35.0);\nconst _vgsl_m0__TOOTH_A_HI = vec2f(52.3, 43.4);\nconst _vgsl_m0__TOOTH_B_LO = vec2f(56.3, 35.0);\nconst _vgsl_m0__TOOTH_B_HI = vec2f(61.0, 41.4);\nconst _vgsl_m0__OUTER_CORNER = 0.4;\nconst _vgsl_m0__KEY_CENTER = vec2f(34.3, 33.0);\nconst _vgsl_m0__TEXT_LO = vec2f(24.6, 29.3);\nconst _vgsl_m0__TEXT_HI = vec2f(62.6, 34.7);\n\nconst _vgsl_m0__SLAB_CORE = 0.9;\nconst _vgsl_m0__BEVEL = 0.8;\nconst _vgsl_m0__GLASS_IOR = 1.5;\nconst _vgsl_m0__GLASS_DISPERSION = 0.05;\nconst _vgsl_m0__TEXT_PLANE_DEPTH = 3.4;\nconst _vgsl_m0__INNER_STEPS = 12;\nconst _vgsl_m0__BOUNCES = 2;\nconst _vgsl_m0__REFRACT_MAX_PX = 44.0;\nconst _vgsl_m0__BACK_FACE_PARALLAX = vec2f(-0.5, 0.8);\n\nconst _vgsl_m0__SCRIM_FLOOR = 0.1;\nconst _vgsl_m0__SCRIM_RAMP_PX = 140.0;\nconst _vgsl_m0__MOBILE_SCRIM_RAMP_PX = 80.0;\nconst _vgsl_m0__FOCUS_REACH_UNITS = 7.5;\nconst _vgsl_m0__FOCUS_BOW_RADIUS_UNITS = 40.0;\nconst _vgsl_m0__FOCUS_TIP_X = 50.0;\nconst _vgsl_m0__FOCUS_TIP_FALLOFF_UNITS = 5.0;\nconst _vgsl_m0__FOCUS_ABOVE_Y = 28.0;\nconst _vgsl_m0__FOCUS_ABOVE_FALLOFF_UNITS = 4.0;\nconst _vgsl_m0__EDGE_FALLOFF_PX = 230.0;\nconst _vgsl_m0__LOCAL_VIGNETTE_PX = 120.0;\nconst _vgsl_m0__BEHIND_GLASS_FOCUS = 0.3;\nconst _vgsl_m0__DARK_BEHIND_GAIN = 1.3;\n\nconst _vgsl_m0__BEAM_IN = vec2f(-0.2588, 0.9659);\nconst _vgsl_m0__BEAM_BEND = -0.366;\nconst _vgsl_m0__BEAM_IN_HALF_UNITS = 1.7;\nconst _vgsl_m0__BEAM_IN_WIDEN = 0.014;\nconst _vgsl_m0__BEAM_IN_FADE_UNITS = 30.0;\nconst _vgsl_m0__BEAM_OUT_HALF_UNITS = 1.7;\nconst _vgsl_m0__BEAM_FAN_SPREAD = 0.34;\nconst _vgsl_m0__BEAM_OUT_MIN_UNITS = 6.0;\nconst _vgsl_m0__BEAM_MASK_GAP_PX = vec2f(14.0, 70.0);\nconst _vgsl_m0__TO_LIGHT_2D = vec2f(0.2588, -0.9659);\nconst _vgsl_m0__SHADOW_OFFSET_UNITS = vec2f(-1.2, 2.6);\nconst _vgsl_m0__HOT_GOLD = vec3f(1.0, 0.84, 0.5);\nconst _vgsl_m0__LIGHT_BLOOM = vec3f(1.0, 0.95, 0.84);\nconst _vgsl_m0__WARM_WHITE = vec3f(1.0, 0.96, 0.9);\nconst _vgsl_m0__DARK_LIME = vec3f(0.62, 0.96, 0.3);\nconst _vgsl_m0__DARK_TEAL = vec3f(0.1, 0.8, 0.88);\nconst _vgsl_m0__LIGHT_LIME = vec3f(0.42, 0.7, 0.08);\nconst _vgsl_m0__LIGHT_TEAL = vec3f(0.0, 0.46, 0.55);\nconst _vgsl_m0__LIGHT_SHAFT = vec3f(1.0, 0.972, 0.915);\nconst _vgsl_m0__LIGHT_SHAFT_EDGE = vec3f(0.93, 0.9, 0.84);\nconst _vgsl_m0__CONTACT_OFFSET_PX = 8.0;\nconst _vgsl_m0__CONTACT_FALLOFF_PX = 4.0;\nconst _vgsl_m0__CONTACT_TINT = vec3f(0.62, 0.74, 0.69);\nconst _vgsl_m0__LIGHT_CAUSTIC = vec3f(0.84, 0.98, 0.9);\nconst _vgsl_m0__LIGHT_BEVEL_SHADE = vec3f(0.7, 0.8, 0.77);\nconst _vgsl_m0__LIGHT_FAN_FILTER = 0.42;\nconst _vgsl_m0__LIGHT_BEHIND_FOCUS = 0.7;\nconst _vgsl_m0__LIGHT_BEHIND_GAIN = 1.25;\nconst _vgsl_m0__LIGHT_LOCAL_SHADE = 0.05;\nconst _vgsl_m0__LIGHT_BODY_TINT = vec3f(0.955, 0.975, 0.965);\nconst _vgsl_m0__TABLE_LEAD = 0.3;\n\nconst _vgsl_m0__DARK_BG = vec3f(0.059, 0.067, 0.059);\nconst _vgsl_m0__DARK_TEXT = vec3f(0.922, 0.914, 0.886);\nconst _vgsl_m0__DARK_MUTED = vec3f(0.659, 0.647, 0.608);\nconst _vgsl_m0__DARK_ACCENT = vec3f(0.239, 0.863, 0.592);\nconst _vgsl_m0__LIGHT_BG = vec3f(0.984, 0.980, 0.965);\nconst _vgsl_m0__LIGHT_TEXT = vec3f(0.086, 0.082, 0.059);\nconst _vgsl_m0__LIGHT_MUTED = vec3f(0.369, 0.361, 0.325);\nconst _vgsl_m0__LIGHT_ACCENT = vec3f(0.039, 0.455, 0.282);\n\nstruct _vgsl_m0__Palette {\n  bg: vec3f,\n  text: vec3f,\n  muted: vec3f,\n  accent: vec3f,\n}\n\nstruct _vgsl_m0__Glyph {\n  code: u32,\n  kind: u32,\n}\n\nstruct _vgsl_m0__Lens {\n  center: vec2f,\n  scale: f32,\n  angle: f32,\n}\n\nstruct _vgsl_m0__BeamSample {\n  incoming: f32,\n  outgoing: f32,\n  glowIn: f32,\n  glowOut: f32,\n  hot: f32,\n  hue: vec3f,\n}\n\nconst _vgsl_m0__NO_BEAM = _vgsl_m0__BeamSample(0.0, 0.0, 0.0, 0.0, 0.0, vec3f(0.0));\n\nfn _vgsl_m0__palette() -> _vgsl_m0__Palette {\n  let t = params.theme;\n  return _vgsl_m0__Palette(\n    mix(_vgsl_m0__DARK_BG, _vgsl_m0__LIGHT_BG, t),\n    mix(_vgsl_m0__DARK_TEXT, _vgsl_m0__LIGHT_TEXT, t),\n    mix(_vgsl_m0__DARK_MUTED, _vgsl_m0__LIGHT_MUTED, t),\n    mix(_vgsl_m0__DARK_ACCENT, _vgsl_m0__LIGHT_ACCENT, t),\n  );\n}\n\nfn _vgsl_m0__currentLens() -> _vgsl_m0__Lens {\n  return _vgsl_m0__Lens(params.lens.xy, params.lens.z * mix(0.94, 1.0, params.reveal), params.lens.w);\n}\n\nfn _vgsl_m0__hashU(value: u32) -> u32 {\n  var state = value * 747796405u + 2891336453u;\n  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;\n  return (word >> 22u) ^ word;\n}\n\nfn _vgsl_m0__hash2(a: i32, b: i32) -> u32 {\n  return _vgsl_m0__hashU(bitcast<u32>(a) ^ _vgsl_m0__hashU(bitcast<u32>(b) + 0x9e3779b9u));\n}\n\nfn _vgsl_m0__unitHash(value: u32) -> f32 {\n  return f32(value & 0xffffu) / 65535.0;\n}\n\nfn _vgsl_m0__valueNoise(p: vec2f) -> f32 {\n  let cell = floor(p);\n  let f = p - cell;\n  let u = f * f * (3.0 - 2.0 * f);\n  let c = vec2i(cell);\n  let a = _vgsl_m0__unitHash(_vgsl_m0__hash2(c.x, c.y));\n  let b = _vgsl_m0__unitHash(_vgsl_m0__hash2(c.x + 1, c.y));\n  let d = _vgsl_m0__unitHash(_vgsl_m0__hash2(c.x, c.y + 1));\n  let e = _vgsl_m0__unitHash(_vgsl_m0__hash2(c.x + 1, c.y + 1));\n  return mix(mix(a, b, u.x), mix(d, e, u.x), u.y);\n}\n\nfn _vgsl_m0__base64Code(index: u32) -> u32 {\n  let k = index & 63u;\n  if (k < 26u) { return 65u + k; }\n  if (k < 52u) { return 97u + k - 26u; }\n  if (k < 62u) { return 48u + k - 52u; }\n  if (k == 62u) { return 43u; }\n  return 47u;\n}\n\nfn _vgsl_m0__lineTexel(column: i32, row: u32) -> u32 {\n  return textureLoad(lines, vec2i(column, i32(row)), 0).r;\n}\n\nfn _vgsl_m0__rotate(v: vec2f, angle: f32) -> vec2f {\n  let c = cos(angle);\n  let s = sin(angle);\n  return vec2f(c * v.x - s * v.y, s * v.x + c * v.y);\n}\n\nfn _vgsl_m0__toKeySpace(position: vec2f, lens: _vgsl_m0__Lens) -> vec2f {\n  return _vgsl_m0__rotate(position - lens.center, -lens.angle) / lens.scale + _vgsl_m0__KEY_CENTER;\n}\n\nfn _vgsl_m0__fieldGlyph(cell: vec2i) -> _vgsl_m0__Glyph {\n  let shift = i32(_vgsl_m0__hashU(bitcast<u32>(cell.y) * 3u + 17u) % u32(_vgsl_m0__BLOCK_CELLS));\n  let shifted = cell.x + shift;\n  let block = i32(floor(f32(shifted) / f32(_vgsl_m0__BLOCK_CELLS)));\n  let column = shifted - block * _vgsl_m0__BLOCK_CELLS;\n  if (column >= _vgsl_m0__TEXT_CELLS) { return _vgsl_m0__Glyph(32u, _vgsl_m0__KIND_NONE); }\n\n  let lineSeed = _vgsl_m0__hash2(block, cell.y);\n  let line = lineSeed % _vgsl_m0__LINE_COUNT;\n  let keyEnd = i32(_vgsl_m0__lineTexel(_vgsl_m0__KEY_END_TEXEL, line));\n  if (column < keyEnd) { return _vgsl_m0__Glyph(_vgsl_m0__lineTexel(column, line), _vgsl_m0__KIND_KEY); }\n\n  let offset = column - keyEnd;\n  if (offset < _vgsl_m0__PREFIX_LENGTH) { return _vgsl_m0__Glyph(_vgsl_m0__lineTexel(offset, _vgsl_m0__PREFIX_ROW), _vgsl_m0__KIND_FRAME); }\n  let cipherEnd = min(_vgsl_m0__TEXT_CELLS, keyEnd + _vgsl_m0__PREFIX_LENGTH + 10 + i32(lineSeed >> 9u) % 24);\n  if (column < cipherEnd - 1) {\n    let cellSeed = _vgsl_m0__hash2(cell.x * 7 + 3, cell.y * 13 + 5);\n    let rate = 0.08 + 0.3 * _vgsl_m0__unitHash(cellSeed >> 3u);\n    let epoch = u32(floor(params.time * rate + _vgsl_m0__unitHash(cellSeed >> 11u) * 9.0));\n    return _vgsl_m0__Glyph(_vgsl_m0__base64Code(_vgsl_m0__hashU(cellSeed ^ (epoch * 0x85ebca6bu))), _vgsl_m0__KIND_CIPHER);\n  }\n  if (column == cipherEnd - 1) { return _vgsl_m0__Glyph(93u, _vgsl_m0__KIND_FRAME); }\n  return _vgsl_m0__Glyph(32u, _vgsl_m0__KIND_NONE);\n}\n\nfn _vgsl_m0__glyphSdf(code: u32, emX: f32, emUp: f32) -> f32 {\n  let index = min(max(code, 32u), 126u) - 32u;\n  let origin = vec2f(f32(index % _vgsl_m0__ATLAS_COLUMNS), f32(index / _vgsl_m0__ATLAS_COLUMNS)) * _vgsl_m0__ATLAS_CELL;\n  let local = vec2f(_vgsl_m0__ATLAS_PAD + emX * _vgsl_m0__ATLAS_TEXELS_PER_EM, _vgsl_m0__ATLAS_PAD + (_vgsl_m0__ATLAS_ASCENT_EM - emUp) * _vgsl_m0__ATLAS_TEXELS_PER_EM);\n  let texel = origin + clamp(local, vec2f(0.5), _vgsl_m0__ATLAS_CELL - vec2f(0.5));\n  return textureSampleLevel(atlas, atlasSampler, texel / _vgsl_m0__ATLAS_SIZE, 0.0).r;\n}\n\nfn _vgsl_m0__glyphCoverage(code: u32, emX: f32, emUp: f32, fontSize: f32, softness: f32) -> vec2f {\n  let sdf = _vgsl_m0__glyphSdf(code, emX, emUp);\n  let texelsPerPixel = _vgsl_m0__ATLAS_TEXELS_PER_EM / (fontSize * params.dpr);\n  let width = (0.5 / _vgsl_m0__ATLAS_SPREAD) * texelsPerPixel * 0.75 + softness;\n  return vec2f(smoothstep(0.5 - width, 0.5 + width, sdf), smoothstep(0.08, 0.5, sdf));\n}\n\nstruct _vgsl_m0__FieldSample {\n  coverage: f32,\n  kind: u32,\n  shade: f32,\n}\n\nfn _vgsl_m0__sampleField(position: vec2f, fontSize: f32, scroll: f32, softness: f32) -> _vgsl_m0__FieldSample {\n  let cellSize = _vgsl_m0__CELL_EM * fontSize;\n  let scrolled = position + vec2f(0.0, scroll);\n  let cellF = floor(scrolled / cellSize);\n  let cell = vec2i(cellF);\n  let glyph = _vgsl_m0__fieldGlyph(cell);\n  if (glyph.kind == _vgsl_m0__KIND_NONE) { return _vgsl_m0__FieldSample(0.0, _vgsl_m0__KIND_NONE, 0.0); }\n\n  let local = (scrolled - cellF * cellSize) / fontSize;\n  let seed = _vgsl_m0__hash2(cell.x * 31 + 7, cell.y * 17 + 11);\n  let jitter = (_vgsl_m0__unitHash(seed) - 0.5) * 0.12;\n  let shade = 0.55 + 0.45 * _vgsl_m0__unitHash(seed >> 5u);\n  let coverage = _vgsl_m0__glyphCoverage(glyph.code, local.x, _vgsl_m0__BASELINE_EM - local.y - jitter, fontSize, softness);\n  return _vgsl_m0__FieldSample(coverage.x, glyph.kind, shade);\n}\n\nfn _vgsl_m0__sdBox(p: vec2f, lo: vec2f, hi: vec2f, corner: f32) -> f32 {\n  let center = (lo + hi) * 0.5;\n  let half = (hi - lo) * 0.5 - vec2f(corner);\n  let q = abs(p - center) - half;\n  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - corner;\n}\n\nfn _vgsl_m0__sdKey(p: vec2f) -> f32 {\n  let ringMid = (_vgsl_m0__BOW_OUTER + _vgsl_m0__BOW_INNER) * 0.5;\n  let ringHalf = (_vgsl_m0__BOW_OUTER - _vgsl_m0__BOW_INNER) * 0.5;\n  let ring = abs(length(p - _vgsl_m0__BOW_CENTER) - ringMid) - ringHalf;\n  let shaft = _vgsl_m0__sdBox(p, _vgsl_m0__SHAFT_LO, _vgsl_m0__SHAFT_HI, _vgsl_m0__OUTER_CORNER);\n  let toothA = _vgsl_m0__sdBox(p, _vgsl_m0__TOOTH_A_LO, _vgsl_m0__TOOTH_A_HI, _vgsl_m0__OUTER_CORNER);\n  let toothB = _vgsl_m0__sdBox(p, _vgsl_m0__TOOTH_B_LO, _vgsl_m0__TOOTH_B_HI, _vgsl_m0__OUTER_CORNER);\n  return min(min(ring, shaft), min(toothA, toothB));\n}\n\nfn _vgsl_m0__keyGradient(p: vec2f, d: f32) -> vec2f {\n  let e = 0.03;\n  let g = vec2f(_vgsl_m0__sdKey(p + vec2f(e, 0.0)) - d, _vgsl_m0__sdKey(p + vec2f(0.0, e)) - d) / e;\n  return g / max(length(g), 1e-4);\n}\n\nfn _vgsl_m0__slabDistance(p: vec3f) -> f32 {\n  let w = vec2f(_vgsl_m0__sdKey(p.xy) + _vgsl_m0__BEVEL, abs(p.z) - _vgsl_m0__SLAB_CORE);\n  return min(max(w.x, w.y), 0.0) + length(max(w, vec2f(0.0))) - _vgsl_m0__BEVEL;\n}\n\nfn _vgsl_m0__slabNormal(p: vec3f) -> vec3f {\n  let e = vec2f(1.0, -1.0) * 0.012;\n  return normalize(\n    e.xyy * _vgsl_m0__slabDistance(p + e.xyy) +\n    e.yyx * _vgsl_m0__slabDistance(p + e.yyx) +\n    e.yxy * _vgsl_m0__slabDistance(p + e.yxy) +\n    e.xxx * _vgsl_m0__slabDistance(p + e.xxx)\n  );\n}\n\nfn _vgsl_m0__fieldWeight(position: vec2f, keyPoint: vec2f, keyDistance: f32, lens: _vgsl_m0__Lens) -> vec3f {\n  var scrim = 1.0;\n  if (params.scrim.x > 0.0) {\n    scrim = mix(_vgsl_m0__SCRIM_FLOOR, 1.0, smoothstep(params.scrim.x, params.scrim.x + _vgsl_m0__SCRIM_RAMP_PX, position.x));\n  }\n  if (params.scrim.y > 0.0) {\n    scrim = min(scrim, mix(_vgsl_m0__SCRIM_FLOOR, 1.0, smoothstep(params.scrim.y, params.scrim.y + _vgsl_m0__MOBILE_SCRIM_RAMP_PX, position.y)));\n  }\n  let reach = max(keyDistance, 0.0) / _vgsl_m0__FOCUS_REACH_UNITS;\n  let pastTip = max(keyPoint.x - _vgsl_m0__FOCUS_TIP_X, 0.0) / _vgsl_m0__FOCUS_TIP_FALLOFF_UNITS;\n  let above = max(_vgsl_m0__FOCUS_ABOVE_Y - keyPoint.y, 0.0) / _vgsl_m0__FOCUS_ABOVE_FALLOFF_UNITS;\n  let fromBow = length(keyPoint - _vgsl_m0__BOW_CENTER) / _vgsl_m0__FOCUS_BOW_RADIUS_UNITS;\n  let focus = exp(-reach * reach) * exp(-fromBow * fromBow) * exp(-pastTip * pastTip) * exp(-above * above);\n  let size = params.resolution / params.dpr;\n  let edge = min(min(position.x, size.x - position.x), min(position.y, size.y - position.y));\n  let vignette = smoothstep(0.0, _vgsl_m0__EDGE_FALLOFF_PX, edge);\n  return vec3f(scrim * focus * vignette, focus, scrim);\n}\n\nfn _vgsl_m0__beamMask(position: vec2f) -> f32 {\n  let right = smoothstep(_vgsl_m0__BEAM_MASK_GAP_PX.x, _vgsl_m0__BEAM_MASK_GAP_PX.y, position.x - params.copy.x);\n  let below = smoothstep(_vgsl_m0__BEAM_MASK_GAP_PX.x, _vgsl_m0__BEAM_MASK_GAP_PX.y, position.y - params.copy.y);\n  return max(right, below);\n}\n\nfn _vgsl_m0__perpendicular(v: vec2f) -> vec2f {\n  return vec2f(-v.y, v.x);\n}\n\nfn _vgsl_m0__bowCenterWorld(lens: _vgsl_m0__Lens) -> vec2f {\n  return lens.center + _vgsl_m0__rotate((_vgsl_m0__BOW_CENTER - _vgsl_m0__KEY_CENTER) * lens.scale, lens.angle);\n}\n\nfn _vgsl_m0__beamOutDirection() -> vec2f {\n  return _vgsl_m0__rotate(_vgsl_m0__BEAM_IN, _vgsl_m0__BEAM_BEND);\n}\n\nfn _vgsl_m0__beamEntry(lens: _vgsl_m0__Lens) -> vec2f {\n  return _vgsl_m0__bowCenterWorld(lens) - _vgsl_m0__BEAM_IN * (_vgsl_m0__BOW_OUTER * lens.scale);\n}\n\nfn _vgsl_m0__beamExit(lens: _vgsl_m0__Lens) -> vec2f {\n  return _vgsl_m0__bowCenterWorld(lens) + _vgsl_m0__rotate(_vgsl_m0__BEAM_IN, _vgsl_m0__BEAM_BEND * 0.5) * (_vgsl_m0__BOW_OUTER * lens.scale);\n}\n\nfn _vgsl_m0__beamHue(across: f32) -> vec3f {\n  let lime = mix(_vgsl_m0__DARK_LIME, _vgsl_m0__LIGHT_LIME, params.theme);\n  let teal = mix(_vgsl_m0__DARK_TEAL, _vgsl_m0__LIGHT_TEAL, params.theme);\n  let accent = mix(_vgsl_m0__DARK_ACCENT, _vgsl_m0__LIGHT_ACCENT, params.theme);\n  let fringe = smoothstep(0.55, 1.1, abs(across)) * 0.8;\n  return mix(accent, select(teal, lime, across < 0.0), fringe);\n}\n\nfn _vgsl_m0__incomingShaft(position: vec2f, lens: _vgsl_m0__Lens) -> vec2f {\n  let rel = (position - _vgsl_m0__beamEntry(lens)) / lens.scale;\n  let along = dot(rel, _vgsl_m0__BEAM_IN);\n  if (along > 0.6) { return vec2f(0.0); }\n  let across = dot(rel, _vgsl_m0__perpendicular(_vgsl_m0__BEAM_IN));\n  let upstream = max(-along, 0.0);\n  let x = across / (_vgsl_m0__BEAM_IN_HALF_UNITS * (1.0 + upstream * _vgsl_m0__BEAM_IN_WIDEN));\n  let nearGlass = mix(0.45, 1.0, exp(along / _vgsl_m0__BEAM_IN_FADE_UNITS));\n  let streaks = _vgsl_m0__valueNoise(vec2f(across * 0.9, along * 0.035 - params.time * 0.08));\n  let motes = _vgsl_m0__valueNoise(vec2f(across * 2.3, along * 0.5 - params.time * 0.9));\n  let cap = smoothstep(0.6, -0.4, along);\n  let core = exp(-x * x * 0.9) * (0.82 + 0.18 * streaks);\n  let scatter = exp(-x * x * 0.14) * (0.12 + 0.12 * streaks) + exp(-x * x * 0.025) * 0.035 + exp(-x * x * 0.3) * pow(motes, 6.0) * 0.5;\n  return vec2f(core, scatter) * nearGlass * cap;\n}\n\nfn _vgsl_m0__entryBloom(position: vec2f, lens: _vgsl_m0__Lens) -> f32 {\n  let rel = (position - _vgsl_m0__beamEntry(lens)) / lens.scale;\n  let r2 = dot(rel, rel);\n  let tangent = dot(rel, _vgsl_m0__perpendicular(_vgsl_m0__BEAM_IN));\n  let normal = dot(rel, _vgsl_m0__BEAM_IN);\n  let streak = exp(-abs(tangent) / 4.5) * exp(-normal * normal / 0.05);\n  return exp(-r2 * 0.6) + 0.32 * exp(-sqrt(r2) * 0.42) + 0.45 * streak;\n}\n\nfn _vgsl_m0__fanLength(lens: _vgsl_m0__Lens, direction: vec2f) -> f32 {\n  return max((params.fanEnd - _vgsl_m0__beamExit(lens).y) / (lens.scale * max(direction.y, 0.2)), _vgsl_m0__BEAM_OUT_MIN_UNITS);\n}\n\nfn _vgsl_m0__outgoingFan(position: vec2f, lens: _vgsl_m0__Lens) -> vec4f {\n  let direction = _vgsl_m0__beamOutDirection();\n  let rel = (position - _vgsl_m0__beamExit(lens)) / lens.scale;\n  let along = dot(rel, direction);\n  if (along < -1.5) { return vec4f(0.0); }\n  let across = dot(rel, _vgsl_m0__perpendicular(direction));\n  let travelled = max(along, 0.0);\n  let half = _vgsl_m0__BEAM_OUT_HALF_UNITS + travelled * _vgsl_m0__BEAM_FAN_SPREAD;\n  let x = across / half;\n  if (abs(x) > 6.0) { return vec4f(0.0); }\n  let lengthUnits = _vgsl_m0__fanLength(lens, direction);\n  let fade = 1.0 - smoothstep(lengthUnits * 0.3, lengthUnits, travelled);\n  let thinning = 1.0 / (1.0 + travelled * 0.05);\n  let body = exp(-x * x * 2.0) * mix(0.55, 1.0, thinning);\n  let core = exp(-x * x * 11.0) * thinning;\n  let start = smoothstep(-1.5, 1.2, along);\n  let energy = start * fade;\n  let fan = (body * 1.1 + core * 0.6) * energy;\n  let glow = exp(-x * x * 0.35) * 0.18 * energy;\n  return vec4f(fan, glow, x, core * energy);\n}\n\nfn _vgsl_m0__beamAt(position: vec2f, lens: _vgsl_m0__Lens) -> _vgsl_m0__BeamSample {\n  if (params.beam <= 0.0) { return _vgsl_m0__NO_BEAM; }\n  let strength = params.beam * _vgsl_m0__beamMask(position) * (1.0 - params.theme);\n  if (strength <= 0.0) { return _vgsl_m0__NO_BEAM; }\n  let shaft = _vgsl_m0__incomingShaft(position, lens);\n  let fan = _vgsl_m0__outgoingFan(position, lens);\n  return _vgsl_m0__BeamSample(\n    shaft.x * strength,\n    fan.x * strength,\n    shaft.y * strength,\n    fan.y * strength,\n    _vgsl_m0__entryBloom(position, lens) * strength,\n    mix(_vgsl_m0__beamHue(fan.z), vec3f(0.85, 1.0, 0.92), fan.w * (1.0 - params.theme) * 0.5),\n  );\n}\n\nfn _vgsl_m0__outsideInk(kind: u32, colors: _vgsl_m0__Palette) -> vec4f {\n  let light = params.theme;\n  if (kind == _vgsl_m0__KIND_KEY) { return vec4f(colors.muted, mix(0.32, 0.24, light)); }\n  if (kind == _vgsl_m0__KIND_FRAME) { return vec4f(colors.muted, mix(0.19, 0.13, light)); }\n  return vec4f(mix(colors.muted, colors.accent, 0.2), mix(0.24, 0.16, light));\n}\n\nfn _vgsl_m0__encryptedColor(position: vec2f, colors: _vgsl_m0__Palette, strengthIn: f32, focus: f32, beam: _vgsl_m0__BeamSample, gain: f32) -> vec3f {\n  var color = colors.bg;\n  let warmLit = beam.incoming * 0.8 + beam.glowIn * 0.6 + beam.hot * 0.5;\n  let greenLit = beam.outgoing + beam.glowOut * 0.6;\n  let lit = warmLit + greenLit;\n  let strength = strengthIn + lit * 0.6;\n  if (strength < 0.01) { return color; }\n  let defocus = (1.0 - focus) * 0.1;\n  let front = _vgsl_m0__sampleField(position, params.fontSize, params.drift, defocus);\n  if (front.kind == _vgsl_m0__KIND_NONE) { return color; }\n  let ink = _vgsl_m0__outsideInk(front.kind, colors);\n  let warmInk = mix(_vgsl_m0__WARM_WHITE, vec3f(0.42, 0.36, 0.26), params.theme);\n  let beamInk = (warmInk * warmLit + beam.hue * greenLit) / max(lit, 1e-3);\n  let tinted = mix(ink.rgb, beamInk, clamp(lit * 1.4, 0.0, 0.9));\n  return mix(color, tinted, clamp(front.coverage * front.shade * ink.a * strength * gain * (1.0 + lit), 0.0, 1.0));\n}\n\nfn _vgsl_m0__beamLight(colorIn: vec3f, beam: _vgsl_m0__BeamSample, colors: _vgsl_m0__Palette) -> vec3f {\n  let dark = _vgsl_m0__WARM_WHITE * (beam.incoming * 0.36 + beam.glowIn * 0.5)\n    + beam.hue * (beam.outgoing * 0.62) + colors.accent * beam.glowOut * 0.16;\n  let darkLit = colorIn + dark;\n  let shaftEdge = clamp(beam.glowIn * 1.4, 0.0, 1.0) * (1.0 - clamp(beam.incoming, 0.0, 1.0));\n  var lightLit = mix(colorIn, colorIn * _vgsl_m0__LIGHT_SHAFT_EDGE, shaftEdge * 0.12);\n  lightLit = mix(lightLit, _vgsl_m0__LIGHT_SHAFT, clamp(beam.incoming * 0.7, 0.0, 0.7));\n  let fanFilter = mix(vec3f(1.0), beam.hue, _vgsl_m0__LIGHT_FAN_FILTER);\n  lightLit *= mix(vec3f(1.0), fanFilter, clamp(beam.outgoing + beam.glowOut * 0.5, 0.0, 1.0));\n  return mix(darkLit, lightLit, params.theme);\n}\n\nstruct _vgsl_m0__TableCell {\n  code: u32,\n  isKey: bool,\n  emX: f32,\n  emUp: f32,\n  font: f32,\n  reveal: f32,\n  seed: u32,\n}\n\nfn _vgsl_m0__tableCell(localPx: vec2f, lens: _vgsl_m0__Lens) -> _vgsl_m0__TableCell {\n  let empty = _vgsl_m0__TableCell(32u, false, 0.0, 0.0, 1.0, 0.0, 0u);\n  let rows = max(params.rows, 1.0);\n  let regionLo = (_vgsl_m0__TEXT_LO - _vgsl_m0__KEY_CENTER) * lens.scale;\n  let regionHi = (_vgsl_m0__TEXT_HI - _vgsl_m0__KEY_CENTER) * lens.scale;\n  let region = regionHi - regionLo;\n  let font = min(region.y / (rows * _vgsl_m0__TABLE_PITCH_EM), region.x / (f32(_vgsl_m0__TABLE_CHARS) * _vgsl_m0__CELL_EM.x));\n  let cell = vec2f(_vgsl_m0__CELL_EM.x, _vgsl_m0__TABLE_PITCH_EM) * font;\n  let size = vec2f(f32(_vgsl_m0__TABLE_CHARS), rows) * cell;\n  let p = localPx - (regionLo + (region - size) * vec2f(_vgsl_m0__TABLE_LEAD, 0.5));\n  if (p.x < 0.0 || p.y < 0.0 || p.x >= size.x || p.y >= size.y) { return empty; }\n\n  let cellF = floor(p / cell);\n  let column = i32(cellF.x);\n  let slot = i32(cellF.y);\n  let line = u32((i32(params.table.x) * i32(rows) + slot) % i32(_vgsl_m0__LINE_COUNT));\n  let keyEnd = i32(_vgsl_m0__lineTexel(_vgsl_m0__KEY_END_TEXEL, line));\n  let lineLength = i32(_vgsl_m0__lineTexel(_vgsl_m0__LINE_LENGTH_TEXEL, line));\n  let index = column - (_vgsl_m0__TABLE_KEY_COLUMNS + 2 - keyEnd);\n  if (index < 0 || index >= lineLength) { return empty; }\n  let code = _vgsl_m0__lineTexel(index, line);\n  if (code == 32u) { return empty; }\n\n  let local = (p - cellF * cell) / font;\n  let columnT = (f32(column) + 0.5) / f32(_vgsl_m0__TABLE_CHARS);\n  let reveal = params.table.y * 1.3 - 0.3 * f32(slot) / rows - columnT;\n  return _vgsl_m0__TableCell(code, index < keyEnd, local.x, _vgsl_m0__TABLE_BASELINE_EM - local.y, font, reveal, _vgsl_m0__hash2(column * 7 + 1, slot * 13 + i32(line)));\n}\n\nfn _vgsl_m0__tableInk(localPx: vec2f, lens: _vgsl_m0__Lens, colors: _vgsl_m0__Palette, interior: vec3f) -> vec3f {\n  let cell = _vgsl_m0__tableCell(localPx, lens);\n  if (cell.code == 32u) { return interior; }\n  let dark = 1.0 - params.theme;\n  if (cell.reveal > 0.0) {\n    let coverage = _vgsl_m0__glyphCoverage(cell.code, cell.emX, cell.emUp, cell.font, 0.0);\n    let flash = exp(-cell.reveal * 40.0);\n    if (cell.isKey) {\n      let keyInk = mix(colors.text, colors.accent, flash);\n      return mix(interior, keyInk, coverage.x * mix(0.82, 0.86, params.theme));\n    }\n    let valueInk = mix(colors.accent * 1.08 + _vgsl_m0__WARM_WHITE * flash * 0.6, colors.accent, params.theme);\n    let glow = interior + colors.accent * coverage.y * 0.16 * dark;\n    return mix(glow, valueInk, coverage.x);\n  }\n  let tick = u32(params.time * 14.0);\n  let cipher = _vgsl_m0__base64Code(_vgsl_m0__hashU(cell.seed + tick * 2654435761u));\n  let coverage = _vgsl_m0__glyphCoverage(cipher, cell.emX, cell.emUp, cell.font, 0.02);\n  return mix(interior, mix(colors.muted, colors.accent, 0.55), coverage.x * 0.55);\n}\n\nfn _vgsl_m0__fresnel(cosine: f32) -> f32 {\n  return 0.04 + 0.96 * pow(clamp(1.0 - cosine, 0.0, 1.0), 5.0);\n}\n\nfn _vgsl_m0__environment(direction: vec3f, colors: _vgsl_m0__Palette, toLight: vec3f) -> vec3f {\n  let alignment = max(dot(direction, toLight), 0.0);\n  let horizon = 1.0 - abs(direction.z);\n  let darkSky = colors.bg * 0.5 + vec3f(0.42, 0.48, 0.45) * pow(horizon, 3.0) + _vgsl_m0__WARM_WHITE * (pow(alignment, 30.0) * 1.6 + pow(alignment, 5.0) * 0.14);\n  let lightSky = mix(colors.bg * vec3f(0.86, 0.93, 0.9), colors.text, 0.05 + 0.38 * pow(horizon, 2.0)) + vec3f(pow(alignment, 30.0) * 0.6);\n  return mix(darkSky, lightSky, params.theme);\n}\n\nstruct _vgsl_m0__GlassExit {\n  shift: vec2f,\n  shiftRed: vec2f,\n  shiftBlue: vec2f,\n  path: f32,\n  trapped: f32,\n}\n\nfn _vgsl_m0__exitShift(position: vec3f, direction: vec3f) -> vec2f {\n  let floorZ = -(_vgsl_m0__SLAB_CORE + _vgsl_m0__BEVEL) - _vgsl_m0__TEXT_PLANE_DEPTH;\n  let travel = (floorZ - position.z) / min(direction.z, -0.05);\n  return position.xy + direction.xy * travel;\n}\n\nfn _vgsl_m0__traceGlass(entry: vec3f, normal: vec3f) -> _vgsl_m0__GlassExit {\n  var direction = refract(vec3f(0.0, 0.0, -1.0), normal, 1.0 / _vgsl_m0__GLASS_IOR);\n  var position = entry + direction * 0.01;\n  var path = 0.0;\n  var trapped = 0.0;\n  for (var bounce = 0; bounce < _vgsl_m0__BOUNCES; bounce += 1) {\n    var travel = 0.0;\n    for (var step = 0; step < _vgsl_m0__INNER_STEPS; step += 1) {\n      let distance = -_vgsl_m0__slabDistance(position + direction * travel);\n      if (distance < 0.003) { break; }\n      travel += max(distance, 0.02);\n    }\n    path += travel;\n    position += direction * travel;\n    let exitNormal = -_vgsl_m0__slabNormal(position);\n    let green = refract(direction, exitNormal, _vgsl_m0__GLASS_IOR);\n    if (dot(green, green) < 0.5) {\n      direction = reflect(direction, exitNormal);\n      position += direction * 0.01;\n      trapped += 1.0;\n      continue;\n    }\n    let red = refract(direction, exitNormal, _vgsl_m0__GLASS_IOR - _vgsl_m0__GLASS_DISPERSION);\n    let blue = refract(direction, exitNormal, _vgsl_m0__GLASS_IOR + _vgsl_m0__GLASS_DISPERSION);\n    return _vgsl_m0__GlassExit(\n      _vgsl_m0__exitShift(position, green) - entry.xy,\n      _vgsl_m0__exitShift(position, select(green, red, dot(red, red) > 0.5)) - entry.xy,\n      _vgsl_m0__exitShift(position, select(green, blue, dot(blue, blue) > 0.5)) - entry.xy,\n      path,\n      trapped,\n    );\n  }\n  let fallback = position.xy - entry.xy;\n  return _vgsl_m0__GlassExit(fallback, fallback, fallback, path, trapped);\n}\n\nfn _vgsl_m0__refractedField(position: vec2f, shiftUnits: vec2f, lens: _vgsl_m0__Lens, colors: _vgsl_m0__Palette, weight: vec3f) -> vec3f {\n  var shift = _vgsl_m0__rotate(shiftUnits * lens.scale, lens.angle);\n  let length2 = dot(shift, shift);\n  if (length2 > _vgsl_m0__REFRACT_MAX_PX * _vgsl_m0__REFRACT_MAX_PX) { shift *= _vgsl_m0__REFRACT_MAX_PX / sqrt(length2); }\n  return _vgsl_m0__encryptedColor(position + shift, colors, min(1.0, weight.x * 2.4 + 0.3), 1.0, _vgsl_m0__NO_BEAM, mix(1.7, 3.2, params.theme));\n}\n\nfn _vgsl_m0__glassInterior(position: vec2f, colors: _vgsl_m0__Palette, d: f32, keyPoint: vec2f, lens: _vgsl_m0__Lens) -> vec3f {\n  let dark = 1.0 - params.theme;\n  let depth = -d - _vgsl_m0__BEVEL;\n  let magnified = position - (position - lens.center) * 0.08 + _vgsl_m0__rotate(vec2f(0.0, -0.9), lens.angle) * lens.scale;\n  let behind = _vgsl_m0__encryptedColor(magnified, colors, 1.0, mix(_vgsl_m0__BEHIND_GLASS_FOCUS, _vgsl_m0__LIGHT_BEHIND_FOCUS, params.theme), _vgsl_m0__NO_BEAM, mix(_vgsl_m0__DARK_BEHIND_GAIN, _vgsl_m0__LIGHT_BEHIND_GAIN, params.theme));\n  let darkBody = behind * vec3f(0.84, 0.97, 0.9) + colors.accent * (0.008 + 0.04 * exp(-max(depth, 0.0) / 0.9));\n  let lightBody = behind * _vgsl_m0__LIGHT_BODY_TINT;\n  var body = mix(lightBody, darkBody, dark);\n\n  let parallax = _vgsl_m0__rotate(_vgsl_m0__BACK_FACE_PARALLAX, -lens.angle);\n  let back = _vgsl_m0__sdKey(keyPoint - parallax) + _vgsl_m0__BEVEL * 0.5;\n  let backEdge = exp(-pow(back / (1.1 / lens.scale + 0.06), 2.0));\n  let backInk = mix(colors.text * 0.55, colors.accent * 0.55 + vec3f(0.04), dark);\n  body = mix(body, backInk, backEdge * mix(0.3, 0.4, dark));\n  return body;\n}\n\nfn _vgsl_m0__glassColor(position: vec2f, keyPoint: vec2f, d: f32, gradientKey: vec2f, lens: _vgsl_m0__Lens, colors: _vgsl_m0__Palette, beam: _vgsl_m0__BeamSample, weight: vec3f) -> vec3f {\n  let localPx = (keyPoint - _vgsl_m0__KEY_CENTER) * lens.scale;\n  let dark = 1.0 - params.theme;\n  let interior = _vgsl_m0__glassInterior(position, colors, d, keyPoint, lens);\n\n  var normal = vec3f(0.0, 0.0, 1.0);\n  var entryZ = _vgsl_m0__SLAB_CORE + _vgsl_m0__BEVEL;\n  let bevelOffset = d + _vgsl_m0__BEVEL;\n  if (bevelOffset > 0.0) {\n    let e = min(bevelOffset, _vgsl_m0__BEVEL * 0.999);\n    let lift = sqrt(_vgsl_m0__BEVEL * _vgsl_m0__BEVEL - e * e);\n    entryZ = _vgsl_m0__SLAB_CORE + lift;\n    normal = normalize(vec3f(gradientKey * e, lift));\n  }\n\n  var transmitted: vec3f;\n  var path = 2.0 * (_vgsl_m0__SLAB_CORE + _vgsl_m0__BEVEL);\n  var trapped = 0.0;\n  if (bevelOffset > 0.0) {\n    let exit = _vgsl_m0__traceGlass(vec3f(keyPoint, entryZ), normal);\n    path = exit.path;\n    trapped = exit.trapped;\n    let red = _vgsl_m0__refractedField(position, exit.shiftRed, lens, colors, weight);\n    let green = _vgsl_m0__refractedField(position, exit.shift, lens, colors, weight);\n    let blue = _vgsl_m0__refractedField(position, exit.shiftBlue, lens, colors, weight);\n    let field = vec3f(red.r, green.g, blue.b);\n    let band = smoothstep(0.0, _vgsl_m0__BEVEL * 0.35, bevelOffset);\n    transmitted = mix(interior, mix(field * vec3f(0.9, 1.0, 0.96), field, params.theme), band);\n  } else {\n    transmitted = _vgsl_m0__tableInk(localPx, lens, colors, interior);\n  }\n\n  let tint = mix(vec3f(0.88, 1.0, 0.94), vec3f(0.965, 0.99, 0.977), params.theme);\n  transmitted *= pow(tint, vec3f(path * 0.25));\n\n  let worldNormal = vec3f(_vgsl_m0__rotate(normal.xy, lens.angle), normal.z);\n  let toLight = normalize(vec3f(_vgsl_m0__TO_LIGHT_2D, 0.75));\n  let reflected = reflect(vec3f(0.0, 0.0, -1.0), worldNormal);\n  var color = mix(transmitted, _vgsl_m0__environment(reflected, colors, toLight), _vgsl_m0__fresnel(worldNormal.z));\n\n  let beamOnGlass = clamp(max(max(beam.incoming, beam.outgoing), beam.hot), 0.0, 1.0);\n  let spread = 0.04;\n  let glint = vec3f(\n    pow(max(dot(reflected, normalize(toLight + vec3f(-spread, 0.0, 0.0))), 0.0), 160.0),\n    pow(max(dot(reflected, toLight), 0.0), 160.0),\n    pow(max(dot(reflected, normalize(toLight + vec3f(spread, 0.0, 0.0))), 0.0), 160.0),\n  );\n  color += _vgsl_m0__WARM_WHITE * glint * mix(1.2, 0.8, params.theme) * (0.5 + 1.2 * beamOnGlass);\n\n  let outward = _vgsl_m0__rotate(gradientKey, lens.angle);\n  let facing = dot(outward, _vgsl_m0__TO_LIGHT_2D);\n  let inset = -d;\n  let streakLine = exp(-pow((inset - _vgsl_m0__BEVEL * 0.32) / (_vgsl_m0__BEVEL * mix(0.16, 0.2, params.theme)), 2.0));\n  let streak = streakLine * smoothstep(0.02, 0.55, facing);\n  let lightFacing = smoothstep(0.02, 0.55, facing);\n  let refractionBand = exp(-pow((inset - _vgsl_m0__BEVEL * 0.66) / (_vgsl_m0__BEVEL * 0.18), 2.0)) * lightFacing;\n  let bevelDepth = smoothstep(_vgsl_m0__BEVEL * 1.02, _vgsl_m0__BEVEL * 0.1, inset);\n  let shadeSide = 0.6 + 0.4 * (1.0 - lightFacing);\n  color = mix(color, color * _vgsl_m0__LIGHT_BEVEL_SHADE, bevelDepth * shadeSide * params.theme);\n  let refractionEdge = 1.0 - smoothstep(0.6, 1.4, abs(inset - _vgsl_m0__BEVEL) * lens.scale);\n  color = mix(color, colors.text * 0.6 + colors.accent * 0.25, refractionEdge * mix(0.22, 0.42, 1.0 - lightFacing) * params.theme);\n  color = mix(color, colors.text * 0.55 + colors.accent * 0.3, refractionBand * 0.3 * params.theme);\n  let lightStreak = exp(-pow((inset - _vgsl_m0__BEVEL * 0.3) / max(_vgsl_m0__BEVEL * 0.1, 1.1 / lens.scale), 2.0)) * smoothstep(0.02, 0.45, facing);\n  color = mix(color, _vgsl_m0__WARM_WHITE * 1.15, clamp(streak * 0.95, 0.0, 1.0) * (1.0 - params.theme));\n  color = mix(color, vec3f(1.0), clamp(lightStreak, 0.0, 1.0) * params.theme);\n\n  let shadowSide = smoothstep(-0.1, -0.7, facing);\n  let innerLine = exp(-pow((inset - _vgsl_m0__BEVEL * 0.7) / (_vgsl_m0__BEVEL * 0.14), 2.0)) * shadowSide;\n  let causticRipple = 0.6 + 0.4 * _vgsl_m0__valueNoise(keyPoint * vec2f(0.8, 2.2) + vec2f(params.time * 0.25, 0.0));\n  let innerGlow = exp(-max(inset - _vgsl_m0__BEVEL, 0.0) / 1.3) * shadowSide * smoothstep(0.0, _vgsl_m0__BEVEL, inset) * causticRipple;\n  color += colors.accent * (innerLine * 0.55 + innerGlow * 0.2) * dark;\n  color = mix(color, colors.accent, (innerLine * 0.25 + innerGlow * 0.1) * params.theme);\n\n  let rimBand = smoothstep(-_vgsl_m0__BEVEL, 0.0, d);\n  color += colors.accent * trapped * 0.06 * dark * (0.4 + beamOnGlass);\n  color += mix(colors.accent, beam.hue, 0.5) * beamOnGlass * (0.06 + 0.3 * rimBand) * dark;\n  color = mix(color, mix(_vgsl_m0__HOT_GOLD * colors.bg, beam.hue, 0.5), beamOnGlass * 0.12 * params.theme);\n  let underside = clamp(-facing, 0.0, 1.0) * rimBand;\n  color = mix(color, colors.text * 0.6 + colors.accent * 0.4, underside * 0.34 * params.theme);\n  color *= 1.0 - underside * 0.25 * dark;\n\n  let sweepPhase = fract(params.time * 0.07);\n  let sweepLine = dot(position - lens.center, normalize(vec2f(1.0, -0.6))) / (lens.scale * 30.0) - (sweepPhase * 3.0 - 1.5);\n  color += vec3f(exp(-sweepLine * sweepLine * 90.0) * 0.05 * dark);\n  return color;\n}\n\nfn _vgsl_m0__lightCaustic(position: vec2f, lens: _vgsl_m0__Lens) -> f32 {\n  let focusPoint = _vgsl_m0__bowCenterWorld(lens) - _vgsl_m0__TO_LIGHT_2D * (_vgsl_m0__BOW_OUTER + 2.2) * lens.scale;\n  let rel = position - focusPoint;\n  let along = dot(rel, _vgsl_m0__perpendicular(_vgsl_m0__TO_LIGHT_2D)) / (_vgsl_m0__BOW_OUTER * 0.45 * lens.scale);\n  let across = dot(rel, _vgsl_m0__TO_LIGHT_2D) / (0.9 * lens.scale);\n  let ripple = 0.75 + 0.25 * _vgsl_m0__valueNoise(rel / lens.scale * 1.4 + vec2f(params.time * 0.2, 0.0));\n  return exp(-(along * along + across * across)) * ripple * (0.35 + 0.65 * params.beam) * 0.6;\n}\n\nfn _vgsl_m0__darkGround(color: vec3f, position: vec2f, lens: _vgsl_m0__Lens, colors: _vgsl_m0__Palette, weight: vec3f) -> vec3f {\n  let offset = _vgsl_m0__SHADOW_OFFSET_UNITS * lens.scale;\n  let shadowDistance = _vgsl_m0__sdKey(_vgsl_m0__toKeySpace(position - offset, lens)) * lens.scale;\n  let shadow = exp(-max(shadowDistance, 0.0) / 22.0) * smoothstep(-26.0, 6.0, shadowDistance) * params.reveal;\n  var lit = color * (1.0 - shadow * 0.62);\n  let causticPoint = _vgsl_m0__toKeySpace(position - offset * 0.82, lens);\n  let causticDistance = _vgsl_m0__sdKey(causticPoint);\n  let ripple = 0.65 + 0.35 * _vgsl_m0__valueNoise(causticPoint * 0.9 + vec2f(params.time * 0.15, 0.0));\n  let caustic = (exp(-pow((causticDistance + 1.0) / 0.5, 2.0)) * 0.9 + smoothstep(0.3, -2.4, causticDistance) * 0.16) * ripple;\n  let energy = caustic * params.reveal * (0.35 + 0.65 * params.beam) * weight.z;\n  lit += colors.accent * energy * 0.42;\n  let halo = exp(-max(shadowDistance, 0.0) / 70.0);\n  return lit + colors.accent * halo * 0.035 * params.reveal * weight.z;\n}\n\nfn _vgsl_m0__lightGround(color: vec3f, position: vec2f, distancePx: f32, lens: _vgsl_m0__Lens, colors: _vgsl_m0__Palette) -> vec3f {\n  let contactDistance = _vgsl_m0__sdKey(_vgsl_m0__toKeySpace(position + _vgsl_m0__TO_LIGHT_2D * _vgsl_m0__CONTACT_OFFSET_PX, lens)) * lens.scale;\n  let contact = exp(-max(contactDistance, 0.0) / _vgsl_m0__CONTACT_FALLOFF_PX) * smoothstep(-3.0, 0.0, distancePx) * params.reveal;\n  let lit = color * mix(vec3f(1.0), _vgsl_m0__CONTACT_TINT, contact * 0.85);\n  return mix(lit, _vgsl_m0__LIGHT_CAUSTIC * colors.bg, _vgsl_m0__lightCaustic(position, lens) * params.reveal);\n}\n\nfn _vgsl_m0__groundLight(color: vec3f, position: vec2f, distancePx: f32, lens: _vgsl_m0__Lens, colors: _vgsl_m0__Palette, weight: vec3f) -> vec3f {\n  var dark = color;\n  var light = color;\n  if (params.theme < 1.0) { dark = _vgsl_m0__darkGround(color, position, lens, colors, weight); }\n  if (params.theme > 0.0) { light = _vgsl_m0__lightGround(color, position, distancePx, lens, colors); }\n  return mix(dark, light, params.theme);\n}\n\nfn _vgsl_m0__hotBloom(color: vec3f, beam: _vgsl_m0__BeamSample, colors: _vgsl_m0__Palette) -> vec3f {\n  let darkHot = color + _vgsl_m0__WARM_WHITE * beam.hot * 0.95;\n  let core = clamp(beam.hot - 0.55, 0.0, 1.0);\n  let lightHot = mix(mix(color, _vgsl_m0__LIGHT_BLOOM, clamp(beam.hot * 0.85, 0.0, 0.9)), vec3f(1.0), core);\n  return mix(darkHot, lightHot, params.theme);\n}\n\nfn _vgsl_m0__segmentDistance(p: vec2f, a: vec2f, b: vec2f) -> vec2f {\n  let ab = b - a;\n  let t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);\n  return vec2f(length(p - a - ab * t), t);\n}\n\nfn _vgsl_m0__bentPath(color: vec3f, position: vec2f, lens: _vgsl_m0__Lens, colors: _vgsl_m0__Palette) -> vec3f {\n  let beamStrength = params.beam * (1.0 - params.theme);\n  if (beamStrength <= 0.0) { return color; }\n  let center = _vgsl_m0__bowCenterWorld(lens);\n  let inside = smoothstep(0.3, -0.6, length(position - center) / lens.scale - _vgsl_m0__BOW_OUTER);\n  if (inside <= 0.0) { return color; }\n  let path = _vgsl_m0__segmentDistance(position, _vgsl_m0__beamEntry(lens), _vgsl_m0__beamExit(lens));\n  let across = path.x / lens.scale;\n  let glow = (exp(-across * across * 1.4) + exp(-across * across * 0.12) * 0.25) * inside * beamStrength;\n  let hue = mix(_vgsl_m0__WARM_WHITE, colors.accent * 1.1, smoothstep(0.15, 0.85, path.y));\n  let lightTint = mix(vec3f(1.0), mix(vec3f(1.0, 0.985, 0.95), mix(vec3f(1.0), colors.accent, _vgsl_m0__LIGHT_FAN_FILTER), smoothstep(0.15, 0.85, path.y)), clamp(glow * 0.8, 0.0, 1.0));\n  return mix(color + hue * glow * 0.42, color * lightTint, params.theme);\n}\n\n@fragment\nfn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {\n  let colors = _vgsl_m0__palette();\n  let position = uv * params.resolution / params.dpr;\n  let lens = _vgsl_m0__currentLens();\n  let pixel = 1.0 / params.dpr;\n  let dark = 1.0 - params.theme;\n\n  let keyPoint = _vgsl_m0__toKeySpace(position, lens);\n  let d = _vgsl_m0__sdKey(keyPoint);\n  let distancePx = d * lens.scale;\n  let beam = _vgsl_m0__beamAt(position, lens);\n  let coverage = smoothstep(pixel, -pixel, distancePx) * params.reveal;\n  let weight = _vgsl_m0__fieldWeight(position, keyPoint, d, lens);\n\n  var gradientKey = vec2f(0.0, 1.0);\n  if (distancePx < 90.0) { gradientKey = _vgsl_m0__keyGradient(keyPoint, d); }\n  let facing = dot(_vgsl_m0__rotate(gradientKey, lens.angle), _vgsl_m0__TO_LIGHT_2D);\n  let towardLight = clamp(facing * 0.5 + 0.5, 0.0, 1.0);\n\n  var color = colors.bg;\n  if (coverage < 1.0) {\n    color = _vgsl_m0__encryptedColor(position, colors, weight.x, weight.y, beam, 1.0);\n    if (distancePx < 260.0) { color = _vgsl_m0__groundLight(color, position, distancePx, lens, colors, weight); }\n    let localShade = exp(-max(distancePx, 0.0) / _vgsl_m0__LOCAL_VIGNETTE_PX) * params.reveal;\n    color *= 1.0 - localShade * mix(0.22, _vgsl_m0__LIGHT_LOCAL_SHADE, params.theme);\n    color = _vgsl_m0__beamLight(color, beam, colors);\n    let outer = exp(-max(distancePx, 0.0) / 7.0) * params.reveal * dark;\n    color += _vgsl_m0__WARM_WHITE * outer * pow(towardLight, 3.0) * 0.16 + colors.accent * outer * (1.0 - towardLight) * 0.07;\n  }\n\n  if (coverage > 0.0) {\n    let glass = _vgsl_m0__glassColor(position, keyPoint, d, gradientKey, lens, colors, beam, weight);\n    color = mix(color, glass, coverage);\n  }\n  color = _vgsl_m0__bentPath(color, position, lens, colors);\n  color = _vgsl_m0__hotBloom(color, beam, colors);\n\n  let shadowSide = 1.0 - towardLight;\n  let darkRimProfile = exp(-abs(distancePx + 0.4) * params.dpr * 0.85);\n  let inkHalfWidth = mix(0.55, 1.05, smoothstep(0.35, 0.8, shadowSide));\n  let inkProfile = 1.0 - smoothstep(inkHalfWidth - 0.5 * pixel, inkHalfWidth + 0.5 * pixel, abs(distancePx + inkHalfWidth));\n  let rim = mix(darkRimProfile, inkProfile, params.theme) * params.reveal;\n  let darkRim = mix(vec3f(0.6, 0.95, 0.8), _vgsl_m0__WARM_WHITE, towardLight);\n  let darkRimAlpha = 0.32 + 0.68 * towardLight;\n  let lightRimAlpha = 0.28 + 0.66 * smoothstep(0.3, 0.85, shadowSide);\n  color = mix(color, mix(darkRim, colors.text, params.theme), clamp(rim * mix(darkRimAlpha, lightRimAlpha, params.theme), 0.0, 1.0));\n\n  let grain = (_vgsl_m0__unitHash(_vgsl_m0__hash2(i32(uv.x * params.resolution.x), i32(uv.y * params.resolution.y) + i32(params.time * 30.0) * 7919)) - 0.5) / 255.0 * 1.5;\n  return vec4f(color + grain, 1.0);\n}\n',
  reflection: {
    bindings: [
      {
        group: 0,
        binding: 0,
        name: 'params',
        mangledName: 'params',
        type: {
          kind: 'identifier',
          name: '_vgsl_m0__Params',
          mangledName: '_vgsl_00a977e6___vgsl_m0__Params'
        },
        kind: 'buffer',
        addressSpace: 'uniform',
        struct: {
          name: '_vgsl_m0__Params',
          mangledName: '_vgsl_00a977e6___vgsl_m0__Params',
          members: [
            {
              name: 'resolution',
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              }
            },
            { name: 'dpr', type: { kind: 'scalar', name: 'f32' } },
            { name: 'time', type: { kind: 'scalar', name: 'f32' } },
            {
              name: 'lens',
              type: {
                kind: 'vector',
                width: 4,
                element: { kind: 'scalar', name: 'f32' }
              }
            },
            { name: 'theme', type: { kind: 'scalar', name: 'f32' } },
            { name: 'fontSize', type: { kind: 'scalar', name: 'f32' } },
            {
              name: 'scrim',
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              }
            },
            { name: 'reveal', type: { kind: 'scalar', name: 'f32' } },
            { name: 'drift', type: { kind: 'scalar', name: 'f32' } },
            { name: 'beam', type: { kind: 'scalar', name: 'f32' } },
            { name: 'rows', type: { kind: 'scalar', name: 'f32' } },
            {
              name: 'table',
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              }
            },
            {
              name: 'copy',
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              }
            },
            { name: 'fanEnd', type: { kind: 'scalar', name: 'f32' } }
          ]
        },
        layout: {
          name: 'params',
          mangledName: 'params',
          layoutMode: 'wgsl-host-shareable-v1',
          type: {
            kind: 'identifier',
            name: '_vgsl_m0__Params',
            mangledName: '_vgsl_00a977e6___vgsl_m0__Params'
          },
          align: 16,
          size: 96,
          members: [
            {
              name: 'resolution',
              offset: 0,
              align: 8,
              size: 8,
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              },
              layout: {
                name: 'resolution',
                mangledName: 'resolution',
                layoutMode: 'wgsl-host-shareable-v1',
                type: {
                  kind: 'vector',
                  width: 2,
                  element: { kind: 'scalar', name: 'f32' }
                },
                align: 8,
                size: 8
              }
            },
            {
              name: 'dpr',
              offset: 8,
              align: 4,
              size: 4,
              type: { kind: 'scalar', name: 'f32' },
              layout: {
                name: 'dpr',
                mangledName: 'dpr',
                layoutMode: 'wgsl-host-shareable-v1',
                type: { kind: 'scalar', name: 'f32' },
                align: 4,
                size: 4
              }
            },
            {
              name: 'time',
              offset: 12,
              align: 4,
              size: 4,
              type: { kind: 'scalar', name: 'f32' },
              layout: {
                name: 'time',
                mangledName: 'time',
                layoutMode: 'wgsl-host-shareable-v1',
                type: { kind: 'scalar', name: 'f32' },
                align: 4,
                size: 4
              }
            },
            {
              name: 'lens',
              offset: 16,
              align: 16,
              size: 16,
              type: {
                kind: 'vector',
                width: 4,
                element: { kind: 'scalar', name: 'f32' }
              },
              layout: {
                name: 'lens',
                mangledName: 'lens',
                layoutMode: 'wgsl-host-shareable-v1',
                type: {
                  kind: 'vector',
                  width: 4,
                  element: { kind: 'scalar', name: 'f32' }
                },
                align: 16,
                size: 16
              }
            },
            {
              name: 'theme',
              offset: 32,
              align: 4,
              size: 4,
              type: { kind: 'scalar', name: 'f32' },
              layout: {
                name: 'theme',
                mangledName: 'theme',
                layoutMode: 'wgsl-host-shareable-v1',
                type: { kind: 'scalar', name: 'f32' },
                align: 4,
                size: 4
              }
            },
            {
              name: 'fontSize',
              offset: 36,
              align: 4,
              size: 4,
              type: { kind: 'scalar', name: 'f32' },
              layout: {
                name: 'fontSize',
                mangledName: 'fontSize',
                layoutMode: 'wgsl-host-shareable-v1',
                type: { kind: 'scalar', name: 'f32' },
                align: 4,
                size: 4
              }
            },
            {
              name: 'scrim',
              offset: 40,
              align: 8,
              size: 8,
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              },
              layout: {
                name: 'scrim',
                mangledName: 'scrim',
                layoutMode: 'wgsl-host-shareable-v1',
                type: {
                  kind: 'vector',
                  width: 2,
                  element: { kind: 'scalar', name: 'f32' }
                },
                align: 8,
                size: 8
              }
            },
            {
              name: 'reveal',
              offset: 48,
              align: 4,
              size: 4,
              type: { kind: 'scalar', name: 'f32' },
              layout: {
                name: 'reveal',
                mangledName: 'reveal',
                layoutMode: 'wgsl-host-shareable-v1',
                type: { kind: 'scalar', name: 'f32' },
                align: 4,
                size: 4
              }
            },
            {
              name: 'drift',
              offset: 52,
              align: 4,
              size: 4,
              type: { kind: 'scalar', name: 'f32' },
              layout: {
                name: 'drift',
                mangledName: 'drift',
                layoutMode: 'wgsl-host-shareable-v1',
                type: { kind: 'scalar', name: 'f32' },
                align: 4,
                size: 4
              }
            },
            {
              name: 'beam',
              offset: 56,
              align: 4,
              size: 4,
              type: { kind: 'scalar', name: 'f32' },
              layout: {
                name: 'beam',
                mangledName: 'beam',
                layoutMode: 'wgsl-host-shareable-v1',
                type: { kind: 'scalar', name: 'f32' },
                align: 4,
                size: 4
              }
            },
            {
              name: 'rows',
              offset: 60,
              align: 4,
              size: 4,
              type: { kind: 'scalar', name: 'f32' },
              layout: {
                name: 'rows',
                mangledName: 'rows',
                layoutMode: 'wgsl-host-shareable-v1',
                type: { kind: 'scalar', name: 'f32' },
                align: 4,
                size: 4
              }
            },
            {
              name: 'table',
              offset: 64,
              align: 8,
              size: 8,
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              },
              layout: {
                name: 'table',
                mangledName: 'table',
                layoutMode: 'wgsl-host-shareable-v1',
                type: {
                  kind: 'vector',
                  width: 2,
                  element: { kind: 'scalar', name: 'f32' }
                },
                align: 8,
                size: 8
              }
            },
            {
              name: 'copy',
              offset: 72,
              align: 8,
              size: 8,
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              },
              layout: {
                name: 'copy',
                mangledName: 'copy',
                layoutMode: 'wgsl-host-shareable-v1',
                type: {
                  kind: 'vector',
                  width: 2,
                  element: { kind: 'scalar', name: 'f32' }
                },
                align: 8,
                size: 8
              }
            },
            {
              name: 'fanEnd',
              offset: 80,
              align: 4,
              size: 4,
              type: { kind: 'scalar', name: 'f32' },
              layout: {
                name: 'fanEnd',
                mangledName: 'fanEnd',
                layoutMode: 'wgsl-host-shareable-v1',
                type: { kind: 'scalar', name: 'f32' },
                align: 4,
                size: 4
              }
            }
          ]
        },
        bindingLayout: {
          kind: 'buffer',
          buffer: {
            type: 'uniform',
            hasDynamicOffset: false,
            minBindingSize: 96
          }
        }
      },
      {
        group: 0,
        binding: 1,
        name: 'atlas',
        mangledName: 'atlas',
        type: {
          kind: 'texture',
          textureKind: 'texture_2d',
          dimension: '2d',
          sampleType: { kind: 'scalar', name: 'f32' }
        },
        kind: 'texture',
        bindingLayout: {
          kind: 'texture',
          texture: {
            sampleType: 'unfilterable-float',
            viewDimension: '2d',
            multisampled: false
          }
        }
      },
      {
        group: 0,
        binding: 2,
        name: 'atlasSampler',
        mangledName: 'atlasSampler',
        type: { kind: 'sampler', comparison: false },
        kind: 'sampler',
        bindingLayout: { kind: 'sampler', sampler: { type: 'filtering' } }
      },
      {
        group: 0,
        binding: 3,
        name: 'lines',
        mangledName: 'lines',
        type: {
          kind: 'texture',
          textureKind: 'texture_2d',
          dimension: '2d',
          sampleType: { kind: 'scalar', name: 'u32' }
        },
        kind: 'texture',
        bindingLayout: {
          kind: 'texture',
          texture: {
            sampleType: 'uint',
            viewDimension: '2d',
            multisampled: false
          }
        }
      }
    ],
    entryPoints: [
      {
        name: 'fs_main',
        mangledName: 'fs_main',
        stage: 'fragment',
        bindings: [
          { group: 0, binding: 0 },
          { group: 0, binding: 1 },
          { group: 0, binding: 2 },
          { group: 0, binding: 3 }
        ],
        samplingPairs: [
          {
            texture: { group: 0, binding: 1 },
            sampler: { group: 0, binding: 2 },
            mode: 'filtering'
          }
        ]
      }
    ],
    overrides: [],
    featuresRequired: [],
    aliases: [],
    structs: [
      {
        name: '_vgsl_m0__Params',
        mangledName: '_vgsl_00a977e6___vgsl_m0__Params',
        members: [
          {
            name: 'resolution',
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          { name: 'dpr', type: { kind: 'scalar', name: 'f32' } },
          { name: 'time', type: { kind: 'scalar', name: 'f32' } },
          {
            name: 'lens',
            type: {
              kind: 'vector',
              width: 4,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          { name: 'theme', type: { kind: 'scalar', name: 'f32' } },
          { name: 'fontSize', type: { kind: 'scalar', name: 'f32' } },
          {
            name: 'scrim',
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          { name: 'reveal', type: { kind: 'scalar', name: 'f32' } },
          { name: 'drift', type: { kind: 'scalar', name: 'f32' } },
          { name: 'beam', type: { kind: 'scalar', name: 'f32' } },
          { name: 'rows', type: { kind: 'scalar', name: 'f32' } },
          {
            name: 'table',
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          {
            name: 'copy',
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          { name: 'fanEnd', type: { kind: 'scalar', name: 'f32' } }
        ]
      },
      {
        name: '_vgsl_m0__Palette',
        mangledName: '_vgsl_00a977e6___vgsl_m0__Palette',
        members: [
          {
            name: 'bg',
            type: {
              kind: 'vector',
              width: 3,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          {
            name: 'text',
            type: {
              kind: 'vector',
              width: 3,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          {
            name: 'muted',
            type: {
              kind: 'vector',
              width: 3,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          {
            name: 'accent',
            type: {
              kind: 'vector',
              width: 3,
              element: { kind: 'scalar', name: 'f32' }
            }
          }
        ]
      },
      {
        name: '_vgsl_m0__Glyph',
        mangledName: '_vgsl_00a977e6___vgsl_m0__Glyph',
        members: [
          { name: 'code', type: { kind: 'scalar', name: 'u32' } },
          { name: 'kind', type: { kind: 'scalar', name: 'u32' } }
        ]
      },
      {
        name: '_vgsl_m0__Lens',
        mangledName: '_vgsl_00a977e6___vgsl_m0__Lens',
        members: [
          {
            name: 'center',
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          { name: 'scale', type: { kind: 'scalar', name: 'f32' } },
          { name: 'angle', type: { kind: 'scalar', name: 'f32' } }
        ]
      },
      {
        name: '_vgsl_m0__BeamSample',
        mangledName: '_vgsl_00a977e6___vgsl_m0__BeamSample',
        members: [
          { name: 'incoming', type: { kind: 'scalar', name: 'f32' } },
          { name: 'outgoing', type: { kind: 'scalar', name: 'f32' } },
          { name: 'glowIn', type: { kind: 'scalar', name: 'f32' } },
          { name: 'glowOut', type: { kind: 'scalar', name: 'f32' } },
          { name: 'hot', type: { kind: 'scalar', name: 'f32' } },
          {
            name: 'hue',
            type: {
              kind: 'vector',
              width: 3,
              element: { kind: 'scalar', name: 'f32' }
            }
          }
        ]
      },
      {
        name: '_vgsl_m0__FieldSample',
        mangledName: '_vgsl_00a977e6___vgsl_m0__FieldSample',
        members: [
          { name: 'coverage', type: { kind: 'scalar', name: 'f32' } },
          { name: 'kind', type: { kind: 'scalar', name: 'u32' } },
          { name: 'shade', type: { kind: 'scalar', name: 'f32' } }
        ]
      },
      {
        name: '_vgsl_m0__TableCell',
        mangledName: '_vgsl_00a977e6___vgsl_m0__TableCell',
        members: [
          { name: 'code', type: { kind: 'scalar', name: 'u32' } },
          { name: 'isKey', type: { kind: 'scalar', name: 'bool' } },
          { name: 'emX', type: { kind: 'scalar', name: 'f32' } },
          { name: 'emUp', type: { kind: 'scalar', name: 'f32' } },
          { name: 'font', type: { kind: 'scalar', name: 'f32' } },
          { name: 'reveal', type: { kind: 'scalar', name: 'f32' } },
          { name: 'seed', type: { kind: 'scalar', name: 'u32' } }
        ]
      },
      {
        name: '_vgsl_m0__GlassExit',
        mangledName: '_vgsl_00a977e6___vgsl_m0__GlassExit',
        members: [
          {
            name: 'shift',
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          {
            name: 'shiftRed',
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          {
            name: 'shiftBlue',
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            }
          },
          { name: 'path', type: { kind: 'scalar', name: 'f32' } },
          { name: 'trapped', type: { kind: 'scalar', name: 'f32' } }
        ]
      }
    ],
    hostShareableLayouts: [
      {
        name: 'params',
        mangledName: 'params',
        layoutMode: 'wgsl-host-shareable-v1',
        type: {
          kind: 'identifier',
          name: '_vgsl_m0__Params',
          mangledName: '_vgsl_00a977e6___vgsl_m0__Params'
        },
        align: 16,
        size: 96,
        members: [
          {
            name: 'resolution',
            offset: 0,
            align: 8,
            size: 8,
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            },
            layout: {
              name: 'resolution',
              mangledName: 'resolution',
              layoutMode: 'wgsl-host-shareable-v1',
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              },
              align: 8,
              size: 8
            }
          },
          {
            name: 'dpr',
            offset: 8,
            align: 4,
            size: 4,
            type: { kind: 'scalar', name: 'f32' },
            layout: {
              name: 'dpr',
              mangledName: 'dpr',
              layoutMode: 'wgsl-host-shareable-v1',
              type: { kind: 'scalar', name: 'f32' },
              align: 4,
              size: 4
            }
          },
          {
            name: 'time',
            offset: 12,
            align: 4,
            size: 4,
            type: { kind: 'scalar', name: 'f32' },
            layout: {
              name: 'time',
              mangledName: 'time',
              layoutMode: 'wgsl-host-shareable-v1',
              type: { kind: 'scalar', name: 'f32' },
              align: 4,
              size: 4
            }
          },
          {
            name: 'lens',
            offset: 16,
            align: 16,
            size: 16,
            type: {
              kind: 'vector',
              width: 4,
              element: { kind: 'scalar', name: 'f32' }
            },
            layout: {
              name: 'lens',
              mangledName: 'lens',
              layoutMode: 'wgsl-host-shareable-v1',
              type: {
                kind: 'vector',
                width: 4,
                element: { kind: 'scalar', name: 'f32' }
              },
              align: 16,
              size: 16
            }
          },
          {
            name: 'theme',
            offset: 32,
            align: 4,
            size: 4,
            type: { kind: 'scalar', name: 'f32' },
            layout: {
              name: 'theme',
              mangledName: 'theme',
              layoutMode: 'wgsl-host-shareable-v1',
              type: { kind: 'scalar', name: 'f32' },
              align: 4,
              size: 4
            }
          },
          {
            name: 'fontSize',
            offset: 36,
            align: 4,
            size: 4,
            type: { kind: 'scalar', name: 'f32' },
            layout: {
              name: 'fontSize',
              mangledName: 'fontSize',
              layoutMode: 'wgsl-host-shareable-v1',
              type: { kind: 'scalar', name: 'f32' },
              align: 4,
              size: 4
            }
          },
          {
            name: 'scrim',
            offset: 40,
            align: 8,
            size: 8,
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            },
            layout: {
              name: 'scrim',
              mangledName: 'scrim',
              layoutMode: 'wgsl-host-shareable-v1',
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              },
              align: 8,
              size: 8
            }
          },
          {
            name: 'reveal',
            offset: 48,
            align: 4,
            size: 4,
            type: { kind: 'scalar', name: 'f32' },
            layout: {
              name: 'reveal',
              mangledName: 'reveal',
              layoutMode: 'wgsl-host-shareable-v1',
              type: { kind: 'scalar', name: 'f32' },
              align: 4,
              size: 4
            }
          },
          {
            name: 'drift',
            offset: 52,
            align: 4,
            size: 4,
            type: { kind: 'scalar', name: 'f32' },
            layout: {
              name: 'drift',
              mangledName: 'drift',
              layoutMode: 'wgsl-host-shareable-v1',
              type: { kind: 'scalar', name: 'f32' },
              align: 4,
              size: 4
            }
          },
          {
            name: 'beam',
            offset: 56,
            align: 4,
            size: 4,
            type: { kind: 'scalar', name: 'f32' },
            layout: {
              name: 'beam',
              mangledName: 'beam',
              layoutMode: 'wgsl-host-shareable-v1',
              type: { kind: 'scalar', name: 'f32' },
              align: 4,
              size: 4
            }
          },
          {
            name: 'rows',
            offset: 60,
            align: 4,
            size: 4,
            type: { kind: 'scalar', name: 'f32' },
            layout: {
              name: 'rows',
              mangledName: 'rows',
              layoutMode: 'wgsl-host-shareable-v1',
              type: { kind: 'scalar', name: 'f32' },
              align: 4,
              size: 4
            }
          },
          {
            name: 'table',
            offset: 64,
            align: 8,
            size: 8,
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            },
            layout: {
              name: 'table',
              mangledName: 'table',
              layoutMode: 'wgsl-host-shareable-v1',
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              },
              align: 8,
              size: 8
            }
          },
          {
            name: 'copy',
            offset: 72,
            align: 8,
            size: 8,
            type: {
              kind: 'vector',
              width: 2,
              element: { kind: 'scalar', name: 'f32' }
            },
            layout: {
              name: 'copy',
              mangledName: 'copy',
              layoutMode: 'wgsl-host-shareable-v1',
              type: {
                kind: 'vector',
                width: 2,
                element: { kind: 'scalar', name: 'f32' }
              },
              align: 8,
              size: 8
            }
          },
          {
            name: 'fanEnd',
            offset: 80,
            align: 4,
            size: 4,
            type: { kind: 'scalar', name: 'f32' },
            layout: {
              name: 'fanEnd',
              mangledName: 'fanEnd',
              layoutMode: 'wgsl-host-shareable-v1',
              type: { kind: 'scalar', name: 'f32' },
              align: 4,
              size: 4
            }
          }
        ]
      }
    ]
  },
  sourceChecksum: 'fnv1a64-utf16le-v1:fdebda8f0b5fed87',
  producer: '@vgpu/wgsl/prepare-v2',
  functionExports: []
})
