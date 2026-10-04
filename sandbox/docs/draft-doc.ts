import { type StageContext, scenario } from '@/sandbox/scenario'

function seedDocsCatalog(ctx: StageContext): void {
  ctx.fixtures('docs', 'draft-doc', 'docs-shared', 'catalog')
  ctx.git('add', '.')
  ctx.commit('docs(agents): seed a populated governance catalog')
}

function seedWikiCatalog(ctx: StageContext): void {
  ctx.fixtures('docs', 'draft-doc', 'wiki-shared', 'catalog')
  ctx.git('add', '.')
  ctx.commit('docs(wiki): seed a populated wiki catalog')
}

/** Left uncommitted, since each readme arm commits it with what it adds. */
function stageReadmePackage(ctx: StageContext): void {
  ctx.mkdir('src')
  ctx.fixtures('docs', 'draft-doc', 'readme-shared', 'package')
}

function commitAll(ctx: StageContext, subject: string): void {
  ctx.git('add', '.')
  ctx.commit(subject)
}

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  arms: {
    'docs-fits-category': (ctx) => {
      seedDocsCatalog(ctx)
      ctx.log.step('Scenario ready: page fits an existing category')
      ctx.log.info(
        'Context: docs/agents/governance.md sits on the Governance shelf',
      )
      ctx.log.info(
        'Action:  /canon:draft-doc add a docs page documenting the gov audit command',
      )
      ctx.log.info(
        'Expect:  drafted at docs/agents/<slug>.md, category: Governance, confirmed before write',
      )
    },
    'docs-fits-none': (ctx) => {
      seedDocsCatalog(ctx)
      ctx.log.step('Scenario ready: page fits no existing category')
      ctx.log.info('Context: no catalog shelf covers a brand-new domain')
      ctx.log.info(
        'Action:  /canon:draft-doc add a docs page documenting the new capture pipeline',
      )
      ctx.log.info(
        'Expect:  drafted at docs/<slug>.md, at the flat root, confirmed before write',
      )
    },
    'docs-already-covered': (ctx) => {
      seedDocsCatalog(ctx)
      ctx.log.step('Scenario ready: topic already has a page')
      ctx.log.info(
        'Context: docs/agents/governance.md already documents the gov CLI',
      )
      ctx.log.info(
        'Action:  /canon:draft-doc add a docs page for the governance CLI',
      )
      ctx.log.info(
        'Expect:  refuses toward /canon:docs-sync, since docs/agents/governance.md already covers it',
      )
    },
    'wiki-new-subject': (ctx) => {
      seedWikiCatalog(ctx)
      ctx.log.step('Scenario ready: subject passes both placement tests')
      ctx.log.info(
        'Context: the catalog holds one page and nothing covers subagents',
      )
      ctx.log.info(
        'Action:  /canon:draft-doc write a wiki page for Claude Code subagents',
      )
      ctx.log.info(
        'Expect:  drafted at wiki/claude/subagents.md, sourced through claude-code-guide rather than recall, confirmed before write',
      )
    },
    'wiki-project-owned': (ctx) => {
      seedWikiCatalog(ctx)
      ctx.log.step('Scenario ready: subject fails the first placement test')
      ctx.log.info(
        "Context: the sandbox scenario runner is this project's own surface",
      )
      ctx.log.info(
        'Action:  /canon:draft-doc write a wiki page for how our sandbox scenarios work',
      )
      ctx.log.info(
        'Expect:  refuses on the ownership test, offering the docs or context kind of draft-doc rather than drafting',
      )
    },
    'wiki-already-covered': (ctx) => {
      seedWikiCatalog(ctx)
      ctx.log.step('Scenario ready: subject already has a page')
      ctx.log.info(
        'Context: wiki/claude/hooks.md already documents the hook events',
      )
      ctx.log.info(
        'Action:  /canon:draft-doc add a wiki page about PreToolUse and PostToolUse events',
      )
      ctx.log.info(
        'Expect:  refuses on the catalog read, since hooks.md covers it under a different slug',
      )
    },
    'readme-none': (ctx) => {
      stageReadmePackage(ctx)
      commitAll(ctx, 'chore: seed a CLI package with no README')
      ctx.log.step('Scenario ready: no README exists')
      ctx.log.info(
        'Context: package.json declares a bin entry, no README.md anywhere',
      )
      ctx.log.info('Action:  /canon:draft-doc write the project README')
      ctx.log.info(
        'Expect:  drafted at README.md from the CLI template, confirmed before write',
      )
    },
    'readme-scaffold': (ctx) => {
      stageReadmePackage(ctx)
      ctx.fixtures('docs', 'draft-doc', 'readme-scaffold', '01-readme')
      commitAll(ctx, 'chore: seed a scaffold-written README')
      ctx.log.step('Scenario ready: README is unedited scaffold output')
      ctx.log.info(
        "Context: README.md carries no H1 and only the generator's own headings",
      )
      ctx.log.info('Action:  /canon:draft-doc write the project README')
      ctx.log.info(
        'Expect:  drafts over the scaffold page rather than refusing toward docs-sync',
      )
    },
    'readme-authored': (ctx) => {
      stageReadmePackage(ctx)
      ctx.fixtures('docs', 'draft-doc', 'readme-authored', '01-readme')
      commitAll(ctx, 'chore: seed an authored README')
      ctx.log.step('Scenario ready: README is already authored')
      ctx.log.info('Context: README.md carries an H1 naming the project')
      ctx.log.info('Action:  /canon:draft-doc write the project README')
      ctx.log.info(
        'Expect:  refuses toward /canon:docs-sync, since README.md already covers the project',
      )
    },
    'readme-web-project': (ctx) => {
      stageReadmePackage(ctx)
      ctx.mkdir('public')
      ctx.fixtures('docs', 'draft-doc', 'readme-web-project', '01-site-package')
      ctx.write(
        'public/logo.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30"/></svg>\n',
      )
      ctx.write(
        'public/screenshot.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#eee"/></svg>\n',
      )
      commitAll(
        ctx,
        'chore: seed a site project with a mark and a product image',
      )
      ctx.log.step(
        'Scenario ready: a project with a page, a mark, and a product image',
      )
      ctx.log.info(
        'Context: package.json declares a site framework and a homepage, public/ holds logo.svg and screenshot.svg',
      )
      ctx.log.info('Action:  /canon:draft-doc write the project README')
      ctx.log.info(
        'Expect:  drafted from the application template, header fills mark, title, claim, live link, and screenshot, each read off the repository',
      )
    },
  },
})
