/**
 * A `major.minor.patch` core with an optional prerelease tail. The registry publishes both under
 * the same dist tag, so a core-only comparison would read `1.0.0-rc.1` as unparseable.
 */
const VERSION =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export interface ParsedVersion {
  readonly major: number
  readonly minor: number
  readonly patch: number
  /** Absent on a release, which sorts above every prerelease of the same core. */
  readonly prerelease?: string
}

export function parseVersion(raw: string): ParsedVersion | undefined {
  const match = VERSION.exec(raw.trim())
  if (match === null) return undefined

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    ...(match[4] === undefined ? {} : { prerelease: match[4] }),
  }
}

/**
 * Negative when `left` is older, positive when it is newer, zero when the two name one version.
 * Prerelease identifiers compare as whole strings, narrower than semver, and any prerelease
 * sorts below the release sharing its core.
 */
export function compareVersions(
  left: ParsedVersion,
  right: ParsedVersion,
): number {
  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  if (left.patch !== right.patch) return left.patch - right.patch

  if (left.prerelease === right.prerelease) return 0
  if (left.prerelease === undefined) return 1
  if (right.prerelease === undefined) return -1

  return left.prerelease < right.prerelease ? -1 : 1
}
