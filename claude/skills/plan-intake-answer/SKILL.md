---
name: plan-intake-answer
description: Walks an intake folder's unread items and puts them as batched questions in chat, writing each selection back onto the item it answers. Use when asked to "answer the intake", "work through the open items", "answer my intake questions", "go through the dump", or "let me answer these from here". Do NOT use to file a dump or write new items, which is `plan-intake`.
disable-model-invocation: true
metadata:
  family: decide
---

# Plan intake answer

Put an intake folder's unread items as batched questions, then land each selection in the slot it answers.

A folder is answered by opening each cluster file and typing under the item, which on a dump spanning six clusters means navigating to each in turn. This walks the same items in chat and writes the answers back, so the file rather than the conversation stays the record.

Read `${CLAUDE_SKILL_DIR}/../plan-intake/references/intake.md` before writing anything. It holds the item format and the answer contract this skill is bound by.

## Guards

- If `canon intake list --json` reports no folder, stop: `❌ No intake to answer. Run /plan-intake to file a dump first.`
- If the named folder has no unread item, stop: `❌ Every item in <slug> carries an answer. Nothing to ask.`
- Never fill a slot the operator did not answer. An abandoned batch leaves every unreached item unread, which is what the empty slot already means.
- Never infer an answer from the conversation having happened. A selection reaches the file through the verb or not at all.
- Do not promote an item, edit a verdict, or write outside the answer slots. Promoting runs through `task-board` after the answers land.

## Step 1: pick the folder

Run `canon intake list --json` and read the per-folder counts. With one folder carrying unread items, take it. With several, put the folders as one question carrying each slug and its unread count, and let the operator pick.

Never guess from the topic of the conversation. A session resuming against the wrong folder answers items nobody asked about.

## Step 2: collect one cluster

Run `canon intake list <slug> --unread --json`. It returns the unread items grouped by the cluster file holding them, each carrying its label, title, open question, and suggestion.

Work one cluster at a time, in the order the folder numbers them. A dump of six clusters holding five items each is thirty questions, and a surface putting all of them at once is unusable. The cluster boundary is also where an operator who runs out of attention stops cleanly, leaving whole clusters unread rather than one file half answered.

## Step 3: put the batch

Cap each batch at four items, which is what a structured question tool takes. A cluster carrying more than four unread items takes several batches in file order.

Every item with an empty slot is offered, not only the ones carrying an open question. An item with a verdict and no question is still asking whether the verdict stands, and the standard's one-token accept exists for exactly that case.

Shape each question from what the item carries:

- The item's label and title name the question, so the operator knows which item is being asked about
- An item carrying `Open:` puts that question with its `Suggested:` line ranked first and marked as the suggestion
- An item carrying no `Open:` puts its verdict, with accepting it ranked first as `ok` and the alternatives drawn from what the verdict could otherwise be

Give every option what it means and what it costs. An option with no stated cost is not an option, since the operator picks it without knowing what the other one buys.

Send the whole batch in one turn. When the session runs on a surface carrying a structured question tool, such as `AskUserQuestion` in Claude Code, send it through one call with one entry per item. Otherwise write it as a numbered list in one message with the suggestion marked.

## Step 4: write the batch back

Land every answered item in the cluster with one call:

```bash
canon intake answer <slug> --cluster <file> --set <label>=<answer> --set <label>=<answer>
```

One call per cluster, never one per item. Items are labeled per cluster file, so the label alone does not identify an item and the cluster travels with it. Four separate calls against one file also race on the read and drop every answer but the last.

Pass the label exactly as the heading spells it, including a letter suffix such as `3a`. Write the operator's selection as the answer, using `ok` for a verdict accepted as it stands.

The verb refuses an item that already carries an answer rather than overwriting it, and refuses the whole batch when any item in it is filled. A filled slot is a decision already made. On that refusal, drop the named item from the batch and send the rest.

An item the operator left unanswered is omitted from the call entirely. Do not pass it with an empty value, which writes a slot that reads as answered.

## Step 5: continue or stop

After each cluster, state how many clusters still carry unread items and continue to the next. Stop when the operator says to stop, and report what is left rather than pressing on.

Answers are on disk as each cluster completes, so a session ending mid-folder loses nothing.

## Output

Report per cluster as it lands, then close with the folder's state:

```plaintext
✅ <N> answered in <file>
<label>. <answer>

📋 <N> cluster(s) still carrying unread items in <slug>
```

Close the run with the path so the reader can open what changed:

```plaintext
✅ <N> answered across <N> cluster(s) in <slug>
<M> item(s) left unread
.canon/intake/<slug>/
```
