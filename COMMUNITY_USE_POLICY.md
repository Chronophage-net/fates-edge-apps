# Community Use Policy

This toolkit bundles three legally distinct things under one roof, and
"can I do X with this repo" almost always comes down to which of the three
X touches. This document is a plain-language FAQ on top of the actual
license files — if anything here and a `LICENSE*` file ever disagree, the
license file wins.

If your question is about the **tabletop game itself** — publishing an
adventure, running a paid actual-play, translating the SRD, using a named
NPC in your homebrew — that's covered in more depth by
[fates-edge-docs' third-party-policy.md](https://github.com/Chronophage-net/fates-edge-docs/blob/main/third-party-policy.md).
This document focuses on the **toolkit** (this repo, and its sibling
`fates-edge-*` repos): the code, and the data files it ships with.

---

## The three categories

| Category | License | Where it lives | Full text |
|---|---|---|---|
| **Code** — every `.js`/`.py`/`.html`/`.css` file, build scripts, Dockerfiles, this `docker-compose.yml` | MIT | `js/`, `server/`, bot repos, `tools/`, etc. | [LICENSE.code](LICENSE.code) |
| **SRD** — core mechanics: dice pools, Position/Effect, Boons, Story Beats, the Essentials Guide | CC BY-NC-SA 4.0 | Files explicitly tagged `SRD` under `data/docs/`, and the Essentials Guide | [LICENSE.srd](LICENSE.srd) |
| **Proprietary Content** — the Amaranthine setting, named NPCs/Patrons, factions, adventures, proprietary magic-system writeups, art | All Rights Reserved (freely usable for personal, non-commercial play) | `data/regions/`, `data/patrons/`, `data/factions/`, `data/adventures/`, `data/religions/`, `data/bestiary.json`, most of `data/talents/` | [LICENSE.proprietary](LICENSE.proprietary) |

The dividing line that matters for almost every question below: **the
engine is MIT; the world data it ships with is not.** You can do
essentially anything with the code. You need permission for commercial use
of the setting/content.

---

## Common questions

**Can I clone this repo and self-host it for my own group?**
Yes, no permission needed — this is exactly what the code is for, and personal/non-commercial play of the bundled content is explicitly permitted.

**Can I fork the repo, rebrand it, and offer it as a paid hosting service (e.g. "MyVTT, powered by Fate's Edge")?**
The *code* license (MIT) doesn't stop you from doing that with the engine itself. But the bundled `data/` — regions, patrons, factions, adventures, the Amaranthine setting — is Proprietary Content and NOT MIT, so you can't sell access to that data as part of your service without permission. Two clean options: (a) strip the bundled `data/` and run the engine with your own setting instead (a dedicated data-schema guide is on the roadmap — for now, the existing files under `data/*/*.json` and their `manifest.json` siblings are the format reference), or (b) contact **support@fates-edge.com** about a commercial data license.

**Can I add my own homebrew faction/patron/region and share my fork?**
Yes. Content *you* write is yours — put whatever license you want on it. Just don't redistribute the *original* proprietary files (the ones that shipped with this repo) outside the bounds of [LICENSE.proprietary](LICENSE.proprietary) as part of that fork.

**Can I strip out all the game data and use this purely as a generic VTT engine for a different game system?**
Yes — that's a pure-code use case, MIT covers it fully. None of the proprietary-content restrictions apply once you're not shipping Fate's Edge setting data.

**Does this apply to the bots too (Discord bot, AI GM bot) and the other clients (desktop, terminal, Foundry/Roll20 modules)?**
Same split. Their code is MIT (each repo's own `LICENSE`/`package.json` `_license` field says so explicitly). If a bot or module bundles or fetches proprietary content (adventure text, patron write-ups, etc.) from the server, that content is still governed by [LICENSE.proprietary](LICENSE.proprietary)/[LICENSE.srd](LICENSE.srd), same as the web client.

**Is the SRD (System Reference Document) content the same as the rest of the data?**
No — SRD content (the core dice/Position/Effect/Boons/Story Beat mechanics, the Essentials Guide) is under CC BY-NC-SA 4.0, which is *more* permissive than the proprietary setting content: you can share and adapt it non-commercially without asking, as long as you credit the author and share alike. Files are explicitly tagged as SRD where this applies; anything not tagged SRD defaults to Proprietary Content.

**Can I run a paid game (e.g. a table on StartPlaying.games) using this toolkit and the bundled setting?**
The [existing proprietary-content grant](LICENSE.proprietary) covers *personal, non-commercial* play. Running a paid table is a commercial use of the setting content, even though you're not redistributing files — reach out to **support@fates-edge.com** first.

**I found a data file with no SRD tag and I'm not sure which license it falls under.**
Default to Proprietary Content (All Rights Reserved, personal-use-only) unless the file or its containing manifest explicitly says SRD. When in doubt, ask — **support@fates-edge.com**.

**Where do I request commercial permission or report a violation?**
**support@fates-edge.com** for either. See [fates-edge-docs' third-party-policy.md](https://github.com/Chronophage-net/fates-edge-docs/blob/main/third-party-policy.md) for what a permission request should include and expected response time.

---

## Summary

- **Code**: do anything — it's MIT.
- **SRD**: share and adapt freely, non-commercially, with credit and share-alike.
- **Proprietary Content**: personal, non-commercial play only; ask first for anything commercial.

*"The coin that never spends is the one you don't remember taking."*
— Serafine of the Velvet Touch
