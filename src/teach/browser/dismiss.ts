export function dismiss(): void {
  var MENUS = 'details.jump[open], details.sb-ws[open]'

  function close(except: Element | null) {
    document.querySelectorAll<HTMLDetailsElement>(MENUS).forEach(function (d) {
      if (d !== except) d.open = false
    })
  }
  document.addEventListener('click', function (e) {
    var inside = (e.target as Element).closest('details.jump, details.sb-ws')
    close(inside)
  })
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return
    var open = document.querySelector<HTMLDetailsElement>(MENUS)
    if (!open) return
    open.open = false
    var s = open.querySelector('summary')
    if (s) s.focus()
  })

  /* Hover intent on the breadcrumb only. The sidebar's workspace switcher stays
     click-only on purpose: its panel opens directly over the lesson list, which
     is where the pointer is headed, so hovering it would cover the thing
     being reached for. The breadcrumb's panel drops over body text instead. */
  var OPEN = 120,
    SHUT = 260

  document
    .querySelectorAll<HTMLDetailsElement>('details.jump')
    .forEach(function (d) {
      var host = d.closest('.crumb-item') || d
      var timer: ReturnType<typeof setTimeout> | undefined
      var openedByHover = false

      function arm(want: boolean) {
        clearTimeout(timer)
        timer = setTimeout(
          function () {
            if (want) close(d)
            d.open = want
          },
          want ? OPEN : SHUT,
        )
      }

      host.addEventListener('mouseenter', function () {
        if (!d.open) openedByHover = true
        arm(true)
      })
      host.addEventListener('mouseleave', function () {
        openedByHover = false
        arm(false)
      })
      /* Keeps it open while the pointer is inside the panel, without cancelling a
       pending open, which is what silently disabled this on one of two menus. */
      d.addEventListener('mouseenter', function () {
        if (d.open) clearTimeout(timer)
      })

      /* Hover and click were wired to one disclosure and fought: hover opened the
       panel, then the summary's native click toggled what hover had already
       opened, so reaching for an item shut it. A click on a panel hover opened
       keeps it open, and a second click closes. The click path stays live for
       touch, where no hover exists, and for the keyboard, where Enter is the
       only way in. */
      var summary = d.querySelector('summary')
      if (summary)
        summary.addEventListener('click', function (e) {
          if (d.open && openedByHover) {
            e.preventDefault()
            openedByHover = false
          }
        })
    })
}
