import { resolve } from 'node:path'
import type { Command } from 'commander'
import {
  census,
  FOLDER_FILE_CHECKPOINT,
  PREFIX_GROUP_CHECKPOINT,
  type CensusRefusal,
} from '@/census/count'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'

interface CensusCommandOptions {
  readonly json?: boolean
}

const REFUSALS: Record<CensusRefusal, string> = {
  'no-git': 'git could not list this tree, so the corpus is unknown.',
}

export function register(program: Command): void {
  program
    .command('census')
    .description(
      'Report tracked file count, a breakdown by extension, and line totals',
    )
    .argument('[path]', 'Tree to census, defaulting to the current directory')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Scope:',
        '  Tracked files plus untracked files git does not ignore, the same',
        '  corpus the citation check, the markdown corpus, and the secret',
        '  scan already read. A line total skips whatever reads as binary.',
        '',
        'Folders:',
        `  Only folders holding ${FOLDER_FILE_CHECKPOINT} or more files of their own are listed, each`,
        '  counted without its subfolders. A fixtures folder is left out.',
        '',
        'Prefix groups:',
        `  Sibling files in one folder whose stems share the text before the first`,
        `  hyphen or underscore, listed at ${PREFIX_GROUP_CHECKPOINT} or more distinct stems and at any`,
        '  folder size. A stem is the name up to its first dot, so a module and its',
        '  test count once. A group is a pointer to read the roles, never a finding.',
        '  A fixtures folder is left out.',
        '',
        'Exit codes:',
        '  0  the census completed',
        '  1  refused, with the reason on stderr',
        '',
        'Examples:',
        '  canon census',
        '  canon census src --json',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: CensusCommandOptions) => {
      process.exitCode = await runCensus(path, opts)
    })
}

async function runCensus(
  path: string | undefined,
  opts: CensusCommandOptions,
): Promise<number> {
  const root = resolve(path ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon census')

  const result = await census(root)

  if (result.kind === 'refused') {
    logStep('Refused')
    logWarn(REFUSALS[result.reason])
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          reason: result.reason,
          message: REFUSALS[result.reason],
        })}\n`,
      )
    }
    return 1
  }

  logStep('Files')
  logInfo(
    `${plural(result.files, 'file')}, ${result.skipped} skipped as binary or unreadable`,
  )

  logStep('By extension')
  for (const entry of result.byExtension) {
    logInfo(
      `${entry.extension}: ${plural(entry.files, 'file')}, ${entry.lines} lines`,
    )
  }

  logStep('Folders')
  if (result.folders.length === 0) {
    logInfo(`none hold ${FOLDER_FILE_CHECKPOINT} or more files`)
  }
  for (const folder of result.folders) {
    const kinds = folder.byExtension
      .map((entry) => `${entry.extension} ${entry.files}`)
      .join(', ')
    logInfo(`${folder.path}: ${plural(folder.files, 'file')} (${kinds})`)
  }

  logStep('Prefix groups')
  if (result.prefixGroups.length === 0) {
    logInfo(`none reach ${PREFIX_GROUP_CHECKPOINT} sibling stems`)
  }
  for (const group of result.prefixGroups) {
    logInfo(
      `${group.path}: ${group.prefix}, ${plural(group.stems.length, 'stem')} (${group.stems.join(', ')})`,
    )
  }

  logStep('Lines')
  logInfo(`${result.lines} counted, skipping binary or unreadable files`)

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        files: result.files,
        skipped: result.skipped,
        lines: result.lines,
        byExtension: result.byExtension,
        folderCheckpoint: FOLDER_FILE_CHECKPOINT,
        folders: result.folders,
        prefixGroupCheckpoint: PREFIX_GROUP_CHECKPOINT,
        prefixGroups: result.prefixGroups,
      })}\n`,
    )
  }

  return 0
}
