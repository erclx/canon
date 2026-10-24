import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { measureDesignProse } from '@/design/budget'
import { parseDesignDoc } from '@/design/parse'
import { DESIGN_DOCUMENT } from '@/design/regen'

/** The custom property a table row names, such as `--color-accent`. */
const PROPERTY = /--[A-Za-z0-9_-]+/g

/** A custom property declaration, which a stylesheet and a Tailwind `@theme` block share. */
const DECLARATION = /(--[A-Za-z0-9_-]+)\s*:/g

/** A backticked path to a stylesheet. */
const STYLESHEET = /`([^`\s]+\.css)`/

export type TokenCheck =
  | {
      readonly status: 'checked'
      readonly stylesheet: string
      readonly properties: number
      readonly missing: readonly string[]
    }
  | { readonly status: 'unchecked'; readonly reason: string }
  | { readonly status: 'not-applicable'; readonly reason: string }

export interface DesignAudit {
  readonly ok: true
  /** The record read, or null where the project holds none. */
  readonly record: string | null
  readonly prose: readonly string[]
  readonly tokens: TokenCheck | null
  /** True only when the prose is within budget and the token check ran clean. */
  readonly clean: boolean
}

/**
 * Reads a project's design record against the prose budget and checks each
 * custom property its tables name against the stylesheet its lead names. It
 * writes nothing.
 *
 * A token check that cannot run says why under `unchecked` and leaves `clean`
 * false, since a check that did not look is no pass.
 */
export function auditDesign(root: string): DesignAudit {
  const path = join(root, DESIGN_DOCUMENT)
  if (!existsSync(path)) {
    return { ok: true, record: null, prose: [], tokens: null, clean: true }
  }

  const source = readFileSync(path, 'utf8')
  const prose = measureDesignProse(source)
  const tokens = checkTokens(root, path, source)
  const clean =
    prose.length === 0 &&
    tokens.status !== 'unchecked' &&
    (tokens.status !== 'checked' || tokens.missing.length === 0)

  return { ok: true, record: DESIGN_DOCUMENT, prose, tokens, clean }
}

function checkTokens(root: string, path: string, source: string): TokenCheck {
  const doc = parseDesignDoc(path)
  const rows = [...doc.color, ...doc.borders]

  // A values record renders from a token module and carries `Value` where an
  // intent record carries `Property`, so it has no property to compare.
  if (!rows.some((row) => 'Property' in row)) {
    return {
      status: 'not-applicable',
      reason:
        'The record has no Property column, so it holds no property to compare.',
    }
  }

  const lead = source.split(/^##\s/m)[0]
  const named = lead.match(STYLESHEET)?.[1]
  if (named === undefined) {
    return {
      status: 'unchecked',
      reason: 'The lead names no stylesheet, so no property could be checked.',
    }
  }

  const stylesheet = resolve(root, named)
  if (!stylesheet.startsWith(resolve(root)) || !existsSync(stylesheet)) {
    return {
      status: 'unchecked',
      reason: `The lead names ${named}, which does not resolve in the project.`,
    }
  }

  const css = readFileSync(stylesheet, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const declared = new Set([...css.matchAll(DECLARATION)].map((m) => m[1]))

  const properties = [
    ...new Set(
      rows.flatMap((row) =>
        [...(row['Property']?.value.matchAll(PROPERTY) ?? [])].map((m) => m[0]),
      ),
    ),
  ]

  return {
    status: 'checked',
    stylesheet: named,
    properties: properties.length,
    missing: properties.filter((property) => !declared.has(property)),
  }
}
