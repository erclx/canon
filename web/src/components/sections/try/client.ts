// Astro bundles this file as a module, and the empty export tells TypeScript so,
// keeping `status` below off the global `window.status`.
export {}

const block = document.querySelector<HTMLElement>('#try .block')
const button = block?.querySelector<HTMLButtonElement>('.copy')
const tip = button?.querySelector<HTMLElement>('.tip')
const status = block?.querySelector<HTMLElement>('[role="status"]')
let reset: ReturnType<typeof setTimeout> | undefined

button?.addEventListener('click', () => {
  void navigator.clipboard
    ?.writeText(block?.dataset.commands ?? '')
    .catch(() => {
      // A refused clipboard still shows the state, since the commands stay on screen to copy by hand.
    })
  button.classList.add('done')
  if (tip) tip.textContent = button.dataset.done ?? ''
  if (status) status.textContent = button.dataset.status ?? ''
  clearTimeout(reset)
  reset = setTimeout(() => {
    button.classList.remove('done')
    if (tip) tip.textContent = button.dataset.tip ?? ''
    if (status) status.textContent = ''
  }, 1600)
})
