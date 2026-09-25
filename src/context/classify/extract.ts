import { existsSync, readFileSync } from 'node:fs'
import { basename, relative, resolve } from 'node:path'
import { $ } from 'bun'
import { resolveFolders } from '@/context/folders'
import { gitEnv } from '@/git-env'
import { listChangedFiles, resolveBaseRef } from '@/git-files'
import { surfaceDir } from '@/surface-root'

/**
 * The five canonical doc types the classifier reaches, matching the file
 * pattern the groundwork spike scoped its fixture to
 * (`scripts/hunks.py`'s `DOC_PATH`) and the file-type catalog both system
 * prompts state.
 */
export const CANONICAL_DOC_TYPES = [
  'context',
  'architecture',
  'wireframes',
  'design',
  'requirements',
] as const

export type CanonicalDocType = (typeof CANONICAL_DOC_TYPES)[number]

const DOC_PATTERNS: Record<CanonicalDocType, RegExp> = {
  context: /(^|\/)context\/.+\.md$/,
  architecture: /(^|\/)ARCHITECTURE\.md$/,
  wireframes: /(^|\/)wireframes\/.+\.md$/,
  design: /(^|\/)DESIGN\.md$/,
  requirements: /(^|\/)REQUIREMENTS\.md$/,
}

const INDEX_NAME = 'index.md'

/** The two doc types `resolveFolders` discovers, paired with the folder name it takes. */
const MULTI_DOC_TYPES: readonly { type: CanonicalDocType; name: string }[] = [
  { type: 'context', name: 'context' },
  { type: 'wireframes', name: 'wireframes' },
]

/** The three doc types that resolve to one file each, paired with `surfaceDir`'s entry name. */
const SINGLE_DOC_TYPES: readonly { type: CanonicalDocType; entry: string }[] = [
  { type: 'architecture', entry: 'ARCHITECTURE.md' },
  { type: 'design', entry: 'DESIGN.md' },
  { type: 'requirements', entry: 'REQUIREMENTS.md' },
]

/**
 * Which canonical doc type a repo-relative path belongs to, regardless of
 * which surface root (`canon/` or `.claude/`) it resolved under.
 */
export function docTypeOf(file: string): CanonicalDocType | undefined {
  if (basename(file) === INDEX_NAME) return undefined

  return CANONICAL_DOC_TYPES.find((type) => DOC_PATTERNS[type].test(file))
}

/**
 * A hunk of 25 words or more of added text, the groundwork fixture's own
 * floor (`hunks.py`'s `MIN_ADDED_WORDS`). A trivial edit, a typo fix, a
 * one-line link repair, is not worth a model call or a regex read, and the
 * spike's own labelled set never sampled anything smaller.
 */
export const MIN_ADDED_WORDS = 25

/** `hunks.py`'s `MAX_SECTION_WORDS`, so a chunk's context never blows the model's context window. */
const MAX_SECTION_WORDS = 900

export interface DiffChunk {
  /** Repo-relative path. */
  readonly file: string
  readonly docType: CanonicalDocType
  /** Empty string when the hunk added text with nothing removed. */
  readonly removed: string
  readonly added: string
  /** The heading-delimited section the hunk's added lines landed in, current content. */
  readonly sectionAfter: string
}

export type ExtractRefusal = 'bad-range' | 'unreadable-file'

export type DiffExtraction =
  | { readonly kind: 'ok'; readonly chunks: readonly DiffChunk[] }
  | {
      readonly kind: 'refused'
      readonly reason: ExtractRefusal
      readonly message: string
    }

async function gitRaw(
  root: string,
  args: string[],
): Promise<string | undefined> {
  const result = await $`git -C ${root} ${args}`.env(gitEnv()).quiet().nothrow()
  return result.exitCode === 0 ? result.text() : undefined
}

interface RawHunk {
  /** 1-based line number in the new (working tree) file where the hunk starts. */
  readonly newStart: number
  readonly added: readonly string[]
  readonly removed: readonly string[]
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/**
 * Reads a single-file, zero-context unified diff into its hunks. Ported from
 * `hunks.py`'s header-and-accumulate loop.
 */
function parseHunks(diffText: string): RawHunk[] {
  const hunks: { newStart: number; added: string[]; removed: string[] }[] = []

  for (const line of diffText.split('\n')) {
    const header = HUNK_HEADER.exec(line)
    if (header) {
      hunks.push({ newStart: Number(header[1]), added: [], removed: [] })
      continue
    }

    const current = hunks.at(-1)
    if (!current) continue

    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.added.push(line.slice(1))
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.removed.push(line.slice(1))
    }
  }

  return hunks
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

const HEADING = /^(#{1,6})\s/

/**
 * The heading-delimited section a zero-based line index sits in, in the
 * current file content: the nearest heading at or above the line, through
 * the next heading at the same level or shallower. Ported from `hunks.py`'s
 * `_section_around`.
 *
 * Returns an empty string when the index sits above every heading, which a
 * malformed doc or one carrying no heading at all can produce and which the
 * caller reads as "no section to show," never as a refusal.
 */
export function sectionAround(
  lines: readonly string[],
  lineIndex: number,
): string {
  let headingIndex: number | undefined
  for (let j = Math.min(lineIndex, lines.length - 1); j >= 0; j--) {
    if (HEADING.test(lines[j])) {
      headingIndex = j
      break
    }
  }
  if (headingIndex === undefined) return ''

  const level = HEADING.exec(lines[headingIndex])?.[1].length ?? 1
  let end = lines.length
  for (let k = headingIndex + 1; k < lines.length; k++) {
    const match = HEADING.exec(lines[k])
    if (match && match[1].length <= level) {
      end = k
      break
    }
  }

  const section = lines.slice(headingIndex, end).join('\n')
  const words = section.split(/\s+/).filter(Boolean)
  if (words.length <= MAX_SECTION_WORDS) return section

  return `${words.slice(0, MAX_SECTION_WORDS).join(' ')} …[section truncated]`
}

/**
 * Every diff-mode chunk in the range `ref..working tree`, across the
 * requested canonical doc types.
 *
 * Reads the working tree rather than `HEAD`, matching `listChangedFiles`: a
 * `docs-fold` run checking a session's own edits sees them before they are
 * committed. A file the range deleted contributes nothing, since there is no
 * current section left to read a hunk's chunk against.
 */
export async function extractDiffChunks(
  root: string,
  ref: string | undefined,
  docTypes: readonly CanonicalDocType[] = CANONICAL_DOC_TYPES,
): Promise<DiffExtraction> {
  const base = await resolveBaseRef(root, ref)
  if (base === undefined) {
    return {
      kind: 'refused',
      reason: 'bad-range',
      message: `could not resolve a merge base for ${ref ?? 'the trunk'}`,
    }
  }

  const changed = await listChangedFiles(root, base)
  if (changed === undefined) {
    return {
      kind: 'refused',
      reason: 'bad-range',
      message: 'git could not list the files changed since the base',
    }
  }

  const scoped = changed
    .map((file) => ({ file, docType: docTypeOf(file) }))
    .filter(
      (entry): entry is { file: string; docType: CanonicalDocType } =>
        entry.docType !== undefined && docTypes.includes(entry.docType),
    )

  const chunks: DiffChunk[] = []

  for (const { file, docType } of scoped) {
    const absolute = resolve(root, file)
    if (!existsSync(absolute)) continue

    let content: string
    try {
      content = readFileSync(absolute, 'utf8')
    } catch {
      return {
        kind: 'refused',
        reason: 'unreadable-file',
        message: `could not read ${file}`,
      }
    }

    const patch = await gitRaw(root, ['diff', '-U0', base, '--', file])
    if (patch === undefined) continue

    const lines = content.split('\n')
    for (const hunk of parseHunks(patch)) {
      const added = hunk.added.join('\n')
      if (wordCount(added) < MIN_ADDED_WORDS) continue

      chunks.push({
        file,
        docType,
        removed: hunk.removed.join('\n'),
        added,
        sectionAfter: sectionAround(lines, hunk.newStart - 1),
      })
    }
  }

  return { kind: 'ok', chunks }
}

export interface SweepSection {
  /** Repo-relative path. */
  readonly file: string
  readonly docType: CanonicalDocType
  readonly heading: string
  readonly body: string
}

/**
 * Splits a file's headings into sweep sections, at H3 where a document
 * carries H3 headings and at H2 otherwise, per the groundwork decision that
 * a large H2 section splits further. An H2 carrying its own prose ahead of
 * its first child H3 contributes that prose as a section of its own, headed
 * by the H2, since it is content nothing else will sweep.
 */
export function sweepSections(
  lines: readonly string[],
): { heading: string; body: string }[] {
  const headings: { index: number; level: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = HEADING.exec(lines[i])
    if (match && match[1].length >= 2 && match[1].length <= 3) {
      headings.push({ index: i, level: match[1].length })
    }
  }

  const sections: { heading: string; body: string }[] = []

  // An H3 sitting before the document's first H2, or in a document that
  // carries no H2 at all, has no enclosing section for the main loop below
  // to attribute it to. Sweep it as a section of its own instead of
  // dropping it, which is the shape of an entry whose H1 is followed
  // directly by H3s with no H2 anywhere.
  const firstH2 = headings.findIndex((h) => h.level === 2)
  const leadingBound = firstH2 === -1 ? headings.length : firstH2

  for (let i = 0; i < leadingBound; i++) {
    const { index, level } = headings[i]
    if (level !== 3) continue

    const nextBoundary = headings.find((h, k) => k > i && h.level <= 3)
    const end = nextBoundary?.index ?? lines.length
    sections.push(bodyOf(lines, index, end))
  }

  for (let i = 0; i < headings.length; i++) {
    const { index, level } = headings[i]
    if (level !== 2) continue

    const nextH2 = headings.findIndex((h, j) => j > i && h.level === 2)
    const sectionEnd = nextH2 === -1 ? lines.length : headings[nextH2].index

    const firstChildH3 = headings.findIndex(
      (h, j) => j > i && h.level === 3 && h.index < sectionEnd,
    )

    if (firstChildH3 === -1) {
      sections.push(bodyOf(lines, index, sectionEnd))
      continue
    }

    if (
      firstChildH3 > i + 1 ||
      hasContent(lines, index + 1, headings[firstChildH3].index)
    ) {
      sections.push(bodyOf(lines, index, headings[firstChildH3].index))
    }

    for (let j = firstChildH3; j < headings.length; j++) {
      const { index: h3Index, level: h3Level } = headings[j]
      if (h3Index >= sectionEnd) break
      if (h3Level !== 3) continue

      const nextBoundary = headings.find(
        (h, k) => k > j && h.index < sectionEnd && h.level <= 3,
      )
      const end = nextBoundary?.index ?? sectionEnd
      sections.push(bodyOf(lines, h3Index, end))
    }
  }

  return sections
}

function hasContent(
  lines: readonly string[],
  start: number,
  end: number,
): boolean {
  return lines.slice(start, end).some((line) => line.trim() !== '')
}

function bodyOf(
  lines: readonly string[],
  start: number,
  end: number,
): { heading: string; body: string } {
  const headingText = lines[start].replace(/^#+\s*/, '').trim()
  return {
    heading: headingText,
    body: lines.slice(start, end).join('\n').trim(),
  }
}

export type SweepExtraction =
  | { readonly kind: 'ok'; readonly sections: readonly SweepSection[] }
  | {
      readonly kind: 'refused'
      readonly reason: ExtractRefusal
      readonly message: string
    }

function readSections(
  path: string,
  docType: CanonicalDocType,
  rel: string,
): SweepSection[] | undefined {
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return undefined
  }

  return sweepSections(content.split('\n')).map((section) => ({
    file: rel,
    docType,
    ...section,
  }))
}

/**
 * Every sweep-mode section across the requested canonical doc types.
 *
 * `context` and `wireframes` resolve through `resolveFolders`, the same
 * folder discovery `canon context audit` uses, so a domain split into a
 * folder of its own is swept the same way it is audited. The three
 * single-file types resolve through `surfaceDir`, agreeing with
 * `architectureRel`'s own resolution.
 */
export async function extractSweepSections(
  root: string,
  docTypes: readonly CanonicalDocType[] = CANONICAL_DOC_TYPES,
): Promise<SweepExtraction> {
  const sections: SweepSection[] = []

  const multi = MULTI_DOC_TYPES.filter((entry) => docTypes.includes(entry.type))

  if (multi.length > 0) {
    const { folders } = await resolveFolders(
      root,
      multi.map((entry) => entry.name),
    )
    for (const folder of folders) {
      const docType = multi.find((entry) => entry.name === folder.name)?.type
      if (!docType) continue

      for (const path of folder.entries) {
        const rel = relative(root, path)
        const found = readSections(path, docType, rel)
        if (found === undefined) {
          return {
            kind: 'refused',
            reason: 'unreadable-file',
            message: `could not read ${rel}`,
          }
        }
        sections.push(...found)
      }
    }
  }

  const single = SINGLE_DOC_TYPES.filter((candidate) =>
    docTypes.includes(candidate.type),
  )

  for (const { type, entry } of single) {
    const path = surfaceDir(root, entry)
    if (!existsSync(path)) continue

    const rel = relative(root, path)
    const found = readSections(path, type, rel)
    if (found === undefined) {
      return {
        kind: 'refused',
        reason: 'unreadable-file',
        message: `could not read ${rel}`,
      }
    }
    sections.push(...found)
  }

  return { kind: 'ok', sections }
}
