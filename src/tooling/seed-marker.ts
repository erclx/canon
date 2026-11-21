/**
 * The frontmatter field exempting a seed from the section check the seed gate runs. The check cannot separate a
 * deliberately omitted section from a forgotten one, so the seed tree needs a way to say it is deliberate.
 */
export const SEED_STUB_FIELD = 'stub'

/**
 * Whether an install rewrites this seed rather than copying it byte for byte. Only markdown carries frontmatter,
 * so the extension decides the copy path, and every install path and the drift report ask this one question.
 */
export function rewritesOnInstall(src: string): boolean {
  return src.endsWith('.md')
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---(\n|$)/
const STUB_LINE = new RegExp(`^${SEED_STUB_FIELD}:[ \\t]*true[ \\t]*$`, 'm')

/**
 * Whether the source declares itself a skeleton for the target to fill. Only `true` counts, since treating an
 * unparsed value as exempt would let a typo silence the gate.
 */
export function isStubSeed(source: string): boolean {
  const block = source.match(FRONTMATTER)
  if (!block) return false

  return STUB_LINE.test(block[1])
}

/**
 * Removes the marker so it reaches no target, since it is toolkit bookkeeping about the seed tree. A file whose
 * frontmatter holds nothing else loses the block entirely.
 */
export function stripSeedMarker(source: string): string {
  const block = source.match(FRONTMATTER)
  if (!block) return source

  const kept = block[1]
    .split('\n')
    .filter((line) => !STUB_LINE.test(line))
    .join('\n')

  // A function replacement, since a string one reads `$1` and `$&` in the kept fields.
  if (kept.trim() !== '') {
    const replacement = `---\n${kept}\n---${block[2] ?? ''}`
    return source.replace(FRONTMATTER, () => replacement)
  }

  // The blank line after the block goes with it, or the installed file would open on whitespace.
  return source.slice(block[0].length).replace(/^\n+/, '')
}
