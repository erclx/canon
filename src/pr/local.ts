import { findLocalLineIndex } from '@/pr/evidence'

/**
 * The folder linked worktrees sit under. A listener there belongs to another
 * branch even though its cwd sits inside the main checkout's toplevel.
 */
const LINKED_WORKTREES = '.claude/worktrees'

/** The state `/proc/net/tcp` writes for a socket in LISTEN. */
const PROC_LISTEN_STATE = '0A'

export type LocalRefusal = 'no-server' | 'no-listener-reader'

export interface Listener {
  readonly port: number
  readonly pid: number
}

/** The machine reads a detection makes, injected so it can be driven without binding a socket. */
export interface LocalRunner {
  /** Every TCP socket in LISTEN with its owning pid, or undefined when this machine offers no way to read them. */
  listListeners(): Promise<readonly Listener[] | undefined>
  cwdOf(pid: number): Promise<string | undefined>
  /** Whether the port serves an HTML page at its root inside the runner's timeout. */
  probe(port: number): Promise<boolean>
}

export type LocalResult =
  | { readonly kind: 'found'; readonly port: number; readonly url: string }
  | { readonly kind: 'refused'; readonly reason: LocalRefusal }

function isInside(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`)
}

/**
 * Whether a process running in `cwd` serves this worktree. A tool that
 * changes into a subfolder before listening still counts, while a sibling
 * worktree nested under the main checkout's `.claude/worktrees/` does not.
 */
function belongsTo(cwd: string, worktreeRoot: string): boolean {
  return (
    isInside(cwd, worktreeRoot) &&
    !isInside(cwd, `${worktreeRoot}/${LINKED_WORKTREES}`)
  )
}

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

/** Reads `lsof -nP -iTCP -sTCP:LISTEN -Fpn` output, where a `p` line opens a process and each `n` line names one of its sockets. */
export function parseLsofListeners(text: string): Listener[] {
  const listeners: Listener[] = []
  let pid: number | undefined
  for (const line of text.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1))
    if (!line.startsWith('n') || pid === undefined) continue
    const port = Number(line.slice(line.lastIndexOf(':') + 1))
    if (Number.isInteger(port) && port > 0) listeners.push({ pid, port })
  }
  return listeners
}

export interface ProcSocket {
  readonly port: number
  readonly inode: string
}

/** Reads `/proc/net/tcp` or `tcp6`, keeping each listening socket's port and inode for matching against `/proc/<pid>/fd`. */
export function parseProcNetTcp(text: string): ProcSocket[] {
  const sockets: ProcSocket[] = []
  for (const line of text.split('\n').slice(1)) {
    const fields = line.trim().split(/\s+/)
    const local = fields[1]
    const state = fields[3]
    const inode = fields[9]
    if (local === undefined || inode === undefined) continue
    if (state !== PROC_LISTEN_STATE) continue
    const port = Number.parseInt(local.slice(local.lastIndexOf(':') + 1), 16)
    if (Number.isInteger(port) && port > 0) sockets.push({ port, inode })
  }
  return sockets
}

/**
 * Replaces the local address line of a marked body with `note`, leaving
 * every other byte in place so the trailing marker, the checklist delimiters,
 * and any ticked box survive. Undefined when the body carries no such line,
 * which is also what a second strip of the same body returns.
 */
export function stripLocalLine(body: string, note: string): string | undefined {
  const index = findLocalLineIndex(body)
  if (index === -1) return undefined
  const lines = body.split('\n')
  lines[index] = note
  return lines.join('\n')
}
