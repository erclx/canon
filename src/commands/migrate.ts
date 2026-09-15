import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Command } from 'commander'
import { listRepositoryFiles } from '@/git-files'
import { indexSourceRules } from '@/gov/adapter'
import { applyRecordsMove, applyRename, readSources } from '@/migrate/apply'
import { isToolkitOwned, planRename, type RenamePlan } from '@/migrate/plan'
import { AITK_RULES, type RenameRules } from '@/migrate/rename'
import {
  applyRecordTree,
  planRecordTree,
  readRecordTree,
  type RecordTreePlan,
  walkRecordTree,
} from '@/migrate/record-tree'
import {
  ignoresDestination,
  isRecordArtifact,
  planRecordsMove,
  type RecordsPlan,
} from '@/migrate/records'
import {
  applyRuleLayout,
  planRuleLayout,
  type RuleLayoutPlan,
  walkFlatRules,
} from '@/migrate/rule-layout'
import { SKILL_NAME_MAP, SKILL_NAME_RULES } from '@/migrate/skill-names'
import {
  planSurfaceRootsMove,
  type SurfaceRootsPlan,
} from '@/migrate/surface-roots'
import {
  applyRecordLayout,
  planRecordLayout,
  readRecordLayoutCorpus,
  type RecordLayoutPlan,
  walkRecordLayoutCorpus,
} from '@/migrate/record-layout'
import {
  applyScratchEvidence,
  planScratchEvidence,
  readScratchEvidenceCorpus,
  type ScratchEvidencePlan,
  walkScratchEvidenceCorpus,
} from '@/migrate/scratch-evidence'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/project-root'
import { readStamp, stampedHashes } from '@/sync/stamp'
import { logError, logInfo, logStep, logWarn, plural } from '@/ui'

interface SweepOptions {
  readonly json?: boolean
  readonly write?: boolean
  readonly root?: string
}

interface RenameOptions extends SweepOptions {
  readonly scope?: string
}

const SCOPES = ['self', 'target'] as const

type Scope = (typeof SCOPES)[number]

function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value)
}

/**
 * The `aitk` sweep, which is the one rename with a second population to name.
 * A target holds toolkit-owned folders whose content came from here beside
 * prose that project wrote, and the scope is what separates them.
 */
async function runRename(opts: RenameOptions): Promise<number> {
  const scope = opts.scope ?? 'self'

  if (!isScope(scope)) {
    logError(`Unknown scope ${scope}. Use one of ${SCOPES.join(', ')}.`)
    return 1
  }

  return runSweep(opts, AITK_RULES, scope)
}

/**
 * The skill rename owns no scope. Every folder it moves is authored here, and
 * no target holds a copy of this repository's skill catalog, so there is no
 * second population for a caller to name.
 */
async function runSkillNames(opts: SweepOptions): Promise<number> {
  return runSweep(opts, SKILL_NAME_RULES, undefined)
}

/**
 * One sweep over a repository's tracked files under whichever rules it was
 * handed.
 *
 * Reports rather than writes without `--write`, matching `canon records
 * migrate`. A rename touching this many files has no undo short of the branch
 * it ran on, so the safe outcome sits on the default path.
 */
async function runSweep(
  opts: SweepOptions,
  rules: RenameRules,
  scope: Scope | undefined,
): Promise<number> {
  const root = opts.root ?? process.cwd()

  const files = await listRepositoryFiles(root)
  if (files === undefined) {
    logError(`Could not list files under ${root}. Is it a git repository?`)
    return 1
  }

  const scoped = scope === 'target' ? files.filter(isToolkitOwned) : files
  const sources = await readSources(root, scoped)
  const plan = planRename(sources, rules)

  // A target scope reports the citations it did not rewrite, since prose the
  // project wrote is theirs to change and a sweep editing it underneath them
  // is the failure this scope exists to avoid.
  const citations =
    scope === 'target'
      ? planRename(
          await readSources(
            root,
            files.filter((f) => !isToolkitOwned(f)),
          ),
          rules,
        ).entries.length
      : 0

  // stdout, so the record pipes clean. `pipeOutput` frames to stderr, which is
  // where this command's report belongs and where a JSON record does not.
  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(toRecord(plan, scope, citations, opts.write), null, 2)}\n`,
    )
  }

  report(plan, scope, citations)

  if (plan.entries.length === 0) return 0
  if (!opts.write) {
    logWarn('Nothing was written. Pass --write to apply this plan.')
    return 2
  }

  const applied = await applyRename(root, plan)
  logStep(
    `Rewrote ${plural(applied.written, 'file')} and moved ${plural(applied.moved, 'path')}.`,
  )

  if (applied.failed.length > 0) {
    logError(`Could not move ${plural(applied.failed.length, 'path')}.`)
    for (const path of applied.failed) logError(`  ${path}`)
    return 1
  }

  return 0
}

function report(
  plan: RenamePlan,
  scope: Scope | undefined,
  citations: number,
): void {
  if (scope !== undefined) logInfo(`Scope ${scope}.`)
  logInfo(
    `${plural(plan.entries.length, 'file')} to change, ${plural(plan.renamed, 'occurrence')} to rewrite.`,
  )
  logInfo(`${plural(plan.moves, 'path')} to move.`)
  logInfo(
    `${plural(plan.protectedCount, 'occurrence')} protected and left alone.`,
  )

  if (plan.excluded.length > 0) {
    logInfo(`Excluded: ${plan.excluded.join(', ')}.`)
  }

  if (citations > 0) {
    logWarn(
      `${plural(citations, 'file')} outside toolkit-owned folders still cite the old name. They are yours to change.`,
    )
  }
}

function toRecord(
  plan: RenamePlan,
  scope: Scope | undefined,
  citations: number,
  wrote: boolean | undefined,
): unknown {
  return {
    ...(scope === undefined ? {} : { scope }),
    wrote: wrote === true,
    files: plan.entries.length,
    renamed: plan.renamed,
    moves: plan.moves,
    protected: plan.protectedCount,
    excluded: plan.excluded,
    citations,
    paths: plan.entries.map((entry) => ({
      path: entry.path,
      ...(entry.movesTo === undefined ? {} : { movesTo: entry.movesTo }),
      renamed: entry.renamed,
    })),
  }
}

interface RecordsOptions {
  readonly json?: boolean
  readonly write?: boolean
  readonly root?: string
}

/**
 * Moves a project's session records to `.canon/` and repoints what cites them.
 *
 * The ignore gate runs before anything is planned. Every folder being moved is
 * ignored where it stands, so landing them under a root the project does not
 * ignore publishes the memory pen into the next commit, and reporting a plan
 * the caller cannot safely apply is worse than refusing to draw one.
 */
async function runRecords(opts: RecordsOptions): Promise<number> {
  const root = opts.root ?? process.cwd()

  const gitignore = readGitignore(root)
  if (gitignore === undefined) {
    logError(
      `No .gitignore at ${root}, so the records cannot be moved somewhere they stay ignored.`,
    )
    return 1
  }

  if (!ignoresDestination(gitignore)) {
    logError(
      'This project does not ignore .canon/, and every record folder being moved is ignored where it stands.',
    )
    logError(
      'Run canon tooling sync --write to take the ignore entry, then run this again.',
    )
    return 1
  }

  const files = await listRepositoryFiles(root)
  if (files === undefined) {
    logError(`Could not list files under ${root}. Is it a git repository?`)
    return 1
  }

  // Filtered before the read rather than inside the planner, because the
  // records are the largest thing in the tree and `readSources` awaits one file
  // at a time. This repository's own record tree is 9,744 files at 83M, and the
  // backup history under it is object files read whole and discarded as binary.
  const toSweep = files.filter((path) => !isRecordArtifact(path))
  const records = files.length - toSweep.length

  const plan = planRecordsMove(root, await readSources(root, toSweep))

  // stdout, so the record pipes clean. `pipeOutput` frames to stderr, which is
  // where this command's report belongs and where a JSON record does not.
  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(toRecordsRecord(plan, records, opts.write))}\n`,
    )
  }

  reportRecords(plan, records)

  if (plan.collisions.length > 0) {
    logError(
      `${plural(plan.collisions.length, 'destination')} already exist under .canon/. Merging two record folders is not a call this verb takes.`,
    )
    for (const path of plan.collisions) logError(`  ${path}`)
    return 1
  }

  if (plan.moves.length === 0 && plan.entries.length === 0) return 0

  if (!opts.write) {
    logWarn('Nothing was written. Pass --write to apply this plan.')
    return 2
  }

  const applied = await applyRecordsMove(root, plan)
  logStep(
    `Rewrote ${plural(applied.written, 'file')} and moved ${plural(applied.moved, 'folder')}.`,
  )

  // `failed` carries a citation the write loop could not land as well as a
  // folder the rename loop stopped on, so the line names a path rather than a
  // folder. Reading a rejected write back as a folder that would not move sends
  // the reader looking at the wrong half of the verb.
  if (applied.failed.length > 0) {
    logError(`Could not write ${plural(applied.failed.length, 'path')}.`)
    for (const path of applied.failed) logError(`  ${path}`)
    return 1
  }

  return 0
}

function readGitignore(root: string): string | undefined {
  try {
    return readFileSync(join(root, '.gitignore'), 'utf8')
  } catch {
    return undefined
  }
}

function reportRecords(plan: RecordsPlan, records: number): void {
  logInfo(`${plural(plan.moves.length, 'folder')} to move.`)
  for (const move of plan.moves) logInfo(`  ${move.from} -> ${move.to}`)
  logInfo(
    `${plural(plan.entries.length, 'file')} to change, ${plural(plan.rewritten, 'citation')} to rewrite.`,
  )
  logInfo(`${plural(plan.kept, 'citation')} marked to keep the old root.`)

  // A count rather than a list, and its own line rather than a place in
  // `excluded`. That field exists so a reader can go and check a handful by
  // hand, and a record tree would bury them. The count is what answers the
  // question a target actually has, which is where the rest of the files went.
  if (records > 0) {
    logInfo(`${plural(records, 'file')} under a record root, left alone.`)
  }

  if (plan.excluded.length > 0) {
    logInfo(`${plural(plan.excluded.length, 'file')} excluded from the sweep.`)
  }

  // A list rather than a count. A coupled file is the handful an operator has
  // to open by hand, and a bare count gives them nothing to act on.
  if (plan.coupled.length > 0) {
    logInfo(
      `${plural(plan.coupled.length, 'file')} couple to an excluded path:`,
    )
    for (const path of plan.coupled) logInfo(`  ${path}`)
  }

  // Named individually rather than counted. A rewritten glob stops matching
  // silently, which is the failure this boundary exists to surface, so the
  // report gives the reader the file and line to go and check by hand.
  if (plan.frontmatterGlobs.length > 0) {
    logInfo(
      `${plural(plan.frontmatterGlobs.length, 'file')} carry a frontmatter paths: glob left alone:`,
    )
    for (const entry of plan.frontmatterGlobs) {
      for (const line of entry.lines) {
        logInfo(`  ${entry.path}:${line.line}  ${excerpt(line.text)}`)
      }
    }
  }

  // Named individually, same reasoning as the glob report above: an ownership
  // boundary and a tense judgment stop being visible the moment either is
  // rewritten, so the reader gets the file and line rather than a count.
  if (plan.crossRepoCitations.length > 0) {
    logInfo(
      `${plural(plan.crossRepoCitations.length, 'file')} carry a citation into another repository, left alone:`,
    )
    for (const entry of plan.crossRepoCitations) {
      for (const line of entry.lines) {
        logInfo(`  ${entry.path}:${line.line}  ${excerpt(line.text)}`)
      }
    }
  }

  if (plan.datedCitations.length > 0) {
    logInfo(
      `${plural(plan.datedCitations.length, 'file')} carry a dated citation, left alone:`,
    )
    for (const entry of plan.datedCitations) {
      for (const line of entry.lines) {
        logInfo(`  ${entry.path}:${line.line}  ${excerpt(line.text)}`)
      }
    }
  }
}

function toRecordsRecord(
  plan: RecordsPlan,
  records: number,
  wrote: boolean | undefined,
): unknown {
  return {
    ok: plan.collisions.length === 0,
    wrote: wrote === true,
    moves: plan.moves,
    collisions: plan.collisions,
    files: plan.entries.length,
    rewritten: plan.rewritten,
    kept: plan.kept,
    excluded: plan.excluded.length,
    coupled: plan.coupled,
    frontmatterGlobs: plan.frontmatterGlobs,
    crossRepoCitations: plan.crossRepoCitations,
    datedCitations: plan.datedCitations,
    globs: plan.globs,
    crossRepo: plan.crossRepo,
    dated: plan.dated,
    records,
    paths: plan.entries.map((entry) => ({
      path: entry.path,
      rewritten: entry.rewritten,
    })),
  }
}

/**
 * Moves the tracked toolkit surfaces to `canon/` and repoints what cites them.
 *
 * Every path here is tracked, so the write goes through `applyRename`'s
 * `git mv` rather than the records move's plain rename, and the history
 * follows each file. A destination already on disk refuses the whole plan,
 * since `git mv` onto an existing path fails per file and leaves a tree split
 * across both roots.
 */
async function runSurfaceRoots(opts: SweepOptions): Promise<number> {
  const root = opts.root ?? process.cwd()

  const files = await listRepositoryFiles(root)
  if (files === undefined) {
    logError(`Could not list files under ${root}. Is it a git repository?`)
    return 1
  }

  const toSweep = files.filter((path) => !isRecordArtifact(path))
  const plan = planSurfaceRootsMove(await readSources(root, toSweep))
  const taken = plan.entries
    .map((entry) => entry.movesTo)
    .filter((to): to is string => to !== undefined)
    .filter((to) => existsSync(join(root, to)))

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(toSurfaceRootsRecord(plan, taken, opts.write))}\n`,
    )
  }

  reportSurfaceRoots(plan)

  if (taken.length > 0) {
    logError(
      `${plural(taken.length, 'destination')} already exist under canon/. Merging two copies of a surface is not a call this verb takes.`,
    )
    for (const path of taken) logError(`  ${path}`)
    return 1
  }

  if (plan.entries.length === 0) return 0

  if (!opts.write) {
    logWarn('Nothing was written. Pass --write to apply this plan.')
    return 2
  }

  const applied = await applyRename(root, {
    entries: plan.entries.map((entry) => ({
      path: entry.path,
      ...(entry.movesTo === undefined ? {} : { movesTo: entry.movesTo }),
      ...(entry.text === undefined ? {} : { text: entry.text }),
      renamed: entry.rewritten,
      protectedCount: entry.kept,
    })),
    excluded: plan.excluded,
    renamed: plan.rewritten,
    protectedCount: plan.kept,
    moves: plan.moves,
  })
  logStep(
    `Rewrote ${plural(applied.written, 'file')} and moved ${plural(applied.moved, 'file')}.`,
  )

  if (applied.failed.length > 0) {
    logError(`Could not move ${plural(applied.failed.length, 'path')}.`)
    for (const path of applied.failed) logError(`  ${path}`)
    return 1
  }

  return 0
}

function reportSurfaceRoots(plan: SurfaceRootsPlan): void {
  logInfo(`${plural(plan.moves, 'file')} to move.`)
  logInfo(
    `${plural(plan.entries.filter((entry) => entry.text !== undefined).length, 'file')} to change, ${plural(plan.rewritten, 'citation')} to rewrite.`,
  )
  logInfo(`${plural(plan.kept, 'citation')} marked to keep the old root.`)

  if (plan.excluded.length > 0) {
    logInfo(`${plural(plan.excluded.length, 'file')} excluded from the sweep:`)
    for (const path of plan.excluded) logInfo(`  ${path}`)
  }

  if (plan.coupled.length > 0) {
    logInfo(
      `${plural(plan.coupled.length, 'file')} couple to an excluded path:`,
    )
    for (const path of plan.coupled) logInfo(`  ${path}`)
  }

  for (const [label, held] of [
    ['a frontmatter paths: glob', plan.frontmatterGlobs],
    ['a citation into another repository', plan.crossRepoCitations],
    ['a dated citation', plan.datedCitations],
  ] as const) {
    if (held.length === 0) continue
    logInfo(`${plural(held.length, 'file')} carry ${label}, left alone:`)
    for (const entry of held) {
      for (const line of entry.lines) {
        logInfo(`  ${entry.path}:${line.line}  ${excerpt(line.text)}`)
      }
    }
  }
}

function toSurfaceRootsRecord(
  plan: SurfaceRootsPlan,
  collisions: readonly string[],
  wrote: boolean | undefined,
): unknown {
  return {
    ok: collisions.length === 0,
    wrote: wrote === true,
    moves: plan.moves,
    collisions,
    files: plan.entries.length,
    rewritten: plan.rewritten,
    kept: plan.kept,
    excluded: plan.excluded,
    coupled: plan.coupled,
    frontmatterGlobs: plan.frontmatterGlobs,
    crossRepoCitations: plan.crossRepoCitations,
    datedCitations: plan.datedCitations,
    globs: plan.globs,
    crossRepo: plan.crossRepo,
    dated: plan.dated,
    paths: plan.entries.map((entry) => ({
      path: entry.path,
      ...(entry.movesTo === undefined ? {} : { movesTo: entry.movesTo }),
      rewritten: entry.rewritten,
    })),
  }
}

interface RecordTreeOptions {
  readonly json?: boolean
  readonly write?: boolean
  readonly root?: string
}

/**
 * Repoints the old-root citations left inside the record tree itself.
 *
 * The sibling verb sweeps a git listing, which reaches every tracked file and
 * none of the records, since those are gitignored by construction. This one
 * walks the new root directly and is scoped to the folders a session still
 * follows a path into, so the closed trails and the scratch folder keep saying
 * what they say.
 *
 * No ignore gate here. Nothing moves, so there is no destination whose ignore
 * status could publish a record, and a run in a project the move has not
 * reached finds no new root to walk and reports nothing.
 */
async function runRecordTree(opts: RecordTreeOptions): Promise<number> {
  const root = opts.root ?? process.cwd()

  const walk = await walkRecordTree(root)
  const plan = planRecordTree(
    await readRecordTree(root, walk.files),
    walk.excluded,
    walk.skipped,
  )

  // stdout, so the record pipes clean. `pipeOutput` frames to stderr, which is
  // where this command's report belongs and where a JSON record does not.
  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(toRecordTreeRecord(plan, walk.files.length, opts.write))}\n`,
    )
  }

  reportRecordTree(plan, walk.files.length)

  if (plan.entries.length === 0) return 0

  if (!opts.write) {
    logWarn('Nothing was written. Pass --write to apply this plan.')
    return 2
  }

  const applied = await applyRecordTree(root, plan)
  logStep(`Rewrote ${plural(applied.written, 'file')}.`)

  if (applied.failed.length > 0) {
    logError(`Could not write ${plural(applied.failed.length, 'file')}.`)
    for (const path of applied.failed) logError(`  ${path}`)
    return 1
  }

  return 0
}

/** How much of a citation's line the report prints before it wraps. */
const LINE_WIDTH = 160

function excerpt(text: string): string {
  return text.length <= LINE_WIDTH ? text : `${text.slice(0, LINE_WIDTH)}…`
}

/**
 * Names every citation with the line it sits on.
 *
 * The record tree is untracked and unbacked, so a wrong rewrite has no git undo
 * and a count would give a reader nothing to judge before passing `--write`.
 * The excluded corpora take the opposite treatment for the same reason
 * `reportRecords` counts the records it skips: they are thousands of files
 * nobody is being asked to check.
 */
function reportRecordTree(plan: RecordTreePlan, swept: number): void {
  logInfo(`${plural(swept, 'file')} in the live record surface.`)
  logInfo(
    `${plural(plan.entries.length, 'file')} to change, ${plural(plan.rewritten, 'citation')} to rewrite.`,
  )

  for (const entry of plan.entries) {
    for (const line of entry.lines) {
      logInfo(`  ${entry.path}:${line.line}  ${excerpt(line.text)}`)
    }
  }

  logInfo(`${plural(plan.kept, 'citation')} marked to keep the old root.`)

  for (const corpus of plan.excluded) {
    logInfo(`  ${corpus.path}: ${plural(corpus.files, 'file')}, left alone.`)
  }

  for (const path of plan.skipped) {
    logInfo(`  ${path}: a git object store, skipped by name.`)
  }
}

function toRecordTreeRecord(
  plan: RecordTreePlan,
  swept: number,
  wrote: boolean | undefined,
): unknown {
  return {
    ok: true,
    wrote: wrote === true,
    swept,
    files: plan.entries.length,
    rewritten: plan.rewritten,
    kept: plan.kept,
    excluded: plan.excluded,
    skipped: plan.skipped,
    paths: plan.entries.map((entry) => ({
      path: entry.path,
      rewritten: entry.rewritten,
      lines: entry.lines,
    })),
  }
}

interface ScratchEvidenceOptions {
  readonly json?: boolean
  readonly write?: boolean
  readonly root?: string
}

/**
 * Moves the nine cited-and-unwritten folders under `.canon/tmp/` to
 * `.canon/review/evidence/`, and repoints the citations that name them,
 * archives included.
 */
async function runScratchEvidence(
  opts: ScratchEvidenceOptions,
): Promise<number> {
  const root = opts.root ?? process.cwd()

  const files = await walkScratchEvidenceCorpus(root)
  const sources = await readScratchEvidenceCorpus(files)
  const plan = planScratchEvidence(root, sources)

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(toScratchEvidenceRecord(plan, opts.write))}\n`,
    )
  }

  reportScratchEvidence(plan)

  if (plan.collisions.length > 0) {
    logError(
      `${plural(plan.collisions.length, 'destination')} already occupied. Neither side moved.`,
    )
    for (const collision of plan.collisions) logError(`  ${collision}`)
  }

  if (plan.moves.length === 0 && plan.entries.length === 0) {
    return plan.collisions.length > 0 ? 1 : 0
  }

  if (!opts.write) {
    logWarn('Nothing was written. Pass --write to apply this plan.')
    return 2
  }

  const applied = await applyScratchEvidence(plan)
  logStep(
    `Moved ${plural(applied.moved, 'folder')} and rewrote ${plural(applied.written, 'file')}.`,
  )

  if (applied.failed.length > 0) {
    logError(`Could not write ${plural(applied.failed.length, 'file')}.`)
    for (const path of applied.failed) logError(`  ${path}`)
    return 1
  }

  return plan.collisions.length > 0 ? 1 : 0
}

function reportScratchEvidence(plan: ScratchEvidencePlan): void {
  logInfo(`${plural(plan.moves.length, 'folder')} to move.`)
  for (const move of plan.moves) {
    logInfo(`  ${move.from} -> ${move.to}`)
  }

  logInfo(
    `${plural(plan.entries.length, 'file')} to change, ${plural(plan.rewritten, 'citation')} to rewrite.`,
  )
  for (const entry of plan.entries) {
    logInfo(`  ${entry.path}: ${plural(entry.rewritten, 'citation')}`)
  }
}

function toScratchEvidenceRecord(
  plan: ScratchEvidencePlan,
  wrote: boolean | undefined,
): unknown {
  return {
    ok: true,
    wrote: wrote === true,
    moves: plan.moves,
    collisions: plan.collisions,
    files: plan.entries.length,
    rewritten: plan.rewritten,
    paths: plan.entries.map((entry) => ({
      path: entry.path,
      rewritten: entry.rewritten,
    })),
  }
}

interface RecordLayoutOptions {
  readonly json?: boolean
  readonly write?: boolean
  readonly root?: string
}

/**
 * Moves review receipts from `.canon/review/memory/` to `.canon/memory/review/`
 * and retired entries from `.canon/tmp/memory-archive/` to
 * `.canon/memory/archive/`, and repoints the citations that name either.
 */
async function runRecordLayout(opts: RecordLayoutOptions): Promise<number> {
  const root = opts.root ?? process.cwd()

  const files = await walkRecordLayoutCorpus(root)
  const sources = await readRecordLayoutCorpus(files)
  const plan = planRecordLayout(root, sources)

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(toRecordLayoutRecord(plan, opts.write))}\n`,
    )
  }

  reportRecordLayout(plan)

  if (plan.collisions.length > 0) {
    logError(
      `${plural(plan.collisions.length, 'destination')} already occupied. Neither side moved.`,
    )
    for (const collision of plan.collisions) logError(`  ${collision}`)
  }

  if (plan.moves.length === 0 && plan.entries.length === 0) {
    return plan.collisions.length > 0 ? 1 : 0
  }

  if (!opts.write) {
    logWarn('Nothing was written. Pass --write to apply this plan.')
    return 2
  }

  const applied = await applyRecordLayout(plan)
  logStep(
    `Moved ${plural(applied.moved, 'folder')} and rewrote ${plural(applied.written, 'file')}.`,
  )

  if (applied.failed.length > 0) {
    logError(`Could not write ${plural(applied.failed.length, 'file')}.`)
    for (const path of applied.failed) logError(`  ${path}`)
    return 1
  }

  return plan.collisions.length > 0 ? 1 : 0
}

function reportRecordLayout(plan: RecordLayoutPlan): void {
  logInfo(`${plural(plan.moves.length, 'folder')} to move.`)
  for (const move of plan.moves) {
    logInfo(`  ${move.from} -> ${move.to}`)
  }

  logInfo(
    `${plural(plan.entries.length, 'file')} to change, ${plural(plan.rewritten, 'citation')} to rewrite.`,
  )
  for (const entry of plan.entries) {
    logInfo(`  ${entry.path}: ${plural(entry.rewritten, 'citation')}`)
  }

  if (plan.strays.length > 0) {
    logWarn(
      `${plural(plan.strays.length, 'stray receipt')} at the flat review/ root. Not moved, move by hand into memory/review/.`,
    )
    for (const stray of plan.strays) logWarn(`  ${stray}`)
  }
}

function toRecordLayoutRecord(
  plan: RecordLayoutPlan,
  wrote: boolean | undefined,
): unknown {
  return {
    ok: true,
    wrote: wrote === true,
    moves: plan.moves.map((move) => ({ from: move.from, to: move.to })),
    collisions: plan.collisions,
    files: plan.entries.length,
    rewritten: plan.rewritten,
    strays: plan.strays,
    paths: plan.entries.map((entry) => ({
      path: entry.path,
      rewritten: entry.rewritten,
    })),
  }
}

interface RuleLayoutOptions {
  readonly json?: boolean
  readonly write?: boolean
  readonly root?: string
}

/**
 * Moves a target's flat `.claude/rules/<subdir>/` tree onto
 * `.claude/rules/canon/<subdir>/`.
 *
 * No ignore gate here, unlike `runRecords`. Nothing this verb moves is
 * gitignored: an installed rule is a file the target tracks, so relocating it
 * publishes nothing that was not already committed.
 */
async function runRuleLayout(opts: RuleLayoutOptions): Promise<number> {
  const root = opts.root ?? process.cwd()

  const mismatch = checkoutMismatchWarning(process.cwd())
  if (mismatch !== undefined) logWarn(mismatch)

  const files = await walkFlatRules(root)
  const hashes = stampedHashes(readStamp(root), 'governance')
  const catalog = new Set(indexSourceRules(PROJECT_ROOT).keys())
  const plan = planRuleLayout(root, files, hashes, catalog)

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(toRuleLayoutRecord(plan, opts.write))}\n`,
    )
  }

  reportRuleLayout(plan)

  if (plan.collisions.length > 0) {
    logError(
      `${plural(plan.collisions.length, 'file')} collide with an existing canon/ copy carrying different bytes. Neither side moved.`,
    )
    for (const collision of plan.collisions) {
      logError(`  ${collision.path} -> ${collision.destination}`)
    }
  }

  if (plan.moves.length === 0 && plan.duplicates.length === 0) {
    return plan.collisions.length > 0 ? 1 : 0
  }

  if (!opts.write) {
    logWarn('Nothing was written. Pass --write to apply this plan.')
    return 2
  }

  const applied = await applyRuleLayout(root, plan, PROJECT_ROOT)
  logStep(
    `Moved ${plural(applied.moved, 'file')} and deleted ${plural(applied.deleted, 'duplicate')}.`,
  )

  if (applied.failed.length > 0) {
    logError(`Could not move ${plural(applied.failed.length, 'file')}.`)
    for (const path of applied.failed) logError(`  ${path}`)
    return 1
  }

  return plan.collisions.length > 0 ? 1 : 0
}

function reportRuleLayout(plan: RuleLayoutPlan): void {
  logInfo(`${plural(plan.moves.length, 'file')} to move.`)
  for (const move of plan.moves) {
    logInfo(`  ${move.from} -> ${move.to} (${move.status})`)
  }

  if (plan.duplicates.length > 0) {
    logInfo(
      `${plural(plan.duplicates.length, 'file')} already duplicated at their destination, to delete.`,
    )
    for (const duplicate of plan.duplicates) logInfo(`  ${duplicate.path}`)
  }

  if (plan.unclaimed.length > 0) {
    logWarn(
      `${plural(plan.unclaimed.length, 'file')} neither the stamp nor the current catalog can vouch for. Left in place.`,
    )
    for (const path of plan.unclaimed) logWarn(`  ${path}`)
  }
}

function toRuleLayoutRecord(
  plan: RuleLayoutPlan,
  wrote: boolean | undefined,
): unknown {
  return {
    ok: plan.collisions.length === 0,
    wrote: wrote === true,
    moves: plan.moves,
    duplicates: plan.duplicates,
    collisions: plan.collisions,
    unclaimed: plan.unclaimed,
  }
}

export function register(program: Command): void {
  const migrate = program
    .command('migrate')
    .description('Move a project off a retired name or layout')
    .helpOption('-h, --help', 'Show this help message')

  migrate
    .command('records')
    .description('Move the gitignored session records to .canon/')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Apply the plan rather than reporting it')
    .option(
      '--root <path>',
      'Project root, defaulting to the working directory',
    )
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  nothing to move, or --write applied the whole plan',
        '  1  refused, or a move failed',
        '  2  a plan exists and --write was not passed',
        '',
        'The project has to ignore .canon/ before anything moves. Every folder',
        'this relocates is ignored where it stands, and landing one under a root',
        'the project tracks publishes the memory pen into the next commit.',
        '',
        'A line carrying canon-keep-record-root, or the nearest non-blank line',
        'below it, keeps the old root. Prose that dates a decision needs it; a',
        'live path does not.',
        '',
        'A rule frontmatter paths: glob naming a moved root is reported and left',
        'alone rather than rewritten, since a rewritten glob stops matching',
        'silently. No marker is needed; the YAML shape is enough.',
        '',
        'A citation shaped like a path into another repository, or one sitting',
        'inside a dated paragraph, is reported and left alone rather than',
        'rewritten. The first is an ownership judgment and the second a tense',
        'one, neither of which a regular expression makes reliably.',
        '',
        'The records themselves are never swept. Everything under .canon/ and',
        'every .claude/ record folder is left alone and reported as a count, so',
        'a run after the ignore entries collapse touches the same files as one',
        'before it.',
        '',
        'Examples:',
        '  canon migrate records',
        '  canon migrate records --write',
        '  canon migrate records --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RecordsOptions) => {
      process.exitCode = await runRecords(opts)
    })

  migrate
    .command('surface-roots')
    .description('Move the tracked toolkit surfaces to canon/')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Apply the plan rather than reporting it')
    .option(
      '--root <path>',
      'Project root, defaulting to the working directory',
    )
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  nothing to move, or --write applied the whole plan',
        '  1  refused, or a move failed',
        '  2  a plan exists and --write was not passed',
        '',
        'Moves canon/context/, canon/wireframes/, and the ARCHITECTURE.md,',
        'REQUIREMENTS.md, and DESIGN.md documents to canon/ with git mv, and',
        'rewrites every tracked citation of them. .claude/canon/, rules/,',
        'skills/, hooks/, and settings.json stay where the vendor reads them.',
        '',
        'A line carrying canon-keep-surface-root, or the nearest non-blank line',
        'above it, keeps the old root. A frontmatter paths: glob, a citation',
        'into another repository, and one inside a dated paragraph are reported',
        'and left alone rather than rewritten.',
        '',
        'Examples:',
        '  canon migrate surface-roots',
        '  canon migrate surface-roots --write',
        '  canon migrate surface-roots --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: SweepOptions) => {
      process.exitCode = await runSurfaceRoots(opts)
    })

  migrate
    .command('record-tree')
    .description('Repoint old-root citations inside the records themselves')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Apply the plan rather than reporting it')
    .option(
      '--root <path>',
      'Project root, defaulting to the working directory',
    )
    .addHelpText(
      'after',
      [
        '',
        'Run this after canon migrate records. That verb sweeps a git listing,',
        'so it reaches every tracked file and none of the records, which are',
        'gitignored by construction. This one walks the new root itself.',
        '',
        'Scope: diagrams, memory, plans, proposals, review, tasks, and teach,',
        'each minus its own archive subtree. The closed trails under groundwork',
        'and intake, the scratch folder, and the backup history are reported as',
        'counts and never rewritten, since a path inside a closed trail is part',
        'of a sentence about work that already ended.',
        '',
        'Exit codes:',
        '  0  nothing to rewrite, or --write applied the whole plan',
        '  1  a write failed',
        '  2  a plan exists and --write was not passed',
        '',
        'Every citation is reported with its file, its line, and the line text.',
        'The records are untracked and unbacked, so a wrong rewrite has no undo',
        'and the report is what a reader judges before passing --write.',
        '',
        'A line carrying canon-keep-record-root, or the nearest non-blank line',
        'below it, keeps the old root. Prose that dates a decision needs it; a',
        'live path does not.',
        '',
        'Examples:',
        '  canon migrate record-tree',
        '  canon migrate record-tree --write',
        '  canon migrate record-tree --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RecordTreeOptions) => {
      process.exitCode = await runRecordTree(opts)
    })

  migrate
    .command('scratch-evidence')
    .description('Promote cited measurement folders out of tmp into review')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Apply the plan rather than reporting it')
    .option(
      '--root <path>',
      'Project root, defaulting to the working directory',
    )
    .addHelpText(
      'after',
      [
        '',
        'Moves nine folders cited as measurement evidence from .canon/tmp/ to',
        '.canon/review/evidence/, which canon records push already backs, and',
        'repoints every citation that names one, live or archived.',
        '',
        'A promoted folder is one a durable record cites and no source file',
        'under claude/, scripts/, src/, governance/, or standards/ names by',
        'path. A folder a script still writes into stays in scratch, since',
        'moving it needs a code change first.',
        '',
        'Exit codes:',
        '  0  nothing to move, or --write applied the whole plan',
        '  1  a write failed, or an unresolved collision remains',
        '  2  a plan exists and --write was not passed',
        '',
        'Examples:',
        '  canon migrate scratch-evidence',
        '  canon migrate scratch-evidence --write',
        '  canon migrate scratch-evidence --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: ScratchEvidenceOptions) => {
      process.exitCode = await runScratchEvidence(opts)
    })

  migrate
    .command('record-layout')
    .description('Fold memory review receipts and archive under memory/')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Apply the plan rather than reporting it')
    .option(
      '--root <path>',
      'Project root, defaulting to the working directory',
    )
    .addHelpText(
      'after',
      [
        '',
        'Moves review receipts from .canon/review/memory/ to',
        '.canon/memory/review/, and retired entries from',
        '.canon/tmp/memory-archive/ to .canon/memory/archive/, backed for',
        'the first time, and repoints every citation that names either,',
        'live or archived.',
        '',
        'A receipt sitting at the flat review/ root, the shape memory-review',
        'wrote before review/memory/ existed, is reported rather than moved.',
        '',
        'Exit codes:',
        '  0  nothing to move, or --write applied the whole plan',
        '  1  a write failed, or an unresolved collision remains',
        '  2  a plan exists and --write was not passed',
        '',
        'Examples:',
        '  canon migrate record-layout',
        '  canon migrate record-layout --write',
        '  canon migrate record-layout --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RecordLayoutOptions) => {
      process.exitCode = await runRecordLayout(opts)
    })

  migrate
    .command('rename')
    .description('Rewrite every unprotected aitk token to canon')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Apply the plan rather than reporting it')
    .option(
      '--root <path>',
      'Project root, defaulting to the working directory',
    )
    .option('--scope <scope>', `What to rewrite: ${SCOPES.join(', ')}`, 'self')
    .addHelpText(
      'after',
      [
        '',
        'Scopes:',
        '  self    every tracked file, for the toolkit repository itself',
        '  target  toolkit-owned folders only, reporting the rest as citations',
        '',
        'Exit codes:',
        '  0  nothing to rewrite, or --write applied the whole plan',
        '  1  refused, or a move failed',
        '  2  a plan exists and --write was not passed',
        '',
        'The changelog is never rewritten. Its entries record what shipped',
        'under the old name, and GitHub redirects the links they carry.',
        'aitk-sandbox is a separate repository and is left alone.',
        '',
        'Examples:',
        '  canon migrate rename',
        '  canon migrate rename --write',
        '  canon migrate rename --scope target --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RenameOptions) => {
      process.exitCode = await runRename(opts)
    })

  migrate
    .command('skill-names')
    .description('Move the prefixed skill folders onto their two-word names')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Apply the plan rather than reporting it')
    .option(
      '--root <path>',
      'Project root, defaulting to the working directory',
    )
    .addHelpText(
      'after',
      [
        '',
        `Rewrites ${Object.keys(SKILL_NAME_MAP).length} skill names and moves the folders that carry them.`,
        'It takes no scope. The skill folders it moves are authored in the',
        'toolkit and no target holds a copy of that catalog, so in a target it',
        'rewrites citations of a renamed skill and moves nothing.',
        '',
        'Exit codes:',
        '  0  nothing to rewrite, or --write applied the whole plan',
        '  1  refused, or a move failed',
        '  2  a plan exists and --write was not passed',
        '',
        'The changelog is never rewritten, and neither is an eval transcript.',
        'Each records what shipped or what a session ran under the name that',
        'was current then.',
        '',
        'Examples:',
        '  canon migrate skill-names',
        '  canon migrate skill-names --write',
        '  canon migrate skill-names --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: SweepOptions) => {
      process.exitCode = await runSkillNames(opts)
    })

  migrate
    .command('rule-layout')
    .description('Move installed rules from the flat layout onto canon/')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--write', 'Apply the plan rather than reporting it')
    .option(
      '--root <path>',
      'Project root, defaulting to the working directory',
    )
    .addHelpText(
      'after',
      [
        '',
        'Moves .claude/rules/<subdir>/<rule>.md to',
        '.claude/rules/canon/<subdir>/<rule>.md. A file is never overwritten:',
        'this verb only relocates a rule, even one classified as edited.',
        '',
        'Classification: clean when the target stamp still hashes to the',
        'installed content, edited when it does not, and unclaimed when',
        'neither the stamp nor the current rule catalog can vouch for the',
        'name. An unclaimed file is reported and never moved.',
        '',
        'A destination already holding the same bytes marks the flat file a',
        'duplicate, which --write deletes rather than moves. A destination',
        'holding different bytes is a collision: neither file is touched,',
        'it is reported by name, and every other planned move still applies.',
        '',
        'Exit codes:',
        '  0  nothing to move, or --write applied the whole plan clean',
        '  1  a move failed, or an unresolved collision remains',
        '  2  a plan exists and --write was not passed',
        '',
        'Examples:',
        '  canon migrate rule-layout',
        '  canon migrate rule-layout --write',
        '  canon migrate rule-layout --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RuleLayoutOptions) => {
      process.exitCode = await runRuleLayout(opts)
    })
}
