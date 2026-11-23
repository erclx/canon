import { belongsTo } from '@/listeners/belongs'
import type { ListenerReader } from '@/listeners/machine'
import { readAddresses } from '@/pr/evidence'

export type LocalRefusal = 'no-server' | 'no-listener-reader' | 'unhealthy'

/** The listener reads a detection makes plus two HTTP probes, injected so it can be driven without binding a socket. */
export interface LocalRunner extends ListenerReader {
  /** Whether the port serves an HTML page at its root inside the runner's timeout, or before `signal` aborts. */
  probe(port: number, signal: AbortSignal): Promise<boolean>
  /** The final status a path on the port answers after redirects, or null when nothing answers inside the timeout. */
  check(port: number, path: string): Promise<number | null>
}

export type LocalResult =
  | {
      readonly kind: 'found'
      readonly port: number
      readonly url: string
      /** Present when the port came from the project's declaration rather than the scan. */
      readonly declared?: true
    }
  | {
      readonly kind: 'refused'
      readonly reason: Exclude<LocalRefusal, 'unhealthy'>
    }
  | {
      readonly kind: 'refused'
      readonly reason: 'unhealthy'
      readonly port: number
      readonly path: string
      readonly status: number | null
    }

interface HealthFailure {
  readonly path: string
  readonly status: number | null
}

async function firstFailingPath(
  port: number,
  healthPaths: readonly string[],
  runner: LocalRunner,
): Promise<HealthFailure | undefined> {
  for (const path of healthPaths) {
    const status = await runner.check(port, path)
    if (status === null || status < 200 || status >= 300) {
      return { path, status }
    }
  }
  return undefined
}

/** Whether `cwd` is `folder` or inside it, compared on whole path segments. */
function isUnder(cwd: string, folder: string): boolean {
  return cwd === folder || cwd.startsWith(`${folder}/`)
}

/**
 * Finds this worktree's server. A declared port its listener holds is probed
 * alone first, and otherwise the lowest worktree port serving a page that passes
 * every health path wins. A port is the unit, since a reload socket holds a second.
 */
export async function findLocalServer(
  worktreeRoot: string,
  runner: LocalRunner,
  healthPaths: readonly string[] = [],
  pageOnly: readonly string[] = [],
  declaredPort?: number,
): Promise<LocalResult> {
  const listeners = await runner.listListeners()
  if (listeners === undefined) {
    const declared =
      declaredPort === undefined
        ? undefined
        : await probeDeclared(declaredPort, false, healthPaths, runner)
    return declared ?? { kind: 'refused', reason: 'no-listener-reader' }
  }

  const cwdByPid = new Map<number, string | undefined>()
  const ports = new Map<number, boolean>()
  const folders = pageOnly.map((folder) => `${worktreeRoot}/${folder}`)
  for (const { pid, port } of listeners) {
    if (!cwdByPid.has(pid)) cwdByPid.set(pid, await runner.cwdOf(pid))
    const cwd = cwdByPid.get(pid)
    if (cwd === undefined || !belongsTo(cwd, worktreeRoot)) continue
    const skipsHealth = folders.some((folder) => isUnder(cwd, folder))
    ports.set(port, (ports.get(port) ?? false) || skipsHealth)
  }

  const declaredSkips =
    declaredPort === undefined ? undefined : ports.get(declaredPort)
  if (declaredPort !== undefined && declaredSkips !== undefined) {
    const declared = await probeDeclared(
      declaredPort,
      declaredSkips,
      healthPaths,
      runner,
    )
    if (declared !== undefined) return declared
    ports.delete(declaredPort)
  }

  // Probed at once, so silent listeners below a slow page cost one timeout.
  const settled = new AbortController()
  const candidates = [...ports]
    .sort(([a], [b]) => a - b)
    .map(([port, skipsHealth]) => ({
      port,
      skipsHealth,
      page: runner.probe(port, settled.signal),
    }))
  try {
    return await firstHealthyPage(candidates, healthPaths, runner)
  } finally {
    // A pending fetch holds the process open until its own timeout.
    settled.abort()
  }
}

/** The declared port's verdict, or undefined when it serves no page and the scan runs. */
async function probeDeclared(
  port: number,
  skipsHealth: boolean,
  healthPaths: readonly string[],
  runner: LocalRunner,
): Promise<LocalResult | undefined> {
  const settled = new AbortController()
  try {
    if (!(await runner.probe(port, settled.signal))) return undefined
  } finally {
    settled.abort()
  }
  const failure = skipsHealth
    ? undefined
    : await firstFailingPath(port, healthPaths, runner)
  return failure === undefined
    ? { kind: 'found', port, url: `http://localhost:${port}`, declared: true }
    : { kind: 'refused', reason: 'unhealthy', port, ...failure }
}

interface Candidate {
  readonly port: number
  readonly skipsHealth: boolean
  readonly page: Promise<boolean>
}

async function firstHealthyPage(
  candidates: readonly Candidate[],
  healthPaths: readonly string[],
  runner: LocalRunner,
): Promise<LocalResult> {
  let unhealthy: (HealthFailure & { readonly port: number }) | undefined
  for (const { port, skipsHealth, page } of candidates) {
    if (!(await page)) continue
    const failure = skipsHealth
      ? undefined
      : await firstFailingPath(port, healthPaths, runner)
    if (failure === undefined) {
      return { kind: 'found', port, url: `http://localhost:${port}` }
    }
    unhealthy ??= { port, ...failure }
  }
  return unhealthy === undefined
    ? { kind: 'refused', reason: 'no-server' }
    : { kind: 'refused', reason: 'unhealthy', ...unhealthy }
}

/**
 * Drops the address line of a marked body, hosted and local alike, since the
 * close deletes the preview deployments and a left link points at nothing. Every
 * other byte stays, the blank line goes, and undefined means no address.
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
 * preview", keeping the head and renderer. Only that line is read, so a URL a box
 * reason quotes stays. Undefined when no line changes, as on a second mask.
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
