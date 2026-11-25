import { describe, expect, it } from 'vitest'
import {
  checkMeasuredResults,
  checkMeasurement,
  pendingMeasurements,
} from '@/labels/measurement'

const TABLE = [
  '| <what was measured> | result | baseline | conditions |',
  '| --- | --- | --- | --- |',
  '| scan of 200 files | 12 ms | 41 ms | warm cache |',
].join('\n')

function body(outcome: string, context = 'It trades memory for speed.') {
  return `## Summary\n\nSpeed up x.\n\n## Key changes\n\n- a\n\n## Technical context\n\n${context}\n\n## Outcome\n\n${outcome}\n`
}

describe('checkMeasurement', () => {
  it('should pass a perf body whose Outcome holds a table and whose context exists', () => {
    const result = checkMeasurement('perf(scan): cache the walk', body(TABLE))

    expect(result).toEqual({ checked: true, missing: [] })
  })

  it('should report the table missing for a perf body with none', () => {
    const result = checkMeasurement(
      'perf(scan): cache the walk',
      body('Faster now.'),
    )

    expect(result.missing).toEqual(['table'])
  })

  it('should not count a table that sits under another section', () => {
    const text = `${body('Faster now.')}\n## Testing\n\n${TABLE}\n`

    const result = checkMeasurement('perf(scan): cache the walk', text)

    expect(result.missing).toEqual(['table'])
  })

  it('should not count a table inside a fenced block', () => {
    const result = checkMeasurement(
      'perf(scan): cache the walk',
      body(`\`\`\`plaintext\n${TABLE}\n\`\`\``),
    )

    expect(result.missing).toEqual(['table'])
  })

  it('should report a table with a header row and no data row as missing', () => {
    const headerOnly = TABLE.split('\n').slice(0, 2).join('\n')

    const result = checkMeasurement(
      'perf(scan): cache the walk',
      body(headerOnly),
    )

    expect(result.missing).toEqual(['table'])
  })

  it('should report a missing Technical context', () => {
    const text = `## Summary\n\nx\n\n## Key changes\n\n- a\n\n## Outcome\n\n${TABLE}\n`

    const result = checkMeasurement('perf(scan): cache the walk', text)

    expect(result.missing).toEqual(['technical-context'])
  })

  it('should still read a breaking perf title as perf', () => {
    const result = checkMeasurement('perf(scan)!: cache the walk', body('none'))

    expect(result).toEqual({ checked: true, missing: ['table'] })
  })

  it('should read a perf title with no scope', () => {
    const result = checkMeasurement('perf: cache the walk', body('none'))

    expect(result.checked).toBe(true)
  })

  it('should leave a feat body with no table unchecked', () => {
    const result = checkMeasurement('feat(scan): add a flag', body('none'))

    expect(result).toEqual({ checked: false, missing: [] })
  })

  it('should leave a title that only mentions perf unchecked', () => {
    const result = checkMeasurement('fix(scan): perf regression', body('none'))

    expect(result.checked).toBe(false)
  })
})

function plan(verification: string) {
  return `# Feature: x\n\n## Summary\n\n- a\n\n## Verification\n\n${verification}\n\n## Risks\n\nNone.\n`
}

describe('checkMeasuredResults', () => {
  it('should report the results table missing when the plan names a benchmark', () => {
    const result = checkMeasuredResults(
      body('Faster now.'),
      plan('- Run the benchmark: `bun run bench`'),
    )

    expect(result).toEqual({ checked: true, missing: ['results-table'] })
  })

  it('should pass a body whose Outcome holds a table', () => {
    const result = checkMeasuredResults(
      body(TABLE),
      plan('- Score the eval against main'),
    )

    expect(result).toEqual({ checked: true, missing: [] })
  })

  it('should leave a plan that names no measurement unchecked', () => {
    const result = checkMeasuredResults(
      body('none'),
      plan('- The suite stays green: `bun run check`'),
    )

    expect(result).toEqual({ checked: false, missing: [] })
  })

  it.each([
    'eval',
    'latency',
    'p50',
    'p95',
    'median',
    'timed run',
    'frame time',
    'frames per second',
  ])('should read %s in Verification as a measurement', (word) => {
    const result = checkMeasuredResults(
      body('none'),
      plan(`- Take the ${word}`),
    )

    expect(result.checked).toBe(true)
  })

  it('should not read a word that only contains a trigger as one', () => {
    const result = checkMeasuredResults(
      body('none'),
      plan('- Reads retrieval and evaluate calls'),
    )

    expect(result.checked).toBe(false)
  })

  it('should not read a trigger inside a code span', () => {
    const result = checkMeasuredResults(
      body('none'),
      plan('- Run `bun run benchmark` once'),
    )

    expect(result.checked).toBe(false)
  })

  it('should not read a trigger inside a fenced sample', () => {
    const result = checkMeasuredResults(
      body('none'),
      plan('```text\nbenchmark the walk\n```'),
    )

    expect(result.checked).toBe(false)
  })

  it('should not read a trigger outside the Verification section', () => {
    const text = `## Summary\n\nA benchmark story.\n\n## Verification\n\n- tests pass\n`

    expect(checkMeasuredResults(body('none'), text).checked).toBe(false)
  })

  it('should read a trigger under a Verification subheading', () => {
    const text = `## Verification\n\n### Speed\n\n- Take the median of 5 runs\n\n## Risks\n`

    expect(checkMeasuredResults(body('none'), text).checked).toBe(true)
  })
})

const RUN = 'https://github.com/erclx/frameboard/actions/runs/45560474777'

function results(...rows: string[]): string {
  return [
    '| <what was measured> | Result | baseline | conditions |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
}

describe('pendingMeasurements', () => {
  it('should list a pending row with the run it links', () => {
    const text = body(
      results(`| scan of 200 files | pending | 41 ms | [run](${RUN}) |`),
    )

    expect(pendingMeasurements(text)).toEqual([
      { row: 'scan of 200 files', run: RUN },
    ])
  })

  it('should list a pending row that links no run without one', () => {
    const text = body(
      results(
        '| scan | pending | 41 ms | [check](https://github.com/erclx/frameboard/pull/9/checks) |',
      ),
    )

    expect(pendingMeasurements(text)).toEqual([{ row: 'scan' }])
  })

  it('should not list a not measured, a filled, or a fenced row', () => {
    const filled = results(
      '| a | not measured: cancelled | 1 ms | x |',
      `| b | 12 ms | 41 ms | [run](${RUN}) |`,
    )
    const fenced = `\`\`\`plaintext\n${results('| c | pending | 1 ms | x |')}\n\`\`\``

    expect(pendingMeasurements(body(filled))).toEqual([])
    expect(pendingMeasurements(body(fenced))).toEqual([])
  })

  it('should not read a status column that holds pending with no result header', () => {
    const text = body('| shape | status |\n| --- | --- |\n| card | pending |')

    expect(pendingMeasurements(text)).toEqual([])
  })

  it('should read the result header in any case and in any position', () => {
    const text = body(
      `| baseline | RESULT | what |\n| --- | --- | --- |\n| 1 ms | Pending ${RUN} | scan |`,
    )

    expect(pendingMeasurements(text)).toEqual([{ row: '1 ms', run: RUN }])
  })

  it('should not read a pending row under another section', () => {
    const text = `${body('none')}\n## Testing\n\n${results('| a | pending | 1 | x |')}\n`

    expect(pendingMeasurements(text)).toEqual([])
  })

  it('should read a pending row whatever the title, since it takes the body alone', () => {
    const text = body(results(`| a | pending | 1 | ${RUN} |`))

    expect(pendingMeasurements(text)).toHaveLength(1)
  })
})
