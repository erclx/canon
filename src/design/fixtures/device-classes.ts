/**
 * The records both readers of the `Device classes:` line are tested against,
 * `src/design/device-classes.ts` in the CLI and the inline reader in the
 * shipped `tooling/web/configs/e2e/screenshot.ts`, so a grammar change made
 * in one fails the other's test until both agree.
 */
export interface DeviceClassesCase {
  readonly name: string
  /** The record's text, or undefined for a project holding no record. */
  readonly record: string | undefined
  /** The classes read, or the unknown name a reader refuses on. */
  readonly expected:
    | { readonly classes: readonly string[] }
    | { readonly refused: string }
}

const layout = (...lines: string[]): string =>
  ['# Design', '', '## Layout', '', ...lines, '', '## Shapes', ''].join('\n')

export const DEVICE_CLASSES_CASES: readonly DeviceClassesCase[] = [
  {
    name: 'no record',
    record: undefined,
    expected: { classes: ['phone', 'tablet', 'desktop'] },
  },
  {
    name: 'a record with no Layout',
    record: '# Design\n\n## Overview\n\nA canvas.\n',
    expected: { classes: ['phone', 'tablet', 'desktop'] },
  },
  {
    name: 'a Layout with no line',
    record: layout('- Draw widths: 390, 768, 1280'),
    expected: { classes: ['phone', 'tablet', 'desktop'] },
  },
  {
    name: 'desktop alone',
    record: layout('- Device classes: desktop'),
    expected: { classes: ['desktop'] },
  },
  {
    name: 'two classes out of order, with prose after the list',
    record: layout(
      '- Device classes: desktop, tablet. The canvas needs a pointer.',
    ),
    expected: { classes: ['tablet', 'desktop'] },
  },
  {
    name: 'an unbulleted line in mixed case',
    record: layout('Device classes: Phone, Desktop'),
    expected: { classes: ['phone', 'desktop'] },
  },
  {
    name: 'the line under another section',
    record: [
      '# Design',
      '',
      '## Overview',
      '',
      '- Device classes: desktop',
      '',
    ].join('\n'),
    expected: { classes: ['phone', 'tablet', 'desktop'] },
  },
  {
    name: 'an unknown class name',
    record: layout('- Device classes: desktop, watch'),
    expected: { refused: 'watch' },
  },
  {
    name: 'a line naming no class',
    record: layout('- Device classes:'),
    expected: { refused: '' },
  },
]
