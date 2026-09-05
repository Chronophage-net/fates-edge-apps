/**
 * Combat Actions — contextual melee/ranged/tactics panel for the VTT.
 *
 * Reads the currently-selected character (via vttStore) and surfaces ONLY
 * the combat options that character actually has: attack buttons for each
 * combat skill they've bought, named maneuvers they qualify for, and their
 * own combat-flavored Talents (passive bonuses shown as chips, active/
 * reactive ones shown as one-click buttons with use-limit tracking).
 *
 * Works for both:
 *  - Narrative / theatre-of-the-mind play: a simple Close/Near/Far/Absent
 *    range picker per target, matching the same bands the GM's Combat
 *    Tracker (encounters/combat.js) already uses.
 *  - Optional grid combat: if the GM's Combat Tracker is open for the
 *    current encounter, picking a target + range here calls
 *    combat.js's setTrackerRangeByName(), so it shows up on the GM's
 *    Range Grid too. (A literal token-drag Whiteboard sync can plug into
 *    the same bridge later — see syncRangeToTracker() below — once the
 *    Whiteboard module exposes token distances.)
 *
 * This module deliberately does NOT change how dice are rolled — it just
 * populates the existing #vtt-attr / #vtt-skill / #vtt-boons roller
 * fields (see vtt-core.js renderCommonRolls for the same pattern), so
 * "Roll & Post" keeps working exactly as before.
 *
 * ── Assumptions worth knowing about (easy to retune below) ──────────────
 * 1. Attribute pairing per skill (SKILL_ATTR_MAP): Melee/
 *    Athletics pair with Body; Ranged pairs with Wits (aim/precision);
 *    Tactics pairs with Wits; Command pairs with Presence. If your table
 *    plays it differently, just edit SKILL_ATTR_MAP.
 * 2. Weapon range modifiers (WEAPON_CLASS_MODS) mirror the Close/Near
 *    dice table on the character sheet (characters/editor.js
 *    WEAPON_CLASSES): Light +2d/+1d, Medium +1d/+2d, Heavy -1d/+3d.
 * 3. "Sidestep Strike" and "Grapple" are named, RAW maneuvers pulled
 *    from the Player's Guide. Anything marked "Homebrew" is a clearly
 *    optional convenience action, not an official rule — confirm with
 *    your table before using it as written.
 */

import { t as i18nText } from '@core/i18n.js';
import { vttStore } from '@core/vtt-store.js';
import { q, qa } from './vtt-core.js';
import { escHtml } from '@core/utils.js';
import { showToast } from '@components/Toast.js';

// ============================================================
// CONFIG — tweak here if your table's conventions differ
// ============================================================

const SKILL_ATTR_MAP = {
    melee: 'body',
    athletics: 'body',
    ranged: 'wits',
    insight: 'wits',
    sway: 'presence',
};

// Melee covers close combat armed or unarmed, so both buttons roll the same
// skill. The unarmed button is kept because players reach for it by name.
const ATTACK_SKILLS = [
    { key: 'melee', label: 'Melee', icon: '⚔️' },
    { key: 'ranged', label: 'Ranged', icon: '🏹' },
    { key: 'melee', label: 'Unarmed', icon: '🥊' },
];

// Mirrors characters/editor.js WEAPON_CLASSES close/near dice notes.
const WEAPON_CLASS_MODS = {
    light: { close: 2, near: 1, label: 'Light Weapon' },
    medium: { close: 1, near: 2, label: 'Medium Weapon' },
    heavy: { close: -1, near: 3, label: 'Heavy Weapon' },
};

// Narrative range bands — same concept/labels as the GM Tracker's
// RANGE_BANDS in encounters/combat.js, kept as a local copy so this
// panel works even when the Tracker isn't open.
const RANGE_BANDS = [
    { key: 'close', label: 'Close', color: 'var(--red)', weaponKey: 'close' },
    { key: 'near', label: 'Near', color: 'var(--gold)', weaponKey: 'near' },
    { key: 'far', label: 'Far', color: 'var(--blue)', weaponKey: null },
    { key: 'absent', label: 'Absent', color: 'var(--text3)', weaponKey: null },
];

// Named, RAW maneuvers. `requires(skills)` decides whether the button
// shows for the selected character.
const MANEUVERS = [
    {
        id: 'sidestep-strike',
        label: 'Sidestep Strike',
        icon: '↪️',
        raw: true,
        requires: (sk) => (sk.melee || 0) >= 1,
        effect: 'Move one range band as part of a melee attack; your Position worsens by one step.',
        skillKey: 'melee',
        worsensPosition: true, // 👈 NEW: bridges to combat.js's tracked Position
    },
    {
        id: 'grapple',
        label: 'Grapple',
        icon: '🤼',
        raw: true,
        requires: (sk) => (sk.melee || 0) >= 1 || (sk.athletics || 0) >= 1,
        effect: 'Opposed Body+Melee vs. Body+Athletics. Target becomes Engaged and suffers -1 die until they break free.',
        skillKey: 'melee',
    },
    {
        id: 'aim',
        label: 'Aim (Homebrew)',
        icon: '🎯',
        raw: false,
        requires: (sk) => (sk.ranged || 0) >= 1,
        effect: 'Spend the action to steady your shot: +1 die on your next Ranged attack this scene, but you can\'t move first. Confirm with your GM — this is a table convenience, not an official rule.',
        skillKey: 'ranged',
    },
];

// ============================================================
// STATE — per-scene use tracking for active/reactive talents
// ============================================================

// Map<characterId, Map<talentName, useCount>>
const sceneUseCounts = new Map();

function getUseCount(charId, talentName) {
    return sceneUseCounts.get(charId)?.get(talentName) || 0;
}

function markUsed(charId, talentName) {
    if (!sceneUseCounts.has(charId)) sceneUseCounts.set(charId, new Map());
    const m = sceneUseCounts.get(charId);
    m.set(talentName, (m.get(talentName) || 0) + 1);
}

/** Call this from the "Scene End" button so once-per-scene talents refresh. */
export function resetCombatScene() {
    sceneUseCounts.clear();
    showToast(i18nText("feature.vtt.combat-actions.combatActionsPerSceneTalentUsesReset", null, "⚔️ Combat Actions: per-scene talent uses reset."), 'info');
    renderCombatActions();
}

// ============================================================
// HELPERS
// ============================================================

function parseDiceBonus(text) {
    if (!text) return 0;
    const m = String(text).match(/\+\s*(\d+)\s*(?:d\b|die|dice)/i);
    return m ? parseInt(m[1], 10) : 0;
}

function isCombatTalent(t) {
    if (!t) return false;
    const cat = (t.category || '').toLowerCase();
    if (['combat', 'defense', 'movement', 'monk-unarmed', 'rogue-thief'].includes(cat)) return true;
    const text = `${t.effect || ''} ${t.description || ''}`.toLowerCase();
    return /melee|ranged|weapon|attack|defense|harm\b|damage/.test(text);
}

function getEquippedWeaponMod(char, rangeKey) {
    const weaponMod = WEAPON_CLASS_MODS[char.weaponClass];
    if (!weaponMod || !rangeKey) return null;
    const bonus = weaponMod[rangeKey];
    if (bonus === undefined) return null;
    return { bonus, label: weaponMod.label };
}

function setRollerFields({ attrKey, effectiveSkill, boons }) {
    const attrInput = q('#vtt-attr');
    const skillInput = q('#vtt-skill');
    const boonsInput = q('#vtt-boons');
    const state = vttStore.getSelectedCharacter();
    if (attrInput) attrInput.value = state ? (state[attrKey] ?? 1) : 1;
    if (skillInput) skillInput.value = Math.max(0, effectiveSkill);
    if (boonsInput && boons !== undefined) boonsInput.value = boons;
}

function scrollToRoller() {
    const rollerPanel = q('#vtt-roll-output')?.closest('.vtt-panel, .vtt-card');
    if (rollerPanel) rollerPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function flashRollerNote(text) {
    const output = q('#vtt-roll-output');
    if (output) output.innerHTML = `<span style="color:var(--text2);">⚡ ${escHtml(text)}</span>`;
}

// ============================================================
// GM TRACKER BRIDGE (optional — narrative range sync)
// ============================================================

let combatModuleCache = null;
async function getCombatModule() {
    if (combatModuleCache) return combatModuleCache;
    try {
        combatModuleCache = await import('@features/encounters/combat.js');
        return combatModuleCache;
    } catch (e) {
        return null;
    }
}

async function getLiveTargets(selfName) {
    const combat = await getCombatModule();
    if (!combat || typeof combat.isTrackerOpen !== 'function') return [];
    try {
        const list = typeof combat.getLiveCombatants === 'function' ? combat.getLiveCombatants() : [];
        return list.filter(c => (c.name || '').toLowerCase() !== (selfName || '').toLowerCase());
    } catch (e) {
        return [];
    }
}

/**
 * Push the chosen range band to the GM's open Combat Tracker, if any.
 * No-ops silently if the Tracker isn't open or either name isn't in it —
 * this panel still works fine purely narratively either way.
 *
 * EXTENSION POINT: once the Whiteboard module can report live token
 * distance, have it call this same function (or combat.js's
 * setTrackerRangeByName directly) whenever two tokens' distance crosses
 * a band boundary, so token drags update this same range state.
 */
async function syncRangeToTracker(selfName, targetName, bandKey) {
    const combat = await getCombatModule();
    if (!combat || typeof combat.setTrackerRangeByName !== 'function') return false;
    try {
        return combat.setTrackerRangeByName(selfName, targetName, bandKey);
    } catch (e) {
        return false;
    }
}

// ============================================================
// LOCAL RANGE STATE (per-selected-character, purely UI-side)
// ============================================================

let currentTargetName = '';
let currentRangeKey = 'near';

// ============================================================
// RENDER
// ============================================================

let unsubscribe = null;

export function renderCombatActions() {
    const container = q('#vtt-combat-actions');
    if (!container) return;

    if (unsubscribe) unsubscribe();
    unsubscribe = vttStore.subscribe('selectedCharacterId', async (id) => {
        const char = id ? vttStore.getSelectedCharacter() : null;
        if (!char) {
            container.innerHTML = `<span style="color:var(--text3);font-size:0.9rem;">Select a character to see their combat options.</span>`;
            return;
        }
        await renderForCharacter(container, char);
    });
}

async function renderForCharacter(container, char) {
    const skills = char.skills || {};
    const talents = char.talents || [];
    const combatTalents = talents.filter(isCombatTalent);
    const passiveTalents = combatTalents.filter(t => (t.activation || 'passive') === 'passive');
    const activeTalents = combatTalents.filter(t => (t.activation || 'passive') !== 'passive');

    const targets = await getLiveTargets(char.name);
    if (!targets.some(t => t.name === currentTargetName)) {
        currentTargetName = targets[0]?.name || '';
    }

    // ---- Range / Target picker ----
    const targetOptions = targets.length
        ? targets.map(t => `<option value="${escHtml(t.name)}" ${t.name === currentTargetName ? 'selected' : ''}>${escHtml(t.name)}${t.position ? ` (${t.position})` : ''}</option>`).join('')
        : `<option value="" data-i18n="feature.vtt.combat-actions.noLiveTargetsOpenGMSCombat">No live targets (open GM's Combat Tracker to sync)</option>`;

    const rangeChips = RANGE_BANDS.map(b => `
        <button class="btn btn-xs combat-range-btn" data-range="${b.key}"
            style="background:${b.key === currentRangeKey ? b.color : 'var(--bg4)'};color:${b.key === currentRangeKey ? 'white' : 'var(--text2)'};border:none;">
            ${escHtml(b.label)}
        </button>
    `).join('');

    // ---- Attack buttons ----
    const attackButtons = ATTACK_SKILLS
        .filter(a => (skills[a.key] || 0) > 0)
        .map(a => {
            const rangeInfo = RANGE_BANDS.find(b => b.key === currentRangeKey);
            const weaponMod = (a.key === 'melee' || a.key === 'ranged')
                ? getEquippedWeaponMod(char, rangeInfo?.weaponKey)
                : null;
            const modNote = weaponMod ? ` (${weaponMod.bonus >= 0 ? '+' : ''}${weaponMod.bonus}d ${weaponMod.label})` : '';
            return `
                <button class="btn btn-sm btn-primary combat-attack-btn" data-skill="${a.key}"
                    style="font-size:0.85rem;">
                    ${a.icon} ${escHtml(a.label)} Attack (${skills[a.key]})${modNote}
                </button>
            `;
        }).join('');

    // ---- Maneuver buttons ----
    const maneuverButtons = MANEUVERS
        .filter(m => m.requires(skills))
        .map(m => `
            <button class="btn btn-sm btn-secondary combat-maneuver-btn" data-maneuver="${m.id}"
                title="${escHtml(m.effect)}" style="font-size:0.8rem;">
                ${m.icon} ${escHtml(m.label)}${m.raw ? '' : ' 🛠️'}
            </button>
        `).join('');

    // ---- Passive talent chips ----
    const passiveChips = passiveTalents.map(t => `
        <span class="badge" title="${escHtml(t.effect || t.description || '')}"
            style="background:var(--bg4);color:var(--text2);font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:10px;border:1px solid var(--border);">
            🔄 ${escHtml(t.name)}
        </span>
    `).join(' ');

    // ---- Active/reactive talent buttons (with use tracking) ----
    const activeButtons = activeTalents.map(t => {
        const uses = getUseCount(char.id, t.name);
        const limit = t.useLimit || 'custom';
        const oncePerScene = limit === 'once-scene';
        const usedUp = oncePerScene && uses >= 1;
        return `
            <button class="btn btn-sm ${usedUp ? '' : 'btn-gold'} combat-talent-btn" data-talent="${escHtml(t.name)}"
                ${usedUp ? 'disabled' : ''} title="${escHtml(t.effect || t.description || '')}"
                style="font-size:0.8rem;${usedUp ? 'opacity:0.5;' : ''}">
                ⚡ ${escHtml(t.name)} ${oncePerScene ? (usedUp ? '(used)' : '(1/scene)') : ''}
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.6rem;">
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">
                    📏 Range to target
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="combat-target-select" style="font-size:0.8rem;padding:0.15rem 0.4rem;">${targetOptions}</select>
                    ${rangeChips}
                </div>
            </div>

            ${attackButtons ? `
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">⚔️ Attacks</div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${attackButtons}</div>
            </div>` : `<div style="color:var(--text3);font-size:0.8rem;">No combat skills purchased yet.</div>`}

            ${maneuverButtons ? `
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">🎯 Maneuvers</div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${maneuverButtons}</div>
            </div>` : ''}

            ${activeButtons ? `
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">✨ Talents (active)</div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${activeButtons}</div>
            </div>` : ''}

            ${passiveChips ? `
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">🔄 Talents (passive — always on)</div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${passiveChips}</div>
            </div>` : ''}
        </div>
    `;

    attachActionEvents(container, char);
}

// ============================================================
// EVENTS
// ============================================================

function attachActionEvents(container, char) {
    const skills = char.skills || {};
    const combatTalents = (char.talents || []).filter(isCombatTalent);
    const passiveBonusTotal = combatTalents
        .filter(t => (t.activation || 'passive') === 'passive')
        .reduce((sum, t) => sum + parseDiceBonus(t.effect || t.description), 0);

    container.querySelector('#combat-target-select')?.addEventListener('change', (e) => {
        currentTargetName = e.target.value;
    });

    container.querySelectorAll('.combat-range-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            currentRangeKey = btn.dataset.range;
            if (currentTargetName) {
                const synced = await syncRangeToTracker(char.name, currentTargetName, currentRangeKey);
                showToast(
                    synced
                        ? `📏 Range to ${currentTargetName} set to ${currentRangeKey} (synced to GM Tracker).`
                        : `📏 Range to ${currentTargetName} set to ${currentRangeKey} (narrative only — GM Tracker not open/linked).`,
                    'info'
                );
            }
            await renderForCharacter(container, char);
        });
    });

    container.querySelectorAll('.combat-attack-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const skillKey = btn.dataset.skill;
            const attrKey = SKILL_ATTR_MAP[skillKey] || 'body';
            const rangeInfo = RANGE_BANDS.find(b => b.key === currentRangeKey);
            const weaponMod = (skillKey === 'melee' || skillKey === 'ranged')
                ? getEquippedWeaponMod(char, rangeInfo?.weaponKey)
                : null;
            const effectiveSkill = (skills[skillKey] || 0) + (weaponMod?.bonus || 0) + passiveBonusTotal;
            setRollerFields({ attrKey, effectiveSkill, boons: char.boons ?? 0 });
            flashRollerNote(`${skillKey} attack prepared (${attrKey} ${char[attrKey] ?? 1} + skill ${effectiveSkill}${currentTargetName ? ` vs ${currentTargetName}` : ''})`);
            scrollToRoller();
        });
    });

    container.querySelectorAll('.combat-maneuver-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const maneuver = MANEUVERS.find(m => m.id === btn.dataset.maneuver);
            if (!maneuver) return;
            const attrKey = SKILL_ATTR_MAP[maneuver.skillKey] || 'body';
            const effectiveSkill = (skills[maneuver.skillKey] || 0) + passiveBonusTotal;
            setRollerFields({ attrKey, effectiveSkill, boons: char.boons ?? 0 });
            flashRollerNote(`${maneuver.label} prepared — ${maneuver.effect}`);
            scrollToRoller();

            // 👇 NEW: maneuvers that worsen Position (e.g. Sidestep Strike)
            // push that change to the GM's Combat Tracker, if it's open.
            if (maneuver.worsensPosition) {
                const combat = await getCombatModule();
                const newPos = combat?.worsenTrackerPositionByName?.(char.name);
                if (newPos) {
                    showToast(i18nText("feature.vtt.combat-actions.valueSPositionWorsenedToValueSynced", { value0: char.name, value1: newPos }, "🧭 {{value0}}'s Position worsened to {{value1}} (synced to GM Tracker)."), 'warning');
                    renderForCharacter(container, char);
                }
            }
        });
    });

    container.querySelectorAll('.combat-talent-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.talent;
            const talent = combatTalents.find(t => t.name === name);
            if (!talent) return;
            const limit = talent.useLimit || 'custom';
            if (limit === 'once-scene' && getUseCount(char.id, name) >= 1) {
                showToast(i18nText("feature.vtt.combat-actions.valueHasAlreadyBeenUsedThisScene", { value0: name }, "{{value0}} has already been used this scene."), 'warning');
                return;
            }
            markUsed(char.id, name);
            const bonus = parseDiceBonus(talent.effect || talent.description);
            if (bonus > 0) {
                // Apply on top of whatever's currently in the roller, so it can
                // stack with an attack just prepared.
                const skillInput = q('#vtt-skill');
                if (skillInput) skillInput.value = (parseInt(skillInput.value, 10) || 0) + bonus;
            }
            showToast(i18nText("feature.vtt.combat-actions.valueValue", { value0: name, value1: talent.effect || talent.description || i18nText('common.activated', null, 'Activated.') }, "⚡ {{value0}}: {{value1}}"), 'success');
            renderForCharacter(container, char);
        });
    });
}

export default { renderCombatActions, resetCombatScene };
