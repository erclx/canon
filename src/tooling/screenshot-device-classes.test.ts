import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEVICE_CONFIG_CASES } from '@/design/fixtures/device-classes'

/**
 * Runs the shipped capture harness's inline reader of `[device-classes]`, in
 * `canon/config/app.toml` and in the `device-classes.toml` before it, against the
 * cases `@/design/device-classes` is tested on, so the two readers cannot drift.
 * The print flag exits before a browser launches.
 */

const FILES = ['app.toml', 'device-classes.toml'] as const

const SCRIPT = join(
  import.meta.dirname,
  '../../tooling/web/configs/e2e/screenshot.ts',
)

let project: string

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'screenshot-device-classes-'))
})

afterEach(() => {
  rmSync(project, { force: true, recursive: true })
})

const write = (file: string, config: string | undefined): void => {
  if (config === undefined) return
  mkdirSync(join(project, 'canon', 'config'), { recursive: true })
  writeFileSync(join(project, 'canon', 'config', file), config)
}

const run = (flag: string) =>
  spawnSync('bun', [SCRIPT, flag], { cwd: project, encoding: 'utf8' })

const READ_CASES = FILES.flatMap((file) =>
  DEVICE_CONFIG_CASES.flatMap(({ name, config, expected }) =>
    'default' in expected ? [{ file, name, config, expected }] : [],
  ),
)

const SCOPE_CASES = READ_CASES.flatMap(({ file, name, config, expected }) =>
  Object.entries(expected.scopes).map(([scope, classes]) => ({
    file,
    name,
    config,
    scope,
    classes,
  })),
)

const REFUSED_CASES = FILES.flatMap((file) =>
  DEVICE_CONFIG_CASES.flatMap(({ name, config, expected }) =>
    'reason' in expected ? [{ file, name, config, field: expected.field }] : [],
  ),
)

describe('screenshot.ts device classes', () => {
  it.each(READ_CASES)(
    'reads the default of $name from $file',
    ({ file, config, expected }) => {
      write(file, config)

      const result = run('--print-device-classes')

      expect({ status: result.status, stdout: result.stdout.trim() }).toEqual({
        status: 0,
        stdout: expected.default.join(','),
      })
    },
  )

  it.each(SCOPE_CASES)(
    'reads scope $scope of $name from $file',
    ({ file, config, scope, classes }) => {
      write(file, config)

      const result = run(`--print-device-classes=${scope}`)

      expect({ status: result.status, stdout: result.stdout.trim() }).toEqual({
        status: 0,
        stdout: classes.join(','),
      })
    },
  )

  it.each(REFUSED_CASES)(
    'exits 1 on $name from $file',
    ({ file, config, field }) => {
      write(file, config)

      const result = run('--print-device-classes')

      expect(result.status).toBe(1)
      expect(result.stderr).toContain(
        field === ''
          ? `canon/config/${file}`
          : `${field} in canon/config/${file}`,
      )
    },
  )

  it('takes the app.toml table over device-classes.toml', () => {
    write('app.toml', '[device-classes]\ndefault = ["phone"]\nwhy = "x"\n')
    write(
      'device-classes.toml',
      '[device-classes]\ndefault = ["desktop"]\nwhy = "x"\n',
    )

    const result = run('--print-device-classes')

    expect(result.stdout.trim()).toBe('phone')
  })

  it('reads device-classes.toml beside an app.toml holding no such table', () => {
    write('app.toml', '[drive]\nlaunch = "bun run dev"\n')
    write(
      'device-classes.toml',
      '[device-classes]\ndefault = ["desktop"]\nwhy = "x"\n',
    )

    const result = run('--print-device-classes')

    expect(result.stdout.trim()).toBe('desktop')
  })

  it('exits 1 on a scope the config does not declare', () => {
    const result = run('--print-device-classes=landing')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("No scope 'landing'")
  })
})
