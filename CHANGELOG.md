# Changelog
All notable changes to this project will be documented here.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/), versions follow [Semantic Versioning](https://semver.org/).

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

