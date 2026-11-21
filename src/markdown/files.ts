import { existsSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { listRepositoryFiles } from '@/git/files'

const MARKDOWN = /\.md$/

/**
 * `unavailable` is a distinct state from an empty scope.
 *
 * A bare run takes its corpus from git, and a git that cannot answer would
 * otherwise resolve zero files and report every one of them clean.
 */
export type FileScope =
  | {
      readonly kind: 'resolved'
      readonly files: readonly string[]
      /** Arguments matching no markdown file, which is a typo rather than a pass. */
      readonly unmatched: readonly string[]
    }
  | { readonly kind: 'unavailable' }

/**
 * Every reason `canon markdown audit` refuses for. None is an ordinary absence,
 * since `no-git` is a broken checkout and a tree with no markdown, or an
 * argument matching none, is a corpus this run could not build.
 */
export type MarkdownAuditRefusal = 'no-git' | 'no-markdown' | 'no-match'

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Compiles the pattern once rather than per candidate. */
function matchGlob(files: readonly string[], pattern: string): string[] {
  const glob = new Bun.Glob(pattern)
  return files.filter((each) => glob.match(each))
}

/**
 * Resolves the arguments to a markdown file list, repo-relative and sorted. The
 * corpus is what git lists, a directory narrows it by prefix and a pattern by
 * match, and an explicit file path is taken as given so a draft can be measured.
 */
export async function resolveMarkdown(
  root: string,
  args: readonly string[],
): Promise<FileScope> {
  const listed = await listRepositoryFiles(root)
  if (!listed) return { kind: 'unavailable' }

  const markdown = listed.filter((rel) => MARKDOWN.test(rel))

  if (args.length === 0) {
    return { kind: 'resolved', files: markdown, unmatched: [] }
  }

  const files = new Set<string>()
  const unmatched: string[] = []

  for (const arg of args) {
    const absolute = resolve(root, arg)
    const rel = relative(root, absolute)

    if (!isDirectory(absolute) && MARKDOWN.test(arg) && !arg.includes('*')) {
      if (existsSync(absolute)) files.add(rel)
      else unmatched.push(arg)
      continue
    }

    // An empty `rel` is the root itself, where the prefix matches nothing and would report no file.
    const matched = isDirectory(absolute)
      ? rel === ''
        ? markdown
        : markdown.filter((each) => each === rel || each.startsWith(`${rel}/`))
      : matchGlob(markdown, arg)

    if (matched.length === 0) {
      unmatched.push(arg)
      continue
    }

    for (const each of matched) files.add(each)
  }

  return { kind: 'resolved', files: [...files].sort(), unmatched }
}
