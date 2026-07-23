/**
 * Home feature module – Modern Reactive Landing Page
 * Provides a scrollable, single-page introduction to the game.
 */

import { showToast } from '../../components/Toast.js';

// ─── Constants ──────────────────────────────────────────────────────────

const SELECTORS = {
  CREATE_CHAR: '[data-action="create-char"]',
  RULES_LINK: '[data-action="rules-link"]',
};

// ─── State ─────────────────────────────────────────────────────────────

let container = null;
let stylesInjected = false;

// ─── Render Functions ──────────────────────────────────────────────────

/** Build the full HTML string */
function buildHTML() {
  return `
    <!-- SLIDE 1: HERO -->
    <section class="home-slide home-hero" id="slide-hero" role="region" aria-label="Hero">
      <div class="slide-content">
        <div class="hero-badge">⚔️ Narrative-First TTRPG</div>
        <h1 class="hero-title"><span class="gold">Fate's</span> Edge</h1>
        <p class="hero-subtitle">
          Fortune favors the bold, but the wise know when to fold.
          <span class="hero-attribution">— Captain Livia Vex</span>
        </p>
        <div class="hero-quote">
          <p>“Every choice carries weight. Every debt echoes forward. Every road remembers.”</p>
        </div>
        <div class="hero-actions">
          <a href="#slide-rules" class="btn btn-gold" data-action="rules-link">⚡ View the Rules</a>
          <a href="#" class="btn btn-primary" data-action="create-char">🎭 Create a Character</a>
        </div>
        <div class="hero-footer">
          <p>“The road remembers. Every broken wheel leaves a mark, every lit lamp bears witness. The only question is: what are you willing to owe?”</p>
          <cite>— Dusana of the Raven Road, <em>The Hearth Ledger</em></cite>
        </div>
      </div>
      <div class="scroll-indicator" aria-hidden="true">
        <span>Scroll to explore</span>
        <div class="scroll-arrow">↓</div>
      </div>
    </section>

    <!-- SLIDE 2: CORE RULES -->
    <section class="home-slide home-rules" id="slide-rules" role="region" aria-label="Core Rules">
      <div class="slide-content">
        <div class="section-header">
          <span class="section-number">01</span>
          <h2>Core Mechanics</h2>
          <p>Every important action follows a simple, dramatic loop.</p>
        </div>
        <div class="golden-rule">
          <p>🎲 <strong>The Golden Rule:</strong> When in doubt, make the choice that serves the story. Set DV=3, Position=Controlled, and let the dice fall.</p>
        </div>
        <div class="mechanics-grid">
          ${buildMechanicsCard('Dice Pool', 'Attribute + Skill', 'Roll d10s. 6+ = success. 10 = 2 successes.')}
          ${buildMechanicsCard('Difficulty (DV)', '2 – 5+', '2 = routine · 3 = default · 4 = hard · 5+ = extreme')}
          ${buildMechanicsCard('Position', 'Dominant · Controlled · Desperate', 'Re-roll 1 failure · normal · re-roll 1 success')}
          ${buildMechanicsCard('Boons', '⚡ 1–5', 'Earn on Partial (1) or Miss (2). Spend to re-roll, improve Position, activate Assets.')}
        </div>
        ${buildOutcomeMatrix()}
        <div class="rules-nav">
          <a href="#slide-characters" class="btn btn-primary" data-action="create-char">🎭 Build a Character →</a>
        </div>
      </div>
    </section>

    <!-- SLIDE 3: CHARACTER CREATION -->
    <section class="home-slide home-characters" id="slide-characters" role="region" aria-label="Character Creation">
      <div class="slide-content">
        <div class="section-header">
          <span class="section-number">02</span>
          <h2>Character Creation</h2>
          <p>Build a character in about 10–15 minutes. Start with 32 XP.</p>
        </div>
        <div class="quick-start">
          <p>🧙 <strong>Quick Start:</strong> Concept → Attributes (Body/Wits/Spirit/Presence) → Skills → Talents → Bonds & Complications</p>
        </div>
        <div class="creation-grid">
          ${buildCreationCard('🧬', 'Attributes', 'Body · Wits · Spirit · Presence<br />Rated 1–5. Cost: new rating × 3 XP per step.', 'Example: Body 3 costs 15 XP total')}
          ${buildCreationCard('📚', 'Skills', 'Sixteen core skills. Rated 0–5. Cost: new level × 2 XP per step.', 'Melee, Stealth, Lore, Arcana, and more')}
          ${buildCreationCard('✨', 'Talents', 'Special abilities. Minor (2–3 XP), Major (4–6 XP), Prestige (7–10 XP).', 'Keen Senses, Weapon Mastery, Silver Tongue')}
          ${buildCreationCard('🔗', 'Bonds & Complications', 'Up to 2 Bonds (+2 XP each) and 2 Complications (+2 XP each) for max 36 XP.', '"I saved your life" or "The magistrate still hunts me"')}
        </div>
        <div class="creation-actions">
          <button class="btn btn-primary btn-large" data-action="create-char">🚀 Start Building Your Character</button>
        </div>
      </div>
    </section>

    <!-- SLIDE 4: WHY FATE'S EDGE -->
    <section class="home-slide home-why" id="slide-why" role="region" aria-label="Why Fate's Edge?">
      <div class="slide-content">
        <div class="section-header">
          <span class="section-number">03</span>
          <h2>Why Fate's Edge?</h2>
          <p>Three principles that define the game.</p>
        </div>
        <div class="why-grid">
          ${buildWhyCard('📜', 'Narrative First', 'Mechanics serve the story, not the other way around. Every roll asks "what happens next?"')}
          ${buildWhyCard('⚔️', 'Meaningful Risk', 'Safety is boring. Risk creates drama. Story Beats fuel an unpredictable, responsive narrative.')}
          ${buildWhyCard('⚡', 'Scalable Complexity', 'Start simple, discover naturally. Same core rules handle intimate scenes and epic narratives.')}
        </div>
        <div class="why-footer">
          <p>“The road remembers. Every broken wheel leaves a mark, every lit lamp bears witness.”</p>
          <cite>— Dusana of the Raven Road</cite>
        </div>
      </div>
    </section>
  `;
}

/** Helper: mechanics card */
function buildMechanicsCard(label, value, desc) {
  return `
    <div class="mech-card">
      <div class="mech-label">${label}</div>
      <div class="mech-value">${value}</div>
      <div class="mech-desc">${desc}</div>
    </div>
  `;
}

/** Helper: creation card */
function buildCreationCard(icon, title, desc, example) {
  return `
    <div class="creation-card">
      <span class="creation-icon">${icon}</span>
      <h3>${title}</h3>
      <p>${desc}</p>
      <span class="creation-example">${example}</span>
    </div>
  `;
}

/** Helper: why card */
function buildWhyCard(icon, title, desc) {
  return `
    <div class="why-card">
      <span class="why-icon">${icon}</span>
      <h3>${title}</h3>
      <p>${desc}</p>
    </div>
  `;
}

/** Build the Outcome Matrix HTML */
function buildOutcomeMatrix() {
  return `
    <div class="matrix-section">
      <h3>Outcome Matrix</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Result</th>
              <th>Outcome</th>
              <th>What Happens</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="result-symbol">S ≥ DV, SB = 0</td>
              <td><strong>Clean Success</strong></td>
              <td>You get what you want, no cost.</td>
            </tr>
            <tr>
              <td class="result-symbol">S ≥ DV, SB &gt; 0</td>
              <td><strong>Success with SB</strong></td>
              <td>You succeed, but the world pushes back.</td>
            </tr>
            <tr>
              <td class="result-symbol">0 &lt; S &lt; DV</td>
              <td><strong>Partial</strong></td>
              <td>You make progress — gain <strong>1 Boon</strong>.</td>
            </tr>
            <tr>
              <td class="result-symbol">S = 0</td>
              <td><strong>Miss</strong></td>
              <td>You fail, things get worse — gain <strong>2 Boons</strong>.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="matrix-tip">
        💡 <strong>Pro Tip:</strong> A Partial is not failure — it's meaningful progress. A Miss is never "nothing happens" — the GM must introduce a complication.
        <span class="tip-sub">SB = Story Beats — each die showing a <strong>1</strong> gives the GM a Story Beat to spend on complications.</span>
      </div>
    </div>
  `;
}

// ─── Style Injection ────────────────────────────────────────────────────

function injectStyles() {
  if (stylesInjected) return;
  const styleId = 'home-modern-styles';
  if (document.getElementById(styleId)) {
    stylesInjected = true;
    return;
  }

  const styles = document.createElement('style');
  styles.id = styleId;
  styles.textContent = `
    /* ===== SLIDE CONTAINER ===== */
    .home-slide {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem 1.5rem;
      scroll-margin-top: 60px;
      position: relative;
      opacity: 0;
      transform: translateY(30px);
      animation: slideFadeIn 0.8s ease forwards;
    }
    .home-slide:nth-child(2) { animation-delay: 0.2s; }
    .home-slide:nth-child(3) { animation-delay: 0.4s; }
    .home-slide:nth-child(4) { animation-delay: 0.6s; }

    @keyframes slideFadeIn {
      to { opacity: 1; transform: translateY(0); }
    }

    .slide-content {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
    }

    /* ===== SCROLL INDICATOR ===== */
    .scroll-indicator {
      position: absolute;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      color: var(--text2);
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.6;
      animation: bob 2s ease-in-out infinite;
    }
    @keyframes bob {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-8px); }
    }
    .scroll-arrow { font-size: 1.4rem; line-height: 1; }

    /* ===== HERO SLIDE ===== */
    .home-hero {
      background: radial-gradient(ellipse at 30% 20%, rgba(201,168,76,0.06) 0%, transparent 70%);
      text-align: center;
      min-height: 100vh;
      padding-top: 5rem;
    }
    .hero-badge {
      display: inline-block;
      background: rgba(201,168,76,0.12);
      border: 1px solid rgba(201,168,76,0.2);
      padding: 0.4rem 1.2rem;
      border-radius: 100px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 1.2rem;
    }
    .hero-title {
      font-size: clamp(3rem, 10vw, 5.5rem);
      line-height: 1.1;
      font-weight: 700;
      color: var(--gold);
      margin-bottom: 0.5rem;
    }
    .hero-title .gold { color: var(--gold); }
    .hero-subtitle {
      font-size: clamp(1rem, 1.6vw, 1.3rem);
      color: var(--text2);
      max-width: 620px;
      margin: 0 auto 1.5rem;
    }
    .hero-attribution {
      display: block;
      font-size: 0.8rem;
      color: var(--text3);
      margin-top: 0.2rem;
    }
    .hero-quote {
      margin: 1.5rem auto;
      padding: 1.5rem;
      max-width: 700px;
      background: rgba(201,168,76,0.04);
      border-radius: var(--radius);
      border: 1px solid rgba(201,168,76,0.08);
    }
    .hero-quote p {
      color: var(--text);
      font-style: italic;
      margin: 0;
      font-size: 1.05rem;
    }
    .hero-actions {
      margin: 1.8rem 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
      justify-content: center;
    }
    .hero-footer {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      max-width: 620px;
      margin-left: auto;
      margin-right: auto;
      font-style: italic;
      color: var(--text2);
      font-size: 0.9rem;
    }
    .hero-footer cite {
      display: block;
      font-style: normal;
      color: var(--gold);
      margin-top: 0.3rem;
      font-size: 0.85rem;
    }

    /* ===== RULES SLIDE ===== */
    .section-header { text-align: center; margin-bottom: 2rem; }
    .section-number {
      display: inline-block;
      font-size: 0.7rem;
      letter-spacing: 0.2em;
      color: var(--gold);
      opacity: 0.6;
      font-weight: 600;
      margin-bottom: 0.3rem;
    }
    .section-header h2 {
      font-size: clamp(1.8rem, 4vw, 2.6rem);
      color: var(--gold);
      margin-bottom: 0.4rem;
    }
    .section-header p { color: var(--text2); font-size: 1.05rem; }

    .golden-rule {
      margin: 1.5rem 0;
      padding: 1rem 1.5rem;
      background: var(--bg2);
      border-radius: var(--radius);
      border-left: 3px solid var(--gold);
    }
    .golden-rule p { margin: 0; color: var(--text); }

    .mechanics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .mech-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.2rem;
      text-align: center;
      transition: all 0.3s ease;
    }
    .mech-card:hover {
      transform: translateY(-4px);
      border-color: rgba(201,168,76,0.3);
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
    }
    .mech-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--text2);
      margin-bottom: 0.3rem;
    }
    .mech-value {
      font-size: clamp(1rem, 1.6vw, 1.3rem);
      font-weight: 700;
      color: var(--gold);
      margin: 0.2rem 0;
    }
    .mech-desc {
      font-size: 0.8rem;
      color: var(--text2);
      line-height: 1.4;
    }

    /* Outcome Matrix */
    .matrix-section { margin: 2rem 0; }
    .matrix-section h3 {
      text-align: center;
      font-size: 1.2rem;
      color: var(--gold);
      margin-bottom: 1rem;
    }
    .table-wrap { overflow-x: auto; margin: 1rem 0; }
    .table-wrap table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .table-wrap th {
      padding: 0.6rem 1rem;
      border: 1px solid var(--border);
      text-align: left;
      background: rgba(201,168,76,0.06);
      font-weight: 600;
      color: var(--gold);
    }
    .table-wrap td {
      padding: 0.6rem 1rem;
      border: 1px solid var(--border);
      text-align: left;
    }
    .result-symbol { color: var(--gold-light); font-weight: 500; }
    .matrix-tip {
      margin: 1rem 0;
      padding: 1rem;
      background: var(--bg3);
      border-radius: var(--radius);
      border-left: 2px solid var(--gold);
      font-size: 0.85rem;
      color: var(--text2);
    }
    .tip-sub {
      display: block;
      margin-top: 0.4rem;
      font-size: 0.78rem;
      color: var(--text3);
    }
    .rules-nav { text-align: center; margin-top: 2rem; }

    /* ===== CHARACTER SLIDE ===== */
    .quick-start {
      margin: 1.5rem 0;
      padding: 1rem;
      background: rgba(201,168,76,0.08);
      border-radius: var(--radius);
      border: 1px solid rgba(201,168,76,0.15);
      text-align: center;
    }
    .quick-start p { margin: 0; color: var(--text); }

    .creation-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.2rem;
      margin: 1.5rem 0;
    }
    .creation-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.2rem;
      transition: all 0.3s ease;
    }
    .creation-card:hover {
      transform: translateY(-4px);
      border-color: rgba(201,168,76,0.2);
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }
    .creation-icon { font-size: 2rem; display: block; margin-bottom: 0.4rem; }
    .creation-card h3 { color: var(--gold); font-size: 1.05rem; margin-bottom: 0.4rem; }
    .creation-card p { color: var(--text2); font-size: 0.88rem; margin-bottom: 0.3rem; }
    .creation-example { font-size: 0.75rem; color: var(--text3); display: block; }

    .creation-actions { text-align: center; margin-top: 1.5rem; }
    .btn-large { padding: 0.8rem 2.5rem; font-size: 1.05rem; }

    /* ===== WHY SLIDE ===== */
    .why-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    .why-card {
      text-align: center;
      padding: 1.5rem;
      background: var(--bg2);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      transition: all 0.3s ease;
    }
    .why-card:hover {
      transform: translateY(-4px);
      border-color: rgba(201,168,76,0.2);
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }
    .why-icon { font-size: 2.5rem; display: block; margin-bottom: 0.6rem; }
    .why-card h3 { color: var(--gold); font-size: 1.1rem; margin-bottom: 0.4rem; }
    .why-card p { color: var(--text2); font-size: 0.9rem; line-height: 1.5; }

    .why-footer {
      margin-top: 2.5rem;
      padding: 1.5rem;
      text-align: center;
      border-top: 1px solid var(--border);
      font-style: italic;
      color: var(--text2);
    }
    .why-footer cite {
      display: block;
      font-style: normal;
      color: var(--gold);
      margin-top: 0.3rem;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
      .home-slide { padding: 3rem 1rem; min-height: auto; }
      .home-hero { min-height: auto; padding-top: 2rem; }
      .hero-quote { padding: 1rem; margin: 1rem 0; }
      .mechanics-grid { grid-template-columns: 1fr 1fr; }
      .creation-grid { grid-template-columns: 1fr 1fr; }
      .why-grid { grid-template-columns: 1fr; }
      .table-wrap { font-size: 0.75rem; }
      .table-wrap th, .table-wrap td { padding: 0.4rem 0.6rem; }
      .scroll-indicator { display: none; }
    }
    @media (max-width: 480px) {
      .mechanics-grid { grid-template-columns: 1fr; }
      .creation-grid { grid-template-columns: 1fr; }
      .hero-title { font-size: 2.4rem; }
      .hero-actions { flex-direction: column; align-items: center; }
      .hero-actions .btn { width: 100%; max-width: 280px; }
    }
  `;
  document.head.appendChild(styles);
  stylesInjected = true;
}

// ─── Event Handling ──────────────────────────────────────────────────

/** Navigate to the character tab */
function navigateToCharacters() {
  const charBtn = document.querySelector('.sidebar-nav button[data-tab="characters"]');
  if (charBtn) {
    charBtn.click();
    return;
  }
  // Fallback: use router
  import('../../router.js')
    .then(module => module.navigate('characters'))
    .catch(() => showToast('Character editor not available', 'error'));
}

/** Scroll to the rules section */
function scrollToRules() {
  const target = document.getElementById('slide-rules');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

/** Handle click events via delegation */
function handleContainerClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'create-char') {
    e.preventDefault();
    navigateToCharacters();
  } else if (action === 'rules-link') {
    e.preventDefault();        // 🛑 Prevent router interception
    scrollToRules();           // 👈 Smooth scroll to #slide-rules
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Render the home tab into the given container element.
 * @param {HTMLElement} el - The container to render into.
 */
export function render(el) {
  container = el;
  container.innerHTML = buildHTML();
  injectStyles();
  // Attach event listeners after render
  attachEvents();
}

/**
 * Attach event listeners – uses delegation on the container.
 * Call this after render (or if the DOM changes).
 */
export function attachEvents() {
  if (!container) return;
  // Remove any previous listener to avoid duplicates
  if (container._listener) {
    container.removeEventListener('click', container._listener);
  }
  const listener = handleContainerClick;
  container.addEventListener('click', listener);
  container._listener = listener;
}

/**
 * Clean up event listeners and optional state.
 */
export function dispose() {
  if (container && container._listener) {
    container.removeEventListener('click', container._listener);
    delete container._listener;
  }
  container = null;
}