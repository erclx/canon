/**
 * The folder linked worktrees sit under. A listener there belongs to another
 * branch even though its cwd sits inside the main checkout's toplevel.
 */
const LINKED_WORKTREES = '.claude/worktrees'

function isInside(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`)
}

/**
 * Whether a process running in `cwd` serves this worktree. A tool that
 * changes into a subfolder before listening still counts, while a sibling
 * worktree nested under the main checkout's `.claude/worktrees/` does not.
 */
export function belongsTo(cwd: string, worktreeRoot: string): boolean {
  return (
    isInside(cwd, worktreeRoot) &&
    !isInside(cwd, `${worktreeRoot}/${LINKED_WORKTREES}`)
  )
}
