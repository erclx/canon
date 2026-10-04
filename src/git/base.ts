/**
 * Preferred first, matching `src/tasks/trunk.ts`. A local `main` trailing the
 * remote pulls other people's merged commits into the range, so a check
 * reading it decides against files the branch never touched.
 */
export const TRUNK_REFS = ['origin/main', 'main'] as const

/**
 * The refs to try, in order, for the far side of a branch range: a named ref
 * alone, or the trunk list when none was named.
 */
export function baseCandidates(ref: string | undefined): readonly string[] {
  return ref !== undefined ? [ref] : TRUNK_REFS
}

/** Whether a `merge-base` result names a commit rather than an empty read. */
export function isMergeBase(value: string | undefined): value is string {
  return value !== undefined && value !== ''
}
