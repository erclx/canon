import { join, relative, resolve } from 'node:path'
import { type Command, Option } from 'commander'
import { INSTALL_BROWSER, isEngineMissing } from '@/browser/engine'
import {
  CONFIG_REL,
  type ConfigRefusal,
  readInventoryConfig,
  routeUrl,
} from '@/inventory/config'
import { DESIGN_DOCUMENT } from '@/design/regen'
import { resolveFrames } from '@/inventory/frames'
import {
  abbreviate,
  groupByTreatment,
  type TreatmentGroup,
} from '@/inventory/group'
import {
  isValueSubject,
  readScale,
  VALUE_SUBJECTS,
  type ValueSubject,
} from '@/inventory/scale'
import { findSubject, type Subject, SUBJECTS } from '@/inventory/subjects'
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
  readonly frames?: readonly string[]
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
  'sandbox-blocked':
    'The browser could not start its sandbox, since this kernel refuses it a user namespace.',
  'server-unreachable':
    'Nothing answered at the base URL, so no route was read.',
  'walk-failed': 'The walk failed against a running server.',
}

export function register(program: Command): void {
  const inventory = program
    .command('inventory')
    .description(
      'Report one computed property across every route or board frame of a project',
    )
    .helpOption('-h, --help', 'Show this help message')

  inventory
    .command('run', { isDefault: true })
    .description(
      'Walk every route or frame and group its elements by the answer each gives',
    )
    .argument('[subject]', 'Treatment to read, defaulting to focus', 'focus')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Project to read, defaulting to the cwd')
    .option('--base-url <url>', 'Address to walk, overriding the config')
    .addOption(
      new Option(
        '--frames <file...>',
        'Board frame HTML files to read light and dark, in place of the routes',
      ).conflicts('baseUrl'),
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        `Reads ${CONFIG_REL} for the base URL, the routes, and the element query`,
        'each subject runs over, so what gets walked comes from the project',
        'rather than from the toolkit.',
        '',
        `With --frames it reads each HTML file in both themes instead, needing no`,
        `${CONFIG_REL} and no server, for the five value subjects alone. Each`,
        `value listing closes on a line comparing its distinct values with what`,
        `${DESIGN_DOCUMENT} carries. A read sees one state, so a :hover value is`,
        'never counted.',
        '',
        'It reports a listing and never a verdict. The value is seeing how many',
        'different answers one site gives, and a gate collapses that to one bit.',
        '',
        'A route walk needs a running server. Both need a browser binary. Install the browser with:',
        `  ${INSTALL_BROWSER}`,
        '',
        'The browser runs sandboxed. Where the kernel refuses it a user namespace,',
        'as under AppArmor, the walk refuses as sandbox-blocked, carrying fix when',
        'that setting reads 1.',
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
        '  canon inventory font-size --frames .canon/board/<page>/00-current/*.html',
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

  if (opts.frames) return runFrames(subject, opts.frames, root, emitJson)

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
    targets: read.config.routes.map((route) => ({
      label: route,
      url: routeUrl(baseUrl, route),
    })),
    subject,
    query: declared.query,
    frames: false,
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
    if (result.fix) logWarn(`Allow it for this boot with: ${result.fix}`)
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
      ...(result.fix ? { fix: result.fix } : {}),
    })
    return 1
  }

  const groups = groupByTreatment(result.readings)

  logStep('Routes')
  for (const target of result.targets) {
    logInfo(`${target.location}  ${plural(target.elements, 'element')}`)
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
      `No element matched ${declared.query} on any of the ${plural(result.targets.length, 'route')} walked.`,
    )
  }

  printTreatments(groups, result.readings.length)
  outro()

  emit(emitJson, {
    root,
    subject: subjectName,
    baseUrl,
    routes: result.targets.map(({ location, elements }) => ({
      route: location,
      elements,
    })),
    elements: result.readings.length,
    treatments: groups.map(({ treatment, count, locations, samples }) => ({
      treatment,
      count,
      routes: locations,
      samples,
    })),
    durationMs: result.durationMs,
  })
  return 0
}

/**
 * Reads board frame files rather than a served project's routes, which is
 * what lets a plan count a picked round's values before anything is built.
 * It reads no config, since a frame's every element is the subject and the
 * file list is the scope.
 */
async function runFrames(
  subject: Subject,
  paths: readonly string[],
  root: string,
  emitJson: boolean,
): Promise<number> {
  const name = subject.name
  if (!isValueSubject(name)) {
    return refuse(
      emitJson,
      root,
      'frames-need-value-subject',
      `${subject.name} reads the elements a project's ${CONFIG_REL} names, so it cannot run over frames. Run a value subject: ${VALUE_SUBJECTS.join(', ')}.`,
    )
  }

  const resolved = resolveFrames(paths, process.cwd())
  if (resolved.kind === 'missing') {
    return refuse(
      emitJson,
      root,
      'frames-missing',
      `No file at ${resolved.paths.join(', ')}, so no frame was read.`,
    )
  }

  logStep('Scope')
  logInfo(
    `${plural(resolved.frames.length, 'frame')}, each read light and dark`,
  )

  const walker = await loadWalker()
  if (!walker) {
    logStep('Browser')
    logError('the browser engine is not installed in this project')
    logWarn(`Install it with: ${INSTALL_BROWSER}`)
    outro()
    emit(emitJson, {
      root,
      subject: subject.name,
      reason: 'engine-missing',
      install: INSTALL_BROWSER,
    })
    return 1
  }

  const result = await walker.walk({
    targets: resolved.frames,
    subject,
    query: '',
    frames: true,
  })

  if (result.status === 'failed') {
    logStep('Refused')
    logWarn(
      result.reason === 'browser-missing' || result.reason === 'sandbox-blocked'
        ? WALK_REFUSALS[result.reason]
        : 'The walk failed while reading the frames.',
    )
    if (result.reason === 'browser-missing') {
      logWarn(`Install the browser binary with: ${INSTALL_BROWSER}`)
    }
    if (result.fix) logWarn(`Allow it for this boot with: ${result.fix}`)
    logWarn(result.message.split('\n')[0] ?? '')
    outro()
    emit(emitJson, {
      root,
      subject: subject.name,
      reason: result.reason,
      message: result.message,
      ...(result.reason === 'browser-missing'
        ? { install: INSTALL_BROWSER }
        : {}),
      ...(result.fix ? { fix: result.fix } : {}),
    })
    return 1
  }

  const groups = groupByTreatment(result.readings)

  logStep('Frames')
  for (const target of result.targets) {
    logInfo(`${target.location}  ${plural(target.elements, 'element')}`)
  }

  if (groups.length === 0) {
    return refuse(
      emitJson,
      root,
      'no-elements',
      `No ${subject.name} value was read on any of the ${plural(result.targets.length, 'frame')} read.`,
    )
  }

  printTreatments(groups, result.readings.length)
  const scale = compareScale(root, name, groups)
  logInfo(scale.line)
  outro()

  emit(emitJson, {
    root,
    subject: subject.name,
    frames: result.targets.map(({ location, elements }) => ({
      frame: location,
      elements,
    })),
    elements: result.readings.length,
    treatments: groups.map(({ treatment, count, locations, samples }) => ({
      treatment,
      count,
      frames: locations,
      samples,
    })),
    scale: scale.record,
    durationMs: result.durationMs,
  })
  return 0
}

function printTreatments(
  groups: readonly TreatmentGroup[],
  elements: number,
): void {
  logStep('Treatments')
  logInfo(
    `${plural(groups.length, 'answer')} across ${plural(elements, 'element')}`,
  )
  for (const group of groups) {
    logInfo(`  ${group.count}x  ${group.treatment}`)
    logInfo(
      `      ${abbreviate(group.samples, group.count)} on ${abbreviate(group.locations, group.locations.length)}`,
    )
  }
}

/**
 * The total line and its record. A record carrying no value for the subject,
 * as an intent record never does, says the comparison is missing rather than
 * reporting every value as off the record.
 */
function compareScale(
  root: string,
  subject: ValueSubject,
  groups: readonly TreatmentGroup[],
): { line: string; record: Record<string, unknown> } {
  const path = join(root, DESIGN_DOCUMENT)
  const record = relative(root, path)
  const distinct = groups.length
  const scale = readScale(path, subject)
  const total = `${plural(distinct, 'distinct value')}`

  if (scale.kind === 'no-record') {
    return {
      line: `${total}, and no ${record} to compare against`,
      record: { kind: scale.kind, record, distinct },
    }
  }
  if (scale.kind === 'no-values') {
    return {
      line: `${total}, and ${record} carries no ${subject} value, so the stylesheet its lead names is unread`,
      record: { kind: scale.kind, record, distinct },
    }
  }
  const offRecord = groups
    .map((group) => group.treatment)
    .filter((value) => !scale.values.includes(value))
  return {
    line: `${total} against ${scale.values.length} in ${record}, ${offRecord.length} off the record`,
    record: {
      kind: scale.kind,
      record,
      distinct,
      carried: scale.values.length,
      offRecord,
    },
  }
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
