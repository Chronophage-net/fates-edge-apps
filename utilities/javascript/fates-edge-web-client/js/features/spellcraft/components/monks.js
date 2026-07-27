/**
 * Monks – Monastic traditions, meditation, and the Way of the Unstruck Bell
 *
 * Data-driven: traditions are loaded from patron JSON files via the patrons feature.
 * Each patron can have a "monastic_tradition" property that defines the tradition.
 *
 * GATING: Monk is not a magicPath like Cantor/Witch/Summoner — any character can
 * walk the path. Because of that, this module gates itself on whether the
 * character has actually invested in it: nothing beyond a "begin training"
 * prompt renders until the character has learned at least one Foundation
 * talent. This mirrors how Cantor gates on `char.magicPath === 'cantor'`, just
 * keyed off talents instead of a path field, per design.
 *
 * "The fist is a weapon. The open hand is a promise. Learn both before you need either."
 * – Master Tarian Ironhand
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';
import { getState, saveState } from '../../../core/state.js';

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
 * Load patron data from state or fetch from /data/patrons/{patronId}.json
 * Caches the result in state.patrons (by category) and in a local cache.
 */
const patronCache = new Map();

async function loadPatronData(patronId) {
    if (!patronId) return null;

    // Check local cache first
    if (patronCache.has(patronId)) {
        return patronCache.get(patronId);
    }

    const state = getState();

    // Check if already loaded in state.patrons (cosmic/terrestrial/religions)
    let found = null;
    if (state.patrons) {
        if (state.patrons.cosmic) {
            found = state.patrons.cosmic.find(p => p.id === patronId);
        }
        if (!found && state.patrons.terrestrial) {
            found = state.patrons.terrestrial.find(p => p.id === patronId);
        }
        if (!found && state.patrons.religions) {
            for (const religion of state.patrons.religions) {
                if (religion.orders) {
                    found = religion.orders.find(o => o.id === patronId);
                    if (found) break;
                }
            }
        }
    }

    if (found) {
        patronCache.set(patronId, found);
        return found;
    }

    // Not in state – try to fetch from /data/patrons/{patronId}.json
    try {
        const response = await fetch(`./data/patrons/${patronId}.json`);
        if (response.ok) {
            const data = await response.json();
            // Store in state for future use (add to appropriate category)
            if (!state.patrons) state.patrons = {};
            if (!state.patrons.cosmic) state.patrons.cosmic = [];
            // Avoid duplicates
            if (!state.patrons.cosmic.find(p => p.id === patronId)) {
                state.patrons.cosmic.push(data);
            }
            patronCache.set(patronId, data);
            saveState(); // persist so future loads don't refetch
            return data;
        } else {
            console.warn(`Patron data not found: ${patronId}`);
            patronCache.set(patronId, null); // cache miss
            return null;
        }
    } catch (e) {
        console.warn(`Failed to fetch patron data for ${patronId}:`, e);
        patronCache.set(patronId, null);
        return null;
    }
}

// ============================================================
// BREATH STATES (hardcoded – they're universal, not patron-specific)
// ============================================================

const BREATH_STATES = {
    ENTERING: 'entering',
    HOLDING: 'holding',
    RELEASING: 'releasing',
    EMPTY: 'empty'
};

const BREATH_LABELS = {
    [BREATH_STATES.ENTERING]: '🌬️ Entering Breath – Taking in the world',
    [BREATH_STATES.HOLDING]: '🫁 Holding Breath – The pause between',
    [BREATH_STATES.RELEASING]: '💨 Releasing Breath – Action made manifest',
    [BREATH_STATES.EMPTY]: '🌌 Empty Breath – The still point'
};

// ============================================================
// MONASTIC TRADITION LOOKUP
// ============================================================

async function findPatronTradition(patronId) {
    const patronData = await loadPatronData(patronId);
    if (patronData && patronData.monastic_tradition) {
        return { patron: patronData, tradition: patronData.monastic_tradition };
    }
    return null;
}

async function getAllMonasticTraditions() {
    const state = getState();
    const results = [];

    // First, ensure all patrons that might have traditions are loaded
    // We'll need to scan data/patrons directory – but for now, we'll use what's in state
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
// TALENTS (hardcoded – universal to all monks)
// ============================================================

const TALENT_CATEGORY_ORDER = ['foundation', 'working', 'signature', 'quiet'];

const FOUNDATION_TALENTS = [
    {
        id: 'open-hand',
        name: 'The Open Hand',
        xp: 2,
        category: 'foundation',
        description: 'Once per scene, when you attempt to parry, deflect, or disarm an opponent, treat your first Body or Melee roll as Position +1.',
        tags: ['Strike', 'BOD', 'Flow'],
        effect: 'Position +1 on first defensive roll per scene.'
    },
    {
        id: 'still-point',
        name: 'Still Point Stance',
        xp: 2,
        category: 'foundation',
        description: 'When you do not move during your turn, gain +1 die to your next defense roll. This benefit lasts until you move or take an aggressive action.',
        tags: ['Move', 'SPT', 'Flow'],
        effect: '+1 die to defense when standing still.'
    },
    {
        id: 'monks-breath',
        name: "Monk's Breath",
        xp: 2,
        category: 'foundation',
        description: 'Once per session, you may clear 1 Fatigue by meditating for one minute uninterrupted. No roll required.',
        tags: ['Heal', 'SPT', 'Restoration'],
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
        tags: ['Move', 'Flow', 'Gambit'],
        effect: 'Reposition a missing attacker.'
    },
    {
        id: 'unarmoured-body',
        name: 'The Unarmoured Body',
        xp: 4,
        category: 'working',
        description: 'When unarmoured, convert the first point of Harm you would take each scene to Fatigue instead.',
        tags: ['Armour', 'BOD', 'Flow'],
        effect: 'First Harm per scene becomes Fatigue when unarmoured.'
    },
    {
        id: 'pressure-point',
        name: 'Pressure Point Strike',
        xp: 4,
        category: 'working',
        description: 'When you make an unarmed attack, declare a Pressure Point Strike. On a hit, the target suffers -1 die on all physical actions until the end of their next turn.',
        tags: ['Strike', 'AGI', 'Gambit'],
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
        tags: ['Defense', 'Flow', 'Overload'],
        effect: 'Negate one attack per session.',
        cost: 'GM gains 1 Story Beat.'
    },
    {
        id: 'master-open-palm',
        name: 'Master of the Open Palm',
        xp: 5,
        category: 'signature',
        description: 'Once per session, convert a successful unarmed strike into a healing touch instead of dealing Harm. The target clears 1 Fatigue and may remove a minor Condition.',
        tags: ['Strike', 'Combo', 'Restoration'],
        effect: 'Convert strike to healing touch.'
    }
];

const QUIET_TALENT = {
    id: 'stillness-that-moves',
    name: 'The Stillness That Moves',
    xp: 6,
    category: 'quiet',
    description: 'Once per arc, move through a space that should be impassable as if you were never there. You do not break, force, or open. You simply arrive on the other side.',
    tags: ['Move', 'Flow', 'Overload'],
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
        source: result.source,
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
// MEDITATION SYSTEM
// ============================================================

export function performMeditation(char, targetDV = 3) {
    const results = [];
    let sbCount = 0;

    // Use character's actual skills from the data model
    // Skills: body, wits, spirit, presence
    // For meditation, we use:
    // - Settle the Body: Body + Athletics (or just Body + Endurance)
    // - Settle the Breath: Spirit + Insight (for inner awareness)
    // - The Still Point: Spirit + Resolve (using Presence as a stand-in for resolve)

    const body = char.body || 1;
    const athletics = char.skills?.athletics || 0;
    const bodyPool = body + athletics;
    const bodyRoll = rollDice(bodyPool);
    const bodySuccess = bodyRoll >= 2;
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
    const breathRoll = rollDice(breathPool);
    const breathSuccess = breathRoll >= 3;
    results.push({
        step: 'Settle the Breath',
        pool: breathPool,
        success: breathSuccess,
        result: breathSuccess ? '✅ Breath settled.' : '⚠️ Mind wanders. GM gains 1 SB.'
    });
    if (!breathSuccess) sbCount += 1;

    const presence = char.presence || 1;
    const sway = char.skills?.sway || 0;
    // Use Presence + Sway as a stand-in for resolve/meditation
    const stillPool = spirit + presence + Math.floor((insight + sway) / 2);
    const stillRoll = rollDice(stillPool);
    const stillSuccess = stillRoll >= targetDV;
    let partial = false;
    if (stillRoll > 0 && stillRoll < targetDV) partial = true;
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
    } else if (achieved && drained) {
        benefits.push('Clear 1 Fatigue (but mark 1 Fatigue from exhaustion)');
        benefits.push('Net: no Fatigue change');
    } else {
        benefits.push('No benefit. Try again after rest.');
    }

    return { results, achieved, drained, benefits, sbCount };
}

function rollDice(pool) {
    let successes = 0;
    for (let i = 0; i < pool; i++) {
        const roll = Math.floor(Math.random() * 10) + 1;
        if (roll >= 6) successes++;
        if (roll === 10) successes++;
    }
    return successes;
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

    const traditionId = getMonasticTradition(char);
    const traditionData = traditionId ? await getMonasticTraditionData(char) : null;
    const breathState = getBreathState(char);
    const breathScars = getBreathScars(char);

    // Recompute + persist corruption tier from actual investment every render
    const corruptionTier = computeCorruptionTier(char, traditionData);
    if (traditionData && corruptionTier !== (char.monkCorruptionTier || 0)) {
        char.monkCorruptionTier = corruptionTier;
        saveCharacter({ monkCorruptionTier: corruptionTier });
    }

    const allTraditions = await getAllMonasticTraditions();

    el.innerHTML = `
        <div class="monks-container" style="display:flex;flex-direction:column;gap:0.8rem;">
            <!-- Header -->
            <div class="monks-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.2rem;">🧘</span>
                    <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Monastic Path</span>
                    <span style="font-size:0.7rem;color:var(--text3);">${traditionData ? traditionData.patronName : 'No Tradition'}</span>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="window.monkChooseTradition()">📿 Choose Tradition</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.monkMeditate()">🧘 Meditate</button>
                    <button class="btn btn-sm btn-ghost" onclick="window.monkRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- Breath State -->
            <div class="monks-breath" style="display:flex;align-items:center;gap:0.5rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <span style="font-size:1.2rem;">🫁</span>
                <div style="flex:1;">
                    <div style="font-size:0.8rem;font-weight:600;">${BREATH_LABELS[breathState] || 'Unknown Breath'}</div>
                    <div style="font-size:0.7rem;color:var(--text3);">${breathScars.length > 0 ? `⚠️ Breath Scars: ${breathScars.join(', ')}` : 'No breath scars.'}</div>
                </div>
                <button class="btn btn-xs btn-ghost" onclick="window.monkAdvanceBreath()" title="Advance to next breath state">→</button>
            </div>

            <!-- Tradition Display -->
            ${traditionData ? renderTraditionDisplay(traditionData, char) : renderNoTradition(allTraditions)}

            <!-- Meditation Results (if any) -->
            <div id="monk-meditation-results" style="display:none;"></div>

            <!-- Corruption -->
            ${traditionData && corruptionTier > 0 ? renderCorruption(traditionData, corruptionTier) : ''}

            <!-- Talents -->
            <div class="monks-talents" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⚡ Talents & Techniques</span>
                    <div style="display:flex;gap:0.2rem;">
                        <button class="btn btn-xs btn-secondary" onclick="window.monkLearnTalent('foundation')">Foundation</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.monkLearnTalent('working')" ${missingPrereqCategory(char, 'working') ? 'disabled title="Learn a Foundation talent first"' : ''}>Working</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.monkLearnTalent('signature')" ${missingPrereqCategory(char, 'signature') ? 'disabled title="Learn a Working talent first"' : ''}>Signature</button>
                        ${traditionData ? `<button class="btn btn-xs btn-gold" onclick="window.monkLearnTechnique('${traditionId}')">📿 Technique</button>` : ''}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.2rem;">
                    ${renderTalents(char)}
                    ${traditionData ? renderTechniques(traditionData, char) : ''}
                </div>
            </div>

            <!-- Quick Reference -->
            <div class="monks-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.2rem;font-size:0.65rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.4rem;">
                <div>🧘 <strong>Meditate:</strong> Clear Fatigue, gain focus</div>
                <div>⚡ <strong>Flow:</strong> Spend 1 Mental Strain instead of Fatigue</div>
                <div>🛡️ <strong>Stillness:</strong> +1 die to defense when not moving</div>
                <div>📿 <strong>Vow:</strong> Power through restriction</div>
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
}

// ============================================================
// ONBOARDING (shown until a Foundation talent is learned)
// ============================================================

function renderOnboarding(el, char) {
    // Use totalXp or xp field (the character model has totalXp)
    const xp = char.totalXp || 0;
    const spent = char.xpSpent || 0;
    const available = xp - spent;

    el.innerHTML = `
        <div class="monks-container" style="display:flex;flex-direction:column;gap:0.6rem;">
            <div class="monks-header" style="display:flex;align-items:center;gap:0.4rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">
                <span style="font-size:1.2rem;">🧘</span>
                <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Monastic Path</span>
            </div>
            <div class="monks-not-started" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
                <div style="font-size:1.8rem;">🥋</div>
                <p style="color:var(--text2);">You have not yet begun the Way.</p>
                <p style="font-size:0.85rem;">Learning any Foundation talent below opens the monastic path: breath states, meditation, and — once you choose a tradition tied to a patron — techniques and corruption.</p>
                <p style="font-size:0.75rem;">Available XP: <strong style="color:var(--gold);">${available}</strong> (${spent} spent of ${xp})</p>
            </div>
            <div class="monks-foundation-picker" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="font-size:0.85rem;font-weight:600;color:var(--gold);margin-bottom:0.2rem;">Foundation Talents (2 XP)</div>
                <div style="display:flex;flex-direction:column;gap:0.2rem;">
                    ${FOUNDATION_TALENTS.map(t => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.8rem;">
                            <div>
                                <span style="font-weight:600;">${escHtml(t.name)}</span>
                                <span style="font-size:0.65rem;color:var(--text3);">${t.xp} XP</span>
                                <div style="font-size:0.7rem;color:var(--text2);">${escHtml(t.description)}</div>
                            </div>
                            <button class="btn btn-xs btn-primary" onclick="window.monkBuyTalent('${t.id}')">Learn</button>
                        </div>
                    `).join('')}
                </div>
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

    return `
        <div class="monks-tradition" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${tradition.color || 'var(--gold)'};">
            <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                <span style="font-size:1.2rem;">${traditionData.patronIcon}</span>
                <span style="font-weight:600;font-size:0.95rem;">${escHtml(tradition.name)}</span>
                <span style="font-size:0.7rem;color:var(--text3);">Patron: ${escHtml(traditionData.patronName)}</span>
                ${traditionData.religion ? `<span style="font-size:0.6rem;color:var(--text3);">⛪ ${escHtml(traditionData.religion)}</span>` : ''}
            </div>
            <div style="font-size:0.8rem;color:var(--text2);margin:0.2rem 0;">${formatText(tradition.description)}</div>
            ${tradition.debt_resistant_frame ? `<div style="font-size:0.75rem;color:var(--text3);margin-bottom:0.2rem;"><strong>🕸️ Debt Resistance:</strong> ${formatText(tradition.debt_resistant_frame)}</div>` : ''}
            <div style="display:flex;gap:0.3rem;font-size:0.7rem;color:var(--text3);">
                <span ${hasBasic ? 'style="color:var(--green);"' : ''}>${hasBasic ? '✅' : '⬜'} Basic</span>
                <span ${hasAdvanced ? 'style="color:var(--green);"' : ''}>${hasAdvanced ? '✅' : '⬜'} Advanced</span>
                <span ${hasMaster ? 'style="color:var(--gold);"' : ''}>${hasMaster ? '⭐' : '⬜'} Master</span>
            </div>
            ${tradition.quote ? `<blockquote style="margin:0.2rem 0;padding:0.2rem 0.5rem;font-size:0.75rem;color:var(--text3);border-left:2px solid ${tradition.color || 'var(--gold)'};">"${escHtml(tradition.quote)}"</blockquote>` : ''}
        </div>
    `;
}

function renderNoTradition(allTraditions) {
    const list = allTraditions.map(t =>
        `• ${t.patronIcon} ${escHtml(t.patronName)}: ${escHtml(t.tradition.name)}`
    ).join('<br>');

    return `
        <div class="monks-no-tradition" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
            <div style="font-size:1.5rem;">📿</div>
            <p>No monastic tradition chosen.</p>
            <p style="font-size:0.85rem;">Choose a tradition from a patron who offers one:</p>
            <div style="font-size:0.75rem;text-align:left;max-height:100px;overflow-y:auto;padding:0.2rem;background:var(--bg3);border-radius:var(--radius);margin:0.2rem 0;">
                ${list || 'No traditions available. Check your patron JSON files.'}
            </div>
            <button class="btn btn-sm btn-primary" onclick="window.monkChooseTradition()">Choose Tradition</button>
        </div>
    `;
}

function renderTalents(char) {
    const owned = char.monkTalents || [];

    return ALL_TALENTS.map(t => {
        const has = owned.includes(t.id);
        const missing = !has && missingPrereqCategory(char, t.category);
        return `
            <div class="talent-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.8rem;${has ? 'border-left:3px solid var(--gold);background:var(--bg3);' : ''}${missing ? 'opacity:0.5;' : ''}">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span>${has ? '✅' : '⬜'}</span>
                    <span style="${has ? 'font-weight:600;' : ''}">${escHtml(t.name)}</span>
                    <span style="font-size:0.65rem;color:var(--text3);">${t.xp} XP</span>
                    ${t.tags ? `<span style="font-size:0.55rem;color:var(--text2);">${t.tags.join(' ')}</span>` : ''}
                    ${missing ? `<span style="font-size:0.55rem;color:var(--red);">requires ${CATEGORY_LABELS[missing]}</span>` : ''}
                </div>
                ${!has ? `<button class="btn btn-xs btn-secondary" onclick="window.monkBuyTalent('${t.id}')" ${missing ? 'disabled' : ''}>Learn</button>` : ''}
            </div>
        `;
    }).join('');
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

    return levels.map(level => {
        const tech = tradition.techniques?.[level];
        if (!tech) return '';
        const has = hasTechnique(char, patronId, level);
        return `
            <div class="technique-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.8rem;${has ? 'border-left:3px solid ' + (tradition.color || 'var(--gold)') + ';background:var(--bg3);' : ''}">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span>${has ? '✅' : '⬜'}</span>
                    <span style="${has ? 'font-weight:600;' : ''}">${escHtml(tech.name)}</span>
                    <span style="font-size:0.65rem;color:var(--text3);">${xpMap[level] || tech.xp || '?'} XP</span>
                    <span style="font-size:0.6rem;color:var(--text2);">${labels[level]}</span>
                    ${tech.effect ? `<div style="width:100%;font-size:0.65rem;color:var(--text2);">${formatText(tech.effect)}</div>` : ''}
                </div>
                ${!has ? `<button class="btn btn-xs btn-gold" onclick="window.monkBuyTechnique('${patronId}','${level}')">Learn</button>` : ''}
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
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:0.8rem;font-weight:600;color:var(--red);">⚠️ Corruption Tier ${tier} / ${entries.length}</span>
                <span style="font-size:0.7rem;color:var(--text3);">"The path leaves its mark."</span>
            </div>
            <div style="font-size:0.8rem;color:var(--gold);">${formatText(current.benefit)}</div>
            <div style="font-size:0.75rem;color:var(--red);">${formatText(current.cost)}</div>
        </div>
    `;
}

// ============================================================
// GLOBAL FUNCTIONS (onclick handlers)
// ============================================================

window.monkChooseTradition = async function() {
    const char = getCharacterData();
    if (!char) return;

    const allTraditions = await getAllMonasticTraditions();

    if (allTraditions.length === 0) {
        showToast('No monastic traditions found. Check your patron JSON files.', 'error');
        return;
    }

    const options = allTraditions.map((t, i) =>
        `${i + 1}. ${t.patronIcon} ${t.patronName}: ${t.tradition.name}`
    ).join('\n');

    const choice = prompt(
        `Choose a monastic tradition:\n\n${options}\n\nEnter the number of your choice:`,
        '1'
    );

    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= allTraditions.length) {
        showToast('Invalid selection.', 'error');
        return;
    }

    const selected = allTraditions[idx];
    char.monasticTradition = selected.patronId;
    if (!char.monkTechniques) char.monkTechniques = {};
    saveCharacter({
        monasticTradition: selected.patronId,
        monkTechniques: char.monkTechniques
    });
    showToast(`📿 Chosen tradition: ${selected.tradition.name} (${selected.patronName})`, 'success');
    renderMonks(container);
};

window.monkMeditate = function() {
    const char = getCharacterData();
    if (!char) return;

    const targetDV = prompt(
        'Meditation Difficulty:\n' +
        '3 = Clarity (gain +1 die to Wits)\n' +
        '4 = Healing (clear Fatigue, remove Conditions)\n' +
        '5 = Transcendence (reroll a failed roll)',
        '3'
    );

    const dv = safeParseInt(targetDV, 3);
    if (dv < 3 || dv > 5) {
        showToast('Enter a value between 3 and 5.', 'error');
        return;
    }

    const result = performMeditation(char, dv);

    let resultHtml = `
        <div style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;border-left:4px solid ${result.achieved ? 'var(--green)' : 'var(--red)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;">🧘 Meditation Results</span>
                <span style="font-size:0.7rem;color:var(--text3);">DV ${dv}</span>
            </div>
            <div style="font-size:0.8rem;margin:0.2rem 0;">
                ${result.results.map(r => `<div>${r.result}</div>`).join('')}
            </div>
            <div style="font-size:0.85rem;margin:0.2rem 0;${result.achieved ? 'color:var(--green);' : 'color:var(--red);'}">
                ${result.achieved ? '✅ Meditation successful!' : result.drained ? '⚠️ Partial success – drained.' : '❌ Meditation failed.'}
            </div>
            ${result.benefits.length > 0 ? `
                <div style="font-size:0.8rem;color:var(--gold);">
                    <strong>Benefits:</strong> ${result.benefits.join('; ')}
                </div>
            ` : ''}
            ${result.sbCount > 0 ? `
                <div style="font-size:0.7rem;color:var(--text3);">GM gains ${result.sbCount} Story Beat${result.sbCount > 1 ? 's' : ''}.</div>
            ` : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('#monk-meditation-results').style.display='none'">Close</button>
        </div>
    `;

    sessionStorage.setItem('fates-edge-meditation-result', resultHtml);

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

        saveCharacter({
            fatigue: char.fatigue,
            conditions: char.conditions,
            _clarityBonus: char._clarityBonus,
            _transcendenceAvailable: char._transcendenceAvailable
        });

        showToast('🧘 Meditation successful!', 'success');
    } else if (result.achieved && result.drained) {
        showToast('⚠️ Meditation achieved but drained. No net benefit.', 'warning');
    } else {
        showToast('❌ Meditation failed. Try again after rest.', 'error');
    }

    renderMonks(container);
};

window.monkAdvanceBreath = function() {
    const char = getCharacterData();
    if (!char) return;

    const states = Object.values(BREATH_STATES);
    const current = getBreathState(char);
    const idx = states.indexOf(current);
    const next = states[(idx + 1) % states.length];

    char.breathState = next;
    saveCharacter({ breathState: next });
    showToast(`🫁 Advanced to: ${BREATH_LABELS[next]}`, 'success');
    renderMonks(container);
};

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

    // Use available XP (total - spent)
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

    // Recalculate corruption tier after learning
    const traditionData = getMonasticTraditionData(char); // but this is async... we'll handle after save

    // We'll save now, and the render will recalc corruption
    saveCharacter({ monkTalents: char.monkTalents, xpSpent: char.xpSpent });

    if (!wasInitiate) {
        showToast(`🥋 You have begun the Way. Learned "${talent.name}"`, 'success');
    } else {
        showToast(`✅ Learned "${talent.name}"`, 'success');
    }
    renderMonks(container);
};

window.monkLearnTalent = function(category) {
    const char = getCharacterData();
    if (!char) return;

    const talents = TALENTS_BY_CATEGORY[category];
    const categoryName = CATEGORY_LABELS[category];
    if (!talents) {
        showToast('Unknown category.', 'error');
        return;
    }

    const missing = missingPrereqCategory(char, category);
    if (missing) {
        showToast(`Learn a ${CATEGORY_LABELS[missing]} talent first.`, 'error');
        return;
    }

    const owned = char.monkTalents || [];
    const available = talents.filter(t => !owned.includes(t.id));

    if (available.length === 0) {
        showToast(`No unlearned talents in ${categoryName}.`, 'info');
        return;
    }

    const options = available.map(t =>
        `${t.id}: ${t.name} (${t.xp} XP) – ${t.description.substring(0, 50)}...`
    ).join('\n\n');

    const choice = prompt(
        `Learn a ${categoryName} talent:\n\n${options}\n\nEnter talent ID:`,
        available[0]?.id
    );

    if (!choice) return;
    window.monkBuyTalent(choice);
};

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

window.monkLearnTechnique = async function(traditionId) {
    const char = getCharacterData();
    if (!char) return;

    const traditionData = await findPatronTradition(traditionId);
    if (!traditionData) return showToast('Tradition not found.', 'error');

    const levels = ['basic', 'advanced', 'master'];
    const labels = { basic: 'Basic', advanced: 'Advanced', master: 'Master' };
    const xpMap = {
        basic: traditionData.tradition.techniques?.basic?.xp || 6,
        advanced: traditionData.tradition.techniques?.advanced?.xp || 8,
        master: traditionData.tradition.techniques?.master?.xp || 12
    };

    const available = levels.filter(l => !hasTechnique(char, traditionId, l));

    if (available.length === 0) {
        showToast('All techniques learned!', 'info');
        return;
    }

    const canLearn = available.filter(l => {
        if (l === 'advanced' && !hasTechnique(char, traditionId, 'basic')) return false;
        if (l === 'master' && !hasTechnique(char, traditionId, 'advanced')) return false;
        return true;
    });

    if (canLearn.length === 0) {
        showToast('Must learn Basic technique first.', 'error');
        return;
    }

    const options = canLearn.map(l =>
        `${l}: ${traditionData.tradition.techniques[l].name} (${labels[l]}, ${xpMap[l]} XP)`
    ).join('\n');

    const choice = prompt(
        `Learn a technique:\n\n${options}\n\nEnter level (basic/advanced/master):`,
        canLearn[0]
    );

    if (!choice) return;
    window.monkBuyTechnique(traditionId, choice);
};

window.monkRefresh = function() {
    if (container) renderMonks(container);
    showToast('🔄 Monks refreshed.', 'info');
};

// ============================================================
// EXPORT
// ============================================================

export default { renderMonks };