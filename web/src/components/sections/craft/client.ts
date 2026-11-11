import { escapeHtml, holdOn, pacer, reducedMotion } from '../../../lib/scene'

interface Skill {
  name: string
  loads: string
  rule: string
  ruleFile: string
  source: string
  quote: string
}
interface Scene {
  ask: string
  lines: [string, string, string][]
}

const section = document.getElementById('craft')
const source = section?.querySelector('.craft-data')
const log = section?.querySelector<HTMLElement>('.log')
const typed = section?.querySelector<HTMLElement>('.typed')

if (section && source?.textContent && log && typed) {
  const { skills, scenes } = JSON.parse(source.textContent) as {
    skills: Skill[]
    scenes: Scene[]
  }
  const picks = [...section.querySelectorAll<HTMLButtonElement>('.pick')]
  const panes = section.querySelector<HTMLElement>('.panes')
  const pair = section.querySelector<HTMLElement>('.pair')
  const field = (name: string) =>
    section.querySelector<HTMLElement>(`.p-${name}`)
  const pace = pacer(holdOn(section.querySelector('.win')))
  const still = reducedMotion()
  const indexOf = (name: string) => skills.findIndex((s) => s.name === name)
  const sceneOf = (name: string) =>
    scenes.findIndex((scene) =>
      scene.lines.some(
        ([tool, arg]) => tool === 'Skill' && arg === `canon:${name}`,
      ),
    )
  let held = -1

  function fill(index: number) {
    const skill = skills[index]
    if (!skill) return
    const set = (name: string, text: string) => {
      const node = field(name)
      if (node) node.textContent = text
    }
    set('file', skill.ruleFile)
    set('rule', skill.rule)
    set('loads', skill.loads)
    set('source', skill.source)
    set('quote', skill.quote)
  }

  /** Exactly one skill is lit at a time. */
  function only(index: number) {
    picks.forEach((pick) =>
      pick.setAttribute(
        'aria-pressed',
        String(Number(pick.dataset.i) === index),
      ),
    )
    fill(index)
  }

  /** The panes keep the height of the tallest skill, so a pick never moves the page. */
  function settle() {
    if (!panes || !pair) return
    panes.style.minHeight = ''
    const shown = Math.max(
      0,
      picks.findIndex((p) => p.getAttribute('aria-pressed') === 'true'),
    )
    let tallest = 0
    skills.forEach((_, i) => {
      fill(i)
      tallest = Math.max(tallest, panes.offsetHeight)
    })
    fill(shown)
    panes.style.minHeight = `${tallest}px`
  }

  function light(arg: string) {
    const index = indexOf(arg.replace('canon:', ''))
    if (index < 0) return
    if (held >= 0 && index !== held) return
    held = -1
    only(index)
  }

  function add(className: string, html: string) {
    const node = document.createElement('div')
    node.className = className
    node.innerHTML = html
    log!.append(node)
  }
  const askLine = (text: string) =>
    add('ask', `<span class="g">❯</span><span>${escapeHtml(text)}</span>`)
  const toolLine = (tool: string, arg: string) =>
    add(
      `tool${tool === 'Skill' ? ' sk' : ''}`,
      `<b>${tool}</b>(${escapeHtml(arg)})`,
    )

  function render(scene: Scene) {
    log!.replaceChildren()
    typed!.textContent = ''
    askLine(scene.ask)
    scene.lines.forEach(([tool, arg, result]) => {
      toolLine(tool, arg)
      add('res', escapeHtml(result))
      if (tool === 'Skill') light(arg)
    })
  }

  async function run(from: number, generation: number, fade: boolean) {
    if (fade) {
      log!.classList.add('hide')
      if (!(await pace.wait(320, generation))) return
      log!.replaceChildren()
      log!.classList.remove('hide')
    }
    for (let k = from; ; k++) {
      const scene = scenes[k % scenes.length]
      if (!scene) return
      const lead = scene.lines.find(
        ([tool, arg]) =>
          tool === 'Skill' && indexOf(arg.replace('canon:', '')) >= 0,
      )
      if (lead) light(lead[1])
      for (let c = 1; c <= scene.ask.length; c++) {
        typed!.textContent = scene.ask.slice(0, c)
        if (!(await pace.wait(26, generation))) return
      }
      if (
        !(await pace.wait(
          Math.min(1400, 500 + scene.ask.length * 12),
          generation,
        ))
      )
        return
      typed!.textContent = ''
      log!.replaceChildren()
      askLine(scene.ask)
      for (const [tool, arg, result] of scene.lines) {
        if (!(await pace.wait(650, generation))) return
        toolLine(tool, arg)
        if (!(await pace.wait(250, generation))) return
        add('res', escapeHtml(result))
        if (tool === 'Skill') light(arg)
      }
      if (!(await pace.wait(2600, generation))) return
      log!.classList.add('hide')
      if (!(await pace.wait(320, generation))) return
      held = -1
      log!.replaceChildren()
      log!.classList.remove('hide')
    }
  }

  function jump(index: number) {
    const skill = skills[index]
    if (!skill) return
    const k = Math.max(0, sceneOf(skill.name))
    const generation = pace.next()
    held = index
    only(index)
    typed!.textContent = ''
    const scene = scenes[k]
    if (still) {
      if (scene) render(scene)
      return
    }
    void run(k, generation, true)
  }

  picks.forEach((pick) =>
    pick.addEventListener('click', () => jump(Number(pick.dataset.i))),
  )

  only(0)
  settle()
  window.addEventListener('resize', settle)
  void document.fonts?.ready.then(settle)

  if (still) {
    const scene = scenes[0]
    if (scene) render(scene)
  } else {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        void run(0, pace.next(), false)
      }
    })
    const win = section.querySelector('.win')
    if (win) observer.observe(win)
  }
}
