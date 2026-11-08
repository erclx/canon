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
        "Expect:  the stack options come from `canon tooling list --json` filtered on scaffold, astro is taken from the request without a question, `canon tooling scaffold astro . --json` runs once and returns ok with package.json and astro.config.mjs among its files, the run then hands off to target-setup, which resolves the stack from the starter's files and runs canon init, and no scaffolder command runs outside the verb",
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
