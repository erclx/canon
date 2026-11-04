import { readFileSync } from 'node:fs'

/**
 * A file under `templates/`, resolved from this module so the published CLI
 * finds it wherever the package is installed. Each file ends on one newline
 * that the emitted text does not carry, so that newline is dropped.
 *
 * The folder is outside the formatter, since a reflowed template changes the
 * bytes every generator emits.
 */
export function readTemplate(file: string): string {
  return readFileSync(
    new URL(`./templates/${file}`, import.meta.url),
    'utf8',
  ).replace(/\n$/, '')
}

const SLOT = /\{\{(\w+)\}\}/g

/**
 * Fills each `{{name}}` slot from `values`. A slot with no value, or a value no
 * slot asks for, throws, so a template and its caller cannot drift apart
 * silently.
 */
export function fillTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  const used = new Set<string>()
  const filled = template.replace(SLOT, (_, name: string) => {
    const value = values[name]
    if (value === undefined)
      throw new Error(`template slot {{${name}}} has no value`)
    used.add(name)
    return value
  })
  const unused = Object.keys(values).filter((name) => !used.has(name))
  if (unused.length > 0) {
    throw new Error(`template has no slot for ${unused.join(', ')}`)
  }
  return filled
}
