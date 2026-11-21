/**
 * Repository-resolution variables git reads from the environment. A hook exports
 * them and they beat `-C`, so a scoped command would silently report a tree
 * nobody asked about. `GIT_PREFIX` re-anchors a relative pathspec.
 */
const RESOLUTION_VARS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
]

/**
 * Returns the ambient environment with git's repository-resolution variables
 * removed, so `git -C <path>` resolves against `<path>` alone. Read per call,
 * since a long-lived process can have these set after import.
 */
export function gitEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => value !== undefined && !RESOLUTION_VARS.includes(key),
    ),
  ) as Record<string, string>
}
