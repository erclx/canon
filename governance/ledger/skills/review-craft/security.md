---
title: Review craft security ledger
description: Sources for claude/skills/review-craft/references/security.md, one row per bullet
---

# Review craft security ledger

The field is application security review. MITRE's CWE entries name each weakness, ShellCheck carries the shell fixes, npm's own docs and Snyk's lockfile write-up carry the supply chain, and Anthropic's security review action pinned at `anthropics/claude-code-security-review@0c6a49f1` carries the exclusions.

The threat model section and the classes stated as prose carry no bullet, so they take no row.

## Classes to check

| Bullet                               | Source                                                                                                                                                                                                                                                                        | Read       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The paths into a shell               | [CWE-78, OS Command Injection](https://cwe.mitre.org/data/definitions/78.html): "The product constructs all or part of an OS command using externally-influenced input from an upstream component, but it does not neutralize or incorrectly neutralizes special elements"    | 2026-10-24 |
| Quoting at the call site             | [ShellCheck, SC2086](https://github.com/koalaman/shellcheck/wiki/SC2086): "Double quote to prevent globbing and word splitting."                                                                                                                                              | 2026-10-24 |
| An empty value collapsing to a root  | [ShellCheck, SC2115](https://github.com/koalaman/shellcheck/wiki/SC2115): "Use `\"${var:?}\"` to ensure this never expands to `/*`", against `rm -rf "$STEAMROOT/"*`                                                                                                          | 2026-10-24 |
| A glob or symlink carrying it out    | [CWE-59, Link Following](https://cwe.mitre.org/data/definitions/59.html): "does not properly prevent that filename from identifying a link or shortcut that resolves to an unintended resource"                                                                               | 2026-10-24 |
| No check one level below a root      | [agent-skills, security-and-hardening](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/skills/security-and-hardening/SKILL.md): the resolved target "sits under an allowlisted root", and "it is at least one level below that root" | 2026-10-24 |
| No read of what is there             | [agent-skills, security-and-hardening](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/skills/security-and-hardening/SKILL.md): the target "carries ownership evidence read before the operation"                                    | 2026-10-24 |
| Name the class whose fix applies     | House choice: one bug filed under two classes gets two fixes or neither, so the finding names the class whose fix the author applies                                                                                                                                          | 2026-10-24 |
| Unpinned one-shot package execution  | [npm, npx](https://docs.npmjs.com/cli/v10/commands/npx): a package "not present in the local project dependencies" is installed to the npm cache and run, so an unpinned name runs whatever the registry serves                                                               | 2026-10-24 |
| A new dependency's install scripts   | [npm, scripts](https://docs.npmjs.com/cli/v10/using-npm/scripts): its life cycle order runs `preinstall`, `install`, and `postinstall` on `npm install`                                                                                                                       | 2026-10-24 |
| A lockfile changing with no manifest | [Snyk, Why npm lockfiles can be a security blindspot](https://snyk.io/blog/why-npm-lockfiles-can-be-a-security-blindspot-for-injecting-malicious-modules/): an install "will consult the lockfile as the primary source of truth for package versions and their sources"      | 2026-10-24 |

## Excluded

| Bullet                                   | Source                                                                                                                                                                                                                                                                                  | Read       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Denial of service and exhaustion         | [Anthropic, claude-code-security-review prompts](https://github.com/anthropics/claude-code-security-review/blob/0c6a49f1fa56a1d472575da86a94dbc1edb78eda/claudecode/prompts.py): "Denial of Service (DOS) vulnerabilities or resource exhaustion attacks", and "Rate limiting concerns" | 2026-10-24 |
| Generic input validation                 | [Anthropic, claude-code-security-review prompts](https://github.com/anthropics/claude-code-security-review/blob/0c6a49f1fa56a1d472575da86a94dbc1edb78eda/claudecode/prompts.py): "If there isn't a proven problem from a lack of input validation, don't report it."                    | 2026-10-24 |
| Open redirects                           | [Anthropic, claude-code-security-review findings filter](https://github.com/anthropics/claude-code-security-review/blob/0c6a49f1fa56a1d472575da86a94dbc1edb78eda/claudecode/findings_filter.py): drops a finding as "Open redirect vulnerability (not high impact)"                     | 2026-10-24 |
| A theoretical attack needing access held | [Anthropic, claude-code-security-review prompts](https://github.com/anthropics/claude-code-security-review/blob/0c6a49f1fa56a1d472575da86a94dbc1edb78eda/claudecode/prompts.py): "Skip theoretical issues, style concerns, or low-impact findings"                                      | 2026-10-24 |
