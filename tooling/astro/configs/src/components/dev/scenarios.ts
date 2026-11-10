// The client half of `scenarios.astro`. The shell passes values, never source,
// on a carrier element's data attributes, since `define:vars` would force the
// script inline and out of reach of the stack's lint, format, and type check.

import switcherCss from './scenarios.css?inline'

interface Arm {
  readonly id: string
  readonly label: string
  readonly css?: string
}

const CARRIER = '[data-scenario-carrier]'

let styled = false

const style = (): void => {
  if (styled) return
  styled = true
  const sheet = document.createElement('style')
  sheet.textContent = switcherCss
  document.head.appendChild(sheet)
}

const mount = (
  param: string,
  arms: readonly Arm[],
  active: Arm,
  mountInto: string | undefined,
): void => {
  const host = mountInto ? document.querySelector(mountInto) : document.body
  if (!host) return
  style()
  const bar = document.createElement('div')
  bar.setAttribute('data-scenario-switcher', '')
  for (const arm of arms) {
    const link = document.createElement('a')
    link.href = `?${param}=${arm.id}`
    link.textContent = arm.label
    if (arm.id === active.id) link.setAttribute('data-current', 'true')
    bar.appendChild(link)
  }
  host.appendChild(bar)
}

const start = (carrier: HTMLElement): void => {
  const { param, arms: armsJson, mountInto } = carrier.dataset
  if (!param || !armsJson) return
  const arms = JSON.parse(armsJson) as readonly Arm[]
  const wanted = new URLSearchParams(location.search).get(param)
  const active = arms.find((arm) => arm.id === wanted)
  if (!active) return

  document.documentElement.dataset[param] = active.id

  if (active.css) {
    const style = document.createElement('style')
    style.textContent = active.css
    document.head.appendChild(style)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () =>
      mount(param, arms, active, mountInto),
    )
  } else {
    mount(param, arms, active, mountInto)
  }
}

for (const carrier of document.querySelectorAll<HTMLElement>(CARRIER)) {
  start(carrier)
}
