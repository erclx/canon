import { DESIGN_FOLDER, isEvidencePath } from '@/pr/evidence'
import type { ChangedRead } from '@/pr/lift'
import { DEFAULT_PAINTED, isPainted, type PaintedPatterns } from '@/pr/painted'
import { coversHead } from '@/pr/review-scope'

/**
 * The globs no checklist box can observe. Listing the inert rather than the
 * driven makes an unlisted kind, such as a `.json` data file, fail closed, and
 * markdown outside the docs folders renders, so it is driven like `.mdx`.
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
 * Carries a verdict from `from` to `to` only across a gap no changed path
 * `moves`, by default any path outside the inert set, since behavior lives in
 * any source file. A `from` that `to` does not descend from never carries.
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
 * branch's diff. Every path moves by default, the code review's rule, and a
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

/** Whether a UI verdict at one commit holds at the head, across a push or a rebase. */
export type UiCarry =
  | { readonly kind: 'covered' }
  | {
      readonly kind: 'carried'
      readonly carriedFrom: string
      readonly carriedAcross: 'push' | 'rebase'
    }
  | { readonly kind: 'moved'; readonly drivenPaths: readonly string[] }
  | { readonly kind: 'behind' }
  | { readonly kind: 'failed' }

/**
 * The rule the UI gate and the tick share, so neither passes a head the other
 * refuses. A rebase carries when every differing branch path is inert, and an
 * unreadable comparison reads `behind`.
 */
export async function readUiCarry(
  reads: {
    readonly readChanged: (
      from: string,
      to: string,
    ) => Promise<ChangedRead | undefined>
    readonly readRebased: (
      from: string,
      to: string,
    ) => Promise<RebaseRead | undefined>
  },
  from: string,
  to: string,
): Promise<UiCarry> {
  const carry = await readCarry(reads.readChanged, from, to)
  if (carry.kind === 'carried') return { ...carry, carriedAcross: 'push' }
  if (carry.kind !== 'not-ancestor') return carry

  const moves = (path: string) => !isInert(path)
  const rebase = await readRebaseCarry(reads.readRebased, from, to, moves)
  if (rebase.kind === 'rebased') {
    return {
      kind: 'carried',
      carriedFrom: rebase.carriedFrom,
      carriedAcross: 'rebase',
    }
  }
  return rebase.kind === 'changed'
    ? { kind: 'moved', drivenPaths: rebase.differingPaths }
    : { kind: 'behind' }
}

/**
 * Which changed paths move a reel. A painted path always does, ahead of the
 * inert set, since a filmed fixture sits in a folder that set exempts. Declared
 * `reelInputs` name the rest, and with none every non-inert path moves it.
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
