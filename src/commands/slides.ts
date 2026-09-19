import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Command } from 'commander'
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
    .description('Render a SLIDES.md source into a PowerPoint deck')
    .option('-s, --source <path>', 'Source SLIDES.md path', '.claude/SLIDES.md')
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
          const variant = parseVariant(opts.variant)
          const mirror = resolveMirror(opts.mirror)
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
