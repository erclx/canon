import { scenario } from '@/sandbox/scenario'

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

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Board</title>
  </head>
  <body>
    <h1>Board</h1>
    <ul id="frames"></ul>
    <button id="add">Add frame</button>
    <script>
      const list = document.getElementById('frames')
      let frames = []
      fetch('/board').then((r) => r.json()).then((b) => {
        frames = b.frames
        frames.forEach((f) => list.append(Object.assign(document.createElement('li'), { textContent: f })))
      })
      document.getElementById('add').onclick = () => {
        frames.push('frame ' + (frames.length + 1))
        list.append(Object.assign(document.createElement('li'), { textContent: frames.at(-1) }))
        fetch('/save', { method: 'POST', body: JSON.stringify({ frames }) })
      }
    </script>
  </body>
</html>
`

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.write('canon/REQUIREMENTS.md', REQUIREMENTS)
      ctx.write('canon/config/app-drive.toml', CONFIG)
      ctx.write('package.json', PACKAGE)
      ctx.write('server.ts', SERVER)
      ctx.write('src/index.html', PAGE)
      ctx.write('boards/board.json', '{"frames":["frame 1"]}\n')
      ctx.write('.gitignore', '.canon/\ndist/\n')

      ctx.git('add', '.')
      ctx.commit('feat(board): board app with a save endpoint')
      ctx.git('tag', 'v0.1.0')

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
      ctx.log.info('Action:  /canon:app-drive drive v0.1.0 of the board app')
      ctx.log.info(
        'Expect:  a throwaway worktree outside the sandbox serving on 4530, findings filed in',
      )
      ctx.log.info(
        '         .canon/intake/<nn>-<slug>/ with drive.json and evidence/, boards/board.json',
      )
      ctx.log.info(
        '         unchanged in the sandbox, drive-check clean, and the worktree removed',
      )
    },
  },
})
