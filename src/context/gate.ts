import type {
  ExtraSectionFinding,
  LengthFinding,
  SectionFinding,
  ShapeFinding,
} from '@/context/audit'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  type CoverageReport,
  hasCoverageFindings,
  readGateKeys,
} from '@/context/coverage'
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
  /** Entries past the line checkpoint, exempt ones included. */
  readonly length: readonly LengthFinding[]
  /**
   * Whether the project set `gate-length`, which turns an entry past the
   * checkpoint with no exemption into a gating finding under `--gate`.
   */
  readonly gateLength: boolean
  /**
   * Faults in the project's gate keys: a key declared in the wrong shape, or
   * a declared `gated` prefix naming nothing on disk. Each gates under `--gate`,
   * since a project that wrote the key meant it and a silent pass would hide
   * the typo.
   */
  readonly gateKeyFaults: readonly string[]
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
 * `--gate` adds the findings answerable from the file itself, each named on
 * `GateInput`. Entry length is a judgment unless the project set
 * `gate-length`, and depth, bullet, table, and provenance never gate.
 */
export function isGating({
  unresolvedCitations,
  requirementsOverWords,
  sections,
  extraSections,
  shape,
  drift,
  coverage,
  length,
  gateLength,
  gateKeyFaults,
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
    hasCoverageFindings(coverage) ||
    (gateLength && length.some((finding) => finding.exempt === null)) ||
    gateKeyFaults.length > 0
  )
}

/** The context folders a project can carry, one per surface root. */
export const CONTEXT_FOLDERS: readonly string[] = [
  join('canon', 'context'),
  join('.claude', 'context'),
]

/** Whether `root` carries a context folder under either surface root. */
export function hasContextFolder(root: string): boolean {
  return CONTEXT_FOLDERS.some((folder) => existsSync(join(root, folder)))
}

/**
 * Whether a project opted into the widened gate in its context config, by
 * declaring `gated` with any value or setting `gate-length` to true. A key
 * declared in a shape the audit cannot use counts as declared, so `--gate`
 * reports the fault rather than a plain audit passing over it.
 */
export function declaresContextGate(root: string): boolean {
  const keys = readGateKeys(root)
  return keys.gated !== null || keys.gateLength || keys.invalid.length > 0
}
