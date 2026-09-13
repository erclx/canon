import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../claude/skills/role-orchestrator/scripts/poll.sh',
)

const HEAD = '1111111111111111111111111111111111111111'

// The commit a raced pass read, which the head moved off before that pass was
// posted. Only the marker names it, so a run that reads the submission stamp
// instead never sees this value at all.
const READ_HEAD = '2222222222222222222222222222222222222222'

// The three stamps replay the observed sequence: a pass lands, the worker
// answers it, and the reviewing session closes out seconds later. Fixed values
// keep the age the script derives far past `STALE_AFTER`, so a case reaching
// the STALLED branch would report rather than fall silent, and no case here can
// pass by drifting under the threshold.
const FIRST_PASS = '2026-08-20T02:00:00Z'
const RESPONSE_AT = '2026-08-20T02:02:16Z'
const CLOSE_OUT = '2026-08-20T02:03:52Z'

let root: string

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
  submittedAt: string
}

interface Comment {
  createdAt: string
  heading: string
}

// Writing the payload to disk rather than baking it into the stub is what lets
// one run rewrite the thread and the next read the new shape against the
// baseline the first one left.
//
// The scope record is written from the same reviews, in the shape
// `canon pr review-state` returns for a thread carrying no marker. That is what
// keeps every case below reading the same values the script derived before the
// verb existed, so a case here fails on the behavior it names rather than on
// the read having moved.
const writeThread = (
  reviews: Review[],
  comments: Comment[],
  head = HEAD,
): void => {
  writeFileSync(
    join(root, 'fixtures', 'pr-7.json'),
    JSON.stringify({
      comments: comments.map((comment) => ({
        body: `${comment.heading}\n\nbody`,
        createdAt: comment.createdAt,
      })),
      headRefOid: head,
      reviews: reviews.map((review) => ({
        body: `${review.heading}\n\nbody`,
        commit: { oid: head },
        submittedAt: review.submittedAt,
      })),
    }),
  )

  const last = reviews.at(-1)
  writeScope(
    last === undefined
      ? { source: 'none', state: 'none' }
      : {
          commit: head,
          heading: last.heading,
          source: 'fallback',
          state: last.heading === '## Review' ? 'open' : 'closed',
          submittedAt: last.submittedAt,
        },
  )
}

/** Overrides what the verb answers, which is how a marker reaches the script. */
const writeScope = (record: Record<string, string>): void => {
  writeFileSync(join(root, 'fixtures', 'scope-7.json'), JSON.stringify(record))
}

interface PollResult {
  status: null | number
  stderr: string
  stdout: string
}

const poll = (): PollResult => {
  const run = spawnSync('bash', [SCRIPT], {
    cwd: join(root, 'repo'),
    encoding: 'utf8',
    env: buildEnv(),
  })

  return { status: run.status, stderr: run.stderr, stdout: run.stdout.trim() }
}

// The stub refuses `pr view` while this file exists, which is how a run reaches
// the carry-forward path without needing the network to fail.
const breakView = (): void => {
  writeFileSync(join(root, 'fixtures', 'unreadable'), '')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orchestrate-poll-'))
  mkdirSync(join(root, 'bin'), { recursive: true })
  mkdirSync(join(root, 'fixtures'), { recursive: true })
  sh('git init -q repo')
  sh('git -C repo commit -q --allow-empty -m init')

  // The stub answers the three `gh` calls the script makes and nothing else.
  // `repo view` is what supplies the base branch, since the fixture has no
  // remote for `origin/HEAD` to resolve against.
  const stub = join(root, 'bin', 'gh')
  writeFileSync(
    stub,
    [
      '#!/usr/bin/env bash',
      'if [ "$1 $2" = "pr list" ]; then echo 7; exit 0; fi',
      `if [ -f "${join(root, 'fixtures')}/unreadable" ]; then exit 1; fi`,
      `if [ "$1 $2" = "pr view" ]; then cat "${join(root, 'fixtures')}/pr-$3.json"; exit 0; fi`,
      'if [ "$1 $2" = "repo view" ]; then echo main; exit 0; fi',
      'exit 0',
      '',
    ].join('\n'),
  )
  chmodSync(stub, 0o755)

  // `pr review-state` answers from the fixture the thread was written with, and
  // every other verb refuses. `pr head` refusing is what the fixture already
  // produced without a stub, since it has no remote for `git ls-remote` to
  // reach, so the head still falls back to the object's own field.
  const canon = join(root, 'bin', 'canon')
  writeFileSync(
    canon,
    [
      '#!/usr/bin/env bash',
      `if [ "$1 $2" = "pr review-state" ]; then cat "${join(root, 'fixtures')}/scope-$3.json"; exit 0; fi`,
      'exit 1',
      '',
    ].join('\n'),
  )
  chmodSync(canon, 0o755)
})

afterEach(() => {
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

  // The baseline holds no stamp, so a carried line arrives with both of them
  // empty. Nothing may read one as a number there, and the count test in front
  // of them is the only thing standing between the two.
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
    expect(carried.stderr).not.toContain('integer expression expected')
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

    // The count caught up with the baseline the line above wrote, so the same
    // comment does not report a second time.
    expect(poll().stdout).toBe('No movement.')
  })

  it('should not report an evidence comment as unmatched or as a reply', () => {
    writeThread([], [])
    expect(poll().stdout).toContain('OPENED')

    writeThread([], [{ createdAt: RESPONSE_AT, heading: '## Evidence' }])
    expect(poll().stdout).toBe('No movement.')
  })

  // The other unmatched case above still carries a `## ` prefix, just not one
  // of the six. This is the shape none of them exercise: no prefix at all,
  // which is what `review-address`'s folded closing confirmation now
  // depends on reaching neither `UNMATCHED` nor any other classification.
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

  // The two cases below are one thread read two ways. A push landing between a
  // pass's read and its post leaves GitHub's stamp on the new head, so the first
  // case reports a commit nobody reviewed as already covered. The marker names
  // what the pass read, which is what makes the second case report it.
  it('should report a head the stamp claims is covered as seen', () => {
    writeThread(
      [{ heading: '## Review', submittedAt: FIRST_PASS }],
      [],
      READ_HEAD,
    )
    expect(poll().stdout).toContain('SEEN')

    // The push. `writeThread` moves the stamp onto the new head with it, which
    // is what GitHub does to a review submitted after a push it never read.
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

    // The push. The stamp follows the head and the marker does not, so only the
    // marker still names the commit that pass actually read.
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

  // A carried line's shorter shape misreads the same way for the unmatched
  // count that it does for the two stamps above. Nothing may read that one as
  // a number either.
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
    expect(carried.stderr).not.toContain('integer expression expected')
  })
})
