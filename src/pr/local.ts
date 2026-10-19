import { belongsTo } from '@/listeners/belongs'
import type { ListenerReader } from '@/listeners/machine'
import { readAddresses } from '@/pr/evidence'

export type LocalRefusal = 'no-server' | 'no-listener-reader'

/** The listener reads a detection makes plus an HTML probe, injected so it can be driven without binding a socket. */
export interface LocalRunner extends ListenerReader {
  /** Whether the port serves an HTML page at its root inside the runner's timeout. */
  probe(port: number): Promise<boolean>
}

export type LocalResult =
  | { readonly kind: 'found'; readonly port: number; readonly url: string }
  | { readonly kind: 'refused'; readonly reason: LocalRefusal }

/**
 * Finds the server this worktree is running: the lowest port whose listening
 * process runs inside the worktree and answers an HTTP probe. A port rather
 * than a process is the unit, since one dev server often holds a second
 * socket for its reload channel, and the lower one is the page by convention.
 */
export async function findLocalServer(
  worktreeRoot: string,
  runner: LocalRunner,
): Promise<LocalResult> {
  const listeners = await runner.listListeners()
  if (listeners === undefined) {
    return { kind: 'refused', reason: 'no-listener-reader' }
  }

  const cwdByPid = new Map<number, string | undefined>()
  const ports = new Set<number>()
  for (const { pid, port } of listeners) {
    if (!cwdByPid.has(pid)) cwdByPid.set(pid, await runner.cwdOf(pid))
    const cwd = cwdByPid.get(pid)
    if (cwd !== undefined && belongsTo(cwd, worktreeRoot)) ports.add(port)
  }

  for (const port of [...ports].sort((a, b) => a - b)) {
    if (await runner.probe(port)) {
      return { kind: 'found', port, url: `http://localhost:${port}` }
    }
  }
  return { kind: 'refused', reason: 'no-server' }
}

/**
 * Drops the address line of a marked body, hosted and local segments alike,
 * since the close that runs this also deletes the branch's preview
 * deployments and a link left behind points at nothing. Every other byte stays
 * in place, so the trailing marker, the checklist delimiters, and any ticked
 * box survive, and the blank line the address sat on is dropped with it so no
 * gap doubles. Undefined when the body carries no address, which is also what
 * a second drop of the same body returns.
 */
export function dropAddressLine(body: string): string | undefined {
  const { lines: indexes } = readAddresses(body)
  const first = indexes[0]
  if (first === undefined) return undefined
  const dropped = new Set(indexes)
  const lines = body.split('\n').filter((_, index) => !dropped.has(index))
  const isGapAbove = first === 0 || (lines[first - 1] ?? '').trim() === ''
  if (isGapAbove && (lines[first] ?? '').trim() === '') lines.splice(first, 1)
  return lines.join('\n')
}

/**
 * A loopback URL with any port and path, and the backticks or angle brackets a
 * pass may have wrapped it in. These hosts resolve on one machine for one
 * session, so no later reader of the thread can open them.
 */
const LOOPBACK_URL =
  /[`<]?https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/[^\s`>,]*)?[`>]?/g

/**
 * Rewrites the loopback address on a UI review's `Driven at` line to "a local
 * preview", keeping the head and the renderer. Only that line is read, so a
 * loopback URL a box reason quotes from the page stays as content. Undefined
 * when no line changes, which is also what a second mask of the same body
 * returns.
 */
export function maskLocalAddress(body: string): string | undefined {
  let changed = false
  const lines = body.split('\n').map((line) => {
    if (!line.startsWith('Driven at ')) return line
    const masked = line.replace(LOOPBACK_URL, 'a local preview')
    if (masked !== line) changed = true
    return masked
  })
  return changed ? lines.join('\n') : undefined
}
