import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  classesFor,
  type DeviceConfig,
  deviceClassOf,
  parseDeviceClasses,
  parseDeviceConfig,
  readDeviceClasses,
  readDeviceConfig,
} from '@/design/device-classes'
import {
  DEVICE_CLASSES_CASES,
  DEVICE_CONFIG_CASES,
} from '@/design/fixtures/device-classes'

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

const CONFIG_READ_CASES = DEVICE_CONFIG_CASES.flatMap(
  ({ name, config, expected }) =>
    'default' in expected ? [{ name, config, expected }] : [],
)

const CONFIG_REFUSED_CASES = DEVICE_CONFIG_CASES.flatMap(
  ({ name, config, expected }) =>
    'reason' in expected ? [{ name, config, expected }] : [],
)

const scopeClasses = (
  config: DeviceConfig,
): Record<string, readonly string[]> =>
  Object.fromEntries(config.scopes.map((scope) => [scope.name, scope.classes]))

describe('parseDeviceConfig', () => {
  it.each(CONFIG_READ_CASES)('reads $name', ({ config, expected }) => {
    const read = parseDeviceConfig(config)

    expect(
      read.ok && {
        default: read.config.default,
        scopes: scopeClasses(read.config),
      },
    ).toEqual(expected)
  })

  it.each(CONFIG_REFUSED_CASES)('refuses $name', ({ config, expected }) => {
    expect(parseDeviceConfig(config)).toMatchObject({ ok: false, ...expected })
  })

  it('names the field and the file in the refusal message', () => {
    const read = parseDeviceConfig(
      '[device-classes]\ndefault = ["watch"]\nwhy = "x"\n',
    )

    expect(read).toMatchObject({
      ok: false,
      message: expect.stringContaining(
        'device-classes.default in canon/config/design.toml',
      ),
    })
  })
})

describe('readDeviceConfig', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'device-config-'))
  })

  afterEach(() => {
    rmSync(root, { force: true, recursive: true })
  })

  it('reads canon/config/design.toml under the project root', () => {
    mkdirSync(join(root, 'canon', 'config'), { recursive: true })
    writeFileSync(
      join(root, 'canon', 'config', 'design.toml'),
      '[device-classes]\ndefault = ["desktop"]\nwhy = "A canvas"\n',
    )

    expect(readDeviceConfig(root)).toEqual({
      ok: true,
      config: { default: ['desktop'], scopes: [] },
    })
  })

  it('supports all three classes for a root holding no config', () => {
    expect(readDeviceConfig(root)).toEqual({
      ok: true,
      config: { default: ['phone', 'tablet', 'desktop'], scopes: [] },
    })
  })
})

describe('classesFor', () => {
  const config: DeviceConfig = {
    default: ['desktop'],
    scopes: [
      {
        name: 'landing',
        groups: ['landing'],
        paths: ['web/'],
        classes: ['phone', 'tablet', 'desktop'],
      },
      {
        name: 'print',
        groups: [],
        paths: ['src/print/'],
        classes: ['tablet'],
      },
    ],
  }

  it('reads the default for no input', () => {
    expect(classesFor(config, {})).toEqual({
      classes: ['desktop'],
      scopes: [],
      defaulted: true,
    })
  })

  it('reads a scope alone for a path under its prefix', () => {
    expect(classesFor(config, { paths: ['web/src/index.astro'] })).toEqual({
      classes: ['phone', 'tablet', 'desktop'],
      scopes: ['landing'],
      defaulted: false,
    })
  })

  it('adds the default for a path no scope matches', () => {
    expect(
      classesFor(config, { paths: ['src/print/page.tsx', 'src/app.tsx'] }),
    ).toEqual({
      classes: ['tablet', 'desktop'],
      scopes: ['print'],
      defaulted: true,
    })
  })

  it('takes the union of two scopes, in reader order', () => {
    expect(
      classesFor(config, { paths: ['src/print/page.tsx', 'web/index.html'] }),
    ).toEqual({
      classes: ['phone', 'tablet', 'desktop'],
      scopes: ['landing', 'print'],
      defaulted: false,
    })
  })

  it('matches a path under the design folder of a scope group', () => {
    expect(
      classesFor(config, { paths: ['canon/design/landing/hero.html'] }),
    ).toMatchObject({ scopes: ['landing'], defaulted: false })
  })

  it('matches a group by name, and the default for an unscoped group', () => {
    expect(classesFor(config, { groups: ['landing', 'board'] })).toEqual({
      classes: ['phone', 'tablet', 'desktop'],
      scopes: ['landing'],
      defaulted: true,
    })
  })

  it('never matches a group folder that only shares a prefix', () => {
    expect(
      classesFor(config, { paths: ['canon/design/landing-old/hero.html'] }),
    ).toMatchObject({ scopes: [], defaulted: true })
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
