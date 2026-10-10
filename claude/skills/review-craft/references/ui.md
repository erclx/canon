# Rendered output

A screenshot is the one artifact that shows what a change paints. Reading the markup and the styles tells you what the author meant, and the image tells you what happened. Open the images rather than inferring them from the diff.

Stills are this pass's evidence. Driving the running app through the checklist belongs to `review-ui`, a separate pass, so a code review opens the captures and never starts a browser.

## When it applies

The diff touches a file that paints: markup, a stylesheet, a component or template, a design token file, or a rendered document source. Or the pull request carries an evidence comment, whatever the diff touches.

## First, check that a screenshot exists

Run this before any other section, since a pass that finds nothing to open otherwise reads the stylesheet instead and reports as if it had looked. Read its answer before composing any report or body, never in the same batch as the write, since what it decides is a finding the report has to carry.

Read the thread over REST, which a cloud session's GitHub proxy serves where it refuses GraphQL, and take the head off `canon pr head <number> --json`, from the record's `tip`:

```bash
gh api --paginate 'repos/{owner}/{repo}/issues/<number>/comments?per_page=100' --jq '.[] | select((.body // "") | contains("<!-- pr-evidence: head=")) | .body'
```

Take the comment whose body carries a `<!-- pr-evidence: head=<sha> -->` marker. Match the marker, never the first line, since the body opens with `## Evidence` and a comment posted before that layout opens with a `**Preview:**` line instead.

Flag the change as shipping no screenshot when it paints and the pull request carries no marked comment, carries one with no comparison, meaning no `**Base:**` line and no `<details>` table, or carries only a checklist posted alone. The `## Evidence` heading opens every marked comment, a checklist-only one included, so the heading alone never means screenshots are present. Then decide how to raise it by whether the project keeps captures, which is the same test `canon pr evidence` applies:

```bash
git ls-tree -r --name-only <base> | grep -E '(^|/)evidence/.*\.(png|jpe?g|gif|webp|avif|svg)$' | head -1
```

- A path prints: the project keeps captures and this change skipped them. File it as a finding against the pull request.
- Nothing prints: raise it as a question with no severity, since a project with no capture harness would otherwise take the flag on every styling change.

Stop reading this reference once the flag is raised, since there is nothing to open. Otherwise continue with the comment in hand.

## Reading the comment

Compare the marker's head with `headRefOid`. When it trails, the images describe an older head. Name which later commits touched a painting file, and read the images as evidence about that older head only.

## Opening the images

Each row embeds `github.com/<repo>/blob/<sha>/<path>?raw=true`. A session cannot fetch that address from a private repository, so never follow it and never report an image you did not open. Fetch the head instead:

```bash
git fetch -q origin pull/<number>/head
mkdir -p .canon/tmp/pr/review/evidence/<number>
git show <sha>:<path> > .canon/tmp/pr/review/evidence/<number>/<side>-<name>.png
```

Take the sha from the row, so the base and head sides are exactly what the comment shows. Then open each file with the file-reading tool. A `*(new)*` base cell has no before image, and a state whose cases are all added has no Base column at all. Read the URL out of the `src=` of each `<img>`, or out of `![](` in a comment posted before the embed changed.

## How many to open

Open at most 12 images per pass, filled in this order:

1. Every image a ticked checklist box names
2. The head side of each state at its narrowest and widest captured width, in one theme
3. The base side, only for a state whose head image looks wrong or whose diff was meant to change appearance

A second theme earns a read only when the diff touches a color token. Name the states left unopened on one line, as a note rather than a finding, so the reader knows what the pass did not see.

## Comparing

Check each opened image against the layout its checklist box claims, and check `canon/DESIGN.md` for the tokens the image makes visible: color, type scale, spacing, and component rules.

Read the width and theme from whatever the image path carries, and fix no width list, since which widths matter belongs to the project. Skip the design file comparison silently when the project has none.

A finding names the checklist box or design-file line the image breaks, never a taste.

## The checklist

The `## What to look at` block between the `pr-checklist` markers holds what was claimed as verified. A tick stamped `passed at` the current head is the UI reviewer's pass, and an unstamped tick is an author's or operator's claim.

- Test each ticked box against an opened image showing the state and width it names, a stamped one included, since the UI reviewer drove the running app and not the committed stills. Flag a box whose image contradicts it, quoting the box.
- A ticked box no image covers is untested rather than confirmed, and the finding says so.
- Test only the rows the current comment shows. The next render clears a tick whose stamp names another head, so a tick not stamped at the current head may describe images the comment no longer carries.
- Leave unchecked boxes to the procedure's own read of the description.

## With no pull request

A local review has no comment to read. Read each changed image under an `evidence/` path segment from the working tree, and its base side with `git show <base>:<path>`. Read the checklist handoff at `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root when it exists. A painting change with no changed evidence image takes the flag from the first section, decided by the same `git ls-tree` test.
