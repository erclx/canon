import { describe, expect, it } from 'vitest'

import { records, renderedPage } from './records'

const sheet = (crumb: string, ren: string) =>
  `<div class="tb"></div><div class="file" data-f="0"><div class="crumb">${crumb}</div><div class="bd"><div class="v-src"><pre class="raw">src</pre></div><div class="v-view md"><div class="ren">${ren}</div></div><p class="also">Also</p></div></div>`

describe('renderedPage', () => {
  it('should read the path from the crumb and the body from the rendered view', () => {
    const page = renderedPage(
      sheet(
        '.canon <i>›</i> plans <i>›</i> feature-x.md',
        '<h4 class="t">Feature</h4><div class="pair"><span>a</span></div><p>after</p>',
      ),
    )

    expect(page.path).toBe('.canon/plans/feature-x.md')
    expect(page.body).toBe(
      '<h4 class="t">Feature</h4><div class="pair"><span>a</span></div><p>after</p>',
    )
  })

  it('should read the address of a browser page with no crumb', () => {
    const page = renderedPage(
      '<div class="bbar"><div class="url">github.com/you/canon/pull/412</div></div><div class="v-view gmd"><div class="ren"><p>x</p></div></div>',
    )

    expect(page.path).toBe('github.com/you/canon/pull/412')
    expect(page.body).toBe('<p>x</p>')
  })

  it('should draw each checkbox as a mark naming its state', () => {
    const page = renderedPage(
      sheet(
        '.canon <i>›</i> tasks <i>›</i> t.md',
        '<input type="checkbox" class="cbx" data-ck="0" checked /><input type="checkbox" class="cbx" data-ck="1" />',
      ),
    )

    expect(page.body).toBe(
      '<span class="box x" role="img" aria-label="done"></span><span class="box" role="img" aria-label="not done"></span>',
    )
  })

  it('should read a page from every record sheet', () => {
    const pages = records.map((record) => renderedPage(record.html))

    expect(pages).toHaveLength(12)
    expect(pages.filter((page) => !page.path || !page.body)).toEqual([])
    expect(pages.filter((page) => page.body.includes('<input'))).toEqual([])
  })
})
