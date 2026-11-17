---
description: Enforce web frontend security and XSS prevention
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.html'
  - '**/*.astro'
---

# Web security standards

## Link safety

- Add `rel="noopener noreferrer"` to all external links with `target="_blank"`.

## Content sanitization

- Sanitize all user-generated content rendered via `dangerouslySetInnerHTML` using DOMPurify or equivalent.
- Never use `dangerouslySetInnerHTML` without sanitization.

## Input validation

- Validate all URL parameters and query strings using schema validation before use.

## Storage and tokens

- Do not store sensitive data (tokens, passwords, PII) in `localStorage` or `sessionStorage`.
- Store authentication tokens in httpOnly cookies over exposing them to JavaScript.

## Third-party scripts

- Audit and pin versions for all third-party scripts loaded in the browser.
