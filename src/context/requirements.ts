import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { wordCount } from '@/context/architecture'
import { bodyLines } from '@/markdown/scan'
import { surfaceDir } from '@/surface-root'

/**
 * The record this measures, relative to `root`, resolved at either surface
 * root for the reason `architectureRel` gives.
 */
export function requirementsRel(root: string): string {
  return relative(root, surfaceDir(root, 'REQUIREMENTS.md'))
}

export interface RequirementsReport {
  readonly rel: string
  /** The whole record's word count, frontmatter left out. */
  readonly words: number
  /**
   * The most words the record says it holds, absent when it states no cap.
   * Declared by the record rather than held here, so a project that never
   * adopted a cap is measured and never gated.
   */
  readonly wordCap?: number
}

const WORD_CAP_CLAUSE = /\bat\s+most\s+(\d+)\s+words\b/i

/**
 * Reads the word cap a record declares, spelled `at most <n> words`, or
 * nothing. Digits only, since a cap in the hundreds is never spelled out.
 */
export function readRequirementsWordCap(source: string): number | undefined {
  const digits = source.match(WORD_CAP_CLAUSE)?.[1]
  return digits === undefined ? undefined : Number.parseInt(digits, 10)
}

function isMissing(error: unknown): boolean {
  const code = (error as { code?: unknown }).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

/**
 * Measures the record, or reports nothing when the project carries none.
 *
 * Absent rather than zeroed, for the reason `measureArchitecture` gives, and a
 * record present and unreadable propagates the same way.
 */
export async function measureRequirements(
  root: string,
): Promise<RequirementsReport | undefined> {
  const rel = requirementsRel(root)

  let source: string
  try {
    source = await readFile(join(root, rel), 'utf8')
  } catch (error) {
    if (!isMissing(error)) throw error
    return undefined
  }

  const wordCap = readRequirementsWordCap(source)
  return {
    rel,
    words: wordCount(
      bodyLines(source)
        .map((line) => line.text)
        .join('\n'),
    ),
    ...(wordCap !== undefined && { wordCap }),
  }
}

/** Whether the record holds more words than the cap it states. */
export function isOverWordCap(report: RequirementsReport): boolean {
  return report.wordCap !== undefined && report.words > report.wordCap
}
