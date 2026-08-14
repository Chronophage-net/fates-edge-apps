import{i as r}from"./utils.lBShoim5.js";import{b as d}from"./state.42sFgcOQ.js";import{n as f}from"./Toast.DDAtBIAw.js";var h=null,l=null;function w(t){h=t,h.innerHTML=`
        <div class="dashboard-modern-layout">
            <!-- Header -->
            <header class="dashboard-header">
                <h1 class="page-title">📊 Campaign Dashboard</h1>
                <p class="page-sub">Quick overview of your campaign state and tools.</p>
                <div class="dashboard-status-bar">
                    <span class="status-badge" id="dash-status">● Live</span>
                    <span class="status-badge" id="dash-sync-status">● Local</span>
                    <span class="status-badge" id="dash-timestamp">Updated: ${new Date().toLocaleTimeString()}</span>
                </div>
            </header>

            <!-- Stats Grid -->
            <div class="dashboard-stats-grid" id="dash-stats">
                ${v()}
            </div>

            <!-- Quick Actions (Player‑Facing) -->
            <div class="panel" id="dash-actions-panel">
                <div class="panel-header">
                    <h3 class="panel-title">⚡ Quick Actions</h3>
                    <div class="panel-actions">
                        <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                    </div>
                </div>
                
                <!-- Quick Action Buttons -->
                <div class="quick-actions-grid">
                    <button class="quick-action-btn" onclick="window.sceneEndTrimBoons()">
                        <span class="qa-icon">✂️</span>
                        <span class="qa-label">Trim Boons</span>
                        <span class="qa-desc">Set all Boons to 2</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.resetAllTimers()">
                        <span class="qa-icon">⏱️</span>
                        <span class="qa-label">Reset Timers</span>
                        <span class="qa-desc">Zero all timers</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.newSession()">
                        <span class="qa-icon">📦</span>
                        <span class="qa-label">New Session</span>
                        <span class="qa-desc">Archive and reset</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.openCombatTracker()">
                        <span class="qa-icon">⚔️</span>
                        <span class="qa-label">Combat Tracker</span>
                        <span class="qa-desc">Open combat tracker</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.location.hash='dice'">
                        <span class="qa-icon">🎲</span>
                        <span class="qa-label">Dice Roller</span>
                        <span class="qa-desc">Roll some dice</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.location.hash='vtt'">
                        <span class="qa-icon">🌐</span>
                        <span class="qa-label">VTT</span>
                        <span class="qa-desc">Virtual Tabletop</span>
                    </button>
                    <button class="quick-action-btn" onclick="window.location.hash='whiteboard'">
                        <span class="qa-icon">✏️</span>
                        <span class="qa-label">Whiteboard</span>
                        <span class="qa-desc">Visual planning</span>
                    </button>
                </div>
            </div>

            <!-- Main Grid -->
            <div class="dashboard-main-grid">
                <!-- Left Column -->
                <div class="dashboard-left">
                    <!-- Characters -->
                    <div class="panel" id="dash-characters-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">👤 Characters</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.openCharacterBuilder()">+ New</button>
                            </div>
                        </div>
                        <div id="dash-chars"><span class="text-muted">Loading…</span></div>
                    </div>

                    <!-- Active Timers -->
                    <div class="panel" id="dash-timers-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">⏱️ Active Timers</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.addTimerFromDash()">+ Add</button>
                            </div>
                        </div>
                        <div id="dash-timers"><span class="text-muted">No active timers.</span></div>
                    </div>

                    <!-- Active Encounters -->
                    <div class="panel" id="dash-encounters-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">⚔️ Active Encounters</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.addEncounterFromDash()">+ Add</button>
                            </div>
                        </div>
                        <div id="dash-encounters"><span class="text-muted">No active encounters.</span></div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="dashboard-right">
                    <!-- Factions -->
                    <div class="panel" id="dash-factions-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">🏛️ Factions</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.openFactions()">View All</button>
                            </div>
                        </div>
                        <div id="dash-factions"><span class="text-muted">No factions tracked.</span></div>
                    </div>

                    <!-- Patrons -->
                    <div class="panel" id="dash-patrons-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">🌟 Patrons</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.openPatrons()">View All</button>
                            </div>
                        </div>
                        <div id="dash-patrons"><span class="text-muted">No patrons loaded.</span></div>
                    </div>

                    <!-- Followers & Assets -->
                    <div class="panel" id="dash-followers-assets-panel">
                        <div class="panel-header">
                            <h3 class="panel-title">👤 Followers & 📦 Assets</h3>
                            <div class="panel-actions">
                                <button class="btn btn-sm btn-ghost" onclick="window.dashboardRefresh()">🔄</button>
                                <button class="btn btn-sm btn-primary" onclick="window.openFactions()">Manage</button>
                            </div>
                        </div>
                        <div id="dash-followers-assets"><span class="text-muted">No followers or assets.</span></div>
                    </div>
                </div>
            </div>
        </div>
    `,x(),p(),g()}function x(){const t="dashboard-modern-styles";if(document.getElementById(t))return;const n=document.createElement("style");n.id=t,n.textContent=`
        /* Dashboard Modern Layout */
        .dashboard-modern-layout {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding: 0.5rem 0;
        }
        
        .dashboard-header {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: var(--bg2);
            border-radius: var(--radius);
            border: 1px solid var(--border);
        }
        
        .dashboard-status-bar {
            display: flex;
            gap: 0.8rem;
            font-size: 0.7rem;
            color: var(--text2);
            background: var(--bg3);
            padding: 0.2rem 0.8rem;
            border-radius: 20px;
        }
        
        .dashboard-status-bar .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
        }
        
        .dashboard-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.8rem;
        }
        
        .stat-card {
            background: var(--bg2);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 0.8rem 0.6rem;
            text-align: center;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        
        .stat-card::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--gold), var(--accent), var(--gold));
            opacity: 0.3;
        }
        
        .stat-card:hover {
            transform: translateY(-2px);
            border-color: var(--gold);
            box-shadow: 0 4px 20px rgba(212,175,55,0.15);
        }
        
        .stat-icon {
            display: block;
            font-size: 1.8rem;
            margin-bottom: 0.2rem;
        }
        
        .stat-value {
            display: block;
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--gold);
            line-height: 1.2;
        }
        
        .stat-label {
            display: block;
            font-size: 0.7rem;
            color: var(--text2);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-top: 0.15rem;
        }
        
        .stat-sub {
            display: block;
            font-size: 0.6rem;
            color: var(--text3);
            margin-top: 0.1rem;
        }
        
        .dashboard-main-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        
        @media (max-width: 768px) {
            .dashboard-main-grid {
                grid-template-columns: 1fr;
            }
        }
        
        .panel {
            background: var(--bg2);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 0.8rem 1rem;
        }
        
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        
        .panel-title {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text);
        }
        
        .panel-actions {
            display: flex;
            gap: 0.3rem;
        }
        
        .quick-actions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 0.4rem;
            margin: 0.5rem 0 0.2rem;
        }
        
        .quick-action-btn {
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 0.4rem 0.6rem;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            color: var(--text);
            font-family: var(--font);
        }
        
        .quick-action-btn:hover {
            border-color: var(--gold);
            background: var(--bg4);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .qa-icon {
            font-size: 1.4rem;
            line-height: 1.2;
        }
        
        .qa-label {
            font-size: 0.75rem;
            font-weight: 600;
            margin: 0.1rem 0;
        }
        
        .qa-desc {
            font-size: 0.6rem;
            color: var(--text2);
        }
        
        /* Dashboard items */
        .dashboard-char-item, .dashboard-timer-item, .dashboard-encounter-item,
        .dashboard-faction-item, .dashboard-patron-item {
            padding: 0.3rem 0.4rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.2rem 0.5rem;
            cursor: pointer;
            transition: background 0.15s;
        }
        
        .dashboard-char-item:hover, .dashboard-encounter-item:hover,
        .dashboard-faction-item:hover, .dashboard-patron-item:hover {
            background: var(--bg3);
        }
        
        .char-info, .encounter-info, .faction-info, .patron-info {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            flex-wrap: wrap;
        }
        
        .char-name, .encounter-name, .faction-name, .patron-name {
            font-weight: 500;
            color: var(--text);
        }
        
        .char-detail, .encounter-location, .patron-domain {
            font-size: 0.7rem;
            color: var(--text2);
        }
        
        .char-stats, .encounter-detail {
            display: flex;
            gap: 0.4rem;
            align-items: center;
        }
        
        .char-stat {
            font-size: 0.7rem;
            padding: 0.05rem 0.3rem;
            border-radius: 12px;
            background: var(--bg3);
            color: var(--text2);
        }
        
        .char-stat.boon-high { color: var(--gold); }
        .char-stat.boon-mid { color: #8ac49a; }
        .char-stat.boon-low { color: var(--text3); }
        .char-stat.fatigue-high { color: var(--red); }
        .char-stat.fatigue-mid { color: var(--orange); }
        .char-stat.fatigue-low { color: var(--text3); }
        .char-stat.harm { color: var(--red); }
        .char-stat.vtt { color: var(--green); }
        
        .timer-info {
            display: flex;
            justify-content: space-between;
            width: 100%;
        }
        
        .timer-name {
            font-weight: 500;
            color: var(--text);
            font-size: 0.85rem;
        }
        
        .timer-progress-text {
            font-size: 0.7rem;
            color: var(--text2);
        }
        
        .timer-bar-track {
            width: 100%;
            height: 4px;
            background: var(--bg4);
            border-radius: 2px;
            overflow: hidden;
            margin: 0.15rem 0;
        }
        
        .timer-bar-fill {
            height: 100%;
            background: var(--gold);
            border-radius: 2px;
            transition: width 0.3s ease;
        }
        
        .timer-bar-fill.urgent {
            background: var(--red);
            animation: pulse-urgent 1s ease-in-out infinite;
        }
        
        @keyframes pulse-urgent {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .timer-actions {
            display: flex;
            gap: 0.2rem;
        }
        
        .encounter-status {
            font-size: 0.6rem;
            text-transform: uppercase;
            padding: 0.05rem 0.5rem;
            border-radius: 12px;
            font-weight: 600;
        }
        
        .encounter-status.active { background: var(--green); color: #fff; }
        .encounter-status.resolved { background: var(--gold); color: #1a1a2e; }
        .encounter-status.failed { background: var(--red); color: #fff; }
        
        .faction-standing {
            font-size: 0.6rem;
            text-transform: uppercase;
            padding: 0.05rem 0.5rem;
            border-radius: 12px;
            background: var(--bg4);
        }
        
        .faction-agenda {
            font-size: 0.7rem;
            color: var(--text2);
            flex: 1 1 100%;
            margin-top: 0.1rem;
        }
        
        .faction-timer-mini {
            font-size: 0.6rem;
            color: var(--text3);
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }
        
        .timer-bar-track.mini {
            width: 60px;
            height: 3px;
        }
        
        .dash-followers-list, .dash-assets-list {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
        }
        
        .dash-follower-item, .dash-asset-item {
            display: flex;
            gap: 0.4rem;
            font-size: 0.8rem;
            align-items: center;
            padding: 0.1rem 0.2rem;
        }
        
        .follower-name, .asset-name {
            font-weight: 500;
        }
        
        .follower-cap, .asset-tier {
            background: var(--bg4);
            padding: 0.05rem 0.4rem;
            border-radius: 10px;
            font-size: 0.6rem;
            color: var(--text2);
        }
        
        .follower-state, .asset-status {
            font-size: 0.6rem;
        }
    `,document.head.appendChild(n)}function v(){const t=d(),n=t.characters||[],o=t.timers||[],a=t.encounters||[],s=t.factions?.factions||[],e=t.patrons?.cosmic||[],i=t.factions?.followers||[],c=t.factions?.assets||[],m=o.filter(u=>u.current<u.segments),b=o.filter(u=>u.current>=u.segments);return`
        <div class="stat-card">
            <span class="stat-icon">👤</span>
            <span class="stat-value">${n.length}</span>
            <span class="stat-label">Characters</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">⏱️</span>
            <span class="stat-value">${m.length}</span>
            <span class="stat-label">Active Timers</span>
            <span class="stat-sub">${b.length} completed</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">⚔️</span>
            <span class="stat-value">${a.length}</span>
            <span class="stat-label">Encounters</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">🏛️</span>
            <span class="stat-value">${s.length}</span>
            <span class="stat-label">Factions</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">🌟</span>
            <span class="stat-value">${e.length}</span>
            <span class="stat-label">Patrons</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">👤</span>
            <span class="stat-value">${i.length}</span>
            <span class="stat-label">Followers</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">📦</span>
            <span class="stat-value">${c.length}</span>
            <span class="stat-label">Assets</span>
        </div>
        <div class="stat-card">
            <span class="stat-icon">📊</span>
            <span class="stat-value">${t.rollHistory?.length||0}</span>
            <span class="stat-label">Rolls</span>
            <span class="stat-sub">${t.chatHistory?.length||0} chat</span>
        </div>
    `}function p(){k(),y(),$(),T(),q(),C(),E()}function k(){const t=d(),n=document.getElementById("dash-chars");if(!n)return;const o=t.characters||[];if(o.length===0){n.innerHTML='<span class="text-muted">No characters yet. Create one in the Character Builder!</span>';return}n.innerHTML=o.map(a=>{const s=a.boons||0,e=a.fatigue||0,i=a.harm||0,c=s>=3?"boon-high":s>=1?"boon-mid":"boon-low",m=e>=3?"fatigue-high":e>=1?"fatigue-mid":"fatigue-low";return`
            <div class="dashboard-char-item" onclick="window.openCharacter('${a.id}')">
                <div class="char-info">
                    <span class="char-name">${r(a.name||"Unnamed")}</span>
                    <span class="char-detail">${r(a.heritage||"")} · Tier ${a.tier||"I"}</span>
                </div>
                <div class="char-stats">
                    <span class="char-stat boon ${c}" title="Boons">🪙 ${s}</span>
                    <span class="char-stat fatigue ${m}" title="Fatigue">⚡ ${e}</span>
                    <span class="char-stat harm" title="Harm">❤️ ${i}</span>
                    ${a.vtt?'<span class="char-stat vtt" title="VTT Connected">🟢</span>':""}
                </div>
            </div>
        `}).join("")}function y(){const t=d(),n=document.getElementById("dash-timers");if(!n)return;const o=t.timers||[],a=o.filter(s=>s.current<s.segments);if(a.length===0){const s=o.filter(e=>e.current>=e.segments);n.innerHTML=`<span class="text-muted">No active timers.${s.length>0?` ${s.length} completed.`:""}</span>`;return}n.innerHTML=a.map(s=>{const e=s.current/s.segments*100,i=e>=80;return`
            <div class="dashboard-timer-item">
                <div class="timer-info">
                    <span class="timer-name">${r(s.name)}</span>
                    <span class="timer-progress-text">${s.current}/${s.segments}</span>
                </div>
                <div class="timer-bar-track">
                    <div class="timer-bar-fill ${i?"urgent":""}" style="width:${e}%;"></div>
                </div>
                <div class="timer-actions">
                    <button class="btn btn-xs btn-ghost" onclick="window.tickTimer('${s.id}')">+1</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.completeTimer('${s.id}')">✓</button>
                </div>
            </div>
        `}).join("")}function $(){const t=d(),n=document.getElementById("dash-encounters");if(!n)return;const o=t.encounters||[];if(o.length===0){n.innerHTML='<span class="text-muted">No active encounters. Create one in the Encounters module!</span>';return}n.innerHTML=o.slice(0,5).map(a=>{const s=a.status||"active",e=s==="active"?"active":s==="resolved"?"resolved":"failed",i=a.adversaries?.length||0;return`
            <div class="dashboard-encounter-item" onclick="window.openEncounter('${a.id}')">
                <div class="encounter-info">
                    <span class="encounter-name">${r(a.name)}</span>
                    <span class="encounter-status ${e}">${s}</span>
                </div>
                <div class="encounter-detail">
                    <span class="encounter-adversaries">👾 ${i} adversaries</span>
                    ${a.location?`<span class="encounter-location">📍 ${r(a.location)}</span>`:""}
                </div>
                <div class="encounter-actions">
                    <button class="btn btn-xs btn-primary" onclick="event.stopPropagation();window.openCombatTrackerForEncounter('${a.id}')">⚔️ Track</button>
                </div>
            </div>
        `}).join("")}function T(){const t=d(),n=document.getElementById("dash-factions");if(!n)return;const o=t.factions?.factions||[];if(o.length===0){n.innerHTML='<span class="text-muted">No factions tracked. Add some in the Factions module!</span>';return}n.innerHTML=o.slice(0,4).map(a=>{const s=a.standing||0,e=s>=2?"ally":s>=1?"friendly":s>=0?"neutral":s>=-1?"unfriendly":"hostile",i=s>=2?"var(--green)":s>=1?"#8ac49a":s>=0?"var(--text2)":s>=-1?"var(--orange)":"var(--red)";return`
            <div class="dashboard-faction-item" onclick="window.openFactionDetail('${a.id}')">
                <div class="faction-info">
                    <span class="faction-icon">${a.icon||"🏛️"}</span>
                    <span class="faction-name">${r(a.name)}</span>
                    <span class="faction-standing" style="color:${i};">${e}</span>
                </div>
                <div class="faction-agenda">${r(a.agenda||"No agenda")}</div>
                <div class="faction-timer-mini">
                    ⏱️ ${a.agendaTimer?.current||0}/${a.agendaTimer?.segments||6}
                    <div class="timer-bar-track mini">
                        <div class="timer-bar-fill" style="width:${(a.agendaTimer?.current||0)/(a.agendaTimer?.segments||6)*100}%;"></div>
                    </div>
                </div>
            </div>
        `}).join("")}function q(){const t=d(),n=document.getElementById("dash-patrons");if(!n)return;const o=t.patrons?.cosmic||[];if(o.length===0){n.innerHTML='<span class="text-muted">No patrons loaded. Add some in the Patrons module!</span>';return}n.innerHTML=o.slice(0,4).map(a=>{const s=a.rites?.length||0,e=a.rivals?.length||0;return`
            <div class="dashboard-patron-item" onclick="window.openPatronDetail('${a.id}')">
                <div class="patron-info">
                    <span class="patron-icon">${a.icon||"🌟"}</span>
                    <span class="patron-name">${r(a.name)}</span>
                    <span class="patron-domain">${r(a.domain||"")}</span>
                </div>
                <div class="patron-detail">
                    <span class="patron-rites">🔮 ${s} rites</span>
                    ${e>0?`<span class="patron-rivals">⚔️ ${e} rivals</span>`:""}
                </div>
            </div>
        `}).join("")}function C(){const t=d(),n=document.getElementById("dash-followers-assets");if(!n)return;const o=t.factions?.followers||[],a=t.factions?.assets||[];if(o.length===0&&a.length===0){n.innerHTML='<span class="text-muted">No followers or assets tracked. Manage them in the Factions module!</span>';return}let s="";o.length>0&&(s+='<div class="dash-followers-list">',o.slice(0,3).forEach(e=>{const i=e.loyalty||"faithful",c=e.fitness||"ready",m=i==="faithful"?"💚":i==="strained"?"⚠️":"💔",b=c==="ready"?"✅":c==="hurt"?"🩹":"❌";s+=`
                <div class="dash-follower-item">
                    <span class="follower-name">${r(e.name)}</span>
                    <span class="follower-cap">Cap ${e.cap||1}</span>
                    <span class="follower-state">${m} ${i}</span>
                    <span class="follower-state">${b} ${c}</span>
                </div>
            `}),s+="</div>"),a.length>0&&(s+='<div class="dash-assets-list">',a.slice(0,3).forEach(e=>{const i=e.status||"maintained",c=i==="maintained"?"✅":i==="neglected"?"⚠️":"❌";s+=`
                <div class="dash-asset-item">
                    <span class="asset-name">${r(e.name)}</span>
                    <span class="asset-tier">${e.tier||"Minor"}</span>
                    <span class="asset-status">${c} ${i}</span>
                </div>
            `}),s+="</div>"),n.innerHTML=s}function E(){const t=document.getElementById("dash-stats");t&&(t.innerHTML=v())}function g(){l&&clearInterval(l),l=setInterval(()=>{p()},3e4)}window.dashboardRefresh=function(){p(),f("🔄 Dashboard refreshed","info")};function D(){}function A(){console.log("[Dashboard] Activated"),p(),g()}function L(){console.log("[Dashboard] Deactivated"),l&&(clearInterval(l),l=null)}function z(){p()}function H(){l&&(clearInterval(l),l=null),h=null}var I={render:w,destroy:H,onActivate:A,onDeactivate:L,refresh:z,update:p};export{D as attachEvents,I as default,H as destroy,A as onActivate,L as onDeactivate,z as refresh,w as render,p as update};
