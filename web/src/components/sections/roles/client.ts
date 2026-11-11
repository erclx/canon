import { escapeHtml, holdOn, pacer, reducedMotion } from '../../../lib/scene'

interface Scene {
  session: string
  prompt: string
  act: string[]
  say: string[]
}

const section = document.getElementById('roles')
const source = section?.querySelector('.roles-data')
const log = section?.querySelector<HTMLElement>('.log')
const typed = section?.querySelector<HTMLElement>('.typed')
const who = section?.querySelector<HTMLElement>('.who')
const buttons = [
  ...(section?.querySelectorAll<HTMLButtonElement>('.list button') ?? []),
]

if (section && source?.textContent && log && typed && who) {
  const scenes = JSON.parse(source.textContent) as Scene[]
  const pace = pacer(holdOn(section.querySelector('.win')))
  const still = reducedMotion()

  const block = (className: string, html: string) => {
    const node = document.createElement('div')
    node.className = className
    node.innerHTML = html
    return node
  }
  const ask = (scene: Scene) =>
    block(
      'ask',
      `<span class="g">❯</span><span>${escapeHtml(scene.prompt)}</span>`,
    )
  const act = (scene: Scene) =>
    block(
      'act',
      escapeHtml(scene.act[0] ?? '') +
        scene.act
          .slice(1)
          .map((line) => `<span>${escapeHtml(line)}</span>`)
          .join(''),
    )
  const say = (line: string, first: boolean) =>
    block(`say${first ? ' first' : ''}`, escapeHtml(line))

  function mark(index: number) {
    buttons.forEach((button, j) =>
      button.setAttribute('aria-pressed', String(j === index)),
    )
    who!.textContent = scenes[index]?.session ?? ''
  }

  function full(index: number) {
    const scene = scenes[index]
    if (!scene) return
    mark(index)
    typed!.textContent = ''
    log!.replaceChildren(
      ask(scene),
      act(scene),
      ...scene.say.map((line, k) => say(line, k === 0)),
    )
  }

  async function show(node: HTMLElement, generation: number) {
    node.classList.add('hide')
    log!.append(node)
    if (!(await pace.wait(30, generation))) return false
    node.classList.remove('hide')
    return true
  }

  async function play(index: number, generation: number) {
    const scene = scenes[index]
    if (!scene) return false
    mark(index)
    ;[...log!.children].forEach((child) => child.classList.add('hide'))
    if (!(await pace.wait(300, generation))) return false
    log!.replaceChildren()
    typed!.textContent = ''
    if (!(await pace.wait(250, generation))) return false
    for (const char of scene.prompt) {
      typed!.textContent += char
      if (!(await pace.wait(11, generation))) return false
    }
    const pause = Math.min(2200, 700 + scene.prompt.length * 10)
    if (!(await pace.wait(pause, generation))) return false
    typed!.textContent = ''
    if (!(await show(ask(scene), generation))) return false
    if (!(await pace.wait(400, generation))) return false
    if (!(await show(act(scene), generation))) return false
    if (!(await pace.wait(500, generation))) return false
    for (const [k, line] of scene.say.entries()) {
      if (!(await show(say(line, k === 0), generation))) return false
      if (!(await pace.wait(320, generation))) return false
    }
    return pace.wait(2600, generation)
  }

  async function loop(from: number) {
    const generation = pace.next()
    let index = from
    while (await play(index, generation)) index = (index + 1) % scenes.length
  }

  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      const index = Number(button.dataset.i)
      if (still) {
        pace.next()
        full(index)
      } else void loop(index)
    }),
  )

  if (still) full(0)
  else void loop(0)
}
