import type { Finding } from '@/records/validate'
import { PLAN_BRANCH_TYPE } from '@/tasks/branch'
import { constraintBullets, type StackPlan } from '@/tasks/stack'

const PLAN_PREFIX = 'feature-'

const MEMBER_OF = /\bfan[- ]in member of\s+/gi

const FANS_IN = /\bfans in\s+/gi

/**
 * A backticked slug may drop the `feature-` prefix, and a bare one must carry
 * it. Without the prefix a bare word is indistinguishable from the prose that
 * follows the list, so `Fans in feature-a and the rest` would read `the` as a
 * member.
 */
const TICKED_SLUG = /^`((?:feature-)?[a-z0-9][a-z0-9-]*)`/i
const BARE_SLUG = /^(feature-[a-z0-9][a-z0-9-]*)/i

const LIST_SEPARATOR = /^\s*(?:,\s*(?:and\s+)?|and\s+)/i

function stemOf(slug: string): string {
  const lower = slug.toLowerCase()

  return lower.startsWith(PLAN_PREFIX) ? lower : `${PLAN_PREFIX}${lower}`
}

function leadingSlug(text: string): { stem: string; rest: string } | null {
  const match = TICKED_SLUG.exec(text) ?? BARE_SLUG.exec(text)
  const slug = match?.[1]
  if (match === null || slug === undefined) return null

  return { stem: stemOf(slug), rest: text.slice(match[0].length) }
}

/** Every slug in the list standing after each match of `phrase`, in order. */
function readList(text: string, phrase: RegExp, many: boolean): string[] {
  const stems: string[] = []

  for (const bullet of constraintBullets(text)) {
    for (const match of bullet.matchAll(phrase)) {
      let rest = bullet.slice((match.index ?? 0) + match[0].length)

      for (;;) {
        const slug = leadingSlug(rest)
        if (slug === null) break
        stems.push(slug.stem)
        if (!many) break

        const separator = LIST_SEPARATOR.exec(slug.rest)
        if (separator === null) break
        rest = slug.rest.slice(separator[0].length)
      }
    }
  }

  return [...new Set(stems)]
}

/** The integrators a member plan names, which a conforming member holds one of. */
export function readFanInIntegrators(text: string): string[] {
  return readList(text, MEMBER_OF, false)
}

/** The members an integrator plan fans in, in the order its merges run. */
export function readFanInMembers(text: string): string[] {
  return readList(text, FANS_IN, true)
}

/**
 * The branch a member builds on, derived the way `planBranch` derives it, since
 * the integrator merges and the dispatch gate reads the branch the worker took.
 */
export function fanInBranch(stem: string): string {
  const slug = stem.startsWith(PLAN_PREFIX)
    ? stem.slice(PLAN_PREFIX.length)
    : stem

  return `${PLAN_BRANCH_TYPE}/${slug}`
}

function unmatched(stem: string, subject: string, message: string): Finding {
  return { kind: 'fan-in-unmatched', record: `${stem}.md`, subject, message }
}

/**
 * Every place a fan-in set's two sides disagree across the live plans.
 *
 * An absent plan is reported rather than skipped, unlike `stackFindings`. The
 * caller hands over the live folder only, so a member archived after it merged
 * reads as absent, and an integrator still listing it would otherwise take its
 * leftover branch on origin as a member that finished.
 *
 * A member two integrators list is reported on each of them rather than paired
 * with whichever sorts first, since either merge would carry it.
 */
export function fanInFindings(plans: readonly StackPlan[]): Finding[] {
  const integratorsOf = new Map(
    plans.map((plan) => [plan.stem, readFanInIntegrators(plan.text)]),
  )
  const membersOf = new Map(
    plans.map((plan) => [plan.stem, readFanInMembers(plan.text)]),
  )
  const listers = new Map<string, string[]>()
  for (const [integrator, members] of membersOf) {
    for (const member of members) {
      listers.set(member, [...(listers.get(member) ?? []), integrator])
    }
  }

  const findings: Finding[] = []

  for (const { stem } of plans) {
    const integrators = integratorsOf.get(stem) ?? []

    for (const integrator of integrators) {
      if (integrators.length > 1) {
        findings.push(
          unmatched(
            stem,
            integrator,
            `is a fan-in member of ${integrators.map((name) => `\`${name}\``).join(' and ')}. A member fans in to one integrator.`,
          ),
        )
      } else if (!membersOf.has(integrator)) {
        findings.push(
          unmatched(
            stem,
            integrator,
            `is a fan-in member of \`${integrator}\`, which is not a live plan. Write the integrator's plan, or drop the member bullet.`,
          ),
        )
      } else if (!(membersOf.get(integrator) ?? []).includes(stem)) {
        findings.push(
          unmatched(
            stem,
            integrator,
            `is a fan-in member of \`${integrator}\`, whose \`Fans in\` bullet does not list it.`,
          ),
        )
      }
    }

    for (const member of membersOf.get(stem) ?? []) {
      const others = (listers.get(member) ?? []).filter((name) => name !== stem)

      if (others.length > 0) {
        findings.push(
          unmatched(
            stem,
            member,
            `fans in \`${member}\`, which ${others.map((name) => `\`${name}\``).join(' and ')} also fans in. A member fans in to one integrator.`,
          ),
        )
      } else if (!integratorsOf.has(member)) {
        findings.push(
          unmatched(
            stem,
            member,
            `fans in \`${member}\`, which is not a live plan. An archived member is not a finished one, so drop it from the list or restore its plan.`,
          ),
        )
      } else if (!(integratorsOf.get(member) ?? []).includes(stem)) {
        findings.push(
          unmatched(
            stem,
            member,
            `fans in \`${member}\`, which does not name it as its integrator.`,
          ),
        )
      }
    }
  }

  return findings
}
