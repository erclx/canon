import { readdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { RETIRED_VERBS, type RetiredVerb } from '@/cli/retired'

export interface RetiredCaller {
  /** Project-relative path of the file holding the call. */
  readonly file: string
  /** One-based line of the call. */
  readonly line: number
  /** The call as typed, such as `canon design render`. */
  readonly verb: string
  readonly release: string
  readonly movedTo: string
}

const WORKFLOWS = '.github/workflows'
const SCRIPTS = 'scripts'
const CODE_FILE = /\.(?:sh|bash|zsh|ts|mts|cts|js|mjs|cjs)$/
const WORKFLOW_FILE = /\.ya?ml$/
// A script path a command line names, such as `bun tools/sync.ts`.
const NAMED_FILE = /[\w./-]+\.(?:sh|bash|zsh|ts|mts|cts|js|mjs|cjs)\b/g
const MAX_FILE_BYTES = 1_000_000

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The two call shapes, a command line and an argument list. A command line may
 * go through `bunx -y` or `npx`, and an argument list carries `canon` as its
 * own quoted element ahead of the verb words.
 */
function callPatterns(verb: RetiredVerb): readonly RegExp[] {
  const words = verb.path.map(escape)
  const shell = words.join('\\s+')
  const list = words.map((word) => `['"]${word}['"]`).join('\\s*,\\s*')
  return [
    new RegExp(`(?:^|[\\s;&|(\`"'])canon\\s+${shell}(?![\\w-])`),
    new RegExp(`['"]canon['"]\\s*,\\s*(?:\\[\\s*)?${list}`),
  ]
}

const PATTERNS = RETIRED_VERBS.map((verb) => ({
  verb,
  patterns: callPatterns(verb),
}))

function isComment(line: string): boolean {
  const trimmed = line.trimStart()
  return trimmed.startsWith('#') || trimmed.startsWith('//')
}

function scanText(file: string, text: string): RetiredCaller[] {
  const callers: RetiredCaller[] = []
  text.split('\n').forEach((content, index) => {
    if (isComment(content)) return
    for (const { verb, patterns } of PATTERNS) {
      if (!patterns.some((pattern) => pattern.test(content))) continue
      callers.push({
        file,
        line: index + 1,
        verb: `canon ${verb.path.join(' ')}`,
        release: verb.release,
        movedTo: verb.movedTo,
      })
    }
  })
  return callers
}

async function readText(root: string, file: string): Promise<string | null> {
  try {
    const path = join(root, file)
    if ((await stat(path)).size > MAX_FILE_BYTES) return null
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

async function listFiles(
  root: string,
  dir: string,
  accepts: RegExp,
): Promise<string[]> {
  try {
    const entries = await readdir(join(root, dir), { withFileTypes: true })
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const path = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          return entry.name === 'node_modules'
            ? []
            : listFiles(root, path, accepts)
        }
        return entry.isFile() && accepts.test(entry.name) ? [path] : []
      }),
    )
    return nested.flat()
  } catch {
    return []
  }
}

async function readScripts(root: string): Promise<Record<string, string>> {
  const text = await readText(root, 'package.json')
  if (text === null) return {}
  try {
    const scripts = (JSON.parse(text) as { scripts?: unknown }).scripts
    if (typeof scripts !== 'object' || scripts === null) return {}
    return Object.fromEntries(
      Object.entries(scripts).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  } catch {
    return {}
  }
}

/**
 * Reads the script values rather than the whole manifest, so a description
 * naming a verb never reports. The line is the script's key, since JSON keeps
 * no line for a value.
 */
async function scanPackageScripts(
  root: string,
  scripts: Record<string, string>,
): Promise<RetiredCaller[]> {
  const lines = ((await readText(root, 'package.json')) ?? '').split('\n')
  return Object.entries(scripts).flatMap(([name, command]) => {
    const key = `${JSON.stringify(name)}:`
    const line = lines.findIndex((text) => text.includes(key)) + 1
    return scanText('package.json', command).map((caller) => ({
      ...caller,
      line: Math.max(line, 1),
    }))
  })
}

function namedFiles(commandLines: readonly string[]): string[] {
  return commandLines.flatMap((line) => line.match(NAMED_FILE) ?? [])
}

function insideRoot(root: string, file: string): boolean {
  if (isAbsolute(file)) return false
  const path = relative(root, join(root, file))
  return path !== '' && !path.startsWith('..')
}

/**
 * Finds the places a project calls a retired verb. It reads only the workflow
 * folder, the `package.json` scripts, `scripts/`, and the files those scripts
 * and workflow steps name, and it runs nothing. A markdown file is never read,
 * so prose naming a verb never reports.
 */
export async function scanRetiredCallers(
  root: string,
): Promise<RetiredCaller[]> {
  const scripts = await readScripts(root)
  const workflows = await listFiles(root, WORKFLOWS, WORKFLOW_FILE)
  const ownScripts = await listFiles(root, SCRIPTS, CODE_FILE)
  const workflowTexts = await Promise.all(
    workflows.map(async (file) => ({
      file,
      text: (await readText(root, file)) ?? '',
    })),
  )

  const named = namedFiles([
    ...Object.values(scripts),
    ...workflowTexts.flatMap(({ text }) => text.split('\n')),
  ])
    .map((file) => file.replace(/^\.\//, ''))
    .filter((file) => insideRoot(root, file))

  const codeFiles = [...new Set([...ownScripts, ...named])]
  const codeTexts = await Promise.all(
    codeFiles.map(async (file) => ({
      file,
      text: await readText(root, file),
    })),
  )

  return [
    ...(await scanPackageScripts(root, scripts)),
    ...workflowTexts.flatMap(({ file, text }) => scanText(file, text)),
    ...codeTexts.flatMap(({ file, text }) =>
      text === null ? [] : scanText(file, text),
    ),
  ]
}
