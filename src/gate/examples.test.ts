import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recordExamples, stampedStandards } from '@/gate/examples'
import type { MeasureContext } from '@/gate/measures'

const STANDARD = 'claude/skills/demo/references/demo.md'
const STANDARD_SOURCE = '# Standard\n'
const STAMP = 'b4fbf5c0'
const REWORDED_STAMP = 'dc9404a1'

const CLEAN_PLAN = readFileSync(
  join(__dirname, 'fixtures', 'examples', 'feature-tide-sync.md'),
  'utf8',
)

describe('recordExamples', () => {
  let root: string

  const refuse = () => {
    throw new Error('recordExamples reads files and runs nothing')
  }

  const context = (): MeasureContext => ({
    root,
    ci: false,
    run: refuse,
    cli: refuse,
  })

  const write = (rel: string, source: string): void => {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), source)
  }

  const entry = (label: string, target: string, stamp = STAMP): string =>
    `- [${label}](${target}): a Tidewell record. Read against \`${STANDARD}\` at \`${stamp}\`.\n`

  const index = (...entries: string[]): string =>
    `# Examples\n\n## Planning\n\n${entries.join('')}`

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-record-examples-'))
    write(STANDARD, STANDARD_SOURCE)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe('a clean set', () => {
    it('passes an invented plan whose stamp matches its standard', async () => {
      write('examples/planning/feature-tide-sync.md', CLEAN_PLAN)
      write(
        'examples/index.md',
        index(entry('Feature plan', 'planning/feature-tide-sync.md')),
      )

      const report = await recordExamples(context())

      expect(report.failure).toBeUndefined()
      expect(report.unmeasured).toBeUndefined()
    })

    it('passes a folder example whose files sit under its entry', async () => {
      write(
        'examples/research/groundwork/04-surge/README.md',
        "---\ntitle: Surge\ndescription: Surge alerts\ndate: '2026-03-02'\n---\n\n# Surge\n",
      )
      write(
        'examples/research/groundwork/04-surge/01-current-state.md',
        '---\ntitle: State\ndescription: Alert state\n---\n\n# State\n',
      )
      write(
        'examples/index.md',
        index(entry('Groundwork track', 'research/groundwork/04-surge/')),
      )

      const report = await recordExamples(context())

      expect(report.failure).toBeUndefined()
    })
  })

  describe('a stale stamp', () => {
    it('fails naming the example and the standard it was read against', async () => {
      write('examples/planning/feature-tide-sync.md', CLEAN_PLAN)
      write(
        'examples/index.md',
        index(entry('Feature plan', 'planning/feature-tide-sync.md')),
      )
      write(STANDARD, '# Standard\n\nReworded.\n')

      const report = await recordExamples(context())

      expect(report.failure).toContain('examples/planning/feature-tide-sync.md')
      expect(report.failure).toContain(STANDARD)
      expect(report.failure).toContain(REWORDED_STAMP)
    })

    it('fails an entry that names no stamped standard', async () => {
      write('examples/sessions/handoff-note.md', '# Handoff\n')
      write(
        'examples/index.md',
        index('- [Handoff note](sessions/handoff-note.md): a note.\n'),
      )

      const report = await recordExamples(context())

      expect(report.failure).toContain('examples/sessions/handoff-note.md')
    })

    it('fails a stamp naming a standard that does not exist', async () => {
      write('examples/sessions/handoff-note.md', '# Handoff\n')
      write(
        'examples/index.md',
        index(
          '- [Handoff note](sessions/handoff-note.md): a note. Read against `claude/skills/gone/references/gone.md` at `b4fbf5c0`.\n',
        ),
      )

      const report = await recordExamples(context())

      expect(report.failure).toContain('claude/skills/gone/references/gone.md')
    })
  })

  describe('a broken example', () => {
    it('fails a plan missing its required sections, naming the example path', async () => {
      write('examples/planning/feature-tide-sync.md', '# Feature: Tide sync\n')
      write(
        'examples/index.md',
        index(entry('Feature plan', 'planning/feature-tide-sync.md')),
      )

      const report = await recordExamples(context())

      expect(report.failure).toContain('examples/planning/feature-tide-sync.md')
      expect(report.failure).toContain('Verification')
    })

    it('fails a groundwork track with no current state, naming the example folder', async () => {
      write(
        'examples/research/groundwork/04-surge/README.md',
        "---\ntitle: Surge\ndescription: Surge alerts\ndate: '2026-03-02'\n---\n\n# Surge\n",
      )
      write(
        'examples/index.md',
        index(entry('Groundwork track', 'research/groundwork/04-surge/')),
      )

      const report = await recordExamples(context())

      expect(report.failure).toContain(
        'examples/research/groundwork/04-surge/01-current-state.md',
      )
      expect(report.failure).not.toContain('.canon/')
    })

    it('fails an intake item missing its fields, naming the example folder', async () => {
      write(
        'examples/research/intake/03-feedback/00-overview.md',
        "---\ntitle: Feedback\ndescription: Tide feedback\ndate: '2026-03-01'\n---\n\n# Feedback\n",
      )
      write(
        'examples/research/intake/03-feedback/01-display.md',
        '---\ntitle: Display\ndescription: Display items\n---\n\n# Display\n\n### Times read wrong\n\n- **Problem:** the hour is ambiguous\n',
      )
      write(
        'examples/index.md',
        index(entry('Intake folder', 'research/intake/03-feedback/')),
      )

      const report = await recordExamples(context())

      expect(report.failure).toContain(
        'examples/research/intake/03-feedback/01-display.md',
      )
    })

    it('fails a design record over its prose budget', async () => {
      write(
        'examples/project/DESIGN.md',
        '# Design\n\n## Motion\n\n- a\n- b\n- c\n- d\n',
      )
      write(
        'examples/index.md',
        index(entry('Design record', 'project/DESIGN.md')),
      )

      const report = await recordExamples(context())

      expect(report.failure).toContain(
        'Motion holds 4 rules against a cap of 3 in examples/project/DESIGN.md',
      )
    })

    it('fails a requirements record past the cap it states', async () => {
      write(
        'examples/project/REQUIREMENTS.md',
        '# Requirements\n\nThis record holds at most 3 words.\n',
      )
      write(
        'examples/index.md',
        index(entry('Requirements record', 'project/REQUIREMENTS.md')),
      )

      const report = await recordExamples(context())

      expect(report.failure).toContain('examples/project/REQUIREMENTS.md')
    })
  })

  describe('coverage of the folder', () => {
    it('fails an example the index carries no entry for', async () => {
      write('examples/planning/feature-tide-sync.md', CLEAN_PLAN)
      write('examples/planning/priority.md', '# Priority\n')
      write(
        'examples/index.md',
        index(entry('Feature plan', 'planning/feature-tide-sync.md')),
      )

      const report = await recordExamples(context())

      expect(report.failure).toContain('examples/planning/priority.md')
    })

    it('fails an entry linking an example that does not exist', async () => {
      write('examples/index.md', index(entry('Board', 'planning/priority.md')))

      const report = await recordExamples(context())

      expect(report.failure).toContain('examples/planning/priority.md')
    })

    it('reports unmeasured on a tree holding no index', async () => {
      const report = await recordExamples(context())

      expect(report.unmeasured).toContain('examples/index.md')
    })
  })
})

describe('stampedStandards', () => {
  const PLAN_STANDARD = 'claude/skills/demo/references/plan.md'
  const BODY_STANDARD = 'claude/skills/demo/references/body.md'

  it('should name a standard two entries cite once', () => {
    const source = [
      `- [Plan](planning/plan.md): a plan. Read against \`${PLAN_STANDARD}\` at \`11b4687c\`.`,
      `- [Body](shipping/body.md): a body. Read against \`${BODY_STANDARD}\` at \`cb10464a\`.`,
      `- [Perf](shipping/perf.md): a body. Read against \`${BODY_STANDARD}\` at \`cb10464a\`.`,
    ].join('\n')

    expect(stampedStandards(source)).toEqual([PLAN_STANDARD, BODY_STANDARD])
  })

  it('should name every standard one entry cites', () => {
    const source = `- [Plan](planning/plan.md): a plan. Read against \`${PLAN_STANDARD}\` at \`11b4687c\` and \`${BODY_STANDARD}\` at \`cb10464a\`.`

    expect(stampedStandards(source)).toEqual([PLAN_STANDARD, BODY_STANDARD])
  })

  it('should leave out a stamp no entry carries, which the stage never checks', () => {
    const source = `Each entry reads \`${PLAN_STANDARD}\` at \`11b4687c\`.`

    expect(stampedStandards(source)).toEqual([])
  })
})
