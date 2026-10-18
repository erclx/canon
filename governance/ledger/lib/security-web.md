---
title: Web security rule ledger
description: Sources for governance/rules/lib/security-web.md, one row per bullet
---

# Web security rule ledger

The field is web application security in the browser, and the authorities are the OWASP Cheat Sheet Series and MDN. The two disagreed on `target="_blank"`, and MDN was kept, since it states what browsers do and the extra attribute adds nothing a current browser lacks.

## Content sanitization

| Bullet                    | Source                                                                                                                                                                                                                                                                    | Read       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| DOMPurify before raw HTML | [XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) lists "React's `dangerouslySetInnerHTML` without sanitizing the HTML" as an unsafe escape hatch, and "OWASP recommends DOMPurify for HTML Sanitization" | 2026-10-18 |
| Allow-list URL schemes    | [XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html): React blocking `javascript:` URLs "does not replace application-specific URL validation", which allows only http and HTTPS                             | 2026-10-18 |

## Input validation

| Bullet                            | Source                                                                                                                                          | Read       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Parse URL params through a schema | House choice: a URL parameter is a string the visitor writes, and one read unparsed reaches rendering or a request in whatever shape it arrived | 2026-10-18 |

## Storage and tokens

| Bullet                           | Source                                                                                                                                                                                               | Read       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Nothing sensitive in web storage | [HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html): "Do not store session identifiers in local storage as the data is always accessible by JavaScript" | 2026-10-18 |
| Tokens in `HttpOnly` cookies     | [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): the `HttpOnly` flag "is mandatory to prevent session ID stealing through XSS attacks"      | 2026-10-18 |

## Third-party scripts

| Bullet                   | Source                                                                                                                                                                                                                            | Read       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Pinned, with `integrity` | [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity): it lets browsers "verify that resources they fetch (for example, from a CDN) are delivered without unexpected manipulation" | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Cut "add `rel="noopener noreferrer"` to all external links with `target="_blank"`". [MDN noopener](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener) says `target="_blank"` "implicitly provides the same `rel` behavior as setting `rel="noopener"`". The [HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) page still asks for it, and MDN was kept as the newer statement of browser behavior.

### Merged or reworded

- Merged "never use `dangerouslySetInnerHTML` without sanitization" into the DOMPurify bullet, and named `innerHTML` and Astro's `set:html`, since the rule loads on `.html` and `.astro` files too.
- Reworded "audit and pin versions for all third-party scripts" to the `integrity` attribute, which makes the pin checkable.

### Gaps filled

- Added the URL scheme bullet. The XSS page names `javascript:` URLs as the hole sanitizing markup leaves.
