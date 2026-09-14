import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MIN_ADDED_WORDS } from '@/context/classify/extract'
import type { ChatOutcome } from '@/context/classify/ollama'
import {
  classifyDiff,
  classifySweep,
  type ModelClient,
} from '@/context/classify/run'
import { gitEnv } from '@/git-env'

const LONG_PARAGRAPH = Array.from(
  { length: MIN_ADDED_WORDS + 5 },
  (_, i) => `word${i}`,
).join(' ')

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function write(path: string, body: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, `${body}\n`)
}

function commit(message: string, files: Record<string, string>): void {
  for (const [path, body] of Object.entries(files)) write(path, body)
  git('add', '--all')
  git('commit', '-m', message)
}

function reachableClient(reply: ChatOutcome): ModelClient {
  return {
    probe: async () => true,
    chat: async () => reply,
  }
}

function unreachableClient(): ModelClient {
  return {
    probe: async () => false,
    chat: async () => {
      throw new Error('chat should never be called when the probe fails')
    },
  }
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-classify-run-'))
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('classifyDiff', () => {
  it('should refuse a bad range rather than reporting a clean run', async () => {
    commit('chore: init', { 'README.md': 'seed' })

    const result = await classifyDiff(ROOT, 'not-a-real-ref')

    expect(result.kind).toBe('refused')
    if (result.kind === 'refused') expect(result.reason).toBe('bad-range')
  })

  it('should report the model layer off when nothing configures a backend', async () => {
    commit('chore: init', {
      'canon/context/example.md': '## Overview\nOriginal.\n',
    })
    write(
      'canon/context/example.md',
      `## Overview\nOriginal.\n\nHas since moved on \`feat/x\`.\n\n${LONG_PARAGRAPH}\n`,
    )

    const result = await classifyDiff(ROOT, 'HEAD')

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.record.modelLayer).toBe('off')
    expect(result.record.findings).toHaveLength(1)
    expect(result.record.findings[0].decidedBy).toBe('regex')
    expect(result.record.findings[0].verdict).toBe('HISTORY')
  })

  it('should exit clean and fall back to regex when a configured backend is unreachable', async () => {
    commit('chore: init', {
      'canon/context/example.md': '## Overview\nOriginal.\n',
    })
    write('canon/context/example.md', `## Overview\n${LONG_PARAGRAPH}\n`)

    const result = await classifyDiff(ROOT, 'HEAD', {
      flags: { backend: 'ollama', model: 'qwen3.8:27b' },
      client: unreachableClient(),
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.record.modelLayer).toBe('skipped-unreachable')
    expect(result.record.findings[0].decidedBy).toBe('regex')
    expect(result.record.findings[0].model).toBeUndefined()
  })

  it('should report skipped-no-model when a backend is configured with no model', async () => {
    commit('chore: init', {
      'canon/context/example.md': '## Overview\nOriginal.\n',
    })
    write('canon/context/example.md', `## Overview\n${LONG_PARAGRAPH}\n`)

    const result = await classifyDiff(ROOT, 'HEAD', {
      flags: { backend: 'ollama' },
      client: unreachableClient(),
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.record.modelLayer).toBe('skipped-no-model')
  })

  it('should prefer a parsed model verdict over the regex verdict', async () => {
    commit('chore: init', {
      'canon/context/example.md': '## Overview\nOriginal.\n',
    })
    write('canon/context/example.md', `## Overview\n${LONG_PARAGRAPH}\n`)

    const client = reachableClient({
      kind: 'ok',
      raw: 'raw',
      parsed: {
        verdict: 'REPLACE',
        quote: 'word0',
        reason: 'restates a figure',
      },
    })

    const result = await classifyDiff(ROOT, 'HEAD', {
      flags: { backend: 'ollama', model: 'qwen3.8:27b' },
      client,
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.record.modelLayer).toBe('ran')
    expect(result.record.findings[0].decidedBy).toBe('model')
    expect(result.record.findings[0].verdict).toBe('REPLACE')
    expect(result.record.findings[0].regex.verdict).toBe('KEEP')
  })

  it('should fall back to the regex verdict when the model reply is unparsed', async () => {
    commit('chore: init', {
      'canon/context/example.md': '## Overview\nOriginal.\n',
    })
    write('canon/context/example.md', `## Overview\n${LONG_PARAGRAPH}\n`)

    const client = reachableClient({ kind: 'unparsed', raw: 'not json' })

    const result = await classifyDiff(ROOT, 'HEAD', {
      flags: { backend: 'ollama', model: 'qwen3.8:27b' },
      client,
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.record.findings[0].decidedBy).toBe('regex')
    expect(result.record.findings[0].modelUnparsed).toBe(true)
  })

  it('should exit clean when a finding is not KEEP, since findings never fail the run', async () => {
    commit('chore: init', {
      'canon/context/example.md': '## Overview\nOriginal.\n',
    })
    write(
      'canon/context/example.md',
      `## Overview\nOriginal.\n\nHas since moved on \`feat/x\`.\n\n${LONG_PARAGRAPH}\n`,
    )

    const result = await classifyDiff(ROOT, 'HEAD')

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.record.findings.some((f) => f.verdict !== 'KEEP')).toBe(true)
  })
})

describe('classifySweep', () => {
  it('should report the record shape for a regex-only sweep', async () => {
    mkdirSync(join(ROOT, 'canon'), { recursive: true })
    writeFileSync(join(ROOT, 'canon', 'DESIGN.md'), '## Spacing\nTokens.\n')

    const result = await classifySweep(ROOT, { docTypes: ['design'] })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.record.mode).toBe('sweep')
    expect(result.record.modelLayer).toBe('off')
    expect(result.record.findings).toHaveLength(1)
    expect(result.record.findings[0].verdict).toBe('KEEP')
  })

  it('should carry the model verdict through to the finding when it ran and parsed', async () => {
    mkdirSync(join(ROOT, 'canon'), { recursive: true })
    writeFileSync(join(ROOT, 'canon', 'DESIGN.md'), '## Spacing\nTokens.\n')

    const client = reachableClient({
      kind: 'ok',
      raw: 'raw',
      parsed: {
        verdict: 'REWRITE',
        quote: 'Tokens',
        reason: 'carries history',
      },
    })

    const result = await classifySweep(ROOT, {
      docTypes: ['design'],
      flags: { backend: 'ollama', model: 'qwen3.8:27b' },
      client,
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.record.findings[0].verdict).toBe('REWRITE')
    expect(result.record.findings[0].decidedBy).toBe('model')
  })
})
