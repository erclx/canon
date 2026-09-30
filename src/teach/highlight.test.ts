import { describe, expect, it } from 'vitest'
import { highlight } from '@/teach/highlight'

describe('highlight', () => {
  it('should mark a registered language with class-named spans', () => {
    const result = highlight('const a = 1', 'ts')

    expect(result.language).toBe('ts')
    expect(result.html).toContain('<span class="hljs-keyword">const</span>')
    expect(result.html).toContain('<span class="hljs-number">1</span>')
  })

  it('should resolve a registered alias', () => {
    const result = highlight('key: value', 'yml')

    expect(result.language).toBe('yml')
    expect(result.html).toContain('<span class="hljs-attr">key:</span>')
  })

  it('should render an unregistered language as escaped plain text', () => {
    const result = highlight('a < b', 'cobol')

    expect(result).toEqual({ html: 'a &lt; b', language: undefined })
  })

  it('should render text with no language as escaped plain text', () => {
    const result = highlight('a & b')

    expect(result).toEqual({ html: 'a &amp; b', language: undefined })
  })

  it('should escape markup in the source rather than emitting it', () => {
    const result = highlight('"</code><script>x</script>&amp;"', 'ts')

    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('</code>')
    expect(result.html).toContain('&lt;/code&gt;&lt;script&gt;')
    expect(result.html).toContain('&amp;amp;')
  })
})
