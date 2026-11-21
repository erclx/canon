import type { ColonFinding } from '@/markdown/colons'
import type { DensityFinding } from '@/markdown/density'
import type { HeadingCaseFinding } from '@/markdown/heading-case'
import type { LinkFinding } from '@/markdown/links'
import type { ReferenceShapeFinding } from '@/markdown/reference-shape'
import type { BanFinding } from '@/markdown/scan'
import { GATED_PATHS } from '@/markdown/scope'
import type { StructureReport } from '@/markdown/structure'

export interface GatedDensityFinding extends DensityFinding {
  readonly gating: boolean
}

export interface GatedReferenceShapeFinding extends ReferenceShapeFinding {
  readonly gating: boolean
}

export interface GateInput {
  /** Every ban hit across every file measured, flattened. */
  readonly bans: readonly BanFinding[]
  /** Every dead relative link across every file measured, flattened. */
  readonly links: readonly LinkFinding[]
  /**
   * Every structural measure the run made, read by nothing here. Depth weight,
   * cadence, and sentence count are judgments a reader settles, and a push
   * failing on one teaches a contributor to route around the stage.
   */
  readonly structure: readonly StructureReport[]
  /**
   * Every mid-sentence colon the run measured, read by nothing here.
   *
   * A colon is sometimes right and the corpus carries over a thousand
   * candidates, so the measure warns and a push never fails on it.
   */
  readonly colons: readonly ColonFinding[]
  /**
   * Every heading or title with a capital after its first word, read by
   * nothing here. A proper noun is the one case it cannot tell from title
   * case, and gating it would need a names list and an escape marker.
   */
  readonly headingCase: readonly HeadingCaseFinding[]
  /**
   * Every density finding, each marked with whether its path gates. The caller
   * decides the mark from `src/markdown/scope.ts`, since only it knows the path
   * and whether the tree is a canon checkout.
   */
  readonly density: readonly GatedDensityFinding[]
  /**
   * Every reference shape finding, each marked with whether its path gates.
   * Only a page whose frontmatter carries `kind: reference` has any.
   */
  readonly referenceShape: readonly GatedReferenceShapeFinding[]
}

/**
 * Whether the audit found something that should fail the caller. A banned
 * character, a dead relative link, a density finding on a gated path, and a
 * reference shape finding are facts, and the standards decide what counts as banned.
 */
export function isGating({
  bans,
  links,
  density,
  referenceShape,
}: GateInput): boolean {
  return (
    bans.length > 0 ||
    links.length > 0 ||
    density.some((finding) => finding.gating) ||
    referenceShape.some((finding) => finding.gating)
  )
}

/**
 * Whether a reference shape finding on this path fails the run, under the
 * prefixes density gates on. A page is opted in by its own marker, so the
 * density scope and the always-gated bullet run have nothing to add here.
 */
export function referenceShapeGates(
  rel: string,
  gated: readonly string[] = GATED_PATHS,
): boolean {
  return gated.some((prefix) => rel.startsWith(prefix))
}
