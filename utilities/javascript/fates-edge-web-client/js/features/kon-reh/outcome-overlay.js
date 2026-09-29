// ============================================================
// Shared end-of-game overlay for Kon'reh and Toll & Veil.
//
// Shows a Victory / Defeat / Draw / neutral ("Player N wins") screen
// with a short animation and a soft synthesized sound cue, plus
// caller-supplied buttons (e.g. Rematch). Purely presentational: the
// caller decides WHO won and what the buttons do.
//
//   showOutcomeOverlay({ result, title, subtitle, details, buttons })
//     result:   'win' | 'lose' | 'draw' | 'neutral'
//     buttons:  [{ label, primary?, onClick }]  (a "Dismiss" button is always added)
//   hideOutcomeOverlay()
// ============================================================

const OVERLAY_ID = 'fe-outcome-overlay';
const STYLE_ID = 'fe-outcome-style';

const THEMES = {
    win:     { icon: '🏆', accent: '#d4af37', glow: 'rgba(212,175,55,0.35)', label: 'Victory' },
    lose:    { icon: '🥀', accent: '#c0566a', glow: 'rgba(192,86,106,0.28)', label: 'Defeat' },
    draw:    { icon: '🤝', accent: '#8fa8c8', glow: 'rgba(143,168,200,0.28)', label: 'Draw' },
    neutral: { icon: '🏆', accent: '#d4af37', glow: 'rgba(212,175,55,0.3)',  label: 'Game Over' },
};

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${OVERLAY_ID} { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center;
            background:rgba(8,8,14,0.72); backdrop-filter:blur(3px); animation: fe-oc-fade .35s ease-out both;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
        #${OVERLAY_ID} .fe-oc-card { position:relative; text-align:center; min-width:min(360px,90vw); max-width:90vw; padding:28px 34px 24px;
            background:#1b1c26; color:#e8e6df; border:1px solid var(--fe-oc-accent); border-radius:14px;
            box-shadow:0 0 60px var(--fe-oc-glow), 0 20px 60px rgba(0,0,0,.6); }
        #${OVERLAY_ID}.win .fe-oc-card { animation: fe-oc-pop .55s cubic-bezier(.2,1.4,.4,1) both; }
        #${OVERLAY_ID}.lose .fe-oc-card { animation: fe-oc-sink .7s ease-out both; }
        #${OVERLAY_ID}.draw .fe-oc-card, #${OVERLAY_ID}.neutral .fe-oc-card { animation: fe-oc-pop .45s ease-out both; }
        #${OVERLAY_ID} .fe-oc-icon { font-size:54px; line-height:1; }
        #${OVERLAY_ID}.win .fe-oc-icon { animation: fe-oc-bounce 1.2s ease-in-out .5s 2; }
        #${OVERLAY_ID} .fe-oc-title { margin:10px 0 4px; font-size:30px; letter-spacing:.06em; text-transform:uppercase; color:var(--fe-oc-accent); font-weight:800; }
        #${OVERLAY_ID} .fe-oc-sub { font-size:14px; color:#c9c8d4; }
        #${OVERLAY_ID} .fe-oc-details { margin-top:12px; font-size:12px; color:#9a9aa8; line-height:1.6; }
        #${OVERLAY_ID} .fe-oc-btns { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:20px; }
        #${OVERLAY_ID} .fe-oc-btn { background:#2a2b38; color:#e8e6df; border:1px solid #3a3b4a; padding:8px 18px; border-radius:6px; cursor:pointer; font-size:13px; }
        #${OVERLAY_ID} .fe-oc-btn:hover { background:#34364a; }
        #${OVERLAY_ID} .fe-oc-btn.primary { background:var(--fe-oc-accent); color:#1a1400; border-color:var(--fe-oc-accent); font-weight:600; }
        #${OVERLAY_ID} .fe-oc-spark { position:absolute; top:50%; left:50%; width:6px; height:6px; border-radius:50%; background:var(--fe-oc-accent);
            opacity:0; animation: fe-oc-spark 1.4s ease-out forwards; pointer-events:none; }
        @keyframes fe-oc-fade { from { opacity:0 } to { opacity:1 } }
        @keyframes fe-oc-pop { from { transform:scale(.7); opacity:0 } to { transform:scale(1); opacity:1 } }
        @keyframes fe-oc-sink { from { transform:translateY(-24px); opacity:0; filter:grayscale(.6) } to { transform:translateY(0); opacity:1; filter:none } }
        @keyframes fe-oc-bounce { 0%,100% { transform:translateY(0) } 40% { transform:translateY(-12px) rotate(-6deg) } 70% { transform:translateY(0) rotate(6deg) } }
        @keyframes fe-oc-spark { 0% { opacity:1; transform:translate(0,0) scale(1) } 100% { opacity:0; transform:translate(var(--dx),var(--dy)) scale(.3) } }
        @media (prefers-reduced-motion: reduce) {
            #${OVERLAY_ID}, #${OVERLAY_ID} * { animation:none !important; }
        }
    `;
    document.head.appendChild(style);
}

function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// Tiny synthesized cue (no asset files): rising triad for a win, falling
// pair for a loss, single soft note for a draw. Fails silently if audio
// isn't available or hasn't been unlocked by a user gesture yet.
function playCue(result) {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const notes = result === 'lose' ? [392, 311.13]
            : result === 'draw' ? [349.23]
            : [523.25, 659.25, 783.99];
        const t0 = ctx.currentTime + 0.02;
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = result === 'lose' ? 'triangle' : 'sine';
            osc.frequency.value = freq;
            const start = t0 + i * 0.16;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.6);
        });
        setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 1500);
    } catch { /* audio unavailable — silent is fine */ }
}

export function hideOutcomeOverlay() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
}

export function showOutcomeOverlay({ result = 'neutral', title, subtitle = '', details = '', buttons = [], sound = true } = {}) {
    injectStyle();
    hideOutcomeOverlay();
    const theme = THEMES[result] || THEMES.neutral;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = result;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', title || theme.label);
    overlay.style.setProperty('--fe-oc-accent', theme.accent);
    overlay.style.setProperty('--fe-oc-glow', theme.glow);

    overlay.innerHTML = `
        <div class="fe-oc-card">
            <div class="fe-oc-icon" aria-hidden="true">${theme.icon}</div>
            <div class="fe-oc-title">${esc(title || theme.label)}</div>
            ${subtitle ? `<div class="fe-oc-sub">${esc(subtitle)}</div>` : ''}
            ${details ? `<div class="fe-oc-details">${details}</div>` : ''}
            <div class="fe-oc-btns"></div>
        </div>
    `;

    const card = overlay.querySelector('.fe-oc-card');
    if (result === 'win' && !prefersReducedMotion()) {
        for (let i = 0; i < 18; i++) {
            const s = document.createElement('span');
            s.className = 'fe-oc-spark';
            const angle = (Math.PI * 2 * i) / 18;
            const dist = 90 + Math.random() * 90;
            s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
            s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
            s.style.animationDelay = `${0.25 + Math.random() * 0.3}s`;
            card.appendChild(s);
        }
    }

    const btnRow = overlay.querySelector('.fe-oc-btns');
    const allButtons = [...buttons, { label: 'Dismiss', onClick: null }];
    allButtons.forEach((b, i) => {
        const btn = document.createElement('button');
        btn.className = 'fe-oc-btn' + (b.primary ? ' primary' : '');
        btn.textContent = b.label;
        btn.onclick = () => {
            hideOutcomeOverlay();
            if (b.onClick) b.onClick();
        };
        btnRow.appendChild(btn);
        if (i === 0) setTimeout(() => btn.focus(), 50);
    });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') hideOutcomeOverlay(); });

    document.body.appendChild(overlay);
    if (sound) playCue(result);
    return overlay;
}
