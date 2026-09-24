import { existsSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  TEACH_SIDEBAR_BREAKPOINT,
  TEACH_STYLESHEET_COMPONENTS,
} from '@/design/components'
import { buildDesignCss } from '@/design/css'
import { FAVICON_COLORS, faviconLink, renderFavicon } from '@/design/favicon'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import { PROJECT_ROOT } from '@/project-root'
import { TEACH_FONT_FACES } from '@/teach/fonts'
import {
  listWorkspaces,
  readWorkspace,
  TEACH_ASSETS,
  TEACH_LESSONS,
  TEACH_MISSION,
  TEACH_REFERENCE,
  TEACH_STYLESHEET,
  TEACH_STYLESHEET_BASE,
  teachDir,
  type TeachRefused,
  type WorkspaceDetail,
  type WorkspaceSummary,
  writeStylesheet,
} from '@/teach/workspace'

const BRAND_MARK = 'assets/brand/mark.svg'

/**
 * The link `teach-workspace` once had a session write by hand into every page.
 * A lesson keeps whatever sits outside its marked regions, so the old icon
 * would stay beside the spliced one. Matching the exact string the skill
 * mandated removes it without touching a link an author chose on purpose.
 */
const HAND_WRITTEN_ICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='10 10 80 80'%3E%3Cpath d='M34,20 L15,28 L15,72 L34,80 Z M66,20 L85,28 L85,72 L66,80 Z' fill='rgb(224,114,75)' /%3E%3Crect x='44' y='15' width='12' height='70' rx='2' fill='rgb(224,114,75)' /%3E%3C/svg%3E" />`

/**
 * The stylesheet link lessons used to carry by hand outside every region. The
 * `style` region now links the base sheet itself, so keeping this one would
 * load the base twice.
 */
const HAND_WRITTEN_STYLESHEET = `<link rel="stylesheet" href="../${TEACH_ASSETS}/${TEACH_STYLESHEET}" />`

const HAND_WRITTEN_HEAD = [HAND_WRITTEN_ICON, HAND_WRITTEN_STYLESHEET]

function dropHandWrittenHead(html: string): string {
  return HAND_WRITTEN_HEAD.reduce(
    (text, link) => text.replaceAll(link, ''),
    html
      .split('\n')
      .filter((line) => !HAND_WRITTEN_HEAD.includes(line.trim()))
      .join('\n'),
  )
}

/**
 * Built from the brand mark and the favicon's own pair, the same two inputs
 * `web/public/favicon.svg` is generated from, so every teach page carries the
 * icon the landing page does rather than a copy of its own.
 */
function teachFavicon(): string {
  const mark = readFileSync(join(PROJECT_ROOT, BRAND_MARK), 'utf8')
  return faviconLink(renderFavicon(mark, FAVICON_COLORS))
}

/**
 * Narrower and steeper than the mark it replaces, with round caps and joins.
 * The old one painted a 5.4 by 2.7 pixel butt-capped dash whose only claim to
 * pointing was the mitre at its vertex, and the path is shifted so its ink
 * centres in its own viewBox rather than sitting a pixel below the cap band of
 * the label beside it.
 */
const CARET =
  '<svg class="caret" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.6 3.7l2.4 2.6 2.4-2.6"/></svg>'

const THEME_BUTTON =
  '<button class="theme" type="button" aria-label="Switch between light and dark"><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>'

const THEME_SCRIPT =
  '<script>(function(){var r=document.documentElement;try{var s=localStorage.getItem("course-theme");if(s)r.dataset.theme=s;}catch(e){}document.addEventListener("click",function(e){var b=e.target.closest(".theme");if(!b)return;var d=r.dataset.theme==="dark"||(!r.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"light":"dark";try{localStorage.setItem("course-theme",r.dataset.theme);}catch(e){}});})();</script>'

const CLOSE_OUTSIDE_CLICK_SCRIPT = `<script>
(function () {
  var MENUS = "details.jump[open], details.sb-ws[open]";

  function close(except) {
    document.querySelectorAll(MENUS).forEach(function (d) {
      if (d !== except) d.open = false;
    });
  }
  document.addEventListener("click", function (e) {
    var inside = e.target.closest("details.jump, details.sb-ws");
    close(inside);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = document.querySelector(MENUS);
    if (!open) return;
    open.open = false;
    var s = open.querySelector("summary");
    if (s) s.focus();
  });

  /* Hover intent on the breadcrumb only. The sidebar's workspace switcher stays
     click-only on purpose: its panel opens directly over the lesson list, which
     is where the pointer is headed, so hovering it would cover the thing
     being reached for. The breadcrumb's panel drops over body text instead. */
  var OPEN = 120, SHUT = 260;

  document.querySelectorAll("details.jump").forEach(function (d) {
    var host = d.closest(".crumb-item") || d;
    var timer = null;
    var openedByHover = false;

    function arm(want) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (want) close(d);
        d.open = want;
      }, want ? OPEN : SHUT);
    }

    host.addEventListener("mouseenter", function () {
      if (!d.open) openedByHover = true;
      arm(true);
    });
    host.addEventListener("mouseleave", function () {
      openedByHover = false;
      arm(false);
    });
    /* Keeps it open while the pointer is inside the panel, without cancelling a
       pending open, which is what silently disabled this on one of two menus. */
    d.addEventListener("mouseenter", function () { if (d.open) clearTimeout(timer); });

    /* Hover and click were wired to one disclosure and fought: hover opened the
       panel, then the summary's native click toggled what hover had already
       opened, so reaching for an item shut it. A click on a panel hover opened
       keeps it open, and a second click closes. The click path stays live for
       touch, where no hover exists, and for the keyboard, where Enter is the
       only way in. */
    var summary = d.querySelector("summary");
    if (summary) summary.addEventListener("click", function (e) {
      if (d.open && openedByHover) { e.preventDefault(); openedByHover = false; }
    });
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
  var count = document.getElementById("gloss-count");
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
    if (count) {
      var total = list.querySelectorAll(".gterm").length;
      count.textContent = (n === total ? total : n + " of " + total) + (total === 1 ? " term" : " terms");
    }
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

/**
 * The panel's state, settled before the first paint rather than after it. An
 * arm that set the narrow default afterwards slid the panel in and back out on
 * every load, and a restored custom width animated in from the default.
 *
 * A listing page starts shut because the body already lists what the panel
 * would, and a lesson starts open because there the panel is the only
 * cross-lesson navigation on the page. A stored preference beats both. A count
 * threshold on its own was built and reverted, since it hides the panel on a
 * lesson too.
 */
function headScript(page: 'index' | 'lesson'): string {
  return `<script>(function(){var r=document.documentElement,s=null;
r.dataset.page="${page}";
if(matchMedia("(max-width: ${TEACH_SIDEBAR_BREAKPOINT}px)").matches){r.classList.add("sb-shut");return}
try{s=localStorage.getItem("teach-sb")}catch(e){}
var idx=r.dataset.page==="index";
if(s==="shut"||(s===null&&idx))r.classList.add("sb-shut");
var w=null;try{w=localStorage.getItem("teach-sb-w")}catch(e){}
if(w)r.style.setProperty("--sb-w",w+"px")})();</script>`
}

const SIDEBAR_SCRIPT = `<script>
(function () {
  var root = document.documentElement;
  var panel = document.querySelector(".sb");
  if (!panel) return;

  var fold = document.querySelector(".sb-fold");
  var narrow = matchMedia("(max-width: ${TEACH_SIDEBAR_BREAKPOINT}px)");

  var FOCUSABLE = "a[href], button:not([disabled]), summary, input, [tabindex]:not([tabindex='-1'])";

  function panelStops() {
    return Array.prototype.slice.call(panel.querySelectorAll(FOCUSABLE))
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }

  /* The focus return belongs here rather than on the close control, because all
     three routes out land here and only one of them used to move focus. The
     shut panel takes visibility: hidden 180ms later, so a reader who pressed
     Escape kept focus on a control that then disappeared under them and the
     browser dropped them at the top of the document. */
  function shut() {
    var inside = panel.contains(document.activeElement);
    root.classList.add("sb-shut");
    try { localStorage.setItem("teach-sb", "shut"); } catch (e) {}
    if (inside && fold) fold.focus();
  }

  if (fold) fold.addEventListener("click", function () {
    root.classList.toggle("sb-shut");
    try {
      localStorage.setItem("teach-sb", root.classList.contains("sb-shut") ? "shut" : "open");
    } catch (e) {}
    /* An overlay takes focus with it. Without this a keyboard reader opens the
       panel and goes on tabbing through the lesson behind the scrim. */
    if (!narrow.matches || root.classList.contains("sb-shut")) return;
    var first = panel.querySelector("a, button, summary, input");
    if (first) first.focus();
  });

  var scrim = document.createElement("div");
  scrim.className = "sb-scrim";
  document.body.appendChild(scrim);
  scrim.addEventListener("click", shut);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && narrow.matches) { shut(); return; }

    /* The scrim says the lesson is unavailable, so Tab must not reach it.
       Moving focus into the panel on open only defers this by however many
       controls the panel holds. */
    if (e.key !== "Tab") return;
    if (!narrow.matches || root.classList.contains("sb-shut")) return;

    var stops = panelStops();
    if (!stops.length) return;

    var first = stops[0];
    var last = stops[stops.length - 1];

    if (!panel.contains(document.activeElement)) {
      (e.shiftKey ? last : first).focus();
      e.preventDefault();
    } else if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  });

  /* The panel covers the masthead and the toggle that opened it, so it carries
     its own way out rather than leaving the scrim as the only route. */
  var close = document.createElement("button");
  close.type = "button";
  close.className = "sb-close";
  close.setAttribute("aria-label", "Close the course panel");
  close.textContent = "\\u00d7";
  close.addEventListener("click", shut);
  panel.appendChild(close);

  var MIN = 208, MAX = 296, DEF = 256;
  var grip = document.querySelector(".sb-grip");
  var lastWidth = parseInt(root.style.getPropertyValue("--sb-w"), 10) || DEF;

  function setWidth(px, save) {
    var w = Math.max(MIN, Math.min(MAX, Math.round(px)));
    root.style.setProperty("--sb-w", w + "px");
    lastWidth = w;
    if (save) { try { localStorage.setItem("teach-sb-w", String(w)); } catch (e) {} }
  }

  if (grip) {
    var dragging = false;
    grip.addEventListener("pointerdown", function (e) {
      dragging = true;
      grip.setPointerCapture(e.pointerId);
      root.classList.add("sb-drag");
      e.preventDefault();
    });
    grip.addEventListener("pointermove", function (e) {
      if (dragging) setWidth(e.clientX, false);
    });
    grip.addEventListener("pointerup", function (e) {
      if (!dragging) return;
      dragging = false;
      root.classList.remove("sb-drag");
      grip.releasePointerCapture(e.pointerId);
      setWidth(lastWidth, true);
    });
    grip.addEventListener("dblclick", function () { setWidth(DEF, true); });
    grip.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 32 : 8;
      if (e.key === "ArrowLeft") { setWidth(lastWidth - step, true); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setWidth(lastWidth + step, true); e.preventDefault(); }
      else if (e.key === "Home") { setWidth(DEF, true); e.preventDefault(); }
    });
  }

  var filter = document.querySelector(".sb-filter input");
  if (filter) filter.addEventListener("input", function () {
    var q = filter.value.trim().toLowerCase();
    document.querySelectorAll(".sb-list > li").forEach(function (li) {
      li.classList.toggle("hide", q !== "" && li.textContent.toLowerCase().indexOf(q) === -1);
    });
  });

  var slot = document.querySelector(".sb-out-slot");
  var hs = Array.prototype.slice.call(document.querySelectorAll("main h2"));
  var links = [];

  if (slot && hs.length) {
    var list = document.createElement("ul");
    list.className = "sb-out";
    hs.forEach(function (h, i) {
      if (!h.id) h.id = "s" + i;
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent.trim();
      li.appendChild(a);
      list.appendChild(li);
    });
    slot.parentNode.replaceChild(list, slot);
    links = Array.prototype.slice.call(list.querySelectorAll("a"));
  }

  /* The bar reports position inside the lesson, which nothing reported before
     the segmented track retired. The breadcrumb's last segment carries the
     lesson title once the real one has scrolled off. */
  var bar = document.querySelector(".bar");
  var here = document.querySelector(".crumb-here");
  var h1 = document.querySelector("main h1");
  var counter = here ? here.textContent.trim() : "";
  var title = h1 ? h1.textContent.trim() : "";

  function focusLine() {
    var max = document.documentElement.scrollHeight - innerHeight;
    ${FOCUS_LINE_BODY}
  }

  function sync() {
    if (bar) {
      var max = document.documentElement.scrollHeight - innerHeight;
      var pct = max > 0 ? Math.min(100, Math.max(0, (scrollY / max) * 100)) : 0;
      bar.style.setProperty("--read", pct.toFixed(1) + "%");
    }

    if (here && h1 && title && counter) {
      var want = h1.getBoundingClientRect().bottom < 56 ? title : counter;
      if (here.textContent !== want) here.textContent = want;
    }

    if (links.length) {
      /* Nothing is marked until a heading has actually passed the line, so the
         first section is not reported as current while the title is on screen. */
      var best = -1;
      var line = focusLine();
      for (var i = 0; i < hs.length; i++) {
        if (hs[i].getBoundingClientRect().top <= line) best = i;
      }
      links.forEach(function (l, j) { l.classList.toggle("on", j === best); });
    }
  }

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

/** The mission's own title, falling back to the slug where it names none. */
function workspaceLabel(workspace: WorkspaceSummary): string {
  return workspace.title ?? titleCase(workspace.topic)
}

interface JumpEntry {
  readonly ordinal: string
  readonly label: string
  readonly href: string | undefined
  readonly at: boolean
  /**
   * The row's third column. The workspace menu puts a lesson count here and the
   * lesson menu leaves it empty, which is what retired the status dot that used
   * to sit there reading the same value on every row.
   */
  readonly trailing?: string
}

function renderJumpList(entries: readonly JumpEntry[]): string {
  return entries
    .map((entry) => {
      const trailing =
        entry.trailing === undefined
          ? ''
          : `<span class="ct">${escapeHtml(entry.trailing)}</span>`
      const body = `<span class="n">${entry.ordinal}</span><span>${escapeHtml(entry.label)}</span>${trailing}`

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
 * text, whether or not it still carries a jump widget of its own. A link's
 * label sits in its own span because `text-box` is ignored on the
 * `inline-flex` link, so the cap trim needs a plain box to land on.
 */
function renderBreadcrumb(segments: readonly CrumbSegment[]): string {
  return segments
    .map((segment, index) => {
      const text =
        segment.href !== undefined
          ? `<a class="crumb" href="${segment.href}"><span class="crumb-t">${escapeHtml(segment.label)}</span></a>`
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

interface SidebarItem {
  readonly ordinal: string
  readonly label: string
  readonly href: string
  readonly at: boolean
}

interface Sidebar {
  /** The switcher's own label: the workspace on a page inside one, else the root. */
  readonly heading: string
  readonly switcher: readonly JumpEntry[]
  readonly meta: string
  readonly items: readonly SidebarItem[]
  readonly foot: string | undefined
}

/**
 * Past this many rows a reader scans rather than reads, which is where a filter
 * starts earning the width it takes from the list.
 */
const FILTER_FLOOR = 8

/**
 * The course, as a column. It replaces a segmented progress strip that gave
 * each lesson one `flex: 1` segment and rendered fifty of them as a row of
 * dots, and the right-hand outline rail that only existed above 1420px. The
 * outline folds under the lesson being read, so one column reports position in
 * the course and position inside the lesson at every window width.
 */
function renderSidebar(sidebar: Sidebar): string {
  const filter =
    sidebar.items.length > FILTER_FLOOR
      ? '<div class="sb-filter"><input type="search" placeholder="Filter lessons" aria-label="Filter lessons"></div>'
      : ''

  const rows = sidebar.items
    .map((item) => {
      const slot = item.at ? '<div class="sb-out-slot"></div>' : ''
      return `<li><a class="sb-l${item.at ? ' sb-on' : ''}" href="${item.href}"><span class="sb-n">${item.ordinal}</span>${escapeHtml(item.label)}</a>${slot}</li>`
    })
    .join('')

  const body = rows
    ? `<ol class="sb-list">${rows}</ol>`
    : '<p class="sb-empty">No lessons yet.</p>'

  const foot =
    sidebar.foot === undefined
      ? ''
      : `<div class="sb-foot">${sidebar.foot}</div>`

  return `<aside class="sb">
  <div class="sb-top">
    <details class="sb-ws" name="mast"><summary><span class="ws-name" title="${escapeHtml(sidebar.heading)}">${escapeHtml(sidebar.heading)}</span><span class="car">${CARET}</span></summary><div class="sb-wl"><ul class="jump-list">${renderJumpList(sidebar.switcher)}</ul></div></details>
  </div>
  <div class="sb-scroll">
    <div class="sb-meta">${escapeHtml(sidebar.meta)}</div>
    ${filter}
    <nav class="sb-nav">${body}</nav>
  </div>
  ${foot}
  <button class="sb-grip" type="button" role="separator" aria-orientation="vertical" aria-label="Resize the course panel"></button>
</aside>`
}

/**
 * Everything but the sidebar sits inside one pane, so the two lay out as a flex
 * row and the sticky sidebar's containing block is the flex container rather
 * than a body carrying bottom padding it could never travel into. The opening
 * tag rides with the header and `PANE_CLOSE` shuts it after the footer
 * navigation, which on a lesson is a separate spliced region.
 */
const PANE_CLOSE = '</div>'

function renderHeader(
  segments: readonly CrumbSegment[],
  sidebar: Sidebar,
): string {
  return `${renderSidebar(sidebar)}
<div class="pane">
<header class="bar">
  <div class="mast">
    <span class="mast-left"><button class="sb-fold" type="button" aria-label="Toggle the course panel">&#9776;</button>${renderBreadcrumb(segments)}</span>
    <span class="mast-right">${THEME_BUTTON}</span>
  </div>
</header>`
}

function renderScripts(
  includeQuiz: boolean,
  includeGlossaryFilter: boolean,
): string {
  const scripts = [THEME_SCRIPT, CLOSE_OUTSIDE_CLICK_SCRIPT, SIDEBAR_SCRIPT]
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
${teachFavicon()}
${style}
${headScript('index')}
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
    label: workspaceLabel(workspace),
    href: hrefForWorkspace(workspace, prefix),
    at: workspace.slug === currentSlug,
    trailing: String(workspace.lessons),
  }))
}

/**
 * What the workspace holds beyond its lessons, for the foot of the sidebar.
 * Undefined where it holds neither, so the panel closes on the list rather than
 * on an empty rule.
 */
function workspaceFoot(detail: WorkspaceDetail): string | undefined {
  const bits: string[] = []

  if (detail.terms > 0) {
    bits.push(`${detail.terms} term${detail.terms === 1 ? '' : 's'}`)
  }
  if (detail.records > 0) {
    bits.push(`${detail.records} session${detail.records === 1 ? '' : 's'}`)
  }

  return bits.length > 0 ? bits.join(' &middot; ') : undefined
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

function termCount(shown: number, total: number): string {
  const noun = total === 1 ? 'term' : 'terms'

  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`
}

function renderGlossarySection(
  entries: readonly string[],
  metas: readonly LessonMeta[],
): string {
  const rendered = groupGlossaryEntries(entries, metas)
    .map(renderGlossaryGroup)
    .join('')

  return `<h2>Glossary</h2>
<div class="filter-row"><input class="filter" type="search" id="gfilter" aria-label="Filter glossary terms" aria-controls="gloss" placeholder="Filter terms"><span class="filter-count" id="gloss-count" aria-live="polite">${termCount(entries.length, entries.length)}</span></div>
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

  const sidebar: Sidebar = {
    heading: 'Workspaces',
    switcher: workspaceJumpEntries(workspaces, '', undefined),
    meta: `${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}`,
    items: workspaces.map((workspace) => ({
      ordinal: ordinalOf(workspace),
      label: workspaceLabel(workspace),
      href: hrefForWorkspace(workspace, '') ?? '#',
      at: false,
    })),
    foot: undefined,
  }

  const rows = workspaces
    .map((workspace) => {
      const href = hrefForWorkspace(workspace, '')
      const state = !hasMission(workspace)
        ? 'Stub'
        : workspace.lessons > 0
          ? 'Live'
          : 'Open'
      const blurb = `${workspace.lessons} lesson(s) &middot; ${workspace.reference} reference page(s) &middot; ${workspace.terms} term(s)`
      const inner = `<span class="num">${ordinalOf(workspace)}</span><b>${escapeHtml(workspaceLabel(workspace))}</b><span class="state">${state}</span><span class="blurb">${blurb}</span>`

      return href === undefined
        ? `<li class="soon"><a href="#" aria-disabled="true" tabindex="-1">${inner}</a></li>`
        : `<li><a href="${href}">${inner}</a></li>`
    })
    .join('')

  return `${pageHead('Learning workspaces', TEACH_STYLESHEET, undefined)}<body>
${renderHeader(segments, sidebar)}
<main class="wide-body">


<h1>Learning workspaces</h1>
<p class="lede">One folder per subject. Each carries its own mission, sources, glossary, and lessons.</p>

<ul class="toc">${rows}</ul>

</main>
${PANE_CLOSE}
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

  const title = workspaceLabel(detail)

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
      label: workspaceLabel(detail),
      jump: {
        ariaLabel: 'Jump to a lesson',
        entries: lessonJumpEntries(metas, '', undefined),
      },
    },
  ]

  const sidebar: Sidebar = {
    heading: workspaceLabel(detail),
    switcher: workspaceJumpEntries(workspaces, '../', detail.slug),
    meta: `${metas.length} lesson${metas.length === 1 ? '' : 's'}`,
    items: metas.map((meta, index) => ({
      ordinal: String(index + 1).padStart(2, '0'),
      label: meta.title,
      href: `${TEACH_LESSONS}/${meta.file}`,
      at: false,
    })),
    foot: workspaceFoot(detail),
  }

  const lessonRows = metas
    .map(
      (meta, index) =>
        `<li><a href="${TEACH_LESSONS}/${meta.file}"><span class="num">${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(meta.title)}</b><span class="blurb">${escapeHtml(meta.lede)}</span></a></li>`,
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
${renderHeader(segments, sidebar)}
<main class="wide-body">


<h1>${escapeHtml(title)}</h1>
${sections}

</main>
${PANE_CLOSE}
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
 * A lesson embeds the workspace stylesheet, and an `@import` resolves against
 * the lesson's own folder there rather than the assets folder, so it never
 * loaded anything. The base sheet reaches the page through the `<link>` the
 * `style` region carries ahead of the embedded rules.
 */
function stripImports(css: string): string {
  return css.replace(/^@import[^;]*;[ \t]*\n?/gm, '')
}

const HEADER_CLOSE = '<!-- /canon:teach:header -->'
const FOOTNAV_OPEN = '<!-- canon:teach:footnav -->'

/**
 * The authored body between the header and footnav regions, wrapped in
 * `<main>` when it holds none. The skill has a session write the body bare,
 * and the column width hangs off `main`. A body already holding one is left
 * alone, which keeps a second run byte-identical.
 */
function wrapMain(html: string): string {
  const start = html.indexOf(HEADER_CLOSE)
  const end = html.indexOf(FOOTNAV_OPEN, start)
  if (start === -1 || end === -1) return html

  const bodyStart = start + HEADER_CLOSE.length
  const body = html.slice(bodyStart, end)
  if (/<main[\s>]/.test(body)) return html

  return `${html.slice(0, bodyStart)}\n<main>\n${body.trim()}\n</main>\n${html.slice(end)}`
}

/**
 * Splices the four chrome regions into one lesson file, in a fixed order so a
 * missing marker is always reported against the same region a session can
 * check first, then wraps the authored body in `<main>` where it holds none.
 * Nothing is written when any region is missing, which is what keeps a
 * partially-spliced file off disk.
 */
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
  let html = dropHandWrittenHead(await readFile(path, 'utf8'))

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
        label: workspaceLabel(detail),
        href: `${workspacePrefix}index.html`,
        jump: {
          ariaLabel: 'Jump to a lesson',
          entries: lessonJumpEntries(metas, workspacePrefix, file),
        },
      },
      { label: `Lesson ${index + 1} of ${metas.length}` },
    ],
    {
      heading: workspaceLabel(detail),
      switcher: workspaceJumpEntries(workspaces, teachPrefix, detail.slug),
      meta: `${metas.length} lesson${metas.length === 1 ? '' : 's'}`,
      items: metas.map((meta, i) => ({
        ordinal: String(i + 1).padStart(2, '0'),
        label: meta.title,
        href: meta.file,
        at: i === index,
      })),
      foot: workspaceFoot(detail),
    },
  )

  // One detector decides both mechanisms, because a lesson carries one quiz
  // shape or the other and the two cannot share a page. The stepper's rules
  // match a button question that can never hold a checked radio, so a lesson
  // given both would hide every question past the first for good and outrank
  // the class the script reveals feedback with.
  const legacy = html.includes(LEGACY_OPTION)

  // Linked ahead of the embedded rules so those still win the cascade.
  // Embedding it instead repeats a sheet carrying its fonts inline in every
  // lesson. A workspace seeded before the pair has no base sheet to link.
  const hasBase = existsSync(
    join(root, detail.path, TEACH_ASSETS, TEACH_STYLESHEET_BASE),
  )
  const baseLink = hasBase
    ? `<link rel="stylesheet" href="../${TEACH_ASSETS}/${TEACH_STYLESHEET_BASE}">\n`
    : ''

  const regions: ReadonlyArray<readonly [Region, string]> = [
    // The stepper follows the workspace stylesheet so it wins the cascade at
    // equal specificity, which is what reaches a workspace seeded before it.
    // The icon and the head script both belong in `<head>`, so they ride in the
    // one region that sits there rather than a fifth marker every seeded
    // lesson would lack.
    [
      'style',
      `${teachFavicon()}\n${baseLink}<style>\n${legacy ? css : `${css}\n${QUIZ_CSS}`}\n</style>\n${headScript('lesson')}`,
    ],
    ['header', header],
    ['footnav', `${renderFootNav(metas, index)}\n${PANE_CLOSE}`],
    ['scripts', renderScripts(legacy, false)],
  ]

  for (const [region, content] of regions) {
    const spliced = spliceRegion(html, region, content)
    if (spliced === undefined) return { ok: false, file, missing: region }
    html = spliced
  }

  await writeFile(path, wrapMain(html))
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
