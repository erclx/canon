import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const CLI = join(import.meta.dirname, '../cli.ts')

let ROOT = ''

interface Run {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
}

function canvas(...args: string[]): Run {
  const result = spawnSync('bun', [CLI, 'canvas', ...args, '--root', ROOT], {
    encoding: 'utf8',
    env: { ...process.env, CANON_NON_INTERACTIVE: '1', NO_COLOR: '1' },
  })
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-canvas-command-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('canon canvas', () => {
  it('should add a page and report it as one JSON record on stdout', () => {
    const run = canvas('page', 'add', 'drafts', '--json')

    expect(run.status).toBe(0)
    expect(JSON.parse(run.stdout)).toEqual({ ok: true, page: 'drafts' })
    expect(run.stderr).toContain('page drafts')
  })

  it('should add a frame at the size it was given', () => {
    canvas('page', 'add', 'drafts')

    const run = canvas(
      'frame',
      'add',
      'drafts',
      'hero',
      '--width',
      '390',
      '--height',
      '844',
      '--json',
    )

    const record = JSON.parse(run.stdout)
    expect(record).toMatchObject({
      ok: true,
      page: 'drafts',
      frame: 'hero',
      box: { x: 0, y: 0, width: 390, height: 844 },
    })
    expect(existsSync(record.path)).toBe(true)
  })

  it('should list pages and frames as JSON with nothing else on stdout', () => {
    canvas('page', 'add', 'drafts')
    canvas('frame', 'add', 'drafts', 'hero')

    const run = canvas('list', '--json')

    const record = JSON.parse(run.stdout)
    expect(record.pages).toEqual([
      expect.objectContaining({
        name: 'drafts',
        frames: [expect.objectContaining({ name: 'hero', width: 1440 })],
      }),
    ])
    expect(run.stdout.trim().split('\n')).toHaveLength(1)
  })

  it('should rename a page', () => {
    canvas('page', 'add', 'drafts')

    const run = canvas('page', 'rename', 'drafts', 'approved', '--json')

    expect(JSON.parse(run.stdout)).toEqual({
      ok: true,
      page: 'approved',
      from: 'drafts',
    })
  })

  it('should refuse a frame on a missing page with exit 1 and a reason', () => {
    const run = canvas('frame', 'add', 'missing', 'hero', '--json')

    expect(run.status).toBe(1)
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: false,
      reason: 'no-page',
    })
    expect(run.stderr).toContain('page missing does not exist')
  })

  it('should refuse a size that is not a positive integer', () => {
    canvas('page', 'add', 'drafts')

    const run = canvas('frame', 'add', 'drafts', 'hero', '--width', 'wide')

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('width and height must be positive')
  })
})
