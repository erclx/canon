import type { RenamePair } from '@/git/files'
import { findMislinked, type Mislinked } from '@/pr/links'
import { extractKeyChangePaths, KEY_CHANGES, type PathClaim } from '@/pr/paths'

/**
 * Why the comparison produced no reading, the three apart since each names a
 * different repair: no heading, an extractor failing over prose, or no files.
 * Folding any into a clean pass hides a check that read nothing.
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
   * Claims no changed file answers, which the comparison could not judge: a path
   * written partially, or one past its bullet's first comma. Both are too weak
   * to accuse, so neither reaches `unmet`; a reader opens the bullet on `preview`.
   */
  readonly unresolved: readonly PathClaim[]
  /**
   * Changed files no claim reaches that a reader might have wanted a bullet
   * for. Reported without a severity, since a change can be too small to
   * describe and still be correctly absent from the section.
   */
  readonly unnamed: readonly string[]
  /**
   * Changed files no claim reaches that owe no bullet in the first place. Held
   * apart rather than dropped, so a run says what it set aside, and `unnamed`
   * stays a question to the branch author.
   */
  readonly incidental: readonly string[]
  /**
   * True when the rename or `.gitignore`-addition evidence could not be read, so
   * a claim `unmet` would carry is downgraded to `unresolved`, since the unread
   * evidence might have credited it.
   */
  readonly evidenceUnread: boolean
  /**
   * Links in the section whose anchor hashes a path other than the one their
   * label names, which open the wrong file's diff. Empty for a body that links
   * nothing, since an unlinked path is the ordinary form.
   */
  readonly mislinked: readonly Mislinked[]
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
   * True when the caller could not read the rename or ignore-addition evidence,
   * rather than reading it and finding neither. The two states produce the same
   * empty `renames`/`ignoreAdditions`, so this is the only way to tell them apart.
   */
  readonly evidenceUnread?: boolean
}

/**
 * A changed file that owes no bullet. Three conventional classes: a test beside
 * its subject, anything under a fixture or snapshot folder, and a lockfile. A
 * generated asset is absent, since no spelling holds outside one project.
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
 * Whether a claim names a pattern newly added to `.gitignore`, compared with the
 * trailing slash stripped on both sides, since a bullet spells a folder pattern
 * the way `.gitignore` does (`web/screenshots/`).
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
 * names. An unanchored claim matches on a segment-anchored suffix, so a partial
 * spelling confirms a file was named and never accuses one of being absent.
 */
function covers(claim: PathClaim, path: string): boolean {
  if (claim.bare) return path === claim.path
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
 * changed, both directions apart. A claim reaches `unmet` only when whole and
 * leading, and a file reaches `unnamed` only when a bullet was owed. Pure.
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

    if (claim.bare) continue

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
    mislinked: findMislinked(input.body, input.changed),
  }
}

/**
 * The top-level folders a claim may be anchored on: the first segment of every
 * path the tree holds, plus every changed path's. The changed half admits a
 * folder this branch created, or its claims would never accuse.
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
