import { playOnEntry, reducedMotion } from '../../../lib/scene'
import type { BoardMove, BoardRow } from './state'
import { boardAfter, travels } from './state'

interface Data {
  rows: BoardRow[]
  moves: BoardMove[]
  starts: string
  stamps: string[]
  waiting: string
}

/**
 * Replays the night on the second board once that board is in view: the board
 * as you left it, then one move a beat with the clock reading its time, until
 * it rests where the page rendered it. A move into another lane opens a dashed
 * slot where the row lands, carries the row there, and pulses it, and a move in
 * place pulses the row alone. Replay starts the night again, under reduced
 * motion too, where each move lands with no travel.
 */
const section = document.getElementById('board')
const source = document.getElementById('board-data')
const after = section?.querySelector<HTMLElement>('.side.after')
const board = after?.querySelector<HTMLElement>('.bd')
const stamp = after?.querySelector<HTMLElement>('.stamp')
const bar = after?.querySelector<HTMLElement>('.pg')
const replay = after?.querySelector<HTMLButtonElement>('.replay')
const lanes = [...(after?.querySelectorAll<HTMLElement>('.cards') ?? [])]
const columns = [...(section?.querySelectorAll<HTMLElement>('.ln') ?? [])]

/** One move a beat: the slot, then the travel, then the pulse, then a rest. */
const BEAT = 1200
const SLOT = 250
const TRAVEL = 400
const FIRST = 600

if (section && source && after && board && stamp && bar && replay) {
  const data = JSON.parse(source.textContent ?? '{}') as Data
  const reduced = reducedMotion()
  const timers: number[] = []
  let shown = data.moves.length
  let ran = false

  const card = (row: BoardRow) => {
    const li = document.createElement('li')
    li.className = row.waiting ? 'cd wt' : 'cd'
    li.dataset.name = row.name
    const name = document.createElement('b')
    name.textContent = row.name
    const line = document.createElement('span')
    if (row.waiting) {
      const glyph = document.createElement('i')
      glyph.className = 'gl'
      glyph.setAttribute('role', 'img')
      glyph.setAttribute('aria-label', data.waiting)
      glyph.textContent = '◆'
      line.append(glyph)
    }
    line.append(row.line)
    li.append(name, line)
    return li
  }

  const draw = (count: number) => {
    shown = count
    const rows = boardAfter(data.rows, data.moves, count)
    lanes.forEach((lane, index) =>
      lane.replaceChildren(
        ...rows.filter((row) => row.lane === index).map(card),
      ),
    )
  }

  /**
   * Holds every lane, on both boards, at the tallest it stands at any point in
   * the night, and the clock line at its longest, so the section keeps one
   * height while rows come and go. Heights are read to the subpixel, since a
   * rounded one still lets the page move by a fraction.
   */
  const lock = () => {
    const current = shown
    const said = stamp.textContent
    columns.forEach((column) => (column.style.minHeight = ''))
    stamp.style.minHeight = ''
    const tallest = lanes.map(() => 0)
    for (let count = 0; count <= data.moves.length; count += 1) {
      draw(count)
      lanes.forEach((lane, index) => {
        const height = lane.parentElement?.getBoundingClientRect().height ?? 0
        tallest[index] = Math.max(tallest[index] ?? 0, height)
      })
    }
    let line = 0
    for (const text of [said, data.starts, ...data.stamps]) {
      stamp.textContent = text
      line = Math.max(line, stamp.getBoundingClientRect().height)
    }
    stamp.textContent = said
    stamp.style.minHeight = `${line}px`
    const perLane = lanes.length
    columns.forEach((column, index) => {
      column.style.minHeight = `${tallest[index % perLane] ?? 0}px`
    })
    draw(current)
  }

  /** A box in the second board's own frame, so a scroll mid-move moves nothing. */
  const place = (node: Element) => {
    const frame = after.getBoundingClientRect()
    const box = node.getBoundingClientRect()
    return {
      x: box.left - frame.left,
      y: box.top - frame.top,
      w: box.width,
      h: box.height,
    }
  }

  const overlay = (kind: string, box: ReturnType<typeof place>) => {
    const node = document.createElement('div')
    node.className = kind
    node.setAttribute('aria-hidden', 'true')
    Object.assign(node.style, {
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${box.w}px`,
      height: `${box.h}px`,
    })
    after.append(node)
    return node
  }

  const clear = () => {
    timers.splice(0).forEach(clearTimeout)
    after.querySelectorAll('.ghost, .fly').forEach((node) => node.remove())
  }

  const later = (ms: number, step: () => void) =>
    timers.push(window.setTimeout(step, ms))

  const mark = (name: string) => {
    const moved = after.querySelector<HTMLElement>(
      `.cd[data-name="${CSS.escape(name)}"]`,
    )
    moved?.classList.add('mv')
    return moved
  }

  const move = (index: number) => {
    const name = data.moves[index]?.name ?? ''
    const from = after.querySelector(`.cd[data-name="${CSS.escape(name)}"]`)
    const start = from ? place(from) : null
    const carried = from?.cloneNode(true) as HTMLElement | undefined
    draw(index + 1)
    stamp.textContent = data.stamps[index] ?? ''
    if (reduced)
      bar.style.setProperty('--done', String((index + 1) / data.moves.length))
    const moved = mark(name)
    if (!moved) return
    if (
      reduced ||
      !start ||
      !carried ||
      !travels(data.rows, data.moves, index)
    ) {
      if (!reduced) moved.classList.add('pulse')
      return
    }
    const end = place(moved)
    moved.classList.add('held')
    const ghost = overlay('ghost', end)
    later(SLOT, () => {
      const fly = overlay('fly', start)
      fly.append(...carried.childNodes)
      fly.className = `fly ${carried.className}`
      fly.getBoundingClientRect()
      fly.style.transform = `translate(${end.x - start.x}px, ${end.y - start.y}px)`
      later(TRAVEL, () => {
        fly.remove()
        ghost.remove()
        moved.classList.remove('held')
        moved.classList.add('pulse')
      })
    })
  }

  const ready = () => {
    clear()
    draw(0)
    stamp.textContent = data.starts
    bar.classList.remove('run')
    bar.style.setProperty('--done', '0')
  }

  const night = () => {
    ran = true
    ready()
    if (!reduced) {
      bar.style.setProperty('--night', `${FIRST + data.moves.length * BEAT}ms`)
      bar.getBoundingClientRect()
      bar.classList.add('run')
    }
    data.moves.forEach((_, index) =>
      later(FIRST + index * BEAT, () => move(index)),
    )
  }

  /**
   * Measures again for a new width or once the web fonts land. A move under way
   * lands where it is, and the moves after it keep their beats.
   */
  let width = innerWidth
  const relock = () => {
    after.querySelectorAll('.ghost, .fly').forEach((node) => node.remove())
    lock()
    const last = data.moves[shown - 1]
    if (ran && last) mark(last.name)
  }
  lock()
  void document.fonts?.ready.then(relock)
  addEventListener('resize', () => {
    if (innerWidth === width) return
    width = innerWidth
    relock()
  })
  replay.hidden = false
  replay.addEventListener('click', night)
  if (playOnEntry(section, night, { node: board, threshold: 0.5 })) ready()
}
