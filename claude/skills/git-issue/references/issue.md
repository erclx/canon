# Issue reference

## Contents

- [Scope](#scope)
- [Title](#title)
- [Labels](#labels)
- [Content](#content)
- [Sections](#sections)
- [Formatting](#formatting)
- [Examples](#examples)

## Scope

Governs a tracker issue: its title, its labels, and the sections its body carries.

Does not govern:

- Pull request title and body: the pull request standard
- Whether a phase label may appear in issue text: the versioning standard
- Voice, rhythm, and sentence construction in issue prose: the `write-human` skill
- Punctuation and formatting in issue prose: the markdown standard

## Title

- Format: `<type>: <subject>`
- Type is `bug`, `task`, or `feedback`, always lowercase
- Lowercase the first word of the subject for `bug` and `task`, which are hand-composed
- A `feedback` subject is copied by the CLI from the report's `### Surface` field verbatim, so it carries no casing rule
- Length: 72 characters maximum, no trailing period.

## Labels

- Apply `bug` for a defect and `enhancement` for a task or improvement. Both are GitHub default labels.
- Apply `feedback` to a report filed through `canon feedback`, which sets the label unconditionally rather than a session choosing it
- `feedback` is not a GitHub default, so create it once per project with `gh label create feedback`
- A label that does not exist makes `gh` reject the issue. Create each one once with `gh label create`.
- One label per issue unless a second genuinely applies.

## Content

- Use imperative mood and describe the actual defect or work, not that something is wrong.
- Do not open with "This issue," "I want," or "We should."
- Do not use buzzwords or speculative future scope.
- State observable behavior for a bug, not a guessed cause.

## Sections

### Bug and task

A bug or task body carries up to four `##` sections, in this order.

- `## Summary`: one line naming what and why.
- `## Details`: for a bug, what happens versus what is expected. For a task, what to build.
- `## Context`: for a bug, repro steps or commands. For a task, the driving reason, or `none`.
- `## Proposed` (optional): one line naming a fix or approach. Omit when open.

### Follow-up

A comment on an open issue carries what the session adds and nothing the issue already says.

- `## Follow-up`: one line naming what is new, such as a second instance, a repro, or a narrowed cause.
- `## Details`: the observed behavior and the command or path that shows it.

### Feedback

One `## Toolkit feedback` wrapper holds every field as a nested `###` heading. A flat `##` field is not recognized.

- **`### From project`** (optional): the reporting project's name or kind.
- **`### Surface`** (required): the toolkit surface and its type, and the specific file or name when known.
- **`### Observed`** (required): the observed behavior.
- **`### Expected`** (optional): the expected behavior, or `unclear`.
- **`### Repro`** (optional): repro details, or `none`.
- **`### Proposed fix`** (required): a proposed fix, or `open` when the session settled on no direction.
- **`### Suggested shape`** (optional): the template, output, or field list the change should take, inside a `<details>` block. Omit the heading when there is none.
- **`### Why`** (optional): the reasons for the fix, one bullet each. Omit the heading when there are none.
- **`### Links`** (optional): the issues, pull requests, or documents the report cites, one per line. Omit the heading when there are none.

A required field is refused when present but empty. Write the fallback literal for From project, Expected, and Repro rather than leaving one blank.

## Formatting

### Bug and task

Keep a bug or task body short and uniform.

- End every bullet with a period.
- Keep each section to one or two lines.

### Feedback

A feedback field may run to multiple paragraphs and may hold a fenced code block, so the one-or-two-line rule and the trailing-period rule do not apply.

## Examples

### Correct (bug)

A bug states observed behavior and the fix, each in a line.

```markdown
## Summary

Fix the feedback CLI so it applies the `feedback` label.

## Details

`canon feedback` opens an issue with no label, so the toolkit's triage never lists it.

## Context

Run a piped `canon feedback`, then check the issue carries no `feedback` label.

## Proposed

Pass `--label feedback` through the shared issue helper.
```

### Correct (task)

A task states what to build and the reason driving it.

```markdown
## Summary

Add a git-issue skill so a session can file an issue on the current repo.

## Details

Format an issue from session context and file it with `gh issue create`, next to git-pr in the git family.

## Context

The toolkit-issue skill only files on the toolkit repo. A general path is needed for target projects.
```

### Incorrect

This summary opens with "This issue", hedges, and names no defect.

```markdown
## Summary

This issue is about the feedback system being kind of broken, and we should probably make it more robust.
```
