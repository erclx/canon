import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { Command } from 'commander'
import { INSTALL_BROWSER, isEngineMissing } from '@/browser/engine'
import { type CameraTrack, cameraTrack, readRate } from '@/take/camera'
import { type Breach, checkBeat, sortBreaches } from '@/take/check'
import { requireFfmpeg } from '@/take/encode'
import { findStalls, stallWindows } from '@/take/stall'
import { readTakeLog } from '@/take/log'
import { beatViewport, parseViewport, readTakePlan } from '@/take/plan'
import type { TakePlanRefusal } from '@/take/plan'
import type { TakeRefusal } from '@/take/film'
import { reelShapeMismatch, renderReel } from '@/take/reel'
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
  readonly maxSeconds?: string
  readonly viewport?: string
  readonly json?: boolean
}

interface CameraOptions {
  readonly out?: string
  readonly rate?: string
  readonly json?: boolean
}

interface CheckOptions {
  readonly camera?: string
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
    'A beat is missing its name, carries a setup that is not a list, or carries a malformed network entry.',
  'no-steps': 'A beat names no step, so its take would film nothing.',
  'unknown-route':
    'The plan or a beat names a route this build does not record on.',
  'bad-step': 'A step is missing something the take needs to perform it.',
  'bad-viewport':
    'A window size is malformed, odd, or outside 320x240 to 1920x1080.',
}

const TAKE_REFUSALS: Record<TakeRefusal, string> = {
  'ffmpeg-missing': 'FFmpeg is not installed, so no clip could be encoded.',
  'browser-missing': 'The headless shell is not installed in this project.',
  'sandbox-blocked':
    'The headless shell or browser could not start its sandbox, as under the AppArmor user namespace restriction or when run as root.',
  'server-unreachable': 'Nothing answered at the URL, so no beat was filmed.',
  'target-missing': 'A step names a target the page does not carry.',
  'target-offscreen':
    'A step names a target or a point outside the window. A setup step brings a target into view, and a point has to move inside the window.',
  'target-covered':
    'A press on a target would land on another element drawn over it. Clear the cover in a setup step, or give the step "through": true when that layer is meant to take the press.',
  'target-ambiguous':
    'A step names a target matching more than one sized element. Narrow the selector or the text to the one meant.',
  'over-cap':
    'The filmed beats ran past --max-seconds, so the take stopped at the beat that crossed it.',
  'clip-mismatch':
    'A clip measured a different size from the one its route films at, so the clip, its log, and its still stay in the beat folder.',
  'network-unmatched':
    'A network pattern matched no request the page made, so the beat filmed without the state it holds or fails. Widen the pattern or check the address.',
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
    // Checked in the action, since commander would demand it of `camera` too.
    .option('--out <dir>', 'Folder the clips, logs, and tracks land in')
    // Keeps --out and --json apart from the ones `camera` reuses.
    .enablePositionalOptions()
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--reel <file>',
      'Also join the beats into one animated WebP with the pointer drawn',
    )
    .option(
      '--max-seconds <n>',
      'Refuse once the filmed beats run past n seconds in total',
    )
    .option(
      '--viewport <width>x<height>',
      'Film every beat naming no viewport in a window of this size, 1920x1080 by default',
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
        '3840x2160 by default and exactly 60 fps, with the page clock advancing',
        'one frame per step. A frame slower than 2 s falls back to a real-time',
        'screencast at 1920x1080 by default for that beat, in the same window,',
        'and the record says so. A screencast beat skips the stepper.',
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
        'The reel is lossless, so a fade-out leaves no ghost, and it falls back',
        'to lossy past 10 MB so a long reel still posts. The record says which',
        'in `lossless`.',
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
        '  move <target>|<x,y>    glide the pointer to a target or a point, and',
        '                         with hold <ms>, zoom onto its end for that long',
        '  click <target>|<x,y>   glide to the target or the point and press it',
        '  dblclick <target>|<x,y>',
        '                         glide to the target or the point, press twice',
        '  contextmenu <target>|<x,y>',
        '                         glide to the target or the point and press the',
        '                         right button, for a menu the page draws itself',
        '  drag <from> <to>       press the from aim, glide held, release on to',
        '  key <keys>             press a combination such as Control+K',
        '  fill <target> <text>   press the target, step the pointer off it, and',
        '                         type the text',
        '  scroll <target> <dy>   glide to the target, rest, and wheel dy pixels',
        '  wait <ms>              hold, for a state the page reaches on its own',
        '',
        'A point is an x and a y in CSS pixels of the beat window, written as',
        '"x": 592, "y": 314 on the step, or as { "x": 592, "y": 314 } for a',
        'drag from or to. It reaches content no top-document selector does, such',
        'as inside a frame or under a layer taking every pointer event, and it',
        'refuses as target-offscreen outside the window. A click, dblclick, or',
        'contextmenu carrying both a target and a point refuses, and a move',
        'carrying both takes its target. A point written as a target string,',
        'such as "592,314", refuses before filming.',
        '',
        'click, dblclick, contextmenu, and drag take modifiers, a list of Alt,',
        'Control, Meta, and Shift held through the press, as in',
        '"modifiers": ["Shift"]. keys names those modifiers joined by + ahead of',
        'one character or a named key: Enter, Tab, Escape, Backspace, Delete,',
        'Insert, Space, Home, End, PageUp, PageDown, the four arrows as ArrowUp',
        'and the like, and F1 to F12. A key moves no pointer, so the camera',
        'neither aims at it nor ends a zoom.',
        '',
        'A press on a target first reads what sits at the point it aims at. A',
        'click, dblclick, contextmenu, fill, or drag end landing on an element',
        'that is not the target, inside it, or around it refuses as',
        'target-covered, naming the cover by its tag and its id or first class.',
        'A step carrying "through": true skips the read and presses whatever is',
        'on top, for a layer built to take the press, and on a drag it covers',
        'both ends. A press at a point is never read.',
        '',
        'contextmenu sends the right button, so the page receives a contextmenu',
        'event. Neither route films the browser menu, so a beat films a menu the',
        'page draws after preventing that one. Its log.json click carries',
        'button: "right".',
        '',
        'A take paces each press on its own: every glide takes 600 ms to 1.2 s,',
        'and the pointer rests 300 ms on the target before a click, dblclick,',
        'contextmenu, drag, or scroll, and holds 500 ms on the result before the',
        'next step. A fill rests 450 ms on the field it pressed, steps the',
        "pointer over 300 ms to just past the field's bottom-right corner, kept",
        'inside the window, and settles 150 ms before its first key, so the',
        'typing stays in sight. It holds 500 ms after its last key. Setup steps',
        'run unpaced. The camera zooms in over the glide reaching a target and',
        'out over the glide leaving it, scaling about the target, and reads a',
        'run of moves logged back to back as one glide.',
        '',
        'drag drives pointer events, the kind a canvas board listens for. It',
        'starts no native HTML5 drag of a draggable element on the stepped route,',
        'so a beat needing one films the same only on the screencast route.',
        '',
        'A top-level route sets the route of every beat that names none of its',
        'own. A beat carrying push: false keeps its camera on the whole page,',
        'with the cursor and click ring still in the track, and its log.json',
        'records push: false. A beat carrying hand: false is one no person',
        'drives, such as an agent changing the page. Its steps run and log,',
        'its camera aims nowhere, its reel draws no cursor or ring, and its',
        'log.json and camera.json record hand: false. Each log.json carries',
        'clip, the clip size in pixels, which caps the zoom depth so a',
        '1920-wide screencast stays sharp.',
        '',
        '--viewport <width>x<height> sets the window every beat films in, and a',
        'beat carrying viewport sets its own, as in',
        '  "viewport": { "width": 800, "height": 600 }',
        'which wins over the option. Each side is even, from 320x240 up to the',
        'default 1920x1080, so a window shrinks and never grows past what is',
        'filmed by default. A stepped beat films at twice its window and a',
        'screencast at it, and the pointer starts at its center. Each log.json',
        "records viewport, the beat's window. A take with --reel refuses beats",
        'whose windows differ in aspect ratio before filming, naming the first',
        'that differs, since a reel shrinks every beat to one width.',
        '',
        'Scrollbars are hidden by default on both routes. A beat carrying',
        'scrollbars: true films with classic scrollbars drawn, which take a 15 px',
        'gutter of layout width, so set it only on a beat whose change is a scrollbar.',
        '',
        'A beat carrying network films a loading or error state by holding or',
        'failing the request that ends it, as in',
        '  "network": [{ "match": "*/api/report", "action": "hold" }]',
        'match is the whole request address with * matching any run of',
        'characters. hold leaves the request pending for the whole beat, and',
        'abort fails it. The list applies before the page loads, on either route',
        'and on a fallback, and the first matching entry wins. A held script,',
        'sheet, or image keeps the load event from firing, and the refusal names',
        'the held pattern. A pattern no request matched refuses the beat as',
        'network-unmatched. Each filmed beat records network, every pattern that',
        'matched with its action and its count of requests, and never an address.',
        '',
        'A target is a CSS selector, or text=<words> for the innermost element',
        'whose whole text is those words. Either resolves to its one match with',
        'a size, in the document or an open shadow root. A zero-size copy, such',
        'as display: none, is skipped, while a transparent or visibility: hidden',
        'copy keeps its size and counts. Two or more sized matches refuse as',
        'target-ambiguous rather than taking the first. Setup steps run before',
        'the first kept frame. Every filmed step starts from the window center,',
        'on either route, so a setup move or click never places the pointer. A',
        'beat needing it elsewhere opens with a filmed move. Every beat opens',
        'and closes on a 0.6 s hold.',
        '',
        'Needs a reachable page, FFmpeg, and the headless shell. Install with:',
        `  ${INSTALL_BROWSER}`,
        '',
        'Reasons:',
        '  bad-max-seconds     --max-seconds is not a positive number',
        '  bad-viewport        --viewport or a beat viewport is malformed, odd, or',
        '                      outside 320x240 to 1920x1080',
        '  reel-shape          --reel over beats whose windows differ in aspect',
        '                      ratio, naming the first that differs',
        '  no-plan-file        nothing readable at the plan path',
        '  unreadable-plan     the plan file is not valid JSON',
        '  no-beats            the plan names no beat',
        '  bad-beat            a beat has no name, a setup that is not a list, or a',
        '                      malformed network entry',
        '  no-steps            a beat names no step',
        '  unknown-route       the plan or a beat names a route other than step or',
        '                      screencast',
        '  bad-step            a step is missing what the take needs to perform it',
        '  engine-missing      the browser engine is not installed in this project',
        '  ffmpeg-missing      FFmpeg is not on the PATH',
        '  browser-missing     the headless shell or browser binary is not installed',
        '  sandbox-blocked     the headless shell or browser found no usable sandbox,',
        '                      as under AppArmor or as root, carrying fix when',
        '                      that setting reads 1',
        '  server-unreachable  nothing answered at the URL',
        '  target-missing      a step names a target the page does not carry',
        '  target-offscreen    a step names a target outside the window, so a setup',
        '                      step must bring it into view first, or a point',
        '                      outside it, which has to move inside the window',
        '  target-covered      a press on a target would land on another element',
        '                      drawn over it, naming the cover',
        '  target-ambiguous    a step names a target matching more than one sized',
        '                      element, naming the count',
        '  over-cap            the filmed beats ran past --max-seconds, naming the',
        '                      beat that crossed it',
        '  clip-mismatch       a clip measured a different size from the one its',
        '                      route films at, naming both sizes',
        '  network-unmatched   a network pattern matched no request, naming it',
        '  take-failed         the take failed against a reachable page',
        '  reel-failed         every beat was filmed and the reel did not encode',
        '',
        'A refusal in a beat carries beat. target-missing, target-offscreen,',
        'target-covered, and target-ambiguous carry still when the page answered',
        "a capture, the beat folder's still.jpg as the step met it.",
        'clip-mismatch carries still too, and leaves the clip and a log whose',
        'clip field is the measured size.',
        'network-unmatched carries still and leaves the clip and its log, since',
        'the beat filmed before the tally was read.',
        'A stall in recording retries the beat stepped at half size, device',
        'scale 1, before any fallback. A beat that fell back to the screencast',
        'before refusing carries fallback, the reason it fell back, and',
        'fallbackPhase, being settle, setup, or recording, where the stalled',
        'frame was begun. A filmed beat that fell back carries both too. A',
        'beat refused in the retry carries scale, the scale it retried at, and',
        'a beat filmed by the retry carries it too. The retry and the',
        'screencast each open the address again, so a single-use link is',
        'spent by then: check the access before the selector.',
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
        'carrying push: false holds the whole page with the cursor and ring,',
        'and one carrying hand: false holds it and records hand: false on the',
        'track.',
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

  take
    .command('check')
    .description("Check a take's beats against the timing rules")
    .argument('<takes>', 'The folder a take wrote, holding take.json')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--camera <name>',
      'The track file to read in each beat folder, camera.json by default',
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        "Reads every beat take.json lists, in its order, from the beat's log.json",
        'and camera track, and fails a beat breaking any rule below with the rule,',
        'the time, and the measured value. The limits are fixed, each a frame or',
        "more under the engine's own pacing, so a take the engine filmed passes",
        'on a 60 fps clock and a harness log or a trimmed beat is held to the same.',
        '',
        'Rules:',
        '  glide-fast   a glide under 550 ms. A fill steps off its field in 300 ms,',
        '               which is no glide and is exempt',
        '  no-rest      a press, wheel, type, or drag under 250 ms after the glide',
        '               reaching it ends',
        '  left-early   a glide leaving under 400 ms after a press',
        '  typed-under  typing with the cursor still on the field',
        '  zoom-fast    a zoom in or out over under 500 ms',
        '  pump         zooming back in under 1500 ms after zooming out',
        '  stall        a screencast or harness clip holding still past 500 ms',
        '               inside a typing burst or a drag, read by FFmpeg',
        '               freezedetect. A stepped beat skips it, since its clock',
        '               cannot stall',
        '',
        'A beat whose log carries hand: false skips glide-fast, no-rest,',
        'left-early, and typed-under, since no cursor is drawn, and still checks',
        'the zoom rules and stall. Times are clip milliseconds, but zoom-fast and',
        "pump read the track's own clock, so --camera camera-2x.json, a track",
        'rebuilt with canon take camera --rate 2, checks the zooms a viewer sees.',
        '',
        'The record is { takes, ok, beats: [{ name, dir, breaches: [{ rule, t,',
        'measured, limit }] }] }, beats in take.json order and breaches in time',
        'order, with reason breach and a message when any beat fails. A refusal',
        'carries ok false, reason, message, and beat when one beat refused.',
        '',
        'Reasons:',
        '  breach            a beat broke a rule',
        '  bad-camera        --camera names a path rather than a file name',
        '  no-takes          no readable take.json listing beats in the folder',
        "  unreadable-log    a beat's log.json is missing or not a take's log",
        '  no-track          a beat has no track file, as after a refilm that',
        '                    deleted its folder. Rebuild it with canon take camera',
        "  unreadable-track  a beat's track is not a camera track",
        '  ffmpeg-missing    a beat needs the stall rule and FFmpeg is not on the',
        '                    PATH, so the beat refuses rather than passing',
        '  stall-failed      FFmpeg could not read the clip of a beat the stall',
        '                    rule reads',
        '',
        'Exit codes:',
        '  0  every beat passed every rule',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  a beat broke a rule',
        '',
        'Examples:',
        '  canon take check .canon/tmp/demo/takes',
        '  canon take check takes --camera camera-2x.json --json',
        '',
      ].join('\n'),
    )
    .action(async (takes: string, opts: CheckOptions) => {
      process.exitCode = await runCheck(takes, opts)
    })
}

interface CheckedBeat {
  readonly name: string
  readonly dir: string
  readonly breaches: readonly Breach[]
}

class CheckRefusal extends Error {
  constructor(
    readonly reason: string,
    message: string,
    readonly beat?: string,
  ) {
    super(message)
  }
}

async function runCheck(
  takesPath: string,
  opts: CheckOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const takes = resolve(takesPath)
  const camera = opts.camera ?? 'camera.json'
  intro(`canon take check ${takes}`)
  try {
    if (camera !== basename(camera) || camera === '..') {
      throw new CheckRefusal(
        'bad-camera',
        `--camera ${camera} names a path. Name a file inside each beat folder, such as camera-2x.json.`,
      )
    }
    const beats: CheckedBeat[] = []
    for (const beat of readTakeBeats(takes)) {
      beats.push(await checkOne(takes, beat, camera))
    }
    const failed = beats.filter((beat) => beat.breaches.length > 0)
    logStep('Beats')
    for (const beat of beats) {
      if (beat.breaches.length === 0) logInfo(`${beat.dir}  pass`)
      else logWarn(`${beat.dir}  ${beat.breaches.length === 1 ? '1 breach' : `${beat.breaches.length} breaches`}`)
      for (const found of beat.breaches) {
        logWarn(
          `  ${found.rule}  ${(found.t / 1000).toFixed(2)} s  ${found.measured} ms against ${found.limit} ms`,
        )
      }
    }
    outro()
    if (failed.length === 0) {
      emit(emitJson, { takes, ok: true, beats })
      return 0
    }
    emit(emitJson, {
      takes,
      ok: false,
      beats,
      reason: 'breach',
      message: `${plural(failed.length, 'beat')} broke a timing rule: ${failed.map((beat) => beat.dir).join(', ')}. Refilm each rather than editing its log.`,
    })
    return 2
  } catch (error) {
    if (!(error instanceof CheckRefusal)) throw error
    logStep('Refused')
    logWarn(error.message)
    outro()
    emit(emitJson, {
      takes,
      ok: false,
      reason: error.reason,
      message: error.message,
      ...(error.beat ? { beat: error.beat } : {}),
    })
    return 1
  }
}

function readTakeBeats(
  takes: string,
): readonly { readonly name: string; readonly dir: string }[] {
  const path = join(takes, 'take.json')
  let document: unknown
  try {
    document = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new CheckRefusal(
      'no-takes',
      `No readable take.json at ${path}. ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const beats = (document as { beats?: unknown } | null)?.beats
  const valid =
    Array.isArray(beats) &&
    beats.length > 0 &&
    beats.every(
      (beat) => typeof beat?.name === 'string' && typeof beat?.dir === 'string',
    )
  if (!valid) {
    throw new CheckRefusal(
      'no-takes',
      `${path} lists no beat with a name and a dir, so it is not a take's take.json.`,
    )
  }
  return beats as { name: string; dir: string }[]
}

async function checkOne(
  takes: string,
  beat: { readonly name: string; readonly dir: string },
  camera: string,
): Promise<CheckedBeat> {
  const dir = join(takes, beat.dir)
  const logPath = join(dir, 'log.json')
  let logSource: string
  try {
    logSource = readFileSync(logPath, 'utf8')
  } catch {
    throw new CheckRefusal(
      'unreadable-log',
      `Beat ${beat.dir} has no log.json at ${logPath}.`,
      beat.dir,
    )
  }
  const log = readTakeLog(logSource)
  if (log.kind === 'refused') {
    throw new CheckRefusal(
      'unreadable-log',
      `${logPath} is not a take's log.json. ${log.detail}`,
      beat.dir,
    )
  }

  const trackPath = join(dir, camera)
  if (!existsSync(trackPath)) {
    throw new CheckRefusal(
      'no-track',
      `Beat ${beat.dir} has no ${camera}, so its zooms cannot be checked and no cursor would draw. Rebuild it with: canon take camera ${logPath} --out ${trackPath}`,
      beat.dir,
    )
  }
  const track = readTrack(trackPath)
  if (!track) {
    throw new CheckRefusal(
      'unreadable-track',
      `${trackPath} is not a camera track, being JSON carrying frames with ms and scale.`,
      beat.dir,
    )
  }

  const breaches = checkBeat(log.log, track)
  if (stallWindows(log.log).length === 0) {
    return { name: beat.name, dir: beat.dir, breaches }
  }
  try {
    await requireFfmpeg()
  } catch {
    throw new CheckRefusal(
      'ffmpeg-missing',
      `Beat ${beat.dir} types or drags on the ${log.log.route} route, so the stall rule reads its clip, and FFmpeg is not on the PATH. Then ${INSTALL_FFMPEG}.`,
      beat.dir,
    )
  }
  let stalls: Breach[]
  try {
    stalls = await findStalls(join(dir, 'clip.mp4'), log.log)
  } catch (error) {
    throw new CheckRefusal(
      'stall-failed',
      `FFmpeg could not read ${join(dir, 'clip.mp4')} for the stall rule. ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
      beat.dir,
    )
  }
  return {
    name: beat.name,
    dir: beat.dir,
    breaches: sortBreaches([...breaches, ...stalls]),
  }
}

function readTrack(path: string): CameraTrack | undefined {
  try {
    const track = JSON.parse(readFileSync(path, 'utf8')) as {
      frames?: unknown
    } | null
    const frames = track?.frames
    if (
      !Array.isArray(frames) ||
      !frames.every(
        (frame) =>
          typeof frame?.ms === 'number' && typeof frame?.scale === 'number',
      )
    ) {
      return undefined
    }
    return track as CameraTrack
  } catch {
    return undefined
  }
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

  const maxSeconds =
    opts.maxSeconds === undefined ? undefined : readRate(opts.maxSeconds)
  if (opts.maxSeconds !== undefined && maxSeconds === undefined) {
    return refuse(
      emitJson,
      url,
      'bad-max-seconds',
      `--max-seconds ${opts.maxSeconds} is not a positive number, such as 12 or 7.5.`,
    )
  }

  const viewport =
    opts.viewport === undefined ? undefined : parseViewport(opts.viewport)
  if (viewport?.kind === 'refused') {
    return refuse(
      emitJson,
      url,
      'bad-viewport',
      `--viewport carries ${viewport.detail}.`,
    )
  }

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
  // Checked before filming, since the reel would refuse only after every beat.
  const mismatch = opts.reel
    ? reelShapeMismatch(
        plan.beats.map((beat) => ({
          name: beat.name,
          viewport: beatViewport(beat, viewport?.viewport),
        })),
      )
    : undefined
  if (mismatch) {
    return refuse(
      emitJson,
      url,
      'reel-shape',
      `${mismatch}. Give every beat one aspect ratio, or film without --reel.`,
    )
  }

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
  const result = await taker.take({
    url,
    plan,
    out: opts.out,
    ...(maxSeconds === undefined ? {} : { maxSeconds }),
    ...(viewport ? { viewport: viewport.viewport } : {}),
  })

  if (result.status === 'failed') {
    logStep('Refused')
    logWarn(TAKE_REFUSALS[result.reason])
    if (result.beat) logWarn(`in beat ${result.beat}`)
    if (result.fallback) {
      logWarn(
        `after a stall in ${result.fallbackPhase ?? 'an unknown phase'} fell back to a screencast, which opened the address again: ${result.fallback}`,
      )
    }
    if (result.scale) {
      logWarn(
        `after a stall in recording retried stepped at device scale ${result.scale}, which opened the address again`,
      )
    }
    if (result.reason === 'server-unreachable') {
      logWarn(`Start whatever serves ${url}, then run this again.`)
    }
    if (result.reason === 'browser-missing') {
      logWarn(`Install the headless shell with: ${INSTALL_BROWSER}`)
    }
    if (result.fix) logWarn(`Allow it for this boot with: ${result.fix}`)
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
      ...(result.fallbackPhase ? { fallbackPhase: result.fallbackPhase } : {}),
      ...(result.scale ? { scale: result.scale } : {}),
      ...(result.still ? { still: result.still } : {}),
      ...(result.reason === 'browser-missing'
        ? { install: INSTALL_BROWSER }
        : {}),
      ...(result.fix ? { fix: result.fix } : {}),
    })
    return 1
  }

  for (const beat of result.beats) {
    logInfo(
      `${beat.dir}  ${beat.route}  ${plural(beat.frames, 'frame')}  ${beat.seconds} s`,
    )
    if (beat.fallback) {
      logWarn(
        `  filmed by screencast after a stall in ${beat.fallbackPhase ?? 'an unknown phase'}: ${beat.fallback}`,
      )
    }
    if (beat.scale) {
      logWarn(
        `  filmed stepped at device scale ${beat.scale} after a stall in recording`,
      )
    }
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
