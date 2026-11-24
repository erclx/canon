import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { UnreadFile } from '@/code/length'
import { pythonComments } from '@/code/python'
import { type Placement, placementReader } from '@/comments/placement'
import { listIgnored } from '@/git/ignore'

export type Language = 'ts' | 'sh' | 'py' | 'config'

export const LANGUAGES: readonly Language[] = ['ts', 'sh', 'py', 'config']

const EXTENSIONS: Record<Language, readonly string[]> = {
  ts: ['.ts', '.tsx'],
  sh: ['.sh'],
  py: ['.py'],
  config: ['.yml', '.yaml', '.toml'],
}

/**
 * Pruned by path segment, since `Bun.Glob` has no exclude. A fixture tree holds
 * content authored to be parsed, and counting it reports the harness.
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

/**
 * Change history a comment carries, which belongs to the pull request. Patterns
 * rather than vocabulary terms, so they live here and match with no rule
 * loaded. A format example writes a placeholder such as `<YYYY-MM-DD>`.
 */
export const HISTORY_PATTERNS: readonly {
  readonly term: string
  readonly pattern: RegExp
}[] = [
  { term: 'date', pattern: /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/ },
  {
    term: 'commit hash',
    pattern: /(?<!\w)(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}(?!\w)/,
  },
  { term: 'issue reference', pattern: /(?<![\w&])#\d+(?!\w)/ },
]

/** Run lines past which a run is reported, the length of a passing JSDoc. */
export const BLOCK_LINE_CHECKPOINT = 5

/** Text lines past which the gate fails a run outside every function body. */
export const HEAD_TEXT_CAP = 3

/** In-body text lines past which the gate fails a run. */
export const BODY_BLOCK_CAP = 1

/** Share of a file's non-blank lines past which its comment text is reported. */
export const FILE_SHARE_CAP = 0.15

/** Non-blank lines below which a share is not read, since one note tips it. */
export const FILE_SHARE_FLOOR = 50

/** A comment line that is only a delimiter, carrying no text. */
const BARE_DELIMITERS = new Set(['/**', '/*', '*/', '*', '//', '#', '"""'])

/** An instruction to a tool rather than a note to a reader. */
export const DIRECTIVE_PATTERN =
  /^(?:\/\/|\/\*+|\*|#)\s*(?:biome-ignore|eslint-disable|@ts-expect-error|@ts-ignore|prettier-ignore|shellcheck\s+(?:disable|enable|source|shell)=|noqa\b|type:\s*ignore\b|canon-allow-|canon-keep-)/

/** Whether a trimmed comment line carries text a reader reads. */
export function isTextLine(trimmed: string): boolean {
  return !BARE_DELIMITERS.has(trimmed) && !DIRECTIVE_PATTERN.test(trimmed)
}

/** A file's longest run of contiguous comment lines, starting at `line`. */
export interface LongBlock {
  readonly file: string
  readonly line: number
  readonly lines: number
}

/** A run past a cap, with the text lines the cap counts. */
export interface CappedRun extends LongBlock {
  readonly textLines: number
}

/** A file past the share cap, with the counts its share was read from. */
export interface FileShare {
  readonly file: string
  readonly textLines: number
  readonly nonBlankLines: number
}

/** A run past the checkpoint, with `placement` null where it is unread. */
export interface Block extends LongBlock {
  readonly placement: Placement | null
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
  /** Every run past `HEAD_TEXT_CAP` outside a function body, unplaced included. */
  readonly headBlocks: readonly CappedRun[]
  /** Every in-body run past `BODY_BLOCK_CAP`. */
  readonly bodyBlocks: readonly CappedRun[]
  /** Every file of `FILE_SHARE_FLOOR` lines or more past `FILE_SHARE_CAP`. */
  readonly fileShares: readonly FileShare[]
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
 * A term carrying an uppercase letter is a marker and matches exactly, and an
 * all-lowercase term is prose and matches either casing, so a marker never
 * hits the same word in ordinary prose.
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

interface RawRun {
  line: number
  lines: number
  text: number
}

interface Run extends Readonly<RawRun> {
  readonly placement: Placement | null
}

interface FileCount {
  readonly lines: number
  readonly nonBlankLines: number
  readonly textLines: number
  readonly commentLines: number
  readonly docBlocks: number
  readonly inlineComments: number
  readonly runs: readonly Run[]
  readonly unread?: Omit<UnreadFile, 'file'>
}

/** Tracks contiguous comment lines, keeping every run and its text lines. */
function runTracker() {
  let current: RawRun | undefined
  let textLines = 0
  const runs: RawRun[] = []

  const close = (): void => {
    if (current !== undefined) runs.push(current)
    current = undefined
  }

  return {
    extend(line: number, trimmed: string): void {
      current ??= { line, lines: 0, text: 0 }
      current.lines++
      if (isTextLine(trimmed)) {
        current.text++
        textLines++
      }
    },
    end: close,
    runs(): RawRun[] {
      close()
      return runs
    },
    textLines: (): number => textLines,
  }
}

function nonBlank(lines: readonly string[]): number {
  return lines.filter((line) => line.trim() !== '').length
}

/**
 * Places each run past `BODY_BLOCK_CAP` by its first line's first character.
 * Shorter runs pass every cap wherever they sit, so a file holding none is
 * never read for its function bodies.
 */
function placeRuns(
  file: SourceFile,
  lines: readonly string[],
  runs: readonly RawRun[],
): Run[] {
  if (!runs.some((run) => run.text > BODY_BLOCK_CAP)) {
    return runs.map((run) => ({ ...run, placement: null }))
  }
  const starts = [0]
  for (const line of lines) starts.push((starts.at(-1) ?? 0) + line.length + 1)
  const read = placementReader(file.path, file.text)

  return runs.map((run) => {
    if (run.text <= BODY_BLOCK_CAP) return { ...run, placement: null }
    const text = lines[run.line - 1] ?? ''
    const offset =
      (starts[run.line - 1] ?? 0) + text.length - text.trimStart().length
    return { ...run, placement: read(offset) }
  })
}

/**
 * A line is a comment only when its first token opens one, which keeps a URL in
 * a string from reading as `//` without an AST, at the cost of counting a `//`
 * line in a template literal and missing a trailing comment.
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
      runs.extend(index + 1, trimmed)
      sweep(trimmed, file.path, index + 1, matchers, hits)
      if (trimmed.includes('*/')) inBlock = false
      continue
    }

    if (trimmed.startsWith('/*')) {
      commentLines++
      runs.extend(index + 1, trimmed)
      if (/^\/\*\*(?!\/)/.test(trimmed)) docBlocks++
      sweep(trimmed, file.path, index + 1, matchers, hits)
      if (trimmed.indexOf('*/', 2) === -1) inBlock = true
      continue
    }

    if (trimmed.startsWith('//')) {
      commentLines++
      inlineComments++
      runs.extend(index + 1, trimmed)
      sweep(trimmed, file.path, index + 1, matchers, hits)
      continue
    }

    runs.end()
  }

  return {
    lines: lines.length,
    nonBlankLines: nonBlank(lines),
    textLines: runs.textLines(),
    commentLines,
    docBlocks,
    inlineComments,
    runs: placeRuns(file, lines, runs.runs()),
  }
}

const HEREDOC_OPENER = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/

/**
 * A heredoc body is data, often markdown whose `#` opens a heading, so its lines
 * leave the denominator as well as the numerator. The line-1 shebang is left
 * out, since every script has one and counting it reports the file count.
 */
function countBash(
  file: SourceFile,
  matchers: readonly { term: string; pattern: RegExp }[],
  hits: DegradationHit[],
): FileCount {
  const lines = splitLines(file.text)
  let counted = 0
  let nonBlankLines = 0
  let commentLines = 0
  let inlineComments = 0
  let delimiter: string | undefined
  const runs = runTracker()

  for (const [index, line] of lines.entries()) {
    if (delimiter !== undefined) {
      // Trimming covers both `<<-`, which strips tabs, and the column-zero form.
      if (line.trim() === delimiter) delimiter = undefined
      continue
    }

    counted++
    const trimmed = line.trim()
    if (trimmed !== '') nonBlankLines++

    if (trimmed.startsWith('#')) {
      if (!(index === 0 && trimmed.startsWith('#!'))) {
        commentLines++
        inlineComments++
        runs.extend(index + 1, trimmed)
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
    nonBlankLines,
    textLines: runs.textLines(),
    commentLines,
    docBlocks: 0,
    inlineComments,
    runs: runs.runs().map((run) => ({ ...run, placement: null })),
  }
}

/**
 * A docstring is its own run and always `head`, being the contract of what it
 * opens. A `#` run is `body` inside a function span or trailing one indented
 * past its header, and a refused file counts `#` lines unplaced.
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
  let textLines = 0
  const runs: (RawRun & { kind: string })[] = []
  for (const [index, text] of lines.entries()) {
    const kind = kinds.get(index + 1)
    if (kind === undefined) continue
    commentLines++
    if (kind === '#') inlineComments++
    const trimmed = text.trim()
    const isText = isTextLine(trimmed) ? 1 : 0
    textLines += isText
    sweep(trimmed, file.path, index + 1, matchers, hits)
    const last = runs.at(-1)
    if (last?.kind === kind && last.line + last.lines === index + 1) {
      last.lines++
      last.text += isText
    } else runs.push({ line: index + 1, lines: 1, text: isText, kind })
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
    nonBlankLines: nonBlank(lines),
    textLines,
    commentLines,
    docBlocks: read.kind === 'read' ? read.docstrings.length : 0,
    inlineComments,
    runs: runs.map(({ line, lines: length, text, kind }) => ({
      line,
      lines: length,
      text,
      placement:
        read.kind === 'unread' || text <= BODY_BLOCK_CAP
          ? null
          : kind === '#' && inBody(line)
            ? 'body'
            : 'head',
    })),
    ...(read.kind === 'unread'
      ? { unread: { line: read.line, reason: read.reason } }
      : {}),
  }
}

/**
 * Reads `#` comments for the vocabulary and history matchers only. Runs stay
 * empty and no text counts, since the block and share caps govern code and a
 * config file's comments are read key by key.
 */
function countConfig(
  file: SourceFile,
  matchers: readonly { term: string; pattern: RegExp }[],
  hits: DegradationHit[],
): FileCount {
  const lines = splitLines(file.text)
  let commentLines = 0

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('#')) continue
    commentLines++
    sweep(trimmed, file.path, index + 1, matchers, hits)
  }

  return {
    lines: lines.length,
    nonBlankLines: nonBlank(lines),
    textLines: 0,
    commentLines,
    docBlocks: 0,
    inlineComments: commentLines,
    runs: [],
  }
}

function capped(run: Run & { readonly file: string }): CappedRun {
  return {
    file: run.file,
    line: run.line,
    lines: run.lines,
    textLines: run.text,
  }
}

const COUNTERS: Record<
  Language,
  (
    file: SourceFile,
    matchers: readonly { term: string; pattern: RegExp }[],
    hits: DegradationHit[],
  ) => FileCount
> = {
  ts: countTypeScript,
  sh: countBash,
  py: countPython,
  config: countConfig,
}

export function countFile(
  file: SourceFile,
  language: Language,
  vocabulary: readonly string[] = [],
): LanguageCount {
  const matchers = [
    ...vocabulary.map((term) => ({ term, pattern: matcherFor(term) })),
    ...HISTORY_PATTERNS,
  ]
  const hits: DegradationHit[] = []

  const counted = COUNTERS[language](file, matchers, hits)

  const runs = counted.runs.map((run) => ({ file: file.path, ...run }))
  const longest = runs.reduce<(typeof runs)[number] | undefined>(
    (best, run) => (best === undefined || run.lines > best.lines ? run : best),
    undefined,
  )
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
    blocks: runs
      .filter((run) => run.lines > BLOCK_LINE_CHECKPOINT)
      .map(({ file: path, line, lines, placement }) => ({
        file: path,
        line,
        lines,
        placement,
      })),
    headBlocks: runs
      .filter((run) => run.placement !== 'body' && run.text > HEAD_TEXT_CAP)
      .map(capped),
    bodyBlocks: runs
      .filter((run) => run.placement === 'body' && run.text > BODY_BLOCK_CAP)
      .map(capped),
    fileShares:
      counted.nonBlankLines >= FILE_SHARE_FLOOR &&
      counted.textLines / counted.nonBlankLines > FILE_SHARE_CAP
        ? [
            {
              file: file.path,
              textLines: counted.textLines,
              nonBlankLines: counted.nonBlankLines,
            },
          ]
        : [],
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
      headBlocks: [] as CappedRun[],
      bodyBlocks: [] as CappedRun[],
      fileShares: [] as FileShare[],
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
      totals.headBlocks.push(...count.headBlocks)
      totals.bodyBlocks.push(...count.bodyBlocks)
      totals.fileShares.push(...count.fileShares)
      totals.unreadFiles.push(...count.unreadFiles)
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
 * Open descriptors allowed at once, since one `Promise.all` over every path
 * exhausts a default 1024 limit on a large repository and fails with EMFILE.
 */
const CONCURRENT_READS = 64

/**
 * A path the caller named, already checked to exist. A file carries its
 * checkout, since the gate prunes a touched path relative to the repository.
 */
export type ScanTarget =
  | { readonly kind: 'directory'; readonly path: string }
  | { readonly kind: 'file'; readonly path: string; readonly checkout: string }

function relativeTo(base: string, path: string): string {
  return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path
}

/** Scans a working tree on disk. */
export async function scanTree(
  root: string,
  opts: ScanOptions = {},
): Promise<LanguageCount[]> {
  return scanPaths([{ path: root, kind: 'directory' }], root, opts)
}

/**
 * Scans each file once, reporting a directory's files relative to it and a
 * named file relative to `base`, or absolute outside it.
 */
export async function scanPaths(
  targets: readonly ScanTarget[],
  base: string,
  opts: ScanOptions = {},
): Promise<LanguageCount[]> {
  const languages = opts.languages ?? LANGUAGES
  const labels = new Map<string, string>()

  for (const target of targets) {
    if (target.kind === 'directory') {
      for (const path of await listSourceFiles(target.path, languages)) {
        if (!labels.has(path)) labels.set(path, relativeTo(target.path, path))
      }
      continue
    }

    const language = languageFor(target.path)
    if (!language || !languages.includes(language)) continue
    if (isPruned(relativeTo(target.checkout, target.path))) continue
    if (!labels.has(target.path)) {
      labels.set(target.path, relativeTo(base, target.path))
    }
  }

  const entries = [...labels]
  const files: SourceFile[] = []

  for (let start = 0; start < entries.length; start += CONCURRENT_READS) {
    const batch = await Promise.all(
      entries
        .slice(start, start + CONCURRENT_READS)
        .map(async ([path, label]) => ({
          path: label,
          text: await readFile(path, 'utf8'),
        })),
    )
    files.push(...batch)
  }

  return countFiles(files, opts)
}
