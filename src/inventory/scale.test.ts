import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  normalizeColor,
  normalizeDuration,
  normalizeShadow,
  readScale,
} from '@/inventory/scale'

const RECORD = fileURLToPath(
  new URL('./fixtures/design-record.md', import.meta.url),
)

describe('readScale', () => {
  it('should read the color values as the page reader writes them', () => {
    expect(readScale(RECORD, 'color')).toEqual({
      kind: 'values',
      values: ['#ffffff', '#121212', 'rgba(0, 0, 0, 0.502)'],
    })
  })

  it('should read every typography width in px at a 16px root, once each', () => {
    expect(readScale(RECORD, 'font-size')).toEqual({
      kind: 'values',
      values: ['90px', '16px', '13px', '64px', '40px', '15px'],
    })
  })

  it('should read the radius column and skip a role carrying none', () => {
    expect(readScale(RECORD, 'radius')).toEqual({
      kind: 'values',
      values: ['12px'],
    })
  })

  it('should read the shadows from the second Shapes table in computed form', () => {
    expect(readScale(RECORD, 'shadow')).toEqual({
      kind: 'values',
      values: [
        'rgba(0, 0, 0, 0.07) 0px 0px 0px 1px',
        'rgba(0, 0, 0, 0.07) 0px 0px 0px 1px, #000000 0px 24px 60px -28px',
      ],
    })
  })

  it('should read the Motion durations and skip the curves', () => {
    expect(readScale(RECORD, 'duration')).toEqual({
      kind: 'values',
      values: ['120ms', '1000ms'],
    })
  })

  it('should report no record when the path is missing', () => {
    expect(readScale(join(tmpdir(), 'absent', 'DESIGN.md'), 'color')).toEqual({
      kind: 'no-record',
    })
  })
})

describe('readScale on an intent record', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'inventory-scale-'))
  })

  afterEach(() => {
    rmSync(root, { force: true, recursive: true })
  })

  it('should report no values rather than an empty scale', () => {
    const path = join(root, 'DESIGN.md')
    writeFileSync(
      path,
      '## Colors\n\n| Role | Property | Intent |\n| --- | --- | --- |\n| accent | `--color-accent` | the pip |\n',
    )

    expect(readScale(path, 'color')).toEqual({ kind: 'no-values' })
  })
})

describe('normalizers', () => {
  it('should write an opaque computed rgb as lowercase hex', () => {
    expect(normalizeColor('rgb(255, 107, 66)')).toBe('#ff6b42')
  })

  it('should keep a translucent color as rgba', () => {
    expect(normalizeColor('rgba(255,255,255,.06)')).toBe(
      'rgba(255, 255, 255, 0.06)',
    )
  })

  it('should read a token that is no color as nothing', () => {
    expect(normalizeColor('ANSI 31')).toBeUndefined()
  })

  it('should write seconds as milliseconds and skip zero', () => {
    expect(normalizeDuration('0.24s')).toBe('240ms')
    expect(normalizeDuration('0s')).toBeUndefined()
  })

  it('should move inset after the lengths as the browser computes it', () => {
    expect(normalizeShadow('inset 0 1px 0 #FFF')).toBe(
      '#ffffff 0px 1px 0px inset',
    )
  })
})
