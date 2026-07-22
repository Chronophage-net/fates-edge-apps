/**
 * Characters feature module
 * Manages character creation, editing, and talent catalogue
 * UPDATED: Now follows Fate's Edge Player's Guide rules
 * - Talent catalog organized by tier (Minor/Major/Prestige/Epic)
 * - Character cards display game-relevant stats (tier, harm, fatigue, boons, obligation)
 * - Party composition overview based on guide's five roles
 * - Talent fields include tier, prerequisites, activation type
 * - Starting XP guidance (32 base, max 36 with bonds/complications)
 * - Talent filtering by category
 */

import { generateId, escHtml, safeParseInt, clamp } from '../../core/utils.js';
import { getCharacter, 
	addCharacter, 
	updateCharacter,
	deleteCharacter, 
	getState, 
	saveState } from '../../core/state.js'
import { createCharacterCard } from '../../components/CharacterCard.js';
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

const TALENT_TIERS = [
    { id: 'minor', label: 'Minor', xpRange: '2–3 XP', min: 2, max: 3, color: 'var(--green)' },
    { id: 'major', label: 'Major', xpRange: '4–6 XP', min: 4, max: 6, color: 'var(--gold)' },
    { id: 'prestige', label: 'Prestige', xpRange: '7–10 XP', min: 7, max: 10, color: 'var(--purple)' },
    { id: 'epic', label: 'Epic', xpRange: '11+ XP', min: 11, max: 999, color: 'var(--red)' }
];

const ACTIVATION_TYPES = [
    { id: 'passive', label: 'Passive', note: 'Always on; no action required' },
    { id: 'active', label: 'Active', note: 'Requires an action or scene focus to use' },
    { id: 'reactive', label: 'Reactive', note: 'Triggers automatically on a condition' }
];

const PARTY_ROLES = [
    { id: 'tank', label: 'Tank', attr: 'Body', icon: '🛡️', desc: 'Stand in front, absorb damage, protect allies' },
    { id: 'striker', label: 'Striker', attr: 'Body or Wits', icon: '⚔️', desc: 'Deal damage, eliminate threats, break lines' },
    { id: 'controller', label: 'Controller', attr: 'Spirit or Presence', icon: '🌀', desc: 'Shape the battlefield, impose conditions, manage fear' },
    { id: 'support', label: 'Support', attr: 'Spirit', icon: '💚', desc: 'Heal, remove conditions, transfer burdens' },
    { id: 'utility', label: 'Utility', attr: 'Wits or Spirit', icon: '🔍', desc: 'Gather information, solve puzzles, negotiate with spirits' }
];

const TIER_INFO = [
    { min: 0, max: 40, tier: 'I', name: 'Novice', color: '#8bc34a' },
    { min: 41, max: 90, tier: 'II', name: 'Seasoned', color: '#4caf50' },
    { min: 91, max: 150, tier: 'III', name: 'Veteran', color: '#ff9800' },
    { min: 151, max: 220, tier: 'IV', name: 'Paragon', color: '#e91e63' },
    { min: 221, max: Infinity, tier: 'V', name: 'Mythic', color: '#9c27b0' }
];

const MAGIC_PATHS = {
    'none': { label: 'None', icon: '' },
    'free-caster': { label: 'Free Caster', icon: '🔥' },
    'runekeeper': { label: 'Runekeeper', icon: '📖' },
    'invoker': { label: 'Invoker', icon: ' sigil' },
    'cantor': { label: 'Cantor', icon: '🎵' },
    'summoner': { label: 'Summoner', icon: '👁️' },
    'witch': { label: 'Witch', icon: '🌿' },
    'familiar-only': { label: 'Familiar Only', icon: '🦅' },
    'hedge-gifts': { label: 'Hedge Gifts', icon: '🍃' }
};

let container = null;
let talentPanelVisible = true;
let activeTalentFilter = 'all';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getTierFromXp(xp) {
    for (const t of TIER_INFO) {
        if (xp >= t.min && xp <= t.max) return t;
    }
    return TIER_INFO[TIER_INFO.length - 1];
}

function getTalentTier(cost) {
    const xp = safeParseInt(cost, 0);
    for (const t of TALENT_TIERS) {
        if (xp >= t.min && xp <= t.max) return t;
    }
    return TALENT_TIERS[0];
}

function determineRole(char) {
    const body = char.body || 1;
    const wits = char.wits || 1;
    const spirit = char.spirit || 1;
    const presence = char.presence || 1;
    const skills = char.skills || {};
    
    const maxAttr = Math.max(body, wits, spirit, presence);
    
    // Check for support indicators
    if ((spirit >= 3 || wits >= 3) && (skills.medicine || 0) >= 2) return 'support';
    
    // Check for controller indicators
    if ((spirit >= 3 || presence >= 3) && ((skills.sway || 0) >= 2 || (skills.deception || 0) >= 1)) return 'controller';
    
    // Check for utility indicators
    if ((wits >= 3 || spirit >= 3) && ((skills.lore || 0) >= 2 || (skills.investigation || 0) >= 1)) return 'utility';
    
    // Check for tank (high body + melee + endurance)
    if (body >= 3 && (skills.melee || 0) >= 2 && (skills.endurance || 0) >= 1) return 'tank';
    
    // Check for striker (high body or wits + combat skills)
    if ((body >= 3 || wits >= 3) && ((skills.melee || 0) >= 2 || (skills.ranged || 0) >= 2)) return 'striker';
    
    // Fallback: highest attribute
    if (maxAttr === body) return 'tank';
    if (maxAttr === wits) return 'utility';
    if (maxAttr === spirit) return 'support';
    if (maxAttr === presence) return 'controller';
    
    return 'utility';
}

function calculateXpSpent(char) {
    let spent = 0;
    
    // Attributes: each step from base 1 costs new_rating × 3
    for (const attr of ['body', 'wits', 'spirit', 'presence']) {
        const rating = char[attr] || 1;
        for (let i = 2; i <= rating; i++) {
            spent += i * 3;
        }
    }
    
    // Skills: each step from base 0 costs new_level × 2
    if (char.skills) {
        for (const skill of ALL_SKILLS) {
            const level = char.skills[skill.toLowerCase()] || 0;
            for (let i = 1; i <= level; i++) {
                spent += i * 2;
            }
        }
    }
    
    // Talents
    if (char.talents) {
        char.talents.forEach(t => {
            spent += safeParseInt(t.cost, 0);
        });
    }
    
    // Assets
    if (char.assets) {
        char.assets.forEach(a => {
            spent += safeParseInt(a.cost, 0);
        });
    }
    
    // Equipment
    if (char.equipment) {
        char.equipment.forEach(e => {
            spent += safeParseInt(e.cost, 0);
        });
    }
    
    return spent;
}

function getObligationInfo(char) {
    const capacity = (char.spirit || 1) + (char.presence || 1);
    const current = char.obligation || 0;
    const overCapacity = current > capacity;
    const doubleCapacity = current > capacity * 2;
    
    return { capacity, current, overCapacity, doubleCapacity };
}

// ============================================================
// RENDER
// ============================================================

export function render(el) {
    container = el;
    container.innerHTML = `
        <div class="characters-header">
            <div class="flex-between" style="flex-wrap:wrap;gap:0.5rem;">
                <div>
                    <h1 class="page-title" style="margin:0;">👤 Characters</h1>
                    <p class="page-sub" style="margin:0.2rem 0 0;">Create and manage your party. Starting XP: 32 (max 36 with Bonds & Complications).</p>
                </div>
                <div class="flex" style="gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-gold" id="wizardCharBtn">+ New Character (Wizard)</button>
                    <button class="btn btn-sm" id="openEditorBtn">📝 Blank Editor</button>
                    <button class="btn btn-sm btn-primary" id="openTalentsBtn">🧙‍♂️ Talents</button>
                </div>
            </div>
        </div>
        
        <!-- Party Overview -->
        <div class="panel" id="party-overview-panel" style="margin-bottom:0.8rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">
                <h3 style="margin:0;">⚔️ Party Composition</h3>
                <span class="text-muted" style="font-size:0.8rem;" id="party-size"></span>
            </div>
            <div id="party-roles-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.4rem;"></div>
        </div>
        
        <!-- Character List -->
        <div class="panel" id="char-list-container">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">
                <h3 style="margin:0;">Your Characters</h3>
                <div style="display:flex;gap:0.3rem;font-size:0.8rem;align-items:center;">
                    <span id="char-count" class="text-muted"></span>
                    <span class="text-muted">|</span>
                    <span id="xp-summary" class="text-muted"></span>
                </div>
            </div>
            <div class="char-list" id="char-list"></div>
        </div>
        
        <!-- Talent Catalog -->
        <div class="panel" id="talent-panel" style="position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <h3 style="margin:0;">🧠 Talent Catalog</h3>
                    <span class="text-muted" style="font-size:0.7rem;" id="talent-count"></span>
                </div>
                <div style="display:flex;gap:0.3rem;">
                    <button class="btn btn-sm btn-ghost" id="talent-toggle-btn" title="Toggle talent list visibility">−</button>
                    <button class="btn btn-sm btn-ghost" id="talent-add-btn" title="Add custom talent">+ Talent</button>
                </div>
            </div>
            
            <!-- Talent Tier Filter -->
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.5rem;" id="talent-filters">
                <button class="btn btn-xs btn-gold talent-filter-btn active" data-filter="all">All</button>
                ${TALENT_TIERS.map(t => 
                    `<button class="btn btn-xs talent-filter-btn" data-filter="${t.id}" style="border-color:${t.color};">${t.label} (${t.xpRange})</button>`
                ).join('')}
            </div>
            
            <!-- Talent Legend -->
            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.3rem;">
                Minor (2–3 XP): Small situational bonus | Major (4–6 XP): Strong upgrade | Prestige (7–10 XP): Campaign-defining | Epic (11+ XP): Legendary ability
            </div>
            
            <div id="talent-list-container" style="max-height:300px;overflow-y:auto;margin-top:0.5rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg2);padding:0.3rem;"></div>
        </div>
    `;
    
    renderCharList();
    renderPartyOverview();
    renderTalentList();
    attachEvents();
}

// ============================================================
// PARTY OVERVIEW
// ============================================================

function renderPartyOverview() {
    const state = getState();
    const characters = state.characters || [];
    
    const sizeEl = document.getElementById('party-size');
    if (sizeEl) {
        sizeEl.textContent = `${characters.length} member${characters.length !== 1 ? 's' : ''}`;
    }
    
    const grid = document.getElementById('party-roles-grid');
    if (!grid) return;
    
    if (characters.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:0.5rem;color:var(--text3);font-size:0.85rem;">No characters in party yet.</div>`;
        return;
    }
    
    // Determine each character's role
    const roleAssignments = characters.map(c => ({
        char: c,
        role: determineRole(c)
    }));
    
    grid.innerHTML = PARTY_ROLES.map(role => {
        const members = roleAssignments.filter(r => r.role === role.id);
        const isFilled = members.length > 0;
        
        return `
            <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:${isFilled ? 'rgba(50,255,50,0.05)' : 'rgba(255,50,50,0.03)'};border:1px solid ${isFilled ? 'var(--green)' : 'var(--border)'};font-size:0.8rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1rem;">${role.icon}</span>
                    <strong>${role.label}</strong>
                    <span style="margin-left:auto;color:var(--text3);font-size:0.7rem;">${role.attr}</span>
                </div>
                <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">${role.desc}</div>
                ${isFilled 
                    ? `<div style="margin-top:0.2rem;font-size:0.75rem;color:var(--green);">${members.map(m => escHtml(m.char.name || 'Unnamed')).join(', ')}</div>`
                    : `<div style="margin-top:0.2rem;font-size:0.7rem;color:var(--red);">⚠ No coverage — consider a Follower</div>`
                }
            </div>
        `;
    }).join('');
}

// ============================================================
// CHARACTER LIST
// ============================================================

export function renderCharList() {
    const list = document.getElementById('char-list');
    if (!list) return;
    
    const state = getState();
    const characters = state.characters || [];
    
    // Update count
    const countEl = document.getElementById('char-count');
    if (countEl) {
        countEl.textContent = `${characters.length} character${characters.length !== 1 ? 's' : ''}`;
    }
    
    // XP summary
    const xpEl = document.getElementById('xp-summary');
    if (xpEl) {
        if (characters.length > 0) {
            const xpValues = characters.map(c => c.totalXp || 32);
            const totalXp = xpValues.reduce((a, b) => a + b, 0);
            const avgXp = Math.round(totalXp / characters.length);
            xpEl.textContent = `Avg XP: ${avgXp}`;
        } else {
            xpEl.textContent = '';
        }
    }
    
    if (characters.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="text-align:center;padding:2rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">👤</div>
                <div>No characters yet.</div>
                <div style="font-size:0.8rem;margin-top:0.3rem;">
                    Click "New Character (Wizard)" for guided creation, or "Blank Editor" for the full editor.<br>
                    Starting XP: 32 (max 36 with up to 2 Bonds and 2 Complications).
                </div>
            </div>
        `;
        renderPartyOverview();
        return;
    }
    
    list.innerHTML = characters.map(char => {
        const card = createCharacterCard(char, {
            onEdit: () => {},
            onDelete: () => {},
            onToggleVTT: () => {},
            onRoll: () => {}
        });
        const wrapper = document.createElement('div');
        wrapper.dataset.charId = char.id;
        wrapper.appendChild(card);
        return wrapper.outerHTML;
    }).join('');
    
    // Add character summary stats below each card
    characters.forEach(char => {
        const cardWrapper = list.querySelector(`[data-char-id="${char.id}"]`);
        if (cardWrapper) {
            const summary = createCharacterSummary(char);
            if (summary) {
                cardWrapper.appendChild(summary);
            }
        }
    });
    
    // Setup event delegation
    list.addEventListener('click', handleCharacterAction);
    
    renderPartyOverview();
}

function createCharacterSummary(char) {
    const tier = getTierFromXp(char.totalXp || 32);
    const harm = char.harm || 0;
    const fatigue = char.fatigue || 0;
    const fatigueMax = char.body || 1;
    const boons = char.boons || 0;
    const obligInfo = getObligationInfo(char);
    const magicPath = MAGIC_PATHS[char.magicPath || 'none'] || MAGIC_PATHS['none'];
    const xpSpent = calculateXpSpent(char);
    const xpTotal = char.totalXp || 32;
    
    // Status indicators
    const harmColor = harm === 0 ? 'var(--green)' : harm === 1 ? 'var(--gold)' : harm === 2 ? 'var(--orange)' : 'var(--red)';
    const fatiguePct = Math.min(100, (fatigue / fatigueMax) * 100);
    const obligColor = obligInfo.doubleCapacity ? 'var(--red)' : obligInfo.overCapacity ? 'var(--orange)' : 'var(--text2)';
    
    const div = document.createElement('div');
    div.className = 'char-summary';
    div.style.cssText = 'padding:0.4rem 0.6rem;font-size:0.75rem;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;background:var(--bg1);';
    
    div.innerHTML = `
        <!-- Tier badge -->
        <span style="background:${tier.color};color:#000;padding:0.1rem 0.4rem;border-radius:3px;font-weight:600;font-size:0.7rem;" title="Tier based on ${xpTotal} XP">
            T${tier.tier} ${tier.name}
        </span>
        
        <!-- XP -->
        <span style="color:var(--text3);" title="Total XP / XP spent">
            ${xpTotal} XP ${xpSpent !== xpTotal ? `(${xpSpent} spent)` : ''}
        </span>
        
        <!-- Attributes -->
        <span style="color:var(--text2);" title="Body / Wits / Spirit / Presence">
            <strong>B</strong>${char.body || 1} <strong>W</strong>${char.wits || 1} <strong>S</strong>${char.spirit || 1} <strong>P</strong>${char.presence || 1}
        </span>
        
        <!-- Magic path -->
        ${magicPath.icon ? `<span title="${magicPath.label}">${magicPath.icon} ${magicPath.label}</span>` : ''}
        
        <!-- Patron -->
        ${char.patron ? `<span style="color:var(--text3);" title="Patron">🔮 ${escHtml(char.patron)}</span>` : ''}
        
        <!-- Harm -->
        <span style="color:${harmColor};font-weight:${harm > 0 ? '600' : '400'};" title="Harm level (0-3)">
            ${harm === 0 ? '✓' : '💔'} Harm ${harm}/3
        </span>
        
        <!-- Fatigue -->
        <span style="color:${fatigue >= fatigueMax ? 'var(--red)' : fatigue > 0 ? 'var(--orange)' : 'var(--text2)'};" title="Fatigue (max = Body = ${fatigueMax}). Full → Harm+1, clear">
            😓 ${fatigue}/${fatigueMax}
        </span>
        
        <!-- Boons -->
        ${boons > 0 ? `<span style="color:var(--gold);" title="Boons (max 5). Spend: re-roll, Position, Asset, 2→1 XP">⭐ ${boons}/5</span>` : ''}
        
        <!-- Obligation -->
        ${obligInfo.current > 0 ? `<span style="color:${obligColor};" title="Obligation (capacity = Spirit + Presence). Over cap: 1 Fatigue/segment. Double: Patron intrusion">⛓️ ${obligInfo.current}/${obligInfo.capacity}</span>` : ''}
        
        <!-- Corruption (Cantors) -->
        ${char.magicPath === 'cantor' && (char.corruption || 0) > 0 ? `<span style="color:var(--purple);" title="Corruption timer (size = Spirit). Fill: bloom, reset to Tier">🎵 ${(char.corruption || 0)}/${char.corruptionMax || char.spirit || 1}</span>` : ''}
        
        <!-- Leash (Summoners) -->
        ${char.magicPath === 'summoner' && (char.leash || 0) > 0 ? `<span style="color:var(--red);" title="Leash (cap = Cap + Spirit). Fill: spirit acts & departs">👁️ ${char.leash || 0}</span>` : ''}
        
        <!-- VTT -->
        ${char.vtt ? `<span style="color:var(--green);" title="Pushed to VTT">📡</span>` : ''}
    `;
    
    return div;
}

function handleCharacterAction(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    
    const card = target.closest('[data-char-id]');
    if (!card) return;
    
    const id = card.dataset.charId;
    const action = target.dataset.action;
    
    switch (action) {
        case 'edit':
            openCharacterEditor(id);
            break;
        case 'delete':
            deleteCharacterHandler(id);
            break;
        case 'vtt':
            togglePushToVTT(id);
            break;
        case 'roll':
            rollForCharacter(id);
            break;
    }
}

// ============================================================
// TALENT LIST
// ============================================================

export function renderTalentList() {
    const container = document.getElementById('talent-list-container');
    if (!container) return;
    
    const state = getState();
    const localTalents = state.talents || [];
    const wikiEntries = state.wikiEntries || [];
    const remoteTalents = wikiEntries.filter(e => 
        e.category === 'talents' || e.category === 'talent'
    );
    
    // Count by tier
    const allTalents = [
        ...localTalents.map(t => ({ ...t, isLocal: true })),
        ...remoteTalents.map(t => ({ ...t, name: t.title, description: t.body || t.description, isLocal: false }))
    ];
    
    const tierCounts = {};
    TALENT_TIERS.forEach(t => { tierCounts[t.id] = 0; });
    allTalents.forEach(t => {
        const tier = getTalentTier(t.cost);
        if (tierCounts[tier.id] !== undefined) tierCounts[tier.id]++;
    });
    
    const total = localTalents.length + remoteTalents.length;
    const countEl = document.getElementById('talent-count');
    if (countEl) {
        const tierBreakdown = TALENT_TIERS.map(t => 
            `${t.label}: ${tierCounts[t.id]}`
        ).join(' | ');
        countEl.textContent = `(${total} total — ${tierBreakdown})`;
    }
    
    if (total === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:0.5rem;color:var(--text3);font-size:0.85rem;">
                No talents defined. Clone from wiki or add custom.<br>
                <span style="font-size:0.75rem;">Talent tiers: Minor (2–3 XP), Major (4–6 XP), Prestige (7–10 XP), Epic (11+ XP)</span>
            </div>
        `;
        return;
    }
    
    // Filter talents
    let filteredLocal = localTalents;
    let filteredRemote = remoteTalents;
    
    if (activeTalentFilter !== 'all') {
        const tier = TALENT_TIERS.find(t => t.id === activeTalentFilter);
        if (tier) {
            filteredLocal = localTalents.filter(t => {
                const cost = safeParseInt(t.cost, 0);
                return cost >= tier.min && cost <= tier.max;
            });
            filteredRemote = remoteTalents.filter(t => {
                const cost = safeParseInt(t.cost, 0);
                return cost >= tier.min && cost <= tier.max;
            });
        }
    }
    
    let html = '';
    
    if (filteredLocal.length === 0 && filteredRemote.length === 0) {
        html = `<div style="text-align:center;padding:0.5rem;color:var(--text3);font-size:0.85rem;">No talents in this tier.</div>`;
        container.innerHTML = html;
        return;
    }
    
    // Local talents grouped by tier
    if (filteredLocal.length > 0) {
        // Sort by cost (ascending)
        const sorted = [...filteredLocal].sort((a, b) => safeParseInt(a.cost, 0) - safeParseInt(b.cost, 0));
        
        // Group by tier
        let currentTier = null;
        sorted.forEach(t => {
            const tier = getTalentTier(t.cost);
            if (tier.id !== currentTier) {
                currentTier = tier.id;
                html += `<div style="padding:0.2rem 0.4rem;color:${tier.color};font-size:0.7rem;font-weight:600;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);">${tier.label} (${tier.xpRange})</div>`;
            }
            
            const activation = t.activation || 'passive';
            const activationInfo = ACTIVATION_TYPES.find(a => a.id === activation);
            const prereqText = t.prerequisites ? ` | Req: ${escHtml(t.prerequisites)}` : '';
            
            html += `
                <div class="talent-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0.4rem;border-bottom:1px solid var(--border);font-size:0.8rem;gap:0.3rem;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex:1;min-width:0;">
                        <span style="font-weight:500;white-space:nowrap;">${escHtml(t.name)}</span>
                        <span style="color:${tier.color};font-weight:600;font-size:0.7rem;white-space:nowrap;">${t.cost || 0}XP</span>
                        ${activation !== 'passive' ? `<span style="font-size:0.65rem;padding:0.05rem 0.2rem;border-radius:2px;background:var(--bg3);color:var(--text3);" title="${activationInfo?.note || ''}">${activation}</span>` : ''}
                        ${t.description ? `<span style="color:var(--text2);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">— ${escHtml(t.description)}</span>` : ''}
                        <span style="color:var(--text3);font-size:0.65rem;white-space:nowrap;">${prereqText}</span>
                    </div>
                    <div style="display:flex;gap:0.2rem;flex-shrink:0;">
                        <button class="btn btn-xs btn-ghost talent-edit-btn" data-id="${t.id}" title="Edit">✏️</button>
                        <button class="btn btn-xs btn-ghost talent-delete-btn" data-id="${t.id}" title="Delete" style="color:var(--red);">✕</button>
                    </div>
                </div>
            `;
        });
    }
    
    // Wiki talents
    if (filteredRemote.length > 0) {
        if (filteredLocal.length > 0) {
            html += `<div style="padding:0.2rem 0.4rem;color:var(--text3);font-size:0.7rem;border-bottom:1px solid var(--border);">📚 From Wiki</div>`;
        }
        
        const sorted = [...filteredRemote].sort((a, b) => safeParseInt(a.cost, 0) - safeParseInt(b.cost, 0));
        
        let currentTier = null;
        sorted.forEach(t => {
            const tier = getTalentTier(t.cost);
            if (tier.id !== currentTier) {
                currentTier = tier.id;
                html += `<div style="padding:0.2rem 0.4rem;color:${tier.color};font-size:0.7rem;font-weight:600;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);">${tier.label} (${tier.xpRange})</div>`;
            }
            
            html += `
                <div class="talent-item wiki-talent" style="display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0.4rem;border-bottom:1px solid var(--border);font-size:0.8rem;gap:0.3rem;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex:1;min-width:0;">
                        <span style="font-weight:500;color:var(--text2);white-space:nowrap;">${escHtml(t.title)}</span>
                        ${t.cost != null ? `<span style="color:${tier.color};font-weight:600;font-size:0.7rem;white-space:nowrap;">${t.cost}XP</span>` : ''}
                        ${t.body ? `<span style="color:var(--text3);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">— ${escHtml(t.body)}</span>` : ''}
                    </div>
                    <button class="btn btn-xs btn-ghost talent-clone-btn" data-id="${escHtml(String(t.id))}" title="Clone to local" style="color:var(--green);">📋</button>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
    
    // Attach events
    container.querySelectorAll('.talent-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTalentEditor(btn.dataset.id);
        });
    });
    
    container.querySelectorAll('.talent-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTalentHandler(btn.dataset.id);
        });
    });
    
    container.querySelectorAll('.talent-clone-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            cloneTalentFromWiki(btn.dataset.id);
        });
    });
}

// ============================================================
// CHARACTER OPERATIONS
// ============================================================

function openCharacterEditor(id) {
    import('./editor.js').then(module => {
        if (module.openEditor) {
            module.openEditor(id);
        } else {
            showToast('Editor module not available.', 'error');
        }
    }).catch(() => {
        showToast('Failed to load editor.', 'error');
    });
}

function deleteCharacterHandler(id) {
    const char = getCharacter(id);
    if (!char) return;
    
    const tier = getTierFromXp(char.totalXp || 32);
    if (!confirm(`Delete "${char.name || 'character'}" (Tier ${tier.tier} ${tier.name})?`)) return;
    
    deleteCharacter(id);
    renderCharList();
    showToast(`"${char.name || 'Character'}" deleted.`, 'success');
}

function togglePushToVTT(id) {
    const char = getCharacter(id);
    if (!char) return;
    
    const newVtt = !char.vtt;
    const updated = updateCharacter(id, { vtt: newVtt });
    if (updated) {
        renderCharList();
        showToast(
            newVtt 
                ? `"${char.name || 'Character'}" pushed to VTT.` 
                : `"${char.name || 'Character'}" removed from VTT.`,
            'success'
        );
        const vttBtn = document.querySelector('.sidebar-nav button[data-tab="vtt"]');
        if (vttBtn) vttBtn.click();
    }
}

function rollForCharacter(id) {
    import('./roller.js').then(module => {
        if (module.rollForCharacter) {
            module.rollForCharacter(id);
        } else {
            showToast('Roller module not available.', 'error');
        }
    }).catch(() => {
        showToast('Failed to load roller.', 'error');
    });
}

// ============================================================
// TALENT OPERATIONS
// ============================================================

function openTalentEditor(id) {
    import('./talent-editor.js')
        .then(module => {
            if (module.openEditor) {
                module.openEditor(id);
            } else {
                createInlineTalentEditor(id);
            }
        })
        .catch(() => {
            createInlineTalentEditor(id);
        });
}

function createInlineTalentEditor(id) {
    const state = getState();
    const talents = state.talents || [];
    const talent = talents.find(t => String(t.id) === String(id));
    if (!talent) {
        showToast('Talent not found.', 'error');
        return;
    }
    
    const container = document.getElementById('talent-list-container');
    if (!container) return;
    
    const row = container.querySelector(`.talent-edit-btn[data-id="${id}"]`)?.closest('.talent-item');
    
    if (row) {
        const currentTier = getTalentTier(talent.cost);
        const tierOptions = TALENT_TIERS.map(t => 
            `<option value="${t.id}" ${currentTier.id === t.id ? 'selected' : ''}>${t.label} (${t.xpRange})</option>`
        ).join('');
        
        const activationOptions = ACTIVATION_TYPES.map(a => 
            `<option value="${a.id}" ${talent.activation === a.id ? 'selected' : ''}>${a.label}</option>`
        ).join('');
        
        row.innerHTML = `
            <div style="padding:0.3rem 0.4rem;width:100%;">
                <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.3rem;">
                    <input type="text" id="talent-edit-name" value="${escHtml(talent.name)}" style="flex:2;min-width:100px;font-size:0.8rem;" placeholder="Talent name" />
                    <input type="number" id="talent-edit-cost" value="${talent.cost || 0}" style="width:60px;font-size:0.8rem;" placeholder="XP" min="2" title="XP cost (Minor: 2-3, Major: 4-6, Prestige: 7-10, Epic: 11+)" />
                    <select id="talent-edit-tier" style="width:100px;font-size:0.75rem;" title="Talent tier">${tierOptions}</select>
                    <select id="talent-edit-activation" style="width:90px;font-size:0.75rem;" title="Activation type">${activationOptions}</select>
                </div>
                <input type="text" id="talent-edit-prereq" value="${escHtml(talent.prerequisites || '')}" style="width:100%;font-size:0.75rem;margin-bottom:0.3rem;" placeholder="Prerequisites (e.g., 'Melee 2+, Body 3+')" />
                <input type="text" id="talent-edit-desc" value="${escHtml(talent.description || '')}" style="width:100%;font-size:0.75rem;margin-bottom:0.3rem;" placeholder="Description" />
                <div style="display:flex;gap:0.3rem;">
                    <button class="btn btn-xs btn-gold talent-edit-save" data-id="${id}">💾 Save</button>
                    <button class="btn btn-xs talent-edit-cancel" data-id="${id}">✕ Cancel</button>
                </div>
            </div>
        `;
        
        // Auto-set cost when tier changes
        const tierSelect = row.querySelector('#talent-edit-tier');
        const costInput = row.querySelector('#talent-edit-cost');
        if (tierSelect && costInput) {
            tierSelect.addEventListener('change', () => {
                const tier = TALENT_TIERS.find(t => t.id === tierSelect.value);
                if (tier) {
                    const currentCost = safeParseInt(costInput.value, 0);
                    if (currentCost < tier.min || currentCost > tier.max) {
                        costInput.value = tier.min;
                    }
                }
            });
        }
        
        setTimeout(() => {
            const nameInput = document.getElementById('talent-edit-name');
            if (nameInput) nameInput.focus();
        }, 50);
        
        const saveBtn = row.querySelector('.talent-edit-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const nameEl = document.getElementById('talent-edit-name');
                const costEl = document.getElementById('talent-edit-cost');
                const descEl = document.getElementById('talent-edit-desc');
                const prereqEl = document.getElementById('talent-edit-prereq');
                const tierEl = document.getElementById('talent-edit-tier');
                const activationEl = document.getElementById('talent-edit-activation');
                
                if (!nameEl || !nameEl.value.trim()) {
                    showToast('Talent name is required.', 'error');
                    return;
                }
                
                const cost = safeParseInt(costEl?.value, 0);
                const tier = TALENT_TIERS.find(t => t.id === tierEl?.value);
                if (tier && (cost < tier.min || cost > tier.max)) {
                    const proceed = confirm(
                        `XP cost ${cost} doesn't match ${tier.label} tier (${tier.xpRange}).\n` +
                        `Save anyway? (GM may allow custom costs.)`
                    );
                    if (!proceed) return;
                }
                
                talent.name = nameEl.value.trim();
                talent.cost = cost;
                talent.description = descEl?.value.trim() || '';
                talent.prerequisites = prereqEl?.value.trim() || '';
                talent.tier = tierEl?.value || 'minor';
                talent.activation = activationEl?.value || 'passive';
                
                state.talents = talents;
                saveState();
                renderTalentList();
                showToast(`Talent "${talent.name}" updated.`, 'success');
            });
        }
        
        const cancelBtn = row.querySelector('.talent-edit-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                renderTalentList();
            });
        }
    }
}

function deleteTalentHandler(id) {
    const state = getState();
    const talents = state.talents || [];
    const talent = talents.find(t => String(t.id) === String(id));
    if (!talent) return;
    
    if (!confirm(`Delete talent "${talent.name}" (${talent.cost || 0} XP)?`)) return;
    
    state.talents = talents.filter(t => String(t.id) !== String(id));
    saveState();
    renderTalentList();
    showToast('Talent deleted.', 'success');
}

function cloneTalentFromWiki(remoteId) {
    const state = getState();
    const wikiEntries = state.wikiEntries || [];
    const remote = wikiEntries.find(w => 
        String(w.id) === String(remoteId) && 
        (w.category === 'talents' || w.category === 'talent')
    );
    
    if (!remote) {
        showToast('Wiki talent not found.', 'error');
        return;
    }
    
    if (!state.talents) state.talents = [];
    
    const existing = state.talents.find(t => 
        t.name === remote.title && t.source === 'wiki-clone'
    );
    if (existing) {
        showToast(`"${remote.title}" already cloned.`, 'warning');
        return;
    }
    
    const cost = safeParseInt(remote.cost, 0);
    const tier = getTalentTier(cost);
    
    const newTalent = {
        id: generateId('talent_'),
        name: remote.title,
        cost: cost,
        description: remote.body || remote.description || '',
        source: 'wiki-clone',
        clonedFrom: remote.id,
        tier: tier.id,
        activation: 'passive',
        createdAt: new Date().toISOString()
    };
    
    state.talents.push(newTalent);
    saveState();
    renderTalentList();
    showToast(`Cloned "${remote.title}" from wiki (${tier.label}, ${cost} XP).`, 'success');
}

function addCustomTalent() {
    const state = getState();
    if (!state.talents) state.talents = [];
    
    const newTalent = {
        id: generateId('talent_'),
        name: 'New Talent',
        cost: 2,
        description: '',
        prerequisites: '',
        source: 'custom',
        tier: 'minor',
        activation: 'passive',
        createdAt: new Date().toISOString()
    };
    
    state.talents.push(newTalent);
    saveState();
    renderTalentList();
    
    setTimeout(() => {
        openTalentEditor(newTalent.id);
    }, 100);
}

// ============================================================
// TALENT PANEL TOGGLE & FILTERING
// ============================================================

function toggleTalentPanel() {
    const container = document.getElementById('talent-list-container');
    const toggleBtn = document.getElementById('talent-toggle-btn');
    const filterRow = document.getElementById('talent-filters');
    const legend = container?.previousElementSibling;
    
    if (!container || !toggleBtn) return;
    
    talentPanelVisible = !talentPanelVisible;
    
    if (talentPanelVisible) {
        container.style.display = 'block';
        if (filterRow) filterRow.style.display = 'flex';
        if (legend) legend.style.display = 'block';
        toggleBtn.textContent = '−';
        toggleBtn.title = 'Collapse talent list';
    } else {
        container.style.display = 'none';
        if (filterRow) filterRow.style.display = 'none';
        if (legend) legend.style.display = 'none';
        toggleBtn.textContent = '+';
        toggleBtn.title = 'Expand talent list';
    }
}

function setTalentFilter(filter) {
    activeTalentFilter = filter;
    
    // Update active button
    document.querySelectorAll('.talent-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
        btn.classList.toggle('btn-gold', btn.dataset.filter === filter);
    });
    
    renderTalentList();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

export function attachEvents() {
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Wizard button
        if (target.id === 'wizardCharBtn' || target.closest('#wizardCharBtn')) {
            e.preventDefault();
            import('./wizard.js')
                .then(module => {
                    if (module.openWizard) {
                        module.openWizard();
                    } else if (module.default && module.default.openWizard) {
                        module.default.openWizard();
                    } else {
                        showToast('Wizard module has no openWizard export.', 'error');
                    }
                })
                .catch(err => {
                    showToast('Failed to load wizard: ' + (err.message || err), 'error');
                });
        }
        
        // Blank editor button
        if (target.id === 'openEditorBtn' || target.closest('#openEditorBtn')) {
            e.preventDefault();
            import('./editor.js').then(module => {
                if (module.openEditor) {
                    module.openEditor(null);
                } else {
                    showToast('Editor module not available.', 'error');
                }
            }).catch(() => {
                showToast('Failed to load editor.', 'error');
            });
        }
        
        // Talents button
        if (target.id === 'openTalentsBtn' || target.closest('#openTalentsBtn')) {
            const panel = document.getElementById('talent-panel');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (!talentPanelVisible) toggleTalentPanel();
            }
            e.preventDefault();
        }
        
        // Talent toggle
        if (target.id === 'talent-toggle-btn' || target.closest('#talent-toggle-btn')) {
            toggleTalentPanel();
            e.preventDefault();
        }
        
        // Add talent button
        if (target.id === 'talent-add-btn' || target.closest('#talent-add-btn')) {
            addCustomTalent();
            e.preventDefault();
        }
        
        // Talent filter buttons
        if (target.classList?.contains('talent-filter-btn') || target.closest('.talent-filter-btn')) {
            const btn = target.closest('.talent-filter-btn');
            if (btn) {
                setTalentFilter(btn.dataset.filter);
                e.preventDefault();
            }
        }
    });
    
    // Keyboard shortcut: Ctrl+Shift+T for talents
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'T') {
            e.preventDefault();
            const panel = document.getElementById('talent-panel');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (!talentPanelVisible) toggleTalentPanel();
            }
        }
    });
}

// ============================================================
// INITIALIZATION & DESTROY
// ============================================================

export function init(el) {
    return render(el);
}

export function destroy() {
    container = null;
}

// ============================================================
// EXPORTS
// ============================================================

export { renderPartyOverview };

export default {
    render,
    init,
    destroy,
    renderCharList,
    renderTalentList,
    renderPartyOverview,
    attachEvents
};
