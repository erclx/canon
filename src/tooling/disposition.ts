import { join, posix } from 'node:path'
import {
  type DomainDispositions,
  hashFile,
  readStamp,
  stampedDispositions,
} from '@/sync/stamp'
import { configFiles, type Manifest, seedFiles } from '@/tooling/manifest'

/** A golden file as the chain ships it: the stack that wins, and that copy's hash. */
export interface GoldenPath {
  readonly rel: string
  readonly stack: string
  readonly kind: 'config' | 'seed'
  readonly hash: string
}

export type Transition =
  | { readonly ok: true; readonly dispositions: DomainDispositions }
  | { readonly ok: false; readonly reason: string; readonly message: string }

export function readDispositions(target: string): DomainDispositions {
  return stampedDispositions(readStamp(target), 'tooling')
}

/**
 * The posix key a target-relative path is recorded under, or undefined for a
 * path that leaves the target, since no golden file lives there.
 */
export function normalizeGoldenPath(input: string): string | undefined {
  const rel = posix.normalize(input.split('\\').join('/'))
  if (rel === '.' || rel === '' || posix.isAbsolute(rel)) return undefined
  if (rel === '..' || rel.startsWith('../')) return undefined
  return rel
}

/**
 * Resolves a path the way `scan` and the injectors do: nearest stack first,
 * and a config shadows a seed at the same path. The hash is of the copy
 * `injectConfigs` writes last, which is the nearest stack's.
 */
export function resolveGolden(
  chain: readonly Manifest[],
  rel: string,
): GoldenPath | undefined {
  for (const manifest of chain) {
    if (configFiles(manifest).includes(rel)) {
      return golden(manifest, rel, 'config', manifest.configsDir)
    }
  }
  for (const manifest of chain) {
    if (seedFiles(manifest).includes(rel)) {
      return golden(manifest, rel, 'seed', manifest.seedsDir)
    }
  }
  return undefined
}

function golden(
  manifest: Manifest,
  rel: string,
  kind: GoldenPath['kind'],
  dir: string,
): GoldenPath {
  return { rel, stack: manifest.name, kind, hash: hashFile(join(dir, rel)) }
}

export function decline(
  dispositions: DomainDispositions,
  path: GoldenPath | undefined,
  reason?: string,
): Transition {
  if (path === undefined) return NOT_GOLDEN
  const { rel } = path
  const held = refuseHeld(dispositions, rel)
  if (held !== undefined) return held

  return {
    ok: true,
    dispositions: {
      ...dispositions,
      [rel]: {
        disposition: 'declined',
        ...(reason === undefined ? {} : { reason }),
      },
    },
  }
}

/**
 * A seed is copy-once, so the target already owns it and a customization
 * would record nothing a sync does not already respect.
 */
export function customize(
  dispositions: DomainDispositions,
  path: GoldenPath | undefined,
  present: boolean,
): Transition {
  if (path === undefined) return NOT_GOLDEN
  const { rel, kind, hash } = path
  const held = refuseHeld(dispositions, rel)
  if (held !== undefined) return held

  if (kind === 'seed') {
    return {
      ok: false,
      reason: 'seed-not-customizable',
      message: `${rel} is a seed, which sync never overwrites. Decline it instead to keep sync from restoring it.`,
    }
  }
  if (!present) {
    return {
      ok: false,
      reason: 'missing-file',
      message: `${rel} is not in the target, so there is no copy to keep. Decline it instead.`,
    }
  }

  return {
    ok: true,
    dispositions: {
      ...dispositions,
      [rel]: { disposition: 'customized', base: hash },
    },
  }
}

/**
 * Lifts by key alone, so a path the chain stopped shipping can still be
 * cleared from the record.
 */
export function lift(
  dispositions: DomainDispositions,
  rel: string,
): Transition {
  if (dispositions[rel] === undefined) {
    return {
      ok: false,
      reason: 'not-held',
      message: `${rel} is neither declined nor customized.`,
    }
  }

  const { [rel]: _lifted, ...rest } = dispositions
  return { ok: true, dispositions: rest }
}

const NOT_GOLDEN: Transition = {
  ok: false,
  reason: 'not-golden',
  message:
    'No stack in the recorded chain ships that path. Pass it relative to the target, as `canon tooling diff` lists it.',
}

function refuseHeld(
  dispositions: DomainDispositions,
  rel: string,
): Transition | undefined {
  const held = dispositions[rel]
  if (held === undefined) return undefined

  return {
    ok: false,
    reason: 'already-held',
    message: `${rel} is already ${held.disposition}. Run \`canon tooling lift ${rel}\` first to change it.`,
  }
}
