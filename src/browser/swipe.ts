/**
 * The touch drag behind `canon browser swipe <x> <y> <dy>`, sent as a browser
 * protocol `Input.dispatchTouchEvent` sequence through the pinned CLI's
 * `run-code`. Groundwork 223 measured it as the one route that fires real touch
 * events and moves the page: a mouse wheel moves it with no touch event, and a
 * script-made `TouchEvent` reaches listeners but scrolls nothing.
 *
 * Measured only in a session opened with `open --mobile`, which gives the
 * engine context `hasTouch`.
 */

/** Pixels per move, the pace between moves, and the wait for the fling to stop. */
const STEP_PX = 20
const MOVE_MS = 16
const SETTLE_MS = 600

export type SwipePlan =
  | { readonly kind: 'planned'; readonly code: string }
  | { readonly kind: 'refused'; readonly message: string }

const USAGE = 'swipe takes <x> <y> <dy>, as in swipe 195 700 580'

/**
 * The finger's positions after the start, moving from `y` toward `y - dy` in
 * steps of 20 px, with the last landing exactly on `y - dy`. A positive `dy`
 * moves the finger up, which scrolls the page down, as `mousewheel 0 <dy>` does.
 */
export function touchPath(y: number, dy: number): number[] {
  const end = y - dy
  const direction = Math.sign(dy)
  const moves: number[] = []
  for (
    let travelled = STEP_PX;
    travelled < Math.abs(dy);
    travelled += STEP_PX
  ) {
    moves.push(y - direction * travelled)
  }
  moves.push(end)
  return moves
}

/** Reads the words after `swipe` into the `run-code` function the child runs. */
export function planSwipe(words: readonly string[]): SwipePlan {
  if (words.length !== 3) {
    return {
      kind: 'refused',
      message: `${USAGE}, and got ${words.length} words`,
    }
  }

  // Number('') is 0, so a blank word would otherwise read as a coordinate.
  const bad = words.find(
    (word) => word.trim() === '' || !Number.isFinite(Number(word)),
  )
  if (bad !== undefined) {
    return { kind: 'refused', message: `${USAGE}. '${bad}' is not a number` }
  }

  const [x, y, dy] = words.map(Number) as [number, number, number]
  if (x < 0 || y < 0) {
    return {
      kind: 'refused',
      message: `${USAGE}. The start point ${x},${y} lies off the page`,
    }
  }
  if (dy === 0) {
    return { kind: 'refused', message: `${USAGE}. A dy of 0 moves nothing` }
  }

  return { kind: 'planned', code: dragFunction(x, y, touchPath(y, dy)) }
}

/**
 * The `run-code` function, returning the scroll read after the settle wait so
 * the value is where the fling stops rather than where the finger lifted.
 */
function dragFunction(x: number, y: number, moves: readonly number[]): string {
  return [
    'async (page) => {',
    '  const session = await page.context().newCDPSession(page)',
    `  const at = (y) => [{ x: ${x}, y }]`,
    `  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(${y}) })`,
    `  for (const y of ${JSON.stringify(moves)}) {`,
    `    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(y) })`,
    `    await page.waitForTimeout(${MOVE_MS})`,
    '  }',
    `  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })`,
    `  await page.waitForTimeout(${SETTLE_MS})`,
    '  await session.detach()',
    '  return await page.evaluate(() => ({ x: scrollX, y: scrollY }))',
    '}',
  ].join('\n')
}
