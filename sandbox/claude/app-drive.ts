import { type StageContext, scenario } from '@/sandbox/scenario'

const REQUIREMENTS = `# Requirements

A board app for laying out frames.

## Goals

- **Frames.** A designer adds a frame to the board and sees it saved.
- **Export.** A designer exports the board to PNG.

## Non-goals

- Host boards for anyone.
`

const CONFIG = `launch = "bun run build && PREVIEW_PORT=4530 bun run preview"
data = "boards/board.json"
personas = ["a designer laying out a board"]
proposals = ".canon/picks"
`

const PACKAGE = `{
  "name": "board-app",
  "private": true,
  "scripts": {
    "build": "mkdir -p dist && cp src/index.html dist/index.html",
    "preview": "bun server.ts"
  }
}
`

// Saving writes boards/board.json in whatever tree serves it, which is the
// write a drive served from the main checkout would leave behind.
const SERVER = `import { join } from 'node:path'

const port = Number(process.env.PREVIEW_PORT ?? 4530)

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/save') {
      await Bun.write(join(import.meta.dir, 'boards/board.json'), await request.text())
      return new Response('saved')
    }
    if (url.pathname === '/board') {
      return new Response(Bun.file(join(import.meta.dir, 'boards/board.json')))
    }
    return new Response(Bun.file(join(import.meta.dir, 'dist/index.html')))
  },
})

console.log(\`http://localhost:\${port}\`)
`

function seedApp(ctx: StageContext) {
  ctx.write('canon/REQUIREMENTS.md', REQUIREMENTS)
  ctx.write('canon/config/app-drive.toml', CONFIG)
  ctx.write('package.json', PACKAGE)
  ctx.write('server.ts', SERVER)
  ctx.fixtures('claude', 'app-drive', 'default', '01-initial')
  ctx.write('boards/board.json', '{"frames":["frame 1"]}\n')
  ctx.write('.gitignore', '.canon/\ndist/\n')
}

function commitApp(ctx: StageContext) {
  ctx.git('add', '.')
  ctx.commit('feat(board): board app with a save endpoint')
  ctx.git('tag', 'v0.1.0')
}

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      seedApp(ctx)
      commitApp(ctx)

      ctx.log.step('Scenario ready: app drive of a tagged board app')
      ctx.log.info(
        'Context: a Bun board app whose save writes boards/board.json in the tree serving it',
      )
      ctx.log.info('Seeded so each check has something to catch:')
      ctx.log.info(
        '  the Frames goal is reachable, and adding a frame saves into the served tree',
      )
      ctx.log.info(
        '  the Export goal has no control, so it is a finding or not-driven with a reason',
      )
      ctx.log.info(
        '  canon/config/app-drive.toml names launch, data, and one persona',
      )
      ctx.log.info(
        'Before:  install the bundled Chromium once with canon browser install-browser chromium,',
      )
      ctx.log.info(
        '         and put a checkout canon carrying intake drive-check first on PATH',
      )
      ctx.log.info(
        'Action:  /canon:app-drive drive v0.1.0 of the board app, and close the drive once the findings are filed, since no operator is present',
      )
      ctx.log.info(
        'Expect:  a throwaway worktree outside the sandbox serving on 4530, findings filed in',
      )
      ctx.log.info(
        '         .canon/intake/<nn>-<slug>/ with drive.json and evidence/, boards/board.json',
      )
      ctx.log.info(
        '         unchanged in the sandbox, drive-check clean, and the worktree removed',
      )
      ctx.log.info(
        '         With no board configured, the Board row stays empty and no board server starts',
      )
    },
    live: (ctx) => {
      seedApp(ctx)
      commitApp(ctx)

      ctx.log.step(
        'Scenario ready: app drive of the live app the operator named',
      )
      ctx.log.info(
        'Context: the default board app, driven where it runs rather than from a copy',
      )
      ctx.log.info(
        '  boards/board.json is the operator content, which a live drive reads and never saves over',
      )
      ctx.log.info('Before:  the default arm applies')
      ctx.log.info(
        'Action:  /canon:app-drive drive the board app I run from this checkout, live and with no copy. Start it here with bun run build && PREVIEW_PORT=4530 bun run preview, close the drive once the findings are filed, and stop the server you started, since no operator is present',
      )
      ctx.log.info(
        'Expect:  no worktree made, "worktree": null in drive.json, a Copy row naming the live app,',
      )
      ctx.log.info(
        '         boards/board.json unchanged, and writes only under .canon/intake/ and the build output',
      )
    },
    board: (ctx) => {
      seedApp(ctx)
      ctx.write('canon/config/design.toml', 'board = ".canon/board"\n')
      commitApp(ctx)

      ctx.log.step('Scenario ready: app drive of a project with a board')
      ctx.log.info(
        'Before:  the default arm applies, with frameboard or bunx on PATH as well',
      )
      ctx.log.info(
        'Action:  /canon:app-drive drive v0.1.0 of the board app, decide one finding, and close the drive, since no operator is present',
      )
      ctx.log.info(
        'Expect:  both addresses handed before driving and a Board row in the log naming project drive-<nn>,',
      )
      ctx.log.info(
        '         whose pages open on 00-current with frames at 390, 834, and 1440, and no empty',
      )
      ctx.log.info(
        '         page-1 or untitled project, evidence grouped under evidence/<surface>/ with the',
      )
      ctx.log.info(
        '         options shot, the mock source under evidence/mocks/<surface>/, the address inside',
      )
      ctx.log.info(
        '         the pick question, the board server ended, and the project still on the board',
      )
    },
  },
})
