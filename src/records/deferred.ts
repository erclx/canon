import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import {
  archiveDir,
  declinedDir,
  isReservedStem,
  tasksDir,
} from '@/tasks/archive'
import { readBullets, shorten } from '@/records/counterpart'

/** The task stems a plan's `## Deferred` bullets may name, read off the board. */
export interface DeferralRoot {
  readonly filed: ReadonlySet<string>
  readonly declined: ReadonlySet<string>
}

export interface DeferralFinding {
  readonly kind: 'deferral-unfiled'
  readonly subject: string
  readonly message: string
}

/**
 * A bare stem only. A `.md` suffix or a folder prefix is reported rather than
 * stripped, so every plan names a deferral the one way the board spells it.
 */
const STEM = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/
const MARKDOWN_SUFFIX = /\.md$/

async function stemsIn(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -'.md'.length))
    .filter((stem) => STEM.test(stem) && !isReservedStem(stem))
}

/**
 * Reads nothing where no tasks folder exists, as in `examples/`, since a
 * project keeping no board has nothing a deferral could be filed against.
 */
export async function readDeferralRoot(
  root: string,
): Promise<DeferralRoot | undefined> {
  if (!existsSync(tasksDir(root))) return undefined

  const [live, archived, declined] = await Promise.all([
    stemsIn(tasksDir(root)),
    stemsIn(archiveDir(root)),
    stemsIn(declinedDir(root)),
  ])

  return {
    filed: new Set([...live, ...archived]),
    declined: new Set(declined),
  }
}

const BULLET_FORM =
  'Write it as "- `<task stem>`: <what is deferred>" under ## Deferred, and file the row before the plan validates.'

function openingSpan(bullet: string): string | undefined {
  return /^-[ \t]*`([^`]+)`/.exec(bullet)?.[1].trim()
}

const NONE_IDENTIFIED = 'None identified.'

/**
 * Lines ahead of the first bullet, which `readBullets` drops. A deferral
 * written there is the prose-only form the section exists to replace.
 */
function proseLines(section: readonly string[]): string[] {
  const firstBullet = section.findIndex((line) => line.trim().startsWith('- '))
  const lead = firstBullet === -1 ? section : section.slice(0, firstBullet)

  return lead
    .map((line) => line.trim())
    .filter((line) => line !== '' && line !== NONE_IDENTIFIED)
}

function unfiled(bullet: string, reason: string): DeferralFinding {
  return {
    kind: 'deferral-unfiled',
    subject: shorten(bullet),
    message: `${reason} ${BULLET_FORM}`,
  }
}

/**
 * Reports each `## Deferred` bullet whose opening span names no live or
 * archived task. A declined row fails too, since nobody will build it.
 */
export function checkDeferrals(
  section: readonly string[] | undefined,
  context: DeferralRoot,
): DeferralFinding[] {
  const findings: DeferralFinding[] = proseLines(section ?? []).map((line) =>
    unfiled(line, 'is prose under ## Deferred, which names no task stem.'),
  )

  for (const bullet of readBullets(section ?? [])) {
    const stem = openingSpan(bullet)

    if (stem === undefined) {
      findings.push(unfiled(bullet, 'opens on no backticked task stem.'))
    } else if (!STEM.test(stem) || MARKDOWN_SUFFIX.test(stem)) {
      findings.push(
        unfiled(
          bullet,
          `names \`${stem}\`, which is not a bare task stem with no folder or .md suffix.`,
        ),
      )
    } else if (context.declined.has(stem) && !context.filed.has(stem)) {
      findings.push(
        unfiled(
          bullet,
          `names \`${stem}\`, a declined task nobody will build.`,
        ),
      )
    } else if (!context.filed.has(stem)) {
      findings.push(
        unfiled(
          bullet,
          `names \`${stem}\`, which no live or archived task carries.`,
        ),
      )
    }
  }

  return findings
}
