/** One row of `claude plugin list --json`, the fields this module reads. */
export interface PluginInstall {
  readonly id: string
  readonly version: string
}

/**
 * The plugin's own name, out of a `plugin.json` buffer. `undefined` on
 * anything that fails to parse or carries no string `name`, so a caller
 * refuses rather than matching against `undefined@`.
 */
export function readPluginName(manifest: string): string | undefined {
  try {
    const parsed = JSON.parse(manifest) as { name?: unknown }
    return typeof parsed.name === 'string' ? parsed.name : undefined
  } catch {
    return undefined
  }
}

export type MatchResult =
  | { readonly kind: 'matched'; readonly install: PluginInstall }
  | { readonly kind: 'none' }
  | { readonly kind: 'many'; readonly installs: readonly PluginInstall[] }

/**
 * `id` is `<name>@<marketplace>`, so a name alone can match more than one row
 * when the same plugin is installed from two marketplaces at once. Refusing
 * that case rather than picking a row is the same move `readPluginName`
 * makes: nothing here guesses at an ambiguity the caller can see plainly.
 */
export function matchInstall(
  name: string,
  installs: readonly PluginInstall[],
): MatchResult {
  const prefix = `${name}@`
  const matches = installs.filter((install) => install.id.startsWith(prefix))

  if (matches.length === 0) return { kind: 'none' }
  if (matches.length > 1) return { kind: 'many', installs: matches }
  return { kind: 'matched', install: matches[0] as PluginInstall }
}

export function updatedMessage(before: string, after: string): string {
  return after === before
    ? `Plugin reinstalled ${after}, unchanged.`
    : `Plugin updated ${before} to ${after}.`
}
