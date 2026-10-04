import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Command } from 'commander'
import { INSTALL_BROWSER, isEngineMissing } from '@/browser/engine'
import type { DriverRefusal } from '@/driver/drive'
import { describeViewport } from '@/driver/probes/viewport'
import { PROBE_NAMES, readDriverPlan } from '@/driver/steps'
import type { PlanRefusal } from '@/driver/steps'
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
 * Holds wiring only. Every browser reference sits behind `loadDriver`, because
 * `src/cli.ts` imports this module at startup and resolving the engine there
 * would put a browser launch in front of every other command.
 */
type Driver = typeof import('@/driver/drive')

interface RunOptions {
  readonly json?: boolean
}

/**
 * Spelled here rather than through `plural`, which appends a bare `s` and gets
 * the plural of this noun wrong.
 */
function passes(count: number): string {
  return `${count} ${count === 1 ? 'pass' : 'passes'}`
}

/** What a reader does about each way the run document produced no drive. */
const PLAN_REFUSALS: Record<PlanRefusal, string> = {
  'unreadable-plan':
    'The run file is not valid JSON, so no step could be read.',
  'no-steps': 'The run names no step, so there is nothing to drive.',
  'no-probes': 'The run names no probe, so every step would measure nothing.',
  'unknown-probe': 'The run names a probe this build does not ship.',
  'bad-step': 'A step is missing something the driver needs to perform it.',
  'no-viewport': 'The run declares no viewport to render at.',
  'no-width': 'The run declares no viewport width.',
  'no-heights':
    'The run names no viewport height, and this command defaults none.',
}

const DRIVE_REFUSALS: Record<DriverRefusal, string> = {
  'browser-missing': 'The browser binary is not installed in this project.',
  'server-unreachable': 'Nothing answered at the URL, so no state was reached.',
  'drive-failed': 'The drive failed against a reachable page.',
}

export function register(program: Command): void {
  program
    .command('drive')
    .description(
      'Walk a page through named interactions and measure each state',
    )
    .argument('<url>', 'Address to drive')
    .argument(
      '<run>',
      'JSON file naming the viewports, the probes, and the steps',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'A render answers about a page as it loads. Every defect that exists',
        'only after a menu opens, an answer is chosen, or the page scrolls is',
        'invisible to one, which is the axis this adds. Probes run after each',
        'step and never on arrival, so a run reaches the load state by opening',
        'with a wait step of its own. Write one wherever canon capture does not',
        'run, since nothing else there measures the page as it first painted.',
        '',
        'The run file carries the viewport, the default probe list, and the',
        'steps. A step names its own probes to override the default. Viewport',
        'heights are never defaulted: the heights a defect hides at are a',
        'property of the layout rather than of this command.',
        '',
        '  {',
        '    "viewport": { "width": 1440, "heights": [900, 1200, 1500] },',
        '    "probes": ["focus", "details"],',
        '    "steps": [',
        '      { "name": "open the menu", "kind": "click", "target": "#menu" },',
        '      { "name": "reach the diagram", "kind": "scroll", "target": "figure",',
        '        "probes": ["diagram-geometry", "diagram-strokes"] }',
        '    ]',
        '  }',
        '',
        'It reports findings and never gates. Every probe here carries a class',
        'of false finding a throwaway version already produced, so a run that',
        'ends the build on its own reading is a claim this catalog has not',
        'earned. Branch on the JSON record instead.',
        '',
        'Needs a reachable page and a browser binary. Install the browser with:',
        `  ${INSTALL_BROWSER}`,
        '',
        'Probes:',
        ...PROBE_NAMES.map((name) => `  ${name}`),
        '',
        'Step kinds:',
        '  click <target>   press the first element the selector matches',
        '  scroll <target>  bring the first match into view',
        '  fill <target>    type text into the first match',
        '  tab [count]      advance keyboard focus',
        '  wait <ms>        hold, for a state the page reaches on its own',
        '',
        'Exit codes:',
        '  0  the drive completed, with its findings reported',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon drive http://localhost:4173 run.json',
        '  canon drive http://localhost:4173 run.json --json',
        '',
      ].join('\n'),
    )
    .action(async (url: string, run: string, opts: RunOptions) => {
      process.exitCode = await runDriver(url, run, opts)
    })
}

async function runDriver(
  url: string,
  runPath: string,
  opts: RunOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const path = resolve(runPath)

  intro(`canon drive ${url}`)

  let source: string
  try {
    source = readFileSync(path, 'utf8')
  } catch (error) {
    return refuse(
      emitJson,
      url,
      'no-run-file',
      `No run file at ${path}. ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const read = readDriverPlan(source)
  if (read.kind === 'refused') {
    return refuse(
      emitJson,
      url,
      read.reason,
      `${PLAN_REFUSALS[read.reason]} ${read.detail}`,
    )
  }

  const { plan } = read

  logStep('Scope')
  logInfo(
    `${plural(plan.steps.length, 'step')} at ${plan.viewports.map(describeViewport).join(', ')}, measuring ${plan.probes.join(', ')}`,
  )

  const driver = await loadDriver()
  if (!driver) {
    logStep('Browser')
    logError('the browser engine is not installed in this project')
    logWarn(`Install it with: ${INSTALL_BROWSER}`)
    outro()
    emit(emitJson, {
      url,
      run: path,
      reason: 'engine-missing',
      install: INSTALL_BROWSER,
    })
    return 1
  }

  const result = await driver.drive({ url, plan })

  if (result.status === 'failed') {
    logStep('Refused')
    logWarn(DRIVE_REFUSALS[result.reason])
    if (result.reason === 'server-unreachable') {
      logWarn(`Start whatever serves ${url}, then run this again.`)
    }
    if (result.reason === 'browser-missing') {
      logWarn(`Install the browser binary with: ${INSTALL_BROWSER}`)
    }
    logWarn(result.message.split('\n')[0] ?? '')
    outro()
    emit(emitJson, {
      url,
      run: path,
      reason: result.reason,
      message: result.message,
      ...(result.reason === 'browser-missing'
        ? { install: INSTALL_BROWSER }
        : {}),
    })
    return 1
  }

  logStep('Passes')
  for (const pass of result.passes) {
    logInfo(
      `${pass.viewport}  ${pass.step}  ${plural(pass.probes, 'probe')}  ${plural(pass.findings, 'finding')}`,
    )
  }

  logStep('Findings')
  if (result.findings.length === 0) {
    logInfo(
      `nothing across ${passes(result.passes.length)}, which is a reading rather than a pass mark`,
    )
  } else {
    logInfo(
      `${plural(result.findings.length, 'finding')} across ${passes(result.passes.length)}`,
    )
    for (const finding of result.findings) {
      logInfo(`  ${finding.probe}  ${finding.selector}`)
      logInfo(`      ${finding.detail}`)
      logInfo(`      after ${finding.step} at ${finding.viewport}`)
      logInfo(`      ${finding.measured}`)
    }
  }
  outro()

  emit(emitJson, {
    url,
    run: path,
    viewports: plan.viewports,
    passes: result.passes,
    findings: result.findings,
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
  url: string,
  reason: string,
  message: string,
): number {
  logStep('Refused')
  logWarn(message)
  outro()
  emit(emitJson, { url, reason, message })
  return 1
}

async function loadDriver(): Promise<Driver | undefined> {
  try {
    return await import('@/driver/drive')
  } catch (error) {
    if (isEngineMissing(error)) return undefined
    throw error
  }
}

function emit(json: boolean, record: unknown): void {
  if (json) process.stdout.write(`${JSON.stringify(record)}\n`)
}
