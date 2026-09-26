import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectStateLeak, runCli, snapshotStateDir } from '@/process/harness'

let cwd: string

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'canon-harness-'))
})

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true })
})

describe('runCli', () => {
  it('should exit 0 for a verb that is registered', () => {
    const run = runCli(['standards', 'list', '--json'], { cwd })

    expect(run.status).toBe(0)
  })

  it('should parse the --json record off stdout for a registered verb', () => {
    const run = runCli(['standards', 'list', '--json'], { cwd })

    expect(run.json).toMatchObject({ standards: expect.any(Array) })
  })

  it('should exit non-zero for a subcommand nothing registers', () => {
    const run = runCli(['gov', 'not-a-real-subcommand'], { cwd })

    expect(run.status).not.toBe(0)
  })

  it('should name the unknown command on stderr rather than passing quietly', () => {
    const run = runCli(['gov', 'not-a-real-subcommand'], { cwd })

    expect(run.stderr).toContain('not-a-real-subcommand')
  })

  it('should leave json undefined when the command wrote none', () => {
    const run = runCli(['gov', 'not-a-real-subcommand'], { cwd })

    expect(run.json).toBeUndefined()
  })
})

describe('detectStateLeak', () => {
  it('should read no leak when both snapshots match', () => {
    expect(detectStateLeak(undefined, undefined)).toBe(false)
    expect(detectStateLeak('a/targets.json:12', 'a/targets.json:12')).toBe(
      false,
    )
  })

  it('should detect a leak when the snapshot changes', () => {
    expect(detectStateLeak(undefined, 'a/targets.json:12')).toBe(true)
    expect(
      detectStateLeak(
        'a/targets.json:12',
        'a/sandbox/scratch.txt:3\na/targets.json:12',
      ),
    ).toBe(true)
  })
})

describe('containment', () => {
  it("should leave this machine's real toolkit state untouched by gov install and gov sync", () => {
    const before = snapshotStateDir()

    runCli(['gov', 'install', 'base', cwd], { cwd })
    runCli(['gov', 'sync', cwd], { cwd })

    expect(snapshotStateDir()).toBe(before)
  })
})
