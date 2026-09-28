# Socket server review — 2026-09-27

## Changes

- Plain WebSocket admission now completes password, membership, role and capacity checks before exposing state or joining broadcasts. Pending connections expire, and storage lookup failures reject admission.
- Private messages never fall back to public chat. Delivery supports a live client ID, the GM seat, or one unambiguous character controller. Missing recipients return `WHISPER_UNDELIVERABLE`; private messages never enter public history.
- Socket.IO and plain WebSocket upgrades share one listener correctly, including `/campaign/CODE` paths. Browser origin restrictions and payload caps cover both protocols.
- Shutdown closes upgraded connections before waiting for the HTTP listener and database. Database initialization is shared by concurrent first requests.
- Configuration now consistently uses environment > JSON > defaults, validates numeric limits and origin lists, preserves explicit zero values, and supports trusted proxies. DEBUG logging works again.
- Status reports the package version; public health responses expose aggregate counts instead of room codes/names. HTTP errors are bounded JSON responses, and parser errors do not log request contents.
- Updated the dependency lockfile to clear the reported Express/body-parser/qs advisories.
- Replaced source-text assertions for rosters, capacity and limiter wiring with actual transport/HTTP regression tests. Authentication tests use an available port and a scratch database, with awaited cleanup.

## Verification

- `npm test`: **229 passed**, including 13 live-server regressions.
- `npm run test:auth`: **all checks passed** (registration/login, password admission, membership, bans and character limits).
- Dependency audit: **0 reported vulnerabilities** after updates.
- Syntax and whitespace checks passed.

## Deployment considerations

Set `CORS_ORIGIN` to the browser origins you serve, and configure `TRUST_PROXY` for your actual proxy topology. Invalid configuration now stops startup. A failed database lookup prevents room admission until storage recovers.

Private-message recipients must be connected to the same process; distributed private routing is not implemented. External Redis, multi-process clustering, PostgreSQL/MySQL, hosted manager services and TURN connectivity were not exercised by the local verification. This review addresses the tested paths and is not a comprehensive penetration test.
