import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa, execaSync, type ResultPromise } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderEvidenceBody } from '@/pr/evidence'
import {
  CLI,
  RUN_TIMEOUT_MS,
  initBranchRepo,
  writeFakeGh,
} from '@/commands/pr/fixture'

describe('canon pr local', () => {
  let tempDir: string
  let repoRoot: string
  let commentsFile: string
  let apiLog: string
  let bin: string
  let server: ResultPromise | undefined

  async function runLocal(
    args: string[],
  ): Promise<{ readonly record: { reason?: string }; readonly exit: number }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'local', '--json', '--root', repoRoot, ...args],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${bin}:${process.env.PATH}` },
      },
    )
    return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
  }

  function writeMarkedComment(body: string): void {
    writeFileSync(
      commentsFile,
      JSON.stringify({
        comments: [
          { url: 'https://github.com/o/r/pull/7#issuecomment-99', body },
        ],
      }),
    )
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-local-'))
    repoRoot = join(tempDir, 'repo')
    bin = join(tempDir, 'bin')
    commentsFile = join(tempDir, 'comments.json')
    apiLog = join(tempDir, 'api.log')
    mkdirSync(repoRoot)
    writeFileSync(commentsFile, '{"comments":[]}')
    writeFileSync(join(tempDir, 'ui-reviews.json'), '[]')
    writeFakeGh(bin, commentsFile, apiLog)
    initBranchRepo(repoRoot, {})
  })

  afterEach(() => {
    server?.kill()
    server = undefined
    rmSync(tempDir, { recursive: true, force: true })
  })

  /**
   * Serves an HTML page from inside the worktree under the name the kernel
   * cuts Next's `next-server (vX.Y.Z)` title down to, and resolves its port.
   */
  async function serveAsNext(): Promise<number> {
    const script = [
      "require('fs').writeFileSync('/proc/self/comm', 'next-server (v1')",
      "const s = Bun.serve({ port: 0, fetch: () => new Response('<p>', { headers: { 'content-type': 'text/html' } }) })",
      'process.stdout.write(`${s.port}\\n`)',
    ].join('\n')
    const child = execa(process.execPath, ['-e', script], {
      cwd: repoRoot,
      reject: false,
      timeout: RUN_TIMEOUT_MS,
    })
    server = child
    const [chunk] = await Promise.race([
      once(child.stdout, 'data'),
      child.then(() => {
        throw new Error('the server exited before printing its port')
      }),
    ])
    return Number(String(chunk).trim())
  }

  it.runIf(existsSync('/proc/self/comm'))(
    'should report a server whose process name holds an unmatched parenthesis',
    async () => {
      const port = await serveAsNext()

      const outcome = await runLocal([])

      expect(outcome.record).toEqual(
        expect.objectContaining({
          reason: 'ok',
          url: expect.stringContaining(`:${port}`),
        }),
      )
    },
  )

  /**
   * Serves an HTML page at / from inside the worktree and answers the given
   * status at /api/health, declared in the worktree's local.toml.
   */
  async function serveWithHealth(status: number): Promise<number> {
    mkdirSync(join(repoRoot, 'canon', 'config'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'canon', 'config', 'local.toml'),
      'health = ["/api/health"]\n',
    )
    const script = [
      'const s = Bun.serve({ port: 0, fetch: (req) => new URL(req.url).pathname === "/api/health"',
      `  ? new Response('bad gateway', { status: ${status} })`,
      "  : new Response('<p>', { headers: { 'content-type': 'text/html' } }) })",
      'process.stdout.write(`${s.port}\\n`)',
    ].join('\n')
    const child = execa(process.execPath, ['-e', script], {
      cwd: repoRoot,
      reject: false,
      timeout: RUN_TIMEOUT_MS,
    })
    server = child
    const [chunk] = await Promise.race([
      once(child.stdout, 'data'),
      child.then(() => {
        throw new Error('the server exited before printing its port')
      }),
    ])
    return Number(String(chunk).trim())
  }

  it('should refuse as unhealthy when the page answers and a declared health path answers 502', async () => {
    const port = await serveWithHealth(502)

    const outcome = await runLocal([])

    expect(outcome).toEqual({
      record: expect.objectContaining({
        reason: 'unhealthy',
        port,
        path: '/api/health',
        status: 502,
      }),
      exit: 1,
    })
  })

  it('should report the page when a declared health path answers 200', async () => {
    const port = await serveWithHealth(200)

    const outcome = await runLocal([])

    expect(outcome).toEqual({
      record: expect.objectContaining({
        reason: 'ok',
        url: `http://localhost:${port}`,
      }),
      exit: 0,
    })
  })

  it('should refuse as invalid-config when local.toml is not valid TOML', async () => {
    mkdirSync(join(repoRoot, 'canon', 'config'), { recursive: true })
    writeFileSync(join(repoRoot, 'canon', 'config', 'local.toml'), 'health = [')

    const outcome = await runLocal([])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'invalid-config' }),
      exit: 1,
    })
  })

  it('should refuse as no-server when nothing listens inside the worktree', async () => {
    const outcome = await runLocal([])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-server' }),
      exit: 1,
    })
  })

  it('should drop the address line and leave no note on --remove', async () => {
    writeMarkedComment(
      '## Evidence\n\n**Preview:** https://feat-x.site.pages.dev · **Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
    )

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome.record.reason).toBe('removed')
    expect(readFileSync(apiLog, 'utf8')).toBe(
      'body=## Evidence\n\n<!-- pr-evidence: head=abc -->',
    )
  })

  it('should report no-line and write nothing when the comment carries no address line', async () => {
    writeMarkedComment('## Evidence\n\n<!-- pr-evidence: head=abc -->')

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-line' }),
      exit: 0,
    })
    expect(existsSync(apiLog)).toBe(false)
  })

  it('should report no-comment when no marked comment exists', async () => {
    const outcome = await runLocal(['7', '--remove'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-comment' }),
      exit: 0,
    })
  })

  function writeReviews(
    reviews: readonly { readonly id: number; readonly body: string }[],
  ): void {
    writeFileSync(
      join(tempDir, 'ui-reviews.json'),
      JSON.stringify(
        reviews.map((review) => ({
          ...review,
          commit_id: 'abc',
          submitted_at: '2026-10-19T00:00:00Z',
        })),
      ),
    )
  }

  function uiReview(id: number, address: string) {
    return {
      id,
      body: [
        '## UI review closed',
        '',
        '0 failed · 0 need your eyes · 2 passed · 0 not driven',
        `Driven at \`38db88d\` on ${address}, rendered by agent-browser.`,
        '',
        '<!-- review-ui: head=38db88d -->',
      ].join('\n'),
    }
  }

  it('should rewrite the address in every UI review and leave a code review alone', async () => {
    writeReviews([
      uiReview(11, 'http://127.0.0.1:4211'),
      {
        id: 12,
        body: '## Review\n\nDriven at `38db88d` on http://localhost:5173, rendered by agent-browser.\n\n<!-- review-pr: head=38db88d -->',
      },
      uiReview(13, 'http://localhost:5173'),
    ])

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome.record).toEqual(expect.objectContaining({ reviews: 2 }))
    expect(
      readFileSync(join(tempDir, 'review-puts.log'), 'utf8')
        .trim()
        .split('\n')
        .sort(),
    ).toEqual(['11', '13'])
    expect(readFileSync(join(tempDir, 'review-bodies.log'), 'utf8')).toContain(
      'body=## UI review closed\n\n0 failed · 0 need your eyes · 2 passed · 0 not driven\nDriven at `38db88d` on a local preview, rendered by agent-browser.',
    )
  })

  it('should leave a UI review driven on a hosted preview unedited', async () => {
    writeReviews([uiReview(11, 'https://feat-x.site.pages.dev')])

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome.record).toEqual(expect.objectContaining({ reviews: 0 }))
    expect(existsSync(join(tempDir, 'review-puts.log'))).toBe(false)
  })

  it('should report reviews 0 on a thread with no review', async () => {
    const outcome = await runLocal(['7', '--remove'])

    expect(outcome.record).toEqual(expect.objectContaining({ reviews: 0 }))
  })

  it('should still drop the evidence address line when the reviews read is refused', async () => {
    writeMarkedComment(
      '## Evidence\n\n**Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
    )
    rmSync(join(tempDir, 'ui-reviews.json'))

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'gh-failed' }),
      exit: 1,
    })
    expect(readFileSync(apiLog, 'utf8')).toBe(
      'body=## Evidence\n\n<!-- pr-evidence: head=abc -->',
    )
  })

  it('should refuse gh-failed on a refused update after trying the rest', async () => {
    writeReviews([
      uiReview(11, 'http://127.0.0.1:4211'),
      uiReview(13, 'http://localhost:5173'),
    ])
    writeFileSync(join(tempDir, 'review-put-fail-11'), '')

    const outcome = await runLocal(['7', '--remove'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'gh-failed', reviews: 1 }),
      exit: 1,
    })
    expect(
      readFileSync(join(tempDir, 'review-puts.log'), 'utf8')
        .trim()
        .split('\n')
        .sort(),
    ).toEqual(['11', '13'])
  })
})

describe('canon pr tick', () => {
  let tempDir: string
  let repoRoot: string
  let commentsFile: string
  let apiLog: string
  let bin: string
  let tip: string

  const CHECKLIST = [
    '- [ ] the hero settles',
    '- [ ] the footer wraps',
    '- [ ] the mood is calm (taste)',
  ].join('\n')

  async function runTick(
    args: string[],
  ): Promise<{ readonly record: { reason?: string }; readonly exit: number }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'tick', '7', '--json', '--root', repoRoot, ...args],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: `${bin}:${process.env.PATH}` },
      },
    )
    return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
  }

  /** A CI runner carries no git identity, so every commit here names one. */
  const IDENTITY = {
    env: {
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  }

  /** Commits one file on the branch and pushes it, returning the new tip. */
  function pushCommit(path: string): string {
    mkdirSync(join(repoRoot, dirname(path)), { recursive: true })
    writeFileSync(join(repoRoot, path), `${path}\n`)
    execaSync('git', ['-C', repoRoot, 'add', path])
    execaSync(
      'git',
      ['-C', repoRoot, 'commit', '-q', '-m', `add ${path}`],
      IDENTITY,
    )
    execaSync('git', ['-C', repoRoot, 'push', '-q', '-f', 'origin', 'feat/x'])
    return execaSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD']).stdout
  }

  function writeMarkedComment(checklist: string | undefined): void {
    const body = renderEvidenceBody(
      [],
      'o/r',
      'aaaa000',
      tip,
      undefined,
      checklist,
    )
    writeFileSync(
      commentsFile,
      JSON.stringify({
        comments: [
          { url: 'https://github.com/o/r/pull/7#issuecomment-99', body },
        ],
      }),
    )
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-tick-'))
    repoRoot = join(tempDir, 'repo')
    bin = join(tempDir, 'bin')
    commentsFile = join(tempDir, 'comments.json')
    apiLog = join(tempDir, 'api.log')
    mkdirSync(repoRoot)
    writeFakeGh(bin, commentsFile, apiLog)
    initBranchRepo(repoRoot, {})
    const remote = join(tempDir, 'remote.git')
    execaSync('git', ['init', '-q', '--bare', remote])
    execaSync('git', ['-C', repoRoot, 'remote', 'add', 'origin', remote])
    execaSync('git', ['-C', repoRoot, 'push', '-q', 'origin', 'feat/x'])
    tip = execaSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD']).stdout
    writeMarkedComment(CHECKLIST)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should tick and stamp the named boxes through a PATCH', async () => {
    const outcome = await runTick(['--boxes', '1', '--head', tip.slice(0, 7)])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'ticked', head: tip }),
      exit: 0,
    })
    const written = readFileSync(apiLog, 'utf8')
    expect(written).toContain(
      `- [x] the hero settles · passed at \`${tip.slice(0, 7)}\`\n`,
    )
    expect(written).toContain('- [ ] the footer wraps\n')
  })

  describe('count check', () => {
    const verdict = (counts: string, head: string) => ({
      body: `## UI review closed\n\n${counts}\nDriven.\n\n<!-- review-ui: head=${head} -->`,
      commit_id: head,
      submitted_at: '2026-10-19T10:00:00Z',
    })
    const TWO_PASSED = '0 failed · 1 need your eyes · 2 passed · 0 not driven'

    function postVerdict(row: ReturnType<typeof verdict>): void {
      writeFileSync(join(tempDir, 'ui-reviews.json'), JSON.stringify([row]))
    }

    it('should refuse a tick that leaves fewer ticks than the verdict passed and write nothing', async () => {
      postVerdict(verdict(TWO_PASSED, tip))

      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'count-mismatch',
          passed: 2,
          ticked: 1,
        }),
        exit: 1,
      })
      expect(existsSync(apiLog)).toBe(false)
    })

    it('should refuse when a box ticked at the tip has since failed, leaving more ticks than passed', async () => {
      writeMarkedComment(
        [
          `- [x] the hero settles · passed at \`${tip.slice(0, 7)}\``,
          '- [ ] the footer wraps',
          '- [ ] the mood is calm (taste)',
        ].join('\n'),
      )
      postVerdict(
        verdict('1 failed · 1 need your eyes · 1 passed · 0 not driven', tip),
      )

      const outcome = await runTick(['--boxes', '2', '--head', tip])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'count-mismatch',
          passed: 1,
          ticked: 2,
        }),
        exit: 1,
      })
      expect(existsSync(apiLog)).toBe(false)
    })

    it('should tick every box on a re-tick with the full passed list', async () => {
      postVerdict(verdict(TWO_PASSED, tip))

      const outcome = await runTick(['--boxes', '1,2', '--head', tip])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'ticked',
          countCheck: 'matched',
        }),
        exit: 0,
      })
    })

    it('should run the count check on a verdict carried to the tip', async () => {
      const driven = tip
      postVerdict(verdict(TWO_PASSED, driven))
      pushCommit('src/hero.test.ts')

      const outcome = await runTick(['--boxes', '1,2', '--head', driven])

      expect(outcome.record).toEqual(
        expect.objectContaining({ reason: 'ticked', countCheck: 'matched' }),
      )
    })

    it('should read a verdict that covers an older head as unchecked', async () => {
      postVerdict(verdict(TWO_PASSED, 'a'.repeat(40)))

      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome.record).toEqual(
        expect.objectContaining({ reason: 'ticked', countCheck: 'unchecked' }),
      )
    })

    it('should read a verdict with no count line as unchecked', async () => {
      postVerdict({
        ...verdict('', tip),
        body: `## UI review closed\n\nDone.\n\n<!-- review-ui: head=${tip} -->`,
      })

      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome.record).toEqual(
        expect.objectContaining({ reason: 'ticked', countCheck: 'unchecked' }),
      )
    })

    it('should read a thread with no UI verdict as unchecked', async () => {
      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome.record).toEqual(
        expect.objectContaining({ reason: 'ticked', countCheck: 'unchecked' }),
      )
    })
  })

  describe('body line', () => {
    const BODY = '## Summary\n\n- x\n\n## Testing\n\n- [x] ran it\n'

    it('should write the pass count into the body beside what is there', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)

      await runTick(['--boxes', '1,2', '--head', tip])

      const written = readFileSync(join(tempDir, 'body-write.log'), 'utf8')
      expect(written).toContain('- [x] ran it\n')
      expect(written).toContain(
        `- [x] UI pass, 2 of 2 boxes passed at \`${tip.slice(0, 7)}\`, 1 taste box left to the operator`,
      )
    })

    it('should not count a box ticked by hand or at another head as passed by this pass', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)
      writeMarkedComment(
        [
          '- [ ] the hero settles',
          '- [x] the footer wraps',
          '- [ ] the mood is calm (taste)',
        ].join('\n'),
      )

      await runTick(['--boxes', '1', '--head', tip])

      expect(readFileSync(join(tempDir, 'body-write.log'), 'utf8')).toContain(
        '- [ ] UI pass, 1 of 2 boxes passed',
      )
    })

    it('should leave the line unchecked while a driven box is still empty', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)

      await runTick(['--boxes', '1', '--head', tip])

      expect(readFileSync(join(tempDir, 'body-write.log'), 'utf8')).toContain(
        '- [ ] UI pass, 1 of 2 boxes passed',
      )
    })

    it('should report the comment as ticked and the body as refused when the body edit fails', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)
      writeFileSync(join(tempDir, 'body-fail'), '')

      const outcome = await runTick(['--boxes', '1', '--head', tip])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'body-refused',
          commentTicked: true,
        }),
        exit: 1,
      })
      expect(readFileSync(apiLog, 'utf8')).toContain('- [x] the hero settles')
    })

    it('should write no body line when the tick is refused', async () => {
      writeFileSync(join(tempDir, 'pr-body'), BODY)

      await runTick(['--boxes', '1,3', '--head', tip])

      expect(existsSync(join(tempDir, 'body-write.log'))).toBe(false)
    })
  })

  describe('carry', () => {
    it('should stamp the boxes at the tip across a push no box observes', async () => {
      const driven = tip
      const pushed = pushCommit('src/hero.test.ts')

      const outcome = await runTick(['--boxes', '1', '--head', driven])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'ticked',
          head: pushed,
          carriedFrom: driven,
        }),
        exit: 0,
      })
      expect(readFileSync(apiLog, 'utf8')).toContain(
        `- [x] the hero settles · passed at \`${pushed.slice(0, 7)}\`\n`,
      )
    })

    it('should refuse redrive-owed across a push to a source file and write nothing', async () => {
      const driven = tip.slice(0, 7)
      const pushed = pushCommit('src/hero.ts')

      const outcome = await runTick(['--boxes', '1', '--head', driven])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'redrive-owed',
          driven,
          head: pushed,
          drivenPaths: ['src/hero.ts'],
        }),
        exit: 1,
      })
      expect(existsSync(apiLog)).toBe(false)
    })

    it('should refuse stale-head when the driven head was rewritten away', async () => {
      const driven = pushCommit('src/hero.test.ts')
      execaSync(
        'git',
        ['-C', repoRoot, 'commit', '-q', '--amend', '-m', 'x'],
        IDENTITY,
      )
      execaSync('git', ['-C', repoRoot, 'push', '-q', '-f', 'origin', 'feat/x'])

      const outcome = await runTick(['--boxes', '1', '--head', driven])

      expect(outcome).toEqual({
        record: expect.objectContaining({ reason: 'stale-head' }),
        exit: 1,
      })
      expect(existsSync(apiLog)).toBe(false)
    })
  })

  it('should refuse a head that is not the remote tip and write nothing', async () => {
    const outcome = await runTick(['--boxes', '1', '--head', '1234567'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'stale-head' }),
      exit: 1,
    })
    expect(existsSync(apiLog)).toBe(false)
  })

  it('should refuse a taste box and write nothing', async () => {
    const outcome = await runTick(['--boxes', '1,3', '--head', tip])

    expect(outcome.record.reason).toBe('taste-box')
    expect(existsSync(apiLog)).toBe(false)
  })

  it('should refuse a box past the end of the checklist', async () => {
    const outcome = await runTick(['--boxes', '9', '--head', tip])

    expect(outcome.record.reason).toBe('no-box')
  })

  it('should refuse when the evidence comment carries no checklist', async () => {
    writeMarkedComment(undefined)

    const outcome = await runTick(['--boxes', '1', '--head', tip])

    expect(outcome.record.reason).toBe('no-checklist')
  })

  it('should refuse when no comment carries the marker', async () => {
    writeFileSync(commentsFile, '{"comments":[]}')

    const outcome = await runTick(['--boxes', '1', '--head', tip])

    expect(outcome.record.reason).toBe('no-comment')
  })

  it('should refuse a malformed box list', async () => {
    const outcome = await runTick(['--boxes', 'one', '--head', tip])

    expect(outcome.record.reason).toBe('bad-boxes')
  })
})

describe('canon pr frames', () => {
  let tempDir: string
  let bin: string
  let callLog: string

  /**
   * A gh that answers the frames branch as missing and refuses every write
   * with the status a token lacking write access gets, logging each call.
   */
  function writeReadOnlyGh(): void {
    mkdirSync(bin, { recursive: true })
    writeFileSync(
      join(bin, 'gh'),
      readFileSync(
        new URL('./fixtures/gh-read-only.sh', import.meta.url),
        'utf8',
      ),
      { mode: 0o755 },
    )
  }

  async function runFrames(
    args: string[],
  ): Promise<{ readonly record: { reason?: string }; readonly exit: number }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'frames', '--json', '--root', tempDir, ...args],
      {
        cwd: tempDir,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { FAKE_LOG: callLog, PATH: `${bin}:${process.env.PATH}` },
      },
    )
    return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
  }

  function calls(): string[] {
    return existsSync(callLog)
      ? readFileSync(callLog, 'utf8').split('\n').filter(Boolean)
      : []
  }

  function addArgs(file: string): string[] {
    return [
      '7',
      '--add',
      join(tempDir, file),
      '--box',
      '1',
      '--head',
      'abc1234',
      '--pass',
      '20261002T154450Z',
    ]
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-frames-'))
    bin = join(tempDir, 'bin')
    callLog = join(tempDir, 'gh.log')
    writeReadOnlyGh()
    writeFileSync(
      join(tempDir, 'box-1.png'),
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]),
    )
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should refuse as bad-mode when no mode is passed', async () => {
    const outcome = await runFrames(['7'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'bad-mode' }),
      exit: 1,
    })
  })

  it('should refuse as bad-mode when --add and --drop are both passed', async () => {
    const outcome = await runFrames([...addArgs('box-1.png'), '--drop'])

    expect(outcome.record.reason).toBe('bad-mode')
  })

  it('should refuse as bad-mode when --prune names a pull request', async () => {
    const outcome = await runFrames(['7', '--prune', '30'])

    expect(outcome.record.reason).toBe('bad-mode')
  })

  it('should refuse as no-number when --drop names no pull request', async () => {
    const outcome = await runFrames(['--drop'])

    expect(outcome.record.reason).toBe('no-number')
  })

  it('should refuse as bad-box when --add carries no box', async () => {
    const outcome = await runFrames(['7', '--add', 'box-1.png'])

    expect(outcome.record.reason).toBe('bad-box')
  })

  it('should refuse as bad-head without calling gh when --head names no commit', async () => {
    const outcome = await runFrames([...addArgs('box-1.png'), '--head', 'main'])

    expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
      reason: 'bad-head',
      calls: [],
    })
  })

  it('should refuse as bad-pass when --add carries no pass stamp', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--box',
      '1',
      '--head',
      'abc1234',
    ])

    expect(outcome.record.reason).toBe('bad-pass')
  })

  it('should refuse as bad-pass when the stamp is not compact UTC', async () => {
    const outcome = await runFrames([
      ...addArgs('box-1.png'),
      '--pass',
      '2026-10-02T15:44:50Z',
    ])

    expect(outcome.record.reason).toBe('bad-pass')
  })

  it('should refuse as bad-theme when --theme is neither dark nor light', async () => {
    const outcome = await runFrames([
      ...addArgs('box-1.png'),
      '--theme',
      'sepia',
    ])

    expect(outcome.record.reason).toBe('bad-theme')
  })

  it('should refuse as bad-theme without calling gh when --theme comes without --add', async () => {
    const outcome = await runFrames(['7', '--drop', '--theme', 'dark'])

    expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
      reason: 'bad-theme',
      calls: [],
    })
  })

  it('should refuse as bad-days when --prune is not a positive number', async () => {
    const outcome = await runFrames(['--prune', '0'])

    expect(outcome.record.reason).toBe('bad-days')
  })

  it('should refuse as unreadable-frame without calling gh when the file is not a PNG', async () => {
    writeFileSync(join(tempDir, 'notes.png'), 'text')

    const outcome = await runFrames(addArgs('notes.png'))

    expect({ outcome, calls: calls() }).toEqual({
      outcome: {
        record: expect.objectContaining({ reason: 'unreadable-frame' }),
        exit: 1,
      },
      calls: [],
    })
  })

  it('should refuse as read-only when GitHub refuses the write', async () => {
    const outcome = await runFrames(addArgs('box-1.png'))

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'read-only' }),
      exit: 1,
    })
  })

  it('should report nothing removed when --drop finds the branch missing', async () => {
    const outcome = await runFrames(['7', '--drop'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'ok', removed: [] }),
      exit: 0,
    })
  })

  it('should address no ref but the canon/frames branch', async () => {
    await runFrames(addArgs('box-1.png'))

    const refCalls = calls().filter((call) => call.includes('/git/ref'))
    expect(refCalls.every((call) => call.includes('heads/canon/frames'))).toBe(
      true,
    )
  })

  it('should read only canon/frames and the legacy ref on --drop and report ok', async () => {
    const outcome = await runFrames(['7', '--drop'])

    const refCalls = calls().filter((call) => call.includes('/git/ref'))
    expect({ outcome, refCalls: refCalls.length }).toEqual({
      outcome: {
        record: expect.objectContaining({ reason: 'ok', removed: [] }),
        exit: 0,
      },
      refCalls: 2,
    })
    expect(
      refCalls.every(
        (call) =>
          call.includes('heads/canon/frames') ||
          call.includes('heads/canon-frames'),
      ),
    ).toBe(true)
  })

  it('should drain the legacy ref on --prune without a new refusal when it is missing', async () => {
    const outcome = await runFrames(['--prune', '30'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'ok', removed: [] }),
      exit: 0,
    })
  })

  it('should never read the legacy ref on --add', async () => {
    await runFrames(addArgs('box-1.png'))

    expect(calls().filter((call) => call.includes('canon-frames'))).toEqual([])
  })

  it('should refuse as bad-box when --add carries both --box and --reference', async () => {
    const outcome = await runFrames([
      ...addArgs('box-1.png'),
      '--reference',
      'home/hero',
    ])

    expect(outcome.record.reason).toBe('bad-box')
    expect(calls()).toEqual([])
  })

  it('should refuse as bad-reference when the address would escape the pass folder', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      '../../x',
      '--pass',
      '20261002T154450Z',
    ])

    expect(outcome.record.reason).toBe('bad-reference')
    expect(calls()).toEqual([])
  })

  it('should refuse as bad-reference naming the path when a tracked reference does not exist', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      'canon/design/button/dark.png',
      '--head',
      'abc1234',
      '--pass',
      '20261002T154450Z',
    ])

    expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
      reason: 'bad-reference',
      calls: [],
    })
    expect(JSON.stringify(outcome.record)).toContain(
      'canon/design/button/dark.png',
    )
  })

  describe('a tracked reference', () => {
    const REFERENCE = 'canon/design/button/dark.png'

    function trackedArgs(add: string, reference: string): string[] {
      return [
        '7',
        '--add',
        add,
        '--reference',
        reference,
        '--head',
        'abc1234',
        '--pass',
        '20261002T154450Z',
      ]
    }

    function seedReference(): string {
      mkdirSync(join(tempDir, 'canon', 'design', 'button'), {
        recursive: true,
      })
      const file = join(tempDir, REFERENCE)
      writeFileSync(file, readFileSync(join(tempDir, 'box-1.png')))
      return file
    }

    it('should pass when --add names the tracked file itself', async () => {
      const file = seedReference()

      const outcome = await runFrames(trackedArgs(file, REFERENCE))

      expect(outcome.record.reason).toBe('read-only')
    })

    it('should resolve the png extension a reference leaves off', async () => {
      const file = seedReference()

      const outcome = await runFrames(
        trackedArgs(file, 'canon/design/button/dark'),
      )

      expect(outcome.record.reason).toBe('read-only')
    })

    it('should refuse as bad-reference when --add names a different image', async () => {
      seedReference()

      const outcome = await runFrames(
        trackedArgs(join(tempDir, 'box-1.png'), REFERENCE),
      )

      expect({ reason: outcome.record.reason, calls: calls() }).toEqual({
        reason: 'bad-reference',
        calls: [],
      })
    })

    it('should refuse as bad-reference when the path is a directory', async () => {
      mkdirSync(join(tempDir, REFERENCE), { recursive: true })

      const outcome = await runFrames(
        trackedArgs(join(tempDir, 'box-1.png'), REFERENCE),
      )

      expect(outcome.record.reason).toBe('bad-reference')
    })
  })

  it('should refuse as bad-theme when --theme rides a reference', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      'home/hero',
      '--theme',
      'dark',
      '--pass',
      '20261002T154450Z',
    ])

    expect(outcome.record.reason).toBe('bad-theme')
  })

  it('should pass a valid reference through to the write', async () => {
    const outcome = await runFrames([
      '7',
      '--add',
      join(tempDir, 'box-1.png'),
      '--reference',
      'home/hero',
      '--head',
      'abc1234',
      '--pass',
      '20261002T154450Z',
    ])

    expect(outcome.record.reason).toBe('read-only')
  })

  describe('with --reel', () => {
    const WEBP = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1,
    ])

    function reelArgs(file: string): string[] {
      return [
        '7',
        '--reel',
        join(tempDir, file),
        '--head',
        'abc1234',
        '--pass',
        '20261002T154450Z',
      ]
    }

    it('should reach the write for a WebP reel', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames(reelArgs('reel.webp'))

      // The fake gh refuses every write, so reaching it reads as read-only.
      expect(outcome.record.reason).toBe('read-only')
    })

    it('should refuse as unreadable-reel without calling gh for a PNG or an MP4', async () => {
      writeFileSync(
        join(tempDir, 'reel.mp4'),
        new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73]),
      )

      const png = await runFrames(reelArgs('box-1.png'))
      const mp4 = await runFrames(reelArgs('reel.mp4'))

      expect({
        reasons: [png.record.reason, mp4.record.reason],
        calls: calls(),
      }).toEqual({
        reasons: ['unreadable-reel', 'unreadable-reel'],
        calls: [],
      })
    })

    it('should refuse as reel-too-large without calling gh past 10 MB', async () => {
      const big = new Uint8Array(10_000_001)
      big.set(WEBP)
      writeFileSync(join(tempDir, 'big.webp'), big)

      const outcome = await runFrames(reelArgs('big.webp'))

      expect({ outcome, calls: calls() }).toEqual({
        outcome: {
          record: expect.objectContaining({ reason: 'reel-too-large' }),
          exit: 1,
        },
        calls: [],
      })
    })

    it('should refuse as bad-box when --reel rides a --box', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames([...reelArgs('reel.webp'), '--box', '1'])

      expect(outcome.record.reason).toBe('bad-box')
    })

    it('should refuse as bad-mode when --reel and --add are both passed', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames([
        ...reelArgs('reel.webp'),
        '--add',
        join(tempDir, 'box-1.png'),
      ])

      expect(outcome.record.reason).toBe('bad-mode')
    })

    it('should refuse as bad-pass when --reel carries no pass stamp', async () => {
      writeFileSync(join(tempDir, 'reel.webp'), WEBP)

      const outcome = await runFrames([
        '7',
        '--reel',
        join(tempDir, 'reel.webp'),
      ])

      expect(outcome.record.reason).toBe('bad-pass')
    })
  })

  it('should list every refusal reason in the help text', async () => {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'frames', '--help'],
      { reject: false, timeout: RUN_TIMEOUT_MS },
    )

    expect(
      [
        'bad-mode',
        'no-number',
        'bad-box',
        'bad-reference',
        'bad-days',
        'unreadable-frame',
        'unreadable-reel',
        'reel-too-large',
        'read-only',
        'unreadable-tip',
        'push-failed',
        'ref-conflict',
        'bad-head',
        'bad-pass',
      ].filter((reason) => !result.stdout.includes(reason)),
    ).toEqual([])
  })
})
