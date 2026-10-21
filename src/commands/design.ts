import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Command } from 'commander'
import { buildDesignCss } from '@/design/css'
import { HAND_DRAWN_FONT_FACES } from '@/design/fonts'
import { DESIGN_DOCUMENT, regenDesign } from '@/design/regen'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/roots/project'
import { logWarn, palette } from '@/cli/ui'

export function register(program: Command): void {
  const design = program
    .command('design')
    .helpOption('-h, --help', 'Show this help message')
    .description('Design system commands (regen, css)')

  design
    .command('regen')
    .helpOption('-h, --help', 'Show this help message')
    .description('Rewrite canon/DESIGN.md from src/design/tokens.ts')
    .addHelpText(
      'after',
      [
        '',
        'This runs against the toolkit checkout rather than a target. It',
        'rewrites the record from the token module and refuses where the record',
        'is absent, which is what the CLI installed into a project as a',
        'dependency looks like.',
        '',
      ].join('\n'),
    )
    .action(() => {
      const { GREEN, GREY, NC, RED, WHITE } = palette(process.stderr)

      // The guard below catches a `PROJECT_ROOT` with no record at all, which
      // is an installed package. It cannot catch a second real checkout that
      // has one, so both paths carry the warning. It is a frame-interior line,
      // so each emits it after its own opener rather than ahead of the branch.
      const mismatch = checkoutMismatchWarning(process.cwd())

      // The output resolves from `PROJECT_ROOT`, which is the installed
      // package directory when the CLI runs out of a target's `node_modules`.
      // The record is already committed here and ships with no package, so
      // its absence is what separates the two.
      if (!existsSync(join(PROJECT_ROOT, DESIGN_DOCUMENT))) {
        process.stderr.write(`${GREY}┌${NC}\n`)
        if (mismatch !== undefined) logWarn(mismatch)
        process.stderr.write(
          `${GREY}│${NC} ${RED}✗${NC} No ${DESIGN_DOCUMENT} at ${PROJECT_ROOT}. Regen runs in the toolkit checkout, not against a target.\n${GREY}└${NC}\n`,
        )
        process.exitCode = 1
        return
      }

      process.stderr.write(
        `${GREY}┌${NC}\n${GREY}│${NC} ${WHITE}Regenerate design source${NC}\n`,
      )
      if (mismatch !== undefined) logWarn(mismatch)
      const result = regenDesign(PROJECT_ROOT)
      process.stderr.write(
        `${GREY}│${NC} ${GREEN}✓${NC} ${relative(PROJECT_ROOT, result.documentPath)}\n`,
      )
      process.stderr.write(`${GREY}└${NC}\n`)
    })

  design
    .command('css')
    .helpOption('-h, --help', 'Show this help message')
    .description('Emit the design tokens and components as CSS on stdout')
    .option(
      '--no-components',
      'Custom properties only, without the component rules',
    )
    .option(
      '--figures',
      'Embed the hand-drawn figure fonts (Virgil, Excalifont), which the unconditional component styling never carries on its own',
    )
    .action((opts: { components: boolean; figures?: boolean }) => {
      process.stdout.write(
        buildDesignCss(undefined, {
          components: opts.components,
          embedFonts: opts.figures ? HAND_DRAWN_FONT_FACES : undefined,
        }),
      )
    })
}
