import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The device classes a design record can declare, in the order a reader
 * returns them. `claude/skills/design-record/references/design.md` states the
 * line's grammar, and the shipped screenshot harness reads it inline with the
 * same cases from `@/design/fixtures/device-classes`.
 */
export const DEVICE_CLASSES = ['phone', 'tablet', 'desktop'] as const

export type DeviceClass = (typeof DEVICE_CLASSES)[number]

/** The record a project's root holds, as every width reader looks it up. */
export const DESIGN_RECORD_PATH = join('canon', 'DESIGN.md')

export type DeviceClassesRead =
  | { readonly ok: true; readonly classes: readonly DeviceClass[] }
  | {
      readonly ok: false
      readonly reason: 'unknown-class'
      /** The token the line named that is no class, empty for a line naming none. */
      readonly name: string
      readonly message: string
    }

const LINE = /^\s*(?:[-*+]\s+)?Device classes:(.*)$/i

/**
 * The classes a record's `## Layout` declares through its `Device classes:`
 * line, the list ending at the first period. A record that is absent, holds
 * no Layout, or holds no line there supports all three. A name outside the
 * three, or a line naming none, refuses rather than dropping a class.
 */
export function parseDeviceClasses(
  record: string | undefined,
): DeviceClassesRead {
  const value = findLine(record ?? '')
  if (value === undefined) return { ok: true, classes: DEVICE_CLASSES }

  const names = value
    .split('.')[0]
    .split(/,|\band\b/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token !== '')
  const unknown = names.find((name) => !isDeviceClass(name))
  if (names.length === 0 || unknown !== undefined) {
    const name = unknown ?? ''
    const named = name === '' ? 'names no device class' : `names '${name}'`
    return {
      ok: false,
      reason: 'unknown-class',
      name,
      message: `The Device classes: line under ## Layout in ${DESIGN_RECORD_PATH} ${named}. It takes phone, tablet, or desktop.`,
    }
  }
  return {
    ok: true,
    classes: DEVICE_CLASSES.filter((deviceClass) =>
      names.includes(deviceClass),
    ),
  }
}

/** The classes the record under a project root declares. */
export function readDeviceClasses(root: string): DeviceClassesRead {
  const path = join(root, DESIGN_RECORD_PATH)
  return parseDeviceClasses(
    existsSync(path) ? readFileSync(path, 'utf8') : undefined,
  )
}

/** The class a viewport width falls in, at the Material 3 window boundaries of 600 and 840. */
export function deviceClassOf(width: number): DeviceClass {
  if (width < 600) return 'phone'
  if (width < 840) return 'tablet'
  return 'desktop'
}

function isDeviceClass(name: string): name is DeviceClass {
  return (DEVICE_CLASSES as readonly string[]).includes(name)
}

/** The text after the label on the first line inside `## Layout`, or undefined for none. */
function findLine(record: string): string | undefined {
  let isLayout = false
  for (const line of record.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      isLayout = heading[1] === 'Layout'
      continue
    }
    if (!isLayout) continue
    const match = LINE.exec(line)
    if (match) return match[1]
  }
  return undefined
}
