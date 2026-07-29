/**
 * Spellbook – The Weave's Grimoire
 *
 * "The Weave respects repetition. Record your spells. Learn from your failures.
 *  A spell written twice is a spell remembered. A spell cast thrice is a spell mastered."
 * – Lysandra of the Amber Gate
 *
 * Features:
 * - Grimoire-style visual design with parchment textures
 * - Spell templates library with dropdown selection
 * - Signature spells with mechanical benefits (+1 die when casting)
 * - Tag color coding and definitions from the TAGS system
 * - Usage tracking with statistics (success rate, most used spells)
 * - Filter by tags, signature, source, and search
 * - Copy/clone spells for easy variation
 * - Import/Export with full metadata
 * - Integration with TAGS Calculator (save directly from calculator)
 * - Spell research: learn new spells during downtime
 * - Casting with full dice roll, story beats, and backlash handling
 *
 * Available to all characters for collection and study.
 * CASTING requires the Free Caster magic path.
 *
 * All selection modals (templates, categories, attribute choice) have been
 * replaced with inline dropdowns. Text-entry prompts (name, description, tags)
 * remain as simple prompt() calls.
 *
 * ────────────────────────────────────────────────────────────────────────
 * BUGFIX NOTE: window.spellbookPromptCategory() and
 * window.spellbookPromptAttribute() are both written to return a Promise
 * (they show a toast with a dropdown + Confirm/Cancel and resolve() when
 * the player answers). spellbookEdit() correctly `await`s them. But
 * spellbookAddSpell(), spellbookFromTags(), and spellbookUse() were NOT
 * declared `async` and never awaited these calls — so `category` /
 * `attributeChoice` held the pending Promise object itself, not the
 * eventual answer:
 *   - New spells from Add/From Tags got `category` set to a Promise
 *     object rather than a real category string (the `=== null` cancel
 *     check could also never fire, since a Promise is never `null`).
 *   - Casting a spell via spellbookUse() ran the roll IMMEDIATELY using
 *     the un-resolved Promise, before the attribute-choice dropdown the
 *     player was looking at had even been answered — `attributeChoice ===
 *     'spirit'` was always false, so casting silently always used Wits no
 *     matter what the player picked, and the Cancel path never worked.
 * Fixed by making these three functions `async` and awaiting the prompts,
 * matching the pattern spellbookEdit() already used correctly.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ────────────────────────────────────────────────────────────────────────
 * NEW: The Grimoire is now a magic-path-aware collection, not just a spell
 * list. Above the Free Caster spellbook, it shows whichever of these apply
 * to the current character (each section is omitted entirely if it
 * doesn't apply, so a pure Free Caster sees no change at all):
 *
 * - Rites Known (Runekeeper/Invoker) — reads char.rites (plain rite-name
 *   strings) and cross-references patron data for tier/effect. Read-only
 *   here; learning new Rites still happens in the Rites panel, which is
 *   the single source of truth for that XP spend.
 * - Repertoire / Songs (Cantor) — same pattern against char.repertoire.
 * - Spirit Relationships (Summoner) — this one didn't exist anywhere in
 *   the app before. Player's Guide §4.2.5 (True Name Keeper, 15 XP):
 *   "Call any previously encountered spirit by true name; reduce Leash
 *   Capacity by 2." That implies a persistent record of specific spirits
 *   you've met — a name, a true name, a nature, a disposition — not just
 *   the generic archetype-and-Cap system already tracked during a scene
 *   (char.boundSpirits, managed in the Summoning panel). This file adds a
 *   full CRUD directory for that (char.spiritRelationships), gated behind
 *   having actually learned True Name Keeper — without it, RAW gives you
 *   no way to re-summon a *specific* spirit at all, so the directory
 *   would have no mechanical purpose yet.
 * ────────────────────────────────────────────────────────────────────────
 */

import { getCharacterData, saveCharacter } from '../index.js';
import { escHtml, generateId, safeParseInt } from '../../../core/utils.js';
import { showToast } from '../../../components/Toast.js';
import { performRoll } from '../../../core/dice.js';
import { getState } from '../../../core/state.js';
import patronsModule from '../../patrons/index.js';

// ============================================================
// CONSTANTS
// ============================================================

// ─── Tag Colors (from the TAGS system) ────────────────────────

const TAG_COLORS = {
    // Elemental
    'Burning': '#e67e22', 'Freezing': '#3498db', 'Storm': '#f1c40f',
    'Stone': '#7f8c8d', 'Wave': '#2980b9', 'Wind': '#ecf0f1',
    // Force
    'Force': '#e74c3c', 'Area': '#9b59b6', 'Strike': '#c0392b',
    'Wall': '#2c3e50', 'Bind': '#e67e22', 'Dispel': '#8e44ad',
    // Mind/Illusion
    'Veil': '#1abc9c', 'Scry': '#2ecc71', 'Memory': '#f39c12',
    'Command': '#d35400', 'Fear': '#c0392b',
    // Life/Body
    'HEAL': '#27ae60', 'Purify': '#2ecc71', 'Strengthen': '#f1c40f',
    'Waken': '#e67e22', 'Beast': '#d35400',
    // Space/Motion
    'Leap': '#8e44ad', 'Fold': '#8e44ad', 'Gate': '#c0392b', 'Gravity': '#2c3e50',
    // Creation
    'Create': '#f39c12', 'Summon': '#9b59b6', 'Transmute': '#e74c3c', 'Animate': '#e67e22',
    // Utility
    'Sense': '#3498db', 'Reveal': '#1abc9c', 'Light': '#f1c40f',
    'Shadow': '#2c3e50', 'Silence': '#7f8f8d', 'Protect': '#27ae60',
    // Reaction
    'Counter': '#c0392b', 'Reflect': '#8e44ad', 'Store': '#d35400',
    // Affliction
    'Curse': '#c0392b', 'Bless': '#27ae60'
};

// ─── Tag Definitions ───────────────────────────────────────────

const TAG_DEFINITIONS = {
    'Burning': 'Ignite, heat, combustion, smoke',
    'Freezing': 'Ice, slowing, brittle shatter, cold',
    'Storm': 'Lightning, shock, arc, thunder',
    'Stone': 'Walls, spikes, tremors, armor',
    'Wave': 'Crushing water, currents, pressure',
    'Wind': 'Levitation, gusts, deflection, push/pull',
    'Force': 'Kinetic power, shields, blasts, telekinesis',
    'Area': 'Cone, circle, corridor, zone effect',
    'Strike': 'Single target precision',
    'Wall': 'Barrier or blockade',
    'Bind': 'Restrain, hold, suspend, entangle',
    'Dispel': 'Suppress magic, unravel ongoing effects',
    'Veil': 'Conceal, blur, illusion, silence',
    'Scry': 'Reveal hidden, see distance, read traces',
    'Memory': 'Erase, alter, restore memories',
    'Command': 'Compel a short action (one word)',
    'Fear': 'Panic, flee, break morale',
    'HEAL': 'Close wounds, restore flesh, reduce Harm 1',
    'Purify': 'Remove poison, corruption, disease',
    'Strengthen': 'Enhance body, armor, senses (temporary)',
    'Waken': 'Counter sleep, paralysis, stun',
    'Beast': 'Speak with or influence animals',
    'Leap': 'Jump far, blink across short space (Near)',
    'Fold': 'Short-range teleport, vanish-reappear (Far)',
    'Gate': 'Long distance passage, open/close path',
    'Gravity': 'Crush, lift, suspend, walk on walls/ceiling',
    'Create': 'Manifest mundane matter briefly (1 scene)',
    'Summon': 'Call a being or construct',
    'Transmute': 'Turn one thing into another (temporary)',
    'Animate': 'Make objects act with intent (1 scene)',
    'Sense': 'Detect presence of a named tag/element',
    'Reveal': 'Unveil hidden, glamoured, or invisible things',
    'Light': 'Create illumination (glow, torch-bright)',
    'Shadow': 'Deepen darkness, hide edges, obscure',
    'Silence': 'Suppress sound in zone or on target',
    'Protect': 'Reduce/deflect next harm (Armor 1)',
    'Counter': 'Interrupt a casting/ritual in its window',
    'Reflect': 'Turn next targeted effect back on its source',
    'Store': 'Bank 1-2 successes in a vessel (once)',
    'Curse': 'Attach hostile tag/timer to target',
    'Bless': 'Grant favourable tag (luck, favor, ward-key)'
};

// ─── Spell Templates ───────────────────────────────────────────

const SPELL_TEMPLATES = [
    {
        name: '🔥 Ember Flick',
        tags: ['Burning', 'Strike'],
        dv: 2,
        description: 'A small bolt of flame strikes a single target. Deal 1 Fatigue or ignite a small object.',
        category: 'Offensive'
    },
    {
        name: '❄️ Frost Grasp',
        tags: ['Freezing', 'Bind'],
        dv: 2,
        description: 'Ice encases a target\'s limbs. They suffer -1 die to physical actions until they break free (Body DV 3).',
        category: 'Control'
    },
    {
        name: '🌿 Healing Touch',
        tags: ['HEAL', 'Strengthen'],
        dv: 2,
        description: 'Close wounds and restore vitality. Target clears 1 Fatigue and gains +1 die on their next physical action.',
        category: 'Support'
    },
    {
        name: '🌀 Telekinetic Push',
        tags: ['Force', 'Strike'],
        dv: 2,
        description: 'A blast of invisible force knocks a target back one range band. If they hit an obstacle, they suffer Harm 1.',
        category: 'Offensive'
    },
    {
        name: '🌙 Shadow Veil',
        tags: ['Veil', 'Shadow', 'Silence'],
        dv: 3,
        description: 'Conceal yourself and nearby allies in moving shadow. Gain +2 dice to Stealth for one scene.',
        category: 'Utility'
    },
    {
        name: '⚡ Storm Bolt',
        tags: ['Storm', 'Strike', 'Area'],
        dv: 3,
        description: 'A crackling bolt of lightning arcs through a zone. All targets in the zone must test Body+Athletics (DV 4) or suffer Harm 1.',
        category: 'Offensive'
    },
    {
        name: '🛡️ Aegis',
        tags: ['Protect', 'Strengthen'],
        dv: 2,
        description: 'A shimmering barrier of force protects you. Gain Armor 1 against the next attack this scene.',
        category: 'Defensive'
    },
    {
        name: '🔮 Scrying Eye',
        tags: ['Scry', 'Sense', 'Reveal'],
        dv: 3,
        description: 'Glimpse a distant place or hidden truth. Ask the GM one yes/no question about a location or object you can describe.',
        category: 'Utility'
    },
    {
        name: '💀 Leashed Curse',
        tags: ['Curse', 'Bind', 'Fear'],
        dv: 3,
        description: 'A curse that tightens as the target struggles. They suffer -1 die to all actions until they succeed on a Resolve test (DV 4).',
        category: 'Control'
    },
    {
        name: '✨ Momentary Forge',
        tags: ['Create', 'Transmute', 'Animate'],
        dv: 3,
        description: 'Shape raw matter into a temporary tool or weapon. Lasts one scene, then crumbles to dust.',
        category: 'Utility'
    },
    {
        name: '🌊 Tidal Wave',
        tags: ['Wave', 'Area', 'Force'],
        dv: 3,
        description: 'A surge of water crashes through a zone. All targets must test Body+Athletics (DV 3) or be knocked prone and suffer Harm 1.',
        category: 'Offensive'
    },
    {
        name: '💨 Wind Step',
        tags: ['Wind', 'Leap'],
        dv: 2,
        description: 'A gust of wind carries you. Move to any unoccupied space within Near range without provoking opportunity attacks.',
        category: 'Movement'
    },
    {
        name: '🔮 Counterspell',
        tags: ['Counter', 'Dispel'],
        dv: 3,
        description: 'Interrupt a spell being cast within Near range. The caster must test Spirit+Resolve (DV 4) or their spell fails.',
        category: 'Defensive'
    },
    {
        name: '🌿 Verdant Grasp',
        tags: ['Stone', 'Bind', 'Area'],
        dv: 3,
        description: 'Roots erupt from the ground in a zone. All targets must test Body+Athletics (DV 3) or become Entangled (-1 die to movement).',
        category: 'Control'
    },
    {
        name: '🔥 Dragon\'s Breath',
        tags: ['Burning', 'Area', 'Force'],
        dv: 4,
        description: 'A cone of flame erupts from your mouth. All targets in Close range must test Body+Athletics (DV 4) or suffer Harm 2 (Burn).',
        category: 'Offensive'
    },
    {
        name: '🧠 Mind Probe',
        tags: ['Scry', 'Memory', 'Command'],
        dv: 4,
        description: 'Delve into a target\'s mind. Learn one surface thought or memory. The target may resist with Resolve (DV 4).',
        category: 'Utility'
    }
];

// ─── Categories ────────────────────────────────────────────────

const CATEGORIES = ['Offensive', 'Defensive', 'Support', 'Control', 'Utility', 'Movement'];
const CATEGORY_ICONS = {
    'Offensive': '⚔️',
    'Defensive': '🛡️',
    'Support': '💚',
    'Control': '🌀',
    'Utility': '🔍',
    'Movement': '💨'
};

// ─── Attribute choices for casting ────────────────────────────

const CAST_ATTRIBUTES = [
    { value: 'wits', label: 'Wits + Arcana' },
    { value: 'spirit', label: 'Spirit + Arcana' }
];

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
        try { return JSON.stringify(val); } catch (e) { return '[object]'; }
    }
    return String(val);
}

function formatText(text) {
    if (!text) return '';
    return escHtml(text).replace(/\n/g, '<br>');
}

function getTagColor(tag) {
    return TAG_COLORS[tag] || 'var(--text3)';
}

function getTagDefinition(tag) {
    return TAG_DEFINITIONS[tag] || 'Unknown tag';
}

function getCategoryIcon(category) {
    return CATEGORY_ICONS[category] || '📜';
}

// ─── Signature Bonus ───────────────────────────────────────────

function getSignatureBonus(spell) {
    if (!spell.signature) return 0;
    return 1;
}

// ─── Mount element lookup ───────────────────────────────────────
function getSpellbookMountEl() {
    return document.querySelector('.spellbook-container')?.parentElement
        || document.getElementById('spellcraft-content');
}

// ============================================================
// GRIMOIRE COLLECTION — Rites / Repertoire / Spirit Relationships
// ============================================================
// See file header note for the rules basis of each section.

function findPatronDataForLookup(state, patronId) {
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
                if (found) return { ...found, _religion: religion.name };
            }
        }
    }
    return null;
}

function getAllPatronsForLookup(state) {
    const all = [];
    if (state.patrons?.cosmic) all.push(...state.patrons.cosmic);
    if (state.patrons?.terrestrial) all.push(...state.patrons.terrestrial);
    if (state.patrons?.religions) {
        for (const rel of state.patrons.religions) {
            if (rel.orders) all.push(...rel.orders);
        }
    }
    return all;
}

/**
 * Find full rite/song details by name across whichever patrons the
 * character actually has access to (bound patron for Runekeeper/Cantor,
 * carried Symbols for Invoker, or all patrons for an Unbound Cantor).
 * Falls back to searching every loaded patron if none of those narrow it
 * down, so a known name never just silently disappears.
 */
function findKnownRiteDetails(state, char, riteName) {
    const candidatePatronIds = [];
    if (char.patron) candidatePatronIds.push(char.patron);
    if (char.boundPatron) candidatePatronIds.push(char.boundPatron);
    if (Array.isArray(char.symbols)) candidatePatronIds.push(...char.symbols);

    for (const pid of candidatePatronIds) {
        const patron = findPatronDataForLookup(state, pid);
        const rite = patron?.rites?.find(r => r.name === riteName);
        if (rite) return { ...rite, patronName: patron.name || patron.title, patronIcon: patron.icon };
    }

    // Fallback: search everything loaded (covers Unbound Cantors, or a
    // rite learned before a patron change).
    for (const patron of getAllPatronsForLookup(state)) {
        const rite = patron.rites?.find(r => r.name === riteName);
        if (rite) return { ...rite, patronName: patron.name || patron.title, patronIcon: patron.icon };
    }
    return null;
}

function renderRitesKnownSection(char, state) {
    const known = char.rites || [];
    if (known.length === 0) return '';

    const items = known.map(name => findKnownRiteDetails(state, char, name) || { name, tier: '', effect: '' });

    return `
        <div class="grimoire-collection-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;color:var(--gold);">📜 Rites Known</span>
                <span style="font-size:0.6rem;color:var(--text3);">${items.length} learned · manage new Rites in the Rites panel</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.15rem;margin-top:0.2rem;max-height:160px;overflow-y:auto;">
                ${items.map(r => `
                    <div style="padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                            <span style="font-weight:500;">${escHtml(r.name)}</span>
                            <span style="display:flex;gap:0.3rem;align-items:center;">
                                ${r.patronName ? `<span style="color:var(--text3);font-size:0.6rem;">${escHtml(r.patronName)}</span>` : ''}
                                ${r.tier ? `<span style="color:var(--text3);font-size:0.6rem;">${escHtml(r.tier)}</span>` : ''}
                            </span>
                        </div>
                        ${r.effect ? `<div style="color:var(--text2);font-size:0.7rem;margin-top:0.1rem;">${escHtml(r.effect)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderRepertoireSection(char, state) {
    const known = char.repertoire || [];
    if (known.length === 0) return '';

    const items = known.map(name => findKnownRiteDetails(state, char, name) || { name, tier: '', effect: '' });

    return `
        <div class="grimoire-collection-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;color:var(--gold);">🎶 Repertoire (Songs)</span>
                <span style="font-size:0.6rem;color:var(--text3);">${items.length} learned · manage new Songs in the Cantor panel</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.15rem;margin-top:0.2rem;max-height:160px;overflow-y:auto;">
                ${items.map(r => `
                    <div style="padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                            <span style="font-weight:500;">${escHtml(r.name)}</span>
                            <span style="display:flex;gap:0.3rem;align-items:center;">
                                ${r.patronName ? `<span style="color:var(--text3);font-size:0.6rem;">${escHtml(r.patronName)}</span>` : ''}
                                ${r.tier ? `<span style="color:var(--text3);font-size:0.6rem;">${escHtml(r.tier)}</span>` : ''}
                            </span>
                        </div>
                        ${r.effect ? `<div style="color:var(--text2);font-size:0.7rem;margin-top:0.1rem;">${escHtml(r.effect)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

const SPIRIT_DISPOSITIONS = ['Favorable', 'Neutral', 'Wary', 'Hostile'];

function renderSpiritRelationshipsSection(char) {
    const hasTrueNameKeeper = (char.learnedTalents || []).includes('true-name-keeper');
    const bound = char.boundSpirits || [];
    const relationships = char.spiritRelationships || [];

    return `
        <div class="grimoire-collection-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid #8e44ad;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;color:#8e44ad;">👁️ Spirit Relationships</span>
                ${hasTrueNameKeeper
                    ? `<button class="btn btn-xs btn-primary" onclick="window.grimoireAddSpiritRelationship()">+ Record Spirit</button>`
                    : `<span style="font-size:0.6rem;color:var(--text3);">Unlocks with True Name Keeper (15 XP)</span>`}
            </div>

            ${bound.length > 0 ? `
                <div style="margin-top:0.25rem;">
                    <div style="font-size:0.6rem;color:var(--text3);font-weight:600;">Currently Bound (this scene)</div>
                    ${bound.map(s => `
                        <div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);">
                            <span>${escHtml(s.name)} <span style="color:var(--text3);font-size:0.6rem;">Cap ${s.cap || 1}</span></span>
                            <span style="color:var(--text3);font-size:0.6rem;">${escHtml(s.nature || '')}</span>
                        </div>
                    `).join('')}
                    <div style="font-size:0.55rem;color:var(--text3);margin-top:0.1rem;">Manage active bindings and the Leash in the Summoning panel.</div>
                </div>
            ` : ''}

            ${hasTrueNameKeeper ? `
                <div style="margin-top:0.3rem;">
                    <div style="font-size:0.6rem;color:var(--text3);font-weight:600;">Known by True Name</div>
                    ${relationships.length === 0 ? `
                        <div style="font-size:0.7rem;color:var(--text3);padding:0.3rem 0;">No spirits recorded yet. Once you've encountered one worth remembering, record it here.</div>
                    ` : relationships.map(r => `
                        <div style="padding:0.25rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
                            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                                <span style="font-weight:600;">${escHtml(r.name)}</span>
                                ${r.trueName ? `<span style="color:var(--gold);font-size:0.65rem;font-style:italic;">"${escHtml(r.trueName)}"</span>` : ''}
                                <select onchange="window.grimoireSetSpiritDisposition('${r.id}', this.value)" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;">
                                    ${SPIRIT_DISPOSITIONS.map(d => `<option value="${d}" ${r.disposition === d ? 'selected' : ''}>${d}</option>`).join('')}
                                </select>
                            </div>
                            ${r.nature ? `<div style="color:var(--text2);font-size:0.7rem;margin-top:0.1rem;">${escHtml(r.nature)}</div>` : ''}
                            ${r.notes ? `<div style="color:var(--text3);font-size:0.65rem;font-style:italic;">${escHtml(r.notes)}</div>` : ''}
                            <div style="font-size:0.6rem;color:var(--text3);">Called ${r.timesBound || 0} time${(r.timesBound || 0) === 1 ? '' : 's'}</div>
                            <div style="display:flex;gap:0.2rem;margin-top:0.15rem;">
                                <button class="btn btn-xs btn-gold" onclick="window.grimoireRecallSpirit('${r.id}')" title="Call by true name — Leash Capacity −2 for this binding, per True Name Keeper">👁️ Call by True Name</button>
                                <button class="btn btn-xs btn-ghost" onclick="window.grimoireEditSpiritRelationship('${r.id}')" title="Edit">✏️</button>
                                <button class="btn btn-xs btn-ghost" onclick="window.grimoireDeleteSpiritRelationship('${r.id}')" style="color:var(--red);" title="Remove">✕</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="font-size:0.65rem;color:var(--text3);margin-top:0.3rem;">
                    Learn True Name Keeper (15 XP) to call any previously encountered spirit by true name (Leash Capacity −2) — this is where you'd track those relationships once you have.
                </div>
            `}
        </div>
    `;
}

function renderGrimoireCollection(char, state) {
    const hasRites = (char.rites || []).length > 0 || char.magicPath === 'runekeeper' || char.magicPath === 'invoker';
    const hasSongs = (char.repertoire || []).length > 0 || char.magicPath === 'cantor';
    const hasSpiritStuff = (char.boundSpirits || []).length > 0
        || (char.spiritRelationships || []).length > 0
        || char.magicPath === 'summoner'
        || (char.learnedTalents || []).includes('true-name-keeper');

    if (!hasRites && !hasSongs && !hasSpiritStuff) return '';

    let html = `<div class="grimoire-collection" style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:0.2rem;">`;
    if (hasRites) html += renderRitesKnownSection(char, state);
    if (hasSongs) html += renderRepertoireSection(char, state);
    if (hasSpiritStuff) html += renderSpiritRelationshipsSection(char);
    html += `</div>`;
    return html;
}

// ============================================================
// MAIN RENDER
// ============================================================

export async function renderSpellbook(el) {
    if (!el) {
        console.warn('[Spellbook] renderSpellbook called with no container element — skipping.');
        return;
    }
    const char = getCharacterData();
    if (!char) {
        el.innerHTML = `
            <div class="spellbook-empty" style="text-align:center;color:var(--text3);padding:2rem 0;">
                <div style="font-size:2rem;">📖</div>
                <p>Select a character to view their spellbook.</p>
            </div>
        `;
        return;
    }

    // Load patron data so the Rites Known / Repertoire sections can
    // cross-reference tier/effect details, same loader everyone else uses.
    try {
        await patronsModule.loadPatronData();
    } catch (err) {
        console.warn('[Spellbook] Failed to load patron data for Grimoire Collection:', err);
    }
    const appState = getState();

    // Ensure spellbook exists
    if (!char.spellbook) {
        char.spellbook = [];
        saveCharacter({ spellbook: char.spellbook });
    }

    const spells = char.spellbook;
    const sortBy = localStorage.getItem('fates-edge-spellbook-sort') || 'name';
    const filterTag = localStorage.getItem('fates-edge-spellbook-filter-tag') || '';
    const filterSignature = localStorage.getItem('fates-edge-spellbook-filter-signature') === 'true';
    const filterText = localStorage.getItem('fates-edge-spellbook-filter-text') || '';

    // Apply filters
    let filtered = [...spells];
    if (filterTag) {
        filtered = filtered.filter(s => (s.tags || []).includes(filterTag));
    }
    if (filterSignature) {
        filtered = filtered.filter(s => s.signature);
    }
    if (filterText) {
        const search = filterText.toLowerCase();
        filtered = filtered.filter(s =>
            (s.name || '').toLowerCase().includes(search) ||
            (s.description || '').toLowerCase().includes(search) ||
            (s.tags || []).some(t => t.toLowerCase().includes(search))
        );
    }

    const sorted = sortSpells(filtered, sortBy);
    const signatureCount = spells.filter(s => s.signature).length;
    const magicPath = char.magicPath || 'none';
    const isFreeCaster = magicPath === 'free-caster';

    // Calculate stats
    const totalCasts = spells.reduce((acc, s) => acc + (s.usage || 0), 0);
    const totalSuccesses = spells.reduce((acc, s) => acc + (s._successes || 0), 0);
    const successRate = totalCasts > 0 ? Math.round((totalSuccesses / totalCasts) * 100) : 0;

    // Build filter tag options
    const allTags = new Set();
    spells.forEach(s => (s.tags || []).forEach(t => allTags.add(t)));
    const tagOptions = Array.from(allTags).sort();

    // Template dropdown options
    const templateOptionsHtml = SPELL_TEMPLATES.map((t, i) =>
        `<option value="${i}">${t.name} (DV ${t.dv}) — ${t.category}</option>`
    ).join('');

    // Category dropdown options for Add/Edit/FromTags (used in forms)
    const categoryOptionsHtml = CATEGORIES.map(c =>
        `<option value="${c}">${getCategoryIcon(c)} ${c}</option>`
    ).join('');

    // Attribute dropdown options for casting
    const attributeOptionsHtml = CAST_ATTRIBUTES.map(a =>
        `<option value="${a.value}">${a.label}</option>`
    ).join('');

    let html = `
        <div class="spellbook-container" style="display:flex;flex-direction:column;gap:0.5rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="spellbook-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;background:linear-gradient(135deg, var(--bg2) 0%, var(--bg1) 100%);border-radius:var(--radius) var(--radius) 0 0;padding:0.3rem 0.8rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">📖</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Grimoire</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${spells.length} spells</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <span style="font-size:0.65rem;color:var(--text3);">⭐ ${signatureCount} sig.</span>
                    ${totalCasts > 0 ? `<span style="font-size:0.65rem;color:var(--text3);">🎯 ${successRate}%</span>` : ''}
                    <button class="btn btn-sm btn-primary" onclick="window.spellbookAddSpell()">➕ Add</button>
                    ${isFreeCaster ? `<button class="btn btn-sm btn-gold" onclick="window.spellbookFromTags()">🔮 From Tags</button>` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="window.spellbookTemplates()">📋 Templates</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.spellbookImport()">📥 Import</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.spellbookExport()">📤 Export</button>
                    <button class="btn btn-sm btn-ghost" onclick="window.spellbookClearAll()" style="color:var(--red);" title="Clear all spells">🗑️</button>
                </div>
            </div>

            <!-- ─── Grimoire Collection (Rites/Repertoire/Spirits) ─ -->
            ${renderGrimoireCollection(char, appState)}

            <!-- ─── Stats Bar ───────────────────────────────────── -->
            <div class="spellbook-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0.2rem;background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.5rem;border:1px solid var(--border);font-size:0.7rem;color:var(--text2);">
                <div><strong>Total:</strong> ${spells.length}</div>
                <div><strong>Signature:</strong> ${signatureCount}</div>
                <div><strong>Casts:</strong> ${totalCasts}</div>
                <div><strong>Success:</strong> ${totalSuccesses}</div>
                ${totalCasts > 0 ? `<div><strong>Rate:</strong> ${successRate}%</div>` : ''}
            </div>

            <!-- ─── Controls ────────────────────────────────────── -->
            <div class="spellbook-controls" style="display:flex;gap:0.3rem;align-items:center;font-size:0.8rem;flex-wrap:wrap;background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.4rem;border:1px solid var(--border);">
                <span style="color:var(--text3);font-size:0.7rem;">Sort:</span>
                <select id="spellbook-sort-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;">
                    <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Name</option>
                    <option value="dv" ${sortBy === 'dv' ? 'selected' : ''}>DV</option>
                    <option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>Recent</option>
                    <option value="usage" ${sortBy === 'usage' ? 'selected' : ''}>Usage</option>
                    <option value="success" ${sortBy === 'success' ? 'selected' : ''}>Success Rate</option>
                </select>

                <span style="color:var(--text3);font-size:0.7rem;margin-left:0.3rem;">Filter:</span>
                <select id="spellbook-filter-tag" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;max-width:120px;">
                    <option value="">All Tags</option>
                    ${tagOptions.map(t => `<option value="${escHtml(t)}" ${t === filterTag ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
                </select>

                <label style="font-size:0.7rem;display:flex;align-items:center;gap:0.2rem;">
                    <input type="checkbox" id="spellbook-filter-signature" ${filterSignature ? 'checked' : ''} /> ⭐ Signature
                </label>

                <input type="text" id="spellbook-filter-text" value="${escHtml(filterText)}" placeholder="Search..." style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;flex:1;min-width:100px;" />

                <button class="btn btn-xs btn-ghost" onclick="window.spellbookClearFilters()" style="color:var(--text3);font-size:0.6rem;">✕ Clear</button>
            </div>

            <!-- ─── Spell List ──────────────────────────────────── -->
            <div class="spellbook-list" style="display:flex;flex-direction:column;gap:0.3rem;max-height:450px;overflow-y:auto;padding:0.1rem;">
    `;

    if (sorted.length === 0) {
        html += `
            <div class="spellbook-empty" style="text-align:center;color:var(--text3);padding:1.5rem 0;background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
                <div style="font-size:3rem;">📖</div>
                <p style="font-weight:500;color:var(--text2);">No spells found.</p>
                <p style="font-size:0.85rem;">${spells.length === 0 ? 'Create your first spell using the Add button.' : 'Try adjusting your filters.'}</p>
                <p style="font-size:0.75rem;color:var(--text3);font-style:italic;">"The Weave does not reward empty pages." – Lysandra</p>
                ${spells.length === 0 ? `
                    <div style="display:flex;gap:0.3rem;justify-content:center;margin-top:0.3rem;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-primary" onclick="window.spellbookAddSpell()">➕ Add Spell</button>
                        <button class="btn btn-sm btn-gold" onclick="window.spellbookTemplates()">📋 Load Template</button>
                    </div>
                ` : ''}
            </div>
        `;
    } else {
        sorted.forEach((spell, index) => {
            html += renderSpellItem(spell, index);
        });
    }

    html += `
            </div>

            <!-- ─── Footer ──────────────────────────────────────── -->
            <div class="spellbook-footer" style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.2rem;">
                <span>${sorted.length} of ${spells.length} spells shown</span>
                <span>${isFreeCaster ? '🔮 Free Caster — Can cast' : '📜 Study Only — Need Free Caster to cast'}</span>
            </div>

            <!-- ─── Hidden template loader (dropdown + button) ── -->
            <div style="display:none;" id="spellbook-template-loader">
                <select id="spellbook-template-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.75rem;">
                    ${templateOptionsHtml}
                </select>
                <button class="btn btn-xs btn-gold" onclick="window.spellbookLoadTemplateFromSelect()">Load</button>
            </div>

            <!-- ─── Hidden category selector for forms ────────── -->
            <div style="display:none;" id="spellbook-category-selector">
                <select id="spellbook-category-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.75rem;">
                    ${categoryOptionsHtml}
                </select>
            </div>

            <!-- ─── Hidden attribute selector for casting ────── -->
            <div style="display:none;" id="spellbook-attribute-selector">
                <select id="spellbook-attribute-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.75rem;">
                    ${attributeOptionsHtml}
                </select>
            </div>

        </div>
    `;

    el.innerHTML = html;

    // Attach event listeners
    attachSpellbookEvents(el);

    // Show quick tutorial if spellbook is empty
    if (spells.length === 0 && !localStorage.getItem('fates-edge-spellbook-tutorial-shown')) {
        setTimeout(() => {
            showToastWithHTML(`
                <div style="display:flex;flex-direction:column;gap:0.3rem;">
                    <div style="font-weight:600;font-size:1.1rem;color:var(--gold);">📖 Welcome to Your Grimoire</div>
                    <p style="font-size:0.85rem;color:var(--text2);">
                        Record your spells here. Each spell has a <strong>name</strong>, <strong>tags</strong>, 
                        and a <strong>DV</strong> (difficulty).
                    </p>
                    <p style="font-size:0.85rem;color:var(--text2);">
                        ⭐ <strong>Signature</strong> spells get +1 die when cast.
                    </p>
                    <p style="font-size:0.85rem;color:var(--text2);">
                        📋 Use <strong>Templates</strong> for inspiration, or build your own with the <strong>Add</strong> button.
                    </p>
                    <p style="font-size:0.75rem;color:var(--text3);font-style:italic;">
                        "The Weave respects repetition. Record your spells."
                    </p>
                    <button class="btn btn-sm btn-secondary" onclick="this.closest('.custom-toast-modal').remove(); localStorage.setItem('fates-edge-spellbook-tutorial-shown', 'true');">Got it!</button>
                </div>
            `, 'info');
        }, 500);
    }
}

// ============================================================
// RENDER SINGLE SPELL ITEM
// ============================================================

function renderSpellItem(spell, index) {
    const id = spell.id;
    const name = safeString(spell.name || 'Unnamed Spell');
    const tags = spell.tags || [];
    const dv = spell.dv || 0;
    const description = safeString(spell.effect || spell.description || '');
    const signature = spell.signature || false;
    const usage = spell.usage || 0;
    const successes = spell._successes || 0;
    const cost = spell.cost || {};
    const category = spell.category || 'Utility';
    const source = spell.source || 'custom';
    const signatureBonus = signature ? '+1 die' : '';

    // Success rate for this spell
    const rate = usage > 0 ? Math.round((successes / usage) * 100) : 0;

    // Tag badges
    const tagBadges = tags.map(tag => {
        const color = getTagColor(tag);
        const def = getTagDefinition(tag);
        return `<span class="tag-badge" style="display:inline-block;padding:0.05rem 0.4rem;margin:0.05rem;border-radius:8px;background:${color}22;border:1px solid ${color};font-size:0.6rem;color:${color};cursor:help;" title="${escHtml(def)}">${escHtml(tag)}</span>`;
    }).join(' ');

    const costDisplay = cost.obligation ? `⛓️ ${cost.obligation}` : cost.xp ? `${cost.xp} XP` : '';

    // Source badge
    const sourceLabels = {
        'custom': '✏️ Custom',
        'tags-calculator': '🔮 Calculator',
        'template': '📋 Template',
        'imported': '📥 Imported'
    };
    const sourceLabel = sourceLabels[source] || '📜';

    return `
        <div class="spell-item" data-spell-id="${escHtml(id)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:3px solid ${signature ? 'var(--gold)' : 'var(--border)'};${signature ? 'border-right:2px solid var(--gold);' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;min-width:0;">
                    ${signature ? '<span style="color:var(--gold);font-size:0.9rem;" title="Signature spell: +1 die when cast">⭐</span>' : ''}
                    <span style="font-weight:600;font-size:0.9rem;color:${signature ? 'var(--gold)' : 'var(--text)'};">${escHtml(name)}</span>
                    ${dv ? `<span style="font-size:0.7rem;color:var(--text3);font-weight:500;">DV ${dv}</span>` : ''}
                    ${signatureBonus ? `<span style="font-size:0.55rem;color:var(--gold);background:rgba(212,175,55,0.15);padding:0.05rem 0.3rem;border-radius:8px;">+1 die</span>` : ''}
                    ${category ? `<span style="font-size:0.5rem;color:var(--text3);background:var(--bg2);padding:0.05rem 0.3rem;border-radius:6px;">${getCategoryIcon(category)} ${category}</span>` : ''}
                    <span style="font-size:0.5rem;color:var(--text3);background:var(--bg2);padding:0.05rem 0.3rem;border-radius:6px;">${sourceLabel}</span>
                </div>
                <div style="display:flex;gap:0.2rem;align-items:center;flex-wrap:wrap;">
                    ${usage > 0 ? `<span style="font-size:0.6rem;color:var(--text2);">cast ${usage}x ${rate > 0 ? `· ${rate}%` : ''}</span>` : ''}
                    ${costDisplay ? `<span style="font-size:0.55rem;color:var(--text3);">${escHtml(costDisplay)}</span>` : ''}
                    <button class="btn btn-xs btn-gold" onclick="window.spellbookUse('${escHtml(id)}')" title="Cast this spell" style="font-size:0.6rem;padding:0.05rem 0.3rem;">🔮 Cast</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookToggleSignature('${escHtml(id)}')" title="${signature ? 'Remove signature' : 'Mark as signature (gives +1 die)'}" style="color:${signature ? 'var(--gold)' : 'var(--text3)'};font-size:0.6rem;">⭐</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookCopySpell('${escHtml(id)}')" title="Copy this spell" style="font-size:0.6rem;">📋</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookEdit('${escHtml(id)}')" title="Edit" style="font-size:0.6rem;">✏️</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookDelete('${escHtml(id)}')" title="Delete" style="color:var(--red);font-size:0.6rem;">✕</button>
                </div>
            </div>
            ${description ? `<div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;line-height:1.4;padding-left:0.1rem;">${formatText(description)}</div>` : ''}
            ${tags.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:0.1rem;margin-top:0.1rem;">${tagBadges}</div>` : ''}
        </div>
    `;
}

// ============================================================
// SORTING
// ============================================================

function sortSpells(spells, sortBy) {
    const sorted = [...spells];
    switch (sortBy) {
        case 'name':
            sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
        case 'dv':
            sorted.sort((a, b) => (a.dv || 0) - (b.dv || 0));
            break;
        case 'recent':
            sorted.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            break;
        case 'usage':
            sorted.sort((a, b) => (b.usage || 0) - (a.usage || 0));
            break;
        case 'success': {
            sorted.sort((a, b) => {
                const rateA = (a.usage || 0) > 0 ? ((a._successes || 0) / (a.usage || 1)) : 0;
                const rateB = (b.usage || 0) > 0 ? ((b._successes || 0) / (b.usage || 1)) : 0;
                return rateB - rateA;
            });
            break;
        }
        default:
            sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return sorted;
}

// ============================================================
// EVENTS
// ============================================================

function attachSpellbookEvents(el) {
    const sortSelect = el.querySelector('#spellbook-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            localStorage.setItem('fates-edge-spellbook-sort', e.target.value);
            renderSpellbook(el);
        });
    }

    const filterTag = el.querySelector('#spellbook-filter-tag');
    if (filterTag) {
        filterTag.addEventListener('change', (e) => {
            localStorage.setItem('fates-edge-spellbook-filter-tag', e.target.value);
            renderSpellbook(el);
        });
    }

    const filterSig = el.querySelector('#spellbook-filter-signature');
    if (filterSig) {
        filterSig.addEventListener('change', (e) => {
            localStorage.setItem('fates-edge-spellbook-filter-signature', String(e.target.checked));
            renderSpellbook(el);
        });
    }

    const filterText = el.querySelector('#spellbook-filter-text');
    if (filterText) {
        let timeout;
        filterText.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                localStorage.setItem('fates-edge-spellbook-filter-text', e.target.value);
                renderSpellbook(el);
            }, 300);
        });
    }
}

// ============================================================
// CRUD OPERATIONS (with dropdowns for selection)
// ============================================================

// ─── Add Spell ─────────────────────────────────────────────────
// FIX: was a plain (non-async) function that never awaited
// spellbookPromptCategory()'s Promise — see file header note.

window.spellbookAddSpell = async function() {
    const char = getCharacterData();
    if (!char) return;

    const name = prompt('Spell name:');
    if (!name) return;

    const description = prompt('Description / Effect:') || '';
    const tagsInput = prompt('Tags (space-separated, e.g., Burning Strike Area):') || '';
    const tags = tagsInput.trim() ? tagsInput.split(/\s+/) : [];
    const dv = safeParseInt(prompt('DV (difficulty, default 2):') || '2', 2);

    // ─── Category dropdown ────────────────────────────────────
    const category = await window.spellbookPromptCategory('Category:', 'Utility');
    if (category === null) return; // cancelled

    const costObligation = safeParseInt(prompt('Obligation cost (if any):') || '0', 0);

    const newSpell = {
        id: generateId('spell_'),
        name: name.trim(),
        description: description.trim(),
        tags: tags.map(t => t.toUpperCase()),
        dv: Math.max(1, dv),
        cost: {},
        category: category || 'Utility',
        signature: false,
        usage: 0,
        _successes: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'custom'
    };

    if (costObligation > 0) {
        newSpell.cost.obligation = costObligation;
    }

    if (!char.spellbook) char.spellbook = [];
    char.spellbook.push(newSpell);
    saveCharacter({ spellbook: char.spellbook });
    showToast(`✨ "${name}" added to spellbook (DV ${dv}).`, 'success');
    renderSpellbook(getSpellbookMountEl());
};

// ─── From Tags (Free Caster) ──────────────────────────────────
// FIX: same missing-await bug as spellbookAddSpell — see file header note.

window.spellbookFromTags = async function() {
    const char = getCharacterData();
    if (!char) return;

    const tagsInput = prompt('Enter TAGS (space-separated, e.g., Burning Strike Area):');
    if (!tagsInput) return;
    const tags = tagsInput.trim().split(/\s+/).map(t => t.toUpperCase());

    // Validate tags
    const validTags = tags.filter(t => TAG_COLORS[t]);
    const invalidTags = tags.filter(t => !TAG_COLORS[t]);
    if (invalidTags.length > 0) {
        showToast(`Unknown tags: ${invalidTags.join(', ')}. They will be included but have no color.`, 'warning');
    }

    const dv = 1 + validTags.length;
    const name = prompt('Spell name:', validTags.join(' ') || 'New Spell');
    if (!name) return;
    const description = prompt('Description / Effect:') || '';

    // ─── Category dropdown ────────────────────────────────────
    const category = await window.spellbookPromptCategory('Category:', 'Utility');
    if (category === null) return;

    const newSpell = {
        id: generateId('spell_'),
        name: name.trim(),
        description: description.trim(),
        tags: tags,
        dv: Math.max(1, dv),
        cost: {},
        category: category || 'Utility',
        signature: false,
        usage: 0,
        _successes: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'tags-calculator'
    };

    if (!char.spellbook) char.spellbook = [];
    char.spellbook.push(newSpell);
    saveCharacter({ spellbook: char.spellbook });
    showToast(`🔮 "${name}" created from tags (DV ${dv}).`, 'success');
    renderSpellbook(getSpellbookMountEl());
};

// ─── Templates ─────────────────────────────────────────────────

// Legacy function – redirects to the dropdown version
window.spellbookTemplates = function() {
    const select = document.getElementById('spellbook-template-select');
    if (select) {
        // If the dropdown exists, use it
        window.spellbookLoadTemplateFromSelect();
    } else {
        // Fallback: show a prompt with numbered list (kept for backward compatibility)
        // But we want to eliminate modals, so we'll create the dropdown dynamically.
        const char = getCharacterData();
        if (!char) return;

        const options = SPELL_TEMPLATES.map((t, i) =>
            `${i + 1}. ${t.name} (DV ${t.dv}) — ${t.category}`
        ).join('\n');

        // Instead of prompt, we'll use a custom dropdown in a toast
        const modalHtml = `
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                <p style="font-weight:600;">📋 Choose a template:</p>
                <select id="template-prompt-select" style="padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
                    ${SPELL_TEMPLATES.map((t, i) => `<option value="${i}">${t.name} (DV ${t.dv}) — ${t.category}</option>`).join('')}
                </select>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-primary" id="template-prompt-confirm">Load</button>
                    <button class="btn btn-secondary" id="template-prompt-cancel">Cancel</button>
                </div>
            </div>
        `;
        showToastWithHTML(modalHtml, 'info');
        setTimeout(() => {
            const confirmBtn = document.getElementById('template-prompt-confirm');
            const cancelBtn = document.getElementById('template-prompt-cancel');
            const selectEl = document.getElementById('template-prompt-select');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    const idx = parseInt(selectEl.value);
                    window.spellbookLoadTemplateByIndex(idx);
                    const toast = document.querySelector('.custom-toast-modal');
                    if (toast) toast.remove();
                });
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    const toast = document.querySelector('.custom-toast-modal');
                    if (toast) toast.remove();
                });
            }
        }, 100);
    }
};

// ─── Load Template from dropdown ────────────────────────────

window.spellbookLoadTemplateFromSelect = function() {
    const select = document.getElementById('spellbook-template-select');
    if (!select) {
        showToast('Template dropdown not found. Please refresh.', 'error');
        return;
    }
    const idx = parseInt(select.value);
    if (isNaN(idx) || idx < 0 || idx >= SPELL_TEMPLATES.length) {
        showToast('Invalid template selection.', 'error');
        return;
    }
    window.spellbookLoadTemplateByIndex(idx);
};

window.spellbookLoadTemplateByIndex = function(idx) {
    const char = getCharacterData();
    if (!char) return;

    const template = SPELL_TEMPLATES[idx];
    const newSpell = {
        id: generateId('spell_'),
        name: template.name,
        description: template.description,
        tags: template.tags || [],
        dv: template.dv || 2,
        cost: {},
        category: template.category || 'Utility',
        signature: false,
        usage: 0,
        _successes: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'template'
    };

    if (!char.spellbook) char.spellbook = [];
    char.spellbook.push(newSpell);
    saveCharacter({ spellbook: char.spellbook });
    showToast(`📋 Template "${template.name}" added to spellbook.`, 'success');
    renderSpellbook(getSpellbookMountEl());
};

// ─── Category Prompt (shared helper) ─────────────────────────

window.spellbookPromptCategory = function(promptText, defaultValue = 'Utility') {
    // This returns the selected category from a dropdown in a toast.
    // We use a synchronous-like pattern with a promise.
    return new Promise((resolve) => {
        const modalHtml = `
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                <p style="font-weight:600;">${escHtml(promptText)}</p>
                <select id="category-prompt-select" style="padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
                    ${CATEGORIES.map(c => `<option value="${c}" ${c === defaultValue ? 'selected' : ''}>${getCategoryIcon(c)} ${c}</option>`).join('')}
                </select>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-primary" id="category-prompt-confirm">OK</button>
                    <button class="btn btn-secondary" id="category-prompt-cancel">Cancel</button>
                </div>
            </div>
        `;
        showToastWithHTML(modalHtml, 'info');
        setTimeout(() => {
            const confirmBtn = document.getElementById('category-prompt-confirm');
            const cancelBtn = document.getElementById('category-prompt-cancel');
            const selectEl = document.getElementById('category-prompt-select');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    const val = selectEl.value;
                    const toast = document.querySelector('.custom-toast-modal');
                    if (toast) toast.remove();
                    resolve(val);
                });
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    const toast = document.querySelector('.custom-toast-modal');
                    if (toast) toast.remove();
                    resolve(null);
                });
            }
        }, 100);
    });
};

// ─── Copy Spell ─────────────────────────────────────────────────

window.spellbookCopySpell = function(id) {
    const char = getCharacterData();
    if (!char) return;
    const spell = char.spellbook.find(s => s.id === id);
    if (!spell) return showToast('Spell not found.', 'error');

    const newSpell = {
        ...spell,
        id: generateId('spell_'),
        name: `${spell.name} (copy)`,
        signature: false,
        usage: 0,
        _successes: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    char.spellbook.push(newSpell);
    saveCharacter({ spellbook: char.spellbook });
    showToast(`📋 "${spell.name}" copied.`, 'success');
    renderSpellbook(getSpellbookMountEl());
};

// ─── Edit ──────────────────────────────────────────────────────

window.spellbookEdit = async function(id) {
    const char = getCharacterData();
    if (!char) return;
    const spell = char.spellbook.find(s => s.id === id);
    if (!spell) return showToast('Spell not found.', 'error');

    const name = prompt('Spell name:', spell.name);
    if (name === null) return;
    const description = prompt('Description:', spell.description || '') || '';
    const tagsInput = prompt('Tags (space-separated):', (spell.tags || []).join(' ')) || '';
    const tags = tagsInput.trim() ? tagsInput.split(/\s+/) : [];
    const dv = safeParseInt(prompt('DV:', spell.dv || 2), 2);

    // ─── Category dropdown ────────────────────────────────────
    const category = await window.spellbookPromptCategory('Category:', spell.category || 'Utility');
    if (category === null) return;

    const costObligation = safeParseInt(prompt('Obligation cost:', spell.cost?.obligation || 0), 0);

    spell.name = name.trim();
    spell.description = description.trim();
    spell.tags = tags.map(t => t.toUpperCase());
    spell.dv = Math.max(1, dv);
    spell.category = category || 'Utility';
    if (costObligation > 0) {
        spell.cost = { obligation: costObligation };
    } else if (spell.cost) {
        delete spell.cost.obligation;
        if (Object.keys(spell.cost).length === 0) delete spell.cost;
    }
    spell.updatedAt = Date.now();

    saveCharacter({ spellbook: char.spellbook });
    showToast('Spell updated.', 'success');
    renderSpellbook(getSpellbookMountEl());
};

// ─── Delete ────────────────────────────────────────────────────

window.spellbookDelete = function(id) {
    const char = getCharacterData();
    if (!char) return;
    const spell = char.spellbook.find(s => s.id === id);
    if (!spell) return;
    if (!confirm(`Delete spell "${spell.name}"?`)) return;
    char.spellbook = char.spellbook.filter(s => s.id !== id);
    saveCharacter({ spellbook: char.spellbook });
    showToast(`Deleted "${spell.name}"`, 'info');
    renderSpellbook(getSpellbookMountEl());
};

// ─── Clear All ─────────────────────────────────────────────────

window.spellbookClearAll = function() {
    const char = getCharacterData();
    if (!char) return;
    if (!char.spellbook || char.spellbook.length === 0) {
        showToast('Spellbook is already empty.', 'info');
        return;
    }
    if (!confirm('Delete ALL spells from your spellbook?')) return;
    char.spellbook = [];
    saveCharacter({ spellbook: char.spellbook });
    showToast('Spellbook cleared.', 'info');
    renderSpellbook(getSpellbookMountEl());
};

// ─── Toggle Signature ─────────────────────────────────────────

window.spellbookToggleSignature = function(id) {
    const char = getCharacterData();
    if (!char) return;
    const spell = char.spellbook.find(s => s.id === id);
    if (!spell) return;
    spell.signature = !spell.signature;
    spell.updatedAt = Date.now();
    saveCharacter({ spellbook: char.spellbook });
    showToast(spell.signature ? `⭐ "${spell.name}" is now signature (+1 die).` : `"${spell.name}" is no longer signature.`, 'info');
    renderSpellbook(getSpellbookMountEl());
};

// ─── Clear Filters ─────────────────────────────────────────────

window.spellbookClearFilters = function() {
    localStorage.removeItem('fates-edge-spellbook-filter-tag');
    localStorage.removeItem('fates-edge-spellbook-filter-signature');
    localStorage.removeItem('fates-edge-spellbook-filter-text');
    const el = getSpellbookMountEl();
    if (el) renderSpellbook(el);
};

// ============================================================
// USE SPELL – Cast and Track (Free Caster only)
// ============================================================
// FIX: was a plain (non-async) function that never awaited
// spellbookPromptAttribute()'s Promise, so the roll fired immediately with
// an unresolved Promise as `attributeChoice` — casting always silently
// used Wits, and the Cancel button never actually cancelled anything. See
// file header note.

window.spellbookUse = async function(id) {
    const char = getCharacterData();
    if (!char) return;

    // ─── CRITICAL: Only Free Casters can cast spells ────────────
    const magicPath = char.magicPath || 'none';
    if (magicPath !== 'free-caster') {
        showToastWithHTML(`
            <div style="display:flex;flex-direction:column;gap:0.3rem;">
                <div style="font-weight:600;font-size:1rem;color:var(--orange);">🔮 Free Caster Required</div>
                <p style="font-size:0.85rem;color:var(--text2);">
                    Only <strong>Free Casters</strong> can cast spells from their grimoire.
                </p>
                <p style="font-size:0.75rem;color:var(--text3);font-style:italic;">
                    "The Weave answers those who speak its raw grammar." – Lysandra
                </p>
                <p style="font-size:0.75rem;color:var(--text3);">
                    Your current path is <strong>${PATH_META[magicPath]?.label || magicPath}</strong>.
                    ${magicPath === 'none' ? 'Choose the Free Caster path to cast spells.' : 'Free Casters are the only ones who can improvise spellcasting.'}
                </p>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="this.closest('.custom-toast-modal').remove(); window.location.hash='spellcraft';">📖 Go to Spellcraft</button>
                    <button class="btn btn-sm btn-secondary" onclick="this.closest('.custom-toast-modal').remove();">Close</button>
                </div>
            </div>
        `, 'warning');
        return;
    }

    const spell = char.spellbook.find(s => s.id === id);
    if (!spell) return showToast('Spell not found.', 'error');

    // Determine dice pool with dropdown instead of confirm
    const attributeChoice = await window.spellbookPromptAttribute();
    if (attributeChoice === null) return; // cancelled

    const wits = char.wits || 1;
    const spirit = char.spirit || 1;
    const arcana = char.skills?.arcana || 0;

    const attr = attributeChoice === 'spirit' ? spirit : wits;
    const attrName = attributeChoice === 'spirit' ? 'Spirit' : 'Wits';
    let pool = attr + arcana;

    // Apply signature bonus
    const signatureBonus = getSignatureBonus(spell);
    if (signatureBonus > 0) {
        pool += signatureBonus;
    }

    const dv = spell.dv || 1;

    if (pool < 1) {
        showToast('Dice pool must be at least 1 die. Increase your Wits/Spirit or Arcana.', 'error');
        return;
    }

    // Perform the roll
    const result = performRoll(pool, dv);

    // Determine outcome
    let outcome, outcomeLabel, backlashSeverity, boonGain;
    if (result.successes >= dv && result.storyBeats === 0) {
        outcome = 'clean';
        outcomeLabel = '✨ Clean Success';
        backlashSeverity = 'None';
        boonGain = 0;
    } else if (result.successes >= dv && result.storyBeats > 0) {
        outcome = 'success_sb';
        outcomeLabel = '⚠️ Success with Consequences';
        backlashSeverity = 'Minor';
        boonGain = 0;
    } else if (result.successes > 0 && result.successes < dv) {
        outcome = 'partial';
        outcomeLabel = '⚠️ Partial Success';
        backlashSeverity = 'Moderate';
        boonGain = 1;
    } else {
        outcome = 'miss';
        outcomeLabel = '💀 Miss';
        backlashSeverity = 'Major';
        boonGain = 2;
    }

    // Update usage stats
    spell.usage = (spell.usage || 0) + 1;
    if (result.successes >= dv) {
        spell._successes = (spell._successes || 0) + 1;
    }
    spell.updatedAt = Date.now();

    // Apply Boon gain
    if (boonGain > 0) {
        char.boons = (char.boons || 0) + boonGain;
        if (char.boons > 5) char.boons = 5;
        showToast(`+${boonGain} Boon${boonGain > 1 ? 's' : ''} gained.`, 'info');
    }

    saveCharacter({ spellbook: char.spellbook, boons: char.boons });

    // Build backlash description
    let backlashDesc = '';
    let backlashColor = 'var(--text3)';
    if (backlashSeverity === 'Minor') {
        backlashDesc = 'Fatigue +1 or -1 die on next roll (GM choice).';
        backlashColor = 'var(--orange)';
    } else if (backlashSeverity === 'Moderate') {
        backlashDesc = 'Harm 1 (stress) or a minor Condition.';
        backlashColor = 'var(--orange)';
    } else if (backlashSeverity === 'Major') {
        backlashDesc = 'Harm 2, permanent Scar, or reality fracture (GM choice).';
        backlashColor = 'var(--red)';
    } else {
        backlashDesc = 'No backlash. The Weave bends cleanly.';
        backlashColor = 'var(--green)';
    }

    // Signature bonus display
    const sigDisplay = signatureBonus > 0 ? `⭐ +${signatureBonus} die (signature)` : '';

    // Show result modal
    const msg = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;font-size:1.05rem;color:${outcome === 'clean' ? 'var(--gold)' : outcome === 'miss' ? 'var(--red)' : 'var(--orange)'};">${outcomeLabel}</span>
                <span style="font-size:0.8rem;color:var(--text3);">DV ${dv}</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">"${escHtml(spell.name)}"</div>
            ${sigDisplay ? `<div style="font-size:0.7rem;color:var(--gold);">${sigDisplay}</div>` : ''}
            <div style="font-size:0.75rem;color:var(--text2);">Pool: ${pool}d (${attrName} ${attr} + Arcana ${arcana})</div>
            <div style="font-size:0.75rem;color:var(--text3);">Roll: ${result.dice.join(', ')} → <strong>${result.successes}</strong> successes</div>
            ${result.storyBeats > 0 ? `<div style="font-size:0.75rem;color:var(--text3);">📖 ${result.storyBeats} Story Beats generated</div>` : ''}
            ${result.criticalEffect ? `<div style="font-size:0.75rem;color:var(--gold);">✨ ${result.criticalEffect}</div>` : ''}
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.8rem;color:${backlashColor};">
                <strong>⚡ Backlash:</strong> ${backlashSeverity} — ${backlashDesc}
            </div>
            ${boonGain > 0 ? `<div style="font-size:0.75rem;color:var(--gold);">+${boonGain} Boon${boonGain > 1 ? 's' : ''} gained</div>` : ''}
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;margin-top:0.1rem;">
                ${outcome === 'clean' ? '"The Weave remembers your precision." – Lysandra' :
                  outcome === 'miss' ? '"The Weave\'s receipt is your teacher." – Lysandra' :
                  '"Balance the risk and the reward." – Lysandra'}
            </div>
            <div style="font-size:0.6rem;color:var(--text3);">
                Cast ${spell.usage} time${spell.usage > 1 ? 's' : ''} · ${spell._successes || 0} successes
            </div>
        </div>
    `;

    showToastWithHTML(msg, outcome === 'clean' ? 'success' : outcome === 'miss' ? 'error' : 'info');

    // If signature spell, show a special animation effect
    if (signatureBonus > 0 && outcome === 'clean') {
        setTimeout(() => {
            showToast('⭐ Signature spell resonates! Extra die well spent.', 'success');
        }, 500);
    }

    // Refresh the spellbook to update usage stats
    setTimeout(() => {
        const el = getSpellbookMountEl();
        if (el) renderSpellbook(el);
    }, 100);
};

// ─── Attribute Prompt (for casting) ──────────────────────────

window.spellbookPromptAttribute = function() {
    // Returns 'wits' or 'spirit' or null if cancelled
    // Using a synchronous-like pattern with a promise
    return new Promise((resolve) => {
        const modalHtml = `
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                <p style="font-weight:600;">Choose attribute for casting:</p>
                <select id="attribute-prompt-select" style="padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
                    ${CAST_ATTRIBUTES.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}
                </select>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-primary" id="attribute-prompt-confirm">Cast</button>
                    <button class="btn btn-secondary" id="attribute-prompt-cancel">Cancel</button>
                </div>
            </div>
        `;
        showToastWithHTML(modalHtml, 'info');
        setTimeout(() => {
            const confirmBtn = document.getElementById('attribute-prompt-confirm');
            const cancelBtn = document.getElementById('attribute-prompt-cancel');
            const selectEl = document.getElementById('attribute-prompt-select');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    const val = selectEl.value;
                    const toast = document.querySelector('.custom-toast-modal');
                    if (toast) toast.remove();
                    resolve(val);
                });
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    const toast = document.querySelector('.custom-toast-modal');
                    if (toast) toast.remove();
                    resolve(null);
                });
            }
        }, 100);
    });
};

// ============================================================
// SPIRIT RELATIONSHIPS (Summoner — True Name Keeper, 15 XP)
// ============================================================
// See file header note. Gated on having actually learned the talent,
// since RAW gives no mechanical way to re-summon a *specific* spirit
// without it — recording one here without the talent would just be a
// list with nothing to do.

window.grimoireAddSpiritRelationship = function() {
    const char = getCharacterData();
    if (!char) return;

    if (!(char.learnedTalents || []).includes('true-name-keeper')) {
        showToast('Requires the True Name Keeper talent (15 XP).', 'error');
        return;
    }

    const name = prompt('Spirit name/archetype (e.g., "Ashen Hollow-Wight"):');
    if (!name || !name.trim()) return;
    const trueName = prompt('True Name (the word that binds it):') || '';
    const nature = prompt('Nature (its temperament, domain, what it wants):') || '';

    if (!char.spiritRelationships) char.spiritRelationships = [];
    char.spiritRelationships.push({
        id: generateId('spirit_'),
        name: name.trim(),
        trueName: trueName.trim(),
        nature: nature.trim(),
        disposition: 'Neutral',
        notes: '',
        timesBound: 0,
        lastBound: null,
        createdAt: Date.now()
    });
    saveCharacter({ spiritRelationships: char.spiritRelationships });
    showToast(`📖 "${name.trim()}" recorded in your Spirit Relationships.`, 'success');
    renderSpellbook(getSpellbookMountEl());
};

window.grimoireEditSpiritRelationship = function(id) {
    const char = getCharacterData();
    if (!char) return;
    const rel = (char.spiritRelationships || []).find(r => r.id === id);
    if (!rel) {
        showToast('Spirit not found.', 'error');
        return;
    }

    const name = prompt('Spirit name/archetype:', rel.name);
    if (name === null) return;
    const trueName = prompt('True Name:', rel.trueName || '');
    const nature = prompt('Nature:', rel.nature || '');
    const notes = prompt('Notes (history, debts, warnings):', rel.notes || '');

    rel.name = (name || rel.name).trim();
    rel.trueName = (trueName || '').trim();
    rel.nature = (nature || '').trim();
    rel.notes = (notes || '').trim();

    saveCharacter({ spiritRelationships: char.spiritRelationships });
    showToast(`Updated "${rel.name}".`, 'success');
    renderSpellbook(getSpellbookMountEl());
};

window.grimoireSetSpiritDisposition = function(id, disposition) {
    const char = getCharacterData();
    if (!char) return;
    const rel = (char.spiritRelationships || []).find(r => r.id === id);
    if (!rel) return;
    rel.disposition = disposition;
    saveCharacter({ spiritRelationships: char.spiritRelationships });
    showToast(`"${rel.name}" is now ${disposition}.`, 'info');
};

window.grimoireRecallSpirit = function(id) {
    const char = getCharacterData();
    if (!char) return;

    if (!(char.learnedTalents || []).includes('true-name-keeper')) {
        showToast('Requires the True Name Keeper talent.', 'error');
        return;
    }

    const rel = (char.spiritRelationships || []).find(r => r.id === id);
    if (!rel) {
        showToast('Spirit not found.', 'error');
        return;
    }

    if (!confirm(`Call "${rel.name}" by its true name?\n\nPer True Name Keeper: Leash Capacity is reduced by 2 for this binding.`)) return;

    rel.timesBound = (rel.timesBound || 0) + 1;
    rel.lastBound = Date.now();
    saveCharacter({ spiritRelationships: char.spiritRelationships });
    showToast(`👁️ "${rel.name}" answers your call. (Leash Capacity −2 for this binding.) Set up the actual binding in the Summoning panel.`, 'success');
    renderSpellbook(getSpellbookMountEl());
};

window.grimoireDeleteSpiritRelationship = function(id) {
    const char = getCharacterData();
    if (!char) return;
    const rel = (char.spiritRelationships || []).find(r => r.id === id);
    if (!rel) return;
    if (!confirm(`Remove "${rel.name}" from your Spirit Relationships? This can't be undone.`)) return;
    char.spiritRelationships = (char.spiritRelationships || []).filter(r => r.id !== id);
    saveCharacter({ spiritRelationships: char.spiritRelationships });
    showToast('Removed.', 'info');
    renderSpellbook(getSpellbookMountEl());
};

// ============================================================
// IMPORT / EXPORT
// ============================================================

window.spellbookExport = function() {
    const char = getCharacterData();
    if (!char) return;
    const spells = char.spellbook || [];
    if (spells.length === 0) {
        showToast('No spells to export.', 'info');
        return;
    }
    const data = JSON.stringify(spells, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spellbook-${char.name || 'caster'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`📤 Exported ${spells.length} spells.`, 'success');
};

window.spellbookImport = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (!Array.isArray(imported)) {
                    showToast('Invalid spellbook data.', 'error');
                    return;
                }
                const char = getCharacterData();
                if (!char) return;
                if (!char.spellbook) char.spellbook = [];
                let added = 0;
                imported.forEach(spell => {
                    if (!spell.name) return;
                    spell.id = generateId('spell_');
                    spell.source = 'imported';
                    spell.createdAt = Date.now();
                    spell.updatedAt = Date.now();
                    char.spellbook.push(spell);
                    added++;
                });
                saveCharacter({ spellbook: char.spellbook });
                showToast(`📥 Imported ${added} spells.`, 'success');
                renderSpellbook(getSpellbookMountEl());
            } catch (err) {
                showToast('Failed to parse spellbook JSON.', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

// ============================================================
// TOAST WITH HTML (shared)
// ============================================================

function showToastWithHTML(html, type = 'info') {
    const existing = document.querySelector('.custom-toast-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'custom-toast-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.5rem; border-radius: var(--radius);
        max-width: 420px; width: 90%; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 80vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-sm btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>`;
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
// PATH META (for Free Caster check display)
// ============================================================

const PATH_META = {
    'free-caster': { label: 'Free Caster' },
    'runekeeper': { label: 'Runekeeper' },
    'invoker': { label: 'Invoker' },
    'cantor': { label: 'Cantor' },
    'witch': { label: 'Witch' },
    'psion': { label: 'Psion' },
    'summoner': { label: 'Summoner' },
    'monk': { label: 'Monk' },
    'none': { label: 'No Path' }
};

// ============================================================
// EXPORT
// ============================================================

export default { renderSpellbook };
