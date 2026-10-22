struct Params {
  resolution: vec2f,
  dpr: f32,
  time: f32,
  lens: vec4f,
  theme: f32,
  fontSize: f32,
  scrim: vec2f,
  reveal: f32,
  drift: f32,
  beam: f32,
  rows: f32,
  table: vec2f,
  copy: vec2f,
  fanEnd: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var atlas: texture_2d<f32>;
@group(0) @binding(2) var atlasSampler: sampler;
@group(0) @binding(3) var lines: texture_2d<u32>;

const ATLAS_SIZE = vec2f(368.0, 240.0);
const ATLAS_CELL = vec2f(23.0, 40.0);
const ATLAS_COLUMNS = 16u;
const ATLAS_TEXELS_PER_EM = 25.0;
const ATLAS_PAD = 4.0;
const ATLAS_ASCENT_EM = 0.95;
const ATLAS_SPREAD = 4.0;

const CELL_EM = vec2f(0.6, 1.62);
const BASELINE_EM = 1.08;
const BLOCK_CELLS = 70;
const TEXT_CELLS = 64;
const LINE_COUNT = 16u;
const PREFIX_ROW = 16u;
const PREFIX_LENGTH = 20;
const KEY_END_TEXEL = 64;
const LINE_LENGTH_TEXEL = 65;

const TABLE_KEY_COLUMNS = 14;
const TABLE_CHARS = 36;
const TABLE_PITCH_EM = 1.36;
const TABLE_BASELINE_EM = 1.02;

const KIND_NONE = 0u;
const KIND_KEY = 1u;
const KIND_CIPHER = 2u;
const KIND_FRAME = 3u;

const BOW_CENTER = vec2f(14.0, 32.0);
const BOW_OUTER = 9.4;
const BOW_INNER = 5.2;
const SHAFT_LO = vec2f(19.6, 28.2);
const SHAFT_HI = vec2f(64.0, 35.8);
const TOOTH_A_LO = vec2f(47.5, 35.0);
const TOOTH_A_HI = vec2f(52.3, 43.4);
const TOOTH_B_LO = vec2f(56.3, 35.0);
const TOOTH_B_HI = vec2f(61.0, 41.4);
const OUTER_CORNER = 0.4;
const KEY_CENTER = vec2f(34.3, 33.0);
const TEXT_LO = vec2f(24.6, 29.3);
const TEXT_HI = vec2f(62.6, 34.7);

const SLAB_CORE = 0.9;
const BEVEL = 0.8;
const GLASS_IOR = 1.5;
const GLASS_DISPERSION = 0.05;
const TEXT_PLANE_DEPTH = 3.4;
const INNER_STEPS = 12;
const BOUNCES = 2;
const REFRACT_MAX_PX = 44.0;
const BACK_FACE_PARALLAX = vec2f(-0.5, 0.8);

const SCRIM_FLOOR = 0.1;
const SCRIM_RAMP_PX = 140.0;
const MOBILE_SCRIM_RAMP_PX = 80.0;
const FOCUS_REACH_UNITS = 7.5;
const FOCUS_BOW_RADIUS_UNITS = 40.0;
const FOCUS_TIP_X = 50.0;
const FOCUS_TIP_FALLOFF_UNITS = 5.0;
const FOCUS_ABOVE_Y = 28.0;
const FOCUS_ABOVE_FALLOFF_UNITS = 4.0;
const EDGE_FALLOFF_PX = 230.0;
const LOCAL_VIGNETTE_PX = 120.0;
const BEHIND_GLASS_FOCUS = 0.3;
const DARK_BEHIND_GAIN = 1.3;

const BEAM_IN = vec2f(-0.2588, 0.9659);
const BEAM_BEND = -0.366;
const BEAM_IN_HALF_UNITS = 1.7;
const BEAM_IN_WIDEN = 0.014;
const BEAM_IN_FADE_UNITS = 30.0;
const BEAM_OUT_HALF_UNITS = 1.7;
const BEAM_FAN_SPREAD = 0.34;
const BEAM_OUT_MIN_UNITS = 6.0;
const BEAM_MASK_GAP_PX = vec2f(14.0, 70.0);
const TO_LIGHT_2D = vec2f(0.2588, -0.9659);
const SHADOW_OFFSET_UNITS = vec2f(-1.2, 2.6);
const HOT_GOLD = vec3f(1.0, 0.84, 0.5);
const LIGHT_BLOOM = vec3f(1.0, 0.95, 0.84);
const WARM_WHITE = vec3f(1.0, 0.96, 0.9);
const DARK_LIME = vec3f(0.62, 0.96, 0.3);
const DARK_TEAL = vec3f(0.1, 0.8, 0.88);
const LIGHT_LIME = vec3f(0.42, 0.7, 0.08);
const LIGHT_TEAL = vec3f(0.0, 0.46, 0.55);
const LIGHT_SHAFT = vec3f(1.0, 0.972, 0.915);
const LIGHT_SHAFT_EDGE = vec3f(0.93, 0.9, 0.84);
const CONTACT_OFFSET_PX = 8.0;
const CONTACT_FALLOFF_PX = 4.0;
const CONTACT_TINT = vec3f(0.62, 0.74, 0.69);
const LIGHT_CAUSTIC = vec3f(0.84, 0.98, 0.9);
const LIGHT_BEVEL_SHADE = vec3f(0.7, 0.8, 0.77);
const LIGHT_FAN_FILTER = 0.42;
const LIGHT_BEHIND_FOCUS = 0.7;
const LIGHT_BEHIND_GAIN = 1.25;
const LIGHT_LOCAL_SHADE = 0.05;
const LIGHT_BODY_TINT = vec3f(0.955, 0.975, 0.965);
const TABLE_LEAD = 0.3;

const DARK_BG = vec3f(0.059, 0.067, 0.059);
const DARK_TEXT = vec3f(0.922, 0.914, 0.886);
const DARK_MUTED = vec3f(0.659, 0.647, 0.608);
const DARK_ACCENT = vec3f(0.239, 0.863, 0.592);
const LIGHT_BG = vec3f(0.984, 0.980, 0.965);
const LIGHT_TEXT = vec3f(0.086, 0.082, 0.059);
const LIGHT_MUTED = vec3f(0.369, 0.361, 0.325);
const LIGHT_ACCENT = vec3f(0.039, 0.455, 0.282);

struct Palette {
  bg: vec3f,
  text: vec3f,
  muted: vec3f,
  accent: vec3f,
}

struct Glyph {
  code: u32,
  kind: u32,
}

struct Lens {
  center: vec2f,
  scale: f32,
  angle: f32,
}

struct BeamSample {
  incoming: f32,
  outgoing: f32,
  glowIn: f32,
  glowOut: f32,
  hot: f32,
  hue: vec3f,
}

const NO_BEAM = BeamSample(0.0, 0.0, 0.0, 0.0, 0.0, vec3f(0.0));

fn palette() -> Palette {
  let t = params.theme;
  return Palette(
    mix(DARK_BG, LIGHT_BG, t),
    mix(DARK_TEXT, LIGHT_TEXT, t),
    mix(DARK_MUTED, LIGHT_MUTED, t),
    mix(DARK_ACCENT, LIGHT_ACCENT, t),
  );
}

fn currentLens() -> Lens {
  return Lens(params.lens.xy, params.lens.z * mix(0.94, 1.0, params.reveal), params.lens.w);
}

fn hashU(value: u32) -> u32 {
  var state = value * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn hash2(a: i32, b: i32) -> u32 {
  return hashU(bitcast<u32>(a) ^ hashU(bitcast<u32>(b) + 0x9e3779b9u));
}

fn unitHash(value: u32) -> f32 {
  return f32(value & 0xffffu) / 65535.0;
}

fn valueNoise(p: vec2f) -> f32 {
  let cell = floor(p);
  let f = p - cell;
  let u = f * f * (3.0 - 2.0 * f);
  let c = vec2i(cell);
  let a = unitHash(hash2(c.x, c.y));
  let b = unitHash(hash2(c.x + 1, c.y));
  let d = unitHash(hash2(c.x, c.y + 1));
  let e = unitHash(hash2(c.x + 1, c.y + 1));
  return mix(mix(a, b, u.x), mix(d, e, u.x), u.y);
}

fn base64Code(index: u32) -> u32 {
  let k = index & 63u;
  if (k < 26u) { return 65u + k; }
  if (k < 52u) { return 97u + k - 26u; }
  if (k < 62u) { return 48u + k - 52u; }
  if (k == 62u) { return 43u; }
  return 47u;
}

fn lineTexel(column: i32, row: u32) -> u32 {
  return textureLoad(lines, vec2i(column, i32(row)), 0).r;
}

fn rotate(v: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(c * v.x - s * v.y, s * v.x + c * v.y);
}

fn toKeySpace(position: vec2f, lens: Lens) -> vec2f {
  return rotate(position - lens.center, -lens.angle) / lens.scale + KEY_CENTER;
}

fn fieldGlyph(cell: vec2i) -> Glyph {
  let shift = i32(hashU(bitcast<u32>(cell.y) * 3u + 17u) % u32(BLOCK_CELLS));
  let shifted = cell.x + shift;
  let block = i32(floor(f32(shifted) / f32(BLOCK_CELLS)));
  let column = shifted - block * BLOCK_CELLS;
  if (column >= TEXT_CELLS) { return Glyph(32u, KIND_NONE); }

  let lineSeed = hash2(block, cell.y);
  let line = lineSeed % LINE_COUNT;
  let keyEnd = i32(lineTexel(KEY_END_TEXEL, line));
  if (column < keyEnd) { return Glyph(lineTexel(column, line), KIND_KEY); }

  let offset = column - keyEnd;
  if (offset < PREFIX_LENGTH) { return Glyph(lineTexel(offset, PREFIX_ROW), KIND_FRAME); }
  let cipherEnd = min(TEXT_CELLS, keyEnd + PREFIX_LENGTH + 10 + i32(lineSeed >> 9u) % 24);
  if (column < cipherEnd - 1) {
    let cellSeed = hash2(cell.x * 7 + 3, cell.y * 13 + 5);
    let rate = 0.08 + 0.3 * unitHash(cellSeed >> 3u);
    let epoch = u32(floor(params.time * rate + unitHash(cellSeed >> 11u) * 9.0));
    return Glyph(base64Code(hashU(cellSeed ^ (epoch * 0x85ebca6bu))), KIND_CIPHER);
  }
  if (column == cipherEnd - 1) { return Glyph(93u, KIND_FRAME); }
  return Glyph(32u, KIND_NONE);
}

fn glyphSdf(code: u32, emX: f32, emUp: f32) -> f32 {
  let index = min(max(code, 32u), 126u) - 32u;
  let origin = vec2f(f32(index % ATLAS_COLUMNS), f32(index / ATLAS_COLUMNS)) * ATLAS_CELL;
  let local = vec2f(ATLAS_PAD + emX * ATLAS_TEXELS_PER_EM, ATLAS_PAD + (ATLAS_ASCENT_EM - emUp) * ATLAS_TEXELS_PER_EM);
  let texel = origin + clamp(local, vec2f(0.5), ATLAS_CELL - vec2f(0.5));
  return textureSampleLevel(atlas, atlasSampler, texel / ATLAS_SIZE, 0.0).r;
}

fn glyphCoverage(code: u32, emX: f32, emUp: f32, fontSize: f32, softness: f32) -> vec2f {
  let sdf = glyphSdf(code, emX, emUp);
  let texelsPerPixel = ATLAS_TEXELS_PER_EM / (fontSize * params.dpr);
  let width = (0.5 / ATLAS_SPREAD) * texelsPerPixel * 0.75 + softness;
  return vec2f(smoothstep(0.5 - width, 0.5 + width, sdf), smoothstep(0.08, 0.5, sdf));
}

struct FieldSample {
  coverage: f32,
  kind: u32,
  shade: f32,
}

fn sampleField(position: vec2f, fontSize: f32, scroll: f32, softness: f32) -> FieldSample {
  let cellSize = CELL_EM * fontSize;
  let scrolled = position + vec2f(0.0, scroll);
  let cellF = floor(scrolled / cellSize);
  let cell = vec2i(cellF);
  let glyph = fieldGlyph(cell);
  if (glyph.kind == KIND_NONE) { return FieldSample(0.0, KIND_NONE, 0.0); }

  let local = (scrolled - cellF * cellSize) / fontSize;
  let seed = hash2(cell.x * 31 + 7, cell.y * 17 + 11);
  let jitter = (unitHash(seed) - 0.5) * 0.12;
  let shade = 0.55 + 0.45 * unitHash(seed >> 5u);
  let coverage = glyphCoverage(glyph.code, local.x, BASELINE_EM - local.y - jitter, fontSize, softness);
  return FieldSample(coverage.x, glyph.kind, shade);
}

fn sdBox(p: vec2f, lo: vec2f, hi: vec2f, corner: f32) -> f32 {
  let center = (lo + hi) * 0.5;
  let half = (hi - lo) * 0.5 - vec2f(corner);
  let q = abs(p - center) - half;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - corner;
}

fn sdKey(p: vec2f) -> f32 {
  let ringMid = (BOW_OUTER + BOW_INNER) * 0.5;
  let ringHalf = (BOW_OUTER - BOW_INNER) * 0.5;
  let ring = abs(length(p - BOW_CENTER) - ringMid) - ringHalf;
  let shaft = sdBox(p, SHAFT_LO, SHAFT_HI, OUTER_CORNER);
  let toothA = sdBox(p, TOOTH_A_LO, TOOTH_A_HI, OUTER_CORNER);
  let toothB = sdBox(p, TOOTH_B_LO, TOOTH_B_HI, OUTER_CORNER);
  return min(min(ring, shaft), min(toothA, toothB));
}

fn keyGradient(p: vec2f, d: f32) -> vec2f {
  let e = 0.03;
  let g = vec2f(sdKey(p + vec2f(e, 0.0)) - d, sdKey(p + vec2f(0.0, e)) - d) / e;
  return g / max(length(g), 1e-4);
}

fn slabDistance(p: vec3f) -> f32 {
  let w = vec2f(sdKey(p.xy) + BEVEL, abs(p.z) - SLAB_CORE);
  return min(max(w.x, w.y), 0.0) + length(max(w, vec2f(0.0))) - BEVEL;
}

fn slabNormal(p: vec3f) -> vec3f {
  let e = vec2f(1.0, -1.0) * 0.012;
  return normalize(
    e.xyy * slabDistance(p + e.xyy) +
    e.yyx * slabDistance(p + e.yyx) +
    e.yxy * slabDistance(p + e.yxy) +
    e.xxx * slabDistance(p + e.xxx)
  );
}

fn fieldWeight(position: vec2f, keyPoint: vec2f, keyDistance: f32, lens: Lens) -> vec3f {
  var scrim = 1.0;
  if (params.scrim.x > 0.0) {
    scrim = mix(SCRIM_FLOOR, 1.0, smoothstep(params.scrim.x, params.scrim.x + SCRIM_RAMP_PX, position.x));
  }
  if (params.scrim.y > 0.0) {
    scrim = min(scrim, mix(SCRIM_FLOOR, 1.0, smoothstep(params.scrim.y, params.scrim.y + MOBILE_SCRIM_RAMP_PX, position.y)));
  }
  let reach = max(keyDistance, 0.0) / FOCUS_REACH_UNITS;
  let pastTip = max(keyPoint.x - FOCUS_TIP_X, 0.0) / FOCUS_TIP_FALLOFF_UNITS;
  let above = max(FOCUS_ABOVE_Y - keyPoint.y, 0.0) / FOCUS_ABOVE_FALLOFF_UNITS;
  let fromBow = length(keyPoint - BOW_CENTER) / FOCUS_BOW_RADIUS_UNITS;
  let focus = exp(-reach * reach) * exp(-fromBow * fromBow) * exp(-pastTip * pastTip) * exp(-above * above);
  let size = params.resolution / params.dpr;
  let edge = min(min(position.x, size.x - position.x), min(position.y, size.y - position.y));
  let vignette = smoothstep(0.0, EDGE_FALLOFF_PX, edge);
  return vec3f(scrim * focus * vignette, focus, scrim);
}

fn beamMask(position: vec2f) -> f32 {
  let right = smoothstep(BEAM_MASK_GAP_PX.x, BEAM_MASK_GAP_PX.y, position.x - params.copy.x);
  let below = smoothstep(BEAM_MASK_GAP_PX.x, BEAM_MASK_GAP_PX.y, position.y - params.copy.y);
  return max(right, below);
}

fn perpendicular(v: vec2f) -> vec2f {
  return vec2f(-v.y, v.x);
}

fn bowCenterWorld(lens: Lens) -> vec2f {
  return lens.center + rotate((BOW_CENTER - KEY_CENTER) * lens.scale, lens.angle);
}

fn beamOutDirection() -> vec2f {
  return rotate(BEAM_IN, BEAM_BEND);
}

fn beamEntry(lens: Lens) -> vec2f {
  return bowCenterWorld(lens) - BEAM_IN * (BOW_OUTER * lens.scale);
}

fn beamExit(lens: Lens) -> vec2f {
  return bowCenterWorld(lens) + rotate(BEAM_IN, BEAM_BEND * 0.5) * (BOW_OUTER * lens.scale);
}

fn beamHue(across: f32) -> vec3f {
  let lime = mix(DARK_LIME, LIGHT_LIME, params.theme);
  let teal = mix(DARK_TEAL, LIGHT_TEAL, params.theme);
  let accent = mix(DARK_ACCENT, LIGHT_ACCENT, params.theme);
  let fringe = smoothstep(0.55, 1.1, abs(across)) * 0.8;
  return mix(accent, select(teal, lime, across < 0.0), fringe);
}

fn incomingShaft(position: vec2f, lens: Lens) -> vec2f {
  let rel = (position - beamEntry(lens)) / lens.scale;
  let along = dot(rel, BEAM_IN);
  if (along > 0.6) { return vec2f(0.0); }
  let across = dot(rel, perpendicular(BEAM_IN));
  let upstream = max(-along, 0.0);
  let x = across / (BEAM_IN_HALF_UNITS * (1.0 + upstream * BEAM_IN_WIDEN));
  let nearGlass = mix(0.45, 1.0, exp(along / BEAM_IN_FADE_UNITS));
  let streaks = valueNoise(vec2f(across * 0.9, along * 0.035 - params.time * 0.08));
  let motes = valueNoise(vec2f(across * 2.3, along * 0.5 - params.time * 0.9));
  let cap = smoothstep(0.6, -0.4, along);
  let core = exp(-x * x * 0.9) * (0.82 + 0.18 * streaks);
  let scatter = exp(-x * x * 0.14) * (0.12 + 0.12 * streaks) + exp(-x * x * 0.025) * 0.035 + exp(-x * x * 0.3) * pow(motes, 6.0) * 0.5;
  return vec2f(core, scatter) * nearGlass * cap;
}

fn entryBloom(position: vec2f, lens: Lens) -> f32 {
  let rel = (position - beamEntry(lens)) / lens.scale;
  let r2 = dot(rel, rel);
  let tangent = dot(rel, perpendicular(BEAM_IN));
  let normal = dot(rel, BEAM_IN);
  let streak = exp(-abs(tangent) / 4.5) * exp(-normal * normal / 0.05);
  return exp(-r2 * 0.6) + 0.32 * exp(-sqrt(r2) * 0.42) + 0.45 * streak;
}

fn fanLength(lens: Lens, direction: vec2f) -> f32 {
  return max((params.fanEnd - beamExit(lens).y) / (lens.scale * max(direction.y, 0.2)), BEAM_OUT_MIN_UNITS);
}

fn outgoingFan(position: vec2f, lens: Lens) -> vec4f {
  let direction = beamOutDirection();
  let rel = (position - beamExit(lens)) / lens.scale;
  let along = dot(rel, direction);
  if (along < -1.5) { return vec4f(0.0); }
  let across = dot(rel, perpendicular(direction));
  let travelled = max(along, 0.0);
  let half = BEAM_OUT_HALF_UNITS + travelled * BEAM_FAN_SPREAD;
  let x = across / half;
  if (abs(x) > 6.0) { return vec4f(0.0); }
  let lengthUnits = fanLength(lens, direction);
  let fade = 1.0 - smoothstep(lengthUnits * 0.3, lengthUnits, travelled);
  let thinning = 1.0 / (1.0 + travelled * 0.05);
  let body = exp(-x * x * 2.0) * mix(0.55, 1.0, thinning);
  let core = exp(-x * x * 11.0) * thinning;
  let start = smoothstep(-1.5, 1.2, along);
  let energy = start * fade;
  let fan = (body * 1.1 + core * 0.6) * energy;
  let glow = exp(-x * x * 0.35) * 0.18 * energy;
  return vec4f(fan, glow, x, core * energy);
}

fn beamAt(position: vec2f, lens: Lens) -> BeamSample {
  if (params.beam <= 0.0) { return NO_BEAM; }
  let strength = params.beam * beamMask(position) * (1.0 - params.theme);
  if (strength <= 0.0) { return NO_BEAM; }
  let shaft = incomingShaft(position, lens);
  let fan = outgoingFan(position, lens);
  return BeamSample(
    shaft.x * strength,
    fan.x * strength,
    shaft.y * strength,
    fan.y * strength,
    entryBloom(position, lens) * strength,
    mix(beamHue(fan.z), vec3f(0.85, 1.0, 0.92), fan.w * (1.0 - params.theme) * 0.5),
  );
}

fn outsideInk(kind: u32, colors: Palette) -> vec4f {
  let light = params.theme;
  if (kind == KIND_KEY) { return vec4f(colors.muted, mix(0.32, 0.24, light)); }
  if (kind == KIND_FRAME) { return vec4f(colors.muted, mix(0.19, 0.13, light)); }
  return vec4f(mix(colors.muted, colors.accent, 0.2), mix(0.24, 0.16, light));
}

fn encryptedColor(position: vec2f, colors: Palette, strengthIn: f32, focus: f32, beam: BeamSample, gain: f32) -> vec3f {
  var color = colors.bg;
  let warmLit = beam.incoming * 0.8 + beam.glowIn * 0.6 + beam.hot * 0.5;
  let greenLit = beam.outgoing + beam.glowOut * 0.6;
  let lit = warmLit + greenLit;
  let strength = strengthIn + lit * 0.6;
  if (strength < 0.01) { return color; }
  let defocus = (1.0 - focus) * 0.1;
  let front = sampleField(position, params.fontSize, params.drift, defocus);
  if (front.kind == KIND_NONE) { return color; }
  let ink = outsideInk(front.kind, colors);
  let warmInk = mix(WARM_WHITE, vec3f(0.42, 0.36, 0.26), params.theme);
  let beamInk = (warmInk * warmLit + beam.hue * greenLit) / max(lit, 1e-3);
  let tinted = mix(ink.rgb, beamInk, clamp(lit * 1.4, 0.0, 0.9));
  return mix(color, tinted, clamp(front.coverage * front.shade * ink.a * strength * gain * (1.0 + lit), 0.0, 1.0));
}

fn beamLight(colorIn: vec3f, beam: BeamSample, colors: Palette) -> vec3f {
  let dark = WARM_WHITE * (beam.incoming * 0.36 + beam.glowIn * 0.5)
    + beam.hue * (beam.outgoing * 0.62) + colors.accent * beam.glowOut * 0.16;
  let darkLit = colorIn + dark;
  let shaftEdge = clamp(beam.glowIn * 1.4, 0.0, 1.0) * (1.0 - clamp(beam.incoming, 0.0, 1.0));
  var lightLit = mix(colorIn, colorIn * LIGHT_SHAFT_EDGE, shaftEdge * 0.12);
  lightLit = mix(lightLit, LIGHT_SHAFT, clamp(beam.incoming * 0.7, 0.0, 0.7));
  let fanFilter = mix(vec3f(1.0), beam.hue, LIGHT_FAN_FILTER);
  lightLit *= mix(vec3f(1.0), fanFilter, clamp(beam.outgoing + beam.glowOut * 0.5, 0.0, 1.0));
  return mix(darkLit, lightLit, params.theme);
}

struct TableCell {
  code: u32,
  isKey: bool,
  emX: f32,
  emUp: f32,
  font: f32,
  reveal: f32,
  seed: u32,
}

fn tableCell(localPx: vec2f, lens: Lens) -> TableCell {
  let empty = TableCell(32u, false, 0.0, 0.0, 1.0, 0.0, 0u);
  let rows = max(params.rows, 1.0);
  let regionLo = (TEXT_LO - KEY_CENTER) * lens.scale;
  let regionHi = (TEXT_HI - KEY_CENTER) * lens.scale;
  let region = regionHi - regionLo;
  let font = min(region.y / (rows * TABLE_PITCH_EM), region.x / (f32(TABLE_CHARS) * CELL_EM.x));
  let cell = vec2f(CELL_EM.x, TABLE_PITCH_EM) * font;
  let size = vec2f(f32(TABLE_CHARS), rows) * cell;
  let p = localPx - (regionLo + (region - size) * vec2f(TABLE_LEAD, 0.5));
  if (p.x < 0.0 || p.y < 0.0 || p.x >= size.x || p.y >= size.y) { return empty; }

  let cellF = floor(p / cell);
  let column = i32(cellF.x);
  let slot = i32(cellF.y);
  let line = u32((i32(params.table.x) * i32(rows) + slot) % i32(LINE_COUNT));
  let keyEnd = i32(lineTexel(KEY_END_TEXEL, line));
  let lineLength = i32(lineTexel(LINE_LENGTH_TEXEL, line));
  let index = column - (TABLE_KEY_COLUMNS + 2 - keyEnd);
  if (index < 0 || index >= lineLength) { return empty; }
  let code = lineTexel(index, line);
  if (code == 32u) { return empty; }

  let local = (p - cellF * cell) / font;
  let columnT = (f32(column) + 0.5) / f32(TABLE_CHARS);
  let reveal = params.table.y * 1.3 - 0.3 * f32(slot) / rows - columnT;
  return TableCell(code, index < keyEnd, local.x, TABLE_BASELINE_EM - local.y, font, reveal, hash2(column * 7 + 1, slot * 13 + i32(line)));
}

fn tableInk(localPx: vec2f, lens: Lens, colors: Palette, interior: vec3f) -> vec3f {
  let cell = tableCell(localPx, lens);
  if (cell.code == 32u) { return interior; }
  let dark = 1.0 - params.theme;
  if (cell.reveal > 0.0) {
    let coverage = glyphCoverage(cell.code, cell.emX, cell.emUp, cell.font, 0.0);
    let flash = exp(-cell.reveal * 40.0);
    if (cell.isKey) {
      let keyInk = mix(colors.text, colors.accent, flash);
      return mix(interior, keyInk, coverage.x * mix(0.82, 0.86, params.theme));
    }
    let valueInk = mix(colors.accent * 1.08 + WARM_WHITE * flash * 0.6, colors.accent, params.theme);
    let glow = interior + colors.accent * coverage.y * 0.16 * dark;
    return mix(glow, valueInk, coverage.x);
  }
  let tick = u32(params.time * 14.0);
  let cipher = base64Code(hashU(cell.seed + tick * 2654435761u));
  let coverage = glyphCoverage(cipher, cell.emX, cell.emUp, cell.font, 0.02);
  return mix(interior, mix(colors.muted, colors.accent, 0.55), coverage.x * 0.55);
}

fn fresnel(cosine: f32) -> f32 {
  return 0.04 + 0.96 * pow(clamp(1.0 - cosine, 0.0, 1.0), 5.0);
}

fn environment(direction: vec3f, colors: Palette, toLight: vec3f) -> vec3f {
  let alignment = max(dot(direction, toLight), 0.0);
  let horizon = 1.0 - abs(direction.z);
  let darkSky = colors.bg * 0.5 + vec3f(0.42, 0.48, 0.45) * pow(horizon, 3.0) + WARM_WHITE * (pow(alignment, 30.0) * 1.6 + pow(alignment, 5.0) * 0.14);
  let lightSky = mix(colors.bg * vec3f(0.86, 0.93, 0.9), colors.text, 0.05 + 0.38 * pow(horizon, 2.0)) + vec3f(pow(alignment, 30.0) * 0.6);
  return mix(darkSky, lightSky, params.theme);
}

struct GlassExit {
  shift: vec2f,
  shiftRed: vec2f,
  shiftBlue: vec2f,
  path: f32,
  trapped: f32,
}

fn exitShift(position: vec3f, direction: vec3f) -> vec2f {
  let floorZ = -(SLAB_CORE + BEVEL) - TEXT_PLANE_DEPTH;
  let travel = (floorZ - position.z) / min(direction.z, -0.05);
  return position.xy + direction.xy * travel;
}

fn traceGlass(entry: vec3f, normal: vec3f) -> GlassExit {
  var direction = refract(vec3f(0.0, 0.0, -1.0), normal, 1.0 / GLASS_IOR);
  var position = entry + direction * 0.01;
  var path = 0.0;
  var trapped = 0.0;
  for (var bounce = 0; bounce < BOUNCES; bounce += 1) {
    var travel = 0.0;
    for (var step = 0; step < INNER_STEPS; step += 1) {
      let distance = -slabDistance(position + direction * travel);
      if (distance < 0.003) { break; }
      travel += max(distance, 0.02);
    }
    path += travel;
    position += direction * travel;
    let exitNormal = -slabNormal(position);
    let green = refract(direction, exitNormal, GLASS_IOR);
    if (dot(green, green) < 0.5) {
      direction = reflect(direction, exitNormal);
      position += direction * 0.01;
      trapped += 1.0;
      continue;
    }
    let red = refract(direction, exitNormal, GLASS_IOR - GLASS_DISPERSION);
    let blue = refract(direction, exitNormal, GLASS_IOR + GLASS_DISPERSION);
    return GlassExit(
      exitShift(position, green) - entry.xy,
      exitShift(position, select(green, red, dot(red, red) > 0.5)) - entry.xy,
      exitShift(position, select(green, blue, dot(blue, blue) > 0.5)) - entry.xy,
      path,
      trapped,
    );
  }
  let fallback = position.xy - entry.xy;
  return GlassExit(fallback, fallback, fallback, path, trapped);
}

fn refractedField(position: vec2f, shiftUnits: vec2f, lens: Lens, colors: Palette, weight: vec3f) -> vec3f {
  var shift = rotate(shiftUnits * lens.scale, lens.angle);
  let length2 = dot(shift, shift);
  if (length2 > REFRACT_MAX_PX * REFRACT_MAX_PX) { shift *= REFRACT_MAX_PX / sqrt(length2); }
  return encryptedColor(position + shift, colors, min(1.0, weight.x * 2.4 + 0.3), 1.0, NO_BEAM, mix(1.7, 3.2, params.theme));
}

fn glassInterior(position: vec2f, colors: Palette, d: f32, keyPoint: vec2f, lens: Lens) -> vec3f {
  let dark = 1.0 - params.theme;
  let depth = -d - BEVEL;
  let magnified = position - (position - lens.center) * 0.08 + rotate(vec2f(0.0, -0.9), lens.angle) * lens.scale;
  let behind = encryptedColor(magnified, colors, 1.0, mix(BEHIND_GLASS_FOCUS, LIGHT_BEHIND_FOCUS, params.theme), NO_BEAM, mix(DARK_BEHIND_GAIN, LIGHT_BEHIND_GAIN, params.theme));
  let darkBody = behind * vec3f(0.84, 0.97, 0.9) + colors.accent * (0.008 + 0.04 * exp(-max(depth, 0.0) / 0.9));
  let lightBody = behind * LIGHT_BODY_TINT;
  var body = mix(lightBody, darkBody, dark);

  let parallax = rotate(BACK_FACE_PARALLAX, -lens.angle);
  let back = sdKey(keyPoint - parallax) + BEVEL * 0.5;
  let backEdge = exp(-pow(back / (1.1 / lens.scale + 0.06), 2.0));
  let backInk = mix(colors.text * 0.55, colors.accent * 0.55 + vec3f(0.04), dark);
  body = mix(body, backInk, backEdge * mix(0.3, 0.4, dark));
  return body;
}

fn glassColor(position: vec2f, keyPoint: vec2f, d: f32, gradientKey: vec2f, lens: Lens, colors: Palette, beam: BeamSample, weight: vec3f) -> vec3f {
  let localPx = (keyPoint - KEY_CENTER) * lens.scale;
  let dark = 1.0 - params.theme;
  let interior = glassInterior(position, colors, d, keyPoint, lens);

  var normal = vec3f(0.0, 0.0, 1.0);
  var entryZ = SLAB_CORE + BEVEL;
  let bevelOffset = d + BEVEL;
  if (bevelOffset > 0.0) {
    let e = min(bevelOffset, BEVEL * 0.999);
    let lift = sqrt(BEVEL * BEVEL - e * e);
    entryZ = SLAB_CORE + lift;
    normal = normalize(vec3f(gradientKey * e, lift));
  }

  var transmitted: vec3f;
  var path = 2.0 * (SLAB_CORE + BEVEL);
  var trapped = 0.0;
  if (bevelOffset > 0.0) {
    let exit = traceGlass(vec3f(keyPoint, entryZ), normal);
    path = exit.path;
    trapped = exit.trapped;
    let red = refractedField(position, exit.shiftRed, lens, colors, weight);
    let green = refractedField(position, exit.shift, lens, colors, weight);
    let blue = refractedField(position, exit.shiftBlue, lens, colors, weight);
    let field = vec3f(red.r, green.g, blue.b);
    let band = smoothstep(0.0, BEVEL * 0.35, bevelOffset);
    transmitted = mix(interior, mix(field * vec3f(0.9, 1.0, 0.96), field, params.theme), band);
  } else {
    transmitted = tableInk(localPx, lens, colors, interior);
  }

  let tint = mix(vec3f(0.88, 1.0, 0.94), vec3f(0.965, 0.99, 0.977), params.theme);
  transmitted *= pow(tint, vec3f(path * 0.25));

  let worldNormal = vec3f(rotate(normal.xy, lens.angle), normal.z);
  let toLight = normalize(vec3f(TO_LIGHT_2D, 0.75));
  let reflected = reflect(vec3f(0.0, 0.0, -1.0), worldNormal);
  var color = mix(transmitted, environment(reflected, colors, toLight), fresnel(worldNormal.z));

  let beamOnGlass = clamp(max(max(beam.incoming, beam.outgoing), beam.hot), 0.0, 1.0);
  let spread = 0.04;
  let glint = vec3f(
    pow(max(dot(reflected, normalize(toLight + vec3f(-spread, 0.0, 0.0))), 0.0), 160.0),
    pow(max(dot(reflected, toLight), 0.0), 160.0),
    pow(max(dot(reflected, normalize(toLight + vec3f(spread, 0.0, 0.0))), 0.0), 160.0),
  );
  color += WARM_WHITE * glint * mix(1.2, 0.8, params.theme) * (0.5 + 1.2 * beamOnGlass);

  let outward = rotate(gradientKey, lens.angle);
  let facing = dot(outward, TO_LIGHT_2D);
  let inset = -d;
  let streakLine = exp(-pow((inset - BEVEL * 0.32) / (BEVEL * mix(0.16, 0.2, params.theme)), 2.0));
  let streak = streakLine * smoothstep(0.02, 0.55, facing);
  let lightFacing = smoothstep(0.02, 0.55, facing);
  let refractionBand = exp(-pow((inset - BEVEL * 0.66) / (BEVEL * 0.18), 2.0)) * lightFacing;
  let bevelDepth = smoothstep(BEVEL * 1.02, BEVEL * 0.1, inset);
  let shadeSide = 0.6 + 0.4 * (1.0 - lightFacing);
  color = mix(color, color * LIGHT_BEVEL_SHADE, bevelDepth * shadeSide * params.theme);
  let refractionEdge = 1.0 - smoothstep(0.6, 1.4, abs(inset - BEVEL) * lens.scale);
  color = mix(color, colors.text * 0.6 + colors.accent * 0.25, refractionEdge * mix(0.22, 0.42, 1.0 - lightFacing) * params.theme);
  color = mix(color, colors.text * 0.55 + colors.accent * 0.3, refractionBand * 0.3 * params.theme);
  let lightStreak = exp(-pow((inset - BEVEL * 0.3) / max(BEVEL * 0.1, 1.1 / lens.scale), 2.0)) * smoothstep(0.02, 0.45, facing);
  color = mix(color, WARM_WHITE * 1.15, clamp(streak * 0.95, 0.0, 1.0) * (1.0 - params.theme));
  color = mix(color, vec3f(1.0), clamp(lightStreak, 0.0, 1.0) * params.theme);

  let shadowSide = smoothstep(-0.1, -0.7, facing);
  let innerLine = exp(-pow((inset - BEVEL * 0.7) / (BEVEL * 0.14), 2.0)) * shadowSide;
  let causticRipple = 0.6 + 0.4 * valueNoise(keyPoint * vec2f(0.8, 2.2) + vec2f(params.time * 0.25, 0.0));
  let innerGlow = exp(-max(inset - BEVEL, 0.0) / 1.3) * shadowSide * smoothstep(0.0, BEVEL, inset) * causticRipple;
  color += colors.accent * (innerLine * 0.55 + innerGlow * 0.2) * dark;
  color = mix(color, colors.accent, (innerLine * 0.25 + innerGlow * 0.1) * params.theme);

  let rimBand = smoothstep(-BEVEL, 0.0, d);
  color += colors.accent * trapped * 0.06 * dark * (0.4 + beamOnGlass);
  color += mix(colors.accent, beam.hue, 0.5) * beamOnGlass * (0.06 + 0.3 * rimBand) * dark;
  color = mix(color, mix(HOT_GOLD * colors.bg, beam.hue, 0.5), beamOnGlass * 0.12 * params.theme);
  let underside = clamp(-facing, 0.0, 1.0) * rimBand;
  color = mix(color, colors.text * 0.6 + colors.accent * 0.4, underside * 0.34 * params.theme);
  color *= 1.0 - underside * 0.25 * dark;

  let sweepPhase = fract(params.time * 0.07);
  let sweepLine = dot(position - lens.center, normalize(vec2f(1.0, -0.6))) / (lens.scale * 30.0) - (sweepPhase * 3.0 - 1.5);
  color += vec3f(exp(-sweepLine * sweepLine * 90.0) * 0.05 * dark);
  return color;
}

fn lightCaustic(position: vec2f, lens: Lens) -> f32 {
  let focusPoint = bowCenterWorld(lens) - TO_LIGHT_2D * (BOW_OUTER + 2.2) * lens.scale;
  let rel = position - focusPoint;
  let along = dot(rel, perpendicular(TO_LIGHT_2D)) / (BOW_OUTER * 0.45 * lens.scale);
  let across = dot(rel, TO_LIGHT_2D) / (0.9 * lens.scale);
  let ripple = 0.75 + 0.25 * valueNoise(rel / lens.scale * 1.4 + vec2f(params.time * 0.2, 0.0));
  return exp(-(along * along + across * across)) * ripple * (0.35 + 0.65 * params.beam) * 0.6;
}

fn darkGround(color: vec3f, position: vec2f, lens: Lens, colors: Palette, weight: vec3f) -> vec3f {
  let offset = SHADOW_OFFSET_UNITS * lens.scale;
  let shadowDistance = sdKey(toKeySpace(position - offset, lens)) * lens.scale;
  let shadow = exp(-max(shadowDistance, 0.0) / 22.0) * smoothstep(-26.0, 6.0, shadowDistance) * params.reveal;
  var lit = color * (1.0 - shadow * 0.62);
  let causticPoint = toKeySpace(position - offset * 0.82, lens);
  let causticDistance = sdKey(causticPoint);
  let ripple = 0.65 + 0.35 * valueNoise(causticPoint * 0.9 + vec2f(params.time * 0.15, 0.0));
  let caustic = (exp(-pow((causticDistance + 1.0) / 0.5, 2.0)) * 0.9 + smoothstep(0.3, -2.4, causticDistance) * 0.16) * ripple;
  let energy = caustic * params.reveal * (0.35 + 0.65 * params.beam) * weight.z;
  lit += colors.accent * energy * 0.42;
  let halo = exp(-max(shadowDistance, 0.0) / 70.0);
  return lit + colors.accent * halo * 0.035 * params.reveal * weight.z;
}

fn lightGround(color: vec3f, position: vec2f, distancePx: f32, lens: Lens, colors: Palette) -> vec3f {
  let contactDistance = sdKey(toKeySpace(position + TO_LIGHT_2D * CONTACT_OFFSET_PX, lens)) * lens.scale;
  let contact = exp(-max(contactDistance, 0.0) / CONTACT_FALLOFF_PX) * smoothstep(-3.0, 0.0, distancePx) * params.reveal;
  let lit = color * mix(vec3f(1.0), CONTACT_TINT, contact * 0.85);
  return mix(lit, LIGHT_CAUSTIC * colors.bg, lightCaustic(position, lens) * params.reveal);
}

fn groundLight(color: vec3f, position: vec2f, distancePx: f32, lens: Lens, colors: Palette, weight: vec3f) -> vec3f {
  var dark = color;
  var light = color;
  if (params.theme < 1.0) { dark = darkGround(color, position, lens, colors, weight); }
  if (params.theme > 0.0) { light = lightGround(color, position, distancePx, lens, colors); }
  return mix(dark, light, params.theme);
}

fn hotBloom(color: vec3f, beam: BeamSample, colors: Palette) -> vec3f {
  let darkHot = color + WARM_WHITE * beam.hot * 0.95;
  let core = clamp(beam.hot - 0.55, 0.0, 1.0);
  let lightHot = mix(mix(color, LIGHT_BLOOM, clamp(beam.hot * 0.85, 0.0, 0.9)), vec3f(1.0), core);
  return mix(darkHot, lightHot, params.theme);
}

fn segmentDistance(p: vec2f, a: vec2f, b: vec2f) -> vec2f {
  let ab = b - a;
  let t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return vec2f(length(p - a - ab * t), t);
}

fn bentPath(color: vec3f, position: vec2f, lens: Lens, colors: Palette) -> vec3f {
  let beamStrength = params.beam * (1.0 - params.theme);
  if (beamStrength <= 0.0) { return color; }
  let center = bowCenterWorld(lens);
  let inside = smoothstep(0.3, -0.6, length(position - center) / lens.scale - BOW_OUTER);
  if (inside <= 0.0) { return color; }
  let path = segmentDistance(position, beamEntry(lens), beamExit(lens));
  let across = path.x / lens.scale;
  let glow = (exp(-across * across * 1.4) + exp(-across * across * 0.12) * 0.25) * inside * beamStrength;
  let hue = mix(WARM_WHITE, colors.accent * 1.1, smoothstep(0.15, 0.85, path.y));
  let lightTint = mix(vec3f(1.0), mix(vec3f(1.0, 0.985, 0.95), mix(vec3f(1.0), colors.accent, LIGHT_FAN_FILTER), smoothstep(0.15, 0.85, path.y)), clamp(glow * 0.8, 0.0, 1.0));
  return mix(color + hue * glow * 0.42, color * lightTint, params.theme);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let colors = palette();
  let position = uv * params.resolution / params.dpr;
  let lens = currentLens();
  let pixel = 1.0 / params.dpr;
  let dark = 1.0 - params.theme;

  let keyPoint = toKeySpace(position, lens);
  let d = sdKey(keyPoint);
  let distancePx = d * lens.scale;
  let beam = beamAt(position, lens);
  let coverage = smoothstep(pixel, -pixel, distancePx) * params.reveal;
  let weight = fieldWeight(position, keyPoint, d, lens);

  var gradientKey = vec2f(0.0, 1.0);
  if (distancePx < 90.0) { gradientKey = keyGradient(keyPoint, d); }
  let facing = dot(rotate(gradientKey, lens.angle), TO_LIGHT_2D);
  let towardLight = clamp(facing * 0.5 + 0.5, 0.0, 1.0);

  var color = colors.bg;
  if (coverage < 1.0) {
    color = encryptedColor(position, colors, weight.x, weight.y, beam, 1.0);
    if (distancePx < 260.0) { color = groundLight(color, position, distancePx, lens, colors, weight); }
    let localShade = exp(-max(distancePx, 0.0) / LOCAL_VIGNETTE_PX) * params.reveal;
    color *= 1.0 - localShade * mix(0.22, LIGHT_LOCAL_SHADE, params.theme);
    color = beamLight(color, beam, colors);
    let outer = exp(-max(distancePx, 0.0) / 7.0) * params.reveal * dark;
    color += WARM_WHITE * outer * pow(towardLight, 3.0) * 0.16 + colors.accent * outer * (1.0 - towardLight) * 0.07;
  }

  if (coverage > 0.0) {
    let glass = glassColor(position, keyPoint, d, gradientKey, lens, colors, beam, weight);
    color = mix(color, glass, coverage);
  }
  color = bentPath(color, position, lens, colors);
  color = hotBloom(color, beam, colors);

  let shadowSide = 1.0 - towardLight;
  let darkRimProfile = exp(-abs(distancePx + 0.4) * params.dpr * 0.85);
  let inkHalfWidth = mix(0.55, 1.05, smoothstep(0.35, 0.8, shadowSide));
  let inkProfile = 1.0 - smoothstep(inkHalfWidth - 0.5 * pixel, inkHalfWidth + 0.5 * pixel, abs(distancePx + inkHalfWidth));
  let rim = mix(darkRimProfile, inkProfile, params.theme) * params.reveal;
  let darkRim = mix(vec3f(0.6, 0.95, 0.8), WARM_WHITE, towardLight);
  let darkRimAlpha = 0.32 + 0.68 * towardLight;
  let lightRimAlpha = 0.28 + 0.66 * smoothstep(0.3, 0.85, shadowSide);
  color = mix(color, mix(darkRim, colors.text, params.theme), clamp(rim * mix(darkRimAlpha, lightRimAlpha, params.theme), 0.0, 1.0));

  let grain = (unitHash(hash2(i32(uv.x * params.resolution.x), i32(uv.y * params.resolution.y) + i32(params.time * 30.0) * 7919)) - 0.5) / 255.0 * 1.5;
  return vec4f(color + grain, 1.0);
}
