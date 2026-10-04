import { execaSync } from 'execa'
import { baseCandidates, isMergeBase } from '@/git/base'
import { gitEnv } from '@/git/env'

/**
 * The extensions this check can pair. A test sits beside its subject under one
 * name throughout this corpus, so the weakest assumption available is also the
 * one the corpus already honors. Every other extension is read past and named,
 * since a bash script and its test are related by nothing a filename carries.
 */
export const SOURCE_EXTENSIONS = ['.ts', '.tsx'] as const

/** The suffix removed to derive the subject a test covers. */
export const TEST_SUFFIXES = ['.test.ts', '.test.tsx'] as const

/** A `%H` line, which is 40 hex characters under sha1 and 64 under sha256. */
const COMMIT = /^[0-9a-f]{40,64}$/

/** A `--name-status` line: a status letter, a tab, then one path. */
const NAME_STATUS = /^([A-Z])\d*\t(.+)$/

export type Verdict = 'satisfied' | 'implementation-first' | 'unclassified'

export interface PairRecord {
  /** The implementation path, which is what a subject is named by. */
  readonly subject: string
  /** The test paired to it, or `null` when the pairing found no partner. */
  readonly test: string | null
  readonly verdict: Verdict
  readonly implementationCommit: string | null
  readonly testCommit: string | null
  /** Why the verdict reads the way it does, in the report's own words. */
  readonly reason: string
}

export interface Scope {
  readonly extensions: readonly string[]
  readonly testSuffixes: readonly string[]
}

/**
 * Every reason `canon gov test-order` refuses for.
 *
 * None is an ordinary absence. A depth-1 checkout falls back to the root
 * commit and reports zero rather than reaching any of these, so what remains
 * is a repository with no commit at all or a git operation that failed
 * outright, both a broken checkout rather than a target's ordinary state.
 */
export type TestOrderRefusal =
  | 'no-history'
  | 'no-log'
  | 'no-tree'
  | 'bad-base'
  | 'no-base'

export type TestOrderReport =
  | {
      readonly kind: 'measured'
      readonly base: string
      readonly head: string
      readonly scope: Scope
      readonly satisfied: readonly PairRecord[]
      readonly findings: readonly PairRecord[]
      readonly unclassified: readonly PairRecord[]
      /** Changed paths outside the pairing's reach, named rather than counted. */
      readonly ignored: readonly string[]
    }
  | {
      readonly kind: 'unreadable'
      readonly reason: TestOrderRefusal
      readonly message: string
    }

export interface TestOrderOptions {
  /** The far side of the range, defaulting to the merge base against the trunk. */
  readonly base?: string
}

/** One path as one commit in the range touched it. */
interface Change {
  readonly path: string
  readonly status: string
  readonly commit: string
  /** Position in the range, oldest first, which is what orders a pair. */
  readonly order: number
}

/**
 * Reads `--name-status` log output, oldest commit first, into one entry per
 * path per commit.
 *
 * The order field rather than the commit is what a comparison reads, since two
 * commits carry no ordering a caller can derive from their hashes alone.
 */
function parseChanges(output: string): Change[] {
  const changes: Change[] = []
  let commit = ''
  let order = -1

  for (const line of output.split('\n')) {
    const trimmed = line.trimEnd()
    if (trimmed === '') continue

    if (COMMIT.test(trimmed)) {
      commit = trimmed
      order += 1
      continue
    }

    const match = NAME_STATUS.exec(trimmed)
    if (match === null || commit === '') continue

    changes.push({ path: match[2], status: match[1], commit, order })
  }

  return changes
}

/** Whether a path is a test this check can derive a subject from. */
function testSuffix(path: string): string | undefined {
  return TEST_SUFFIXES.find((suffix) => path.endsWith(suffix))
}

/**
 * The implementation a test covers, derived by removing the test suffix.
 *
 * A behavior split across two modules pairs wrongly or not at all under this,
 * which is what the unclassified bucket exists to catch rather than hide.
 */
function subjectOf(path: string): string {
  const suffix = testSuffix(path)
  if (suffix === undefined) return path
  return `${path.slice(0, -suffix.length)}${suffix.replace('.test', '')}`
}

/** The one test path that would cover `subject` under the beside convention. */
function testPathFor(subject: string): string {
  return subject.replace(/\.(tsx?)$/, '.test.$1')
}

/**
 * Whether a path is an implementation this check can pair. A declaration file
 * carries no behavior to test, so it is read past rather than reported as a
 * module nothing covers.
 */
function isImplementation(path: string): boolean {
  if (path.endsWith('.d.ts')) return false
  if (testSuffix(path) !== undefined) return false
  return SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension))
}

/** The first commit in the range that added `path`, or `undefined`. */
function introduction(
  changes: readonly Change[],
  path: string,
): Change | undefined {
  return changes.find((change) => change.path === path && change.status === 'A')
}

function classify(
  changes: readonly Change[],
  atBase: ReadonlySet<string>,
): {
  satisfied: PairRecord[]
  findings: PairRecord[]
  unclassified: PairRecord[]
} {
  const satisfied: PairRecord[] = []
  const findings: PairRecord[] = []
  const unclassified: PairRecord[] = []

  // Keyed by subject so a module whose implementation and test both moved is
  // one record rather than two, and so a test with no partner still reports
  // under the implementation path a reader would go looking for.
  const subjects = new Set<string>()
  for (const change of changes) {
    if (isImplementation(change.path)) subjects.add(change.path)
    else if (testSuffix(change.path) !== undefined) {
      subjects.add(subjectOf(change.path))
    }
  }

  for (const subject of [...subjects].sort()) {
    const candidate = testPathFor(subject)
    const testChange = introduction(changes, candidate)
    const testAtBase = atBase.has(candidate)
    const test = testAtBase || testChange !== undefined ? candidate : undefined

    const implementation = introduction(changes, subject)

    if (implementation === undefined) {
      unclassified.push({
        subject,
        test: test ?? null,
        verdict: 'unclassified',
        implementationCommit: null,
        testCommit: null,
        reason: atBase.has(subject)
          ? 'the implementation predates the range, so a change to it cannot be separated from a refactor'
          : 'no implementation reached the range beside this test',
      })
      continue
    }

    if (test === undefined) {
      unclassified.push({
        subject,
        test: null,
        verdict: 'unclassified',
        implementationCommit: implementation.commit,
        testCommit: null,
        reason: 'no test names this module, so the ordering has no second side',
      })
      continue
    }

    // A paired test the range never added is one that already sat at the base
    // commit, since those are the only two ways `test` gets a value at all.
    if (testChange === undefined) {
      satisfied.push({
        subject,
        test,
        verdict: 'satisfied',
        implementationCommit: implementation.commit,
        testCommit: null,
        reason: 'the test predates the range',
      })
      continue
    }

    // One commit carrying both sides counts as satisfied. The rule asks that
    // the test not come after, and a single commit is the shape a small change
    // takes here, so reporting it would flag most of the corpus.
    const record: PairRecord = {
      subject,
      test,
      verdict:
        testChange.order <= implementation.order
          ? 'satisfied'
          : 'implementation-first',
      implementationCommit: implementation.commit,
      testCommit: testChange.commit,
      reason:
        testChange.order <= implementation.order
          ? 'the test reached history no later than the implementation'
          : 'the implementation reached history before the test covering it',
    }

    if (record.verdict === 'satisfied') satisfied.push(record)
    else findings.push(record)
  }

  return { satisfied, findings, unclassified }
}

/**
 * Where an implementation reached a commit ahead of the test covering it,
 * between `base` and the current `HEAD` of the tree at `root`.
 *
 * This reports and never gates. Pairing a test to an implementation is a
 * judgment, so a change the pairing cannot read lands in `unclassified` with
 * its reason stated rather than being counted as a pass. Coverage is narrower
 * than the rule the check answers to, and `scope` and `ignored` are what say so
 * on every run.
 */
export function readTestOrder(
  root: string,
  options: TestOrderOptions = {},
): TestOrderReport {
  const head = revParse(root, 'HEAD')
  if (head === undefined) {
    return {
      kind: 'unreadable',
      reason: 'no-history',
      message: `No git history under ${root}. History is the only surface carrying the ordering, so there is nothing to read.`,
    }
  }

  const base = resolveBase(root, options.base, head)
  if (typeof base !== 'string') return base

  const log = git(root, [
    'log',
    '--reverse',
    '--name-status',
    '--no-renames',
    '--format=%H',
    `${base}..${head}`,
  ])

  if (log === undefined) {
    return {
      kind: 'unreadable',
      reason: 'no-log',
      message: `Reading history between ${base} and HEAD failed under ${root}.`,
    }
  }

  const tree = git(root, ['ls-tree', '-r', '--name-only', base])
  if (tree === undefined) {
    return {
      kind: 'unreadable',
      reason: 'no-tree',
      message: `Reading the tree at ${base} failed under ${root}. Without it a test written before the range reads as absent.`,
    }
  }

  const changes = parseChanges(log)
  const atBase = new Set(tree.split('\n').filter((line) => line !== ''))

  const ignored = [
    ...new Set(
      changes
        .map((change) => change.path)
        .filter(
          (path) => !isImplementation(path) && testSuffix(path) === undefined,
        ),
    ),
  ].sort()

  return {
    kind: 'measured',
    base,
    head,
    scope: { extensions: SOURCE_EXTENSIONS, testSuffixes: TEST_SUFFIXES },
    ...classify(changes, atBase),
    ignored,
  }
}

/**
 * The far side of the range. A ref the caller named resolves through the merge
 * base against `head`, matching the no-ref branch below rather than taking the
 * ref as the comparison point, so a trunk that has moved under the branch does
 * not pull other people's merged commits into the range. A ref producing no
 * merge base has to refuse, since falling back to the trunk there would measure
 * a range nobody asked for. With no ref named, the merge base against the trunk
 * scopes the run to the branch, and a repository carrying no trunk falls back
 * to the root commit rather than refusing.
 */
function resolveBase(
  root: string,
  ref: string | undefined,
  head: string,
): string | { kind: 'unreadable'; reason: TestOrderRefusal; message: string } {
  for (const candidate of baseCandidates(ref)) {
    const merged = git(root, ['merge-base', head, candidate])
    if (isMergeBase(merged)) return merged
  }

  if (ref !== undefined) {
    return {
      kind: 'unreadable',
      reason: 'bad-base',
      message: `Ref ${ref} shares no history with HEAD in ${root}. Pass a ref this branch was taken from.`,
    }
  }

  const rootCommits = git(root, ['rev-list', '--max-parents=0', head])
  if (rootCommits === undefined || rootCommits === '') {
    return {
      kind: 'unreadable',
      reason: 'no-base',
      message: `No base resolves against ${root}. Fetch origin or pass --base.`,
    }
  }

  return rootCommits.split('\n')[0]
}

/**
 * `execaSync` with git's repository-resolution variables stripped, so `-C`
 * resolves against `root` and not against whatever repository a hook exported.
 * `undefined` is the refusal, which every caller turns into its own reason.
 */
function git(root: string, args: readonly string[]): string | undefined {
  const result = execaSync('git', ['-C', root, ...args], {
    reject: false,
    env: gitEnv(),
    extendEnv: false,
  })

  return result.exitCode === 0 ? result.stdout.trimEnd() : undefined
}

/**
 * The commit a ref names. `^{commit}` is what turns a tag or a tree into the
 * commit behind it, so a caller never compares a ref against another type.
 */
function revParse(root: string, ref: string): string | undefined {
  const resolved = git(root, [
    'rev-parse',
    '--verify',
    '--quiet',
    `${ref}^{commit}`,
  ])

  return resolved === undefined || resolved === '' ? undefined : resolved.trim()
}
