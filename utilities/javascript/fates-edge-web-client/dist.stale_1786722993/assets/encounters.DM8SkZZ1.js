const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/editor.CGdlKjIb.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/rolldown-runtime.BQ-_32WO.js","assets/Toast.DDAtBIAw.js","assets/preload-helper.BATLnrmA.js","assets/objective-types.CuiNbA6A.js","assets/bestiary.CPB8-5uX.js","assets/websocket.Dmklt06W.js","assets/main.hiOZSyFC.js","assets/sync.i5xh8ufD.js","assets/main.DcCFXHiG.css","assets/gm-tools.BcndmVEn.js","assets/talent-effects.CY-tOZj6.js","assets/decks.CN3iDKhv.js","assets/discovery.I-q7Uafb.js"])))=>i.map(i=>d[i]);
import{i as o}from"./utils.lBShoim5.js";import{D as A,b as E}from"./state.42sFgcOQ.js";import{n as c}from"./Toast.DDAtBIAw.js";import{t as _}from"./preload-helper.BATLnrmA.js";import{p as P}from"./websocket.Dmklt06W.js";import{h as R,m as O}from"./main.hiOZSyFC.js";import{r as F,t as G}from"./objective-types.CuiNbA6A.js";import{r as S,t as I}from"./gm-tools.BcndmVEn.js";import{i as j,n as T,o as V,r as H,t as z}from"./bestiary.CPB8-5uX.js";var B=null,v=[],k=[],D="fates-edge-gm-sb-bank",b=0;function U(){try{const e=localStorage.getItem(D);b=e?Math.max(0,parseInt(e,10)):0}catch{b=0}}function C(){try{localStorage.setItem(D,String(b))}catch{}}function M(e){b=Math.max(0,b+e),C(),$()}function Q(e,t){if(b<e)return c(`Need ${e} SB; only ${b} available.`,"warning"),!1;b-=e,C(),$();try{S(`💥 SB spent (${e}): ${t}`,"danger"),I("sb_spent",{cost:e,label:t})}catch{}return c(`Spent ${e} SB — ${t}`,"success"),!0}var K=[{name:"Goblin Scavenger",body:"Small, green, greedy. TL1. Harm 3."},{name:"Skeleton Knight",body:"Animated armour, rusty blade. TL2. Harm 4."},{name:"Thorn Dryad",body:"Fey with bark skin and thorny vines. TL3. Harm 5."},{name:"Cultist Emissary",body:"Robed zealot, whispers of doom. TL2. Harm 3."},{name:"Rust Wyrm",body:"Mechanical beast, dripping corrosion. TL4. Harm 6."}];function h(){return P()?R(O()):!0}async function Y(e){B=e;try{v=await H(),console.log(`[Encounters] Loaded ${v.length} bestiary entries`),await j()}catch(n){console.warn("Bestiary data not available:",n),v=[]}k=v,U();const t=h();B.innerHTML=`
        <style>
            .encounters-layout { padding: 1rem; }
            .encounters-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
            
            /* Main grid: left column 2fr, right column 1fr */
            .encounters-grid {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 1.25rem;
                align-items: start;
                min-height: 70vh;
            }
            @media (max-width: 768px) {
                .encounters-grid {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
            }

            /* Left column – stacked vertically */
            .left-column {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                height: 100%;
            }
            /* Saved Encounters takes auto height */
            .saved-encounters {
                flex-shrink: 0;
            }
            /* Bestiary panel takes remaining height */
            .bestiary-panel-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 300px; /* fallback */
            }
            .bestiary-panel-wrapper .panel {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .bestiary-panel-wrapper .bestiary-list-container {
                flex: 1;
                overflow-y: auto;
                padding-right: 0.25rem;
            }

            /* Right column – stacked panels */
            .right-column {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .panel {
                background: var(--bg-panel);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 0.8rem;
            }
            .panel h4 {
                margin: 0 0 0.3rem 0;
                font-size: 1rem;
            }

            .encounter-item {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                padding: 0.6rem 0.9rem;
                background: var(--bg3);
                border-radius: var(--radius);
                border: 1px solid var(--border);
                margin-bottom: 0.45rem;
                transition: border-color 0.2s, background 0.2s;
            }
            .encounter-item:hover {
                border-color: var(--gold);
                background: var(--bg2);
            }
            .encounter-item.active {
                border-left: 4px solid var(--green);
            }

            .bestiary-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 0.2rem;
                margin-bottom: 0.4rem;
                align-items: center;
            }
            .bestiary-list {
                display: flex;
                flex-direction: column;
                gap: 0.35rem;
                font-size: 0.8rem;
            }
            .bestiary-entry {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 0.4rem;
                align-items: center;
                background: var(--bg3);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 0.45rem 0.6rem;
                transition: border-color 0.2s, background 0.2s;
            }
            .bestiary-entry:hover {
                border-color: var(--gold);
                background: var(--bg2);
            }
            .bestiary-entry .entry-main {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.35rem;
                min-width: 0;
            }
            .bestiary-entry .entry-actions {
                display: flex;
                gap: 0.25rem;
            }

            .sb-bank-display {
                display: flex;
                align-items: center;
                gap: 0.4rem;
                margin-bottom: 0.3rem;
            }
            .sb-bank-display input {
                width: 50px;
                text-align: center;
                font-size: 0.8rem;
                background: var(--bg2);
                border: 1px solid var(--border);
                border-radius: 4px;
                padding: 0.15rem;
            }
            .sb-move-card {
                background: var(--bg2);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 0.3rem 0.5rem;
                margin-bottom: 0.3rem;
                font-size: 0.75rem;
            }
            .sb-move-card .cost {
                color: var(--danger);
                font-weight: 700;
            }
            .creature-tag {
                font-size: 0.65rem;
                padding: 0.05rem 0.35rem;
                border-radius: 12px;
                background: var(--bg2);
                color: var(--text2);
                white-space: nowrap;
            }
            .tl-badge {
                background: var(--danger-soft, var(--bg2));
                color: var(--danger);
            }
            .class-badge {
                background: var(--accent-soft, var(--bg2));
                color: var(--accent);
            }
            .scale-table {
                font-size: 0.7rem;
                display: grid;
                grid-template-columns: 0.6fr 1.4fr 0.8fr;
                gap: 0.1rem 0.3rem;
            }
            .scale-table > div {
                padding: 0.1rem 0.2rem;
                border-bottom: 1px solid var(--border);
            }

            /* Quick adversary clickable */
            .quick-adversary {
                background: var(--bg3);
                padding: 0.35rem 0.55rem;
                border-radius: 4px;
                margin-bottom: 0.3rem;
                border-left: 3px solid var(--gold);
                cursor: pointer;
                transition: background 0.15s;
            }
            .quick-adversary:hover {
                background: var(--bg2);
            }

            .btn { transition: all 0.2s ease; }
            .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
            .btn:active { transform: scale(0.96); }

            /* Scrollbars */
            .bestiary-list-container::-webkit-scrollbar,
            #encounter-list::-webkit-scrollbar,
            .right-column .panel > div:last-child::-webkit-scrollbar {
                width: 6px;
            }
            .bestiary-list-container::-webkit-scrollbar-track,
            #encounter-list::-webkit-scrollbar-track,
            .right-column .panel > div:last-child::-webkit-scrollbar-track {
                background: var(--bg3);
                border-radius: 3px;
            }
            .bestiary-list-container::-webkit-scrollbar-thumb,
            #encounter-list::-webkit-scrollbar-thumb,
            .right-column .panel > div:last-child::-webkit-scrollbar-thumb {
                background: var(--border);
                border-radius: 3px;
            }
        </style>

        <div class="encounters-layout">
            <header class="encounters-header">
                <div>
                    <h1 class="page-title" style="margin:0;">⚔️ Encounters</h1>
                    <p class="page-sub" style="margin:0.2rem 0 0;">Build encounters, track combat, and reference adversaries.</p>
                </div>
                ${t?'<button class="btn btn-gold" id="add-encounter-btn">+ New Encounter</button>':""}
            </header>

            <div class="encounters-grid">
                <!-- LEFT COLUMN -->
                <div class="left-column">
                    <!-- Saved Encounters -->
                    <div class="saved-encounters panel">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.8rem;">
                            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                <h4 style="margin:0;">📋 Saved Encounters</h4>
                                <input type="text" id="encounter-search" placeholder="🔍 Search…" style="font-size:0.8rem; padding:0.25rem 0.5rem; width:160px;" />
                            </div>
                        </div>
                        <div id="encounter-list" style="max-height:40vh; overflow-y:auto; padding-right:0.25rem;"></div>
                    </div>

                    <!-- Bestiary Panel (large, takes remaining height) -->
                    <div class="bestiary-panel-wrapper">
                        <div class="panel">
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.5rem;">
                                <h4 style="margin:0;">📖 Bestiary</h4>
                                <div style="display:flex; gap:0.3rem; align-items:center;">
                                    <input type="text" id="bestiary-search" placeholder="Search…" style="font-size:0.75rem; padding:0.15rem 0.4rem; width:100px;" />
                                    <select id="bestiary-filter-tl" style="font-size:0.7rem; padding:0.1rem 0.2rem;">
                                        <option value="all">TL</option>
                                        ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}">${n}</option>`).join("")}
                                    </select>
                                    <button class="btn btn-sm btn-ghost" id="bestiary-refresh" style="font-size:0.7rem; padding:0.1rem 0.4rem;">↻</button>
                                </div>
                            </div>
                            <div class="bestiary-filters">
                                <span style="font-size:0.65rem; color:var(--text3);">Class:</span>
                                <div id="bestiary-class-filters" style="display:flex; flex-wrap:wrap; gap:0.15rem;">
                                    ${["I","II","III","IV","V","VI","VII","VIII","IX","X"].map(n=>`
                                        <button class="btn btn-xs class-filter-btn ${n==="all"?"btn-primary":"btn-ghost"}" data-class="${n}" style="font-size:0.6rem; padding:0.05rem 0.3rem;">${n}</button>
                                    `).join("")}
                                </div>
                            </div>
                            <div class="bestiary-list-container">
                                <div id="bestiary-list" class="bestiary-list"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT COLUMN -->
                <div class="right-column">
                    <!-- Quick Adversaries -->
                    <div class="panel">
                        <h4>🃏 Quick Adversaries</h4>
                        <div id="quick-adversaries" style="font-size:0.75rem; max-height:200px; overflow-y:auto; margin-top:0.3rem;"></div>
                    </div>

                    <!-- GM SB Bank -->
                    <div class="panel">
                        <h4>⚡ GM SB Bank</h4>
                        <div class="sb-bank-display">
                            <span style="font-size:0.8rem; color:var(--text2);">Bank:</span>
                            <button class="btn btn-xs btn-ghost" id="sb-minus" style="font-weight:bold;">−</button>
                            <input type="number" id="sb-bank-input" value="${b}" min="0" />
                            <button class="btn btn-xs btn-ghost" id="sb-plus" style="font-weight:bold;">+</button>
                        </div>
                        <div id="sb-default-moves" style="max-height:120px; overflow-y:auto; font-size:0.75rem; margin-top:0.3rem;"></div>
                    </div>

                    <!-- Threat Scale -->
                    <div class="panel">
                        <h4>📊 Threat Scale</h4>
                        <div class="scale-table" style="margin-top:0.3rem;">
                            <div><strong>TL</strong></div><div><strong>Role</strong></div><div><strong>Harm Levels</strong></div>
                            <div>1</div><div>Fodder / pest</div><div>2</div>
                            <div>2</div><div>Common threat</div><div>3</div>
                            <div>3</div><div>Drop unarmored PC</div><div>4</div>
                            <div>4</div><div>Elite / captain</div><div>5</div>
                            <div>5–6</div><div>Miniboss / Boss</div><div>6–7</div>
                            <div>7–8</div><div>Arch / named horror</div><div>8–9</div>
                            <div>9–10</div><div>Cosmic / god-adjacent</div><div>10+</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,X(),w(),x(),$(),W(),q()}function $(){const e=document.getElementById("sb-bank-input");e&&(e.value=b)}function W(){const e=document.getElementById("sb-default-moves");e&&(e.innerHTML=[{cost:1,name:"Minor complication",effect:"Tick a timer, leave a trace, or make a noise."},{cost:2,name:"Moderate complication",effect:"Alarm raised, lose Position, lesser foe appears."},{cost:3,name:"Major complication",effect:"Reinforcements, scene shift, or break an asset."}].map(t=>`
        <div class="sb-move-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">
                <strong>${o(t.name)}</strong>
                <button class="btn btn-xs btn-danger sb-spend-btn" data-cost="${t.cost}" data-label="${o(t.name)}" style="font-size:0.65rem;">
                    ${t.cost} SB
                </button>
            </div>
            <div style="color:var(--text2);margin-top:0.15rem;">${o(t.effect)}</div>
        </div>
    `).join(""),e.querySelectorAll(".sb-spend-btn").forEach(t=>{t.addEventListener("click",()=>{const n=parseInt(t.dataset.cost,10),s=t.dataset.label;Q(n,s)})}))}function X(){const e=document.getElementById("quick-adversaries");e&&(e.innerHTML=K.map(t=>`
            <div class="quick-adversary" data-name="${o(t.name)}" data-body="${o(t.body)}">
                <div style="font-weight:600;font-size:0.85rem;">${o(t.name)}</div>
                <div style="font-size:0.75rem;color:var(--text2);">${o(t.body)}</div>
            </div>
        `).join(""),e.querySelectorAll(".quick-adversary").forEach(t=>{t.addEventListener("click",()=>{J(t.dataset.name,t.dataset.body)})}))}function w(){const e=document.getElementById("encounter-list");if(!e)return;const t=E().encounters||[],n=h(),s=document.getElementById("encounter-search")?.value?.toLowerCase()||"";let p=t;if(s&&(p=t.filter(r=>(r.title||"").toLowerCase().includes(s)||(r.body||"").toLowerCase().includes(s))),p.length===0){e.innerHTML=`
            <div style="text-align:center;padding:1.5rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">⚔️</div>
                <div>${t.length===0?'No encounters yet. Click "New Encounter" to start.':"No matches found."}</div>
            </div>
        `;return}e.innerHTML=p.map(r=>{const m=r.status==="active",f=m?"var(--green)":"var(--text2)",a=m?"active":"",l=`<span class="creature-tag tl-badge" title="Difficulty / TL">TL ${r.difficulty||3}</span>`,i=F(r.type),u=`<span class="creature-tag" title="${o(i.description)}">${i.icon} ${o(i.label)}</span>`;let d="";return n?d=`
                <button class="btn btn-xs btn-primary encounter-edit-btn" data-id="${r.id}" title="Edit">✏️</button>
                <button class="btn btn-xs btn-green encounter-combat-btn" data-id="${r.id}" title="Combat Tracker">⚔️</button>
                <button class="btn btn-xs btn-danger encounter-delete-btn" data-id="${r.id}" title="Delete">🗑️</button>
            `:d='<span style="font-size:0.65rem;color:var(--text3);">🔒</span>',`
            <div class="encounter-item ${a}" data-id="${r.id}">
                <div class="info" style="flex:1;min-width:150px;cursor:pointer;" onclick="window.toggleEncounterBody('${r.id}')">
                    <div class="name" style="font-weight:600;display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        ${o(r.title)}
                        ${l}
                        ${u}
                        <span style="color:${f};font-size:0.75rem;">${r.status||"draft"}</span>
                    </div>
                    <div class="meta" style="font-size:0.8rem;color:var(--text2);">
                        ${r.location||"No location"} · ${r.adversaries?.length||0} adversaries
                    </div>
                    <div id="enc-body-${r.id}" style="display:none;margin-top:0.4rem;padding:0.4rem 0.6rem;background:var(--bg2);border-radius:4px;font-size:0.8rem;color:var(--text);border-left:3px solid var(--gold);">
                        ${o(r.body||"No description.")}
                        ${r.adversaries&&r.adversaries.length>0?`
                            <div style="margin-top:0.35rem;">
                                <strong style="color:var(--gold);">Adversaries:</strong>
                                ${r.adversaries.map(g=>`<span class="creature-tag">${o(g.name)}</span>`).join(" ")}
                            </div>
                        `:""}
                    </div>
                </div>
                <div class="actions" style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    ${d}
                </div>
            </div>
        `}).join(""),n&&(e.querySelectorAll(".encounter-edit-btn").forEach(r=>{r.addEventListener("click",m=>{m.stopPropagation(),N(r.dataset.id)})}),e.querySelectorAll(".encounter-combat-btn").forEach(r=>{r.addEventListener("click",m=>{m.stopPropagation(),ee(r.dataset.id)})}),e.querySelectorAll(".encounter-delete-btn").forEach(r=>{r.addEventListener("click",m=>{m.stopPropagation(),Z(r.dataset.id)})}))}window.toggleEncounterBody=function(e){const t=document.getElementById("enc-body-"+e);t&&(t.style.display=t.style.display==="none"?"block":"none")};function x(){const e=document.getElementById("bestiary-list");if(!e)return;const t=document.getElementById("bestiary-search"),n=document.getElementById("bestiary-filter-tl"),s=t?t.value.toLowerCase().trim():"",p=n?n.value:"all",r=document.querySelector(".class-filter-btn.active-class"),m=r?r.dataset.class:"all";if(k=v.filter(a=>{const l=(a.name||"").toLowerCase(),i=(T(a)||"").toLowerCase(),u=(a.category||"").toLowerCase(),d=l.includes(s)||i.includes(s)||u.includes(s),g=p==="all"||parseInt(a.tl,10)===parseInt(p,10),y=m==="all"||(a.class||"").toUpperCase()===m;return d&&g&&y}),!v||v.length===0){e.innerHTML=`
            <div style="text-align:center;padding:1.5rem;color:var(--text3);">
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">📭</div>
                <div>No bestiary data loaded.<br><small>Check that /data/bestiary.json exists.</small></div>
            </div>
        `;return}if(k.length===0){e.innerHTML=`
            <div style="text-align:center;padding:1.5rem;color:var(--text3);">
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">🔍</div>
                <div>No creatures match your search or filters.</div>
            </div>
        `;return}const f=h();e.innerHTML=k.map(a=>{const l=a.name||"Unnamed",i=l.replace(/["']/g,""),u=a.tl!==void 0?`TL ${a.tl}`:"",d=a.class||"",g=a.category||"",y=T(a);let L="";return f?L=`
                <button class="btn btn-xs btn-primary bestiary-view-btn" data-name="${o(i)}" title="Details">📄</button>
                <button class="btn btn-xs btn-gold bestiary-add-adversary" data-name="${o(i)}" title="Add to current encounter">+ Add</button>
                <button class="btn btn-xs btn-green bestiary-open-tracker" data-name="${o(i)}" title="Open Combat Tracker">🎯</button>
            `:L='<span style="font-size:0.65rem;color:var(--text3);">🔒</span>',`
            <div class="bestiary-entry" data-name="${o(i)}">
                <div class="entry-main">
                    <span style="font-weight:600;font-size:0.9rem;min-width:0;overflow:hidden;text-overflow:ellipsis;">${o(l)}</span>
                    ${g?`<span class="badge badge-${getCategoryBadgeColor(g)}" style="font-size:0.6rem;">${o(g)}</span>`:""}
                    ${u?`<span class="creature-tag tl-badge">${o(u)}</span>`:""}
                    ${d?`<span class="creature-tag class-badge">Class ${o(d)}</span>`:""}
                    <span style="font-size:0.75rem;color:var(--text2);flex:1 1 100%;min-width:0;overflow:hidden;text-overflow:ellipsis;">${y?o(y.slice(0,90))+(y.length>90?"…":""):""}</span>
                </div>
                <div class="entry-actions">
                    ${L}
                </div>
            </div>
        `}).join(""),f&&(e.querySelectorAll(".bestiary-view-btn").forEach(a=>{a.addEventListener("click",l=>{l.stopPropagation();const i=a.dataset.name;v.find(u=>(u.name||"").toLowerCase()===i.toLowerCase())})}),e.querySelectorAll(".bestiary-add-adversary").forEach(a=>{a.addEventListener("click",l=>{l.stopPropagation();const i=a.dataset.name,u=v.find(d=>(d.name||"").toLowerCase()===i.toLowerCase());u?(z(u),w()):c(`❌ Creature "${i}" not found.`,"error")})}),e.querySelectorAll(".bestiary-open-tracker").forEach(a=>{a.addEventListener("click",l=>{l.stopPropagation();const i=a.dataset.name,u=v.find(d=>(d.name||"").toLowerCase()===i.toLowerCase());if(u){z(u);const d=E(),g=d.encounters.find(y=>y.status==="active")||d.encounters[d.encounters.length-1];g?V(g.id):c("Could not find encounter to open tracker.","error")}else c(`❌ Creature "${i}" not found.`,"error")})}))}function J(e,t){if(!h()){c("Only the GM can create encounters.","error");return}const n=E();n.encounters||(n.encounters=[]);const s={id:"enc-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),title:e,body:t,difficulty:2,location:"",status:"draft",type:G,adversaries:[{name:e,body:t}],created:Date.now()};n.encounters.push(s),A();try{S(`⚔️ Encounter created: ${s.title}`,"warning"),I("encounter_created",{name:s.title,id:s.id,status:s.status})}catch{}w(),c(`🃏 Created encounter from "${e}"`,"success")}function Z(e){if(!h()){c("Only the GM can delete encounters.","error");return}if(!confirm("Delete encounter?"))return;const t=E(),n=t.encounters.find(s=>s.id===e);if(n)try{S(`🗑️ Encounter deleted: ${n.title}`,"info"),I("encounter_deleted",{name:n.title,id:n.id})}catch{}t.encounters=(t.encounters||[]).filter(s=>s.id!==e),A(),w(),c("Encounter deleted.","success")}function N(e){if(!h()){c("Only the GM can edit encounters.","error");return}_(()=>import("./editor.CGdlKjIb.js").then(t=>{t.openEditor(e)}),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])).catch(t=>{console.error("Failed to load encounter editor:",t),c("Encounter editor not available.","error")})}function ee(e){if(!h()){c("Only the GM can open the combat tracker.","error");return}_(()=>import("./bestiary.CPB8-5uX.js").then(t=>t.a).then(t=>{t.openTracker(e)}),__vite__mapDeps([7,3,1,2,4,8,5,9,10,11,6,12,13,14,15])).catch(t=>{console.error("Failed to load combat tracker:",t),c("Combat tracker not available.","error")})}function q(){const e=document.getElementById("add-encounter-btn");if(e){const a=e.cloneNode(!0);e.parentNode.replaceChild(a,e),a.addEventListener("click",()=>{N(null)})}const t=document.getElementById("encounter-search");t&&t.addEventListener("input",w);const n=document.getElementById("bestiary-search");n&&n.addEventListener("input",x);const s=document.getElementById("bestiary-filter-tl");s&&s.addEventListener("change",x),document.getElementById("bestiary-class-filters")?.addEventListener("click",a=>{if(a.target.closest(".class-filter-btn")){document.querySelectorAll(".class-filter-btn").forEach(i=>{i.classList.remove("btn-primary","active-class"),i.classList.add("btn-ghost")});const l=a.target.closest(".class-filter-btn");l.classList.remove("btn-ghost"),l.classList.add("btn-primary","active-class"),x()}});const p=document.getElementById("bestiary-refresh");p&&p.addEventListener("click",async()=>{try{v=await H(),await j(),x(),c("Bestiary refreshed.","info")}catch{c("Failed to refresh bestiary.","error")}});const r=document.getElementById("sb-minus"),m=document.getElementById("sb-plus"),f=document.getElementById("sb-bank-input");r&&r.addEventListener("click",()=>M(-1)),m&&m.addEventListener("click",()=>M(1)),f&&f.addEventListener("change",()=>{const a=parseInt(f.value,10);b=isNaN(a)?0:Math.max(0,a),C(),$()})}function te(){B=null}var me={render:Y,destroy:te,attachEvents:q};export{q as attachEvents,me as default,te as destroy,Y as render};
