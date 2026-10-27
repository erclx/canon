---
name: plan-intake-answer
description: Walks an intake folder's unread items and puts them as batched questions in chat, writing each selection back onto the item it answers. Use when asked to "answer the intake", "work through the open items", "answer my intake questions", "go through the dump", or "let me answer these from here". Do NOT use to file a dump or write new items, which is `plan-intake`. Do NOT auto-trigger.
metadata:
  family: decide
---

# Plan intake answer

Put an intake folder's unread items as batched questions, then land each selection in the slot it answers.

This walks the items in chat rather than file by file, and writes the answers back so the file rather than the conversation stays the record.

## Contract

Read `${CLAUDE_SKILL_DIR}/../plan-intake/references/intake.md` before writing anything. It holds the item format and the answer contract this skill is bound by.

## Guards

- If `canon intake list --json` reports no folder, stop: `❌ No intake to answer. Run /plan-intake to file a dump first.`
- If the named folder has no unread item, stop: `❌ Every item in <slug> carries an answer. Nothing to ask.`
- Never fill a slot the operator did not answer. An abandoned batch leaves every unreached item unread, which is what the empty slot already means.
- Never infer an answer from the conversation having happened. A selection reaches the file through the verb or not at all.
- Do not promote an item, edit a verdict, or write outside the answer slots, bar the close Step 5 offers on an explicit yes. Promoting runs through `task-board` after the answers land.

## Step 1: pick the folder

Run `canon intake list --json` and read the per-folder counts. With one folder carrying unread items, take it. With several, put the folders as one question carrying each slug and its unread count, and let the operator pick.

Never guess from the topic of the conversation. A session resuming against the wrong folder answers items nobody asked about.

## Step 2: collect one cluster

Run `canon intake list <slug> --unread --json`. It returns the unread items grouped by the cluster file holding them, each carrying its label, title, `problem`, `fix`, open question, and suggestion. The `problem` and `fix` fields are absent on an item that lacks the line, so write the lead-in from whichever are present.

Work one cluster at a time, in the order the folder numbers them. A dump of six clusters holding five items each is thirty questions, and a surface putting all of them at once is unusable. The cluster boundary is also where an operator who runs out of attention stops cleanly, leaving whole clusters unread rather than one file half answered.

## Step 3: put the batch

Cap each batch at four items, which is what a structured question tool takes. A cluster carrying more than four unread items takes several batches in file order.

Offer every item with an empty slot, not only the ones carrying an open question. An item with a verdict and no question still asks whether the verdict stands, which is what the standard's one-token accept is for.

| Item carries | Question shape                                                                  |
| ------------ | ------------------------------------------------------------------------------- |
| Label, title | Name the question, so the operator knows which item is being asked about        |
| `Open:`      | That question, with its `Suggested:` line ranked first and marked as suggestion |
| No `Open:`   | Its verdict, with `ok` ranked first and alternatives from what it could be      |

Open every question with a lead-in of one to three plain sentences, written fresh from `problem`, `fix`, and `open` for an operator who has not opened the file. It says what is wrong today, what the fix is, and what the call is, condensing a long `problem` rather than pasting it.

- An item with no `fix` still states the problem and the call, and one with no `Open:` says what the verdict accepts
- As filed, "which hooks take it" means nothing lifted out of the Fix line it was written under
- With a lead-in: "Claude Code 2.1.295 lets a hook fail closed. A crashed `scratch-guard.sh` lets writes through, and the fix sets `onFailure: "block"`. Should `unattended-agent-guard.sh` get it too?"

Give every option what it means and what it costs. An option with no stated cost is not an option, since the operator picks it without knowing what the other one buys.

Send the whole batch in one turn. When the session runs on a surface carrying a structured question tool, such as `AskUserQuestion` in Claude Code, send it through one call with one entry per item. Otherwise write it as a numbered list in one message with the suggestion marked.

## Step 4: write the batch back

Land every answered item in the cluster with one call:

```bash
canon intake answer <slug> --cluster <file> --set <label>=<answer> --set <label>=<answer>
```

- Make one call per cluster, never one per item. Labels are per cluster file, so the cluster travels with the label, and separate calls against one file race and drop every answer but the last.
- Pass the label exactly as the heading spells it, including a letter suffix such as `3a`
- Write the operator's selection as the answer, using `ok` for a verdict accepted as it stands
- Omit an unanswered item from the call. An empty value writes a slot that reads as answered.

The verb refuses the whole batch when any item in it already carries an answer, since a filled slot is a decision already made. On that refusal, drop the named item and send the rest.

## Step 5: offer to close declined issues

Run this after Step 4 lands a cluster, over the items that batch just answered. Closing is a public write, so each close waits on a yes given for that issue.

An item qualifies when both hold:

- The answer's first word is `decline`. Whatever follows it, as in `decline, but ask frameboard first`, stays on the item and still qualifies.
- The title ends in `(#NNN)`. Read that trailing number alone, so a title naming two issues, or a number sitting in prose, gets no offer.

Skip the whole step and say why when `gh auth status` fails or `gh` is absent. The answers already landed stay.

For each qualifying item:

1. Run `gh issue view <NNN> --json state --jq .state`. When it reads `CLOSED`, name the issue as already closed and offer nothing.
2. Draft the comment as one or two sentences condensed from the item's `problem` and `fix`, giving the reason and a pointer to what covers it.
3. Run the scan in `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md` against the draft, since nothing else checks text on its way to the remote.
4. Show the draft and ask for a yes or no on that issue in the same turn, through the question surface Step 3 used.
5. On a yes, close with the draft passed through a quoted heredoc. On a no, or no answer, leave the issue open.

```bash
gh issue close <NNN> --reason "not planned" --comment "$(cat <<'EOF'
<comment>
EOF
)"
```

The quoted heredoc matters because `problem` and `fix` carry file paths in code spans. Inside a double-quoted argument the shell would run each backtick pair as a command and post a comment with the paths missing.

Never carry a yes from one issue or one turn to another.

## Step 6: continue or stop

After each cluster, state how many clusters still carry unread items and continue to the next. Stop when the operator says to stop, and report what is left rather than pressing on.

Answers are on disk as each cluster completes, so a session ending mid-folder loses nothing.

## Output

Report per cluster as it lands, then close with the folder's state:

```plaintext
✅ <N> answered in <file>
<label>. <answer>
🔒 Closed #<NNN>, or left open: #<NNN>

📋 <N> cluster(s) still carrying unread items in <slug>
```

Omit the 🔒 line for a cluster that offered no close.

Close the run with the path so the reader can open what changed:

```plaintext
✅ <N> answered across <N> cluster(s) in <slug>
<M> item(s) left unread
.canon/intake/<slug>/
```
