const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/kanban.DrreRx9x.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/rolldown-runtime.BQ-_32WO.js","assets/Toast.DDAtBIAw.js","assets/whiteboard.cXMCgdBG.js","assets/preload-helper.BATLnrmA.js","assets/websocket.Dmklt06W.js","assets/main.hiOZSyFC.js","assets/sync.i5xh8ufD.js","assets/main.DcCFXHiG.css","assets/bestiary.CPB8-5uX.js","assets/objective-types.CuiNbA6A.js","assets/discovery.I-q7Uafb.js","assets/kon-reh.DXBT9E4d.js","assets/toll-and-veil.BrACOVJV.js","assets/voice.D0Q3-VlJ.js","assets/turn.BEaIH0Xk.js","assets/travel-planner.BPl68lDQ.js","assets/decks.CN3iDKhv.js","assets/adventure-manager.BYGz956n.js","assets/timers.DECKYaq0.js","assets/encounters.DM8SkZZ1.js"])))=>i.map(i=>d[i]);
import{t as $e}from"./rolldown-runtime.BQ-_32WO.js";import{a as Se,i as u,n as Ee}from"./utils.lBShoim5.js";import{D as g,M as re,b as l,c as Ae,l as Ce,t as Le,v as q,y as Ie}from"./state.42sFgcOQ.js";import{n as i}from"./Toast.DDAtBIAw.js";import{t as w}from"./preload-helper.BATLnrmA.js";import"./websocket.Dmklt06W.js";import{S as Re,_ as ce,p as de,v as Be,x as _e}from"./main.hiOZSyFC.js";import{o as B}from"./talent-effects.CY-tOZj6.js";import{a as S,c as L,i as De,l as Me,o as Ne,r as P,s as qe}from"./decks.CN3iDKhv.js";var h=null,I=null,Pe=.5,ze=.8;function z(){const e=l();return(!e.soundboard||typeof e.soundboard!="object")&&(e.soundboard={tracks:[]}),Array.isArray(e.soundboard.tracks)||(e.soundboard.tracks=[]),e.soundboard}function O(){return z().tracks}function Oe({name:e,url:t,type:n="sfx",volume:s=1}){if(!e||!t)return null;const a=z(),o={id:Se("sound_"),name:e.trim(),url:t.trim(),type:n,volume:Math.min(1,Math.max(0,s))};return a.tracks.push(o),g(),o}function Ve(e){const t=z();return t.tracks=t.tracks.filter(n=>n.id!==e),I===e&&le(),g(),!0}function je(e){const t=O().find(n=>n.id===e);return t?(h&&(h.pause(),h.src=""),h=new Audio(t.url),h.loop=!0,h.volume=Pe*(t.volume??1),I=e,h.play().catch(n=>{console.warn("[Soundboard] Ambience playback blocked or failed:",n?.message)}),!0):!1}function le(){h&&(h.pause(),h.src="",h=null),I=null}function Fe(){return I}function Ge(e){const t=O().find(n=>n.id===e);if(!t)return!1;try{const n=new Audio(t.url);n.volume=ze*(t.volume??1),n.play().catch(s=>{console.warn("[Soundboard] SFX playback blocked or failed:",s?.message)})}catch(n){return console.warn("[Soundboard] Failed to play SFX:",n?.message),!1}return!0}var xt=$e({addSceneTag:()=>j,addVTTEvent:()=>ue,clearSceneTags:()=>G,default:()=>mt,destroy:()=>ke,getActiveAdventureTimers:()=>W,getSceneTags:()=>V,getTagEffects:()=>H,logToSession:()=>f,newSession:()=>te,onActivate:()=>he,onDeactivate:()=>ye,refresh:()=>xe,removeSceneTag:()=>F,render:()=>ve,resetAllTimers:()=>ee,sceneEndTrimBoons:()=>Y,tickActiveSceneTimer:()=>U}),_=null,p="scene",y={},me={notes:[],drawings:[],stickyNotes:[]},x={columns:{todo:{title:"📋 To Do",items:[]},doing:{title:"🔄 Doing",items:[]},done:{title:"✅ Done",items:[]},blocked:{title:"🚫 Blocked",items:[]}}},b={activeThreats:[],opportunities:[],campaignTimers:[],notes:"",sessionLog:[],sceneTags:[],vttEvents:[]},T=null,D=null;function E(){const e=l();e.campaign&&(me=e.campaign.whiteboard||{notes:[],drawings:[],stickyNotes:[]},x=e.campaign.kanban||{columns:{todo:{title:"📋 To Do",items:[]},doing:{title:"🔄 Doing",items:[]},done:{title:"✅ Done",items:[]},blocked:{title:"🚫 Blocked",items:[]}}},b=e.campaign.state||{activeThreats:[],opportunities:[],campaignTimers:[],notes:"",sessionLog:[],sceneTags:[],vttEvents:[]})}function v(){const e=l();e.campaign||(e.campaign={}),e.campaign.whiteboard=me,e.campaign.kanban=x,e.campaign.state=b,g()}function f(e,t="info"){const n=l();n.campaign||(n.campaign={}),n.campaign.state||(n.campaign.state={}),n.campaign.state.sessionLog||(n.campaign.state.sessionLog=[]),n.campaign.state.sessionLog.push({timestamp:new Date().toISOString(),time:new Date().toLocaleTimeString(),message:e,type:t}),g(),(p==="campaign"||p==="session")&&m()}function ue(e,t={}){const n=l();n.campaign||(n.campaign={}),n.campaign.state||(n.campaign.state={}),n.campaign.state.vttEvents||(n.campaign.state.vttEvents=[]);const s={timestamp:new Date().toISOString(),type:e,data:t};return n.campaign.state.vttEvents.push(s),g(),s}function k(){return(l().adventures||[]).find(e=>e.status==="active")||null}function He(){const e=k();if(!e)return`
            <div class="panel">
                <h3 class="panel-title">📖 Current Adventure</h3>
                <p class="text-muted mt-1">No adventure is currently active. Start one from Adventure Manager.</p>
                <button class="btn btn-sm btn-secondary mt-1" onclick="window.openAdventureManager()">📖 Open Adventure Manager</button>
            </div>
        `;const t=e.acts?.[e.currentAct],n=t?.scenes?.[e.currentScene],s=e.acts?.reduce((o,r)=>o+(r.scenes?.length||0),0)||0,a=e.acts?.reduce((o,r)=>o+(r.scenes?.filter(c=>c.completed).length||0),0)||0;return`
        <div class="panel" style="border-left: 4px solid var(--gold);">
            <div class="flex-between">
                <h3 class="panel-title">📖 ${u(e.title)}</h3>
                <span class="text-xs text-muted">${a}/${s} scenes</span>
            </div>
            ${t&&n?`
                <div class="text-sm mt-1"><span class="text-muted">Act:</span> ${u(t.title)}</div>
                <div class="text-sm"><span class="text-muted">Scene:</span> ${u(n.title)}</div>
                <div class="flex gap-1 mt-2 flex-wrap">
                    <button class="btn btn-sm btn-danger" onclick="window.gmStartSceneEncounter()">⚔️ ${n.encounterId?"Resume":"Start"} Encounter</button>
                    ${n.completed?'<span class="badge badge-gold">✅ Scene Complete</span>':'<button class="btn btn-sm btn-primary" onclick="window.gmCompleteScene()">✓ Complete Scene</button>'}
                    <button class="btn btn-sm btn-secondary" onclick="window.openAdventureManager()">📖 Full Details</button>
                </div>
            `:`
                <p class="text-muted mt-1">This adventure has no scenes defined yet.</p>
                <button class="btn btn-sm btn-secondary mt-1" onclick="window.openAdventureManager()">📖 Open Adventure Manager</button>
            `}
        </div>
    `}function V(){return l().campaign?.state?.sceneTags||[]}function j(e){if(e=e.toUpperCase().trim(),!e)return i("Please enter a tag name.","warning"),!1;const t=l();return t.campaign||(t.campaign={}),t.campaign.state||(t.campaign.state={}),t.campaign.state.sceneTags||(t.campaign.state.sceneTags=[]),t.campaign.state.sceneTags.includes(e)?(i(`Tag [${e}] already active.`,"warning"),!1):(t.campaign.state.sceneTags.push(e),g(),m(),f(`🏷️ Tag applied: [${e}]`,"info"),i(`Tag [${e}] applied.`,"success"),!0)}function F(e){const t=l();return t.campaign?.state?.sceneTags?(t.campaign.state.sceneTags=t.campaign.state.sceneTags.filter(n=>n!==e),g(),m(),f(`🏷️ Tag removed: [${e}]`,"info"),!0):!1}function G(){const e=l();e.campaign?.state?.sceneTags&&(e.campaign.state.sceneTags=[],g(),m(),f("🏷️ All tags cleared.","info"),i("All tags cleared.","info"))}function H(){const e=V();let t=0,n=0;return e.forEach(s=>{switch(s){case"WARD":t+=1;break;case"FIRE":n-=1;break;case"DARK":n-=1;break;case"LIGHT":n+=1;break;case"COLD":n-=1;break;case"NOISY":n-=1;break;case"SILENT":n+=1;break;case"CROWDED":n-=1;break;case"WIND":n+=1;break;case"WET":n-=1;break;case"DRY":n+=1;break;case"UNSTABLE":n-=1}}),{dvMod:t,posMod:n,activeTags:e}}var se={acasia:{first:["Alboin","Authari","Liutprand","Desiderius"],surnames:["da Ponte","del Ferro","di Rocca"],epithets:["the Stiff","Bridge-Born","Ash-Finger"]},ecktoria:{first:["Valerius","Jackson","Lucius","Tiberius"],surnames:["de Urbe","Aquilinus","Lateranus"],epithets:["the Iron","Flame-Touched","Bread-Counter"]},vhasia:{first:["Valdais","Wymund","Renaud","Corin"],surnames:["de la Marche","l'Ever","de Lence"],epithets:["the Unwed","Bell-Sworn","Ash-Banner"]}};function Ke(e){const t=e?.toLowerCase()||"acasia";return se[t]||se.acasia}function R(e){return e[Math.floor(Math.random()*e.length)]}function We(e){const t=Ke(e);return{name:R(t.first),surname:R(t.surnames),epithet:R(t.epithets)}}function $(e,t,n){const s=n[e];if(!s||s.length===0)return`A complication of ${e} arises.`;const a=e+t;let o=0;for(let r=0;r<a.length;r++)o=(o<<5)-o+a.charCodeAt(r),o=o&o;return s[Math.abs(o)%s.length]}async function pe(){const e=S()||"Acasia",t=P();if(!t)return i("No region data loaded.","error");try{const n=await L(2);if(!n)return;const s=n.cards,a=s[0]?$(s[0].suit,s[0].rank,t):"A matter of loyalty arises.",o=s[1]?$(s[1].suit,s[1].rank,t):"No complication.",r=We(e);T={type:"npc",data:{name:`${r.name} ${r.surname}`,role:r.epithet,motivation:`${a} Complication: ${o}`}},K(Ue({...r,motivation:a,complication:o})),f(`👤 Generated NPC: ${r.name} "${r.epithet}"`,"success")}catch{i("Error generating NPC.","error")}}async function ge(){const e=S()||"Acasia",t=P();if(!t)return i("No region data loaded.","error");try{const n=await L(2);if(!n)return;const s=n.cards,a=s[0]?$(s[0].suit,s[0].rank,t):"A place of significance.",o=s[1]?$(s[1].suit,s[1].rank,t):"A hidden opportunity.",r=a.length>30?a.substring(0,30)+"...":a;T={type:"location",data:{name:r,description:`${a} Leverage: ${o}`}},K(Qe({name:r,place:a,leverage:o,region:e})),f(`📍 Generated Location: ${r}`,"success")}catch{i("Error generating location.","error")}}async function be(){const e=S()||"Acasia",t=P();if(!t)return i("No region data loaded.","error");try{const n=await L(1);if(!n)return;const s=n.cards[0],a=s?$(s.suit,s.rank,t):"A rumor is circulating.";T={type:"rumor",data:{text:a,region:e}},K(Je({text:a,region:e})),f(`📜 Generated Rumor: ${a.substring(0,50)}...`,"info")}catch{i("Error generating rumor.","error")}}function Ue(e){return`
        <div class="flex flex-col gap-1">
            <strong class="text-gold">${e.name} ${e.surname}</strong>
            <em class="text-muted">“${e.epithet}”</em>
            <div class="text-sm mt-1"><span class="text-muted">🎯 Motivation:</span> ${e.motivation}</div>
            <div class="text-sm"><span class="text-muted">⚡ Complication:</span> ${e.complication}</div>
            <button class="btn btn-xs btn-primary mt-1" style="align-self:flex-start;" onclick="window.gmSaveQuickGenToAdventure()">📌 Save to Adventure</button>
        </div>
    `}function Qe(e){return`
        <div class="flex flex-col gap-1">
            <strong class="text-gold">📍 ${e.name}</strong>
            <div class="text-sm text-muted">Region: ${e.region}</div>
            <div class="text-sm mt-1"><span class="text-muted">Place:</span> ${e.place}</div>
            <div class="text-sm"><span class="text-muted">Leverage:</span> ${e.leverage}</div>
            <button class="btn btn-xs btn-primary mt-1" style="align-self:flex-start;" onclick="window.gmSaveQuickGenToAdventure()">📌 Save to Adventure</button>
        </div>
    `}function Je(e){return`
        <div class="flex flex-col gap-1">
            <div class="text-sm italic">“${e.text}”</div>
            <div class="text-xs text-muted">Region: ${e.region}</div>
            <button class="btn btn-xs btn-primary mt-1" style="align-self:flex-start;" onclick="window.gmSaveQuickGenToAdventure()">📌 Save to Adventure Notes</button>
        </div>
    `}function K(e){const t=document.getElementById("quick-gen-result");t&&(t.innerHTML=e,t.style.borderLeftColor="var(--gold)")}function W(){const e=k();return!e||!e.timerIds||e.timerIds.length===0?[]:(l().timers||[]).filter(t=>e.timerIds.includes(t.id))}function U(e,t=1){const n=k();if(!n)return console.warn("[GM Tools] No active adventure to tick timers."),!1;n.id!==e&&console.warn("[GM Tools] Tick requested for adventure "+e+" but active is "+n.id);const s=W();if(s.length===0)return console.warn("[GM Tools] No timers linked to active adventure."),!1;let a=!1;return s.forEach(o=>{const r=o.current;if(o.current=Math.min(o.current+t,o.segments),o.current!==r){a=!0;const c=l(),d=c.timers.findIndex(Te=>Te.id===o.id);d!==-1&&(c.timers[d]=o),g(),o.current>=o.segments&&(i(`⏱️ Timer "${o.name}" completed!`,"warning"),f(`⏱️ Timer "${o.name}" completed!`,"warning"),document.dispatchEvent(new CustomEvent("timer-completed",{detail:{timerId:o.id,adventureId:n.id}})))}}),a&&(m(),i(`⏱️ Timers ticked (${t}) for "${n.title}"`,"info")),a}function Ze(e){if(!q().autoTickTimers)return;const{adventureId:t,amount:n=1}=e.detail||{},s=k();if(!s){console.warn("[GM Tools] Timer tick requested but no active adventure.");return}U(t||s.id,n)}function Xe(e){const{count:t=1}=e.detail||{},n=(q().sbBank||0)+t;re({sbBank:n}),i(`🎲 Story Beat +${t} (Total: ${n})`,"info"),f(`🎲 Story Beat +${t} (Bank: ${n})`,"success")}function Ye(){document.addEventListener("timer-tick-request",Ze),document.addEventListener("sb-generated",Xe),console.log("[GM Tools] Automation listeners initialized.")}function ve(e){_=e,E();const t=Ie();Be(t),window.__gmAutomationInitialized||(Ye(),window.__gmAutomationInitialized=!0);const{accessible:n,reason:s}=de("gm-tools");_.innerHTML=`
        <div class="gm-tools-modern-layout flex flex-col gap-2">
            <header class="gm-tools-header">
                <h1 class="page-title">⚙️ GM Tools</h1>
                <p class="page-sub">Manage scenes, campaign tracking, whiteboard, Kanban board, and journey planning.</p>
                ${n?"":`<div class="text-muted text-sm" style="color:var(--gold);">👁️ View-only mode: ${s==="gm-only"?"Only the GM can access these tools.":"You have hidden this feature from your sidebar."}</div>`}
            </header>

            <div class="flex gap-1 flex-center flex-wrap" style="border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                <button class="btn btn-sm btn-gold gm-tab active" data-view="scene">🎬 Scene</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="kanban">📋 Kanban</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="whiteboard">✏️ Whiteboard</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="campaign">🏛️ Campaign</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="consequences">🃏 Consequences</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="travel">🗺️ Travel</button>
                <button class="btn btn-sm btn-secondary gm-tab" data-view="session">🎥 Session</button>
            </div>

            <div id="gm-view-container" class="flex flex-col gap-2">
                ${Q("scene")}
            </div>
        </div>
    `,ne()}function Q(e){switch(p=e,E(),e){case"scene":return oe();case"kanban":return ot();case"whiteboard":return it();case"campaign":return rt();case"consequences":return ct();case"travel":return dt();case"session":return lt();default:return oe()}}function et(){const e=l();return e.campaign||(e.campaign={}),e.campaign.safety||(e.campaign.safety={lines:"",veils:"",sessionZero:{}}),e.campaign.safety}function ae(e){const t=l();t.campaign||(t.campaign={}),t.campaign.safety||(t.campaign.safety={lines:"",veils:"",sessionZero:{}}),Object.assign(t.campaign.safety,e),g(),m()}function tt(){const e=et();return`
        <div class="panel">
            <h3 class="panel-title">🛡️ Safety Tools</h3>
            <p class="text-muted text-sm">Set your group's safety boundaries. These will be shown when the X‑Card is called.</p>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.5rem;">
                <div>
                    <label style="font-size:0.8rem;font-weight:600;">Lines (never to appear)</label>
                    <textarea id="safety-lines" rows="2" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;font-size:0.8rem;">${u(e.lines||"")}</textarea>
                    <span class="text-muted text-xs">Things that are absolutely off-limits.</span>
                </div>
                <div>
                    <label style="font-size:0.8rem;font-weight:600;">Veils (fade to black)</label>
                    <textarea id="safety-veils" rows="2" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;font-size:0.8rem;">${u(e.veils||"")}</textarea>
                    <span class="text-muted text-xs">Things that can happen off-screen.</span>
                </div>
            </div>

            <button class="btn btn-sm btn-primary mt-1" id="safety-save-btn">💾 Save Safety Settings</button>

            <details style="margin-top:0.5rem;">
                <summary style="cursor:pointer;font-size:0.8rem;color:var(--text2);">📋 Session Zero Checklist</summary>
                <div style="padding:0.5rem 0.3rem;font-size:0.8rem;">
                    ${nt(e.sessionZero||{})}
                </div>
            </details>
        </div>
    `}function nt(e){return[{id:"tone",label:"Tone of the campaign",placeholder:"e.g., heroic, grim, mysterious"},{id:"length",label:"Campaign length",placeholder:"e.g., one-shot, 6 sessions, ongoing"},{id:"characterHooks",label:"Character hooks",placeholder:"What themes are you excited to explore?"}].map(t=>`
        <div style="margin-bottom:0.3rem;">
            <label style="font-size:0.75rem;">${u(t.label)}</label>
            <input type="text" id="sz-${t.id}" value="${u(e[t.id]||"")}" placeholder="${u(t.placeholder)}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.2rem 0.4rem;font-size:0.8rem;" />
        </div>
    `).join("")+`
        <div style="margin-bottom:0.3rem;">
            <label class="inline-check" style="font-size:0.75rem;">
                <input type="checkbox" id="sz-consent" ${e.consent?"checked":""} />
                I have discussed consent with the group.
            </label>
        </div>
        <button class="btn btn-xs btn-secondary" id="sz-save-btn">Save Session Zero</button>
    `}function st(e){const t=O(),n=t.filter(c=>c.type==="ambience"),s=t.filter(c=>c.type==="sfx"),a=Fe(),o=n.map(c=>`<option value="${c.id}" ${c.id===a?"selected":""}>${u(c.name)}</option>`).join(""),r=s.map(c=>`
        <span style="display:inline-flex;align-items:center;gap:0.2rem;background:var(--bg3);border:1px solid var(--border);border-radius:999px;padding:0.2rem 0.3rem 0.2rem 0.6rem;font-size:0.78rem;">
            <button type="button" class="btn-sound-sfx" data-id="${c.id}" style="background:none;border:none;color:var(--text);cursor:pointer;font-size:0.78rem;padding:0;" ${e?"disabled":""}>🔊 ${u(c.name)}</button>
            <button type="button" class="btn-sound-remove" data-id="${c.id}" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:0.72rem;padding:0 0.2rem;" ${e?"disabled":""} title="Remove">✕</button>
        </span>
    `).join("");return`
        <div class="panel">
            <h3 class="panel-title">🔊 Soundboard</h3>
            <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.3rem;">
                <div>
                    <label style="font-size:0.75rem;color:var(--text2);">Ambience (loops)</label>
                    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-top:0.2rem;">
                        <select id="sb-ambience-select" style="flex:1;min-width:140px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.2rem 0.4rem;font-size:0.8rem;" ${e?"disabled":""}>
                            <option value="">${n.length?"— choose ambience —":"No ambience tracks yet"}</option>
                            ${o}
                        </select>
                        <button class="btn btn-xs btn-secondary" id="sb-ambience-play" ${e?"disabled":""}>▶ Play</button>
                        <button class="btn btn-xs btn-secondary" id="sb-ambience-stop" ${e||!a?"disabled":""}>⏹ Stop</button>
                    </div>
                </div>
                <div>
                    <label style="font-size:0.75rem;color:var(--text2);">SFX (one-shot)</label>
                    <div id="sb-sfx-list" style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.2rem;">
                        ${r||'<span style="font-size:0.75rem;color:var(--text3);">No SFX yet.</span>'}
                    </div>
                </div>
                <div>
                    <button class="btn btn-xs btn-secondary" id="sb-add-sound-btn" ${e?"disabled":""}>+ Add Sound</button>
                </div>
            </div>
        </div>
    `}function at(){const e=prompt('Sound name (e.g. "Tavern murmur", "Sword clash"):');if(!e||!e.trim())return;const t=prompt("Audio URL (mp3/ogg/wav link):");if(!t||!t.trim())return;const n=confirm(`Is this a looping AMBIENCE track?

OK = Ambience (loops)
Cancel = one-shot SFX`);Oe({name:e.trim(),url:t.trim(),type:n?"ambience":"sfx"}),i(`🔊 Added "${e.trim()}" to the soundboard.`,"success"),m()}function M(){document.getElementById("sb-add-sound-btn")?.addEventListener("click",at),document.getElementById("sb-ambience-play")?.addEventListener("click",()=>{const e=document.getElementById("sb-ambience-select")?.value;if(!e){i("Choose an ambience track first.","warning");return}je(e),m()}),document.getElementById("sb-ambience-stop")?.addEventListener("click",()=>{le(),m()}),document.querySelectorAll(".btn-sound-sfx").forEach(e=>{e.addEventListener("click",()=>Ge(e.dataset.id))}),document.querySelectorAll(".btn-sound-remove").forEach(e=>{e.addEventListener("click",()=>{Ve(e.dataset.id),m()})})}function oe(){const e=l(),t=e.timers||[],n=e.encounters||[],s=e.characters||[],a=H(),o=q().autoTickTimers||!1,{accessible:r}=de("gm-tools"),c=!r;return`
        <div class="flex flex-col gap-2">
            ${He()}

            <div class="panel">
                <h3 class="panel-title">⚙️ GM Settings</h3>
                <div class="flex gap-1 flex-center flex-wrap mt-1">
                    <label class="inline-check" style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                        <input type="checkbox" id="auto-tick-toggle" ${o?"checked":""} ${c?"disabled":""} />
                        <span>Auto-tick active timers on Partial/Miss</span>
                    </label>
                    <span class="text-muted text-xs">(Story Beats auto‑increment the SB Bank)</span>
                </div>
            </div>
            ${tt()}
            <div class="panel">
                <h3 class="panel-title">⚡ Quick Actions</h3>
                <div class="grid-2 mt-1">
                    <button class="btn btn-secondary" onclick="window.sceneEndTrimBoons()" ${c?"disabled":""}>✂️ Trim Boons</button>
                    <button class="btn btn-secondary" onclick="window.resetAllTimers()" ${c?"disabled":""}>⏱️ Reset Timers</button>
                    <button class="btn btn-secondary" onclick="window.newSession()" ${c?"disabled":""}>📦 New Session</button>
                    <button class="btn btn-secondary" onclick="window.openCombatTracker()" ${c?"disabled":""}>⚔️ Combat Tracker</button>
                    <button class="btn btn-secondary" onclick="window.openKanban()">📋 Kanban Board</button>
                    <button class="btn btn-secondary" onclick="window.openWhiteboard()">✏️ Whiteboard</button>
                    <button class="btn btn-secondary" onclick="window.openCrownSpread()">👑 Crown Spread</button>
                    <button class="btn btn-secondary" onclick="window.openTravelPlanner()">🗺️ Travel Planner</button>
                </div>
            </div>

            ${st(c)}

            <div class="panel">
                <h3 class="panel-title">⚡ Quick Generate</h3>
                <div class="flex gap-1 flex-center flex-wrap mt-1">
                    <button class="btn btn-sm btn-gold" id="gen-npc-btn" ${c?"disabled":""}>👤 NPC</button>
                    <button class="btn btn-sm btn-gold" id="gen-location-btn" ${c?"disabled":""}>📍 Location</button>
                    <button class="btn btn-sm btn-gold" id="gen-rumor-btn" ${c?"disabled":""}>📜 Rumor</button>
                    <span class="text-muted text-sm mx-auto">Uses current region's deck</span>
                </div>
                <div id="quick-gen-result" class="mt-1 panel" style="background:var(--bg3); border-left: 3px solid var(--border);">
                    <span class="text-muted text-sm">Generate an NPC, Location, or Rumor.</span>
                </div>
            </div>

            <div class="panel">
                <h3 class="panel-title">🏷️ Scene Tags</h3>
                <div class="flex gap-1 flex-center flex-wrap mt-1">
                    <input type="text" id="scene-tag-input" placeholder="e.g., WARD, FIRE, DARK" class="flex-1" style="min-width: 120px;" ${c?"disabled":""} />
                    <button class="btn btn-sm btn-primary" id="scene-tag-add-btn" ${c?"disabled":""}>+ Add Tag</button>
                    <button class="btn btn-sm btn-secondary" id="scene-tag-clear-btn" ${c?"disabled":""}>Clear All</button>
                </div>
                <div id="scene-tag-container" class="flex gap-1 flex-wrap mt-1">
                    ${a.activeTags.length===0?'<span class="text-muted text-sm">No tags active.</span>':""}
                    ${a.activeTags.map(d=>`
                        <span class="badge badge-gold flex gap-1 flex-center">[${d}] <span class="gm-tag-remove" data-tag="${d}" style="cursor:pointer;color:var(--red);font-size:0.7rem;">✕</span></span>
                    `).join("")}
                </div>
                ${a.activeTags.length>0?`
                    <div class="text-xs text-muted mt-1 flex gap-1 flex-wrap">
                        ${a.dvMod!==0?`<span class="badge badge-red">DV ${a.dvMod>0?"+":""}${a.dvMod}</span>`:""}
                        ${a.posMod!==0?`<span class="badge badge-blue">Pos ${a.posMod>0?"+":""}${a.posMod}</span>`:""}
                    </div>
                `:""}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">⏱️ Active Timers</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addTimerFromScene()" ${c?"disabled":""}>+ Add Timer</button>
                </div>
                ${t.length===0?'<p class="text-muted mt-1">No active timers.</p>':`
                    <div class="flex flex-col gap-1 mt-1">
                        ${t.map(d=>`
                            <div class="flex gap-1 flex-center">
                                <span class="flex-1 text-sm">${u(d.name)}</span>
                                <div class="timer-progress flex-1" style="background:var(--bg3); border-radius:var(--radius); height:8px; overflow:hidden;">
                                    <div style="width:${d.current/d.segments*100}%; height:100%; background:var(--gold);"></div>
                                </div>
                                <span class="text-xs text-muted">${d.current}/${d.segments}</span>
                                <button class="btn btn-xs btn-ghost" onclick="window.tickTimer('${d.id}')" ${c?"disabled":""}>+1</button>
                            </div>
                        `).join("")}
                    </div>
                `}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">⚔️ Active Encounters</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addEncounterFromScene()" ${c?"disabled":""}>+ Add Encounter</button>
                </div>
                ${n.length===0?'<p class="text-muted mt-1">No active encounters.</p>':`
                    <div class="flex flex-col gap-1 mt-1">
                        ${n.map(d=>`
                            <div class="flex gap-1 flex-center">
                                <span class="flex-1 text-sm">${u(d.name)}</span>
                                ${d.fromAdventureTitle?`<span class="badge badge-purple" title="From scene: ${u(d.fromSceneTitle||"")}">📖 ${u(d.fromAdventureTitle)}</span>`:""}
                                <span class="badge badge-red">${d.status||"active"}</span>
                                <button class="btn btn-xs btn-primary" onclick="window.openEncounterTracker('${d.id}')" ${c?"disabled":""}>⚔️ Track</button>
                            </div>
                        `).join("")}
                    </div>
                `}
            </div>

            <div class="panel">
                <h3 class="panel-title">👤 Characters</h3>
                <div class="flex flex-wrap gap-1 mt-1">
                    ${s.map(d=>`
                        <div class="panel flex gap-1 flex-center" style="padding: 0.3rem 0.6rem; background: var(--bg3);">
                            <span class="text-sm">${u(d.name)}</span>
                            <span class="badge badge-gold">🪙 ${d.boons||0}</span>
                            <span class="badge badge-purple">⚡ ${d.fatigue||0}</span>
                        </div>
                    `).join("")}
                    ${s.length===0?'<p class="text-muted">No characters loaded.</p>':""}
                </div>
            </div>
        </div>
    `}function ot(){const e=x.columns;return`
        <div class="kanban-view">
            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">📋 Campaign Kanban</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addKanbanItem()">+ Add Item</button>
                </div>
                <div class="grid-2 mt-1">
                    ${Object.entries(e).map(([t,n])=>`
                        <div class="panel" data-column="${t}" style="background:var(--bg3); min-height: 150px;">
                            <div class="panel-title text-sm">${n.title}</div>
                            <div class="flex flex-col gap-1 mt-1">
                                ${n.items.length===0?'<p class="text-muted text-xs">Empty</p>':""}
                                ${n.items.map((s,a)=>`
                                    <div class="panel" data-column="${t}" data-index="${a}" style="padding: 0.5rem; background: var(--bg2); border-left: 3px solid var(--gold);">
                                        <div class="text-sm font-bold">${u(s.title)}</div>
                                        ${s.description?`<div class="text-xs text-muted mt-1">${u(s.description)}</div>`:""}
                                        <div class="flex gap-1 mt-1 flex-center">
                                            <button class="btn btn-xs btn-ghost" onclick="window.moveKanbanItem('${t}', ${a}, -1)">←</button>
                                            <button class="btn btn-xs btn-ghost" onclick="window.moveKanbanItem('${t}', ${a}, 1)">→</button>
                                            <button class="btn btn-xs btn-danger ml-auto" onclick="window.removeKanbanItem('${t}', ${a})">✕</button>
                                        </div>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>
    `}function it(){return`
        <div class="panel flex-center" style="min-height: 200px;">
            <div class="text-center">
                <div style="font-size:2rem;margin-bottom:0.5rem;">⏳</div>
                <p class="text-muted">Loading whiteboard...</p>
            </div>
        </div>
    `}function rt(){const e=l().campaign?.state||{activeThreats:[],opportunities:[],campaignTimers:[],notes:"",sessionLog:[]},t=e.activeThreats||[],n=e.opportunities||[],s=e.campaignTimers||[],a=e.sessionLog||[];return`
        <div class="flex flex-col gap-2">
            <div class="panel">
                <h3 class="panel-title">📝 Campaign Notes</h3>
                <textarea id="campaign-notes" rows="4" class="mt-1">${u(e.notes||"")}</textarea>
                <button class="btn btn-sm btn-primary mt-1" onclick="window.saveCampaignNotes()">💾 Save Notes</button>
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">⚠️ Active Threats</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addCampaignThreat()">+ Add Threat</button>
                </div>
                ${t.length===0?'<p class="text-muted mt-1">No active threats.</p>':`
                    <div class="flex flex-col gap-1 mt-1">
                        ${t.map((o,r)=>`
                            <div class="panel" style="padding: 0.5rem; background: var(--bg3); border-left: 4px solid ${o.severity==="high"?"var(--red)":o.severity==="medium"?"var(--orange)":"var(--gold)"};">
                                <div class="flex gap-1 flex-center">
                                    <span class="text-sm flex-1">${u(o.name)}</span>
                                    <span class="badge ${o.severity==="high"?"badge-red":"badge-gold"}">${o.severity||"medium"}</span>
                                    <button class="btn btn-xs btn-danger" onclick="window.removeCampaignThreat(${r})">✕</button>
                                </div>
                                ${o.description?`<div class="text-xs text-muted mt-1">${u(o.description)}</div>`:""}
                            </div>
                        `).join("")}
                    </div>
                `}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">🌟 Opportunities</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addCampaignOpportunity()">+ Add Opportunity</button>
                </div>
                ${n.length===0?'<p class="text-muted mt-1">No opportunities tracked.</p>':`
                    <div class="flex flex-col gap-1 mt-1">
                        ${n.map((o,r)=>`
                            <div class="flex gap-1 flex-center panel" style="padding: 0.5rem; background: var(--bg3); border-left: 4px solid var(--green);">
                                <span class="text-sm flex-1">${u(o.name)}</span>
                                <button class="btn btn-xs btn-danger" onclick="window.removeCampaignOpportunity(${r})">✕</button>
                            </div>
                        `).join("")}
                    </div>
                `}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">⏱️ Campaign Timers</h3>
                    <button class="btn btn-sm btn-primary" onclick="window.addCampaignTimer()">+ Add Timer</button>
                </div>
                ${s.length===0?'<p class="text-muted mt-1">No campaign timers.</p>':`
                    <div class="flex flex-col gap-1 mt-1">
                        ${s.map((o,r)=>`
                            <div class="flex gap-1 flex-center">
                                <span class="text-sm flex-1">${u(o.name)}</span>
                                <span class="text-xs text-muted">${o.current}/${o.segments}</span>
                                <button class="btn btn-xs btn-primary" onclick="window.tickCampaignTimer(${r})">+1</button>
                                <button class="btn btn-xs btn-danger" onclick="window.removeCampaignTimer(${r})">✕</button>
                            </div>
                        `).join("")}
                    </div>
                `}
            </div>

            <div class="panel">
                <div class="flex-between">
                    <h3 class="panel-title">📋 Session Log</h3>
                    <div class="flex gap-1">
                        <button class="btn btn-sm btn-secondary" onclick="window.copySessionLog()">📋 Copy</button>
                        <button class="btn btn-sm btn-danger" onclick="window.clearSessionLog()">🗑️ Clear</button>
                    </div>
                </div>
                <div id="session-log-container" class="mt-1 panel" style="max-height:250px; overflow-y:auto; background:var(--bg2); padding: 0.5rem; font-family: var(--font-mono); font-size: 0.85rem;">
                    ${a.length===0?'<span class="text-muted text-sm">No events logged yet.</span>':a.map(o=>`
                            <div style="padding:0.2rem 0;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;">
                                <span class="text-muted" style="white-space:nowrap;">[${o.time}]</span>
                                <span style="color:${o.type==="success"?"var(--green)":o.type==="warning"?"var(--orange)":o.type==="danger"?"var(--red)":"var(--text)"};">${o.message}</span>
                            </div>
                        `).join("")}
                </div>
            </div>
        </div>
    `}function ct(){const e=De()||["Acasia"],t=S()||"Acasia";return`
        <div class="flex flex-col gap-2">
            <div class="panel">
                <h3 class="panel-title">🃏 Deck of Consequences</h3>
                <p class="text-muted text-sm">Draw cards from the Deck of Consequences or use the Crown Spread.</p>
                
                <div class="flex gap-1 flex-center flex-wrap mt-1 panel" style="background:var(--bg3); border-left: 3px solid var(--gold);">
                    <span class="text-sm text-muted">📍 Region:</span>
                    <select id="scene-consequences-region-select" class="flex-1" style="max-width: 200px;">
                        ${e.map(n=>`<option value="${n}" ${n===t?"selected":""}>${n}</option>`).join("")}
                    </select>
                </div>
                
                <div class="flex gap-1 flex-wrap mt-2">
                    <button class="btn btn-sm btn-gold" onclick="window.quickDrawConsequence(1)">🃏 Draw 1</button>
                    <button class="btn btn-sm btn-gold" onclick="window.quickDrawConsequence(2)">🃏 Draw 2</button>
                    <button class="btn btn-sm btn-gold" onclick="window.quickDrawConsequence(3)">🃏 Draw 3</button>
                    <button class="btn btn-sm btn-primary" onclick="window.quickCrownSpreadFromScene()">👑 Crown Spread</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.shuffleDeck()">🔀 Shuffle</button>
                </div>
                
                <div id="consequence-result" class="mt-2 panel" style="min-height:80px; background:var(--bg3);">
                    <p class="text-muted text-sm">Draw cards to see a consequence.</p>
                </div>
                
                <div id="crown-spread-result" style="margin-top:1rem;display:none;" class="panel" style="border: 2px solid var(--gold);">
                    <h4 class="text-gold">👑 Crown Spread</h4>
                    <div id="crown-spread-cards" class="flex gap-1 flex-wrap flex-center mt-1"></div>
                    <div id="crown-spread-interpretation" class="text-muted mt-1 text-sm"></div>
                </div>
            </div>
            
            <div class="panel">
                <h3 class="panel-title">📋 Quick Reference</h3>
                <div class="grid-2 mt-1">
                    <div class="panel" style="background:var(--bg3); border-left: 3px solid var(--gold);">
                        <strong class="text-gold">1 SB</strong>
                        <div class="text-sm text-muted mt-1">Minor pressure, noise, tick timer +1</div>
                    </div>
                    <div class="panel" style="background:var(--bg3); border-left: 3px solid var(--orange);">
                        <strong style="color:var(--orange);">2 SB</strong>
                        <div class="text-sm text-muted mt-1">Moderate setback, alarm, lesser foe</div>
                    </div>
                    <div class="panel" style="background:var(--bg3); border-left: 3px solid var(--red);">
                        <strong style="color:var(--red);">3 SB</strong>
                        <div class="text-sm text-muted mt-1">Serious trouble, reinforcements, gear breaks</div>
                    </div>
                    <div class="panel" style="background:var(--bg3); border-left: 3px solid var(--purple);">
                        <strong style="color:var(--purple);">4+ SB</strong>
                        <div class="text-sm text-muted mt-1">Major turn, trap, authority arrives</div>
                    </div>
                </div>
            </div>
        </div>
    `}function dt(){return`
        <div class="panel flex-center" style="min-height: 200px;">
            <div class="text-center">
                <div style="font-size:2rem;margin-bottom:0.5rem;">⏳</div>
                <p class="text-muted">Loading travel planner...</p>
                <button class="btn btn-sm btn-primary mt-2" onclick="window.loadTravelPlanner()">🔄 Load</button>
            </div>
        </div>
    `}function lt(){const e=l().campaign?.state||{sessionLog:[],vttEvents:[]},t=e.sessionLog||[],n=e.vttEvents||[],s=ce();return`
        <div class="flex flex-col gap-2">
            <div class="panel">
                <h3 class="panel-title">🎙️ Session Recap & Save</h3>
                <p class="text-muted text-sm">Capture your session with voice recording, VTT event logging, and export a bundle.</p>
                
                <div class="flex gap-1 flex-wrap mt-2">
                    <button class="btn btn-primary" id="session-record-btn" ${s.isRecording?'style="display:none;"':""}>🎤 Record</button>
                    <button class="btn btn-danger" id="session-stop-btn" ${s.isRecording?"":'style="display:none;"'}>⏹️ Stop</button>
                    <button class="btn btn-secondary" id="session-export-btn">📦 Export Bundle</button>
                    <button class="btn btn-secondary" id="session-clear-btn">🧹 Clear Session</button>
                </div>
                <div id="session-recording-status" class="text-sm text-muted mt-1">
                    ${s.isRecording?`🔴 Recording... (${Math.floor(s.duration)}s)`:"Not recording"}
                </div>
            </div>
            
            <div class="panel">
                <h3 class="panel-title">📋 Session Log</h3>
                <div id="session-log-display" class="mt-1 panel" style="max-height:200px; overflow-y:auto; background:var(--bg2); padding: 0.5rem; font-family: var(--font-mono); font-size: 0.85rem;">
                    ${t.length===0?'<span class="text-muted text-sm">No events logged yet.</span>':t.map(a=>`
                            <div style="padding:0.2rem 0;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;">
                                <span class="text-muted" style="white-space:nowrap;">[${a.time}]</span>
                                <span style="color:${a.type==="success"?"var(--green)":a.type==="warning"?"var(--orange)":a.type==="danger"?"var(--red)":"var(--text)"};">${a.message}</span>
                            </div>
                        `).join("")}
                </div>
            </div>
            
            <div class="panel">
                <h3 class="panel-title">🎬 VTT Events</h3>
                <div id="vtt-events-display" class="mt-1 panel" style="max-height:150px; overflow-y:auto; background:var(--bg2); padding: 0.5rem; font-family: var(--font-mono); font-size: 0.85rem;">
                    ${n.length===0?'<span class="text-muted text-sm">No VTT events captured.</span>':n.slice().reverse().map(a=>`
                            <div style="padding:0.2rem 0;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;">
                                <span class="text-muted" style="white-space:nowrap;">[${new Date(a.timestamp).toLocaleTimeString()}]</span>
                                <span style="color:var(--text);">${a.type}</span>
                                ${a.data?`<span class="text-muted">${JSON.stringify(a.data).substring(0,60)}</span>`:""}
                            </div>
                        `).join("")}
                </div>
            </div>
        </div>
    `}function fe(){const e=l(),t=e.campaign?.state||{sessionLog:[],vttEvents:[]},n={sessionId:e.sessionId||"unknown",startTime:t.sessionLog.length>0?t.sessionLog[0].timestamp:new Date().toISOString(),endTime:new Date().toISOString(),duration:t.sessionLog.length>0?(Date.now()-new Date(t.sessionLog[0].timestamp).getTime())/1e3:0,log:t.sessionLog,vttEvents:t.vttEvents,metadata:{campaign:e.campaign?.name||"Unknown Campaign",players:(e.characters||[]).map(c=>c.name).filter(Boolean)}},s=JSON.stringify(n,null,2),a=new Blob([s],{type:"application/json"}),o=URL.createObjectURL(a),r=document.createElement("a");r.href=o,r.download=`session_${Date.now()}.json`,r.click(),URL.revokeObjectURL(o),i("Session bundle exported.","success"),f("📦 Session bundle exported.","success")}function we(){if(!confirm("Clear the session log and VTT events? This does not affect recordings."))return;const e=l();e.campaign?.state&&(e.campaign.state.sessionLog=[],e.campaign.state.vttEvents=[],g(),m(),i("Session data cleared.","info"))}async function J(e){try{if(y.kanban)return y.kanban.render(e);const t=await w(()=>import("./kanban.DrreRx9x.js"),__vite__mapDeps([0,1,2,3,4]));y.kanban=t,t.render(e)}catch(t){e.innerHTML=`<div class="panel"><h3 class="panel-title">📋 Kanban Board</h3><p class="text-muted" style="color:var(--red);">Error loading: ${t.message}</p><button class="btn btn-sm btn-primary mt-1" onclick="window.loadKanban()">🔄 Retry</button></div>`}}async function Z(e){try{if(y.whiteboard)return y.whiteboard.render(e);const t=await w(()=>import("./whiteboard.cXMCgdBG.js"),__vite__mapDeps([5,1,2,3,4,6,7,8,9,10,11,12,13,14,15,16,17]));y.whiteboard=t,t.render(e)}catch(t){e.innerHTML=`<div class="panel"><h3 class="panel-title">✏️ Whiteboard</h3><p class="text-muted" style="color:var(--red);">Error loading: ${t.message}</p><button class="btn btn-sm btn-primary mt-1" onclick="window.loadWhiteboard()">🔄 Retry</button></div>`}}async function X(e){try{if(y.travel&&y.travel.render)return y.travel.render(e);const t=await w(()=>import("./travel-planner.BPl68lDQ.js"),__vite__mapDeps([18,2,3,1,4,6,8,9,7,10,19,13]));y.travel=t,t.render?t.render(e):t.default?.render?t.default.render(e):e.innerHTML='<div class="panel"><h3 class="panel-title">🗺️ Travel Planner</h3><p class="text-muted">Render function not found.</p></div>'}catch(t){e.innerHTML=`<div class="panel"><h3 class="panel-title">🗺️ Travel Planner</h3><p class="text-muted" style="color:var(--red);">Error loading: ${t.message}</p><button class="btn btn-sm btn-primary mt-1" onclick="window.loadTravelPlanner()">🔄 Retry</button></div>`}}function A(){const e=document.getElementById("scene-consequences-region-select");e&&e.addEventListener("change",async t=>{try{await Me(t.target.value),i(`Region set to ${t.target.value}`,"info")}catch{i("Could not change region","error")}}),Ne(t=>{const n=document.getElementById("scene-consequences-region-select");n&&(n.value=t)})}window.sceneEndTrimBoons=Y;window.resetAllTimers=ee;window.newSession=te;window.openKanban=function(){const e=document.getElementById("gm-view-container");e&&(p="kanban",J(e).then(()=>{document.querySelectorAll(".gm-tab").forEach(t=>t.classList.replace("btn-gold","btn-secondary")),document.querySelector('.gm-tab[data-view="kanban"]')?.classList.replace("btn-secondary","btn-gold")}))};window.openWhiteboard=function(){const e=document.getElementById("gm-view-container");e&&(p="whiteboard",Z(e).then(()=>{document.querySelectorAll(".gm-tab").forEach(t=>t.classList.replace("btn-gold","btn-secondary")),document.querySelector('.gm-tab[data-view="whiteboard"]')?.classList.replace("btn-secondary","btn-gold")}))};window.openTravelPlanner=function(){const e=document.getElementById("gm-view-container");e&&(p="travel",X(e).then(()=>{document.querySelectorAll(".gm-tab").forEach(t=>t.classList.replace("btn-gold","btn-secondary")),document.querySelector('.gm-tab[data-view="travel"]')?.classList.replace("btn-secondary","btn-gold")}))};window.loadTravelPlanner=function(){window.openTravelPlanner()};window.loadKanban=function(){window.openKanban()};window.loadWhiteboard=function(){window.openWhiteboard()};window.openAdventureManager=function(){window.location.hash="adventure-manager"};window.gmCompleteScene=async function(){const e=k();if(e)try{const t=await w(()=>import("./adventure-manager.BYGz956n.js"),__vite__mapDeps([20,1,2,3,4,6,7,8,9,10,12,11,13]));t.loadAdventuresFromState(),t.completeScene(e.id,e.currentAct,e.currentScene)&&i("✅ Scene completed!","success"),m()}catch(t){console.error("[GM Tools] Could not complete scene:",t),i("Adventure Manager not available.","error")}};window.gmStartSceneEncounter=async function(){const e=k();if(e)try{const t=await w(()=>import("./adventure-manager.BYGz956n.js"),__vite__mapDeps([20,1,2,3,4,6,7,8,9,10,12,11,13]));t.loadAdventuresFromState(),await t.startSceneEncounter(e.id,e.currentAct,e.currentScene)}catch(t){console.error("[GM Tools] Could not start scene encounter:",t),i("Adventure Manager not available.","error")}};window.gmSaveQuickGenToAdventure=async function(){if(!T)return;const e=k();if(!e){i("No active adventure to save to — start one in Adventure Manager first.","warning");return}try{const t=await w(()=>import("./adventure-manager.BYGz956n.js"),__vite__mapDeps([20,1,2,3,4,6,7,8,9,10,12,11,13]));t.loadAdventuresFromState();const{type:n,data:s}=T;if(n==="npc"){const a=[...e.npcs||[],{id:"npc_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),...s}];t.updateAdventure(e.id,{npcs:a}),i(`👤 Saved "${s.name}" to "${e.title}"`,"success")}else if(n==="location"){const a=[...e.locations||[],{id:"loc_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),...s}];t.updateAdventure(e.id,{locations:a}),i(`📍 Saved "${s.name}" to "${e.title}"`,"success")}else if(n==="rumor"){const a=`${e.notes||""}

Rumor (${s.region}): ${s.text}`.trim();t.updateAdventure(e.id,{notes:a}),i(`📜 Saved rumor to "${e.title}" notes`,"success")}}catch(t){console.error("[GM Tools] Could not save quick-gen result to adventure:",t),i("Adventure Manager not available.","error")}};window.gmBuildAdventureFromCrownSpread=async function(){if(D)try{const e=(await w(()=>import("./adventure-manager.BYGz956n.js"),__vite__mapDeps([20,1,2,3,4,6,7,8,9,10,12,11,13]))).createAdventureFromCrownSpreadReading(D);e&&(i(`👑 Built "${e.title}" — opening Adventure Manager…`,"success"),window.location.hash="adventure-manager")}catch(e){console.error("[GM Tools] Could not build adventure from reading:",e),i("Adventure Manager not available.","error")}};window.openCombatTracker=function(){w(()=>import("./bestiary.CPB8-5uX.js").then(e=>e.a).then(e=>{e.default?.openTracker?e.default.openTracker(null):e.openTracker?e.openTracker(null):i("Combat tracker not available","error")}),__vite__mapDeps([11,3,1,2,4,7,6,8,9,10,12,13])).catch(()=>i("Combat tracker not available","error"))};window.addTimerFromScene=function(){w(()=>import("./timers.DECKYaq0.js").then(e=>{e.openTimerEditor?e.openTimerEditor(null):i("Timer module not available","error")}),__vite__mapDeps([21,1,2,3,4,7,6,8,9,10])).catch(()=>i("Timer module not available","error"))};window.addEncounterFromScene=function(){w(()=>import("./encounters.DM8SkZZ1.js").then(e=>{e.openEncounterEditor?e.openEncounterEditor(null):i("Encounter module not available","error")}),__vite__mapDeps([22,1,2,3,4,6,7,8,9,10,12,11,13])).catch(()=>i("Encounter module not available","error"))};window.openEncounterTracker=function(e){w(()=>import("./bestiary.CPB8-5uX.js").then(t=>t.a).then(t=>{t.default?.openTracker?t.default.openTracker(e):t.openTracker?t.openTracker(e):i("Combat tracker not available","error")}),__vite__mapDeps([11,3,1,2,4,7,6,8,9,10,12,13])).catch(()=>i("Combat tracker not available","error"))};window.tickTimer=function(e){const t=l().timers.find(n=>n.id===e);t&&(t.current=Math.min(t.current+1,t.segments),g(),t.current>=t.segments&&(f(`⏱️ Timer completed: ${t.name}`,"warning"),i(`⏱️ Timer "${t.name}" completed!`,"warning")),m())};window.addKanbanItem=function(){const e=prompt("Enter item title:");if(!e)return;const t=prompt("Enter description (optional):")||"",n=prompt("Select column (todo/doing/done/blocked):","todo")||"todo";if(!x.columns[n])return i("Invalid column","error");x.columns[n].items.push({title:e,description:t}),v(),m(),i(`📋 Added "${e}" to ${n}`,"success")};window.moveKanbanItem=function(e,t,n){const s=["todo","doing","done","blocked"],a=s.indexOf(e)+n;if(a<0||a>=s.length)return i("Cannot move further","warning");const o=s[a],r=x.columns[e].items[t];x.columns[e].items.splice(t,1),x.columns[o].items.push(r),v(),m(),i(`📋 Moved to ${o}`,"success")};window.removeKanbanItem=function(e,t){confirm("Remove this item?")&&(x.columns[e].items.splice(t,1),v(),m())};window.saveCampaignNotes=function(){const e=document.getElementById("campaign-notes")?.value;e!==void 0&&(b.notes=e,v(),i("💾 Campaign notes saved","success"))};window.addCampaignThreat=function(){const e=prompt("Enter threat name:");if(!e)return;const t=prompt("Severity (low/medium/high):","medium")||"medium",n=prompt("Description:")||"";b.activeThreats.push({name:e,severity:t,description:n}),v(),m(),i(`⚠️ Added threat: ${e}`,"success")};window.removeCampaignThreat=function(e){confirm(`Remove threat "${b.activeThreats[e].name}"?`)&&(b.activeThreats.splice(e,1),v(),m())};window.addCampaignOpportunity=function(){const e=prompt("Enter opportunity name:");if(!e)return;const t=prompt("Description:")||"";b.opportunities.push({name:e,description:t}),v(),m(),i(`🌟 Added opportunity: ${e}`,"success")};window.removeCampaignOpportunity=function(e){confirm(`Remove opportunity "${b.opportunities[e].name}"?`)&&(b.opportunities.splice(e,1),v(),m())};window.addCampaignTimer=function(){const e=prompt("Enter timer name:");if(!e)return;const t=parseInt(prompt("Segments:","6")||"6");b.campaignTimers.push({name:e,segments:t,current:0}),v(),m(),i(`⏱️ Added timer: ${e}`,"success")};window.tickCampaignTimer=function(e){const t=b.campaignTimers[e];t&&(t.current=Math.min(t.current+1,t.segments),v(),t.current>=t.segments&&i(`⏱️ Campaign timer "${t.name}" completed!`,"warning"),m())};window.removeCampaignTimer=function(e){confirm(`Remove timer "${b.campaignTimers[e].name}"?`)&&(b.campaignTimers.splice(e,1),v(),m())};window.copySessionLog=function(){const e=(l().campaign?.state?.sessionLog||[]).map(t=>`[${t.time}] ${t.message}`).join(`
`);if(!e)return i("Session log is empty.","warning");navigator.clipboard.writeText(e).then(()=>i("Session log copied.","success")).catch(()=>prompt("Copy the log:",e))};window.clearSessionLog=function(){if(!confirm("Clear the session log?"))return;const e=l();e.campaign?.state&&(e.campaign.state.sessionLog=[],g(),m(),i("Session log cleared.","info"))};window.addSceneTag=function(){const e=document.getElementById("scene-tag-input");e&&j(e.value)&&(e.value="",e.focus())};window.removeSceneTag=F;window.clearSceneTags=G;window.generateNPC=pe;window.generateLocation=ge;window.generateRumor=be;window.exportSessionBundle=fe;window.clearSessionData=we;window.quickDrawConsequence=async function(e=1){try{const t=await L(e);if(t){const n=document.getElementById("consequence-result");if(n){let a="";t.cards.filter(o=>o.rank==="A"&&!o.isJoker).length>0&&(a='<div class="mt-1 p-2 badge-gold" style="display:block;">♠️ <strong>Ace Effect triggered!</strong></div>',f("♠️ Ace Effect triggered on draw","warning")),n.innerHTML=`
                    <div class="p-1">
                        <div class="font-bold text-gold mb-1">🃏 ${e} Card${e>1?"s":""} Drawn</div>
                        <div class="text-muted mb-1">${t.cardNames}</div>
                        <div class="panel" style="background:var(--bg2); border-left: 3px solid var(--gold); white-space: pre-wrap;">${t.synthesis}</div>
                        ${a}
                    </div>
                `}const s=document.getElementById("crown-spread-result");s&&(s.style.display="none")}}catch{i("Could not draw cards","error")}};window.quickCrownSpreadFromScene=async function(){try{const e=await qe();if(e){D={synthesis:e.result.synthesis,cardNames:e.cardNames,region:S()||"Acasia"};const t=document.getElementById("consequence-result");t&&(t.innerHTML=`
                    <div class="p-1">
                        <div class="font-bold text-gold mb-1">👑 Crown Spread</div>
                        <div class="text-muted mb-1">${e.cardNames}</div>
                        <div class="panel" style="background:var(--bg2); border-left: 3px solid var(--gold); white-space: pre-wrap;">${e.result.synthesis}</div>
                    </div>
                `);const n=document.getElementById("crown-spread-result");if(n){n.style.display="block";const s=document.getElementById("crown-spread-cards");s&&(s.innerHTML=e.mainCards.map((o,r)=>{const c=["🌱 Root","🏔️ Crest","👑 Crown","🤝 Left Hand"],d=o.isJoker||!1;return`<div class="panel flex-center flex-col" style="min-width:60px; background:var(--bg3); border: 2px solid ${o.color||"var(--gold)"};"><div class="text-xs text-muted">${c[r]}</div><div style="font-size:1.5rem;">${d?"🃏":o.symbol||"♦"}</div><div class="text-xs text-muted">${d?"Joker":o.rankName}</div></div>`}).join("")+'<div class="panel flex-center flex-col" style="min-width:60px; background:var(--bg4); border: 2px solid var(--gold); box-shadow: 0 0 15px var(--gold-glow);"><div class="text-xs text-gold">🌟 Wild</div><div style="font-size:1.5rem;">🃏</div><div class="text-xs text-gold">Twist</div></div>');const a=document.getElementById("crown-spread-interpretation");a&&(a.innerHTML='<button class="btn btn-sm btn-gold" onclick="window.gmBuildAdventureFromCrownSpread()">📖 Build Adventure from this Reading</button>')}}}catch{i("Could not perform Crown Spread","error")}};window.shuffleDeck=function(){w(()=>import("./decks.CN3iDKhv.js").then(e=>e.n).then(e=>{e.resetDeck||e.default?.resetDeck?((e.resetDeck||e.default.resetDeck)(),i("🔀 Deck shuffled","success")):i("Deck module not available","error")}),__vite__mapDeps([19,3,1,2,4,6,8,9,7,10,13])).catch(()=>i("Deck module not available","error"))};function Y(){const e=l();let t=0;(e.characters||[]).forEach(n=>{const s=n.boons||0;n.boons=Ee(n.boons||0,0,2),s>n.boons&&(t+=s-n.boons),n.talentUses=B(n,"once-scene")}),g(),t>0?i(`Scene end: trimmed ${t} excess Boons, refreshed once/scene talents.`,"success"):i("Scene end: Boons already trimmed; refreshed once/scene talents.","info")}function ee(){confirm("Reset every timer to zero segments?")&&((l().timers||[]).forEach(e=>e.current=0),g(),i("All timers reset.","success"))}function te(){const e=l();if((e.rollHistory||[]).length===0&&(e.chatHistory||[]).length===0)return i("No data to archive.","info");const t=prompt("Session label:",`Session ${e.sessionId||1}`)||`Session ${e.sessionId||1}`;Le({id:Date.now(),timestamp:Date.now(),rollHistory:[...e.rollHistory||[]],chatHistory:[...e.chatHistory||[]],label:t}),Ce(),Ae(),(e.characters||[]).forEach(n=>{n.talentUses=B(n,"once-session"),n.talentUses=B(n,"once-scene")}),g(),i("New session started; previous archived; refreshed once/session (and once/scene) talents.","success")}function m(){const e=document.getElementById("gm-view-container");e&&(E(),p==="kanban"?J(e):p==="whiteboard"?Z(e):p==="travel"?X(e):(e.innerHTML=Q(p),ne(),p==="consequences"&&A(),p==="session"&&C(),p==="scene"&&M()))}function ne(){document.querySelectorAll(".gm-tab").forEach(t=>{t.addEventListener("click",async()=>{document.querySelectorAll(".gm-tab").forEach(a=>a.classList.replace("btn-gold","btn-secondary")),t.classList.replace("btn-secondary","btn-gold");const n=t.dataset.view,s=document.getElementById("gm-view-container");s&&(p=n,n==="kanban"?await J(s):n==="whiteboard"?await Z(s):n==="travel"?await X(s):(s.innerHTML=Q(n),ne(),n==="consequences"&&A(),n==="session"&&C(),n==="scene"&&M()))})}),p==="consequences"&&A(),p==="session"&&C(),p==="scene"&&M(),document.getElementById("gen-npc-btn")?.addEventListener("click",pe),document.getElementById("gen-location-btn")?.addEventListener("click",ge),document.getElementById("gen-rumor-btn")?.addEventListener("click",be),document.getElementById("scene-tag-add-btn")?.addEventListener("click",window.addSceneTag),document.getElementById("scene-tag-clear-btn")?.addEventListener("click",window.clearSceneTags);const e=document.getElementById("auto-tick-toggle");e&&e.addEventListener("change",t=>{re({autoTickTimers:t.target.checked}),i(`Auto-tick ${t.target.checked?"enabled":"disabled"}.`,"info")}),document.addEventListener("keydown",t=>{t.key==="Enter"&&document.activeElement===document.getElementById("scene-tag-input")&&window.addSceneTag()}),document.addEventListener("click",t=>{const n=t.target.closest(".gm-tag-remove");n&&window.removeSceneTag(n.dataset.tag)}),document.getElementById("safety-save-btn")?.addEventListener("click",()=>{ae({lines:document.getElementById("safety-lines")?.value||"",veils:document.getElementById("safety-veils")?.value||""}),i("Safety settings saved.","success")}),document.getElementById("sz-save-btn")?.addEventListener("click",()=>{ae({sessionZero:{tone:document.getElementById("sz-tone")?.value||"",length:document.getElementById("sz-length")?.value||"",characterHooks:document.getElementById("sz-characterHooks")?.value||"",consent:document.getElementById("sz-consent")?.checked||!1}}),i("Session Zero saved.","success")})}function C(){document.getElementById("session-record-btn")?.addEventListener("click",async()=>{const e=l().characters?.[0]?.name||"Player";await _e(e),N()}),document.getElementById("session-stop-btn")?.addEventListener("click",()=>{Re(),N()}),document.getElementById("session-export-btn")?.addEventListener("click",fe),document.getElementById("session-clear-btn")?.addEventListener("click",we),document.removeEventListener("media-recording-state",ie),document.addEventListener("media-recording-state",ie)}function ie(){N()}function N(){const e=ce(),t=document.getElementById("session-record-btn"),n=document.getElementById("session-stop-btn"),s=document.getElementById("session-recording-status");t&&(t.style.display=e.isRecording?"none":"inline-block"),n&&(n.style.display=e.isRecording?"inline-block":"none"),s&&(s.textContent=e.isRecording?`🔴 Recording... (${e.duration}s)`:"Not recording")}function he(){E(),p==="consequences"&&setTimeout(A,100),p==="session"&&setTimeout(C,100)}function ye(){v()}function xe(){E(),m()}function ke(){_=null,v(),y={}}var mt={render:ve,destroy:ke,onActivate:he,onDeactivate:ye,refresh:xe,sceneEndTrimBoons:Y,resetAllTimers:ee,newSession:te,logToSession:f,addVTTEvent:ue,addSceneTag:j,removeSceneTag:F,clearSceneTags:G,getSceneTags:V,getTagEffects:H,tickActiveSceneTimer:U,getActiveAdventureTimers:W};export{xt as n,f as r,ue as t};
