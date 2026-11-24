import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  deviceClassOf,
  parseDeviceClasses,
  readDeviceClasses,
} from '@/design/device-classes'
import { DEVICE_CLASSES_CASES } from '@/design/fixtures/device-classes'

const READ_CASES = DEVICE_CLASSES_CASES.flatMap(({ name, record, expected }) =>
  'classes' in expected ? [{ name, record, classes: expected.classes }] : [],
)

const REFUSED_CASES = DEVICE_CLASSES_CASES.flatMap(
  ({ name, record, expected }) =>
    'refused' in expected ? [{ name, record, refused: expected.refused }] : [],
)

describe('parseDeviceClasses', () => {
  it.each(READ_CASES)('reads $name', ({ record, classes }) => {
    expect(parseDeviceClasses(record)).toEqual({ ok: true, classes })
  })

  it.each(REFUSED_CASES)('refuses $name', ({ record, refused }) => {
    expect(parseDeviceClasses(record)).toMatchObject({
      ok: false,
      reason: 'unknown-class',
      name: refused,
    })
  })

  it('names the accepted classes in the refusal message', () => {
    const read = parseDeviceClasses('## Layout\n\n- Device classes: watch\n')

    expect(read).toMatchObject({
      ok: false,
      message: expect.stringContaining('phone, tablet, or desktop'),
    })
  })
})

describe('readDeviceClasses', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'device-classes-'))
  })

  afterEach(() => {
    rmSync(root, { force: true, recursive: true })
  })

  it('reads canon/DESIGN.md under the project root', () => {
    mkdirSync(join(root, 'canon'))
    writeFileSync(
      join(root, 'canon', 'DESIGN.md'),
      '## Layout\n\n- Device classes: desktop\n',
    )

    expect(readDeviceClasses(root)).toEqual({ ok: true, classes: ['desktop'] })
  })

  it('reads all three for a root holding no record', () => {
    expect(readDeviceClasses(root)).toEqual({
      ok: true,
      classes: ['phone', 'tablet', 'desktop'],
    })
  })
})

describe('deviceClassOf', () => {
  it.each([
    [320, 'phone'],
    [599, 'phone'],
    [600, 'tablet'],
    [834, 'tablet'],
    [839, 'tablet'],
    [840, 'desktop'],
    [1536, 'desktop'],
  ])('places %i in %s', (width, expected) => {
    expect(deviceClassOf(width)).toBe(expected)
  })
})
