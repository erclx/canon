import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  dropFrames,
  type FramesApi,
  frameLink,
  framePath,
  type PullClosure,
  pruneFrames,
  pushFrame,
  readFrame,
  type TreeEntry,
} from '@/pr/frames'

const DAY_MS = 86_400_000
const NOW = new Date('2026-10-02T12:00:00Z')
const HEAD = 'abcdef0123456789abcdef0123456789abcdef01'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])

interface FakeCommit {
  readonly tree: string
  readonly parents: readonly string[]
}

/**
 * An in-memory git data API. A tree is stored flat, as every file path it
 * holds mapped to a blob sha, and listing one derives the top-level entries
 * the way GitHub's non-recursive tree read returns them.
 */
function fakeApi(
  options: {
    readonly pulls?: Readonly<Record<number, PullClosure>>
    readonly failBlob?: boolean
    readonly unreadableTip?: boolean
  } = {},
) {
  let counter = 0
  const id = (kind: string) => `${kind}${(counter += 1)}`
  const trees = new Map<string, Map<string, string>>()
  const commits = new Map<string, FakeCommit>()
  const state: { ref: string | undefined } = { ref: undefined }
  let racer: (() => void) | undefined

  function storeTree(files: Map<string, string>): string {
    const sha = id('tree')
    trees.set(sha, files)
    return sha
  }

  const api: FramesApi = {
    async readTip() {
      if (options.unreadableTip === true) return { kind: 'unreadable' }
      if (state.ref === undefined) return { kind: 'missing' }
      const commit = commits.get(state.ref)
      return { kind: 'found', commit: state.ref, tree: commit?.tree ?? '' }
    },
    async listTree(tree) {
      const files = trees.get(tree)
      if (files === undefined) return undefined
      const entries = new Map<string, TreeEntry>()
      for (const path of files.keys()) {
        const [top = '', ...rest] = path.split('/')
        if (rest.length === 0) {
          entries.set(top, {
            path: top,
            mode: '100644',
            type: 'blob',
            sha: files.get(path) ?? '',
          })
          continue
        }
        if (entries.has(top)) continue
        const sub = new Map<string, string>()
        for (const [p, sha] of files) {
          if (p.startsWith(`${top}/`)) sub.set(p.slice(top.length + 1), sha)
        }
        entries.set(top, {
          path: top,
          mode: '040000',
          type: 'tree',
          sha: storeTree(sub),
        })
      }
      return [...entries.values()]
    },
    async createBlob() {
      return options.failBlob === true ? undefined : id('blob')
    },
    async createTree(entries, base) {
      const files = new Map(base === undefined ? [] : (trees.get(base) ?? []))
      for (const entry of entries) {
        if (entry.type === 'blob') {
          files.set(entry.path, entry.sha)
          continue
        }
        for (const [p, sha] of trees.get(entry.sha) ?? []) {
          files.set(`${entry.path}/${p}`, sha)
        }
      }
      return storeTree(files)
    },
    async createCommit(_message, tree, parents) {
      const sha = id('commit')
      commits.set(sha, { tree, parents })
      return sha
    },
    async createRef(commit) {
      if (state.ref !== undefined) return 'conflict'
      state.ref = commit
      return 'ok'
    },
    async moveRef(commit, force) {
      if (racer !== undefined) {
        const run = racer
        racer = undefined
        run()
      }
      const tip = state.ref
      const parents = commits.get(commit)?.parents ?? []
      if (!force && (tip === undefined || !parents.includes(tip))) {
        return 'conflict'
      }
      state.ref = commit
      return 'ok'
    },
    async deleteRef() {
      state.ref = undefined
      return true
    },
    async readPull(number) {
      return options.pulls?.[number]
    },
  }

  return {
    api,
    state,
    filesAtTip(): string[] {
      if (state.ref === undefined) return []
      const commit = commits.get(state.ref)
      return [...(trees.get(commit?.tree ?? '')?.keys() ?? [])].sort()
    },
    parentsAtTip(): readonly string[] | undefined {
      return state.ref === undefined
        ? undefined
        : commits.get(state.ref)?.parents
    },
    /** Lands a second add between this push's read and its ref move. */
    raceOnce(run: () => void) {
      racer = run
    },
    landOnTip(path: string): void {
      const tip = state.ref ?? ''
      const files = new Map(trees.get(commits.get(tip)?.tree ?? '') ?? [])
      files.set(path, id('blob'))
      const commit = id('commit')
      commits.set(commit, { tree: storeTree(files), parents: [tip] })
      state.ref = commit
    },
    seed(paths: readonly string[]): void {
      const files = new Map(paths.map((path) => [path, id('blob')]))
      const commit = id('commit')
      commits.set(commit, { tree: storeTree(files), parents: [] })
      state.ref = commit
    },
  }
}

function closedDaysAgo(days: number): PullClosure {
  return {
    state: 'closed',
    closedAt: new Date(NOW.getTime() - days * DAY_MS).toISOString(),
  }
}

describe('framePath', () => {
  it('should place a frame under the pull request, the short head, and the box', () => {
    const path = framePath(12, HEAD, 3)

    expect(path).toBe('pr-12/abcdef0/box-3.png')
  })
})

describe('frameLink', () => {
  it('should pin the link to the commit in the blob form', () => {
    const link = frameLink('o/r', 'c0ffee', 'pr-12/abcdef0/box-3.png')

    expect(link).toBe(
      'https://github.com/o/r/blob/c0ffee/pr-12/abcdef0/box-3.png?raw=true',
    )
  })
})

describe('pushFrame', () => {
  it('should create a missing branch with a root commit holding the frame', async () => {
    const fake = fakeApi()

    const result = await pushFrame(fake.api, {
      number: 12,
      head: HEAD,
      box: 1,
      bytes: PNG,
    })

    expect({
      result,
      files: fake.filesAtTip(),
      parents: fake.parentsAtTip(),
    }).toEqual({
      result: expect.objectContaining({ kind: 'pushed', created: true }),
      files: ['pr-12/abcdef0/box-1.png'],
      parents: [],
    })
  })

  it('should return the commit the ref moved to as the pushed commit', async () => {
    const fake = fakeApi()
    fake.seed(['pr-3/1234567/box-1.png'])

    const result = await pushFrame(fake.api, {
      number: 12,
      head: HEAD,
      box: 2,
      bytes: PNG,
    })

    expect(result).toEqual({
      kind: 'pushed',
      commit: fake.state.ref,
      path: 'pr-12/abcdef0/box-2.png',
      created: false,
    })
  })

  it('should keep every frame already on the branch', async () => {
    const fake = fakeApi()
    fake.seed(['pr-3/1234567/box-1.png'])

    await pushFrame(fake.api, { number: 12, head: HEAD, box: 2, bytes: PNG })

    expect(fake.filesAtTip()).toEqual([
      'pr-12/abcdef0/box-2.png',
      'pr-3/1234567/box-1.png',
    ])
  })

  it('should rebuild on the new tip when another add moved the ref first', async () => {
    const fake = fakeApi()
    fake.seed(['pr-3/1234567/box-1.png'])
    fake.raceOnce(() => fake.landOnTip('pr-4/abcdef0/box-1.png'))

    await pushFrame(fake.api, { number: 12, head: HEAD, box: 2, bytes: PNG })

    expect(fake.filesAtTip()).toEqual([
      'pr-12/abcdef0/box-2.png',
      'pr-3/1234567/box-1.png',
      'pr-4/abcdef0/box-1.png',
    ])
  })

  it('should refuse as unreadable-tip when the branch could not be read', async () => {
    const fake = fakeApi({ unreadableTip: true })

    const result = await pushFrame(fake.api, {
      number: 12,
      head: HEAD,
      box: 1,
      bytes: PNG,
    })

    expect(result).toEqual({ kind: 'refused', reason: 'unreadable-tip' })
  })

  it('should refuse as push-failed when a write is refused', async () => {
    const fake = fakeApi({ failBlob: true })

    const result = await pushFrame(fake.api, {
      number: 12,
      head: HEAD,
      box: 1,
      bytes: PNG,
    })

    expect(result).toEqual({ kind: 'refused', reason: 'push-failed' })
  })
})

describe('dropFrames', () => {
  it("should leave a tip tree holding no path under the pull request's folder", async () => {
    const fake = fakeApi()
    fake.seed(['pr-12/abcdef0/box-1.png', 'pr-3/1234567/box-1.png'])

    await dropFrames(fake.api, [12])

    expect(fake.filesAtTip()).toEqual(['pr-3/1234567/box-1.png'])
  })

  it('should leave the tip commit with no parent', async () => {
    const fake = fakeApi()
    fake.seed(['pr-12/abcdef0/box-1.png', 'pr-3/1234567/box-1.png'])
    await pushFrame(fake.api, { number: 3, head: HEAD, box: 2, bytes: PNG })

    await dropFrames(fake.api, [12])

    expect(fake.parentsAtTip()).toEqual([])
  })

  it('should report nothing removed and write nothing when the pull request has no frames', async () => {
    const fake = fakeApi()
    fake.seed(['pr-3/1234567/box-1.png'])
    const before = fake.state.ref

    const result = await dropFrames(fake.api, [12])

    expect({ result, ref: fake.state.ref }).toEqual({
      result: { kind: 'dropped', removed: [] },
      ref: before,
    })
  })

  it('should report nothing removed when the branch is missing', async () => {
    const fake = fakeApi()

    const result = await dropFrames(fake.api, [12])

    expect(result).toEqual({ kind: 'dropped', removed: [] })
  })

  it('should delete the branch when the drop removes its last folder', async () => {
    const fake = fakeApi()
    fake.seed(['pr-12/abcdef0/box-1.png'])

    const result = await dropFrames(fake.api, [12])

    expect({ result, ref: fake.state.ref }).toEqual({
      result: { kind: 'dropped', removed: [12], deleted: true },
      ref: undefined,
    })
  })
})

describe('pruneFrames', () => {
  it('should drop a pull request closed 31 days ago and keep one closed 29 days ago and one open', async () => {
    const fake = fakeApi({
      pulls: {
        1: closedDaysAgo(31),
        2: closedDaysAgo(29),
        3: { state: 'open' },
      },
    })
    fake.seed(['pr-1/a/box-1.png', 'pr-2/a/box-1.png', 'pr-3/a/box-1.png'])

    const result = await pruneFrames(fake.api, 30, NOW)

    expect({ result, files: fake.filesAtTip() }).toEqual({
      result: expect.objectContaining({ kind: 'dropped', removed: [1] }),
      files: ['pr-2/a/box-1.png', 'pr-3/a/box-1.png'],
    })
  })

  it('should keep a pull request closed exactly the given days ago', async () => {
    const fake = fakeApi({ pulls: { 1: closedDaysAgo(30) } })
    fake.seed(['pr-1/a/box-1.png'])

    const result = await pruneFrames(fake.api, 30, NOW)

    expect(result).toEqual(expect.objectContaining({ removed: [] }))
  })

  it('should keep a pull request whose close could not be read', async () => {
    const fake = fakeApi({ pulls: {} })
    fake.seed(['pr-1/a/box-1.png'])

    const result = await pruneFrames(fake.api, 30, NOW)

    expect(result).toEqual(
      expect.objectContaining({ removed: [], unread: [1] }),
    )
  })

  it('should keep a pull request reopened after it closed', async () => {
    const fake = fakeApi({
      pulls: { 1: { state: 'open', closedAt: closedDaysAgo(60).closedAt } },
    })
    fake.seed(['pr-1/a/box-1.png'])

    const result = await pruneFrames(fake.api, 30, NOW)

    expect(result).toEqual(expect.objectContaining({ removed: [] }))
  })

  it('should leave a folder that names no pull request alone', async () => {
    const fake = fakeApi({ pulls: { 1: closedDaysAgo(40) } })
    fake.seed(['README.md', 'pr-1/a/box-1.png'])

    await pruneFrames(fake.api, 30, NOW)

    expect(fake.filesAtTip()).toEqual(['README.md'])
  })
})

describe('readFrame', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'canon-pr-frames-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('should return the bytes of a PNG', async () => {
    await writeFile(join(dir, 'box-1.png'), PNG)

    const bytes = await readFrame(join(dir, 'box-1.png'))

    expect(bytes?.length).toBe(PNG.length)
  })

  it('should refuse a missing file', async () => {
    const bytes = await readFrame(join(dir, 'absent.png'))

    expect(bytes).toBeUndefined()
  })

  it('should refuse a file that is not a PNG', async () => {
    await writeFile(join(dir, 'box-1.png'), 'not an image')

    const bytes = await readFrame(join(dir, 'box-1.png'))

    expect(bytes).toBeUndefined()
  })
})
