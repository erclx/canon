import { describe, expect, it } from 'vitest'
import { type CameraFrame, cameraTrack } from '@/take/camera'
import {
  FPS,
  LOG_VERSION,
  type LogEvent,
  type Point,
  START,
  type TakeLog,
  VIEWPORT,
  travelMs,
} from '@/take/log'

/**
 * Pins the camera against the properties the groundwork judged preset O4 on,
 * over logs shaped like the board takes it scored: a zoom that settles as fast
 * as Screen Studio's, a focus that holds across nearby clicks, and a cursor
 * that never leaves the frame.
 */

const FRAME_MS = 1000 / FPS

/** Builds a log the way a take writes one, a move ending as each click lands. */
function takeOf(
  clicks: readonly { t: number; at: Point; size?: Point }[],
  extra: readonly LogEvent[] = [],
  seconds = 12,
): TakeLog {
  const events: LogEvent[] = []
  let from = START
  for (const click of clicks) {
    const size = click.size ?? { x: 24, y: 24 }
    const ms = travelMs(from, click.at)
    events.push({ t: click.t - ms, kind: 'move', from, to: click.at, ms })
    events.push({
      t: click.t,
      kind: 'click',
      at: click.at,
      box: {
        x: click.at.x - size.x / 2,
        y: click.at.y - size.y / 2,
        width: size.x,
        height: size.y,
      },
    })
    from = click.at
  }
  events.push(...extra)
  events.sort((a, b) => a.t - b.t)
  return {
    version: LOG_VERSION,
    viewport: VIEWPORT,
    fps: FPS,
    route: 'step',
    frames: Math.round((seconds * 1000) / FRAME_MS),
    events,
  }
}

function at(frames: readonly CameraFrame[], ms: number): CameraFrame {
  const frame = frames[Math.round(ms / FRAME_MS)]
  if (!frame) throw new Error(`no frame at ${ms} ms`)
  return frame
}

function viewCenter(frame: CameraFrame): Point {
  return {
    x: frame.x + VIEWPORT.width / (2 * frame.scale),
    y: frame.y + VIEWPORT.height / (2 * frame.scale),
  }
}

function inView(frame: CameraFrame, point: Point): boolean {
  return (
    point.x >= frame.x &&
    point.x <= frame.x + VIEWPORT.width / frame.scale &&
    point.y >= frame.y &&
    point.y <= frame.y + VIEWPORT.height / frame.scale
  )
}

describe('cameraTrack', () => {
  it('should carry one camera for every frame of the clip', () => {
    const log = takeOf([{ t: 2000, at: { x: 400, y: 300 } }], [], 5)

    const track = cameraTrack(log)

    expect(track.frames).toHaveLength(300)
    expect(track.frames[299]?.ms).toBeCloseTo(299 * FRAME_MS, 1)
  })

  it('should reach 90% of a zoom from rest in about 633 ms', () => {
    const { frames } = cameraTrack(
      takeOf([{ t: 3000, at: { x: 400, y: 300 } }]),
    )

    const rise = frames.findIndex((frame) => frame.scale > 1.005)
    const settled = frames.findIndex((frame) => frame.scale >= 1 + 0.9 * 0.8)
    const ms = (settled - rise) * FRAME_MS

    expect(ms).toBeGreaterThan(560)
    expect(ms).toBeLessThan(700)
    expect(at(frames, 3000).scale).toBeGreaterThan(1.78)
  })

  it('should hold the view still across nearby clicks down a panel', () => {
    const rows = [300, 326, 352, 378].map((y, i) => ({
      t: 3000 + i * 450,
      at: { x: 120, y },
    }))
    const { frames } = cameraTrack(takeOf(rows))

    // From the moment the zoom lands to the last click, three of them later.
    const landed = viewCenter(at(frames, 3600))
    const last = viewCenter(at(frames, 3000 + 3 * 450))

    expect(Math.hypot(last.x - landed.x, last.y - landed.y)).toBeLessThan(2)
  })

  it('should pan to a click outside the held view', () => {
    const far = { x: 1700, y: 900 }
    const { frames } = cameraTrack(
      takeOf([
        { t: 3000, at: { x: 200, y: 200 } },
        { t: 4200, at: far },
      ]),
    )

    const landing = at(frames, 4200)

    expect(landing.scale).toBeGreaterThan(1.7)
    expect(inView(landing, far)).toBe(true)
  })

  it('should keep the cursor in frame through every zoomed frame', () => {
    const { frames } = cameraTrack(
      takeOf([
        { t: 2000, at: { x: 120, y: 192 } },
        { t: 3500, at: { x: 1800, y: 140 } },
        { t: 4700, at: { x: 600, y: 1000 } },
        { t: 6000, at: { x: 1500, y: 700 } },
      ]),
    )

    const outside = frames.filter(
      (frame) => frame.scale > 1.05 && !inView(frame, frame.cursor),
    )

    expect(outside).toEqual([])
  })

  it('should not zoom on a click whose target fills the page', () => {
    const { frames } = cameraTrack(
      takeOf([{ t: 2000, at: { x: 960, y: 540 }, size: { x: 1920, y: 1080 } }]),
    )

    expect(Math.max(...frames.map((frame) => frame.scale))).toBe(1)
  })

  it('should zoom less on a target too large for the full depth', () => {
    const { frames } = cameraTrack(
      takeOf([{ t: 2000, at: { x: 960, y: 540 }, size: { x: 1200, y: 400 } }]),
    )

    const peak = Math.max(...frames.map((frame) => frame.scale))

    expect(peak).toBeGreaterThan(1.2)
    expect(peak).toBeLessThan(1.3)
  })

  it('should end a zoom when the page scrolls under it', () => {
    const scroll: LogEvent = {
      t: 2200,
      kind: 'scroll',
      at: { x: 400, y: 300 },
      dx: 0,
      dy: 600,
      ms: 900,
    }
    const { frames } = cameraTrack(
      takeOf([{ t: 2000, at: { x: 400, y: 300 } }], [scroll]),
    )

    expect(at(frames, 2000).scale).toBeGreaterThan(1.5)
    expect(at(frames, 3400).scale).toBeLessThan(1.05)
  })

  it('should draw a ring that expands from each click', () => {
    const { frames } = cameraTrack(
      takeOf([{ t: 2000, at: { x: 400, y: 300 } }]),
    )

    expect(at(frames, 1950).ring).toBeNull()
    expect(at(frames, 2000).ring).toBe(0)
    expect(at(frames, 2225).ring).toBeCloseTo(0.5, 1)
    expect(at(frames, 2500).ring).toBeNull()
  })

  it('should draw a ring for a click whose target is too large to zoom', () => {
    const { frames } = cameraTrack(
      takeOf([{ t: 2000, at: { x: 960, y: 540 }, size: { x: 1200, y: 900 } }]),
    )

    expect(at(frames, 2000).ring).toBe(0)
    expect(at(frames, 2225).ring).toBeCloseTo(0.5, 1)
  })
})
