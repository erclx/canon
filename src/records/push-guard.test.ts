import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { guardPayload, MAX_RECORD_BYTES } from '@/records/push-guard'

let TREE: string

/** Assembled at runtime so no scanner reads a whole token in this file. */
const TOKEN = 'ghp_' + 'a'.repeat(36)

function writeRecord(path: string, text: string): string {
  mkdirSync(join(TREE, path, '..'), { recursive: true })
  writeFileSync(join(TREE, path), text)
  return path
}

function writeSized(path: string, bytes: number): string {
  writeRecord(path, '')
  truncateSync(join(TREE, path), bytes)
  return path
}

beforeEach(() => {
  TREE = mkdtempSync(join(tmpdir(), 'canon-push-guard-'))
})

afterEach(() => {
  rmSync(TREE, { recursive: true, force: true })
})

describe('guardPayload', () => {
  it('should pass a plain text record', async () => {
    const path = writeRecord('memory/entry.md', '# memory\n')

    expect(await guardPayload(TREE, [path])).toEqual([])
  })

  it('should pass a file exactly at the ceiling', async () => {
    const path = writeSized('groundwork/at.bin', MAX_RECORD_BYTES)

    expect(await guardPayload(TREE, [path])).toEqual([])
  })

  it('should block a file one byte over the ceiling as oversized', async () => {
    const path = writeSized('tmp/backup.tar', MAX_RECORD_BYTES + 1)

    const blocked = await guardPayload(TREE, [path])

    expect(blocked).toHaveLength(1)
    expect(blocked[0]).toMatchObject({ path, cause: 'oversized' })
  })

  it('should block a file carrying a credential with its label and line', async () => {
    const path = writeRecord('plans/notes.md', `# notes\n\ntoken: ${TOKEN}\n`)

    const blocked = await guardPayload(TREE, [path])

    expect(blocked).toEqual([
      { path, cause: 'credential', detail: 'GitHub token at line 3' },
    ])
  })

  it('should never carry the matched value or its preview in the detail', async () => {
    const path = writeRecord('plans/notes.md', `token: ${TOKEN}\n`)

    const [finding] = await guardPayload(TREE, [path])

    expect(finding.detail).not.toContain(TOKEN.slice(0, 4))
    expect(finding.detail).not.toContain(TOKEN.slice(-4))
  })

  it('should pass a credential line carrying the exemption marker', async () => {
    const path = writeRecord(
      'plans/notes.md',
      `token: ${TOKEN} <!-- canon-allow-secret: revoked sample -->\n`,
    )

    expect(await guardPayload(TREE, [path])).toEqual([])
  })

  it('should skip a binary file rather than scan it', async () => {
    const path = writeRecord('diagrams/image.png', `\0\0${TOKEN}\0`)

    expect(await guardPayload(TREE, [path])).toEqual([])
  })

  it('should skip a symlink rather than follow it', async () => {
    const target = writeRecord('outside.md', `token: ${TOKEN}\n`)
    symlinkSync(join(TREE, target), join(TREE, 'link.md'))

    expect(await guardPayload(TREE, ['link.md'])).toEqual([])
  })

  it('should name every blocked path rather than the first', async () => {
    const big = writeSized('tmp/a.tar', MAX_RECORD_BYTES + 1)
    const secret = writeRecord('tmp/b.env', `KEY=${TOKEN}\n`)

    const blocked = await guardPayload(TREE, [big, secret])

    expect(blocked.map((finding) => finding.path)).toEqual([big, secret])
  })
})
