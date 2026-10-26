import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  dropFrames,
  dropFramesWithLegacy,
  type FrameInput,
  type FramesApi,
  frameLink,
  framePath,
  isFrameHead,
  isFramePass,
  isFrameTheme,
  type PullClosure,
  pruneFrames,
  pruneFramesWithLegacy,
  pushFrame,
  REEL_MAX_BYTES,
  readFrame,
  readReel,
  reelPath,
  referencePath,
  referenceSlug,
  type TreeEntry,
} from '@/pr/frames'

const DAY_MS = 86_400_000
const NOW = new Date('2026-10-02T12:00:00Z')
const HEAD = 'abcdef0123456789abcdef0123456789abcdef01'
const PASS = '20261002T154450Z'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
/** `RIFF`, a little-endian size, then `WEBP`, the twelve bytes a WebP opens on. */
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1,
])

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

function frame(number: number, box: number, pass = PASS): FrameInput {
  return { number, head: HEAD, pass, box, bytes: PNG }
}

describe('framePath', () => {
  it('should place a frame under the pull request, the short head, the pass, and the box', () => {
    const path = framePath(12, HEAD, PASS, 3)

    expect(path).toBe(`pr-12/abcdef0/${PASS}/box-3.png`)
  })

  it('should keep a dark and a light shot of one box at distinct paths', () => {
    const paths = [
      framePath(12, HEAD, PASS, 3, 'dark'),
      framePath(12, HEAD, PASS, 3, 'light'),
    ]

    expect(paths).toEqual([
      `pr-12/abcdef0/${PASS}/box-3-dark.png`,
      `pr-12/abcdef0/${PASS}/box-3-light.png`,
    ])
  })
})

describe('referenceSlug', () => {
  it('should join the page and the frame with a double dash', () => {
    expect(referenceSlug('home/hero.v2')).toBe('home--hero.v2')
  })

  it.each([
    'home',
    'home/hero/extra',
    '../hero',
    'home/..',
    'home/../x',
    '/hero',
    'home/',
    'my page/hero',
    'home/.hidden',
    'a--b/hero',
    'home/a--b',
  ])(
    'should refuse %s since its slug would not stay one file name',
    (address) => {
      expect(referenceSlug(address)).toBeUndefined()
    },
  )
})

describe('referenceSlug on a design folder path', () => {
  it('should join the surface and the name of a tracked reference', () => {
    expect(referenceSlug('canon/design/button/dark.png')).toBe(
      'design--button--dark',
    )
  })

  it('should read the name with or without its png extension', () => {
    expect(referenceSlug('canon/design/button/light')).toBe(
      'design--button--light',
    )
  })

  it.each([
    'canon/design/button',
    'canon/design/button/dark/extra',
    'canon/design/../dark.png',
    'canon/design/a--b/dark.png',
    'canon/other/button/dark.png',
    'design/button/dark.png',
  ])(
    'should refuse %s since it names no single tracked reference',
    (address) => {
      expect(referenceSlug(address)).toBeUndefined()
    },
  )
})

describe('referencePath', () => {
  it('should file a reference beside the box frames of one pass', () => {
    expect(referencePath(12, HEAD, PASS, 'home/hero')).toBe(
      `pr-12/abcdef0/${PASS}/ref-home--hero.png`,
    )
  })

  it('should file a tracked reference beside the box frames of one pass', () => {
    expect(referencePath(12, HEAD, PASS, 'canon/design/button/dark.png')).toBe(
      `pr-12/abcdef0/${PASS}/ref-design--button--dark.png`,
    )
  })

  it('should return nothing for an address without a slug', () => {
    expect(referencePath(12, HEAD, PASS, '../../x')).toBeUndefined()
  })
})

describe('isFrameTheme', () => {
  it('should accept dark and light and nothing else', () => {
    const answers = ['dark', 'light', 'Dark', 'sepia', ''].map(isFrameTheme)

    expect(answers).toEqual([true, true, false, false, false])
  })
})

describe('frameLink', () => {
  it('should link by the frames branch path in the blob form', () => {
    const link = frameLink('o/r', 'pr-12/abcdef0/x/box-3.png')

    expect(link).toBe(
      'https://github.com/o/r/blob/canon/frames/pr-12/abcdef0/x/box-3.png?raw=true',
    )
  })
})

describe('isFrameHead', () => {
  it('should accept a short and a full lowercase sha', () => {
    expect([isFrameHead('abc1234'), isFrameHead(HEAD)]).toEqual([true, true])
  })

  it('should refuse a branch name, a path, and a six-character prefix', () => {
    expect([
      isFrameHead('main'),
      isFrameHead('abc1234/x'),
      isFrameHead('abc123'),
    ]).toEqual([false, false, false])
  })
})

describe('isFramePass', () => {
  it('should accept a compact UTC stamp', () => {
    expect(isFramePass(PASS)).toBe(true)
  })

  it('should refuse an extended ISO stamp and a path', () => {
    expect([isFramePass('2026-10-02T15:44:50Z'), isFramePass('../x')]).toEqual([
      false,
      false,
    ])
  })
})

describe('pushFrame', () => {
  it('should create a missing branch with a root commit holding the frame', async () => {
    const fake = fakeApi()

    const result = await pushFrame(fake.api, frame(12, 1))

    expect({
      result,
      files: fake.filesAtTip(),
      parents: fake.parentsAtTip(),
    }).toEqual({
      result: expect.objectContaining({ kind: 'pushed', created: true }),
      files: [`pr-12/abcdef0/${PASS}/box-1.png`],
      parents: [],
    })
  })

  it('should return the commit the ref moved to as the pushed commit', async () => {
    const fake = fakeApi()
    fake.seed(['pr-3/1234567/box-1.png'])

    const result = await pushFrame(fake.api, frame(12, 2))

    expect(result).toEqual({
      kind: 'pushed',
      commit: fake.state.ref,
      path: `pr-12/abcdef0/${PASS}/box-2.png`,
      created: false,
    })
  })

  it('should keep every frame already on the branch', async () => {
    const fake = fakeApi()
    fake.seed(['pr-3/1234567/box-1.png'])

    await pushFrame(fake.api, frame(12, 2))

    expect(fake.filesAtTip()).toEqual([
      `pr-12/abcdef0/${PASS}/box-2.png`,
      'pr-3/1234567/box-1.png',
    ])
  })

  it('should keep the first pass frame when a second pass drives the same head and box', async () => {
    const fake = fakeApi()
    await pushFrame(fake.api, frame(12, 2))

    await pushFrame(fake.api, frame(12, 2, '20261002T170000Z'))

    expect(fake.filesAtTip()).toEqual([
      `pr-12/abcdef0/${PASS}/box-2.png`,
      'pr-12/abcdef0/20261002T170000Z/box-2.png',
    ])
  })

  it('should rebuild on the new tip when another add moved the ref first', async () => {
    const fake = fakeApi()
    fake.seed(['pr-3/1234567/box-1.png'])
    fake.raceOnce(() => fake.landOnTip('pr-4/abcdef0/box-1.png'))

    await pushFrame(fake.api, frame(12, 2))

    expect(fake.filesAtTip()).toEqual([
      `pr-12/abcdef0/${PASS}/box-2.png`,
      'pr-3/1234567/box-1.png',
      'pr-4/abcdef0/box-1.png',
    ])
  })

  it('should refuse as unreadable-tip when the branch could not be read', async () => {
    const fake = fakeApi({ unreadableTip: true })

    const result = await pushFrame(fake.api, frame(12, 1))

    expect(result).toEqual({ kind: 'refused', reason: 'unreadable-tip' })
  })

  it('should refuse as push-failed when a write is refused', async () => {
    const fake = fakeApi({ failBlob: true })

    const result = await pushFrame(fake.api, frame(12, 1))

    expect(result).toEqual({ kind: 'refused', reason: 'push-failed' })
  })
})

describe('pushFrame with a reference', () => {
  const reference = (address: string): FrameInput => ({
    number: 12,
    head: HEAD,
    pass: PASS,
    reference: address,
    bytes: PNG,
  })

  it('should land a reference at ref-<page>--<frame>.png and return that path', async () => {
    const fake = fakeApi()

    const result = await pushFrame(fake.api, reference('home/hero'))

    expect({ result, files: fake.filesAtTip() }).toEqual({
      result: expect.objectContaining({
        kind: 'pushed',
        path: `pr-12/abcdef0/${PASS}/ref-home--hero.png`,
      }),
      files: [`pr-12/abcdef0/${PASS}/ref-home--hero.png`],
    })
  })

  it('should keep a box frame at box-<n>.png beside the reference', async () => {
    const fake = fakeApi()

    await pushFrame(fake.api, frame(12, 1))
    await pushFrame(fake.api, reference('home/hero'))

    expect(fake.filesAtTip()).toEqual([
      `pr-12/abcdef0/${PASS}/box-1.png`,
      `pr-12/abcdef0/${PASS}/ref-home--hero.png`,
    ])
  })

  it('should overwrite only itself when one reference is captured twice in a pass', async () => {
    const fake = fakeApi()

    await pushFrame(fake.api, reference('home/hero'))
    await pushFrame(fake.api, reference('home/hero'))

    expect(fake.filesAtTip()).toEqual([
      `pr-12/abcdef0/${PASS}/ref-home--hero.png`,
    ])
  })

  it('should write nothing for an address that would escape the pass folder', async () => {
    const fake = fakeApi()

    const result = await pushFrame(fake.api, reference('../../pr-1/x'))

    expect({ result, files: fake.filesAtTip() }).toEqual({
      result: { kind: 'refused', reason: 'push-failed' },
      files: [],
    })
  })

  it('should clear a reference when its pull request is dropped', async () => {
    const fake = fakeApi()
    await pushFrame(fake.api, reference('home/hero'))
    await pushFrame(fake.api, frame(13, 1))

    await dropFrames(fake.api, [12])

    expect(fake.filesAtTip()).toEqual([`pr-13/abcdef0/${PASS}/box-1.png`])
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
    await pushFrame(fake.api, frame(3, 2))

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

describe('dropFramesWithLegacy', () => {
  it('should remove a pull request from both refs and list it once', async () => {
    const current = fakeApi()
    const legacy = fakeApi()
    current.seed(['pr-12/a/box-1.png', 'pr-3/a/box-1.png'])
    legacy.seed(['pr-12/b/box-1.png', 'pr-4/a/box-1.png'])

    const result = await dropFramesWithLegacy(current.api, legacy.api, [12])

    expect({
      result,
      current: current.filesAtTip(),
      legacy: legacy.filesAtTip(),
    }).toEqual({
      result: expect.objectContaining({
        kind: 'dropped',
        removed: [12],
        legacy: true,
      }),
      current: ['pr-3/a/box-1.png'],
      legacy: ['pr-4/a/box-1.png'],
    })
  })

  it('should delete the legacy ref when the drop empties it', async () => {
    const current = fakeApi()
    const legacy = fakeApi()
    legacy.seed(['pr-12/b/box-1.png'])

    const result = await dropFramesWithLegacy(current.api, legacy.api, [12])

    expect({ result, legacyRef: legacy.state.ref }).toEqual({
      result: { kind: 'dropped', removed: [12], legacy: true },
      legacyRef: undefined,
    })
  })

  it('should report ok with no legacy flag when the legacy ref is missing', async () => {
    const current = fakeApi()
    const legacy = fakeApi()
    current.seed(['pr-12/a/box-1.png', 'pr-3/a/box-1.png'])

    const result = await dropFramesWithLegacy(current.api, legacy.api, [12])

    expect(result).toEqual(
      expect.objectContaining({ kind: 'dropped', removed: [12] }),
    )
    expect(result).not.toHaveProperty('legacy')
  })

  it('should keep the current result when the legacy ref is unreadable', async () => {
    const current = fakeApi()
    const legacy = fakeApi({ unreadableTip: true })
    current.seed(['pr-12/a/box-1.png', 'pr-3/a/box-1.png'])

    const result = await dropFramesWithLegacy(current.api, legacy.api, [12])

    expect(result).toEqual(
      expect.objectContaining({ kind: 'dropped', removed: [12] }),
    )
  })

  it('should leave the legacy ref alone when the current ref is unreadable', async () => {
    const current = fakeApi({ unreadableTip: true })
    const legacy = fakeApi()
    legacy.seed(['pr-12/b/box-1.png'])

    const result = await dropFramesWithLegacy(current.api, legacy.api, [12])

    expect({ result, legacy: legacy.filesAtTip() }).toEqual({
      result: { kind: 'refused', reason: 'unreadable-tip' },
      legacy: ['pr-12/b/box-1.png'],
    })
  })
})

describe('pruneFramesWithLegacy', () => {
  it('should drop closed pull requests on both refs, keep open ones, and delete an emptied legacy ref', async () => {
    const pulls = { 1: closedDaysAgo(31), 2: { state: 'open' as const } }
    const current = fakeApi({ pulls })
    const legacy = fakeApi({ pulls })
    current.seed(['pr-1/a/box-1.png', 'pr-2/a/box-1.png'])
    legacy.seed(['pr-1/b/box-1.png'])

    const result = await pruneFramesWithLegacy(current.api, legacy.api, 30, NOW)

    expect({
      result,
      current: current.filesAtTip(),
      legacyRef: legacy.state.ref,
    }).toEqual({
      result: expect.objectContaining({
        kind: 'dropped',
        removed: [1],
        kept: [2],
        legacy: true,
      }),
      current: ['pr-2/a/box-1.png'],
      legacyRef: undefined,
    })
  })

  it('should keep and list unread a legacy pull request whose state could not be read', async () => {
    const current = fakeApi({ pulls: { 1: closedDaysAgo(31) } })
    const legacy = fakeApi({ pulls: { 1: closedDaysAgo(31) } })
    current.seed(['pr-1/a/box-1.png'])
    legacy.seed(['pr-1/b/box-1.png', 'pr-9/b/box-1.png'])

    const result = await pruneFramesWithLegacy(current.api, legacy.api, 30, NOW)

    expect(result).toEqual(
      expect.objectContaining({ removed: [1], kept: [9], unread: [9] }),
    )
  })

  it('should report ok with no legacy flag when the legacy ref is missing', async () => {
    const current = fakeApi({ pulls: { 2: { state: 'open' } } })
    const legacy = fakeApi()
    current.seed(['pr-2/a/box-1.png'])

    const result = await pruneFramesWithLegacy(current.api, legacy.api, 30, NOW)

    expect(result).toEqual({
      kind: 'dropped',
      removed: [],
      kept: [2],
      unread: [],
    })
  })
})

describe('pushFrame with a reel', () => {
  const reel = (number = 12): FrameInput => ({
    number,
    head: HEAD,
    pass: PASS,
    reel: true,
    bytes: WEBP,
  })

  it('should land the reel at reel.webp beside the box frames of one pass', async () => {
    const fake = fakeApi()

    await pushFrame(fake.api, frame(12, 1))
    const result = await pushFrame(fake.api, reel())

    expect({ result, files: fake.filesAtTip() }).toEqual({
      result: expect.objectContaining({
        kind: 'pushed',
        path: `pr-12/abcdef0/${PASS}/reel.webp`,
      }),
      files: [
        `pr-12/abcdef0/${PASS}/box-1.png`,
        `pr-12/abcdef0/${PASS}/reel.webp`,
      ],
    })
  })

  it('should match the path reelPath names', () => {
    expect(reelPath(12, HEAD, PASS)).toBe(`pr-12/abcdef0/${PASS}/reel.webp`)
  })

  it('should clear the reel when its pull request is dropped', async () => {
    const fake = fakeApi()
    await pushFrame(fake.api, reel(12))
    await pushFrame(fake.api, frame(13, 1))

    await dropFrames(fake.api, [12])

    expect(fake.filesAtTip()).toEqual([`pr-13/abcdef0/${PASS}/box-1.png`])
  })
})

describe('readReel', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'canon-pr-reel-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('should return the bytes of a WebP', async () => {
    await writeFile(join(dir, 'reel.webp'), WEBP)

    const read = await readReel(join(dir, 'reel.webp'))

    expect(read).toEqual({ kind: 'read', bytes: new Uint8Array(WEBP) })
  })

  it('should refuse a missing file, a PNG, and an MP4', async () => {
    await writeFile(join(dir, 'reel.png'), PNG)
    // An MP4 opens on a box size and `ftyp`, never on RIFF.
    await writeFile(
      join(dir, 'reel.mp4'),
      new Uint8Array([
        0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0,
      ]),
    )

    const reads = await Promise.all(
      ['absent.webp', 'reel.png', 'reel.mp4'].map((name) =>
        readReel(join(dir, name)),
      ),
    )

    expect(reads).toEqual([
      { kind: 'unreadable' },
      { kind: 'unreadable' },
      { kind: 'unreadable' },
    ])
  })

  it('should refuse a WebP past the cap with its size', async () => {
    const big = new Uint8Array(REEL_MAX_BYTES + 1)
    big.set(WEBP)
    await writeFile(join(dir, 'reel.webp'), big)

    const read = await readReel(join(dir, 'reel.webp'))

    expect(read).toEqual({ kind: 'too-large', size: REEL_MAX_BYTES + 1 })
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
