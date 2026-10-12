# Document backport log

## 2026-10-12 — The Five Daughters of Inaea (source and web edition aligned)

Line-edited the canonical `ttrpg/reference/expansions/five_daughters_of_inaea.tex` in the docs repository, rebuilt its HTML with `tools/build_five_daughters.py`, and mirrored that edition into the web client's expansions folder. Corrected the Iron Rose's chronology, anonymity and mentor continuity; tightened repetitive prose; reconciled blessing summaries with the existing observance costs and shared limits. Preserved chapter anchors, the story's devotional voice and the license notice. Added curated expansion shelf copy without changing the saved document ID. No canonical backport remains for this edit.

## 2026-10-12 — GM crafting reference (pending canonical backport)

Updated `gm-guide/GM-_-Guide-_-09-_-Downtime.html`: replaced the obsolete one-roll magical-item table row with the current Craft/Arcana project procedure and added a linked bench summary covering progress, Flaws, Wonder costs, attunement, upkeep and gathering. This matches the bundled Player's Guide and SRD; it introduces no new rules. Backport this correction to the canonical HTML and corresponding GM-guide LaTeX before the next docs sync. The sibling docs repository was not modified in this release.

The canonical per-document ledger is in the sibling docs repository:
[BACKPORT_DOCUMENTS.md](../fates-edge-docs/BACKPORT_DOCUMENTS.md).

HTML is authored in `fates-edge-docs/ttrpg/utilities/javascript/data/docs/` and mirrored
into this repository’s `utilities/javascript/fates-edge-web-client/data/docs/`.
The 2026-09-09 pass adds a library reading guide and presentation improvements across
167 English documents. It preserves original rule prose and tables. See the canonical
ledger for source families, preservation hashes, scope, and pending LaTeX work.
