import { focusLine } from '@/teach/browser/focus-line'

/**
 * `focusLine` is declared in the page ahead of this function by `compile`, so
 * the call below reaches the one source the unit test exercises.
 */
export function sidebar(breakpoint: number): void {
  var root = document.documentElement
  var found = document.querySelector<HTMLElement>('.sb')
  if (!found) return
  var panel = found

  var fold = document.querySelector<HTMLElement>('.sb-fold')
  var narrow = matchMedia('(max-width: ' + breakpoint + 'px)')

  var FOCUSABLE =
    "a[href], button:not([disabled]), summary, input, [tabindex]:not([tabindex='-1'])"

  function panelStops() {
    return Array.prototype.slice
      .call(panel.querySelectorAll(FOCUSABLE))
      .filter(function (el: HTMLElement) {
        return el.offsetParent !== null || el === document.activeElement
      }) as HTMLElement[]
  }

  /* The focus return belongs here rather than on the close control, because all
     three routes out land here and only one of them used to move focus. The
     shut panel takes visibility: hidden 180ms later, so a reader who pressed
     Escape kept focus on a control that then disappeared under them and the
     browser dropped them at the top of the document. */
  function shut() {
    var inside = panel.contains(document.activeElement)
    root.classList.add('sb-shut')
    try {
      localStorage.setItem('teach-sb', 'shut')
    } catch (e) {}
    if (inside && fold) fold.focus()
  }

  if (fold)
    fold.addEventListener('click', function () {
      root.classList.toggle('sb-shut')
      try {
        localStorage.setItem(
          'teach-sb',
          root.classList.contains('sb-shut') ? 'shut' : 'open',
        )
      } catch (e) {}
      /* An overlay takes focus with it. Without this a keyboard reader opens the
       panel and goes on tabbing through the lesson behind the scrim. */
      if (!narrow.matches || root.classList.contains('sb-shut')) return
      var first = panel.querySelector<HTMLElement>('a, button, summary, input')
      if (first) first.focus()
    })

  var scrim = document.createElement('div')
  scrim.className = 'sb-scrim'
  document.body.appendChild(scrim)
  scrim.addEventListener('click', shut)

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && narrow.matches) {
      shut()
      return
    }

    /* The scrim says the lesson is unavailable, so Tab must not reach it.
       Moving focus into the panel on open only defers this by however many
       controls the panel holds. */
    if (e.key !== 'Tab') return
    if (!narrow.matches || root.classList.contains('sb-shut')) return

    var stops = panelStops()
    if (!stops.length) return

    var first = stops[0]
    var last = stops[stops.length - 1]

    if (!panel.contains(document.activeElement)) {
      ;(e.shiftKey ? last : first).focus()
      e.preventDefault()
    } else if (e.shiftKey && document.activeElement === first) {
      last.focus()
      e.preventDefault()
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus()
      e.preventDefault()
    }
  })

  /* The panel covers the masthead and the toggle that opened it, so it carries
     its own way out rather than leaving the scrim as the only route. */
  var close = document.createElement('button')
  close.type = 'button'
  close.className = 'sb-close'
  close.setAttribute('aria-label', 'Close the course panel')
  close.textContent = '×'
  close.addEventListener('click', shut)
  panel.appendChild(close)

  var MIN = 208,
    MAX = 296,
    DEF = 256
  var grip = document.querySelector<HTMLElement>('.sb-grip')
  var lastWidth = parseInt(root.style.getPropertyValue('--sb-w'), 10) || DEF

  function setWidth(px: number, save: boolean) {
    var w = Math.max(MIN, Math.min(MAX, Math.round(px)))
    root.style.setProperty('--sb-w', w + 'px')
    lastWidth = w
    if (save) {
      try {
        localStorage.setItem('teach-sb-w', String(w))
      } catch (e) {}
    }
  }

  if (grip) {
    var handle = grip
    var dragging = false
    handle.addEventListener('pointerdown', function (e) {
      dragging = true
      handle.setPointerCapture(e.pointerId)
      root.classList.add('sb-drag')
      e.preventDefault()
    })
    handle.addEventListener('pointermove', function (e) {
      if (dragging) setWidth(e.clientX, false)
    })
    handle.addEventListener('pointerup', function (e) {
      if (!dragging) return
      dragging = false
      root.classList.remove('sb-drag')
      handle.releasePointerCapture(e.pointerId)
      setWidth(lastWidth, true)
    })
    handle.addEventListener('dblclick', function () {
      setWidth(DEF, true)
    })
    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 32 : 8
      if (e.key === 'ArrowLeft') {
        setWidth(lastWidth - step, true)
        e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        setWidth(lastWidth + step, true)
        e.preventDefault()
      } else if (e.key === 'Home') {
        setWidth(DEF, true)
        e.preventDefault()
      }
    })
  }

  var filter = document.querySelector<HTMLInputElement>('.sb-filter input')
  if (filter) {
    var box = filter
    box.addEventListener('input', function () {
      var q = box.value.trim().toLowerCase()
      document
        .querySelectorAll<HTMLElement>('.sb-list > li')
        .forEach(function (li) {
          li.classList.toggle(
            'hide',
            q !== '' &&
              (li.textContent as string).toLowerCase().indexOf(q) === -1,
          )
        })
    })
  }

  var slot = document.querySelector('.sb-out-slot')
  var hs = Array.prototype.slice.call(
    document.querySelectorAll('main h2'),
  ) as HTMLElement[]
  var links: HTMLElement[] = []

  if (slot && hs.length) {
    var list = document.createElement('ul')
    list.className = 'sb-out'
    hs.forEach(function (h, i) {
      if (!h.id) h.id = 's' + i
      var li = document.createElement('li')
      var a = document.createElement('a')
      a.href = '#' + h.id
      a.textContent = (h.textContent as string).trim()
      li.appendChild(a)
      list.appendChild(li)
    })
    ;(slot.parentNode as Node).replaceChild(list, slot)
    links = Array.prototype.slice.call(list.querySelectorAll('a'))
  }

  /* The bar reports position inside the lesson, which nothing reported before
     the segmented track retired. The breadcrumb's last segment carries the
     lesson title once the real one has scrolled off. */
  var bar = document.querySelector<HTMLElement>('.bar')
  var here = document.querySelector('.crumb-here')
  var h1 = document.querySelector('main h1')
  var counter = here ? (here.textContent as string).trim() : ''
  var title = h1 ? (h1.textContent as string).trim() : ''

  function sync() {
    var max = document.documentElement.scrollHeight - innerHeight
    if (bar) {
      var pct = max > 0 ? Math.min(100, Math.max(0, (scrollY / max) * 100)) : 0
      bar.style.setProperty('--read', pct.toFixed(1) + '%')
    }

    if (here && h1 && title && counter) {
      var want = h1.getBoundingClientRect().bottom < 56 ? title : counter
      if (here.textContent !== want) here.textContent = want
    }

    if (links.length) {
      /* Nothing is marked until a heading has actually passed the line, so the
         first section is not reported as current while the title is on screen. */
      var best = -1
      var line = focusLine(scrollY, max, innerHeight)
      for (var i = 0; i < hs.length; i++) {
        if (hs[i].getBoundingClientRect().top <= line) best = i
      }
      links.forEach(function (l, j) {
        l.classList.toggle('on', j === best)
      })
    }
  }

  addEventListener('scroll', sync, { passive: true })
  addEventListener('resize', sync)
  sync()
}
