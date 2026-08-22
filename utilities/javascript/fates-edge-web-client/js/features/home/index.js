/**
 * Home feature module – Modern Reactive Landing Page
 * Provides a scrollable, single-page introduction to the game.
 * Includes first‑start welcome overlay with Quick Start.
 */

import { showToast } from '../../components/Toast.js';
import { getState, saveState } from '../../core/state.js';
import { escHtml } from '../../core/utils.js';

// ─── Constants ──────────────────────────────────────────────────────────

const SELECTORS = {
  CREATE_CHAR: '[data-action="create-char"]',
  RULES_LINK: '[data-action="rules-link"]',
  TOOLKIT_LINK: '[data-action="toolkit-link"]',
  QUICK_START: '[data-action="quick-start"]',
};

// ─── State ─────────────────────────────────────────────────────────────

let container = null;
let stylesInjected = false;
let overlayShown = false; // prevent duplicate overlays
let quickStartInFlight = false; // guard against double-fire (delegated handler + direct listener both match [data-action="quick-start"])

const ESSENTIALS_DOC_URL = '/data/docs/resources/Fates_-_Edge_-_-Essentials.html';
const CAMPFIRE_DOC_URL = '/data/docs/quickstart/Fates_-_Edge_-_-Campfire_Mode.html';

// ─── Render Functions ──────────────────────────────────────────────────

/** Build the full HTML string */
function buildHTML() {
  return `
    <!-- SLIDE 1: HERO -->
    <section class="home-slide home-hero" id="slide-hero" role="region" aria-label="Hero">
      <div class="slide-content">
        <div class="hero-badge">⚔️ Narrative-First TTRPG + Digital Toolkit</div>
        <h1 class="hero-title"><span class="gold">Fate's</span> Edge</h1>
        <p class="hero-subtitle">
          Roll dice. Build characters. Shape stories.
          <span class="hero-attribution">— all in one open‑source companion</span>
        </p>
        <div class="hero-quote">
          <p>“Every choice carries weight. Every debt echoes forward. Every road remembers.”</p>
        </div>
        <div class="hero-actions">
          <a href="#slide-rules" class="btn btn-gold" data-action="rules-link">📖 View the Rules</a>
          <a href="#" class="btn btn-primary" data-action="create-char">🎭 Create a Character</a>
          <a href="#slide-toolkit" class="btn btn-secondary" data-action="toolkit-link">🛠️ Explore the Toolkit</a>
          <button class="btn btn-gold btn-large" data-action="quick-start" style="font-weight:700;border-width:2px;">🚀 Quick Start – The Lantern at Dusk</button>
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

    <!-- SLIDE 4: DIGITAL TOOLKIT (NEW) -->
    <section class="home-slide home-toolkit" id="slide-toolkit" role="region" aria-label="Digital Toolkit">
      <div class="slide-content">
        <div class="section-header">
          <span class="section-number">03</span>
          <h2>🛠️ Digital Toolkit</h2>
          <p>Everything you need to run or play <em>Fate’s Edge</em> — right in your browser.</p>
        </div>
        <div class="toolkit-grid">
          ${buildToolkitCard('🎲', 'Dice Roller', 'Roll d10s with position and difficulty modifiers. Auto‑calculates successes and Story Beats.')}
          ${buildToolkitCard('👤', 'Character Sheets', 'Track attributes, skills, talents, bonds, and complications. Export to PDF for your table.')}
          ${buildToolkitCard('⚔️', 'Encounter Tracker', 'Build scenes with NPCs, track initiative, and apply status effects on the fly.')}
          ${buildToolkitCard('🏛️', 'Faction Manager', 'Define factions, track reputations, and see how the world reacts to your party’s choices.')}
        </div>
        <div class="toolkit-cta">
          <p>All data stays in your browser — no sign‑up required. <strong>Open source</strong> and ready to use.</p>
          <a href="#" class="btn btn-primary" data-action="create-char">🎭 Jump to the Character Editor</a>
        </div>
      </div>
    </section>

    <!-- SLIDE 5: WHY FATE'S EDGE? (re‑focused) -->
    <section class="home-slide home-why" id="slide-why" role="region" aria-label="Why Fate's Edge?">
      <div class="slide-content">
        <div class="section-header">
          <span class="section-number">04</span>
          <h2>Why This Game?</h2>
          <p>Three core pillars that make <em>Fate’s Edge</em> stand out.</p>
        </div>
        <div class="why-grid">
          ${buildWhyCard('📜', 'Narrative First', 'Every roll pushes the story forward. Successes and failures alike create new drama—never a dead end.')}
          ${buildWhyCard('⚔️', 'Meaningful Risk', 'Position and Story Beats make each choice weighty. You’re not just rolling dice—you’re making a pact with fate.')}
          ${buildWhyCard('⚡', 'Scalable Complexity', 'Start with just Attributes and Skills. Add Talents and Complications as you grow. The same core handles a tavern brawl or a kingdom‑saving heist.')}
        </div>
        <div class="why-footer">
          <p>“The road remembers. Every broken wheel leaves a mark, every lit lamp bears witness.”</p>
          <cite>— Dusana of the Raven Road</cite>
        </div>
      </div>
    </section>

    <!-- SLIDE 6: ABOUT THE CREATOR (trimmed, more inviting) -->
    <section class="home-slide home-about" id="slide-about" role="region" aria-label="About the Creator">
      <div class="slide-content">
        <div class="section-header">
          <span class="section-number">05</span>
          <h2>About the Creator</h2>
          <p>Built by a lifelong gamer, for everyone.</p>
        </div>
        <div class="about-grid">
          <div class="about-card">
            <div class="about-icon">🐉</div>
            <h3>Nicholas A. Gasper <span class="handle">(Chronophage)</span></h3>
            <p class="about-role">Sysadmin · DevOps · FreeBSD / Linux — 20+ years</p>
            <p class="about-bio">
              Rolling dice since age twelve — three decades of tabletop stories. I live in the Twin Cities, Minnesota.
              This is my first large software project: an open‑source companion designed to put the narrative first.
            </p>
            <blockquote class="about-philosophy">
              <p>“Keep It Stupid — minimal but not fragile. Build from user needs, set a feature limit, layer by layer.”</p>
            </blockquote>
            <p class="about-contact">
              📧 <a href="mailto:support@fates-edge.com">support@fates-edge.com</a> · 
              ☕ <a href="https://venmo.com/chronophage" target="_blank" rel="noopener noreferrer">Venmo: chronophage</a> · 
              🐦 <a href="https://twitter.com/chronophage" target="_blank" rel="noopener noreferrer">@chronophage</a> (everywhere)
            </p>
            <p class="about-tagline">☕ Fueled by coffee · 🧠 Neurodivergent & proud · 🌱 Community grows from within</p>
          </div>
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

/** Helper: toolkit card */
function buildToolkitCard(icon, title, desc) {
  return `
    <div class="toolkit-card">
      <span class="toolkit-icon">${icon}</span>
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
    .home-slide:nth-child(5) { animation-delay: 0.8s; }
    .home-slide:nth-child(6) { animation-delay: 1.0s; }

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

    /* ===== BUTTONS ===== */
    .btn {
      display: inline-block;
      padding: 0.6rem 1.4rem;
      border-radius: var(--radius);
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .btn-primary {
      background: var(--gold);
      color: #0b0b0b;
    }
    .btn-primary:hover {
      background: var(--gold-light);
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(201,168,76,0.3);
    }
    .btn-gold {
      background: transparent;
      border-color: var(--gold);
      color: var(--gold);
    }
    .btn-gold:hover {
      background: rgba(201,168,76,0.1);
      transform: translateY(-2px);
    }
    .btn-secondary {
      background: var(--bg2);
      border-color: var(--border);
      color: var(--text);
    }
    .btn-secondary:hover {
      background: var(--bg3);
      border-color: var(--gold);
      transform: translateY(-2px);
    }
    .btn-large {
      padding: 0.8rem 2.5rem;
      font-size: 1.05rem;
    }

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

    /* ===== TOOLKIT SLIDE (NEW) ===== */
    .toolkit-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.2rem;
      margin: 1.5rem 0;
    }
    .toolkit-card {
      text-align: center;
      padding: 1.5rem;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: all 0.3s ease;
    }
    .toolkit-card:hover {
      transform: translateY(-4px);
      border-color: rgba(201,168,76,0.2);
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }
    .toolkit-icon { font-size: 2.5rem; display: block; margin-bottom: 0.6rem; }
    .toolkit-card h3 { color: var(--gold); font-size: 1.1rem; margin-bottom: 0.4rem; }
    .toolkit-card p { color: var(--text2); font-size: 0.9rem; line-height: 1.5; }

    .toolkit-cta {
      text-align: center;
      margin-top: 1.5rem;
      padding: 1.5rem;
      background: rgba(201,168,76,0.04);
      border-radius: var(--radius);
      border: 1px solid rgba(201,168,76,0.08);
    }
    .toolkit-cta p { margin-bottom: 1rem; color: var(--text2); }

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

    /* ===== ABOUT SLIDE ===== */
    .home-about {
      background: radial-gradient(ellipse at 70% 30%, rgba(201,168,76,0.04) 0%, transparent 60%);
    }
    .about-grid {
      display: flex;
      justify-content: center;
      margin-top: 1.5rem;
    }
    .about-card {
      max-width: 680px;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem 2.2rem;
      text-align: center;
      transition: box-shadow 0.3s ease;
    }
    .about-card:hover {
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      border-color: rgba(201,168,76,0.2);
    }
    .about-icon {
      font-size: 3rem;
      margin-bottom: 0.6rem;
    }
    .about-card h3 {
      font-size: 1.4rem;
      color: var(--gold);
      margin-bottom: 0.2rem;
    }
    .handle {
      font-size: 1rem;
      font-weight: 400;
      color: var(--text2);
      margin-left: 0.3rem;
    }
    .about-role {
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      color: var(--text3);
      text-transform: uppercase;
      margin-bottom: 1rem;
    }
    .about-bio {
      color: var(--text);
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.2rem;
    }
    .about-philosophy {
      margin: 1rem 0;
      padding: 1rem 1.5rem;
      background: rgba(201,168,76,0.04);
      border-radius: var(--radius);
      border-left: 3px solid var(--gold);
      font-style: italic;
      color: var(--text2);
      font-size: 0.9rem;
      text-align: left;
    }
    .about-contact {
      margin: 1rem 0 0.5rem;
      font-size: 0.9rem;
      color: var(--text2);
    }
    .about-contact a {
      color: var(--gold);
      text-decoration: none;
    }
    .about-contact a:hover {
      text-decoration: underline;
    }
    .about-tagline {
      font-size: 0.85rem;
      color: var(--text3);
      margin-top: 1.2rem;
      line-height: 1.5;
    }

    /* ===== WELCOME SCREEN (inline, not a pop-up) ===== */
    .welcome-overlay {
      display: flex; align-items: center; justify-content: center;
      animation: welcomeFadeIn 0.4s ease;
      padding: 1rem 0;
      width: 100%;
    }
    @keyframes welcomeFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .welcome-card {
      background: var(--bg1); color: var(--text);
      max-width: 640px; width: 100%; max-height: 90vh;
      padding: 2rem; border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      overflow-y: auto;
      text-align: center;
    }
    .welcome-card h1 {
      color: var(--gold); margin: 0.2rem 0;
    }
    .welcome-card .welcome-docs {
      background: var(--bg3); padding: 1rem; border-radius: 8px;
      border-left: 4px solid var(--gold); margin: 1.2rem 0;
      text-align: left;
    }
    .welcome-card .welcome-docs ul {
      margin: 0.5rem 0 0 1.2rem; padding: 0; color: var(--text2);
    }
    .welcome-card .welcome-docs a {
      color: var(--gold);
    }
    .welcome-card .welcome-actions {
      display: flex; flex-direction: column; gap: 0.75rem; margin: 1.2rem 0;
    }
    .welcome-card .welcome-actions .btn {
      width: 100%;
    }
    .welcome-card .welcome-subtext {
      font-size: 0.85rem; color: var(--text3); margin: -0.25rem 0 0;
    }
    .welcome-card .welcome-dismiss {
      color: var(--text3); font-size: 0.85rem; cursor: pointer;
      background: none; border: none; text-decoration: underline;
    }
    .welcome-card .welcome-footer {
      font-size: 0.75rem; color: var(--text3); margin: 0;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
      .home-slide { padding: 3rem 1rem; min-height: auto; }
      .home-hero { min-height: auto; padding-top: 2rem; }
      .hero-quote { padding: 1rem; margin: 1rem 0; }
      .mechanics-grid { grid-template-columns: 1fr 1fr; }
      .creation-grid { grid-template-columns: 1fr 1fr; }
      .toolkit-grid { grid-template-columns: 1fr 1fr; }
      .why-grid { grid-template-columns: 1fr; }
      .table-wrap { font-size: 0.75rem; }
      .table-wrap th, .table-wrap td { padding: 0.4rem 0.6rem; }
      .scroll-indicator { display: none; }
    }
    @media (max-width: 600px) {
      .about-card { padding: 1.5rem 1.2rem; }
      .about-philosophy { padding: 0.8rem; }
      .welcome-card { padding: 1.5rem; }
    }
    @media (max-width: 480px) {
      .mechanics-grid { grid-template-columns: 1fr; }
      .creation-grid { grid-template-columns: 1fr; }
      .toolkit-grid { grid-template-columns: 1fr; }
      .hero-title { font-size: 2.4rem; }
      .hero-actions { flex-direction: column; align-items: center; }
      .hero-actions .btn { width: 100%; max-width: 280px; }
    }
  `;
  document.head.appendChild(styles);
  stylesInjected = true;
}

// ─── WELCOME OVERLAY ──────────────────────────────────────────────────

function showWelcomeOverlay() {
  if (overlayShown) return;
  overlayShown = true;

  // Build the overlay
  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.id = 'welcome-overlay';
  overlay.innerHTML = `
    <div class="welcome-card">
      <span style="font-size:3rem;">⚔️</span>
      <h1>Welcome to Fate's Edge</h1>
      <p style="color:var(--text2);font-size:1.05rem;margin:0;">
        Your complete toolkit for running and playing Fate's Edge.
      </p>

      <div class="welcome-docs">
        <p style="margin:0;font-weight:500;">📖 Start here – essential documents:</p>
        <ul>
          <li><a href="/data/docs/resources/Fates_-_Edge_-_-Essentials.html" target="_blank">⚡ Essentials</a> – quick start rules</li>
          <li><a href="/data/docs/resources/Fates_-_Edge_-_-Playing-_-and-_-Running-_-Fate's-_-Edge.html" target="_blank">📜 Playing &amp; Running Fate's Edge</a> – full guide</li>
          <li><a href="${CAMPFIRE_DOC_URL}" target="_blank">🏕️ Campfire Mode</a> – the whole game on a handful of pages, free to print and share at the table</li>
        </ul>
      </div>

      <div class="welcome-actions">
        <button class="btn btn-gold btn-large" data-action="quick-start" style="font-weight:700;border-width:2px;">
          ⚡ Jump to the Action
        </button>
        <p class="welcome-subtext">Drops you straight into <strong>The Lantern at Dusk</strong> (a short one‑shot) with a ready‑made character. No setup required.</p>
        <button class="btn btn-secondary" data-action="dismiss-welcome">
          Skip – I'll explore on my own
        </button>
      </div>
      <p class="welcome-footer">You can re‑open this welcome tour anytime in Settings.</p>
    </div>
  `;

  // Inline screen — takes over the home view in place instead of floating
  // above it as a pop-up.
  const hostContainer = document.getElementById('app-content') || document.body;
  const welcomeHiddenSiblings = Array.from(hostContainer.children);
  welcomeHiddenSiblings.forEach(ch => { ch.style.display = 'none'; });
  hostContainer.appendChild(overlay);
  window.scrollTo({ top: 0 });

  const closeWelcome = () => {
    overlay.remove();
    overlayShown = false;
    welcomeHiddenSiblings.forEach(ch => { ch.style.display = ''; });
  };

  // Event listeners
  const quickBtn = overlay.querySelector('[data-action="quick-start"]');
  const dismissBtn = overlay.querySelector('[data-action="dismiss-welcome"]');

  quickBtn?.addEventListener('click', () => {
    runQuickStart(overlay);
  });

  dismissBtn?.addEventListener('click', () => {
    closeWelcome();
    markWelcomeSeen();
  });
}

/**
 * Runs the "Jump to the Action" flow and, on success, swaps the welcome
 * card's content in place for a short confirmation pane (character name +
 * a link to the Essentials quickstart doc) instead of silently navigating
 * away. Safe to call more than once concurrently (e.g. if the delegated
 * container click handler and this direct listener both fire for the same
 * click) — only the first call actually runs.
 */
async function runQuickStart(overlayEl) {
  if (quickStartInFlight) return;
  quickStartInFlight = true;
  try {
    const result = await quickStart();
    if (result && overlayEl?.isConnected) {
      renderQuickStartConfirmation(overlayEl, result);
    }
  } finally {
    quickStartInFlight = false;
  }
}

/** Replace the welcome card's contents with a short "you're playing as X" confirmation + doc link. */
function renderQuickStartConfirmation(overlayEl, { character, adventure }) {
  const card = overlayEl.querySelector('.welcome-card');
  if (!card) return;
  const charLine = character
    ? `Playing as <strong>${escHtml(character.name)}</strong> — ${escHtml(character.tagline || 'ready to go')} — in <strong>${escHtml(adventure.title)}</strong>.`
    : `<strong>${escHtml(adventure.title)}</strong> is loaded and ready — head to Characters to pick or build one.`;
  card.innerHTML = `
    <span style="font-size:3rem;">🏮</span>
    <h1>You're in!</h1>
    <p style="color:var(--text2);font-size:1.05rem;margin:0;">
      ${charLine}
    </p>
    <div class="welcome-docs">
      <p style="margin:0;font-weight:500;">📖 New to Fate's Edge?</p>
      <ul>
        <li><a href="${ESSENTIALS_DOC_URL}" target="_blank" rel="noopener">⚡ Essentials</a> – the quickstart rules primer, keep it open in a tab while you play</li>
        <li><a href="${CAMPFIRE_DOC_URL}" target="_blank" rel="noopener">🏕️ Campfire Mode</a> – an even shorter cheat-sheet version, good for a first-time table</li>
      </ul>
    </div>
    <div class="welcome-actions">
      <button class="btn btn-gold btn-large" data-action="enter-game" style="font-weight:700;border-width:2px;">
        ▶ Enter the Game
      </button>
    </div>
  `;
  card.querySelector('[data-action="enter-game"]')?.addEventListener('click', () => {
    overlayEl.remove();
    overlayShown = false;
    const hostContainer = document.getElementById('app-content') || document.body;
    Array.from(hostContainer.children).forEach(ch => { ch.style.display = ''; });
    markWelcomeSeen();
    window.location.hash = 'adventure-manager';
  });
}

function markWelcomeSeen() {
  const state = getState();
  if (!state.app) state.app = {};
  state.app.welcomeSeen = true;
  saveState();
}

function checkWelcomeOverlay() {
  const state = getState();
  const welcomeSeen = state.app?.welcomeSeen || false;
  if (!welcomeSeen && !overlayShown) {
    // Delay a bit so the home page renders first
    setTimeout(showWelcomeOverlay, 400);
  }
}

// ─── QUICK START LOGIC ───────────────────────────────────────────────

// js/features/home/index.js

const PREGENS_URL = '/data/pre-gens.json';

/**
 * "Jump to the Action" — loads the pre-bundled one-shot adventure (The
 * Lantern at Dusk), makes sure the pre-generated characters exist in the
 * roster, starts the adventure, and marks the welcome tour seen.
 *
 * Returns `{ character, adventure }` on success (character is the one
 * pregen flagged `recommendedFor: "Jump to the Action"` in pre-gens.json,
 * falling back to the first pregen loaded/found if that flag is missing)
 * so the caller can show a confirmation naming who you're playing, or
 * `null`/`undefined` on failure (a toast has already been shown either way).
 */
async function quickStart() {
    console.log('[QuickStart] Starting quick start...');
    try {
        const state = getState();

        // 1. Import adventure manager early so we can sync its cache
        const advModule = await import('../adventure-manager/index.js');

        // 2. Ensure the adventure is loaded into state
        let adventure = state.adventures?.find(a => a.id === 'lantern_at_dusk');
        if (!adventure) {
            console.log('[QuickStart] Adventure not in state, loading from file...');
            const loaded = await advModule.loadAdventureFromFile('lantern_at_dusk');
            if (!loaded) {
                console.error('[QuickStart] loadAdventureFromFile failed.');
                showToast('Could not load the starter adventure. Check that lantern_at_dusk.json exists in /data/adventures/.', 'error');
                return null;
            }
            // Re-fetch state after load
            const newState = getState();
            adventure = newState.adventures?.find(a => a.id === 'lantern_at_dusk');
            if (!adventure) {
                console.error('[QuickStart] Adventure still not found after loading.');
                showToast('Starter adventure not found after loading.', 'error');
                return null;
            }
            console.log('[QuickStart] Adventure loaded successfully:', adventure.title);
        } else {
            console.log('[QuickStart] Adventure already in state.');
        }

        // ─── ROBUST FIX: Sync the adventure-manager's internal cache ────
        advModule.loadAdventuresFromState();
        console.log('[QuickStart] Adventure manager cache synced with state.');

        // 3. Load pre‑generated characters if any are missing from the roster,
        // and figure out which one to hand the player by default.
        if (!state.characters) state.characters = [];
        let featuredCharacter = null;
        console.log('[QuickStart] Checking pre-gens...');
        try {
            const response = await fetch(PREGENS_URL);
            if (response.ok) {
                const chars = await response.json();
                if (Array.isArray(chars) && chars.length > 0) {
                    let added = 0;
                    chars.forEach(char => {
                        const existing = state.characters.find(c => c.name === char.name);
                        if (!existing) {
                            if (!char.id) char.id = 'pregen-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
                            state.characters.push(char);
                            added++;
                        }
                        if (char.recommendedFor === 'Jump to the Action') {
                            featuredCharacter = existing || char;
                        }
                    });
                    if (!featuredCharacter) featuredCharacter = state.characters.find(c => chars.some(pc => pc.name === c.name)) || chars[0];
                    if (added > 0) {
                        saveState();
                        console.log(`[QuickStart] Added ${added} pre-gens.`);
                    }
                }
            } else {
                console.warn('[QuickStart] Pre-gen fetch failed with status:', response.status);
                showToast('Could not load pre‑gens (HTTP ' + response.status + ').', 'warning');
            }
        } catch (e) {
            console.warn('[QuickStart] Pre‑gen load error:', e);
            // Non‑fatal — the adventure can still start without a character.
        }

        // 4. Start the adventure
        console.log('[QuickStart] Calling startAdventure...');
        const started = advModule.startAdventure('lantern_at_dusk');
        console.log('[QuickStart] startAdventure returned:', started);
        if (!started) {
            console.error('[QuickStart] startAdventure failed.');
            showToast('Failed to start adventure. Check console for errors.', 'error');
            return null;
        }

        console.log('[QuickStart] Quick start completed successfully.');
        return { character: featuredCharacter, adventure };

    } catch (error) {
        console.error('[QuickStart] Unhandled error:', error);
        showToast('Quick Start failed: ' + (error.message || 'unknown error'), 'error');
        return null;
    }
}

/**
 * Fallback path for triggering Jump to the Action somewhere the welcome
 * overlay isn't present to show its own confirmation pane (e.g. a future
 * button elsewhere in the app) — does the same setup, then falls back to a
 * toast + direct navigation instead of the in-overlay confirmation step.
 */
async function quickStartAndGo() {
    const result = await quickStart();
    if (!result) return;
    markWelcomeSeen();
    window.location.hash = 'adventure-manager';
    const who = result.character ? ` as ${result.character.name}` : '';
    showToast(`🚀 Launched "${result.adventure.title}"${who}!`, 'success');
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

/** Scroll to any slide by its ID */
function scrollToSlide(id) {
  const target = document.getElementById(id);
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
    e.preventDefault();
    scrollToSlide('slide-rules');
  } else if (action === 'toolkit-link') {
    e.preventDefault();
    scrollToSlide('slide-toolkit');
  } else if (action === 'quick-start') {
    e.preventDefault();
    // The overlay's own click listener (added in showWelcomeOverlay) already
    // handles this exact click since the overlay lives inside this same
    // delegated container — don't also fire it here, or Jump to the Action
    // runs twice. runQuickStart()'s quickStartInFlight guard makes this a
    // no-op if it somehow does double-fire, but avoid it outright: only
    // handle this action here for the case where the quick-start button
    // was reached some other way (no overlay present).
    if (!document.getElementById('welcome-overlay')) {
      quickStartAndGo();
    }
  } else if (action === 'dismiss-welcome') {
    e.preventDefault();
    const overlay = document.getElementById('welcome-overlay');
    if (overlay) {
      overlay.remove();
      overlayShown = false;
    }
    markWelcomeSeen();
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
  attachEvents();
  // Show welcome overlay if not seen
  checkWelcomeOverlay();
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