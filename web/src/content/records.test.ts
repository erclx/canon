import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { exampleSource, records, renderedPage } from './records'

const examplesRoot = resolve(import.meta.dirname, '../../../examples')
const index = readFileSync(resolve(examplesRoot, 'index.md'), 'utf8')
/** Every target `examples/index.md` links, a folder link ending in `/`. */
const linked = [...index.matchAll(/\]\(([^)]+)\)/g)].map(
  (match) => match[1] ?? '',
)

describe('renderedPage', () => {
  it('should read the path the sheet names and render its example', () => {
    const page = renderedPage({
      name: 'Board',
      by: 'Written by the orchestrator.',
      path: '.canon/tasks/priority.md',
      source: 'planning/priority.md',
    })

    expect(page.path).toBe('.canon/tasks/priority.md')
    expect(page.body).toContain('<h4 class="t">Priority</h4>')
    expect(page.body).toContain('<h4>In flight</h4>')
  })

  it('should refuse a sheet whose example does not exist', () => {
    expect(() =>
      renderedPage({
        name: 'Gone',
        by: 'Written by nobody.',
        path: '.canon/plans/gone.md',
        source: 'planning/gone.md',
      }),
    ).toThrow('planning/gone.md')
  })
})

describe('records', () => {
  it('should hold the twelve sheets in the order a change writes them', () => {
    expect(records.map((record) => record.name)).toEqual([
      'Intake',
      'Groundwork',
      'Plan',
      'Task',
      'Board',
      'Pull request',
      'Code review',
      'UI review',
      'Evidence',
      'Drive log',
      'Context',
      'Handoff',
    ])
  })

  describe.each(records)('the $name sheet', (record) => {
    it('should read an example linked from the examples index', () => {
      expect(exampleSource(record.source)).not.toBe('')
      expect(
        linked.filter((target) => record.source.startsWith(target)),
      ).not.toEqual([])
    })

    it('should render a body with no live input, image, or link', () => {
      const page = renderedPage(record)

      expect(page.path).not.toBe('')
      expect(page.body).not.toBe('')
      expect(page.body).not.toMatch(/<(input|img|a|details|br)\b|<!--/)
    })
  })
})
