/**
 * What reveals feedback in a lesson written with button options. The radio
 * shape needs none of it.
 */
export function quiz(): void {
  document.querySelectorAll<HTMLElement>('.q').forEach(function (q) {
    var f = q.querySelector('.fb') as HTMLElement
    q.querySelectorAll<HTMLElement>('.opt').forEach(function (b) {
      b.addEventListener('click', function () {
        if (f.classList.contains('show')) return
        q.querySelectorAll<HTMLElement>('.opt').forEach(function (o) {
          o.dataset.state =
            o.dataset.a === '1' ? 'right' : o === b ? 'chosen' : 'wrong'
        })
        f.classList.add('show')
      })
    })
  })
}
