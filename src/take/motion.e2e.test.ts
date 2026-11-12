import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CameraTrack } from '@/take/camera'
import { take } from '@/take/film'
import {
  MOTION_PLAN,
  type MotionReport,
  type MotionServer,
  serveMotion,
} from '@/take/fixtures/motion-server'
import { FPS, type TakeLog, cursorAt } from '@/take/log'
import { type Beat, readTakePlan } from '@/take/plan'
import { findShell } from '@/take/shell'

/**
 * Films each beat of `fixtures/motion.json` by frame stepping and holds the
 * take to the motion the operator settled by eye: the drawn cursor on the card
 * it drags, a rest before each press, a pause before the first key, and a zoom
 * that keeps its target still. The page reports on its own clock, so each
 * check reads what the page saw rather than what the take meant to send.
 *
 * Needs chrome-headless-shell and FFmpeg and skips without either. The E2E
 * Suites job in verify.yml installs both.
 */

const FRAME_MS = 1000 / FPS

/** A loaded suite can take past 2 s on a 4K frame of a page that steps fine. */
const LOADED_STALL_MS = 8000

function available(): boolean {
  try {
    findShell()
  } catch {
    return false
  }
  return spawnSync('ffmpeg', ['-version']).status === 0
}

interface Filmed {
  readonly reports: readonly MotionReport[]
  readonly log: TakeLog
  readonly camera: CameraTrack
}

/**
 * The clip time of the frame a page report paints in. The page counts its own
 * animation frames, one per clip frame on the stepper, and the press anchors
 * that count, since the log names the clip frame the press was sent ahead of.
 */
function clipTime(filmed: Filmed, report: MotionReport): number {
  const press = filmed.reports.find((r) => r.type === 'pointerdown')
  const logged = filmed.log.events.find(
    (event) => event.kind === 'drag' || event.kind === 'click',
  )
  if (!press || !logged) throw new Error('the beat logged no press')
  return (report.frame - press.frame) * FRAME_MS + logged.t
}

/** Milliseconds of clip time between the frames two reports paint in. */
function between(from: MotionReport | undefined, to: MotionReport | undefined) {
  if (!from || !to) return Number.NaN
  return (to.frame - from.frame) * FRAME_MS
}

describe.skipIf(!available())('the settled motion on the fixture', () => {
  const filmed = new Map<string, Filmed>()
  let server: MotionServer
  let out: string
  let sink: MotionReport[] = []

  async function film(beat: Beat): Promise<Filmed> {
    sink = []
    const dir = join(out, String(filmed.size))
    const result = await take({
      url: server.url,
      plan: { beats: [beat] },
      out: dir,
      stallMs: LOADED_STALL_MS,
    })
    if (result.status !== 'filmed') throw new Error(result.message)
    const [record] = result.beats
    if (!record) throw new Error(`${beat.name} filmed no beat`)
    if (record.fallback) throw new Error(`${beat.name} fell back to screencast`)
    const read = (file: string) => readFileSync(join(dir, file), 'utf8')
    return {
      reports: [...sink].sort((a, b) => a.seq - b.seq),
      log: JSON.parse(read(record.log)) as TakeLog,
      camera: JSON.parse(read(record.camera)) as CameraTrack,
    }
  }

  function beat(name: string): Filmed {
    const found = filmed.get(name)
    if (!found) throw new Error(`no take of ${name}`)
    return found
  }

  beforeAll(async () => {
    server = serveMotion((report) => sink.push(report))
    out = mkdtempSync(join(tmpdir(), 'canon-take-motion-e2e-'))
    const read = readTakePlan(readFileSync(MOTION_PLAN, 'utf8'))
    if (read.kind !== 'read') throw new Error(read.detail)
    for (const each of read.plan.beats) filmed.set(each.name, await film(each))
  }, 480_000)

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  describe.each([
    ['drag the changelog card', 'box'],
    ['drag the tag card', 'rafbox'],
  ])('%s', (name, id) => {
    it('should keep the card within 2 CSS px of the drawn cursor', () => {
      const take = beat(name)
      const places = take.reports.filter(
        (r) => r.type === 'place' && r.id === id,
      )

      const offsets = places.map((place) => {
        const cursor = cursorAt(take.log.events, clipTime(take, place))
        return Math.hypot(
          Number(place.x) - cursor.x,
          Number(place.y) - cursor.y,
        )
      })

      expect(places.length).toBeGreaterThan(20)
      expect(Math.max(...offsets)).toBeLessThanOrEqual(2)
    })
  })

  describe('publish the release', () => {
    it('should press the button 300 ms after the cursor arrives', () => {
      const { reports } = beat('publish the release')
      const press = reports.findIndex((r) => r.type === 'pointerdown')
      const arrival = reports
        .slice(0, press)
        .findLast((r) => r.type === 'pointermove')

      const rest = between(arrival, reports[press])

      expect(rest).toBeGreaterThanOrEqual(300)
      expect(rest).toBeLessThanOrEqual(300 + FRAME_MS + 1)
    })

    it('should hold the button still on screen while the zoom scales', () => {
      const { log, camera } = beat('publish the release')
      const click = log.events.find((event) => event.kind === 'click')
      if (click?.kind !== 'click') throw new Error('no click logged')

      const scaling = camera.frames.filter(
        (frame) => frame.scale > 1.01 && frame.scale < 1.79,
      )
      const drift = scaling.map((frame) =>
        Math.hypot(
          (click.at.x - frame.x) * frame.scale - click.at.x,
          (click.at.y - frame.y) * frame.scale - click.at.y,
        ),
      )

      expect(scaling.length).toBeGreaterThan(10)
      expect(Math.max(...drift)).toBeLessThan(1)
    })

    it('should land the zoom by the time the cursor arrives', () => {
      const { log, camera } = beat('publish the release')
      const glide = log.events.find((event) => event.kind === 'move')
      if (glide?.kind !== 'move') throw new Error('no glide logged')

      const arrived = camera.frames[Math.ceil((glide.t + glide.ms) / FRAME_MS)]

      expect(arrived?.scale).toBe(1.8)
    })
  })

  describe('write the release note', () => {
    it('should type the first key 400 ms after the field click', () => {
      const { reports } = beat('write the release note')
      const release = reports.find((r) => r.type === 'pointerup')
      const typed = reports.find((r) => r.type === 'input')

      const pause = between(release, typed)

      expect(pause).toBeGreaterThanOrEqual(400)
      expect(pause).toBeLessThanOrEqual(400 + FRAME_MS + 1)
    })
  })
})
