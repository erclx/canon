import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  encodeProjectPath,
  locateTranscript,
  projectsDir,
  readSideFolder,
  readTranscript,
  transcriptFacts,
} from '@/sessions/transfer/transcript'

const ID = '2cb831b1-b32c-4d57-80a8-d23cbc5ef81e'

let DIR: string

beforeEach(() => {
  DIR = mkdtempSync(join(tmpdir(), 'canon-transcript-'))
})

afterEach(() => {
  rmSync(DIR, { recursive: true, force: true })
})

function seedTranscript(folder: string, lines: readonly object[]): string {
  mkdirSync(join(DIR, folder), { recursive: true })
  const path = join(DIR, folder, `${ID}.jsonl`)
  writeFileSync(path, lines.map((line) => `${JSON.stringify(line)}\n`).join(''))
  return path
}

describe('encodeProjectPath', () => {
  it('should replace every non-alphanumeric character with a dash', () => {
    expect(encodeProjectPath('/home/erclx/.claude/jobs/27d29f97')).toBe(
      '-home-erclx--claude-jobs-27d29f97',
    )
  })

  it('should encode a Windows drive path the same way', () => {
    expect(encodeProjectPath('C:\\Users\\me\\repo')).toBe('C--Users-me-repo')
  })
})

describe('projectsDir', () => {
  it('should resolve under CLAUDE_CONFIG_DIR when it is set', () => {
    const previous = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = DIR

    try {
      expect(projectsDir()).toBe(join(DIR, 'projects'))
    } finally {
      if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR
      else process.env.CLAUDE_CONFIG_DIR = previous
    }
  })
})

describe('locateTranscript', () => {
  it('should find a transcript under a folder encoding another path', () => {
    const path = seedTranscript('-other-machine-repo', [{ type: 'user' }])

    expect(locateTranscript(ID, DIR)).toEqual({
      folder: join(DIR, '-other-machine-repo'),
      transcript: path,
      side: join(DIR, '-other-machine-repo', ID),
    })
  })

  it('should return null for an id no folder holds', () => {
    seedTranscript('-repo', [{ type: 'user' }])

    expect(locateTranscript('00000000-0000-0000-0000-000000000000', DIR)).toBe(
      null,
    )
  })

  it('should return null for an id that is not a plain identifier', () => {
    expect(locateTranscript('../escape', DIR)).toBe(null)
  })

  it('should return null when the projects folder is absent', () => {
    expect(locateTranscript(ID, join(DIR, 'nowhere'))).toBe(null)
  })
})

describe('readSideFolder', () => {
  it('should list every file under the side folder by its relative path', () => {
    const side = join(DIR, ID)
    mkdirSync(join(side, 'tool-results'), { recursive: true })
    mkdirSync(join(side, 'subagents'), { recursive: true })
    writeFileSync(join(side, 'custom-title.json'), '{}')
    writeFileSync(join(side, 'tool-results', 'b0.txt'), 'out')
    writeFileSync(join(side, 'subagents', 'agent-1.jsonl'), '{}\n')

    expect(readSideFolder(side).sort()).toEqual([
      'custom-title.json',
      'subagents/agent-1.jsonl',
      'tool-results/b0.txt',
    ])
  })

  it('should return no files when the side folder is absent', () => {
    expect(readSideFolder(join(DIR, 'absent'))).toEqual([])
  })
})

describe('readTranscript', () => {
  it('should drop a trailing partial line a live session is mid-way through writing', () => {
    const path = join(DIR, 'live.jsonl')
    writeFileSync(path, '{"a":1}\n{"b":2}\n{"c":')

    expect(new TextDecoder().decode(readTranscript(path))).toBe(
      '{"a":1}\n{"b":2}\n',
    )
  })
})

describe('transcriptFacts', () => {
  it('should read the last custom title, the last working directory, and the first timestamp', () => {
    const path = seedTranscript('-repo', [
      { type: 'custom-title', customTitle: 'first' },
      { type: 'user', cwd: '/a', timestamp: '2026-09-01T08:00:00.000Z' },
      { type: 'custom-title', customTitle: 'second' },
      { type: 'assistant', cwd: '/b', timestamp: '2026-09-01T09:00:00.000Z' },
    ])

    expect(transcriptFacts(readTranscript(path))).toEqual({
      title: 'second',
      cwd: '/b',
      startedAt: '2026-09-01T08:00:00.000Z',
      compacted: false,
    })
  })

  it('should report a compaction boundary', () => {
    const path = seedTranscript('-repo', [
      { type: 'system', subtype: 'compact_boundary' },
    ])

    expect(transcriptFacts(readTranscript(path)).compacted).toBe(true)
  })

  it('should skip a line that does not parse rather than failing the read', () => {
    const path = join(DIR, 'bad.jsonl')
    writeFileSync(path, 'not json\n{"type":"custom-title","customTitle":"t"}\n')

    expect(transcriptFacts(readTranscript(path)).title).toBe('t')
  })
})
