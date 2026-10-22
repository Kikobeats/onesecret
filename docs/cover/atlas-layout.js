export const ATLAS = Object.freeze({
  firstCode: 32,
  glyphCount: 95,
  columns: 16,
  rows: 6,
  texelsPerEm: 25,
  pad: 4,
  spread: 4,
  ascentEm: 0.95,
  descentEm: 0.33,
  advanceEm: 0.6,
  get cellWidth () {
    return Math.ceil(this.advanceEm * this.texelsPerEm) + 2 * this.pad
  },
  get cellHeight () {
    return (
      Math.ceil((this.ascentEm + this.descentEm) * this.texelsPerEm) +
      2 * this.pad
    )
  }
})
