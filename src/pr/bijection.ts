import type { RenamePair } from '@/git/files'
import { extractKeyChangePaths, KEY_CHANGES, type PathClaim } from '@/pr/paths'

/**
 * Why the comparison produced no reading.
 *
 * The three are apart because each names a different repair. `no-section` is a
 * body missing the heading, `no-claims` is the extractor failing over a section
 * full of prose, and `no-changes` is a pull request with no files. Folding any
 * of them into a clean pass is the failure this check exists to prevent, since
 * a reader cannot tell a check that found nothing from one that read nothing.
 */
export type BijectionRefusal = 'no-section' | 'no-claims' | 'no-changes'

export interface BijectionReport {
  readonly kind: 'measured'
  /** The commit the changed set was read at, which a finding has to name. */
  readonly head: string | undefined
  readonly changed: readonly string[]
  readonly claims: readonly PathClaim[]
  /**
   * Anchored claims no changed file answers, which is the graded direction. A
   * bullet naming an untouched file is wrong more often than not, and this
   * corpus reported zero of them across 23 correct bodies.
   */
  readonly unmet: readonly PathClaim[]
  /**
   * Claims no changed file answers that the comparison could not judge either
   * way, reported so a run says what it declined rather than counting them met.
   *
   * Two causes land here. A claim whose first segment names no entry in the
   * tree is a path written partially, and one past its bullet's first comma is
   * a path the reader cannot separate from a file cited for context. Both are
   * evidence strong enough to credit a changed file and too weak to accuse one,
   * so neither reaches `unmet`, and the cause is on the claim rather than in a
   * bucket of its own: a reader acts on both the same way, by opening the
   * bullet on `preview`.
   */
  readonly unresolved: readonly PathClaim[]
  /**
   * Changed files no claim reaches that a reader might have wanted a bullet
   * for. Reported without a severity, since a change can be too small to
   * describe and still be correctly absent from the section.
   */
  readonly unnamed: readonly string[]
  /**
   * Changed files no claim reaches that owe no bullet in the first place.
   *
   * Held apart rather than dropped, so a run still says what it set aside.
   * `#1331` reported seven unnamed files of which four were a test or a
   * fixture, which is what makes the raw count unreadable: a number mixing
   * files that owe a bullet with files that never could cannot be acted on at
   * any value, and the reviewing skill reads `unnamed` as a question to a
   * branch author.
   */
  readonly incidental: readonly string[]
  /**
   * True when the rename or `.gitignore`-addition evidence could not be read.
   *
   * A claim `unmet` would otherwise carry is downgraded to `unresolved`
   * instead, since the unread evidence might have credited it and this
   * comparison has no way to tell a stale claim from one it could not check.
   */
  readonly evidenceUnread: boolean
}

export type Bijection =
  | BijectionReport
  | { readonly kind: 'refused'; readonly reason: BijectionRefusal }

export interface BijectionInput {
  readonly body: string
  readonly changed: readonly string[]
  /** Top-level entries the tree holds, which decides what counts as anchored. */
  readonly roots: ReadonlySet<string>
  readonly head?: string
  readonly title?: string
  /** A rename's source path credits a claim naming it, without ever counting as a changed file. */
  readonly renames?: readonly RenamePair[]
  /** A pattern newly added to `.gitignore`, crediting a claim naming it as the `.gitignore` change it is. */
  readonly ignoreAdditions?: readonly string[]
  /**
   * True when the caller could not read the rename or ignore-addition
   * evidence, rather than reading it and finding neither.
   *
   * The two states produce the same empty `renames`/`ignoreAdditions`, so
   * this is the only way `compareKeyChanges` can tell a claim that is
   * genuinely stale from one the evidence might have credited had the read
   * succeeded.
   */
  readonly evidenceUnread?: boolean
}

/**
 * A changed file that owes no bullet, so its absence from the section is not a
 * gap a reader would want reported.
 *
 * Three classes, each conventional rather than named for this repository: a
 * test beside the subject it covers, anything under a fixture or snapshot
 * folder, and a lockfile a package manager writes. All three change constantly
 * as a consequence of work the section describes in its own terms, which is why
 * a body naming them reads as noise rather than as diligence.
 *
 * A generated asset and a regenerated index belong in the class and are
 * deliberately absent, because neither has a spelling that holds outside one
 * project. Guessing at one would set aside a file that did owe a bullet, which
 * is the direction that hides a real omission, where leaving them out only
 * leaves the count where it already was.
 */
const INCIDENTAL: readonly RegExp[] = [
  /(?:^|\/)[^/]+\.(?:test|spec)\.[A-Za-z0-9]+$/,
  /(?:^|\/)(?:__tests__|__fixtures__|__snapshots__|fixtures|testdata)\//,
  /(?:^|\/)(?:bun\.lockb?|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|Gemfile\.lock|poetry\.lock|uv\.lock|composer\.lock|go\.sum)$/,
]

function owesNoBullet(path: string): boolean {
  return INCIDENTAL.some((pattern) => pattern.test(path))
}

/** Drops a directory claim's trailing slash so it compares against a raw `.gitignore` pattern. */
function withoutTrailingSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path
}

/**
 * Whether a claim names a pattern newly added to `.gitignore`.
 *
 * Compared with the trailing slash both sides may or may not carry stripped,
 * since a bullet spells a folder pattern the way `.gitignore` itself does
 * (`web/screenshots/`) and the diff line carries the identical text.
 */
function coversIgnoreAddition(
  claim: PathClaim,
  ignoreAdditions: readonly string[],
): boolean {
  const named = withoutTrailingSlash(claim.path)
  return ignoreAdditions.some(
    (pattern) => withoutTrailingSlash(pattern) === named,
  )
}

/**
 * Whether one changed path is the file, or a file under the folder, a claim
 * names.
 *
 * An unanchored claim matches on a segment-anchored suffix, which is what lets
 * `role-worker/SKILL.md` credit `claude/skills/role-worker/SKILL.md`. That
 * asymmetry is deliberate: a partial spelling can confirm a changed file was
 * named and never accuse one of being absent, because nothing here separates a
 * path written short from a path written wrong.
 */
function covers(claim: PathClaim, path: string): boolean {
  if (claim.directory) {
    return claim.anchored
      ? path.startsWith(claim.path)
      : path.includes(`/${claim.path}`)
  }
  if (path === claim.path) return true
  return !claim.anchored && path.endsWith(`/${claim.path}`)
}

/**
 * Compares what a pull request body claims to have changed against what it
 * actually changed, in both directions.
 *
 * The two directions are reported apart because they want different
 * tolerances. A claim nobody made good on is a defect in the record that
 * squash-merges onto the trunk, and a changed file nobody recorded is often
 * correct. Merging them into one count would either grade the second or excuse
 * the first.
 *
 * Each direction then splits again on the same question, which is whether the
 * evidence is strong enough to raise with a person. A claim reaches `unmet`
 * only when it is both whole and leading, and a changed file reaches `unnamed`
 * only when a bullet was owed for it. What each split sets aside is still
 * reported, under `unresolved` and `incidental`, so a count a reader can act on
 * never comes at the price of a file the run stayed silent about.
 *
 * Pure, so the whole judgment is testable against a fixture. The caller reads
 * the body, the changed set, and the tree roots and hands all three in.
 */
export function compareKeyChanges(input: BijectionInput): Bijection {
  if (input.changed.length === 0)
    return { kind: 'refused', reason: 'no-changes' }

  const read = extractKeyChangePaths(
    input.body,
    input.roots,
    input.title ?? KEY_CHANGES,
  )
  if (read.kind === 'no-section')
    return { kind: 'refused', reason: 'no-section' }
  if (read.claims.length === 0) return { kind: 'refused', reason: 'no-claims' }

  const renames = input.renames ?? []
  const ignoreAdditions = input.ignoreAdditions ?? []
  const evidenceUnread = input.evidenceUnread ?? false

  const unmet: PathClaim[] = []
  const unresolved: PathClaim[] = []
  const named = new Set<string>()

  for (const claim of read.claims) {
    const hits = input.changed.filter((path) => covers(claim, path))
    for (const path of hits) named.add(path)
    if (hits.length > 0) continue

    if (renames.some((rename) => covers(claim, rename.from))) continue

    if (coversIgnoreAddition(claim, ignoreAdditions)) {
      named.add('.gitignore')
      continue
    }

    if (claim.anchored && claim.leading && !evidenceUnread) unmet.push(claim)
    else unresolved.push(claim)
  }

  const reached = input.changed.filter((path) => !named.has(path))

  return {
    kind: 'measured',
    head: input.head,
    changed: [...input.changed],
    claims: read.claims,
    unmet,
    unresolved,
    unnamed: reached.filter((path) => !owesNoBullet(path)),
    incidental: reached.filter(owesNoBullet),
    evidenceUnread,
  }
}

/**
 * The top-level folders a claim may be anchored on: the first segment of every
 * path the tree holds, plus the first segment of every changed path.
 *
 * The changed half is what admits a folder this branch created. Reading the
 * tree alone would mark every claim under a new top-level directory unanchored,
 * and an unanchored claim never accuses, so the first branch to open one would
 * silently lose the graded direction.
 *
 * A path with no folder above it contributes nothing, since a claim carrying no
 * slash never reaches the extractor's output and no root would ever be read
 * against it.
 */
export function treeRoots(
  tracked: readonly string[],
  changed: readonly string[],
): Set<string> {
  const roots = new Set<string>()
  for (const path of [...tracked, ...changed]) {
    const at = path.indexOf('/')
    if (at > 0) roots.add(path.slice(0, at))
  }
  return roots
}
