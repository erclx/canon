import { holdOn, pacer, reducedMotion } from '../../../lib/scene'
import { boardAfter, type BoardMove, type BoardRow } from './state'

const section = document.getElementById('board')
const source = section?.querySelector('.board-data')
const clock = section?.querySelector<HTMLElement>('.clock')

if (section && source?.textContent && clock && !reducedMotion()) {
  const { start, rows, moves } = JSON.parse(source.textContent) as {
    start: string
    rows: BoardRow[]
    moves: BoardMove[]
  }
  const lanes = [...section.querySelectorAll<HTMLElement>('ul[data-lane]')]
  const nodes = new Map(
    [...section.querySelectorAll<HTMLElement>('.row')].map((node) => [
      node.dataset.name ?? '',
      node,
    ]),
  )
  const pace = pacer(
    holdOn(
      section.querySelector('.bd'),
      section.querySelector<HTMLButtonElement>('.pz'),
    ),
  )

  /** Lays the board out as it stands after `count` moves, sliding each row from where it sat. */
  function lay(count: number) {
    const before = new Map(
      [...nodes].map(([name, node]) => [name, node.getBoundingClientRect()]),
    )
    for (const row of boardAfter(rows, moves, count)) {
      const node = nodes.get(row.name)
      if (!node) continue
      node.querySelector('.st')!.textContent = row.line
      node.classList.toggle('wait', Boolean(row.waiting))
      lanes[row.lane]?.append(node)
    }
    clock!.textContent = count === 0 ? start : (moves[count - 1]?.at ?? start)
    for (const [name, node] of nodes) {
      const from = before.get(name)
      const to = node.getBoundingClientRect()
      if (!from || (from.x === to.x && from.y === to.y)) continue
      node.animate(
        [
          { transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)` },
          { transform: 'none' },
        ],
        { duration: 520, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      )
    }
    const moved = moves[count - 1]
    if (moved) nodes.get(moved.name)?.classList.add('just')
    setTimeout(
      () => moved && nodes.get(moved.name)?.classList.remove('just'),
      900,
    )
  }

  async function loop() {
    const generation = pace.next()
    for (;;) {
      if (!(await pace.wait(2600, generation))) return
      lay(0)
      for (let count = 1; count <= moves.length; count += 1) {
        if (!(await pace.wait(1400, generation))) return
        lay(count)
      }
    }
  }

  void loop()
}
