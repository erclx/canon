/**
 * Places a screencast's frames on the take's monotonic clock. Playwright stamps
 * a frame in wall time, and a time service can step the wall clock mid-take, so
 * a stamp is only ever read against the wall clock of the moment it arrives.
 */

/**
 * A frame's time on the monotonic clock. A step between the frame's swap and its
 * arrival cannot be told apart from latency, so a forward one lands that frame
 * early and a backward one is capped at the arrival, the latest it can be.
 */
export function frameStamp(reading: {
  readonly presentedWall: number
  readonly wallNow: number
  readonly monoNow: number
}): number {
  const { presentedWall, wallNow, monoNow } = reading
  return Math.min(monoNow, presentedWall - (wallNow - monoNow))
}

/**
 * Which frame fills each slot of a clip, as indexes into `stamps`, which holds
 * the frames in arrival order. A slot takes the newest frame stamped at or
 * before it, and slot 0 takes the first frame whenever it was presented. The
 * indexes never fall, so an early stamp cannot reorder the clip. Empty when no
 * frame arrived.
 */
export function slotFrames(
  stamps: readonly number[],
  clip: {
    readonly startMs: number
    readonly lengthMs: number
    readonly frameMs: number
  },
): number[] {
  if (stamps.length === 0) return []
  const slots = Math.round(clip.lengthMs / clip.frameMs)
  const filled: number[] = []
  let at = 0
  for (let slot = 0; slot < slots; slot += 1) {
    const clock = clip.startMs + slot * clip.frameMs
    while ((stamps[at + 1] ?? Infinity) <= clock) at += 1
    filled.push(at)
  }
  return filled
}
