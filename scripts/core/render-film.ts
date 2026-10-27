/**
 * Renders the launch film in assets/film/ once per theme and writes the
 * README loops to assets/loops/launch.gif and launch-light.gif, and beside
 * them the landing page's web MP4 and poster PNG per theme.
 *
 * Each theme renders to an MP4 at the canvas size under assets/film/renders/,
 * which git ignores, and the GIF comes from that MP4 through the ffmpeg pass
 * `assets/film/SPEC.md` gives, since no render preset scales below the canvas.
 * Every output is written to the renders folder first and copied into
 * assets/loops/ only once both themes exist, so a failed theme leaves the
 * committed set as it was rather than a half set.
 *
 * The web MP4 drops every audio stream with `-an` whatever the source
 * carries, since the repository is public and no music track's terms are
 * cleared for use outside the tool that made it.
 *
 * Run by hand, not by the gate. The film shows one merged change, so no
 * catalog edit makes it stale, and a render costs minutes of chromium.
 *
 * Clone-only. This script reads assets/film/, which a registry install does
 * not carry.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const HYPERFRAMES = 'hyperframes@0.8.206'

/** The README pass from SPEC.md: 960x600 at 12 fps with a 64-color palette. */
const GIF_FILTER =
  'fps=12,scale=960:600:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle'

/** The landing page pass: 1280 wide, silent, and playable before it finishes downloading. */
const WEB_ARGS = [
  '-an',
  '-vf',
  'scale=1280:-2:flags=lanczos',
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-crf',
  '24',
  '-preset',
  'slow',
  '-movflags',
  '+faststart',
]

/** The poster frame: the mark centered before its pip leaves. */
const POSTER_AT = '0.6'

const THEMES = [
  {
    theme: 'dark',
    loop: 'launch.gif',
    web: 'launch.mp4',
    poster: 'launch-poster.png',
  },
  {
    theme: 'light',
    loop: 'launch-light.gif',
    web: 'launch-light.mp4',
    poster: 'launch-poster-light.png',
  },
] as const

const root = new URL('../..', import.meta.url).pathname
const filmDir = join(root, 'assets', 'film')
const renderDir = join(filmDir, 'renders')
const loopDir = join(root, 'assets', 'loops')

function fail(message: string): never {
  console.error(`render-film: ${message}`)
  process.exit(1)
}

function run(cmd: string[], cwd: string): void {
  const result = Bun.spawnSync(cmd, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if (result.exitCode !== 0) {
    fail(`${cmd.slice(0, 3).join(' ')} exited ${result.exitCode}`)
  }
}

if (process.argv.length > 2) {
  fail(`unknown argument ${process.argv[2]}`)
}

const ffmpeg = Bun.which('ffmpeg')
if (!ffmpeg) {
  fail(
    'ffmpeg is not on PATH, and each GIF is derived with it. Install ffmpeg and re-run.',
  )
}

mkdirSync(renderDir, { recursive: true })

for (const { theme } of THEMES) {
  const mp4 = join(renderDir, `launch-${theme}.mp4`)
  const gif = join(renderDir, `readme-${theme}.gif`)
  console.log(`render-film: rendering ${theme}`)
  run(
    [
      'bunx',
      '-y',
      HYPERFRAMES,
      'render',
      '--variables-file',
      `themes/${theme}.json`,
      '--strict-variables',
      '--quiet',
      '--output',
      mp4,
    ],
    filmDir,
  )
  run(
    [
      ffmpeg,
      '-y',
      '-loglevel',
      'error',
      '-i',
      mp4,
      '-vf',
      GIF_FILTER,
      '-loop',
      '0',
      gif,
    ],
    filmDir,
  )
  run(
    [
      ffmpeg,
      '-y',
      '-loglevel',
      'error',
      '-i',
      mp4,
      ...WEB_ARGS,
      join(renderDir, `web-${theme}.mp4`),
    ],
    filmDir,
  )
  run(
    [
      ffmpeg,
      '-y',
      '-loglevel',
      'error',
      '-ss',
      POSTER_AT,
      '-i',
      mp4,
      '-frames:v',
      '1',
      '-vf',
      'scale=1280:-2:flags=lanczos',
      join(renderDir, `poster-${theme}.png`),
    ],
    filmDir,
  )
}

mkdirSync(loopDir, { recursive: true })
const written: string[] = []
for (const { theme, loop, web, poster } of THEMES) {
  copyFileSync(join(renderDir, `readme-${theme}.gif`), join(loopDir, loop))
  copyFileSync(join(renderDir, `web-${theme}.mp4`), join(loopDir, web))
  copyFileSync(join(renderDir, `poster-${theme}.png`), join(loopDir, poster))
  written.push(loop, web, poster)
}
console.log(
  `render-film: wrote assets/loops/${written.join(', assets/loops/')}`,
)
