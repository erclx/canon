import { renderRecord } from '../lib/record-markdown'

/**
 * Read at build from `examples/`, which the `record-examples` gate stage holds
 * to each record's standard, so the page and the examples set share one source.
 */
const examples = import.meta.glob<string>('../../../examples/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** An example's markdown by its path under `examples/`, refusing one that is gone. */
export function exampleSource(file: string): string {
  const source = examples[`../../../examples/${file}`]
  if (source === undefined) throw new Error(`No example at examples/${file}`)
  return source
}

/**
 * The twelve record sheets the records stack pages through, in the order a change
 * writes them, each rendered from one filled-in example.
 */
export interface RecordSheet {
  readonly name: string
  /** Who writes it and what it holds, the caption under the stack. */
  readonly by: string
  /** Where a project keeps the record, or the pull request address a browser shows. */
  readonly path: string
  /** The example's path under `examples/`. */
  readonly source: string
}

export const records: readonly RecordSheet[] = [
  {
    name: 'Intake',
    by: 'Written by the planner. Sorts raw findings into items, each waiting on your answer.',
    path: '.canon/intake/03-tide-feedback/01-alerts.md',
    source: 'research/intake/03-tide-feedback/01-alerts.md',
  },
  {
    name: 'Groundwork',
    by: 'Written by the planner. Measures a question before anyone plans it, then decides.',
    path: '.canon/groundwork/04-surge-alerts/06-decision.md',
    source: 'research/groundwork/04-surge-alerts/06-decision.md',
  },
  {
    name: 'Plan',
    by: 'Written by the planner. Names the files, risks, and open questions before a worker builds.',
    path: '.canon/plans/feature-surge-alerts.md',
    source: 'planning/feature-surge-alerts.md',
  },
  {
    name: 'Task',
    by: 'Written by the orchestrator. Holds one row and the outcomes it ships.',
    path: '.canon/tasks/v03.2-surge-alerts.md',
    source: 'planning/v03.2-surge-alerts.md',
  },
  {
    name: 'Board',
    by: 'Written by the orchestrator. Orders the rows and says what each one waits on.',
    path: '.canon/tasks/priority.md',
    source: 'planning/priority.md',
  },
  {
    name: 'Pull request',
    by: 'Written by the worker. Carries the change, its reasons, and how it was tested.',
    path: 'github.com/example-org/tidewell/pull/212',
    source: 'shipping/pull-request-body.md',
  },
  {
    name: 'Code review',
    by: 'Written by the code reviewer. Stays open until every finding is fixed.',
    path: 'github.com/example-org/tidewell/pull/212',
    source: 'shipping/code-review.md',
  },
  {
    name: 'UI review',
    by: 'Written by the UI reviewer. Gives one verdict per checklist box, driven in the running app.',
    path: 'github.com/example-org/tidewell/pull/212',
    source: 'shipping/ui-review.md',
  },
  {
    name: 'Evidence',
    by: 'Written by the worker. Shows what the change looks like, before and after, in both themes.',
    path: 'github.com/example-org/tidewell/pull/212',
    source: 'shipping/evidence-comment.md',
  },
  {
    name: 'Drive log',
    by: 'Written by the planner. Records what a drive found and what you decided.',
    path: '.canon/intake/05-tide-drive/evidence/drive-log.md',
    source: 'research/drive/05-tide-drive/evidence/drive-log.md',
  },
  {
    name: 'Context',
    by: 'Written by the worker. Keeps what a change taught for the next session.',
    path: 'canon/context/alerts.md', // Tidewell's entry <!-- audit-ignore-citations: canon/context/alerts.md -->
    source: 'project/context-alerts.md',
  },
  {
    name: 'Handoff',
    by: 'Written by any session. Leaves the reasoning a compaction would erase, for the next session to pick up.',
    path: '.canon/compact/surge-alert-expiry.md',
    source: 'sessions/handoff-note.md',
  },
]

/** A sheet as a page in the records fan: where it lives, and its rendered view. */
export interface RecordPage {
  readonly path: string
  readonly body: string
}

export function renderedPage(sheet: RecordSheet): RecordPage {
  return { path: sheet.path, body: renderRecord(exampleSource(sheet.source)) }
}
