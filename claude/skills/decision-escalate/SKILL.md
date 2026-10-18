---
name: decision-escalate
description: Collects every open decision whose answer turns on the operator's preference, since only they know what they need, puts them as one batch of questions each carrying options and a recommended default, then waits. Use when asked to "escalate this", "ask me the open questions", "batch the open decisions", "what do you need from me", or "stop and ask before you pick". Do NOT use for a judgment call the session can settle, which is a pick with the tradeoff stated in one sentence. Do NOT auto-trigger.
metadata:
  family: decide
---

# Decision escalate

Put every open decision that belongs to the operator as one batch, each carrying its options and a recommended default, then stop until the batch is answered.

One batch is the whole point. A session that asks one question, acts, then asks the next spends the operator's attention once per decision and hides how many are open.

## Guards

- If nothing is open, stop: `❌ Nothing to escalate. Every open call is one this session can make.`
- Escalate only a decision whose answer turns on the operator's preference. A judgment call the session can weigh between two or three options is a pick taken without asking, its tradeoff in a sentence.
- Escalate only what is open now. A decision already taken this session goes to the artifact that records it rather than back to the operator.
- Do not act on any decision in the batch before it is answered. Continue the work that depends on none of them.
- Do not escalate a question the session can answer by reading the repository. Read first, and escalate what the tree does not settle.

## Step 1: collect what is open

Sweep the session for every decision still unmade. The usual sources:

- A plan question whose answer turns on preference rather than measurement
- A fork the session parked to keep moving, where both branches still ship
- A default the session took silently that changes what the operator receives
- A scope boundary the request left ambiguous, where the two readings produce different work

Drop anything the session can settle. What survives is the batch.

## Step 2: shape each question

Each entry carries a short header naming the axis, the question itself, and two to four options. `CLAUDE.md` states what an option carries and how the set is ranked, so follow it rather than a second copy here. The header is what a batch adds. An operator scanning four questions needs an axis on each to tell one from the next.

Cap the batch at four. A structured question tool takes four, and a batch past that is a session asking to be redesigned rather than answered. When more than four are open, send the four blocking the most work and say in one line how many are held.

## Step 3: put the batch

Put every question in one turn, never splitting the batch across turns or asking the first while the rest stay unstated. Send the batch through a structured question tool wherever the session runs on one, and write the shape below where it does not. One call carries the whole set, one entry per decision, so the operator answers them together.

The test is the surface rather than the project's instruction file. A target scaffolded before the rule shipped still reaches the tool, and loses only the option shape `CLAUDE.md` states, which the example below carries.

### The fallback shape

Batch shape on the fallback surface:

```plaintext
<N> open decisions. <M> held.

1. <axis>: <question>
   a. <option> (recommended): <what it means>, <what it costs>
   b. <option>: <what it means>, <what it costs>

2. <axis>: <question>
   a. <option> (recommended): <what it means>, <what it costs>
   b. <option>: <what it means>, <what it costs>
```

## Step 4: wait

Stop after the batch. Do not answer on the operator's behalf, do not act on the recommendation because it is the recommendation, and do not fill the wait with work the batch would invalidate.

An operator who answers some and not others has answered those. Continue on the answered ones and hold the rest.

## Step 5: record and continue

Restate each pick in one line, then continue the work.

A pick that changes a written artifact goes into it under the rule its own standard sets, and a pick that settles nothing written stays in the session.

- Record an answer to an open plan question per `### Overrides and settled questions` in `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`

Output after the answers land:

```plaintext
✅ <N> decisions answered
<axis>: <pick>
<axis>: <pick>
<M held, restated in one line each>
```
