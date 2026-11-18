import { holdOn, pacer, reducedMotion } from '../../../lib/scene'

const section = document.getElementById('health')
const report = section?.querySelector<HTMLElement>('.hl')

if (section && report && !reducedMotion()) {
  const rows = [...report.querySelectorAll<HTMLElement>('.pr')]
  const weeks = [...report.querySelectorAll<HTMLElement>('.wk')]
  const pace = pacer(
    holdOn(report, section.querySelector<HTMLButtonElement>('.pz')),
  )

  async function loop() {
    const generation = pace.next()
    for (;;) {
      report!.classList.add('play')
      for (const node of [...rows, ...weeks]) node.classList.remove('in')
      if (!(await pace.wait(700, generation))) return
      for (const row of rows) {
        row.classList.add('in')
        if (!(await pace.wait(450, generation))) return
      }
      for (const week of weeks) {
        week.classList.add('in')
        if (!(await pace.wait(160, generation))) return
      }
      if (!(await pace.wait(4200, generation))) return
    }
  }

  void loop()
}
