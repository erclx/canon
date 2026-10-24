import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Command } from 'commander'
import { auditDesign } from '@/design/audit'
import { buildDesignCss } from '@/design/css'
import { currentWorktreeRoot } from '@/git/worktree'
import { HAND_DRAWN_FONT_FACES } from '@/design/fonts'
import { DESIGN_DOCUMENT, regenDesign } from '@/design/regen'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/roots/project'
import { intro, logError, logInfo, logWarn, outro } from '@/cli/ui'

export function register(program: Command): void {
  const design = program
    .command('design')
    .helpOption('-h, --help', 'Show this help message')
    .description('Design system commands (regen, css, audit)')

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
        intro('Regenerate design source')
        if (mismatch !== undefined) logWarn(mismatch)
        logError(
          `No ${DESIGN_DOCUMENT} at ${PROJECT_ROOT}. Regen runs in the toolkit checkout, not against a target.`,
        )
        outro()
        process.exitCode = 1
        return
      }

      intro('Regenerate design source')
      if (mismatch !== undefined) logWarn(mismatch)
      const result = regenDesign(PROJECT_ROOT)
      logInfo(relative(PROJECT_ROOT, result.documentPath))
      outro()
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

  design
    .command('audit')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      'Measure the design record against the prose budget and check its custom properties against the stylesheet',
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--root <path>', 'Project root, defaulting to the current worktree')
    .addHelpText(
      'after',
      [
        '',
        'Reads canon/DESIGN.md. Prose findings carry their counts against the',
        'budget the design standard sets. Each custom property in the Colors and',
        'Shapes tables is checked against the stylesheet the lead names. A lead',
        'naming none reads as `tokens.status: "unchecked"`, never as a pass.',
        '',
        'Exit codes:',
        '  0  the reading completed, whatever it found',
        '',
        'It gates nothing and writes nothing.',
        '',
        'Examples:',
        '  canon design audit',
        '  canon design audit --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: { json?: boolean; root?: string }) => {
      const root = opts.root ?? (await currentWorktreeRoot())
      const audit = auditDesign(root)

      if (opts.json ?? false) {
        process.stdout.write(`${JSON.stringify(audit)}\n`)
        return
      }

      intro('canon design audit')
      if (audit.record === null) {
        logInfo('No design record to audit')
      } else {
        for (const finding of audit.prose) logWarn(finding)
        if (audit.tokens?.status === 'unchecked') {
          logWarn(`Tokens unchecked: ${audit.tokens.reason}`)
        } else if (audit.tokens?.status === 'checked') {
          for (const property of audit.tokens.missing) {
            logWarn(`${property} is not declared in ${audit.tokens.stylesheet}`)
          }
        }
        if (audit.clean) logInfo(`${audit.record} is within budget`)
      }
      outro()
    })
}
