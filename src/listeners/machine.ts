import { existsSync } from 'node:fs'
import { readdir, readFile, readlink } from 'node:fs/promises'
import { $ } from 'bun'
import {
  type Listener,
  parseLsofListeners,
  parseProcNetTcp,
} from '@/listeners/parse'

/** The machine reads a listener lookup makes, injected so it can be driven without binding a socket. */
export interface ListenerReader {
  /** Every TCP socket in LISTEN with its owning pid, or undefined when this machine offers no way to read them. */
  listListeners(): Promise<readonly Listener[] | undefined>
  cwdOf(pid: number): Promise<string | undefined>
}

async function readText(path: string): Promise<string | undefined> {
  return readFile(path, 'utf8').catch(() => undefined)
}

/**
 * Every listening socket's owning pid, read from `/proc`. Only a process this
 * user owns exposes its `fd` table, which is also the only process whose
 * server this user's worktree could have started.
 */
async function readProcListeners(): Promise<Listener[] | undefined> {
  const tables = await Promise.all(
    ['/proc/net/tcp', '/proc/net/tcp6'].map(readText),
  )
  if (tables.every((text) => text === undefined)) return undefined
  const byInode = new Map(
    tables.flatMap((text) =>
      text === undefined
        ? []
        : parseProcNetTcp(text).map((s) => [s.inode, s.port] as const),
    ),
  )

  const processIds = (await readdir('/proc').catch(() => [])).filter((name) =>
    /^\d+$/.test(name),
  )
  const listeners: Listener[] = []
  for (const pid of processIds) {
    const fds = await readdir(`/proc/${pid}/fd`).catch(() => [])
    for (const fd of fds) {
      const target = await readlink(`/proc/${pid}/fd/${fd}`).catch(() => '')
      const inode = /^socket:\[(\d+)\]$/.exec(target)?.[1]
      const port = inode === undefined ? undefined : byInode.get(inode)
      if (port !== undefined) listeners.push({ pid: Number(pid), port })
    }
  }
  return listeners
}

/**
 * The machine half of a listener lookup: `/proc` wherever it exists, lsof on a
 * machine without it, and no reader anywhere else.
 */
export function machineListenerReader(): ListenerReader {
  const hasLsof = Bun.which('lsof') !== null
  return {
    async listListeners() {
      // lsof 4.95 drops every process whose kernel-truncated name holds an
      // unmatched `(`, which Next's `next-server (vX.Y.Z)` title cuts down to,
      // so `/proc` goes first despite costing several times what lsof does.
      if (existsSync('/proc/net/tcp')) {
        const listeners = await readProcListeners()
        if (listeners !== undefined) return listeners
      }
      if (hasLsof) {
        const result = await $`lsof -nP -iTCP -sTCP:LISTEN -Fpn`
          .quiet()
          .nothrow()
        // lsof exits 1 both when it matched nothing and when it could not
        // read some process, and the rows it did print are real either way.
        if (result.exitCode <= 1) return parseLsofListeners(result.text())
      }
      return undefined
    },
    async cwdOf(pid) {
      if (existsSync(`/proc/${pid}/cwd`)) {
        return readlink(`/proc/${pid}/cwd`).catch(() => undefined)
      }
      if (!hasLsof) return undefined
      const result = await $`lsof -a -p ${pid} -d cwd -Fn`.quiet().nothrow()
      const line = result
        .text()
        .split('\n')
        .find((row) => row.startsWith('n'))
      return line?.slice(1)
    },
  }
}
