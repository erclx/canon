import { reducedMotion } from '../../../lib/scene'

/**
 * A chip swaps the quote and its rule: the pair fades out, the picked one
 * takes its place, and it fades back in. Reduced motion swaps at once.
 */
const section = document.getElementById('craft')
const chips = [...(section?.querySelectorAll<HTMLButtonElement>('.chip') ?? [])]
const pairs = [...(section?.querySelectorAll<HTMLElement>('.pair') ?? [])]
const box = section?.querySelector<HTMLElement>('.pairs')
let swap = 0

const show = (picked: number) => {
  pairs.forEach((pair, index) => (pair.hidden = index !== picked))
  box?.classList.remove('swap')
}

chips.forEach((chip, index) =>
  chip.addEventListener('click', () => {
    chips.forEach((other) =>
      other.setAttribute('aria-pressed', String(other === chip)),
    )
    clearTimeout(swap)
    if (reducedMotion()) return show(index)
    box?.classList.add('swap')
    swap = window.setTimeout(() => show(index), 240)
  }),
)
