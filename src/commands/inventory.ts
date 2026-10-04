import { resolve } from 'node:path'
import type { Command } from 'commander'
import { INSTALL_BROWSER, isEngineMissing } from '@/browser/engine'
import {
  CONFIG_REL,
  type ConfigRefusal,
  readInventoryConfig,
} from '@/inventory/config'
import { abbreviate, groupByTreatment } from '@/inventory/group'
import { findSubject, SUBJECTS } from '@/inventory/subjects'
import type { WalkRefusal } from '@/inventory/walk'
import {
  intro,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  plural,
} from '@/cli/ui'

/**
 * Holds wiring only. Every browser reference sits behind `loadWalker`, because
 * `src/cli.ts` imports this module at startup and resolving the engine there
 * would put a browser launch in front of every other command.
 */
type Walker = typeof import('@/inventory/walk')

interface RunOptions {
  readonly root?: string
  readonly baseUrl?: string
  readonly json?: boolean
}

/** What a reader does about each way the config produced no walk. */
const CONFIG_REFUSALS: Record<ConfigRefusal, string> = {
  'no-config': `No ${CONFIG_REL} here, so no routes and no element query are declared.`,
  'unreadable-config': `${CONFIG_REL} is not valid TOML, so no route could be read.`,
  'no-routes': `${CONFIG_REL} carries no route under routes, so there is nothing to walk.`,
  'no-base-url': `${CONFIG_REL} carries no base-url, so no route resolves to an address.`,
  'no-subjects': `${CONFIG_REL} declares no subject, and the element query comes from this project rather than from the toolkit.`,
}

const WALK_REFUSALS: Record<WalkRefusal, string> = {
  'browser-missing': 'The browser binary is not installed in this project.',
  'server-unreachable':
    'Nothing answered at the base URL, so no route was read.',
  'walk-failed': 'The walk failed against a running server.',
}

export function register(program: Command): void {
  const inventory = program
    .command('inventory')
    .description('Report one computed property across every route of a project')
    .helpOption('-h, --help', 'Show this help message')

  inventory
    .command('run', { isDefault: true })
    .description(
      'Walk every route and group its elements by the answer each gives',
    )
    .argument('[subject]', 'Treatment to read, defaulting to focus', 'focus')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Project to read, defaulting to the cwd')
    .option('--base-url <url>', 'Address to walk, overriding the config')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        `Reads ${CONFIG_REL} for the base URL, the routes, and the element query`,
        'each subject runs over, so what gets walked comes from the project',
        'rather than from the toolkit.',
        '',
        'It reports a listing and never a verdict. The value is seeing how many',
        'different answers one site gives, and a gate collapses that to one bit.',
        '',
        'Needs a running server and a browser binary. Install the browser with:',
        `  ${INSTALL_BROWSER}`,
        '',
        'Subjects:',
        ...SUBJECTS.map((subject) => `  ${subject.name}  ${subject.summary}`),
        '',
        'Exit codes:',
        '  0  the walk read at least one element and reported its rows',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon inventory focus',
        '  canon inventory focus --json',
        '  canon inventory focus --base-url http://localhost:3000',
        '',
      ].join('\n'),
    )
    .action(async (subject: string, opts: RunOptions) => {
      process.exitCode = await runInventory(subject, opts)
    })
}

async function runInventory(
  subjectName: string,
  opts: RunOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro(`canon inventory ${subjectName}`)

  const subject = findSubject(subjectName)
  if (!subject) {
    const known = SUBJECTS.map((entry) => entry.name).join(', ')
    return refuse(
      emitJson,
      root,
      'unknown-subject',
      `No reader named ${subjectName}. This build ships: ${known}.`,
    )
  }

  const read = readInventoryConfig(root)
  if (read.kind === 'refused') {
    return refuse(emitJson, root, read.reason, CONFIG_REFUSALS[read.reason])
  }

  const declared = read.config.subjects.find(
    (entry) => entry.name === subjectName,
  )
  if (!declared) {
    const named = read.config.subjects.map((entry) => entry.name).join(', ')
    return refuse(
      emitJson,
      root,
      'undeclared-subject',
      `${CONFIG_REL} declares no query for ${subjectName}. It declares: ${named}.`,
    )
  }

  const baseUrl = opts.baseUrl ?? read.config.baseUrl

  logStep('Scope')
  logInfo(
    `${plural(read.config.routes.length, 'route')} from ${baseUrl}, matching ${declared.query}`,
  )

  const walker = await loadWalker()
  if (!walker) {
    logStep('Browser')
    logError('the browser engine is not installed in this project')
    logWarn(`Install it with: ${INSTALL_BROWSER}`)
    outro()
    emit(emitJson, {
      root,
      subject: subjectName,
      reason: 'engine-missing',
      install: INSTALL_BROWSER,
    })
    return 1
  }

  const result = await walker.walk({
    baseUrl,
    routes: read.config.routes,
    subject,
    query: declared.query,
  })

  if (result.status === 'failed') {
    logStep('Refused')
    logWarn(WALK_REFUSALS[result.reason])
    if (result.reason === 'server-unreachable') {
      logWarn(`Start the project at ${baseUrl}, then run this again.`)
    }
    if (result.reason === 'browser-missing') {
      logWarn(`Install the browser binary with: ${INSTALL_BROWSER}`)
    }
    logWarn(result.message.split('\n')[0] ?? '')
    outro()
    emit(emitJson, {
      root,
      subject: subjectName,
      baseUrl,
      reason: result.reason,
      message: result.message,
      ...(result.reason === 'browser-missing'
        ? { install: INSTALL_BROWSER }
        : {}),
    })
    return 1
  }

  const groups = groupByTreatment(result.readings)

  logStep('Routes')
  for (const route of result.routes) {
    logInfo(`${route.route}  ${plural(route.elements, 'element')}`)
  }

  // A walk that matched nothing refuses rather than printing an empty listing,
  // because no rows and one row read the same to anything counting them, and
  // the first says the query reached nothing while the second says the site
  // gives one consistent answer.
  if (groups.length === 0) {
    return refuse(
      emitJson,
      root,
      'no-elements',
      `No element matched ${declared.query} on any of the ${plural(result.routes.length, 'route')} walked.`,
    )
  }

  logStep('Treatments')
  logInfo(
    `${plural(groups.length, 'answer')} across ${plural(result.readings.length, 'element')}`,
  )
  for (const group of groups) {
    logInfo(`  ${group.count}x  ${group.treatment}`)
    logInfo(
      `      ${abbreviate(group.samples, group.count)} on ${abbreviate(group.routes, group.routes.length)}`,
    )
  }
  outro()

  emit(emitJson, {
    root,
    subject: subjectName,
    baseUrl,
    routes: result.routes,
    elements: result.readings.length,
    treatments: groups,
    durationMs: result.durationMs,
  })
  return 0
}

/**
 * Frames a refusal on stderr and puts the record on stdout, so an operator
 * reading the terminal sees the reason rather than a command that appeared to
 * do nothing.
 */
function refuse(
  emitJson: boolean,
  root: string,
  reason: string,
  message: string,
): number {
  logStep('Refused')
  logWarn(message)
  outro()
  emit(emitJson, { root, reason, message })
  return 1
}

async function loadWalker(): Promise<Walker | undefined> {
  try {
    return await import('@/inventory/walk')
  } catch (error) {
    if (isEngineMissing(error)) return undefined
    throw error
  }
}

function emit(json: boolean, record: unknown): void {
  if (json) process.stdout.write(`${JSON.stringify(record)}\n`)
}
