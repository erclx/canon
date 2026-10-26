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

Flag the change as shipping no screenshot when it paints and the pull request carries any of three comment shapes.

- No marked comment at all
- A marked comment with no comparison, meaning no `**Base:**` line and no `<details>` block
- Only a checklist posted alone, since `## Evidence` opens every marked comment and the heading alone never means screenshots are present

### Raising the flag

Decide how to raise it from the evidence verb, which reads the base branch's tree for a capture and names each painted path the pull request changed without one:

```bash
canon pr evidence <number> --check --json
```

Read the record's `uncaptured` field, never the exit code.

- It lists paths: the project keeps captures and this change skipped them. File a finding against the pull request naming each path.
- An empty list beside a changed `evidence/` image means the capture exists and the comment fails to show it. File that as a finding too.
- An empty list with no changed `evidence/` image means the painting file sits outside the painted set, such as a token file. Raise a question naming the path.
- It is absent: the base keeps no capture, or its tree went unread. Raise a question with no severity, since a project with no capture harness would otherwise take the flag on every styling change.
- The record refuses: it decides nothing, so take the tree test under the last section instead

A recapture under `canon/design/` redraws the accepted design rather than the built app, so it never stands in for an evidence capture. The verb leaves those paths out of `uncaptured`, and a pass clears a painted change on the evidence comment alone, however many design references beside it were redrawn.

Stop reading this reference once the flag is raised, since there is nothing to open. Otherwise continue with the comment in hand.

## Reading the comment

Compare the marker's head with `headRefOid`. When it trails, the images describe an older head. Name which later commits touched a painting file, and read the images as evidence about that older head only.

## Opening the images

Each image embeds `github.com/<repo>/blob/<sha>/<path>?raw=true`. A session cannot fetch that address from a private repository, so never follow it and never report an image you did not open. Fetch the head instead:

```bash
git fetch -q origin pull/<number>/head
mkdir -p .canon/tmp/pr/review/evidence/<number>
git show <sha>:<path> > .canon/tmp/pr/review/evidence/<number>/<side>-<name>.png
```

Take the sha from the image's URL, so the base and head sides are exactly what the comment shows. Then open each file with the file-reading tool.

- Read the URL out of the `src=` of each `<img>`, or out of `![](` in a comment posted before the embed changed
- Each case is a bold label over its head image, with its base folded under it in a `<details>` block titled `Base`
- An added case has no base and no fold, and its label carries `*(new)*` when its block also holds cases that existed at the base
- A view labels each case by width and theme, such as `1280 · dark`, where a flat block labels it by name
- A comment posted before the layout changed sets base and head side by side in a table, where a `*(new)*` cell has no before image and a view row holds one case per theme cell

## How many to open

Open at most 12 images per pass, filled in this order:

1. Every image a ticked checklist box names
2. The head side of each state at its narrowest and widest captured width, in one theme
3. The base side, only for a state whose head image looks wrong or whose diff was meant to change appearance

A second theme earns a read only when the diff touches a color token. Name the states left unopened on one line, as a note rather than a finding, so the reader knows what the pass did not see.

## Comparing

Check each opened image against the layout its checklist box claims. A finding names the checklist box or design-file line the image breaks, never a taste.

- Check the visible tokens, being color, type scale, and spacing, against the stylesheet `canon/DESIGN.md`'s lead names
- Check its component rules against the record itself, and skip the design file comparison silently when the project has none
- Read the width and theme from whatever the image path carries, and fix no width list, since which widths matter belongs to the project

## The checklist

The `## What to look at` block between the `pr-checklist` markers holds what was claimed as verified. A tick stamped `passed at` the current head is the UI reviewer's pass, and an unstamped tick is an author's or operator's claim.

- Test each ticked box against an opened image showing the state and width it names, a stamped one included, since the UI reviewer drove the app and not the stills
- Flag a box whose image contradicts it, quoting the box
- A ticked box no image covers is untested rather than confirmed, and the finding says so.
- Test only the rows the current comment shows. The next render clears a tick whose stamp names another head, so a tick not stamped at the current head may describe images the comment no longer carries.
- Leave unchecked boxes to the procedure's own read of the description.

## With no pull request

A local review has no comment to read, so it reads the tree.

- Read each changed image under an `evidence/` path segment from the working tree, and its base side with `git show <base>:<path>`
- Read the checklist handoff at `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root when it exists
- A painting change with no changed evidence image takes the flag from the first section, decided by the test below in place of the verb

The tree test asks the base the question the verb asks over the API, being whether the project keeps captures:

```bash
git ls-tree -r --name-only <base> | grep -E '(^|/)evidence/.*\.(png|jpe?g|gif|webp|avif|svg)$' | head -1
```

- A path prints: the project keeps captures and this change skipped them. File it as a finding.
- Nothing prints: raise it as a question with no severity, for the same reason an absent `uncaptured` field takes one
