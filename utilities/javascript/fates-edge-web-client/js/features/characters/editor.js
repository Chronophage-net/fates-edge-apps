/**
 * Editor – Full character editor with dynamic patron loading
 * 
 * REVISED: Fixed talent catalog (direct event listeners), XP recalculation,
 * magic path display, dynamic row generation for all types, and tier filtering.
 * 
 * UPDATED: Patrons are now loaded dynamically from the patrons feature's state.
 * No hardcoded patron list – uses the same data as the Patrons tab.
 * 
 * REVISED: Added Bound Patron, bloomCount, resonantRites for Cantors.
 * 
 * NEW: learnedTalents array is stored and kept in sync with the chosen magicPath
 * (familiar/codex for Runekeeper, etc.) so the rites panel can correctly detect
 * access to Patron's Gift and Rites.
 *
 * ────────────────────────────────────────────────────────────────────────
 * ADDITIONAL BUGFIX PASS (this revision):
 *
 * 1. buildEditorHTML now normalises backgroundTags: ensures it's an array
 *    before calling .join().
 * 2. readDynamicList now safely checks for missing inputs and uses
 *    .textContent for non‑input elements (fixes talent name reading).
 * 3. saveEditor normalises backgroundTags to an array before saving.
 * 4. recalculateXpBudget now catches errors from readDynamicList.
 * ────────────────────────────────────────────────────────────────────────
 * 
 * 5. Skill input width increased from 45px to 60px so values are readable.
 * 6. Editor content container now scrollable (max-height:80vh; overflow-y:auto).
 * 7. Invoker Symbols section added for managing symbols (patron + state).
 * 8. Event listeners for adding/removing symbols.
 * ────────────────────────────────────────────────────────────────────────
 */

import { getState, addCharacter, getCharacter, updateCharacter, deleteCharacter } from '../../core/state.js';
import { generateId, escHtml, safeParseInt, clamp } from '../../core/utils.js';
import { showToast } from '../../components/Toast.js';
import { loadPatronData } from '../patrons/index.js';
import { openTalentEditor } from './talent-editor.js';
import { ensureTalentEffects } from '../../core/talent-effects.js';
import { loadTalentCatalog } from '../../core/talent-loader.js';

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

const SKILL_ATTRIBUTES = {
    melee: 'body', ranged: 'wits', unarmed: 'body', athletics: 'body',
    stealth: 'wits', endurance: 'body', craft: 'wits', sway: 'presence',
    deception: 'presence', subterfuge: 'wits', performance: 'presence', insight: 'spirit',
    lore: 'wits', investigation: 'wits', medicine: 'wits', arcana: 'spirit'
};

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

const ARMOR_TYPES = [
    { id: 'none', label: 'No Armor', xpCost: 0, conversion: 'Harm passes directly', penalty: 'None' },
    { id: 'light', label: 'Light Armor', xpCost: 4, conversion: '1→1 (min 1 Fatigue/hit)', penalty: 'None' },
    { id: 'medium', label: 'Medium Armor', xpCost: 8, conversion: '2→1 (min 1 Fatigue/hit)', penalty: '-1d physical skills' },
    { id: 'heavy', label: 'Heavy Armor', xpCost: 12, conversion: '3→2 (min 1 Fatigue/hit)', penalty: '-2d physical, no sprint in rough' },
    { id: 'superior', label: 'Superior Armor', xpCost: 16, conversion: '4→3 (min 1 Fatigue/hit)', penalty: 'Special' },
    { id: 'mythic', label: 'Mythic Armor', xpCost: 20, conversion: '5→4 (min 1 Fatigue/hit)', penalty: 'Special' }
];

// Weight class is the ONE axis that drives the range-band dice bonus (see
// core/talent-effects.js's RANGE_BONUS_TABLE) — Light/Medium/Heavy numbers
// are the Player's Guide §3.12.2 Melee Modifiers table verbatim; Ranged
// collapses the Guide's own Light/Medium/Heavy Ranged sub-table (§3.12.3,
// each with its own Tempo) into one representative curve.
const WEAPON_CLASSES = [
    { id: 'light', label: 'Light Weapon (4 XP)', close: '+2d', near: '+1d', notes: 'Fast, concealable' },
    { id: 'medium', label: 'Medium Weapon (8 XP)', close: '+1d', near: '+2d', notes: 'Balanced, battlefield standard' },
    { id: 'heavy', label: 'Heavy Weapon (12 XP)', close: '-1d', near: '+3d', notes: 'Punishing, slow' },
    { id: 'ranged', label: 'Ranged Weapon', close: '-2d', near: '+2d', notes: 'Bow, crossbow, thrown — Close carries the "Ranged in Close = Desperate" penalty; see §3.12.3 for Far/Tempo' }
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

const MAGIC_PATH_LEARNED_TALENTS = {
    runekeeper: ['familiar', 'codex'],
    'familiar-only': ['familiar'],
    cantor: ['cantors-path'],
    summoner: ['pact-whisperer', 'lesser-pactwright'],
    'free-caster': ['spellcraft'],
    witch: ['craft-of-the-hedge'],
    'hedge-gifts': ['craft-of-the-hedge'],
    invoker: [], // no talent needed; symbols are stored separately
    psion: ['psionic-training'],
    monk: ['monastic-training']
};

function defaultSkills() {
    const skills = {};
    ALL_SKILLS.forEach(s => skills[s.toLowerCase()] = 0);
    return skills;
}

// ─── Thiasos/Codex → Patron mapping ──────────────────────────────
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
    hiddenSiblings: null,
    escListener: null,
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
    });

    // talent-editor.js dispatches this after saving/deleting a talent (catalog or
    // character-scoped). Refresh the character editor's talent list if it's open so
    // both talent-editing surfaces stay visibly in sync.
    document.addEventListener('talent-updated', () => {
        if (editorState.isOpen) {
            renderCETalentList();
            recalculateXpBudget();
        }
    });

    editorState.initialized = true;
    console.log('[Editor] initEditor complete');
}

// ============================================================
// XP CALCULATION HELPERS
// ============================================================

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

function getTierFromXp(xp) {
    for (const t of TIER_THRESHOLDS) {
        if (xp >= t.min && xp <= t.max) {
            return { tier: t.tier, name: t.name };
        }
    }
    return { tier: 'V', name: 'Mythic' };
}

// ============================================================
// TALENT CATALOG
// ============================================================

function getAvailableTalentsForTier(totalXp) {
    const appState = getState();
    const localTalents = appState.talents || [];
    const wikiEntries = appState.wikiEntries || [];
    const wikiTalents = wikiEntries.filter(e => e.tags && Array.isArray(e.tags) && e.tags.includes('talent'));

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

    catalogEl.innerHTML = available.map((t, i) => {
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
                    ${t.prerequisites ? `<div style="color:var(--text3); font-size:0.65rem;">Requires: ${escHtml(t.prerequisites)}</div>` : ''}
                </div>
                <button class="btn btn-xs btn-primary ce-catalog-add-btn" data-index="${i}">Add</button>
            </div>
        `;
    }).join('');

    catalogEl.querySelectorAll('.ce-catalog-add-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const idx = parseInt(this.dataset.index, 10);
            addTalentFromCatalog(available[idx]);
        });
    });
}

/**
 * Add a talent to the character currently open in the editor. Takes the FULL
 * talent object (tier/activation/category/useLimit/effects/prerequisites/etc.),
 * not just name+cost — previously this only carried {name, cost} into
 * character.talents, silently discarding everything the talent catalog and the
 * dedicated talent editor (talent-editor.js) captured. Persists immediately via
 * updateCharacter so the two talent-editing surfaces stay in sync.
 */
function addTalentFromCatalog(talent) {
    if (!editorState.currentId) {
        showToast('Open a character first.', 'error');
        return;
    }
    const c = getCharacter(editorState.currentId);
    if (!c) return;
    if (!Array.isArray(c.talents)) c.talents = [];

    const { source, ...rest } = talent; // drop the 'local'/'wiki' catalog-source tag
    const talentCopy = {
        ...rest,
        id: generateId('talent_'),
        clonedFrom: talent.id || null,
    };
    ensureTalentEffects(talentCopy);
    c.talents.push(talentCopy);
    updateCharacter(editorState.currentId, { talents: c.talents });
    renderCETalentList();
    recalculateXpBudget();
    showToast(`Added "${talent.name}" (${safeParseInt(talent.cost, 0)} XP)`, 'success');
}

/**
 * Render the character's talent list from state (the single source of truth),
 * instead of from ad-hoc DOM rows that only ever captured {name, cost}.
 */
function renderCETalentList() {
    const listEl = document.getElementById('ce-talent-list');
    if (!listEl || !editorState.currentId) return;
    const c = getCharacter(editorState.currentId);
    const talents = (c?.talents || []).filter(t => t && t.name);

    const LIMITED_USE = new Set(['once-scene', 'once-session', 'once-arc', 'once-campaign']);
    const uses = c?.talentUses || {};

    listEl.innerHTML = talents.map((t, i) => {
        const tierObj = TALENT_TIERS.find(ti => ti.id === t.tier);
        const tierLabel = tierObj ? tierObj.label : (t.tier || '');
        const hasMechanicalEffect = Array.isArray(t.effects) && t.effects.length > 0;
        const isLimited = LIMITED_USE.has(t.useLimit);
        const spent = isLimited && uses[t.id || t.name]?.spent;
        let chargeBadge = '';
        if (isLimited) {
            chargeBadge = spent
                ? `<span title="Charge spent — refreshes at ${t.useLimit.replace('once-', '')} end" style="color:var(--text3);font-size:0.7rem;margin-left:0.3rem;">○ spent</span>
                   <button type="button" class="btn btn-xs ce-talent-refresh-btn" data-index="${i}" title="Manually refresh this charge">↻</button>`
                : `<span title="Charge available" style="color:var(--green);font-size:0.7rem;margin-left:0.3rem;">● ready</span>`;
        }
        return `
            <div class="dynamic-row ce-talent-row" data-index="${i}" style="display:flex;align-items:center;gap:0.4rem;padding:0.2rem 0;">
                <div style="flex:2;">
                    <span style="font-weight:500;">${escHtml(t.name)}</span>
                    ${tierLabel ? `<span style="color:var(--text3);font-size:0.7rem;margin-left:0.3rem;">(${escHtml(tierLabel)})</span>` : ''}
                    ${hasMechanicalEffect ? `<span title="Has a mechanical effect the dice roller applies automatically" style="margin-left:0.3rem;">⚙️</span>` : ''}
                    ${chargeBadge}
                    ${t.effect ? `<div style="color:var(--text3);font-size:0.7rem;">${escHtml(t.effect)}</div>` : ''}
                </div>
                <span style="width:50px;text-align:center;">${safeParseInt(t.cost, 0)} XP</span>
                <button type="button" class="btn btn-xs ce-talent-edit-btn" data-index="${i}">✏️</button>
                <button type="button" class="btn btn-xs editor-remove-btn ce-talent-remove-btn" data-index="${i}">✕</button>
            </div>
        `;
    }).join('');

    listEl.querySelectorAll('.ce-talent-edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            openTalentEditor(editorState.currentId, parseInt(this.dataset.index, 10));
        });
    });
    listEl.querySelectorAll('.ce-talent-remove-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const idx = parseInt(this.dataset.index, 10);
            const cc = getCharacter(editorState.currentId);
            if (!cc || !Array.isArray(cc.talents)) return;
            cc.talents.splice(idx, 1);
            updateCharacter(editorState.currentId, { talents: cc.talents });
            renderCETalentList();
            recalculateXpBudget();
        });
    });
    listEl.querySelectorAll('.ce-talent-refresh-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const idx = parseInt(this.dataset.index, 10);
            const cc = getCharacter(editorState.currentId);
            if (!cc || !Array.isArray(cc.talents)) return;
            const t = cc.talents[idx];
            if (!t) return;
            const key = t.id || t.name;
            const newUses = { ...(cc.talentUses || {}) };
            delete newUses[key];
            updateCharacter(editorState.currentId, { talentUses: newUses });
            renderCETalentList();
        });
    });
}

// ============================================================
// DYNAMIC ROW HTML GENERATOR
// ============================================================

function dynamicRowHTML(type, idx, item = {}) {
    const name = item?.name ?? '';
    const cost = item?.cost ?? 0;
    let html = '';
    switch(type) {
        case 'talent':
        case 'asset':
        case 'equipment':
            html = `
                <div class="dynamic-row ce-${type}-row" data-index="${idx}">
                    <input type="text" class="ce-${type}-name" placeholder="Name" value="${escHtml(name)}" style="flex:2;" />
                    <input type="number" class="ce-${type}-cost" placeholder="XP" value="${cost}" min="0" style="width:70px;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;
            break;
        case 'bond':
            html = `
                <div class="dynamic-row ce-bond-row" data-index="${idx}">
                    <input type="text" class="ce-bond-name" placeholder="Bond name" value="${escHtml(name)}" style="flex:1;" />
                    <input type="text" class="ce-bond-desc" placeholder="Description" value="${escHtml(item?.desc ?? '')}" style="flex:2;" />
                    <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;">
                        <input type="checkbox" class="ce-bond-start" ${item?.start ? 'checked' : ''} /> +2 XP
                    </label>
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;
            break;
        case 'complication':
            html = `
                <div class="dynamic-row ce-complication-row" data-index="${idx}">
                    <input type="text" class="ce-complication-name" placeholder="Complication name" value="${escHtml(name)}" style="flex:1;" />
                    <input type="text" class="ce-complication-desc" placeholder="Description" value="${escHtml(item?.desc ?? '')}" style="flex:2;" />
                    <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;">
                        <input type="checkbox" class="ce-complication-start" ${item?.start ? 'checked' : ''} /> +2 XP
                    </label>
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;
            break;
        case 'symbol':
            html = `
                <div class="dynamic-row ce-symbol-row" data-index="${idx}">
                    <select class="ce-symbol-patron" style="flex:1;">${buildPatronOptionsHTML(item?.patron || '')}</select>
                    <select class="ce-symbol-state" style="width:100px;">
                        <option value="active" ${item?.state === 'active' ? 'selected' : ''}>Active</option>
                        <option value="compromised" ${item?.state === 'compromised' ? 'selected' : ''}>Compromised</option>
                        <option value="shattered" ${item?.state === 'shattered' ? 'selected' : ''}>Shattered</option>
                    </select>
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;
            break;
        case 'rite':
        case 'repertoire':
        case 'hedge-gift':
        case 'psionic-art':
        case 'known-tag':
            html = `
                <div class="dynamic-row ce-${type}-row" data-index="${idx}">
                    <input type="text" class="ce-${type}-name" placeholder="Name" value="${escHtml(name)}" style="flex:2;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;
            break;
        case 'promise-timer':
            html = `
                <div class="dynamic-row ce-promise-timer-row" data-index="${idx}">
                    <input type="text" class="ce-promise-timer-name" placeholder="Timer name" value="${escHtml(name)}" style="flex:1;" />
                    <input type="number" class="ce-promise-timer-segments" placeholder="Segments" value="${item?.segments ?? 4}" min="1" max="12" style="width:80px;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;
            break;
        case 'bound-spirit':
            html = `
                <div class="dynamic-row ce-bound-spirit-row" data-index="${idx}">
                    <input type="text" class="ce-bound-spirit-name" placeholder="Spirit name" value="${escHtml(name)}" style="flex:1;" />
                    <input type="number" class="ce-bound-spirit-cap" placeholder="Cap" value="${item?.cap ?? 1}" min="1" max="5" style="width:60px;" />
                    <input type="text" class="ce-bound-spirit-nature" placeholder="Nature" value="${escHtml(item?.nature ?? '')}" style="flex:1;" />
                    <input type="text" class="ce-bound-spirit-services" placeholder="Services" value="${escHtml(item?.services ?? '')}" style="flex:1;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;
            break;
        default:
            html = `
                <div class="dynamic-row ce-${type}-row" data-index="${idx}">
                    <input type="text" class="ce-${type}-name" placeholder="Name" value="${escHtml(name)}" style="flex:2;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;
    }
    return html;
}

// ============================================================
// READ DYNAMIC LISTS (with defensive checks)
// ============================================================

function readDynamicList(type) {
    const items = [];
    const rows = document.querySelectorAll('.ce-' + type + '-row');
    for (const row of rows) {
        if (type === 'bond') {
            const nameInput = row.querySelector('.ce-bond-name');
            const descInput = row.querySelector('.ce-bond-desc');
            const startCheck = row.querySelector('.ce-bond-start');
            if (!nameInput) continue;
            const name = nameInput.value?.trim() || '';
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
            if (!nameInput) continue;
            const name = nameInput.value?.trim() || '';
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
            if (!nameInput) continue;
            const name = nameInput.value?.trim() || '';
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
            if (!nameInput) continue;
            const name = nameInput.value?.trim() || '';
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
            if (!nameInput) continue;
            const name = nameInput.value?.trim() || '';
            if (!name) continue;
            items.push({ name });
        }
        else if (['asset', 'equipment', 'talent'].includes(type)) {
            const nameEl = row.querySelector('.ce-' + type + '-name');
            const costEl = row.querySelector('.ce-' + type + '-cost');
            if (!nameEl) continue;
            // nameEl may be an input or a span (for talents)
            let name;
            if (nameEl.tagName === 'INPUT') {
                name = nameEl.value?.trim() || '';
            } else {
                name = nameEl.textContent?.trim() || '';
            }
            if (!name) continue;
            const cost = costEl ? safeParseInt(costEl.value || costEl.textContent, 0) : 0;
            const item = { name, cost };
            if (type === 'asset') {
                const tierSelect = row.querySelector('.ce-asset-tier');
                if (tierSelect) item.tier = tierSelect.value;
            }
            items.push(item);
        }
    }
    return items;
}

// ============================================================
// XP BUDGET RECALCULATION
// ============================================================

function recalculateXpBudget() {
    const totalXpInput = document.getElementById('ce-total-xp');
    if (!totalXpInput) return;
    const totalXp = safeParseInt(totalXpInput.value, 32);
    
    try {
        // Talents are read from state (see renderCETalentList/addTalentFromCatalog),
        // not from the DOM — the talent list no longer renders plain name/cost inputs.
        const liveChar = editorState.currentId ? getCharacter(editorState.currentId) : null;
        const tempChar = {
            body: safeParseInt(document.getElementById('ce-body')?.value, 1),
            wits: safeParseInt(document.getElementById('ce-wits')?.value, 1),
            spirit: safeParseInt(document.getElementById('ce-spirit')?.value, 1),
            presence: safeParseInt(document.getElementById('ce-presence')?.value, 1),
            skills: {},
            talents: liveChar?.talents || [],
            assets: readDynamicList('asset'),
            equipment: readDynamicList('equipment')
        };
        ALL_SKILLS.forEach(s => {
            const key = s.toLowerCase();
            const val = safeParseInt(document.getElementById(`ce-sk-${key}`)?.value, 0);
            tempChar.skills[key] = val;
        });
        
        const spent = calculateTotalXpSpent(tempChar);
        const remaining = totalXp - spent;
        const isOver = remaining < 0;
        
        const bar = document.querySelector('.ce-xp-bar');
        if (bar) {
            bar.className = `xp-budget-bar ${isOver ? 'xp-budget-over' : 'xp-budget-ok'}`;
            bar.innerHTML = `
                <strong>XP:</strong> ${totalXp} available − ${spent} spent = 
                <span style="color:${isOver ? 'var(--red)' : 'var(--green)'};font-weight:bold;">
                    ${remaining > 0 ? remaining + ' remaining' : remaining === 0 ? 'exactly spent' : Math.abs(remaining) + ' OVER!'}
                </span>
            `;
        }
    } catch (err) {
        console.warn('[Editor] XP budget recalculation failed:', err);
    }
}

// ============================================================
// MAGIC PATH DISPLAY
// ============================================================

function updateMagicPathDisplay() {
    const path = document.getElementById('ce-magic-path')?.value || 'none';
    const runekeeperFields = document.getElementById('ce-runekeeper-fields');
    const cantorFields = document.getElementById('ce-cantor-fields');
    const invokerFields = document.getElementById('ce-invoker-fields');
    const summonerFields = document.getElementById('ce-summoner-fields');
    const witchFields = document.getElementById('ce-witch-fields');
    const psionFields = document.getElementById('ce-psion-fields');
    const monkFields = document.getElementById('ce-monk-fields');

    if (runekeeperFields) runekeeperFields.style.display = path === 'runekeeper' ? 'block' : 'none';
    if (cantorFields) cantorFields.style.display = path === 'cantor' ? 'block' : 'none';
    if (invokerFields) invokerFields.style.display = path === 'invoker' ? 'block' : 'none';
    if (summonerFields) summonerFields.style.display = path === 'summoner' ? 'block' : 'none';
    if (witchFields) witchFields.style.display = path === 'witch' ? 'block' : 'none';
    if (psionFields) psionFields.style.display = path === 'psion' ? 'block' : 'none';
    if (monkFields) monkFields.style.display = path === 'monk' ? 'block' : 'none';
}

// ============================================================
// UI UPDATE FUNCTIONS
// ============================================================

function updateDerivedStats() {
    const body = safeParseInt(document.getElementById('ce-body')?.value, 1);
    const spirit = safeParseInt(document.getElementById('ce-spirit')?.value, 1);
    const presence = safeParseInt(document.getElementById('ce-presence')?.value, 1);
    const fatigueMax = document.getElementById('ce-fatigue-max');
    const obligationCap = document.getElementById('ce-obligation-cap');
    const corruptionMax = document.getElementById('ce-corruption-max');
    const mentalStrainMax = document.getElementById('ce-mental-strain-max');
    if (fatigueMax) fatigueMax.textContent = body;
    if (obligationCap) obligationCap.textContent = spirit + presence;
    if (corruptionMax) corruptionMax.textContent = spirit;
    if (mentalStrainMax) mentalStrainMax.textContent = spirit;
    recalculateXpBudget();
}

function updateTierDisplay() {
    const xp = safeParseInt(document.getElementById('ce-total-xp')?.value, 32);
    const { tier, name } = getTierFromXp(xp);
    const tierDisplay = document.getElementById('ce-tier-display');
    if (tierDisplay) tierDisplay.textContent = `Tier ${tier}: ${name}`;
    renderTalentCatalog();
}

function updateArmorConversion() {
    const armorId = document.getElementById('ce-armor-type')?.value || 'none';
    const armor = ARMOR_TYPES.find(a => a.id === armorId);
    const infoEl = document.getElementById('ce-armor-info');
    if (infoEl && armor) {
        infoEl.textContent = armor.conversion;
    }
    recalculateXpBudget();
}

function updateWeaponMods() {
    const weaponId = document.getElementById('ce-weapon-class')?.value || 'light';
    const weapon = WEAPON_CLASSES.find(w => w.id === weaponId);
    const infoEl = document.getElementById('ce-weapon-info');
    if (infoEl && weapon) {
        infoEl.textContent = `Close: ${weapon.close} | Near: ${weapon.near} | ${weapon.notes}`;
    }
    recalculateXpBudget();
}

function validateSkillCap(skillKey, label) {
    const input = document.getElementById(`ce-sk-${skillKey}`);
    if (!input) return;
    const val = safeParseInt(input.value, 0);
    const attrId = SKILL_ATTRIBUTES?.[skillKey] || 'wits';
    const attrVal = safeParseInt(document.getElementById(`ce-${attrId}`)?.value, 1);
    if (val > attrVal) {
        input.style.borderColor = 'var(--red)';
    } else {
        input.style.borderColor = '';
    }
    recalculateXpBudget();
}

function updateHeritageNote() {
    const heritageId = document.getElementById('ce-heritage')?.value || 'human';
    const heritage = HERITAGES.find(h => h.id === heritageId);
    const noteEl = document.getElementById('ce-heritage-note');
    if (noteEl && heritage) {
        noteEl.textContent = heritage.note;
    }
}

// ============================================================
// DYNAMIC ROW ADDERS
// ============================================================

export function addCEDynamic(type) {
    const container = document.getElementById('ce-' + type + '-list');
    if (!container) {
        showToast(`List for "${type}" not found.`, 'error');
        return;
    }
    const idx = container.children.length;
    const div = document.createElement('div');
    div.innerHTML = dynamicRowHTML(type, idx, {});
    const row = div.firstElementChild;
    container.appendChild(row);
    const firstInput = row.querySelector('input[type="text"]');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
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
    if (!container) {
        showToast(`List for "${type}" not found.`, 'error');
        return;
    }
    const idx = container.children.length;
    const cost = entry.cost != null ? entry.cost : 0;
    const div = document.createElement('div');
    div.innerHTML = dynamicRowHTML(type, idx, { name: entry.title, cost });
    container.appendChild(div.firstElementChild);
    showToast(`Added "${entry.title}" from wiki.`, 'success');
    recalculateXpBudget();
}

// ============================================================
// CREATE NEW CHARACTER
// ============================================================

function createNewCharacter() {
    return {
        id: generateId(),
        name: '',
        avatar: '',
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
        talentUses: {},
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
        monasticTradition: '',
        breathState: 'entering',
        monkCorruptionTier: 0,
        knownTags: [],
        boundPatron: '',
        boundPatronBonus: 1,
        bloomCount: 0,
        resonantRites: [],
        learnedTalents: []
    };
}

// ============================================================
// MODAL CREATION
// ============================================================

function createModal() {
    // Inline editor panel — NOT a pop-up overlay. It's inserted directly into
    // the page flow (see openEditor) in place of the character list, with an
    // explicit "← Back" affordance instead of a floating close button.
    const modal = document.createElement('div');
    modal.id = 'charModal';
    modal.className = 'editor-screen char-editor-screen';
    modal.style.cssText = `
        display: none;
        max-width: 950px;
        width: 100%;
        margin: 0 auto;
    `;
    modal.innerHTML = `
        <button id="charModalClose" class="btn btn-secondary editor-back">← Back</button>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
            <h2 id="char-modal-title" style="margin:0;color:var(--gold);">Character Editor</h2>
        </div>
        <div id="char-editor-content" style="max-height:80vh; overflow-y:auto;"></div>
    `;
    return modal;
}

// ============================================================
// BUILD EDITOR HTML (with backgroundTags normalisation)
// ============================================================

function buildEditorHTML(c) {
    // Ensure backgroundTags is an array
    let backgroundTags = c.backgroundTags;
    if (!Array.isArray(backgroundTags)) {
        if (typeof backgroundTags === 'string') {
            backgroundTags = backgroundTags.split(',').map(s => s.trim()).filter(Boolean);
        } else {
            backgroundTags = [];
        }
    }

    const heritageOptions = HERITAGES.map(h => 
        `<option value="${h.id}" ${c.heritage === h.id ? 'selected' : ''}>${escHtml(h.label)}</option>`
    ).join('');
    const regionOptions = REGIONS.map(r => 
        `<option value="${r}" ${c.region === r ? 'selected' : ''}>${r}</option>`
    ).join('');
    const magicPathOptions = MAGIC_PATHS.map(p => 
        `<option value="${p.id}" ${c.magicPath === p.id ? 'selected' : ''}>${escHtml(p.label)}</option>`
    ).join('');
    const armorOptions = ARMOR_TYPES.map(a => 
        `<option value="${a.id}" ${c.armorType === a.id ? 'selected' : ''}>${escHtml(a.label)}</option>`
    ).join('');
    const shieldOptions = SHIELD_TYPES.map(s => 
        `<option value="${s.id}" ${c.shieldType === s.id ? 'selected' : ''}>${escHtml(s.label)}</option>`
    ).join('');
    const weaponOptions = WEAPON_CLASSES.map(w => 
        `<option value="${w.id}" ${c.weaponClass === w.id ? 'selected' : ''}>${escHtml(w.label)}</option>`
    ).join('');
    const patronOptions = buildPatronOptionsHTML(c.patron || '');
    const boundPatronOptions = buildPatronOptionsHTML(c.boundPatron || '');
    const { tier, name } = getTierFromXp(c.totalXp || 32);

    const heritage = HERITAGES.find(h => h.id === c.heritage);
    const armor = ARMOR_TYPES.find(a => a.id === c.armorType);
    const weapon = WEAPON_CLASSES.find(w => w.id === c.weaponClass);

    const skillsHtml = ALL_SKILLS.map(s => {
        const key = s.toLowerCase();
        const val = c.skills?.[key] ?? 0;
        const attrId = SKILL_ATTRIBUTES?.[key] || 'wits';
        const attrName = attrId.charAt(0).toUpperCase() + attrId.slice(1);
        const cost = calculateSkillCost(0, val);
        return `
            <div style="display:flex;align-items:center;gap:0.3rem;background:var(--bg3);padding:0.2rem 0.4rem;border-radius:4px;">
                <div style="flex:1;">
                    <label style="font-size:0.8rem;font-weight:500;">${s}</label>
                    <div style="font-size:0.6rem;color:var(--text3);">${attrName}</div>
                </div>
                <input type="number" id="ce-sk-${key}" value="${val}" min="0" max="5" style="width:60px;text-align:center;" />
            </div>
        `;
    }).join('');

    const validAssets = (c.assets || []).filter(a => a && typeof a === 'object' && a.name);
    const validEquipment = (c.equipment || []).filter(e => e && typeof e === 'object' && e.name);
    const validBonds = (c.bonds || []).filter(b => b && typeof b === 'object' && b.name);
    const validComplications = (c.complications || []).filter(cp => cp && typeof cp === 'object' && cp.name);

    // Talent rows are rendered by renderCETalentList() after this HTML is injected,
    // since they read live from character.talents (the single source of truth) rather
    // than from a static string built at open-time — see renderCETalentList().

    const assetRows = validAssets.map((a, i) => dynamicRowHTML('asset', i, a)).join('');
    const equipRows = validEquipment.map((e, i) => dynamicRowHTML('equipment', i, e)).join('');
    const bondRows = validBonds.map((b, i) => dynamicRowHTML('bond', i, b)).join('');
    const compRows = validComplications.map((cp, i) => dynamicRowHTML('complication', i, cp)).join('');

    // ─── Invoker Symbols ──────────────────────────────────────────────
    // Ensure c.symbols is an array
    const symbols = Array.isArray(c.symbols) ? c.symbols : [];
    const symbolRows = symbols.map((patronId, idx) => {
        const stateVal = (c.symbolStates && c.symbolStates[patronId]) || 'active';
        return dynamicRowHTML('symbol', idx, { patron: patronId, state: stateVal });
    }).join('');

    const isRunekeeper = c.magicPath === 'runekeeper';
    const isCantor = c.magicPath === 'cantor';
    const isInvoker = c.magicPath === 'invoker';
    const isSummoner = c.magicPath === 'summoner';
    const isWitch = c.magicPath === 'witch';
    const isPsion = c.magicPath === 'psion';
    const isMonk = c.magicPath === 'monk';

    return `
        <div style="display:flex;flex-direction:column;gap:0.8rem;">
            <!-- XP Budget Bar -->
            <div class="ce-xp-bar xp-budget-bar xp-budget-ok">
                <strong>XP:</strong> ${c.totalXp || 32} available − 0 spent = <span style="color:var(--green);font-weight:bold;">${c.totalXp || 32} remaining</span>
            </div>

            <!-- Identity -->
            <div style="display:flex;gap:0.8rem;align-items:flex-start;">
                <div style="flex-shrink:0;text-align:center;">
                    <img id="ce-avatar-preview" src="${escHtml(c.avatar || '')}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid var(--border);background:var(--bg3);display:${c.avatar ? 'block' : 'none'};" onerror="this.style.display='none'" />
                    <div style="font-size:0.65rem;color:var(--text3);margin-top:0.2rem;">Portrait</div>
                </div>
                <div style="flex:1;">
                    <label>Portrait URL</label>
                    <input id="ce-avatar" value="${escHtml(c.avatar || '')}" placeholder="https://... image link (optional)" />
                </div>
            </div>

            <!-- Identity -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Name *</label>
                    <input id="ce-name" value="${escHtml(c.name)}" placeholder="Character name" />
                </div>
                <div>
                    <label>Heritage</label>
                    <select id="ce-heritage">${heritageOptions}</select>
                    <div id="ce-heritage-note" style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">${heritage?.note || ''}</div>
                </div>
                <div>
                    <label>Region</label>
                    <select id="ce-region">${regionOptions}</select>
                </div>
                <div>
                    <label>Cultural Affinity</label>
                    <input id="ce-cultural-affinity" value="${escHtml(c.culturalAffinity || '')}" placeholder="Cultural trait" />
                </div>
                <div>
                    <label>Background</label>
                    <input id="ce-background" value="${escHtml(c.background || '')}" placeholder="Background name" />
                </div>
                <div>
                    <label>Background Tags</label>
                    <input id="ce-background-tags" value="${escHtml(backgroundTags.join(', '))}" placeholder="e.g., Veteran, Muster Papers" />
                </div>
                <div>
                    <label>Signature Contact</label>
                    <input id="ce-background-contact" value="${escHtml(c.backgroundContact || '')}" placeholder="Contact name" />
                </div>
                <div>
                    <label>Background Boon</label>
                    <input id="ce-background-boon" value="${escHtml(c.backgroundBoon || '')}" placeholder="Once/session benefit" />
                </div>
                <div style="grid-column:1/-1;">
                    <label>Obligation Timer Seed</label>
                    <input id="ce-background-obligation" value="${escHtml(c.backgroundObligation || '')}" placeholder="Starting complication" />
                </div>
            </div>

            <!-- Attributes -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0.5rem;">
                ${['body','wits','spirit','presence'].map(attr => `
                    <div style="background:var(--bg3);padding:0.3rem;border-radius:4px;text-align:center;">
                        <label style="font-weight:600;font-size:0.85rem;">${attr.charAt(0).toUpperCase()+attr.slice(1)}</label>
                        <input type="number" id="ce-${attr}" value="${c[attr] || 1}" min="1" max="5" style="width:100%;text-align:center;font-size:1.1rem;" />
                        <div style="font-size:0.6rem;color:var(--text3);">Cost: ${calculateAttributeCost(1, c[attr] || 1)} XP</div>
                    </div>
                `).join('')}
            </div>

            <!-- Skills -->
            <div>
                <h4 style="margin:0.3rem 0;">Skills</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.3rem;">
                    ${skillsHtml}
                </div>
            </div>

            <!-- Magic Path -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Magic Path</label>
                    <select id="ce-magic-path">${magicPathOptions}</select>
                </div>
                <div>
                    <label>Patron</label>
                    <select id="ce-patron">${patronOptions}</select>
                </div>
            </div>

            <!-- Runekeeper Fields -->
            <div id="ce-runekeeper-fields" style="display:${isRunekeeper ? 'block' : 'none'};">
                <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div>
                        <label>Thiasos (Familiar)</label>
                        <input id="ce-thiasos" value="${escHtml(c.thiasos || '')}" placeholder="e.g., white-hound, garden-spider" />
                    </div>
                    <div>
                        <label>Codex</label>
                        <input id="ce-codex" value="${escHtml(c.codex || '')}" placeholder="e.g., iron-bound-ledger, frame-loom" />
                    </div>
                </div>
            </div>

            <!-- Cantor Fields -->
            <div id="ce-cantor-fields" style="display:${isCantor ? 'block' : 'none'};border-top:1px solid var(--border);padding-top:0.3rem;">
                <h5 style="margin:0.2rem 0;">🎵 Cantor</h5>
                <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div>
                        <label>Bound Patron</label>
                        <select id="ce-bound-patron">${boundPatronOptions}</select>
                    </div>
                    <div>
                        <label>Position Bonus</label>
                        <input type="number" id="ce-bound-patron-bonus" value="${c.boundPatronBonus ?? 1}" min="0" max="3" />
                    </div>
                    <div>
                        <label>Bloom Count</label>
                        <input type="number" id="ce-bloom-count" value="${c.bloomCount || 0}" min="0" />
                    </div>
                    <div>
                        <label>Resonant Rites</label>
                        <input id="ce-resonant-rites" value="${escHtml((c.resonantRites || []).join(', '))}" placeholder="Comma-separated" />
                    </div>
                </div>
            </div>

            <!-- Invoker Fields -->
            <div id="ce-invoker-fields" style="display:${isInvoker ? 'block' : 'none'}; border-top:1px solid var(--border); padding-top:0.3rem;">
                <h5 style="margin:0.2rem 0;">🎴 Invoker Symbols</h5>
                <div class="info-box" style="font-size:0.75rem; background:var(--bg3); padding:0.3rem; border-radius:4px;">
                    Each symbol grants access to a patron's Borrowed Grace and rites. You can carry up to 4 symbols without penalty.
                </div>
                <div style="display:flex; gap:0.4rem; margin-bottom:0.3rem;">
                    <select id="ce-add-symbol-select" style="flex:1; background:var(--bg3); border:1px solid var(--border); border-radius:4px; padding:0.1rem 0.3rem;">
                        <option value="">— Select a patron —</option>
                        ${getPatronOptions().filter(p => p.id).map(p => 
                            `<option value="${p.id}">${escHtml(p.label)}</option>`
                        ).join('')}
                    </select>
                    <button class="btn btn-sm btn-primary" id="ce-add-symbol-btn">➕ Add Symbol</button>
                </div>
                <div id="ce-symbol-list">${symbolRows}</div>
                <div style="font-size:0.65rem;color:var(--text3);margin-top:0.2rem;">
                    Symbols added here appear in the Spellcraft panel for Invokers.
                </div>
            </div>

            <!-- Combat Loadout -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Armor</label>
                    <select id="ce-armor-type">${armorOptions}</select>
                    <div id="ce-armor-info" style="font-size:0.7rem;color:var(--text3);">${armor?.conversion || ''}</div>
                </div>
                <div>
                    <label>Shield</label>
                    <select id="ce-shield-type">${shieldOptions}</select>
                </div>
                <div>
                    <label>Weapon</label>
                    <select id="ce-weapon-class">${weaponOptions}</select>
                    <div id="ce-weapon-info" style="font-size:0.7rem;color:var(--text3);">${weapon?.notes || ''}</div>
                </div>
            </div>

            <!-- Talents -->
            <div>
                <h4 style="margin:0.3rem 0;">🧠 Talents</h4>
                <div id="ce-talent-catalog" class="talent-catalog" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;background:var(--bg3);margin-bottom:0.3rem;"></div>
                <div id="ce-talent-list"></div>
                <button type="button" class="btn btn-sm btn-secondary" id="ce-add-custom-talent">+ Add Custom Talent</button>
            </div>

            <!-- Assets -->
            <div>
                <h4 style="margin:0.3rem 0;">🏰 Assets</h4>
                <div id="ce-asset-list">${assetRows}</div>
                <button class="btn btn-sm btn-secondary" data-editor-add="asset">+ Add Asset</button>
            </div>

            <!-- Equipment -->
            <div>
                <h4 style="margin:0.3rem 0;">🎒 Equipment</h4>
                <div id="ce-equip-list">${equipRows}</div>
                <button class="btn btn-sm btn-secondary" data-editor-add="equipment">+ Add Equipment</button>
            </div>

            <!-- Bonds & Complications -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <h4 style="margin:0.3rem 0;">🤝 Bonds</h4>
                    <div id="ce-bond-list">${bondRows}</div>
                    <button class="btn btn-sm btn-secondary" data-editor-add="bond">+ Add Bond</button>
                </div>
                <div>
                    <h4 style="margin:0.3rem 0;">⚠️ Complications</h4>
                    <div id="ce-complication-list">${compRows}</div>
                    <button class="btn btn-sm btn-secondary" data-editor-add="complication">+ Add Complication</button>
                </div>
            </div>

            <!-- Derived Stats -->
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.3rem;background:var(--bg3);padding:0.5rem;border-radius:4px;font-size:0.8rem;">
                <div>Fatigue: <span id="ce-fatigue-max">${c.body || 1}</span></div>
                <div>Obligation Cap: <span id="ce-obligation-cap">${(c.spirit || 1) + (c.presence || 1)}</span></div>
                <div>Corruption: <span id="ce-corruption-max">${c.spirit || 1}</span></div>
                <div>Mental Strain: <span id="ce-mental-strain-max">${c.spirit || 1}</span></div>
                <div>Tier: <span id="ce-tier-display">Tier ${tier}: ${name}</span></div>
            </div>

            <!-- Total XP -->
            <div>
                <label>Total XP</label>
                <input type="number" id="ce-total-xp" value="${c.totalXp || 32}" min="0" max="999" />
            </div>

            <!-- VTT -->
            <div>
                <label><input type="checkbox" id="ce-vtt" ${c.vtt ? 'checked' : ''} /> Push to VTT</label>
            </div>

            <!-- Buttons -->
            <div style="display:flex;gap:0.5rem;margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid var(--border);">
                <button class="btn btn-gold" id="ce-save-btn">💾 Save</button>
                <button class="btn btn-secondary" id="ce-cancel-btn">Cancel</button>
            </div>
        </div>
    `;
}

// ============================================================
// OPEN EDITOR
// ============================================================

export async function openEditor(id) {
    console.log('[Editor] openEditor called with id:', id);
    closeEditor();

    try {
        await loadPatronData();
        patronOptionsCache = null;
        console.log('[Editor] Patron data loaded');
    } catch (err) {
        console.warn('[Editor] Failed to load patron data:', err);
    }

    try {
        await loadTalentCatalog();
    } catch (err) {
        console.warn('[Editor] Failed to load talent catalog:', err);
    }

    initEditor();

    const modal = createModal();
    const hostContainer = document.getElementById('app-content') || document.body;
    // Hide the sibling content (e.g. the character list) instead of floating
    // an overlay above it — the editor takes over the view in place.
    editorState.hiddenSiblings = Array.from(hostContainer.children);
    editorState.hiddenSiblings.forEach(ch => { ch.dataset.ceHidden = '1'; ch.style.display = 'none'; });
    hostContainer.appendChild(modal);

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
        addCharacter(c);
        editorState.currentId = c.id;
        editorState.isNew = true;
        title.textContent = 'New Character';
    }

    if (!c.learnedTalents) c.learnedTalents = [];
    if (c.learnedTalents.length === 0 && c.magicPath && c.magicPath !== 'none') {
        const talents = MAGIC_PATH_LEARNED_TALENTS[c.magicPath];
        if (talents && talents.length) {
            c.learnedTalents = [...talents];
        }
    }

    editorState.isOpen = true;
    editorState.saved = false;
    editorState.modalElement = modal;

    let html;
    try {
        html = buildEditorHTML(c);
    } catch (err) {
        console.error('[Editor] buildEditorHTML failed:', err, 'Character data:', c);
        showToast('Error building the character editor. Please refresh and try again.', 'error');
        modal.remove();
        return;
    }
    content.innerHTML = html;
    modal.style.display = 'block';
    hostContainer.scrollTop = 0;
    window.scrollTo({ top: 0 });

    attachEditorEvents();
    recalculateXpBudget();
    renderTalentCatalog();
    renderCETalentList();
    updateMagicPathDisplay();
    updateTierDisplay();
    updateArmorConversion();
    updateWeaponMods();
    updateHeritageNote();
}

// ============================================================
// CLOSE EDITOR
// ============================================================

export function closeEditor() {
    if (editorState.isNew && !editorState.saved && editorState.currentId) {
        deleteCharacter(editorState.currentId);
    }

    const modal = document.getElementById('charModal');
    if (modal) modal.remove();

    // Restore whatever content the editor hid (e.g. the character list)
    if (editorState.hiddenSiblings) {
        editorState.hiddenSiblings.forEach(ch => {
            if (ch.dataset) delete ch.dataset.ceHidden;
            ch.style.display = '';
        });
        editorState.hiddenSiblings = null;
    }

    if (editorState.escListener) {
        document.removeEventListener('keydown', editorState.escListener);
        editorState.escListener = null;
    }

    if (editorState.saveListener) {
        const saveBtn = document.getElementById('ce-save-btn');
        if (saveBtn) saveBtn.removeEventListener('click', editorState.saveListener);
        editorState.saveListener = null;
    }

    editorState.cancelListeners.forEach(({ btn, handler }) => {
        if (btn) btn.removeEventListener('click', handler);
    });
    editorState.cancelListeners = [];

    editorState.isOpen = false;
    editorState.currentId = null;
    editorState.isNew = false;
    editorState.saved = false;
    editorState.modalElement = null;
}

// ============================================================
// SAVE EDITOR (with backgroundTags normalisation)
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
        c.avatar = v('#ce-avatar').trim();
        c.heritage = v('#ce-heritage') || 'human';
        c.region = v('#ce-region');
        c.culturalAffinity = v('#ce-cultural-affinity');
        c.background = v('#ce-background');
        
        // Normalise backgroundTags to array
        const tagsRaw = v('#ce-background-tags');
        c.backgroundTags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
        
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

        c.boundPatron = v('#ce-bound-patron');
        c.boundPatronBonus = clamp(n('#ce-bound-patron-bonus'), 0, 3);
        c.bloomCount = Math.max(0, n('#ce-bloom-count'));
        c.resonantRites = v('#ce-resonant-rites') ? v('#ce-resonant-rites').split(',').map(s => s.trim()).filter(Boolean) : [];

        if (c.magicPath === 'runekeeper' && !c.patron) {
            const derived = derivePatronFromRunekeeperItems({ thiasos: c.thiasos, codex: c.codex });
            if (derived) {
                c.patron = derived;
                const patronSelect = document.getElementById('ce-patron');
                if (patronSelect) patronSelect.value = derived;
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
        c.psionicArts = readDynamicList('psionic-art').map(row => row.name).filter(Boolean);
        c.boundSpirits = readDynamicList('bound-spirit').filter(s => s.name);
        c.monasticTradition = v('#ce-monastic-tradition');
        c.breathState = v('#ce-breath-state') || 'entering';
        c.monkCorruptionTier = Math.max(0, n('#ce-monk-corruption-tier'));
        c.knownTags = readDynamicList('known-tag').map(row => row.name).filter(Boolean);

        // NOTE: c.talents is intentionally NOT re-read from the DOM here. Talents are
        // now added/edited/removed directly against state (addTalentFromCatalog,
        // renderCETalentList's edit/remove handlers, and the talent-editor.js modal),
        // each of which persists immediately via updateCharacter. Re-reading from a
        // simple name+cost row here would silently discard tier/category/effects/
        // useLimit/prerequisites — which used to happen, and is the bug this fixes.
        c.assets = readDynamicList('asset').filter(a => a.name);
        c.equipment = readDynamicList('equipment').filter(e => e.name);
        c.bonds = readDynamicList('bond').filter(b => b.name);
        c.complications = readDynamicList('complication').filter(cp => cp.name);

        if (!c.learnedTalents) c.learnedTalents = [];
        if (c.learnedTalents.length === 0 && c.magicPath && c.magicPath !== 'none') {
            const talents = MAGIC_PATH_LEARNED_TALENTS[c.magicPath];
            if (talents && talents.length) {
                c.learnedTalents = [...talents];
            }
        }

        if (editorState.isNew) {
            const startBonds = c.bonds.filter(b => b.start).length;
            const startComps = c.complications.filter(x => x.start).length;
            c.xpFromBonds = Math.min(startBonds, 2) * 2;
            c.xpFromComplications = Math.min(startComps, 2) * 2;
            c.startingXp = Math.min(32 + c.xpFromBonds + c.xpFromComplications, 36);
            c.totalXp = c.startingXp;
            const { tier: newTier, name: newTierName } = getTierFromXp(c.totalXp);
            c.tier = newTier;
            c.tierName = newTierName;
            c.xpSpent = calculateTotalXpSpent(c);

            if (c.xpSpent > c.startingXp) {
                const over = c.xpSpent - c.startingXp;
                if (!confirm(`This character is ${over} XP over budget (${c.xpSpent} spent, ${c.startingXp} available).\n\nSave anyway?`)) {
                    return;
                }
            }
        }

        updateCharacter(editorState.currentId, c);
        editorState.saved = true;
        closeEditor();

        import('./index.js').then(module => {
            if (module.renderCharList) module.renderCharList();
        }).catch(() => {});

        showToast(`Character "${c.name}" saved successfully. (Tier ${c.tier}: ${c.tierName})`, 'success');

    } catch (error) {
        console.error('[Editor] Error saving:', error);
        showToast('Error saving character. Please try again.', 'error');
    }
}

// ============================================================
// ATTACH EDITOR EVENTS
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

    if (editorState.escListener) {
        document.removeEventListener('keydown', editorState.escListener);
    }
    editorState.escListener = (e) => {
        if (!editorState.isOpen) return;
        if (e.key === 'Escape') closeEditor();
    };
    document.addEventListener('keydown', editorState.escListener);

    // Attribute listeners
    ['body', 'wits', 'spirit', 'presence'].forEach(attr => {
        const input = document.getElementById(`ce-${attr}`);
        if (input) {
            input.addEventListener('change', updateDerivedStats);
            input.addEventListener('input', updateDerivedStats);
        }
    });

    // Avatar live preview
    const avatarInput = document.getElementById('ce-avatar');
    const avatarPreview = document.getElementById('ce-avatar-preview');
    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('input', () => {
            const url = avatarInput.value.trim();
            if (url) {
                avatarPreview.src = url;
                avatarPreview.style.display = 'block';
            } else {
                avatarPreview.style.display = 'none';
            }
        });
    }

    // Heritage
    const heritageSelect = document.getElementById('ce-heritage');
    if (heritageSelect) {
        heritageSelect.addEventListener('change', updateHeritageNote);
    }

    // XP
    const xpInput = document.getElementById('ce-total-xp');
    if (xpInput) {
        xpInput.addEventListener('input', () => { updateTierDisplay(); renderTalentCatalog(); recalculateXpBudget(); });
        xpInput.addEventListener('change', () => { updateTierDisplay(); renderTalentCatalog(); recalculateXpBudget(); });
    }

    // Armor/Weapon
    const armorSelect = document.getElementById('ce-armor-type');
    if (armorSelect) armorSelect.addEventListener('change', updateArmorConversion);
    const weaponSelect = document.getElementById('ce-weapon-class');
    if (weaponSelect) weaponSelect.addEventListener('change', updateWeaponMods);

    // Magic path
    const magicPathSelect = document.getElementById('ce-magic-path');
    if (magicPathSelect) {
        magicPathSelect.addEventListener('change', updateMagicPathDisplay);
    }

    // Skills
    ALL_SKILLS.forEach(s => {
        const key = s.toLowerCase();
        const input = document.getElementById(`ce-sk-${key}`);
        if (input) {
            input.addEventListener('change', () => validateSkillCap(key, s));
            input.addEventListener('input', recalculateXpBudget);
        }
    });

    // Custom talent button — opens the full talent editor (tier/activation/category/
    // useLimit/prerequisites/effect) instead of a bare name+cost row, so custom talents
    // get the same structured effects as catalog talents.
    const customTalentBtn = document.getElementById('ce-add-custom-talent');
    if (customTalentBtn) {
        customTalentBtn.addEventListener('click', () => {
            if (editorState.currentId) openTalentEditor(editorState.currentId, -1);
        });
    }

    // ─── Invoker Symbols: Add Symbol ───────────────────────────────
    const addSymbolBtn = document.getElementById('ce-add-symbol-btn');
    if (addSymbolBtn) {
        addSymbolBtn.addEventListener('click', () => {
            const select = document.getElementById('ce-add-symbol-select');
            if (!select) return;
            const patronId = select.value;
            if (!patronId) {
                showToast('Please select a patron.', 'warning');
                return;
            }
            // Check if already added
            const list = document.getElementById('ce-symbol-list');
            if (!list) return;
            // Check if the patron is already in the list
            const existingRows = list.querySelectorAll('.ce-symbol-row');
            for (const row of existingRows) {
                const sel = row.querySelector('.ce-symbol-patron');
                if (sel && sel.value === patronId) {
                    showToast('Symbol already added.', 'info');
                    return;
                }
            }
            // Build new row
            const patronOptions = buildPatronOptionsHTML(patronId);
            const row = document.createElement('div');
            row.className = 'dynamic-row ce-symbol-row';
            row.innerHTML = `
                <select class="ce-symbol-patron" style="flex:1;">${patronOptions}</select>
                <select class="ce-symbol-state" style="width:100px;">
                    <option value="active" selected>Active</option>
                    <option value="compromised">Compromised</option>
                    <option value="shattered">Shattered</option>
                </select>
                <button class="btn btn-xs editor-remove-btn">✕</button>
            `;
            list.appendChild(row);
            showToast(`Added Symbol of ${select.options[select.selectedIndex].text}`, 'success');
            recalculateXpBudget();
        });
    }

    // Weapon tags
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
}

// ============================================================
// EXPOSE GLOBALS & EXPORTS
// ============================================================

Object.assign(window, {
    addCEDynamic,
    addCEDynamicFromWiki,
    saveEditor,
    closeEditor,
    openEditor,
    addTalentFromCatalog
});

export default {
    openEditor,
    closeEditor,
    saveEditor,
    addCEDynamic,
    addCEDynamicFromWiki
};

// ─── Auto-init ────────────────────────────────────────────────────

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Editor] DOMContentLoaded, initializing');
        initEditor();
    });
} else {
    console.log('[Editor] DOM already loaded, initializing');
    initEditor();
}