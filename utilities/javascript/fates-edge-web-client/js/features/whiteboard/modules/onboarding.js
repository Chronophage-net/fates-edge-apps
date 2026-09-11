// modules/onboarding.js
// A floating, interactive guide to the live whiteboard controls.

const SEEN_KEY = 'wb-onboarding-seen-v1';

const STEPS = [
    {
        icon: '🎨',
        title: 'Welcome to the Whiteboard',
        body: `A shared tactical canvas for maps, notes, and combat. Draw freehand or with shapes, drop in notes and images, and everything saves automatically — locally if you're offline, live to the table if you're connected.`
    },
    {
        icon: '🗂️',
        title: 'Layers & Sheets',
        body: `<b>Layers</b> organize drawings, notes, and tokens — lock a layer to protect it, hide it, or mark it GM-only so players never see it. <b>Sheets</b> (the tabs above the canvas) hold separate maps for separate scenes or floors.`
    },
    {
        icon: '⚔️',
        title: 'Grid Combat',
        body: `Turn on <b>Combat</b> to overlay a tactical grid (square, hex, or isometric) and place tokens. Drag tokens to move them — flanked tokens are highlighted automatically. Pull in your Encounter Tracker with <b>Import Tracker</b>, or try <b>Kon'reh</b> for the built-in board game.`
    },
    {
        icon: '🌫️',
        title: 'Fog of War & Lighting',
        body: `Click any fog tool — Reveal, Hide, Wall, or Light — and Fog of War turns on automatically. <b>Wall</b> draws a line-of-sight blocker that stops both token vision <i>and</i> light from passing through it. <b>Light</b> drops a light source; double-click one to edit its radius, intensity, and color. Areas your allies have explored stay dimly visible after they move on, unless you turn off "Remember explored."`
    },
    {
        icon: '👁️',
        title: 'Player View & Table Mode',
        body: `<b>Player View</b> previews the board exactly as your players see it — GM-only layers and unrevealed fog hidden. <b>Table Mode</b> maximizes the canvas for a shared screen or TV, with larger token labels.`
    },
    {
        icon: '👥',
        title: 'Roster',
        body: `Open the <b>Roster</b> panel and drag a character straight onto the board to drop a character token — no manual setup needed.`
    },
    {
        icon: '↶',
        title: "You're set",
        body: `<b>Ctrl+Z</b> / <b>Ctrl+Y</b> undo and redo most edits. Reopen this guide anytime with the <b>❓ Help</b> button in the toolbar.`
    }
];

let currentStep = 0;
let modalEl = null;
let previousFocus = null;
let highlighted = null;
let openedDetails = [];
const TARGETS = ['whiteboard-toolbar', 'whiteboard-sheet-tabs', 'whiteboard-grid-combat', 'whiteboard-fog-toggle', 'whiteboard-player-view', 'whiteboard-toggle-roster', 'whiteboard-help'];

function clearTarget() {
    highlighted?.classList.remove('whiteboard-tour-target');
    highlighted = null;
    openedDetails.forEach(el => { el.open = false; });
    openedDetails = [];
}

function hasSeenOnboarding() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
}
function markOnboardingSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* ignore — storage unavailable, not worth blocking on */ }
}

// Call once after the whiteboard mounts; shows the wizard only the first
// time this browser/profile has ever opened it.
export function maybeShowOnboarding() {
    if (!hasSeenOnboarding()) showOnboardingModal();
}

export function showOnboardingModal() {
    currentStep = 0;
    if (!modalEl) buildModal();

    previousFocus = document.activeElement;
    document.body.appendChild(modalEl);
    modalEl.style.display = 'block';
    renderStep();
    modalEl.querySelector('#whiteboard-onboarding-next').focus({ preventScroll: true });
}

export function hideOnboardingModal(markSeen = true) {
    if (modalEl) modalEl.style.display = 'none';
    clearTarget();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
    if (markSeen) markOnboardingSeen();
}

function buildModal() {
    modalEl = document.createElement('div');
    modalEl.id = 'whiteboard-onboarding-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-labelledby', 'whiteboard-onboarding-title');
    modalEl.style.cssText = `
        display:none; position:fixed; bottom:1rem; inset-inline-end:1rem; z-index:12000; width:min(480px, calc(100vw - 2rem)); max-height:50dvh; overflow:auto; background:var(--bg2); color:var(--text); border:1px solid var(--gold); border-radius:12px; box-shadow:0 12px 40px #0008;
    `;
    const style = document.createElement('style');
    style.textContent = '.whiteboard-tour-target { outline:3px solid var(--gold, #d4af37) !important; outline-offset:3px; scroll-margin-top:1rem; }';
    document.head.appendChild(style);
    modalEl.innerHTML = `
        <div id="whiteboard-onboarding-card" class="editor-screen" style="
            box-sizing:border-box; width:100%; position:relative; padding:1.25rem;
        ">
            <button id="whiteboard-onboarding-close" title="Close" style="
                position:absolute; top:10px; inset-inline-end:12px; background:none; border:none;
                color:var(--text3, #888); cursor:pointer; font-size:1rem; line-height:1;
            " data-i18n-attr="title:feature.whiteboard.modules.onboarding.close">✕</button>
            <div style="font-size:2rem; margin-bottom:0.4rem;" id="whiteboard-onboarding-icon"></div>
            <h2 style="margin:0 0 0.6rem 0; font-size:1.15rem; color:var(--gold, #d4af37);" id="whiteboard-onboarding-title" aria-live="polite"></h2>
            <div style="line-height:1.55; font-size:0.9rem; color:var(--text2, #ccc); min-height:70px;" id="whiteboard-onboarding-body"></div>
            <div style="display:flex; flex-wrap:wrap; gap:0.75rem; justify-content:space-between; align-items:center; margin-top:1.4rem;">
                <div id="whiteboard-onboarding-dots" style="display:flex; gap:5px;"></div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-ghost" id="whiteboard-onboarding-skip" data-i18n="feature.whiteboard.modules.onboarding.skip">Skip</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-onboarding-back" data-i18n="feature.whiteboard.modules.onboarding.back">Back</button>
                    <button class="btn btn-sm btn-gold" id="whiteboard-onboarding-next" data-i18n="feature.whiteboard.modules.onboarding.next">Next</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);

    modalEl.querySelector('#whiteboard-onboarding-close').addEventListener('click', () => hideOnboardingModal(true));
    modalEl.querySelector('#whiteboard-onboarding-skip').addEventListener('click', () => hideOnboardingModal(true));
    modalEl.querySelector('#whiteboard-onboarding-back').addEventListener('click', () => {
        currentStep = Math.max(0, currentStep - 1);
        renderStep();
    });
    modalEl.querySelector('#whiteboard-onboarding-next').addEventListener('click', () => {
        if (currentStep >= STEPS.length - 1) { hideOnboardingModal(true); return; }
        currentStep++;
        renderStep();
    });

    modalEl.addEventListener('keydown', (e) => {
        if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
        if (!modalEl || modalEl.style.display === 'none') return;
        if (e.key === 'Escape') hideOnboardingModal(true);
        const rtl = document.documentElement?.dir === 'rtl';
        const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
        const backKey = rtl ? 'ArrowRight' : 'ArrowLeft';
        if (e.key === nextKey) modalEl.querySelector('#whiteboard-onboarding-next')?.click();
        else if (e.key === backKey) modalEl.querySelector('#whiteboard-onboarding-back')?.click();
    });
}

function renderStep() {
    clearTarget();
    highlighted = document.getElementById(TARGETS[currentStep]);
    if (highlighted) {
        for (let el = highlighted.parentElement; el; el = el.parentElement) {
            if (el.tagName === 'DETAILS' && !el.open) { openedDetails.push(el); el.open = true; }
        }
        highlighted.classList.add('whiteboard-tour-target');
        highlighted.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    const step = STEPS[currentStep];
    modalEl.querySelector('#whiteboard-onboarding-icon').textContent = step.icon;
    modalEl.querySelector('#whiteboard-onboarding-title').textContent = step.title;
    // Content is developer-authored above, not user input — safe to set directly.
    modalEl.querySelector('#whiteboard-onboarding-body').innerHTML = step.body;
    modalEl.querySelector('#whiteboard-onboarding-back').style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    modalEl.querySelector('#whiteboard-onboarding-next').textContent = currentStep === STEPS.length - 1 ? 'Done' : 'Next';
    const dots = modalEl.querySelector('#whiteboard-onboarding-dots');
    dots.setAttribute('aria-label', `Step ${currentStep + 1} of ${STEPS.length}`);
    dots.innerHTML = STEPS.map((_, i) => `
        <span style="width:6px;height:6px;border-radius:50%;display:inline-block;
            background:${i === currentStep ? 'var(--gold, #d4af37)' : 'var(--border, #444)'};"></span>
    `).join('');
}
