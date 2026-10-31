import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
    SANDBOX_INJECT_SEEDS: 'true',
  },
  arms: {
    default: (ctx) => {
      ctx.fixtures('claude', 'design-identity', 'shared', '01-initial')

      ctx.mkdir('.claude')
      ctx.git('add', '.')
      ctx.commit(
        'feat(project): seed a focus timer with DESIGN.md and its stylesheet',
      )

      ctx.log.step(
        'Scenario ready: a project with DESIGN.md, a token stylesheet, and no logo, favicon, or manifest yet',
      )
      ctx.log.info(
        'Context: CLAUDE.md names a focus timer, canon/DESIGN.md carries Overview, Colors, and Typography intent, and its lead names src/styles/tokens.css for the values',
      )
      ctx.log.info('Signals the skill should pick up:')
      ctx.log.info(
        '  Overview: quiet, disciplined, warm paper tones, single accent, no motion',
      )
      ctx.log.info(
        "  Colors: warm paper ground, dark ink, a rust accent for the active state, read from the stylesheet's custom properties",
      )
      ctx.log.info(
        '  No public/, static/, src/app/, index.html, or manifest.json anywhere in the tree',
      )
      ctx.log.info(
        '  No card.config.mjs and no card-src/, so the card route scaffold is absent',
      )
      ctx.log.info(
        'Action: /canon:design-identity draft a logo mark and social card, and take arm 1 when you put the pick to me',
      )
      ctx.log.info(
        "        The pick is pre-supplied in the prompt, the same shape design-pick's own sandbox arm",
      )
      ctx.log.info(
        '        uses, since a headless run has nobody to answer the question and would stall on it otherwise.',
      )
      ctx.log.info(
        'Expect: the default icon size sequence announced (16x16, 32x32, 48x48, 180x180, 192x192, 512x512),',
      )
      ctx.log.info('        since no HTML head or manifest declares one')
      ctx.log.info(
        'Expect: the write folder announced as the last tier, the project root as a fallback rather',
      )
      ctx.log.info(
        '        than a detection, since no public/, static/, or src/app/ folder exists at the root',
      )
      ctx.log.info('        or one level down')
      ctx.log.info(
        'Expect: the card takes the page path, not the route path, and the run says so. No card',
      )
      ctx.log.info(
        '        route scaffold is installed, and the skill must not run a tooling sync to get one.',
      )
      ctx.log.info(
        'Expect: favicon.svg, one PNG per default size, and og-image.png (light) and og-image-dark.png (1200x630) at the project root',
      )
      ctx.log.info(
        "Expect: canon capture's own stdout reports each PNG's rendered width and height",
      )
      ctx.log.info(
        "Not reached: whether the mark itself reads well. That is a person's call, the same ceiling",
      )
      ctx.log.info(
        "        design-pick's own sandbox arm accepts for its loop-and-pick half.",
      )
    },
  },
})
