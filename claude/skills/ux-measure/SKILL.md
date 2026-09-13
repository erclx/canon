---
name: ux-measure
description: Measures paint, processor, and layout cost against a running interface and reports numbers against published thresholds. Detects the project's existing browser harness rather than requiring one. Use when asked "how fast is this page", "measure the UI", "what does this cost to render", "check Core Web Vitals", or "profile the interface". Do NOT use to judge UI quality by reading source, which is `ux-audit`.
---

# UX measure

Report numbers. A sentence about what the source looks like is what this exists to replace, so every finding is a reading beside the threshold it is measured against.

## Guards

- If the project names no command that serves an interface and the user names no URL, stop: `❌ Nothing to serve. Name a running URL or a command that starts one.` Test for a servable interface rather than for source under a particular folder, since this measures what a browser receives and never reads the tree that produced it.
- If the request is about intent, consistency, missing states, or contrast, run nothing and name `ux-audit`. That skill reads source and this one runs the interface.

## Step 1: reach the interface

Read these in parallel from the project root, skipping any that do not exist:

- `package.json`: the `scripts` block naming a dev, preview, or start command
- `canon/context/development/`: the documented run commands and the port each serves
- `CLAUDE.md`: project type and conventions

Prefer a production-shaped build (`preview`, `start`) over the dev server. A dev server ships unminified modules and reports a cost no user pays.

Ask for the URL when nothing names one. Do not guess a port.

Then reach it. Request the URL first and measure whatever already answers, since a server the user started is the one they mean. Build and start the chosen command only when nothing answers, wait for it to accept a request before going on, and stop it once Step 4 has the readings. A run that measures before the server is listening reports a connection failure as a cost.

## Step 2: detect the harness

Test each in order and take the first that resolves. Name the one found before running it.

1. A connected browser MCP server exposing navigation and a performance trace
2. `@playwright/test` or `playwright` in `package.json`, or a `playwright.config.*` at the project root
3. `lighthouse` in `package.json`, or a script whose command names it

Never install a runner, add a dependency, or write a config to make one of these resolve. The project chooses its harness and this skill reads that choice.

When none resolves, report what the measurement needs and stop:

```plaintext
❌ No browser harness detected. This measurement drives one of:
   - a browser MCP server with a performance trace
   - Playwright (@playwright/test)
   - Lighthouse (lighthouse)
Install one, or name a running URL and which runner to drive it with.
```

## Step 3: measure

Take three readings against the same URL on a cold profile and report the median. One load carries startup noise wider than the gap between two thresholds, so a single number cannot be placed against them.

Measure these three and nothing else:

- **Paint**: Largest Contentful Paint, the moment the largest element in the viewport finishes rendering
- **Processor**: Total Blocking Time, main-thread time past 50ms per long task between first paint and interactive
- **Layout**: Cumulative Layout Shift, the summed score of unexpected shifts over the page lifetime, reported with the elements that shifted

Through Playwright or an MCP server, read them from a `PerformanceObserver` registered before navigation against the `largest-contentful-paint`, `longtask`, and `layout-shift` entry types. Lighthouse reports all three under its JSON audits, so parse rather than re-derive them.

### Attributing the layout figure

A layout score on its own names nothing to look at, and the elements are already in the reading rather than a second measurement. Each `layout-shift` entry carries a `sources` array naming the nodes that moved, so sum each entry's `value` against the nodes its sources name and keep the three largest. Lighthouse carries the same attribution in the `details.items` of its layout-shift audit, which names elements rather than scores in some versions, so report what that audit gives and do not compute a score it withheld.

Take the attribution from the run that produced the median rather than merging all three, so the parts sum to the figure printed beside them. Merging reports shares of a total no run measured.

Identify each element the way the harness names it, which is a selector from Playwright and a node label from Lighthouse. Do not open the source to improve a name. Reading the tree that produced the page is what this skill exists to replace.

Write any probe the harness needs into the project's own test folder, run it, then delete it. Leave no file behind.

### Thresholds

| Metric | Good      | Needs work | Poor      |
| ------ | --------- | ---------- | --------- |
| LCP    | `≤ 2.5s`  | `≤ 4.0s`   | `> 4.0s`  |
| TBT    | `≤ 200ms` | `≤ 600ms`  | `> 600ms` |
| CLS    | `≤ 0.1`   | `≤ 0.25`   | `> 0.25`  |

These are Google's published Core Web Vitals boundaries, with the Lighthouse lab boundary for Total Blocking Time. Cite that source in the report. Never move a number to fit a reading, and never invent a fourth metric's boundary.

## Step 4: report and persist

### Report format

```markdown
3 metrics measured against <url> over 3 runs. Harness: <name>.

| Metric | Median | Threshold | Verdict                      |
| ------ | ------ | --------- | ---------------------------- |
| LCP    | <n>    | `≤ 2.5s`  | <good \| needs work \| poor> |
| TBT    | <n>    | `≤ 200ms` | <verdict>                    |
| CLS    | <n>    | `≤ 0.1`   | <verdict>                    |

Shifted: `<element>` <n>, `<element>` <n>, `<element>` <n>.

Thresholds: Google Core Web Vitals, Lighthouse lab boundary for TBT.

Not measured: network waterfall, bundle size, accessibility, contrast.
```

Write `Shifted: nothing recorded.` when the median run logged no shift, and drop any element past the third. A layout figure of zero and a harness that reported no sources are different states, and the line says which one the run met.

Report the reading and stop there. A remedy for a poor verdict is a change with its own review, so name no fix and edit no source. Naming a shifted element stays inside that rule, since it says where the score came from rather than what to do about it.

### Persist

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

Write the full reading directly to `.canon/review/ux-measure-<slug>.md` at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does. Create the directory if it does not exist. Always overwrite.

From a linked worktree the file-editing tools refuse that path, so the reading goes out through `Bash`. Send the `mkdir -p` and the heredoc as two plain commands rather than joining them with `&&`, which is refused as compound.

The `.canon/review/` directory is gitignored. Do not stage or commit the file.

### Chat output

Output the summary line and the file path. Do not repeat the table in chat.

```plaintext
3 metrics measured against <url>. <n> past threshold.
📝 Wrote .canon/review/ux-measure-<slug>.md
```
