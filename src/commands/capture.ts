import { existsSync, statSync } from 'node:fs'
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
} from '@/cli/ui'

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
type ColorScheme = import('@/capture/render').ColorScheme
type SectionsResult = import('@/capture/render').SectionsResult

const COLOR_SCHEMES: readonly ColorScheme[] = ['light', 'dark']

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
    .helpOption('-h, --help', 'Show this help message')
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
    .option(
      '-s, --selector <selector>',
      'Element to capture, or with --sections the root to split, defaulting to main and then body',
    )
    .option(
      '--sections',
      'Write one PNG per section of one page into the --out folder, in page order',
    )
    .option('--json', 'With --sections, print the result as one JSON record')
    .option(
      '--width <px>',
      'Viewport width in pixels, so a media query resolves at that width',
    )
    .option(
      '--color-scheme <scheme>',
      'Theme to render in, light or dark; defaults to whichever theme the page renders unset',
    )
    .addHelpText(
      'after',
      [
        '',
        'Outside --sections the selector has no default, since the element to',
        'crop to belongs to the page. Each element holding text inside it must resolve its first font',
        'family, and a generic keyword such as monospace or system-ui fails,',
        'since it resolves differently on each machine. The user agent sets',
        'monospace on pre, code, kbd, and samp, so each needs its own',
        'font-family. --width takes one whole number and sets the viewport, so',
        'run it once per breakpoint with its own --out.',
        '',
        '--color-scheme sets prefers-color-scheme, a data-theme attribute, and',
        'a light or dark class on the root, so a stylesheet keyed on any of the',
        'three renders that theme. Run it once per scheme with its own --out.',
        '',
        '--sections takes one HTML file or URL and needs --out naming a folder.',
        'It wheels down the page so lazy content loads, hides fixed and sticky',
        'layers, splits any block taller than 1.6 viewports into its children,',
        'and joins a block under 400px to the one above. Each shot is cut at',
        '2400px and writes section-NN.png with its stamp. A generic or missing',
        'font family is recorded rather than refused. --json prints',
        '{ source, sections: [{ index, path, top, height }], failed: [{ index,',
        'reason }], fonts: { generic, missing } }, or { source, reason } when',
        'the page fails whole.',
        '',
        'Examples:',
        '  canon capture assets --selector .window',
        '  canon capture https://example.com --sections --out refs/example --width 1440',
        '  canon capture https://example.com --sections --out refs/example --json',
        '',
      ].join('\n'),
    )
    .action(
      async (
        source: string,
        opts: {
          out?: string
          selector?: string
          width?: string
          colorScheme?: string
          sections?: boolean
          json?: boolean
        },
      ): Promise<void> => {
        if (opts.json && !opts.sections) {
          frameError('--json applies to --sections. See canon capture --help.')
          process.exitCode = 1
          return
        }
        if (opts.sections) {
          await captureSectionsAction(source, opts)
          return
        }

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

        const width = parseWidth(opts.width)
        if (Number.isNaN(width)) {
          frameError(
            `--width takes a whole number of pixels of 1 or more, got ${opts.width}.`,
          )
          process.exitCode = 1
          return
        }

        const colorScheme = parseColorScheme(opts.colorScheme)
        if (colorScheme === null) {
          frameError(
            `--color-scheme takes ${COLOR_SCHEMES.join(' or ')}, got ${JSON.stringify(opts.colorScheme)}.`,
          )
          process.exitCode = 1
          return
        }

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
            width,
            colorScheme,
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
            logError(`${displayPath(result.source)}: ${result.reason}`)
          }
        }
        outro()

        if (results.some((result) => result.status === 'failed')) {
          process.exitCode = 1
        }
      },
    )
}

interface SectionFlags {
  out?: string
  selector?: string
  width?: string
  colorScheme?: string
  json?: boolean
}

/**
 * Section mode reads `--out` as a folder for every source kind, so it is
 * required here even for a file source, and a directory source is refused,
 * since a section run describes one page.
 */
async function captureSectionsAction(
  source: string,
  opts: SectionFlags,
): Promise<void> {
  const width = parseWidth(opts.width)
  if (Number.isNaN(width)) {
    frameError(
      `--width takes a whole number of pixels of 1 or more, got ${opts.width}.`,
    )
    process.exitCode = 1
    return
  }
  const colorScheme = parseColorScheme(opts.colorScheme)
  if (colorScheme === null) {
    frameError(
      `--color-scheme takes ${COLOR_SCHEMES.join(' or ')}, got ${JSON.stringify(opts.colorScheme)}.`,
    )
    process.exitCode = 1
    return
  }
  if (!opts.out) {
    frameError('--sections needs --out naming the folder the shots go in.')
    process.exitCode = 1
    return
  }

  const isUrl = isUrlSource(source)
  const sourcePath = isUrl ? source : resolve(process.cwd(), source)
  if (!isUrl && !existsSync(sourcePath)) {
    frameError(`${source} not found`)
    process.exitCode = 1
    return
  }
  if (!isUrl && statSync(sourcePath).isDirectory()) {
    frameError(
      `--sections takes one HTML file or URL, and ${source} is a directory.`,
    )
    process.exitCode = 1
    return
  }

  const json = opts.json ?? false
  if (!json) intro('Capture sections')
  let result: SectionsResult
  try {
    const renderer = await import('@/capture/render')
    result = await renderer.captureSections(sourcePath, {
      outDir: resolve(process.cwd(), opts.out),
      root: opts.selector,
      width,
      colorScheme,
    })
  } catch (error) {
    if (json) {
      logError(error instanceof Error ? error.message : String(error))
    } else {
      reportInFrame(error)
    }
    process.exitCode = 1
    return
  }

  if (result.status === 'failed') {
    if (json) {
      process.stdout.write(
        `${JSON.stringify({ source: result.source, reason: result.reason })}\n`,
      )
    }
    logError(`${displayPath(result.source)}: ${result.reason}`)
    if (!json) outro()
    process.exitCode = 1
    return
  }

  const { source: page, sections, failed, fonts } = result
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ source: page, sections, failed, fonts })}\n`,
    )
  }
  for (const shot of json ? [] : sections) {
    logInfo(`${displayPath(shot.path)} top ${shot.top} height ${shot.height}`)
  }
  for (const fault of failed) {
    logError(`section ${fault.index}: ${fault.reason}`)
  }
  if (!json && fonts.generic.length) {
    logWarn(`generic families drawn: ${fonts.generic.join(', ')}`)
  }
  if (!json && fonts.missing.length) {
    logWarn(`families not installed: ${fonts.missing.join(', ')}`)
  }
  if (!json) outro()
  if (failed.length || !sections.length) process.exitCode = 1
}

/**
 * Undefined for an absent flag and `NaN` for a value that is not a positive
 * integer, so the caller can tell no width from a bad one.
 */
function parseWidth(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : Number.NaN
}

/**
 * Undefined for an absent flag and `null` for a value naming no scheme, so the
 * caller can tell no scheme from a bad one.
 */
function parseColorScheme(
  raw: string | undefined,
): ColorScheme | undefined | null {
  if (raw === undefined) return undefined
  return COLOR_SCHEMES.find((scheme) => scheme === raw) ?? null
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
