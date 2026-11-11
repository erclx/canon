import { escapeHtml, pacer, reducedMotion } from '../../../lib/scene'

interface Block {
  ask: string
  shell: boolean
  rows: [string, string, string][]
}

const section = document.getElementById('setup')
const source = section?.querySelector('.setup-data')
const log = section?.querySelector<HTMLElement>('.log')
const tx = section?.querySelector<HTMLElement>('.tx')

if (section && source?.textContent && log && tx) {
  const blocks = JSON.parse(source.textContent) as Block[]
  const stages = [...section.querySelectorAll<HTMLElement>('.st')]
  const pace = pacer()
  const still = reducedMotion()
  const last = blocks.length - 1

  function mark(index: number) {
    stages.forEach((stage, j) => {
      stage.classList.toggle('on', j === index)
      stage.classList.toggle('done', j < index)
    })
  }

  function block(index: number) {
    const node = document.createElement('div')
    const shell = blocks[index]?.shell
    node.className = 'blk'
    node.innerHTML = `<div class="ask"><span class="g">${shell ? '$' : '❯'}</span> <span class="t"></span></div>`
    log!.append(node)
    return node
  }
  function row(
    node: HTMLElement,
    [kind, key, value]: [string, string, string],
  ) {
    const line = document.createElement('div')
    line.className = `row${kind === 'q' ? ' q' : ''}`
    line.innerHTML = `<span class="k">${escapeHtml(key)}</span><span class="v">${escapeHtml(value)}</span>`
    node.append(line)
  }
  function full(index: number) {
    const node = block(index)
    const text = node.querySelector('.t')
    if (text) text.textContent = blocks[index]?.ask ?? ''
    blocks[index]?.rows.forEach((r) => row(node, r))
  }
  function upTo(index: number) {
    log!.replaceChildren()
    for (let i = 0; i <= index; i++) full(i)
  }

  /** The session keeps the height of the whole run, so a replay never moves the page. */
  function size() {
    tx!.style.setProperty('--txh', '0px')
    const kept = [...log!.childNodes]
    upTo(last)
    tx!.style.setProperty('--txh', `${tx!.offsetHeight}px`)
    log!.replaceChildren(...kept)
  }

  async function play(index: number, generation: number) {
    const item = blocks[index]
    if (!item) return false
    mark(index)
    log!.replaceChildren()
    for (let j = 0; j < index; j++) full(j)
    const node = block(index)
    const text = node.querySelector<HTMLElement>('.t')
    const cursor = document.createElement('span')
    cursor.className = 'cur'
    text?.after(cursor)
    for (let k = 1; k <= item.ask.length; k++) {
      if (text) text.textContent = item.ask.slice(0, k)
      if (!(await pace.wait(30, generation))) return false
    }
    if (!(await pace.wait(500, generation))) return false
    cursor.remove()
    for (const r of item.rows) {
      if (!(await pace.wait(r[0] === 'q' ? 900 : 420, generation))) return false
      row(node, r)
    }
    return true
  }

  async function tour(generation: number) {
    for (let i = 0; i < blocks.length; i++) {
      if (!(await play(i, generation))) return
      if (!(await pace.wait(1100, generation))) return
    }
    mark(last)
  }

  stages.forEach((stage, index) =>
    stage.querySelector('.go')?.addEventListener('click', () => {
      const generation = pace.next()
      if (still) {
        mark(index)
        upTo(index)
      } else void play(index, generation)
    }),
  )

  upTo(last)
  mark(last)
  size()
  window.addEventListener('resize', size)
  void document.fonts?.ready.then(size)

  if (!still) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.35)
        ) {
          observer.disconnect()
          const generation = pace.next()
          log.replaceChildren()
          void tour(generation)
        }
      },
      { threshold: [0.35] },
    )
    observer.observe(tx)
  }
}
