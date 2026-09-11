# Web client onboarding and usability

Reviewed 2026-09-11. Scope: first-run welcome, starter adventure, reading routes, session connection, and bestiary. This is a focused review, not an exhaustive audit of every feature.

## Completed in this pass

- [x] Read the licensed starter-character `data` envelope as well as legacy arrays. Quick Start no longer silently skips the supplied characters.
- [x] Show a loading label and disable repeat activation while the welcome screen prepares the adventure; restore the button on failure.
- [x] Report unreadable character packs with a next step rather than only logging to the console.
- [x] Offer a Join a session route to Settings → Live Campaign, alongside the starter adventure and browsing options.
- [x] Explain that solo work is browser-local and point to Export Data for backups.
- [x] Link the reading guide from the welcome screen.
- [x] Focus the welcome and confirmation headings for keyboard/screen-reader orientation, and preserve previously hidden panels when leaving setup.

## Next: high priority

- [x] **Guided connection screen (client).** Welcome now opens `#join`, a focused Settings view that reuses the existing form and handlers. Separate server/code and managed-credential choices hide the inactive form; status is announced live. Includes Return to the table and Show all settings. Browser-verified both methods; no remote room was joined during this check.
- [ ] **Recoverable join failures (client + socket-server).** `server/socketio-handlers.js` returns message-only errors such as “Invalid room code” and “Managed room access rejected”; room switching begins before all later join work completes. Socket.IO now validates admission before departing the current room, preserves an existing session on rejected switches, and supplies codes/guidance for invalid codes, passwords, invitations, and managed access. Same-socket rejoins no longer count as an extra seat at capacity. Wrong-password preservation is covered by an executed-handler regression test. Implemented matching admission codes, shared retry guidance, and overlapping-join rejection. Remaining: hosted managed-room acceptance testing. Test wrong password, expired managed credentials, unavailable server, and network loss during joining. Never include credentials in diagnostics.
- [ ] **First useful action after setup (client).** Implemented explicit “Read your character” and “Make a practice roll” routes alongside Enter the Game, with welcome-state restoration. Remaining: select the featured character directly, verify player access to scene notes, and exercise the complete flow in a fresh browser with slow/offline fetches and repeated setup.
- [ ] **Consistent packaged-data handling (client).** Bestiary and pre-gens both broke when license envelopes were introduced. Inventory every JSON consumer and validate packaged assets in CI against the exact loader used by the feature. Preserve attribution metadata.

## Next: medium priority

- [ ] **Clear save/connection status.** Distinguish “saved on this device”, “queued for sync”, and “synced to campaign”. Add a visible retry path and explain conflict recovery. Server acknowledgement must determine shared-save status.
- [ ] **Feature permissions.** Use one shared capability check for list actions, detail views, keyboard shortcuts, and mutation handlers. Readable reference material should not look locked; disabled editing should explain the required role. Verify local play, player, spectator, GM, and co-GM.
- [x] **Starter roster clarity and identity.** Welcome now explicitly says the full roster is added. Repeated setup recognizes stable IDs even after a player renames a pregen, retains edits, and uses name matching only for legacy records without IDs. Same-name custom characters remain separate. Regression tests cover both cases.
- [ ] **Mobile and keyboard walkthrough.** Check welcome, settings connection, character creation, document reader, and encounter details at narrow widths and 200% zoom. Verify focus restoration, visible labels, touch targets, and no horizontal page overflow.
- [ ] **Onboarding translations.** Extract the new welcome/loading/recovery copy into locale keys and review it alongside the existing untranslated welcome text. Verify RTL layout with real translations.
- [ ] **Backup and restore confidence.** Give exports a recognizable campaign/date filename, preview imported campaign contents before replacing state, and provide a tested recovery path after browser storage is cleared.
- [x] **Small layout regressions.** Media dialogs inherit the app font; mobile navigation uses logical positioning; RTL toasts use the existing left-entry animation. Updated the stale hover test to require an RTL counterpart only when list hover actually moves horizontally.

## Verification expectations

New starter-pack tests cover the shipped file, legacy arrays, and malformed data. Build and existing onboarding tests must pass. The multi-user connection and mobile walkthrough items above require dedicated interactive validation; they are not claimed complete by a successful build.

## Latest checks

- Production build and whitespace checks passed.
- All 286 automated checks passed.
- Resolved the shared theme-token failure by replacing obsolete color references with the existing palette, including VTT and tour surfaces. Defined shared UI and monospace font tokens; the body and feature dialogs use the same font family. No hardcoded light/dark color aliases added.
- Starter roster identity tests cover renamed pregens, same-name custom characters, and legacy ID-less records.
- Complete first-run, mobile, and multi-user walkthroughs remain on the checklist above. Recoverable server joins remain open; Socket.IO join rejection recovery is implemented; cross-transport recovery is not yet complete.

### Socket.IO recovery verification

- New wrong-password switch regression passes against the registered server handler. Syntax and whitespace checks pass.
- The existing server suite passed 217 of 218 tests; its Redis scaling initialization test failed in this environment. See the suite output when validating in a configured scaling environment.

### Connection feedback follow-through

- Added a shared client formatter for actionable room/password/invitation/capacity/managed-access/ban errors; legacy message-only errors still display. Both direct and wrapped transport errors are supported.
- Raw WebSocket now supplies the matching invalid-room, ban, and managed-access rejection codes. Socket.IO ban errors also carry a stable code.
- Settings sends passwords exactly as typed instead of trimming whitespace.
- Targeted recovery and server wiring checks pass; shared formatter regression tests cover wrapped messages, legacy compatibility, and fresh-credential guidance. Live multi-user retry and overlapping join serialization remain open.

## Release 5.1.7 — connection recovery completion

Overlapping Socket.IO joins now receive JOIN_IN_PROGRESS and can retry after the active request finishes. Locks clear on every exit, and destination capacity is rechecked after asynchronous admission. A real two-client localhost test verifies preserved membership after a bad password, rejected overlapping requests, successful retry with whitespace in the password, and transport disconnection cleanup.

The guided UI and error formatter are shipped. Full browser-to-browser testing against hosted managed infrastructure remains an operational acceptance check; no hosted credentials were used. Other UX backlog items remain open as recorded above.

Release validation: client 289/289; server 219/220, with the existing optional ioredis import failure; production build passes. Local two-client recovery passes.

### Redis failure resolved

The copyright tool had injected project metadata into installed `@ioredis/commands` data. Removed that injected key locally; the dependency code is unchanged. The tool now requires explicit data paths and excludes dependency/generated directories, symlinks, and package/manifest files. A regression test verifies those boundaries. All 220 server tests now pass, with no skips; this supersedes the earlier Redis limitation. Client checks remain 289/289. Fresh installations use the original package data.
