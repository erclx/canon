import type { Command } from 'commander'
import { execa } from 'execa'
import { findCheckoutMismatch, PROJECT_ROOT } from '@/project-root'
import {
  frameError,
  intro,
  logInfo,
  logStep,
  logWarn,
  outro,
  select,
} from '@/ui'
import { compareVersions, parseVersion } from '@/version/compare'
import { readInstalled, UNKNOWN_LABEL } from '@/version/installed'
import { detectManager, installCommand, type Manager } from '@/version/manager'
import {
  describeSkew,
  latestOf,
  readSkew,
  type SkewReport,
} from '@/version/skew'

interface UpgradeOptions {
  readonly json?: boolean
}

interface UpgradeRecord {
  readonly root: string
  readonly manager?: string
  readonly command?: string
  readonly before: string
  readonly after?: string
  readonly latest?: string
  /** The version of the checkout at cwd, present only on `pending`. */
  readonly checkout?: string
  readonly state: 'upgraded' | 'current' | 'pending' | 'cancelled' | 'refused'
  readonly reason?: string
  /**
   * One rendered line for a caller that reports the outcome without parsing
   * the rest of the record, such as `.husky/post-merge`. `current` reuses
   * `describeSkew` verbatim so its wording never drifts from the line `canon
   * sync --check` and `canon claude skills drift` already report.
   */
  readonly message: string
}

export function register(program: Command): void {
  program
    .command('upgrade')
    .description(
      'Reinstall the CLI globally with whichever package manager installed it',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the binary is current, the reinstall completed, or it was cancelled',
        '  1  refused or the reinstall failed, with the reason on stderr',
        '',
        'The package manager is read off the install path rather than guessed',
        'from PATH, and named before anything runs. A source checkout matches no',
        'install tree and is refused rather than reinstalled over.',
        '',
        'Examples:',
        '  canon upgrade',
        '  canon upgrade --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: UpgradeOptions) => {
      process.exitCode = await runUpgrade(opts)
    })
}

/**
 * Detection runs before the registry lookup so the one case that cannot upgrade
 * at all, a source checkout, refuses without waiting on a network call whose
 * answer it would then discard.
 */
async function runUpgrade(opts: UpgradeOptions): Promise<number> {
  const installed = readInstalled()
  const before = installed.version ?? UNKNOWN_LABEL

  intro('canon upgrade')
  logStep('Installed')
  logInfo(`${installed.name ?? UNKNOWN_LABEL} ${before}`)
  logInfo(PROJECT_ROOT)

  const manager = detectManager(PROJECT_ROOT)
  if (manager === undefined) {
    return refuse(
      opts,
      before,
      `No package manager owns ${PROJECT_ROOT}. A source checkout is upgraded by pulling, not by reinstalling over it.`,
    )
  }

  // A manifest that did not parse, or carried no `name`, would otherwise reach
  // `installCommand` and produce a global install of whatever sits under that
  // placeholder on the registry. The prompt below defaults to yes headlessly,
  // so nothing downstream would stop it.
  if (installed.name === undefined) {
    return refuse(
      opts,
      before,
      `No package name in ${PROJECT_ROOT}/package.json, so there is nothing safe to reinstall. Repair the manifest, or reinstall by name yourself.`,
      manager,
    )
  }

  const command = installCommand(manager.id, installed.name)
  logStep('Detected')
  logInfo(`${manager.id}, from the \`${manager.evidence}\` path segment`)
  logInfo(command.join(' '))

  const skew = await readSkew({ installed })
  logStep('Published')
  logInfo(describeSkew(skew))

  const checkout = readCheckoutVersion()
  const latest = latestOf(skew)

  if (skew.state === 'current') {
    const note = pendingNote(latest, checkout)
    if (note !== undefined && checkout !== undefined) {
      logWarn(note)
      outro()
      emit(opts, {
        ...base(before, manager, command, skew),
        after: before,
        checkout,
        state: 'pending',
        message: `CLI stays at ${before}. ${note}`,
      })
      return 0
    }

    outro()
    emit(opts, {
      ...base(before, manager, command, skew),
      after: before,
      state: 'current',
      message: describeSkew(skew),
    })
    return 0
  }

  return await applyUpgrade(opts, before, skew, manager, command, checkout)
}

/**
 * Runs the reinstall and reads the version back off disk rather than trusting
 * the manager's own report, since each spells success differently and one of
 * them exits zero on a no-op. The read is the same `package.json` the CLI names
 * on `--version`, which the install has overwritten by this point.
 *
 * An `unknown` skew reaches here rather than stopping. The operator asked for
 * the reinstall, and the manager reports its own network failure in terms the
 * dist-tag endpoint cannot.
 */
async function applyUpgrade(
  opts: UpgradeOptions,
  before: string,
  skew: SkewReport,
  manager: Manager,
  command: readonly string[],
  checkout: string | undefined,
): Promise<number> {
  const proceed = await select({
    message: `Run \`${command.join(' ')}\`?`,
    options: [
      { value: true, label: 'Upgrade' },
      { value: false, label: 'Cancel' },
    ],
    nonInteractiveDefault: true,
  })

  if (!proceed) {
    logWarn('Cancelled')
    outro()
    emit(opts, {
      ...base(before, manager, command, skew),
      state: 'cancelled',
      message: `Cancelled. ${describeSkew(skew)}`,
    })
    return 0
  }

  logStep('Upgrading')
  const [bin, ...args] = command
  // The manager's own progress goes to stderr with the rest of the UI, leaving
  // stdout carrying nothing but the record. Inheriting all three streams would
  // put npm's output ahead of the JSON and break every wrapper parsing it.
  const result = await execa(bin, args, {
    reject: false,
    stdin: 'inherit',
    stdout: process.stderr,
    stderr: 'inherit',
  })

  if (result.exitCode !== 0) {
    const target = latestOf(skew) ?? UNKNOWN_LABEL
    return refuse(
      opts,
      before,
      `\`${command.join(' ')}\` exited ${result.exitCode} moving from ${before} to ${target}. Run it yourself to read what it reported.`,
      manager,
    )
  }

  const after = readInstalled().version ?? UNKNOWN_LABEL
  logStep('Installed')
  logInfo(after === before ? `${after}, unchanged` : `${before} to ${after}`)
  outro()

  emit(opts, {
    ...base(before, manager, command, skew),
    after,
    state: 'upgraded',
    message: [upgradedMessage(before, after), pendingNote(after, checkout)]
      .filter((part) => part !== undefined)
      .join(' '),
  })
  return 0
}

/**
 * The version of the checkout the caller stands in, read off cwd rather than
 * off `PROJECT_ROOT`, which is the installed package a bare `canon` resolves
 * to. A target project sits in no canon checkout, so this reads nothing there
 * and the verb behaves as it did.
 */
function readCheckoutVersion(): string | undefined {
  const dir = findCheckoutMismatch(process.cwd())
  return dir === undefined ? undefined : readInstalled(dir).version
}

/**
 * The clause a caller appends when the checkout carries a release npm does not
 * serve yet. A pull lands the release commit before the publish job finishes,
 * so for a few minutes the checkout leads the registry, and a release that
 * never publishes keeps it leading. The wording names the served version
 * rather than promising a publish for that reason. `undefined` covers every
 * case with nothing to say, including a version that does not parse.
 */
export function pendingNote(
  served: string | undefined,
  checkout: string | undefined,
): string | undefined {
  if (served === undefined || checkout === undefined) return undefined

  const local = parseVersion(checkout)
  const published = parseVersion(served)
  if (local === undefined || published === undefined) return undefined
  if (compareVersions(local, published) <= 0) return undefined

  return `The checkout is at ${checkout} and npm serves ${served}.`
}

export function upgradedMessage(before: string, after: string): string {
  return after === before
    ? `CLI reinstalled ${after}, unchanged.`
    : `CLI upgraded ${before} to ${after}.`
}

function base(
  before: string,
  manager: Manager,
  command: readonly string[],
  skew: SkewReport,
): Omit<UpgradeRecord, 'state' | 'message'> {
  const latest = latestOf(skew)

  return {
    root: PROJECT_ROOT,
    manager: manager.id,
    command: command.join(' '),
    before,
    ...(latest === undefined ? {} : { latest }),
  }
}

function refuse(
  opts: UpgradeOptions,
  before: string,
  reason: string,
  manager?: Manager,
): number {
  outro()
  frameError(reason)
  emit(opts, {
    root: PROJECT_ROOT,
    ...(manager === undefined ? {} : { manager: manager.id }),
    before,
    state: 'refused',
    reason,
    message: reason,
  })
  return 1
}

function emit(opts: UpgradeOptions, record: UpgradeRecord): void {
  if (opts.json !== true) return
  process.stdout.write(
    `${JSON.stringify({ ...record, message: singleLine(record.message) })}\n`,
  )
}

/**
 * `message` is the one field carrying arbitrary text: `describeSkew`'s
 * `unknown` branch embeds a registry error verbatim, and a registry answering
 * with HTML produces one already carrying a double quote. `.husky/post-merge`
 * reads this field with a pattern rather than a parser, so a quote makes it
 * through `JSON.stringify` as an escaped `\"` that the pattern stops at,
 * truncating the line it prints. Collapsing whitespace and swapping the quote
 * for an apostrophe here, once, is what keeps every emitter of `message` from
 * having to reason about that reader.
 */
export function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/"/g, "'")
}
