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
import {
  FILE_LINE_LIMIT,
  FUNCTION_LINE_CHECKPOINT,
  LENGTH_SOURCE,
  type LongFile,
  type LongFunction,
  longCode,
  type UnreadFile,
} from '@/code/length'
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
      'Fail on a page, stylesheet, or script embedded in source past the line limit, and report long files and functions',
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
        `It also reports each code file past ${FILE_LINE_LIMIT} lines, tests included, and each`,
        `top-level function past ${FUNCTION_LINE_CHECKPOINT} lines in TypeScript, JavaScript, Astro`,
        'frontmatter, and Python. JSX, callbacks passed to describe, it, or test, and',
        'test_ functions in a test_*.py or *_test.py file are not read. A Python file',
        'whose strings, brackets, or indentation cannot be followed is listed under',
        'unreadFiles with its line and reason, never skipped in silence.',
        'None of these moves the exit code.',
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
  const inScope = listed.filter(
    (file) =>
      prefixes.length === 0 ||
      prefixes.some(
        (prefix) =>
          prefix === '' || file === prefix || file.startsWith(`${prefix}/`),
      ),
  )
  const files = inScope.filter((file) => EMBEDDED_SOURCE.test(file))
  const codeFiles = inScope.filter((file) => LENGTH_SOURCE.test(file))

  const blocks = files
    .flatMap((file) =>
      embeddedBlocksInFile(file, readFileSync(join(root, file), 'utf8')),
    )
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

  const { longFiles, longFunctions, unreadFiles } = longCode(
    codeFiles.map((file) => ({
      file,
      source: readFileSync(join(root, file), 'utf8'),
    })),
  )

  intro('canon code audit')
  report(files.length, blocks)
  reportLength(codeFiles.length, longFiles, longFunctions, unreadFiles)
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
        fileLimit: FILE_LINE_LIMIT,
        functionCheckpoint: FUNCTION_LINE_CHECKPOINT,
        longFiles,
        longFunctions,
        unreadFiles,
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

function reportLength(
  files: number,
  longFiles: readonly LongFile[],
  longFunctions: readonly LongFunction[],
  unreadFiles: readonly UnreadFile[],
): void {
  logStep('Length')
  logInfo(plural(files, 'code file'))

  if (longFiles.length === 0) logInfo(`No file past ${FILE_LINE_LIMIT} lines.`)
  for (const file of longFiles) {
    logWarn(`${file.file} runs ${plural(file.lines, 'line')}`)
  }

  if (longFunctions.length === 0) {
    logInfo(`No function past ${FUNCTION_LINE_CHECKPOINT} lines.`)
  }
  for (const fn of longFunctions) {
    logWarn(
      `${fn.file}:${fn.line} ${fn.name ?? 'an unnamed function'} runs ${plural(fn.lines, 'line')}`,
    )
  }

  for (const file of unreadFiles) {
    logWarn(
      `${file.file}:${file.line} was not read for functions: ${file.reason}`,
    )
  }
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
