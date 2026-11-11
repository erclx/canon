import { escapeHtml, pacer, reducedMotion } from '../../../lib/scene'

type Line = [string, string, string]
interface Scene {
  ask: string
  lines: Line[]
}

const section = document.getElementById('guardrails')
const source = section?.querySelector('.guardrails-data')
const log = section?.querySelector<HTMLElement>('.log')

if (section && source?.textContent && log) {
  const { scenes, rest } = JSON.parse(source.textContent) as {
    scenes: Scene[]
    rest: number
  }
  const parts = [...section.querySelectorAll<HTMLElement>('.four > div')]
  const status = section.querySelector<HTMLElement>('[role="status"]')
  const pace = pacer()
  const still = reducedMotion()
  let current = rest

  function mark(index: number) {
    parts.forEach((part, j) => part.classList.toggle('lit', j === index))
  }

  function line([kind, lead, text]: Line) {
    const node = document.createElement('div')
    node.className = kind
    if (kind === 'tool') node.innerHTML = `<b>${lead}</b>(${escapeHtml(text)})`
    else if (kind === 'block')
      node.innerHTML = `<span><span class="why">${escapeHtml(lead)}</span><span class="msg">${escapeHtml(text)}</span></span>`
    else node.textContent = text
    return node
  }
  function askLine(text: string) {
    const node = document.createElement('div')
    node.className = 'ask'
    node.innerHTML = `<span class="g">❯</span><span>${escapeHtml(text)}</span>`
    return node
  }

  function full(index: number) {
    const scene = scenes[index]
    if (!scene) return
    log!.replaceChildren(askLine(scene.ask), ...scene.lines.map(line))
  }

  /** The window keeps the height of its tallest scene. */
  function size() {
    log!.style.height = ''
    let tallest = 0
    scenes.forEach((_, i) => {
      full(i)
      tallest = Math.max(tallest, log!.scrollHeight)
    })
    log!.style.height = `${tallest}px`
    full(current)
  }

  function announce(index: number) {
    const block = scenes[index]?.lines.find(([kind]) => kind === 'block')
    if (status) status.textContent = block ? `${block[1]}. ${block[2]}` : ''
  }

  async function play(index: number, generation: number) {
    const scene = scenes[index]
    if (!scene) return false
    current = index
    mark(index)
    log!.classList.add('hide')
    if (!(await pace.wait(300, generation))) return false
    log!.replaceChildren(askLine(scene.ask))
    log!.classList.remove('hide')
    for (const item of scene.lines) {
      const gap = item[0] === 'tool' || item[0] === 'say' ? 700 : 300
      if (!(await pace.wait(gap, generation))) return false
      log!.append(line(item))
    }
    return true
  }

  async function tour(generation: number) {
    for (let i = 0; i < scenes.length; i++) {
      if (!(await play(i, generation))) return
      if (!(await pace.wait(1800, generation))) return
    }
    current = rest
    mark(rest)
    log!.classList.add('hide')
    if (!(await pace.wait(300, generation))) return
    full(rest)
    log!.classList.remove('hide')
  }

  parts.forEach((part, index) =>
    part.querySelector('.go')?.addEventListener('click', () => {
      const generation = pace.next()
      announce(index)
      if (still) {
        current = index
        mark(index)
        full(index)
      } else void play(index, generation)
    }),
  )

  size()
  mark(rest)
  window.addEventListener('resize', size)
  void document.fonts?.ready.then(size)

  if (!still) {
    const tray = section.querySelector('.tray')
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.4)
        ) {
          observer.disconnect()
          void tour(pace.next())
        }
      },
      { threshold: [0.4] },
    )
    if (tray) observer.observe(tray)
  }
}
