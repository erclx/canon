/** The state `/proc/net/tcp` writes for a socket in LISTEN. */
const PROC_LISTEN_STATE = '0A'

export interface Listener {
  readonly port: number
  readonly pid: number
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
