---
title: Pull request examples
description: The body template holding every section in order, and a correct and an incorrect body with the rule each line follows or breaks
---

# Pull request examples

The rules each example follows sit in `pr.md` beside this file.

## Template

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

## Outcome

<The command that produces the shape, in a console fence, each line opening on $>

<Its record, in a json fence laid out as jq . prints it, with placeholders for the values>

<The result it writes, in a fence of its own kind such as markdown or yaml>

## Testing

- [x] <Command run> <observed result>
- [x] <Test file run> <observed result>
- [ ] <Human-only check> (<which human, why>)

## For the reviewer

- <What the reviewing session should confirm>
```

## Correct

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

## Incorrect

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
