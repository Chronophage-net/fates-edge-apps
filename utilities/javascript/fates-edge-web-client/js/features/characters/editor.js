/**
 * Editor – Full character editor with dynamic patron loading
 * 
 * UPDATED: Patrons are now loaded dynamically from the patrons feature's state.
 * No hardcoded patron list – uses the same data as the Patrons tab.
 * 
 * Also includes Thiasos/Codex fields for Runekeepers with auto-patron derivation.
 * 
 * REVISED: Added Bound Patron, bloomCount, resonantRites for Cantors.
 * 
 * NEW: learnedTalents array is stored and kept in sync with the chosen magicPath
 * (familiar/codex for Runekeeper, etc.) so the rites panel can correctly detect
 * access to Patron's Gift and Rites.
 */

import { getState, addCharacter, getCharacter, updateCharacter, deleteCharacter } from '../../core/state.js';
import { generateId, escHtml, safeParseInt, clamp } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { loadPatronData } from '../patrons/index.js';

console.log('[Editor] Module loaded');

// ============================================================
// GAME DATA CONSTANTS (from Player's Guide)
// ============================================================

const ALL_SKILLS = [
    'Melee', 'Ranged', 'Unarmed', 'Athletics',
    'Stealth', 'Endurance', 'Craft', 'Sway',
    'Deception', 'Subterfuge', 'Performance', 'Insight',
    'Lore', 'Investigation', 'Medicine', 'Arcana'
];

const HERITAGES = [
    { id: 'human', label: 'Human — The Adaptable', note: 'No attribute adjustments. Endless Reach talent (free)' },
    { id: 'aelaerem', label: 'Aelaerem (Halfling) — Hearth & Hollow', note: 'Wits+1, Presence+1, Body-1. Small Folk traits' },
    { id: 'aelinnel', label: 'Aelinnel (Gnome) — Stone, Bough, Bright Things', note: 'Wits+1, Spirit+1, Body-1. Small Folk traits' },
    { id: 'aeler', label: 'Aeler (Dwarf) — Crowns & Under-Vaults', note: 'Body+1, Spirit+1, Presence-1. Stone-sense' },
    { id: 'lethai-al', label: 'Lethai-al (Wood Elf) — Root, River, Roof-Tree', note: 'Body+1, Wits+1, Presence-1' },
    { id: 'lethai-thora', label: 'Lethai-thora (High Elf) — Mind\'s Eye & Civic Measure', note: 'Wits+1, Spirit+1, Body-1' },
    { id: 'lethai-ar', label: 'Lethai-ar (Dark Elf) — The Oathbound', note: 'Wits+1, Presence+1, Spirit-1' },
    { id: 'ykrul', label: 'Ykrul (Orc) — Wolf Standards, Winter Camps', note: 'Body+1, Spirit+1, Presence-1' },
    { id: 'narethi', label: 'Narethi — The Unburied of the Deep Desert', note: 'Wits+1, Spirit+1, Body-1. Resonance Leash' },
    { id: 'mixed', label: 'Mixed Heritage — Half-Elves, Half-Ykrul, Half-Others', note: 'Choose one +1 and one -1 from parent cultures' }
];

// ─── No hardcoded PATRONS! We load them dynamically from the patrons feature ───

const ARMOR_TYPES = [
    { id: 'none', label: 'No Armor', xpCost: 0, conversion: 'Harm passes directly', penalty: 'None' },
    { id: 'light', label: 'Light Armor', xpCost: 4, conversion: '1→1 (min 1 Fatigue/hit)', penalty: 'None' },
    { id: 'medium', label: 'Medium Armor', xpCost: 8, conversion: '2→1 (min 1 Fatigue/hit)', penalty: '-1d physical skills' },
    { id: 'heavy', label: 'Heavy Armor', xpCost: 12, conversion: '3→2 (min 1 Fatigue/hit)', penalty: '-2d physical, no sprint in rough' },
    { id: 'superior', label: 'Superior Armor', xpCost: 16, conversion: '4→3 (min 1 Fatigue/hit)', penalty: 'Special' },
    { id: 'mythic', label: 'Mythic Armor', xpCost: 20, conversion: '5→4 (min 1 Fatigue/hit)', penalty: 'Special' }
];

const WEAPON_CLASSES = [
    { id: 'light', label: 'Light Weapon (4 XP)', close: '+2d', near: '+1d', notes: 'Fast, concealable' },
    { id: 'medium', label: 'Medium Weapon (8 XP)', close: '+1d', near: '+2d', notes: 'Balanced, battlefield standard' },
    { id: 'heavy', label: 'Heavy Weapon (12 XP)', close: '-1d', near: '+3d', notes: 'Punishing, slow' }
];

const WEAPON_TAGS = [
    'Reach', 'Close', 'Accurate', 'Brutal', 'Hook',
    'Concealable', 'Quickdraw', 'Two-Handed', 'Off-Hand'
];

const SHIELD_TYPES = [
    { id: 'none', label: 'No Shield', xpCost: 0 },
    { id: 'buckler', label: 'Buckler (4 XP)', xpCost: 4 },
    { id: 'heater', label: 'Heater (8 XP)', xpCost: 8 },
    { id: 'pavise', label: 'Pavise (12 XP)', xpCost: 12 }
];

const TIER_THRESHOLDS = [
    { min: 0, max: 40, tier: 'I', name: 'Novice' },
    { min: 41, max: 90, tier: 'II', name: 'Seasoned' },
    { min: 91, max: 150, tier: 'III', name: 'Veteran' },
    { min: 151, max: 220, tier: 'IV', name: 'Paragon' },
    { min: 221, max: Infinity, tier: 'V', name: 'Mythic' }
];

const TALENT_TIERS = [
    { id: 'minor', label: 'Minor', xpRange: '2–3 XP', min: 2, max: 3 },
    { id: 'major', label: 'Major', xpRange: '4–6 XP', min: 4, max: 6 },
    { id: 'prestige', label: 'Prestige', xpRange: '7–10 XP', min: 7, max: 10 },
    { id: 'epic', label: 'Epic', xpRange: '11+ XP', min: 11, max: 999 }
];

const REGIONS = [
    'Acasia', 'Aelaerem', 'Aeler', 'Aelinnel', 'Black Banners', 'Ecktoria',
    'Linn', 'Mistlands', 'Silkstrand', 'Theona', 'Thepyrgos', 'Ubral',
    'Valewood', 'Vhasia', 'Viterra', 'Ykrul', 'Zakov', 'Vilikari',
    'Kahfagia', 'Fhara', 'Pereshi', 'Kuvani', 'Tulkani', 'Ashaan',
    'Sekogo', 'Taharka', 'Sidhi', 'Ngomebe', 'Dhahara', 'Oshiira'
];

const MAGIC_PATHS = [
    { id: 'none', label: 'No Magic Path', talents: [] },
    { id: 'free-caster', label: 'Free Caster (Spellcraft, 6 XP)', talents: ['Spellcraft'] },
    { id: 'runekeeper', label: 'Runekeeper (Familiar 2 XP + Codex 4 XP)', talents: ['Familiar', 'Codex'] },
    { id: 'invoker', label: 'Invoker (Patron\'s Symbol, 4 XP/Patron)', talents: ['Patron\'s Symbol'] },
    { id: 'cantor', label: 'Cantor (Cantor\'s Path, 8 XP)', talents: ['Cantor\'s Path'] },
    { id: 'witch', label: 'Witch (Craft of the Hedge, 4 XP)', talents: ['Craft of the Hedge'] },
    { id: 'psion', label: 'Psion (Psionic Training, 6 XP)', talents: ['Psionic Training'] },
    { id: 'summoner', label: 'Summoner (Pact-Whisperer 2 XP + Lesser Pactwright 2 XP)', talents: ['Pact-Whisperer', 'Lesser Pactwright'] },
    { id: 'monk', label: 'Monk (Monastic Training, 4 XP)', talents: ['Monastic Training'] },
    { id: 'familiar-only', label: 'Familiar Only (Familiar, 2 XP)', talents: ['Familiar'] },
    { id: 'hedge-gifts', label: 'Hedge Gifts Only (Craft of the Hedge, 4 XP)', talents: ['Craft of the Hedge'] }
];

// ─── Mapping from magicPath to the talents that should be auto‑added to learnedTalents ────────
const MAGIC_PATH_LEARNED_TALENTS = {
    runekeeper: ['familiar', 'codex'],
    'familiar-only': ['familiar'],
    cantor: ['cantors-path'],
    summoner: ['pact-whisperer', 'lesser-pactwright'],
    'free-caster': ['spellcraft'],
    witch: ['craft-of-the-hedge'],
    'hedge-gifts': ['craft-of-the-hedge'],
    invoker: [] // no talent needed; symbols are stored separately
};

function defaultSkills() {
    const skills = {};
    ALL_SKILLS.forEach(s => skills[s.toLowerCase()] = 0);
    return skills;
}

// ─── Thiasos/Codex → Patron mapping ──────────────────────────────
// Used for auto-deriving patron when a Runekeeper has Thiasos/Codex but no patron.
// This should ideally come from the patron data, but we keep a reasonable mapping
// as a fallback based on the examples in the grimoire.

const THIASOS_PATRON_MAP = {
    'white-hound': 'mykkiel',
    'ferret': 'inquisitor-prime',
    'bronze-hawk': 'inquisitor-prime',
    'mechanical-bird': 'inquisitor-prime',
    'garden-spider': 'inaea',
    'silk-moth': 'inaea',
    'gray-mouse': 'inaea',
    'fire-salamander': 'oath-of-flame-light',
    'phoenix-fledgling': 'oath-of-flame-light',
    'brass-beetle': 'sacred-geometry',
    'konreh-pieces': 'sacred-geometry',
    'bell-frog': 'gallows-bell',
    'gray-mouse-courthouse': 'gallows-bell',
    'lead-seal': 'varnek-karn',
    'knucklebone': 'varnek-karn',
    'confessor-mouse': 'confessor-beneath-the-bell',
    'bell-cricket': 'confessor-beneath-the-bell',
    'letter-mouse': 'silent-choir',
    'forgetfulness-moth': 'silent-choir',
    'raven': 'the-witness',
    'silverfish': 'the-witness',
    'bronze-key': 'sealed-gate',
    'bell-ward': 'sealed-gate',
};

const CODEX_PATRON_MAP = {
    'iron-bound-ledger': 'inquisitor-prime',
    'slate-tablet': 'inquisitor-prime',
    'frame-loom': 'inaea',
    'knotted-cords': 'inaea',
    'brass-scroll': 'oath-of-flame-light',
    'sun-stone': 'oath-of-flame-light',
    'brass-stencils': 'sacred-geometry',
    'slate-proofs': 'sacred-geometry',
    'court-ledger': 'gallows-bell',
    'bronze-bells': 'gallows-bell',
    'slate-carvings': 'varnek-karn',
    'burial-tablets': 'varnek-karn',
    'bell-ringers-log': 'confessor-beneath-the-bell',
    'leather-strap': 'confessor-beneath-the-bell',
    'locked-journal': 'silent-choir',
    'wax-tablets': 'silent-choir',
    'loose-leaf-pages': 'the-witness',
    'chalkboard': 'the-witness',
    'leather-strap-seals': 'sealed-gate',
    'iron-rings': 'sealed-gate',
};

function derivePatronFromRunekeeperItems({ thiasos, codex }) {
    if (thiasos && THIASOS_PATRON_MAP[thiasos]) return THIASOS_PATRON_MAP[thiasos];
    if (codex && CODEX_PATRON_MAP[codex]) return CODEX_PATRON_MAP[codex];
    return null;
}

// ─── Dynamic patron loader ────────────────────────────────────────

let patronOptionsCache = null;

function getPatronOptions() {
    if (patronOptionsCache) return patronOptionsCache;
    
    const appState = getState();
    const cosmicPatrons = appState.patrons?.cosmic || [];
    
    if (cosmicPatrons.length === 0) {
        patronOptionsCache = [{ id: '', label: 'None — No Patron' }];
        return patronOptionsCache;
    }
    
    const options = cosmicPatrons.map(p => ({
        id: p.id,
        label: `${p.name || p.title || p.id} — ${p.subtitle || p.domain || 'Cosmic Patron'}`
    }));
    options.sort((a, b) => a.label.localeCompare(b.label));
    options.unshift({ id: '', label: 'None — No Patron' });
    
    patronOptionsCache = options;
    return patronOptionsCache;
}

function buildPatronOptionsHTML(selectedId) {
    const options = getPatronOptions();
    return options.map(p => 
        `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>${escHtml(p.label)}</option>`
    ).join('');
}

// ============================================================
// STATE
// ============================================================

const editorState = {
    currentId: null,
    isNew: false,
    isOpen: false,
    saved: false,
    initialized: false,
    modalElement: null,
    escListener: null,
    overlayListener: null,
    saveListener: null,
    cancelListeners: []
};

// ============================================================
// INITIALIZATION
// ============================================================

function initEditor() {
    console.log('[Editor] initEditor called, initialized:', editorState.initialized);
    if (editorState.initialized) return;
    
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.matches('[data-editor-add]')) {
            const type = target.dataset.editorAdd;
            console.log('[Editor] Click: data-editor-add:', type);
            addCEDynamic(type);
            e.preventDefault();
        }
        
        if (target.matches('.editor-remove-btn')) {
            console.log('[Editor] Click: editor-remove-btn');
            const row = target.closest('.dynamic-row');
            if (row) row.remove();
            recalculateXpBudget();
            e.preventDefault();
        }
        
        if (target.matches('[data-editor-wiki-add]')) {
            const type = target.dataset.editorWikiAdd;
            const select = document.getElementById(`ce-${type}-wiki`);
            console.log('[Editor] Click: data-editor-wiki-add:', type, 'select value:', select?.value);
            if (select && select.value) {
                addCEDynamicFromWiki(type, select.value);
                select.value = '';
            }
            e.preventDefault();
        }

        if (target.matches('.ce-catalog-add-btn')) {
            const name = target.dataset.name;
            const cost = parseInt(target.dataset.cost, 10);
            console.log('[Editor] Click: catalog add talent:', name, cost);
            addTalentFromCatalog(name, cost);
            e.preventDefault();
        }

        if (target.matches('#ce-add-custom-talent')) {
            console.log('[Editor] Click: add custom talent');
            addCEDynamic('talent');
            e.preventDefault();
        }
    });
    
    editorState.initialized = true;
    console.log('[Editor] initEditor complete');
}

// ============================================================
// PUBLIC API
// ============================================================

export async function openEditor(id) {
    console.log('[Editor] openEditor called with id:', id);

    closeEditor();

    try {
        await loadPatronData();
        console.log('[Editor] Patron data loaded');
    } catch (err) {
        console.warn('[Editor] Failed to load patron data, using fallback:', err);
    }

    initEditor();

    console.log('[Editor] Creating modal...');
    const modal = createModal();
    document.body.appendChild(modal);
    console.log('[Editor] Modal appended to body');

    const title = document.getElementById('char-modal-title');
    const content = document.getElementById('char-editor-content');

    if (!modal || !title || !content) {
        console.error('[Editor] Modal elements missing!', { modal, title, content });
        showToast('Editor modal not found. Please refresh.', 'error');
        return;
    }

    let c;
    if (id) {
        c = getCharacter(id);
        console.log('[Editor] Retrieved character by id:', id, c ? 'found' : 'not found');
        if (!c) {
            console.error('[Editor] Character not found for id:', id);
            showToast('Character not found', 'error');
            return;
        }
        editorState.currentId = id;
        editorState.isNew = false;
        title.textContent = 'Edit Character';
    } else {
        c = createNewCharacter();
        addCharacter(c);
        console.log('[Editor] Created new character with id:', c.id);
        editorState.currentId = c.id;
        editorState.isNew = true;
        title.textContent = 'New Character';
    }

    // ---- Ensure learnedTalents exists and, if empty, auto‑populate from magicPath ----
    if (!c.learnedTalents) c.learnedTalents = [];
    if (c.learnedTalents.length === 0 && c.magicPath && c.magicPath !== 'none') {
        const talents = MAGIC_PATH_LEARNED_TALENTS[c.magicPath];
        if (talents && talents.length) {
            c.learnedTalents = [...talents];
            console.log('[Editor] Auto‑populated learnedTalents for magicPath', c.magicPath, ':', c.learnedTalents);
        }
    }

    editorState.isOpen = true;
    editorState.saved = false;
    editorState.modalElement = modal;

    console.log('[Editor] Building editor HTML for character:', c.id, c.name);

    let html;
    try {
        html = buildEditorHTML(c);
        console.log('[Editor] buildEditorHTML returned, type:', typeof html, 'length:', html ? html.length : 0);
    } catch (err) {
        console.error('[Editor] Error in buildEditorHTML:', err);
        content.innerHTML = `<div style="padding:1rem;color:var(--red);">Error building editor: ${err.message}</div>`;
        showToast('Error loading editor. See console.', 'error');
        return;
    }

    try {
        content.innerHTML = html;
        console.log('[Editor] content.innerHTML set successfully');
    } catch (err) {
        console.error('[Editor] Error setting content.innerHTML:', err);
        content.innerHTML = `<div style="padding:1rem;color:var(--red);">Error inserting editor content: ${err.message}</div>`;
        showToast('Error loading editor. See console.', 'error');
        return;
    }

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    console.log('[Editor] Modal shown, body class added');

    attachEditorEvents();
    recalculateXpBudget();
    renderTalentCatalog();
    updateMagicPathDisplay();
    console.log('[Editor] openEditor complete');
}

export function closeEditor() {
    console.log('[Editor] closeEditor called, isNew:', editorState.isNew, 'saved:', editorState.saved, 'currentId:', editorState.currentId);
    if (editorState.isNew && !editorState.saved && editorState.currentId) {
        console.log('[Editor] Deleting unsaved new character:', editorState.currentId);
        deleteCharacter(editorState.currentId);
    }

    const modal = document.getElementById('charModal');
    if (modal) {
        if (editorState.overlayListener) {
            modal.removeEventListener('click', editorState.overlayListener);
            editorState.overlayListener = null;
        }
        modal.remove();
        console.log('[Editor] Modal removed');
    }
    
    document.body.classList.remove('modal-open');
    
    if (editorState.escListener) {
        document.removeEventListener('keydown', editorState.escListener);
        editorState.escListener = null;
    }
    
    if (editorState.saveListener) {
        const saveBtn = document.getElementById('ce-save-btn');
        if (saveBtn) saveBtn.removeEventListener('click', editorState.saveListener);
        editorState.saveListener = null;
    }
    
    editorState.cancelListeners.forEach(listener => {
        if (listener.btn) listener.btn.removeEventListener('click', listener.handler);
    });
    editorState.cancelListeners = [];
    
    editorState.isOpen = false;
    editorState.currentId = null;
    editorState.isNew = false;
    editorState.saved = false;
    editorState.modalElement = null;
    console.log('[Editor] Editor state reset');
}

// ============================================================
// MODAL CREATION
// ============================================================

function createModal() {
    console.log('[Editor] createModal called');
    const modal = document.createElement('div');
    modal.id = 'charModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 9999;
        align-items: center;
        justify-content: center;
        padding: 1rem;
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="
            background: var(--bg2);
            border-radius: var(--radius);
            max-width: 950px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 1.5rem 2rem;
            border: 1px solid var(--border);
            position: relative;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h2 id="char-modal-title" style="margin:0;color:var(--gold);">Character Editor</h2>
                <button id="charModalClose" style="background:none;border:none;color:var(--text2);font-size:1.5rem;cursor:pointer;padding:0.2rem 0.5rem;">✕</button>
            </div>
            <div id="char-editor-content"></div>
        </div>
    `;
    console.log('[Editor] Modal element created');
    return modal;
}

// ============================================================
// HELPERS
// ============================================================

function createNewCharacter() {
    console.log('[Editor] createNewCharacter called');
    return {
        id: generateId(),
        name: '',
        heritage: 'human',
        heritageNote: '',
        background: '',
        backgroundTags: [],
        backgroundContact: '',
        backgroundBoon: '',
        backgroundObligation: '',
        region: '',
        culturalAffinity: '',
        patron: '',
        magicPath: 'none',
        tier: 'I',
        totalXp: 32,
        startingXp: 32,
        xpFromBonds: 0,
        xpFromComplications: 0,
        xpSpent: 0,
        body: 1,
        wits: 1,
        spirit: 1,
        presence: 1,
        skills: defaultSkills(),
        talents: [],
        assets: [],
        equipment: [],
        bonds: [],
        complications: [],
        strings: [],
        debtTimers: [],
        harm: 0,
        fatigue: 0,
        fatigueMax: 1,
        boons: 0,
        obligation: 0,
        obligationCapacity: 2,
        corruption: 0,
        corruptionMax: 1,
        corruptionTier: 0,
        spellbook: [],
        boundSpirits: [],
        leash: 0,
        leashCapacity: 4,
        mentalStrain: 0,
        mentalStrainMax: 0,
        vtt: false,
        armorType: 'none',
        shieldType: 'none',
        weaponClass: 'light',
        weaponTags: [],
        armorConversion: '',
        meleeMods: '',
        rangedMods: '',
        symbols: [],
        symbolStates: {},
        rites: [],
        thiasos: '',
        codex: '',
        repertoire: [],
        hedgeGifts: [],
        shadow: 0,
        shame: 0,
        identityStrain: 0,
        promiseTimers: [],
        psionicArts: [],
        boundSpirits: [],
        monasticTradition: '',
        breathState: 'entering',
        monkCorruptionTier: 0,
        knownTags: [],
        // ─── NEW Cantor fields ───────────────────────────────────
        boundPatron: '',
        boundPatronBonus: 1,
        bloomCount: 0,
        resonantRites: [],
        // ─── NEW: learnedTalents (kept in sync with magicPath) ───────
        learnedTalents: []
    };
}

function getTierFromXp(xp) {
    for (const t of TIER_THRESHOLDS) {
        if (xp >= t.min && xp <= t.max) {
            return { tier: t.tier, name: t.name };
        }
    }
    return { tier: 'V', name: 'Mythic' };
}

function calculateAttributeCost(currentRating, targetRating) {
    let cost = 0;
    for (let i = currentRating + 1; i <= targetRating; i++) {
        cost += i * 3;
    }
    return cost;
}

function calculateSkillCost(currentLevel, targetLevel) {
    let cost = 0;
    for (let i = currentLevel + 1; i <= targetLevel; i++) {
        cost += i * 2;
    }
    return cost;
}

function calculateTotalXpSpent(c) {
    let spent = 0;
    
    spent += calculateAttributeCost(1, c.body || 1);
    spent += calculateAttributeCost(1, c.wits || 1);
    spent += calculateAttributeCost(1, c.spirit || 1);
    spent += calculateAttributeCost(1, c.presence || 1);
    
    if (c.skills) {
        ALL_SKILLS.forEach(s => {
            const level = c.skills[s.toLowerCase()] || 0;
            spent += calculateSkillCost(0, level);
        });
    }
    
    if (c.talents) {
        c.talents.forEach(t => spent += safeParseInt(t.cost, 0));
    }
    
    if (c.assets) {
        c.assets.forEach(a => spent += safeParseInt(a.cost, 0));
    }
    
    if (c.equipment) {
        c.equipment.forEach(e => spent += safeParseInt(e.cost, 0));
    }
    
    return spent;
}

// ============================================================
// TALENT CATALOG
// ============================================================

function getAvailableTalentsForTier(totalXp) {
    console.log('[Editor] getAvailableTalentsForTier totalXp:', totalXp);
    const appState = getState();
    const localTalents = appState.talents || [];
    const wikiEntries = appState.wikiEntries || [];
    const wikiTalents = wikiEntries.filter(e => e.category === 'talents' || e.category === 'talent');

    const allTalents = [
        ...localTalents.map(t => ({ ...t, source: 'local' })),
        ...wikiTalents.map(t => ({ ...t, name: t.title, description: t.body || t.description, source: 'wiki' }))
    ];

    const { tier } = getTierFromXp(totalXp);
    let allowedTiers = [];
    if (tier === 'I') allowedTiers = ['minor'];
    else if (tier === 'II') allowedTiers = ['minor', 'major'];
    else allowedTiers = ['minor', 'major', 'prestige', 'epic'];

    const filtered = allTalents.filter(t => {
        const cost = safeParseInt(t.cost, 0);
        for (const tierObj of TALENT_TIERS) {
            if (cost >= tierObj.min && cost <= tierObj.max && allowedTiers.includes(tierObj.id))
                return true;
        }
        return false;
    });
    console.log('[Editor] Available talents for tier:', filtered.length);
    return filtered;
}

function renderTalentCatalog() {
    console.log('[Editor] renderTalentCatalog called');
    const catalogEl = document.getElementById('ce-talent-catalog');
    if (!catalogEl) {
        console.warn('[Editor] Catalog element not found');
        return;
    }
    const totalXp = safeParseInt(document.getElementById('ce-total-xp')?.value, 32);
    const available = getAvailableTalentsForTier(totalXp);

    if (available.length === 0) {
        catalogEl.innerHTML = '<div style="padding:0.5rem;color:var(--text3);font-size:0.85rem;">No talents available for your current tier.</div>';
        return;
    }

    catalogEl.innerHTML = available.map(t => {
        const cost = safeParseInt(t.cost, 0);
        const tierObj = TALENT_TIERS.find(ti => cost >= ti.min && cost <= ti.max);
        const tierLabel = tierObj ? tierObj.label : '?';
        return `
            <div class="talent-catalog-item" style="display:flex;align-items:center;padding:0.3rem 0.5rem;font-size:0.8rem;border-bottom:1px solid var(--border);">
                <div class="talent-info" style="flex:1;">
                    <span style="font-weight:500;">${escHtml(t.name)}</span>
                    <span style="color:var(--gold); margin-left:0.3rem;">${cost} XP</span>
                    <span style="color:var(--text3); font-size:0.75rem; margin-left:0.3rem;">(${tierLabel})</span>
                    ${t.description ? `<div style="color:var(--text2); font-size:0.7rem;">${escHtml(t.description)}</div>` : ''}
                </div>
                <button class="btn btn-xs btn-primary ce-catalog-add-btn" data-name="${escHtml(t.name)}" data-cost="${cost}">Add</button>
            </div>
        `;
    }).join('');
    console.log('[Editor] Catalog rendered with', available.length, 'items');
}

function addTalentFromCatalog(name, cost) {
    console.log('[Editor] addTalentFromCatalog:', name, cost);
    const listEl = document.getElementById('ce-talent-list');
    if (!listEl) {
        console.warn('[Editor] Talent list element not found');
        return;
    }

    const row = document.createElement('div');
    row.className = 'dynamic-row ce-talent-row';
    row.innerHTML = `
        <span class="ce-talent-name" style="flex:2; padding:0.2rem;">${escHtml(name)}</span>
        <span class="ce-talent-cost" style="width:70px; text-align:center;">${cost}</span>
        <button class="btn btn-xs editor-remove-btn">✕</button>
    `;
    listEl.appendChild(row);

    recalculateXpBudget();
    showToast(`Added talent "${name}" (${cost} XP)`, 'success');
    console.log('[Editor] Talent added from catalog');
}

// ============================================================
// EVENT ATTACHMENT
// ============================================================

function attachEditorEvents() {
    console.log('[Editor] attachEditorEvents called');
    const saveBtn = document.getElementById('ce-save-btn');
    if (saveBtn) {
        if (editorState.saveListener) {
            saveBtn.removeEventListener('click', editorState.saveListener);
        }
        editorState.saveListener = saveEditor;
        saveBtn.addEventListener('click', editorState.saveListener);
        console.log('[Editor] Save listener attached');
    }
    
    const closeBtns = ['ce-cancel-btn', 'charModalClose'];
    for (const id of closeBtns) {
        const btn = document.getElementById(id);
        if (btn) {
            const handler = closeEditor;
            btn.addEventListener('click', handler);
            editorState.cancelListeners.push({ btn, handler });
            console.log('[Editor] Close listener attached to', id);
        }
    }
    
    const modal = document.getElementById('charModal');
    if (modal) {
        if (editorState.overlayListener) {
            modal.removeEventListener('click', editorState.overlayListener);
            editorState.overlayListener = null;
        }
        const handler = (e) => {
            if (e.target === modal) closeEditor();
        };
        modal.addEventListener('click', handler);
        editorState.overlayListener = handler;
        console.log('[Editor] Overlay click listener attached');
    }
    
    if (editorState.escListener) {
        document.removeEventListener('keydown', editorState.escListener);
    }
    editorState.escListener = (e) => {
        if (!editorState.isOpen) return;
        if (e.key === 'Escape') closeEditor();
    };
    document.addEventListener('keydown', editorState.escListener);
    console.log('[Editor] Escape listener attached');
    
    ['body', 'wits', 'spirit', 'presence'].forEach(attr => {
        const input = document.getElementById(`ce-${attr}`);
        if (input) {
            input.addEventListener('change', updateDerivedStats);
            input.addEventListener('input', updateDerivedStats);
        }
    });
    console.log('[Editor] Attribute listeners attached');
    
    const heritageSelect = document.getElementById('ce-heritage');
    if (heritageSelect) {
        heritageSelect.addEventListener('change', updateHeritageNote);
    }
    
    const xpInput = document.getElementById('ce-total-xp');
    if (xpInput) {
        xpInput.addEventListener('input', () => {
            updateTierDisplay();
            renderTalentCatalog();
        });
        xpInput.addEventListener('change', () => {
            updateTierDisplay();
            renderTalentCatalog();
        });
        console.log('[Editor] XP input listeners attached');
    }
    
    const armorSelect = document.getElementById('ce-armor-type');
    if (armorSelect) {
        armorSelect.addEventListener('change', updateArmorConversion);
    }
    
    const shieldSelect = document.getElementById('ce-shield-type');
    if (shieldSelect) {
        shieldSelect.addEventListener('change', recalculateXpBudget);
    }
    
    const weaponSelect = document.getElementById('ce-weapon-class');
    if (weaponSelect) {
        weaponSelect.addEventListener('change', updateWeaponMods);
    }
    
    const magicPathSelect = document.getElementById('ce-magic-path');
    if (magicPathSelect) {
        magicPathSelect.addEventListener('change', updateMagicPathDisplay);
    }
    
    ALL_SKILLS.forEach(s => {
        const key = s.toLowerCase();
        const input = document.getElementById(`ce-sk-${key}`);
        if (input) {
            input.addEventListener('change', () => validateSkillCap(key, s));
            input.addEventListener('input', () => recalculateXpBudget());
        }
    });
    console.log('[Editor] Skill listeners attached');
    
    document.querySelectorAll('.ce-weapon-tag').forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = document.querySelectorAll('.ce-weapon-tag:checked');
            if (checked.length > 2) {
                cb.checked = false;
                showToast('Weapon Tags are capped at 2.', 'warning');
            }
            recalculateXpBudget();
        });
    });
    console.log('[Editor] Weapon tag listeners attached');
}

// ============================================================
// SAVE EDITOR
// ============================================================

export function saveEditor() {
    console.log('[Editor] saveEditor called');
    const g = s => document.querySelector(s);
    const v = s => g(s)?.value || '';
    const n = s => safeParseInt(g(s)?.value);
    
    const name = v('#ce-name');
    if (!name || !name.trim()) {
        console.warn('[Editor] Save aborted: name is required');
        showToast('Character name is required.', 'error');
        const nameInput = document.querySelector('#ce-name');
        if (nameInput) {
            nameInput.style.borderColor = 'var(--red)';
            nameInput.focus();
            setTimeout(() => nameInput.style.borderColor = '', 3000);
        }
        return;
    }
    
    let c = getCharacter(editorState.currentId);
    if (!c) {
        console.error('[Editor] Character not found for id:', editorState.currentId);
        showToast('Character not found', 'error');
        return;
    }
    console.log('[Editor] Saving character:', c.id, 'current name:', c.name);
    
    try {
        c.name = name.trim();
        c.heritage = v('#ce-heritage') || 'human';
        c.region = v('#ce-region');
        c.culturalAffinity = v('#ce-cultural-affinity');
        
        c.background = v('#ce-background');
        c.backgroundTags = v('#ce-background-tags') ? v('#ce-background-tags').split(',').map(t => t.trim()).filter(Boolean) : [];
        c.backgroundContact = v('#ce-background-contact');
        c.backgroundBoon = v('#ce-background-boon');
        c.backgroundObligation = v('#ce-background-obligation');
        
        c.body = clamp(n('#ce-body'), 1, 5);
        c.wits = clamp(n('#ce-wits'), 1, 5);
        c.spirit = clamp(n('#ce-spirit'), 1, 5);
        c.presence = clamp(n('#ce-presence'), 1, 5);
        
        c.fatigueMax = c.body;
        c.obligationCapacity = c.spirit + c.presence;
        c.corruptionMax = c.spirit;
        c.mentalStrainMax = c.spirit;
        
        if (!c.skills) c.skills = defaultSkills();
        ALL_SKILLS.forEach(s => {
            c.skills[s.toLowerCase()] = clamp(n('#ce-sk-' + s.toLowerCase()), 0, 5);
        });
        
        c.magicPath = v('#ce-magic-path') || 'none';
        c.patron = v('#ce-patron');
        
        c.thiasos = v('#ce-thiasos').trim();
        c.codex = v('#ce-codex').trim();
        
        // ─── New Cantor fields ──────────────────────────────────────
        c.boundPatron = v('#ce-bound-patron');
        c.boundPatronBonus = clamp(n('#ce-bound-patron-bonus'), 0, 3);
        c.bloomCount = Math.max(0, n('#ce-bloom-count'));
        c.resonantRites = v('#ce-resonant-rites')
            ? v('#ce-resonant-rites').split(',').map(s => s.trim()).filter(Boolean)
            : [];
        
        // ─── Auto-derive patron for Runekeeper ──────────────────────
        if (c.magicPath === 'runekeeper' && !c.patron) {
            const derived = derivePatronFromRunekeeperItems({ 
                thiasos: c.thiasos, 
                codex: c.codex 
            });
            if (derived) {
                c.patron = derived;
                const patronSelect = document.getElementById('ce-patron');
                if (patronSelect) patronSelect.value = derived;
                showToast(`🔮 Patron auto-set to ${derived} from Thiasos/Codex.`, 'info');
            } else if (c.thiasos || c.codex) {
                showToast('⚠️ Thiasos/Codex selected but patron could not be auto-detected. Please select a patron.', 'warning');
            }
        }
        
        c.armorType = v('#ce-armor-type') || 'none';
        c.shieldType = v('#ce-shield-type') || 'none';
        c.weaponClass = v('#ce-weapon-class') || 'light';
        c.weaponTags = Array.from(document.querySelectorAll('.ce-weapon-tag:checked')).map(cb => cb.value).slice(0, 2);
        c.armorConversion = ARMOR_TYPES.find(a => a.id === c.armorType)?.conversion || '';
        
        c.totalXp = Math.max(0, n('#ce-total-xp'));
        const { tier, name: tierName } = getTierFromXp(c.totalXp);
        c.tier = tier;
        c.tierName = tierName;
        
        c.harm = clamp(n('#ce-harm'), 0, 3);
        c.fatigue = clamp(n('#ce-fatigue'), 0, c.fatigueMax);
        c.boons = clamp(n('#ce-boons'), 0, 5);
        c.obligation = Math.max(0, n('#ce-obligation'));
        c.corruption = clamp(n('#ce-corruption'), 0, c.corruptionMax);
        c.corruptionTier = Math.max(0, n('#ce-corruption-tier'));
        c.leash = Math.max(0, n('#ce-leash'));
        c.mentalStrain = clamp(n('#ce-mental-strain'), 0, c.mentalStrainMax);
        c.vtt = document.getElementById('ce-vtt')?.checked || false;
        
        c.symbols = readDynamicList('symbol').map(row => row.patron).filter(Boolean);
        c.symbolStates = {};
        readDynamicList('symbol').forEach(row => {
            if (row.patron) c.symbolStates[row.patron] = row.state || 'active';
        });
        c.rites = readDynamicList('rite').map(row => row.name).filter(Boolean);
        c.repertoire = readDynamicList('repertoire').map(row => row.name).filter(Boolean);
        c.hedgeGifts = readDynamicList('hedge-gift').map(row => row.name).filter(Boolean);
        c.shadow = Math.max(0, n('#ce-shadow'));
        c.shame = Math.max(0, n('#ce-shame'));
        c.identityStrain = Math.max(0, n('#ce-identity-strain'));
        c.promiseTimers = readDynamicList('promise-timer').map(row => ({
            name: row.name,
            segments: row.segments || 4
        })).filter(p => p.name);
        c.psionicArts = readDynamicList('psionic-art').map(row => row.name).filter(Boolean);
        c.boundSpirits = readDynamicList('bound-spirit').map(row => ({
            name: row.name,
            cap: row.cap || 1,
            nature: row.nature || '',
            services: row.services || ''
        })).filter(s => s.name);
        c.monasticTradition = v('#ce-monastic-tradition');
        c.breathState = v('#ce-breath-state') || 'entering';
        c.monkCorruptionTier = Math.max(0, n('#ce-monk-corruption-tier'));
        c.knownTags = readDynamicList('known-tag').map(row => row.name).filter(Boolean);
        
        c.talents = readDynamicList('talent');
        c.assets = readDynamicList('asset');
        c.equipment = readDynamicList('equipment');
        c.bonds = readDynamicList('bond');
        c.complications = readDynamicList('complication');
        console.log('[Editor] Dynamic lists read: talents=', c.talents.length, 'assets=', c.assets.length, 'equipment=', c.equipment.length, 'bonds=', c.bonds.length, 'complications=', c.complications.length);
        
        // ---- Ensure learnedTalents exists and, if empty, auto‑populate from magicPath ----
        if (!c.learnedTalents) c.learnedTalents = [];
        if (c.learnedTalents.length === 0 && c.magicPath && c.magicPath !== 'none') {
            const talents = MAGIC_PATH_LEARNED_TALENTS[c.magicPath];
            if (talents && talents.length) {
                c.learnedTalents = [...talents];
                console.log('[Editor] Auto‑populated learnedTalents on save for magicPath', c.magicPath, ':', c.learnedTalents);
            }
        }
        
        if (editorState.isNew) {
            const startBonds = c.bonds.filter(b => b.start).length;
            const startComps = c.complications.filter(x => x.start).length;
            
            if (startBonds > 2) {
                showToast(`Only 2 Bonds can grant +XP at creation. ${startBonds} marked. Only first 2 will count.`, 'warning');
            }
            if (startComps > 2) {
                showToast(`Only 2 Complications can grant +XP at creation. ${startComps} marked. Only first 2 will count.`, 'warning');
            }
            
            c.xpFromBonds = Math.min(startBonds, 2) * 2;
            c.xpFromComplications = Math.min(startComps, 2) * 2;
            c.startingXp = 32 + c.xpFromBonds + c.xpFromComplications;
            
            if (c.startingXp > 36) {
                c.startingXp = 36;
                showToast('Starting XP capped at 36.', 'warning');
            }
            
            c.totalXp = c.startingXp;
            const { tier: newTier, name: newTierName } = getTierFromXp(c.totalXp);
            c.tier = newTier;
            c.tierName = newTierName;
            
            const spent = calculateTotalXpSpent(c);
            c.xpSpent = spent;
            
            if (spent > c.startingXp) {
                const over = spent - c.startingXp;
                const proceed = confirm(
                    `This character is ${over} XP over budget (${spent} spent, ${c.startingXp} available).\n\n` +
                    `Do you want to save anyway? (GM may allow this.)`
                );
                if (!proceed) {
                    console.log('[Editor] Save cancelled by user due to over budget');
                    return;
                }
            }
        }
        
        updateCharacter(editorState.currentId, c);
        console.log('[Editor] Character updated in state');
        
        editorState.saved = true;
        closeEditor();
        console.log('[Editor] Editor closed after save');
        
        import('./index.js').then(module => {
            if (module.renderCharList) {
                module.renderCharList();
                console.log('[Editor] Character list re-rendered');
            }
        }).catch(err => {
            console.warn('[Editor] Failed to re-render character list:', err);
        });
        
        showToast(`Character "${c.name}" saved successfully. (Tier ${c.tier}: ${c.tierName})`, 'success');
        console.log('[Editor] Save completed successfully');
        
    } catch (error) {
        console.error('[Editor] Error saving character:', error);
        showToast('Error saving character. Please try again.', 'error');
    }
}

// ============================================================
// READ DYNAMIC LISTS
// ============================================================

function readDynamicList(type) {
    console.log('[Editor] readDynamicList:', type);
    const items = [];
    const rows = document.querySelectorAll('.ce-' + type + '-row');
    console.log(`[Editor] Found ${rows.length} rows for type ${type}`);
    
    for (const row of rows) {
        if (type === 'bond') {
            const nameInput = row.querySelector('.ce-bond-name');
            const descInput = row.querySelector('.ce-bond-desc');
            const startCheck = row.querySelector('.ce-bond-start');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) continue;
            items.push({
                name,
                desc: descInput ? descInput.value.trim() : '',
                start: startCheck ? startCheck.checked : false
            });
        }
        else if (type === 'complication') {
            const nameInput = row.querySelector('.ce-complication-name');
            const descInput = row.querySelector('.ce-complication-desc');
            const startCheck = row.querySelector('.ce-complication-start');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) continue;
            items.push({
                name,
                desc: descInput ? descInput.value.trim() : '',
                start: startCheck ? startCheck.checked : false
            });
        }
        else if (type === 'symbol') {
            const patronSelect = row.querySelector('.ce-symbol-patron');
            const stateSelect = row.querySelector('.ce-symbol-state');
            const patron = patronSelect ? patronSelect.value : '';
            if (!patron) continue;
            items.push({
                patron,
                state: stateSelect ? stateSelect.value : 'active'
            });
        }
        else if (type === 'promise-timer') {
            const nameInput = row.querySelector('.ce-promise-timer-name');
            const segInput = row.querySelector('.ce-promise-timer-segments');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) continue;
            items.push({
                name,
                segments: segInput ? safeParseInt(segInput.value, 4) : 4
            });
        }
        else if (type === 'bound-spirit') {
            const nameInput = row.querySelector('.ce-bound-spirit-name');
            const capInput = row.querySelector('.ce-bound-spirit-cap');
            const natureInput = row.querySelector('.ce-bound-spirit-nature');
            const servicesInput = row.querySelector('.ce-bound-spirit-services');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) continue;
            items.push({
                name,
                cap: capInput ? safeParseInt(capInput.value, 1) : 1,
                nature: natureInput ? natureInput.value.trim() : '',
                services: servicesInput ? servicesInput.value.trim() : ''
            });
        }
        else if (['rite', 'repertoire', 'hedge-gift', 'psionic-art', 'known-tag'].includes(type)) {
            const nameInput = row.querySelector('.ce-' + type + '-name');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) continue;
            items.push({ name });
        }
        else if (['asset', 'equipment', 'talent'].includes(type)) {
            const nameEl = row.querySelector('.ce-' + type + '-name');
            const costEl = row.querySelector('.ce-' + type + '-cost');
            const name = nameEl ? nameEl.value.trim() : '';
            if (!name) continue;
            const cost = costEl ? safeParseInt(costEl.value, 0) : 0;
            const item = { name, cost };
            if (type === 'asset') {
                const tierSelect = row.querySelector('.ce-asset-tier');
                if (tierSelect) item.tier = tierSelect.value;
            }
            items.push(item);
        }
    }
    console.log(`[Editor] readDynamicList ${type} returned ${items.length} items`);
    return items;
}

// ============================================================
// DYNAMIC ROW ADDERS
// ============================================================

export function addCEDynamic(type) {
    console.log('[Editor] addCEDynamic called for type:', type);
    const container = document.getElementById('ce-' + type + '-list');
    if (!container) {
        console.warn('[Editor] Container not found for:', type);
        return;
    }
    
    const idx = container.children.length;
    const div = document.createElement('div');
    div.innerHTML = dynamicRowHTML(type, idx, {});
    const row = div.firstElementChild;
    container.appendChild(row);
    
    const firstInput = row.querySelector('input[type="text"]');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 50);
    }
    
    recalculateXpBudget();
    console.log('[Editor] Dynamic row added for', type);
}

export function addCEDynamicFromWiki(type, entryId) {
    console.log('[Editor] addCEDynamicFromWiki:', type, entryId);
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    const entry = wikiEntries.find(e => String(e.id) === String(entryId));
    
    if (!entry) {
        console.warn('[Editor] Wiki entry not found:', entryId);
        showToast('Wiki entry not found.', 'error');
        return;
    }
    
    const container = document.getElementById('ce-' + type + '-list');
    if (!container) {
        console.warn('[Editor] Container not found for:', type);
        return;
    }
    
    const idx = container.children.length;
    const cost = entry.cost != null ? entry.cost : 0;
    const div = document.createElement('div');
    div.innerHTML = dynamicRowHTML(type, idx, { name: entry.title, cost });
    container.appendChild(div.firstElementChild);
    
    showToast(`Added "${entry.title}" from wiki.`, 'success');
    recalculateXpBudget();
    console.log('[Editor] Added from wiki:', entry.title);
}

// ============================================================
// SETUP EVENTS
// ============================================================

function setupEditorEvents() {
    console.log('[Editor] setupEditorEvents called');
    document.addEventListener('keydown', (e) => {
        if (!editorState.isOpen) return;
        if (e.key === 'Escape') {
            console.log('[Editor] Escape key pressed, closing editor');
            closeEditor();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const saveBtn = document.getElementById('ce-save-btn');
            if (saveBtn) {
                console.log('[Editor] Ctrl+Enter pressed, triggering save');
                saveBtn.click();
            }
        }
    });
}

// ============================================================
// INITIALIZE
// ============================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Editor] DOMContentLoaded, initializing');
        initEditor();
        setupEditorEvents();
    });
} else {
    console.log('[Editor] DOM already loaded, initializing');
    initEditor();
    setupEditorEvents();
}

// ============================================================
// EXPOSE GLOBALS
// ============================================================

Object.assign(window, {
    addCEDynamic,
    addCEDynamicFromWiki,
    saveEditor,
    closeEditor,
    openEditor
});
console.log('[Editor] Globals exposed');

// ============================================================
// EXPORTS
// ============================================================

export default {
    openEditor,
    closeEditor,
    saveEditor,
    addCEDynamic,
    addCEDynamicFromWiki
};