import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Ollama is the only backend. The groundwork decision explicitly deferred a
 * Haiku or Claude API backend, so this union has one member rather than
 * carrying an unused second case a switch would have to handle.
 */
export type ClassifierBackend = 'ollama'

/** Where `set` writes and `classify`/`classifier show` read the project setting. */
export const CLASSIFIER_CONFIG_REL = join('canon', 'config', 'classifier.toml')

export type SettingSource = 'flag' | 'env' | 'file' | 'default'

export interface ClassifierFlags {
  readonly backend?: string
  readonly model?: string
}

interface FileSettings {
  readonly backend?: string
  readonly model?: string
}

function readFileSettings(root: string): FileSettings {
  const path = join(root, CLASSIFIER_CONFIG_REL)
  if (!existsSync(path)) return {}

  let parsed: Record<string, unknown>
  try {
    parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >
  } catch {
    return {}
  }

  const table = parsed.classifier
  if (typeof table !== 'object' || table === null) return {}
  const { backend, model } = table as Record<string, unknown>

  return {
    backend: typeof backend === 'string' ? backend : undefined,
    model: typeof model === 'string' ? model : undefined,
  }
}

function isBackend(value: string): value is ClassifierBackend {
  return value === 'ollama'
}

/**
 * Resolves the backend through the stated precedence: flag, then the
 * `CANON_CLASSIFIER_BACKEND` environment variable, then the project config
 * file, then off. `off` is a value in its own right rather than an absence,
 * since a project's config file setting `backend = "off"` states the same
 * fact the missing-file default does, and the source line should say which
 * one decided it.
 *
 * An unrecognized value at any tier is read the same as an absent one, and
 * falls through to the next tier rather than refusing. That keeps a typo'd
 * environment variable from silently making the whole precedence chain
 * unreachable underneath it.
 */
export function resolveBackend(
  root: string,
  flags: ClassifierFlags,
): {
  readonly value: ClassifierBackend | 'off'
  readonly source: SettingSource
} {
  if (flags.backend !== undefined) {
    if (flags.backend === 'off') return { value: 'off', source: 'flag' }
    if (isBackend(flags.backend))
      return { value: flags.backend, source: 'flag' }
  }

  const envBackend = process.env.CANON_CLASSIFIER_BACKEND
  if (envBackend !== undefined) {
    if (envBackend === 'off') return { value: 'off', source: 'env' }
    if (isBackend(envBackend)) return { value: envBackend, source: 'env' }
  }

  const fileBackend = readFileSettings(root).backend
  if (fileBackend !== undefined) {
    if (fileBackend === 'off') return { value: 'off', source: 'file' }
    if (isBackend(fileBackend)) return { value: fileBackend, source: 'file' }
  }

  return { value: 'off', source: 'default' }
}

/**
 * Resolves the model name through the same precedence as the backend, kept as
 * a separate function since a caller can name a backend without a model (the
 * `no-model` state `resolveClassifier` reports) or a model without a backend
 * (which resolves nothing, since there is nothing to run it against).
 */
export function resolveModel(
  root: string,
  flags: ClassifierFlags,
): { readonly value: string; readonly source: SettingSource } | undefined {
  if (flags.model !== undefined && flags.model !== '') {
    return { value: flags.model, source: 'flag' }
  }

  const envModel = process.env.CANON_CLASSIFIER_MODEL
  if (envModel !== undefined && envModel !== '') {
    return { value: envModel, source: 'env' }
  }

  const fileModel = readFileSettings(root).model
  if (fileModel !== undefined && fileModel !== '') {
    return { value: fileModel, source: 'file' }
  }

  return undefined
}

export type ClassifierResolution =
  | { readonly kind: 'off'; readonly source: SettingSource }
  | {
      readonly kind: 'no-model'
      readonly backend: ClassifierBackend
      readonly source: SettingSource
    }
  | {
      readonly kind: 'configured'
      readonly backend: ClassifierBackend
      readonly model: string
      /** The source that decided the backend, which decided the model layer runs at all. */
      readonly source: SettingSource
    }

/**
 * Combines the two precedence reads into the one answer `classify` and
 * `classifier show` both need: whether the model layer runs, and why.
 *
 * No default model name exists on purpose. The groundwork decision reads: a
 * model name on one machine means nothing on another, so `show` reports the
 * gap and `classify` warns and falls back to the regex layer rather than
 * guessing a name that may not be pulled.
 */
export function resolveClassifier(
  root: string,
  flags: ClassifierFlags = {},
): ClassifierResolution {
  const backend = resolveBackend(root, flags)
  if (backend.value === 'off') return { kind: 'off', source: backend.source }

  const model = resolveModel(root, flags)
  if (model === undefined) {
    return { kind: 'no-model', backend: backend.value, source: backend.source }
  }

  return {
    kind: 'configured',
    backend: backend.value,
    model: model.value,
    source: backend.source,
  }
}

/**
 * Writes the project's classifier setting, creating `canon/config/` when a
 * project does not carry it yet. `pr-labels.toml` is the one precedent for a
 * `canon/config/` file and it is hand-authored and read-only to the CLI, so
 * this is the first write path into that folder and the first TOML file this
 * CLI generates rather than parses.
 *
 * Preserves an existing file's mode per the operator-file convention, so a
 * destination an operator locked down keeps its permissions across a rewrite.
 */
export function writeClassifierConfig(
  root: string,
  backend: ClassifierBackend | 'off',
  model?: string,
): void {
  const path = join(root, CLASSIFIER_CONFIG_REL)
  const mode = existsSync(path) ? statSync(path).mode : undefined

  const modelLine = model ? `model = "${model}"\n` : ''
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `[classifier]\nbackend = "${backend}"\n${modelLine}`)

  if (mode !== undefined) chmodSync(path, mode)
}
