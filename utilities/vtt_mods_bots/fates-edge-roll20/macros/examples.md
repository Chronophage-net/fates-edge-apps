# Fate's Edge Roll20 Macros - Complete Reference v2.1.0

## 📋 Table of Contents
1. [Quick Commands](#quick-commands)
2. [Chat Macros](#chat-macros)
3. [Dice Roll Macros](#dice-roll-macros)
4. [Character Sync Macros](#character-sync-macros)
5. [Timer Macros](#timer-macros)
6. [Scene Macros](#scene-macros)
7. [Combat Macros](#combat-macros)
8. [GM Macros](#gm-macros)
9. [GM Election & Promotion](#gm-election--promotion)
10. **[NEW] Adventure Engine Macros**  ← ADDED
11. [Utility Macros](#utility-macros)
12. [Advanced API Scripts](#advanced-api-scripts)

---

## Quick Commands
*(unchanged – see previous version)*

---

## Chat Macros
*(unchanged)*

---

## Dice Roll Macros
*(unchanged)*

---

## Character Sync Macros
*(unchanged)*

---

## Timer Macros
*(unchanged)*

---

## Scene Macros
*(unchanged)*

---

## Combat Macros
*(unchanged)*

---

## GM Macros
*(unchanged)*

---

## GM Election & Promotion
*(unchanged – see previous version)*

---

## 🆕 Adventure Engine Macros (v2.1.0)

### Basic Adventure Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge adventure load <moduleId>` | Load an adventure module by ID | `!fates-edge adventure load blood_and_silk_saga` |
| `!fates-edge adventure scene [actIndex] [sceneIndex]` | Advance to a scene (omit both to go sequential) | `!fates-edge adventure scene 1 0` |
| `!fates-edge adventure encounter start <ref>` | Start an encounter (ref = index or name/creatureId) | `!fates-edge adventure encounter start 2` |
| `!fates-edge adventure encounter resolve <outcome> [notes]` | Resolve encounter (clean|partial|miss) | `!fates-edge adventure encounter resolve clean "They win"` |
| `!fates-edge adventure timer <name> [amount] [scope]` | Tick a timer (scope: scene|campaign) | `!fates-edge adventure timer "Village Safety" 1 scene` |
| `!fates-edge adventure log <text> [author]` | Append a narrative beat | `!fates-edge adventure log "The bell tolls midnight." GM` |
| `!fates-edge adventure status` | Show current adventure state | `!fates-edge adventure status` |
| `!fates-edge adventure reference` | Show reference data (bestiary, NPCs, etc.) | `!fates-edge adventure reference` |
| `!fates-edge adventure reset` | Reset adventure to start | `!fates-edge adventure reset` |

---

### Adventure Macros

```javascript
// Load an adventure module
!fates-edge adventure load blood_and_silk_saga
!fates-edge send "📖 Adventure loaded: **Blood and Silk Saga**"

// Advance scene (sequential)
!fates-edge adventure scene
!fates-edge send "🎭 Scene advanced."

// Jump to specific scene
!fats-edge adventure scene 2 1
!fates-edge send "🎭 Jumped to Act 2, Scene 1"

// Start an encounter
!fates-edge adventure encounter start "Goblin Ambush"
!fates-edge send "⚔️ Encounter started!"

// Resolve an encounter
!fates-edge adventure encounter resolve partial "Some enemies flee"
!fates-edge send "⚔️ Encounter resolved as Partial"

// Tick a scene timer
!fates-edge adventure timer "Ritual" 1 scene
!fates-edge send "⏱️ Ritual timer advanced"

// Tick a campaign timer
!fates-edge adventure timer "World Crisis" 2 campaign
!fates-edge send "⏱️ Campaign timer advanced"

// Add a log entry
!fates-edge adventure log "The party discovers a hidden passage." "GM"
!fates-edge send "📝 Log entry added"

// Check adventure status
!fates-edge adventure status
!fates-edge send "📊 Current adventure status: ..."

// Get reference data
!fates-edge adventure reference
!fates-edge send "📚 Reference data sent to chat."

// Reset adventure
!fates-edge adventure reset
!fates-edge send "🔄 Adventure reset."
```

### Advanced Adventure Macros

```javascript
// Load adventure and set region
!fates-edge region "Acasia"
!fates-edge adventure load "carnival_of_broken_dreams"
!fats-edge send "📍 Region set to Acasia. Adventure loaded."

// Scene transition with narration
!fates-edge adventure scene 0 1
!fates-edge send "🎭 **Scene:** The Carnival Gate"
!fates-edge send "*The twisted iron gate groans open...*"

// Start encounter with creature reference
!fates-edge adventure encounter start "Void Hound"
!fates-edge send "⚔️ A **Void Hound** lunges from the shadows!"

// Resolve with a custom outcome
!fates-edge adventure encounter resolve clean "The party finds a clue"
!fates-edge send "🔍 The encounter ends cleanly. A scrap of parchment is found."

// Combine timer with a log entry
!fates-edge adventure timer "Portal Collapse" 1 scene
!fates-edge adventure log "The portal shudders violently." "GM"
!fates-edge send "⏱️ Portal Collapse timer ticked. Logged the event."

// Full adventure status report
!fates-edge adventure status
// Output:
// 📖 **Adventure Status**
// Title: Carnival of Broken Dreams
// Status: active
// Act: The Gate of Whispers
// Scene: The Empty Midway
// Encounter: Carnival Barker (DV 3, Controlled)
// Campaign Timers: World Crisis: 2/6
// Last log: The carnival ringmaster bows.

// Reference data display
!fates-edge adventure reference
// Output:
// 📚 **Reference: carnival_of_broken_dreams**
// 🐉 Bestiary (4): Void Hound (TL2), Clockwork Jester (TL3), ...
// 👤 NPCs (6): Ringmaster (NPC), Fortune Teller (NPC), ...
// 📍 Locations (3): The Midway, The Hall of Mirrors, ...
// ⚑ Factions (1): The Carnival Guild
// 📝 Notes: The carnival moves at midnight.

// Reset with confirmation
!fates-edge adventure reset
!fates-edge send "🔄 Adventure reset. All progress lost."
```

### Adventure Integration with Other Systems

```javascript
// Load adventure and sync characters
!fates-edge adventure load "whispers_in_the_tunnels"
!fates-edge sync characters
!fates-edge send "📖 Adventure loaded. Characters synced."

// Scene change with timer reset
!fates-edge adventure scene 1 0
!fates-edge timer reset "Scene Timer"
!fates-edge send "🎭 New scene. Timer reset."

// Encounter start with initiative
!fates-edge adventure encounter start "Cave Troll"
!fates-edge combat start
!fates-edge combat init "Aria" 18
!fats-edge send "⚔️ Encounter started! Combat begins."

// Log combat outcome
!fates-edge adventure encounter resolve clean
!fates-edge adventure log "The party defeats the Cave Troll." "GM"
!fates-edge combat end
!fates-edge send "✅ Encounter resolved. Combat ended."

// Full adventure session start macro
!fates-edge connect
!fates-edge sync characters
!fates-edge region "Valewood"
!fates-edge adventure load "serpents_coil"
!fates-edge adventure status
!fates-edge send "🚀 **Session Ready!** Adventure loaded and synced."
```

---

## Utility Macros
*(unchanged)*

---

## Advanced API Scripts

### Updated Full API Script with Adventure Commands

Add these command handlers inside the existing `registerCommand` function for `!fates-edge`:

```javascript
// Inside the command switch in registerCommand
case 'adventure': cmdAdventure(params); break;

// Adventure command handler implementation
function cmdAdventure(params) {
    const subcommand = params[0] || '';
    const args = params.slice(1);

    switch (subcommand) {
        case 'load':
            if (args.length === 0) {
                sendChat('Fate\'s Edge', '❌ Usage: !fates-edge adventure load <moduleId>');
                break;
            }
            FatesEdge.sendAdventureLoad(args[0]);
            sendChat('Fate\'s Edge', `📖 Load requested: ${args[0]}`);
            break;

        case 'scene':
            const actIdx = args[0] !== undefined ? parseInt(args[0]) : undefined;
            const sceneIdx = args[1] !== undefined ? parseInt(args[1]) : undefined;
            FatesEdge.sendAdventureScene(actIdx, sceneIdx);
            let sceneMsg = '🎭 Scene change requested';
            if (actIdx !== undefined) sceneMsg += ` (act ${actIdx})`;
            if (sceneIdx !== undefined) sceneMsg += ` (scene ${sceneIdx})`;
            if (actIdx === undefined && sceneIdx === undefined) sceneMsg += ' (sequential)';
            sendChat('Fate\'s Edge', sceneMsg);
            break;

        case 'encounter':
            const encSub = args[0] || '';
            const encArgs = args.slice(1);
            if (encSub === 'start') {
                if (encArgs.length === 0) {
                    sendChat('Fate\'s Edge', '❌ Usage: !fates-edge adventure encounter start <ref>');
                    break;
                }
                const ref = isNaN(encArgs[0]) ? encArgs[0] : parseInt(encArgs[0]);
                FatesEdge.sendAdventureEncounterStart(ref);
                sendChat('Fate\'s Edge', `⚔️ Encounter start: ${encArgs[0]}`);
            } else if (encSub === 'resolve') {
                if (encArgs.length === 0) {
                    sendChat('Fate\'s Edge', '❌ Usage: !fates-edge adventure encounter resolve <clean|partial|miss> [notes]');
                    break;
                }
                const outcome = encArgs[0];
                if (!['clean', 'partial', 'miss'].includes(outcome)) {
                    sendChat('Fate\'s Edge', '❌ Outcome must be clean, partial, or miss.');
                    break;
                }
                const notes = encArgs.slice(1).join(' ');
                FatesEdge.sendAdventureEncounterResolve(outcome, notes);
                sendChat('Fate\'s Edge', `⚔️ Encounter resolved: ${outcome}`);
            } else {
                sendChat('Fate\'s Edge', '❌ Encounter subcommands: start, resolve');
            }
            break;

        case 'timer':
            if (args.length === 0) {
                sendChat('Fate\'s Edge', '❌ Usage: !fates-edge adventure timer <name> [amount] [scene|campaign]');
                break;
            }
            const timerName = args[0];
            const timerAmount = args[1] !== undefined ? parseInt(args[1]) : 1;
            const timerScope = args[2] || 'scene';
            FatesEdge.sendAdventureTimer(timerName, timerAmount, timerScope);
            sendChat('Fate\'s Edge', `⏱️ Timer "${timerName}" ticked by ${timerAmount} (${timerScope})`);
            break;

        case 'log':
            if (args.length === 0) {
                sendChat('Fate\'s Edge', '❌ Usage: !fates-edge adventure log <text> [author]');
                break;
            }
            const logText = args[0];
            const logAuthor = args[1] || getPlayerName();
            FatesEdge.sendAdventureLog(logText, logAuthor);
            sendChat('Fate\'s Edge', `📝 Log: "${logText}"`);
            break;

        case 'status':
            FatesEdge.sendAdventureStatus();
            sendChat('Fate\'s Edge', '📋 Requesting adventure status...');
            break;

        case 'reference':
            FatesEdge.sendAdventureReference();
            sendChat('Fate\'s Edge', '📚 Requesting adventure reference...');
            break;

        case 'reset':
            FatesEdge.sendAdventureReset();
            sendChat('Fate\'s Edge', '🔄 Adventure reset requested.');
            break;

        default:
            sendChat('Fate\'s Edge', `
📖 Adventure Commands:
!fates-edge adventure load <moduleId>
!fates-edge adventure scene [actIndex] [sceneIndex]
!fates-edge adventure encounter start <ref>
!fates-edge adventure encounter resolve <clean|partial|miss> [notes]
!fates-edge adventure timer <name> [amount] [scene|campaign]
!fates-edge adventure log <text> [author]
!fates-edge adventure status
!fates-edge adventure reference
!fates-edge adventure reset
`);
            break;
    }
}
```

---

## 🎯 Quick Reference Card (Updated)

```javascript
// Connection & Status
!fates-edge connect
!fates-edge status

// Chat
!fates-edge send "Hello VTT!"
!fates-edge whisper "GM" "Secret"

// Dice
!fates-edge roll 3d6+2
!fates-edge roll 1d20 "Attack"

// Sync
!fates-edge sync characters
!fates-edge sync scene

// Timers
!fates-edge timer create "Ritual" 6
!fates-edge timer tick "Ritual"
!fates-edge timer list

// Combat
!fates-edge combat start
!fates-edge combat init "Aria" 18
!fates-edge combat next

// GM
!fates-edge gm "They see the trap"
!fates-edge reveal "You found a key"

// GM Election
!fates-edge gm request
!fates-edge gm approve "Aria"
!fates-edge gm status

// 🆕 Adventure Engine
!fates-edge adventure load blood_and_silk_saga
!fates-edge adventure scene 1 0
!fates-edge adventure encounter start 2
!fates-edge adventure encounter resolve clean
!fates-edge adventure timer "Ritual" 1 scene
!fates-edge adventure log "The party rests." GM
!fates-edge adventure status
!fates-edge adventure reference
!fates-edge adventure reset
```

---

## 📝 Notes

1. All commands are case-insensitive.
2. Adventure commands require the v2.1.0 API script (or later).
3. `moduleId` must match an adventure file in the server's `data/adventures/` directory.
4. `ref` for encounters can be an index (number) or a name/creatureId (string).
5. Scopes for timers: `scene` (default) or `campaign`.
6. Log entries are stored in the adventure log and synced to all clients.
7. `adventure status` and `reference` fetch fresh data from the server via REST API.