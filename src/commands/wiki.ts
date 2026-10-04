import { resolve } from 'node:path'
import type { Command } from 'commander'
import { PROJECT_ROOT } from '@/roots/project'
import {
  intro,
  logAdd,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  palette,
  select,
} from '@/ui'
import {
  applyWikiInit,
  isWikiTarget,
  LEGACY_WIKI_DIR_REL,
  planWikiInit,
  WIKI_DIR_REL,
  WIKI_INDEX_REL,
} from '@/wiki/init'

export function register(program: Command): void {
  const wiki = program
    .command('wiki')
    .description('Wiki commands (init)')
    .helpOption('-h, --help', 'Show this help message')

  wiki
    .command('init')
    .description('Scaffold .claude/wiki/ with a stub index.md')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .action(async (target: string) => {
      process.exitCode = await runInit(target)
    })
}

async function runInit(target: string): Promise<number> {
  intro('canon wiki')

  const resolved = resolve(target)

  if (!isWikiTarget(resolved)) {
    logError(`Target directory not found: ${target}`)
    outro()
    return 1
  }

  if (resolved === PROJECT_ROOT) {
    logError(
      'Cannot run against toolkit root. Files here are the source of truth.',
    )
    outro()
    return 1
  }

  const plan = planWikiInit(resolved)
  const { GREEN, NC } = palette(process.stderr)

  logStep(`Scanning ${WIKI_DIR_REL}`)
  if (plan.changes.includes('dir')) logAdd(WIKI_DIR_REL)
  if (plan.hasIndex) logInfo(WIKI_INDEX_REL)
  else logAdd(WIKI_INDEX_REL)

  if (plan.hasLegacyWiki) {
    logWarn(`${LEGACY_WIKI_DIR_REL} found at the target root, not migrated`)
  }

  const count = plan.changes.length
  if (count === 0) {
    outro()
    process.stderr.write(`${GREEN}✓ Wiki already initialized${NC}\n`)
    return 0
  }

  const shouldApply = await select({
    message: `Apply ${count} change(s)?`,
    options: [
      { value: true, label: 'Apply all' },
      { value: false, label: 'Cancel' },
    ],
    nonInteractiveDefault: true,
  })

  if (!shouldApply) {
    logWarn('Cancelled')
    outro()
    return 0
  }

  logStep('Applying changes')
  await applyWikiInit(resolved, plan)
  if (plan.changes.includes('index')) logAdd(WIKI_INDEX_REL)

  outro()
  process.stderr.write(`${GREEN}✓ Wiki ready${NC}\n`)
  return 0
}
