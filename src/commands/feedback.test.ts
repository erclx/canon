import { describe, expect, it } from 'vitest'
import {
  REQUIRED_FIELDS,
  deriveDomainLabels,
  deriveSlug,
  deriveTitle,
  missingField,
  missingFieldMessage,
  parseSections,
  readField,
} from '@/commands/feedback-format'

function report(overrides: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    'From project': 'canon',
    Surface: 'plugin skill, git-commit',
    Observed: 'it broke',
    Expected: 'unclear',
    Repro: 'none',
    'Proposed fix': 'open',
    ...overrides,
  }
  const sections = Object.entries(fields)
    .filter(([, value]) => value !== '')
    .map(([heading, value]) => `### ${heading}\n\n${value}`)
    .join('\n\n')
  return `## Toolkit feedback\n\n${sections}\n`
}

describe('parseSections', () => {
  it('should read each ### heading as a field carrying its body', () => {
    const sections = parseSections(report())

    expect(sections.get('surface')).toBe('plugin skill, git-commit')
    expect(sections.get('observed')).toBe('it broke')
    expect(sections.get('proposed fix')).toBe('open')
  })

  it('should keep a multi-line field body whole', () => {
    const body = report({ Observed: 'first line\nsecond line' })

    expect(readField(body, 'Observed')).toBe('first line\nsecond line')
  })

  it('should not read the retired bold form as a field', () => {
    const body =
      '## Toolkit feedback\n\n**Surface:** plugin skill, git-commit\n'

    expect(readField(body, 'Surface')).toBeUndefined()
  })

  it('should ignore the report title, which is not a field', () => {
    expect(parseSections(report()).has('toolkit feedback')).toBe(false)
  })

  it('should read a ### line inside a fenced block as body, not a field', () => {
    const fenced = ['```bash', '### not a field', 'canon feedback', '```'].join(
      '\n',
    )
    const body = report({ Repro: fenced })

    expect(readField(body, 'Repro')).toBe(fenced)
    expect(parseSections(body).has('not a field')).toBe(false)
  })

  it('should keep the fields following a fenced block', () => {
    const body = report({ Repro: '```\n### fenced\n```' })

    expect(readField(body, 'Proposed fix')).toBe('open')
  })
})

describe('missingField', () => {
  it('should find nothing missing in a report carrying every required field', () => {
    expect(missingField(report())).toBeUndefined()
  })

  it.each(REQUIRED_FIELDS)(
    'should name %s when its section is absent',
    (field) => {
      const body = report({ [field]: '' })

      expect(missingField(body)).toBe(field)
    },
  )

  it('should name a required field whose section is present but empty', () => {
    const body = '## Toolkit feedback\n\n### Surface\n\n### Observed\n\nbroke\n'

    expect(missingField(body)).toBe('Surface')
  })

  it('should name the first missing field rather than every one', () => {
    expect(missingField('## Toolkit feedback\n')).toBe('Surface')
  })

  it('should name every required field in the repair message', () => {
    const message = missingFieldMessage('Surface')

    expect(message).toContain('### Surface')
    expect(message).toContain('### Observed')
    expect(message).toContain('### Proposed fix')
  })
})

describe('deriveTitle', () => {
  it('should build a title from the Surface field', () => {
    expect(deriveTitle(report())).toBe('feedback: plugin skill, git-commit')
  })

  it('should fall back to a generic title when no Surface field is present', () => {
    const body = '## Toolkit feedback\n\n### Observed\n\nit broke\n'

    expect(deriveTitle(body)).toBe('toolkit feedback')
  })

  it('should truncate a long title to the max length', () => {
    const body = report({ Surface: 'x'.repeat(200) })

    expect(deriveTitle(body).length).toBeLessThanOrEqual(72)
  })
})

describe('deriveSlug', () => {
  it('should build a slug from the Surface field', () => {
    expect(deriveSlug(report())).toBe('plugin-skill-git-commit')
  })

  it('should take the first line of a multi-line Surface field', () => {
    const body = report({ Surface: 'plugin skill, git-commit\nand a note' })

    expect(deriveSlug(body)).toBe('plugin-skill-git-commit')
  })

  it('should fall back to general when no Surface field is present', () => {
    expect(deriveSlug('no surface here')).toBe('general')
  })
})

describe('deriveDomainLabels', () => {
  it('should map a plugin skill surface to the skills label', () => {
    expect(deriveDomainLabels(report())).toEqual(['skills'])
  })

  it('should map a surface naming two domains to both labels in table order', () => {
    const body = report({ Surface: 'plugin skill and CLI, canon feedback' })

    expect(deriveDomainLabels(body)).toEqual(['skills', 'cli'])
  })

  it('should map tooling and governance words together', () => {
    const body = report({
      Surface: 'tooling config and governance rules, base',
    })

    expect(deriveDomainLabels(body)).toEqual(['tooling', 'governance'])
  })

  it('should match the domain word in a near variant of the tooling type', () => {
    const body = report({ Surface: 'tooling sync, base' })

    expect(deriveDomainLabels(body)).toEqual(['tooling'])
  })

  it('should match the domain word in a near variant of the governance type', () => {
    const body = report({ Surface: 'governance stack, core' })

    expect(deriveDomainLabels(body)).toEqual(['governance'])
  })

  it('should return a label once when two words map to it', () => {
    const body = report({ Surface: 'seed, tooling/claude/seeds/CLAUDE.md' })

    expect(deriveDomainLabels(body)).toEqual(['tooling'])
  })

  it('should ignore domain words after the first comma', () => {
    const body = report({ Surface: 'CLI, canon teach nav' })

    expect(deriveDomainLabels(body)).toEqual(['cli'])
  })

  it('should return no labels for a surface type the table does not name', () => {
    const body = report({ Surface: 'standard, markdown.md' })

    expect(deriveDomainLabels(body)).toEqual([])
  })

  it('should return no labels when no Surface field is present', () => {
    expect(deriveDomainLabels('no surface here')).toEqual([])
  })
})
