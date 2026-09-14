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
   * `canon/wireframes/` folder. A states/evidence mismatch is a fact read off
   * the file, the same standing the missing-section and index-drift findings
   * already have, so it gates alongside them under the widened mode.
   *
   * A sketch beside existing evidence stays out of the gate on both modes.
   * `sketchWithEvidence` reads the whole entry against whether any of its
   * states has evidence, not the sketched layout against the evidence for
   * that same layout, since the standard's `## States` table names states
   * rather than layouts and the report has no narrower unit to match on. An
   * entry with a captured default layout and a sketch for a breakpoint layout
   * that is not built yet is conforming and still trips this reading, so the
   * finding stays a judgment for a reader rather than a fact a push fails on.
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
 * declare, an index disagreeing with its folder, and a wireframe's States
 * table disagreeing with its evidence folders. Entry length, depth, bullet,
 * table, provenance, the record's claim coverage, and a sketch beside
 * existing evidence are judgments, so they stay out under both modes. The
 * `wireframes` field's own doc states why the sketch finding is a judgment
 * rather than a fact.
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

  return sections.length > 0 || hasDrift(drift) || hasStatesMismatch(wireframes)
}
