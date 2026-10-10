import { join } from 'node:path'
import { type StageContext, scenario } from '@/sandbox/scenario'

function seedSourceTree(ctx: StageContext): void {
  ctx.fixtures('infra', 'comments', 'shared', 'source-tree')
}

// The regression arm. Every `#` inside the heredoc stored in
// `heredoc/01-scenario/create/scripts/scenario.sh.fixture` is a markdown heading
// in fixture data, and counting it as a bash comment is what turned a measured
// 112 comment lines into 427 during the comment-discipline track.
function seedHeredocScenario(ctx: StageContext): void {
  ctx.fixtures('infra', 'comments', 'heredoc', '01-scenario')
}

function seedVocabularyRule(ctx: StageContext): void {
  ctx.fixtures('infra', 'comments', 'vocabulary', '01-rule')
}

function seedDegradedSource(ctx: StageContext): void {
  ctx.fixtures('infra', 'comments', 'shared', 'degraded-source')
}

function seedHistory(ctx: StageContext): void {
  seedSourceTree(ctx)
  ctx.git('init', '-q')
  ctx.identity()
  ctx.git('add', '.')
  ctx.git('commit', '-q', '-m', 'chore: seed uncommented source')

  ctx.fixtures('infra', 'comments', 'trend', '01-document-beta')

  ctx.git('add', '.')
  ctx.git('commit', '-q', '-m', 'docs: document the beta contract')
}

function scan(ctx: StageContext, ...args: string[]): void {
  ctx.run('bun', [join(ctx.root, 'src', 'cli.ts'), 'comments', 'scan', ...args])
}

export default scenario({
  prepare: (ctx) => {
    ctx.log.step('Comments sandbox')
    ctx.log.info('snapshot   : density by language and by comment kind')
    ctx.log.info('heredoc    : heredoc bodies are data, not bash comments')
    ctx.log.info('vocabulary : sweep reads its terms from an installed rule')
    ctx.log.info('skipped    : no rule means the sweep reports skipped, not clean')
    ctx.log.info('trend      : recomputes the series from git with no ledger')
    ctx.log.info('json       : machine record on stdout, frame still on stderr')
  },
  arms: {
    snapshot: (ctx) => {
      seedSourceTree(ctx)
      ctx.log.step('Running: canon comments scan')
      scan(ctx)
      ctx.log.info('Expect: TypeScript 4 comment lines, 1 doc block, 1 inline')
      ctx.log.info('Expect: the https:// literal is not counted as a comment')
    },
    heredoc: (ctx) => {
      seedHeredocScenario(ctx)
      ctx.log.step('Running: canon comments scan')
      scan(ctx)
      ctx.log.info('Expect: Bash 1 comment line, not 5')
      ctx.log.info(
        'Expect: the shebang is excluded and heredoc lines leave the total',
      )
    },
    vocabulary: (ctx) => {
      seedVocabularyRule(ctx)
      seedDegradedSource(ctx)
      ctx.log.step('Running: canon comments scan')
      scan(ctx)
      ctx.log.info('Expect: hits for TODO and previously, sourced from the rule')
      ctx.log.info('Expect: the TODO inside the string literal is not a hit')
    },
    skipped: (ctx) => {
      seedDegradedSource(ctx)
      ctx.log.step('Running: canon comments scan')
      scan(ctx)
      ctx.log.info('Expect: sweep reported skipped rather than zero hits')
    },
    trend: (ctx) => {
      seedHistory(ctx)
      ctx.log.step('Running: canon comments scan --since HEAD~1')
      scan(ctx, '--since', 'HEAD~1')
      ctx.log.info('Expect: a two-point series with comment lines rising')
      ctx.log.info('Expect: no ledger file written anywhere in the tree')
    },
    json: (ctx) => {
      seedSourceTree(ctx)
      ctx.log.step('Running: canon comments scan --json')
      ctx.exec('bun', [
        join(ctx.root, 'src', 'cli.ts'),
        'comments',
        'scan',
        '--json',
      ])
    },
  },
})
