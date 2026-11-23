import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  branchSlug,
  buildDriveCopy,
  checkPassPage,
  loadPreviewConfig,
  PASS_OFFSET_SHIFT,
  readWorktreeOffset,
  runSeed,
  startPassPreview,
  stopPassPreview,
} from '@/pr/drive-copy'

let tempDir: string
let worktree: string
let copyRoot: string

function git(...args: string[]): void {
  execaSync('git', ['-C', worktree, ...args], {
    env: {
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  })
}

function write(path: string, text: string): void {
  mkdirSync(dirname(join(worktree, path)), { recursive: true })
  writeFileSync(join(worktree, path), text)
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'canon-drive-copy-'))
  worktree = join(tempDir, 'worktree')
  copyRoot = join(tempDir, 'copy', 'board')
  mkdirSync(worktree)
  git('init', '-q', '-b', 'feat/x')
  write('board/frames.json', '{"x":0}')
  write('board/assets/a.png', 'a')
  write('README.md', '# r\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('loadPreviewConfig', () => {
  it('should read as absent when the project declares no config', () => {
    expect(loadPreviewConfig(worktree)).toEqual({ kind: 'absent' })
  })

  it('should default the variable name when the config leaves it out', () => {
    write('canon/config/preview.json', '{"writes":["board"]}')

    expect(loadPreviewConfig(worktree)).toEqual({
      kind: 'read',
      config: { writes: ['board'], env: 'CANON_PREVIEW_ROOT', keep: [] },
    })
  })

  it('should read the keep paths a declared path holds', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":["board/.run"]}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'read',
      config: { keep: ['board/.run'] },
    })
  })

  it('should refuse a keep that is not a list of paths', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":"board/.run"}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'bad-config',
    })
  })

  it('should refuse a keep outside every declared path', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":["elsewhere/.run"]}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'bad-config',
    })
  })

  it('should refuse a keep equal to a declared path', () => {
    write('canon/config/preview.json', '{"writes":["board"],"keep":["board"]}')

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'bad-config',
    })
  })

  it('should refuse a keep equal to a nested declared path', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board","board/assets"],"keep":["board/assets"]}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'bad-config',
    })
  })

  it('should refuse a keep climbing out of the worktree', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":["board/../../etc"]}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'unsafe-path',
    })
  })

  it('should keep the variable name the project declares', () => {
    write(
      'canon/config/preview.json',
      '{"writes":["board"],"env":"BOARD_ROOT"}',
    )

    expect(loadPreviewConfig(worktree)).toMatchObject({
      config: { env: 'BOARD_ROOT' },
    })
  })

  it('should refuse a config that does not parse', () => {
    write('canon/config/preview.json', '{"writes":')

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'bad-config',
    })
  })

  it('should refuse a writes path climbing out of the worktree', () => {
    write('canon/config/preview.json', '{"writes":["board/../../etc"]}')

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'unsafe-path',
    })
  })

  it('should refuse an absolute writes path', () => {
    write('canon/config/preview.json', '{"writes":["/etc"]}')

    expect(loadPreviewConfig(worktree)).toMatchObject({
      kind: 'refused',
      reason: 'unsafe-path',
    })
  })

  describe('with a seed', () => {
    it('should read the seed as the argv list the project declares', () => {
      write(
        'canon/config/preview.json',
        '{"writes":["board"],"seed":["bun","scripts/seed.ts"]}',
      )

      expect(loadPreviewConfig(worktree)).toMatchObject({
        kind: 'read',
        config: { seed: ['bun', 'scripts/seed.ts'] },
      })
    })

    it('should carry no seed key when the project declares none', () => {
      write('canon/config/preview.json', '{"writes":["board"]}')

      const read = loadPreviewConfig(worktree)

      expect(read.kind === 'read' && 'seed' in read.config).toBe(false)
    })

    it.each([
      ['a string', '"bun scripts/seed.ts"'],
      ['an empty list', '[]'],
      ['a list holding a non-string', '["bun", 3]'],
      ['a list opening on an empty command', '["", "seed.ts"]'],
    ])('should refuse a seed that is %s', (_label, seed) => {
      write('canon/config/preview.json', `{"writes":["board"],"seed":${seed}}`)

      expect(loadPreviewConfig(worktree)).toMatchObject({
        kind: 'refused',
        reason: 'bad-config',
      })
    })
  })

  describe('with a serve command and a port', () => {
    it('should read the serve argv and the port the project declares', () => {
      write(
        'canon/config/preview.json',
        '{"writes":["board"],"serve":["bun","run","dev"],"port":5173}',
      )

      expect(loadPreviewConfig(worktree)).toMatchObject({
        kind: 'read',
        config: { serve: ['bun', 'run', 'dev'], port: 5173 },
      })
    })

    it('should read a port declared without a serve command', () => {
      write('canon/config/preview.json', '{"writes":["board"],"port":4321}')

      const read = loadPreviewConfig(worktree)

      expect(read).toMatchObject({ kind: 'read', config: { port: 4321 } })
      expect(read.kind === 'read' && 'serve' in read.config).toBe(false)
    })

    it('should carry neither key when the project declares neither', () => {
      write('canon/config/preview.json', '{"writes":["board"]}')

      const read = loadPreviewConfig(worktree)

      expect(
        read.kind === 'read' &&
          ('serve' in read.config || 'port' in read.config),
      ).toBe(false)
    })

    it.each([
      ['a string', '"bun run dev"'],
      ['an empty list', '[]'],
      ['a list opening on an empty command', '["", "dev"]'],
    ])('should refuse a serve that is %s', (_label, serve) => {
      write(
        'canon/config/preview.json',
        `{"writes":["board"],"serve":${serve},"port":5173}`,
      )

      expect(loadPreviewConfig(worktree)).toMatchObject({
        kind: 'refused',
        reason: 'bad-config',
      })
    })

    it.each([
      ['a string', '"5173"'],
      ['zero', '0'],
      ['a fraction', '5173.5'],
      ['above the last port', '65536'],
    ])('should refuse a port that is %s', (_label, port) => {
      write('canon/config/preview.json', `{"writes":["board"],"port":${port}}`)

      expect(loadPreviewConfig(worktree)).toMatchObject({
        kind: 'refused',
        reason: 'bad-config',
      })
    })

    it('should refuse a serve command with no port to wait on', () => {
      write(
        'canon/config/preview.json',
        '{"writes":["board"],"serve":["bun","run","dev"]}',
      )

      expect(loadPreviewConfig(worktree)).toMatchObject({
        kind: 'refused',
        reason: 'bad-config',
        detail: expect.stringContaining('"port"'),
      })
    })
  })
})

describe('buildDriveCopy', () => {
  it('should copy each declared path into the copy root', () => {
    const result = buildDriveCopy(worktree, copyRoot, ['board'])

    expect(result).toEqual({ copied: ['board'], missing: [] })
    expect(readFileSync(join(copyRoot, 'board/frames.json'), 'utf8')).toBe(
      '{"x":0}',
    )
  })

  it('should replace what the last copy held', () => {
    buildDriveCopy(worktree, copyRoot, ['board'])
    writeFileSync(join(copyRoot, 'board/dragged.json'), '{}')

    buildDriveCopy(worktree, copyRoot, ['board'])

    expect(existsSync(join(copyRoot, 'board/dragged.json'))).toBe(false)
  })

  it('should name a declared path the worktree does not hold', () => {
    const result = buildDriveCopy(worktree, copyRoot, ['board', 'gone'])

    expect(result).toEqual({ copied: ['board'], missing: ['gone'] })
  })

  it('should leave a file at the copy root outside every declared path', () => {
    buildDriveCopy(worktree, copyRoot, ['board'])
    writeFileSync(join(copyRoot, 'server-state.json'), '{}')

    buildDriveCopy(worktree, copyRoot, ['board'])

    expect(existsSync(join(copyRoot, 'server-state.json'))).toBe(true)
  })

  it('should remove the copy of a declared path the worktree no longer holds', () => {
    buildDriveCopy(worktree, copyRoot, ['board', 'gone'])
    mkdirSync(join(copyRoot, 'gone'), { recursive: true })
    writeFileSync(join(copyRoot, 'gone/stale.json'), '{}')

    const result = buildDriveCopy(worktree, copyRoot, ['board', 'gone'])

    expect(result.missing).toEqual(['gone'])
    expect(existsSync(join(copyRoot, 'gone'))).toBe(false)
  })

  it('should end nested declared paths with the outer content and a fresh inner copy', () => {
    buildDriveCopy(worktree, copyRoot, ['board', 'board/assets'])
    writeFileSync(join(copyRoot, 'board/assets/dragged.png'), 'd')
    writeFileSync(join(copyRoot, 'board/dragged.json'), '{}')

    buildDriveCopy(worktree, copyRoot, ['board', 'board/assets'])

    expect(existsSync(join(copyRoot, 'board/dragged.json'))).toBe(false)
    expect(existsSync(join(copyRoot, 'board/assets/dragged.png'))).toBe(false)
    expect(readFileSync(join(copyRoot, 'board/assets/a.png'), 'utf8')).toBe('a')
  })

  describe('with a keep path', () => {
    it('should leave a keep path in the copy while resetting a dragged sibling', () => {
      buildDriveCopy(worktree, copyRoot, ['board'])
      mkdirSync(join(copyRoot, 'board/.run'), { recursive: true })
      writeFileSync(join(copyRoot, 'board/.run/address.json'), '{"pid":1}')
      writeFileSync(join(copyRoot, 'board/dragged.json'), '{}')

      buildDriveCopy(worktree, copyRoot, ['board'], ['board/.run'])

      expect(
        readFileSync(join(copyRoot, 'board/.run/address.json'), 'utf8'),
      ).toBe('{"pid":1}')
      expect(existsSync(join(copyRoot, 'board/dragged.json'))).toBe(false)
      expect(existsSync(join(copyRoot, 'board/frames.json'))).toBe(true)
    })

    it('should not copy a keep path the worktree holds, even into an empty root', () => {
      write('board/.run/address.json', '{"pid":"stale"}')

      buildDriveCopy(worktree, copyRoot, ['board'], ['board/.run'])

      expect(existsSync(join(copyRoot, 'board/.run'))).toBe(false)
      expect(existsSync(join(copyRoot, 'board/frames.json'))).toBe(true)
    })

    it('should not replace a kept file with the worktree copy of it', () => {
      buildDriveCopy(worktree, copyRoot, ['board'])
      mkdirSync(join(copyRoot, 'board/.run'), { recursive: true })
      writeFileSync(join(copyRoot, 'board/.run/address.json'), '{"pid":1}')
      write('board/.run/address.json', '{"pid":"stale"}')

      buildDriveCopy(worktree, copyRoot, ['board'], ['board/.run'])

      expect(
        readFileSync(join(copyRoot, 'board/.run/address.json'), 'utf8'),
      ).toBe('{"pid":1}')
    })

    it('should create nothing for a keep path the copy lacks', () => {
      const result = buildDriveCopy(
        worktree,
        copyRoot,
        ['board'],
        ['board/.run'],
      )

      expect(result).toEqual({ copied: ['board'], missing: [] })
      expect(existsSync(join(copyRoot, 'board/.run'))).toBe(false)
    })

    it('should keep state under a declared path the worktree no longer holds', () => {
      mkdirSync(join(copyRoot, 'gone/.run'), { recursive: true })
      writeFileSync(join(copyRoot, 'gone/.run/address.json'), '{"pid":1}')
      writeFileSync(join(copyRoot, 'gone/stale.json'), '{}')

      buildDriveCopy(worktree, copyRoot, ['gone'], ['gone/.run'])

      expect(existsSync(join(copyRoot, 'gone/.run/address.json'))).toBe(true)
      expect(existsSync(join(copyRoot, 'gone/stale.json'))).toBe(false)
    })
  })
})

describe('runSeed', () => {
  it('should run the seed from the worktree with the copy root in the variable', async () => {
    mkdirSync(copyRoot, { recursive: true })
    const seed = [
      process.execPath,
      '-e',
      "require('fs').writeFileSync(process.env.BOARD_ROOT + '/seeded.txt', process.cwd())",
    ]

    const run = await runSeed(worktree, copyRoot, seed, 'BOARD_ROOT')

    expect(run).toEqual({ kind: 'ran', exit: 0 })
    expect(readFileSync(join(copyRoot, 'seeded.txt'), 'utf8')).toBe(
      realpathSync(worktree),
    )
  })

  it('should report a seed that exits non-zero with the tail of its stderr', async () => {
    const lines = Array.from({ length: 25 }, (_, index) => `line ${index + 1}`)
    const seed = [
      process.execPath,
      '-e',
      `console.error(${JSON.stringify(lines.join('\n'))}); process.exit(3)`,
    ]

    const run = await runSeed(worktree, copyRoot, seed, 'BOARD_ROOT')

    expect(run).toEqual({
      kind: 'failed',
      exit: 3,
      timedOut: false,
      stderr: lines.slice(5),
    })
  })

  it('should stop a seed that runs past its limit and report it timed out', async () => {
    const seed = [process.execPath, '-e', 'setTimeout(() => {}, 10000)']

    const run = await runSeed(worktree, copyRoot, seed, 'BOARD_ROOT', 200)

    expect(run).toMatchObject({ kind: 'failed', timedOut: true })
  })

  it('should stop a seed whose work runs in a grandchild at the limit', async () => {
    const started = Date.now()

    const run = await runSeed(
      worktree,
      copyRoot,
      ['sh', '-c', 'sleep 10; true'],
      'BOARD_ROOT',
      200,
    )

    expect(run).toMatchObject({ kind: 'failed', timedOut: true })
    expect(Date.now() - started).toBeLessThan(5000)
  })

  it('should report a seed whose command does not exist as failed', async () => {
    const run = await runSeed(
      worktree,
      copyRoot,
      ['canon-no-such-seed-command'],
      'BOARD_ROOT',
    )

    expect(run).toMatchObject({
      kind: 'failed',
      exit: null,
      timedOut: false,
      error: expect.stringContaining('canon-no-such-seed-command'),
    })
  })

  it('should carry no error on a seed that started and exited non-zero', async () => {
    const run = await runSeed(
      worktree,
      copyRoot,
      [process.execPath, '-e', 'process.exit(1)'],
      'BOARD_ROOT',
    )

    expect(run).not.toHaveProperty('error')
  })
})

describe('branchSlug', () => {
  it('should drop a leading type segment and flatten the rest', () => {
    expect(branchSlug('feat/review-ui/drive-copy')).toBe('review-ui-drive-copy')
  })

  it('should keep a first segment that names no type', () => {
    expect(branchSlug('spike/parser')).toBe('spike-parser')
  })

  it('should keep a type that no further segment follows', () => {
    expect(branchSlug('feat')).toBe('feat')
  })
})

describe('readWorktreeOffset', () => {
  it('should read offset zero when the project installs no port helper', async () => {
    expect(await readWorktreeOffset(worktree)).toEqual({
      kind: 'offset',
      value: 0,
    })
  })

  it('should read the offset the port helper prints from the worktree', async () => {
    write(
      'scripts/worktree-port.sh',
      '[ "$(pwd -P)" = "$EXPECTED" ] || exit 9\necho $(( ${1:-0} + 17 ))\n',
    )

    const read = await readWorktreeOffset(worktree, {
      EXPECTED: realpathSync(worktree),
    })

    expect(read).toEqual({ kind: 'offset', value: 17 })
  })

  it('should refuse with the helper stderr when the helper refuses the folder', async () => {
    write(
      'scripts/worktree-port.sh',
      'echo "worktree-port: leftover folder" >&2\nexit 1\n',
    )

    expect(await readWorktreeOffset(worktree)).toEqual({
      kind: 'refused',
      detail: 'worktree-port: leftover folder',
    })
  })

  it('should refuse when the helper prints something other than a number', async () => {
    write('scripts/worktree-port.sh', 'echo offset\n')

    expect(await readWorktreeOffset(worktree)).toMatchObject({
      kind: 'refused',
    })
  })
})

/** Whether any process in the group `pid` leads is still alive. */
function isGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0)
    return true
  } catch {
    return false
  }
}

describe('the pass preview', () => {
  const base = 20_000 + Math.floor(Math.random() * 20_000)
  const passPort = base + PASS_OFFSET_SHIFT

  /** A server on the base plus the offset it is handed, answering `/` with `status`. */
  function stubServe(status = 200): readonly string[] {
    return [
      process.execPath,
      '-e',
      [
        `const port = ${base} + Number(process.env.WORKTREE_PORT_OFFSET)`,
        "require('fs').writeFileSync(process.env.CANON_PREVIEW_ROOT + '/served-from', process.cwd())",
        `Bun.serve({ port, fetch: () => new Response('<p>', { status: ${status}, headers: { 'content-type': 'text/html' } }) })`,
      ].join('\n'),
    ]
  }

  function start(serve: readonly string[], timeoutMs?: number) {
    mkdirSync(copyRoot, { recursive: true })
    return startPassPreview({
      worktree,
      copyRoot,
      serve,
      env: 'CANON_PREVIEW_ROOT',
      basePort: base,
      worktreeOffset: 0,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    })
  }

  afterEach(async () => {
    await stopPassPreview(copyRoot)
  })

  it('should start the server on the copy at the pass offset and record it beside the copy root', async () => {
    const started = await start(stubServe())

    expect(started).toMatchObject({
      kind: 'started',
      server: { port: passPort, url: `http://localhost:${passPort}` },
    })
    expect(readFileSync(join(copyRoot, 'served-from'), 'utf8')).toBe(
      realpathSync(worktree),
    )
    expect(
      JSON.parse(readFileSync(join(dirname(copyRoot), 'server.json'), 'utf8')),
    ).toMatchObject({ port: passPort })
  })

  it('should end the whole server group on stop and forget it', async () => {
    const started = await start(stubServe())
    const pid = started.kind === 'started' ? started.server.pid : -1

    const stopped = await stopPassPreview(copyRoot)

    expect(stopped).toEqual({ kind: 'stopped', pid, port: passPort })
    expect(isGroupAlive(pid)).toBe(false)
    expect(existsSync(join(dirname(copyRoot), 'server.json'))).toBe(false)
  })

  it('should read as not running on a stop with no server started', async () => {
    expect(await stopPassPreview(copyRoot)).toEqual({ kind: 'not-running' })
  })

  it('should fail as exited with the stderr tail when the serve command exits before answering', async () => {
    const outcome = await start(
      [process.execPath, '-e', "console.error('no vite'); process.exit(3)"],
      30_000,
    )

    expect(outcome).toEqual({
      kind: 'failed',
      cause: 'exited',
      exit: 3,
      output: ['no vite'],
      detail: expect.any(String),
    })
    expect(existsSync(join(dirname(copyRoot), 'server.json'))).toBe(false)
  })

  it('should fail as spawn when the serve command does not exist', async () => {
    const outcome = await start(['canon-no-such-serve-command'])

    expect(outcome).toMatchObject({ kind: 'failed', cause: 'spawn' })
  })

  it('should fail as port-taken and start nothing when the pass port already answers', async () => {
    const holder = Bun.serve({ port: passPort, fetch: () => new Response() })

    const outcome = await start(stubServe())
    await holder.stop(true)

    expect(outcome).toMatchObject({ kind: 'failed', cause: 'port-taken' })
    expect(existsSync(join(copyRoot, 'served-from'))).toBe(false)
  })

  it('should fail as timeout and end the group when the port never answers', async () => {
    const outcome = await start(
      [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
      1_500,
    )

    expect(outcome).toMatchObject({ kind: 'failed', cause: 'timeout' })
    expect(existsSync(join(dirname(copyRoot), 'server.json'))).toBe(false)
  })

  it('should read a page answering 500 at the root as stale', async () => {
    const started = await start(stubServe(500))
    const url = started.kind === 'started' ? started.server.url : ''

    expect(await checkPassPage(url, [])).toEqual({ path: '/', status: 500 })
  })

  it('should read a page answering 200 with no failing health path as fresh', async () => {
    const started = await start(stubServe())
    const url = started.kind === 'started' ? started.server.url : ''

    expect(await checkPassPage(url, [])).toBeUndefined()
  })
})
