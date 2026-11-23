import type { DomainRow } from '@/labels/map'

/**
 * The labels a map names that the remote does not carry yet, in map order. Only
 * ever a subset of the map, so nothing here can edit or delete a hand-made
 * label, and names match regardless of case since GitHub holds them unique.
 */
export function missingLabels(
  mapLabels: readonly string[],
  remote: readonly string[],
): string[] {
  const carried = new Set(remote.map((label) => label.toLowerCase()))
  return mapLabels.filter((label) => !carried.has(label.toLowerCase()))
}

/** The approved colors for a new label, in the order the map assigns them. */
export const PALETTE: readonly string[] = [
  '1f6feb',
  '2da44e',
  'a371f7',
  'd29922',
  'bf3989',
  '0598bc',
  'e16f24',
  '6e7781',
  '56d364',
  'd2a8ff',
  '79c0ff',
  'ffa657',
]

/**
 * The color a new label takes, being the one its row declares or the palette
 * entry at its index among the map's rows, wrapping past the palette's end.
 */
export function colorFor(row: DomainRow, index: number): string {
  return row.color ?? PALETTE[index % PALETTE.length]
}

export interface ColorDrift {
  readonly label: string
  readonly declared: string
  readonly remote: string
}

/**
 * The rows whose declared color the remote holds differently. A row declaring
 * none can never drift, so a label recolored by hand stays the owner's.
 */
export function driftedLabels(
  rows: readonly DomainRow[],
  remote: readonly { name: string; color: string }[],
): ColorDrift[] {
  const held = new Map(
    remote.map(({ name, color }) => [name.toLowerCase(), color.toLowerCase()]),
  )

  const drift: ColorDrift[] = []
  for (const { label, color } of rows) {
    const remoteColor = held.get(label.toLowerCase())
    if (color === undefined || remoteColor === undefined) continue
    if (remoteColor !== color) {
      drift.push({ label, declared: color, remote: remoteColor })
    }
  }

  return drift
}
