import type { Change, Role, Seat } from '../../../content/sessions'
import { holdOn, reducedMotion } from '../../../lib/scene'

interface Live {
  n: string
  aw?: string
  wk: string
  dn: string
  age: number
  key: string
  role: Role
  slug: string
  /** The status line a working session has stepped to. */
  li: number
}
interface Data {
  changes: Change[]
  lines: Record<Role, { wk: string[]; dn: string }>
  pinned: { name: string; line: string; age: string }
  completed: number
  opening: { awaiting: Seat[]; working: Seat[]; done: Seat[]; next: string }
  flow: string[]
  skills: { name: string; line: string }[]
  noMatch: string
  shellHint: string
}
type Kind = 'pin' | 'aw' | 'wk' | 'dn'
interface Row extends HTMLDivElement {
  kind?: Kind
  line?: string
}

const source = document.getElementById('av-data')
const list = document.getElementById('av-list')
const counts = document.getElementById('av-counts')
const ask = document.getElementById('av-ask')
const menu = document.getElementById('av-menu')

if (
  source &&
  list &&
  counts &&
  ask instanceof HTMLInputElement &&
  menu &&
  source.textContent
) {
  const data = JSON.parse(source.textContent) as Data
  const ROW = 30
  const HEAD = 26
  const GAP = 16
  const HEIGHT = 404
  const esc = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

  let cursor = 0
  let tick = 0
  let done = data.completed
  const state = {
    pin: data.pinned.line,
    aw: [] as Live[],
    wk: [] as Live[],
    dn: [] as Live[],
  }
  const rows = new Map<string, Row>()
  const heads = new Map<string, HTMLDivElement>()

  let serial = 0
  const changeOf = (slug: string) => data.changes.find((c) => c.slug === slug)
  /** A session of `role` on the change `slug`, its status line stepped to `li`. */
  function make(role: Role, slug: string, li = 0, age = 0): Live {
    const lines = data.lines[role]
    const asks = role === 'planner' ? changeOf(slug)?.asks : undefined
    return {
      n: `${role}-canon-${slug}`,
      ...(asks ? { aw: asks } : {}),
      wk: lines.wk[Math.min(li, lines.wk.length - 1)] ?? '',
      dn: lines.dn,
      age,
      key: `${role}-${slug}#${serial++}`,
      role,
      slug,
      li,
    }
  }
  const seat = (s: Seat) => make(s.role, s.slug, s.line, s.age)
  state.aw.push(...data.opening.awaiting.map(seat))
  state.wk.push(...data.opening.working.map(seat))
  state.dn.push(...data.opening.done.map(seat))
  cursor = Math.max(
    0,
    data.changes.findIndex((c) => c.slug === data.opening.next),
  )

  function head(id: string, text: string) {
    let node = heads.get(id)
    if (!node) {
      node = document.createElement('div')
      node.className = 'g'
      node.textContent = text
      list?.appendChild(node)
      heads.set(id, node)
    }
    return node
  }
  const glyph = (kind: Kind) =>
    kind === 'aw'
      ? '<span class="s wt">◆</span>'
      : kind === 'wk'
        ? '<span class="s sp"></span>'
        : kind === 'pin'
          ? '<span class="s">✻</span>'
          : '<span class="s dn">✓</span>'
  const age = (minutes: number) =>
    minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`

  function row(
    key: string,
    kind: Kind,
    name: string,
    line: string,
    minutes: number,
    old = false,
  ): Row {
    const id = `${key}:${kind}`
    const when = kind === 'pin' ? data.pinned.age : age(minutes)
    const html = `<span>${glyph(kind)}</span><span class="n">${esc(name)}</span><span class="d">${esc(line)}</span><span class="t">${when}</span>`
    let node = rows.get(id)
    if (!node) {
      node = document.createElement('div') as Row
      node.className = `r enter arriving${kind === 'pin' ? ' pin' : ''}`
      node.innerHTML = html
      list?.appendChild(node)
      rows.set(id, node)
      const born = node
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          born.classList.remove('enter')
          setTimeout(() => born.classList.remove('arriving'), 1200)
        }),
      )
    } else if (node.kind !== kind || node.line !== line) {
      node.innerHTML = html
      node.classList.remove('flash')
      void node.offsetWidth
      node.classList.add('flash')
    } else {
      const t = node.querySelector('.t')
      if (t) t.textContent = when
    }
    node.kind = kind
    node.line = line
    if (old) {
      const s = node.querySelector('.s')
      if (s) {
        s.className = 's old'
        s.textContent = '·'
      }
    }
    return node
  }

  function layout() {
    let y = 0
    const seen = new Set<string>()
    const place = (node: HTMLElement, id: string) => {
      node.style.top = `${y}px`
      seen.add(id)
      y += ROW
    }
    const showHead = (id: string, text: string, show: boolean) => {
      const node = head(id, text)
      const was = node.style.opacity !== '0'
      if (show) {
        node.style.transition = was
          ? ''
          : 'top 0s, opacity var(--duration-fade) var(--ease-standard) 750ms'
        node.style.top = `${y}px`
        node.style.opacity = '1'
        y += HEAD
      } else {
        node.style.opacity = '0'
      }
    }
    showHead('pin', 'Pinned', true)
    place(row('pin', 'pin', data.pinned.name, state.pin, 0), 'pin:pin')
    y += GAP
    showHead('aw', 'Awaiting input', state.aw.length > 0)
    state.aw.forEach((s) =>
      place(row(s.key, 'aw', s.n, s.aw ?? '', s.age), `${s.key}:aw`),
    )
    if (state.aw.length) y += GAP
    showHead('wk', 'Working', true)
    state.wk.forEach((s) =>
      place(row(s.key, 'wk', s.n, s.wk, s.age), `${s.key}:wk`),
    )
    y += GAP
    showHead('dn', 'Completed', true)
    state.dn.forEach((s, i) => {
      if (y + ROW > HEIGHT) return
      place(row(s.key, 'dn', s.n, s.dn, s.age, i >= 3), `${s.key}:dn`)
    })
    rows.forEach((node, id) => {
      if (seen.has(id)) return
      node.classList.add('leave')
      rows.delete(id)
      setTimeout(() => node.remove(), 400)
    })
    writeCounts()
  }

  /* A phone width cuts the long wording mid-word, so it takes the short one. */
  const narrow = matchMedia('(max-width: 640px)')
  function writeCounts() {
    if (!counts) return
    const [awaiting, completed] = narrow.matches
      ? ['awaiting', 'done']
      : ['awaiting input', 'completed']
    counts.innerHTML = `<b>${state.aw.length}</b> ${awaiting} · <b>${state.wk.length}</b> working · <b>${done}</b> ${completed}`
  }
  narrow.addEventListener('change', writeCounts)

  const inFlight = (slug: string) =>
    [...state.aw, ...state.wk].some((s) => s.slug === slug)

  /** Finishes the oldest working session and starts whatever its change runs next. */
  function finish() {
    const s = state.wk.shift()
    if (!s) return
    s.age = 0
    state.dn.unshift(s)
    done++
    if (s.role === 'planner') {
      state.wk.push(make('worker', s.slug))
      state.pin = `Plan in for ${s.slug}, a worker takes it`
    } else if (s.role === 'worker') {
      state.wk.push(make('reviewer', s.slug))
      if (changeOf(s.slug)?.ui) state.wk.push(make('ui-reviewer', s.slug))
      state.pin = `${s.slug} opened its pull request, both reviews start`
    } else
      state.pin = `${s.slug}: ${s.role === 'reviewer' ? 'code' : 'UI'} review closed`
  }

  /** Dispatches a planner on the next change nothing holds, into Awaiting when it opens on questions and none waits. */
  function dispatch() {
    for (let i = 0; i < data.changes.length; i++) {
      const change = data.changes[cursor++ % data.changes.length]
      if (!change || inFlight(change.slug)) continue
      const s = make('planner', change.slug)
      if (s.aw && !state.aw.length) {
        state.aw.push(s)
        state.pin = `Dispatched ${s.n}, it has questions`
      } else {
        state.wk.push(s)
        state.pin = `Dispatched ${s.n}`
      }
      return
    }
  }

  function event() {
    if (state.aw.length && tick % 3 === 1) {
      const s = state.aw.shift()
      if (!s) return
      s.age = 0
      state.wk.push(s)
      state.pin = `Answers in for ${s.n}, it starts the plan`
    } else if (state.wk.length >= 5 || (state.wk.length > 2 && tick % 2 === 0))
      finish()
    else dispatch()
  }

  /**
   * One tick: one event, a second on every other tick, and half the working
   * sessions step their status line in place, so the view stays busy without a
   * faster clock.
   */
  function step() {
    tick++
    ;[...state.aw, ...state.wk, ...state.dn].forEach((s) => (s.age += 1))
    event()
    if (tick % 2 === 0) event()
    state.wk.forEach((s, i) => {
      if ((i + tick) % 2) return
      const lines = data.lines[s.role].wk
      if (s.li >= lines.length - 1) return
      s.li++
      s.wk = lines[s.li] ?? s.wk
    })
    if (state.dn.length > 8) state.dn.length = 8
    layout()
  }

  /* Hover follows the pointer while rows move under it. */
  let px: number | null = null
  let py = 0
  let hot: Element | null = null
  let frame = 0
  function track() {
    frame = 0
    let found: Element | null = null
    if (px !== null) {
      found =
        document.elementFromPoint(px, py)?.closest('#av-list .r:not(.leave)') ??
        null
    }
    if (found !== hot) {
      hot?.classList.remove('hot')
      found?.classList.add('hot')
      hot = found
    }
    if (px !== null) frame = requestAnimationFrame(track)
  }
  list.addEventListener('pointermove', (event) => {
    px = event.clientX
    py = event.clientY
    if (!frame) frame = requestAnimationFrame(track)
  })
  list.addEventListener('pointerleave', () => {
    px = null
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    hot?.classList.remove('hot')
    hot = null
  })

  /* The block cursor sits where typing starts, measured off a run of mono glyphs. */
  const field = ask.parentElement
  const caret = field?.querySelector<HTMLElement>('.c')
  const ruler = field?.querySelector<HTMLElement>('.mz')
  const hint = field?.querySelector<HTMLElement>('.ph')
  const prompt = ask.closest<HTMLElement>('.prompt')
  const mark = prompt?.querySelector<HTMLElement>('.p')
  const baseHint = hint?.textContent ?? ''
  function place() {
    if (!caret || !ruler) return
    const width = ruler.getBoundingClientRect().width / 20
    const at =
      ask instanceof HTMLInputElement
        ? ask.selectionDirection === 'backward'
          ? ask.selectionStart
          : ask.selectionEnd
        : null
    const index = at ?? (ask instanceof HTMLInputElement ? ask.value.length : 0)
    const left =
      ask instanceof HTMLInputElement ? index * width - ask.scrollLeft : 0
    caret.style.left = `${Math.max(0, left)}px`
  }
  ;['input', 'click', 'focus', 'select', 'keyup'].forEach((name) =>
    ask.addEventListener(name, () => requestAnimationFrame(place)),
  )
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === ask) place()
  })
  ask.addEventListener('blur', () => {
    if (!ask.value && caret) caret.style.left = '0px'
  })

  /*
   * A pointer focus is one that arrives during a press, as on the input, or
   * from a click on the label, which focuses the input after the release. A
   * press released elsewhere clicks no label, so it leaves no flag behind.
   */
  const line = ask.closest('.ask-line')
  let pressed = false
  let clicked = false
  const release = () => (pressed = false)
  line?.addEventListener('pointerdown', () => (pressed = true))
  line?.addEventListener('click', () => (clicked = true))
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)
  ask.addEventListener('focus', () => {
    if ((pressed || clicked) && field) field.dataset.pointer = ''
    clicked = false
  })
  ask.addEventListener('blur', () => {
    clicked = false
    if (field) delete field.dataset.pointer
  })

  /* The `/` menu: the workflow skills first, then the rest of the catalog. */
  const byName = new Map(data.skills.map((s) => [s.name, s]))
  const ordered = [
    ...data.flow.flatMap((name) => {
      const s = byName.get(name)
      return s ? [s] : []
    }),
    ...data.skills.filter((s) => !data.flow.includes(s.name)),
  ]
  let hits = ordered
  let selected = 0
  let shut = false
  let shell = false
  let occlude = 0
  function match() {
    const q =
      ask instanceof HTMLInputElement
        ? ask.value
            .slice(1)
            .toLowerCase()
            .replace(/^canon:/, '')
        : ''
    if (!q) return ordered
    const starts = data.skills.filter((s) => s.name.startsWith(q))
    const holds = data.skills.filter(
      (s) => !s.name.startsWith(q) && s.name.includes(q),
    )
    return [...starts, ...holds]
  }
  function hideUnder() {
    if (!menu || !list) return
    const top = menu.hidden ? Infinity : menu.getBoundingClientRect().top
    list.querySelectorAll('.r, .g').forEach((node) => {
      const reach = node.classList.contains('g') ? 30 : 0
      node.classList.toggle(
        'under',
        node.getBoundingClientRect().bottom + reach > top - 2,
      )
    })
    occlude = menu.hidden ? 0 : requestAnimationFrame(hideUnder)
  }
  function draw() {
    if (!(ask instanceof HTMLInputElement) || !menu) return
    const open =
      !shell &&
      !shut &&
      ask.value.startsWith('/') &&
      !/\s/.test(ask.value) &&
      document.activeElement === ask
    menu.hidden = !open
    ask.setAttribute('aria-expanded', String(open))
    if (open) {
      hits = match()
      if (selected >= hits.length) selected = Math.max(0, hits.length - 1)
      if (!hits.length) {
        menu.innerHTML = `<div class="none">${esc(data.noMatch)}</div>`
        ask.removeAttribute('aria-activedescendant')
      } else {
        menu.innerHTML = hits
          .map(
            (s, i) =>
              `<div class="mi${i === selected ? ' on' : ''}" role="option" id="av-mi-${i}" aria-selected="${i === selected}" data-i="${i}"><span class="mk">❯</span><span class="mn">/canon:${esc(s.name)}</span><span class="md">(canon) ${esc(s.line)}</span></div>`,
          )
          .join('')
        ask.setAttribute('aria-activedescendant', `av-mi-${selected}`)
        const on = menu.children[selected]
        if (on instanceof HTMLElement) {
          const top = on.offsetTop - 4
          const bottom = top + 28
          if (top < menu.scrollTop) menu.scrollTop = top
          else if (bottom > menu.scrollTop + 168) menu.scrollTop = bottom - 168
        }
      }
    } else {
      ask.removeAttribute('aria-activedescendant')
    }
    if (!menu.hidden && !occlude) occlude = requestAnimationFrame(hideUnder)
    if (menu.hidden && occlude) {
      cancelAnimationFrame(occlude)
      occlude = 0
      hideUnder()
    }
  }
  function accept(index: number) {
    const s = hits[index]
    if (!s || !(ask instanceof HTMLInputElement)) return
    ask.value = `/canon:${s.name} `
    shut = true
    draw()
    ask.setSelectionRange(ask.value.length, ask.value.length)
    requestAnimationFrame(place)
  }
  function mode(on: boolean) {
    shell = on
    prompt?.classList.toggle('shell', on)
    if (mark) mark.textContent = on ? '!' : '❯'
    if (hint) hint.textContent = on ? data.shellHint : baseHint
    draw()
  }
  menu.addEventListener('pointerdown', (event) => {
    const item =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('.mi')
        : null
    if (!item) return
    event.preventDefault()
    accept(Number(item.dataset.i))
    ask.focus()
  })
  menu.addEventListener('pointermove', (event) => {
    const item =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('.mi')
        : null
    if (item && Number(item.dataset.i) !== selected) {
      selected = Number(item.dataset.i)
      draw()
    }
  })
  ask.addEventListener('keydown', (event) => {
    const open = !menu.hidden && hits.length > 0
    if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      selected =
        (selected + (event.key === 'ArrowDown' ? 1 : -1) + hits.length) %
        hits.length
      draw()
      return
    }
    if (open && (event.key === 'Tab' || event.key === 'Enter')) {
      event.preventDefault()
      accept(selected)
      return
    }
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault()
      shut = true
      draw()
      return
    }
    if (
      (event.key === 'Escape' || event.key === 'Backspace') &&
      shell &&
      !ask.value
    ) {
      event.preventDefault()
      mode(false)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      ask.value = ''
      shut = false
      selected = 0
      if (shell) mode(false)
      else draw()
    }
    requestAnimationFrame(place)
  })
  ask.addEventListener('input', () => {
    shut = false
    selected = 0
    if (!shell && ask.value.startsWith('!')) {
      ask.value = ask.value.slice(1)
      mode(true)
      ask.setSelectionRange(ask.value.length, ask.value.length)
    }
    draw()
  })
  ask.addEventListener('focus', draw)
  ask.addEventListener('blur', () => {
    menu.hidden = true
    ask.setAttribute('aria-expanded', 'false')
    if (occlude) cancelAnimationFrame(occlude)
    occlude = 0
    hideUnder()
  })

  layout()

  /*
   * The loop halts while the reader holds the view, by pointer or focus,
   * so moving content stops under the person reading it.
   */
  const held = holdOn(
    list.closest('.av'),
    document.querySelector<HTMLButtonElement>('#top .pz'),
  )
  if (!reducedMotion())
    setInterval(() => {
      if (!held()) step()
    }, 2600)
}
