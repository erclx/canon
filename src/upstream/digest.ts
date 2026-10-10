import {
  extractIdentifiers,
  keepLines,
  versionOf,
  walkReleases,
  type FetchFailure,
  type PageFetcher,
  type ReleaseLine,
} from '@/upstream/releases'

const FILE_HINTS = 3

export interface NamedIdentifier {
  readonly name: string
  readonly files: string[]
}

export interface DigestLine extends ReleaseLine {
  readonly identifiers: NamedIdentifier[]
}

export type Digest =
  | {
      readonly kind: 'digest'
      readonly from: string
      readonly to: string
      readonly releases: number
      readonly lines: DigestLine[]
    }
  | { readonly kind: 'cursor-missing'; readonly cursor: string }
  | {
      readonly kind: 'failed'
      readonly reason: FetchFailure
      readonly message: string
    }

/** Files naming an identifier, supplied so a test needs no repository. */
export type Grep = (identifier: string) => Promise<string[]>

export async function buildDigest(
  cursor: string,
  fetchPage: PageFetcher,
  grep: Grep,
): Promise<Digest> {
  const walk = await walkReleases(cursor, fetchPage)
  if (walk.kind !== 'reached') return walk

  const oldestFirst = [...walk.releases].reverse()
  const lines = await Promise.all(
    oldestFirst.flatMap(keepLines).map(async (line) => ({
      ...line,
      identifiers: await hintsFor(line.text, grep),
    })),
  )
  const newest = walk.releases[0]

  return {
    kind: 'digest',
    from: cursor,
    to: newest ? versionOf(newest.tag_name) : cursor,
    releases: walk.releases.length,
    lines,
  }
}

async function hintsFor(text: string, grep: Grep): Promise<NamedIdentifier[]> {
  const found = await Promise.all(
    extractIdentifiers(text).map(async (name) => ({
      name,
      files: (await grep(name)).slice(0, FILE_HINTS),
    })),
  )

  return found.filter((entry) => entry.files.length > 0)
}
