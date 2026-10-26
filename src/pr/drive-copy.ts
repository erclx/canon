import { createHash } from 'node:crypto'
import { cpSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'

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

export interface StatusEntry {
  readonly path: string
  readonly status: string
  /** The content digest, or null where no regular file stands at the path. */
  readonly digest: string | null
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
 * never reach it.
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

  return {
    kind: 'read',
    config: { writes, env: env ?? DEFAULT_PREVIEW_ENV, keep },
  }
}

/**
 * Replaces the copy root with a fresh copy of each declared path, so the last
 * pass's drives never reach the next one. A path the worktree does not hold
 * is named rather than failing the copy.
 */
export function buildDriveCopy(
  worktree: string,
  copyRoot: string,
  writes: readonly string[],
): { readonly copied: readonly string[]; readonly missing: readonly string[] } {
  rmSync(copyRoot, { recursive: true, force: true })
  const copied: string[] = []
  const missing: string[] = []
  for (const path of writes) {
    const source = join(worktree, path)
    if (!existsSync(source)) {
      missing.push(path)
      continue
    }
    cpSync(source, join(copyRoot, path), { recursive: true })
    copied.push(path)
  }
  return { copied, missing }
}

function digestOf(path: string): string | null {
  try {
    if (!statSync(path).isFile()) return null
    return createHash('sha1').update(readFileSync(path)).digest('hex')
  } catch {
    return null
  }
}

/**
 * Every entry `git status` reports, untracked files listed one by one so a
 * file a drive adds inside a tracked folder names itself, each with a content
 * digest so a file already dirty at the baseline still reads as changed when
 * a drive writes it again. Undefined when git cannot read the tree.
 */
export async function readWorktreeStatus(
  worktree: string,
): Promise<readonly StatusEntry[] | undefined> {
  const result =
    await $`git -C ${worktree} status --porcelain=v1 -z --untracked-files=all`
      .env(gitEnv())
      .quiet()
      .nothrow()
  if (result.exitCode !== 0) return undefined

  const tokens = result.stdout.toString().split('\0')
  const entries: StatusEntry[] = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] ?? ''
    if (token.length < 4) continue
    const status = token.slice(0, 2)
    const path = token.slice(3)
    // A rename or copy carries its source as the next token.
    if (status.includes('R') || status.includes('C')) index++
    entries.push({ path, status, digest: digestOf(join(worktree, path)) })
  }
  return entries
}

/**
 * The paths whose status or content differs from the baseline, in the order
 * git reports them. An entry gone since the baseline is not reported, since a
 * worker committing its own edit mid-pass clears it the same way.
 */
export function changedSince(
  baseline: readonly StatusEntry[],
  current: readonly StatusEntry[],
): readonly string[] {
  const before = new Map(baseline.map((entry) => [entry.path, entry]))
  return current
    .filter((entry) => {
      const prior = before.get(entry.path)
      return (
        prior === undefined ||
        prior.status !== entry.status ||
        prior.digest !== entry.digest
      )
    })
    .map((entry) => entry.path)
}
