import type { SectionFinding } from '@/context/audit'
import type { FolderDrift } from '@/context/index-drift'
import type { WireframeStatesReport } from '@/context/wireframe-states'

export interface GateInput {
  /** Cited paths that resolved to nothing, which gate under either mode. */
  readonly unresolvedCitations: number
  /**
   * Whether the architecture record is longer than the ceiling it derives for
   * itself, which gates under either mode for the reason a citation does.
   *
   * False when the project carries no record and false under
   * `--citations-only`, which never measures it. That mode runs one check by
   * construction, so widening it here would gate on a reading it never took.
   */
  readonly recordOverLength: boolean
  readonly sections: readonly SectionFinding[]
  readonly drift: readonly FolderDrift[]
  /**
   * Every wireframe entry's states report, empty for a project carrying no
   * `canon/wireframes/` folder. A states/evidence mismatch and a sketch beside
   * existing evidence are both facts read off the file, the same standing the
   * missing-section and index-drift findings already have, so they gate
   * alongside them under the widened mode rather than under a mode of their
   * own.
   */
  readonly wireframes: readonly WireframeStatesReport[]
  /**
   * Whether the caller asked for the widened gate. False leaves a missing
   * section and a drifted index advisory, which is what the project-root stage
   * runs so a judgment threshold never fails a push.
   */
  readonly widened: boolean
}

/** Whether any folder disagrees with its own index. */
export function hasDrift(drift: readonly FolderDrift[]): boolean {
  return drift.some(
    (folder) => folder.unlisted.length > 0 || folder.missing.length > 0,
  )
}

/** Whether any wireframe's States table disagrees with its evidence folders. */
export function hasStatesMismatch(
  wireframes: readonly WireframeStatesReport[],
): boolean {
  return wireframes.some(
    (entry) =>
      entry.missingFolders.length > 0 || entry.unlistedFolders.length > 0,
  )
}

/** Whether any wireframe carries a sketch beside evidence that already exists. */
export function hasSketchWithEvidence(
  wireframes: readonly WireframeStatesReport[],
): boolean {
  return wireframes.some((entry) => entry.sketchWithEvidence)
}

/**
 * Whether the audit found something that should fail the caller.
 *
 * An unresolved citation is a broken pointer and gates unconditionally, and so
 * does a record past its own ceiling: the record states the limit for itself
 * and derives it from a count, which makes it the one measure here that is a
 * fact rather than a threshold a reader weighs. The findings `--gate` adds are
 * the ones answerable from the file itself: a required section it does not
 * declare, an index disagreeing with its folder, a wireframe's States table
 * disagreeing with its evidence folders, and a wireframe carrying a sketch
 * beside evidence that already exists. Entry length, depth, bullet, table,
 * provenance, and the record's claim coverage are judgments, so they stay out
 * under both modes.
 */
export function isGating({
  unresolvedCitations,
  recordOverLength,
  sections,
  drift,
  wireframes,
  widened,
}: GateInput): boolean {
  if (unresolvedCitations > 0) return true
  if (recordOverLength) return true
  if (!widened) return false

  return (
    sections.length > 0 ||
    hasDrift(drift) ||
    hasStatesMismatch(wireframes) ||
    hasSketchWithEvidence(wireframes)
  )
}
