import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa, type ResultPromise } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { LIVE_EVENTS_PATH } from '@/serve/static'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const FIXTURE_ROOT = join(REPO_ROOT, 'examples', 'teach')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because the printed line
 * depends on the process working directory and the list verb reports through
 * `process.exitCode`, both of which an in-process call would share with the
 * test runner.
 */
async function runTeach(
  args: string[],
  cwd: string = REPO_ROOT,
): Promise<{
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}> {
  const result = await execa(process.execPath, [CLI, 'teach', ...args], {
    cwd,
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

interface UpRecord {
  readonly ok: boolean
  readonly reason?: string
  readonly contents?: readonly string[]
  readonly served?: string
  readonly port?: number
  readonly entry?: string
  readonly url?: string
  readonly host?: string
}

/**
 * Starts `canon teach up` and resolves with its first stdout line, leaving the
 * child serving. The verb blocks until interrupted, so awaiting its exit, as
 * `runTeach` does, would never return on success.
 */
function startUp(args: string[]): {
  readonly child: ResultPromise
  readonly firstLine: Promise<string>
} {
  const child = execa(process.execPath, [CLI, 'teach', 'up', ...args], {
    cwd: REPO_ROOT,
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })
  const firstLine = new Promise<string>((settle) => {
    let buffered = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      buffered += chunk.toString()
      const end = buffered.indexOf('\n')
      if (end !== -1) settle(buffered.slice(0, end))
    })
    void child.then(() => settle(buffered))
  })
  return { child, firstLine }
}

/** A copy of the fixture, since `up` rewrites the pages it serves. */
function copyFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'teach-up-'))
  const root = join(dir, 'teach')
  cpSync(FIXTURE_ROOT, root, { recursive: true })
  return root
}

/** A lesson carrying the four chrome marker pairs `nav` splices into. */
function addLesson(root: string, file: string, title: string): void {
  writeFileSync(
    join(root, '00-fixture', 'lessons', file),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<!-- canon:teach:style -->
<!-- /canon:teach:style -->
</head>
<body>
<!-- canon:teach:header -->
<!-- /canon:teach:header -->
<h1>${title}</h1>
<p class="lede">Added while the workspace was served.</p>
<!-- canon:teach:footnav -->
<!-- /canon:teach:footnav -->
<!-- canon:teach:scripts -->
<!-- /canon:teach:scripts -->
</body>
</html>
`,
  )
}

interface EventReader {
  /** Everything read so far once it carries the needle, or at the deadline. */
  readonly until: (needle: string) => Promise<string>
}

const openReaders: ReadableStreamDefaultReader<Uint8Array>[] = []

/** Opens the live event stream of a running `up` and reads it on demand. */
async function openEvents(
  record: UpRecord,
  timeoutMs = 10_000,
): Promise<EventReader> {
  const response = await fetch(
    `http://${record.host}:${record.port}${LIVE_EVENTS_PATH}`,
  )
  if (!response.body) throw new Error('expected an event stream body')
  const reader = response.body.getReader()
  openReaders.push(reader)
  const decoder = new TextDecoder()
  const deadline = Date.now() + timeoutMs
  let seen = ''

  return {
    until: async (needle) => {
      while (!seen.includes(needle) && Date.now() < deadline) {
        const next = await Promise.race([
          reader.read(),
          new Promise<undefined>((settle) =>
            setTimeout(() => settle(undefined), deadline - Date.now()),
          ),
        ])
        if (next === undefined || next.done) break
        seen += decoder.decode(next.value)
      }
      return seen
    },
  }
}

function holdPort(): Promise<Server> {
  return new Promise((settle) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => settle(server))
  })
}

function heldPort(server: Server): number {
  const address = server.address()
  if (address === null || typeof address === 'string') return 0
  return address.port
}

describe('canon teach', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('should name canon teach up in the parent help', async () => {
    const result = await runTeach(['--help'])

    expect(result.stdout).toContain('canon teach up <topic>')
  })

  it('should print the serve line relative to the cwd for one workspace', async () => {
    const result = await runTeach([
      'list',
      '00-fixture',
      '--root',
      'examples/teach',
    ])

    expect(result.stderr).toContain(
      'canon serve examples/teach --entry 00-fixture/index.html',
    )
  })

  it('should print the absolute teach folder when it sits outside the cwd', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'teach-serve-'))
    tempDirs.push(outside)

    const result = await runTeach(
      ['list', '00-fixture', '--root', FIXTURE_ROOT],
      outside,
    )

    expect(result.stderr).toContain(
      `canon serve ${FIXTURE_ROOT} --entry 00-fixture/index.html`,
    )
  })

  it('should leave the JSON record without a serve field', async () => {
    const result = await runTeach([
      'list',
      '--root',
      'examples/teach',
      '--json',
    ])

    const record = JSON.parse(result.stdout) as Record<string, unknown>
    expect(Object.keys(record).sort()).toEqual([
      'next',
      'ok',
      'root',
      'workspaces',
    ])
  })
})

describe('canon teach up', () => {
  const tempDirs: string[] = []
  const children: ResultPromise[] = []
  const servers: Server[] = []

  afterEach(async () => {
    // A stream the child already closed on its way out rejects the cancel.
    await Promise.all(
      openReaders
        .splice(0)
        .map((reader) => reader.cancel().catch(() => undefined)),
    )
    for (const child of children.splice(0)) {
      child.kill('SIGTERM')
      await child
    }
    for (const server of servers.splice(0)) server.close()
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function launch(args: string[]): Promise<string> {
    const { child, firstLine } = startUp(args)
    children.push(child)
    return firstLine
  }

  function fixtureRoot(): string {
    const root = copyFixture()
    tempDirs.push(join(root, '..'))
    return root
  }

  it('should open the named workspace contents page', async () => {
    const root = fixtureRoot()

    const record = JSON.parse(
      await launch(['00-fixture', '--root', root, '--json']),
    ) as UpRecord

    expect(record).toMatchObject({ ok: true, entry: '00-fixture/index.html' })
  })

  it('should open the teach root page when no topic is named', async () => {
    const root = fixtureRoot()

    const record = JSON.parse(
      await launch(['--root', root, '--json']),
    ) as UpRecord

    expect(record).toMatchObject({ ok: true, entry: 'index.html' })
  })

  it('should serve the pages the nav pass just refreshed', async () => {
    const root = fixtureRoot()
    const contents = join(root, '00-fixture', 'index.html')
    writeFileSync(contents, 'stale\n')

    const record = JSON.parse(
      await launch(['00-fixture', '--root', root, '--json']),
    ) as UpRecord
    const served = await (await fetch(record.url ?? '')).text()
    const onDisk = readFileSync(contents, 'utf8')

    expect(onDisk).not.toBe('stale\n')
    expect(served.replace(/<script>[^<]*<\/script>(?=<\/body>)/, '')).toBe(
      onDisk,
    )
  })

  it('should splice the reload script into a served page and never onto disk', async () => {
    const root = fixtureRoot()
    const contents = join(root, '00-fixture', 'index.html')

    const record = JSON.parse(
      await launch(['00-fixture', '--root', root, '--json']),
    ) as UpRecord
    const served = await (await fetch(record.url ?? '')).text()

    expect(served).toContain('EventSource')
    expect(readFileSync(contents, 'utf8')).not.toContain('EventSource')
  })

  it('should take the next free port when the requested one is held', async () => {
    const root = fixtureRoot()
    const server = await holdPort()
    servers.push(server)
    const held = heldPort(server)

    const record = JSON.parse(
      await launch(['--root', root, '--port', String(held), '--json']),
    ) as UpRecord

    expect(record.port).toBeGreaterThan(held)
  })

  it('should carry the nav and serve fields in one stdout record', async () => {
    const root = fixtureRoot()
    const { child, firstLine } = startUp(['--root', root, '--json'])
    children.push(child)
    await firstLine
    child.kill('SIGTERM')
    const result = await child

    const lines = String(result.stdout).trim().split('\n')
    expect(lines).toHaveLength(1)
    expect(Object.keys(JSON.parse(lines[0] ?? '{}')).sort()).toEqual([
      'contents',
      'entry',
      'entryExists',
      'host',
      'lessons',
      'ok',
      'port',
      'reference',
      'root',
      'served',
      'skipped',
      'unresolved',
      'url',
    ])
  })

  it('should list a lesson added while serving and tell the page to reload', async () => {
    const root = fixtureRoot()
    const record = JSON.parse(
      await launch(['00-fixture', '--root', root, '--json']),
    ) as UpRecord
    const events = await openEvents(record)
    await events.until(': open')

    addLesson(root, '0004-delta-element.html', 'Delta element')

    expect(await events.until('data: ')).toContain('"reload":true')
    const contents = await (await fetch(record.url ?? '')).text()
    expect(contents).toContain('Delta element')
  })

  it('should keep stdout to the one record after a refresh', async () => {
    const root = fixtureRoot()
    const { child, firstLine } = startUp(['--root', root, '--json'])
    children.push(child)
    const events = await openEvents(JSON.parse(await firstLine) as UpRecord)
    await events.until(': open')
    addLesson(root, '0004-delta-element.html', 'Delta element')
    await events.until('data: ')
    child.kill('SIGTERM')

    const result = await child

    expect(String(result.stdout).trim().split('\n')).toHaveLength(1)
  })

  it('should refuse a topic naming no workspace without serving', async () => {
    const root = fixtureRoot()

    const result = await runTeach(['up', 'absent', '--root', root, '--json'])

    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false })
  })
})
