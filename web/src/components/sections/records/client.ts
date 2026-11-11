import { reducedMotion } from '../../../lib/scene'

const section = document.getElementById('records')
const box = section?.querySelector<HTMLElement>('.scrolly')
const stick = box?.querySelector<HTMLElement>('.stick')
const pile = section?.querySelector<HTMLElement>('.pile')
const after = document.getElementById('records-after')

if (section && box && stick && pile && after) {
  const tabs = [...section.querySelectorAll<HTMLButtonElement>('.tabs .pick')]
  const sheets = [...section.querySelectorAll<HTMLElement>('.sheet')]
  const rail = section.querySelector<HTMLElement>('.tabs')
  const caption = section.querySelector<HTMLElement>('.cap')
  const count = section.querySelector<HTMLElement>('.count')
  const pickName = section.querySelector<HTMLElement>('.pk-name')
  const pickCount = section.querySelector<HTMLElement>('.pk-n')
  const pickButton = section.querySelector<HTMLButtonElement>('.pk-btn')
  const pickList = section.querySelector<HTMLElement>('.pk-list')
  const pickItems = [
    ...(pickList?.querySelectorAll<HTMLButtonElement>('button') ?? []),
  ]
  const N = sheets.length
  /** Pixels of scroll per sheet while the stage is pinned. */
  const STEP = 260
  const still = reducedMotion()
  const pin = () => parseFloat(getComputedStyle(stick).top) || 0
  let current = 0
  let lock: ReturnType<typeof setTimeout> | 0 = 0

  function label(index: number) {
    current = index
    tabs.forEach((tab, j) => {
      tab.setAttribute('aria-pressed', String(j === index))
      tab.tabIndex = j === index ? 0 : -1
    })
    const of = `${index + 1} of ${N}`
    if (count) count.textContent = of
    if (pickCount) pickCount.textContent = of
    if (pickName) pickName.textContent = tabs[index]?.textContent ?? ''
    pickItems.forEach((item, j) =>
      item.setAttribute('aria-current', String(j === index)),
    )
    const sheet = sheets[index]
    if (caption && sheet) {
      caption.replaceChildren()
      const name = document.createElement('b')
      name.textContent = sheet.dataset.name ?? ''
      const by = document.createElement('span')
      by.textContent = sheet.dataset.by ?? ''
      caption.append(name, by)
    }
  }

  /** What a sheet shows only at the front: its content, and an editor's bar and explorer. */
  const faces = (sheet: HTMLElement) => [
    ...sheet.querySelectorAll<HTMLElement>(
      ':scope > :is(.in, .wbar, .explorer)',
    ),
  ]

  function place(sheet: HTMLElement, depth: number, lift = 0) {
    const o = Math.min(depth, 2)
    sheet.style.top = `${o * 12 + lift}px`
    sheet.style.bottom = `${24 - o * 12 - lift}px`
    sheet.style.left = sheet.style.right = `${o * 18}px`
    sheet.style.backgroundColor =
      o < 0.5 ? '' : o < 1.5 ? 'var(--back1)' : 'var(--back2)'
  }

  /** Settles the stack on one sheet, as a pick or the reduced-motion path does. */
  function show(index: number) {
    label(index)
    sheets.forEach((sheet, j) => {
      sheet.style.transition = ''
      const depth = (j - index + N) % N
      place(sheet, depth)
      sheet.style.opacity = depth < 3 ? '1' : '0'
      sheet.style.zIndex = String(N - depth)
      faces(sheet).forEach((face) => {
        face.style.transition = ''
        face.style.opacity = depth ? '0' : '1'
      })
      sheet.setAttribute('aria-hidden', String(depth !== 0))
      sheet.inert = depth !== 0
    })
  }

  /** Moves the stack by the scroll, so stopping halfway leaves it halfway. */
  function scrub() {
    const top = box!.getBoundingClientRect().top - pin()
    const t = Math.max(0, Math.min(N - 1, -top / STEP))
    const a = Math.floor(t)
    const p = t - a
    const r = Math.round(t)
    sheets.forEach((sheet, j) => {
      sheet.style.transition = 'none'
      const d = j - a
      let depth = 0
      let opacity = 1
      let content = 0
      let lift = 0
      let z = N - Math.max(d, 0)
      if (d < 0) {
        opacity = 0
        lift = -26
        z = 0
      } else if (d === 0) {
        lift = -26 * p
        content = p < 0.5 ? 1 : 0
        opacity = p < 0.5 ? 1 : Math.max(0, 1 - (p - 0.5) * 2)
        z = p < 0.5 ? N + 1 : N - 1
      } else {
        depth = d - p
        opacity = depth < 2 ? 1 : Math.max(0, 3 - depth)
        content = d === 1 && p >= 0.5 ? 1 : 0
      }
      place(sheet, depth, lift)
      sheet.style.opacity = String(opacity)
      sheet.style.zIndex = String(z)
      faces(sheet).forEach((face) => {
        face.style.transition = 'none'
        face.style.opacity = String(content)
      })
      sheet.setAttribute('aria-hidden', String(j !== r))
      sheet.inert = j !== r
    })
    if (r !== current) label(r)
  }

  function size() {
    if (still) {
      box!.style.height = 'auto'
      after!.style.height = '1px'
      return
    }
    box!.style.height = `${stick!.offsetHeight + STEP * (N - 1)}px`
    after!.style.height = '160px'
  }

  function pick(index: number) {
    if (still) {
      show(index)
      return
    }
    const top = box!.getBoundingClientRect().top - pin()
    const y = window.scrollY + top + index * STEP
    const pinned = top <= 0.5 && top > -(STEP * (N - 1)) - 0.5
    show(index)
    if (lock) clearTimeout(lock)
    lock = setTimeout(() => (lock = 0), pinned ? 80 : 900)
    window.scrollTo({ top: y, behavior: pinned ? 'instant' : 'smooth' })
  }

  tabs.forEach((tab) =>
    tab.addEventListener('click', () => pick(Number(tab.dataset.i))),
  )
  rail?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = (current + (event.key === 'ArrowRight' ? 1 : -1) + N) % N
    pick(next)
    tabs[next]?.focus()
  })

  let frame = 0
  window.addEventListener(
    'scroll',
    () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (lock) return
        if (!still) scrub()
      })
    },
    { passive: true },
  )
  window.addEventListener('resize', size)
  size()
  show(0)
  if (!still) requestAnimationFrame(scrub)

  /* The phone picker: the list of sheets behind one button. */
  function openList(open: boolean) {
    if (!pickList || !pickButton) return
    pickList.hidden = !open
    pickButton.setAttribute('aria-expanded', String(open))
    if (open)
      (
        pickList.querySelector<HTMLElement>('[aria-current="true"]') ??
        pickItems[0]
      )?.focus()
  }
  pickButton?.addEventListener('click', () =>
    openList(pickList?.hidden ?? false),
  )
  pickItems.forEach((item) =>
    item.addEventListener('click', () => {
      openList(false)
      pickButton?.focus()
      pick(Number(item.dataset.j))
    }),
  )
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && pickList && !pickList.hidden) {
      openList(false)
      pickButton?.focus()
    }
  })

  /* The rendered and source views, one switch for the whole stack. */
  const views = [...section.querySelectorAll<HTMLButtonElement>('.vt button')]
  function setView(view: string) {
    pile!.dataset.view = view
    views.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.v === view)),
    )
  }
  views.forEach((button) =>
    button.addEventListener('click', () => setView(button.dataset.v ?? 'src')),
  )
  setView('src')

  /* A checkbox ticks in both views of its file at once. */
  section
    .querySelectorAll<HTMLElement>('.sheet .file, .sheet.br .cmt')
    .forEach((part) => {
      const set = (key: string, on: boolean) => {
        part
          .querySelectorAll<HTMLInputElement>(`.cbx[data-ck="${key}"]`)
          .forEach((box) => (box.checked = on))
        part
          .querySelectorAll<HTMLElement>(`.rk[data-ck="${key}"]`)
          .forEach((mark) => {
            mark.setAttribute('aria-checked', String(on))
            mark.textContent = on ? '[x]' : '[ ]'
          })
      }
      part
        .querySelectorAll<HTMLInputElement>('.cbx')
        .forEach((box) =>
          box.addEventListener('change', () =>
            set(box.dataset.ck ?? '', box.checked),
          ),
        )
      part
        .querySelectorAll<HTMLElement>('.rk')
        .forEach((mark) =>
          mark.addEventListener('click', () =>
            set(
              mark.dataset.ck ?? '',
              mark.getAttribute('aria-checked') !== 'true',
            ),
          ),
        )
    })

  /* An editor sheet's file tabs. */
  section.querySelectorAll<HTMLElement>('.sheet.ed').forEach((sheet) => {
    const fileTabs = [...sheet.querySelectorAll<HTMLElement>('.ftab')]
    const files = [...sheet.querySelectorAll<HTMLElement>('.file')]
    const entries = [
      ...sheet.querySelectorAll<HTMLElement>('.explorer [data-f]'),
    ]
    const open = (k: number) => {
      fileTabs.forEach((tab, j) => {
        tab.setAttribute('aria-selected', String(j === k))
        tab.tabIndex = j === k ? 0 : -1
      })
      files.forEach((file, j) => (file.hidden = j !== k))
      entries.forEach((entry) =>
        entry.classList.toggle('on', Number(entry.dataset.f) === k),
      )
    }
    fileTabs.forEach((tab, k) => {
      tab.addEventListener('click', () => open(k))
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
        event.preventDefault()
        const next =
          (k + (event.key === 'ArrowRight' ? 1 : -1) + fileTabs.length) %
          fileTabs.length
        open(next)
        fileTabs[next]?.focus()
      })
    })
    open(
      Math.max(
        0,
        fileTabs.findIndex(
          (tab) => tab.getAttribute('aria-selected') === 'true',
        ),
      ),
    )
  })
}
