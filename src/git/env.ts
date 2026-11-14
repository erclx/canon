/**
 * Repository-resolution variables git reads from the environment.
 *
 * A git hook exports these into every process it runs, and they take
 * precedence over `-C`. A command scoped to a subtree then silently reads
 * whatever the hook's repository points at and reports figures for a tree
 * nobody asked about, which is worse than failing because the output looks
 * ordinary. `GIT_PREFIX` is here for the same reason: it re-anchors a relative
 * pathspec to the directory the hook was invoked from.
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
 * removed, so `git -C <path>` resolves against `<path>` and nothing else.
 *
 * Read per call rather than captured at module load, since a long-lived process
 * can have these set after import. Hooks export `GIT_DIR`, `GIT_WORK_TREE`,
 * `GIT_INDEX_FILE`, and `GIT_PREFIX`, which beat `-C`, so an inherited one
 * resolves a read against the wrong repository and lets a fixture's config
 * write reach the real one. Route every shelled call through this, fixtures
 * included.
 */
export function gitEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => value !== undefined && !RESOLUTION_VARS.includes(key),
    ),
  ) as Record<string, string>
}
