---
title: Server security rule ledger
description: Sources for governance/rules/lib/security-server.md, one row per bullet
---

# Server security rule ledger

The field is application security, and the authorities are the OWASP Cheat Sheet Series, the OWASP API Security Top 10 2023, and MDN for the CORS protocol. The CORS bullet is worded the way `framework/fastapi.md` states it, so a FastAPI target reads one rule twice rather than two.

## Authorization

| Bullet                           | Source                                                                                                                                                                                                                             | Read       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Authorize on the server          | [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): "Developers must never rely on client-side access control checks", and "Permission should be validated correctly on every request" | 2026-10-18 |
| Identity from the verified token | House choice: an identity read from a field the client sets is one the client chooses, which turns every authorization check into a check of the attacker's claim                                                                  | 2026-10-18 |
| Check the specific record        | [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): "Perform access control checks on every request for the specific object or functionality being accessed"                           | 2026-10-18 |
| Deny by default                  | [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): "an application should be configured to deny access by default"                                                                    | 2026-10-18 |

## Credentials

| Bullet                          | Source                                                                                                                                                                                                                                              | Read       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Argon2id and a salt             | [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): "If Argon2id is not available, use scrypt", a salt is "unique, randomly generated" per password, and "hashing is a one-way function"          | 2026-10-18 |
| Constant-time comparison        | [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): a comparison should return "in constant time, to protect against timing attacks"                                                                  | 2026-10-18 |
| Expire and revoke on the server | [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): "Session timeout management and expiration must be enforced server-side", and "deleting a cookie alone does not invalidate a stolen copy" | 2026-10-18 |

## Secrets

| Bullet                         | Source                                                                                                                                                                                                                                       | Read       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Secrets at runtime             | [Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html): "It is even better when the consumer of the secret retrieves the secret", or an orchestrator injects it as an environment variable | 2026-10-18 |
| Never commit a secret          | [Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) names the failure: secrets "hardcoded within the source code in plaintext"                                                          | 2026-10-18 |
| Nothing internal in a response | [Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html): a response should "not provide any content as part of the response that would reveal implementation details"                               | 2026-10-18 |

## Abuse limits

| Bullet                      | Source                                                                                                                                                                                                                                                         | Read       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Rate-limit costly endpoints | [API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption): "Implement a limit on how often a client can interact with the API within a defined timeframe", and "Configure spending limits for all service providers" | 2026-10-18 |
| Body size and timeout       | [API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption): "Define and enforce a maximum size of data on all incoming parameters and payloads", with missing "Execution timeouts" listed as a weakness               | 2026-10-18 |
| Bound pagination            | [API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption): validate the parameter "that controls the number of records to be returned in the response"                                                               | 2026-10-18 |

## Transport

| Bullet                            | Source                                                                                                                                                                                                                                                       | Read       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| TLS, and fail plaintext API calls | [Transport Layer Security](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html): "API endpoints should fail requests made over unencrypted HTTP connections instead of redirecting them"                                | 2026-10-18 |
| Explicit CORS origins             | [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS): for a credentialed request the server "must not specify the `*` wildcard", and reflecting the origin is a house choice, since it grants every origin the wildcard was refused for | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Reworded "serve every route over TLS and reject plaintext requests". The TLS cheat sheet allows a public site to redirect port 80 to HTTPS, and requires the refusal for an API endpoint only.

### Merged or reworded

- Narrowed "hash passwords with a memory-hard algorithm" to the order the password storage page gives, since bcrypt is not memory-hard and the page still lists it.
- Reworded "restrict CORS to an explicit origin list, never pair a wildcard with credentials" to the wording `framework/fastapi.md` uses, keeping the ban on reflecting the origin.
- Added stack traces to the response bullet, the leak the error handling page shows first.
