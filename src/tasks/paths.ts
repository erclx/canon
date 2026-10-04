import { sep } from 'node:path'

/**
 * Whether a resolved path is the directory itself or sits inside it. The
 * separator guard is the whole of it: a bare prefix test reads
 * `.claude/plans-archive` as living under `.canon/plans`, which is a sibling
 * rather than a child and is exactly the pair the plan folders spell.
 *
 * It lives at the root rather than beside either caller because both resolve
 * plan paths and only one of them may reach `src/tasks/archive.ts`, whose
 * index regeneration pulls in a Bun-only import that a test running under
 * Vitest cannot load.
 */
export function isUnder(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}${sep}`)
}
