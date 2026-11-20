import { playOnEntry } from '../../../lib/scene'
import type { BoardMove, BoardRow } from './state'
import { boardAfter } from './state'

interface Data {
  rows: BoardRow[]
  moves: BoardMove[]
  starts: string
  stamps: string[]
  waiting: string
}

/**
 * Replays the night on the second board once it comes into view: the board
 * as you left it, then one move a beat with the clock reading its time, until
 * it rests where the page rendered it. Replay starts the night again.
 */
const section = document.getElementById('board')
const source = document.getElementById('board-data')
const after = section?.querySelector<HTMLElement>('.side.after')
const stamp = after?.querySelector<HTMLElement>('.stamp')
const replay = after?.querySelector<HTMLButtonElement>('.replay')
const lanes = [...(after?.querySelectorAll<HTMLElement>('.cards') ?? [])]

if (section && source && stamp && replay && lanes.length) {
  const data = JSON.parse(source.textContent ?? '{}') as Data
  const timers: number[] = []

  const card = (row: BoardRow) => {
    const li = document.createElement('li')
    li.className = row.waiting ? 'cd wt' : 'cd'
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
    const rows = boardAfter(data.rows, data.moves, count)
    lanes.forEach((lane, index) =>
      lane.replaceChildren(
        ...rows.filter((row) => row.lane === index).map(card),
      ),
    )
  }

  const night = () => {
    timers.splice(0).forEach(clearTimeout)
    draw(0)
    stamp.textContent = data.starts
    data.moves.forEach((_, index) => {
      timers.push(
        window.setTimeout(
          () => {
            draw(index + 1)
            stamp.textContent = data.stamps[index] ?? ''
          },
          700 + index * 900,
        ),
      )
    })
  }

  if (playOnEntry(section, night)) {
    replay.hidden = false
    replay.addEventListener('click', night)
  }
}
