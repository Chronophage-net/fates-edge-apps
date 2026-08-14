const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/characters.D4g1AIH0.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/rolldown-runtime.BQ-_32WO.js","assets/Toast.DDAtBIAw.js","assets/preload-helper.BATLnrmA.js"])))=>i.map(i=>d[i]);
import{a as ae,i as p,l as g,n as $}from"./utils.lBShoim5.js";import{b as D,d as Te,g as C,j as N,n as Pe}from"./state.42sFgcOQ.js";import{n as v}from"./Toast.DDAtBIAw.js";import{t as Be}from"./preload-helper.BATLnrmA.js";import{i as Le}from"./talent-effects.CY-tOZj6.js";import{t as Ae}from"./patrons.Ci1TYIUN.js";import{TALENT_CATEGORIES as Me,n as Xe,openTalentEditor as ie,t as qe}from"./talent-editor.DYvzq7je.js";console.log("[Editor] Module loaded");var L=["Melee","Ranged","Unarmed","Athletics","Stealth","Endurance","Craft","Sway","Deception","Subterfuge","Performance","Insight","Lore","Investigation","Medicine","Arcana"],oe={melee:"body",ranged:"wits",unarmed:"body",athletics:"body",stealth:"wits",endurance:"body",craft:"wits",sway:"presence",deception:"presence",subterfuge:"wits",performance:"presence",insight:"spirit",lore:"wits",investigation:"wits",medicine:"wits",arcana:"spirit"},F=[{id:"human",label:"Human — The Adaptable",note:"No attribute adjustments. Endless Reach talent (free)"},{id:"aelaerem",label:"Aelaerem (Halfling) — Hearth & Hollow",note:"Wits+1, Presence+1, Body-1. Small Folk traits"},{id:"aelinnel",label:"Aelinnel (Gnome) — Stone, Bough, Bright Things",note:"Wits+1, Spirit+1, Body-1. Small Folk traits"},{id:"aeler",label:"Aeler (Dwarf) — Crowns & Under-Vaults",note:"Body+1, Spirit+1, Presence-1. Stone-sense"},{id:"lethai-al",label:"Lethai-al (Wood Elf) — Root, River, Roof-Tree",note:"Body+1, Wits+1, Presence-1"},{id:"lethai-thora",label:"Lethai-thora (High Elf) — Mind's Eye & Civic Measure",note:"Wits+1, Spirit+1, Body-1"},{id:"lethai-ar",label:"Lethai-ar (Dark Elf) — The Oathbound",note:"Wits+1, Presence+1, Spirit-1"},{id:"ykrul",label:"Ykrul (Orc) — Wolf Standards, Winter Camps",note:"Body+1, Spirit+1, Presence-1"},{id:"narethi",label:"Narethi — The Unburied of the Deep Desert",note:"Wits+1, Spirit+1, Body-1. Resonance Leash"},{id:"mixed",label:"Mixed Heritage — Half-Elves, Half-Ykrul, Half-Others",note:"Choose one +1 and one -1 from parent cultures"}],O=[{id:"none",label:"No Armor",xpCost:0,conversion:"Harm passes directly",penalty:"None"},{id:"light",label:"Light Armor",xpCost:4,conversion:"1→1 (min 1 Fatigue/hit)",penalty:"None"},{id:"medium",label:"Medium Armor",xpCost:8,conversion:"2→1 (min 1 Fatigue/hit)",penalty:"-1d physical skills"},{id:"heavy",label:"Heavy Armor",xpCost:12,conversion:"3→2 (min 1 Fatigue/hit)",penalty:"-2d physical, no sprint in rough"},{id:"superior",label:"Superior Armor",xpCost:16,conversion:"4→3 (min 1 Fatigue/hit)",penalty:"Special"},{id:"mythic",label:"Mythic Armor",xpCost:20,conversion:"5→4 (min 1 Fatigue/hit)",penalty:"Special"}],j=[{id:"light",label:"Light Weapon (4 XP)",close:"+2d",near:"+1d",notes:"Fast, concealable"},{id:"medium",label:"Medium Weapon (8 XP)",close:"+1d",near:"+2d",notes:"Balanced, battlefield standard"},{id:"heavy",label:"Heavy Weapon (12 XP)",close:"-1d",near:"+3d",notes:"Punishing, slow"},{id:"ranged",label:"Ranged Weapon",close:"-2d",near:"+2d",notes:'Bow, crossbow, thrown — Close carries the "Ranged in Close = Desperate" penalty; see §3.12.3 for Far/Tempo'}],Ne=[{id:"none",label:"No Shield",xpCost:0},{id:"buckler",label:"Buckler (4 XP)",xpCost:4},{id:"heater",label:"Heater (8 XP)",xpCost:8},{id:"pavise",label:"Pavise (12 XP)",xpCost:12}],Oe=[{min:0,max:40,tier:"I",name:"Novice"},{min:41,max:90,tier:"II",name:"Seasoned"},{min:91,max:150,tier:"III",name:"Veteran"},{min:151,max:220,tier:"IV",name:"Paragon"},{min:221,max:1/0,tier:"V",name:"Mythic"}],W=[{id:"minor",label:"Minor",xpRange:"2–3 XP",min:2,max:3},{id:"major",label:"Major",xpRange:"4–6 XP",min:4,max:6},{id:"prestige",label:"Prestige",xpRange:"7–10 XP",min:7,max:10},{id:"epic",label:"Epic",xpRange:"11+ XP",min:11,max:999}],Re=["Acasia","Aelaerem","Aeler","Aelinnel","Black Banners","Ecktoria","Linn","Mistlands","Silkstrand","Theona","Thepyrgos","Ubral","Valewood","Vhasia","Viterra","Ykrul","Zakov","Vilikari","Kahfagia","Fhara","Pereshi","Kuvani","Tulkani","Ashaan","Sekogo","Taharka","Sidhi","Ngomebe","Dhahara","Oshiira"],He=[{id:"none",label:"No Magic Path",talents:[]},{id:"free-caster",label:"Free Caster (Spellcraft, 6 XP)",talents:["Spellcraft"]},{id:"runekeeper",label:"Runekeeper (Familiar 2 XP + Codex 4 XP)",talents:["Familiar","Codex"]},{id:"invoker",label:"Invoker (Patron's Symbol, 4 XP/Patron)",talents:["Patron's Symbol"]},{id:"cantor",label:"Cantor (Cantor's Path, 8 XP)",talents:["Cantor's Path"]},{id:"witch",label:"Witch (Craft of the Hedge, 4 XP)",talents:["Craft of the Hedge"]},{id:"psion",label:"Psion (Psionic Training, 6 XP)",talents:["Psionic Training"]},{id:"summoner",label:"Summoner (Pact-Whisperer 2 XP + Lesser Pactwright 2 XP)",talents:["Pact-Whisperer","Lesser Pactwright"]},{id:"monk",label:"Monk (Monastic Training, 4 XP)",talents:["Monastic Training"]},{id:"familiar-only",label:"Familiar Only (Familiar, 2 XP)",talents:["Familiar"]},{id:"hedge-gifts",label:"Hedge Gifts Only (Craft of the Hedge, 4 XP)",talents:["Craft of the Hedge"]}],re={runekeeper:["familiar","codex"],"familiar-only":["familiar"],cantor:["cantors-path"],summoner:["pact-whisperer","lesser-pactwright"],"free-caster":["spellcraft"],witch:["craft-of-the-hedge"],"hedge-gifts":["craft-of-the-hedge"],invoker:[],psion:["psionic-training"],monk:["monastic-training"]};function se(){const e={};return L.forEach(n=>e[n.toLowerCase()]=0),e}var Q={"white-hound":"mykkiel",ferret:"inquisitor-prime","bronze-hawk":"inquisitor-prime","mechanical-bird":"inquisitor-prime","garden-spider":"inaea","silk-moth":"inaea","gray-mouse":"inaea","fire-salamander":"oath-of-flame-light","phoenix-fledgling":"oath-of-flame-light","brass-beetle":"sacred-geometry","konreh-pieces":"sacred-geometry","bell-frog":"gallows-bell","gray-mouse-courthouse":"gallows-bell","lead-seal":"varnek-karn",knucklebone:"varnek-karn","confessor-mouse":"confessor-beneath-the-bell","bell-cricket":"confessor-beneath-the-bell","letter-mouse":"silent-choir","forgetfulness-moth":"silent-choir",raven:"the-witness",silverfish:"the-witness","bronze-key":"sealed-gate","bell-ward":"sealed-gate"},ee={"iron-bound-ledger":"inquisitor-prime","slate-tablet":"inquisitor-prime","frame-loom":"inaea","knotted-cords":"inaea","brass-scroll":"oath-of-flame-light","sun-stone":"oath-of-flame-light","brass-stencils":"sacred-geometry","slate-proofs":"sacred-geometry","court-ledger":"gallows-bell","bronze-bells":"gallows-bell","slate-carvings":"varnek-karn","burial-tablets":"varnek-karn","bell-ringers-log":"confessor-beneath-the-bell","leather-strap":"confessor-beneath-the-bell","locked-journal":"silent-choir","wax-tablets":"silent-choir","loose-leaf-pages":"the-witness",chalkboard:"the-witness","leather-strap-seals":"sealed-gate","iron-rings":"sealed-gate"};function Fe({thiasos:e,codex:n}){return e&&Q[e]?Q[e]:n&&ee[n]?ee[n]:null}var T=null;function le(){if(T)return T;const e=D().patrons?.cosmic||[];if(e.length===0)return T=[{id:"",label:"None — No Patron"}],T;const n=e.map(a=>({id:a.id,label:`${a.name||a.title||a.id} — ${a.subtitle||a.domain||"Cosmic Patron"}`}));return n.sort((a,o)=>a.label.localeCompare(o.label)),n.unshift({id:"",label:"None — No Patron"}),T=n,T}function R(e){return le().map(n=>`<option value="${n.id}" ${e===n.id?"selected":""}>${p(n.label)}</option>`).join("")}var c={currentId:null,isNew:!1,isOpen:!1,saved:!1,initialized:!1,modalElement:null,hiddenSiblings:null,escListener:null,saveListener:null,cancelListeners:[]},h={search:"",category:"",tag:""};function z(){console.log("[Editor] initEditor called, initialized:",c.initialized),!c.initialized&&(document.addEventListener("click",e=>{const n=e.target;if(n.matches("[data-editor-add]")){const a=n.dataset.editorAdd;V(a),e.preventDefault()}if(n.matches(".editor-remove-btn")){const a=n.closest(".dynamic-row");a&&a.remove(),y(),e.preventDefault()}if(n.matches("[data-editor-wiki-add]")){const a=n.dataset.editorWikiAdd,o=document.getElementById(`ce-${a}-wiki`);o&&o.value&&(G(a,o.value),o.value=""),e.preventDefault()}}),document.addEventListener("talent-updated",()=>{c.isOpen&&(X(),y())}),c.initialized=!0,console.log("[Editor] initEditor complete"))}function A(e,n){let a=0;for(let o=e+1;o<=n;o++)a+=o*3;return a}function ce(e,n){let a=0;for(let o=e+1;o<=n;o++)a+=o*2;return a}function U(e){let n=0;return n+=A(1,e.body||1),n+=A(1,e.wits||1),n+=A(1,e.spirit||1),n+=A(1,e.presence||1),e.skills&&L.forEach(a=>{const o=e.skills[a.toLowerCase()]||0;n+=ce(0,o)}),e.talents&&e.talents.forEach(a=>n+=g(a.cost,0)),e.assets&&e.assets.forEach(a=>n+=g(a.cost,0)),e.equipment&&e.equipment.forEach(a=>n+=g(a.cost,0)),n}function M(e){for(const n of Oe)if(e>=n.min&&e<=n.max)return{tier:n.tier,name:n.name};return{tier:"V",name:"Mythic"}}function de(e){const n=D(),a=n.talents||[],o=(n.wikiEntries||[]).filter(l=>l.tags&&Array.isArray(l.tags)&&l.tags.includes("talent")),t=[...a.map(l=>({...l,source:"local"})),...o.map(l=>({...l,name:l.title,description:l.body||l.description,source:"wiki"}))],{tier:i}=M(e);let d=[];return i==="I"?d=["minor"]:i==="II"?d=["minor","major"]:d=["minor","major","prestige","epic"],t.filter(l=>{const m=g(l.cost,0);for(const r of W)if(m>=r.min&&m<=r.max&&d.includes(r.id))return!0;return!1})}function je(e){const{search:n,category:a,tag:o}=h;return e.filter(t=>!(a&&t.category!==a||o&&!(Array.isArray(t.tags)&&t.tags.includes(o))||n&&!`${t.name||""} ${t.description||""} ${t.effect||""}`.toLowerCase().includes(n.toLowerCase())))}var te=null;function ze(e){const n=document.getElementById("ce-talent-filter-bar");if(!n)return;const a=Me.filter(m=>e.some(r=>r.category===m.id)),o=qe(e),t=a.map(m=>m.id).join(",")+"|"+o.join(","),i=!!(h.search||h.category||h.tag);if(t===te&&n.dataset.hasClear===String(i))return;te=t,n.dataset.hasClear=String(i);const d=a.map(m=>`<option value="${m.id}" ${h.category===m.id?"selected":""}>${p(m.label)}</option>`).join(""),l=o.map(m=>`<option value="${p(m)}" ${h.tag===m?"selected":""}>${p(m)}</option>`).join("");n.innerHTML=`
        <input type="text" id="ce-talent-filter-search" placeholder="Search talents..."
            value="${p(h.search)}"
            style="flex:1;min-width:100px;font-size:0.75rem;padding:0.2rem 0.4rem;" />
        <select id="ce-talent-filter-category" style="font-size:0.75rem;padding:0.2rem;">
            <option value="">All categories</option>
            ${d}
        </select>
        <select id="ce-talent-filter-tag" style="font-size:0.75rem;padding:0.2rem;">
            <option value="">All tags</option>
            ${l}
        </select>
        ${i?'<button type="button" class="btn btn-xs" id="ce-talent-filter-clear">Clear</button>':""}
    `,document.getElementById("ce-talent-filter-search")?.addEventListener("input",m=>{h.search=m.target.value,me()}),document.getElementById("ce-talent-filter-category")?.addEventListener("change",m=>{h.category=m.target.value,S()}),document.getElementById("ce-talent-filter-tag")?.addEventListener("change",m=>{h.tag=m.target.value,S()}),document.getElementById("ce-talent-filter-clear")?.addEventListener("click",()=>{h.search="",h.category="",h.tag="",S()})}function S(){const e=de(g(document.getElementById("ce-total-xp")?.value,32));ze(e),me(e)}function _e(e,{remainingXp:n,showStarterPicks:a}){return e.map(o=>{const t=g(o.cost,0),i=Array.isArray(o.tags)&&o.tags.includes("starter");return{...o,_recommended:a&&i,_affordable:n==null||t<=n}}).sort((o,t)=>{if(o._recommended!==t._recommended)return o._recommended?-1:1;if(o._affordable!==t._affordable)return o._affordable?-1:1;const i=g(o.cost,0)-g(t.cost,0);return i!==0?i:(o.name||"").localeCompare(t.name||"")})}function me(e){const n=document.getElementById("ce-talent-catalog");if(!n)return;const a=g(document.getElementById("ce-total-xp")?.value,32),o=e||de(a),t=je(o);if(t.length===0){n.innerHTML=`<div style="padding:0.5rem;color:var(--text3);font-size:0.85rem;">${o.length===0?"No talents available for your current tier.":"No talents match the current filter."}</div>`;return}const i=c.currentId?C(c.currentId):null,d=i?a-U(i):null,l=_e(t,{remainingXp:d,showStarterPicks:!i||!(i.talents&&i.talents.length)});let m=!1;n.innerHTML=l.map((r,u)=>{const f=g(r.cost,0),b=W.find(w=>f>=w.min&&f<=w.max),x=b?b.label:"?";let I="";return r._recommended&&!m?(I='<div style="padding:0.25rem 0.5rem 0.1rem;font-size:0.65rem;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.03em;">⭐ Recommended starting talents</div>',m=!0):!r._recommended&&m&&(I='<div style="padding:0.35rem 0.5rem 0.1rem;font-size:0.65rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.03em;border-top:1px solid var(--border);">All talents</div>',m=!1),`
            ${I}
            <div class="talent-catalog-item" style="display:flex;align-items:center;padding:0.3rem 0.5rem;font-size:0.8rem;border-bottom:1px solid var(--border);${r._affordable?"":"opacity:0.55;"}">
                <div class="talent-info" style="flex:1;">
                    ${r._recommended?'<span title="Common starting talent" style="margin-right:0.2rem;">⭐</span>':""}
                    <span style="font-weight:500;">${p(r.name)}</span>
                    <span style="color:var(--gold); margin-left:0.3rem;">${f} XP</span>
                    <span style="color:var(--text3); font-size:0.75rem; margin-left:0.3rem;">(${x})</span>
                    ${r._affordable?"":`<span style="color:var(--text3); font-size:0.7rem; margin-left:0.3rem;">— need ${f-(d||0)} more XP</span>`}
                    ${r.description?`<div style="color:var(--text2); font-size:0.7rem;">${p(r.description)}</div>`:""}
                    ${r.prerequisites?`<div style="color:var(--text3); font-size:0.65rem;">Requires: ${p(r.prerequisites)}</div>`:""}
                    ${Array.isArray(r.tags)&&r.tags.length?`<div style="margin-top:0.15rem;">${r.tags.map(w=>`<span class="ce-talent-tag-chip" data-tag="${p(w)}" style="display:inline-block;font-size:0.6rem;color:var(--text3);background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:0.02rem 0.35rem;margin:0.1rem 0.15rem 0 0;cursor:pointer;">${p(w)}</span>`).join("")}</div>`:""}
                </div>
                <button class="btn btn-xs btn-primary ce-catalog-add-btn" data-index="${u}" ${r._affordable?"":'title="Not enough remaining XP yet — you can still add it and adjust XP later"'}>Add</button>
            </div>
        `}).join(""),n.querySelectorAll(".ce-catalog-add-btn").forEach(r=>{r.addEventListener("click",function(u){u.preventDefault();const f=parseInt(this.dataset.index,10);ue(l[f])})}),n.querySelectorAll(".ce-talent-tag-chip").forEach(r=>{r.addEventListener("click",function(u){u.preventDefault(),h.tag=this.dataset.tag,S()})})}function ue(e){if(!c.currentId){v("Open a character first.","error");return}const n=C(c.currentId);if(!n)return;Array.isArray(n.talents)||(n.talents=[]);const{source:a,...o}=e,t={...o,id:ae("talent_"),clonedFrom:e.id||null};Le(t),n.talents.push(t),N(c.currentId,{talents:n.talents}),X(),y(),v(`Added "${e.name}" (${g(e.cost,0)} XP)`,"success")}function X(){const e=document.getElementById("ce-talent-list");if(!e||!c.currentId)return;const n=C(c.currentId),a=(n?.talents||[]).filter(i=>i&&i.name),o=new Set(["once-scene","once-session","once-arc","once-campaign"]),t=n?.talentUses||{};e.innerHTML=a.map((i,d)=>{const l=W.find(x=>x.id===i.tier),m=l?l.label:i.tier||"",r=Array.isArray(i.effects)&&i.effects.length>0,u=o.has(i.useLimit),f=u&&t[i.id||i.name]?.spent;let b="";return u&&(b=f?`<span title="Charge spent — refreshes at ${i.useLimit.replace("once-","")} end" style="color:var(--text3);font-size:0.7rem;margin-left:0.3rem;">○ spent</span>
                   <button type="button" class="btn btn-xs ce-talent-refresh-btn" data-index="${d}" title="Manually refresh this charge">↻</button>`:'<span title="Charge available" style="color:var(--green);font-size:0.7rem;margin-left:0.3rem;">● ready</span>'),`
            <div class="dynamic-row ce-talent-row" data-index="${d}" style="display:flex;align-items:center;gap:0.4rem;padding:0.2rem 0;">
                <div style="flex:2;">
                    <span style="font-weight:500;">${p(i.name)}</span>
                    ${m?`<span style="color:var(--text3);font-size:0.7rem;margin-left:0.3rem;">(${p(m)})</span>`:""}
                    ${r?'<span title="Has a mechanical effect the dice roller applies automatically" style="margin-left:0.3rem;">⚙️</span>':""}
                    ${b}
                    ${i.effect?`<div style="color:var(--text3);font-size:0.7rem;">${p(i.effect)}</div>`:""}
                </div>
                <span style="width:50px;text-align:center;">${g(i.cost,0)} XP</span>
                <button type="button" class="btn btn-xs ce-talent-edit-btn" data-index="${d}">✏️</button>
                <button type="button" class="btn btn-xs editor-remove-btn ce-talent-remove-btn" data-index="${d}">✕</button>
            </div>
        `}).join(""),e.querySelectorAll(".ce-talent-edit-btn").forEach(i=>{i.addEventListener("click",function(){ie(c.currentId,parseInt(this.dataset.index,10))})}),e.querySelectorAll(".ce-talent-remove-btn").forEach(i=>{i.addEventListener("click",function(){const d=parseInt(this.dataset.index,10),l=C(c.currentId);!l||!Array.isArray(l.talents)||(l.talents.splice(d,1),N(c.currentId,{talents:l.talents}),X(),y())})}),e.querySelectorAll(".ce-talent-refresh-btn").forEach(i=>{i.addEventListener("click",function(){const d=parseInt(this.dataset.index,10),l=C(c.currentId);if(!l||!Array.isArray(l.talents))return;const m=l.talents[d];if(!m)return;const r=m.id||m.name,u={...l.talentUses||{}};delete u[r],N(c.currentId,{talentUses:u}),X()})})}function P(e,n,a={}){const o=a?.name??"",t=a?.cost??0;let i="";switch(e){case"talent":case"asset":case"equipment":i=`
                <div class="dynamic-row ce-${e}-row" data-index="${n}">
                    <input type="text" class="ce-${e}-name" placeholder="Name" value="${p(o)}" style="flex:2;" />
                    <input type="number" class="ce-${e}-cost" placeholder="XP" value="${t}" min="0" style="width:70px;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;break;case"bond":i=`
                <div class="dynamic-row ce-bond-row" data-index="${n}">
                    <input type="text" class="ce-bond-name" placeholder="Bond name" value="${p(o)}" style="flex:1;" />
                    <input type="text" class="ce-bond-desc" placeholder="Description" value="${p(a?.desc??"")}" style="flex:2;" />
                    <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;">
                        <input type="checkbox" class="ce-bond-start" ${a?.start?"checked":""} /> +2 XP
                    </label>
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;break;case"complication":i=`
                <div class="dynamic-row ce-complication-row" data-index="${n}">
                    <input type="text" class="ce-complication-name" placeholder="Complication name" value="${p(o)}" style="flex:1;" />
                    <input type="text" class="ce-complication-desc" placeholder="Description" value="${p(a?.desc??"")}" style="flex:2;" />
                    <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;">
                        <input type="checkbox" class="ce-complication-start" ${a?.start?"checked":""} /> +2 XP
                    </label>
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;break;case"symbol":i=`
                <div class="dynamic-row ce-symbol-row" data-index="${n}">
                    <select class="ce-symbol-patron" style="flex:1;">${R(a?.patron||"")}</select>
                    <select class="ce-symbol-state" style="width:100px;">
                        <option value="active" ${a?.state==="active"?"selected":""}>Active</option>
                        <option value="compromised" ${a?.state==="compromised"?"selected":""}>Compromised</option>
                        <option value="shattered" ${a?.state==="shattered"?"selected":""}>Shattered</option>
                    </select>
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;break;case"rite":case"repertoire":case"hedge-gift":case"psionic-art":case"known-tag":i=`
                <div class="dynamic-row ce-${e}-row" data-index="${n}">
                    <input type="text" class="ce-${e}-name" placeholder="Name" value="${p(o)}" style="flex:2;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;break;case"promise-timer":i=`
                <div class="dynamic-row ce-promise-timer-row" data-index="${n}">
                    <input type="text" class="ce-promise-timer-name" placeholder="Timer name" value="${p(o)}" style="flex:1;" />
                    <input type="number" class="ce-promise-timer-segments" placeholder="Segments" value="${a?.segments??4}" min="1" max="12" style="width:80px;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;break;case"bound-spirit":i=`
                <div class="dynamic-row ce-bound-spirit-row" data-index="${n}">
                    <input type="text" class="ce-bound-spirit-name" placeholder="Spirit name" value="${p(o)}" style="flex:1;" />
                    <input type="number" class="ce-bound-spirit-cap" placeholder="Cap" value="${a?.cap??1}" min="1" max="5" style="width:60px;" />
                    <input type="text" class="ce-bound-spirit-nature" placeholder="Nature" value="${p(a?.nature??"")}" style="flex:1;" />
                    <input type="text" class="ce-bound-spirit-services" placeholder="Services" value="${p(a?.services??"")}" style="flex:1;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `;break;default:i=`
                <div class="dynamic-row ce-${e}-row" data-index="${n}">
                    <input type="text" class="ce-${e}-name" placeholder="Name" value="${p(o)}" style="flex:2;" />
                    <button class="btn btn-xs editor-remove-btn">✕</button>
                </div>
            `}return i}function E(e){const n=[],a=document.querySelectorAll(".ce-"+e+"-row");for(const o of a)if(e==="bond"){const t=o.querySelector(".ce-bond-name"),i=o.querySelector(".ce-bond-desc"),d=o.querySelector(".ce-bond-start");if(!t)continue;const l=t.value?.trim()||"";if(!l)continue;n.push({name:l,desc:i?i.value.trim():"",start:d?d.checked:!1})}else if(e==="complication"){const t=o.querySelector(".ce-complication-name"),i=o.querySelector(".ce-complication-desc"),d=o.querySelector(".ce-complication-start");if(!t)continue;const l=t.value?.trim()||"";if(!l)continue;n.push({name:l,desc:i?i.value.trim():"",start:d?d.checked:!1})}else if(e==="symbol"){const t=o.querySelector(".ce-symbol-patron"),i=o.querySelector(".ce-symbol-state"),d=t?t.value:"";if(!d)continue;n.push({patron:d,state:i?i.value:"active"})}else if(e==="promise-timer"){const t=o.querySelector(".ce-promise-timer-name"),i=o.querySelector(".ce-promise-timer-segments");if(!t)continue;const d=t.value?.trim()||"";if(!d)continue;n.push({name:d,segments:i?g(i.value,4):4})}else if(e==="bound-spirit"){const t=o.querySelector(".ce-bound-spirit-name"),i=o.querySelector(".ce-bound-spirit-cap"),d=o.querySelector(".ce-bound-spirit-nature"),l=o.querySelector(".ce-bound-spirit-services");if(!t)continue;const m=t.value?.trim()||"";if(!m)continue;n.push({name:m,cap:i?g(i.value,1):1,nature:d?d.value.trim():"",services:l?l.value.trim():""})}else if(["rite","repertoire","hedge-gift","psionic-art","known-tag"].includes(e)){const t=o.querySelector(".ce-"+e+"-name");if(!t)continue;const i=t.value?.trim()||"";if(!i)continue;n.push({name:i})}else if(["asset","equipment","talent"].includes(e)){const t=o.querySelector(".ce-"+e+"-name"),i=o.querySelector(".ce-"+e+"-cost");if(!t)continue;let d;if(t.tagName==="INPUT"?d=t.value?.trim()||"":d=t.textContent?.trim()||"",!d)continue;const l=i?g(i.value||i.textContent,0):0,m={name:d,cost:l};if(e==="asset"){const r=o.querySelector(".ce-asset-tier");r&&(m.tier=r.value)}n.push(m)}return n}function y(){const e=document.getElementById("ce-total-xp");if(!e)return;const n=g(e.value,32);try{const a=c.currentId?C(c.currentId):null,o={body:g(document.getElementById("ce-body")?.value,1),wits:g(document.getElementById("ce-wits")?.value,1),spirit:g(document.getElementById("ce-spirit")?.value,1),presence:g(document.getElementById("ce-presence")?.value,1),skills:{},talents:a?.talents||[],assets:E("asset"),equipment:E("equipment")};L.forEach(m=>{const r=m.toLowerCase(),u=g(document.getElementById(`ce-sk-${r}`)?.value,0);o.skills[r]=u});const t=U(o),i=n-t,d=i<0,l=document.querySelector(".ce-xp-bar");l&&(l.className=`xp-budget-bar ${d?"xp-budget-over":"xp-budget-ok"}`,l.innerHTML=`
                <strong>XP:</strong> ${n} available − ${t} spent = 
                <span style="color:${d?"var(--red)":"var(--green)"};font-weight:bold;">
                    ${i>0?i+" remaining":i===0?"exactly spent":Math.abs(i)+" OVER!"}
                </span>
            `)}catch(a){console.warn("[Editor] XP budget recalculation failed:",a)}}function pe(){const e=document.getElementById("ce-magic-path")?.value||"none",n=document.getElementById("ce-runekeeper-fields"),a=document.getElementById("ce-cantor-fields"),o=document.getElementById("ce-invoker-fields"),t=document.getElementById("ce-summoner-fields"),i=document.getElementById("ce-witch-fields"),d=document.getElementById("ce-psion-fields"),l=document.getElementById("ce-monk-fields");n&&(n.style.display=e==="runekeeper"?"block":"none"),a&&(a.style.display=e==="cantor"?"block":"none"),o&&(o.style.display=e==="invoker"?"block":"none"),t&&(t.style.display=e==="summoner"?"block":"none"),i&&(i.style.display=e==="witch"?"block":"none"),d&&(d.style.display=e==="psion"?"block":"none"),l&&(l.style.display=e==="monk"?"block":"none");const m=document.getElementById("ce-patron-hint");m&&(m.style.display=e==="invoker"?"block":"none")}function ne(){const e=g(document.getElementById("ce-body")?.value,1),n=g(document.getElementById("ce-spirit")?.value,1),a=g(document.getElementById("ce-presence")?.value,1),o=document.getElementById("ce-fatigue-max"),t=document.getElementById("ce-obligation-cap"),i=document.getElementById("ce-corruption-max"),d=document.getElementById("ce-mental-strain-max");o&&(o.textContent=e),t&&(t.textContent=n+a),i&&(i.textContent=n),d&&(d.textContent=n),y()}function _(){const{tier:e,name:n}=M(g(document.getElementById("ce-total-xp")?.value,32)),a=document.getElementById("ce-tier-display");a&&(a.textContent=`Tier ${e}: ${n}`),S()}function ge(){const e=document.getElementById("ce-armor-type")?.value||"none",n=O.find(o=>o.id===e),a=document.getElementById("ce-armor-info");a&&n&&(a.textContent=n.conversion),y()}function fe(){const e=document.getElementById("ce-weapon-class")?.value||"light",n=j.find(o=>o.id===e),a=document.getElementById("ce-weapon-info");a&&n&&(a.textContent=`Close: ${n.close} | Near: ${n.near} | ${n.notes}`),y()}function De(e,n){const a=document.getElementById(`ce-sk-${e}`);if(!a)return;const o=g(a.value,0),t=oe?.[e]||"wits";o>g(document.getElementById(`ce-${t}`)?.value,1)?a.style.borderColor="var(--red)":a.style.borderColor="",y()}function be(){const e=document.getElementById("ce-heritage")?.value||"human",n=F.find(o=>o.id===e),a=document.getElementById("ce-heritage-note");a&&n&&(a.textContent=n.note)}function V(e){const n=document.getElementById("ce-"+e+"-list");if(!n){v(`List for "${e}" not found.`,"error");return}const a=n.children.length,o=document.createElement("div");o.innerHTML=P(e,a,{});const t=o.firstElementChild;n.appendChild(t);const i=t.querySelector('input[type="text"]');i&&setTimeout(()=>i.focus(),50),y()}function G(e,n){const a=(D().wikiEntries||[]).find(l=>String(l.id)===String(n));if(!a){v("Wiki entry not found.","error");return}const o=document.getElementById("ce-"+e+"-list");if(!o){v(`List for "${e}" not found.`,"error");return}const t=o.children.length,i=a.cost!=null?a.cost:0,d=document.createElement("div");d.innerHTML=P(e,t,{name:a.title,cost:i}),o.appendChild(d.firstElementChild),v(`Added "${a.title}" from wiki.`,"success"),y()}function We(){return{id:ae(),name:"",avatar:"",heritage:"human",heritageNote:"",background:"",backgroundTags:[],backgroundContact:"",backgroundBoon:"",backgroundObligation:"",region:"",culturalAffinity:"",patron:"",magicPath:"none",tier:"I",totalXp:32,startingXp:32,xpFromBonds:0,xpFromComplications:0,xpSpent:0,body:1,wits:1,spirit:1,presence:1,skills:se(),talents:[],talentUses:{},assets:[],equipment:[],bonds:[],complications:[],strings:[],debtTimers:[],harm:0,fatigue:0,fatigueMax:1,boons:0,obligation:0,obligationCapacity:2,corruption:0,corruptionMax:1,corruptionTier:0,spellbook:[],boundSpirits:[],leash:0,leashCapacity:4,mentalStrain:0,mentalStrainMax:0,vtt:!1,armorType:"none",shieldType:"none",weaponClass:"light",weaponTags:[],armorConversion:"",symbols:[],symbolStates:{},rites:[],thiasos:"",codex:"",repertoire:[],hedgeGifts:[],shadow:0,shame:0,identityStrain:0,promiseTimers:[],psionicArts:[],monasticTradition:"",breathState:"entering",monkCorruptionTier:0,knownTags:[],boundPatron:"",boundPatronBonus:1,bloomCount:0,resonantRites:[],learnedTalents:[]}}function Ue(){const e=document.createElement("div");return e.id="charModal",e.className="editor-screen char-editor-screen",e.style.cssText=`
        display: none;
        max-width: 950px;
        width: 100%;
        margin: 0 auto;
    `,e.innerHTML=`
        <button id="charModalClose" class="btn btn-secondary editor-back">← Back</button>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
            <h2 id="char-modal-title" style="margin:0;color:var(--gold);">Character Editor</h2>
        </div>
        <div id="char-editor-content" style="max-height:80vh; overflow-y:auto;"></div>
    `,e}function Ve(e){let n=e.backgroundTags;Array.isArray(n)||(typeof n=="string"?n=n.split(",").map(s=>s.trim()).filter(Boolean):n=[]);const a=F.map(s=>`<option value="${s.id}" ${e.heritage===s.id?"selected":""}>${p(s.label)}</option>`).join(""),o=Re.map(s=>`<option value="${s}" ${e.region===s?"selected":""}>${s}</option>`).join(""),t=He.map(s=>`<option value="${s.id}" ${e.magicPath===s.id?"selected":""}>${p(s.label)}</option>`).join(""),i=O.map(s=>`<option value="${s.id}" ${e.armorType===s.id?"selected":""}>${p(s.label)}</option>`).join(""),d=Ne.map(s=>`<option value="${s.id}" ${e.shieldType===s.id?"selected":""}>${p(s.label)}</option>`).join(""),l=j.map(s=>`<option value="${s.id}" ${e.weaponClass===s.id?"selected":""}>${p(s.label)}</option>`).join(""),m=R(e.patron||""),r=R(e.boundPatron||""),{tier:u,name:f}=M(e.totalXp||32),b=F.find(s=>s.id===e.heritage),x=O.find(s=>s.id===e.armorType),I=j.find(s=>s.id===e.weaponClass),w=L.map(s=>{const k=s.toLowerCase(),Z=e.skills?.[k]??0,J=oe?.[k]||"wits",Ie=J.charAt(0).toUpperCase()+J.slice(1);return ce(0,Z),`
            <div style="display:flex;align-items:center;gap:0.3rem;background:var(--bg3);padding:0.2rem 0.4rem;border-radius:4px;">
                <div style="flex:1;">
                    <label style="font-size:0.8rem;font-weight:500;">${s}</label>
                    <div style="font-size:0.6rem;color:var(--text3);">${Ie}</div>
                </div>
                <input type="number" id="ce-sk-${k}" value="${Z}" min="0" max="5" style="width:60px;text-align:center;" />
            </div>
        `}).join(""),H=(e.assets||[]).filter(s=>s&&typeof s=="object"&&s.name),q=(e.equipment||[]).filter(s=>s&&typeof s=="object"&&s.name),ye=(e.bonds||[]).filter(s=>s&&typeof s=="object"&&s.name),he=(e.complications||[]).filter(s=>s&&typeof s=="object"&&s.name),xe=H.map((s,k)=>P("asset",k,s)).join(""),ke=q.map((s,k)=>P("equipment",k,s)).join(""),Ee=ye.map((s,k)=>P("bond",k,s)).join(""),we=he.map((s,k)=>P("complication",k,s)).join(""),$e=(Array.isArray(e.symbols)?e.symbols:[]).map((s,k)=>P("symbol",k,{patron:s,state:e.symbolStates&&e.symbolStates[s]||"active"})).join(""),Ce=e.magicPath==="runekeeper",Se=e.magicPath==="cantor",K=e.magicPath==="invoker";return e.magicPath,e.magicPath,e.magicPath,e.magicPath,`
        <div style="display:flex;flex-direction:column;gap:0.8rem;">
            <!-- XP Budget Bar -->
            <div class="ce-xp-bar xp-budget-bar xp-budget-ok">
                <strong>XP:</strong> ${e.totalXp||32} available − 0 spent = <span style="color:var(--green);font-weight:bold;">${e.totalXp||32} remaining</span>
            </div>

            <!-- Identity -->
            <div style="display:flex;gap:0.8rem;align-items:flex-start;">
                <div style="flex-shrink:0;text-align:center;">
                    <img id="ce-avatar-preview" src="${p(e.avatar||"")}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid var(--border);background:var(--bg3);display:${e.avatar?"block":"none"};" onerror="this.style.display='none'" />
                    <div style="font-size:0.65rem;color:var(--text3);margin-top:0.2rem;">Portrait</div>
                </div>
                <div style="flex:1;">
                    <label>Portrait URL</label>
                    <input id="ce-avatar" value="${p(e.avatar||"")}" placeholder="https://... image link (optional)" />
                </div>
            </div>

            <!-- Identity -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Name *</label>
                    <input id="ce-name" value="${p(e.name)}" placeholder="Character name" />
                </div>
                <div>
                    <label>Heritage</label>
                    <select id="ce-heritage">${a}</select>
                    <div id="ce-heritage-note" style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">${b?.note||""}</div>
                </div>
                <div>
                    <label>Region</label>
                    <select id="ce-region">${o}</select>
                </div>
                <div>
                    <label>Cultural Affinity</label>
                    <input id="ce-cultural-affinity" value="${p(e.culturalAffinity||"")}" placeholder="Cultural trait" />
                </div>
                <div>
                    <label>Background</label>
                    <input id="ce-background" value="${p(e.background||"")}" placeholder="Background name" />
                </div>
                <div>
                    <label>Background Tags</label>
                    <input id="ce-background-tags" value="${p(n.join(", "))}" placeholder="e.g., Veteran, Muster Papers" />
                </div>
                <div>
                    <label>Signature Contact</label>
                    <input id="ce-background-contact" value="${p(e.backgroundContact||"")}" placeholder="Contact name" />
                </div>
                <div>
                    <label>Background Boon</label>
                    <input id="ce-background-boon" value="${p(e.backgroundBoon||"")}" placeholder="Once/session benefit" />
                </div>
                <div style="grid-column:1/-1;">
                    <label>Obligation Timer Seed</label>
                    <input id="ce-background-obligation" value="${p(e.backgroundObligation||"")}" placeholder="Starting complication" />
                </div>
            </div>

            <!-- Attributes -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0.5rem;">
                ${["body","wits","spirit","presence"].map(s=>`
                    <div style="background:var(--bg3);padding:0.3rem;border-radius:4px;text-align:center;">
                        <label style="font-weight:600;font-size:0.85rem;">${s.charAt(0).toUpperCase()+s.slice(1)}</label>
                        <input type="number" id="ce-${s}" value="${e[s]||1}" min="1" max="5" style="width:100%;text-align:center;font-size:1.1rem;" />
                        <div style="font-size:0.6rem;color:var(--text3);">Cost: ${A(1,e[s]||1)} XP</div>
                    </div>
                `).join("")}
            </div>

            <!-- Skills -->
            <div>
                <h4 style="margin:0.3rem 0;">Skills</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.3rem;">
                    ${w}
                </div>
            </div>

            <!-- Magic Path -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Magic Path</label>
                    <select id="ce-magic-path">${t}</select>
                </div>
                <div>
                    <label>Patron</label>
                    <select id="ce-patron">${m}</select>
                    <div id="ce-patron-hint" style="display:${K?"block":"none"};font-size:0.65rem;color:var(--text3);margin-top:0.2rem;">
                        Runekeeper/Cantor only — Invokers use Symbols below.
                    </div>
                </div>
            </div>

            <!-- Runekeeper Fields -->
            <div id="ce-runekeeper-fields" style="display:${Ce?"block":"none"};">
                <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div>
                        <label>Thiasos (Familiar)</label>
                        <input id="ce-thiasos" value="${p(e.thiasos||"")}" placeholder="e.g., white-hound, garden-spider" />
                    </div>
                    <div>
                        <label>Codex</label>
                        <input id="ce-codex" value="${p(e.codex||"")}" placeholder="e.g., iron-bound-ledger, frame-loom" />
                    </div>
                </div>
            </div>

            <!-- Cantor Fields -->
            <div id="ce-cantor-fields" style="display:${Se?"block":"none"};border-top:1px solid var(--border);padding-top:0.3rem;">
                <h5 style="margin:0.2rem 0;">🎵 Cantor</h5>
                <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div>
                        <label>Bound Patron</label>
                        <select id="ce-bound-patron">${r}</select>
                    </div>
                    <div>
                        <label>Position Bonus</label>
                        <input type="number" id="ce-bound-patron-bonus" value="${e.boundPatronBonus??1}" min="0" max="3" />
                    </div>
                    <div>
                        <label>Bloom Count</label>
                        <input type="number" id="ce-bloom-count" value="${e.bloomCount||0}" min="0" />
                    </div>
                    <div>
                        <label>Resonant Rites</label>
                        <input id="ce-resonant-rites" value="${p((e.resonantRites||[]).join(", "))}" placeholder="Comma-separated" />
                    </div>
                </div>
            </div>

            <!-- Invoker Fields -->
            <div id="ce-invoker-fields" style="display:${K?"block":"none"}; border-top:1px solid var(--border); padding-top:0.3rem;">
                <h5 style="margin:0.2rem 0;">🎴 Invoker Symbols</h5>
                <div class="info-box" style="font-size:0.75rem; background:var(--bg3); padding:0.3rem; border-radius:4px;">
                    Each symbol grants access to a patron's Borrowed Grace and rites. You can carry up to 4 symbols without penalty.
                </div>
                <div style="display:flex; gap:0.4rem; margin-bottom:0.3rem;">
                    <select id="ce-add-symbol-select" style="flex:1; background:var(--bg3); border:1px solid var(--border); border-radius:4px; padding:0.1rem 0.3rem;">
                        <option value="">— Select a patron —</option>
                        ${le().filter(s=>s.id).map(s=>`<option value="${s.id}">${p(s.label)}</option>`).join("")}
                    </select>
                    <button class="btn btn-sm btn-primary" id="ce-add-symbol-btn">➕ Add Symbol</button>
                </div>
                <div id="ce-symbol-list">${$e}</div>
                <div style="font-size:0.65rem;color:var(--text3);margin-top:0.2rem;">
                    Symbols added here appear in the Spellcraft panel for Invokers.
                </div>
            </div>

            <!-- Combat Loadout -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Armor</label>
                    <select id="ce-armor-type">${i}</select>
                    <div id="ce-armor-info" style="font-size:0.7rem;color:var(--text3);">${x?.conversion||""}</div>
                </div>
                <div>
                    <label>Shield</label>
                    <select id="ce-shield-type">${d}</select>
                </div>
                <div>
                    <label>Weapon</label>
                    <select id="ce-weapon-class">${l}</select>
                    <div id="ce-weapon-info" style="font-size:0.7rem;color:var(--text3);">${I?.notes||""}</div>
                </div>
            </div>

            <!-- Talents -->
            <div>
                <h4 style="margin:0.3rem 0;">🧠 Talents</h4>
                <div id="ce-talent-filter-bar" style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.3rem;"></div>
                <div id="ce-talent-catalog" class="talent-catalog" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;background:var(--bg3);margin-bottom:0.3rem;"></div>
                <div id="ce-talent-list"></div>
                <button type="button" class="btn btn-sm btn-secondary" id="ce-add-custom-talent">+ Add Custom Talent</button>
            </div>

            <!-- Assets -->
            <div>
                <h4 style="margin:0.3rem 0;">🏰 Assets</h4>
                <div id="ce-asset-list">${xe}</div>
                <button class="btn btn-sm btn-secondary" data-editor-add="asset">+ Add Asset</button>
            </div>

            <!-- Equipment -->
            <div>
                <h4 style="margin:0.3rem 0;">🎒 Equipment</h4>
                <div id="ce-equip-list">${ke}</div>
                <button class="btn btn-sm btn-secondary" data-editor-add="equipment">+ Add Equipment</button>
            </div>

            <!-- Bonds & Complications -->
            <div class="ce-fixed-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <h4 style="margin:0.3rem 0;">🤝 Bonds</h4>
                    <div id="ce-bond-list">${Ee}</div>
                    <button class="btn btn-sm btn-secondary" data-editor-add="bond">+ Add Bond</button>
                </div>
                <div>
                    <h4 style="margin:0.3rem 0;">⚠️ Complications</h4>
                    <div id="ce-complication-list">${we}</div>
                    <button class="btn btn-sm btn-secondary" data-editor-add="complication">+ Add Complication</button>
                </div>
            </div>

            <!-- Derived Stats -->
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.3rem;background:var(--bg3);padding:0.5rem;border-radius:4px;font-size:0.8rem;">
                <div>Fatigue: <span id="ce-fatigue-max">${e.body||1}</span></div>
                <div>Obligation Cap: <span id="ce-obligation-cap">${(e.spirit||1)+(e.presence||1)}</span></div>
                <div>Corruption: <span id="ce-corruption-max">${e.spirit||1}</span></div>
                <div>Mental Strain: <span id="ce-mental-strain-max">${e.spirit||1}</span></div>
                <div>Tier: <span id="ce-tier-display">Tier ${u}: ${f}</span></div>
            </div>

            <!-- Total XP -->
            <div>
                <label>Total XP</label>
                <input type="number" id="ce-total-xp" value="${e.totalXp||32}" min="0" max="999" />
            </div>

            <!-- VTT -->
            <div>
                <label><input type="checkbox" id="ce-vtt" ${e.vtt?"checked":""} /> Push to VTT</label>
            </div>

            <!-- Buttons -->
            <div style="display:flex;gap:0.5rem;margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid var(--border);">
                <button class="btn btn-gold" id="ce-save-btn">💾 Save</button>
                <button class="btn btn-secondary" id="ce-cancel-btn">Cancel</button>
            </div>
        </div>
    `}async function ve(e){console.log("[Editor] openEditor called with id:",e),B();try{await Ae(),T=null,console.log("[Editor] Patron data loaded")}catch(l){console.warn("[Editor] Failed to load patron data:",l)}try{await Xe()}catch(l){console.warn("[Editor] Failed to load talent catalog:",l)}z();const n=Ue(),a=document.getElementById("app-content")||document.body;c.hiddenSiblings=Array.from(a.children),c.hiddenSiblings.forEach(l=>{l.dataset.ceHidden="1",l.style.display="none"}),a.appendChild(n);const o=document.getElementById("char-modal-title"),t=document.getElementById("char-editor-content");if(!n||!o||!t){v("Editor modal not found. Please refresh.","error");return}let i;if(e){if(i=C(e),!i){v("Character not found","error");return}c.currentId=e,c.isNew=!1,o.textContent="Edit Character"}else i=We(),Pe(i),c.currentId=i.id,c.isNew=!0,o.textContent="New Character";if(i.learnedTalents||(i.learnedTalents=[]),i.learnedTalents.length===0&&i.magicPath&&i.magicPath!=="none"){const l=re[i.magicPath];l&&l.length&&(i.learnedTalents=[...l])}c.isOpen=!0,c.saved=!1,c.modalElement=n;let d;try{d=Ve(i)}catch(l){console.error("[Editor] buildEditorHTML failed:",l,"Character data:",i),v("Error building the character editor. Please refresh and try again.","error"),n.remove();return}t.innerHTML=d,n.style.display="block",a.scrollTop=0,window.scrollTo({top:0}),Ge(),y(),S(),X(),pe(),_(),ge(),fe(),be()}function B(){c.isNew&&!c.saved&&c.currentId&&Te(c.currentId);const e=document.getElementById("charModal");if(e&&e.remove(),c.hiddenSiblings&&(c.hiddenSiblings.forEach(n=>{n.dataset&&delete n.dataset.ceHidden,n.style.display=""}),c.hiddenSiblings=null),c.escListener&&(document.removeEventListener("keydown",c.escListener),c.escListener=null),c.saveListener){const n=document.getElementById("ce-save-btn");n&&n.removeEventListener("click",c.saveListener),c.saveListener=null}c.cancelListeners.forEach(({btn:n,handler:a})=>{n&&n.removeEventListener("click",a)}),c.cancelListeners=[],c.isOpen=!1,c.currentId=null,c.isNew=!1,c.saved=!1,c.modalElement=null}function Y(){const e=i=>document.querySelector(i),n=i=>e(i)?.value||"",a=i=>g(e(i)?.value),o=n("#ce-name");if(!o||!o.trim()){v("Character name is required.","error");const i=document.querySelector("#ce-name");i&&(i.style.borderColor="var(--red)",i.focus(),setTimeout(()=>i.style.borderColor="",3e3));return}let t=C(c.currentId);if(!t){v("Character not found","error");return}try{t.name=o.trim(),t.avatar=n("#ce-avatar").trim(),t.heritage=n("#ce-heritage")||"human",t.region=n("#ce-region"),t.culturalAffinity=n("#ce-cultural-affinity"),t.background=n("#ce-background");const i=n("#ce-background-tags");if(t.backgroundTags=i?i.split(",").map(r=>r.trim()).filter(Boolean):[],t.backgroundContact=n("#ce-background-contact"),t.backgroundBoon=n("#ce-background-boon"),t.backgroundObligation=n("#ce-background-obligation"),t.body=$(a("#ce-body"),1,5),t.wits=$(a("#ce-wits"),1,5),t.spirit=$(a("#ce-spirit"),1,5),t.presence=$(a("#ce-presence"),1,5),t.fatigueMax=t.body,t.obligationCapacity=t.spirit+t.presence,t.corruptionMax=t.spirit,t.mentalStrainMax=t.spirit,t.skills||(t.skills=se()),L.forEach(r=>{t.skills[r.toLowerCase()]=$(a("#ce-sk-"+r.toLowerCase()),0,5)}),t.magicPath=n("#ce-magic-path")||"none",t.patron=n("#ce-patron"),t.thiasos=n("#ce-thiasos").trim(),t.codex=n("#ce-codex").trim(),t.boundPatron=n("#ce-bound-patron"),t.boundPatronBonus=$(a("#ce-bound-patron-bonus"),0,3),t.bloomCount=Math.max(0,a("#ce-bloom-count")),t.resonantRites=n("#ce-resonant-rites")?n("#ce-resonant-rites").split(",").map(r=>r.trim()).filter(Boolean):[],t.magicPath==="runekeeper"&&!t.patron){const r=Fe({thiasos:t.thiasos,codex:t.codex});if(r){t.patron=r;const u=document.getElementById("ce-patron");u&&(u.value=r)}}t.armorType=n("#ce-armor-type")||"none",t.shieldType=n("#ce-shield-type")||"none",t.weaponClass=n("#ce-weapon-class")||"light",t.weaponTags=Array.from(document.querySelectorAll(".ce-weapon-tag:checked")).map(r=>r.value).slice(0,2),t.armorConversion=O.find(r=>r.id===t.armorType)?.conversion||"",t.totalXp=Math.max(0,a("#ce-total-xp"));const{tier:d,name:l}=M(t.totalXp);t.tier=d,t.tierName=l,t.harm=$(a("#ce-harm"),0,3),t.fatigue=$(a("#ce-fatigue"),0,t.fatigueMax),t.boons=$(a("#ce-boons"),0,5),t.obligation=Math.max(0,a("#ce-obligation")),t.corruption=$(a("#ce-corruption"),0,t.corruptionMax),t.corruptionTier=Math.max(0,a("#ce-corruption-tier")),t.leash=Math.max(0,a("#ce-leash")),t.mentalStrain=$(a("#ce-mental-strain"),0,t.mentalStrainMax),t.vtt=document.getElementById("ce-vtt")?.checked||!1;const m=E("symbol");if(t.symbols=m.map(r=>r.patron),t.symbolStates=m.reduce((r,u)=>(r[u.patron]=u.state||"active",r),{}),t.rites=E("rite").map(r=>r.name).filter(Boolean),t.repertoire=E("repertoire").map(r=>r.name).filter(Boolean),t.hedgeGifts=E("hedge-gift").map(r=>r.name).filter(Boolean),t.psionicArts=E("psionic-art").map(r=>r.name).filter(Boolean),t.boundSpirits=E("bound-spirit").filter(r=>r.name),t.monasticTradition=n("#ce-monastic-tradition"),t.breathState=n("#ce-breath-state")||"entering",t.monkCorruptionTier=Math.max(0,a("#ce-monk-corruption-tier")),t.knownTags=E("known-tag").map(r=>r.name).filter(Boolean),t.assets=E("asset").filter(r=>r.name),t.equipment=E("equipment").filter(r=>r.name),t.bonds=E("bond").filter(r=>r.name),t.complications=E("complication").filter(r=>r.name),t.learnedTalents||(t.learnedTalents=[]),t.learnedTalents.length===0&&t.magicPath&&t.magicPath!=="none"){const r=re[t.magicPath];r&&r.length&&(t.learnedTalents=[...r])}if(c.isNew){const r=t.bonds.filter(x=>x.start).length,u=t.complications.filter(x=>x.start).length;t.xpFromBonds=Math.min(r,2)*2,t.xpFromComplications=Math.min(u,2)*2,t.startingXp=Math.min(32+t.xpFromBonds+t.xpFromComplications,36),t.totalXp=t.startingXp;const{tier:f,name:b}=M(t.totalXp);if(t.tier=f,t.tierName=b,t.xpSpent=U(t),t.xpSpent>t.startingXp){const x=t.xpSpent-t.startingXp;if(!confirm(`This character is ${x} XP over budget (${t.xpSpent} spent, ${t.startingXp} available).

Save anyway?`))return}}N(c.currentId,t),c.saved=!0,B(),Be(()=>import("./characters.D4g1AIH0.js").then(r=>{r.renderCharList&&r.renderCharList()}),__vite__mapDeps([0,1,2,3,4,5])).catch(()=>{}),v(`Character "${t.name}" saved successfully. (Tier ${t.tier}: ${t.tierName})`,"success")}catch(i){console.error("[Editor] Error saving:",i),v("Error saving character. Please try again.","error")}}function Ge(){const e=document.getElementById("ce-save-btn");e&&(c.saveListener&&e.removeEventListener("click",c.saveListener),c.saveListener=Y,e.addEventListener("click",c.saveListener));for(const u of["ce-cancel-btn","charModalClose"]){const f=document.getElementById(u);if(f){const b=B;f.addEventListener("click",b),c.cancelListeners.push({btn:f,handler:b})}}c.escListener&&document.removeEventListener("keydown",c.escListener),c.escListener=u=>{c.isOpen&&u.key==="Escape"&&B()},document.addEventListener("keydown",c.escListener),["body","wits","spirit","presence"].forEach(u=>{const f=document.getElementById(`ce-${u}`);f&&(f.addEventListener("change",ne),f.addEventListener("input",ne))});const n=document.getElementById("ce-avatar"),a=document.getElementById("ce-avatar-preview");n&&a&&n.addEventListener("input",()=>{const u=n.value.trim();u?(a.src=u,a.style.display="block"):a.style.display="none"});const o=document.getElementById("ce-heritage");o&&o.addEventListener("change",be);const t=document.getElementById("ce-total-xp");t&&(t.addEventListener("input",()=>{_(),S(),y()}),t.addEventListener("change",()=>{_(),S(),y()}));const i=document.getElementById("ce-armor-type");i&&i.addEventListener("change",ge);const d=document.getElementById("ce-weapon-class");d&&d.addEventListener("change",fe);const l=document.getElementById("ce-magic-path");l&&l.addEventListener("change",pe),L.forEach(u=>{const f=u.toLowerCase(),b=document.getElementById(`ce-sk-${f}`);b&&(b.addEventListener("change",()=>De(f,u)),b.addEventListener("input",y))});const m=document.getElementById("ce-add-custom-talent");m&&m.addEventListener("click",()=>{c.currentId&&ie(c.currentId,-1)});const r=document.getElementById("ce-add-symbol-btn");r&&r.addEventListener("click",()=>{const u=document.getElementById("ce-add-symbol-select");if(!u)return;const f=u.value;if(!f){v("Please select a patron.","warning");return}const b=document.getElementById("ce-symbol-list");if(!b)return;const x=b.querySelectorAll(".ce-symbol-row");for(const H of x){const q=H.querySelector(".ce-symbol-patron");if(q&&q.value===f){v("Symbol already added.","info");return}}const I=R(f),w=document.createElement("div");w.className="dynamic-row ce-symbol-row",w.innerHTML=`
                <select class="ce-symbol-patron" style="flex:1;">${I}</select>
                <select class="ce-symbol-state" style="width:100px;">
                    <option value="active" selected>Active</option>
                    <option value="compromised">Compromised</option>
                    <option value="shattered">Shattered</option>
                </select>
                <button class="btn btn-xs editor-remove-btn">✕</button>
            `,b.appendChild(w),v(`Added Symbol of ${u.options[u.selectedIndex].text}`,"success"),y()}),document.querySelectorAll(".ce-weapon-tag").forEach(u=>{u.addEventListener("change",()=>{document.querySelectorAll(".ce-weapon-tag:checked").length>2&&(u.checked=!1,v("Weapon Tags are capped at 2.","warning")),y()})})}Object.assign(window,{addCEDynamic:V,addCEDynamicFromWiki:G,saveEditor:Y,closeEditor:B,openEditor:ve,addTalentFromCatalog:ue});var nt={openEditor:ve,closeEditor:B,saveEditor:Y,addCEDynamic:V,addCEDynamicFromWiki:G};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{console.log("[Editor] DOMContentLoaded, initializing"),z()}):(console.log("[Editor] DOM already loaded, initializing"),z());export{V as addCEDynamic,G as addCEDynamicFromWiki,B as closeEditor,nt as default,ve as openEditor,Y as saveEditor};
