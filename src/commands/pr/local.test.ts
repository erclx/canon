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
import { join } from 'node:path'
import { execa, type ResultPromise } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
    const masked =
      'body=## UI review closed\n\n0 failed · 0 need your eyes · 2 passed · 0 not driven\nDriven at `38db88d` on a local preview, rendered by agent-browser.\n\n<!-- review-ui: head=38db88d -->'
    expect(readFileSync(join(tempDir, 'review-body-11.log'), 'utf8')).toBe(
      masked,
    )
    expect(readFileSync(join(tempDir, 'review-body-13.log'), 'utf8')).toBe(
      masked,
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
