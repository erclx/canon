import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  classesFor,
  type DeviceConfig,
  deviceClassOf,
  readDeviceConfig,
} from '@/design/device-classes'
import { DEVICE_CONFIG_CASES } from '@/design/fixtures/device-classes'

const FILES = ['app.toml', 'device-classes.toml'] as const

const CONFIG_READ_CASES = FILES.flatMap((file) =>
  DEVICE_CONFIG_CASES.flatMap(({ name, config, expected }) =>
    'default' in expected ? [{ file, name, config, expected }] : [],
  ),
)

const CONFIG_REFUSED_CASES = FILES.flatMap((file) =>
  DEVICE_CONFIG_CASES.flatMap(({ name, config, expected }) =>
    'reason' in expected ? [{ file, name, config, expected }] : [],
  ),
)

const scopeClasses = (
  config: DeviceConfig,
): Record<string, readonly string[]> =>
  Object.fromEntries(config.scopes.map((scope) => [scope.name, scope.classes]))

describe('readDeviceConfig', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'device-config-'))
  })

  afterEach(() => {
    rmSync(root, { force: true, recursive: true })
  })

  const write = (file: string, config: string | undefined): void => {
    if (config === undefined) return
    mkdirSync(join(root, 'canon', 'config'), { recursive: true })
    writeFileSync(join(root, 'canon', 'config', file), config)
  }

  it.each(CONFIG_READ_CASES)(
    'reads $name from $file',
    ({ file, config, expected }) => {
      write(file, config)

      const read = readDeviceConfig(root)

      expect(
        read.ok && {
          default: read.config.default,
          scopes: scopeClasses(read.config),
        },
      ).toEqual(expected)
    },
  )

  it.each(CONFIG_REFUSED_CASES)(
    'refuses $name from $file',
    ({ file, config, expected }) => {
      write(file, config)

      expect(readDeviceConfig(root)).toMatchObject({ ok: false, ...expected })
    },
  )

  it.each(FILES)('names the field and %s in the refusal message', (file) => {
    write(file, '[device-classes]\ndefault = ["watch"]\nwhy = "x"\n')

    expect(readDeviceConfig(root)).toMatchObject({
      ok: false,
      message: expect.stringContaining(
        `device-classes.default in canon/config/${file}`,
      ),
    })
  })

  it('takes the app.toml table over device-classes.toml', () => {
    write('app.toml', '[device-classes]\ndefault = ["phone"]\nwhy = "x"\n')
    write(
      'device-classes.toml',
      '[device-classes]\ndefault = ["desktop"]\nwhy = "x"\n',
    )

    expect(readDeviceConfig(root)).toEqual({
      ok: true,
      config: { default: ['phone'], scopes: [] },
    })
  })

  it('reads device-classes.toml beside an app.toml holding no such table', () => {
    write('app.toml', '[drive]\nlaunch = "bun run dev"\n')
    write(
      'device-classes.toml',
      '[device-classes]\ndefault = ["desktop"]\nwhy = "x"\n',
    )

    expect(readDeviceConfig(root)).toEqual({
      ok: true,
      config: { default: ['desktop'], scopes: [] },
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
