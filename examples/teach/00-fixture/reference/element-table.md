---
title: Element table
description: Every placeholder element the fixture lessons render, in one table
---

# Element table

A placeholder reference page with no real subject, built to give the rendered reference surface something to render against.

## Elements

| Element | Lesson                    | Holds                             |
| ------- | ------------------------- | --------------------------------- |
| Alpha   | `0001-alpha-element.html` | A table and a three-question quiz |
| Beta    | `0002-beta-element.html`  | A figure and a two-question quiz  |
| Gamma   | `0003-gamma-element.html` | Lists and a two-question quiz     |

## Source samples

Fenced blocks render highlighted on this page. A placeholder config:

```yaml
elements:
  - name: alpha # the first lesson
    quiz: 3
```

And a placeholder image:

```dockerfile
FROM oven/bun:1
COPY . /app
RUN bun install
```

## Reading order

Read the lessons in their ordinal order, then return here to look an element up by name. The [glossary](../GLOSSARY.md) defines each term once.
