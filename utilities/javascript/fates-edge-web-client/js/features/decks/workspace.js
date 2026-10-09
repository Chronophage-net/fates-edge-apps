import { escHtml } from '../../core/utils.js';

export function renderDeckWorkspace(regions, accessible, seed = null) {
    return `<div class="deck-workspace">
        <header class="deck-workspace-header"><p class="deck-eyebrow">FATE’S EDGE / THE NEXT COMPLICATION</p><h1>Deck of Consequences</h1><p>Set the scene. Draw the pressure. Decide what changes at the table.</p></header>
        <div class="deck-workspace-layout"><section class="deck-draw-column" aria-label="Draw table">
            <div class="panel deck-setup"><h2>Prepare a reading</h2><div class="deck-setup-fields">
                <label for="deck-region-select">Region<select id="deck-region-select"><option value="">Choose a region</option>${regions.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('')}</select></label>
                ${accessible ? `<label for="deck-draw-type">Reading<select id="deck-draw-type"><option value="1">1 SB · one consequence</option><option value="2" selected>2 SB · consequence + twist</option><option value="3">3 SB · chain of consequences</option><option value="crown">Crown Spread · four positions + twist</option></select></label>` : ''}
            </div><p id="spread-description">Choose a reading for your scene.</p>
            ${accessible ? `<div class="deck-draw-actions"><button class="btn btn-gold" id="deck-draw-btn">Draw cards</button><span id="deck-cards-remaining" role="status"></span><button class="btn btn-sm" id="deck-reshuffle-btn">Reshuffle deck</button></div><p class="deck-help">SB costs are a table reference; drawing does not automatically spend Story Beats. Reshuffling keeps your journal.</p>` : `<p class="deck-help">Only the GM can draw or reshuffle in a connected session. You can browse regional references and your saved journal.</p>`}
            </div>
            ${accessible ? `<section class="panel deck-reading" id="consequence-display" aria-label="Current reading"><h2 id="consequence-title">Your next consequence</h2><p id="deck-reading-context" class="deck-help"></p><div id="crown-spread-cards" style="display:none;"></div><div class="card-grid" id="drawn-cards"></div><div id="consequence-synthesis" class="consequence-synthesis" aria-live="polite">Draw to reveal a complication rooted in the selected region.</div><div id="crown-spread-details" style="display:none;"></div><div id="timer-result" style="display:none;"></div></section>` : ''}
        </section><aside class="deck-reference-column" aria-label="Regional reference"><section class="panel"><p class="deck-eyebrow">Where this reading belongs</p><div id="region-header"></div><details class="deck-region-lore"><summary>Regional lore &amp; guidance</summary><div id="region-description">Choose a region to explore its lore.</div></details></section>
            <section class="panel deck-suit-key"><h3>Read the suits</h3><dl><dt>♥ Hearts</dt><dd>People &amp; relationships</dd><dt>♠ Spades</dt><dd>Places &amp; paths</dd><dt>♣ Clubs</dt><dd>Pressure &amp; complications</dd><dt>♦ Diamonds</dt><dd>Rewards &amp; opportunities</dd></dl><p class="deck-help">Crown Spread draws one card from each suit, then a twist. Regional meanings guide the interpretation.</p></section>
            <details class="panel deck-tools"><summary>Deck tools</summary><p>${seed ? 'Seeded randomness for this session.' : 'Cryptographic randomness.'}</p>${seed ? `<code>${escHtml(String(seed).slice(0,16))}…</code>` : ''}<p class="deck-help">Deck order lasts for this browser session. The reading journal survives reloads. Changing randomness starts a fresh deck.</p>${accessible ? '<button class="btn btn-sm" id="deck-seed-regenerate">New seeded deck</button><button class="btn btn-sm" id="deck-seed-clear">Use random deck</button>' : ''}<button class="btn btn-sm" id="deck-refresh-regions">Reload region list</button><span id="deck-region-count">${regions.length} regions</span></details>
        </aside></div>
        <section class="panel deck-journal"><header><div><p class="deck-eyebrow">At the table</p><h2>Reading journal</h2></div>${accessible ? '<button class="btn btn-sm" id="deck-history-clear-btn">Clear journal</button>' : ''}</header><label for="deck-history-search">Search saved readings<input type="search" id="deck-history-search" placeholder="Region, card, or consequence…"></label><div id="deck-history"></div></section>
    </div>`;
}

export function renderJournal(history, query = '') {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const entries = history.filter(e => e && words.every(word => [e.region,e.cards,e.synthesis,e.type].join(' ').toLowerCase().includes(word))).slice().reverse();
    if (!entries.length) return `<p class="deck-help">${query ? 'No matching readings. Try another word or clear the search.' : 'No readings yet. Draw here or from GM Tools to begin your journal.'}</p>`;
    return entries.map(e => `<details class="deck-journal-entry"><summary><span>${escHtml(e.type || 'Reading')}</span><span>${escHtml(e.region || 'Earlier session')}</span><time>${escHtml(e.time || '')}</time><strong>${escHtml(e.cards || '')}</strong></summary><p>${escHtml(e.synthesis || '')}</p>${e.aceEffect ? `<p class="deck-journal-ace">${escHtml(e.aceEffect)}</p>` : ''}</details>`).join('');
}
