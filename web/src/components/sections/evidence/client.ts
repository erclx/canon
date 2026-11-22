// Astro bundles this file as a module, and the empty export tells TypeScript so,
// keeping its names off the globals the other section scripts declare.
export {}

/**
 * Plays the reel once on a press and returns it to its still at the end or on
 * a second press. The length counts from the reel's arrival, since on a slow
 * link the bytes take longer than the reel runs. Nothing plays on its own.
 */
const reel = document.querySelector<HTMLElement>('#evidence .reel')
const frame = reel?.querySelector<HTMLImageElement>('.frame')
const button = reel?.querySelector<HTMLButtonElement>('.play')
const label = button?.querySelector<HTMLElement>('.label')

if (reel && frame && button && label) {
  let end: ReturnType<typeof setTimeout> | undefined

  const started = () => {
    label.textContent = button.dataset.stop ?? ''
    end = setTimeout(rest, Number(button.dataset.ms))
  }

  const rest = () => {
    clearTimeout(end)
    frame.removeEventListener('load', started)
    frame.src = frame.dataset.still ?? ''
    reel.classList.remove('on')
    label.textContent = button.dataset.play ?? ''
  }

  const play = () => {
    reel.classList.add('on')
    label.textContent = button.dataset.loading ?? ''
    frame.addEventListener('load', started, { once: true })
    frame.src = frame.dataset.reel ?? ''
  }

  button.addEventListener('click', () =>
    reel.classList.contains('on') ? rest() : play(),
  )
}
