import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import type { Command } from 'commander'
import {
  INSTALL_BROWSER,
  isBrowserMissing,
  isEngineMissing,
} from '@/browser/engine'
import { isUrlSource } from '@/capture/sources'
import {
  frameError,
  intro,
  logError,
  logInfo,
  logWarn,
  outro,
  pipeOutput,
} from '@/ui'

/**
 * Kept rather than removed, unlike the selector's default that came out for
 * silently cropping the wrong region: a missing folder still refuses loud,
 * naming the argument that failed to resolve.
 */
const DEFAULT_SOURCE = 'assets'

/**
 * Both aliases are type queries rather than imports, so naming the render
 * module's types adds no static import of it. The only reference that survives
 * to runtime is the `import()` inside the action.
 */
type Renderer = typeof import('@/capture/render')
type CaptureResult = Awaited<ReturnType<Renderer['captureSources']>>[number]

/**
 * Holds wiring only. Every browser reference sits behind a dynamic import,
 * because `src/cli.ts` imports this module at startup and resolving the engine
 * there would put a browser launch in front of every other command. That is the
 * same reason `src/commands/demo.ts`, `src/commands/inventory.ts`, and
 * `src/commands/driver.ts` state for themselves.
 */
export function register(program: Command): void {
  program
    .command('capture')
    .description('Render HTML capture sources to PNG')
    .argument(
      '[source]',
      'HTML file, a directory of them, or an http(s):// URL',
      DEFAULT_SOURCE,
    )
    .option(
      '-o, --out <path>',
      'Output directory for a file source, or the destination PNG for a URL source; defaults beside the source',
    )
    .option('-s, --selector <selector>', 'Element to capture')
    .action(
      async (
        source: string,
        opts: { out?: string; selector?: string },
      ): Promise<void> => {
        /**
         * Refused rather than defaulted, and refused ahead of every other
         * check, so the message names the invocation rather than whatever the
         * working directory happens to hold. The element a capture crops to is
         * a property of the page's own markup, and the class this command used
         * to assume is declared by two committed sources in one repository.
         */
        if (!opts.selector) {
          frameError(
            '--selector names the element to capture and has no default. See canon capture --help.',
          )
          process.exitCode = 1
          return
        }
        const selector = opts.selector

        const isUrl = isUrlSource(source)
        const sourcePath = isUrl ? source : resolve(process.cwd(), source)
        if (!isUrl && !existsSync(sourcePath)) {
          frameError(`${source} not found`)
          process.exitCode = 1
          return
        }

        intro('Capture')
        let results: CaptureResult[]
        try {
          const renderer = await import('@/capture/render')
          results = await renderer.captureSources(sourcePath, {
            selector,
            outDir: opts.out ? resolve(process.cwd(), opts.out) : undefined,
          })
        } catch (error) {
          reportInFrame(error)
          process.exitCode = 1
          return
        }

        if (!results.length) {
          logError(`no .html source under ${source}`)
          outro()
          process.exitCode = 1
          return
        }

        for (const result of results) {
          if (result.status === 'rendered') {
            logInfo(
              `${displayPath(result.pngPath)} ${result.width}x${result.height}`,
            )
          } else {
            logError(`${displayPath(result.htmlPath)}: ${result.reason}`)
          }
        }
        outro()

        if (results.some((result) => result.status === 'failed')) {
          process.exitCode = 1
        }
      },
    )
}

/**
 * Closes an open frame around a failure that stopped the whole run rather than
 * one source. Two of them are setup states rather than defects and each names
 * the step that clears it: an engine package that never resolved, and a browser
 * binary that was never downloaded. Every other failure passes through intact,
 * since the engine's own message is readable and summarizing it loses what it
 * said.
 */
function reportInFrame(error: unknown): void {
  if (isEngineMissing(error)) {
    logError('the browser engine is not installed in this project')
    logWarn(`Install it with: ${INSTALL_BROWSER}`)
    outro()
    return
  }

  const message = error instanceof Error ? error.message : String(error)
  const [first, ...rest] = message.split('\n')
  logError(first ?? 'capture failed')
  if (rest.length) pipeOutput(rest.join('\n'))
  if (isBrowserMissing(error)) {
    logWarn(`Install the browser binary with: ${INSTALL_BROWSER}`)
  }
  outro()
}

/**
 * Keeps a path clickable in the operator's terminal. A source outside the
 * project reports absolute, since a relative path to it is a run of `..`
 * segments no editor resolves. A URL is not a filesystem path at all, so it
 * reports as given.
 */
function displayPath(path: string): string {
  if (isUrlSource(path)) return path
  const fromCwd = relative(process.cwd(), path)
  return fromCwd.startsWith('..') ? path : fromCwd
}
