import { sep } from 'node:path'

/**
 * Whether a resolved path is the directory itself or sits inside it. The
 * separator guard matters, since a bare prefix test reads `.claude/plans-archive`
 * as under `.canon/plans`. It sits at the root so Vitest never loads `archive.ts`.
 */
export function isUnder(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}${sep}`)
}
