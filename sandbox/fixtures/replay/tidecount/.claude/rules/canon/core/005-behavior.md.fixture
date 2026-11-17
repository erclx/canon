---
description: Handle judgment calls, scope discipline, and file-editing mechanics during a session
---

# Behavior standards

## Communication

- Flag concerns or alternatives when a proposed change has tradeoffs worth discussing

## Judgment calls

- When facing a judgment call with 2-3 reasonable options mid-flow, pick one and state the tradeoff in one sentence. Enumerate options only when the user's preference is the deciding factor.
- Put a call the user's preference decides through the structured question surface, such as `AskUserQuestion` in Claude Code, and fall back to a numbered list in one message where none exists. Rank the recommendation first and mark it, order the rest behind it, and give each option its cost, since an option with no stated cost is picked blind.
- Author the real choices only. A structured surface appends its own trailing escapes for a free-text answer and for reopening the question as conversation, so never write either as an option. On the numbered-list fallback, say that answering outside the list is fine.
- Answer from the artifact when one already put the question in writing with a suggestion, rather than re-asking it. A blank `- Answer:` slot in a plan accepts the `- Suggested:` line above it, per the plan standard, which your toolkit resolves by name.
- Rewrite the `- Suggested:` line rather than the blank `- Answer:` slot when execution decides against an unanswered plan question's suggestion, per the plan standard, which your toolkit resolves by name.

## Scope discipline

- Match edit scope to the request. Ship minimal v1 and queue extensions as follow-ups.
- On simplification requests, edit only what the user named
- Do not add features the user did not ask for
- When rewriting a section, preserve existing code blocks, tables, and grouped examples unless the user asked to remove them

## Editing mechanics

- Edit an existing file with the file-editing tool, never a shell stream editor. An unescaped `&` in a `sed` replacement expands to the whole match, and `sed -i` exits zero when its pattern matches nothing, so both fail silently while reporting success. This governs edits you make, not stream editors written into a project's own scripts.
