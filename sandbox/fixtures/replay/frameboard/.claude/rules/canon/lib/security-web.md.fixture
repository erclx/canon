---
description: Enforce web frontend security and XSS prevention
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.html'
  - '**/*.astro'
---

# Web security standards

## Content sanitization

- Sanitize HTML with DOMPurify before passing it to `dangerouslySetInnerHTML`, `innerHTML`, or `set:html`. Never render it raw.
- Allow only `http:` and `https:` in a user-supplied URL before rendering it in `href` or `src`.

## Input validation

- Parse URL parameters and query strings through a schema before use.

## Storage and tokens

- Never store a session token, password, or personal data in `localStorage` or `sessionStorage`, which any script on the page can read.
- Keep an authentication token in an `HttpOnly` cookie, out of reach of JavaScript.

## Third-party scripts

- Pin a third-party script to a version and load it with an `integrity` hash.
