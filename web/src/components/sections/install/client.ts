// Astro bundles this file as a module, and the empty export tells TypeScript so,
// keeping `status` below off the global `window.status`.
export {}

/**
 * Copies the three commands on a press and says so, in the button and to a
 * screen reader, for 1.6s. A refused clipboard still shows the state, since
 * the commands stay on screen to copy by hand.
 */
const card = document.querySelector<HTMLElement>('#install .cmd')
const button = card?.querySelector<HTMLButtonElement>('.copy')
const label = button?.querySelector<HTMLElement>('.now')
const status = card?.querySelector<HTMLElement>('[role="status"]')
let reset: ReturnType<typeof setTimeout> | undefined

button?.addEventListener('click', () => {
  void navigator.clipboard
    ?.writeText(card?.dataset.commands ?? '')
    .catch(() => {})
  if (label) label.textContent = button.dataset.done ?? ''
  if (status) status.textContent = button.dataset.status ?? ''
  clearTimeout(reset)
  reset = setTimeout(() => {
    if (label) label.textContent = button.dataset.label ?? ''
    if (status) status.textContent = ''
  }, 1600)
})
