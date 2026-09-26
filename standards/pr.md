---
title: Pull request reference
description: Pull request title and body conventions
---

# Pull request reference

## Scope

Governs a pull request title and body: their format and the sections the body carries.

Does not govern:

- Commit subject format, which shares the title form: `commit.md`
- Branch naming: `branch.md`
- Whether a phase label or a semver tag may appear in a title or body: `versioning.md`
- Whether a quoted label, a gitignored record path, or a link to one Claude Code session may appear in a title or body, which `canon labels scan` fails on: `publish.md`
- Voice, rhythm, and sentence construction in pull request prose: the `write-human` skill
- Punctuation and formatting in pull request prose: `markdown.md`

## Title

- Format: `<type>(<scope>): <subject>`, with `!` before the colon for a breaking change
- Casing: lowercase for `<type>`, `<scope>`, and first word of `<subject>`
- Length: 72 characters maximum

## Content

- Use imperative mood for all content (`add`, `fix`, `refactor`)
- Do not start with "This PR," "This commit," "Included are," or "I have"
- Do not use buzzwords (`seamless`, `robust`, `game-changer`, `enhanced`)
- Do not describe historical behavior or unchanged code. Describe new behavior only.
- Do not include future promises or speculative documentation
- Do not explain obvious changes (formatting, renaming variables)
- Do not duplicate commit messages verbatim

## Sections

- `## Summary`: 1-2 sentences following `<Action Verb> <Direct Object> to <Result>`, expand for clarity if needed
- `## Key Changes`: name actual files, functions, or modules (e.g., `AuthService.verify()` not "auth handler"). Always use bullet points, never prose.
- `## Technical Context` (optional): 1-2 lines of architectural reasoning explaining why, not what
- Omit Technical Context for docs, config, or trivial changes
- Use bullet points for multiple reasons, one sentence for a single reason
- `## Testing` (optional): specify exact commands or test cases run
- Omit Testing for docs, config, or trivial sync changes
- Use checkboxes, never prose. See Testing discipline for which box gets ticked.
- `## For the reviewer` (optional): what the reviewing session should confirm, one bullet per request
- Visuals: include only when they clarify architecture, UI, or complex logic flows
- The list is closed. A body carries the sections above and nothing after the last of them, which covers a trailer a harness appends once the body is composed. `publish.md` states the rule, and `canon labels scan` fails on the one such trailer measured so far.

## Testing discipline

- Run the check before writing its line. A `- [ ]` reports a check that has not run rather than one that is planned.
- Tick the box and state the observed result. `- [x] npm test passes, 42 tests` beats `- [ ] run npm test`.
- Quote the count or output the run reported, never a figure carried from elsewhere.
- A ticked box describes the tree as it stands, not as it stood when it was written. A later commit that removes or replaces what it names makes the box false, and the branch that made that commit corrects it in the same pass, the same as any other stale claim in the body.
- Leave a box unchecked only when a human is required, and name which human and why on the same line.
- Human-only covers visual or aesthetic judgment, anything needing credentials or a live third-party service, anything needing a second machine or a fresh OS, and judgment about whether a boundary or an abstraction reads correctly. The agent runs everything else.
- What makes a human required is a capability the agent lacks, never the cost of the run. Authorizing a spend is the operator's and performing the run is not, so an arm the repository ships a harness for gets driven once the operator has cleared the spend, and the box records what it returned.
- A tool refusal that actually fired is a capability gap, and the line says which refusal rather than naming the cost behind it. A refusal predicted and never met is not one.
- A live agent session is not a human. A box reading `needs a live session driving the skill` names the thing writing the description, so that run is owed rather than blocked.
- Put a request for the reviewer under `## For the reviewer`. It is a request rather than unfinished testing, so it never appears as an unchecked Testing box.

## Formatting

- End every bullet point with a period

## Examples

### Template

```markdown
## Summary

<Action Verb> <Direct Object> to <Result>.

## Key Changes

- <Verb> <specific component/file/function> (<reason if non-obvious>)
- <Verb> <specific component/file/function>

## Technical Context

- <Architectural reasoning explaining why, not what>

## Testing

- [x] <Command run> <observed result>
- [x] <Edge case verified> <what was observed>
- [ ] <Human-only check> (<which human, why>)

## For the reviewer

- <What the reviewing session should confirm>
```

### Correct

```markdown
## Summary

Update auth middleware to enforce jwt expiration checks. # imperative + direct object + result

## Key Changes

- Add `verifyExpiration()` to `src/auth/validators.ts`. # specific function + file path
- Refactor `AuthService.authenticate()` to handle 401 codes. # named component + clear change

## Technical Context

- Migration to stateless session management for horizontal scalability. # why, not what

## Testing

- [x] `npm run test:auth` passes, 42 tests. # command run + observed result
- [x] Expired token rejected with a 401 against a local server. # edge case + what happened
- [ ] Staging smoke test (release owner, needs staging credentials). # unchecked + which human + why

## For the reviewer

- Confirm the 401 and 403 split reads correctly for the public API. # a request, not a test result
```

### Incorrect

```markdown
## Summary

This PR updates the authentication system to be more robust. # "This PR" opener + buzzword

## Key Changes

- Updated auth middleware files # vague, no specific component, no period
- The old system used to check tokens differently # describes historical behavior

## Testing

- Tested manually # no specific command or case
- [ ] `npm run test:auth` # unchecked box for a check the agent can run
- [ ] The reviewing session confirms the error split reads correctly # a reviewer request, belongs under `## For the reviewer`
```
