---
title: Pull request reference
description: Pull request title and body conventions
---

# Pull request reference

## Contents

- [Scope](#scope)
- [Title](#title)
- [Content](#content)
- [Sections](#sections)
- [Testing discipline](#testing-discipline)
- [Formatting](#formatting)
- [Examples](#examples)

## Scope

Governs a pull request title and body: their format and the sections the body carries.

Does not govern:

- **`commit.md`**: commit subject format, which shares the title form
- **`branch.md`**: branch naming
- **`versioning.md`**: whether a phase label or a semver tag may appear in a title or body
- **`publish.md`**: whether a quoted label, a gitignored record path, or a link to one Claude Code session may appear in a title or body, which `canon labels scan` fails on
- **the `write-human` skill**: voice, rhythm, and sentence construction in pull request prose
- **`markdown.md`**: punctuation and formatting in pull request prose

## Title

- Format: `<type>(<scope>): <subject>`, with `!` before the colon for a breaking change
- Casing: lowercase for `<type>`, `<scope>`, and first word of `<subject>`
- Length: 72 characters maximum
- Subject: follows the subject rules in `commit.md`, including the one for a sync or upgrade title

## Content

- Use imperative mood for all content (`add`, `fix`, `refactor`)
- Do not start with "This PR," "This commit," "Included are," or "I have"
- Do not use buzzwords (`seamless`, `robust`, `game-changer`, `enhanced`)

### What to leave out

A body describes the new behavior and nothing the diff or the commits already say.

- Do not describe historical behavior or unchanged code. Describe new behavior only.
- Do not include future promises or speculative documentation
- Do not explain obvious changes (formatting, renaming variables)
- Do not duplicate commit messages verbatim

## Sections

- `## Summary`: 1-2 sentences following `<Action Verb> <Direct Object> to <Result>`, expand for clarity if needed
- `## Key changes`: name actual files, functions, or modules (e.g., `AuthService.verify()` not "auth handler"). Always use bullet points, never prose.

### Closing lines

The closing lines end `## Summary`, one `Closes #NNN` per issue and no trailing period. A task shipped in slices carries them on its last slice only. `closing-issues.md` states how the list is decided, and `canon labels scan --closes` fails a body that disagrees with it.

### Context section

`## Technical context` is optional and carries 1-2 lines of architectural reasoning explaining why, not what.

- Omit Technical context for docs, config, or trivial changes
- Use bullet points for multiple reasons, one sentence for a single reason

### Testing section

`## Testing` is optional and names the exact commands or test cases run.

- Omit Testing for docs, config, or trivial sync changes
- Use checkboxes, never prose. See Testing discipline for which box gets ticked.

### Reviewer section and visuals

`## For the reviewer` is optional and lists what the reviewing session should confirm, one bullet per request.

- Visuals: include only when they clarify architecture, UI, or complex logic flows
- The list is closed, so a body carries nothing after its last section, including a trailer a harness appends once the body is composed
- `canon labels scan` fails a level-two heading outside the five above, and a body missing `## Summary` or `## Key changes`
- A review body and a release-please body are exempt

## Testing discipline

- Run the check before writing its line. A `- [ ]` reports a check that has not run rather than one that is planned.
- Tick the box and state the observed result. `- [x] npm test passes, 42 tests` beats `- [ ] run npm test`.
- Quote the count or output the run reported, never a figure carried from elsewhere.
- A ticked box describes the tree as it stands. A later commit removing or replacing what it names makes the box false.
- The branch that made that commit corrects the box in the same pass, as with any other stale claim in the body
- Leave the `UI pass` line to `canon pr tick`. It writes the line between its own marker and resets it on a new head, so never write or tick it by hand, and carry it forward when rewriting the body.

### Human-only boxes

Leave a box unchecked only when a human is required, and name which human and why on the same line. The agent runs everything else.

- Human-only covers visual or aesthetic judgment, credentials or a live third-party service, and a second machine or a fresh OS
- It also covers judgment about whether a boundary or an abstraction reads correctly
- A human is required by a capability the agent lacks, never the cost of the run. Authorizing a spend is the operator's and performing the run is not.
- An arm the repository ships a harness for gets driven once the operator has cleared the spend, and the box records what it returned
- A tool refusal that actually fired is a capability gap, and the line names the refusal rather than the cost. A refusal predicted and never met is not one.

### Live sessions and reviewer requests

A live agent session is never the human a box waits on.

- A live agent session is not a human. A box reading `needs a live session driving the skill` names the thing writing the description, so that run is owed rather than blocked.
- Put a request for the reviewer under `## For the reviewer`. It is a request rather than unfinished testing, so it never appears as an unchecked Testing box.

## Formatting

- End every bullet point with a period

## Examples

### Template

Every section a body may carry, in order.

```markdown
## Summary

<Action Verb> <Direct Object> to <Result>.

## Key changes

- <Verb> <specific component/file/function> (<reason if non-obvious>)
- <Verb> <specific component/file/function>

## Technical context

- <Architectural reasoning explaining why, not what>

## Testing

- [x] <Command run> <observed result>
- [x] <Edge case verified> <what was observed>
- [ ] <Human-only check> (<which human, why>)

## For the reviewer

- <What the reviewing session should confirm>
```

### Correct

Each line's comment names the rule it follows.

```markdown
## Summary

Update auth middleware to enforce jwt expiration checks. # imperative + direct object + result

## Key changes

- Add `verifyExpiration()` to `src/auth/validators.ts`. # specific function + file path
- Refactor `AuthService.authenticate()` to handle 401 codes. # named component + clear change

## Technical context

- Migration to stateless session management for horizontal scalability. # why, not what

## Testing

- [x] `npm run test:auth` passes, 42 tests. # command run + observed result
- [x] Expired token rejected with a 401 against a local server. # edge case + what happened
- [ ] Staging smoke test (release owner, needs staging credentials). # unchecked + which human + why

## For the reviewer

- Confirm the 401 and 403 split reads correctly for the public API. # a request, not a test result
```

### Incorrect

Each line's comment names the rule it breaks.

```markdown
## Summary

This PR updates the authentication system to be more robust. # "This PR" opener + buzzword

## Key changes

- Updated auth middleware files # vague, no specific component, no period
- The old system used to check tokens differently # describes historical behavior

## Testing

- Tested manually # no specific command or case
- [ ] `npm run test:auth` # unchecked box for a check the agent can run
- [ ] The reviewing session confirms the error split reads correctly # a reviewer request, belongs under `## For the reviewer`
```
