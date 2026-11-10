import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { Command } from 'commander'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  EMBEDDED_LINE_LIMIT,
  EMBEDDED_MARKER,
  EMBEDDED_SOURCE,
  type EmbeddedBlock,
  embeddedBlocksInFile,
} from '@/code/embedded'
import { listRepositoryFiles } from '@/git/files'

const EXIT_REFUSED = 1
const EXIT_FINDING = 2

type AuditRefusal = 'missing-path' | 'unlisted'

interface AuditCommandOptions {
  readonly json?: boolean
}

export function register(program: Command): void {
  const code = program
    .command('code')
    .description('Report source files against the code standards')
    .helpOption('-h, --help', 'Show this help message')

  code
    .command('audit')
    .description(
      'Fail on a page, stylesheet, or script embedded in source past the line limit',
    )
    .argument(
      '[path...]',
      'Files or directories, defaulting to every file git lists',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  no block past the limit',
        '  1  refused, with the reason on stderr',
        '  2  a block sits past the limit',
        '',
        `Reads TypeScript and Astro files. A block past ${EMBEDDED_LINE_LIMIT} static lines,`,
        'or a shell script that branches at any length, belongs in its own file.',
        'In an .astro file it also reads a frontmatter string a <script> or',
        '<style> takes through set:html, and an is:inline script body.',
        `Mark the opening line, or the line above it, "${EMBEDDED_MARKER}: <reason>"`,
        'where a block must stay inline.',
        '',
        'Examples:',
        '  canon code audit',
        '  canon code audit --json',
        '  canon code audit src web/src/layouts',
        '',
      ].join('\n'),
    )
    .action(async (paths: string[], opts: AuditCommandOptions) => {
      process.exitCode = await runAudit(paths, opts)
    })
}

async function runAudit(
  paths: readonly string[],
  opts: AuditCommandOptions,
): Promise<number> {
  const root = process.cwd()
  const emitJson = opts.json ?? false

  const missing = paths.filter((path) => !existsSync(resolve(root, path)))
  if (missing.length > 0) {
    return refuse(
      'missing-path',
      `No file or directory at: ${missing.join(', ')}.`,
      root,
      emitJson,
    )
  }

  const listed = await listRepositoryFiles(root)
  if (listed === undefined) {
    return refuse(
      'unlisted',
      `git could not list the files under ${root}, so nothing was read.`,
      root,
      emitJson,
    )
  }

  const prefixes = paths.map((path) => relative(root, resolve(root, path)))
  const files = listed.filter(
    (file) =>
      EMBEDDED_SOURCE.test(file) &&
      (prefixes.length === 0 ||
        prefixes.some(
          (prefix) =>
            prefix === '' || file === prefix || file.startsWith(`${prefix}/`),
        )),
  )

  const blocks = files
    .flatMap((file) =>
      embeddedBlocksInFile(file, readFileSync(join(root, file), 'utf8')),
    )
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

  intro('canon code audit')
  report(files.length, blocks)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        files: files.length,
        limit: EMBEDDED_LINE_LIMIT,
        blocks: blocks.map((block) => ({
          file: block.file,
          line: block.line,
          kind: block.kind,
          lines: block.lines,
          branches: block.branches,
        })),
      })}\n`,
    )
  }

  return blocks.length > 0 ? EXIT_FINDING : 0
}

function report(files: number, blocks: readonly EmbeddedBlock[]): void {
  logStep('Embedded code')
  logInfo(plural(files, 'source file'))

  if (blocks.length === 0) {
    logInfo(`No block past ${EMBEDDED_LINE_LIMIT} lines.`)
    return
  }

  for (const block of blocks) {
    logWarn(
      `${block.file}:${block.line} embeds ${block.branches ? 'a branching script' : `a ${block.kind} of ${plural(block.lines, 'line')}`}`,
    )
  }
  logWarn(
    `Move each into its own file with its language's extension, or mark the opening line "${EMBEDDED_MARKER}: <reason>" where it must stay inline.`,
  )
}

function refuse(
  reason: AuditRefusal,
  message: string,
  root: string,
  emitJson: boolean,
): number {
  intro('canon code audit')
  logStep('Refused')
  logWarn(message)
  outro()

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, reason, message })}\n`)
  }

  return EXIT_REFUSED
}
