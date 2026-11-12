import { describe, expect, it } from 'vitest'
import { type CameraFrame, cameraTrack, readRate } from '@/take/camera'
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

/** Where a page point sits on the rendered frame, in CSS pixels of the view. */
function screenOf(frame: CameraFrame, point: Point): Point {
  return {
    x: (point.x - frame.x) * frame.scale,
    y: (point.y - frame.y) * frame.scale,
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

  describe('zoom timing', () => {
    // From the page center to (400, 300) is 609 px, a 548 ms glide.
    const TARGET = { x: 400, y: 300 }
    const GLIDE = travelMs(START, TARGET)

    it('should hold the whole page until the glide toward the target sets off', () => {
      const { frames } = cameraTrack(takeOf([{ t: 3000, at: TARGET }]))

      expect(at(frames, 3000 - GLIDE - 50).scale).toBe(1)
    })

    it('should land the push at full depth as the glide arrives', () => {
      const { frames } = cameraTrack(takeOf([{ t: 3000, at: TARGET }]))

      expect(at(frames, 3000 - GLIDE / 2).scale).toBeCloseTo(1.4, 1)
      expect(at(frames, 3000).scale).toBe(1.8)
    })

    it('should hold the target still on screen while the scale changes', () => {
      const { frames } = cameraTrack(takeOf([{ t: 3000, at: TARGET }]))

      const scaling = frames.filter((f) => f.scale > 1 && f.scale < 1.8)
      expect(scaling.length).toBeGreaterThan(10)
      for (const frame of scaling) {
        expect(screenOf(frame, TARGET).x).toBeCloseTo(TARGET.x, 0)
        expect(screenOf(frame, TARGET).y).toBeCloseTo(TARGET.y, 0)
      }
    })

    it('should pull back over the glide that leaves the target', () => {
      const away = { x: 1500, y: 800 }
      const leave: LogEvent = {
        t: 3500,
        kind: 'move',
        from: TARGET,
        to: away,
        ms: 900,
      }
      const { frames } = cameraTrack(takeOf([{ t: 3000, at: TARGET }], [leave]))

      expect(at(frames, 3500).scale).toBe(1.8)
      expect(at(frames, 3950).scale).toBeCloseTo(1.4, 1)
      expect(screenOf(at(frames, 3950), TARGET).x).toBeCloseTo(TARGET.x, 0)
      expect(at(frames, 4400).scale).toBe(1)
    })

    it('should pull back on a fixed ease when no glide leaves the target', () => {
      const { frames } = cameraTrack(takeOf([{ t: 3000, at: TARGET }]))

      expect(at(frames, 3450).scale).toBe(1.8)
      expect(at(frames, 3800).scale).toBeCloseTo(1.4, 1)
      expect(at(frames, 4150).scale).toBe(1)
    })

    it('should land the push by the press of a click with no glide before it', () => {
      const log: TakeLog = {
        ...takeOf([]),
        events: [
          {
            t: 300,
            kind: 'click',
            at: START,
            box: { x: START.x - 12, y: START.y - 12, width: 24, height: 24 },
          },
        ],
      }

      const { frames } = cameraTrack(log)

      expect(at(frames, 0).scale).toBe(1)
      expect(at(frames, 300).scale).toBe(1.8)
    })
  })

  describe('a move with a hold', () => {
    const TO = { x: 500, y: 400 }
    const aimed = (hold?: number): TakeLog => ({
      ...takeOf([]),
      events: [
        {
          t: 1000,
          kind: 'move',
          from: START,
          to: TO,
          ms: 600,
          ...(hold === undefined ? {} : { hold }),
        },
      ],
    })

    it('should zoom onto the end of the glide and hold through the hold', () => {
      const { frames } = cameraTrack(aimed(800))

      expect(at(frames, 1600).scale).toBe(1.8)
      expect(at(frames, 2400).scale).toBe(1.8)
      expect(screenOf(at(frames, 1300), TO).x).toBeCloseTo(TO.x, 0)
    })

    it('should aim nowhere on a move that carries no hold', () => {
      const { frames } = cameraTrack(aimed())

      expect(frames.every((frame) => frame.scale === 1)).toBe(true)
    })
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

  describe('chained clicks', () => {
    const CHAIN = [
      { t: 2000, at: { x: 120, y: 192 } },
      { t: 3500, at: { x: 1800, y: 140 } },
      { t: 4700, at: { x: 600, y: 1000 } },
      { t: 6000, at: { x: 1500, y: 700 } },
    ]

    it('should keep the cursor in frame through every frame at full depth', () => {
      const { frames } = cameraTrack(takeOf(CHAIN))

      const outside = frames.filter(
        (frame) => frame.scale === 1.8 && !inView(frame, frame.cursor),
      )

      expect(frames.some((frame) => frame.scale === 1.8)).toBe(true)
      expect(outside).toEqual([])
    })

    it('should pan between two clicks at full depth', () => {
      const { frames } = cameraTrack(takeOf(CHAIN.slice(0, 2)))

      const glide = frames.filter((f) => f.ms > 2400 && f.ms < 3400)
      expect(glide.every((frame) => frame.scale === 1.8)).toBe(true)
      expect(glide.at(-1)?.x).toBeGreaterThan((glide[0]?.x ?? 0) + 300)
    })

    it('should never pan while the scale changes', () => {
      const { frames } = cameraTrack(takeOf(CHAIN))

      const stops = CHAIN.map((click) => click.at)
      const scaling = frames.filter((f, i) => {
        const before = frames[i - 1]
        return before !== undefined && before.scale !== f.scale
      })
      for (const frame of scaling) {
        const anchored = stops.some(
          (stop) =>
            Math.abs(screenOf(frame, stop).x - stop.x) < 1 &&
            Math.abs(screenOf(frame, stop).y - stop.y) < 1,
        )
        expect(anchored).toBe(true)
      }
    })
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

  describe('depth by resolution', () => {
    it('should cap the zoom at about 1.35x for a 1920-wide clip', () => {
      const log = {
        ...takeOf([{ t: 3000, at: { x: 400, y: 300 } }]),
        clip: { width: 1920, height: 1080 },
      }

      const peak = Math.max(...cameraTrack(log).frames.map((f) => f.scale))

      expect(peak).toBeGreaterThan(1.33)
      expect(peak).toBeLessThanOrEqual(1.35)
    })

    it('should keep the full 1.8x depth for a 3840-wide clip', () => {
      const log = {
        ...takeOf([{ t: 3000, at: { x: 400, y: 300 } }]),
        clip: { width: 3840, height: 2160 },
      }

      const peak = Math.max(...cameraTrack(log).frames.map((f) => f.scale))

      expect(peak).toBeGreaterThan(1.78)
      expect(peak).toBeLessThanOrEqual(1.8)
    })

    it('should read an older log with no clip off its screencast route', () => {
      const log: TakeLog = {
        ...takeOf([{ t: 3000, at: { x: 400, y: 300 } }]),
        route: 'screencast',
      }

      const peak = Math.max(...cameraTrack(log).frames.map((f) => f.scale))

      expect(peak).toBeLessThanOrEqual(1.35)
    })
  })

  describe('push off', () => {
    it('should hold the whole page and still carry the cursor and ring', () => {
      const log: TakeLog = {
        ...takeOf([{ t: 2000, at: { x: 400, y: 300 } }]),
        push: false,
      }

      const { frames } = cameraTrack(log)

      expect(new Set(frames.map((f) => `${f.scale} ${f.x} ${f.y}`))).toEqual(
        new Set(['1 0 0']),
      )
      expect(at(frames, 2000).cursor).toEqual({ x: 400, y: 300 })
      expect(at(frames, 2000).ring).toBe(0)
    })
  })

  describe('playback rate', () => {
    const log = takeOf([{ t: 4000, at: { x: 400, y: 300 } }])

    it('should build the track on the clock of a clip played twice as fast', () => {
      const { frames } = cameraTrack(log, { rate: 2 })

      expect(frames).toHaveLength(360)
      expect(at(frames, 1950).ring).toBeNull()
      expect(at(frames, 2000).ring).toBe(0)
      expect(at(frames, 2000).cursor).toEqual({ x: 400, y: 300 })
    })

    it('should read the sent points of a move on the faster clock', () => {
      const glide: TakeLog = {
        ...takeOf([]),
        events: [
          {
            t: 1000,
            kind: 'move',
            from: START,
            to: { x: 400, y: 300 },
            ms: 400,
            points: [
              { t: 1000, x: 900, y: 500 },
              { t: 1400, x: 400, y: 300 },
            ],
          },
        ],
      }

      const { frames } = cameraTrack(glide, { rate: 2 })

      expect(at(frames, 700).cursor).toEqual({ x: 400, y: 300 })
    })

    it('should build the same track at rate 1 as with no rate', () => {
      expect(cameraTrack(log, { rate: 1 })).toEqual(cameraTrack(log))
    })
  })
})

/**
 * Builds a log the way a take writes a drag: a glide to the source, a press,
 * a held glide to the target, and the release `ms` after the press.
 */
function dragOf(press: number, from: Point, to: Point, travel = 900): TakeLog {
  const glide = travelMs(START, from)
  const box = { x: from.x - 20, y: from.y - 10, width: 40, height: 20 }
  const drop = { x: to.x - 40, y: to.y - 30, width: 80, height: 60 }
  return {
    ...takeOf([]),
    events: [
      { t: press - glide, kind: 'move', from: START, to: from, ms: glide },
      { t: press + 150, kind: 'move', from, to, ms: travel },
      {
        t: press,
        kind: 'drag',
        from,
        to,
        box,
        drop,
        ms: 150 + travel,
      },
    ],
  }
}

describe('cameraTrack input steps', () => {
  const FROM = { x: 400, y: 300 }
  const TO = { x: 560, y: 380 }

  it('should grow the ring to a partial value and hold it until release', () => {
    const { frames } = cameraTrack(dragOf(2000, FROM, TO))

    expect(at(frames, 2000).ring).toBe(0)
    expect(at(frames, 2500).ring).toBe(0.3)
    expect(at(frames, 3000).ring).toBe(0.3)
  })

  it('should run the ring from the held value to 1 after release', () => {
    const { frames } = cameraTrack(dragOf(2000, FROM, TO))

    expect(at(frames, 3050 + 157.5).ring).toBeCloseTo(0.65, 1)
    expect(at(frames, 3050 + 400).ring).toBeNull()
  })

  it('should never let a drag ring fall back or leave 0 to 1', () => {
    const { frames } = cameraTrack(dragOf(2000, FROM, TO))

    const rings = frames
      .map((frame) => frame.ring)
      .filter((ring): ring is number => ring !== null)
    expect(rings.every((ring, i) => ring >= (rings[i - 1] ?? 0))).toBe(true)
    expect(Math.min(...rings)).toBe(0)
    expect(Math.max(...rings)).toBeLessThanOrEqual(1)
  })

  it('should hold the zoom on both ends of a drag until release', () => {
    const { frames } = cameraTrack(dragOf(2000, FROM, TO))

    const nearRelease = at(frames, 3000)
    expect(nearRelease.scale).toBeGreaterThan(1.3)
    expect(inView(nearRelease, FROM)).toBe(true)
    expect(inView(nearRelease, TO)).toBe(true)
  })

  it('should keep both ends of a drag near the edge in view through the release', () => {
    const from = { x: 1560, y: 540 }
    const to = { x: 1860, y: 540 }
    const { frames } = cameraTrack(dragOf(2000, from, to))

    const held = frames.filter((f) => f.ms >= 2000 && f.ms <= 3050)
    expect(held.every((frame) => frame.scale > 1.3)).toBe(true)
    expect(held.filter((frame) => !inView(frame, to))).toEqual([])
    expect(held.filter((frame) => !inView(frame, from))).toEqual([])
  })

  it('should keep the drop in view when a drag chains onto a click', () => {
    const click = { x: 960, y: 540 }
    const from = { x: 760, y: 540 }
    const to = { x: 1560, y: 540 }
    const log = takeOf([{ t: 1500, at: click }])
    const reach: LogEvent = {
      t: 2000,
      kind: 'move',
      from: click,
      to: from,
      ms: 300,
    }
    const drag = dragOf(2300, from, to)
    const chained: TakeLog = {
      ...log,
      events: [...log.events, reach, ...drag.events.slice(1)].sort(
        (a, b) => a.t - b.t,
      ),
    }

    const { frames } = cameraTrack(chained)

    const held = frames.filter((f) => f.ms >= 2300 && f.ms <= 3350)
    expect(held.every((frame) => frame.scale > 1)).toBe(true)
    expect(held.filter((frame) => !inView(frame, to))).toEqual([])
  })

  it('should build a double click into the track of one click', () => {
    const single = takeOf([{ t: 2000, at: FROM }])
    const double: TakeLog = {
      ...single,
      events: single.events.map((event) =>
        event.kind === 'click' ? { ...event, count: 2 } : event,
      ),
    }

    expect(cameraTrack(double)).toEqual(cameraTrack(single))
  })

  it('should leave the track as it was for a key pressed mid-zoom', () => {
    const plain = takeOf([{ t: 2000, at: FROM }])
    const keyed: TakeLog = {
      ...plain,
      events: [
        ...plain.events,
        { t: 2100, kind: 'key', keys: 'Control+K', ms: 66.67 },
      ],
    }

    expect(cameraTrack(keyed)).toEqual(cameraTrack(plain))
  })

  it('should neither zoom nor ring on a key alone', () => {
    const log: TakeLog = {
      ...takeOf([]),
      events: [{ t: 2000, kind: 'key', keys: 'Escape', ms: 33.33 }],
    }

    const { frames } = cameraTrack(log)

    expect(frames.every((frame) => frame.scale === 1)).toBe(true)
    expect(frames.every((frame) => frame.ring === null)).toBe(true)
  })
})

describe('cameraTrack focus', () => {
  const FIELD = { x: 400, y: 300, width: 160, height: 32 }
  const FOCUS = { focus: true } as const

  function keyed(
    focus: { x: number; y: number; width: number; height: number } | undefined,
  ): TakeLog {
    return {
      ...takeOf([]),
      events: [
        {
          t: 2000,
          kind: 'key',
          keys: 'Tab',
          ms: 33.33,
          ...(focus ? { focus } : {}),
        },
      ],
    }
  }

  it('should zoom onto the box a key moved focus to', () => {
    const { frames } = cameraTrack(keyed(FIELD), FOCUS)

    const held = at(frames, 2100)
    expect(held.scale).toBe(1.8)
    expect(screenOf(held, { x: 480, y: 316 }).x).toBeGreaterThan(0)
    expect(viewCenter(held).x).toBeGreaterThan(FIELD.x)
    expect(viewCenter(held).x).toBeLessThan(FIELD.x + VIEWPORT.width / 1.8)
  })

  it('should pull back after the hold on the focused box', () => {
    const { frames } = cameraTrack(keyed(FIELD), FOCUS)

    expect(at(frames, 4000).scale).toBe(1)
  })

  it('should draw no ring for a key that moved focus', () => {
    const { frames } = cameraTrack(keyed(FIELD), FOCUS)

    expect(frames.every((frame) => frame.ring === null)).toBe(true)
  })

  it('should hold the whole page for a focus move on a beat with push off', () => {
    const log: TakeLog = { ...keyed(FIELD), push: false }

    const { frames } = cameraTrack(log, FOCUS)

    expect(frames.every((frame) => frame.scale === 1)).toBe(true)
  })

  it('should not zoom onto a focused box that fills the page', () => {
    const { frames } = cameraTrack(
      keyed({ x: 0, y: 0, width: 1900, height: 1000 }),
      FOCUS,
    )

    expect(frames.every((frame) => frame.scale === 1)).toBe(true)
  })

  it('should aim nowhere on a focus move unless asked to', () => {
    const { frames } = cameraTrack(keyed(FIELD))

    expect(frames.every((frame) => frame.scale === 1)).toBe(true)
  })

  it('should hold the whole page until shortly before the press after an earlier glide', () => {
    const glided: TakeLog = {
      ...keyed(FIELD),
      events: [
        {
          t: 500,
          kind: 'move',
          from: START,
          to: { x: 1500, y: 100 },
          ms: 600,
        },
        ...keyed(FIELD).events,
      ],
    }

    const { frames } = cameraTrack(glided, FOCUS)

    expect(at(frames, 1200).scale).toBe(1)
    expect(at(frames, 1300).scale).toBe(1)
    expect(at(frames, 2100).scale).toBe(1.8)
  })
})

describe('cameraTrack depth', () => {
  const SCREENCAST = {
    ...takeOf([{ t: 3000, at: { x: 400, y: 300 } }]),
    clip: { width: 1920, height: 1080 },
  }

  it('should reach the depth asked for when the output is half the clip wide', () => {
    const track = cameraTrack(SCREENCAST, { depth: 2, outputWidth: 960 })

    const peak = Math.max(...track.frames.map((f) => f.scale))

    expect(peak).toBe(2)
  })

  it('should cap the depth asked for at the sharpness of a full-width output', () => {
    const track = cameraTrack(SCREENCAST, { depth: 2 })

    const peak = Math.max(...track.frames.map((f) => f.scale))

    expect(peak).toBeLessThanOrEqual(1.35)
  })

  it('should cap the depth asked for at the fill of a large target', () => {
    const log = {
      ...takeOf([{ t: 3000, at: { x: 400, y: 300 }, size: { x: 960, y: 40 } }]),
      clip: { width: 1920, height: 1080 },
    }

    const track = cameraTrack(log, { depth: 2, outputWidth: 960 })
    const peak = Math.max(...track.frames.map((f) => f.scale))

    expect(peak).toBe(1.6)
  })

  it('should build the same track with no options as at the default depth', () => {
    const log = takeOf([{ t: 3000, at: { x: 400, y: 300 } }])

    expect(cameraTrack(log, { depth: 1.8, outputWidth: 1920 })).toEqual(
      cameraTrack(log),
    )
  })
})

describe('readRate', () => {
  it('should read a positive number', () => {
    expect(readRate('1.5')).toBe(1.5)
  })

  it.each(['0', '-2', 'fast', 'Infinity', ''])(
    'should refuse %j as a rate',
    (value) => {
      expect(readRate(value)).toBeUndefined()
    },
  )
})
