import { listChangedFiles, resolveBaseRef } from '@/git/files'
import { type Coverage, resolveCoverage } from '@/labels/coverage'
import { type MapRefusal, readLabelMap } from '@/labels/map'

/**
 * Why an audit produced no reading. `no-map` is an answer rather than a fault,
 * and the git reasons are a range this check could not get. A named ref with no
 * merge base is its own reason, since `no-base` would tell the caller to pass `--base`.
 */
export type LabelAuditRefusal =
  | MapRefusal
  | 'no-base'
  | 'bad-base'
  | 'unreadable-changes'

export type LabelAudit =
  | {
      readonly kind: 'measured'
      /** Absent when the caller supplied the changed set rather than a range. */
      readonly base?: string
      readonly changed: readonly string[]
      readonly coverage: Coverage
    }
  | { readonly kind: 'refused'; readonly reason: LabelAuditRefusal }

export interface LabelAuditOptions {
  /**
   * Ref naming the far side of the range, which resolves through its merge
   * base with `HEAD` rather than being compared against literally. Defaults to
   * the trunk.
   */
  readonly base?: string
  /** A changed set the caller already holds, which skips git entirely. */
  readonly paths?: readonly string[]
}

/**
 * Resolves a changed set against the map a project declares, reporting both what
 * it earns and what it leaves uncovered. One verb serves `git-pr` at open time
 * and the audit aggregate, which retains the uncovered count.
 */
export async function auditLabels(
  root: string,
  options: LabelAuditOptions = {},
): Promise<LabelAudit> {
  const map = readLabelMap(root)
  if (map.kind === 'refused') return { kind: 'refused', reason: map.reason }

  if (options.paths !== undefined) {
    return {
      kind: 'measured',
      changed: [...options.paths],
      coverage: resolveCoverage(map, options.paths),
    }
  }

  const base = await resolveBaseRef(root, options.base)
  if (base === undefined) {
    return {
      kind: 'refused',
      reason: options.base === undefined ? 'no-base' : 'bad-base',
    }
  }

  const changed = await listChangedFiles(root, base)
  if (changed === undefined) {
    return { kind: 'refused', reason: 'unreadable-changes' }
  }

  return {
    kind: 'measured',
    base,
    changed,
    coverage: resolveCoverage(map, changed),
  }
}
