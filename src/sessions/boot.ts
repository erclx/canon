import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

/** A local kernel read, so the bound only has to outlast a busy machine. */
const SYSCTL_TIMEOUT_MS = 5_000

/** Each reader throws where its source is missing, which reads as no boot time. */
export interface BootSources {
  readonly platform: NodeJS.Platform
  readonly procStat: () => string
  readonly kernBoottime: () => string
  /** The epoch milliseconds the kernel filesystems were mounted at. */
  readonly mountedAt: () => readonly number[]
}

const SYSTEM_SOURCES: BootSources = {
  platform: process.platform,
  procStat: () => readFileSync('/proc/stat', 'utf8'),
  // The absolute path, since a hook's PATH can leave /usr/sbin out.
  kernBoottime: () =>
    execFileSync('/usr/sbin/sysctl', ['-n', 'kern.boottime'], {
      encoding: 'utf8',
      timeout: SYSCTL_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  // A sandbox mounts its own /proc later and usually keeps the host's /sys.
  mountedAt: () => ['/proc', '/sys'].map((path) => statSync(path).ctimeMs),
}

function millisecondsIn(text: string, pattern: RegExp): number | undefined {
  const seconds = Number(pattern.exec(text)?.[1])
  return seconds > 0 ? seconds * 1000 : undefined
}

/**
 * The kernel recomputes `btime` from the current clock, so a step forward, such
 * as a virtual machine resyncing after its host slept, moves it past sessions
 * still running. A mount time is stamped once, so the earliest of them bounds it.
 */
function linuxBoot(sources: BootSources): number | undefined {
  const btime = millisecondsIn(sources.procStat(), /^btime (\d+)$/m)
  const mounted = sources.mountedAt()
  if (btime === undefined || mounted.length === 0) return undefined
  return Math.min(btime, ...mounted)
}

/**
 * The epoch millisecond this machine last booted, or undefined where it cannot
 * be read. A caller treats undefined as no evidence that a session has ended.
 */
export function lastBoot(
  sources: BootSources = SYSTEM_SOURCES,
): number | undefined {
  try {
    if (sources.platform === 'linux') return linuxBoot(sources)
    if (sources.platform === 'darwin') {
      return millisecondsIn(sources.kernBoottime(), /\bsec = (\d+)/)
    }
    return undefined
  } catch {
    return undefined
  }
}
