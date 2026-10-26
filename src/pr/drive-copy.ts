import {
  cpSync,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'

/** Where a project names the folders its running preview saves into. */
export const PREVIEW_CONFIG_REL = join('canon', 'config', 'preview.json')

/** The variable a preview server reads for the copy root when the project names none. */
export const DEFAULT_PREVIEW_ENV = 'CANON_PREVIEW_ROOT'

/** The type vocabulary of `git-branch`'s branch standard, which the slug transform drops. */
const BRANCH_TYPES = new Set([
  'feat',
  'fix',
  'refactor',
  'docs',
  'chore',
  'perf',
  'test',
  'style',
  'build',
  'ci',
  'revert',
])

export interface PreviewConfig {
  readonly writes: readonly string[]
  readonly env: string
  /** Paths inside a declared path that a rebuild leaves as the server wrote them. */
  readonly keep: readonly string[]
}

export type PreviewConfigRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'read'; readonly config: PreviewConfig }
  | {
      readonly kind: 'refused'
      readonly reason: 'bad-config' | 'unsafe-path'
      readonly detail: string
    }

/**
 * The branch-to-slug transform every branch-derived name shares: a leading
 * type segment comes off when a further segment follows it, and each
 * remaining `/` becomes `-`. The worker reads its branch off the worktree and
 * the reviewer off the pull request's head ref, so this one function is what
 * lands both on the same folder.
 */
export function branchSlug(branch: string): string {
  const segments = branch.split('/')
  const rest =
    segments.length > 1 && BRANCH_TYPES.has(segments[0] ?? '')
      ? segments.slice(1)
      : segments
  return rest.join('-')
}

function isContained(path: string): boolean {
  return (
    path.length > 0 && !isAbsolute(path) && !path.split(/[\\/]/).includes('..')
  )
}

/** Whether `path` is `parent` or stands below it, both relative to one root. */
function isWithin(path: string, parent: string): boolean {
  const rel = relative(join('/', parent), join('/', path))
  return (
    rel === '' ||
    (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  )
}

/**
 * Reads `canon/config/preview.json` as
 * `{ "writes": [...], "keep": [...], "env": "<NAME>" }`.
 * A file that does not parse refuses rather than reading as absent, since a
 * typo there would otherwise drive the real folders while the pass reports a
 * copy. A `writes` or `keep` path that is absolute or climbs with `..`
 * refuses, so the copy never reads or writes outside its two roots, and a
 * `keep` path outside every `writes` path refuses, since the rebuild would
 * never reach it, and so does one equal to a `writes` path, which would be
 * declared both reset and kept.
 */
export function loadPreviewConfig(worktree: string): PreviewConfigRead {
  const path = join(worktree, PREVIEW_CONFIG_REL)
  if (!existsSync(path)) return { kind: 'absent' }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} does not parse as JSON.`,
    }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} is not an object.`,
    }
  }

  const { writes, env, keep = [] } = parsed as Record<string, unknown>
  if (
    !Array.isArray(writes) ||
    !writes.every((item): item is string => typeof item === 'string')
  ) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} carries no "writes" list of paths.`,
    }
  }
  if (
    !Array.isArray(keep) ||
    !keep.every((item): item is string => typeof item === 'string')
  ) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} names a "keep" that is not a list of paths.`,
    }
  }
  if (env !== undefined && (typeof env !== 'string' || env === '')) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} names an "env" that is not a variable name.`,
    }
  }

  const unsafe = [...writes, ...keep].find((item) => !isContained(item))
  if (unsafe !== undefined) {
    return {
      kind: 'refused',
      reason: 'unsafe-path',
      detail: `${PREVIEW_CONFIG_REL} names "${unsafe}", which leaves the worktree.`,
    }
  }

  const stray = keep.find(
    (item) => !writes.some((path) => isWithin(item, path)),
  )
  if (stray !== undefined) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} keeps "${stray}", which no "writes" path holds.`,
    }
  }

  const clash = keep.find((item) =>
    writes.some((path) => isWithin(item, path) && isWithin(path, item)),
  )
  if (clash !== undefined) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} keeps "${clash}", which is also a "writes" path, so the rebuild would never reset it.`,
    }
  }

  return {
    kind: 'read',
    config: { writes, env: env ?? DEFAULT_PREVIEW_ENV, keep },
  }
}

/**
 * Removes `target` except the `keep` paths at or below it, where `rel` is
 * `target` relative to the root `keep` is read against. A folder holding a
 * kept path is emptied around it rather than removed.
 */
function clearAround(
  target: string,
  rel: string,
  keep: readonly string[],
): void {
  if (keep.includes(rel)) return
  const stat = lstatSync(target, { throwIfNoEntry: false })
  if (stat === undefined) return
  if (!stat.isDirectory() || !keep.some((path) => isWithin(path, rel))) {
    rmSync(target, { recursive: true, force: true })
    return
  }
  for (const entry of readdirSync(target)) {
    clearAround(join(target, entry), join(rel, entry), keep)
  }
}

/**
 * Resets each declared path in the copy from the worktree, so the last pass's
 * drives never reach the next one, and leaves everything else under the copy
 * root as it is. A `keep` path inside a declared path is neither cleared nor
 * copied, since the server running on the copy owns it. A path the worktree
 * does not hold has its stale copy removed and is named rather than failing
 * the copy.
 */
export function buildDriveCopy(
  worktree: string,
  copyRoot: string,
  writes: readonly string[],
  keep: readonly string[] = [],
): { readonly copied: readonly string[]; readonly missing: readonly string[] } {
  const kept = keep.map((path) => relative(worktree, join(worktree, path)))
  const copied: string[] = []
  const missing: string[] = []
  for (const path of writes) {
    const source = join(worktree, path)
    clearAround(join(copyRoot, path), relative(worktree, source), kept)
    if (!existsSync(source)) {
      missing.push(path)
      continue
    }
    cpSync(source, join(copyRoot, path), {
      recursive: true,
      filter: (item) => !kept.includes(relative(worktree, item)),
    })
    copied.push(path)
  }
  return { copied, missing }
}
