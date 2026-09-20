/**
 * Writes web/public/favicon.svg from assets/brand/mark.svg and the favicon's
 * own colors in src/design/favicon.ts, apart from the page accent tokens.
 *
 * The page is the fourth surface to carry the mark as a favicon and the only
 * one that can answer for itself. `regen-hero.sh` and `src/design/render.ts`
 * each bake a single literal, because both embed the mark as a data URI and a
 * data URI has no CSS context. A file served at its own URL does have one, so
 * this copy carries a `prefers-color-scheme` branch and tracks the reader's
 * theme rather than picking one accent for everybody.
 *
 * `web/public/favicon.svg` was a symlink to the source before this, and the
 * source fills `currentColor`, which resolves to black with no CSS context.
 * That is what painted the tab icon black on every surface the page reaches.
 * The source keeps `currentColor`, since the hero topbar embeds the same file
 * inline and wants it to inherit.
 */
import { writeFileSync } from 'node:fs'

import { FAVICON_COLORS, renderFavicon } from '../../src/design/favicon'

const root = new URL('../..', import.meta.url).pathname

const mark = (await Bun.file(`${root}assets/brand/mark.svg`).text()).trim()
if (!mark) {
  console.error('regen-web-favicon: assets/brand/mark.svg read empty')
  process.exit(1)
}

writeFileSync(
  `${root}web/public/favicon.svg`,
  renderFavicon(mark, FAVICON_COLORS),
)
console.log(
  `regen-web-favicon: wrote web/public/favicon.svg (${FAVICON_COLORS.light} / ${FAVICON_COLORS.dark})`,
)
