import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkExpectation,
  countMechanicalAssertions,
  expectFilePath,
  parseExpectation,
  parseTarget,
  resolveVerdict,
  verdictExitCode,
  type CheckInput,
  type Expectation,
  type RunEnvelope,
  type Verdict,
} from '@/sandbox/expect'

const ARCHIVE = '.claude/plans/archive/feature-postgres-migration.md'
const PLANS_LIVE = '.claude/plans/feature-postgres-migration.md'
const PLANS_DECOY = '.claude/plans/feature-some-old-plan.md'
const TASKS = '.claude/tasks/v01.0-postgres.md'

const CLEAN_ENVELOPE: RunEnvelope = { isError: false, turns: 12, denials: 0 }

let sandbox: string

function write(path: string, body: string): void {
  const full = join(sandbox, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body)
}

/**
 * The tree a correct `/docs-fold` run leaves behind on the drift arm. Every
 * negative case mutates exactly one thing from here, so a case that goes red
 * names which assertion caught it.
 */
function seedCorrectTree(): void {
  write(ARCHIVE, '# Feature: Postgres migration\n')
  write(PLANS_DECOY, '# Feature: unlinked plan\n')
  write(
    TASKS,
    [
      '### Migrate storage to Postgres',
      '',
      'Plan: [feature-postgres-migration](../plans/archive/feature-postgres-migration.md)',
      '',
      '- [x] Outcome: tasks persist in Postgres instead of SQLite',
      '- [x] Outcome: connection config reads from environment',
      '',
    ].join('\n'),
  )
}

function driftExpectation(): Expectation {
  return {
    paths: [ARCHIVE, PLANS_DECOY],
    absent: [PLANS_LIVE],
    content: [
      { path: TASKS, pattern: '^- \\[x\\] Outcome: tasks persist in Postgres' },
      {
        path: TASKS,
        pattern:
          '^Plan: \\[feature-postgres-migration\\]\\(\\.\\./plans/archive/feature-postgres-migration\\.md\\)',
      },
    ],
    writeScope: ['.claude/**'],
    reply: [],
    manual: [
      'ARCHITECTURE.md storage section rewritten',
      'REQUIREMENTS.md non-goals updated',
    ],
    maxTurns: 20,
  }
}

/**
 * A reply assertion beside one tree assertion that always holds. The tree half
 * keeps the verdict out of the zero-assertion branch, so a skipped reply reads as
 * a skip rather than as the separate failure an arm with nothing to run reports.
 */
function replyExpectation(): Expectation {
  return {
    paths: [],
    absent: [PLANS_LIVE],
    content: [],
    writeScope: [],
    reply: ['canon/context/development.md'],
    manual: [],
    maxTurns: undefined,
  }
}

function runReply(envelope: RunEnvelope | undefined): Verdict {
  return checkExpectation(replyExpectation(), {
    sandboxDir: sandbox,
    envelope,
  })
}

function checkInput(overrides: Partial<CheckInput> = {}): CheckInput {
  return {
    sandboxDir: sandbox,
    writes: [TASKS, ARCHIVE],
    envelope: CLEAN_ENVELOPE,
    ...overrides,
  }
}

function runDrift(overrides: Partial<CheckInput> = {}): Verdict {
  return checkExpectation(driftExpectation(), checkInput(overrides))
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'canon-expect-'))
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('checkExpectation', () => {
  describe('on a correct tree', () => {
    it('should pass when every declared assertion holds', () => {
      seedCorrectTree()

      const verdict = runDrift()

      expect(verdict.state).toBe('pass')
      expect(verdict.failed).toBe(0)
    })

    it('should count manual lines as unchecked rather than asserted', () => {
      seedCorrectTree()

      const verdict = runDrift()

      expect(verdict.unchecked).toBe(2)
      expect(verdict.asserted).toBe(7)
    })
  })

  /**
   * A checker exercised only against a correct tree cannot distinguish asserting
   * correctly from asserting nothing, which is the defect this feature removes.
   * Each case below violates one assertion kind and must go red.
   */
  describe('on a tree that violates one assertion', () => {
    it('should fail when the swept plan was deleted rather than archived', () => {
      seedCorrectTree()
      unlinkSync(join(sandbox, ARCHIVE))

      const verdict = runDrift()

      expect(verdict.state).toBe('fail')
      expect(verdict.results).toContainEqual({
        ok: false,
        message: `missing: ${ARCHIVE}`,
      })
    })

    it('should fail when the swept plan is still in the plans folder', () => {
      seedCorrectTree()
      write(PLANS_LIVE, 'stale copy\n')

      const verdict = runDrift()

      expect(verdict.state).toBe('fail')
      expect(verdict.results).toContainEqual({
        ok: false,
        message: `should not exist: ${PLANS_LIVE}`,
      })
    })

    it('should fail when the unlinked plan was swept', () => {
      seedCorrectTree()
      unlinkSync(join(sandbox, PLANS_DECOY))

      expect(runDrift().state).toBe('fail')
    })

    it('should fail when the shipped task is left unchecked', () => {
      seedCorrectTree()
      write(
        TASKS,
        'Plan: [feature-postgres-migration](../plans/archive/feature-postgres-migration.md)\n\n- [ ] Outcome: tasks persist in Postgres instead of SQLite\n',
      )

      expect(runDrift().state).toBe('fail')
    })

    it('should fail when the plan line still points at the live plans folder', () => {
      seedCorrectTree()
      write(
        TASKS,
        'Plan: [feature-postgres-migration](../plans/feature-postgres-migration.md)\n\n- [x] Outcome: tasks persist in Postgres instead of SQLite\n',
      )

      expect(runDrift().state).toBe('fail')
    })

    it('should fail when the run wrote outside the declared scope', () => {
      seedCorrectTree()

      const verdict = runDrift({ writes: ['src/db.ts'] })

      expect(verdict.state).toBe('fail')
      expect(verdict.results).toContainEqual({
        ok: false,
        message: 'wrote outside declared scope: src/db.ts',
      })
    })

    it('should fail a pattern that does not compile rather than throwing', () => {
      seedCorrectTree()
      const expectation: Expectation = {
        ...driftExpectation(),
        content: [{ path: TASKS, pattern: '[unclosed' }],
      }

      const verdict = checkExpectation(expectation, checkInput())

      expect(verdict.state).toBe('fail')
      expect(verdict.results).toContainEqual({
        ok: false,
        message: `invalid pattern for ${TASKS}: [unclosed`,
      })
    })

    it('should fail a content assertion whose file does not exist', () => {
      seedCorrectTree()
      unlinkSync(join(sandbox, TASKS))

      const verdict = runDrift()

      expect(verdict.state).toBe('fail')
      expect(verdict.results).toContainEqual({
        ok: false,
        message: `no file to match: ${TASKS}`,
      })
    })
  })

  describe('on the run envelope', () => {
    it('should fail a run that reported an error', () => {
      seedCorrectTree()

      const verdict = runDrift({
        envelope: { ...CLEAN_ENVELOPE, isError: true },
      })

      expect(verdict.state).toBe('fail')
    })

    it('should fail a run over the declared turn ceiling', () => {
      seedCorrectTree()

      const verdict = runDrift({ envelope: { ...CLEAN_ENVELOPE, turns: 99 } })

      expect(verdict.results).toContainEqual({
        ok: false,
        message: 'envelope: 99 turns over ceiling of 20',
      })
    })

    it('should fail a run that recorded a permission denial', () => {
      seedCorrectTree()

      const verdict = runDrift({ envelope: { ...CLEAN_ENVELOPE, denials: 3 } })

      expect(verdict.state).toBe('fail')
    })

    it('should not pass a failing tree because the envelope was clean', () => {
      seedCorrectTree()
      unlinkSync(join(sandbox, ARCHIVE))

      expect(runDrift({ envelope: CLEAN_ENVELOPE }).state).toBe('fail')
    })
  })
})

/**
 * The declaration counts what it declares and the verdict counts what ran. Those
 * diverge on `write_scope`, which yields one result per write rather than one per
 * glob, so a pass with zero assertions has to be unreachable.
 */
describe('checkExpectation on an absent entry carrying a glob', () => {
  const HANDOFFS = '.claude/tasks/session-*.md'

  function runGlob(): Verdict {
    return checkExpectation(
      {
        paths: [],
        absent: [HANDOFFS],
        content: [],
        writeScope: [],
        reply: [],
        manual: [],
        maxTurns: undefined,
      },
      { sandboxDir: sandbox, envelope: CLEAN_ENVELOPE },
    )
  }

  it('should pass when no file matches the glob', () => {
    write('.claude/tasks/v01.0-postgres.md', '# A task\n')

    expect(runGlob().state).toBe('pass')
  })

  it('should fail when a file the run derived its name for matches', () => {
    write('.claude/tasks/session-feature-work.md', '# Session map\n')

    expect(runGlob().state).toBe('fail')
  })

  it('should name the matched file rather than the pattern that caught it', () => {
    write('.claude/tasks/session-feature-work.md', '# Session map\n')

    expect(runGlob().results).toContainEqual({
      ok: false,
      message: 'should not exist: .claude/tasks/session-feature-work.md',
    })
  })
})

describe('checkExpectation on a present entry carrying a glob', () => {
  const LESSON = '.claude/teach/01-regex/lessons/0001-*.html'

  function runGlob(): Verdict {
    return checkExpectation(
      {
        paths: [LESSON],
        absent: [],
        content: [{ path: LESSON, pattern: '^<link ' }],
        writeScope: [],
        reply: [],
        manual: [],
        maxTurns: undefined,
      },
      { sandboxDir: sandbox, envelope: CLEAN_ENVELOPE },
    )
  }

  it('should pass when a file the run derived its name for matches', () => {
    write(
      '.claude/teach/01-regex/lessons/0001-capture-groups.html',
      '<link rel="stylesheet" href="../assets/course.css">\n',
    )

    expect(runGlob().state).toBe('pass')
  })

  it('should fail when nothing matches the glob', () => {
    write('.claude/teach/01-regex/lessons/0002-quantifiers.html', '<link >\n')

    expect(runGlob().state).toBe('fail')
  })

  it('should name the matched file rather than the pattern that found it', () => {
    write(
      '.claude/teach/01-regex/lessons/0001-capture-groups.html',
      '<link rel="stylesheet" href="../assets/course.css">\n',
    )

    expect(runGlob().results).toContainEqual({
      ok: true,
      message:
        'exists: .claude/teach/01-regex/lessons/0001-capture-groups.html',
    })
  })

  it('should report a content miss against the entry as written', () => {
    expect(runGlob().results).toContainEqual({
      ok: false,
      message: `no file to match: ${LESSON}`,
    })
  })
})

describe('checkExpectation with no assertion able to run', () => {
  const scopeOnly: Expectation = {
    paths: [],
    absent: [],
    content: [],
    writeScope: ['.claude/**'],
    reply: [],
    manual: [],
    maxTurns: undefined,
  }

  it('should fail when a write-scope-only arm saw no writes', () => {
    const verdict = checkExpectation(scopeOnly, {
      sandboxDir: sandbox,
      writes: [],
    })

    expect(verdict.state).toBe('fail')
    expect(verdict.asserted).toBe(0)
  })

  it('should never report pass with zero assertions', () => {
    const verdict = checkExpectation(scopeOnly, {
      sandboxDir: sandbox,
      writes: [],
    })

    expect(verdict.state === 'pass' && verdict.asserted === 0).toBe(false)
  })

  it('should skip a declared scope the run gave no writes to check', () => {
    const verdict = checkExpectation(scopeOnly, {
      sandboxDir: sandbox,
      writes: [],
    })

    expect(verdict.skipped).toContain(
      'write scope: the run wrote nothing, so no path was checked',
    )
  })
})

/**
 * The case an arm alongside other assertions hits. `run.sh` always passes
 * `--writes`, so a run whose only output escaped the snapshot supplies an empty
 * list rather than none, and the declaration has to reach the unchecked count
 * instead of vanishing behind the assertions that did run.
 */
describe('checkExpectation with a scope beside assertions that ran', () => {
  it('should count an unchecked scope when the run wrote nothing', () => {
    seedCorrectTree()

    const verdict = checkExpectation(driftExpectation(), {
      sandboxDir: sandbox,
      writes: [],
      envelope: CLEAN_ENVELOPE,
    })

    expect(verdict.unchecked).toBe(3)
  })
})

/**
 * Undeclared is every arm today, so the first case is what keeps them
 * unaffected by a mechanism only one arm has opted into.
 */
describe('checkExpectation on escape scope', () => {
  function scopedExpectation(escapeScope: readonly string[]): Expectation {
    return {
      paths: [],
      absent: [],
      content: [],
      writeScope: [],
      escapeScope,
      reply: [],
      manual: [],
      maxTurns: undefined,
    }
  }

  it('should assert nothing when the arm declares no escape scope', () => {
    const verdict = checkExpectation(
      {
        ...scopedExpectation([]),
        escapeScope: undefined,
        absent: ['missing.md'],
      },
      { sandboxDir: sandbox, escapes: ['/main/.claude/plans/feature-x.md'] },
    )

    expect(verdict.results).toEqual([
      { ok: true, message: 'absent: missing.md' },
    ])
    expect(verdict.skipped).toEqual([])
  })

  it('should pass outright when a declared scope saw zero escapes', () => {
    const verdict = checkExpectation(scopedExpectation([]), {
      sandboxDir: sandbox,
      escapes: [],
    })

    expect(verdict.state).toBe('pass')
    expect(verdict.results).toContainEqual({
      ok: true,
      message: 'no escape during this run',
    })
  })

  it('should fail an escape against an empty declared scope', () => {
    const verdict = checkExpectation(scopedExpectation([]), {
      sandboxDir: sandbox,
      escapes: ['/main/.claude/plans/feature-x.md'],
    })

    expect(verdict.state).toBe('fail')
    expect(verdict.results).toContainEqual({
      ok: false,
      message: 'unbounded escape: /main/.claude/plans/feature-x.md',
    })
  })

  it('should append a witness count to an unbounded escape when a session was concurrent', () => {
    const verdict = checkExpectation(scopedExpectation([]), {
      sandboxDir: sandbox,
      escapes: ['/main/.claude/plans/feature-x.md'],
      concurrentSessions: ['live-session: unnamed in /somewhere'],
    })

    expect(verdict.state).toBe('fail')
    expect(verdict.results).toContainEqual({
      ok: false,
      message:
        'unbounded escape: /main/.claude/plans/feature-x.md (1 session live throughout the run)',
    })
  })

  it('should pluralize the witness count for more than one concurrent session', () => {
    const verdict = checkExpectation(scopedExpectation([]), {
      sandboxDir: sandbox,
      escapes: ['/main/.claude/plans/feature-x.md'],
      concurrentSessions: [
        'a-session: unnamed in /somewhere',
        'b-session: unnamed in /elsewhere',
      ],
    })

    expect(verdict.results).toContainEqual({
      ok: false,
      message:
        'unbounded escape: /main/.claude/plans/feature-x.md (2 sessions live throughout the run)',
    })
  })

  it('should not soften a declared escape into unbounded, or vice versa, when a witness is present', () => {
    const verdict = checkExpectation(
      scopedExpectation(['/main/.claude/tasks/**']),
      {
        sandboxDir: sandbox,
        escapes: ['/main/.claude/tasks/session-worker.md'],
        concurrentSessions: ['live-session: unnamed in /somewhere'],
      },
    )

    expect(verdict.state).toBe('pass')
    expect(verdict.results).toContainEqual({
      ok: true,
      message: 'declared escape: /main/.claude/tasks/session-worker.md',
    })
  })

  it('should keep ok, asserted, failed, and unchecked unchanged whether or not a witness is present', () => {
    const withoutWitness = checkExpectation(scopedExpectation([]), {
      sandboxDir: sandbox,
      escapes: ['/main/.claude/plans/feature-x.md'],
    })
    const withWitness = checkExpectation(scopedExpectation([]), {
      sandboxDir: sandbox,
      escapes: ['/main/.claude/plans/feature-x.md'],
      concurrentSessions: ['live-session: unnamed in /somewhere'],
    })

    expect(withWitness.state).toBe(withoutWitness.state)
    expect(withWitness.asserted).toBe(withoutWitness.asserted)
    expect(withWitness.failed).toBe(withoutWitness.failed)
    expect(withWitness.unchecked).toBe(withoutWitness.unchecked)
    expect(withWitness.results.map((r) => r.ok)).toEqual(
      withoutWitness.results.map((r) => r.ok),
    )
  })

  it('should pass an escape matching a declared glob', () => {
    const verdict = checkExpectation(
      scopedExpectation(['/main/.claude/tasks/**']),
      {
        sandboxDir: sandbox,
        escapes: ['/main/.claude/tasks/session-worker.md'],
      },
    )

    expect(verdict.state).toBe('pass')
    expect(verdict.results).toContainEqual({
      ok: true,
      message: 'declared escape: /main/.claude/tasks/session-worker.md',
    })
  })

  it('should skip rather than assert when no escape data was supplied', () => {
    const verdict = checkExpectation(scopedExpectation([]), {
      sandboxDir: sandbox,
    })

    expect(verdict.skipped).toContain(
      'escape scope: no escape data supplied, pass --escapes',
    )
  })

  it('should skip rather than pass when no watched root held a target', () => {
    const verdict = checkExpectation(scopedExpectation([]), {
      sandboxDir: sandbox,
      escapes: [],
      escapesWatched: false,
    })

    expect(verdict.state).toBe('fail')
    expect(verdict.results).toEqual([
      { ok: false, message: 'no assertion ran against this sandbox' },
    ])
    expect(verdict.skipped).toContain(
      'escape scope: no watched root held a target, unmeasured',
    )
  })

  it('should still pass outright when a watched root held a target and saw zero escapes', () => {
    const verdict = checkExpectation(scopedExpectation([]), {
      sandboxDir: sandbox,
      escapes: [],
      escapesWatched: true,
    })

    expect(verdict.state).toBe('pass')
    expect(verdict.results).toContainEqual({
      ok: true,
      message: 'no escape during this run',
    })
  })
})

describe('checkExpectation with data the caller did not supply', () => {
  it('should skip write scope rather than drop it when writes are absent', () => {
    seedCorrectTree()

    const verdict = checkExpectation(driftExpectation(), {
      sandboxDir: sandbox,
      envelope: CLEAN_ENVELOPE,
    })

    expect(verdict.skipped).toContain(
      'write scope: no write data supplied, pass --writes',
    )
    expect(verdict.unchecked).toBe(3)
  })

  it('should skip the turn ceiling rather than pass it when no envelope is given', () => {
    seedCorrectTree()

    const verdict = checkExpectation(driftExpectation(), {
      sandboxDir: sandbox,
      writes: [TASKS],
    })

    expect(verdict.skipped).toContain(
      'turn ceiling: no envelope supplied, pass --envelope',
    )
  })

  it('should distinguish an absent write list from an empty one', () => {
    seedCorrectTree()

    const absent = checkExpectation(driftExpectation(), {
      sandboxDir: sandbox,
      envelope: CLEAN_ENVELOPE,
    })
    const empty = checkExpectation(driftExpectation(), {
      sandboxDir: sandbox,
      writes: [],
      envelope: CLEAN_ENVELOPE,
    })

    expect(absent.skipped).toEqual([
      'write scope: no write data supplied, pass --writes',
    ])
    expect(empty.skipped).toEqual([
      'write scope: the run wrote nothing, so no path was checked',
    ])
  })
})

/**
 * The text is already on disk and the checker already opens the file. These cases
 * are what separates asserting against it from reporting a fabricated default,
 * which is the trap the kind was written around.
 */
describe('checkExpectation on the reply text', () => {
  it('should pass when the reply carries the declared fragment', () => {
    const verdict = runReply({
      ...CLEAN_ENVELOPE,
      reply: 'Stopped. No canon/context/development.md in this project.',
    })

    expect(verdict.state).toBe('pass')
    expect(verdict.results).toContainEqual({
      ok: true,
      message: 'reply says: canon/context/development.md',
    })
  })

  it('should fail when the reply never says the declared fragment', () => {
    const verdict = runReply({
      ...CLEAN_ENVELOPE,
      reply: 'Started the dev server on port 5173.',
    })

    expect(verdict.state).toBe('fail')
    expect(verdict.results).toContainEqual({
      ok: false,
      message: 'reply never says: canon/context/development.md',
    })
  })

  it('should skip rather than assert when no envelope was supplied', () => {
    const verdict = runReply(undefined)

    expect(verdict.skipped).toContain(
      'reply: no reply text supplied, pass --envelope',
    )
    expect(verdict.asserted).toBe(1)
    expect(verdict.unchecked).toBe(1)
  })

  it('should skip when the envelope carries no reply text', () => {
    const verdict = runReply(CLEAN_ENVELOPE)

    expect(verdict.skipped).toContain(
      'reply: no reply text supplied, pass --envelope',
    )
    expect(verdict.state).toBe('pass')
  })

  it('should fail an empty reply rather than skipping it', () => {
    const verdict = runReply({ ...CLEAN_ENVELOPE, reply: '' })

    expect(verdict.state).toBe('fail')
    expect(verdict.skipped).toHaveLength(0)
  })

  it('should match case-sensitively so a near miss does not read green', () => {
    const verdict = runReply({
      ...CLEAN_ENVELOPE,
      reply: 'Missing .CLAUDE/CONTEXT/DEVELOPMENT.MD',
    })

    expect(verdict.state).toBe('fail')
  })
})

describe('resolveVerdict', () => {
  it('should report unchecked when no declaration exists', () => {
    const verdict = resolveVerdict(join(sandbox, 'expect.toml'), checkInput())

    expect(verdict.state).toBe('unchecked')
    expect(verdict.asserted).toBe(0)
  })

  it('should fail a declaration that carries only prose', () => {
    const file = join(sandbox, 'expect.toml')
    writeFileSync(file, 'manual = ["someone should read this"]\n')

    const verdict = resolveVerdict(file, checkInput())

    expect(verdict.state).toBe('fail')
    expect(verdict.unchecked).toBe(1)
  })

  it('should fail an empty declaration', () => {
    const file = join(sandbox, 'expect.toml')
    writeFileSync(file, '')

    expect(resolveVerdict(file, checkInput()).state).toBe('fail')
  })

  it('should fail a declaration that does not parse rather than throwing', () => {
    const file = join(sandbox, 'expect.toml')
    writeFileSync(file, 'paths = [unquoted\n')

    const verdict = resolveVerdict(file, checkInput())

    expect(verdict.state).toBe('fail')
    expect(verdict.results[0]?.message).toContain('does not parse')
  })

  it('should check a declaration carrying one mechanical assertion', () => {
    seedCorrectTree()
    const file = join(sandbox, 'expect.toml')
    writeFileSync(file, `absent = ["${PLANS_LIVE}"]\n`)

    expect(resolveVerdict(file, checkInput()).state).toBe('pass')
  })
})

describe('countMechanicalAssertions', () => {
  it('should exclude manual lines from the count', () => {
    const expectation = parseExpectation('manual = ["a", "b"]\n')

    expect(countMechanicalAssertions(expectation)).toBe(0)
  })

  it('should count each assertion kind', () => {
    const expectation = parseExpectation(
      'paths = ["a"]\nabsent = ["b"]\nwrite_scope = ["c/**"]\nreply = ["f"]\n\n[[content]]\npath = "d"\npattern = "e"\n',
    )

    expect(countMechanicalAssertions(expectation)).toBe(5)
  })

  it('should count a declared escape scope once regardless of its length', () => {
    const empty = parseExpectation('escape_scope = []\n')
    const populated = parseExpectation('escape_scope = ["a/**", "b/**"]\n')

    expect(countMechanicalAssertions(empty)).toBe(1)
    expect(countMechanicalAssertions(populated)).toBe(1)
  })
})

describe('parseExpectation', () => {
  it('should read a regex from a TOML literal string unescaped', () => {
    const expectation = parseExpectation(
      "[[content]]\npath = 'x.md'\npattern = '^- \\[x\\] done'\n",
    )

    expect(expectation.content[0]?.pattern).toBe('^- \\[x\\] done')
  })

  it('should drop a content entry missing its pattern', () => {
    const expectation = parseExpectation('[[content]]\npath = "x.md"\n')

    expect(expectation.content).toEqual([])
  })

  it('should reject a top-level key written below a content block', () => {
    expect(() =>
      parseExpectation(
        '[[content]]\npath = "x.md"\npattern = "y"\nmanual = ["z"]\n',
      ),
    ).toThrow('Move top-level keys above the first [[content]] block')
  })

  it('should default every key on an empty declaration', () => {
    const expectation = parseExpectation('')

    expect(expectation).toEqual({
      paths: [],
      absent: [],
      content: [],
      writeScope: [],
      escapeScope: undefined,
      reply: [],
      manual: [],
      maxTurns: undefined,
    })
  })

  it('should distinguish an absent escape scope from a declared empty one', () => {
    expect(parseExpectation('').escapeScope).toBeUndefined()
    expect(parseExpectation('escape_scope = []\n').escapeScope).toEqual([])
  })
})

describe('verdictExitCode', () => {
  it('should exit zero on an unchecked arm so a rollout stays usable', () => {
    expect(verdictExitCode('unchecked')).toBe(0)
  })

  it('should exit non-zero only on a failure', () => {
    expect(verdictExitCode('fail')).toBe(1)
    expect(verdictExitCode('pass')).toBe(0)
  })

  it('should exit non-zero on an unchecked arm under strict', () => {
    expect(verdictExitCode('unchecked', true)).toBe(1)
  })

  it('should leave a pass passing under strict', () => {
    expect(verdictExitCode('pass', true)).toBe(0)
    expect(verdictExitCode('fail', true)).toBe(1)
  })
})

describe('parseTarget', () => {
  it('should split a category and command', () => {
    expect(parseTarget('claude:docs')).toEqual({
      category: 'claude',
      command: 'docs',
    })
  })

  it('should reject a target with no separator', () => {
    expect(parseTarget('docs-fold')).toBeUndefined()
  })

  it('should reject a target with an empty half', () => {
    expect(parseTarget('claude:')).toBeUndefined()
    expect(parseTarget(':docs')).toBeUndefined()
  })

  it('should reject a target carrying more than one separator', () => {
    expect(parseTarget('claude:docs:drift')).toBeUndefined()
  })
})

describe('expectFilePath', () => {
  it('should resolve beside the numbered stage directories of the arm', () => {
    expect(expectFilePath('/root', 'claude', 'docs', 'drift')).toBe(
      '/root/scripts/sandbox/fixtures/claude/docs/drift/expect.toml',
    )
  })
})
