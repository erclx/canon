/**
 * Checks, or with `--write --pr <number> [--repo <owner/name>]` copies from a repository's `canon/frames` branch, the reel the evidence section plays,
 * its opening still, and a stamp naming the repository and pull request. The repository defaults to the origin remote's.
 * The check `web:build` runs reads the committed files alone, never the network, and refuses a reel or still its stamp no longer matches,
 * so a swapped reel cannot ship under another number.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { REEL_MAX_BYTES } from '../../src/take/reel'

const root = new URL('../..', import.meta.url).pathname
const FRAMES = 'canon/frames'
const REEL = 'assets/loops/reel.webp'
const STILL = 'assets/loops/reel-still.webp'
const STAMP = 'assets/loops/reel.stamp'
const FIELDS = [
  'source',
  'repository',
  'pull-request',
  'filmed-at',
  'address',
  'image-sha256',
  'still-sha256',
  'width',
  'height',
  'reel-seconds',
]

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

function fail(message: string): never {
  console.error(`regen-web-film: ${message}`)
  process.exit(1)
}

function git(args: string[]): Buffer {
  const run = spawnSync('git', args, { cwd: root, maxBuffer: 64 << 20 })
  if (run.status !== 0)
    fail(`git ${args.join(' ')} exited ${run.status}: ${run.stderr}`)
  return run.stdout
}

function readStamp(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(join(root, STAMP), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const at = line.indexOf(': ')
        return [line.slice(0, at), line.slice(at + 2)]
      }),
  )
}

/** The reasons the committed reel no longer matches its stamp, empty when it does. */
function staleness(): string[] {
  const missing = [REEL, STILL, STAMP].filter(
    (path) => !existsSync(join(root, path)),
  )
  if (missing.length) return missing.map((path) => `${path} is missing`)
  const stamp = readStamp()
  const reasons = FIELDS.filter((key) => !stamp[key]).map(
    (key) => `${STAMP} names no ${key}`,
  )
  if (stamp['image-sha256'] !== sha(readFileSync(join(root, REEL))))
    reasons.push(`${REEL} differs from the reel its stamp names`)
  if (stamp['still-sha256'] !== sha(readFileSync(join(root, STILL))))
    reasons.push(`${STILL} differs from the still its stamp names`)
  return reasons
}

interface Chunk {
  readonly type: string
  readonly body: Buffer
}

function chunks(bytes: Buffer, from: number, to: number): Chunk[] {
  const found: Chunk[] = []
  for (let at = from; at + 8 <= to;) {
    const size = bytes.readUInt32LE(at + 4)
    found.push({
      type: bytes.toString('latin1', at, at + 4),
      body: bytes.subarray(at + 8, at + 8 + size),
    })
    at += 8 + size + (size & 1)
  }
  return found
}

const riff = (parts: Buffer[]) => {
  const body = Buffer.concat([Buffer.from('WEBP'), ...parts])
  const head = Buffer.alloc(8)
  head.write('RIFF', 0, 'latin1')
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

const chunk = ({ type, body }: Chunk) => {
  const head = Buffer.alloc(8)
  head.write(type, 0, 'latin1')
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body, Buffer.alloc(body.length & 1)])
}

/**
 * The reel's size, its length, and its opening frame as a still WebP. Only the opening frame is always encoded whole,
 * so its image chunk is lifted out as it is rather than decoded, which ffmpeg cannot do for an animated WebP.
 */
function openReel(bytes: Buffer) {
  if (
    bytes.toString('latin1', 0, 4) !== 'RIFF' ||
    bytes.toString('latin1', 8, 12) !== 'WEBP'
  )
    fail('the reel is not a WebP file')
  const top = chunks(bytes, 12, bytes.length)
  const header = top.find((part) => part.type === 'VP8X')?.body
  const frames = top.filter((part) => part.type === 'ANMF')
  if (!header || frames.length === 0) fail('the reel is not an animated WebP')
  const width = header.readUIntLE(4, 3) + 1
  const height = header.readUIntLE(7, 3) + 1
  const ms = frames.reduce(
    (sum, frame) => sum + frame.body.readUIntLE(12, 3),
    0,
  )
  const first = frames[0]!.body
  if (
    first.readUIntLE(0, 3) !== 0 ||
    first.readUIntLE(3, 3) !== 0 ||
    first.readUIntLE(6, 3) + 1 !== width ||
    first.readUIntLE(9, 3) + 1 !== height
  )
    fail('the reel opens on a frame smaller than its canvas')
  const image = chunks(first, 16, first.length)
  const still = image.some((part) => part.type === 'ALPH')
    ? riff([
        chunk({ type: 'VP8X', body: stillHeader(width, height) }),
        ...image.map(chunk),
      ])
    : riff(image.map(chunk))
  return { width, height, seconds: ms / 1000, still }
}

/** A still's extended header, flagging the alpha its opening frame carries. */
function stillHeader(width: number, height: number) {
  const body = Buffer.alloc(10)
  body[0] = 0x10
  body.writeUIntLE(width - 1, 4, 3)
  body.writeUIntLE(height - 1, 7, 3)
  return body
}

/** The newest reel the pull request's evidence posted, by the capture time in its path. */
function newestReel(repo: string, pullRequest: number) {
  git(['fetch', '--quiet', `https://github.com/${repo}.git`, FRAMES])
  const paths = git([
    'ls-tree',
    '-r',
    '--name-only',
    'FETCH_HEAD',
    `pr-${pullRequest}/`,
  ])
    .toString('utf8')
    .split('\n')
    .filter((path) =>
      /^pr-\d+\/[0-9a-f]+\/\d{8}T\d{6}Z\/reel\.webp$/.test(path),
    )
    .sort((a, b) => a.split('/')[2]!.localeCompare(b.split('/')[2]!))
  const path = paths.at(-1)
  if (!path)
    fail(`${repo} ${FRAMES} holds no reel for pull request #${pullRequest}`)
  return { path, sha: path.split('/')[1]! }
}

/** The origin remote's repository, which `--repo` overrides. */
function originRepo() {
  const remote = git(['remote', 'get-url', 'origin']).toString('utf8').trim()
  const repo = /github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/.exec(remote)?.[1]
  if (!repo) fail(`the origin remote ${remote} is not a GitHub repository`)
  return repo
}

function write(repo: string, pullRequest: number) {
  const reel = newestReel(repo, pullRequest)
  const bytes = git(['show', `FETCH_HEAD:${reel.path}`])
  if (bytes.length > REEL_MAX_BYTES)
    fail(
      `${reel.path} is ${bytes.length} bytes, past the ${REEL_MAX_BYTES} a reel may carry`,
    )
  const opened = openReel(bytes)
  writeFileSync(join(root, REEL), bytes)
  writeFileSync(join(root, STILL), opened.still)
  writeFileSync(
    join(root, STAMP),
    [
      `source: ${FRAMES}:${reel.path}`,
      `repository: ${repo}`,
      `pull-request: ${pullRequest}`,
      `filmed-at: ${reel.sha}`,
      `address: https://github.com/${repo}/pull/${pullRequest}`,
      `image-sha256: ${sha(bytes)}`,
      `still-sha256: ${sha(opened.still)}`,
      `width: ${opened.width}`,
      `height: ${opened.height}`,
      `reel-seconds: ${opened.seconds}`,
      '',
    ].join('\n'),
  )
  console.log(
    `regen-web-film: copied the reel of ${repo} pull request #${pullRequest} filmed at ${reel.sha} to ${REEL}, with its still`,
  )
}

const args = process.argv.slice(2)
if (!args.includes('--write')) {
  const reasons = staleness()
  if (reasons.length)
    fail(
      `${reasons.join(', ')}. Run bun run web:film -- --write --pr <number> [--repo <owner/name>], which copies that pull request's newest reel from the repository's ${FRAMES}.`,
    )
  console.log(`regen-web-film: the reel matches ${STAMP}`)
} else {
  const flag = args.indexOf('--pr')
  const pullRequest = Number(flag === -1 ? Number.NaN : args[flag + 1])
  if (!Number.isInteger(pullRequest) || pullRequest <= 0)
    fail('--write takes --pr <number>, the pull request whose reel to copy')
  const named = args.indexOf('--repo')
  const repo = named === -1 ? originRepo() : (args[named + 1] ?? '')
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo))
    fail(`--repo takes <owner/name>, not ${JSON.stringify(repo)}`)
  write(repo, pullRequest)
}
