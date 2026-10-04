import { $ } from 'bun'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'
import { gitEnv } from '@/git-env'
import { readReviewed } from '@/records/stale'
import { surfaceDir } from '@/surface-root'

/** The two records whose drift is identity rather than a stale path. */
const CANONICAL_DOCS = ['REQUIREMENTS.md', 'ARCHITECTURE.md'] as const

export interface CanonicalDoc {
  /** Relative to the root, at whichever surface root carries the doc. */
  readonly path: string
  /** `YYYY-MM-DD`, or null when the doc carries no readable review date. */
  readonly reviewed: string | null
  /** The raw value of a `reviewed` field that is not a date, present only then. */
  readonly invalidReviewed?: string
  /** Release tags merged into HEAD after the reviewed day, or null when never reviewed. */
  readonly releasesSince: number | null
  /** The newest release tag merged into HEAD, or null when there is none. */
  readonly latestRelease: string | null
}

export interface CanonicalReport {
  readonly ok: true
  readonly root: string
  /** False when HEAD has merged no tag, so a zero count measured nothing. */
  readonly tagged: boolean
  readonly docs: readonly CanonicalDoc[]
}

export interface CanonicalRefused {
  readonly ok: false
  readonly reason: 'unreadable-tags'
  readonly message: string
}

export type CanonicalOutcome = CanonicalReport | CanonicalRefused

interface Release {
  readonly tag: string
  readonly day: string
}

/**
 * Every tag HEAD has merged, newest first, with the day it was created.
 *
 * The creator date is the tagging date on an annotated tag and the commit date
 * on a lightweight one, so a history mixing both counts by two clocks.
 */
async function mergedReleases(root: string): Promise<Release[] | undefined> {
  // Interpolated rather than inline, since Bun's shell parses the bare
  // parentheses in `%(refname)` as syntax of its own.
  const args = [
    '--merged',
    'HEAD',
    '--sort=-creatordate',
    '--format=%(creatordate:short) %(refname:short)',
    'refs/tags',
  ]
  const result = await $`git -C ${root} for-each-ref ${args}`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (result.exitCode !== 0) return undefined

  return result.stdout
    .toString()
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [day, tag] = line.trim().split(' ')
      return { day, tag }
    })
}

/**
 * Reports when each canonical doc was last reviewed and how many releases
 * have shipped since, read from an optional `reviewed:` frontmatter field.
 *
 * The review point is a date rather than a commit, since a commit written on a
 * feature branch never reaches a trunk that squash-merges. A release tagged on
 * the reviewed day itself is not counted, as the review is read as covering
 * that day. It reports and never writes.
 */
export async function staleCanonical(root: string): Promise<CanonicalOutcome> {
  const releases = await mergedReleases(root)

  if (releases === undefined) {
    return {
      ok: false,
      reason: 'unreadable-tags',
      message: `Could not read the release tags at ${root}, so no count can be taken.`,
    }
  }

  const latestRelease = releases[0]?.tag ?? null
  const present = CANONICAL_DOCS.map((entry) => surfaceDir(root, entry)).filter(
    (path) => existsSync(path),
  )

  const docs = await Promise.all(
    present.map(async (path): Promise<CanonicalDoc> => {
      const text = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n')
      const review = readReviewed(text)
      const { reviewed } = review

      return {
        path: relative(root, path),
        ...review,
        releasesSince:
          reviewed === null
            ? null
            : releases.filter((release) => release.day > reviewed).length,
        latestRelease,
      }
    }),
  )

  return { ok: true, root, tagged: releases.length > 0, docs }
}
