# Versioning

This repo follows strict [Semantic Versioning](https://semver.org/) —
`MAJOR.MINOR.PATCH` — starting at **4.4.0**. The old `4.3a`-style scheme
(major.minor plus an ad hoc letter suffix, inconsistent even with itself —
compare the `package.json` field `4.3a` against desktop build artifacts
tagged `4.1.2-a`) is retired.

- **MAJOR** — breaking changes (API/socket protocol changes clients must
  update for, save-data format changes, removed features).
- **MINOR** — new features, additive endpoints, non-breaking behavior
  changes.
- **PATCH** — bug fixes, test/doc/refactor-only changes.

All `package.json` files in this repo (root `kon-reh` package plus every
sub-package under `utilities/`) are kept in sync at the same version —
this is one release train, not independently-versioned packages. Tags are
`vMAJOR.MINOR.PATCH` (e.g. `v4.4.0`).

The Python client
(`utilities/python/fates-edge-python-client/pyproject.toml`) is the one
deliberate exception — it's a standalone package with its own release
cadence and is versioned independently (currently `5.0.0`); don't fold it
into the ecosystem-wide bump.

## Bumping the version

```bash
node tools/bump-version.mjs [major|minor|patch|auto] ["release summary"]
```

- `auto` (the default if you omit the argument) inspects commits since the
  last `vX.Y.Z` tag and picks a level from
  [Conventional Commits](https://www.conventionalcommits.org/) prefixes:
  `feat!:`/`BREAKING CHANGE:` → major, `feat:` → minor, anything else
  (`fix:`, `chore:`, `docs:`, `test:`, `refactor:`, ...) → patch. This repo
  doesn't consistently use Conventional Commits yet, so `auto` currently
  under-detects — pick the level explicitly (`minor`, etc.) until commit
  messages catch up, or start prefixing new commits (`feat: ...`,
  `fix: ...`) so `auto` gets more accurate over time.
- Add `--dry-run` to preview the new version and generated CHANGELOG entry
  without writing anything.
- Add `--no-commit` to write the version bump + CHANGELOG but skip the git
  commit/tag step.

What it does:
1. Bumps the version in every `package.json` in the repo.
2. Prepends a dated entry to `CHANGELOG.md`, auto-grouped from commit
   subjects since the last tag (Added/Fixed/Changed/Docs/Tests/Chore/Other).
3. Commits as `chore(release): vX.Y.Z` and creates an annotated tag
   `vX.Y.Z`. If git itself can't run (e.g. a stale `.git/index.lock`), the
   files are still updated and it prints the exact commands to finish by
   hand instead of leaving things half-done.

## `auto` is a suggestion, not an authority

Two standing overrides. `auto` reads commit prefixes and knows nothing about
what the version *means*, so it gets both of these wrong every time:

**A rules change is not an app major.** The apps version tracks the toolkit —
its data shapes, its APIs, its saved-state format. A `feat!:`/`BREAKING CHANGE:`
commit that breaks a *rule* (the DV ladder ends at 5; Reach is a band now)
breaks nothing a user of this repo has integrated against, so it does not
justify a major here even though `auto` will insist. Those land as
`minor`/`patch` on the current line. Reserve major for something that actually
breaks a consumer: the saved-character schema, a manifest format, a socket
protocol.

**In `fates-edge-docs`, 1.0.0 is a decision.** That repo is pre-1.0, and under
semver a breaking change before 1.0 bumps the minor. `auto` will happily
propose `1.0.0` off a `feat(srd)!:` commit; `1.0.0` means the game is released
and is the author's call to make deliberately, never a side effect of a commit
prefix. Pass `minor` explicitly there until that call is made.

In both cases: run `--dry-run` first, and if the level it picks would say
something you don't mean, pass the level by hand.

See `tools/bump-version.mjs`'s own header comment for the full mechanics.
The identical script is copied (not shared via a package dependency,
since these are three unrelated git repos) into
`fates-edge-ai-gm-bot/tools/` and `fates-edge-docs/tools/` — if you change
the logic, copy the updated file to the other two as well.
