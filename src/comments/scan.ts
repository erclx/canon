import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { UnreadFile } from '@/code/length'
import { pythonComments } from '@/code/python'
import { type Placement, placementReader } from '@/comments/placement'
import { listIgnored } from '@/git/ignore'

export type Language = 'ts' | 'sh' | 'py'

export const LANGUAGES: readonly Language[] = ['ts', 'sh', 'py']

const EXTENSIONS: Record<Language, readonly string[]> = {
  ts: ['.ts', '.tsx'],
  sh: ['.sh'],
  py: ['.py'],
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

/** Comment lines past which a run is reported, a prompt to read and not a limit. */
export const BLOCK_LINE_CHECKPOINT = 20

/** A file's longest run of contiguous comment lines, starting at `line`. */
export interface LongBlock {
  readonly file: string
  readonly line: number
  readonly lines: number
}

/** Comment lines from which a run counts toward its file's long-block lines. */
export const LONG_BLOCK_FLOOR = 10

/** In-body comment lines past which the gate fails a run. */
export const BODY_BLOCK_CAP = 10

/** Long-block lines past which the gate fails a file. */
export const FILE_LONG_BLOCK_CAP = 200

/** A run past the checkpoint, with `placement` null where it is unread. */
export interface Block extends LongBlock {
  readonly placement: Placement | null
}

/**
 * One file's runs of `LONG_BLOCK_FLOOR` lines or more, summed. The head and
 * body split is null in a language whose placement is unread.
 */
export interface LongBlockFile {
  readonly file: string
  readonly lines: number
  readonly blocks: number
  readonly headLines: number | null
  readonly bodyLines: number | null
}

export interface LanguageCount {
  readonly language: Language
  readonly files: number
  readonly lines: number
  readonly commentLines: number
  readonly docBlocks: number
  readonly inlineComments: number
  readonly degradationHits: readonly DegradationHit[]
  readonly longBlocks: readonly LongBlock[]
  /** Every run past `BLOCK_LINE_CHECKPOINT`, not only each file's longest. */
  readonly blocks: readonly Block[]
  /** Every in-body run past `BODY_BLOCK_CAP`. */
  readonly bodyBlocks: readonly LongBlock[]
  /** Every file holding a run of `LONG_BLOCK_FLOOR` or more, most lines first. */
  readonly longBlockFiles: readonly LongBlockFile[]
  /** Every Python file whose runs went unplaced, with what refused it. */
  readonly unreadFiles: readonly UnreadFile[]
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

interface Run {
  readonly line: number
  readonly lines: number
  readonly placement: Placement | null
}

interface FileCount {
  readonly lines: number
  readonly commentLines: number
  readonly docBlocks: number
  readonly inlineComments: number
  readonly runs: readonly Run[]
  /** Whether each long run carries a placement, so the head and body split holds. */
  readonly placed: boolean
  readonly unread?: Omit<UnreadFile, 'file'>
}

/** Tracks contiguous comment lines and keeps every run. */
function runTracker() {
  let start = 0
  let length = 0
  const runs: { line: number; lines: number }[] = []

  const close = (): void => {
    if (length > 0) runs.push({ line: start, lines: length })
    length = 0
  }

  return {
    extend(line: number): void {
      if (length === 0) start = line
      length++
    },
    end: close,
    runs(): { line: number; lines: number }[] {
      close()
      return runs
    },
  }
}

/**
 * Places each run of `LONG_BLOCK_FLOOR` lines or more by its first line's
 * first character. Shorter runs feed no placed figure, so a file holding none
 * is never read for its function bodies.
 */
function placeRuns(
  file: SourceFile,
  lines: readonly string[],
  runs: readonly { line: number; lines: number }[],
): Run[] {
  if (!runs.some((run) => run.lines >= LONG_BLOCK_FLOOR)) {
    return runs.map((run) => ({ ...run, placement: null }))
  }
  const starts = [0]
  for (const line of lines) starts.push((starts.at(-1) ?? 0) + line.length + 1)
  const read = placementReader(file.path, file.text)

  return runs.map((run) => {
    if (run.lines < LONG_BLOCK_FLOOR) return { ...run, placement: null }
    const text = lines[run.line - 1] ?? ''
    const offset =
      (starts[run.line - 1] ?? 0) + text.length - text.trimStart().length
    return { ...run, placement: read(offset) }
  })
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
  const runs = runTracker()

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim()

    if (inBlock) {
      commentLines++
      runs.extend(index + 1)
      sweep(trimmed, file.path, index + 1, matchers, hits)
      if (trimmed.includes('*/')) inBlock = false
      continue
    }

    if (trimmed.startsWith('/*')) {
      commentLines++
      runs.extend(index + 1)
      if (/^\/\*\*(?!\/)/.test(trimmed)) docBlocks++
      sweep(trimmed, file.path, index + 1, matchers, hits)
      if (trimmed.indexOf('*/', 2) === -1) inBlock = true
      continue
    }

    if (trimmed.startsWith('//')) {
      commentLines++
      inlineComments++
      runs.extend(index + 1)
      sweep(trimmed, file.path, index + 1, matchers, hits)
      continue
    }

    runs.end()
  }

  return {
    lines: lines.length,
    commentLines,
    docBlocks,
    inlineComments,
    runs: placeRuns(file, lines, runs.runs()),
    placed: true,
  }
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
  const runs = runTracker()

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
        runs.extend(index + 1)
        sweep(trimmed, file.path, index + 1, matchers, hits)
        continue
      }
    }

    runs.end()
    if (trimmed.startsWith('#')) continue

    const opener = HEREDOC_OPENER.exec(line)
    if (opener) delimiter = opener[2]
  }

  return {
    lines: counted,
    commentLines,
    docBlocks: 0,
    inlineComments,
    runs: runs.runs().map((run) => ({ ...run, placement: null })),
    placed: false,
  }
}

/**
 * Counts one Python file, a `#` line as an inline comment and each docstring
 * as one doc block whose every line counts.
 *
 * A docstring is always its own run and always `head`, being the contract of
 * whatever it opens wherever that sits, and a `#` run is `body` when it starts
 * inside a function span, or trails one indented past its header, since a
 * span ends at its last statement. A file the reader refuses still counts its `#`
 * lines by their first character, unplaced, with the refusal on the record.
 */
function countPython(
  file: SourceFile,
  matchers: readonly { term: string; pattern: RegExp }[],
  hits: DegradationHit[],
): FileCount {
  const lines = splitLines(file.text)
  const read = pythonComments(file.text)
  const kinds = new Map<number, string>()

  if (read.kind === 'read') {
    for (const line of read.comments) kinds.set(line, '#')
    for (const doc of read.docstrings) {
      for (let line = doc.start; line <= doc.end; line++) {
        kinds.set(line, `doc:${doc.start}`)
      }
    }
  } else {
    for (const [index, line] of lines.entries()) {
      if (line.trimStart().startsWith('#')) kinds.set(index + 1, '#')
    }
  }
  if (lines[0]?.startsWith('#!') && kinds.get(1) === '#') kinds.delete(1)

  let commentLines = 0
  let inlineComments = 0
  const runs: { line: number; lines: number; kind: string }[] = []
  for (const [index, text] of lines.entries()) {
    const kind = kinds.get(index + 1)
    if (kind === undefined) continue
    commentLines++
    if (kind === '#') inlineComments++
    sweep(text.trim(), file.path, index + 1, matchers, hits)
    const last = runs.at(-1)
    if (last?.kind === kind && last.line + last.lines === index + 1)
      last.lines++
    else runs.push({ line: index + 1, lines: 1, kind })
  }

  const indent = (line: number): number =>
    /^[ \t]*/.exec(lines[line - 1] ?? '')?.[0].length ?? 0
  const quiet = (line: number): boolean =>
    kinds.get(line) === '#' || (lines[line - 1] ?? '').trim() === ''
  const trails = (end: number, line: number): boolean => {
    for (let between = end + 1; between < line; between++) {
      if (!quiet(between)) return false
    }
    return true
  }
  const inBody = (line: number): boolean =>
    read.kind === 'read' &&
    read.spans.some((span) => {
      const end = span.line + span.lines - 1
      if (line <= span.line) return false
      if (line <= end) return true
      return indent(line) > indent(span.line) && trails(end, line)
    })

  return {
    lines: lines.length,
    commentLines,
    docBlocks: read.kind === 'read' ? read.docstrings.length : 0,
    inlineComments,
    runs: runs.map(({ line, lines: length, kind }) => ({
      line,
      lines: length,
      placement:
        read.kind === 'unread' || length < LONG_BLOCK_FLOOR
          ? null
          : kind === '#' && inBody(line)
            ? 'body'
            : 'head',
    })),
    placed: read.kind === 'read',
    ...(read.kind === 'unread'
      ? { unread: { line: read.line, reason: read.reason } }
      : {}),
  }
}

const COUNTERS: Record<
  Language,
  (
    file: SourceFile,
    matchers: readonly { term: string; pattern: RegExp }[],
    hits: DegradationHit[],
  ) => FileCount
> = { ts: countTypeScript, sh: countBash, py: countPython }

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

  const counted = COUNTERS[language](file, matchers, hits)

  const runs = counted.runs.map((run) => ({ file: file.path, ...run }))
  const longest = runs.reduce<(typeof runs)[number] | undefined>(
    (best, run) => (best === undefined || run.lines > best.lines ? run : best),
    undefined,
  )
  const long = runs.filter((run) => run.lines >= LONG_BLOCK_FLOOR)
  const linesWhere = (placement: Placement): number | null =>
    counted.placed
      ? long
          .filter((run) => run.placement === placement)
          .reduce((sum, run) => sum + run.lines, 0)
      : null

  return {
    language,
    files: 1,
    lines: counted.lines,
    commentLines: counted.commentLines,
    docBlocks: counted.docBlocks,
    inlineComments: counted.inlineComments,
    degradationHits: hits,
    longBlocks:
      longest !== undefined && longest.lines > BLOCK_LINE_CHECKPOINT
        ? [{ file: longest.file, line: longest.line, lines: longest.lines }]
        : [],
    blocks: runs.filter((run) => run.lines > BLOCK_LINE_CHECKPOINT),
    bodyBlocks: runs
      .filter((run) => run.placement === 'body' && run.lines > BODY_BLOCK_CAP)
      .map(({ file: path, line, lines }) => ({ file: path, line, lines })),
    longBlockFiles:
      long.length === 0
        ? []
        : [
            {
              file: file.path,
              lines: long.reduce((sum, run) => sum + run.lines, 0),
              blocks: long.length,
              headLines: linesWhere('head'),
              bodyLines: linesWhere('body'),
            },
          ],
    unreadFiles:
      counted.unread === undefined
        ? []
        : [{ file: file.path, ...counted.unread }],
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
      longBlocks: [] as LongBlock[],
      blocks: [] as Block[],
      bodyBlocks: [] as LongBlock[],
      longBlockFiles: [] as LongBlockFile[],
      unreadFiles: [] as UnreadFile[],
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
      totals.longBlocks.push(...count.longBlocks)
      totals.blocks.push(...count.blocks)
      totals.bodyBlocks.push(...count.bodyBlocks)
      totals.longBlockFiles.push(...count.longBlockFiles)
      totals.unreadFiles.push(...count.unreadFiles)
    }

    totals.longBlockFiles.sort(
      (a, b) => b.lines - a.lines || a.file.localeCompare(b.file),
    )

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
