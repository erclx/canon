import { DESIGN_FOLDER, isEvidencePath } from '@/pr/evidence'
import type { ChangedRead } from '@/pr/lift'
import { DEFAULT_PAINTED } from '@/pr/painted'
import { coversHead } from '@/pr/review-scope'

/**
 * The globs no checklist box can observe: tests, stories, snapshots, and
 * markdown where a project keeps docs. The rule lists what is inert rather than
 * what is driven, so a kind nobody listed, such as a `.json` data file, fails
 * closed. Markdown elsewhere, such as an Astro page or content entry, renders,
 * so it is driven like `.mdx`.
 */
export const DEFAULT_INERT: readonly string[] = [
  ...DEFAULT_PAINTED.unpainted,
  '*.md',
  'canon/**/*.md',
  '.claude/**/*.md',
  '.github/**/*.md',
  'docs/**/*.md',
]

/**
 * An evidence capture and a design record are inert too, the two paths
 * `readUncaptured` skips, since a recapture or a design note changes no
 * behavior a box drives.
 */
export function isInert(path: string): boolean {
  return (
    isEvidencePath(path) ||
    path.startsWith(DESIGN_FOLDER) ||
    DEFAULT_INERT.some((glob) => new Bun.Glob(glob).match(path))
  )
}

/** Whether a UI verdict at one commit still holds at a later one. */
export type Carry =
  | { readonly kind: 'covered' }
  | { readonly kind: 'carried'; readonly carriedFrom: string }
  | { readonly kind: 'moved'; readonly drivenPaths: readonly string[] }
  | { readonly kind: 'not-ancestor' }
  | { readonly kind: 'failed' }

/**
 * Carries a verdict driven at `from` to `to` only across a gap that changed
 * nothing a box drives. A box drives behavior, which lives in any source file
 * and not only in a painted one, so every path outside the inert set moves the
 * verdict. A `from` that `to` does not descend from never carries.
 */
export async function readCarry(
  readChanged: (from: string, to: string) => Promise<ChangedRead | undefined>,
  from: string,
  to: string,
): Promise<Carry> {
  if (coversHead(from, to)) return { kind: 'covered' }

  const changed = await readChanged(from, to)
  if (changed === undefined) return { kind: 'failed' }
  if (!changed.isAncestor) return { kind: 'not-ancestor' }

  const drivenPaths = changed.paths.filter((path) => !isInert(path))
  return drivenPaths.length > 0
    ? { kind: 'moved', drivenPaths }
    : { kind: 'carried', carriedFrom: from }
}
