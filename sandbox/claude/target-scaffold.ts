import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: {
    SANDBOX_SKIP_AUTO_COMMIT: 'true',
  },
  arms: {
    // Provisioning commits a .gitignore, which the empty-folder rule counts as
    // a file, so the arm removes it to leave nothing but .git.
    empty: (ctx) => {
      ctx.git('rm', '-q', '.gitignore')
      ctx.commit('chore(sandbox): leave nothing but .git')

      ctx.log.step('Scenario ready: scaffold skill in an empty folder')
      ctx.log.info('Context: a git repository holding nothing but .git')
      ctx.log.info('Action:  "start a new astro project here"')
      ctx.log.info(
        "Expect:  the envelope's `skills` lists canon:target-scaffold before any scaffolder runs, astro is taken from the request without a question, `canon tooling scaffold astro . --json` returns ok with package.json and astro.config.mjs among its files, and no scaffolder command runs outside the verb. The bare request carries no planning context, so no .canon/tmp/kickoff/next-session.md lands and the report says no kickoff note was written. Read `skills` rather than `result`, since a plain prompt that never loads the skill can still land an Astro starter by hand.",
      )
    },
    // The one check of the full scaffold chain. Every run is a billed headless
    // session with network installs, so it runs by hand on the operator's
    // word, and no workflow, schedule, or hook names it.
    chain: (ctx) => {
      ctx.git('rm', '-q', '.gitignore')
      ctx.commit('chore(sandbox): leave nothing but .git')

      ctx.log.step(
        'Scenario ready: scaffold chain from an empty folder through setup',
      )
      ctx.log.info('Context: a git repository holding nothing but .git')
      ctx.log.info(
        "Billed:  a headless run with network installs, on the operator's word alone",
      )
      ctx.log.info('Action:  /canon:target-scaffold vite-react')
      ctx.log.info(
        "Expect:  target-scaffold runs `canon tooling scaffold vite-react` and hands off to target-setup. src/index.css imports tailwindcss, the Vite demo (src/App.css, src/assets/, public/icons.svg) is gone, the second detect pass installs .claude/rules/canon/framework/tailwind.md and shadcn.md beside react.md, and the report names the deep verify's test:e2e and screenshot stages, run or skipped. Raise CANON_SKILL_TEST_MAX_TURNS above the default for the first run.",
      )
    },
    // Headless, so the request has to say full stack for the skill to pass a root.
    fullstack: (ctx) => {
      ctx.git('rm', '-q', '.gitignore')
      ctx.commit('chore(sandbox): leave nothing but .git')

      ctx.log.step('Scenario ready: full stack vite-react scaffold')
      ctx.log.info('Context: a git repository holding nothing but .git')
      ctx.log.info(
        'Action:  "start a full stack vite-react project here, with a Worker beside the app"',
      )
      ctx.log.info(
        'Expect:  the skill runs `canon tooling scaffold vite-react . --app-root web --json`, whose record reads ok with appRoot web. web/main.tsx and web/app.tsx land, no src/ folder does, index.html loads /web/main.tsx, and canon/config/config.json records appRoot as web. Read `skills` for canon:target-scaffold before trusting `result`.',
      )
    },
    occupied: (ctx) => {
      ctx.write('notes.md', '# Notes\n')
      ctx.git('add', '.')
      ctx.commit('chore(sandbox): folder already holding a file')

      ctx.log.step('Scenario ready: scaffold skill in a folder holding a file')
      ctx.log.info('Context: notes.md committed at the root')
      ctx.log.info('Action:  "start a new astro project here"')
      ctx.log.info(
        'Expect:  the skill reads the folder first, stops before running the verb, and routes to target-setup. No starter file such as package.json or astro.config.mjs lands.',
      )
    },
  },
})
