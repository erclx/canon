/** The path segment that marks an image as evidence a pull request should compare. */
const EVIDENCE_SEGMENT = 'evidence'

/** Prefix of the trailing marker this module writes and reads back. */
const MARKER_PREFIX = '<!-- pr-evidence:'

/** A `#issuecomment-<id>` suffix, which is the REST comment id `gh pr view` never returns directly. */
const ISSUE_COMMENT_ID = /#issuecomment-(\d+)$/

export interface EvidenceItem {
  readonly path: string
  readonly stem: string
  /** True when `path` did not exist at the comparison's base commit. */
  readonly added: boolean
}

export interface EvidenceState {
  /** The remainder of the path's directory under the `evidence/` segment. Empty when the image sits directly inside it. */
  readonly state: string
  readonly items: readonly EvidenceItem[]
}

export type EvidenceRefusal = 'no-evidence'

export type EvidenceReading =
  | { readonly kind: 'read'; readonly states: readonly EvidenceState[] }
  | { readonly kind: 'refused'; readonly reason: EvidenceRefusal }

/** Whether a path existed at the comparison's base commit, read however the caller resolves it. */
export type ExistsAtBase = (path: string) => Promise<boolean>

function evidencePosition(path: string): number {
  return path.split('/').indexOf(EVIDENCE_SEGMENT)
}

export function isEvidencePath(path: string): boolean {
  return evidencePosition(path) !== -1
}

function splitEvidencePath(path: string): {
  readonly state: string
  readonly stem: string
} {
  const segments = path.split('/')
  const rest = segments.slice(evidencePosition(path) + 1)
  const filename = rest[rest.length - 1] ?? ''
  return {
    state: rest.slice(0, -1).join('/'),
    stem: filename.replace(/\.[^./]+$/, ''),
  }
}

/**
 * Groups every evidence path in `changed` by its state, keying each entry
 * inside a state by filename stem so a before/after pair sharing a name
 * across two states can be read as one case.
 */
export async function groupEvidence(
  changed: readonly string[],
  existsAtBase: ExistsAtBase,
): Promise<EvidenceReading> {
  const paths = changed.filter(isEvidencePath)
  if (paths.length === 0) return { kind: 'refused', reason: 'no-evidence' }

  const resolved = await Promise.all(
    paths.map(async (path) => {
      const { state, stem } = splitEvidencePath(path)
      const added = !(await existsAtBase(path))
      return { path, state, stem, added }
    }),
  )

  const byState = new Map<string, EvidenceItem[]>()
  for (const { path, state, stem, added } of resolved) {
    const item: EvidenceItem = { path, stem, added }
    const items = byState.get(state)
    if (items === undefined) byState.set(state, [item])
    else items.push(item)
  }

  const states = [...byState.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, items]) => ({
      state,
      items: [...items].sort((a, b) => a.stem.localeCompare(b.stem)),
    }))

  return { kind: 'read', states }
}

function rawUrl(repo: string, sha: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/${sha}/${path}`
}

export function evidenceMarker(head: string): string {
  return `${MARKER_PREFIX} head=${head} -->`
}

/**
 * Renders the whole comment body: one collapsed `<details>` block per state,
 * a Base/Head row per case, and the trailing marker naming the head this body
 * describes. Every image URL is pinned to a commit sha rather than a branch,
 * so the comment keeps showing what it claimed even after the branch moves.
 */
export function renderEvidenceBody(
  states: readonly EvidenceState[],
  repo: string,
  base: string,
  head: string,
): string {
  const sections = states.map((entry) => {
    const rows = entry.items.map((item) => {
      const before = item.added
        ? '*(new)*'
        : `![](${rawUrl(repo, base, item.path)})`
      const after = `![](${rawUrl(repo, head, item.path)})`
      return `| ${item.stem} | ${before} | ${after} |`
    })

    return [
      '<details>',
      `<summary>${entry.state === '' ? 'evidence' : entry.state} (${entry.items.length})</summary>`,
      '',
      '| Case | Base | Head |',
      '| --- | --- | --- |',
      ...rows,
      '',
      '</details>',
    ].join('\n')
  })

  return ['## Evidence', '', ...sections, '', evidenceMarker(head)].join('\n')
}

export interface EvidenceComment {
  readonly url?: string
  readonly body: string
}

function hasEvidenceMarker(body: string): boolean {
  const lines = body.split('\n')
  let index = lines.length - 1
  while (index >= 0 && (lines[index] ?? '').trim() === '') index -= 1
  if (index < 0) return false
  return (lines[index] ?? '').trim().startsWith(MARKER_PREFIX)
}

/**
 * The REST id of the comment this module already posted, read off its `url`
 * field, since `gh pr view --json comments` reports only a GraphQL id there
 * and the REST id is what a later `PATCH` needs.
 */
export function findEvidenceCommentId(
  comments: readonly EvidenceComment[],
): number | undefined {
  for (const comment of comments) {
    if (!hasEvidenceMarker(comment.body)) continue
    const match =
      comment.url === undefined ? null : ISSUE_COMMENT_ID.exec(comment.url)
    if (match?.[1] !== undefined) return Number(match[1])
  }
  return undefined
}
