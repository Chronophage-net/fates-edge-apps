/**
 * TAGS Calculator – Spellcrafting Interface for Free Casters
 * 
 * "Before you shape the Weave, you must answer three questions:
 *  What do you want? What are you willing to risk? What will you become?"
 * – Lysandra of the Amber Gate
 * 
 * Features:
 * - Tag autocomplete from wiki.json (via fetch)
 * - Visual spell construction with tag badges
 * - DV calculation with breakdown
 * - Backlash risk assessment with severity preview
 * - Spell preview in plain language
 * - Quick templates for common spells
 * - Save to spellbook with full metadata
 * - Spell history with success/failure tracking
 * - Roll test with core dice module
 * - Gamble: simulate the roll and see the outcome
 */

import { t as i18nText } from '@core/i18n.js';
import { getCharacterData, saveCharacter } from '@features/spellcraft/index.js';
import { showToast } from '@components/Toast.js';
import { escHtml, generateId } from '@core/utils.js';
import { getState } from '@core/state.js';
import { performRoll } from '@core/dice.js';

// ============================================================
// STATE
// ============================================================

let tagDefinitions = null;
let spellHistory = [];
let activeTags = [];
let calculatorContainer = null;

// FIX: attachEvents() used to call document.addEventListener('click', ...)
// on every single render (refresh, template pick, tag add/remove all
// re-render the calculator). Each call stacked a brand-new listener on
// `document` that never got removed, so after using the calculator for a
// while dozens of duplicate handlers would fire on every click anywhere on
// the page. We keep a single reference here and always remove it before
// re-adding so there is ever only one bound at a time.
let outsideClickHandler = null;

// ============================================================
// WIKI LOADER
// ============================================================

async function loadWikiTags() {
    if (tagDefinitions) return tagDefinitions;
    
    // Start with hardcoded tags as base
    const merged = buildTagDefinitions();
    
    try {
        const response = await fetch('./data/wiki.json');
        if (response.ok) {
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
                for (const entry of data.data) {
                    // Only include entries that are actual tags (have a mod field)
                    if (entry.tags && entry.tags.includes('magic') && entry.mod !== undefined) {
                        const tagName = entry.title?.toUpperCase();
                        if (tagName) {
                            // Overwrite or add from wiki
                            merged.set(tagName, {
                                name: tagName,
                                mod: entry.mod,
                                category: entry.category || 'magic',
                                description: entry.body || '',
                                example: entry.example || ''
                            });
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Could not load wiki.json, using hardcoded tags.');
    }
    
    tagDefinitions = merged;
    return tagDefinitions;
}

function buildTagDefinitions() {
    const map = new Map();
    const raw = {
        'Burning': { mod: 1, category: 'Elemental', description: 'Ignite, heat, combustion, smoke', example: 'Ember Flick' },
        'Freezing': { mod: 1, category: 'Elemental', description: 'Ice, slowing, brittle shatter, cold', example: 'Frost Grasp' },
        'Storm': { mod: 1, category: 'Elemental', description: 'Lightning, shock, arc, thunder', example: 'Cracking Lightning' },
        'Stone': { mod: 1, category: 'Elemental', description: 'Walls, spikes, tremors, armor', example: 'Grasping Roots' },
        'Wave': { mod: 1, category: 'Elemental', description: 'Crushing water, currents, pressure', example: 'Tidal Push' },
        'Wind': { mod: 1, category: 'Elemental', description: 'Levitation, gusts, deflection, push/pull', example: 'Reed Walk' },
        'Force': { mod: 1, category: 'Force', description: 'Kinetic power, shields, blasts, telekinesis', example: 'Unseen Hand' },
        'Area': { mod: 1, category: 'Force', description: 'Cone, circle, corridor, zone effect', example: 'Eruption' },
        'Strike': { mod: 1, category: 'Force', description: 'Single target precision', example: 'Fate\'s Needle' },
        'Wall': { mod: 1, category: 'Force', description: 'Barrier or blockade', example: 'Stone Wall' },
        'Bind': { mod: 1, category: 'Force', description: 'Restrain, hold, suspend, entangle', example: 'Grasping Roots' },
        'Dispel': { mod: 1, category: 'Force', description: 'Suppress magic, unravel ongoing effects', example: 'Cleansing Light' },
        'Veil': { mod: 1, category: 'Mind/Illusion', description: 'Conceal, blur, illusion, silence', example: 'Shadow Cloak' },
        'Scry': { mod: 1, category: 'Mind/Illusion', description: 'Reveal hidden, see distance, read traces', example: 'Echoing Trace' },
        'Memory': { mod: 1, category: 'Mind/Illusion', description: 'Erase, alter, restore memories', example: 'Forgotten Name' },
        'Command': { mod: 1, category: 'Mind/Illusion', description: 'Compel a short action (one word)', example: 'Blazing Decree' },
        'Fear': { mod: 1, category: 'Mind/Illusion', description: 'Panic, flee, break morale', example: 'Crushing Dark' },
        'HEAL': { mod: 1, category: 'Life/Body', description: 'Close wounds, restore flesh, reduce Harm 1', example: 'Lay on Hands' },
        'Purify': { mod: 1, category: 'Life/Body', description: 'Remove poison, corruption, disease', example: 'Cleansing Light' },
        'Strengthen': { mod: 1, category: 'Life/Body', description: 'Enhance body, armor, senses (temporary)', example: 'Boon of Vigor' },
        'Waken': { mod: 1, category: 'Life/Body', description: 'Counter sleep, paralysis, stun', example: 'Rousing Call' },
        'Beast': { mod: 1, category: 'Life/Body', description: 'Speak with or influence animals', example: 'Verdant Tongue' },
        'Leap': { mod: 2, category: 'Space/Motion', description: 'Jump far, blink across short space (Near)', example: 'Reed Walk' },
        'Fold': { mod: 2, category: 'Space/Motion', description: 'Short-range teleport, vanish-reappear (Far)', example: 'Shadow Step' },
        'Gate': { mod: 2, category: 'Space/Motion', description: 'Long distance passage, open/close path', example: 'Waymark' },
        'Gravity': { mod: 2, category: 'Space/Motion', description: 'Crush, lift, suspend, walk on walls/ceiling', example: 'Crushing Dark' },
        'Create': { mod: 2, category: 'Creation', description: 'Manifest mundane matter briefly (1 scene)', example: 'Momentary Forge' },
        'Summon': { mod: 2, category: 'Creation', description: 'Call a being or construct', example: 'Unquiet Host' },
        'Transmute': { mod: 2, category: 'Creation', description: 'Turn one thing into another (temporary)', example: 'Shed Skin' },
        'Animate': { mod: 2, category: 'Creation', description: 'Make objects act with intent (1 scene)', example: 'Living Weapon' },
        'Sense': { mod: 1, category: 'Utility', description: 'Detect presence of a named tag/element', example: 'Lingering Trace' },
        'Reveal': { mod: 1, category: 'Utility', description: 'Unveil hidden, glamoured, or invisible things', example: 'Echoing Truth' },
        'Light': { mod: 1, category: 'Utility', description: 'Create illumination (glow, torch-bright)', example: 'Dawnlight' },
        'Shadow': { mod: 1, category: 'Utility', description: 'Deepen darkness, hide edges, obscure', example: 'Umbral Veil' },
        'Silence': { mod: 1, category: 'Utility', description: 'Suppress sound in zone or on target', example: 'Hush' },
        'Protect': { mod: 1, category: 'Utility', description: 'Reduce/deflect next harm (Armor 1)', example: 'Aegis' },
        'Counter': { mod: 1, category: 'Reaction', description: 'Interrupt a casting/ritual in its window', example: 'Mage\'s Rebuke' },
        'Reflect': { mod: 2, category: 'Reaction', description: 'Turn next targeted effect back on its source', example: 'Mirror\'s Edge' },
        'Store': { mod: 2, category: 'Utility', description: 'Bank 1-2 successes in a vessel (once)', example: 'Reservoir' },
        'Curse': { mod: 2, category: 'Affliction', description: 'Attach hostile tag/timer to target', example: 'Thorn\'s Bargain' },
        'Bless': { mod: 1, category: 'Affliction', description: 'Grant favourable tag (luck, favor, ward-key)', example: 'Tide\'s Favor' }
    };
    
    for (const [name, data] of Object.entries(raw)) {
        map.set(name, { ...data, name });
    }
    return map;
}

// ============================================================
// CATEGORY METADATA
// ============================================================

const CATEGORY_COLORS = {
    'Elemental': '#e67e22',
    'Force': '#e74c3c',
    'Mind/Illusion': '#8e44ad',
    'Life/Body': '#27ae60',
    'Space/Motion': '#2980b9',
    'Creation': '#f39c12',
    'Utility': '#7f8c8d',
    'Reaction': '#c0392b',
    'Affliction': '#d35400'
};

const CATEGORY_ICONS = {
    'Elemental': '🔥',
    'Force': '💥',
    'Mind/Illusion': '🧠',
    'Life/Body': '💚',
    'Space/Motion': '🌀',
    'Creation': '✨',
    'Utility': '🔧',
    'Reaction': '⚡',
    'Affliction': '💀'
};

const CATEGORY_ORDER = ['Elemental', 'Force', 'Mind/Illusion', 'Life/Body', 'Space/Motion', 'Creation', 'Utility', 'Reaction', 'Affliction'];

// ─── Magic Paths Reference ─────────────────────────────────────
// Shown as a resource when no Free Caster character is selected, so the
// panel is useful before a character exists. Kept in sync manually with
// the richer MAGIC_PATHS object in features/characters/index.js — this is
// a small, self-contained copy rather than a cross-feature import, so a
// wrong relative path can never break this panel.
const MAGIC_PATH_REFERENCE = [
    { icon: '🔥', label: 'Free Caster', blurb: 'Raw TAGS grammar, no patron — pure will and improvisation.' },
    { icon: '📖', label: 'Runekeeper', blurb: 'Bound to one patron via Thiasos or Codex; steady Rites.' },
    { icon: '🔯', label: 'Invoker', blurb: 'Carries Symbols from multiple patrons; risks Cross-Resonance.' },
    { icon: '🎵', label: 'Cantor', blurb: "Sings a patron's Rites as Songs; Corruption blooms with Pushing." },
    { icon: '👁️', label: 'Summoner', blurb: 'Binds spirits from the Bestiary; manages the Leash.' },
    { icon: '🌿', label: 'Witch', blurb: 'Hedge magic at Thresholds, paid in Shadow, Shame, Identity Strain.' },
    { icon: '🧠', label: 'Psion', blurb: 'Mind-born power fueled by Mental Strain.' },
    { icon: '🧘', label: 'Monk', blurb: 'Patron-optional path of Breath States and monastic Techniques.' },
    { icon: '🦅', label: 'Familiar Only', blurb: 'A bonded companion without a full magic path.' },
    { icon: '🍃', label: 'Hedge Gifts', blurb: 'Small universal gifts available to any character.' }
];

function renderMagicPathReferenceHtml(highlightLabel) {
    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.4rem;text-align: start;margin-top:0.8rem;">
            ${MAGIC_PATH_REFERENCE.map(p => `
                <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:var(--bg2);border:1px solid ${p.label === highlightLabel ? 'var(--gold)' : 'var(--border)'};">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.1rem;">${p.icon}</span>
                        <strong style="font-size:0.82rem;${p.label === highlightLabel ? 'color:var(--gold);' : ''}">${p.label}</strong>
                    </div>
                    <div style="font-size:0.68rem;color:var(--text3);margin-top:0.15rem;line-height:1.3;">${p.blurb}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ─── Spell Templates ──────────────────────────────────────────

const SPELL_TEMPLATES = [
    { name: '🔥 Firebolt', tags: ['Burning', 'Strike'], description: 'A bolt of flame strikes a single target.' },
    { name: '❄️ Frost Grasp', tags: ['Freezing', 'Bind'], description: 'Ice encases a target, holding them in place.' },
    { name: '🌿 Healing Touch', tags: ['HEAL', 'Strengthen'], description: 'Close wounds and restore vitality to a touched ally.' },
    { name: '🌀 Telekinetic Push', tags: ['Force', 'Wind', 'Strike'], description: 'A blast of force knocks a target back.' },
    { name: '🌙 Shadow Veil', tags: ['Veil', 'Shadow', 'Silence'], description: 'Conceal yourself and allies in moving shadow.' },
    { name: '⚡ Storm Bolt', tags: ['Storm', 'Strike', 'Area'], description: 'A crackling bolt of ' +
        'lightning arcs through a zone.' },
    { name: '🛡️ Aegis', tags: ['Protect', 'Strengthen', 'Force'], description: 'A shimmering barrier ' +
        'protects you from harm.' },
    { name: '🔮 Scrying Eye', tags: ['Scry', 'Sense', 'Reveal'], description: 'Glimpse a distant place or ' +
        'hidden truth.' },
    { name: '💀 Leashed Curse', tags: ['Curse', 'Bind', 'Fear'], description: 'A curse that tightens as the ' +
        'target struggles.' },
    { name: '✨ Momentary Forge', tags: ['Create', 'Transmute', 'Animate'], description: 'Shape raw matter ' +
        'into a temporary tool or weapon.' }
];

// ─── Tag Combination Hints ────────────────────────────────────

const TAG_HINTS = {
    'Burning': 'Pair with Wind for a spreading fire, or with Strike for a concentrated bolt.',
    'Freezing': 'Pair with Bind to trap, or with Area for a chilling fog.',
    'Storm': 'Pair with Strike for a lightning bolt, or with Area for a thunderclap.',
    'Stone': 'Pair with Wall for a barrier, or with Bind for a cage.',
    'Wave': 'Pair with Area for a tidal surge, or with Strike for a water jet.',
    'Wind': 'Pair with Leap for a jump, or with Force for a gust.',
    'Force': 'The foundation of telekinesis. Pairs with almost anything.',
    'Area': 'Makes a spell affect a zone. Costs more DV but affects multiple targets.',
    'Strike': 'Focused single-target damage. Pairs with elemental tags.',
    'Wall': 'Creates a barrier. Pairs with Stone, Force, or even Shadow.',
    'Bind': 'Restrains a target. Pairs with Freezing, Stone, or Fear.',
    'Dispel': 'Counters magic. Pair with Counter for a reactive dispel.',
    'Veil': 'Concealment and illusion. Pairs with Shadow or Silence.',
    'Scry': 'Distant perception. Pairs with Sense or Reveal.',
    'Memory': 'Mind magic. Handle with care—Backlash is steep.',
    'Command': 'One-word compulsion. High risk, high reward.',
    'Fear': 'Area morale break. Pairs with Command or Bind.',
    'HEAL': 'Restoration magic. Safe and reliable.',
    'Purify': 'Cleansing. Essential for dealing with corruption.',
    'Strengthen': 'Temporary buffs. Pairs with Protect or HEAL.',
    'Waken': 'Counter to sleep/stun. Situational but clutch.',
    'Beast': 'Animal communication. Pairs with Sense.',
    'Leap': 'Short-range teleport. Pairs with Wind or Shadow.',
    'Fold': 'Long-range teleport. Very high DV. Use sparingly.',
    'Gate': 'Create a passage. Requires serious DV.',
    'Gravity': 'Alter gravity. High risk of Backlash.',
    'Create': 'Manifest matter. Brief but versatile.',
    'Summon': 'Call a being. Requires other tags to specify.',
    'Transmute': 'Change form. High Backlash risk.',
    'Animate': 'Give objects life. Brief and limited.',
    'Sense': 'Detection magic. Cheap and reliable.',
    'Reveal': 'Pierce illusions. Pairs with Sense.',
    'Light': 'Illumination. Simple and safe.',
    'Shadow': 'Darkness. Pairs with Veil or Silence.',
    'Silence': 'Sound suppression. Pairs with Veil.',
    'Protect': 'Defensive. Pairs with Strengthen.',
    'Counter': 'Reactive. Triggers when someone casts near you.',
    'Reflect': 'Redirect magic. Very high risk.',
    'Store': 'Bank successes. Prep time required.',
    'Curse': 'Hostile affliction. High risk of spreading.',
    'Bless': 'Friendly affliction. Reliable and appreciated.'
};

// ============================================================
// CALCULATOR FUNCTIONS (declared as functions then assigned to window for global access)
// ============================================================

function calculatorAddTag(tag) {
    const upper = tag.toUpperCase();
    if (!tagDefinitions || !tagDefinitions.has(upper)) {
        showToast(i18nText("feature.spellcraft.components.calculator.unknownTagValueCheckTheLexicon", { value0: tag }, "Unknown tag: \"{{value0}}\" — check the lexicon."), 'warning');
        return;
    }
    if (activeTags.includes(upper)) {
        showToast(i18nText("feature.spellcraft.components.calculator.valueAlreadyAdded", { value0: tag }, "\"{{value0}}\" already added."), 'info');
        return;
    }
    activeTags.push(upper);
    updateResult();
    // Show hint for the new tag
    calculatorShowHint(upper);
}

function calculatorRemoveTag(tag) {
    activeTags = activeTags.filter(t => t !== tag);
    updateResult();
    calculatorClearHint();
}

function calculatorClear() {
    activeTags = [];
    updateResult();
    const input = document.getElementById('tags-input');
    if (input) input.value = '';
    calculatorClearHint();
}

function calculatorRefresh() {
    activeTags = [];
    if (calculatorContainer) renderCalculator(calculatorContainer);
    showToast(i18nText("feature.spellcraft.components.calculator.calculatorRefreshed", null, "🔄 Calculator refreshed."), 'info');
}

function calculatorShowHint(tag) {
    const hintEl = document.getElementById('tag-hint');
    if (!hintEl) return;
    const upper = tag.toUpperCase();
    const def = tagDefinitions ? tagDefinitions.get(upper) : null;
    const hint = TAG_HINTS[upper] || def?.description || '';
    if (hint) {
        hintEl.innerHTML = `💡 <strong>${escHtml(upper)}</strong>: ${escHtml(hint)}`;
        hintEl.style.color = 'var(--text2)';
    } else {
        hintEl.innerHTML = `${escHtml(upper)} — no note for this tag. Try it with a second tag.`;
        hintEl.style.color = 'var(--text3)';
    }
}

function calculatorClearHint() {
    const hintEl = document.getElementById('tag-hint');
    if (!hintEl) return;
    if (activeTags.length > 0) {
        const lastTag = activeTags[activeTags.length - 1];
        const def = tagDefinitions ? tagDefinitions.get(lastTag) : null;
        hintEl.innerHTML = `<strong>${escHtml(lastTag)}</strong>: ${def?.description || 'No note for this tag yet.'}`;
        hintEl.style.color = 'var(--text3)';
    } else {
        hintEl.innerHTML = '💡 Select a tag to see how it works with others.';
        hintEl.style.color = 'var(--text3)';
    }
}

function calculatorSaveSpell() {
    if (activeTags.length === 0) {
        showToast(i18nText("feature.spellcraft.components.calculator.addSomeTagsFirst", null, "Add some tags first."), 'error');
        return;
    }

    const char = getCharacterData();
    if (!char) return;

    const spellName = activeTags.join(' ');
    const defaultName = spellName.length > 40 ? spellName.substring(0, 37) + '...' : spellName;
    const name = prompt(i18nText("feature.spellcraft.components.calculator.spellName", null, "Spell name:"), defaultName);
    if (!name) return;
    const description = prompt(i18nText("feature.spellcraft.components.calculator.effectDescription", null, "Effect description:"), generateSpellDescription(activeTags)) || '';

    // Compute DV
    const result = calculateDV(activeTags);
    const dv = result.dv;

    const newSpell = {
        id: generateId('spell_'),
        name: name.trim(),
        description: description.trim(),
        tags: activeTags.slice(),
        dv: dv,
        breakdown: result.breakdown,
        totalMod: result.totalMod,
        source: 'calculator',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        _successes: 0,
        _failures: 0,
        _lastUsed: null
    };

    if (!char.spellbook) char.spellbook = [];
    // Avoid duplicates
    const existing = char.spellbook.findIndex(s => s.name === newSpell.name && s.tags?.join(',') === newSpell.tags.join(','));
    if (existing >= 0) {
        if (!confirm(i18nText("feature.spellcraft.components.calculator.valueAlreadyExistsInYourSpellbookOverwrite", { value0: newSpell.name }, "\"{{value0}}\" already exists in your spellbook. Overwrite?"))) return;
        char.spellbook[existing] = newSpell;
    } else {
        char.spellbook.push(newSpell);
    }
    saveCharacter({ spellbook: char.spellbook });
    
    // Update history
    spellHistory = char.spellbook.filter(s => s.source === 'calculator' || s.source === 'custom');
    
    showToast(i18nText("feature.spellcraft.components.calculator.valueSavedToSpellbookDVValue", { value0: newSpell.name, value1: dv }, "✨ \"{{value0}}\" saved to spellbook (DV {{value1}})."), 'success');
    activeTags = [];
    updateResult();
}

function calculatorTestCast() {
    if (activeTags.length === 0) {
        showToast(i18nText("feature.spellcraft.components.calculator.addSomeTagsFirst", null, "Add some tags first."), 'error');
        return;
    }

    const char = getCharacterData();
    if (!char) return;

    const { dv } = calculateDV(activeTags);

    // Dice pool: Wits + Arcana
    const wits = char.wits || 1;
    const arcana = char.skills?.arcana || 0;
    const pool = wits + arcana;

    if (pool < 1) {
        showToast(i18nText("feature.spellcraft.components.calculator.dicePoolMustBeAtLeast1", null, "Dice pool must be at least 1 die. Increase your Wits or Arcana."), 'error');
        return;
    }

    // Roll using core dice module
    const result = performRoll(pool, dv);

    // Determine outcome
    let outcomeLabel, backlashSeverity, backlashDesc, outcomeColor;
    if (result.successes >= dv && result.storyBeats === 0) {
        outcomeLabel = '✨ Clean Success';
        backlashSeverity = 'None';
        backlashDesc = 'The Weave bends perfectly. No cost.';
        outcomeColor = 'var(--gold)';
    } else if (result.successes >= dv && result.storyBeats > 0) {
        outcomeLabel = '⚠️ Success with Consequences';
        backlashSeverity = 'Minor';
        backlashDesc = 'Fatigue +1 or -1 die on next roll (GM choice).';
        outcomeColor = 'var(--orange)';
    } else if (result.successes > 0 && result.successes < dv) {
        outcomeLabel = '⚠️ Partial Success';
        backlashSeverity = 'Moderate';
        backlashDesc = 'Harm 1 (stress) or a minor Condition.';
        outcomeColor = 'var(--orange)';
    } else {
        outcomeLabel = '💀 Miss';
        backlashSeverity = 'Major';
        backlashDesc = 'Harm 2, permanent Scar, or reality fracture (GM choice).';
        outcomeColor = 'var(--red)';
    }

    const spellName = activeTags.join(' ');

    // Track in character history
    if (char._spellcraftHistory === undefined) char._spellcraftHistory = [];
    const spellId = spellName + '-' + activeTags.join('|');
    let historyEntry = char._spellcraftHistory.find(h => h.spellId === spellId);
    if (!historyEntry) {
        historyEntry = { spellId, spellName, tags: activeTags.slice(), successes: 0, failures: 0, lastUsed: null };
        char._spellcraftHistory.push(historyEntry);
    }
    if (result.successes >= dv) {
        historyEntry.successes++;
    } else {
        historyEntry.failures++;
    }
    historyEntry.lastUsed = Date.now();
    saveCharacter({ _spellcraftHistory: char._spellcraftHistory });

    // Show result in a modal
    const html = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;font-size:1.05rem;color:${outcomeColor};">${outcomeLabel}</span>
                <span style="font-size:0.8rem;color:var(--text3);">DV ${dv}</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">${escHtml(spellName)}</div>
            <div style="font-size:0.75rem;color:var(--text2);">Pool: ${pool}d (Wits ${wits} + Arcana ${arcana})</div>
            <div style="font-size:0.75rem;color:var(--text3);">Roll: ${result.dice.join(', ')} → <strong>${result.successes}</strong> successes</div>
            ${result.storyBeats > 0 ? `<div style="font-size:0.75rem;color:var(--text3);">📖 ${result.storyBeats} Story Beats generated</div>` : ''}
            ${result.criticalEffect ? `<div style="font-size:0.75rem;color:var(--gold);">✨ ${result.criticalEffect}</div>` : ''}
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.8rem;color:${backlashSeverity === 'None' ? 'var(--green)' : 'var(--red)'};">
                <strong>⚡ Backlash:</strong> ${backlashSeverity} — ${backlashDesc}
            </div>
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;margin-top:0.1rem;">
                ${result.successes >= dv ? 'Specific. Repeatable. Try not to look so surprised. — Lysandra' : 'Write down exactly what you did. Especially the foolish part. — Lysandra'}
            </div>
            <div style="font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">
                Tracked: ${historyEntry.successes} successes · ${historyEntry.failures} failures
            </div>
        </div>
    `;

    showToastWithHTML(html, result.successes >= dv ? 'success' : 'warning');
}

function calculatorGamble() {
    if (activeTags.length === 0) {
        showToast(i18nText("feature.spellcraft.components.calculator.addSomeTagsFirst", null, "Add some tags first."), 'error');
        return;
    }

    const char = getCharacterData();
    if (!char) return;

    const { dv } = calculateDV(activeTags);
    const wits = char.wits || 1;
    const arcana = char.skills?.arcana || 0;
    const pool = wits + arcana;

    if (pool < 1) {
        showToast(i18nText("feature.spellcraft.components.calculator.dicePoolMustBeAtLeast1", null, "Dice pool must be at least 1 die. Increase your Wits or Arcana."), 'error');
        return;
    }

    // Simulate 3 rolls
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
        const result = performRoll(pool, dv);
        let outcome = '';
        if (result.successes >= dv && result.storyBeats === 0) outcome = '✨ Clean';
        else if (result.successes >= dv && result.storyBeats > 0) outcome = '⚠️ Success';
        else if (result.successes > 0 && result.successes < dv) outcome = '⚠️ Partial';
        else outcome = '💀 Miss';
        outcomes.push(outcome);
    }

    const mostLikely = outcomes.filter(o => o === '✨ Clean').length > 1 ? 'Clean Success' :
                       outcomes.filter(o => o === '💀 Miss').length > 1 ? 'Miss' :
                       'Mixed Results';

    const spellName = activeTags.join(' ');

    const html = `
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🎰 The Weave's Odds</div>
            <div style="font-size:0.85rem;">${escHtml(spellName)} (DV ${dv})</div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${pool}d (Wits ${wits} + Arcana ${arcana})</div>
            <div style="display:flex;gap:0.5rem;font-size:0.8rem;margin:0.2rem 0;">
                <span>🎲 ${outcomes[0]}</span>
                <span>🎲 ${outcomes[1]}</span>
                <span>🎲 ${outcomes[2]}</span>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.8rem;color:var(--text2);">
                <strong>Most likely outcome:</strong> ${mostLikely}
            </div>
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;">
                ${dv <= 3 ? 'Lysandra’s note: You may survive this one.' : dv <= 5 ? 'Lysandra’s note: Possible is not the same as wise.' : 'Lysandra’s note: Write a will first.'}
            </div>
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()" data-i18n="feature.spellcraft.components.calculator.close">Close</button>
        </div>
    `;

    showToastWithHTML(html, 'info');
}

function calculatorShowHistory() {
    const char = getCharacterData();
    if (!char) return;

    // Refresh from character
    if (char.spellbook) {
        spellHistory = char.spellbook.filter(s => s.source === 'calculator' || s.source === 'custom');
    }

    if (spellHistory.length === 0) {
        showToast(i18nText("feature.spellcraft.components.calculator.noSpellsCreatedWithTheCalculatorYet", null, "No spells created with the calculator yet."), 'info');
        return;
    }
    
    const list = spellHistory.slice(-8).reverse().map(s => {
        const successRate = s._successes !== undefined && s._successes + s._failures > 0 ?
            Math.round((s._successes / (s._successes + s._failures)) * 100) : '—';
        return `• <strong>${escHtml(s.name)}</strong> (DV ${s.dv}) – ${s.tags.join(' ')}${s._successes !== undefined ? ` <span style="color:var(--text3);font-size:0.7rem;">✨${s._successes} 💀${s._failures || 0}</span>` : ''}`;
    }).join('<br>');
    
    const totalSpells = spellHistory.length;
    const totalSuccesses = spellHistory.reduce((acc, s) => acc + (s._successes || 0), 0);
    const totalFailures = spellHistory.reduce((acc, s) => acc + (s._failures || 0), 0);
    const totalCasts = totalSuccesses + totalFailures;
    const successRate = totalCasts > 0 ? Math.round((totalSuccesses / totalCasts) * 100) : '—';

    showToastWithHTML(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;font-size:1rem;color:var(--gold);">📜 Spell History</span>
                <span style="font-size:0.7rem;color:var(--text3);">${totalSpells} spells</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text3);">
                ✨ ${totalSuccesses} successes · 💀 ${totalFailures} failures · 🎯 ${successRate}% success rate
            </div>
            <div style="font-size:0.85rem;color:var(--text2);max-height:250px;overflow-y:auto;border-top:1px solid var(--border);padding-top:0.2rem;">
                ${list}
            </div>
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;margin-top:0.1rem;">
                "Every cast is a lesson." – Lysandra
            </div>
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()" data-i18n="feature.spellcraft.components.calculator.close">Close</button>
        </div>
    `, 'info');
}

// ============================================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE (for HTML event handlers)
// ============================================================

window.calculatorAddTag = calculatorAddTag;
window.calculatorRemoveTag = calculatorRemoveTag;
window.calculatorClear = calculatorClear;
window.calculatorRefresh = calculatorRefresh;
window.calculatorShowHint = calculatorShowHint;
window.calculatorClearHint = calculatorClearHint;
window.calculatorSaveSpell = calculatorSaveSpell;
window.calculatorTestCast = calculatorTestCast;
window.calculatorGamble = calculatorGamble;
window.calculatorShowHistory = calculatorShowHistory;

// ============================================================
// MAIN RENDER
// ============================================================

async function renderCalculator(el) {
    calculatorContainer = el;
    const char = getCharacterData();
    if (!char || char.magicPath !== 'free-caster') {
        el.innerHTML = `
            <div style="text-align:center;padding:1rem;color:var(--text3);">
                <div style="font-size:2rem;">🔮</div>
                <p><strong>Free Caster Calculator</strong></p>
                <p style="font-size:0.85rem;">Select a character with the <strong>Free Caster</strong> magic path to access the TAGS calculator.</p>
                <p style="font-size:0.75rem;color:var(--text3);">Free Casters weave the raw Weave using TAGS – no patron, no codex, only will and grammar.</p>
                ${!char ? `
                    <div style="margin-top:0.5rem;font-weight:600;color:var(--gold);">📚 Magic Paths Reference</div>
                    ${renderMagicPathReferenceHtml('Free Caster')}
                ` : ''}
            </div>
        `;
        return;
    }

    // Load wiki tags
    await loadWikiTags();

    // Load spell history from character
    if (char.spellbook) {
        spellHistory = char.spellbook.filter(s => s.source === 'custom' || s.source === 'calculator' || s.source === 'tags-calculator');
        // Load success/failure data if stored
        if (char._spellcraftHistory) {
            spellHistory = spellHistory.map(s => {
                const hist = char._spellcraftHistory?.find(h => h.spellId === s.id);
                if (hist) {
                    s._successes = hist.successes || 0;
                    s._failures = hist.failures || 0;
                    s._lastUsed = hist.lastUsed || null;
                }
                return s;
            });
        }
    }

    el.innerHTML = `
        <div class="calculator-container" style="display:flex;flex-direction:column;gap:0.5rem;">
            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="calculator-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🔮</span>
                    <div>
                        <span style="font-weight:600;font-size:1.1rem;color:var(--gold);">The Weave's Grammar</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-inline-start:0.5rem;">TAGS Calculator</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.calculatorClear()" data-i18n="feature.spellcraft.components.calculator.clear">✕ Clear</button>
                    <button class="btn btn-xs btn-secondary" onclick="window.calculatorRefresh()" data-i18n="feature.spellcraft.components.calculator.refresh">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Quick Templates ───────────────────────────── -->
            <div style="display:flex;gap:0.2rem;flex-wrap:wrap;padding:0.1rem 0;border-bottom:1px solid var(--border);">
                <span style="font-size:0.65rem;color:var(--text3);padding-inline-end:0.3rem;">⚡ Quick:</span>
                ${SPELL_TEMPLATES.map(t => `
                    <button class="btn btn-xs btn-ghost template-btn" style="font-size:0.6rem;padding:0.05rem 0.4rem;" data-tags="${t.tags.join(',')}">${escHtml(t.name)}</button>
                `).join('')}
            </div>

            <!-- ─── Main Workspace ────────────────────────────── -->
            <div class="calculator-workspace" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <!-- Left: Input -->
                <div style="display:flex;flex-direction:column;gap:0.3rem;">
                    <div style="font-size:0.75rem;color:var(--text3);">"Name your tags. The Weave listens."</div>
                    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                        <div style="flex:1;min-width:120px;position:relative;">
                            <input type="text" id="tags-input" placeholder="Type a tag..." style="width:100%;font-size:0.85rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:0.25rem 0.5rem;color:var(--text);" / data-i18n-attr="placeholder:feature.spellcraft.components.calculator.typeATag">
                            <div id="tag-suggestions" style="position:absolute;top:100%;inset-inline:0;background:var(--bg1);border:1px solid var(--border);border-radius:var(--radius);max-height:150px;overflow-y:auto;display:none;z-index:20;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>
                        </div>
                        <button class="btn btn-sm btn-primary" id="add-tag-btn" data-i18n="feature.spellcraft.components.calculator.add">➕ Add</button>
                    </div>
                    <div id="active-tags" style="display:flex;flex-wrap:wrap;gap:0.2rem;min-height:2.2rem;padding:0.2rem;background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
                        <span style="font-size:0.65rem;color:var(--text3);">Add tags to build your spell.</span>
                    </div>
                    ${Object.entries(TAG_HINTS).length > 0 ? `
                        <div id="tag-hint" style="font-size:0.65rem;color:var(--text3);min-height:1.5rem;font-style:italic;padding:0.1rem 0.2rem;">
                            💡 Select a tag to see how it works with others.
                        </div>
                    ` : ''}
                </div>

                <!-- Right: Result -->
                <div id="calc-result" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;border:1px solid var(--border);min-height:110px;display:flex;flex-direction:column;justify-content:center;">
                    <div style="text-align:center;color:var(--text3);font-size:0.85rem;">
                        <div style="font-size:2rem;">✧</div>
                        <p>Add tags to weave your spell.</p>
                    </div>
                </div>
            </div>

            <!-- ─── Actions ────────────────────────────────────── -->
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;padding:0.2rem 0;">
                <button class="btn btn-sm btn-gold" id="save-spell-btn" data-i18n="feature.spellcraft.components.calculator.saveAsSpell">💾 Save as Spell</button>
                <button class="btn btn-sm btn-secondary" id="roll-test-btn" data-i18n="feature.spellcraft.components.calculator.testCast">🎲 Test Cast</button>
                <button class="btn btn-sm btn-secondary" id="gamble-btn" data-i18n="feature.spellcraft.components.calculator.gamble">🎰 Gamble</button>
                <button class="btn btn-sm btn-secondary" id="clear-tags-btn" data-i18n="feature.spellcraft.components.calculator.clear_nv42f">🧹 Clear</button>
                <button class="btn btn-sm btn-ghost" onclick="window.calculatorShowHistory()" data-i18n="feature.spellcraft.components.calculator.history">📜 History</button>
            </div>

            <!-- ─── Tag Library ────────────────────────────────── -->
            <div class="calculator-library" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.8rem;font-weight:600;color:var(--gold);">📖 The Weave's Lexicon</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${tagDefinitions ? tagDefinitions.size : 0} tags</span>
                </div>
                <div id="tag-library" style="display:flex;flex-wrap:wrap;gap:0.2rem;max-height:120px;overflow-y:auto;">
                    ${tagDefinitions ? renderTagLibrary() : '<span style="font-size:0.7rem;color:var(--text3);">Loading tags...</span>'}
                </div>
            </div>

            <!-- ─── Quick Reference ────────────────────────────── -->
            <div class="calculator-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;">
                <div>📐 <strong>DV:</strong> 1 + tags + mods</div>
                <div>⚡ <strong>Dangerous:</strong> +2 DV</div>
                <div>💥 <strong>Backlash:</strong> by DV</div>
                <div>📖 <strong>Tags:</strong> Intent + Grammar</div>
                <div>🎯 <strong>Pool:</strong> Wits + Arcana</div>
            </div>
        </div>
    `;

    // Attach events
    attachEvents(el);
}

// ============================================================
// TAG LIBRARY RENDER
// ============================================================

function renderTagLibrary() {
    if (!tagDefinitions) return '';
    
    const sorted = Array.from(tagDefinitions.keys()).sort();
    const groups = {};
    
    for (const tag of sorted) {
        const def = tagDefinitions.get(tag);
        const cat = def.category || 'Utility';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(tag);
    }
    
    let html = '';
    for (const category of CATEGORY_ORDER) {
        const tags = groups[category] || [];
        if (tags.length === 0) continue;
        const color = CATEGORY_COLORS[category] || 'var(--text3)';
        const icon = CATEGORY_ICONS[category] || '📌';
        html += `
            <div style="display:flex;align-items:center;gap:0.2rem;margin-inline-end:0.3rem;flex-wrap:wrap;">
                <span style="font-size:0.6rem;color:${color};font-weight:600;">${icon} ${category}</span>
                <span style="display:flex;gap:0.1rem;flex-wrap:wrap;">
                    ${tags.map(t => `
                        <span class="tag-pill" style="font-size:0.55rem;padding:0.05rem 0.3rem;border-radius:8px;background:var(--bg3);border:1px solid ${color};color:${color};cursor:pointer;" 
                              onclick="window.calculatorAddTag('${t}')" 
                              onmouseenter="window.calculatorShowHint('${t}')"
                              onmouseleave="window.calculatorClearHint()">
                            ${escHtml(t)}
                        </span>
                    `).join('')}
                </span>
            </div>
        `;
    }
    return html;
}

// ============================================================
// EVENT ATTACHMENT
// ============================================================

function attachEvents(el) {
    const input = el.querySelector('#tags-input');
    const addBtn = el.querySelector('#add-tag-btn');
    const clearBtn = el.querySelector('#clear-tags-btn');
    const saveBtn = el.querySelector('#save-spell-btn');
    const rollBtn = el.querySelector('#roll-test-btn');
    const gambleBtn = el.querySelector('#gamble-btn');
    const suggestions = el.querySelector('#tag-suggestions');

    // Add tag on Enter or button click
    const addTag = () => {
        if (!input) return;
        const value = input.value.trim().toUpperCase();
        if (!value) return;
        window.calculatorAddTag(value);
        input.value = '';
        input.focus();
        if (suggestions) suggestions.style.display = 'none';
    };

    if (addBtn) addBtn.addEventListener('click', addTag);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
            }
            if (e.key === 'Escape' && suggestions) {
                suggestions.style.display = 'none';
            }
        });
        
        // Autocomplete with fuzzy matching
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim().toUpperCase();
            if (!query || !tagDefinitions) {
                if (suggestions) suggestions.style.display = 'none';
                return;
            }
            
            const matches = Array.from(tagDefinitions.keys())
                .filter(t => t.startsWith(query))
                .slice(0, 10);
            
            // If no exact starts-with matches, try contains
            const fuzzyMatches = matches.length === 0 ? 
                Array.from(tagDefinitions.keys())
                    .filter(t => t.includes(query))
                    .slice(0, 8) : matches;
            
            const displayMatches = matches.length > 0 ? matches.slice(0, 8) : fuzzyMatches;
            
            if (displayMatches.length === 0) {
                if (suggestions) suggestions.style.display = 'none';
                return;
            }
            
            if (suggestions) {
                suggestions.style.display = 'block';
                suggestions.innerHTML = displayMatches.map(m => {
                    const def = tagDefinitions.get(m);
                    const color = def ? CATEGORY_COLORS[def.category] || 'var(--text3)' : 'var(--text3)';
                    return `
                        <div class="suggestion-item" style="display:flex;justify-content:space-between;padding:0.2rem 0.5rem;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.8rem;color:var(--text);" 
                             onclick="window.calculatorAddTag('${m}'); document.getElementById('tags-input').value=''; document.getElementById('tag-suggestions').style.display='none';">
                            <span style="font-weight:500;">${escHtml(m)}</span>
                            <span style="font-size:0.6rem;color:${color};">${def ? def.category || 'magic' : '?'} ${def ? `(+${def.mod})` : ''}</span>
                        </div>
                    `;
                }).join('');
            }
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => { if (suggestions) suggestions.style.display = 'none'; }, 250);
        });
    }

    // Template buttons
    el.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tags = (btn.dataset.tags || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            window.calculatorClear();
            for (const tag of tags) {
                if (tag && tagDefinitions && tagDefinitions.has(tag)) {
                    activeTags.push(tag);
                }
            }
            updateResult();
            showToast(i18nText("feature.spellcraft.components.calculator.loadedTemplateValue", { value0: btn.textContent.trim() }, "Loaded template: {{value0}}"), 'info');
        });
    });

    if (clearBtn) clearBtn.addEventListener('click', window.calculatorClear);
    if (saveBtn) saveBtn.addEventListener('click', window.calculatorSaveSpell);
    if (rollBtn) rollBtn.addEventListener('click', window.calculatorTestCast);
    if (gambleBtn) gambleBtn.addEventListener('click', window.calculatorGamble);

    // FIX: previously this added a brand-new document-level click listener
    // every time attachEvents() ran (i.e. every render), and old ones were
    // never removed. Over a session this silently stacked up dozens of
    // duplicate handlers. Now we remove any handler we previously attached
    // before binding a fresh one, so there is always exactly one.
    if (outsideClickHandler) {
        document.removeEventListener('click', outsideClickHandler);
    }
    outsideClickHandler = (e) => {
        if (suggestions && !suggestions.contains(e.target) && e.target !== input) {
            suggestions.style.display = 'none';
        }
    };
    document.addEventListener('click', outsideClickHandler);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateSpellDescription(tags) {
    if (!tags || tags.length === 0) return '';
    const descParts = [];
    for (const tag of tags) {
        const def = tagDefinitions ? tagDefinitions.get(tag) : null;
        if (def && def.description) {
            descParts.push(def.description.split(',')[0].trim());
        } else {
            descParts.push(tag);
        }
    }
    // Capitalize first letter
    const desc = descParts.join(' with ');
    return desc.charAt(0).toUpperCase() + desc.slice(1) + '.';
}

function calculateDV(tags) {
    let dv = 1 + tags.length;
    let totalMod = 0;
    let breakdown = [];
    let unknownTags = [];

    for (const tag of tags) {
        if (tagDefinitions && tagDefinitions.has(tag)) {
            const def = tagDefinitions.get(tag);
            const mod = def.mod || 1;
            totalMod += mod;
            const danger = mod > 1 ? '⚡' : '';
            breakdown.push(`${tag}${danger} (+${mod})`);
        } else {
            unknownTags.push(tag);
            breakdown.push(`${tag} (?)`);
        }
    }
    dv += totalMod;

    return { dv, totalMod, breakdown, unknownTags };
}

function updateResult() {
    const resultDiv = document.getElementById('calc-result');
    const tagsContainer = document.getElementById('active-tags');
    
    if (!resultDiv || !tagsContainer) return;

    // Update tags display
    if (activeTags.length === 0) {
        tagsContainer.innerHTML = `<span style="font-size:0.65rem;color:var(--text3);">Add tags to build your spell.</span>`;
    } else {
        tagsContainer.innerHTML = activeTags.map(tag => {
            const def = tagDefinitions ? tagDefinitions.get(tag) : null;
            const color = def ? CATEGORY_COLORS[def.category] || 'var(--gold)' : 'var(--gold)';
            const mod = def ? def.mod : 1;
            return `
                <span class="tag-badge" style="display:inline-flex;align-items:center;gap:0.2rem;padding:0.1rem 0.4rem;border-radius:12px;background:${color}22;border:1px solid ${color};font-size:0.7rem;color:${color};cursor:pointer;" 
                      onclick="window.calculatorRemoveTag('${tag}')"
                      onmouseenter="window.calculatorShowHint('${tag}')"
                      onmouseleave="window.calculatorClearHint()">
                    ${escHtml(tag)}
                    <span style="font-size:0.55rem;opacity:0.7;">+${mod}</span>
                    <span style="font-size:0.55rem;">✕</span>
                </span>
            `;
        }).join('');
        // Update hint for last tag
        if (activeTags.length > 0) {
            window.calculatorShowHint(activeTags[activeTags.length - 1]);
        }
    }

    // Compute results
    if (activeTags.length === 0) {
        resultDiv.innerHTML = `
            <div style="text-align:center;color:var(--text3);font-size:0.85rem;">
                <div style="font-size:2rem;">✧</div>
                <p>Add tags to weave your spell.</p>
            </div>
        `;
        return;
    }

    const { dv, totalMod, breakdown, unknownTags } = calculateDV(activeTags);

    // Backlash risk
    let riskLevel, riskColor, riskDesc;
    if (dv <= 3) {
        riskLevel = 'Low';
        riskColor = 'var(--green)';
        riskDesc = 'Minor Backlash: Fatigue or -1 die.';
    } else if (dv <= 5) {
        riskLevel = 'Moderate';
        riskColor = 'var(--orange)';
        riskDesc = 'Moderate Backlash: Harm 1 or a Condition.';
    } else if (dv <= 7) {
        riskLevel = 'High';
        riskColor = 'var(--red)';
        riskDesc = 'Major Backlash: Harm 2 or a Scar.';
    } else {
        riskLevel = 'Catastrophic';
        riskColor = '#8b0000';
        riskDesc = 'Catastrophic Backlash: Harm 3, permanent damage, or reality fracture.';
    }

    // Spell preview
    const spellName = activeTags.join(' ');
    const spellEffect = generateSpellDescription(activeTags);

    resultDiv.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.2rem;height:100%;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;font-size:0.95rem;color:var(--gold);">${escHtml(spellName)}</span>
                <span style="font-size:0.8rem;font-weight:600;color:${riskColor};padding:0.05rem 0.4rem;border-radius:8px;background:${riskColor}22;border:1px solid ${riskColor};">DV ${dv}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text2);font-style:italic;margin-bottom:0.1rem;">
                "${escHtml(spellEffect)}"
            </div>
            <div style="font-size:0.65rem;color:var(--text3);">
                ${breakdown.join(' + ')}
                ${unknownTags.length ? `<span style="color:var(--red);"> ⚠️ Unknown: ${unknownTags.join(', ')}</span>` : ''}
            </div>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;font-size:0.7rem;border-top:1px solid var(--border);padding-top:0.1rem;margin-top:0.1rem;">
                <span>📊 Tags: ${activeTags.length}</span>
                <span>📐 Modifiers: +${totalMod}</span>
                <span style="color:${riskColor};">💥 Risk: ${riskLevel}</span>
                <span style="font-size:0.6rem;color:var(--text3);">${riskDesc}</span>
            </div>
            ${riskLevel === 'Catastrophic' ? `<div style="font-size:0.7rem;color:#8b0000;font-weight:600;">⚠️ THIS SPELL COULD UNMAKE YOU. Proceed with caution.</div>` : ''}
        </div>
    `;
}

// ============================================================
// TOAST WITH HTML (shared)
// ============================================================

function showToastWithHTML(html, type = 'info') {
    // Use the shared helper from the module if available
    if (typeof window.spellbookShowToastWithHTML === 'function') {
        window.spellbookShowToastWithHTML(html, type);
        return;
    }

    // A toast-style notice, anchored to a corner — not a full-screen pop-up
    // with a backdrop blocking the rest of the page.
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; bottom: 1rem; inset-inline-end: 1rem; z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = `
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90vw; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 60vh; overflow-y: auto;
    `;
    inner.innerHTML = html + `<br><button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()" data-i18n="feature.spellcraft.components.calculator.close">Close</button>`;
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

export { renderCalculator, loadWikiTags };
