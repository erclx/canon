import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.fixtures('claude', 'youtube-transcripts', 'shared', '01-initial')

      ctx.run('chmod', ['+x', 'bin/yt-dlp'])

      ctx.git('add', '.')
      ctx.commit('chore(sandbox): scaffold transcripts fixture and yt-dlp shim')

      ctx.log.step('Scenario ready: youtube transcripts (offline shim)')
      ctx.log.info(
        'Context: deterministic yt-dlp shim at bin/yt-dlp, no network needed',
      )
      ctx.log.info(
        'Action:  /youtube-transcripts https://youtu.be/sandboxVid01',
      )
      ctx.log.info(
        'Note:    launch claude with the shim on PATH: PATH="$PWD/bin:$PATH" claude ...',
      )
      ctx.log.info(
        'Expect:  .canon/transcripts/<fetch-date>--how-attention-works--sandboxVid01.md with frontmatter and deduped prose',
      )
    },
  },
})
