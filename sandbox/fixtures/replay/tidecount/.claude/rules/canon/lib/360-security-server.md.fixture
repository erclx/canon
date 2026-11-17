---
description: Enforce server-side authorization, secret handling, and abuse limits on request handlers
paths:
  - '**/*.py'
  - '**/*.ts'
  - '**/*.js'
---

# Server security standards

## Authorization

- Authorize every request on the server, whatever the client already checked.
- Derive the caller identity from the verified session or token. Never read it from a request body, query string, or header the client sets.
- Check that the caller owns or may reach the specific record a request names, not only that the caller is signed in.
- Deny by default. Grant a route access through an explicit allow.

## Credentials

- Hash passwords with a memory-hard algorithm and a per-record salt. Never store a reversible password.
- Compare tokens, signatures, and password hashes with a constant-time function.
- Expire and revoke sessions and refresh tokens on the server. Do not rely on client-side deletion.

## Secrets

- Read every secret from the environment or a secret manager at runtime.
- Never commit a secret, connection string, or private key to the repository.
- Never return a secret, connection string, or internal hostname in a response body.

## Abuse limits

- Rate-limit authentication, password reset, and any endpoint that sends mail or costs money per call.
- Set an explicit maximum body size and request timeout on every endpoint.
- Bound pagination parameters with a server-side maximum.

## Transport

- Serve every route over TLS and reject plaintext requests.
- Restrict CORS to an explicit origin list. Never reflect the request origin or pair a wildcard with credentials.
