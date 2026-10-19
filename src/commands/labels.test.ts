import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa, execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because the refusal
 * reports through `process.exitCode` and an in-process call would set it on
 * the test runner.
 */
interface ScanRecord {
  readonly titleFormatIssues: string[]
  readonly sections?: {
    readonly checked: boolean
    readonly outside: string[]
    readonly missing: string[]
  }
  readonly bannedCharacters: string[]
  readonly density?: {
    readonly section: string | null
    readonly kind: string
    readonly line: number
    readonly value: number | null
    readonly limit: number | null
  }[]
  readonly missingClosures?: number[]
  readonly strayClosures?: number[]
  readonly exitCode: number
}

async function runScan(args: string[]): Promise<ScanRecord> {
  const result = await execa(
    process.execPath,
    [CLI, 'labels', 'scan', '--json', ...args],
    {
      reject: false,
      timeout: RUN_TIMEOUT_MS,
    },
  )
  const record = JSON.parse(result.stdout) as Omit<ScanRecord, 'exitCode'>
  return { ...record, exitCode: result.exitCode ?? -1 }
}

describe(
  'canon labels scan title format gate',
  { timeout: RUN_TIMEOUT_MS },
  () => {
    let cwdDir: string

    beforeEach(async () => {
      cwdDir = await mkdtemp(join(tmpdir(), 'canon-labels-scan-'))
    })

    afterEach(async () => {
      await rm(cwdDir, { recursive: true, force: true })
    })

    it('should skip the title format grade when --body-file carries no title', async () => {
      const bodyFile = join(cwdDir, 'reply.md')
      await writeFile(bodyFile, 'Looks good, one nit below.\n')

      const { titleFormatIssues } = await runScan(['--body-file', bodyFile])

      expect(titleFormatIssues).toEqual([])
    })

    it('should still grade a supplied title against the format rules', async () => {
      const { titleFormatIssues } = await runScan([
        '--title',
        'not a conventional title',
      ])

      expect(titleFormatIssues).toEqual(['structure'])
    })
  },
)

describe('canon labels scan text checks', { timeout: RUN_TIMEOUT_MS }, () => {
  let cwdDir: string

  beforeEach(async () => {
    cwdDir = await mkdtemp(join(tmpdir(), 'canon-labels-scan-'))
  })

  afterEach(async () => {
    await rm(cwdDir, { recursive: true, force: true })
  })

  async function writeBody(body: string): Promise<string> {
    const file = join(cwdDir, 'body.md')
    await writeFile(file, body)
    return file
  }

  async function writeEvent(payload: unknown): Promise<string> {
    const file = join(cwdDir, 'event.json')
    await writeFile(file, JSON.stringify(payload))
    return file
  }

  const TITLE = 'feat(x): add y'

  it('should fail a body carrying a heading outside the closed list', async () => {
    const body = await writeBody(
      '## Summary\n\n- a\n\n## Commits\n\n- b\n\n## Whatever\n',
    )

    const record = await runScan(['--title', TITLE, '--body-file', body])

    expect(record.exitCode).toBe(2)
    expect(record.sections?.outside).toEqual(['## Commits', '## Whatever'])
    expect(record.sections?.missing).toEqual(['## Key changes'])
  })

  it('should fail a body missing the closing line --closes expects', async () => {
    const body = await writeBody('## Summary\n\n- a\n\n## Key changes\n\n- b\n')

    const record = await runScan([
      '--title',
      TITLE,
      '--body-file',
      body,
      '--closes',
      '12',
    ])

    expect(record.exitCode).toBe(2)
    expect(record.missingClosures).toEqual([12])
    expect(record.strayClosures).toEqual([])
  })

  it('should fail a closing line --closes did not name', async () => {
    const body = await writeBody(
      '## Summary\n\n- a\n\nFixes #99\n\n## Key changes\n\n- b\n',
    )

    const record = await runScan([
      '--title',
      TITLE,
      '--body-file',
      body,
      '--closes',
      'none',
    ])

    expect(record.exitCode).toBe(2)
    expect(record.strayClosures).toEqual([99])
  })

  it('should pass a body whose closing lines match --closes', async () => {
    const body = await writeBody(
      '## Summary\n\n- a\n\nCloses #12\nCloses #13\n\n## Key changes\n\n- b\n',
    )

    const record = await runScan([
      '--title',
      TITLE,
      '--body-file',
      body,
      '--closes',
      '12,13',
    ])

    expect(record.exitCode).toBe(0)
  })

  it('should not grade closing lines without --closes', async () => {
    const body = await writeBody(
      '## Summary\n\n- a\n\nFixes #99\n\n## Key changes\n\n- b\n',
    )

    const record = await runScan(['--title', TITLE, '--body-file', body])

    expect(record.exitCode).toBe(0)
    expect(record.missingClosures).toEqual([])
    expect(record.strayClosures).toEqual([])
  })

  it('should refuse a --closes value that is not a number list', async () => {
    const record = await runScan(['--title', TITLE, '--closes', 'twelve'])

    expect(record.exitCode).toBe(1)
  })

  it('should pass a body holding the required pair', async () => {
    const body = await writeBody('## Summary\n\n- a\n\n## Key changes\n\n- b\n')

    const record = await runScan(['--title', TITLE, '--body-file', body])

    expect(record.exitCode).toBe(0)
  })

  it('should report density findings and still exit 0 on them alone', async () => {
    const body = await writeBody(
      '## Summary\n\nOne.\n\n## Key changes\n\n- a\n- b\n- c\n- d\n- e\n- f\n',
    )

    const record = await runScan(['--title', TITLE, '--body-file', body])

    expect(record.exitCode).toBe(0)
    expect(record.density).toEqual([
      {
        section: 'Key changes',
        kind: 'bullet-run',
        line: 7,
        value: 6,
        limit: 5,
      },
    ])
  })

  it('should leave density empty on a body scanned with no title', async () => {
    const body = await writeBody('### Heading\n\nOne.\n')

    const record = await runScan(['--body-file', body])

    expect(record.density).toEqual([])
  })

  it('should report post density on a review body and still exit 0 on it alone', async () => {
    const body = await writeBody(
      `## Review\n\n- **minor** (line 1): A subject.\n  - ${'word '.repeat(45)}\n\n🤖 Reviewed by Claude Code\n`,
    )

    const record = await runScan(['--body-file', body])

    expect(record.exitCode).toBe(0)
    expect(record.density).toEqual([
      {
        section: 'Review',
        kind: 'bullet-length',
        line: 4,
        value: 224,
        limit: 200,
      },
    ])
  })

  it('should report post density on a review event', async () => {
    const event = await writeEvent({
      review: { body: '## Review closed\n\n- a\n- b\n- c\n- d\n- e\n- f\n' },
      pull_request: { head: { ref: 'feat/x' } },
    })

    const record = await runScan(['--event', event])

    expect(record.exitCode).toBe(0)
    expect(record.density?.map((finding) => finding.kind)).toEqual([
      'bullet-run',
    ])
  })

  it('should skip the headings check on a review event', async () => {
    const event = await writeEvent({
      review: { body: '## Review\n\n- fine\n' },
      pull_request: { head: { ref: 'feat/x' } },
    })

    const record = await runScan(['--event', event])

    expect(record.exitCode).toBe(0)
    expect(record.sections?.checked).toBe(false)
  })

  it('should exempt a release pull request from the headings check', async () => {
    const body = await writeBody('## [1.2.0](https://example.com)\n\n- a\n')

    const record = await runScan([
      '--title',
      'chore(main): release 1.2.0',
      '--body-file',
      body,
      '--head',
      'release-please--branches--main',
    ])

    expect(record.sections?.checked).toBe(false)
  })

  it('should skip the headings check on a body scanned with no title', async () => {
    const body = await writeBody('Looks good.\n')

    const record = await runScan(['--body-file', body])

    expect(record.sections?.checked).toBe(false)
    expect(record.exitCode).toBe(0)
  })

  it('should pass the review headings on a body-file scan with no event', async () => {
    const body = await writeBody(
      '## Review\n\n- a\n\n## Review closed\n\n## UI review\n\n## Review response\n',
    )

    const record = await runScan(['--body-file', body])

    expect(record.sections?.checked).toBe(false)
    expect(record.exitCode).toBe(0)
  })

  it('should fail an em dash in a title', async () => {
    const record = await runScan(['--title', 'feat(x): add y \u2014 now'])

    expect(record.exitCode).toBe(2)
    expect(record.bannedCharacters).toEqual(['\u2014'])
  })

  it('should fail a semicolon in a review body', async () => {
    const event = await writeEvent({
      review: { body: 'one; two\n' },
      pull_request: { head: { ref: 'feat/x' } },
    })

    const record = await runScan(['--event', event])

    expect(record.exitCode).toBe(2)
    expect(record.bannedCharacters).toEqual([';'])
  })

  it('should pass a banned character inside a code span', async () => {
    const body = await writeBody(
      '## Summary\n\n- quotes `&quot;` here\n\n## Key changes\n\n- b\n',
    )

    const record = await runScan(['--title', TITLE, '--body-file', body])

    expect(record.bannedCharacters).toEqual([])
  })
})

describe('canon labels apply', { timeout: RUN_TIMEOUT_MS }, () => {
  interface ApplyRecord {
    readonly reason?: string
    readonly earned?: string[]
    readonly added?: string[]
    readonly owed?: string[]
    readonly missingOnRemote?: string[]
    readonly exitCode: number
    readonly calls: string[]
  }

  interface Fake {
    readonly target?: string
    readonly present?: string[]
    readonly remote?: string[]
    /** Files the pull request lists. Set, the run omits --base and reads them. */
    readonly files?: string[]
    readonly filesFail?: boolean
  }

  let root: string
  let logFile: string

  function git(...args: string[]): void {
    execaSync('git', ['-C', root, ...args], {
      extendEnv: false,
      env: {
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    })
  }

  async function seedRepo(hasMap: boolean): Promise<void> {
    git('init', '-q', '--initial-branch=main')
    await writeFile(join(root, 'README.md'), '# r\n')
    if (hasMap) {
      await mkdir(join(root, 'canon', 'config'), { recursive: true })
      await writeFile(
        join(root, 'canon', 'config', 'pr-labels.toml'),
        '[domains]\ncli = ["src/"]\ndocs = ["docs/"]\n',
      )
    }
    git('add', '.')
    git('commit', '-q', '-m', 'init')
    git('checkout', '-q', '-b', 'feat/x')
    await mkdir(join(root, 'src'), { recursive: true })
    await mkdir(join(root, 'docs'), { recursive: true })
    await writeFile(join(root, 'src', 'a.ts'), 'export {}\n')
    await writeFile(join(root, 'docs', 'a.md'), '# a\n')
    git('add', '.')
    git('commit', '-q', '-m', 'change')
  }

  async function writeFakeGh(): Promise<string> {
    const bin = join(root, 'bin')
    await mkdir(bin, { recursive: true })
    await writeFile(
      join(bin, 'gh'),
      [
        '#!/bin/sh',
        'echo "$*" >> "$FAKE_LOG"',
        'case "$*" in',
        '  *"-X POST"*) exit 0 ;;',
        '  *pulls/7/files*) [ -n "$FAKE_FILES_FAIL" ] && exit 1; printf \'%s\' "$FAKE_FILES" ;;',
        '  *pulls/7*) printf \'%s\\n\' "$FAKE_TARGET" ;;',
        '  *issues/7/labels*) printf \'%s\' "$FAKE_PRESENT" ;;',
        '  *repos/{owner}/{repo}/labels*) printf \'%s\' "$FAKE_REMOTE" ;;',
        '  *) exit 1 ;;',
        'esac',
        '',
      ].join('\n'),
      { mode: 0o755 },
    )
    return bin
  }

  async function runApply(args: string[], fake: Fake): Promise<ApplyRecord> {
    const bin = await writeFakeGh()
    const result = await execa(
      process.execPath,
      [
        CLI,
        'labels',
        'apply',
        '--json',
        ...(fake.files === undefined ? ['--base', 'main'] : []),
        ...args,
      ],
      {
        cwd: root,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        extendEnv: false,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          HOME: process.env.HOME ?? root,
          FAKE_LOG: logFile,
          FAKE_TARGET: fake.target ?? 'feat/x open',
          FAKE_PRESENT: (fake.present ?? []).join('\n'),
          FAKE_FILES: (fake.files ?? []).join('\n'),
          FAKE_FILES_FAIL: fake.filesFail ? '1' : '',
          FAKE_REMOTE: (fake.remote ?? ['cli', 'docs']).join('\n'),
        },
      },
    )
    const record = JSON.parse(result.stdout) as Omit<
      ApplyRecord,
      'exitCode' | 'calls'
    >
    const calls = existsSync(logFile)
      ? readFileSync(logFile, 'utf8').split('\n').filter(Boolean)
      : []
    return { ...record, exitCode: result.exitCode ?? -1, calls }
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-labels-apply-'))
    logFile = join(root, 'gh.log')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('should add the earned labels the pull request lacks', async () => {
    await seedRepo(true)

    const record = await runApply(['7'], {})

    expect(record.added).toEqual(['cli', 'docs'])
    expect(record.exitCode).toBe(0)
    expect(record.calls.some((call) => call.includes('-X POST'))).toBe(true)
  })

  it('should refuse a pull request whose head is another branch before any write', async () => {
    await seedRepo(true)

    const record = await runApply(['7'], { target: 'feat/other open' })

    expect(record.reason).toBe('head-mismatch')
    expect(record.exitCode).toBe(1)
    expect(record.calls.some((call) => call.includes('-X POST'))).toBe(false)
  })

  it('should refuse a pull request that is not open', async () => {
    await seedRepo(true)

    const record = await runApply(['7'], { target: 'feat/x closed' })

    expect(record.reason).toBe('head-mismatch')
  })

  it('should refuse a foreign head under --check as well', async () => {
    await seedRepo(true)

    const record = await runApply(['7', '--check'], {
      target: 'feat/other open',
    })

    expect(record.reason).toBe('head-mismatch')
  })

  it('should exit 2 under --check with owed labels and write nothing', async () => {
    await seedRepo(true)

    const record = await runApply(['7', '--check'], {})

    expect(record.owed).toEqual(['cli', 'docs'])
    expect(record.exitCode).toBe(2)
    expect(record.calls.some((call) => call.includes('-X POST'))).toBe(false)
  })

  it('should not re-add a label already on the pull request', async () => {
    await seedRepo(true)

    const record = await runApply(['7'], { present: ['cli', 'by-hand'] })

    expect(record.added).toEqual(['docs'])
  })

  it('should report a label the remote lacks and not add it', async () => {
    await seedRepo(true)

    const record = await runApply(['7'], { remote: ['cli'] })

    expect(record.added).toEqual(['cli'])
    expect(record.missingOnRemote).toEqual(['docs'])
    expect(record.exitCode).toBe(2)
  })

  it('should add nothing and exit 0 for a project with no map', async () => {
    await seedRepo(false)

    const record = await runApply(['7'], {})

    expect(record.reason).toBe('no-map')
    expect(record.earned).toEqual([])
    expect(record.exitCode).toBe(0)
    expect(record.calls.some((call) => call.includes('-X POST'))).toBe(false)
  })

  it('should refuse a foreign head before the no-map answer', async () => {
    await seedRepo(false)

    const record = await runApply(['7', '--check'], {
      target: 'feat/other open',
    })

    expect(record.reason).toBe('head-mismatch')
    expect(record.exitCode).toBe(1)
  })

  it('should label from the pull request files listing when no base is passed', async () => {
    await seedRepo(true)

    const record = await runApply(['7'], { files: ['docs/new.md'] })

    expect(record.earned).toEqual(['docs'])
    expect(record.added).toEqual(['docs'])
    expect(record.calls.some((call) => call.includes('pulls/7/files'))).toBe(
      true,
    )
  })

  it('should read the same listing under --check', async () => {
    await seedRepo(true)

    const record = await runApply(['7', '--check'], { files: ['src/b.ts'] })

    expect(record.owed).toEqual(['cli'])
    expect(record.exitCode).toBe(2)
  })

  it('should keep the git route when --base is passed', async () => {
    await seedRepo(true)

    const record = await runApply(['7'], {})

    expect(record.earned).toEqual(['cli', 'docs'])
    expect(record.calls.some((call) => call.includes('pulls/7/files'))).toBe(
      false,
    )
  })

  it('should refuse with gh-failed and write nothing when the listing read fails', async () => {
    await seedRepo(true)

    const record = await runApply(['7'], { files: [], filesFail: true })

    expect(record.reason).toBe('gh-failed')
    expect(record.exitCode).toBe(1)
    expect(record.calls.some((call) => call.includes('-X POST'))).toBe(false)
  })
})
