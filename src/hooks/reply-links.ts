import { isAbsolute, join } from 'node:path'
import { decodePath } from '@/markdown/links'
import { LINK, linesOutsideFences, maskCodeSpans } from '@/markdown/scan'

export interface MissingLink {
  /** The destination as the reply wrote it. */
  readonly destination: string
  /** The path the check looked for. */
  readonly path: string
  /** Where the file is instead, for a records link written under a worktree. */
  readonly suggestion?: string
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i
const POSITION_TAIL = /(?::\d+){1,2}(?:-\d+)?$/
const WORKTREE_RECORDS = /\/\.claude\/worktrees\/[^/]+\/(\.canon\/.*)$/

function isSkipped(destination: string): boolean {
  return (
    destination === '' ||
    SCHEME.test(destination) ||
    destination.startsWith('#') ||
    /[<*{]/.test(destination)
  )
}

/**
 * The path a destination names, or undefined when it is not one to check.
 *
 * A chat link is resolved from the editor root and not from a file's own
 * folder, which is why `findBrokenLinks` cannot serve here: it skips every
 * absolute destination and resolves the rest beside the file holding them.
 * A malformed percent escape is skipped, since the reply is text a model
 * typed and the hook has no business throwing on it.
 */
function linkedPath(destination: string): string | undefined {
  if (isSkipped(destination)) return undefined
  const decoded = decodePath(destination)
  if (decoded === undefined) return undefined
  const path = decoded.replace(POSITION_TAIL, '')
  return path === '' ? undefined : path
}

/**
 * Markdown link targets in a reply that name nothing on disk.
 *
 * A relative target resolves against `root`, the main worktree root, since the
 * editor is rooted there. A relative link to a file that exists only inside a
 * linked worktree therefore reads as missing, which is the report the output
 * rule asks for. `exists` stays injected so a test asserts against a fake disk.
 */
export function findMissingReplyLinks(
  reply: string,
  root: string,
  exists: (path: string) => boolean,
): MissingLink[] {
  const checked = new Map<string, MissingLink | undefined>()

  for (const line of linesOutsideFences(reply)) {
    for (const match of maskCodeSpans(line).matchAll(LINK)) {
      const destination = match[0].slice(match[0].indexOf('](') + 2, -1)
      const target = linkedPath(destination)
      if (target === undefined) continue

      const path = isAbsolute(target) ? target : join(root, target)
      if (checked.has(path)) continue

      checked.set(
        path,
        exists(path) ? undefined : missing(destination, path, root, exists),
      )
    }
  }

  return [...checked.values()].filter((entry) => entry !== undefined)
}

function missing(
  destination: string,
  path: string,
  root: string,
  exists: (path: string) => boolean,
): MissingLink {
  const records = WORKTREE_RECORDS.exec(path)?.[1]
  const relocated = records === undefined ? undefined : join(root, records)
  return relocated !== undefined && exists(relocated)
    ? { destination, path, suggestion: relocated }
    : { destination, path }
}
