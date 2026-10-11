import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    resolved: (ctx) => {
      ctx.mkdir('demos/cold-open/take')
      ctx.run(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'testsrc=size=64x64:rate=1:duration=3',
          '-c:v',
          'libvpx',
          'demos/cold-open/take/cold-open.webm',
        ],
        { stdout: 'ignore', stderr: 'ignore' },
      )

      ctx.git('add', '.')
      ctx.commit('feat(demo): seed a three-second recording to read back')

      ctx.log.step("Scenario ready: read a recording's frames (read-frames)")
      ctx.log.info(
        'Context: demos/cold-open/take/cold-open.webm, a three-second synthetic clip staged for provisioning, no compiled plan beside it',
      )
      ctx.log.info(
        'Before:  ffmpeg on PATH, since provisioning shells to it directly to synthesize the fixture clip',
      )
      ctx.log.info(
        'Action:  /canon:read-frames demos/cold-open/take/cold-open.webm',
      )
      ctx.log.info(
        'Expect:  canon demo frames extracts one PNG a second, three frames from the three-second clip',
      )
      ctx.log.info(
        'Expect:  the report reads every frame with the Read tool and describes each in a numbered list',
      )
      ctx.log.info(
        'Expect:  no pass-fail line, no looks-correct or looks-broken judgment, anywhere in the report',
      )
    },
    missing: (ctx) => {
      ctx.log.step(
        'Scenario ready: refuse a recording that is not there (read-frames)',
      )
      ctx.log.info(
        'Context: empty tree, no demos/ directory and no video anywhere',
      )
      ctx.log.info(
        'Action:  /canon:read-frames demos/cold-open/take/cold-open.webm',
      )
      ctx.log.info(
        'Expect:  canon demo frames refuses with reason video-missing, the session reports that and stops',
      )
      ctx.log.info(
        'Expect:  no ffmpeg invocation, and no guess at what the recording would have shown',
      )
    },
  },
})
