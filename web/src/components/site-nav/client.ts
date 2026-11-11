const root = document.documentElement
const toggle = document.querySelector<HTMLButtonElement>('.theme-toggle')

function label() {
  if (!toggle) return
  const dark = root.getAttribute('data-theme') === 'dark'
  toggle.setAttribute(
    'aria-label',
    (dark ? toggle.dataset.toLight : toggle.dataset.toDark) ?? '',
  )
}

toggle?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  root.setAttribute('data-theme', next)
  try {
    localStorage.setItem('canon-theme', next)
  } catch {
    // A browser refusing storage still gets the theme for this page view.
  }
  label()
})
label()

/* The Sections menu: Escape and a click outside close it, and focus returns to its button. */
const button = document.querySelector<HTMLButtonElement>('.nbtn')
const panel = document.getElementById('nav-panel')
if (button && panel) {
  const isOpen = () => button.getAttribute('aria-expanded') === 'true'
  const set = (open: boolean) =>
    button.setAttribute('aria-expanded', String(open))
  button.addEventListener('click', () => set(!isOpen()))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      set(false)
      button.focus()
    }
  })
  document.addEventListener('click', (event) => {
    const target = event.target
    if (
      isOpen() &&
      target instanceof Node &&
      !button.contains(target) &&
      !panel.contains(target)
    )
      set(false)
  })
  panel
    .querySelectorAll('a')
    .forEach((link) => link.addEventListener('click', () => set(false)))
}

/* The section in view marks its link in the bar and in the menu. */
const links = [
  ...document.querySelectorAll<HTMLAnchorElement>('[data-section]'),
]
const targets = [
  ...new Set(links.map((link) => link.dataset.section ?? '')),
].flatMap((id) => {
  const node = document.getElementById(id)
  return node ? [node] : []
})
const visible = new Set<string>()
const mark = () => {
  const current = targets.find((node) => visible.has(node.id))?.id
  links.forEach((link) => {
    if (link.dataset.section === current)
      link.setAttribute('aria-current', 'true')
    else link.removeAttribute('aria-current')
  })
}
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visible.add(entry.target.id)
      else visible.delete(entry.target.id)
    })
    mark()
  },
  { rootMargin: '-40% 0px -55% 0px' },
)
targets.forEach((node) => observer.observe(node))
