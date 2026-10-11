import { describe, expect, it } from 'vitest'
import { checkSections } from '@/labels/sections'

const WELL_FORMED = '## Summary\n\n- a change\n\n## Key changes\n\n- a file\n'

describe('checkSections', () => {
  it('should report clean for a body holding the required pair', () => {
    const result = checkSections(WELL_FORMED)

    expect(result).toEqual({ outside: [], missing: [] })
  })

  it('should accept every heading in the closed list', () => {
    const body = `${WELL_FORMED}\n## Technical context\n\n## Testing\n\n## For the reviewer\n`

    const result = checkSections(body)

    expect(result).toEqual({ outside: [], missing: [] })
  })

  it('should name a heading outside the list', () => {
    const body = `${WELL_FORMED}\n## Whatever\n`

    const result = checkSections(body)

    expect(result.outside).toEqual(['## Whatever'])
  })

  it('should name a heading the list never held', () => {
    const body = `${WELL_FORMED}\n## Commits\n`

    const result = checkSections(body)

    expect(result.outside).toEqual(['## Commits'])
  })

  it('should name a required heading that is missing', () => {
    const result = checkSections('## Summary\n\n- a change\n')

    expect(result.missing).toEqual(['## Key changes'])
  })

  it('should fail a title-case heading on the case alone', () => {
    const body = '## Summary\n\n## Key Changes\n'

    const result = checkSections(body)

    expect(result).toEqual({
      outside: ['## Key Changes'],
      missing: ['## Key changes'],
    })
  })

  it('should trim trailing whitespace and a carriage return before comparing', () => {
    const body = '## Summary  \r\n\r\n## Key changes\r\n'

    const result = checkSections(body)

    expect(result).toEqual({ outside: [], missing: [] })
  })

  it('should not read a heading inside a fenced block', () => {
    const body = `${WELL_FORMED}\n\`\`\`markdown\n## Whatever\n\`\`\`\n`

    const result = checkSections(body)

    expect(result.outside).toEqual([])
  })

  it('should not govern a subheading under a section', () => {
    const body = `${WELL_FORMED}\n### Anything at all\n`

    const result = checkSections(body)

    expect(result).toEqual({ outside: [], missing: [] })
  })
})
