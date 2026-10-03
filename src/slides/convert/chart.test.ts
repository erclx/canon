import { describe, expect, it } from 'vitest'
import {
  type ChartRecord,
  type ChartTheme,
  planChart,
  seriesColors,
} from '@/slides/convert/chart'

function record(overrides: Partial<ChartRecord> = {}): ChartRecord {
  return {
    selector: 'figure.revenue',
    box: { x: 96, y: 192, w: 576, h: 384 },
    type: 'bar',
    hasLabels: false,
    rows: [
      ['Region', 'Q1', 'Q2'],
      ['North', '12', '16'],
      ['South', '9', '11'],
    ],
    ...overrides,
  }
}

function theme(overrides: Partial<ChartTheme> = {}): ChartTheme {
  return {
    colors: ['0F766E', '7C3AED', 'CA8A04'],
    ink: '1F2937',
    muted: '6B7280',
    face: 'Inter',
    ...overrides,
  }
}

describe('planChart', () => {
  it('should read the header row as series names', () => {
    const plan = planChart(record(), theme())

    expect(
      plan.status === 'chart' && plan.data.map((series) => series.name),
    ).toEqual(['Q1', 'Q2'])
  })

  it('should read the first column as category labels', () => {
    const plan = planChart(record(), theme())

    expect(plan.status === 'chart' && plan.data[0]?.labels).toEqual([
      'North',
      'South',
    ])
  })

  it('should read each column as one series of values', () => {
    const plan = planChart(record(), theme())

    expect(plan.status === 'chart' && plan.data[1]?.values).toEqual([16, 11])
  })

  it('should read a thousands separator as part of the number', () => {
    const plan = planChart(
      record({
        rows: [
          ['Region', 'Q1'],
          ['North', '1,200'],
        ],
      }),
      theme(),
    )

    expect(plan.status === 'chart' && plan.data[0]?.values).toEqual([1200])
  })

  it('should read an empty cell as a gap', () => {
    const plan = planChart(
      record({
        rows: [
          ['Region', 'Q1'],
          ['North', ''],
          ['South', '9'],
        ],
      }),
      theme(),
    )

    expect(plan.status === 'chart' && plan.data[0]?.values).toEqual([null, 9])
  })

  it('should draw a gap rather than a span or a zero', () => {
    const plan = planChart(record(), theme())

    expect(plan.status === 'chart' && plan.options.displayBlanksAs).toBe('gap')
  })

  it('should color one series per theme color in order', () => {
    const plan = planChart(record(), theme())

    expect(plan.status === 'chart' && plan.options.chartColors).toEqual([
      '0F766E',
      '7C3AED',
    ])
  })

  it('should repeat the colors past the last one', () => {
    const plan = planChart(
      record({
        rows: [
          ['Region', 'A', 'B', 'C'],
          ['North', '1', '2', '3'],
        ],
      }),
      theme({ colors: ['0F766E', '7C3AED'] }),
    )

    expect(plan.status === 'chart' && plan.options.chartColors).toEqual([
      '0F766E',
      '7C3AED',
      '0F766E',
    ])
  })

  it('should color a pie by category', () => {
    const plan = planChart(record({ type: 'pie' }), theme())

    expect(plan.status === 'chart' && plan.options.chartColors).toEqual([
      '0F766E',
      '7C3AED',
    ])
  })

  it('should turn data labels on', () => {
    const plan = planChart(record({ hasLabels: true }), theme())

    expect(plan.status === 'chart' && plan.options.showValue).toBe(true)
  })

  it('should leave data labels off', () => {
    const plan = planChart(record(), theme())

    expect(plan.status === 'chart' && plan.options.showValue).toBe(false)
  })

  it('should place the chart where the figure was laid out', () => {
    const plan = planChart(record(), theme())

    expect(plan.status === 'chart' && plan.options).toMatchObject({
      x: 1,
      y: 2,
      w: 6,
      h: 4,
    })
  })

  it('should set the face on the legend and axes', () => {
    const plan = planChart(record(), theme())

    expect(plan.status === 'chart' && plan.options).toMatchObject({
      legendFontFace: 'Inter',
      catAxisLabelFontFace: 'Inter',
      valAxisLabelFontFace: 'Inter',
    })
  })

  it('should carry a caption as the chart title', () => {
    const plan = planChart(record({ title: 'Revenue' }), theme())

    expect(plan.status === 'chart' && plan.options).toMatchObject({
      showTitle: true,
      title: 'Revenue',
    })
  })

  it('should refuse a non-numeric cell and name it', () => {
    const plan = planChart(
      record({
        rows: [
          ['Region', 'Q1'],
          ['North', 'twelve'],
        ],
      }),
      theme(),
    )

    expect(plan).toEqual({
      status: 'refused',
      selector: 'figure.revenue',
      message: 'cell "twelve" at row 2, column 2 is not a number',
    })
  })

  it('should refuse a chart type outside the catalog', () => {
    const plan = planChart(record({ type: 'radar' }), theme())

    expect(plan).toMatchObject({
      status: 'refused',
      message:
        'data-chart "radar" is not one of bar, line, area, pie, doughnut',
    })
  })

  it('should refuse a table with no data row', () => {
    const plan = planChart(record({ rows: [['Region', 'Q1']] }), theme())

    expect(plan).toMatchObject({ status: 'refused' })
  })
})

describe('seriesColors', () => {
  it('should put the accent first', () => {
    const colors = seriesColors('B45309', [
      { name: '--color-text', hex: '1F2937' },
    ])

    expect(colors[0]).toBe('B45309')
  })

  it('should follow with the declared roles in token order', () => {
    const colors = seriesColors('B45309', [
      { name: '--color-text', hex: '1F2937' },
      { name: '--color-success', hex: '15803D' },
    ])

    expect(colors).toEqual(['B45309', '1F2937', '15803D'])
  })

  it('should leave out the background and surface roles', () => {
    const colors = seriesColors('B45309', [
      { name: '--color-background', hex: 'FFFFFF' },
      { name: '--color-surface', hex: 'F4F4F5' },
      { name: '--color-text', hex: '1F2937' },
    ])

    expect(colors).toEqual(['B45309', '1F2937'])
  })

  it('should drop a role repeating a color already taken', () => {
    const colors = seriesColors('B45309', [
      { name: '--color-accent', hex: 'B45309' },
      { name: '--color-text', hex: '1F2937' },
    ])

    expect(colors).toEqual(['B45309', '1F2937'])
  })
})
