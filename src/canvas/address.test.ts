// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  addressOf,
  documentElements,
  elementAt,
  excerpt,
  HASH_ATTRIBUTE,
  IMPLIED_ATTRIBUTE,
  resolveAddress,
  sourceElements,
  TOKENS_ATTRIBUTE,
} from '@/canvas/address'
import { injectTokens } from '@/canvas/server'

function page(body: string, head = '<title>t</title>'): string {
  return `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`
}

/** What the shell sees: the served file, parsed the way a browser parses it. */
function browserTags(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return documentElements(doc).map((element) => element.tagName.toLowerCase())
}

function serverTags(html: string): string[] {
  return sourceElements(html).map((element) => element.tag)
}

const NESTED = page(
  '<main><section class="hero"><h1>Title</h1><p>Lead <a href="#">link</a></p></section><ul><li>One</li><li>Two</li></ul></main>',
)
const VOIDS = page(
  '<form><label>Name<input name="n"></label><br><img src="a.png" alt=""><hr></form>',
  '<meta charset="utf-8"><meta name="viewport" content="width=device-width">',
)
const COMMENTS = page(
  '<!-- <div>hidden</div> --><div><!-- x --><span>a</span></div>',
)
const RAW_TEXT = page(
  '<script>const tag = "<div><p>";</script><style>p > a { color: red }</style><p>after</p>',
)
const TEMPLATE = page(
  '<template id="row"><li><span>item</span></li></template><ul><li>One</li></ul>',
)
const BARE_TABLE = page('<table><tr><td>a</td></tr></table>')
const EXPLICIT_TABLE = page('<table><tbody><tr><td>a</td></tr></tbody></table>')

describe('sourceElements', () => {
  it('should count nested elements in the order the browser does', () => {
    expect(serverTags(NESTED)).toEqual(browserTags(NESTED))
  })

  it('should count void elements in the order the browser does', () => {
    expect(serverTags(VOIDS)).toEqual(browserTags(VOIDS))
  })

  it('should skip markup inside comments the way the browser does', () => {
    expect(serverTags(COMMENTS)).toEqual(browserTags(COMMENTS))
  })

  it('should skip markup inside script and style the way the browser does', () => {
    expect(serverTags(RAW_TEXT)).toEqual(browserTags(RAW_TEXT))
  })

  it('should skip the content of a template the way the browser does', () => {
    expect(serverTags(TEMPLATE)).toEqual(browserTags(TEMPLATE))
  })

  it('should agree on a table that states its tbody', () => {
    expect(serverTags(EXPLICIT_TABLE)).toEqual(browserTags(EXPLICIT_TABLE))
  })

  it('should read classes and a text excerpt for each element', () => {
    const hero = sourceElements(NESTED).find(
      (element) => element.tag === 'section',
    )

    expect(hero?.classes).toEqual(['hero'])
    expect(hero?.text).toBe('Title Lead link')
  })

  it('should leave script source out of an excerpt', () => {
    const body = sourceElements(RAW_TEXT).find(
      (element) => element.tag === 'body',
    )

    expect(body?.text).toBe('after')
  })
})

describe('documentElements', () => {
  it('should skip the token stylesheet the server injects', () => {
    const served = page(
      '<p>a</p>',
      `<style ${TOKENS_ATTRIBUTE}>:root{}</style><title>t</title>`,
    )
    const source = page('<p>a</p>')

    expect(browserTags(served)).toEqual(serverTags(source))
  })

  it('should skip a wrapper the server marked as implied', () => {
    const served = `<html ${IMPLIED_ATTRIBUTE}><head ${IMPLIED_ATTRIBUTE}><style ${TOKENS_ATTRIBUTE}></style></head><body ${IMPLIED_ATTRIBUTE}><h1>Bare</h1>`

    expect(browserTags(served)).toEqual(['h1'])
  })
})

describe('addressOf', () => {
  it('should carry the file hash the server stamped on the frame', () => {
    const served = page(
      '<p>a</p>',
      `<style ${TOKENS_ATTRIBUTE} ${HASH_ATTRIBUTE}="abc123"></style><title>t</title>`,
    )
    const doc = new DOMParser().parseFromString(served, 'text/html')
    const paragraph = doc.querySelector('p')

    expect(paragraph && addressOf(doc, paragraph)?.hash).toBe('abc123')
  })
})

describe('resolveAddress', () => {
  it('should find the element the browser addressed', () => {
    const doc = new DOMParser().parseFromString(NESTED, 'text/html')
    const link = doc.querySelector('a')
    const address = link ? addressOf(doc, link) : undefined

    const outcome = address && resolveAddress(NESTED, address)

    expect(outcome).toMatchObject({
      ok: true,
      element: { tag: 'a', text: 'link' },
    })
  })

  it('should report a mismatch when the browser implied a tbody the file lacks', () => {
    const doc = new DOMParser().parseFromString(BARE_TABLE, 'text/html')
    const cell = doc.querySelector('td')
    const address = cell ? addressOf(doc, cell) : undefined

    const outcome = address && resolveAddress(BARE_TABLE, address)

    expect(outcome).toMatchObject({ ok: false, reason: 'address-mismatch' })
  })

  it.each([
    ['a bare fragment', '<h1>Bare</h1><p>x</p>'],
    [
      'an html and body with no head',
      '<html lang="en"><body><h1>Bare</h1></body></html>',
    ],
    [
      'a head-only lead before the content',
      '<!doctype html><title>t</title><h1>Bare</h1>',
    ],
  ])('should agree on %s once the server marks the wrapper', (_, file) => {
    const served = injectTokens(file, ':root{}', 'abc123')
    const doc = new DOMParser().parseFromString(served, 'text/html')
    const heading = doc.querySelector('h1')
    const address = heading ? addressOf(doc, heading) : undefined

    const outcome = address && resolveAddress(file, address)

    expect(outcome).toMatchObject({ ok: true, element: { tag: 'h1' } })
  })

  it('should keep the lang of an html the file states', () => {
    const served = injectTokens(
      '<html lang="en"><body><p>a</p></body></html>',
      '',
    )
    const doc = new DOMParser().parseFromString(served, 'text/html')

    expect(doc.documentElement.getAttribute('lang')).toBe('en')
  })

  it('should still report a mismatch for a head with no body', () => {
    const file = '<html><head><title>t</title></head><h1>Bare</h1></html>'
    const served = injectTokens(file, ':root{}', 'abc123')
    const doc = new DOMParser().parseFromString(served, 'text/html')
    const heading = doc.querySelector('h1')
    const address = heading ? addressOf(doc, heading) : undefined

    const outcome = address && resolveAddress(file, address)

    expect(outcome).toMatchObject({ ok: false, reason: 'address-mismatch' })
  })

  it('should refuse an index past the last element', () => {
    const outcome = resolveAddress(NESTED, {
      index: 999,
      tag: 'p',
      count: 1000,
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'address-mismatch' })
  })
})

describe('elementAt', () => {
  it('should return the element an address names', () => {
    const doc = new DOMParser().parseFromString(NESTED, 'text/html')
    const heading = doc.querySelector('h1')
    const address = heading ? addressOf(doc, heading) : undefined

    expect(address && elementAt(doc, address)).toBe(heading)
  })

  it('should return nothing when the tag at the index changed', () => {
    const doc = new DOMParser().parseFromString(NESTED, 'text/html')
    const heading = doc.querySelector('h1')
    const address = heading ? addressOf(doc, heading) : undefined

    expect(address && elementAt(doc, { ...address, tag: 'p' })).toBeUndefined()
  })
})

describe('excerpt', () => {
  it('should collapse whitespace and cut long text', () => {
    const text = excerpt(`  a\n\n  b ${'x'.repeat(200)}`)

    expect(text.startsWith('a b x')).toBe(true)
    expect(text.length).toBeLessThanOrEqual(80)
  })
})
