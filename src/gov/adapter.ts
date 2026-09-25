import { existsSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { canonRulesDir, ruleSubdir } from '@/gov/install'
import { loadRenames, resolveSuccessor } from '@/gov/renames'
import { resolveMissingRules } from '@/gov/stacks'
import type { InstalledFile, RetiredSurface, SyncAdapter } from '@/sync/engine'
import { readStamp, stampedChain } from '@/sync/stamp'

const RETIRED_GOV_FILE = join('.claude', 'GOV.md')

export function rulesSourceDir(root: string): string {
  return join(root, 'governance', 'rules')
}

/**
 * Maps a rule name to its source file. The bash used
 * `find governance/rules -name "<rule>.md" | head -n 1` once per installed
 * rule, which walked the whole tree per file and returned whichever match
 * the filesystem happened to yield first. Indexing once makes the walk single
 * pass and the winner deterministic when a name appears in two subdirectories.
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
 * Matches installed rules to sources by rule name rather than by relative
 * path, so a rule that moved between subdirectories in the toolkit still
 * syncs into the subdirectory the target already uses.
 *
 * Declares `ownsInstalledRoot` and no `projectSubdir`. A project keeps its own
 * rules under `.claude/rules/project/`, which `installedRoot` narrowing to
 * `.claude/rules/canon/` leaves outside the walk, so everything the walk does
 * reach is the toolkit's. A rule there with no source is one the toolkit
 * retired or renamed, and the sync deletes it rather than leaving it loaded.
 * A rename `governance/renames.toml` declares also installs the rule under its
 * new name.
 * A `projectSubdir` would compute a stale `canon/project/` destination, which
 * is wrong rather than merely redundant.
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
    stamp: { domain: 'governance', toolkitRoot: root },
  }
}

/**
 * Where the target already holds a rule, in whichever band folder. A
 * successor held outside the source's band stays where it is, the same way
 * `locateSource` syncs a moved rule in place, rather than gaining a second copy.
 *
 * Holding the predecessor is the whole entitlement test, so no stamped chain
 * is read here. That covers a rule `--add` layered on and a target installed
 * before chains were stamped alike.
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
 * Rules the target's recorded chain entitles it to and its tree does not
 * hold. Reports as `notice` text through the same shape `collectRetired`
 * already returns, since both are surfaces the file walk cannot see: one an
 * absence to remove, this one an absence to add.
 */
function collectMissingGov(root: string, target: string): RetiredSurface[] {
  const chain = stampedChain(readStamp(target), 'governance')

  return resolveMissingRules(root, target, chain).map((source) => {
    const dest = join(canonRulesDir(target), source.subdir, `${source.rule}.md`)
    const rel = relative(target, dest)
    return {
      path: dest,
      rel,
      notice: `${rel} (listed by ${chain[0]}, not installed. Run canon gov install ${chain[0]} to add it.)`,
    }
  })
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
