import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import { compareVersions } from '@/upstream/cursor'

const RELEASES_URL =
  'https://api.github.com/repos/anthropics/claude-code/releases'
const PER_PAGE = 100
const MAX_PAGES = 10

/** The subset of a GitHub release the digest reads. */
export interface Release {
  readonly tag_name: string
  readonly published_at: string
  readonly body: string | null
  readonly draft?: boolean
}

export interface ReleaseLine {
  readonly version: string
  readonly date: string
  readonly text: string
}

export type FetchFailure = 'rate-limited' | 'network' | 'http'

export type PageResult =
  | { readonly ok: true; readonly releases: readonly Release[] }
  | {
      readonly ok: false
      readonly reason: FetchFailure
      readonly message: string
    }

/** Page numbers start at 1. A page past the feed's end comes back empty. */
export type PageFetcher = (page: number) => Promise<PageResult>

export type Walk =
  | { readonly kind: 'reached'; readonly releases: readonly Release[] }
  | { readonly kind: 'cursor-missing'; readonly cursor: string }
  | {
      readonly kind: 'failed'
      readonly reason: FetchFailure
      readonly message: string
    }

// Ported from the groundwork's mechanical-drop script. The first group anchors on the line
// start, the rest match anywhere because the surface they name can sit mid-line.
const DROP =
  /^(Fixed|\[VSCode\]|\[Claude Tag\]|\[Code Review\]|Windows:|Self-hosted)|apps gateway|managed setting|OpenTelemetry|Bedrock|Vertex|screen reader/i
const KEEP = /^(Added|Changed|Removed|Improved|Deprecated)/
const BULLET = /^\s*[-*] (.*)$/gm
const DIFFERENCE_LINE = /^(\[[^\]]+\] )?(Changed|Removed|Deprecated)/
const BACKTICKED = /`([^`]{3,60})`/g
const DISTINCTIVE = /[-/.A-Z]/

export function versionOf(tag: string): string {
  return tag.replace(/^v/, '')
}

export function keepLines(release: Release): ReleaseLine[] {
  const version = versionOf(release.tag_name)
  const date = release.published_at.slice(0, 10)

  return [...(release.body ?? '').matchAll(BULLET)]
    .map((match) => match[1] ?? '')
    .filter((text) => KEEP.test(text) && !DROP.test(text))
    .map((text) => ({ version, date, text }))
}

export function extractIdentifiers(text: string): string[] {
  if (!DIFFERENCE_LINE.test(text)) return []

  return [...text.matchAll(BACKTICKED)]
    .map((match) => match[1] ?? '')
    .filter((name) => DISTINCTIVE.test(name))
}

/**
 * Collects the releases newer than the cursor, newest first.
 *
 * The walk stops at the first release whose version is not newer than the
 * cursor, wherever it sits, so a range crossing a page boundary is read whole
 * and a cursor naming a version the feed never carried, as 2.1.256 is not,
 * still bounds the range. A feed that ends with every release newer than the
 * cursor reports `cursor-missing` instead of returning all of it.
 */
export async function walkReleases(
  cursor: string,
  fetchPage: PageFetcher,
  perPage: number = PER_PAGE,
): Promise<Walk> {
  const collected: Release[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchPage(page)
    if (!result.ok) {
      return { kind: 'failed', reason: result.reason, message: result.message }
    }

    for (const release of result.releases) {
      if (release.draft) continue
      if (compareVersions(versionOf(release.tag_name), cursor) <= 0) {
        return { kind: 'reached', releases: collected }
      }
      collected.push(release)
    }

    if (result.releases.length < perPage) break
  }

  return { kind: 'cursor-missing', cursor }
}

export function githubPageFetcher(
  env: Record<string, string | undefined> = process.env,
  signal?: AbortSignal,
): PageFetcher {
  const token = env.GH_TOKEN ?? env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'canon-upstream',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  return async (page) => {
    try {
      const response = await fetch(
        `${RELEASES_URL}?per_page=${PER_PAGE}&page=${page}`,
        { headers, signal },
      )
      if (response.status === 403 || response.status === 429) {
        return {
          ok: false,
          reason: 'rate-limited',
          message:
            'GitHub refused the request. Set GH_TOKEN or GITHUB_TOKEN to lift the hourly limit.',
        }
      }
      if (!response.ok) {
        return {
          ok: false,
          reason: 'http',
          message: `GitHub answered ${response.status} for page ${page}.`,
        }
      }

      return { ok: true, releases: (await response.json()) as Release[] }
    } catch {
      return {
        ok: false,
        reason: 'network',
        message: 'The releases feed could not be reached.',
      }
    }
  }
}

/** The tracked files naming an identifier, as a hint for where to look. */
export async function grepHint(
  root: string,
  identifier: string,
): Promise<string[]> {
  const result =
    await $`git -C ${root} grep -l -F -e ${identifier} -- . ':!wiki'`
      .env(gitEnv())
      .quiet()
      .nothrow()

  return result.stdout.toString().split('\n').filter(Boolean)
}
