# Changelog
All notable changes to this project will be documented here.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/), versions follow [Semantic Versioning](https://semver.org/).

## [4.10.0] - 2026-08-12

Optional Elasticsearch search backend for the web client (alongside the existing, now-documented Solr option), with System Status integration and new test coverage.

_No commits since the last tag — manual version bump._

## [4.9.0] - 2026-08-12

Optional Redis-backed horizontal scaling for the socket server; documentation overhaul separating implemented reality from roadmap across the socket-server and web-client design docs (new SCALING.md, ROLES.md, ROADMAP.md for the socket server).

### Added
- optional Redis-backed horizontal scaling

### Docs
- rewrite web-client TODO.md as an archived status record
- correct socket-server DESIGN.md (remove Redis/aspirational claims)

## [4.8.3] - 2026-08-12

Security hardening: server-verified sender identity for the VTT event relay, XSS fixes in Kon'reh/Toll & Veil banners, Toll & Veil stake-message validation, Trust/Cantor bug fixes.

### Other
- Added Toll and Veil guide and document categoy.

## [4.8.2] - 2026-08-12

### Other
- Got Toll and Veil working

## [4.8.1] - 2026-08-12

Socket server persistence/Dockerfile fixes, web client compose cleanup, INSTALL guides for server/client/bot

_No commits since the last tag — manual version bump._

## [4.7.1] - 2026-08-11

### Other
- Updated copyright language
- Updated mods and bots to stop html injections, finished desktop client
- Updated konreh doc and package manager

## [4.7.0] - 2026-08-10

Security hardening pass (XSS fixes, auth rate limiting, input length limits) and multi-character 'Remote enabled' control (up to 6 characters per client)

_No commits since the last tag — manual version bump._

## [4.6.3] - 2026-08-10

### Other
- Added two expansions and an adventure. Plugged one security hole. TODO: HTML Parsing issues

## [4.6.2] - 2026-08-10

### Other
- Added Modern Noir
- Added Modern Nmoit
- Updated theme engine and fixed CSS. Made WebGUI theme-able

## [4.6.1] - 2026-08-08

Talent catalog overhaul: JSON-per-talent expansion (10 -> 55), tagging + category filter bar in the character editor/wizard, and starter/XP-appropriate talent recommendations.

### Chore
- prune 5 not-yet-free adventures from web-client per updated allowlist
- sync 9 new adventures (JSON + HTML docs) from fates-edge-docs
- sync 18 new patron files from fates-edge-docs

### Other
- Fixed an annoying yet prominant typo.

## [4.6.0] - 2026-08-07

Diverse encounter objective-type clocks (obstruction, skill challenge, trap/ward, lockpick, heist, social, custom), symbol management fixes, patron/cantor discovery reliability, Kon'reh AI phase-awareness

### Added
- generic objective-type clocks instead of hardcoded Harm/Heal
- phase-aware Kon'reh AI evaluation

### Fixed
- stop Cantor/Patrons needing a manual refresh to see current data
- remove redundant auto-symbol injection in character editor/wizard

### Other
- Merge branch 'symbol_character_update': symbol management fixes, patron/cantor discovery fix, Kon'reh AI phase-awareness, generic objective-type encounters
- Working on getting characters to track symbols properly and to have rites be able to choose between them.
- Updated adventures and added Terrestrial Patrons

## [4.5.1] - 2026-08-05

Jump to the Action: one-click pregen + starter adventure flow in the welcome overlay

_No commits since the last tag — manual version bump._

## [4.5.0] - 2026-08-05

Voice/logging fully implemented (TURN NAT traversal), unified docker-compose for the whole ecosystem, community use policy + split license files, System Status page, module system fixed and documented, data schema docs

_No commits since the last tag — manual version bump._

## [4.4.2] - 2026-08-05

Fixed remaining stale v4.3a version references in README.md/DESIGN.md files (root README title/badge/What's New/Version History, JS toolkit README, socket-server README/DESIGN, web-client DESIGN). Taught bump-version.mjs to auto-catch README/DESIGN title lines and version badges going forward (conservatively — narrative changelog sections still need a human).

_No commits since the last tag — manual version bump._

## [4.4.1] - 2026-08-05

Fix: index.html and app.js version banners were still stale after v4.4.0 (only package.json files were bumped). Centralized the displayed version into js/core/version.js and taught bump-version.mjs to catch index.html/version.js going forward.

### Other
- Updated the index.html

## [4.4.0] - 2026-08-05

Crafting decay/forage-limit system tied to GM Downtime (Faction Turn), CSS modularization for crafting, socket-server auth/deck/adventure unit tests, web-client test-harness fixes, terminal client account-character (/mychar) commands.

### Other
- Actual tests
- Repo hygiene: fix .gitignore (stale paths, env/venv split, *.db), untrack campaigns.db, drop stray fs npm-security-placeholder dependency
- Updated manifest

