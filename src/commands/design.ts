import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import type { Command } from 'commander'
import {
  createDesignAdapter,
  DESIGN_INSTALL_DIR,
  DESIGN_PROJECT_SUBDIR,
} from '@/design/adapter'
import { buildDesignCss } from '@/design/css'
import { HAND_DRAWN_FONT_FACES } from '@/design/fonts'
import { addProjectFace, listProjectFaces } from '@/design/project-fonts'
import { renderDesignDoc } from '@/design/render'
import { DESIGN_BASE_CSS, DESIGN_DOCUMENT, regenDesign } from '@/design/regen'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/project-root'
import { creationRel, SCRATCH } from '@/record-root'
import { surfaceDir } from '@/surface-root'
import { recordStamp, runDomainSync } from '@/sync/engine'
import { isDirectory, resolveTarget } from '@/targets/validate'
import { intro, logAdd, logError, logInfo, logWarn, outro, palette } from '@/ui'

export function register(program: Command): void {
  const design = program
    .command('design')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      'Design system commands (regen, css, render, install, sync, fonts)',
    )

  design
    .command('regen')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      'Rewrite canon/DESIGN.md and the base stylesheet from src/design/tokens.ts',
    )
    .addHelpText(
      'after',
      [
        '',
        'Unlike install and sync, this runs against the toolkit checkout rather',
        'than a target. It rewrites the record and the base stylesheet from the',
        'token module and refuses where the record is absent, which is what the',
        'CLI installed into a project as a dependency looks like.',
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

      // Both outputs resolve from `PROJECT_ROOT`, which is the installed
      // package directory when the CLI runs out of a target's `node_modules`.
      // The record is the one output that is already committed here and ships
      // with no package, so its absence is what separates the two.
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
      for (const path of [result.documentPath, result.cssPath]) {
        process.stderr.write(
          `${GREY}│${NC} ${GREEN}✓${NC} ${relative(PROJECT_ROOT, path)}\n`,
        )
      }
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

  design
    .command('render')
    .helpOption('-h, --help', 'Show this help message')
    .description('Render DESIGN.md tokens to HTML and CSS preview')
    .option(
      '-s, --source <path>',
      'Source DESIGN.md path',
      relative(process.cwd(), surfaceDir(process.cwd(), 'DESIGN.md')),
    )
    .option(
      '-o, --out <path>',
      'Output directory',
      creationRel(process.cwd(), SCRATCH, 'render', 'design'),
    )
    .option(
      '--embed-fonts',
      'Declare each vendored face the typography table names, and set the page body in the body stack',
    )
    .action((opts: { source: string; out: string; embedFonts?: boolean }) => {
      const sourcePath = resolve(process.cwd(), opts.source)
      const outDir = resolve(process.cwd(), opts.out)
      const { GREEN, GREY, NC, RED, WHITE } = palette(process.stderr)
      if (!existsSync(sourcePath)) {
        process.stderr.write(
          `${GREY}┌${NC}\n${GREY}│${NC} ${RED}✗${NC} ${opts.source} not found\n${GREY}└${NC}\n`,
        )
        process.exitCode = 1
        return
      }
      process.stderr.write(
        `${GREY}┌${NC}\n${GREY}│${NC} ${WHITE}Render design tokens${NC}\n`,
      )
      const result = renderDesignDoc(sourcePath, outDir, {
        embedFonts: opts.embedFonts,
      })
      process.stderr.write(
        `${GREY}│${NC} ${GREEN}✓${NC} ${result.htmlPath}\n${GREY}│${NC} ${GREEN}✓${NC} ${result.cssPath}\n${GREY}└${NC}\n`,
      )
    })

  design
    .command('install')
    .description('Install the base stylesheet into a project')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .addHelpText(
      'after',
      [
        '',
        'Installs one toolkit-owned file and creates no override. A project',
        `overrides a value by writing ${join(DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR)}/`,
        'itself, which sync never touches. Nothing arrives on a project that',
        'has not run this, so a design value reaches a target on an install',
        'rather than on the next sync.',
        '',
      ].join('\n'),
    )
    .action(async (target: string) => {
      process.exitCode = await runInstall(target)
    })

  design
    .command('sync')
    .description(
      'Update the base stylesheet already installed under .claude/design/',
    )
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .action(async (target: string) => {
      process.exitCode = await runDomainSync(
        createDesignAdapter(PROJECT_ROOT),
        target,
        { protectedRoot: PROJECT_ROOT },
      )
    })

  registerFonts(design)
}

const FONTS_DIR = join(DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR, 'fonts')

interface FontsRefused {
  readonly ok: false
  readonly reason: string
  readonly detail: string
}

function writeJson(record: unknown): void {
  process.stdout.write(`${JSON.stringify(record)}\n`)
}

function refuseFonts(
  title: string,
  refusal: FontsRefused,
  emitJson: boolean,
): number {
  if (emitJson) writeJson(refusal)
  intro(title)
  logError(refusal.detail)
  outro()
  return 1
}

/** A target that is a directory, or the refusal naming the path given. */
function fontsTarget(target: string): string | FontsRefused {
  const resolved = resolve(target)
  if (!isDirectory(resolved)) {
    return {
      ok: false,
      reason: 'no-target',
      detail: `Target directory not found: ${target}`,
    }
  }
  return resolved
}

function registerFonts(design: Command): void {
  const fonts = design
    .command('fonts')
    .helpOption('-h, --help', 'Show this help message')
    .description(`Read and add the project's own faces under ${FONTS_DIR}/`)
    .addHelpText(
      'after',
      [
        '',
        `Faces are declared as @font-face rules in ${join(DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR)}/fonts.css,`,
        'which the canvas embeds into every frame. Sync never writes the folder.',
        '',
      ].join('\n'),
    )

  fonts
    .command('list')
    .helpOption('-h, --help', 'Show this help message')
    .description('List each face the project override sheets declare')
    .argument('[target]', 'Target directory', '.')
    .option('--json', 'Emit the record on stdout')
    .action((target: string, opts: { json?: boolean }) => {
      const title = 'canon design fonts list'
      const resolved = fontsTarget(target)
      if (typeof resolved !== 'string') {
        process.exitCode = refuseFonts(title, resolved, Boolean(opts.json))
        return
      }
      const faces = listProjectFaces(resolved)
      if (opts.json) writeJson({ ok: true, faces })
      intro(title)
      if (faces.length === 0) logInfo(`No faces declared under ${FONTS_DIR}/`)
      for (const face of faces) {
        const line = `${face.family} ${face.weight} ${face.style}: ${face.file} in ${face.sheet}`
        if (face.present) logInfo(line)
        else logWarn(`${line} (${face.problem ?? 'missing'})`)
      }
      outro()
    })

  fonts
    .command('add')
    .helpOption('-h, --help', 'Show this help message')
    .description(
      `Copy a woff2, woff, ttf, or otf face into ${FONTS_DIR}/ and declare it`,
    )
    .argument('<file>', 'Font file to copy')
    .argument('[target]', 'Target directory', '.')
    .requiredOption('--family <name>', 'Family name the face declares')
    .option('--weight <n>', "Weight, or a range such as '100 900'", '400')
    .option('--style <style>', 'normal or italic', 'normal')
    .option('--json', 'Emit the record on stdout')
    .action(
      (
        file: string,
        target: string,
        opts: { family: string; weight: string; style: string; json?: boolean },
      ) => {
        const title = 'canon design fonts add'
        const emitJson = Boolean(opts.json)
        const resolved = fontsTarget(target)
        if (typeof resolved !== 'string') {
          process.exitCode = refuseFonts(title, resolved, emitJson)
          return
        }
        if (resolved === PROJECT_ROOT) {
          process.exitCode = refuseFonts(
            title,
            {
              ok: false,
              reason: 'toolkit-root',
              detail:
                'Cannot run against toolkit root. Files here are the source of truth.',
            },
            emitJson,
          )
          return
        }
        const outcome = addProjectFace(resolved, resolve(file), {
          family: opts.family,
          weight: opts.weight,
          style: opts.style,
        })
        if (!outcome.ok) {
          process.exitCode = refuseFonts(title, outcome, emitJson)
          return
        }
        if (emitJson) writeJson(outcome)
        intro(title)
        logAdd(join(DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR, outcome.file))
        logInfo(
          `Declared ${outcome.family} ${outcome.weight} ${outcome.style} in ${outcome.sheet}`,
        )
        outro()
      },
    )
}

/**
 * Copies the base and stops. The override folder is deliberately not created:
 * an empty override is a file the project did not ask for and did not write,
 * the three-way merge already handles a missing side, and an empty file invites
 * a target to fill it before it has an opinion.
 */
async function runInstall(target: string): Promise<number> {
  intro('canon design install')

  const resolved = resolveTarget(target, PROJECT_ROOT)
  if (typeof resolved === 'number') {
    outro()
    return resolved
  }

  const source = join(PROJECT_ROOT, DESIGN_BASE_CSS)
  if (!existsSync(source)) {
    logError(
      `No base stylesheet at ${DESIGN_BASE_CSS}. Run canon design regen.`,
    )
    outro()
    return 1
  }

  const dir = join(resolved, DESIGN_INSTALL_DIR)
  mkdirSync(dir, { recursive: true })

  const dest = join(dir, basename(source))
  copyFileSync(source, dest)
  logAdd(relative(resolved, dest))

  await recordStamp(createDesignAdapter(PROJECT_ROOT), resolved, new Date())

  logInfo(
    `Override a value in ${join(DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR)}/, which sync leaves alone.`,
  )
  outro()
  return 0
}
