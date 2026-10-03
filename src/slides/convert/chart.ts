import type PptxGenJS from 'pptxgenjs'
import { position, type Rect } from '@/slides/convert/shapes'

/**
 * A `<figure data-chart="...">` holding a `<table>` lands as a native chart.
 * The table stays the page's accessible source and is not also drawn. Its
 * header row names the series and its first column names the categories.
 */

export const CHART_TYPES = ['bar', 'line', 'area', 'pie', 'doughnut'] as const
export type ChartType = (typeof CHART_TYPES)[number]

export interface ChartRecord {
  readonly selector: string
  readonly box: Rect
  /** The raw `data-chart` value, checked against `CHART_TYPES` here. */
  readonly type: string
  readonly hasLabels: boolean
  /** The figure's `<figcaption>`, when it has one. */
  readonly title?: string
  readonly rows: readonly (readonly string[])[]
}

export interface ChartTheme {
  /** Series colors in order, repeated past the last. */
  readonly colors: readonly string[]
  readonly ink: string
  readonly muted: string
  readonly face: string
}

export interface ChartSeries {
  readonly name: string
  readonly labels: readonly string[]
  /** `null` is an empty cell, which the chart draws as a gap. */
  readonly values: readonly (number | null)[]
}

export type ChartPlan =
  | {
      readonly status: 'chart'
      readonly type: ChartType
      readonly data: readonly ChartSeries[]
      readonly options: PptxGenJS.IChartOpts
    }
  | {
      readonly status: 'refused'
      readonly selector: string
      readonly message: string
    }

export interface ColorRole {
  readonly name: string
  readonly hex: string
}

/** The grounds a series would vanish into. */
const GROUND_ROLES = new Set(['--color-background', '--color-surface'])

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/

const isChartType = (value: string): value is ChartType =>
  (CHART_TYPES as readonly string[]).includes(value)

/**
 * The accent, then every other declared color role in token order except the
 * grounds, each color once. No project declares a chart palette, so the
 * project's own roles stand in for one.
 */
export function seriesColors(
  accent: string,
  roles: readonly ColorRole[],
): string[] {
  const colors = [accent]
  for (const role of roles) {
    if (GROUND_ROLES.has(role.name) || colors.includes(role.hex)) continue
    colors.push(role.hex)
  }
  return colors
}

function cycle(colors: readonly string[], count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => colors[index % colors.length] ?? '',
  )
}

export function planChart(record: ChartRecord, theme: ChartTheme): ChartPlan {
  const refuse = (message: string): ChartPlan => ({
    status: 'refused',
    selector: record.selector,
    message,
  })
  if (!isChartType(record.type)) {
    return refuse(
      `data-chart "${record.type}" is not one of ${CHART_TYPES.join(', ')}`,
    )
  }
  const [header = [], ...body] = record.rows
  if (header.length < 2 || body.length === 0) {
    return refuse(
      'the table needs a header row and at least one data row of two cells',
    )
  }

  const labels = body.map((row) => row[0] ?? '')
  const data: ChartSeries[] = []
  for (let column = 1; column < header.length; column += 1) {
    const values: (number | null)[] = []
    for (const [index, row] of body.entries()) {
      const text = (row[column] ?? '').trim()
      if (text === '') {
        values.push(null)
        continue
      }
      const bare = text.replace(/,/g, '')
      if (!NUMBER.test(bare)) {
        return refuse(
          `cell "${text}" at row ${index + 2}, column ${column + 1} is not a number`,
        )
      }
      values.push(Number(bare))
    }
    data.push({ name: header[column] ?? '', labels, values })
  }

  const isRound = record.type === 'pie' || record.type === 'doughnut'
  return {
    status: 'chart',
    type: record.type,
    data,
    options: {
      ...position(record.box),
      chartColors: cycle(theme.colors, isRound ? labels.length : data.length),
      displayBlanksAs: 'gap',
      showValue: record.hasLabels,
      dataLabelColor: theme.ink,
      dataLabelFontFace: theme.face,
      showLegend: isRound || data.length > 1,
      legendPos: 'b',
      legendColor: theme.ink,
      legendFontFace: theme.face,
      catAxisLabelColor: theme.muted,
      catAxisLabelFontFace: theme.face,
      valAxisLabelColor: theme.muted,
      valAxisLabelFontFace: theme.face,
      ...(record.title
        ? {
            showTitle: true,
            title: record.title,
            titleColor: theme.ink,
            titleFontFace: theme.face,
            altText: record.title,
          }
        : {}),
    },
  }
}
