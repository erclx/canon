import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa, execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLI,
  PROXY_GH,
  RUN_TIMEOUT_MS,
  markedCommentBody,
} from '@/commands/pr/fixture'

describe('canon pr reads through REST alone', () => {
  let tempDir: string
  let repoRoot: string
  let tip: string

  function git(...args: string[]): string {
    return execaSync('git', ['-C', repoRoot, ...args], {
      env: {
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    }).stdout
  }

  function writeFixture(name: string, value: unknown): void {
    writeFileSync(
      join(tempDir, name),
      typeof value === 'string' ? value : JSON.stringify(value),
    )
  }

  function pullRow(overrides: Record<string, unknown> = {}) {
    return {
      number: 7,
      body: '## Key changes\n\n- Add `src/a.ts`.\n',
      head: { ref: 'feat/x', sha: tip },
      base: { ref: 'main' },
      mergeable_state: 'clean',
      ...overrides,
    }
  }

  function markedReview(commit: string, submittedAt: string) {
    return {
      body: `## Review\n\nbody\n\n<!-- review-pr: commit=${commit} read-at=2026-10-03T10:00:00Z -->`,
      commit_id: 'f'.repeat(40),
      submitted_at: submittedAt,
    }
  }

  async function runVerb(
    verb: string,
    args: string[],
  ): Promise<Record<string, unknown>> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', verb, ...args, '--json', '--root', repoRoot],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: {
          PATH: `${join(tempDir, 'bin')}:${process.env.PATH}`,
          FAKE_DIR: tempDir,
        },
      },
    )
    return JSON.parse(result.stdout)
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-rest-'))
    repoRoot = join(tempDir, 'repo')
    mkdirSync(repoRoot)
    mkdirSync(join(tempDir, 'bin'))
    writeFileSync(join(tempDir, 'bin', 'gh'), PROXY_GH, { mode: 0o755 })
    git('init', '-q', '-b', 'feat/x')
    writeFileSync(join(repoRoot, 'a.txt'), 'a')
    git('add', 'a.txt')
    git('commit', '-q', '-m', 'init')
    const bare = join(tempDir, 'origin.git')
    execaSync('git', ['init', '-q', '--bare', bare])
    git('remote', 'add', 'origin', bare)
    git('push', '-q', 'origin', 'feat/x')
    tip = git('rev-parse', 'HEAD').trim()
    writeFixture('pull.json', pullRow())
    writeFixture('listing.json', [pullRow()])
    writeFixture('reviews.json', [])
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should read the head of a named pull request', async () => {
    const record = await runVerb('head', ['7'])

    expect(record).toMatchObject({ number: 7, state: 'fresh', tip })
  })

  it('should resolve the pull request open on the checkout branch', async () => {
    const record = await runVerb('head', [])

    expect(record).toMatchObject({ number: 7, branch: 'feat/x' })
  })

  it('should refuse as ambiguous-pull when two open pull requests share the branch', async () => {
    writeFixture('listing.json', [
      pullRow(),
      pullRow({ number: 8, base: { ref: 'release' } }),
    ])

    const record = await runVerb('head', [])

    expect(record.reason).toBe('ambiguous-pull')
  })

  it('should read a dirty pull request with no run as conflicted', async () => {
    writeFixture('pull.json', pullRow({ mergeable_state: 'dirty' }))

    const record = await runVerb('checks', ['7'])

    expect(record).toMatchObject({ conflicted: true, mergeState: 'DIRTY' })
  })

  it('should not read an unknown merge state as conflicted', async () => {
    writeFixture('pull.json', pullRow({ mergeable_state: 'unknown' }))

    const record = await runVerb('checks', ['7'])

    expect(record).toMatchObject({ conflicted: false, mergeState: 'UNKNOWN' })
  })

  it('should take the covered range from the newest marker across pages', async () => {
    const pages = [
      [markedReview('aaaaaaa', '2026-10-03T09:00:00Z')],
      [
        markedReview('bbbbbbb', '2026-10-03T10:01:00Z'),
        {
          body: `## UI review closed\n\nall boxes\n\n<!-- review-ui: head=${tip} -->`,
          commit_id: 'f'.repeat(40),
          submitted_at: '2026-10-03T10:02:00Z',
        },
      ],
    ]
    writeFixture(
      'reviews.json',
      pages.map((page) => JSON.stringify(page)).join('\n'),
    )

    const record = await runVerb('review-state', ['7'])

    expect(record).toMatchObject({
      number: 7,
      state: 'open',
      commit: 'bbbbbbb',
      source: 'marker',
      head: tip,
      review: { reason: 'review-open', isCovered: false },
      ui: { state: 'closed', commit: tip, isBound: false, isCovered: true },
    })
  })

  it('should report timeout with the waited seconds when no pass covers the tip by the deadline', async () => {
    writeFixture('reviews.json', [
      markedReview('bbbbbbb', '2026-10-03T10:01:00Z'),
    ])

    const record = await runVerb('review-state', ['7', '--wait', '0'])

    expect(record).toMatchObject({
      reason: 'timeout',
      waitedSeconds: expect.any(Number),
      review: { isCovered: false },
    })
  })

  it('should refuse a review-state --wait that is not a whole number', async () => {
    const record = await runVerb('review-state', ['7', '--wait', 'soon'])

    expect(record.reason).toBe('bad-wait')
  })

  it('should refuse rather than report a first pass when the reviews read is refused', async () => {
    writeFixture('reviews-fail', '')

    const record = await runVerb('review-state', ['7'])

    expect(record.reason).toBe('gh-failed')
  })

  it('should compare a live pull request body against its files', async () => {
    const record = await runVerb('key-changes', ['7'])

    expect(record).toMatchObject({ unmet: [] })
  })

  describe('key-changes links', () => {
    const A_ANCHOR =
      'diff-072fc23b941d05af2383888f292b78e406e0e82a4a3f8ee698113dd9bcc79e5f'
    const B_ANCHOR =
      'diff-363f5941f4d8df68d4bd5a6a9fa72f57f452e7ea9880d3a622cdaae065f1b5fb'
    const FILES = 'https://github.com/acme/widgets/pull/7/files'

    async function runRaw(args: string[]) {
      return execa(process.execPath, [CLI, 'pr', 'key-changes', ...args], {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: {
          PATH: `${join(tempDir, 'bin')}:${process.env.PATH}`,
          FAKE_DIR: tempDir,
        },
      })
    }

    it('should print the body with a changed path linked to its diff', async () => {
      const result = await runRaw(['7', '--link', '--root', repoRoot])

      expect(result.stdout).toContain(
        `- Add [\`src/a.ts\`](${FILES}#${A_ANCHOR}).`,
      )
    })

    it('should rewrite a link whose anchor opens another file', async () => {
      writeFixture(
        'pull.json',
        pullRow({
          body: `## Key changes\n\n- Add [\`src/a.ts\`](${FILES}#${B_ANCHOR}).\n`,
        }),
      )

      const result = await runRaw(['7', '--link', '--root', repoRoot])

      expect(result.stdout).toContain(`(${FILES}#${A_ANCHOR})`)
    })

    it('should report a mislinked path and exit 2', async () => {
      writeFixture(
        'pull.json',
        pullRow({
          body: `## Key changes\n\n- Add [\`src/a.ts\`](${FILES}#${B_ANCHOR}).\n`,
        }),
      )

      const result = await runRaw(['7', '--json', '--root', repoRoot])

      expect(result.exitCode).toBe(2)
      expect(JSON.parse(result.stdout)).toMatchObject({
        mislinked: [{ path: 'src/a.ts', anchor: B_ANCHOR }],
      })
    })

    it('should refuse --link beside --json', async () => {
      const result = await runRaw(['7', '--link', '--json', '--root', repoRoot])

      expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'link-json' })
    })
  })

  describe('lift', () => {
    function stageClearPull(): void {
      git('push', '-q', 'origin', 'feat/x:main')
      git('fetch', '-q', 'origin')
      writeFixture(
        'pull.json',
        pullRow({ draft: true, state: 'open', node_id: 'PR_7' }),
      )
      writeFixture('reviews.json', [
        {
          body: `## Review closed\n\nclean\n\n<!-- review-pr: commit=${tip} read-at=2026-10-12T10:00:00Z -->`,
          commit_id: tip,
          submitted_at: '2026-10-12T10:01:00Z',
        },
      ])
      writeFixture('checks.json', {
        total_count: 1,
        check_runs: [
          {
            head_sha: tip,
            status: 'completed',
            conclusion: 'success',
            name: 'check',
            id: 1,
          },
        ],
      })
    }

    async function runLift(
      args: string[],
    ): Promise<{ record: Record<string, unknown>; exit: number }> {
      const result = await execa(
        process.execPath,
        [CLI, 'pr', 'lift', ...args, '--json', '--root', repoRoot],
        {
          cwd: repoRoot,
          reject: false,
          timeout: RUN_TIMEOUT_MS,
          env: {
            PATH: `${join(tempDir, 'bin')}:${process.env.PATH}`,
            FAKE_DIR: tempDir,
          },
        },
      )
      return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
    }

    function mutationCalls(): number {
      return readFileSync(join(tempDir, 'gh.log'), 'utf8')
        .split('\n')
        .filter((line) => line.includes('markPullRequestReadyForReview')).length
    }

    it('should lift the mark when every gate reads clear, over REST and one mutation', async () => {
      stageClearPull()

      const { record, exit } = await runLift(['7'])

      expect(record).toMatchObject({ reason: 'lifted', isLifted: true })
      expect(exit).toBe(0)
      expect(mutationCalls()).toBe(1)
    })

    it('should report every gate under --check and call no mutation', async () => {
      stageClearPull()

      const { record, exit } = await runLift(['7', '--check'])

      expect(record).toMatchObject({ reason: 'clear', isLifted: false })
      expect(exit).toBe(0)
      expect(mutationCalls()).toBe(0)
    })

    it('should read the posted reel skip off the evidence check into the gate', async () => {
      stageClearPull()
      writeFixture('comments.json', [
        {
          id: 1,
          body: markedCommentBody().replace(
            '## What to look at',
            '**No reel:** not-filmed: hand-written\n\n## What to look at',
          ),
        },
      ])

      const { record } = await runLift(['7', '--check'])

      const gates = record.gates as readonly Record<string, unknown>[]
      expect(gates.find((gate) => gate.gate === 'evidence')).toMatchObject({
        isOk: false,
        reason: 'reel-unsettled',
        reelSkip: 'not-filmed: hand-written',
      })
    })

    it('should refuse gh-failed on a blocked mutation rather than reporting a lift', async () => {
      stageClearPull()
      writeFixture('mutation-fail', '')

      const { record, exit } = await runLift(['7'])

      expect(record).toMatchObject({ reason: 'gh-failed', isLifted: false })
      expect(exit).toBe(1)
    })

    it('should refuse an open review and call no mutation', async () => {
      stageClearPull()
      writeFixture('reviews.json', [
        {
          body: `## Review\n\n1 finding\n\n<!-- review-pr: commit=${tip} read-at=2026-10-12T10:00:00Z -->`,
          commit_id: tip,
          submitted_at: '2026-10-12T10:01:00Z',
        },
      ])

      const { record, exit } = await runLift(['7'])

      expect(record).toMatchObject({ reason: 'review-open' })
      expect(exit).toBe(1)
      expect(mutationCalls()).toBe(0)
    })

    it('should refuse a --wait that is not a whole number', async () => {
      stageClearPull()

      const { record } = await runLift(['7', '--wait', 'soon'])

      expect(record.reason).toBe('bad-wait')
    })
  })

  describe('merge', () => {
    function stageReadyPull(): void {
      writeFixture(
        'pull.json',
        pullRow({
          draft: false,
          state: 'open',
          title: 'feat(pr): add a merge verb',
          body: '## Summary\n\n- Merge one pull request\n\n## Key changes\n\n- Add `src/a.ts`\n\n## Testing\n\n- [x] check\n',
        }),
      )
      writeFixture('checks.json', {
        total_count: 1,
        check_runs: [
          {
            head_sha: tip,
            status: 'completed',
            conclusion: 'success',
            name: 'check',
            id: 1,
          },
        ],
      })
    }

    async function runMerge(
      args: string[],
    ): Promise<{ record: Record<string, unknown>; exit: number }> {
      const result = await execa(
        process.execPath,
        [CLI, 'pr', 'merge', ...args, '--json', '--root', repoRoot],
        {
          cwd: repoRoot,
          reject: false,
          timeout: RUN_TIMEOUT_MS,
          env: {
            PATH: `${join(tempDir, 'bin')}:${process.env.PATH}`,
            FAKE_DIR: tempDir,
          },
        },
      )
      return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
    }

    /** The log from the merge call on, since its multiline message spans lines. */
    function mergeCall(): string | undefined {
      const log = readFileSync(join(tempDir, 'gh.log'), 'utf8')
      const at = log.indexOf('-X PUT repos/{owner}/{repo}/pulls/7/merge')
      return at === -1 ? undefined : log.slice(at)
    }

    it('should squash-merge over REST pinned to the head it read', async () => {
      stageReadyPull()

      const { record, exit } = await runMerge(['7'])

      expect(record).toMatchObject({
        reason: 'merged',
        number: 7,
        title: 'feat(pr): add a merge verb (#7)',
        description:
          '## Summary\n\n- Merge one pull request\n\n## Key changes\n\n- Add `src/a.ts`',
        sha: 'c0ffee0000000000000000000000000000000000',
      })
      expect(exit).toBe(0)
      const call = mergeCall()
      expect(call).toContain(`sha=${tip}`)
      expect(call).toContain('merge_method=squash')
      expect(call).toContain('commit_title=feat(pr): add a merge verb (#7)')
    })

    it('should call no merge under --dry-run and exit 0', async () => {
      stageReadyPull()

      const { record, exit } = await runMerge(['7', '--dry-run'])

      expect(record).toMatchObject({
        reason: 'dry-run',
        title: 'feat(pr): add a merge verb (#7)',
      })
      expect(exit).toBe(0)
      expect(mergeCall()).toBeUndefined()
    })

    it('should refuse head-moved when the merge answers 409', async () => {
      stageReadyPull()
      writeFixture('merge-409', '')

      const { record, exit } = await runMerge(['7'])

      expect(record).toMatchObject({ reason: 'head-moved' })
      expect(record.sha).toBeUndefined()
      expect(exit).toBe(1)
    })
  })
})
