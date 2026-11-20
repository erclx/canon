import { holdOn, reducedMotion } from '../../../lib/scene'

/**
 * Passes the change card to card on Claude Code's 1.4s pulse. A pointer or
 * focus on the relay holds it, as does the pause button, whose visible word
 * and label both swap on a press. Under reduced motion nothing runs, so the
 * button stays hidden and every card rests unlit.
 */
const relay = document.querySelector<HTMLElement>('#top .relay')
const button = document.querySelector<HTMLButtonElement>('#top .pz-relay')

if (relay && button && !reducedMotion()) {
  const cards = [...relay.querySelectorAll<HTMLElement>('.st')]
  let at = 0
  let paused = false
  const hover = holdOn(relay)

  const light = () =>
    cards.forEach((card, i) => card.classList.toggle('act', i === at))

  const sync = () => {
    button.textContent =
      (paused ? button.dataset.play : button.dataset.pause) ?? ''
    button.setAttribute(
      'aria-label',
      (paused ? button.dataset.playLabel : button.dataset.pauseLabel) ?? '',
    )
  }

  button.addEventListener('click', () => {
    paused = !paused
    sync()
  })

  relay.classList.add('run')
  button.hidden = false
  light()
  setInterval(() => {
    if (paused || hover()) return
    at = (at + 1) % cards.length
    light()
  }, 1400)
}
