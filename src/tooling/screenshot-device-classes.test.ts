import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEVICE_CLASSES_CASES } from '@/design/fixtures/device-classes'

/**
 * Runs the shipped capture harness's inline reader of the `Device classes:`
 * line against the cases `@/design/device-classes` is tested on, so the two
 * readers cannot drift. The print flag exits before a browser launches.
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

const runWith = (record: string | undefined) => {
  if (record !== undefined) {
    mkdirSync(join(project, 'canon'))
    writeFileSync(join(project, 'canon', 'DESIGN.md'), record)
  }
  return spawnSync('bun', [SCRIPT, '--print-device-classes'], {
    cwd: project,
    encoding: 'utf8',
  })
}

const READ_CASES = DEVICE_CLASSES_CASES.flatMap(({ name, record, expected }) =>
  'classes' in expected ? [{ name, record, classes: expected.classes }] : [],
)

const REFUSED_CASES = DEVICE_CLASSES_CASES.flatMap(
  ({ name, record, expected }) =>
    'refused' in expected ? [{ name, record, refused: expected.refused }] : [],
)

describe('screenshot.ts device classes', () => {
  it.each(READ_CASES)('reads $name', ({ record, classes }) => {
    const run = runWith(record)

    expect({ status: run.status, stdout: run.stdout.trim() }).toEqual({
      status: 0,
      stdout: classes.join(','),
    })
  })

  it.each(REFUSED_CASES)('exits 1 on $name', ({ record, refused }) => {
    const run = runWith(record)

    expect(run.status).toBe(1)
    expect(run.stderr).toContain(
      refused === '' ? 'names no device class' : `names '${refused}'`,
    )
  })
})
