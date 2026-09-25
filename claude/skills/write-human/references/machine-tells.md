---
title: Machine tells
description: Patterns that survive a clean ban scan, why each is invisible to a word set, and the fix for each
---

# Machine tells

Each pattern below is a shape rather than a token, so no closed word set matches it and the character scan `canon markdown audit` runs reports a clean exit over a passage carrying every one. Read this when revising text a model drafted, or when a passage passes the scan and still reads wrong.

Work top down. The first three account for most of what a reader calls machine-written.

## Rule of three

A triad wherever a list appears, whatever the subject actually holds. Three adjectives, three clauses, three examples, over and over, until the count is the only thing a reader can predict.

The tell is the regularity rather than the number. A subject with two parts gets a third invented to fill the shape, and a subject with five gets cut to three.

```markdown
Bad: The parser is fast, simple, and reliable.
Good: The parser reads 40k lines a second and has no configuration.
```

Fix by counting what the subject has and writing that many. A list of two is fine, and so is a list of six.

## Synonym cycling

One thing named four ways across a paragraph, on the belief that repeating a noun reads poorly. The reader then cannot tell whether `the handler`, `the callback`, `the listener`, and `the hook` are one thing or four.

```markdown
Bad: Register the handler. The callback receives the event, and the listener returns a promise.
Good: Register the handler. The handler receives the event and returns a promise.
```

Fix by picking one name per thing and repeating it. Repetition of a term is precision in reference prose.

## False ranges

`from X to Y` used over things that form no spectrum, which smuggles a claim of coverage the sentence cannot support.

```markdown
Bad: Everything from authentication to deployment.
Good: Authentication, schema migration, and deployment.
```

Fix by naming the members. Keep the range form where the endpoints bound a scale, such as a version range or a byte size.

## Inline-header lists

A bullet opening with a bold label and a colon, where the body then restates the label in a sentence. The shape looks organized and carries one fact per bullet instead of two.

```markdown
Bad: - **Caching**: Caching stores the response so the next request skips the fetch.
Good: - Caching stores the response, so the next request skips the fetch.
```

Fix by cutting the label when the sentence already names the subject. Keep the label where the bullets form a lookup table a reader scans by key.

## Adverb propping

An adverb carrying the weight the verb should. `significantly improves`, `dramatically reduces`, and `effectively handles` each name no amount and no mechanism.

```markdown
Bad: The index significantly improves query performance.
Good: The index cuts the median query from 400ms to 12ms.
```

Fix by replacing the adverb with the measurement, or by cutting it and leaving the verb alone.

## Passive voice with an unnamed actor

`it was decided`, `changes were made`, `the file is expected to be updated`. The actor is the fact the reader wanted, and the construction is what removes it.

```markdown
Bad: The threshold was raised after the incident.
Good: The on-call engineer raised the threshold after the incident.
```

Fix by naming who acts. Keep the passive where the actor is genuinely unknown or genuinely irrelevant, and say which.

## Closing restatement

A final sentence per section summarizing the section, at a higher altitude and with no new claim. In a short document every section then ends the same way.

Fix by cutting it. A section that needs a summary is too long, and the split is the answer.

## Question as transition

`So what does this mean?` or `Why does this matter?` standing alone between paragraphs. It addresses the reader as a participant and delays the answer by one line.

Fix by stating the answer as the next sentence.

## Escalating parallel clauses

`not only X but also Y`, and the longer chains built on it. The construction promises a second claim that outranks the first and usually delivers a restatement.

```markdown
Bad: The cache not only stores responses but also improves latency.
Good: The cache stores responses, which is what cuts latency.
```

Fix by writing the two claims as two sentences, or by cutting the one that repeats.

## Empty superlative frames

`one of the most important`, `a critical piece of`, `at the heart of`. The frame ranks a thing against a set the sentence never names.

Fix by stating what the thing does. A ranking survives only where the set is named and the position is measured.
