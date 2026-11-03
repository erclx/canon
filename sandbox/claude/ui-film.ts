import { scenario } from '@/sandbox/scenario'

const CONFIG = `launch = "PREVIEW_PORT=4531 bun run preview"
access = "/?demo=1"
`

const PACKAGE = `{
  "name": "inbox-app",
  "private": true,
  "scripts": {
    "preview": "bun server.ts"
  }
}
`

const SERVER = `import { join } from 'node:path'

const port = Number(process.env.PREVIEW_PORT ?? 4531)

Bun.serve({
  port,
  fetch: () => new Response(Bun.file(join(import.meta.dir, 'src/index.html'))),
})

console.log(\`http://localhost:\${port}\`)
`

const STORYBOARD = `# Storyboard: inbox zero in two moves

1. Archive the invoice. The row slides out and the list closes up.
2. Search for design. Typing narrows the list to the review notes.
`

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.write('canon/config/app-drive.toml', CONFIG)
      ctx.write('package.json', PACKAGE)
      ctx.write('server.ts', SERVER)
      ctx.fixtures('claude', 'ui-film', 'default', '01-initial')
      ctx.write('video/STORYBOARD.md', STORYBOARD)
      ctx.write('.gitignore', '.canon/\n')

      ctx.git('add', '.')
      ctx.commit('feat(inbox): inbox with archive and search')

      ctx.log.step('Scenario ready: record two beats of an inbox app')
      ctx.log.info(
        'Context: a Bun inbox page with a small archive button per row and a search field',
      )
      ctx.log.info('Seeded so each step has something to show:')
      ctx.log.info(
        '  video/STORYBOARD.md names two beats, one click and one typed search',
      )
      ctx.log.info(
        '  canon/config/app-drive.toml names launch and an access path, and no data',
      )
      ctx.log.info(
        'Before:  install the headless shell once with bunx playwright install chromium,',
      )
      ctx.log.info(
        '         have FFmpeg on PATH, and put a checkout canon carrying take first on PATH',
      )
      ctx.log.info(
        'Action:  /canon:ui-film film the beats in video/STORYBOARD.md. No operator is present, so treat the beats as approved once shown and film them',
      )
      ctx.log.info(
        'Expect:  two plain beats shown for approval before anything is filmed, then after',
      )
      ctx.log.info(
        '         approval a plan and takes under .canon/video/<slug>/, each beat',
      )
      ctx.log.info(
        '         with clip.mp4, log.json, camera.json, and the still.jpg the verb wrote, read per beat, no tracked',
      )
      ctx.log.info('         file changed, and the throwaway copy removed')
      ctx.log.info(
        '         Any dry run lands in scratch/ and nothing composed reads from it',
      )
    },
  },
})
