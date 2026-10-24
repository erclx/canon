import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { Page } from 'playwright-core'
import type { Finding } from '@/driver/steps'

/**
 * Runs axe-core on the WCAG A and AA tags and reports what it found, marking
 * the findings a UI review holds open on.
 *
 * The engine is canon's own dependency and is read from canon's install at run
 * time, so nothing reaches a target's manifest or production build.
 *
 * The bundle assigns `window.axe`, `doT`, and `_encodeHTML` as it loads, and
 * registers with any AMD loader the page carries. It is evaluated with
 * `define`, `module`, and `exports` shadowed, and every global it added or
 * replaced is put back once the run settles, so a page owning a global named
 * `axe` keeps it and a probe running after this one reads the page it found.
 */

/** The tags the groundwork measured on, which together are WCAG 2.2 A and AA. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * The rules a violation of which keeps a UI review open. Each raised no false
 * finding across frameboard's real screens, and a rule moves to report-only on
 * its first false finding on a real pull request.
 *
 * `label-content-name-mismatch` stays off it as a text heuristic, and every
 * incomplete result stays off it as axe saying it could not decide.
 */
export const AXE_GATE_RULES: readonly string[] = [
  'color-contrast',
  'target-size',
  'button-name',
  'link-name',
  'input-button-name',
  'select-name',
  'label',
  'image-alt',
  'document-title',
  'html-has-lang',
  'html-lang-valid',
  'aria-valid-attr',
  'aria-required-attr',
  'aria-roles',
  'nested-interactive',
]

const ENGINE = 'axe-core/axe.min.js'

/**
 * The engine was not where canon's install should hold it. Thrown rather than
 * returned as an empty list, since no findings and no engine read the same to
 * a caller counting findings.
 */
export class AxeEngineMissing extends Error {
  override readonly name = 'AxeEngineMissing'
}

/** Reads the engine bundle out of canon's own install. */
export function readAxeEngine(specifier: string = ENGINE): string {
  try {
    const path = createRequire(import.meta.url).resolve(specifier)
    return readFileSync(path, 'utf8')
  } catch (error) {
    throw new AxeEngineMissing(
      `axe-core did not resolve from canon's install as ${specifier}. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

let cached: string | undefined

/** Read once per process, since a drive calls the probe after every step. */
function cachedEngine(): string {
  cached ??= readAxeEngine()
  return cached
}

interface Row {
  readonly rule: string
  readonly outcome: 'violation' | 'incomplete'
  readonly help: string
  readonly criteria: string
  readonly selector: string
  readonly summary: string
}

const OUTCOME_ORDER = { violation: 0, incomplete: 1 } as const

export async function probeAxe(
  page: Page,
  engine: () => string = cachedEngine,
): Promise<Finding[]> {
  const source = engine()
  const rows = (await page.evaluate(runner(source))) as Row[]
  const gating = new Set(AXE_GATE_RULES)

  return [...rows]
    .sort(
      (a, b) =>
        OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome] ||
        a.rule.localeCompare(b.rule) ||
        a.selector.localeCompare(b.selector),
    )
    .map((row) => ({
      probe: 'axe' as const,
      selector: row.selector,
      detail:
        row.outcome === 'violation'
          ? row.help
          : `${row.help}, which axe could not decide and a person reads`,
      measured: [row.criteria, row.summary].filter(Boolean).join(': '),
      rule: row.rule,
      outcome: row.outcome,
      gate: row.outcome === 'violation' && gating.has(row.rule),
    }))
}

/**
 * Builds the expression the page evaluates. A string rather than a function,
 * so the bundle is evaluated by the debugging protocol, which a page's content
 * security policy does not govern, where a `new Function` inside the page would
 * be refused by any policy without `unsafe-eval`.
 */
function runner(source: string): string {
  const options = JSON.stringify({
    runOnly: { type: 'tag', values: TAGS },
    resultTypes: ['violations', 'incomplete'],
    iframes: false,
  })

  return `(async () => {
    const scope = window
    const before = new Map()
    for (const key of Object.getOwnPropertyNames(scope)) {
      before.set(key, Object.getOwnPropertyDescriptor(scope, key))
    }
    const prior = before.get('axe')

    try {
      ;(function (define, module, exports) {
${source}
      }).call(scope)

      const engine = scope.axe
      if (!engine || engine === prior?.value || typeof engine.run !== 'function') {
        throw new Error('the page holds window.axe in a property the engine could not replace')
      }

      const result = await engine.run(document, ${options})
      const rows = []
      const read = (outcome, rules) => {
        for (const rule of rules) {
          const criteria = rule.tags.filter((tag) => /^wcag\\d{3,}$/.test(tag)).join(' ')
          for (const node of rule.nodes) {
            rows.push({
              rule: rule.id,
              outcome,
              help: rule.help,
              criteria,
              selector: node.target.map((part) => [].concat(part).join(' >>> ')).join(' '),
              summary: (node.failureSummary || '').replace(/\\s+/g, ' ').trim(),
            })
          }
        }
      }
      read('violation', result.violations)
      read('incomplete', result.incomplete)
      return rows
    } finally {
      for (const key of Object.getOwnPropertyNames(scope)) {
        const was = before.get(key)
        if (!was) {
          delete scope[key]
          continue
        }
        const now = Object.getOwnPropertyDescriptor(scope, key)
        if (now && 'value' in was && now.value !== was.value) {
          Object.defineProperty(scope, key, was)
        }
      }
    }
  })()`
}
