# Fate's Edge Adventure Creation Guide

## Introduction

This guide explains how to create and convert adventures for the Fate's Edge web client. Adventures are stored as JSON files in `data/adventures/` and are loaded by the Adventure Manager module. The client also supports displaying adventure details, tracking progress, and integrating with timers and encounters.

This guide covers:

- The adventure JSON schema
- Required and optional fields
- Best practices for authoring
- Converting existing HTML adventures to JSON
- Using the Crown Spread import feature
- Testing your adventure in the client

---

## 1. Adventure JSON Schema

An adventure is a JSON object with the following structure:

```json
{
  "id": "unique-id",
  "title": "Adventure Title",
  "description": "Short, compelling summary",
  "tier": "I",
  "tierRange": "I–III",
  "author": "Your Name",
  "sessions": "3–6",
  "themes": ["Theme1", "Theme2"],
  "status": "planned",
  "currentAct": 0,
  "currentScene": 0,
  "startedAt": null,
  "completedAt": null,
  "notes": "GM notes, tips, and behind-the-scenes info",
  "acts": [...],
  "npcs": [...],
  "locations": [...],
  "factions": [...],
  "campaignTimers": [...],
  "createdAt": "2026-07-28T00:00:00.000Z",
  "updatedAt": "2026-07-28T00:00:00.000Z"
}
```

### 1.1 Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier (e.g., `"lantern_at_dusk"`). Use lowercase with underscores. |
| `title` | string | ✅ | The adventure’s display title. |
| `description` | string | ✅ | A short, intriguing summary for the list view. |
| `tier` | string | ✅ | Tier (I, II, III, IV, V). Used for badges and filtering. |
| `tierRange` | string | Optional | Display range like `"I–III"` if the adventure spans multiple tiers. |
| `author` | string | ✅ | Your name or handle. |
| `sessions` | string | Optional | Estimated number of sessions (e.g., `"3–6"`). |
| `themes` | array | Optional | List of themes (e.g., `"Temptation"`, `"Folk Horror"`). |
| `status` | string | ✅ | `"planned"`, `"active"`, `"completed"`, or `"archived"`. |
| `currentAct` | number | ✅ | Index of the current act (0-based). |
| `currentScene` | number | ✅ | Index of the current scene within the act. |
| `startedAt` | string or null | ✅ | ISO date when started, or `null`. |
| `completedAt` | string or null | ✅ | ISO date when completed, or `null`. |
| `notes` | string | Optional | GM-only notes, tips, and adventure‑specific rulings. |
| `acts` | array | ✅ | Array of act objects (see below). |
| `npcs` | array | ✅ | Array of NPC objects (see below). |
| `locations` | array | ✅ | Array of location objects (see below). |
| `factions` | array | ✅ | Array of faction objects (see below). |
| `campaignTimers` | array | ✅ | Array of timer objects (see below). |
| `createdAt` | string | ✅ | ISO timestamp of creation. |
| `updatedAt` | string | ✅ | ISO timestamp of last update. |

---

## 2. Acts & Scenes

Acts group scenes together. Each act has:

```json
{
  "id": "act-entry",
  "title": "Scene 1 — The Entry",
  "description": "The barrow entrance is a narrow stone passage…",
  "scenes": [...]
}
```

Each scene has:

```json
{
  "id": "scene-entry",
  "title": "Clearing the Rubble",
  "description": "You must clear the collapsed stones to enter the barrow.",
  "completed": false,
  "timers": [...],
  "encounters": [...]
}
```

### 2.1 Timers Inside Scenes

Timers are shared across the adventure. Each timer object:

```json
{
  "name": "Barrow Collapse",
  "segments": 6,
  "current": 0,
  "description": "Ticks on failure inside. At 6, the entrance seals."
}
```

- `segments`: Total segments (4, 6, 8, or 10 recommended).
- `current`: The current tick count (starts at 0).
- `description`: What happens when the timer fills.

### 2.2 Encounters Inside Scenes

An encounter is a specific challenge with a roll and outcome branches:

```json
{
  "name": "Cave-in",
  "dv": 3,
  "position": "Controlled",
  "outcomes": {
    "clean": "You clear the rubble and enter.",
    "partial": "You get through but disturb rubble — tick Barrow Collapse +1.",
    "miss": "You are pinned by a rock — mark Harm 1 and tick Collapse +1."
  }
}
```

- `dv`: Difficulty Value (2–5+).
- `position`: `"Dominant"`, `"Controlled"`, or `"Desperate"`.
- `outcomes`: Three possible outcomes:
  - `clean`: Success with no Story Beats (SB=0)
  - `partial`: Success with SB, or progress with a cost
  - `miss`: Failure, escalation, and Boons gained

---

## 3. NPCs, Locations, Factions

### 3.1 NPCs

```json
{
  "id": "npc-sarai",
  "name": "Elder Sarai",
  "role": "Village elder of Duskwood",
  "motivation": "Save her village from the blight.",
  "stats": "Presence 3, Sway 2",
  "secret": "She knows the lantern's true origin.",
  "tell": "Touches her forehead before speaking."
}
```

- `role`: Short description of their function.
- `motivation`: What drives them.
- `stats` (optional): Key attributes/skills for quick reference.
- `secret` (optional): Hidden info the GM can reveal.
- `tell` (optional): A mannerism or clue.

### 3.2 Locations

```json
{
  "id": "loc-barrow",
  "name": "The Old Barrow",
  "description": "A moss-covered stone mound on a hill overlooking Duskwood.",
  "tags": ["ruin", "barrow", "threshold"]
}
```

- `tags` (optional): For filtering or mood.

### 3.3 Factions

```json
{
  "id": "faction-serpent-cult",
  "name": "The Serpent Cult of Midh Ahkaz",
  "goals": "Complete the ritual of transformation.",
  "relationship": "The cult is the primary antagonist."
}
```

- `goals`: What the faction wants.
- `relationship`: How the faction interacts with the party.

---

## 4. Campaign Timers

These are global timers that track the adventure’s overarching pressure:

```json
{
  "name": "Desire Index",
  "segments": 6,
  "current": 0,
  "description": "Each granted wish (+1). Price magnitude escalates with the index."
}
```

They appear in the detail view and can be advanced via the UI.

---

## 5. Best Practices for Authoring

### 5.1 Start with a Strong Premise

Your adventure should answer:

- **What is the situation?** (e.g., a cursed lantern in a barrow)
- **What is the problem?** (e.g., blight spreading)
- **What must the party do?** (e.g., retrieve the lantern and break the curse)
- **What stands in their way?** (e.g., spirits, a rival, collapsing barrow)

### 5.2 Design for the Core Loop

Fate’s Edge is built around Position, DV, Timers, and Outcomes. Each encounter should:

- Have a clear **stake** (what is risked?).
- Offer **meaningful choices** (negotiate, fight, sneak, etc.).
- Use **Timers** to create urgency.
- Reward **Boon spending** and **embracing failure**.

### 5.3 Keep Scenes Bite‑Sized

- 3–5 scenes per act.
- Each scene should be resolvable in 15–30 minutes of play.
- Use the `encounters` array to define the core roll, but allow improvisation.

### 5.4 Tie Timers to Fiction

Name timers descriptively (e.g., `"Barrow Collapse"` not `"Timer 3"`). Tick them aloud: *“The cult’s chant grows louder — Ritual Completion advances to 4 of 6.”*

### 5.5 Embrace the Outcome Matrix

Define `clean`, `partial`, and `miss` outcomes that change the fiction, not just apply penalties. A `partial` should give the player a Boon and move the story forward, not stall it.

---

## 6. Converting Existing HTML Adventures to JSON

If you have a plain‑text or HTML adventure, follow these steps to convert it to JSON for the web client:

1. **Extract the structure** into acts and scenes.
2. **Identify each major challenge** as an `encounter` with `dv`, `position`, and three outcomes.
3. **List NPCs, locations, and factions** as separate arrays.
4. **Define campaign timers** that track overarching pressure.
5. **Add metadata** (title, description, tier, author, sessions).

**Example conversion from HTML:**

```html
<h1>The Lantern at Dusk</h1>
<p>A blight is spreading from an old barrow...</p>
<h2>The Entry</h2>
<p>A cave-in blocks the way. Roll Body + Athletics (DV 3).</p>
<ul>
  <li>Success: You clear the rubble.</li>
  <li>Partial: You clear it but disturb rubble (tick Collapse).</li>
  <li>Miss: You are pinned (Harm 1).</li>
</ul>
```

Becomes the JSON structure shown earlier.

---

## 7. Using the Crown Spread Import

The Adventure Manager has a **"Import Crown Spread"** button that reads recent Crown Spread draws from the VTT or GM session log and turns them into a structured adventure.

**How it works:**

1. In the **Decks** tab, select a region and draw a Crown Spread (or draw via the VTT).
2. The spread result appears in the VTT chat or GM log.
3. In the **Adventures** tab, click **"Import Crown Spread"**.
4. Pick a recent spread from the list.
5. Enter a title and tier.
6. The adventure is created with:
   - One act titled *"The Reading Unfolds"*
   - One scene containing the spread’s synthesis
   - A campaign timer named *"Adventure Clock"*
7. You can then edit the adventure manually to add more acts and scenes.

This is a great way to bootstrap an adventure from a random draw.

---

## 8. Testing Your Adventure

### 8.1 Place the JSON file

Put your `your_adventure.json` file in `data/adventures/`.

### 8.2 Update the manifest

Run the manifest generation script (if your build system includes it) or manually add the slug to `data/adventures/manifest.json`:

```json
[
  "your_adventure"
]
```

### 8.3 Load in the client

1. Open the web client.
2. Go to the **Adventures** tab.
3. Click **"Browse Library"**.
4. Select your adventure from the list.
5. It should load and appear in the list with its title and tier.

### 8.4 Verify all fields

- Check that the detail view shows all acts and scenes.
- Timers display correctly.
- NPCs, locations, and factions appear in the side panel.
- The **"Start"** button sets the adventure active and resets timers.
- **"Complete Scene"** advances progress.

### 8.5 Check for errors

If the adventure doesn’t load or shows "undefined":

- Ensure `tierRange` exists (the UI uses it for display).
- Verify that `acts`, `npcs`, `locations`, `factions` are arrays (even empty).
- Confirm all IDs are unique.
- Make sure timestamps are valid ISO strings.

---

## 9. File Naming & Organization

- **JSON filename:** `your_adventure_id.json` (same as the `id` field).
- **HTML display file (optional):** If you want a beautiful standalone HTML version of the adventure, place it in `data/docs/adventures/` and add it to `manifest-core.json` or the docs manifest.
- **Images & maps:** Store in `data/media/` and reference relative paths.

---

## 10. Example Adventure Template

Here is a minimal valid adventure JSON to get you started:

```json
{
  "id": "my_first_adventure",
  "title": "The Broken Bridge",
  "description": "A bridge collapse threatens a village. The party must cross the ravine and find a way to rebuild before the spring floods arrive.",
  "tier": "I",
  "tierRange": "I",
  "author": "Your Name",
  "sessions": "2–3",
  "themes": ["Rebuilding", "Survival", "Community"],
  "status": "planned",
  "currentAct": 0,
  "currentScene": 0,
  "startedAt": null,
  "completedAt": null,
  "notes": "This adventure highlights social interactions and resource management.",
  "acts": [
    {
      "id": "act-one",
      "title": "Act 1 — The Village",
      "description": "The party arrives to find the village in distress.",
      "scenes": [
        {
          "id": "scene-meet-elder",
          "title": "Meeting the Elder",
          "description": "The village elder explains the situation.",
          "completed": false,
          "timers": [],
          "encounters": [
            {
              "name": "Persuade for Help",
              "dv": 3,
              "position": "Controlled",
              "outcomes": {
                "clean": "The elder agrees to help you.",
                "partial": "The elder is hesitant—you gain only limited support.",
                "miss": "The elder refuses. You must find another way."
              }
            }
          ]
        }
      ]
    }
  ],
  "npcs": [],
  "locations": [],
  "factions": [],
  "campaignTimers": [],
  "createdAt": "2026-07-28T00:00:00.000Z",
  "updatedAt": "2026-07-28T00:00:00.000Z"
}
```

---

## 11. Troubleshooting Common Issues

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Adventure doesn't appear in Browse Library | Manifest missing or filename mismatch | Run the manifest generator or add the slug manually to `manifest.json` |
| Detail view shows "undefined" for tier | `tierRange` missing | Add `"tierRange": "I"` (or appropriate value) |
| Timers not ticking | Encounter outcome references a timer name that doesn’t match | Use exact timer names as in `campaignTimers` |
| NPCs not showing | `npcs` array is empty or malformed | Ensure it’s an array of objects with at least `name` |
| Encounter outcomes don’t apply | Missing `clean`, `partial`, or `miss` keys | All three are required |
| Adventure fails to load with JSON parse error | Invalid JSON (trailing comma, missing quotes, etc.) | Validate with a JSON linter (e.g., jsonlint.com) |

---

## 12. Further Reading

- **Essential Guide:** Core rules for Fate’s Edge.
- **GM Screen:** Quick reference for running sessions.
- **Web Client Docs:** For detailed module APIs (Adventure Manager, Encounters, Timers).

---

## 13. Final Advice

- **Start simple.** Your first adventure can be a one‑shot with 3–5 scenes.
- **Playtest.** Run the adventure with your group and adjust the JSON accordingly.
- **Iterate.** Update the JSON after each session to reflect new timers, completed scenes, and notes.
- **Share.** You can export an adventure as a JSON file and share it with other GMs.

Now go forth and create! The web client is your canvas, and Fate’s Edge awaits.