# Canonical Stat Block Schema

**Purpose:** One format for every adversary, in every JSON, across every product.

## Schema

```json
{
  "id": "kebab-case-id",
  "name": "Display Name",
  "page": "Display_Name",
  "category": "spirit | humanoid | lycanthrope | vampire | fey | demon | giant | beast | undead | construct | patron-avatar | npc",
  "summary": "One sentence. What it is, at a glance.",
  "lore": "One to three sentences of world-facing context.",
  "locations": ["Where it is found"],
  "connections": ["Related factions, patrons, or entries"],

  "tl": 3,
  "key_attribute": "Spirit",
  "pool": 4,
  "harm": 2,
  "fatigue": 3,
  "armor": "None | Light | Medium | Heavy",
  "resilience": "3 (standard) | 8 (advanced) | 8 per phase | None (puzzle)",

  "resolution": "Only present when resilience is None (puzzle). The exact action that resolves it.",
  "secret": "Optional. GM-only truth.",

  "sb_spends": [
    {
      "cost": 1,
      "name": "[TAG] Name of Move",
      "effect": "What happens, in one sentence."
    }
  ]
}
```

## Field Definitions

| Field | Type | Notes |
|---|---|---|
| `id` | string | kebab-case, unique across the toolkit |
| `name` | string | Display name as it appears in play |
| `page` | string | Reference anchor (e.g., "Silken_Blade") |
| `category` | enum | Controlled vocabulary. Picks one. |
| `summary` | string | ≤ 140 characters. Read aloud if needed. |
| `lore` | string | The fiction. What the players might learn. |
| `locations` | array | Where it is found. |
| `connections` | array | Faction / patron / entry IDs. |
| `tl` | integer 1–10 | Threat Level. Primary difficulty dial. |
| `key_attribute` | string | Body, Wits, Spirit, or Presence. |
| `pool` | integer | Dice pool. **Formula: TL + 1.** |
| `harm` | integer | Outgoing damage on a hit. |
| `fatigue` | integer | Fatigue track size. |
| `armor` | enum | None / Light / Medium / Heavy. |
| `resilience` | string | See resilience table below. |
| `resolution` | string | Required if `resilience` is `"None (puzzle)"`. |
| `secret` | string | Optional GM-only truth. |
| `sb_spends` | array | SB menu. Tag name in brackets. |

## Resilience Table

| Label | Value | Use For |
|---|---|---|
| `"3 (standard)"` | 3 | TL 1–3. Mooks, minor spirits, common beasts. |
| `"8 (advanced)"` | 8 | TL 4–6. Named threats, vampires, lycanthropes. |
| `"8 per phase"` | 8/phase | TL 7+. Boss-tier. Each phase is a new fight. |
| `"None (puzzle)"` | — | Resolved by a specific action, not by damage. |

## Pool Formula

**Pool = TL + 1.**

Verified against:
- Velvet Knife: TL 3 → 4d ✓ (First Play Kit)
- Silken Blade: TL 5 → 6d ✓ (First Play Kit)
- Kaelen the Unspent: TL 3 → 4d (spirit, uses Spirit as key)

## Tag Vocabulary (SB Spends)

Standard tags, so a GM can scan a bestiary for the right complication:

`[AMBUSH]` `[BARGAIN]` `[BLOOD]` `[CURSE]` `[DREAM]` `[ENVIRONMENT]` `[FEY]` `[FIRE]` `[HAUNT]` `[ICE]` `[ILLUSION]` `[MEMORY]` `[OMEN]` `[POSSESSION]` `[PRESSURE]` `[REINFORCEMENT]` `[SHADOW]` `[SOCIAL]` `[SONG]` `[STONE]` `[TACTICS]` `[TIDE]` `[TIMER]` `[TRAP]` `[WIND]` `[ATTACK]`

## Migration Notes

- Every existing `hp` field is replaced by `resilience` per the TL mapping above.
- Every `key_attribute` numeric value is paired with a name.
- Every entry gets a `pool` equal to `TL + 1` unless the entry explicitly overrides it.
- Every adversary with `resilience: "None (puzzle)"` must have a `resolution`.
- Every adversary should have at least one SB spend. If missing, add a default `[ATTACK]` move.
