import { resolve } from 'node:path'
import type { Command } from 'commander'
import { INSTALL_BROWSER } from '@/browser/engine'
import { creationRel, SCRATCH } from '@/roots/record'
import { listDecks, resolveDeck, SLIDES_FOLDER } from '@/slides/decks'
import { openDeck } from '@/slides/open'
import { intro, outro, palette } from '@/ui'

const SLIDES_AT = creationRel(process.cwd(), SLIDES_FOLDER)

export function register(program: Command): void {
  const slides = program
    .command('slides')
    .helpOption('-h, --help', 'Show this help message')
    .description('Slide deck commands (render, list)')

  slides
    .command('render')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      `Render a deck under ${SLIDES_AT}/, or a folder of HTML slides, into a PowerPoint deck`,
    )
    .argument(
      '[deck]',
      'Deck name or folder, defaulting to the only deck when there is one',
    )
    .option(
      '-o, --out <path>',
      'Output directory',
      creationRel(process.cwd(), SCRATCH, 'render', 'slides'),
    )
    .option(
      '-m, --mirror <path>',
      'Copy the deck to this directory after writing',
    )
    .option('--open', 'Open the deck after writing')
    .action(
      async (
        deck: string | undefined,
        opts: { out: string; mirror?: string; open?: boolean },
      ) => {
        try {
          const root = process.cwd()
          const resolved = resolveDeck(root, deck)
          if (resolved.status === 'refused') fail(resolved.message)
          const outDir = resolve(root, opts.out)
          const mirror = resolveMirror(opts.mirror)
          await renderHtmlFolder(resolved.dir, outDir, mirror, opts.open)
        } catch (error) {
          reportFailure(error)
        }
      },
    )

  slides
    .command('list')
    .helpOption('-h, --help', 'Show this help message')
    .description(`List the decks under ${SLIDES_AT}/`)
    .option('--json', 'Output the decks as JSON')
    .action((opts: { json?: boolean }) => {
      const decks = listDecks(process.cwd())
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(decks)}\n`)
        return
      }
      const { GREEN, GREY, NC } = palette(process.stderr)
      intro('Slide decks')
      if (decks.length === 0) {
        process.stderr.write(`${GREY}│${NC} No deck under ${SLIDES_AT}/\n`)
      }
      for (const { name, title, slides: count, path } of decks) {
        const noun = count === 1 ? 'slide' : 'slides'
        process.stderr.write(
          `${GREY}│${NC} ${GREEN}✓${NC} ${name}  ${GREY}${title}, ${count} ${noun}, ${path}${NC}\n`,
        )
      }
      outro()
    })
}

/**
 * The converter loads on demand, so no other command resolves pptxgenjs,
 * jszip, or the token module at startup. A fallback, a refused link, chart, or
 * effect, or a token the master fell back on reports one line each and keeps
 * the exit at 0, since the deck is written either way. A malformed `deck.json` refuses before any slide is laid
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
  for (const { slide, message } of result.refusedMotion) {
    process.stderr.write(
      `${GREY}│${NC} ${RED}✗${NC} slide ${slide} motion left out: ${message}\n`,
    )
  }
  for (const { path, message } of result.refusedFonts) {
    process.stderr.write(
      `${GREY}│${NC} ${RED}✗${NC} font ${path} not embedded: ${message}\n`,
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

function resolveMirror(value: string | undefined): string | undefined {
  const mirror = value ?? process.env.CANON_SLIDES_MIRROR
  return mirror ? resolve(process.cwd(), mirror) : undefined
}

/**
 * Carries a fail-fast message from a validation helper to the action that
 * called it. `fail` keeps its `never` return so the compiler narrows past it,
 * and a helper deep in the call stack cannot set `process.exitCode` and unwind
 * on its own.
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
