import type { SectionFinding } from '@/context/audit'
import type { FolderDrift } from '@/context/index-drift'

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
  /**
   * Whether the record holds more decisions than the cap it states, which
   * gates under the same two modes and is false in the same two cases.
   */
  readonly recordOverCount: boolean
  /**
   * Whether a decision lacks the revisit sentence the record requires of
   * every decision, which gates under the same two modes and is false in the
   * same two cases, plus a record stating no such clause.
   */
  readonly recordMissingRevisit: boolean
  /**
   * Whether a decision holds more words than the cap the record states, which
   * gates under the same two modes and is false in the same two cases, plus a
   * record stating no word cap.
   */
  readonly recordOverWords: boolean
  /** The same reading for the Risks section's bullet cap. */
  readonly recordOverRisks: boolean
  /**
   * Whether the requirements record holds more words than the cap it states,
   * which gates for the reason the architecture record's caps do.
   */
  readonly requirementsOverWords: boolean
  readonly sections: readonly SectionFinding[]
  readonly drift: readonly FolderDrift[]
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

/**
 * Whether the audit found something that should fail the caller.
 *
 * An unresolved citation is a broken pointer and gates unconditionally, and so
 * does a record past its own ceiling, entry cap, word cap, or bullet cap, or
 * missing a revisit sentence it requires, and a requirements record past its
 * own word cap: each record states its rules for itself, which makes those the
 * measures here that are facts
 * rather than thresholds a reader weighs. The findings `--gate` adds are
 * the ones answerable from the file itself: a required section it does not
 * declare, and an index disagreeing with its folder. Entry length, depth, bullet,
 * table, provenance, and the record's claim coverage are judgments, so they
 * stay out under both modes.
 */
export function isGating({
  unresolvedCitations,
  recordOverLength,
  recordOverCount,
  recordMissingRevisit,
  recordOverWords,
  recordOverRisks,
  requirementsOverWords,
  sections,
  drift,
  widened,
}: GateInput): boolean {
  if (unresolvedCitations > 0) return true
  if (
    recordOverLength ||
    recordOverCount ||
    recordMissingRevisit ||
    recordOverWords ||
    recordOverRisks ||
    requirementsOverWords
  ) {
    return true
  }
  if (!widened) return false

  return sections.length > 0 || hasDrift(drift)
}
