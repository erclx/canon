import intake from './records/01-intake.html?raw'
import groundwork from './records/02-groundwork.html?raw'
import plan from './records/03-plan.html?raw'
import task from './records/04-task.html?raw'
import board from './records/05-board.html?raw'
import pullRequest from './records/06-pull-request.html?raw'
import codeReview from './records/07-code-review.html?raw'
import uiReview from './records/08-ui-review.html?raw'
import evidence from './records/09-evidence.html?raw'
import driveLog from './records/10-drive-log.html?raw'
import context from './records/11-context.html?raw'
import handoff from './records/12-handoff.html?raw'

/**
 * The twelve record sheets the records stack pages through, in the order a change
 * writes them. Each is page fiction in the exact shape canon writes that record,
 * with no local path, version, or account detail, and its body is its own file beside this module.
 */
export interface RecordSheet {
  readonly name: string
  /** `ed` for a file in an editor, `br` for a page in a browser. */
  readonly kind: 'ed' | 'br'
  /** Who writes it and what it holds, the caption under the stack. */
  readonly by: string
  readonly html: string
}

export const records: readonly RecordSheet[] = [
  {
    name: 'Intake',
    kind: 'ed',
    by: 'Written by the planner. Sorts raw findings into items, each waiting on your answer.',
    html: intake,
  },
  {
    name: 'Groundwork',
    kind: 'ed',
    by: 'Written by the planner. Measures a question before anyone plans it, then decides.',
    html: groundwork,
  },
  {
    name: 'Plan',
    kind: 'ed',
    by: 'Written by the planner. Names the files, risks, and open questions before a worker builds.',
    html: plan,
  },
  {
    name: 'Task',
    kind: 'ed',
    by: 'Written by the orchestrator. Holds one row and the outcomes it ships.',
    html: task,
  },
  {
    name: 'Board',
    kind: 'ed',
    by: 'Written by the orchestrator. Orders the rows and says what each one waits on.',
    html: board,
  },
  {
    name: 'Pull request',
    kind: 'br',
    by: 'Written by the worker. Carries the change, its reasons, and how it was tested.',
    html: pullRequest,
  },
  {
    name: 'Code review',
    kind: 'br',
    by: 'Written by the code reviewer. Stays open until every finding is fixed.',
    html: codeReview,
  },
  {
    name: 'UI review',
    kind: 'br',
    by: 'Written by the UI reviewer. Gives one verdict per checklist box, driven in the running app.',
    html: uiReview,
  },
  {
    name: 'Evidence',
    kind: 'br',
    by: 'Written by the worker. Shows what the change looks like, before and after, in both themes.',
    html: evidence,
  },
  {
    name: 'Drive log',
    kind: 'ed',
    by: 'Written by the planner. Records what a drive found and what you decided.',
    html: driveLog,
  },
  {
    name: 'Context',
    kind: 'ed',
    by: 'Written by the worker. Keeps what a change taught for the next session.',
    html: context,
  },
  {
    name: 'Handoff',
    kind: 'ed',
    by: 'Written by any session. Leaves the reasoning a compaction would erase, for the next session to pick up.',
    html: handoff,
  },
]

/** A sheet as a page in the records fan: where it lives, and its rendered view. */
export interface RecordPage {
  readonly path: string
  readonly body: string
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** The markup inside the element opening at `start`, closed at its own depth. */
function inner(html: string, start: number): string {
  const open = html.indexOf('>', start) + 1
  const tag = /<(\/?)div\b/g
  tag.lastIndex = open
  let depth = 1
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    depth += match[1] ? -1 : 1
    if (depth === 0) return html.slice(open, match.index)
  }
  return ''
}

/**
 * Reads a sheet's first file as a page: its path from the editor's crumb, or
 * the browser's address, and its rendered view. A checkbox becomes a mark
 * naming its state, since a page in the fan is read rather than edited.
 */
export function renderedPage(html: string): RecordPage {
  const crumb = /<div class="crumb">([\s\S]*?)<\/div>/.exec(html)
  const url = /<div class="url">([\s\S]*?)<\/div>/.exec(html)
  const path = crumb
    ? text(crumb[1] ?? '').replace(/\s*›\s*/g, '/')
    : text(url?.[1] ?? '')
  const at = html.indexOf('<div class="ren">')
  const body = (at < 0 ? '' : inner(html, at))
    .trim()
    .replace(
      /<input type="checkbox" class="cbx" data-ck="\d+"( checked)? \/>/g,
      (_, checked: string | undefined) =>
        checked
          ? '<span class="box x" role="img" aria-label="done"></span>'
          : '<span class="box" role="img" aria-label="not done"></span>',
    )
  return { path, body }
}
