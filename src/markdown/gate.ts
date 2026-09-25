import type { LinkFinding } from '@/markdown/links'
import type { BanFinding } from '@/markdown/scan'
import type { StructureReport } from '@/markdown/structure'

export interface GateInput {
  /** Every ban hit across every file measured, flattened. */
  readonly bans: readonly BanFinding[]
  /** Every dead relative link across every file measured, flattened. */
  readonly links: readonly LinkFinding[]
  /**
   * Every structural measure the run made, read by nothing here.
   *
   * Naming it is what makes the split checkable: bullet, paragraph, and depth
   * weight are judgments a reader settles, and a push failing on one teaches a
   * contributor to route around the stage. A signature taking the ban list
   * alone states the same rule and leaves no place to assert it.
   */
  readonly structure: readonly StructureReport[]
}

/**
 * Whether the audit found something that should fail the caller.
 *
 * A banned character and a relative link resolving to
 * nothing on disk are both facts rather than a threshold, so either gates
 * unconditionally and there is no widened mode to reach for. The standards
 * decide what counts as banned, which keeps this answering how many rather
 * than which.
 */
export function isGating({ bans, links }: GateInput): boolean {
  return bans.length > 0 || links.length > 0
}
