const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/bestiary.CPB8-5uX.js","assets/rolldown-runtime.BQ-_32WO.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/Toast.DDAtBIAw.js","assets/websocket.Dmklt06W.js","assets/preload-helper.BATLnrmA.js","assets/main.hiOZSyFC.js","assets/sync.i5xh8ufD.js","assets/main.DcCFXHiG.css","assets/objective-types.CuiNbA6A.js","assets/gm-tools.BcndmVEn.js","assets/talent-effects.CY-tOZj6.js","assets/decks.CN3iDKhv.js","assets/discovery.I-q7Uafb.js"])))=>i.map(i=>d[i]);
import{i as v,l as K}from"./utils.lBShoim5.js";import{D as R,b as H}from"./state.42sFgcOQ.js";import{n as l}from"./Toast.DDAtBIAw.js";import{t as Q}from"./preload-helper.BATLnrmA.js";import{C as G,p as J,y as pe}from"./websocket.Dmklt06W.js";import{h as ve,m as fe}from"./main.hiOZSyFC.js";import{n as be,r as Z,t as ee}from"./objective-types.CuiNbA6A.js";import{r as ge,t as ye}from"./gm-tools.BcndmVEn.js";import{n as he,r as xe}from"./bestiary.CPB8-5uX.js";var F=new Map;function we(e,{hostId:t="app-content",maxWidth:n=null}={}){const r=F.get(e);if(r&&r.panel.isConnected)return r.panel;const s=document.getElementById(t)||document.body,o=document.createElement("div");o.id=e,o.className="editor-screen-host";const a=Array.from(s.children);return a.forEach(i=>{i.style.display="none"}),s.appendChild(o),window.scrollTo({top:0}),F.set(e,{panel:o,hiddenSiblings:a,host:s}),o}function $e(e){const t=F.get(e);t&&(t.panel&&t.panel.parentNode&&t.panel.parentNode.removeChild(t.panel),t.hiddenSiblings.forEach(n=>{n.style.display=""}),F.delete(e))}function Ae(e,t,n,{backLabel:r="← Back",maxWidth:s="700px"}={}){return`
        <div class="editor-screen" style="max-width:${s};margin:0 auto;">
            <button id="${e}-back" class="btn btn-secondary editor-back">${r}</button>
            ${t?`<h2>${t}</h2>`:""}
            ${n}
        </div>
    `}var L="/data/adventures/",B=null,b=[],z=null,N="list",C=!1;function g(){return J()?ve(fe()):!0}function T(e,t="info",n="adventure_event",r={}){try{ge(e,t),ye(n,r)}catch{}}function V(e){if(!J())return;if(!e){try{G({type:"scene-status-update",scene:null})}catch{}return}const t=e.acts?.[e.currentAct]||null,n=t?.scenes?.[e.currentScene]||null;try{G({type:"scene-status-update",scene:{adventureId:e.id,adventureTitle:e.title,actTitle:t?t.title:null,sceneTitle:n?n.title:null,status:e.status}})}catch{}}function te(e,t,n,r){if(J())try{G({type:"adventure-timer",scope:t,ref:n,name:e,amount:r})}catch{}}function Se(e){const t=e&&e.tickedTimer;if(!t||!t.name)return;const n=_e();if(!n)return;const r=t.scope==="campaign"?"campaign":"scene";let s=null;if(r==="campaign"?s=(n.campaignTimers||[]).find(i=>i.name===t.name):s=(n.acts?.[n.currentAct]?.scenes?.[n.currentScene]?.timers||[]).find(i=>i.name===t.name),!s)return;const o=s.current||0,a=Math.max(0,Math.min(t.segments??s.segments,t.current));if(a!==o){if(s.current=a,y(),r==="campaign"){const i=(n.campaignTimers||[]).indexOf(s),c=n.timerIds?.[i];if(c){const d=H().timers.find(m=>m.id===c);d&&(d.current=a,R())}}t.full&&o<s.segments&&(l(`⏱️ ${r==="campaign"?"Adventure":"Scene"} Timer "${s.name}" completed!`,"warning"),T(`⏱️ ${r==="campaign"?"Adventure":"Scene"} Timer "${s.name}" completed (${n.title})`,"warning","adventure_timer_completed",{adventureId:n.id,timerName:s.name})),w()}}pe("timer-ticked",Se);function ne(e,t,n,r){if(!t.triggers||!Array.isArray(t.triggers))return;const s=t.triggers;r.actIndex!==void 0&&r.actIndex,r.sceneIndex!==void 0&&r.sceneIndex,r.timerIndex,s.forEach(o=>{const{type:a}=o;switch(a){case"notify":{const i=o.message||`Timer "${t.name}" completed.`;l(i,"warning"),T(`⏱️ ${i}`,"warning","timer_trigger_notify",{timerName:t.name,adventureId:e.id,scope:n});break}case"completeScene":{const i=o.sceneIndex;if(i==null){console.warn("[Adventures] completeScene trigger missing sceneIndex");return}const c=e.acts?.[e.currentAct];if(!c)return;const d=c.scenes?.[i];if(!d)return;d.completed||(d.completed=!0,T(`📜 Scene "${d.title}" auto‑completed by timer "${t.name}"`,"info","scene_auto_completed",{adventureId:e.id,sceneIndex:i,sceneTitle:d.title})),y();break}case"advanceScene":{const i=o.sceneIndex;if(i==null){console.warn("[Adventures] advanceScene trigger missing sceneIndex");return}const c=e.acts?.[e.currentAct];if(!c)return;i<c.scenes.length?(e.currentScene=i,T(`⏩ Advanced to scene "${c.scenes[i].title}" by timer "${t.name}"`,"info","scene_advanced",{adventureId:e.id,sceneIndex:i}),V(e),y()):console.warn("[Adventures] advanceScene target index out of range");break}case"setEncounterPosition":{const i=o.sceneIndex,c=o.encounterIndex,d=o.position;if(i===void 0||c===void 0||!d){console.warn("[Adventures] setEncounterPosition missing required params");return}const m=e.acts?.[e.currentAct];if(!m)return;const p=m.scenes?.[i];if(!p)return;const $=p.encounters?.[c];if(!$)return;$.position=d,T(`⚔️ Encounter "${$.name}" position set to ${d} by timer "${t.name}"`,"info","encounter_position_changed",{adventureId:e.id,sceneIndex:i,encounterIndex:c,position:d}),y();break}default:console.warn(`[Adventures] Unknown timer trigger type: ${a}`)}})}var ke=["em","strong","i","b"];function re(e){const t=[],n=new RegExp(`</?(?:${ke.join("|")})>`,"gi"),r=String(e).replace(n,o=>(t.push(o),`\0${t.length-1}\0`));let s=v(r);return s=s.replace(/\u0000(\d+)\u0000/g,(o,a)=>t[Number(a)]),s}function se(e){return e.replace(/\[([A-Za-z][A-Za-z ]{0,20}):\s*([^\]]+)\]/g,(t,n,r)=>`
        <span style="display:inline-block;margin:0.15rem 0.2rem 0.15rem 0;padding:0.1rem 0.5rem;background:var(--bg4);border-radius:10px;border-left:3px solid var(--gold);font-size:0.8rem;">
            <strong style="color:var(--gold);">${n}:</strong> ${r}
        </span>
    `)}function ie(e){return e.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")}var ae=["🌱","🏔️","👑","🤝","🌟","⏱️","♠️"];function Te(e){return ae.filter(t=>e.includes(t)).length>=3}function Ee(e){return`<div class="crown-spread-reading">${e.split(/(?=(?:🌱|🏔️|👑|🤝|🌟|⏱️|♠️))/g).map(t=>t.trim()).filter(Boolean).map(t=>{const n=ae.find(d=>t.startsWith(d)),r=n?t.slice(n.length).trim():t,s=r.indexOf(":");let o="",a=r;s>-1&&s<=25&&(o=r.slice(0,s).replace(/\*\*/g,"").trim(),a=r.slice(s+1).replace(/^\*\*\s*/,"").trim());const i=se(ie(re(a))),c=n==="🌟"||n==="⏱️"||n==="♠️";return`
            <div style="
                padding:0.5rem 0.7rem;margin:0.3rem 0;border-radius:8px;
                background:${c?"var(--bg4)":"var(--bg3)"};
                border-left:3px solid ${c?"var(--gold)":"var(--border)"};
            ">
                ${o?`<div style="font-weight:600;color:var(--gold);margin-bottom:0.2rem;">${n||""} ${v(o)}</div>`:""}
                <div style="font-size:0.9rem;line-height:1.5;color:var(--text2);">${i}</div>
            </div>
        `}).join("")}</div>`}function X(e){if(!e)return"";if(Te(e))return Ee(e);const t=se(ie(re(e))),n=t.split(/\n\s*\n/).map(r=>r.trim()).filter(Boolean);return n.length<=1?`<p style="margin:0.3rem 0;line-height:1.5;">${t}</p>`:n.map(r=>`<p style="margin:0.3rem 0;line-height:1.5;">${r}</p>`).join("")}function Ie(e,t=160){if(!e)return"";let n=String(e).replace(/<\/?[^>]+>/g,"").replace(/\[[^\]]+\]/g,"").replace(/\*\*/g,"").replace(/[🌱🏔️👑🤝🌟⏱️♠️]/g,"").replace(/\s+/g," ").trim();return n.length>t&&(n=n.slice(0,t).trim()+"…"),n}function x(e){return`${e}${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`}function U(e){let t=!1;return e.id||(e.id=x("adv_"),t=!0),(e.acts||[]).forEach(n=>{n.id||(n.id=x("act_"),t=!0),(n.scenes||[]).forEach(r=>{r.id||(r.id=x("scene_"),t=!0)})}),(e.npcs||[]).forEach(n=>{n.id||(n.id=x("npc_"),t=!0)}),(e.locations||[]).forEach(n=>{n.id||(n.id=x("loc_"),t=!0)}),(e.bestiary||[]).forEach(n=>{n.id||(n.id=x("creature_"),t=!0)}),e.timerIds||(e.timerIds=[],t=!0),t}function M(){const e=H();if(e.adventures){b=e.adventures;let t=!1;return b.forEach(n=>{U(n)&&(t=!0),Array.isArray(n.bestiary)||(n.bestiary=[])}),t&&(console.warn("[Adventures] Repaired empty ids on one or more previously-saved adventures."),y()),b}return b=[],b}function y(){try{JSON.stringify(b);const e=H();return e.adventures=b,R(),!0}catch(e){return console.error("[Adventures] Failed to save adventures to storage:",e),l(`⚠️ Couldn't save adventures (${e.message}). Check the console — changes will NOT survive a refresh.`,"error"),!1}}async function Ce(e){const t=[`${L}${e}.json`,`.${L}${e}.json`];e==="lantern_at_dusk"&&(t.push(`${L}lantern_at_dusk.json`),t.push(`.${L}lantern_at_dusk.json`));let n=null;for(const r of t)try{const s=await fetch(r);if(!s.ok){n=new Error(`HTTP ${s.status} at ${r}`);continue}const o=await s.text();if(!o||o.trim()===""){n=new Error(`Empty file at ${r}`);continue}let a;try{a=JSON.parse(o)}catch(c){n=new Error(`Invalid JSON at ${r}: ${c.message}`);continue}a.id||(a.id=e),Array.isArray(a.acts)||(a.acts=[]),a.acts=a.acts.map(c=>({...c,scenes:Array.isArray(c.scenes)?c.scenes:[]})),Array.isArray(a.npcs)||(a.npcs=[]),Array.isArray(a.locations)||(a.locations=[]),Array.isArray(a.campaignTimers)||(a.campaignTimers=[]),Array.isArray(a.bestiary)||(a.bestiary=[]),a.timerIds||(a.timerIds=[]),U(a);const i=b.find(c=>c.id===a.id);return i?Object.assign(i,a):b.push(a),y(),a}catch(s){n=s}return console.warn(`[Adventures] Failed to load ${e}:`,n),null}async function Le(){const e=[`${L}manifest.json`,`.${L}manifest.json`];for(const t of e)try{const n=await fetch(t);if(!n.ok){console.warn(`[Adventures] Manifest fetch failed: ${t} → HTTP ${n.status}`);continue}const r=await n.json();return Array.isArray(r)?r:Array.isArray(r?.adventures)?r.adventures:(console.warn(`[Adventures] ${t} loaded but had unexpected shape:`,r),[])}catch(n){console.warn(`[Adventures] Manifest fetch errored: ${t} →`,n)}return null}async function ze(){if(!g()){l("Only the GM can browse the adventure library.","error");return}const e=await Le();if(C)return;if(e===null){l(`Couldn't reach manifest.json under ${L} (tried both absolute and relative paths). Check the server serves that folder.`,"error");return}if(e.length===0){l(`${L}manifest.json was found, but the adventure list is empty.`,"warning");return}const t=document.createElement("div");t.className="editor-screen-host",t.style.cssText=`
        display: flex; align-items: center; justify-content: center;
        padding: 1rem 0; animation: fadeIn 0.2s ease;
    `;const n=document.createElement("div");n.className="editor-screen",n.style.cssText=`
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
    `,n.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">
            <h3 style="margin:0;color:var(--gold);">📚 Adventure Library</h3>
            <span style="font-size:0.8rem;color:var(--text3);">${e.length} available</span>
        </div>
        <p style="margin:0 0 0.8rem 0;font-size:0.85rem;color:var(--text2);">
            Click an adventure to load it into your library.
        </p>
        <div style="flex:1;overflow-y:auto;padding-right:0.3rem;">
            ${e.map(a=>`
                <div class="adv-library-item" data-slug="${v(a)}" style="
                    padding:0.4rem 0.6rem;
                    margin:0.15rem 0;
                    background:var(--bg3);
                    border-radius:var(--radius);
                    cursor:pointer;
                    transition:all 0.15s;
                    border-left:3px solid transparent;
                    font-size:0.9rem;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                ">
                    <span>${v(a)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">📄 JSON</span>
                </div>
            `).join("")}
        </div>
        <div style="margin-top:0.8rem;display:flex;justify-content:flex-end;">
            <button class="btn btn-sm btn-secondary" id="adv-library-cancel">← Back</button>
        </div>
    `,t.appendChild(n);const r=document.getElementById("app-content")||document.body,s=Array.from(r.children);s.forEach(a=>{a.style.display="none"}),r.appendChild(t),window.scrollTo({top:0});const o=()=>{t.remove(),s.forEach(a=>{a.style.display=""})};if(!document.getElementById("adv-library-styles")){const a=document.createElement("style");a.id="adv-library-styles",a.textContent=`
            .adv-library-item:hover {
                background: var(--bg4);
                border-left-color: var(--gold);
                transform: translateX(2px);
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
        `,document.head.appendChild(a)}n.querySelector("#adv-library-cancel").addEventListener("click",o),n.querySelectorAll(".adv-library-item").forEach(a=>{a.addEventListener("click",async function(){const i=this.dataset.slug;this.style.opacity="0.5",this.style.cursor="wait",this.innerHTML=`<span>${v(i)}</span><span style="font-size:0.6rem;color:var(--gold);">⏳ Loading…</span>`;const c=await Ce(i);if(C){o();return}o(),c?(l(`📚 Loaded "${c.title}" from the library.`,"success"),w()):l(`Failed to load "${i}" — check ${L}${i}.json exists and is valid JSON.`,"error")})})}function A(e){return b.find(t=>t.id===e)}function _e(){return b.length===0&&M(),z?A(z):null}function oe(e){if(!g())return l("Only the GM can create adventures.","error"),null;const t=Array.isArray(e.acts)?e.acts.map(r=>({...r,scenes:Array.isArray(r.scenes)?r.scenes:[]})):[],n={id:e.id||x("adv_"),title:e.title||"Untitled Adventure",description:e.description||"",tier:e.tier||"I",tierRange:e.tierRange||e.tier||"I",author:e.author||"GM",acts:t,npcs:Array.isArray(e.npcs)?e.npcs:[],locations:Array.isArray(e.locations)?e.locations:[],factions:Array.isArray(e.factions)?e.factions:[],campaignTimers:Array.isArray(e.campaignTimers)?e.campaignTimers:[],bestiary:Array.isArray(e.bestiary)?e.bestiary:[],timerIds:[],notes:e.notes||"",currentAct:e.currentAct||0,currentScene:e.currentScene||0,startedAt:e.startedAt||null,completedAt:e.completedAt||null,status:e.status||"planned",createdAt:e.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};U(n);try{JSON.parse(JSON.stringify(n))}catch(r){return console.error("[Adventures] createAdventure produced non-serializable data:",r,n),l(`⚠️ Adventure data couldn't be created (${r.message}). Check the console — nothing was saved.`,"error"),null}return b.push(n),y(),n}function Oe(e,t){if(!g())return l("Only the GM can update adventures.","error"),null;const n=b.findIndex(r=>r.id===e);return n===-1?null:(b[n]={...b[n],...t,updatedAt:new Date().toISOString()},y(),b[n])}function Be(e){if(!g())return!1;const t=b.findIndex(n=>n.id===e);return t===-1?!1:(b.splice(t,1),z===e&&(z=null),y(),!0)}function Ne(e){if(!g())return l("Only the GM can duplicate adventures.","error"),null;const t=A(e);if(!t)return null;const n=JSON.parse(JSON.stringify(t));return n.id=x("adv_"),n.title=`${t.title} (Copy)`,n.status="planned",n.startedAt=null,n.completedAt=null,n.createdAt=new Date().toISOString(),n.updatedAt=new Date().toISOString(),n.timerIds=[],b.push(n),y(),n}function Me(e){if(!g())return l("Only the GM can start an adventure.","error"),null;const t=A(e);if(!t)return null;t.status="active",t.startedAt=new Date().toISOString(),t.currentAct=0,t.currentScene=0,t.acts.forEach(s=>{s.scenes.forEach(o=>o.completed=!1)}),t.campaignTimers.forEach(s=>s.current=0),y();const n=H();n.timers||(n.timers=[]);const r=[];return t.campaignTimers.forEach((s,o)=>{const a=t.timerIds?.[o];if(a){const i=n.timers.find(c=>c.id===a);if(i)i.current=s.current,i.segments=s.segments,i.name=s.name,i.description=s.description||"",r.push(a);else{const c=x("timer_");n.timers.push({id:c,name:s.name,segments:s.segments,current:s.current,description:s.description||"",adventureId:t.id,timerIndex:o}),r.push(c)}}else{const i=x("timer_");n.timers.push({id:i,name:s.name,segments:s.segments,current:s.current,description:s.description||"",adventureId:t.id,timerIndex:o}),r.push(i)}}),t.timerIds=r,R(),z=e,T(`🎭 Adventure started: ${t.title}`,"warning","adventure_started",{id:t.id,title:t.title,tier:t.tier}),V(t),t}function je(e,t,n){if(!g())return l("Only the GM can complete scenes.","error"),null;b.length===0&&M();const r=A(e);if(!r)return null;const s=r.acts[t];if(!s)return null;const o=s.scenes[n];if(!o)return null;o.completed=!0,T(`📜 Scene completed: "${o.title}" (${r.title})`,"info","scene_completed",{adventureId:r.id,actIndex:t,sceneIndex:n,sceneTitle:o.title});const a=n+1;if(a<s.scenes.length)r.currentScene=a;else{const i=t+1;i<r.acts.length?(r.currentAct=i,r.currentScene=0,T(`📖 Act completed: "${s.title}" (${r.title})`,"warning","act_completed",{adventureId:r.id,actIndex:t,actTitle:s.title})):(r.status="completed",r.completedAt=new Date().toISOString(),T(`🏁 Adventure completed: ${r.title}`,"warning","adventure_completed",{adventureId:r.id,title:r.title}))}return y(),V(r),r}function De(e,t,n=1){if(!g())return l("Only the GM can advance adventure timers.","error"),null;const r=A(e);if(!r)return null;const s=r.campaignTimers[t];if(!s)return null;const o=s.current>=s.segments;s.current=Math.min(s.current+n,s.segments),y();const a=r.timerIds?.[t];if(a){const i=H().timers.find(c=>c.id===a);i&&(i.current=s.current,R())}return s.current>=s.segments&&!o&&(l(`⏱️ Adventure Timer "${s.name}" completed!`,"warning"),T(`⏱️ Adventure Timer "${s.name}" completed (${r.title})`,"warning","adventure_timer_completed",{adventureId:r.id,timerName:s.name}),ne(r,s,"campaign",{timerIndex:t}),y()),te(s.name,"campaign",t,n),r}function Re(e,t,n,r,s=1){if(!g())return l("Only the GM can advance scene timers.","error"),null;const o=A(e);if(!o)return null;const a=o.acts?.[t]?.scenes?.[n];if(!a||!Array.isArray(a.timers))return null;const i=a.timers[r];if(!i)return null;const c=i.current>=i.segments;return i.current=Math.max(0,Math.min(i.current+s,i.segments)),y(),i.current>=i.segments&&!c&&(l(`⏱️ Scene Timer "${i.name}" completed!`,"warning"),T(`⏱️ Scene Timer "${i.name}" completed (${o.title} — ${a.title})`,"warning","adventure_scene_timer_completed",{adventureId:o.id,actIndex:t,sceneIndex:n,timerName:i.name}),ne(o,i,"scene",{actIndex:t,sceneIndex:n,timerIndex:r}),y()),te(i.name,"scene",r,s),o}function He(e){if(!g())return l("Only the GM can reset an adventure.","error"),null;const t=A(e);if(!t)return null;t.status="planned",t.startedAt=null,t.completedAt=null,t.currentAct=0,t.currentScene=0,t.acts.forEach(r=>{r.scenes.forEach(s=>s.completed=!1)}),t.campaignTimers.forEach(r=>r.current=0),y();const n=H();return n.timers&&t.timerIds&&(t.timerIds.forEach(r=>{const s=n.timers.find(o=>o.id===r);s&&(s.current=0)}),R()),T(`🔄 Adventure reset: ${t.title}`,"info","adventure_reset",{id:t.id,title:t.title}),V(null),t}async function qe(e,t){if(!e)return null;e.bestiary||(e.bestiary=[]);let n=e.bestiary.find(r=>r.id===t);if(n||(n=e.bestiary.find(r=>(r.name||"").toLowerCase()===t.toLowerCase()),n))return n;try{const r=await xe();if(Array.isArray(r)){let s=r.find(o=>o.id===t);if(s||(s=r.find(o=>(o.name||"").toLowerCase()===t.toLowerCase())),s)return{...s}}}catch(r){console.warn("[Adventures] Could not load global bestiary for fallback:",r)}return null}async function Pe(e,t,n){if(!g()){l("Only the GM can start scene encounters.","error");return}const r=A(e);if(!r){l("Adventure not found.","error");return}const s=r.acts?.[t]?.scenes?.[n];if(!s){l("Scene not found.","error");return}const o=H();o.encounters||(o.encounters=[]);let a=s.encounterId?o.encounters.find(d=>String(d.id)===String(s.encounterId)):null;const i=(s.encounters||[]).map(async d=>{if(d.creatureId){const m=await qe(r,d.creatureId);if(m){const p=m.stats||{};return!p.hp&&m.tl&&(p.hp=m.tl*10+10),p.hp||(p.hp=20),{name:m.name||"Adversary",body:he(m)||"",tier:m.tl||2,tl:m.tl,class:m.class||"",category:m.category||"",stats:p,sb_spends:m.sb_spends||[],_sceneDv:d.dv,_scenePosition:d.position,_sceneOutcomes:d.outcomes}}else return l(`⚠️ Creature "${d.creatureId}" not found in adventure bestiary or global.`,"warning"),null}else return{name:d.name||"Adversary",body:d.body||"",tier:d.tl||d.dv||2,tl:d.tl,class:d.class||"",category:d.category||"",stats:d.stats||{hp:(d.tl||2)*10+10},sb_spends:d.sb_spends||[],_sceneDv:d.dv,_scenePosition:d.position,_sceneOutcomes:d.outcomes}}),c=(await Promise.all(i)).filter(d=>d!==null);if(a?(a.adversaries=c,R()):(a={id:x("enc_"),title:`${s.title} (${r.title})`,body:s.description||"",difficulty:2,location:"",status:"active",type:s.type||"combat",customLabel:s.customLabel||"",customTickLabel:s.customTickLabel||"",adversaries:c,created:Date.now(),fromAdventureId:r.id,fromAdventureTitle:r.title,fromSceneTitle:s.title},o.encounters.push(a),R(),s.encounterId=a.id,y(),T(`⚔️ Encounter "${a.title}" started from scene "${s.title}"`,"warning","encounter_created",{name:a.title,id:a.id,status:a.status,fromAdventure:r.id})),J())try{G({type:"adventure-log",text:`⚔️ Encounter started: ${s.title} (${r.title}) — ${c.map(d=>d.name).join(", ")||"no adversaries"}`,author:"GM"})}catch{}try{(await Q(()=>import("./bestiary.CPB8-5uX.js").then(d=>d.a),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]))).openTracker(a.id)}catch(d){console.warn("[Adventures] Failed to open Combat Tracker:",d),l("Combat Tracker not available.","error")}}function Ge(e){return String(e||"adventure").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,60)||"adventure"}function ce(e){if(!g()){l("Only the GM can export adventures.","error");return}const t=A(e);if(!t)return;const n=JSON.stringify(t,null,2),r=new Blob([n],{type:"application/json"}),s=URL.createObjectURL(r),o=document.createElement("a");o.href=s,o.download=`${Ge(t.title)}.json`,o.click(),URL.revokeObjectURL(s),l(`📤 Exported "${t.title}"`,"success")}function Fe(e,t={}){const{confirmOverwrite:n=!1,silent:r=!1,sourceLabel:s="Imported"}=t;if(!e||typeof e!="object"||!e.title)throw new Error('Invalid adventure format: missing "title".');Array.isArray(e.acts)||(e.acts=[]),e.acts=e.acts.map(a=>({...a,scenes:Array.isArray(a.scenes)?a.scenes:[]})),Array.isArray(e.npcs)||(e.npcs=[]),Array.isArray(e.locations)||(e.locations=[]),Array.isArray(e.campaignTimers)||(e.campaignTimers=[]),Array.isArray(e.bestiary)||(e.bestiary=[]),e.timerIds||(e.timerIds=[]),U(e),JSON.parse(JSON.stringify(e)),M();const o=b.find(a=>a.id===e.id);if(o){if(n&&!confirm(`Adventure "${e.title}" already exists. Overwrite?`))return null;Object.assign(o,e)}else b.push(e);return y()&&!r&&l(`📥 ${s}: "${e.title}"`,"success"),e}function gt(e){M();const t=b.length;return b=b.filter(n=>n.id!==e),b.length!==t?(y(),!0):!1}async function Je(){return g()?new Promise(e=>{const t=document.createElement("input");t.type="file",t.accept=".json",t.onchange=async n=>{const r=n.target.files[0];if(!r){e(null);return}try{const s=await r.text();if(!s||s.trim()===""){l("File is empty.","error"),e(null);return}let o;try{o=JSON.parse(s)}catch(i){l(`Invalid JSON: ${i.message}`,"error"),e(null);return}let a;try{a=Fe(o,{confirmOverwrite:!0,sourceLabel:"Imported"})}catch(i){l(i.message,"error"),e(null);return}e(a)}catch(s){l("Failed to import adventure: "+s.message,"error"),e(null)}},t.click()}):(l("Only the GM can import adventures.","error"),null)}var Ve=[{marker:"🌱",label:"Root",role:"npc"},{marker:"🏔️",label:"Crest",role:"location"},{marker:"👑",label:"Crown",role:"complication"},{marker:"🤝",label:"Left Hand",role:"reward"}],Ue=["🌱","🏔️","👑","🤝","🌟","⏱️","♠️"];function We(e){const t=e.match(/\((\d+)\s*segments if highest\)/i),n=t?parseInt(t[1],10):null,r=e.match(/^([A-Za-z0-9]+ of [A-Za-z]+)/),s=r?r[1]:null,o=e.replace(/^[^:]*:\s*/,""),a=o.match(/^([^:]{2,60}):\s*([\s\S]*)$/),i=a?a[1].trim():null;let c=a?a[2]:o;return c=c.replace(/\(\d+\s*segments if highest\)\.?\s*$/i,"").trim(),{cardLabel:s,title:i,flavor:c,tierSegments:n}}function Ke(e){const t=String(e||"").split(/(?=(?:🌱|🏔️|👑|🤝|🌟|⏱️|♠️))/g).map(i=>i.trim()).filter(Boolean),n=[];let r=null,s=null,o=null,a=null;for(const i of t){const c=Ue.find(p=>i.startsWith(p)),d=c?i.slice(c.length).trim():i,m=Ve.find(p=>p.marker===c);if(m){const p=d.indexOf(":"),$=p>-1&&p<=20?d.slice(p+1).trim():d;n.push({...m,...We($)})}else if(c==="🌟")r=d.replace(/^Wildcard:\s*/i,"").trim();else if(c==="⏱️"){const p=d.match(/suggests a timer of (\d+) segments/i),$=d.match(/highest card \(([^)]+)\)/i);p&&(o=parseInt(p[1],10)),$&&(a=$[1])}else c==="♠️"&&(s=d.replace(/^\*\*Ace Effect:\*\*\s*/i,"").trim())}return{positions:n,wildcardText:r,aceEffectText:s,timerSegments:o,timerCardLabel:a}}function Ze({parsed:e,title:t,tier:n,region:r,cardNames:s}){const o=h=>e.positions.find(I=>I.role===h),a=o("npc"),i=o("location"),c=o("complication"),d=o("reward"),m=(h,I,j,u)=>({id:x("scene_"),title:`${h}: ${I?.title||I?.cardLabel||j}`,description:[I?.flavor,u].filter(Boolean).join(`

Wildcard Twist: `),timers:[{name:`${I?.cardLabel||h} Timer`,segments:I?.tierSegments||4,current:0}],encounters:[],type:ee,completed:!1}),p=[];a&&p.push(m("Root",a,"The Actor")),i&&p.push(m("Crest",i,"The Location")),c&&p.push(m("Crown",c,"The Confrontation",e.wildcardText)),d&&p.push(m("Left Hand",d,"The Anchor"));const $=a?[{id:x("npc_"),name:a.title||a.cardLabel||"The Actor",role:"Root — Actor (Crown Spread)",motivation:a.flavor||""}]:[],_=i?[{id:x("loc_"),name:i.title||i.cardLabel||"The Location",description:i.flavor||""}]:[],E=e.timerSegments?[{name:`Adventure Clock (${e.timerCardLabel||"highest card"})`,segments:e.timerSegments,current:0,description:"Derived from the highest non-wildcard card in the reading — the pressure driving this adventure."}]:[],f=[`Crown Spread reading — Region: ${r||"Unknown"}. Cards: ${s||"Unknown"}.`];return e.aceEffectText&&f.push(`Ace Effect (GM aside): ${e.aceEffectText}`),{title:t,description:`A Tier ${n} adventure drawn from a Crown Spread reading in ${r||"an unknown region"}.`,tier:n,tierRange:n,author:"Crown Spread Import",acts:[{id:x("act_"),title:"The Reading Unfolds",description:"Structured from a Crown Spread: Root sets the actor, Crest sets the place, Crown is the confrontation, Left Hand is what anchors the party through it.",scenes:p}],npcs:$,locations:_,campaignTimers:E,bestiary:[],notes:f.join(`

`),status:"planned"}}async function Xe(){if(!g())return l("Only the GM can import Crown Spread as adventure.","error"),null;let e;try{e=await Q(()=>import("./decks.CN3iDKhv.js").then(s=>s.n),__vite__mapDeps([13,1,2,3,4,6,7,8,5,9,14]))}catch{return l("Decks module not available.","error"),null}if(C)return null;let t=null,n=null,r=e.getSelectedRegion?e.getSelectedRegion():null;try{const s=[...e.getDeckHistory?e.getDeckHistory():[]].reverse().find(o=>o.type==="Crown Spread");s&&(t=s.cards,n=s.synthesis)}catch{}if(!n){if(!r){const o=e.getRegionNames?e.getRegionNames():[];if(o.length===0)return l("No regions available yet — open the Decks tab once so it can discover region files, then come back here.","warning"),null;const a=o.map((d,m)=>`${m+1}. ${d}`).join(`
`),i=prompt(`No Crown Spread found yet, and no region selected in Decks.
Pick a region to draw one now:
${a}`);if(!i)return null;const c=parseInt(i,10)-1;if(isNaN(c)||c<0||c>=o.length)return l("Invalid selection.","error"),null;r=o[c]}const s=await e.quickCrownSpread(r);if(C||!s)return null;t=s.cardNames,n=s.result.synthesis}return Ye({synthesis:n,cardNames:t,region:r})}function Ye({synthesis:e,cardNames:t,region:n,title:r,tier:s}={}){if(!g())return l("Only the GM can create adventures from Crown Spread.","error"),null;if(!e)return l("No Crown Spread reading to build from.","error"),null;const o=r||prompt("Adventure title:","Crown Spread Adventure")||"Crown Spread Adventure",a=s||prompt("Tier (I-V):","I")||"I",i=Ke(e),c=oe(i.positions.length>0?Ze({parsed:i,title:o,tier:a,region:n,cardNames:t}):{title:o,description:n?`${e}

(Cards: ${t} — Region: ${n})`:e,tier:a,tierRange:a,author:"Crown Spread Import",acts:[{id:x("act_"),title:"The Reading Unfolds",description:e,scenes:[{id:x("scene_"),title:"Opening Scene",description:e,timers:[{name:"Adventure Clock",segments:6,current:0}],encounters:[],type:ee,completed:!1}]}],campaignTimers:[{name:"Adventure Clock",segments:8,current:0,description:"Overall adventure pace"}],bestiary:[],status:"planned"});return c?(ce(c.id),z=c.id,N="detail",w(),l(`👑 Built "${c.title}" from the Crown Spread and opened it for editing.`,"success"),c):null}function Qe(e){B=e,C=!1,M(),w()}function w(){if(!(!B||C))if(N==="detail"&&z)B.innerHTML=st(z);else if(N==="create"){if(!g()){l("Only the GM can create adventures.","error"),N="list",w();return}B.innerHTML=it(),ot()}else B.innerHTML=et(),at()}function et(){const e=b.length>0,t=g();return`
        <div class="adventures-modern-layout flex flex-col gap-2">
            <header class="adventures-header">
                <h1 class="page-title">🎭 Adventures</h1>
                <p class="page-sub">Load, track, and manage your Fate's Edge adventures.</p>
            </header>

            <div class="flex gap-1 flex-center flex-wrap" style="border-bottom:1px solid var(--border);padding-bottom:0.5rem;">
                ${t?`
                    <button class="btn btn-sm btn-gold" id="adv-browse-library-btn">📚 Browse Library</button>
                    <button class="btn btn-sm btn-secondary" id="adv-load-file-btn">📂 Load from File</button>
                    <button class="btn btn-sm btn-primary" id="adv-create-btn">✨ New Adventure</button>
                    <button class="btn btn-sm btn-secondary" id="adv-crown-gen-btn">👑 Import Crown Spread</button>
                `:`
                    <span style="font-size:0.75rem;color:var(--text3);">🔒 Read‑only – only the GM can manage adventures.</span>
                `}
                <button class="btn btn-sm btn-secondary" id="adv-refresh-btn">🔄 Refresh</button>
            </div>

            <div class="panel" style="min-height:300px;">
                ${e?`
                    <div class="flex flex-col gap-1">
                        ${b.map(n=>tt(n,t)).join("")}
                    </div>
                `:`
                    <div class="text-center" style="padding:2rem 0;">
                        <div style="font-size:3rem;">🎭</div>
                        <p class="text-muted">No adventures loaded yet.</p>
                        ${t?`
                            <p class="text-sm text-muted">Click "Browse Library" to pick one from /data/adventures/, "Load from File" to import your own, or create a new one.</p>
                            <div class="flex gap-1 flex-center mt-1">
                                <button class="btn btn-sm btn-gold" id="adv-load-file-btn">📂 Load from File</button>
                                <button class="btn btn-sm btn-secondary" id="adv-crown-gen-btn">👑 Import Crown Spread</button>
                            </div>
                        `:`
                            <p class="text-sm text-muted">No adventures available. Only the GM can add them.</p>
                        `}
                    </div>
                `}
            </div>

            <div class="panel" style="background:var(--bg2);border-left:4px solid var(--gold);font-size:0.75rem;color:var(--text3);">
                <strong>💡 Adventure Format:</strong> Adventures are stored in <code>/data/adventures/</code> as JSON files.
                Each adventure contains acts, scenes, timers, NPCs, locations, and a bestiary (creatures for encounters).
                Crown Spread generation creates a structured adventure from a card draw.
            </div>
        </div>
    `}function tt(e,t){try{return nt(e,t)}catch(n){console.error("[Adventures] Failed to render adventure card:",e?.id,n);const r=t?`<button class="btn btn-xs btn-danger" onclick="window.adventureDelete('${e?.id}')">🗑️ Remove</button>`:"";return`
            <div class="panel" style="padding:0.6rem 0.8rem;border-left:4px solid var(--red);">
                <div style="font-weight:600;color:var(--red);">⚠️ "${v(e?.title||e?.id||"Unknown adventure")}" failed to render</div>
                <div style="font-size:0.75rem;color:var(--text3);margin:0.2rem 0;">${v(n.message)} — see browser console for details.</div>
                <div style="display:flex;gap:0.3rem;">
                    ${t?`<button class="btn btn-xs btn-secondary" onclick="window.adventureExport('${e?.id}')">📤 Export raw data</button>`:""}
                    ${r}
                </div>
            </div>
        `}}function nt(e,t){const n={planned:"var(--text3)",active:"var(--gold)",completed:"var(--green)",archived:"var(--text2)"},r={planned:"📋 Planned",active:"🔄 Active",completed:"✅ Completed",archived:"📦 Archived"},s={I:"#8bc34a",II:"#4caf50",III:"#ff9800",IV:"#e91e63",V:"#9c27b0"},o=e.acts?.length||0,a=e.acts?.reduce((m,p)=>m+(p.scenes?.length||0),0)||0,i=e.acts?.reduce((m,p)=>m+(p.scenes?.filter($=>$.completed).length||0),0)||0,c=a>0?Math.round(i/a*100):0,d=t?`<button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();window.adventureDelete('${e.id}')" style="color:var(--red);">✕</button>`:"";return`
        <div class="panel" style="padding:0.6rem 0.8rem;border-left:4px solid ${n[e.status]||"var(--border)"};cursor:pointer;" data-adv-id="${e.id}" onclick="window.adventureOpenDetail('${e.id}')">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:0.95rem;">${v(e.title)}</span>
                    <span style="font-size:0.65rem;padding:0.05rem 0.4rem;border-radius:8px;background:${s[e.tier]||"var(--text3)"}33;border:1px solid ${s[e.tier]||"var(--text3)"};color:${s[e.tier]||"var(--text3)"};">Tier ${e.tier}</span>
                    <span style="font-size:0.6rem;padding:0.05rem 0.4rem;border-radius:8px;background:${n[e.status]}33;border:1px solid ${n[e.status]};color:${n[e.status]};">${r[e.status]}</span>
                </div>
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span style="font-size:0.65rem;color:var(--text3);">${o} acts · ${a} scenes</span>
                    <span style="font-size:0.65rem;color:var(--text3);">${c}% done</span>
                    ${d}
                </div>
            </div>
            ${e.description?`<div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;">${v(Ie(e.description))}</div>`:""}
            <div style="display:flex;gap:0.2rem;flex-wrap:wrap;margin-top:0.2rem;">
                ${e.acts?.slice(0,3).map(m=>`
                    <span style="font-size:0.55rem;padding:0.05rem 0.3rem;border-radius:6px;background:var(--bg3);color:var(--text3);">${v(m.title)}</span>
                `).join("")}
                ${(e.acts?.length||0)>3?`<span style="font-size:0.55rem;padding:0.05rem 0.3rem;border-radius:6px;background:var(--bg3);color:var(--text3);">+${e.acts.length-3} more</span>`:""}
            </div>
            <div style="margin-top:0.2rem;display:flex;gap:0.2rem;font-size:0.6rem;color:var(--text3);">
                ${e.startedAt?`<span>📅 Started: ${new Date(e.startedAt).toLocaleDateString()}</span>`:""}
                ${e.completedAt?`<span>✅ Completed: ${new Date(e.completedAt).toLocaleDateString()}</span>`:""}
                <span>👤 ${v(e.author||"Unknown")}</span>
            </div>
        </div>
    `}function rt(e){const t=g(),n={planned:"var(--text3)",active:"var(--gold)",completed:"var(--green)",archived:"var(--text2)"},r={planned:"📋 Planned",active:"🔄 Active",completed:"✅ Completed",archived:"📦 Archived"},s={I:"#8bc34a",II:"#4caf50",III:"#ff9800",IV:"#e91e63",V:"#9c27b0"};e.acts?.length;const o=e.acts?.reduce((u,S)=>u+(S.scenes?.length||0),0)||0,a=e.acts?.reduce((u,S)=>u+(S.scenes?.filter(q=>q.completed).length||0),0)||0,i=o>0?Math.round(a/o*100):0,c=e.status==="active",d=e.campaignTimers?.map((u,S)=>`
        <div class="flex gap-1 flex-center" style="margin:0.1rem 0;">
            <span class="flex-1 text-sm">${v(u.name)}</span>
            <span style="font-size:0.65rem;color:var(--text2);">${u.description||""}</span>
            <div style="flex:1;background:var(--bg3);border-radius:var(--radius);height:6px;overflow:hidden;max-width:120px;">
                <div style="width:${u.current/u.segments*100}%;height:100%;background:${u.current/u.segments>.8?"var(--red)":"var(--gold)"};"></div>
            </div>
            <span class="text-xs text-muted">${u.current}/${u.segments}</span>
            ${t?`<button class="btn btn-xs btn-primary" onclick="window.adventureAdvanceTimer('${e.id}', ${S})">+1</button>`:""}
        </div>
    `).join("")||'<span class="text-muted text-sm">No campaign timers.</span>',m=e.acts?.map((u,S)=>{const q=u.scenes?.map((k,D)=>{const O=S===e.currentAct&&D===e.currentScene,P=k.completed,Y=`scene-desc-${e.id}-${S}-${D}`,de=k.timers?.map((W,me)=>`
                <span style="font-size:0.55rem;color:var(--text3);display:inline-flex;align-items:center;gap:0.15rem;">
                    ${v(W.name)} ${W.current}/${W.segments}
                    ${O&&t?`<button class="btn btn-xs btn-ghost" style="padding:0 0.2rem;font-size:0.55rem;" onclick="window.adventureAdvanceSceneTimer('${e.id}', ${S}, ${D}, ${me})" title="Tick +1">+1</button>`:""}
                </span>
            `).join("")||"",le=O&&t?`<button class="btn btn-xs btn-danger" onclick="window.adventureStartEncounter('${e.id}', ${S}, ${D})" title="${k.encounterId?"Reopen the Combat Tracker for this scene":"Create an Encounter from this scene and open the Combat Tracker"}">⚔️ ${k.encounterId?"Resume":"Start"} Encounter</button>`:"",ue=!P&&O&&t?`<button class="btn btn-xs btn-primary" onclick="window.adventureCompleteScene('${e.id}', ${S}, ${D})">✓ Complete</button>`:"";return`
                <div style="display:flex;flex-direction:column;padding:0.1rem 0.2rem;border-radius:4px;${O?"background:var(--bg4);border-left:3px solid var(--gold);":""}${P?"opacity:0.6;":""}">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="display:flex;align-items:center;gap:0.3rem;">
                            <span style="font-size:0.8rem;">${P?"✅":O?"▶️":"⏹️"}</span>
                            <span style="font-size:0.75rem;${O?"font-weight:600;color:var(--gold);":""}">${v(k.title)}</span>
                            <span style="font-size:0.65rem;color:var(--text3);" title="${v(Z(k.type).description)}">${Z(k.type).icon} ${v(Z(k.type).label)}</span>
                            ${k.description?`<button class="btn btn-xs btn-ghost" onclick="window.adventureToggleSceneDesc('${Y}')" title="Show/hide scene description" style="padding:0 0.3rem;font-size:0.7rem;">📖</button>`:""}
                        </div>
                        <div style="display:flex;gap:0.2rem;align-items:center;">
                            ${de}
                            ${le}
                            ${ue}
                        </div>
                    </div>
                    ${k.description?`<div id="${Y}" style="display:none;margin:0.2rem 0 0.3rem 1.3rem;font-size:0.75rem;">${X(k.description)}</div>`:""}
                </div>
            `}).join("")||'<span class="text-muted text-sm">No scenes.</span>';return`
            <div class="panel" style="background:var(--bg3);border-left:3px solid var(--gold);padding:0.3rem 0.5rem;margin:0.2rem 0;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:0.85rem;">${v(u.title)}</span>
                    <span style="font-size:0.65rem;color:var(--text3);">${u.scenes?.length||0} scenes</span>
                </div>
                ${u.description?`<div style="font-size:0.7rem;">${X(u.description)}</div>`:""}
                <div style="margin-top:0.2rem;display:flex;flex-direction:column;gap:0.1rem;padding-left:0.3rem;">
                    ${q}
                </div>
            </div>
        `}).join("")||'<span class="text-muted text-sm">No acts defined.</span>',p=e.npcs?.map(u=>`
        <div class="panel" style="background:var(--bg3);padding:0.2rem 0.4rem;margin:0.1rem 0;border-left:2px solid var(--gold);">
            <span style="font-weight:600;font-size:0.8rem;">${v(u.name)}</span>
            ${u.role?`<span style="font-size:0.65rem;color:var(--text3);"> — ${v(u.role)}</span>`:""}
            ${u.motivation?`<div style="font-size:0.65rem;color:var(--text2);">🎯 ${v(u.motivation)}</div>`:""}
        </div>
    `).join("")||'<span class="text-muted text-sm">No NPCs.</span>',$=e.locations?.map(u=>`
        <div class="panel" style="background:var(--bg3);padding:0.2rem 0.4rem;margin:0.1rem 0;border-left:2px solid var(--blue);">
            <span style="font-weight:600;font-size:0.8rem;">📍 ${v(u.name)}</span>
            ${u.description?`<div style="font-size:0.65rem;color:var(--text2);">${v(u.description)}</div>`:""}
        </div>
    `).join("")||'<span class="text-muted text-sm">No locations.</span>',_=(e.bestiary||[]).map(u=>`
        <div class="panel" style="background:var(--bg3);padding:0.2rem 0.4rem;margin:0.1rem 0;border-left:2px solid var(--red);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
            <div>
                <span style="font-weight:600;font-size:0.8rem;">${v(u.name)}</span>
                ${u.tl?`<span style="font-size:0.6rem;color:var(--red);">TL${u.tl}</span>`:""}
                ${u.class?`<span style="font-size:0.6rem;color:var(--accent);">${v(u.class)}</span>`:""}
                ${u.category?`<span style="font-size:0.6rem;color:var(--text3);">${v(u.category)}</span>`:""}
                ${u.description?`<div style="font-size:0.65rem;color:var(--text2);">${v(u.description.slice(0,60))}${u.description.length>60?"…":""}</div>`:""}
            </div>
            ${t?`<button class="btn btn-xs btn-danger" onclick="window.adventureRemoveBestiaryCreature('${e.id}','${u.id}')">✕</button>`:""}
        </div>
    `).join("")||'<span class="text-muted text-sm">No creatures in adventure bestiary. Add some to use in encounters.</span>',E=e._gmhints,f=E?.tone?`${E.tone.slice(0,140)}${E.tone.length>140?"…":""}`:"",h=t&&E?`
        <div class="panel" style="border-left:2px solid var(--accent);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h4 style="margin:0;font-size:0.9rem;">🧭 GM Hints</h4>
                <button class="btn btn-xs btn-secondary" onclick="window.adventureOpenGmHints('${e.id}')">Expand ↗</button>
            </div>
            ${f?`<div style="font-size:0.7rem;color:var(--text2);margin-top:0.2rem;">${v(f)}</div>`:'<div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">Pacing notes available — click Expand to view.</div>'}
        </div>
    `:"",I=t?`<textarea id="adv-notes" rows="3" style="width:100%;font-size:0.75rem;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;">${v(e.notes||"")}</textarea>
           <button class="btn btn-xs btn-primary mt-1" onclick="window.adventureSaveNotes('${e.id}')">💾 Save Notes</button>`:`<div style="font-size:0.75rem;color:var(--text2);white-space:pre-wrap;">${v(e.notes||"")}</div>`,j=t?`
        ${!c&&e.status!=="completed"?`<button class="btn btn-sm btn-gold" onclick="window.adventureStart('${e.id}')">▶️ Start</button>`:""}
        ${c?`<button class="btn btn-sm btn-secondary" onclick="window.adventureReset('${e.id}')">🔄 Reset</button>`:""}
        <button class="btn btn-sm btn-secondary" onclick="window.adventureExport('${e.id}')">📤 Export</button>
        <button class="btn btn-sm btn-secondary" onclick="window.adventureDuplicate('${e.id}')">📋 Duplicate</button>
        <button class="btn btn-sm btn-danger" onclick="window.adventureDelete('${e.id}')">🗑️ Delete</button>
    `:`
        <span style="font-size:0.75rem;color:var(--text3);">🔒 Read‑only – only the GM can manage this adventure.</span>
    `;return`
        <div class="adventure-detail flex flex-col gap-2">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button>
                    <span style="font-weight:600;font-size:1.1rem;color:var(--gold);">${v(e.title)}</span>
                    <span style="font-size:0.65rem;padding:0.05rem 0.4rem;border-radius:8px;background:${s[e.tier]||"var(--text3)"}33;border:1px solid ${s[e.tier]||"var(--text3)"};color:${s[e.tier]||"var(--text3)"};">Tier ${e.tier}</span>
                    <span style="font-size:0.6rem;padding:0.05rem 0.4rem;border-radius:8px;background:${n[e.status]}33;border:1px solid ${n[e.status]};color:${n[e.status]};">${r[e.status]}</span>
                </div>
                <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                    ${j}
                </div>
            </div>

            ${e.description?`<div style="font-size:0.85rem;padding:0.2rem 0;">${X(e.description)}</div>`:""}

            <div style="display:grid;grid-template-columns:2fr 1fr;gap:0.5rem;">
                <div class="flex flex-col gap-1">
                    <div class="panel">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                            <h4 style="margin:0;font-size:0.9rem;">📜 Progress</h4>
                            <span style="font-size:0.75rem;color:var(--text3);">${a}/${o} scenes · ${i}%</span>
                        </div>
                        <div style="width:100%;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-top:0.2rem;">
                            <div style="width:${i}%;height:100%;background:${i>80?"var(--green)":i>50?"var(--gold)":"var(--blue)"};border-radius:4px;"></div>
                        </div>
                    </div>

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">⏱️ Campaign Timers</h4>
                        ${d}
                    </div>

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">📖 Acts & Scenes</h4>
                        ${m}
                    </div>
                </div>

                <div class="flex flex-col gap-1">
                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">👤 NPCs</h4>
                        <div style="max-height:200px;overflow-y:auto;">${p}</div>
                    </div>

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">📍 Locations</h4>
                        <div style="max-height:150px;overflow-y:auto;">${$}</div>
                    </div>

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">🐉 Bestiary (Adventure Creatures)</h4>
                        <div style="max-height:200px;overflow-y:auto;margin-bottom:0.3rem;">${_}</div>
                        ${t?`<button class="btn btn-xs btn-secondary" onclick="window.adventureAddBestiaryCreature('${e.id}')">+ Add Creature</button>`:""}
                    </div>

                    ${h}

                    <div class="panel">
                        <h4 style="margin:0;font-size:0.9rem;">📝 Notes</h4>
                        ${I}
                    </div>
                </div>
            </div>
        </div>
    `}function st(e){const t=A(e);if(!t)return'<div class="panel"><p class="text-muted">Adventure not found.</p><button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button></div>';try{return rt(t)}catch(n){console.error("[Adventures] Failed to render adventure detail:",e,n);const r=g();return`
            <div class="panel">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button>
                </div>
                <p style="color:var(--red);font-weight:600;">⚠️ This adventure failed to render: ${v(n.message)}</p>
                <p class="text-muted" style="font-size:0.75rem;">Check the browser console for the full error. The underlying data is still there — Export to inspect the raw JSON, or Delete to remove it.</p>
                <div style="display:flex;gap:0.5rem;">
                    ${r?`<button class="btn btn-sm btn-secondary" onclick="window.adventureExport('${e}')">📤 Export</button>`:""}
                    ${r?`<button class="btn btn-sm btn-danger" onclick="window.adventureDelete('${e}')">🗑️ Delete</button>`:""}
                </div>
            </div>
        `}}function it(){return`
        <div class="adventure-create flex flex-col gap-2">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <h2 style="margin:0;font-size:1.1rem;color:var(--gold);">✨ Create New Adventure</h2>
                <button class="btn btn-sm btn-secondary" onclick="window.adventureBackToList()">← Back</button>
            </div>

            <div class="panel">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div>
                        <label style="font-size:0.75rem;font-weight:600;">Title *</label>
                        <input id="adv-create-title" placeholder="Adventure title" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;" />
                    </div>
                    <div>
                        <label style="font-size:0.75rem;font-weight:600;">Tier</label>
                        <select id="adv-create-tier" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;">
                            <option value="I">I — Novice</option>
                            <option value="II">II — Seasoned</option>
                            <option value="III" selected>III — Veteran</option>
                            <option value="IV">IV — Paragon</option>
                            <option value="V">V — Mythic</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top:0.3rem;">
                    <label style="font-size:0.75rem;font-weight:600;">Description</label>
                    <textarea id="adv-create-description" rows="2" placeholder="Adventure description" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem;"></textarea>
                </div>
            </div>

            <div class="panel">
                <h4 style="margin:0;font-size:0.85rem;">📖 Acts & Scenes</h4>
                <p style="font-size:0.7rem;color:var(--text3);">Each act contains scenes. Add acts and scenes to structure your adventure.</p>
                <div id="adv-create-acts-container"></div>
                <button class="btn btn-sm btn-secondary mt-1" id="adv-add-act-btn">+ Add Act</button>
            </div>

            <div class="panel">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div>
                        <h4 style="margin:0;font-size:0.85rem;">👤 NPCs</h4>
                        <div id="adv-create-npcs-container"></div>
                        <button class="btn btn-xs btn-secondary mt-1" id="adv-add-npc-btn">+ Add NPC</button>
                    </div>
                    <div>
                        <h4 style="margin:0;font-size:0.85rem;">📍 Locations</h4>
                        <div id="adv-create-locations-container"></div>
                        <button class="btn btn-xs btn-secondary mt-1" id="adv-add-location-btn">+ Add Location</button>
                    </div>
                </div>
            </div>

            <div class="panel">
                <h4 style="margin:0;font-size:0.85rem;">⏱️ Campaign Timers</h4>
                <div id="adv-create-timers-container"></div>
                <button class="btn btn-xs btn-secondary mt-1" id="adv-add-timer-btn">+ Add Timer</button>
            </div>

            <div class="panel">
                <h4 style="margin:0;font-size:0.85rem;">🐉 Bestiary (optional)</h4>
                <p style="font-size:0.7rem;color:var(--text3);">Creatures you can reference in scene encounters.</p>
                <div id="adv-create-bestiary-container"></div>
                <button class="btn btn-xs btn-secondary mt-1" id="adv-add-bestiary-btn">+ Add Creature</button>
            </div>

            <div class="flex gap-1">
                <button class="btn btn-gold" id="adv-create-save-btn">💾 Create Adventure</button>
                <button class="btn btn-secondary" onclick="window.adventureBackToList()">Cancel</button>
            </div>
        </div>
    `}function at(){const e=g(),t=document.getElementById("adv-browse-library-btn");t&&e&&t.addEventListener("click",ze);const n=document.getElementById("adv-load-file-btn");n&&e&&n.addEventListener("click",async()=>{await Je(),!C&&w()});const r=document.getElementById("adv-create-btn");r&&e&&r.addEventListener("click",()=>{N="create",w()});const s=document.getElementById("adv-crown-gen-btn");s&&e&&s.addEventListener("click",async()=>{const a=await Xe();C||a&&w()});const o=document.getElementById("adv-refresh-btn");o&&o.addEventListener("click",()=>{M(),w(),l("🔄 Adventures refreshed","info")})}function ot(){const e=document.getElementById("adv-add-act-btn");e&&e.addEventListener("click",()=>{const a=document.getElementById("adv-create-acts-container");if(!a)return;a.children.length;const i=document.createElement("div");i.className="adv-act-row",i.style.cssText="background:var(--bg3);padding:0.3rem;border-radius:var(--radius);margin:0.2rem 0;border-left:2px solid var(--gold);",i.innerHTML=`
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <input type="text" class="adv-act-title" placeholder="Act title" style="flex:2;min-width:120px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.2rem 0.3rem;font-size:0.8rem;" />
                    <input type="text" class="adv-act-desc" placeholder="Act description" style="flex:3;min-width:120px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.2rem 0.3rem;font-size:0.8rem;" />
                    <button class="btn btn-xs btn-danger adv-remove-act-btn">✕</button>
                </div>
                <div class="adv-scenes-container" style="margin-top:0.2rem;padding-left:0.5rem;"></div>
                <button class="btn btn-xs btn-secondary adv-add-scene-btn" style="margin-top:0.1rem;">+ Scene</button>
            `,a.appendChild(i),i.querySelector(".adv-add-scene-btn").addEventListener("click",()=>{const c=i.querySelector(".adv-scenes-container"),d=c.children.length,m=document.createElement("div");m.className="adv-scene-row",m.style.cssText="display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;",m.innerHTML=`
                    <span style="font-size:0.6rem;color:var(--text3);width:20px;">${d+1}.</span>
                    <input type="text" class="adv-scene-title" placeholder="Scene title" style="flex:2;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                    <input type="text" class="adv-scene-desc" placeholder="Scene description" style="flex:3;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                    <select class="adv-scene-objective-type" title="Objective type — what kind of clock this scene's encounter uses" style="min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;">
                        ${Object.entries(be).map(([f,h])=>`<option value="${f}" ${f==="combat"?"selected":""}>${h.icon} ${h.label}</option>`).join("")}
                    </select>
                    <input type="text" class="adv-scene-custom-label" placeholder="Timer Label" style="display:none;min-width:90px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                    <input type="text" class="adv-scene-custom-tick-label" placeholder="Tick Label" style="display:none;min-width:90px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                    <input type="number" class="adv-scene-timer-segments" placeholder="Timer segments" value="6" style="width:60px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                    <button class="btn btn-xs btn-danger adv-remove-scene-btn">✕</button>
                `,c.appendChild(m),m.querySelector(".adv-remove-scene-btn").addEventListener("click",()=>{m.remove()});const p=m.querySelector(".adv-scene-objective-type"),$=m.querySelector(".adv-scene-custom-label"),_=m.querySelector(".adv-scene-custom-tick-label"),E=()=>{const f=p.value==="custom"?"inline-block":"none";$.style.display=f,_.style.display=f};p.addEventListener("change",E),E()}),i.querySelector(".adv-remove-act-btn").addEventListener("click",()=>{i.remove()})});const t=document.getElementById("adv-add-npc-btn");t&&t.addEventListener("click",()=>{const a=document.getElementById("adv-create-npcs-container");if(!a)return;const i=document.createElement("div");i.className="adv-npc-row",i.style.cssText="display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;",i.innerHTML=`
                <input type="text" class="adv-npc-name" placeholder="Name" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="text" class="adv-npc-role" placeholder="Role" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="text" class="adv-npc-motivation" placeholder="Motivation" style="flex:1.5;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <button class="btn btn-xs btn-danger adv-remove-npc-btn">✕</button>
            `,a.appendChild(i),i.querySelector(".adv-remove-npc-btn").addEventListener("click",()=>{i.remove()})});const n=document.getElementById("adv-add-location-btn");n&&n.addEventListener("click",()=>{const a=document.getElementById("adv-create-locations-container");if(!a)return;const i=document.createElement("div");i.className="adv-location-row",i.style.cssText="display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;",i.innerHTML=`
                <input type="text" class="adv-location-name" placeholder="Name" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="text" class="adv-location-desc" placeholder="Description" style="flex:2;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <button class="btn btn-xs btn-danger adv-remove-location-btn">✕</button>
            `,a.appendChild(i),i.querySelector(".adv-remove-location-btn").addEventListener("click",()=>{i.remove()})});const r=document.getElementById("adv-add-timer-btn");r&&r.addEventListener("click",()=>{const a=document.getElementById("adv-create-timers-container");if(!a)return;const i=document.createElement("div");i.className="adv-timer-row",i.style.cssText="display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;",i.innerHTML=`
                <input type="text" class="adv-timer-name" placeholder="Timer name" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="number" class="adv-timer-segments" placeholder="Segments" value="6" style="width:60px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <input type="text" class="adv-timer-desc" placeholder="Description" style="flex:1.5;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <button class="btn btn-xs btn-danger adv-remove-timer-btn">✕</button>
            `,a.appendChild(i),i.querySelector(".adv-remove-timer-btn").addEventListener("click",()=>{i.remove()})});const s=document.getElementById("adv-add-bestiary-btn");s&&s.addEventListener("click",()=>{const a=document.getElementById("adv-create-bestiary-container");if(!a)return;const i=document.createElement("div");i.className="adv-bestiary-row",i.style.cssText="display:flex;gap:0.2rem;margin:0.1rem 0;align-items:center;flex-wrap:wrap;",i.innerHTML=`
                <input type="text" class="adv-bestiary-name" placeholder="Name" style="flex:1;min-width:80px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.75rem;" />
                <input type="text" class="adv-bestiary-tl" placeholder="TL" value="2" style="width:40px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <input type="text" class="adv-bestiary-class" placeholder="Class" style="width:40px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <input type="text" class="adv-bestiary-desc" placeholder="Description" style="flex:1.5;min-width:100px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.15rem 0.3rem;font-size:0.7rem;" />
                <button class="btn btn-xs btn-danger adv-remove-bestiary-btn">✕</button>
            `,a.appendChild(i),i.querySelector(".adv-remove-bestiary-btn").addEventListener("click",()=>{i.remove()})});const o=document.getElementById("adv-create-save-btn");o&&o.addEventListener("click",()=>{const a=document.getElementById("adv-create-title")?.value.trim();if(!a){l("Please enter a title.","error");return}const i=document.getElementById("adv-create-tier")?.value||"III",c=document.getElementById("adv-create-description")?.value.trim()||"",d=[];document.querySelectorAll(".adv-act-row").forEach(f=>{const h=f.querySelector(".adv-act-title"),I=f.querySelector(".adv-act-desc"),j=[];f.querySelectorAll(".adv-scene-row").forEach(u=>{const S=u.querySelector(".adv-scene-title")?.value.trim()||"Untitled Scene",q=u.querySelector(".adv-scene-desc")?.value.trim()||"",k=K(u.querySelector(".adv-scene-timer-segments")?.value,6),D=u.querySelector(".adv-scene-objective-type")?.value||"combat",O=u.querySelector(".adv-scene-custom-label")?.value.trim()||"",P=u.querySelector(".adv-scene-custom-tick-label")?.value.trim()||"";j.push({id:x("scene_"),title:S,description:q,timers:[{name:`${S} Timer`,segments:k,current:0}],encounters:[],type:D,customLabel:O,customTickLabel:P,completed:!1})}),j.length>0&&d.push({id:x("act_"),title:h?.value.trim()||"Untitled Act",description:I?.value.trim()||"",scenes:j})});const m=[];document.querySelectorAll(".adv-npc-row").forEach(f=>{const h=f.querySelector(".adv-npc-name")?.value.trim();h&&m.push({id:x("npc_"),name:h,role:f.querySelector(".adv-npc-role")?.value.trim()||"",motivation:f.querySelector(".adv-npc-motivation")?.value.trim()||""})});const p=[];document.querySelectorAll(".adv-location-row").forEach(f=>{const h=f.querySelector(".adv-location-name")?.value.trim();h&&p.push({id:x("loc_"),name:h,description:f.querySelector(".adv-location-desc")?.value.trim()||""})});const $=[];document.querySelectorAll(".adv-timer-row").forEach(f=>{const h=f.querySelector(".adv-timer-name")?.value.trim();h&&$.push({name:h,segments:K(f.querySelector(".adv-timer-segments")?.value,6),current:0,description:f.querySelector(".adv-timer-desc")?.value.trim()||""})});const _=[];if(document.querySelectorAll(".adv-bestiary-row").forEach(f=>{const h=f.querySelector(".adv-bestiary-name")?.value.trim();h&&_.push({id:x("creature_"),name:h,tl:K(f.querySelector(".adv-bestiary-tl")?.value,2),class:f.querySelector(".adv-bestiary-class")?.value.trim()||"",description:f.querySelector(".adv-bestiary-desc")?.value.trim()||""})}),d.length===0){l("Please add at least one act with scenes.","error");return}const E=oe({title:a,description:c,tier:i,tierRange:i,author:"GM",acts:d,npcs:m,locations:p,factions:[],campaignTimers:$,bestiary:_,notes:"",status:"planned"});l(`✨ Created "${E.title}"`,"success"),N="list",w()})}window.adventureBackToList=function(){N="list",w()};window.adventureOpenDetail=function(e){z=e,N="detail",w()};window.adventureDelete=function(e){if(!g()){l("Only the GM can delete adventures.","error");return}const t=A(e);t&&confirm(`Delete "${t.title}"?`)&&(Be(e),w(),l(`🗑️ Deleted "${t.title}"`,"info"))};window.adventureStart=function(e){const t=Me(e);t&&(w(),l(`▶️ Started "${t.title}"`,"success"))};window.adventureReset=function(e){if(!g()){l("Only the GM can reset adventures.","error");return}if(!confirm(`Reset "${A(e)?.title}" to planned?`))return;const t=He(e);t&&(w(),l(`🔄 Reset "${t.title}"`,"info"))};window.adventureCompleteScene=function(e,t,n){je(e,t,n)&&(w(),l("✅ Scene completed!","success"))};window.adventureStartEncounter=function(e,t,n){Pe(e,t,n)};window.adventureToggleSceneDesc=function(e){const t=document.getElementById(e);t&&(t.style.display=t.style.display==="none"?"block":"none")};window.adventureOpenGmHints=function(e){const t=A(e),n=t?._gmhints;if(!n)return;const r=n.pacing&&typeof n.pacing=="object"?Object.entries(n.pacing).map(([a,i])=>`
            <div style="margin:0.5rem 0;">
                <div style="font-weight:600;font-size:0.8rem;color:var(--gold);text-transform:capitalize;">${v(a.replace(/_/g," "))}</div>
                <div style="font-size:0.8rem;color:var(--text2);white-space:pre-wrap;">${v(i)}</div>
            </div>
        `).join(""):"",s=`
        ${n.tone?`
            <div class="panel" style="margin-bottom:0.5rem;">
                <h4 style="margin:0 0 0.2rem;font-size:0.85rem;">🎭 Tone</h4>
                <div style="font-size:0.85rem;color:var(--text);white-space:pre-wrap;">${v(n.tone)}</div>
            </div>
        `:""}
        ${r?`
            <div class="panel">
                <h4 style="margin:0 0 0.2rem;font-size:0.85rem;">⏳ Pacing</h4>
                ${r}
            </div>
        `:""}
        ${!n.tone&&!r?'<p class="text-muted">No GM hints recorded for this adventure.</p>':""}
    `,o=we("adv-gmhints-screen");o.innerHTML=Ae("adv-gmhints-screen",`🧭 GM Hints — ${v(t.title)}`,s,{maxWidth:"640px"}),document.getElementById("adv-gmhints-screen-back")?.addEventListener("click",()=>{$e("adv-gmhints-screen")})};window.adventureAdvanceTimer=function(e,t){De(e,t)&&w()};window.adventureAdvanceSceneTimer=function(e,t,n,r,s=1){Re(e,t,n,r,s)&&w()};window.adventureExport=function(e){ce(e)};window.adventureDuplicate=function(e){const t=Ne(e);t&&(w(),l(`📋 Duplicated "${t.title}"`,"success"))};window.adventureSaveNotes=function(e){if(!g()){l("Only the GM can save notes.","error");return}const t=document.getElementById("adv-notes")?.value;t!==void 0&&(Oe(e,{notes:t}),l("💾 Notes saved","success"))};window.adventureAddBestiaryCreature=function(e){if(!g()){l("Only the GM can add creatures.","error");return}const t=A(e);if(!t){l("Adventure not found.","error");return}const n=prompt("Creature name:");if(!n)return;const r=parseInt(prompt("TL (1-10):","2"),10)||2,s=prompt("Class (I-X):","I")||"I",o=prompt("Brief description:","")||"",a={id:x("creature_"),name:n,tl:r,class:s,description:o,stats:{hp:r*10+10},sb_spends:[]};t.bestiary||(t.bestiary=[]),t.bestiary.push(a),y(),w(),l(`🐉 Added "${n}" to bestiary.`,"success")};window.adventureRemoveBestiaryCreature=function(e,t){if(!g()){l("Only the GM can remove creatures.","error");return}const n=A(e);if(!n||!n.bestiary)return;const r=n.bestiary.findIndex(s=>s.id===t);r!==-1&&confirm(`Remove "${n.bestiary[r].name}" from bestiary?`)&&(n.bestiary.splice(r,1),y(),w(),l("Creature removed.","info"))};function yt(){C=!1,M(),B&&Qe(B)}function ht(){y()}function xt(){M(),w()}function wt(){C=!0,B=null,y()}export{Re as advanceSceneTimer,De as advanceTimer,ze as browseAdventureLibrary,je as completeScene,oe as createAdventure,Ye as createAdventureFromCrownSpreadReading,Be as deleteAdventure,wt as destroy,Ne as duplicateAdventure,ce as exportAdventure,_e as getActiveAdventure,A as getAdventure,Je as importAdventureFromFile,Xe as importCrownSpreadAsAdventure,Fe as installAdventureContent,Ce as loadAdventureFromFile,Le as loadAdventureManifest,M as loadAdventuresFromState,yt as onActivate,ht as onDeactivate,xt as refresh,gt as removeInstalledAdventure,Qe as render,He as resetAdventure,y as saveAdventuresToState,Me as startAdventure,Pe as startSceneEncounter,Oe as updateAdventure};
