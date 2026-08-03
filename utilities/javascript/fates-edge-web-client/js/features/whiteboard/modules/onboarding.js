// modules/onboarding.js
// A lightweight, self-contained intro wizard for the Whiteboard feature.
// Deliberately built with plain DOM + inline styles rather than depending on
// a shared Modal component (whose API we don't have visibility into here) —
// swap it for your own modal component later if you'd like, the public
// functions below (showOnboardingModal / maybeShowOnboarding) are the only
// surface other modules need to touch.

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
    renderStep();
    modalEl.style.display = 'flex';
}

export function hideOnboardingModal(markSeen = true) {
    if (modalEl) modalEl.style.display = 'none';
    if (markSeen) markOnboardingSeen();
}

function buildModal() {
    modalEl = document.createElement('div');
    modalEl.id = 'whiteboard-onboarding-modal';
    modalEl.style.cssText = `
        position:fixed; inset:0; z-index:1000; display:none;
        align-items:center; justify-content:center;
        background:rgba(5,5,10,0.72);
    `;
    modalEl.innerHTML = `
        <div id="whiteboard-onboarding-card" style="
            max-width:480px; width:90%; padding:1.5rem; border-radius:8px;
            border:1px solid var(--gold, #d4af37); background:var(--bg2, #1a1a22);
            position:relative; box-shadow:0 8px 32px rgba(0,0,0,0.5);
        ">
            <button id="whiteboard-onboarding-close" title="Close" style="
                position:absolute; top:10px; right:12px; background:none; border:none;
                color:var(--text3, #888); cursor:pointer; font-size:1rem; line-height:1;
            ">✕</button>
            <div style="font-size:2rem; margin-bottom:0.4rem;" id="whiteboard-onboarding-icon"></div>
            <h2 style="margin:0 0 0.6rem 0; font-size:1.15rem; color:var(--gold, #d4af37);" id="whiteboard-onboarding-title"></h2>
            <div style="line-height:1.55; font-size:0.9rem; color:var(--text2, #ccc); min-height:70px;" id="whiteboard-onboarding-body"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.4rem;">
                <div id="whiteboard-onboarding-dots" style="display:flex; gap:5px;"></div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-ghost" id="whiteboard-onboarding-skip">Skip</button>
                    <button class="btn btn-sm btn-secondary" id="whiteboard-onboarding-back">Back</button>
                    <button class="btn btn-sm btn-gold" id="whiteboard-onboarding-next">Next</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) hideOnboardingModal(true);
    });
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

    document.addEventListener('keydown', (e) => {
        if (!modalEl || modalEl.style.display === 'none') return;
        if (e.key === 'Escape') hideOnboardingModal(true);
        else if (e.key === 'ArrowRight') modalEl.querySelector('#whiteboard-onboarding-next')?.click();
        else if (e.key === 'ArrowLeft') modalEl.querySelector('#whiteboard-onboarding-back')?.click();
    });
}

function renderStep() {
    const step = STEPS[currentStep];
    modalEl.querySelector('#whiteboard-onboarding-icon').textContent = step.icon;
    modalEl.querySelector('#whiteboard-onboarding-title').textContent = step.title;
    // Content is developer-authored above, not user input — safe to set directly.
    modalEl.querySelector('#whiteboard-onboarding-body').innerHTML = step.body;
    modalEl.querySelector('#whiteboard-onboarding-back').style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    modalEl.querySelector('#whiteboard-onboarding-next').textContent = currentStep === STEPS.length - 1 ? 'Done' : 'Next';
    const dots = modalEl.querySelector('#whiteboard-onboarding-dots');
    dots.innerHTML = STEPS.map((_, i) => `
        <span style="width:6px;height:6px;border-radius:50%;display:inline-block;
            background:${i === currentStep ? 'var(--gold, #d4af37)' : 'var(--border, #444)'};"></span>
    `).join('');
}
