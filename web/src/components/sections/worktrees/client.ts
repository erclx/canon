import { holdOn, reducedMotion } from '../../../lib/scene'

const section = document.getElementById('worktrees')
const source = section?.querySelector('.worktrees-data')

if (section && source?.textContent && !reducedMotion()) {
  /** Per card, the band folder each of its status steps writes. */
  const { rest, cards } = JSON.parse(source.textContent) as {
    rest: number
    cards: string[][]
  }
  const nodes = [...section.querySelectorAll<HTMLElement>('.wt')]
  const folders = new Map(
    [...section.querySelectorAll<HTMLElement>('.dirs [data-dir]')].map(
      (node) => [node.dataset.dir ?? '', node],
    ),
  )
  const held = holdOn(section.querySelector('.card'))
  const at = cards.map(() => rest)
  let turn = 0

  /** Restarts a one-shot animation class on a node that may still carry it. */
  const replay = (node: Element | null) => {
    if (!(node instanceof HTMLElement)) return
    node.classList.remove('go')
    void node.offsetWidth
    node.classList.add('go')
  }

  function beat(k: number) {
    const card = nodes[k]
    const dirs = cards[k]
    if (!card || !dirs?.length) return
    const step = ((at[k] ?? rest) + 1) % dirs.length
    at[k] = step
    card
      .querySelectorAll('.l > span')
      .forEach((line, j) => line.classList.toggle('on', j === step))
    replay(card.querySelector('.dot'))
    replay(card.querySelector('.drop'))
    // The folder lights as the drop reaches the band, not as it leaves the card.
    const folder = folders.get(dirs[step] ?? '')
    setTimeout(() => {
      folder?.classList.add('lit')
      setTimeout(() => folder?.classList.remove('lit'), 900)
    }, 420)
  }

  setInterval(() => {
    if (held() || document.hidden) return
    beat(turn)
    turn = (turn + 1) % nodes.length
  }, 1400)
}
