# Fate's Edge Roll20 Macros - Complete Reference

---

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
10. [Utility Macros](#utility-macros)
11. [Advanced API Scripts](#advanced-api-scripts)

---

## Quick Commands

### Connection Management

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge connect` | Connect to the VTT server | `!fates-edge connect` |
| `!fates-edge disconnect` | Disconnect from the VTT server | `!fates-edge disconnect` |
| `!fates-edge reconnect` | Force a reconnection | `!fates-edge reconnect` |
| `!fates-edge status` | Show connection status | `!fates-edge status` |
| `!fates-edge ping` | Test connection latency | `!fates-edge ping` |

### Quick Macros

```javascript
// Connection Status Display
!fates-edge status
!fates-edge send 📊 VTT Status: $[connected ? '🟢 Online' : '🔴 Offline']

// Auto-connect on game load
on('ready', () => {
    !fates-edge connect
});
```

---

## Chat Macros

### Basic Chat

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge send <message>` | Send message to VTT | `!fates-edge send Hello everyone!` |
| `!fates-edge whisper <player> <message>` | Whisper to specific player | `!fates-edge whisper GM I need help` |
| `!fates-edge emote <action>` | Send emote/action | `!fates-edge emote *drinks from flask*` |
| `!fates-edge announce <message>` | Announce with formatting | `!fates-edge announce Session starts in 5 minutes!` |

### Chat Macros

```javascript
// Send a formatted message
!fates-edge send "**📢 Announcement:** The ritual begins at midnight!"

// Send an emote
!fates-edge emote "/me *draws a deep breath and steps into the shadows*"

// Send a system message
!fates-edge send "🎲 **System:** Initiative has been rolled. Combat begins!"

// Send a GM whisper
!fates-edge whisper "GM" "The hidden trap door is under the rug."

// Announce with timestamp
!fates-edge announce "⏰ **Session starts at:** ${new Date().toLocaleTimeString()}"
```

### Rich Formatting Examples

```javascript
// Bold and Italic
!fates-edge send "**Bold text** and *italic text*"

// Headers
!fates-edge send "# 📢 Announcement"
!fates-edge send "## 🎯 Objective"
!fates-edge send "### 📋 Details"

// Lists
!fates-edge send "- Item 1\n- Item 2\n- Item 3"

// Emojis
!fates-edge send "✅ Done\n⚠️ Warning\n❌ Failed\n📌 Note"
```

---

## Dice Roll Macros

### Basic Rolls

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge roll <dice>` | Roll dice and broadcast | `!fates-edge roll 3d6+2` |
| `!fates-edge d <dice>` | Shortcut for dice roll | `!fates-edge d 2d10` |
| `!fates-edge roll <dice> <reason>` | Roll with reason | `!fates-edge roll 4d6 "Attack"` |

### Dice Roll Macros

```javascript
// Basic attack roll
!fates-edge roll 3d6 "**⚔️ Attack:** The goblin swings its rusty sword!"

// Skill check
!fates-edge roll 5d4+3 "**🔍 Perception:** Looking for hidden traps"

// Damage roll
!fates-edge roll 2d8+5 "**💥 Damage:** The blade strikes true!"

// Multiple dice
!fates-edge roll 4d6+2d4+5 "**⚡ Combined:** Fire and lightning"

// Fudge dice (FATE style)
!fates-edge roll 4dF "**🎭 Fate Check:** The universe decides"

// Percentile roll
!fates-edge roll 1d100 "**🎲 Percentile:** Luck roll"

// Critical hit tracking
!fates-edge roll 3d6 "**⚔️ Attack Roll**"
!fates-edge roll 2d8 "**💥 Damage on hit**"

// Saving throw
!fates-edge roll 2d10+4 "**🛡️ Saving Throw:** Resisting the poison"

// Initiative roll
!fates-edge roll 1d20 "**⏱️ Initiative:**"
```

### Complex Dice Expressions

```javascript
// Multiple dice types
!fates-edge roll 2d6+3d4+1d8 "**🌀 Complex:** Several dice"

// Advantage/Disadvantage (keep highest/lowest)
!fates-edge roll 2d20kh1 "**⭐ Advantage:** Roll two, keep highest"
!fates-edge roll 2d20kl1 "**⚠️ Disadvantage:** Roll two, keep lowest"

// Exploding dice
!fates-edge roll 3d10! "**💥 Exploding:** Reroll 10s"

// Target number
!fates-edge roll 3d6>4 "**🎯 Target 4:** Count successes"

// Critical hit macro
!fates-edge roll 1d20 "**⚔️ Attack Roll**"
!fates-edge roll 2d6+3 "**💥 Damage:** On hit"

// Roll with advantage and damage
!fates-edge roll 2d20kh1 "**⚔️ Attack with Advantage**"
!fates-edge roll 2d6+4 "**💥 Damage**"
```

---

## Character Sync Macros

### Basic Character Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge sync char <name>` | Sync specific character | `!fates-edge sync char "Aria"` |
| `!fates-edge sync characters` | Sync all characters | `!fates-edge sync characters` |
| `!fates-edge sync selected` | Sync selected tokens | `!fates-edge sync selected` |
| `!fates-edge char list` | List synced characters | `!fates-edge char list` |
| `!fates-edge char update <name> <attr> <value>` | Update character | `!fates-edge char update Aria harm 2` |

### Character Sync Macros

```javascript
// Sync a specific character to VTT
!fates-edge sync char "Aria"
!fates-edge send "📤 Synced **Aria** to VTT"

// Sync all characters
!fates-edge sync characters
!fates-edge send "📤 Synced **${Campaign.characters.length}** characters"

// Sync selected tokens
!fates-edge sync selected
!fates-edge send "📤 Synced selected tokens"

// List all synced characters
!fates-edge char list

// Update character attribute
!fates-edge char update "Aria" harm 2
!fates-edge send "🔄 Updated **Aria** - Harm: 2"

// Update multiple attributes
!fates-edge char update "Aria" harm 1 fatigue 2 boons 3
```

### Advanced Character Macros

```javascript
// Sync all player characters
!fates-edge sync characters
!fates-edge send "📤 Synced all player characters"

// Character status display
!fates-edge send "📊 **Character Status:**"
!fates-edge char list

// Character health update
!fates-edge char update "Aria" harm 2
!fates-edge char update "Thorn" fatigue 3
!fates-edge send "❤️ **Health Update:** Aria (Harm 2), Thorn (Fatigue 3)"

// Sync character sheet
!fates-edge send "📋 **Character Sheet Synced:** ${getAttr('name')}"

// Bulk character sync
const chars = Campaign.characters.map(c => ({
    name: c.name,
    harm: c.get('harm') || 0,
    fatigue: c.get('fatigue') || 0,
    boons: c.get('boons') || 0,
    tier: c.get('tier') || 1
}));
sendChat('!fates-edge sync char ' + JSON.stringify(chars));
```

---

## Timer Macros

### Basic Timer Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge timer create <name> <segments>` | Create a timer | `!fates-edge timer create "Ritual" 6` |
| `!fates-edge timer tick <name>` | Advance timer by 1 | `!fates-edge timer tick "Ritual"` |
| `!fates-edge timer remove <name>` | Remove timer | `!fates-edge timer remove "Ritual"` |
| `!fates-edge timer list` | List active timers | `!fates-edge timer list` |
| `!fates-edge timer reset <name>` | Reset timer | `!fates-edge timer reset "Ritual"` |

### Timer Macros

```javascript
// Create a new timer
!fates-edge timer create "Guard Patrol" 4
!fates-edge send "⏱️ **Created:** Guard Patrol (4 segments)"

// Timer with segments
!fates-edge timer create "Ritual Completion" 6
!fates-edge send "⏱️ **Ritual:** ${timer.current}/${timer.segments}"

// Tick a timer
!fates-edge timer tick "Guard Patrol"
!fates-edge send "⏱️ **Guard Patrol:** ${timer.current}/${timer.segments}"

// Tick multiple timers
!fates-edge timer tick "Ritual" 2
!fates-edge send "⏱️ **Ritual Progress:** ${timer.current}/${timer.segments}"

// Visual timer display
!fates-edge timer display "Ritual"
!fates-edge send "⏱️ **Ritual:** [████░░░░] 4/6"

// Complete timer
!fates-edge timer tick "Ritual" 6
!fates-edge send "⚠️ **Ritual Complete!** "

// Timer status display
!fates-edge timer list
!fates-edge send "📊 **Active Timers:**"
```

### Timer Macros with Progress Bars

```javascript
// Create timer with progress bar
function createTimerWithBar(name, segments) {
    !fates-edge timer create name segments
    let bar = '█'.repeat(0) + '░'.repeat(segments);
    !fates-edge send "⏱️ **${name}**\n[${bar}] 0/${segments}"
}

// Update timer with progress bar
function updateTimerBar(name) {
    const timer = getTimer(name);
    if (!timer) return;
    const progress = Math.floor((timer.current / timer.segments) * 10);
    const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);
    !fates-edge send "⏱️ **${name}**\n[${bar}] ${timer.current}/${timer.segments}"
}

// Timer with automatic display
!fates-edge timer tick "Ritual"
!fates-edge timer display "Ritual"
```

---

## Scene Macros

### Basic Scene Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge sync scene` | Sync current scene | `!fates-edge sync scene` |
| `!fates-edge scene <name>` | Sync specific scene | `!fates-edge scene "Dungeon"` |
| `!fates-edge scene list` | List available scenes | `!fates-edge scene list` |
| `!fates-edge sync page <name>` | Sync Roll20 page | `!fates-edge sync page "Map"` |

### Scene Macros

```javascript
// Sync current scene to VTT
!fates-edge sync scene
!fates-edge send "🎬 Synced current scene to VTT"

// Sync specific scene
!fates-edge scene "The Dark Tower"
!fates-edge send "🎬 **Scene:** The Dark Tower"

// List scenes
!fates-edge scene list
!fates-edge send "📋 **Available Scenes:**"

// Sync with page
!fates-edge sync page "Battle Map"
!fates-edge send "🗺️ **Page:** Battle Map"

// Scene transition
!fates-edge scene "Dungeon - Level 2"
!fates-edge send "🎬 **Transitioning to:** Dungeon - Level 2"
!fates-edge send "📜 *The air grows cold and damp...*"

// Scene with description
!fates-edge scene "Throne Room"
!fates-edge send "👑 **The Throne Room**"
!fates-edge send "📖 *Marble pillars loom in the torchlight. The throne sits empty, waiting.*"
```

---

## Combat Macros

### Combat Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge combat start` | Start combat | `!fates-edge combat start` |
| `!fates-edge combat end` | End combat | `!fates-edge combat end` |
| `!fates-edge combat init <name> <roll>` | Add initiative | `!fates-edge combat init "Aria" 15` |
| `!fates-edge combat next` | Next turn | `!fates-edge combat next` |
| `!fates-edge combat status` | Show combat status | `!fates-edge combat status` |

### Combat Macros

```javascript
// Start combat
!fates-edge combat start
!fates-edge send "⚔️ **COMBAT STARTED!** "

// Add initiative
!fates-edge combat init "Aria" 18
!fates-edge combat init "Thorn" 12
!fates-edge combat init "Goblin" 5

// Show turn order
!fates-edge combat status
!fates-edge send "📋 **Turn Order:**"

// Next turn
!fates-edge combat next
!fates-edge send "⏭️ **Turn:** ${currentTurn}"

// End combat
!fates-edge combat end
!fates-edge send "⚔️ **COMBAT ENDED**"

// Combat macro with damage tracking
!fates-edge send "⚔️ **Combat Status**"
!fates-edge char list
!fates-edge timer display "Combat Round"
```

---

## GM Macros

### GM Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge gm <message>` | GM-only message | `!fates-edge gm "They see the trap"` |
| `!fates-edge note <message>` | Add GM note | `!fates-edge note "Hidden door behind tapestry"` |
| `!fates-edge roll hidden <dice>` | Hidden GM roll | `!fates-edge roll hidden 1d20` |
| `!fates-edge reveal <message>` | Reveal to players | `!fates-edge reveal "You find a hidden key"` |

### GM Macros

```javascript
// GM whisper
!fates-edge gm "The goblins are planning an ambush"
!fates-edge send "🎭 **GM:** *The goblins are planning an ambush*"

// Hidden roll
!fates-edge roll hidden 1d20+5
!fates-edge gm "Perception check: ${roll.total}"

// Add a note
!fates-edge note "The chest is trapped (poison needle)"
!fates-edge send "📝 **GM Note:** The chest is trapped"

// Reveal information
!fates-edge reveal "You notice a faint outline of a door behind the tapestry"
!fates-edge send "🔍 **Revelation:** You notice a faint outline of a door"

// GM announcement
!fates-edge gm announce "The ritual is almost complete!"
!fates-edge send "⚠️ **GM Announcement:** The ritual is almost complete!"

// Experience reward
!fates-edge gm "Each player gains 500 XP"
!fates-edge send "✨ **Reward:** Each player gains 500 XP"

// Session summary
!fates-edge note "Session Summary: Players defeated the goblin chief and found the Amulet of Power"
!fates-edge send "📋 **Session Summary:** Players defeated the goblin chief"
```

---

## GM Election & Promotion

### GM Management Commands (new in v1.3.0)

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge gm request` | Request to become GM | `!fates-edge gm request` |
| `!fates-edge gm approve <player>` | Approve a pending GM request (GM only) | `!fates-edge gm approve "Aria"` |
| `!fates-edge gm reject <player>` | Reject a pending GM request (GM only) | `!fates-edge gm reject "Thorn"` |
| `!fates-edge gm status` | Show current GM and pending requests | `!fates-edge gm status` |
| `!fates-edge gm list` | List all connected clients with roles | `!fates-edge gm list` |

### GM Election Macros

```javascript
// Request to become GM
!fates-edge gm request
!fates-edge send "👑 GM request sent. Waiting for approval."

// Approve a request (by player name or ID)
!fates-edge gm approve "Aria"
!fates-edge send "✅ Approved Aria as GM."

// Reject a request
!fates-edge gm reject "Thorn"
!fates-edge send "❌ Rejected Thorn's GM request."

// Show GM status
!fates-edge gm status
// Output:
// 👑 Current GM: GM Name
// 📋 Pending requests: 2
//    - PlayerOne
//    - PlayerTwo

// List all connected clients with roles
!fates-edge gm list
// Output:
// 👥 Clients
// 👑 GM (you) — gm
// Aria — player
// Thorn — player

// Auto-approve first pending request (GM only)
const reqs = FatesEdge.getPendingRequests();
if (reqs.length > 0) {
    FatesEdge.approveGM(reqs[0].requesterId);
    sendChat('GM', `Auto-approved ${reqs[0].requesterName} as GM.`);
}

// Check if you are the GM
if (FatesEdge.getMyRole() === 'gm') {
    sendChat('GM', 'You are the Game Master!');
} else {
    sendChat('GM', 'You are a player.');
}

// Broadcast current GM status to chat
const gm = FatesEdge.getCurrentGM();
const gmName = gm ? gm.name : 'None';
sendChat('GM Status', `Current GM: ${gmName}`);
```

---

## Utility Macros

### Utility Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!fates-edge help` | Show help | `!fates-edge help` |
| `!fates-edge clear` | Clear VTT chat | `!fates-edge clear` |
| `!fates-edge status all` | Show all status | `!fates-edge status all` |
| `!fates-edge broadcast <message>` | Broadcast to all | `!fates-edge broadcast "Break time!"` |

### Utility Macros

```javascript
// Show help
!fates-edge help

// Clear chat
!fates-edge clear

// Full status
!fates-edge status all

// Broadcast message
!fates-edge broadcast "🍕 **Break:** 5 minutes!"

// Connection test
!fates-edge ping
!fates-edge send "🏓 **Ping:** ${pingTime}ms"

// Game state display
!fates-edge status all
!fates-edge send "📊 **Game State:**"
!fates-edge send "- Room: ${CONFIG.roomCode}"
!fates-edge send "- Players: ${Campaign.players.length}"
!fates-edge send "- Characters: ${Campaign.characters.length}"
```

---

## Advanced API Scripts

### Full Featured Roll20 API Script

```javascript
// ============================================================
// Fate's Edge - Complete Roll20 Integration v1.3.0
// ============================================================

// Configuration
const CONFIG = {
    serverUrl: 'ws://localhost:3000',
    roomCode: 'ABC123',
    apiKey: 'your-api-key',
    autoConnect: true,
    syncChat: true,
    syncRolls: true,
    syncCharacters: true,
    syncTimers: true,
    syncScenes: true
};

// ============================================================
// Macro Commands - Add to the API Script
// ============================================================

// Register all commands
on('ready', () => {
    // Register command handlers
    registerCommand('!fates-edge', (msg, args) => {
        const command = args[1] || '';
        const params = args.slice(2);

        switch (command) {
            case 'connect': cmdConnect(); break;
            case 'disconnect': cmdDisconnect(); break;
            case 'status': cmdStatus(); break;
            case 'send': cmdSend(params.join(' ')); break;
            case 'roll': cmdRoll(params.join(' ')); break;
            case 'sync': cmdSync(params); break;
            case 'timer': cmdTimer(params); break;
            case 'scene': cmdScene(params.join(' ')); break;
            // GM commands
            case 'gm': cmdGM(params); break;
            case 'help': cmdHelp(); break;
            default: sendChat('Fate\'s Edge', `Unknown command: ${command}`);
        }
    });
});

// Command implementations
function cmdConnect() {
    connect();
    sendChat('Fate\'s Edge', '🔌 Connecting to VTT server...');
}

function cmdDisconnect() {
    disconnect();
    sendChat('Fate\'s Edge', '🔌 Disconnected from VTT server');
}

function cmdStatus() {
    const status = connected ? '🟢 Connected' : '🔴 Disconnected';
    sendChat('Fate\'s Edge', `📊 Status: ${status}`);
    sendChat('Fate\'s Edge', `📡 Server: ${CONFIG.serverUrl}`);
    sendChat('Fate\'s Edge', `🏠 Room: ${CONFIG.roomCode}`);
    const gm = FatesEdge.getCurrentGM();
    sendChat('Fate\'s Edge', `👑 GM: ${gm ? gm.name : 'None'}`);
    sendChat('Fate\'s Edge', `🎭 Your role: ${FatesEdge.getMyRole()}`);
}

function cmdSend(message) {
    if (!message) return;
    sendChatMessage(message);
    sendChat('Fate\'s Edge', `📤 Sent: ${message}`);
}

function cmdRoll(expr) {
    if (!expr) return;
    sendRoll(expr);
    sendChat('Fate\'s Edge', `🎲 Rolled: ${expr}`);
}

function cmdSync(params) {
    const subcommand = params[0] || '';
    switch (subcommand) {
        case 'characters':
            const chars = collectCharacters();
            syncCharacters(chars);
            sendChat('Fate\'s Edge', `📤 Synced ${chars.length} characters`);
            break;
        case 'scene':
            syncScene({ name: Campaign.currentPage.name });
            sendChat('Fate\'s Edge', `🎬 Synced scene: ${Campaign.currentPage.name}`);
            break;
        case 'selected':
            syncSelectedTokens();
            sendChat('Fate\'s Edge', '📤 Synced selected tokens');
            break;
        default:
            if (subcommand) {
                const char = Campaign.characters.find(c => 
                    c.name.toLowerCase() === subcommand.toLowerCase()
                );
                if (char) {
                    const data = {
                        name: char.name,
                        harm: char.get('harm') || 0,
                        fatigue: char.get('fatigue') || 0,
                        boons: char.get('boons') || 0,
                        tier: char.get('tier') || 1
                    };
                    syncCharacters([data]);
                    sendChat('Fate\'s Edge', `📤 Synced: ${char.name}`);
                }
            }
            break;
    }
}

function cmdTimer(params) {
    const subcommand = params[0] || '';
    const name = params[1] || '';
    const value = parseInt(params[2]) || 0;

    switch (subcommand) {
        case 'create':
            if (name && value > 0) {
                const timer = { name, segments: value, current: 0 };
                vttTimers.push(timer);
                sendChat('Fate\'s Edge', `⏱️ Created timer: ${name} (${value} segments)`);
                syncTimers(vttTimers);
            }
            break;
        case 'tick':
            const timer = vttTimers.find(t => t.name === name);
            if (timer) {
                const ticks = value > 0 ? value : 1;
                timer.current = Math.min(timer.current + ticks, timer.segments);
                sendChat('Fate\'s Edge', `⏱️ ${name}: ${timer.current}/${timer.segments}`);
                syncTimers(vttTimers);
            }
            break;
        case 'list':
            if (vttTimers.length === 0) {
                sendChat('Fate\'s Edge', '⏱️ No active timers');
            } else {
                sendChat('Fate\'s Edge', '📊 **Active Timers:**');
                vttTimers.forEach(t => {
                    const progress = Math.floor((t.current / t.segments) * 10);
                    const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);
                    const status = t.current >= t.segments ? '✅ COMPLETE' : '⏳ Active';
                    sendChat('Fate\'s Edge', `- ${t.name}: [${bar}] ${t.current}/${t.segments} - ${status}`);
                });
            }
            break;
        case 'remove':
            const index = vttTimers.findIndex(t => t.name === name);
            if (index !== -1) {
                vttTimers.splice(index, 1);
                sendChat('Fate\'s Edge', `⏱️ Removed timer: ${name}`);
                syncTimers(vttTimers);
            }
            break;
        case 'reset':
            const resetTimer = vttTimers.find(t => t.name === name);
            if (resetTimer) {
                resetTimer.current = 0;
                sendChat('Fate\'s Edge', `⏱️ Reset timer: ${name}`);
                syncTimers(vttTimers);
            }
            break;
        default:
            sendChat('Fate\'s Edge', `⏱️ Timer commands: create, tick, list, remove, reset`);
    }
}

function cmdScene(name) {
    if (!name) return;
    const pages = Campaign.pages;
    const match = pages.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
    if (match) {
        Campaign.setCurrentPage(match.id);
        sendChat('Fate\'s Edge', `🎬 Switched to page: ${match.name}`);
        syncScene({ name: match.name });
    } else {
        sendChat('Fate\'s Edge', `⚠️ Page not found: ${name}`);
    }
}

// GM command handler
function cmdGM(params) {
    const subcommand = params[0] || '';
    const param = params.slice(1).join(' ');

    switch (subcommand) {
        case 'request':
            FatesEdge.requestGM();
            sendChat('Fate\'s Edge', '👑 GM request sent.');
            break;
        case 'approve':
            if (!param) {
                sendChat('Fate\'s Edge', '❌ Please specify a player: !fates-edge gm approve <player>');
                break;
            }
            const approveTarget = Object.values(FatesEdge.getClients()).find(c => 
                c.id === param || c.name.toLowerCase() === param.toLowerCase()
            );
            if (!approveTarget) {
                sendChat('Fate\'s Edge', `❌ Player "${param}" not found.`);
                break;
            }
            FatesEdge.approveGM(approveTarget.id);
            sendChat('Fate\'s Edge', `✅ Approved ${approveTarget.name} as GM.`);
            break;
        case 'reject':
            if (!param) {
                sendChat('Fate\'s Edge', '❌ Please specify a player: !fates-edge gm reject <player>');
                break;
            }
            const rejectTarget = Object.values(FatesEdge.getClients()).find(c => 
                c.id === param || c.name.toLowerCase() === param.toLowerCase()
            );
            if (!rejectTarget) {
                sendChat('Fate\'s Edge', `❌ Player "${param}" not found.`);
                break;
            }
            FatesEdge.rejectGM(rejectTarget.id);
            sendChat('Fate\'s Edge', `❌ Rejected ${rejectTarget.name} as GM.`);
            break;
        case 'status':
            const gm = FatesEdge.getCurrentGM();
            const gmName = gm ? gm.name : 'None';
            const pending = FatesEdge.getPendingRequests();
            let msg = `👑 **GM Status**\nCurrent GM: ${gmName}`;
            if (pending.length > 0) {
                msg += `\n📋 Pending requests: ${pending.length}`;
                pending.forEach(r => msg += `\n   - ${r.requesterName}`);
            } else {
                msg += `\n📋 No pending requests.`;
            }
            sendChat('Fate\'s Edge', msg);
            break;
        case 'list':
            const clients = Object.values(FatesEdge.getClients());
            if (clients.length === 0) {
                sendChat('Fate\'s Edge', '👥 No clients in room.');
                break;
            }
            const list = clients.map(c => {
                const isGM = c.id === gmId ? '👑 ' : '';
                const isSelf = c.id === clientId ? ' (you)' : '';
                return `${isGM}${c.name}${isSelf} — ${c.role}`;
            }).join('\n');
            sendChat('Fate\'s Edge', `👥 **Clients**\n${list}`);
            break;
        default:
            sendChat('Fate\'s Edge', `
👑 GM Commands:
!fates-edge gm request        - Request to become GM
!fates-edge gm approve <name> - Approve a pending GM request (GM only)
!fates-edge gm reject <name>  - Reject a pending GM request (GM only)
!fates-edge gm status         - Show current GM and pending requests
!fates-edge gm list           - List all clients with roles
`);
            break;
    }
}

function cmdHelp() {
    sendChat('Fate\'s Edge', `
        📖 **Fate's Edge Commands:**
        !fates-edge connect - Connect to server
        !fates-edge disconnect - Disconnect
        !fates-edge status - Show status
        !fates-edge send <msg> - Send chat message
        !fates-edge roll <dice> - Roll dice
        !fates-edge sync characters - Sync all characters
        !fates-edge sync <name> - Sync specific character
        !fates-edge sync scene - Sync current scene
        !fates-edge sync selected - Sync selected tokens
        !fates-edge timer create <name> <segments> - Create timer
        !fates-edge timer tick <name> [ticks] - Tick timer
        !fates-edge timer list - List timers
        !fates-edge timer remove <name> - Remove timer
        !fates-edge timer reset <name> - Reset timer
        !fates-edge scene <name> - Switch scene
        !fates-edge gm ... - GM management (see !fates-edge gm help)
        !fates-edge help - Show this help
    `);
}
```

---

## 🎯 Quick Reference Card

### Most Used Macros

```javascript
// Connect & Status
!fates-edge connect
!fates-edge status

// Chat
!fates-edge send "Hello VTT!"
!fates-edge whisper "GM" "Secret message"

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

// GM Election & Promotion (v1.3.0)
!fates-edge gm request
!fates-edge gm approve "Aria"
!fates-edge gm status
!fates-edge gm list
```

---

## 📝 Notes

1. All commands are case-insensitive
2. Parameters with spaces should be quoted: `!fates-edge send "Hello world"`
3. Timers persist until removed or server restarts
4. Character sync requires matching names between Roll20 and VTT
5. Scene sync works with Roll20 pages (maps)
6. GM commands require the v1.3.0 API script (or later)
7. Players can only request GM; only the current GM can approve/reject