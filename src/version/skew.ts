import { PROJECT_ROOT } from '@/roots/project'
import { compareVersions, parseVersion } from '@/version/compare'
import {
  type InstalledPackage,
  readInstalled,
  UNKNOWN_LABEL,
} from '@/version/installed'
import { detectManager } from '@/version/manager'

const REGISTRY = 'https://registry.npmjs.org'

/**
 * Short enough that a check waiting on a dead network still returns inside the
 * time an operator would give the command anyway. The skew line is one section
 * of a report the rest of which needs no network at all, so the budget is set
 * against how long the report may be held up rather than against how long the
 * registry usually takes.
 */
const LOOKUP_TIMEOUT_MS = 3_000

/**
 * Three states and no fourth. `unknown` covers every way the question could not
 * be answered and carries the reason, which is what a caller reports instead of
 * a version.
 *
 * An installed version ahead of the published one reports `current`. That is a
 * source checkout between a release commit and the publish job, or a local
 * build, and neither is skew. Giving it a state of its own would fire a warning
 * on every maintainer run for a condition with no remedy.
 */
export type SkewState = 'current' | 'behind' | 'unknown'

interface SkewBase {
  readonly name: string
  readonly installed: string
}

/**
 * A union rather than one shape with two optional fields, so a `behind` report
 * cannot exist without the version it is behind and an `unknown` one cannot
 * exist without its reason. Both are what `describeSkew` renders into a line an
 * operator reads, and an optional field renders the word `undefined` there.
 */
export type SkewReport =
  | (SkewBase & {
      readonly state: 'current' | 'behind'
      readonly latest: string
    })
  | (SkewBase & { readonly state: 'unknown'; readonly reason: string })

/** Resolves the newest published version, or throws for `readSkew` to absorb. */
export type LatestLookup = (name: string) => Promise<string>

export interface SkewOptions {
  readonly installed?: InstalledPackage
  readonly lookup?: LatestLookup
}

/**
 * The installed version against the newest published one.
 *
 * Never rejects and never reports through an exit code. `canon sync --check
 * --exit-code` gates CI on drift it measured locally, so a lookup that failed
 * the caller would turn an offline machine into a failing check and the check
 * would be routed around. Every failure lands in `unknown` with its reason.
 */
export async function readSkew(options: SkewOptions = {}): Promise<SkewReport> {
  const installed = options.installed ?? readInstalled()
  const lookup = options.lookup ?? fetchLatest
  const { name, version } = installed

  if (version === undefined) {
    return unknown(
      installed,
      'No version in the package manifest, so there is nothing to compare.',
    )
  }

  if (name === undefined) {
    return unknown(
      installed,
      'No name in the package manifest, so the registry has nothing to look up.',
    )
  }

  const local = parseVersion(version)
  if (local === undefined) {
    return unknown(
      installed,
      `Installed version ${version} is not a version this can parse.`,
    )
  }

  let raw: string
  try {
    raw = await lookup(name)
  } catch (error) {
    return unknown(installed, `Registry lookup failed: ${describe(error)}`)
  }

  const published = parseVersion(raw)
  if (published === undefined) {
    return unknown(
      installed,
      `Registry reported ${raw} as the newest version, which is not a version this can parse.`,
    )
  }

  return {
    state: compareVersions(local, published) < 0 ? 'behind' : 'current',
    name,
    installed: version,
    latest: raw,
  }
}

function unknown(installed: InstalledPackage, reason: string): SkewReport {
  return {
    state: 'unknown',
    name: installed.name ?? UNKNOWN_LABEL,
    installed: installed.version ?? UNKNOWN_LABEL,
    reason,
  }
}

/** The newest published version, or `undefined` when it could not be read. */
export function latestOf(report: SkewReport): string | undefined {
  return report.state === 'unknown' ? undefined : report.latest
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The dist-tag endpoint rather than the full packument, which for this package
 * carries every published manifest and is the larger part of a megabyte. The
 * question is one string and this is the endpoint that answers only it.
 */
async function fetchLatest(name: string): Promise<string> {
  const response = await fetch(
    `${REGISTRY}/-/package/${encodeURIComponent(name)}/dist-tags`,
    {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    },
  )

  if (!response.ok) {
    throw new Error(`registry returned ${response.status}`)
  }

  const tags = (await response.json()) as Record<string, unknown>
  const latest = tags.latest

  if (typeof latest !== 'string') {
    throw new Error('registry reported no latest dist-tag')
  }

  return latest
}

/**
 * One line naming the state, for a caller that renders the skew beside sections
 * it does not own. Held here so `canon sync --check` and `canon claude skills
 * drift` cannot word the same three states differently.
 *
 * The remedy is chosen by the same detection `canon upgrade` runs, because both
 * callers run from a source checkout routinely and that is where the verb
 * refuses. Naming it unconditionally sends a contributor whose clone sits a
 * release behind to a command that declines. The read is a match against the
 * root string rather than a filesystem call, so the line stays cheap.
 */
export function describeSkew(
  report: SkewReport,
  root: string = PROJECT_ROOT,
): string {
  if (report.state === 'unknown') {
    return `Installed ${report.installed}, published unknown. ${report.reason}`
  }

  if (report.state === 'current') {
    return `Installed ${report.installed}, which is the newest published.`
  }

  const remedy =
    detectManager(root) === undefined
      ? 'This is a source checkout, so pull rather than reinstalling.'
      : 'Run `canon upgrade`.'

  return `Installed ${report.installed}, published ${report.latest}. ${remedy}`
}
