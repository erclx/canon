import { playOnEntry } from '../../../lib/scene'

/**
 * Steps the reel through its stills once the strip comes into view, the
 * still on screen outlined, and ticks each checklist line as its beat passes.
 * Replay runs it again. Every line stays ticked until the reel starts, so the
 * page reads finished before the script runs and under reduced motion.
 */
const STEP = 1600
const section = document.getElementById('evidence')
const film = section?.querySelector<HTMLElement>('.film')
const replay = film?.querySelector<HTMLButtonElement>('.replay')
const lines = [...(film?.querySelectorAll<HTMLElement>('.ck li') ?? [])]
const strips = [...(film?.querySelectorAll<HTMLElement>('.strip') ?? [])]

if (section && replay && lines.length) {
  const timers: number[] = []
  const frames = (index: number) =>
    strips.flatMap((strip) => {
      const frame = strip.children[index]
      return frame instanceof HTMLElement ? [frame] : []
    })
  const count = Math.min(lines.length, strips[0]?.children.length ?? 0)

  const reel = () => {
    timers.splice(0).forEach(clearTimeout)
    lines.forEach((line) => line.classList.remove('done'))
    for (let index = 0; index <= count; index += 1) {
      timers.push(
        window.setTimeout(() => {
          strips.forEach((strip) =>
            [...strip.children].forEach((frame) =>
              frame.classList.remove('now'),
            ),
          )
          if (index === count) return
          frames(index).forEach((frame) => frame.classList.add('now'))
          lines[index]?.classList.add('done')
        }, index * STEP),
      )
    }
  }

  if (playOnEntry(section, reel)) {
    replay.hidden = false
    replay.addEventListener('click', reel)
  }
}
