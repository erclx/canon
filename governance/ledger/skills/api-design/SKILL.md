---
title: API design skill ledger
description: Sources for claude/skills/api-design/SKILL.md, one row per bullet in its concern groups
---

# API design skill ledger

The field is interface design across functions, flags, file formats, and endpoints. Google's API Improvement Proposals and its engineering book carry compatibility, the IETF carries the error and deprecation formats, and Stripe's own docs carry idempotency. The closing sections and `## What this delegates` restate these rules or route, so they take no table.

## Decide what a caller can observe

| Bullet                                 | Source                                                                                                                                                                                                                                                             | Read       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| A shape built for the caller           | [agent-skills, API and interface design](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/skills/api-and-interface-design/SKILL.md): "Don't leak implementation details. If users can observe it, they will depend on it." | 2026-10-24 |
| Ordering, timing, and error text count | [Software Engineering at Google, ch. 1](https://abseil.io/resources/swe-book/html/ch01.html): "all observable behaviors of your system will be depended on by somebody", worked through hash iteration ordering                                                    | 2026-10-24 |
| As small as the first caller needs     | [AIP-180](https://google.aip.dev/180): new components "may be added to existing APIs in the same major version", while "Removing a component is a backwards incompatible change"                                                                                   | 2026-10-24 |
| One name for one concept               | [AIP-140](https://google.aip.dev/140): "APIs should endeavor to use the same name for the same concept and different names for different concepts"                                                                                                                 | 2026-10-24 |

## Write the contract first

| Bullet                             | Source                                                                                                                                                                                                                                                                         | Read       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| The signature before the body      | [agent-skills, API and interface design](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/skills/api-and-interface-design/SKILL.md): "Define the interface before implementing it. The contract is the spec"                           | 2026-10-24 |
| What it does, returns, and refuses | [agent-skills, API and interface design](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/skills/api-and-interface-design/SKILL.md): its contract names the refusal beside the return, "Returns a single task or throws NotFoundError" | 2026-10-24 |
| Machine output on its own channel  | [Command Line Interface Guidelines](https://clig.dev/): "Log messages, errors, and so on should all be sent to stderr", so piped commands never feed them "into the next command"                                                                                              | 2026-10-24 |
| The safe behavior is the default   | [Command Line Interface Guidelines](https://clig.dev/): "Confirm before doing anything dangerous", prompting interactively "or requiring them to pass -f or --force otherwise"                                                                                                 | 2026-10-24 |

## Keep one error shape per surface

| Bullet                           | Source                                                                                                                                                                                                                       | Read       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A stable code beside the message | [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html): consumers "MUST use the "type" URI" as "the problem type's primary identifier", and "Consumers SHOULD NOT parse the "detail" member for information"                | 2026-10-24 |
| No internals in the message      | [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html): generators "are encouraged to avoid making implementation details such as a stack dump available through the HTTP interface"                                        | 2026-10-24 |
| Reuse the project's error type   | [agent-skills, API and interface design](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/skills/api-and-interface-design/SKILL.md): "Pick one error strategy and use it everywhere" | 2026-10-24 |

## Validate at the boundary

| Bullet                        | Source                                                                                                                                                                                                                                        | Read       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Check once where input enters | [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/): checks spread through processing deprive "the program of the ability to reject invalid input instead of processing it"                          | 2026-10-24 |
| Trust the value inside        | [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/): shotgun parsing mixes checks "with and spread across processing code", hoping "one or another would catch all the "bad" cases"                  | 2026-10-24 |
| Parse into a typed value      | [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/): "Get your data into the most precise representation you need as quickly as you can. Ideally, this should happen at the boundary of your system" | 2026-10-24 |
| A value read back is input    | [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html): "Validate data from internal APIs, partner feeds, queues, and stored records when it crosses a trust boundary"        | 2026-10-24 |

## Change additively

| Bullet                                    | Source                                                                                                                                                                                                                           | Read       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Optional, with the old behavior default   | [AIP-180](https://google.aip.dev/180): code written against the previous surface "must continue to be treated the same way as before. New required fields must not be added"                                                     | 2026-10-24 |
| No rename or removal in place             | [AIP-180](https://google.aip.dev/180): "Renaming a component is semantically equivalent to "remove and add"", and a service "may add the new component, but must not remove the existing one"                                    | 2026-10-24 |
| No new meaning or type under a name       | [AIP-180](https://google.aip.dev/180): fields "must not have their type changed", and APIs "must not change visible behavior or semantics in ways that are likely to break reasonable user code"                                 | 2026-10-24 |
| One live version for an unpinned caller   | [Software Engineering at Google, ch. 16](https://abseil.io/resources/swe-book/html/ch16.html): "Developers must never have a choice of "What version of this component should I depend upon?"", named the One-Version Rule       | 2026-10-24 |
| Deprecation recorded where a caller looks | [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html): a response signals "that the resource will be or has been deprecated" and links "to a resource that provides further information about planned or existing deprecation" | 2026-10-24 |

## Make a retried write safe

| Bullet                                 | Source                                                                                                                                                                                                                                   | Read       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Answer a repeat with the stored result | [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests): "Stripe saves the status code and body of the first request made with a given idempotency key", and "Retries with the same key return the saved response" | 2026-10-24 |
| Claim the key atomically               | [Implementing Stripe-like idempotency keys in Postgres](https://brandur.org/idempotency-keys): a unique index on the key, locked "so that no other requests that might be operating concurrently also try the operation"                 | 2026-10-24 |
| A reused key with another body fails   | [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests): the layer "compares incoming parameters to those of the original request and errors if they're not the same to prevent accidental misuse"                 | 2026-10-24 |
| Keep the key past the retry window     | [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests): keys go once "at least 24 hours old", and "We generate a new request if a key is reused after the original is pruned"                                     | 2026-10-24 |
