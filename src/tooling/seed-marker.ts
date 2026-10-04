/**
 * The frontmatter field exempting a seed from the section check the seed gate
 * runs.
 *
 * The check has a false-positive class its own comment records: a standard may
 * sanction omitting a section, and no measure separates that from a file that
 * forgot it. Reporting is the right response in a live project, where the
 * finding is advisory. The seed gate promotes the same finding to a failing
 * exit code, so the seed tree needs a way to say the omission is deliberate.
 */
export const SEED_STUB_FIELD = 'stub'

/**
 * Whether an install rewrites this seed rather than copying it byte for byte.
 *
 * This answers what the caller branches on and not whether the file holds a
 * marker, which is `isStubSeed` reading content. Only markdown carries
 * frontmatter, so only markdown can hold one, and the extension decides the
 * copy path without opening the file. Every install path and the drift report
 * ask this one question, or the report compares a marked source against a
 * stripped target and reads a seed nobody touched as drifted.
 */
export function rewritesOnInstall(src: string): boolean {
  return src.endsWith('.md')
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---(\n|$)/
const STUB_LINE = new RegExp(`^${SEED_STUB_FIELD}:[ \\t]*true[ \\t]*$`, 'm')

/**
 * Whether the source declares itself a skeleton for the target to fill.
 *
 * Only `true` counts. A field set to anything else reads as a seed that meant
 * to turn the exemption off, and treating an unparsed value as exempt would
 * make a typo silence the gate.
 */
export function isStubSeed(source: string): boolean {
  const block = source.match(FRONTMATTER)
  if (!block) return false

  return STUB_LINE.test(block[1])
}

/**
 * Removes the marker so it reaches no target.
 *
 * The field is toolkit bookkeeping about the seed tree, and a project that
 * received it would carry a field its own tooling never reads. A file whose
 * frontmatter holds nothing else loses the block entirely rather than keeping
 * an empty one.
 */
export function stripSeedMarker(source: string): string {
  const block = source.match(FRONTMATTER)
  if (!block) return source

  const kept = block[1]
    .split('\n')
    .filter((line) => !STUB_LINE.test(line))
    .join('\n')

  // A function replacement, because a string one reads `$1` and `$&` in the
  // kept fields as references to this match. A `description` naming a dollar
  // amount would otherwise substitute the whole frontmatter into itself and
  // carry the marker along with it.
  if (kept.trim() !== '') {
    const replacement = `---\n${kept}\n---${block[2] ?? ''}`
    return source.replace(FRONTMATTER, () => replacement)
  }

  // Dropping the block takes the blank line that separated it from the body
  // with it. Leaving that behind opens the installed file on whitespace, which
  // is a diff every target would carry against its own formatter.
  return source.slice(block[0].length).replace(/^\n+/, '')
}
