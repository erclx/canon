// Lesson kit shell. Load it in <head> after the course's course.js, which sets window.course.
// It sets the theme before first paint, loads the kit's sheets where no board injected them,
// and builds the header, the course sidebar, the rail of the lesson's headings, and the pager.
// It reads the course map from a script rather than fetching a file, since fetch refuses on file://.
;(() => {
  const root = document.documentElement
  const script = document.currentScript
  const onCanvas = window.top !== window
  const themeKey = 'lesson-theme'

  const stored = () => {
    try {
      return localStorage.getItem(themeKey)
    } catch {
      return null
    }
  }

  const store = (theme) => {
    try {
      localStorage.setItem(themeKey, theme)
    } catch {
      // A private window or blocked storage keeps the choice for this page alone.
    }
  }

  // The board owns a frame's theme, so only a page outside the canvas reads the learner's choice.
  if (!onCanvas) {
    const theme = stored()
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
    else if (
      !root.dataset.theme &&
      matchMedia('(prefers-color-scheme: dark)').matches
    )
      root.dataset.theme = 'dark'
  }

  // A board injects the kit's sheets into a frame naming the kit. A standalone page loads them from beside this script.
  const injected =
    getComputedStyle(root).getPropertyValue('--kit-lesson').trim() !== ''
  if (!injected && script) {
    for (const name of ['tokens.css', 'kit.css']) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = new URL(name, script.src).href
      link.setAttribute('blocking', 'render')
      document.head.append(link)
    }
  }

  const svgNs = 'http://www.w3.org/2000/svg'

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag)
    for (const [key, value] of Object.entries(attrs))
      node.setAttribute(key, value)
    node.append(...children)
    return node
  }

  const icon = (cls, paths, extra = {}) => {
    const svg = document.createElementNS(svgNs, 'svg')
    const attrs = {
      class: cls,
      viewBox: '0 0 20 20',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.6',
      'aria-hidden': 'true',
      ...extra,
    }
    for (const [key, value] of Object.entries(attrs))
      svg.setAttribute(key, value)
    for (const d of paths) {
      const path = document.createElementNS(svgNs, 'path')
      path.setAttribute('d', d)
      svg.append(path)
    }
    return svg
  }

  const chevron = (d) =>
    icon('', [d], {
      viewBox: '0 0 16 16',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })

  const isHere = (href) =>
    new URL(href, location.href).pathname === location.pathname

  const themeButton = () => {
    const button = el('button', { class: 'kit-theme', type: 'button' })
    const moon = icon('kit-moon', [
      'M16 12.5A6.5 6.5 0 0 1 7.5 4a6.5 6.5 0 1 0 8.5 8.5Z',
    ])
    const sun = icon(
      'kit-sun',
      [
        'M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4',
        'M13.5 10a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z',
      ],
      { 'stroke-linecap': 'round' },
    )
    button.append(moon, sun)
    const sync = () =>
      button.setAttribute(
        'aria-label',
        root.dataset.theme === 'dark'
          ? 'Switch to light theme'
          : 'Switch to dark theme',
      )
    button.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
      // A frame opened from the board carries an inline color-scheme for its first theme, which would hold form controls on it.
      if (root.style.colorScheme) root.style.colorScheme = root.dataset.theme
      store(root.dataset.theme)
      sync()
    })
    sync()
    return button
  }

  const slug = (text, taken) => {
    const base =
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'section'
    let id = base
    for (let n = 2; taken.has(id) || document.getElementById(id); n += 1)
      id = `${base}-${n}`
    taken.add(id)
    return id
  }

  const buildRail = (main, article) => {
    const headings = [...article.querySelectorAll('h2')]
    if (headings.length < 2) return
    const taken = new Set()
    for (const heading of headings)
      if (!heading.id) heading.id = slug(heading.textContent, taken)
    const links = headings.map((heading) =>
      el('a', { href: `#${heading.id}` }, heading.textContent),
    )
    main.append(
      el(
        'nav',
        { class: 'kit-rail', 'aria-label': 'On this page' },
        el('p', {}, 'On this page'),
        ...links,
      ),
    )
    const mark = (id) =>
      links.forEach((a) => a.classList.toggle('kit-here', a.hash === `#${id}`))
    mark(headings[0].id)
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) mark(entry.target.id)
      },
      { rootMargin: '-80px 0px -70% 0px' },
    )
    headings.forEach((heading) => watch.observe(heading))
  }

  const build = () => {
    const main = document.querySelector('main.kit-lesson')
    if (!main) return
    const article = main.querySelector('.kit-article')
    const course = window.course
    const lessons = Array.isArray(course?.lessons) ? course.lessons : []
    const current = lessons.findIndex((lesson) =>
      (lesson.steps ?? []).some((step) => isHere(step.href)),
    )

    const trail = el('nav', { class: 'kit-trail', 'aria-label': 'Breadcrumb' })
    if (course?.title && current !== -1) {
      const courseLink = course.contents
        ? el('a', { class: 'kit-course', href: course.contents }, course.title)
        : el('span', { class: 'kit-course kit-muted' }, course.title)
      trail.append(
        courseLink,
        el('span', { class: 'kit-sep', 'aria-hidden': 'true' }, '/'),
        el('span', { class: 'kit-now' }, lessons[current].title),
      )
    } else {
      trail.append(
        el('span', { class: 'kit-now' }, course?.title ?? document.title),
      )
    }
    const end = el('div', { class: 'kit-header-end' })
    if (current !== -1)
      end.append(
        el(
          'span',
          { class: 'kit-pos' },
          `Lesson ${current + 1} of ${lessons.length}`,
        ),
      )
    if (!onCanvas) end.append(themeButton())
    const header = el('header', { class: 'kit-header' }, trail, end)

    const shell = el('div', { class: 'kit-shell' })
    main.replaceWith(shell)
    if (lessons.length) {
      const outline = el('ol')
      lessons.forEach((lesson, i) => {
        const number = el('span', {}, String(i + 1))
        const steps = lesson.steps ?? []
        if (!steps.length) {
          outline.append(
            el(
              'li',
              { class: 'kit-later' },
              el(
                'div',
                { class: 'kit-lt' },
                number,
                el(
                  'span',
                  {},
                  lesson.title,
                  el('span', { class: 'kit-soon' }, 'Soon'),
                ),
              ),
            ),
          )
          return
        }
        const links = steps.map((step) =>
          el(
            'a',
            isHere(step.href)
              ? { href: step.href, 'aria-current': 'page' }
              : { href: step.href },
            step.title,
          ),
        )
        outline.append(
          el(
            'li',
            {},
            el(
              'div',
              { class: 'kit-lt' },
              number,
              el('span', {}, lesson.title),
            ),
            el('div', { class: 'kit-steps' }, ...links),
          ),
        )
      })
      const side = el(
        'aside',
        { class: 'kit-side', 'aria-label': 'Course' },
        outline,
      )
      if (course.due) side.append(el('span', { class: 'kit-due' }, course.due))
      shell.append(side)
    }
    shell.append(main)
    document.body.prepend(header, shell)

    if (article) {
      buildRail(main, article)
      const order = [
        ...(course?.contents
          ? [{ title: 'Contents', href: course.contents }]
          : []),
        ...lessons.flatMap((lesson) =>
          (lesson.steps ?? []).map((step) => ({ ...step, lesson })),
        ),
      ]
      const index = order.findIndex((step) => isHere(step.href))
      if (index !== -1) {
        const prev = order[index - 1]
        const next = order[index + 1]
        const here = order[index]
        const label = (step) =>
          step.lesson && here.lesson && step.lesson !== here.lesson
            ? step.lesson.title
            : step.title
        const pager =
          article.querySelector('.kit-pager') ??
          article.appendChild(
            el('nav', { class: 'kit-pager', 'aria-label': 'Lesson steps' }),
          )
        pager.replaceChildren(
          prev
            ? el(
                'a',
                { class: 'kit-button', href: prev.href },
                chevron('M10 3.5 5.5 8l4.5 4.5'),
                label(prev),
              )
            : el('span'),
          ...(next
            ? [
                el(
                  'a',
                  { class: 'kit-button kit-primary', href: next.href },
                  label(next),
                  chevron('M6 3.5 10.5 8 6 12.5'),
                ),
              ]
            : []),
        )
      }
    }

    // A link followed inside a canvas frame would replace the frame, so on the board every page link opens a tab.
    if (onCanvas) {
      for (const a of document.querySelectorAll('a[href]')) {
        if (a.getAttribute('href').startsWith('#')) continue
        a.target = '_blank'
        a.rel = 'noopener'
      }
    }

    const sync = () =>
      header.classList.toggle('kit-scrolled', window.scrollY > 0)
    window.addEventListener('scroll', sync, { passive: true })
    sync()
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', build)
  else build()
})()
