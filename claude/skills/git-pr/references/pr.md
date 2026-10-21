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

- `## Summary`: one paragraph following `<Action Verb> <Direct Object> to <Result>`, then the closing lines
- `## Key changes`: bullets only, one change each, naming actual files, functions, or modules (e.g., `AuthService.verify()` not "auth handler")
- Name every changed path in a Key changes bullet. A trim may cut a clause and never a path, since `canon pr key-changes` reports a path no bullet claims.

### Key changes groups

Past 5 bullets, group Key changes under bold labels, 5 bullets a group at most.

- A label sits on its own line, names the area a reviewer opens together, and ends with no period
- Write a label in plain words, since a code span inside bold renders unbolded
- Open each group on a bullet, never on prose

### Closing lines

The closing lines end `## Summary`, one `Closes #NNN` per issue and no trailing period, and a sliced task carries them on its last slice. `closing-issues.md` decides the list. A fan-in member line sits above them, per `${CLAUDE_SKILL_DIR}/../auto-ship/references/fan-in.md`.

### Context section

`## Technical context` is optional and says why, naming the decisions the code can't show and any shortcoming of the approach.

- Omit Technical context for docs, config, or trivial changes
- Take one form per section, never bullets and paragraphs mixed
- Use bullets when every reason fits one sentence under 200 characters
- Otherwise write one paragraph per decision, opening on a bold lead-in that ends with a period and runs into the paragraph

### Testing section

`## Testing` is optional and names the exact commands or test cases run.

- Omit Testing for docs, config, or trivial sync changes
- Use checkboxes, never prose. See Testing discipline for which box gets ticked.
- Write one box per command, pointing at a test file rather than listing its cases

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

Leave the `UI pass` line to `canon pr tick`, and carry it on a rewrite.

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
- Carry no H3 or H4 anywhere in a body. GitHub draws an H3 one step under an H2, so stacked H3s compete with the sections.
- Group with a bold label or lead-in instead, in the forms the Sections rules above state

### Density

`canon labels scan` fails on a density finding, naming the section, the kind, and the line in the whole body under `density`. Its help lists every limit.

- Every section but Testing holds bullets to 200 characters and 5 in a row, and paragraphs to 350 characters and 2 in a row
- Any section reports a `subheading`, and Technical context reports a `mixed-form`
- A bold label alone on a line breaks a Key changes run, and a bold lead-in starts a new Technical context run
- Fix a finding by regrouping or splitting, never by cutting a path

## Examples

### Template

Every section a body may carry, in order.

```markdown
## Summary

<Action Verb> <Direct Object> to <Result>.

Closes #<number>

## Key changes

**<Area a reviewer opens together>**

- <Verb> <specific component/file/function> (<reason if non-obvious>)
- <Verb> <specific component/file/function>

**<Next area>**

- <Verb> <specific component/file/function>

## Technical context

**<Decision in a few words>.** <Why this approach, what the code can't show, and any shortcoming>

**<Next decision>.** <Why>

## Testing

- [x] <Command run> <observed result>
- [x] <Test file run> <observed result>
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

**Validation** # bold label on its own line, no period

- Add `verifyExpiration()` to `src/auth/validators.ts`. # specific function + file path
- Add the clock skew window to `src/auth/config.ts`. # one change per bullet

**Session handling** # one label per area a reviewer opens together

- Refactor `AuthService.authenticate()` to handle 401 codes. # named component + clear change

## Technical context

**Stateless sessions.** Expiry lives in the token, so any instance can reject it without a shared store. # bold lead-in + why

**Clock skew.** A 30-second window absorbs drift between instances, so a token can outlive its expiry by that much. # decision + shortcoming

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

### Middleware # H3 inside a body

- Updated auth middleware files # vague, no specific component, no period
- The old system used to check tokens differently # describes historical behavior

## Technical context

- Tokens are stateless now. # a bullet

The skew window trades precision for no shared store. # mixed with a paragraph in one section

## Testing

- Tested manually # no specific command or case
- [ ] `npm run test:auth` # unchecked box for a check the agent can run
- [ ] The reviewing session confirms the error split reads correctly # a reviewer request, belongs under `## For the reviewer`
```
