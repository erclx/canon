import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = join(
  import.meta.dirname,
  '../../claude/skills/role-orchestrator/scripts/poll.ts',
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
  // The head a UI pass names in its own marker, which can trail the stamp.
  marker?: string
  submittedAt: string
}

const CODE_HEADINGS = new Set(['## Review', '## Review closed'])

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
        commit_id: head,
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

  // The verb reads the code family alone, so a UI pass posted after the code
  // pass leaves the scope where the code pass put it.
  const last = reviews
    .filter((review) => CODE_HEADINGS.has(review.heading))
    .at(-1)
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
  const run = spawnSync('bun', [SCRIPT], {
    cwd: join(root, 'repo'),
    encoding: 'utf8',
    env: buildEnv(),
  })

  return { status: run.status, stderr: run.stderr, stdout: run.stdout.trim() }
}

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

  // The stub answers the REST reads the script makes and refuses everything
  // else. `pr`, `repo view`, and `graphql` exit non-zero, which is a host that
  // blocks GraphQL, so a script still reaching one fails every case below. The
  // open list is #7 alone unless a case writes `open.txt`, and every per-pull
  // read answers from the fixture files carrying that number.
  const stub = join(root, 'bin', 'gh')
  const fixtures = join(root, 'fixtures')
  writeFileSync(
    stub,
    [
      '#!/usr/bin/env bash',
      'if [ "$1" != "api" ]; then exit 1; fi',
      "pulls='repos/{owner}/{repo}/pulls/'",
      "issues='repos/{owner}/{repo}/issues/'",
      'for arg in "$@"; do',
      '  case "$arg" in',
      '    graphql) exit 1 ;;',
      '    "repos/{owner}/{repo}/pulls?state=open"*)',
      `      if [ -f "${fixtures}/open.txt" ]; then cat "${fixtures}/open.txt"; else echo 7; fi; exit 0 ;;`,
      '    "$pulls"*/reviews*)',
      '      n=${arg#"$pulls"}; n=${n%%/*}',
      `      if [ -f "${fixtures}/unreadable" ]; then exit 1; fi`,
      `      cat "${fixtures}/reviews-$n.jsonl"; exit 0 ;;`,
      '    "$issues"*/comments*)',
      '      n=${arg#"$issues"}; n=${n%%/*}',
      `      if [ -f "${fixtures}/unreadable" ] || [ -f "${fixtures}/comments-unreadable" ]; then exit 1; fi`,
      `      cat "${fixtures}/comments-$n.jsonl"; exit 0 ;;`,
      '    "$pulls"*)',
      '      n=${arg#"$pulls"}',
      `      cat "${fixtures}/head-$n.txt"; exit 0 ;;`,
      '    "repos/{owner}/{repo}") echo main; exit 0 ;;',
      '  esac',
      'done',
      'exit 1',
      '',
    ].join('\n'),
  )
  chmodSync(stub, 0o755)

  // `pr review-state` answers from the fixture the thread was written with, and
  // every other verb refuses. `pr head` refusing is what the fixture already
  // produced without a stub, since it has no remote for `git ls-remote` to
  // reach, so the head still falls back to the pull read.
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

  // A baseline the bash script wrote reads under the port with no first-run
  // flood, so the first run after the swap says nothing.
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

  // Two reads feed one payload. A comments read that fails beside a reviews
  // read that succeeds must not read as a thread with no replies, which would
  // report the pull request as new or drop its RESPONSE.
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

  // A regression that blanks the count on a carry makes the next healthy run
  // read zero against the thread's real count and report every comment already
  // there as UNMATCHED.
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

  // A refusal that exits zero carries a reason and no source, and one that
  // exits nonzero carries nothing, so both send the read to the fallback and
  // neither changes the run's status.
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

      // The push. The stamp follows the head and the marker does not, so only
      // the marker says the verdict is about the older commit.
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

  // These cases need real commits on both sides, so the repository gets a bare
  // origin carrying `main` and each pull request's head under the ref GitHub
  // publishes it at. A five-line file lets two sides touch it without colliding.
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

    // The draft lift waits for a push carrying no STALE beside its MOVED, so a
    // push that left the branch behind has to say so again.
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
  })
})
