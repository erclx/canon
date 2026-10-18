import { realpath } from 'node:fs/promises'
import { belongsTo } from '@/listeners/belongs'
import type { ListenerReader } from '@/listeners/machine'

/** What a stop took, or would take on a dry run, from one worktree. */
export interface StoppedServer {
  readonly path: string
  readonly pids: readonly number[]
  readonly ports: readonly number[]
}

/**
 * `unread` is a machine with no way to list sockets, which a reader must tell
 * apart from `read` with nothing stopped, since the first says nothing about
 * what is still listening.
 */
export type StopReport =
  | { readonly kind: 'read'; readonly stopped: readonly StoppedServer[] }
  | { readonly kind: 'unread' }

export interface StopOptions {
  readonly reader: ListenerReader
  /** Sends SIGTERM and says whether it landed, so a pid that already exited is not counted. */
  readonly kill?: (pid: number) => boolean
  readonly dryRun: boolean
}

function sigterm(pid: number): boolean {
  try {
    process.kill(pid, 'SIGTERM')
    return true
  } catch {
    return false
  }
}

/** A process cwd reads back resolved, so a path held through a symlink has to be too. */
async function resolved(path: string): Promise<string> {
  return realpath(path).catch(() => path)
}

/**
 * Stops every server listening from inside one of the worktrees about to be
 * removed, so none outlives the directory it serves. Each path is tested by the
 * nesting rule `canon pr local` uses, so a listener in the main checkout or in
 * a sibling under `.claude/worktrees/` is never signaled. The cwd is read
 * against the given paths and never against `process.cwd()`, which a run from
 * inside another worktree would otherwise make the only match.
 */
export async function stopListeners(
  paths: readonly string[],
  opts: StopOptions,
): Promise<StopReport> {
  const listeners = await opts.reader.listListeners()
  if (listeners === undefined) return { kind: 'unread' }

  const kill = opts.kill ?? sigterm
  const roots = await Promise.all(paths.map(resolved))
  const cwdByPid = new Map<number, string | undefined>()
  const stopped: StoppedServer[] = []

  for (const [index, root] of roots.entries()) {
    const pids = new Set<number>()
    const ports = new Set<number>()
    for (const { pid, port } of listeners) {
      if (!cwdByPid.has(pid)) cwdByPid.set(pid, await opts.reader.cwdOf(pid))
      const cwd = cwdByPid.get(pid)
      if (cwd === undefined || !belongsTo(cwd, root)) continue
      pids.add(pid)
      ports.add(port)
    }

    const landed = [...pids]
      .sort((a, b) => a - b)
      .filter((pid) => opts.dryRun || kill(pid))
    if (landed.length === 0) continue
    const landedSet = new Set(landed)
    stopped.push({
      path: paths[index] ?? root,
      pids: landed,
      ports: [
        ...new Set(
          listeners
            .filter(({ pid, port }) => landedSet.has(pid) && ports.has(port))
            .map(({ port }) => port),
        ),
      ].sort((a, b) => a - b),
    })
  }

  return { kind: 'read', stopped }
}
