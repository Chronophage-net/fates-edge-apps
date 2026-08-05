# Changelog
All notable changes to this project will be documented here.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/), versions follow [Semantic Versioning](https://semver.org/).

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

