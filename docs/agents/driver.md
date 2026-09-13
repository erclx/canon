---
title: Driver
description: Walking a page through named interactions, the probe catalog and the false finding each one carries, why viewport heights are never defaulted, and what each refusal reports
---

# Driver

`canon drive <url> <run>` walks a page through a sequence of interactions and measures every state it reaches. A render answers about a page as it loads, so a defect that exists only after a menu opens, an answer is chosen, or the page scrolls is invisible to one. That second axis is what this adds.

```bash
canon drive http://localhost:4173 run.json
canon drive http://localhost:4173 run.json --json
```

| Option   | Behavior                                |
| -------- | --------------------------------------- |
| `--json` | Add a machine-readable record on stdout |

## The run file

The run is a JSON file rather than a key in a project config, because a route catalog is state a project holds and an interaction sequence is a script written for one question. It carries the viewport, the probes to run by default, and the steps.

```json
{
  "viewport": { "width": 1440, "heights": [900, 1200, 1500] },
  "probes": ["focus", "details"],
  "steps": [
    { "name": "on load", "kind": "wait", "ms": 0 },
    { "name": "open the menu", "kind": "click", "target": "#menu summary" },
    {
      "name": "reach the diagram",
      "kind": "scroll",
      "target": "figure",
      "probes": ["diagram-geometry", "diagram-strokes"]
    }
  ]
}
```

Every step names what it did, and that name is carried onto each finding it produced, alongside the viewport. A step naming its own `probes` overrides the run-level list for that step alone. Omitting `probes` at the run level runs all four.

| Step kind | Fields             | What it does                                   |
| --------- | ------------------ | ---------------------------------------------- |
| `click`   | `target`           | Presses the first element the selector matches |
| `scroll`  | `target`           | Brings the first match into view               |
| `fill`    | `target`, `text`   | Types into the first match                     |
| `tab`     | `count` (optional) | Advances keyboard focus, once by default       |
| `wait`    | `ms`               | Holds, for a state the page reaches alone      |

Probes run after a step and never on arrival, so a run reaches the load state by opening with a `wait` step of its own, as the example above does. Nothing probes before the first step runs, which makes that leading step the only way to measure the page as it first painted, and naming it is what puts the load state on its own findings rather than under whatever ran next.

Write one wherever no capture runs against the page. `canon capture` renders a single state from a source on disk or a URL, so where it runs it already answers about arrival and a leading `wait` duplicates it. Where it does not, this command is the only thing measuring the page at all, and a run without that step reports every driven state and nothing about the one a visitor sees first.

Each height is driven in a context of its own from a fresh navigation, rather than by resizing the page the previous height already drove, since a sweep asks the same question of each height rather than a later question of an already-driven page.

## The probes

Four probes, a fixed catalog rather than a subject system a project extends. Each carries a class of false finding that a throwaway version of this command produced before it produced true ones, and a probe a project authored for itself would re-pay those.

| Probe              | What it reports                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `focus`            | An element that takes keyboard focus and changes nothing visible                           |
| `details`          | A `details` panel off the viewport, or a row under the tap minimum, both read open         |
| `diagram-geometry` | An SVG label outside its frame, covered by a filled shape, or colliding with another label |
| `diagram-strokes`  | An SVG label a stroke crosses, sampled along the stroke's own geometry                     |

`focus` presses Tab before it reads anything. `:focus-visible` does not match a scripted `.focus()` once the page has taken a pointer interaction, and a driver clicks by definition, so a reader without that press reports every correctly styled element as unstyled. It also ignores an outline width, color, or offset moving underneath an outline that resolves to `none`, which paints nothing.

`details` discovers every `details` on the page rather than taking a selector, measures each shut and again open, and judges only the open reading. A shut menu still reports a layout box and the box describes the trigger rather than the panel, so the shut numbers travel in the record as context. Discovery is automatic because the one real menu defect in the originating run was missed by a hand-picked probe: nobody thought to name that menu.

Both diagram probes read after `document.fonts.ready` and never compute from the markup. A generated page is routinely authored against one font and restyled to another, so a label that cleared a line at its authored width can overlap it once rendered. Every rect either probe compares is inset vertically and never horizontally, since a text rect is loose above and below the glyphs and tight to them left and right, and a horizontal inset passes a real overrun.

`diagram-strokes` is separate from `diagram-geometry` because a bounding box cannot answer for a stroke. A probe comparing filled boxes filters out every `line` and every `fill="none"` panel border before it compares, and a diagonal connector's box covers most of a diagram while the stroke itself touches almost none of it. Both paint orders are findings: a stroke drawn after a label crosses the glyphs out, and one drawn before it shows through them, since SVG text carries no plate of its own.

## Viewport heights are never defaulted

A run with no `viewport.heights` refuses. The heights that separate a passing render from a failing one belong to the layout being driven, and the only evidence behind any default this could ship is one fixture's failure range, too narrow a sample to hand every later caller a number they never chose. A scroll rail that skipped its middle sections passed at 900 and failed at 1200 and 1500, so one height reports clean over a live defect.

## What it reports

It reports findings and never gates, and the exit code says only whether the drive completed. Every probe here carries a class of false finding already paid for once, so a command ending a build on its own reading makes a claim this catalog has not earned. A caller that wants a verdict reads `findings` off the `--json` record and decides for itself.

| Reason               | What it means                                          |
| -------------------- | ------------------------------------------------------ |
| `no-run-file`        | Nothing readable at the path given                     |
| `unreadable-plan`    | The run file is not valid JSON                         |
| `no-steps`           | The run names no step                                  |
| `no-probes`          | The run names an empty probe list                      |
| `unknown-probe`      | The run names a probe this build does not ship         |
| `bad-step`           | A step is missing what the driver needs to perform it  |
| `no-viewport`        | The run declares no viewport                           |
| `no-width`           | The viewport has no width to wrap at                   |
| `no-heights`         | The viewport names no height, which is never defaulted |
| `engine-missing`     | The browser engine is not installed in this project    |
| `browser-missing`    | The engine is installed and its browser binary is not  |
| `server-unreachable` | Nothing answered at the URL, so no state was reached   |
| `drive-failed`       | The drive failed against a reachable page              |

An unreachable page refuses rather than returning an empty report, since nothing measured and nothing found read the same to anything counting findings.

The browser binary installs separately from the package, once, with `bunx playwright install chromium`. The command ships to targets like `demo`, `inventory`, and `capture`, because its whole purpose is measuring a page inside someone else's project. It reaches nothing under `src/capture/`, so the two surfaces move independently.

See `commands.md` for where this sits among the browser commands, and `capture.md` for the single-state render it adds an axis to.
