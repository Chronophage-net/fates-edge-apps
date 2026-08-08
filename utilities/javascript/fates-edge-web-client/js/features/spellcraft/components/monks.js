/**
 * Monks – Monastic traditions, meditation, and the Way of the Unstruck Bell
 *
 * "The fist is a weapon. The open hand is a promise. Learn both before you need either."
 * – Master Tarian Ironhand
 *
 * Features:
 * - Onboarding: clear "begin the Way" UI with Foundation talents
 * - Breath State cycle: Entering → Holding → Releasing → Empty
 * - Meditation: roll-based with real benefits (Fatigue, Condition removal, bonuses)
 * - Tradition display from patron JSON (with color, quote, techniques)
 * - Talent progression: Foundation → Working → Signature → Quiet
 * - Techniques: Basic → Advanced → Master (patron-specific)
 * - Corruption Tiers: computed from investment, with narrative GM Intrusions
 * - Flow: spend Mental Strain instead of Fatigue (tactical choice)
 * - Quick Reference: key mechanics at a glance
 *
 * All selection modals (tradition, meditation DV, talent, technique) have been
 * replaced with inline dropdowns. Text-entry prompts (name, description, etc.)
 * remain as simple prompt() calls.
 *
 * CONSISTENCY PASS: this file used to maintain its own standalone
 * fetch+cache implementation for patron data (a `patronCache` Map and a
 * local `loadPatronData(patronId)` that hit `/data/patrons/{id}.json`
 * directly), completely separate from the shared loader in
 * `patrons/index.js` that Cantor, Rites, and the Patrons tab all use.
 * Monastic traditions live directly on the patron JSON objects
 * (`patron.monastic_tradition` — see any patron file), so there was never
 * a need for a second data path. The practical cost of the duplication:
 * Monks got none of the schema-version cache-busting added to the shared
 * loader, so it could keep showing a stale tradition after a patron JSON
 * update long after every other panel had picked up the change. This file
 * now goes through the same `patrons/index.js` loader as everyone else.
 * Also replaced this file's private `rollDice()` with the shared
 * `performRoll()` from `core/dice.js` — there is no longer a second,
 * independently-tuned dice engine living in this file.
 *
 * ────────────────────────────────────────────────────────────────────────
 * NEW: VTT integration – Meditation, Flow usage, and Technique usage
 * now send formatted cards to the VTT via window.sendToVTT.
 * ────────────────────────────────────────────────────────────────────────
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';
import { getState, saveState } from '../../../core/state.js';
import { performRoll } from '../../../core/dice.js';
import patrons from '../../patrons/index.js';

const { loadPatronData: ensurePatronDataLoaded } = patrons;

// ============================================================
// HELPERS
// ============================================================

function safeString(val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => safeString(v)).join(', ');
    if (typeof val === 'object') {
        if (val.name) return safeString(val.name);
        if (val.label) return safeString(val.label);
        if (val.description) return safeString(val.description);
        if (val.effect) return safeString(val.effect);
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

/**
 * Find a patron already loaded into shared state (cosmic/terrestrial/
 * religions) — the same lookup pattern used by cantor.js and rites.js, so
 * all three magic-path panels agree on where a patron's data lives.
 */
function findPatronData(state, patronId) {
    if (!patronId) return null;

    if (state.patrons?.cosmic) {
        const found = state.patrons.cosmic.find(p => p.id === patronId);
        if (found) return found;
    }
    if (state.patrons?.terrestrial) {
        const found = state.patrons.terrestrial.find(p => p.id === patronId);
        if (found) return found;
    }
    if (state.patrons?.religions) {
        for (const religion of state.patrons.religions) {
            if (religion.orders) {
                const found = religion.orders.find(o => o.id === patronId);
                if (found) {
                    return { ...found, _religion: religion.name, _religionIcon: religion.icon };
                }
            }
        }
    }
    return null;
}

// ============================================================
// VTT HELPERS
// ============================================================

function sendVTTMessage(html) {
    if (typeof window.sendToVTT === 'function') {
        window.sendToVTT(html, 'System', { isHTML: true });
    } else {
        console.warn('[Monks] VTT not available — message not sent.');
    }
}

function buildMonkCardHtml(title, patronName, patronIcon, effect, costDetails, extraNote = '') {
    return `
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-left:4px solid var(--gold);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">${escHtml(patronIcon || '🧘')}</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--gold);">${escHtml(title)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${escHtml(patronName || 'Monk')}</span>
            </div>
            ${effect ? `<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${formatText(effect)}</div>` : ''}
            ${costDetails ? `<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${formatText(costDetails)}</div>` : ''}
            ${extraNote ? `<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${formatText(extraNote)}</div>` : ''}
        </div>
    `;
}

// ============================================================
// BREATH STATES (universal)
// ============================================================

const BREATH_STATES = {
    ENTERING: 'entering',
    HOLDING: 'holding',
    RELEASING: 'releasing',
    EMPTY: 'empty'
};

const BREATH_LABELS = {
    [BREATH_STATES.ENTERING]: '🌬️ Entering Breath – Drawing in the world',
    [BREATH_STATES.HOLDING]: '🫁 Holding Breath – The pause between',
    [BREATH_STATES.RELEASING]: '💨 Releasing Breath – Action made manifest',
    [BREATH_STATES.EMPTY]: '🌌 Empty Breath – The still point, the void'
};

const BREATH_BONUSES = {
    [BREATH_STATES.ENTERING]: '+1 die to Perception and Insight',
    [BREATH_STATES.HOLDING]: '+1 die to Defense and Resolve',
    [BREATH_STATES.RELEASING]: '+1 die to Attack and Athletics',
    [BREATH_STATES.EMPTY]: '+1 die to all rolls, but cannot use Flow'
};

// ============================================================
// TALENTS (universal)
// ============================================================

const TALENT_CATEGORY_ORDER = ['foundation', 'working', 'signature', 'quiet'];

// Each talent keeps its original flavor tags (capitalized — 'Strike', 'BOD',
// 'Flow', etc., unused elsewhere in the UI today but preserved in case a
// future Monk-specific view wants them) and additionally carries the shared
// lowercase system-tag vocabulary used by data/talents/*.json and the
// character editor's talent filter bar (core/talent-loader.js's
// talentsByTag/collectTalentTags), so a generic "show me monk talents" or
// "show me starter talents" filter also picks these up even though they live
// in their own catalog rather than state.talents.
const FOUNDATION_TALENTS = [
    {
        id: 'open-hand',
        name: 'The Open Hand',
        xp: 2,
        category: 'foundation',
        description: 'Once per scene, when you attempt to parry, deflect, or disarm an opponent, treat your first Body or Melee roll as Position +1.',
        tags: ['Strike', 'BOD', 'Flow', 'monk', 'unarmed', 'defense', 'reactive', 'once-per-scene', 'starter', 'minor'],
        effect: 'Position +1 on first defensive roll per scene.'
    },
    {
        id: 'still-point',
        name: 'Still Point Stance',
        xp: 2,
        category: 'foundation',
        description: 'When you do not move during your turn, gain +1 die to your next defense roll. This benefit lasts until you move or take an aggressive action.',
        tags: ['Move', 'SPT', 'Flow', 'monk', 'unarmed', 'defense', 'conditional', 'starter', 'minor'],
        effect: '+1 die to defense when standing still.'
    },
    {
        id: 'monks-breath',
        name: "Monk's Breath",
        xp: 2,
        category: 'foundation',
        description: 'Once per session, you may clear 1 Fatigue by meditating for one minute uninterrupted. No roll required.',
        tags: ['Heal', 'SPT', 'Restoration', 'monk', 'unarmed', 'fatigue', 'active', 'once-per-session', 'starter', 'minor'],
        effect: 'Clear 1 Fatigue with 1 minute of meditation.'
    }
];

const WORKING_TALENTS = [
    {
        id: 'redirecting-current',
        name: 'Redirecting Current',
        xp: 3,
        category: 'working',
        description: 'When an enemy misses you with a melee attack, you may immediately reposition them one range band in a direction of your choice. Once per scene.',
        tags: ['Move', 'Flow', 'Gambit', 'monk', 'unarmed', 'movement', 'reactive', 'once-per-scene', 'minor'],
        effect: 'Reposition a missing attacker.'
    },
    {
        id: 'unarmoured-body',
        name: 'The Unarmoured Body',
        xp: 4,
        category: 'working',
        description: 'When unarmoured, convert the first point of Harm you would take each scene to Fatigue instead.',
        tags: ['Armour', 'BOD', 'Flow', 'monk', 'unarmed', 'defense', 'passive', 'major'],
        effect: 'First Harm per scene becomes Fatigue when unarmoured.'
    },
    {
        id: 'pressure-point',
        name: 'Pressure Point Strike',
        xp: 4,
        category: 'working',
        description: 'When you make an unarmed attack, declare a Pressure Point Strike. On a hit, the target suffers -1 die on all physical actions until the end of their next turn.',
        tags: ['Strike', 'AGI', 'Gambit', 'monk', 'unarmed', 'combat', 'active', 'major'],
        effect: '-1 die to target\'s physical actions on hit.'
    }
];

const SIGNATURE_TALENTS = [
    {
        id: 'unstruck-bell-talent',
        name: 'The Unstruck Bell',
        xp: 5,
        category: 'signature',
        description: 'Once per session, when you would be hit by an attack, declare that the attack misses you entirely. Describe how you were not there.',
        tags: ['Defense', 'Flow', 'Overload', 'monk', 'unarmed', 'defense', 'reactive', 'once-per-session', 'major'],
        effect: 'Negate one attack per session.',
        cost: 'GM gains 1 Story Beat.'
    },
    {
        id: 'master-open-palm',
        name: 'Master of the Open Palm',
        xp: 5,
        category: 'signature',
        description: 'Once per session, convert a successful unarmed strike into a healing touch instead of dealing Harm. The target clears 1 Fatigue and may remove a minor Condition.',
        tags: ['Strike', 'Combo', 'Restoration', 'monk', 'unarmed', 'healer', 'active', 'once-per-session', 'major'],
        effect: 'Convert strike to healing touch.'
    }
];

const QUIET_TALENT = {
    id: 'stillness-that-moves',
    name: 'The Stillness That Moves',
    xp: 6,
    category: 'quiet',
    description: 'Once per arc, move through a space that should be impassable as if you were never there. You do not break, force, or open. You simply arrive on the other side.',
    tags: ['Move', 'Flow', 'Overload', 'monk', 'unarmed', 'movement', 'active', 'once-per-arc', 'major', 'capstone'],
    effect: 'Pass through impassable space once per arc.',
    cost: 'Permanent Breath Scar: You can never again be surprised, but neither can you ever truly rest.'
};

const ALL_TALENTS = [...FOUNDATION_TALENTS, ...WORKING_TALENTS, ...SIGNATURE_TALENTS, QUIET_TALENT];
const TALENTS_BY_CATEGORY = {
    foundation: FOUNDATION_TALENTS,
    working: WORKING_TALENTS,
    signature: SIGNATURE_TALENTS,
    quiet: [QUIET_TALENT]
};
const CATEGORY_LABELS = {
    foundation: 'Foundation (2 XP)',
    working: 'Working Knife (3-4 XP)',
    signature: 'Signature Moves (5 XP)',
    quiet: 'The Quiet Talent (6 XP)'
};
const CATEGORY_ICONS = {
    foundation: '🌱',
    working: '🔪',
    signature: '⭐',
    quiet: '🌙'
};

function getTalentById(talentId) {
    return ALL_TALENTS.find(t => t.id === talentId) || null;
}

// The one thing that gates this entire module: has the character learned
// ANY monk talent yet? Until they have, nothing else here is "theirs."
function isMonkInitiate(char) {
    return !!(char.monkTalents && char.monkTalents.length > 0);
}

// Returns the category the character still needs before `category` unlocks,
// or null if `category` is already available to them.
function missingPrereqCategory(char, category) {
    const idx = TALENT_CATEGORY_ORDER.indexOf(category);
    if (idx <= 0) return null; // foundation has no prereq
    const priorCategory = TALENT_CATEGORY_ORDER[idx - 1];
    const owned = char.monkTalents || [];
    const hasPrior = TALENTS_BY_CATEGORY[priorCategory].some(t => owned.includes(t.id));
    return hasPrior ? null : priorCategory;
}

// ============================================================
// STATE
// ============================================================

let container = null;

// ============================================================
// HELPERS (character-derived)
// ============================================================

function getBreathState(char) {
    return char.breathState || BREATH_STATES.ENTERING;
}

function getMonasticTradition(char) {
    return char.monasticTradition || null;
}

async function getMonasticTraditionData(char) {
    const traditionId = getMonasticTradition(char);
    if (!traditionId) return null;

    const result = await findPatronTradition(traditionId);
    if (!result) return null;

    return {
        patronId: result.patron.id,
        patronName: result.patron.name || result.patron.title || result.patronId,
        patronIcon: result.patron.icon || '📿',
        tradition: result.tradition,
        religion: result.religion
    };
}

function getBreathScars(char) {
    return char.breathScars || [];
}

function hasTalent(char, talentId) {
    return (char.monkTalents || []).includes(talentId);
}

function hasTechnique(char, traditionId, level) {
    const techs = char.monkTechniques || {};
    return techs[traditionId]?.includes(level) || false;
}

function getFlowPoints(char) {
    return char.flowPoints || 3;
}

function getMaxFlowPoints(char) {
    return Math.max(1, (char.spirit || 1));
}

// Corruption tier is driven by total investment in the path (talents +
// techniques learned), scaled against however many corruption tiers the
// chosen tradition actually defines — not hardcoded to a max of 3.
function computeCorruptionTier(char, traditionData) {
    if (!traditionData) return 0;
    const entries = traditionData.tradition.corruption || [];
    if (entries.length === 0) return 0;

    const talentCount = (char.monkTalents || []).length;
    const traditionId = traditionData.patronId;
    const techCount = (char.monkTechniques?.[traditionId] || []).length;
    const investment = talentCount + techCount;

    return Math.max(0, Math.min(entries.length, investment));
}

// ============================================================
// MONASTIC TRADITION LOOKUP
// ============================================================

async function findPatronTradition(patronId) {
    if (!patronId) return null;
    await ensurePatronDataLoaded();
    const state = getState();
    const patronData = findPatronData(state, patronId);
    if (patronData && patronData.monastic_tradition) {
        return {
            patron: patronData,
            tradition: patronData.monastic_tradition,
            religion: patronData._religion || null
        };
    }
    return null;
}

async function getAllMonasticTraditions() {
    await ensurePatronDataLoaded();
    const state = getState();
    const results = [];

    if (state.patrons?.cosmic) {
        for (const patron of state.patrons.cosmic) {
            if (patron.monastic_tradition) {
                results.push({
                    patronId: patron.id,
                    patronName: patron.name || patron.title || patron.id,
                    patronIcon: patron.icon || '📿',
                    tradition: patron.monastic_tradition,
                    source: 'cosmic'
                });
            }
        }
    }

    if (state.patrons?.terrestrial) {
        for (const patron of state.patrons.terrestrial) {
            if (patron.monastic_tradition) {
                results.push({
                    patronId: patron.id,
                    patronName: patron.name || patron.title || patron.id,
                    patronIcon: patron.icon || '🏛️',
                    tradition: patron.monastic_tradition,
                    source: 'terrestrial'
                });
            }
        }
    }

    if (state.patrons?.religions) {
        for (const religion of state.patrons.religions) {
            if (religion.orders) {
                for (const order of religion.orders) {
                    if (order.monastic_tradition) {
                        results.push({
                            patronId: order.id,
                            patronName: order.name || order.id,
                            patronIcon: order.icon || religion.icon || '⛪',
                            tradition: order.monastic_tradition,
                            source: 'religion',
                            religion: religion.name
                        });
                    }
                }
            }
        }
    }

    return results;
}

// ============================================================
// MEDITATION SYSTEM
// ============================================================

export function performMeditation(char, targetDV = 3) {
    const results = [];
    let sbCount = 0;

    const body = char.body || 1;
    const athletics = char.skills?.athletics || 0;
    const bodyPool = body + athletics;
    const bodyResult = performRoll(bodyPool, 2);
    const bodySuccess = bodyResult.successes >= 2;
    results.push({
        step: 'Settle the Body',
        pool: bodyPool,
        success: bodySuccess,
        result: bodySuccess ? '✅ Body settled.' : '❌ Distracted by an ache.'
    });
    if (!bodySuccess) sbCount += 1;

    const spirit = char.spirit || 1;
    const insight = char.skills?.insight || 0;
    const breathPool = spirit + insight;
    const breathResult = performRoll(breathPool, 3);
    const breathSuccess = breathResult.successes >= 3;
    results.push({
        step: 'Settle the Breath',
        pool: breathPool,
        success: breathSuccess,
        result: breathSuccess ? '✅ Breath settled.' : '⚠️ Mind wanders. GM gains 1 SB.'
    });
    if (!breathSuccess) sbCount += 1;

    const presence = char.presence || 1;
    const sway = char.skills?.sway || 0;
    const stillPool = spirit + presence + Math.floor((insight + sway) / 2);
    const stillResult = performRoll(stillPool, targetDV);
    const stillSuccess = stillResult.successes >= targetDV;
    let partial = false;
    if (stillResult.successes > 0 && stillResult.successes < targetDV) partial = true;
    results.push({
        step: 'The Still Point',
        pool: stillPool,
        success: stillSuccess,
        partial: partial,
        result: stillSuccess ? '✅ Reached the still point.' :
                partial ? '⚠️ Reached but drained. Mark 1 Fatigue.' :
                '❌ Lost in thought. GM gains 2 SB.'
    });
    if (!stillSuccess && !partial) sbCount += 2;
    if (partial) sbCount += 1;

    const achieved = stillSuccess;
    const drained = partial;

    let benefits = [];
    if (achieved && !drained) {
        benefits.push('Clear 1 Fatigue');
        const conditions = char.conditions || [];
        if (conditions.some(c => ['Fear', 'Shaken', 'Guilty'].includes(c))) {
            benefits.push('May remove one minor Condition (Fear, Shaken, Guilty)');
        }
        benefits.push('Gain +1 die to next Wits-based roll (Clarity Meditation)');
        benefits.push('Advance your Breath State one step');
    } else if (achieved && drained) {
        benefits.push('Clear 1 Fatigue (but mark 1 Fatigue from exhaustion)');
        benefits.push('Net: no Fatigue change');
    } else {
        benefits.push('No benefit. Try again after rest.');
    }

    return { results, achieved, drained, benefits, sbCount };
}

// ============================================================
// MAIN RENDER
// ============================================================

export async function renderMonks(el) {
    container = el;
    const char = getCharacterData();

    if (!char) {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧘</div>
                <p>Select a character to view their monastic path.</p>
            </div>
        `;
        return;
    }

    // ---- GATE: nothing below renders until the character has actually
    // learned a monk talent. ----
    if (!isMonkInitiate(char)) {
        renderOnboarding(el, char);
        return;
    }

    // Ensure patron data (and therefore monastic traditions) is loaded via
    // the shared loader before we look anything up below.
    await ensurePatronDataLoaded();

    const traditionId = getMonasticTradition(char);
    const traditionData = traditionId ? await getMonasticTraditionData(char) : null;
    const breathState = getBreathState(char);
    const breathScars = getBreathScars(char);
    const flowPoints = getFlowPoints(char);
    const maxFlowPoints = getMaxFlowPoints(char);

    // Recompute + persist corruption tier from actual investment every render
    const corruptionTier = computeCorruptionTier(char, traditionData);
    if (traditionData && corruptionTier !== (char.monkCorruptionTier || 0)) {
        char.monkCorruptionTier = corruptionTier;
        saveCharacter({ monkCorruptionTier: corruptionTier });
    }

    // Build GM Intrusions from tradition corruption
    const gmIntrusions = traditionData?.tradition?.gm_guidance || [];
    const randomIntrusion = gmIntrusions.length > 0 ?
        gmIntrusions[Math.floor(Math.random() * gmIntrusions.length)] :
        null;

    const allTraditions = await getAllMonasticTraditions();

    // Build dropdown options for traditions
    const traditionOptionsHtml = allTraditions.map(t =>
        `<option value="${t.patronId}" ${t.patronId === traditionId ? 'selected' : ''}>${t.patronIcon} ${t.patronName} – ${t.tradition.name}</option>`
    ).join('');

    // Meditation DV options
    const dvOptionsHtml = `
        <option value="3">Clarity (DV 3)</option>
        <option value="4">Healing (DV 4)</option>
        <option value="5">Transcendence (DV 5)</option>
    `;

    // Build talent dropdown (all unlearned talents that are learnable)
    const ownedTalents = char.monkTalents || [];
    const learnableTalents = ALL_TALENTS.filter(t => {
        if (ownedTalents.includes(t.id)) return false;
        const missing = missingPrereqCategory(char, t.category);
        return missing === null;
    });
    const talentOptionsHtml = learnableTalents.map(t =>
        `<option value="${t.id}">${t.name} (${t.xp} XP) — ${t.effect || t.description.substring(0, 40)}...</option>`
    ).join('');

    // Build technique dropdown for the current tradition
    let techniqueOptionsHtml = '';
    if (traditionData) {
        const tradition = traditionData.tradition;
        const levels = ['basic', 'advanced', 'master'];
        const labels = { basic: 'Basic', advanced: 'Advanced', master: 'Master' };
        const xpMap = {
            basic: tradition.techniques?.basic?.xp || 6,
            advanced: tradition.techniques?.advanced?.xp || 8,
            master: tradition.techniques?.master?.xp || 12
        };
        const learnableLevels = levels.filter(l => {
            if (hasTechnique(char, traditionData.patronId, l)) return false;
            if (l === 'advanced' && !hasTechnique(char, traditionData.patronId, 'basic')) return false;
            if (l === 'master' && !hasTechnique(char, traditionData.patronId, 'advanced')) return false;
            return true;
        });
        techniqueOptionsHtml = learnableLevels.map(l =>
            `<option value="${l}">${labels[l]} — ${tradition.techniques[l]?.name || l} (${xpMap[l]} XP)</option>`
        ).join('');
        if (!techniqueOptionsHtml) {
            techniqueOptionsHtml = `<option value="">All techniques learned!</option>`;
        }
    }

    el.innerHTML = `
        <div class="monks-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="monks-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🧘</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Monastic Path</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${traditionData ? traditionData.patronName : 'No Tradition'}</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="monk-meditation-dv-select" style="font-size:0.65rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;">
                        ${dvOptionsHtml}
                    </select>
                    <button class="btn btn-sm btn-gold" onclick="window.monkMeditateFromSelect()">🧘 Meditate</button>
                    <button class="btn btn-sm btn-primary" onclick="window.monkChooseTradition()">📿 Tradition</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.monkRefresh()" title="Reloads patron data from disk, bypassing any cached copy">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Breath State + Flow ────────────────────────── -->
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:0.3rem;">
                <div class="monks-breath" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                        <div>
                            <div style="font-size:0.8rem;font-weight:600;">${BREATH_LABELS[breathState] || 'Unknown Breath'}</div>
                            <div style="font-size:0.65rem;color:var(--text3);">${BREATH_BONUSES[breathState] || ''}</div>
                        </div>
                        <div style="display:flex;gap:0.2rem;align-items:center;">
                            <span style="font-size:0.6rem;color:var(--text3);">${breathScars.length > 0 ? `⚠️ Scars: ${breathScars.join(', ')}` : 'No scars'}</span>
                            <button class="btn btn-xs btn-ghost" onclick="window.monkAdvanceBreath()" title="Advance to next breath state">→</button>
                        </div>
                    </div>
                    <div style="display:flex;gap:0.2rem;margin-top:0.1rem;font-size:0.6rem;color:var(--text3);">
                        ${Object.entries(BREATH_STATES).map(([key, state]) => `
                            <span style="${state === breathState ? 'font-weight:600;color:var(--gold);' : ''}">${state === breathState ? '●' : '○'} ${key.charAt(0).toUpperCase() + key.slice(1)}</span>
                        `).join(' ')}
                    </div>
                </div>

                <div class="monks-flow" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--blue);text-align:center;">
                    <div style="font-size:0.7rem;color:var(--text3);">🌀 Flow Points</div>
                    <div style="font-size:1.2rem;font-weight:600;color:var(--blue);">${flowPoints} / ${maxFlowPoints}</div>
                    <div style="display:flex;gap:0.2rem;justify-content:center;margin-top:0.1rem;flex-wrap:wrap;">
                        <button class="btn btn-xs btn-secondary" onclick="window.monkAddFlow(1)">+</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.monkAddFlow(-1)">−</button>
                        <button class="btn btn-xs btn-gold" onclick="window.monkUseFlow()">🌀 Use Flow</button>
                        <span style="font-size:0.55rem;color:var(--text3);">(Spend 1 to avoid Fatigue)</span>
                    </div>
                </div>
            </div>

            <!-- ─── Tradition Display ───────────────────────────── -->
            ${traditionData ? renderTraditionDisplay(traditionData, char) : renderNoTradition(allTraditions)}

            <!-- ─── Tradition Selector (dropdown) ──────────────── -->
            <div style="display:flex;gap:0.3rem;align-items:center;background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.5rem;border:1px solid var(--border);flex-wrap:wrap;">
                <span style="font-size:0.7rem;color:var(--text3);">📿 Set Tradition:</span>
                <select id="monk-tradition-select" style="flex:1;min-width:150px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;">
                    <option value="">— Choose a tradition —</option>
                    ${traditionOptionsHtml}
                </select>
                <button class="btn btn-xs btn-primary" onclick="window.monkSetTraditionFromSelect()">Set</button>
                ${traditionData ? `<button class="btn btn-xs btn-ghost" onclick="window.monkClearTradition()" style="color:var(--red);">✕ Clear</button>` : ''}
            </div>

            <!-- ─── GM Intrusion ────────────────────────────────── -->
            ${randomIntrusion ? `
                <div class="monks-intrusion" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--orange);font-size:0.75rem;color:var(--text2);">
                    <span style="font-weight:600;color:var(--orange);">⚠️ GM Intrusion:</span> "${formatText(randomIntrusion)}"
                </div>
            ` : ''}

            <!-- ─── Meditation Results ──────────────────────────── -->
            <div id="monk-meditation-results" style="display:none;"></div>

            <!-- ─── Corruption ──────────────────────────────────── -->
            ${traditionData && corruptionTier > 0 ? renderCorruption(traditionData, corruptionTier) : ''}

            <!-- ─── Talents & Techniques ───────────────────────── -->
            <div class="monks-talents" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;flex-wrap:wrap;gap:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⚡ Talents & Techniques</span>
                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;align-items:center;">
                        ${learnableTalents.length > 0 ? `
                            <select id="monk-talent-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;max-width:200px;">
                                ${talentOptionsHtml}
                            </select>
                            <button class="btn btn-xs btn-primary" onclick="window.monkLearnTalentFromSelect()">Learn</button>
                        ` : `
                            <span style="font-size:0.6rem;color:var(--text3);">All talents learned!</span>
                        `}
                        ${traditionData && techniqueOptionsHtml ? `
                            <select id="monk-technique-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;max-width:180px;">
                                ${techniqueOptionsHtml}
                            </select>
                            <button class="btn btn-xs btn-gold" onclick="window.monkLearnTechniqueFromSelect('${traditionData.patronId}')">Learn Tech</button>
                        ` : ''}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:250px;overflow-y:auto;">
                    ${renderTalents(char)}
                    ${traditionData ? renderTechniques(traditionData, char) : ''}
                </div>
                <div style="font-size:0.55rem;color:var(--text3);margin-top:0.1rem;text-align:center;">
                    ${getProgressionSummary(char)}
                </div>
            </div>

            <!-- ─── Quick Reference ────────────────────────────── -->
            <div class="monks-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;border:1px solid var(--border);">
                <div>🧘 <strong>Meditate:</strong> Clear Fatigue, gain focus</div>
                <div>🌀 <strong>Flow:</strong> Spend Flow instead of Fatigue</div>
                <div>🫁 <strong>Breath:</strong> Cycle for bonuses</div>
                <div>📿 <strong>Tradition:</strong> Techniques + Corruption</div>
                <div>🌱 <strong>Foundation → Quiet:</strong> 3 → 4 → 5 → 6 XP</div>
            </div>

        </div>
    `;

    const resultsDiv = document.getElementById('monk-meditation-results');
    const meditationResult = sessionStorage.getItem('fates-edge-meditation-result');
    if (meditationResult && resultsDiv) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = meditationResult;
        sessionStorage.removeItem('fates-edge-meditation-result');
    }

    // Attach any extra events (none needed for this file)
}

// ============================================================
// ONBOARDING
// ============================================================

function renderOnboarding(el, char) {
    const totalXp = char.totalXp || 0;
    const spent = char.xpSpent || 0;
    const available = totalXp - spent;

    el.innerHTML = `
        <div class="monks-container" style="display:flex;flex-direction:column;gap:0.6rem;">
            <div class="monks-header" style="display:flex;align-items:center;gap:0.4rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <span style="font-size:1.4rem;">🧘</span>
                <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Monastic Path</span>
                <span style="font-size:0.7rem;color:var(--text3);">Begin the Way</span>
            </div>

            <div class="monks-not-started" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
                <div style="font-size:2rem;">🥋</div>
                <p style="color:var(--text2);font-size:1.05rem;font-weight:500;">You have not yet begun the Way.</p>
                <p style="font-size:0.85rem;max-width:500px;margin:0.2rem auto;">
                    The monastic path is open to anyone — no patron required. 
                    Learn a <strong>Foundation talent</strong> to begin your journey.
                </p>
                <p style="font-size:0.75rem;color:var(--text3);">
                    Available XP: <strong style="color:var(--gold);">${available}</strong> 
                    (${spent} spent of ${totalXp})
                </p>
                <div style="display:flex;gap:0.3rem;justify-content:center;flex-wrap:wrap;margin-top:0.3rem;">
                    ${FOUNDATION_TALENTS.map(t => `
                        <button class="btn btn-sm btn-primary" onclick="window.monkBuyTalent('${t.id}')">
                            ${t.name} (${t.xp} XP)
                        </button>
                    `).join('')}
                </div>
                <div style="font-size:0.7rem;color:var(--text3);margin-top:0.3rem;">
                    <strong>What you gain:</strong> Breath States, Meditation, and access to Techniques.
                </div>
            </div>

            <div style="font-size:0.7rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <strong>💡 Tip:</strong> Foundation talents are cheap (2 XP) and unlock the entire monastic system.
                Choose the one that fits your character's style.
            </div>
        </div>
    `;
}

// ============================================================
// RENDER HELPERS
// ============================================================

function renderTraditionDisplay(traditionData, char) {
    const tradition = traditionData.tradition;
    const patronId = traditionData.patronId;
    const hasBasic = hasTechnique(char, patronId, 'basic');
    const hasAdvanced = hasTechnique(char, patronId, 'advanced');
    const hasMaster = hasTechnique(char, patronId, 'master');
    const color = tradition.color || 'var(--gold)';

    return `
        <div class="monks-tradition" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${color};">
            <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                <span style="font-size:1.2rem;">${traditionData.patronIcon}</span>
                <span style="font-weight:600;font-size:0.95rem;color:${color};">${escHtml(tradition.name)}</span>
                <span style="font-size:0.7rem;color:var(--text3);">Patron: ${escHtml(traditionData.patronName)}</span>
                ${traditionData.religion ? `<span style="font-size:0.6rem;color:var(--text3);">⛪ ${escHtml(traditionData.religion)}</span>` : ''}
            </div>
            <div style="font-size:0.8rem;color:var(--text2);margin:0.15rem 0;">${formatText(tradition.description)}</div>
            ${tradition.debt_resistant_frame ? `<div style="font-size:0.7rem;color:var(--text3);margin-bottom:0.1rem;"><strong>🕸️ Debt Resistance:</strong> ${formatText(tradition.debt_resistant_frame)}</div>` : ''}
            <div style="display:flex;gap:0.3rem;font-size:0.65rem;color:var(--text3);">
                <span style="color:${hasBasic ? 'var(--green)' : 'var(--text3)'};">${hasBasic ? '✅' : '⬜'} Basic</span>
                <span style="color:${hasAdvanced ? 'var(--green)' : 'var(--text3)'};">${hasAdvanced ? '✅' : '⬜'} Advanced</span>
                <span style="color:${hasMaster ? 'var(--gold)' : 'var(--text3)'};">${hasMaster ? '⭐' : '⬜'} Master</span>
            </div>
            ${tradition.quote ? `<blockquote style="margin:0.15rem 0;padding:0.15rem 0.5rem;font-size:0.7rem;color:var(--text3);border-left:2px solid ${color};">"${escHtml(tradition.quote)}"</blockquote>` : ''}
        </div>
    `;
}

function renderNoTradition(allTraditions) {
    return `
        <div class="monks-no-tradition" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
            <div style="font-size:1.5rem;">📿</div>
            <p>No monastic tradition chosen.</p>
            <p style="font-size:0.8rem;">Choose a tradition from the dropdown above.</p>
        </div>
    `;
}

function renderTalents(char) {
    const owned = char.monkTalents || [];
    let html = '';

    for (const category of TALENT_CATEGORY_ORDER) {
        const talents = TALENTS_BY_CATEGORY[category];
        const hasAny = talents.some(t => owned.includes(t.id));
        const missing = missingPrereqCategory(char, category);

        html += `
            <div style="display:flex;flex-direction:column;gap:0.1rem;${!hasAny ? 'opacity:0.6;' : ''}">
                <div style="font-size:0.65rem;font-weight:600;color:${hasAny ? 'var(--gold)' : 'var(--text3)'};">
                    ${CATEGORY_ICONS[category]} ${CATEGORY_LABELS[category]}
                    ${missing ? `(requires ${CATEGORY_LABELS[missing]})` : ''}
                </div>
                ${talents.map(t => {
                    const has = owned.includes(t.id);
                    return `
                        <div class="talent-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;${has ? 'border-left:3px solid var(--gold);background:var(--bg3);' : ''}">
                            <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                                <span>${has ? '✅' : '⬜'}</span>
                                <span style="${has ? 'font-weight:600;' : ''}">${escHtml(t.name)}</span>
                                <span style="font-size:0.6rem;color:var(--text3);">${t.xp} XP</span>
                                ${t.effect ? `<span style="font-size:0.6rem;color:var(--text2);">${escHtml(t.effect)}</span>` : ''}
                            </div>
                            ${!has ? `<button class="btn btn-xs ${missing ? 'btn-secondary' : 'btn-primary'}" onclick="window.monkBuyTalent('${t.id}')" ${missing ? 'disabled' : ''}>Learn</button>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    return html;
}

function renderTechniques(traditionData, char) {
    const tradition = traditionData.tradition;
    const patronId = traditionData.patronId;
    const levels = ['basic', 'advanced', 'master'];
    const labels = { basic: 'Basic', advanced: 'Advanced', master: 'Master' };
    const xpMap = {
        basic: tradition.techniques?.basic?.xp || 6,
        advanced: tradition.techniques?.advanced?.xp || 8,
        master: tradition.techniques?.master?.xp || 12
    };
    const color = tradition.color || 'var(--gold)';

    return levels.map(level => {
        const tech = tradition.techniques?.[level];
        if (!tech) return '';
        const has = hasTechnique(char, patronId, level);
        const canLearn = !has && (
            level === 'basic' ||
            (level === 'advanced' && hasTechnique(char, patronId, 'basic')) ||
            (level === 'master' && hasTechnique(char, patronId, 'advanced'))
        );
        const effect = tech.effect || tech.description || '';
        const cost = tech.cost || '';
        return `
            <div class="technique-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;${has ? `border-left:3px solid ${color};background:var(--bg3);` : ''}">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;flex:1;min-width:0;">
                    <span>${has ? '✅' : '⬜'}</span>
                    <span style="${has ? 'font-weight:600;' : ''}">${escHtml(tech.name)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${xpMap[level] || tech.xp || '?'} XP</span>
                    <span style="font-size:0.55rem;color:${color};">${labels[level]}</span>
                    ${effect ? `<div style="width:100%;font-size:0.6rem;color:var(--text2);">${formatText(effect)}</div>` : ''}
                    ${cost ? `<div style="font-size:0.6rem;color:var(--text3);">Cost: ${formatText(cost)}</div>` : ''}
                </div>
                <div style="display:flex;gap:0.2rem;flex-shrink:0;margin-left:0.3rem;">
                    ${has ? `<button class="btn btn-xs btn-gold" onclick="window.monkUseTechnique('${patronId}','${level}')">Use</button>` : ''}
                    ${!has && canLearn ? `<button class="btn btn-xs btn-gold" onclick="window.monkBuyTechnique('${patronId}','${level}')">Learn</button>` : ''}
                    ${!has && !canLearn ? `<span style="font-size:0.55rem;color:var(--text3);">${level === 'advanced' ? 'Requires Basic' : 'Requires Advanced'}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderCorruption(traditionData, tier) {
    const entries = traditionData.tradition.corruption || [];
    const current = entries.find(e => String(e.tier) === String(tier)) || entries[tier - 1];
    if (!current) return '';

    return `
        <div class="monks-corruption" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--red);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-size:0.8rem;font-weight:600;color:var(--red);">⚠️ Mark of the Path — Tier ${tier} / ${entries.length}</span>
                <span style="font-size:0.65rem;color:var(--text3);">"The path leaves its mark."</span>
            </div>
            <div style="font-size:0.8rem;color:var(--gold);">${formatText(current.benefit)}</div>
            <div style="font-size:0.75rem;color:var(--red);">${formatText(current.cost)}</div>
            ${current.narrative ? `<div style="font-size:0.65rem;color:var(--text3);font-style:italic;margin-top:0.1rem;">"${formatText(current.narrative)}"</div>` : ''}
        </div>
    `;
}

function getProgressionSummary(char) {
    const owned = char.monkTalents || [];
    const total = owned.length;
    const techs = char.monkTechniques || {};
    const techCount = Object.values(techs).reduce((acc, arr) => acc + arr.length, 0);
    const nextCategory = TALENT_CATEGORY_ORDER.find(cat => {
        return TALENTS_BY_CATEGORY[cat].some(t => !owned.includes(t.id));
    });
    const nextLabel = nextCategory ? CATEGORY_LABELS[nextCategory] : 'All talents learned!';
    return `${total} talents · ${techCount} techniques · Next: ${nextLabel}`;
}

// ============================================================
// GLOBAL FUNCTIONS (onclick handlers) – with dropdown replacements
// ============================================================

// ─── Set Tradition from dropdown ──────────────────────────────

window.monkSetTraditionFromSelect = function() {
    const char = getCharacterData();
    if (!char) return;

    if (!isMonkInitiate(char)) {
        showToast('Learn a Foundation talent before choosing a tradition.', 'error');
        return;
    }

    const select = document.getElementById('monk-tradition-select');
    if (!select) return;
    const patronId = select.value;
    if (!patronId) {
        showToast('Please select a tradition.', 'error');
        return;
    }

    char.monasticTradition = patronId;
    if (!char.monkTechniques) char.monkTechniques = {};
    saveCharacter({
        monasticTradition: patronId,
        monkTechniques: char.monkTechniques
    });
    showToast(`📿 Chosen tradition.`, 'success');
    renderMonks(container);
};

// ─── Clear Tradition ──────────────────────────────────────────

window.monkClearTradition = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!confirm('Clear your monastic tradition? This will remove all techniques.')) return;
    char.monasticTradition = null;
    char.monkTechniques = {};
    saveCharacter({ monasticTradition: null, monkTechniques: {} });
    showToast('Tradition cleared.', 'info');
    renderMonks(container);
};

// ─── Legacy Choose Tradition (redirects to dropdown) ──────────

window.monkChooseTradition = function() {
    const select = document.getElementById('monk-tradition-select');
    if (select) {
        // If there's already a selection, scroll to it and highlight.
        select.focus();
        showToast('Select a tradition from the dropdown above.', 'info');
    } else {
        showToast('Please refresh the panel to use the dropdown.', 'info');
    }
};

// ─── Meditate from dropdown ───────────────────────────────────
// FIX: add async keyword to use await inside

window.monkMeditateFromSelect = async function() {
    const char = getCharacterData();
    if (!char) return;

    if (!isMonkInitiate(char)) {
        showToast('Learn a Foundation talent before meditating.', 'error');
        return;
    }

    const select = document.getElementById('monk-meditation-dv-select');
    if (!select) return;
    const dv = parseInt(select.value);
    if (isNaN(dv) || dv < 3 || dv > 5) {
        showToast('Invalid DV. Choose 3, 4, or 5.', 'error');
        return;
    }

    const result = performMeditation(char, dv);

    let resultHtml = `
        <div style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;border-left:4px solid ${result.achieved ? 'var(--green)' : 'var(--red)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;">🧘 Meditation Results</span>
                <span style="font-size:0.7rem;color:var(--text3);">DV ${dv}</span>
            </div>
            <div style="font-size:0.75rem;margin:0.15rem 0;">
                ${result.results.map(r => `<div>${r.result}</div>`).join('')}
            </div>
            <div style="font-size:0.85rem;margin:0.15rem 0;${result.achieved ? 'color:var(--green);' : 'color:var(--red);'}">
                ${result.achieved ? '✅ Meditation successful!' : result.drained ? '⚠️ Partial success – drained.' : '❌ Meditation failed.'}
            </div>
            ${result.benefits.length > 0 ? `
                <div style="font-size:0.75rem;color:var(--gold);">
                    <strong>Benefits:</strong> ${result.benefits.join('; ')}
                </div>
            ` : ''}
            ${result.sbCount > 0 ? `
                <div style="font-size:0.65rem;color:var(--text3);">GM gains ${result.sbCount} Story Beat${result.sbCount > 1 ? 's' : ''}.</div>
            ` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('#monk-meditation-results').style.display='none'">Close</button>
        </div>
    `;

    sessionStorage.setItem('fates-edge-meditation-result', resultHtml);

    // ─── Send VTT card for successful meditation ──────────────
    if (result.achieved && !result.drained) {
        const fatigue = char.fatigue || 0;
        if (fatigue > 0) {
            char.fatigue = fatigue - 1;
        }

        if (dv === 4 && char.conditions) {
            const removable = ['Fear', 'Shaken', 'Guilty'];
            const hasCondition = removable.some(c => char.conditions.includes(c));
            if (hasCondition && confirm('Remove a minor condition (Fear, Shaken, Guilty)?')) {
                char.conditions = char.conditions.filter(c => !removable.includes(c));
            }
        }

        if (dv === 3) char._clarityBonus = true;
        if (dv === 5) char._transcendenceAvailable = true;

        // Advance breath state on successful meditation
        const states = Object.values(BREATH_STATES);
        const current = getBreathState(char);
        const idx = states.indexOf(current);
        const next = states[(idx + 1) % states.length];
        char.breathState = next;

        saveCharacter({
            fatigue: char.fatigue,
            conditions: char.conditions,
            _clarityBonus: char._clarityBonus,
            _transcendenceAvailable: char._transcendenceAvailable,
            breathState: char.breathState
        });

        // Send VTT card
        const patronName = char.monasticTradition ? (await getMonasticTraditionData(char))?.patronName || 'Monk' : 'Monk';
        const patronIcon = char.monasticTradition ? (await getMonasticTraditionData(char))?.patronIcon || '🧘' : '🧘';
        const effects = result.benefits.join('; ');
        const costDetails = `Breath advanced to ${BREATH_LABELS[next]}`;
        const cardHtml = buildMonkCardHtml(
            'Meditation Success',
            patronName,
            patronIcon,
            effects,
            costDetails,
            `DV ${dv} — The still point reached.`
        );
        sendVTTMessage(cardHtml);

        showToast(`🧘 Meditation successful! Breath advanced to ${BREATH_LABELS[next]}`, 'success');
    } else if (result.achieved && result.drained) {
        // Drained: no net benefit, but still advances breath
        const states = Object.values(BREATH_STATES);
        const current = getBreathState(char);
        const idx = states.indexOf(current);
        const next = states[(idx + 1) % states.length];
        char.breathState = next;
        saveCharacter({ breathState: char.breathState });

        // Send VTT card for drained meditation
        const patronName = char.monasticTradition ? (await getMonasticTraditionData(char))?.patronName || 'Monk' : 'Monk';
        const patronIcon = char.monasticTradition ? (await getMonasticTraditionData(char))?.patronIcon || '🧘' : '🧘';
        const cardHtml = buildMonkCardHtml(
            'Meditation (Drained)',
            patronName,
            patronIcon,
            'Partial success – drained, but breath advances.',
            `Breath advanced to ${BREATH_LABELS[next]}`,
            'Mark 1 Fatigue (net no change)'
        );
        sendVTTMessage(cardHtml);

        showToast(`⚠️ Meditation drained, but breath advanced to ${BREATH_LABELS[next]}`, 'warning');
    } else {
        showToast('❌ Meditation failed. Try again after rest.', 'error');
    }

    renderMonks(container);
};

// ─── Legacy Meditate (redirects to dropdown) ─────────────────

window.monkMeditate = function() {
    const select = document.getElementById('monk-meditation-dv-select');
    if (select) {
        window.monkMeditateFromSelect();
    } else {
        showToast('Please refresh the panel to use the dropdown.', 'info');
    }
};

// ─── Breath ────────────────────────────────────────────────────

window.monkAdvanceBreath = function() {
    const char = getCharacterData();
    if (!char) return;

    if (!isMonkInitiate(char)) {
        showToast('Learn a Foundation talent first.', 'error');
        return;
    }

    const states = Object.values(BREATH_STATES);
    const current = getBreathState(char);
    const idx = states.indexOf(current);
    const next = states[(idx + 1) % states.length];

    char.breathState = next;
    saveCharacter({ breathState: next });
    showToast(`🫁 Advanced to: ${BREATH_LABELS[next]}`, 'success');
    renderMonks(container);
};

// ─── Flow ──────────────────────────────────────────────────────

window.monkAddFlow = function(amount) {
    const char = getCharacterData();
    if (!char) return;

    if (!isMonkInitiate(char)) {
        showToast('Learn a Foundation talent first.', 'error');
        return;
    }

    const current = getFlowPoints(char);
    const max = getMaxFlowPoints(char);
    const newVal = Math.max(0, Math.min(current + amount, max));

    char.flowPoints = newVal;
    saveCharacter({ flowPoints: newVal });
    renderMonks(container);
    showToast(`🌀 Flow: ${newVal}/${max}`, 'info');
};

// ─── Use Flow (spend 1 to avoid Fatigue) ──────────────────────
// FIX: add async keyword to use await inside

window.monkUseFlow = async function() {
    const char = getCharacterData();
    if (!char) return;

    if (!isMonkInitiate(char)) {
        showToast('Learn a Foundation talent first.', 'error');
        return;
    }

    const current = getFlowPoints(char);
    if (current < 1) {
        showToast('No Flow points available.', 'error');
        return;
    }

    // In practice, using Flow means you avoid Fatigue on a roll.
    // We'll just mark the spend and send a VTT card.
    char.flowPoints = current - 1;
    saveCharacter({ flowPoints: char.flowPoints });

    const patronName = char.monasticTradition ? (await getMonasticTraditionData(char))?.patronName || 'Monk' : 'Monk';
    const patronIcon = char.monasticTradition ? (await getMonasticTraditionData(char))?.patronIcon || '🧘' : '🧘';
    const cardHtml = buildMonkCardHtml(
        '🌀 Flow Spent',
        patronName,
        patronIcon,
        'You channel your inner stillness to avoid exhaustion.',
        `Flow: ${char.flowPoints}/${getMaxFlowPoints(char)} remaining`,
        'Use this to avoid marking Fatigue on a roll.'
    );
    sendVTTMessage(cardHtml);

    showToast(`🌀 Spent 1 Flow. ${char.flowPoints}/${getMaxFlowPoints(char)} remaining.`, 'success');
    renderMonks(container);
};

// ─── Learn Talent from dropdown ───────────────────────────────

window.monkLearnTalentFromSelect = function() {
    const char = getCharacterData();
    if (!char) return;

    const select = document.getElementById('monk-talent-select');
    if (!select) return;
    const talentId = select.value;
    if (!talentId) {
        showToast('No learnable talents available.', 'info');
        return;
    }
    window.monkBuyTalent(talentId);
};

// ─── Learn Technique from dropdown ────────────────────────────

window.monkLearnTechniqueFromSelect = function(traditionId) {
    const char = getCharacterData();
    if (!char) return;

    const select = document.getElementById('monk-technique-select');
    if (!select) return;
    const level = select.value;
    if (!level) {
        showToast('No learnable techniques available.', 'info');
        return;
    }
    window.monkBuyTechnique(traditionId, level);
};

// ─── Buy Talent (unchanged – uses confirm for confirmation) ───

window.monkBuyTalent = function(talentId) {
    const char = getCharacterData();
    if (!char) return;

    const talent = getTalentById(talentId);
    if (!talent) return showToast('Talent not found.', 'error');

    if (hasTalent(char, talentId)) {
        showToast('Already learned this talent.', 'warning');
        return;
    }

    const missing = missingPrereqCategory(char, talent.category);
    if (missing) {
        showToast(`Learn a ${CATEGORY_LABELS[missing]} talent first.`, 'error');
        return;
    }

    const totalXp = char.totalXp || 0;
    const spent = char.xpSpent || 0;
    const available = totalXp - spent;

    if (available < talent.xp) {
        showToast(`Not enough XP. Need ${talent.xp}, have ${available} available.`, 'error');
        return;
    }

    if (!confirm(`Learn "${talent.name}" for ${talent.xp} XP?`)) return;

    const wasInitiate = isMonkInitiate(char);

    if (!char.monkTalents) char.monkTalents = [];
    char.monkTalents.push(talentId);
    char.xpSpent = (char.xpSpent || 0) + talent.xp;

    // Grant starting Flow Points on first talent
    if (!wasInitiate) {
        char.flowPoints = getMaxFlowPoints(char);
    }

    saveCharacter({
        monkTalents: char.monkTalents,
        xpSpent: char.xpSpent,
        flowPoints: char.flowPoints
    });

    if (!wasInitiate) {
        showToast(`🥋 You have begun the Way. Learned "${talent.name}"`, 'success');
    } else {
        showToast(`✅ Learned "${talent.name}"`, 'success');
    }
    renderMonks(container);
};

// ─── Legacy Learn Talent (redirects to dropdown) ──────────────

window.monkLearnTalent = function(category) {
    // This used to show a prompt with a list. Now we use the dropdown.
    const select = document.getElementById('monk-talent-select');
    if (select) {
        // Try to filter the dropdown to just this category? We'll just focus it.
        select.focus();
        showToast('Select a talent from the dropdown above.', 'info');
    } else {
        showToast('Please refresh the panel to use the dropdown.', 'info');
    }
};

// ─── Buy Technique (unchanged – uses confirm) ────────────────

window.monkBuyTechnique = async function(traditionId, level) {
    const char = getCharacterData();
    if (!char) return;

    if (!isMonkInitiate(char)) {
        showToast('Learn a Foundation talent before pursuing techniques.', 'error');
        return;
    }

    const traditionData = await findPatronTradition(traditionId);
    if (!traditionData) return showToast('Tradition not found.', 'error');

    const tech = traditionData.tradition.techniques?.[level];
    if (!tech) return showToast('Technique not found.', 'error');

    if (hasTechnique(char, traditionId, level)) {
        showToast('Already learned this technique.', 'warning');
        return;
    }

    if (level === 'advanced' && !hasTechnique(char, traditionId, 'basic')) {
        showToast('Must learn Basic technique first.', 'error');
        return;
    }
    if (level === 'master' && !hasTechnique(char, traditionId, 'advanced')) {
        showToast('Must learn Advanced technique first.', 'error');
        return;
    }

    const xpCost = tech.xp || (level === 'basic' ? 6 : level === 'advanced' ? 8 : 12);
    const totalXp = char.totalXp || 0;
    const spent = char.xpSpent || 0;
    const available = totalXp - spent;

    if (available < xpCost) {
        showToast(`Not enough XP. Need ${xpCost}, have ${available} available.`, 'error');
        return;
    }

    if (!confirm(`Learn "${tech.name}" for ${xpCost} XP?`)) return;

    if (!char.monkTechniques) char.monkTechniques = {};
    if (!char.monkTechniques[traditionId]) char.monkTechniques[traditionId] = [];
    char.monkTechniques[traditionId].push(level);
    char.xpSpent = (char.xpSpent || 0) + xpCost;

    // Recalculate corruption tier
    const traditionDataFull = await getMonasticTraditionData(char);
    const newTier = computeCorruptionTier(char, traditionDataFull);
    char.monkCorruptionTier = newTier;

    saveCharacter({
        monkTechniques: char.monkTechniques,
        xpSpent: char.xpSpent,
        monkCorruptionTier: char.monkCorruptionTier
    });
    showToast(`✅ Learned "${tech.name}"`, 'success');
    renderMonks(container);
};

// ─── Use Technique (send VTT card) ────────────────────────────
// FIX: add async keyword to use await inside

window.monkUseTechnique = async function(traditionId, level) {
    const char = getCharacterData();
    if (!char) return;

    if (!isMonkInitiate(char)) {
        showToast('Learn a Foundation talent first.', 'error');
        return;
    }

    const traditionData = await findPatronTradition(traditionId);
    if (!traditionData) return showToast('Tradition not found.', 'error');

    const tech = traditionData.tradition.techniques?.[level];
    if (!tech) return showToast('Technique not found.', 'error');

    if (!hasTechnique(char, traditionId, level)) {
        showToast('You haven\'t learned this technique.', 'error');
        return;
    }

    const effect = tech.effect || tech.description || 'The technique is performed.';
    const cost = tech.cost || '';
    const name = tech.name || `${level} technique`;
    const patronName = traditionData.patron.name || traditionData.patron.title;
    const patronIcon = traditionData.patron.icon || '🧘';
    const levelLabel = { basic: 'Basic', advanced: 'Advanced', master: 'Master' }[level] || level;

    const cardHtml = buildMonkCardHtml(
        `${levelLabel} Technique: ${name}`,
        patronName,
        patronIcon,
        effect,
        cost,
        `Tradition: ${traditionData.tradition.name}`
    );
    sendVTTMessage(cardHtml);

    showToast(`🧘 Used "${name}" — VTT card sent.`, 'success');
};

// ─── Legacy Learn Technique (redirects to dropdown) ───────────

window.monkLearnTechnique = function(traditionId) {
    const select = document.getElementById('monk-technique-select');
    if (select) {
        select.focus();
        showToast('Select a technique from the dropdown above.', 'info');
    } else {
        showToast('Please refresh the panel to use the dropdown.', 'info');
    }
};

// ─── Refresh ──────────────────────────────────────────────────
//
// FIX: this used to just re-render the panel from whatever patron data was
// already in memory/localStorage, without ever forcing a fresh load — now
// consistent with cantor.js/rites.js/witchcraft.js's refresh behavior.

window.monkRefresh = async function() {
    showToast('🔄 Reloading patron data from disk…', 'info');
    await ensurePatronDataLoaded(true);
    if (container) await renderMonks(container);
    showToast('✅ Monks refreshed.', 'success');
};

// ============================================================
// EXPORT
// ============================================================

export default { renderMonks };