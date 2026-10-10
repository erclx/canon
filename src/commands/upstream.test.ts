import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI because every refusal reports through `process.exitCode`, and
 * an in-process call would set it on the test runner.
 */
async function run(args: string[]): Promise<{
  readonly record: Record<string, unknown>
  readonly exitCode: number | undefined
}> {
  const result = await execa(process.execPath, [CLI, 'upstream', ...args], {
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })

  return {
    record: JSON.parse(result.stdout) as Record<string, unknown>,
    exitCode: result.exitCode,
  }
}

describe('canon upstream', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-upstream-cmd-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  describe('fetch', () => {
    it('should refuse with no-cursor and name the flag when nothing is stored', async () => {
      const { record, exitCode } = await run([
        'fetch',
        '--json',
        '--root',
        root,
      ])

      expect(exitCode).toBe(1)
      expect(record).toMatchObject({ reason: 'no-cursor' })
      expect(record.message).toContain('--since')
    })

    it('should refuse a --since that is not a version', async () => {
      const { record } = await run([
        'fetch',
        '--json',
        '--root',
        root,
        '--since',
        'latest',
      ])

      expect(record).toMatchObject({ reason: 'bad-since' })
    })
  })

  describe('catalog', () => {
    it('should emit its sections in a fixed field order', async () => {
      const { record, exitCode } = await run([
        'catalog',
        '--json',
        '--root',
        REPO_ROOT,
      ])

      expect(exitCode).toBe(0)
      expect(Object.keys(record)).toEqual([
        'skills',
        'internalSkills',
        'verbs',
        'hooks',
        'gate',
        'gaps',
      ])
    })
  })

  describe('advance', () => {
    it('should record the cursor and then refuse to move it back', async () => {
      const first = await run([
        'advance',
        '2.1.289',
        '--intake',
        'a-slug',
        '--no-llms',
        '--json',
        '--root',
        root,
      ])
      const back = await run([
        'advance',
        '2.1.100',
        '--intake',
        'b-slug',
        '--no-llms',
        '--json',
        '--root',
        root,
      ])

      expect(first.record).toEqual({
        version: '2.1.289',
        intake: 'a-slug',
        advanced: true,
        llms: 'kept',
      })
      expect(back.record).toMatchObject({ reason: 'older-than-cursor' })
      expect(back.exitCode).toBe(1)
    })
  })
})
