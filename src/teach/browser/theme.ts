export function theme(): void {
  var r = document.documentElement
  try {
    var s = localStorage.getItem('course-theme')
    if (s) r.dataset.theme = s
  } catch (e) {}
  document.addEventListener('click', function (e) {
    var b = (e.target as Element).closest('.theme')
    if (!b) return
    var d =
      r.dataset.theme === 'dark' ||
      (!r.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
    r.dataset.theme = d ? 'light' : 'dark'
    try {
      localStorage.setItem('course-theme', r.dataset.theme)
    } catch (e) {}
  })
}
