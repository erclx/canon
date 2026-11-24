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

/**
 * The `canon/config/design.toml` texts both config readers are tested against, `parseDeviceConfig` in the CLI and
 * the inline reader in the shipped harness, each with the default and per-scope classes read or the refusal.
 */
export interface DeviceConfigCase {
  readonly name: string
  /** The config's text, or undefined for a project holding no config. */
  readonly config: string | undefined
  readonly expected:
    | {
        readonly default: readonly string[]
        readonly scopes: Readonly<Record<string, readonly string[]>>
      }
    | { readonly reason: string; readonly field: string }
}

const ALL = ['phone', 'tablet', 'desktop']

const LANDING = [
  '[device-classes.scopes.landing]',
  'groups = ["landing"]',
  'paths = ["web/"]',
  'classes = ["phone", "tablet", "desktop"]',
  'why = "The landing page is responsive"',
]

const config = (...lines: string[]): string => `${lines.join('\n')}\n`

export const DEVICE_CONFIG_CASES: readonly DeviceConfigCase[] = [
  {
    name: 'no config',
    config: undefined,
    expected: { default: ALL, scopes: {} },
  },
  {
    name: 'a config with no device-classes table',
    config: '',
    expected: { default: ALL, scopes: {} },
  },
  {
    name: 'a desktop default',
    config: config(
      '[device-classes]',
      'default = ["desktop"]',
      'why = "The board is a canvas"',
    ),
    expected: { default: ['desktop'], scopes: {} },
  },
  {
    name: 'a default and a scope, out of order and in mixed case',
    config: config(
      '[device-classes]',
      'default = ["Desktop", "tablet"]',
      'why = "The board is a canvas"',
      '',
      ...LANDING,
    ),
    expected: { default: ['tablet', 'desktop'], scopes: { landing: ALL } },
  },
  {
    name: 'a scope with no default',
    config: config(
      '[device-classes.scopes.canvas]',
      'paths = ["src/canvas/"]',
      'classes = ["desktop"]',
      'why = "A canvas needs a pointer"',
    ),
    expected: { default: ALL, scopes: { canvas: ['desktop'] } },
  },
  {
    name: 'an unknown class in the default',
    config: config(
      '[device-classes]',
      'default = ["desktop", "watch"]',
      'why = "x"',
    ),
    expected: { reason: 'unknown-class', field: 'device-classes.default' },
  },
  {
    name: 'an empty class list in a scope',
    config: config(
      '[device-classes.scopes.landing]',
      'paths = ["web/"]',
      'classes = []',
      'why = "x"',
    ),
    expected: {
      reason: 'bad-field',
      field: 'device-classes.scopes.landing.classes',
    },
  },
  {
    name: 'a default with no why',
    config: config('[device-classes]', 'default = ["desktop"]'),
    expected: { reason: 'missing-why', field: 'device-classes.why' },
  },
  {
    name: 'a scope with no why',
    config: config(
      '[device-classes.scopes.landing]',
      'paths = ["web/"]',
      'classes = ["phone"]',
    ),
    expected: {
      reason: 'missing-why',
      field: 'device-classes.scopes.landing.why',
    },
  },
  {
    name: 'a scope with neither groups nor paths',
    config: config(
      '[device-classes.scopes.landing]',
      'classes = ["phone"]',
      'why = "x"',
    ),
    expected: { reason: 'bad-field', field: 'device-classes.scopes.landing' },
  },
  {
    name: 'a misspelled scope key',
    config: config(
      '[device-classes.scopes.landing]',
      'path = ["web/"]',
      'classes = ["phone"]',
      'why = "x"',
    ),
    expected: {
      reason: 'unknown-key',
      field: 'device-classes.scopes.landing.path',
    },
  },
  {
    name: 'a misspelled table',
    config: config('[device-clases]', 'default = ["desktop"]', 'why = "x"'),
    expected: { reason: 'unknown-key', field: 'device-clases' },
  },
  {
    name: 'text that is not TOML',
    config: '[device-classes\n',
    expected: { reason: 'unreadable-config', field: '' },
  },
]
