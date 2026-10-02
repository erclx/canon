---
name: api-design
description: Carries the rules for shaping what a caller of code can see and come to depend on, being a function's exports, a command's flags and output, a file format, an endpoint, or a module boundary, so a change keeps every existing caller working and exposes nothing by accident. Use when adding or changing a public function, a flag, an output shape, a schema, an error a caller handles, or a retried write, or when asked "is this a breaking change", "can I rename this field", "what should this return", "how do I make this safe to retry", or "how should I version this". Do NOT use for a visual interface, which is `design-taste`, to decide where a file sits, which is `codebase-layout`, or to list the consumers a finished change breaks during review, which is `review-craft`.
---

# API design

A session changing a surface sees the one caller it is working for and none of the others, so it renames a field in place, returns whatever record it had in hand, and ships. Every caller it did not open breaks on the next release. This skill carries the judgment at the moment the surface is drawn: what a caller can observe, what the contract says before the body exists, and how a change lands without breaking anyone.

Load it before changing anything a caller outside the module reads, whether code, a script parsing output, or a stored file. A surface is cheap to shape before its first caller and expensive after.

Skip it when the change stays behind an existing boundary and alters nothing a caller can observe.

## Decide what a caller can observe

Every observable behavior becomes a dependency once there are enough callers, whatever the contract promises, which is Hyrum's Law. Decide what is observable, and expose nothing by accident.

- Return a shape built for the caller over the internal record you had in hand. A storage type, an internal identifier, or a field kept for bookkeeping becomes a contract the moment it ships.
- Treat ordering, timing, default values, and the exact text of an error or a log line as observable. Sort output on purpose or say it is unordered, rather than leaving it in whatever order the data arrived.
- Keep the surface as small as the first caller needs. A field or flag added later is free, and one removed later breaks someone.
- Keep one name for one concept across every surface the project exposes. A caller learning `id` in one output and `key` in the next has to guess which is which.

## Write the contract first

- Write the signature, the flags, the output shape, or the schema before the body, and read it as the first caller would.
- Name what the surface does, what it returns, and what it refuses, in that order. A contract that only names the happy path leaves the refusal for a caller to discover.
- Make a machine-read output stable on its own channel, separate from anything written for a person, so wording changes to the person-facing text break no parser.
- Make the safe behavior the default. A caller who passes nothing gets the behavior that loses no data.

## Keep one error shape per surface

- Give every failure on one surface the same shape, carrying a stable code a caller can branch on and a message for the person reading it. Branching on message text breaks the first time the message is reworded.
- Follow the project's own rule on structured errors and hidden internals where it states one, rather than inventing a second error convention beside it.

## Validate at the boundary

- Check input where it enters the surface, once, and reject it with the error shape above before any work starts.
- Trust the value inside once the boundary has checked it. A check repeated deeper in means two places to update, and they drift apart.
- Parse into a typed value at the boundary over passing the raw input inward and checking it piecemeal.
- Treat a value read back from a file, a queue, or another service as input, since it crossed a boundary on its way in.

## Change additively

- Add a field, a flag, or a parameter as optional, with a default that keeps the old behavior.
- Never rename or remove anything in place. Add the new name beside the old one, keep both working, and remove the old one only once no caller reads it.
- Never change what an existing field means or what type it carries. A new meaning takes a new name.
- When a caller cannot pin a version, such as a module everything in one repository imports, keep one version of the surface live and migrate every caller in the change that alters it, the One-Version Rule. Two versions live side by side split the callers between them.
- Record each deprecation where a caller looks, naming the replacement and what happens next, rather than in a commit message nobody reads again.

## Make a retried write safe

A caller retries whenever it does not hear back, so a write that can be retried has to land once however many times it arrives.

- Take an idempotency key from the caller on any write a retry could repeat, store it with the result, and answer a repeat with the stored result rather than running the write again.
- Claim the key in one atomic step under a unique constraint, never a read followed by a write, since two concurrent retries both pass the read.
- Fail loudly on a reused key carrying a different body. Returning the stored result there hides a caller bug as a success.
- Keep a key for longer than the longest retry window any caller uses, or a late retry lands as a second write.

Read `${CLAUDE_SKILL_DIR}/references/adopted.md` only when extending this guidance or arguing against a rule in it. It records which external sources were adopted, which declined, and why.

## Excuses and rebuttals

| Excuse                                                       | Rebuttal                                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Nobody depends on that field                                 | You can see the callers you opened. A script parsing the output or a project importing the module is the one you did not.                   |
| It's internal, so renaming it is fine                        | Internal to whom? If anything outside the module reads it, it is a surface. Add the new name beside the old.                                |
| The old name is wrong, so keeping it is clutter              | Clutter costs a line. A rename breaks every caller you did not open, and they learn about it from a failure.                                |
| Returning the record directly saves a mapping                | The mapping is the contract. Without it, a change to the storage layout is a breaking change to every caller.                               |
| The caller already validates, so checking again is redundant | The boundary checks once for every caller, including the next one, which may not.                                                           |
| Retries are rare, so the write does not need a key           | Rare is a duplicate charge, a double send, or a second row once a week. The key is cheaper than the cleanup.                                |
| The error message is clear, so callers can match on it       | A message is written for a person and reworded freely. Give the caller a code it can branch on.                                             |
| I'll update every caller in this change, so renaming is safe | That holds only when every caller lives in the change. Check that no caller outside the repository reads the surface before you rely on it. |

## Red flags

- A field, flag, or exported name is being renamed or removed in the diff, with nothing added beside it.
- A function returns the object it read from storage, or a type defined beside the storage code.
- The same input check appears both at the entry point and inside a function it calls.
- A caller matches on the text of an error message.
- An existing field is changing type or meaning under the same name.
- A write that a client could retry carries no key, or checks for one with a read before the insert.
- Output order follows whatever the underlying data returned, and nothing states whether it is sorted.

## Before handing over

Check each line against the surface the change produced. A line answering no is fixed or reported, never left with a note.

- Every caller that worked before the change still works without editing, or the change migrates each one in the same diff.
- Every new field, flag, or parameter is optional and defaults to the old behavior.
- No storage type, internal identifier, or bookkeeping field appears in what the surface returns.
- Every failure on the surface carries the same shape with a stable code.
- Input is checked once, at the boundary, and nowhere deeper.
- Every write a caller could retry takes a key, claims it atomically, and refuses a reused key with a different body.
- The contract states what the surface returns and what it refuses.

## What this delegates

- Where the file holding a surface sits on disk: `codebase-layout`
- The structured error rule and hidden internals floor every code stack loads: `000-code`
- Listing the consumers a finished change breaks, and the docs it made false, during review: `review-craft`
- A visual interface, its layout, and its look: `design-taste`
- Interface depth and the internals behind a boundary: `code-craft`
