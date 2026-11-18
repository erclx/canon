import { holdOn, pacer, reducedMotion } from '../../../lib/scene'

const section = document.getElementById('drive')
const board = section?.querySelector<HTMLElement>('.dr')

if (section && board && !reducedMotion()) {
  const pace = pacer(
    holdOn(board, section.querySelector<HTMLButtonElement>('.pz')),
  )

  async function loop() {
    const generation = pace.next()
    for (;;) {
      board!.classList.remove('on')
      if (!(await pace.wait(1800, generation))) return
      board!.classList.add('on')
      if (!(await pace.wait(3400, generation))) return
    }
  }

  void loop()
}
