/**
 * Writes web/public/favicon.svg and the README's `mark-color` pair from
 * assets/brand/mark.svg and the mark's own colors in src/design/favicon.ts.
 *
 * The favicon has a CSS context, so it carries a `prefers-color-scheme` branch.
 * The README pair loads as images behind a `<picture>`, so each copy bakes its
 * fills, its c taking GitHub's text color. A source filling `currentColor`
 * resolves to black with no CSS context, so the favicon is written rather than
 * linked, and the source keeps `currentColor` for the inline uses.
 */
import { writeFileSync } from 'node:fs'

import {
  FAVICON_COLORS,
  renderFavicon,
  renderMark,
} from '../../src/design/favicon'

/** GitHub's default foreground on its dark and light grounds. */
const GITHUB_TEXT = { light: '#1f2328', dark: '#f0f6fc' }

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
writeFileSync(
  `${root}assets/brand/mark-color.svg`,
  renderMark(mark, { c: GITHUB_TEXT.dark, pip: FAVICON_COLORS.pip.dark }),
)
writeFileSync(
  `${root}assets/brand/mark-color-light.svg`,
  renderMark(mark, { c: GITHUB_TEXT.light, pip: FAVICON_COLORS.pip.light }),
)
console.log(
  `regen-web-favicon: wrote web/public/favicon.svg and assets/brand/mark-color{,-light}.svg (pip ${FAVICON_COLORS.pip.dark} / ${FAVICON_COLORS.pip.light})`,
)
