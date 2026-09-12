import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeTranscript } from '@/transcripts/fetch'
import type { VideoMetadata } from '@/transcripts/metadata'

const ROLLING_VTT = [
  'WEBVTT',
  '',
  '00:00:00.000 --> 00:00:02.000',
  'attention lets the model',
  '',
  '00:00:02.000 --> 00:00:04.000',
  'attention lets the model weigh tokens',
  '',
].join('\n')

const METADATA: VideoMetadata = {
  videoId: 'sandboxVid01',
  title: 'How Attention Works',
  channel: 'Deep Learning Daily',
  durationSeconds: 372,
  published: '2026-01-14',
  url: 'https://www.youtube.com/watch?v=sandboxVid01',
}

let workDir: string

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'transcripts-test-'))
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('writeTranscript', () => {
  it('names the file by fetch date, title slug, and video id', () => {
    const subPath = join(workDir, 'captions.vtt')
    writeFileSync(subPath, ROLLING_VTT)
    writeTranscript(METADATA, subPath, {
      outDir: workDir,
      keepTimestamps: false,
      fetchedAt: '2026-06-18',
    })
    expect(readdirSync(workDir)).toContain(
      '2026-06-18--how-attention-works--sandboxVid01.md',
    )
  })

  it('writes a new dated file rather than overwriting an earlier fetch', () => {
    const subPath = join(workDir, 'captions.vtt')
    writeFileSync(subPath, ROLLING_VTT)
    writeTranscript(METADATA, subPath, {
      outDir: workDir,
      keepTimestamps: false,
      fetchedAt: '2026-06-18',
    })
    writeTranscript(METADATA, subPath, {
      outDir: workDir,
      keepTimestamps: false,
      fetchedAt: '2026-06-19',
    })
    const files = readdirSync(workDir).filter((name) => name.endsWith('.md'))
    expect(files).toContain('2026-06-18--how-attention-works--sandboxVid01.md')
    expect(files).toContain('2026-06-19--how-attention-works--sandboxVid01.md')
  })

  it('writes a minimal index.md stub on first run and leaves it alone after', () => {
    writeTranscript(METADATA, null, {
      outDir: workDir,
      keepTimestamps: false,
      fetchedAt: '2026-06-18',
    })
    const indexPath = join(workDir, 'index.md')
    expect(readFileSync(indexPath, 'utf8')).toContain('title: Transcripts')

    writeFileSync(indexPath, 'hand-edited\n')
    writeTranscript(METADATA, null, {
      outDir: workDir,
      keepTimestamps: false,
      fetchedAt: '2026-06-19',
    })
    expect(readFileSync(indexPath, 'utf8')).toBe('hand-edited\n')
  })

  it('writes frontmatter, a heading, and deduped prose from the captions', () => {
    const subPath = join(workDir, 'captions.vtt')
    writeFileSync(subPath, ROLLING_VTT)
    const target = writeTranscript(METADATA, subPath, {
      outDir: workDir,
      keepTimestamps: false,
      fetchedAt: '2026-06-18',
    })
    const content = readFileSync(target, 'utf8')
    expect(content).toContain('has_transcript: true')
    expect(content).toContain('# How Attention Works')
    expect(content).toContain('attention lets the model weigh tokens')
  })

  it('records an unavailable note when there is no captions file', () => {
    const target = writeTranscript(METADATA, null, {
      outDir: workDir,
      keepTimestamps: false,
      fetchedAt: '2026-06-18',
    })
    const content = readFileSync(target, 'utf8')
    expect(content).toContain('has_transcript: false')
    expect(content).toContain('Transcript unavailable')
  })
})
