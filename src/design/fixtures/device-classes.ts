/**
 * The config texts both readers are tested against, `readDeviceConfig` in the CLI and the inline reader in the shipped
 * harness, each with the default and per-scope classes read or the refusal. Each text is read as `canon/config/app.toml`
 * and as the `device-classes.toml` it replaced, which hold the table alike.
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
    name: 'a desktop default beside other tables',
    config: config(
      '[drive]',
      'launch = "bun run dev"',
      '',
      '[device-classes]',
      'default = ["desktop"]',
      'why = "The board is a canvas"',
      '',
      '[painted]',
      'paths = ["src/client/**"]',
    ),
    expected: { default: ['desktop'], scopes: {} },
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
    name: 'a misspelled key in the table',
    config: config('[device-classes]', 'defaults = ["desktop"]', 'why = "x"'),
    expected: { reason: 'unknown-key', field: 'device-classes.defaults' },
  },
  {
    name: 'a misspelled table, which reads as another table',
    config: config('[device-clases]', 'default = ["desktop"]', 'why = "x"'),
    expected: { default: ALL, scopes: {} },
  },
  {
    name: 'text that is not TOML',
    config: '[device-classes\n',
    expected: { reason: 'unreadable-config', field: '' },
  },
]
