import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { TEACH_STYLESHEET_COMPONENTS } from '@/design/components'
import { buildDesignCss } from '@/design/css'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import { TEACH_FONT_FACES } from '@/teach/fonts'
import {
  listWorkspaces,
  readWorkspace,
  TEACH_ASSETS,
  TEACH_LESSONS,
  TEACH_MISSION,
  TEACH_REFERENCE,
  TEACH_STYLESHEET,
  teachDir,
  type TeachRefused,
  type WorkspaceDetail,
  type WorkspaceSummary,
  writeStylesheet,
} from '@/teach/workspace'

const FAVICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='10 10 80 80'%3E%3Cpath d='M34,20 L15,28 L15,72 L34,80 Z M66,20 L85,28 L85,72 L66,80 Z' fill='rgb(224,114,75)' /%3E%3Crect x='44' y='15' width='12' height='70' rx='2' fill='rgb(224,114,75)' /%3E%3C/svg%3E" />`

const CARET =
  '<svg class="caret" width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 4l3 3 3-3"/></svg>'

const THEME_BUTTON =
  '<button class="theme" type="button" aria-label="Switch between light and dark"><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>'

const THEME_SCRIPT =
  '<script>(function(){var r=document.documentElement;try{var s=localStorage.getItem("course-theme");if(s)r.dataset.theme=s;}catch(e){}document.addEventListener("click",function(e){var b=e.target.closest(".theme");if(!b)return;var d=r.dataset.theme==="dark"||(!r.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"light":"dark";try{localStorage.setItem("course-theme",r.dataset.theme);}catch(e){}});})();</script>'

const CLOSE_OUTSIDE_CLICK_SCRIPT = `<script>
(function () {
  function close(except) {
    document.querySelectorAll("details.jump[open]").forEach(function (d) {
      if (d !== except) d.open = false;
    });
  }
  document.addEventListener("click", function (e) {
    var inside = e.target.closest("details.jump");
    close(inside);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = document.querySelector("details.jump[open]");
    if (!open) return;
    open.open = false;
    var s = open.querySelector("summary");
    if (s) s.focus();
  });
})();
</script>`

/**
 * The stepper, as CSS over the radio inputs a lesson's quiz is written from.
 *
 * A quiz showing every question at once lets a later stem answer an earlier
 * question, which is a leak no wording of the questions closes. Gating on
 * `:has()` rather than on a script keeps the page working with nothing to bind,
 * and the radio input is what records an answer with no handler in the loop.
 *
 * The general sibling combinator is what keeps the gate from depending on the
 * markup contract holding. It selects the same questions as `+` for a quiz
 * written correctly, and it goes on gating when anything sits between two of
 * them, where `+` matches nothing and shows every later question at once. That
 * is the leak this block exists to close, arriving through a shape nothing
 * rejects.
 *
 * The two hide rules select the unanswered state alone, so a workspace's own
 * `display` for a question survives being stepped through. Feedback has to be
 * shown by a rule naming a value, because every stylesheet grown under the
 * retired script carries `.fb { display: none }` and nothing adds the class
 * that revealed it. Appearance stays the workspace's: this block hides and
 * shows and sets nothing else.
 *
 * `@supports` wraps every rule, so an engine without `:has()` renders every
 * question rather than a stepper showing nothing. Feedback there follows the
 * workspace: a fresh stylesheet shows it and one grown under the retired script
 * keeps it hidden. Showing it unconditionally outside the wrapper was measured
 * and reverted, since that rule outranks `.fb { display: none }` on every
 * engine and would reveal the feedback in the button-shape lessons the script
 * still drives.
 */
const QUIZ_CSS = `@supports selector(:has(*)) {
  .quiz .q:not(:has(input[type="radio"]:checked)) ~ .q { display: none; }
  .quiz .q:not(:has(input[type="radio"]:checked)) .fb { display: none; }
  .quiz .q:has(input[type="radio"]:checked) > .fb { display: block; }
}`

/**
 * The button shape a lesson written before the stepper carries. It is a
 * detector rather than a mode: a lesson has one shape or the other, and which
 * one it has decides both the style and the scripts region.
 */
const LEGACY_OPTION = '<button class="opt"'

/**
 * What reveals feedback in a lesson written against `LEGACY_OPTION`. The radio
 * shape needs none of it, so a lesson carrying no button option gets no script,
 * and removing this outright would leave the lessons already written showing no
 * feedback at all.
 */
const QUIZ_SCRIPT =
  '<script>document.querySelectorAll(".q").forEach(function(q){var f=q.querySelector(".fb");q.querySelectorAll(".opt").forEach(function(b){b.addEventListener("click",function(){if(f.classList.contains("show"))return;q.querySelectorAll(".opt").forEach(function(o){o.dataset.state=o.dataset.a==="1"?"right":(o===b?"chosen":"wrong");});f.classList.add("show");});});});</script>'

const GLOSSARY_FILTER_SCRIPT = `<script>
(function () {
  var input = document.getElementById("gfilter");
  var list = document.getElementById("gloss");
  if (!input || !list) return;
  function updateGroups() {
    list.querySelectorAll(".gloss-group").forEach(function (heading) {
      var el = heading.nextElementSibling;
      var any = false;
      while (el && !el.classList.contains("gloss-group")) {
        if (el.style.display !== "none") any = true;
        el = el.nextElementSibling;
      }
      heading.style.display = any ? "" : "none";
    });
  }
  input.addEventListener("input", function () {
    var q = input.value.toLowerCase();
    var n = 0;
    list.querySelectorAll(".gterm").forEach(function (entry) {
      var match = entry.textContent.toLowerCase().includes(q);
      entry.style.display = match ? "" : "none";
      if (match) n++;
    });
    list.classList.toggle("none", n === 0);
    updateGroups();
  });
  var clear = list.querySelector(".clear");
  if (clear) {
    clear.addEventListener("click", function () {
      input.value = "";
      input.dispatchEvent(new Event("input"));
      input.focus();
    });
  }
})();
</script>`

/**
 * The outline rail's focus-line ramp, as the JavaScript source `OUTLINE_SCRIPT`
 * embeds verbatim, so there is one copy of the formula rather than a TS
 * reimplementation that could drift from what a browser actually runs.
 *
 * It ramps the line from near the top at scroll 0 to the viewport's bottom
 * edge at max scroll, so the last heading is reachable regardless of how
 * little content trails it. The prior formula ended the ramp 120px short of
 * the edge, which left a heading followed by under 120px of trailing content
 * permanently unmarked, since its top never fell below the line even at max
 * scroll.
 */
const FOCUS_LINE_BODY = `if (max <= 0) return innerHeight;
    var progress = Math.min(1, Math.max(0, scrollY / max));
    return 120 + progress * Math.max(0, innerHeight - 120);`

/**
 * Compiles and runs `FOCUS_LINE_BODY`, so a test exercises the exact source
 * the browser runs rather than a parallel copy of it.
 */
export function focusLine(
  scrollY: number,
  max: number,
  innerHeight: number,
): number {
  const compiled = new Function(
    'scrollY',
    'max',
    'innerHeight',
    FOCUS_LINE_BODY,
  ) as (scrollY: number, max: number, innerHeight: number) => number

  return compiled(scrollY, max, innerHeight)
}

const OUTLINE_SCRIPT = `<script>
(function () {
  var hs = Array.prototype.slice.call(document.querySelectorAll("main h2"));
  if (hs.length < 3) return;
  var nav = document.createElement("nav");
  nav.className = "outline";
  nav.innerHTML = '<button class="to-top" type="button">On this page</button>';
  nav.querySelector(".to-top").addEventListener("click", function () {
    scrollTo({ top: 0, behavior: "smooth" });
  });
  hs.forEach(function (h, i) {
    if (!h.id) h.id = "s" + i;
    var a = document.createElement("a");
    a.href = "#" + h.id;
    a.textContent = h.textContent.trim();
    nav.appendChild(a);
  });
  document.body.appendChild(nav);
  var links = Array.prototype.slice.call(nav.querySelectorAll("a"));

  function mark(i) {
    links.forEach(function (l, j) { l.classList.toggle("on", j === i); });
  }

  function focusLine() {
    var max = document.documentElement.scrollHeight - innerHeight;
    ${FOCUS_LINE_BODY}
  }

  function sync() {
    var best = 0;
    var line = focusLine();
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].getBoundingClientRect().top <= line) best = i;
    }
    mark(best);
  }

  links.forEach(function (l, i) {
    l.addEventListener("click", function () { mark(i); });
  });

  addEventListener("scroll", sync, { passive: true });
  addEventListener("resize", sync);
  sync();
})();
</script>`

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, '')
}

/**
 * Sentence case off a kebab slug: only the first word capitalized, matching
 * `titleFor` in `@/teach/workspace`, which is not exported for reuse here.
 */
function titleCase(slug: string): string {
  const words = slug.split('-')
  return [
    words[0].charAt(0).toUpperCase() + words[0].slice(1),
    ...words.slice(1),
  ].join(' ')
}

interface JumpEntry {
  readonly ordinal: string
  readonly label: string
  readonly href: string | undefined
  readonly done: boolean
  readonly at: boolean
}

function renderJumpList(entries: readonly JumpEntry[]): string {
  return entries
    .map((entry) => {
      const dot = `<span class="dot${entry.done ? ' done' : ''}"></span>`
      const body = `<span class="n">${entry.ordinal}</span><span>${escapeHtml(entry.label)}</span>${dot}`

      if (entry.href === undefined) {
        return `<li class="soon"><a href="#" aria-disabled="true" tabindex="-1">${body}</a></li>`
      }

      return `<li${entry.at ? ' class="at"' : ''}><a href="${entry.href}">${body}</a></li>`
    })
    .join('')
}

function renderJump(ariaLabel: string, entries: readonly JumpEntry[]): string {
  return `<details class="jump" name="mast"><summary aria-label="${escapeHtml(ariaLabel)}">${CARET}</summary><ul class="jump-list">${renderJumpList(entries)}</ul></details>`
}

interface CrumbSegment {
  readonly label: string
  readonly href?: string
  readonly jump?: {
    readonly ariaLabel: string
    readonly entries: readonly JumpEntry[]
  }
}

/**
 * Every ancestor renders as a link, and the current page renders as plain
 * text, whether or not it still carries a jump widget of its own.
 */
function renderBreadcrumb(segments: readonly CrumbSegment[]): string {
  return segments
    .map((segment, index) => {
      const text =
        segment.href !== undefined
          ? `<a class="crumb" href="${segment.href}">${escapeHtml(segment.label)}</a>`
          : `<span class="crumb crumb-here">${escapeHtml(segment.label)}</span>`

      const jump = segment.jump
        ? renderJump(segment.jump.ariaLabel, segment.jump.entries)
        : ''

      const sep =
        index < segments.length - 1
          ? '<span class="crumb-sep" aria-hidden="true">/</span>'
          : ''

      return `<span class="crumb-item">${text}${jump}</span>${sep}`
    })
    .join('')
}

type TrackState = 'done' | 'here' | ''

function renderTrack(states: readonly TrackState[]): string {
  const dots = states
    .map((state) => `<i${state ? ` class="${state}"` : ''}></i>`)
    .join('')

  return `<div class="track" role="presentation">${dots}</div>`
}

function renderHeader(
  segments: readonly CrumbSegment[],
  track: readonly TrackState[],
): string {
  return `<header class="bar">
  <div class="mast">
    <span class="mast-left">${renderBreadcrumb(segments)}</span>
    <span class="mast-right">${THEME_BUTTON}</span>
  </div>
  ${renderTrack(track)}
</header>`
}

function renderScripts(
  includeQuiz: boolean,
  includeGlossaryFilter: boolean,
): string {
  const scripts = [THEME_SCRIPT, CLOSE_OUTSIDE_CLICK_SCRIPT, OUTLINE_SCRIPT]
  if (includeGlossaryFilter) scripts.push(GLOSSARY_FILTER_SCRIPT)
  if (includeQuiz) scripts.push(QUIZ_SCRIPT)
  return scripts.join('\n')
}

function pageHead(
  title: string,
  cssHref: string | undefined,
  embeddedCss: string | undefined,
): string {
  const style =
    embeddedCss === undefined
      ? `<link rel="stylesheet" href="${cssHref}">`
      : `<style>\n${embeddedCss}\n</style>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${FAVICON}
${style}
</head>
`
}

/** Whether a workspace has a mission yet. A missing one has nothing to teach. */
function hasMission(workspace: WorkspaceSummary): boolean {
  return !workspace.missing.includes(TEACH_MISSION)
}

function hrefForWorkspace(
  workspace: WorkspaceSummary,
  prefix: string,
): string | undefined {
  return hasMission(workspace)
    ? `${prefix}${workspace.slug}/index.html`
    : undefined
}

function ordinalOf(workspace: WorkspaceSummary): string {
  return Number.isNaN(workspace.ordinal)
    ? '??'
    : String(workspace.ordinal).padStart(2, '0')
}

function workspaceJumpEntries(
  workspaces: readonly WorkspaceSummary[],
  prefix: string,
  currentSlug: string | undefined,
): JumpEntry[] {
  return workspaces.map((workspace) => ({
    ordinal: ordinalOf(workspace),
    label: titleCase(workspace.topic),
    href: hrefForWorkspace(workspace, prefix),
    done: workspace.lessons > 0,
    at: workspace.slug === currentSlug,
  }))
}

interface LessonMeta {
  readonly file: string
  readonly title: string
  readonly lede: string
}

function basenameTitle(file: string): string {
  return titleCase(file.replace(/^\d+-/, '').replace(/\.html$/, ''))
}

/**
 * A lesson's title and lede, read back off its own `<h1>` and `<p
 * class="lede">` rather than tracked anywhere else. Nothing in the workspace
 * records what a lesson covers apart from the lesson itself.
 */
function extractLessonMeta(file: string, html: string): LessonMeta {
  const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)
  const lede = /<p class="lede">([\s\S]*?)<\/p>/.exec(html)

  return {
    file,
    title: h1 ? stripTags(h1[1]).trim() : basenameTitle(file),
    lede: lede ? stripTags(lede[1]).trim() : '',
  }
}

function lessonJumpEntries(
  metas: readonly LessonMeta[],
  workspacePrefix: string,
  currentFile: string | undefined,
): JumpEntry[] {
  return metas.map((meta, index) => ({
    ordinal: String(index + 1).padStart(2, '0'),
    label: meta.title,
    href: `${workspacePrefix}${TEACH_LESSONS}/${meta.file}`,
    done: true,
    at: meta.file === currentFile,
  }))
}

function renderFootNav(metas: readonly LessonMeta[], index: number): string {
  const previous = index > 0 ? metas[index - 1] : undefined
  const next = index < metas.length - 1 ? metas[index + 1] : undefined

  const previousHtml = previous
    ? `<a href="${previous.file}"><span class="lbl">Previous</span><span><span class="arrow">&larr;</span>${escapeHtml(previous.title)}</span></a>`
    : ''

  const nextHtml = next
    ? `<a class="to-next" href="${next.file}"><span class="lbl">Next</span><span>${escapeHtml(next.title)}<span class="arrow" style="padding:0 0 0 .35rem">&rarr;</span></span></a>`
    : '<span class="end">End of the lessons written so far</span>'

  return `<nav class="nav">${previousHtml}${nextHtml}</nav>`
}

async function readTitle(path: string, fallback: string): Promise<string> {
  if (!existsSync(path)) return fallback
  const frontmatter = parseFrontmatter(await readFile(path, 'utf8'))
  return readField(frontmatter, 'title') ?? fallback
}

function renderGlossaryEntry(entry: string): string {
  const match = /^\*\*(.+?)\*\*:?\s*([\s\S]*)$/.exec(entry)
  const term = match ? match[1] : entry
  const definition = match ? match[2] : ''

  return `<div class="gterm"><b>${escapeHtml(term)}</b><span>${escapeHtml(definition)}</span></div>`
}

const FIRST_SEEN_PATTERN = / First seen in (.+)\.$/

/**
 * The lesson or reference page an entry's own "First seen in" sentence
 * names, absent when the entry predates that citation convention.
 */
function firstSeenFile(entry: string): string | undefined {
  return FIRST_SEEN_PATTERN.exec(entry)?.[1]
}

/**
 * `firstSeenFile` names a page free-form, per the `--first-seen` flag it
 * comes from, so it may carry a directory prefix a lesson's own `file` does
 * not. Comparing basenames is what keeps `lessons/0001-x.html` and
 * `0001-x.html` resolving to the same lesson without a suffix match risking
 * a false hit across two differently-prefixed filenames.
 */
function matchingLesson(
  file: string,
  metas: readonly LessonMeta[],
): LessonMeta | undefined {
  const basename = file.split('/').pop()
  return metas.find((meta) => meta.file === basename)
}

interface GlossaryGroup {
  readonly heading: string
  readonly entries: readonly string[]
}

const OTHER_TERMS_HEADING = 'Other terms'

/**
 * Groups already-alphabetical glossary entries by the lesson their own
 * "First seen in" sentence names, in lesson order. An entry naming a
 * reference page instead, or carrying no citation at all, cannot be
 * attributed to a lesson and trails in its own group, keeping the
 * alphabetical order the source entries already carry.
 */
function groupGlossaryEntries(
  entries: readonly string[],
  metas: readonly LessonMeta[],
): readonly GlossaryGroup[] {
  const byLesson = new Map<string, string[]>()
  const other: string[] = []

  for (const entry of entries) {
    const file = firstSeenFile(entry)
    const lesson = file ? matchingLesson(file, metas) : undefined

    if (lesson) {
      const list = byLesson.get(lesson.file) ?? []
      list.push(entry)
      byLesson.set(lesson.file, list)
    } else {
      other.push(entry)
    }
  }

  const groups: GlossaryGroup[] = []
  for (const meta of metas) {
    const list = byLesson.get(meta.file)
    if (list) groups.push({ heading: meta.title, entries: list })
  }
  if (other.length > 0) {
    groups.push({ heading: OTHER_TERMS_HEADING, entries: other })
  }

  return groups
}

function renderGlossaryGroup(group: GlossaryGroup): string {
  const entries = group.entries.map(renderGlossaryEntry).join('')

  return `<h3 class="gloss-group">${escapeHtml(group.heading)}</h3>${entries}`
}

function renderGlossarySection(
  entries: readonly string[],
  metas: readonly LessonMeta[],
): string {
  const rendered = groupGlossaryEntries(entries, metas)
    .map(renderGlossaryGroup)
    .join('')

  return `<h2>Glossary <span class="count">${entries.length}</span></h2>
<input class="filter" type="search" id="gfilter" aria-label="Filter glossary terms" aria-controls="gloss" placeholder="term">
<div class="gloss" id="gloss"><p class="empty">No term matches that. <button type="button" class="clear">Clear the filter</button></p>${rendered}</div>
`
}

/**
 * Every workspace, generated wholesale rather than spliced. Nothing here is
 * authored by hand, so there is no region to preserve.
 */
function renderRootPage(workspaces: readonly WorkspaceSummary[]): string {
  const segments: CrumbSegment[] = [
    {
      label: 'Workspaces',
      jump: {
        ariaLabel: 'Open a workspace',
        entries: workspaceJumpEntries(workspaces, '', undefined),
      },
    },
  ]

  const track = workspaces.map<TrackState>((workspace) =>
    workspace.lessons > 0 ? 'done' : '',
  )

  const rows = workspaces
    .map((workspace) => {
      const href = hrefForWorkspace(workspace, '')
      const state = !hasMission(workspace)
        ? 'Stub'
        : workspace.lessons > 0
          ? 'Live'
          : 'Open'
      const blurb = `${workspace.lessons} lesson(s) &middot; ${workspace.reference} reference page(s) &middot; ${workspace.terms} term(s)`
      const inner = `<span class="num">${ordinalOf(workspace)}</span><b>${escapeHtml(titleCase(workspace.topic))}</b><span class="state${state === 'Live' ? ' done' : ''}">${state}</span><span class="blurb">${blurb}</span>`

      return href === undefined
        ? `<li class="soon"><a href="#" aria-disabled="true" tabindex="-1">${inner}</a></li>`
        : `<li><a href="${href}">${inner}</a></li>`
    })
    .join('')

  return `${pageHead('Learning workspaces', TEACH_STYLESHEET, undefined)}<body>
${renderHeader(segments, track)}
<main class="wide-body">


<h1>Learning workspaces</h1>
<p class="lede">One folder per subject. Each carries its own mission, sources, glossary, and lessons.</p>

<ul class="toc">${rows}</ul>

</main>
${renderScripts(false, false)}
</body>
</html>
`
}

/** Every lesson's title and lede, read once per rewrite of the workspace. */
async function readLessonMetas(
  root: string,
  detail: WorkspaceDetail,
): Promise<LessonMeta[]> {
  return Promise.all(
    detail.lessonFiles.map(async (file) => {
      const text = await readFile(
        join(root, detail.path, TEACH_LESSONS, file),
        'utf8',
      )
      return extractLessonMeta(file, text)
    }),
  )
}

/**
 * A workspace's contents page, generated wholesale from what the folder holds
 * on disk: the mission, the lessons already written, the reference pages, and
 * the glossary. A workspace with no `index.html` yet gets one the same way a
 * workspace that already had one gets its rewrite, since both read the same
 * sources.
 */
async function renderContentsPage(
  root: string,
  workspaces: readonly WorkspaceSummary[],
  detail: WorkspaceDetail,
  metas: readonly LessonMeta[],
): Promise<string> {
  const missionPath = join(root, detail.path, TEACH_MISSION)
  const description = existsSync(missionPath)
    ? readField(
        parseFrontmatter(await readFile(missionPath, 'utf8')),
        'description',
      )
    : undefined

  const title = detail.title ?? titleCase(detail.topic)

  const segments: CrumbSegment[] = [
    {
      label: 'Workspaces',
      href: '../index.html',
      jump: {
        ariaLabel: 'Switch workspace',
        entries: workspaceJumpEntries(workspaces, '../', detail.slug),
      },
    },
    {
      label: titleCase(detail.topic),
      jump: {
        ariaLabel: 'Jump to a lesson',
        entries: lessonJumpEntries(metas, '', undefined),
      },
    },
  ]

  const track = metas.map<TrackState>(() => 'done')

  const lessonRows = metas
    .map(
      (meta, index) =>
        `<li><a href="${TEACH_LESSONS}/${meta.file}"><span class="num">${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(meta.title)}</b><span class="state done">Written</span><span class="blurb">${escapeHtml(meta.lede)}</span></a></li>`,
    )
    .join('')

  const referenceRows = (
    await Promise.all(
      detail.referenceFiles.map(async (file, index) => {
        const title = await readTitle(
          join(root, detail.path, TEACH_REFERENCE, file),
          basenameTitle(file),
        )
        return `<li><a href="${TEACH_REFERENCE}/${file}"><span class="num">R${index + 1}</span><b>${escapeHtml(title)}</b></a></li>`
      }),
    )
  ).join('')

  const successRows = detail.success
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('')

  const sections = [
    description ? `<p class="lede">${escapeHtml(description)}</p>` : '',
    successRows
      ? `<h2>Finished when you can do all of these unaided</h2>\n<ol class="succ">${successRows}</ol>`
      : '',
    lessonRows ? `<h2>Lessons</h2>\n<ul class="toc">${lessonRows}</ul>` : '',
    referenceRows
      ? `<h2>Reference pages</h2>\n<ul class="toc">${referenceRows}</ul>`
      : '',
    renderGlossarySection(detail.glossary, metas),
  ]
    .filter((section) => section !== '')
    .join('\n\n')

  return `${pageHead(`${title}, contents`, `${TEACH_ASSETS}/${TEACH_STYLESHEET}`, undefined)}<body>
${renderHeader(segments, track)}
<main class="wide-body">


<h1>${escapeHtml(title)}</h1>
${sections}

</main>
${renderScripts(false, true)}
</body>
</html>
`
}

const REGIONS = ['style', 'header', 'footnav', 'scripts'] as const
type Region = (typeof REGIONS)[number]

function regionPattern(region: Region): RegExp {
  return new RegExp(
    `(<!-- canon:teach:${region} -->)[\\s\\S]*?(<!-- /canon:teach:${region} -->)`,
  )
}

/**
 * Replaces one marked chrome region, keeping every other byte of the lesson
 * untouched. Returns `undefined` when the marker pair is absent, which is the
 * signal a caller reads as a refusal rather than a rewrite.
 */
function spliceRegion(
  html: string,
  region: Region,
  content: string,
): string | undefined {
  const pattern = regionPattern(region)
  if (!pattern.test(html)) return undefined

  return html.replace(
    pattern,
    (_match, open, close) => `${open}\n${content}\n${close}`,
  )
}

interface LessonRewritten {
  readonly ok: true
  readonly file: string
}

interface LessonRefused {
  readonly ok: false
  readonly file: string
  readonly missing: Region
}

/**
 * Splices the four chrome regions into one lesson file, in a fixed order so a
 * missing marker is always reported against the same region a session can
 * check first. Nothing is written when any region is missing, which is what
 * keeps a partially-spliced file off disk.
 */
/**
 * A lesson embeds the workspace stylesheet, and an `@import` resolves against
 * the lesson's own folder there rather than the assets folder, so it never
 * loaded anything. The base sheet reaches the page through the `<link>`.
 */
function stripImports(css: string): string {
  return css.replace(/^@import[^;]*;[ \t]*\n?/gm, '')
}

async function rewriteLesson(
  root: string,
  detail: WorkspaceDetail,
  index: number,
  metas: readonly LessonMeta[],
  workspaces: readonly WorkspaceSummary[],
  css: string,
): Promise<LessonRewritten | LessonRefused> {
  const file = metas[index].file
  const path = join(root, detail.path, TEACH_LESSONS, file)
  let html = await readFile(path, 'utf8')

  const teachPrefix = '../../'
  const workspacePrefix = '../'

  const header = renderHeader(
    [
      {
        label: 'Workspaces',
        href: `${teachPrefix}index.html`,
        jump: {
          ariaLabel: 'Switch workspace',
          entries: workspaceJumpEntries(workspaces, teachPrefix, detail.slug),
        },
      },
      {
        label: titleCase(detail.topic),
        href: `${workspacePrefix}index.html`,
        jump: {
          ariaLabel: 'Jump to a lesson',
          entries: lessonJumpEntries(metas, workspacePrefix, file),
        },
      },
      { label: `Lesson ${index + 1} of ${metas.length}` },
    ],
    metas.map<TrackState>((_, i) => (i === index ? 'here' : 'done')),
  )

  // One detector decides both mechanisms, because a lesson carries one quiz
  // shape or the other and the two cannot share a page. The stepper's rules
  // match a button question that can never hold a checked radio, so a lesson
  // given both would hide every question past the first for good and outrank
  // the class the script reveals feedback with.
  const legacy = html.includes(LEGACY_OPTION)

  const regions: ReadonlyArray<readonly [Region, string]> = [
    // The stepper follows the workspace stylesheet so it wins the cascade at
    // equal specificity, which is what reaches a workspace seeded before it.
    ['style', `<style>\n${legacy ? css : `${css}\n${QUIZ_CSS}`}\n</style>`],
    ['header', header],
    ['footnav', renderFootNav(metas, index)],
    ['scripts', renderScripts(legacy, false)],
  ]

  for (const [region, content] of regions) {
    const spliced = spliceRegion(html, region, content)
    if (spliced === undefined) return { ok: false, file, missing: region }
    html = spliced
  }

  await writeFile(path, html)
  return { ok: true, file }
}

export interface LessonSkipped {
  readonly file: string
  readonly missing: string
}

export interface NavGenerated {
  readonly ok: true
  /** Relative to the root, so a caller prints a path a reader can open. */
  readonly root: string
  readonly contents: readonly string[]
  readonly lessons: number
  /** A lesson file missing a chrome marker, refused rather than rewritten. */
  readonly skipped: readonly LessonSkipped[]
}

export type NavOutcome = NavGenerated | TeachRefused

/**
 * Rewrites the teach-root listing, every workspace's contents page, and each
 * lesson's chrome, from what the folder holds on disk.
 *
 * The root page always reflects every workspace, whether or not `selector`
 * scopes the run to one of them, since a global page is cheap to regenerate
 * and reading it as stale after a scoped run would be a second kind of nav
 * drift this verb exists to end.
 */
export async function generateNav(
  root: string,
  selector?: string,
): Promise<NavOutcome> {
  const listed = await listWorkspaces(root)
  if (!listed.ok) return listed

  let targetSlugs: readonly string[]

  if (selector === undefined) {
    targetSlugs = listed.workspaces.map((workspace) => workspace.slug)
  } else {
    const found = await readWorkspace(root, selector)
    if (!found.ok) return found
    targetSlugs = [found.workspace.slug]
  }

  const dir = teachDir(root)
  const rootPath = join(dir, 'index.html')
  await writeFile(rootPath, renderRootPage(listed.workspaces))

  await writeFile(
    join(dir, TEACH_STYLESHEET),
    buildDesignCss(undefined, {
      embedFonts: TEACH_FONT_FACES,
      components: TEACH_STYLESHEET_COMPONENTS,
    }),
  )

  const contents: string[] = []
  const skipped: LessonSkipped[] = []
  let lessons = 0

  for (const slug of targetSlugs) {
    const found = await readWorkspace(root, slug)
    if (!found.ok) continue

    const detail = found.workspace
    const metas = await readLessonMetas(root, detail)

    const cssPath = join(root, detail.path, TEACH_ASSETS, TEACH_STYLESHEET)
    if (!existsSync(cssPath)) await writeStylesheet(root, detail.slug)

    const contentsPath = join(root, detail.path, 'index.html')
    await writeFile(
      contentsPath,
      await renderContentsPage(root, listed.workspaces, detail, metas),
    )
    contents.push(relative(root, contentsPath))

    const css = stripImports(await readFile(cssPath, 'utf8'))

    for (let index = 0; index < metas.length; index += 1) {
      const outcome = await rewriteLesson(
        root,
        detail,
        index,
        metas,
        listed.workspaces,
        css,
      )

      if (outcome.ok) {
        lessons += 1
      } else {
        skipped.push({
          file: join(detail.path, TEACH_LESSONS, outcome.file),
          missing: `canon:teach:${outcome.missing}`,
        })
      }
    }
  }

  return {
    ok: true,
    root: relative(root, rootPath),
    contents,
    lessons,
    skipped,
  }
}
