# Fate's Edge Toolkit v2.1 — Design Document

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Layer](#data-layer)
5. [UI/UX Design](#uiux-design)
6. [Features](#features)
7. [Build & Deployment](#build--deployment)
8. [Troubleshooting](#troubleshooting)
9. [Security](#security)
10. [Future Roadmap](#future-roadmap)

---

## Overview

### Purpose
The Fate's Edge Toolkit is a comprehensive, browser-based TTRPG companion application for the Fate's Edge narrative-first roleplaying game system. It provides GMs and players with a complete suite of tools for character management, dice rolling, encounter tracking, document browsing, and campaign management.

### Key Features
- **Password-protected access** for playtesters
- **Dynamic document browsing** with horizontal scrolling grid
- **Character management** with full XP tracking
- **Interactive character builder** with templates
- **Dice roller** with Fate's Edge resolution system
- **VTT (Virtual Tabletop)** with chat and party status
- **Timer/clocks system** for scene pressure
- **Encounter and combat tracker**
- **Wiki system** with Markdown support
- **Deck of Consequences** for Story Beat complications
- **Regional roller** for worldbuilding
- **Campaign sharing** via server
- **Search** with Fuse.js integration

### Technology Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Libraries**: 
  - jsPDF + jsPDF-AutoTable (PDF export)
  - Marked.js (Markdown rendering)
  - Fuse.js (Fuzzy search)
- **Storage**: LocalStorage (client-side only)
- **Build Tools**: Python, Pandoc, LaTeX
- **Deployment**: GitHub Pages

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Password   │  │   Main App   │  │   Document   │    │
│  │    Gate      │  │   (SPA)      │  │   Viewer     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                 │                    │          │
│         ▼                 ▼                    ▼          │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Local Storage (Data Layer)           │    │
│  │  • Characters  • Timers  • Wiki  • Encounters    │    │
│  │  • Roll History • Chat History • NPCs            │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Pages (Hosting)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  index.html  │  │  build/html/ │  │  wiki.json   │    │
│  │  (Main App)  │  │ (Documents)  │  │  (Bundled)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
User Action → JavaScript Handler → Data Update → Render Function → UI Update
                    │
                    ▼
              LocalStorage (Persist)
                    │
                    ▼
              Export/Import (JSON)
                    │
                    ▼
              Campaign Server (Optional)
```

---

## Core Components

### 1. Password Gate System

#### Purpose
Provides playtester-only access to the toolkit.

#### Implementation
```javascript
// Password hashing using Web Crypto API
async function hashPassword(pw) {
    const enc = new TextEncoder().encode(pw);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

// Password check
function checkPasswordGate() {
    if (!Data.passwordHash) {
        isUnlocked = true;
        return;
    }
    // Show overlay and validate input
}
```

#### Configuration
- Password stored as SHA-256 hash
- No password = no protection
- Settings panel allows setting/changing/removing password

### 2. Data Layer

#### Data Structure
```javascript
const Data = {
    version: 5,
    passwordHash: null,        // SHA-256 hex string
    baseUrl: '',               // Custom base URL for document links
    characters: [],            // Array of character objects
    timers: [],               // Array of timer objects
    wiki: [],                 // Array of wiki entries
    rollHistory: [],          // Array of roll results
    talents: [],              // Array of talent definitions
    chatHistory: [],          // Array of chat messages
    encounters: [],          // Array of encounter objects
    npcs: [],                // Array of NPC objects
    _nextId: 1,              // Auto-incrementing ID counter
    // ... more fields
};
```

#### Character Object
```javascript
{
    id: number,
    name: string,
    heritage: string,
    background: string,
    patron: string,
    tier: string,           // "I", "II", etc.
    xp: number,             // Current XP total
    body: number,           // 1-5
    wits: number,           // 1-5
    spirit: number,         // 1-5
    presence: number,       // 1-5
    skills: {               // Map of skill names to ratings (0-5)
        melee: 0,
        ranged: 0,
        // ... all 19 skills
    },
    talents: [{ name, cost }],
    assets: [{ name, cost }],
    equipment: [{ name, cost }],
    bonds: [{ name, desc, start }],
    complications: [{ name, desc, start }],
    harm: number,           // 0-3
    fatigue: number,        // 0+
    boons: number,          // 0-5
    vtt: boolean           // Whether pushed to VTT
}
```

### 3. Document Viewer System

#### Architecture
```
┌──────────────────────────────────────────────────────────────┐
│                     Document Library Tab                    │
├──────────────────────────────────────────────────────────────┤
│  Filter Bar: [Category ▼] [Search...] [Clear] [Stats]      │
├──────────────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ → (horizontal scroll) │
│  │ Doc 1 │ │ Doc 2 │ │ Doc 3 │ │ Doc 4 │                    │
│  │ Core  │ │ Adv  │ │ Core  │ │ Ref  │                    │
│  └──────┘ └──────┘ └──────┘ └──────┘                    │
├──────────────────────────────────────────────────────────────┤
│  Document Viewer (70vh height)                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [iframe loading document content]                     │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### Component Flow
1. `loadDocList()` → Fetches `manifest.json`
2. Builds document objects with categories
3. `applyDocsFilter()` → Filters based on category/search
4. Renders horizontal scrollable grid
5. Click card → `loadDocument()` → Shows in iframe

### 4. Character Builder

#### Feature Components
- **Attribute Assignment**: Body, Wits, Spirit, Presence (1-5)
- **Skill Assignment**: 19 skills (0-5)
- **Talent Selection**: Custom or from wiki
- **Asset/Equipment Management**
- **Bonds & Complications** with XP bonuses
- **XP Cost Calculation**: Auto-calculates based on selections
- **Template System**: 16 pre-built templates
- **PDF Export**: jsPDF with autoTable

#### XP Cost Formulas
```javascript
// Attribute cost: sum of (new rating × 3) for each step
function attrCost(rating) {
    let total = 0;
    for (let i = 2; i <= rating; i++) total += i * 3;
    return total;
}

// Skill cost: sum of (new level × 2) for each step
function skillCost(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) total += i * 2;
    return total;
}

// Bond/Complication bonus: +2 XP each, max +4 XP
// Total XP: BASE_START_XP (32) + bonuses, capped at 36
```

### 5. VTT (Virtual Tabletop)

#### Components
```
┌──────────────────────────────────────────────────────────────┐
│                         VTT Tab                             │
├──────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┐  ┌─────────────────────────┐ │
│  │        Chat Area          │  │   Party Status          │ │
│  │  • Messages with timestamps│  │   • Character cards     │ │
│  │  • Sender coloring         │  │   • Harm/Fatigue/Boons  │ │
│  │  • Whisper support         │  │   • Quick actions       │ │
│  │  • /commands              │  │                         │ │
│  ├───────────────────────────┤  ├─────────────────────────┤ │
│  │  Input: [text] [recipient] │  │   Quick Roller         │ │
│  │  [Send]                   │  │   • Attribute + Skill   │ │
│  └───────────────────────────┘  │   • Position/DV/Boons   │ │
│                                  │   • Roll & Post        │ │
│                                  ├─────────────────────────┤ │
│                                  │   Scene Timers         │ │
│                                  │   • Timer cards        │ │
│                                  │   • Scene End button   │ │
│                                  └─────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### Chat Commands
- `/roll attr skill dv [pos] [boons] [note]` - Roll dice
- `/timer name segments` - Create a timer
- `/ooc text` - Out of character chat
- `/help` - Show available commands
- `/status` - Show party status
- `/char name` - Show character details

### 6. Dice Roller System

#### Resolution Mechanics
```javascript
function performRoll(attr, skill, dv, pos, boons) {
    // 1. Build pool
    let pool = attr + skill;
    
    // 2. Roll dice
    let dice = rollPool(pool);
    
    // 3. Apply position modifiers
    if (pos === 'dominant') reroll_one_failure();
    if (pos === 'desperate') reroll_one_success();
    
    // 4. Apply boons (re-roll lowest failures)
    while (boons_available && has_failures) {
        reroll_lowest_die();
        boons_used++;
    }
    
    // 5. Calculate results
    successes = count(dice >= 6) + count(dice === 10);
    story_beats = count(dice === 1);
    
    // 6. Determine outcome
    if (successes >= dv && sb === 0) → Clean Success
    if (successes >= dv && sb > 0) → Success with SB
    if (0 < successes < dv) → Partial (+1 Boon)
    if (successes === 0) → Miss (+2 Boons)
}
```

#### Outcome Matrix
| Result | Outcome | What Happens |
|--------|---------|--------------|
| S ≥ DV, SB = 0 | Clean Success | Get what you want, no cost |
| S ≥ DV, SB > 0 | Success with SB | Succeed, world pushes back |
| 0 < S < DV | Partial | Make progress, gain 1 Boon |
| S = 0 | Miss | Fail, things get worse, gain 2 Boons |

### 7. Deck of Consequences

#### Purpose
Convert Story Beats (SB) into narrative complications.

#### Card Structure
```javascript
{
    suit: 'hearts'|'spades'|'clubs'|'diamonds'|'joker',
    rank: 'A'|'2'|...|'K',
    symbol: '♥'|'♠'|'♣'|'♦'|'🃏',
    color: '#hex',
    isJoker: boolean
}
```

#### Synthesis Logic
- Draw 1-3 cards based on SB count
- Analyze highest rank, suits, jokers
- Generate severity (Minor/Moderate/Major/Severe)
- Create narrative consequence based on suit combination
- Special handling for jokers (Red = catastrophe, Black = dark boon)

### 8. Regional Roller

#### Purpose
Generate worldbuilding elements from region-based decks.

#### Data Structure
```javascript
REGIONS_DATA = {
    "Region Name": {
        spades: [ "Place description 1", "Place description 2", ... ],
        hearts: [ "Actor description 1", "Actor description 2", ... ],
        clubs: [ "Complication description 1", ... ],
        diamonds: [ "Reward description 1", ... ]
    }
}
```

#### Usage
1. Select region from dropdown
2. Click suit button or "Full Draw"
3. Randomly selects entry from matching deck
4. Displays with suggested timer count

---

## UI/UX Design

### Layout Structure

```
┌──────────┬─────────────────────────────────────────────────┐
│ Sidebar  │               Main Content                      │
│ (220px)  │                                                 │
│          │  ┌─────────────────────────────────────────┐    │
│ ⚔️ Fate's│  │  Tab Content Area                       │    │
│   Edge   │  │  • Home                                │    │
│  Toolkit │  │  • Dashboard                           │    │
│          │  │  • Characters                          │    │
│ 📜 Home  │  │  • Builder                             │    │
│ 📊 Dash  │  │  • Roller                              │    │
│ 👤 Chars │  │  • Timers                              │    │
│ 🛠️ Build │  │  • Encounters                          │    │
│ 🎲 Dice  │  │  • VTT                                 │    │
│ ⏱️ Timers│  │  • Docs                                │    │
│ ⚔️ Enc   │  │  • Search                              │    │
│ 💬 VTT   │  │  • Wiki                                │    │
│ 📄 Docs  │  │  • Consequences                        │    │
│ 🔍 Search│  │  • Regional                            │    │
│ 📖 Wiki  │  │  • Settings                            │    │
│ 🃏 Cons  │  │                                        │    │
│ 🌍 Region│  │                                        │    │
│ ⚙️ Sett  │  │                                        │    │
│          │  └─────────────────────────────────────────┘    │
│ ● Saved  │                                              │
│ ⬇ ⬆ 🌙  │                                              │
└──────────┴─────────────────────────────────────────────────┘
```

### Responsive Design Breakpoints

| Breakpoint | Sidebar | Content | Card Sizes |
|------------|---------|---------|------------|
| > 820px | Full (220px) | Normal | 160-200px |
| 481-820px | Icons only (60px) | Compressed | 130-160px |
| ≤ 480px | Icons only (48px) | Minimal | 110-140px |

### Color Scheme

#### Dark Mode (Default)
| Variable | Value | Usage |
|----------|-------|-------|
| `--bg` | #0d0b0f | Main background |
| `--bg2` | #18141c | Panels and cards |
| `--bg3` | #231e29 | Hover states |
| `--bg4` | #2f2838 | Active states |
| `--text` | #e6dce8 | Primary text |
| `--text2` | #b8aabf | Secondary text |
| `--gold` | #d4af37 | Accent/Highlights |
| `--border` | #3a3242 | Borders |

#### Light Mode
- All colors inverted with warmer tones
- Accessible contrast ratios maintained

### Document Grid Design

```css
.doc-grid {
    display: flex;
    flex-direction: row;
    gap: 1rem;
    overflow-x: auto;
    flex-wrap: nowrap;
    align-items: stretch;
}

.doc-card {
    min-width: 160px;
    max-width: 200px;
    flex: 0 0 auto;
    /* ... */
}
```

**Benefits:**
- Horizontal scrolling for easy browsing
- Consistent card sizes
- No truncation issues
- Mobile-optimized with smaller cards

---

## Build & Deployment

### Build Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                 │
├─────────────────────────────────────────────────────────────┤
│  1. Checkout Repository                                    │
│  2. Setup Python + Pandoc + LaTeX                          │
│  3. Build SRD Database                                     │
│  4. Convert LaTeX → HTML (latex_to_html.py)              │
│     - Generates responsive sidebar TOC                    │
│     - Creates section-split HTML                          │
│     - Builds index pages                                  │
│  5. Generate Title & Copyright Pages                       │
│  6. Generate Search Index                                  │
│  7. Create Manifest.json                                   │
│  8. Prepare Deployment Directory                           │
│     - Copy mainpage as index.html                         │
│     - Copy all HTML to build/html/                       │
│     - Copy wiki.json and search_index.json               │
│  9. Deploy to GitHub Pages                                │
└─────────────────────────────────────────────────────────────┘
```

### File Structure (Deployed)

```
_site/
├── index.html                    # Main application
├── wiki.json                     # Bundled wiki data
├── build/
│   ├── html/
│   │   ├── manifest.json         # Document manifest
│   │   ├── index.html            # Document library index
│   │   ├── index_index.html      # Alphabetical index
│   │   ├── title.html            # Title page
│   │   ├── copyright.html        # Copyright page
│   │   ├── document1.html
│   │   ├── document2.html
│   │   ├── document1_sections/   # Section-split documents
│   │   │   ├── index.html
│   │   │   ├── document1_01_section1.html
│   │   │   └── document1_02_section2.html
│   │   └── ...
│   └── search_index.json         # Fuse.js search index
└── ...
```

### HTML Generation Features

The enhanced `latex_to_html.py` generates:

1. **Responsive Sidebar TOC**
   - Sticky on desktop
   - Collapsible on mobile
   - Proper nesting of sections

2. **Dynamic Index Pages**
   - Parses `\index{...}` commands
   - Generates clickable index page
   - Links each term to section

3. **Section-Split HTML**
   - Each section as separate file
   - Navigation between sections
   - Maintains sidebar and styling

4. **Mobile-Compatible CSS**
   - Responsive design
   - Touch-friendly targets
   - Optimized font sizing

---

## Troubleshooting

### Common Issues & Solutions

#### 1. Document Viewer Shows "Loading..." Indefinitely

**Symptoms:**
- Documents fail to load
- Viewer stays in loading state
- Console errors about manifest.json

**Solutions:**
```bash
# Check manifest.json exists and is valid
cat _site/build/html/manifest.json

# Verify path to documents
ls -la _site/build/html/

# Check for absolute vs relative paths
# Ensure manifest.json uses relative paths like:
# {"file": "document.html"}  NOT {"file": "/build/html/document.html"}
```

**Fix in code:**
```javascript
// Ensure relative paths in loadDocument()
const url = buildDocumentUrl('build/html/' + filePath);
```

#### 2. Password Gate Loops or Doesn't Work

**Symptoms:**
- Password prompt appears repeatedly
- Correct password not accepted
- Can't disable password

**Solutions:**
```javascript
// Check stored password hash
console.log(Data.passwordHash);

// Clear password in browser console
Data.passwordHash = null;
forceSave();
location.reload();

// Or use localStorage directly
localStorage.removeItem('fates-edge-data');
location.reload();
```

#### 3. Character Data Not Saving

**Symptoms:**
- Changes disappear after refresh
- Save status shows error
- Console errors

**Solutions:**
```javascript
// Check localStorage quota
try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
} catch(e) {
    console.error('LocalStorage full or unavailable');
}

// Force save with error handling
function forceSave() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Data));
        updateSaveStatus('saved');
    } catch(e) {
        console.error('Save failed:', e);
        updateSaveStatus('error');
        toast('Storage full! Export your data and clear some space.', 'error');
    }
}
```

#### 4. Document Grid Not Scrolling Horizontally

**Symptoms:**
- Cards wrap to multiple rows
- Cards too large/small
- Overflow issues

**Solutions:**
```css
/* Ensure these styles are applied */
.doc-grid {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    flex-wrap: nowrap;
}

.doc-card {
    flex: 0 0 auto;
    min-width: 160px;
    max-width: 200px;
}
```

#### 5. VTT Chat Messages Not Appearing

**Symptoms:**
- Messages sent but not visible
- Chat clear doesn't work
- Old messages reappear

**Solutions:**
```javascript
// Check chat history data
console.log(Data.chatHistory);

// Force re-render
renderChat();

// Verify chat container exists
document.getElementById('chatMessages');
```

#### 6. Search Not Working

**Symptoms:**
- Search returns no results
- Fuse.js not loaded
- Index not generated

**Solutions:**
```bash
# Check if search_index.json exists
ls -la build/search_index.json

# Verify build_search_index.py ran
grep "search_index.json" build.log
```

**Manual fix:**
```javascript
// Rebuild search index manually
await loadSearchIndex();
performSearch('test');
```

#### 7. PDF Export Fails

**Symptoms:**
- PDF not generated
- jsPDF errors in console
- Blank PDF

**Solutions:**
```javascript
// Check jsPDF loaded
console.log(window.jspdf);

// Verify autoTable plugin
console.log(window.jspdf?.jsPDF?.autoTable);

// Test with minimal content
const doc = new jsPDF();
doc.text('Test', 10, 10);
doc.save('test.pdf');
```

#### 8. Wiki Remote Entries Not Loading

**Symptoms:**
- Wiki shows only local entries
- Bundled entries missing
- wiki.json not found

**Solutions:**
```bash
# Check wiki.json exists in root
ls -la wiki.json

# Verify wiki.json format
cat wiki.json | python -m json.tool

# Reload manually in browser
reloadWikiFromRemote();
```

#### 9. Section-Split Documents Not Linking

**Symptoms:**
- Section links broken
- Manifest missing section info
- 404 errors

**Solutions:**
```javascript
// Check manifest has section info
manifest.forEach(doc => {
    console.log(doc.file, doc.has_sections, doc.section_count);
});

// Verify section directory exists
// build/html/document_sections/
// build/html/document_sections/index.html
```

### Debugging Tools

#### Browser Console Commands
```javascript
// View full data state
console.log(Data);

// Force save
forceSave();

// Reload all UI
renderAll();

// Export data
exportAllData();

// Check password status
console.log(Data.passwordHash, isUnlocked);

// Clear local storage (WARNING: Destructive!)
// localStorage.clear();

// Force password reset (if stuck)
Data.passwordHash = null;
forceSave();
location.reload();
```

#### Debug Mode Activation
```javascript
// Enable verbose logging
window.DEBUG = true;

// Add to render functions
if (window.DEBUG) {
    console.log('Rendered:', componentName, data);
}
```

### Performance Issues

#### Slow Loading
**Solutions:**
1. Limit chat history to 200 messages
2. Limit roll history to 50 entries
3. Archive old sessions
4. Use debounced search
5. Lazy-load document viewer

#### Memory Leaks
**Solutions:**
1. Clear intervals in modals
2. Remove event listeners when closing modals
3. Limit stored data (archives to 20)
4. Use `scrollIntoView` sparingly

---

## Security

### Password Protection
- **Storage**: SHA-256 hash only (never plaintext)
- **Verification**: Uses Web Crypto API
- **Scope**: Full application access control
- **Recovery**: No password recovery; must clear localStorage

### Data Security
- **Storage**: All data stored client-side in localStorage
- **Encryption**: No encryption (localStorage accessible to browser)
- **Backup**: JSON export/import supported
- **Sharing**: Optional campaign server (self-hosted)

### Best Practices
1. **Password**: Use strong password (min 4 chars)
2. **Backup**: Regular JSON exports
3. **Sharing**: Use password gate when sharing
4. **Server**: Self-host campaign server for sensitive data

---

## Future Roadmap

### v2.2 (Planned)
- **Collaborative VTT**: Real-time updates via WebSocket
- **Character Import/Export**: Standard format for sharing
- **Advanced Search**: Content-aware search with relevance
- **Mobile App**: PWA support

### v3.0 (Long-term)
- **Cloud Sync**: Cross-device data synchronization
- **Campaign Management**: Full campaign structure
- **Module Integration**: Pre-built adventures
- **API**: External tool integration

### Enhancement Ideas
1. **Voice Chat**: WebRTC integration
2. **Interactive Maps**: SVG-based maps with tokens
3. **Automation**: Rules automation for common actions
4. **Analytics**: Usage tracking (opt-in)
5. **Community Content**: User-submitted modules

---

## Appendix

### A. Key Functions Quick Reference

| Function | Purpose | File Location |
|----------|---------|---------------|
| `renderAll()` | Refresh entire UI | Main script |
| `forceSave()` | Save data to localStorage | Main script |
| `performRoll()` | Core dice resolution | Main script |
| `loadDocList()` | Load document manifest | Main script |
| `buildDeck()` | Initialize consequence deck | Main script |
| `hashPassword()` | SHA-256 hash | Main script |
| `exportAllData()` | JSON export | Main script |
| `importAllData()` | JSON import | Main script |

### B. CSS Class Reference

| Class | Usage |
|-------|-------|
| `.doc-grid` | Horizontal scrolling document grid |
| `.doc-card` | Individual document card |
| `.doc-viewer` | Document iframe container |
| `.panel` | Content panel with padding |
| `.btn-*` | Various button styles |
| `.modal-overlay` | Modal background overlay |
| `.modal` | Modal content container |
| `.tab-content` | Tab panel container |
| `.sidebar-nav` | Sidebar navigation |
| `.vtt-container` | VTT layout container |

### C. Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| jsPDF | 2.5.1 | PDF export |
| jsPDF-AutoTable | 3.5.31 | PDF tables |
| Marked.js | Latest | Markdown rendering |
| Fuse.js | 7.0.0 | Fuzzy search |

### D. Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `STORAGE_KEY` | localStorage key | `fates-edge-data` |
| `ARCHIVE_KEY` | Session archive key | `fates-edge-archives` |
| `THEME_KEY` | Theme preference | `fates-edge-theme` |
| `BASE_START_XP` | Starting XP | `32` |
| `MAX_START_XP` | Max starting XP | `36` |

---

## License & Copyright

**Fate's Edge** is © Nicholas A. Gasper.

**SRD** content licensed under CC BY-NC-SA 4.0.

**All other content** is All Rights Reserved.

---

*Document Version: 2.1.0*
*Last Updated: June 2026*
