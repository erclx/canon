import { existsSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { readCoverage } from '@/gov/coverage'
import { canonRulesDir, ruleSubdir } from '@/gov/install'
import { loadRenames, resolveSuccessor } from '@/gov/renames'
import { loadSplits } from '@/gov/splits'
import { resolveMissingRules } from '@/gov/stacks'
import type { InstalledFile, RetiredSurface, SyncAdapter } from '@/sync/engine'
import { readStamp, stampedChain } from '@/sync/stamp'

const RETIRED_GOV_FILE = join('.claude', 'GOV.md')

export function rulesSourceDir(root: string): string {
  return join(root, 'governance', 'rules')
}

/**
 * Maps a rule name to its source file by indexing once, so the walk is a single
 * pass and the winner is deterministic when a name appears in two subdirectories.
 */
export function indexSourceRules(root: string): Map<string, string> {
  const dir = rulesSourceDir(root)
  const index = new Map<string, string>()
  if (!existsSync(dir)) return index

  const paths = [
    ...new Bun.Glob('**/*.md').scanSync({
      cwd: dir,
      onlyFiles: true,
      dot: true,
    }),
  ].sort()

  for (const path of paths) {
    const name = basename(path, '.md')
    if (!index.has(name)) index.set(name, resolve(dir, path))
  }

  return index
}

/**
 * Matches installed rules to sources by rule name, so a moved rule still syncs
 * in place. It declares `ownsInstalledRoot` and no `projectSubdir`, since a
 * walked rule with no source was retired and a subdir would go stale.
 */
export function createGovAdapter(root: string): SyncAdapter {
  const index = indexSourceRules(root)
  const renames = loadRenames(root)

  return {
    banner: 'canon gov sync',
    label: 'rules',
    missingMessage:
      "No governance surfaces found in target. Run 'canon gov install' first.",
    unit: 'changes',
    installedRoot: canonRulesDir,
    locateSource: (file: InstalledFile) =>
      index.get(basename(file.path, '.md')),
    collectRetired: (target: string) => collectRetiredGov(target),
    collectMissing: (target: string) => collectMissingGov(root, target),
    ownsInstalledRoot: true,
    locateSuccessor: (file: InstalledFile, target: string) => {
      const successor = resolveSuccessor(
        renames,
        index,
        basename(file.path, '.md'),
      )
      if (successor === undefined) return undefined

      const source = index.get(successor)
      if (source === undefined) return undefined

      return {
        source,
        dest:
          heldRulePath(target, successor) ??
          join(
            canonRulesDir(target),
            ruleSubdir(source, rulesSourceDir(root)),
            `${successor}.md`,
          ),
      }
    },
    coverage: readCoverage,
    stamp: { domain: 'governance', toolkitRoot: root },
  }
}

/**
 * Where the target already holds a rule, in whichever rule folder. A successor
 * held outside the source's folder stays put rather than gaining a second copy,
 * and holding the predecessor is the whole entitlement test, with no chain read.
 */
function heldRulePath(target: string, rule: string): string | undefined {
  const dir = canonRulesDir(target)
  if (!existsSync(dir)) return undefined

  for (const rel of new Bun.Glob(`**/${rule}.md`).scanSync({
    cwd: dir,
    onlyFiles: true,
    dot: true,
  })) {
    return join(dir, rel)
  }

  return undefined
}

/**
 * Rules the target's recorded chain entitles it to and its tree does not hold,
 * then the partners of a held rule that split. Reported as `notice` text like
 * `collectRetired`, since both are surfaces the file walk cannot see.
 */
function collectMissingGov(root: string, target: string): RetiredSurface[] {
  const chain = stampedChain(readStamp(target), 'governance')

  const fromChain = resolveMissingRules(root, target, chain).map((source) => {
    const dest = join(canonRulesDir(target), source.subdir, `${source.rule}.md`)
    const rel = relative(target, dest)
    return {
      path: dest,
      rel,
      notice: `${rel} (listed by ${chain[0]}, not installed. Run canon gov install ${chain[0]} to add it.)`,
    }
  })

  const listed = new Set(fromChain.map((entry) => entry.path))
  const fromSplits = collectSplitPartners(root, target).filter(
    (entry) => !listed.has(entry.path),
  )

  return [...fromChain, ...fromSplits]
}

/**
 * Partners the split ledger names for a rule the target holds and whose own
 * file it lacks. The ui rules sit in no stack, so holding the rule is the
 * entitlement, found by basename the way `heldRulePath` finds a predecessor.
 */
function collectSplitPartners(root: string, target: string): RetiredSurface[] {
  const splits = loadSplits(root)
  if (splits.size === 0) return []

  const index = indexSourceRules(root)
  const notices: RetiredSurface[] = []

  for (const [held, partners] of splits) {
    if (heldRulePath(target, held) === undefined) continue

    for (const partner of partners) {
      const source = index.get(partner)
      if (source === undefined || heldRulePath(target, partner) !== undefined) {
        continue
      }

      const dest = join(
        canonRulesDir(target),
        ruleSubdir(source, rulesSourceDir(root)),
        `${partner}.md`,
      )
      const rel = relative(target, dest)
      notices.push({
        path: dest,
        rel,
        notice: `${rel} (${held}.md moved bullets here. Run canon gov install --add ${partner} to add it.)`,
      })
    }
  }

  return notices
}

function collectRetiredGov(target: string): RetiredSurface[] {
  const path = join(target, RETIRED_GOV_FILE)
  if (!existsSync(path)) return []

  const rel = relative(target, path)
  return [
    {
      path,
      rel,
      notice: `${rel} (retired surface, scheduled for removal)`,
    },
  ]
}
