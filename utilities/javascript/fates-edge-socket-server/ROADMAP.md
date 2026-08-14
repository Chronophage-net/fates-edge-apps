# Roadmap

Genuinely planned or open work for this server only. For anything client-facing or ecosystem-wide, the root [README.md's Roadmap section](../../../README.md#-roadmap) is the maintained source of truth — this file doesn't duplicate it, only server-specific items live here.

If a feature isn't listed here and isn't described as implemented in [DESIGN.md](DESIGN.md), it isn't planned — it was probably leftover text from an earlier draft that never got built and has since been removed rather than promoted here. See DESIGN.md's own "Not real" call-outs for the specific things that were cut (PDF conversion, email, job scheduling, general-purpose caching, session middleware).

## Open items

- **Multi-instance integration test for [SCALING.md](SCALING.md)'s Redis relay and cluster relay.** `tests/scaling.test.js`/`tests/cluster.test.js` cover the no-op and graceful-fallback paths; there's no automated test that actually spins up multiple server processes (with or without Redis) and verifies cross-instance delivery. Worth adding once there's a real multi-instance/multi-worker deployment to validate against. (Manually verified once during development for the cluster path — see SCALING.md's "Multi-core scaling" section.)
- **Dockerfile's `ENABLE_UPLOAD` build arg is currently dead weight.** It conditionally installs `pdf2htmlEX`/`poppler-utils` and optionally `multer`, but no route in `server/api.js` ever uses them — there's no PDF conversion feature behind it, despite what an earlier draft of DESIGN.md implied. Either build the feature for real (a genuine ask if GMs want to upload a PDF rulebook/handout and get back HTML) or remove the dead Dockerfile branch — currently unresolved, tracked here rather than left undocumented.
- **Session Playback/Export** (cross-referenced from the root roadmap) — if this ends up needing server-side storage (rather than being purely a client-side export of locally-captured recordings), the pieces would land here.

## Explicitly not planned

Cut from earlier drafts and not coming back unless someone actually wants them: Redis-backed API response caching, email notifications, background job scheduling (agenda), and server-side rendered PDF export of campaign data.
