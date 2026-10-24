import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/roots/project'
import {
  injectConfigs,
  injectGitignore,
  injectManifest,
  injectSeeds,
  pruneGitignore,
} from '@/tooling/inject'
import { buildStackSummaries, describeStack } from '@/tooling/list'
import {
  configFiles,
  isStackExcluded,
  listStacks,
  loadManifest,
  type Manifest,
  resolveChain,
  stackExists,
} from '@/tooling/manifest'
import {
  readReference,
  renderStackSections,
  resolveReference,
} from '@/tooling/read'
import { resolveRecorded } from '@/sync/check'
import { readStamp, stampedChain, writeDispositions } from '@/sync/stamp'
import {
  customize,
  decline,
  lift,
  normalizeGoldenPath,
  readDispositions,
  resolveGolden,
} from '@/tooling/disposition'
import { scan, type ScanResult } from '@/tooling/scan'
import { recordToolingChain } from '@/tooling/stamp'
import { subfolderPath } from '@/tooling/subfolder'
import { verifyStack } from '@/tooling/verify-stack'
import {
  intro,
  isNonInteractive,
  logAdd,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  outroSuccess,
  select,
} from '@/cli/ui'

interface SyncOptions {
  readonly skip?: string
  readonly check?: boolean
  readonly write?: boolean
  readonly replace?: readonly string[]
  readonly diff?: { readonly json: boolean }
}

function collect(value: string, previous: readonly string[]): string[] {
  return [...previous, value]
}

interface DiffOptions {
  readonly skip?: string
  readonly json?: boolean
}

interface DispositionOptions {
  readonly reason?: string
  readonly json?: boolean
}

type DispositionAction = 'decline' | 'customize' | 'lift'

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

interface VerifyOptions {
  readonly keep?: boolean
}

interface ListOptions {
  readonly json?: boolean
}

type Prepared =
  | { readonly ok: true; readonly chain: Manifest[]; readonly target: string }
  | { readonly ok: false; readonly reason: string; readonly error: string }

export function register(program: Command): void {
  const tooling = program
    .command('tooling')
    .description('Manage tooling stacks (sync, reference)')
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
    .option(
      '--replace <path>',
      'Replace a held config with the golden copy (repeatable)',
      collect,
      [],
    )
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  canon tooling sync base',
        '  canon tooling sync base --check',
        '  canon tooling sync base --write',
        '  canon tooling sync base --write --replace .oxfmtrc.json',
        '  canon tooling sync vite-react web --skip base',
        '',
        'A target below its git root syncs as a subfolder. It withholds',
        '.github/, which GitHub reads only at the root.',
        '',
        'The dependency install is bounded at 120 seconds. A stalled or failed',
        'install refuses with exit 1, and the stamp stays unwritten.',
        '',
        'To gate CI on tooling drift, run headlessly with neither flag. That',
        'exits 1 when a file would be replaced and 0 when none would, which is',
        'what `canon sync --check --exit-code` spells with a flag. Pass --check',
        'to report the same list and always exit 0.',
        '',
        '--write replaces a golden config only when canon changed it and the',
        'project did not, which the hash the last write recorded tells apart.',
        'A config the project edited, or one written before hashes were',
        'recorded, is held and listed. Name it with --replace to take the',
        'golden copy, or run `canon tooling customize <path>` to keep yours.',
        'A config no recorded stack ships is a first install and never held,',
        'so a fresh scaffold takes every golden config of a stack new to it.',
        'Seeds are copy-once, so a seed the target already holds is left alone.',
        'A declined or customized path is never written.',
        '',
        'Exit codes:',
        '  0  synced, up to date, cancelled, or run with --check',
        '  1  refused, or run headlessly with neither flag while a file would',
        '     be replaced',
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

  const dispositionHelp = [
    '',
    '<path> is relative to the target, as `canon tooling diff` lists it, and',
    'resolves against the chain the last sync recorded. These verbs are the',
    'only writers of the record, kept under domains.tooling.dispositions in',
    'canon/config/config.json. Nothing here deletes or edits the file itself.',
    '',
    'Exit codes:',
    '  0  recorded',
    '  1  refused: no-chain, bad-path, not-golden, already-held,',
    '     seed-not-customizable, missing-file, not-held, or toolkit-root',
    '',
  ]

  tooling
    .command('decline')
    .description('Keep sync and inject from ever writing one golden file')
    .argument('<path>', 'Golden file path, relative to the target')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .option('--reason <text>', 'Record why the project declined it')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        ...dispositionHelp,
        'Examples:',
        '  canon tooling decline .github/workflows/readme-screenshot.yml',
        '  canon tooling decline .oxlintrc.json web --reason "lint runs in CI only"',
        '',
      ].join('\n'),
    )
    .action(async (path: string, target: string, opts: DispositionOptions) => {
      process.exitCode = await runDisposition('decline', path, target, opts)
    })

  tooling
    .command('customize')
    .description(
      'Keep the project copy of one golden config through every write',
    )
    .argument('<path>', 'Golden config path, relative to the target')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        ...dispositionHelp,
        'The golden hash is recorded, so `canon tooling diff` exits 1 once the',
        'stack ships a different copy. A seed cannot be customized, since sync',
        'never overwrites one.',
        '',
        'Examples:',
        '  canon tooling customize e2e/home.spec.ts',
        '',
      ].join('\n'),
    )
    .action(async (path: string, target: string, opts: DispositionOptions) => {
      process.exitCode = await runDisposition('customize', path, target, opts)
    })

  tooling
    .command('lift')
    .description('Hand a declined or customized file back to sync')
    .argument('<path>', 'Golden file path, relative to the target')
    .argument('[target]', 'Target directory', '.')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        ...dispositionHelp,
        'Examples:',
        '  canon tooling lift .github/workflows/readme-screenshot.yml',
        '',
      ].join('\n'),
    )
    .action(async (path: string, target: string, opts: DispositionOptions) => {
      process.exitCode = await runDisposition('lift', path, target, opts)
    })

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

  tooling
    .command('verify')
    .description('Scaffold a stack fresh, sync it, and run its checks')
    .argument('<stack>', 'Tooling stack name (e.g. vite-react, astro)')
    .helpOption('-h, --help', 'Show this help message')
    .option('--keep', 'Keep the tmp dir after a clean run for inspection')
    .addHelpText(
      'after',
      [
        '',
        'Scaffolds <stack> into .canon/tmp/runs/verify-<stack>/, runs the',
        "manifest's [verify] prepare, syncs the chain from this checkout, then",
        'runs lint:fix, check, test:e2e, and screenshot where the scaffold',
        'declares them. A scaffold with no package.json after Sync fails.',
        '',
        'Exit codes:',
        '  0  every phase passed',
        '  1  a phase failed, or the stack cannot be verified',
        '',
        'Examples:',
        '  canon tooling verify vite-react',
        '  canon tooling verify astro --keep',
        '',
      ].join('\n'),
    )
    .action(async (stack: string, opts: VerifyOptions) => {
      const outcome = await verifyStack({
        root: PROJECT_ROOT,
        stack,
        keep: opts.keep === true,
      })
      process.exitCode = outcome.exitCode
    })
}

/**
 * `JSON.stringify` replaces a `printf` that interpolated manifest fields into a
 * JSON string literal unescaped, so a stack name or description carrying a
 * quote emitted output a consuming skill could not parse.
 *
 * The frame opens after the `--json` return. The bash emitted a closing `└`
 * from its EXIT trap with no `┌` above it, because the pass-through loop that
 * ran it opened no frame first.
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
 * capturing the output with `$(...)` receives the document alone.
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
  const manifest = loadManifest(resolved.root, stack)
  if (manifest) process.stdout.write(renderStackSections(manifest))
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
    return {
      ok: false,
      reason: 'unknown-stack',
      error: `Stack not found: ${stack}`,
    }
  }

  if (skip !== undefined) {
    if (skip === stack) {
      return {
        ok: false,
        reason: 'bad-skip',
        error: `Cannot --skip the stack being synced: ${skip}`,
      }
    }
    if (!stackExists(PROJECT_ROOT, skip)) {
      return {
        ok: false,
        reason: 'unknown-skip',
        error: `Stack to skip not found: ${skip}`,
      }
    }
  }

  const resolved = resolve(target)
  if (resolved === PROJECT_ROOT) {
    return {
      ok: false,
      reason: 'toolkit-root',
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
    return refuse(
      opts.diff?.json,
      'conflicting-flags',
      'Pass --check or --write, not both.',
    )
  }

  const selected = stack ?? (await promptForStack())
  if (selected === undefined) {
    return refuse(opts.diff?.json, 'no-stacks', 'No tooling stacks found')
  }

  if (isStackExcluded(selected)) {
    return refuse(
      opts.diff?.json,
      'excluded-stack',
      'Claude is managed by `canon claude`, not `canon tooling`. Run `canon claude sync` instead.',
    )
  }

  const prepared = prepare(selected, target, opts.skip)
  if (!prepared.ok)
    return refuse(opts.diff?.json, prepared.reason, prepared.error)

  const result = scan(prepared.chain, prepared.target)

  const replace = (opts.replace ?? []).map(
    (input) => normalizeGoldenPath(input) ?? input,
  )
  const unknown = replace.filter(
    (rel) => !result.configs.some((entry) => entry.rel === rel),
  )
  if (unknown.length > 0) {
    return refuse(
      opts.diff?.json,
      'unknown-replace',
      `--replace names no config this chain writes: ${unknown.join(', ')}`,
    )
  }

  report(result, prepared.target)

  if (opts.diff !== undefined) {
    if (opts.diff.json) {
      process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`)
    }
    outro()
    return result.totalChanges === 0 ? 0 : 1
  }

  const mode = resolveWriteMode(opts)

  if (result.totalChanges === 0) {
    // The stamp is a write like any other, so a run with no authority to write
    // leaves the target's record alone rather than claiming a sync it never
    // performed.
    if (mode === 'apply' || mode === 'prompt') {
      await stampChain(prepared.chain, prepared.target)
    }
    outroSuccess('Everything up to date')
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

  const held = heldConfigs(result, replace, prepared.chain, prepared.target)
  if (result.configs.some((entry) => entry.state !== 'matching')) {
    await injectConfigs(prepared.chain, prepared.target, new Set(held))
  }

  await injectSeeds(prepared.chain, prepared.target)
  const manifest = await injectManifest(prepared.chain, prepared.target)
  if (!manifest.ok) {
    return refuse(
      false,
      manifest.reason,
      `${manifest.message}\nConfigs and seeds above were written. Scripts, gitignore entries, and the stamp were not, so the next sync retries.`,
    )
  }

  await stampChain(prepared.chain, prepared.target)

  if (held.length > 0) {
    reportHeld(held, selected, target, opts.skip)
  }

  outroSuccess('Tooling sync complete')
  return 0
}

/**
 * A drifted config the project edited, or one no write recorded, is held
 * rather than replaced, since a write naming a stack is not consent to lose an
 * edit inside it. Only a path `--replace` names is taken over.
 *
 * A path no recorded stack ships is a first install of that stack, so it is
 * never held. `canon init` records `base` before a framework stack syncs over
 * a fresh scaffold, whose own copies of that stack's configs came from the
 * scaffold rather than from a project edit.
 */
function heldConfigs(
  result: ScanResult,
  replace: readonly string[],
  chain: readonly Manifest[],
  target: string,
): string[] {
  const recorded = new Set(stampedChain(readStamp(target), 'tooling'))
  const installed = new Set(
    chain
      .filter((manifest) => recorded.has(manifest.name))
      .flatMap(configFiles),
  )

  return result.configs
    .filter(
      (entry) =>
        entry.state === 'drifted' &&
        entry.cause !== 'stale' &&
        installed.has(entry.rel) &&
        !replace.includes(entry.rel),
    )
    .map((entry) => entry.rel)
}

/**
 * Names every held path in one copyable command, so taking the first run's
 * unattributed holds costs one paste rather than one flag per path typed.
 */
function reportHeld(
  held: readonly string[],
  stack: string,
  target: string,
  skip: string | undefined,
): void {
  logStep('Held')
  for (const rel of held) logWarn(rel)
  logInfo(
    'The project changed these, or no earlier write recorded them, so --write left them as they are. Keep one with `canon tooling customize <path>`, or take the golden copies with:',
  )
  const command = [
    'canon tooling sync',
    stack,
    target,
    ...(skip === undefined ? [] : ['--skip', skip]),
    '--write',
    ...held.flatMap((rel) => ['--replace', rel]),
  ]
  logInfo(command.join(' '))
}

/**
 * A diff caller branches on the record rather than the exit, since a shell
 * wrapper can flatten the status. Every refusal therefore answers with a reason
 * on stdout under `--json`, beside the exit 1 that keeps a gate failing.
 */
function refuse(
  json: boolean | undefined,
  reason: string,
  message: string,
): number {
  logWarn(message)
  if (json === true) {
    process.stdout.write(`${JSON.stringify({ ok: false, reason, message })}\n`)
  }
  outro()
  return 1
}

/**
 * Resolves the path against the chain the last sync recorded rather than a
 * stack argument, since a disposition belongs to the path whichever stack
 * ships it. An unstamped target has no chain to resolve against and refuses.
 */
async function runDisposition(
  action: DispositionAction,
  input: string,
  target: string,
  opts: DispositionOptions,
): Promise<number> {
  intro(`canon tooling ${action}`)

  const resolved = resolve(target)
  if (resolved === PROJECT_ROOT) {
    return refuse(
      opts.json,
      'toolkit-root',
      'Cannot run against toolkit root. Files here are the source of truth.',
    )
  }

  const rel = normalizeGoldenPath(input)
  if (rel === undefined) {
    return refuse(
      opts.json,
      'bad-path',
      `${input} is not a path inside the target. Pass it relative to the target.`,
    )
  }

  const chain = resolveRecorded(
    PROJECT_ROOT,
    stampedChain(readStamp(resolved), 'tooling'),
  )
  if (chain.length === 0) {
    return refuse(
      opts.json,
      'no-chain',
      `No tooling chain is recorded in ${resolved}. Run \`canon tooling sync <stack>\` there first.`,
    )
  }

  const current = readDispositions(resolved)
  const golden = resolveGolden(chain, rel)
  const transition =
    action === 'decline'
      ? decline(current, golden, opts.reason)
      : action === 'customize'
        ? customize(current, golden, existsSync(join(resolved, rel)))
        : lift(current, rel)

  if (!transition.ok) {
    return refuse(opts.json, transition.reason, transition.message)
  }

  await writeDispositions(
    resolved,
    { domain: 'tooling', toolkitRoot: PROJECT_ROOT },
    transition.dispositions,
    new Date(),
  )

  const entry = transition.dispositions[rel]
  if (opts.json === true) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, action, path: rel, ...(entry === undefined ? {} : { entry }) })}\n`,
    )
  }

  outroSuccess(
    entry === undefined
      ? `Lifted ${rel}. The next sync writes it again.`
      : `Recorded ${rel} as ${entry.disposition}. Sync and inject skip it.`,
  )
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

  if (recorded !== undefined) {
    logInfo(`Recorded chain: ${recorded.join(' < ')}`)
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
    const manifest = await injectManifest(prepared.chain, prepared.target)
    if (!manifest.ok) {
      logWarn(manifest.message)
      if (framed) outro()
      return 1
    }
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
    ttyHint: `Pass a stack, one of: ${stacks.join(', ')}`,
  })
}

function report(result: ScanResult, target: string): void {
  logStep('Scanning configs')
  for (const entry of result.configs) {
    if (entry.state === 'matching') logInfo(entry.rel)
  }
  for (const entry of result.configs) {
    if (entry.state === 'drifted') {
      logWarn(
        entry.cause === 'stale' ? entry.rel : `${entry.rel} (${entry.cause})`,
      )
    }
  }
  for (const entry of result.configs) {
    if (entry.state === 'new') logAdd(entry.rel)
  }

  if (result.withheld.length > 0) reportWithheld(result, target)
  reportDispositions(result)

  logStep('Scanning seeds')
  for (const entry of result.seeds) {
    if (entry.state === 'present') logInfo(entry.rel)
  }
  for (const entry of result.seeds) {
    if (entry.state === 'missing') logAdd(entry.rel)
  }

  if (result.newManifest) {
    logStep('Scanning package.json')
    logAdd('package.json')
    reportPackage(result)
  } else if (result.hasPackageJson) {
    reportPackage(result)
  } else if (existsSync(join(target, 'package.json'))) {
    logStep('Scanning package.json')
    logWarn(
      `Skipped scripts and deps: package.json is not valid JSON (fix it in ${target}, then sync again)`,
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

function reportWithheld(result: ScanResult, target: string): void {
  logStep('Withheld from a subfolder')
  for (const entry of result.withheld) logWarn(entry.rel)
  for (const entry of result.withheld) {
    if (entry.present) {
      logWarn(`${entry.rel} is already here, and GitHub never reads this copy`)
    }
  }
  logInfo(
    'GitHub reads workflows only at the repository root. Add a root job that runs this folder with:',
  )
  logInfo(`working-directory: ${subfolderPath(target) ?? '.'}`)
}

function reportDispositions(result: ScanResult): void {
  const declined = result.dispositions.filter(
    (entry) => entry.disposition === 'declined',
  )
  const customized = result.dispositions.filter(
    (entry) => entry.disposition === 'customized',
  )

  if (declined.length > 0) {
    logStep('Declined')
    for (const entry of declined) {
      logInfo(entry.present ? `${entry.rel} (still here)` : entry.rel)
    }
  }

  if (customized.length > 0) {
    logStep('Customized')
    for (const entry of customized) {
      if (entry.moved === true) {
        logWarn(
          `${entry.rel}: the ${entry.stack} golden changed since it was customized. Run \`canon tooling lift ${entry.rel}\` to take the new copy on the next write, or lift and customize again to keep this one.`,
        )
      } else {
        logInfo(entry.rel)
      }
    }
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
      if (entry.state === 'ahead') {
        logInfo(`${entry.name} ${entry.installed} (ahead of ${entry.spec})`)
      }
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

  add(result.newManifest ? 1 : 0, 'package.json')
  add(
    result.configs.filter((entry) => entry.state !== 'matching').length,
    'configs',
  )
  add(
    result.dispositions.filter((entry) => entry.moved === true).length,
    'moved customized',
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
