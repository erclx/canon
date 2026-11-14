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
export const LINE_SUFFIX = /:\d+(?:-\d+)?$/

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
 * Whitespace marks a backticked command, angle brackets a shape such as
 * `feature-<slug>.md`, a glob or caret a pattern, and a leading anchor
 * something outside this repository. Deliberately not shared with
 * `classifySpan` in `@/gov/citations`, which resolves what a rule points at
 * against the filesystem, where this resolves what a bullet claims changed
 * against a changed-file list and admits a folder that sweep declines.
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
 * The comma separates a claim from a mention: a path ahead of it is a claim,
 * and one after it is context. The scan still reads the whole bullet, so a
 * trailing path can credit a changed file, but only this region decides
 * `leading`. Clause-opening words were weighed as a cut and added nothing the
 * comma did not. `disclaimsChange` reads this region too, since a disclaimer
 * opens its bullet.
 */
function claimRegion(bullet: string): string {
  const at = maskSpans(bullet).indexOf(',')
  return at === -1 ? bullet : bullet.slice(0, at)
}

/**
 * A claim region that asserts nothing changed.
 *
 * A body writes such a bullet to record a decision it declined, so the path it
 * names is the file it did not touch. The marker rather than the leading verb
 * decides it, since `keep` and `leave` open real claims too. `in place`, `no
 * other line`, and `alone` stay out, since each also appears in a bullet that
 * asserts an edit.
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
  return readSectionAt(body, title)?.text
}

/**
 * The section's text and the character offset it starts at, counted in the body
 * with its line endings normalized to `\n`.
 *
 * The offset is what lets a caller rewrite the section in place. Searching the
 * body for the text instead finds the first copy, so an identical block above
 * the heading would take the edit.
 */
export function readSectionAt(
  body: string,
  title: string,
): { readonly text: string; readonly offset: number } | undefined {
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

  const offset = lines
    .slice(0, start)
    .reduce((sum, line) => sum + line.length + 1, 0)
  return { text: out.join('\n'), offset }
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

  // A bare name resolves to itself as a root-level path and is marked bare so
  // it never accuses, since guessing a sibling of an earlier path misfires.
  if (!span.includes('/')) {
    return isDottedNumber(span)
      ? undefined
      : { path: span, directory: false, bare: true }
  }

  if (span.endsWith('/')) {
    // A single top-level folder is never a claim, since a body spelling one
    // is naming where something lives.
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
 * `roots` names the tree's top-level entries, which separates a whole path from
 * a partial one. It has no default, since an absent set would mark every claim
 * anchored, the direction that accuses. A missing heading reports
 * `no-section`, and a section yielding no claim reports an empty set with a
 * bullet count, so the caller never reads an extraction failure as a pass.
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
    // A bare `:642`-shaped span beside a `file:line` span means two lines in
    // one file, so it decides whether a repeated file is a second claim.
    const hasBareLineCompanion = spans.some((span) =>
      BARE_LINE.test(span.content),
    )
    let claimed = false

    for (const match of spans) {
      const span = match.content
      const bare = span.replace(LINE_SUFFIX, '')

      // A `file:line` span after another claim in the bullet cites a file being
      // described. Leading its bullet, it is an ordinary claim.
      const cited = bare !== span
      if (cited && claimed && hasBareLineCompanion) continue

      const resolved = resolveSpan(bare)
      if (resolved === undefined) continue
      // A bare span is no evidence a path claim came first, so it leaves the
      // citation guard above reading only the claims it was written for.
      if (!resolved.bare) claimed = true
      // First occurrence wins across bullets, which can lose an accusation and
      // never add one.
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
