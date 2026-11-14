import { describe, expect, it } from 'vitest'
import { SECRET_MARKER } from '@/secrets/marker'
import { PATTERNS } from '@/secrets/patterns'
import { scanText } from '@/secrets/scan'

const PLANTED = `AKIA${'Q'.repeat(16)}`

describe('scanText', () => {
  it('should report a planted value with its file, line, and column', () => {
    const findings = scanText(
      'tooling/base/seeds/env',
      `x\nid = "${PLANTED}"\n`,
    )

    expect(findings).toEqual([
      {
        file: 'tooling/base/seeds/env',
        line: 2,
        column: 7,
        pattern: 'aws-access-key-id',
        label: 'AWS access key id',
        preview: 'AKIA…QQQQ',
      },
    ])
  })

  it('should report nothing on a clean file', () => {
    expect(scanText('src/cli.ts', 'const key = process.env.API_KEY\n')).toEqual(
      [],
    )
  })

  it('should report nothing on a value the marker exempts inline', () => {
    const text = `id = "${PLANTED}" # ${SECRET_MARKER}: fixture\n`

    expect(scanText('scripts/fixture.sh', text)).toEqual([])
  })

  it('should report nothing on a value the line above exempts', () => {
    const text = `# ${SECRET_MARKER}: fixture\nid = "${PLANTED}"\n`

    expect(scanText('scripts/fixture.sh', text)).toEqual([])
  })

  it('should still report a value two lines below the marker', () => {
    const text = `# ${SECRET_MARKER}: fixture\nfiller\nid = "${PLANTED}"\n`

    expect(scanText('scripts/fixture.sh', text)).toHaveLength(1)
  })

  it('should report every value in a file carrying more than one', () => {
    const text = `id = "${PLANTED}"\nkey = "AIza${'b'.repeat(35)}"\n`

    expect(scanText('a', text).map((finding) => finding.line)).toEqual([1, 2])
  })
})

describe('the rule set against its own source', () => {
  // `src/` is in the shipped corpus, so a pattern matching its own definition
  // would report this file on every run and train a reader to mute the check.
  it('should not match the source text of any pattern', () => {
    const sources = PATTERNS.map((pattern) => pattern.match.source).join('\n')

    expect(scanText('src/secrets/patterns.ts', sources)).toEqual([])
  })
})
