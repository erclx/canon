import type { GovCatalog } from '@/gov/list'
import type { StackSummary } from '@/tooling/list'

export const LISTED = 10

/**
 * The first seven are the method and exist nowhere else. The last three are
 * recognizable on sight and are what keeps a column of chosen names from
 * reading as an all-`claude-` catalog, which is the failure the sampler was
 * written against.
 */
export const FEATURED_SKILLS = [
  'plan-feature',
  'plan-groundwork',
  'plan-intake',
  'role-orchestrator',
  'auto-ship',
  'review-pr',
  'task-board',
  'git-ship',
  'target-setup',
  'systematic-debugging',
]

/**
 * A terminal frame sets `white-space: pre` at a fixed window width, so an
 * overlong cell is clipped by the window edge rather than wrapped.
 */
const GLOB_WIDTH = 44

/** A refusal the script prints as `regen-hero: <message>` and exits 1 on. */
export class FrameError extends Error {}

export interface StandardRow {
  readonly name: string
  readonly appliesTo?: readonly string[]
}

export interface FrameCatalogs {
  readonly skills: readonly string[]
  readonly gov: GovCatalog
  readonly standards: readonly StandardRow[]
  readonly toolingStacks: readonly StackSummary[]
  readonly commandCount: number
  readonly tokenCss: string
  readonly markSvg: string
}

export interface Frame {
  readonly template: string
  readonly out: string
  readonly tokens: string
}

export interface FrameValues {
  readonly values: Readonly<Record<string, string>>
  readonly frames: (templates: readonly string[]) => Frame[]
}

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Even spacing across the sorted catalog rather than its first N, so a column
 * whose names share a prefix does not read as a narrower catalog than the one
 * that ships. Rules and standards sample. Skills do not, because the even step
 * lands on the entries closest to commodity and on none of the workflow the
 * toolkit exists to carry.
 */
export function sample<T>(items: readonly T[], listed = LISTED): T[] {
  if (items.length <= listed) return [...items]
  const step = items.length / listed
  return Array.from({ length: listed }, (_, i) => items[Math.floor(i * step)])
}

/**
 * A chosen name is maintained by hand where a sample never goes stale, so a
 * rename has to fail the run rather than quietly shrink the column. The length
 * is asserted because the `+N more` figure counts down from `LISTED` rather
 * than from what this returns.
 */
export function featured(
  names: readonly string[],
  chosen: readonly string[],
  listed = LISTED,
): string[] {
  if (chosen.length !== listed) {
    throw new FrameError(`${chosen.length} featured skills, expected ${listed}`)
  }
  const catalog = new Set(names)
  const missing = chosen.filter((name) => !catalog.has(name))
  if (missing.length > 0) {
    throw new FrameError(
      `featured skills missing from the catalog: ${missing.join(', ')}`,
    )
  }
  return [...chosen]
}

/**
 * Truncating keeps the longest row inside the capture, and the ellipsis stops a
 * clipped value from reading as the whole value.
 */
export function clip(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`
}

/**
 * Padding happens before escaping, since an entity is longer than the
 * character it replaces and would push a column out of line.
 */
export function pad(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - value.length))
}

const markup = (names: readonly string[]): string =>
  names
    .map((name) => `            <div class="entry">${escape(name)}</div>`)
    .join('\n')

const remaining = (names: readonly unknown[], listed = LISTED): string =>
  String(Math.max(0, names.length - listed))

const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`

const frameRow = (cells: string): string =>
  `<span class="frame">│</span> <span class="ok">✓</span> ${cells}`

/** Rule names carry a numeric prefix that orders the load, not the identity. */
const slug = (name: string): string => name.replace(/^\d+-/, '')

/** Indented to the depth a rule inside the `<style>` block sits at. */
const indentTokens = (css: string): string =>
  css
    .trimEnd()
    .split('\n')
    .map((line) => (line === '' ? '' : `      ${line}`))
    .join('\n')

/**
 * The frames a README serves in both themes. The hero is a landing-page frame
 * no README shows, so it stays dark.
 */
const LIGHT_TEMPLATES = new Set(['install.html.tmpl'])

function lightTokens(tokenCss: string): string {
  const roles = [...tokenCss.matchAll(/--color-light-([a-z-]+):/g)].map(
    (match) => match[1],
  )
  if (roles.length === 0) {
    throw new FrameError(
      'token css carries no --color-light-* roles, refusing to write a light frame',
    )
  }
  return [
    tokenCss,
    '',
    '      :root {',
    ...roles.map(
      (role) => `        --color-${role}: var(--color-light-${role});`,
    ),
    '        --frame-shadow: rgb(0 0 0 / 16%);',
    '      }',
  ].join('\n')
}

function faviconUri(markSvg: string, tokenCss: string): string {
  const accent = tokenCss.match(/--color-accent:\s*(#[0-9a-fA-F]{3,8})/)
  if (!accent) {
    throw new FrameError(
      'token css carries no --color-accent value, refusing to write a colorless favicon',
    )
  }
  const svg = markSvg
    .replace(/<!--[\s\S]*?-->/, '')
    .trim()
    .replaceAll('currentColor', accent[1])
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * Builds the value map every template takes and the frame list a template set
 * expands to. An empty array is well-formed, and the in-process readers return
 * one quietly for a missing tree, so every catalog is refused when empty
 * rather than shipping a frame claiming the domain has nothing in it.
 */
export function buildFrameValues(catalogs: FrameCatalogs): FrameValues {
  const { gov, toolingStacks, standards, skills } = catalogs
  const markSvg = catalogs.markSvg.trim()
  if (!markSvg) {
    throw new FrameError(
      'assets/brand/mark.svg read empty, refusing to write a hero with no mark',
    )
  }
  if (!catalogs.commandCount) {
    throw new FrameError(
      'the commands catalog read no commands, refusing to write a zeroed hero',
    )
  }

  const tokenCss = indentTokens(catalogs.tokenCss)
  const rules = gov.rules.map((entry) => slug(entry.name))
  // A rule no stack names is opt-in behind `--add`, so featuring one advertises
  // an entry no ordinary `canon gov install` delivers. The column samples the
  // stack-reached subset while its count and remainder describe the whole.
  const stacked = new Set(gov.stacks.flatMap((stack) => stack.rules))
  const deliveredEntries = gov.rules.filter((entry) => stacked.has(entry.name))
  const deliveredRules = deliveredEntries.map((entry) => slug(entry.name))
  const standardNames = standards.map((entry) => entry.name)

  for (const [label, list] of [
    ['skills', skills],
    ['rules', rules],
    ['standards', standardNames],
    ['tooling stacks', toolingStacks],
    ['gov stacks', gov.stacks],
    ['stack-delivered rules', deliveredRules],
  ] as const) {
    if (list.length === 0) {
      throw new FrameError(
        `the ${label} catalog is empty, refusing to write a zeroed hero`,
      )
    }
  }

  const govStackRows = gov.stacks
    .map((stack) =>
      frameRow(
        `<span class="name">${escape(pad(stack.name, 17))}</span>` +
          `<span class="muted">${escape(pad(plural(stack.rules.length, 'rule'), 11))}</span>` +
          `<span class="muted">${escape(stack.extends ? `extends ${stack.extends}` : '')}</span>`,
      ),
    )
    .join('\n')

  // Each rule sits beside the glob that loads it rather than its description,
  // since the glob is the mechanism a reader cannot otherwise see. A rule
  // carrying no glob is not unscoped, it loads every session, and saying so is
  // the contrast that makes the column mean anything.
  const govRuleRows = sample(deliveredEntries)
    .map((entry) => {
      const globs = entry.paths ?? []
      const scope =
        globs.length > 0 ? clip(globs.join(' '), GLOB_WIDTH) : 'every session'
      return frameRow(
        `<span class="name">${escape(pad(slug(entry.name), 24))}</span>` +
          `<span class="domain">${escape(pad(`[${entry.domain}]`, 12))}</span>` +
          `<span class="muted">${escape(scope)}</span>`,
      )
    })
    .join('\n')

  // A standard either governs an artifact by path or is opened by name when a
  // session decides it needs it. Naming the second is the contrast, since
  // nothing else tells a reader the corpus installs into no project.
  const standardRows = sample(standards)
    .map((entry) => {
      const applies = entry.appliesTo ?? []
      const governs =
        applies.length > 0
          ? clip(applies.join(' '), GLOB_WIDTH)
          : 'read by name'
      return frameRow(
        `<span class="name">${escape(pad(entry.name, 18))}</span>` +
          `<span class="muted">${escape(governs)}</span>`,
      )
    })
    .join('\n')

  // A tooling stack is counted rather than listed, because what it lays down is
  // dev dependencies, run scripts, and ignore groups rather than named entries.
  // The inheritance is the part worth showing, since it is why a stack carrying
  // two of its own arrives with far more than two.
  const toolingStackRows = toolingStacks
    .map((stack) =>
      frameRow(
        `<span class="name">${escape(pad(stack.name, 14))}</span>` +
          `<span class="muted">${escape(pad(plural(stack.devDeps, 'dep'), 10))}</span>` +
          `<span class="muted">${escape(pad(plural(stack.scripts, 'script'), 12))}</span>` +
          `<span class="muted">${escape(stack.extends ? `extends ${stack.extends}` : '')}</span>`,
      ),
    )
    .join('\n')

  for (const [label, rows] of [
    ['governance stack rows', govStackRows],
    ['governance rule rows', govRuleRows],
    ['standard rows', standardRows],
    ['tooling stack rows', toolingStackRows],
  ] as const) {
    if (rows === '') {
      throw new FrameError(
        `the ${label} rendered empty, refusing to write a blank frame`,
      )
    }
  }

  const values: Record<string, string> = {
    TOKENS: tokenCss,
    GOV_STACK_ROWS: govStackRows,
    GOV_RULE_ROWS: govRuleRows,
    STANDARD_ROWS: standardRows,
    TOOLING_STACK_ROWS: toolingStackRows,
    SKILL_COUNT: String(skills.length),
    RULE_COUNT: String(rules.length),
    STANDARD_COUNT: String(standardNames.length),
    GOV_STACK_COUNT: String(gov.stacks.length),
    TOOLING_STACK_COUNT: String(toolingStacks.length),
    COMMAND_COUNT: String(catalogs.commandCount),
    MARK_SVG: markSvg,
    FAVICON: faviconUri(markSvg, tokenCss),
    SKILL_ENTRIES: markup(featured(skills, FEATURED_SKILLS)),
    RULE_ENTRIES: markup(sample(deliveredRules)),
    STANDARD_ENTRIES: markup(sample(standardNames)),
    SKILL_MORE: remaining(skills),
    RULE_MORE: remaining(rules),
    STANDARD_MORE: remaining(standardNames),
  }

  const light = lightTokens(tokenCss)

  return {
    values,
    frames: (templates) =>
      templates.flatMap((template) => {
        const base = template.replace(/\.html\.tmpl$/, '')
        const dark = { template, out: `${base}.html`, tokens: tokenCss }
        return LIGHT_TEMPLATES.has(template)
          ? [dark, { template, out: `${base}-light.html`, tokens: light }]
          : [dark]
      }),
  }
}

/**
 * Every template takes the same value map, so one carrying no count
 * placeholder simply resolves none of them. What a template must not do is name
 * a placeholder nothing fills.
 */
export function fillTemplate(
  template: string,
  source: string,
  values: Readonly<Record<string, string>>,
  tokens: string,
): string {
  let html = source
  for (const [key, value] of Object.entries({ ...values, TOKENS: tokens })) {
    html = html.replaceAll(`{{${key}}}`, value)
  }

  const unresolved = html.match(/{{[A-Z_]+}}/g)
  if (unresolved) {
    throw new FrameError(
      `${template} carries unresolved placeholders ${[...new Set(unresolved)].join(', ')}`,
    )
  }
  return html
}
