import {
  type CanonicalDocType,
  extractDiffChunks,
  extractSweepSections,
  type ExtractRefusal,
} from '@/context/classify/extract'
import {
  chat as ollamaChat,
  type ChatOutcome,
  DEFAULT_OLLAMA_BASE_URL,
  probeOllama,
} from '@/context/classify/ollama'
import {
  diffPatternVerdict,
  type DiffVerdict,
  type PatternVerdict,
  sweepPatternVerdict,
  type SweepVerdict,
} from '@/context/classify/patterns'
import {
  DIFF_SYSTEM_PROMPT,
  diffUserMessage,
  SWEEP_SYSTEM_PROMPT,
  sweepUserMessage,
} from '@/context/classify/prompts'
import {
  type ClassifierBackend,
  type ClassifierFlags,
  type ClassifierResolution,
  resolveClassifier,
  type SettingSource,
} from '@/context/classify/settings'

const DIFF_VERDICTS: readonly DiffVerdict[] = [
  'KEEP',
  'REPLACE',
  'HISTORY',
  'MOVE',
]
const SWEEP_VERDICTS: readonly SweepVerdict[] = ['KEEP', 'REWRITE', 'MOVE']

function isDiffVerdict(value: string): value is DiffVerdict {
  return (DIFF_VERDICTS as readonly string[]).includes(value)
}

function isSweepVerdict(value: string): value is SweepVerdict {
  return (SWEEP_VERDICTS as readonly string[]).includes(value)
}

/**
 * A pattern verdict never carries a quote on KEEP, since nothing decided
 * against the text. The finding's `regex` field is a `LayerVerdict` rather
 * than a `PatternVerdict`, so it prints the same as a model layer verdict
 * without every reader having to branch on an absent field.
 */
function withQuote<V extends string>(
  verdict: PatternVerdict<V>,
): LayerVerdict<V> {
  return {
    verdict: verdict.verdict,
    quote: verdict.quote ?? '',
    reason: verdict.reason,
  }
}

export interface LayerVerdict<V extends string> {
  readonly verdict: V
  readonly quote: string
  readonly reason: string
}

/**
 * Why the model layer did not decide a run, named alongside `'ran'` so a
 * caller reading the record never has to infer the reason from an absent
 * field. `'off'` and `'skipped-no-model'` come from settings resolution
 * alone; `'skipped-unreachable'` is the one state a probe call decides.
 */
export type ModelLayerState =
  | 'off'
  | 'ran'
  | 'skipped-no-model'
  | 'skipped-unreachable'

export interface DiffFinding {
  readonly file: string
  readonly docType: CanonicalDocType
  readonly regex: LayerVerdict<DiffVerdict>
  readonly model?: LayerVerdict<DiffVerdict>
  /** Set when the model ran but its reply carried no verdict this could read. */
  readonly modelUnparsed?: boolean
  readonly verdict: DiffVerdict
  readonly decidedBy: 'regex' | 'model'
}

export interface SweepFinding {
  readonly file: string
  readonly docType: CanonicalDocType
  readonly heading: string
  readonly regex: LayerVerdict<SweepVerdict>
  readonly model?: LayerVerdict<SweepVerdict>
  readonly modelUnparsed?: boolean
  readonly verdict: SweepVerdict
  readonly decidedBy: 'regex' | 'model'
}

interface ClassifyRecordBase {
  readonly backend: ClassifierBackend | undefined
  readonly model: string | undefined
  readonly modelLayer: ModelLayerState
  readonly settingsSource: SettingSource
}

export interface DiffRecord extends ClassifyRecordBase {
  readonly mode: 'diff'
  readonly findings: readonly DiffFinding[]
}

export interface SweepRecord extends ClassifyRecordBase {
  readonly mode: 'sweep'
  readonly findings: readonly SweepFinding[]
}

export type ClassifyRefusal = ExtractRefusal

export type ClassifyOutcome<Record> =
  | { readonly kind: 'ok'; readonly record: Record }
  | {
      readonly kind: 'refused'
      readonly reason: ClassifyRefusal
      readonly message: string
    }

/**
 * The network boundary, injected so a test drives the merge logic below
 * without a live Ollama. `src/version/skew.ts` takes the same shape for the
 * npm registry lookup it wraps.
 */
export interface ModelClient {
  readonly probe: (baseUrl: string, timeoutMs?: number) => Promise<boolean>
  readonly chat: (opts: {
    readonly baseUrl: string
    readonly model: string
    readonly system: string
    readonly user: string
    readonly timeoutMs?: number
  }) => Promise<ChatOutcome>
}

const DEFAULT_CLIENT: ModelClient = { probe: probeOllama, chat: ollamaChat }

export interface ClassifyOptions {
  readonly flags?: ClassifierFlags
  readonly docTypes?: readonly CanonicalDocType[]
  readonly baseUrl?: string
  readonly client?: ModelClient
}

interface ModelLayerPlan {
  readonly modelLayer: ModelLayerState
  readonly backend?: ClassifierBackend
  readonly model?: string
}

/**
 * Decides whether the model layer runs, probing reachability before any real
 * call. A configured-but-unreachable backend is a plan the caller reports and
 * falls back from, never a refusal: the groundwork decision reads "warn and
 * continue," and a refused run here would fail `context-fold` for a reason that
 * has nothing to do with the branch it is checking.
 */
async function planModelLayer(
  resolution: ClassifierResolution,
  client: ModelClient,
  baseUrl: string,
): Promise<ModelLayerPlan> {
  if (resolution.kind === 'off') return { modelLayer: 'off' }
  if (resolution.kind === 'no-model') {
    return { modelLayer: 'skipped-no-model', backend: resolution.backend }
  }

  const reachable = await client.probe(baseUrl)
  if (!reachable) {
    return {
      modelLayer: 'skipped-unreachable',
      backend: resolution.backend,
      model: resolution.model,
    }
  }

  return {
    modelLayer: 'ran',
    backend: resolution.backend,
    model: resolution.model,
  }
}

/**
 * One chunk or section, one model call, matching the measured constraint that
 * batching multiple items into one prompt returned KEEP for everything. The
 * caller (`classifyDiff`/`classifySweep`) awaits this once per item rather
 * than issuing every call in parallel, since the items already share one
 * backend and the groundwork measurements are all serial per-call numbers.
 */
async function modelVerdictFor<V extends string>(opts: {
  readonly plan: ModelLayerPlan
  readonly client: ModelClient
  readonly baseUrl: string
  readonly system: string
  readonly user: string
  readonly isVerdict: (value: string) => value is V
}): Promise<{
  readonly verdict?: LayerVerdict<V>
  readonly unparsed: boolean
}> {
  if (opts.plan.modelLayer !== 'ran' || !opts.plan.model) {
    return { unparsed: false }
  }

  const outcome = await opts.client.chat({
    baseUrl: opts.baseUrl,
    model: opts.plan.model,
    system: opts.system,
    user: opts.user,
  })

  if (outcome.kind !== 'ok' || !opts.isVerdict(outcome.parsed.verdict)) {
    return { unparsed: true }
  }

  return {
    verdict: {
      verdict: outcome.parsed.verdict,
      quote: outcome.parsed.quote,
      reason: outcome.parsed.reason,
    },
    unparsed: false,
  }
}

/**
 * Runs diff mode over one git range: the regex layer over every extracted
 * chunk, and the model layer over the same chunks when configured and
 * reachable.
 *
 * A finding's `verdict` takes the model's reading when the model ran and
 * parsed, and the regex reading otherwise, since the groundwork measurements
 * show the model catching what the regex layer structurally cannot
 * (REPLACE, and MOVE outside a wireframe). Both readings stay on the finding
 * regardless of which one decided, so a caller can see where they disagreed.
 */
export async function classifyDiff(
  root: string,
  ref: string | undefined,
  opts: ClassifyOptions = {},
): Promise<ClassifyOutcome<DiffRecord>> {
  const extraction = await extractDiffChunks(root, ref, opts.docTypes)
  if (extraction.kind === 'refused') return extraction

  const resolution = resolveClassifier(root, opts.flags ?? {})
  const client = opts.client ?? DEFAULT_CLIENT
  const baseUrl = opts.baseUrl ?? DEFAULT_OLLAMA_BASE_URL
  const plan = await planModelLayer(resolution, client, baseUrl)

  const findings: DiffFinding[] = []
  for (const chunk of extraction.chunks) {
    const regex = withQuote(diffPatternVerdict(chunk.file, chunk.added))
    const model = await modelVerdictFor({
      plan,
      client,
      baseUrl,
      system: DIFF_SYSTEM_PROMPT,
      user: diffUserMessage(chunk),
      isVerdict: isDiffVerdict,
    })

    findings.push({
      file: chunk.file,
      docType: chunk.docType,
      regex,
      model: model.verdict,
      modelUnparsed: model.unparsed || undefined,
      verdict: model.verdict?.verdict ?? regex.verdict,
      decidedBy: model.verdict ? 'model' : 'regex',
    })
  }

  return {
    kind: 'ok',
    record: {
      mode: 'diff',
      backend: plan.backend,
      model: plan.model,
      modelLayer: plan.modelLayer,
      settingsSource: resolution.source,
      findings,
    },
  }
}

/** Runs sweep mode over every extracted section, mirroring `classifyDiff`. */
export async function classifySweep(
  root: string,
  opts: ClassifyOptions = {},
): Promise<ClassifyOutcome<SweepRecord>> {
  const extraction = await extractSweepSections(root, opts.docTypes)
  if (extraction.kind === 'refused') return extraction

  const resolution = resolveClassifier(root, opts.flags ?? {})
  const client = opts.client ?? DEFAULT_CLIENT
  const baseUrl = opts.baseUrl ?? DEFAULT_OLLAMA_BASE_URL
  const plan = await planModelLayer(resolution, client, baseUrl)

  const findings: SweepFinding[] = []
  for (const section of extraction.sections) {
    const regex = withQuote(sweepPatternVerdict(section.file, section.body))
    const model = await modelVerdictFor({
      plan,
      client,
      baseUrl,
      system: SWEEP_SYSTEM_PROMPT,
      user: sweepUserMessage(section),
      isVerdict: isSweepVerdict,
    })

    findings.push({
      file: section.file,
      docType: section.docType,
      heading: section.heading,
      regex,
      model: model.verdict,
      modelUnparsed: model.unparsed || undefined,
      verdict: model.verdict?.verdict ?? regex.verdict,
      decidedBy: model.verdict ? 'model' : 'regex',
    })
  }

  return {
    kind: 'ok',
    record: {
      mode: 'sweep',
      backend: plan.backend,
      model: plan.model,
      modelLayer: plan.modelLayer,
      settingsSource: resolution.source,
      findings,
    },
  }
}
