import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countFiles, type LanguageCount } from '@/comments/scan'
import { listCommits, readRevision } from '@/comments/trend'

const REPO = process.cwd()

/**
 * The commits `01-current-state.md` measured, with the figures it recorded.
 *
 * These are real commits in this repository, so the replay is skipped rather
 * than failed when they are unreachable. CI checks out at depth 1, and a fork
 * or a shallow clone has the same gap. Locally the assertion is the real check
 * the groundwork asked for.
 */
const TYPESCRIPT_SERIES = [
  { rev: 'ef8c4b07', lines: 726, commentLines: 0, inlineComments: 0 },
  { rev: '19c2a64d', lines: 787, commentLines: 0, inlineComments: 0 },
  { rev: '3581f175', lines: 2393, commentLines: 0, inlineComments: 0 },
  { rev: 'b6c21855', lines: 2393, commentLines: 0, inlineComments: 0 },
  { rev: 'e45f0907', lines: 16781, commentLines: 1003, inlineComments: 18 },
]

const BASH_REV = 'e45f0907'

function hasHistory(): boolean {
  try {
    for (const { rev } of TYPESCRIPT_SERIES) {
      execSync(`git -C ${REPO} rev-parse --quiet --verify ${rev}^{commit}`, {
        stdio: 'ignore',
      })
    }
    return true
  } catch {
    return false
  }
}

const SHALLOW = !hasHistory()

async function countAt(
  dir: string,
  rev: string,
  language: 'ts' | 'sh',
): Promise<LanguageCount> {
  const files = await readRevision(join(REPO, dir), rev, [language])
  const [count] = countFiles(files, { languages: [language] })
  return count
}

describe('listCommits', () => {
  it.skipIf(SHALLOW)(
    'should return the range oldest first with a date per commit',
    async () => {
      const commits = await listCommits(REPO, 'b6c21855')

      expect(commits.length).toBeGreaterThan(0)
      expect(commits[0].date <= commits[commits.length - 1].date).toBe(true)
      expect(commits[0].rev).toMatch(/^[0-9a-f]{40}$/)
    },
  )

  it.skipIf(SHALLOW)(
    'should include the boundary commit so the trend keeps its baseline',
    async () => {
      const commits = await listCommits(REPO, 'b6c21855')

      expect(commits[0].rev.startsWith('b6c21855')).toBe(true)
    },
  )

  it('should return nothing for a revision git cannot resolve', async () => {
    expect(await listCommits(REPO, 'not-a-real-ref')).toEqual([])
  })
})

describe('readRevision', () => {
  it.skipIf(SHALLOW)(
    'should read blob contents at a revision without checking anything out',
    async () => {
      const files = await readRevision(join(REPO, 'src'), 'ef8c4b07', ['ts'])

      expect(files.length).toBeGreaterThan(0)
      expect(files.every((file) => file.text.length > 0)).toBe(true)
    },
  )

  it('should return nothing for an unresolvable revision', async () => {
    expect(await readRevision(REPO, 'not-a-real-ref')).toEqual([])
  })

  /**
   * A git hook exports `GIT_DIR`, and it overrides `-C` when git resolves the
   * repository. Without the strip, a scan scoped to a subtree silently returns
   * the whole repository from any hook-invoked run, which is wrong output
   * rather than a failure.
   */
  it.skipIf(SHALLOW)(
    'should stay scoped to the subtree when GIT_DIR is set in the environment',
    async () => {
      const previous = process.env.GIT_DIR
      process.env.GIT_DIR = join(REPO, '.git')

      try {
        const files = await readRevision(join(REPO, 'src'), 'ef8c4b07', ['ts'])

        expect(files.length).toBeGreaterThan(0)
        expect(files.every((file) => !file.path.startsWith('src/'))).toBe(true)
      } finally {
        if (previous === undefined) delete process.env.GIT_DIR
        else process.env.GIT_DIR = previous
      }
    },
  )
})

/**
 * The check the groundwork asked for: point the arm at the commits the folder
 * measured and confirm the figures agree. Disagreement means either the
 * command is wrong or the folder is, and both are worth knowing.
 */
describe('scanRevision replay against the comment-discipline groundwork', () => {
  it.skipIf(SHALLOW)(
    'should reproduce the recorded TypeScript series exactly',
    async () => {
      const measured = []
      for (const { rev } of TYPESCRIPT_SERIES) {
        const count = await countAt('src', rev, 'ts')
        measured.push({
          rev,
          lines: count.lines,
          commentLines: count.commentLines,
          inlineComments: count.inlineComments,
        })
      }

      expect(measured).toEqual(TYPESCRIPT_SERIES)
    },
    30_000,
  )

  it.skipIf(SHALLOW)(
    'should reproduce the recorded JSDoc block count at the measured commit',
    async () => {
      const count = await countAt('src', 'e45f0907', 'ts')

      expect(count.docBlocks).toBe(198)
    },
    30_000,
  )

  /**
   * The folder's bash history table is the naive count its own snapshot
   * section calls an error, so the arm is expected to disagree with it. What
   * is asserted is the correction: heredoc bodies leave the count, which is
   * the whole difference between the recorded 427 and what a real measurement
   * of the same tree returns.
   */
  it.skipIf(SHALLOW)(
    'should report far fewer bash comments than the naive count the folder recorded',
    async () => {
      const count = await countAt('scripts', BASH_REV, 'sh')

      expect(count.commentLines).toBe(216)
      expect(count.commentLines).toBeLessThan(427)
    },
    30_000,
  )
})
