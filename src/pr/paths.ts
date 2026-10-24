import { findBacktickSpans } from '@/markdown/backticks'

/**
 * The heading whose bullets state what a branch changed.
 *
 * Read alone, and never widened to a sibling section. `## Technical context`
 * legitimately names files a branch never touched, such as an install stamp
 * inside a target, so a reader that took the whole body would manufacture a
 * finding out of every argument the author made for the change.
 */
export const KEY_CHANGES = 'Key changes'

/** What one bullet claimed, kept with its bullet so a finding can quote it. */
export interface PathClaim {
  /** Repository-relative, with a trailing slash kept on a directory claim. */
  readonly path: string
  /** True when the span named a folder, which covers every file beneath it. */
  readonly directory: boolean
  /**
   * True when the first segment names an entry the tree actually holds.
   *
   * An unanchored claim is a path written partially, such as
   * `role-worker/SKILL.md` for a file under `claude/skills/`. It can confirm
   * that a changed file was named and can never accuse one of being absent,
   * because the comparison has no way to tell a partial spelling from a
   * genuinely wrong one.
   */
  readonly anchored: boolean
  /**
   * True when the span sits ahead of the bullet's first comma.
   *
   * A trailing span is a path the bullet names without the reader being able to
   * tell a second claim from a file cited for context, so it credits a changed
   * file and never accuses one. Same asymmetry as `anchored`, on a second
   * question: both mark evidence strong enough to confirm and too weak to
   * accuse with.
   */
  readonly leading: boolean
  /**
   * True when the span carried no slash, such as `README.md` or `bun`.
   *
   * A bare claim credits a changed file whose whole path is exactly that name
   * and nothing else, so `package.json` never reaches `web/package.json`. It
   * never accuses: nothing separates a bare file name from a word of prose, so
   * one matching no changed file is reported nowhere. Same asymmetry as
   * `anchored` and `leading`.
   */
  readonly bare: boolean
  /** The span exactly as the body wrote it, before the line suffix came off. */
  readonly span: string
  /** One-based index of the bullet inside the section. */
  readonly bullet: number
  /** The bullet, trimmed, so a finding names the sentence it came from. */
  readonly preview: string
}

export type KeyChangeRead =
  | {
      readonly kind: 'read'
      readonly claims: readonly PathClaim[]
      /** Bullets the section carried, so an empty claim set is separable. */
      readonly bullets: number
    }
  | { readonly kind: 'no-section' }

/** The longest bullet a claim carries forward, matching the citation sweep. */
const PREVIEW_LIMIT = 200

/** A list item at any indent, in either bullet spelling or as an ordinal. */
const BULLET = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/

const FENCE = /^\s*(?:```|~~~)/

const HEADING = /^(#{1,6})\s+(.+?)\s*$/

/**
 * A `file.ts:42` or `file.ts:42-58` suffix, which is a reader's click target
 * rather than part of the name.
 */
const LINE_SUFFIX = /:\d+(?:-\d+)?$/

/**
 * A span that carries a line suffix and nothing else, such as `:642` beside
 * an earlier `verify.sh:634`. Its presence is what tells the citation guard
 * below the bullet is describing lines inside one already-claimed file rather
 * than naming a second file, since a genuinely distinct file never gets cited
 * by a bare line number with nothing in front of the colon.
 */
const BARE_LINE = /^:\d+(?:-\d+)?$/

/**
 * A character that puts the span outside a path this comparison resolves.
 *
 * Whitespace separates a backticked command from a backticked path, and it is
 * the whole answer to one of the four observed false-positive classes:
 * `canon markdown audit .claude/rules --json` carries a slash and names no file.
 * Angle brackets answer a second, since `.canon/plans/feature-<slug>.md`
 * describes a shape rather than naming a file. A glob and a caret describe a
 * shape too, `^src/` being a grep pattern one body spelled in Key changes, and
 * a leading anchor names something outside this repository.
 *
 * Deliberately not shared with `classifySpan` in `@/gov/citations`, which asks
 * a different question. That sweep resolves what a rule points a reader at,
 * against the filesystem, with a sibling resolving inside the citing rule's own
 * folder. This one resolves what a bullet claims to have changed, against a
 * changed-file list, and it admits a folder where that sweep declines one.
 */
function isNotRepositoryPath(span: string): boolean {
  if (/[\s<>$*|?^]/.test(span)) return true
  if (span.includes('://')) return true
  return /^[/~@#!]/.test(span)
}

/**
 * Whether the span's last segment is a bare dotted-decimal number, such as
 * an address (`127.0.0.1`) or an unprefixed version number (`1.2.3`).
 *
 * This is the one exclusion `resolveSpan` still applies to a non-directory
 * span. A bare dotted number reaching the comparison is the shape that put
 * `src/serve/127.0.0.1` in a report over a body that was correct, and every
 * other segment carrying no extension, such as `.husky/post-merge`, now
 * resolves.
 */
function isDottedNumber(span: string): boolean {
  const segment = span.slice(span.lastIndexOf('/') + 1)
  return /^\d+(?:\.\d+)+$/.test(segment)
}

/** Blanks every backticked span so a cue search never fires inside one. */
function maskSpans(text: string): string {
  let out = text
  for (const span of findBacktickSpans(text)) {
    out =
      out.slice(0, span.start) +
      ' '.repeat(span.end - span.start) +
      out.slice(span.end)
  }
  return out
}

/**
 * The part of a bullet that can accuse, which ends at its first comma.
 *
 * This is the one lever that separates a claim from a mention, and it was
 * chosen by measurement rather than by grammar. Over the 23 merged pull
 * requests in this repository that carry the section, reading whole bullets
 * reported 16 paths as claimed-but-untouched and every one of them was a file
 * the body named for context. Cutting at the comma left 110 claims of the
 * original 149 and took the false reports to 2. A list of clause-opening words
 * tried beside it (`which`, `since`, `because`, `rather than`, and eleven more)
 * removed nothing the comma had not already removed, because this corpus
 * punctuates every one of them.
 *
 * The cut used to bound what the scan collected at all, and that is the half
 * that came out. A path past the comma was left out of the claim set entirely
 * and fell to the unnamed direction, accepted here on the ground that the
 * direction reports without grading. It graded anyway, one consumer removed:
 * `review-pr` reads `unnamed` as a question to put to the branch author,
 * and on 2026-09-01 the question went to three pull requests over bullets that
 * had named the files all along, with `#1329` gaining bullets it did not need.
 *
 * Collecting the whole bullet as claims was measured against the 40 most recent
 * merged pull requests carrying the section and is not the repair: it takes
 * `unmet` from 10 to 19, and every one of the nine is the class the cut was
 * tuned to exclude, as in `#1276`'s "following the frame, the stream split, and
 * the exit ladder `src/commands/labels.ts` already carries". So the scan reads
 * the whole bullet and this cut decides `leading` instead, which is what lets a
 * trailing path credit a changed file while `unmet` stays where the corpus put
 * it. The same 40 give claims 243 to 314, unnamed 1124 to 1058, and unmet 10
 * either way.
 *
 * `disclaimsChange` reads this region too, and for its own reason rather than
 * by sharing this one: a disclaimer opens its bullet, so the cut reaches every
 * one the corpus carries, and `NO_CHANGE` below records what depends on that.
 */
function claimRegion(bullet: string): string {
  const at = maskSpans(bullet).indexOf(',')
  return at === -1 ? bullet : bullet.slice(0, at)
}

/**
 * A claim region that asserts nothing changed.
 *
 * A body writes such a bullet to record a decision it declined, and the path it
 * names is the file it deliberately did not touch, which is the exact inverse
 * of a claim. `#1274` opens one with "Leave `...expect.toml` untouched" and the
 * path sits ahead of the first comma, so the region cut cannot reach it: a
 * stricter cut would not catch this and a looser one would find more.
 *
 * The marker rather than the leading verb decides it, because `keep` and
 * `leave` both open a real claim often enough and neither is safe alone. The
 * set is deliberately three words. `in place` was measured and dropped, since
 * rewriting a file in place is an ordinary claim, and `no other line` was
 * dropped because `#1269` writes "as one insertion that touches no other line"
 * about a change it did make. `alone` was in the set and came out on review:
 * every occurrence across the 40-pull-request corpus sits past the first
 * comma, where the region cut already excludes it, so the word caught nothing
 * real there. Kept, it turns restrictive on a comma-free bullet, which is this
 * repository's more common use of the word: "Move the threshold read into
 * `src/gate/stages.ts` alone." asserts an edit and voided to an empty claim
 * set while the word was in the set, unlike the other three, which disclaim
 * wherever they land.
 */
const NO_CHANGE =
  /\b(?:untouched|unchanged)\b|\bas written\b|^\s*(?:do not|don't|never)\b/i

function disclaimsChange(bullet: string): boolean {
  return NO_CHANGE.test(maskSpans(claimRegion(bullet)))
}

/**
 * The lines under a heading, ending at the next heading of the same level or
 * higher. Undefined when the body carries no such heading, which the caller
 * reports rather than reading as an empty section.
 */
export function readSection(body: string, title: string): string | undefined {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const wanted = title.toLowerCase()

  let start = -1
  let level = 0
  let fenced = false

  for (const [index, line] of lines.entries()) {
    if (FENCE.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const heading = line.match(HEADING)
    if (heading === null) continue
    if ((heading[2] ?? '').toLowerCase() !== wanted) continue
    start = index + 1
    level = (heading[1] ?? '').length
    break
  }

  if (start === -1) return undefined

  const out: string[] = []
  fenced = false
  for (const line of lines.slice(start)) {
    if (FENCE.test(line)) fenced = !fenced
    const heading = fenced ? null : line.match(HEADING)
    if (heading !== null && (heading[1] ?? '').length <= level) break
    out.push(line)
  }

  return out.join('\n')
}

/**
 * Splits a section into bullets, folding a wrapped continuation line into the
 * bullet above it and starting a new one at every list marker.
 *
 * A nested bullet is its own bullet rather than part of its parent, which keeps
 * one claim region per claim a reader sees.
 */
function splitBullets(section: string): string[] {
  const bullets: string[] = []
  let current: string[] | undefined
  let fenced = false

  for (const line of section.split('\n')) {
    if (FENCE.test(line)) {
      fenced = !fenced
      current?.push(line)
      continue
    }

    const marker = fenced ? null : line.match(BULLET)
    if (marker !== null) {
      if (current !== undefined) bullets.push(current.join(' '))
      current = [marker[1] ?? '']
      continue
    }

    if (current === undefined) continue
    if (!fenced && line.trim() === '') {
      bullets.push(current.join(' '))
      current = undefined
      continue
    }
    current.push(line.trim())
  }

  if (current !== undefined) bullets.push(current.join(' '))
  return bullets
}

/** What one span resolved to, or nothing when it names no comparable path. */
interface ResolvedSpan {
  readonly path: string
  readonly directory: boolean
  readonly bare: boolean
}

function resolveSpan(span: string): ResolvedSpan | undefined {
  if (span === '' || isNotRepositoryPath(span)) return undefined

  // A bare name cannot be resolved as a sibling of a path earlier in the
  // bullet: that produced seven wrong paths across this corpus against two right
  // ones, because a compound bullet names a sibling folder as often as a sibling
  // file. It resolves to itself as a root-level path and is marked bare, which
  // keeps it from ever accusing.
  if (!span.includes('/')) {
    return isDottedNumber(span)
      ? undefined
      : { path: span, directory: false, bare: true }
  }

  if (span.endsWith('/')) {
    // A single top-level folder is never a claim. Nobody reports having changed
    // the whole of `src/`, and every body that spelled one was naming where
    // something lives.
    return span.indexOf('/') === span.length - 1
      ? undefined
      : { path: span, directory: true, bare: false }
  }

  return isDottedNumber(span)
    ? undefined
    : { path: span, directory: false, bare: false }
}

/**
 * Every path the `## Key changes` section claims a change to.
 *
 * `roots` names the entries the tree holds at its top level, which is what
 * separates a whole path from one written partially. It is passed in rather
 * than read here so the extractor stays a pure function of the body, and there
 * is no default: an absent set would silently mark every claim anchored, which
 * is the direction that accuses.
 *
 * Reports `no-section` rather than an empty read when the heading is absent,
 * and an empty claim set with a bullet count when the heading is there and
 * nothing resolved. The caller needs those apart. A body with no section states
 * nothing, a section that produced no claim is this extractor failing over
 * prose, and only a section that produced claims supports a comparison. An
 * empty extraction read as a clean pass is the failure shape this repository
 * has already recorded twice.
 */
export function extractKeyChangePaths(
  body: string,
  roots: ReadonlySet<string>,
  title: string = KEY_CHANGES,
): KeyChangeRead {
  const section = readSection(body, title)
  if (section === undefined) return { kind: 'no-section' }

  const bullets = splitBullets(section)
  const claims: PathClaim[] = []
  const seen = new Set<string>()

  for (const [index, bullet] of bullets.entries()) {
    const trimmed = bullet.trim()
    const preview =
      trimmed.length > PREVIEW_LIMIT
        ? `${trimmed.slice(0, PREVIEW_LIMIT)}…`
        : trimmed
    if (disclaimsChange(trimmed)) continue

    const accusesBefore = claimRegion(trimmed).length
    const spans = findBacktickSpans(trimmed)
    // Whether a `file:line` span citing an already-claimed file is a second
    // claim or a citation into the file just claimed turns on this: a bullet
    // that also carries a bare `:642`-shaped span alongside it is describing
    // two lines in one file, where a bullet with no such companion is naming
    // a second, genuinely distinct file. Computed once, up front, so the
    // guard below reads it rather than scanning again for every span.
    const hasBareLineCompanion = spans.some((span) =>
      BARE_LINE.test(span.content),
    )
    let claimed = false

    for (const match of spans) {
      const span = match.content
      const bare = span.replace(LINE_SUFFIX, '')

      // A `file:line` span following another claim in the same bullet is a
      // citation into a file being described rather than a second claim, which
      // is what "the stages at `verify.sh:634` and `:642`" is doing inside a
      // bullet whose claim is the context entry that describes them. Leading
      // its bullet it is an ordinary claim, which is how a body names the exact
      // line it rewrote.
      const cited = bare !== span
      if (cited && claimed && hasBareLineCompanion) continue

      const resolved = resolveSpan(bare)
      if (resolved === undefined) continue
      // A bare span is no evidence a path claim came first, so it leaves the
      // citation guard above reading only the claims it was written for.
      if (!resolved.bare) claimed = true
      // First occurrence wins, across bullets as well as inside one. A path
      // named trailing here and leading three bullets later keeps the weaker
      // reading, which loses an accusation and can never add one.
      if (seen.has(resolved.path)) continue
      seen.add(resolved.path)

      claims.push({
        path: resolved.path,
        directory: resolved.directory,
        anchored:
          !resolved.bare &&
          roots.has(resolved.path.slice(0, resolved.path.indexOf('/'))),
        leading: match.start < accusesBefore,
        bare: resolved.bare,
        span,
        bullet: index + 1,
        preview,
      })
    }
  }

  return { kind: 'read', claims, bullets: bullets.length }
}
