import { stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { $ } from 'bun'
import type { Command } from 'commander'
import { buildIndexCatalog } from '@/indexes/list'
import { exitCodeFor, type RegenResult, regenOne } from '@/indexes/regen'
import { gitEnv } from '@/git/env'
import { findIndexedAncestor, isIgnored, listIndexes } from '@/indexes/walk'
import { intro, logAdd, logInfo, logStep, logWarn, outro } from '@/ui'

interface RegenCommandOptions {
  readonly dryRun?: boolean
  readonly json?: boolean
  readonly root?: string
  readonly stage?: boolean
}

interface ListCommandOptions {
  readonly json?: boolean
}

export function register(program: Command): void {
  const indexes = program
    .command('indexes')
    .description('Regenerate index.md files from sibling frontmatter')
    .helpOption('-h, --help', 'Show this help message')

  indexes
    .command('regen')
    .description('Regenerate index.md files from sibling frontmatter')
    .argument(
      '[paths...]',
      'Paths to resolve up to their nearest indexed folder',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--dry-run', 'Report changes without writing')
    .option('--json', 'Emit a machine-readable record per index on stdout')
    .option('--root <path>', 'Walk-up boundary for positional paths')
    .option('--no-stage', 'Skip the auto git add on modified indexes')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  no drift, nothing to do',
        '  1  frontmatter error or missing index.md',
        '  2  --dry-run found folders that would change',
        '',
        'Examples:',
        '  canon indexes regen',
        '  canon indexes regen --dry-run',
        '  canon indexes regen --json docs/',
        '',
      ].join('\n'),
    )
    .action(async (paths: string[], opts: RegenCommandOptions) => {
      process.exitCode = await runRegen(paths, opts)
    })

  indexes
    .command('list')
    .description('Flatten every folder index under a path into one catalog')
    .argument('[path]', 'Folder to walk (default: cwd)')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable catalog on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  no frontmatter errors',
        '  1  root not a directory, or a folder failed frontmatter validation',
        '',
        'Examples:',
        '  canon indexes list',
        '  canon indexes list --json docs/',
        '',
      ].join('\n'),
    )
    .action(async (path: string | undefined, opts: ListCommandOptions) => {
      process.exitCode = await runList(path, opts)
    })
}

async function runRegen(
  paths: string[],
  opts: RegenCommandOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const dryRun = opts.dryRun ?? false
  const emitJson = opts.json ?? false

  if (!(await isDirectory(root))) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ error: `root not a directory: ${root}` })}\n`,
      )
      return 1
    }
    process.stderr.write(`Root is not a directory: ${root}\n`)
    return 1
  }

  const dirs =
    paths.length > 0
      ? collectFromPaths(paths, root)
      : (await listIndexes(root)).map(dirname)

  const shouldStage =
    paths.length > 0 && opts.stage !== false && !dryRun && !emitJson

  const results: RegenResult[] = []

  if (!emitJson) {
    intro('canon indexes')
    logStep(dryRun ? 'Indexes (dry-run)' : 'Indexes')
  }

  for (const dir of dirs) {
    const result = await regenOne(dir, { dryRun })
    results.push(result)

    for (const message of result.errors ?? []) {
      process.stderr.write(`ERROR: ${message}\n`)
    }

    if (!emitJson) await reportResult(result, root, shouldStage)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        dryRun,
        results: results.map(({ path, action, reason }) =>
          reason ? { path, action, reason } : { path, action },
        ),
      })}\n`,
    )
  } else {
    outro()
  }

  return exitCodeFor(results, { dryRun })
}

async function runList(
  path: string | undefined,
  opts: ListCommandOptions,
): Promise<number> {
  const root = resolve(path ?? process.cwd())
  const emitJson = opts.json ?? false

  if (!(await isDirectory(root))) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ error: `root not a directory: ${root}` })}\n`,
      )
      return 1
    }
    process.stderr.write(`Root is not a directory: ${root}\n`)
    return 1
  }

  const catalog = await buildIndexCatalog(root)

  for (const message of catalog.errors) {
    process.stderr.write(`ERROR: ${message}\n`)
  }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, ...catalog })}\n`)
  } else {
    intro('canon indexes list')
    logStep('Catalog')
    for (const entry of catalog.entries) {
      logInfo(`${entry.path}: ${entry.title} — ${entry.description}`)
    }
    outro()
  }

  return catalog.errors.length > 0 ? 1 : 0
}

function collectFromPaths(paths: string[], root: string): string[] {
  const dirs: string[] = []

  for (const path of paths) {
    const dir = findIndexedAncestor(resolve(root, path), root)
    if (!dir) {
      process.stderr.write(
        `WARN: ${path} has no index.md ancestor under ${root}\n`,
      )
      continue
    }
    if (!dirs.includes(dir)) dirs.push(dir)
  }

  return dirs
}

async function reportResult(
  result: RegenResult,
  root: string,
  shouldStage: boolean,
): Promise<void> {
  const rel = result.path.startsWith(`${root}/`)
    ? result.path.slice(root.length + 1)
    : result.path

  switch (result.action) {
    case 'written':
      logAdd(rel)
      if (shouldStage) await stage(result.path, rel, root)
      break
    case 'would-write':
      logWarn(`${rel} would change`)
      break
    case 'unchanged':
      logInfo(`${rel} unchanged`)
      break
    case 'skipped':
      logInfo(`${rel} skipped (auto:false)`)
      break
    case 'error':
      logWarn(`${rel} error`)
      break
  }
}

async function stage(path: string, rel: string, root: string): Promise<void> {
  if (await isIgnored(root, path)) return

  const staged = await $`git -C ${root} add -- ${path}`
    .env(gitEnv())
    .quiet()
    .nothrow()
    .then((result) => result.exitCode === 0)

  if (staged) {
    logInfo(`staged ${rel}`)
  } else {
    logWarn(`failed to stage ${rel}`)
  }
}

async function isDirectory(path: string): Promise<boolean> {
  return stat(path)
    .then((info) => info.isDirectory())
    .catch(() => false)
}
