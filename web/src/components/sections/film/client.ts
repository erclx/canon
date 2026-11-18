import { holdOn, reducedMotion } from '../../../lib/scene'

interface Reel {
  reel: string
  still: string
}

const section = document.getElementById('film')
const source = section?.querySelector('.film-data')
const image = section?.querySelector<HTMLImageElement>('.stage img')
const still = section?.querySelector<HTMLSourceElement>('.stage source')

if (section && source?.textContent && image && still) {
  const { beats, total, reels } = JSON.parse(source.textContent) as {
    beats: number[]
    total: number
    reels: { dark: Reel; light: Reel }
  }
  const pause = section.querySelector<HTMLButtonElement>('.pz')
  const fill = section.querySelector<HTMLElement>('.bar i')
  const now = section.querySelector<HTMLElement>('.now')
  const chips = [...section.querySelectorAll<HTMLElement>('.beats li')]
  const checks = [...section.querySelectorAll<HTMLElement>('.checks li')]
  // A pointer over the reel holds nothing, since an animated image cannot stop mid-frame.
  const held = holdOn(null, pause)
  const moving = !reducedMotion()
  /** Where each beat ends on the reel's clock, scaled so the beats fill it. */
  const scale = total / beats.reduce((sum, seconds) => sum + seconds, 0)
  const ends = beats.map(
    (_, index) =>
      beats.slice(0, index + 1).reduce((sum, seconds) => sum + seconds, 0) *
      scale,
  )
  let started = 0

  const themed = () =>
    document.documentElement.dataset.theme === 'light'
      ? reels.light
      : reels.dark

  /** Points the image at the theme's reel, or at its still while paused, which restarts a reel from its first frame. */
  function point() {
    const reel = themed()
    still!.srcset = reel.still
    image!.src = held() ? reel.still : reel.reel
    started = 0
  }

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

  function tick() {
    if (!held() && started) draw(((performance.now() - started) / 1000) % total)
    requestAnimationFrame(tick)
  }

  point()
  new MutationObserver(point).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  if (moving) {
    pause?.addEventListener('click', () => {
      point()
      if (held()) draw(total - 0.001)
    })
    // The reel starts when it decodes, which a lazy image does only once scrolled near.
    image.addEventListener('load', () => {
      if (!started && !held()) started = performance.now()
    })
    draw(0)
    requestAnimationFrame(tick)
  }
}
