import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FAVICON_COLORS, renderFavicon } from '@/design/favicon'
import { PROJECT_ROOT } from '@/roots/project'

import { brandFavicon } from './brand-favicon'

describe('brandFavicon', () => {
  it('should render the brand mark with the favicon colors', () => {
    const mark = readFileSync(
      join(PROJECT_ROOT, 'assets/brand/mark.svg'),
      'utf8',
    )

    expect(brandFavicon()).toBe(renderFavicon(mark, FAVICON_COLORS))
  })
})
