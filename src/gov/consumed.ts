import { existsSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  canonRulesDir,
  installedInternalRulesDir,
  installRules,
  lookupRules,
  type RuleSource,
  ruleSubdir,
} from '@/gov/install'
import { mergeExtraRules, resolveRules } from '@/gov/stacks'

export const RECORD_REL = join('internal', 'governance.toml')

const INTERNAL_RULES_REL = join('internal', 'rules')

/** The stack a repository installs into its own `.claude/rules/`. */
export interface ConsumedRecord {
  readonly stack: string
  readonly add: readonly string[]
}

export type ConsumedResult =
  | { readonly ok: true; readonly installed: readonly string[] }
  | { readonly ok: false; readonly reason: string }

export function consumedRecordPath(root: string): string {
  return join(root, RECORD_REL)
}

export function internalRulesDir(root: string): string {
  return join(root, INTERNAL_RULES_REL)
}

/**
 * Reads the record naming the consumed stack. A file with no `stack` reads the
 * same as no file at all, since neither tells the producer what to install and
 * the caller's message covers both.
 */
export function readConsumedRecord(root: string): ConsumedRecord | undefined {
  const path = consumedRecordPath(root)
  if (!existsSync(path)) return undefined

  const parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
    string,
    unknown
  >
  const stack = typeof parsed.stack === 'string' ? parsed.stack : ''
  if (stack === '') return undefined

  return {
    stack,
    add: Array.isArray(parsed.add)
      ? parsed.add.filter(
          (rule): rule is string => typeof rule === 'string' && rule !== '',
        )
      : [],
  }
}

/**
 * Lists rules authored under `internal/rules/`. These govern toolkit authoring
 * against paths only this repository has, so they install into the consumed
 * copy without ever entering `governance/rules/`, which ships to targets.
 */
export function listInternalRules(root: string): RuleSource[] {
  const dir = internalRulesDir(root)
  if (!existsSync(dir)) return []

  return [...new Bun.Glob('**/*.md').scanSync({ cwd: dir, onlyFiles: true })]
    .sort()
    .map((rel) => {
      const src = join(dir, rel)
      return { rule: basename(rel, '.md'), src, subdir: ruleSubdir(src, dir) }
    })
}

/**
 * Rebuilds a repository's own `.claude/rules/` from its record. Unlike
 * `gov install` and `gov sync`, this runs against the toolkit root on purpose,
 * since the destination is produced output beside its source.
 */
export async function regenConsumedRules(
  root: string,
): Promise<ConsumedResult> {
  const record = readConsumedRecord(root)
  if (record === undefined) {
    return { ok: false, reason: `No stack recorded at ${RECORD_REL}` }
  }

  const resolution = resolveRules(root, record.stack)
  if (!resolution.ok) {
    return { ok: false, reason: `Stack not found: ${resolution.missingStack}` }
  }

  const { found, missing } = lookupRules(
    root,
    mergeExtraRules(resolution.rules, record.add.join(',')),
  )
  if (missing.length > 0) {
    return { ok: false, reason: `No source for: ${missing.join(', ')}` }
  }

  const internal = listInternalRules(root)
  const stackRules = new Set(found.map((entry) => entry.rule))
  const shadowed = internal
    .filter((entry) => stackRules.has(entry.rule))
    .map((entry) => entry.rule)
  if (shadowed.length > 0) {
    return {
      ok: false,
      reason: `Internal rules shadow stack rules: ${shadowed.join(', ')}`,
    }
  }

  // Cleared first so a rule the record stopped naming disappears, and a `project/` folder is untouched.
  await rm(canonRulesDir(root), { recursive: true, force: true })
  await rm(installedInternalRulesDir(root), { recursive: true, force: true })

  const installed = [
    ...(await installRules(found, root, 'canon')),
    ...(await installRules(internal, root, 'internal')),
  ]

  return { ok: true, installed: installed.sort() }
}
