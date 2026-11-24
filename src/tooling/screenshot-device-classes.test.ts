import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEVICE_CONFIG_CASES } from '@/design/fixtures/device-classes'

/**
 * Runs the shipped capture harness's inline reader of `canon/config/device-classes.toml`
 * against the cases `@/design/device-classes` is tested on, so the two readers
 * cannot drift. The print flag exits before a browser launches.
 */

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

const runWith = (config: string | undefined, flag: string) => {
  if (config !== undefined) {
    mkdirSync(join(project, 'canon', 'config'), { recursive: true })
    writeFileSync(
      join(project, 'canon', 'config', 'device-classes.toml'),
      config,
    )
  }
  return spawnSync('bun', [SCRIPT, flag], { cwd: project, encoding: 'utf8' })
}

const READ_CASES = DEVICE_CONFIG_CASES.flatMap(({ name, config, expected }) =>
  'default' in expected ? [{ name, config, expected }] : [],
)

const SCOPE_CASES = READ_CASES.flatMap(({ name, config, expected }) =>
  Object.entries(expected.scopes).map(([scope, classes]) => ({
    name,
    config,
    scope,
    classes,
  })),
)

const REFUSED_CASES = DEVICE_CONFIG_CASES.flatMap(
  ({ name, config, expected }) =>
    'reason' in expected ? [{ name, config, field: expected.field }] : [],
)

describe('screenshot.ts device classes', () => {
  it.each(READ_CASES)('reads the default of $name', ({ config, expected }) => {
    const run = runWith(config, '--print-device-classes')

    expect({ status: run.status, stdout: run.stdout.trim() }).toEqual({
      status: 0,
      stdout: expected.default.join(','),
    })
  })

  it.each(SCOPE_CASES)(
    'reads scope $scope of $name',
    ({ config, scope, classes }) => {
      const run = runWith(config, `--print-device-classes=${scope}`)

      expect({ status: run.status, stdout: run.stdout.trim() }).toEqual({
        status: 0,
        stdout: classes.join(','),
      })
    },
  )

  it.each(REFUSED_CASES)('exits 1 on $name', ({ config, field }) => {
    const run = runWith(config, '--print-device-classes')

    expect(run.status).toBe(1)
    expect(run.stderr).toContain(
      field === '' ? 'canon/config/device-classes.toml' : `${field} in`,
    )
  })

  it('reads its own file beside a design.toml holding the board keys', () => {
    mkdirSync(join(project, 'canon', 'config'), { recursive: true })
    writeFileSync(
      join(project, 'canon', 'config', 'design.toml'),
      'board = ".canon/board"\nproject = "landing"\n',
    )

    const run = runWith(
      '[device-classes]\ndefault = ["desktop"]\nwhy = "A canvas"\n',
      '--print-device-classes',
    )

    expect({ status: run.status, stdout: run.stdout.trim() }).toEqual({
      status: 0,
      stdout: 'desktop',
    })
  })

  it('exits 1 on a scope the config does not declare', () => {
    const run = runWith(undefined, '--print-device-classes=landing')

    expect(run.status).toBe(1)
    expect(run.stderr).toContain("No scope 'landing'")
  })
})
