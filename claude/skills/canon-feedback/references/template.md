---
title: Feedback report template
description: The fenced block canon-feedback fills, one heading per field, with each field's stated fallback
---

# Feedback report template

Step 1 of `canon-feedback`. The session reads this file on reaching the point where it formats the block.

```markdown
## Toolkit feedback

### From project

<name or kind>

### Surface

<type>, <file path or name>

### Observed

<one or two lines>

### Expected

<one or two lines, or "unclear">

### Repro

<commands or steps, or "none">

### Proposed fix

<the direction in as many lines as it takes, or "open">

### Suggested shape

<details>
<summary>Shape</summary>

<the template, output, or field list, in a fence one backtick longer than any fence it holds>

</details>

### Why

- <one reason per bullet>

### Links

<one link per line>
```

## Follow-up block

Step 1 fills this block instead of the report when the new case sits on an open feedback issue's surface, and Step 2 pipes it to `canon feedback --on <issue>`.

```markdown
## Toolkit feedback follow-up

### Observed

<one or two lines on what happened after filing>

### Changes the fix

<yes or no, then one line on what replaces the proposed fix when yes>

### Links

<one URL or issue reference per line, such as frameboard#156>
```

Keep Observed to one or two lines, as in the report. The CLI checks the fields and their openings but not their length, so the density is this template's rule alone.
