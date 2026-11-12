import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa, execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderEvidenceBody } from '@/pr/evidence'
import {
  CLI,
  RUN_TIMEOUT_MS,
  initBranchRepo,
  writeFakeGh,
} from '@/commands/pr/fixture'

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
