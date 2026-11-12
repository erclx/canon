import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { describe, it } from 'vitest'
import {
  payloadFor,
  postPayload,
  reviewPost,
  REVIEWS,
  ROOT,
  run,
  TREES,
  useFixture,
} from './fixture'

const ctx = useFixture()

describe('.claude/hooks/standards-audit.sh runner', () => {
  const hook = join(ROOT, '.claude/hooks/standards-audit.sh')

  const payload = (): string =>
    JSON.stringify({
      tool_input: { file_path: join(ctx.fixture, 'project/doc.md') },
      tool_name: 'Write',
    })

  const withStubs = (): string =>
    [join(ctx.fixture, 'bin'), ctx.hookPath].join(delimiter)

  it.concurrent('should prefer the checkout CLI when the root carries src/cli.ts', async ({
    expect,
  }) => {
    const result = await run(hook, payload(), withStubs())

    expect(result.stdout).toContain('via-bun')
    expect(result.code).toBe(0)
  })

  it.concurrent('should fall back to the installed binary when the root carries no src/cli.ts', async ({
    expect,
  }) => {
    const root = join(ctx.fixture, 'no-source')

    const result = await run(hook, payload(), withStubs(), root)

    expect(result.stdout).toContain('via-canon')
    expect(result.code).toBe(0)
  })

  it.concurrent('should report that nothing ran when the machine carries neither runner', async ({
    expect,
  }) => {
    // The linked dependencies and nothing else, so neither runner resolves
    // whatever the machine carries. A missing link would take the run
    // somewhere silent for a reason this test is not about.
    const path = join(ctx.fixture, 'bin-no-runner')
    expect(existsSync(join(path, 'bash')), 'no bash found to link').toBe(true)
    expect(existsSync(join(path, 'jq')), 'no jq found to link').toBe(true)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('nothing checked')
    expect(result.stdout).toContain(join(ctx.fixture, 'project/doc.md'))
    expect(result.code).toBe(0)
  })

  it.concurrent('should name a ban set the verb shipped empty', async ({
    expect,
  }) => {
    // `no-source` carries no `src/cli.ts`, which is what sends the hook past
    // the checkout branch to the stubbed binary.
    const path = [join(ctx.fixture, 'bin-empty-set'), ctx.hookPath].join(
      delimiter,
    )

    const result = await run(
      hook,
      payload(),
      path,
      join(ctx.fixture, 'no-source'),
    )

    expect(result.stdout).toContain('characters')
    expect(result.stdout).toContain('narrowed set')
    expect(result.code).toBe(0)
  })

  it.concurrent('should report a run that returned no record at all', async ({
    expect,
  }) => {
    const path = [join(ctx.fixture, 'bin-no-record'), ctx.hookPath].join(
      delimiter,
    )

    const result = await run(
      hook,
      payload(),
      path,
      join(ctx.fixture, 'no-source'),
    )

    expect(result.stdout).toContain('nothing checked')
    expect(result.stdout).toContain('no record')
    expect(result.code).toBe(0)
  })

  it.concurrent('should hand back a gated cell and trailing list under the density message and a wide token as a report', async ({
    expect,
  }) => {
    const path = [join(ctx.fixture, 'bin-tables'), ctx.hookPath].join(delimiter)

    const result = await run(
      hook,
      payload(),
      path,
      join(ctx.fixture, 'no-source'),
    )

    expect(result.stdout).toContain(':7  table-cell  130 past 120  gating')
    expect(result.stdout).toContain(
      ':8  table-then-list  a list follows the table with no lead sentence  gating',
    )
    expect(result.stdout).not.toContain('opens with neither')
    expect(result.stdout).toContain(':9  table-token  31 past 30')
    expect(result.stdout).toContain('never fail a push')
    expect(result.code).toBe(0)
  })
})

// The seed reaches one runner where the toolkit copy reaches two, so the branch
// it takes and the two it degrades onto are what these cover. A scaffolded
// project may carry no binary at all, and the pass a silent hook reports there
// covers less than a reader would take it to cover.
describe('seeds standards-audit.sh runner', () => {
  const hook = join(
    ROOT,
    'tooling/claude/seeds/.claude/hooks/standards-audit.sh',
  )

  const payload = (): string =>
    JSON.stringify({
      tool_input: { file_path: join(ctx.fixture, 'project/doc.md') },
      tool_name: 'Write',
    })

  it.concurrent('should read its findings out of the installed binary', async ({
    expect,
  }) => {
    // The seed resolves no checkout source, so the `canon` stub is the only
    // branch it can take and `via-canon` is what proves it took one rather
    // than reaching a verdict some other way.
    const path = [join(ctx.fixture, 'bin'), ctx.hookPath].join(delimiter)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('via-canon')
    expect(result.code).toBe(0)
  })

  it.concurrent('should report that nothing ran when the machine carries no binary', async ({
    expect,
  }) => {
    // The linked dependencies and nothing else, so no runner resolves
    // whatever the machine carries. A missing link would take the run
    // somewhere silent for a reason this test is not about.
    const path = join(ctx.fixture, 'bin-no-runner')
    expect(existsSync(join(path, 'bash')), 'no bash found to link').toBe(true)
    expect(existsSync(join(path, 'jq')), 'no jq found to link').toBe(true)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('nothing checked')
    expect(result.stdout).toContain(join(ctx.fixture, 'project/doc.md'))
    expect(result.code).toBe(0)
  })

  it.concurrent('should name a ban set the verb shipped empty', async ({
    expect,
  }) => {
    const path = [join(ctx.fixture, 'bin-empty-set'), ctx.hookPath].join(
      delimiter,
    )

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('shipped ban set is empty')
    expect(result.stdout).toContain('characters')
    expect(result.code).toBe(0)
  })

  it.concurrent('should hand back a gated cell and trailing list under the density message and a wide token as a report', async ({
    expect,
  }) => {
    const path = [join(ctx.fixture, 'bin-tables'), ctx.hookPath].join(delimiter)

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain(':7  table-cell  130 past 120  gating')
    expect(result.stdout).toContain(
      ':8  table-then-list  a list follows the table with no lead sentence  gating',
    )
    expect(result.stdout).not.toContain('opens with neither')
    expect(result.stdout).toContain(':9  table-token  31 past 30')
    expect(result.stdout).toContain('never fail a push')
    expect(result.code).toBe(0)
  })

  it.concurrent('should warn on a colon the write introduced and a heading in the file', async ({
    expect,
  }) => {
    const path = [join(ctx.fixture, 'bin-advisory'), ctx.hookPath].join(
      delimiter,
    )
    const write = JSON.stringify({
      tool_input: {
        file_path: join(ctx.fixture, 'project/doc.md'),
        content: '# Key Changes\n\nProse sentence: another clause.\n',
      },
      tool_name: 'Write',
    })

    const result = await run(hook, write, path)

    expect(result.stdout).toContain('Prose sentence: another clause.')
    expect(result.stdout).toContain('Key Changes')
    expect(result.code).toBe(0)
  })

  it.concurrent('should warn on a colon an edit introduced inside a longer line', async ({
    expect,
  }) => {
    // The record's text is the whole line, so a filter matching the line
    // against the new text drops an edit that rewrote only a phrase of it.
    const path = [join(ctx.fixture, 'bin-advisory'), ctx.hookPath].join(
      delimiter,
    )
    const edit = JSON.stringify({
      tool_input: {
        file_path: join(ctx.fixture, 'project/doc.md'),
        old_string: 'sentence \u2014 another',
        new_string: 'sentence: another',
      },
      tool_name: 'Edit',
    })

    const result = await run(hook, edit, path)

    expect(result.stdout).toContain('Prose sentence: another clause.')
    expect(result.code).toBe(0)
  })

  it.concurrent('should warn on a colon an edit introduced after an emoji in its line', async ({
    expect,
  }) => {
    // The record names the word before each colon, so a line with an emoji
    // is matched by that word. Slicing its text at a UTF-16 column lands one
    // character off in jq and keys the match on `now::`, which drops it.
    const path = [join(ctx.fixture, 'bin-advisory'), ctx.hookPath].join(
      delimiter,
    )
    const edit = JSON.stringify({
      tool_input: {
        file_path: join(ctx.fixture, 'project/doc.md'),
        old_string: 'now, it works',
        new_string: 'now: it works',
      },
      tool_name: 'Edit',
    })

    const result = await run(hook, edit, path)

    expect(result.stdout).toContain('Ship it')
    expect(result.code).toBe(0)
  })

  it.concurrent('should stay quiet on a colon an edit left untouched', async ({
    expect,
  }) => {
    const path = [join(ctx.fixture, 'bin-advisory'), ctx.hookPath].join(
      delimiter,
    )
    const edit = JSON.stringify({
      tool_input: {
        file_path: join(ctx.fixture, 'project/doc.md'),
        old_string: 'one',
        new_string: 'two',
      },
      tool_name: 'Edit',
    })

    const result = await run(hook, edit, path)

    expect(result.stdout).not.toContain('Prose sentence')
    expect(result.stdout).toContain('Key Changes')
    expect(result.code).toBe(0)
  })

  it.concurrent('should report a run that returned no record at all', async ({
    expect,
  }) => {
    const path = [join(ctx.fixture, 'bin-no-record'), ctx.hookPath].join(
      delimiter,
    )

    const result = await run(hook, payload(), path)

    expect(result.stdout).toContain('nothing checked')
    expect(result.stdout).toContain('no record')
    expect(result.code).toBe(0)
  })
})

// The acting case proves a finding blocks. These pin what the hook promises
// around it: a clean body, a read, and a post it cannot scan each take their
// own verdict, and none of them reaches the session by stdout on the block path.
describe('review-post-scan.sh verdicts', () => {
  const scanPassPath = (): string =>
    [join(ctx.fixture, 'bin-scan-pass'), ctx.hookPath].join(delimiter)

  for (const tree of TREES) {
    const hook = join(tree.dir, 'review-post-scan.sh')
    const body = (): string =>
      `-F body=@${join(ctx.fixture, 'project/review-body.md')}`

    it.concurrent(`should leave ${tree.label} silent on a clean body`, async ({
      expect,
    }) => {
      const result = await run(hook, reviewPost(body()), scanPassPath())

      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should leave ${tree.label} silent on a read of the same endpoint`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`gh api ${REVIEWS}`),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should block ${tree.label} on a post that names no method but carries fields`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`gh api ${REVIEWS} -f event=COMMENT ${body()}`),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.stderr).toContain('board identifier')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should match a method placed after the endpoint on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`gh api ${REVIEWS} ${body()} -X PATCH`),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.code).toBe(2)
    })

    it.concurrent(`should not read a flag inside the body path as the method on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(
          `gh api ${REVIEWS} -f event=COMMENT -F body=@${join(ctx.fixture, 'project/hooks-guard-Xray/review-body.md')}`,
        ),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.stderr).toContain('board identifier')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should cover a pull request comment on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        reviewPost(body(), 'repos/{owner}/{repo}/issues/7/comments'),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.code).toBe(2)
    })

    it.concurrent(`should leave ${tree.label} silent on a pull request create`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        reviewPost(body(), "'repos/{owner}/{repo}/pulls'"),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should refuse an inline body on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        reviewPost("-f body='looks fine'"),
        scanPassPath(),
      )

      expect(result.stderr).toContain('-F body=@<file>')
      expect(result.stdout).toBe('')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should block ${tree.label} on a body file the call has not written yet`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        reviewPost('-F body=@.canon/tmp/not-written.md'),
        scanPassPath(),
      )

      expect(result.stderr).toContain('earlier call')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should resolve a relative body path against the payload cwd on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(
          `gh api -X POST ${REVIEWS} -F body=@review-body.md`,
          join(ctx.fixture, 'project'),
        ),
        scanPassPath(),
        join(ctx.fixture, 'elsewhere'),
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    // A command that only mentions a post is not one. The scan stub fails, so
    // a hook that read the whole string would deny each of these.
    const mention = "gh api -X POST repos/o/r/issues/1/comments -f body='x'"
    const quoting: Record<string, string> = {
      'a heredoc quoting the command': `cat > .canon/tmp/notes.md <<'EOF'\n- ${mention}\nEOF`,
      'a search pattern holding the command': `git grep -n '${mention}'`,
      'a quoted string with a separator before the command': `echo 'done; ${mention}'`,
      'an echo of the command': `echo "${mention}"`,
    }

    for (const [label, command] of Object.entries(quoting)) {
      it.concurrent(`should leave ${tree.label} silent on ${label}`, async ({
        expect,
      }) => {
        const result = await run(
          hook,
          postPayload(command),
          join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
        )

        expect(result.stderr).toBe('')
        expect(result.stdout).toBe('')
        expect(result.code).toBe(0)
      })
    }

    it.concurrent(`should block ${tree.label} on a post chained after another command`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`echo ready && gh api -X POST ${REVIEWS} ${body()}`),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.stderr).toContain('board identifier')
      expect(result.code).toBe(2)
    })

    // A here-string and an arithmetic shift both carry `<<` and neither opens
    // a heredoc, so the post on the next line must still reach the scan.
    const notHeredocs: Record<string, string> = {
      'a here-string with a space': 'cat <<< word',
      'a here-string with no space': 'cat <<<word',
      'a shift in a command substitution': 'echo $((1<<2))',
      'a shift between names': 'echo $((a<<n))',
      'a shift in an arithmetic command': '(( x<<2 ))',
      'a shift in a let command': 'let x=1<<2',
      'a shift nested in parentheses': 'echo $(( (1<<2) + 3 ))',
    }

    for (const [label, opener] of Object.entries(notHeredocs)) {
      it.concurrent(`should block ${tree.label} on a post after ${label}`, async ({
        expect,
      }) => {
        const result = await run(
          hook,
          postPayload(`${opener}\ngh api -X POST ${REVIEWS} ${body()}`),
          join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
        )

        expect(result.stderr).toContain('board identifier')
        expect(result.code).toBe(2)
      })
    }

    it.concurrent(`should block ${tree.label} on a post after a here-string on one line`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`cat <<<word; gh api -X POST ${REVIEWS} ${body()}`),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.stderr).toContain('board identifier')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should still drop a quoted post inside a heredoc after a here-string on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(
          `cat <<< word\ncat > .canon/tmp/n.md <<'EOF'\n- ${mention}\nEOF`,
        ),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should still open a heredoc after a digit file descriptor on ${tree.label}`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(`cat 0<<EOF\n- ${mention}\nEOF`),
        join(ctx.fixture, 'bin-scan-fail') + delimiter + ctx.hookPath,
      )

      expect(result.stderr).toBe('')
      expect(result.code).toBe(0)
    })

    it.concurrent(`should block ${tree.label} on a heredoc and a post in one call`, async ({
      expect,
    }) => {
      const result = await run(
        hook,
        postPayload(
          `cat > .canon/tmp/not-written.md <<'EOF'\nbody\nEOF\ngh api -X POST ${REVIEWS} -F body=@.canon/tmp/not-written.md`,
        ),
        scanPassPath(),
      )

      expect(result.stderr).toContain('earlier call')
      expect(result.code).toBe(2)
    })

    it.concurrent(`should hand back additionalContext on ${tree.label} when canon is absent`, async ({
      expect,
    }) => {
      const result = await run(hook, reviewPost(body()), ctx.hookPath)

      expect(result.stdout).toContain('additionalContext')
      expect(result.stdout).toContain('did not run')
      expect(result.code).toBe(0)
    })
  }
})

// Held local rather than seeded, per the canon-no-seed marker on the file
// itself, so it exists in .claude/hooks/ alone and the directory walk above
// never reaches a seed copy to test.
//
// The acting case above proves the reminder fires on an attended startup. These
// pin the two silences it promises, since a stub answering due on every call
// would otherwise pass a hook that never filtered.
describe('upstream-due.sh silences', () => {
  const hook = join(ROOT, '.claude/hooks/upstream-due.sh')
  const dueBin = (): string =>
    [join(ctx.fixture, 'bin-due'), ctx.hookPath].join(delimiter)

  it.concurrent('should stay silent in a background session', async ({
    expect,
  }) => {
    const result = await run(
      hook,
      payloadFor({ source: 'startup' }),
      dueBin(),
      undefined,
      { CLAUDE_CODE_SESSION_ATTENDED: '0' },
    )

    expect(result.stdout).toBe('')
    expect(result.code).toBe(0)
  })

  it.concurrent('should stay silent on a resume', async ({ expect }) => {
    const result = await run(
      hook,
      payloadFor({ source: 'resume' }),
      dueBin(),
      undefined,
      { CLAUDE_CODE_SESSION_ATTENDED: undefined },
    )

    expect(result.stdout).toBe('')
    expect(result.code).toBe(0)
  })
})

// The acting case proves a write into the folder is denied. These are the
// boundaries around it: the folder's shape is what separates a memory write
// from any other path holding a `memory` segment, and the `Bash` arm reads a
// command unexpanded where the file tools carry an absolute path. The hook
// exists only in `.claude/hooks/`, so this runs against that path alone.
describe('memory-guard.sh boundaries', () => {
  const hook = join(ROOT, '.claude/hooks/memory-guard.sh')
  const home = '/home/x/.claude/projects/-home-x-repo'

  // Every real payload carries the session transcript, which sits under the
  // same projects folder the guard watches, so a case built without it never
  // exercises the payload the hook receives.
  const transcript_path = `${home}/0f2c.jsonl`

  const fileTool = (tool: string, file: string): string =>
    payloadFor({
      tool_input: { file_path: file },
      tool_name: tool,
      transcript_path,
    })
  const shell = (command: string): string =>
    payloadFor({
      tool_input: { command },
      tool_name: 'Bash',
      transcript_path,
    })

  const denied: ReadonlyArray<readonly [string, string]> = [
    ['a Write to a memory note', fileTool('Write', `${home}/memory/note.md`)],
    [
      'a Write to the memory index',
      fileTool('Write', `${home}/memory/MEMORY.md`),
    ],
    ['an Edit', fileTool('Edit', `${home}/memory/note.md`)],
    ['a MultiEdit', fileTool('MultiEdit', `${home}/memory/note.md`)],
    [
      'a tilde path in Bash',
      shell('echo x > ~/.claude/projects/-a/memory/n.md'),
    ],
    [
      'a $HOME path in Bash',
      shell('echo x > $HOME/.claude/projects/-a/memory/n.md'),
    ],
    ['an absolute path in Bash', shell(`echo x > ${home}/memory/n.md`)],
    [
      'a multi-line Bash command',
      shell(`ls\ncp a ${home}/memory/n.md\necho done`),
    ],
    [
      'a CLAUDE_CONFIG_DIR path in Bash',
      shell('echo x > "$CLAUDE_CONFIG_DIR/projects/-a/memory/n.md"'),
    ],
    ['a quoted target without whitespace', shell(`cp a "${home}/memory/n.md"`)],
    ['a tee target', shell(`echo x | tee ${home}/memory/n.md`)],
    [
      'a write after a heredoc terminator',
      shell(`cat > a.md <<'EOF'\nnote\nEOF\ncp a.md ${home}/memory/n.md`),
    ],
    [
      'a write by the command that opened a heredoc',
      shell(`cat > ${home}/memory/n.md <<'EOF'\nnote\nEOF`),
    ],
    [
      'a write after a separator outside quotes',
      shell(`echo 'a; b'; cp x ${home}/memory/n.md`),
    ],
    [
      'a redirect after a heredoc body naming CLAUDE_CONFIG_DIR',
      shell(
        `cat <<EOF\n$CLAUDE_CONFIG_DIR/projects/-a/memory/n.md\nEOF\necho x > $CLAUDE_CONFIG_DIR/projects/-a/memory/n.md`,
      ),
    ],
    ['a here-string naming the folder', shell(`cat <<< ${home}/memory/n.md`)],
    ['a read of the folder through grep', shell(`grep -rn x ${home}/memory`)],
    [
      'a write after a here-string whose word starts with a letter',
      shell(`cat <<< x\ncp a ${home}/memory/n.md`),
    ],
    [
      'a write after a here-string with no space',
      shell(`cat <<<x\ncp a ${home}/memory/n.md`),
    ],
    [
      'a write after an arithmetic shift',
      shell(`echo $((1<<2))\ncp a ${home}/memory/n.md`),
    ],
    [
      'a write after a let shift',
      shell(`let x=1<<2\ncp a ${home}/memory/n.md`),
    ],
    ['a write inside bash -c', shell(`bash -c 'cp a ${home}/memory/n.md'`)],
    [
      'a write inside sudo bash -c',
      shell(`sudo bash -c 'cp a ${home}/memory/n.md'`),
    ],
    [
      'a write inside timeout sh -c',
      shell(`timeout 5 sh -c 'cp a ${home}/memory/n.md'`),
    ],
    [
      'a write inside xargs sh -c',
      shell(`ls | xargs -n1 sh -c 'cp a ${home}/memory/n.md'`),
    ],
    [
      'a write in a python heredoc behind an assignment',
      shell(
        `X=1 python3 - <<'EOF'\nopen('${home}/memory/n.md', 'w').write('x')\nEOF`,
      ),
    ],
    [
      'a write in the body of a bash heredoc',
      shell(`bash <<EOF\ncp a ${home}/memory/n.md\nEOF`),
    ],
    [
      'a write in the body of a python heredoc',
      shell(
        `python3 - <<'EOF'\nopen('${home}/memory/n.md', 'w').write('x')\nEOF`,
      ),
    ],
  ]

  const silent: ReadonlyArray<readonly [string, string]> = [
    ['a session transcript', fileTool('Write', `${home}/session.jsonl`)],
    ['a source folder named memory', fileTool('Write', '/r/src/memory/x.ts')],
    [
      'a canon records folder named memory',
      fileTool('Write', '/r/.canon/memory/a.md'),
    ],
    [
      'a folder only prefixed memory',
      fileTool('Write', `${home}/memory-old/a.md`),
    ],
    ['a read of the folder', fileTool('Read', `${home}/memory/note.md`)],
    ['a command mentioning memory alone', shell('grep -rn memory src/')],
    ['a command naming projects alone', shell('ls ~/.claude/projects')],
    [
      'a heredoc body quoting the folder',
      shell(
        `cat > .canon/tmp/t.md <<'EOF'\nThe guard denies ${home}/memory/n.md\nEOF`,
      ),
    ],
    [
      'a heredoc with a dash and an unquoted terminator',
      shell(`cat > a.md <<-EOF\n\t${home}/memory/n.md\n\tEOF`),
    ],
    [
      'two heredocs on one line',
      shell(
        `cat <<A <<B > a.md\n${home}/memory/n.md\nA\n${home}/memory/m.md\nB`,
      ),
    ],
    [
      'a quoted prose mention',
      shell(`grep -rn "see ${home}/memory/ for notes" docs`),
    ],
    ['a trailing comment', shell(`ls src # not ${home}/memory`)],
    [
      'a commit message naming the folder',
      shell(`git commit -m "guard ${home}/memory writes"`),
    ],
    [
      'a gh api body field naming the folder',
      shell(`gh api x -f body='denied: ${home}/memory/n.md'`),
    ],
    ['a separator inside quotes', shell(`echo 'a; cp x ${home}/memory/n.md'`)],
    [
      'a commit message behind an assignment and a wrapper',
      shell(`env X=1 git commit -m "see ${home}/memory notes"`),
    ],
    [
      'prose after an interpreter command has ended',
      shell(`bash -c 'ls'; git commit -m "see ${home}/memory notes"`),
    ],
    [
      'a CLAUDE_CONFIG_DIR path in a heredoc body',
      shell(`cat <<EOF\n$CLAUDE_CONFIG_DIR/projects/-a/memory/n.md\nEOF`),
    ],
    [
      'a multi-line command with the folder only in a heredoc',
      shell(`ls\ncat > a.md <<'EOF'\n${home}/memory/n.md\nEOF\necho done`),
    ],
  ]

  for (const [label, payload] of denied) {
    it.concurrent(`should deny ${label}`, async ({ expect }) => {
      const result = await run(hook, payload)

      expect(result.stderr).toContain('Auto memory is off')
      expect(result.stdout).toBe('')
      expect(result.code).toBe(2)
    })
  }

  for (const [label, payload] of silent) {
    it.concurrent(`should stay silent on ${label}`, async ({ expect }) => {
      const result = await run(hook, payload)

      expect(result.stderr).toBe('')
      expect(result.stdout).toBe('')
      expect(result.code).toBe(0)
    })
  }

  it.concurrent('should dismiss a command mentioning memory without spawning jq', async ({
    expect,
  }) => {
    const result = await run(
      hook,
      shell('grep -rn memory src/'),
      join(ctx.fixture, 'bin-jq-trap'),
    )

    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)
  })

  it.concurrent('should still reach a verdict when the transcript path precedes the command', async ({
    expect,
  }) => {
    const result = await run(hook, shell(`cp a ${home}/memory/n.md`))

    expect(result.stderr).toContain('Auto memory is off')
    expect(result.code).toBe(2)
  })

  it.concurrent('should deny a write under the directory CLAUDE_CONFIG_DIR names', async ({
    expect,
  }) => {
    const result = await run(
      hook,
      fileTool('Write', '/opt/cfg/projects/-a/memory/n.md'),
      undefined,
      undefined,
      { CLAUDE_CONFIG_DIR: '/opt/cfg' },
    )

    expect(result.stderr).toContain('Auto memory is off')
    expect(result.code).toBe(2)
  })
})
