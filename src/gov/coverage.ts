import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { listRepositoryFiles } from '@/git/files'
import { canonRulesDir } from '@/gov/install'
import { parseFrontmatter } from '@/indexes/frontmatter'
import type { RuleCoverage, SyncChange } from '@/sync/engine'

/** Rule folder whose rules govern rendered output. */
const UI_FOLDER = 'ui'

/**
 * One record per rule the sync copied, in apply order, and none for a delete.
 * `files` is undefined when git cannot list the target, and listing runs once
 * for all rules, so a large target costs one git call.
 */
export async function readCoverage(
  target: string,
  changes: readonly SyncChange[],
): Promise<RuleCoverage[]> {
  const written = changes.filter((change) => change.kind === 'copy')
  if (written.length === 0) return []

  const listed = await listRepositoryFiles(target)
  const rulesDir = canonRulesDir(target)

  return written.map((change) => {
    const paths = declaredPaths(change.dest)
    return {
      rule: change.rel,
      paths,
      files: listed === undefined ? undefined : countMatches(listed, paths),
      ui: relative(rulesDir, change.dest).split(/[\\/]/)[0] === UI_FOLDER,
    }
  })
}

/** An unreadable file or an unparseable frontmatter reads as always loaded. */
function declaredPaths(path: string): string[] {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return []
  }

  const paths = parseFrontmatter(text)?.fields.paths
  if (!Array.isArray(paths)) return []
  return paths.filter((entry): entry is string => typeof entry === 'string')
}

function countMatches(
  files: readonly string[],
  paths: readonly string[],
): number {
  if (paths.length === 0) return 0

  const globs = paths.map((path) => new Bun.Glob(path))
  return files.filter((file) => globs.some((glob) => glob.match(file))).length
}
