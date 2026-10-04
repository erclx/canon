import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FAVICON_COLORS, renderFavicon } from '@/design/favicon'
import { PROJECT_ROOT } from '@/roots/project'

const BRAND_MARK = 'assets/brand/mark.svg'

/**
 * The brand icon, built from the mark and the favicon's own pair, the same two
 * inputs `web/public/favicon.svg` is generated from. Every surface that shows
 * the icon reads it here rather than keeping a copy that drifts from the mark.
 * It sits apart from `favicon.ts` because the card build imports that module
 * through an `@` alias pointed at `web/src`, so it must import nothing.
 */
export function brandFavicon(): string {
  const mark = readFileSync(join(PROJECT_ROOT, BRAND_MARK), 'utf8')
  return renderFavicon(mark, FAVICON_COLORS)
}
