import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runAsync } from '../../claude/skills/role-orchestrator/scripts/repo'

const SCRIPT = join(
  import.meta.dirname,
  '../../claude/skills/role-orchestrator/scripts/poll.ts',
)

const HEAD = '1111111111111111111111111111111111111111'

// The commit a raced pass read, which the head moved off before that pass was
// posted. Only the marker names it, so a run that reads the submission stamp
// instead never sees this value at all.
const READ_HEAD = '2222222222222222222222222222222222222222'

// A pass, the worker's answer, and a close-out seconds later. Fixed values keep
// the derived age far past `STALE_AFTER`, so a case reaching STALLED reports
// rather than passing by drifting under the threshold.
const FIRST_PASS = '2026-08-20T02:00:00Z'
const RESPONSE_AT = '2026-08-20T02:02:16Z'
const CLOSE_OUT = '2026-08-20T02:03:52Z'

let root: string

// Ends a wait child a test spawned, so a test that times out leaves no loop
// polling a root that afterEach has already removed.
let stopWaiter: (() => Promise<unknown>) | undefined

// A git hook exports GIT_DIR, so a run under pre-push would resolve the fixture
// against the toolkit's own repository and every case would answer for the
// wrong tree.
const inheritedEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  )

const buildEnv = (): NodeJS.ProcessEnv => ({
  ...inheritedEnv(),
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_AUTHOR_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  FAKE_FIXTURES: join(root, 'fixtures'),
  PATH: `${join(root, 'bin')}:${process.env.PATH}`,
})

const sh = (script: string): string =>
  execFileSync('bash', ['-c', script], {
    cwd: root,
    encoding: 'utf8',
    env: buildEnv(),
  })

interface Review {
  heading: string
  // The head a UI pass names in its own marker, which can trail the stamp.
  marker?: string
  // The commit GitHub pinned the review to, which a `PUT` rewrite never moves.
  stamp?: string
  submittedAt: string
}

const CODE_HEADINGS = new Set(['## Review', '## Review closed'])

interface Comment {
  createdAt: string
  heading: string
}

// On disk so one run rewrites the thread and the next reads it against the
// baseline. The scope record mirrors `pr review-state` for an unmarked thread, so
// a case fails on its behavior rather than on the read having moved.
const writeThread = (
  reviews: Review[],
  comments: Comment[],
  head = HEAD,
): void => {
  const lines = (rows: unknown[]): string =>
    rows.map((row) => `${JSON.stringify(row)}\n`).join('')

  writeFileSync(
    join(root, 'fixtures', 'reviews-7.jsonl'),
    lines(
      reviews.map((review) => ({
        body:
          review.marker === undefined
            ? `${review.heading}\n\nbody`
            : `${review.heading}\n\nbody\n\n<!-- review-ui: head=${review.marker} -->`,
        commit_id: review.stamp ?? head,
        submitted_at: review.submittedAt,
      })),
    ),
  )
  writeFileSync(
    join(root, 'fixtures', 'comments-7.jsonl'),
    lines(
      comments.map((comment) => ({
        body: `${comment.heading}\n\nbody`,
        created_at: comment.createdAt,
      })),
    ),
  )
  writeFileSync(join(root, 'fixtures', 'head-7.txt'), `${head}\n`)

  // Code family on top, UI in `ui`, covered when its marker or else its stamp names the head.
  const last = reviews
    .filter((review) => CODE_HEADINGS.has(review.heading))
    .at(-1)
  const lastUi = reviews
    .filter((review) => review.heading.startsWith('## UI review'))
    .at(-1)
  const uiCommit = lastUi?.marker ?? lastUi?.stamp ?? head
  const ui =
    lastUi === undefined
      ? { source: 'none', state: 'none', isCovered: false }
      : {
          commit: uiCommit,
          heading: lastUi.heading,
          isCovered: head.startsWith(uiCommit),
          source: lastUi.marker === undefined ? 'fallback' : 'marker',
          state: lastUi.heading === '## UI review' ? 'open' : 'closed',
        }
  writeScope({
    ...(last === undefined
      ? { source: 'none', state: 'none' }
      : {
          commit: head,
          heading: last.heading,
          source: 'fallback',
          state: last.heading === '## Review' ? 'open' : 'closed',
          submittedAt: last.submittedAt,
        }),
    ui,
  })
}

/** Overrides what the verb answers, which is how a marker reaches the script. */
const writeScope = (record: Record<string, unknown>): void => {
  writeFileSync(join(root, 'fixtures', 'scope-7.json'), JSON.stringify(record))
}

interface PollResult {
  status: null | number
  stderr: string
  stdout: string
}

const poll = (...args: string[]): PollResult => {
  const run = spawnSync('bun', [SCRIPT, ...args], {
    cwd: join(root, 'repo'),
    encoding: 'utf8',
    env: buildEnv(),
  })

  return { status: run.status, stderr: run.stderr, stdout: run.stdout.trim() }
}

/** How many open-list reads the stub has answered since the file was last cleared. */
const readCount = (path: string): number =>
  existsSync(path)
    ? readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line !== '').length
    : 0

// The stub refuses the reviews and comments reads while this file exists, which
// is how a run reaches the carry-forward path without needing the network to
// fail.
const breakView = (): void => {
  writeFileSync(join(root, 'fixtures', 'unreadable'), '')
}

// The stub refuses the comments read alone, leaving the reviews read healthy.
const breakComments = (): void => {
  writeFileSync(join(root, 'fixtures', 'comments-unreadable'), '')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orchestrate-poll-'))
  mkdirSync(join(root, 'bin'), { recursive: true })
  mkdirSync(join(root, 'fixtures'), { recursive: true })
  sh('git init -q repo')
  sh('git -C repo commit -q --allow-empty -m init')

  // Answers the REST reads and refuses the rest, and the open list is one number unless `open.txt` exists.
  const stub = join(root, 'bin', 'gh')
  copyFileSync(new URL('./fixtures/gh-poll.sh', import.meta.url), stub)
  chmodSync(stub, 0o755)

  // Only `pr review-state` answers, so the head falls back to the pull read.
  const canon = join(root, 'bin', 'canon')
  copyFileSync(new URL('./fixtures/canon-poll.sh', import.meta.url), canon)
  chmodSync(canon, 0o755)
})

afterEach(async () => {
  await stopWaiter?.()
  stopWaiter = undefined
  rmSync(root, { force: true, recursive: true })
})

describe('poll', () => {
  it('should report nothing when the response predates the last review pass', () => {
    writeThread([{ heading: '## Review', submittedAt: FIRST_PASS }], [])
    expect(poll().stdout).toContain('SEEN')

    writeThread(
      [
        { heading: '## Review', submittedAt: FIRST_PASS },
        { heading: '## Review closed', submittedAt: CLOSE_OUT },
      ],
      [{ createdAt: RESPONSE_AT, heading: '## Review response' }],
    )
    expect(poll().stdout).toBe('No movement.')
  })

  it('should report a response that lands after the last review pass', () => {
    writeThread([{ heading: '## Review', submittedAt: FIRST_PASS }], [])
    expect(poll().stdout).toContain('SEEN')

    writeThread(
      [{ heading: '## Review', submittedAt: FIRST_PASS }],
      [{ createdAt: RESPONSE_AT, heading: '## Review response' }],
    )
    expect(poll().stdout).toContain('RESPONSE  #7')
  })

  it('should report a response on a pull request carrying no review pass', () => {
    writeThread([], [])
    expect(poll().stdout).toContain('OPENED')

    writeThread([], [{ createdAt: RESPONSE_AT, heading: '## Review response' }])
    expect(poll().stdout).toContain('RESPONSE  #7')
  })

  // A carried line has no stamps, so only the count test keeps them from reading as numbers.
  it('should classify nothing when a carried line supplies no stamps', () => {
    writeThread(
      [{ heading: '## Review', submittedAt: FIRST_PASS }],
      [{ createdAt: RESPONSE_AT, heading: '## Review response' }],
    )
    expect(poll().stdout).toContain('SEEN')

    breakView()
    const carried = poll()

    expect(carried.status).toBe(0)
    expect(carried.stdout).toBe('No movement.')
    expect(carried.stderr).toContain('#7 could not be read')
  })

  it('should report a comment posted under a heading outside the known set', () => {
    writeThread([], [])
    expect(poll().stdout).toContain('OPENED')

    writeThread(
      [],
      [{ createdAt: RESPONSE_AT, heading: '## Something Unexpected' }],
    )
    const unmatched = poll()
    expect(unmatched.stdout).toContain('UNMATCHED #7')
    expect(unmatched.stdout).toContain('## Something Unexpected')

    // The count caught up, so the same comment does not report a second time.
    expect(poll().stdout).toBe('No movement.')
  })

  it('should not report an evidence comment as unmatched or as a reply', () => {
    writeThread([], [])
    expect(poll().stdout).toContain('OPENED')

    writeThread([], [{ createdAt: RESPONSE_AT, heading: '## Evidence' }])
    expect(poll().stdout).toBe('No movement.')
  })

  // The folded closing confirmation's shape must reach no classification at all.
  it('should report nothing when a comment carries no heading at all', () => {
    writeThread([], [])
    expect(poll().stdout).toContain('OPENED')

    writeThread(
      [],
      [
        {
          createdAt: RESPONSE_AT,
          heading: '✅ All review findings addressed, CI green.',
        },
      ],
    )
    expect(poll().stdout).toBe('No movement.')
  })

  // A push between a pass's read and its post moves the stamp, and only the marker holds.
  it('should report a head the stamp claims is covered as seen', () => {
    writeThread(
      [{ heading: '## Review', submittedAt: FIRST_PASS }],
      [],
      READ_HEAD,
    )
    expect(poll().stdout).toContain('SEEN')

    // GitHub stamps a review submitted after a push with the new head.
    writeThread([{ heading: '## Review', submittedAt: FIRST_PASS }], [], HEAD)

    expect(poll().stdout).toContain(
      'SEEN      #7 -> 1111111, already covered by the last pass',
    )
  })

  it('should report a head the marker leaves uncovered as moved', () => {
    writeThread(
      [{ heading: '## Review', submittedAt: FIRST_PASS }],
      [],
      READ_HEAD,
    )
    expect(poll().stdout).toContain('SEEN')

    // Only the marker still names the commit that pass actually read.
    writeThread([{ heading: '## Review', submittedAt: FIRST_PASS }], [], HEAD)
    writeScope({
      commit: READ_HEAD,
      heading: '## Review',
      readAt: FIRST_PASS,
      source: 'marker',
      state: 'open',
      submittedAt: FIRST_PASS,
    })

    expect(poll().stdout).toContain('MOVED     #7')
  })

  it('should route a post-review-findings comment the same as a review response', () => {
    writeThread([{ heading: '## Review', submittedAt: FIRST_PASS }], [])
    expect(poll().stdout).toContain('SEEN')

    writeThread(
      [{ heading: '## Review', submittedAt: FIRST_PASS }],
      [{ createdAt: RESPONSE_AT, heading: '## Post-review findings' }],
    )
    expect(poll().stdout).toContain('RESPONSE  #7')
  })

  // A baseline the bash script wrote reads with no first-run flood.
  it('should read a baseline line the bash script wrote without reporting it', () => {
    writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
    mkdirSync(join(root, 'repo', '.canon', 'tmp', 'pr', 'poll'), {
      recursive: true,
    })
    writeFileSync(
      join(root, 'repo', '.canon', 'tmp', 'pr', 'poll', 'baseline.txt'),
      `7 ${HEAD} ${HEAD} 0 unknown closed 0 none\n`,
    )

    expect(poll().stdout).toBe('No movement.')
  })

  // A timing run must leave the movement it saw for the next real run.
  it('should report movement without recording it under --no-record', () => {
    writeThread([{ heading: '## Review', submittedAt: FIRST_PASS }], [])
    const baseline = join(root, 'repo', '.canon', 'tmp', 'pr', 'poll')

    const inspected = poll('--no-record')

    expect(inspected.stdout).toContain('#7')
    expect(existsSync(join(baseline, 'baseline.txt'))).toBe(false)
    expect(poll().stdout).toBe(inspected.stdout)
  })

  // A still board holds the wait to its cap and leaves the baseline as a plain run did.
  it('should print one No movement line at the wait cap and record nothing new', () => {
    writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
    poll()
    const baseline = join(
      root,
      'repo',
      '.canon',
      'tmp',
      'pr',
      'poll',
      'baseline.txt',
    )
    const settled = readFileSync(baseline, 'utf8')

    const waited = poll('--wait', '1', '--every', '60')

    expect(waited.status).toBe(0)
    expect(waited.stdout).toBe('No movement.')
    expect(readFileSync(baseline, 'utf8')).toBe(settled)
  })

  // An interval as long as the cap once ended the wait after its first read.
  it('should hold a quiet wait to its cap when the interval matches it', () => {
    writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
    poll()
    const started = Date.now()

    const waited = poll('--wait', '2', '--every', '2')

    expect(waited.stdout).toBe('No movement.')
    expect(Date.now() - started).toBeGreaterThanOrEqual(2000)
  })

  it('should exit on the first run that reports movement', () => {
    writeThread([{ heading: '## Review', submittedAt: FIRST_PASS }], [])
    const started = Date.now()

    const waited = poll('--wait', '60', '--every', '30')

    expect(waited.stdout).toContain('#7')
    expect(waited.stdout).not.toContain('No movement.')
    expect(Date.now() - started).toBeLessThan(20_000)
  })

  it('should keep reading until a later run reports movement', async () => {
    writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
    poll()
    const reads = join(root, 'fixtures', 'list-reads')
    const baseline = join(
      root,
      'repo',
      '.canon',
      'tmp',
      'pr',
      'poll',
      'baseline.txt',
    )
    rmSync(reads, { force: true })
    utimesSync(baseline, 0, 0)
    const child = spawn('bun', [SCRIPT, '--wait', '30', '--every', '1'], {
      cwd: join(root, 'repo'),
      env: buildEnv(),
    })
    let stdout = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    let closed = false
    const exited = new Promise<null | number>((resolve) =>
      child.on('close', (code) => {
        closed = true
        resolve(code)
      }),
    )

    stopWaiter = () => {
      child.kill()
      return exited
    }

    // The reply lands after the first pass wrote the baseline, so only a later read exits.
    while (!closed && statSync(baseline).mtimeMs <= 0) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    writeThread(
      [{ heading: '## Review closed', submittedAt: CLOSE_OUT }],
      [{ createdAt: '2026-08-20T03:00:00Z', heading: '## Review response' }],
    )

    expect(await exited).toBe(0)
    expect(stdout).toContain('RESPONSE  #7')
    expect(readCount(reads)).toBeGreaterThanOrEqual(2)
  })

  it('should hold a wait past an open list that fails every read', () => {
    writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
    writeFileSync(join(root, 'fixtures', 'list-unreadable'), '')
    const reads = join(root, 'fixtures', 'list-reads')
    rmSync(reads, { force: true })
    const started = Date.now()

    const waited = poll('--wait', '3', '--every', '1')

    expect(waited.status).toBe(1)
    expect(waited.stderr).toContain('open pull request list could not be read')
    expect(readCount(reads)).toBeGreaterThanOrEqual(2)
    expect(Date.now() - started).toBeGreaterThanOrEqual(2000)
  })

  it('should read a hung command as failed once its timeout passes', async () => {
    const started = Date.now()

    const result = await runAsync('sleep', ['5'], 200)

    expect(result.isOk).toBe(false)
    expect(Date.now() - started).toBeLessThan(3000)
  })

  it('should hold a wait past a pull request that fails every read', () => {
    writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
    poll()
    breakView()

    const waited = poll('--wait', '1', '--every', '60')

    expect(waited.stdout).toBe('No movement.')
    expect(waited.stderr).toContain('#7 could not be read')
  })

  it('should refuse a wait that is not a positive number of seconds', () => {
    writeThread([], [])

    const refused = poll('--wait', 'soon')

    expect(refused.status).toBe(1)
    expect(refused.stderr).toContain('--wait')
  })

  // A failed comments read must not read as a thread with no replies.
  it('should carry a pull request forward when only the comments read fails', () => {
    writeThread(
      [{ heading: '## Review', submittedAt: FIRST_PASS }],
      [{ createdAt: RESPONSE_AT, heading: '## Review response' }],
    )
    expect(poll().stdout).toContain('SEEN')

    breakComments()
    const carried = poll()

    expect(carried.status).toBe(0)
    expect(carried.stdout).toBe('No movement.')
    expect(carried.stderr).toContain('#7 could not be read')
  })

  it('should read a review with no submission stamp as a pass with no age', () => {
    writeThread([], [])
    writeFileSync(
      join(root, 'fixtures', 'reviews-7.jsonl'),
      `${JSON.stringify({ body: '## Review\n\nbody', commit_id: HEAD, submitted_at: null })}\n`,
    )
    writeScope({ reason: 'no-marker' })

    expect(poll().stdout).toContain('SEEN      #7 at 1111111')
  })

  // A blanked count would report every existing comment as UNMATCHED next run.
  it('should keep the unmatched count and UI token on a carried line', () => {
    const dir = join(root, 'repo', '.canon', 'tmp', 'pr', 'poll')
    const baseline = join(dir, 'baseline.txt')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      baseline,
      `7 ${HEAD} none 0 unknown closed 2 open-head-1111111\n`,
    )
    writeThread([], [])
    breakView()

    const carried = poll()

    expect(carried.stdout).toBe('No movement.')
    expect(readFileSync(baseline, 'utf8')).toBe(
      `7 ${HEAD} none 0 unknown carried 2 open-head-1111111\n`,
    )
  })

  // Both refusal shapes fall back without changing the status.
  it('should fall back when the verb answers a refusal record', () => {
    writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
    writeScope({ reason: 'no-marker' })

    const run = poll()

    expect(run.status).toBe(0)
    expect(run.stdout).toContain('SEEN      #7 at 1111111')
  })

  it('should fall back when the verb exits nonzero', () => {
    writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
    rmSync(join(root, 'fixtures', 'scope-7.json'))

    const run = poll()

    expect(run.status).toBe(0)
    expect(run.stdout).toContain('SEEN      #7 at 1111111')
  })

  describe('UI review state', () => {
    const UI_AT = '2026-08-20T02:05:00Z'

    it('should report nothing about a UI pass when none was posted', () => {
      writeThread([{ heading: '## Review', submittedAt: FIRST_PASS }], [])
      expect(poll().stdout).toContain('SEEN')

      writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])

      expect(poll().stdout).not.toContain('UI-')
    })

    it('should read the UI family as unread when the verb record carries no ui', () => {
      writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
      expect(poll().stdout).toContain('SEEN')

      writeThread(
        [
          { heading: '## Review closed', submittedAt: CLOSE_OUT },
          { heading: '## UI review closed', marker: HEAD, submittedAt: UI_AT },
        ],
        [],
      )
      writeScope({
        commit: HEAD,
        heading: '## Review closed',
        source: 'fallback',
        state: 'closed',
        submittedAt: CLOSE_OUT,
      })

      expect(poll().stdout).not.toContain('UI-')
    })

    it('should report an open UI pass at the head', () => {
      writeThread([{ heading: '## Review', submittedAt: FIRST_PASS }], [])
      expect(poll().stdout).toContain('SEEN')

      writeThread(
        [
          { heading: '## Review', submittedAt: FIRST_PASS },
          { heading: '## UI review', marker: HEAD, submittedAt: UI_AT },
        ],
        [],
      )

      expect(poll().stdout).toContain('UI-OPEN   #7 open at 1111111')
    })

    it('should report a closed UI pass at the head', () => {
      writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
      expect(poll().stdout).toContain('SEEN')

      writeThread(
        [
          { heading: '## Review closed', submittedAt: CLOSE_OUT },
          { heading: '## UI review closed', marker: HEAD, submittedAt: UI_AT },
        ],
        [],
      )

      expect(poll().stdout).toContain('UI-CLOSED #7 closed at 1111111')
    })

    it('should report an edited UI close at the head its marker names', () => {
      writeThread([{ heading: '## Review closed', submittedAt: CLOSE_OUT }], [])
      expect(poll().stdout).toContain('SEEN')

      // A `PUT` rewrite keeps the old stamp and moves the marker to the re-driven head.
      writeThread(
        [
          { heading: '## Review closed', submittedAt: CLOSE_OUT },
          {
            heading: '## UI review closed',
            marker: HEAD,
            stamp: READ_HEAD,
            submittedAt: UI_AT,
          },
        ],
        [],
      )

      expect(poll().stdout).toContain('UI-CLOSED #7 closed at 1111111')
    })

    describe('a rebase under both closes', () => {
      const closes: Review[] = [
        { heading: '## Review closed', submittedAt: CLOSE_OUT },
        {
          heading: '## UI review closed',
          marker: READ_HEAD,
          submittedAt: UI_AT,
        },
      ]
      const rebasedScope = (ui: Record<string, unknown>) => ({
        commit: READ_HEAD,
        heading: '## Review closed',
        readAt: CLOSE_OUT,
        review: {
          carriedAcross: 'rebase',
          carriedFrom: READ_HEAD,
          isCovered: true,
        },
        source: 'marker',
        state: 'closed',
        submittedAt: CLOSE_OUT,
        ui: {
          commit: READ_HEAD,
          heading: '## UI review closed',
          source: 'marker',
          state: 'closed',
          ...ui,
        },
      })

      it('should print one quiet line when both verdicts carried', () => {
        writeThread(closes, [], READ_HEAD)
        expect(poll().stdout).toContain('SEEN')

        writeThread(closes, [], HEAD)
        writeScope(
          rebasedScope({
            carriedAcross: 'rebase',
            carriedFrom: READ_HEAD,
            isCovered: true,
          }),
        )
        const rebased = poll().stdout

        expect(rebased).toContain('REBASED   #7 -> 1111111, verdicts carried')
        expect(rebased).not.toContain('MOVED')
        expect(rebased).not.toContain('UI-STALE')
      })

      it('should keep MOVED and UI-STALE when the rebase changed a driven path', () => {
        writeThread(closes, [], READ_HEAD)
        expect(poll().stdout).toContain('SEEN')

        writeThread(closes, [], HEAD)
        writeScope(rebasedScope({ isCovered: false, reason: 'ui-behind' }))
        const rebased = poll().stdout

        expect(rebased).toContain('MOVED     #7 -> 1111111')
        expect(rebased).toContain(
          'UI-STALE  #7 closed at 2222222, behind 1111111',
        )
        expect(rebased).not.toContain('REBASED')
      })
    })

    it('should report a closed UI pass a later push left behind the head', () => {
      writeThread(
        [
          { heading: '## Review closed', submittedAt: CLOSE_OUT },
          {
            heading: '## UI review closed',
            marker: READ_HEAD,
            submittedAt: UI_AT,
          },
        ],
        [],
        READ_HEAD,
      )
      expect(poll().stdout).toContain('SEEN')

      // Only the marker says the verdict is about the older commit.
      writeThread(
        [
          { heading: '## Review closed', submittedAt: CLOSE_OUT },
          {
            heading: '## UI review closed',
            marker: READ_HEAD,
            submittedAt: UI_AT,
          },
        ],
        [],
        HEAD,
      )

      expect(poll().stdout).toContain(
        'UI-STALE  #7 closed at 2222222, behind 1111111',
      )
    })
  })

  describe('evidence state', () => {
    const writeEvidence = (record: Record<string, unknown>): void => {
      writeFileSync(
        join(root, 'fixtures', 'evidence-7.json'),
        JSON.stringify(record),
      )
    }

    const baselineLine = (): string =>
      readFileSync(
        join(root, 'repo', '.canon', 'tmp', 'pr', 'poll', 'baseline.txt'),
        'utf8',
      ).trim()

    it('should report proof that settles after a reading owed it', () => {
      writeThread([], [])
      writeEvidence({ owed: ['evidence'], reason: 'owed', uncaptured: [] })
      expect(poll().stdout).toContain('OPENED')

      writeEvidence({ owed: [], reason: 'settled', uncaptured: [] })

      expect(poll().stdout).toBe('EVIDENCE  #7 proof settled at 1111111')
    })

    it('should report proof settling after an uncaptured path', () => {
      writeThread([], [])
      writeEvidence({ owed: [], reason: 'settled', uncaptured: ['src/a.tsx'] })
      expect(poll().stdout).toContain('OPENED')

      writeEvidence({ owed: [], reason: 'settled', uncaptured: [] })

      expect(poll().stdout).toBe('EVIDENCE  #7 proof settled at 1111111')
    })

    it('should read a deploy wait alone as settled proof', () => {
      writeThread([], [])
      writeEvidence({ owed: ['evidence'], reason: 'owed', uncaptured: [] })
      expect(poll().stdout).toContain('OPENED')

      writeEvidence({ owed: ['preview'], reason: 'owed', uncaptured: [] })

      expect(poll().stdout).toBe('EVIDENCE  #7 proof settled at 1111111')
    })

    it('should record a first sighting already settled and print nothing for it', () => {
      writeThread([], [])
      writeEvidence({ owed: [], reason: 'settled', uncaptured: [] })

      const first = poll()

      expect(first.stdout).not.toContain('EVIDENCE')
      expect(baselineLine().split(' ')[10]).toBe('settled')
    })

    it('should print nothing when an older ten-field line meets settled proof', () => {
      writeThread([], [])
      writeEvidence({ owed: [], reason: 'settled', uncaptured: [] })
      mkdirSync(join(root, 'repo', '.canon', 'tmp', 'pr', 'poll'), {
        recursive: true,
      })
      writeFileSync(
        join(root, 'repo', '.canon', 'tmp', 'pr', 'poll', 'baseline.txt'),
        `7 ${HEAD} none 0 unknown none 0 none unknown none\n`,
      )

      const run = poll()

      expect(run.stdout).not.toContain('EVIDENCE')
      expect(baselineLine().split(' ')[10]).toBe('settled')
    })

    it('should keep the last reading standing when the check refuses', () => {
      writeThread([], [])
      writeEvidence({ owed: ['evidence'], reason: 'owed', uncaptured: [] })
      expect(poll().stdout).toContain('OPENED')

      writeEvidence({ message: 'gh could not read', reason: 'gh-failed' })
      expect(poll().stdout).toBe('No movement.')
      expect(baselineLine().split(' ')[10]).toBe('owed')

      writeEvidence({ owed: [], reason: 'settled', uncaptured: [] })

      expect(poll().stdout).toBe('EVIDENCE  #7 proof settled at 1111111')
    })

    it('should store unread when the check refuses on a head that moved off settled proof', () => {
      writeThread([], [])
      writeEvidence({ owed: [], reason: 'settled', uncaptured: [] })
      poll()
      writeThread([], [], READ_HEAD)
      writeEvidence({ message: 'gh could not read', reason: 'gh-failed' })

      poll()

      expect(baselineLine().split(' ')[10]).toBe('unread')
    })

    it('should keep an owed reading when the check refuses on a moved head', () => {
      writeThread([], [])
      writeEvidence({ owed: ['evidence'], reason: 'owed', uncaptured: [] })
      poll()
      writeThread([], [], READ_HEAD)
      writeEvidence({ message: 'gh could not read', reason: 'gh-failed' })

      poll()

      expect(baselineLine().split(' ')[10]).toBe('owed')
    })

    it('should skip the read once proof settled at an unmoved head', () => {
      writeThread([], [])
      writeEvidence({ owed: [], reason: 'settled', uncaptured: [] })
      poll()
      rmSync(join(root, 'fixtures', 'evidence-reads.txt'))

      poll()

      expect(readCount(join(root, 'fixtures', 'evidence-reads.txt'))).toBe(0)
    })
  })

  // Real commits on a bare origin, with a five-line file two sides can share.
  describe('base movement', () => {
    const LINES = ['one', 'two', 'three', 'four', 'five']

    const fileWith = (line: number, text: string): string =>
      LINES.map((original, index) => (index === line ? text : original)).join(
        '\n',
      )

    /** Commits files onto a branch cut from `start` and returns its sha. */
    const commit = (
      start: string,
      branch: string,
      files: Record<string, string>,
    ): string => {
      sh(`git -C repo checkout -q -B ${branch} ${start}`)
      for (const [path, content] of Object.entries(files)) {
        writeFileSync(join(root, 'repo', path), `${content}\n`)
      }
      sh(`git -C repo add -A -- ${Object.keys(files).join(' ')}`)
      sh(`git -C repo commit -q -m ${branch}`)

      return sh('git -C repo rev-parse HEAD').trim()
    }

    const pushMain = (sha: string): void => {
      sh(`git -C repo push -q -f origin ${sha}:refs/heads/main`)
    }

    /** Publishes a pull request at `head` with an empty thread. */
    const openPull = (number: string, head: string): void => {
      sh(`git -C repo push -q -f origin ${head}:refs/pull/${number}/head`)
      writeFileSync(join(root, 'fixtures', `reviews-${number}.jsonl`), '')
      writeFileSync(join(root, 'fixtures', `comments-${number}.jsonl`), '')
      writeFileSync(join(root, 'fixtures', `head-${number}.txt`), `${head}\n`)
      writeFileSync(
        join(root, 'fixtures', `scope-${number}.json`),
        JSON.stringify({ source: 'none', state: 'none' }),
      )
    }

    const listOpen = (...numbers: string[]): void => {
      writeFileSync(
        join(root, 'fixtures', 'open.txt'),
        `${numbers.join('\n')}\n`,
      )
    }

    let base: string

    beforeEach(() => {
      sh('git init -q --bare origin.git')
      sh(`git -C repo remote add origin "${join(root, 'origin.git')}"`)
      base = commit('HEAD', 'base', {
        'a.txt': LINES.join('\n'),
        'b.txt': LINES.join('\n'),
      })
      pushMain(base)
    })

    it('should report a branch main moved under on a path it writes', () => {
      openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
      pushMain(commit(base, 'main2', { 'a.txt': fileWith(4, 'theirs') }))

      const first = poll().stdout

      expect(first).toContain(
        'STALE     #7 main changed 1 file(s) it writes since its base: a.txt',
      )
      expect(poll().stdout).toBe('No movement.')
    })

    // More pull requests than the read pool, so out-of-order reads would print out of order.
    it('should report pull requests in list order however their reads finish', () => {
      const numbers = ['3', '5', '7', '9', '11']
      for (const number of numbers) {
        openPull(number, commit(base, `pr${number}`, { 'a.txt': number }))
      }
      listOpen(...numbers)

      const opened = poll()
        .stdout.split('\n')
        .filter((line) => line.startsWith('OPENED'))
        .map((line) => /#(\d+)/.exec(line)?.[1])

      expect(opened).toEqual(numbers)
    })

    it('should not report a branch main moved under only on paths it does not write', () => {
      openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
      pushMain(commit(base, 'main2', { 'b.txt': fileWith(4, 'theirs') }))

      expect(poll().stdout).not.toContain('STALE')
    })

    it('should report a conflicted branch once rather than also as stale', () => {
      openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
      pushMain(commit(base, 'main2', { 'a.txt': fileWith(0, 'theirs') }))

      const run = poll().stdout

      expect(run).toContain('conflict against main')
      expect(run).not.toContain('STALE')
    })

    it('should report a branch that turns stale after its first sighting', () => {
      openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
      expect(poll().stdout).toContain('OPENED    #7')

      pushMain(commit(base, 'main2', { 'a.txt': fileWith(4, 'theirs') }))

      expect(poll().stdout).toContain('STALE     #7')
    })

    // The lift waits for a MOVED with no STALE, so a branch left behind says so again.
    it('should report a stale branch again when a push leaves it behind', () => {
      const first = commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') })
      openPull('7', first)
      const main2 = commit(base, 'main2', { 'a.txt': fileWith(4, 'theirs') })
      pushMain(main2)
      expect(poll().stdout).toContain('STALE     #7')

      openPull('7', commit(first, 'pr7', { 'b.txt': fileWith(2, 'fix') }))
      const pushed = poll().stdout

      expect(pushed).toContain('MOVED     #7')
      expect(pushed).toContain('STALE     #7')
    })

    it('should report a conflicted branch again when a push leaves it conflicting', () => {
      const first = commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') })
      openPull('7', first)
      expect(poll().stdout).toContain('OPENED    #7')
      pushMain(commit(base, 'main2', { 'a.txt': fileWith(0, 'theirs') }))
      expect(poll().stdout).toContain('CONFLICT  #7')

      openPull('7', commit(first, 'pr7', { 'b.txt': fileWith(2, 'fix') }))
      const pushed = poll().stdout

      expect(pushed).toContain('MOVED     #7')
      expect(pushed).toContain('CONFLICT  #7')
    })

    it('should not report a branch rebased onto main as stale', () => {
      openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
      const main2 = commit(base, 'main2', { 'a.txt': fileWith(4, 'theirs') })
      pushMain(main2)
      expect(poll().stdout).toContain('STALE     #7')

      openPull(
        '7',
        commit(main2, 'rebased', {
          'a.txt': fileWith(0, 'mine').replace('five', 'theirs'),
        }),
      )
      const rebased = poll().stdout

      expect(rebased).toContain('MOVED     #7')
      expect(rebased).not.toContain('STALE')
    })

    // The lift reads standing long after it was reported, so the check reads live.
    describe('standing check', () => {
      const baselinePath = (): string =>
        join(root, 'repo', '.canon', 'tmp', 'pr', 'poll', 'baseline.txt')

      const check = (number: string): PollResult => {
        const run = spawnSync('bun', [SCRIPT, '--check', number], {
          cwd: join(root, 'repo'),
          encoding: 'utf8',
          env: buildEnv(),
        })

        return {
          status: run.status,
          stderr: run.stderr,
          stdout: run.stdout.trim(),
        }
      }

      it('should report a stale branch as standing', () => {
        openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
        pushMain(commit(base, 'main2', { 'a.txt': fileWith(4, 'theirs') }))

        expect(check('7').stdout).toMatch(
          /^STALE {5}#7 standing at [0-9a-f]{7}$/,
        )
      })

      it('should report a conflicted branch as standing', () => {
        openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
        pushMain(commit(base, 'main2', { 'a.txt': fileWith(0, 'theirs') }))

        expect(check('7').stdout).toMatch(/^CONFLICT {2}#7 standing at /)
      })

      it('should report a branch rebased onto main as clear', () => {
        const main2 = commit(base, 'main2', { 'a.txt': fileWith(4, 'theirs') })
        pushMain(main2)
        openPull(
          '7',
          commit(main2, 'rebased', { 'a.txt': fileWith(0, 'mine') }),
        )

        expect(check('7').stdout).toMatch(/^CLEAR {5}#7 at /)
      })

      it('should report a branch main moved under since the last poll as stale', () => {
        openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
        expect(poll().stdout).toContain('OPENED    #7')
        const written = readFileSync(baselinePath(), 'utf8')

        pushMain(commit(base, 'main2', { 'a.txt': fileWith(4, 'theirs') }))
        const run = check('7')

        expect(run.stdout).toMatch(/^STALE {5}#7 standing at /)
        expect(readFileSync(baselinePath(), 'utf8')).toBe(written)
      })

      // The stub exits 1 with its record, as the lift verb does on every refusal.
      const liftRecord = (number: string, gates: object[]): void => {
        writeFileSync(
          join(root, 'fixtures', `lift-${number}.json`),
          JSON.stringify({
            gates,
            head: HEAD,
            isLifted: false,
            isOk: false,
            reason: 'review-open',
            waitedSeconds: 0,
          }),
        )
      }

      it('should take the standing the lift verb reads over its own', () => {
        const main2 = commit(base, 'main2', { 'a.txt': fileWith(4, 'theirs') })
        pushMain(main2)
        openPull(
          '7',
          commit(main2, 'rebased', { 'a.txt': fileWith(0, 'mine') }),
        )
        liftRecord('7', [
          { gate: 'review', isOk: false, reason: 'review-open' },
          { gate: 'standing', isOk: false, reason: 'standing-conflict' },
        ])

        expect(check('7').stdout).toBe(
          `CONFLICT  #7 standing at ${HEAD.slice(0, 7)}`,
        )
      })

      it('should read its own standing when the lift record carries none', () => {
        openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
        pushMain(commit(base, 'main2', { 'a.txt': fileWith(4, 'theirs') }))
        liftRecord('7', [])

        expect(check('7').stdout).toMatch(/^STALE {5}#7 standing at /)
      })

      it('should refuse a pull request whose head it cannot read', () => {
        const run = check('9')

        expect(run.status).toBe(1)
        expect(run.stderr).toContain('#9 returned no head')
      })
    })

    it('should report nothing for two open pull requests that merge together cleanly', () => {
      listOpen('7', '8')
      openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
      openPull('8', commit(base, 'pr8', { 'a.txt': fileWith(4, 'yours') }))

      expect(poll().stdout).not.toContain('OVERLAP')
    })

    it('should report two open pull requests that conflict on a shared path', () => {
      listOpen('7', '8')
      openPull('7', commit(base, 'pr7', { 'a.txt': fileWith(0, 'mine') }))
      openPull('8', commit(base, 'pr8', { 'a.txt': fileWith(0, 'yours') }))

      expect(poll().stdout).toContain('OVERLAP   #7 #8 conflict on a.txt')
      expect(poll().stdout).toBe('No movement.')
    })
  })

  // A carried line misreads the unmatched count too, so nothing may read it as a number.
  it('should classify nothing when a carried line supplies no unmatched count', () => {
    writeThread([], [])
    expect(poll().stdout).toContain('OPENED')

    writeThread(
      [],
      [{ createdAt: RESPONSE_AT, heading: '## Something Unexpected' }],
    )
    expect(poll().stdout).toContain('UNMATCHED #7')

    breakView()
    const carried = poll()

    expect(carried.status).toBe(0)
    expect(carried.stdout).toBe('No movement.')
    expect(carried.stderr).toContain('#7 could not be read')
  })
})
