import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { listIgnored } from '@/git/ignore'

export type Language = 'ts' | 'sh'

export const LANGUAGES: readonly Language[] = ['ts', 'sh']

const EXTENSIONS: Record<Language, readonly string[]> = {
  ts: ['.ts', '.tsx'],
  sh: ['.sh'],
}

/**
 * Pruned by path segment rather than by glob, since `Bun.Glob` has no exclude.
 * `fixtures` and `__fixtures__` are here because fixture trees hold content
 * authored to be parsed rather than run, and counting it reports the harness
 * instead of the source.
 */
const PRUNED_SEGMENTS = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'fixtures',
  '__fixtures__',
]

export interface DegradationHit {
  readonly file: string
  readonly line: number
  readonly term: string
}

export interface LanguageCount {
  readonly language: Language
  readonly files: number
  readonly lines: number
  readonly commentLines: number
  readonly docBlocks: number
  readonly inlineComments: number
  readonly degradationHits: readonly DegradationHit[]
}

export interface ScanOptions {
  readonly languages?: readonly Language[]
  readonly vocabulary?: readonly string[]
}

/** One file's text paired with the repo-relative path a hit is reported under. */
export interface SourceFile {
  readonly path: string
  readonly text: string
}

export function languageFor(path: string): Language | undefined {
  for (const language of LANGUAGES) {
    if (EXTENSIONS[language].some((ext) => path.endsWith(ext))) return language
  }
  return undefined
}

export function isPruned(relativePath: string): boolean {
  return relativePath
    .split('/')
    .some((segment) => PRUNED_SEGMENTS.includes(segment))
}

/**
 * Builds the matcher for one vocabulary term.
 *
 * Case sensitivity is derived from the term rather than from a second list:
 * a term carrying an uppercase letter is a marker convention (`TODO`, `HACK`)
 * and matches exactly, while an all-lowercase term is prose (`used to`) and
 * matches either casing. Matching `FIXED` case-insensitively would hit every
 * comment containing the word "fixed", which is why the split exists.
 */
function matcherFor(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const leading = /^\w/.test(term) ? '(?<!\\w)' : ''
  const trailing = /\w$/.test(term) ? '(?!\\w)' : ''
  const flags = /[A-Z]/.test(term) ? '' : 'i'

  return new RegExp(`${leading}${escaped}${trailing}`, flags)
}

function sweep(
  text: string,
  file: string,
  line: number,
  matchers: readonly { term: string; pattern: RegExp }[],
  hits: DegradationHit[],
): void {
  for (const { term, pattern } of matchers) {
    if (pattern.test(text)) hits.push({ file, line, term })
  }
}

function splitLines(text: string): string[] {
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

interface FileCount {
  readonly lines: number
  readonly commentLines: number
  readonly docBlocks: number
  readonly inlineComments: number
}

/**
 * Counts one TypeScript file.
 *
 * A line counts as a comment only when its first non-whitespace token opens
 * one, which is what keeps a URL in a string literal from reading as a `//`
 * comment without an AST. The cost is that a `//` line inside a template
 * literal counts, and a trailing comment after code does not.
 */
function countTypeScript(
  file: SourceFile,
  matchers: readonly { term: string; pattern: RegExp }[],
  hits: DegradationHit[],
): FileCount {
  const lines = splitLines(file.text)
  let commentLines = 0
  let docBlocks = 0
  let inlineComments = 0
  let inBlock = false

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim()

    if (inBlock) {
      commentLines++
      sweep(trimmed, file.path, index + 1, matchers, hits)
      if (trimmed.includes('*/')) inBlock = false
      continue
    }

    if (trimmed.startsWith('/*')) {
      commentLines++
      if (/^\/\*\*(?!\/)/.test(trimmed)) docBlocks++
      sweep(trimmed, file.path, index + 1, matchers, hits)
      if (trimmed.indexOf('*/', 2) === -1) inBlock = true
      continue
    }

    if (trimmed.startsWith('//')) {
      commentLines++
      inlineComments++
      sweep(trimmed, file.path, index + 1, matchers, hits)
    }
  }

  return { lines: lines.length, commentLines, docBlocks, inlineComments }
}

const HEREDOC_OPENER = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/

/**
 * Counts one bash file, skipping heredoc bodies.
 *
 * A heredoc body is data, and this repository's sandbox scenarios carry
 * markdown inside one, where `#` opens a heading rather than a comment.
 * Counting those inflated a measured 112 comment lines to 427. Body lines
 * leave the denominator as well as the numerator, since a density that drops
 * the numerator alone understates by however much data the file carries.
 *
 * The line-1 shebang is excluded. Every script has one, so counting it puts a
 * floor under density that reports the file count rather than the discipline.
 */
function countBash(
  file: SourceFile,
  matchers: readonly { term: string; pattern: RegExp }[],
  hits: DegradationHit[],
): FileCount {
  const lines = splitLines(file.text)
  let counted = 0
  let commentLines = 0
  let inlineComments = 0
  let delimiter: string | undefined

  for (const [index, line] of lines.entries()) {
    if (delimiter !== undefined) {
      // `<<-` strips leading tabs from the terminator, and the plain form
      // requires it at column zero. Trimming covers both without tracking
      // which form opened the body.
      if (line.trim() === delimiter) delimiter = undefined
      continue
    }

    counted++
    const trimmed = line.trim()

    if (trimmed.startsWith('#')) {
      if (!(index === 0 && trimmed.startsWith('#!'))) {
        commentLines++
        inlineComments++
        sweep(trimmed, file.path, index + 1, matchers, hits)
      }
      continue
    }

    const opener = HEREDOC_OPENER.exec(line)
    if (opener) delimiter = opener[2]
  }

  return { lines: counted, commentLines, docBlocks: 0, inlineComments }
}

export function countFile(
  file: SourceFile,
  language: Language,
  vocabulary: readonly string[] = [],
): LanguageCount {
  const matchers = vocabulary.map((term) => ({
    term,
    pattern: matcherFor(term),
  }))
  const hits: DegradationHit[] = []

  const counted =
    language === 'ts'
      ? countTypeScript(file, matchers, hits)
      : countBash(file, matchers, hits)

  return {
    language,
    files: 1,
    lines: counted.lines,
    commentLines: counted.commentLines,
    docBlocks: counted.docBlocks,
    inlineComments: counted.inlineComments,
    degradationHits: hits,
  }
}

/** Counts a set of already-read files, grouped into one entry per language. */
export function countFiles(
  files: readonly SourceFile[],
  opts: ScanOptions = {},
): LanguageCount[] {
  const languages = opts.languages ?? LANGUAGES
  const vocabulary = opts.vocabulary ?? []

  return languages.map((language) => {
    const totals = {
      language,
      files: 0,
      lines: 0,
      commentLines: 0,
      docBlocks: 0,
      inlineComments: 0,
      degradationHits: [] as DegradationHit[],
    }

    for (const file of files) {
      if (languageFor(file.path) !== language) continue
      const count = countFile(file, language, vocabulary)
      totals.files += count.files
      totals.lines += count.lines
      totals.commentLines += count.commentLines
      totals.docBlocks += count.docBlocks
      totals.inlineComments += count.inlineComments
      totals.degradationHits.push(...count.degradationHits)
    }

    return totals
  })
}

export function density(count: LanguageCount): number {
  return count.lines === 0 ? 0 : count.commentLines / count.lines
}

/** Lists the scannable source files under `root`, honoring `.gitignore`. */
export async function listSourceFiles(
  root: string,
  languages: readonly Language[] = LANGUAGES,
): Promise<string[]> {
  const glob = new Bun.Glob('**/*')
  const candidates: string[] = []

  for await (const rel of glob.scan({
    cwd: root,
    onlyFiles: true,
    dot: true,
  })) {
    const normalized = rel.split('\\').join('/')
    if (isPruned(normalized)) continue

    const language = languageFor(normalized)
    if (!language || !languages.includes(language)) continue

    candidates.push(resolve(root, normalized))
  }

  candidates.sort()

  const ignored = await listIgnored(root, candidates)
  return ignored.size === 0
    ? candidates
    : candidates.filter((path) => !ignored.has(path))
}

/**
 * Open descriptors allowed at once while reading a tree.
 *
 * A single `Promise.all` over every path opens one descriptor per file, which
 * exhausts a default 1024 limit on any large repository and fails the whole
 * scan with EMFILE. Reading in bounded batches keeps the parallelism that
 * matters without letting the file count set the ceiling.
 */
const CONCURRENT_READS = 64

/** Scans a working tree on disk. */
export async function scanTree(
  root: string,
  opts: ScanOptions = {},
): Promise<LanguageCount[]> {
  const languages = opts.languages ?? LANGUAGES
  const paths = await listSourceFiles(root, languages)
  const files: SourceFile[] = []

  for (let start = 0; start < paths.length; start += CONCURRENT_READS) {
    const batch = await Promise.all(
      paths.slice(start, start + CONCURRENT_READS).map(async (path) => ({
        path: path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path,
        text: await readFile(path, 'utf8'),
      })),
    )
    files.push(...batch)
  }

  return countFiles(files, opts)
}
