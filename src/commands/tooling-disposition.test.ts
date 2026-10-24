import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { seedPackage } from '@/process/seeded-package'
import { stampPath } from '@/sync/stamp'

const CLI = join(import.meta.dirname, '../cli.ts')
const WORKFLOW = '.github/workflows/readme-screenshot.yml'
const CONFIG = '.oxlintrc.json'

interface Run {
  readonly status: null | number
  readonly stderr: string
  readonly stdout: string
}

let target: string
let synced: string

// A git hook exports GIT_DIR, so a run under pre-push would resolve the fixture
// against the toolkit's own repository rather than the temp directory.
const env = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  )

const tooling = (args: readonly string[]): Run => {
  const run = spawnSync('bun', [CLI, 'tooling', ...args], {
    encoding: 'utf8',
    env: env(),
  })
  return { status: run.status, stderr: run.stderr, stdout: run.stdout }
}

const json = (run: Run): Record<string, unknown> => JSON.parse(run.stdout)

const syncWeb = (dir: string): Run => tooling(['sync', 'web', dir, '--write'])

/**
 * One synced target is copied per test, since a web sync costs seconds and
 * every case starts from the same state #2391 reported.
 */
beforeAll(() => {
  synced = mkdtempSync(join(tmpdir(), 'tooling-disposition-synced-'))
  seedPackage(synced, 'web')
  const run = syncWeb(synced)
  if (run.status !== 0) throw new Error(run.stderr)
})

afterAll(() => {
  rmSync(synced, { force: true, recursive: true })
})

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'tooling-disposition-'))
  spawnSync('cp', ['-a', `${synced}/.`, target])
})

afterEach(() => {
  rmSync(target, { force: true, recursive: true })
})

describe('tooling decline', () => {
  it('should keep a deleted workflow from coming back on sync', () => {
    unlinkSync(join(target, WORKFLOW))

    tooling(['decline', WORKFLOW, target])
    syncWeb(target)

    expect(existsSync(join(target, WORKFLOW))).toBe(false)
  })

  it('should leave diff clean once the deleted workflow is declined', () => {
    unlinkSync(join(target, WORKFLOW))
    tooling(['decline', WORKFLOW, target])

    expect(tooling(['diff', 'web', target]).status).toBe(0)
  })

  it('should list the declined path in the diff record', () => {
    unlinkSync(join(target, WORKFLOW))
    tooling(['decline', WORKFLOW, target, '--reason', 'no screenshots'])

    const record = json(tooling(['diff', 'web', target, '--json']))

    expect(record.dispositions).toEqual([
      {
        rel: WORKFLOW,
        stack: 'web',
        kind: 'config',
        disposition: 'declined',
        present: false,
      },
    ])
  })

  it('should record the reason in the stamp', () => {
    tooling(['decline', WORKFLOW, target, '--reason', 'no screenshots'])

    const stamp = JSON.parse(readFileSync(stampPath(target), 'utf8'))

    expect(stamp.domains.tooling.dispositions).toEqual({
      [WORKFLOW]: { disposition: 'declined', reason: 'no screenshots' },
    })
  })

  it('should answer with the recorded entry under --json', () => {
    const record = json(tooling(['decline', WORKFLOW, target, '--json']))

    expect(record).toEqual({
      ok: true,
      action: 'decline',
      path: WORKFLOW,
      entry: { disposition: 'declined' },
    })
  })

  it('should leave a declined file the project still holds in place', () => {
    tooling(['decline', WORKFLOW, target])
    syncWeb(target)

    expect(existsSync(join(target, WORKFLOW))).toBe(true)
  })
})

describe('tooling lift', () => {
  it('should hand the workflow back to the next sync', () => {
    unlinkSync(join(target, WORKFLOW))
    tooling(['decline', WORKFLOW, target])

    tooling(['lift', WORKFLOW, target])
    syncWeb(target)

    expect(existsSync(join(target, WORKFLOW))).toBe(true)
  })

  it('should refuse a path nothing holds', () => {
    const run = tooling(['lift', WORKFLOW, target, '--json'])

    expect(run.status).toBe(1)
    expect(json(run)).toMatchObject({ ok: false, reason: 'not-held' })
  })
})

describe('tooling customize', () => {
  const MINE = '{ "rules": {} }\n'

  it('should keep the project copy through a write', () => {
    writeFileSync(join(target, CONFIG), MINE)

    tooling(['customize', CONFIG, target])
    syncWeb(target)

    expect(readFileSync(join(target, CONFIG), 'utf8')).toBe(MINE)
  })

  it('should leave diff clean while the golden copy is unchanged', () => {
    writeFileSync(join(target, CONFIG), MINE)
    tooling(['customize', CONFIG, target])

    expect(tooling(['diff', 'web', target]).status).toBe(0)
  })

  it('should exit 1 from diff once the recorded golden no longer matches', () => {
    writeFileSync(join(target, CONFIG), MINE)
    tooling(['customize', CONFIG, target])
    const path = stampPath(target)
    const stamp = JSON.parse(readFileSync(path, 'utf8'))
    stamp.domains.tooling.dispositions[CONFIG].base = 'sha256:older'
    writeFileSync(path, JSON.stringify(stamp))

    const run = tooling(['diff', 'web', target, '--json'])

    expect(run.status).toBe(1)
    expect(json(run).dispositions).toEqual([
      expect.objectContaining({ rel: CONFIG, moved: true }),
    ])
  })

  it('should refuse a config the target does not hold', () => {
    unlinkSync(join(target, CONFIG))

    expect(
      json(tooling(['customize', CONFIG, target, '--json'])),
    ).toMatchObject({ ok: false, reason: 'missing-file' })
  })

  it('should refuse a path already declined', () => {
    tooling(['decline', CONFIG, target])

    expect(
      json(tooling(['customize', CONFIG, target, '--json'])),
    ).toMatchObject({ ok: false, reason: 'already-held' })
  })
})

describe('tooling disposition refusals', () => {
  it('should refuse a target with no recorded chain', () => {
    const bare = mkdtempSync(join(tmpdir(), 'tooling-disposition-bare-'))

    const run = tooling(['decline', WORKFLOW, bare, '--json'])
    rmSync(bare, { force: true, recursive: true })

    expect(run.status).toBe(1)
    expect(json(run)).toMatchObject({ ok: false, reason: 'no-chain' })
  })

  it('should refuse a path no recorded stack ships', () => {
    expect(
      json(tooling(['decline', 'nope.yml', target, '--json'])),
    ).toMatchObject({ ok: false, reason: 'not-golden' })
  })

  it('should refuse a path that leaves the target', () => {
    expect(
      json(tooling(['decline', '../outside.yml', target, '--json'])),
    ).toMatchObject({ ok: false, reason: 'bad-path' })
  })
})
