import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Command } from 'commander'
import { auditDesign } from '@/design/audit'
import { buildDesignCss } from '@/design/css'
import { classesFor, readDeviceConfig } from '@/design/device-classes'
import { listChangedFiles, resolveBaseRef } from '@/git/files'
import { currentWorktreeRoot } from '@/git/worktree'
import { isPainted, loadPaintedPatterns } from '@/pr/painted'
import { HAND_DRAWN_FONT_FACES } from '@/design/fonts'
import { DESIGN_DOCUMENT, regenDesign } from '@/design/regen'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/roots/project'
import { intro, logError, logInfo, logWarn, outro } from '@/cli/ui'

export function register(program: Command): void {
  const design = program
    .command('design')
    .helpOption('-h, --help', 'Show this help message')
    .description('Design system commands (regen, css, audit, classes)')

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
      // The guard below misses a second checkout with its own record, so both emit this.
      const mismatch = checkoutMismatchWarning(process.cwd())

      // `PROJECT_ROOT` is the package dir under `node_modules`, which ships no committed record.
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

  design
    .command('classes')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      'Print the device classes a change supports, read from canon/config/device-classes.toml',
    )
    .argument('[paths...]', 'Changed paths to match against the scopes')
    .option(
      '--group <name>',
      'A design group to match, repeatable',
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .option(
      '--changed',
      'Add the painted paths this branch changed since its base',
    )
    .option(
      '--base <ref>',
      'Far side of the --changed range, defaulting to the trunk',
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--root <path>', 'Project root, defaulting to the current worktree')
    .addHelpText(
      'after',
      [
        '',
        'Prints the union of the classes every input reaches, in phone, tablet,',
        'desktop order. A path matches a scope by a prefix or by sitting under',
        'canon/design/<group>/ for one of its groups, a group matches by name, and',
        'an input matching no scope, or no input at all, reaches the default. A',
        'project with no config supports all three classes.',
        '',
        'Exit codes:',
        '  0  the classes were read',
        '  1  the config is refused, or --changed could not read the branch',
        '',
        'Refusal reasons:',
        '  unreadable-config    the file is not valid TOML',
        '  unknown-key          a key no table takes, such as a misspelled scope key',
        '  bad-field            a key holding the wrong kind of value',
        '  unknown-class        a name outside phone, tablet, and desktop',
        '  missing-why          a declared set of classes carries no why',
        '  unreadable-changes   git could not list the branch changes',
        '',
        'Examples:',
        '  canon design classes --json',
        '  canon design classes --group landing --json',
        '  canon design classes --changed --json',
        '  canon design classes web/src/pages/index.astro',
        '',
      ].join('\n'),
    )
    .action(
      async (
        paths: string[],
        opts: {
          group: string[]
          changed?: boolean
          base?: string
          json?: boolean
          root?: string
        },
      ) => {
        const root = opts.root ?? (await currentWorktreeRoot())
        const emit = (record: object): void => {
          if (opts.json ?? false) {
            process.stdout.write(`${JSON.stringify(record)}\n`)
          }
        }

        const read = readDeviceConfig(root)
        if (!read.ok) {
          logError(read.message)
          emit({
            ok: false,
            reason: read.reason,
            field: read.field,
            message: read.message,
          })
          process.exitCode = 1
          return
        }

        let changed: string[] = []
        if (opts.changed ?? false) {
          const listed = await listChangedPainted(root, opts.base)
          if (listed === undefined) {
            const message = `git could not list what this branch changed since ${opts.base ?? 'the trunk'}.`
            logError(message)
            emit({ ok: false, reason: 'unreadable-changes', message })
            process.exitCode = 1
            return
          }
          changed = listed
        }

        const match = classesFor(read.config, {
          paths: [...paths, ...changed],
          groups: opts.group,
        })
        if (opts.json ?? false) {
          emit({ ok: true, ...match })
          return
        }
        process.stdout.write(`${match.classes.join(',')}\n`)
      },
    )
}

/** The painted paths a branch changed, since only a painted path has a surface whose widths a reader picks. */
async function listChangedPainted(
  root: string,
  base: string | undefined,
): Promise<string[] | undefined> {
  const resolved = await resolveBaseRef(root, base)
  if (resolved === undefined) return undefined
  const changed = await listChangedFiles(root, resolved)
  if (changed === undefined) return undefined
  const painted = loadPaintedPatterns(root)
  return changed.filter((path) => isPainted(path, painted))
}
