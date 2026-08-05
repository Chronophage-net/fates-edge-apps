# Data Schema & Adding Custom Content

The web client's game content — factions, patrons, regions, religions, talents, bestiary — lives as plain JSON files under `data/`, loaded client-side with no build step. This doc covers the on-disk layout, how discovery finds your files, and the minimum shape each content type needs.

---

## 1. How discovery works (read this first)

Every content type is loaded the same way, via `js/core/discovery.js` (patrons/religions/bestiary) or a type-local copy of the same pattern (factions: `js/features/factions/index.js`; regions: `js/core/discovery.js`'s `discoverRegions()`):

1. **Check a 1-hour localStorage cache** for a previous discovery result.
2. **Try to fetch `<data-dir>/manifest.json`** — a plain JSON array of filename slugs (without `.json`), e.g. `["velvet-court", "iron-league"]`. If present and non-empty, this becomes the candidate list.
3. **Fall back to a hardcoded slug array** in source if there's no manifest (or it fails to fetch) — e.g. `KNOWN_FACTION_SLUGS`, `KNOWN_REGION_SLUGS`, `KNOWN_COSMIC_SLUGS`.
4. **HEAD-request each candidate slug's `.json` file** and keep only the ones that actually exist (this also silently drops manifest entries for files that were renamed/removed).
5. **Cache the result.**

**The practical upshot: to add new content without touching any JavaScript**, drop your new `<slug>.json` file into the right directory and regenerate that directory's `manifest.json` — don't rely on the hardcoded fallback array unless you're also willing to edit source.

### Regenerating manifests

```bash
cd utilities/javascript/fates-edge-web-client
node js/tools/generate-manifests.js
```

This scans each known data directory and writes/updates `manifest.json` there, excluding manifest files themselves (matched by `/manifest.*\.json(\.tmp)?$/i`, so `factions-manifest.json`-style sidecar files don't leak into the generated list). Run it after adding, renaming, or removing content files.

If you'd rather not run the tool, you can hand-edit `manifest.json` directly — it's just an array of slugs:

```json
["velvet-court", "iron-league", "my-new-faction"]
```

### If you skip the manifest entirely

Content will still show up as long as its slug is already in the hardcoded fallback array for that type (`KNOWN_FACTION_SLUGS`, `KNOWN_REGION_SLUGS`, `KNOWN_COSMIC_SLUGS`, `KNOWN_TERRESTRIAL_SLUGS`, `KNOWN_RELIGION_SLUGS`, `KNOWN_BESTIARY_SLUGS`) — otherwise it won't be discovered at all, manifest or no manifest, since discovery only ever tests slugs it already knows about (from one source or the other). There is no "list the directory" step; the client can't do that over plain HTTP.

---

## 2. Directory map

| Type | Directory | Discovery function | Notes |
|---|---|---|---|
| Factions | `data/factions/` | `discoverFactions()` in `js/features/factions/index.js` | |
| Cosmic patrons | `data/patrons/` | `discoverPatrons('cosmic', ...)` in `js/core/discovery.js` | |
| Terrestrial patrons | `data/terrestrial/` | `discoverPatrons('terrestrial', ...)`, fallback path `data/factions/` | Terrestrial patrons are usually just factions with patron-flavored fields; `data/terrestrial/` currently holds only a manifest, no real files — everything resolves via the faction fallback. |
| Religions | `data/religions/` | `discoverPatrons('religion', ...)` | Uses the same loader as patrons; religions share the "patron" content shape (see below). |
| Regions | `data/regions/` | `discoverRegions()` | See the region-generator caveat below. |
| Talents | `data/talents/` | (loaded via `data/talents-manifest.json`, a slightly different convention — see the talents feature module) | |
| Bestiary | `data/bestiary.json` | `discoverBestiary()` assumes one-file-per-creature under `data/bestiary/`, but the shipped data is actually a single `data/bestiary.json` dictionary keyed by creature name. If you're adding creatures today, add an entry to that dictionary rather than a new file — `discoverBestiary()` reflects an intended-but-unused per-file layout. | |
| Adventures | `data/adventures/` | loaded via the Adventure Engine / `/api/modules`, not the discovery.js pattern — see [MODULES.md](../fates-edge-socket-server/MODULES.md) in the socket server for the adventure/module format. | |

**Region deck files caveat:** `data/regions/hearts.json`, `clubs.json`, `diamonds.json`, and `spades.json` are Deck-of-Consequences suit-interpretation tables, not actual regions — despite living in the regions directory, don't use them as a template for a new region.

---

## 3. Minimum shape per type

Every type accepts far more fields than listed here (see an existing file for the full picture) — these are the fields the UI and discovery logic actually depend on.

### Faction (`data/factions/<slug>.json`)

```json
{
  "id": "my-faction",
  "name": "The Gilded Hand",
  "standing": 0,
  "agenda": "One-line summary of what they want",
  "agendaTimer": { "segments": 6, "current": 0 },
  "keyNPCs": ["Name One", "Name Two"],
  "resources": "What they can bring to bear",
  "hooks": ["A plot hook involving this faction"],
  "color": "#8b6bb5",
  "icon": "🎭",
  "source": "your-name-or-book",
  "description": "Longer prose description.",
  "territory": "Where they operate",
  "allies": [],
  "enemies": [],
  "tier": "I"
}
```

`standing` is an integer -3..3 (see `FACTION_STANDINGS` in the factions module for the label/color/icon each value maps to).

### Patron (cosmic/terrestrial) or Religion (`data/patrons/<slug>.json`, `data/religions/<slug>.json`)

These are the richest schema in the app — see `data/patrons/the_traveler.json` or `data/religions/everflame.json` for a full example. Minimum useful shape:

```json
{
  "id": "my-patron",
  "type": "patron",
  "title": "The Patron's Title",
  "subtitle": "One-line hook",
  "version": "1.0.0",
  "tags": ["tag-one", "tag-two"],
  "lore": { "description": "...", "quote": "..." },
  "domain_focus": ["Thematic bullet one", "Thematic bullet two"]
}
```

Religions use `"type": "religion"` and typically add `doctrines`, `practices`, and `names_across_regions` (a dict of region-slug → local name for the faith).

### Region (`data/regions/<slug>.json`)

Regions use a large "generator" schema (~26 top-level keys in `acasia.json`) intended to support random generation tables as well as reference lookup. There's no strict minimum — the UI degrades gracefully for missing sections — but at minimum include a display-relevant `name`/`title` field and whatever generator tables you want the region's random-encounter/hook tools to draw from. Copy `data/regions/acasia.json` as your starting template rather than trying to hand-derive the shape from scratch.

### Talent (`data/talents/<slug>.json`)

```json
{
  "id": "second-wind",
  "name": "Second Wind",
  "cost": 3,
  "tier": "minor",
  "activation": "active",
  "category": "general",
  "useLimit": "once-scene",
  "prerequisites": "",
  "effect": "One-line mechanical summary",
  "effects": [{ "type": "ignore_penalty", "source": "fatigue", "amount": 1 }],
  "description": "Longer prose description of when/how this triggers.",
  "source": "guide"
}
```

### Bestiary entry (`data/bestiary.json`, add a key)

```json
{
  "My New Monster": {
    "tier": "I",
    "description": "...",
    "stats": { "...": "..." }
  }
}
```

(See existing entries in `data/bestiary.json` for the full stat-block shape — it varies somewhat by creature complexity.)

---

## 4. `_license` field

Faction and other content files may carry a `_license` field indicating whether the content is original SRD-licensed material, proprietary Fate's Edge content, or your own homebrew. If you're adding homebrew content for personal use this doesn't matter, but if you intend to share files with others, see [COMMUNITY_USE_POLICY.md](../../../COMMUNITY_USE_POLICY.md) at the repo root for what you're allowed to redistribute.
