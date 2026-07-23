import { getState, addCharacter, getCharacter, updateCharacter } from '../../core/state.js';
import { generateId, escHtml, safeParseInt, clamp } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';

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

const PATRONS = [
    { id: '', label: 'None' },
    { id: 'traveler', label: 'The Traveler — Ways & Journeys' },
    { id: 'oath-flame', label: 'Oath of Flame & Light — Dawn & Vows' },
    { id: 'inaea', label: 'Inaea (Angel of the Spider) — Webs & Patient Predation' },
    { id: 'witness', label: 'The Witness — Truth & Revelation' },
    { id: 'carrion-king', label: 'The Carrion King — Lord of Decay and Renewal' },
    { id: 'ikasha', label: 'Ikasha (She Who Sleeps) — Latent Potential & Shadow' },
    { id: 'grimmir', label: 'Grimmir, the Old Man of the Forest — Primal Mystery & Seasonal Sacrifice' },
    { id: 'palinode', label: 'Palinode, Queen of Encores — Performance & Rapture' }
];

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
    { id: 'summoner', label: 'Summoner (Pact-Whisperer 2 XP + Lesser Pactwright 2 XP)', talents: ['Pact-Whisperer', 'Lesser Pactwright'] },
    { id: 'witch', label: 'Witchcraft (Craft of the Hedge, 4 XP)', talents: ['Craft of the Hedge'] },
    { id: 'familiar-only', label: 'Familiar Only (Familiar, 2 XP)', talents: ['Familiar'] },
    { id: 'hedge-gifts', label: 'Hedge Gifts Only (Craft of the Hedge, 4 XP)', talents: ['Craft of the Hedge'] }
];

function defaultSkills() {
    const skills = {};
    ALL_SKILLS.forEach(s => skills[s.toLowerCase()] = 0);
    return skills;
}

// ============================================================
// STATE
// ============================================================

const editorState = {
    currentId: null,
    isNew: false,
    isOpen: false,
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
    if (editorState.initialized) return;
    
    // Global click delegation for dynamic buttons and catalog adds
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.matches('[data-editor-add]')) {
            const type = target.dataset.editorAdd;
            addCEDynamic(type);
            e.preventDefault();
        }
        
        if (target.matches('.editor-remove-btn')) {
            const row = target.closest('.dynamic-row');
            if (row) row.remove();
            recalculateXpBudget();
            e.preventDefault();
        }
        
        if (target.matches('[data-editor-wiki-add]')) {
            const type = target.dataset.editorWikiAdd;
            const select = document.getElementById(`ce-${type}-wiki`);
            if (select && select.value) {
                addCEDynamicFromWiki(type, select.value);
                select.value = '';
            }
            e.preventDefault();
        }

        // Catalog talent add button
        if (target.matches('.ce-catalog-add-btn')) {
            const name = target.dataset.name;
            const cost = parseInt(target.dataset.cost, 10);
            addTalentFromCatalog(name, cost);
            e.preventDefault();
        }

        // Custom talent add button
        if (target.matches('#ce-add-custom-talent')) {
            addCEDynamic('talent');   // adds editable row
            e.preventDefault();
        }
    });
    
    editorState.initialized = true;
}

// ============================================================
// PUBLIC API
// ============================================================

export function openEditor(id) {
    closeEditor();
    initEditor();
    
    const modal = createModal();
    document.body.appendChild(modal);
    
    const title = document.getElementById('char-modal-title');
    const content = document.getElementById('char-editor-content');
    
    if (!modal || !title || !content) {
        showToast('Editor modal not found. Please refresh.', 'error');
        return;
    }
    
    let c;
    if (id) {
        c = getCharacter(id);
        if (!c) {
            showToast('Character not found', 'error');
            return;
        }
        editorState.currentId = id;
        editorState.isNew = false;
        title.textContent = 'Edit Character';
    } else {
        c = createNewCharacter();
        editorState.currentId = c.id;
        editorState.isNew = true;
        title.textContent = 'New Character';
    }
    
    editorState.isOpen = true;
    editorState.modalElement = modal;
    content.innerHTML = buildEditorHTML(c);
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    
    attachEditorEvents();
    recalculateXpBudget();
    renderTalentCatalog();   // ← populate catalog
}

export function closeEditor() {
    const modal = document.getElementById('charModal');
    if (modal) {
        if (editorState.overlayListener) {
            modal.removeEventListener('click', editorState.overlayListener);
            editorState.overlayListener = null;
        }
        modal.remove();
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
    editorState.modalElement = null;
}

// ============================================================
// MODAL CREATION
// ============================================================

function createModal() {
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
    
    return modal;
}

// ============================================================
// HELPERS
// ============================================================

function createNewCharacter() {
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
        leash: 0,
        leashCapacity: 0,
        mentalStrain: 0,
        mentalStrainMax: 0,
        vtt: false,
        armorType: 'none',
        shieldType: 'none',
        weaponClass: 'light',
        weaponTags: [],
        armorConversion: '',
        meleeMods: '',
        rangedMods: ''
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
// TALENT CATALOG (TIER-GATED)
// ============================================================

function getAvailableTalentsForTier(totalXp) {
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

    return allTalents.filter(t => {
        const cost = safeParseInt(t.cost, 0);
        for (const tierObj of TALENT_TIERS) {
            if (cost >= tierObj.min && cost <= tierObj.max && allowedTiers.includes(tierObj.id))
                return true;
        }
        return false;
    });
}

function renderTalentCatalog() {
    const catalogEl = document.getElementById('ce-talent-catalog');
    if (!catalogEl) return;
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
}

function addTalentFromCatalog(name, cost) {
    const listEl = document.getElementById('ce-talent-list');
    if (!listEl) return;

    // Create read-only row
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
}

// ============================================================
// EVENT ATTACHMENT
// ============================================================

function attachEditorEvents() {
    const saveBtn = document.getElementById('ce-save-btn');
    if (saveBtn) {
        if (editorState.saveListener) {
            saveBtn.removeEventListener('click', editorState.saveListener);
        }
        editorState.saveListener = saveEditor;
        saveBtn.addEventListener('click', editorState.saveListener);
    }
    
    const closeBtns = ['ce-cancel-btn', 'charModalClose'];
    for (const id of closeBtns) {
        const btn = document.getElementById(id);
        if (btn) {
            const handler = closeEditor;
            btn.addEventListener('click', handler);
            editorState.cancelListeners.push({ btn, handler });
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
    }
    
    if (editorState.escListener) {
        document.removeEventListener('keydown', editorState.escListener);
    }
    editorState.escListener = (e) => {
        if (!editorState.isOpen) return;
        if (e.key === 'Escape') closeEditor();
    };
    document.addEventListener('keydown', editorState.escListener);
    
    // Attribute change listeners for derived stats
    ['body', 'wits', 'spirit', 'presence'].forEach(attr => {
        const input = document.getElementById(`ce-${attr}`);
        if (input) {
            input.addEventListener('change', updateDerivedStats);
            input.addEventListener('input', updateDerivedStats);
        }
    });
    
    const heritageSelect = document.getElementById('ce-heritage');
    if (heritageSelect) {
        heritageSelect.addEventListener('change', updateHeritageNote);
    }
    
    const xpInput = document.getElementById('ce-total-xp');
    if (xpInput) {
        xpInput.addEventListener('input', () => {
            updateTierDisplay();
            renderTalentCatalog();   // re-render when XP changes
        });
        xpInput.addEventListener('change', () => {
            updateTierDisplay();
            renderTalentCatalog();
        });
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
    
    const corruptSection = document.getElementById('ce-corruption-section');
    if (corruptSection) {
        corruptSection.style.display = pathId === 'cantor' ? 'flex' : 'none';
    }
    
    const leashSection = document.getElementById('ce-leash-section');
    if (leashSection) {
        leashSection.style.display = pathId === 'summoner' ? 'flex' : 'none';
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
// XP BUDGET CALCULATION (handles both input and span costs)
// ============================================================

function recalculateXpBudget() {
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
    
    // Talent costs (handle both read‑only spans and input fields)
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
    
    // Asset costs
    document.querySelectorAll('.ce-asset-row').forEach(row => {
        const costInput = row.querySelector('.ce-asset-cost');
        spent += safeParseInt(costInput?.value, 0);
    });
    
    // Equipment costs
    document.querySelectorAll('.ce-equipment-row').forEach(row => {
        const costInput = row.querySelector('.ce-equipment-cost');
        spent += safeParseInt(costInput?.value, 0);
    });
    
    // Armor cost
    const armorId = document.getElementById('ce-armor-type')?.value;
    const armor = ARMOR_TYPES.find(a => a.id === armorId);
    if (armor) spent += armor.xpCost;
    
    // Shield cost
    const shieldId = document.getElementById('ce-shield-type')?.value;
    const shield = SHIELD_TYPES.find(s => s.id === shieldId);
    if (shield) spent += shield.xpCost;
    
    // Weapon cost
    const weaponId = document.getElementById('ce-weapon-class')?.value;
    const weapon = WEAPON_CLASSES.find(w => w.id === weaponId);
    if (weapon) {
        const weaponXp = { light: 4, medium: 8, heavy: 12 };
        spent += weaponXp[weaponId] || 0;
    }
    
    // Bond XP
    let bondCount = 0;
    document.querySelectorAll('.ce-bond-row').forEach(row => {
        const nameInput = row.querySelector('.ce-bond-name');
        const startCheck = row.querySelector('.ce-bond-start');
        if (nameInput?.value.trim() && startCheck?.checked) bondCount++;
    });
    bondCount = Math.min(bondCount, 2);
    const xpFromBonds = bondCount * 2;
    
    // Complication XP
    let compCount = 0;
    document.querySelectorAll('.ce-complication-row').forEach(row => {
        const nameInput = row.querySelector('.ce-complication-name');
        const startCheck = row.querySelector('.ce-complication-start');
        if (nameInput?.value.trim() && startCheck?.checked) compCount++;
    });
    compCount = Math.min(compCount, 2);
    const xpFromComplications = compCount * 2;
    
    const totalXp = safeParseInt(document.getElementById('ce-total-xp')?.value, 32);
    
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
                ${editorState.isNew ? `<br><small>Bonds: +${xpFromBonds} XP | Complications: +${xpFromComplications} XP | Max starting: 36 XP</small>` : ''}
            </div>
        `;
    }
}

// ============================================================
// BUILD EDITOR HTML
// ============================================================

function buildEditorHTML(c) {
    const heritageOptions = HERITAGES.map(h => 
        `<option value="${h.id}" ${c.heritage === h.id ? 'selected' : ''}>${escHtml(h.label)}</option>`
    ).join('');
    
    const patronOptions = PATRONS.map(p => 
        `<option value="${p.id}" ${c.patron === p.id ? 'selected' : ''}>${escHtml(p.label)}</option>`
    ).join('');
    
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
    
    return `
        <div class="editor-form">
            <!-- XP Budget Display -->
            <div id="ce-xp-budget" style="margin-bottom:1rem;"></div>
            
            <!-- Step 1: Identity & Concept -->
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
            
            <!-- Step 2: Background -->
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 2 — Background</h3>
            <div class="form-row">
                <div class="field"><label>Background Name</label><input id="ce-background" value="${escHtml(c.background || '')}" placeholder="e.g., Marcher Veteran, Merchant Factor" /></div>
            </div>
            <div class="form-row">
                <div class="field"><label>Background Tags (Access)</label><input id="ce-background-tags" value="${escHtml(c.backgroundTags?.join(', ') || '')}" placeholder="e.g., Veteran-of-the-Marches, Muster Papers" /></div>
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
            
            <!-- Step 3: Attributes -->
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
            
            <!-- Step 4: Skills -->
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 4 — Skills (0–5)</h3>
            <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.4rem;">
                Cost: each step = new level × 2 XP. Skill cannot exceed relevant Attribute.
                (0→1=2, 1→2=4, 2→3=6, 3→4=8, 4→5=10)
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.3rem;font-size:0.85rem;">${skillInputs}</div>
            
            <!-- Step 5: Magic Path & Patron -->
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
                </div>
            </div>
            
            <!-- Step 6: Combat Loadout -->
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
            
            <!-- Step 7: Talents (new catalog) -->
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 7 — Talents</h3>
            <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.4rem;">
                Minor: 2–3 XP | Major: 4–6 XP | Prestige: 7–10 XP | Epic: 11+ XP
            </div>
            
            <!-- Catalog list -->
            <div id="ce-talent-catalog" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg2);margin-bottom:0.5rem;">
                <!-- populated by renderTalentCatalog() -->
            </div>
            
            <div style="margin-bottom:0.3rem;">
                <button class="btn btn-sm btn-primary" id="ce-add-custom-talent">✏️ Add Custom Talent</button>
            </div>
            
            <div class="dynamic-list" id="ce-talent-list">${talentRows}</div>
            
            <!-- Step 8: Assets (unchanged) -->
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 8 — Assets</h3>
            <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.4rem;">
                Minor: 4 XP | Standard: 8 XP | Major: 12 XP
            </div>
            ${wikiPickerHTML('asset', 'assets')}
            <div class="dynamic-list" id="ce-asset-list">${assetRows}</div>
            
            <!-- Step 9: Equipment (unchanged) -->
            <h3 style="margin:0.8rem 0 0.4rem;color:var(--gold);">Step 9 — Additional Equipment</h3>
            ${wikiPickerHTML('equipment', 'equipment')}
            <div class="dynamic-list" id="ce-equipment-list">${equipRows}</div>
            
            <!-- Step 10: Bonds & Complications -->
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
            
            <!-- Step 11: Status & Resources -->
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
                <div class="field small" id="ce-corruption-section" style="display:${c.magicPath === 'cantor' ? 'flex' : 'none'};">
                    <label>Corruption (max <span id="ce-corruption-max">${c.spirit || 1}</span>)</label>
                    <input type="number" id="ce-corruption" value="${c.corruption || 0}" min="0" max="${c.spirit || 1}" />
                    <small style="color:var(--text2);">Fill: bloom (benefit + drawback), reset to Tier</small>
                </div>
                <div class="field small" id="ce-leash-section" style="display:${c.magicPath === 'summoner' ? 'flex' : 'none'};">
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
            
            <!-- Save/Cancel -->
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
    
    // Talent, Asset, Equipment rows (custom, editable)
    const placeholder = type === 'talent' ? 'Talent name' : type === 'asset' ? 'Asset name' : 'Equipment name';
    return `
        <div class="dynamic-row ce-${type}-row" data-index="${idx}">
            <input type="text" class="ce-${type}-name" placeholder="${placeholder}" value="${escHtml(item.name || '')}" style="flex:2;" />
            <input type="number" class="ce-${type}-cost" placeholder="XP" value="${item.cost || 0}" min="0" style="width:70px;" title="XP cost" />
            ${type === 'asset' ? '<select class="ce-asset-tier" style="width:100px;"><option value="minor">Minor</option><option value="standard">Standard</option><option value="major">Major</option></select>' : ''}
            <button class="btn btn-xs editor-remove-btn">✕</button>
        </div>
    `;
}

// ============================================================
// WIKI PICKER (still used for assets & equipment)
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
    const g = s => document.querySelector(s);
    const v = s => g(s)?.value || '';
    const n = s => safeParseInt(g(s)?.value);
    
    const name = v('#ce-name');
    if (!name || !name.trim()) {
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
        showToast('Character not found', 'error');
        return;
    }
    
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
        
        c.armorType = v('#ce-armor-type') || 'none';
        c.shieldType = v('#ce-shield-type') || 'none';
        c.weaponClass = v('#ce-weapon-class') || 'light';
        c.weaponTags = Array.from(document.querySelectorAll('.ce-weapon-tag:checked')).map(cb => cb.value);
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
        c.leash = Math.max(0, n('#ce-leash'));
        c.mentalStrain = clamp(n('#ce-mental-strain'), 0, c.mentalStrainMax);
        c.vtt = document.getElementById('ce-vtt')?.checked || false;
        
        // Dynamic lists (now handles both read-only spans and inputs)
        c.talents = readDynamicList('talent');
        c.assets = readDynamicList('asset');
        c.equipment = readDynamicList('equipment');
        c.bonds = readDynamicList('bond');
        c.complications = readDynamicList('complication');
        
        // Validate bonds/complications for new characters
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
            
            const spent = calculateTotalXpSpent(c);
            c.xpSpent = spent;
            
            if (spent > c.startingXp) {
                const over = spent - c.startingXp;
                const proceed = confirm(
                    `This character is ${over} XP over budget (${spent} spent, ${c.startingXp} available).\n\n` +
                    `Do you want to save anyway? (GM may allow this.)`
                );
                if (!proceed) return;
            }
        }
        
        updateCharacter(editorState.currentId, c);
        
        closeEditor();
        
        import('./index.js').then(module => {
            if (module.renderCharList) {
                module.renderCharList();
            }
        });
        
        showToast(`Character "${c.name}" saved successfully. (Tier ${c.tier}: ${c.tierName})`, 'success');
        
    } catch (error) {
        console.error('[Editor] Error saving character:', error);
        showToast('Error saving character. Please try again.', 'error');
    }
}

// ============================================================
// READ DYNAMIC LISTS (supports both input & span content)
// ============================================================

function readDynamicList(type) {
    const items = [];
    const rows = document.querySelectorAll('.ce-' + type + '-row');
    
    for (const row of rows) {
        if (type === 'bond') {
            const nameInput = row.querySelector('.ce-bond-name');
            const descInput = row.querySelector('.ce-bond-desc');
            const startCheck = row.querySelector('.ce-bond-start');
            const name = nameInput ? (nameInput.tagName === 'INPUT' ? nameInput.value.trim() : nameInput.textContent.trim()) : '';
            if (!name) continue;
            items.push({
                name,
                desc: descInput ? (descInput.tagName === 'INPUT' ? descInput.value.trim() : descInput.textContent.trim()) : '',
                start: startCheck ? startCheck.checked : false
            });
        } else if (type === 'complication') {
            const nameInput = row.querySelector('.ce-complication-name');
            const descInput = row.querySelector('.ce-complication-desc');
            const startCheck = row.querySelector('.ce-complication-start');
            const name = nameInput ? (nameInput.tagName === 'INPUT' ? nameInput.value.trim() : nameInput.textContent.trim()) : '';
            if (!name) continue;
            items.push({
                name,
                desc: descInput ? (descInput.tagName === 'INPUT' ? descInput.value.trim() : descInput.textContent.trim()) : '',
                start: startCheck ? startCheck.checked : false
            });
        } else if (type === 'asset') {
            const nameEl = row.querySelector('.ce-asset-name');
            const costEl = row.querySelector('.ce-asset-cost');
            const tierSelect = row.querySelector('.ce-asset-tier');
            const name = nameEl ? (nameEl.tagName === 'INPUT' ? nameEl.value.trim() : nameEl.textContent.trim()) : '';
            if (!name) continue;
            items.push({
                name,
                cost: costEl ? (costEl.tagName === 'INPUT' ? safeParseInt(costEl.value, 0) : safeParseInt(costEl.textContent, 0)) : 0,
                tier: tierSelect ? tierSelect.value : 'minor'
            });
        } else {
            const nameEl = row.querySelector('.ce-' + type + '-name');
            const costEl = row.querySelector('.ce-' + type + '-cost');
            const name = nameEl ? (nameEl.tagName === 'INPUT' ? nameEl.value.trim() : nameEl.textContent.trim()) : '';
            if (!name) continue;
            items.push({
                name,
                cost: costEl ? (costEl.tagName === 'INPUT' ? safeParseInt(costEl.value, 0) : safeParseInt(costEl.textContent, 0)) : 0
            });
        }
    }
    
    return items;
}

// ============================================================
// DYNAMIC ROW ADDERS
// ============================================================

export function addCEDynamic(type) {
    const container = document.getElementById('ce-' + type + '-list');
    if (!container) return;
    
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
}

export function addCEDynamicFromWiki(type, entryId) {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    const entry = wikiEntries.find(e => String(e.id) === String(entryId));
    
    if (!entry) {
        showToast('Wiki entry not found.', 'error');
        return;
    }
    
    const container = document.getElementById('ce-' + type + '-list');
    if (!container) return;
    
    const idx = container.children.length;
    const cost = entry.cost != null ? entry.cost : 0;
    const div = document.createElement('div');
    div.innerHTML = dynamicRowHTML(type, idx, { name: entry.title, cost });
    container.appendChild(div.firstElementChild);
    
    showToast(`Added "${entry.title}" from wiki.`, 'success');
    recalculateXpBudget();
}

// ============================================================
// SETUP EVENTS
// ============================================================

function setupEditorEvents() {
    document.addEventListener('keydown', (e) => {
        if (!editorState.isOpen) return;
        if (e.key === 'Escape') {
            closeEditor();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const saveBtn = document.getElementById('ce-save-btn');
            if (saveBtn) saveBtn.click();
        }
    });
}

// ============================================================
// INITIALIZE
// ============================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initEditor();
        setupEditorEvents();
    });
} else {
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