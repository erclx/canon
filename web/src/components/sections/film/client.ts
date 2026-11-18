import { holdOn, reducedMotion } from '../../../lib/scene'

const section = document.getElementById('film')
const source = section?.querySelector('.film-data')
const pause = section?.querySelector<HTMLButtonElement>('.pz')

if (section && source?.textContent && pause && !reducedMotion()) {
  const { beats, total } = JSON.parse(source.textContent) as {
    beats: number[]
    total: number
  }
  const images = [...section.querySelectorAll<HTMLImageElement>('img')]
  const fill = section.querySelector<HTMLElement>('.bar i')
  const now = section.querySelector<HTMLElement>('.now')
  const chips = [...section.querySelectorAll<HTMLElement>('.beats li')]
  const checks = [...section.querySelectorAll<HTMLElement>('.checks li')]
  /** Where each beat ends on the reel's clock, scaled so the beats fill it. */
  const scale = total / beats.reduce((sum, seconds) => sum + seconds, 0)
  const ends = beats.map(
    (_, index) =>
      beats.slice(0, index + 1).reduce((sum, seconds) => sum + seconds, 0) *
      scale,
  )
  // A pointer over the reel holds nothing, since an animated image cannot stop mid-frame.
  const held = holdOn(null, pause)
  let started = 0
  let paused = false

  function draw(at: number) {
    const beat = ends.findIndex((end) => at < end)
    const current = beat === -1 ? ends.length - 1 : beat
    if (fill) fill.style.transform = `scaleX(${at / total})`
    if (now) now.textContent = `0:${String(Math.floor(at)).padStart(2, '0')}`
    chips.forEach((chip, index) =>
      chip.classList.toggle('on', index === current),
    )
    checks.forEach((check, index) =>
      check.classList.toggle('done', at >= (ends[index] ?? total)),
    )
  }

  /** Restarts every reel from its first frame, which setting its address again does. */
  function restart() {
    for (const image of images) image.src = image.dataset.reel ?? image.src
    started = performance.now()
  }

  function tick() {
    if (!paused && started) {
      const at = ((performance.now() - started) / 1000) % total
      draw(at)
    }
    requestAnimationFrame(tick)
  }

  pause.addEventListener('click', () => {
    paused = held()
    if (paused) {
      for (const image of images) image.src = image.dataset.still ?? image.src
      draw(total - 0.001)
    } else restart()
  })

  // The reel starts when it decodes, which a lazy image does only once scrolled near.
  for (const image of images)
    image.addEventListener('load', () => {
      if (!started && !paused && image.offsetParent) started = performance.now()
    })
  draw(0)
  requestAnimationFrame(tick)
}
