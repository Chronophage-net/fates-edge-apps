/**
 * Trackers – Unified character tracks for all magical paths
 *
 * Displays:
 * - Core: Fatigue, Harm, XP
 * - Path-specific: Obligation, Corruption, Leash, Mental Strain, Shadow/Shame/Identity Strain
 * - Monk: Breath State, Breath Scars, Corruption Tier, Meditation Progress
 * - Witch: Promise Timers (condensed)
 * - Summoner: Bound Spirits count, Leash ticks
 * - Psion: Mental Strain, max
 *
 * "The ledger always balances. The question is what you're willing to pay."
 * – The Gray Wanderer
 */

import { getCharacterData } from '../index.js';
import { escHtml } from '../../../core/utils.js';

// ============================================================
// HELPER
// ============================================================

function safeString(val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return '';
}

// ============================================================
// MAIN RENDER
// ============================================================

export function renderTrackers(el) {
    const char = getCharacterData();
    if (!char) {
        el.innerHTML = `<p style="color:var(--text3);">Select a character to view tracks.</p>`;
        return;
    }

    const path = char.magicPath || 'none';
    const body = char.body || 1;
    const spirit = char.spirit || 1;
    const presence = char.presence || 1;
    const wits = char.wits || 1;

    // Core tracks – using correct limits per Player's Guide
    const fatigue = char.fatigue || 0;
    const fatigueMax = body; // Fatigue track = Body (not Body*3)
    const harm = char.harm || 0;
    const harmMax = 3;       // Harm is 0–3
    const totalXp = char.totalXp || 0;

    // Path-specific
    const obligation = char.obligation || 0;
    const obligationMax = (spirit + presence) || 1;
    const corruption = char.corruption || 0;
    const corruptionMax = char.corruptionMax || spirit;
    const leash = char.leash || 0;
    const leashMax = char.leashMax || 4;
    const mentalStrain = char.mentalStrain || 0;
    const mentalStrainMax = char.mentalStrainMax || spirit;

    // Witch prices – now top‑level fields (not nested under witch)
    const shadow = char.shadow ?? 0;
    const shame = char.shame ?? 0;
    const identityStrain = char.identityStrain ?? 0;
    const promiseTimers = char.promiseTimers?.length || 0;

    // Monk
    const breathState = char.breathState || 'entering';
    const breathScars = char.breathScars || [];
    const monkCorruptionTier = char.monkCorruptionTier || 0;
    const meditationProgress = char.meditationProgress || 0;

    // Summoner
    const boundSpirits = char.boundSpirits?.length || 0;

    let html = `
        <div class="trackers-grid" style="display:flex;flex-wrap:wrap;gap:0.4rem 0.8rem;padding:0.2rem 0;">
    `;

    // ─── Core: Fatigue ──────────────────────────────────────
    const fatiguePct = fatigueMax > 0 ? Math.min(100, (fatigue / fatigueMax) * 100) : 0;
    html += `
        <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                <span>💪 Fatigue</span>
                <span>${fatigue}/${fatigueMax}</span>
            </div>
            <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                <div style="width:${fatiguePct}%;height:100%;background:${fatiguePct > 80 ? 'var(--red)' : fatiguePct > 50 ? 'var(--orange)' : 'var(--green)'};border-radius:3px;"></div>
            </div>
        </div>
    `;

    // ─── Core: Harm ──────────────────────────────────────────
    const harmPct = (harm / harmMax) * 100;
    html += `
        <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                <span>🩸 Harm</span>
                <span>${harm}/${harmMax}</span>
            </div>
            <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                <div style="width:${harmPct}%;height:100%;background:${harmPct > 80 ? 'var(--red)' : harmPct > 50 ? 'var(--orange)' : 'var(--gold)'};border-radius:3px;"></div>
            </div>
        </div>
    `;

    // ─── Core: XP ────────────────────────────────────────────
    html += `
        <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                <span>⭐ XP</span>
                <span>${totalXp}</span>
            </div>
        </div>
    `;

    // ─── Path: Obligation (Runekeeper/Invoker) ─────────────
    if (path === 'runekeeper' || path === 'invoker') {
        const pct = obligationMax > 0 ? Math.min(100, (obligation / obligationMax) * 100) : 0;
        html += `
            <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>⛓️ Obligation</span>
                    <span>${obligation}/${obligationMax}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--orange)' : 'var(--gold)'};border-radius:3px;"></div>
                </div>
            </div>
        `;
    }

    // ─── Path: Corruption (Cantor) ──────────────────────────
    if (path === 'cantor') {
        const pct = corruptionMax > 0 ? Math.min(100, (corruption / corruptionMax) * 100) : 0;
        html += `
            <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🎵 Corruption</span>
                    <span>${corruption}/${corruptionMax}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--purple)' : 'var(--blue)'};border-radius:3px;"></div>
                </div>
            </div>
        `;
    }

    // ─── Path: Leash (Summoner) ─────────────────────────────
    if (path === 'summoner') {
        const pct = leashMax > 0 ? Math.min(100, (leash / leashMax) * 100) : 0;
        html += `
            <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>👁️ Leash</span>
                    <span>${leash}/${leashMax}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--red)' : 'var(--gold)'};border-radius:3px;"></div>
                </div>
                ${boundSpirits > 0 ? `<div style="font-size:0.6rem;color:var(--text3);">${boundSpirits} spirit${boundSpirits > 1 ? 's' : ''} bound</div>` : ''}
            </div>
        `;
    }

    // ─── Path: Mental Strain (Psion) ────────────────────────
    if (path === 'psion') {
        const pct = mentalStrainMax > 0 ? Math.min(100, (mentalStrain / mentalStrainMax) * 100) : 0;
        html += `
            <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🧠 Mental Strain</span>
                    <span>${mentalStrain}/${mentalStrainMax}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${pct > 80 ? 'var(--red)' : 'var(--blue)'};border-radius:3px;"></div>
                </div>
            </div>
        `;
    }

    // ─── Path: Witch Prices ──────────────────────────────────
    if (path === 'witch') {
        // Shadow
        const shadowPct = Math.min(100, shadow * 20);
        html += `
            <div class="tracker-item" style="flex:1;min-width:70px;max-width:120px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🌑 Shadow</span>
                    <span>${shadow}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${shadowPct}%;height:100%;background:var(--purple);border-radius:3px;"></div>
                </div>
            </div>
        `;
        // Shame
        const shamePct = Math.min(100, shame * 20);
        html += `
            <div class="tracker-item" style="flex:1;min-width:70px;max-width:120px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>😞 Shame</span>
                    <span>${shame}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${shamePct}%;height:100%;background:var(--red);border-radius:3px;"></div>
                </div>
            </div>
        `;
        // Identity Strain
        const idPct = Math.min(100, identityStrain * 20);
        html += `
            <div class="tracker-item" style="flex:1;min-width:70px;max-width:120px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🌀 Identity</span>
                    <span>${identityStrain}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${idPct}%;height:100%;background:${identityStrain >= 4 ? 'var(--red)' : 'var(--gold)'};border-radius:3px;"></div>
                </div>
                ${identityStrain >= 4 ? `<div style="font-size:0.55rem;color:var(--red);">⚠️ Threshold!</div>` : ''}
            </div>
        `;
        // Promise Timers
        if (promiseTimers > 0) {
            html += `
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                        <span>⏳ Promises</span>
                        <span>${promiseTimers}</span>
                    </div>
                </div>
            `;
        }
    }

    // ─── Monk: Breath State, Scars, Corruption ──────────────
    if (path === 'monk' || char.monasticTradition) {
        const breathLabels = {
            'entering': '🌬️ Entering',
            'holding': '🫁 Holding',
            'releasing': '💨 Releasing',
            'empty': '🌌 Empty'
        };
        const label = breathLabels[breathState] || breathState;
        html += `
            <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🫁 Breath</span>
                    <span>${label}</span>
                </div>
            </div>
        `;
        if (breathScars.length > 0) {
            html += `
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                        <span>⚡ Scars</span>
                        <span>${breathScars.length}</span>
                    </div>
                </div>
            `;
        }
        if (monkCorruptionTier > 0) {
            html += `
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                        <span>⚠️ Corruption</span>
                        <span>Tier ${monkCorruptionTier}</span>
                    </div>
                </div>
            `;
        }
        if (meditationProgress > 0) {
            html += `
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                        <span>🧘 Progress</span>
                        <span>${meditationProgress}</span>
                    </div>
                </div>
            `;
        }
    }

    html += `</div>`;
    el.innerHTML = html;
}

// ============================================================
// EXPORT
// ============================================================

export default { renderTrackers };