import type {
  ExtraSectionFinding,
  SectionFinding,
  ShapeFinding,
} from '@/context/audit'
import { type CoverageReport, hasCoverageFindings } from '@/context/coverage'
import type { FolderDrift } from '@/context/index-drift'

export interface GateInput {
  /** Cited paths that resolved to nothing, which gate under either mode. */
  readonly unresolvedCitations: number
  /**
   * Whether the requirements record holds more words than the cap it states,
   * which gates under either mode for the reason a citation does. False when
   * the project carries no record and false under `--citations-only`, which
   * never measures it. That mode runs one check by construction, so widening
   * it here would gate on a reading it never took.
   */
  readonly requirementsOverWords: boolean
  readonly sections: readonly SectionFinding[]
  /** H2 headings outside a folder's closed set, gating under `--gate` alone. */
  readonly extraSections: readonly ExtraSectionFinding[]
  /**
   * Section shape breaks, gating under `--gate` only where the finding is
   * marked gated, so an unrebuilt entry reports and never fails a push.
   */
  readonly shape: readonly ShapeFinding[]
  readonly drift: readonly FolderDrift[]
  /**
   * Folders under the declared code roots that no Layout names or two entries
   * claim, gating under `--gate` alone. A project with no code root reads as
   * not measured and never gates.
   */
  readonly coverage: CoverageReport
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
 * does a requirements record past its own word cap: the record states its rule
 * for itself, which makes it a fact rather than a threshold a reader weighs.
 * The findings `--gate` adds are the ones answerable from the file itself: a
 * required section it does not declare, an H2 outside the closed set, a shape
 * break in a folder rebuilt to the shape, an index disagreeing with its
 * folder, and a code folder no entry names or two entries claim. Entry length, depth, bullet, table, provenance, and the record's
 * claim coverage are judgments, so they stay out under both modes.
 */
export function isGating({
  unresolvedCitations,
  requirementsOverWords,
  sections,
  extraSections,
  shape,
  drift,
  coverage,
  widened,
}: GateInput): boolean {
  if (unresolvedCitations > 0) return true
  if (requirementsOverWords) return true
  if (!widened) return false

  return (
    sections.length > 0 ||
    extraSections.length > 0 ||
    shape.some((finding) => finding.gated) ||
    hasDrift(drift) ||
    hasCoverageFindings(coverage)
  )
}
