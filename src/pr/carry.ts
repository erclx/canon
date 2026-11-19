import { DESIGN_FOLDER, isEvidencePath } from '@/pr/evidence'
import type { ChangedRead } from '@/pr/lift'
import { DEFAULT_PAINTED, isPainted, type PaintedPatterns } from '@/pr/painted'
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
 * Carries a verdict driven at `from` to `to` only across a gap where no changed
 * path `moves` it. By default that is every path outside the inert set, since a
 * box drives behavior, which lives in any source file and not only in a painted
 * one. A `from` that `to` does not descend from never carries.
 */
export async function readCarry(
  readChanged: (from: string, to: string) => Promise<ChangedRead | undefined>,
  from: string,
  to: string,
  moves: (path: string) => boolean = (path) => !isInert(path),
): Promise<Carry> {
  if (coversHead(from, to)) return { kind: 'covered' }

  const changed = await readChanged(from, to)
  if (changed === undefined) return { kind: 'failed' }
  if (!changed.isAncestor) return { kind: 'not-ancestor' }

  const drivenPaths = changed.paths.filter(moves)
  return drivenPaths.length > 0
    ? { kind: 'moved', drivenPaths }
    : { kind: 'carried', carriedFrom: from }
}

/**
 * How the branch's own change compares at a commit and a head that does not
 * descend from it, each diffed against its own merge base with the base.
 */
export interface RebaseRead {
  readonly differingPaths: readonly string[]
}

/** Whether a verdict holds across a rebase of the branch under it. */
export type RebaseCarry =
  | { readonly kind: 'rebased'; readonly carriedFrom: string }
  | { readonly kind: 'changed'; readonly differingPaths: readonly string[] }
  | { readonly kind: 'unread' }

/**
 * Carries a verdict across a rebase only when no path `moves` differs in the
 * branch's diff. Every path moves by default, which is the code review's rule,
 * so a caller relaxes it only by naming what a verdict cannot observe. A
 * comparison that could not be read carries nothing.
 */
export async function readRebaseCarry(
  readRebased: (from: string, to: string) => Promise<RebaseRead | undefined>,
  from: string,
  to: string,
  moves: (path: string) => boolean = () => true,
): Promise<RebaseCarry> {
  const read = await readRebased(from, to)
  if (read === undefined) return { kind: 'unread' }

  const differingPaths = read.differingPaths.filter(moves)
  return differingPaths.length > 0
    ? { kind: 'changed', differingPaths }
    : { kind: 'rebased', carriedFrom: from }
}

/**
 * Which changed paths move a reel. A painted path always does, tested ahead of
 * the inert set, since a fixture a reel films sits in a folder that set
 * exempts. A project declaring `reelInputs` names what a reel reads beyond the
 * painted set, so any other source change leaves the pixels alone. With no
 * declaration, every path outside the inert set moves it too.
 */
export function reelMoves(painted: PaintedPatterns): (path: string) => boolean {
  const { reelInputs } = painted
  const reads =
    reelInputs === undefined
      ? (path: string) => !isInert(path)
      : (path: string) =>
          reelInputs.some((glob) => new Bun.Glob(glob).match(path))
  return (path) => isPainted(path, painted) || reads(path)
}
