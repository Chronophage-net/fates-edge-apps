import{i as o}from"./utils.lBShoim5.js";import{D,b as $}from"./state.42sFgcOQ.js";import{n as l}from"./Toast.DDAtBIAw.js";var y="./data/factions/",E=["velvet-court","iron-league","gray-ash","ecktorian-censorate","bloody-fist","house-contarini","the-silver-fang","crimson-rose-syndicate","order-of-the-iron-covenant","whispering-net","ashen-syndicate","the-velvet-coin"],v={"-3":{label:"Enemy",color:"#c45a5a",icon:"💀",desc:"Actively works against the party"},"-2":{label:"Hostile",color:"#d97a7a",icon:"⚔️",desc:"Openly opposes the party"},"-1":{label:"Unfriendly",color:"#e8a07a",icon:"👎",desc:"Distrustful and difficult"},0:{label:"Neutral",color:"#a8a4b8",icon:"➖",desc:"Indifferent"},1:{label:"Friendly",color:"#8ac49a",icon:"👍",desc:"Generally helpful"},2:{label:"Supportive",color:"#6baa7a",icon:"🤝",desc:"Actively aids the party"},3:{label:"Ally",color:"#4a8a5a",icon:"💚",desc:"Will sacrifice for the party"}},k={maintained:{label:"Maintained",color:"#6baa7a",icon:"✅"},neglected:{label:"Neglected",color:"#e8c84a",icon:"⚠️"},compromised:{label:"Compromised",color:"#c45a5a",icon:"❌"}},w={loyalty:{faithful:{label:"Faithful",color:"#6baa7a",icon:"💚"},strained:{label:"Strained",color:"#e8c84a",icon:"⚠️"},broken:{label:"Broken",color:"#c45a5a",icon:"💔"}},fitness:{ready:{label:"Ready",color:"#6baa7a",icon:"✅"},hurt:{label:"Hurt",color:"#e8c84a",icon:"🩹"},down:{label:"Down",color:"#c45a5a",icon:"❌"}}},g="fates-edge-factions-cache",I=36e5;async function P(){try{const s=localStorage.getItem(g);if(s){const n=JSON.parse(s);if(Date.now()-n.timestamp<I)return console.log(`[Factions] Using cached list (${n.slugs.length} factions)`),n.slugs}}catch{}console.log("[Factions] Discovering available factions...");const t=[];let e=E;try{const s=await fetch(`${y}manifest.json`);if(s.ok){const n=await s.json();Array.isArray(n)&&n.length>0&&(e=n)}}catch{}await Promise.all(e.map(async s=>{try{(await fetch(`${y}${s}.json`,{method:"HEAD"})).ok&&t.push(s)}catch{}})),t.sort();try{localStorage.setItem(g,JSON.stringify({slugs:t,timestamp:Date.now()}))}catch{}return console.log(`[Factions] Found ${t.length} factions`),t}var j=[{id:"velvet-court",name:"The Velvet Court",standing:0,agenda:"Control Silkstrand's underworld",agendaTimer:{segments:6,current:0},keyNPCs:["Madam Serafine","Old Kes","Sister Agatha"],resources:"Information network, forgery, laundering",hooks:["A rival faction is moving into the Dye District"],color:"#8b6bb5",icon:"🎭",source:"default"},{id:"iron-league",name:"The Iron League",standing:0,agenda:"Consolidate mercenary contracts",agendaTimer:{segments:8,current:2},keyNPCs:["The Black Colonel","Captain Rusk"],resources:"Mercenary companies, military intelligence",hooks:["Payday is late - morale is dropping"],color:"#c45a5a",icon:"⚔️",source:"default"},{id:"gray-ash",name:"Gray Ash Ykrul",standing:1,agenda:"Secure winter grazing lands",agendaTimer:{segments:6,current:0},keyNPCs:["Khatun Sarnai","Yelü"],resources:"Steppe riders, remounts, steppe knowledge",hooks:["A white squall is coming"],color:"#5a8ab5",icon:"🐺",source:"default"},{id:"ecktorian-censorate",name:"Ecktorian Censorate",standing:-1,agenda:"Root out heresy and illegal magic",agendaTimer:{segments:10,current:4},keyNPCs:["Censor Cassia","Prefect Marcellus"],resources:"Legal authority, archive access, witch-hunters",hooks:["They are investigating the party's activities"],color:"#d48a5a",icon:"⚖️",source:"default"},{id:"bloody-fist",name:"The Bloody Fist Company",standing:0,agenda:"Secure profitable contracts and expand influence",agendaTimer:{segments:6,current:1},keyNPCs:["Captain Rusk","The Veteran Sergeant"],resources:"Soldiers, siege equipment, camp followers",hooks:["A contract dispute is brewing","Payday is late"],color:"#8b0000",icon:"✊",source:"default"},{id:"house-contarini",name:"House Contarini (Vilikari)",standing:1,agenda:"Expand trade routes into Acasia",agendaTimer:{segments:8,current:3},keyNPCs:["Tema","Factor Voss"],resources:"Trade network, legal influence, grain",hooks:["A rival house is undercutting their prices"],color:"#2980b9",icon:"🏛️",source:"default"}],x=[{id:"safehouse-dye-district",name:"Safehouse: Dye District",type:"safehouse",tier:"Minor",description:"A converted spice warehouse near the Dye Yards. Hidden compartments, false walls, and a landlord who never saw you.",cost:4,status:"maintained",freeUse:"Start an entry/exit scene Dominant",sceneSurge:"Produce a hidden egress; convert one pursuit consequence into a temporary complication",source:"default"},{id:"informant-network-docks",name:"Informant Network: Docks",type:"network",tier:"Minor",description:"Eyes and ears on the waterfront. Porters, lamplighters, and urchins who watch for coin and gossip.",cost:4,status:"maintained",freeUse:"Targeted inquiry begins Dominant",sceneSurge:"Reveal a hidden schedule or route; mitigate 1 SB from ambush/surprise",source:"default"},{id:"mercenary-contract",name:"Mercenary Contract (Cap 2)",type:"contract",tier:"Standard",description:"A small trained unit of mercenaries. Loyal to coin, but reliable.",cost:8,status:"maintained",freeUse:'Introduce temporary off-screen security that downgrades "raid" to "attempted raid"',sceneSurge:"One on-screen intervention that improves Position for a withdrawal or breach",source:"default"},{id:"healing-house",name:"Healing House",type:"infrastructure",tier:"Standard",description:"Beds, herbs, and a healer who asks few questions. A place to recover from injuries.",cost:8,status:"neglected",freeUse:"During downtime, clear Harm 1 or Fatigue 2 from one ally",sceneSurge:"Stabilize now; convert a Severe injury consequence into a 4-segment Recovery timer",source:"default"}],C=[{id:"pip-the-locksmith",name:`"Pip" the Locksmith's Apprentice`,role:"Infiltrator",cap:1,description:"A young locksmith with nimble fingers and a nervous laugh. Knows the Dye District like the back of his hand. Owes you for saving him from a press gang.",loyalty:"faithful",fitness:"ready",source:"default"},{id:"quick-lena",name:'"Quick" Lena',role:"Informant / Thief",cap:2,description:"A Sidhi rogue with mismatched eyes and a nervous laugh. Owes a debt to a Sidhi smuggler named Peyton. Has a soft spot for urchins.",loyalty:"strained",fitness:"ready",source:"default"},{id:"tomas-the-guard",name:"Tomas the Guard",role:"Watchman",cap:1,description:"A night watchman who looks the other way for a price. His wife is sick and he needs the coin.",loyalty:"faithful",fitness:"ready",source:"default"}],N=[{id:"velvet-coin-trust",name:"The Silk Coin",icon:"🪙",tier:"I",description:"A thieves' guild operating in the shadows of Silkstrand. Founded by exiles from the Silk Coin, now a legitimate (and illegitimate) organization with hands in smuggling, information, and the occasional heist.",maxAssets:2,maxAssetTier:"Standard",assets:["safehouse-dye-district","informant-network-docks"],followers:["quick-lena","pip-the-locksmith"],obligation:2,capacity:4,source:"default"}],F=null,a={factions:[],assets:[],followers:[],trusts:[],viewMode:"factions",isLoading:!1,dataLoaded:!1,usingFallback:!1,screen:null};function p(){const t=$();if(t.factions&&(a.factions=t.factions.factions||[],a.assets=t.factions.assets||[],a.followers=t.factions.followers||[],a.trusts=t.factions.trusts||[],a.factions.length>0||a.assets.length>0)){console.log(`📦 Loaded from state: ${a.factions.length} factions, ${a.assets.length} assets, ${a.followers.length} followers, ${a.trusts.length} trusts`),a.dataLoaded=!0,a.usingFallback=!1;return}M()}async function M(){if(!a.isLoading){a.isLoading=!0;try{const t=await P();let e=[];if(t.length>0)for(const n of t)try{const i=await fetch(`${y}${n}.json`);if(i.ok){const r=await i.json();r.id||(r.id=n),e.push(r),console.log(`✅ Loaded faction: ${r.name||n}`)}else console.warn(`⚠️ Could not load faction: ${n} (HTTP ${i.status})`)}catch(i){console.warn(`⚠️ Error loading faction ${n}:`,i)}e.length===0?(console.warn("📥 No factions discovered. Using defaults."),a.usingFallback=!0,h(),l("⚠️ No faction files found. Using default factions.","warning")):(a.factions=e,a.dataLoaded=!0,a.usingFallback=!1,a.assets.length===0&&(a.assets=[...x]),a.followers.length===0&&(a.followers=[...C]),a.trusts.length===0&&(a.trusts=[...N]));const s=$();s.factions||(s.factions={}),s.factions.factions=a.factions,s.factions.assets=a.assets,s.factions.followers=a.followers,s.factions.trusts=a.trusts,D()}catch(t){console.warn("Failed to load remote factions:",t),a.usingFallback=!0,h(),l("⚠️ Error loading factions. Using defaults.","error")}finally{a.isLoading=!1}}}function h(){a.factions=[...j],a.assets=[...x],a.followers=[...C],a.trusts=[...N],a.dataLoaded=!0,a.usingFallback=!0,console.log(`📦 Using default faction data (${a.factions.length} factions, ${a.assets.length} assets, ${a.followers.length} followers, ${a.trusts.length} trusts)`)}function d(){const t=$();t.factions||(t.factions={}),t.factions.factions=a.factions,t.factions.assets=a.assets,t.factions.followers=a.followers,t.factions.trusts=a.trusts,D()}function U(t){F=t,p(),a.screen=null,O()}function O(){const t=a.usingFallback;F.innerHTML=`
        <div class="factions-modern-layout">
            <header class="factions-header">
                <h1 class="factions-title">🏛️ Factions & Assets</h1>
                <p class="factions-subtitle">Manage factions, assets, followers, and trusts.</p>
                ${a.dataLoaded?`<p class="text-muted" style="font-size:0.85rem;">📚 ${a.factions.length} factions, ${a.assets.length} assets, ${a.followers.length} followers</p>`:'<p class="text-muted" style="font-size:0.85rem;">⏳ Loading faction data...</p>'}
                ${t?'<div style="color:var(--warn);font-size:0.85rem;margin-top:0.3rem;">⚠️ No faction files found – using fallback defaults.</div>':""}
            </header>

            <div class="factions-tabs">
                <button class="factions-tab active" data-view="factions">🏛️ Factions</button>
                <button class="factions-tab" data-view="assets">📦 Assets</button>
                <button class="factions-tab" data-view="followers">👤 Followers</button>
                <button class="factions-tab" data-view="trusts">🤝 Trusts</button>
            </div>

            <div id="factions-view-container" class="factions-view-container">
                ${L()}
            </div>
        </div>
    `,T()}function f(){const t=document.getElementById("factions-view-container");t&&(t.innerHTML=L()),T()}function L(){if(a.screen)switch(a.screen.mode){case"view":return _(a.screen.kind,a.screen.id);case"edit":return S(a.screen.kind,a.screen.id);case"add":return S(a.screen.kind,null)}return b(a.viewMode)}function b(t){if(a.viewMode=t,!a.dataLoaded)return`
            <div class="factions-empty">
                <div style="font-size:3rem;">⏳</div>
                <div>Loading faction data...</div>
                <div class="text-muted" style="font-size:0.85rem;">Please wait</div>
            </div>
        `;switch(t){case"factions":return A();case"assets":return H();case"followers":return R();case"trusts":return z();default:return A()}}function c(t,e,s){a.screen=t?{mode:t,kind:e,id:s}:null,f(),window.scrollTo({top:0,behavior:"instant"in window?"instant":"auto"})}function A(){if(a.factions.length===0)return`
            <div class="factions-empty">
                <div style="font-size:3rem;">🏛️</div>
                <div>No factions tracked yet.</div>
                <button class="btn btn-primary" onclick="window.addFaction()">➕ Add Faction</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
            </div>
        `;const t=a.factions.map(i=>i.standing),e=t.length>0?t.reduce((i,r)=>i+r,0)/t.length:0,s=Math.min(6,Math.max(0,Math.round(e+3))),n=Math.min(6,Math.max(0,Math.round(6-s+t.filter(i=>i<0).length*.5)));return`
        <div class="factions-summary">
            <div class="summary-card">
                <span class="summary-icon">📈</span>
                <span class="summary-label">Mandate</span>
                <span class="summary-value">${s}/6</span>
                <div class="summary-bar">
                    <div class="summary-bar-fill" style="width:${s/6*100}%;background:var(--green);"></div>
                </div>
            </div>
            <div class="summary-card">
                <span class="summary-icon">⚠️</span>
                <span class="summary-label">Crisis</span>
                <span class="summary-value">${n}/6</span>
                <div class="summary-bar">
                    <div class="summary-bar-fill" style="width:${n/6*100}%;background:var(--red);"></div>
                </div>
            </div>
            <div class="summary-card">
                <span class="summary-icon">🏛️</span>
                <span class="summary-label">Factions</span>
                <span class="summary-value">${a.factions.length}</span>
                <div class="summary-bar"><div class="summary-bar-fill" style="width:100%;background:var(--gold);"></div></div>
            </div>
        </div>

        <div class="factions-grid">
            ${a.factions.map(i=>{const r=v[String(i.standing)]||v[0];return`
                    <div class="faction-card" onclick="window.viewFaction('${i.id}')" style="border-top:3px solid ${i.color||"var(--gold)"};">
                        <div class="faction-card-header">
                            <span class="faction-icon">${i.icon||"🏛️"}</span>
                            <span class="faction-name">${o(i.name)}</span>
                            <span class="faction-standing" style="color:${r.color};">
                                ${r.icon} ${r.label}
                            </span>
                        </div>
                        <div class="faction-agenda">
                            <span class="agenda-label">Agenda:</span>
                            <span class="agenda-text">${o(i.agenda||"None")}</span>
                        </div>
                        <div class="faction-timer">
                            <span>⏱️ Timer: ${i.agendaTimer?.current||0}/${i.agendaTimer?.segments||6}</span>
                            <div class="timer-bar">
                                <div class="timer-bar-fill" style="width:${(i.agendaTimer?.current||0)/(i.agendaTimer?.segments||6)*100}%;"></div>
                            </div>
                        </div>
                        <div class="faction-hooks">
                            ${(i.hooks||[]).slice(0,2).map(u=>`
                                <span class="hook-tag">🔗 ${o(u)}</span>
                            `).join("")}
                            ${(i.hooks||[]).length>2?`<span class="hook-tag">+${i.hooks.length-2}</span>`:""}
                        </div>
                        ${i.source==="default"||a.usingFallback?'<span class="badge badge-remote" style="font-size:0.6rem;">📦 Default</span>':""}
                    </div>
                `}).join("")}
        </div>

        <div class="factions-actions">
            <button class="btn btn-primary" onclick="window.addFaction()">➕ Add Faction</button>
            <button class="btn btn-secondary" onclick="window.factionTurn()" title="Advances faction agendas/standing AND fires a downtime-tick other features (e.g. Crafting's magic item upkeep) listen for — see Player's Guide ch. 11 Downtime, 'the world may advance timers while you rest'.">🔄 GM Downtime (Faction Turn)</button>
            <button class="btn btn-secondary" onclick="window.refreshFactions()">🔄 Refresh</button>
            <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
        </div>
    `}function H(){return a.assets.length===0?`
            <div class="factions-empty">
                <div style="font-size:3rem;">📦</div>
                <div>No assets tracked yet.</div>
                <button class="btn btn-primary" onclick="window.addAsset()">➕ Add Asset</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
            </div>
        `:`
        <div class="assets-grid">
            ${a.assets.map(t=>{const e=k[t.status||"maintained"];return`
                    <div class="asset-card" onclick="window.viewAsset('${t.id}')">
                        <div class="asset-card-tier">${t.tier||"Minor"}</div>
                        <div class="asset-card-name">${o(t.name)}</div>
                        <div class="asset-card-type">${o(t.type||"asset")}</div>
                        <div class="asset-card-status" style="color:${e.color};">${e.icon} ${e.label}</div>
                        <div class="asset-card-cost">${t.cost||4} XP</div>
                        ${t.source==="default"||a.usingFallback?'<span class="badge badge-remote" style="font-size:0.6rem;">📦 Default</span>':""}
                    </div>
                `}).join("")}
        </div>

        <div class="factions-actions">
            <button class="btn btn-primary" onclick="window.addAsset()">➕ Add Asset</button>
            <button class="btn btn-secondary" onclick="window.refreshFactions()">🔄 Refresh</button>
        </div>
    `}function R(){return a.followers.length===0?`
            <div class="factions-empty">
                <div style="font-size:3rem;">👤</div>
                <div>No followers tracked yet.</div>
                <button class="btn btn-primary" onclick="window.addFollower()">➕ Add Follower</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
            </div>
        `:`
        <div class="followers-grid">
            ${a.followers.map(t=>{const e=w.loyalty[t.loyalty||"faithful"],s=w.fitness[t.fitness||"ready"];return`
                    <div class="follower-card" onclick="window.viewFollower('${t.id}')">
                        <div class="follower-card-header">
                            <span class="follower-name">${o(t.name)}</span>
                            <span class="follower-cap">Cap ${t.cap||1}</span>
                        </div>
                        <div class="follower-role">${o(t.role||"Follower")}</div>
                        <div class="follower-states">
                            <span class="follower-state" style="color:${e.color};">${e.icon} ${e.label}</span>
                            <span class="follower-state" style="color:${s.color};">${s.icon} ${s.label}</span>
                        </div>
                        ${t.description?`<div class="follower-desc">${o(t.description)}</div>`:""}
                        ${t.source==="default"||a.usingFallback?'<span class="badge badge-remote" style="font-size:0.6rem;">📦 Default</span>':""}
                    </div>
                `}).join("")}
        </div>

        <div class="factions-actions">
            <button class="btn btn-primary" onclick="window.addFollower()">➕ Add Follower</button>
            <button class="btn btn-secondary" onclick="window.refreshFactions()">🔄 Refresh</button>
        </div>
    `}function z(){return a.trusts.length===0?`
            <div class="factions-empty">
                <div style="font-size:3rem;">🤝</div>
                <div>No trusts created yet.</div>
                <button class="btn btn-primary" onclick="window.addTrust()">➕ Create Trust</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultFactions()">📥 Load Defaults</button>
            </div>
        `:`
        <div class="trusts-grid">
            ${a.trusts.map(t=>`
                <div class="trust-card" onclick="window.viewTrust('${t.id}')">
                    <div class="trust-card-icon">${t.icon||"🤝"}</div>
                    <div class="trust-card-name">${o(t.name)}</div>
                    <div class="trust-card-tier">Tier ${t.tier||"I"}</div>
                    <div class="trust-card-stats">
                        <span>📦 ${t.assets?.length||0} Assets</span>
                        <span>👤 ${t.followers?.length||0} Followers</span>
                        <span>⚡ ${t.obligation||0}/${t.capacity||4}</span>
                    </div>
                    ${t.source==="default"||a.usingFallback?'<span class="badge badge-remote" style="font-size:0.6rem;">📦 Default</span>':""}
                </div>
            `).join("")}
        </div>

        <div class="factions-actions">
            <button class="btn btn-primary" onclick="window.addTrust()">➕ Create Trust</button>
            <button class="btn btn-secondary" onclick="window.refreshFactions()">🔄 Refresh</button>
        </div>
    `}function m(t){return`<button class="btn btn-secondary editor-back" onclick="window.closeFactionScreen('${t}')">← Back</button>`}function _(t,e){switch(t){case"faction":return q(e);case"asset":return B(e);case"follower":return G(e);case"trust":return K(e);default:return b(a.viewMode)}}function q(t){const e=a.factions.find(n=>n.id===t);if(!e)return l("Faction not found","error"),b("factions");const s=v[String(e.standing)]||v[0];return`
        <div class="editor-screen faction-detail">
            ${m("faction")}
            <div class="faction-detail-header">
                <span class="faction-detail-icon">${e.icon||"🏛️"}</span>
                <div>
                    <h2>${o(e.name)}</h2>
                    <div class="faction-detail-standing" style="color:${s.color};">
                        ${s.icon} ${s.label} — ${s.desc}
                    </div>
                </div>
            </div>

            <div class="faction-detail-body">
                <div class="faction-detail-section">
                    <h3>🎯 Agenda</h3>
                    <p>${o(e.agenda||"None")}</p>
                </div>

                <div class="faction-detail-section">
                    <h3>⏱️ Progress</h3>
                    <div class="timer-display">
                        <span>${e.agendaTimer?.current||0}/${e.agendaTimer?.segments||6}</span>
                        <div class="timer-bar">
                            <div class="timer-bar-fill" style="width:${(e.agendaTimer?.current||0)/(e.agendaTimer?.segments||6)*100}%;"></div>
                        </div>
                    </div>
                    <div class="timer-controls">
                        <button class="btn btn-sm btn-primary" onclick="window.tickFactionTimer('${e.id}')">⏱️ Tick +1</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.retreatFactionTimer('${e.id}')">↩️ Retreat -1</button>
                        <button class="btn btn-sm btn-warning" onclick="window.resetFactionTimer('${e.id}')">⟳ Reset</button>
                    </div>
                </div>

                <div class="faction-detail-section">
                    <h3>👤 Key NPCs</h3>
                    <ul>
                        ${(e.keyNPCs||[]).map(n=>`<li>${o(n)}</li>`).join("")}
                        ${(e.keyNPCs||[]).length===0?'<li class="text-muted">No NPCs listed</li>':""}
                    </ul>
                </div>

                <div class="faction-detail-section">
                    <h3>💪 Resources</h3>
                    <p>${o(e.resources||"None listed")}</p>
                </div>

                <div class="faction-detail-section">
                    <h3>🔗 Hooks</h3>
                    <ul>
                        ${(e.hooks||[]).map(n=>`<li>🔗 ${o(n)}</li>`).join("")}
                        ${(e.hooks||[]).length===0?'<li class="text-muted">No hooks yet.</li>':""}
                    </ul>
                    <form class="inline-add-form" onsubmit="window.addFactionHook(event, '${e.id}')">
                        <input type="text" name="hook" placeholder="New hook..." required />
                        <button type="submit" class="btn btn-sm btn-primary">➕ Add Hook</button>
                    </form>
                </div>

                <div class="faction-detail-section">
                    <h3>📊 Standing</h3>
                    <div class="standing-controls">
                        <button class="btn btn-sm btn-secondary" onclick="window.changeFactionStanding('${e.id}', -1)">➖</button>
                        <span style="font-weight:600;color:${s.color};">${s.icon} ${s.label}</span>
                        <button class="btn btn-sm btn-secondary" onclick="window.changeFactionStanding('${e.id}', 1)">➕</button>
                    </div>
                </div>
            </div>

            <div class="faction-detail-actions">
                <button class="btn btn-primary" onclick="window.editFaction('${e.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteFaction('${e.id}')">🗑️ Delete</button>
                ${m("faction")}
            </div>
        </div>
    `}function B(t){const e=a.assets.find(n=>n.id===t);if(!e)return l("Asset not found","error"),b("assets");const s=k[e.status||"maintained"];return`
        <div class="editor-screen asset-detail">
            ${m("asset")}
            <div class="asset-detail-header">
                <span class="asset-detail-icon">📦</span>
                <div>
                    <h2>${o(e.name)}</h2>
                    <div class="asset-detail-tier">${e.tier||"Minor"} Asset</div>
                </div>
            </div>

            <div class="asset-detail-body">
                <div class="asset-detail-section">
                    <h3>📖 Description</h3>
                    <p>${o(e.description||"No description.")}</p>
                </div>

                <div class="asset-detail-section">
                    <h3>💰 Cost</h3>
                    <p>${e.cost||4} XP</p>
                </div>

                <div class="asset-detail-section">
                    <h3>📊 Status</h3>
                    <p class="asset-status" style="color:${s.color};">${s.icon} ${s.label}</p>
                    <div class="status-controls">
                        <button class="btn btn-sm btn-secondary" onclick="window.changeAssetStatus('${e.id}', 'maintained')">✅ Maintained</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.changeAssetStatus('${e.id}', 'neglected')">⚠️ Neglected</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.changeAssetStatus('${e.id}', 'compromised')">❌ Compromised</button>
                    </div>
                </div>

                ${e.freeUse?`
                <div class="asset-detail-section">
                    <h3>🔄 Free Use</h3>
                    <p>${o(e.freeUse)}</p>
                </div>
                `:""}

                ${e.sceneSurge?`
                <div class="asset-detail-section">
                    <h3>⚡ Scene Surge</h3>
                    <p>${o(e.sceneSurge)}</p>
                </div>
                `:""}

                ${e.source==="default"||a.usingFallback?'<span class="badge badge-remote">📦 Default Asset</span>':""}
            </div>

            <div class="asset-detail-actions">
                <button class="btn btn-primary" onclick="window.editAsset('${e.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteAsset('${e.id}')">🗑️ Delete</button>
                ${m("asset")}
            </div>
        </div>
    `}function G(t){const e=a.followers.find(i=>i.id===t);if(!e)return l("Follower not found","error"),b("followers");const s=w.loyalty[e.loyalty||"faithful"],n=w.fitness[e.fitness||"ready"];return`
        <div class="editor-screen follower-detail">
            ${m("follower")}
            <div class="follower-detail-header">
                <span class="follower-detail-icon">👤</span>
                <div>
                    <h2>${o(e.name)}</h2>
                    <div class="follower-detail-role">${o(e.role||"Follower")} · Cap ${e.cap||1}</div>
                </div>
            </div>

            <div class="follower-detail-body">
                <div class="follower-detail-section">
                    <h3>📖 Description</h3>
                    <p>${o(e.description||"No description.")}</p>
                </div>

                <div class="follower-detail-section">
                    <h3>📊 States</h3>
                    <div class="state-grid">
                        <div class="state-item">
                            <span class="state-label">Loyalty</span>
                            <span class="state-value" style="color:${s.color};">${s.icon} ${s.label}</span>
                        </div>
                        <div class="state-item">
                            <span class="state-label">Fitness</span>
                            <span class="state-value" style="color:${n.color};">${n.icon} ${n.label}</span>
                        </div>
                    </div>
                    <div class="state-controls">
                        <button class="btn btn-sm btn-primary" onclick="window.changeFollowerState('${e.id}', 'loyalty')">Change Loyalty</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.changeFollowerState('${e.id}', 'fitness')">Change Fitness</button>
                    </div>
                </div>

                ${e.source==="default"||a.usingFallback?'<span class="badge badge-remote">📦 Default Follower</span>':""}
            </div>

            <div class="follower-detail-actions">
                <button class="btn btn-primary" onclick="window.editFollower('${e.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteFollower('${e.id}')">🗑️ Delete</button>
                ${m("follower")}
            </div>
        </div>
    `}function K(t){const e=a.trusts.find(i=>i.id===t);if(!e)return l("Trust not found","error"),b("trusts");const s=a.assets.filter(i=>!(e.assets||[]).includes(i.id)),n=a.followers.filter(i=>!(e.followers||[]).includes(i.id));return`
        <div class="editor-screen trust-detail">
            ${m("trust")}
            <div class="trust-detail-header">
                <span class="trust-detail-icon">${e.icon||"🤝"}</span>
                <div>
                    <h2>${o(e.name)}</h2>
                    <div class="trust-detail-tier">Tier ${e.tier||"I"} Trust</div>
                </div>
            </div>

            <div class="trust-detail-body">
                <div class="trust-detail-section">
                    <h3>📖 Description</h3>
                    <p>${o(e.description||"A player trust.")}</p>
                </div>

                <div class="trust-detail-section">
                    <h3>📊 Stats</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Asset Slots</span>
                            <span class="stat-value">${e.maxAssets||2}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Max Asset Tier</span>
                            <span class="stat-value">${e.maxAssetTier||"Standard"}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Obligation</span>
                            <span class="stat-value">${e.obligation||0}/${e.capacity||4}</span>
                        </div>
                    </div>
                </div>

                <div class="trust-detail-section">
                    <h3>📦 Assets (${e.assets?.length||0})</h3>
                    ${(e.assets||[]).length>0?`
                        <ul>
                            ${e.assets.map(i=>{const r=a.assets.find(u=>u.id===i);return`<li>${r?o(r.name):o(i)} (${r?.tier||"Unknown"})</li>`}).join("")}
                        </ul>
                    `:'<p class="text-muted">No assets.</p>'}
                    ${s.length>0?`
                        <form class="inline-add-form" onsubmit="window.addTrustAsset(event, '${e.id}')">
                            <select name="assetId" required>
                                <option value="" disabled selected>Select an asset…</option>
                                ${s.map(i=>`<option value="${i.id}">${o(i.name)} (${o(i.tier||"Minor")})</option>`).join("")}
                            </select>
                            <button type="submit" class="btn btn-sm btn-primary">➕ Add Asset</button>
                        </form>
                    `:'<p class="text-muted" style="font-size:0.85rem;">No available assets to add.</p>'}
                </div>

                <div class="trust-detail-section">
                    <h3>👤 Followers (${e.followers?.length||0})</h3>
                    ${(e.followers||[]).length>0?`
                        <ul>
                            ${e.followers.map(i=>{const r=a.followers.find(u=>u.id===i);return`<li>${r?o(r.name):o(i)} (Cap ${r?.cap||"?"})</li>`}).join("")}
                        </ul>
                    `:'<p class="text-muted">No followers.</p>'}
                    ${n.length>0?`
                        <form class="inline-add-form" onsubmit="window.addTrustFollower(event, '${e.id}')">
                            <select name="followerId" required>
                                <option value="" disabled selected>Select a follower…</option>
                                ${n.map(i=>`<option value="${i.id}">${o(i.name)} (Cap ${i.cap})</option>`).join("")}
                            </select>
                            <button type="submit" class="btn btn-sm btn-primary">➕ Add Follower</button>
                        </form>
                    `:'<p class="text-muted" style="font-size:0.85rem;">No available followers to add.</p>'}
                </div>

                ${e.source==="default"||a.usingFallback?'<span class="badge badge-remote">📦 Default Trust</span>':""}
            </div>

            <div class="trust-detail-actions">
                <button class="btn btn-primary" onclick="window.editTrust('${e.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteTrust('${e.id}')">🗑️ Delete</button>
                ${m("trust")}
            </div>
        </div>
    `}function S(t,e){switch(t){case"faction":return V(e);case"asset":return W(e);case"follower":return Y(e);case"trust":return X(e);default:return b(a.viewMode)}}function V(t){const e=t?a.factions.find(i=>i.id===t):null,s=!!e,n=e||{name:"",standing:0,agenda:"",keyNPCs:[],resources:"",color:"#d4af37",icon:"🏛️"};return`
        <div class="editor-screen faction-form">
            ${m("faction")}
            <h2>${s?"✏️ Edit Faction":"➕ New Faction"}</h2>
            <form class="fe-form" onsubmit="window.submitFactionForm(event, ${s?`'${t}'`:"null"})">
                <label>Name
                    <input type="text" name="name" value="${o(n.name)}" required />
                </label>
                <label>Standing (-3 to 3)
                    <input type="number" name="standing" min="-3" max="3" value="${n.standing??0}" />
                </label>
                <label>Agenda
                    <input type="text" name="agenda" value="${o(n.agenda||"")}" />
                </label>
                <label>Key NPCs (comma-separated)
                    <input type="text" name="keyNPCs" value="${o((n.keyNPCs||[]).join(", "))}" />
                </label>
                <label>Resources
                    <input type="text" name="resources" value="${o(n.resources||"")}" />
                </label>
                <label>Color
                    <input type="text" name="color" value="${o(n.color||"#d4af37")}" />
                </label>
                <label>Icon (emoji)
                    <input type="text" name="icon" value="${o(n.icon||"🏛️")}" />
                </label>
                <div class="fe-form-actions">
                    <button type="submit" class="btn btn-primary">💾 Save</button>
                    <button type="button" class="btn btn-secondary" onclick="window.closeFactionScreen('faction')">Cancel</button>
                </div>
            </form>
        </div>
    `}function W(t){const e=t?a.assets.find(i=>i.id===t):null,s=!!e,n=e||{name:"",type:"",tier:"Minor",description:"",cost:4,freeUse:"",sceneSurge:""};return`
        <div class="editor-screen asset-form">
            ${m("asset")}
            <h2>${s?"✏️ Edit Asset":"➕ New Asset"}</h2>
            <form class="fe-form" onsubmit="window.submitAssetForm(event, ${s?`'${t}'`:"null"})">
                <label>Name
                    <input type="text" name="name" value="${o(n.name)}" required />
                </label>
                <label>Type (safehouse/network/library/workshop/contract)
                    <input type="text" name="type" value="${o(n.type||"")}" />
                </label>
                <label>Tier (Minor/Standard/Major)
                    <input type="text" name="tier" value="${o(n.tier||"Minor")}" />
                </label>
                <label>Description
                    <textarea name="description" rows="3">${o(n.description||"")}</textarea>
                </label>
                <label>XP Cost
                    <input type="number" name="cost" min="0" value="${n.cost??4}" />
                </label>
                <label>Free Use
                    <input type="text" name="freeUse" value="${o(n.freeUse||"")}" />
                </label>
                <label>Scene Surge
                    <input type="text" name="sceneSurge" value="${o(n.sceneSurge||"")}" />
                </label>
                <div class="fe-form-actions">
                    <button type="submit" class="btn btn-primary">💾 Save</button>
                    <button type="button" class="btn btn-secondary" onclick="window.closeFactionScreen('asset')">Cancel</button>
                </div>
            </form>
        </div>
    `}function Y(t){const e=t?a.followers.find(i=>i.id===t):null,s=!!e,n=e||{name:"",role:"Follower",cap:1,description:"",loyalty:"faithful",fitness:"ready"};return`
        <div class="editor-screen follower-form">
            ${m("follower")}
            <h2>${s?"✏️ Edit Follower":"➕ New Follower"}</h2>
            <form class="fe-form" onsubmit="window.submitFollowerForm(event, ${s?`'${t}'`:"null"})">
                <label>Name
                    <input type="text" name="name" value="${o(n.name)}" required />
                </label>
                <label>Role
                    <input type="text" name="role" value="${o(n.role||"Follower")}" />
                </label>
                <label>Cap (1-5)
                    <input type="number" name="cap" min="1" max="5" value="${n.cap??1}" />
                </label>
                <label>Description
                    <textarea name="description" rows="3">${o(n.description||"")}</textarea>
                </label>
                <label>Loyalty
                    <select name="loyalty">
                        ${Object.keys(w.loyalty).map(i=>`<option value="${i}" ${n.loyalty===i?"selected":""}>${w.loyalty[i].label}</option>`).join("")}
                    </select>
                </label>
                <label>Fitness
                    <select name="fitness">
                        ${Object.keys(w.fitness).map(i=>`<option value="${i}" ${n.fitness===i?"selected":""}>${w.fitness[i].label}</option>`).join("")}
                    </select>
                </label>
                <div class="fe-form-actions">
                    <button type="submit" class="btn btn-primary">💾 Save</button>
                    <button type="button" class="btn btn-secondary" onclick="window.closeFactionScreen('follower')">Cancel</button>
                </div>
            </form>
        </div>
    `}function X(t){const e=t?a.trusts.find(i=>i.id===t):null,s=!!e,n=e||{name:"",icon:"🤝",tier:"I",description:"",maxAssets:2,maxAssetTier:"Standard",capacity:4};return`
        <div class="editor-screen trust-form">
            ${m("trust")}
            <h2>${s?"✏️ Edit Trust":"➕ New Trust"}</h2>
            <form class="fe-form" onsubmit="window.submitTrustForm(event, ${s?`'${t}'`:"null"})">
                <label>Name
                    <input type="text" name="name" value="${o(n.name)}" required />
                </label>
                <label>Icon (emoji)
                    <input type="text" name="icon" value="${o(n.icon||"🤝")}" />
                </label>
                <label>Tier (I-III)
                    <input type="text" name="tier" value="${o(n.tier||"I")}" />
                </label>
                <label>Description
                    <textarea name="description" rows="3">${o(n.description||"")}</textarea>
                </label>
                <label>Max Asset Slots
                    <input type="number" name="maxAssets" min="0" value="${n.maxAssets??2}" />
                </label>
                <label>Max Asset Tier
                    <input type="text" name="maxAssetTier" value="${o(n.maxAssetTier||"Standard")}" />
                </label>
                <label>Obligation Capacity
                    <input type="number" name="capacity" min="0" value="${n.capacity??4}" />
                </label>
                <div class="fe-form-actions">
                    <button type="submit" class="btn btn-primary">💾 Save</button>
                    <button type="button" class="btn btn-secondary" onclick="window.closeFactionScreen('trust')">Cancel</button>
                </div>
            </form>
        </div>
    `}window.closeFactionScreen=function(t){const e={faction:"factions",asset:"assets",follower:"followers",trust:"trusts"}[t]||"factions";a.viewMode=e,c(null)};window.viewFaction=function(t){c("view","faction",t)};window.viewAsset=function(t){c("view","asset",t)};window.viewFollower=function(t){c("view","follower",t)};window.viewTrust=function(t){c("view","trust",t)};window.loadDefaultFactions=function(){h(),f(),l("Loaded default factions","success")};window.addFaction=function(){c("add","faction",null)};window.editFaction=function(t){c("edit","faction",t)};window.submitFactionForm=function(t,e){t.preventDefault();const s=new FormData(t.target),n=(s.get("name")||"").trim();if(!n)return;const i={name:n,standing:Math.max(-3,Math.min(3,parseInt(s.get("standing")||"0",10)||0)),agenda:(s.get("agenda")||"").trim()||"None",keyNPCs:(s.get("keyNPCs")||"").split(",").map(r=>r.trim()).filter(Boolean),resources:(s.get("resources")||"").trim()||"None listed",color:(s.get("color")||"").trim()||"#d4af37",icon:(s.get("icon")||"").trim()||"🏛️"};if(e){const r=a.factions.find(u=>u.id===e);if(!r)return;Object.assign(r,i,{source:"local"}),l(`Updated faction: ${n}`,"success")}else a.factions.push({id:"faction-"+Date.now(),...i,agendaTimer:{segments:6,current:0},hooks:[],source:"local"}),l(`Added faction: ${n}`,"success");d(),a.viewMode="factions",c(e?"view":null,e?"faction":void 0,e||void 0)};window.deleteFaction=function(t){const e=a.factions.find(s=>s.id===t);e&&confirm(`Delete faction "${e.name}"?`)&&(a.factions=a.factions.filter(s=>s.id!==t),d(),a.viewMode="factions",c(null),l(`Deleted faction: ${e.name}`,"info"))};window.changeFactionStanding=function(t,e){const s=a.factions.find(n=>n.id===t);s&&(s.standing=Math.max(-3,Math.min(3,s.standing+e)),d(),f(),l(`${s.name} standing: ${v[String(s.standing)].label}`,"info"))};window.tickFactionTimer=function(t){const e=a.factions.find(s=>s.id===t);e&&(e.agendaTimer||(e.agendaTimer={segments:6,current:0}),e.agendaTimer.current=Math.min(e.agendaTimer.current+1,e.agendaTimer.segments),e.agendaTimer.current>=e.agendaTimer.segments&&(l(`⚠️ ${e.name} has achieved its agenda!`,"warning"),e.agendaTimer.current=0),d(),f())};window.retreatFactionTimer=function(t){const e=a.factions.find(s=>s.id===t);e&&(e.agendaTimer||(e.agendaTimer={segments:6,current:0}),e.agendaTimer.current=Math.max(e.agendaTimer.current-1,0),d(),f())};window.resetFactionTimer=function(t){const e=a.factions.find(s=>s.id===t);e&&(e.agendaTimer||(e.agendaTimer={segments:6,current:0}),e.agendaTimer.current=0,d(),f())};window.addFactionHook=function(t,e){t.preventDefault();const s=a.factions.find(i=>i.id===e);if(!s)return;const n=(new FormData(t.target).get("hook")||"").trim();n&&(s.hooks||(s.hooks=[]),s.hooks.push(n),d(),f(),l(`Added hook: ${n}`,"success"))};window.factionTurn=function(){let t=[];a.factions.forEach(e=>{const s=Math.floor(Math.random()*6)+1;let n=0;if(s<=2?n=-1:s>=5&&(n=1),n!==0){e.agendaTimer||(e.agendaTimer={segments:6,current:0});const i=e.agendaTimer.current;e.agendaTimer.current=Math.max(0,Math.min(e.agendaTimer.current+n,e.agendaTimer.segments)),e.agendaTimer.current>=e.agendaTimer.segments?(t.push(`⚠️ ${e.name} achieved its agenda!`),e.agendaTimer.current=0):e.agendaTimer.current!==i&&t.push(`${e.name}: ${i} → ${e.agendaTimer.current} (${n>0?"+":""}${n})`)}if(Math.random()<.2){const i=e.standing;e.standing=Math.max(-3,Math.min(3,e.standing+(Math.random()<.5?1:-1))),e.standing!==i&&t.push(`${e.name} standing: ${v[String(i)].label} → ${v[String(e.standing)].label}`)}}),d(),f(),t.length>0?l("🔄 Faction turn complete: "+t.join("; "),"success"):l("🔄 Faction turn complete - no changes","info"),document.dispatchEvent(new CustomEvent("downtime-tick",{detail:{source:"faction-turn"}}))};window.addAsset=function(){c("add","asset",null)};window.editAsset=function(t){c("edit","asset",t)};window.submitAssetForm=function(t,e){t.preventDefault();const s=new FormData(t.target),n=(s.get("name")||"").trim();if(!n)return;const i={name:n,type:(s.get("type")||"").trim()||"asset",tier:(s.get("tier")||"").trim()||"Minor",description:(s.get("description")||"").trim()||"An asset.",cost:parseInt(s.get("cost")||"4",10)||4,freeUse:(s.get("freeUse")||"").trim(),sceneSurge:(s.get("sceneSurge")||"").trim()};if(e){const r=a.assets.find(u=>u.id===e);if(!r)return;Object.assign(r,i,{source:"local"}),l(`Updated asset: ${n}`,"success")}else a.assets.push({id:"asset-"+Date.now(),...i,status:"maintained",source:"local"}),l(`Added asset: ${n}`,"success");d(),a.viewMode="assets",c(e?"view":null,e?"asset":void 0,e||void 0)};window.deleteAsset=function(t){const e=a.assets.find(s=>s.id===t);e&&confirm(`Delete asset "${e.name}"?`)&&(a.assets=a.assets.filter(s=>s.id!==t),d(),a.viewMode="assets",c(null),l(`Deleted asset: ${e.name}`,"info"))};window.changeAssetStatus=function(t,e){const s=a.assets.find(i=>i.id===t);if(!s)return;s.status=e,d(),f();const n=k[e];l(`${s.name}: ${n.icon} ${n.label}`,"info")};window.addFollower=function(){c("add","follower",null)};window.editFollower=function(t){c("edit","follower",t)};window.submitFollowerForm=function(t,e){t.preventDefault();const s=new FormData(t.target),n=(s.get("name")||"").trim();if(!n)return;const i={name:n,role:(s.get("role")||"").trim()||"Follower",cap:parseInt(s.get("cap")||"1",10)||1,description:(s.get("description")||"").trim()||"A follower.",loyalty:s.get("loyalty")||"faithful",fitness:s.get("fitness")||"ready"};if(e){const r=a.followers.find(u=>u.id===e);if(!r)return;Object.assign(r,i,{source:"local"}),l(`Updated follower: ${n}`,"success")}else a.followers.push({id:"follower-"+Date.now(),...i,source:"local"}),l(`Added follower: ${n}`,"success");d(),a.viewMode="followers",c(e?"view":null,e?"follower":void 0,e||void 0)};window.deleteFollower=function(t){const e=a.followers.find(s=>s.id===t);e&&confirm(`Delete follower "${e.name}"?`)&&(a.followers=a.followers.filter(s=>s.id!==t),d(),a.viewMode="followers",c(null),l(`Deleted follower: ${e.name}`,"info"))};window.changeFollowerState=function(t,e){const s=a.followers.find(u=>u.id===t);if(!s)return;const n=e==="loyalty"?["faithful","strained","broken"]:["ready","hurt","down"],i=s[e]||n[0],r=n[(n.indexOf(i)+1)%n.length];s[e]=r,d(),f(),l(`${e==="loyalty"?"Loyalty":"Fitness"}: ${i} → ${r}`,"info")};window.addTrust=function(){c("add","trust",null)};window.editTrust=function(t){c("edit","trust",t)};window.submitTrustForm=function(t,e){t.preventDefault();const s=new FormData(t.target),n=(s.get("name")||"").trim();if(!n)return;const i={name:n,icon:(s.get("icon")||"").trim()||"🤝",tier:(s.get("tier")||"").trim()||"I",description:(s.get("description")||"").trim()||"A player trust.",maxAssets:parseInt(s.get("maxAssets")||"2",10)||2,maxAssetTier:(s.get("maxAssetTier")||"").trim()||"Standard",capacity:parseInt(s.get("capacity")||"4",10)||4};if(e){const r=a.trusts.find(u=>u.id===e);if(!r)return;Object.assign(r,i,{source:"local"}),l(`Updated trust: ${n}`,"success")}else a.trusts.push({id:"trust-"+Date.now(),...i,assets:[],followers:[],obligation:0,source:"local"}),l(`Created trust: ${n}`,"success");d(),a.viewMode="trusts",c(e?"view":null,e?"trust":void 0,e||void 0)};window.deleteTrust=function(t){const e=a.trusts.find(s=>s.id===t);e&&confirm(`Delete trust "${e.name}"?`)&&(a.trusts=a.trusts.filter(s=>s.id!==t),d(),a.viewMode="trusts",c(null),l(`Deleted trust: ${e.name}`,"info"))};window.addTrustAsset=function(t,e){t.preventDefault();const s=a.trusts.find(r=>r.id===e);if(!s)return;s.assets||(s.assets=[]);const n=new FormData(t.target).get("assetId"),i=a.assets.find(r=>r.id===n);i&&(s.assets.push(i.id),s.assets.length>(s.maxAssets||2)&&l(`Warning: Trust now has ${s.assets.length} assets, exceeding its capacity of ${s.maxAssets||2}.`,"warning"),d(),f(),l(`Added ${i.name} to ${s.name}`,"success"))};window.addTrustFollower=function(t,e){t.preventDefault();const s=a.trusts.find(r=>r.id===e);if(!s)return;s.followers||(s.followers=[]);const n=new FormData(t.target).get("followerId"),i=a.followers.find(r=>r.id===n);i&&(s.followers.push(i.id),d(),f(),l(`Added ${i.name} to ${s.name}`,"success"))};window.refreshFactions=function(){localStorage.removeItem(g),p(),f(),l("Factions refreshed","success")};function T(){document.querySelectorAll(".factions-tab").forEach(t=>{t.addEventListener("click",()=>{document.querySelectorAll(".factions-tab").forEach(n=>n.classList.remove("active")),t.classList.add("active"),a.screen=null;const e=t.dataset.view,s=document.getElementById("factions-view-container");s&&(s.innerHTML=b(e),T())})})}function J(){console.log("[Factions] Activated"),a.dataLoaded||p(),f()}function Q(){console.log("[Factions] Deactivated")}function Z(){localStorage.removeItem(g),p(),f()}function ee(){F=null}var ne={render:U,destroy:ee,onActivate:J,onDeactivate:Q,refresh:Z,loadFactionData:p,loadRemoteFactions:M,loadDefaultFactions:h,saveFactionData:d};export{T as attachEvents,ne as default,ee as destroy,p as loadFactionData,J as onActivate,Q as onDeactivate,Z as refresh,U as render};
