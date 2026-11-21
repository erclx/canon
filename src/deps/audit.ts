import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'

/**
 * The severities the advisory index publishes, worst first. `info` is this
 * module's own floor, since an advisory under an unrecognized severity still
 * exists and dropping it would shrink the count when the vocabulary changed.
 */
export const SEVERITIES = [
  'critical',
  'high',
  'moderate',
  'low',
  'info',
] as const

export type Severity = (typeof SEVERITIES)[number]

export interface Advisory {
  readonly package: string
  readonly id: number
  readonly title: string
  readonly url: string
  readonly severity: Severity
  readonly vulnerableVersions?: string
}

/**
 * Why no advisory list was produced, which is never the same as a clean one.
 * `no-lockfile` is split from `no-record` because an unreachable index is
 * retried while unresolved dependencies are installed first.
 */
export type AuditRefusal = 'no-manifest' | 'no-lockfile' | 'no-record'

/**
 * The ceiling on `bun audit --json`, which carries no timeout of its own and
 * runs to bun's 299-second ceiling on a stall. Clean runs measured up to 77.6
 * seconds, so 120 leaves margin while bounding a stall well under that.
 */
const AUDIT_TIMEOUT_MS = 120_000

/** The lockfiles a resolved dependency set leaves behind, in any manager. */
const LOCKFILES = [
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]

export type DepsAudit =
  | { readonly kind: 'audited'; readonly advisories: readonly Advisory[] }
  | {
      readonly kind: 'refused'
      readonly reason: AuditRefusal
      readonly message?: string
    }

function severityOf(value: unknown): Severity {
  return SEVERITIES.includes(value as Severity) ? (value as Severity) : 'info'
}

/**
 * Reads the record `bun audit --json` writes to stdout, flattening the object
 * keyed by package name into one advisory list. Returning nothing on unreadable
 * output keeps an unreachable index from reporting as a clean tree.
 */
export function parseAdvisories(stdout: string): Advisory[] | undefined {
  let record: unknown
  try {
    record = JSON.parse(stdout)
  } catch {
    return undefined
  }

  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return undefined
  }

  const advisories: Advisory[] = []
  for (const [name, entries] of Object.entries(record)) {
    if (!Array.isArray(entries)) return undefined

    for (const raw of entries) {
      if (typeof raw !== 'object' || raw === null) return undefined
      const entry = raw as Record<string, unknown>

      advisories.push({
        package: name,
        id: typeof entry.id === 'number' ? entry.id : 0,
        title: typeof entry.title === 'string' ? entry.title : '',
        url: typeof entry.url === 'string' ? entry.url : '',
        severity: severityOf(entry.severity),
        ...(typeof entry.vulnerable_versions === 'string' && {
          vulnerableVersions: entry.vulnerable_versions,
        }),
      })
    }
  }

  return advisories
}

export function countBySeverity(
  advisories: readonly Advisory[],
): Record<Severity, number> {
  const counts = Object.fromEntries(
    SEVERITIES.map((severity) => [severity, 0]),
  ) as Record<Severity, number>

  for (const advisory of advisories) counts[advisory.severity] += 1
  return counts
}

/**
 * The message a caller reads for a refusal with no advisory record, naming a
 * stall as its own cause rather than folding it into "no output on stdout",
 * which is what an empty stdout reads as either way.
 */
export function noRecordMessage(result: {
  readonly timedOut: boolean
  readonly stderr: string
}): string {
  if (result.timedOut) {
    return `timed out after ${AUDIT_TIMEOUT_MS}ms waiting on the advisory index`
  }
  const line = result.stderr.trim().split('\n').pop()
  return line !== undefined && line !== '' ? line : 'no output on stdout'
}

/**
 * Shells the runtime's own advisory command rather than carrying an index, so
 * an unreachable index must be told from a clean tree. The exit code is not
 * read, since `bun audit` exits non-zero on advisories and on a failed lookup.
 */
export async function auditDependencies(root: string): Promise<DepsAudit> {
  if (!existsSync(join(root, 'package.json'))) {
    return { kind: 'refused', reason: 'no-manifest' }
  }

  if (!LOCKFILES.some((name) => existsSync(join(root, name)))) {
    return { kind: 'refused', reason: 'no-lockfile' }
  }

  const result = await execa('bun', ['audit', '--json'], {
    cwd: root,
    reject: false,
    timeout: AUDIT_TIMEOUT_MS,
  })

  const advisories = parseAdvisories(result.stdout)
  if (advisories === undefined) {
    return {
      kind: 'refused',
      reason: 'no-record',
      message: noRecordMessage(result),
    }
  }

  return { kind: 'audited', advisories }
}
