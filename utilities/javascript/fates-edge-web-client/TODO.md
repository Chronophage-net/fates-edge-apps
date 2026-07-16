# Web Client Feature Improvements — Implementation Todo

This document outlines the prioritized features with detailed implementation steps. All features are designed to integrate cleanly with the existing codebase without adding clutter.

---

## Priority 1: Quick-Generate Panel (Scene Tab)

**Goal:** Add a one-click random generator for NPCs, Locations, and Rumors using the region's deck data.

### File Changes

| File | Change |
|------|--------|
| `js/features/dashboard/scene-tools.js` | Add new panel in `renderSceneView()` |
| `js/features/dashboard/scene-tools.js` | Add event handlers for generate buttons |
| `js/features/dashboard/scene-tools.js` | Add helper functions: `generateNPC()`, `generateLocation()`, `generateRumor()` |
| `js/core/state.js` | Add `sceneQuickGen` state if needed (optional) |

### Implementation Details

#### 1.1 Add Panel to Scene View

In `renderSceneView()`, add a new panel after the Quick Actions panel:

```javascript
// In renderSceneView(), after Quick Actions panel
<div class="panel">
    <h3 class="panel-title">⚡ Quick Generate</h3>
    <div class="quick-gen-grid" style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;">
        <button class="btn btn-sm btn-gold" id="gen-npc-btn">👤 NPC</button>
        <button class="btn btn-sm btn-gold" id="gen-location-btn">📍 Location</button>
        <button class="btn btn-sm btn-gold" id="gen-rumor-btn">📜 Rumor</button>
        <span style="font-size:0.8rem;color:var(--text3);margin-left:0.5rem;">
            Uses current region's deck
        </span>
    </div>
    <div id="quick-gen-result" style="margin-top:0.5rem;background:var(--bg3);padding:0.5rem 0.8rem;border-radius:var(--radius);min-height:40px;border-left:3px solid var(--gold);font-size:0.9rem;color:var(--text2);">
        <span class="text-muted">Generate an NPC, Location, or Rumor.</span>
    </div>
</div>
```

#### 1.2 Helper Functions

Add these functions to `scene-tools.js`:

```javascript
function generateNPC() {
    const region = getSelectedRegion();
    if (!region) { showToast('Select a region first.', 'error'); return; }
    const data = getRegionData();
    if (!data) { showToast('No region data loaded.', 'error'); return; }
    
    // Draw a Heart (motivation) and optionally a Club (complication)
    // Use the deck module's draw or quickDraw
    import('../decks/index.js').then(module => {
        module.quickDraw(2).then(result => {
            if (!result) return;
            const cards = result.cards;
            const motivation = cards[0] ? getCardMeaningFromRegion(cards[0].suit, cards[0].rank, data) : 'Unknown motivation';
            const complication = cards[1] ? getCardMeaningFromRegion(cards[1].suit, cards[1].rank, data) : 'No complication';
            const names = generateRandomName(region);
            const npc = {
                name: names.name,
                surname: names.surname,
                epithet: names.epithet,
                motivation: motivation,
                complication: complication
            };
            displayQuickGenResult(renderNPC(npc));
            logToSession(`Generated NPC: ${npc.name} "${npc.epithet}"`);
        });
    });
}

function generateLocation() {
    // Similar: draw Spade (place) + Diamond (leverage)
}

function generateRumor() {
    // Single draw, any suit → interpret as gossip
}
```

#### 1.3 Random Name Generation

Add a name generator that pulls from the region's naming conventions. For simplicity, use the region data's existing name tables if available, or use a fallback list from the lore.

```javascript
function generateRandomName(region) {
    // Use region-specific name lists from the GM guide
    // Fallback: generic names
    const firstNames = ['Aldric', 'Valerius', 'Kestra', 'Lyra', 'Thrain', 'Elara'];
    const surnames = ['de la Marche', 'Aquilinus', 'Everblood', 'Longwood', 'Aezenbron'];
    const epithets = ['the Iron', 'the Unbuckled', 'the Silent', 'the Unseen', 'the Gray'];
    return {
        name: firstNames[getTravelRandomInt(0, firstNames.length)],
        surname: surnames[getTravelRandomInt(0, surnames.length)],
        epithet: epithets[getTravelRandomInt(0, epithets.length)]
    };
}
```

#### 1.4 Display Helpers

```javascript
function renderNPC(npc) {
    return `
        <strong>${npc.name} ${npc.surname}</strong> <em>${npc.epithet}</em>
        <br>🎯 <strong>Motivation:</strong> ${npc.motivation}
        ${npc.complication ? `<br>⚡ <strong>Complication:</strong> ${npc.complication}` : ''}
    `;
}

function displayQuickGenResult(html) {
    const el = document.getElementById('quick-gen-result');
    if (el) el.innerHTML = html;
}
```

#### 1.5 Event Binding

Add to `attachEvents()` or a new `attachQuickGenEvents()`:

```javascript
document.getElementById('gen-npc-btn')?.addEventListener('click', generateNPC);
document.getElementById('gen-location-btn')?.addEventListener('click', generateLocation);
document.getElementById('gen-rumor-btn')?.addEventListener('click', generateRumor);
```

---

## Priority 2: Session Log / Recap (Campaign Tab)

**Goal:** Automatically log key events (timer completions, encounters, deck draws, travel generation, quick-gen) into a running log that can be copied and cleared.

### File Changes

| File | Change |
|------|--------|
| `js/core/state.js` | Add `sessionLog` to `campaignState` |
| `js/features/dashboard/scene-tools.js` | Add `logToSession()` function |
| `js/features/dashboard/scene-tools.js` | Display log in `renderCampaignView()` |
| `js/features/decks/index.js` | Call `logToSession()` on draws |
| `js/features/travel-planner/index.js` | Call `logToSession()` on journey generation |
| `js/features/timers/index.js` | Call `logToSession()` on timer completion |
| `js/features/encounters/index.js` | Call `logToSession()` on encounter start/completion |

### Implementation Details

#### 2.1 State Extension

In `js/core/state.js`, add to the default state:

```javascript
// In getDefaultState()
campaign: {
    whiteboard: { notes: [], drawings: [], stickyNotes: [] },
    kanban: { columns: { ... } },
    state: {
        activeThreats: [],
        opportunities: [],
        campaignTimers: [],
        notes: '',
        sessionLog: []  // NEW
    }
}
```

#### 2.2 Logging Function

In `scene-tools.js`:

```javascript
export function logToSession(message, type = 'info') {
    const state = getState();
    if (!state.campaign) state.campaign = {};
    if (!state.campaign.state) state.campaign.state = {};
    if (!state.campaign.state.sessionLog) state.campaign.state.sessionLog = [];
    
    const entry = {
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString(),
        message: message,
        type: type // 'info', 'success', 'warning', 'danger'
    };
    state.campaign.state.sessionLog.push(entry);
    saveState();
    
    // If log is visible, re-render
    refreshView();
}
```

#### 2.3 Display in Campaign View

Update `renderCampaignView()` in `scene-tools.js`:

```javascript
// Add after Campaign Timers panel
const sessionLog = campaign.sessionLog || [];

<div class="panel">
    <div class="panel-header">
        <h3 class="panel-title">📋 Session Log</h3>
        <div style="display:flex;gap:0.3rem;">
            <button class="btn btn-sm btn-secondary" onclick="window.copySessionLog()">📋 Copy</button>
            <button class="btn btn-sm btn-danger" onclick="window.clearSessionLog()">🗑️ Clear</button>
        </div>
    </div>
    <div id="session-log-container" style="max-height:250px;overflow-y:auto;font-size:0.85rem;font-family:monospace;background:var(--bg2);padding:0.5rem;border-radius:var(--radius);">
        ${sessionLog.length === 0 ? '<span class="text-muted">No events logged yet.</span>' : 
            sessionLog.map(entry => `
                <div style="padding:0.2rem 0;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;">
                    <span style="color:var(--text3);white-space:nowrap;">[${entry.time}]</span>
                    <span style="color:${entry.type === 'success' ? 'var(--green)' : entry.type === 'warning' ? 'var(--orange)' : entry.type === 'danger' ? 'var(--red)' : 'var(--text)'};">${entry.message}</span>
                </div>
            `).join('')
        }
    </div>
</div>
```

#### 2.4 Copy and Clear Functions

```javascript
window.copySessionLog = function() {
    const state = getState();
    const log = state.campaign?.state?.sessionLog || [];
    const text = log.map(e => `[${e.time}] ${e.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
        showToast('Session log copied.', 'success');
    }).catch(() => {
        prompt('Copy the log:', text);
    });
};

window.clearSessionLog = function() {
    if (!confirm('Clear the session log?')) return;
    const state = getState();
    if (state.campaign?.state) {
        state.campaign.state.sessionLog = [];
        saveState();
        refreshView();
        showToast('Session log cleared.', 'info');
    }
};
```

#### 2.5 Integration Points

Add `logToSession()` calls at key moments:

**In `decks/index.js`** (after `drawConsequence`):
```javascript
// After drawing cards
const cardNames = cards.map(c => c.isJoker ? '🃏 Joker' : `${c.rankName} of ${c.suitName}`).join(', ');
try {
    import('../dashboard/scene-tools.js').then(module => {
        if (module.logToSession) {
            module.logToSession(`🃏 Deck draw: ${cardNames} (${selectedRegion})`, 'info');
        }
    });
} catch (e) { /* ignore */ }
```

**In `travel-planner/index.js`** (after journey generation):
```javascript
// After generating journey
try {
    import('../dashboard/scene-tools.js').then(module => {
        if (module.logToSession) {
            module.logToSession(`🗺️ Journey generated: ${journey.startRegion} → ${journey.destRegion} (${journey.numLegs} legs)`, 'success');
        }
    });
} catch (e) { /* ignore */ }
```

**In `timers/index.js`** (when a timer completes):
```javascript
// When timer.current >= timer.segments
try {
    import('../dashboard/scene-tools.js').then(module => {
        if (module.logToSession) {
            module.logToSession(`⏱️ Timer completed: ${timer.name}`, 'warning');
        }
    });
} catch (e) { /* ignore */ }
```

---

## Priority 3: Ace Effects Integration

**Goal:** When an Ace is drawn in any deck or travel draw, trigger a thematic "Ace Effect" — an omen, Ninth Taboo manifestation, or regional quirk.

### File Changes

| File | Change |
|------|--------|
| `js/features/decks/index.js` | Add `getAceEffect()` and integrate into `drawConsequence()` |
| `js/features/travel-planner/index.js` | Highlight Ace cards and apply bonus effect |
| `js/features/dashboard/scene-tools.js` | Add Ace effect display in consequence view |

### Implementation Details

#### 3.1 Ace Effects Table

Create a new file `js/data/ace-effects.js` or embed in `decks/index.js`:

```javascript
// Ace effects by region (fallback to generic)
const ACE_EFFECTS = {
    generic: [
        { emoji: '👻', text: 'The Hollow takes notice. A pale figure watches from the corner of your eye.' },
        { emoji: '🔔', text: 'A bell rings without being struck. The ninth chime is silent.' },
        { emoji: '🌫️', text: 'Mist rolls in, carrying whispers of a debt unpaid.' },
        { emoji: '🕯️', text: 'A candle gutters and relights itself, burning blue.' },
        { emoji: '🃏', text: 'The Joker\'s wildcard manifests — the unexpected becomes inevitable.' }
    ],
    // Region-specific overrides
    mistlands: [
        { emoji: '🔔', text: 'A bell-line fails. Something steps through the gap.' },
        // ...
    ]
    // Add more regions as needed
};

export function getAceEffect(region, card) {
    const effects = ACE_EFFECTS[region] || ACE_EFFECTS.generic;
    const idx = getTravelRandomInt(0, effects.length);
    return effects[idx];
}
```

#### 3.2 Integrate into Decks Module

In `decks/index.js`, modify `drawConsequence()` to detect Aces:

```javascript
// After drawing cards, check for Aces
const aces = cards.filter(c => c.rank === 'A' && !c.isJoker);
if (aces.length > 0) {
    const effect = getAceEffect(selectedRegion, aces[0]);
    // Append effect to synthesis
    synthesis += `\n\n♠️ **ACE EFFECT:** ${effect.emoji} ${effect.text}`;
    // Show a toast notification
    showToast(`♠️ Ace Effect: ${effect.text}`, 'warning');
}
```

#### 3.3 Travel Planner Ace Highlighting

In `travel-planner/index.js`, modify `displayJourney()` to highlight Ace cards:

```javascript
// In the leg display, check if any card is an Ace
const hasAce = Object.values(leg.cards).some(c => c.rank === 'A');
if (hasAce) {
    // Add a special Ace badge and bonus effect
    const aceEffect = getAceEffect(destRegion, Object.values(leg.cards).find(c => c.rank === 'A'));
    // Display Ace badge with effect
}
```

---

## Priority 4: Tag Injector (Scene Tab)

**Goal:** Apply tags (e.g., `[WARD]`, `[FIRE]`, `[DARK]`) to the current scene, displayed as badges that affect Position/DV.

### File Changes

| File | Change |
|------|--------|
| `js/features/dashboard/scene-tools.js` | Add tag panel in Scene view |
| `js/core/state.js` | Add `sceneTags` to state |
| `js/features/dashboard/scene-tools.js` | Add tag display and removal logic |

### Implementation Details

#### 4.1 State Extension

```javascript
// In getDefaultState()
sceneTags: []
```

#### 4.2 Tag Panel in Scene View

```javascript
<div class="panel">
    <h3 class="panel-title">🏷️ Scene Tags</h3>
    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;">
        <input type="text" id="scene-tag-input" placeholder="e.g., WARD, FIRE, DARK" 
               style="flex:1;min-width:120px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem 0.6rem;color:var(--text);">
        <button class="btn btn-sm btn-primary" id="scene-tag-add-btn">+ Add Tag</button>
        <button class="btn btn-sm btn-secondary" id="scene-tag-clear-btn">Clear All</button>
    </div>
    <div id="scene-tag-container" style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.3rem;">
        ${(state.sceneTags || []).map(tag => `
            <span class="scene-tag" style="background:var(--bg3);padding:0.1rem 0.6rem;border-radius:12px;border:1px solid var(--gold);font-size:0.75rem;display:inline-flex;align-items:center;gap:0.3rem;">
                [${tag}]
                <span class="scene-tag-remove" data-tag="${tag}" style="cursor:pointer;color:var(--red);font-size:0.7rem;">✕</span>
            </span>
        `).join('')}
    </div>
    <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">
        Tags affect Position and DV for scene actions. Click ✕ to remove.
    </div>
</div>
```

#### 4.3 Tag Logic Functions

```javascript
// Add a tag
function addSceneTag(tag) {
    tag = tag.toUpperCase().trim();
    if (!tag) return;
    const state = getState();
    if (!state.sceneTags) state.sceneTags = [];
    if (state.sceneTags.includes(tag)) {
        showToast(`Tag [${tag}] already active.`, 'warning');
        return;
    }
    state.sceneTags.push(tag);
    saveState();
    refreshView();
    showToast(`Tag [${tag}] applied.`, 'success');
}

// Remove a tag
function removeSceneTag(tag) {
    const state = getState();
    if (!state.sceneTags) return;
    state.sceneTags = state.sceneTags.filter(t => t !== tag);
    saveState();
    refreshView();
}

// Clear all tags
function clearSceneTags() {
    const state = getState();
    state.sceneTags = [];
    saveState();
    refreshView();
    showToast('All tags cleared.', 'info');
}
```

#### 4.4 Tag Effects on Rolls

In the dice or action resolution flow, check for scene tags:

```javascript
function getTagEffects() {
    const state = getState();
    const tags = state.sceneTags || [];
    let dvMod = 0;
    let posMod = 0;
    tags.forEach(tag => {
        // Apply tag-specific effects
        switch(tag) {
            case 'WARD': dvMod += 1; break;
            case 'FIRE': posMod -= 1; break;
            case 'DARK': posMod -= 1; break;
            case 'LIGHT': posMod += 1; break;
            // Add more tag effects as needed
        }
    });
    return { dvMod, posMod };
}
```

---

## Priority 5: Journey Export/Import (Travel Planner)

**Goal:** Export a generated journey as JSON (copy or download) and import a JSON to restore it.

### File Changes

| File | Change |
|------|--------|
| `js/features/travel-planner/index.js` | Add export/import buttons and functions |

### Implementation Details

#### 5.1 Export Function

```javascript
function exportJourney() {
    if (!currentJourney) {
        showToast('No journey to export.', 'error');
        return;
    }
    const json = JSON.stringify(currentJourney, null, 2);
    // Option 1: Download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journey-${currentJourney.startRegion}-to-${currentJourney.destRegion}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Journey exported.', 'success');
}
```

#### 5.2 Import Function

```javascript
function importJourney() {
    // Create a file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                // Basic validation
                if (data.startRegion && data.destRegion && data.legs && Array.isArray(data.legs)) {
                    currentJourney = data;
                    displayJourney(data);
                    addToHistory(data);
                    showToast(`Journey imported: ${data.startRegion} → ${data.destRegion}`, 'success');
                } else {
                    showToast('Invalid journey data.', 'error');
                }
            } catch (err) {
                showToast('Error parsing journey data.', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}
```

#### 5.3 UI Buttons

Add to the travel display panel:

```javascript
<div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
    <!-- Existing buttons -->
    <button class="btn btn-sm btn-primary" id="travel-add-timer-btn">⏱️ Add Timer</button>
    <button class="btn btn-sm btn-secondary" id="travel-copy-btn">📋 Copy Summary</button>
    <button class="btn btn-sm btn-secondary" id="travel-export-btn">📤 Export</button>
    <button class="btn btn-sm btn-secondary" id="travel-import-btn">📥 Import</button>
</div>
```

---

## Implementation Order

| Order | Feature | Estimated Time |
|-------|---------|----------------|
| 1 | Quick-Generate Panel | 2-3 hours |
| 2 | Session Log | 2-3 hours |
| 3 | Ace Effects | 1-2 hours |
| 4 | Tag Injector | 1-2 hours |
| 5 | Journey Export/Import | 1 hour |

---

## Testing Checklist

### Quick-Generate Panel
- [ ] NPC generation works with region data
- [ ] Location generation works
- [ ] Rumor generation works
- [ ] Results display in the result area
- [ ] Session log receives entries

### Session Log
- [ ] Events are logged on deck draws
- [ ] Events are logged on timer completion
- [ ] Events are logged on journey generation
- [ ] Events are logged on quick-gen
- [ ] Copy button works
- [ ] Clear button works

### Ace Effects
- [ ] Ace draws trigger effects
- [ ] Effects display in result
- [ ] Toast notification appears
- [ ] Travel planner highlights Ace cards

### Tag Injector
- [ ] Tags can be added
- [ ] Tags display as badges
- [ ] Tags can be removed by clicking ✕
- [ ] Clear All works
- [ ] Tag effects apply to rolls

### Journey Export/Import
- [ ] Export downloads a JSON file
- [ ] Import loads a JSON file
- [ ] Imported journey displays correctly
- [ ] Imported journey is added to history

---

## Design Notes

- **Toast Integration**: All features use the existing `showToast()` component.
- **State Persistence**: All features use the existing `getState()`/`saveState()` pattern.
- **Region Awareness**: Quick-Generate and Ace Effects use the current region from the decks module.
- **Minimal UI Footprint**: Each feature adds at most one panel or a small row of controls.
- **WebSocket**: The session log is local-only (not synced), keeping it lightweight.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `js/features/dashboard/scene-tools.js` | **Modify** — Add panels, functions, event handlers |
| `js/core/state.js` | **Modify** — Add `sessionLog`, `sceneTags` |
| `js/features/decks/index.js` | **Modify** — Add Ace effects, session log integration |
| `js/features/travel-planner/index.js` | **Modify** — Add Ace effects, export/import |
| `js/features/timers/index.js` | **Modify** — Add session log integration |
| `js/features/encounters/index.js` | **Modify** — Add session log integration |
| `js/data/ace-effects.js` | **Create** — Ace effects table |

---

Ready to start implementing. Let me know which feature you'd like me to build first.
