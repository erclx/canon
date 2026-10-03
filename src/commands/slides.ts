import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Command } from 'commander'
import { INSTALL_BROWSER } from '@/browser/engine'
import { creationRel, SCRATCH } from '@/record-root'
import { LAYOUTS } from '@/slides/layouts'
import { openDeck } from '@/slides/open'
import { renderSlidesDoc } from '@/slides/render'
import type { Variant } from '@/slides/styles'
import { intro, outro, palette } from '@/ui'

export function register(program: Command): void {
  const slides = program
    .command('slides')
    .helpOption('-h, --help', 'Show this help message')
    .description('Slide deck commands (render, list)')

  slides
    .command('render')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      'Render a SLIDES.md source, or a folder of HTML slides, into a PowerPoint deck',
    )
    .option(
      '-s, --source <path>',
      'Source SLIDES.md file, or a folder of .html slides read in filename order',
      '.claude/SLIDES.md',
    )
    .option(
      '-o, --out <path>',
      'Output directory',
      creationRel(process.cwd(), SCRATCH, 'render', 'slides'),
    )
    .option('-v, --variant <variant>', 'Override variant (light or dark)')
    .option(
      '-m, --mirror <path>',
      'Copy the deck to this directory after writing',
    )
    .option('--open', 'Open the deck after writing')
    .action(
      async (opts: {
        source: string
        out: string
        variant?: string
        mirror?: string
        open?: boolean
      }) => {
        try {
          const sourcePath = resolve(process.cwd(), opts.source)
          const outDir = resolve(process.cwd(), opts.out)
          if (!existsSync(sourcePath)) {
            fail(`${opts.source} not found`)
          }
          const mirror = resolveMirror(opts.mirror)
          if (statSync(sourcePath).isDirectory()) {
            if (opts.variant !== undefined) {
              fail('--variant applies to a SLIDES.md source, not a folder')
            }
            await renderHtmlFolder(sourcePath, outDir, mirror, opts.open)
            return
          }
          const variant = parseVariant(opts.variant)
          const { GREEN, GREY, NC, RED } = palette(process.stderr)
          intro('Render slides')
          const result = await renderSlidesDoc(sourcePath, outDir, {
            variant,
            mirror,
          })
          process.stderr.write(
            `${GREY}│${NC} ${GREEN}✓${NC} ${result.slideCount} slides\n${GREY}│${NC} ${GREEN}✓${NC} ${result.pptxPath}\n`,
          )
          const validNames = LAYOUTS.map((layout) => layout.name).join(', ')
          for (const { value, slideNumbers } of result.unrecognizedLayouts) {
            const noun = slideNumbers.length === 1 ? 'slide' : 'slides'
            process.stderr.write(
              `${GREY}│${NC} ${RED}✗${NC} unrecognized layout "${value}" on ${noun} ${slideNumbers.join(', ')}. Valid layouts: ${validNames}\n`,
            )
          }
          if (result.mirrorPath) {
            process.stderr.write(
              `${GREY}│${NC} ${GREEN}✓${NC} mirrored to ${result.mirrorPath}\n`,
            )
          }
          if (opts.open) {
            const target = result.mirrorPath ?? result.pptxPath
            const opened = await openDeck(target)
            const mark = opened ? `${GREEN}✓${NC}` : `${RED}✗${NC}`
            process.stderr.write(
              `${GREY}│${NC} ${mark} ${opened ? 'opened' : 'could not open'} ${target}\n`,
            )
          }
          outro()
        } catch (error) {
          reportFailure(error)
        }
      },
    )

  slides
    .command('list')
    .helpOption('-h, --help', 'Show this help message')
    .description('List the available slide layouts')
    .option('--json', 'Output the layout catalog as JSON')
    .action((opts: { json?: boolean }) => {
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(LAYOUTS)}\n`)
        return
      }
      const { GREEN, GREY, NC } = palette(process.stderr)
      intro('Slide layouts')
      for (const layout of LAYOUTS) {
        process.stderr.write(
          `${GREY}│${NC} ${GREEN}✓${NC} ${layout.name}  ${GREY}${layout.description}${NC}\n`,
        )
      }
      outro()
    })
}

/**
 * The converter loads on demand, so no other command resolves pptxgenjs,
 * jszip, or the token module at startup. A fallback, a refused link or chart,
 * or a token the master fell back on reports one line each and keeps the exit
 * at 0, as an unrecognized layout does on the markdown path, since the deck is
 * written either way. A malformed `deck.json` refuses before any slide is laid
 * out and exits 1.
 */
async function renderHtmlFolder(
  sourceDir: string,
  outDir: string,
  mirror: string | undefined,
  shouldOpen: boolean | undefined,
): Promise<void> {
  const { exportHtmlDeck } = await import('@/slides/convert/export')
  const { GREEN, GREY, NC, RED } = palette(process.stderr)
  const result = await exportHtmlDeck(sourceDir, outDir, {
    root: process.cwd(),
    mirror,
  })
  if (result.status === 'refused') {
    fail(
      result.reason === 'browser-missing'
        ? `Chromium is not installed. Run ${INSTALL_BROWSER}`
        : result.message,
    )
  }
  intro('Render slides')
  process.stderr.write(
    `${GREY}│${NC} ${GREEN}✓${NC} ${result.slideCount} slides\n${GREY}│${NC} ${GREEN}✓${NC} ${result.pptxPath}\n`,
  )
  for (const { slide, selector, properties } of result.fallbacks) {
    process.stderr.write(
      `${GREY}│${NC} ${RED}✗${NC} slide ${slide} ${selector} drawn as a picture for ${properties.join(', ')}\n`,
    )
  }
  for (const { slide, selector, href, reason } of result.refusedLinks) {
    process.stderr.write(
      `${GREY}│${NC} ${RED}✗${NC} slide ${slide} ${selector} link "${href}" left out: ${reason}\n`,
    )
  }
  for (const { slide, selector, message } of result.refusedCharts) {
    process.stderr.write(
      `${GREY}│${NC} ${RED}✗${NC} slide ${slide} ${selector} chart left out: ${message}\n`,
    )
  }
  for (const notice of result.notices) {
    process.stderr.write(`${GREY}│${NC} ${RED}✗${NC} ${notice}\n`)
  }
  if (result.mirrorPath) {
    process.stderr.write(
      `${GREY}│${NC} ${GREEN}✓${NC} mirrored to ${result.mirrorPath}\n`,
    )
  }
  if (shouldOpen) {
    const target = result.mirrorPath ?? result.pptxPath
    const opened = await openDeck(target)
    const mark = opened ? `${GREEN}✓${NC}` : `${RED}✗${NC}`
    process.stderr.write(
      `${GREY}│${NC} ${mark} ${opened ? 'opened' : 'could not open'} ${target}\n`,
    )
  }
  outro()
}

function parseVariant(value: string | undefined): Variant | undefined {
  if (value === undefined) return undefined
  if (value === 'light' || value === 'dark') return value
  fail(`Invalid variant "${value}". Use light or dark.`)
}

function resolveMirror(value: string | undefined): string | undefined {
  const mirror = value ?? process.env.CANON_SLIDES_MIRROR
  return mirror ? resolve(process.cwd(), mirror) : undefined
}

/**
 * Carries a fail-fast message from a validation helper to the action that
 * called it. `fail` has to keep its `never` return, since that is what makes
 * `parseVariant` exhaustive to the compiler, and a helper deep in the call
 * stack cannot set `process.exitCode` and unwind on its own.
 */
class SlidesError extends Error {}

function fail(message: string): never {
  throw new SlidesError(message)
}

/**
 * `src/cli.ts` calls `program.parse()` without awaiting it, so a rejected
 * action promise reaches no handler and Bun prints a stack trace. Every action
 * that calls `fail` catches at its own boundary.
 */
function reportFailure(error: unknown): void {
  if (!(error instanceof SlidesError)) throw error
  const { GREY, NC, RED } = palette(process.stderr)
  process.stderr.write(
    `${GREY}┌${NC}\n${GREY}│${NC} ${RED}✗${NC} ${error.message}\n${GREY}└${NC}\n`,
  )
  process.exitCode = 1
}
