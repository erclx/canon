import { spawn } from 'node:child_process'
import { type Breach, LIMITS } from '@/take/check'
import { finished } from '@/take/encode'
import type { TakeLog } from '@/take/log'

/**
 * Finds a clip holding still while its beat types or drags, the one timing
 * fault no log shows, since a screencast or a harness records whatever the
 * page painted rather than what the take sent.
 */

/**
 * FFmpeg's default of -60 dB read a whole 4K typing burst as frozen, and
 * -90 dB still read gaps between keys as holds. A flat page's encoder noise
 * on a held frame measured under -100 dB, so this sits between the two.
 */
const NOISE = '-100dB'

export interface Window {
  readonly start: number
  readonly end: number
}

/**
 * The stretches of clip time the page should be moving, being each typing
 * burst and each drag. None on a stepped beat, whose virtual clock cannot
 * stall and whose held frames are on purpose. The time between two events is
 * left out, since the drawn cursor glides there over a page that holds.
 */
export function stallWindows(log: TakeLog): Window[] {
  if (log.route === 'step') return []
  return log.events
    .filter((event) => event.kind === 'type' || event.kind === 'drag')
    .map((event) => ({ start: event.t, end: event.t + event.ms }))
    .filter((window) => window.end - window.start > LIMITS.stall)
}

/**
 * Reads `freezedetect`'s metadata lines as held spans in ms from the window's
 * start. A hold still running when the window ends prints only its start, so
 * it runs to `windowMs`.
 */
export function parseFreezes(output: string, windowMs: number): Window[] {
  const spans: Window[] = []
  let start: number | undefined
  for (const line of output.split('\n')) {
    const match = /^lavfi\.freezedetect\.freeze_(start|end)=([\d.]+)/.exec(
      line.trim(),
    )
    if (!match) continue
    const ms = Number(match[2]) * 1000
    if (match[1] === 'start') {
      start = ms
    } else if (start !== undefined) {
      spans.push({ start, end: ms })
      start = undefined
    }
  }
  if (start !== undefined) spans.push({ start, end: windowMs })
  return spans
}

/** Each hold past the limit inside the beat's windows, in clip-time order. */
export async function findStalls(
  clip: string,
  log: TakeLog,
): Promise<Breach[]> {
  const breaches: Breach[] = []
  for (const window of stallWindows(log)) {
    const windowMs = window.end - window.start
    const output = await freezedetect(clip, window.start, windowMs)
    for (const span of parseFreezes(output, windowMs)) {
      const held = span.end - span.start
      if (held <= LIMITS.stall) continue
      breaches.push({
        rule: 'stall',
        t: Math.round(window.start + span.start),
        measured: Math.round(held),
        limit: LIMITS.stall,
      })
    }
  }
  return breaches
}

async function freezedetect(
  clip: string,
  startMs: number,
  windowMs: number,
): Promise<string> {
  const proc = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-ss',
      String(startMs / 1000),
      '-t',
      String(windowMs / 1000),
      '-i',
      clip,
      '-vf',
      `freezedetect=n=${NOISE}:d=${LIMITS.stall / 1000},metadata=mode=print:file=-`,
      '-an',
      '-f',
      'null',
      '-',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stdout = ''
  proc.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })
  await finished(proc)
  return stdout
}
