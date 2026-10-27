import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Command } from 'commander'
import { INSTALL_BROWSER, isEngineMissing } from '@/browser/engine'
import { cameraTrack, readRate } from '@/take/camera'
import { readTakeLog } from '@/take/log'
import { readTakePlan } from '@/take/plan'
import type { TakePlanRefusal } from '@/take/plan'
import type { TakeRefusal } from '@/take/film'
import { renderReel } from '@/take/reel'
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
 * Holds wiring only. Every browser reference sits behind `loadTake`, because
 * `src/cli.ts` imports this module at startup and resolving the engine there
 * would put a browser launch in front of every other command.
 */
type Take = typeof import('@/take/film')

interface RunOptions {
  readonly out?: string
  readonly reel?: string
  readonly json?: boolean
}

interface CameraOptions {
  readonly out?: string
  readonly rate?: string
  readonly json?: boolean
}

const INSTALL_FFMPEG =
  'install FFmpeg from your package manager, such as apt install ffmpeg or brew install ffmpeg'

/** What a reader does about each way the plan produced no take. */
const PLAN_REFUSALS: Record<TakePlanRefusal, string> = {
  'unreadable-plan':
    'The plan file is not valid JSON, so no beat could be read.',
  'no-beats': 'The plan names no beat, so there is nothing to film.',
  'bad-beat':
    'A beat is missing its name or carries a setup that is not a list.',
  'no-steps': 'A beat names no step, so its take would film nothing.',
  'unknown-route':
    'The plan or a beat names a route this build does not record on.',
  'bad-step': 'A step is missing something the take needs to perform it.',
}

const TAKE_REFUSALS: Record<TakeRefusal, string> = {
  'ffmpeg-missing': 'FFmpeg is not installed, so no clip could be encoded.',
  'browser-missing': 'The headless shell is not installed in this project.',
  'server-unreachable': 'Nothing answered at the URL, so no beat was filmed.',
  'target-missing': 'A step names a target the page does not carry.',
  'take-failed': 'The take failed against a reachable page.',
}

export function register(program: Command): void {
  const take = program
    .command('take')
    .description(
      'Film a web app beat by beat with a click log and camera track',
    )
    .argument('<url>', 'Address to film')
    .argument('<plan>', 'JSON file naming the beats and their steps')
    // Checked in the action rather than required here, since commander checks
    // a parent's required options on every subcommand, `camera` included.
    .option('--out <dir>', 'Folder the clips, logs, and tracks land in')
    // Keeps this command's options ahead of `camera`, which reuses --out and
    // --json for its own.
    .enablePositionalOptions()
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--reel <file>',
      'Also join the beats into one animated WebP with the pointer drawn',
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Films each beat from a fresh load of the page into its own folder under',
        '--out, numbered in plan order: clip.mp4, log.json, camera.json, and',
        "still.jpg, the clip's closing frame. take.json beside them lists every",
        'beat and the route that filmed it.',
        '',
        'A step beat is filmed by frame stepping in chrome-headless-shell, at',
        '3840x2160 and exactly 60 fps, with the page clock advancing one frame',
        'per step. A frame slower than 2 s falls back to a real-time screencast',
        'at 1920x1080 for that beat, and the record says so. A screencast beat',
        'skips the stepper.',
        '',
        'No cursor is drawn in a clip. The edit draws it from the log at a',
        'constant size, and the camera track carries the cursor and click ring',
        'per frame beside the view. Canon renders nothing past the clip, save',
        'the reel below.',
        '',
        '--reel <file> joins every beat in plan order into one looping animated',
        'WebP at 960 wide and 20 fps, keeping every third frame, with the cursor',
        'and click ring drawn from each camera track. It carries no zoom, so a',
        "reviewer sees the whole page. clip.mp4 stays each beat's raw take.",
        '',
        '  {',
        '    "beats": [',
        '      { "name": "open the kit",',
        '        "setup": [{ "kind": "click", "target": "text=Design" }],',
        '        "steps": [',
        '          { "kind": "click", "target": "#kit" },',
        '          { "kind": "wait", "ms": 400 }',
        '        ] }',
        '    ]',
        '  }',
        '',
        'Step kinds:',
        '  move <target>|<x,y>    glide the pointer to a target or a point',
        '  click <target>         glide to the target and press it',
        '  fill <target> <text>   press the target and type the text',
        '  scroll <target> <dy>   glide to the target and wheel dy pixels',
        '  wait <ms>              hold, for a state the page reaches on its own',
        '',
        'A top-level route sets the route of every beat that names none of its',
        'own. A beat carrying push: false keeps its camera on the whole page,',
        'with the cursor and click ring still in the track, and its log.json',
        'records push: false. Each log.json carries clip, the clip size in',
        'pixels, which caps the zoom depth so a 1920-wide screencast stays sharp.',
        '',
        'A target is a CSS selector, or text=<words> for the first innermost',
        'element with a size whose whole text is those words, so a hidden copy',
        'earlier in the page is skipped. Setup steps run before the first kept',
        'frame. Every beat opens and closes on a 0.6 s hold.',
        '',
        'Needs a reachable page, FFmpeg, and the headless shell. Install with:',
        `  ${INSTALL_BROWSER}`,
        '',
        'Reasons:',
        '  no-plan-file        nothing readable at the plan path',
        '  unreadable-plan     the plan file is not valid JSON',
        '  no-beats            the plan names no beat',
        '  bad-beat            a beat has no name or a setup that is not a list',
        '  no-steps            a beat names no step',
        '  unknown-route       the plan or a beat names a route other than step or',
        '                      screencast',
        '  bad-step            a step is missing what the take needs to perform it',
        '  engine-missing      the browser engine is not installed in this project',
        '  ffmpeg-missing      FFmpeg is not on the PATH',
        '  browser-missing     the headless shell or browser binary is not installed',
        '  server-unreachable  nothing answered at the URL',
        '  target-missing      a step names a target the page does not carry',
        '  take-failed         the take failed against a reachable page',
        '  reel-failed         every beat was filmed and the reel did not encode',
        '',
        'A refusal in a beat carries beat. target-missing carries still when the',
        "page answered a capture, the beat folder's still.jpg as the step met it. A",
        'beat that fell back to the screencast before refusing carries fallback,',
        'the reason it fell back. The screencast opens the address a second time,',
        'so a single-use link is spent by then: check the access before the',
        'selector.',
        '',
        'Exit codes:',
        '  0  every beat was filmed, and the reel written when asked for',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon take http://localhost:4173 plan.json --out .canon/tmp/demo/takes',
        '  canon take http://localhost:4173 plan.json --out takes --json',
        '  canon take http://localhost:4173 plan.json --out takes --reel takes/reel.webp',
        '',
      ].join('\n'),
    )
    .action(
      async (url: string, plan: string, opts: RunOptions, command: Command) => {
        if (!opts.out)
          command.error("error: required option '--out <dir>' not specified")
        process.exitCode = await runTake(url, plan, { ...opts, out: opts.out })
      },
    )

  take
    .command('camera')
    .description("Build a camera track from a take's log.json")
    .argument('<log>', "A beat's log.json, as a take wrote it")
    .helpOption('-h, --help', 'Show this help message')
    .option('--out <file>', 'Write the track to a file rather than stdout')
    .option(
      '--rate <n>',
      'How many times faster the edit plays the clip, 1 by default',
    )
    .option('--json', 'Add a machine-readable record on stdout with --out')
    .addHelpText(
      'after',
      [
        '',
        "Builds the same camera track a take writes beside each beat's clip, from",
        'the log alone, so a track can be rebuilt for a clip the edit plays at',
        'another speed. With no --out the track is the data on stdout, one line,',
        'and a refusal under --json is the record there instead.',
        '',
        '--rate <n> builds the track on the playback clock of a clip sped up n',
        'times, dividing every time in the log by n, so a zoom settles at the',
        'speed a viewer sees rather than pumping several times a beat.',
        '',
        "The zoom depth is capped by the clip's resolution, read from the log's",
        'clip field, or from its route on a log written before that field. A log',
        'carrying push: false holds the whole page with the cursor and ring.',
        '',
        'Reasons:',
        '  no-log-file     nothing readable at the log path',
        "  unreadable-log  the file is not a take's log.json",
        '  bad-rate        --rate is not a positive number',
        '',
        'Exit codes:',
        '  0  the track was written',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        "  canon take camera takes/01-open/log.json | jq '.frames | length'",
        '  canon take camera takes/01-open/log.json --rate 2 --out camera-2x.json',
        '',
      ].join('\n'),
    )
    .action((log: string, opts: CameraOptions) => {
      process.exitCode = runCamera(log, opts)
    })
}

function runCamera(logPath: string, opts: CameraOptions): number {
  const emitJson = opts.json ?? false
  const path = resolve(logPath)
  const refuseCamera = (reason: string, message: string): number => {
    logWarn(message)
    emit(emitJson, { log: path, reason, message })
    return 1
  }

  const rate = opts.rate === undefined ? 1 : readRate(opts.rate)
  if (rate === undefined) {
    return refuseCamera(
      'bad-rate',
      `--rate ${opts.rate} is not a positive number, such as 1.5 or 2.`,
    )
  }

  let source: string
  try {
    source = readFileSync(path, 'utf8')
  } catch (error) {
    return refuseCamera(
      'no-log-file',
      `No log file at ${path}. ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const read = readTakeLog(source)
  if (read.kind === 'refused') {
    return refuseCamera(
      'unreadable-log',
      `${path} is not a take's log.json, being the file beside a beat's clip.mp4. ${read.detail}`,
    )
  }

  const track = cameraTrack(read.log, { rate })
  const line = `${JSON.stringify(track)}\n`
  if (!opts.out) {
    process.stdout.write(line)
    return 0
  }
  const out = resolve(opts.out)
  writeFileSync(out, line)
  logInfo(`${out}  ${plural(track.frames.length, 'frame')}  rate ${rate}`)
  emit(emitJson, { log: path, out, frames: track.frames.length, rate })
  return 0
}

async function runTake(
  url: string,
  planPath: string,
  opts: RunOptions & { readonly out: string },
): Promise<number> {
  const emitJson = opts.json ?? false
  const path = resolve(planPath)

  intro(`canon take ${url}`)

  let source: string
  try {
    source = readFileSync(path, 'utf8')
  } catch (error) {
    return refuse(
      emitJson,
      url,
      'no-plan-file',
      `No plan file at ${path}. ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const read = readTakePlan(source)
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
    `${plural(plan.beats.length, 'beat')} into ${resolve(opts.out)}: ${plan.beats.map((beat) => beat.name).join(', ')}`,
  )

  const taker = await loadTake()
  if (!taker) {
    logStep('Browser')
    logError('the browser engine is not installed in this project')
    logWarn(`Install it with: ${INSTALL_BROWSER}`)
    outro()
    emit(emitJson, {
      url,
      plan: path,
      reason: 'engine-missing',
      install: INSTALL_BROWSER,
    })
    return 1
  }

  logStep('Filming')
  const result = await taker.take({ url, plan, out: opts.out })

  if (result.status === 'failed') {
    logStep('Refused')
    logWarn(TAKE_REFUSALS[result.reason])
    if (result.beat) logWarn(`in beat ${result.beat}`)
    if (result.fallback) {
      logWarn(
        `after falling back to a screencast, which opened the address again: ${result.fallback}`,
      )
    }
    if (result.reason === 'server-unreachable') {
      logWarn(`Start whatever serves ${url}, then run this again.`)
    }
    if (result.reason === 'browser-missing') {
      logWarn(`Install the headless shell with: ${INSTALL_BROWSER}`)
    }
    if (result.reason === 'ffmpeg-missing') logWarn(`Then ${INSTALL_FFMPEG}.`)
    logWarn(result.message.split('\n')[0] ?? '')
    outro()
    emit(emitJson, {
      url,
      plan: path,
      reason: result.reason,
      message: result.message,
      ...(result.beat ? { beat: result.beat } : {}),
      ...(result.fallback ? { fallback: result.fallback } : {}),
      ...(result.still ? { still: result.still } : {}),
      ...(result.reason === 'browser-missing'
        ? { install: INSTALL_BROWSER }
        : {}),
    })
    return 1
  }

  for (const beat of result.beats) {
    logInfo(
      `${beat.dir}  ${beat.route}  ${plural(beat.frames, 'frame')}  ${beat.seconds} s`,
    )
    if (beat.fallback) logWarn(`  filmed by screencast: ${beat.fallback}`)
  }

  const filmed = {
    url,
    plan: path,
    out: result.out,
    beats: result.beats,
    durationMs: result.durationMs,
  }
  if (!opts.reel) {
    outro()
    emit(emitJson, filmed)
    return 0
  }

  logStep('Reel')
  try {
    const reel = await renderReel(result.out, result.beats, resolve(opts.reel))
    logInfo(
      `${reel.file}  ${plural(reel.frames, 'frame')}  ${reel.seconds} s  ${(reel.bytes / 1e6).toFixed(1)} MB`,
    )
    outro()
    emit(emitJson, { ...filmed, reel })
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logWarn('Every beat was filmed, and the reel did not encode.')
    logWarn(message.split('\n')[0] ?? '')
    outro()
    emit(emitJson, { ...filmed, reason: 'reel-failed', message })
    return 1
  }
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

async function loadTake(): Promise<Take | undefined> {
  try {
    return await import('@/take/film')
  } catch (error) {
    if (isEngineMissing(error)) return undefined
    throw error
  }
}

function emit(json: boolean, record: unknown): void {
  if (json) process.stdout.write(`${JSON.stringify(record)}\n`)
}
