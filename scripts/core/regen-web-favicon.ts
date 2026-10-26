/**
 * Writes web/public/favicon.svg and the README's `mark-color` pair from
 * assets/brand/mark.svg and the mark's own colors in src/design/favicon.ts,
 * apart from the page accent tokens.
 *
 * The favicon is served at its own URL, so it has a CSS context and carries a
 * `prefers-color-scheme` branch over its tile, c, and pip. The README pair is
 * loaded as an image behind a `<picture>`, which picks the file by theme, so
 * each copy bakes its fills. Its c takes GitHub's own text color rather than
 * canon's ink, since GitHub's ground is what it has to clear.
 *
 * `web/public/favicon.svg` was a symlink to the source before this, and the
 * source fills `currentColor`, which resolves to black with no CSS context.
 * That is what painted the tab icon black on every surface the page reaches.
 * The source keeps `currentColor`, since the nav and the hero topbar inline it
 * and want it to inherit.
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
