import { relative } from 'node:path'
import {
  DEFAULT_PORT,
  type ServeOutcome,
  type ServeStarted,
} from '@/serve/static'
import { intro, logError, logInfo, logStep, logWarn, outro } from '@/ui'

/**
 * The relative path where it stays inside the working directory, and the
 * absolute one where it climbs out. A run from a linked worktree serving the
 * main root reports `../../teach`, which names the directory without giving a
 * reader anything they can open.
 */
export function displayPath(root: string): string {
  const near = relative(process.cwd(), root)
  if (near === '') return '.'
  return near.startsWith('..') ? root : near
}

/**
 * Undefined for a value that is not a port, distinct from an absent flag,
 * which takes the default. A `Number` of a typo is `NaN`, and passing that on
 * asks the runtime to bind a port nobody named.
 */
export function parsePort(raw: string | undefined): number | undefined {
  if (raw === undefined) return DEFAULT_PORT
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 65535) return undefined
  return value
}

/** The fields a started server reports, shared by every command that serves. */
export function serveFields(outcome: ServeStarted): {
  readonly host: string
  readonly port: number
  readonly entry: string
  readonly url: string
  readonly entryExists: boolean
} {
  return {
    host: outcome.host,
    port: outcome.port,
    entry: outcome.entry,
    url: outcome.url,
    entryExists: outcome.entryExists,
  }
}

/** The steps a framed report prints for a running server, inside its frame. */
export function logServing(outcome: ServeStarted): void {
  logStep('Serving')
  logInfo(displayPath(outcome.root))
  logStep('Open')
  logInfo(outcome.url)

  if (!outcome.entryExists) {
    logStep('No entry page')
    logWarn(
      `${outcome.entry} is not in that directory, so the link opens a 404`,
    )
  }

  logStep('Stop')
  logInfo('Ctrl-C')
}

export function report(outcome: ServeOutcome, emitJson: boolean): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, detail: outcome.detail })}\n`,
      )
      return 1
    }
    intro('canon serve')
    logError(outcome.detail)
    outro()
    return 1
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, root: outcome.root, ...serveFields(outcome) })}\n`,
    )
    return 0
  }

  intro('canon serve')
  logServing(outcome)
  return 0
}

/**
 * Resolves when the process is asked to stop. The frame is closed here rather
 * than in the reporter, because the run is the serving rather than the start,
 * and closing at start would print the frame's end while the server ran on.
 */
export function waitForInterrupt(stop: () => Promise<void>): Promise<void> {
  return new Promise((settle) => {
    const finish = () => {
      void stop().then(() => {
        outro()
        settle()
      })
    }
    process.once('SIGINT', finish)
    process.once('SIGTERM', finish)
  })
}
