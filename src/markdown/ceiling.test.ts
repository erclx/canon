import { describe, expect, it } from 'vitest'
import { ceilingFindings, lengthExemption } from '@/markdown/ceiling'
import { CHECKPOINTS } from '@/markdown/structure'

const MARKER = '<!-- canon-length-exempt: a verbatim run record -->'

/** A source rendering at exactly `count` lines, one short line each. */
function lines(count: number): string {
  return Array.from({ length: count }, (_, index) => `Line ${index + 1}.`).join(
    '\n',
  )
}

function document(rel: string, source: string) {
  return { rel, source }
}

describe('ceilingFindings', () => {
  it('passes a document sitting exactly at the ceiling', () => {
    const findings = ceilingFindings([
      document('docs/guide.md', lines(CHECKPOINTS.ceiling)),
    ])

    expect(findings).toEqual([])
  })

  it('reports a document one line past the ceiling', () => {
    const findings = ceilingFindings([
      document('docs/guide.md', lines(CHECKPOINTS.ceiling + 1)),
    ])

    expect(findings).toEqual([
      { rel: 'docs/guide.md', renderedLines: 301, exempt: null },
    ])
  })

  it('exempts a changelog at any depth by name', () => {
    const findings = ceilingFindings([
      document('packages/cli/CHANGELOG.md', lines(400)),
    ])

    expect(findings[0]?.exempt).toBe(
      'CHANGELOG.md is written by the release tool',
    )
  })

  it('exempts a document carrying the marker with a reason', () => {
    const findings = ceilingFindings([
      document('scripts/record.md', `${MARKER}\n\n${lines(400)}`),
    ])

    expect(findings[0]?.exempt).toBe('a verbatim run record')
  })

  it('reports a document whose marker carries no reason', () => {
    const findings = ceilingFindings([
      document(
        'scripts/record.md',
        `<!-- canon-length-exempt: -->\n\n${lines(400)}`,
      ),
    ])

    expect(findings[0]?.exempt).toBeNull()
  })

  it('reports a document whose marker sits inside a fence', () => {
    const findings = ceilingFindings([
      document(
        'standards/markdown.md',
        `\`\`\`markdown\n${MARKER}\n\`\`\`\n\n${lines(400)}`,
      ),
    ])

    expect(findings[0]?.exempt).toBeNull()
  })

  it('lists the longest document first', () => {
    const findings = ceilingFindings([
      document('a.md', lines(320)),
      document('b.md', lines(900)),
    ])

    expect(findings.map((finding) => finding.rel)).toEqual(['b.md', 'a.md'])
  })
})

describe('lengthExemption', () => {
  it('reads a marker quoted in a code span as prose rather than an exemption', () => {
    const source = `Write \`${MARKER}\` on its own line.\n`

    expect(lengthExemption('standards/markdown.md', source)).toBeNull()
  })
})
