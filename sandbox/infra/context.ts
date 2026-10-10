import { join } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

// The citation check reads the tree through `git ls-files`, so an arm that
// exercises it needs a repo. Without one the scan finds no files and reports a
// clean run, which is the false pass the arm exists to rule out.
function seedRepo(ctx: StageContext): void {
  ctx.git('init', '-q')
  ctx.identity()
}

function writeEntry(ctx: StageContext, path: string, title: string): void {
  ctx.write(
    path,
    `---
title: ${title}
description: Narrative for the ${title} domain
---

# ${title}

## Overview

Owns the ${title} surface end to end.

## Layout

- \`src/${title}/\` owns the ${title} surface
`,
  )
}

function seedFolder(ctx: StageContext): void {
  ctx.fixtures('infra', 'context', 'shared', 'folder')

  writeEntry(ctx, 'canon/context/api.md', 'API')
  writeEntry(ctx, 'canon/context/web.md', 'Web')
}

function listEntry(ctx: StageContext, name: string, title: string): void {
  ctx.append(
    'canon/context/index.md',
    `- [${title}](${name}): Narrative for the ${title} domain\n`,
  )
}

function seedCitation(ctx: StageContext): void {
  ctx.write(
    'docs/onboarding.md',
    'Read `canon/context/api.md` before touching the routes.\n',
  )
}

function seedStaleCitation(ctx: StageContext): void {
  ctx.write(
    'docs/onboarding.md',
    'Read `canon/context/retrieval.md` for the retrieval flow.\n',
  )
}

// Three shapes that display a path rather than pointing at one. Each is
// excluded by a different mechanism, so an arm that seeds all three fails
// loudly when any one of them regresses.
function seedIllustrations(ctx: StageContext): void {
  ctx.mkdir('docs')
  ctx.mkdir('sandbox/infra')

  ctx.fixtures('infra', 'context', 'illustration', '01-prose')

  ctx.write(
    'docs/layout.md',
    'One `canon/context/<domain>.md` per domain. <!-- audit-ignore-citations -->\n',
  )
  ctx.write(
    'sandbox/infra/fake.sh',
    'Names `canon/context/pollers.md` inside its own fixture tree.\n',
  )
}

function numbered(count: number, line: (index: number) => string): string {
  return Array.from({ length: count }, (_, i) => line(i + 1)).join('')
}

function seedDeepEntry(ctx: StageContext): void {
  ctx.write(
    'canon/context/deep.md',
    '---\ntitle: Deep\ndescription: An entry with one long unbroken run\n---\n\n' +
      '# Deep\n\n## Overview\n\n' +
      numbered(60, (i) => `Sentence ${i} of the run.\n`) +
      '\n## Peers\n\n' +
      numbered(60, (i) => `- Peer item ${i}\n`),
  )

  listEntry(ctx, 'deep.md', 'Deep')
}

function seedTables(ctx: StageContext): void {
  ctx.write(
    'canon/context/tables.md',
    '---\ntitle: Tables\ndescription: A growing catalog beside a fixed table\n---\n\n' +
      '# Tables\n\n## Catalog\n\n' +
      '| Command | Purpose |\n| --- | --- |\n' +
      numbered(8, (i) => `| \`canon thing-${i}\` | Does a thing |\n`) +
      '\n## Comparison\n\n' +
      '| Concern | Tradeoff |\n| --- | --- |\n' +
      numbered(8, (i) => `| Concern ${i} | Some prose about it |\n`),
  )

  listEntry(ctx, 'tables.md', 'Tables')
}

function seedDrift(ctx: StageContext): void {
  seedFolder(ctx)
  writeEntry(ctx, 'canon/context/sandbox.md', 'Sandbox')
  ctx.run('rm', ['canon/context/web.md'])
}

// Three shapes the required-section rule reads differently. A short entry in the
// named folder reports, a conforming sibling beside it answers for itself alone,
// and a split folder is answered by the one sibling named for the sections. An
// arm seeding only the first would pass while both halves of the unit rule went
// unmeasured.
function seedShortSections(ctx: StageContext): void {
  ctx.fixtures('infra', 'context', 'sections', '01-entries')
}

function runAudit(ctx: StageContext, ...args: string[]): void {
  const status = ctx.run(
    'bun',
    [join(ctx.root, 'src', 'cli.ts'), 'context', 'audit', ...args],
    { allowFailure: true },
  )
  ctx.log.info(`Exit code: ${status}`)
}

export default scenario({
  prepare: (ctx) => {
    ctx.log.step('Context sandbox')
    ctx.log.info('clean         : a conforming folder reports no findings and exits 0')
    ctx.log.info('stale         : an unresolved citation fails the gate with exit 2')
    ctx.log.info('illustration  : fence, fixture, and marker exclusions hold')
    ctx.log.info(
      'sections      : a short entry reports, a sibling does not answer for it',
    )
    ctx.log.info('depth         : a long run reports and a peer list is exempt')
    ctx.log.info('tables        : a growing catalog reports, a fixed table does not')
    ctx.log.info('drift         : index and siblings disagree in both directions')
    ctx.log.info('json          : machine record on stdout, frame still on stderr')
  },
  arms: {
    clean: (ctx) => {
      seedRepo(ctx)
      seedFolder(ctx)
      seedCitation(ctx)
      ctx.log.step('Running: canon context audit')
      runAudit(ctx)
      ctx.log.info('Expect: 2 entries, every cited path resolves, exit 0')
      ctx.log.info('Expect: no section, length, depth, table, or drift finding')
    },
    stale: (ctx) => {
      seedRepo(ctx)
      seedFolder(ctx)
      seedStaleCitation(ctx)
      ctx.log.step('Running: canon context audit --citations-only')
      runAudit(ctx, '--citations-only')
      ctx.log.info('Expect: docs/onboarding.md flagged for retrieval.md, exit 2')
      ctx.log.info('Expect: the gate prints only the finding, with no frame above it')
    },
    illustration: (ctx) => {
      seedRepo(ctx)
      seedFolder(ctx)
      seedIllustrations(ctx)
      ctx.log.step('Running: canon context audit --citations-only')
      runAudit(ctx, '--citations-only')
      ctx.log.info('Expect: silence and exit 0, since all three are illustrations')
      ctx.log.info(
        'Expect: the fenced pair, the marked line, and the fixture excluded',
      )
    },
    sections: (ctx) => {
      seedRepo(ctx)
      seedShortSections(ctx)
      ctx.log.step('Running: canon context audit')
      runAudit(ctx)
      ctx.log.info('Expect: short.md alone reported, missing Overview and Layout')
      ctx.log.info(
        'Expect: ci.md beside it answers for itself and does not cover short.md',
      )
      ctx.log.info(
        'Expect: canon/context/scripts silent, its overview.md carries both',
      )
      ctx.log.info(
        'Expect: exit 0, since a missing section reports rather than gates',
      )
    },
    depth: (ctx) => {
      seedRepo(ctx)
      seedFolder(ctx)
      seedDeepEntry(ctx)
      ctx.log.step('Running: canon context audit')
      runAudit(ctx)
      ctx.log.info('Expect: deep.md reports one run past the 40-line checkpoint')
      ctx.log.info('Expect: the 60-item peer list below it reports nothing')
    },
    tables: (ctx) => {
      seedRepo(ctx)
      seedFolder(ctx)
      seedTables(ctx)
      ctx.log.step('Running: canon context audit')
      runAudit(ctx)
      ctx.log.info('Expect: one candidate, the 8-row command catalog')
      ctx.log.info('Expect: the 8-row comparison table is not reported')
    },
    drift: (ctx) => {
      seedRepo(ctx)
      seedDrift(ctx)
      ctx.log.step('Running: canon context audit')
      runAudit(ctx)
      ctx.log.info('Expect: sandbox.md unlisted and web.md missing')
      ctx.log.info('Expect: exit 0, since index drift is advisory rather than gating')
    },
    json: (ctx) => {
      seedRepo(ctx)
      seedFolder(ctx)
      seedCitation(ctx)
      ctx.log.step('Running: canon context audit --json')
      ctx.exec('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'context',
        'audit',
        '--json',
      ])
    },
  },
})
