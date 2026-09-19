import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import type { Command } from 'commander'
import { INSTALL_BROWSER, isEngineMissing } from '@/browser/engine'
import { parseDraft } from '@/demo/beats'
import { compilePlan, parsePlan, unresolved } from '@/demo/compile'
import {
  convertToGif,
  convertToMp4,
  extractFrames,
  INSTALL_CONVERTER,
} from '@/demo/container'
import { DEFAULT_CURSORS } from '@/demo/cursors'
import { loadCursorTheme } from '@/demo/theme'
import { intro, logError, logInfo, logStep, logWarn, outro, plural } from '@/ui'

const DEFAULT_OUT = 'demos'

/**
 * Holds wiring only. Every browser reference sits behind `loadDriver`, because
 * `src/cli.ts` imports this module at startup and resolving the engine there
 * would put a browser launch in front of every other command.
 */
type Driver = typeof import('@/demo/drive')

interface CompileOptions {
  readonly out: string
  readonly slug?: string
  readonly force?: boolean
  readonly json?: boolean
}

interface RunOptions {
  readonly out?: string
  readonly cursor?: string
  readonly video: boolean
  readonly still: boolean
  readonly gif?: boolean
  readonly json?: boolean
}

interface FramesOptions {
  readonly out?: string
  readonly fps: string
  readonly json?: boolean
}

export function register(program: Command): void {
  const demo = program
    .command('demo')
    .description('Drive a running application and record what it did')
    .helpOption('-h, --help', 'Show this help message')

  demo
    .command('compile')
    .description('Turn a screencast draft into a plan a run can drive')
    .argument('<draft>', 'Screencast draft written by draft-screencast')
    .helpOption('-h, --help', 'Show this help message')
    .option('-o, --out <dir>', 'Directory the plan is written to', DEFAULT_OUT)
    .option('-s, --slug <slug>', 'Plan name, defaulting to the draft filename')
    .option('--force', 'Overwrite a plan that already exists')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'The plan is committed rather than scratch. It carries the target, the',
        'wait condition, and the timing a beat lacks, and the timing is a',
        'starting point you tune, which is why a recompile refuses to overwrite.',
        '',
        'Exit codes:',
        '  0  a plan was written',
        '  1  refused, with the reason on stderr',
        '',
        'Examples:',
        '  canon demo compile .canon/tmp/screencast/inline-edit.md',
        '  canon demo compile draft.md --out demos --force',
        '',
      ].join('\n'),
    )
    .action(async (draft: string, opts: CompileOptions) => {
      process.exitCode = runCompile(draft, opts)
    })

  demo
    .command('run')
    .description('Drive the application a plan names and write the recording')
    .argument('<plan>', 'Plan written by canon demo compile')
    .helpOption('-h, --help', 'Show this help message')
    .option('-o, --out <dir>', 'Directory to write into, overriding the plan')
    .option(
      '-c, --cursor <dir>',
      'Cursor theme folder to draw the pointer from',
    )
    .option('--no-video', 'Skip the recording and write only the still')
    .option('--no-still', 'Skip the still and write only the recording')
    .option('--gif', 'Also write a gif, for a host that strips video')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Needs a browser binary. Install it with:',
        `  ${INSTALL_BROWSER}`,
        '',
        'Writes mp4 beside the webm when ffmpeg is on PATH, and skips it',
        `otherwise without failing the run. Install it with: ${INSTALL_CONVERTER}`,
        '',
        'A gif is opt-in behind --gif, since it is far larger than the webm',
        'and only a host that strips video needs one. GitHub is that host.',
        '',
        'Exit codes:',
        '  0  the recording and the still were written',
        '  1  refused, with the reason on stderr',
        '',
        'Examples:',
        '  canon demo run demos/inline-edit.json',
        '  canon demo run demos/inline-edit.json --cursor ~/cursors/theme',
        '',
      ].join('\n'),
    )
    .action(async (plan: string, opts: RunOptions) => {
      process.exitCode = await runDrive(plan, opts)
    })

  demo
    .command('frames')
    .description('Pull numbered still frames from a recorded video')
    .argument('<video>', 'Video written by canon demo run')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '-o, --out <dir>',
      'Directory to write frames into, default beside the video',
    )
    .option('--fps <n>', 'Frames extracted per second of video', '1')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Needs ffmpeg on PATH, the same binary demo run already shells to for',
        `mp4 and gif conversion. Install it with: ${INSTALL_CONVERTER}`,
        '',
        'Exit codes:',
        '  0  frames were written',
        '  1  refused, with the reason on stderr',
        '',
        'Examples:',
        '  canon demo frames demos/inline-edit.webm',
        '  canon demo frames demos/inline-edit.webm --fps 2 --out frames',
        '',
      ].join('\n'),
    )
    .action(async (video: string, opts: FramesOptions) => {
      process.exitCode = await runFrames(video, opts)
    })
}

function runCompile(draftPath: string, opts: CompileOptions): number {
  intro('canon demo compile')

  const source = resolve(process.cwd(), draftPath)
  if (!existsSync(source)) {
    logStep('Draft')
    logError(`${draftPath} not found`)
    outro()
    emit(opts.json, { draft: source, reason: 'draft-missing' })
    return 1
  }

  const parsed = parseDraft(readFileSync(source, 'utf8'))
  if (parsed.status === 'failed') {
    logStep('Draft')
    logError(`${display(source)}: ${parsed.reason}`)
    outro()
    emit(opts.json, {
      draft: source,
      reason: 'draft-unreadable',
      message: parsed.reason,
    })
    return 1
  }

  const slug = opts.slug ?? basename(source, extname(source))
  const target = resolve(process.cwd(), opts.out, `${slug}.json`)

  if (existsSync(target) && !opts.force) {
    logStep('Plan')
    logError(`${display(target)} already exists`)
    // Stated rather than implied, because the value at risk is whatever the
    // operator set by hand, such as timing tuned by watching a recording or a
    // color scheme, and the draft can reproduce neither.
    logWarn('Pass --force to overwrite it, losing any field set by hand.')
    outro()
    emit(opts.json, { plan: target, reason: 'plan-exists' })
    return 1
  }

  const plan = compilePlan(parsed.draft, { slug, outDir: opts.out })
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`)

  logStep('Draft')
  logInfo(`${display(source)}  ${plural(parsed.draft.beats.length, 'beat')}`)

  logStep('Plan')
  logInfo(display(target))

  const outstanding = unresolved(plan)
  logStep('Outstanding')
  if (outstanding.length === 0) {
    logInfo('Nothing to fill, so the plan runs as written.')
  } else {
    logWarn(
      `${plural(outstanding.length, 'field')} the draft could not supply:`,
    )
    for (const field of outstanding) logWarn(`  ${field}`)
  }
  outro()

  emit(opts.json, {
    draft: source,
    plan: target,
    beats: parsed.draft.beats.length,
    unresolved: outstanding,
  })
  return 0
}

async function runDrive(planPath: string, opts: RunOptions): Promise<number> {
  intro('canon demo run')

  const source = resolve(process.cwd(), planPath)
  if (!existsSync(source)) {
    logStep('Plan')
    logError(`${planPath} not found`)
    outro()
    emit(opts.json, { plan: source, reason: 'plan-missing' })
    return 1
  }

  const parsed = parsePlan(readFileSync(source, 'utf8'))
  if (parsed.status === 'failed') {
    logStep('Plan')
    logError(`${display(source)}: ${parsed.reason}`)
    outro()
    emit(opts.json, {
      plan: source,
      reason: 'plan-unreadable',
      message: parsed.reason,
    })
    return 1
  }

  if (!opts.video && !opts.still) {
    logStep('Output')
    logError('--no-video and --no-still together leave nothing to write')
    outro()
    emit(opts.json, { plan: source, reason: 'no-output-requested' })
    return 1
  }

  const outstanding = unresolved(parsed.plan)
  if (outstanding.length) {
    logStep('Plan')
    logError(
      `${display(source)} has ${plural(outstanding.length, 'field')} to fill`,
    )
    for (const field of outstanding) logWarn(`  ${field}`)
    outro()
    emit(opts.json, {
      plan: source,
      reason: 'plan-unresolved',
      unresolved: outstanding,
    })
    return 1
  }

  logStep('Plan')
  logInfo(`${display(source)}  ${plural(parsed.plan.steps.length, 'step')}`)

  const cursors = resolveCursors(opts.cursor)
  if (cursors.status === 'failed') {
    logError(cursors.reason)
    outro()
    emit(opts.json, { plan: source, reason: 'cursor-unreadable' })
    return 1
  }
  logInfo(cursors.label)

  const driver = await loadDriver()
  if (!driver) {
    logStep('Browser')
    logError('the browser engine is not installed in this project')
    logWarn(`Install it with: ${INSTALL_BROWSER}`)
    outro()
    emit(opts.json, {
      plan: source,
      reason: 'engine-missing',
      install: INSTALL_BROWSER,
    })
    return 1
  }

  logStep('Recording')
  const result = await driver.drive({
    plan: parsed.plan,
    cursors: cursors.value,
    ...(opts.video
      ? { videoPath: outputPath(parsed.plan.output.video, opts.out) }
      : {}),
    ...(opts.still
      ? { stillPath: outputPath(parsed.plan.output.still, opts.out) }
      : {}),
  })

  if (result.status === 'failed') {
    logError(result.message.split('\n')[0] ?? 'the run failed')
    if (result.reason === 'browser-missing') {
      logWarn(`Install the browser binary with: ${INSTALL_BROWSER}`)
    }
    outro()
    emit(opts.json, {
      plan: source,
      reason: result.reason,
      message: result.message,
      ...(result.reason === 'browser-missing'
        ? { install: INSTALL_BROWSER }
        : {}),
    })
    return 1
  }

  if (result.videoPath) logInfo(display(result.videoPath))
  if (result.stillPath) logInfo(`${display(result.stillPath)}  still`)
  logInfo(
    `${result.steps} steps in ${Math.round(result.durationMs / 100) / 10}s`,
  )

  let mp4Path: string | undefined
  let mp4Reason: string | undefined
  if (result.videoPath) {
    logStep('Container')
    const converted = await convertToMp4(result.videoPath)
    if (converted.status === 'converted') {
      mp4Path = converted.mp4Path
      logInfo(display(mp4Path))
    } else if (converted.status === 'skipped') {
      mp4Reason = converted.reason
      logWarn('ffmpeg is not installed, so no mp4 was written.')
      logWarn(`Install it with: ${INSTALL_CONVERTER}`)
    } else {
      mp4Reason = converted.reason
      logWarn(`mp4 conversion failed: ${converted.reason}`)
    }
  }

  let gifPath: string | undefined
  let gifReason: string | undefined
  if (result.videoPath && opts.gif) {
    const converted = await convertToGif(result.videoPath)
    if (converted.status === 'converted') {
      gifPath = converted.gifPath
      logInfo(display(gifPath))
    } else if (converted.status === 'skipped') {
      gifReason = converted.reason
      logWarn('ffmpeg is not installed, so no gif was written.')
      logWarn(`Install it with: ${INSTALL_CONVERTER}`)
    } else {
      gifReason = converted.reason
      logWarn(`gif conversion failed: ${converted.reason}`)
    }
  }

  outro()

  emit(opts.json, {
    plan: source,
    video: result.videoPath ?? null,
    mp4: mp4Path ?? null,
    gif: gifPath ?? null,
    still: result.stillPath ?? null,
    steps: result.steps,
    durationMs: result.durationMs,
    ...(mp4Reason ? { mp4Reason } : {}),
    ...(gifReason ? { gifReason } : {}),
  })
  return 0
}

async function runFrames(
  videoPath: string,
  opts: FramesOptions,
): Promise<number> {
  intro('canon demo frames')

  const source = resolve(process.cwd(), videoPath)
  if (!existsSync(source)) {
    logStep('Video')
    logError(`${videoPath} not found`)
    outro()
    emit(opts.json, { video: source, reason: 'video-missing' })
    return 1
  }

  logStep('Video')
  logInfo(display(source))

  const outDir = opts.out ? resolve(process.cwd(), opts.out) : undefined
  const fps = Number(opts.fps)

  logStep('Frames')
  const extracted = await extractFrames(source, outDir, { fps })
  if (extracted.status === 'skipped') {
    logError('ffmpeg is not installed, so no frames were written.')
    logWarn(`Install it with: ${INSTALL_CONVERTER}`)
    outro()
    emit(opts.json, { video: source, reason: extracted.reason })
    return 1
  }
  if (extracted.status === 'failed') {
    logError(`frame extraction failed: ${extracted.reason}`)
    outro()
    emit(opts.json, {
      video: source,
      reason: 'extraction-failed',
      message: extracted.reason,
    })
    return 1
  }

  for (const framePath of extracted.framePaths) logInfo(display(framePath))
  logInfo(`${plural(extracted.framePaths.length, 'frame')} at ${fps} fps`)
  outro()

  emit(opts.json, {
    video: source,
    frames: extracted.framePaths,
    fps,
  })
  return 0
}

type CursorChoice =
  | { status: 'ready'; value: typeof DEFAULT_CURSORS; label: string }
  | { status: 'failed'; reason: string }

/**
 * A theme contributes per state rather than per folder, so a folder carrying an
 * arrow and no hand still supplies its arrow and the bundled artwork covers the
 * rest.
 */
function resolveCursors(dir: string | undefined): CursorChoice {
  if (!dir) {
    return {
      status: 'ready',
      value: DEFAULT_CURSORS,
      label: 'pointer drawn from the bundled artwork',
    }
  }

  const loaded = loadCursorTheme(resolve(process.cwd(), dir), DEFAULT_CURSORS)
  if (loaded.status === 'failed')
    return { status: 'failed', reason: loaded.reason }

  return {
    status: 'ready',
    value: loaded.cursors,
    label: `pointer drawn from ${display(resolve(process.cwd(), dir))} for ${loaded.states.join(', ')}`,
  }
}

/**
 * Reports absence only when the module or its engine cannot be resolved, which
 * is the case a target hits before installing the browser package. Any other
 * import failure is a defect inside the driver and propagates, rather than
 * being reported as a missing dependency.
 */
async function loadDriver(): Promise<Driver | undefined> {
  try {
    return await import('@/demo/drive')
  } catch (error) {
    if (isEngineMissing(error)) return undefined
    throw error
  }
}

/**
 * Resolves where one artifact lands. `--out` replaces the directory the plan
 * names rather than acting as a root the plan's own directory hangs off, which
 * would nest the output path inside itself on every run that passes both.
 */
function outputPath(planned: string, out: string | undefined): string {
  const relativePath = out ? join(out, basename(planned)) : planned
  return resolve(process.cwd(), relativePath)
}

function emit(json: boolean | undefined, record: unknown): void {
  if (json) process.stdout.write(`${JSON.stringify(record)}\n`)
}

/**
 * Keeps a path clickable in the operator's terminal. A path outside the project
 * reports absolute, since a relative path to it is a run of `..` segments no
 * editor resolves.
 */
function display(path: string): string {
  const fromCwd = relative(process.cwd(), path)
  return fromCwd.startsWith('..') ? path : fromCwd
}
