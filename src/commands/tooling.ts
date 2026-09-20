import { resolve } from 'node:path'
import type { Command } from 'commander'
import { execScript } from '@/exec'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/project-root'
import {
  injectConfigs,
  injectGitignore,
  injectManifest,
  injectSeeds,
  pruneGitignore,
} from '@/tooling/inject'
import { buildStackSummaries, describeStack } from '@/tooling/list'
import {
  isStackExcluded,
  listStacks,
  type Manifest,
  resolveChain,
  stackExists,
} from '@/tooling/manifest'
import { readReference, resolveReference } from '@/tooling/read'
import { scan, type ScanResult } from '@/tooling/scan'
import { recordToolingChain } from '@/tooling/stamp'
import {
  intro,
  isNonInteractive,
  logAdd,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  palette,
  select,
} from '@/ui'

const PASS_THROUGH_VERBS = ['create', 'verify'] as const

interface SyncOptions {
  readonly skip?: string
  readonly check?: boolean
  readonly write?: boolean
  readonly diff?: { readonly json: boolean }
}

interface DiffOptions {
  readonly skip?: string
  readonly json?: boolean
}

interface InjectOptions {
  readonly configs?: boolean
  readonly seeds?: boolean
  readonly manifest?: boolean
  readonly gitignore?: boolean
  readonly nested?: boolean
}

interface PruneOptions {
  readonly nested?: boolean
}

interface ListOptions {
  readonly json?: boolean
}

type Prepared =
  | { readonly ok: true; readonly chain: Manifest[]; readonly target: string }
  | { readonly ok: false; readonly error: string }

export function register(program: Command): void {
  const tooling = program
    .command('tooling')
    .description('Manage tooling stacks (sync, reference, create)')
    .helpOption('-h, --help', 'Show this help message')

  tooling
    .command('sync')
    .description('Sync configs, seeds, deps, scripts, and gitignore entries')
    .argument('[stack]', 'Tooling stack name (e.g. base, vite-react)')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .option('--skip <stack>', 'Drop a layer from the extends chain')
    .option(
      '--check',
      'Report what would change and write nothing, always exiting 0. Prefer `canon tooling diff`',
    )
    .option('--write', 'Apply every change without prompting')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  canon tooling sync base',
        '  canon tooling sync base --check',
        '  CANON_NON_INTERACTIVE=1 canon tooling sync base --write',
        '',
        'To gate CI on tooling drift, run headlessly with neither flag. That',
        'exits 1 when a file would be replaced and 0 when none would, which is',
        'what `canon sync --check --exit-code` spells with a flag. Pass --check',
        'to report the same list and always exit 0.',
        '',
      ].join('\n'),
    )
    .action(
      async (stack: string | undefined, target: string, opts: SyncOptions) => {
        process.exitCode = await runSync(stack, target, opts)
      },
    )

  tooling
    .command('diff')
    .description('Report how a target differs from a stack and write nothing')
    .argument('[stack]', 'Tooling stack name (e.g. base, vite-react)')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .option('--skip <stack>', 'Drop a layer from the extends chain')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'The comparison `canon tooling sync --check` reports, under a name that',
        'says it only asks. Exit codes:',
        '  0  the target matches the stack',
        '  1  a file, script, dependency, or gitignore entry differs, or a refusal',
        '',
        '`sync --check` reports the same list and always exits 0. Use `diff` to',
        'gate CI, and keep `--check` for scripts that already call it.',
        '',
        'Examples:',
        '  canon tooling diff base',
        '  canon tooling diff base --json',
        '',
      ].join('\n'),
    )
    .action(
      async (stack: string | undefined, target: string, opts: DiffOptions) => {
        process.exitCode = await runSync(stack, target, {
          skip: opts.skip,
          check: true,
          diff: { json: opts.json === true },
        })
      },
    )

  tooling
    .command('inject')
    .description('Apply one stack to a target without scanning or prompting')
    .argument('<stack>', 'Tooling stack name')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .option('--configs', 'Copy stack configs')
    .option('--seeds', 'Merge stack seeds')
    .option('--manifest', 'Install deps, apply scripts, merge gitignore')
    .option('--gitignore', 'Merge gitignore entries only')
    .option('--nested', 'Suppress the frame when a caller already opened one')
    .action(async (stack: string, target: string, opts: InjectOptions) => {
      process.exitCode = await runInject(stack, target, opts)
    })

  tooling
    .command('prune-gitignore')
    .description('Remove managed gitignore entries no longer in the manifest')
    .argument('<stack>', 'Tooling stack name')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .option('--nested', 'Suppress the frame when a caller already opened one')
    .action(async (stack: string, target: string, opts: PruneOptions) => {
      process.exitCode = await runPrune(stack, target, opts)
    })

  tooling
    .command('list')
    .description('List installable tooling stacks')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit machine-readable JSON')
    .action((opts: ListOptions) => {
      process.exitCode = runList(opts)
    })

  tooling
    .command('reference')
    .description("Print a stack's reference doc")
    .argument('<stack>', 'Tooling stack name (e.g. base, vite-react)')
    .helpOption('-h, --help', 'Show this help message')
    .addHelpText(
      'after',
      [
        '',
        'A stack resolves under tooling/ at the working root, then the corpus',
        'inside the canon package. No reference installs into a project, so the',
        'package corpus is what answers there. The frame names the copy it read.',
        '',
        'Examples:',
        '  canon tooling reference base',
        '  canon tooling reference vite-react',
        '',
      ].join('\n'),
    )
    .action((stack: string) => {
      process.exitCode = printReference(stack)
    })

  for (const verb of PASS_THROUGH_VERBS) {
    tooling
      .command(verb)
      .description(`Run the tooling ${verb} command`)
      .allowUnknownOption()
      .allowExcessArguments(true)
      .passThroughOptions()
      .helpOption(false)
      .action(async (_opts: unknown, cmd: Command) => {
        await execScript(`tooling/${verb}.sh`, cmd.args)
      })
  }
}

/**
 * `JSON.stringify` replaces a `printf` that interpolated manifest fields into a
 * JSON string literal unescaped, so a stack name or description carrying a
 * quote emitted output a consuming skill could not parse.
 *
 * The frame opens after the `--json` return. The bash emitted a closing `└`
 * from its EXIT trap with no `┌` above it, because the hand-rolled
 * pass-through loop below skips the `intro` the shared helper carries.
 */
function runList(opts: ListOptions): number {
  // The warning is a frame-interior line, so it goes out after `intro` on the
  // path that opens one and bare on the `--json` path, which returns first and
  // opens none. One position cannot serve both.
  const mismatch = checkoutMismatchWarning(process.cwd())
  const stacks = buildStackSummaries(PROJECT_ROOT)

  if (opts.json) {
    if (mismatch !== undefined) logWarn(mismatch)
    process.stdout.write(`${JSON.stringify({ stacks })}\n`)
    return 0
  }

  intro('canon tooling list')
  if (mismatch !== undefined) logWarn(mismatch)
  logStep('Stacks')
  for (const summary of stacks) logInfo(describeStack(summary))
  outro()
  return 0
}

/**
 * Writes the reference to stdout and every frame line to stderr, so a caller
 * capturing the output with `$(...)` receives the document alone. Mirrors
 * `print` in `src/commands/standards.ts`.
 */
function printReference(stack: string): number {
  intro('canon tooling reference')

  const root = process.cwd()
  const resolved = resolveReference(root, stack)

  if (!resolved) {
    logWarn(`Unknown stack: ${stack}`)
    logStep('Available stacks')
    for (const each of listStacks(PROJECT_ROOT)) logInfo(each)
    logError("Run 'canon tooling list' for descriptions.")
    outro()
    return 1
  }

  logStep(resolved.source)
  process.stdout.write(readReference(resolved))
  outro()
  return 0
}

/**
 * Resolves the chain and rejects the same inputs the bash rejected, so a bad
 * stack name fails before anything touches the target.
 *
 * The excluded-stack guard is deliberately not here. It lived in the sync
 * entry point, so `canon claude` can still drive injection for the `claude`
 * stack the way it drove `merge_gitignore` before.
 */
function prepare(stack: string, target: string, skip?: string): Prepared {
  const mismatch = checkoutMismatchWarning(process.cwd())
  if (mismatch !== undefined) logWarn(mismatch)

  if (!stackExists(PROJECT_ROOT, stack)) {
    return { ok: false, error: `Stack not found: ${stack}` }
  }

  if (skip !== undefined) {
    if (skip === stack) {
      return {
        ok: false,
        error: `Cannot --skip the stack being synced: ${skip}`,
      }
    }
    if (!stackExists(PROJECT_ROOT, skip)) {
      return { ok: false, error: `Stack to skip not found: ${skip}` }
    }
  }

  const resolved = resolve(target)
  if (resolved === PROJECT_ROOT) {
    return {
      ok: false,
      error:
        'Cannot run against toolkit root. Files here are the source of truth.',
    }
  }

  return {
    ok: true,
    chain: resolveChain(PROJECT_ROOT, stack, { skipStack: skip }),
    target: resolved,
  }
}

async function runSync(
  stack: string | undefined,
  target: string,
  opts: SyncOptions,
): Promise<number> {
  intro(opts.diff === undefined ? 'canon tooling sync' : 'canon tooling diff')

  if (opts.check === true && opts.write === true) {
    logWarn('Pass --check or --write, not both.')
    outro()
    return 1
  }

  const selected = stack ?? (await promptForStack())
  if (selected === undefined) {
    logWarn('No tooling stacks found')
    outro()
    return 1
  }

  if (isStackExcluded(selected)) {
    logWarn(
      'Claude is managed by `canon claude`, not `canon tooling`. Run `canon claude sync` instead.',
    )
    outro()
    return 1
  }

  const prepared = prepare(selected, target, opts.skip)
  if (!prepared.ok) {
    logWarn(prepared.error)
    outro()
    return 1
  }

  const result = scan(prepared.chain, prepared.target)

  report(result)

  if (opts.diff !== undefined) {
    if (opts.diff.json) process.stdout.write(`${JSON.stringify(result)}\n`)
    outro()
    return result.totalChanges === 0 ? 0 : 1
  }

  const mode = resolveWriteMode(opts)
  const { GREEN, NC } = palette(process.stderr)

  if (result.totalChanges === 0) {
    // The stamp is a write like any other, so a run with no authority to write
    // leaves the target's record alone rather than claiming a sync it never
    // performed.
    if (mode === 'apply' || mode === 'prompt') {
      await stampChain(prepared.chain, prepared.target)
    }
    outro()
    process.stderr.write(`${GREEN}✓ Everything up to date${NC}\n`)
    return 0
  }

  const decision = await decideApply(result, mode)

  if (decision !== 'apply') {
    logWarn(
      decision === 'cancelled'
        ? 'Sync cancelled'
        : `Reported ${result.totalChanges} changes (${summarize(result)}). Nothing written.`,
    )
    if (decision === 'unauthorized') {
      logInfo('Re-run with --write to apply them, or --check to silence this.')
    }
    outro()
    return decision === 'unauthorized' ? 1 : 0
  }

  if (result.configs.some((entry) => entry.state !== 'matching')) {
    await injectConfigs(prepared.chain, prepared.target)
  }

  await injectSeeds(prepared.chain, prepared.target)
  await injectManifest(prepared.chain, prepared.target)

  await stampChain(prepared.chain, prepared.target)

  outro()
  process.stderr.write(`${GREEN}✓ Tooling sync complete${NC}\n`)
  return 0
}

type WriteMode = 'apply' | 'prompt' | 'report' | 'unauthorized'

type ApplyDecision = 'apply' | 'cancelled' | 'reported' | 'unauthorized'

/**
 * Golden configs carry the CI workflow, the end-to-end harness, and the shell
 * scripts under `scripts/`, so an overwrite reaches work no one would consent
 * to losing. A headless caller therefore has no authority to write without
 * `--write`, since a confirm prompt carrying `nonInteractiveDefault` resolves
 * to its first option and would read silence as consent.
 */
function resolveWriteMode(opts: SyncOptions): WriteMode {
  if (opts.check === true) return 'report'
  if (opts.write === true) return 'apply'
  return isNonInteractive() ? 'unauthorized' : 'prompt'
}

/**
 * Exit 1 follows `unauthorized`, so a caller that forgets `--write` fails
 * rather than reporting a sync it never performed.
 */
async function decideApply(
  result: ScanResult,
  mode: WriteMode,
): Promise<ApplyDecision> {
  if (mode === 'report') return 'reported'
  if (mode === 'apply') return 'apply'
  if (mode === 'unauthorized') return 'unauthorized'

  const shouldApply = await select({
    message: `Apply ${result.totalChanges} changes (${summarize(result)})?`,
    options: [
      { value: true, label: 'Apply all' },
      { value: false, label: 'Cancel' },
    ],
  })

  return shouldApply ? 'apply' : 'cancelled'
}

/**
 * Writes the chain after the copies land, so a partial apply that throws leaves
 * the previous record rather than a claim the target does not meet.
 */
async function stampChain(chain: Manifest[], target: string): Promise<void> {
  const recorded = await recordToolingChain(
    PROJECT_ROOT,
    target,
    chain,
    new Date(),
  )

  if (recorded) {
    logInfo(`Recorded chain: ${chain.map((entry) => entry.name).join(' < ')}`)
    return
  }

  logWarn(
    'Workspace root: no chain recorded. Tooling reports unmeasured because the answer differs per package.',
  )
}

async function runInject(
  stack: string,
  target: string,
  opts: InjectOptions,
): Promise<number> {
  const framed = opts.nested !== true
  if (framed) intro('canon tooling inject')

  const prepared = prepare(stack, target)
  if (!prepared.ok) {
    logWarn(prepared.error)
    if (framed) outro()
    return 1
  }

  const applyAll =
    !opts.configs && !opts.seeds && !opts.manifest && !opts.gitignore

  if (opts.configs || applyAll) {
    await injectConfigs(prepared.chain, prepared.target)
  }
  if (opts.seeds || applyAll) {
    await injectSeeds(prepared.chain, prepared.target)
  }
  if (opts.manifest || applyAll) {
    await injectManifest(prepared.chain, prepared.target)
  } else if (opts.gitignore) {
    await injectGitignore(prepared.chain, prepared.target)
  }

  // Only a whole-stack inject records the chain. A flag-scoped run installs one
  // category, and a chain recorded from it would send the report scanning for
  // configs and deps the caller never asked to install. The claude stack is
  // excluded here rather than in `prepare`, which is what keeps `canon claude`
  // able to drive injection while its stack stays out of the tooling record.
  if (applyAll && !isStackExcluded(stack)) {
    await stampChain(prepared.chain, prepared.target)
  }

  if (framed) outro()
  return 0
}

/**
 * Emits the number of pruned entries on stdout so a caller can branch on it
 * without parsing the timeline, replacing the bash nameref return.
 */
async function runPrune(
  stack: string,
  target: string,
  opts: PruneOptions,
): Promise<number> {
  const framed = opts.nested !== true
  if (framed) intro('canon tooling prune-gitignore')

  const prepared = prepare(stack, target)
  if (!prepared.ok) {
    logWarn(prepared.error)
    if (framed) outro()
    return 1
  }

  const removed = await pruneGitignore(prepared.chain, prepared.target)
  if (framed) outro()

  process.stdout.write(`${removed.length}\n`)
  return 0
}

async function promptForStack(): Promise<string | undefined> {
  const stacks = listStacks(PROJECT_ROOT)
  if (stacks.length === 0) return undefined

  return select({
    message: 'Select tooling stack:',
    options: stacks.map((name) => ({ value: name, label: name })),
    nonInteractiveDefault: true,
  })
}

function report(result: ScanResult): void {
  logStep('Scanning configs')
  for (const entry of result.configs) {
    if (entry.state === 'matching') logInfo(entry.rel)
  }
  for (const entry of result.configs) {
    if (entry.state === 'drifted') logWarn(entry.rel)
  }
  for (const entry of result.configs) {
    if (entry.state === 'new') logAdd(entry.rel)
  }

  logStep('Scanning seeds')
  for (const entry of result.seeds) {
    if (entry.state === 'present') logInfo(entry.rel)
  }
  for (const entry of result.seeds) {
    if (entry.state === 'missing') logAdd(entry.rel)
  }

  if (result.hasPackageJson) {
    reportPackage(result)
  } else {
    logWarn(
      "Skipped scripts and deps: no package.json found (run 'bun init' to enable)",
    )
  }

  logStep('Scanning gitignore')
  for (const entry of result.gitignore) {
    if (entry.state === 'present') logInfo(entry.entry)
  }
  for (const entry of result.gitignore) {
    if (entry.state === 'missing') logAdd(entry.entry)
  }
}

function reportPackage(result: ScanResult): void {
  if (result.scripts.length > 0) {
    logStep('Scanning scripts')
    for (const entry of result.scripts) {
      if (entry.state === 'matching') logInfo(entry.key)
    }
    for (const entry of result.scripts) {
      if (entry.state === 'drifted') logWarn(entry.key)
    }
    for (const entry of result.scripts) {
      if (entry.state === 'missing') logAdd(entry.key)
    }
  }

  if (result.deps.length > 0) {
    logStep('Scanning dependencies')
    for (const entry of result.deps) {
      if (entry.state === 'present') logInfo(entry.name)
    }
    for (const entry of result.deps) {
      if (entry.state === 'missing') logAdd(entry.spec)
    }
  }
}

function summarize(result: ScanResult): string {
  const parts: string[] = []
  const add = (count: number, label: string): void => {
    if (count > 0) parts.push(`${count} ${label}`)
  }

  add(
    result.configs.filter((entry) => entry.state !== 'matching').length,
    'configs',
  )
  add(result.seeds.filter((entry) => entry.state === 'missing').length, 'seeds')
  add(
    result.scripts.filter((entry) => entry.state !== 'matching').length,
    'scripts',
  )
  add(result.deps.filter((entry) => entry.state === 'missing').length, 'deps')
  add(
    result.gitignore.filter((entry) => entry.state === 'missing').length,
    'gitignore',
  )

  return parts.join(', ')
}
