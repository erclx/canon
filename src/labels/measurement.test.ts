import { describe, expect, it } from 'vitest'
import { checkMeasuredResults, checkMeasurement } from '@/labels/measurement'

const TABLE = [
  '| <what was measured> | main | this branch | change |',
  '| --- | --- | --- | --- |',
  '| scan of 200 files | 41 ms | 12 ms | -71% |',
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

  it.each(['eval', 'latency', 'p50', 'p95', 'median', 'timed run'])(
    'should read %s in Verification as a measurement',
    (word) => {
      const result = checkMeasuredResults(
        body('none'),
        plan(`- Take the ${word}`),
      )

      expect(result.checked).toBe(true)
    },
  )

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
