import { scenario } from '@/sandbox/scenario'

export default scenario({
  config: { SANDBOX_SKIP_AUTO_COMMIT: 'true' },
  arms: {
    default: (ctx) => {
      ctx.identity()

      ctx.write('README.md', '# My App\n')
      ctx.write('docs/old-api.md', '# Old API Reference\n\nDeprecated.\n')
      ctx.git('add', '.')
      ctx.commit('chore(project): init')

      ctx.write(
        'src/auth/login.js',
        'export function login(user) { return fetch("/api/login", { body: user }); }\n',
      )
      ctx.write(
        'src/auth/logout.js',
        'export function logout() { return fetch("/api/logout"); }\n',
      )
      ctx.write(
        'src/api/users.js',
        'export function getUser(id) { return fetch(`/api/users/${id}`); }\n',
      )
      ctx.write('docs/auth.md', '# Auth module\n\nHandles login and logout.\n')
      ctx.write('package.json', '{ "name": "my-app", "version": "1.1.0" }\n')

      ctx.git('rm', 'docs/old-api.md', '-q')
      ctx.git(
        'add',
        'src/auth/login.js',
        'src/auth/logout.js',
        'src/api/users.js',
        'docs/auth.md',
        'package.json',
      )

      ctx.log.step('Scenario ready: 6 staged changes across mixed concerns')
      ctx.log.info(
        'Context: 2 auth files, 1 api file, 1 doc, 1 config change, 1 deletion, all staged',
      )
      ctx.log.info('Action:  /canon:git-stage')
      ctx.log.info(
        'Expect:  groups auth + api separately, docs solo, config solo. Uses git rm for deletion',
      )
    },
  },
})
