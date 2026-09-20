# Issue reference

## Scope

Governs a tracker issue: its title, its labels, and the sections its body carries.

Does not govern:

- Pull request title and body: the pull request standard
- Whether a phase label may appear in issue text: the versioning standard
- Voice, rhythm, and sentence construction in issue prose: the `write-human` skill
- Punctuation, formatting, and banned words in issue prose: the markdown standard

## Title

- Format: `<type>: <subject>`
- Type is `bug`, `task`, or `feedback`. Lowercase the type and the first word of the subject for `bug` and `task`, both hand-composed. `feedback` is always lowercase. Its subject is derived by the CLI from the report's `### Surface` field verbatim, so the subject alone carries no casing rule.
- Length: 72 characters maximum, no trailing period.

## Labels

- Apply `bug` for a defect and `enhancement` for a task or improvement. Both are GitHub default labels.
- Apply `feedback` to a report filed through `canon feedback --github`, which sets the label unconditionally rather than a session choosing it. It is not a GitHub default. Create it once per project with `gh label create feedback`.
- A label that does not exist makes `gh` reject the issue. Create each one once with `gh label create`.
- One label per issue unless a second genuinely applies.

## Content

- Use imperative mood and describe the actual defect or work, not that something is wrong.
- Do not open with "This issue," "I want," or "We should."
- Do not use buzzwords or speculative future scope.
- State observable behavior for a bug, not a guessed cause.

## Sections

### Bug and task

- `## Summary`: one line naming what and why.
- `## Details`: for a bug, what happens versus what is expected. For a task, what to build.
- `## Context`: for a bug, repro steps or commands. For a task, the driving reason, or `none`.
- `## Proposed` (optional): one line naming a fix or approach. Omit when open.

### Feedback

- One `## Toolkit feedback` wrapper holds every field as a nested `###` heading. A flat `##` field is not recognized.
- `### From project` (optional): the reporting project's name or kind.
- `### Surface` (required): the toolkit surface and its type, and the specific file or name when known.
- `### Observed` (required): the observed behavior.
- `### Expected` (optional): the expected behavior, or `unclear`.
- `### Repro` (optional): repro details, or `none`.
- `### Proposed fix` (required): a proposed fix, or `open` when the session settled on no direction.
- A required field is refused when present but empty. Write the fallback literal for an optional field rather than leaving it blank.

## Formatting

### Bug and task

- End every bullet with a period.
- Keep each section to one or two lines.

### Feedback

- A field may run to multiple paragraphs and may hold a fenced code block. The one-or-two-line rule and the trailing-period rule do not apply.

## Examples

### Correct (bug)

```markdown
## Summary

Fix the feedback CLI so it applies the `feedback` label.

## Details

`canon feedback --github` opens an issue with no label, so `canon-feedback-triage` never lists it.

## Context

Run a piped `canon feedback --github`, then check the issue carries no `feedback` label.

## Proposed

Pass `--label feedback` through the shared issue helper.
```

### Correct (task)

```markdown
## Summary

Add a git-issue skill so a session can file an issue on the current repo.

## Details

Format an issue from session context and file it with `gh issue create`, next to git-pr in the git family.

## Context

The toolkit-issue skill only files on the toolkit repo. A general path is needed for target projects.
```

### Incorrect

```markdown
## Summary

This issue is about the feedback system being kind of broken, and we should probably make it more robust.
```
