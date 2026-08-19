# Changelog

All notable changes to the Fate's Edge Python client are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/);
versions follow [Semantic Versioning](https://semver.org/). This package
is versioned independently of the rest of the `fates-edge-apps` monorepo
-- see the root `VERSIONING.md`.

## [5.2.0] - 2026-08-19

### Added
- `FatesEdgeRestClient.get_deck_seed(code)` / `.set_deck_seed(code, seed)`,
  wrapping the socket server's new `GET`/`POST /api/rooms/:code/deck/seed`
  routes -- read or explicitly (re)seed a room's deck-shuffle RNG for
  reproducible draws. Every room now shuffles with its own independent,
  seedable PRNG instead of a shared unseeded `Math.random()`.
- `fates-edge server --deck-seed-get` / `--deck-seed-set SEED` CLI
  subcommands.

## [5.1.0]

Region flavor-text data (`data/regions/*.json`) no longer bundled into
the installed package; fetch it separately via `fates-edge data --fetch`.
See README.md for details.

## [5.0.0]

First release as a proper installable package (`fates_edge_client/`),
replacing the old single-file script.
