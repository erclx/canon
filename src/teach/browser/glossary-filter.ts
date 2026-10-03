export function glossaryFilter(): void {
  var input = document.getElementById('gfilter') as HTMLInputElement | null
  var list = document.getElementById('gloss')
  var count = document.getElementById('gloss-count')
  if (!input || !list) return
  var field = input
  var terms = list
  function updateGroups() {
    terms.querySelectorAll('.gloss-group').forEach(function (heading) {
      var el = heading.nextElementSibling as HTMLElement | null
      var any = false
      while (el && !el.classList.contains('gloss-group')) {
        if (el.style.display !== 'none') any = true
        el = el.nextElementSibling as HTMLElement | null
      }
      ;(heading as HTMLElement).style.display = any ? '' : 'none'
    })
  }
  field.addEventListener('input', function () {
    var q = field.value.toLowerCase()
    var n = 0
    terms.querySelectorAll<HTMLElement>('.gterm').forEach(function (entry) {
      var match = (entry.textContent as string).toLowerCase().includes(q)
      entry.style.display = match ? '' : 'none'
      if (match) n++
    })
    terms.classList.toggle('none', n === 0)
    updateGroups()
    if (count) {
      var total = terms.querySelectorAll('.gterm').length
      count.textContent =
        (n === total ? total : n + ' of ' + total) +
        (total === 1 ? ' term' : ' terms')
    }
  })
  var clear = terms.querySelector('.clear')
  if (clear) {
    clear.addEventListener('click', function () {
      field.value = ''
      field.dispatchEvent(new Event('input'))
      field.focus()
    })
  }
}
