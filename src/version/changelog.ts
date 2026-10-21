import { compareVersions, parseVersion } from '@/version/compare'

export interface ChangelogEntry {
  readonly version: string
  /** The entry's heading line through its last line, trimmed. */
  readonly markdown: string
}

export type ChangelogRange =
  | { readonly kind: 'range'; readonly entries: readonly ChangelogEntry[] }
  | { readonly kind: 'unknown-version'; readonly version: string }

/**
 * `release-please` writes each release as `## [x.y.z](compare-url) (date)`, so
 * this is the one form the split reads. A heading in any other form is body
 * text of the entry above it, and a change to that form in the release tool
 * leaves the file reading as no entries at all.
 */
const HEADING = /^## \[([^\]]+)\]/

/** Entries in file order, which `release-please` keeps newest first. */
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let current: { version: string; lines: string[] } | undefined

  const close = () => {
    if (current === undefined) return
    entries.push({
      version: current.version,
      markdown: current.lines.join('\n').trim(),
    })
  }

  for (const line of text.split('\n')) {
    const match = HEADING.exec(line)
    if (match !== null) {
      close()
      current = { version: match[1] ?? '', lines: [line] }
    } else {
      current?.lines.push(line)
    }
  }
  close()

  return entries
}

/**
 * The releases after `since` up to and including `running`, oldest first so a
 * reader meets them in the order they shipped.
 *
 * A version the file never listed, or one that does not parse, or a `since`
 * newer than `running`, names no range. Each reads as `unknown-version` rather
 * than an empty success, since an empty range reads as a target with nothing
 * to catch up on. `since` equal to `running` is the one empty range, because
 * that target is current.
 */
export function entriesSince(
  entries: readonly ChangelogEntry[],
  since: string,
  running: string,
): ChangelogRange {
  const sinceParsed = parseVersion(since)
  const runningParsed = parseVersion(running)
  const listed = new Set(entries.map((entry) => entry.version))

  if (sinceParsed === undefined || !listed.has(since)) {
    return { kind: 'unknown-version', version: since }
  }
  if (runningParsed === undefined || !listed.has(running)) {
    return { kind: 'unknown-version', version: running }
  }
  if (compareVersions(sinceParsed, runningParsed) > 0) {
    return { kind: 'unknown-version', version: since }
  }

  const inRange = entries.filter((entry) => {
    const parsed = parseVersion(entry.version)
    return (
      parsed !== undefined &&
      compareVersions(parsed, sinceParsed) > 0 &&
      compareVersions(parsed, runningParsed) <= 0
    )
  })

  return { kind: 'range', entries: inRange.toReversed() }
}

/** The oldest version that parses, or undefined when none does. */
export function oldestVersion(versions: readonly string[]): string | undefined {
  let oldest:
    | { raw: string; parsed: NonNullable<ReturnType<typeof parseVersion>> }
    | undefined

  for (const raw of versions) {
    const parsed = parseVersion(raw)
    if (parsed === undefined) continue
    if (oldest === undefined || compareVersions(parsed, oldest.parsed) < 0) {
      oldest = { raw, parsed }
    }
  }

  return oldest?.raw
}
