import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Three states rather than two. An arm with no declaration is `unchecked`: it
 * cannot pass, since nothing was asserted, and it does not fail, since failing
 * every undeclared arm would make the harness unusable while expectations roll
 * out. `canon sandbox coverage` is what keeps the count from hiding.
 */
export type VerdictState = 'pass' | 'fail' | 'unchecked'

export interface ContentAssertion {
  readonly path: string
  readonly pattern: string
}

export interface Expectation {
  readonly paths: readonly string[]
  readonly absent: readonly string[]
  readonly content: readonly ContentAssertion[]
  readonly writeScope: readonly string[]
  /**
   * Undefined means the arm makes no claim about escapes, which is every arm
   * today. Present, even as `[]`, means the arm asserts a bound: the empty
   * form declares that a correct run produces none, so `stringArray`'s
   * collapse of "absent" and "empty" into one `[]` would erase that claim.
   */
  readonly escapeScope?: readonly string[]
  readonly reply: readonly string[]
  readonly manual: readonly string[]
  readonly maxTurns?: number
}

export interface AssertionResult {
  readonly ok: boolean
  readonly message: string
}

/**
 * `reply` is optional because an absent reply and an empty one mean different
 * things. A run whose envelope was never supplied has nothing to assert against
 * and skips. A run that genuinely returned no text carries the empty string and
 * fails every reply assertion, which is the finding.
 */
export interface RunEnvelope {
  readonly isError: boolean
  readonly turns: number
  readonly denials: number
  readonly reply?: string
}

export interface Verdict {
  readonly state: VerdictState
  readonly asserted: number
  readonly failed: number
  readonly unchecked: number
  readonly results: readonly AssertionResult[]
  readonly manual: readonly string[]
  readonly skipped: readonly string[]
  readonly note?: string
}

/**
 * `writes`, `escapes`, and `envelope` are absent when the caller supplied no
 * data for them, which is not the same as a run that wrote nothing, escaped
 * nowhere, or reported nothing. The assertion kinds that depend on them report
 * as skipped rather than silently dropping out of the count, so the cheap
 * standalone path cannot claim more coverage than it had.
 */
export interface CheckInput {
  readonly sandboxDir: string
  readonly writes?: readonly string[]
  readonly escapes?: readonly string[]
  /**
   * Whether any watched escape root held one of the four directories this run.
   * Undefined when the caller supplied no escapes at all, which already skips.
   * False is what separates a watch that ran and found nothing from one with
   * nothing to watch, both of which produce the same empty `escapes` list.
   */
  readonly escapesWatched?: boolean
  /**
   * Names of sessions the client's own registry carried both before and after
   * the run, so present rather than dispatched by it. Undefined when the
   * caller supplied none, which is not the same as a run that had no witness:
   * the registry carries no contract, so a client that stops writing a record
   * per session makes this list empty regardless of who else was live.
   */
  readonly concurrentSessions?: readonly string[]
  readonly envelope?: RunEnvelope
}

interface KindOutcome {
  readonly results: AssertionResult[]
  readonly skipped: string[]
}

const EXIT_CODE: Record<VerdictState, number> = {
  pass: 0,
  fail: 1,
  unchecked: 0,
}

/**
 * `unchecked` exits zero so an undeclared arm does not break a gate while
 * expectations roll out. Pass `strict` to make it exit one, which is how a
 * caller that has finished arming its scenarios keeps them armed.
 */
export function verdictExitCode(state: VerdictState, strict = false): number {
  if (strict && state === 'unchecked') return 1

  return EXIT_CODE[state]
}

export interface ScenarioTarget {
  readonly category: string
  readonly command: string
}

/**
 * Splits `<category>:<command>`. Returns undefined rather than a partial target,
 * so a typo cannot resolve to a declaration path that happens not to exist and
 * report `unchecked` on what is really a caller error.
 */
export function parseTarget(target: string): ScenarioTarget | undefined {
  const [category, command, ...rest] = target.split(':')
  if (rest.length > 0) return undefined
  if (category === undefined || category === '') return undefined
  if (command === undefined || command === '') return undefined

  return { category, command }
}

export function expectFilePath(
  root: string,
  category: string,
  command: string,
  arm: string,
): string {
  return join(
    root,
    'scripts',
    'sandbox',
    'fixtures',
    category,
    command,
    arm,
    'expect.toml',
  )
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry !== '',
  )
}

function contentArray(value: unknown): ContentAssertion[] {
  if (!Array.isArray(value)) return []

  const assertions: ContentAssertion[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue

    const record = entry as Record<string, unknown>

    // Dropping a half-written entry rather than throwing is deliberate, and it
    // reads as the opposite of the stray-key check below. An entry missing its
    // path or pattern declares no assertion to lose, and `checkExpectation`
    // fails an arm whose surviving declaration asserts nothing, so the vacuous
    // pass is already closed one level up. A stray key is the reverse: the entry
    // is well-formed and the declaration around it silently lost a key it
    // appears to carry, which nothing downstream can see.
    if (typeof record.path !== 'string' || record.path === '') continue
    if (typeof record.pattern !== 'string' || record.pattern === '') continue

    // A bare key written below a `[[content]]` header belongs to that table in
    // TOML, not to the document, so a declaration listing `manual` or
    // `max_turns` after its content blocks parses clean and silently asserts
    // neither. The `claude/ui-checklist` arm shipped that way: a turn ceiling that
    // never ran and five manual entries that never reached the unchecked count,
    // while `canon sandbox coverage` counted the arm as armed. Nothing at the
    // top level can see the difference, so the check belongs here.
    const stray = Object.keys(record).filter(
      (key) => key !== 'path' && key !== 'pattern',
    )
    if (stray.length > 0) {
      throw new Error(
        `content entry for ${record.path} carries ${stray.join(', ')}. Move top-level keys above the first [[content]] block.`,
      )
    }

    assertions.push({ path: record.path, pattern: record.pattern })
  }

  return assertions
}

/**
 * Throws on malformed TOML. `resolveVerdict` turns that into a failed verdict, so
 * a typo in a declaration reads the same way a pattern that does not compile
 * does, rather than surfacing as a stack trace.
 */
export function parseExpectation(source: string): Expectation {
  const parsed = Bun.TOML.parse(source) as Record<string, unknown>

  return {
    paths: stringArray(parsed.paths),
    absent: stringArray(parsed.absent),
    content: contentArray(parsed.content),
    writeScope: stringArray(parsed.write_scope),
    escapeScope:
      parsed.escape_scope === undefined
        ? undefined
        : stringArray(parsed.escape_scope),
    reply: stringArray(parsed.reply),
    manual: stringArray(parsed.manual),
    maxTurns:
      typeof parsed.max_turns === 'number' ? parsed.max_turns : undefined,
  }
}

/**
 * `manual` is deliberately excluded. Counting it would let an arm declare five
 * prose lines, assert nothing, and still read green, which is the vacuous case
 * `scripts/core/install-check.sh` warns about in its own comment.
 */
export function countMechanicalAssertions(expectation: Expectation): number {
  return (
    expectation.paths.length +
    expectation.absent.length +
    expectation.content.length +
    expectation.writeScope.length +
    (expectation.escapeScope === undefined ? 0 : 1) +
    expectation.reply.length
  )
}

/**
 * An entry carrying `*` is matched as a glob, so an arm can assert a file whose
 * name a run derives. Reports the matched path rather than the pattern, since a
 * pass on `lessons/0001-*.html` says nothing until the name it found is named.
 */
function checkPaths(
  expectation: Expectation,
  sandboxDir: string,
): AssertionResult[] {
  return expectation.paths.map((path) => {
    const written = writtenUnder(path, sandboxDir)

    return written
      ? { ok: true, message: `exists: ${written}` }
      : { ok: false, message: `missing: ${path}` }
  })
}

/**
 * The first file an entry matches, or undefined when it matches none. An entry
 * carrying `*` is matched as a glob, which is what lets an arm name a file whose
 * name a run derives rather than fixes. Pinning one spelling of a derived name
 * passes vacuously against every other spelling, which reads as coverage the arm
 * does not have.
 *
 * Returning the match rather than a boolean is what lets a result name the file
 * the run wrote instead of the pattern that found it. A glob matching several
 * files answers with one of them in no fixed order, so an arm asserting content
 * through a glob seeds a folder holding one.
 */
function writtenUnder(pattern: string, sandboxDir: string): string | undefined {
  if (!pattern.includes('*')) {
    return existsSync(join(sandboxDir, pattern)) ? pattern : undefined
  }

  for (const match of new Bun.Glob(pattern).scanSync({
    cwd: sandboxDir,
    dot: true,
  })) {
    return match
  }

  return undefined
}

function checkAbsent(
  expectation: Expectation,
  sandboxDir: string,
): AssertionResult[] {
  return expectation.absent.map((path) => {
    const written = writtenUnder(path, sandboxDir)

    return written
      ? { ok: false, message: `should not exist: ${written}` }
      : { ok: true, message: `absent: ${path}` }
  })
}

/**
 * A pattern against a missing file reports as a content miss rather than
 * throwing, since an arm may assert content without also listing the path. A
 * pattern that does not compile is a defect in the declaration, so it fails the
 * assertion it belongs to rather than aborting the whole verdict.
 *
 * A path carrying `*` resolves to the file it matched, and falls back to itself
 * when it matched none so the miss is reported against the entry as written.
 */
function checkContent(
  expectation: Expectation,
  sandboxDir: string,
): AssertionResult[] {
  return expectation.content.map(({ path, pattern }) => {
    const matched = writtenUnder(path, sandboxDir) ?? path
    const full = join(sandboxDir, matched)
    const label = `${matched} =~ ${pattern}`

    let matcher: RegExp
    try {
      matcher = new RegExp(pattern, 'm')
    } catch {
      return { ok: false, message: `invalid pattern for ${path}: ${pattern}` }
    }

    if (!existsSync(full) || !statSync(full).isFile()) {
      return { ok: false, message: `no file to match: ${path}` }
    }

    if (matcher.test(readFileSync(full, 'utf8'))) {
      return { ok: true, message: `matches: ${label}` }
    }

    return { ok: false, message: `no match: ${label}` }
  })
}

/**
 * The probe on 2026-07-30 found no permission mode that both allows writes under
 * `.claude/` and scopes them, so the run goes wide and this assertion carries the
 * property the permission layer used to. An arm declaring no scope skips it.
 */
function checkWriteScope(
  expectation: Expectation,
  writes: readonly string[] | undefined,
): KindOutcome {
  if (expectation.writeScope.length === 0) return { results: [], skipped: [] }

  if (writes === undefined) {
    return {
      results: [],
      skipped: ['write scope: no write data supplied, pass --writes'],
    }
  }

  // A scope produces one result per write, so a run that wrote nothing produces
  // none, and without this the declaration vanishes from the verdict entirely:
  // no result, no skipped entry, and no contribution to the unchecked count that
  // exists to surface exactly this. The `undefined` branch above cannot stand in,
  // since `run.sh` always passes `--writes` and `readPathList` returns `[]` for an
  // empty file. An arm whose output escaped the snapshot reads as a clean run,
  // which is the vacuous pass the harness exists to remove.
  if (writes.length === 0) {
    return {
      results: [],
      skipped: ['write scope: the run wrote nothing, so no path was checked'],
    }
  }

  const globs = expectation.writeScope.map((glob) => new Bun.Glob(glob))

  return {
    results: writes.map((path) =>
      globs.some((glob) => glob.match(path))
        ? { ok: true, message: `in scope: ${path}` }
        : { ok: false, message: `wrote outside declared scope: ${path}` },
    ),
    skipped: [],
  }
}

/**
 * `run.sh` watches two toolkit roots for a write to shared session scratch
 * during a run, and reports every one it finds as an unattributed escape with
 * no arm able to fail on it. An arm whose skill legitimately reaches outside
 * the sandbox tree declares the destinations here, and the harness asserts
 * them instead of trusting the skill to bound itself.
 *
 * Declaring the scope inverts the empty case against `checkWriteScope`. A
 * write-scope declaration exists to bound required output, so a run that wrote
 * nothing skips rather than passing on a fabricated zero. An escape-scope
 * declaration exists to bound a side effect nothing requires, so zero escapes
 * is the outcome a correct run produces and reports as a pass outright,
 * provided a watched root held something to watch. `run.sh`'s `snapshot_root`
 * returns an empty manifest both when a watch ran clean and when none of the
 * four watched directories existed under a root, and the two produce the same
 * empty `escapes` list. `watched` is what tells them apart: a run that had
 * nothing to watch reports unmeasured rather than passing on a diff it never
 * had the target to take.
 *
 * A witnessed concurrent session never softens the verdict. `concurrentSessions`
 * is evidence a reader can act on without a second lookup, appended to the
 * message on an unbounded escape, never a reason to pass or skip one: a session
 * merely alive throughout the run proves someone else was busy, not that a
 * given file is theirs, and a real dispatch escape reads identically to an
 * innocent sibling's write either way.
 */
function checkEscapeScope(
  expectation: Expectation,
  escapes: readonly string[] | undefined,
  watched: boolean | undefined,
  concurrentSessions: readonly string[] | undefined,
): KindOutcome {
  if (expectation.escapeScope === undefined) return { results: [], skipped: [] }

  if (escapes === undefined) {
    return {
      results: [],
      skipped: ['escape scope: no escape data supplied, pass --escapes'],
    }
  }

  if (escapes.length === 0) {
    if (watched === false) {
      return {
        results: [],
        skipped: ['escape scope: no watched root held a target, unmeasured'],
      }
    }

    return {
      results: [{ ok: true, message: 'no escape during this run' }],
      skipped: [],
    }
  }

  const globs = expectation.escapeScope.map((glob) => new Bun.Glob(glob))
  const witnessCount = concurrentSessions?.length ?? 0
  const witnessSuffix =
    witnessCount > 0
      ? ` (${witnessCount} session${witnessCount === 1 ? '' : 's'} live throughout the run)`
      : ''

  return {
    results: escapes.map((path) =>
      globs.some((glob) => glob.match(path))
        ? { ok: true, message: `declared escape: ${path}` }
        : {
            ok: false,
            message: `unbounded escape: ${path}${witnessSuffix}`,
          },
    ),
    skipped: [],
  }
}

/**
 * Plain substrings, matched case-sensitively, against the text the run replied
 * with. A substring rather than a regex because the pattern a reply assertion
 * wants is a load-bearing token, a path or a command, and a regex invites the
 * anchored sentence that goes red on any rewording.
 *
 * Declare only positives. A negative substring passes on every reply that
 * phrases the thing differently, which is the vacuous pass
 * `countMechanicalAssertions` excludes `manual` to prevent. An entry asserting
 * what a run must not have said stays in `manual` with its reason.
 */
function checkReply(
  expectation: Expectation,
  envelope: RunEnvelope | undefined,
): KindOutcome {
  if (expectation.reply.length === 0) return { results: [], skipped: [] }

  if (envelope?.reply === undefined) {
    return {
      results: [],
      skipped: ['reply: no reply text supplied, pass --envelope'],
    }
  }

  const reply = envelope.reply

  return {
    results: expectation.reply.map((fragment) =>
      reply.includes(fragment)
        ? { ok: true, message: `reply says: ${fragment}` }
        : { ok: false, message: `reply never says: ${fragment}` },
    ),
    skipped: [],
  }
}

/**
 * The envelope never determines a pass. It can only fail a run the expectations
 * would otherwise have passed. Under `bypassPermissions` the denial count is
 * always zero, so the write-scope assertion is what replaced it.
 */
function checkEnvelope(
  expectation: Expectation,
  envelope: RunEnvelope | undefined,
): KindOutcome {
  if (envelope === undefined) {
    const skipped =
      expectation.maxTurns === undefined
        ? []
        : ['turn ceiling: no envelope supplied, pass --envelope']

    return { results: [], skipped }
  }

  const results: AssertionResult[] = []

  if (envelope.isError) {
    results.push({ ok: false, message: 'envelope: is_error true' })
  }
  if (envelope.denials > 0) {
    results.push({
      ok: false,
      message: `envelope: ${envelope.denials} permission denials`,
    })
  }
  if (
    expectation.maxTurns !== undefined &&
    envelope.turns > expectation.maxTurns
  ) {
    results.push({
      ok: false,
      message: `envelope: ${envelope.turns} turns over ceiling of ${expectation.maxTurns}`,
    })
  }

  return { results, skipped: [] }
}

export function checkExpectation(
  expectation: Expectation,
  input: CheckInput,
): Verdict {
  const scope = checkWriteScope(expectation, input.writes)
  const escapeScope = checkEscapeScope(
    expectation,
    input.escapes,
    input.escapesWatched,
    input.concurrentSessions,
  )
  const reply = checkReply(expectation, input.envelope)
  const envelope = checkEnvelope(expectation, input.envelope)

  const results = [
    ...checkPaths(expectation, input.sandboxDir),
    ...checkAbsent(expectation, input.sandboxDir),
    ...checkContent(expectation, input.sandboxDir),
    ...reply.results,
    ...scope.results,
    ...escapeScope.results,
    ...envelope.results,
  ]
  const skipped = [
    ...scope.skipped,
    ...escapeScope.skipped,
    ...reply.skipped,
    ...envelope.skipped,
  ]

  const failed = results.filter((result) => !result.ok).length

  // A declaration counts what it declares, this counts what ran, and the two
  // diverge on `write_scope`, which produces one result per write rather than one
  // per glob. An arm declaring only a write scope against a run that wrote
  // nothing would otherwise report pass having asserted nothing, which is the
  // vacuous pass the whole feature exists to remove.
  if (results.length === 0) {
    return {
      state: 'fail',
      asserted: 0,
      failed: 1,
      unchecked: expectation.manual.length + skipped.length,
      results: [
        { ok: false, message: 'no assertion ran against this sandbox' },
        ...results,
      ],
      manual: expectation.manual,
      skipped,
      note: 'The declaration asserts something, but nothing was checkable here. A pass with zero assertions is not a pass.',
    }
  }

  return {
    state: failed > 0 ? 'fail' : 'pass',
    asserted: results.length,
    failed,
    unchecked: expectation.manual.length + skipped.length,
    results,
    manual: expectation.manual,
    skipped,
  }
}

/**
 * A missing declaration and an empty one are different verdicts. Absence is the
 * rollout state for most arms. A declaration that exists and asserts nothing is
 * silent truncation, and it goes red.
 */
export function resolveVerdict(expectFile: string, input: CheckInput): Verdict {
  if (!existsSync(expectFile)) {
    return {
      state: 'unchecked',
      asserted: 0,
      failed: 0,
      unchecked: 0,
      results: [],
      manual: [],
      skipped: [],
      note: `No expect.toml at ${expectFile}. Nothing was asserted.`,
    }
  }

  let expectation: Expectation
  try {
    expectation = parseExpectation(readFileSync(expectFile, 'utf8'))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    return {
      state: 'fail',
      asserted: 0,
      failed: 1,
      unchecked: 0,
      results: [
        { ok: false, message: `expect.toml does not parse: ${reason}` },
      ],
      manual: [],
      skipped: [],
      note: `Fix the declaration at ${expectFile}.`,
    }
  }

  if (countMechanicalAssertions(expectation) === 0) {
    return {
      state: 'fail',
      asserted: 0,
      failed: 1,
      unchecked: expectation.manual.length,
      results: [
        {
          ok: false,
          message: `expect.toml declares no mechanical assertion: ${expectFile}`,
        },
      ],
      manual: expectation.manual,
      skipped: [],
      note: 'An expectation file that asserts nothing passes every run. Declare one or delete the file.',
    }
  }

  return checkExpectation(expectation, input)
}
