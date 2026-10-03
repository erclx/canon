import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import type { DemoStep } from '@/demo/compile'

/**
 * A step's target in viewport pixels, which are the video frame's own
 * coordinates because the recording is sized to the viewport.
 */
export interface TargetBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** One step as the run clocked it, in wall-clock milliseconds. */
export interface StepTiming {
  readonly index: number
  readonly kind: DemoStep['kind']
  readonly startedAt: number
  readonly endedAt: number
  readonly box?: TargetBox
}

/**
 * Times count from the recording's start rather than the first step, since
 * that is the clock a composition places the take on. A step ends once its
 * hold has played, so the span covers what the viewer sees of it.
 */
export interface TimelineEntry {
  readonly index: number
  readonly kind: DemoStep['kind']
  readonly startMs: number
  readonly endMs: number
  readonly box?: TargetBox
}

export function timelineEntry(
  timing: StepTiming,
  recordingStart: number,
): TimelineEntry {
  return {
    index: timing.index,
    kind: timing.kind,
    startMs: Math.round(timing.startedAt - recordingStart),
    endMs: Math.round(timing.endedAt - recordingStart),
    ...(timing.box ? { box: timing.box } : {}),
  }
}

export function timelinePath(videoPath: string): string {
  return join(
    dirname(videoPath),
    `${basename(videoPath, extname(videoPath))}.timeline.json`,
  )
}

export function writeTimeline(
  path: string,
  entries: readonly TimelineEntry[],
): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ entries }, null, 2)}\n`)
}
