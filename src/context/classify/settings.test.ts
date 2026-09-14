import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CLASSIFIER_CONFIG_REL,
  resolveClassifier,
  writeClassifierConfig,
} from '@/context/classify/settings'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'classifier-settings-'))
  delete process.env.CANON_CLASSIFIER_BACKEND
  delete process.env.CANON_CLASSIFIER_MODEL
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
  delete process.env.CANON_CLASSIFIER_BACKEND
  delete process.env.CANON_CLASSIFIER_MODEL
})

function writeConfig(root: string, body: string): void {
  const path = join(root, CLASSIFIER_CONFIG_REL)
  mkdirSync(join(root, 'canon', 'config'), { recursive: true })
  writeFileSync(path, body)
}

describe('resolveClassifier', () => {
  it('should report off when nothing configures a backend', () => {
    expect(resolveClassifier(root, {})).toEqual({
      kind: 'off',
      source: 'default',
    })
  })

  it('should prefer the CLI flag over every other source', () => {
    process.env.CANON_CLASSIFIER_BACKEND = 'ollama'
    process.env.CANON_CLASSIFIER_MODEL = 'env-model'
    writeConfig(
      root,
      '[classifier]\nbackend = "ollama"\nmodel = "file-model"\n',
    )

    const result = resolveClassifier(root, {
      backend: 'ollama',
      model: 'flag-model',
    })

    expect(result).toEqual({
      kind: 'configured',
      backend: 'ollama',
      model: 'flag-model',
      source: 'flag',
    })
  })

  it('should prefer the environment over the project file', () => {
    process.env.CANON_CLASSIFIER_BACKEND = 'ollama'
    process.env.CANON_CLASSIFIER_MODEL = 'env-model'
    writeConfig(
      root,
      '[classifier]\nbackend = "ollama"\nmodel = "file-model"\n',
    )

    const result = resolveClassifier(root, {})

    expect(result).toEqual({
      kind: 'configured',
      backend: 'ollama',
      model: 'env-model',
      source: 'env',
    })
  })

  it('should fall back to the project config file', () => {
    writeConfig(
      root,
      '[classifier]\nbackend = "ollama"\nmodel = "qwen3.8:27b"\n',
    )

    const result = resolveClassifier(root, {})

    expect(result).toEqual({
      kind: 'configured',
      backend: 'ollama',
      model: 'qwen3.8:27b',
      source: 'file',
    })
  })

  it('should report no-model when the backend resolves but no model does', () => {
    process.env.CANON_CLASSIFIER_BACKEND = 'ollama'

    const result = resolveClassifier(root, {})

    expect(result).toEqual({
      kind: 'no-model',
      backend: 'ollama',
      source: 'env',
    })
  })

  it('should report off when the file explicitly turns the backend off', () => {
    writeConfig(root, '[classifier]\nbackend = "off"\n')

    const result = resolveClassifier(root, {})

    expect(result).toEqual({ kind: 'off', source: 'file' })
  })

  it('should fall through an unrecognized environment value to the file', () => {
    process.env.CANON_CLASSIFIER_BACKEND = 'claude'
    writeConfig(
      root,
      '[classifier]\nbackend = "ollama"\nmodel = "qwen3.8:27b"\n',
    )

    const result = resolveClassifier(root, {})

    expect(result).toEqual({
      kind: 'configured',
      backend: 'ollama',
      model: 'qwen3.8:27b',
      source: 'file',
    })
  })

  it('should ignore an unreadable config file rather than throwing', () => {
    writeConfig(root, 'not valid toml [[[')

    expect(resolveClassifier(root, {})).toEqual({
      kind: 'off',
      source: 'default',
    })
  })
})

describe('writeClassifierConfig', () => {
  it('should round-trip a written setting back through resolveClassifier', () => {
    writeClassifierConfig(root, 'ollama', 'qwen3.8:27b')

    const result = resolveClassifier(root, {})

    expect(result).toEqual({
      kind: 'configured',
      backend: 'ollama',
      model: 'qwen3.8:27b',
      source: 'file',
    })
  })

  it('should create canon/config when the project carries no config folder', () => {
    writeClassifierConfig(root, 'ollama', 'qwen3.8:27b')

    const written = readFileSync(join(root, CLASSIFIER_CONFIG_REL), 'utf8')

    expect(written).toContain('backend = "ollama"')
    expect(written).toContain('model = "qwen3.8:27b"')
  })

  it('should overwrite an existing setting rather than merging into it', () => {
    writeClassifierConfig(root, 'ollama', 'first-model')
    writeClassifierConfig(root, 'ollama', 'second-model')

    const written = readFileSync(join(root, CLASSIFIER_CONFIG_REL), 'utf8')

    expect(written).toContain('second-model')
    expect(written).not.toContain('first-model')
  })
})
