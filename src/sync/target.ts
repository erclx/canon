import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DESIGN_INSTALL_DIR } from '@/design/adapter'
import { isDirectory } from '@/targets/validate'

export const SYNC_DOMAINS = ['governance', 'design', 'claude'] as const

export type SyncDomain = (typeof SYNC_DOMAINS)[number]

export interface DomainState {
  readonly domain: SyncDomain
  readonly installed: boolean
}

const DOMAIN_MARKERS: Record<SyncDomain, string> = {
  governance: join('.claude', 'rules'),
  design: DESIGN_INSTALL_DIR,
  claude: '.claude',
}

/**
 * Paths whose git status decides whether a domain contributed to the sync
 * commit. Governance carries the retired `.claude/GOV.md` because a sync that
 * removes it is still a governance change, and `claude` watches `.gitignore`
 * because that is the only file `canon claude sync` writes.
 */
const DOMAIN_PATHS: Record<SyncDomain, readonly string[]> = {
  governance: ['.claude/rules/', '.claude/GOV.md'],
  design: ['.claude/design/'],
  claude: ['.gitignore'],
}

export function domainPaths(domain: SyncDomain): readonly string[] {
  return DOMAIN_PATHS[domain]
}

export function detectDomains(target: string): DomainState[] {
  return SYNC_DOMAINS.map((domain) => ({
    domain,
    installed: isDirectory(join(target, DOMAIN_MARKERS[domain])),
  }))
}

export function installedDomains(states: readonly DomainState[]): SyncDomain[] {
  return states.filter((state) => state.installed).map((state) => state.domain)
}

/**
 * Whether a domain's sync command should run, which is not the same question
 * `detectDomains` answers. Governance reports as absent without
 * `.claude/rules/`, yet still syncs when only the retired `.claude/GOV.md`
 * remains, so that the sync can delete it. The bash drew the same distinction
 * between `detect_domains` and `run_syncs`.
 */
export function shouldSync(target: string, domain: SyncDomain): boolean {
  if (domain === 'governance') {
    return (
      isDirectory(join(target, '.claude', 'rules')) ||
      existsSync(join(target, '.claude', 'GOV.md'))
    )
  }

  return isDirectory(join(target, DOMAIN_MARKERS[domain]))
}

/**
 * A target with no `.git/` reports clean, because `git status` fails there and
 * the bash swallowed that failure. The guard exists to make the sync commit
 * survivable, and a directory outside git has no commit to protect.
 */
export function isTreeClean(status: string): boolean {
  return status.trim() === ''
}
