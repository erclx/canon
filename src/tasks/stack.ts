import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { recordDir } from '@/roots/record'
import type { Finding } from '@/records/validate'
import { splitPlanSections } from '@/records/validate'
import { readDeclarations } from '@/tasks/reach'

/**
 * The fold thresholds, calibrated over 1,043 live and archived plans in which
 * 87 stack pairs name a parent. At these values 15 report: the inspector,
 * canvas, slides, and evidence chains, plus one sandbox contract split that
 * carries a `Judged apart from` line. The ceiling drops one pair of 24 files.
 * The per-PR cost was never measured as a number, so these are calibrated
 * against the corpus and not derived.
 */
export const MIN_SHARED = 3
export const MIN_OVERLAP = 0.6
export const MAX_UNION = 20

const STACK_PARENT =
  /(?:stacks? on|builds? on|branch(?:es)? from)\s+(?:(?:the|batch|plan|slice)\s+)*`(feature-[a-z0-9-]+)`/gi

const JUDGED_APART = /^judged apart from\s+`(feature-[a-z0-9-]+)`:\s*\S/i

const BULLET = /^[-*]\s+/

export interface StackPlan {
  readonly stem: string
  readonly text: string
}

export interface StackPair {
  readonly child: string
  readonly parent: string
  readonly shared: number
  readonly union: number
}

/**
 * One string per `**Constraints:**` bullet, with a wrapped continuation line
 * joined to the bullet it belongs to.
 */
function constraintBullets(text: string): string[] {
  const bullets: string[] = []

  for (const line of splitPlanSections(text).get('Constraints') ?? []) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue

    if (BULLET.test(trimmed)) bullets.push(trimmed.replace(BULLET, ''))
    else if (bullets.length > 0) bullets[bullets.length - 1] += ` ${trimmed}`
  }

  return bullets
}

/**
 * The plan stems a plan says it stacks on, in the order written.
 *
 * Only the slug standing directly after the phrase counts, with at most a
 * filler word between. A line like "`feature-x` stacks on this slice, not on
 * `feature-y`" names a parent for `feature-y`'s plan and none for this one, and
 * reading every slug on a stack-worded line would hand it the wrong parent.
 */
export function readStackParents(text: string): string[] {
  const parents: string[] = []

  for (const bullet of constraintBullets(text)) {
    for (const match of bullet.matchAll(STACK_PARENT)) {
      const parent = match[1]
      if (parent !== undefined) parents.push(parent.toLowerCase())
    }
  }

  return [...new Set(parents)]
}

function isJudgedApart(text: string, parent: string): boolean {
  return constraintBullets(text).some(
    (bullet) => JUDGED_APART.exec(bullet)?.[1]?.toLowerCase() === parent,
  )
}

/** Whether two declarations name the same file or one folder holding the other. */
function overlaps(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
}

function countShared(from: readonly string[], to: readonly string[]): number {
  return from.filter((entry) => to.some((other) => overlaps(entry, other)))
    .length
}

/**
 * Every live plan that stacks on a live sibling it mostly shares files with and
 * has not written down why the two are judged apart.
 *
 * A parent absent from `plans` is never reported, which is how an archived
 * parent stays clear: the caller hands over the live folder only, so a merged
 * parent cannot be folded into. When two plans each name the other, the pair is
 * reported once, on the child sorting second.
 *
 * A folder declaration counts as sharing the files under it, taking the larger
 * of the two directions and capping at the smaller set, so a folder and the
 * files beneath it are not undercounted as distinct strings.
 */
export function stackPairs(plans: readonly StackPlan[]): StackPair[] {
  const byStem = new Map(plans.map((plan) => [plan.stem, plan]))
  const pairs: StackPair[] = []

  for (const child of plans) {
    for (const parentStem of readStackParents(child.text)) {
      const parent = byStem.get(parentStem)
      if (parent === undefined || parent.stem === child.stem) continue

      const mutual = readStackParents(parent.text).includes(child.stem)
      if (mutual && child.stem < parent.stem) continue

      if (isJudgedApart(child.text, parentStem)) continue

      const own = readDeclarations(child.text)
      const theirs = readDeclarations(parent.text)
      const smaller = Math.min(own.length, theirs.length)
      if (smaller === 0) continue

      const shared = Math.min(
        smaller,
        Math.max(countShared(own, theirs), countShared(theirs, own)),
      )
      const union = new Set([...own, ...theirs]).size

      if (
        shared >= MIN_SHARED &&
        shared / smaller >= MIN_OVERLAP &&
        union <= MAX_UNION
      ) {
        pairs.push({ child: child.stem, parent: parentStem, shared, union })
      }
    }
  }

  return pairs
}

/** The `Judged apart from` remedy, worded once for the finding and the gate. */
export const JUDGED_APART_REMEDY =
  'Fold the batch into its parent as contiguous commits on one branch, or write `Judged apart from `feature-<parent>`: <reason>` in its constraints.'

export function stackFindings(plans: readonly StackPlan[]): Finding[] {
  return stackPairs(plans).map(({ child, parent, shared, union }) => ({
    kind: 'stack-foldable',
    record: `${child}.md`,
    subject: parent,
    message: `stacks on \`${parent}\` and shares ${shared} declared files with it, ${union} between the two. ${JUDGED_APART_REMEDY}`,
  }))
}

/**
 * The live plans folder as stem and text pairs. The archive is a folder below
 * this one and is never walked, so a merged parent is absent and stays clear.
 */
export async function readLivePlans(root: string): Promise<StackPlan[]> {
  const dir = recordDir(root, 'plans')
  if (!existsSync(dir)) return []

  const names = (await readdir(dir)).filter((name) => name.endsWith('.md'))
  names.sort()

  return Promise.all(
    names.map(async (name) => ({
      stem: basename(name, '.md'),
      text: await readFile(join(dir, name), 'utf8'),
    })),
  )
}
