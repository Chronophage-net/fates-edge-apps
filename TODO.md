## Paper import — implemented 2026-09-05

- [x] Settings → Data Management → Import from Paper: paste, preview, and import.
- [x] Character creation and exact-ID updates; new timers and journal/wiki entries.
- [x] Explicit validation, visible numeric OCR repairs, and preservation of omitted character fields.
- [x] Existing sync operations and offline queue; corrected offline delivery envelope handling.
- [x] Character and GM import blocks in The Paper Table; printable Paper Import Reference in Resources.
- [ ] Optional follow-up: image upload/OCR (current flow accepts transcribed or externally recognized text).
- [x] Discord `/vttimport` adapter (2026-09-06): private paste form, complete preview, author-bound confirmation, new entries only, and receiving-client receipts.
- [ ] Optional follow-up: Foundry paper-import adapter using the same format.
- [ ] Optional follow-up: Discord exact-ID updates once authoritative current character state can be obtained safely.

The exchange labels stay in English for interoperability; the import dialog is localized in American English, British English, and Spanish. The reference lists exactly which fields are supported. Campaign counters beyond character tracks and new timers can be recorded in a journal but are not automatically applied.

### Original notes

"Paper" (manual) import:

Implementation Sketch
Client-side (web):

Add an "Import from Paper" button in the campaign settings or GM panel.

Open a textarea modal.

Parse the input with a simple state machine (sections = === ... ===, key-value pairs = Key: Value, lists = comma-separated or line-separated).

For each parsed entity, construct the corresponding socket-server operation.

Send operations via the existing sync layer (which handles offline queueing and conflict resolution).

Paper-side (The Paper Table):

Update the character sheet template to include the import block at the bottom, with clear labels and a monospaced font example.

Add an "Import Block" section to the GM's session tracker.

Provide a one-page "Paper Import Reference" that lists all the section headers and key names the parser recognizes.

Server-side:

No changes needed. The operations already exist.

The Easiest Possible Version
If you want the absolute easiest path: a GM can simply type !import into the Discord bot or Foundry chat, paste the paper block, and the bot parses it and sends the operations to the server. The same parser logic lives in the bot, the web client, or a shared utility module.

This means a GM with a phone in one hand and a paper sheet in the other can update the campaign state without ever opening the web client. That's accessibility through integration.

Has to be tolerant of OCR errors (to a point) 

Perhaps can be tied into the existing campaign state import.

I'm thinking of the incarcerated playing via text/email and having someone transcribe or (shooting for the moon) have the server OCR the content of am uploaded image.
