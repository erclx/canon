/**
 * The panel's state, settled before the first paint rather than after it. An
 * arm that set the narrow default afterwards slid the panel in and back out on
 * every load, and a restored custom width animated in from the default.
 *
 * A listing page starts shut because the body already lists what the panel
 * would, and a lesson starts open because there the panel is the only
 * cross-lesson navigation on the page. A stored preference beats both. A count
 * threshold on its own was built and reverted, since it hides the panel on a
 * lesson too.
 */
export function head(page: 'index' | 'lesson', breakpoint: number): void {
  var r = document.documentElement
  var s: string | null = null
  r.dataset.page = page
  if (matchMedia('(max-width: ' + breakpoint + 'px)').matches) {
    r.classList.add('sb-shut')
    return
  }
  try {
    s = localStorage.getItem('teach-sb')
  } catch (e) {}
  var idx = r.dataset.page === 'index'
  if (s === 'shut' || (s === null && idx)) r.classList.add('sb-shut')
  var w: string | null = null
  try {
    w = localStorage.getItem('teach-sb-w')
  } catch (e) {}
  if (w) r.style.setProperty('--sb-w', w + 'px')
}
