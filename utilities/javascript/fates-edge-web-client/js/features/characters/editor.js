/**
 * Editor – Full character editor with dynamic patron loading
 * 
 * UPDATED: Patrons are now loaded dynamically from the patrons feature's state.
 * No hardcoded patron list – uses the same data as the Patrons tab.
 * 
 * Also includes Thiasos/Codex fields for Runekeepers with auto-patron derivation.
 * 
 * REVISED: Added Bound Patron, bloomCount, resonantRites for Cantors.
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
        resonantRites: []
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

function updateDerivedStats() {
    const body = safeParseInt(document.getElementById('ce-body')?.value, 1);
    const spirit = safeParseInt(document.getElementById('ce-spirit')?.value, 1);
    const presence = safeParseInt(document.getElementById('ce-presence')?.value, 1);
    
    const fatigueMaxEl = document.getElementById('ce-fatigue-max');
    if (fatigueMaxEl) fatigueMaxEl.textContent = body;
    
    const fatigueInput = document.getElementById('ce-fatigue');
    if (fatigueInput) fatigueInput.max = body;
    
    const obligCapEl = document.getElementById('ce-obligation-capacity');
    if (obligCapEl) obligCapEl.textContent = spirit + presence;
    
    const obligInput = document.getElementById('ce-obligation');
    if (obligInput) {
        obligInput.max = (spirit + presence) * 2;
    }
    
    const corruptMaxEl = document.getElementById('ce-corruption-max');
    if (corruptMaxEl) corruptMaxEl.textContent = spirit;
    
    const corruptInput = document.getElementById('ce-corruption');
    if (corruptInput) corruptInput.max = spirit;
    
    const strainMaxEl = document.getElementById('ce-mental-strain-max');
    if (strainMaxEl) strainMaxEl.textContent = spirit;
    
    recalculateXpBudget();
}

function updateTierDisplay() {
    const xp = safeParseInt(document.getElementById('ce-total-xp')?.value, 0);
    const { tier, name } = getTierFromXp(xp);
    const tierEl = document.getElementById('ce-tier-display');
    if (tierEl) tierEl.textContent = `Tier ${tier}: ${name}`;
    recalculateXpBudget();
}

function updateHeritageNote() {
    const heritageId = document.getElementById('ce-heritage')?.value;
    const heritage = HERITAGES.find(h => h.id === heritageId);
    const noteEl = document.getElementById('ce-heritage-note');
    if (noteEl && heritage) {
        noteEl.textContent = heritage.note;
        noteEl.style.display = heritage.note ? 'block' : 'none';
    }
}

function updateArmorConversion() {
    const armorId = document.getElementById('ce-armor-type')?.value;
    const armor = ARMOR_TYPES.find(a => a.id === armorId);
    const convEl = document.getElementById('ce-armor-conversion');
    if (convEl && armor) {
        convEl.textContent = armor.conversion;
    }
    recalculateXpBudget();
}

function updateWeaponMods() {
    const weaponId = document.getElementById('ce-weapon-class')?.value;
    const weapon = WEAPON_CLASSES.find(w => w.id === weaponId);
    const modsEl = document.getElementById('ce-weapon-mods');
    if (modsEl && weapon) {
        modsEl.textContent = `Close: ${weapon.close} | Near: ${weapon.near} | ${weapon.notes}`;
    }
    recalculateXpBudget();
}

function updateMagicPathDisplay() {
    const pathId = document.getElementById('ce-magic-path')?.value;
    const path = MAGIC_PATHS.find(p => p.id === pathId);
    const infoEl = document.getElementById('ce-magic-path-info');
    if (infoEl && path) {
        infoEl.textContent = path.talents.length > 0 
            ? `Required talents: ${path.talents.join(', ')}` 
            : 'No magic path selected';
    }
    
    const symbolSection = document.getElementById('ce-invoker-section');
    if (symbolSection) {
        symbolSection.style.display = pathId === 'invoker' ? 'block' : 'none';
    }
    const ritesSection = document.getElementById('ce-runekeeper-section');
    if (ritesSection) {
        ritesSection.style.display = pathId === 'runekeeper' ? 'block' : 'none';
    }
    const corruptionSection = document.getElementById('ce-corruption-section');
    if (corruptionSection) {
        corruptionSection.style.display = pathId === 'cantor' ? 'flex' : 'none';
    }
    const repertoireSection = document.getElementById('ce-cantor-section');
    if (repertoireSection) {
        repertoireSection.style.display = pathId === 'cantor' ? 'block' : 'none';
    }
    const witchSection = document.getElementById('ce-witch-section');
    if (witchSection) {
        witchSection.style.display = pathId === 'witch' ? 'block' : 'none';
    }
    const psionSection = document.getElementById('ce-psion-section');
    if (psionSection) {
        psionSection.style.display = pathId === 'psion' ? 'block' : 'none';
    }
    const leashSection = document.getElementById('ce-leash-section');
    if (leashSection) {
        leashSection.style.display = pathId === 'summoner' ? 'flex' : 'none';
    }
    const summonerSection = document.getElementById('ce-summoner-section');
    if (summonerSection) {
        summonerSection.style.display = pathId === 'summoner' ? 'block' : 'none';
    }
    const monkSection = document.getElementById('ce-monk-section');
    if (monkSection) {
        monkSection.style.display = pathId === 'monk' ? 'block' : 'none';
    }
    const freeCasterSection = document.getElementById('ce-free-caster-section');
    if (freeCasterSection) {
        freeCasterSection.style.display = pathId === 'free-caster' ? 'block' : 'none';
    }
    
    recalculateXpBudget();
}

function validateSkillCap(skillKey, skillName) {
    const input = document.getElementById(`ce-sk-${skillKey}`);
    if (!input) return;
    const level = safeParseInt(input.value, 0);
    if (level > 5) {
        input.value = 5;
        showToast(`${skillName} cannot exceed 5.`, 'warning');
    }
    recalculateXpBudget();
}

// ============================================================
// XP BUDGET CALCULATION
// ============================================================

function recalculateXpBudget() {
    console.log('[Editor] recalculateXpBudget called');
    const body = safeParseInt(document.getElementById('ce-body')?.value, 1);
    const wits = safeParseInt(document.getElementById('ce-wits')?.value, 1);
    const spirit = safeParseInt(document.getElementById('ce-spirit')?.value, 1);
    const presence = safeParseInt(document.getElementById('ce-presence')?.value, 1);
    
    let spent = 0;
    
    spent += calculateAttributeCost(1, body);
    spent += calculateAttributeCost(1, wits);
    spent += calculateAttributeCost(1, spirit);
    spent += calculateAttributeCost(1, presence);
    
    ALL_SKILLS.forEach(s => {
        const key = s.toLowerCase();
        const level = safeParseInt(document.getElementById(`ce-sk-${key}`)?.value, 0);
        spent += calculateSkillCost(0, level);
    });
    
    document.querySelectorAll('.ce-talent-row').forEach(row => {
        const costEl = row.querySelector('.ce-talent-cost');
        if (costEl) {
            if (costEl.tagName === 'INPUT') {
                spent += safeParseInt(costEl.value, 0);
            } else {
                spent += safeParseInt(costEl.textContent, 0);
            }
        }
    });
    
    document.querySelectorAll('.ce-asset-row').forEach(row => {
        const costInput = row.querySelector('.ce-asset-cost');
        spent += safeParseInt(costInput?.value, 0);
    });
    
    document.querySelectorAll('.ce-equipment-row').forEach(row => {
        const costInput = row.querySelector('.ce-equipment-cost');
        spent += safeParseInt(costInput?.value, 0);
    });
    
    const armorId = document.getElementById('ce-armor-type')?.value;
    const armor = ARMOR_TYPES.find(a => a.id === armorId);
    if (armor) spent += armor.xpCost;
    
    const shieldId = document.getElementById('ce-shield-type')?.value;
    const shield = SHIELD_TYPES.find(s => s.id === shieldId);
    if (shield) spent += shield.xpCost;
    
    const weaponId = document.getElementById('ce-weapon-class')?.value;
    const weapon = WEAPON_CLASSES.find(w => w.id === weaponId);
    if (weapon) {
        const weaponXp = { light: 4, medium: 8, heavy: 12 };
        spent += weaponXp[weaponId] || 0;
    }
    
    const checkedTags = document.querySelectorAll('.ce-weapon-tag:checked');
    const tagCount = Math.min(checkedTags.length, 2);
    spent += tagCount * 4;
    
    let bondCount = 0;
    document.querySelectorAll('.ce-bond-row').forEach(row => {
        const nameInput = row.querySelector('.ce-bond-name');
        const startCheck = row.querySelector('.ce-bond-start');
        if (nameInput?.value.trim() && startCheck?.checked) bondCount++;
    });
    bondCount = Math.min(bondCount, 2);
    const xpFromBonds = bondCount * 2;
    
    let compCount = 0;
    document.querySelectorAll('.ce-complication-row').forEach(row => {
        const nameInput = row.querySelector('.ce-complication-name');
        const startCheck = row.querySelector('.ce-complication-start');
        if (nameInput?.value.trim() && startCheck?.checked) compCount++;
    });
    compCount = Math.min(compCount, 2);
    const xpFromComplications = compCount * 2;
    
    const totalXpRaw = safeParseInt(document.getElementById('ce-total-xp')?.value, 32);
    const totalXp = editorState.isNew
        ? Math.min(32 + xpFromBonds + xpFromComplications, 36)
        : totalXpRaw;
    
    const budgetEl = document.getElementById('ce-xp-budget');
    if (budgetEl) {
        const remaining = totalXp - spent;
        const isOver = remaining < 0;
        budgetEl.innerHTML = `
            <div style="padding:0.5rem 0.8rem;border-radius:var(--radius);background:${isOver ? 'rgba(255,50,50,0.15)' : 'rgba(50,255,50,0.1)'};border:1px solid ${isOver ? 'var(--red)' : 'var(--green)'};">
                <strong>XP Budget:</strong> ${totalXp} total - ${spent} spent = 
                <span style="color:${isOver ? 'var(--red)' : 'var(--green)'};font-weight:bold;">
                    ${remaining > 0 ? remaining + ' remaining' : remaining === 0 ? 'exactly spent' : Math.abs(remaining) + ' over budget!'}
                </span>
                ${editorState.isNew ? `<br><small>Base 32 XP + Bonds: +${xpFromBonds} XP + Complications: +${xpFromComplications} XP (max starting: 36 XP) — already included above</small>` : ''}
            </div>
        `;
    }
    console.log('[Editor] XP budget recalculated: total=', totalXp, 'spent=', spent);
}

// ============================================================
// BUILD EDITOR HTML
// ============================================================

function buildEditorHTML(c) {
    console.log('[Editor] buildEditorHTML called for character:', c.id, c.name);
    const heritageOptions = HERITAGES.map(h => 
        `<option value="${h.id}" ${c.heritage === h.id ? 'selected' : ''}>${escHtml(h.label)}</option>`
    ).join('');
    
    const patronOptions = buildPatronOptionsHTML(c.patron || '');
    const boundPatronOptions = buildPatronOptionsHTML(c.boundPatron || '');
    
    const armorOptions = ARMOR_TYPES.map(a => 
        `<option value="${a.id}" ${c.armorType === a.id ? 'selected' : ''}>${escHtml(a.label)}${a.xpCost > 0 ? ` (${a.xpCost} XP)` : ''}</option>`
    ).join('');
    
    const shieldOptions = SHIELD_TYPES.map(s => 
        `<option value="${s.id}" ${c.shieldType === s.id ? 'selected' : ''}>${escHtml(s.label)}${s.xpCost > 0 ? ` (${s.xpCost} XP)` : ''}</option>`
    ).join('');
    
    const weaponOptions = WEAPON_CLASSES.map(w => 
        `<option value="${w.id}" ${c.weaponClass === w.id ? 'selected' : ''}>${escHtml(w.label)}</option>`
    ).join('');
    
    const weaponTagCheckboxes = WEAPON_TAGS.map(tag => 
        `<label class="inline-check" style="font-size:0.8rem;">
            <input type="checkbox" class="ce-weapon-tag" value="${tag}" ${c.weaponTags?.includes(tag) ? 'checked' : ''} />
            ${tag}
        </label>`
    ).join('');
    
    const regionOptions = ['<option value="">Select region…</option>'].concat(
        REGIONS.map(r => `<option value="${r}" ${c.region === r ? 'selected' : ''}>${escHtml(r)}</option>`)
    ).join('');
    
    const magicPathOptions = MAGIC_PATHS.map(p => 
        `<option value="${p.id}" ${c.magicPath === p.id ? 'selected' : ''}>${escHtml(p.label)}</option>`
    ).join('');
    
    const { tier, name: tierName } = getTierFromXp(c.totalXp || 32);
    
    const skillInputs = ALL_SKILLS.map(s => {
        const key = s.toLowerCase();
        const val = c.skills?.[key] ?? 0;
        return `
            <div class="skill-item">
                <label title="${escHtml(s)}">${escHtml(s)}</label>
                <input type="number" id="ce-sk-${key}" value="${val}" min="0" max="5" data-skill="${key}" />
            </div>
        `;
    }).join('');
    
    const talentRows = (c.talents || []).map((t, i) => dynamicRowHTML('talent', i, t)).join('');
    const assetRows = (c.assets || []).map((a, i) => dynamicRowHTML('asset', i, a)).join('');
    const equipRows = (c.equipment || []).map((e, i) => dynamicRowHTML('equipment', i, e)).join('');
    const bondRows = (c.bonds || []).map((b, i) => dynamicRowHTML('bond', i, b)).join('');
    const compRows = (c.complications || []).map((x, i) => dynamicRowHTML('complication', i, x)).join('');
    const symbolRows = (c.symbols || []).map((s, i) => {
        const state = c.symbolStates?.[s] || 'active';
        return dynamicRowHTML('symbol', i, { patron: s, state });
    }).join('');
    const riteRows = (c.rites || []).map((r, i) => dynamicRowHTML('rite', i, { name: r })).join('');
    const repertoireRows = (c.repertoire || []).map((r, i) => dynamicRowHTML('repertoire', i, { name: r })).join('');
    const hedgeGiftRows = (c.hedgeGifts || []).map((g, i) => dynamicRowHTML('hedge-gift', i, { name: g })).join('');
    const promiseTimerRows = (c.promiseTimers || []).map((p, i) => dynamicRowHTML('promise-timer', i, p)).join('');
    const psionicArtRows = (c.psionicArts || []).map((a, i) => dynamicRowHTML('psionic-art', i, { name: a })).join('');
    const boundSpiritRows = (c.boundSpirits || []).map((sp, i) => dynamicRowHTML('bound-spirit', i, sp)).join('');
    const knownTagRows = (c.knownTags || []).map((t, i) => dynamicRowHTML('known-tag', i, { name: t })).join('');
    
    const thiasos = c.thiasos || '';
    const codex = c.codex || '';
    const boundPatron = c.boundPatron || '';
    const boundPatronBonus = c.boundPatronBonus ?? 1;
    const bloomCount = c.bloomCount || 0;
    const resonantRites = (c.resonantRites || []).join(', ');
    
    const isRunekeeper = c.magicPath === 'runekeeper';
    const isInvoker = c.magicPath === 'invoker';
    const isCantor = c.magicPath === 'cantor';
    const isWitch = c.magicPath === 'witch';
    const isPsion = c.magicPath === 'psion';
    const isSummoner = c.magicPath === 'summoner';
    const isMonk = c.magicPath === 'monk';
    const isFreeCaster = c.magicPath === 'free-caster';
    
    return `
        <div class="editor-form">
            <div id="ce-xp-budget" style="margin-bottom:1rem;"></div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 1 — Identity & Concept</h3>
            <div class="form-row">
                <div class="field"><label>Name *</label><input id="ce-name" value="${escHtml(c.name)}" /></div>
                <div class="field">
                    <label>Heritage</label>
                    <select id="ce-heritage">${heritageOptions}</select>
                    <div id="ce-heritage-note" style="font-size:0.75rem;color:var(--text2);margin-top:0.2rem;display:none;">${escHtml(HERITAGES.find(h => h.id === c.heritage)?.note || '')}</div>
                </div>
            </div>
            <div class="form-row">
                <div class="field">
                    <label>Region of Origin</label>
                    <select id="ce-region">${regionOptions}</select>
                </div>
                <div class="field">
                    <label>Cultural Affinity</label>
                    <input id="ce-cultural-affinity" value="${escHtml(c.culturalAffinity || '')}" placeholder="Once-per-session cultural benefit" />
                </div>
            </div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 2 — Background</h3>
            <div class="form-row">
                <div class="field"><label>Background Name</label><input id="ce-background" value="${escHtml(c.background || '')}" placeholder="e.g., Marcher Veteran, Merchant Factor" /></div>
            </div>
            <div class="form-row">
                <div class="field"><label>Background Tags (Access)</label><input id="ce-background-tags" value="${escHtml(Array.isArray(c.backgroundTags) ? c.backgroundTags.join(', ') : (c.backgroundTags || ''))}" placeholder="e.g., Veteran-of-the-Marches, Muster Papers" /></div>
            </div>
            <div class="form-row">
                <div class="field"><label>Signature Contact</label><input id="ce-background-contact" value="${escHtml(c.backgroundContact || '')}" placeholder="Named NPC (Cap 1 follower, +1d assist once/scene)" /></div>
            </div>
            <div class="form-row">
                <div class="field"><label>Background Boon</label><input id="ce-background-boon" value="${escHtml(c.backgroundBoon || '')}" placeholder="Once/session: +1d or DV-1 for background-related task" /></div>
            </div>
            <div class="form-row">
                <div class="field"><label>Obligation Timer [4] Seed</label><input id="ce-background-obligation" value="${escHtml(c.backgroundObligation || '')}" placeholder="Starting complication: what debt or duty follows you?" /></div>
            </div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 3 — Attributes (1–5)</h3>
            <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.4rem;">
                Cost: each step = new rating × 3 XP. Base 1 each.
                (1→2=6, 2→3=9, 3→4=12, 4→5=15)
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">
                <div class="stat-item"><label>Body</label><input type="number" id="ce-body" value="${c.body || 1}" min="1" max="5" /></div>
                <div class="stat-item"><label>Wits</label><input type="number" id="ce-wits" value="${c.wits || 1}" min="1" max="5" /></div>
                <div class="stat-item"><label>Spirit</label><input type="number" id="ce-spirit" value="${c.spirit || 1}" min="1" max="5" /></div>
                <div class="stat-item"><label>Presence</label><input type="number" id="ce-presence" value="${c.presence || 1}" min="1" max="5" /></div>
            </div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 4 — Skills (0–5)</h3>
            <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.4rem;">
                Cost: each step = new level × 2 XP. Skill cannot exceed relevant Attribute.
                (0→1=2, 1→2=4, 2→3=6, 3→4=8, 4→5=10)
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.3rem;font-size:0.85rem;">${skillInputs}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 5 — Magic Path & Patron (Optional)</h3>
            <div class="form-row">
                <div class="field">
                    <label>Magic Path</label>
                    <select id="ce-magic-path">${magicPathOptions}</select>
                    <div id="ce-magic-path-info" style="font-size:0.75rem;color:var(--text2);margin-top:0.2rem;"></div>
                </div>
                <div class="field">
                    <label>Patron</label>
                    <select id="ce-patron">${patronOptions}</select>
                    <div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">Patrons loaded from /data/patrons/</div>
                </div>
            </div>
            
            <div id="ce-invoker-section" style="display:${isInvoker ? 'block' : 'none'}; margin-top:0.5rem;">
                <h4 style="margin:0.4rem 0;font-size:0.9rem;">Invoker: Symbols</h4>
                <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.3rem;">Each Symbol costs 4 XP. Max 4 without penalty.</div>
                <button class="btn btn-sm" data-editor-add="symbol">+ Add Symbol</button>
                <div class="dynamic-list" id="ce-symbol-list">${symbolRows}</div>
            </div>
            
            <div id="ce-runekeeper-section" style="display:${isRunekeeper ? 'block' : 'none'}; margin-top:0.5rem;">
                <h4 style="margin:0.4rem 0;font-size:0.9rem;">Runekeeper: Thiasos, Codex & Rites</h4>
                <div class="form-row">
                    <div class="field">
                        <label>Thiasos (Familiar)</label>
                        <input id="ce-thiasos" value="${escHtml(thiasos)}" placeholder="e.g., white-hound, garden-spider" />
                        <span style="font-size:0.65rem;color:var(--text3);">The patron's attention given form.</span>
                    </div>
                    <div class="field">
                        <label>Codex</label>
                        <input id="ce-codex" value="${escHtml(codex)}" placeholder="e.g., iron-bound-ledger, frame-loom" />
                        <span style="font-size:0.65rem;color:var(--text3);">The covenant made visible.</span>
                    </div>
                </div>
                <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.3rem;">Rites known (names or IDs, one per line).</div>
                <button class="btn btn-sm" data-editor-add="rite">+ Add Rite</button>
                <div class="dynamic-list" id="ce-rite-list">${riteRows}</div>
                ${thiasos || codex ? `<div style="font-size:0.65rem;color:var(--gold);margin-top:0.2rem;">💡 Patron will be auto-set from Thiasos/Codex if not selected.</div>` : ''}
            </div>
            
            <!-- ─── Cantor Section ─────────────────────────────────────────── -->
            <div id="ce-cantor-section" style="display:${isCantor ? 'block' : 'none'}; margin-top:0.5rem;">
                <h4 style="margin:0.4rem 0;font-size:0.9rem;">Cantor: Voice & Corruption</h4>
                <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.3rem;">Songs / Rites known (names or IDs).</div>
                <button class="btn btn-sm" data-editor-add="repertoire">+ Add Song</button>
                <div class="dynamic-list" id="ce-repertoire-list">${repertoireRows}</div>
                
                <!-- ─── NEW: Bound Patron fields ────────────────────────── -->
                <div style="margin-top:0.5rem;border-top:1px solid var(--border);padding-top:0.4rem;">
                    <h5 style="margin:0 0 0.2rem;font-size:0.85rem;">🎯 Bound Patron (talent)</h5>
                    <div class="form-row">
                        <div class="field">
                            <label>Bound Patron</label>
                            <select id="ce-bound-patron">${boundPatronOptions}</select>
                            <span style="font-size:0.65rem;color:var(--text3);">Set when Bound Patron talent is learned</span>
                        </div>
                        <div class="field small">
                            <label>Position Bonus</label>
                            <input type="number" id="ce-bound-patron-bonus" value="${boundPatronBonus}" min="0" max="3" />
                            <span style="font-size:0.65rem;color:var(--text3);">+1 die when singing bound patron's rites</span>
                        </div>
                    </div>
                </div>
                
                <!-- ─── Bloom tracking ────────────────────────────────────── -->
                <div class="form-row" style="margin-top:0.3rem;">
                    <div class="field small">
                        <label>Bloom Count (Fugal Self at 7+)</label>
                        <input type="number" id="ce-bloom-count" value="${bloomCount}" min="0" />
                    </div>
                    <div class="field small">
                        <label>Resonant Rites (comma-separated)</label>
                        <input id="ce-resonant-rites" value="${escHtml(resonantRites)}" placeholder="e.g., Cradle Song, Golden Tongue" />
                    </div>
                </div>
                <div class="form-row" style="margin-top:0.3rem;">
                    <div class="field small">
                        <label>Corruption Tier (number of blooms)</label>
                        <input type="number" id="ce-corruption-tier" value="${c.corruptionTier || 0}" min="0" />
                    </div>
                </div>
            </div>
            
            <div id="ce-witch-section" style="display:${isWitch ? 'block' : 'none'}; margin-top:0.5rem;">
                <h4 style="margin:0.4rem 0;font-size:0.9rem;">Witch: Prices & Gifts</h4>
                <div class="form-row" style="flex-wrap:wrap;gap:0.3rem;">
                    <div class="field small"><label>Shadow</label><input type="number" id="ce-shadow" value="${c.shadow || 0}" min="0" /></div>
                    <div class="field small"><label>Shame</label><input type="number" id="ce-shame" value="${c.shame || 0}" min="0" /></div>
                    <div class="field small"><label>Identity Strain</label><input type="number" id="ce-identity-strain" value="${c.identityStrain || 0}" min="0" /></div>
                </div>
                <div style="font-size:0.8rem;color:var(--text2);margin-top:0.3rem;">Hedge Gifts (one per line)</div>
                <button class="btn btn-sm" data-editor-add="hedge-gift">+ Add Hedge Gift</button>
                <div class="dynamic-list" id="ce-hedge-gift-list">${hedgeGiftRows}</div>
                <div style="font-size:0.8rem;color:var(--text2);margin-top:0.3rem;">Promise Timers (name and segments)</div>
                <button class="btn btn-sm" data-editor-add="promise-timer">+ Add Promise Timer</button>
                <div class="dynamic-list" id="ce-promise-timer-list">${promiseTimerRows}</div>
            </div>
            
            <div id="ce-psion-section" style="display:${isPsion ? 'block' : 'none'}; margin-top:0.5rem;">
                <h4 style="margin:0.4rem 0;font-size:0.9rem;">Psion: Psionic Arts</h4>
                <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.3rem;">List of Arts (e.g., Telekinesis, Telepathy).</div>
                <button class="btn btn-sm" data-editor-add="psionic-art">+ Add Art</button>
                <div class="dynamic-list" id="ce-psionic-art-list">${psionicArtRows}</div>
            </div>
            
            <div id="ce-summoner-section" style="display:${isSummoner ? 'block' : 'none'}; margin-top:0.5rem;">
                <h4 style="margin:0.4rem 0;font-size:0.9rem;">Summoner: Bound Spirits</h4>
                <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.3rem;">Each spirit: name, cap, nature, services.</div>
                <button class="btn btn-sm" data-editor-add="bound-spirit">+ Add Spirit</button>
                <div class="dynamic-list" id="ce-bound-spirit-list">${boundSpiritRows}</div>
            </div>
            
            <div id="ce-monk-section" style="display:${isMonk ? 'block' : 'none'}; margin-top:0.5rem;">
                <h4 style="margin:0.4rem 0;font-size:0.9rem;">Monk: Monastic Path</h4>
                <div class="form-row">
                    <div class="field"><label>Monastic Tradition</label><input id="ce-monastic-tradition" value="${escHtml(c.monasticTradition || '')}" placeholder="e.g., Order of the Unstruck Bell" /></div>
                    <div class="field small">
                        <label>Breath State</label>
                        <select id="ce-breath-state">
                            <option value="entering" ${c.breathState === 'entering' ? 'selected' : ''}>Entering</option>
                            <option value="still" ${c.breathState === 'still' ? 'selected' : ''}>Still</option>
                            <option value="exiting" ${c.breathState === 'exiting' ? 'selected' : ''}>Exiting</option>
                        </select>
                    </div>
                    <div class="field small">
                        <label>Corruption Tier</label>
                        <input type="number" id="ce-monk-corruption-tier" value="${c.monkCorruptionTier || 0}" min="0" />
                    </div>
                </div>
            </div>
            
            <div id="ce-free-caster-section" style="display:${isFreeCaster ? 'block' : 'none'}; margin-top:0.5rem;">
                <h4 style="margin:0.4rem 0;font-size:0.9rem;">Free Caster: Known Tags</h4>
                <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.3rem;">Tags known (e.g., Burning, Force, Heal).</div>
                <button class="btn btn-sm" data-editor-add="known-tag">+ Add Tag</button>
                <div class="dynamic-list" id="ce-known-tag-list">${knownTagRows}</div>
            </div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 6 — Combat Loadout</h3>
            <div class="form-row">
                <div class="field">
                    <label>Armor Type</label>
                    <select id="ce-armor-type">${armorOptions}</select>
                    <div id="ce-armor-conversion" style="font-size:0.75rem;color:var(--text2);margin-top:0.2rem;">${escHtml(ARMOR_TYPES.find(a => a.id === c.armorType)?.conversion || '')}</div>
                </div>
                <div class="field">
                    <label>Shield</label>
                    <select id="ce-shield-type">${shieldOptions}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="field">
                    <label>Weapon Class</label>
                    <select id="ce-weapon-class">${weaponOptions}</select>
                    <div id="ce-weapon-mods" style="font-size:0.75rem;color:var(--text2);margin-top:0.2rem;">${escHtml(WEAPON_CLASSES.find(w => w.id === c.weaponClass)?.notes || '')}</div>
                </div>
            </div>
            <div class="form-row" style="flex-wrap:wrap;gap:0.3rem;">
                <label style="font-size:0.85rem;margin-right:0.5rem;">Weapon Tags (Optional, +4 XP each, max 2):</label>
                ${weaponTagCheckboxes}
            </div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 7 — Talents</h3>
            <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.4rem;">
                Minor: 2–3 XP | Major: 4–6 XP | Prestige: 7–10 XP | Epic: 11+ XP
            </div>
            
            <div id="ce-talent-catalog" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg2);margin-bottom:0.5rem;"></div>
            
            <div style="margin-bottom:0.3rem;">
                <button class="btn btn-sm btn-primary" id="ce-add-custom-talent">✏️ Add Custom Talent</button>
            </div>
            
            <div class="dynamic-list" id="ce-talent-list">${talentRows}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 8 — Assets</h3>
            <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.4rem;">
                Minor: 4 XP | Standard: 8 XP | Major: 12 XP
            </div>
            ${wikiPickerHTML('asset', 'assets')}
            <div class="dynamic-list" id="ce-asset-list">${assetRows}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 9 — Additional Equipment</h3>
            ${wikiPickerHTML('equipment', 'equipment')}
            <div class="dynamic-list" id="ce-equipment-list">${equipRows}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 10 — Bonds & Complications</h3>
            <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.4rem;">
                Up to 2 Bonds (+2 XP each) and 2 Complications (+2 XP each). Max starting XP: 36.
                Each unresolved Complication adds +1 banked SB to early scenes.
            </div>
            
            <h4 style="margin:0.4rem 0;font-size:0.9rem;">Bonds (max 2 for +XP)</h4>
            <button class="btn btn-sm" data-editor-add="bond">+ Add Bond</button>
            <div class="dynamic-list" id="ce-bond-list">${bondRows}</div>
            
            <h4 style="margin:0.4rem 0;font-size:0.9rem;">Complications (max 2 for +XP)</h4>
            <button class="btn btn-sm" data-editor-add="complication">+ Add Complication</button>
            <div class="dynamic-list" id="ce-complication-list">${compRows}</div>
            
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 11 — Status & Resources</h3>
            <div class="form-row">
                <div class="field small"><label>Total XP</label><input type="number" id="ce-total-xp" value="${c.totalXp || 32}" min="0" /></div>
                <div class="field small">
                    <label>Tier</label>
                    <div id="ce-tier-display" style="padding:0.3rem 0;font-weight:bold;color:var(--gold);">Tier ${tier}: ${tierName}</div>
                </div>
                <div class="field small">
                    <label class="inline-check"><input type="checkbox" id="ce-vtt" ${c.vtt ? 'checked' : ''} /> Push to VTT</label>
                </div>
            </div>
            
            <h4 style="margin:0.4rem 0;font-size:0.85rem;">Damage Tracks</h4>
            <div class="form-row">
                <div class="field small">
                    <label>Harm (0–3)</label>
                    <input type="number" id="ce-harm" value="${c.harm || 0}" min="0" max="3" />
                    <small style="color:var(--text2);">0=OK, 1=–1d, 2=–2d, 3=incapacitated</small>
                </div>
                <div class="field small">
                    <label>Fatigue (max <span id="ce-fatigue-max">${c.body || 1}</span>)</label>
                    <input type="number" id="ce-fatigue" value="${c.fatigue || 0}" min="0" max="${c.body || 1}" />
                    <small style="color:var(--text2);">Each worsens Position; full → Harm+1, clear</small>
                </div>
                <div class="field small">
                    <label>Boons (max 5)</label>
                    <input type="number" id="ce-boons" value="${c.boons || 0}" min="0" max="5" />
                    <small style="color:var(--text2);">Spend: re-roll, Position, Asset, 2→1 XP</small>
                </div>
            </div>
            
            <h4 style="margin:0.4rem 0;font-size:0.85rem;">Obligation & Corruption</h4>
            <div class="form-row">
                <div class="field small">
                    <label>Obligation (cap: <span id="ce-obligation-capacity">${(c.spirit || 1) + (c.presence || 1)}</span>)</label>
                    <input type="number" id="ce-obligation" value="${c.obligation || 0}" min="0" />
                    <small style="color:var(--text2);">Over cap: 1 Fatigue/segment. Double: Patron intrusion</small>
                </div>
                <div class="field small" id="ce-corruption-section" style="display:${isCantor ? 'flex' : 'none'};">
                    <label>Corruption (max <span id="ce-corruption-max">${c.spirit || 1}</span>)</label>
                    <input type="number" id="ce-corruption" value="${c.corruption || 0}" min="0" max="${c.spirit || 1}" />
                    <small style="color:var(--text2);">Fill: bloom (benefit + drawback), reset to Tier</small>
                </div>
                <div class="field small" id="ce-leash-section" style="display:${isSummoner ? 'flex' : 'none'};">
                    <label>Leash (cap: Cap + Spirit)</label>
                    <input type="number" id="ce-leash" value="${c.leash || 0}" min="0" />
                    <small style="color:var(--text2);">Fill: spirit acts & departs</small>
                </div>
            </div>
            
            <div class="form-row">
                <div class="field small">
                    <label>Mental Strain (max <span id="ce-mental-strain-max">${c.spirit || 1}</span>)</label>
                    <input type="number" id="ce-mental-strain" value="${c.mentalStrain || 0}" min="0" max="${c.spirit || 1}" />
                    <small style="color:var(--text2);">For Psionics (optional). Overflow → Fatigue/Harm</small>
                </div>
            </div>
            
            <div class="flex mt-1" style="gap:0.5rem;">
                <button class="btn btn-gold" id="ce-save-btn">💾 Save Character</button>
                <button class="btn" id="ce-cancel-btn">Cancel</button>
            </div>
        </div>
    `;
}

// ============================================================
// ROW HTML BUILDERS
// ============================================================

function dynamicRowHTML(type, idx, item = {}) {
    if (type === 'bond') {
        return `
            <div class="dynamic-row ce-bond-row" data-index="${idx}">
                <input type="text" class="ce-bond-name" placeholder="Bond name (with PC or NPC)" value="${escHtml(item.name || '')}" style="flex:1;" />
                <input type="text" class="ce-bond-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;" />
                <label class="inline-check" title="Check for +2 XP at character creation (max 2)">
                    <input type="checkbox" class="ce-bond-start" ${item.start !== false ? 'checked' : ''} /> 
                    +2 XP
                </label>
                <button class="btn btn-xs editor-remove-btn">✕</button>
            </div>
        `;
    }
    
    if (type === 'complication') {
        return `
            <div class="dynamic-row ce-complication-row" data-index="${idx}">
                <input type="text" class="ce-complication-name" placeholder="Complication name" value="${escHtml(item.name || '')}" style="flex:1;" />
                <input type="text" class="ce-complication-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;" />
                <label class="inline-check" title="Check for +2 XP at character creation (max 2). Adds +1 banked SB to early scenes.">
                    <input type="checkbox" class="ce-complication-start" ${item.start !== false ? 'checked' : ''} /> 
                    +2 XP
                </label>
                <button class="btn btn-xs editor-remove-btn">✕</button>
            </div>
        `;
    }
    
    if (type === 'symbol') {
        const patronOptions = buildPatronOptionsHTML(item.patron || '');
        return `
            <div class="dynamic-row ce-symbol-row" data-index="${idx}">
                <select class="ce-symbol-patron" style="flex:2;">${patronOptions}</select>
                <select class="ce-symbol-state" style="width:100px;">
                    <option value="active" ${item.state === 'active' ? 'selected' : ''}>Active</option>
                    <option value="compromised" ${item.state === 'compromised' ? 'selected' : ''}>Compromised</option>
                </select>
                <button class="btn btn-xs editor-remove-btn">✕</button>
            </div>
        `;
    }
    
    if (['rite', 'repertoire', 'hedge-gift', 'psionic-art', 'known-tag'].includes(type)) {
        const label = type === 'rite' ? 'Rite' :
                     type === 'repertoire' ? 'Song/ Rite' :
                     type === 'hedge-gift' ? 'Gift' :
                     type === 'psionic-art' ? 'Art' : 'Tag';
        return `
            <div class="dynamic-row ce-${type}-row" data-index="${idx}">
                <input type="text" class="ce-${type}-name" placeholder="${label} name" value="${escHtml(item.name || '')}" style="flex:1;" />
                <button class="btn btn-xs editor-remove-btn">✕</button>
            </div>
        `;
    }
    
    if (type === 'promise-timer') {
        return `
            <div class="dynamic-row ce-promise-timer-row" data-index="${idx}">
                <input type="text" class="ce-promise-timer-name" placeholder="Timer name" value="${escHtml(item.name || '')}" style="flex:1;" />
                <input type="number" class="ce-promise-timer-segments" placeholder="Segments" value="${item.segments || 4}" min="1" style="width:70px;" />
                <button class="btn btn-xs editor-remove-btn">✕</button>
            </div>
        `;
    }
    
    if (type === 'bound-spirit') {
        return `
            <div class="dynamic-row ce-bound-spirit-row" data-index="${idx}">
                <input type="text" class="ce-bound-spirit-name" placeholder="Spirit name" value="${escHtml(item.name || '')}" style="flex:1;" />
                <input type="number" class="ce-bound-spirit-cap" placeholder="Cap" value="${item.cap || 1}" min="1" style="width:60px;" />
                <input type="text" class="ce-bound-spirit-nature" placeholder="Nature" value="${escHtml(item.nature || '')}" style="flex:1;" />
                <input type="text" class="ce-bound-spirit-services" placeholder="Services" value="${escHtml(item.services || '')}" style="flex:1;" />
                <button class="btn btn-xs editor-remove-btn">✕</button>
            </div>
        `;
    }
    
    const placeholder = type === 'talent' ? 'Talent name' : type === 'asset' ? 'Asset name' : 'Equipment name';
    return `
        <div class="dynamic-row ce-${type}-row" data-index="${idx}">
            <input type="text" class="ce-${type}-name" placeholder="${placeholder}" value="${escHtml(item.name || '')}" style="flex:2;" />
            <input type="number" class="ce-${type}-cost" placeholder="XP" value="${item.cost || 0}" min="0" style="width:70px;" title="XP cost" />
            ${type === 'asset' ? `<select class="ce-asset-tier" style="width:100px;">
                <option value="minor" ${(!item.tier || item.tier === 'minor') ? 'selected' : ''}>Minor</option>
                <option value="standard" ${item.tier === 'standard' ? 'selected' : ''}>Standard</option>
                <option value="major" ${item.tier === 'major' ? 'selected' : ''}>Major</option>
            </select>` : ''}
            <button class="btn btn-xs editor-remove-btn">✕</button>
        </div>
    `;
}

// ============================================================
// WIKI PICKER
// ============================================================

function wikiPickerHTML(type, cat) {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    const options = wikiEntries
        .filter(e => e.category === cat)
        .map(e => `
            <option value="${escHtml(String(e.id))}">
                ${escHtml(e.title)}${e.cost != null ? ' (' + e.cost + ' XP)' : ''}
            </option>
        `)
        .join('');
    
    return `
        <div class="form-row" style="margin:0.3rem 0;">
            <div class="field" style="flex:2;">
                <select id="ce-${type}-wiki">
                    <option value="">Select from wiki…</option>
                    ${options}
                </select>
            </div>
            <button class="btn btn-sm" data-editor-wiki-add="${type}">Add from Wiki</button>
            <button class="btn btn-sm" data-editor-add="${type}">+ Custom</button>
        </div>
    `;
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