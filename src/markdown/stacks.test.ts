import { describe, expect, it } from 'vitest'
import { bodyLines } from '@/markdown/scan'
import { bulletStacks, CAP } from '@/markdown/stacks'

function stacksIn(source: string) {
  return bulletStacks(bodyLines(`${source}\n`))
}

function items(count: number, prefix = 'item'): string {
  return Array.from({ length: count }, (_, i) => `- ${prefix} ${i}`).join('\n')
}

describe('bulletStacks', () => {
  it('should pass a run at the cap', () => {
    expect(stacksIn(items(CAP))).toEqual([])
  })

  it('should report a run one past the cap with its first line and count', () => {
    expect(stacksIn(`# Title\n\n${items(CAP + 1)}`)).toEqual([
      { line: 3, count: CAP + 1 },
    ])
  })

  it('should count star and plus markers in the same run', () => {
    expect(stacksIn('- a\n* b\n+ c\n- d\n* e\n+ f')).toEqual([
      { line: 1, count: 6 },
    ])
  })

  it('should not break the run on a blank line, a continuation, or a nested item', () => {
    const source =
      '- a\n\n- b\n  continued\n- c\n  - nested\n  - nested\n- d\n- e\n- f'

    expect(stacksIn(source)).toEqual([{ line: 1, count: 6 }])
  })

  it('should break the run on a paragraph or a heading', () => {
    const source = `${items(3)}\n\nA paragraph.\n\n${items(3)}\n## Next\n${items(3)}`

    expect(stacksIn(source)).toEqual([])
  })

  it('should not count numbered items', () => {
    expect(stacksIn('1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n7. g')).toEqual([])
  })

  it('should skip fenced lines without breaking the run', () => {
    const source = `${items(3)}\n\`\`\`sh\n- not an item\n- not an item\n- not an item\n\`\`\`\n${items(3)}`

    expect(stacksIn(source)).toEqual([{ line: 1, count: 6 }])
  })

  it('should exempt a run whose every item opens with a bold label', () => {
    expect(stacksIn(items(8, '**Label.** text'))).toEqual([])
  })

  it('should exempt a run whose every item opens with a link', () => {
    const source = Array.from(
      { length: 7 },
      (_, i) => `- [Entry ${i}](e${i}.md)`,
    ).join('\n')

    expect(stacksIn(source)).toEqual([])
  })

  it('should report a checklist run, since a task box is not a link', () => {
    const source = Array.from(
      { length: 7 },
      (_, i) => `- [${i % 2 ? 'x' : ' '}] Check ${i}`,
    ).join('\n')

    expect(stacksIn(source)).toEqual([{ line: 1, count: 7 }])
  })

  it('should report a run where one item opens with neither', () => {
    const source = `${items(6, '**Label.** text')}\n- plain item`

    expect(stacksIn(source)).toEqual([{ line: 1, count: 7 }])
  })

  it('should not read a frontmatter list as a run', () => {
    const source = `---\ntags:\n- a\n- b\n- c\n- d\n- e\n- f\n---\n\nBody.`

    expect(stacksIn(source)).toEqual([])
  })

  it('should number a finding by the editor line past frontmatter', () => {
    const source = `---\ntitle: x\n---\n\n${items(6)}`

    expect(stacksIn(source)).toEqual([{ line: 5, count: 6 }])
  })
})
