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
  '**/e2e/capture/**/*.ts',
  '**/e2e/screenshot.ts',
  '**/e2e/capture-types.ts',
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
  /** Every path the branch wrote at either commit, differing or not. */
  readonly ownPaths: readonly string[]
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

/** How a close reached a head it was not read at. */
export type CarriedAcross = 'push' | 'rebase' | 'merge'

/** Whether a verdict holds across merges of the base into the branch. */
export type MergeCarry =
  | { readonly kind: 'merged'; readonly carriedFrom: string }
  | { readonly kind: 'changed'; readonly differingPaths: readonly string[] }
  | { readonly kind: 'unmerged' }
  | { readonly kind: 'unread' }

/** What a carry across merges reads: the commits on top, and the branch's own diff. */
interface MergeReads {
  readonly readUnmerged: (
    from: string,
    to: string,
  ) => Promise<readonly string[] | undefined>
  readonly readRebased: (
    from: string,
    to: string,
  ) => Promise<RebaseRead | undefined>
}

/**
 * Carries a code review close across commits on top of it only when each is a
 * merge or already on the base, and the branch's own diff is equal at both
 * ends. Any commit of the branch's own refuses before the diff is read.
 */
export async function readMergeCarry(
  reads: MergeReads,
  from: string,
  to: string,
): Promise<MergeCarry> {
  const unmerged = await reads.readUnmerged(from, to)
  if (unmerged === undefined) return { kind: 'unread' }
  if (unmerged.length > 0) return { kind: 'unmerged' }

  const rebase = await readRebaseCarry(reads.readRebased, from, to)
  if (rebase.kind === 'rebased') {
    return { kind: 'merged', carriedFrom: rebase.carriedFrom }
  }
  return rebase
}

/** Whether a UI verdict at one commit holds at the head, and how it got there. */
export type UiCarry =
  | { readonly kind: 'covered' }
  | {
      readonly kind: 'carried'
      readonly carriedFrom: string
      readonly carriedAcross: CarriedAcross
    }
  | { readonly kind: 'moved'; readonly drivenPaths: readonly string[] }
  | { readonly kind: 'behind' }
  | { readonly kind: 'failed' }

/**
 * The rule the UI gate and the tick share, so neither passes a head the other
 * refuses. A rebase or a merge of the base carries when every path it moved is
 * inert, and an unreadable comparison reads `behind`.
 */
export async function readUiCarry(
  reads: MergeReads & {
    readonly readChanged: (
      from: string,
      to: string,
    ) => Promise<ChangedRead | undefined>
  },
  from: string,
  to: string,
): Promise<UiCarry> {
  const carry = await readCarry(reads.readChanged, from, to)
  if (carry.kind === 'carried') return { ...carry, carriedAcross: 'push' }
  if (carry.kind === 'moved') {
    return readUiMergeCarry(reads, carry, from, to)
  }
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
 * Narrows a push's driven paths to the branch's own across merges of the base.
 * A path both sides wrote stays driven, since a clean merge can still change
 * what it draws. Any commit of the branch's own keeps the whole list.
 */
async function readUiMergeCarry(
  reads: MergeReads,
  pushed: { readonly kind: 'moved'; readonly drivenPaths: readonly string[] },
  from: string,
  to: string,
  moves: (path: string) => boolean = (path) => !isInert(path),
): Promise<UiCarry> {
  const unmerged = await reads.readUnmerged(from, to)
  if (unmerged === undefined || unmerged.length > 0) return pushed

  const read = await reads.readRebased(from, to)
  if (read === undefined) return { kind: 'behind' }

  const bothWrote = pushed.drivenPaths.filter((path) =>
    read.ownPaths.includes(path),
  )
  const differing = read.differingPaths.filter(moves)
  const drivenPaths = [...new Set([...differing, ...bothWrote])].toSorted()
  return drivenPaths.length > 0
    ? { kind: 'moved', drivenPaths }
    : { kind: 'carried', carriedFrom: from, carriedAcross: 'merge' }
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

/**
 * Whether a reel filmed at one commit holds at the head: across pushes that
 * move no reel path, or merges of the base narrowed to the branch's own paths
 * as the UI close is. A rebase never carries, since the commit was rewritten.
 */
export async function readReelCarry(
  reads: MergeReads & {
    readonly readChanged: (
      from: string,
      to: string,
    ) => Promise<ChangedRead | undefined>
  },
  painted: PaintedPatterns,
  from: string,
  to: string,
): Promise<Carry> {
  const moves = reelMoves(painted)
  const carry = await readCarry(reads.readChanged, from, to, moves)
  if (carry.kind !== 'moved') return carry

  const merged = await readUiMergeCarry(reads, carry, from, to, moves)
  if (merged.kind === 'carried') {
    return { kind: 'carried', carriedFrom: merged.carriedFrom }
  }
  return merged.kind === 'moved' ? merged : carry
}
