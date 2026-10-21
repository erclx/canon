/**
 * Writes `web/public/previews/design-tokens/index.html` and `design.css` by
 * calling `renderDesignDoc` directly, the in-process pattern
 * `regen-web-favicon.ts` already takes rather than spawning a subprocess.
 *
 * It is embedded live in a landing section as an `<iframe>` rather than a
 * screenshot, since `web/e2e/home.spec.ts` asserts no `<img>` renders inside
 * `<main>`.
 */
import { readFileSync } from 'node:fs'
import { DESIGN_DOCUMENT } from '@/design/regen'
import { renderDesignDoc } from '@/design/render'

const root = new URL('../..', import.meta.url).pathname

const { cssPath } = renderDesignDoc(
  `${root}${DESIGN_DOCUMENT}`,
  `${root}web/public/previews/design-tokens`,
  { embedFonts: true },
)

const css = readFileSync(cssPath, 'utf8')
if (!/--(color|space|type|radius)-/.test(css)) {
  console.error(
    'regen-web-previews: design-tokens render carries no custom properties, refusing an empty preview',
  )
  process.exit(1)
}

console.log('regen-web-previews: wrote web/public/previews/design-tokens/')
