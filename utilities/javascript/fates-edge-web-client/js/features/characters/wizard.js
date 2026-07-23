/**
 * Character Wizard – Step-by-step character creation
 * UPDATED: Now integrates talent catalog with tier‑gated filtering.
 * - Talent catalog from index.js / state.talents + wiki entries
 * - Filtered by tier (Minor for T1, Minor+Major for T2, all for T3+)
 * - Click‑to‑add from catalog, still allows manual custom talents
 */

import { generateId, escHtml, safeParseInt, clamp } from '../../core/utils.js';
import { addCharacter, getState } from '../../core/state.js';
import { showToast } from '../../components/Toast.js';

// ─── Game Data Constants (from Player's Guide) ─────────────────────

const ALL_SKILLS = [
    'Melee', 'Ranged', 'Unarmed', 'Athletics',
    'Stealth', 'Endurance', 'Craft', 'Sway',
    'Deception', 'Subterfuge', 'Performance', 'Insight',
    'Lore', 'Investigation', 'Medicine', 'Arcana'
];

// Skill → Primary Attribute mapping for cap enforcement
const SKILL_ATTRIBUTES = {
    melee: 'body', ranged: 'wits', unarmed: 'body', athletics: 'body',
    stealth: 'wits', endurance: 'body', craft: 'wits', sway: 'presence',
    deception: 'presence', subterfuge: 'wits', performance: 'presence', insight: 'spirit',
    lore: 'wits', investigation: 'wits', medicine: 'wits', arcana: 'spirit'
};

const HERITAGES = [
    { id: 'human', label: 'Human — The Adaptable', adj: 'None', note: 'Endless Reach: +1 die on untrained skill rolls. Free Endless Reach talent.' },
    { id: 'aelaerem', label: 'Aelaerem (Halfling) — Hearth & Hollow', adj: 'Wits+1, Presence+1, Body−1', note: 'Small Folk: Lucky break (improve Position 1/scene). Cannot use Heavy Armor.' },
    { id: 'aelinnel', label: 'Aelinnel (Gnome) — Stone, Bough, Bright Things', adj: 'Wits+1, Spirit+1, Body−1', note: 'Small Folk: Short Step (teleport) or Knack (handy item). Cannot use Heavy Armor.' },
    { id: 'aeler', label: 'Aeler (Dwarf) — Crowns & Under-Vaults', adj: 'Body+1, Spirit+1, Presence−1', note: 'Stone-sense, breath-counting, oath-cords. Heavy armor proficiency.' },
    { id: 'lethai-al', label: 'Lethai-al (Wood Elf) — Root, River, Roof-Tree', adj: 'Body+1, Wits+1, Presence−1', note: 'Root-law, tree-speak, green ward in forests.' },
    { id: 'lethai-thora', label: 'Lethai-thora (High Elf) — Mind\'s Eye & Civic Measure', adj: 'Wits+1, Spirit+1, Body−1', note: 'Lorekeeper, weave anchor, academic immunity.' },
    { id: 'lethai-ar', label: 'Lethai-ar (Dark Elf) — The Oathbound', adj: 'Wits+1, Presence+1, Spirit−1', note: 'Mask-right, vow-touch, serpent\'s shed.' },
    { id: 'ykrul', label: 'Ykrul (Orc) — Wolf Standards, Winter Camps', adj: 'Body+1, Spirit+1, Presence−1', note: 'Blood memory, hostage strings, kon\'reh intuition. Mounted archery discount.' },
    { id: 'narethi', label: 'Narethi — The Unburied of the Deep Desert', adj: 'Wits+1, Spirit+1, Body−1', note: 'Natural telepathy, sunken eyes (darkvision), resonance sense. Resonance Leash [4].' },
    { id: 'mixed', label: 'Mixed Heritage — Half-Elves, Half-Ykrul, Half-Others', adj: 'Choose one +1 and one −1', note: 'Pick two skill bonuses from parent cultures. Access both talent lists.' }
];

const PATRONS = [
    { id: '', label: 'None — No Patron' },
    { id: 'traveler', label: 'The Traveler — Ways & Journeys', theme: 'Roads, wayfinding, safe passage' },
    { id: 'oath-flame', label: 'Oath of Flame & Light — Dawn & Vows', theme: 'Vows, radiance, smiting' },
    { id: 'inaea', label: 'Inaea (Angel of the Spider) — Webs & Patient Predation', theme: 'Mercy, community, threads that bind' },
    { id: 'witness', label: 'The Witness — Truth & Revelation', theme: 'Truth, memory, uncomfortable revelations' },
    { id: 'carrion-king', label: 'The Carrion King — Lord of Decay and Renewal', theme: 'Decay, renewal, wisdom of endings' },
    { id: 'ikasha', label: 'Ikasha (She Who Sleeps) — Latent Potential & Shadow', theme: 'Shadow, secrets, latent potential' },
    { id: 'grimmir', label: 'Grimmir, the Old Man of the Forest — Primal Mystery', theme: 'Seasons, sacrifice, old pact of field and forest' },
    { id: 'palinode', label: 'Palinode, Queen of Encores — Performance & Rapture', theme: 'Performance, rapture, the unfinished song' }
];

const MAGIC_PATHS = [
    { id: 'none', label: 'No Magic Path', cost: 0, note: 'Attributes and Skills are enough to be effective.' },
    { id: 'hedge-gifts', label: 'Hedge Gifts (Craft of the Hedge, 4 XP)', cost: 4, note: '2 no-roll magical abilities. No resource tracking. Retrain later.' },
    { id: 'familiar-only', label: 'Familiar Only (Familiar, 2 XP)', cost: 2, note: 'Companion + Patron\'s Gift. Obligation per use. Buy Codex later for full Runekeeper.' },
    { id: 'runekeeper', label: 'Runekeeper (Familiar 2 XP + Codex 4 XP)', cost: 6, note: 'Structured rites from a Patron. Obligation cost per rite. Reliable but accrues debt.' },
    { id: 'free-caster', label: 'Free Caster (Spellcraft, 6 XP)', cost: 6, note: 'Improvised magic via TAGS. Flexible but risky. Backlash on failure.' },
    { id: 'invoker', label: 'Invoker (Patron\'s Symbol, 4 XP/Patron)', cost: 4, note: 'Ritual magic via symbols. Slow but flexible. Crack the Seal for emergencies.' },
    { id: 'cantor', label: 'Cantor (Cantor\'s Path, 8 XP)', cost: 8, note: 'Songs that mimic Low Rites. Accessible but corrupting. Requires Lore 1+, Performance 2+, Presence 2+.' },
    { id: 'summoner', label: 'Summoner (Pact-Whisperer 2 XP + Lesser Pactwright 2 XP)', cost: 4, note: 'Bind and command spirits. Powerful but requires Leash management.' },
    { id: 'witch', label: 'Witchcraft (Craft of the Hedge, 4 XP)', cost: 4, note: 'Threshold magic. Hedge Gifts + Quick Workings + Full Rituals. Identity Strain track.' }
];

const ARMOR_TYPES = [
    { id: 'none', label: 'No Armor', xpCost: 0, conversion: 'Harm passes directly' },
    { id: 'light', label: 'Light Armor (4 XP)', xpCost: 4, conversion: '1→1 Fatigue (min 1/hit)' },
    { id: 'medium', label: 'Medium Armor (8 XP)', xpCost: 8, conversion: '2→1 Fatigue (min 1/hit)', penalty: '−1d physical skills' },
    { id: 'heavy', label: 'Heavy Armor (12 XP)', xpCost: 12, conversion: '3→2 Fatigue (min 1/hit)', penalty: '−2d physical, no sprint in rough' }
];

const SHIELD_TYPES = [
    { id: 'none', label: 'No Shield', xpCost: 0 },
    { id: 'buckler', label: 'Buckler (4 XP)', xpCost: 4 },
    { id: 'heater', label: 'Heater (8 XP)', xpCost: 8 },
    { id: 'pavise', label: 'Pavise (12 XP)', xpCost: 12 }
];

const WEAPON_CLASSES = [
    { id: 'light', label: 'Light Weapon (4 XP)', xpCost: 4, close: '+2d', near: '+1d', note: 'Fast, concealable. Free if basic.' },
    { id: 'medium', label: 'Medium Weapon (8 XP)', xpCost: 8, close: '+1d', near: '+2d', note: 'Balanced, battlefield standard.' },
    { id: 'heavy', label: 'Heavy Weapon (12 XP)', xpCost: 12, close: '−1d', near: '+3d', note: 'Punishing, slow. Set once/scene.' }
];

const REGIONS = [
    '', 'Acasia', 'Aelaerem', 'Aeler', 'Aelinnel', 'Black Banners', 'Ecktoria',
    'Linn', 'Mistlands', 'Silkstrand', 'Theona', 'Thepyrgos', 'Ubral',
    'Valewood', 'Vhasia', 'Viterra', 'Ykrul', 'Zakov', 'Vilikari',
    'Kahfagia', 'Fhara', 'Pereshi', 'Kuvani', 'Tulkani', 'Ashaan',
    'Sekogo', 'Taharka', 'Sidhi', 'Ngomebe', 'Dhahara', 'Oshiira'
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

const STARTING_GEAR = [
    'One set of clothing appropriate to your culture',
    'A Light melee weapon or ranged weapon with ammunition',
    'Light armor (if your concept demands it)',
    'A backpack, waterskin, 1d6 days of rations',
    'Utility knife, flint and steel, small lantern or candle',
    'Any tools required for your skills (lockpicks, healer\'s kit, writing materials)'
];

function defaultSkills() {
    const skills = {};
    ALL_SKILLS.forEach(s => skills[s.toLowerCase()] = 0);
    return skills;
}

function getTierFromXp(xp) {
    for (const t of TIER_THRESHOLDS) {
        if (xp >= t.min && xp <= t.max) return t;
    }
    return TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
}

// ─── XP Calculation Helpers ────────────────────────────────────────

function calculateAttributeCost(fromRating, toRating) {
    let cost = 0;
    for (let i = fromRating + 1; i <= toRating; i++) cost += i * 3;
    return cost;
}

function calculateSkillCost(fromLevel, toLevel) {
    let cost = 0;
    for (let i = fromLevel + 1; i <= toLevel; i++) cost += i * 2;
    return cost;
}

function calculateTotalXpSpent(d) {
    let spent = 0;
    spent += calculateAttributeCost(1, d.body || 1);
    spent += calculateAttributeCost(1, d.wits || 1);
    spent += calculateAttributeCost(1, d.spirit || 1);
    spent += calculateAttributeCost(1, d.presence || 1);
    if (d.skills) {
        ALL_SKILLS.forEach(s => {
            spent += calculateSkillCost(0, d.skills[s.toLowerCase()] || 0);
        });
    }
    if (d.talents) d.talents.forEach(t => spent += safeParseInt(t.cost, 0));
    if (d.assets) d.assets.forEach(a => spent += safeParseInt(a.cost, 0));
    if (d.equipment) d.equipment.forEach(e => spent += safeParseInt(e.cost, 0));
    // Magic path cost
    const path = MAGIC_PATHS.find(p => p.id === (d.magicPath || 'none'));
    if (path) spent += path.cost;
    // Armor
    const armor = ARMOR_TYPES.find(a => a.id === (d.armorType || 'none'));
    if (armor) spent += armor.xpCost;
    // Shield
    const shield = SHIELD_TYPES.find(s => s.id === (d.shieldType || 'none'));
    if (shield) spent += shield.xpCost;
    // Weapon (basic light weapon is free)
    const weapon = WEAPON_CLASSES.find(w => w.id === (d.weaponClass || 'light'));
    if (weapon && d.weaponClass !== 'light') spent += weapon.xpCost;
    return spent;
}

function calculateStartingXp(d) {
    const bondCount = Math.min((d.bonds || []).filter(b => b.start).length, 2);
    const compCount = Math.min((d.complications || []).filter(c => c.start).length, 2);
    return Math.min(32 + bondCount * 2 + compCount * 2, 36);
}

// ─── State ─────────────────────────────────────────────────────────

const state = {
    step: 0,
    data: null,
    isOpen: false,
    modal: null,
    _listeners: [],
};

// ─── Modal CSS ──────────────────────────────────────────────────────

function injectModalStyles() {
    if (document.getElementById('wizard-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'wizard-modal-styles';
    style.textContent = `
        #wizardModal {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 10000;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            animation: wizardFadeIn 0.25s ease;
        }
        #wizardModal.open { display: flex; }
        @keyframes wizardFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .wizard-overlay { position: absolute; inset: 0; cursor: pointer; }
        .wizard-content {
            position: relative;
            background: var(--bg, #1e1e2e);
            color: var(--text, #e0e0e0);
            border-radius: 12px;
            max-width: 780px;
            width: 92%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 1.5rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.7);
            border: 1px solid var(--border, #333);
        }
        .wizard-progress-step {
            flex: 1;
            height: 4px;
            background: var(--border, #444);
            border-radius: 2px;
            transition: background 0.3s;
        }
        .wizard-progress-step.active { background: var(--gold, #c9a84c); }
        .dynamic-row {
            display: flex;
            gap: 0.3rem;
            margin: 0.2rem 0;
            align-items: center;
            flex-wrap: wrap;
        }
        .dynamic-row input[type="text"] { flex: 1; min-width: 100px; }
        .dynamic-row input[type="number"] { width: 60px; }
        .wizard-remove-btn {
            padding: 0 0.4rem;
            background: transparent;
            border: none;
            color: var(--text2, #aaa);
            cursor: pointer;
            font-size: 1.2rem;
        }
        .wizard-remove-btn:hover { color: var(--red, #e74c3c); }
        .stat-item {
            background: var(--bg2, #2a2a2a);
            padding: 0.5rem;
            border-radius: 8px;
            text-align: center;
        }
        .field-hint { color: var(--text3, #888); font-size: 0.75rem; }
        .text-muted { color: var(--text2, #aaa); }
        .btn-sm { font-size: 0.8rem; padding: 0.2rem 0.6rem; }
        .btn-xs { font-size: 0.7rem; padding: 0.1rem 0.3rem; }
        .xp-budget-bar {
            padding: 0.5rem 0.8rem;
            border-radius: 6px;
            margin: 0.5rem 0;
            font-size: 0.85rem;
            border: 1px solid;
        }
        .xp-budget-ok {
            background: rgba(50,255,50,0.08);
            border-color: var(--green, #4caf50);
        }
        .xp-budget-over {
            background: rgba(255,50,50,0.1);
            border-color: var(--red, #e74c3c);
        }
        .info-box {
            background: var(--bg2, #2a2a2a);
            padding: 0.6rem 0.8rem;
            border-radius: 6px;
            border-left: 3px solid var(--gold, #c9a84c);
            margin: 0.5rem 0;
            font-size: 0.8rem;
            color: var(--text2, #aaa);
        }
        .heritage-note {
            font-size: 0.75rem;
            color: var(--text3, #888);
            margin-top: 0.2rem;
            padding: 0.3rem 0.5rem;
            background: rgba(255,255,255,0.03);
            border-radius: 4px;
            border-left: 2px solid var(--gold, #c9a84c);
        }
        /* Talent catalog within wizard */
        .talent-catalog {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            background: var(--bg2);
            margin-bottom: 0.5rem;
        }
        .talent-catalog-item {
            display: flex;
            align-items: center;
            padding: 0.3rem 0.5rem;
            font-size: 0.8rem;
            border-bottom: 1px solid var(--border);
        }
        .talent-catalog-item:last-child { border-bottom: none; }
        .talent-catalog-item .talent-info { flex: 1; }
        .talent-catalog-item .btn-xs { margin-left: 0.3rem; }
    `;
    document.head.appendChild(style);
}

// ─── Modal Creation ────────────────────────────────────────────────

function ensureModal() {
    let modal = document.getElementById('wizardModal');
    if (modal) return modal;

    injectModalStyles();

    modal = document.createElement('div');
    modal.id = 'wizardModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="wizard-overlay"></div>
        <div class="wizard-content">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h3 id="wizard-title" style="margin:0;">Character Wizard</h3>
                <button id="wizardModalClose" style="font-size:1.8rem;line-height:1;padding:0 0.3rem;background:none;border:none;color:var(--text2);cursor:pointer;">&times;</button>
            </div>
            <div id="wizard-progress" style="display:flex;gap:0.5rem;margin-bottom:1.2rem;justify-content:center;">
                ${[1,2,3,4,5].map(() => `<div class="wizard-progress-step"></div>`).join('')}
            </div>
            <div id="wizard-steps"></div>
            <div style="display:flex;justify-content:space-between;margin-top:1.2rem;padding-top:0.8rem;border-top:1px solid var(--border, #444);">
                <button id="wizard-back" class="btn btn-secondary">← Back</button>
                <button id="wizard-next" class="btn btn-gold">Next →</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

// ─── Event Helpers ──────────────────────────────────────────────────

function clearListeners() {
    state._listeners.forEach(({ el, event, fn }) => el.removeEventListener(event, fn));
    state._listeners = [];
}

function addListener(el, event, fn) {
    if (!el) return;
    el.addEventListener(event, fn);
    state._listeners.push({ el, event, fn });
}

// ─── Public API ─────────────────────────────────────────────────────

export function openWizard() {
    try {
        const modal = ensureModal();
        state.modal = modal;

        state.data = {
            id: generateId(),
            name: '',
            heritage: 'human',
            heritageNote: HERITAGES.find(h => h.id === 'human')?.note || '',
            region: '',
            culturalAffinity: '',
            background: '',
            backgroundTags: '',
            backgroundContact: '',
            backgroundBoon: '',
            backgroundObligation: '',
            patron: '',
            magicPath: 'none',
            magicPathNote: MAGIC_PATHS.find(p => p.id === 'none')?.note || '',
            tier: 'I',
            tierName: 'Novice',
            totalXp: 32,
            startingXp: 32,
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
            harm: 0,
            fatigue: 0,
            fatigueMax: 1,
            boons: 0,
            obligation: 0,
            obligationCapacity: 2,
            corruption: 0,
            corruptionMax: 1,
            leash: 0,
            mentalStrain: 0,
            armorType: 'none',
            shieldType: 'none',
            weaponClass: 'light',
            armorConversion: 'Harm passes directly',
            vtt: true,
            _stepDataCollected: {},
        };
        state.step = 0;
        state.isOpen = true;

        modal.classList.add('open');
        modal.style.display = 'flex';

        renderStep();
        attachEvents();
    } catch (err) {
        console.error('[Wizard] openWizard error:', err);
        showToast('Could not open the character wizard: ' + (err.message || err), 'error');
    }
}

export function closeWizard() {
    state.isOpen = false;
    clearListeners();
    const modal = state.modal || document.getElementById('wizardModal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
    }
    state.data = null;
    state.step = 0;
}

export function wizardBack() {
    if (state.step > 0 && state.data) {
        collectStepData();
        state.step--;
        renderStep();
    }
}

export function wizardNext() {
    if (!state.data) {
        showToast('Wizard not initialized.', 'error');
        return;
    }
    if (!collectStepData()) return;
    if (state.step < 4) {
        state.step++;
        renderStep();
    } else {
        finishWizard();
    }
}

// ─── Data Collection ────────────────────────────────────────────────

function collectStepData() {
    const d = state.data;
    if (!d) return false;

    try {
        switch (state.step) {
            case 0: return collectIdentity(d);
            case 1: return collectAttributes(d);
            case 2: return collectSkills(d);
            case 3: return collectTalentsAndLoadout(d);
            default: return collectBondsAndFinish(d);
        }
    } catch (err) {
        console.error('[Wizard] collect error:', err);
        showToast('Error collecting data. Try again.', 'error');
        return false;
    }
}

function collectIdentity(d) {
    const nameInput = document.querySelector('#wz-name');
    const name = nameInput?.value.trim() || '';
    if (!name) {
        showToast('Character name is required.', 'error');
        if (nameInput) {
            nameInput.style.borderColor = 'var(--red)';
            nameInput.focus();
            setTimeout(() => nameInput.style.borderColor = '', 3000);
        }
        return false;
    }
    d.name = name;
    d.heritage = getVal('#wz-heritage') || 'human';
    const heritage = HERITAGES.find(h => h.id === d.heritage);
    d.heritageNote = heritage?.note || '';
    d.region = getVal('#wz-region');
    d.culturalAffinity = getVal('#wz-cultural-affinity');
    d.background = getVal('#wz-background');
    d.backgroundTags = getVal('#wz-background-tags');
    d.backgroundContact = getVal('#wz-background-contact');
    d.backgroundBoon = getVal('#wz-background-boon');
    d.backgroundObligation = getVal('#wz-background-obligation');
    d._stepDataCollected[0] = true;
    return true;
}

function collectAttributes(d) {
    d.body = clamp(getNum('#wz-body'), 1, 5);
    d.wits = clamp(getNum('#wz-wits'), 1, 5);
    d.spirit = clamp(getNum('#wz-spirit'), 1, 5);
    d.presence = clamp(getNum('#wz-presence'), 1, 5);
    d.fatigueMax = d.body;
    d.obligationCapacity = d.spirit + d.presence;
    d.corruptionMax = d.spirit;
    d._stepDataCollected[1] = true;
    return true;
}

function collectSkills(d) {
    if (!d.skills) d.skills = defaultSkills();
    ALL_SKILLS.forEach(s => {
        const key = s.toLowerCase();
        const val = getNum(`#wz-sk-${key}`);
        d.skills[key] = clamp(val, 0, 5);
    });
    d._stepDataCollected[2] = true;
    return true;
}

function collectTalentsAndLoadout(d) {
    d.talents = readTalentListFromDOM();   // now reads both catalog & custom rows
    d.assets = readDynamicList('wz-asset');
    d.equipment = readDynamicList('wz-equip');
    d.magicPath = getVal('#wz-magic-path') || 'none';
    const path = MAGIC_PATHS.find(p => p.id === d.magicPath);
    d.magicPathNote = path?.note || '';
    d.patron = getVal('#wz-patron');
    d.armorType = getVal('#wz-armor-type') || 'none';
    d.shieldType = getVal('#wz-shield-type') || 'none';
    d.weaponClass = getVal('#wz-weapon-class') || 'light';
    const armor = ARMOR_TYPES.find(a => a.id === d.armorType);
    d.armorConversion = armor?.conversion || '';
    d._stepDataCollected[3] = true;
    return true;
}

function collectBondsAndFinish(d) {
    d.bonds = readBondList();
    d.complications = readCompList();
    d._stepDataCollected[4] = true;
    
    // Calculate starting XP
    const bondCount = Math.min(d.bonds.filter(b => b.start).length, 2);
    const compCount = Math.min(d.complications.filter(c => c.start).length, 2);
    d.startingXp = Math.min(32 + bondCount * 2 + compCount * 2, 36);
    
    // Calculate XP spent
    const spent = calculateTotalXpSpent(d);
    
    if (spent > d.startingXp) {
        const over = spent - d.startingXp;
        showToast(`Character is ${over} XP over budget (${spent} spent, ${d.startingXp} available). You can still save — GM may allow.`, 'warning');
    }
    
    return true;
}

// ─── Helpers ────────────────────────────────────────────────────────

function getVal(selector) {
    const el = document.querySelector(selector);
    return el ? el.value : '';
}
function getNum(selector) {
    const el = document.querySelector(selector);
    return el ? safeParseInt(el.value, 0) : 0;
}

function readDynamicList(prefix) {
    const items = [];
    document.querySelectorAll(`.${prefix}-row`).forEach(row => {
        const nameInput = row.querySelector(`.${prefix}-name`) || row.querySelector('input[type="text"]');
        const costInput = row.querySelector(`.${prefix}-cost`) || row.querySelector('input[type="number"]');
        const name = nameInput?.value.trim() || '';
        const cost = costInput ? safeParseInt(costInput.value, 0) : 0;
        if (name) items.push({ name, cost });
    });
    return items;
}

/**
 * Reads the talent list from the DOM, handling both catalog (read-only) and custom rows.
 */
function readTalentListFromDOM() {
    const items = [];
    document.querySelectorAll('.wz-talent-row').forEach(row => {
        const nameEl = row.querySelector('.wz-talent-name');
        const costEl = row.querySelector('.wz-talent-cost');
        const name = nameEl ? (nameEl.tagName === 'INPUT' ? nameEl.value.trim() : nameEl.textContent.trim()) : '';
        const cost = costEl ? safeParseInt(costEl.value || costEl.textContent, 0) : 0;
        if (name) items.push({ name, cost });
    });
    return items;
}

function readBondList() {
    const items = [];
    let count = 0;
    document.querySelectorAll('.wz-bond-row').forEach(row => {
        const name = row.querySelector('.wz-bond-name')?.value.trim() || '';
        if (!name) return;
        const startChecked = row.querySelector('.wz-bond-start')?.checked || false;
        const givesXp = startChecked && count < 2;
        if (givesXp) count++;
        items.push({
            name,
            desc: row.querySelector('.wz-bond-desc')?.value.trim() || '',
            start: givesXp,
        });
    });
    return items;
}

function readCompList() {
    const items = [];
    let count = 0;
    document.querySelectorAll('.wz-comp-row').forEach(row => {
        const name = row.querySelector('.wz-comp-name')?.value.trim() || '';
        if (!name) return;
        const startChecked = row.querySelector('.wz-comp-start')?.checked || false;
        const givesXp = startChecked && count < 2;
        if (givesXp) count++;
        items.push({
            name,
            desc: row.querySelector('.wz-comp-desc')?.value.trim() || '',
            start: givesXp,
        });
    });
    return items;
}

// ─── Finish ────────────────────────────────────────────────────────

function finishWizard() {
    const d = state.data;
    if (!d) {
        showToast('No character data to save.', 'error');
        return;
    }
    if (!d.name || !d.name.trim()) {
        showToast('Character name is required.', 'error');
        state.step = 0;
        renderStep();
        return;
    }

    // Final XP calculation
    const bondCount = Math.min((d.bonds || []).filter(b => b.start).length, 2);
    const compCount = Math.min((d.complications || []).filter(c => c.start).length, 2);
    d.startingXp = Math.min(32 + bondCount * 2 + compCount * 2, 36);
    d.totalXp = d.startingXp;
    
    // Auto-calculate tier
    const tierInfo = getTierFromXp(d.totalXp);
    d.tier = tierInfo.tier;
    d.tierName = tierInfo.name;

    // Derived stats
    d.fatigueMax = d.body;
    d.obligationCapacity = d.spirit + d.presence;
    d.corruptionMax = d.spirit;
    d.mentalStrainMax = d.spirit;
    
    // XP spent tracking
    d.xpSpent = calculateTotalXpSpent(d);

    const pushCheck = document.getElementById('wz-push-vtt');
    if (pushCheck) d.vtt = pushCheck.checked;

    // Warn if overspent but allow save
    if (d.xpSpent > d.startingXp) {
        const proceed = confirm(
            `This character is ${d.xpSpent - d.startingXp} XP over budget.\n` +
            `Spent: ${d.xpSpent} XP | Available: ${d.startingXp} XP\n\n` +
            `Save anyway? (GM may allow overspend.)`
        );
        if (!proceed) return;
    }

    try {
        addCharacter(d);
        showToast(`✨ "${d.name}" created! Tier ${d.tier} (${d.tierName}), ${d.totalXp} XP.`, 'success');
        closeWizard();

        import('./index.js')
            .then(mod => { if (mod.renderCharList) mod.renderCharList(); })
            .catch(() => {});

        if (d.vtt) {
            const vttBtn = document.querySelector('.sidebar-nav button[data-tab="vtt"]');
            if (vttBtn) setTimeout(() => vttBtn.click(), 300);
        }
    } catch (err) {
        console.error('[Wizard] Save error:', err);
        showToast('Error saving character. Please try again.', 'error');
    }
}

// ─── Rendering ──────────────────────────────────────────────────────

function renderStep() {
    const d = state.data;
    if (!d) return;

    const stepsEl = document.getElementById('wizard-steps');
    const nextBtn = document.getElementById('wizard-next');
    const backBtn = document.getElementById('wizard-back');
    const titleEl = document.getElementById('wizard-title');

    if (!stepsEl || !nextBtn || !backBtn) return;

    const stepNames = ['Identity', 'Attributes', 'Skills', 'Talents & Loadout', 'Bonds & Summary'];
    titleEl.textContent = `Character Wizard — Step ${state.step + 1}: ${stepNames[state.step]}`;
    backBtn.style.display = state.step === 0 ? 'none' : 'inline-block';
    nextBtn.textContent = state.step === 4 ? '✨ Finish' : 'Next →';

    document.querySelectorAll('.wizard-progress-step').forEach((el, idx) => {
        el.style.background = idx <= state.step ? 'var(--gold)' : 'var(--border)';
    });

    let html = '';
    try {
        switch (state.step) {
            case 0: html = renderStep0Identity(d); break;
            case 1: html = renderStep1Attributes(d); break;
            case 2: html = renderStep2Skills(d); break;
            case 3: html = renderStep3TalentsAndLoadout(d); break;
            case 4: html = renderStep4BondsAndSummary(d); break;
            default: html = '<p>Unknown step</p>';
        }
    } catch (err) {
        console.error('[Wizard] Render error:', err);
        html = '<p class="error">Error rendering step. Please refresh.</p>';
    }
    stepsEl.innerHTML = html;

    // Post-render hooks
    if (state.step === 1) attachAttributeListeners();
    if (state.step === 2) attachSkillListeners();
    if (state.step === 3) renderTalentCatalog();   // render catalog after DOM exists
    if (state.step === 4) updateSummaryDisplay();

    const firstInput = stepsEl.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

// ─── XP Budget Display ─────────────────────────────────────────────

function renderXpBudget(d) {
    const spent = calculateTotalXpSpent(d);
    const starting = calculateStartingXp(d);
    const remaining = starting - spent;
    const isOver = remaining < 0;
    
    return `
        <div class="xp-budget-bar ${isOver ? 'xp-budget-over' : 'xp-budget-ok'}">
            <strong>XP Budget:</strong> ${starting} available − ${spent} spent = 
            <span style="color:${isOver ? 'var(--red)' : 'var(--green)'};font-weight:bold;">
                ${remaining > 0 ? remaining + ' remaining' : remaining === 0 ? 'exactly spent' : Math.abs(remaining) + ' OVER!'}
            </span>
        </div>
    `;
}

// ─── Step Renderers ────────────────────────────────────────────────

function renderStep0Identity(d) {
    const heritageOptions = HERITAGES.map(h => 
        `<option value="${h.id}" ${d.heritage === h.id ? 'selected' : ''}>${escHtml(h.label)}</option>`
    ).join('');
    
    const regionOptions = REGIONS.map(r => 
        `<option value="${r}" ${d.region === r ? 'selected' : ''}>${r || 'Select region…'}</option>`
    ).join('');
    
    const heritage = HERITAGES.find(h => h.id === d.heritage);
    
    return `
        <div>
            <h3 style="margin-top:0;">🪪 Step 1 — Identity & Concept</h3>
            <div class="info-box">
                Write one sentence describing your character's origin, profession, and one defining trait.
                Choose your ancestry — each heritage provides attribute adjustments and special abilities.
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-top:0.5rem;">
                <div>
                    <label>Name <span style="color:var(--red);">*</span></label>
                    <input id="wz-name" value="${escHtml(d.name)}" placeholder="Enter character name..." autofocus />
                    <span class="field-hint">Required</span>
                </div>
                <div>
                    <label>Heritage / Ancestry</label>
                    <select id="wz-heritage">${heritageOptions}</select>
                    <div class="heritage-note" id="wz-heritage-note">
                        <strong>Adjustments:</strong> ${escHtml(heritage?.adj || 'None')}<br>
                        ${escHtml(heritage?.note || '')}
                    </div>
                </div>
                <div>
                    <label>Region of Origin</label>
                    <select id="wz-region">${regionOptions}</select>
                    <span class="field-hint">Grants a once-per-session cultural benefit</span>
                </div>
                <div>
                    <label>Cultural Affinity</label>
                    <input id="wz-cultural-affinity" value="${escHtml(d.culturalAffinity || '')}" placeholder="Specific cultural trait or benefit" />
                </div>
            </div>
            
            <h4 style="margin:0.8rem 0 0.3rem;">Background</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Backgrounds provide: 2 Access Tags, 1 Signature Contact (+1d assist once/scene), 
                1 Background Boon (+1d or DV−1 once/session), 1 Obligation Timer [4] (starting complication).
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Background Name</label>
                    <input id="wz-background" value="${escHtml(d.background || '')}" placeholder="e.g., Marcher Veteran, Merchant Factor" />
                </div>
                <div>
                    <label>Background Tags</label>
                    <input id="wz-background-tags" value="${escHtml(d.backgroundTags || '')}" placeholder="e.g., Veteran-of-the-Marches, Muster Papers" />
                </div>
                <div>
                    <label>Signature Contact</label>
                    <input id="wz-background-contact" value="${escHtml(d.backgroundContact || '')}" placeholder="Named NPC (Cap 1, +1d assist)" />
                </div>
                <div>
                    <label>Background Boon</label>
                    <input id="wz-background-boon" value="${escHtml(d.backgroundBoon || '')}" placeholder="Once/session: +1d or DV−1" />
                </div>
                <div style="grid-column:1/-1;">
                    <label>Obligation Timer [4] Seed</label>
                    <input id="wz-background-obligation" value="${escHtml(d.backgroundObligation || '')}" placeholder="Starting complication: what debt follows you?" />
                </div>
            </div>
        </div>
    `;
}

function renderStep1Attributes(d) {
    const attrs = [
        { id: 'body', name: 'Body', desc: 'Physical strength, endurance, coordination', skills: 'Melee, Unarmed, Athletics, Endurance' },
        { id: 'wits', name: 'Wits', desc: 'Mental acuity, perception, quick thinking', skills: 'Ranged, Stealth, Craft, Subterfuge, Lore, Investigation, Medicine' },
        { id: 'spirit', name: 'Spirit', desc: 'Willpower, intuition, magical aptitude', skills: 'Insight, Arcana' },
        { id: 'presence', name: 'Presence', desc: 'Charisma, social influence, force of personality', skills: 'Sway, Deception, Performance' }
    ];
    
    const xpBudget = renderXpBudget(d);
    
    return `
        <div>
            <h3 style="margin-top:0;">⚡ Step 2 — Attributes (1–5)</h3>
            <div class="info-box">
                <strong>Cost:</strong> Each step costs new rating × 3 XP. Base is 1 each.
                <br>1→2 = 6 XP | 2→3 = 9 XP | 3→4 = 12 XP | 4→5 = 15 XP
                <br><strong>Recommended:</strong> Primary attribute at 3 (15 XP), secondary at 2 (6 XP each).
            </div>
            ${xpBudget}
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.6rem;margin-top:0.5rem;">
                ${attrs.map(attr => {
                    const val = d[attr.id] ?? 1;
                    const cost = calculateAttributeCost(1, val);
                    return `
                        <div class="stat-item" style="text-align:left;">
                            <label style="font-weight:600;font-size:0.9rem;">${attr.name}</label>
                            <input type="number" id="wz-${attr.id}" value="${val}" min="1" max="5" 
                                style="width:100%;text-align:center;font-size:1.2rem;" 
                                data-attr="${attr.id}" />
                            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">
                                ${attr.desc}
                            </div>
                            <div style="font-size:0.7rem;color:var(--gold);margin-top:0.2rem;" id="wz-${attr.id}-cost">
                                ${val > 1 ? `${cost} XP spent` : 'Base (free)'}
                            </div>
                            <div style="font-size:0.65rem;color:var(--text3);">
                                Skills: ${attr.skills}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="info-box" style="margin-top:0.5rem;">
                <strong>Derived Stats:</strong>
                Fatigue Track = Body (${d.body || 1}) |
                Obligation Capacity = Spirit + Presence (${(d.spirit || 1) + (d.presence || 1)}) |
                Corruption Timer = Spirit (${d.spirit || 1})
            </div>
        </div>
    `;
}

function renderStep2Skills(d) {
    const xpBudget = renderXpBudget(d);
    
    const skillsHtml = ALL_SKILLS.map(s => {
        const key = s.toLowerCase();
        const val = d.skills?.[key] ?? 0;
        const attrId = SKILL_ATTRIBUTES[key] || 'wits';
        const attrName = attrId.charAt(0).toUpperCase() + attrId.slice(1);
        const attrVal = d[attrId] || 1;
        const cost = calculateSkillCost(0, val);
        const capped = val > attrVal;
        
        return `
            <div style="display:flex;align-items:center;gap:0.3rem;background:var(--bg2);padding:0.2rem 0.4rem;border-radius:4px;${capped ? 'border:1px solid var(--red);' : ''}">
                <div style="flex:1;">
                    <label style="font-size:0.85rem;font-weight:500;">${escHtml(s)}</label>
                    <div style="font-size:0.65rem;color:var(--text3);">${attrName}</div>
                </div>
                <input type="number" id="wz-sk-${key}" value="${val}" min="0" max="5" 
                    style="width:45px;text-align:center;" data-skill="${key}" data-attr="${attrId}" />
                <div style="font-size:0.65rem;color:var(--gold);width:50px;text-align:right;" id="wz-sk-${key}-cost">
                    ${val > 0 ? `${cost}XP` : '—'}
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div>
            <h3 style="margin-top:0;">📚 Step 3 — Skills (0–5)</h3>
            <div class="info-box">
                <strong>Cost:</strong> Each step costs new level × 2 XP. Base is 0.
                <br>0→1 = 2 XP | 1→2 = 4 XP | 2→3 = 6 XP | 3→4 = 8 XP | 4→5 = 10 XP
                <br><strong>Cap:</strong> Skill rating cannot exceed its primary Attribute.
                <br><strong>Recommended:</strong> Key skills at 2–3, others at 0–1. Spend 8–12 XP on skills.
            </div>
            ${xpBudget}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.4rem;margin-top:0.3rem;">
                ${skillsHtml}
            </div>
            <div style="font-size:0.75rem;color:var(--text3);margin-top:0.5rem;">
                ⚠ Red border = skill exceeds its Attribute cap (GM may allow). 
                Dice Pool = Attribute + Skill. Recommended: keep key skills at 2–3 for 5-die pools.
            </div>
        </div>
    `;
}

// ─── Talent Catalog Helpers ──────────────────────────────────────

/**
 * Returns combined list of talents from state (local + wiki) that
 * are valid for the current character tier.
 */
function getAvailableTalentsForTier(d) {
    const appState = getState();
    const localTalents = appState.talents || [];
    const wikiEntries = appState.wikiEntries || [];
    const wikiTalents = wikiEntries.filter(e => e.category === 'talents' || e.category === 'talent');

    const allTalents = [
        ...localTalents.map(t => ({ ...t, source: 'local' })),
        ...wikiTalents.map(t => ({ ...t, name: t.title, description: t.body || t.description, source: 'wiki' }))
    ];

    const spent = calculateTotalXpSpent(d);
    const tier = getTierFromXp(spent).tier;   // 'I', 'II', etc.

    let allowedTiers = [];
    if (tier === 'I') allowedTiers = ['minor'];
    else if (tier === 'II') allowedTiers = ['minor', 'major'];
    else allowedTiers = ['minor', 'major', 'prestige', 'epic'];   // III+

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
    const catalogContainer = document.getElementById('wz-talent-catalog');
    if (!catalogContainer || !state.data) return;

    const available = getAvailableTalentsForTier(state.data);
    if (available.length === 0) {
        catalogContainer.innerHTML = '<div class="text-muted" style="padding:0.5rem;">No talents available for your current tier.</div>';
        return;
    }

    catalogContainer.innerHTML = available.map(t => {
        const cost = safeParseInt(t.cost, 0);
        const tierObj = TALENT_TIERS.find(ti => cost >= ti.min && cost <= ti.max);
        const tierLabel = tierObj ? tierObj.label : '?';
        return `
            <div class="talent-catalog-item">
                <div class="talent-info">
                    <span style="font-weight:500;">${escHtml(t.name)}</span>
                    <span style="color:var(--gold); margin-left:0.3rem;">${cost} XP</span>
                    <span style="color:var(--text3); font-size:0.75rem; margin-left:0.3rem;">(${tierLabel})</span>
                    ${t.description ? `<div style="color:var(--text2); font-size:0.7rem;">${escHtml(t.description)}</div>` : ''}
                </div>
                <button class="btn btn-xs btn-primary catalog-add-btn" data-name="${escHtml(t.name)}" data-cost="${cost}">Add</button>
            </div>
        `;
    }).join('');
}

/**
 * Adds a talent (from catalog) as a read-only row to the character's talent list.
 */
export function addTalentFromCatalog(name, cost) {
    const listEl = document.getElementById('wz-talent-list');
    if (!listEl || !state.data) return;

    const row = document.createElement('div');
    row.className = 'dynamic-row wz-talent-row';
    row.innerHTML = `
        <span class="wz-talent-name" style="flex:2; padding:0.2rem;">${escHtml(name)}</span>
        <span class="wz-talent-cost" style="width:60px; text-align:center;">${cost}</span>
        <button class="wizard-remove-btn">✕</button>
    `;
    listEl.appendChild(row);

    // Update data and budget
    if (state.data.talents) {
        state.data.talents.push({ name, cost });
    }
    updateXpBudgetFromDOM();
    if (state.step === 4) setTimeout(updateSummaryDisplay, 50);
}

/**
 * Add a custom (editable) talent row.
 */
export function addCustomTalentRow() {
    const listEl = document.getElementById('wz-talent-list');
    if (!listEl) return;

    const row = document.createElement('div');
    row.className = 'dynamic-row wz-talent-row';
    row.innerHTML = `
        <input type="text" class="wz-talent-name" placeholder="Talent name" style="flex:2;" />
        <input type="number" class="wz-talent-cost" placeholder="XP" value="0" min="0" style="width:60px;" />
        <button class="wizard-remove-btn">✕</button>
    `;
    listEl.appendChild(row);
    const nameInput = row.querySelector('input[type="text"]');
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
}

// ─── Step 3 Renderer (updated) ──────────────────────────────────

function renderStep3TalentsAndLoadout(d) {
    const xpBudget = renderXpBudget(d);
    
    const magicPathOptions = MAGIC_PATHS.map(p => 
        `<option value="${p.id}" ${d.magicPath === p.id ? 'selected' : ''}>${escHtml(p.label)}</option>`
    ).join('');
    
    const patronOptions = PATRONS.map(p => 
        `<option value="${p.id}" ${d.patron === p.id ? 'selected' : ''}>${escHtml(p.label)}</option>`
    ).join('');
    
    const armorOptions = ARMOR_TYPES.map(a => 
        `<option value="${a.id}" ${d.armorType === a.id ? 'selected' : ''}>${escHtml(a.label)}</option>`
    ).join('');
    
    const shieldOptions = SHIELD_TYPES.map(s => 
        `<option value="${s.id}" ${d.shieldType === s.id ? 'selected' : ''}>${escHtml(s.label)}</option>`
    ).join('');
    
    const weaponOptions = WEAPON_CLASSES.map(w => 
        `<option value="${w.id}" ${d.weaponClass === w.id ? 'selected' : ''}>${escHtml(w.label)}</option>`
    ).join('');
    
    const path = MAGIC_PATHS.find(p => p.id === d.magicPath);
    const weapon = WEAPON_CLASSES.find(w => w.id === d.weaponClass);
    
    // Talent rows (now with catalog rows rendered from data, custom rows will be added later)
    const talentRows = (d.talents || []).map((t, i) => {
        // Determine if it came from catalog (we'll assume any row not from catalog is custom editable)
        // For simplicity, we render all as editable for now; catalog rows are handled separately.
        // But since we now store talents as name+obj, we can display read-only if we know it's from catalog.
        // We'll just render them as read-only spans for consistency (they won't be editable unless we add a custom button).
        return `
            <div class="dynamic-row wz-talent-row">
                <span class="wz-talent-name" style="flex:2; padding:0.2rem;">${escHtml(t.name)}</span>
                <span class="wz-talent-cost" style="width:60px; text-align:center;">${t.cost}</span>
                <button class="wizard-remove-btn">✕</button>
            </div>
        `;
    }).join('');
    
    const assetRows = (d.assets || []).map((a, i) => dynamicRowHtml('wz-asset', i, a.name, a.cost)).join('');
    const equipRows = (d.equipment || []).map((e, i) => dynamicRowHtml('wz-equip', i, e.name, e.cost)).join('');
    
    return `
        <div>
            <h3 style="margin-top:0;">🧩 Step 4 — Talents, Magic & Loadout</h3>
            ${xpBudget}
            
            <!-- Magic Path -->
            <h4 style="margin:0.5rem 0 0.2rem;">🔮 Magic Path (Optional)</h4>
            <div class="info-box" style="font-size:0.75rem;">
                You don't need magic to be effective. A Body 3 + Melee 2 warrior rolls 5 dice with no talents.
                If you want magic, choose a path. Each path has different costs and risks.
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Magic Path</label>
                    <select id="wz-magic-path">${magicPathOptions}</select>
                    <div class="field-hint" id="wz-magic-path-note" style="margin-top:0.2rem;">${escHtml(path?.note || '')}</div>
                </div>
                <div>
                    <label>Patron</label>
                    <select id="wz-patron">${patronOptions}</select>
                    <div class="field-hint" style="margin-top:0.2rem;">${escHtml(PATRONS.find(p => p.id === d.patron)?.theme || '')}</div>
                </div>
            </div>
            
            <!-- Combat Loadout -->
            <h4 style="margin:0.8rem 0 0.2rem;">⚔️ Combat Loadout</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Starting gear (free): One set of clothing, a Light weapon, Light armor (if needed), 
                backpack, waterskin, 1d6 rations, utility knife, flint & steel, lantern/candle, 
                and tools for your skills.
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Armor</label>
                    <select id="wz-armor-type">${armorOptions}</select>
                    <div class="field-hint" id="wz-armor-info"></div>
                </div>
                <div>
                    <label>Shield</label>
                    <select id="wz-shield-type">${shieldOptions}</select>
                </div>
                <div>
                    <label>Weapon Class</label>
                    <select id="wz-weapon-class">${weaponOptions}</select>
                    <div class="field-hint" id="wz-weapon-info">${weapon?.note || ''} | Close: ${weapon?.close || ''} | Near: ${weapon?.near || ''}</div>
                </div>
            </div>
            
            <!-- Talents -->
            <h4 style="margin:0.8rem 0 0.2rem;">🧠 Talents</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Minor (2–3 XP): Small situational bonus | Major (4–6 XP): Strong upgrade | 
                Prestige (7–10 XP): Campaign-defining | Epic (11+ XP): Legendary.
                Start with 0–3 talents. Many concepts work perfectly with zero talents.
            </div>
            
            <!-- Catalog selection -->
            <div id="wz-talent-catalog" class="talent-catalog">
                <!-- populated by renderTalentCatalog() -->
            </div>
            
            <!-- Current talent list -->
            <div id="wz-talent-list">
                ${talentRows}
            </div>
            
            <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-sm btn-secondary" id="wz-add-custom-talent">✏️ Add Custom Talent</button>
            </div>
            
            <!-- Assets -->
            <h4 style="margin:0.8rem 0 0.2rem;">🏰 Assets (Optional)</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Minor Asset (4 XP): Safehouse, workshop, contact network | 
                Standard (8 XP): Guild seat, spy ring | Major (12 XP): Fortress, charter.
                Most starting characters skip these or take one minor asset.
            </div>
            <div id="wz-asset-list">${assetRows}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="wz-asset">+ Add Asset</button>
            
            <!-- Equipment -->
            <h4 style="margin:0.8rem 0 0.2rem;">🎒 Additional Equipment</h4>
            <div id="wz-equip-list">${equipRows}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="wz-equip">+ Add Equipment</button>
        </div>
    `;
}

function renderStep4BondsAndSummary(d) {
    const bondRows = (d.bonds || []).map((b, i) => bondRowHtml(i, b)).join('');
    const compRows = (d.complications || []).map((c, i) => compRowHtml(i, c)).join('');
    
    // Pre-calculate for summary
    const bondCount = Math.min((d.bonds || []).filter(b => b.start).length, 2);
    const compCount = Math.min((d.complications || []).filter(c => c.start).length, 2);
    const startingXp = Math.min(32 + bondCount * 2 + compCount * 2, 36);
    const spent = calculateTotalXpSpent(d);
    const remaining = startingXp - spent;
    
    const tier = getTierFromXp(startingXp);
    
    // Count skills with ranks
    const skilledCount = ALL_SKILLS.filter(s => (d.skills?.[s.toLowerCase()] || 0) > 0).length;
    
    return `
        <div>
            <h3 style="margin-top:0;">📋 Step 5 — Bonds, Complications & Summary</h3>
            
            <!-- Bonds -->
            <h4 style="margin:0.3rem 0 0.2rem;">🤝 Bonds</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Establish up to 2 bonds with other characters. Each bond grants <strong>+2 XP</strong> at creation (max +4 from bonds).
                In play: once per session per bond, act on it with intricate description → gain 1 Boon.
                At Tier III+: transfer up to 2 Boons to a bonded PC (once/scene).
            </div>
            <div id="wz-bond-list">${bondRows}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="wz-bond">+ Add Bond</button>
            
            <!-- Complications -->
            <h4 style="margin:0.8rem 0 0.2rem;">⚠️ Complications</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Take up to 2 complications (e.g., a feud, a cursed item, a debt). Each grants <strong>+2 XP</strong> at creation (max +4 from complications).
                <strong>Warning:</strong> Each unresolved starting Complication adds +1 banked Story Beat to early scenes.
                Maximum starting XP: <strong>36</strong> (32 base + 4 max from bonds/complications).
            </div>
            <div id="wz-comp-list">${compRows}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="wz-comp">+ Add Complication</button>
            
            <!-- Summary -->
            <h4 style="margin:1rem 0 0.3rem;">📊 Character Summary</h4>
            <div style="background:var(--bg2);padding:1rem;border-radius:var(--radius);">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
                    <div>
                        <h4 style="margin:0 0 0.2rem;">${escHtml(d.name || 'Unnamed')}</h4>
                        <p style="margin:0;font-size:0.9rem;color:var(--text2);">
                            ${escHtml(HERITAGES.find(h => h.id === d.heritage)?.label.split('—')[0] || '')}
                            ${d.region ? ' · ' + escHtml(d.region) : ''}
                            ${d.background ? ' · ' + escHtml(d.background) : ''}
                        </p>
                    </div>
                    <span style="background:${tier.color || 'var(--gold)'};color:#000;padding:0.2rem 0.8rem;border-radius:20px;font-weight:600;align-self:start;" id="wz-summary-tier">
                        Tier ${tier.tier}: ${tier.name}
                    </span>
                </div>
                <hr style="border-color:var(--border);margin:0.6rem 0;" />
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem 1rem;font-size:0.85rem;">
                    <div><span class="text-muted">Attributes:</span> B${d.body} W${d.wits} S${d.spirit} P${d.presence}</div>
                    <div><span class="text-muted">Skills with ranks:</span> ${skilledCount}/16</div>
                    <div><span class="text-muted">Magic Path:</span> ${escHtml(MAGIC_PATHS.find(p => p.id === d.magicPath)?.label.split('(')[0] || 'None')}</div>
                    <div><span class="text-muted">Patron:</span> ${escHtml(PATRONS.find(p => p.id === d.patron)?.label.split('—')[0] || 'None')}</div>
                    <div><span class="text-muted">Talents:</span> ${(d.talents || []).length}</div>
                    <div><span class="text-muted">Assets:</span> ${(d.assets || []).length}</div>
                    <div><span class="text-muted">Bonds:</span> ${(d.bonds || []).length} (${bondCount} for +XP)</div>
                    <div><span class="text-muted">Complications:</span> ${(d.complications || []).length} (${compCount} for +XP)</div>
                    <div><span class="text-muted">Armor:</span> ${escHtml(ARMOR_TYPES.find(a => a.id === d.armorType)?.label.split('(')[0] || 'None')}</div>
                    <div><span class="text-muted">Weapon:</span> ${escHtml(WEAPON_CLASSES.find(w => w.id === d.weaponClass)?.label.split('(')[0] || 'Light')}</div>
                </div>
                <hr style="border-color:var(--border);margin:0.6rem 0;" />
                <div class="xp-budget-bar ${remaining < 0 ? 'xp-budget-over' : 'xp-budget-ok'}" id="wz-summary-xp-bar">
                    <strong>Starting XP:</strong> <span id="wz-summary-xp">${startingXp}</span>
                    (32 base + ${bondCount * 2 + compCount * 2} bonus) |
                    <strong>Spent:</strong> <span id="wz-summary-spent">${spent}</span> |
                    <strong style="color:${remaining < 0 ? 'var(--red)' : 'var(--green)'};" id="wz-summary-remaining">
                        ${remaining > 0 ? remaining + ' remaining' : remaining === 0 ? 'exactly spent' : Math.abs(remaining) + ' OVER!'}
                    </strong>
                </div>
                <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-top:0.5rem;">
                    <label><input type="checkbox" id="wz-push-vtt" ${d.vtt ? 'checked' : ''} /> Push to VTT</label>
                </div>
            </div>
            <div class="info-box" style="margin-top:0.5rem;font-size:0.8rem;">
                <strong>Starting Gear (free):</strong> ${STARTING_GEAR.join(', ')}.
                <br><strong>Remember:</strong> Spend all starting XP — you cannot bank it.
            </div>
        </div>
    `;
}

// ─── Live Update Functions (unchanged, except added updateXpBudgetFromDOM) ──

function attachAttributeListeners() {
    ['body', 'wits', 'spirit', 'presence'].forEach(attr => {
        const input = document.getElementById(`wz-${attr}`);
        if (input) {
            input.addEventListener('input', () => {
                updateAttributeCost(attr);
                updateXpBudgetFromDOM();
                updateDerivedStats();
            });
        }
    });
}

function attachSkillListeners() {
    ALL_SKILLS.forEach(s => {
        const key = s.toLowerCase();
        const input = document.getElementById(`wz-sk-${key}`);
        if (input) {
            input.addEventListener('input', () => {
                updateSkillCost(key);
                updateXpBudgetFromDOM();
            });
        }
    });
}

function updateAttributeCost(attr) {
    const input = document.getElementById(`wz-${attr}`);
    const costEl = document.getElementById(`wz-${attr}-cost`);
    if (!input || !costEl) return;
    const val = safeParseInt(input.value, 1);
    const cost = calculateAttributeCost(1, val);
    costEl.textContent = val > 1 ? `${cost} XP spent` : 'Base (free)';
}

function updateSkillCost(skillKey) {
    const input = document.getElementById(`wz-sk-${skillKey}`);
    const costEl = document.getElementById(`wz-sk-${skillKey}-cost`);
    if (!input || !costEl) return;
    const val = safeParseInt(input.value, 0);
    const cost = calculateSkillCost(0, val);
    
    const attrId = SKILL_ATTRIBUTES[skillKey];
    const attrInput = document.getElementById(`wz-${attrId}`);
    const attrVal = attrInput ? safeParseInt(attrInput.value, 1) : 1;
    
    if (val > attrVal) {
        input.style.borderColor = 'var(--red)';
        costEl.style.color = 'var(--red)';
    } else {
        input.style.borderColor = '';
        costEl.style.color = 'var(--gold)';
    }
    
    costEl.textContent = val > 0 ? `${cost}XP` : '—';
}

function updateXpBudgetFromDOM() {
    if (!state.data) return;
    const d = state.data;
    // Re-read talents from DOM (handles read-only spans)
    d.talents = readTalentListFromDOM();
    // All other data remains as stored.
    const budgetEl = document.querySelector('.xp-budget-bar');
    if (budgetEl) {
        const spent = calculateTotalXpSpent(d);
        const starting = calculateStartingXp(d);
        const remaining = starting - spent;
        const isOver = remaining < 0;
        budgetEl.className = `xp-budget-bar ${isOver ? 'xp-budget-over' : 'xp-budget-ok'}`;
        budgetEl.innerHTML = `
            <strong>XP Budget:</strong> ${starting} available − ${spent} spent = 
            <span style="color:${isOver ? 'var(--red)' : 'var(--green)'};font-weight:bold;">
                ${remaining > 0 ? remaining + ' remaining' : remaining === 0 ? 'exactly spent' : Math.abs(remaining) + ' OVER!'}
            </span>
        `;
    }
}

function updateDerivedStats() {
    const body = safeParseInt(document.getElementById('wz-body')?.value, 1);
    const spirit = safeParseInt(document.getElementById('wz-spirit')?.value, 1);
    const presence = safeParseInt(document.getElementById('wz-presence')?.value, 1);
    const infoBox = document.querySelector('.info-box:last-of-type');
    if (infoBox && state.step === 1) {
        infoBox.innerHTML = `
            <strong>Derived Stats:</strong>
            Fatigue Track = Body (${body}) |
            Obligation Capacity = Spirit + Presence (${spirit + presence}) |
            Corruption Timer = Spirit (${spirit})
        `;
    }
}

function updateSummaryDisplay() {
    if (!state.data || state.step !== 4) return;
    const d = state.data;
    d.talents = readTalentListFromDOM();
    d.bonds = readBondList();
    d.complications = readCompList();
    
    const bondCount = Math.min(d.bonds.filter(b => b.start).length, 2);
    const compCount = Math.min(d.complications.filter(c => c.start).length, 2);
    const startingXp = Math.min(32 + bondCount * 2 + compCount * 2, 36);
    const spent = calculateTotalXpSpent(d);
    const remaining = startingXp - spent;
    
    const xpEl = document.getElementById('wz-summary-xp');
    if (xpEl) xpEl.textContent = startingXp;
    const spentEl = document.getElementById('wz-summary-spent');
    if (spentEl) spentEl.textContent = spent;
    const remainingEl = document.getElementById('wz-summary-remaining');
    if (remainingEl) {
        remainingEl.textContent = remaining > 0 ? `${remaining} remaining` : remaining === 0 ? 'exactly spent' : `${Math.abs(remaining)} OVER!`;
        remainingEl.style.color = remaining < 0 ? 'var(--red)' : 'var(--green)';
    }
    const barEl = document.getElementById('wz-summary-xp-bar');
    if (barEl) {
        barEl.className = `xp-budget-bar ${remaining < 0 ? 'xp-budget-over' : 'xp-budget-ok'}`;
    }
}

// ─── Row HTML Builders ─────────────────────────────────────────────

function dynamicRowHtml(prefix, idx, name = '', cost = 0) {
    return `
        <div class="dynamic-row ${prefix}-row" data-index="${idx}">
            <input type="text" class="${prefix}-name" placeholder="Name" value="${escHtml(name || '')}" style="flex:2;" />
            <input type="number" class="${prefix}-cost" placeholder="XP" value="${cost || 0}" min="0" style="width:60px;" title="XP cost" />
            <button class="wizard-remove-btn">✕</button>
        </div>
    `;
}

function bondRowHtml(idx, item = {}) {
    return `
        <div class="dynamic-row wz-bond-row" data-index="${idx}">
            <input type="text" class="wz-bond-name" placeholder="Bond name (with PC or NPC)" value="${escHtml(item.name || '')}" style="flex:1;min-width:100px;" />
            <input type="text" class="wz-bond-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;min-width:120px;" />
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;" title="+2 XP at creation (max 2 bonds)">
                <input type="checkbox" class="wz-bond-start" ${item.start !== false ? 'checked' : ''} /> +2 XP
            </label>
            <button class="wizard-remove-btn">✕</button>
        </div>
    `;
}

function compRowHtml(idx, item = {}) {
    return `
        <div class="dynamic-row wz-comp-row" data-index="${idx}">
            <input type="text" class="wz-comp-name" placeholder="Complication name" value="${escHtml(item.name || '')}" style="flex:1;min-width:100px;" />
            <input type="text" class="wz-comp-desc" placeholder="Description" value="${escHtml(item.desc || '')}" style="flex:2;min-width:120px;" />
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;" title="+2 XP at creation (max 2). Adds +1 banked SB to early scenes.">
                <input type="checkbox" class="wz-comp-start" ${item.start !== false ? 'checked' : ''} /> +2 XP
            </label>
            <button class="wizard-remove-btn">✕</button>
        </div>
    `;
}

// ─── Dynamic Add ────────────────────────────────────────────────────

export function addWizardDynamic(prefix) {
    const container = document.getElementById(prefix + '-list');
    if (!container) return;
    const idx = container.children.length;
    let html;
    if (prefix === 'wz-bond') html = bondRowHtml(idx);
    else if (prefix === 'wz-comp') html = compRowHtml(idx);
    else html = dynamicRowHtml(prefix, idx);

    const div = document.createElement('div');
    div.innerHTML = html;
    const row = div.firstElementChild;
    container.appendChild(row);
    const nameInput = row.querySelector('input[type="text"]');
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
    
    if (state.step === 4) {
        setTimeout(updateSummaryDisplay, 50);
    }
}

// ─── Event Setup ────────────────────────────────────────────────────

function attachEvents() {
    const modal = state.modal || document.getElementById('wizardModal');
    if (!modal) return;

    clearListeners();

    addListener(document.getElementById('wizard-back'), 'click', wizardBack);
    addListener(document.getElementById('wizard-next'), 'click', wizardNext);
    addListener(document.getElementById('wizardModalClose'), 'click', closeWizard);

    const overlay = modal.querySelector('.wizard-overlay');
    if (overlay) addListener(overlay, 'click', closeWizard);

    const keyHandler = (e) => {
        if (!state.isOpen) return;
        if (e.key === 'Escape') closeWizard();
        else if (e.key === 'Enter' && !e.target.matches('textarea')) {
            const next = document.getElementById('wizard-next');
            if (next) { e.preventDefault(); next.click(); }
        }
    };
    addListener(document, 'keydown', keyHandler);

    // Delegated click for dynamic add/remove and live updates
    const clickHandler = (e) => {
        const target = e.target;

        if (target.matches('[data-wizard-add]')) {
            const prefix = target.dataset.wizardAdd;
            addWizardDynamic(prefix);
            e.preventDefault();
        }

        if (target.matches('.wizard-remove-btn')) {
            const row = target.closest('.dynamic-row');
            if (row) row.remove();
            // Update data from DOM
            if (state.data) state.data.talents = readTalentListFromDOM();
            updateXpBudgetFromDOM();
            if (state.step === 4) setTimeout(updateSummaryDisplay, 50);
            e.preventDefault();
        }

        // Checkbox change updates summary
        if (target.matches('.wz-bond-start, .wz-comp-start')) {
            if (state.isOpen && state.step === 4) {
                setTimeout(updateSummaryDisplay, 50);
            }
        }

        // Heritage change updates note
        if (target.matches('#wz-heritage')) {
            const heritage = HERITAGES.find(h => h.id === target.value);
            const noteEl = document.getElementById('wz-heritage-note');
            if (noteEl && heritage) {
                noteEl.innerHTML = `<strong>Adjustments:</strong> ${escHtml(heritage.adj)}<br>${escHtml(heritage.note)}`;
            }
        }

        // Magic path change updates note
        if (target.matches('#wz-magic-path')) {
            const path = MAGIC_PATHS.find(p => p.id === target.value);
            const noteEl = document.getElementById('wz-magic-path-note');
            if (noteEl && path) {
                noteEl.textContent = path.note;
            }
        }

        // Armor change updates info
        if (target.matches('#wz-armor-type')) {
            const armor = ARMOR_TYPES.find(a => a.id === target.value);
            const infoEl = document.getElementById('wz-armor-info');
            if (infoEl && armor) {
                infoEl.textContent = armor.conversion;
            }
        }

        // Weapon change updates info
        if (target.matches('#wz-weapon-class')) {
            const weapon = WEAPON_CLASSES.find(w => w.id === target.value);
            const infoEl = document.getElementById('wz-weapon-info');
            if (infoEl && weapon) {
                infoEl.textContent = `${weapon.note} | Close: ${weapon.close} | Near: ${weapon.near}`;
            }
        }

        // Catalog add button
        if (target.matches('.catalog-add-btn')) {
            const name = target.dataset.name;
            const cost = parseInt(target.dataset.cost, 10);
            addTalentFromCatalog(name, cost);
            e.preventDefault();
        }

        // Custom talent add button
        if (target.matches('#wz-add-custom-talent')) {
            addCustomTalentRow();
            e.preventDefault();
        }
    };
    addListener(document, 'click', clickHandler);
    
    // Input event for live XP updates on step 4
    const inputHandler = (e) => {
        if (!state.isOpen) return;
        if (state.step === 4 && e.target.matches('.wz-bond-name, .wz-bond-desc, .wz-comp-name, .wz-comp-desc, .wz-talent-name, .wz-talent-cost')) {
            // Talent cost inputs (for custom rows)
            if (e.target.matches('.wz-talent-cost')) {
                state.data.talents = readTalentListFromDOM();
            }
            setTimeout(updateSummaryDisplay, 50);
            updateXpBudgetFromDOM();
        }
        // For talent catalog, nothing needed as add removes from catalog.
    };
    addListener(document, 'input', inputHandler);
}

// ─── Initialization ──────────────────────────────────────────────────

ensureModal();

Object.assign(window, {
    addWizardDynamic,
    wizardBack,
    wizardNext,
    closeWizard,
    addTalentFromCatalog,
    addCustomTalentRow,
});

export default {
    openWizard,
    closeWizard,
    wizardBack,
    wizardNext,
    addWizardDynamic,
    addTalentFromCatalog,
    addCustomTalentRow,
};