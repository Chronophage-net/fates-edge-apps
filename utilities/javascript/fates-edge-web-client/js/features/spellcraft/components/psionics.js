/**
 * Psionics – The Silent Ledger
 * 
 * "I carry no Symbol. My ledger is my skull, and it comes due in headaches,
 *  not obligations."
 * – The Gray Wanderer
 * 
 * Features:
 * - Nine Psionic Arts (Telekinesis, Telepathy, Clairvoyance, Biofeedback,
 *   Astral Projection, Psychic Assault, Mind Shield, Empathic Manipulation,
 *   Precognition)
 * - Mental Strain track (size = Spirit, min 2)
 * - Psionics skill (0–5) gates access and improves control
 * - Story Beat generation from Mental Strain
 * - Silent Orders as talents (Unstruck Bell, Empty Circle, Shared Breath)
 * - Learn/Unlearn Arts as talents
 * - Use Art modal with DV, target, and modifiers
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml } from '../../../core/utils.js';
import { getState, saveState } from '../../../core/state.js';
import { showToast } from '../../../components/Toast.js';
import { performRoll } from '../../../core/dice.js';

// ============================================================
// ART DEFINITIONS
// ============================================================

const ARTS = {
    telekinesis: {
        id: 'telekinesis',
        label: 'Telekinesis',
        keyAttribute: 'spirit',
        alternateAttribute: 'wits',
        description: 'Move objects with the mind. Lift, push, pull, or manipulate.',
        baseDv: 2,
        strainCost: 1, // per scene, or per use? We'll handle per use based on effect
        effectExamples: [
            'Light object (cup, tool): DV 2, Strain 1',
            'Medium object (furniture, person): DV 4, Strain 2',
            'Heavy object (cart, boulder): DV 5+, Strain 3'
        ],
        sbModifiers: {
            light: 0,
            medium: 1,
            heavy: 2
        }
    },
    telepathy: {
        id: 'telepathy',
        label: 'Telepathy',
        keyAttribute: 'wits',
        alternateAttribute: 'presence',
        description: 'Read minds, communicate silently, or implant thoughts.',
        baseDv: 2,
        strainCost: 1,
        effectExamples: [
            'Surface thoughts: DV 2, Strain 1',
            'Emotional state: DV 3, Strain 1',
            'Deep memories: DV 5, Strain 2'
        ],
        sbModifiers: {
            surface: 0,
            emotional: 1,
            deep: 2
        }
    },
    clairvoyance: {
        id: 'clairvoyance',
        label: 'Clairvoyance',
        keyAttribute: 'wits',
        alternateAttribute: 'spirit',
        description: 'Perceive distant or hidden things. Scry locations, see through obstacles.',
        baseDv: 2,
        strainCost: 1,
        effectExamples: [
            'Near range (within sight): DV 2, Strain 1',
            'Distant (beyond sight): DV 4, Strain 2',
            'Complex scry (detailed): DV 5+, Strain 3'
        ],
        sbModifiers: {
            near: 0,
            distant: 1,
            complex: 2
        }
    },
    biofeedback: {
        id: 'biofeedback',
        label: 'Biofeedback',
        keyAttribute: 'spirit',
        alternateAttribute: 'wits',
        description: 'Control bodily functions. Heal wounds, purge toxins, enhance physical performance.',
        baseDv: 2,
        strainCost: 1,
        effectExamples: [
            'Stabilize, close minor wounds: DV 2, Strain 1',
            'Heal up to Psionics levels in Harm: DV 3, Strain 2',
            'Major healing or physical enhancement: DV 4+, Strain 3'
        ],
        sbModifiers: {
            minor: 0,
            moderate: 1,
            major: 2
        }
    },
    astralProjection: {
        id: 'astralProjection',
        label: 'Astral Projection',
        keyAttribute: 'spirit',
        alternateAttribute: 'wits',
        description: 'Project your consciousness outside your body. Travel as a shade.',
        baseDv: 3,
        strainCost: 1, // per scene
        effectExamples: [
            'Near range (within sight): DV 3, Strain 1 per scene',
            'Distant (beyond sight): DV 5, Strain 2 per scene',
            'Extended (multiple scenes): +1 SB per additional scene'
        ],
        sbModifiers: {
            near: 1,
            distant: 2,
            extended: 1 // per extra scene
        }
    },
    psychicAssault: {
        id: 'psychicAssault',
        label: 'Psychic Assault',
        keyAttribute: 'spirit',
        alternateAttribute: 'wits',
        description: 'Attack a target’s mind directly, bypassing physical armor.',
        baseDv: 2,
        strainCost: 1,
        effectExamples: [
            'Minor assault (stun, headache): DV 2, Strain 1',
            'Moderate assault (mental Harm 1): DV 4, Strain 2',
            'Severe assault (Harm 2+): DV 5+, Strain 3'
        ],
        sbModifiers: {
            minor: 1,
            moderate: 2,
            severe: 3
        }
    },
    mindShield: {
        id: 'mindShield',
        label: 'Mind Shield',
        keyAttribute: 'wits',
        alternateAttribute: 'spirit',
        description: 'Protect yourself or others from mental intrusion and psychic attacks.',
        baseDv: 2,
        strainCost: 1,
        effectExamples: [
            'Self only: DV 2, Strain 1',
            'Protect one ally: DV 3, Strain 2',
            'Area shield (Near range): DV 4+, Strain 3'
        ],
        sbModifiers: {
            self: 0,
            ally: 1,
            area: 2
        }
    },
    empathicManipulation: {
        id: 'empathicManipulation',
        label: 'Empathic Manipulation',
        keyAttribute: 'presence',
        alternateAttribute: 'wits',
        description: 'Sway emotions, calm rage, or inspire courage.',
        baseDv: 2,
        strainCost: 1,
        effectExamples: [
            'Subtle nudge (calm nerves): DV 2, Strain 1',
            'Moderate shift (calm a crowd): DV 4, Strain 2',
            'Strong manipulation (break morale): DV 5+, Strain 3'
        ],
        sbModifiers: {
            subtle: 0,
            moderate: 1,
            strong: 2
        }
    },
    precognition: {
        id: 'precognition',
        label: 'Precognition',
        keyAttribute: 'spirit',
        alternateAttribute: 'wits',
        description: 'Glimpse future possibilities. Gain advantage on rolls or avoid dangers.',
        baseDv: 2,
        strainCost: 1,
        effectExamples: [
            'Minor glimpse (advantage on next roll): DV 2, Strain 1',
            'Moderate (avoid a specific danger): DV 4, Strain 2',
            'Detailed (see multiple branches): DV 5+, Strain 3'
        ],
        sbModifiers: {
            minor: 1,
            moderate: 2,
            detailed: 3
        }
    }
};

// ============================================================
// SILENT ORDERS (as talents)
// ============================================================

const SILENT_ORDERS = [
    {
        id: 'order-unstruck-bell',
        label: 'Order of the Unstruck Bell',
        description: 'Aelerian monks who maintain quiet zones. You carry a null-bell that only you can hear.',
        mechanics: [
            'Once per session, ring your null-bell to gain +1 Position on a single Mind Shield or Telepathy roll.',
            'Resonant Exhale: Once per scene, reduce Mental Strain by 1 (min 0). The GM gains 1 Story Beat.',
            'Gallery-Bound: Ignore first level of environmental penalty from underground or confined spaces when using psionic Arts.'
        ],
        cost: 6
    },
    {
        id: 'order-empty-circle',
        label: 'Order of the Empty Circle',
        description: 'Nomadic monks of the Violet Steppe who meditate in a psionics-null zone.',
        mechanics: [
            'Circle-Trained: Once per session, when you would generate a Story Beat from Mental Strain on a non-psionic roll, cancel that SB by marking 1 Fatigue.',
            'Still Mind: For a scene, you may choose to operate at reduced capacity: non-psionic actions generate 1 fewer SB from Mental Strain, but you cannot use any Art above Tier I (DV 2–3).',
            'Herd Sense: Gain +1 die to detect emotional states (anger, fear, calm) in any creature within Near range.'
        ],
        cost: 6
    },
    {
        id: 'order-shared-breath',
        label: 'Order of the Shared Breath',
        description: 'Island monks who practice paired meditation, sharing Mental Strain across a Circle.',
        mechanics: [
            'Circle Bond: Form a mental link with up to 3 willing allies (they need not be psions). The link lasts for one scene.',
            'Shared Burden: When you generate Mental Strain, you may transfer any amount to another Circle member within Near range. The GM gains 1 Story Beat each time you use this technique.',
            "Circle's Breath: While linked, all linked members gain +1 die to all psionic rolls; if one member fails a Resolve test against fear or mental intrusion, all members test at +1 DV."
        ],
        cost: 6
    }
];

// ============================================================
// TALENT LOADER (includes psionic talents)
// ============================================================

async function loadPsionTalents() {
    try {
        const response = await fetch('./data/wiki.json');
        if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
                return data.data.filter(entry =>
                    entry.tags &&
                    Array.isArray(entry.tags) &&
                    (entry.tags.includes('psion') || entry.tags.includes('magic')) &&
                    (entry.tags.includes('talent') || entry.tags.includes('prestige') || entry.tags.includes('epic'))
                );
            }
        }
    } catch (e) {
        console.warn('Could not load wiki.json for Psion talents.');
    }
    return getFallbackPsionTalents();
}

function getFallbackPsionTalents() {
    return [
        {
            id: 'craft-of-the-psion',
            title: 'Craft of the Psion',
            category: 'magic',
            body: 'Required for Psion. Grants access to Psionic Arts and the Mental Strain track. You gain the Psionics skill at rating 1 and may learn Arts as talents.',
            tags: ['talent', 'magic', 'psion'],
            cost: 4
        },
        {
            id: 'telekinetic-mastery',
            title: 'Telekinetic Mastery',
            category: 'magic',
            body: 'Once per session, reroll a failed Telekinesis roll. In addition, reduce the DV of Telekinesis effects by 1 (min 2).',
            tags: ['talent', 'magic', 'psion'],
            cost: 6
        },
        {
            id: 'mental-fortress',
            title: 'Mental Fortress',
            category: 'magic',
            body: '+1 die to resist mental intrusion. Once per session, you may ignore the first Mental Strain cost of a Mind Shield effect.',
            tags: ['talent', 'magic', 'psion'],
            cost: 5
        },
        {
            id: 'psychic-reservoir',
            title: 'Psychic Reservoir',
            category: 'magic',
            body: 'You may store up to 2 Mental Strain as "reserve" that does not count toward your maximum. This reserve can be used to pay strain costs, but it recovers only after a full night’s rest.',
            tags: ['talent', 'magic', 'psion'],
            cost: 8
        },
        {
            id: 'thought-thief',
            title: 'Thought Thief',
            category: 'magic',
            body: 'When you successfully read a target’s deep memories with Telepathy, you may learn one of their Strings (a secret, a bond, a weakness). The GM must reveal it.',
            tags: ['talent', 'magic', 'psion'],
            cost: 7
        },
        {
            id: 'echo-dampener',
            title: 'Echo Dampener',
            category: 'magic',
            body: 'Once per scene, you may reduce the Story Beat generation from a failed psionic roll by 1 (minimum 0). Mark 1 Fatigue to do so.',
            tags: ['talent', 'magic', 'psion'],
            cost: 5
        },
        // Silent Orders as talents (they are learnable)
        ...SILENT_ORDERS.map(o => ({
            id: o.id,
            title: o.label,
            category: 'magic',
            body: o.description + '<br><br>' + o.mechanics.map(m => '• ' + m).join('<br>'),
            tags: ['talent', 'magic', 'psion', 'order'],
            cost: o.cost
        }))
    ];
}

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
        if (val.text) return safeString(val.text);
        if (val.quote) return safeString(val.quote);
        if (val.lore) return safeString(val.lore);
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

function getArtDisplay(artId) {
    return ARTS[artId] || null;
}

function getPsionicsSkill(char) {
    return char.psionics || 0;
}

function getMentalStrain(char) {
    return char.mentalStrain || 0;
}

function getMentalStrainMax(char) {
    return Math.max(2, char.spirit || 1);
}

function getLearnedArts(char) {
    return char.learnedArts || [];
}

function getSilentOrder(char) {
    // Returns the order id if learned (first one found)
    const learned = char.learnedTalents || [];
    for (const order of SILENT_ORDERS) {
        if (learned.includes(order.id)) {
            return order.id;
        }
    }
    return null;
}

// ============================================================
// MAIN RENDER
// ============================================================

export async function renderPsion(el) {
    const char = getCharacterData();
    if (!char || char.magicPath !== 'psion') {
        el.innerHTML = `
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧠</div>
                <p>Psionics interface is only available for Psions.</p>
                <p style="font-size:0.85rem;">Select a character with the Psion magic path.</p>
            </div>
        `;
        return;
    }

    // Ensure psionics skill exists
    if (char.psionics === undefined) char.psionics = 0;
    if (char.mentalStrain === undefined) char.mentalStrain = 0;
    if (char.learnedArts === undefined) char.learnedArts = [];

    const psionicsSkill = getPsionicsSkill(char);
    const mentalStrain = getMentalStrain(char);
    const mentalStrainMax = getMentalStrainMax(char);
    const strainPct = Math.min(100, (mentalStrain / mentalStrainMax) * 100);
    const learnedArts = getLearnedArts(char);
    const learnedTalents = char.learnedTalents || [];
    const order = getSilentOrder(char);

    const talents = await loadPsionTalents();

    // Check if Craft of the Psion is learned
    const hasCraft = learnedTalents.includes('craft-of-the-psion');

    let html = `
        <div class="psion-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="psion-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🧠</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--blue);">Psion</span>
                        ${order ? `<span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">(${SILENT_ORDERS.find(o => o.id === order)?.label || order})</span>` : ''}
                        <span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">Skill: ${psionicsSkill}</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.psionRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Mental Strain Track ────────────────────────── -->
            <div class="psion-strain-track" style="background:var(--bg2);border-radius:var(--radius);padding:0.4rem 0.6rem;border-left:4px solid var(--blue);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span style="font-size:0.85rem;font-weight:600;color:var(--blue);">🧠 Mental Strain</span>
                        <span style="font-size:0.8rem;font-weight:600;">${mentalStrain}/${mentalStrainMax}</span>
                        ${mentalStrain >= mentalStrainMax ? `<span style="font-size:0.7rem;color:var(--red);font-weight:600;">⚠️ OVERFLOW – Risk of Harm!</span>` : ''}
                    </div>
                    <div style="display:flex;gap:0.2rem;align-items:center;">
                        <button class="btn btn-xs btn-secondary" onclick="window.psionAdjustStrain(1)" title="Increase Strain">+</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.psionAdjustStrain(-1)" title="Decrease Strain">−</button>
                    </div>
                </div>
                <div style="width:100%;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-top:0.2rem;">
                    <div style="width:${strainPct}%;height:100%;background:${strainPct > 80 ? 'var(--red)' : 'var(--blue)'};border-radius:4px;transition:width 0.3s ease;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">
                    <span>Arts learned: ${learnedArts.length}</span>
                    <span>${hasCraft ? '✅ Craft of the Psion' : '❌ Craft of the Psion required'}</span>
                </div>
            </div>

            <!-- ─── Arts List ───────────────────────────────────── -->
            <div class="psion-arts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--blue);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;flex-wrap:wrap;gap:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--blue);">🧩 Psionic Arts</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${Object.keys(ARTS).length} arts · ${learnedArts.length} learned</span>
                </div>
                ${!hasCraft ? `
                    <div style="padding:0.3rem;background:rgba(212,175,55,0.15);border-radius:var(--radius);font-size:0.75rem;color:var(--gold);margin-bottom:0.3rem;">
                        ⚠️ You need the <strong>Craft of the Psion</strong> talent to use psionic Arts.
                    </div>
                ` : ''}
                <div id="psion-arts-container" style="display:flex;flex-direction:column;gap:0.3rem;">
                    ${Object.entries(ARTS).map(([artId, art]) => {
                        const isLearned = learnedArts.includes(artId);
                        return `
                            <div class="psion-art-item" style="background:var(--bg3);border-radius:var(--radius);padding:0.2rem 0.5rem;border-left:3px solid ${isLearned ? 'var(--blue)' : 'var(--text3)'};${isLearned ? '' : 'opacity:0.5;'}">
                                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                                    <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                                        <span style="font-weight:600;font-size:0.85rem;">${escHtml(art.label)}</span>
                                        <span style="font-size:0.6rem;color:var(--text3);">${escHtml(art.keyAttribute)}</span>
                                        ${isLearned ? `<span style="font-size:0.55rem;color:var(--blue);">✓ Learned</span>` : `<span style="font-size:0.55rem;color:var(--text3);">Not learned</span>`}
                                    </div>
                                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                                        ${isLearned ? `
                                            <button class="btn btn-xs btn-primary" onclick="window.psionUseArt('${artId}')" title="Use this Art">⚡ Use</button>
                                        ` : ''}
                                        <button class="btn btn-xs ${isLearned ? 'btn-secondary' : 'btn-primary'}" onclick="window.psionToggleArt('${artId}')" style="font-size:0.55rem;padding:0.05rem 0.3rem;">
                                            ${isLearned ? '✕ Unlearn' : '✓ Learn'}
                                        </button>
                                    </div>
                                </div>
                                <div style="font-size:0.7rem;color:var(--text2);margin-top:0.1rem;">${escHtml(art.description)}</div>
                                <div style="font-size:0.65rem;color:var(--text3);margin-top:0.05rem;display:flex;flex-wrap:wrap;gap:0.2rem 0.5rem;">
                                    ${art.effectExamples.map(e => `<span>${escHtml(e)}</span>`).join(' · ')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- ─── Psion Talents ───────────────────────────────── -->
            <div class="psion-talents" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--blue);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--blue);">⚡ Psion Talents</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${talents.length} talents · ${learnedTalents.length} learned</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:200px;overflow-y:auto;font-size:0.75rem;">
                    ${talents.map(t => {
                        const name = safeString(t.title || t.name);
                        const description = safeString(t.body || t.description);
                        const cost = t.cost || '?';
                        const isLearned = learnedTalents.includes(t.id || name);
                        const isOrder = t.tags && t.tags.includes('order');
                        return `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);${isLearned ? 'background:var(--bg3);border-left:3px solid var(--blue);' : ''}">
                                <div style="flex:1;min-width:0;">
                                    <span style="font-weight:${isLearned ? '600' : '400'};color:${isLearned ? 'var(--blue)' : 'var(--text)'};">${escHtml(name)}</span>
                                    ${isLearned ? `<span style="font-size:0.55rem;color:var(--blue);margin-left:0.2rem;">✓ Learned</span>` : ''}
                                    ${isOrder ? `<span style="font-size:0.55rem;color:var(--gold);margin-left:0.2rem;">🏛️ Order</span>` : ''}
                                    <div style="font-size:0.65rem;color:var(--text2);">${formatText(description)}</div>
                                </div>
                                <div style="display:flex;align-items:center;gap:0.2rem;flex-shrink:0;margin-left:0.3rem;">
                                    <span style="font-size:0.65rem;color:var(--gold);">${cost} XP</span>
                                    <button class="btn btn-xs ${isLearned ? 'btn-secondary' : 'btn-primary'}" onclick="window.psionToggleTalent('${escHtml(t.id || name)}')" style="font-size:0.55rem;padding:0.05rem 0.3rem;">
                                        ${isLearned ? '✕ Unlearn' : '✓ Learn'}
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="font-size:0.6rem;color:var(--text3);margin-top:0.15rem;">Talents are learned with XP during downtime.</div>
            </div>

            <!-- ─── Psion Wisdom ─────────────────────────────────── -->
            <div class="psion-wisdom" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--blue);">
                <div style="display:flex;flex-direction:column;gap:0.1rem;">
                    <div style="font-size:0.7rem;color:var(--text3);font-style:italic;">
                        "I carry no Symbol. My ledger is my skull, and it comes due in headaches, not obligations."
                        <span style="display:block;text-align:right;font-size:0.6rem;color:var(--text2);">— The Gray Wanderer</span>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;font-size:0.6rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.15rem;">
                        <span>🧠 <strong>Mental Strain:</strong> Overflow causes Harm</span>
                        <span>🎲 <strong>Story Beats:</strong> Each 1 on a psionic roll generates SB</span>
                        <span>🔒 <strong>Silent Orders:</strong> Specialized training</span>
                    </div>
                </div>
            </div>

        </div>
    `;

    el.innerHTML = html;
}

// ============================================================
// USE ART MODAL
// ============================================================

window.psionUseArt = function(artId) {
    const char = getCharacterData();
    if (!char) return;

    const art = getArtDisplay(artId);
    if (!art) {
        showToast('Art not found.', 'error');
        return;
    }

    const psionicsSkill = getPsionicsSkill(char);
    if (psionicsSkill < 1) {
        showToast('You need at least 1 point in Psionics skill to use Arts.', 'error');
        return;
    }

    const learnedArts = getLearnedArts(char);
    if (!learnedArts.includes(artId)) {
        showToast('You have not learned this Art.', 'error');
        return;
    }

    // Build modal for selecting effect level, target, modifiers
    const modalHtml = `
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
            <h3 style="margin:0;color:var(--blue);">⚡ ${escHtml(art.label)}</h3>
            <p style="font-size:0.8rem;color:var(--text2);">${escHtml(art.description)}</p>
            <div>
                <label style="font-size:0.75rem;font-weight:600;">Effect Level / Scope</label>
                <select id="psion-effect-level" style="width:100%;padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
                    ${art.effectExamples.map((ex, i) => {
                        // Parse DV from example (e.g., "DV 2")
                        const dvMatch = ex.match(/DV (\d+)/);
                        const dv = dvMatch ? parseInt(dvMatch[1]) : 2;
                        const strainMatch = ex.match(/Strain (\d+)/);
                        const strain = strainMatch ? parseInt(strainMatch[1]) : 1;
                        return `<option value="${i}" data-dv="${dv}" data-strain="${strain}">${escHtml(ex)}</option>`;
                    }).join('')}
                </select>
            </div>
            <div>
                <label style="font-size:0.75rem;font-weight:600;">Target / Modifiers (optional)</label>
                <input type="text" id="psion-target" placeholder="e.g., the guard, the door, myself" style="width:100%;padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
            </div>
            <div style="display:flex;gap:0.5rem;">
                <button class="btn btn-primary" id="psion-use-confirm">⚡ Use Art</button>
                <button class="btn btn-secondary" id="psion-use-cancel">Cancel</button>
            </div>
        </div>
    `;

    showToastWithHTML(modalHtml, 'info');

    // Attach events after modal render
    setTimeout(() => {
        const confirmBtn = document.getElementById('psion-use-confirm');
        const cancelBtn = document.getElementById('psion-use-cancel');
        const levelSelect = document.getElementById('psion-effect-level');
        const targetInput = document.getElementById('psion-target');

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const selectedIndex = parseInt(levelSelect.value);
                const option = levelSelect.options[selectedIndex];
                const dv = parseInt(option.dataset.dv) || 2;
                const strainCost = parseInt(option.dataset.strain) || 1;
                const target = targetInput.value.trim() || 'a target';

                // Perform the psionic action
                performPsionicAction(char, artId, dv, strainCost, target);

                // Close the toast
                const toast = document.querySelector('.toast-container')?.lastElementChild;
                if (toast) toast.remove();
            });
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                const toast = document.querySelector('.toast-container')?.lastElementChild;
                if (toast) toast.remove();
            });
        }
    }, 100);
};

// ============================================================
// PERFORM PSIONIC ACTION
// ============================================================

function performPsionicAction(char, artId, dv, strainCost, target) {
    const art = getArtDisplay(artId);
    if (!art) {
        showToast('Art not found.', 'error');
        return;
    }

    const psionicsSkill = getPsionicsSkill(char);
    const keyAttr = char[art.keyAttribute] || 1;
    const pool = keyAttr + psionicsSkill;

    // Check Mental Strain capacity
    const mentalStrain = getMentalStrain(char);
    const mentalStrainMax = getMentalStrainMax(char);
    if (mentalStrain + strainCost > mentalStrainMax) {
        // Overflow: cannot pay strain, must convert to Fatigue or Harm
        const overflow = (mentalStrain + strainCost) - mentalStrainMax;
        // For simplicity, offer to convert to Fatigue (2 per point) or Harm (1 per point)
        const fatigueCost = overflow * 2;
        const harmCost = overflow;
        // We'll ask the user to confirm
        const confirmMsg = `Mental Strain would overflow by ${overflow} points. You can either:\n- Pay ${fatigueCost} Fatigue (standard conversion)\n- Pay ${harmCost} Harm (Stress)\n\nChoose "OK" to pay Fatigue, "Cancel" to pay Harm.`;
        if (!confirm(confirmMsg)) {
            // Pay Harm
            const newHarm = (char.harm || 0) + harmCost;
            char.harm = newHarm;
            // Set mental strain to max
            char.mentalStrain = mentalStrainMax;
            showToast(`Overflow converted to Harm ${harmCost}. Mental Strain set to max.`, 'error');
        } else {
            // Pay Fatigue
            const newFatigue = (char.fatigue || 0) + fatigueCost;
            char.fatigue = newFatigue;
            char.mentalStrain = mentalStrainMax;
            showToast(`Overflow converted to Fatigue ${fatigueCost}. Mental Strain set to max.`, 'warning');
        }
        // Save and refresh
        saveCharacter({ mentalStrain: char.mentalStrain, harm: char.harm, fatigue: char.fatigue });
        window.psionRefresh();
        return;
    }

    // Roll
    const rollResult = performRoll(pool, dv);
    const success = rollResult.successes >= dv;
    const sb = rollResult.storyBeats || 0;

    // Apply Mental Strain
    char.mentalStrain = mentalStrain + strainCost;

    // Apply Story Beats (GM can use them)
    // For now, just display them

    // Determine outcome message
    let outcome = success ? '✅ Success' : '❌ Failure';
    let outcomeColor = success ? 'var(--gold)' : 'var(--red)';
    let detail = success ? `The ${art.label} resolves with ${rollResult.successes} successes.` : `The ${art.label} falters with ${rollResult.successes}/${dv} successes.`;
    if (sb > 0) detail += ` ${sb} Story Beats generated.`;

    // Apply any special effects based on success (narrative)
    // We'll just show the result

    showToastWithHTML(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;font-size:1rem;color:${outcomeColor};">${outcome}</span>
                <span style="font-size:0.75rem;color:var(--text3);">🧠 Psionics</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">"${escHtml(art.label)}" on ${escHtml(target)}</div>
            <div style="font-size:0.75rem;color:var(--text2);">${detail}</div>
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;">
                <span style="color:var(--blue);">🧠 Mental Strain +${strainCost}</span>
                <span style="color:var(--text3);margin-left:0.5rem;">(${char.mentalStrain}/${getMentalStrainMax(char)})</span>
                ${sb > 0 ? `<span style="color:var(--gold);margin-left:0.5rem;">🎲 ${sb} SB</span>` : ''}
            </div>
            ${char.mentalStrain >= getMentalStrainMax(char) ? '<div style="color:var(--red);font-weight:600;font-size:0.8rem;">⚠️ Mental Strain at maximum! Further strain will cause Harm or Fatigue.</div>' : ''}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `, success ? 'success' : 'warning');

    // Save character
    saveCharacter({ mentalStrain: char.mentalStrain });
    window.psionRefresh();
}

// ============================================================
// TOGGLE ART
// ============================================================

window.psionToggleArt = function(artId) {
    const char = getCharacterData();
    if (!char) return;

    if (!char.learnedArts) char.learnedArts = [];

    const index = char.learnedArts.indexOf(artId);
    if (index >= 0) {
        char.learnedArts.splice(index, 1);
        showToast(`Unlearned: ${artId}`, 'info');
    } else {
        // Check if Craft of the Psion is learned
        const learnedTalents = char.learnedTalents || [];
        if (!learnedTalents.includes('craft-of-the-psion')) {
            showToast('You must learn Craft of the Psion first.', 'error');
            return;
        }
        char.learnedArts.push(artId);
        showToast(`Learned Art: ${artId}`, 'success');
    }

    saveCharacter({ learnedArts: char.learnedArts });
    window.psionRefresh();
};

// ============================================================
// TOGGLE TALENT
// ============================================================

window.psionToggleTalent = function(talentId) {
    const char = getCharacterData();
    if (!char) return;

    if (!char.learnedTalents) char.learnedTalents = [];

    const index = char.learnedTalents.indexOf(talentId);
    if (index >= 0) {
        // Unlearn
        // If it's an order, remove its effects
        if (SILENT_ORDERS.some(o => o.id === talentId)) {
            // Clear any order-specific flags? Not needed, but we might want to remove the order from char.
            // We'll just treat it as a talent removal.
        }
        char.learnedTalents.splice(index, 1);
        showToast(`Unlearned: ${talentId}`, 'info');
    } else {
        // Learn
        char.learnedTalents.push(talentId);
        // If it's the Craft of the Psion, grant Psionics skill 1 if not already
        if (talentId === 'craft-of-the-psion') {
            if (!char.psionics || char.psionics < 1) {
                char.psionics = 1;
                showToast('Craft of the Psion learned! Psionics skill set to 1.', 'success');
            }
        }
        // If it's an order, we might want to set a flag
        // No additional action needed.
        showToast(`Learned: ${talentId} ✨`, 'success');
    }

    saveCharacter({ learnedTalents: char.learnedTalents, psionics: char.psionics });
    window.psionRefresh();
};

// ============================================================
// ADJUST STRAIN
// ============================================================

window.psionAdjustStrain = function(amount) {
    const char = getCharacterData();
    if (!char) return;

    const current = getMentalStrain(char);
    const max = getMentalStrainMax(char);
    let newStrain = Math.max(0, Math.min(current + amount, max));
    if (amount > 0 && current >= max) {
        showToast('Mental Strain already at maximum!', 'warning');
        return;
    }
    char.mentalStrain = newStrain;
    saveCharacter({ mentalStrain: char.mentalStrain });
    window.psionRefresh();
    showToast(`Mental Strain: ${newStrain}/${max}`, 'info');
};

// ============================================================
// REFRESH
// ============================================================

window.psionRefresh = function() {
    const el = document.querySelector('.psion-container')?.parentElement || document.getElementById('spellcraft-content');
    if (el) {
        renderPsion(el);
    }
    showToast('🔄 Psionics refreshed.', 'info');
};

// ============================================================
// TOAST WITH HTML (shared)
// ============================================================

function showToastWithHTML(html, type = 'info') {
    if (typeof window.spellbookShowToastWithHTML === 'function') {
        window.spellbookShowToastWithHTML(html, type);
        return;
    }

    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 80vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.textContent = `
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 12000);
}

// ============================================================
// EXPORT
// ============================================================

export default { renderPsion };
