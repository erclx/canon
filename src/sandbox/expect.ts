import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { HISTORY_PATTERNS } from '@/comments/scan'

/**
 * Three states rather than two. An arm with no declaration is `unchecked`: it
 * cannot pass and does not fail, or every undeclared arm would break the harness
 * while expectations roll out. `canon sandbox coverage` keeps the count honest.
 */
export type VerdictState = 'pass' | 'fail' | 'unchecked'

export interface ContentAssertion {
  readonly path: string
  readonly pattern: string
  readonly why?: string
}

/** The reason each entry of a string array carries, keyed by the entry's text. */
export type Whys = Readonly<Record<string, string>>

export interface ExpectationWhys {
  readonly paths: Whys
  readonly absent: Whys
  readonly writeScope: Whys
  readonly escapeScope: Whys
  readonly reply: Whys
}

export interface Expectation {
  /** What the arm proves, printed above its results. */
  readonly purpose?: string
  /** Absent on a hand-built expectation, which reads as no reasons. */
  readonly whys?: ExpectationWhys
  readonly paths: readonly string[]
  readonly absent: readonly string[]
  readonly content: readonly ContentAssertion[]
  readonly writeScope: readonly string[]
  /**
   * Undefined means the arm makes no claim about escapes. Present, even as `[]`,
   * asserts a bound, which `stringArray`'s collapse of absent and empty into one
   * `[]` would erase.
   */
  readonly escapeScope?: readonly string[]
  readonly reply: readonly string[]
  readonly manual: readonly string[]
  readonly maxTurns?: number
}

export interface AssertionResult {
  readonly ok: boolean
  readonly message: string
  readonly why?: string
}

/**
 * `reply` is optional because absent and empty differ: a run with no envelope
 * has nothing to assert against and skips, while one returning no text carries
 * the empty string and fails every reply assertion.
 */
export interface RunEnvelope {
  readonly isError: boolean
  /** The runner cap ended the run, read from `subtype` rather than `turns`. */
  readonly isTruncated: boolean
  readonly turns: number
  /**
   * The cap the run ran under. `num_turns` counts more than the cap does, so
   * an untruncated run can report past it, and a ceiling at or above the cap
   * is held by `isTruncated` instead. A non-finite value reads as absent.
   */
  readonly turnCap?: number
  readonly denials: number
  readonly reply?: string
}

export interface Verdict {
  readonly state: VerdictState
  readonly purpose?: string
  /** Mechanical assertions declared with no `why`. Counted, never gating. */
  readonly whyless?: number
  readonly asserted: number
  readonly failed: number
  readonly unchecked: number
  readonly results: readonly AssertionResult[]
  readonly manual: readonly string[]
  readonly skipped: readonly string[]
  readonly note?: string
}

/**
 * `writes`, `escapes`, and `envelope` are absent when the caller supplied no data,
 * which differs from a run that wrote nothing. The assertion kinds that depend
 * on them report as skipped, so the standalone path cannot claim more coverage than it had.
 */
export interface CheckInput {
  readonly sandboxDir: string
  readonly writes?: readonly string[]
  readonly escapes?: readonly string[]
  /**
   * Whether any watched escape root held one of the four directories this run.
   * False separates a watch that found nothing from one with nothing to watch,
   * both of which produce an empty `escapes` list.
   */
  readonly escapesWatched?: boolean
  /**
   * Names of sessions the client's registry carried before and after the run.
   * Undefined when none was supplied. The registry carries no contract, so a
   * client that stops writing per-session records makes this list empty.
   */
  readonly concurrentSessions?: readonly string[]
  /**
   * Watched writes no tool call of the session names, split off `escapes` by
   * `attributeEscapes`. Undefined when the caller did not split, which asserts
   * every path in `escapes` as before.
   */
  readonly untiedEscapes?: readonly string[]
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

/**
 * Rejects change history in a reason, since a `why` that cites a date, hash, or
 * issue goes stale the way the comments `HISTORY_PATTERNS` guards do.
 */
function guardHistory(field: string, text: string): void {
  for (const { term, pattern } of HISTORY_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `${field} carries a ${term}: ${text}. Put history in the pull request.`,
      )
    }
  }
}

function readWhy(field: string, value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${field} must be a non-empty string`)
  }
  guardHistory(field, value)

  return value
}

interface ReadEntries {
  readonly values: string[]
  readonly whys: Record<string, string>
}

/**
 * An entry is a bare string or an inline table holding `valueKey` and an
 * optional `why`. A table missing its value throws, since dropping it would
 * assert nothing and report green.
 */
function entryArray(
  key: string,
  valueKey: string,
  value: unknown,
): ReadEntries {
  const read: ReadEntries = { values: [], whys: {} }
  if (!Array.isArray(value)) return read

  for (const entry of value) {
    if (typeof entry === 'string') {
      if (entry !== '') read.values.push(entry)
      continue
    }
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      continue
    }

    const record = entry as Record<string, unknown>
    const text = record[valueKey]
    if (typeof text !== 'string' || text === '') {
      throw new Error(
        `${key} entry has no ${valueKey}. Write ${valueKey} = "...".`,
      )
    }

    const stray = Object.keys(record).filter(
      (name) => name !== valueKey && name !== 'why',
    )
    if (stray.length > 0) {
      throw new Error(`${key} entry for ${text} carries ${stray.join(', ')}.`)
    }

    read.values.push(text)
    const why = readWhy(`${key} why for ${text}`, record.why)
    if (why !== undefined) read.whys[text] = why
  }

  return read
}

function contentArray(value: unknown): ContentAssertion[] {
  if (!Array.isArray(value)) return []

  const assertions: ContentAssertion[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue

    const record = entry as Record<string, unknown>

    // A half-written entry is dropped, since it declares nothing to lose.
    if (typeof record.path !== 'string' || record.path === '') continue
    if (typeof record.pattern !== 'string' || record.pattern === '') continue

    // In TOML a bare key below a `[[content]]` header joins that table, so a misplaced `manual` would assert nothing.
    const stray = Object.keys(record).filter(
      (key) => key !== 'path' && key !== 'pattern' && key !== 'why',
    )
    if (stray.length > 0) {
      throw new Error(
        `content entry for ${record.path} carries ${stray.join(', ')}. Move top-level keys above the first [[content]] block.`,
      )
    }

    const why = readWhy(`content why for ${record.path}`, record.why)
    assertions.push({
      path: record.path,
      pattern: record.pattern,
      ...(why === undefined ? {} : { why }),
    })
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
  const paths = entryArray('paths', 'path', parsed.paths)
  const absent = entryArray('absent', 'path', parsed.absent)
  const writeScope = entryArray('write_scope', 'path', parsed.write_scope)
  const escapeScope = entryArray('escape_scope', 'path', parsed.escape_scope)
  const reply = entryArray('reply', 'text', parsed.reply)

  return {
    purpose: readWhy('purpose', parsed.purpose),
    whys: {
      paths: paths.whys,
      absent: absent.whys,
      writeScope: writeScope.whys,
      escapeScope: escapeScope.whys,
      reply: reply.whys,
    },
    paths: paths.values,
    absent: absent.values,
    content: contentArray(parsed.content),
    writeScope: writeScope.values,
    escapeScope:
      parsed.escape_scope === undefined ? undefined : escapeScope.values,
    reply: reply.values,
    manual: stringArray(parsed.manual),
    maxTurns:
      typeof parsed.max_turns === 'number' ? parsed.max_turns : undefined,
  }
}

/**
 * `manual` is deliberately excluded. Counting it would let an arm declare five
 * prose lines, assert nothing, and still read green, which is the vacuous case
 * `scripts/core/install-check.ts` warns about in its own comment.
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
 * Counts the mechanical assertions declared with no `why`, which the check
 * reports so the migration can be drained without gating on it.
 */
export function countWhyless(expectation: Expectation): number {
  const whys = expectation.whys
  const bare = (entries: readonly string[], known: Whys | undefined): number =>
    entries.filter((entry) => known?.[entry] === undefined).length

  return (
    bare(expectation.paths, whys?.paths) +
    bare(expectation.absent, whys?.absent) +
    bare(expectation.writeScope, whys?.writeScope) +
    bare(expectation.escapeScope ?? [], whys?.escapeScope) +
    bare(expectation.reply, whys?.reply) +
    expectation.content.filter((entry) => entry.why === undefined).length
  )
}

/** A scope's results are per write, so a failure carries every declared glob's reason. */
function scopeWhy(
  globs: readonly string[],
  whys: Whys | undefined,
): string | undefined {
  const reasons = [...new Set(globs.flatMap((glob) => whys?.[glob] ?? []))]

  return reasons.length === 0 ? undefined : reasons.join('; ')
}

function withWhy(
  result: AssertionResult,
  why: string | undefined,
): AssertionResult {
  return why === undefined ? result : { ...result, why }
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

    return withWhy(
      written
        ? { ok: true, message: `exists: ${written}` }
        : { ok: false, message: `missing: ${path}` },
      expectation.whys?.paths[path],
    )
  })
}

/**
 * The first file an entry matches, or undefined. An entry carrying `*` is a glob,
 * so an arm can name a file whose name a run derives. A glob matching several
 * files answers with one in no fixed order, so such an arm seeds a folder holding one.
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

    return withWhy(
      written
        ? { ok: false, message: `should not exist: ${written}` }
        : { ok: true, message: `absent: ${path}` },
      expectation.whys?.absent[path],
    )
  })
}

/**
 * A pattern against a missing file reports as a content miss rather than
 * throwing, and a pattern that does not compile fails its own assertion rather
 * than aborting the verdict. A `*` path falls back to itself when it matched none.
 */
function checkContent(
  expectation: Expectation,
  sandboxDir: string,
): AssertionResult[] {
  return expectation.content.map(({ path, pattern, why }) =>
    withWhy(matchContent(path, pattern, sandboxDir), why),
  )
}

function matchContent(
  path: string,
  pattern: string,
  sandboxDir: string,
): AssertionResult {
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
}

/**
 * No permission mode both allows writes under `.claude/` and scopes them, so
 * the run goes wide and this assertion carries the property the permission
 * layer would. An arm declaring no scope skips it.
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

  // A run that wrote nothing is reported as skipped, or the declaration would vanish as a vacuous pass.
  if (writes.length === 0) {
    return {
      results: [],
      skipped: ['write scope: the run wrote nothing, so no path was checked'],
    }
  }

  const globs = expectation.writeScope.map((glob) => new Bun.Glob(glob))
  const why = scopeWhy(expectation.writeScope, expectation.whys?.writeScope)

  return {
    results: writes.map((path) =>
      globs.some((glob) => glob.match(path))
        ? { ok: true, message: `in scope: ${path}` }
        : withWhy(
            { ok: false, message: `wrote outside declared scope: ${path}` },
            why,
          ),
    ),
    skipped: [],
  }
}

/**
 * Asserts the writes `canon sandbox run` saw land in shared session scratch at a
 * toolkit root, split by `attributeEscapes` into `escapes` and `untiedEscapes`.
 * Zero escapes passes only when `watched` says a root held something. A concurrent session is evidence, never softening the verdict.
 */
function checkEscapeScope(
  expectation: Expectation,
  escapes: readonly string[] | undefined,
  watched: boolean | undefined,
  concurrentSessions: readonly string[] | undefined,
  untiedEscapes: readonly string[] | undefined,
): KindOutcome {
  const outcome = checkTiedEscapes(
    expectation,
    escapes,
    watched,
    concurrentSessions,
  )
  const untiedCount = untiedEscapes?.length ?? 0
  if (expectation.escapeScope === undefined || escapes === undefined)
    return outcome
  if (untiedCount === 0) return outcome

  return {
    results: outcome.results,
    skipped: [
      ...outcome.skipped,
      `escape scope: ${untiedCount} write${untiedCount === 1 ? '' : 's'} under a watched root no call of this session names, not asserted`,
    ],
  }
}

function checkTiedEscapes(
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
  const why = scopeWhy(expectation.escapeScope, expectation.whys?.escapeScope)
  const witnessCount = concurrentSessions?.length ?? 0
  const witnessSuffix =
    witnessCount > 0
      ? ` (${witnessCount} session${witnessCount === 1 ? '' : 's'} live throughout the run)`
      : ''

  return {
    results: escapes.map((path) =>
      globs.some((glob) => glob.match(path))
        ? { ok: true, message: `declared escape: ${path}` }
        : withWhy(
            {
              ok: false,
              message: `unbounded escape: ${path}${witnessSuffix}`,
            },
            why,
          ),
    ),
    skipped: [],
  }
}

/**
 * Plain substrings, matched case-sensitively, against the text the run replied
 * with, since a regex invites an anchored sentence that goes red on rewording.
 * Declare only positives, since a negative passes on any rephrasing. A negative stays in `manual`.
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
      withWhy(
        reply.includes(fragment)
          ? { ok: true, message: `reply says: ${fragment}` }
          : { ok: false, message: `reply never says: ${fragment}` },
        expectation.whys?.reply[fragment],
      ),
    ),
    skipped: [],
  }
}

function isFiniteCap(turnCap: number | undefined): turnCap is number {
  return turnCap !== undefined && Number.isFinite(turnCap)
}

function capped(turnCap: number | undefined): string {
  return isFiniteCap(turnCap) ? ` of ${turnCap} turns` : ''
}

/**
 * A ceiling below the cap was declared in `num_turns` and is compared in it. One
 * at or above the cap skips with no result, since emitting a pass would let the
 * envelope pass a run.
 */
function isBelowCap(maxTurns: number, turnCap: number | undefined): boolean {
  return !isFiniteCap(turnCap) || maxTurns < turnCap
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
  if (envelope.isTruncated) {
    results.push({
      ok: false,
      message: `envelope: truncated by the runner cap${capped(envelope.turnCap)}`,
    })
  }
  if (
    expectation.maxTurns !== undefined &&
    isBelowCap(expectation.maxTurns, envelope.turnCap) &&
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
    input.untiedEscapes,
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

  // A write scope yields one result per write, so a run that wrote nothing fails rather than passing vacuously.
  if (results.length === 0) {
    return {
      state: 'fail',
      purpose: expectation.purpose,
      whyless: countWhyless(expectation),
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
    purpose: expectation.purpose,
    whyless: countWhyless(expectation),
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
