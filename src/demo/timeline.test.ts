import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { StepTiming } from '@/demo/timeline'
import { timelineEntry, timelinePath, writeTimeline } from '@/demo/timeline'

function timing(overrides: Partial<StepTiming> = {}): StepTiming {
  return {
    index: 0,
    kind: 'click',
    startedAt: 1_000_250.4,
    endedAt: 1_001_480.6,
    ...overrides,
  }
}

describe('timelineEntry', () => {
  it('should measure times in whole milliseconds from the recording start', () => {
    const entry = timelineEntry(timing(), 1_000_000)

    expect(entry).toEqual({
      index: 0,
      kind: 'click',
      startMs: 250,
      endMs: 1481,
    })
  })

  it('should carry the target box when the step pointed at one', () => {
    const box = { x: 10, y: 20, width: 120, height: 40 }

    const entry = timelineEntry(timing({ box }), 1_000_000)

    expect(entry.box).toEqual(box)
  })

  it('should leave the box out for a step with no pointer target', () => {
    const entry = timelineEntry(timing({ kind: 'scroll' }), 1_000_000)

    expect(entry).not.toHaveProperty('box')
  })
})

describe('timelinePath', () => {
  it('should name the file after the video beside it', () => {
    const path = timelinePath('/out/board/take/board.webm')

    expect(path).toBe('/out/board/take/board.timeline.json')
  })
})

describe('writeTimeline', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
    root = undefined
  })

  it('should write the entries as the file a composition reads', () => {
    root = mkdtempSync(join(tmpdir(), 'canon-timeline-'))
    const path = join(root, 'take', 'board.timeline.json')
    const entries = [timelineEntry(timing(), 1_000_000)]

    writeTimeline(path, entries)

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ entries })
  })
})
