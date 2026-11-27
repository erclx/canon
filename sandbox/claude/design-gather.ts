import { scenario } from '@/sandbox/scenario'

const PORT = 4532

const PACKAGE = `{
  "name": "fieldnote-site",
  "private": true,
  "scripts": {
    "site": "bun server.ts"
  }
}
`

const SERVER = `import { join } from 'node:path'

Bun.serve({
  port: ${PORT},
  fetch: () => new Response(Bun.file(join(import.meta.dir, 'site/index.html'))),
})

console.log('http://localhost:${PORT}/')
`

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.write('package.json', PACKAGE)
      ctx.write('server.ts', SERVER)
      ctx.fixtures('claude', 'design-gather', 'default', '01-initial')
      ctx.write('.gitignore', '.canon/\n')

      ctx.git('add', '.')
      ctx.commit('feat(site): fieldnote marketing page')

      ctx.log.step(
        'Scenario ready: a local product site to gather references from',
      )
      ctx.log.info(
        'Context: site/index.html is a five-section product page with two hover menus, one',
      )
      ctx.log.info(
        `         primary action, and a pinned strip, served by bun run site on port ${PORT}`,
      )
      ctx.log.info(
        'Before:  install the headless shell once with bunx playwright install chromium, have',
      )
      ctx.log.info(
        '         FFmpeg and frameboard or bunx on PATH, and put a canon carrying capture --sections first',
      )
      ctx.log.info(
        'Action:  /canon:design-gather gather references from the fixture site. Start it first',
      )
      ctx.log.info(
        `         with bun run site in the background, then capture http://localhost:${PORT}/`,
      )
      ctx.log.info(
        'Expect:  a references page on the board at .canon/board/, section shots at 320, 834, and',
      )
      ctx.log.info(
        '         1440 under its localhost-4532 folder, a scroll of five stills and up to three hovers',
      )
      ctx.log.info(
        '         filmed at desktop, the DESIGN.md named absent, every frame naming its source,',
      )
      ctx.log.info('         and no tracked file changed')
    },
  },
})
