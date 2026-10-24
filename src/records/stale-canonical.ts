import { $ } from 'bun'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'
import { gitEnv } from '@/git/env'
import { surfaceDir } from '@/roots/surface'

/** The record whose drift is identity rather than a stale path. */
const CANONICAL_DOCS = ['REQUIREMENTS.md', 'DESIGN.md'] as const

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

const REVIEWED_FIELD = /^reviewed:[ \t]*(.*?)[ \t]*$/m
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const RAW_FRONTMATTER = /^---\n([\s\S]*?)\n---/

/**
 * Reads `reviewed` off the raw block rather than the parsed fields, for the
 * reason `hasOpeningDate` in the validator gives: a YAML parser resolves a
 * bare `YYYY-MM-DD` to a date on one schema and a string on another.
 *
 * A value that is not a calendar date reads as never reviewed and is carried
 * back so the review can see it, rather than throwing over one hand edit.
 */
function readReviewed(
  text: string,
): Pick<CanonicalDoc, 'reviewed' | 'invalidReviewed'> {
  const block = RAW_FRONTMATTER.exec(text)?.[1]
  const match = block ? REVIEWED_FIELD.exec(block) : null
  if (!match) return { reviewed: null }

  const value = match[1].replace(/^(['"])(.*)\1$/, '$2')
  const parsed = Date.parse(`${value}T00:00:00Z`)
  const isDate =
    ISO_DATE.test(value) &&
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value

  return isDate
    ? { reviewed: value }
    : { reviewed: null, invalidReviewed: value }
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
 * A tag ending in a dotted version, bare or behind a component prefix such as
 * `canon-v2.1.0`. An eval, deploy, or snapshot tag on the trunk names no
 * release and would otherwise inflate the count.
 */
const RELEASE_TAG = /(?:^|[-/@_])v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/

/**
 * A repository before its first commit has no HEAD for `--merged` to resolve,
 * which git reports as a failed read. It has no tags either, so it reads as an
 * empty history rather than an unreadable one.
 */
async function isUnborn(root: string): Promise<boolean> {
  const [gitDir, head] = await Promise.all([
    $`git -C ${root} rev-parse --git-dir`.env(gitEnv()).quiet().nothrow(),
    $`git -C ${root} rev-parse --verify -q HEAD`
      .env(gitEnv())
      .quiet()
      .nothrow(),
  ])
  return gitDir.exitCode === 0 && head.exitCode !== 0
}

/**
 * Every release tag HEAD has merged, newest first, with the day it was created.
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
  if (result.exitCode !== 0) return (await isUnborn(root)) ? [] : undefined

  return result.stdout
    .toString()
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [day, tag] = line.trim().split(' ')
      return { day, tag }
    })
    .filter((release) => RELEASE_TAG.test(release.tag))
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
