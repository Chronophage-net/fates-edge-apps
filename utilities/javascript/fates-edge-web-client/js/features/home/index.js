/**
 * Home feature module
 */

import { showToast } from '../../components/Toast.js';

let container = null;

/**
 * Render the home tab
 */
export function render(el) {
    container = el;
    
    container.innerHTML = `
        <div class="home-hero">
            <div>
                <div style="display:inline-block;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.2);padding:6px 20px;border-radius:100px;font-size:0.75rem;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);margin-bottom:1rem;">⚔️ Narrative-First TTRPG</div>
                <h1 style="font-size:clamp(2.6rem,8vw,4.2rem);line-height:1.1;font-weight:700;color:var(--gold);"><span class="gold">Fate's</span> Edge</h1>
                <p style="font-size:1.2rem;color:var(--text2);max-width:620px;margin:0 auto 1.5rem;">Fortune favors the bold, but the wise know when to fold.<br /><span style="color:var(--text2);font-size:0.9rem;">— Captain Livia Vex</span></p>
                
                <div style="margin:1.5rem 0;padding:1.5rem;background:rgba(201,168,76,0.05);border-radius:var(--radius);border:1px solid rgba(201,168,76,0.1);">
                    <p style="color:var(--text);font-style:italic;margin:0;text-align:center;">"Every choice carries weight. Every debt echoes forward. Every road remembers."</p>
                </div>
                
                <div style="margin-top:1.5rem;display:flex;flex-wrap:wrap;gap:0.8rem;justify-content:center;">
                    <a href="#home-core" class="btn btn-gold" style="text-decoration:none;">Learn the Core</a>
                    <a href="#" class="btn btn-primary" style="text-decoration:none;" id="home-create-char">Create a Character</a>
                </div>
                <div style="margin-top:2rem;font-style:italic;color:var(--text2);border-top:1px solid var(--border);padding-top:1.5rem;max-width:560px;margin-left:auto;margin-right:auto;">
                    "The road remembers. Every broken wheel leaves a mark, every lit lamp bears witness. The only question is: what are you willing to owe?"
                    <cite style="display:block;font-style:normal;color:var(--gold);margin-top:4px;">— Dusana of the Raven Road, <em>The Hearth Ledger</em></cite>
                </div>
            </div>
        </div>
        
        <div class="home-section" id="home-core">
            <h2 style="font-size:1.8rem;color:var(--gold);margin-bottom:1rem;position:relative;display:inline-block;">Core Mechanics</h2>
            <p style="color:var(--text2);">Every important action follows a simple, dramatic loop.</p>
            
            <div style="margin:1.5rem 0;padding:1rem;background:var(--bg2);border-radius:var(--radius);border-left:3px solid var(--gold);">
                <p style="margin:0;color:var(--text);">🎲 <strong>The Golden Rule:</strong> When in doubt, make the choice that serves the story. Set DV=3, Position=Controlled, and let the dice fall.</p>
            </div>
            
            <div class="home-mech-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-top:1rem;">
                <div class="home-mech-item" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;text-align:center;transition:all 0.2s;">
                    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--text2);">Dice Pool</div>
                    <div style="font-size:1.6rem;font-weight:700;color:var(--gold);margin:0.2rem 0;">Attribute + Skill</div>
                    <div style="font-size:0.8rem;color:var(--text2);">Roll d10s. 6+ = success. 10 = 2 successes.</div>
                </div>
                <div class="home-mech-item" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;text-align:center;transition:all 0.2s;">
                    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--text2);">Difficulty (DV)</div>
                    <div style="font-size:1.6rem;font-weight:700;color:var(--gold);margin:0.2rem 0;">2–5+</div>
                    <div style="font-size:0.8rem;color:var(--text2);">2 = routine · 3 = default · 4 = hard · 5+ = extreme</div>
                </div>
                <div class="home-mech-item" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;text-align:center;transition:all 0.2s;">
                    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--text2);">Position</div>
                    <div style="font-size:1.2rem;font-weight:700;color:var(--gold);margin:0.2rem 0;">Dominant · Controlled · Desperate</div>
                    <div style="font-size:0.8rem;color:var(--text2);">Re-roll 1 failure · normal · re-roll 1 success</div>
                </div>
                <div class="home-mech-item" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;text-align:center;transition:all 0.2s;">
                    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--text2);">Boons</div>
                    <div style="font-size:1.6rem;font-weight:700;color:var(--gold);margin:0.2rem 0;">⚡ 1–5</div>
                    <div style="font-size:0.8rem;color:var(--text2);">Earn on Partial (1) or Miss (2). Spend to re-roll, improve Position, activate Assets.</div>
                </div>
            </div>
            
            <div style="margin-top:1.5rem;">
                <h3 style="text-align:center;font-size:1.2rem;color:var(--gold);">Outcome Matrix</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.9rem;">
                        <thead>
                            <tr>
                                <th style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;background:rgba(201,168,76,0.06);font-weight:600;color:var(--gold);">Result</th>
                                <th style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;background:rgba(201,168,76,0.06);font-weight:600;color:var(--gold);">Outcome</th>
                                <th style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;background:rgba(201,168,76,0.06);font-weight:600;color:var(--gold);">What Happens</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;color:var(--gold-light);">S ≥ DV, SB = 0</td>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;"><strong>Clean Success</strong></td>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;">You get what you want, no cost.</td>
                            </tr>
                            <tr>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;color:var(--gold-light);">S ≥ DV, SB > 0</td>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;"><strong>Success with SB</strong></td>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;">You succeed, but the world pushes back.</td>
                            </tr>
                            <tr>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;color:var(--gold-light);">0 < S < DV</td>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;"><strong>Partial</strong></td>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;">You make progress — gain <strong>1 Boon</strong>.</td>
                            </tr>
                            <tr>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;color:var(--gold-light);">S = 0</td>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;"><strong>Miss</strong></td>
                                <td style="padding:0.6rem 1rem;border:1px solid var(--border);text-align:left;">You fail, things get worse — gain <strong>2 Boons</strong>.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style="margin:1rem 0;padding:1rem;background:var(--bg3);border-radius:var(--radius);border-left:2px solid var(--gold);">
                    <p style="margin:0;color:var(--text2);font-size:0.85rem;">💡 <strong>Pro Tip:</strong> A Partial is not failure — it's meaningful progress. A Miss is never "nothing happens" — the GM must introduce a complication.</p>
                </div>
                <p class="text-muted" style="font-size:0.8rem;margin-top:0.3rem;">SB = Story Beats — each die showing a <strong>1</strong> gives the GM a Story Beat to spend on complications.</p>
            </div>
        </div>
        
        <div class="home-section" id="home-create" style="background:rgba(20,17,17,0.3);border-radius:var(--radius);padding:2rem 1.5rem;margin-top:1rem;">
            <h2 style="font-size:1.8rem;color:var(--gold);margin-bottom:1rem;position:relative;display:inline-block;">Character Creation</h2>
            <p style="color:var(--text2);">Build a character in about 10–15 minutes. Start with 32 XP.</p>
            
            <div style="margin:1.5rem 0;padding:1rem;background:rgba(201,168,76,0.08);border-radius:var(--radius);border:1px solid rgba(201,168,76,0.2);">
                <p style="margin:0;color:var(--text);text-align:center;">🧙 <strong>Quick Start:</strong> Concept → Attributes (Body/Wits/Spirit/Presence) → Skills → Talents → Bonds & Complications</p>
            </div>
            
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.2rem;margin-top:1.2rem;">
                <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.2rem;transition:all 0.2s;">
                    <span style="font-size:2rem;display:block;margin-bottom:0.4rem;">🧬</span>
                    <h3 style="color:var(--gold);font-size:1.1rem;">Attributes</h3>
                    <p style="color:var(--text2);font-size:0.92rem;"><strong>Body</strong> · <strong>Wits</strong> · <strong>Spirit</strong> · <strong>Presence</strong><br />Rated 1–5. Cost: new rating × 3 XP per step.</p>
                    <p style="color:var(--text3);font-size:0.8rem;margin-top:0.5rem;">Example: Body 3 costs 15 XP total</p>
                </div>
                <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.2rem;transition:all 0.2s;">
                    <span style="font-size:2rem;display:block;margin-bottom:0.4rem;">📚</span>
                    <h3 style="color:var(--gold);font-size:1.1rem;">Skills</h3>
                    <p style="color:var(--text2);font-size:0.92rem;">Sixteen core skills. Rated 0–5. Cost: new level × 2 XP per step.</p>
                    <p style="color:var(--text3);font-size:0.8rem;margin-top:0.5rem;">Melee, Stealth, Lore, Arcana, and more</p>
                </div>
                <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.2rem;transition:all 0.2s;">
                    <span style="font-size:2rem;display:block;margin-bottom:0.4rem;">✨</span>
                    <h3 style="color:var(--gold);font-size:1.1rem;">Talents</h3>
                    <p style="color:var(--text2);font-size:0.92rem;">Special abilities. Minor (2–3 XP), Major (4–6 XP), Prestige (7–10 XP).</p>
                    <p style="color:var(--text3);font-size:0.8rem;margin-top:0.5rem;">Keen Senses, Weapon Mastery, Silver Tongue</p>
                </div>
                <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.2rem;transition:all 0.2s;">
                    <span style="font-size:2rem;display:block;margin-bottom:0.4rem;">🔗</span>
                    <h3 style="color:var(--gold);font-size:1.1rem;">Bonds & Complications</h3>
                    <p style="color:var(--text2);font-size:0.92rem;">Up to 2 Bonds (+2 XP each) and 2 Complications (+2 XP each) for max 36 XP.</p>
                    <p style="color:var(--text3);font-size:0.8rem;margin-top:0.5rem;">"I saved your life" or "The magistrate still hunts me"</p>
                </div>
            </div>
            
            <div style="margin-top:1.5rem;text-align:center;">
                <button class="btn btn-primary" id="home-create-char-btn" style="margin:0 auto;">🚀 Start Building Your Character</button>
            </div>
        </div>
        
        <div class="home-section" style="margin-top:2rem;padding:2rem 1.5rem;background:var(--bg2);border-radius:var(--radius);border:1px solid var(--border);">
            <h2 style="font-size:1.8rem;color:var(--gold);margin-bottom:1rem;text-align:center;">Why Fate's Edge?</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;">
                <div style="text-align:center;">
                    <span style="font-size:2rem;display:block;margin-bottom:0.5rem;">📜</span>
                    <h3 style="color:var(--gold);margin-bottom:0.5rem;">Narrative First</h3>
                    <p style="color:var(--text2);font-size:0.9rem;">Mechanics serve the story, not the other way around. Every roll asks "what happens next?"</p>
                </div>
                <div style="text-align:center;">
                    <span style="font-size:2rem;display:block;margin-bottom:0.5rem;">⚔️</span>
                    <h3 style="color:var(--gold);margin-bottom:0.5rem;">Meaningful Risk</h3>
                    <p style="color:var(--text2);font-size:0.9rem;">Safety is boring. Risk creates drama. Story Beats fuel an unpredictable, responsive narrative.</p>
                </div>
                <div style="text-align:center;">
                    <span style="font-size:2rem;display:block;margin-bottom:0.5rem;">⚡</span>
                    <h3 style="color:var(--gold);margin-bottom:0.5rem;">Scalable Complexity</h3>
                    <p style="color:var(--text2);font-size:0.9rem;">Start simple, discover naturally. Same core rules handle intimate scenes and epic narratives.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Attach event listeners
 */
export function attachEvents() {
    const createBtn = document.getElementById('home-create-char');
    const createBtn2 = document.getElementById('home-create-char-btn');
    
    function navigateToBuilder() {
        // Navigate to builder tab
        const builderBtn = document.querySelector('.sidebar-nav button[data-tab="builder"]');
        if (builderBtn) builderBtn.click();
    }
    
    if (createBtn) {
        createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToBuilder();
        });
    }
    
    if (createBtn2) {
        createBtn2.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToBuilder();
        });
    }
}
