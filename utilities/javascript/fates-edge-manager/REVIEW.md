# Account and room manager review — 2026-09-27

## Fixed

- Passwords were trimmed as ordinary text. Credentials now retain their exact whitespace during creation, verification and changes.
- JSON parser errors could return submitted body fragments. Malformed and oversized payloads now return bounded errors without credential content.
- Origin configuration accepts only an exact origin; malformed node URLs return a useful client error.
- Slow page requests could replace a newer route. Render generations prevent stale results from overwriting the current page or account state.
- Page failures left stale content without recovery. Failed views now offer retry, and sign-in clears the loading state.
- Improved keyboard navigation, dialog labeling/focus, mobile cards, touch targets and dense table overflow. Page navigation clears open credential dialogs.

## Verification

- `npm test`: **20 passed**, including signed OIDC and real game-node socket authorization, whitespace-sensitive password creation/login/change, private parser errors and navigation races.
- Dependency audit: **zero reported vulnerabilities**.
- Browser preview: sign-in, room creation, roster display, labeled dialog focus and 390px mobile layout.
- Syntax and whitespace checks passed.

Tests use isolated PGlite databases and local listeners. External OIDC providers, production PostgreSQL and reverse-proxy TLS were not exercised. The existing account, room membership, CSRF, key scope and node placement security model is retained.
