---
title: Slides Engine Showcase
variant: light
---

# Slides Engine Showcase

layout: title

One markdown source, one render command, every layout sized to the topic.

---

# Contents

layout: toc

---

# The format

layout: section

---

# What the engine gives you

layout: bullets

- One SLIDES.md source of truth, hand edited and committed
- A layout per slide, picked from a runtime catalog
- One warm palette with a light and a dark variant
- A contents slide and a footer that link every slide back
- Render to PowerPoint, inspect, ship

---

# Authoring

layout: section

---

# Source versus render

layout: two-column

## Markdown source

- Plain text, diff friendly
- Lives in the repo
- Owns the content

## PowerPoint render

- Regenerated on demand
- Gitignored under review
- Owns the presentation

---

# By the numbers

layout: section

---

# Numbers that matter

layout: stat-callout

- 9 : layouts in the catalog
- 1 : source file per deck
- 5 : theme colors read from the design module
- 2 : variants from one token set

---

# Layout families

layout: grid

- **Title and section** : Cover the deck and divide it into chapters
- **Bullets and columns** : Carry the dense explanatory slides
- **Stat and grid** : Land numbers and compact comparisons
- **Quote and contents** : Close with a voice and navigate the deck

---

# When the catalog runs out

layout: freeform

- rect x=0.7 y=1.7 w=5 h=3 color=surface
- text x=0.9 y=1.9 w=4.6 h=2.6 color=ink: freeform reads a position, a size, and a color straight from the line, with no layout algorithm in between
- rect x=6.5 y=1.7 w=6.1 h=3 color=accent

---

# The closing thought

layout: quote

Code is free. Context and human attention are scarce.

- The toolkit worldview
