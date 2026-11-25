import { readFileSync, statSync } from 'node:fs'

/** A reader that throws reads as no boot time. */
export interface BootSources {
  readonly platform: NodeJS.Platform
  readonly procStat: () => string
  readonly mountedAt: () => readonly number[]
}

const SYSTEM_SOURCES: BootSources = {
  platform: process.platform,
  procStat: () => readFileSync('/proc/stat', 'utf8'),
  // A sandbox mounts its own /proc later and usually keeps the host's /sys.
  mountedAt: () => ['/proc', '/sys'].map((path) => statSync(path).ctimeMs),
}

/**
 * The kernel recomputes `btime` from the current clock, so a step forward, such
 * as a virtual machine resyncing after its host slept, moves it past sessions
 * still running. A mount time is stamped once, so the earliest of them bounds it.
 */
function linuxBoot(sources: BootSources): number | undefined {
  const seconds = Number(/^btime (\d+)$/m.exec(sources.procStat())?.[1])
  const mounted = sources.mountedAt()
  if (!(seconds > 0) || mounted.length === 0) return undefined
  return Math.min(seconds * 1000, ...mounted)
}

/**
 * The epoch millisecond this machine last booted, or undefined where it cannot
 * be read. A caller treats undefined as no evidence that a session has ended.
 */
export function lastBoot(
  sources: BootSources = SYSTEM_SOURCES,
): number | undefined {
  try {
    return sources.platform === 'linux' ? linuxBoot(sources) : undefined
  } catch {
    return undefined
  }
}

export function machineId(
  read: () => string = () => readFileSync('/etc/machine-id', 'utf8'),
): string | undefined {
  try {
    return read().trim() || undefined
  } catch {
    return undefined
  }
}
