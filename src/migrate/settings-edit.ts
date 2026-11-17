/**
 * Adds values to a JSON settings file as text insertions, so every byte the
 * edit does not insert stays as the project wrote it.
 *
 * `jsonc-parser`'s own `modify` was measured and rejected here: with
 * formatting on, it reformats the line the insertion lands on, which expanded
 * a one-line sibling entry into five lines. This file takes only offsets from
 * the parse tree and writes the inserted text itself.
 */

import {
  type JSONPath,
  type Node,
  findNodeAtLocation,
  parseTree,
} from 'jsonc-parser'

/**
 * One addition. `append` adds `value` to the end of the list at `path`, and
 * `set` adds the property `path` names, which must be absent. Neither ever
 * replaces a value the file holds.
 */
export type SettingsEdit =
  | {
      readonly kind: 'append'
      readonly path: JSONPath
      readonly value: unknown
    }
  | { readonly kind: 'set'; readonly path: JSONPath; readonly value: unknown }

interface Layout {
  readonly unit: string
  readonly eol: string
}

export function applySettingsEdits(
  source: string,
  edits: readonly SettingsEdit[],
  unit: string,
): string {
  const layout: Layout = { unit, eol: source.includes('\r\n') ? '\r\n' : '\n' }
  return edits.reduce((text, edit) => applyEdit(text, edit, layout), source)
}

function applyEdit(text: string, edit: SettingsEdit, layout: Layout): string {
  const root = parseTree(text)
  if (root === undefined) throw new Error('settings text does not parse')

  if (edit.kind === 'append') {
    const list = findNodeAtLocation(root, [...edit.path])
    if (list === undefined) {
      return applyEdit(
        text,
        { kind: 'set', path: edit.path, value: [edit.value] },
        layout,
      )
    }
    if (list.type !== 'array')
      throw new Error(`${edit.path.join('.')} is not a list`)
    return insertMember(text, list, render(edit.value, layout), layout)
  }

  const { owner, rest } = deepestObject(root, edit.path)
  const [key, ...nested] = rest
  if (
    typeof key !== 'string' ||
    nested.some((part) => typeof part !== 'string')
  ) {
    throw new Error(`${edit.path.join('.')} does not name a property`)
  }
  const value = nested.reduceRight<unknown>(
    (inner, part) => ({ [part]: inner }),
    edit.value,
  )
  return insertMember(
    text,
    owner,
    (base) => `${JSON.stringify(key)}: ${render(value, layout)(base)}`,
    layout,
  )
}

/**
 * Walks the path as far as objects already exist, so a `set` under an absent
 * parent adds the parent once, holding the nested value.
 */
function deepestObject(
  root: Node,
  path: JSONPath,
): { owner: Node; rest: JSONPath } {
  let owner = root
  for (let at = 0; at < path.length - 1; at++) {
    const next = findNodeAtLocation(root, path.slice(0, at + 1))
    if (next === undefined) return { owner, rest: path.slice(at) }
    if (next.type !== 'object')
      throw new Error(`${path.slice(0, at + 1).join('.')} is not an object`)
    owner = next
  }
  if (owner.type !== 'object') throw new Error('settings root is not an object')
  if (findNodeAtLocation(root, [...path]) !== undefined) {
    throw new Error(`${path.join('.')} is already set`)
  }
  return { owner, rest: path.slice(-1) }
}

/** Renders a value at a base indent, its first line unindented. */
function render(
  value: unknown,
  { unit, eol }: Layout,
): (base: string) => string {
  return (base) =>
    JSON.stringify(value, null, unit).split('\n').join(`${eol}${base}`)
}

/**
 * Inserts after the container's last member. A member sharing the
 * container's opening line marks a one-line container, which keeps the new
 * member on that line in compact form. Otherwise the member takes its own
 * line at the last member's indent, or one unit past the container's for an
 * empty one.
 */
function insertMember(
  text: string,
  container: Node,
  member: (base: string) => string,
  { unit, eol }: Layout,
): string {
  const last = container.children?.at(-1)
  if (last === undefined) {
    const open = container.offset + 1
    const close = container.offset + container.length - 1
    const base = lineIndent(text, container.offset)
    const inner = `${base}${unit}`
    return `${text.slice(0, open)}${eol}${inner}${member(inner)}${eol}${base}${text.slice(close)}`
  }

  const end = last.offset + last.length
  if (lineStart(text, last.offset) === lineStart(text, container.offset)) {
    const compact = member('').replace(/\r?\n\s*/g, ' ')
    return `${text.slice(0, end)}, ${compact}${text.slice(end)}`
  }
  const base = lineIndent(text, last.offset)
  return `${text.slice(0, end)},${eol}${base}${member(base)}${text.slice(end)}`
}

function lineStart(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1
}

function lineIndent(text: string, offset: number): string {
  const start = lineStart(text, offset)
  return /^[ \t]*/.exec(text.slice(start, offset))?.[0] ?? ''
}
