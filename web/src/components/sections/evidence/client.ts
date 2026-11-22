// Astro bundles this file as a module, and the empty export tells TypeScript so,
// keeping its names off the globals the other section scripts declare.
export {}

/**
 * Plays the reel once on a press and returns it to its still at the end or on
 * a second press. Nothing plays on its own, under reduced motion or not, so the
 * section reads as its opening frame until a reader asks for the film.
 */
const reel = document.querySelector<HTMLElement>('#evidence .reel')
const frame = reel?.querySelector<HTMLImageElement>('.frame')
const button = reel?.querySelector<HTMLButtonElement>('.play')
const label = button?.querySelector<HTMLElement>('.label')

if (reel && frame && button && label) {
  let end: ReturnType<typeof setTimeout> | undefined

  const rest = () => {
    clearTimeout(end)
    frame.src = frame.dataset.still ?? ''
    reel.classList.remove('on')
    label.textContent = button.dataset.play ?? ''
  }

  const play = () => {
    frame.src = frame.dataset.reel ?? ''
    reel.classList.add('on')
    label.textContent = button.dataset.stop ?? ''
    end = setTimeout(rest, Number(button.dataset.ms))
  }

  button.addEventListener('click', () =>
    reel.classList.contains('on') ? rest() : play(),
  )
}
